import { Plugin, App, Editor, Notice, MarkdownView, Modal, MarkdownPostProcessorContext, TFile } from 'obsidian';
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import ADOApi from './ado/api.js';
import { EpicsManager } from './ado/epics.js';
import { FeaturesManager } from './ado/features.js';
import { QueriesManager } from './ado/queries.js'; // Import QueriesManager
import SettingsTab from './ui/settingsTab.js';
import { Epic, Feature, WorkItemQueryResult } from './types/index.js'; // Added Feature and WorkItemQueryResult

export default class ADOPlugin extends Plugin {
    public adoApi!: ADOApi;
    public epicsManager!: EpicsManager;
    public featuresManager!: FeaturesManager;
    public queriesManager!: QueriesManager; // Added QueriesManager
    public settings: any;

    async onload() {
        await this.loadSettings();

        this.adoApi = new ADOApi();
        // Pass settings to the managers
        this.epicsManager = new EpicsManager(this.adoApi, this.settings);
        this.featuresManager = new FeaturesManager(this.adoApi, this.settings);
        this.queriesManager = new QueriesManager(this.adoApi, this.settings); // Instantiate QueriesManager

        this.addRibbonIcon('dice', 'Manage Epics', async () => {
            // Logic to manage epics
        });

        this.addRibbonIcon('star', 'Manage Features', async () => {
            // Logic to manage features
        });

        this.addSettingTab(new SettingsTab(this.app, this));

        // Register the Epic Anchor command
        this.addCommand({
            id: 'insert-epic-anchor',
            name: 'Insert Epic Anchor',
            editorCallback: (editor, view) => {
                insertEpicAnchor(this.app, editor);
            }
        });

        // This MarkdownPostProcessor is for rendering ADO anchors in Live Preview / Reading mode.
        console.log('Registering ADO Anchor Post Processor');
        this.registerMarkdownPostProcessor((element: HTMLElement, context: MarkdownPostProcessorContext) => {
            const codeElements = element.querySelectorAll('code');
            codeElements.forEach((codeEl: HTMLElement) => {
                const anchorText = codeEl.textContent;
                if (!anchorText) return;

                const match = anchorText.match(/<<([Q]?#)([^>]+?)>>/);

                if (match) {
                    const prefix = match[1]; // 'Q#' or '#'
                    const id = match[2];
                    const anchorType = (prefix === 'Q#') ? 'query' : 'epic';

                    // Avoid re-processing
                    if (codeEl.parentElement?.classList.contains('ado-epic-view-container') || 
                        codeEl.parentElement?.classList.contains('ado-query-placeholder-container') || // New class for query placeholders
                        codeEl.dataset.adoProcessed === 'true') {
                        return;
                    }
                    // Mark as processed early to prevent issues if other logic re-triggers post-processing
                    // on the same element before replacement is complete.
                    codeEl.dataset.adoProcessed = 'true'; 

                    let replacementTarget: Element = codeEl;
                    if (codeEl.parentElement && codeEl.parentElement.tagName === 'P' && codeEl.parentElement.childNodes.length === 1) {
                        replacementTarget = codeEl.parentElement;
                    }

                    if (anchorType === 'epic') {
                        // Ensure 'id' is a valid number for epics if it was captured by the broader regex
                        if (!/^\d+$/.test(id)) {
                            console.warn(`Invalid Epic ID detected: ${id}. Skipping rendering.`);
                            codeEl.dataset.adoProcessed = 'false'; // Unmark if not valid for epic
                            return; 
                        }
                        const epicId = id; // Already validated as digits for epic type

                        const container = document.createElement('div');
                        container.classList.add('ado-epic-view-container');
                        container.style.width = '100%'; // Attempt to take full width of its parent column
                        container.style.marginBottom = '1em';
                        container.style.border = '1px solid var(--background-modifier-border)';
                        container.style.borderRadius = '5px';
                        container.style.boxSizing = 'border-box'; // Include padding and border in the element's total width and height

                        const header = document.createElement('div');
                        header.classList.add('ado-epic-header');
                        header.style.padding = '10px';
                        header.style.cursor = 'pointer';
                        header.style.backgroundColor = 'var(--background-secondary)';
                        header.style.borderBottom = '1px solid var(--background-modifier-border)';
                        header.innerHTML = `<strong>Epic #${epicId}</strong> <span class="ado-epic-title-placeholder"></span> <span class="ado-epic-state-placeholder"></span> <span class="ado-epic-toggle-indicator" style="float: right; font-weight: normal; color: var(--text-muted);">[+] Expand</span>`;
                        
                        const contentArea = document.createElement('div');
                        contentArea.classList.add('ado-epic-content');
                        contentArea.style.display = 'none';
                        contentArea.style.padding = '10px';
                        contentArea.dataset.loaded = 'false';

                        container.appendChild(header);
                        container.appendChild(contentArea);

                        const container = document.createElement('div');
                        container.classList.add('ado-epic-view-container');
                        container.style.width = '100%'; 
                        container.style.marginBottom = '1em';
                        container.style.border = '1px solid var(--background-modifier-border)';
                        container.style.borderRadius = '5px';
                        container.style.boxSizing = 'border-box';

                        const header = document.createElement('div');
                        header.classList.add('ado-epic-header');
                        header.style.padding = '10px';
                        header.style.cursor = 'pointer';
                        header.style.backgroundColor = 'var(--background-secondary)';
                        header.style.borderBottom = '1px solid var(--background-modifier-border)';
                        // Use epicId (which is `id` for epics)
                        header.innerHTML = `<strong>Epic #${epicId}</strong> <span class="ado-epic-title-placeholder"></span> <span class="ado-epic-state-placeholder"></span> <span class="ado-epic-toggle-indicator" style="float: right; font-weight: normal; color: var(--text-muted);">[-] Collapse</span>`;
                        
                        const contentArea = document.createElement('div');
                        contentArea.classList.add('ado-epic-content');
                        contentArea.style.display = 'block'; // Default to expanded
                        contentArea.style.padding = '10px';
                        contentArea.dataset.loaded = 'false';

                        container.appendChild(header);
                        container.appendChild(contentArea);
                        
                        replacementTarget.replaceWith(container);
                        
                        loadEpicContent(epicId, contentArea, header, this);

                        header.onclick = async () => {
                            const isCurrentlyHidden = contentArea.style.display === 'none';
                            const toggleIndicator = header.querySelector('.ado-epic-toggle-indicator') as HTMLElement;

                            if (isCurrentlyHidden) {
                                contentArea.style.display = 'block';
                                if (toggleIndicator) toggleIndicator.textContent = '[-] Collapse';
                                if (contentArea.dataset.loaded === 'false') {
                                    loadEpicContent(epicId, contentArea, header, this);
                                }
                            } else {
                                contentArea.style.display = 'none';
                                if (toggleIndicator) toggleIndicator.textContent = '[+] Expand';
                            }
                        };
                        // No need for: if (replacementTarget !== codeEl) codeEl.dataset.adoProcessed = 'true';
                        // because codeEl.dataset.adoProcessed = 'true' was set early.

                    } else if (anchorType === 'query') {
                        const queryPlaceholderContainer = document.createElement('div');
                        queryPlaceholderContainer.classList.add('ado-query-placeholder-container');

                        const queryButton = document.createElement('button');
                        queryButton.classList.add('ado-query-button'); // For styling
                        queryButton.textContent = `View Query: ${id}`;
                        queryButton.style.cursor = 'pointer';
                        // Basic button styling - can be enhanced with CSS later
                        queryButton.style.padding = '5px 10px';
                        queryButton.style.border = '1px solid var(--background-modifier-border)';
                        queryButton.style.borderRadius = '3px';
                        queryButton.style.backgroundColor = 'var(--interactive-normal)';
                        
                        // 'this' inside this callback refers to the ADOPlugin instance.
                        const pluginInstance = this; 
                        queryButton.onclick = async () => {
                            const notice = new Notice(`Loading results for Query: ${id}...`, 0);
                            try {
                                // Ensure API is configured before making calls
                                if (!pluginInstance.settings?.organizationUrl || !pluginInstance.settings?.pat) {
                                    new Notice('Azure DevOps connection details are not set in plugin settings.');
                                    return;
                                }
                                pluginInstance.adoApi.setBaseUrl(pluginInstance.settings.organizationUrl);
                                pluginInstance.adoApi.setPersonalAccessToken(pluginInstance.settings.pat);
                                
                                // Pass a second argument (e.g., true) to signal fetching comprehensive fields.
                                const results = await pluginInstance.queriesManager.executeQuery(id, true);
                                new QueryResultsViewModal(pluginInstance.app, pluginInstance, results, id).open();
                            } catch (error) {
                                console.error(`Error executing or displaying query ${id} from post-processor:`, error);
                                new Notice(`Failed to load results for Query: ${id}. See console for details.`);
                            } finally {
                                notice.hide();
                            }
                        };

                        queryPlaceholderContainer.appendChild(queryButton);
                        replacementTarget.replaceWith(queryPlaceholderContainer);
                        // No need for: if (replacementTarget !== codeEl) codeEl.dataset.adoProcessed = 'true';
                        // because codeEl.dataset.adoProcessed = 'true' was set early.
                    }
                }
            });
        });

        console.log('Registering ADO Anchor Editor Extension'); // Updated log message
        this.registerEditorExtension(adoAnchorViewPlugin(this)); // Updated to use renamed plugin

        // Register the Execute ADO Query command
        this.addCommand({
            id: 'execute-ado-query',
            name: 'Execute Azure DevOps Query',
            callback: async () => {
                new QueryInputModal(this.app, async (queryIdOrPath: string) => {
                    if (!queryIdOrPath) return;

                    const loadingNotice = new Notice('Executing query...', 0); // Indefinite notice
                    try {
                        // Ensure ADO API is configured
                        if (!this.settings?.organizationUrl || !this.settings?.pat) {
                            new Notice('Azure DevOps connection details are not set in plugin settings.');
                            return;
                        }
                        this.adoApi.setBaseUrl(this.settings.organizationUrl);
                        this.adoApi.setPersonalAccessToken(this.settings.pat);
                        
                        const results = await this.queriesManager.executeQuery(queryIdOrPath);
                        // new QueryResultsModal(this.app, results, queryIdOrPath).open(); // Old list-based modal
                        new QueryResultsViewModal(this.app, this, results, queryIdOrPath).open(); // New table-based modal
                    } catch (error: any) {
                        console.error(`Error executing query '${queryIdOrPath}':`, error);
                        new Notice(`Failed to execute query: ${error.message || error}`);
                    } finally {
                        loadingNotice.hide(); // Hide the loading notice
                    }
                }).open();
            }
        });

        // Register the Insert ADO Query Anchor command
        this.addCommand({
            id: 'insert-ado-query-anchor',
            name: 'Insert ADO Query Anchor',
            editorCallback: (editor: Editor, _view: MarkdownView) => { // view is often not needed for simple editor commands
                const selection = editor.getSelection().trim();
                if (selection) {
                    // If something is selected, wrap it as a Query Anchor
                    editor.replaceSelection(`<<Q#${selection}>>`);
                } else {
                    // If nothing is selected, open a modal to ask for the Query ID/Path
                    new QueryIDModal(this.app, (queryId: string) => {
                        if (queryId) { // Ensure something was actually entered
                            editor.replaceSelection(`<<Q#${queryId}>>`);
                        }
                    }).open();
                }
            }
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        // Cleanup logic if needed
    }
}


/**
 * Asynchronously loads and renders the content for an Epic into a specified content area.
 * @param epicId The ID of the Epic to load.
 * @param contentArea The HTMLElement where the Epic's content should be rendered.
 * @param header The HTMLElement of the Epic's header, used for updating title/state placeholders.
 * @param plugin The ADOPlugin instance, used for accessing settings, API, and managers.
 */
async function loadEpicContent(epicId: string, contentArea: HTMLElement, header: HTMLElement, plugin: ADOPlugin) {
    contentArea.innerHTML = '<em>Loading Epic details...</em>';
    contentArea.dataset.loaded = 'false'; // Explicitly set to false before loading attempt
    const toggleIndicator = header.querySelector('.ado-epic-toggle-indicator') as HTMLElement;

    try {
        if (!plugin.settings?.organizationUrl || !plugin.settings?.pat) {
            new Notice('Azure DevOps connection details are not set.');
            contentArea.innerHTML = '<p style="color:var(--text-error);">Error: ADO settings missing.</p>';
            if (toggleIndicator && contentArea.style.display !== 'none') toggleIndicator.textContent = '[-] Collapse (Error)';
            else if (toggleIndicator) toggleIndicator.textContent = '[+] Expand (Error)';
            return;
        }
        plugin.adoApi.setBaseUrl(plugin.settings.organizationUrl);
        plugin.adoApi.setPersonalAccessToken(plugin.settings.pat);

        const epicDetails = await plugin.epicsManager.fetchEpicById(epicId);
        
        const titlePlaceholder = header.querySelector('.ado-epic-title-placeholder') as HTMLElement;
        const statePlaceholder = header.querySelector('.ado-epic-state-placeholder') as HTMLElement;
        if (titlePlaceholder) titlePlaceholder.textContent = `: ${epicDetails.fields['System.Title'] || 'N/A'}`;
        if (statePlaceholder) statePlaceholder.textContent = `[${epicDetails.fields['System.State'] || 'N/A'}]`;
        
        const { html, onRender } = buildEpicInnerHtml(epicDetails, [], plugin, false);
        contentArea.innerHTML = html;
        if (onRender) {
            onRender(contentArea);
        }
        contentArea.dataset.loaded = 'true';
        // If it was showing error and now loaded, ensure indicator is correct for current state
        if (toggleIndicator && contentArea.style.display !== 'none') toggleIndicator.textContent = '[-] Collapse';
        else if (toggleIndicator) toggleIndicator.textContent = '[+] Expand';


    } catch (error) {
        console.error(`Error fetching Epic #${epicId} for inline view:`, error);
        contentArea.innerHTML = `<p style="color:var(--text-error);">Failed to load Epic #${epicId}. See console.</p>`;
        new Notice(`Failed to load Epic #${epicId}.`);
        if (toggleIndicator && contentArea.style.display !== 'none') toggleIndicator.textContent = '[-] Collapse (Error)';
        else if (toggleIndicator) toggleIndicator.textContent = '[+] Expand (Error)';
    }
}


/**
 * Modal to prompt the user for an Epic number.
 */
class EpicNumberModal extends Modal {
    onSubmit: (epicNumber: string) => void;

    constructor(app: App, onSubmit: (epicNumber: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Enter Epic Number' });

        const input = contentEl.createEl('input', { type: 'text' });
        input.focus();

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.submit(input.value);
            }
        });

        const submitBtn = contentEl.createEl('button', { text: 'Insert' });
        submitBtn.onclick = () => this.submit(input.value);
    }

    submit(value: string) {
        // For EpicNumberModal, we keep the number validation
        if (!/^[0-9]+$/.test(value.trim())) {
            new Notice('Please enter a valid number.');
            return;
        }
        this.close();
        this.onSubmit(value.trim());
    }
}


// --- Modal for ADO Query ID Input (for inserting anchors) ---
class QueryIDModal extends Modal {
    onSubmit: (queryId: string) => void;

    constructor(app: App, onSubmit: (queryId: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Enter ADO Query ID or Path' });

        const input = contentEl.createEl('input', { 
            type: 'text', 
            placeholder: 'e.g., My Queries/Path or GUID' 
        });
        input.style.width = '100%';
        input.style.marginBottom = '10px';
        input.focus();

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.submit(input.value);
            }
        });

        const submitBtn = contentEl.createEl('button', { text: 'Insert Anchor' });
        submitBtn.onclick = () => this.submit(input.value);
    }

    submit(value: string) {
        const trimmedValue = value.trim();
        if (!trimmedValue) {
            new Notice('Please enter a Query ID or Path.');
            return;
        }
        this.close();
        this.onSubmit(trimmedValue);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}


// --- Modal for Query Input (for executing queries) ---
// Note: This is QueryInputModal, distinct from QueryIDModal
class QueryInputModal extends Modal {
    onSubmit: (queryIdOrPath: string) => void;

    constructor(app: App, onSubmit: (queryIdOrPath: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Enter Query ID or Path to Execute' });

        const input = contentEl.createEl('input', { 
            type: 'text', 
            placeholder: 'e.g., My Queries/My Query Name or a GUID' 
        });
        input.style.width = '100%';
        input.style.marginBottom = '10px';
        input.focus();

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.submit(input.value);
            }
        });

        const submitBtn = contentEl.createEl('button', { text: 'Execute Query' });
        submitBtn.onclick = () => this.submit(input.value);
    }

    submit(value: string) {
        const trimmedValue = value.trim();
        if (!trimmedValue) {
            new Notice('Please enter a Query ID or Path.');
            return;
        }
        this.close();
        this.onSubmit(trimmedValue);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// --- Modal for Displaying Query Results in a Table ---
class QueryResultsViewModal extends Modal {
    constructor(app: App, private plugin: ADOPlugin, private results: WorkItemQueryResult[], private queryIdOrPath: string) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.classList.add('ado-query-results-view-modal'); // Add a distinct class
        // Increase modal width for better table display
        this.modalEl.style.width = '80%'; 
        this.modalEl.style.maxWidth = '1000px';


        contentEl.createEl('h2', { text: `Query Results: ${this.queryIdOrPath}` });

        if (!this.results || this.results.length === 0) {
            contentEl.createEl('p', { text: 'No work items found for this query.' });
            return;
        }

        const tableWrapper = contentEl.createDiv({ cls: 'ado-table-wrapper' });
        tableWrapper.style.overflowX = 'auto';
        tableWrapper.style.maxHeight = '60vh'; // Make table body scrollable if too long
        tableWrapper.style.marginTop = '10px';


        const table = tableWrapper.createEl('table', { cls: 'ado-query-results-table' });
        table.style.width = '100%'; // Ensure table uses wrapper width
        table.style.borderCollapse = 'collapse';


        const thead = table.createTHead();
        const headerRow = thead.createTr();
        const headers = ['ID', 'Type', 'Title', 'State', 'Assigned To', 'Actions'];
        headers.forEach(headerText => {
            const th = headerRow.createEl('th');
            th.setText(headerText);
            th.style.border = '1px solid var(--background-modifier-border)';
            th.style.padding = '8px';
            th.style.textAlign = 'left';
            th.style.backgroundColor = 'var(--background-secondary)';
        });

        const tbody = table.createTBody();
        this.results.forEach(item => {
            const row = tbody.createTr();
            
            [
                item.id.toString(),
                item.fields['System.WorkItemType'] || item.type || 'N/A',
                item.fields['System.Title'] || item.title || 'N/A',
                item.fields['System.State'] || item.state || 'N/A',
                item.fields['System.AssignedTo']?.displayName || 'N/A'
            ].forEach(cellText => {
                const td = row.createTd();
                td.setText(cellText);
                td.style.border = '1px solid var(--background-modifier-border)';
                td.style.padding = '8px';
                td.style.verticalAlign = 'top'; // Align content to the top
            });

            const actionsCell = row.createTd();
            actionsCell.style.border = '1px solid var(--background-modifier-border)';
            actionsCell.style.padding = '8px';
            actionsCell.style.verticalAlign = 'top';

            actionsCell.createEl('a', {
                text: 'Open in ADO',
                href: item.adoUrl,
                target: '_blank',
                rel: 'noopener noreferrer',
                cls: 'ado-action-link' // For potential styling
            });

            if ((item.fields['System.WorkItemType'] || item.type) === 'Epic') {
                actionsCell.createEl('br'); // Simple separator
                const viewEpicBtn = actionsCell.createEl('button', { text: 'View Epic', cls: 'ado-action-button' });
                // Basic button styling
                viewEpicBtn.style.marginTop = '5px';
                viewEpicBtn.style.padding = '3px 6px';
                viewEpicBtn.style.fontSize = '0.9em';


                viewEpicBtn.onclick = async () => {
                    const loadingNotice = new Notice('Loading Epic details...', 0);
                    try {
                        // Ensure API is configured before making calls
                        if (!this.plugin.settings?.organizationUrl || !this.plugin.settings?.pat) {
                            new Notice('Azure DevOps connection details are not set in plugin settings.');
                            return;
                        }
                        this.plugin.adoApi.setBaseUrl(this.plugin.settings.organizationUrl);
                        this.plugin.adoApi.setPersonalAccessToken(this.plugin.settings.pat);

                        const epicDetails = await this.plugin.epicsManager.fetchEpicById(item.id.toString());
                        const features = await this.plugin.featuresManager.fetchFeaturesByParentId(item.id);
                        new EpicDetailModal(this.app, epicDetails, features, this.plugin).open();
                    } catch (err: any) {
                        new Notice('Failed to load Epic: ' + (err.message || err));
                        console.error('Failed to load Epic details in QueryResultsViewModal:', err);
                    } finally {
                        loadingNotice.hide();
                    }
                };
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}


/**
 * Inserts an Epic Anchor at the cursor or wraps the selected number.
 * @param app The Obsidian app instance.
 * @param editor The active editor instance.
 */
function insertEpicAnchor(app: App, editor: Editor) {
    const selection = editor.getSelection();

    // If a number is selected, wrap it
    if (/^[0-9]+$/.test(selection)) {
        editor.replaceSelection(`<<#${selection}>>`);
        return;
    }

    // Otherwise, prompt for the number
    new EpicNumberModal(app, (epicNumber: string) => {
        editor.replaceSelection(`<<#${epicNumber}>>`);
    }).open();
}

// --- In-Note Epic View Logic ---

/**
 * Builds the HTML content for an Epic's details, designed to be embedded or used in a modal.
 * @param epic The Epic data.
 * @param features An array of child Features.
 * @param plugin The ADOPlugin instance.
 * @param forModal Optional flag, true if rendering for a modal (might affect some styling or links).
 * @returns An object containing the HTML string and an onRender callback for attaching event listeners.
 */
function buildEpicInnerHtml(
    epic: Epic,
    features: Feature[],
    plugin: ADOPlugin,
    forModal: boolean = false
): { html: string, onRender?: (contentEl: HTMLElement) => void } {
    const fields = epic.fields;
    const epicTitle = fields['System.Title'] || 'N/A';
    const epicState = fields['System.State'] || 'N/A';
    const descriptionContent = fields['System.Description'] || 'No description available.';

    // --- Contacts Tab Content ---
    let contactsHtml = '<table>';
    const contactFields = [
        { label: 'Assigned To', fieldName: 'System.AssignedTo' },
        { label: 'Created By', fieldName: 'System.CreatedBy' },
        { label: 'Changed By', fieldName: 'System.ChangedBy' },
        { label: 'Epic Owner', fieldName: 'Custom.EnterpriseOneEpicOwner' },
        { label: 'Solution Architect', fieldName: 'Custom.SolutionArchitect' },
        { label: 'CTX Commerce PM', fieldName: 'Custom.CTXCommerceDomainPM' },
        { label: 'CTX Web Acq. PM', fieldName: 'Custom.CTXWebAcquisitionsPM' }
    ];
    contactFields.forEach(cf => {
        const identity = fields[cf.fieldName] as import('./types/index.js').AdoIdentity | undefined;
        if (identity && identity.displayName) {
            contactsHtml += `<tr><td style="padding-right: 10px;"><strong>${cf.label}:</strong></td><td>${identity.displayName}`;
            if (identity.uniqueName) {
                const teamsLink = `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(identity.uniqueName)}`;
                contactsHtml += ` <span style="color: var(--text-muted); font-size: 0.9em;">(<a href="${teamsLink}" target="_blank" rel="noopener noreferrer" title="Chat on Teams with ${identity.displayName} (${identity.uniqueName})">${identity.uniqueName}</a>)</span>`;
            }
            contactsHtml += `</td></tr>`;
        } else {
            contactsHtml += `<tr><td style="padding-right: 10px;"><strong>${cf.label}:</strong></td><td>N/A</td></tr>`;
        }
    });
    contactsHtml += '</table>';
    const contactsContent = contactsHtml;

    // --- Readiness Tab Content ---
    const readinessContent = fields['Custom.ReadinessFieldName'] || 'Readiness information not available. Configure field name.';
    
    // --- Features Tab Content (placeholder, will be filled by onRender) ---
    const featuresInitialContent = 'Loading features...'; // This will be replaced by the actual feature list logic

    // --- Main HTML Structure ---
    let html = `<div class="ado-epic-details-content">`; // Main content wrapper

    // Header (Epic Title and State) - No longer part of the tab system, but as a general header for the content
    // If not for modal, the main title is handled by the clickable header in the document.
    // For modal, we might want a title.
    if (forModal) {
        html += `<h4 style="margin-top:0; margin-bottom:10px;">Epic #${epic.id}: ${epicTitle} [${epicState}]</h4>`;
    }
    
    // Tab container
    html += `<div class="ado-epic-tabs" style="display: flex; margin-bottom: 10px; border-bottom: 1px solid var(--background-modifier-border);">`;
    const tabsData = [
        { id: 'description', name: 'Description' },
        { id: 'contacts', name: 'Contacts' },
        { id: 'features', name: 'Features' },
        { id: 'readiness', name: 'Readiness' }
    ];
    tabsData.forEach((tabInfo, index) => {
        html += `<button class="ado-epic-tab-button" data-tab-id="tab-pane-${epic.id}-${tabInfo.id}" style="padding: 8px 12px; border: none; background: transparent; cursor: pointer; border-bottom: 2px solid transparent; margin-right: 5px; ${index === 0 ? 'border-bottom-color: var(--interactive-accent); font-weight: bold;' : ''}">${tabInfo.name}</button>`;
    });
    html += `</div>`;

    // Tab content container
    html += `<div class="ado-epic-tab-panes" style="min-height: 100px;">`;
    // Description Pane
    html += `<div id="tab-pane-${epic.id}-description" class="ado-epic-tab-pane" style="padding: 5px;">${descriptionContent}</div>`;
    // Contacts Pane
    html += `<div id="tab-pane-${epic.id}-contacts" class="ado-epic-tab-pane" style="padding: 5px; display: none;">${contactsContent}</div>`;
    // Features Pane (initially empty or with loader, content built by onRender)
    html += `<div id="tab-pane-${epic.id}-features" class="ado-epic-tab-pane" style="padding: 5px; display: none;">${featuresInitialContent}</div>`;
    // Readiness Pane
    html += `<div id="tab-pane-${epic.id}-readiness" class="ado-epic-tab-pane" style="padding: 5px; display: none;">${readinessContent}</div>`;
    html += `</div>`; // end ado-epic-tab-panes

    // General Info (Created Date, Updated Date)
    html += `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--background-modifier-border); font-size: 0.9em;">`;
    html += `<strong>State:</strong> ${epicState}<br>`; // Duplicates state if modal title is also shown, consider placement
    html += `<strong>Created:</strong> ${fields['System.CreatedDate'] ? new Date(fields['System.CreatedDate']).toLocaleDateString() : 'N/A'}<br>`;
    html += `<strong>Updated:</strong> ${fields['System.ChangedDate'] ? new Date(fields['System.ChangedDate']).toLocaleDateString() : 'N/A'}`;
    html += `</div>`;

    // "Open in ADO" Button
    const orgUrl = plugin.settings?.organizationUrl;
    const projectName = plugin.settings?.projectName;
    if (orgUrl && projectName) {
        const normalizedOrgUrl = orgUrl.replace(/\/+$/, '');
        const epicAdoUrl = `${normalizedOrgUrl}/${encodeURIComponent(projectName)}/_workitems/edit/${epic.id}`;
        html += `<div style="margin-top:15px;"><a href="${epicAdoUrl}" class="external-link" target="_blank" rel="noopener noreferrer"><button style="padding:5px 10px;">Open Epic #${epic.id} in ADO</button></a></div>`;
    }
    html += `</div>`; // end ado-epic-details-content

    // onRender function to attach event listeners
    const onRender = (contentEl: HTMLElement) => {
        // Tab switching logic
        const tabButtons = contentEl.querySelectorAll('.ado-epic-tab-button');
        const tabPanes = contentEl.querySelectorAll('.ado-epic-tab-pane');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => {
                    (btn as HTMLElement).style.borderBottomColor = 'transparent';
                    (btn as HTMLElement).style.fontWeight = 'normal';
                });
                tabPanes.forEach(pane => {
                    (pane as HTMLElement).style.display = 'none';
                });

                (button as HTMLElement).style.borderBottomColor = 'var(--interactive-accent)';
                (button as HTMLElement).style.fontWeight = 'bold';
                const targetPaneId = button.getAttribute('data-tab-id');
                if (targetPaneId) {
                    const activePane = contentEl.querySelector(`#${targetPaneId}`) as HTMLElement;
                    if (activePane) activePane.style.display = 'block';
                }
            });
        });
        
        // Features tab dynamic content loading and rendering
        const featuresPane = contentEl.querySelector(`#tab-pane-${epic.id}-features`) as HTMLElement;
        if (featuresPane) {
            // Check if features were passed directly (e.g. if pre-fetched)
            // For now, always re-fetch or assume features are passed if available
            // This part is simplified; in a real scenario, you might pass pre-fetched features
            // or rely on the `features` argument passed to `buildEpicInnerHtml`.

            if (features && features.length > 0) {
                renderFeatures(featuresPane, features, epic, plugin);
            } else if (features) { // Empty array means no features
                 featuresPane.innerHTML = 'No features found for this epic.';
            } else { // features is undefined, means we need to fetch
                plugin.featuresManager.fetchFeaturesByParentId(epic.id)
                    .then(fetchedFeatures => {
                        renderFeatures(featuresPane, fetchedFeatures, epic, plugin);
                    })
                    .catch(error => {
                        console.error('Error fetching features for inline view:', error);
                        featuresPane.innerHTML = 'Error loading features. See console for details.';
                    });
            }
        }
    };
    
    // Helper function to render features (used by onRender)
    function renderFeatures(pane: HTMLElement, featuresToRender: Feature[], parentEpic: Epic, pluginInstance: ADOPlugin) {
        if (!featuresToRender || featuresToRender.length === 0) {
            pane.innerHTML = 'No features found for this epic.';
            return;
        }
        let featuresHtml = '<ul style="list-style: none; padding-left: 0;">';
        const orgUrl = pluginInstance.settings?.organizationUrl;
        const projectName = pluginInstance.settings?.projectName;

        featuresToRender.forEach((feature) => { // Removed index, not used
            const featureTitle = feature.fields['System.Title'] || 'Untitled Feature';
            const featureState = feature.fields['System.State'] || 'Unknown State';
            const featureId = feature.id;

            let featureHeaderHtml = `<div class="feature-header" data-feature-id="${featureId}" style="cursor: pointer; padding: 5px; border-bottom: 1px solid var(--background-modifier-border-hover);">`;
            featureHeaderHtml += `<strong>#${featureId}</strong>: ${featureTitle} [${featureState}]`;
            
            // The "Open in ADO" link can be part of the modal, or kept here for quick access.
            // For now, let's keep it here for consistency with how it was, but it will also be in the modal.
            if (orgUrl && projectName) {
                const normalizedOrgUrl = orgUrl.replace(/\/+$/, '');
                const featureUrl = `${normalizedOrgUrl}/${encodeURIComponent(projectName)}/_workitems/edit/${featureId}`;
                featureHeaderHtml += ` <a href="${featureUrl}" target="_blank" rel="noopener noreferrer" title="Open Feature #${featureId} in ADO" style="text-decoration: none; color: var(--interactive-accent); font-size: 0.85em; margin-left: 5px;">(Open in ADO)</a>`;
            }
            featureHeaderHtml += `</div>`;
            
            // Removed featureContentHtml as details will be in a modal
            featuresHtml += `<li style="margin-bottom: 2px;">${featureHeaderHtml}</li>`;
        });
        featuresHtml += '</ul>';
        pane.innerHTML = featuresHtml;

        // Add click listeners for opening feature detail modal
        pane.querySelectorAll('.feature-header').forEach(headerElement => {
            headerElement.addEventListener('click', (event) => {
                // Prevent modal from opening if the "Open in ADO" link itself is clicked
                if ((event.target as HTMLElement).closest('a')) {
                    return;
                }
                event.preventDefault(); // Prevent any default action

                const clickedFeatureIdStr = headerElement.getAttribute('data-feature-id');
                if (!clickedFeatureIdStr) return;
                const clickedFeatureId = parseInt(clickedFeatureIdStr, 10);

                const featureToShow = featuresToRender.find(f => f.id === clickedFeatureId);
                if (featureToShow) {
                    new FeatureDetailModal(pluginInstance.app, featureToShow, pluginInstance).open();
                } else {
                    new Notice(`Could not find details for Feature #${clickedFeatureId}.`);
                    console.error(`Feature with ID ${clickedFeatureId} not found in featuresToRender list.`);
                }
            });
        });
    }

    return { html, onRender };
}


// --- Epic Modal Class (for editor interaction) ---
class EpicDetailModal extends Modal {
    constructor(app: App, private epic: Epic, private features: Feature[], private plugin: ADOPlugin) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty(); // Clear previous content
        contentEl.classList.add('ado-epic-modal-content');
        
        const { html, onRender } = buildEpicInnerHtml(this.epic, this.features, this.plugin, true);
        contentEl.innerHTML = html;
        if (onRender) {
            onRender(contentEl);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}


// --- Feature Modal Class ---
class FeatureDetailModal extends Modal {
    constructor(app: App, private feature: Feature, private plugin: ADOPlugin) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.classList.add('ado-feature-modal-content');
        
        const { html } = buildFeatureInnerHtml(this.feature, this.plugin); // Call a new helper for feature HTML
        contentEl.innerHTML = html;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// --- Helper to build HTML for Feature Details (for Modal) ---
function buildFeatureInnerHtml(
    feature: Feature,
    plugin: ADOPlugin
): { html: string } {
    const fields = feature.fields;
    const featureTitle = fields['System.Title'] || 'N/A';
    const featureState = fields['System.State'] || 'N/A';
    const descriptionContent = fields['System.Description'] || 'No description available.';
    const parentEpicId = fields['System.Parent'] ? `${fields['System.Parent']}` : 'N/A'; // Parent is just an ID

    let html = `<div class="ado-feature-details-content" style="padding: 10px;">`;

    // Header
    html += `<h4 style="margin-top:0; margin-bottom:15px;">Feature #${feature.id}: ${featureTitle} [${featureState}]</h4>`;

    // Description
    html += `<div style="margin-bottom: 15px;">`;
    html += `<strong style="display: block; margin-bottom: 5px;">Description:</strong>`;
    html += `<div>${descriptionContent}</div>`; // Assuming description is HTML or pre-formatted text
    html += `</div>`;

    // Details Table
    html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">`;

    const identityFields = [
        { label: 'Assigned To', fieldName: 'System.AssignedTo' },
        { label: 'Created By', fieldName: 'System.CreatedBy' },
        { label: 'Changed By', fieldName: 'System.ChangedBy' },
    ];

    identityFields.forEach(idf => {
        const identity = fields[idf.fieldName] as import('./types/index.js').AdoIdentity | undefined;
        html += `<tr><td style="padding: 5px 0; border-bottom: 1px solid var(--background-modifier-border); font-weight: bold; width: 120px;">${idf.label}:</td>`;
        if (identity && identity.displayName) {
            html += `<td style="padding: 5px 0; border-bottom: 1px solid var(--background-modifier-border);">${identity.displayName}`;
            if (identity.uniqueName) {
                const teamsLink = `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(identity.uniqueName)}`;
                html += ` <span style="color: var(--text-muted); font-size: 0.9em;">(<a href="${teamsLink}" target="_blank" rel="noopener noreferrer" title="Chat on Teams with ${identity.displayName} (${identity.uniqueName})">${identity.uniqueName}</a>)</span>`;
            }
            html += `</td>`;
        } else {
            html += `<td style="padding: 5px 0; border-bottom: 1px solid var(--background-modifier-border);">N/A</td>`;
        }
        html += `</tr>`;
    });
    
    html += `<tr><td style="padding: 5px 0; border-bottom: 1px solid var(--background-modifier-border); font-weight: bold;">Parent Epic ID:</td><td style="padding: 5px 0; border-bottom: 1px solid var(--background-modifier-border);">${parentEpicId}</td></tr>`;
    html += `<tr><td style="padding: 5px 0; border-bottom: 1px solid var(--background-modifier-border); font-weight: bold;">Created Date:</td><td style="padding: 5px 0; border-bottom: 1px solid var(--background-modifier-border);">${fields['System.CreatedDate'] ? new Date(fields['System.CreatedDate']).toLocaleDateString() : 'N/A'}</td></tr>`;
    html += `<tr><td style="padding: 5px 0; font-weight: bold;">Changed Date:</td><td style="padding: 5px 0;">${fields['System.ChangedDate'] ? new Date(fields['System.ChangedDate']).toLocaleDateString() : 'N/A'}</td></tr>`;
    
    html += `</table>`;


    // "Open in ADO" Button
    const orgUrl = plugin.settings?.organizationUrl;
    const projectName = plugin.settings?.projectName;
    if (orgUrl && projectName) {
        const normalizedOrgUrl = orgUrl.replace(/\/+$/, '');
        const featureAdoUrl = `${normalizedOrgUrl}/${encodeURIComponent(projectName)}/_workitems/edit/${feature.id}`;
        html += `<div style="margin-top:20px;"><a href="${featureAdoUrl}" class="external-link" target="_blank" rel="noopener noreferrer"><button style="padding:8px 15px;">Open Feature #${feature.id} in ADO</button></a></div>`;
    }
    
    html += `</div>`; // end ado-feature-details-content

    return { html };
}


// CodeMirror 6 ViewPlugin for rendering ADO Anchors (Epics and Queries) as buttons in Edit Mode.
class AdoAnchorButtonWidget extends WidgetType {
    constructor(
        readonly anchorType: 'epic' | 'query', 
        readonly id: string, 
        readonly plugin: ADOPlugin, 
        readonly view: EditorView
    ) {
        super();
    }

    toDOM(): HTMLElement {
        const button = document.createElement('button');
        button.classList.add('ado-anchor-button-editor'); // Generic class
        button.textContent = this.anchorType === 'epic' ? `Epic #${this.id}` : `Query: ${this.id}`;
        button.style.cursor = 'pointer';

        button.onclick = async (event) => {
            event.preventDefault();
            
            if (this.anchorType === 'epic') {
                console.log(`Editor ADO Anchor Button - Clicked Epic #${this.id}`);
                const originalButtonText = button.textContent;
                button.textContent = 'Loading Epic...';
                button.disabled = true;

                try {
                    if (!this.plugin.settings?.organizationUrl || !this.plugin.settings?.pat) {
                        new Notice('Azure DevOps connection details are not set in plugin settings.');
                        return;
                    }
                    this.plugin.adoApi.setBaseUrl(this.plugin.settings.organizationUrl);
                    this.plugin.adoApi.setPersonalAccessToken(this.plugin.settings.pat);

                    const epicDetails = await this.plugin.epicsManager.fetchEpicById(this.id);
                    const features = await this.plugin.featuresManager.fetchFeaturesByParentId(epicDetails.id);
                    
                    new EpicDetailModal(this.plugin.app, epicDetails, features, this.plugin).open();

                } catch (error) {
                    console.error(`Editor ADO Anchor Button - Error fetching epic #${this.id}:`, error);
                    new Notice(`Failed to fetch Epic #${this.id}. See console for details.`);
                } finally {
                    button.textContent = originalButtonText;
                    button.disabled = false;
                }
            } else if (this.anchorType === 'query') {
                const queryId = this.id;
                const plugin = this.plugin;
                const notice = new Notice(`Loading results for Query: ${queryId}...`, 0);
                try {
                    // Ensure API is configured before making calls
                    if (!plugin.settings?.organizationUrl || !plugin.settings?.pat) {
                        new Notice('Azure DevOps connection details are not set in plugin settings.');
                        return;
                    }
                    plugin.adoApi.setBaseUrl(plugin.settings.organizationUrl);
                    plugin.adoApi.setPersonalAccessToken(plugin.settings.pat);

                    // Pass a second argument (e.g., true or a fields array) to signal fetching comprehensive fields.
                    const results = await plugin.queriesManager.executeQuery(queryId, true); 
                    new QueryResultsViewModal(plugin.app, plugin, results, queryId).open();
                } catch (error) {
                    console.error(`Error executing or displaying query ${queryId} from editor button:`, error);
                    new Notice(`Failed to load results for Query: ${queryId}. See console for details.`);
                } finally {
                    notice.hide();
                }
            }
        };
        return button;
    }

    eq(other: AdoAnchorButtonWidget): boolean {
        return other.anchorType === this.anchorType && 
               other.id === this.id && 
               other.plugin === this.plugin && 
               other.view === this.view;
    }

    ignoreEvent(event: Event): boolean {
        return !(event instanceof MouseEvent && event.type === "click");
    }
}

function adoAnchorDecorations(view: EditorView, plugin: ADOPlugin) {
    const builder = new RangeSetBuilder<Decoration>();
    // Regex to match <<#ID>> (Epic) or <<Q#QueryString>> (Query)
    // Group 1: Optional 'Q'
    // Group 2: '#'
    // Group 3: The ID (digits for Epic, anything not '>>' for Query)
    // Simplified: Group 1: 'Q#' or '#', Group 2: ID
    const anchorRegex = /<<([Q]?#)([^>]+?)>>/g; 

    for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);
        let match;
        while ((match = anchorRegex.exec(text)) !== null) {
            const anchorStart = from + match.index;
            const anchorEnd = anchorStart + match[0].length;
            
            const prefix = match[1]; // 'Q#' or '#'
            const id = match[2];     // The actual ID string

            const anchorType = prefix === 'Q#' ? 'query' : 'epic';
            
            // console.log(`Editor ADO Anchor - Rendering: ${match[0]} (Type: ${anchorType}, ID: ${id}) at ${anchorStart}-${anchorEnd}`);
            builder.add(
                anchorStart,
                anchorEnd,
                Decoration.replace({
                    widget: new AdoAnchorButtonWidget(anchorType, id, plugin, view),
                    side: -1 
                })
            );
        }
    }
    return builder.finish();
}

const adoAnchorViewPlugin = (plugin: ADOPlugin) => ViewPlugin.fromClass( // Renamed
    class {
        decorations: DecorationSet;

        constructor(currentView: EditorView) {
            this.decorations = adoAnchorDecorations(currentView, plugin); // Use new function
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged || update.selectionSet) {
                this.decorations = adoAnchorDecorations(update.view, plugin); // Use new function
            }
        }
    }, {
    decorations: v => v.decorations
});

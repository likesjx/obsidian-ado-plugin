import { Plugin, App, Editor, Notice, MarkdownView, Modal, MarkdownPostProcessorContext, TFile } from 'obsidian';
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import ADOApi from './ado/api.js';
import { EpicsManager } from './ado/epics.js';
import { FeaturesManager } from './ado/features.js';
import SettingsTab from './ui/settingsTab.js';
import { Epic, Feature } from './types/index.js'; // Added Feature

export default class ADOPlugin extends Plugin {
    public adoApi!: ADOApi; // Changed from private to public
    public epicsManager!: EpicsManager; // Changed from private to public
    public featuresManager!: FeaturesManager; // Changed from private to public
    public settings: any;

    async onload() {
        await this.loadSettings();

        this.adoApi = new ADOApi();
        // Pass settings to the managers
        this.epicsManager = new EpicsManager(this.adoApi, this.settings);
        this.featuresManager = new FeaturesManager(this.adoApi, this.settings); // Proactively updated

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

        console.log('Registering Epic Anchor Post Processor');
        this.registerMarkdownPostProcessor((element: HTMLElement, context: MarkdownPostProcessorContext) => {
            // Find code elements that look like our anchors
            const codeElements = element.querySelectorAll('code');
            codeElements.forEach(codeEl => {
                const anchorText = codeEl.textContent;
                if (anchorText && anchorText.startsWith('<<#') && anchorText.endsWith('>>')) {
                    const match = anchorText.match(/<<#(\d+)>>/);
                    if (match && match[1]) {
                        const epicId = match[1];

                        // Check if this anchor's container has already been processed to avoid re-processing
                        // The actual replacement target (paragraph or the code element itself if inline)
                        let potentialContainer = codeEl.parentElement;
                        if (potentialContainer && potentialContainer.classList.contains('ado-epic-view-container')) {
                            return; // Already processed and replaced
                        }
                        // If the codeEl itself was replaced, it wouldn't be found again.
                        // This check is more for cases where the parent paragraph might be re-evaluated.

                        // More robust check: if the codeEl itself has a marker or its direct parent is the container
                        if (codeEl.dataset.adoProcessed === 'true') return;


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

                        // Determine what to replace.
                        // If the <code> is the only child of a <p>, replace the <p>.
                        // Otherwise, replace the <code> itself.
                        let replacementTarget: Element = codeEl;
                        if (codeEl.parentElement && codeEl.parentElement.tagName === 'P' && codeEl.parentElement.childNodes.length === 1) {
                            replacementTarget = codeEl.parentElement;
                        } else {
                             // Mark the original code element so we don't reprocess if it's somehow still in DOM during another pass
                            codeEl.dataset.adoProcessed = 'true';
                        }
                        
                        replacementTarget.replaceWith(container);

                        header.onclick = async () => {
                            const isHidden = contentArea.style.display === 'none';
                            const toggleIndicator = header.querySelector('.ado-epic-toggle-indicator') as HTMLElement;

                            if (isHidden) { // Expanding
                                contentArea.style.display = 'block';
                                if (toggleIndicator) toggleIndicator.textContent = '[-] Collapse';

                                if (contentArea.dataset.loaded === 'false') {
                                    contentArea.innerHTML = '<em>Loading Epic details...</em>';
                                    try {
                                        if (!this.settings?.organizationUrl || !this.settings?.pat) {
                                            new Notice('Azure DevOps connection details are not set.');
                                            contentArea.innerHTML = '<p style="color:var(--text-error);">Error: ADO settings missing.</p>';
                                            if (toggleIndicator) toggleIndicator.textContent = '[+] Expand (Error)';
                                            return;
                                        }
                                        this.adoApi.setBaseUrl(this.settings.organizationUrl);
                                        this.adoApi.setPersonalAccessToken(this.settings.pat);

                                        const epicDetails = await this.epicsManager.fetchEpicById(epicId);
                                        
                                        const titlePlaceholder = header.querySelector('.ado-epic-title-placeholder') as HTMLElement;
                                        const statePlaceholder = header.querySelector('.ado-epic-state-placeholder') as HTMLElement;
                                        if (titlePlaceholder) titlePlaceholder.textContent = `: ${epicDetails.fields['System.Title'] || 'N/A'}`;
                                        if (statePlaceholder) statePlaceholder.textContent = `[${epicDetails.fields['System.State'] || 'N/A'}]`;
                                        
                                        // Features will be fetched by buildEpicInnerHtml's onRender if not passed
                                        const { html, onRender } = buildEpicInnerHtml(epicDetails, [], this, false); // Pass empty features, onRender will fetch
                                        contentArea.innerHTML = html;
                                        if (onRender) {
                                            onRender(contentArea);
                                        }
                                        contentArea.dataset.loaded = 'true';

                                    } catch (error) {
                                        console.error(`Error fetching Epic #${epicId} for inline view:`, error);
                                        contentArea.innerHTML = `<p style="color:var(--text-error);">Failed to load Epic #${epicId}. See console.</p>`;
                                        new Notice(`Failed to load Epic #${epicId}.`);
                                        if (toggleIndicator) toggleIndicator.textContent = '[+] Expand (Error)';
                                    }
                                }
                            } else { // Collapsing
                                contentArea.style.display = 'none';
                                if (toggleIndicator) toggleIndicator.textContent = '[+] Expand';
                            }
                        };
                    }
                }
            });
        });

        console.log('Registering Epic Anchor Editor Extension');
        this.registerEditorExtension(epicAnchorViewPlugin(this));
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
        if (!/^[0-9]+$/.test(value.trim())) {
            new Notice('Please enter a valid number.');
            return;
        }
        this.close();
        this.onSubmit(value.trim());
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

        featuresToRender.forEach((feature, index) => {
            const featureTitle = feature.fields['System.Title'] || 'Untitled Feature';
            const featureState = feature.fields['System.State'] || 'Unknown State';
            const featureDescription = feature.fields['System.Description'] || 'No description available.';
            const featureId = feature.id;

            let featureHeaderHtml = `<div class="feature-header" data-feature-id="${featureId}" style="cursor: pointer; padding: 5px; border-bottom: 1px solid var(--background-modifier-border-hover);">`;
            featureHeaderHtml += `<strong>#${featureId}</strong>: ${featureTitle} [${featureState}]`;
            if (orgUrl && projectName) {
                const normalizedOrgUrl = orgUrl.replace(/\/+$/, '');
                const featureUrl = `${normalizedOrgUrl}/${encodeURIComponent(projectName)}/_workitems/edit/${featureId}`;
                featureHeaderHtml += ` <a href="${featureUrl}" target="_blank" rel="noopener noreferrer" title="Open Feature #${featureId} in ADO" style="text-decoration: none; color: var(--interactive-accent); font-size: 0.85em;">(Open in ADO)</a>`;
            }
            featureHeaderHtml += `</div>`;

            const contentId = `feature-content-${parentEpic.id}-${featureId}`;
            let featureContentHtml = `<div id="${contentId}" class="feature-content" style="display: none; padding: 10px; margin-left: 15px; border-left: 2px solid var(--background-modifier-border); background-color: var(--background-primary-alt);">`;
            featureContentHtml += `<div>${featureDescription}</div></div>`;
            
            featuresHtml += `<li style="margin-bottom: 2px;">${featureHeaderHtml}${featureContentHtml}</li>`;
        });
        featuresHtml += '</ul>';
        pane.innerHTML = featuresHtml;

        // Add click listeners for feature expansion
        pane.querySelectorAll('.feature-header').forEach(headerElement => {
            headerElement.addEventListener('click', (event) => {
                if ((event.target as HTMLElement).tagName === 'A') return;
                const clickedFeatureId = headerElement.getAttribute('data-feature-id');
                const contentElement = pane.querySelector(`#feature-content-${parentEpic.id}-${clickedFeatureId}`) as HTMLElement | null;
                if (contentElement) {
                    contentElement.style.display = contentElement.style.display === 'none' ? 'block' : 'none';
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


// CodeMirror 6 ViewPlugin for rendering Epic Anchors as buttons in Edit Mode
// Now, this button will open a Modal instead of a popover.

class EpicAnchorButtonWidget extends WidgetType {
    constructor(readonly epicId: string, readonly plugin: ADOPlugin, readonly view: EditorView) { // Added view
        super();
    }

    toDOM(): HTMLElement { // Removed view parameter here, use this.view
        const button = document.createElement('button');
        button.classList.add('epic-anchor-button-editor');
        button.textContent = `Epic #${this.epicId}`;
        button.style.cursor = 'pointer';

        button.onclick = async (event) => {
            event.preventDefault();
            console.log(`Editor Epic Anchor Button - Clicked Epic #${this.epicId}`);
            const originalButtonText = button.textContent;
            button.textContent = 'Loading...';
            button.disabled = true;

            try {
                if (!this.plugin.settings?.organizationUrl || !this.plugin.settings?.pat) {
                    new Notice('Azure DevOps connection details are not set in plugin settings.');
                    return;
                }
                this.plugin.adoApi.setBaseUrl(this.plugin.settings.organizationUrl);
                this.plugin.adoApi.setPersonalAccessToken(this.plugin.settings.pat);

                const epicDetails = await this.plugin.epicsManager.fetchEpicById(this.epicId);
                // Fetch features before opening modal
                const features = await this.plugin.featuresManager.fetchFeaturesByParentId(epicDetails.id);
                
                new EpicDetailModal(this.plugin.app, epicDetails, features, this.plugin).open();

            } catch (error) {
                console.error(`Editor Epic Anchor Button - Error fetching epic #${this.epicId}:`, error);
                new Notice(`Failed to fetch Epic #${this.epicId}. See console for details.`);
            } finally {
                button.textContent = originalButtonText;
                button.disabled = false;
            }
        };
        return button;
    }

    eq(other: EpicAnchorButtonWidget): boolean {
        return other.epicId === this.epicId && other.plugin === this.plugin;
    }

    ignoreEvent(event: Event): boolean {
        return !(event instanceof MouseEvent && event.type === "click");
    }
}


function epicAnchorDecorations(view: EditorView, plugin: ADOPlugin) {
    const builder = new RangeSetBuilder<Decoration>();
    const anchorRegex = /<<#(\d+)>>/g;

    for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);
        let match;
        while ((match = anchorRegex.exec(text)) !== null) {
            const anchorStart = from + match.index;
            const anchorEnd = anchorStart + match[0].length;
            const epicId = match[1];

            console.log(`Editor Epic Anchor - Found: ${match[0]} (ID: ${epicId}) at ${anchorStart}-${anchorEnd}`);

            builder.add(
                anchorStart,
                anchorEnd,
                Decoration.replace({
                    widget: new EpicAnchorButtonWidget(epicId, plugin),
                    inclusive: false, // Or true, depending on desired behavior with selections
                    block: false
                })
            );
        }
    }
    return builder.finish();
}

const epicAnchorViewPlugin = (plugin: ADOPlugin) => ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            console.log('Editor Epic Anchor ViewPlugin - Initialized');
            this.decorations = epicAnchorDecorations(view, plugin);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged) {
                console.log('Editor Epic Anchor ViewPlugin - Updating decorations');
                this.decorations = epicAnchorDecorations(update.view, plugin);
            }
        }
    },
    {
        decorations: v => v.decorations,
    }
);

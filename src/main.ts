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
            console.log('Epic Anchor Post Processor - Processing element:', element);
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            let node;
            const nodesToReplace: {node: Node, epicId: string, fullMatch: string}[] = [];

            while (node = walker.nextNode()) {
                if (node.nodeValue) {
                    const regex = /<<#(\d+)>>/g;
                    let match;
                    // Find all matches in the current text node
                    while ((match = regex.exec(node.nodeValue)) !== null) {
                        console.log(`Epic Anchor Post Processor - Found anchor: ${match[0]} with ID: ${match[1]} in node:`, node);
                        nodesToReplace.push({ node, epicId: match[1], fullMatch: match[0] });
                    }
                }
            }

            // Perform replacements after iterating to avoid issues with modifying the DOM during traversal
            for (const item of nodesToReplace) {
                const { node, epicId, fullMatch } = item;
                if (!node.parentElement) continue; // Skip if node is detached

                const button = document.createElement('button');
                button.classList.add('epic-anchor-button');
                button.textContent = `Epic #${epicId}`;
                button.onclick = async () => {
                    console.log(`Epic Anchor Post Processor - Button for Epic #${epicId} clicked.`);
                    const originalButtonText = button.textContent;
                    button.textContent = 'Loading...';
                    button.disabled = true;

                    try {
                        if (!this.settings?.organizationUrl) {
                            new Notice('Azure DevOps Organization URL is not set in plugin settings.');
                            button.textContent = originalButtonText;
                            button.disabled = false;
                            return;
                        }
                         if (!this.settings?.pat) {
                            new Notice('Azure DevOps PAT is not set in plugin settings.');
                            button.textContent = originalButtonText;
                            button.disabled = false;
                            return;
                        }
                        // Ensure API client is configured with latest settings
                        this.adoApi.setBaseUrl(this.settings.organizationUrl);
                        this.adoApi.setPersonalAccessToken(this.settings.pat);

                        const epicDetails = await this.epicsManager.fetchEpicById(epicId);
                        console.log(`Epic Anchor Post Processor - Fetched epic details for #${epicId}:`, epicDetails);
                        createAndShowEpicPopover(button, epicDetails, this);
                    } catch (error) {
                        console.error(`Epic Anchor Post Processor - Error fetching epic #${epicId}:`, error);
                        new Notice(`Failed to fetch Epic #${epicId}. See console for details.`);
                    } finally {
                        button.textContent = originalButtonText;
                        button.disabled = false;
                    }
                };

                // If the entire text node is the anchor
                if (node.nodeValue === fullMatch) {
                    console.log(`Epic Anchor Post Processor - Replacing entire node with button for Epic #${epicId}`);
                    node.parentElement.replaceChild(button, node);
                } else {
                    // If the anchor is part of a larger text node, split the node
                    const parts = node.nodeValue!.split(fullMatch);
                    const parent = node.parentElement;
                    
                    console.log(`Epic Anchor Post Processor - Splitting node and inserting button for Epic #${epicId}`);
                    
                    parent.insertBefore(document.createTextNode(parts[0]), node);
                    parent.insertBefore(button, node);
                    if (parts.length > 1 && parts[1].length > 0) {
                         parent.insertBefore(document.createTextNode(parts[1]), node);
                    }
                    parent.removeChild(node); // Remove the original combined text node
                }
            }
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

// --- Popover Logic ---
let currentEpicPopover: HTMLElement | null = null;
let popoverDocumentClickHandler: ((event: MouseEvent) => void) | null = null;

function closeCurrentEpicPopover() {
    if (currentEpicPopover) {
        currentEpicPopover.remove();
        currentEpicPopover = null;
    }
    if (popoverDocumentClickHandler) {
        document.removeEventListener('click', popoverDocumentClickHandler);
        popoverDocumentClickHandler = null;
    }
}

function createAndShowEpicPopover(targetButton: HTMLElement, epic: Epic, plugin: ADOPlugin) {
    closeCurrentEpicPopover(); // Close any existing popover

    const popover = document.createElement('div');
    popover.classList.add('epic-details-popover');
    popover.style.position = 'absolute';
    popover.style.border = '1px solid var(--background-modifier-border)';
    popover.style.backgroundColor = 'var(--background-secondary)';
    popover.style.padding = '10px';
    popover.style.borderRadius = '5px';
    popover.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    popover.style.zIndex = '1000'; // Ensure it's on top
    popover.style.maxWidth = '500px'; // Adjusted for tabs
    popover.style.minWidth = '350px';
    popover.style.overflowY = 'auto';
    popover.style.maxHeight = '450px'; // Adjusted for tabs

    const fields = epic.fields;
    const title = fields['System.Title'] || 'N/A';
    const state = fields['System.State'] || 'N/A';
    const descriptionContent = fields['System.Description'] || 'No description available.';
    
    // --- Contacts Tab Content ---
    let contactsHtml = '<table>';
    const contactFields = [
        { label: 'Assigned To', fieldName: 'System.AssignedTo' },
        { label: 'Created By', fieldName: 'System.CreatedBy' },
        { label: 'Changed By', fieldName: 'System.ChangedBy' },
        { label: 'Epic Owner', fieldName: 'Custom.EnterpriseOneEpicOwner' }, // REMINDER: Update if actual field name is different
        { label: 'Solution Architect', fieldName: 'Custom.SolutionArchitect' },
        { label: 'CTX Commerce PM', fieldName: 'Custom.CTXCommerceDomainPM' },
        { label: 'CTX Web Acq. PM', fieldName: 'Custom.CTXWebAcquisitionsPM' }
        // Add more contact roles here with their labels and actual ADO field names
    ];

    contactFields.forEach(cf => {
        const identity = fields[cf.fieldName] as import('./types/index.js').AdoIdentity | undefined;
        if (identity && identity.displayName) {
            contactsHtml += `<tr><td style="padding-right: 10px;"><strong>${cf.label}:</strong></td><td>${identity.displayName}`;
            if (identity.uniqueName) {
                // Make uniqueName a link to MS Teams chat
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
    // --- End Contacts Tab Content ---

    // Placeholder: Replace 'Custom.ReadinessFieldName' with the actual ADO field name.
    const readinessContent = fields['Custom.ReadinessFieldName'] || 'Readiness information not available. Configure field name.';
    const featuresInitialContent = 'Loading features...';

    // Header
    const header = document.createElement('h4');
    header.style.marginTop = '0px';
    header.style.marginBottom = '10px';
    header.textContent = `Epic #${epic.id}: ${title}`;
    popover.appendChild(header);

    // Tab container
    const tabContainer = document.createElement('div');
    tabContainer.style.display = 'flex';
    tabContainer.style.marginBottom = '10px';
    tabContainer.style.borderBottom = '1px solid var(--background-modifier-border)';

    // Tab content container
    const tabContentContainer = document.createElement('div');
    tabContentContainer.style.minHeight = '100px'; // Give some base height for content

    const tabs = [
        { id: 'description', name: 'Description', content: descriptionContent },
        { id: 'contacts', name: 'Contacts', content: contactsContent },
        { id: 'features', name: 'Features', content: featuresInitialContent },
        { id: 'readiness', name: 'Readiness', content: readinessContent }
    ];

    tabs.forEach((tabInfo, index) => {
        const tabButton = document.createElement('button');
        tabButton.textContent = tabInfo.name;
        tabButton.style.padding = '8px 12px';
        tabButton.style.border = 'none';
        tabButton.style.background = 'transparent';
        tabButton.style.cursor = 'pointer';
        tabButton.style.borderBottom = '2px solid transparent';
        tabButton.style.marginRight = '5px';
        tabButton.dataset.tabId = tabInfo.id;

        const tabPane = document.createElement('div');
        tabPane.id = `tab-pane-${tabInfo.id}`;
        tabPane.classList.add('epic-popover-tab-pane');
        tabPane.style.padding = '5px';
        
        // ADO Description is often HTML. Set innerHTML for it.
        // For other custom fields, they might be plain text or also HTML.
        // Using innerHTML for all for now, but sanitize if content is untrusted.
        tabPane.innerHTML = tabInfo.content;

        if (index !== 0) {
            tabPane.style.display = 'none';
        } else {
            tabButton.style.borderBottomColor = 'var(--interactive-accent)';
            tabButton.style.fontWeight = 'bold';
        }

        tabButton.onclick = () => {
            tabContainer.querySelectorAll('button').forEach(btn => {
                btn.style.borderBottomColor = 'transparent';
                btn.style.fontWeight = 'normal';
            });
            popover.querySelectorAll('.epic-popover-tab-pane').forEach(pane => {
                (pane as HTMLElement).style.display = 'none';
            });

            tabButton.style.borderBottomColor = 'var(--interactive-accent)';
            tabButton.style.fontWeight = 'bold';
            const activePane = popover.querySelector(`#tab-pane-${tabInfo.id}`) as HTMLElement;
            if (activePane) {
                activePane.style.display = 'block';
            }
        };

        tabContainer.appendChild(tabButton);
        tabContentContainer.appendChild(tabPane);
    });

    popover.appendChild(tabContainer);
    popover.appendChild(tabContentContainer);

    // Asynchronously load features for the "Features" tab
    const featuresPane = popover.querySelector('#tab-pane-features') as HTMLElement;
    if (featuresPane) {
        plugin.featuresManager.fetchFeaturesByParentId(epic.id)
            .then(features => {
                if (!features || features.length === 0) {
                    featuresPane.innerHTML = 'No features found for this epic.';
                    return;
                }
                let featuresHtml = '<ul style="list-style: none; padding-left: 0;">';
                const orgUrl = plugin.settings?.organizationUrl;
                const projectName = plugin.settings?.projectName;

                features.forEach((feature, index) => {
                    const featureTitle = feature.fields['System.Title'] || 'Untitled Feature';
                    const featureState = feature.fields['System.State'] || 'Unknown State';
                    const featureDescription = feature.fields['System.Description'] || 'No description available.';
                    const featureId = feature.id; // Store for use in element IDs

                    // Header part of the feature item (clickable)
                    let featureHeaderHtml = `<div class="feature-header" data-feature-index="${index}" style="cursor: pointer; padding: 5px; border-bottom: 1px solid var(--background-modifier-border-hover);">`;
                    featureHeaderHtml += `<strong>#${featureId}</strong>: ${featureTitle} [${featureState}]`;
                    
                    // Add ADO link to the header
                    if (orgUrl && projectName) {
                        const normalizedOrgUrl = orgUrl.replace(/\/+$/, '');
                        const featureUrl = `${normalizedOrgUrl}/${encodeURIComponent(projectName)}/_workitems/edit/${featureId}`;
                        featureHeaderHtml += ` <a href="${featureUrl}" target="_blank" rel="noopener noreferrer" title="Open Feature #${featureId} in ADO" style="text-decoration: none; color: var(--interactive-accent); font-size: 0.85em;">(Open in ADO)</a>`;
                    }
                    featureHeaderHtml += `</div>`;

                    // Content part of the feature item (collapsible)
                    // Ensure IDs are unique if multiple popovers could exist, though current logic closes old ones.
                    const contentId = `feature-content-${epic.id}-${featureId}`;
                    let featureContentHtml = `<div id="${contentId}" class="feature-content" style="display: none; padding: 10px; margin-left: 15px; border-left: 2px solid var(--background-modifier-border); background-color: var(--background-primary-alt);">`;
                    // ADO descriptions are HTML, so use innerHTML
                    featureContentHtml += `<div>${featureDescription}</div>`;
                    featureContentHtml += `</div>`;
                    
                    featuresHtml += `<li style="margin-bottom: 2px;">${featureHeaderHtml}${featureContentHtml}</li>`;
                });
                featuresHtml += '</ul>';
                featuresPane.innerHTML = featuresHtml;

                // Add click listeners to feature headers to toggle content visibility
                featuresPane.querySelectorAll('.feature-header').forEach(headerElement => {
                    headerElement.addEventListener('click', (event) => {
                        // Prevent ADO link click from also triggering collapse/expand if on the link itself
                        if ((event.target as HTMLElement).tagName === 'A') {
                            return;
                        }
                        const featureIndex = headerElement.getAttribute('data-feature-index');
                        if (featureIndex === null) return;
                        
                        const clickedFeature = features[parseInt(featureIndex, 10)];
                        const contentElementId = `feature-content-${epic.id}-${clickedFeature.id}`;
                        const contentElement = featuresPane.querySelector(`#${contentElementId}`) as HTMLElement | null;

                        if (contentElement) {
                            const isVisible = contentElement.style.display !== 'none';
                            contentElement.style.display = isVisible ? 'none' : 'block';
                        }
                    });
                });
            })
            .catch(error => {
                console.error('Error fetching features for popover:', error);
                featuresPane.innerHTML = 'Error loading features. See console for details.';
                new Notice('Failed to load features for epic. See console for details.');
            });
    }
    
    const generalInfoContainer = document.createElement('div');
    generalInfoContainer.style.marginTop = '10px';
    generalInfoContainer.style.paddingTop = '10px';
    generalInfoContainer.style.borderTop = '1px solid var(--background-modifier-border)';
    generalInfoContainer.style.fontSize = '0.9em';
    
    let generalInfoHtml = `<strong>State:</strong> ${state}<br>`;
    generalInfoHtml += `<strong>Created:</strong> ${fields['System.CreatedDate'] ? new Date(fields['System.CreatedDate']).toLocaleDateString() : 'N/A'}<br>`;
    generalInfoHtml += `<strong>Updated:</strong> ${fields['System.ChangedDate'] ? new Date(fields['System.ChangedDate']).toLocaleDateString() : 'N/A'}`;
    generalInfoContainer.innerHTML = generalInfoHtml;
    popover.appendChild(generalInfoContainer);

    const openInAdoButton = document.createElement('button');
    openInAdoButton.textContent = 'Open in ADO';
    openInAdoButton.style.marginTop = '15px';
    openInAdoButton.style.padding = '5px 10px';
    openInAdoButton.onclick = () => {
        const orgUrl = plugin.settings?.organizationUrl;
        const projectName = plugin.settings?.projectName;
        if (!orgUrl) {
            new Notice('Azure DevOps Organization URL is not set.');
            return;
        }
        if (!projectName) {
            new Notice('Azure DevOps Project Name is not set.');
            return;
        }
        const normalizedOrgUrl = orgUrl.replace(/\/+$/, '');
        // Construct the full URL including organization and project
        window.open(`${normalizedOrgUrl}/${encodeURIComponent(projectName)}/_workitems/edit/${epic.id}`, '_blank');
        closeCurrentEpicPopover();
    };
    popover.appendChild(openInAdoButton);

    document.body.appendChild(popover);
    currentEpicPopover = popover;

    // Position popover near the button
    const rect = targetButton.getBoundingClientRect();
    popover.style.top = `${rect.bottom + window.scrollY + 5}px`;
    popover.style.left = `${rect.left + window.scrollX}px`;

    // Adjust if it goes off-screen
    const popoverRect = popover.getBoundingClientRect();
    if (popoverRect.right > window.innerWidth - 10) {
        popover.style.left = `${window.innerWidth - popoverRect.width - 10 + window.scrollX}px`;
    }
    if (popoverRect.left < 10) {
        popover.style.left = `${10 + window.scrollX}px`;
    }
     if (popoverRect.bottom > window.innerHeight -10) {
        popover.style.top = `${rect.top + window.scrollY - popoverRect.height - 5}px`; // Show above if not enough space below
    }


    // Click outside to close
    popoverDocumentClickHandler = (event: MouseEvent) => {
        if (currentEpicPopover && !currentEpicPopover.contains(event.target as Node) && event.target !== targetButton) {
            closeCurrentEpicPopover();
        }
    };
    // Use setTimeout to allow the current click event (that opened the popover) to propagate
    setTimeout(() => {
        if (popoverDocumentClickHandler) { // Check if it hasn't been cleared by another rapid click
            document.addEventListener('click', popoverDocumentClickHandler);
        }
    }, 0);
}


// CodeMirror 6 ViewPlugin for rendering Epic Anchors as buttons in Edit Mode

class EpicAnchorButtonWidget extends WidgetType {
    constructor(readonly epicId: string, readonly plugin: ADOPlugin) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        const button = document.createElement('button');
        button.classList.add('epic-anchor-button-editor'); // Different class for editor if needed
        button.textContent = `Epic #${this.epicId}`;
        button.style.cursor = 'pointer';
        // Add any other styling as needed, e.g., from your postprocessor
        // button.style.backgroundColor = 'var(--interactive-accent)';
        // button.style.color = 'var(--text-on-accent)';
        // button.style.border = 'none';
        // button.style.borderRadius = '3px';
        // button.style.padding = '1px 6px';
        // button.style.fontSize = '0.9em';
        // button.style.margin = '0 2px';


        button.onclick = async (event) => {
            event.preventDefault();
            console.log(`Editor Epic Anchor Button - Clicked Epic #${this.epicId}`);
            const originalButtonText = button.textContent;
            button.textContent = 'Loading...';
            button.disabled = true;

            try {
                if (!this.plugin.settings?.organizationUrl) {
                    new Notice('Azure DevOps Organization URL is not set in plugin settings.');
                    button.textContent = originalButtonText;
                    button.disabled = false;
                    return;
                }
                if (!this.plugin.settings?.pat) {
                    new Notice('Azure DevOps PAT is not set in plugin settings.');
                    button.textContent = originalButtonText;
                    button.disabled = false;
                    return;
                }
                // Ensure API client is configured with latest settings
                this.plugin.adoApi.setBaseUrl(this.plugin.settings.organizationUrl);
                this.plugin.adoApi.setPersonalAccessToken(this.plugin.settings.pat);

                const epicDetails = await this.plugin.epicsManager.fetchEpicById(this.epicId);
                console.log(`Editor Epic Anchor Button - Fetched epic details for #${this.epicId}:`, epicDetails);
                createAndShowEpicPopover(button, epicDetails, this.plugin);
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
        // Handle click events, ignore others for widget interaction
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

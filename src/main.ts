import { Plugin, App, Editor, Notice, MarkdownView, Modal, MarkdownPostProcessorContext } from 'obsidian';
import ADOApi from './ado/api.js';
import { EpicsManager } from './ado/epics.js';
import { FeaturesManager } from './ado/features.js';
import SettingsTab from './ui/settingsTab.js';

export default class ADOPlugin extends Plugin {
    private adoApi!: ADOApi;
    private epicsManager!: EpicsManager;
    private featuresManager!: FeaturesManager;
    public settings: any;

    async onload() {
        await this.loadSettings();

        this.adoApi = new ADOApi();
        this.epicsManager = new EpicsManager(this.adoApi);
        this.featuresManager = new FeaturesManager(this.adoApi);

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
                button.onclick = () => {
                    console.log(`Epic Anchor Post Processor - Button for Epic #${epicId} clicked.`);
                    const orgUrl = this.settings?.organizationUrl;
                    if (!orgUrl) {
                        new Notice('Azure DevOps Organization URL is not set in plugin settings. Please configure it.');
                        console.warn('Epic Anchor Post Processor - Organization URL not set.');
                        return;
                    }
                    const normalizedOrgUrl = orgUrl.replace(/\/+$/, ''); // Remove trailing slashes
                    const epicUrl = `${normalizedOrgUrl}/_workitems/edit/${epicId}`;
                    console.log(`Epic Anchor Post Processor - Opening URL: ${epicUrl}`);
                    window.open(epicUrl, '_blank');
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

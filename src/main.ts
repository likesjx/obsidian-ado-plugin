import { Plugin, App, Editor, Notice, MarkdownView, Modal, MarkdownPostProcessorContext } from 'obsidian';
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
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


        button.onclick = (event) => {
            event.preventDefault(); // Prevent editor from losing focus or other default actions
            console.log(`Editor Epic Anchor Button - Clicked Epic #${this.epicId}`);
            const orgUrl = this.plugin.settings?.organizationUrl;
            if (!orgUrl) {
                new Notice('Azure DevOps Organization URL is not set in plugin settings. Please configure it.');
                console.warn('Editor Epic Anchor Button - Organization URL not set.');
                return;
            }
            const normalizedOrgUrl = orgUrl.replace(/\/+$/, ''); // Remove trailing slashes
            const epicUrl = `${normalizedOrgUrl}/_workitems/edit/${this.epicId}`;
            console.log(`Editor Epic Anchor Button - Opening URL: ${epicUrl}`);
            window.open(epicUrl, '_blank');
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

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
                    new Notice(`Clicked Epic #${epicId}`);
                    console.log(`Epic Anchor Post Processor - Button for Epic #${epicId} clicked.`);
                    // Potentially open epic details or navigate
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

// === EPIC ANCHOR ENHANCEMENT ===

/**
 * PART 1: Anchor Detection
 * Find all <<#123>> anchors in a string.
 * @param text The markdown text to scan
 * @returns Array of { epicId: string, position: number }
 */
function findEpicAnchors(text: string): { epicId: string; position: number }[] {
    const regex = /<<#(\d+?)>>/g;
    const result: { epicId: string; position: number }[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        result.push({ epicId: match[1], position: match.index });
    }
    return result;
}

/**
 * PART 2: Button Conversion (Markdown Post-Processor)
 * Converts <<#123>> anchors in rendered preview to interactive buttons.
 * Keeps the original anchor in the markdown source.
 */
function epicAnchorPostProcessor(el: HTMLElement, ctx: any) {
    // Find all text nodes containing <<#123>>
    const anchorRegex = /<<#(\d+?)>>/g;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const nodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
        if (anchorRegex.test(node.textContent || '')) {
            nodes.push(node);
        }
    }
    nodes.forEach(textNode => {
        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        const text = textNode.textContent || '';
        anchorRegex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = anchorRegex.exec(text)) !== null) {
            // Text before anchor
            if (match.index > lastIndex) {
                frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            }
            // Insert the anchor as-is (so it is visible in preview and copy/paste)
            frag.appendChild(document.createTextNode(match[0]));
            // Insert the button right after the anchor
            const btn = document.createElement('button');
            btn.textContent = `Epic ${match[1]}`;
            btn.setAttribute('data-epic-anchor', match[0]);
            btn.setAttribute('type', 'button');
            btn.style.background = 'var(--interactive-accent)';
            btn.style.color = 'var(--text-on-accent)';
            btn.style.border = 'none';
            btn.style.borderRadius = '4px';
            btn.style.padding = '2px 8px';
            btn.style.margin = '0 2px';
            btn.style.cursor = 'pointer';
            btn.style.transition = 'transform 0.1s';
            btn.onmouseenter = () => btn.style.transform = 'scale(1.05)';
            btn.onmouseleave = () => btn.style.transform = '';
            btn.onclick = () => {
                // Open Azure DevOps epic URL using the plugin's settings.organizationUrl
                let baseUrl = ctx?.plugin?.settings?.organizationUrl;
                if (!baseUrl) {
                    new Notice('Azure DevOps Organization URL is not set in plugin settings.');
                    return;
                }
                // Remove trailing slash if present
                baseUrl = baseUrl.replace(/\/+$/, '');
                window.open(`${baseUrl}/_workitems/edit/${match[1]}`, '_blank');
            };
            frag.appendChild(btn);
            lastIndex = match.index + match[0].length;
        }
        // Remaining text after last anchor
        if (lastIndex < text.length) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        textNode.parentNode?.replaceChild(frag, textNode);
    });
}

// Register the post processor in the plugin
// (Call this in onload)
ADOPlugin.prototype.onload = (function (original) {
    return async function (this: ADOPlugin) {
        await original.call(this);
        this.registerMarkdownPostProcessor((el, ctx) => epicAnchorPostProcessor(el, { ...ctx, plugin: this }));
    };
})(ADOPlugin.prototype.onload);
// Render anchors as buttons in both preview and edit mode without modifying underlying markdown.
// The following post processor replaces anchors with class 'ado-anchor' by rendering a button.
// In preview mode, the button is injected and the anchor is hidden.
// For edit mode, a similar approach can be integrated into the CodeMirror extension if required.

if (this.registerMarkdownPostProcessor) {
  this.registerMarkdownPostProcessor((element: HTMLElement, context: any) => {
    const anchors = element.querySelectorAll('a.ado-anchor');
    anchors.forEach((anchor: HTMLAnchorElement) => {
      // Create the button element replicating the anchor's label and link.
      const button = document.createElement('button');
      button.textContent = anchor.textContent || 'Button';
      button.className = 'ado-button';
      button.onclick = () => {
        const href = anchor.getAttribute('href');
        if (href) window.open(href, '_blank');
      };
      // Insert the button before the hidden anchor.
      anchor.parentNode.insertBefore(button, anchor);
      // Hide the original anchor to keep markdown intact.
      anchor.style.display = 'none';
    });
  });
}

// Note: To render the button in edit mode within CodeMirror, a similar widget decoration
// would need to be implemented as an extension to replace the anchor rendering in the editor.
// This ensures that while editing, users see the button interface instead of the raw anchor tag.
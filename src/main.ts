import { Plugin, App, Editor, Notice, MarkdownView, Modal } from 'obsidian';
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
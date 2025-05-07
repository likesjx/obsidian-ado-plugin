import { PluginSettingTab, App, Setting } from 'obsidian';

export default class SettingsTab extends PluginSettingTab {
    private plugin: any;

    constructor(app: App, plugin: any) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        this.containerEl.empty();

        this.containerEl.createEl('h2', { text: 'Azure DevOps Plugin Settings' });

        // Ensure settings object and defaults
        const settings = this.plugin.settings || {};
        const pat = settings.pat || '';
        const organizationUrl = settings.organizationUrl || '';
        const refreshInterval = (settings.refreshInterval !== undefined && settings.refreshInterval !== null) ? settings.refreshInterval : 15;

        new Setting(this.containerEl)
            .setName('ADO Personal Access Token')
            .setDesc('Enter your Azure DevOps Personal Access Token.')
            .addText(text => text
                .setPlaceholder('Enter your PAT')
                .setValue(pat)
                .onChange(async (value) => {
                    if (!this.plugin.settings) this.plugin.settings = {};
                    this.plugin.settings.pat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(this.containerEl)
            .setName('ADO Organization URL')
            .setDesc('Enter your Azure DevOps Organization URL.')
            .addText(text => text
                .setPlaceholder('https://dev.azure.com/yourorganization')
                .setValue(organizationUrl)
                .onChange(async (value) => {
                    if (!this.plugin.settings) this.plugin.settings = {};
                    this.plugin.settings.organizationUrl = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(this.containerEl)
            .setName('Refresh Interval')
            .setDesc('Set the interval (in minutes) for refreshing data from Azure DevOps.')
            .addText(text => text
                .setPlaceholder('Enter interval in minutes')
                .setValue(refreshInterval.toString())
                .onChange(async (value) => {
                    const interval = parseInt(value);
                    if (!isNaN(interval)) {
                        if (!this.plugin.settings) this.plugin.settings = {};
                        this.plugin.settings.refreshInterval = interval;
                        await this.plugin.saveSettings();
                    }
                }));
    }
}
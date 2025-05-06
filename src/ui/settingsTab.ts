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

        new Setting(this.containerEl)
            .setName('ADO Personal Access Token')
            .setDesc('Enter your Azure DevOps Personal Access Token.')
            .addText((text: import('obsidian').TextComponent) => text
                .setPlaceholder('Enter your PAT')
                .setValue(this.plugin.settings.pat)
                .onChange(async (value: string) => {
                    this.plugin.settings.pat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(this.containerEl)
            .setName('ADO Organization URL')
            .setDesc('Enter your Azure DevOps Organization URL.')
            .addText((text: import('obsidian').TextComponent) => text
                .setPlaceholder('https://dev.azure.com/yourorganization')
                .setValue(this.plugin.settings.organizationUrl)
                .onChange(async (value: string) => {
                    this.plugin.settings.organizationUrl = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(this.containerEl)
            .setName('Refresh Interval')
            .setDesc('Set the interval (in minutes) for refreshing data from Azure DevOps.')
            .addText((text: import('obsidian').TextComponent) => text
                .setPlaceholder('Enter interval in minutes')
                .setValue(this.plugin.settings.refreshInterval.toString())
                .onChange(async (value: string) => {
                    const interval = parseInt(value);
                    if (!isNaN(interval)) {
                        this.plugin.settings.refreshInterval = interval;
                        await this.plugin.saveSettings();
                    }
                }));
    }
}
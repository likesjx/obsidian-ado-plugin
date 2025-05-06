"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
class SettingsTab extends obsidian_1.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        this.containerEl.empty();
        this.containerEl.createEl('h2', { text: 'Azure DevOps Plugin Settings' });
        new obsidian_1.Setting(this.containerEl)
            .setName('ADO Personal Access Token')
            .setDesc('Enter your Azure DevOps Personal Access Token.')
            .addText((text) => text
            .setPlaceholder('Enter your PAT')
            .setValue(this.plugin.settings.pat)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.pat = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(this.containerEl)
            .setName('ADO Organization URL')
            .setDesc('Enter your Azure DevOps Organization URL.')
            .addText((text) => text
            .setPlaceholder('https://dev.azure.com/yourorganization')
            .setValue(this.plugin.settings.organizationUrl)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.organizationUrl = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(this.containerEl)
            .setName('Refresh Interval')
            .setDesc('Set the interval (in minutes) for refreshing data from Azure DevOps.')
            .addText((text) => text
            .setPlaceholder('Enter interval in minutes')
            .setValue(this.plugin.settings.refreshInterval.toString())
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            const interval = parseInt(value);
            if (!isNaN(interval)) {
                this.plugin.settings.refreshInterval = interval;
                yield this.plugin.saveSettings();
            }
        })));
    }
}
exports.default = SettingsTab;

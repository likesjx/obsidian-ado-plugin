import { Plugin } from 'obsidian';
import ADOApi from './ado/api';
import { EpicsManager } from './ado/epics';
import { FeaturesManager } from './ado/features';
import SettingsTab from './ui/settingsTab';

export default class ADOPlugin extends Plugin {
    private adoApi!: ADOApi;
    private epicsManager!: EpicsManager;
    private featuresManager!: FeaturesManager;

    async onload() {
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
    }

    onunload() {
        // Cleanup logic if needed
    }
}
import ADOApi from './api.js';
import { Feature } from '../types/index.js';

export class FeaturesManager {
    private apiVersion = "7.0";

    constructor(private adoApi: ADOApi, private settings: { projectName?: string }) {}

    private getProjectName(): string {
        if (!this.settings.projectName) {
            throw new Error("Azure DevOps Project Name is not configured in plugin settings.");
        }
        return encodeURIComponent(this.settings.projectName);
    }

    // TODO: Verify and update this endpoint for creating features
    async createFeature(featureData: Omit<Feature, 'id' | 'createdDate' | 'updatedDate'>): Promise<Feature> {
        const projectName = this.getProjectName();
        // Similar to Epics, creating a Feature (a work item type) needs the correct endpoint.
        // Example: POST /{project}/_apis/wit/workitems/${$type}?api-version={api-version}
        const response = await this.adoApi.post<Feature>(`/${projectName}/_apis/wit/workitems/$Feature?api-version=${this.apiVersion}`, featureData);
        return response.data;
    }

    // TODO: Verify and update this endpoint for updating features
    async updateFeature(featureId: string, featureData: Partial<Feature>): Promise<Feature> {
        const projectName = this.getProjectName();
        const response = await this.adoApi.patch<Feature>(`/${projectName}/_apis/wit/workitems/${featureId}?api-version=${this.apiVersion}`, featureData);
        return response.data;
    }

    // TODO: Verify and update this endpoint for deleting features
    async deleteFeature(featureId: string): Promise<void> {
        const projectName = this.getProjectName();
        await this.adoApi.delete(`/${projectName}/_apis/wit/workitems/${featureId}?api-version=${this.apiVersion}`);
    }

    // TODO: Verify and update this endpoint for fetching features related to an epic (likely using WIQL)
    async fetchFeatures(epicId: string): Promise<Feature[]> {
        const projectName = this.getProjectName();
        // This will likely require a WIQL query to find Features linked to a specific Epic.
        // Example: SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Feature' AND [System.Parent] = {epicId}
        // For now, this is a placeholder and will not work as intended.
        // A more robust solution would involve a two-step process:
        // 1. Execute a WIQL query to get IDs of features linked to the epic.
        // 2. Fetch details for these feature IDs.
        console.warn(`fetchFeatures for epicId ${epicId} is using a placeholder implementation and needs a proper WIQL query.`);
        const response = await this.adoApi.get<Feature[]>(`/${projectName}/_apis/wit/workitems?type=Feature&api-version=${this.apiVersion}`); // This is a simplified guess
        return response.data;
    }
}
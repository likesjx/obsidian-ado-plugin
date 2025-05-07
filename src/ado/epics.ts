import ADOApi from './api.js';
import { Epic } from '../types/index.js';

export class EpicsManager {
    private apiVersion = "7.0";

    constructor(private adoApi: ADOApi, private settings: { projectName?: string }) {}

    private getProjectName(): string {
        if (!this.settings.projectName) {
            throw new Error("Azure DevOps Project Name is not configured in plugin settings.");
        }
        return encodeURIComponent(this.settings.projectName);
    }

    // TODO: Verify and update this endpoint for creating epics
    async createEpic(epicData: Omit<Epic, 'id' | 'createdDate' | 'updatedDate'>): Promise<Epic> {
        const projectName = this.getProjectName();
        // This is a guess; the actual endpoint for creating an Epic (which is a work item type) might be different.
        // It often involves specifying the work item type in the path or body.
        // Example: POST /{project}/_apis/wit/workitems/${$type}?api-version={api-version}
        // For now, using a placeholder.
        const response = await this.adoApi.post<Epic>(`/${projectName}/_apis/wit/workitems/$Epic?api-version=${this.apiVersion}`, epicData);
        return response.data;
    }

    // TODO: Verify and update this endpoint for updating epics
    async updateEpic(epicId: string, epicData: Partial<Epic>): Promise<Epic> {
        const projectName = this.getProjectName();
        // For PATCH, the body usually contains an array of operations (JSON Patch document)
        // This will likely need to be adjusted based on how ADO expects updates for work items.
        const response = await this.adoApi.patch<Epic>(`/${projectName}/_apis/wit/workitems/${epicId}?api-version=${this.apiVersion}`, epicData);
        return response.data;
    }

    // TODO: Verify and update this endpoint for deleting epics
    async deleteEpic(epicId: string): Promise<void> {
        const projectName = this.getProjectName();
        await this.adoApi.delete(`/${projectName}/_apis/wit/workitems/${epicId}?api-version=${this.apiVersion}`);
    }

    // TODO: Verify and update this endpoint for fetching multiple epics (likely using WIQL)
    async fetchEpics(): Promise<Epic[]> {
        const projectName = this.getProjectName();
        // Fetching multiple work items of a specific type usually involves a WIQL query.
        // Example: POST /{project}/_apis/wit/wiql?api-version={api-version} with body { query: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Epic'" }
        // Then, fetch details for these IDs. For now, using a placeholder.
        const response = await this.adoApi.get<Epic[]>(`/${projectName}/_apis/wit/workitems?type=Epic&api-version=${this.apiVersion}`); // This is a simplified guess
        return response.data;
    }

    async fetchEpicById(epicId: string): Promise<Epic> {
        const projectName = this.getProjectName();
        const response = await this.adoApi.get<Epic>(`/${projectName}/_apis/wit/workitems/${epicId}?api-version=${this.apiVersion}`);
        return response.data;
    }
}
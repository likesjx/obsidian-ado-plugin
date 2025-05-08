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

    /**
     * Fetches features that are children of a given parent work item ID (e.g., an Epic).
     * @param parentId The ID of the parent work item.
     * @returns A promise that resolves to an array of Feature objects.
     */
    async fetchFeaturesByParentId(parentId: number): Promise<Feature[]> {
        const projectName = this.getProjectName();
        const wiqlQuery = {
            query: `SELECT [System.Id], [System.Title], [System.State] FROM workitems WHERE [System.WorkItemType] = 'Feature' AND [System.Parent] = ${parentId} ORDER BY [Microsoft.VSTS.Common.StackRank] ASC, [System.Id] ASC`
        };

        try {
            // Step 1: Execute WIQL query to get work item references
            const wiqlResult = await this.adoApi.post<{ workItems: { id: number, url: string }[], columns: { referenceName: string }[] }>(
                `/${projectName}/_apis/wit/wiql?api-version=${this.apiVersion}`,
                wiqlQuery
            );

            if (!wiqlResult.data.workItems || wiqlResult.data.workItems.length === 0) {
                return []; // No features found
            }

            const featureIds = wiqlResult.data.workItems.map(item => item.id);

            // Step 2: Fetch details for these feature IDs
            // The WIQL query above already selects Id, Title, and State.
            // For a more complete Feature object, we'd use the /_apis/wit/workitems batch endpoint.
            // However, ADO's WIQL result can sometimes directly provide the selected fields if the query is structured for it.
            // Let's try to fetch them in batch for more complete objects if needed,
            // but for now, we'll assume the WIQL response might need to be augmented or we can use a different approach.

            // A more direct way to get fields from a WIQL query is to use the $expand=fields option with the WIQL endpoint,
            // or to use the batch workitems endpoint.
            // Let's use the batch workitems endpoint for more robust field retrieval.

            if (featureIds.length === 0) {
                return [];
            }

            const fieldsToFetch = [
                "System.Id",
                "System.Title",
                "System.State",
                "System.Description",
                "System.CreatedDate",
                "System.ChangedDate",
                "System.Parent"
                // Add any other fields typically part of your Feature type
            ];

            const batchGetResponse = await this.adoApi.get<{ value: Feature[] }>(
                `/_apis/wit/workitems?ids=${featureIds.join(',')}&fields=${fieldsToFetch.join(',')}&api-version=${this.apiVersion}`
            );
            
            // The above GET request is for the entire organization. We need to scope it to the project for some APIs,
            // but for fetching work items by ID, the org-level endpoint is fine.

            return batchGetResponse.data.value.map(apiItem => {
                // Ensure all required fields from the Feature type are mapped,
                // even if they might be undefined from the API response for a partial fetch.
                // The `fieldsToFetch` should align with what's defined in the `Feature` type.
                const featureFields: Feature['fields'] = {
                    "System.Title": apiItem.fields["System.Title"],
                    "System.State": apiItem.fields["System.State"],
                    "System.CreatedDate": apiItem.fields["System.CreatedDate"],
                    "System.ChangedDate": apiItem.fields["System.ChangedDate"],
                    "System.Description": apiItem.fields["System.Description"], // Optional in type
                    "System.Parent": apiItem.fields["System.Parent"], // Optional in type
                    "System.AssignedTo": apiItem.fields["System.AssignedTo"], // Optional in type
                    "System.CreatedBy": apiItem.fields["System.CreatedBy"], // Optional in type
                    "System.ChangedBy": apiItem.fields["System.ChangedBy"], // Optional in type
                };

                // Add any other custom fields that might exist on apiItem.fields
                // and are allowed by the [key: string]: any; in Feature['fields']
                for (const key in apiItem.fields) {
                    if (!(key in featureFields)) {
                        featureFields[key] = apiItem.fields[key];
                    }
                }
                
                return {
                    id: apiItem.id,
                    rev: apiItem.rev,
                    fields: featureFields
                } as Feature; // Cast to Feature, assuming all required fields are now present
            });

        } catch (error) {
            console.error(`Error fetching features for parent ID ${parentId}:`, error);
            // Consider how to handle errors, e.g., throw, return empty array, or a specific error object
            throw error; // Re-throw for now, or handle more gracefully
        }
    }

    // The old fetchFeatures method might be deprecated or refactored if not used elsewhere.
    // For now, I'll leave it but comment it out to avoid confusion.
    /*
    async fetchFeatures(epicId: string): Promise<Feature[]> {
        const projectName = this.getProjectName();
        console.warn(`fetchFeatures for epicId ${epicId} is using a placeholder implementation and needs a proper WIQL query.`);
        const response = await this.adoApi.get<Feature[]>(`/${projectName}/_apis/wit/workitems?type=Feature&api-version=${this.apiVersion}`);
        return response.data;
    }
    */
}
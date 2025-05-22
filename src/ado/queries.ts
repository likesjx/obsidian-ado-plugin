import ADOApi from './api';
import { WorkItemQueryResult } from '../types';

export class QueriesManager {
    constructor(private adoApi: ADOApi, private settings: any) {}

    async executeQuery(queryIdOrPath: string): Promise<WorkItemQueryResult[]> {
        if (!this.settings.projectName) {
            console.error('Project name is not set in settings.');
            throw new Error('Project name is not configured in plugin settings.');
        }

        const wiqlUrl = `/${encodeURIComponent(this.settings.projectName)}/_apis/wit/wiql/${queryIdOrPath}?api-version=7.0`;
        
        let queryResult: any;
        try {
            // According to docs, POST can be used if query is too long, but GET is simpler for query by ID/Path
            // For now, assuming queryIdOrPath is a GUID or a short path.
            // If using a full WIQL query string, POST would be with { query: "SELECT ... FROM ..." }
            queryResult = await this.adoApi.get(wiqlUrl);
        } catch (error) {
            console.error(`Error executing query WIQL for '${queryIdOrPath}':`, error);
            throw new Error(`Failed to execute query '${queryIdOrPath}'. Check console for details.`);
        }

        if (!queryResult || !queryResult.workItems || queryResult.workItems.length === 0) {
            return []; // No work items found by the query
        }

        const workItemIds = queryResult.workItems.map((item: { id: number }) => item.id);
        
        // Store URLs from the query result if available, to map back later
        const workItemUrls: { [id: number]: string } = {};
        if (queryResult.workItems) {
            queryResult.workItems.forEach((item: { id: number, url: string }) => {
                workItemUrls[item.id] = item.url;
            });
        }


        if (workItemIds.length === 0) {
            return [];
        }

        const fieldsToFetch = [
            "System.Id",
            "System.Title",
            "System.State",
            "System.WorkItemType",
            // Add other fields here if needed in the future, e.g., System.AssignedTo
        ];
        const workItemsDetailsUrl = `/_apis/wit/workitems?ids=${workItemIds.join(',')}&fields=${fieldsToFetch.join(',')}&api-version=7.0`;

        let detailsResult: any;
        try {
            detailsResult = await this.adoApi.get(workItemsDetailsUrl);
        } catch (error) {
            console.error(`Error fetching work item details for IDs '${workItemIds.join(',')}':`, error);
            throw new Error('Failed to fetch work item details. Check console for details.');
        }

        if (!detailsResult || !detailsResult.value || detailsResult.value.length === 0) {
            return []; // Should not happen if IDs were valid, but good to check
        }

        const normalizedOrgUrl = this.settings.organizationUrl.replace(/\/+$/, '');

        return detailsResult.value.map((item: any): WorkItemQueryResult => {
            const adoItemUrl = workItemUrls[item.id] || 
                               `${normalizedOrgUrl}/${encodeURIComponent(this.settings.projectName)}/_workitems/edit/${item.id}`;
            return {
                id: item.id,
                title: item.fields['System.Title'] || 'N/A',
                state: item.fields['System.State'] || 'N/A',
                type: item.fields['System.WorkItemType'] || 'N/A',
                adoUrl: adoItemUrl,
                fields: { // Store raw fields too
                    'System.Id': item.id,
                    'System.Title': item.fields['System.Title'],
                    'System.State': item.fields['System.State'],
                    'System.WorkItemType': item.fields['System.WorkItemType'],
                    ...item.fields // Include any other fetched fields
                }
            };
        });
    }
}

export interface Epic {
    id: number; // ADO IDs are numbers
    rev: number;
    fields: {
        "System.Title": string;
        "System.Description"?: string; // Description can be HTML or plain text, might need processing
        "System.State": string;
        "System.CreatedDate": string; // Dates are strings from API, convert to Date objects as needed
        "System.ChangedDate": string; // ADO uses ChangedDate for last update
        // Add other fields as needed, e.g., System.AreaPath, System.IterationPath, Microsoft.VSTS.Common.Priority
        [key: string]: any; // Allow other fields
    };
    // _links?: any; // For HATEOAS links if needed
    // url?: string; // Direct URL to the work item
}

// Assuming Feature also follows a similar nested structure from ADO API
export interface Feature {
    id: number;
    rev: number;
    fields: {
        "System.Title": string;
        "System.Description"?: string;
        "System.State": string;
        "System.CreatedDate": string;
        "System.ChangedDate": string;
        "System.Parent"?: number; // To link to Epic ID
        [key: string]: any;
    };
}
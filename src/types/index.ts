export interface AdoIdentity {
    displayName: string;
    url?: string;
    id?: string;
    uniqueName?: string; // Often the email or UPN
    imageUrl?: string;
    descriptor?: string;
}

export interface Epic {
    id: number; // ADO IDs are numbers
    rev: number;
    fields: {
        "System.Title": string;
        "System.Description"?: string; // Description can be HTML or plain text, might need processing
        "System.State": string;
        "System.CreatedDate": string; // Dates are strings from API, convert to Date objects as needed
        "System.ChangedDate": string; // ADO uses ChangedDate for last update
        "System.AssignedTo"?: AdoIdentity;
        "System.CreatedBy"?: AdoIdentity;
        "System.ChangedBy"?: AdoIdentity;
        "Custom.EnterpriseOneEpicOwner"?: AdoIdentity; // Placeholder - replace if actual field name is different
        "Custom.SolutionArchitect"?: AdoIdentity;
        "Custom.CTXCommerceDomainPM"?: AdoIdentity;
        "Custom.CTXWebAcquisitionsPM"?: AdoIdentity;
        // Add other custom contact fields here as AdoIdentity or appropriate type
        [key: string]: any; // Allow other fields
    };
    // _links?: any; // For HATEOAS links if needed
    // url?: string; // Direct URL to the work item
}

// Assuming Feature also follows a similar nested structure from ADO API
// and might have similar identity fields
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
        "System.AssignedTo"?: AdoIdentity;
        "System.CreatedBy"?: AdoIdentity;
        "System.ChangedBy"?: AdoIdentity;
        [key: string]: any;
    };
}

export interface WorkItemQueryResult {
  id: number;
  title: string;
  state: string;
  type: string;
  adoUrl: string; // Direct URL to the item in ADO
  fields: { // For direct access if needed
    'System.Id': number;
    'System.Title': string;
    'System.State': string;
    'System.WorkItemType': string;
    // other fields if fetched
  };
}
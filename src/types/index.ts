export interface Epic {
    id: string;
    title: string;
    description: string;
    state: string;
    createdDate: Date;
    updatedDate: Date;
}

export interface Feature {
    id: string;
    title: string;
    description: string;
    state: string;
    epicId: string;
    createdDate: Date;
    updatedDate: Date;
}
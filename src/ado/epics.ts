import ADOApi from './api.js';
import { Epic } from '../types/index.js';

export class EpicsManager {
    constructor(private adoApi: ADOApi) {}

    async createEpic(epicData: Epic): Promise<Epic> {
        const response = await this.adoApi.post<Epic>('/epics', epicData);
        return response.data;
    }

    async updateEpic(epicId: string, epicData: Partial<Epic>): Promise<Epic> {
        const response = await this.adoApi.patch<Epic>(`/epics/${epicId}`, epicData);
        return response.data;
    }

    async deleteEpic(epicId: string): Promise<void> {
        await this.adoApi.delete(`/epics/${epicId}`);
    }

    async fetchEpics(): Promise<Epic[]> {
        const response = await this.adoApi.get<Epic[]>('/epics');
        return response.data;
    }

    async fetchEpicById(epicId: string): Promise<Epic> {
        const response = await this.adoApi.get<Epic>(`/epics/${epicId}`);
        return response.data;
    }
}
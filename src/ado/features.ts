import ADOApi from './api';
import { Feature } from '../types';

export class FeaturesManager {
    constructor(private adoApi: ADOApi) {}

    async createFeature(featureData: Feature): Promise<Feature> {
        const response = await this.adoApi.post<Feature>('/features', featureData);
        return response.data;
    }

    async updateFeature(featureId: string, featureData: Partial<Feature>): Promise<Feature> {
        const response = await this.adoApi.patch<Feature>(`/features/${featureId}`, featureData);
        return response.data;
    }

    async deleteFeature(featureId: string): Promise<void> {
        await this.adoApi.delete(`/features/${featureId}`);
    }

    async fetchFeatures(epicId: string): Promise<Feature[]> {
        const response = await this.adoApi.get<Feature[]>(`/epics/${epicId}/features`);
        return response.data;
    }
}
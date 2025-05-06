import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export default class ADOApi {
    private axiosInstance: AxiosInstance;

    constructor(baseUrl: string = '', personalAccessToken: string = '') {
        this.axiosInstance = axios.create({
            baseURL: baseUrl,
            headers: {
                'Authorization': personalAccessToken ? `Basic ${typeof btoa !== 'undefined' ? btoa(':' + personalAccessToken) : Buffer.from(':' + personalAccessToken).toString('base64')}` : '',
                'Content-Type': 'application/json',
            },
        });
    }

    public setBaseUrl(baseUrl: string) {
        this.axiosInstance.defaults.baseURL = baseUrl;
    }

    public setPersonalAccessToken(token: string) {
        this.axiosInstance.defaults.headers['Authorization'] = `Basic ${typeof btoa !== 'undefined' ? btoa(':' + token) : Buffer.from(':' + token).toString('base64')}`;
    }

    public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<{ data: T }> {
        return this.axiosInstance.get<T>(url, config);
    }

    public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<{ data: T }> {
        return this.axiosInstance.post<T>(url, data, config);
    }

    public async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<{ data: T }> {
        return this.axiosInstance.patch<T>(url, data, config);
    }

    public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<{ data: T }> {
        return this.axiosInstance.delete<T>(url, config);
    }
}
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
class ADOApi {
    constructor(baseUrl = '', personalAccessToken = '') {
        this.axiosInstance = axios_1.default.create({
            baseURL: baseUrl,
            headers: {
                'Authorization': personalAccessToken ? `Basic ${typeof btoa !== 'undefined' ? btoa(':' + personalAccessToken) : Buffer.from(':' + personalAccessToken).toString('base64')}` : '',
                'Content-Type': 'application/json',
            },
        });
    }
    setBaseUrl(baseUrl) {
        this.axiosInstance.defaults.baseURL = baseUrl;
    }
    setPersonalAccessToken(token) {
        this.axiosInstance.defaults.headers['Authorization'] = `Basic ${typeof btoa !== 'undefined' ? btoa(':' + token) : Buffer.from(':' + token).toString('base64')}`;
    }
    get(url, config) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.axiosInstance.get(url, config);
        });
    }
    post(url, data, config) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.axiosInstance.post(url, data, config);
        });
    }
    patch(url, data, config) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.axiosInstance.patch(url, data, config);
        });
    }
    delete(url, config) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.axiosInstance.delete(url, config);
        });
    }
}
exports.default = ADOApi;

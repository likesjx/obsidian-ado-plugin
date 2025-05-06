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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeaturesManager = void 0;
class FeaturesManager {
    constructor(adoApi) {
        this.adoApi = adoApi;
    }
    createFeature(featureData) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.adoApi.post('/features', featureData);
            return response.data;
        });
    }
    updateFeature(featureId, featureData) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.adoApi.patch(`/features/${featureId}`, featureData);
            return response.data;
        });
    }
    deleteFeature(featureId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.adoApi.delete(`/features/${featureId}`);
        });
    }
    fetchFeatures(epicId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.adoApi.get(`/epics/${epicId}/features`);
            return response.data;
        });
    }
}
exports.FeaturesManager = FeaturesManager;

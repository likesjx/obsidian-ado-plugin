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
exports.EpicsManager = void 0;
class EpicsManager {
    constructor(adoApi) {
        this.adoApi = adoApi;
    }
    createEpic(epicData) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.adoApi.post('/epics', epicData);
            return response.data;
        });
    }
    updateEpic(epicId, epicData) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.adoApi.patch(`/epics/${epicId}`, epicData);
            return response.data;
        });
    }
    deleteEpic(epicId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.adoApi.delete(`/epics/${epicId}`);
        });
    }
    fetchEpics() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.adoApi.get('/epics');
            return response.data;
        });
    }
}
exports.EpicsManager = EpicsManager;

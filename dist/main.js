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
const obsidian_1 = require("obsidian");
const api_1 = __importDefault(require("./ado/api"));
const epics_1 = require("./ado/epics");
const features_1 = require("./ado/features");
const settingsTab_1 = __importDefault(require("./ui/settingsTab"));
class ADOPlugin extends obsidian_1.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            this.adoApi = new api_1.default();
            this.epicsManager = new epics_1.EpicsManager(this.adoApi);
            this.featuresManager = new features_1.FeaturesManager(this.adoApi);
            this.addRibbonIcon('dice', 'Manage Epics', () => __awaiter(this, void 0, void 0, function* () {
                // Logic to manage epics
            }));
            this.addRibbonIcon('star', 'Manage Features', () => __awaiter(this, void 0, void 0, function* () {
                // Logic to manage features
            }));
            this.addSettingTab(new settingsTab_1.default(this.app, this));
        });
    }
    onunload() {
        // Cleanup logic if needed
    }
}
exports.default = ADOPlugin;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zwaveLockDevice_1 = __importDefault(require("../../lib/zwaveLockDevice"));
class DanalockV2 extends zwaveLockDevice_1.default {
    async onNodeInit() {
        await this._migrateSettings();
        await super.onNodeInit();
    }
    /**
     * Migrate the (very old) setting
     */
    async _migrateSettings() {
        const settingsMap = [
            { from: '1', to: 'direction' },
            { from: '2', to: 'speed' },
            { from: '6', to: 'sound' },
            { from: '8', to: 'battery_alarm' },
            { from: '9', to: 'turn_go' },
        ];
        const settingsObj = {};
        for (const { from, to } of settingsMap) {
            if (this.getSetting(from) !== null) {
                settingsObj[to] = this.getSetting(from);
                settingsObj[from] = null; // Reset legacy setting to prevent migration multiple times
            }
        }
        await this.setSettings(settingsObj)
            .catch(this.error);
    }
}
module.exports = DanalockV2;
//# sourceMappingURL=device.js.map
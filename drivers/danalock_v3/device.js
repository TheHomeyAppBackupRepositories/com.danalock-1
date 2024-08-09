"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zwaveLockDevice_1 = __importDefault(require("../../lib/zwaveLockDevice"));
class DanalockV3 extends zwaveLockDevice_1.default {
    async onNodeInit() {
        await this._migrateSettings();
        await super.onNodeInit();
    }
    /**
     * Migrate the (very old) setting
     */
    async _migrateSettings() {
        const settingsMap = [
            { from: '1', to: 'twist_assist' },
            { from: '2', to: 'hold_release' },
            { from: '3', to: 'lock_till_lock' },
            { from: '4', to: 'temp_allow_bluetooth' },
            { from: '5', to: 'always_allow_bluetooth' },
            { from: '6', to: 'auto_lock' },
        ];
        const settingsObj = {};
        for (const { from, to } of settingsMap) {
            if (this.getSetting(from) !== null) {
                settingsObj[to] = this.getSetting(from);
                settingsObj[from] = null; // Reset legacy setting to prevent migration multiple times
            }
        }
        await this.setSettings(settingsObj)
            .catch(error => {
            this.error('Error migrating settings', error);
        });
    }
}
module.exports = DanalockV3;
//# sourceMappingURL=device.js.map
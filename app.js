"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const source_map_support_1 = __importDefault(require("source-map-support"));
source_map_support_1.default.install();
const homey_log_1 = require("homey-log");
const homey_1 = __importDefault(require("homey"));
class DanalockApp extends homey_1.default.App {
    onInit() {
        this.homeyLog = new homey_log_1.Log({ homey: this.homey });
        this.log('Danalock has been initialized');
        // Register flows
        // Triggers are only assigned to a class variable to easier trigger them, done through another method
        this._lockTrigger = this.homey.flow.getDeviceTriggerCard('locked_true');
        this._unlockTrigger = this.homey.flow.getDeviceTriggerCard('locked_false');
        // PIN actions
        const setPINAction = this.homey.flow.getActionCard('setPin');
        setPINAction.registerRunListener(async (args) => {
            const newPin = args.pin.trim();
            this.log('Add pin with ID:', args.ID, 'and PIN:', newPin);
            if (newPin.length < 4 || newPin.length > 10 || isNaN(Number(newPin))) {
                throw new Error(`Pin should be 4-10 digits, ${newPin} given`);
            }
            await args.device.setPinCode(args.ID, newPin);
        });
        const deletePINAction = this.homey.flow.getActionCard('deletePin');
        deletePINAction.registerRunListener(async (args) => {
            this.log('Delete pin with ID:', args.ID);
            await args.device.deletePinCode(args.ID);
        });
        return Promise.resolve();
    }
    /** Set capability, then trigger with source token */
    async setAndTriggerLocked(device, locked, source) {
        await device.setCapabilityValue('locked', locked).catch(this.error);
        const trigger = locked ? this._lockTrigger : this._unlockTrigger;
        await trigger.trigger(device, { source: source }).catch(this.error);
    }
}
exports.default = DanalockApp;
module.exports = DanalockApp;
//# sourceMappingURL=app.js.map
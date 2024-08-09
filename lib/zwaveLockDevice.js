"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const homey_zwavedriver_1 = require("homey-zwavedriver");
const homey_1 = __importDefault(require("homey"));
const STORE_DANAPAD_DETECTED = 'danapad_detected';
class ZwaveLockDevice extends homey_zwavedriver_1.ZwaveDevice {
    constructor() {
        super(...arguments);
        this.danapadBatteryInterval = null;
    }
    async onNodeInit() {
        if (homey_1.default.env.DEBUG === true) {
            this.enableDebug();
        }
        this.registerCapability('locked', 'DOOR_LOCK');
        this.registerReportListener('NOTIFICATION', 'NOTIFICATION_REPORT', async (report) => {
            const notificationType = report['Notification Type'];
            const parsedEvent = report['Event (Parsed)'];
            if (report && notificationType === 'Access Control' && parsedEvent !== undefined) {
                let source, lockValue;
                switch (parsedEvent) {
                    // Lock was locked manually, automatically or via external controller
                    case 'Manual Lock Operation':
                        source = 'Manual';
                        lockValue = true;
                        break;
                    case 'RF Lock Operation':
                        source = 'Remote';
                        lockValue = true;
                        break;
                    case 'Auto Lock Locked Operation':
                        source = 'Auto-lock';
                        lockValue = true;
                        break;
                    case 'Keypad Lock Operation':
                        if (report.Properties1['Event Parameters Length'] === 0) {
                            source = 'Easy lock';
                        }
                        else {
                            source = 'Keypad, ID ' + (report['Event Parameter']?.readUInt8(2) ?? 'unknown');
                        }
                        lockValue = true;
                        break;
                    // Lock was unlocked manually or via external controller
                    case 'Manual Unlock Operation':
                        source = 'Manual';
                        lockValue = false;
                        break;
                    case 'RF Unlock Operation':
                        source = 'Remote';
                        lockValue = false;
                        break;
                    case 'Keypad Unlock Operation':
                        source = 'Keypad, ID ' + (report['Event Parameter']?.readUInt8(2) ?? 'unknown');
                        lockValue = false;
                        break;
                    // Lock is jammed, emit event
                    case 'Lock Jammed':
                        await this.lockJammed()
                            .catch(this.error);
                        return;
                    case 'Keypad temporary disabled':
                        // Ignore event
                        return;
                    default:
                        throw new Error('Unknown event ' + parsedEvent);
                }
                const app = this.homey.app;
                await app.setAndTriggerLocked(this, lockValue, source).catch(this.error);
            }
        });
        this.registerCapability('measure_battery', 'BATTERY', {
            getOpts: {
                getOnStart: true,
                pollInterval: 'battery_poll_interval',
                pollMultiplication: 60000, // to minutes
            },
        });
        const danapadDetected = this.getStoreValue(STORE_DANAPAD_DETECTED);
        if (danapadDetected === true) {
            await this.configureDanapadPolling();
            return;
        }
        else if (danapadDetected === false) {
            // Nothing to do
            return;
        }
        // Danapad battery
        this
            .configurationGet({ index: 7 })
            .then(async (danapadPresentResponse) => {
            this.log('Danapad present response', danapadPresentResponse);
            if (danapadPresentResponse
                && danapadPresentResponse['Configuration Value']
                && parseInt(danapadPresentResponse['Configuration Value'].toString('hex')) !== 0) {
                // There is a Danapad paired
                await this.setStoreValue(STORE_DANAPAD_DETECTED, true);
                await this.addCapabilityIfNotPresent('measure_battery.danapad');
                // Configure battery polling
                await this.configureDanapadPolling();
            }
            else {
                // Danapad cannot be added after pairing, so we can safely remove the capability
                await this.setStoreValue(STORE_DANAPAD_DETECTED, false);
                this.removeCapabilityIfPresent('measure_battery.danapad').catch(this.error);
            }
        })
            .catch((e) => {
            this.error('Failed to retrieve danapad status', e);
            // Still remove the capability
            this.removeCapabilityIfPresent('measure_battery.danapad').catch(this.error);
        });
    }
    async configureDanapadPolling() {
        this.danapadBatteryInterval = this.homey.setInterval(() => this.getDanapadBattery(), 1000 * 60 * 60 * 24 * 7);
        await this.getDanapadBattery().catch((e) => this.error('Failed to retrieve initial danapad battery status', e));
    }
    async getDanapadBattery() {
        // A couple of tries to get the battery
        let hasFailed = false;
        for (let i = 1; i < 10; i++) {
            hasFailed = false;
            this.log('Attempt to retrieve Danapad battery', i);
            // Await to prevent flood of commands to the device. If failed, it will be rescheduled.\
            try {
                const result = await this.configurationGet({ index: 8 });
                this.log('Danapad battery response', result);
                if (result['Configuration Value']) {
                    const batteryValue = parseInt(result['Configuration Value'].toString('hex'), 16);
                    this.setCapabilityValue('measure_battery.danapad', batteryValue)
                        .catch(() => this.error('Failed to set battery value', result['Configuration Value'], batteryValue));
                }
                else {
                    hasFailed = true;
                    this.error('Invalid Danapad battery response');
                }
            }
            catch (e) {
                hasFailed = true;
                this.error('Failed to retrieve Danapad battery value', e);
            }
            if (!hasFailed) {
                break;
            }
            // Schedule retry
            await new Promise(resolve => this.homey.setTimeout(() => resolve(true), i * 5000));
        }
    }
    async onNodeUninit() {
        if (this.danapadBatteryInterval) {
            this.homey.clearTimeout(this.danapadBatteryInterval);
        }
    }
    async lockJammed() {
        const triggerCard = this.homey.flow.getDeviceTriggerCard('lockJammed');
        await triggerCard.trigger(this);
        await this.setCapabilityValue('locked', false);
    }
    async setPinCode(ID, pin) {
        this.log(await this.getCommandClass('USER_CODE').USER_CODE_SET({
            'User Identifier': ID,
            'User ID Status': 'Occupied',
            USER_CODE: Buffer.from(pin),
        }).catch(this.error));
    }
    async deletePinCode(ID) {
        this.log(await this.getCommandClass('USER_CODE').USER_CODE_SET({
            'User Identifier': ID,
            'User ID Status': 'Available (not set)',
            USER_CODE: Buffer.from([0, 0, 0, 0]),
        }).catch(this.error));
    }
    async addCapabilityIfNotPresent(capability) {
        if (this.hasCapability(capability)) {
            return;
        }
        await this.addCapability(capability);
    }
    async removeCapabilityIfPresent(capability) {
        if (!this.hasCapability(capability)) {
            return;
        }
        await this.removeCapability(capability);
    }
    async onSettings({ oldSettings, newSettings, changedKeys }) {
        if (changedKeys.some(setting => setting === 'uiQuickAction')) {
            if ((this.homey.platform ?? 'local') === 'local' && (this.homey.platformVersion ?? 1) === 1) {
                throw new Error(this.homey.__('quick-action-unsupported'));
            }
            if (this.getCapabilityValue('locked') === false) {
                throw new Error(this.homey.__('quick-action-lock'));
            }
            this.log('Setting the quick action', newSettings.uiQuickAction);
            const capabilityOptions = this.getCapabilityOptions('locked');
            capabilityOptions.uiQuickAction = newSettings.uiQuickAction;
            await this.setCapabilityOptions('locked', capabilityOptions);
        }
        return super.onSettings({ oldSettings, newSettings, changedKeys });
    }
}
exports.default = ZwaveLockDevice;
module.exports = ZwaveLockDevice;
//# sourceMappingURL=zwaveLockDevice.js.map
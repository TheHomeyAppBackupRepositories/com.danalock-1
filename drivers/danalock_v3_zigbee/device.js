"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const homey_zigbeedriver_1 = require("homey-zigbeedriver");
const zigbee_clusters_1 = require("zigbee-clusters");
const danalockDoorLockCluster_1 = __importDefault(require("../../lib/danalockDoorLockCluster"));
const danalockPowerConfigurationCluster_1 = __importDefault(require("../../lib/danalockPowerConfigurationCluster"));
const danalockCluster_1 = __importDefault(require("../../lib/danalockCluster"));
const homey_1 = __importDefault(require("homey"));
const sourceMap = {
    0: 'Keypad',
    1: 'Remote',
    2: 'Manual',
};
const eventMap = {
    1: 'lock',
    2: 'unlock',
    7: 'easy_lock',
    10: 'auto_lock',
};
class DanalockZigbeeDevice extends homey_zigbeedriver_1.ZigBeeDevice {
    constructor() {
        super(...arguments);
        this.isSavingSettings = false;
        this.bluetoothTimeout = null;
        this.bluetoothInterval = 60; // The temporary bluetooth setting will be updated at interval seconds
    }
    async onNodeInit(payload) {
        const zclNode = payload.zclNode;
        if (homey_1.default.env.DEBUG === true) {
            this.enableDebug();
            (0, zigbee_clusters_1.debug)();
        }
        this.debug('DanalockZigbeeDevice onNodeInit');
        await this.addCapabilityIfNotPresent('measure_battery.danapad');
        await this.initSettings(zclNode).catch(this.error);
        await this.initCapabilities().catch(this.error);
        await this.initEvents(zclNode).catch(this.error);
    }
    async initSettings(zclNode) {
        let endpoint = this.getClusterEndpoint(danalockDoorLockCluster_1.default);
        if (!endpoint) {
            this.error('Cluster endpoint not found!');
            return;
        }
        const manufacturerSettings = await zclNode.endpoints[endpoint].clusters[danalockDoorLockCluster_1.default.NAME].readAttributes(['endToEnd', 'holdBackLatch']).catch(this.error);
        await this.copySettingsFromDevice(manufacturerSettings).catch(this.error);
        const deviceSettings = await zclNode.endpoints[endpoint].clusters[danalockDoorLockCluster_1.default.NAME].readAttributes(['autoRelock', 'enableOneTouchLocking']).catch(this.error);
        await this.copySettingsFromDevice(deviceSettings).catch(this.error);
        endpoint = this.getClusterEndpoint(danalockCluster_1.default);
        if (!endpoint) {
            this.error('Cluster endpoint not found!');
            return;
        }
        /*const danalockSettings = await zclNode.endpoints[endpoint].clusters[DanalockCluster.NAME].readAttributes(['bluetoothOnHostEnable']).catch(this.error);
        await this.copySettingsFromDevice(danalockSettings).catch(this.error);*/
    }
    async initCapabilities() {
        this.registerCapability('locked', danalockDoorLockCluster_1.default, {
            get: 'lockState',
            report: 'lockState',
            set: (value) => (value ? 'lock' : 'unlock'),
            setParser: () => { return {}; },
            getOpts: {
                getOnStart: true,
                getOnOnline: true,
            },
            reportParser: reportValue => reportValue === 'LOCKED',
            reportOpts: {
                configureAttributeReporting: {
                    minChange: 0,
                    minInterval: 0,
                    maxInterval: 6000,
                },
            },
        });
        if (this.getStoreValue('lockStateReportingConfigured') === null && !this.isFirstInit()) {
            await this.configureAttributeReporting([{
                    cluster: danalockDoorLockCluster_1.default,
                    endpointId: this.getClusterEndpoint(danalockDoorLockCluster_1.default) ?? undefined,
                    attributeName: 'lockState',
                    minChange: 0,
                    minInterval: 0,
                    maxInterval: 6000,
                }]);
            this.setStoreValue('lockStateReportingConfigured', true).catch(this.error);
        }
        else if (this.isFirstInit()) {
            this.setStoreValue('lockStateReportingConfigured', true).catch(this.error);
        }
        this.doorlockCluster
            .readAttributes(['lockState'])
            .then(lockValues => this.setCapabilityValue('locked', lockValues.lockState === 'LOCKED').catch(this.error))
            .catch(this.error);
        this.registerCapability('measure_battery', danalockPowerConfigurationCluster_1.default);
        this.registerCapability('measure_battery.danapad', danalockPowerConfigurationCluster_1.default, {
            get: 'battery2PercentageRemaining',
            report: 'battery2PercentageRemaining',
            getOpts: {
                getOnStart: true,
                getOnOnline: true,
            },
            reportParser(value) {
                // Max value 200, 255 indicates invalid or unknown reading
                if (value <= 200 && value !== 255) {
                    return Math.round(value / 2);
                }
                return null;
            },
        });
    }
    async onSettings({ newSettings, changedKeys }) {
        this.debug('DanalockZigbeeDevice settings were changed');
        if (this.zclNode === undefined || this.zclNode === null) {
            throw new Error('Could not save settings, try again later.');
        }
        this.isSavingSettings = true;
        const newManufacturerSettings = {};
        const newLockSettings = {};
        let newCapabilityOptions = {};
        //let bluetoothSeconds: number;
        for (const changedKey of changedKeys) {
            switch (changedKey) {
                case 'lock_till_lock':
                    newManufacturerSettings.endToEnd = newSettings.lock_till_lock;
                    break;
                case 'hold_release':
                    newManufacturerSettings.holdBackLatch = newSettings.hold_release;
                    break;
                case 'auto_lock':
                    newLockSettings.autoRelock = newSettings.auto_lock;
                    break;
                case 'easy_lock':
                    newLockSettings.enableOneTouchLocking = newSettings.easy_lock;
                    break;
                case 'uiQuickAction':
                    if ((this.homey.platform ?? 'local') === 'local' && (this.homey.platformVersion ?? 1) === 1) {
                        throw new Error(this.homey.__('quick-action-unsupported'));
                    }
                    if (this.getCapabilityValue('locked') === false) {
                        throw new Error(this.homey.__('quick-action-lock'));
                    }
                    this.log('Setting the quick action', newSettings.uiQuickAction);
                    newCapabilityOptions = this.getCapabilityOptions('locked');
                    newCapabilityOptions.uiQuickAction = newSettings.uiQuickAction;
                    await this.setCapabilityOptions('locked', newCapabilityOptions);
                    break;
                /*case 'temp_allow_bluetooth':
                  // Always allow bluetooth has precedence over this setting
                  if (newSettings.always_allow_bluetooth !== false) {
                    if (newSettings.always_allow_bluetooth === true || this.getSetting('always_allow_bluetooth') === true) {
                      this.homey.setTimeout(async () => await this.setSettings({ // Use nextTick to fix conflict with onSettings
                        temp_allow_bluetooth: 0,
                      }).catch(this.error), 500);
                      break;
                    }
                  }
                  bluetoothSeconds = newSettings.temp_allow_bluetooth;
                  await this.setBluetoothEnabled(bluetoothSeconds !== 0);
                  if (bluetoothSeconds !== 0) {
                    if (bluetoothSeconds > this.bluetoothInterval) { // Update setting every interval seconds
                      this.bluetoothTimeout = this.homey.setTimeout(async () => await this.onBluetoothTimeout(), this.bluetoothInterval * 1000);
                    } else { // If less than 60 seconds, simply continue
                      this.bluetoothTimeout = this.homey.setTimeout(async () => {
                        await this.setBluetoothEnabled(false);
                        await this.cleanupTempBluetooth();
                      }, bluetoothSeconds * 1000);
                    }
                  }
                  break;
                case 'always_allow_bluetooth':
                  if (newSettings.always_allow_bluetooth === false && this.bluetoothTimeout === null) {
                    await this.setBluetoothEnabled(false);
                  } else if (newSettings.always_allow_bluetooth === true) {
                    await this.setBluetoothEnabled(true);
                    await this.cleanupTempBluetooth();
                  }
                  break;*/
                default:
                    break;
            }
        }
        await this.writeSettings(newManufacturerSettings, danalockDoorLockCluster_1.default).catch(this.error);
        await this.writeSettings(newLockSettings, danalockDoorLockCluster_1.default).catch(this.error);
        this.isSavingSettings = false;
    }
    /*private async onBluetoothTimeout(): Promise<void> {
      const remainingSeconds = this.getSetting('temp_allow_bluetooth') - this.bluetoothInterval;
      await this.setSettings({
        temp_allow_bluetooth: remainingSeconds,
      });
      if (remainingSeconds > this.bluetoothInterval) {
        this.log('Rescheduling Bluetooth timeout, remaining seconds', remainingSeconds);
        this.bluetoothTimeout = this.homey.setTimeout(async () => await this.onBluetoothTimeout(), this.bluetoothInterval * 1000);
      } else {
        this.log('Bluetooth will be turned off in', remainingSeconds);
        this.bluetoothTimeout = this.homey.setTimeout(async () => {
          await this.setBluetoothEnabled(false);
          await this.cleanupTempBluetooth();
        }, remainingSeconds * 1000);
      }
    }*/
    /*private async setBluetoothEnabled(enabled: boolean): Promise<void> {
      this.log('Setting bluetooth to', enabled);
      await this.writeSettings({
        bluetoothOnHostEnable: enabled,
      }, DanalockCluster).catch(this.error);
    }*/
    async writeSettings(newManufacturerSettings, cluster) {
        if (Object.keys(newManufacturerSettings).length > 0) {
            this.debug('Parsed write settings to device', newManufacturerSettings);
            const endpoint = this.getClusterEndpoint(cluster);
            if (!endpoint) {
                this.error('Cluster endpoint not found!');
                return;
            }
            await this.zclNode
                .endpoints[endpoint]
                .clusters[cluster.NAME]
                .writeAttributes(newManufacturerSettings).catch(this.error);
        }
    }
    async copySettingsFromDevice(deviceSettings) {
        if (this.isSavingSettings) {
            return;
        }
        this.debug('Copy settings from device', deviceSettings);
        const homeySettings = {};
        if (deviceSettings.holdBackLatch != null) {
            homeySettings.hold_release = deviceSettings.holdBackLatch;
        }
        if (deviceSettings.endToEnd != null) {
            homeySettings.lock_till_lock = deviceSettings.endToEnd;
        }
        if (deviceSettings.autoRelock != null) {
            homeySettings.auto_lock = deviceSettings.autoRelock;
        }
        if (deviceSettings.enableOneTouchLocking != null) {
            homeySettings.easy_lock = deviceSettings.enableOneTouchLocking;
        }
        /*if (deviceSettings.bluetoothOnHostEnable != null) {
          homeySettings.always_allow_bluetooth = deviceSettings.bluetoothOnHostEnable;
          homeySettings.temp_allow_bluetooth = 0; // Reset the temporary enable, as the app was restarted
        }*/
        if (Object.keys(homeySettings).length > 0) {
            this.debug('Parsed copy settings from device', homeySettings);
            await this.setSettings(homeySettings).catch(this.error);
        }
    }
    async initEvents(zclNode) {
        const endpoint = this.getClusterEndpoint(danalockDoorLockCluster_1.default);
        if (!endpoint) {
            this.error('Cluster endpoint not found!');
            return;
        }
        zclNode.endpoints[endpoint].clusters[danalockDoorLockCluster_1.default.NAME]
            .on('commands.event', (event) => {
            const eventName = eventMap[event.code];
            const isLocked = eventName !== 'unlock';
            let source = sourceMap[event.source];
            if (source === 'Keypad') {
                source = source + ', ID ' + event.userId;
            }
            if (eventName === 'easy_lock') {
                source = 'Easy lock';
            }
            if (eventName === 'auto_lock') {
                source = 'Auto-lock';
            }
            const app = this.homey.app;
            app.setAndTriggerLocked(this, isLocked, source);
        });
    }
    async onNodeUninit() {
        if (this.bluetoothTimeout) {
            //await this.cleanupTempBluetooth();
            //await this.setBluetoothEnabled(false); // Also disable Bluetooth when the app is closed
        }
    }
    /*private async cleanupTempBluetooth(): Promise<void> {
      this.log('Cleaning up temporary enabled Bluetooth');
      if (this.bluetoothTimeout) {
        this.homey.clearTimeout(this.bluetoothTimeout);
      }
      setImmediate(async () => await this.setSettings({temp_allow_bluetooth: 0}).catch(this.error)); // Use immediate to prevent conflict during onSettings
    }*/
    async setPinCode(ID, pin) {
        await this.doorlockCluster
            .setPinCode({
            userId: ID,
            userStatus: "OCCUPIED",
            userType: "UNRESTRICTED",
            pin: Buffer.from(pin),
        }).catch(this.error);
    }
    async deletePinCode(ID) {
        await this.doorlockCluster
            .clearPinCode({
            userId: ID,
        }).catch(this.error);
    }
    get doorlockCluster() {
        return this.zclNode
            .endpoints[this.getClusterEndpoint(danalockDoorLockCluster_1.default) ?? 1]
            .clusters[danalockDoorLockCluster_1.default.NAME];
    }
    async addCapabilityIfNotPresent(capability) {
        if (!this.hasCapability(capability)) {
            await this.addCapability(capability);
        }
    }
}
module.exports = DanalockZigbeeDevice;
//# sourceMappingURL=device.js.map
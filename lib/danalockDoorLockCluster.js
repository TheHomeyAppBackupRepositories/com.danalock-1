"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zigbee_clusters_1 = require("zigbee-clusters");
const ATTRIBUTES = {
    lockState: {
        id: 0x000,
        type: zigbee_clusters_1.ZCLDataTypes.enum8({
            LOCKED: 0x01,
            UNLOCKED: 0x02
        }),
    },
    autoRelock: {
        id: 0x0023,
        type: zigbee_clusters_1.ZCLDataTypes.uint32
    },
    enableOneTouchLocking: {
        id: 0x0029,
        type: zigbee_clusters_1.ZCLDataTypes.bool,
    },
    endToEnd: {
        id: 0x0001,
        type: zigbee_clusters_1.ZCLDataTypes.bool,
        manufacturerId: 0x115c,
    },
    holdBackLatch: {
        id: 0x0002,
        type: zigbee_clusters_1.ZCLDataTypes.uint32,
        manufacturerId: 0x115c,
    },
};
const userStatusType = {
    OCCUPIED: 0x01,
};
const userTypeType = {
    UNRESTRICTED: 0x00,
};
const COMMANDS = {
    lock: {
        id: 0,
    },
    unlock: {
        id: 1,
    },
    setPinCode: {
        id: 0x05,
        args: {
            userId: zigbee_clusters_1.ZCLDataTypes.uint16,
            userStatus: zigbee_clusters_1.ZCLDataTypes.enum8(userStatusType),
            userType: zigbee_clusters_1.ZCLDataTypes.enum8(userTypeType),
            pin: zigbee_clusters_1.ZCLDataTypes.octstr,
        },
    },
    clearPinCode: {
        id: 0x07,
        args: {
            userId: zigbee_clusters_1.ZCLDataTypes.uint16,
        },
    },
    clearAllPinCodes: {
        id: 0x08
    },
    event: {
        id: 0x20,
        args: {
            source: zigbee_clusters_1.ZCLDataTypes.uint8,
            code: zigbee_clusters_1.ZCLDataTypes.uint8,
            userId: zigbee_clusters_1.ZCLDataTypes.uint16
        }
    }
};
class DanalockDoorLockCluster extends zigbee_clusters_1.Cluster {
    static get ID() {
        return 257;
    }
    static get NAME() {
        return 'doorLock';
    }
    static get ATTRIBUTES() {
        return ATTRIBUTES;
    }
    static get COMMANDS() {
        return COMMANDS;
    }
    /**
    * Normally you would implement a BoundCluster for receiving COMMAND's from the doorlock
    * However somehow our BoundCluster got ignored and "events" got received in the normal Cluster.
    * Maybe this is because a Cluster & BoundCluster aren't normally supposed to be used together for the same Cluster ID?
    */
    onEvent(args, meta, frame, rawFrame) {
        this.emit('commands.event', args);
    }
}
exports.default = DanalockDoorLockCluster;
zigbee_clusters_1.Cluster.addCluster(DanalockDoorLockCluster);
module.exports = DanalockDoorLockCluster;
//# sourceMappingURL=danalockDoorLockCluster.js.map
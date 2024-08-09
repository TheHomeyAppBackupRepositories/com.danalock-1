"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zigbee_clusters_1 = require("zigbee-clusters");
const ATTRIBUTES = {
    bluetoothOnHostEnable: {
        id: 0x0007,
        type: zigbee_clusters_1.ZCLDataTypes.bool,
        manufacturerId: 0x115c,
    },
};
const COMMANDS = {};
class DanalockCluster extends zigbee_clusters_1.Cluster {
    static get ID() {
        return 0xFCFF;
    }
    static get NAME() {
        return 'danalock';
    }
    static get ATTRIBUTES() {
        return ATTRIBUTES;
    }
    static get COMMANDS() {
        return COMMANDS;
    }
}
exports.default = DanalockCluster;
zigbee_clusters_1.Cluster.addCluster(DanalockCluster);
module.exports = DanalockCluster;
//# sourceMappingURL=danalockCluster.js.map
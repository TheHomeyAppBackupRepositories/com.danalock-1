"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zigbee_clusters_1 = require("zigbee-clusters");
class DanalockPowerConfigurationCluster extends zigbee_clusters_1.PowerConfigurationCluster {
    static get ATTRIBUTES() {
        return {
            ...super.ATTRIBUTES,
            battery2PercentageRemaining: { id: 0x41, type: zigbee_clusters_1.ZCLDataTypes.uint8 },
        };
    }
}
exports.default = DanalockPowerConfigurationCluster;
zigbee_clusters_1.Cluster.addCluster(DanalockPowerConfigurationCluster);
module.exports = DanalockPowerConfigurationCluster;
//# sourceMappingURL=danalockPowerConfigurationCluster.js.map
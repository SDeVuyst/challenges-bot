"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const floorTier_1 = require("../src/scoring/floorTier");
(0, node_test_1.describe)("validateGoalTiers", () => {
    (0, node_test_1.it)("accepts ascending thresholds for higher-is-better", () => {
        const tiers = [1, 2, 3, 4, 5].map((tier) => ({ tier, threshold: tier * 2 }));
        (0, node_test_1.expect)((0, floorTier_1.validateGoalTiers)(tiers, "higher")).toBeNull();
    });
    (0, node_test_1.it)("rejects non-monotonic higher thresholds", () => {
        const tiers = [
            { tier: 1, threshold: 1 },
            { tier: 2, threshold: 5 },
            { tier: 3, threshold: 3 },
            { tier: 4, threshold: 8 },
            { tier: 5, threshold: 10 },
        ];
        (0, node_test_1.expect)((0, floorTier_1.validateGoalTiers)(tiers, "higher")).toMatch(/increase/);
    });
    (0, node_test_1.it)("accepts descending thresholds for lower-is-better", () => {
        const tiers = [1, 2, 3, 4, 5].map((tier) => ({
            tier,
            threshold: 30 - tier * 2,
        }));
        (0, node_test_1.expect)((0, floorTier_1.validateGoalTiers)(tiers, "lower")).toBeNull();
    });
});
(0, node_test_1.describe)("calculateFloorTierPoints", () => {
    const higherTiers = [
        { tier: 1, threshold: 1 },
        { tier: 2, threshold: 3 },
        { tier: 3, threshold: 5 },
        { tier: 4, threshold: 8 },
        { tier: 5, threshold: 10 },
    ];
    (0, node_test_1.it)("floors to highest achieved tier for higher-is-better", () => {
        (0, node_test_1.expect)((0, floorTier_1.calculateFloorTierPoints)(6, higherTiers, "higher")).toBe(3);
        (0, node_test_1.expect)((0, floorTier_1.calculateFloorTierPoints)(10, higherTiers, "higher")).toBe(5);
        (0, node_test_1.expect)((0, floorTier_1.calculateFloorTierPoints)(0, higherTiers, "higher")).toBe(0);
    });
    const lowerTiers = [
        { tier: 1, threshold: 30 },
        { tier: 2, threshold: 27 },
        { tier: 3, threshold: 24 },
        { tier: 4, threshold: 22 },
        { tier: 5, threshold: 20 },
    ];
    (0, node_test_1.it)("floors to highest achieved tier for lower-is-better", () => {
        (0, node_test_1.expect)((0, floorTier_1.calculateFloorTierPoints)(25, lowerTiers, "lower")).toBe(2);
        (0, node_test_1.expect)((0, floorTier_1.calculateFloorTierPoints)(20, lowerTiers, "lower")).toBe(5);
        (0, node_test_1.expect)((0, floorTier_1.calculateFloorTierPoints)(35, lowerTiers, "lower")).toBe(0);
    });
});
//# sourceMappingURL=floorTier.test.js.map
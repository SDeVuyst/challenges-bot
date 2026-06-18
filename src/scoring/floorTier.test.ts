import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateFloorTierPoints, validateGoalTiers } from "./floorTier";

describe("validateGoalTiers", () => {
  it("accepts ascending thresholds for higher-is-better", () => {
    const tiers = [1, 2, 3, 4, 5].map((tier) => ({ tier, threshold: tier * 2 }));
    assert.equal(validateGoalTiers(tiers, "higher"), null);
  });

  it("rejects non-monotonic higher thresholds", () => {
    const tiers = [
      { tier: 1, threshold: 1 },
      { tier: 2, threshold: 5 },
      { tier: 3, threshold: 3 },
      { tier: 4, threshold: 8 },
      { tier: 5, threshold: 10 },
    ];
    assert.match(validateGoalTiers(tiers, "higher") ?? "", /increase/);
  });

  it("accepts descending thresholds for lower-is-better", () => {
    const tiers = [1, 2, 3, 4, 5].map((tier) => ({
      tier,
      threshold: 30 - tier * 2,
    }));
    assert.equal(validateGoalTiers(tiers, "lower"), null);
  });
});

describe("calculateFloorTierPoints", () => {
  const higherTiers = [
    { tier: 1, threshold: 1 },
    { tier: 2, threshold: 3 },
    { tier: 3, threshold: 5 },
    { tier: 4, threshold: 8 },
    { tier: 5, threshold: 10 },
  ];

  it("floors to highest achieved tier for higher-is-better", () => {
    assert.equal(calculateFloorTierPoints(6, higherTiers, "higher"), 3);
    assert.equal(calculateFloorTierPoints(10, higherTiers, "higher"), 5);
    assert.equal(calculateFloorTierPoints(0, higherTiers, "higher"), 0);
  });

  const lowerTiers = [
    { tier: 1, threshold: 30 },
    { tier: 2, threshold: 27 },
    { tier: 3, threshold: 24 },
    { tier: 4, threshold: 22 },
    { tier: 5, threshold: 20 },
  ];

  it("floors to highest achieved tier for lower-is-better", () => {
    assert.equal(calculateFloorTierPoints(25, lowerTiers, "lower"), 2);
    assert.equal(calculateFloorTierPoints(20, lowerTiers, "lower"), 5);
    assert.equal(calculateFloorTierPoints(35, lowerTiers, "lower"), 0);
  });
});

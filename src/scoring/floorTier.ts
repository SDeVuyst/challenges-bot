import type { ExerciseDirection } from "../db/queries";

export interface TierThreshold {
  tier: number;
  threshold: number;
}

export function validateGoalTiers(
  tiers: TierThreshold[],
  direction: ExerciseDirection
): string | null {
  if (tiers.length !== 5) {
    return "All 5 tiers (1–5) must be provided.";
  }

  const sorted = [...tiers].sort((a, b) => a.tier - b.tier);
  const tierNumbers = sorted.map((t) => t.tier);
  const expected = [1, 2, 3, 4, 5];
  if (tierNumbers.some((t, i) => t !== expected[i])) {
    return "Tiers must be exactly 1, 2, 3, 4, and 5.";
  }

  for (const { tier, threshold } of sorted) {
    if (!Number.isFinite(threshold)) {
      return `Tier ${tier} threshold must be a valid number.`;
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].threshold;
    const curr = sorted[i].threshold;
    if (direction === "higher" && curr <= prev) {
      return "For higher-is-better exercises, thresholds must increase from tier 1 to tier 5.";
    }
    if (direction === "lower" && curr >= prev) {
      return "For lower-is-better exercises, thresholds must decrease from tier 1 to tier 5.";
    }
  }

  return null;
}

export function calculateFloorTierPoints(
  value: number,
  tiers: TierThreshold[],
  direction: ExerciseDirection
): number {
  const sorted = [...tiers].sort((a, b) => a.tier - b.tier);
  let points = 0;

  for (const { tier, threshold } of sorted) {
    const achieved =
      direction === "higher" ? value >= threshold : value <= threshold;
    if (achieved) {
      points = tier;
    }
  }

  return points;
}

export function parseThreshold(value: string): number | null {
  const parsed = parseFloat(value.trim());
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

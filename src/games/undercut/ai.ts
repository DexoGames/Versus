import type { Difficulty } from "../types";
import { bidRange } from "./engine";
import type { UndercutState } from "./types";

/**
 * CPU bidders, ported from UndercutComputerController.MakeMove and extended
 * with light opponent modelling on Hard/Extreme. Undercut is a mixed-strategy
 * game, so every tier stays randomised — just with different shading.
 */

function randInt(min: number, maxInclusive: number): number {
  return min + Math.floor(Math.random() * (maxInclusive - min + 1));
}

export function chooseUndercutBid(
  state: UndercutState,
  player: number,
  difficulty: Difficulty,
): number {
  const [min, max] = bidRange(state, player);

  // Easy: uniform across the allowed range.
  if (difficulty <= 1) return randInt(min, max);

  // Medium: Unity's min-biased pick — one extra ticket for the low end.
  if (difficulty === 2) {
    const rand = randInt(min - 1, max);
    return Math.max(rand, min);
  }

  // Hard/Extreme: Unity's low-shaded pick (stays out of the high numbers —
  // in the 1–10 game the value still lives low, the top is a trap), plus, on
  // Extreme, a read on opponents: if someone predictably sits on a number,
  // aim to undercut where their expected bid lands.
  const shaded = () => {
    const upper = Math.max(Math.min(max, 6), min);
    let rand = randInt(min - 2, upper);
    if (rand < min) rand += 2;
    return Math.min(Math.max(rand, min), max);
  };

  if (difficulty === 3) return shaded();

  // Extreme: 40% of the time, model each opponent's likely bid from their
  // last one (they can only move ±1) and try to land exactly one above the
  // lowest expected opponent bid — the steal spot.
  if (Math.random() < 0.4 && state.history.length > 0) {
    let lowestExpected = Infinity;
    for (let i = 0; i < state.lastBids.length; i++) {
      if (i === player) continue;
      const theirLast = state.lastBids[i];
      if (theirLast > 0) lowestExpected = Math.min(lowestExpected, theirLast);
    }
    if (Number.isFinite(lowestExpected)) {
      const target = lowestExpected + 1;
      if (target >= min && target <= max) return target;
      // Can't reach the steal spot — drift toward it.
      if (target < min) return min;
      return max;
    }
  }
  return shaded();
}

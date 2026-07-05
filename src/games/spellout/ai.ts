import type { Difficulty } from "../types";
import type { Dictionary } from "./dictionary";
import type { SpelloutState } from "./types";

/**
 * Spellout CPU tiers, reimplemented from SpelloutComputerController:
 *  1 Easy    — "Isaac": shallow lookahead, big randomness, hates obscure words
 *              enough to sometimes blunder into a dead letter (authentic jank).
 *  2 Medium  — "Bob": depth scales with the fragment, moderate noise.
 *  3 Hard    — same engine as Bob with tighter noise and a softer obscure-word
 *              penalty, so it happily ends games on weird words.
 *  4 Extreme — "Dexter": deep minimax over the prefix tree (near-solve).
 *              (The minimax assumes two seats; in a 3-player game it still
 *              plays strong, safe letters — just without exact parity.)
 *
 * The heuristic evaluator mirrors the Unity recurrence: a completed common
 * word scores +1, a completed obscure word -penalty, a dead prefix -1, and
 * interior nodes score the negated sum of child evaluations weighted by how
 * many dictionary words flow through each child letter.
 */

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

function heuristicEvaluate(
  dict: Dictionary,
  prefix: string,
  depth: number,
  uncommonPenalty: number,
  memo: Map<string, number>,
): number {
  if (depth <= 0) return 0;

  const key = prefix + "|" + depth;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;

  const [lo, hi] = dict.range(prefix);
  if (hi - lo === 0) return -1;

  // The exact word sorts first in its own prefix range, so Unity's loop hits
  // it before recursing anywhere — replicate that early return.
  if (dict.words[lo] === prefix) {
    const value = dict.isCommon(prefix) ? 1 : -uncommonPenalty;
    memo.set(key, value);
    return value;
  }

  let score = 0;
  for (const { letter, count } of dict.letterCounts(prefix)) {
    score -= count * heuristicEvaluate(dict, prefix + letter, depth - 1, uncommonPenalty, memo);
  }
  memo.set(key, score);
  return score;
}

/** Isaac (Easy): fixed shallow depth, wide noise, harsh obscure-word penalty. */
function chooseIsaac(dict: Dictionary, fragment: string): string {
  const depth = fragment.length < 2 ? 1 : 2;
  return bestByScore(dict, fragment, depth, 3, 2);
}

/** Bob (Medium/Hard): depth follows fragment length, doubling past 3 letters. */
function chooseBob(
  dict: Dictionary,
  fragment: string,
  rand: number,
  uncommonPenalty: number,
): string {
  let depth = fragment.length;
  if (fragment.length > 3) depth *= 2;
  return bestByScore(dict, fragment, depth, uncommonPenalty, rand);
}

function bestByScore(
  dict: Dictionary,
  fragment: string,
  depth: number,
  uncommonPenalty: number,
  rand: number,
): string {
  const memo = new Map<string, number>();
  let bestLetter = "a";
  let bestScore = -Infinity;
  for (const letter of ALPHABET) {
    // Faithful to Unity: dead letters score -1 (not -Infinity), so with big
    // enough noise the easy tiers can genuinely misspell.
    const score =
      heuristicEvaluate(dict, fragment + letter, depth, uncommonPenalty, memo) +
      Math.random() * rand;
    if (score > bestScore) {
      bestScore = score;
      bestLetter = letter;
    }
  }
  return bestLetter;
}

/**
 * Dexter (Extreme): SpelloutComputer.ComputerBob — minimax over the prefix
 * tree. A position where the fragment is the last word standing scores +1 if
 * the CPU landed it, -1 if the opponent did; parity alternates each ply.
 */
function expertEvaluate(
  dict: Dictionary,
  prefix: string,
  turn: number,
  depth: number,
  memo: Map<string, number>,
): number {
  const key = prefix + "|" + turn + "|" + depth;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;

  const [lo, hi] = dict.range(prefix);
  if (hi - lo === 1 && dict.words[lo] === prefix) {
    const value = turn === 0 ? 1 : -1;
    memo.set(key, value);
    return value;
  }

  const nextTurn = (turn + 1) % 2;
  if (depth <= 0) return 0;

  let eval_ = nextTurn === 0 ? -Infinity : Infinity;
  for (const { letter } of dict.letterCounts(prefix)) {
    const child = expertEvaluate(dict, prefix + letter, nextTurn, depth - 1, memo);
    eval_ = nextTurn === 0 ? Math.max(eval_, child) : Math.min(eval_, child);
  }
  memo.set(key, eval_);
  return eval_;
}

function chooseExpert(dict: Dictionary, fragment: string): string {
  const maxDepth = fragment.length < 1 ? 4 : 12;
  const memo = new Map<string, number>();
  let bestLetter: string | null = null;
  let bestScore = -Infinity;
  for (const { letter } of dict.letterCounts(fragment)) {
    const score =
      expertEvaluate(dict, fragment + letter, 0, maxDepth, memo) +
      Math.random() * 1.05;
    if (score > bestScore) {
      bestScore = score;
      bestLetter = letter;
    }
  }
  // Only dead letters available would mean the fragment itself is dead —
  // can't happen mid-game, but fall back safely.
  return bestLetter ?? "a";
}

export function chooseSpelloutLetter(
  dict: Dictionary,
  state: SpelloutState,
  difficulty: Difficulty,
): string {
  const fragment = state.fragment;
  switch (difficulty) {
    case 1:
      return chooseIsaac(dict, fragment);
    case 2:
      return chooseBob(dict, fragment, 1.4, 1.2);
    case 3:
      return chooseBob(dict, fragment, 1.2, 0.6);
    case 4:
      return chooseExpert(dict, fragment);
  }
}

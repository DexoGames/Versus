import type { Difficulty } from "../types";
import {
  applySimMove,
  buildSim,
  movesForPlayer,
  undoSimMove,
  type Sim,
} from "./sim";
import type { GridlockState, Point } from "./types";

/**
 * Gridlock CPU: alpha-beta over the shared sim, reimplemented from
 * GridlockDexterComputer4 with its quirks straightened out:
 *  - depth by difficulty (4 / 6 / 10 / 14, from DifficultyToDepth);
 *  - root-move jitter that shrinks as difficulty rises
 *    (randomRange = (64 − difficulty³)·0.1 + 0.02), so Easy wanders and
 *    Extreme is surgical;
 *  - reduced depth in the early game while chains are short;
 *  - paranoid max-n for 3–4 players: maximise on the CPU's turns, treat every
 *    other player as minimising the CPU;
 *  - evaluation = myArea − Σ otherAreas, plus a small consolidation bonus for
 *    fewer, larger territories (averageSize / 3); terminal win/loss ±100000.
 *
 * A node budget keeps worst-case think time bounded in the browser.
 */

const NODE_BUDGET = 350_000;

function difficultyToDepth(difficulty: Difficulty): number {
  switch (difficulty) {
    case 1: return 4;
    case 2: return 6;
    case 3: return 10;
    case 4: return 14;
  }
}

interface SearchCtx {
  sim: Sim;
  aiPlayer: number;
  nodes: number;
}

function evaluate(ctx: SearchCtx): number {
  const { sim, aiPlayer } = ctx;
  let others = 0;
  for (let i = 0; i < sim.pc; i++) {
    if (i !== aiPlayer) others += sim.scores[i];
  }
  let eval_ = sim.scores[aiPlayer] - others;
  const myRegions = sim.regionCounts[aiPlayer];
  if (myRegions > 0) {
    eval_ += sim.scores[aiPlayer] / myRegions / 3;
  }
  return eval_;
}

function terminalValue(ctx: SearchCtx): number {
  const { sim, aiPlayer } = ctx;
  if (sim.winners.length === 1) {
    return sim.winners[0] === aiPlayer ? 100_000 : -100_000;
  }
  // Draw (or shared frozen win): neutral-ish, better than losing.
  return sim.winners.includes(aiPlayer) ? 0 : -50_000;
}

function search(ctx: SearchCtx, depth: number, alpha: number, beta: number): number {
  const { sim } = ctx;
  if (sim.over) return terminalValue(ctx);
  if (depth <= 0 || ctx.nodes >= NODE_BUDGET) return evaluate(ctx);

  const maximizing = sim.currentPlayer === ctx.aiPlayer;
  const moves = movesForPlayer(sim, sim.currentPlayer);
  // applySimMove's advance guarantees the current player can move while the
  // game is live, so an empty list here can't happen; guard anyway.
  if (moves.length === 0) return evaluate(ctx);

  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    ctx.nodes++;
    const undo = applySimMove(sim, move);
    const value = search(ctx, depth - 1, alpha, beta);
    undoSimMove(sim, undo);

    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, value);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, value);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseGridlockMove(
  state: GridlockState,
  player: number,
  difficulty: Difficulty,
): Point {
  const sim = buildSim(state);
  const baseDepth = difficultyToDepth(difficulty);
  const randomRange = (64 - Math.pow(difficulty, 3)) * 0.1 + 0.02;

  const moves = movesForPlayer(sim, player);
  if (moves.length === 0) {
    throw new Error("CPU asked to move with no legal moves");
  }
  if (moves.length === 1) return moves[0];

  const ctx: SearchCtx = { sim, aiPlayer: player, nodes: 0 };
  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const undo = applySimMove(sim, move);
    // Early game: while the next player to act is still on a short chain,
    // cut the search depth (branching is huge and captures are far away).
    let depth = baseDepth;
    if (!sim.over && sim.chains[sim.currentPlayer].length < sim.n) {
      depth = Math.floor(depth / 1.5);
    }
    const value =
      search(ctx, depth, -Infinity, Infinity) +
      (Math.random() - 0.5) * randomRange;
    undoSimMove(sim, undo);

    if (value > bestScore) {
      bestScore = value;
      bestMove = move;
    }
  }
  return bestMove;
}

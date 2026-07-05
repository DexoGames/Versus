import type { GameEngine, Json, WinResult } from "../types";
import type { UndercutConfig, UndercutMove, UndercutState } from "./types";

/**
 * Undercut: 2–4 players bid 1–10 simultaneously each hand. Lowest bid wins,
 * unless someone sits exactly one higher — they undercut and steal the win.
 * Undercuts chain upward when bids form a run (1,2,3 → the 3 wins), exactly
 * as the Unity CalculateWinner does. The winner scores their own bid; a tie
 * at the winning value scores nobody. After the first hand of a round, bids
 * may only move ±1 from your previous bid.
 *
 * A round is played to `roundTarget` points (10). Winning a round banks a
 * round win and resets points and bid ranges; first to `matchTarget` round
 * wins (1/3/5) takes the match.
 */

export const BID_MAX = 10;

export function createInitial(config: UndercutConfig): UndercutState {
  const n = config.playerCount;
  return {
    config,
    scores: new Array(n).fill(0),
    roundWins: new Array(n).fill(0),
    rounds: [],
    lastBids: new Array(n).fill(0),
    pendingBids: new Array(n).fill(null),
    history: [],
    over: false,
    winners: [],
  };
}

/** Allowed bid range for a seat: full 1–10 on a fresh round, else ±1 of last bid. */
export function bidRange(state: UndercutState, player: number): [number, number] {
  const last = state.lastBids[player];
  if (last === 0) return [1, BID_MAX];
  return [Math.max(last - 1, 1), Math.min(last + 1, BID_MAX)];
}

/** Faithful port of Undercut.CalculateWinner, including the chained undercut. */
export function resolveRound(bids: number[]): { winner: number; winningNumber: number } {
  const sorted = bids
    .map((number, player) => ({ number, player }))
    .sort((a, b) => a.number - b.number);

  let best = sorted[0];
  let draw = false;
  for (let i = 1; i < sorted.length; i++) {
    const num = sorted[i];
    if (num.number - best.number > 1) break;
    if (num.number - best.number === 1) {
      best = num;
      draw = false;
    } else if (num.number === best.number) {
      draw = true;
    }
  }

  if (draw) return { winner: -1, winningNumber: best.number };
  return { winner: best.player, winningNumber: best.number };
}

function currentPlayer(state: UndercutState): number {
  const idx = state.pendingBids.findIndex((b) => b === null);
  return idx === -1 ? 0 : idx;
}

function getLegalMoves(state: UndercutState, player: number): UndercutMove[] {
  if (state.over) return [];
  if (state.pendingBids[player] !== null) return [];
  const [min, max] = bidRange(state, player);
  const moves: number[] = [];
  for (let n = min; n <= max; n++) moves.push(n);
  return moves;
}

function applyMove(state: UndercutState, move: UndercutMove): UndercutState {
  const player = currentPlayer(state);
  const legal = getLegalMoves(state, player);
  if (!legal.includes(move)) {
    throw new Error(`Illegal Undercut bid ${move} for player ${player}`);
  }

  const pendingBids = state.pendingBids.slice();
  pendingBids[player] = move;

  // Hand still collecting bids.
  if (pendingBids.some((b) => b === null)) {
    return { ...state, pendingBids };
  }

  // All bids in: resolve the hand.
  const n = state.config.playerCount;
  const bids = pendingBids as number[];
  const { winner, winningNumber } = resolveRound(bids);

  let scores = state.scores.slice();
  if (winner >= 0) scores[winner] += winningNumber;

  const history = [...state.history, { bids: bids.slice(), winner, winningNumber }];
  let roundWins = state.roundWins;
  let rounds = state.rounds;
  let lastBids = bids.slice();
  let over = false;
  let winners: number[] = [];

  // Round won: bank it, then reset points and bid ranges for the next round.
  if (winner >= 0 && scores[winner] >= state.config.roundTarget) {
    roundWins = state.roundWins.slice();
    roundWins[winner]++;
    const priorHands = state.rounds.reduce((a, r) => a + r.hands, 0);
    rounds = [
      ...state.rounds,
      { winner, hands: history.length - priorHands, points: scores },
    ];
    if (roundWins[winner] >= state.config.matchTarget) {
      over = true;
      winners = [winner];
    } else {
      scores = new Array(n).fill(0);
      lastBids = new Array(n).fill(0);
    }
  }

  return {
    ...state,
    scores,
    roundWins,
    rounds,
    lastBids,
    pendingBids: new Array(n).fill(null),
    history,
    over,
    winners,
  };
}

function checkWinner(state: UndercutState): WinResult {
  if (!state.over) return { over: false, winners: [], reason: null };
  return { over: true, winners: state.winners, reason: "match-target" };
}

export const undercutEngine: GameEngine<UndercutState, UndercutMove> = {
  currentPlayer,
  getLegalMoves,
  applyMove,
  checkWinner,
  serialize: (state) => ({ ...state }) as unknown as Json,
  deserialize: (json) => json as unknown as UndercutState,
};

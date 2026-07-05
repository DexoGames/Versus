import type { GameEngine, Json, WinResult } from "../types";
import {
  applySimMove,
  buildSim,
  createInitialState,
  movesForPlayer,
} from "./sim";
import type { GridlockMove, GridlockState, Point } from "./types";

export { createInitialState as createInitialGridlock };

function simToState(state: GridlockState, simResult: ReturnType<typeof buildSim>, captured: number[], mover: number): GridlockState {
  return {
    config: state.config,
    chains: simResult.chains.map((c) => c.map((p) => ({ x: p.x, y: p.y }))),
    cellOwner: Array.from(simResult.cellOwner),
    regions:
      captured.length > 0
        ? [...state.regions, { id: state.regions.length, player: mover, cells: captured }]
        : state.regions,
    scores: simResult.scores.slice(),
    currentPlayer: simResult.currentPlayer,
    turnCount: simResult.turnCount,
    over: simResult.over,
    winners: simResult.winners.slice(),
    winReason: simResult.winReason,
  };
}

function getLegalMoves(state: GridlockState, player: number): Point[] {
  if (state.over) return [];
  return movesForPlayer(buildSim(state), player);
}

export const gridlockEngine: GameEngine<GridlockState, GridlockMove> = {
  currentPlayer: (state) => state.currentPlayer,

  getLegalMoves,

  applyMove(state, move) {
    if (state.over) throw new Error("Game is over");
    const sim = buildSim(state);
    const legal = movesForPlayer(sim, sim.currentPlayer);
    if (!legal.some((m) => m.x === move.x && m.y === move.y)) {
      throw new Error(`Illegal Gridlock move (${move.x},${move.y})`);
    }
    const mover = sim.currentPlayer;
    const undo = applySimMove(sim, move);
    return simToState(state, sim, undo.capturedCells, mover);
  },

  checkWinner(state): WinResult {
    if (!state.over) return { over: false, winners: [], reason: null };
    return { over: true, winners: state.winners, reason: state.winReason };
  },

  serialize: (state) => ({ ...state }) as unknown as Json,
  deserialize: (json) => json as unknown as GridlockState,
};

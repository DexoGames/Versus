import { describe, expect, it } from "vitest";
import { chooseGridlockMove } from "./ai";
import { createInitialGridlock, gridlockEngine } from "./engine";
import { buildSim, checkWinnerScores, movesForPlayer } from "./sim";
import type { GridlockState, Point } from "./types";

const move = (state: GridlockState, x: number, y: number) =>
  gridlockEngine.applyMove(state, { x, y });

describe("gridlock turn structure", () => {
  it("player 0 moves once on the opening turn, then everyone moves twice", () => {
    let state = createInitialGridlock(5, 2);
    expect(state.currentPlayer).toBe(0);
    state = move(state, 3, 0); // P0's single opening move
    expect(state.currentPlayer).toBe(1);
    state = move(state, 0, 3); // P1 move 1
    expect(state.currentPlayer).toBe(1);
    state = move(state, 0, 2); // P1 move 2
    expect(state.currentPlayer).toBe(0);
    state = move(state, 2, 0); // P0 move 1
    expect(state.currentPlayer).toBe(0);
  });

  it("rejects retracing an existing edge", () => {
    let state = createInitialGridlock(5, 2);
    state = move(state, 3, 0); // P0
    state = move(state, 0, 3); // P1: (0,4)->(0,3)
    // P1's second move: sliding straight back up retraces the drawn edge.
    expect(() => move(state, 0, 4)).toThrow();
  });
});

describe("gridlock enclosure via flood fill", () => {
  /**
   * 3×3 dots (2×2 cells). P0 starts at (2,0), P1 at (0,2). P0 walls off the
   * bottom-right cell; the final closing edge must capture exactly that cell.
   */
  it("captures a unit cell when the loop closes, credited to the closer", () => {
    let state = createInitialGridlock(3, 2);
    state = move(state, 1, 0); // P0: (2,0)->(1,0)
    state = move(state, 0, 1); // P1: (0,2)->(0,1)
    state = move(state, 0, 0); // P1: (0,1)->(0,0)
    state = move(state, 1, 1); // P0: (1,0)->(1,1)
    state = move(state, 2, 1); // P0: (1,1)->(2,1)
    state = move(state, 1, 0); // P1: (0,0)->(1,0) — revisit, but no enclosure
    expect(state.scores).toEqual([0, 0]);

    // P1's tail (1,0) is orthogonally stuck (edges to (0,0),(1,1),(2,0) drawn)
    // so only diagonals remain.
    const p1Moves = gridlockEngine.getLegalMoves(state, 1);
    expect(p1Moves.every((m) => m.x !== 1 || m.y !== 0)).toBe(true);
    expect(p1Moves).toContainEqual({ x: 0, y: 1 });
    state = move(state, 0, 1); // P1 diagonal fallback

    state = move(state, 2, 0); // P0: (2,1)->(2,0) closes the bottom-right cell
    expect(state.scores).toEqual([1, 0]);
    expect(state.cellOwner[0 * 2 + 1]).toBe(0); // cell (1,0)
    expect(state.regions).toHaveLength(1);
    expect(state.regions[0].player).toBe(0);
  });

  it("a capture is credited to whoever closes it, even around foreign lines", () => {
    // P0 draws three walls of the bottom-right cell; P1 swoops in and places
    // the fourth. The cell must go to P1.
    let state = createInitialGridlock(3, 2);
    state = move(state, 1, 0); // P0: (2,0)->(1,0)
    state = move(state, 1, 2); // P1: (0,2)->(1,2)
    state = move(state, 2, 2); // P1: (1,2)->(2,2)
    state = move(state, 1, 1); // P0: (1,0)->(1,1)
    state = move(state, 2, 1); // P0: (1,1)->(2,1)
    state = move(state, 2, 1); // P1: (2,2)->(2,1) — revisited dot, nothing sealed
    expect(state.scores).toEqual([0, 0]);
    state = move(state, 2, 0); // P1: (2,1)->(2,0) closes the cell P0 built
    expect(state.scores).toEqual([0, 1]);
    expect(state.cellOwner[0 * 2 + 1]).toBe(1);
    expect(state.regions[0].player).toBe(1);
  });
});

describe("winner math (port of CheckForWinner)", () => {
  it("declares an insurmountable lead", () => {
    // 4×4 cells = 9 total on a 4-dot grid... (n-1)² with n=4 → 9.
    // scores [5,1]: unclaimed = 3, 5 > 3 + 1 → player 0 wins.
    expect(checkWinnerScores([5, 1], 4, false)).toEqual([0]);
  });

  it("no winner while the lead is still catchable", () => {
    // scores [4,1]: unclaimed 4, 4 > 4+1 false → no winner yet.
    expect(checkWinnerScores([4, 1], 4, false)).toEqual([]);
  });

  it("full board goes to the top scorer, ties share", () => {
    expect(checkWinnerScores([5, 4], 4, false)).toEqual([0]);
    // A full board split evenly... 9 cells can't split evenly; use frozen.
    expect(checkWinnerScores([3, 3], 4, true)).toEqual([0, 1]);
  });
});

describe("gridlock self-play sanity", () => {
  it("random legal self-play always terminates cleanly with consistent scores", () => {
    for (let game = 0; game < 20; game++) {
      let state = createInitialGridlock(4, 2);
      let guard = 0;
      while (!state.over && guard++ < 500) {
        const moves = gridlockEngine.getLegalMoves(state, state.currentPlayer);
        expect(moves.length).toBeGreaterThan(0);
        state = gridlockEngine.applyMove(
          state,
          moves[Math.floor(Math.random() * moves.length)],
        );
      }
      expect(state.over).toBe(true);
      expect(state.winReason).not.toBeNull();
      // Scores must equal owned-cell counts.
      const counts = [0, 0];
      for (const owner of state.cellOwner) if (owner >= 0) counts[owner]++;
      expect(state.scores).toEqual(counts);
    }
  });

  it("the CPU only ever produces legal moves and beats random play", () => {
    let cpuWins = 0;
    const games = 6;
    for (let game = 0; game < games; game++) {
      let state = createInitialGridlock(4, 2);
      let guard = 0;
      while (!state.over && guard++ < 500) {
        const player = state.currentPlayer;
        const legal = gridlockEngine.getLegalMoves(state, player);
        let chosen: Point;
        if (player === 0) {
          chosen = chooseGridlockMove(state, 0, 2);
          expect(legal).toContainEqual(chosen);
        } else {
          chosen = legal[Math.floor(Math.random() * legal.length)];
        }
        state = gridlockEngine.applyMove(state, chosen);
      }
      if (state.winners.length === 1 && state.winners[0] === 0) cpuWins++;
    }
    expect(cpuWins).toBeGreaterThanOrEqual(Math.ceil(games / 2));
  });
});

describe("sim invariants", () => {
  it("buildSim round-trips chain edges and visit counts", () => {
    let state = createInitialGridlock(5, 2);
    state = move(state, 3, 0);
    state = move(state, 0, 3);
    state = move(state, 1, 3);
    const sim = buildSim(state);
    expect(sim.edges.size).toBe(3);
    expect(movesForPlayer(sim, 0).length).toBeGreaterThan(0);
  });
});

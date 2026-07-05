import { describe, expect, it } from "vitest";
import { bidRange, createInitial, resolveRound, undercutEngine } from "./engine";
import type { UndercutState } from "./types";

const config = { playerCount: 3, scoreAim: 10 };

describe("resolveRound (port of Undercut.CalculateWinner)", () => {
  it("lowest unique bid wins when nobody is within 1", () => {
    expect(resolveRound([2, 4, 6])).toEqual({ winner: 0, winningNumber: 2 });
    expect(resolveRound([5, 3, 6])).toEqual({ winner: 1, winningNumber: 3 });
  });

  it("a bid exactly one above the lowest undercuts and steals", () => {
    expect(resolveRound([2, 3, 6])).toEqual({ winner: 1, winningNumber: 3 });
  });

  it("undercuts chain upward through a run of bids", () => {
    // 1 is undercut by 2, which is undercut by 3.
    expect(resolveRound([1, 2, 3])).toEqual({ winner: 2, winningNumber: 3 });
  });

  it("tie at the winning value scores nobody", () => {
    expect(resolveRound([3, 3, 6])).toEqual({ winner: -1, winningNumber: 3 });
    expect(resolveRound([6, 6, 6])).toEqual({ winner: -1, winningNumber: 6 });
  });

  it("tie at the low end is stolen by the +1 bid (Unity behaviour)", () => {
    // 4,4 draw, but the 5 undercuts the drawn 4s and wins outright.
    expect(resolveRound([4, 4, 5])).toEqual({ winner: 2, winningNumber: 5 });
  });

  it("tie at the low end with no adjacent bid stays a draw", () => {
    expect(resolveRound([1, 1, 3])).toEqual({ winner: -1, winningNumber: 1 });
  });
});

describe("undercut engine", () => {
  it("allows 1-6 on round one, then clamps to ±1 of the previous bid", () => {
    let state = createInitial(config);
    expect(bidRange(state, 0)).toEqual([1, 6]);

    state = undercutEngine.applyMove(state, 1);
    state = undercutEngine.applyMove(state, 6);
    state = undercutEngine.applyMove(state, 4);

    expect(bidRange(state, 0)).toEqual([1, 2]); // 1 clamps at the bottom
    expect(bidRange(state, 1)).toEqual([5, 6]); // 6 clamps at the top
    expect(bidRange(state, 2)).toEqual([3, 5]);
  });

  it("collects bids in seat order and resolves when the last one lands", () => {
    let state = createInitial(config);
    expect(undercutEngine.currentPlayer(state)).toBe(0);
    state = undercutEngine.applyMove(state, 2);
    expect(undercutEngine.currentPlayer(state)).toBe(1);
    expect(state.history).toHaveLength(0);

    state = undercutEngine.applyMove(state, 3);
    state = undercutEngine.applyMove(state, 6);

    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toEqual({ bids: [2, 3, 6], winner: 1, winningNumber: 3 });
    expect(state.scores).toEqual([0, 3, 0]);
    expect(state.pendingBids).toEqual([null, null, null]);
    expect(state.lastBids).toEqual([2, 3, 6]);
  });

  it("rejects out-of-range bids", () => {
    let state = createInitial(config);
    state = undercutEngine.applyMove(state, 3);
    state = undercutEngine.applyMove(state, 3);
    state = undercutEngine.applyMove(state, 3);
    // Player 0 bid 3 last round; 5 is out of the ±1 window.
    expect(() => undercutEngine.applyMove(state, 5)).toThrow();
  });

  it("ends the game when a player reaches the score aim", () => {
    let state: UndercutState = createInitial({ playerCount: 3, scoreAim: 4 });
    state = undercutEngine.applyMove(state, 4);
    state = undercutEngine.applyMove(state, 6);
    state = undercutEngine.applyMove(state, 6);
    expect(state.scores).toEqual([4, 0, 0]);
    expect(state.over).toBe(true);
    expect(undercutEngine.checkWinner(state)).toEqual({
      over: true,
      winners: [0],
      reason: "score-aim",
    });
  });
});

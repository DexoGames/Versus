import { describe, expect, it } from "vitest";
import { bidRange, createInitial, resolveRound, undercutEngine } from "./engine";
import type { UndercutState } from "./types";

const config = { playerCount: 3, roundTarget: 10, matchTarget: 3 };

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

  it("works heads-up: the higher bid wins only when it sits exactly one above", () => {
    expect(resolveRound([4, 5])).toEqual({ winner: 1, winningNumber: 5 });
    expect(resolveRound([3, 5])).toEqual({ winner: 0, winningNumber: 3 });
  });
});

describe("undercut engine", () => {
  it("allows 1-10 on a fresh round, then clamps to ±1 of the previous bid", () => {
    let state = createInitial(config);
    expect(bidRange(state, 0)).toEqual([1, 10]);

    state = undercutEngine.applyMove(state, 1);
    state = undercutEngine.applyMove(state, 10);
    state = undercutEngine.applyMove(state, 4);

    expect(bidRange(state, 0)).toEqual([1, 2]); // 1 clamps at the bottom
    expect(bidRange(state, 1)).toEqual([9, 10]); // 10 clamps at the top
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
    // Player 0 bid 3 last hand; 5 is out of the ±1 window.
    expect(() => undercutEngine.applyMove(state, 5)).toThrow();
  });

  it("banks a round at 10 points and resets scores and bid ranges", () => {
    let state: UndercutState = createInitial(config);
    // Hand 1: P0 takes 6.
    for (const bid of [6, 9, 9]) state = undercutEngine.applyMove(state, bid);
    expect(state.scores).toEqual([6, 0, 0]);
    // Hand 2: P0 bids 5 and crosses 10 — round banked.
    for (const bid of [5, 8, 8]) state = undercutEngine.applyMove(state, bid);

    expect(state.roundWins).toEqual([1, 0, 0]);
    expect(state.rounds).toEqual([
      { winner: 0, hands: 2, points: [11, 0, 0] },
    ]);
    expect(state.over).toBe(false);
    expect(state.scores).toEqual([0, 0, 0]); // fresh round
    expect(state.lastBids).toEqual([0, 0, 0]); // free 1–10 pick again
    expect(bidRange(state, 1)).toEqual([1, 10]);
  });

  it("first to the match target takes the match", () => {
    let state: UndercutState = createInitial({
      playerCount: 2,
      roundTarget: 10,
      matchTarget: 1,
    });
    for (const bid of [10, 4]) state = undercutEngine.applyMove(state, bid);
    expect(state.scores).toEqual([0, 4]); // 4 undercuts nothing; 4 wins low
    for (const bid of [9, 5]) state = undercutEngine.applyMove(state, bid);
    expect(state.scores).toEqual([0, 9]);
    for (const bid of [8, 4]) state = undercutEngine.applyMove(state, bid);

    expect(state.roundWins).toEqual([0, 1]);
    expect(state.over).toBe(true);
    expect(undercutEngine.checkWinner(state)).toEqual({
      over: true,
      winners: [1],
      reason: "match-target",
    });
  });
});

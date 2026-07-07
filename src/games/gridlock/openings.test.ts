import { describe, expect, it } from "vitest";
import { gridlockEngine, createInitialGridlock } from "./engine";
import { identifyOpening } from "./openings";
import type { GridlockState, Point } from "./types";

function play(state: GridlockState, to: Point): GridlockState {
  return gridlockEngine.applyMove(state, to);
}

describe("opening: territorial vs Slough", () => {
  it("classifies a corner 1×1 enclosure as The Cell, and a full-edge march as Slough", () => {
    let s = createInitialGridlock(6, 2);
    // P0 (corner 5,0) single opening move.
    s = play(s, { x: 4, y: 0 });
    // P1 (corner 0,5) slough along the top edge.
    s = play(s, { x: 1, y: 5 });
    s = play(s, { x: 2, y: 5 });
    // P0 continues the square.
    s = play(s, { x: 4, y: 1 });
    s = play(s, { x: 5, y: 1 });
    // P1 keeps marching.
    s = play(s, { x: 3, y: 5 });
    s = play(s, { x: 4, y: 5 });
    // P0 closes the 1×1 corner square (capture), then diagonals out.
    s = play(s, { x: 5, y: 0 }); // close -> capture
    s = play(s, { x: 4, y: 1 }); // diagonal breakout
    // P1 marches on.
    s = play(s, { x: 5, y: 5 });
    s = play(s, { x: 5, y: 4 });
    // P0 continues out (reach 6 segments).
    s = play(s, { x: 3, y: 1 });
    s = play(s, { x: 3, y: 2 });

    const opening = identifyOpening(s);
    expect(opening).not.toBeNull();
    expect(opening!.players[0].key).toBe("cell");
    expect(opening!.players[1].key).toBe("slough");
  });
});

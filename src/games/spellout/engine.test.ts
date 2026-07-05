import { describe, expect, it } from "vitest";
import { Dictionary } from "./dictionary";
import { createInitialSpellout, createSpelloutEngine } from "./engine";
import { chooseSpelloutLetter } from "./ai";

const dict = new Dictionary(
  ["cat", "cats", "cattle", "dog", "dot", "dote", "zit"],
  ["cat", "dog"],
);
const engine = createSpelloutEngine(dict);

describe("dictionary prefix queries", () => {
  it("counts words by prefix", () => {
    expect(dict.countWithPrefix("ca")).toBe(3);
    expect(dict.countWithPrefix("do")).toBe(3);
    expect(dict.countWithPrefix("q")).toBe(0);
  });

  it("lists the legal next letters for a fragment", () => {
    expect(dict.legalLetters("")).toEqual(["c", "d", "z"]);
    expect(dict.legalLetters("do")).toEqual(["g", "t"]);
    expect(dict.legalLetters("cat")).toEqual(["s", "t"]);
  });
});

describe("spellout engine", () => {
  it("keeps play going while the fragment can still grow", () => {
    let state = createInitialSpellout();
    state = engine.applyMove(state, "c");
    state = engine.applyMove(state, "a");
    state = engine.applyMove(state, "t");
    // "cat" is a word but "cats"/"cattle" still exist — no winner yet.
    expect(state.over).toBe(false);
    expect(state.fragment).toBe("cat");
    expect(state.remaining).toBe(3);
    expect(state.turn).toBe(1);
  });

  it("the player who completes an unextendable word wins", () => {
    let state = createInitialSpellout();
    for (const letter of ["d", "o", "g"]) state = engine.applyMove(state, letter);
    // Player 0 played d and g; g finished "dog", which cannot grow.
    expect(state.over).toBe(true);
    expect(state.winners).toEqual([0]);
    expect(state.reason).toBe("completed-word");
  });

  it("a dead letter loses immediately for the mover", () => {
    let state = createInitialSpellout();
    state = engine.applyMove(state, "c"); // player 0
    state = engine.applyMove(state, "q"); // player 1 kills the fragment
    expect(state.over).toBe(true);
    expect(state.winners).toEqual([0]);
    expect(state.reason).toBe("dead-letter");
    expect(state.deadLetter).toBe("q");
    expect(state.fragment).toBe("c"); // fragment stays at the last valid prefix
  });

  it("three players rotate turns; a dead letter loses only for the mover", () => {
    let state = createInitialSpellout(3);
    state = engine.applyMove(state, "c"); // P0
    expect(state.turn).toBe(1);
    state = engine.applyMove(state, "a"); // P1
    expect(state.turn).toBe(2);
    state = engine.applyMove(state, "q"); // P2 kills the fragment
    expect(state.over).toBe(true);
    expect(state.winners).toEqual([0, 1]);
    expect(state.reason).toBe("dead-letter");
  });

  it("completing a word mid-branch still ends it only when unextendable", () => {
    let state = createInitialSpellout();
    for (const letter of ["d", "o", "t"]) state = engine.applyMove(state, letter);
    expect(state.over).toBe(false); // "dote" still live
    state = engine.applyMove(state, "e");
    // Player 1 played o and e; e finished "dote" — unextendable.
    expect(state.over).toBe(true);
    expect(state.winners).toEqual([1]);
  });
});

describe("spellout expert AI", () => {
  it("never plays a dead letter", () => {
    let state = createInitialSpellout();
    state = engine.applyMove(state, "z");
    // Only "zit" remains; the sole non-dead letter is "i".
    const letter = chooseSpelloutLetter(dict, state, 4);
    expect(letter).toBe("i");
  });

  it("finds the forced win by parity", () => {
    // Dictionary where fragment "do" gives the mover a forced win with "t":
    // "dot" can only grow to "dote" ("dots" absent), so opponent must play t→e?
    // Actually after "dot" the words are dot/dote; opponent to move must play
    // "e" (only letter), completing "dote" and winning. So expert avoids... this
    // checks the search sees ahead: from "d", playing "o" leads into dot/dote
    // where whoever faces "dot" is forced to hand over/win by parity.
    const tinyDict = new Dictionary(["dote", "dog"], ["dog"]);
    const tinyEngine = createSpelloutEngine(tinyDict);
    let state = createInitialSpellout();
    state = tinyEngine.applyMove(state, "d"); // P0
    state = tinyEngine.applyMove(state, "o"); // P1
    // P0 to move on "do": "g" completes dog immediately → P0 WINS (unextendable).
    // "t" heads into dote where P0 would complete on "e"? do-t (P0), dot-e (P1 wins).
    // Expert must pick g.
    const letter = chooseSpelloutLetter(tinyDict, state, 4);
    expect(letter).toBe("g");
  });
});

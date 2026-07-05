import type { GameEngine, Json, WinResult } from "../types";
import type { Dictionary } from "./dictionary";
import type { SpelloutMove, SpelloutState } from "./types";

/**
 * Spellout (the Unity flavour of Ghost): players alternate adding one letter
 * to a shared fragment. Playing a letter that kills every word loses on the
 * spot; completing a word that cannot be extended any further WINS for the
 * player who finished it. Words that can still grow keep the duel going.
 *
 * The engine is a factory because every rule question routes through the
 * dictionary; the returned engine stays pure and deterministic.
 */

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

export function createInitialSpellout(playerCount = 2): SpelloutState {
  return {
    playerCount,
    fragment: "",
    turn: 0,
    remaining: 0,
    over: false,
    winners: [],
    reason: null,
    deadLetter: null,
  };
}

export function createSpelloutEngine(
  dict: Dictionary,
): GameEngine<SpelloutState, SpelloutMove> {
  return {
    currentPlayer: (state) => state.turn,

    // Any letter may be played — a dead letter is a legal, losing move
    // ("you win if the opponent misspells"). CPU tiers avoid them by choice.
    getLegalMoves: (state) => (state.over ? [] : ALPHABET),

    applyMove(state, move) {
      if (state.over) throw new Error("Game is over");
      const letter = move.toLowerCase();
      if (letter.length !== 1 || letter < "a" || letter > "z") {
        throw new Error(`Illegal Spellout move "${move}"`);
      }

      const fragment = state.fragment + letter;
      const [lo, hi] = dict.range(fragment);
      const remaining = hi - lo;
      const pc = state.playerCount ?? 2;

      // Dead prefix: the mover loses, everyone else shares the win.
      if (remaining === 0) {
        const winners = [];
        for (let i = 1; i < pc; i++) winners.push((state.turn + i) % pc);
        return {
          ...state,
          remaining: 0,
          over: true,
          winners: winners.sort((a, b) => a - b),
          reason: "dead-letter",
          deadLetter: letter,
        };
      }

      // Exactly one word left and it IS the fragment: unextendable — mover wins.
      if (remaining === 1 && dict.words[lo] === fragment) {
        return {
          ...state,
          fragment,
          remaining,
          over: true,
          winners: [state.turn],
          reason: "completed-word",
          deadLetter: null,
        };
      }

      return {
        ...state,
        fragment,
        remaining,
        turn: (state.turn + 1) % pc,
        deadLetter: null,
      };
    },

    checkWinner(state): WinResult {
      if (!state.over) return { over: false, winners: [], reason: null };
      return { over: true, winners: state.winners, reason: state.reason };
    },

    serialize: (state) => ({ ...state }) as unknown as Json,
    deserialize: (json) =>
      ({ playerCount: 2, ...(json as object) }) as unknown as SpelloutState,
  };
}

export interface SpelloutState {
  /** Seats in the duel (2 by default, 3 supported). */
  playerCount: number;
  /** The growing shared fragment (always a valid prefix while play continues). */
  fragment: string;
  /** Player to act. */
  turn: number;
  /** How many dictionary words the fragment can still become. */
  remaining: number;
  over: boolean;
  winners: number[];
  reason: "completed-word" | "dead-letter" | null;
  /** The letter that ended the game on a dead prefix (rendered in red). */
  deadLetter: string | null;
}

/** A move is a single lowercase letter a–z. */
export type SpelloutMove = string;

export interface UndercutConfig {
  /** Seats at the table: 2 by default, up to 4. */
  playerCount: number;
  /** Points that take a round (fixed at 10 in the UI). */
  roundTarget: number;
  /** Round wins that take the match: 1, 3 or 5. */
  matchTarget: number;
}

/** One simultaneous exchange of bids (a "hand"). */
export interface RoundRecord {
  bids: number[];
  /** Winning seat, or -1 for a drawn hand. */
  winner: number;
  /** The winning bid value (shown even on a draw, like the Unity build). */
  winningNumber: number;
}

/** A completed round (someone reached the round target). */
export interface RoundResult {
  winner: number;
  /** Hands it took to settle this round. */
  hands: number;
  /** Final points when the round closed. */
  points: number[];
}

export interface UndercutState {
  config: UndercutConfig;
  /** Points in the current round (reset when a round is won). */
  scores: number[];
  /** Rounds taken per seat; first to config.matchTarget wins the match. */
  roundWins: number[];
  /** Completed rounds, oldest first. */
  rounds: RoundResult[];
  /** Bids from the last completed hand; 0s at a round start (= free 1–10 pick). */
  lastBids: number[];
  /** Current hand's secret bids; null until that seat has bid. */
  pendingBids: (number | null)[];
  /** Every hand played this match, across rounds. */
  history: RoundRecord[];
  over: boolean;
  winners: number[];
}

/** A move is simply the number bid (1–10). */
export type UndercutMove = number;

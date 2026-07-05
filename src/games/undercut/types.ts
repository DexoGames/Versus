export interface UndercutConfig {
  playerCount: number; // always 3 in v1
  scoreAim: number;
}

export interface RoundRecord {
  bids: number[];
  /** Winning seat, or -1 for a drawn round. */
  winner: number;
  /** The winning bid value (shown even on a draw, like the Unity build). */
  winningNumber: number;
}

export interface UndercutState {
  config: UndercutConfig;
  scores: number[];
  /** Bids from the last completed round; 0s before round one (= free 1–6 pick). */
  lastBids: number[];
  /** Current round's secret bids; null until that seat has bid. */
  pendingBids: (number | null)[];
  history: RoundRecord[];
  over: boolean;
  winners: number[];
}

/** A move is simply the number bid (1–6). */
export type UndercutMove = number;

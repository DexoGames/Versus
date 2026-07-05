export interface Point {
  x: number;
  y: number;
}

export interface GridlockConfig {
  /** Dots per side (the playable cells are (gridSize-1)²). */
  gridSize: number;
  playerCount: number;
}

export interface CapturedRegion {
  id: number;
  player: number;
  /** Cell indices (cy * (gridSize-1) + cx) captured by this closing move. */
  cells: number[];
}

export interface GridlockState {
  config: GridlockConfig;
  /** Each player's chain of visited dots, oldest first. Tail = current head. */
  chains: Point[][];
  /** Owner per cell, -1 = unclaimed. Index = cy * (gridSize-1) + cx. */
  cellOwner: number[];
  /** Capture events in order, for rendering + score breakdown. */
  regions: CapturedRegion[];
  scores: number[];
  currentPlayer: number;
  /**
   * Unity's half-move toggle: each player moves twice per turn; the player
   * advances when this wraps to 0. Starts at 1 so player 0's opening turn is
   * a single move (the built-in first-move balance).
   */
  turnCount: number;
  over: boolean;
  winners: number[];
  winReason: "insurmountable" | "board-full" | "gridlocked" | null;
}

/** A move is the dot the current player's chain extends to. */
export type GridlockMove = Point;

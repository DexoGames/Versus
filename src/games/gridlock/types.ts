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
  /**
   * The captured loop as a closed dot polygon (implicitly closed back to
   * vertices[0]). May include diagonal edges — triangles score 0.5.
   */
  vertices: Point[];
}

export interface GridlockState {
  config: GridlockConfig;
  /** Each player's chain of visited dots, oldest first. Tail = current head. */
  chains: Point[][];
  /** Capture events in creation order — order IS claim priority for overlaps. */
  regions: CapturedRegion[];
  /** Fractional scores in 0.25 steps (quarter-cell sampling). */
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

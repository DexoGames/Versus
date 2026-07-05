/** Shared contract implemented by every game's pure logic module. */

export type PlayerKind = "human" | "cpu" | "remote";

export interface WinResult {
  over: boolean;
  /** Player indices sharing the win; length > 1 means a draw between them. */
  winners: number[];
  /** Short machine-friendly reason, e.g. "insurmountable", "board-full". */
  reason: string | null;
}

export type Json = Record<string, unknown>;

/**
 * A game engine is pure and deterministic: state in, state out. React renders
 * the state; the CPU and online layers drive the same functions, so local,
 * CPU and online play share one source of truth.
 */
export interface GameEngine<State, Move> {
  /** Player whose input is expected next. */
  currentPlayer(state: State): number;
  getLegalMoves(state: State, player: number): Move[];
  /** Pure: returns a new state, never mutates. Throws on illegal moves. */
  applyMove(state: State, move: Move): State;
  checkWinner(state: State): WinResult;
  serialize(state: State): Json;
  deserialize(json: Json): State;
}

/** CPU difficulty tiers, shared across games (games may expose a subset). */
export type Difficulty = 1 | 2 | 3 | 4;

export interface DifficultyInfo {
  level: Difficulty;
  label: string;
  /** CPU persona name, carried over from the Unity build's named AIs. */
  persona: string;
  tagline: string;
}

export const DIFFICULTIES: DifficultyInfo[] = [
  { level: 1, label: "Easy", persona: "Isaac", tagline: "Plays on vibes. Occasionally brilliant by accident." },
  { level: 2, label: "Medium", persona: "Bob", tagline: "Solid fundamentals. Punishes lazy moves." },
  { level: 3, label: "Hard", persona: "Vera", tagline: "Thinks several moves ahead. Rarely blinks." },
  { level: 4, label: "Extreme", persona: "Dexter", tagline: "Near-perfect play. Bring a plan." },
];

export function difficultyInfo(level: Difficulty): DifficultyInfo {
  return DIFFICULTIES.find((d) => d.level === level) ?? DIFFICULTIES[0];
}

/** Per-player palette, drawn from the site's fixed design tokens. */
export const PLAYER_COLORS = ["#ff5a36", "#3aabff", "#2fe089", "#ffc83a"];

export interface SeatConfig {
  kind: PlayerKind;
  name: string;
  difficulty?: Difficulty;
}

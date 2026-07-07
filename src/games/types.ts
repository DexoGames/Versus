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

/**
 * CPU opponent names — EDIT HERE to rename the computer players. One name per
 * difficulty tier (Easy → Extreme). This is the single place the names live;
 * changing a string here updates every game's lobby, chips and status text.
 */
export const CPU_NAMES: Record<Difficulty, string> = {
  1: "Isaac", // Easy
  2: "Bob", // Medium
  3: "Vera", // Hard
  4: "Dexter", // Extreme
};

export const DIFFICULTIES: DifficultyInfo[] = [
  { level: 1, label: "Easy", persona: CPU_NAMES[1], tagline: "Plays on vibes. Occasionally brilliant by accident." },
  { level: 2, label: "Medium", persona: CPU_NAMES[2], tagline: "Solid fundamentals. Punishes lazy moves." },
  { level: 3, label: "Hard", persona: CPU_NAMES[3], tagline: "Thinks several moves ahead. Rarely blinks." },
  { level: 4, label: "Extreme", persona: CPU_NAMES[4], tagline: "Near-perfect play. Bring a plan." },
];

export function difficultyInfo(level: Difficulty): DifficultyInfo {
  return DIFFICULTIES.find((d) => d.level === level) ?? DIFFICULTIES[0];
}

/**
 * Per-player palette — kept distinct from the per-game theme accents
 * (orange/blue/green) so a chain or bid token never blends into the page.
 * Mirrors --player-* in globals.css.
 */
export const PLAYER_COLORS = ["#ff4f81", "#35d0be", "#b06bff", "#ffc83a"];

export interface SeatConfig {
  kind: PlayerKind;
  name: string;
  difficulty?: Difficulty;
}

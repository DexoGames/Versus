import type { Json } from "../games/types";

export type GameId = "gridlock" | "spellout" | "undercut";
export type RoomStatus = "waiting" | "active" | "finished";

export interface RoomSeat {
  /** Auth uid, or "cpu" for host-run CPU seats. */
  uid: string;
  name: string;
  kind: "human" | "cpu";
}

export interface RoomDoc {
  game: GameId;
  status: RoomStatus;
  /** Game-specific settings: gridSize/playerCount or scoreAim. */
  config: Json;
  seats: RoomSeat[];
  /** Seats the game needs before the host can start. */
  seatTarget: number;
  hostUid: string;
  /** Serialized engine state — the canonical game position. */
  state: Json | null;
  /** Monotonic move counter for ordering + gap detection. */
  moveCount: number;
  /** The most recent move, so peers can re-validate it locally. */
  lastMove: Json | null;
  lastMover: number;
  /**
   * Undercut commit-reveal: hashed bids land first; actual bids + salts only
   * after every seat has committed, so nobody can peek pre-reveal.
   */
  commits: Record<string, string>;
  reveals: Record<string, { bid: number; salt: string }>;
  round: number;
  createdAt: number;
  updatedAt: number;
}

/** Human-friendly room codes: no 0/O or 1/I lookalikes. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 5): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z2-9]/g, "");
}

/** SHA-256 hex of a bid + salt, the Undercut commitment. */
export async function hashBid(bid: number, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${bid}|${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

import { polygonArea } from "./sim";
import type { GridlockState, Point } from "./types";

/**
 * A "book" of Gridlock openings — chess's idea applied to the 6×6 two-player
 * game. The book splits in two:
 *
 *  • Aggressive lines that strike out to meet the opponent — the Slough (a
 *    straight march the FULL length of a flank, corner to corner), Pincer,
 *    Staircase, Wing.
 *  • Territorial openings that fence off a shape in the home corner before any
 *    contact — named for the shape they build: the Cell (1×1), Bastion (2×2+
 *    square), Gallery (rectangle), Ell (L-shape).
 *
 * Openings only settle once both players have developed for roughly three full
 * turns, so identify() stays quiet until then. Scoped to 6×6 two-player.
 */

export type ArchetypeKey =
  | "slough"
  | "wing"
  | "staircase"
  | "pincer"
  | "cell"
  | "bastion"
  | "gallery"
  | "ell";

interface Archetype {
  name: string;
  blurb: string;
}

const ARCHETYPES: Record<ArchetypeKey, Archetype> = {
  slough: { name: "Slough", blurb: "a straight march the full length of a flank" },
  wing: { name: "Wing", blurb: "runs the flank, then banks inward" },
  staircase: { name: "Staircase", blurb: "a step-and-climb toward the middle" },
  pincer: { name: "Pincer", blurb: "peels off the wall and drives at the centre" },
  cell: { name: "The Cell", blurb: "fences a snug 1×1 pen in the corner" },
  bastion: { name: "The Bastion", blurb: "walls off a 2×2 square fort" },
  gallery: { name: "The Gallery", blurb: "encloses a long rectangular pen" },
  ell: { name: "The Ell", blurb: "carves out an L-shaped enclosure" },
};

const AGGRESSIVE: ReadonlySet<ArchetypeKey> = new Set(["slough", "wing", "staircase", "pincer"]);

export interface PlayerOpening {
  key: ArchetypeKey;
  name: string;
  blurb: string;
}

export interface OpeningResult {
  book: string;
  summary: string;
  players: [PlayerOpening, PlayerOpening];
}

/** Both chains must reach this many segments before the book is read. */
const OPENING_MIN_SEGMENTS = 6;

const chebyshev = (a: Point, b: Point) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/* ---- shape naming -------------------------------------------------- */

/** Name a rectangular-ish footprint by its width, height and filled area. */
function penName(w: number, h: number, area: number): ArchetypeKey {
  const big = Math.max(w, h);
  const small = Math.min(w, h);
  if (area <= 1.25) return "cell"; // 1×1
  if (area < big * small - 0.25) return "ell"; // dented / L-shaped
  if (big === small) return "bastion"; // square 2×2, 3×3…
  return "gallery"; // rectangle
}

/** The bounding box + captured area of every region a player has closed. */
function playerPen(
  state: GridlockState,
  player: number,
): { w: number; h: number; area: number } | null {
  const regions = state.regions.filter((r) => r.player === player);
  if (regions.length === 0) return null;
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, area = 0;
  for (const r of regions) {
    for (const v of r.vertices) {
      minx = Math.min(minx, v.x);
      maxx = Math.max(maxx, v.x);
      miny = Math.min(miny, v.y);
      maxy = Math.max(maxy, v.y);
    }
    area += polygonArea(r.vertices);
  }
  return { w: maxx - minx, h: maxy - miny, area };
}

/** Bounding box (in cells) of the whole chain path. */
function chainBox(chain: Point[]): { w: number; h: number } {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const p of chain) {
    minx = Math.min(minx, p.x);
    maxx = Math.max(maxx, p.x);
    miny = Math.min(miny, p.y);
    maxy = Math.max(maxy, p.y);
  }
  return { w: maxx - minx, h: maxy - miny };
}

/* ---- per-player classification ------------------------------------- */

function classifyChain(state: GridlockState, player: number): ArchetypeKey {
  const chain = state.chains[player];
  const corner = chain[0];
  const ex = corner.x === 0 ? 1 : -1;
  const ey = corner.y === 0 ? 1 : -1;

  // 1. Closed a shape → name it by that shape.
  const pen = playerPen(state, player);
  if (pen && pen.area >= 0.75) return penName(pen.w, pen.h, pen.area);

  // Canonical steps: a = primary axis into the board, b = secondary; negatives
  // point back toward home. Mirror the two edges so the first step is always A.
  const steps: Array<{ a: number; b: number }> = [];
  for (let i = 0; i < chain.length - 1; i++) {
    steps.push({ a: (chain[i + 1].x - chain[i].x) * ex, b: (chain[i + 1].y - chain[i].y) * ey });
  }
  if (steps[0] && steps[0].a === 0) for (const s of steps) [s.a, s.b] = [s.b, s.a];

  // 2. Slough = a straight line the FULL length of a flank (corner to corner).
  const run = state.config.gridSize - 1;
  if (steps.length >= run && steps.slice(0, run).every((s) => s.a === 1 && s.b === 0)) {
    return "slough";
  }

  // 3. Fenced-in but not yet closed: head folded back home, staying shallow →
  //    name the shape it is building from its footprint.
  let maxReach = 0;
  for (let i = 1; i < chain.length; i++) maxReach = Math.max(maxReach, chebyshev(chain[i], corner));
  const home = chain[chain.length - 1];
  const homeSteps = steps.filter((s) => s.a < 0 || s.b < 0).length;
  if (maxReach <= 2 && homeSteps >= 1 && chebyshev(home, corner) <= 2) {
    const box = chainBox(chain);
    return penName(box.w, box.h, box.w * box.h);
  }

  // 4. Otherwise an aggressive line — read its early shape.
  const encode = (s: { a: number; b: number }) =>
    s.a === 1 && s.b === 0 ? "F" : s.a === 0 && s.b === 1 ? "U" : s.a < 0 || s.b < 0 ? "B" : "?";
  const first3 = steps.slice(0, 3).map(encode).join("");
  if (first3 === "FFU") return "wing";
  if (first3 === "FUF") return "staircase";
  if (first3 === "FUU") return "pincer";
  if (first3.includes("B")) {
    const box = chainBox(chain);
    return penName(box.w, box.h, box.w * box.h);
  }
  return maxReach >= 3 ? "pincer" : "staircase";
}

/** A straight (Slough) chain runs along one board axis; report which. */
function sloughAxis(chain: Point[]): "x" | "y" {
  return chain[1].x !== chain[0].x ? "x" : "y";
}

/* ---- combined "book" naming ---------------------------------------- */

/** Curated names for the aggressive line-vs-line matchups. */
const AGG_BOOK: Record<string, { book: string; summary: string }> = {
  "pincer|pincer": { book: "The Collision", summary: "Both dive at the centre; first to blink loses the middle." },
  "pincer|slough": { book: "Slough Gambit", summary: "One grinds the flank while the other stabs the middle." },
  "pincer|staircase": { book: "The Auger", summary: "Two blades boring toward the core from different lines." },
  "pincer|wing": { book: "Wing Pincer", summary: "A banked flank against a straight centre-drive." },
  "slough|staircase": { book: "Slough, Staircase Variation", summary: "A straight line answered by a climbing weave." },
  "slough|wing": { book: "Flanked Slough", summary: "Parallel marches — one already banking inward." },
  "staircase|staircase": { book: "The Weave", summary: "Interlocking staircases race for the core." },
  "staircase|wing": { book: "Winged Staircase", summary: "A bank-in meets a climb — both angling for the core." },
  "wing|wing": { book: "Double Wing", summary: "Both bank inward off the flanks — a wide, open frame." },
};

export function identifyOpening(state: GridlockState): OpeningResult | null {
  if (state.config.playerCount !== 2 || state.config.gridSize !== 6) return null;
  const [c0, c1] = state.chains;
  if (c0.length - 1 < OPENING_MIN_SEGMENTS || c1.length - 1 < OPENING_MIN_SEGMENTS) {
    return null;
  }

  const k0 = classifyChain(state, 0);
  const k1 = classifyChain(state, 1);
  const p0: PlayerOpening = { key: k0, ...ARCHETYPES[k0] };
  const p1: PlayerOpening = { key: k1, ...ARCHETYPES[k1] };

  // Mirror Slough → chess-style Accepted / Declined.
  if (k0 === "slough" && k1 === "slough") {
    const accepted = sloughAxis(c0) === sloughAxis(c1);
    return {
      book: accepted ? "Slough Accepted" : "Slough Declined",
      summary: accepted
        ? "Both run straight lines down matching flanks — a head-on race."
        : "Two straight lines, each claiming a different wall — no early contact.",
      players: [p0, p1],
    };
  }

  const key = [k0, k1].sort().join("|");
  if (AGGRESSIVE.has(k0) && AGGRESSIVE.has(k1) && AGG_BOOK[key]) {
    return { ...AGG_BOOK[key], players: [p0, p1] };
  }

  // Everything else (territorial or mixed) gets a generated name.
  if (k0 === k1) {
    const bare = p0.name.replace(/^The /, "");
    return { book: `${bare} Mirror`, summary: `Both ${p0.blurb}.`, players: [p0, p1] };
  }
  return {
    book: `${p0.name} vs ${p1.name}`,
    summary: `${p0.blurb[0].toUpperCase() + p0.blurb.slice(1)}, against ${p1.blurb}.`,
    players: [p0, p1],
  };
}

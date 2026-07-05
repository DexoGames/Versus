import type { GridlockState, Point } from "./types";

/**
 * Mutable Gridlock simulation — the single source of rules truth.
 *
 * The pure engine builds a Sim from state, applies one move, and converts
 * back; the CPU search keeps one Sim alive and walks the tree with
 * apply/undo. Both therefore share identical legality, capture and win logic.
 *
 * Enclosure detection is the Unity polygon model (EnclosureDetector +
 * Gridlock.CalculateAreas): when the head lands on an already-visited dot, a
 * BFS over chain positions finds the smallest closed loop of drawn segments
 * through that dot — diagonals included. Scoring samples four quarter-points
 * per cell (each worth 0.25) against the loop polygon, so a diagonal triangle
 * scores 0.5 and a loop over two crossing diagonals can score just 0.25.
 * Earlier areas keep their quarters; a new area only claims unowned ones.
 */

export interface Area {
  /** Closed loop of dots (implicitly closed back to vertices[0]). */
  vertices: Point[];
  player: number;
}

export interface Sim {
  n: number; // dots per side
  pc: number;
  chains: Point[][];
  /** All drawn segments (incl. diagonals), normalised endpoint-pair keys. */
  edges: Set<number>;
  /** Visit count per dot — a capture can only happen on a revisited dot. */
  visits: Uint8Array;
  /** Captured loops in creation order (creation order = claim priority). */
  areas: Area[];
  /**
   * Owner per quarter-sample, -1 = unclaimed. Four samples per cell at
   * offsets (.25,.5) (.75,.5) (.5,.25) (.5,.75); index = cell*4 + k.
   */
  quarterOwner: Int8Array;
  scores: number[];
  /** Capture events per player (drives the CPU's consolidation bonus). */
  regionCounts: number[];
  currentPlayer: number;
  turnCount: number;
  over: boolean;
  winners: number[];
  winReason: GridlockState["winReason"];
}

export interface UndoRecord {
  player: number;
  prevCurrentPlayer: number;
  prevTurnCount: number;
  prevOver: boolean;
  prevWinners: number[];
  prevWinReason: GridlockState["winReason"];
  edgeKey: number;
  targetDot: number;
  /** The captured loop, or null if the move captured nothing. */
  areaVertices: Point[] | null;
  claimedQuarters: number[];
}

export function edgeKey(a: Point, b: Point): number {
  const ka = a.x * 16 + a.y;
  const kb = b.x * 16 + b.y;
  return ka < kb ? ka * 256 + kb : kb * 256 + ka;
}

export const START_CORNERS = (n: number): Point[] => [
  { x: n - 1, y: 0 },
  { x: 0, y: n - 1 },
  { x: 0, y: 0 },
  { x: n - 1, y: n - 1 },
];

export function createInitialState(gridSize: number, playerCount: number): GridlockState {
  const corners = START_CORNERS(gridSize);
  return {
    config: { gridSize, playerCount },
    chains: corners.slice(0, playerCount).map((c) => [c]),
    regions: [],
    scores: new Array(playerCount).fill(0),
    currentPlayer: 0,
    // Starts at 1: player 0's opening turn is a single move.
    turnCount: 1,
    over: false,
    winners: [],
    winReason: null,
  };
}

export function buildSim(state: GridlockState): Sim {
  const n = state.config.gridSize;
  const pc = state.config.playerCount;
  const nc = n - 1;
  const sim: Sim = {
    n,
    pc,
    chains: state.chains.map((c) => c.map((p) => ({ x: p.x, y: p.y }))),
    edges: new Set(),
    visits: new Uint8Array(n * n),
    areas: [],
    quarterOwner: new Int8Array(nc * nc * 4).fill(-1),
    scores: new Array(pc).fill(0),
    regionCounts: new Array(pc).fill(0),
    currentPlayer: state.currentPlayer,
    turnCount: state.turnCount,
    over: state.over,
    winners: state.winners.slice(),
    winReason: state.winReason,
  };
  for (const chain of sim.chains) {
    for (let i = 0; i < chain.length; i++) {
      sim.visits[chain[i].x * n + chain[i].y]++;
      if (i > 0) sim.edges.add(edgeKey(chain[i - 1], chain[i]));
    }
  }
  // Replaying captures in order reproduces quarter ownership and scores
  // exactly (earlier areas claim first).
  for (const region of state.regions) {
    const claimed = claimQuarters(sim, region.vertices, region.player);
    sim.areas.push({ vertices: region.vertices.map((p) => ({ x: p.x, y: p.y })), player: region.player });
    sim.regionCounts[region.player]++;
    sim.scores[region.player] += claimed.length * 0.25;
  }
  return sim;
}

/**
 * Legal extensions from a dot: orthogonal neighbours over undrawn edges;
 * if none exist, diagonals over undrawn edges (Unity's stuck fallback).
 */
export function movesFrom(sim: Sim, x: number, y: number): Point[] {
  const moves: Point[] = [];
  const onGrid = (px: number, py: number) =>
    px >= 0 && px < sim.n && py >= 0 && py < sim.n;

  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (!onGrid(nx, ny)) continue;
    if (sim.edges.has(edgeKey({ x, y }, { x: nx, y: ny }))) continue;
    moves.push({ x: nx, y: ny });
  }
  if (moves.length > 0) return moves;

  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (!onGrid(nx, ny)) continue;
    if (sim.edges.has(edgeKey({ x, y }, { x: nx, y: ny }))) continue;
    moves.push({ x: nx, y: ny });
  }
  return moves;
}

export function movesForPlayer(sim: Sim, player: number): Point[] {
  const chain = sim.chains[player];
  const tail = chain[chain.length - 1];
  return movesFrom(sim, tail.x, tail.y);
}

/* ------------------------------------------------------------------ */
/* polygon geometry (ports of the Unity helpers)                       */
/* ------------------------------------------------------------------ */

/** Shoelace area of a closed dot loop. */
export function polygonArea(vertices: Point[]): number {
  let area = 0;
  let j = vertices.length - 1;
  for (let i = 0; i < vertices.length; i++) {
    area += (vertices[j].x + vertices[i].x) * (vertices[j].y - vertices[i].y);
    j = i;
  }
  return Math.abs(area / 2);
}

/**
 * Even-odd point-in-polygon (port of Gridlock.IsPointInPolygon). Used for the
 * quarter-sample tests — samples never sit exactly on a drawable segment.
 */
export function pointInPolygon(px: number, py: number, poly: Point[]): boolean {
  let result = false;
  let j = poly.length - 1;
  for (let i = 0; i < poly.length; i++) {
    if (
      (poly[i].y < py && poly[j].y >= py) ||
      (poly[j].y < py && poly[i].y >= py)
    ) {
      if (
        poly[i].x +
          ((py - poly[i].y) / (poly[j].y - poly[i].y)) * (poly[j].x - poly[i].x) <
        px
      ) {
        result = !result;
      }
    }
    j = i;
  }
  return result;
}

/**
 * Port of PolygonChecker.IsPointInPolygon: a point ON the boundary counts as
 * outside. That exactness matters — a new segment whose midpoint lies on an
 * existing area's diagonal edge (two crossing diagonals) must still be
 * allowed to capture, which is where 0.25-point regions come from.
 */
function pointInPolygonStrict(px: number, py: number, poly: Point[]): boolean {
  let intersections = 0;
  for (let i = 0; i < poly.length; i++) {
    const v1 = poly[i];
    const v2 = poly[(i + 1) % poly.length];
    if (pointOnSegment(v1, v2, px, py)) return false;
    if (rayIntersectsSegment(px, py, v1, v2)) intersections++;
  }
  return intersections % 2 !== 0;
}

function pointOnSegment(p1: Point, p2: Point, px: number, py: number): boolean {
  if (
    px < Math.min(p1.x, p2.x) || px > Math.max(p1.x, p2.x) ||
    py < Math.min(p1.y, p2.y) || py > Math.max(p1.y, p2.y)
  ) {
    return false;
  }
  const cross = (py - p1.y) * (p2.x - p1.x) - (px - p1.x) * (p2.y - p1.y);
  return Math.abs(cross) < 1e-9;
}

function rayIntersectsSegment(px: number, py: number, a: Point, b: Point): boolean {
  let v1 = a;
  let v2 = b;
  if (v1.y > v2.y) {
    v1 = b;
    v2 = a;
  }
  if (py === v1.y || py === v2.y) py += 0.0001;
  if (py < v1.y || py > v2.y || px > Math.max(v1.x, v2.x)) return false;
  if (px < Math.min(v1.x, v2.x)) return true;
  const slope = (v2.x - v1.x) / (v2.y - v1.y);
  return px < v1.x + (py - v1.y) * slope;
}

/* ------------------------------------------------------------------ */
/* enclosure detection (port of EnclosureDetector.GoDownBranchBFS)     */
/* ------------------------------------------------------------------ */

/**
 * All closed loops of drawn segments through the mover's new head, found by
 * walking chain positions and hopping between chains at shared dots. Keeps
 * the Unity BFS's global visited set, quirks and all.
 */
function collectCycles(sim: Sim, player: number): Point[][] {
  const chains = sim.chains;
  const startIndex = chains[player].length - 1;
  const start = chains[player][startIndex];
  const results: Point[][] = [];
  const visited = new Set<number>();
  const key = (p: number, i: number) => p * 4096 + i;

  const queue: Array<{ verts: Point[]; player: number; index: number }> = [
    { verts: [start], player, index: startIndex },
  ];
  visited.add(key(player, startIndex));

  for (let qi = 0; qi < queue.length; qi++) {
    const node = queue[qi];
    const chain = chains[node.player];
    for (const step of [-1, 1] as const) {
      const ni = node.index + step;
      if (ni < 0 || ni >= chain.length || visited.has(key(node.player, ni))) continue;
      visited.add(key(node.player, ni));

      const dot = chain[ni];
      if (dot.x === start.x && dot.y === start.y && node.verts.length > 2) {
        results.push(node.verts);
        continue;
      }
      if (node.verts.some((v) => v.x === dot.x && v.y === dot.y)) continue;

      const extended = [...node.verts, dot];
      // Hop onto every other chain position sharing this dot.
      for (let p2 = 0; p2 < chains.length; p2++) {
        const other = chains[p2];
        for (let i2 = 0; i2 < other.length; i2++) {
          if (p2 === node.player && i2 === ni) continue;
          if (other[i2].x !== dot.x || other[i2].y !== dot.y) continue;
          if (visited.has(key(p2, i2))) continue;
          visited.add(key(p2, i2));
          queue.push({ verts: extended, player: p2, index: i2 });
        }
      }
      queue.push({ verts: extended, player: node.player, index: ni });
    }
  }
  return results;
}

/**
 * The loop captured by the mover's latest segment: the smallest-area cycle
 * through the new head — unless the segment's midpoint already sits inside a
 * captured area (you can't re-capture inside claimed territory).
 */
function findEnclosure(sim: Sim, player: number): Point[] | null {
  const chain = sim.chains[player];
  const head = chain[chain.length - 1];
  const prev = chain[chain.length - 2];
  const mx = (head.x + prev.x) / 2;
  const my = (head.y + prev.y) / 2;
  for (const area of sim.areas) {
    if (pointInPolygonStrict(mx, my, area.vertices)) return null;
  }

  let best: Point[] | null = null;
  let bestArea = Infinity;
  for (const cycle of collectCycles(sim, player)) {
    const a = polygonArea(cycle);
    if (a < bestArea) {
      bestArea = a;
      best = cycle;
    }
  }
  return best;
}

/** Sample offsets within a cell — the four quarter-triangle centres. */
const QUARTER_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0.25, 0.5],
  [0.75, 0.5],
  [0.5, 0.25],
  [0.5, 0.75],
];

/**
 * Claims every unowned quarter-sample inside the polygon for `player` and
 * returns the claimed indices. Earlier areas always keep their quarters, so
 * replaying captures in order is exact (mirrors CalculateAreas' smallest-num
 * priority).
 */
function claimQuarters(sim: Sim, poly: Point[], player: number): number[] {
  return claimQuartersInto(sim.quarterOwner, sim.n - 1, poly, player);
}

function claimQuartersInto(
  quarterOwner: Int8Array,
  nc: number,
  poly: Point[],
  player: number,
): number[] {
  const claimed: number[] = [];
  for (let cy = 0; cy < nc; cy++) {
    for (let cx = 0; cx < nc; cx++) {
      for (let k = 0; k < 4; k++) {
        const idx = (cy * nc + cx) * 4 + k;
        if (quarterOwner[idx] !== -1) continue;
        if (pointInPolygon(cx + QUARTER_OFFSETS[k][0], cy + QUARTER_OFFSETS[k][1], poly)) {
          quarterOwner[idx] = player;
          claimed.push(idx);
        }
      }
    }
  }
  return claimed;
}

/** Points each capture in `state.regions` is worth, replayed in order. */
export function regionValues(state: GridlockState): number[] {
  const nc = state.config.gridSize - 1;
  const quarterOwner = new Int8Array(nc * nc * 4).fill(-1);
  return state.regions.map(
    (region) =>
      claimQuartersInto(quarterOwner, nc, region.vertices, region.player).length * 0.25,
  );
}

/** Ranked winner check, port of Gridlock.CheckForWinner (scores are floats). */
export function checkWinnerScores(
  scores: number[],
  n: number,
  frozen: boolean,
): number[] {
  const totalCells = (n - 1) * (n - 1);
  const total = scores.reduce((a, b) => a + b, 0);
  const ordered = scores
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s);

  if (frozen || totalCells - total === 0) {
    return ordered.filter(({ s }) => s === ordered[0].s).map(({ i }) => i);
  }
  if (ordered[0].s > totalCells - total + ordered[1].s) {
    return [ordered[0].i];
  }
  return [];
}

/**
 * Applies a move for sim.currentPlayer (assumed legal), scores captures,
 * checks the win and advances to the next player who can move — skipping
 * gridlocked players and declaring a frozen game if nobody can.
 * Returns an undo record for search use.
 */
export function applySimMove(sim: Sim, move: Point): UndoRecord {
  const player = sim.currentPlayer;
  const chain = sim.chains[player];
  const tail = chain[chain.length - 1];

  const undo: UndoRecord = {
    player,
    prevCurrentPlayer: sim.currentPlayer,
    prevTurnCount: sim.turnCount,
    prevOver: sim.over,
    prevWinners: sim.winners,
    prevWinReason: sim.winReason,
    edgeKey: edgeKey(tail, move),
    targetDot: move.x * sim.n + move.y,
    areaVertices: null,
    claimedQuarters: [],
  };

  chain.push({ x: move.x, y: move.y });
  sim.edges.add(undo.edgeKey);
  sim.visits[undo.targetDot]++;

  // A capture is only possible when the head lands on an already-visited dot.
  if (sim.visits[undo.targetDot] > 1) {
    const loop = findEnclosure(sim, player);
    if (loop) {
      const claimed = claimQuarters(sim, loop, player);
      sim.areas.push({ vertices: loop, player });
      sim.scores[player] += claimed.length * 0.25;
      sim.regionCounts[player]++;
      undo.areaVertices = loop;
      undo.claimedQuarters = claimed;
    }
  }

  // Win check first (mirrors Unity EndTurn), then advance with skip logic.
  const winners = checkWinnerScores(sim.scores, sim.n, false);
  if (winners.length > 0) {
    sim.over = true;
    sim.winners = winners;
    const totalCells = (sim.n - 1) * (sim.n - 1);
    const total = sim.scores.reduce((a, b) => a + b, 0);
    sim.winReason = totalCells - total === 0 ? "board-full" : "insurmountable";
    return undo;
  }

  let loops = 0;
  do {
    sim.turnCount = (sim.turnCount + 1) % 2;
    if (sim.turnCount === 0) {
      sim.currentPlayer = (sim.currentPlayer + 1) % sim.pc;
    }
    loops++;
    if (loops > sim.pc * 2 + 1) {
      sim.over = true;
      sim.winners = checkWinnerScores(sim.scores, sim.n, true);
      sim.winReason = "gridlocked";
      return undo;
    }
  } while (movesForPlayer(sim, sim.currentPlayer).length === 0);

  return undo;
}

export function undoSimMove(sim: Sim, undo: UndoRecord): void {
  const chain = sim.chains[undo.player];
  chain.pop();
  sim.edges.delete(undo.edgeKey);
  sim.visits[undo.targetDot]--;
  if (undo.areaVertices) {
    sim.areas.pop();
    sim.regionCounts[undo.player]--;
    sim.scores[undo.player] -= undo.claimedQuarters.length * 0.25;
    for (const idx of undo.claimedQuarters) sim.quarterOwner[idx] = -1;
  }
  sim.currentPlayer = undo.prevCurrentPlayer;
  sim.turnCount = undo.prevTurnCount;
  sim.over = undo.prevOver;
  sim.winners = undo.prevWinners;
  sim.winReason = undo.prevWinReason;
}

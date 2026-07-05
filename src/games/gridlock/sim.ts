import type { GridlockState, Point } from "./types";

/**
 * Mutable Gridlock simulation — the single source of rules truth.
 *
 * The pure engine builds a Sim from state, applies one move, and converts
 * back; the CPU search keeps one Sim alive and walks the tree with
 * apply/undo. Both therefore share identical legality, capture and win logic.
 *
 * Enclosure detection is a grid flood-fill (not the Unity polygon BFS): cells
 * that can no longer reach the outside through undrawn lattice edges are
 * captured by the player who just moved. Diagonal edges (the stuck-player
 * fallback move) never wall cells off — a region only scores once it is
 * orthogonally sealed — but they still count as drawn edges for legality.
 */

export interface Sim {
  n: number; // dots per side
  pc: number;
  chains: Point[][];
  /** All drawn segments (incl. diagonals), normalised endpoint-pair keys. */
  edges: Set<number>;
  /** Orthogonal walls for the flood fill. vWall[x][y]: (x,y)-(x,y+1). */
  vWall: Uint8Array;
  /** hWall[y][x]: (x,y)-(x+1,y). */
  hWall: Uint8Array;
  /** Visit count per dot — a capture can only happen on a revisited dot. */
  visits: Uint8Array;
  cellOwner: Int8Array;
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
  wall: { which: "v" | "h"; index: number } | null;
  targetDot: number;
  capturedCells: number[];
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
    cellOwner: new Array((gridSize - 1) * (gridSize - 1)).fill(-1),
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
  const sim: Sim = {
    n,
    pc,
    chains: state.chains.map((c) => c.map((p) => ({ x: p.x, y: p.y }))),
    edges: new Set(),
    vWall: new Uint8Array(n * (n - 1)),
    hWall: new Uint8Array(n * (n - 1)),
    visits: new Uint8Array(n * n),
    cellOwner: Int8Array.from(state.cellOwner),
    scores: state.scores.slice(),
    regionCounts: new Array(pc).fill(0),
    currentPlayer: state.currentPlayer,
    turnCount: state.turnCount,
    over: state.over,
    winners: state.winners.slice(),
    winReason: state.winReason,
  };
  for (const region of state.regions) sim.regionCounts[region.player]++;
  for (const chain of sim.chains) {
    for (let i = 0; i < chain.length; i++) {
      sim.visits[chain[i].x * n + chain[i].y]++;
      if (i > 0) addEdge(sim, chain[i - 1], chain[i]);
    }
  }
  return sim;
}

function addEdge(sim: Sim, a: Point, b: Point): { which: "v" | "h"; index: number } | null {
  sim.edges.add(edgeKey(a, b));
  if (a.x === b.x && Math.abs(a.y - b.y) === 1) {
    const index = a.x * (sim.n - 1) + Math.min(a.y, b.y);
    sim.vWall[index] = 1;
    return { which: "v", index };
  }
  if (a.y === b.y && Math.abs(a.x - b.x) === 1) {
    const index = a.y * (sim.n - 1) + Math.min(a.x, b.x);
    sim.hWall[index] = 1;
    return { which: "h", index };
  }
  return null; // diagonal: drawn but never a flood-fill wall
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

/**
 * Flood-fill from outside the board; returns unclaimed cells that can no
 * longer be reached — i.e. cells newly sealed by drawn lines.
 */
export function findNewlyEnclosed(sim: Sim): number[] {
  const nc = sim.n - 1;
  const reached = new Uint8Array(nc * nc);
  const queue: number[] = [];

  // Seed from every boundary cell whose outer side is undrawn.
  for (let cy = 0; cy < nc; cy++) {
    if (!sim.vWall[0 * nc + cy]) queue.push(cy * nc + 0);
    if (!sim.vWall[(sim.n - 1) * nc + cy]) queue.push(cy * nc + (nc - 1));
  }
  for (let cx = 0; cx < nc; cx++) {
    if (!sim.hWall[0 * nc + cx]) queue.push(0 * nc + cx);
    if (!sim.hWall[(sim.n - 1) * nc + cx]) queue.push((nc - 1) * nc + cx);
  }

  for (const c of queue) reached[c] = 1;
  while (queue.length > 0) {
    const cell = queue.pop()!;
    const cx = cell % nc;
    const cy = (cell - cx) / nc;
    // Right neighbour: blocked by vertical wall at dot column cx+1.
    if (cx + 1 < nc && !reached[cell + 1] && !sim.vWall[(cx + 1) * nc + cy]) {
      reached[cell + 1] = 1;
      queue.push(cell + 1);
    }
    if (cx - 1 >= 0 && !reached[cell - 1] && !sim.vWall[cx * nc + cy]) {
      reached[cell - 1] = 1;
      queue.push(cell - 1);
    }
    // Up neighbour: blocked by horizontal wall at dot row cy+1.
    if (cy + 1 < nc && !reached[cell + nc] && !sim.hWall[(cy + 1) * nc + cx]) {
      reached[cell + nc] = 1;
      queue.push(cell + nc);
    }
    if (cy - 1 >= 0 && !reached[cell - nc] && !sim.hWall[cy * nc + cx]) {
      reached[cell - nc] = 1;
      queue.push(cell - nc);
    }
  }

  const captured: number[] = [];
  for (let c = 0; c < nc * nc; c++) {
    if (!reached[c] && sim.cellOwner[c] === -1) captured.push(c);
  }
  return captured;
}

/** Ranked winner check, port of Gridlock.CheckForWinner. */
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
    wall: null,
    targetDot: move.x * sim.n + move.y,
    capturedCells: [],
  };

  chain.push({ x: move.x, y: move.y });
  undo.wall = addEdge(sim, tail, move);
  sim.visits[undo.targetDot]++;

  // A capture is only possible when the head lands on an already-visited dot.
  if (sim.visits[undo.targetDot] > 1) {
    const captured = findNewlyEnclosed(sim);
    if (captured.length > 0) {
      for (const cell of captured) sim.cellOwner[cell] = player;
      sim.scores[player] += captured.length;
      sim.regionCounts[player]++;
      undo.capturedCells = captured;
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
  if (undo.wall) {
    (undo.wall.which === "v" ? sim.vWall : sim.hWall)[undo.wall.index] = 0;
  }
  sim.visits[undo.targetDot]--;
  if (undo.capturedCells.length > 0) {
    for (const cell of undo.capturedCells) sim.cellOwner[cell] = -1;
    sim.scores[undo.player] -= undo.capturedCells.length;
    sim.regionCounts[undo.player]--;
  }
  sim.currentPlayer = undo.prevCurrentPlayer;
  sim.turnCount = undo.prevTurnCount;
  sim.over = undo.prevOver;
  sim.winners = undo.prevWinners;
  sim.winReason = undo.prevWinReason;
}

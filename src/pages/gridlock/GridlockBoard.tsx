import { useMemo } from "react";
import { PLAYER_COLORS } from "../../games/types";
import type { GridlockState, Point } from "../../games/gridlock/types";
import styles from "./GridlockBoard.module.css";

const CELL = 72;
const PAD = 34;

interface GridlockBoardProps {
  state: GridlockState;
  /** Legal targets for the local player to act; empty = board not interactive. */
  legalMoves: Point[];
  onMove: (move: Point) => void;
}

/**
 * SVG board: dots as small squares, chains as coloured polylines, captured
 * cells as translucent fills that sweep in. y is flipped so (0,0) sits
 * bottom-left, matching the Unity layout (P0 starts bottom-right).
 */
export function GridlockBoard({ state, legalMoves, onMove }: GridlockBoardProps) {
  const n = state.config.gridSize;
  const size = PAD * 2 + CELL * (n - 1);

  const toSvg = (p: Point) => ({
    x: PAD + p.x * CELL,
    y: PAD + (n - 1 - p.y) * CELL,
  });

  const heads = state.chains.map((chain) => chain[chain.length - 1]);

  // Cells captured by the most recent region sweep in with a slight stagger.
  const latestRegion = state.regions[state.regions.length - 1];

  const cellRects = useMemo(() => {
    const nc = n - 1;
    const rects: Array<{ cx: number; cy: number; owner: number; fresh: boolean; order: number }> = [];
    for (let cy = 0; cy < nc; cy++) {
      for (let cx = 0; cx < nc; cx++) {
        const owner = state.cellOwner[cy * nc + cx];
        if (owner < 0) continue;
        const cellIndex = cy * nc + cx;
        const freshIdx = latestRegion ? latestRegion.cells.indexOf(cellIndex) : -1;
        rects.push({
          cx,
          cy,
          owner,
          fresh: freshIdx >= 0,
          order: Math.max(freshIdx, 0),
        });
      }
    }
    return rects;
  }, [state.cellOwner, latestRegion, n]);

  return (
    <svg
      className={styles.board}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Gridlock board"
    >
      {/* captured cells */}
      {cellRects.map(({ cx, cy, owner, fresh, order }) => {
        const topLeft = toSvg({ x: cx, y: cy + 1 });
        return (
          <rect
            key={`cell-${cx}-${cy}`}
            className={fresh ? styles.cellFresh : styles.cell}
            style={fresh ? { animationDelay: `${order * 60}ms` } : undefined}
            x={topLeft.x}
            y={topLeft.y}
            width={CELL}
            height={CELL}
            fill={PLAYER_COLORS[owner % PLAYER_COLORS.length]}
          />
        );
      })}

      {/* faint lattice */}
      {Array.from({ length: n }, (_, i) => (
        <g key={`lattice-${i}`}>
          <line
            className={styles.lattice}
            x1={PAD + i * CELL}
            y1={PAD}
            x2={PAD + i * CELL}
            y2={size - PAD}
          />
          <line
            className={styles.lattice}
            x1={PAD}
            y1={PAD + i * CELL}
            x2={size - PAD}
            y2={PAD + i * CELL}
          />
        </g>
      ))}

      {/* chains */}
      {state.chains.map((chain, player) => {
        if (chain.length < 2) return null;
        const points = chain.map((p) => {
          const s = toSvg(p);
          return `${s.x},${s.y}`;
        });
        return (
          <polyline
            key={`chain-${player}`}
            className={styles.chain}
            points={points.join(" ")}
            stroke={PLAYER_COLORS[player % PLAYER_COLORS.length]}
          />
        );
      })}

      {/* dots */}
      {Array.from({ length: n * n }, (_, i) => {
        const x = i % n;
        const y = Math.floor(i / n);
        const s = toSvg({ x, y });
        return (
          <rect
            key={`dot-${x}-${y}`}
            className={styles.dot}
            x={s.x - 4}
            y={s.y - 4}
            width={8}
            height={8}
          />
        );
      })}

      {/* chain heads */}
      {heads.map((head, player) => {
        const s = toSvg(head);
        return (
          <rect
            key={`head-${player}`}
            className={styles.head}
            x={s.x - 8}
            y={s.y - 8}
            width={16}
            height={16}
            fill={PLAYER_COLORS[player % PLAYER_COLORS.length]}
          />
        );
      })}

      {/* legal targets */}
      {legalMoves.map((move) => {
        const s = toSvg(move);
        const from = toSvg(heads[state.currentPlayer]);
        return (
          <g key={`target-${move.x}-${move.y}`}>
            <line
              className={styles.ghostLine}
              x1={from.x}
              y1={from.y}
              x2={s.x}
              y2={s.y}
              stroke={PLAYER_COLORS[state.currentPlayer % PLAYER_COLORS.length]}
            />
            <rect
              className={styles.target}
              x={s.x - 13}
              y={s.y - 13}
              width={26}
              height={26}
              stroke={PLAYER_COLORS[state.currentPlayer % PLAYER_COLORS.length]}
              onClick={() => onMove(move)}
            />
          </g>
        );
      })}
    </svg>
  );
}

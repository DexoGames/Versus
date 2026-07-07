import { useMemo } from "react";
import { PLAYER_COLORS, type SeatConfig } from "../../games/types";
import { regionValues } from "../../games/gridlock/sim";
import type { GridlockState, Point } from "../../games/gridlock/types";
import { cx } from "../../lib/cx";
import styles from "./GridlockBoard.module.css";

const CELL = 72;
const PAD = 34;

interface GridlockBoardProps {
  state: GridlockState;
  /** Legal targets for the local player to act; empty = board not interactive. */
  legalMoves: Point[];
  onMove: (move: Point) => void;
  /** Seats, so each score badge can sit at its player's home corner. */
  seats: SeatConfig[];
  /** Winning seats once the game is over (for badge highlight). */
  winners: number[];
  over: boolean;
}

/**
 * SVG board: dots as small squares, chains as coloured polylines, captured
 * loops as translucent polygons (diagonal triangles included) that sweep in.
 * y is flipped so (0,0) sits bottom-left, matching the Unity layout (P0
 * starts bottom-right). Score badges sit in slim rows directly above and
 * below the board, aligned with each player's home corner — in flow, so they
 * can never overlap the grid. The freshest stretch of every chain is drawn a
 * touch brighter so heads stay findable in a cramped endgame.
 */
export function GridlockBoard({
  state,
  legalMoves,
  onMove,
  seats,
  winners,
  over,
}: GridlockBoardProps) {
  const n = state.config.gridSize;
  const size = PAD * 2 + CELL * (n - 1);

  const toSvg = (p: Point) => ({
    x: PAD + p.x * CELL,
    y: PAD + (n - 1 - p.y) * CELL,
  });

  const heads = state.chains.map((chain) => chain[chain.length - 1]);

  // Points each capture was worth (earlier regions claim overlaps first).
  const values = useMemo(() => regionValues(state), [state]);
  const latestRegion = state.regions[state.regions.length - 1];
  const latestValue = values[state.regions.length - 1];

  // Badges live in slim rows above (top corners) and below (bottom corners)
  // the board, each aligned to its player's home corner side.
  const badge = (player: number) => {
    const color = PLAYER_COLORS[player % PLAYER_COLORS.length];
    const active = !over && state.currentPlayer === player;
    const won = over && winners.includes(player);
    return (
      <div
        key={`badge-${player}`}
        className={cx(styles.badge, active && styles.badgeActive, won && styles.badgeWon)}
        style={{ ["--pc" as string]: color }}
      >
        <span className={styles.badgeName}>{seats[player]?.name ?? `P${player + 1}`}</span>
        <span className={styles.badgeScore}>{state.scores[player]}</span>
      </div>
    );
  };
  const badgeRow = (isTop: boolean) => {
    const onRow = (c: Point) => (isTop ? c.y === n - 1 : c.y === 0);
    const players = state.chains
      .map((chain, player) => ({ corner: chain[0], player }))
      .filter(({ corner }) => onRow(corner));
    return (
      <div className={styles.badgeRow}>
        <span>{players.filter(({ corner }) => corner.x === 0).map(({ player }) => badge(player))}</span>
        <span>{players.filter(({ corner }) => corner.x !== 0).map(({ player }) => badge(player))}</span>
      </div>
    );
  };

  return (
    <div className={styles.wrap}>
      {badgeRow(true)}
      <svg
        className={styles.board}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Gridlock board"
      >
        {/* captured loops — later regions first so earlier ones paint on top,
            matching their claim priority */}
        {[...state.regions].reverse().map((region) => {
          const fresh = region === latestRegion;
          const pts = region.vertices
            .map((v) => {
              const s = toSvg(v);
              return `${s.x},${s.y}`;
            })
            .join(" ");
          return (
            <polygon
              key={`region-${region.id}`}
              className={fresh ? styles.cellFresh : styles.cell}
              points={pts}
              fill={PLAYER_COLORS[region.player % PLAYER_COLORS.length]}
              fillRule="evenodd"
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

        {/* chains — base line, then the freshest 1–2 segments brightened */}
        {state.chains.map((chain, player) => {
          if (chain.length < 2) return null;
          const color = PLAYER_COLORS[player % PLAYER_COLORS.length];
          const points = chain.map((p) => {
            const s = toSvg(p);
            return `${s.x},${s.y}`;
          });
          const recent = chain.slice(Math.max(0, chain.length - 3)).map((p) => {
            const s = toSvg(p);
            return `${s.x},${s.y}`;
          });
          return (
            <g key={`chain-${player}`}>
              <polyline className={styles.chain} points={points.join(" ")} stroke={color} />
              <polyline className={styles.recent} points={recent.join(" ")} stroke={color} />
            </g>
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

        {/* chain heads — a filled marker inside a light ring so the newest
            position of each player pops even when lines are tangled */}
        {heads.map((head, player) => {
          const s = toSvg(head);
          const color = PLAYER_COLORS[player % PLAYER_COLORS.length];
          return (
            <g key={`head-${player}`}>
              <rect
                className={styles.headRing}
                x={s.x - 11}
                y={s.y - 11}
                width={22}
                height={22}
              />
              <rect
                className={styles.head}
                x={s.x - 7}
                y={s.y - 7}
                width={14}
                height={14}
                fill={color}
              />
            </g>
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

        {/* score popup floating out of the freshest capture — only when it
            actually scored something */}
        {latestRegion &&
          latestValue > 0 &&
          (() => {
            const centroid = latestRegion.vertices.reduce(
              (acc, v) => {
                const s = toSvg(v);
                return { x: acc.x + s.x, y: acc.y + s.y };
              },
              { x: 0, y: 0 },
            );
            const cx0 = centroid.x / latestRegion.vertices.length;
            const cy0 = centroid.y / latestRegion.vertices.length;
            return (
              <text
                key={`pop-${latestRegion.id}`}
                className={styles.scorePop}
                x={cx0}
                y={cy0}
                textAnchor="middle"
                fill={PLAYER_COLORS[latestRegion.player % PLAYER_COLORS.length]}
              >
                +{latestValue}
              </text>
            );
          })()}
      </svg>
      {badgeRow(false)}
    </div>
  );
}

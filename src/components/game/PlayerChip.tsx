import { cx } from "../../lib/cx";
import { PLAYER_COLORS } from "../../games/types";
import type { SeatConfig } from "../../games/types";
import styles from "./PlayerChip.module.css";

interface PlayerChipProps {
  seat: SeatConfig;
  index: number;
  score?: number | string;
  active?: boolean;
  /** Small note under the name, e.g. "thinking…" or "bid locked". */
  note?: string;
  won?: boolean;
}

export function PlayerChip({ seat, index, score, active, note, won }: PlayerChipProps) {
  const color = PLAYER_COLORS[index % PLAYER_COLORS.length];
  return (
    <div
      className={cx(styles.chip, active && styles.active, won && styles.won)}
      style={{ ["--chip-color" as string]: color }}
    >
      <span className={styles.swatch} />
      <span className={styles.name}>
        {seat.name}
        {seat.kind === "cpu" && <span className={styles.kind}> CPU</span>}
        {seat.kind === "remote" && <span className={styles.kind}> NET</span>}
      </span>
      {score !== undefined && <span className={styles.score}>{score}</span>}
      {note && <span className={styles.note}>{note}</span>}
    </div>
  );
}

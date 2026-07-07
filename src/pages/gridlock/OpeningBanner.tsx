import { useEffect, useRef, useState } from "react";
import { PLAYER_COLORS, type SeatConfig } from "../../games/types";
import { identifyOpening, type OpeningResult } from "../../games/gridlock/openings";
import type { GridlockState } from "../../games/gridlock/types";
import styles from "./OpeningBanner.module.css";

/**
 * A quiet one-line opening read for 6×6 two-player Gridlock, sized for the
 * status row above the board. Renders nothing (the row's space is already
 * reserved) until the opening is identifiable, then latches each player's
 * line — no book title, no placeholder text.
 */
export function OpeningBanner({
  state,
  seats,
}: {
  state: GridlockState;
  seats: SeatConfig[];
}) {
  const applicable =
    state.config.playerCount === 2 && state.config.gridSize === 6;

  // Latch the first identification so the label never flickers or re-reads.
  const locked = useRef<OpeningResult | null>(null);
  const [opening, setOpening] = useState<OpeningResult | null>(null);

  useEffect(() => {
    if (!applicable || locked.current) return;
    const found = identifyOpening(state);
    if (found) {
      locked.current = found;
      setOpening(found);
    }
  }, [state, applicable]);

  if (!applicable || !opening) return null;

  return (
    <span className={styles.line}>
      {opening.players.map((p, i) => (
        <span key={i} className={styles.pair}>
          <span
            className={styles.who}
            style={{ color: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
          >
            {seats[i]?.name ?? `P${i + 1}`}
          </span>
          <span className={styles.playName}>{p.name}</span>
        </span>
      ))}
    </span>
  );
}

import { useEffect } from "react";
import { PLAYER_COLORS } from "../../games/types";
import type { SpelloutState } from "../../games/spellout/types";
import { cx } from "../../lib/cx";
import styles from "./SpelloutBoard.module.css";

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

interface SpelloutBoardProps {
  state: SpelloutState;
  remaining: number;
  canPlay: boolean;
  onPlay: (letter: string) => void;
}

export function SpelloutBoard({ state, remaining, canPlay, onPlay }: SpelloutBoardProps) {
  // Physical keyboard support while it's a human's turn.
  useEffect(() => {
    if (!canPlay) return;
    const handler = (e: KeyboardEvent) => {
      const letter = e.key.toLowerCase();
      if (letter.length === 1 && letter >= "a" && letter <= "z") {
        onPlay(letter);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canPlay, onPlay]);

  const tiles = state.fragment.split("");
  const won = state.over && state.reason === "completed-word";
  const busted = state.over && state.reason === "dead-letter";

  return (
    <div className={styles.board}>
      <div className={cx(styles.fragment, busted && styles.fragmentBust)}>
        {tiles.length === 0 && !state.deadLetter && (
          <span className={styles.placeholder}>first letter…</span>
        )}
        {tiles.map((letter, i) => (
          <span
            key={i}
            className={cx(styles.tile, won && styles.tileWon)}
            style={{
              borderBottomColor: PLAYER_COLORS[i % state.playerCount],
              ...(won ? { animationDelay: `${i * 70}ms` } : null),
            }}
          >
            {letter}
          </span>
        ))}
        {state.deadLetter && (
          <span className={cx(styles.tile, styles.tileDead)}>{state.deadLetter}</span>
        )}
        {!state.over && <span className={styles.cursor} />}
        {busted && <span className={styles.stamp}>Not a word!</span>}
      </div>

      <p className={styles.counter}>
        {remaining.toLocaleString()} word{remaining === 1 ? "" : "s"} still possible
      </p>

      <div className={styles.keyboard}>
        {KEY_ROWS.map((row) => (
          <div key={row} className={styles.keyRow}>
            {row.split("").map((letter) => (
              <button
                key={letter}
                type="button"
                className={styles.key}
                disabled={!canPlay}
                onClick={() => onPlay(letter)}
              >
                {letter}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

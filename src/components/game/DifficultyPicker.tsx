import { DIFFICULTIES, type Difficulty } from "../../games/types";
import { cx } from "../../lib/cx";
import styles from "./DifficultyPicker.module.css";

interface DifficultyPickerProps {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  /** Some games cap out below Extreme. */
  max?: Difficulty;
}

/**
 * Difficulty as an intensity ramp: each tier has its own colour (calm green →
 * alarm red) and a signal-strength bar, so the four options read as clearly
 * different rather than four identical chips. No prose descriptions.
 */
export function DifficultyPicker({ value, onChange, max = 4 }: DifficultyPickerProps) {
  const tiers = DIFFICULTIES.filter((d) => d.level <= max);
  return (
    <div className={styles.ramp}>
      {tiers.map((d) => (
        <button
          key={d.level}
          type="button"
          className={cx(styles.tier, value === d.level && styles.selected)}
          style={{ ["--tier" as string]: `var(--diff-${d.level})` }}
          onClick={() => onChange(d.level)}
        >
          <span className={styles.bars}>
            {[1, 2, 3, 4].map((b) => (
              <span
                key={b}
                className={cx(styles.bar, b <= d.level && styles.barOn)}
                style={{ height: `${5 + b * 4}px` }}
              />
            ))}
          </span>
          <span className={styles.label}>{d.label}</span>
          <span className={styles.persona}>{d.persona}</span>
        </button>
      ))}
    </div>
  );
}

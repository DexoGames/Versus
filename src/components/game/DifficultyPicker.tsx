import { DIFFICULTIES, type Difficulty } from "../../games/types";
import { cx } from "../../lib/cx";
import styles from "./DifficultyPicker.module.css";

interface DifficultyPickerProps {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  /** Some games cap out below Extreme. */
  max?: Difficulty;
}

export function DifficultyPicker({ value, onChange, max = 4 }: DifficultyPickerProps) {
  return (
    <div className={styles.grid}>
      {DIFFICULTIES.filter((d) => d.level <= max).map((d) => (
        <button
          key={d.level}
          type="button"
          className={cx(styles.option, value === d.level && styles.selected)}
          onClick={() => onChange(d.level)}
        >
          <span className={styles.label}>{d.label}</span>
          <span className={styles.persona}>{d.persona}</span>
          <span className={styles.tagline}>{d.tagline}</span>
        </button>
      ))}
    </div>
  );
}

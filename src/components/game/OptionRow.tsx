import { cx } from "../../lib/cx";
import styles from "./OptionRow.module.css";

interface OptionRowProps<T extends string | number> {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}

/** Labelled segmented control for lobby settings. */
export function OptionRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: OptionRowProps<T>) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.options}>
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            className={cx(styles.option, value === opt.value && styles.selected)}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

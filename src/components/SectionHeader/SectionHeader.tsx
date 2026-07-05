import { cx } from "../../lib/cx";
import styles from "./SectionHeader.module.css";

interface SectionHeaderProps {
  /** Font Awesome icon name without the "fas" prefix, e.g. "fa-gamepad". */
  icon: string;
  label: string;
  description?: string;
  tone?: "black" | "cream";
}

/** Section label block: orange icon badge + bold mono label + short description. */
export function SectionHeader({
  icon,
  label,
  description,
  tone = "cream",
}: SectionHeaderProps) {
  return (
    <header className={cx(styles.header, styles[tone])}>
      <div className={styles.left}>
        <span className={styles.badge}>
          <i className={`fas ${icon}`}></i>
        </span>
        <h2 className={styles.label}>{label}</h2>
      </div>
      {description && <p className={styles.desc}>{description}</p>}
    </header>
  );
}

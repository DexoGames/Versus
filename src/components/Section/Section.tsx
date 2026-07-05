import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import styles from "./Section.module.css";

interface SectionProps {
  id?: string;
  tone?: "black" | "cream";
  /** When true the inner container drops its max-width/padding (edge to edge). */
  bleed?: boolean;
  /** Extra class for the inner container. */
  className?: string;
  children: ReactNode;
}

/** Full-bleed coloured band with a centred inner container. */
export function Section({
  id,
  tone = "cream",
  bleed = false,
  className,
  children,
}: SectionProps) {
  return (
    <section id={id} className={cx(styles.section, styles[tone])}>
      <div className={cx(styles.inner, bleed && styles.bleed, className)}>
        {children}
      </div>
    </section>
  );
}

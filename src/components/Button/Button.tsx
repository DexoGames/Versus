import type { ReactNode, MouseEvent } from "react";
import { cx } from "../../lib/cx";
import styles from "./Button.module.css";

interface ButtonProps {
  /** Renders an <a> when provided, otherwise a <button>. */
  href?: string;
  onClick?: (e: MouseEvent) => void;
  variant?: "primary" | "secondary";
  /** Open in a new tab with safe rel. Defaults to true for links. */
  external?: boolean;
  disabled?: boolean;
  /** Extra class for context-specific sizing. */
  className?: string;
  children: ReactNode;
}

/** Link or button styled to match the portfolio's btn-primary/btn-secondary. */
export function Button({
  href,
  onClick,
  variant = "primary",
  external = true,
  disabled = false,
  className,
  children,
}: ButtonProps) {
  const cls = cx(styles.btn, styles[variant], disabled && styles.disabled, className);

  if (href !== undefined) {
    const externalProps = external
      ? { target: "_blank", rel: "noopener noreferrer" }
      : {};
    return (
      <a href={href} className={cls} onClick={onClick} {...externalProps}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

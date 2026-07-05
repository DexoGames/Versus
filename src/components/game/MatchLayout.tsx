import type { ReactNode } from "react";
import styles from "./MatchLayout.module.css";

interface MatchLayoutProps {
  /** Player chips row. */
  players: ReactNode;
  /** Status/turn banner text. */
  status: ReactNode;
  children: ReactNode;
  /** Overlay (game-over card) rendered above the board. */
  overlay?: ReactNode;
  footer?: ReactNode;
}

export function MatchLayout({ players, status, children, overlay, footer }: MatchLayoutProps) {
  return (
    <div className={styles.match}>
      <div className={styles.players}>{players}</div>
      <p className={styles.status}>{status}</p>
      <div className={styles.arena}>
        {children}
        {overlay}
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}

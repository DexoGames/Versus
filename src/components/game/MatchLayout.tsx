import type { ReactNode } from "react";
import styles from "./MatchLayout.module.css";

interface MatchLayoutProps {
  /** Player chips row. Omit when the board already shows standings. */
  players?: ReactNode;
  /** Status/turn banner text. Omit when the board is self-explanatory. */
  status?: ReactNode;
  children: ReactNode;
  /** Overlay (game-over card) rendered above the board. */
  overlay?: ReactNode;
  footer?: ReactNode;
}

export function MatchLayout({ players, status, children, overlay, footer }: MatchLayoutProps) {
  return (
    <div className={styles.match}>
      {players && <div className={styles.players}>{players}</div>}
      {status && <p className={styles.status}>{status}</p>}
      <div className={styles.arena}>
        {children}
        {overlay}
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}

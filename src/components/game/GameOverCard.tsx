import { Button } from "../Button/Button";
import { PLAYER_COLORS, type SeatConfig } from "../../games/types";
import styles from "./GameOverCard.module.css";

interface GameOverCardProps {
  winners: number[];
  seats: SeatConfig[];
  /** Extra flavour line, e.g. Spellout's "BRINE would've worked". */
  detail?: string | null;
  /** Hidden for online games (a rematch needs a fresh room). */
  onRematch?: () => void;
  onBackToLobby: () => void;
}

export function GameOverCard({
  winners,
  seats,
  detail,
  onRematch,
  onBackToLobby,
}: GameOverCardProps) {
  const isDraw = winners.length !== 1;
  const title = isDraw
    ? "Draw!"
    : `${seats[winners[0]]?.name ?? "Player"} wins!`;
  const color = isDraw ? "var(--gold)" : PLAYER_COLORS[winners[0] % PLAYER_COLORS.length];

  return (
    <div className={styles.overlay}>
      <div className={styles.card} style={{ borderColor: color }}>
        <p className={styles.kicker}>Game over</p>
        <h3 className={styles.title} style={{ color }}>
          {title}
        </h3>
        {detail && <p className={styles.detail}>{detail}</p>}
        <div className={styles.actions}>
          {onRematch && <Button onClick={onRematch}>Rematch</Button>}
          <Button variant="secondary" onClick={onBackToLobby}>
            Back to lobby
          </Button>
        </div>
      </div>
    </div>
  );
}

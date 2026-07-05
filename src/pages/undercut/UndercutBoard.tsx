import { PLAYER_COLORS, type SeatConfig } from "../../games/types";
import type { RoundRecord, UndercutState } from "../../games/undercut/types";
import { cx } from "../../lib/cx";
import styles from "./UndercutBoard.module.css";

interface UndercutBoardProps {
  state: UndercutState;
  seats: SeatConfig[];
  /** Which seats have a bid locked in this round (without showing values). */
  lockedSeats: boolean[];
  /** Enabled pad range for the local bidder, or null to hide the pad. */
  padRange: [number, number] | null;
  padLabel: string;
  onBid: (n: number) => void;
  /** Hotseat privacy gate: who must confirm before the pad shows. */
  gate: string | null;
  onGateOpen: () => void;
}

export function UndercutBoard({
  state,
  seats,
  lockedSeats,
  padRange,
  padLabel,
  onBid,
  gate,
  onGateOpen,
}: UndercutBoardProps) {
  const aim = state.config.scoreAim;
  const lastRound: RoundRecord | null =
    state.history.length > 0 ? state.history[state.history.length - 1] : null;

  return (
    <div className={styles.board}>
      {/* score sliders */}
      <div className={styles.scores}>
        {seats.map((seat, i) => (
          <div key={i} className={styles.scoreRow}>
            <span className={styles.scoreName} style={{ color: PLAYER_COLORS[i] }}>
              {seat.name}
            </span>
            <div className={styles.bar}>
              <div
                className={styles.barFill}
                style={{
                  width: `${Math.min(100, (state.scores[i] / aim) * 100)}%`,
                  background: PLAYER_COLORS[i],
                }}
              />
              {lockedSeats[i] && !state.over && (
                <span className={styles.locked}>
                  <i className="fas fa-lock"></i>
                </span>
              )}
            </div>
            <span className={styles.scoreNum}>
              {state.scores[i]}
              <span className={styles.scoreAim}>/{aim}</span>
            </span>
          </div>
        ))}
      </div>

      {/* last round reveal */}
      {lastRound && (
        <div className={styles.reveal} key={state.history.length}>
          <p className={styles.revealTitle}>Round {state.history.length}</p>
          <div className={styles.revealRow}>
            {lastRound.bids.map((bid, i) => (
              <div
                key={i}
                className={cx(
                  styles.revealBid,
                  lastRound.winner === i && styles.revealWinner,
                  lastRound.winner === -1 &&
                    bid === lastRound.winningNumber &&
                    styles.revealDraw,
                )}
                style={{ ["--bid-color" as string]: PLAYER_COLORS[i] }}
              >
                <span className={styles.revealNum}>{bid}</span>
                <span className={styles.revealName}>{seats[i].name}</span>
              </div>
            ))}
          </div>
          <p className={styles.revealOutcome}>
            {lastRound.winner >= 0
              ? `${seats[lastRound.winner].name} takes ${lastRound.winningNumber} point${lastRound.winningNumber > 1 ? "s" : ""}`
              : `Tie at ${lastRound.winningNumber} — nobody scores`}
          </p>
        </div>
      )}

      {/* bidding */}
      {!state.over && (
        <div className={styles.padArea}>
          {gate ? (
            <button type="button" className={styles.gate} onClick={onGateOpen}>
              <i className="fas fa-eye-slash"></i> {gate} — tap to bid in secret
            </button>
          ) : padRange ? (
            <>
              <p className={styles.padLabel}>{padLabel}</p>
              <div className={styles.pad}>
                {[1, 2, 3, 4, 5, 6].map((n) => {
                  const enabled = n >= padRange[0] && n <= padRange[1];
                  return (
                    <button
                      key={n}
                      type="button"
                      className={styles.padKey}
                      disabled={!enabled}
                      onClick={() => onBid(n)}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className={styles.padLabel}>{padLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { PLAYER_COLORS, type SeatConfig } from "../../games/types";
import { BID_MAX } from "../../games/undercut/engine";
import type { RoundRecord, UndercutState } from "../../games/undercut/types";
import { cx } from "../../lib/cx";
import { conjugate } from "../../lib/grammar";
import styles from "./UndercutBoard.module.css";

interface UndercutBoardProps {
  state: UndercutState;
  seats: SeatConfig[];
  /** Which seats have a bid locked in this hand (without showing values). */
  lockedSeats: boolean[];
  /** Enabled pad range for the local bidder, or null to hide the pad. */
  padRange: [number, number] | null;
  /** The local bidder's previous bid (0 on a fresh round) — drives lower/hold/higher. */
  padAnchor: number;
  onBid: (n: number) => void;
  /** Hotseat privacy gate: who must confirm before the pad shows. */
  gate: string | null;
  onGateOpen: () => void;
}

interface RevealStep {
  /** Bid value holding the crown after this step. */
  crown: number;
  kind: "lead" | "safe" | "steal" | "result";
  label: string;
}

const STEP_MS = 520;
const axisPos = (value: number) => ((value - 1) / (BID_MAX - 1)) * 100;

/**
 * The reveal narrates the rule the way it plays: the highest bid leads, and a
 * lower bid steals the crown only by dropping MORE than 1 below the bid above
 * it. Walking the distinct values downward reproduces resolveRound exactly.
 */
function buildRevealSteps(hand: RoundRecord, seats: SeatConfig[]): RevealStep[] {
  const values = [...new Set(hand.bids)].sort((a, b) => b - a);
  const nameAt = (v: number) =>
    hand.bids
      .map((b, i) => (b === v ? (seats[i]?.name ?? `P${i + 1}`) : null))
      .filter(Boolean)
      .join(" & ");

  const steps: RevealStep[] = [];
  let crown = values[0];
  steps.push({
    crown,
    kind: "lead",
    label: `${crown} is the highest — ${nameAt(crown)} leads`,
  });
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    const gap = values[i - 1] - v;
    if (gap > 1) {
      crown = v;
      steps.push({
        crown,
        kind: "steal",
        label: `UNDERCUT! ${nameAt(v)} ducks ${gap} below and steals it`,
      });
    } else {
      steps.push({
        crown,
        kind: "safe",
        label: `${v} is only 1 under — too close to undercut`,
      });
    }
  }
  steps.push({
    crown: hand.winningNumber,
    kind: "result",
    label:
      hand.winner >= 0
        ? `${conjugate(seats[hand.winner]?.name ?? "Player", "bank")} ${hand.winningNumber} point${hand.winningNumber > 1 ? "s" : ""}`
        : `Tie at ${hand.winningNumber} — nobody scores`,
  });
  return steps;
}

export function UndercutBoard({
  state,
  seats,
  lockedSeats,
  padRange,
  padAnchor,
  onBid,
  gate,
  onGateOpen,
}: UndercutBoardProps) {
  const { roundTarget, matchTarget } = state.config;
  const lastHand: RoundRecord | null =
    state.history.length > 0 ? state.history[state.history.length - 1] : null;

  const steps = useMemo(
    () => (lastHand ? buildRevealSteps(lastHand, seats) : []),
    [lastHand, seats],
  );

  // Step the reveal narration forward each time a hand lands.
  const [stepIdx, setStepIdx] = useState(0);
  useEffect(() => {
    if (steps.length === 0) return;
    setStepIdx(0);
    const iv = setInterval(() => {
      setStepIdx((s) => (s >= steps.length - 1 ? s : s + 1));
    }, STEP_MS);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.history.length]);

  const step = steps.length > 0 ? steps[Math.min(stepIdx, steps.length - 1)] : null;
  const revealDone = step?.kind === "result";
  const drawHand = revealDone && lastHand !== null && lastHand.winner === -1;

  // Round banner: fires once the reveal narration has finished.
  const [banner, setBanner] = useState<{ round: number; winner: number } | null>(null);
  const prevRounds = useRef(state.rounds.length);
  useEffect(() => {
    if (state.rounds.length > prevRounds.current) {
      prevRounds.current = state.rounds.length;
      const result = state.rounds[state.rounds.length - 1];
      const revealTime = steps.length * STEP_MS + 300;
      const show = setTimeout(
        () => setBanner({ round: state.rounds.length, winner: result.winner }),
        revealTime,
      );
      const hide = setTimeout(() => setBanner(null), revealTime + 2600);
      return () => {
        clearTimeout(show);
        clearTimeout(hide);
      };
    }
    prevRounds.current = state.rounds.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.rounds.length]);

  return (
    <div className={styles.board}>
      {/* single standings strip — the only place scores live */}
      <div className={styles.standings}>
        <span className={styles.roundTag}>Round {state.rounds.length + 1}</span>
        <div className={styles.scoreList}>
          {seats.map((seat, i) => (
            <div key={i} className={styles.scoreRow}>
              <span className={styles.scoreName} style={{ color: PLAYER_COLORS[i] }}>
                {seat.name}
              </span>
              <span className={styles.pips}>
                {Array.from({ length: matchTarget }, (_, p) => (
                  <span
                    key={p}
                    className={cx(styles.pip, p < state.roundWins[i] && styles.pipWon)}
                    style={
                      p < state.roundWins[i]
                        ? { background: PLAYER_COLORS[i], borderColor: PLAYER_COLORS[i] }
                        : undefined
                    }
                  />
                ))}
              </span>
              <span className={styles.track}>
                <span
                  className={styles.trackFill}
                  style={{
                    width: `${Math.min(100, (state.scores[i] / roundTarget) * 100)}%`,
                    background: PLAYER_COLORS[i],
                  }}
                />
              </span>
              <span className={styles.scoreNum}>
                {state.scores[i]}
                {lockedSeats[i] && !state.over && (
                  <i className={cx("fas fa-lock", styles.lock)}></i>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* last hand, played out on a number line (no boxes) */}
      {lastHand && (
        <div className={styles.reveal} key={state.history.length}>
          <div className={styles.axis}>
            {/* The crown only ever appears on the number that actually wins the
                hand — never on a leader who gets undercut — so it can't mislead. */}
            {step && step.crown === lastHand.winningNumber && (
              <div
                className={cx(styles.crown, drawHand && styles.crownDraw)}
                style={{ left: `${axisPos(step.crown)}%` }}
              >
                <i className="fas fa-crown"></i>
              </div>
            )}
            <div className={styles.axisLine} />
            {Array.from({ length: BID_MAX }, (_, i) => {
              const value = i + 1;
              const bidders = lastHand.bids
                .map((b, seatIdx) => (b === value ? seatIdx : -1))
                .filter((s) => s >= 0);
              return (
                <div
                  key={value}
                  className={styles.axisSlot}
                  style={{ left: `${axisPos(value)}%` }}
                >
                  <span className={styles.tokens}>
                    {bidders.map((seatIdx) => (
                      <span
                        key={seatIdx}
                        className={cx(
                          styles.token,
                          revealDone && lastHand.winner === seatIdx && styles.tokenWinner,
                          drawHand && value === lastHand.winningNumber && styles.tokenDraw,
                        )}
                        style={{
                          ["--pc" as string]: PLAYER_COLORS[seatIdx],
                          animationDelay: `${seatIdx * 100}ms`,
                        }}
                        title={seats[seatIdx]?.name}
                      >
                        {value}
                      </span>
                    ))}
                  </span>
                  <span className={cx(styles.tick, bidders.length > 0 && styles.tickUsed)}>
                    {value}
                  </span>
                </div>
              );
            })}
          </div>
          {step && (
            <p
              key={stepIdx}
              className={cx(
                styles.stepLabel,
                step.kind === "steal" && styles.stepSteal,
                step.kind === "result" && styles.stepResult,
              )}
            >
              {step.label}
            </p>
          )}
        </div>
      )}

      {/* picking — the pad itself is the prompt; no caption needed */}
      {!state.over && (
        <div className={styles.padArea}>
          {gate ? (
            <button type="button" className={styles.gate} onClick={onGateOpen}>
              <i className="fas fa-eye-slash"></i> {gate}
            </button>
          ) : padRange ? (
            padAnchor > 0 ? (
              <ChoicePad anchor={padAnchor} range={padRange} onBid={onBid} />
            ) : (
              <LinePad range={padRange} onBid={onBid} />
            )
          ) : null}
        </div>
      )}

      {/* round win banner */}
      {banner && (
        <div className={styles.banner} key={banner.round}>
          <div
            className={styles.bannerCard}
            style={{ ["--pc" as string]: PLAYER_COLORS[banner.winner] }}
          >
            <p className={styles.bannerKicker}>Round {banner.round}</p>
            <p className={styles.bannerTitle}>
              {conjugate(seats[banner.winner]?.name ?? "Player", "take")} the round!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Round one: the full 1–10 grid — equal keys, 5 per row on small screens. */
function LinePad({
  range,
  onBid,
}: {
  range: [number, number];
  onBid: (n: number) => void;
}) {
  return (
    <div className={styles.linePad}>
      {Array.from({ length: BID_MAX }, (_, i) => {
        const n = i + 1;
        const enabled = n >= range[0] && n <= range[1];
        return (
          <button
            key={n}
            type="button"
            className={styles.lineKey}
            disabled={!enabled}
            onClick={() => onBid(n)}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

/**
 * After round one you may only move ±1, so the choice is really lower / hold /
 * higher. The arrow and the number say it all — no captions.
 */
function ChoicePad({
  anchor,
  range,
  onBid,
}: {
  anchor: number;
  range: [number, number];
  onBid: (n: number) => void;
}) {
  const all: Array<{ n: number; kind: "lower" | "hold" | "higher"; icon: string }> = [
    { n: anchor - 1, kind: "lower", icon: "fa-caret-down" },
    { n: anchor, kind: "hold", icon: "fa-minus" },
    { n: anchor + 1, kind: "higher", icon: "fa-caret-up" },
  ];
  const choices = all.filter((c) => c.n >= range[0] && c.n <= range[1]);

  return (
    <div className={styles.choicePad}>
      {choices.map((c) => (
        <button
          key={c.kind}
          type="button"
          className={cx(styles.choice, styles[c.kind])}
          onClick={() => onBid(c.n)}
        >
          <i className={`fas ${c.icon} ${styles.choiceIcon}`}></i>
          <span className={styles.choiceNum}>{c.n}</span>
        </button>
      ))}
    </div>
  );
}

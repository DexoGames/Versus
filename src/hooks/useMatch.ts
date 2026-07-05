import { useCallback, useEffect, useRef, useState } from "react";
import type { Difficulty, GameEngine, SeatConfig, WinResult } from "../games/types";

export interface UseMatchOptions<S, M> {
  engine: GameEngine<S, M>;
  initialState: S;
  seats: SeatConfig[];
  /** Pure CPU move picker for this game. May be slow; it runs off the paint path. */
  chooseCpuMove: (state: S, player: number, difficulty: Difficulty) => M;
  /** Called after every applied move (local or external) — the online layer's seam. */
  onMove?: (state: S, move: M, player: number) => void;
  /** Milliseconds the CPU pretends to think. Defaults to a short human-feeling pause. */
  cpuDelay?: (state: S, player: number) => number;
}

export interface Match<S, M> {
  state: S;
  seats: SeatConfig[];
  currentPlayer: number;
  winResult: WinResult;
  /** True while a CPU seat is picking a move. */
  thinking: boolean;
  /** Submit a move for the local human seat currently to act. */
  submitMove: (move: M) => void;
  /** Apply a move that arrived from outside (remote player). Skips onMove. */
  applyExternalMove: (move: M) => void;
  /** Replace the whole state (online snapshot catch-up, or restart). */
  reset: (state: S) => void;
}

/**
 * Drives a match: holds state, routes each turn to human input, the CPU picker
 * or the online layer, and applies moves through the shared pure engine.
 */
export function useMatch<S, M>({
  engine,
  initialState,
  seats,
  chooseCpuMove,
  onMove,
  cpuDelay,
}: UseMatchOptions<S, M>): Match<S, M> {
  const [state, setState] = useState<S>(initialState);
  const [thinking, setThinking] = useState(false);
  // Bumped on reset so in-flight CPU timers from a dead game can't fire.
  const generation = useRef(0);

  const winResult = engine.checkWinner(state);
  const currentPlayer = engine.currentPlayer(state);

  const apply = useCallback(
    (move: M, external: boolean) => {
      setState((prev) => {
        const player = engine.currentPlayer(prev);
        const next = engine.applyMove(prev, move);
        if (!external) onMove?.(next, move, player);
        return next;
      });
    },
    [engine, onMove],
  );

  const submitMove = useCallback((move: M) => apply(move, false), [apply]);
  const applyExternalMove = useCallback((move: M) => apply(move, true), [apply]);

  const reset = useCallback((next: S) => {
    generation.current++;
    setThinking(false);
    setState(next);
  }, []);

  // CPU turn driver.
  useEffect(() => {
    if (winResult.over) return;
    const seat = seats[currentPlayer];
    if (!seat || seat.kind !== "cpu") return;

    const gen = generation.current;
    setThinking(true);
    const delay = cpuDelay ? cpuDelay(state, currentPlayer) : 450 + Math.random() * 650;

    const timer = setTimeout(() => {
      if (generation.current !== gen) return;
      const move = chooseCpuMove(state, currentPlayer, seat.difficulty ?? 2);
      if (generation.current !== gen) return;
      setThinking(false);
      apply(move, false);
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, currentPlayer, winResult.over, seats]);

  return {
    state,
    seats,
    currentPlayer,
    winResult,
    thinking,
    submitMove,
    applyExternalMove,
    reset,
  };
}

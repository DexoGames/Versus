import { useEffect, useRef } from "react";
import type { GameEngine, Json } from "../games/types";
import type { Match } from "../hooks/useMatch";
import type { RoomHandle } from "./useRoom";

/**
 * Glue between a Firestore room and a local useMatch, for strictly
 * turn-ordered games (Gridlock, Spellout).
 *
 * Every peer re-validates the incoming move through the shared engine before
 * trusting it — engine.applyMove throws on illegal moves, so a hacked client
 * can't push an impossible position onto honest peers move-by-move. Snapshot
 * catch-up (gap > 1, e.g. after reconnect) trusts the stored state.
 */
export function useOnlineSync<S, M>(
  enabled: boolean,
  room: RoomHandle,
  engine: GameEngine<S, M>,
  match: Match<S, M>,
  /** Decode the wire form of a move; defaults to a straight cast. */
  moveFromJson: (json: unknown) => M = (json) => json as M,
): void {
  const appliedCount = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const doc = room.room;
    if (!doc || doc.status !== "active") return;

    if (doc.moveCount <= appliedCount.current) return;

    // Our own echo: the local engine already advanced.
    if (doc.lastMover === room.mySeat) {
      appliedCount.current = doc.moveCount;
      return;
    }

    if (doc.moveCount === appliedCount.current + 1 && doc.lastMove) {
      try {
        match.applyExternalMove(moveFromJson(doc.lastMove));
        appliedCount.current = doc.moveCount;
      } catch (err) {
        // Illegal move from a peer: reject it locally and flag.
        console.warn("Rejected illegal remote move", doc.lastMove, err);
      }
      return;
    }

    // Gap (reconnect / missed snapshots): adopt the canonical state.
    if (doc.state) {
      match.reset(engine.deserialize(doc.state as Json));
      appliedCount.current = doc.moveCount;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, room.room?.moveCount, room.room?.status]);
}

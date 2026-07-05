import { useCallback, useEffect, useRef, useState } from "react";
import type { Json } from "../games/types";
import { ensureAuth, firestoreModule, getDb, onlineConfigured } from "./firebase";
import {
  generateRoomCode,
  normalizeRoomCode,
  type GameId,
  type RoomDoc,
  type RoomSeat,
} from "./roomTypes";

/**
 * Room lifecycle + realtime sync over Firestore.
 *
 * The engine stays authoritative on every client: peers receive the last move
 * and re-validate it locally before trusting the snapshot, so an illegal
 * write is rejected/flagged rather than silently accepted. Firestore rules
 * (firestore.rules) additionally restrict writes to seated players.
 */

export interface RoomHandle {
  configured: boolean;
  code: string | null;
  room: RoomDoc | null;
  myUid: string | null;
  /** My seat index, -1 if not seated. */
  mySeat: number;
  isHost: boolean;
  error: string | null;
  busy: boolean;
  createRoom: (
    game: GameId,
    config: Json,
    seatTarget: number,
    hostName: string,
    initialState: Json,
    cpuSeats?: number,
  ) => Promise<string>;
  joinRoom: (code: string, name: string) => Promise<void>;
  startGame: () => Promise<void>;
  /** Push a validated move + resulting state. */
  sendMove: (state: Json, move: Json, mover: number) => Promise<void>;
  /** Undercut: commit + reveal secret bids. */
  sendCommit: (seatIndex: number, hash: string) => Promise<void>;
  sendReveal: (seatIndex: number, bid: number, salt: string) => Promise<void>;
  /** Host checkpoint after a resolved Undercut round. */
  checkpointRound: (state: Json, round: number) => Promise<void>;
  finish: () => Promise<void>;
  leave: () => void;
}

export function useRoom(): RoomHandle {
  const [code, setCode] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomDoc | null>(null);
  const [myUid, setMyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const unsubscribe = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => unsubscribe.current?.();
  }, []);

  const subscribe = useCallback(async (roomCode: string) => {
    const [db, fs] = await Promise.all([getDb(), firestoreModule()]);
    unsubscribe.current?.();
    const ref = fs.doc(db, "rooms", roomCode);
    unsubscribe.current = fs.onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setError("Room closed");
          setRoom(null);
          return;
        }
        setRoom(snap.data() as RoomDoc);
      },
      (err) => setError(err.message),
    );
    setCode(roomCode);
  }, []);

  const createRoom = useCallback<RoomHandle["createRoom"]>(
    async (game, config, seatTarget, hostName, initialState, cpuSeats = 0) => {
      setBusy(true);
      setError(null);
      try {
        const uid = await ensureAuth();
        setMyUid(uid);
        const [db, fs] = await Promise.all([getDb(), firestoreModule()]);
        const roomCode = generateRoomCode();
        const seats: RoomSeat[] = [{ uid, name: hostName || "Host", kind: "human" }];
        for (let i = 0; i < cpuSeats; i++) {
          seats.push({ uid: "cpu", name: `CPU ${i + 1}`, kind: "cpu" });
        }
        const docData: RoomDoc = {
          game,
          status: "waiting",
          config,
          seats,
          seatTarget,
          hostUid: uid,
          state: initialState,
          moveCount: 0,
          lastMove: null,
          lastMover: -1,
          commits: {},
          reveals: {},
          round: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await fs.setDoc(fs.doc(db, "rooms", roomCode), docData);
        await subscribe(roomCode);
        return roomCode;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [subscribe],
  );

  const joinRoom = useCallback<RoomHandle["joinRoom"]>(
    async (rawCode, name) => {
      setBusy(true);
      setError(null);
      try {
        const roomCode = normalizeRoomCode(rawCode);
        const uid = await ensureAuth();
        setMyUid(uid);
        const [db, fs] = await Promise.all([getDb(), firestoreModule()]);
        const ref = fs.doc(db, "rooms", roomCode);
        const snap = await fs.getDoc(ref);
        if (!snap.exists()) throw new Error(`Room ${roomCode} not found`);

        await fs.runTransaction(db, async (tx) => {
          const fresh = await tx.get(ref);
          const data = fresh.data() as RoomDoc;
          if (data.seats.some((s) => s.uid === uid)) return; // rejoin
          if (data.status !== "waiting") throw new Error("Game already started");
          if (data.seats.length >= data.seatTarget) throw new Error("Room is full");
          tx.update(ref, {
            seats: [...data.seats, { uid, name: name || "Guest", kind: "human" }],
            updatedAt: Date.now(),
          });
        });
        await subscribe(roomCode);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [subscribe],
  );

  const update = useCallback(
    async (fields: Record<string, unknown>) => {
      if (!code) throw new Error("Not in a room");
      const [db, fs] = await Promise.all([getDb(), firestoreModule()]);
      await fs.updateDoc(fs.doc(db, "rooms", code), {
        ...fields,
        updatedAt: Date.now(),
      });
    },
    [code],
  );

  const startGame = useCallback(async () => {
    await update({ status: "active" });
  }, [update]);

  const sendMove = useCallback<RoomHandle["sendMove"]>(
    async (state, moveJson, mover) => {
      if (!room) throw new Error("Not in a room");
      await update({
        state,
        lastMove: moveJson,
        lastMover: mover,
        moveCount: room.moveCount + 1,
      });
    },
    [room, update],
  );

  const sendCommit = useCallback<RoomHandle["sendCommit"]>(
    async (seatIndex, hash) => {
      await update({ [`commits.${seatIndex}`]: hash });
    },
    [update],
  );

  const sendReveal = useCallback<RoomHandle["sendReveal"]>(
    async (seatIndex, bid, salt) => {
      await update({ [`reveals.${seatIndex}`]: { bid, salt } });
    },
    [update],
  );

  const checkpointRound = useCallback<RoomHandle["checkpointRound"]>(
    async (state, round) => {
      await update({ state, round, commits: {}, reveals: {} });
    },
    [update],
  );

  const finish = useCallback(async () => {
    await update({ status: "finished" });
  }, [update]);

  const leave = useCallback(() => {
    unsubscribe.current?.();
    unsubscribe.current = null;
    setCode(null);
    setRoom(null);
    setError(null);
  }, []);

  const mySeat = room && myUid ? room.seats.findIndex((s) => s.uid === myUid) : -1;

  return {
    configured: onlineConfigured,
    code,
    room,
    myUid,
    mySeat,
    isHost: Boolean(room && myUid && room.hostUid === myUid),
    error,
    busy,
    createRoom,
    joinRoom,
    startGame,
    sendMove,
    sendCommit,
    sendReveal,
    checkpointRound,
    finish,
    leave,
  };
}

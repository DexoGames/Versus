import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GAMES_DATA } from "../../data/games";
import { chooseUndercutBid } from "../../games/undercut/ai";
import { bidRange, createInitial, undercutEngine } from "../../games/undercut/engine";
import type { UndercutState } from "../../games/undercut/types";
import { difficultyInfo, type Difficulty, type Json, type SeatConfig } from "../../games/types";
import { useMatch } from "../../hooks/useMatch";
import { getDisplayName } from "../../online/firebase";
import { hashBid, randomSalt } from "../../online/roomTypes";
import { useRoom, type RoomHandle } from "../../online/useRoom";
import { GameOverCard } from "../../components/game/GameOverCard";
import { LobbyShell, type LobbyMode } from "../../components/game/LobbyShell";
import { MatchLayout } from "../../components/game/MatchLayout";
import { OptionRow } from "../../components/game/OptionRow";
import { GamePageFrame } from "../GamePageFrame";
import { UndercutBoard } from "./UndercutBoard";

const GAME = GAMES_DATA.find((g) => g.id === "undercut")!;
const ROUND_TARGET = 10;

interface MatchSetup {
  seats: SeatConfig[];
  matchTarget: number;
  online: boolean;
}

export function UndercutPage() {
  const [searchParams] = useSearchParams();
  const roomParam = searchParams.get("room");

  const [mode, setMode] = useState<LobbyMode>(roomParam ? "online" : "cpu");
  const [difficulty, setDifficulty] = useState<Difficulty>(2);
  const [playerCount, setPlayerCount] = useState(2);
  const [matchTarget, setMatchTarget] = useState(3);
  const [cpuSeats, setCpuSeats] = useState(1);
  const [setup, setSetup] = useState<MatchSetup | null>(null);
  const [matchKey, setMatchKey] = useState(0);
  const room = useRoom();

  useEffect(() => {
    if (roomParam && room.configured && !room.room && !room.busy && !room.error) {
      void room.joinRoom(roomParam, getDisplayName() || "Guest");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomParam, room.configured]);

  useEffect(() => {
    if (!room.room || room.room.status !== "active" || setup?.online) return;
    const doc = room.room;
    setSetup({
      seats: doc.seats.map((seat, i) => ({
        kind:
          i === room.mySeat
            ? "human"
            : seat.kind === "cpu"
              ? "cpu"
              : "remote",
        name: seat.name,
        difficulty: 2,
      })),
      matchTarget: (doc.config.matchTarget as number) ?? 3,
      online: true,
    });
    setMatchKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.room?.status]);

  const startLocal = () => {
    const seats: SeatConfig[] = [];
    if (mode === "cpu") {
      const info = difficultyInfo(difficulty);
      seats.push({ kind: "human", name: "You" });
      for (let i = 1; i < playerCount; i++) {
        seats.push({
          kind: "cpu",
          name: playerCount > 2 ? `${info.persona} ${i}` : info.persona,
          difficulty,
        });
      }
    } else {
      for (let i = 0; i < playerCount; i++) {
        seats.push({ kind: "human", name: `Player ${i + 1}` });
      }
    }
    setSetup({ seats, matchTarget, online: false });
    setMatchKey((k) => k + 1);
  };

  const settings = (
    <>
      <OptionRow
        label="Players"
        options={[
          { value: 2, label: "2" },
          { value: 3, label: "3" },
          { value: 4, label: "4" },
        ]}
        value={playerCount}
        onChange={setPlayerCount}
      />
      <OptionRow
        label="Match"
        options={[
          { value: 1, label: "First to 1" },
          { value: 3, label: "First to 3" },
          { value: 5, label: "First to 5" },
        ]}
        value={matchTarget}
        onChange={setMatchTarget}
      />
    </>
  );

  const onlineSettings = (
    <>
      {settings}
      <OptionRow
        label="CPU seats"
        options={Array.from({ length: playerCount }, (_, i) => ({
          value: i,
          label: i === 0 ? "None" : String(i),
        }))}
        value={Math.min(cpuSeats, playerCount - 1)}
        onChange={setCpuSeats}
      />
    </>
  );

  return (
    <GamePageFrame game={GAME} inMatch={Boolean(setup)} onExitMatch={() => setSetup(null)}>
      {!setup ? (
        <LobbyShell
          game={GAME}
          modes={["cpu", "hotseat", "online"]}
          mode={mode}
          onModeChange={setMode}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          settings={mode === "online" ? onlineSettings : settings}
          onStart={startLocal}
          room={room}
          pendingJoinCode={roomParam ?? undefined}
          onCreateRoom={async (name) => {
            await room.createRoom(
              "undercut",
              { playerCount, matchTarget },
              playerCount,
              name,
              undercutEngine.serialize(
                createInitial({ playerCount, roundTarget: ROUND_TARGET, matchTarget }),
              ),
              Math.min(cpuSeats, playerCount - 1),
            );
          }}
          onJoinRoom={async (code, name) => {
            await room.joinRoom(code, name);
          }}
          onStartOnline={async () => {
            await room.startGame();
          }}
        />
      ) : setup.online ? (
        <UndercutOnlineMatch
          key={matchKey}
          setup={setup}
          room={room}
          onExit={() => {
            room.leave();
            setSetup(null);
          }}
        />
      ) : (
        <UndercutLocalMatch
          key={matchKey}
          setup={setup}
          hotseat={mode === "hotseat"}
          onRematch={() => setMatchKey((k) => k + 1)}
          onExit={() => setSetup(null)}
        />
      )}
    </GamePageFrame>
  );
}

/* ---------------- local (CPU / hotseat) ---------------- */

function UndercutLocalMatch({
  setup,
  hotseat,
  onRematch,
  onExit,
}: {
  setup: MatchSetup;
  hotseat: boolean;
  onRematch: () => void;
  onExit: () => void;
}) {
  const match = useMatch<UndercutState, number>({
    engine: undercutEngine,
    initialState: createInitial({
      playerCount: setup.seats.length,
      roundTarget: ROUND_TARGET,
      matchTarget: setup.matchTarget,
    }),
    seats: setup.seats,
    chooseCpuMove: (state, player, difficulty) =>
      chooseUndercutBid(state, player, difficulty),
    // Bids should land close together so the hand feels simultaneous.
    cpuDelay: () => 250 + Math.random() * 400,
  });

  const { state, winResult, currentPlayer, thinking } = match;
  const activeSeat = setup.seats[currentPlayer];

  // Hotseat privacy gate: each human confirms before their pad appears.
  const hand = state.history.length;
  const [gateOpened, setGateOpened] = useState<{ hand: number; player: number } | null>(null);
  const gateActive =
    hotseat &&
    !winResult.over &&
    activeSeat.kind === "human" &&
    (gateOpened?.hand !== hand || gateOpened.player !== currentPlayer);

  const humanTurn = !winResult.over && activeSeat.kind === "human" && !thinking;
  const padRange = humanTurn ? bidRange(state, currentPlayer) : null;

  return (
    <MatchLayout
      overlay={
        winResult.over ? (
          <GameOverCard
            winners={winResult.winners}
            seats={setup.seats}
            detail={`First to ${setup.matchTarget} round win${setup.matchTarget > 1 ? "s" : ""}`}
            onRematch={onRematch}
            onBackToLobby={onExit}
          />
        ) : undefined
      }
    >
      <UndercutBoard
        state={state}
        seats={setup.seats}
        lockedSeats={state.pendingBids.map((b) => b !== null)}
        padRange={padRange}
        padAnchor={humanTurn ? state.lastBids[currentPlayer] : 0}
        padLabel={humanTurn ? `${activeSeat.name}, bid in secret` : "Opponents are bidding…"}
        onBid={(n) => {
          setGateOpened(null);
          match.submitMove(n);
        }}
        gate={gateActive ? activeSeat.name : null}
        onGateOpen={() => setGateOpened({ hand, player: currentPlayer })}
      />
    </MatchLayout>
  );
}

/* ---------------- online (commit-reveal) ---------------- */

function UndercutOnlineMatch({
  setup,
  room,
  onExit,
}: {
  setup: MatchSetup;
  room: RoomHandle;
  onExit: () => void;
}) {
  const [state, setState] = useState<UndercutState>(() =>
    room.room?.state
      ? undercutEngine.deserialize(room.room.state as Json)
      : createInitial({
          playerCount: setup.seats.length,
          roundTarget: ROUND_TARGET,
          matchTarget: setup.matchTarget,
        }),
  );
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const secret = useRef<{ bid: number; salt: string } | null>(null);
  const cpuSecrets = useRef(new Map<string, { bid: number; salt: string }>());
  const sentKeys = useRef(new Set<string>());
  const applyingRound = useRef(-1);

  const doc = room.room;
  const roundNo = doc?.round ?? 0;

  const placeBid = useCallback(
    async (bid: number) => {
      if (!doc || secret.current) return;
      const salt = randomSalt();
      secret.current = { bid, salt };
      const hash = await hashBid(bid, salt);
      await room.sendCommit(room.mySeat, hash);
    },
    [doc, room],
  );

  // Host: choose + commit bids for CPU seats each hand.
  useEffect(() => {
    if (!doc || !room.isHost || state.over) return;
    doc.seats.forEach((seat, i) => {
      if (seat.kind !== "cpu") return;
      const key = `commit:${roundNo}:${i}`;
      if (doc.commits[String(i)] || sentKeys.current.has(key)) return;
      sentKeys.current.add(key);
      const bid = chooseUndercutBid(state, i, 2);
      const salt = randomSalt();
      cpuSecrets.current.set(`${roundNo}:${i}`, { bid, salt });
      void hashBid(bid, salt).then((h) => room.sendCommit(i, h));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.commits, doc?.round, state]);

  // Everyone committed → reveal (mine + host-run CPU seats).
  useEffect(() => {
    if (!doc) return;
    const committed = Object.keys(doc.commits ?? {}).length;
    if (committed < doc.seatTarget) return;

    if (secret.current && !doc.reveals?.[String(room.mySeat)]) {
      const key = `reveal:${roundNo}:${room.mySeat}`;
      if (!sentKeys.current.has(key)) {
        sentKeys.current.add(key);
        void room.sendReveal(room.mySeat, secret.current.bid, secret.current.salt);
      }
    }
    if (room.isHost) {
      doc.seats.forEach((seat, i) => {
        if (seat.kind !== "cpu") return;
        const cpuSecret = cpuSecrets.current.get(`${roundNo}:${i}`);
        if (!cpuSecret || doc.reveals?.[String(i)]) return;
        const key = `reveal:${roundNo}:${i}`;
        if (sentKeys.current.has(key)) return;
        sentKeys.current.add(key);
        void room.sendReveal(i, cpuSecret.bid, cpuSecret.salt);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.commits, doc?.reveals]);

  // Everyone revealed → verify commitments, apply the hand locally.
  useEffect(() => {
    if (!doc || state.over) return;
    const reveals = doc.reveals ?? {};
    if (Object.keys(reveals).length < doc.seatTarget) return;
    if (state.history.length !== roundNo || applyingRound.current === roundNo) return;
    applyingRound.current = roundNo;

    void (async () => {
      for (let i = 0; i < doc.seatTarget; i++) {
        const reveal = reveals[String(i)];
        const commit = doc.commits?.[String(i)];
        if (!reveal || !commit || (await hashBid(reveal.bid, reveal.salt)) !== commit) {
          setVerifyError(`Bid verification failed for seat ${i + 1}`);
          return;
        }
      }
      let next = state;
      for (let i = 0; i < doc.seatTarget; i++) {
        next = undercutEngine.applyMove(next, reveals[String(i)].bid);
      }
      secret.current = null;
      setState(next);
      if (room.isHost) {
        void room.checkpointRound(undercutEngine.serialize(next), roundNo + 1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.reveals, state]);

  const winResult = undercutEngine.checkWinner(state);
  const myCommitted = Boolean(doc?.commits?.[String(room.mySeat)]) || secret.current !== null;
  const lockedSeats = setup.seats.map((_, i) => Boolean(doc?.commits?.[String(i)]));
  const padRange = !winResult.over && !myCommitted ? bidRange(state, room.mySeat) : null;

  return (
    <MatchLayout
      status={verifyError ?? undefined}
      overlay={
        winResult.over ? (
          <GameOverCard
            winners={winResult.winners}
            seats={setup.seats}
            detail={`First to ${setup.matchTarget} round win${setup.matchTarget > 1 ? "s" : ""}`}
            onBackToLobby={onExit}
          />
        ) : undefined
      }
    >
      <UndercutBoard
        state={state}
        seats={setup.seats}
        lockedSeats={lockedSeats}
        padRange={padRange}
        padAnchor={!winResult.over && !myCommitted ? state.lastBids[room.mySeat] : 0}
        padLabel={myCommitted ? "Waiting for other bids…" : "Bid in secret"}
        onBid={(n) => void placeBid(n)}
        gate={null}
        onGateOpen={() => {}}
      />
    </MatchLayout>
  );
}

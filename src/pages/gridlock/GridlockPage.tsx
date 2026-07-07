import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GAMES_DATA } from "../../data/games";
import { chooseGridlockMove } from "../../games/gridlock/ai";
import { createInitialGridlock, gridlockEngine } from "../../games/gridlock/engine";
import type { GridlockState, Point } from "../../games/gridlock/types";
import { difficultyInfo, type Difficulty, type Json, type SeatConfig } from "../../games/types";
import { useMatch } from "../../hooks/useMatch";
import { getDisplayName } from "../../online/firebase";
import { useOnlineSync } from "../../online/useOnlineSync";
import { useRoom } from "../../online/useRoom";
import { GameOverCard } from "../../components/game/GameOverCard";
import { LobbyShell, type LobbyMode } from "../../components/game/LobbyShell";
import { MatchLayout } from "../../components/game/MatchLayout";
import { OptionRow } from "../../components/game/OptionRow";
import { GamePageFrame } from "../GamePageFrame";
import { GridlockBoard } from "./GridlockBoard";
import { OpeningBanner } from "./OpeningBanner";

const GAME = GAMES_DATA.find((g) => g.id === "gridlock")!;

const WIN_REASONS: Record<string, string> = {
  insurmountable: "The lead can't be caught",
  "board-full": "Every cell is claimed",
  gridlocked: "Nobody can move",
};

interface MatchSetup {
  seats: SeatConfig[];
  initialState: GridlockState;
  online: boolean;
}

export function GridlockPage() {
  const [searchParams] = useSearchParams();
  const roomParam = searchParams.get("room");

  const [mode, setMode] = useState<LobbyMode>(roomParam ? "online" : "cpu");
  const [difficulty, setDifficulty] = useState<Difficulty>(2);
  const [gridSize, setGridSize] = useState(6);
  const [playerCount, setPlayerCount] = useState(2);
  const [setup, setSetup] = useState<MatchSetup | null>(null);
  const [matchKey, setMatchKey] = useState(0);
  const room = useRoom();

  // Deep link: auto-join the room from ?room=CODE.
  useEffect(() => {
    if (roomParam && room.configured && !room.room && !room.busy && !room.error) {
      void room.joinRoom(roomParam, getDisplayName() || "Guest");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomParam, room.configured]);

  // Online game goes live when the host flips status to active.
  useEffect(() => {
    if (!room.room || room.room.status !== "active" || setup?.online) return;
    const doc = room.room;
    const seats: SeatConfig[] = doc.seats.map((seat, i) => ({
      kind: i === room.mySeat ? "human" : "remote",
      name: seat.name,
    }));
    setSetup({
      seats,
      initialState: doc.state
        ? gridlockEngine.deserialize(doc.state as Json)
        : createInitialGridlock(
            (doc.config.gridSize as number) ?? 6,
            seats.length,
          ),
      online: true,
    });
    setMatchKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.room?.status]);

  const startLocal = () => {
    const seats: SeatConfig[] = [];
    if (mode === "cpu") {
      seats.push({ kind: "human", name: "You" });
      const info = difficultyInfo(difficulty);
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
    setSetup({
      seats,
      initialState: createInitialGridlock(gridSize, playerCount),
      online: false,
    });
    setMatchKey((k) => k + 1);
  };

  const settings = (
    <>
      <OptionRow
        label="Grid size"
        options={[
          { value: 4, label: "4 × 4" },
          { value: 6, label: "6 × 6" },
        ]}
        value={gridSize}
        onChange={setGridSize}
      />
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
          settings={settings}
          onStart={startLocal}
          room={room}
          pendingJoinCode={roomParam ?? undefined}
          onCreateRoom={async (name) => {
            await room.createRoom(
              "gridlock",
              { gridSize, playerCount },
              playerCount,
              name,
              gridlockEngine.serialize(createInitialGridlock(gridSize, playerCount)),
            );
          }}
          onJoinRoom={async (code, name) => {
            await room.joinRoom(code, name);
          }}
          onStartOnline={async () => {
            await room.startGame();
          }}
        />
      ) : (
        <GridlockMatch
          key={matchKey}
          setup={setup}
          room={room}
          onRematch={() => {
            setSetup({
              ...setup,
              initialState: createInitialGridlock(
                setup.initialState.config.gridSize,
                setup.seats.length,
              ),
            });
            setMatchKey((k) => k + 1);
          }}
          onExit={() => {
            if (setup.online) room.leave();
            setSetup(null);
          }}
        />
      )}
    </GamePageFrame>
  );
}

function GridlockMatch({
  setup,
  room,
  onRematch,
  onExit,
}: {
  setup: MatchSetup;
  room: ReturnType<typeof useRoom>;
  onRematch: () => void;
  onExit: () => void;
}) {
  const match = useMatch<GridlockState, Point>({
    engine: gridlockEngine,
    initialState: setup.initialState,
    seats: setup.seats,
    chooseCpuMove: chooseGridlockMove,
    onMove: (state, move, player) => {
      if (!setup.online) return;
      // Report only moves this client owns (its human seat / host-run CPUs).
      const seat = setup.seats[player];
      if (seat.kind === "remote") return;
      void room.sendMove(
        gridlockEngine.serialize(state),
        { x: move.x, y: move.y },
        player,
      );
    },
  });

  useOnlineSync(setup.online, room, gridlockEngine, match);

  const { state, winResult, currentPlayer, thinking } = match;
  const activeSeat = setup.seats[currentPlayer];

  const legalMoves = useMemo(() => {
    if (winResult.over || thinking) return [];
    if (activeSeat.kind !== "human") return [];
    return gridlockEngine.getLegalMoves(state, currentPlayer);
  }, [state, currentPlayer, winResult.over, thinking, activeSeat.kind]);

  // The status row narrates only what the board can't show: a CPU thinking or
  // a remote turn. On human turns it hosts the opening read (blank until the
  // opening is identifiable — the row's space is always reserved).
  const status = winResult.over
    ? (WIN_REASONS[winResult.reason ?? ""] ?? "Game over")
    : thinking
      ? `${activeSeat.name} is thinking…`
      : activeSeat.kind === "human"
        ? <OpeningBanner state={state} seats={setup.seats} />
        : `Waiting for ${activeSeat.name}…`;

  return (
    <MatchLayout
      status={status}
      overlay={
        winResult.over ? (
          <GameOverCard
            winners={winResult.winners}
            seats={setup.seats}
            detail={WIN_REASONS[winResult.reason ?? ""] ?? undefined}
            onRematch={setup.online ? undefined : onRematch}
            onBackToLobby={onExit}
          />
        ) : undefined
      }
    >
      <GridlockBoard
        state={state}
        legalMoves={legalMoves}
        onMove={match.submitMove}
        seats={setup.seats}
        winners={winResult.winners}
        over={winResult.over}
      />
    </MatchLayout>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GAMES_DATA } from "../../data/games";
import { chooseSpelloutLetter } from "../../games/spellout/ai";
import { Dictionary, loadDictionary } from "../../games/spellout/dictionary";
import { createInitialSpellout, createSpelloutEngine } from "../../games/spellout/engine";
import type { SpelloutMove, SpelloutState } from "../../games/spellout/types";
import { difficultyInfo, type Difficulty, type SeatConfig } from "../../games/types";
import { useMatch } from "../../hooks/useMatch";
import { getDisplayName } from "../../online/firebase";
import { useOnlineSync } from "../../online/useOnlineSync";
import { useRoom } from "../../online/useRoom";
import { GameOverCard } from "../../components/game/GameOverCard";
import { LobbyShell, type LobbyMode } from "../../components/game/LobbyShell";
import { MatchLayout } from "../../components/game/MatchLayout";
import { OptionRow } from "../../components/game/OptionRow";
import { PlayerChip } from "../../components/game/PlayerChip";
import { GamePageFrame } from "../GamePageFrame";
import { SpelloutBoard } from "./SpelloutBoard";

const GAME = GAMES_DATA.find((g) => g.id === "spellout")!;

interface MatchSetup {
  seats: SeatConfig[];
  online: boolean;
}

export function SpelloutPage() {
  const [searchParams] = useSearchParams();
  const roomParam = searchParams.get("room");

  const [dict, setDict] = useState<Dictionary | null>(null);
  const [dictError, setDictError] = useState<string | null>(null);
  const [mode, setMode] = useState<LobbyMode>(roomParam ? "online" : "cpu");
  const [difficulty, setDifficulty] = useState<Difficulty>(2);
  const [playerCount, setPlayerCount] = useState(2);
  const [setup, setSetup] = useState<MatchSetup | null>(null);
  const [matchKey, setMatchKey] = useState(0);
  const room = useRoom();

  useEffect(() => {
    loadDictionary()
      .then(setDict)
      .catch((e) => setDictError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    if (roomParam && room.configured && !room.room && !room.busy && !room.error) {
      void room.joinRoom(roomParam, getDisplayName() || "Guest");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomParam, room.configured]);

  useEffect(() => {
    if (!room.room || room.room.status !== "active" || setup?.online) return;
    setSetup({
      seats: room.room.seats.map((seat, i) => ({
        kind: i === room.mySeat ? "human" : "remote",
        name: seat.name,
      })),
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
    setSetup({ seats, online: false });
    setMatchKey((k) => k + 1);
  };

  const settings = (
    <OptionRow
      label="Players"
      options={[
        { value: 2, label: "2" },
        { value: 3, label: "3" },
      ]}
      value={playerCount}
      onChange={setPlayerCount}
    />
  );

  return (
    <GamePageFrame game={GAME} inMatch={Boolean(setup)} onExitMatch={() => setSetup(null)}>
      {dictError ? (
        <p style={{ padding: "40px 0", fontFamily: "var(--font-mono)" }}>
          Couldn't load the dictionary: {dictError}
        </p>
      ) : !dict ? (
        <p style={{ padding: "40px 0", fontFamily: "var(--font-mono)", color: "var(--bone-dim)" }}>
          Loading dictionary…
        </p>
      ) : !setup ? (
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
            const engine = createSpelloutEngine(dict);
            await room.createRoom(
              "spellout",
              { playerCount },
              playerCount,
              name,
              engine.serialize(createInitialSpellout(playerCount)),
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
        <SpelloutMatch
          key={matchKey}
          dict={dict}
          setup={setup}
          room={room}
          onRematch={() => setMatchKey((k) => k + 1)}
          onExit={() => {
            if (setup.online) room.leave();
            setSetup(null);
          }}
        />
      )}
    </GamePageFrame>
  );
}

function SpelloutMatch({
  dict,
  setup,
  room,
  onRematch,
  onExit,
}: {
  dict: Dictionary;
  setup: MatchSetup;
  room: ReturnType<typeof useRoom>;
  onRematch: () => void;
  onExit: () => void;
}) {
  const engine = useMemo(() => createSpelloutEngine(dict), [dict]);

  const match = useMatch<SpelloutState, SpelloutMove>({
    engine,
    initialState: createInitialSpellout(setup.seats.length),
    seats: setup.seats,
    chooseCpuMove: (state, _player, difficulty) =>
      chooseSpelloutLetter(dict, state, difficulty),
    onMove: (state, move, player) => {
      if (!setup.online) return;
      if (setup.seats[player].kind === "remote") return;
      void room.sendMove(engine.serialize(state), { letter: move }, player);
    },
  });

  useOnlineSync(
    setup.online,
    room,
    engine,
    match,
    (json) => (json as { letter: string }).letter,
  );

  const { state, winResult, currentPlayer, thinking } = match;
  const activeSeat = setup.seats[currentPlayer];
  const myTurn = !winResult.over && !thinking && activeSeat.kind === "human";

  const remaining = state.fragment.length === 0 ? dict.words.length : state.remaining;

  const detail = useMemo(() => {
    if (!winResult.over) return null;
    if (winResult.reason === "completed-word") {
      return `${state.fragment.toUpperCase()} — finished, and nothing extends it.`;
    }
    // Dead letter: what would have worked from the previous fragment.
    const sample = dict.sampleWithPrefix(state.fragment, true);
    if (!sample) return null;
    const others = dict.countWithPrefix(state.fragment) - (dict.isWord(state.fragment) ? 1 : 0) - 1;
    let text = `${sample.toUpperCase()} would've worked`;
    if (others > 0) text += `\nalong with ${others} other word${others > 1 ? "s" : ""}`;
    return text;
  }, [winResult.over, winResult.reason, state.fragment, dict]);

  const status = winResult.over
    ? winResult.reason === "dead-letter"
      ? "Misspelt!"
      : "Word complete!"
    : thinking
      ? `${activeSeat.name} is thinking…`
      : activeSeat.kind === "human"
        ? `${activeSeat.name} — add a letter`
        : `Waiting for ${activeSeat.name}…`;

  return (
    <MatchLayout
      players={setup.seats.map((seat, i) => (
        <PlayerChip
          key={i}
          seat={seat}
          index={i}
          active={!winResult.over && currentPlayer === i}
          won={winResult.over && winResult.winners.includes(i)}
        />
      ))}
      status={status}
      overlay={
        winResult.over ? (
          <GameOverCard
            winners={winResult.winners}
            seats={setup.seats}
            detail={detail}
            onRematch={setup.online ? undefined : onRematch}
            onBackToLobby={onExit}
          />
        ) : undefined
      }
    >
      <SpelloutBoard
        state={state}
        remaining={remaining}
        canPlay={myTurn}
        onPlay={match.submitMove}
      />
    </MatchLayout>
  );
}

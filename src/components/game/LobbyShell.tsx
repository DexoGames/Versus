import { useState, type ReactNode } from "react";
import type { GameInfo } from "../../data/games";
import type { Difficulty } from "../../games/types";
import { getDisplayName, setDisplayName } from "../../online/firebase";
import type { RoomHandle } from "../../online/useRoom";
import { Button } from "../Button/Button";
import { DifficultyPicker } from "./DifficultyPicker";
import { cx } from "../../lib/cx";
import styles from "./LobbyShell.module.css";

export type LobbyMode = "cpu" | "hotseat" | "online";

const MODE_META: Record<LobbyMode, { label: string; icon: string; hint: string }> = {
  cpu: { label: "vs CPU", icon: "fa-robot", hint: "Play against the machine" },
  hotseat: { label: "Hotseat", icon: "fa-couch", hint: "Share this device" },
  online: { label: "Online", icon: "fa-wifi", hint: "Room code with a friend" },
};

interface LobbyShellProps {
  game: GameInfo;
  modes: LobbyMode[];
  mode: LobbyMode;
  onModeChange: (m: LobbyMode) => void;
  difficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
  /** Game-specific settings controls (size, score target…). */
  settings?: ReactNode;
  onStart: () => void;
  /** Online wiring; omit to hide the online tab's internals. */
  room: RoomHandle;
  onCreateRoom: (displayName: string) => Promise<void>;
  /** Pre-filled room code from a ?room= link. */
  pendingJoinCode?: string;
  onJoinRoom: (code: string, displayName: string) => Promise<void>;
  onStartOnline: () => Promise<void>;
}

export function LobbyShell({
  game,
  modes,
  mode,
  onModeChange,
  difficulty,
  onDifficultyChange,
  settings,
  onStart,
  room,
  onCreateRoom,
  pendingJoinCode,
  onJoinRoom,
  onStartOnline,
}: LobbyShellProps) {
  const [name, setName] = useState(getDisplayName());
  const [joinCode, setJoinCode] = useState(pendingJoinCode ?? "");

  const saveName = (value: string) => {
    setName(value);
    setDisplayName(value);
  };

  const shareUrl = room.code
    ? `${window.location.origin}${game.route}?room=${room.code}`
    : "";

  return (
    <div className={styles.lobby}>
      <div className={styles.rules}>
        <h3 className={styles.rulesTitle}>How to play</h3>
        <ul className={styles.rulesList}>
          {game.howToPlay.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      <div className={styles.setup}>
        <div className={styles.modes}>
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              className={cx(styles.mode, mode === m && styles.modeSelected)}
              onClick={() => onModeChange(m)}
            >
              <i className={`fas ${MODE_META[m].icon}`}></i>
              <span className={styles.modeLabel}>{MODE_META[m].label}</span>
              <span className={styles.modeHint}>{MODE_META[m].hint}</span>
            </button>
          ))}
        </div>

        {mode === "cpu" && (
          <div className={styles.block}>
            <h4 className={styles.blockTitle}>Opponent</h4>
            <DifficultyPicker value={difficulty} onChange={onDifficultyChange} />
          </div>
        )}

        {mode !== "online" && settings && (
          <div className={styles.block}>
            <h4 className={styles.blockTitle}>Settings</h4>
            {settings}
          </div>
        )}

        {mode !== "online" && (
          <div className={styles.startRow}>
            <Button onClick={onStart}>
              <i className="fas fa-play"></i> Start game
            </Button>
          </div>
        )}

        {mode === "online" && !room.configured && (
          <div className={styles.block}>
            <p className={styles.offlineNote}>
              Online play isn't configured on this build — it needs the
              Firebase keys in <code>.env</code>. CPU and hotseat work fully
              offline.
            </p>
          </div>
        )}

        {mode === "online" && room.configured && !room.room && (
          <div className={styles.block}>
            <h4 className={styles.blockTitle}>Display name</h4>
            <input
              className={styles.input}
              value={name}
              maxLength={20}
              placeholder="Guest"
              onChange={(e) => saveName(e.target.value)}
            />
            {settings && (
              <>
                <h4 className={styles.blockTitle}>Settings</h4>
                {settings}
              </>
            )}
            <div className={styles.onlineActions}>
              <Button onClick={() => void onCreateRoom(name || "Guest")} disabled={room.busy}>
                <i className="fas fa-plus"></i> Create room
              </Button>
              <div className={styles.joinRow}>
                <input
                  className={styles.input}
                  value={joinCode}
                  maxLength={6}
                  placeholder="CODE"
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                />
                <Button
                  variant="secondary"
                  disabled={room.busy || joinCode.trim().length < 4}
                  onClick={() => void onJoinRoom(joinCode, name || "Guest")}
                >
                  Join
                </Button>
              </div>
            </div>
            {room.error && <p className={styles.error}>{room.error}</p>}
          </div>
        )}

        {mode === "online" && room.room && (
          <div className={styles.block}>
            <h4 className={styles.blockTitle}>
              Room <span className={styles.code}>{room.code}</span>
            </h4>
            <p className={styles.share}>
              Share:{" "}
              <button
                type="button"
                className={styles.shareLink}
                onClick={() => void navigator.clipboard.writeText(shareUrl)}
                title="Copy link"
              >
                {shareUrl} <i className="fas fa-copy"></i>
              </button>
            </p>
            <ul className={styles.seatList}>
              {room.room.seats.map((seat, i) => (
                <li key={i} className={styles.seat}>
                  <span className={styles.seatNum}>P{i + 1}</span> {seat.name}
                  {seat.kind === "cpu" && <span className={styles.seatTag}>CPU</span>}
                  {seat.uid === room.myUid && <span className={styles.seatTag}>you</span>}
                </li>
              ))}
              {Array.from(
                { length: room.room.seatTarget - room.room.seats.length },
                (_, i) => (
                  <li key={`empty-${i}`} className={cx(styles.seat, styles.seatEmpty)}>
                    <span className={styles.seatNum}>
                      P{room.room!.seats.length + i + 1}
                    </span>{" "}
                    waiting…
                  </li>
                ),
              )}
            </ul>
            {room.isHost ? (
              <Button
                disabled={room.room.seats.length < room.room.seatTarget || room.busy}
                onClick={() => void onStartOnline()}
              >
                <i className="fas fa-play"></i> Start game
              </Button>
            ) : (
              <p className={styles.waiting}>Waiting for the host to start…</p>
            )}
            {room.error && <p className={styles.error}>{room.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

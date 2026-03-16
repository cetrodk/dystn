import { Suspense, useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Swords, Drama, Paintbrush, Phone, Settings, SkipForward } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useSessionId } from "@/providers/SessionProvider";
import { gameComponents } from "@/games/registry";
import { sfxFanfare } from "@/lib/sounds";
import { GameAvatar } from "@/components/GameAvatar";
import { da } from "@/lib/da";
import { MIN_PLAYERS } from "../../convex/lib/gameConfig";

const GAME_ICONS = { duel: Swords, bluff: Drama, tegn: Paintbrush, telefon: Phone } as const;

const TIMER_OPTIONS = [
  { key: "submitTime", label: "Svartid", defaultMs: 60_000, min: 15, max: 180 },
  { key: "voteTime", label: "Stemmetid", defaultMs: 15_000, min: 10, max: 60 },
  { key: "revealTime", label: "Afsløring", defaultMs: 60_000, min: 15, max: 90 },
  { key: "scoresTime", label: "Pointvisning", defaultMs: 8_000, min: 3, max: 20 },
  { key: "drawTime", label: "Tegnetid", defaultMs: 90_000, min: 30, max: 180 },
  { key: "guessTime", label: "Gættetid", defaultMs: 45_000, min: 15, max: 90 },
  { key: "writeTime", label: "Skrivetid", defaultMs: 60_000, min: 15, max: 120 },
] as const;

const GAME_OPTIONS = [
  { id: "duel", color: "var(--color-duel)", textColor: "#fff" },
  { id: "bluff", color: "var(--color-bluff)", textColor: "#0d0b1a" },
  { id: "tegn", color: "var(--color-tegn)", textColor: "#fff" },
  { id: "telefon", color: "var(--color-telefon)", textColor: "#0d0b1a" },
] as const;

function getGameMeta(gameType: string) {
  return GAME_OPTIONS.find((g) => g.id === gameType) ?? GAME_OPTIONS[0];
}

/* ── Settings Overlay ──────────────────────────────────── */

function HostSettingsOverlay({
  room,
  sessionId,
  onClose,
}: {
  room: any;
  sessionId: string;
  onClose: () => void;
}) {
  const updateSettings = useMutation(api.game.updateSettings);
  const restartGame = useMutation(api.game.restartGame);
  const settings = room.settings ?? {};

  const handleChange = useCallback(
    (key: string, seconds: number) => {
      updateSettings({
        roomId: room._id,
        hostId: sessionId,
        settings: { [key]: seconds * 1000 },
      });
    },
    [room._id, sessionId, updateSettings],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="card-glow w-full max-w-sm rounded-2xl bg-[var(--color-bg-warm)] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-2xl font-bold">Indstillinger</h3>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-2xl leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="flex flex-col gap-5">
          {TIMER_OPTIONS.map(({ key, label, defaultMs, min, max }) => {
            const currentMs = typeof settings[key] === "number" ? settings[key] : defaultMs;
            const currentSec = Math.round(currentMs / 1000);
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base font-semibold">{label}</span>
                  <span className="text-base font-mono font-bold text-[var(--color-primary-light)]">
                    {currentSec}s
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={currentSec}
                  onChange={(e) => handleChange(key, Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
                <div className="flex justify-between text-sm text-[var(--color-text-muted)]">
                  <span>{min}s</span>
                  <span>{max}s</span>
                </div>
              </div>
            );
          })}
        </div>

        {room.status !== "lobby" ? (
          <button
            onClick={() => {
              restartGame({ roomId: room._id, hostId: sessionId });
              onClose();
            }}
            className="mt-6 w-full rounded-xl border border-[var(--color-danger)]/30 p-3 text-sm font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors cursor-pointer"
          >
            Genstart spil
          </button>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

/* ── Host Toolbar (persistent during gameplay) ─────────── */

function HostToolbar({
  room,
  sessionId,
  onSettings,
}: {
  room: any;
  sessionId: string;
  onSettings: () => void;
}) {
  const hostAdvance = useMutation(api.game.hostAdvance);
  const gameMeta = getGameMeta(room.gameType);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between gap-4 px-4 py-2 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-white/5"
    >
      {/* Left: game type + room code */}
      <div className="flex items-center gap-3">
        {(() => { const Icon = GAME_ICONS[room.gameType as keyof typeof GAME_ICONS]; return Icon ? <Icon className="h-5 w-5" style={{ color: gameMeta.color }} /> : null; })()}
        <span
          className="font-mono text-sm font-bold tracking-widest"
          style={{ color: gameMeta.color }}
        >
          {room.code}
        </span>
        {room.roundNumber != null && (
          <span className="text-xs text-[var(--color-text-muted)]">
            R{room.roundNumber}/{room.totalRounds}
          </span>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => hostAdvance({ roomId: room._id, hostId: sessionId })}
          className="rounded-lg bg-[var(--color-surface-light)] px-3 py-1.5 text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-primary)]/20 hover:text-[var(--color-primary-light)] transition-colors cursor-pointer"
          title="Spring videre"
        >
          <span className="flex items-center gap-1">Skip <SkipForward className="h-3.5 w-3.5" /></span>
        </button>
        <button
          onClick={onSettings}
          className="rounded-lg bg-[var(--color-surface-light)] p-1.5 hover:bg-[var(--color-primary)]/20 transition-colors cursor-pointer"
          title="Indstillinger"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </motion.div>
  );
}

/* ── Game Info Card (lobby only) ───────────────────────── */

function getGameInfo(gameType: string) {
  const meta = GAME_OPTIONS.find((g) => g.id === gameType) ?? GAME_OPTIONS[0];
  const strings = gameType === "duel" ? da.duel : gameType === "bluff" ? da.bluff : gameType === "telefon" ? da.telefon : da.tegn;
  return { ...meta, ...strings };
}

function GameInfoCard({ gameType }: { gameType: string }) {
  const game = getGameInfo(gameType);

  return (
    <div className="w-full max-w-md rounded-2xl bg-[var(--color-surface)] p-5">
      <div className="flex items-center gap-3 mb-3">
        {(() => { const Icon = GAME_ICONS[gameType as keyof typeof GAME_ICONS]; return Icon ? <Icon className="h-8 w-8" style={{ color: game.color }} /> : null; })()}
        <h3
          className="font-display text-2xl font-bold"
          style={{ color: game.color }}
        >
          {game.name}
        </h3>
      </div>
      <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
        {game.howToPlay}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-muted)]">
          {game.expects}
        </span>
        <a
          href="/"
          className="text-xs text-[var(--color-primary-light)] hover:text-[var(--color-primary)] transition-colors"
        >
          ← Skift spil
        </a>
      </div>
    </div>
  );
}

/* ── Main Host View ────────────────────────────────────── */

export function HostView() {
  const { code } = useParams<{ code: string }>();
  const sessionId = useSessionId();
  const room = useQuery(api.rooms.getRoom, code ? { code } : "skip");
  const startGame = useMutation(api.game.startGame);
  const kickPlayer = useMutation(api.players.kickPlayer);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[var(--color-text-muted)] animate-gentle-pulse"
        >
          Indlæser...
        </motion.p>
      </div>
    );
  }

  // ── Playing ──
  if (room.status === "playing" && room.currentPhase) {
    const components = gameComponents[room.gameType];
    const basePhase = room.currentPhase.split("_")[0];
    const PhaseComponent = components?.host[basePhase];

    if (PhaseComponent) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 pt-16">
          <HostToolbar
            room={room}
            sessionId={sessionId}
            onSettings={() => setSettingsOpen(true)}
          />
          <AnimatePresence>
            {settingsOpen ? (
              <HostSettingsOverlay
                room={room}
                sessionId={sessionId}
                onClose={() => setSettingsOpen(false)}
              />
            ) : null}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div
              key={room.currentPhase + "-" + room.roundNumber}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex w-full flex-col items-center gap-8"
            >
              <Suspense
                fallback={
                  <div className="text-[var(--color-text-muted)] animate-gentle-pulse">
                    Indlæser...
                  </div>
                }
              >
                <PhaseComponent room={room} sessionId={sessionId} />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      );
    }
  }

  // ── Finished ──
  if (room.status === "finished") {
    return <FinishedScreen room={room} sessionId={sessionId} />;
  }

  // ── Lobby ──
  const gameMeta = getGameMeta(room.gameType);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <a
          href="/"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          ← {da.back}
        </a>
        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded-xl bg-[var(--color-surface)] p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-light)] transition-all cursor-pointer"
          title="Indstillinger"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
      <AnimatePresence>
        {settingsOpen ? (
          <HostSettingsOverlay
            room={room}
            sessionId={sessionId}
            onClose={() => setSettingsOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      {/* Room code */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        className="text-center"
      >
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          {da.roomCode}
        </p>
        <div className="mt-2 font-display text-8xl font-bold tracking-[0.2em] glow-text">
          {room.code}
        </div>
        <p className="mt-3 text-lg text-[var(--color-text-muted)]">
          Gå til <span className="font-bold text-[var(--color-text)]">/play</span>{" "}
          og indtast koden
        </p>
      </motion.div>

      {/* Game info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="w-full flex justify-center"
      >
        <GameInfoCard gameType={room.gameType} />
      </motion.div>

      {/* Player list */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="w-full max-w-md"
      >
        <p className="mb-4 text-center text-sm text-[var(--color-text-muted)]">
          {room.players.length} {da.playersJoined}
        </p>
        <ul className="flex flex-col gap-2">
          <AnimatePresence>
            {room.players.map((player: any, i: number) => (
              <motion.li
                key={player._id}
                initial={{ opacity: 0, x: -20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 300 }}
                className="flex items-center gap-3 rounded-xl bg-[var(--color-surface)] p-3"
              >
                <GameAvatar name={player.name} avatarColor={player.avatarColor} avatarImage={player.avatarImage} />
                <span className="font-semibold">{player.name}</span>
                {!player.isConnected ? (
                  <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                    afbrudt
                  </span>
                ) : null}
                <button
                  onClick={() => kickPlayer({ roomId: room._id, hostId: sessionId, playerId: player._id })}
                  className="ml-auto rounded-lg p-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors cursor-pointer"
                  title="Fjern spiller"
                >
                  ✕
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </motion.div>

      {/* Start button */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, type: "spring" }}
        whileHover={room.players.length >= MIN_PLAYERS ? { scale: 1.05 } : undefined}
        whileTap={room.players.length >= MIN_PLAYERS ? { scale: 0.95 } : undefined}
        disabled={room.players.length < MIN_PLAYERS}
        onClick={() => startGame({ roomId: room._id, hostId: sessionId })}
        className="rounded-2xl px-14 py-5 text-2xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        style={{
          backgroundColor: gameMeta.color,
          color: gameMeta.textColor,
          boxShadow: room.players.length >= MIN_PLAYERS
            ? `0 0 30px ${gameMeta.color}40, 0 4px 20px ${gameMeta.color}20`
            : undefined,
        }}
      >
        {room.players.length < MIN_PLAYERS
          ? `${da.needMorePlayers} (${room.players.length}/${MIN_PLAYERS})`
          : da.startGame}
      </motion.button>
    </div>
  );
}

/* ── Finished Screen ───────────────────────────────────── */

function FinishedScreen({ room, sessionId }: { room: any; sessionId: string }) {
  const restartGame = useMutation(api.game.restartGame);
  const players = [...(room.players ?? [])].sort(
    (a: any, b: any) => b.score - a.score,
  );

  const topScore = players[0]?.score ?? 0;
  const winners = players.filter((p: any) => p.score === topScore);
  const isTie = winners.length > 1;
  const rest = players.filter((p: any) => p.score < topScore);

  useEffect(() => {
    const end = Date.now() + 3000;
    sfxFanfare();
    const colors = ["#8b6eff", "#f472b6", "#fbbf24", "#34d399", "#60a5fa"];

    function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    }
    frame();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <motion.h2
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        className="font-display text-4xl font-bold"
      >
        {da.gameOver}
      </motion.h2>

      {isTie ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="mb-4 text-lg text-[var(--color-text-muted)]">Uafgjort!</p>
          <div className="flex justify-center gap-6">
            {winners.map((w: any) => (
              <div key={w._id} className="text-center">
                <div className="mx-auto">
                  <GameAvatar name={w.name} avatarColor={w.avatarColor} avatarImage={w.avatarImage} className="h-20 w-20" />
                </div>
                <p className="mt-2 font-display text-2xl font-bold">{w.name}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-lg text-[var(--color-text-muted)]">{topScore} point</p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mx-auto">
            <GameAvatar name={winners[0].name} avatarColor={winners[0].avatarColor} avatarImage={winners[0].avatarImage} className="h-24 w-24" />
          </div>
          <p className="mt-3 font-display text-5xl font-bold">{winners[0].name}</p>
          <p className="mt-1 text-lg text-[var(--color-text-muted)]">{topScore} point</p>
        </motion.div>
      )}

      {rest.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-lg flex flex-col gap-2"
        >
          {rest.map((player: any, i: number) => (
            <motion.div
              key={player._id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="flex items-center gap-4 rounded-xl bg-[var(--color-surface)] p-3"
            >
              <span className="text-lg font-bold text-[var(--color-text-muted)] w-6">
                {winners.length + i + 1}
              </span>
              <GameAvatar name={player.name} avatarColor={player.avatarColor} avatarImage={player.avatarImage} />
              <span className="flex-1 font-semibold">{player.name}</span>
              <span className="font-bold text-[var(--color-primary-light)]">
                {player.score}
              </span>
            </motion.div>
          ))}
        </motion.div>
      )}

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => restartGame({ roomId: room._id, hostId: sessionId })}
        className="rounded-2xl bg-[var(--color-primary)] px-10 py-4 text-xl font-bold cursor-pointer"
        style={{ boxShadow: "0 0 30px color-mix(in srgb, var(--color-primary) 25%, transparent)" }}
      >
        {da.playAgain}
      </motion.button>
    </div>
  );
}

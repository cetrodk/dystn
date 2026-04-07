import { Suspense, lazy, useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Settings, SkipForward, Square, WifiOff, Volume2, VolumeX } from "lucide-react";

// Lazy-load QR code (only used in lobby)
const QRCodeSVG = lazy(() =>
  import("qrcode.react").then((m) => ({ default: m.QRCodeSVG })),
);
import { useSessionId } from "@/providers/SessionProvider";
import { PartyProvider, useRoom, useSend, usePartyConnection } from "@/providers/PartyProvider";
import { gameComponents, type RoomSnapshot } from "@/games/registry";
import { sfxFanfare } from "@/lib/sounds";
import { useGameMusic } from "@/hooks/useGameMusic";
import { useShowIntro } from "@/hooks/useShowIntro";
import { useVolume } from "@/hooks/useVolume";
import { ensureResumed } from "@/lib/audio/context";
import { GameAvatar } from "@/components/GameAvatar";
import { GamePicker, GAMES, GAME_ICONS } from "@/components/GamePicker";
import { GameIntro } from "@/components/GameIntro";
import { da } from "@/lib/da";
import { getHostSession, clearHostSession } from "@/lib/session";

const MIN_PLAYERS = 1;
const MAX_PLAYERS = 8;

const DEFAULT_GAME_META = { id: "none", color: "var(--color-primary)", textColor: "#fff" } as const;

/* -- Host Toolbar (persistent during gameplay) ------------------- */

function HostToolbar({
  room,
  sessionId,
}: {
  room: RoomSnapshot;
  sessionId: string;
}) {
  const send = useSend();
  const navigate = useNavigate();
  const game = room.gameType ? getGameInfo(room.gameType) : DEFAULT_GAME_META;
  const GameIcon = GAME_ICONS[room.gameType as keyof typeof GAME_ICONS];
  const [confirmStop, setConfirmStop] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between gap-4 px-4 py-2 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-white/5"
    >
      <div className="flex items-center gap-3">
        {GameIcon && <GameIcon className="h-5 w-5" style={{ color: game.color }} />}
        <span
          className="font-mono text-sm font-bold tracking-widest"
          style={{ color: game.color }}
        >
          {room.code}
        </span>
        {room.roundNumber != null && (
          <span className="text-xs text-[var(--color-text-muted)]">
            R{room.roundNumber}/{room.totalRounds}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <AnimatePresence>
          {confirmStop && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-2"
            >
              <span className="text-xs text-[var(--color-text-muted)]">Stop?</span>
              <button
                onClick={() => {
                  send({ type: "backToLobby", hostId: sessionId });
                  setConfirmStop(false);
                }}
                className="rounded-lg bg-[var(--color-danger)]/20 px-3 py-1.5 text-xs font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/30 transition-colors cursor-pointer"
              >
                Ja
              </button>
              <button
                onClick={() => setConfirmStop(false)}
                className="rounded-lg bg-[var(--color-surface-light)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
              >
                Nej
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {!confirmStop && (
          <button
            onClick={() => setConfirmStop(true)}
            className="rounded-lg bg-[var(--color-surface-light)] p-1.5 hover:bg-[var(--color-danger)]/20 hover:text-[var(--color-danger)] transition-colors cursor-pointer"
            title="Stop spil"
          >
            <Square className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => send({ type: "hostAdvance", hostId: sessionId })}
          className="rounded-lg bg-[var(--color-surface-light)] px-3 py-1.5 text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-primary)]/20 hover:text-[var(--color-primary-light)] transition-colors cursor-pointer"
          title="Spring videre"
        >
          <span className="flex items-center gap-1">Skip <SkipForward className="h-3.5 w-3.5" /></span>
        </button>
        <MuteButton />
        <button
          onClick={() => navigate(`/host/${room.code}/settings`)}
          className="rounded-lg bg-[var(--color-surface-light)] p-1.5 hover:bg-[var(--color-primary)]/20 transition-colors cursor-pointer"
          title="Indstillinger"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </motion.div>
  );
}

function MuteButton() {
  const { muted, toggleMute } = useVolume();
  const Icon = muted ? VolumeX : Volume2;
  return (
    <button
      onClick={() => {
        ensureResumed();
        toggleMute();
      }}
      className="rounded-lg bg-[var(--color-surface-light)] p-1.5 hover:bg-[var(--color-primary)]/20 transition-colors cursor-pointer"
      title={muted ? "Slå lyd til" : "Slå lyd fra"}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/* -- Pause Banner (shown when game is paused due to disconnect) -- */

function PauseBanner({
  sessionId,
  disconnectedPlayers,
}: {
  sessionId: string;
  disconnectedPlayers: any[];
}) {
  const send = useSend();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-12 left-0 right-0 z-40 flex flex-col items-center gap-3 px-4 py-4 bg-[var(--color-danger)]/10 backdrop-blur-md border-b border-[var(--color-danger)]/20"
    >
      <div className="flex items-center gap-2 text-[var(--color-danger)]">
        <WifiOff className="h-5 w-5" />
        <span className="font-bold text-sm">Spillet er sat på pause</span>
      </div>

      {disconnectedPlayers.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {disconnectedPlayers.map((p: any) => (
            <div key={p._id} className="flex items-center gap-2 rounded-lg bg-[var(--color-surface)] px-3 py-1.5">
              <GameAvatar name={p.name} avatarColor={p.avatarColor} avatarImage={p.avatarImage} className="h-6 w-6" />
              <span className="text-sm font-semibold">{p.name}</span>
              <span className="text-xs text-[var(--color-danger)]">afbrudt</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => send({ type: "continueGame", hostId: sessionId })}
          className="rounded-xl bg-[var(--color-primary)] px-6 py-2 text-sm font-bold transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        >
          Fortsæt alligevel
        </button>
      </div>
    </motion.div>
  );
}

/* -- Helpers ----------------------------------------------------- */

const GAME_MAP = new Map<string, (typeof GAMES)[number]>(GAMES.map((g) => [g.id, g]));

function getGameInfo(gameType: string) {
  return GAME_MAP.get(gameType) ?? GAMES[0];
}

/* -- Player Slots (grid of avatar cards) ------------------------- */

function PlayerSlots({ room, sessionId }: { room: RoomSnapshot; sessionId: string }) {
  const send = useSend();
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  const slots = Array.from({ length: MAX_PLAYERS }, (_, i) => room.players[i] ?? null);

  return (
    <div className="grid grid-cols-2 gap-2 w-full">
      {slots.map((player, i) =>
        player ? (
          <motion.div
            key={player._id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05, type: "spring", stiffness: 300 }}
            className="flex items-center gap-2.5 rounded-xl bg-[var(--color-surface)] px-3 py-2.5"
          >
            <GameAvatar name={player.name} avatarColor={player.avatarColor} avatarImage={player.avatarImage} className="h-9 w-9 shrink-0" />
            <span className="text-sm font-semibold truncate flex-1">{player.name}</span>
            {!player.isConnected && (
              <span className="text-[10px] text-[var(--color-danger)] shrink-0">●</span>
            )}
            {confirmKick === player._id ? (
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => {
                    send({ type: "kickPlayer", hostId: sessionId, playerId: player._id });
                    setConfirmKick(null);
                  }}
                  className="rounded-md bg-[var(--color-danger)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--color-danger)] cursor-pointer"
                >
                  Fjern
                </button>
                <button
                  onClick={() => setConfirmKick(null)}
                  className="rounded-md bg-[var(--color-surface-light)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)] cursor-pointer"
                >
                  Nej
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmKick(player._id)}
                className="shrink-0 rounded-md p-1 text-xs text-[var(--color-text-muted)]/40 hover:text-[var(--color-danger)] transition-colors cursor-pointer"
                aria-label={`Fjern ${player.name}`}
              >
                ✕
              </button>
            )}
          </motion.div>
        ) : (
          <div
            key={`empty-${i}`}
            className="flex items-center gap-2.5 rounded-xl border border-dashed border-[var(--color-surface-light)]/40 px-3 py-2.5"
          >
            <div className="h-9 w-9 rounded-full bg-[var(--color-surface)]/30 shrink-0" />
            <span className="text-sm text-[var(--color-text-muted)]/20 italic">ledig</span>
          </div>
        ),
      )}
    </div>
  );
}

/* -- Lobby Top Bar ----------------------------------------------- */

function LobbyTopBar({
  roomCode,
  confirmLeave,
  onToggleLeave,
  onLeave,
}: {
  roomCode: string;
  confirmLeave: boolean;
  onToggleLeave: () => void;
  onLeave: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between shrink-0 px-6 lg:px-10 py-3">
      {confirmLeave ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">{da.leaveRoomConfirm}</span>
          <button onClick={onLeave} className="rounded-lg bg-[var(--color-danger)]/20 px-3 py-1.5 text-xs font-bold text-[var(--color-danger)] cursor-pointer">
            {da.leaveAnyway}
          </button>
          <button onClick={onToggleLeave} className="rounded-lg bg-[var(--color-surface-light)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-muted)] cursor-pointer">
            {da.stayHere}
          </button>
        </div>
      ) : (
        <button onClick={onToggleLeave} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer">
          ← {da.back}
        </button>
      )}
      <div className="flex items-center gap-2">
        <MuteButton />
        <button
          onClick={() => navigate(`/host/${roomCode}/settings`)}
          className="rounded-xl bg-[var(--color-surface)] p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-light)] transition-all cursor-pointer"
          aria-label="Indstillinger"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/* -- Main Host View (inner, inside PartyProvider) ---------------- */

function HostViewInner() {
  const sessionId = useSessionId();
  const navigate = useNavigate();
  const room = useRoom();
  const send = useSend();
  const { connected } = usePartyConnection();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const hostConnectSent = useRef(false);
  const [showIntro, dismissIntro] = useShowIntro(room);

  useGameMusic(room);

  // Send hostConnect when websocket connects
  useEffect(() => {
    if (!connected || hostConnectSent.current) return;
    hostConnectSent.current = true;

    const session = getHostSession();
    if (session) {
      send({ type: "hostConnect", sessionId, hostSecret: session.secret });
    }
  }, [connected, send, sessionId]);

  // Warn before closing/refreshing — only when game is active (lobby or playing)
  const beforeUnloadRef = useRef<((e: BeforeUnloadEvent) => void) | null>(null);
  const isFinished = room?.status === "finished";
  useEffect(() => {
    // Remove handler when game is finished — host should be free to leave
    if (isFinished) {
      if (beforeUnloadRef.current) {
        window.removeEventListener("beforeunload", beforeUnloadRef.current);
        beforeUnloadRef.current = null;
      }
      return;
    }
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    beforeUnloadRef.current = handler;
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isFinished]);

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

  // -- Playing --
  if (room.status === "playing" && room.currentPhase && room.gameType) {
    const components = gameComponents[room.gameType];
    const basePhase = room.currentPhase.split("_")[0];
    const PhaseComponent = components?.host[basePhase];

    const isPaused = !!(room.settings as Record<string, unknown> | undefined)?.paused;
    const disconnectedPlayers = room.players.filter((p: any) => !p.isConnected);

    if (PhaseComponent) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-8 overflow-hidden p-8 pt-16">
          {showIntro && (
            <GameIntro gameType={room.gameType} variant="host" onDone={dismissIntro} />
          )}
          <HostToolbar
            room={room}
            sessionId={sessionId}
          />
          <AnimatePresence>
            {isPaused ? (
              <PauseBanner
                sessionId={sessionId}
                disconnectedPlayers={disconnectedPlayers}
              />
            ) : null}
          </AnimatePresence>
          <Suspense
            fallback={
              <div className="text-[var(--color-text-muted)] animate-gentle-pulse">
                Indlæser...
              </div>
            }
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={room.currentPhase + "-" + room.roundNumber}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex w-full flex-1 min-h-0 flex-col items-center gap-8"
              >
                <PhaseComponent room={room} sessionId={sessionId} />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </div>
      );
    }
  }

  // -- Finished --
  if (room.status === "finished") {
    return <FinishedScreen room={room} sessionId={sessionId} />;
  }

  // -- Lobby --
  const hasGame = !!room.gameType;
  const canStart = hasGame && room.players.length >= MIN_PLAYERS;

  function handleLeave() {
    if (beforeUnloadRef.current) window.removeEventListener("beforeunload", beforeUnloadRef.current);
    clearHostSession();
    navigate("/");
  }

  /* ── Game selected: game-first layout ── */
  if (hasGame) {
    const game = getGameInfo(room.gameType!);
    const Icon = GAME_ICONS[room.gameType as keyof typeof GAME_ICONS];

    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <LobbyTopBar
          roomCode={room.code}
          confirmLeave={confirmLeave}
          onToggleLeave={() => setConfirmLeave(!confirmLeave)}
          onLeave={handleLeave}
        />

        <div className="flex flex-1 min-h-0 flex-col lg:flex-row px-6 lg:px-10 pb-6 gap-6">
          {/* Left: Game hero + rules + start (primary focus) */}
          <div className="flex flex-1 min-w-0 flex-col items-center justify-center gap-8">
            {/* Game icon + title */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="flex flex-col items-center gap-3"
            >
              {Icon && <Icon className="h-20 w-20" style={{ color: game.color }} />}
              <h2 className="font-display text-6xl font-bold" style={{ color: game.color }}>
                {game.name}
              </h2>
              <p className="text-xl text-[var(--color-text-muted)]">{game.description}</p>
            </motion.div>

            {/* How to play */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="w-full max-w-xl rounded-2xl bg-[var(--color-surface)] p-6 ring-1"
              style={{ "--tw-ring-color": `color-mix(in srgb, ${game.color} 25%, transparent)` } as React.CSSProperties}
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: game.color }}>
                {da.howToPlay}
              </p>
              <p className="text-lg leading-relaxed text-[var(--color-text)]">
                {game.howToPlay}
              </p>
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">{game.expects}</p>
            </motion.div>

            {/* Start + change game */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="flex items-center gap-5"
            >
              <motion.button
                whileHover={canStart ? { scale: 1.05 } : undefined}
                whileTap={canStart ? { scale: 0.95 } : undefined}
                disabled={!canStart}
                onClick={() => send({ type: "startGame", hostId: sessionId })}
                className="rounded-2xl px-16 py-5 text-3xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  backgroundColor: game.color,
                  color: game.textColor,
                  boxShadow: canStart
                    ? `0 0 60px ${game.color}50, 0 0 120px ${game.color}20, 0 4px 24px ${game.color}30`
                    : undefined,
                }}
              >
                {room.players.length < MIN_PLAYERS
                  ? `${da.needMorePlayers} (${room.players.length}/${MIN_PLAYERS})`
                  : da.startGame}
              </motion.button>
              <button
                onClick={() => send({ type: "changeGameType", hostId: sessionId, gameType: "" })}
                className="rounded-xl bg-[var(--color-surface)] px-5 py-3 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer"
              >
                ← {da.changeGame}
              </button>
            </motion.div>
          </div>

          {/* Right: Room code (compact) + players */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden lg:flex flex-col gap-4 shrink-0 w-[340px] justify-center"
          >
            {/* Compact room code */}
            <div className="rounded-2xl bg-[var(--color-surface)] p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
                {da.roomCode}
              </p>
              <div className="font-display text-4xl font-bold tracking-[0.15em] glow-text mt-1">
                {room.code}
              </div>
            </div>

            {/* Players */}
            <div>
              <p className="text-sm text-[var(--color-text-muted)] text-center mb-2">
                <span className="font-bold text-[var(--color-text)] text-lg">{room.players.length}</span>
                <span className="mx-1">/</span>
                <span>{MAX_PLAYERS}</span>
                {" "}{da.playersJoined}
              </p>
              <PlayerSlots room={room} sessionId={sessionId} />
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ── No game selected: room code hero + carousel ── */
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <LobbyTopBar
          roomCode={room.code}
          confirmLeave={confirmLeave}
          onToggleLeave={() => setConfirmLeave(!confirmLeave)}
          onLeave={handleLeave}
        />

      {/* Hero: Room code + QR + Players */}
      <div className="flex flex-1 min-h-0 items-center px-6 lg:px-10">
        {/* QR column */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:flex flex-col items-center gap-4 shrink-0 mr-12 rounded-2xl bg-[var(--color-surface)]/60 p-5"
        >
          <Suspense fallback={<div className="h-[120px] w-[120px] rounded-2xl bg-white/10" />}>
            <div className="rounded-2xl bg-white p-3 shadow-xl shadow-black/30">
              <QRCodeSVG
                value={`${window.location.origin}/join/${room.code}`}
                size={96}
                fgColor="#0d0b1a"
                bgColor="white"
              />
            </div>
          </Suspense>
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-muted)]">Scan eller gå til</p>
            <p className="text-sm font-bold text-[var(--color-primary-light)] mt-0.5">
              {window.location.host}/join/{room.code}
            </p>
          </div>
        </motion.div>

        {/* Room code — center hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="flex-1 text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
            {da.roomCode}
          </p>
          <div className="font-display text-[8rem] lg:text-[10rem] font-bold tracking-[0.25em] leading-none glow-text">
            {room.code}
          </div>
        </motion.div>

        {/* Players column */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="hidden lg:flex flex-col gap-3 shrink-0 ml-10 w-[340px]"
        >
          <p className="text-sm text-[var(--color-text-muted)] text-center">
            <span className="font-bold text-[var(--color-text)] text-lg">{room.players.length}</span>
            <span className="mx-1">/</span>
            <span>{MAX_PLAYERS}</span>
            {" "}{da.playersJoined}
          </p>
          <PlayerSlots room={room} sessionId={sessionId} />
        </motion.div>
      </div>

      {/* Bottom: Game carousel */}
      <div className="shrink-0 px-6 lg:px-10 pb-6">
        <GamePicker
          onSelect={(gameId) => {
            send({ type: "changeGameType", hostId: sessionId, gameType: gameId });
          }}
          showExternalGames
        />
      </div>
    </div>
  );
}

/* -- Main Host View (outer, wraps in PartyProvider) -------------- */

export function HostView() {
  const { code } = useParams<{ code: string }>();
  const sessionId = useSessionId();

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--color-text-muted)]">Intet rumkode angivet.</p>
      </div>
    );
  }

  return (
    <PartyProvider roomCode={code} sessionId={sessionId}>
      <HostViewInner />
    </PartyProvider>
  );
}

/* -- Finished Screen --------------------------------------------- */

function FinishedScreen({ room, sessionId }: { room: RoomSnapshot; sessionId: string }) {
  const send = useSend();
  const players = [...(room.players ?? [])].sort(
    (a, b) => b.score - a.score,
  );

  const topScore = players[0]?.score ?? 0;
  const winners = players.filter((p) => p.score === topScore);
  const isTie = winners.length > 1;
  const rest = players.filter((p) => p.score < topScore);

  useEffect(() => {
    sfxFanfare();
    let rafId: number;
    let cancelled = false;

    import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      const end = Date.now() + 3000;
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
        if (Date.now() < end) rafId = requestAnimationFrame(frame);
      }
      rafId = requestAnimationFrame(frame);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
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
            {winners.map((w) => (
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

      {/* Two post-game options */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col items-center gap-3"
      >
        <button
          onClick={() => send({ type: "restartGame", hostId: sessionId })}
          className="rounded-2xl bg-[var(--color-primary)] px-10 py-4 text-xl font-bold cursor-pointer"
          style={{ boxShadow: "0 0 30px color-mix(in srgb, var(--color-primary) 25%, transparent)" }}
        >
          {da.playAgain}
        </button>
        <button
          onClick={() => send({ type: "backToLobby", hostId: sessionId })}
          className="rounded-xl px-8 py-3 text-base font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-light)] transition-all cursor-pointer"
        >
          {da.chooseNewGame}
        </button>
      </motion.div>

      {/* Back to lobby hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-xs text-[var(--color-text-muted)]/50"
      >
        {room.players.length} spillere stadig tilsluttet
      </motion.p>
    </div>
  );
}

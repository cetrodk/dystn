import { Suspense, lazy, useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Settings, SkipForward, Square, WifiOff } from "lucide-react";

// Lazy-load QR code (only used in lobby)
const QRCodeSVG = lazy(() =>
  import("qrcode.react").then((m) => ({ default: m.QRCodeSVG })),
);
import { useSessionId } from "@/providers/SessionProvider";
import { PartyProvider, useRoom, useSend, usePartyConnection } from "@/providers/PartyProvider";
import { gameComponents, type RoomSnapshot } from "@/games/registry";
import { sfxFanfare } from "@/lib/sounds";
import { GameAvatar } from "@/components/GameAvatar";
import { GamePicker, GAMES, GAME_ICONS } from "@/components/GamePicker";
import { da } from "@/lib/da";
import { getHostSession, clearHostSession } from "@/lib/session";

const MIN_PLAYERS = 1;

const GAME_OPTIONS = [
  { id: "blitz", color: "var(--color-blitz)", textColor: "#fff" },
  { id: "fusk", color: "var(--color-fusk)", textColor: "#0d0b1a" },
  { id: "scrawl", color: "var(--color-scrawl)", textColor: "#fff" },
  { id: "morph", color: "var(--color-morph)", textColor: "#0d0b1a" },
  { id: "surge", color: "var(--color-surge)", textColor: "#fff" },
  { id: "hunch", color: "var(--color-hunch)", textColor: "#0d0b1a" },
] as const;

function getGameMeta(gameType: string | undefined) {
  if (!gameType) return { id: "none", color: "var(--color-primary)", textColor: "#fff" };
  return GAME_OPTIONS.find((g) => g.id === gameType) ?? GAME_OPTIONS[0];
}

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
  const gameMeta = getGameMeta(room.gameType);
  const [confirmStop, setConfirmStop] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between gap-4 px-4 py-2 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-white/5"
    >
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

/* -- Game Info Card (lobby, game selected) ----------------------- */

function getGameInfo(gameType: string) {
  const game = GAMES.find((g) => g.id === gameType);
  if (game) return game;
  return GAMES[0];
}

function GameInfoCard({
  gameType,
  onChangeGame,
}: {
  gameType: string;
  onChangeGame: () => void;
}) {
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
        <button
          onClick={onChangeGame}
          className="text-xs text-[var(--color-primary-light)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
        >
          ← {da.changeGame}
        </button>
      </div>
    </div>
  );
}

/* -- Player List ------------------------------------------------- */

function PlayerList({ room, sessionId }: { room: RoomSnapshot; sessionId: string }) {
  const send = useSend();
  const [confirmKick, setConfirmKick] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="w-full max-w-md"
    >
      <p className="mb-4 text-center text-base text-[var(--color-text-muted)]">
        <span className="font-bold text-[var(--color-text)]">{room.players.length}</span>
        <span className="mx-1">/</span>
        <span>8</span>
        {" "}{da.playersJoined}
      </p>

      {room.players.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-surface-light)] p-8 text-center"
        >
          <span className="text-4xl animate-gentle-pulse">📱</span>
          <p className="text-sm text-[var(--color-text-muted)]">
            Scan QR-koden eller indtast rumkoden for at deltage
          </p>
        </motion.div>
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence>
            {room.players.map((player: any, i: number) => (
              <motion.li
                key={player._id}
                initial={{ opacity: 0, x: -20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 300 }}
                className="flex items-center gap-3 rounded-xl bg-[var(--color-surface)] p-4"
              >
                <GameAvatar name={player.name} avatarColor={player.avatarColor} avatarImage={player.avatarImage} className="h-10 w-10" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-lg font-semibold truncate">{player.name}</span>
                  {!player.isConnected && (
                    <span className="text-xs text-[var(--color-danger)]">afbrudt</span>
                  )}
                </div>
                {confirmKick === player._id ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        send({ type: "kickPlayer", hostId: sessionId, playerId: player._id });
                        setConfirmKick(null);
                      }}
                      className="rounded-lg bg-[var(--color-danger)]/20 px-2.5 py-1 text-xs font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/30 transition-colors cursor-pointer"
                    >
                      Fjern
                    </button>
                    <button
                      onClick={() => setConfirmKick(null)}
                      className="rounded-lg bg-[var(--color-surface-light)] px-2.5 py-1 text-xs font-bold text-[var(--color-text-muted)] cursor-pointer"
                    >
                      Nej
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmKick(player._id)}
                    className="shrink-0 rounded-lg p-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors cursor-pointer"
                    title="Fjern spiller"
                  >
                    ✕
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </motion.div>
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
          <AnimatePresence mode="wait">
            <motion.div
              key={room.currentPhase + "-" + room.roundNumber}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex w-full flex-1 min-h-0 flex-col items-center gap-8"
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

  // -- Finished --
  if (room.status === "finished") {
    return <FinishedScreen room={room} sessionId={sessionId} />;
  }

  // -- Lobby --
  const gameMeta = getGameMeta(room.gameType);
  const hasGame = !!room.gameType;
  const canStart = hasGame && room.players.length >= MIN_PLAYERS;

  return (
    <div className="relative flex min-h-screen flex-col p-8 pt-16">
      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        {confirmLeave ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">{da.leaveRoomConfirm}</span>
            <button onClick={() => {
              if (beforeUnloadRef.current) window.removeEventListener("beforeunload", beforeUnloadRef.current);
              clearHostSession();
              navigate("/");
            }} className="rounded-lg bg-[var(--color-danger)]/20 px-3 py-1.5 text-xs font-bold text-[var(--color-danger)] cursor-pointer">
              {da.leaveAnyway}
            </button>
            <button onClick={() => setConfirmLeave(false)} className="rounded-lg bg-[var(--color-surface-light)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-muted)] cursor-pointer">
              {da.stayHere}
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmLeave(true)} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer">
            ← {da.back}
          </button>
        )}
        <button
          onClick={() => navigate(`/host/${room.code}/settings`)}
          className="rounded-xl bg-[var(--color-surface)] p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-light)] transition-all cursor-pointer"
          title="Indstillinger"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {/* Two-column lobby: left (code+game) / right (players) */}
      <div className="flex flex-1 flex-col lg:flex-row lg:items-center lg:justify-center gap-8 lg:gap-16">
        {/* Left column: Room code + QR + game info */}
        <div className="flex flex-col items-center gap-6 lg:flex-1 lg:max-w-lg">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="card-glow w-full max-w-md rounded-2xl bg-[var(--color-surface)] overflow-hidden"
          >
            {/* Room code — hero element, readable across the room */}
            <div className="px-6 pt-6 pb-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
                {da.roomCode}
              </p>
              <div className="mt-1 font-display text-6xl sm:text-7xl lg:text-8xl font-bold tracking-[0.2em] glow-text">
                {room.code}
              </div>
            </div>

            {/* QR + join URL — compact row in darker inset strip */}
            <div className="flex items-center gap-4 bg-[var(--color-bg)]/60 px-5 py-4 border-t border-white/5">
              <Suspense fallback={<div className="h-[84px] w-[84px] shrink-0 rounded-xl bg-white/10" />}>
                <div className="shrink-0 rounded-xl bg-white p-2 shadow-lg shadow-black/20">
                  <QRCodeSVG
                    value={`${window.location.origin}/join/${room.code}`}
                    size={68}
                    fgColor="#0d0b1a"
                    bgColor="white"
                  />
                </div>
              </Suspense>
              <div className="min-w-0">
                <p className="text-xs text-[var(--color-text-muted)]">
                  Scan eller gå til
                </p>
                <p className="mt-0.5 text-sm font-bold text-[var(--color-primary-light)] break-all">
                  {window.location.host}/join/{room.code}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Game selection or game info */}
          {hasGame ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full flex justify-center"
            >
              <GameInfoCard
                gameType={room.gameType!}
                onChangeGame={() =>
                  send({ type: "changeGameType", hostId: sessionId, gameType: "" })
                }
              />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="w-full flex justify-center"
            >
              <GamePicker
                onSelect={(gameId) => {
                  send({ type: "changeGameType", hostId: sessionId, gameType: gameId });
                }}
                showExternalGames
              />
            </motion.div>
          )}
        </div>

        {/* Right column: Player list + start button */}
        <div className="flex flex-col items-center gap-6 lg:flex-1 lg:max-w-md">
          <PlayerList room={room} sessionId={sessionId} />

          {hasGame && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, type: "spring" }}
              whileHover={canStart ? { scale: 1.05 } : undefined}
              whileTap={canStart ? { scale: 0.95 } : undefined}
              disabled={!canStart}
              onClick={() => send({ type: "startGame", hostId: sessionId })}
              className="rounded-2xl px-14 py-5 text-2xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{
                backgroundColor: gameMeta.color,
                color: gameMeta.textColor,
                boxShadow: canStart
                  ? `0 0 30px ${gameMeta.color}40, 0 4px 20px ${gameMeta.color}20`
                  : undefined,
              }}
            >
              {room.players.length < MIN_PLAYERS
                ? `${da.needMorePlayers} (${room.players.length}/${MIN_PLAYERS})`
                : da.startGame}
            </motion.button>
          )}
        </div>
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

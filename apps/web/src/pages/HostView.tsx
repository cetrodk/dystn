import { Suspense, lazy, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Settings, SkipForward, Square, WifiOff, Volume2, VolumeX } from "lucide-react";

// Lazy-load QR code (only used in lobby)
const QRCodeSVG = lazy(() =>
  import("qrcode.react").then((m) => ({ default: m.QRCodeSVG })),
);
import { useSessionId } from "@/providers/SessionProvider";
import { useRoom, useSend, useHostClaimed, useLicenseResult, usePartyConnection } from "@/providers/PartyProvider";
import { gameComponents, type RoomSnapshot } from "@/games/registry";
import { sfxFanfare } from "@/lib/sounds";
import { useGameMusic } from "@/hooks/useGameMusic";
import { useShowIntro } from "@/hooks/useShowIntro";
import { useVolume } from "@/hooks/useVolume";
import { ensureResumed } from "@/lib/audio/context";
import { GameAvatar } from "@/components/GameAvatar";
import { GamePicker, GAMES, GAME_ICONS } from "@/components/GamePicker";
import { UnlockModal } from "@/components/UnlockModal";
import { newRedeemRequestId, trackRedeemForStorage } from "@/lib/license";
import { GameIntro } from "@/components/GameIntro";
import { UnknownPhase } from "@/components/UnknownPhase";
import { Logo, Chip, RoomCodeTiles, SectionHeader } from "@/components/Brand";
import { da } from "@/lib/da";
import { clearHostSession } from "@/lib/session";

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
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between gap-4 px-4 py-2 bg-[var(--color-bg)]/85 backdrop-blur-md border-b-2 border-[var(--color-ink)]/15"
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
          <span className="flex items-center gap-1"><span className="hidden sm:inline">Skip</span> <SkipForward className="h-3.5 w-3.5" /></span>
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
      className="grid h-9 w-9 place-items-center rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer"
      title={muted ? "Slå lyd til" : "Slå lyd fra"}
    >
      <Icon className="h-[18px] w-[18px]" />
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
              <GameAvatar name={p.name} avatarColor={p.avatarColor} avatar={p.avatar} className="h-6 w-6" />
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
    <div className="grid grid-cols-2 gap-2.5 w-full">
      {slots.map((player, i) =>
        player ? (
          <motion.div
            key={player._id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05, type: "spring", stiffness: 300 }}
            className="nb-card relative flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={{ boxShadow: "4px 4px 0 var(--color-ink)" }}
          >
            <GameAvatar name={player.name} avatarColor={player.avatarColor} avatar={player.avatar} className="h-9 w-9 shrink-0" />
            {/* Op til to linjer i fuld størrelse — sædekortet er for smalt til
                lange navne på én linje (se docs/host-lobby-name-display-analysis.md) */}
            <span className="font-display text-base leading-tight line-clamp-2 [overflow-wrap:anywhere] flex-1">{player.name}</span>
            {!player.isConnected && (
              <span className="text-[10px] text-[var(--color-danger)] shrink-0">●</span>
            )}
            {confirmKick === player._id ? (
              <div className="absolute -top-2.5 -right-2 flex gap-1">
                <button
                  onClick={() => {
                    send({ type: "kickPlayer", hostId: sessionId, playerId: player._id });
                    setConfirmKick(null);
                  }}
                  className="rounded-md border-2 border-[var(--color-ink)] bg-[var(--color-danger)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--color-paper)] cursor-pointer"
                >
                  Fjern
                </button>
                <button
                  onClick={() => setConfirmKick(null)}
                  className="rounded-md border-2 border-[var(--color-ink)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--color-text-muted)] cursor-pointer"
                >
                  Nej
                </button>
              </div>
            ) : (
              /* Hjørne-badge i stedet for inline — koster 0 px i rækken, så
                 navnet får pladsen */
              <button
                onClick={() => setConfirmKick(player._id)}
                className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-paper)] text-xs text-[var(--color-ink)]/60 hover:text-[var(--color-paper)] hover:bg-[var(--color-danger)] transition-all cursor-pointer"
                aria-label={`Fjern ${player.name}`}
              >
                ✕
              </button>
            )}
          </motion.div>
        ) : (
          <div
            key={`empty-${i}`}
            className="flex items-center gap-2.5 rounded-xl border-[3px] border-dashed border-[var(--color-ink)]/25 px-3 py-2.5"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-dashed border-[var(--color-ink)]/25 font-mono text-sm text-[var(--color-ink)]/30">
              ?
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--color-ink)]/30">
              ledig
            </span>
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
    <div className="flex items-center justify-between shrink-0 px-6 lg:px-10 py-4">
      <div className="flex items-center gap-4">
        {confirmLeave ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">{da.leaveRoomConfirm}</span>
            <button onClick={onLeave} className="rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-danger)] px-3 py-1.5 text-xs font-bold text-[var(--color-paper)] cursor-pointer">
              {da.leaveAnyway}
            </button>
            <button onClick={onToggleLeave} className="rounded-lg border-2 border-[var(--color-ink)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-muted)] cursor-pointer">
              {da.stayHere}
            </button>
          </div>
        ) : (
          <button
            onClick={onToggleLeave}
            className="grid h-9 w-9 place-items-center rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer"
            aria-label={da.back}
          >
            ←
          </button>
        )}
        <Logo />
      </div>
      <div className="flex items-center gap-2.5">
        <div className="hidden sm:flex items-center gap-2">
          <Chip>EP. 01 · VOL. ONE</Chip>
          <Chip>LIVE LOBBY</Chip>
        </div>
        <MuteButton />
        <button
          onClick={() => navigate(`/host/${roomCode}/settings`)}
          className="grid h-9 w-9 place-items-center rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-surface-light)] transition-all cursor-pointer"
          aria-label="Indstillinger"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}

/* -- Main Host View (rendered inside HostLayout's PartyProvider;
      hostConnect is sent by HostConnectionManager there) ---------- */

export function HostView() {
  const sessionId = useSessionId();
  const navigate = useNavigate();
  const room = useRoom();
  const send = useSend();
  const hostClaimed = useHostClaimed();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showIntro, dismissIntro] = useShowIntro(room);

  useGameMusic(room);

  // ── Dystn-pakken: oplåsnings-modal + licens-status ──
  const licenseResult = useLicenseResult();
  const { connected } = usePartyConnection();
  const [showUnlock, setShowUnlock] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const pendingRedeem = useRef<string | null>(null); // requestId på egen indløsning

  // Manglende felt = ældre server (deploy-skew/rollback) — må aldrig låse
  // spil, der var åbne før licens-flowet; kun et eksplicit snapshot låser.
  const entitlements = room?.entitlements;
  const hasPack = entitlements ? entitlements.includes("pack1") : true;

  // Konfetti når pakken låses op LIVE — uanset kilde (modal, /tak-fane via
  // storage-event ELLER cross-device onRequest, hvor kun snapshottet ændrer
  // sig). Første snapshot sætter kun baseline, så reload ikke fejrer igen.
  const prevHasPack = useRef<boolean | null>(null);
  useEffect(() => {
    if (!room) return;
    const had = prevHasPack.current;
    prevHasPack.current = hasPack;
    if (had === false && hasPack) {
      setShowUnlock(false);
      setUnlockError(null);
      setRedeeming(false);
      import("canvas-confetti").then(({ default: confetti }) => {
        confetti({ particleCount: 180, spread: 90, origin: { y: 0.6 } });
      });
    }
  }, [room, hasPack]);

  // Egne indløsninger matches på requestId — auto-indløsninger (hostConnect-
  // medbragt kode, storage-event) deler kanal, og et ukorreleret svar må
  // hverken rydde en fremmed pending eller gemme en forkert kode. Selve
  // localStorage-skrivningen sker centralt i HostLayout (LicensePersistence).
  // `at`-feltet gør at gentagne ens fejl re-trigger.
  useEffect(() => {
    if (!licenseResult) return;
    const isOwn =
      licenseResult.requestId != null && licenseResult.requestId === pendingRedeem.current;
    if (isOwn) {
      pendingRedeem.current = null;
      setRedeeming(false);
    }
    // Fejl vises også for auto-indløsninger (ingen egen pending) — ellers står
    // værten med låste spil og nul forklaring, når den gemte kode afvises.
    if (!licenseResult.ok && (isOwn || pendingRedeem.current === null)) {
      setUnlockError(da.license.errors[licenseResult.reason ?? "invalid"]);
    }
  }, [licenseResult]);

  // Socket-drop mellem send og svar: svaret kommer aldrig (serveren svarer på
  // den døde connection), så knappen må ikke hænge på "Indløser..." for evigt.
  useEffect(() => {
    if (connected || pendingRedeem.current === null) return;
    pendingRedeem.current = null;
    setRedeeming(false);
    setUnlockError(da.license.errors.network);
  }, [connected]);

  function handleRedeem(code: string, remember: boolean) {
    const requestId = newRedeemRequestId();
    if (remember) trackRedeemForStorage(requestId, code);
    pendingRedeem.current = requestId;
    setUnlockError(null);
    setRedeeming(true);
    send({ type: "redeemLicense", hostId: sessionId, code, requestId });
  }

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

  // Claim rejected: the room already has another host (code collision) or the
  // stored hostSecret is wrong. Without this screen every click is silently
  // ignored by the server.
  if (hostClaimed === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
        <h2 className="font-display text-3xl font-bold">{da.notHostOfRoom}</h2>
        <p className="max-w-md text-[var(--color-text-muted)]">{da.notHostOfRoomHint}</p>
        <button
          onClick={() => {
            clearHostSession();
            navigate("/");
          }}
          className="rounded-xl bg-[var(--color-primary)] px-6 py-3 font-bold text-[var(--color-paper)] cursor-pointer"
        >
          {da.createNewRoom}
        </button>
      </div>
    );
  }

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
        <div className="flex h-screen flex-col items-center justify-center gap-4 sm:gap-8 overflow-hidden p-4 sm:p-8 pt-14 sm:pt-16">
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
                className="flex w-full flex-1 min-h-0 flex-col items-center gap-4 sm:gap-8"
              >
                <PhaseComponent room={room} sessionId={sessionId} />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </div>
      );
    }
    // Server phase this bundle doesn't know (skewed deploy) — don't fall
    // through to the lobby screen mid-game.
    return <UnknownPhase gameType={room.gameType} phase={room.currentPhase} />;
  }

  // -- Finished --
  if (room.status === "finished") {
    return <FinishedScreen room={room} sessionId={sessionId} />;
  }

  // -- Lobby --
  const hasGame = !!room.gameType;
  const minPlayers = hasGame ? getGameInfo(room.gameType!).minPlayers : 1;
  const canStart = hasGame && room.players.length >= minPlayers;

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
              {Icon && <Icon className="h-14 w-14 sm:h-20 sm:w-20" style={{ color: game.color }} />}
              <h2 className="font-display text-4xl sm:text-6xl font-bold" style={{ color: game.color }}>
                {game.name}
              </h2>
              <p className="text-base sm:text-xl text-[var(--color-text-muted)]">{game.description}</p>
            </motion.div>

            {/* How to play */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="nb-card w-full max-w-xl rounded-2xl p-6"
            >
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: game.color }}>
                ── {da.howToPlay} ──
              </p>
              <p className="text-base sm:text-lg leading-relaxed text-[var(--color-text)]">
                {game.howToPlay}
              </p>
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">{game.expects}</p>
            </motion.div>

            {/* Start + change game */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5"
            >
              <button
                disabled={!canStart}
                onClick={() => send({ type: "startGame", hostId: sessionId })}
                className="nb-press flex items-center justify-center gap-2 rounded-2xl border-[4px] border-[var(--color-ink)] px-8 sm:px-16 py-3 sm:py-5 font-display text-xl sm:text-3xl transition-all disabled:cursor-not-allowed cursor-pointer"
                style={{
                  backgroundColor: canStart ? "var(--color-ink)" : "var(--color-surface-light)",
                  color: canStart ? "var(--color-paper)" : "color-mix(in srgb, var(--color-ink) 45%, transparent)",
                  boxShadow: canStart ? `6px 6px 0 ${game.color}` : "none",
                }}
              >
                {room.players.length < minPlayers
                  ? `${da.needMorePlayers(minPlayers)} (${room.players.length}/${minPlayers})`
                  : `${da.startGame} →`}
              </button>
              <button
                onClick={() => send({ type: "changeGameType", hostId: sessionId, gameType: "" })}
                className="rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-5 py-3 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer"
              >
                ← {da.changeGame}
              </button>
            </motion.div>
          </div>

          {/* Mobile: compact player count + room code */}
          <div className="flex lg:hidden items-center justify-center gap-4 text-sm text-[var(--color-text-muted)]">
            <span className="font-mono font-bold tracking-widest text-[var(--color-primary)]">{room.code}</span>
            <span>·</span>
            <span><span className="font-bold text-[var(--color-text)]">{room.players.length}</span>/{MAX_PLAYERS} {da.playersJoined}</span>
          </div>

          {/* Right: Room code (compact) + players */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden lg:flex flex-col gap-5 shrink-0 w-[340px] justify-center"
          >
            {/* Compact room code */}
            <div className="nb-card flex flex-col items-center gap-3 rounded-2xl p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                {da.roomCode}
              </p>
              <RoomCodeTiles code={room.code} size="sm" />
            </div>

            {/* Players */}
            <div className="flex flex-col gap-3">
              <SectionHeader
                n="03"
                title={`SPILLERE · ${room.players.length}/${MAX_PLAYERS}`}
              />
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
      <div className="flex flex-1 min-h-0 items-center px-6 lg:px-10 gap-8 lg:gap-12">
        {/* QR column */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:flex flex-col items-center gap-2 shrink-0"
        >
          <Suspense fallback={<div className="h-[120px] w-[120px] rounded-xl bg-[var(--color-surface-light)]" />}>
            <div
              className="rounded-xl border-[3px] border-[var(--color-ink)] bg-white p-2"
              style={{ boxShadow: "5px 5px 0 var(--color-ink)" }}
            >
              <QRCodeSVG
                value={`${window.location.origin}/join/${room.code}`}
                size={104}
                fgColor="#1a1714"
                bgColor="white"
              />
            </div>
          </Suspense>
          <div className="mt-1 font-mono text-[10px] tracking-[0.15em] text-[var(--color-text-muted)]">
            SCAN FOR AT DELTAGE
          </div>
        </motion.div>

        {/* Room code — center hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="flex-1 flex flex-col items-center text-center"
        >
          <div className="font-mono text-xs tracking-[0.18em] text-[var(--color-text-muted)] mb-2">
            ── TRIN ÉT ──&nbsp;&nbsp;DELTAG I RUMMET
          </div>
          <div className="text-sm font-semibold uppercase tracking-[0.12em] mb-4">
            Gå til{" "}
            <span className="text-[var(--color-primary)]">
              {window.location.host}/join
            </span>
          </div>
          <RoomCodeTiles code={room.code} size="lg" />
          {/* Mobile: player count */}
          <p className="lg:hidden text-sm text-[var(--color-text-muted)] mt-5">
            <span className="font-bold text-[var(--color-text)]">{room.players.length}</span>/{MAX_PLAYERS} {da.playersJoined}
          </p>
        </motion.div>

        {/* Players column */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="hidden lg:flex flex-col gap-3 shrink-0 w-[340px]"
        >
          <SectionHeader
            n="03"
            title={`SPILLERE · ${room.players.length}/${MAX_PLAYERS}`}
            sub="deltag på din telefon"
          />
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
          entitlements={entitlements}
          // Fejlen ryddes bevidst IKKE her: en fejlet auto-indløsning skal
          // kunne ses, når værten åbner modalen for at forstå de låste spil.
          onUnlockClick={() => setShowUnlock(true)}
        />
      </div>

      <UnlockModal
        open={showUnlock}
        onClose={() => setShowUnlock(false)}
        onRedeem={handleRedeem}
        redeeming={redeeming}
        error={unlockError}
      />
    </div>
  );
}

/* -- Finished Screen --------------------------------------------- */

function FinishedScreen({ room, sessionId }: { room: RoomSnapshot; sessionId: string }) {
  const send = useSend();
  const players = [...(room.players ?? [])].sort(
    (a, b) => b.score - a.score,
  );

  const topScore = players[0]?.score ?? 0;
  const isTie = players.filter((p) => p.score === topScore).length > 1;

  useEffect(() => {
    sfxFanfare();
    let rafId: number;
    let cancelled = false;

    import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      const end = Date.now() + 3000;
      const colors = ["#e8553a", "#2e6be6", "#f2c14e", "#6bae5a", "#9b7be8"];

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

  const podium = players.slice(0, 3);
  const rest = players.slice(3);
  const gameName = room.gameType ? getGameInfo(room.gameType).name : "";
  // Visual order: 2nd, 1st, 3rd. Pillar heights + colours by place.
  const order = [1, 0, 2];
  const pillarHeights = [200, 150, 124];
  const pillarColors = ["var(--color-fusk)", "var(--color-primary)", "var(--color-accent)"];

  return (
    <div className="relative z-[1] flex min-h-screen flex-col items-center px-6 lg:px-10 py-8">
      <header className="flex w-full max-w-[1480px] items-center justify-between">
        <Logo />
        <Chip>FINALE{gameName ? ` · ${gameName.toUpperCase()}` : ""}</Chip>
      </header>

      <div className="mt-6 text-center">
        <div className="font-mono text-xs tracking-[0.2em] text-[var(--color-text-muted)]">
          ── {isTie ? "UAFGJORT" : "PODIET"} ──
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="font-display italic text-[clamp(48px,7vw,96px)] leading-[0.9] mt-1"
        >
          {da.gameOver}
        </motion.div>
      </div>

      {/* Podium */}
      <div className="mt-10 grid w-full max-w-[820px] grid-cols-3 items-end gap-4 sm:gap-5">
        {order.map((idx) => {
          const p = podium[idx];
          if (!p) return <div key={idx} />;
          // Competition ranking so tied players share height, colour and place
          // number — matching their phones and the "og resten" scoreboard below.
          const place = 1 + players.filter((x) => x.score > p.score).length;
          const tier = Math.min(place - 1, 2);
          const isFirst = place === 1;
          return (
            <motion.div
              key={p._id}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.15, type: "spring", stiffness: 160 }}
              className="flex flex-col items-center gap-2.5"
            >
              <div
                className="rounded-2xl border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-1.5"
                style={{ boxShadow: "5px 5px 0 var(--color-ink)" }}
              >
                <GameAvatar
                  name={p.name}
                  avatarColor={p.avatarColor}
                  avatar={p.avatar}
                  className={isFirst ? "h-24 w-24" : "h-[72px] w-[72px]"}
                />
              </div>
              <div className="font-display text-xl sm:text-2xl leading-none text-center">{p.name}</div>
              <div className="font-mono text-[11px] tracking-[0.14em] text-[var(--color-text-muted)]">
                {p.score} POINT
              </div>
              <div
                className="grid w-full place-items-center rounded-t-xl border-[3px] border-[var(--color-ink)] font-display italic text-[var(--color-paper)]"
                style={{
                  height: pillarHeights[tier],
                  background: pillarColors[tier],
                  boxShadow: "5px 5px 0 var(--color-ink)",
                  fontSize: isFirst ? 84 : 60,
                }}
              >
                {place}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Scoreboard for the rest */}
      {rest.length > 0 && (
        <div className="mt-10 w-full max-w-[640px]">
          <div className="mb-3 text-center font-mono text-[11px] tracking-[0.2em] text-[var(--color-text-muted)]">
            ── OG RESTEN ──
          </div>
          <div className="nb-card rounded-2xl p-2">
            {rest.map((player: any, i: number) => (
              <motion.div
                key={player._id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.08 }}
                className={`flex items-center justify-between px-3.5 py-2.5 ${i < rest.length - 1 ? "border-b border-dashed border-[var(--color-ink)]/20" : ""}`}
              >
                <div className="flex items-center gap-3.5">
                  {/* Competition ranking so ties match the players' phones */}
                  <span className="w-7 font-display text-xl text-[var(--color-ink)] opacity-40">
                    {1 + players.filter((p) => p.score > player.score).length}
                  </span>
                  <GameAvatar name={player.name} avatarColor={player.avatarColor} avatar={player.avatar} className="h-9 w-9" />
                  <span className="font-display text-lg">{player.name}</span>
                </div>
                <span className="font-mono text-xs tracking-[0.14em] text-[var(--color-text-muted)]">
                  {player.score} POINT
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Post-game options */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-10 flex flex-wrap items-center justify-center gap-3"
      >
        <button
          onClick={() => send({ type: "restartGame", hostId: sessionId })}
          className="nb-press rounded-2xl border-[3px] border-[var(--color-ink)] bg-[var(--color-ink)] px-8 py-3.5 font-display text-xl text-[var(--color-paper)] cursor-pointer"
          style={{ boxShadow: "5px 5px 0 var(--color-primary)" }}
        >
          {da.playAgain} →
        </button>
        <button
          onClick={() => send({ type: "backToLobby", hostId: sessionId })}
          className="rounded-2xl border-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-6 py-3.5 text-base font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-light)] transition-all cursor-pointer"
        >
          {da.chooseNewGame}
        </button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-4 font-mono text-[11px] tracking-[0.12em] text-[var(--color-text-muted)]/60"
      >
        {room.players.length} SPILLERE STADIG TILSLUTTET
      </motion.p>
    </div>
  );
}

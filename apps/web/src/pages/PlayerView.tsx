import { Suspense, useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff } from "lucide-react";
import { PartyProvider, useRoom, useSend, usePartyConnection, useRoomClosed, useRejoinFailed } from "@/providers/PartyProvider";
import { gameComponents } from "@/games/registry";
import { GameAvatar } from "@/components/GameAvatar";
import { AvatarPickerModal } from "@/components/AvatarPickerModal";
import { GameIntro } from "@/components/GameIntro";
import { useShowIntro } from "@/hooks/useShowIntro";
import { da, pluralPlayers } from "@/lib/da";
import { PLAYER_NAME_KEY, PLAYER_AVATAR_KEY, getRoomSessionId } from "@/lib/session";

function PlayerNav({ sessionId }: { sessionId: string }) {
  const send = useSend();
  const navigate = useNavigate();

  function handleLeave() {
    send({ type: "leaveRoom", sessionId });
    navigate("/play");
  }

  return (
    <div className="flex items-center gap-4">
      <a
        href="/"
        className="text-sm text-[var(--color-text-muted)] underline underline-offset-4 decoration-[var(--color-text-muted)]/30 hover:decoration-[var(--color-text-muted)] transition-colors"
      >
        Forside
      </a>
      <button
        onClick={handleLeave}
        className="text-sm text-[var(--color-text-muted)] underline underline-offset-4 decoration-[var(--color-text-muted)]/30 hover:decoration-[var(--color-text-muted)] transition-colors cursor-pointer"
      >
        Forlad spil
      </button>
    </div>
  );
}

function HostDisconnectedBanner() {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 py-4 bg-[var(--color-warning)]/10 backdrop-blur-md border-b border-[var(--color-warning)]/20"
    >
      <div className="flex items-center gap-2 text-[var(--color-warning)]">
        <WifiOff className="h-5 w-5" />
        <span className="font-bold text-sm">{da.hostDisconnected}</span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] animate-gentle-pulse">
        {da.waitingForHostReturn}
      </p>
      <button
        onClick={() => navigate("/play")}
        className="rounded-xl bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
      >
        {da.leaveGame}
      </button>
    </motion.div>
  );
}

function FeedbackToast({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="fixed top-4 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-[var(--color-danger)] px-5 py-3 text-center text-sm font-semibold text-white shadow-lg"
    >
      {message}
    </motion.div>
  );
}

function ConnectionLostBanner() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-[var(--color-warning)]/15 py-2 text-xs font-semibold text-[var(--color-warning)] backdrop-blur-md">
      <WifiOff className="h-4 w-4" />
      {da.connectionLost}
    </div>
  );
}

function PlayerViewInner({ sessionId }: { sessionId: string }) {
  const { code } = useParams<{ code: string }>();
  const room = useRoom();
  const send = useSend();
  const navigate = useNavigate();
  const { connected, error } = usePartyConnection();
  const roomClosed = useRoomClosed();
  const rejoinFailed = useRejoinFailed();
  const hasJoined = useRef(false);
  const prevConnected = useRef(false);

  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showIntro, dismissIntro] = useShowIntro(room);

  // Surface server rejections ("Prøv et andet svar", "Rummet er fuldt", …) that
  // were previously swallowed — the player used to see an eternal waiting screen.
  useEffect(() => {
    if (!error) return;
    setToast(error);
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  // Unknown session on the server (room was reset or storage cleared) — fall
  // back to the join screen with the code prefilled instead of hanging.
  useEffect(() => {
    if (rejoinFailed) {
      navigate(`/join/${code ?? ""}`, { replace: true });
    }
  }, [rejoinFailed, code, navigate]);

  const overlays = (
    <>
      <AnimatePresence>{toast && <FeedbackToast message={toast} />}</AnimatePresence>
      {!connected && room ? <ConnectionLostBanner /> : null}
    </>
  );

  // Send join on first connect, rejoin on reconnect
  useEffect(() => {
    if (!connected) {
      prevConnected.current = false;
      return;
    }
    if (prevConnected.current) return;
    prevConnected.current = true;

    // Read name from sessionStorage (set by JoinPage) — only clear AFTER reading
    const storedName = sessionStorage.getItem(PLAYER_NAME_KEY);
    const storedAvatar = sessionStorage.getItem(PLAYER_AVATAR_KEY);

    if (!hasJoined.current && storedName) {
      hasJoined.current = true;
      sessionStorage.removeItem(PLAYER_NAME_KEY);
      sessionStorage.removeItem(PLAYER_AVATAR_KEY);
      send({
        type: "join",
        name: storedName,
        sessionId,
        ...(storedAvatar ? { avatarImage: storedAvatar } : {}),
      });
    } else {
      hasJoined.current = true;
      send({ type: "rejoin", sessionId });
    }
  }, [connected, send, sessionId]);

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--color-text-muted)] animate-gentle-pulse">Indlæser...</p>
      </div>
    );
  }

  if (roomClosed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
        <p className="font-display text-3xl font-bold">{da.roomClosed}</p>
        <p className="text-[var(--color-text-muted)]">{roomClosed}</p>
        <button onClick={() => navigate("/play")} className="rounded-xl bg-[var(--color-primary)] px-8 py-3 font-bold cursor-pointer">
          {da.back}
        </button>
      </div>
    );
  }

  const hostGone = room.hostConnected === false;

  // Phase routing
  if (room.status === "playing" && room.currentPhase && room.gameType) {
    const components = gameComponents[room.gameType];
    const basePhase = room.currentPhase.split("_")[0];
    const PhaseComponent = components?.player[basePhase];

    if (PhaseComponent) {
      return (
        <>
          {overlays}
          {showIntro && !!room.gameType && (
            <GameIntro gameType={room.gameType} variant="player" onDone={dismissIntro} />
          )}
          <AnimatePresence>
            {hostGone && <HostDisconnectedBanner />}
          </AnimatePresence>
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center text-[var(--color-text-muted)] animate-gentle-pulse">
                Indlæser...
              </div>
            }
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={room.currentPhase + "-" + room.roundNumber}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <PhaseComponent room={room} sessionId={sessionId} />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </>
      );
    }
  }

  const currentPlayer = room.players?.find(
    (p) => p._id === room.currentPlayerId,
  );

  // -- Finished --
  if (room.status === "finished") {
    const sorted = [...(room.players ?? [])].sort(
      (a, b) => b.score - a.score,
    );
    const rank = sorted.findIndex(
      (p) => p._id === room.currentPlayerId,
    ) + 1;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
        <motion.p
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="font-display text-3xl font-bold"
        >
          {da.gameOver}
        </motion.p>
        {currentPlayer ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <GameAvatar name={currentPlayer.name} avatarColor={currentPlayer.avatarColor} avatarImage={currentPlayer.avatarImage} className="h-20 w-20" />
            <p className="font-display text-5xl font-bold" style={{ color: rank === 1 ? "var(--color-warning)" : "var(--color-primary-light)" }}>
              #{rank}
            </p>
            <p className="text-xl text-[var(--color-text-muted)]">
              {currentPlayer.score} point
            </p>
          </motion.div>
        ) : null}
        <p className="text-sm text-[var(--color-text-muted)] animate-gentle-pulse">
          {da.waitingForHost}
        </p>
        <PlayerNav sessionId={sessionId} />
      </div>
    );
  }

  // -- Lobby --
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      {overlays}
      <AnimatePresence>
        {hostGone && <HostDisconnectedBanner />}
      </AnimatePresence>
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-4xl font-bold"
      >
        {da.youreIn}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="font-mono text-2xl font-bold tracking-widest text-[var(--color-primary-light)]"
      >
        {room.code}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-xs"
      >
        <p className="mb-3 text-center text-sm text-[var(--color-text-muted)]">
          {room.players.length} {pluralPlayers(room.players.length)} tilsluttet
        </p>
        <ul className="flex flex-col gap-2">
          <AnimatePresence>
            {room.players.map((player) => {
              const isMe = player._id === room.currentPlayerId;
              return (
                <motion.li
                  key={player._id}
                  layout
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div
                    onClick={isMe ? () => setAvatarModalOpen(true) : undefined}
                    className={`flex items-center gap-3 rounded-xl bg-[var(--color-surface)] p-2.5 transition-all ${
                      isMe ? "cursor-pointer ring-1 ring-[var(--color-primary)]/40 hover:ring-[var(--color-primary)]/70" : ""
                    }`}
                  >
                    <GameAvatar name={player.name} avatarColor={player.avatarColor} avatarImage={player.avatarImage} className="h-8 w-8" />
                    <span className="text-sm font-semibold">{player.name}</span>
                    {isMe ? (
                      <span className="ml-auto text-xs font-medium text-[var(--color-primary-light)]">
                        dig
                      </span>
                    ) : null}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </motion.div>

      <AnimatePresence>
        {avatarModalOpen ? (
          <AvatarPickerModal
            selected={currentPlayer?.avatarImage ?? null}
            onSelect={(name) => {
              send({ type: "changeAvatar", sessionId, avatarImage: name ?? "" });
            }}
            onClose={() => setAvatarModalOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <p className="text-sm text-[var(--color-text-muted)] animate-gentle-pulse">
        {room.gameType ? da.waitingForHost : da.noGameSelected}
      </p>
      <PlayerNav sessionId={sessionId} />
    </div>
  );
}

export function PlayerView() {
  const { code } = useParams<{ code: string }>();

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--color-text-muted)]">Intet rumkode angivet.</p>
      </div>
    );
  }

  // Room-scoped identity in localStorage: survives the mobile browser killing
  // the tab while the phone is locked between rounds.
  const sessionId = getRoomSessionId(code);

  return (
    <PartyProvider roomCode={code} sessionId={sessionId}>
      <PlayerViewInner sessionId={sessionId} />
    </PartyProvider>
  );
}

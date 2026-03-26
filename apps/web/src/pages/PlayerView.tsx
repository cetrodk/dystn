import { Suspense, useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSessionId } from "@/providers/SessionProvider";
import { PartyProvider, useRoom, useSend, usePartyConnection } from "@/providers/PartyProvider";
import { gameComponents } from "@/games/registry";
import { GameAvatar } from "@/components/GameAvatar";
import { AvatarPickerModal } from "@/components/AvatarPickerModal";
import { da } from "@/lib/da";
import { PLAYER_NAME_KEY, PLAYER_AVATAR_KEY } from "@/lib/session";

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

function PlayerViewInner() {
  const sessionId = useSessionId();
  const room = useRoom();
  const send = useSend();
  const { connected } = usePartyConnection();
  const hasJoined = useRef(false);
  const prevConnected = useRef(false);

  // Read name once on mount (before any effects can clear it)
  const pendingJoin = useRef<{ name: string; avatar?: string } | null>(null);
  if (pendingJoin.current === null) {
    const name = sessionStorage.getItem(PLAYER_NAME_KEY);
    const avatar = sessionStorage.getItem(PLAYER_AVATAR_KEY);
    if (name) {
      pendingJoin.current = { name, avatar: avatar ?? undefined };
      sessionStorage.removeItem(PLAYER_NAME_KEY);
      sessionStorage.removeItem(PLAYER_AVATAR_KEY);
    } else {
      pendingJoin.current = undefined as any;
    }
  }

  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  // Send join on first connect, rejoin on reconnect
  useEffect(() => {
    if (!connected) {
      prevConnected.current = false;
      return;
    }
    if (prevConnected.current) return; // already connected, no action
    prevConnected.current = true;

    if (!hasJoined.current && pendingJoin.current) {
      hasJoined.current = true;
      send({
        type: "join",
        name: pendingJoin.current.name,
        sessionId,
        ...(pendingJoin.current.avatar ? { avatarImage: pendingJoin.current.avatar } : {}),
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

  // Phase routing
  if (room.status === "playing" && room.currentPhase && room.gameType) {
    const components = gameComponents[room.gameType];
    const basePhase = room.currentPhase.split("_")[0];
    const PhaseComponent = components?.player[basePhase];

    if (PhaseComponent) {
      return (
        <AnimatePresence mode="wait">
          <motion.div
            key={room.currentPhase + "-" + room.roundNumber}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense
              fallback={
                <div className="flex min-h-screen items-center justify-center text-[var(--color-text-muted)] animate-gentle-pulse">
                  Indlæser...
                </div>
              }
            >
              <PhaseComponent room={room} sessionId={sessionId} />
            </Suspense>
          </motion.div>
        </AnimatePresence>
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
          {room.players.length} {da.playersJoined}
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
      <PlayerViewInner />
    </PartyProvider>
  );
}

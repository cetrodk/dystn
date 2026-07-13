import { useEffect } from "react";
import { motion } from "framer-motion";
import { CountdownTimer } from "@dystn/ui/CountdownTimer";
import { sfxScore } from "@/lib/sounds";
import { GameAvatar } from "@/components/GameAvatar";
import { useSend } from "@/providers/PartyProvider";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

export default function HostScores({ room, sessionId }: PhaseComponentProps) {
  const send = useSend();
  const players = [...(room.players ?? [])].sort(
    (a, b) => b.score - a.score,
  );

  const isLastRound = (room.roundNumber ?? 1) >= (room.totalRounds ?? 1);

  useEffect(() => {
    const ids = players.map((_, i) =>
      window.setTimeout(sfxScore, Math.min(i * 150, 1200) + 100),
    );
    return () => ids.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-10">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-5xl font-bold"
      >
        {da.scores}
      </motion.h2>
      <p className="text-base text-[var(--color-text-muted)]">
        {da.round} {room.roundNumber} {da.of} {room.totalRounds}
      </p>

      <div className="w-full max-w-3xl flex flex-col gap-4">
        {players.map((player, i) => (
          <motion.div
            key={player._id}
            layout
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.15, 1.2), type: "spring", stiffness: 200 }}
            className={`flex items-center gap-5 rounded-2xl p-5 ${
              i === 0
                ? "bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]/30"
                : "bg-[var(--color-surface)]"
            }`}
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: Math.min(i * 0.15, 1.2) + 0.1, type: "spring" }}
              className={`font-display text-3xl font-bold w-10 ${
                i === 0 ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
              }`}
            >
              {i + 1}
            </motion.span>
            <GameAvatar
              name={player.name}
              avatarColor={player.avatarColor}
              avatar={player.avatar}
              className="h-14 w-14"
            />
            <span className="flex-1 text-xl font-semibold">{player.name}</span>
            <motion.span
              key={player.score}
              initial={{ scale: 1.4, color: "#b9a4ff" }}
              animate={{ scale: 1, color: "var(--color-primary)" }}
              transition={{ duration: 0.4 }}
              className="font-display text-3xl font-bold"
            >
              {player.score}
            </motion.span>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: Math.min(players.length * 0.15, 1.2) + 0.3 }}
        className="flex items-center gap-4"
      >
        <button
          onClick={() => send({ type: "hostAdvance", hostId: sessionId })}
          className="rounded-2xl bg-[var(--color-primary)] px-12 py-5 text-2xl font-bold transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        >
          {isLastRound ? da.gameOver : da.nextRound}
        </button>
        <span className="text-base text-[var(--color-text-muted)]">
          <CountdownTimer deadline={room.phaseDeadline ?? null} />s
        </span>
      </motion.div>
    </div>
  );
}

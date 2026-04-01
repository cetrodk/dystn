import { useEffect } from "react";
import { motion } from "framer-motion";
import { sfxFanfare } from "@/lib/sounds";
import { GameAvatar } from "@/components/GameAvatar";
import { ConfettiBackground } from "@/components/ConfettiBackground";
import { da } from "@/lib/da";
import { Racetrack } from "./Racetrack";
import type { PhaseComponentProps } from "../registry";

export default function HostVictory({ room }: PhaseComponentProps) {
  const pd = room.phaseData ?? {};
  const winners = (pd.winners ?? []) as string[];
  const trackPositions = (pd.trackPositions ?? {}) as Record<string, number>;
  const players = room.players ?? [];

  const winnerPlayers = players.filter((p) => winners.includes(p._id));
  const isSharedWin = winnerPlayers.length > 1;

  useEffect(() => {
    sfxFanfare();
  }, []);

  return (
    <div className="flex flex-1 min-h-0 w-full flex-col items-center gap-6">
      <ConfettiBackground />

      {/* Trophy with gentle float */}
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{
          scale: 1,
          rotate: 0,
          y: [0, -6, 0],
        }}
        transition={{
          scale: { type: "spring", stiffness: 200, damping: 15 },
          rotate: { type: "spring", stiffness: 200, damping: 15 },
          y: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 },
        }}
        className="text-8xl"
      >
        🏆
      </motion.div>

      {/* Winner announcement */}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="font-display text-6xl font-bold text-[var(--color-sandhed)]"
        style={{
          textShadow: "0 0 30px var(--color-sandhed-glow)",
        }}
      >
        {isSharedWin ? da.sandhed.sharedWin : da.sandhed.winner}
      </motion.h2>

      {/* Winner avatars */}
      <div className="flex gap-8">
        {winnerPlayers.map((p, i) => (
          <motion.div
            key={p._id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.2, type: "spring" }}
            className="flex flex-col items-center gap-3"
          >
            <GameAvatar
              name={p.name}
              avatarColor={p.avatarColor}
              avatarImage={p.avatarImage}
              className="h-28 w-28"
            />
            <span className="font-display text-3xl font-bold">{p.name}</span>
          </motion.div>
        ))}
      </div>

      {/* Final racetrack */}
      <Racetrack
        players={players}
        trackPositions={trackPositions}
        animationDelay={0.8}
        winners={winners}
      />
    </div>
  );
}

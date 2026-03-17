import { motion } from "framer-motion";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

export default function PlayerVictory({ room }: PhaseComponentProps) {
  const pd = room.phaseData ?? {};
  const winners = (pd.winners ?? []) as string[];
  const isWinner = room.currentPlayerId && winners.includes(room.currentPlayerId);
  const trackPositions = (pd.trackPositions ?? {}) as Record<string, number>;
  const myPosition = room.currentPlayerId ? (trackPositions[room.currentPlayerId] ?? 0) : 0;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        className="text-7xl"
      >
        {isWinner ? "🏆" : "👏"}
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="font-display text-3xl font-bold text-[var(--color-sandhed)]"
      >
        {isWinner ? da.sandhed.winner : `${da.sandhed.position} ${myPosition} / 8`}
      </motion.p>

      <p className="text-[var(--color-text-muted)]">{da.lookAtScreen}</p>
    </div>
  );
}

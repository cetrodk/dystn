import { motion } from "framer-motion";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

export default function PlayerReveal({ room }: PhaseComponentProps) {
  const currentPlayer = room.players?.find(
    (p: any) => p._id === room.currentPlayerId,
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="text-6xl"
      >
        👀
      </motion.div>
      <p className="font-display text-2xl font-bold">{da.lookAtScreen}</p>
      {currentPlayer ? (
        <motion.p
          key={currentPlayer.score}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          className="font-display text-4xl font-bold text-[var(--color-primary)]"
        >
          {currentPlayer.score} point
        </motion.p>
      ) : null}
    </div>
  );
}

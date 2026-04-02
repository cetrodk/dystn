import { motion } from "framer-motion";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

export default function PlayerReveal({ room }: PhaseComponentProps) {
  const phaseData = room.phaseData ?? {};
  const myResult = phaseData.myResult as {
    guess: number | null;
    distance: number | null;
    score: number;
  } | null;

  const currentPlayer = room.players?.find((p) => p._id === room.currentPlayerId);

  const distanceLabel =
    myResult?.distance === 0
      ? da.ordklap.exact
      : myResult?.distance === 1
        ? da.ordklap.close
        : myResult?.distance === 2
          ? da.ordklap.near
          : da.ordklap.miss;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      {myResult ? (
        <>
          <motion.p
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="font-display text-3xl font-bold"
          >
            {distanceLabel}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-display text-5xl font-bold text-[var(--color-ordklap)]"
          >
            +{myResult.score}
          </motion.p>
          {myResult.guess != null && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-lg text-[var(--color-text-muted)]"
            >
              Du gættede {myResult.guess}
            </motion.p>
          )}
        </>
      ) : (
        <>
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="text-6xl"
          >
            👀
          </motion.div>
          <p className="font-display text-2xl font-bold">{da.lookAtScreen}</p>
        </>
      )}

      {currentPlayer && (
        <motion.p
          key={currentPlayer.score}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          className="font-display text-4xl font-bold text-[var(--color-ordklap)]"
        >
          {currentPlayer.score} point
        </motion.p>
      )}
    </div>
  );
}

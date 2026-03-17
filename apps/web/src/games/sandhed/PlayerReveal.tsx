import { motion } from "framer-motion";
import { Check, X, HelpCircle } from "lucide-react";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

interface ResultEntry {
  playerId: string;
  choice: string | null;
  correct: boolean;
  noAnswer: boolean;
  delta: number;
  newPosition: number;
}

export default function PlayerReveal({ room }: PhaseComponentProps) {
  const pd = room.phaseData ?? {};
  const results = (pd.results ?? []) as ResultEntry[];
  const myResult = results.find((r) => r.playerId === room.currentPlayerId);

  if (!myResult) {
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
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      {/* Result icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
      >
        {myResult.noAnswer ? (
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ repeat: 3, duration: 0.4 }}
          >
            <HelpCircle className="h-20 w-20 text-[var(--color-text-muted)]" />
          </motion.div>
        ) : myResult.correct ? (
          <Check className="h-20 w-20 text-emerald-400" />
        ) : (
          <X className="h-20 w-20 text-red-400" />
        )}
      </motion.div>

      {/* Result text */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`font-display text-3xl font-bold ${
          myResult.noAnswer
            ? "text-[var(--color-text-muted)]"
            : myResult.correct
              ? "text-emerald-400"
              : "text-red-400"
        }`}
      >
        {myResult.noAnswer
          ? da.sandhed.noAnswer
          : myResult.correct
            ? da.sandhed.correct
            : da.sandhed.wrong}
      </motion.p>

      {/* Delta */}
      <motion.p
        initial={{ scale: 1.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring" }}
        className={`font-display text-5xl font-bold ${
          myResult.delta > 0
            ? "text-emerald-400"
            : myResult.delta < 0
              ? "text-red-400"
              : "text-[var(--color-text-muted)]"
        }`}
      >
        {myResult.delta > 0 ? `+${myResult.delta}` : myResult.delta}
      </motion.p>

      {/* New position */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-lg text-[var(--color-text-muted)]"
      >
        {da.sandhed.position} {myResult.newPosition} / 8
      </motion.p>
    </div>
  );
}

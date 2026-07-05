import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { sfxTick, sfxUrgent } from "@/lib/sounds";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

export default function HostDraw({ room }: PhaseComponentProps) {
  const submittedCount = room.players?.filter((p: any) => p.hasSubmitted).length ?? 0;
  const totalPlayers = room.players?.length ?? 0;
  const phaseData = room.phaseData ?? {};
  const step = (phaseData.stepIndex ?? 0) + 1;
  const totalSteps = phaseData.totalSteps ?? 1;

  const handleTick = useCallback((s: number) => {
    if (s <= 5 && s > 0) sfxUrgent();
    else if (s <= 10 && s > 5) sfxTick();
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 sm:gap-10">
      <div className="text-sm uppercase tracking-widest text-[var(--color-text-muted)]">
        Runde {step} {da.of} {totalSteps}
      </div>

      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-3xl sm:text-6xl font-bold"
      >
        {da.morph.everyoneIsDrawing}
      </motion.h2>

      <div className="text-5xl sm:text-8xl font-mono font-bold text-[var(--color-primary)] glow-text">
        <CountdownTimer
          deadline={room.phaseDeadline ?? null}
          onTick={handleTick}
        />
      </div>

      <div className="text-2xl text-[var(--color-text-muted)]">
        {submittedCount}/{totalPlayers} har tegnet
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <AnimatePresence>
          {room.players?.map((p: any) => (
            <motion.div
              key={p._id}
              layout
              animate={{
                backgroundColor: p.hasSubmitted
                  ? p.avatarColor
                  : "var(--color-surface)",
                opacity: p.hasSubmitted ? 1 : 0.4,
                scale: p.hasSubmitted ? [1, 1.15, 1] : 1,
              }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 rounded-full px-4 py-2"
            >
              <span className="text-base font-semibold text-white">{p.name}</span>
              {p.hasSubmitted ? (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-sm"
                >
                  ✓
                </motion.span>
              ) : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

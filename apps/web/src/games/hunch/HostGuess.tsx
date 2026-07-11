import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CountdownTimer } from "@dystn/ui/CountdownTimer";
import { sfxTick, sfxUrgent } from "@/lib/sounds";
import { da } from "@/lib/da";
import { SpectrumBar } from "./SpectrumBar";
import type { PhaseComponentProps } from "../registry";

export default function HostGuess({ room }: PhaseComponentProps) {
  const phaseData = room.phaseData ?? {};
  const clue = phaseData.clue as string | undefined;
  const clueGiverId = phaseData.clueGiverId as string | undefined;
  const submittedCount = (phaseData.submittedCount as number) ?? 0;
  const totalGuessers = (phaseData.totalGuessers as number) ?? (room.players?.length ?? 0) - 1;

  const handleTick = useCallback((s: number) => {
    if (s <= 5 && s > 0) sfxUrgent();
    else if (s <= 10 && s > 5) sfxTick();
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 sm:gap-10">
      <div className="text-base uppercase tracking-widest text-[var(--color-text-muted)]">
        {da.hunch.clueIs}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        className="rounded-2xl bg-[var(--color-hunch)]/15 ring-2 ring-[var(--color-hunch)] px-12 py-6"
      >
        <p className="font-display text-5xl font-bold">{clue ?? "..."}</p>
      </motion.div>

      <SpectrumBar
        leftLabel={String(phaseData.leftLabel ?? "")}
        rightLabel={String(phaseData.rightLabel ?? "")}
      />

      <div className="flex items-center gap-8">
        <div className="text-5xl sm:text-8xl font-mono font-bold text-[var(--color-hunch)] glow-text">
          <CountdownTimer deadline={room.phaseDeadline ?? null} onTick={handleTick} />
        </div>
        <div className="text-lg text-[var(--color-text-muted)]">
          {submittedCount}/{totalGuessers} har gættet
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <AnimatePresence>
          {room.players?.map((p) => {
            const isClueGiver = p._id === clueGiverId;
            return (
              <motion.div
                key={p._id}
                layout
                animate={{
                  backgroundColor: isClueGiver
                    ? "var(--color-hunch)"
                    : p.hasSubmitted
                      ? p.avatarColor
                      : "var(--color-surface)",
                  opacity: isClueGiver || p.hasSubmitted ? 1 : 0.4,
                  color: isClueGiver || p.hasSubmitted ? "#fff" : "var(--color-text)",
                  scale: p.hasSubmitted && !isClueGiver ? [1, 1.15, 1] : 1,
                }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2 rounded-full px-4 py-2"
              >
                <span className="text-base font-semibold">{p.name}</span>
                {isClueGiver ? (
                  <span className="text-sm">✎</span>
                ) : p.hasSubmitted ? (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-sm">✓</motion.span>
                ) : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

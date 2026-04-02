import { useCallback } from "react";
import { motion } from "framer-motion";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { sfxTick, sfxUrgent } from "@/lib/sounds";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

export default function HostVote({ room }: PhaseComponentProps) {
  const phaseData = room.phaseData ?? {};
  const answers = phaseData.answers ?? [];
  const promptText = phaseData.promptText ?? "";
  const submittedCount = room.players?.filter((p: any) => p.hasSubmitted).length ?? 0;
  const totalPlayers = room.players?.length ?? 0;

  const handleTick = useCallback((s: number) => {
    if (s <= 5 && s > 0) sfxUrgent();
    else if (s <= 10 && s > 5) sfxTick();
  }, []);

  return (
    <div className="flex flex-col items-center gap-10">
      <div className="text-base uppercase tracking-widest text-[var(--color-text-muted)]">
        {da.blitz.voteForBest}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl text-center font-display text-5xl font-bold text-[var(--color-text-muted)]"
      >
        {promptText}
      </motion.div>

      <div className="flex items-center gap-8">
        <div className="text-8xl font-mono font-bold text-[var(--color-primary)] glow-text">
          <CountdownTimer
            deadline={room.phaseDeadline ?? null}
            onTick={handleTick}
          />
        </div>
        <div className="text-lg text-[var(--color-text-muted)]">
          {submittedCount}/{totalPlayers} har stemt
        </div>
      </div>

      <div className="grid w-full max-w-5xl grid-cols-2 gap-6">
        {answers.map((answer: any, i: number) => (
          <motion.div
            key={answer.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
            className="card-glow rounded-2xl bg-[var(--color-surface)] p-8 text-center text-2xl font-semibold"
          >
            {answer.text}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

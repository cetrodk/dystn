import { useCallback } from "react";
import { motion } from "framer-motion";
import { CountdownTimer } from "@dystn/ui/CountdownTimer";
import { sfxTick, sfxUrgent } from "@/lib/sounds";
import { da } from "@/lib/da";
import { DrawingDisplay } from "./DrawingDisplay";
import type { PhaseComponentProps } from "../registry";

export default function HostVote({ room }: PhaseComponentProps) {
  const phaseData = room.phaseData ?? {};
  // Server strips raw `answers` for the host; use the anonymized {id, text} list.
  const answers = phaseData.answersAnonymized ?? phaseData.answers ?? [];
  const drawingData = phaseData.drawingData ?? [];
  const drawingIndex = (phaseData.drawingIndex ?? 0) + 1;
  const totalDrawings = phaseData.totalDrawings ?? 1;
  const submittedCount = room.players?.filter((p: any) => p.hasSubmitted).length ?? 0;
  // The artist can't vote, so the denominator is everyone else.
  const totalPlayers = Math.max((room.players?.length ?? 1) - 1, 0);

  const handleTick = useCallback((s: number) => {
    if (s <= 5 && s > 0) sfxUrgent();
    else if (s <= 10 && s > 5) sfxTick();
  }, []);

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col lg:flex-row gap-8">
      {/* Left: drawing takes ~60% */}
      <div className="flex-[3] flex flex-col min-h-0 min-w-0">
        <div className="text-sm uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
          {da.scrawl.drawing} {drawingIndex} {da.of} {totalDrawings}
        </div>
        <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center">
          <DrawingDisplay data={drawingData} aspect={null} className="h-full w-full" />
        </div>
      </div>

      {/* Right: answers + timer — min-w-0 så timeren aldrig presses ud af kanten */}
      <div className="flex-[2] flex flex-col items-center justify-center gap-6 min-h-0 min-w-0">
        <div className="flex shrink-0 items-center gap-4">
          <div className="text-5xl sm:text-8xl font-mono font-bold text-[var(--color-primary)] glow-text">
            <CountdownTimer
              deadline={room.phaseDeadline ?? null}
              onTick={handleTick}
            />
          </div>
          <div className="text-base text-[var(--color-text-muted)]">
            {submittedCount}/{totalPlayers}
          </div>
        </div>

        <div className="w-full flex flex-col gap-4">
          {answers.map((answer: any, i: number) => (
            <motion.div
              key={answer.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
              className="card-glow rounded-2xl bg-[var(--color-surface)] p-4 sm:p-6 text-center text-2xl font-semibold"
            >
              {answer.text}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

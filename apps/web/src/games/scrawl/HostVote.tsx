import { useCallback } from "react";
import { motion } from "framer-motion";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { sfxTick, sfxUrgent } from "@/lib/sounds";
import { da } from "@/lib/da";
import { DrawingDisplay } from "./DrawingDisplay";
import type { PhaseComponentProps } from "../registry";

export default function HostVote({ room }: PhaseComponentProps) {
  const phaseData = room.phaseData ?? {};
  const answers = phaseData.answers ?? [];
  const drawingData = phaseData.drawingData ?? [];
  const drawingIndex = (phaseData.drawingIndex ?? 0) + 1;
  const totalDrawings = phaseData.totalDrawings ?? 1;
  const submittedCount = room.players?.filter((p: any) => p.hasSubmitted).length ?? 0;
  const totalPlayers = room.players?.length ?? 0;

  const handleTick = useCallback((s: number) => {
    if (s <= 5 && s > 0) sfxUrgent();
    else if (s <= 10 && s > 5) sfxTick();
  }, []);

  return (
    <div className="fixed inset-0 flex p-6 pt-14 gap-8 overflow-hidden">
      {/* Left: drawing takes ~60% */}
      <div className="flex-[3] flex flex-col min-h-0 min-w-0">
        <div className="text-sm uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
          {da.scrawl.drawing} {drawingIndex} {da.of} {totalDrawings}
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <DrawingDisplay data={drawingData} className="max-h-full max-w-full w-auto h-full" />
        </div>
      </div>

      {/* Right: answers + timer */}
      <div className="flex-[2] flex flex-col items-center justify-center gap-6">
        <div className="flex items-center gap-4">
          <div className="text-8xl font-mono font-bold text-[var(--color-primary)] glow-text">
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
              className="card-glow rounded-2xl bg-[var(--color-surface)] p-6 text-center text-2xl font-semibold"
            >
              {answer.text}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

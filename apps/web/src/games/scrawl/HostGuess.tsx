import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CountdownTimer } from "@dystn/ui/CountdownTimer";
import { sfxTick, sfxUrgent } from "@/lib/sounds";
import { da } from "@/lib/da";
import { PlayerPill } from "@/components/PlayerPill";
import { DrawingDisplay } from "./DrawingDisplay";
import type { PhaseComponentProps } from "../registry";

export default function HostGuess({ room }: PhaseComponentProps) {
  const phaseData = room.phaseData ?? {};
  const drawingData = phaseData.drawingData ?? [];
  const drawingIndex = (phaseData.drawingIndex ?? 0) + 1;
  const totalDrawings = phaseData.totalDrawings ?? 1;
  const submittedCount = room.players?.filter((p: any) => p.hasSubmitted).length ?? 0;
  const totalGuessers = (room.players?.length ?? 1) - 1;

  const handleTick = useCallback((s: number) => {
    if (s <= 5 && s > 0) sfxUrgent();
    else if (s <= 10 && s > 5) sfxTick();
  }, []);

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col items-center">
      {/* Top bar — timeren må aldrig krympe; overskriften må gerne wrappe */}
      <div className="flex w-full items-center justify-between gap-4 mb-4">
        <div className="shrink-0 text-sm uppercase tracking-widest text-[var(--color-text-muted)]">
          {da.scrawl.drawing} {drawingIndex} {da.of} {totalDrawings}
        </div>
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="min-w-0 flex-1 text-center font-display text-3xl font-bold text-[var(--color-text)]"
        >
          {da.scrawl.whatIsBeingDrawn}
        </motion.h2>
        <div className="flex shrink-0 items-center gap-4">
          <div className="text-5xl sm:text-8xl font-mono font-bold text-[var(--color-primary)] glow-text">
            <CountdownTimer
              deadline={room.phaseDeadline ?? null}
              onTick={handleTick}
            />
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            {submittedCount}/{totalGuessers}
          </div>
        </div>
      </div>

      {/* Drawing — fills remaining space */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        className="flex-1 w-full min-h-0 min-w-0 flex items-center justify-center"
      >
        <DrawingDisplay data={drawingData} aspect={null} className="h-full w-full" />
      </motion.div>

      {/* Player pills at bottom */}
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        <AnimatePresence>
          {room.players?.map((p: any) => (
            <PlayerPill
              key={p._id}
              player={p}
              isArtist={p._id === phaseData.currentArtistId}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

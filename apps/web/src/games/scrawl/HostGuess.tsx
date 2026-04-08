import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { sfxTick, sfxUrgent } from "@/lib/sounds";
import { da } from "@/lib/da";
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
    <div className="fixed inset-0 flex flex-col items-center p-4 sm:p-6 pt-14 overflow-hidden">
      {/* Top bar */}
      <div className="flex w-full items-center justify-between mb-4">
        <div className="text-sm uppercase tracking-widest text-[var(--color-text-muted)]">
          {da.scrawl.drawing} {drawingIndex} {da.of} {totalDrawings}
        </div>
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-display text-3xl font-bold text-[var(--color-text)]"
        >
          {da.scrawl.whatIsBeingDrawn}
        </motion.h2>
        <div className="flex items-center gap-4">
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
        className="flex-1 w-full min-h-0 flex items-center justify-center"
      >
        <DrawingDisplay data={drawingData} className="max-h-full max-w-full w-auto h-full" />
      </motion.div>

      {/* Player pills at bottom */}
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        <AnimatePresence>
          {room.players?.map((p: any) => {
            const isArtist = p._id === phaseData.currentArtistId;
            return (
              <motion.div
                key={p._id}
                layout
                animate={{
                  backgroundColor: isArtist
                    ? p.avatarColor
                    : p.hasSubmitted
                      ? p.avatarColor
                      : "var(--color-surface)",
                  opacity: isArtist ? 0.6 : p.hasSubmitted ? 1 : 0.4,
                  scale: !isArtist && p.hasSubmitted ? [1, 1.15, 1] : 1,
                }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2 rounded-full px-4 py-2"
              >
                <span className="text-base font-semibold text-white">{p.name}</span>
                {isArtist ? (
                  <span className="text-sm">✏️</span>
                ) : p.hasSubmitted ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-sm"
                  >
                    ✓
                  </motion.span>
                ) : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

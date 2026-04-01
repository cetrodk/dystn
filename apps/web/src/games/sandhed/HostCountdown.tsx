import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { sfxTick, sfxReveal } from "@/lib/sounds";
import { da } from "@/lib/da";
import { Racetrack } from "./Racetrack";
import type { PhaseComponentProps } from "../registry";

export default function HostCountdown({ room }: PhaseComponentProps) {
  const players = room.players ?? [];
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count <= 0) return;
    const id = window.setTimeout(() => setCount((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [count]);

  // Play sounds on countdown
  useEffect(() => {
    if (count > 0) sfxTick();
    if (count === 0) sfxReveal();
  }, [count]);

  const trackPositions: Record<string, number> = {};
  for (const p of players) trackPositions[p._id] = 0;

  return (
    <div className="relative flex flex-1 min-h-0 w-full flex-col items-center gap-8">
      {/* Subtle radial pulse synced to countdown */}
      <motion.div
        key={`pulse-${count}`}
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0.15 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        style={{
          background: "radial-gradient(circle at 50% 30%, var(--color-sandhed-glow) 0%, transparent 60%)",
        }}
      />

      {/* Countdown number */}
      <AnimatePresence mode="wait">
        <motion.div
          key={count}
          initial={{ scale: 2.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.3, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="font-display text-9xl font-bold text-[var(--color-sandhed)]"
          style={{
            textShadow: "0 0 40px var(--color-sandhed), 0 0 80px color-mix(in srgb, var(--color-sandhed) 30%, transparent)",
          }}
        >
          {count > 0 ? count : "KØR!"}
        </motion.div>
      </AnimatePresence>

      {/* Racetrack with all at start */}
      <Racetrack players={players} trackPositions={trackPositions} />

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-3xl font-display text-[var(--color-text-muted)]"
      >
        {da.sandhed.getReady}
      </motion.p>
    </div>
  );
}

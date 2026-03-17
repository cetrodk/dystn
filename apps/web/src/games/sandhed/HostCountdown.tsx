import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { GameAvatar } from "@/components/GameAvatar";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

export default function HostCountdown({ room }: PhaseComponentProps) {
  const players = room.players ?? [];
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count <= 0) return;
    const id = window.setTimeout(() => setCount((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [count]);

  return (
    <div className="flex flex-col items-center gap-12">
      {/* Countdown number */}
      <motion.div
        key={count}
        initial={{ scale: 2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="font-display text-9xl font-bold text-[var(--color-sandhed)]"
      >
        {count > 0 ? count : "KØR!"}
      </motion.div>

      {/* Racetrack preview */}
      <div className="w-full max-w-4xl">
        <div className="relative h-20 rounded-2xl bg-[var(--color-surface)] overflow-hidden">
          {/* Finish line */}
          <div className="absolute right-4 top-0 bottom-0 w-1 bg-[var(--color-text-muted)] opacity-40" />
          <span className="absolute right-2 top-1 text-xs text-[var(--color-text-muted)]">
            {da.sandhed.finish}
          </span>

          {/* Player avatars at start */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex gap-2">
            {players.map((p, i) => (
              <motion.div
                key={p._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.1 }}
              >
                <GameAvatar
                  name={p.name}
                  avatarColor={p.avatarColor}
                  avatarImage={p.avatarImage}
                  className="h-10 w-10"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-2xl text-[var(--color-text-muted)]">
        {da.sandhed.getReady}
      </p>
    </div>
  );
}

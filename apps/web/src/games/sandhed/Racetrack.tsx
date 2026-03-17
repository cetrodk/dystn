import { memo } from "react";
import { motion } from "framer-motion";
import { GameAvatar } from "@/components/GameAvatar";

export const FINISH_LINE = 8;

interface RacetrackPlayer {
  _id: string;
  name: string;
  avatarColor: string;
  avatarImage?: string;
}

interface RacetrackProps {
  players: RacetrackPlayer[];
  trackPositions: Record<string, number>;
  animationDelay?: number;
  winners?: string[];
}

export const Racetrack = memo(function Racetrack({
  players,
  trackPositions,
  animationDelay = 0,
  winners,
}: RacetrackProps) {
  return (
    <div className="w-full max-w-5xl">
      <div
        className="relative rounded-2xl bg-[var(--color-surface)] p-4 overflow-hidden"
        style={{ minHeight: 60 + players.length * 36 }}
      >
        {/* Track grid lines */}
        {Array.from({ length: FINISH_LINE + 1 }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-[var(--color-text-muted)] opacity-15"
            style={{ left: `${(i / FINISH_LINE) * 100}%` }}
          />
        ))}

        {/* Finish line */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-[var(--color-sandhed)]"
          style={{ left: "100%" }}
        />

        {/* Player lanes */}
        {players.map((player, i) => {
          const pos = trackPositions[player._id] ?? 0;
          const pct = (pos / FINISH_LINE) * 95;
          const isWinner = winners?.includes(player._id);

          return (
            <div
              key={player._id}
              className="relative flex items-center"
              style={{ height: 36, marginTop: i === 0 ? 0 : 4 }}
            >
              <motion.div
                animate={{ left: `${pct}%` }}
                transition={{
                  type: "spring",
                  stiffness: 150,
                  damping: 20,
                  delay: animationDelay + i * 0.1,
                }}
                className="absolute flex items-center gap-1"
              >
                <GameAvatar
                  name={player.name}
                  avatarColor={player.avatarColor}
                  avatarImage={player.avatarImage}
                  className={isWinner ? "h-9 w-9" : "h-7 w-7"}
                />
                <span
                  className={`text-xs font-semibold ${
                    isWinner
                      ? "text-[var(--color-sandhed)]"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {player.name} ({pos})
                </span>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

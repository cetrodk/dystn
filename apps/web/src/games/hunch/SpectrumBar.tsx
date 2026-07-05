import { motion } from "framer-motion";
import { GameAvatar } from "@/components/GameAvatar";

interface GuessMarker {
  position: number;
  playerName: string;
  avatarColor: string;
  avatarImage?: string;
  score?: number;
}

interface SpectrumBarProps {
  leftLabel: string;
  rightLabel: string;
  target?: number;
  showTarget?: boolean;
  guesses?: GuessMarker[];
  activePosition?: number;
  className?: string;
}

export function SpectrumBar({
  leftLabel,
  rightLabel,
  target,
  showTarget = false,
  guesses,
  activePosition,
  className = "",
}: SpectrumBarProps) {
  return (
    <div className={`w-full max-w-3xl ${className}`}>
      {/* Labels */}
      <div className="flex justify-between mb-3">
        <span className="text-sm font-semibold text-[var(--color-text-muted)]">{leftLabel}</span>
        <span className="text-sm font-semibold text-[var(--color-text-muted)]">{rightLabel}</span>
      </div>

      {/* Track */}
      <div className="relative">
        {/* Background bar */}
        <div className="h-12 rounded-2xl bg-gradient-to-r from-[var(--color-surface)] via-[var(--color-surface-light)] to-[var(--color-surface)] ring-1 ring-white/10" />

        {/* Position ticks */}
        <div className="absolute inset-0 flex items-center justify-between px-4">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className={`w-0.5 h-3 rounded-full ${
                activePosition === i + 1
                  ? "bg-[var(--color-hunch)]"
                  : "bg-white/20"
              }`} />
              <span className="text-[10px] text-[var(--color-text-muted)]/60">{i + 1}</span>
            </div>
          ))}
        </div>

        {/* Target marker */}
        {showTarget && target != null && (
          <motion.div
            // Centering must live in motion's own x/y — a raw transform in
            // `style` is clobbered by the animated transform.
            initial={{ scale: 0, x: "-50%", y: "calc(-50% - 20px)" }}
            animate={{ scale: 1, x: "-50%", y: "-50%" }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="absolute top-1/2"
            style={{ left: `${((target - 1) / 9) * 100}%` }}
          >
            <div className="w-10 h-10 rounded-full bg-[var(--color-hunch)] ring-4 ring-[var(--color-hunch)]/30 flex items-center justify-center shadow-lg shadow-[var(--color-hunch)]/20">
              <span className="text-sm font-bold text-[#0d0b1a]">{target}</span>
            </div>
          </motion.div>
        )}

        {/* Active position indicator (for player input) */}
        {activePosition != null && !showTarget && (
          <motion.div
            className="absolute top-1/2"
            initial={false}
            animate={{ left: `${((activePosition - 1) / 9) * 100}%`, x: "-50%", y: "-50%" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/40 flex items-center justify-center">
              <span className="text-xs font-bold">{activePosition}</span>
            </div>
          </motion.div>
        )}

        {/* Guess markers */}
        {guesses?.map((g, i) => (
          <motion.div
            key={g.playerName}
            initial={{ scale: 0, x: "-50%", y: 20 }}
            animate={{ scale: 1, x: "-50%", y: 0 }}
            transition={{ delay: i * 0.15 + 0.3, type: "spring", stiffness: 200 }}
            className="absolute"
            style={{
              left: `${((g.position - 1) / 9) * 100}%`,
              top: -36 - (i % 2) * 28,
            }}
          >
            <div className="flex flex-col items-center gap-0.5">
              <GameAvatar name={g.playerName} avatarColor={g.avatarColor} avatarImage={g.avatarImage} className="h-7 w-7" />
              {g.score != null && (
                <span className={`text-xs font-bold ${g.score > 0 ? "text-[var(--color-hunch)]" : "text-[var(--color-text-muted)]"}`}>
                  +{g.score}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

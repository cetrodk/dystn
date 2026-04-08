import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { sfxTick, sfxUrgent } from "@/lib/sounds";
import { GameAvatar } from "@/components/GameAvatar";
import { da } from "@/lib/da";
import { SpectrumBar } from "./SpectrumBar";
import type { PhaseComponentProps } from "../registry";

export default function HostClue({ room }: PhaseComponentProps) {
  const phaseData = room.phaseData ?? {};
  const clueGiverId = phaseData.clueGiverId as string | undefined;
  const submittedCount = (phaseData.submittedCount as number) ?? 0;

  const handleTick = useCallback((s: number) => {
    if (s <= 5 && s > 0) sfxUrgent();
    else if (s <= 10 && s > 5) sfxTick();
  }, []);

  const clueGiver = room.players?.find((p) => p._id === clueGiverId);

  return (
    <div className="flex flex-col items-center gap-6 sm:gap-10">
      <div className="text-base uppercase tracking-widest text-[var(--color-text-muted)]">
        {da.round} {room.roundNumber} {da.of} {room.totalRounds}
      </div>

      <SpectrumBar
        leftLabel={String(phaseData.leftLabel ?? "")}
        rightLabel={String(phaseData.rightLabel ?? "")}
      />

      <div className="text-5xl sm:text-8xl font-mono font-bold text-[var(--color-hunch)] glow-text">
        <CountdownTimer deadline={room.phaseDeadline ?? null} onTick={handleTick} />
      </div>

      <div className="flex flex-col items-center gap-3">
        {clueGiver && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-2xl bg-[var(--color-hunch)]/10 ring-1 ring-[var(--color-hunch)]/30 px-6 py-3"
          >
            <GameAvatar name={clueGiver.name} avatarColor={clueGiver.avatarColor} avatarImage={clueGiver.avatarImage} className="h-12 w-12" />
            <div>
              <p className="text-lg font-bold" style={{ color: "var(--color-hunch)" }}>{clueGiver.name}</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {submittedCount > 0 ? "har givet et fingerpeg!" : "skriver et fingerpeg..."}
              </p>
            </div>
          </motion.div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <AnimatePresence>
          {room.players?.map((p) => (
            <motion.div
              key={p._id}
              layout
              animate={{
                backgroundColor: p._id === clueGiverId ? "var(--color-hunch)" : "var(--color-surface)",
                opacity: p._id === clueGiverId ? 1 : 0.4,
              }}
              className="flex items-center gap-2 rounded-full px-4 py-2"
            >
              <span className="text-base font-semibold text-white">{p.name}</span>
              {p._id === clueGiverId && (
                <span className="text-sm">
                  {submittedCount > 0 ? "✓" : "✎"}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

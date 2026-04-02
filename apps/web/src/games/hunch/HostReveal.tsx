import { motion, AnimatePresence } from "framer-motion";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { sfxFanfare, sfxScore } from "@/lib/sounds";
import { GameAvatar } from "@/components/GameAvatar";
import { useSend } from "@/providers/PartyProvider";
import { da } from "@/lib/da";
import { SpectrumBar } from "./SpectrumBar";
import { useStaggeredReveal } from "@/hooks/useStaggeredReveal";
import type { PhaseComponentProps } from "../registry";

export default function HostReveal({ room, sessionId }: PhaseComponentProps) {
  const send = useSend();
  const phaseData = room.phaseData ?? {};
  const target = phaseData.target as number | undefined;
  const clue = phaseData.clue as string | undefined;
  const clueGiverBonus = (phaseData.clueGiverBonus as number) ?? 0;
  const clueGiverName = phaseData.clueGiverName as string | undefined;
  const results = (phaseData.results ?? []) as Array<{
    playerId: string;
    playerName: string;
    avatarColor: string;
    avatarImage?: string;
    guess: number | null;
    distance: number | null;
    score: number;
  }>;
  const isLastRound = (room.roundNumber ?? 1) >= (room.totalRounds ?? 1);

  const sorted = [...results].sort((a, b) => b.score - a.score);

  const { stage, visibleItems } = useStaggeredReveal({
    itemCount: sorted.length,
    onItemReveal: () => sfxScore(),
    onFinalReveal: () => sfxFanfare(),
  });

  const showTarget = stage !== "intro";
  const guessMarkers = sorted
    .slice(0, visibleItems)
    .filter((r) => r.guess != null)
    .map((r) => ({
      position: r.guess!,
      playerName: r.playerName,
      avatarColor: r.avatarColor,
      avatarImage: r.avatarImage,
      score: r.score,
    }));

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Clue reminder */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl bg-[var(--color-hunch)]/10 px-6 py-2"
      >
        <span className="text-sm text-[var(--color-text-muted)]">{da.hunch.clueIs}: </span>
        <span className="font-display text-xl font-bold">{clue}</span>
      </motion.div>

      {/* Spectrum with target + guesses */}
      <SpectrumBar
        leftLabel={String(phaseData.leftLabel ?? "")}
        rightLabel={String(phaseData.rightLabel ?? "")}
        target={target}
        showTarget={showTarget}
        guesses={guessMarkers}
      />

      {/* Target label */}
      <AnimatePresence>
        {showTarget && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg text-[var(--color-hunch)] font-bold"
          >
            {da.hunch.targetWas} {target}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Results list */}
      <div className="flex w-full max-w-3xl flex-col gap-3">
        <AnimatePresence>
          {sorted.slice(0, visibleItems).map((result) => (
            <motion.div
              key={result.playerId}
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
              className="flex items-center gap-4 rounded-2xl bg-[var(--color-surface)] p-5"
            >
              <GameAvatar
                name={result.playerName}
                avatarColor={result.avatarColor}
                avatarImage={result.avatarImage}
                className="h-12 w-12"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold">{result.playerName}</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {result.guess != null
                    ? `Gættede ${result.guess} (${result.distance === 0 ? da.hunch.exact : result.distance === 1 ? da.hunch.close : result.distance === 2 ? da.hunch.near : da.hunch.miss})`
                    : "Intet gæt"}
                </p>
              </div>
              <motion.span
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className={`font-display text-3xl font-bold ${
                  result.score > 0 ? "text-[var(--color-hunch)]" : "text-[var(--color-text-muted)]"
                }`}
              >
                +{result.score}
              </motion.span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Clue-giver bonus */}
      <AnimatePresence>
        {stage === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="rounded-2xl bg-[var(--color-hunch)]/10 ring-1 ring-[var(--color-hunch)]/30 px-8 py-4 text-center">
              <p className="text-sm uppercase tracking-widest text-[var(--color-text-muted)]">
                {da.hunch.clueGiverBonus}
              </p>
              <p className="text-lg font-semibold">{clueGiverName}</p>
              <p className="font-display text-3xl font-bold text-[var(--color-hunch)]">+{clueGiverBonus}</p>
            </div>

            <button
              onClick={() => send({ type: "hostAdvance", hostId: sessionId })}
              className="mt-4 rounded-2xl bg-[var(--color-hunch)] px-12 py-5 text-2xl font-bold text-[#0d0b1a] transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              {isLastRound ? da.scores : da.nextRound}
            </button>
            <span className="text-base text-[var(--color-text-muted)]">
              <CountdownTimer deadline={room.phaseDeadline ?? null} />s
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

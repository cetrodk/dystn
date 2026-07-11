import { motion, AnimatePresence } from "framer-motion";
import { CountdownTimer } from "@dystn/ui/CountdownTimer";
import {
  sfxDrumroll,
  sfxAnswerPop,
  sfxCrowdReact,
  sfxFanfare,
} from "@/lib/sounds";
import { GameAvatar } from "@/components/GameAvatar";
import { useSend } from "@/providers/PartyProvider";
import { da } from "@/lib/da";
import { useStaggeredReveal } from "@/hooks/useStaggeredReveal";
import type { PhaseComponentProps } from "../registry";

export default function HostReveal({ room, sessionId }: PhaseComponentProps) {
  const send = useSend();
  const phaseData = room.phaseData ?? {};
  const results = phaseData.results ?? [];
  const promptText = phaseData.promptText ?? "";
  const isLastRound = (room.roundNumber ?? 1) >= (room.totalRounds ?? 1);

  const fakes = results.filter((r: any) => !r.isReal);
  const truth = results.find((r: any) => r.isReal);

  const { stage, visibleItems, schedule } = useStaggeredReveal({
    itemCount: fakes.length,
    onItemReveal: (i) => {
      sfxAnswerPop();
      if (fakes[i]?.fooledCount > 0) {
        schedule(sfxCrowdReact, 800);
      }
    },
    onDrumroll: () => sfxDrumroll(),
    onFinalReveal: () => {
      sfxFanfare();
      schedule(sfxCrowdReact, 500);
    },
  });

  const showTruth = stage === "final" || stage === "done";

  return (
    <div className="flex flex-col items-center gap-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl text-center font-display text-4xl font-bold text-[var(--color-text-muted)]"
      >
        {promptText}
      </motion.div>

      <AnimatePresence>
        {stage === "intro" && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-2xl italic text-[var(--color-text-muted)]"
          >
            {da.host.letsSeePre}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex w-full max-w-5xl flex-col gap-5">
        <AnimatePresence>
          {fakes.slice(0, visibleItems).map((result: any) => (
            <motion.div
              key={result.answerId}
              initial={{ opacity: 0, x: -60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
              className="flex items-center gap-5 rounded-2xl bg-[var(--color-surface)] p-6"
            >
              <GameAvatar
                name={result.playerName}
                avatarColor={result.avatarColor}
                avatarImage={result.avatarImage}
                className="h-16 w-16"
              />
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold">{result.text}</p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-base text-[var(--color-text-muted)]"
                >
                  {(result.authorNames ?? [result.playerName]).join(" + ")} {da.fusk.wroteThis}
                </motion.p>
                {result.voterNames.length > 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-base text-[var(--color-primary-light)]"
                  >
                    {da.fusk.fooledBy}: {result.voterNames.join(", ")}
                  </motion.p>
                )}
              </div>

              <div className="text-right min-w-[5rem]">
                <motion.p
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6, type: "spring" }}
                  className={`font-display text-3xl font-bold ${
                    result.fooledCount > 0
                      ? "text-[var(--color-primary)]"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  +{result.fooledCount * 500}
                </motion.p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {result.fooledCount === 1
                    ? `narret 1 ${da.fusk.players.slice(0, -1)}`
                    : `narret ${result.fooledCount}`}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {stage === "drumroll" && (
          <motion.p
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 1, 1, 0.5], scale: [0.8, 1.05, 1, 1] }}
            transition={{ duration: 1.2 }}
            className="text-3xl font-bold text-[var(--color-primary)]"
          >
            {da.fusk.theRealAnswer}...
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTruth && truth && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: [0, 1.05, 1] }}
            transition={{ duration: 0.5, type: "spring", stiffness: 120 }}
            className="w-full max-w-5xl rounded-2xl bg-[var(--color-primary)]/15 ring-2 ring-[var(--color-primary)] p-8 text-center"
          >
            <p className="text-base uppercase tracking-widest text-[var(--color-primary)]">
              {da.fusk.theRealAnswer}
            </p>
            <p className="mt-3 font-display text-5xl font-bold">{truth.text}</p>
            {truth.voterNames.length > 0 ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-3 text-lg text-[var(--color-primary-light)]"
              >
                {da.fusk.correctGuess} {truth.voterNames.join(", ")}
              </motion.p>
            ) : (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-3 text-lg text-[var(--color-text-muted)]"
              >
                {da.fusk.noOneGuessed}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            <button
              onClick={() => send({ type: "hostAdvance", hostId: sessionId })}
              className="rounded-2xl bg-[var(--color-primary)] px-12 py-5 text-2xl font-bold transition-transform hover:scale-105 active:scale-95 cursor-pointer"
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

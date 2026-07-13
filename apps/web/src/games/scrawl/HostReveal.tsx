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
import { DrawingDisplay } from "./DrawingDisplay";
import { useStaggeredReveal } from "@/hooks/useStaggeredReveal";
import type { PhaseComponentProps } from "../registry";

export default function HostReveal({ room, sessionId }: PhaseComponentProps) {
  const send = useSend();
  const phaseData = room.phaseData ?? {};
  const results = phaseData.results ?? [];
  const drawingData = phaseData.drawingData ?? [];
  const theWord = phaseData.theWord ?? "???";
  const artistBonus = phaseData.artistBonus ?? false;
  const artistName = phaseData.artistName ?? "???";
  const drawingIndex = phaseData.drawingIndex ?? 0;
  const totalDrawings = phaseData.totalDrawings ?? 1;
  const isLastDrawing = drawingIndex >= totalDrawings - 1;

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
    <div className="fixed inset-0 flex flex-col lg:flex-row p-4 sm:p-6 pt-14 gap-8 overflow-hidden">
      <div className="flex-[3] flex flex-col min-h-0 min-w-0">
        <div className="text-sm uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
          {da.scrawl.drawing} {drawingIndex + 1} {da.of} {totalDrawings}
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <DrawingDisplay data={drawingData} className="max-h-full max-w-full w-auto h-full" />
        </div>
      </div>

      <div className="flex-[2] flex flex-col justify-center gap-5 overflow-y-auto">
        <AnimatePresence>
          {stage === "intro" && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-xl italic text-[var(--color-text-muted)] text-center"
            >
              {da.host.letsSeePre}
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {fakes.slice(0, visibleItems).map((result: any) => (
            <motion.div
              key={result.answerId}
              initial={{ opacity: 0, x: -40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
              className="flex items-center gap-4 rounded-2xl bg-[var(--color-surface)] p-5"
            >
              <GameAvatar
                name={result.playerName}
                avatarColor={result.avatarColor}
                avatar={result.avatar}
                className="h-14 w-14"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold">{result.text}</p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-sm text-[var(--color-text-muted)]"
                >
                  {result.playerName}
                </motion.p>
                {result.voterNames.length > 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-sm text-[var(--color-primary-light)]"
                  >
                    {da.fusk.fooledBy}: {result.voterNames.join(", ")}
                  </motion.p>
                )}
              </div>
              <div className="text-right min-w-[4rem]">
                <motion.p
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6, type: "spring" }}
                  className={`font-display text-2xl font-bold ${
                    result.fooledCount > 0
                      ? "text-[var(--color-primary)]"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  +{result.fooledCount * 500}
                </motion.p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {stage === "drumroll" && (
            <motion.p
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0, 1, 1, 0.5], scale: [0.8, 1.05, 1, 1] }}
              transition={{ duration: 1.2 }}
              className="text-2xl font-bold text-[var(--color-primary)] text-center"
            >
              {da.scrawl.theWordWas}..
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showTruth && truth && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: [0, 1.05, 1] }}
              transition={{ duration: 0.5, type: "spring", stiffness: 120 }}
              className="rounded-2xl bg-[var(--color-primary)]/15 ring-2 ring-[var(--color-primary)] p-4 sm:p-6 text-center"
            >
              <p className="text-sm uppercase tracking-widest text-[var(--color-primary)]">
                {da.scrawl.theWordWas}
              </p>
              <p className="mt-2 font-display text-4xl font-bold">{theWord}</p>
              {truth.voterNames.length > 0 ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-2 text-base text-[var(--color-primary-light)]"
                >
                  {da.fusk.correctGuess} {truth.voterNames.join(", ")}
                </motion.p>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-2 text-base text-[var(--color-text-muted)]"
                >
                  {da.fusk.noOneGuessed}
                </motion.p>
              )}
              {artistBonus && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="mt-2 text-base font-bold text-[var(--color-primary)]"
                >
                  {da.scrawl.artistBonus} {artistName} +1000
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
              className="flex items-center justify-center gap-4"
            >
              <button
                onClick={() => send({ type: "hostAdvance", hostId: sessionId })}
                className="rounded-2xl bg-[var(--color-primary)] px-10 py-4 text-xl font-bold transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                {isLastDrawing ? da.scores : da.scrawl.nextDrawing}
              </button>
              <span className="text-base text-[var(--color-text-muted)]">
                <CountdownTimer deadline={room.phaseDeadline ?? null} />s
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

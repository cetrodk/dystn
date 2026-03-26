import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sfxReveal, sfxScore } from "@/lib/sounds";
import { GameAvatar } from "@/components/GameAvatar";
import { useSend } from "@/providers/PartyProvider";
import { da } from "@/lib/da";
import { DrawingDisplay } from "../tegn/DrawingDisplay";
import type { PhaseComponentProps } from "../registry";

export default function HostReveal({ room, sessionId }: PhaseComponentProps) {
  const send = useSend();
  const phaseData = room.phaseData ?? {};
  const chains: any[] = phaseData.chains ?? [];
  const chainIndex: number = phaseData.revealChainIndex ?? 0;
  const stepIndex: number = phaseData.revealStepIndex ?? 0;
  const currentChain = chains[chainIndex] ?? [];
  const currentStep = currentChain[stepIndex];
  const isLastStep = stepIndex >= currentChain.length - 1;
  const isLastChain = chainIndex >= chains.length - 1;

  // Play sound on each new step
  useEffect(() => {
    if (stepIndex === 0 && chainIndex === 0) {
      sfxReveal();
    } else {
      sfxScore();
    }
  }, [chainIndex, stepIndex]);

  function handleNext() {
    send({ type: "telefonAdvanceReveal", hostId: sessionId });
  }

  if (!currentStep) return null;

  // Show the chain origin (who wrote it)
  const chainOwner = currentChain[0];

  return (
    <div className="fixed inset-0 flex flex-col items-center p-6 pt-14">
      {/* Top bar */}
      <div className="flex w-full items-center justify-between mb-6">
        <div className="text-sm uppercase tracking-widest text-[var(--color-text-muted)]">
          {da.telefon.chain} {chainIndex + 1} {da.telefon.of} {chains.length}
        </div>
        <div className="flex items-center gap-3">
          {chainOwner ? (
            <div className="flex items-center gap-2">
              <GameAvatar
                name={chainOwner.playerName}
                avatarColor={chainOwner.avatarColor}
                avatarImage={chainOwner.avatarImage}
                className="h-8 w-8"
              />
              <span className="text-sm font-semibold text-[var(--color-text-muted)]">
                {chainOwner.playerName}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Chain progress dots */}
      <div className="flex gap-2 mb-6">
        {currentChain.map((_: any, i: number) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all ${
              i <= stepIndex ? "w-6 bg-[var(--color-primary)]" : "w-2 bg-[var(--color-surface-light)]"
            }`}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 w-full min-h-0 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${chainIndex}-${stepIndex}`}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="flex flex-col items-center gap-4 w-full max-w-2xl"
          >
            {/* Step type label */}
            <p className="text-sm uppercase tracking-widest text-[var(--color-text-muted)]">
              {currentStep.type === "write"
                ? da.telefon.original
                : currentStep.type === "draw"
                  ? da.tegn.draw
                  : da.tegn.guess}
            </p>

            {/* Content */}
            {currentStep.type === "draw" ? (
              <div className="w-full max-w-lg">
                <DrawingDisplay
                  data={currentStep.content}
                  className="w-full"
                />
              </div>
            ) : (
              <div className="rounded-2xl bg-[var(--color-surface)] px-10 py-8 text-center">
                <p className="font-display text-4xl font-bold">
                  {String(currentStep.content)}
                </p>
              </div>
            )}

            {/* Author */}
            <div className="flex items-center gap-2">
              <GameAvatar
                name={currentStep.playerName}
                avatarColor={currentStep.avatarColor}
                avatarImage={currentStep.avatarImage}
                className="h-10 w-10"
              />
              <span className="text-lg font-semibold">
                {currentStep.playerName}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Next button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6"
      >
        <button
          onClick={handleNext}
          className="rounded-2xl bg-[var(--color-primary)] px-10 py-4 text-xl font-bold transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        >
          {isLastStep && isLastChain
            ? da.gameOver
            : isLastStep
              ? da.telefon.nextChain
              : da.telefon.nextStep}
        </button>
      </motion.div>
    </div>
  );
}

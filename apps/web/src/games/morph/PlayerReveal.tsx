import { motion } from "framer-motion";
import { da } from "@/lib/da";
import { DrawingDisplay } from "../scrawl/DrawingDisplay";
import type { PhaseComponentProps } from "../registry";

export default function PlayerReveal({ room }: PhaseComponentProps) {
  const phaseData = room.phaseData ?? {};
  const chains: any[] = phaseData.chains ?? [];
  const chainIndex: number = phaseData.revealChainIndex ?? 0;
  const stepIndex: number = phaseData.revealStepIndex ?? 0;
  const currentChain = chains[chainIndex] ?? [];
  const currentStep = currentChain[stepIndex];

  if (!currentStep) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="text-6xl"
        >
          👀
        </motion.div>
        <p className="font-display text-2xl font-bold">{da.lookAtScreen}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <p className="text-sm uppercase tracking-widest text-[var(--color-text-muted)]">
        {da.morph.chain} {chainIndex + 1} {da.morph.of} {chains.length}
      </p>

      <motion.div
        key={`${chainIndex}-${stepIndex}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-3 w-full max-w-xs"
      >
        {currentStep.type === "draw" ? (
          <DrawingDisplay data={currentStep.content} className="w-full" />
        ) : (
          <div className="rounded-xl bg-[var(--color-surface)] px-6 py-4 text-center w-full">
            <p className="text-lg font-bold">{String(currentStep.content)}</p>
          </div>
        )}
        <p className="text-sm text-[var(--color-text-muted)]">
          {currentStep.playerName}
        </p>
      </motion.div>
    </div>
  );
}

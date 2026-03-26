import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sfxAnswerPop } from "@/lib/sounds";
import { da } from "@/lib/da";
import { useSend } from "@/providers/PartyProvider";
import { useStaggeredReveal } from "@/hooks/useStaggeredReveal";
import type { PhaseComponentProps } from "../registry";

const AUTO_ADVANCE_DELAY = 2_000;

export default function HostPresent({ room, sessionId }: PhaseComponentProps) {
  const send = useSend();
  const advancedRef = useRef(false);
  const phaseData = room.phaseData ?? {};
  const answers = phaseData.answersAnonymized ?? [];
  const promptText = phaseData.promptText ?? "";

  const { stage, visibleItems } = useStaggeredReveal({
    itemCount: answers.length,
    onItemReveal: () => sfxAnswerPop(),
  });

  const allRevealed = stage === "drumroll" || stage === "final" || stage === "done";

  useEffect(() => {
    if (!allRevealed || advancedRef.current) return;
    advancedRef.current = true;
    const timer = setTimeout(() => {
      send({ type: "hostAdvance", hostId: sessionId });
    }, AUTO_ADVANCE_DELAY);
    return () => clearTimeout(timer);
  }, [allRevealed, send, sessionId]);

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
          {answers.slice(0, visibleItems).map((answer: any) => (
            <motion.div
              key={answer.id}
              initial={{ opacity: 0, x: -60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
              className="rounded-2xl bg-[var(--color-surface)] p-6 text-center text-2xl font-semibold"
            >
              {answer.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {allRevealed && (
          <motion.p
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 150 }}
            className="font-display text-3xl font-bold text-[var(--color-primary)]"
          >
            {da.duel.voteNowOnPhone}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

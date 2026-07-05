import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { WaitingScreen } from "@/components/WaitingScreen";
import { useSend, usePartyConnection } from "@/providers/PartyProvider";
import { sfxClick } from "@/lib/sounds";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

export default function PlayerVote({ room, sessionId }: PhaseComponentProps) {
  const send = useSend();
  const { error: serverError } = usePartyConnection();
  const [voted, setVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // voted is optimistic — if the server rejected the vote, return to the
  // ballot instead of stranding the player on the waiting screen.
  useEffect(() => {
    if (serverError) {
      setVoted(false);
      setSubmitting(false);
    }
  }, [serverError]);

  const phaseData = room.phaseData ?? {};
  const allAnswers = phaseData.answersAnonymized ?? [];
  let ownAnswer: any;
  const voteableAnswers: any[] = [];
  for (const a of allAnswers) {
    if (a.isOwn) ownAnswer = a;
    else voteableAnswers.push(a);
  }

  function handleVote(answerId: string) {
    if (submitting) return;
    setSubmitting(true);
    sfxClick();
    send({ type: "submitAnswer", sessionId, content: answerId, phase: room.currentPhase });
    setVoted(true);
  }

  if (voted || phaseData.myVote) {
    return <WaitingScreen deadline={room.phaseDeadline} players={room.players} />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="text-4xl font-mono font-bold text-[var(--color-primary)]">
        <CountdownTimer deadline={room.phaseDeadline ?? null} />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-xs text-center text-base text-[var(--color-text-muted)]"
      >
        {phaseData.promptText}
      </motion.p>

      {ownAnswer ? (
        <div className="w-full max-w-xs">
          <p className="mb-1 text-center text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
            {da.fusk.yourFake}
          </p>
          <div className="rounded-xl border-2 border-dashed border-[var(--color-text-muted)]/40 bg-[var(--color-surface)]/50 p-4 text-center text-lg font-medium text-[var(--color-text-muted)]">
            {ownAnswer.text}
          </div>
        </div>
      ) : null}

      <p className="font-display text-xl font-bold">{da.fusk.guessReal}</p>

      <div className="flex w-full max-w-xs flex-col gap-3">
        {voteableAnswers.map((answer: any, i: number) => (
          <motion.button
            key={answer.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => handleVote(answer.id)}
            disabled={submitting}
            className={`rounded-xl bg-[var(--color-surface)] p-4 text-lg font-medium text-left ${submitting ? "opacity-60 cursor-not-allowed" : "transition-transform hover:scale-105 active:scale-95 cursor-pointer"}`}
          >
            {answer.text}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

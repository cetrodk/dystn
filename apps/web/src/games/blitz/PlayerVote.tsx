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
  const answers = [...(phaseData.answersAnonymized ?? [])].sort(
    (a: any, b: any) => (b.isOwn ? 1 : 0) - (a.isOwn ? 1 : 0),
  );

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

      <p className="font-display text-xl font-bold">{da.blitz.voteForBest}</p>

      <div className="flex w-full max-w-xs flex-col gap-3">
        {answers.map((answer: any, i: number) => (
          <motion.button
            key={answer.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: answer.isOwn ? 0.4 : 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => !answer.isOwn && handleVote(answer.id)}
            disabled={answer.isOwn || submitting}
            className={`rounded-xl bg-[var(--color-surface)] p-4 text-lg font-medium text-left ${
              answer.isOwn
                ? "cursor-not-allowed"
                : "transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            }`}
          >
            {answer.text}
            {answer.isOwn ? (
              <span className="block text-xs text-[var(--color-text-muted)] mt-1">
                {da.yourAnswer}
              </span>
            ) : null}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

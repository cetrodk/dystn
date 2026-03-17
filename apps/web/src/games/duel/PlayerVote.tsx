import { useState } from "react";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { api } from "../../../convex/_generated/api";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { WaitingScreen } from "@/components/WaitingScreen";
import { sfxClick } from "@/lib/sounds";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

export default function PlayerVote({ room, sessionId }: PhaseComponentProps) {
  const submitAnswer = useMutation(api.game.submitAnswer);
  const [voted, setVoted] = useState(false);

  const phaseData = room.phaseData ?? {};
  const answers = [...(phaseData.answersAnonymized ?? [])].sort(
    (a: any, b: any) => (b.isOwn ? 1 : 0) - (a.isOwn ? 1 : 0),
  );

  async function handleVote(answerId: string) {
    sfxClick();
    await submitAnswer({
      roomId: room._id,
      sessionId,
      content: answerId,
    });
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

      <p className="font-display text-xl font-bold">{da.duel.voteForBest}</p>

      <div className="flex w-full max-w-xs flex-col gap-3">
        {answers.map((answer: any, i: number) => (
          <motion.button
            key={answer.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: answer.isOwn ? 0.4 : 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => !answer.isOwn && handleVote(answer.id)}
            disabled={answer.isOwn}
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

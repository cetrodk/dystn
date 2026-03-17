import { useState } from "react";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Paintbrush } from "lucide-react";
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
  const isArtist = phaseData.isArtist ?? false;
  const allAnswers = phaseData.answersAnonymized ?? [];
  const ownAnswer = allAnswers.find((a: any) => a.isOwn);
  const voteableAnswers = allAnswers.filter((a: any) => !a.isOwn);

  async function handleVote(answerId: string) {
    sfxClick();
    await submitAnswer({
      roomId: room._id,
      sessionId,
      content: answerId,
    });
    setVoted(true);
  }

  if (isArtist) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="text-5xl"
        >
          <Paintbrush className="h-12 w-12" style={{ color: "var(--color-tegn)" }} />
        </motion.div>
        <p className="font-display text-2xl font-bold">{da.tegn.artistWaiting}</p>
        <div className="text-4xl font-mono font-bold text-[var(--color-primary)]">
          <CountdownTimer deadline={room.phaseDeadline ?? null} />
        </div>
      </div>
    );
  }

  if (voted || phaseData.myVote) {
    return <WaitingScreen deadline={room.phaseDeadline} players={room.players} />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="text-4xl font-mono font-bold text-[var(--color-primary)]">
        <CountdownTimer deadline={room.phaseDeadline ?? null} />
      </div>

      {ownAnswer ? (
        <div className="w-full max-w-xs">
          <p className="mb-1 text-center text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
            {da.tegn.yourGuess}
          </p>
          <div className="rounded-xl border-2 border-dashed border-[var(--color-text-muted)]/40 bg-[var(--color-surface)]/50 p-4 text-center text-lg font-medium text-[var(--color-text-muted)]">
            {ownAnswer.text}
          </div>
        </div>
      ) : null}

      <p className="font-display text-xl font-bold">{da.tegn.guessReal}</p>

      <div className="flex w-full max-w-xs flex-col gap-3">
        {voteableAnswers.map((answer: any, i: number) => (
          <motion.button
            key={answer.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => handleVote(answer.id)}
            className="rounded-xl bg-[var(--color-surface)] p-4 text-lg font-medium text-left transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            {answer.text}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

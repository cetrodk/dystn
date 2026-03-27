import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { WaitingScreen } from "@/components/WaitingScreen";
import { useSend } from "@/providers/PartyProvider";
import { sfxWhoosh, sfxUrgent } from "@/lib/sounds";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

export default function PlayerGuess({ room, sessionId }: PhaseComponentProps) {
  const send = useSend();
  const phaseData = room.phaseData ?? {};
  const myPrev = phaseData.mySubmission as string | null;

  const [guess, setGuess] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isArtist = phaseData.isArtist;

  useEffect(() => {
    if (myPrev && !submitted) setGuess(myPrev);
  }, [myPrev, submitted]);

  const handleTick = useCallback((s: number) => {
    if (s <= 5 && s > 0) sfxUrgent();
  }, []);

  if (isArtist) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="text-6xl"
        >
          ✏️
        </motion.div>
        <p className="font-display text-2xl font-bold">{da.tegn.youAreTheArtist}</p>
        <p className="text-[var(--color-text-muted)]">{da.tegn.watchThemGuess}</p>
        <div className="text-4xl font-mono font-bold text-[var(--color-primary)]">
          <CountdownTimer deadline={room.phaseDeadline ?? null} />
        </div>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guess.trim() || submitting) return;
    setSubmitting(true);

    sfxWhoosh();
    send({ type: "submitAnswer", sessionId, content: guess.trim() });
    setSubmitted(true);
    setError("");
    setSubmitting(false);
  }

  if (submitted || myPrev) {
    return (
      <WaitingScreen deadline={room.phaseDeadline} players={room.players}>
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => { setSubmitted(false); setSubmitting(false); }}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-surface)] px-5 py-3 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
        >
          <Pencil className="h-4 w-4" />
          {da.editAnswer}
        </motion.button>
      </WaitingScreen>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="text-4xl font-mono font-bold text-[var(--color-primary)]">
        <CountdownTimer
          deadline={room.phaseDeadline ?? null}
          onTick={handleTick}
        />
      </div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm text-center font-display text-xl font-bold"
      >
        {da.tegn.whatIsBeingDrawn}
      </motion.p>

      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-4">
        <input
          type="text"
          maxLength={80}
          value={guess}
          onChange={(e) => { setGuess(e.target.value); setError(""); }}
          placeholder={da.tegn.guess}
          className="rounded-xl bg-[var(--color-surface)] p-4 text-center text-lg placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"
          autoComplete="off"
          autoFocus
        />
        {error ? (
          <p className="text-center text-sm font-medium text-[var(--color-danger)]">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={!guess.trim() || submitting}
          className="rounded-xl bg-[var(--color-primary)] p-4 text-xl font-bold transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 cursor-pointer"
        >
          {da.submit}
        </button>
      </form>
    </div>
  );
}

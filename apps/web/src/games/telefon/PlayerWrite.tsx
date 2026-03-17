import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { motion } from "framer-motion";
import { api } from "../../../convex/_generated/api";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { WaitingScreen } from "@/components/WaitingScreen";
import { sfxWhoosh, sfxUrgent } from "@/lib/sounds";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

export default function PlayerWrite({ room, sessionId }: PhaseComponentProps) {
  const submitAnswer = useMutation(api.game.submitAnswer);
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const phaseData = room.phaseData ?? {};

  const handleTick = useCallback((s: number) => {
    if (s <= 5 && s > 0) sfxUrgent();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    try {
      sfxWhoosh();
      await submitAnswer({
        roomId: room._id,
        sessionId,
        content: text.trim(),
      });
      setSubmitted(true);
      setError("");
    } catch (err) {
      const msg = err instanceof ConvexError ? String(err.data) : "Fejl";
      setError(msg);
    }
  }

  if (submitted || phaseData.mySubmission) {
    const myText = phaseData.mySubmission ?? text;
    return (
      <WaitingScreen deadline={room.phaseDeadline} players={room.players}>
        {myText ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-xs rounded-xl bg-[var(--color-surface)] px-6 py-3 text-center"
          >
            <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
              {da.telefon.original}
            </p>
            <p className="text-lg font-semibold">{myText}</p>
          </motion.div>
        ) : null}
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
        {da.telefon.writePrompt}
      </motion.p>

      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-4">
        <div>
          <input
            type="text"
            maxLength={120}
            value={text}
            onChange={(e) => { setText(e.target.value); setError(""); }}
            placeholder={da.telefon.writePlaceholder}
            className="w-full rounded-xl bg-[var(--color-surface)] p-4 text-center text-lg placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"
            autoComplete="off"
            autoFocus
          />
          {text.length > 80 ? (
            <p className={`mt-1 text-right text-xs ${text.length > 110 ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]"}`}>
              {text.length}/120
            </p>
          ) : null}
        </div>
        {error ? (
          <p className="text-center text-sm font-medium text-[var(--color-danger)]">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-xl bg-[var(--color-primary)] p-4 text-xl font-bold transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 cursor-pointer"
        >
          {da.submit}
        </button>
      </form>
    </div>
  );
}

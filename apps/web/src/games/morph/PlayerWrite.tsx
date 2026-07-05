import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { WaitingScreen } from "@/components/WaitingScreen";
import { useSend } from "@/providers/PartyProvider";
import { sfxWhoosh, sfxUrgent } from "@/lib/sounds";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

export default function PlayerWrite({ room, sessionId }: PhaseComponentProps) {
  const send = useSend();
  const phaseData = room.phaseData ?? {};
  const myPrev = phaseData.mySubmission as string | null;

  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (myPrev && !submitted) setText(myPrev);
  }, [myPrev, submitted]);

  const handleTick = useCallback((s: number) => {
    if (s <= 5 && s > 0) sfxUrgent();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);

    sfxWhoosh();
    send({ type: "submitAnswer", sessionId, content: text.trim(), phase: room.currentPhase });
    setSubmitted(true);
    setEditing(false);
    setError("");
    setSubmitting(false);
  }

  if ((submitted || myPrev) && !editing) {
    const myText = myPrev ?? text;
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
              {da.morph.original}
            </p>
            <p className="text-lg font-semibold">{myText}</p>
          </motion.div>
        ) : null}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          onClick={() => { setEditing(true); setSubmitted(false); setSubmitting(false); }}
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
        {da.morph.writePrompt}
      </motion.p>

      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-4">
        <div>
          <input
            type="text"
            maxLength={120}
            value={text}
            onChange={(e) => { setText(e.target.value); setError(""); }}
            placeholder={da.morph.writePlaceholder}
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
          disabled={!text.trim() || submitting}
          className="rounded-xl bg-[var(--color-primary)] p-4 text-xl font-bold transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 cursor-pointer"
        >
          {da.submit}
        </button>
      </form>
    </div>
  );
}

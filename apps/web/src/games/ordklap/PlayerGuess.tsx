import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { WaitingScreen } from "@/components/WaitingScreen";
import { useSend } from "@/providers/PartyProvider";
import { sfxClick, sfxUrgent } from "@/lib/sounds";
import { da } from "@/lib/da";
import { SpectrumBar } from "./SpectrumBar";
import type { PhaseComponentProps } from "../registry";

export default function PlayerGuess({ room, sessionId }: PhaseComponentProps) {
  const send = useSend();
  const phaseData = room.phaseData ?? {};
  const clueGiverId = phaseData.clueGiverId as string | undefined;
  const isClueGiver = room.currentPlayerId === clueGiverId;
  const clue = phaseData.clue as string | undefined;
  const myPrevGuess = phaseData.myGuess as number | null;

  const [position, setPosition] = useState(myPrevGuess ?? 5);
  const [submitted, setSubmitted] = useState(false);

  const handleTick = useCallback((s: number) => {
    if (s <= 5 && s > 0) sfxUrgent();
  }, []);

  if (isClueGiver) {
    const submittedCount = (phaseData.submittedCount as number) ?? 0;
    const totalGuessers = (phaseData.totalGuessers as number) ?? 0;
    return (
      <WaitingScreen deadline={room.phaseDeadline} players={room.players}>
        <p className="text-sm text-[var(--color-text-muted)]">
          {da.ordklap.watchingGuesses}
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          {da.ordklap.clueIs}: <span className="font-bold text-[var(--color-text)]">{clue}</span>
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          {submittedCount}/{totalGuessers} har gættet
        </p>
      </WaitingScreen>
    );
  }

  if (submitted || myPrevGuess != null) {
    const guess = myPrevGuess ?? position;
    return (
      <WaitingScreen deadline={room.phaseDeadline} players={room.players}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-[var(--color-surface)] px-6 py-3 text-center"
        >
          <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
            {da.ordklap.yourScore}
          </p>
          <p className="text-3xl font-bold text-[var(--color-ordklap)]">{guess}</p>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => { setSubmitted(false); }}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-surface)] px-5 py-3 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
        >
          <Pencil className="h-4 w-4" />
          {da.ordklap.editGuess}
        </motion.button>
      </WaitingScreen>
    );
  }

  function handleSubmit() {
    sfxClick();
    send({ type: "submitAnswer", sessionId, content: position });
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="text-4xl font-mono font-bold text-[var(--color-ordklap)]">
        <CountdownTimer deadline={room.phaseDeadline ?? null} onTick={handleTick} />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl bg-[var(--color-ordklap)]/10 ring-1 ring-[var(--color-ordklap)]/40 px-6 py-3"
      >
        <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-1">{da.ordklap.clueIs}</p>
        <p className="font-display text-2xl font-bold">{clue ?? "..."}</p>
      </motion.div>

      <SpectrumBar
        leftLabel={String(phaseData.leftLabel ?? "")}
        rightLabel={String(phaseData.rightLabel ?? "")}
        activePosition={position}
        className="max-w-xs"
      />

      <div className="w-full max-w-xs">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="w-full accent-[var(--color-ordklap)] h-3 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1 px-1">
          <span>1</span>
          <span className="font-bold text-[var(--color-ordklap)] text-lg">{position}</span>
          <span>10</span>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className="rounded-xl bg-[var(--color-ordklap)] px-8 py-4 text-xl font-bold text-[#0d0b1a] transition-transform hover:scale-105 active:scale-95 cursor-pointer"
      >
        {da.ordklap.submitGuess}
      </button>
    </div>
  );
}

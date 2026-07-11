import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { CountdownTimer } from "@dystn/ui/CountdownTimer";
import { WaitingScreen } from "@/components/WaitingScreen";
import { useSend } from "@/providers/PartyProvider";
import { sfxWhoosh, sfxUrgent } from "@/lib/sounds";
import { da } from "@/lib/da";
import { SpectrumBar } from "./SpectrumBar";
import type { PhaseComponentProps } from "../registry";

export default function PlayerClue({ room, sessionId }: PhaseComponentProps) {
  const send = useSend();
  const phaseData = room.phaseData ?? {};
  const clueGiverId = phaseData.clueGiverId as string | undefined;
  const isClueGiver = room.currentPlayerId === clueGiverId;
  const target = phaseData.target as number | undefined;
  const myPrev = phaseData.mySubmission as string | null;

  const [clue, setClue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleTick = useCallback((s: number) => {
    if (s <= 5 && s > 0) sfxUrgent();
  }, []);

  if (!isClueGiver) {
    const clueGiver = room.players?.find((p) => p._id === clueGiverId);
    return (
      <WaitingScreen deadline={room.phaseDeadline} players={room.players}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-[var(--color-surface)] px-6 py-3 text-center"
        >
          <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
            {da.hunch.thisRound}
          </p>
          <p className="font-display text-lg font-bold">
            {String(phaseData.leftLabel ?? "")} ← → {String(phaseData.rightLabel ?? "")}
          </p>
        </motion.div>
        <p className="text-sm text-[var(--color-text-muted)]">
          {clueGiver?.name} {da.hunch.waitingForClue}
        </p>
      </WaitingScreen>
    );
  }

  if (submitted || myPrev) {
    return (
      <WaitingScreen deadline={room.phaseDeadline} players={room.players}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-[var(--color-surface)] px-6 py-3 text-center"
        >
          <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
            Dit fingerpeg
          </p>
          <p className="text-lg font-semibold">{myPrev ?? clue}</p>
        </motion.div>
      </WaitingScreen>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clue.trim()) return;
    sfxWhoosh();
    send({ type: "submitAnswer", sessionId, content: clue.trim(), phase: room.currentPhase });
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="text-4xl font-mono font-bold text-[var(--color-hunch)]">
        <CountdownTimer deadline={room.phaseDeadline ?? null} onTick={handleTick} />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-display text-xl font-bold text-[var(--color-hunch)]"
      >
        {da.hunch.youAreClueGiver}
      </motion.p>

      <SpectrumBar
        leftLabel={String(phaseData.leftLabel ?? "")}
        rightLabel={String(phaseData.rightLabel ?? "")}
        target={target}
        showTarget
        className="max-w-xs"
      />

      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-4">
        <input
          type="text"
          maxLength={60}
          value={clue}
          onChange={(e) => setClue(e.target.value)}
          placeholder={da.hunch.cluePlaceholder}
          className="w-full rounded-xl bg-[var(--color-surface)] p-4 text-center text-lg placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-hunch)]/50"
          autoComplete="off"
          autoFocus
        />
        <button
          type="submit"
          disabled={!clue.trim()}
          className="rounded-xl bg-[var(--color-hunch)] p-4 text-xl font-bold text-[#0d0b1a] transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 cursor-pointer"
        >
          {da.submit}
        </button>
      </form>
    </div>
  );
}

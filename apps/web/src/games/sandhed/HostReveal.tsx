import { useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, X, HelpCircle } from "lucide-react";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { sfxReveal, sfxCorrect, sfxWrong, sfxShame, sfxHop } from "@/lib/sounds";
import { GameAvatar } from "@/components/GameAvatar";
import { useSend } from "@/providers/PartyProvider";
import { da } from "@/lib/da";
import { Racetrack } from "./Racetrack";
import type { PhaseComponentProps } from "../registry";

interface ResultEntry {
  playerId: string;
  playerName: string;
  avatarColor: string;
  choice: string | null;
  correct: boolean;
  noAnswer: boolean;
  delta: number;
  newPosition: number;
}

export default function HostReveal({ room, sessionId }: PhaseComponentProps) {
  const send = useSend();
  const pd = room.phaseData ?? {};
  const correctAnswer = pd.correctAnswer as string;
  const results = (pd.results ?? []) as ResultEntry[];
  const trackPositions = (pd.trackPositions ?? {}) as Record<string, number>;
  const players = room.players ?? [];

  const isCorrectTrue = correctAnswer === "true";

  // Play staggered sounds: reveal -> per-player results -> track hops
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Answer reveal sound
    timers.push(setTimeout(sfxReveal, 300));
    // Per-player result sounds
    results.forEach((r, i) => {
      timers.push(setTimeout(() => {
        if (r.noAnswer) sfxShame();
        else if (r.correct) sfxCorrect();
        else sfxWrong();
      }, 600 + i * 150));
    });
    // Track hop sound
    timers.push(setTimeout(sfxHop, 800 + results.length * 150));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdvance = useCallback(() => {
    send({ type: "hostAdvance", hostId: sessionId });
  }, [send, sessionId]);

  return (
    <div className="flex flex-1 min-h-0 w-full flex-col items-center gap-5">
      {/* Statement + answer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center"
      >
        <p className="max-w-5xl text-center font-display text-5xl font-bold leading-tight mb-4">
          &ldquo;{pd.statement}&rdquo;
        </p>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          className={`inline-block rounded-2xl px-8 py-3 font-display text-3xl font-bold ${
            isCorrectTrue
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {isCorrectTrue ? da.sandhed.sandt : da.sandhed.falsk}
        </motion.div>
      </motion.div>

      {/* Results per player */}
      <div className="flex flex-wrap justify-center gap-4 max-w-6xl">
        {results.map((result, i) => (
          <motion.div
            key={result.playerId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.15 }}
            className={`flex items-center gap-3 rounded-2xl px-5 py-3 ${
              result.noAnswer
                ? "bg-[var(--color-surface)] opacity-60"
                : result.correct
                  ? "bg-emerald-500/15 ring-1 ring-emerald-500/30"
                  : "bg-red-500/15 ring-1 ring-red-500/30"
            }`}
          >
            <GameAvatar
              name={result.playerName}
              avatarColor={result.avatarColor}
              className="h-12 w-12"
            />
            <span className="font-semibold text-xl">{result.playerName}</span>

            {result.noAnswer ? (
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: 2, duration: 0.4 }}
              >
                <HelpCircle className="h-7 w-7 text-[var(--color-text-muted)]" />
              </motion.div>
            ) : result.correct ? (
              <Check className="h-7 w-7 text-emerald-400" />
            ) : (
              <X className="h-7 w-7 text-red-400" />
            )}

            <motion.span
              initial={{ scale: 1.5 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.7 + i * 0.15 }}
              className={`font-display text-2xl font-bold ${
                result.delta > 0
                  ? "text-emerald-400"
                  : result.delta < 0
                    ? "text-red-400"
                    : "text-[var(--color-text-muted)]"
              }`}
            >
              {result.delta > 0 ? `+${result.delta}` : result.delta === 0 ? "0" : result.delta}
            </motion.span>
          </motion.div>
        ))}
      </div>

      {/* Racetrack */}
      <Racetrack
        players={players}
        trackPositions={trackPositions}
        animationDelay={0.8}
      />

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="flex items-center gap-4"
      >
        <button
          onClick={handleAdvance}
          className="rounded-2xl bg-[var(--color-sandhed)] px-12 py-5 text-2xl font-bold text-white transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        >
          {da.nextRound}
        </button>
        <span className="text-lg text-[var(--color-text-muted)]">
          <CountdownTimer deadline={room.phaseDeadline ?? null} />s
        </span>
      </motion.div>
    </div>
  );
}

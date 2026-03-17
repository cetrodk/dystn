import { useMutation } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../../convex/_generated/api";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import {
  sfxDrumroll,
  sfxAnswerPop,
  sfxVoteReveal,
  sfxCrowdReact,
  sfxFanfare,
} from "@/lib/sounds";
import { GameAvatar } from "@/components/GameAvatar";
import { da } from "@/lib/da";
import { useStaggeredReveal } from "@/hooks/useStaggeredReveal";
import type { PhaseComponentProps } from "../registry";

function getWinnerAnnouncement(results: any[]): {
  type: "winner" | "tie" | "none";
  names: string[];
} {
  if (results.length === 0) return { type: "none", names: [] };

  const topVotes = results[0]?.votes ?? 0;
  if (topVotes === 0) return { type: "none", names: [] };

  const winners = results.filter((r: any) => r.votes === topVotes);
  if (winners.length > 1) {
    return { type: "tie", names: winners.map((w: any) => w.playerName) };
  }
  return { type: "winner", names: [results[0].playerName] };
}

function getHostReaction(
  announcement: ReturnType<typeof getWinnerAnnouncement>,
  results: any[],
) {
  if (results.length < 2) return null;
  if (announcement.type === "none") return da.host.noVotes;
  if (announcement.type === "tie") return da.host.closeOne;
  const totalVotes = results.reduce((s: number, r: any) => s + r.votes, 0);
  if (results[0].votes === totalVotes) return da.host.unanimous;
  if (results.length >= 2 && results[0].votes - results[1].votes <= 1) return da.host.closeOne;
  return null;
}

export default function HostReveal({ room, sessionId }: PhaseComponentProps) {
  const hostAdvance = useMutation(api.game.hostAdvance);
  const phaseData = room.phaseData ?? {};
  const results = phaseData.results ?? [];
  const promptText = phaseData.promptText ?? "";
  const isLastRound = (room.roundNumber ?? 1) >= (room.totalRounds ?? 1);

  const announcement = getWinnerAnnouncement(results);

  const { stage, visibleItems, schedule } = useStaggeredReveal({
    itemCount: results.length,
    onItemReveal: () => sfxAnswerPop(),
    onDrumroll: () => sfxDrumroll(),
    onFinalReveal: () => {
      sfxVoteReveal();
      if (announcement.type === "winner") {
        schedule(sfxFanfare, 2000);
        schedule(sfxCrowdReact, 2400);
      } else if (announcement.type === "tie") {
        schedule(sfxCrowdReact, 1500);
      }
    },
  });

  const showVotes = stage === "final" || stage === "done";
  const showWinner = stage === "done";
  const hostReaction = getHostReaction(announcement, results);

  return (
    <div className="flex flex-col items-center gap-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl text-center font-display text-4xl font-bold text-[var(--color-text-muted)]"
      >
        {promptText}
      </motion.div>

      <AnimatePresence>
        {stage === "intro" && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-2xl italic text-[var(--color-text-muted)]"
          >
            {da.duel.resultsAreIn}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex w-full max-w-5xl flex-col gap-5">
        <AnimatePresence>
          {results.slice(0, visibleItems).map((result: any) => (
            <motion.div
              key={result.answerId}
              initial={{ opacity: 0, x: -60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
              className="flex items-center gap-5 rounded-2xl bg-[var(--color-surface)] p-6"
            >
              <GameAvatar
                name={result.playerName}
                avatarColor={result.avatarColor}
                avatarImage={result.avatarImage}
                className="h-16 w-16"
              />
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold">{result.text}</p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-base text-[var(--color-text-muted)]"
                >
                  {result.playerName}
                </motion.p>
              </div>

              {showVotes && (
                <div className="flex items-center gap-4">
                  <motion.div
                    className="h-10 rounded-full bg-[var(--color-primary)]"
                    initial={{ width: 0 }}
                    animate={{ width: Math.max(result.votes * 50, 10) }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                  <div className="text-right min-w-[4rem]">
                    <motion.p
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4, type: "spring" }}
                      className="font-display text-4xl font-bold text-[var(--color-primary)]"
                    >
                      {result.votes}
                    </motion.p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {result.votes === 1 ? "stemme" : "stemmer"}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showVotes && hostReaction && (
          <motion.p
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-xl italic text-[var(--color-text-muted)]"
          >
            {hostReaction}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWinner && announcement.type !== "none" && (
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 150 }}
            className="text-center"
          >
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-base text-[var(--color-text-muted)]"
            >
              {announcement.type === "winner" ? da.duel.winner : da.duel.tieLabel}
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`font-display font-bold ${announcement.type === "winner" ? "text-5xl" : "text-4xl"}`}
            >
              {announcement.type === "winner"
                ? announcement.names[0]
                : announcement.names.join(" & ")}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            <button
              onClick={() => hostAdvance({ roomId: room._id, hostId: sessionId })}
              className="rounded-2xl bg-[var(--color-primary)] px-12 py-5 text-2xl font-bold transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              {isLastRound ? da.scores : da.nextRound}
            </button>
            <span className="text-base text-[var(--color-text-muted)]">
              <CountdownTimer deadline={room.phaseDeadline ?? null} />s
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { memo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { sfxUrgent } from "@/lib/sounds";
import { GameAvatar } from "@/components/GameAvatar";
import { da } from "@/lib/da";
import { Racetrack } from "./Racetrack";
import type { PhaseComponentProps } from "../registry";

export default function HostCommit({ room }: PhaseComponentProps) {
  const pd = room.phaseData ?? {};
  const players = room.players ?? [];
  const currentChoices = (pd.currentChoices ?? {}) as Record<string, string>;
  const trackPositions = (pd.trackPositions ?? {}) as Record<string, number>;

  const handleTick = useCallback((s: number) => {
    if (s <= 3 && s > 0) sfxUrgent();
  }, []);

  // Group players by their current choice
  const sandtPlayers = players.filter((p) => currentChoices[p._id] === "true");
  const falskPlayers = players.filter((p) => currentChoices[p._id] === "false");
  const transitPlayers = players.filter(
    (p) => currentChoices[p._id] === "transit",
  );
  const undecided = players.filter((p) => !currentChoices[p._id]);

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Statement */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl text-center font-display text-5xl font-bold leading-tight"
      >
        "{pd.statement}"
      </motion.div>

      {/* SANDT / FALSK zones */}
      <div className="flex w-full max-w-5xl gap-6">
        {/* SANDT zone */}
        <motion.div
          layout
          className="flex-1 rounded-2xl bg-emerald-900/30 border-2 border-emerald-500/40 p-6 min-h-[140px]"
        >
          <h3 className="mb-4 text-center font-display text-3xl font-bold text-emerald-400">
            {da.sandhed.sandt}
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            <AnimatePresence mode="popLayout">
              {sandtPlayers.map((p) => (
                <PlayerBubble key={p._id} player={p} />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Transit zone (middle) */}
        <div className="flex w-24 flex-col items-center justify-center gap-2">
          <AnimatePresence>
            {[...transitPlayers, ...undecided].map((p) => (
              <motion.div
                key={p._id}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 0.6, scale: 0.8 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="flex items-center gap-1"
              >
                <GameAvatar
                  name={p.name}
                  avatarColor={p.avatarColor}
                  avatarImage={p.avatarImage}
                  className="h-8 w-8"
                />
                <span className="text-xs text-[var(--color-text-muted)]">?</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* FALSK zone */}
        <motion.div
          layout
          className="flex-1 rounded-2xl bg-red-900/30 border-2 border-red-500/40 p-6 min-h-[140px]"
        >
          <h3 className="mb-4 text-center font-display text-3xl font-bold text-red-400">
            {da.sandhed.falsk}
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            <AnimatePresence mode="popLayout">
              {falskPlayers.map((p) => (
                <PlayerBubble key={p._id} player={p} />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Timer */}
      <div className="text-8xl font-mono font-bold text-[var(--color-sandhed)] glow-text">
        <CountdownTimer
          deadline={room.phaseDeadline ?? null}
          onTick={handleTick}
        />
      </div>

      {/* Racetrack */}
      <Racetrack players={players} trackPositions={trackPositions} />
    </div>
  );
}

const PlayerBubble = memo(function PlayerBubble({
  player,
}: {
  player: { _id: string; name: string; avatarColor: string; avatarImage?: string };
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="flex items-center gap-2 rounded-full bg-[var(--color-surface)] px-4 py-2"
    >
      <GameAvatar
        name={player.name}
        avatarColor={player.avatarColor}
        avatarImage={player.avatarImage}
        className="h-8 w-8"
      />
      <span className="text-sm font-semibold">{player.name}</span>
    </motion.div>
  );
});

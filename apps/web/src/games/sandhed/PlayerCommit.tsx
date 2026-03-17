import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { api } from "../../../convex/_generated/api";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { sfxUrgent, sfxTick, sfxClick } from "@/lib/sounds";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

const TRANSIT_DURATION = 1500; // 1.5 seconds to switch sides

type PlayerState =
  | { type: "idle" }
  | { type: "committed"; side: "true" | "false" }
  | { type: "transit"; from: "true" | "false" | null; to: "true" | "false"; startedAt: number };

export default function PlayerCommit({ room, sessionId }: PhaseComponentProps) {
  const submitAnswer = useMutation(api.game.submitAnswer);
  const pd = room.phaseData ?? {};

  const [state, setState] = useState<PlayerState>({ type: "idle" });
  const stateRef = useRef(state);
  const transitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync for stable handleTap callback
  useEffect(() => { stateRef.current = state; }, [state]);

  const sendChoice = useCallback(
    (choice: "true" | "false" | "transit") => {
      submitAnswer({
        roomId: room._id,
        sessionId,
        content: { choice },
      }).catch(() => {});
    },
    [submitAnswer, room._id, sessionId],
  );

  const handleTap = useCallback(
    (side: "true" | "false") => {
      const s = stateRef.current;

      // Already committed to this side — no-op
      if (s.type === "committed" && s.side === side) return;

      // Already transiting to this side — no-op
      if (s.type === "transit" && s.to === side) return;

      // Cancel any pending transit
      if (transitTimerRef.current) {
        clearTimeout(transitTimerRef.current);
        transitTimerRef.current = null;
      }

      const from =
        s.type === "committed"
          ? s.side
          : s.type === "transit"
            ? s.from
            : null;

      // Start transit
      sfxClick();
      if (navigator.vibrate) navigator.vibrate(50);
      setState({ type: "transit", from, to: side, startedAt: Date.now() });
      sendChoice("transit");

      // Complete transit after duration
      transitTimerRef.current = setTimeout(() => {
        setState({ type: "committed", side });
        sendChoice(side);
        transitTimerRef.current = null;
      }, TRANSIT_DURATION);
    },
    [sendChoice],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (transitTimerRef.current) clearTimeout(transitTimerRef.current);
    };
  }, []);

  const handleTick = useCallback((s: number) => {
    if (s <= 3 && s > 0) sfxUrgent();
    else if (s <= 5 && s > 3) sfxTick();
  }, []);

  const isTransiting = state.type === "transit";
  const currentSide =
    state.type === "committed"
      ? state.side
      : state.type === "transit"
        ? state.to // show where they're heading
        : null;

  return (
    <div className="flex min-h-screen flex-col p-4">
      {/* Statement (secondary) */}
      <div className="mb-2 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          {da.sandhed.statement}
        </p>
        <p className="font-display text-lg font-bold leading-tight">
          "{pd.statement}"
        </p>
      </div>

      {/* Timer */}
      <div className="mb-4 text-center text-3xl font-mono font-bold text-[var(--color-sandhed)]">
        <CountdownTimer
          deadline={room.phaseDeadline ?? null}
          onTick={handleTick}
        />
      </div>

      {/* SANDT / FALSK buttons — fill remaining space */}
      <div className="flex flex-1 flex-col gap-3">
        {/* SANDT button */}
        <motion.button
          onTap={() => handleTap("true")}
          animate={{
            backgroundColor:
              currentSide === "true"
                ? isTransiting ? "rgba(16, 185, 129, 0.4)" : "rgba(16, 185, 129, 0.7)"
                : "rgba(16, 185, 129, 0.1)",
            scale: currentSide === "true" && !isTransiting ? 1.02 : 1,
          }}
          transition={{ duration: 0.2 }}
          className="flex flex-1 items-center justify-center rounded-2xl border-2 border-emerald-500/40 cursor-pointer"
        >
          <span className="font-display text-4xl font-bold text-emerald-400">
            {da.sandhed.sandt}
          </span>
        </motion.button>

        {/* Transit indicator */}
        {isTransiting && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: TRANSIT_DURATION / 1000, ease: "linear" }}
            className="h-2 rounded-full bg-[var(--color-sandhed)] origin-left"
          />
        )}

        {/* FALSK button */}
        <motion.button
          onTap={() => handleTap("false")}
          animate={{
            backgroundColor:
              currentSide === "false"
                ? isTransiting ? "rgba(239, 68, 68, 0.4)" : "rgba(239, 68, 68, 0.7)"
                : "rgba(239, 68, 68, 0.1)",
            scale: currentSide === "false" && !isTransiting ? 1.02 : 1,
          }}
          transition={{ duration: 0.2 }}
          className="flex flex-1 items-center justify-center rounded-2xl border-2 border-red-500/40 cursor-pointer"
        >
          <span className="font-display text-4xl font-bold text-red-400">
            {da.sandhed.falsk}
          </span>
        </motion.button>
      </div>

      {/* Position info */}
      <div className="mt-3 text-center text-sm text-[var(--color-text-muted)]">
        {da.sandhed.position}: {(pd.trackPositions as Record<string, number>)?.[room.currentPlayerId ?? ""] ?? 0} / 8
      </div>
    </div>
  );
}

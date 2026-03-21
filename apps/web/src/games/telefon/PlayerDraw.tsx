import { useRef, useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { api } from "../../../convex/_generated/api";
import { CountdownTimer } from "@festspil/ui/CountdownTimer";
import { WaitingScreen } from "@/components/WaitingScreen";
import { sfxWhoosh, sfxUrgent } from "@/lib/sounds";
import { da } from "@/lib/da";
import { DrawingCanvas, type DrawingCanvasRef } from "../tegn/DrawingCanvas";
import type { PhaseComponentProps } from "../registry";

export default function PlayerDraw({ room, sessionId }: PhaseComponentProps) {
  const submitAnswer = useMutation(api.game.submitAnswer);
  const canvasRef = useRef<DrawingCanvasRef>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const phaseData = room.phaseData ?? {};
  const myPrompt = phaseData.myPrompt ?? "???";

  const handleTick = useCallback((s: number) => {
    if (s <= 5 && s > 0) sfxUrgent();
  }, []);

  async function doSubmit() {
    if (submitting || submitted) return;
    const strokes = canvasRef.current?.getStrokes();
    if (!strokes || strokes.length === 0) return;
    setSubmitting(true);
    const viewBoxHeight = canvasRef.current?.getViewBoxHeight() ?? 300;

    sfxWhoosh();
    await submitAnswer({
      roomId: room._id,
      sessionId,
      content: { strokes, viewBoxHeight },
    });
    setSubmitted(true);
  }

  const doSubmitRef = useRef(doSubmit);
  doSubmitRef.current = doSubmit;
  const handleExpired = useCallback(() => { doSubmitRef.current(); }, []);

  if (submitted || phaseData.mySubmission) {
    return <WaitingScreen deadline={room.phaseDeadline} players={room.players} />;
  }

  return (
    <div className="flex h-dvh flex-col gap-3 p-4 pt-6">
      <div className="flex items-center justify-between">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-bold"
        >
          {da.telefon.drawThis} <span className="text-[var(--color-primary)]">{myPrompt}</span>
        </motion.p>
        <div className="text-2xl font-mono text-[var(--color-primary)]">
          <CountdownTimer
            deadline={room.phaseDeadline ?? null}
            onTick={handleTick}
            onExpired={handleExpired}
          />
        </div>
      </div>

      <DrawingCanvas
        ref={canvasRef}
        showControls
        className="flex-1 min-h-0"
      />

      <div className="flex gap-3">
        <button
          onClick={() => canvasRef.current?.undo()}
          className="flex-1 rounded-xl bg-[var(--color-surface)] p-3 text-base font-semibold transition-opacity active:opacity-70 cursor-pointer"
        >
          {da.tegn.undo}
        </button>
        <button
          onClick={() => canvasRef.current?.clear()}
          className="flex-1 rounded-xl bg-[var(--color-surface)] p-3 text-base font-semibold transition-opacity active:opacity-70 cursor-pointer"
        >
          {da.tegn.clear}
        </button>
        <button
          onClick={doSubmit}
          disabled={submitting}
          className={`flex-[2] rounded-xl bg-[var(--color-primary)] p-3 text-lg font-bold ${submitting ? "opacity-60 cursor-not-allowed" : "transition-opacity active:opacity-80 cursor-pointer"}`}
        >
          {da.submit}
        </button>
      </div>
    </div>
  );
}

import { useRef, useState } from "react";
import { DrawingCanvas, type DrawingCanvasRef, type Stroke } from "@/games/scrawl/DrawingCanvas";
import { DrawingDisplay } from "@/games/scrawl/DrawingDisplay";

interface SubmittedData {
  strokes: Stroke[];
  viewBoxHeight: number;
}

export function DrawTest() {
  const canvasRef = useRef<DrawingCanvasRef>(null);
  const [submitted, setSubmitted] = useState<SubmittedData | null>(null);

  function handleSubmit() {
    const strokes = canvasRef.current?.getStrokes();
    if (strokes && strokes.length > 0) {
      const viewBoxHeight = canvasRef.current?.getViewBoxHeight() ?? 300;
      setSubmitted({ strokes, viewBoxHeight });
    }
  }

  return (
    <div className="flex h-dvh flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold text-center">Drawing Canvas Test</h1>

      <DrawingCanvas ref={canvasRef} showControls className="flex-1 min-h-0" />

      <div className="flex gap-3 justify-center">
        <button
          onClick={() => canvasRef.current?.undo()}
          className="rounded-xl bg-[var(--color-surface)] px-4 py-2 text-sm font-medium cursor-pointer"
        >
          Undo
        </button>
        <button
          onClick={() => canvasRef.current?.clear()}
          className="rounded-xl bg-[var(--color-surface)] px-4 py-2 text-sm font-medium cursor-pointer"
        >
          Clear
        </button>
        <button
          onClick={handleSubmit}
          className="rounded-xl bg-[var(--color-primary)] px-6 py-2 text-sm font-bold cursor-pointer"
        >
          Submit
        </button>
      </div>

      {submitted ? (
        <div className="w-full max-w-md mx-auto">
          <p className="mb-2 text-sm text-[var(--color-text-muted)]">
            DrawingDisplay (host view) — {submitted.strokes.length} stroke(s):
          </p>
          <DrawingDisplay data={submitted} />
        </div>
      ) : null}
    </div>
  );
}

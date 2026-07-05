import { useEffect } from "react";
import * as Sentry from "@sentry/react";
import { da } from "@/lib/da";

/**
 * Shown when the server is in a phase this client bundle has no component for
 * (typically a skewed deploy). Without it the player silently falls back to
 * the lobby screen mid-game and nothing is logged.
 */
export function UnknownPhase({ gameType, phase }: { gameType: string; phase: string }) {
  useEffect(() => {
    Sentry.captureMessage(`Ukendt fase for ${gameType}: ${phase}`, "error");
  }, [gameType, phase]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-display text-2xl font-bold">{da.unknownPhaseTitle}</p>
      <p className="max-w-sm text-[var(--color-text-muted)]">{da.unknownPhaseHint}</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 font-bold text-white cursor-pointer"
      >
        {da.reloadPage}
      </button>
    </div>
  );
}

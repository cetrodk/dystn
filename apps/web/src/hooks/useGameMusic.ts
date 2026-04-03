import { useEffect } from "react";
import { type RoomSnapshot } from "@/games/registry";
import { crossfadeTo, stopMusic, preloadLoops, PHASE_LOOPS, ALL_LOOP_IDS } from "@/lib/audio/music";
import { preloadSamples, SAMPLE_MANIFEST } from "@/lib/audio/samples";
import { ensureResumed } from "@/lib/audio/context";

function deriveLoop(room: RoomSnapshot | null): string | null {
  if (!room) return null;

  if (room.status === "lobby") return PHASE_LOOPS.lobby ?? null;
  if (room.status === "finished") return PHASE_LOOPS.finished ?? null;

  if (room.status === "playing" && room.currentPhase) {
    const basePhase = room.currentPhase.split("_")[0];
    return PHASE_LOOPS[basePhase] ?? null;
  }

  return null;
}

/**
 * Drives background music based on room state.
 * Call once in HostView — not in player views.
 */
export function useGameMusic(room: RoomSnapshot | null): void {
  // Preload loops as soon as room exists, then start the desired loop
  useEffect(() => {
    if (!room) return;
    const loopId = deriveLoop(room);
    preloadLoops(ALL_LOOP_IDS).then(() => {
      // Retry after preload — crossfadeTo deduplicates internally
      if (loopId) crossfadeTo(loopId);
    });
  }, [room != null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preload game-specific samples when game starts
  useEffect(() => {
    if (!room || room.status !== "playing" || !room.gameType) return;
    preloadSamples(SAMPLE_MANIFEST[room.gameType] ?? []);
  }, [room?.status, room?.gameType]);

  // Unlock AudioContext on first user interaction
  useEffect(() => {
    const handler = () => ensureResumed();
    document.addEventListener("click", handler, { once: true });
    return () => document.removeEventListener("click", handler);
  }, []);

  // Drive crossfade from room state
  useEffect(() => {
    crossfadeTo(deriveLoop(room));
  }, [room?.status, room?.currentPhase]);

  // Cleanup on unmount
  useEffect(() => () => stopMusic(), []);
}

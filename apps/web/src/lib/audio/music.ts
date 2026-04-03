/**
 * Background music loop manager.
 *
 * Plays one loop at a time with crossfade transitions.
 * Ducks (lowers volume) when SFX play.
 */

import { getAudioContext, ensureResumed, getMusicBus, loadAudioBuffer } from "./context";
import { initVolume } from "./volume";

const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<void>>();

let currentId: string | null = null;
let currentSrc: AudioBufferSourceNode | null = null;
let currentGain: GainNode | null = null;
let duckTimeout: ReturnType<typeof setTimeout> | null = null;

async function loadOne(id: string): Promise<void> {
  if (buffers.has(id)) return;
  const buf = await loadAudioBuffer(`/audio/loops/${id}.webm`);
  if (buf) buffers.set(id, buf);
  else loading.delete(id); // allow retry on transient failure
}

/** Preload a set of loops. Idempotent. */
export function preloadLoops(ids: string[]): Promise<void> {
  const tasks = ids.map((id) => {
    if (!loading.has(id)) loading.set(id, loadOne(id));
    return loading.get(id)!;
  });
  return Promise.all(tasks).then(() => {});
}

/**
 * Crossfade to a new loop (or silence if null).
 * If the same loop is already playing, this is a no-op.
 */
export function crossfadeTo(loopId: string | null, durationMs = 1000): void {
  if (loopId === currentId) return;

  const ac = getAudioContext();
  ensureResumed();
  initVolume();
  const now = ac.currentTime;
  const dur = durationMs / 1000;

  // Fade out current
  if (currentGain && currentSrc) {
    const oldGain = currentGain;
    const oldSrc = currentSrc;
    oldGain.gain.setValueAtTime(oldGain.gain.value, now);
    oldGain.gain.linearRampToValueAtTime(0, now + dur);
    setTimeout(() => {
      try { oldSrc.stop(); } catch { /* already stopped */ }
      oldSrc.disconnect();
      oldGain.disconnect();
    }, durationMs + 50);
  }

  currentSrc = null;
  currentGain = null;

  // Fade in new
  if (loopId) {
    const buf = buffers.get(loopId);
    if (!buf) { currentId = null; return; } // not loaded yet — allow retry

    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + dur);

    src.connect(gain).connect(getMusicBus());
    src.start();

    currentSrc = src;
    currentGain = gain;
  }

  currentId = loopId;
}

/** Stop all music immediately. */
export function stopMusic(): void {
  if (currentSrc) {
    try { currentSrc.stop(); } catch { /* already stopped */ }
    currentSrc.disconnect();
  }
  if (currentGain) currentGain.disconnect();
  currentSrc = null;
  currentGain = null;
  currentId = null;
}

/**
 * Temporarily duck music volume when SFX plays.
 * Ramps musicBus gain down then back up.
 */
export function duck(durationMs = 400): void {
  if (!currentId) return; // no music playing, nothing to duck
  try {
    const bus = getMusicBus();
    const ac = getAudioContext();
    const now = ac.currentTime;
    const rampDown = 0.05;
    const rampUp = durationMs / 1000;

    // Cancel any pending un-duck
    if (duckTimeout) {
      clearTimeout(duckTimeout);
      duckTimeout = null;
    }

    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(bus.gain.value, now);
    bus.gain.linearRampToValueAtTime(0.3, now + rampDown);

    duckTimeout = setTimeout(() => {
      const t = ac.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(1, t + rampUp);
      duckTimeout = null;
    }, durationMs);
  } catch {
    // AudioContext not ready
  }
}

/**
 * Phase-to-loop mapping. Values are loop file IDs (without extension).
 * Add entries as you add .webm files to public/audio/loops/.
 */
export const PHASE_LOOPS: Record<string, string | null> = {
  lobby: "lobby-chill",
  submit: "thinking-ambient",
  draw: "thinking-ambient",
  write: "thinking-ambient",
  clue: "thinking-ambient",
  guess: "thinking-ambient",
  vote: "suspense-low",
  present: "suspense-low",
  commit: "suspense-building",
  countdown: "suspense-building",
  reveal: "reveal-dramatic",
  scores: "celebration-soft",
  victory: "celebration-big",
  finished: "celebration-big",
};

/** All unique loop IDs referenced in PHASE_LOOPS. */
export const ALL_LOOP_IDS = [...new Set(Object.values(PHASE_LOOPS).filter(Boolean))] as string[];

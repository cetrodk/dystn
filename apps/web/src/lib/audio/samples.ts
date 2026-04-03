/**
 * Sample-based SFX — loads and plays audio files from /audio/sfx/.
 * Gracefully skips playback if a sample hasn't loaded yet.
 */

import { getAudioContext, ensureResumed, getSampleBus, loadAudioBuffer } from "./context";
import { initVolume } from "./volume";
import { duck } from "./music";

const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<void>>();

async function loadOne(id: string): Promise<void> {
  if (buffers.has(id)) return;
  const buf = await loadAudioBuffer(`/audio/sfx/${id}.webm`);
  if (buf) buffers.set(id, buf);
  else loading.delete(id); // allow retry on transient failure
}

/** Preload a set of samples. Idempotent — already-loaded IDs are skipped. */
export function preloadSamples(ids: string[]): Promise<void> {
  const tasks = ids.map((id) => {
    if (!loading.has(id)) loading.set(id, loadOne(id));
    return loading.get(id)!;
  });
  return Promise.all(tasks).then(() => {});
}

/** Play a preloaded sample. Silently skips if not yet loaded. */
export function playSample(id: string): void {
  const buf = buffers.get(id);
  if (!buf) return;
  try {
    const ac = getAudioContext();
    ensureResumed();
    initVolume();
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(getSampleBus());
    src.start();
    duck(400);
  } catch {
    // silent
  }
}

export function isSampleLoaded(id: string): boolean {
  return buffers.has(id);
}

/**
 * Per-game sample manifests.
 * Add sample IDs here as you add .webm files to public/audio/sfx/.
 */
export const SAMPLE_MANIFEST: Record<string, string[]> = {
  blitz: ["fanfare", "drumroll", "crowd-cheer"],
  fusk: ["fanfare", "drumroll", "crowd-cheer"],
  scrawl: ["fanfare", "drumroll", "crowd-cheer"],
  morph: ["fanfare", "drumroll"],
  surge: ["fanfare", "buzzer", "ding"],
  hunch: ["fanfare", "drumroll"],
};

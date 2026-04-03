/**
 * Shared AudioContext singleton and bus routing.
 *
 * All audio in the app routes through:
 *   AudioContext.destination
 *     └── masterGain
 *           ├── sfxBus     (synth oscillator SFX)
 *           ├── sampleBus  (sample-based SFX)
 *           └── musicBus   (background music loops)
 */

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let sample: GainNode | null = null;
let music: GainNode | null = null;

export function getAudioContext(): AudioContext {
  if (!ac) ac = new AudioContext();
  return ac;
}

export function ensureResumed(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") return ctx.resume();
  return Promise.resolve();
}

export function getMasterGain(): GainNode {
  if (!master) {
    const ctx = getAudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  return master;
}

function createBus(): GainNode {
  const ctx = getAudioContext();
  const node = ctx.createGain();
  node.connect(getMasterGain());
  return node;
}

export function getSfxBus(): GainNode {
  if (!sfx) sfx = createBus();
  return sfx;
}

export function getSampleBus(): GainNode {
  if (!sample) sample = createBus();
  return sample;
}

export function getMusicBus(): GainNode {
  if (!music) music = createBus();
  return music;
}

/** Fetch and decode an audio file. Returns null on failure (graceful degradation). */
export async function loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.arrayBuffer();
    return await getAudioContext().decodeAudioData(data);
  } catch {
    return null;
  }
}

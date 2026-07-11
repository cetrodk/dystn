/**
 * Volume state with localStorage persistence and pub/sub for React.
 */

import { getMasterGain, getAudioContext } from "./context";

const STORAGE_KEY_VOL = "dystn_volume";
const STORAGE_KEY_MUTE = "dystn_muted";

type Listener = (volume: number, muted: boolean) => void;

let volume = loadFloat(STORAGE_KEY_VOL, 0.8);
let muted = loadBool(STORAGE_KEY_MUTE, false);
const listeners = new Set<Listener>();

function loadFloat(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v != null) return Math.max(0, Math.min(1, parseFloat(v)));
  } catch { /* SSR / private browsing */ }
  return fallback;
}

function loadBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v != null) return v === "true";
  } catch { /* SSR / private browsing */ }
  return fallback;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY_VOL, String(volume));
    localStorage.setItem(STORAGE_KEY_MUTE, String(muted));
  } catch { /* quota / private browsing */ }
}

function applyGain() {
  try {
    const gain = getMasterGain();
    const ctx = getAudioContext();
    gain.gain.setValueAtTime(muted ? 0 : volume, ctx.currentTime);
  } catch { /* AudioContext not yet created — applied on first play */ }
}

// Stable snapshot reference — only replaced when values change
let snapshot = { volume, muted };

let persistTimer: ReturnType<typeof setTimeout> | undefined;

function notify() {
  snapshot = { volume, muted };
  // Debounce localStorage writes — audio gain is applied immediately
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, 300);
  for (const fn of listeners) fn(volume, muted);
}

// -- Public API --

export function getVolume(): number {
  return volume;
}

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (volume > 0) muted = false;
  applyGain();
  notify();
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  applyGain();
  notify();
}

/** Subscribe to volume/mute changes. Returns unsubscribe function. */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Stable snapshot for useSyncExternalStore — same reference when values unchanged. */
export function getSnapshot(): { volume: number; muted: boolean } {
  return snapshot;
}

// Apply initial gain when the AudioContext is first created.
// Deferred to avoid creating the AudioContext on module load.
let initialized = false;
export function initVolume() {
  if (initialized) return;
  initialized = true;
  applyGain();
}

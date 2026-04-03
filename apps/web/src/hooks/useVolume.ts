import { useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  setVolume,
  toggleMute,
} from "@/lib/audio/volume";

export function useVolume() {
  const { volume, muted } = useSyncExternalStore(subscribe, getSnapshot);
  return { volume, muted, setVolume, toggleMute };
}

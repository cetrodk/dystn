import { useSyncExternalStore } from "react";

/**
 * Swappable colour themes. Each theme is a `[data-theme]` block defined in
 * index.css; here we just track which one is active and persist the choice.
 */
export const THEMES = [
  { id: "tomato", label: "Tomat", swatch: "#e8553a" },
  { id: "cobalt", label: "Kobolt", swatch: "#2e6be6" },
  { id: "midnight", label: "Midnat", swatch: "#f2c14e" },
  { id: "mint", label: "Mynte", swatch: "#1e8e6b" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "festspil-theme";
const DEFAULT_THEME: ThemeId = "tomato";

const isValid = (v: string | null): v is ThemeId =>
  !!v && THEMES.some((t) => t.id === v);

export function getStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isValid(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

/** Apply a theme to <html>. Call once at startup (in main.tsx) to avoid FOUC. */
export function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
}

const listeners = new Set<() => void>();

export function setTheme(theme: ThemeId) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  applyTheme(theme);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ThemeId {
  const v = document.documentElement.dataset.theme;
  return isValid(v ?? null) ? (v as ThemeId) : DEFAULT_THEME;
}

/** React hook: current theme + setter. */
export function useTheme(): [ThemeId, (t: ThemeId) => void] {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_THEME);
  return [theme, setTheme];
}

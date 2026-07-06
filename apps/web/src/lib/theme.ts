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

/** Browser-chrome colour per theme (matches --color-bg in index.css). Kept in
 *  sync with the inline pre-paint script in index.html. */
const META_COLORS: Record<ThemeId, string> = {
  tomato: "#f3ecdc",
  cobalt: "#eae8f5",
  midnight: "#171622",
  mint: "#e6efe7",
};

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

/** Apply a theme to <html> and sync the browser-chrome meta colour. The initial
 *  pre-paint apply happens via the inline script in index.html; this keeps the
 *  app and the meta tag in sync on runtime switches. */
export function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", META_COLORS[theme]);
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

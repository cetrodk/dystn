// Blob-avatar traits. Holdes manuelt i sync med apps/party-server/src/avatar.ts
// (serveren validerer, klienten renderer).

export const AVATAR_PALETTE = [
  "#e8553a", // tomato
  "#2e6be6", // cobalt
  "#f2c14e", // mustard
  "#6bae5a", // grass
  "#9b7be8", // lavender
  "#e85a8a", // pink
  "#1e8e6b", // teal
  "#f48b3a", // orange
] as const;

export const TRAIT_COUNTS = {
  color: AVATAR_PALETTE.length,
  shape: 4,
  eyes: 5,
  mouth: 3,
  hat: 4,
} as const;

export interface AvatarTraits {
  shape: number;
  eyes: number;
  mouth: number;
  hat: number;
}

export interface AvatarSpec extends AvatarTraits {
  color: number;
}

export const hashStr = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/** Deterministisk fallback når en spiller ikke har valgt en avatar. */
export function traitsFromName(name: string): AvatarTraits {
  const h = hashStr(name);
  return {
    shape: h % TRAIT_COUNTS.shape,
    eyes: h % TRAIT_COUNTS.eyes,
    mouth: h % TRAIT_COUNTS.mouth,
    // Gamle hash brugte h % 5 med to "ingen hat"-værdier (0 og 4).
    hat: (h % 5) % TRAIT_COUNTS.hat,
  };
}

export function randomAvatar(): AvatarSpec {
  const pick = (n: number) => Math.floor(Math.random() * n);
  return {
    color: pick(TRAIT_COUNTS.color),
    shape: pick(TRAIT_COUNTS.shape),
    eyes: pick(TRAIT_COUNTS.eyes),
    mouth: pick(TRAIT_COUNTS.mouth),
    hat: pick(TRAIT_COUNTS.hat),
  };
}

const inRange = (v: unknown, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < max;

/** Validerer utrustet input (wire-beskeder, sessionStorage). */
export function sanitizeAvatarSpec(v: unknown): AvatarSpec | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (
    inRange(o.color, TRAIT_COUNTS.color) &&
    inRange(o.shape, TRAIT_COUNTS.shape) &&
    inRange(o.eyes, TRAIT_COUNTS.eyes) &&
    inRange(o.mouth, TRAIT_COUNTS.mouth) &&
    inRange(o.hat, TRAIT_COUNTS.hat)
  ) {
    return { color: o.color, shape: o.shape, eyes: o.eyes, mouth: o.mouth, hat: o.hat };
  }
  return null;
}

/** Parser en gemt avatar (JSON) — tolererer gamle PNG-nøgler og skrald. */
export function parseStoredAvatar(raw: string | null): AvatarSpec | null {
  if (!raw) return null;
  try {
    return sanitizeAvatarSpec(JSON.parse(raw));
  } catch {
    return null;
  }
}

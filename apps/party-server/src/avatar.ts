// Blob-avatar traits. Holdes manuelt i sync med apps/web/src/lib/avatar.ts
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

const inRange = (v: unknown, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < max;

/** Validerer utrustet input fra klienter. */
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

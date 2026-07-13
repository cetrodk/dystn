import { AVATAR_PALETTE } from "./avatar";

/**
 * First color not already in use. Indexing by players.length gives duplicates
 * after a leave/kick followed by a new join.
 */
export function getAvatarColor(usedColors: readonly string[]): string {
  const free = AVATAR_PALETTE.find((c) => !usedColors.includes(c));
  return free ?? AVATAR_PALETTE[usedColors.length % AVATAR_PALETTE.length];
}

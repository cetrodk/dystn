/** 12 distinct avatar colors */
const AVATAR_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12",
  "#9b59b6", "#1abc9c", "#e91e63", "#00bcd4",
  "#ff9800", "#8bc34a", "#ff5722", "#607d8b",
];

/**
 * First color not already in use. Indexing by players.length gives duplicates
 * after a leave/kick followed by a new join.
 */
export function getAvatarColor(usedColors: readonly string[]): string {
  const free = AVATAR_COLORS.find((c) => !usedColors.includes(c));
  return free ?? AVATAR_COLORS[usedColors.length % AVATAR_COLORS.length];
}

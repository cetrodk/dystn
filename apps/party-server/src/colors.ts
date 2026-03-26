/** 12 distinct avatar colors, assigned in join order */
const AVATAR_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12",
  "#9b59b6", "#1abc9c", "#e91e63", "#00bcd4",
  "#ff9800", "#8bc34a", "#ff5722", "#607d8b",
];

export function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

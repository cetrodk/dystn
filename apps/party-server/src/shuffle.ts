/**
 * Fisher-Yates shuffle. `arr.sort(() => Math.random() - 0.5)` is biased (and
 * mutates in place) — answer order and drawing order should be uniformly
 * random so position carries no information.
 */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Ubestemte og bestemte artikler, der må stå foran et ord uden at ændre det. */
const LEADING_ARTICLES = new Set(["en", "et", "den", "det", "de"]);

/**
 * Normalisér en fritekst til sammenligning: små bogstaver, tegnsætning væk,
 * whitespace normaliseret, og en indledende artikel fjernet.
 *
 * "En Hund!"  → "hund"
 * "  hund  "  → "hund"
 * "en"        → "en"   (artiklen fjernes kun, hvis der står noget efter den)
 */
export function normalizeText(input: string): string {
  const words = input
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length > 1 && LEADING_ARTICLES.has(words[0])) words.shift();
  return words.join(" ");
}

/**
 * Levenshtein-afstand, afkortet: returnerer max + 1, så snart afstanden ikke
 * kan komme under grænsen — mere skal kalderen ikke bruge.
 */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Er gættet reelt det samme som facit? Bruges KUN til at afvise en "løgn", der i
 * virkeligheden er sandheden. Her er det trygt at være large: rammer vi ved siden af,
 * bliver spilleren blot bedt om at skrive noget andet.
 */
export function isEffectivelySameWord(guess: string, truth: string): boolean {
  const g = normalizeText(guess);
  const t = normalizeText(truth);
  if (!g || !t) return false;
  if (g === t) return true;
  // Én tastefejl tæller som samme ord — men kun på ord lange nok til, at to
  // forskellige ord ikke ligger 1 tegn fra hinanden ("kat"/"kap", "ko"/"ko").
  return t.length >= 6 && g.length >= 6 && levenshtein(g, t, 1) <= 1;
}

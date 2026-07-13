/**
 * Delte testvektorer for licensmodulet. Kører mod BEGGE bevidst duplikerede
 * kopier (src/license.ts og api/_license.ts) i license.test.ts — det er
 * sync-mekanismen fra docs/license-flow-design.md §1.
 *
 * TEST_SECRET er bevidst offentlig og må ALDRIG deployes som rigtig secret.
 * Samme literal injiceres i dev/e2e via `partykit dev --var LICENSE_SECRET_V1=...`.
 */

export const TEST_SECRET = "dystn-test-secret-0123456789abcdef0123456789abcdef";

/** Stripe-session-id'et bag den frosne vektor. */
export const VECTOR_SESSION_ID = "cs_test_vector_001";

/**
 * Frossen forventet kode for (v1, ["pack1"], serialForSession(TEST_SECRET, VECTOR_SESSION_ID)).
 * Beregnet én gang med tsx og hardkodet — ændrer modulet output, er det et BRUD.
 */
export const VECTOR_CODE = "040V4F-P41YC0-45RCV8-6Z341G";
export const VECTOR_SERIAL_HEX = "b23ec40f98";
export const VECTOR_PACKS = ["pack1"];

/** Kanonisk form (uden bindestreger) af VECTOR_CODE. */
export const VECTOR_CANONICAL = VECTOR_CODE.replace(/-/g, "");

/** Normaliserings-par: input → forventet kanonisk form (O→0, I/L→1, case, whitespace). */
export const NORMALIZE_PAIRS: Array<[string, string]> = [
  [VECTOR_CODE, VECTOR_CANONICAL],
  [VECTOR_CODE.toLowerCase(), VECTOR_CANONICAL],
  [" 040v4f p41yc0 45rcv8 6z341g ", VECTOR_CANONICAL],
  // O→0 og I/L→1 (vektoren indeholder 0'er og 1'er, så aliasserne rammer)
  [VECTOR_CODE.replace(/0/g, "O").replace(/1/g, "I"), VECTOR_CANONICAL],
  [VECTOR_CODE.replace(/1/g, "l"), VECTOR_CANONICAL],
];

/** Input der skal normalisere til null (forkert længde/alfabet). */
export const BAD_FORMAT_INPUTS = [
  "",
  "ABC",
  VECTOR_CANONICAL.slice(0, 23), // 23 tegn
  VECTOR_CANONICAL + "0", // 25 tegn
  VECTOR_CANONICAL.slice(0, 23) + "U", // U er ikke i Crockford-alfabetet
  VECTOR_CANONICAL.slice(0, 23) + "!", // ulovligt tegn
];

/** Gyldigt format men ugyldig signatur: sidste tegn flippet (G→H). */
export const FLIPPED_CODE = VECTOR_CANONICAL.slice(0, 23) + (VECTOR_CANONICAL.endsWith("G") ? "H" : "G");

// Midlertidig launch-gate: når VITE_LAUNCH_GATE="true" i build-miljøet
// viser appen kun info-/landingssiden. Adgang før launch sker via
// "Jeg har en kode" på gate-siden: en licens-/gavekode i gyldigt format
// gemmes som licens OG låser gaten op (huskes i localStorage, så koden
// kun skal tastes én gang pr. browser). Formatcheck er nok her — gaten
// er blød, og selve spiloplåsningen dømmes stadig af serverens signatur.

const BYPASS_KEY = "dystn-gate-bypass";

export function isGateActive(): boolean {
  if (import.meta.env.VITE_LAUNCH_GATE !== "true") return false;
  try {
    return localStorage.getItem(BYPASS_KEY) !== "1";
  } catch {
    return true;
  }
}

/** Låser gaten op permanent for denne browser. */
export function unlockGate() {
  try {
    localStorage.setItem(BYPASS_KEY, "1");
  } catch {
    // localStorage utilgængelig (fx privat browsing) — oplåsningen kan
    // ikke huskes; brugeren må taste koden igen næste gang.
  }
}

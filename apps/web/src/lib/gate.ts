import { LICENSE_STORAGE_KEY } from "./license";

// Midlertidig launch-gate: når VITE_LAUNCH_GATE="true" i build-miljøet
// viser appen kun info-/landingssiden. Adgang før launch sker via
// "Jeg har en kode" på gate-siden: en licens-/gavekode i gyldigt format
// låser gaten op (huskes i localStorage). En allerede gemt licens tæller
// også som oplåst — en kunde må aldrig mødes af "vi åbner snart".
// Formatcheck er nok her — gaten er blød, og selve spiloplåsningen
// dømmes stadig af serverens signatur.

const BYPASS_KEY = "dystn-gate-bypass";

export function isGateActive(): boolean {
  if (import.meta.env.VITE_LAUNCH_GATE !== "true") return false;
  try {
    if (localStorage.getItem(LICENSE_STORAGE_KEY)) return false;
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
    // localStorage utilgængelig (fx blokeret storage) — kan ikke huskes på
    // tværs af besøg. Oplåsningen virker stadig i denne session, fordi
    // App holder gate-tilstanden i React-state og aldrig reloader.
  }
}

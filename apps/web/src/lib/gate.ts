// Midlertidig launch-gate: når VITE_LAUNCH_GATE="true" i build-miljøet
// viser appen kun info-/landingssiden. Besøg en vilkårlig URL med
// "?adgang" (fx dystn.app/?adgang) for at låse denne browser op — valget
// huskes i localStorage, så gaten kan slås til/fra uden at ramme os selv.

const BYPASS_KEY = "dystn-gate-bypass";

export function isGateActive(): boolean {
  if (import.meta.env.VITE_LAUNCH_GATE !== "true") return false;
  try {
    if (new URLSearchParams(window.location.search).has("adgang")) {
      localStorage.setItem(BYPASS_KEY, "1");
      return false;
    }
    return localStorage.getItem(BYPASS_KEY) !== "1";
  } catch {
    return true;
  }
}

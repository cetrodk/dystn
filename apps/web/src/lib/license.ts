import { partyRoomHttpUrl } from "./partyHost";

/**
 * Den gemte licenskode. Slettes ALDRIG automatisk — kun den eksplicitte
 * "Lånt enhed? Glem licensen her"-knap i HostSettings må fjerne den (en
 * fejlkonfigureret server må ikke kunne slette kundens eneste kopi).
 */
export const LICENSE_STORAGE_KEY = "dystn_license";

export function getStoredLicense(): string | null {
  try {
    return localStorage.getItem(LICENSE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredLicense(code: string) {
  try {
    localStorage.setItem(LICENSE_STORAGE_KEY, code);
  } catch {
    // private mode uden storage — koden står stadig i mailen/på /tak
  }
}

export function clearStoredLicense() {
  try {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Udestående indløsninger, hvis kode skal huskes ved ok-svar. Modul-niveau
 * frem for komponent-state: afsenderen (modal/settings-fane) kan unmountes
 * før serverens svar ankommer, og koden må ikke gå tabt af den grund.
 * Forbruges af LicensePersistence i HostLayout via licenseResult.requestId.
 */
const redeemsToRemember = new Map<string, string>();

export function newRedeemRequestId(): string {
  return crypto.randomUUID();
}

export function trackRedeemForStorage(requestId: string, code: string) {
  redeemsToRemember.set(requestId, code);
}

export function takeRedeemForStorage(requestId: string): string | null {
  const code = redeemsToRemember.get(requestId) ?? null;
  redeemsToRemember.delete(requestId);
  return code;
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Ren format-validering før afsendelse — spejler serverens normalizeCode
 * (uppercase, strip bindestreger/whitespace, O→0, I/L→1, 24 Crockford-tegn)
 * men uden crypto: signaturen dømmer serveren.
 */
export function normalizeLicenseInput(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[-\s]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (cleaned.length !== 24) return null;
  for (const ch of cleaned) {
    if (!CROCKFORD.includes(ch)) return null;
  }
  return cleaned;
}

export type RedeemHttpResult =
  | { ok: true; packs: string[] }
  | { ok: false; reason: "invalid" | "rateLimited" | "denylisted" | "roomNotFound" | "network" };

/** Cross-device-indløsning: POST koden direkte til rummets DO (fra /tak). */
export async function redeemViaHttp(roomCode: string, code: string): Promise<RedeemHttpResult> {
  try {
    const res = await fetch(partyRoomHttpUrl(roomCode), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.status === 404) return { ok: false, reason: "roomNotFound" };
    if (!res.ok) return { ok: false, reason: "network" };
    const body = (await res.json()) as
      | { ok: true; packs: string[] }
      | { ok: false; reason?: "invalid" | "rateLimited" | "denylisted" };
    if (body.ok) return { ok: true, packs: body.packs };
    return { ok: false, reason: body.reason ?? "invalid" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

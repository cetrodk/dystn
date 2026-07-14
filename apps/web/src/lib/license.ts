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

/** Kanonisk 24-tegns kode → XXXXXX-XXXXXX-XXXXXX-XXXXXX til visning/lagring. */
export function withDashes(canonical: string): string {
  return canonical.replace(/(.{6})(?=.)/g, "$1-");
}

const stripCodeChars = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, "");

/**
 * Live-formatering af kodeinput, mens der tastes: uppercase, kun A–Z/0–9,
 * grupper à 6 med bindestreger. Den hængende bindestreg efter en netop
 * fuldendt gruppe tilføjes kun, når inputtet voksede — ellers ville
 * backspace hen over en bindestreg sidde fast (slet streg → reformatér →
 * streg igen).
 */
export function formatLicenseInputLive(value: string, previous: string): string {
  const cleaned = stripCodeChars(value).slice(0, 24);
  const grouped = withDashes(cleaned);
  const grew = cleaned.length > stripCodeChars(previous).length;
  if (grew && cleaned.length < 24 && cleaned.length % 6 === 0) {
    return grouped + "-";
  }
  return grouped;
}

/** Indeks i den formaterede streng lige efter n kodetegn (og en evt. bindestreg). */
function caretAfterCodeChars(formatted: string, n: number): number {
  if (n <= 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] === "-") continue;
    count++;
    if (count === n) {
      return formatted[i + 1] === "-" ? i + 2 : i + 1;
    }
  }
  return formatted.length;
}

/**
 * onChange-håndtering for kodefelter: formaterer feltets værdi og lægger
 * markøren tilbage, hvor brugeren redigerede — omgrupperingen flytter ellers
 * markøren til slutningen (React sætter value, browseren kollapser
 * selektionen), så tastefejl midt i koden ikke kan rettes på stedet.
 */
export function formatLicenseInputEvent(el: HTMLInputElement, previous: string): string {
  const caret = el.selectionStart ?? el.value.length;
  const codeCharsBeforeCaret = stripCodeChars(el.value.slice(0, caret)).length;
  const next = formatLicenseInputLive(el.value, previous);
  const pos = caretAfterCodeChars(next, codeCharsBeforeCaret);
  requestAnimationFrame(() => el.setSelectionRange(pos, pos));
  return next;
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

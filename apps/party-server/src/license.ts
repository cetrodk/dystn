/**
 * Dystn licenskode-modul — stateless HMAC-signerede koder (se docs/license-flow-design.md §1).
 *
 * Kodeformat:
 *   payload = version(1 byte) | packs-bitmask(1 byte) | serial(5 bytes)
 *   sig     = HMAC-SHA256(K_sign, payload)[0..7]
 *   kode    = CROCKFORD-BASE32(payload | sig)   → 15 bytes = 24 tegn, vises som 4×6 med bindestreger
 *
 * Subkeys (domain separation): K_sign = HMAC(secret, "dystn:sign"),
 * K_serial = HMAC(secret, "dystn:serial") — serial-afledning og signering deler aldrig nøgle.
 *
 * VIGTIGT: Denne fil findes i to bevidst duplikerede, byte-identiske kopier:
 *   apps/party-server/src/license.ts   (workerd)
 *   api/_license.ts                    (Vercel Node)
 * Ret ALDRIG den ene uden den anden — test/license.test.ts kører samme
 * vektorsuite mod begge og asserter output-lighed. Kun WebCrypto, nul imports.
 */

/** Kendte pakker → bit i packs-bitmasken. Nye pakker tilføjes her (og KUN her). */
export const PACK_BITS: Record<string, number> = { pack1: 1 << 0 };

/** Crockford base32: udelader I/L/O/U så koder kan afskrives fra en mail uden forvekslinger. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_CHARS = 24; // 15 bytes = 120 bits = 24 × 5 bits
const CODE_BYTES = 15;

const te = new TextEncoder();

/**
 * Normalisér bruger-input til den kanoniske 24-tegns form: uppercase, strip
 * bindestreger/whitespace, O→0 og I/L→1 (Crockford-aliasser). Returnerer null
 * hvis resultatet ikke er præcis 24 gyldige Crockford-tegn.
 */
export function normalizeCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[-\s]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (cleaned.length !== CODE_CHARS) return null;
  for (const ch of cleaned) {
    if (!ALPHABET.includes(ch)) return null;
  }
  return cleaned;
}

export function crockfordEncode(bytes: Uint8Array): string {
  let bits = 0;
  let acc = 0;
  let out = "";
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(acc << (5 - bits)) & 31];
  return out;
}

/** Forventer kanonisk form (fra normalizeCode); kaster på ulovlige tegn. */
export function crockfordDecode(canonical: string): Uint8Array<ArrayBuffer> {
  let bits = 0;
  let acc = 0;
  const out: number[] = [];
  for (const ch of canonical) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Ugyldigt tegn i licenskode");
    acc = (acc << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((acc >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** Kanonisk 24-tegns kode → visningsform XXXXXX-XXXXXX-XXXXXX-XXXXXX. */
export function formatCode(canonical: string): string {
  return canonical.replace(/(.{6})(?=.)/g, "$1-");
}

async function hmacSha256(
  keyBytes: Uint8Array<ArrayBuffer>,
  data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}

async function importHmacKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function deriveKeys(secret: string): Promise<{ signKey: CryptoKey; serialKey: CryptoKey }> {
  const secretBytes = te.encode(secret);
  const [signRaw, serialRaw] = await Promise.all([
    hmacSha256(secretBytes, te.encode("dystn:sign")),
    hmacSha256(secretBytes, te.encode("dystn:serial")),
  ]);
  const [signKey, serialKey] = await Promise.all([importHmacKey(signRaw), importHmacKey(serialRaw)]);
  return { signKey, serialKey };
}

/** Deterministisk 5-byte serial for en Stripe checkout-session (idempotent genudstedelse). */
export async function serialForSession(
  secret: string,
  stripeSessionId: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const { serialKey } = await deriveKeys(secret);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", serialKey, te.encode(stripeSessionId)));
  return mac.slice(0, 5);
}

/** Udsted en formateret licenskode. Kaster på ukendt pakke, ugyldig version eller forkert serial-længde. */
export async function issueLicense(
  secret: string,
  version: number,
  packs: string[],
  serial: Uint8Array,
): Promise<string> {
  if (!Number.isInteger(version) || version < 1 || version > 255) {
    throw new Error(`Ugyldig licensversion: ${version}`);
  }
  if (serial.length !== 5) throw new Error("Serial skal være 5 bytes");
  if (packs.length === 0) throw new Error("Mindst én pakke kræves");
  let mask = 0;
  for (const pack of packs) {
    const bit = PACK_BITS[pack];
    if (bit === undefined) throw new Error(`Ukendt pakke: ${pack}`);
    mask |= bit;
  }

  const payload = new Uint8Array(7);
  payload[0] = version;
  payload[1] = mask;
  payload.set(serial, 2);

  const { signKey } = await deriveKeys(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", signKey, payload)).slice(0, 8);

  const codeBytes = new Uint8Array(CODE_BYTES);
  codeBytes.set(payload, 0);
  codeBytes.set(sig, 7);
  return formatCode(crockfordEncode(codeBytes));
}

export type VerifyResult =
  | { ok: true; packs: string[]; serialHex: string }
  | { ok: false; reason: "invalid" | "denylisted" };

/**
 * Verificér en kode mod nøgleringen. Fail-closed: tom keyring, ukendt version,
 * signatur-mismatch og nul kendte pakker giver alle "invalid". Ukendte
 * pakke-bits ignoreres (en fremtidig pakke gør ikke gamle servere sure).
 */
export async function verifyLicense(
  input: string,
  keyring: Map<number, string>,
  denylist?: Set<string>,
): Promise<VerifyResult> {
  const canonical = normalizeCode(input);
  if (!canonical) return { ok: false, reason: "invalid" };

  const bytes = crockfordDecode(canonical);
  const version = bytes[0];
  const secret = keyring.get(version);
  if (!secret) return { ok: false, reason: "invalid" };

  const payload = bytes.slice(0, 7);
  const sig = bytes.slice(7, CODE_BYTES);
  const { signKey } = await deriveKeys(secret);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", signKey, payload)).slice(0, 8);

  // Constant-time XOR-fold: subtle.verify kan ikke bruges med trunkeret tag,
  // og en tidlig-exit-sammenligning ville lække match-længden.
  let diff = 0;
  for (let i = 0; i < 8; i++) diff |= sig[i] ^ expected[i];
  if (diff !== 0) return { ok: false, reason: "invalid" };

  const mask = bytes[1];
  const packs = Object.entries(PACK_BITS)
    .filter(([, bit]) => (mask & bit) !== 0)
    .map(([name]) => name);
  if (packs.length === 0) return { ok: false, reason: "invalid" };

  const serialHex = Array.from(bytes.slice(2, 7), (b) => b.toString(16).padStart(2, "0")).join("");
  if (denylist?.has(serialHex)) return { ok: false, reason: "denylisted" };

  return { ok: true, packs, serialHex };
}

/** Byg nøgleringen fra env (LICENSE_SECRET_V<N>). Tom map ⇒ al validering fejler (fail closed). */
export function keyringFromEnv(env: Record<string, unknown>): Map<number, string> {
  const ring = new Map<number, string>();
  for (const [key, value] of Object.entries(env)) {
    const m = /^LICENSE_SECRET_V(\d+)$/.exec(key);
    if (m && typeof value === "string" && value.length > 0) {
      ring.set(Number(m[1]), value);
    }
  }
  return ring;
}

/** LICENSE_DENYLIST = kommaseparerede serial-hex-værdier (fra reissue-CLI'en). */
export function denylistFromEnv(env: Record<string, unknown>): Set<string> {
  const raw = env["LICENSE_DENYLIST"];
  if (typeof raw !== "string") return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Højeste version i nøgleringen — den der udstedes med. Kaster på tom keyring. */
export function currentVersion(keyring: Map<number, string>): number {
  let max = 0;
  for (const v of keyring.keys()) if (v > max) max = v;
  if (max === 0) throw new Error("Licens-nøgleringen er tom (ingen LICENSE_SECRET_V*)");
  return max;
}

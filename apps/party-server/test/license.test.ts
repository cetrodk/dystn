import { describe, expect, it } from "vitest";
import * as serverCopy from "../src/license";
import * as apiCopy from "../../../api/_license";
import {
  BAD_FORMAT_INPUTS,
  FLIPPED_CODE,
  NORMALIZE_PAIRS,
  TEST_SECRET,
  VECTOR_CANONICAL,
  VECTOR_CODE,
  VECTOR_PACKS,
  VECTOR_SERIAL_HEX,
  VECTOR_SESSION_ID,
} from "./license.vectors";

type LicenseModule = typeof serverCopy;

const KEYRING = new Map([[1, TEST_SECRET]]);

/** Uafhængig re-implementering af signeringen — fanger fejl i modulets egen afledning. */
async function rawSign(secret: string, payload: Uint8Array): Promise<Uint8Array> {
  const te = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw",
    te.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signRaw = new Uint8Array(await crypto.subtle.sign("HMAC", secretKey, te.encode("dystn:sign")));
  const signKey = await crypto.subtle.importKey(
    "raw",
    signRaw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", signKey, payload)).slice(0, 8);
}

/** Håndbygget kode med vilkårlig bitmask (issueLicense afviser selv ukendte pakker). */
async function craftCode(mod: LicenseModule, version: number, mask: number): Promise<string> {
  const payload = new Uint8Array(7);
  payload[0] = version;
  payload[1] = mask;
  payload.set([1, 2, 3, 4, 5], 2);
  const sig = await rawSign(TEST_SECRET, payload);
  const bytes = new Uint8Array(15);
  bytes.set(payload, 0);
  bytes.set(sig, 7);
  return mod.formatCode(mod.crockfordEncode(bytes));
}

function runSuite(name: string, mod: LicenseModule) {
  describe(name, () => {
    it("udsteder den frosne vektorkode", async () => {
      const serial = await mod.serialForSession(TEST_SECRET, VECTOR_SESSION_ID);
      expect(Array.from(serial, (b) => b.toString(16).padStart(2, "0")).join("")).toBe(VECTOR_SERIAL_HEX);
      const code = await mod.issueLicense(TEST_SECRET, 1, ["pack1"], serial);
      expect(code).toBe(VECTOR_CODE);
    });

    it("verificerer den frosne vektorkode", async () => {
      const result = await mod.verifyLicense(VECTOR_CODE, KEYRING);
      expect(result).toEqual({ ok: true, packs: VECTOR_PACKS, serialHex: VECTOR_SERIAL_HEX });
    });

    it("normaliserer aliasser og formatstøj", () => {
      for (const [input, expected] of NORMALIZE_PAIRS) {
        expect(mod.normalizeCode(input), `input: ${JSON.stringify(input)}`).toBe(expected);
      }
    });

    it("afviser forkert længde/alfabet som null", () => {
      for (const input of BAD_FORMAT_INPUTS) {
        expect(mod.normalizeCode(input), `input: ${JSON.stringify(input)}`).toBeNull();
      }
    });

    it("afviser flippet tegn (signatur-mismatch)", async () => {
      expect(await mod.verifyLicense(FLIPPED_CODE, KEYRING)).toEqual({ ok: false, reason: "invalid" });
    });

    it("afviser ukendt version", async () => {
      const serial = await mod.serialForSession(TEST_SECRET, VECTOR_SESSION_ID);
      const v2 = await mod.issueLicense(TEST_SECRET, 2, ["pack1"], serial);
      expect(await mod.verifyLicense(v2, KEYRING)).toEqual({ ok: false, reason: "invalid" });
      // ... men accepterer den, når v2 er i nøgleringen
      const ring = new Map([[1, TEST_SECRET], [2, TEST_SECRET]]);
      expect((await mod.verifyLicense(v2, ring)).ok).toBe(true);
    });

    it("afviser tom nøglering (fail closed)", async () => {
      expect(await mod.verifyLicense(VECTOR_CODE, new Map())).toEqual({ ok: false, reason: "invalid" });
    });

    it("afviser gyldig signatur med nul kendte pakker", async () => {
      const unknownBitsOnly = await craftCode(mod, 1, 0b1000_0000);
      expect(await mod.verifyLicense(unknownBitsOnly, KEYRING)).toEqual({ ok: false, reason: "invalid" });
    });

    it("ignorerer ukendte pakke-bits ved siden af kendte", async () => {
      const mixed = await craftCode(mod, 1, 0b1000_0001);
      const result = await mod.verifyLicense(mixed, KEYRING);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.packs).toEqual(["pack1"]);
    });

    it("afviser denylisted serial med egen reason", async () => {
      const denylist = new Set([VECTOR_SERIAL_HEX]);
      expect(await mod.verifyLicense(VECTOR_CODE, KEYRING, denylist)).toEqual({
        ok: false,
        reason: "denylisted",
      });
    });

    it("formatCode indsætter bindestreger pr. 6 tegn", () => {
      expect(mod.formatCode(VECTOR_CANONICAL)).toBe(VECTOR_CODE);
    });

    it("keyringFromEnv/denylistFromEnv/currentVersion", () => {
      const ring = mod.keyringFromEnv({
        LICENSE_SECRET_V1: "a",
        LICENSE_SECRET_V3: "c",
        LICENSE_SECRET_VX: "nej",
        LICENSE_SECRET_V2: 42, // ikke-string ignoreres
        OTHER: "x",
      });
      expect([...ring.entries()].sort()).toEqual([
        [1, "a"],
        [3, "c"],
      ]);
      expect(mod.currentVersion(ring)).toBe(3);
      expect(() => mod.currentVersion(new Map())).toThrow();

      expect(mod.denylistFromEnv({ LICENSE_DENYLIST: " AB12, cd34 ,," })).toEqual(
        new Set(["ab12", "cd34"]),
      );
      expect(mod.denylistFromEnv({})).toEqual(new Set());
    });
  });
}

runSuite("src/license.ts (party-server)", serverCopy);
runSuite("api/_license.ts (Vercel)", apiCopy);

describe("kopi-sync", () => {
  it("de to kopier giver identisk output for issue/verify/normalize", async () => {
    const serial = await serverCopy.serialForSession(TEST_SECRET, "cs_test_sync_check");
    const a = await serverCopy.issueLicense(TEST_SECRET, 1, ["pack1"], serial);
    const b = await apiCopy.issueLicense(TEST_SECRET, 1, ["pack1"], serial);
    expect(a).toBe(b);
    expect(await serverCopy.verifyLicense(a, KEYRING)).toEqual(await apiCopy.verifyLicense(b, KEYRING));
    expect(serverCopy.normalizeCode(a)).toBe(apiCopy.normalizeCode(b));
  });
});

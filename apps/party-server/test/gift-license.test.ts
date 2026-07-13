import { describe, expect, it } from "vitest";
import { currentVersion, issueLicense, keyringFromEnv, verifyLicense } from "../../../api/_license";
import { TEST_SECRET } from "./license.vectors";

// Gavekode-flowet (scripts/issue-gift-license.ts): vilkårlig serial i stedet
// for en session-afledt — koden skal verificere identisk med købte koder.
describe("gavekoder", () => {
  const env = { LICENSE_SECRET_V1: TEST_SECRET };
  const keyring = keyringFromEnv(env);
  const serial = new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89]);
  const serialHex = "0123456789";

  it("vilkårlig serial → gyldig pack1-kode med matchende serialHex", async () => {
    const version = currentVersion(keyring);
    const code = await issueLicense(TEST_SECRET, version, ["pack1"], serial);
    const result = await verifyLicense(code, keyring);
    expect(result).toEqual({ ok: true, packs: ["pack1"], serialHex });
  });

  it("serialHex i denylisten spærrer gavekoden", async () => {
    const code = await issueLicense(TEST_SECRET, currentVersion(keyring), ["pack1"], serial);
    const denied = await verifyLicense(code, keyring, new Set([serialHex]));
    expect(denied).toEqual({ ok: false, reason: "denylisted" });
  });
});

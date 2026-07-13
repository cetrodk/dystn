/**
 * Udsted gavekoder (venner/familie, giveaways) — kræver KUN LICENSE_SECRET_V*,
 * ingen Stripe. Serial er tilfældig, modsat reissue-license.ts der afleder den
 * deterministisk af en betalt Stripe-session.
 *
 *   LICENSE_SECRET_V1=... npx tsx scripts/issue-gift-license.ts --count 10
 *
 * GEM output-listen (kode ↔ modtager ↔ serialHex) privat — aldrig i repoet.
 * serialHex er værdien til LICENSE_DENYLIST, hvis en kode lækkes.
 */
import { currentVersion, issueLicense, keyringFromEnv } from "../api/_license";

function fail(message: string): never {
  console.error(`FEJL: ${message}`);
  process.exit(1);
}

function parseCount(argv: string[]): number {
  const idx = argv.indexOf("--count");
  if (idx === -1) return 1;
  const count = Number(argv[idx + 1]);
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    fail("--count skal være et heltal mellem 1 og 100");
  }
  return count;
}

// Ingen top-level await: tsx kører scripts/ som CJS (repo-roden er ikke ESM)
async function main() {
  const count = parseCount(process.argv.slice(2));

  const keyring = keyringFromEnv(process.env as Record<string, string | undefined>);
  if (keyring.size === 0) fail("LICENSE_SECRET_V* mangler i env");
  const version = currentVersion(keyring);
  const secret = keyring.get(version)!;

  for (let i = 0; i < count; i++) {
    const serial = crypto.getRandomValues(new Uint8Array(5));
    const code = await issueLicense(secret, version, ["pack1"], serial);
    const serialHex = Array.from(serial, (b) => b.toString(16).padStart(2, "0")).join("");
    console.log(`${code}  serialHex=${serialHex}`);
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));

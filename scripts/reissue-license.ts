/**
 * Genudsted en licenskode fra en Stripe checkout-session (support-flowet:
 * kunde har mistet mail + kode; session-id findes i Stripe-dashboardet).
 *
 *   STRIPE_SECRET_KEY=sk_live_... LICENSE_SECRET_V1=... \
 *     npx tsx scripts/reissue-license.ts cs_live_...
 *
 * Udstedelsen er deterministisk (serial = HMAC af session-id), så output er
 * ALTID samme kode som kunden oprindeligt fik. serialHex er værdien til
 * LICENSE_DENYLIST ved misbrug.
 */
import { buildCodeForSession, classifySession, fetchCheckoutSession } from "../api/_stripe";

function fail(message: string): never {
  console.error(`FEJL: ${message}`);
  process.exit(1);
}

// Ingen top-level await: tsx kører scripts/ som CJS (repo-roden er ikke ESM)
async function main() {
  const sessionId = process.argv[2];
  if (!sessionId || !/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
    fail("Brug: npx tsx scripts/reissue-license.ts <cs_...session-id>");
  }

  const env = process.env as Record<string, string | undefined>;
  const secretKey = env.STRIPE_SECRET_KEY;
  if (!secretKey) fail("STRIPE_SECRET_KEY mangler i env");
  if (!Object.keys(env).some((k) => /^LICENSE_SECRET_V\d+$/.test(k))) {
    fail("LICENSE_SECRET_V* mangler i env");
  }

  const session = await fetchCheckoutSession(sessionId, secretKey);
  if (!session) fail(`Ukendt session: ${sessionId} (forkert miljø? sk_test vs sk_live)`);

  const status = classifySession(session, secretKey);
  if (status !== "paid") {
    fail(`Sessionen er ikke betalt (status: ${status}) — der udstedes ikke koder for den`);
  }

  const { code, packs, serialHex, version } = await buildCodeForSession(session, env);
  console.log(`Kode:      ${code}`);
  console.log(`Pakker:    ${packs.join(", ")}`);
  console.log(`Version:   v${version}`);
  console.log(`serialHex: ${serialHex}   (denylist-værdien ved misbrug)`);
  console.log(`Mail:      ${session.customer_details?.email ?? "(ukendt)"}`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));

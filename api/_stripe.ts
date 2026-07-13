/**
 * Stripe-hjælpere for licens-udstedelsen (underscore ⇒ ikke en Vercel-route).
 * Rå fetch mod Stripe API — ingen npm-dependency. Deles af api/license.ts,
 * api/stripe-webhook.ts og scripts/reissue-license.ts.
 */
import { currentVersion, issueLicense, keyringFromEnv, serialForSession } from "./_license";

export interface StripeSession {
  id: string;
  mode?: string;
  livemode?: boolean;
  status?: string; // open | complete | expired
  payment_status?: string; // paid | unpaid | no_payment_required
  customer_details?: { email?: string | null } | null;
  line_items?: { data?: Array<{ price?: { id?: string } | null }> } | null;
}

/** Henter sessionen med expand=line_items (line items er IKKE med uden expand). Null = ukendt session. */
export async function fetchCheckoutSession(
  sessionId: string,
  secretKey: string,
): Promise<StripeSession | null> {
  const url = `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${secretKey}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Stripe svarede ${res.status}`);
  return (await res.json()) as StripeSession;
}

export type SessionStatus = "paid" | "pending" | "not_completed";

/**
 * Invarianter (spec §2): mode skal være "payment", og livemode skal matche
 * nøglen — test- og live-sessions må aldrig kunne forveksles tavst. Brud ⇒
 * throw (bliver 500 uden detaljer).
 */
export function classifySession(session: StripeSession, secretKey: string): SessionStatus {
  if (session.mode !== "payment") throw new Error("Uventet session-mode");
  const expectLive = secretKey.startsWith("sk_live_");
  if (session.livemode !== expectLive) throw new Error("Livemode-mismatch");
  if (session.status === "open" || session.status === "expired") return "not_completed";
  if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
    return "paid";
  }
  return "pending";
}

/** Price-id → pakker via eksplicit mapping fra env. Ukendt price-id ⇒ throw — aldrig et gæt. */
export function packsForSession(
  session: StripeSession,
  env: Record<string, string | undefined>,
): string[] {
  const priceToPacks: Record<string, string[]> = {};
  if (env.STRIPE_PRICE_PACK1) priceToPacks[env.STRIPE_PRICE_PACK1] = ["pack1"];

  const items = session.line_items?.data ?? [];
  if (items.length === 0) throw new Error("Session mangler line_items (glemt expand?)");

  const packs = new Set<string>();
  for (const item of items) {
    const priceId = item.price?.id;
    const mapped = priceId ? priceToPacks[priceId] : undefined;
    if (!mapped) throw new Error("Ukendt price-id i session");
    for (const pack of mapped) packs.add(pack);
  }
  return [...packs];
}

/**
 * Byg licenskoden for en betalt session. Idempotent uden lagring: serial
 * afledes deterministisk af session-id'et, så samme session ⇒ samme kode.
 */
export async function buildCodeForSession(
  session: StripeSession,
  env: Record<string, string | undefined>,
): Promise<{ code: string; packs: string[]; serialHex: string; version: number }> {
  const keyring = keyringFromEnv(env);
  const version = currentVersion(keyring); // kaster på tom keyring (fail closed)
  const secret = keyring.get(version)!;
  const packs = packsForSession(session, env);
  const serial = await serialForSession(secret, session.id);
  const code = await issueLicense(secret, version, packs, serial);
  const serialHex = Array.from(serial, (b) => b.toString(16).padStart(2, "0")).join("");
  return { code, packs, serialHex, version };
}

/**
 * POST /api/stripe-webhook — mail-kanalen (checkout.session.completed → Resend).
 *
 * Signaturen verificeres manuelt mod den RÅ body-tekst (ingen stripe-npm).
 * Fejl efter verifikation ⇒ 500, så Stripe retryer — udstedelsen er idempotent
 * (samme session ⇒ samme kode), så en dubletmail er acceptabel. Denne kanal
 * påvirker ALDRIG /tak-flowet.
 */
import { buildCodeForSession, classifySession, fetchCheckoutSession } from "./_stripe";
import { formatCode, normalizeCode } from "./_license";

const te = new TextEncoder();
const TOLERANCE_SEC = 300;

/** Parse `t=...,v1=...` og HMAC-verificér `${t}.${raw}` constant-time. */
export async function verifyStripeSignature(
  raw: string,
  header: string | null,
  webhookSecret: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header) return false;
  let t: string | undefined;
  const v1s: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") t = value;
    else if (key === "v1" && value) v1s.push(value);
  }
  if (!t || v1s.length === 0) return false;
  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > TOLERANCE_SEC) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, te.encode(`${t}.${raw}`)));
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");

  for (const candidate of v1s) {
    if (candidate.length !== expected.length) continue;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ candidate.toLowerCase().charCodeAt(i);
    }
    if (diff === 0) return true;
  }
  return false;
}

function buildMail(code: string): { subject: string; text: string; html: string } {
  const subject = "Din Dystn-pakke — her er din kode";
  const text = [
    "Tak for dit køb af Dystn-pakken!",
    "",
    `Din kode: ${code}`,
    "",
    "Sådan bruger du den:",
    "- Samme enhed som købet: alt er allerede låst op, når du opretter et rum.",
    "- Hoster du festen fra en anden skærm (TV/laptop)? Indtast koden dér —",
    '  i oplåsnings-vinduet eller under Indstillinger → "Licens".',
    "",
    "Gem denne mail — koden er din kvittering for pakken og virker for evigt.",
    "",
    "Brug for hjælp? Skriv til help@dystn.app",
  ].join("\n");
  const html = [
    "<p>Tak for dit køb af <strong>Dystn-pakken</strong>!</p>",
    `<p style="font-size:1.3em"><strong>Din kode:</strong> <code>${code}</code></p>`,
    "<p>Sådan bruger du den:</p>",
    "<ul>",
    "<li>Samme enhed som købet: alt er allerede låst op, når du opretter et rum.</li>",
    "<li>Hoster du festen fra en anden skærm (TV/laptop)? Indtast koden dér — i oplåsnings-vinduet eller under Indstillinger → &quot;Licens&quot;.</li>",
    "</ul>",
    "<p>Gem denne mail — koden er din kvittering for pakken og virker for evigt.</p>",
    '<p>Brug for hjælp? Skriv til <a href="mailto:help@dystn.app">help@dystn.app</a></p>',
  ].join("\n");
  return { subject, text, html };
}

export async function handleWebhookRequest(
  req: Request,
  env: Record<string, string | undefined>,
): Promise<Response> {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  const apiKey = env.STRIPE_SECRET_KEY;
  if (!webhookSecret || !apiKey) return new Response(null, { status: 500 });

  // RÅ body-tekst FØR alt andet — signaturen dækker de eksakte bytes
  const raw = await req.text();
  const valid = await verifyStripeSignature(raw, req.headers.get("stripe-signature"), webhookSecret);
  if (!valid) return new Response(null, { status: 400 });

  let event: { type?: string; data?: { object?: { id?: unknown } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (event?.type !== "checkout.session.completed") return new Response(null, { status: 200 });

  const sessionId = event?.data?.object?.id;
  if (typeof sessionId !== "string") return new Response(null, { status: 400 });

  try {
    // Re-fetch: webhook-payloaden mangler expanded line_items
    const session = await fetchCheckoutSession(sessionId, apiKey);
    if (!session) return new Response(null, { status: 500 });

    if (classifySession(session, apiKey) !== "paid") return new Response(null, { status: 200 });

    const email = session.customer_details?.email;
    if (!email) return new Response(null, { status: 200 }); // ingen adresse — intet at gøre

    const { code } = await buildCodeForSession(session, env);
    // Defensivt: koden i mailen skal altid være den normaliserede visningsform
    const displayCode = formatCode(normalizeCode(code) ?? code.replace(/-/g, ""));

    const resendKey = env.RESEND_API_KEY;
    if (!resendKey) return new Response(null, { status: 500 });
    const from = env.LICENSE_MAIL_FROM || "Dystn <kode@dystn.app>";
    const { subject, text, html } = buildMail(displayCode);

    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject, text, html }),
    });
    if (!mailRes.ok) return new Response(null, { status: 500 }); // Stripe retryer

    return new Response(null, { status: 200 });
  } catch {
    return new Response(null, { status: 500 });
  }
}

export default function handler(req: Request): Promise<Response> {
  return handleWebhookRequest(req, process.env as Record<string, string | undefined>);
}

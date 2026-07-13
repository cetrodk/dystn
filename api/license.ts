/**
 * GET /api/license?session_id=cs_... — /tak-sidens kode-opslag.
 *
 * Svar (altid JSON + no-store; session_id logges ALDRIG):
 *   200 { status: "paid", code, packs } | { status: "pending" } | { status: "not_completed" }
 *   400/404/405/429 { error } · 500 { error } uden detaljer (invariant-brud m.m.)
 */
import { buildCodeForSession, classifySession, fetchCheckoutSession } from "./_stripe";

const SESSION_ID_RE = /^cs_[a-zA-Z0-9_]+$/;

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
// In-memory er fint på Fluid Compute: bedre end ingenting, nulstilles ved cold start
const rateHits = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string, now: number): boolean {
  const hit = rateHits.get(ip);
  if (!hit || now - hit.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateHits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  hit.count += 1;
  return hit.count > RATE_LIMIT_MAX;
}

/** Kun til tests. */
export function _resetRateLimit() {
  rateHits.clear();
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function handleLicenseRequest(
  req: Request,
  env: Record<string, string | undefined>,
): Promise<Response> {
  if (req.method !== "GET") return json(405, { error: "methodNotAllowed" });

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id") ?? "";
  if (!SESSION_ID_RE.test(sessionId)) return json(400, { error: "badRequest" });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip, Date.now())) return json(429, { error: "rateLimited" });

  const secretKey = env.STRIPE_SECRET_KEY;
  if (!secretKey) return json(500, { error: "serverError" });

  try {
    const session = await fetchCheckoutSession(sessionId, secretKey);
    if (!session) return json(404, { error: "notFound" });

    const status = classifySession(session, secretKey);
    if (status !== "paid") return json(200, { status });

    const { code, packs } = await buildCodeForSession(session, env);
    return json(200, { status: "paid", code, packs });
  } catch {
    // Ingen detaljer udadtil og ingen logning — session_id er en hemmelighed
    return json(500, { error: "serverError" });
  }
}

export default function handler(req: Request): Promise<Response> {
  return handleLicenseRequest(req, process.env as Record<string, string | undefined>);
}

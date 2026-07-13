import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleLicenseRequest, _resetRateLimit } from "../../../api/license";
import { verifyLicense } from "../../../api/_license";
import { TEST_SECRET } from "./license.vectors";

const ENV = {
  STRIPE_SECRET_KEY: "sk_test_dummy",
  STRIPE_PRICE_PACK1: "price_test_pack1",
  LICENSE_SECRET_V1: TEST_SECRET,
};

function stripeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_test_abc123",
    mode: "payment",
    livemode: false,
    status: "complete",
    payment_status: "paid",
    customer_details: { email: "kunde@example.com" },
    line_items: { data: [{ price: { id: "price_test_pack1" } }] },
    ...overrides,
  };
}

function stubStripe(session: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(session), { status })),
  );
}

function get(sessionId?: string, ip = "1.2.3.4") {
  const url =
    sessionId === undefined
      ? "https://dystn.app/api/license"
      : `https://dystn.app/api/license?session_id=${sessionId}`;
  return new Request(url, { headers: { "x-forwarded-for": ip } });
}

beforeEach(() => _resetRateLimit());
afterEach(() => vi.unstubAllGlobals());

describe("GET /api/license", () => {
  it("betalt session ⇒ paid + kode som verifyLicense accepterer", async () => {
    stubStripe(stripeSession());
    const res = await handleLicenseRequest(get("cs_test_abc123"), ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.status).toBe("paid");
    expect(body.packs).toEqual(["pack1"]);
    const verdict = await verifyLicense(body.code, new Map([[1, TEST_SECRET]]));
    expect(verdict).toMatchObject({ ok: true, packs: ["pack1"] });
  });

  it("er idempotent: samme session ⇒ samme kode", async () => {
    stubStripe(stripeSession());
    const a = await (await handleLicenseRequest(get("cs_test_abc123"), ENV)).json();
    const b = await (await handleLicenseRequest(get("cs_test_abc123"), ENV)).json();
    expect(a.code).toBe(b.code);
  });

  it("no_payment_required (100 %-rabat) ⇒ paid", async () => {
    stubStripe(stripeSession({ payment_status: "no_payment_required" }));
    const body = await (await handleLicenseRequest(get("cs_test_abc123"), ENV)).json();
    expect(body.status).toBe("paid");
  });

  it("open/expired ⇒ not_completed", async () => {
    for (const status of ["open", "expired"]) {
      stubStripe(stripeSession({ status, payment_status: "unpaid" }));
      const body = await (await handleLicenseRequest(get("cs_test_abc123"), ENV)).json();
      expect(body).toEqual({ status: "not_completed" });
    }
  });

  it("complete men unpaid (delayed notification) ⇒ pending", async () => {
    stubStripe(stripeSession({ payment_status: "unpaid" }));
    const body = await (await handleLicenseRequest(get("cs_test_abc123"), ENV)).json();
    expect(body).toEqual({ status: "pending" });
  });

  it("ukendt price-id ⇒ 500 uden detaljer (aldrig et gæt)", async () => {
    stubStripe(stripeSession({ line_items: { data: [{ price: { id: "price_ukendt" } }] } }));
    const res = await handleLicenseRequest(get("cs_test_abc123"), ENV);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "serverError" });
  });

  it("livemode-mismatch ⇒ 500 (test-session mod live-nøgle)", async () => {
    stubStripe(stripeSession({ livemode: false }));
    const res = await handleLicenseRequest(get("cs_test_abc123"), {
      ...ENV,
      STRIPE_SECRET_KEY: "sk_live_dummy",
    });
    expect(res.status).toBe(500);
  });

  it("mode !== payment ⇒ 500", async () => {
    stubStripe(stripeSession({ mode: "subscription" }));
    const res = await handleLicenseRequest(get("cs_test_abc123"), ENV);
    expect(res.status).toBe(500);
  });

  it("Stripe-404 ⇒ 404", async () => {
    stubStripe({ error: { type: "invalid_request_error" } }, 404);
    const res = await handleLicenseRequest(get("cs_test_ukendt"), ENV);
    expect(res.status).toBe(404);
  });

  it("manglende/ugyldig session_id ⇒ 400 JSON (aldrig SPA-HTML)", async () => {
    stubStripe(stripeSession());
    for (const req of [get(undefined), get(""), get("ikke-et-id"), get("cs_med%20mellemrum")]) {
      const res = await handleLicenseRequest(req, ENV);
      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toContain("application/json");
      expect(await res.json()).toEqual({ error: "badRequest" });
    }
  });

  it("forkert metode ⇒ 405", async () => {
    stubStripe(stripeSession());
    const res = await handleLicenseRequest(
      new Request("https://dystn.app/api/license?session_id=cs_x", { method: "POST" }),
      ENV,
    );
    expect(res.status).toBe(405);
  });

  it("pr.-IP rate-limit: 21. kald inden for et minut ⇒ 429", async () => {
    stubStripe(stripeSession());
    for (let i = 0; i < 20; i++) {
      const res = await handleLicenseRequest(get("cs_test_abc123", "9.9.9.9"), ENV);
      expect(res.status).toBe(200);
    }
    const blocked = await handleLicenseRequest(get("cs_test_abc123", "9.9.9.9"), ENV);
    expect(blocked.status).toBe(429);
    // ... men en anden IP er upåvirket
    const other = await handleLicenseRequest(get("cs_test_abc123", "8.8.8.8"), ENV);
    expect(other.status).toBe(200);
  });

  it("tom nøglering ⇒ 500 (fail closed)", async () => {
    stubStripe(stripeSession());
    const res = await handleLicenseRequest(get("cs_test_abc123"), {
      STRIPE_SECRET_KEY: "sk_test_dummy",
      STRIPE_PRICE_PACK1: "price_test_pack1",
    });
    expect(res.status).toBe(500);
  });
});

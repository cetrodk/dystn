import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { handleWebhookRequest, verifyStripeSignature } from "../../../api/stripe-webhook";
import { TEST_SECRET } from "./license.vectors";

const WEBHOOK_SECRET = "whsec_test_dummy";

const ENV = {
  STRIPE_SECRET_KEY: "sk_test_dummy",
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_PRICE_PACK1: "price_test_pack1",
  LICENSE_SECRET_V1: TEST_SECRET,
  RESEND_API_KEY: "re_test_dummy",
};

/** Uafhængig signatur-beregning med node:crypto (impl bruger WebCrypto). */
function sign(raw: string, t: number, secret = WEBHOOK_SECRET): string {
  const v1 = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

const NOW_SEC = 1_800_000_000;

function completedEvent(sessionId = "cs_test_abc123"): string {
  return JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { id: sessionId } },
  });
}

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

/** fetch-stub der ruter på URL: Stripe-API + Resend. */
function stubFetch({ session = stripeSession(), resendStatus = 200 } = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.startsWith("https://api.stripe.com/")) {
        return new Response(JSON.stringify(session), { status: 200 });
      }
      if (url.startsWith("https://api.resend.com/")) {
        return new Response(JSON.stringify({ id: "email_1" }), { status: resendStatus });
      }
      throw new Error(`Uventet fetch: ${url}`);
    }),
  );
  return calls;
}

function post(raw: string, signature: string | null): Request {
  return new Request("https://dystn.app/api/stripe-webhook", {
    method: "POST",
    headers: signature === null ? {} : { "stripe-signature": signature },
    body: raw,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("verifyStripeSignature", () => {
  it("accepterer korrekt signatur inden for tolerancen", async () => {
    const raw = completedEvent();
    expect(await verifyStripeSignature(raw, sign(raw, NOW_SEC), WEBHOOK_SECRET, NOW_SEC)).toBe(true);
    expect(
      await verifyStripeSignature(raw, sign(raw, NOW_SEC - 299), WEBHOOK_SECRET, NOW_SEC),
    ).toBe(true);
  });

  it("afviser forkert secret, ændret body og manglende header", async () => {
    const raw = completedEvent();
    expect(
      await verifyStripeSignature(raw, sign(raw, NOW_SEC, "whsec_forkert"), WEBHOOK_SECRET, NOW_SEC),
    ).toBe(false);
    expect(
      await verifyStripeSignature(raw + " ", sign(raw, NOW_SEC), WEBHOOK_SECRET, NOW_SEC),
    ).toBe(false);
    expect(await verifyStripeSignature(raw, null, WEBHOOK_SECRET, NOW_SEC)).toBe(false);
    expect(await verifyStripeSignature(raw, "v1=deadbeef", WEBHOOK_SECRET, NOW_SEC)).toBe(false);
  });

  it("afviser timestamps udenfor ±300 s", async () => {
    const raw = completedEvent();
    expect(
      await verifyStripeSignature(raw, sign(raw, NOW_SEC - 301), WEBHOOK_SECRET, NOW_SEC),
    ).toBe(false);
    expect(
      await verifyStripeSignature(raw, sign(raw, NOW_SEC + 301), WEBHOOK_SECRET, NOW_SEC),
    ).toBe(false);
  });
});

describe("POST /api/stripe-webhook", () => {
  it("betalt session ⇒ Resend-mail med koden ⇒ 200", async () => {
    const calls = stubFetch();
    const raw = completedEvent();
    const res = await handleWebhookRequest(post(raw, sign(raw, Math.floor(Date.now() / 1000))), ENV);
    expect(res.status).toBe(200);

    const resendCall = calls.find((c) => c.url.startsWith("https://api.resend.com/"));
    expect(resendCall).toBeDefined();
    const mail = JSON.parse(String(resendCall!.init?.body));
    expect(mail.to).toEqual(["kunde@example.com"]);
    expect(mail.subject).toContain("Dystn-pakke");
    expect(mail.text).toMatch(/[0-9A-Z]{6}-[0-9A-Z]{6}-[0-9A-Z]{6}-[0-9A-Z]{6}/);
    expect(mail.text).toContain("help@dystn.app");
  });

  it("ugyldig signatur ⇒ 400 og INTET Stripe/Resend-kald", async () => {
    const calls = stubFetch();
    const raw = completedEvent();
    const res = await handleWebhookRequest(post(raw, "t=1,v1=deadbeef"), ENV);
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("andre event-typer ⇒ 200 uden kald", async () => {
    const calls = stubFetch();
    const raw = JSON.stringify({ type: "charge.refunded", data: { object: { id: "ch_1" } } });
    const res = await handleWebhookRequest(post(raw, sign(raw, Math.floor(Date.now() / 1000))), ENV);
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(0);
  });

  it("ubetalt session ⇒ 200 uden mail", async () => {
    const calls = stubFetch({ session: stripeSession({ payment_status: "unpaid" }) });
    const raw = completedEvent();
    const res = await handleWebhookRequest(post(raw, sign(raw, Math.floor(Date.now() / 1000))), ENV);
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.url.startsWith("https://api.resend.com/"))).toBe(false);
  });

  it("manglende kunde-mail ⇒ 200 og færdig (ingen retry-storm)", async () => {
    const calls = stubFetch({ session: stripeSession({ customer_details: { email: null } }) });
    const raw = completedEvent();
    const res = await handleWebhookRequest(post(raw, sign(raw, Math.floor(Date.now() / 1000))), ENV);
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.url.startsWith("https://api.resend.com/"))).toBe(false);
  });

  it("Resend-fejl ⇒ 500 så Stripe retryer", async () => {
    stubFetch({ resendStatus: 500 });
    const raw = completedEvent();
    const res = await handleWebhookRequest(post(raw, sign(raw, Math.floor(Date.now() / 1000))), ENV);
    expect(res.status).toBe(500);
  });

  it("forkert metode ⇒ 405", async () => {
    const res = await handleWebhookRequest(
      new Request("https://dystn.app/api/stripe-webhook", { method: "GET" }),
      ENV,
    );
    expect(res.status).toBe(405);
  });
});

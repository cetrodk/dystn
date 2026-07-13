import { test, expect, type Page } from "@playwright/test";
import { newHostPage, createRoom, joinRoom, selectAndStartGame, waitForText } from "./helpers";
import { TEST_LICENSE_CODE, INVALID_LICENSE_CODE } from "./license-fixtures";

// Licens-flowet: pakkekort, modal-indløsning, cross-device onRequest,
// server-guards og fejl-UX. Serveren kører med det offentlige test-secret
// (injiceret i playwright.config.ts' webServer-kommando).

const PARTY_HTTP = "http://localhost:1999/parties/main";

async function expectLocked(host: Page) {
  await expect(host.locator('[data-testid="pack-card"]')).toBeVisible();
  await expect(host.locator('button:has-text("Fusk")')).toHaveCount(0);
}

async function openUnlockModal(host: Page) {
  // Karrusel-kort kan ligge udenfor viewporten — klik direkte som i helpers
  await host.locator('[data-testid="pack-card"]').dispatchEvent("click");
  await expect(host.locator('text=Få hele Dystn-pakken')).toBeVisible();
}

async function submitCode(host: Page, code: string) {
  await host.fill('input[placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"]', code);
  await host.click('button:has-text("Indløs")');
}

test.describe("Licens-flow", () => {
  test("happy path: pakkekort → indløs i modal → fusk kan startes", async ({ browser }) => {
    const host = await newHostPage(browser);
    const code = await createRoom(host);

    await expectLocked(host);
    await openUnlockModal(host);
    await submitCode(host, TEST_LICENSE_CODE);

    // Modal lukker og de betalte kort folder ud via nyt snapshot
    await expect(host.locator('button:has-text("Fusk")')).toBeVisible({ timeout: 5000 });
    await expect(host.locator('[data-testid="pack-card"]')).toHaveCount(0);

    // ... og spillet kan faktisk startes (server-guarden slipper det igennem)
    await joinRoom(browser, code, "Alice");
    await joinRoom(browser, code, "Bob");
    await joinRoom(browser, code, "Cara");
    await selectAndStartGame(host, "Fusk");
    await waitForText(host, "har svaret", 20000);
  });

  test("cross-device: onRequest-indløsning låser op live uden reload", async ({ browser, request }) => {
    const host = await newHostPage(browser);
    const code = await createRoom(host);
    await expectLocked(host);

    // Samme kald som /tak-siden laver fra telefonen
    const res = await request.post(`${PARTY_HTTP}/${code.toLowerCase()}`, {
      data: { code: TEST_LICENSE_CODE },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, packs: ["pack1"] });

    // Værtssiden opdaterer via broadcast — INGEN reload
    await expect(host.locator('button:has-text("Fusk")')).toBeVisible({ timeout: 5000 });
  });

  test("cross-device: ukendt rumkode ⇒ 404 roomNotFound", async ({ request }) => {
    const res = await request.post(`${PARTY_HTTP}/zzzz`, {
      data: { code: TEST_LICENSE_CODE },
    });
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ error: "roomNotFound" });
  });

  test("samme-enheds-auto-indløsning: /tak-fanens storage-skrivning låser op", async ({ browser }) => {
    const host = await newHostPage(browser);
    await createRoom(host);
    await expectLocked(host);

    // En anden fane i SAMME browser-profil (som /tak efter køb) skriver koden —
    // storage-eventet fyrer i rum-fanen, som selv indløser over socketen.
    const takTab = await host.context().newPage();
    await takTab.goto("/");
    await takTab.evaluate(
      (code) => localStorage.setItem("dystn_license", code),
      TEST_LICENSE_CODE,
    );

    await expect(host.locator('button:has-text("Fusk")')).toBeVisible({ timeout: 5000 });
    await takTab.close();
  });

  test("fejl-UX: ugyldig kode ⇒ dansk fejl; gentagne forsøg ⇒ rate-limit", async ({ browser }) => {
    const host = await newHostPage(browser);
    await createRoom(host);
    await openUnlockModal(host);

    await submitCode(host, INVALID_LICENSE_CODE);
    await expect(host.locator("text=Koden blev ikke genkendt")).toBeVisible();

    // 5 fejl udløser cooldown; næste forsøg afvises som rateLimited
    for (let i = 0; i < 5; i++) {
      await submitCode(host, INVALID_LICENSE_CODE);
      await host.waitForTimeout(150);
    }
    await expect(host.locator("text=For mange forsøg")).toBeVisible();
  });

  // Køres SIDST: den rå socket deler connection-id med sidens socket, og
  // id-kollisionen kan lukke sidens forbindelse.
  test("guard-afvisning: server afviser pack1-spil og ukendte spil for rå værts-socket", async ({ browser }) => {
    const host = await newHostPage(browser);
    const code = await createRoom(host);

    const sessionId = await host.evaluate(() => sessionStorage.getItem("dystn_session_id"));
    const hostSecret = await host.evaluate(() => localStorage.getItem("dystn_host_secret"));
    expect(sessionId).toBeTruthy();
    expect(hostSecret).toBeTruthy();

    const errors: string[] = [];
    const claims: boolean[] = [];
    // Node 22 har global WebSocket — ingen ws-dependency
    const ws = new WebSocket(
      `ws://localhost:1999/parties/main/${code.toLowerCase()}?_pk=${sessionId}`,
    );
    const done = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("timeout på guard-svar")), 15000);
      ws.addEventListener("message", (event) => {
        const msg = JSON.parse(String(event.data));
        if (msg.type === "hostClaimed") {
          claims.push(msg.success);
          ws.send(JSON.stringify({ type: "changeGameType", hostId: sessionId, gameType: "fusk" }));
        }
        if (msg.type === "error") {
          errors.push(msg.message);
          if (errors.length === 1) {
            ws.send(
              JSON.stringify({ type: "changeGameType", hostId: sessionId, gameType: "nonsense" }),
            );
          } else {
            clearTimeout(timeout);
            resolve();
          }
        }
      });
      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({ type: "hostConnect", sessionId, hostSecret }));
      });
      ws.addEventListener("error", () => reject(new Error("websocket-fejl")));
    });

    await done;
    ws.close();

    expect(claims).toEqual([true]);
    expect(errors).toEqual(["Dette spil kræver Dystn-pakken", "Ukendt spil"]);
  });
});

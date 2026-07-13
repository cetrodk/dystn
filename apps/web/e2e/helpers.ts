import { expect, type Browser, type Page } from "@playwright/test";
import { TEST_LICENSE_CODE } from "./license-fixtures";

// Fælles flow-helpers for e2e-specsene: rum-oprettelse, spiller-join,
// licens-indløsning og spilstart fra lobby-karrusellen.

export async function newHostPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext();
  return ctx.newPage();
}

/**
 * Lås Dystn-pakken op i et rum via serverens onRequest-endpoint (samme vej som
 * cross-device-indløsningen fra /tak). Uden dette viser lobbyen kun de to
 * gratis spil + pakkekortet, og specs der starter pack1-spil ville knække.
 */
export async function redeemTestLicense(page: Page, roomCode: string) {
  // 404 = DO'en er endnu ikke claimet af værtens hostConnect (racer med
  // navigationen efter createRoom) — prøv igen i op til ~5 s.
  for (let attempt = 0; ; attempt++) {
    const res = await page.request.post(
      `http://localhost:1999/parties/main/${roomCode.toLowerCase()}`,
      { data: { code: TEST_LICENSE_CODE } },
    );
    if (res.status() === 404 && attempt < 20) {
      await page.waitForTimeout(250);
      continue;
    }
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
    return;
  }
}

export async function createRoom(hostPage: Page): Promise<string> {
  await hostPage.goto("/");
  await hostPage.click("text=Vær vært");
  await hostPage.waitForURL(/\/host\//);
  const code = hostPage.url().split("/host/")[1].split("/")[0];
  expect(code).toMatch(/^[A-Z]{4}$/);
  return code;
}

export async function joinRoom(browser: Browser, code: string, name: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/join/${code}`);
  await page.fill('input[placeholder="Dit navn"]', name);
  // The redesigned join card has a decorative "DELTAG" header label as well as
  // the submit button, so target the submit button specifically.
  await page.click('button[type="submit"]');
  await page.waitForURL(`/play/${code}`);
  await expect(page.locator("text=Du er med!")).toBeVisible({ timeout: 5000 });
  return page;
}

/**
 * Select a game in the lobby carousel and start it. Carousel cards can sit
 * outside the viewport, so dispatch the click directly.
 */
export async function selectAndStartGame(hostPage: Page, gameName: string) {
  await hostPage
    .locator(`button:has-text("${gameName}")`)
    .first()
    .dispatchEvent("click");
  await expect(hostPage.locator("text=Start Spil")).toBeVisible({ timeout: 5000 });
  await hostPage.click("text=Start Spil");
}

export async function waitForText(page: Page, text: string, timeout = 10000) {
  await expect(page.locator(`text=${text}`).first()).toBeVisible({ timeout });
}

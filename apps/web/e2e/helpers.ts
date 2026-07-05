import { expect, type Browser, type Page } from "@playwright/test";

// Fælles flow-helpers for e2e-specsene: rum-oprettelse (inkl. forbi
// kodeords-gaten), spiller-join og spilstart fra lobby-karrusellen.

/** Create a page whose session has the host-passphrase gate pre-unlocked. */
export async function newHostPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    sessionStorage.setItem("festspil_host_unlocked", "1");
  });
  return page;
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

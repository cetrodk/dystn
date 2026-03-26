import { test, expect, type Page } from "@playwright/test";

async function createRoom(hostPage: Page): Promise<string> {
  await hostPage.goto("/");
  await hostPage.click("text=Vær vært");
  await hostPage.waitForURL(/\/host\//);
  return hostPage.url().split("/host/")[1];
}

async function joinRoom(playerPage: Page, code: string, name: string) {
  await playerPage.goto(`/join/${code}`);
  await playerPage.fill('input[placeholder="Dit navn"]', name);
  await playerPage.click("text=Deltag");
  await playerPage.waitForURL(`/play/${code}`);
  await expect(playerPage.locator("text=Du er med!")).toBeVisible({ timeout: 5000 });
}

test.describe("Bluff Game", () => {
  test("full round: host + 2 players", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const host = await hostCtx.newPage();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const code = await createRoom(host);
    console.log(`Bluff room: ${code}`);

    await joinRoom(p1, code, "Alice");
    await joinRoom(p2, code, "Bob");

    await expect(host.locator("text=2 spillere tilsluttet")).toBeVisible({ timeout: 5000 });

    // Select Bluff and start
    await host.click("text=Bluff");
    await expect(host.locator("text=Start Spil")).toBeVisible({ timeout: 5000 });
    await host.click("text=Start Spil");

    // Players should see submit phase with a fill-in-the-blank prompt
    await expect(p1.locator('input[type="text"]')).toBeVisible({ timeout: 15000 });
    await expect(p2.locator('input[type="text"]')).toBeVisible({ timeout: 15000 });

    // Submit fake answers
    await p1.fill('input[type="text"]', "min fisk");
    await p1.click("button:has-text('Send')");
    await p2.fill('input[type="text"]', "en stor kartoffel");
    await p2.click("button:has-text('Send')");

    // Should transition to vote phase — players see answer choices
    const p1Buttons = p1.locator("button").filter({ hasNotText: /Dit svar|Forside|Forlad/ });
    await expect(p1Buttons.first()).toBeVisible({ timeout: 30000 });

    // Vote (click first available answer)
    await p1Buttons.first().click();
    const p2Buttons = p2.locator("button").filter({ hasNotText: /Dit svar|Forside|Forlad/ });
    await p2Buttons.first().click();

    // Host should show reveal
    await expect(host.locator("text=Det rigtige svar")).toBeVisible({ timeout: 15000 });

    console.log("Bluff round 1 completed successfully!");

    await hostCtx.close();
    await p1Ctx.close();
    await p2Ctx.close();
  });
});

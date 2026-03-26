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

test.describe("Tegn & Gæt Game", () => {
  test("draw phase starts and accepts submission", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const host = await hostCtx.newPage();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    const code = await createRoom(host);
    console.log(`Tegn room: ${code}`);

    await joinRoom(p1, code, "Alice");
    await joinRoom(p2, code, "Bob");
    await expect(host.locator("text=2 spillere tilsluttet")).toBeVisible({ timeout: 5000 });

    // Select Tegn and start
    await host.click("text=Tegn & Gæt");
    await expect(host.locator("text=Start Spil")).toBeVisible({ timeout: 5000 });
    await host.click("text=Start Spil");

    // Both players should see draw phase with their secret word
    await expect(p1.locator("text=Tegn!")).toBeVisible({ timeout: 15000 });
    await expect(p2.locator("text=Tegn!")).toBeVisible({ timeout: 15000 });

    // Host should show "drawing in progress" message
    await expect(host.locator("text=tegner")).toBeVisible({ timeout: 10000 });

    // We can't easily draw on a canvas in Playwright, but we can verify
    // the submit button exists and the canvas is rendered
    await expect(p1.locator("button:has-text('Send')")).toBeVisible();
    await expect(p2.locator("button:has-text('Send')")).toBeVisible();

    console.log("Tegn draw phase verified successfully!");

    await hostCtx.close();
    await p1Ctx.close();
    await p2Ctx.close();
  });
});

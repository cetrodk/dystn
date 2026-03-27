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

test.describe("Sandhed Game", () => {
  test("plays through countdown + commit + reveal", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const p1Ctx = await browser.newContext();
    const host = await hostCtx.newPage();
    const p1 = await p1Ctx.newPage();

    const code = await createRoom(host);
    console.log(`Sandhed room: ${code}`);

    await joinRoom(p1, code, "Alice");
    await expect(host.locator("text=Alice")).toBeVisible({ timeout: 5000 });

    // Select Sandhed and start
    await host.click("text=Sandhed");
    await expect(host.locator("text=Start Spil")).toBeVisible({ timeout: 5000 });
    await host.click("text=Start Spil");

    // Should see countdown phase
    await expect(host.locator("text=Gør jer klar!")).toBeVisible({ timeout: 10000 });

    // After countdown, player should see Sandt/Falsk buttons
    await expect(p1.locator("text=Sandt")).toBeVisible({ timeout: 15000 });
    await expect(p1.locator("text=Falsk")).toBeVisible();

    // Player picks Sandt
    await p1.click("text=Sandt");

    // Wait for reveal phase — host shows "Sandt" or "Falsk" answer + "Næste runde" button
    await expect(host.locator("text=Næste runde")).toBeVisible({ timeout: 30000 });

    // Player should see their result
    await expect(
      p1.locator("text=Rigtigt!").or(p1.locator("text=Forkert!")).or(p1.locator("text=Du nåede ikke at vælge!"))
    ).toBeVisible({ timeout: 5000 });

    console.log("Sandhed round completed successfully!");

    await hostCtx.close();
    await p1Ctx.close();
  });
});

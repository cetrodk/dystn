import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end test for the Duel (Quiplash) game.
 * Simulates a host + 2 players playing through a complete round.
 */

async function createRoom(hostPage: Page): Promise<string> {
  await hostPage.goto("/");
  await hostPage.click("text=Vær vært");
  await hostPage.waitForURL(/\/host\//);
  // Extract room code from URL
  const url = hostPage.url();
  const code = url.split("/host/")[1];
  expect(code).toMatch(/^[A-Z]{4}$/);
  return code;
}

async function joinRoom(playerPage: Page, code: string, name: string) {
  await playerPage.goto(`/join/${code}`);
  await playerPage.fill('input[placeholder="Dit navn"]', name);
  await playerPage.click("text=Deltag");
  await playerPage.waitForURL(`/play/${code}`);
  // Wait for "Du er med!" to confirm connection
  await expect(playerPage.locator("text=Du er med!")).toBeVisible({ timeout: 5000 });
}

async function waitForText(page: Page, text: string, timeout = 10000) {
  await expect(page.locator(`text=${text}`)).toBeVisible({ timeout });
}

test.describe("Duel Game", () => {
  test("full round: host + 2 players", async ({ browser }) => {
    // Create 3 browser contexts (separate sessions)
    const hostCtx = await browser.newContext();
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();

    const host = await hostCtx.newPage();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    // Step 1: Host creates room
    const code = await createRoom(host);
    console.log(`Room code: ${code}`);

    // Step 2: Players join
    await joinRoom(p1, code, "Alice");
    await joinRoom(p2, code, "Bob");

    // Step 3: Verify players appear on host
    await expect(host.locator("text=Alice")).toBeVisible({ timeout: 5000 });
    await expect(host.locator("text=Bob")).toBeVisible({ timeout: 5000 });
    await expect(host.locator("text=2 spillere tilsluttet")).toBeVisible();

    // Step 4: Host selects Duel
    await host.click("text=Duel");
    // Wait for game info card to appear, then click Start
    await expect(host.locator("text=Start Spil")).toBeVisible({ timeout: 5000 });
    await host.click("text=Start Spil");

    // Step 5: Players should see submit phase
    await waitForText(p1, "Send", 15000);
    await waitForText(p2, "Send", 15000);

    // Step 6: Both players submit answers
    const p1Input = p1.locator('input[type="text"]');
    const p2Input = p2.locator('input[type="text"]');
    await p1Input.fill("Alice's svar");
    await p2Input.fill("Bob's svar");
    await p1.click("button:has-text('Send')");
    await p2.click("button:has-text('Send')");

    // Step 7: Players should see waiting screen
    await waitForText(p1, "Venter på andre...", 5000);
    await waitForText(p2, "Venter på andre...", 5000);

    // Step 8: Host should show present phase (answers revealed)
    await waitForText(host, "Lad os se hvad I har fundet på...", 10000);

    // Step 9: Wait for vote phase
    await waitForText(p1, "Stem på det bedste svar", 30000);
    await waitForText(p2, "Stem på det bedste svar", 30000);

    // Step 10: Players vote (each votes for the other's answer)
    // P1 can't vote for own answer, so click the first non-disabled button
    const p1VoteBtn = p1.locator("button:not([disabled])").filter({ hasNotText: "Dit svar" }).first();
    const p2VoteBtn = p2.locator("button:not([disabled])").filter({ hasNotText: "Dit svar" }).first();
    await p1VoteBtn.click();
    await p2VoteBtn.click();

    // Step 11: Host should show reveal/results
    await waitForText(host, "stemme", 15000);

    // Step 12: Game should eventually finish or move to next round
    // For 2 players, there are min(2,3) = 2 rounds, so we just check the first round completes
    console.log("Duel round 1 completed successfully!");

    // Cleanup
    await hostCtx.close();
    await p1Ctx.close();
    await p2Ctx.close();
  });
});

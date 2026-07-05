import { test, expect, type Page } from "@playwright/test";
import { newHostPage, createRoom, joinRoom, selectAndStartGame, waitForText } from "./helpers";

/**
 * Full round of Blitz (Quiplash-style): host + 3 players (vote games require
 * at least 3) through submit → present → vote → reveal.
 */
test.describe("Blitz", () => {
  test("fuld runde: vært + 3 spillere", async ({ browser }) => {
    const host = await newHostPage(browser);
    const code = await createRoom(host);

    const alice = await joinRoom(browser, code, "Alice");
    const bob = await joinRoom(browser, code, "Bob");
    const cara = await joinRoom(browser, code, "Cara");
    const players: Page[] = [alice, bob, cara];

    await expect(host.locator("text=Alice")).toBeVisible({ timeout: 5000 });
    await expect(host.locator("text=Bob")).toBeVisible();
    await expect(host.locator("text=Cara")).toBeVisible();

    await selectAndStartGame(host, "Blitz");

    // Submit phase
    for (const [i, p] of players.entries()) {
      await waitForText(p, "Send", 15000);
      await p.locator('input[type="text"]').fill(`Svar nummer ${i + 1}`);
      await p.click("button:has-text('Send')");
    }
    for (const p of players) {
      await waitForText(p, "Venter på andre...", 5000);
    }

    // Present phase on the host, then vote phase on phones
    await waitForText(host, "Lad os se hvad I har fundet på...", 10000);
    for (const p of players) {
      await waitForText(p, "Stem på det bedste svar", 60000);
      // Vote for the first answer that isn't marked as the player's own
      await p
        .locator("button:not([disabled])")
        .filter({ hasNotText: "Dit svar" })
        .first()
        .click();
    }

    // Reveal on the host
    await waitForText(host, "stemme", 20000);
  });
});

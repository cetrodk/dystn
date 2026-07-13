import { test, expect } from "@playwright/test";
import { newHostPage, createRoom, joinRoom } from "./helpers";

// Lavendel er sikker at asserte på: kinderne er hardcodet pink (#e85a8a),
// så pink ville false-positive på alle blobs.
const LAVENDEL = "#9b7be8";

test.describe("Avatar", () => {
  test("blob vises ved join, kan tilpasses i lobbyen og opdaterer host live", async ({ browser }) => {
    const hostPage = await newHostPage(browser);
    const code = await createRoom(hostPage);
    const player = await joinRoom(browser, code, "Kalle");

    // Spillerens egen lobby-række viser en blob-SVG
    const ownRow = player.locator("li", { hasText: "Kalle" });
    await expect(ownRow.locator("svg")).toBeVisible();

    // Tap egen række → editor åbner; vælg lavendel og luk
    await ownRow.click();
    await expect(player.locator("text=Tilpas din avatar")).toBeVisible();
    await player.click('button[aria-label="Farve 5"]');
    await player.click("text=Færdig");

    // changeAvatar er debounced (400 ms) — vent på at broadcastet når begge skærme
    await expect(ownRow.locator(`svg [fill="${LAVENDEL}"]`)).toBeVisible({ timeout: 5000 });
    await expect(hostPage.locator(`svg [fill="${LAVENDEL}"]`).first()).toBeVisible({ timeout: 5000 });
  });
});

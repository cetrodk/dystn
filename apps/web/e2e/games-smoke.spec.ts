import { test, expect, type Page } from "@playwright/test";
import { newHostPage, createRoom, joinRoom, redeemTestLicense, selectAndStartGame, waitForText } from "./helpers";

/**
 * Smoke test per game: host + 3 players, start the game, and verify the first
 * phase renders on both host and player screens. Guards against dead phase
 * routing (e.g. specs/screens referencing renamed games).
 */
const GAMES: Array<{ name: string; hostText: string; playerCheck: (p: Page) => Promise<void> }> = [
  {
    name: "Fusk",
    hostText: "har svaret",
    playerCheck: async (p) => waitForText(p, "Send", 15000),
  },
  {
    name: "Scrawl",
    hostText: "Alle tegner deres hemmelige ord...",
    playerCheck: async (p) => waitForText(p, "Tegn", 15000),
  },
  {
    name: "Morph",
    hostText: "Alle skriver en sætning...",
    playerCheck: async (p) => waitForText(p, "Send", 15000),
  },
  {
    name: "Surge",
    hostText: "Gør jer klar!",
    playerCheck: async (p) =>
      expect(p.locator("text=Gør jer klar!").or(p.locator("text=Sandt")).first()).toBeVisible({
        timeout: 15000,
      }),
  },
  {
    name: "Hunch",
    hostText: "fingerpeg",
    playerCheck: async (p) =>
      expect(
        p.locator("text=Du giver fingerpeget!").or(p.locator("text=fingerpeg")).first(),
      ).toBeVisible({ timeout: 15000 }),
  },
];

for (const game of GAMES) {
  test(`${game.name}: starter og viser første fase`, async ({ browser }) => {
    const host = await newHostPage(browser);
    const code = await createRoom(host);
    // Suiten dækker pack1-spil — lås pakken op, ellers viser lobbyen kun pakkekortet
    await redeemTestLicense(host, code);

    const players = [
      await joinRoom(browser, code, "Alice"),
      await joinRoom(browser, code, "Bob"),
      await joinRoom(browser, code, "Cara"),
    ];

    await selectAndStartGame(host, game.name);

    await waitForText(host, game.hostText, 20000);
    for (const p of players) {
      await game.playerCheck(p);
    }
  });
}

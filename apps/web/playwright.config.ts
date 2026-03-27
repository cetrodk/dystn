import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // games need sequential steps
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "cd ../party-server && npx partykit dev",
      port: 1999,
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      command: "pnpm dev",
      port: 5173,
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
});

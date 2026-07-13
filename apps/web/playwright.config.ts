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
      // Samme offentlige test-secret som i test/license.vectors.ts — får den
      // frosne TEST_LICENSE_CODE til at validere. Deployes ALDRIG.
      command:
        "cd ../party-server && npx partykit dev --var LICENSE_SECRET_V1=dystn-test-secret-0123456789abcdef0123456789abcdef",
      port: 1999,
      reuseExistingServer: true,
      // Generous window so a cold CI start (no warm cache) doesn't flake.
      timeout: 120_000,
    },
    {
      command: "pnpm dev",
      port: 5173,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});

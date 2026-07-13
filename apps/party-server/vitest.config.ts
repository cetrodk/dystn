import { defineConfig } from "vitest/config";

// Testfilerne ligger udenfor src/ med vilje: tsconfig'ens `include: ["src"]`
// (og dermed `tsc --noEmit`) skal ikke se dem eller rod-api/-importerne.
// Node 22 har WebCrypto + fetch globalt, så environment "node" rækker.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});

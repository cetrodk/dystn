import { describe, expect, it } from "vitest";
import { getAllGameHandlers } from "../src/registry";
import { PACK_BITS } from "../src/license";

// Side-effect-registrering — samme import-liste som server.ts
import "../src/games/blitz";
import "../src/games/fusk";
import "../src/games/scrawl";
import "../src/games/surge";
import "../src/games/morph";
import "../src/games/hunch";

/** Freemium-splittet fra docs/license-flow-design.md — ændringer her er en produktbeslutning. */
const EXPECTED_PACKS: Record<string, "free" | "pack1"> = {
  blitz: "free",
  scrawl: "free",
  fusk: "pack1",
  morph: "pack1",
  surge: "pack1",
  hunch: "pack1",
};

describe("game pack-config", () => {
  it("alle registrerede spil har EKSPLICIT config.pack (fail-closed-kravet)", () => {
    for (const [gameType, handlers] of getAllGameHandlers()) {
      expect(handlers.config?.pack, `${gameType} mangler config.pack`).toBeDefined();
    }
  });

  it("den præcise free/pack1-mapping", () => {
    const actual = Object.fromEntries(
      [...getAllGameHandlers()].map(([gameType, h]) => [gameType, h.config?.pack]),
    );
    expect(actual).toEqual(EXPECTED_PACKS);
  });

  it("alle betalte pakker findes i PACK_BITS (kan faktisk udstedes)", () => {
    for (const [gameType, handlers] of getAllGameHandlers()) {
      const pack = handlers.config?.pack;
      if (pack && pack !== "free") {
        expect(PACK_BITS[pack], `${gameType}: pakken "${pack}" kan ikke udstedes`).toBeDefined();
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import { shouldAutoAdvance } from "../src/phase";
import { registerGameHandlers } from "../src/registry";
import type { GameHandlers, Player, RoomState, Submission } from "../src/types";

// Side-effect-registrering — spillene fylder selv registry'et
import "../src/games/blitz";
import "../src/games/scrawl";
import "../src/games/surge";

let nextId = 0;

function makePlayer(overrides: Partial<Player> = {}): Player {
  const id = overrides.id ?? `p${++nextId}`;
  return {
    id,
    name: `Spiller ${id}`,
    sessionId: `session-${id}`,
    avatarColor: "#e8553a",
    score: 0,
    isConnected: true,
    lastSeen: 0,
    ...overrides,
  };
}

function makeSubmission(
  playerId: string,
  phase: string,
  content: unknown = { text: "svar" },
  round = 1,
): Submission {
  return {
    id: `s${++nextId}`,
    playerId,
    round,
    phase,
    content,
    createdAt: 0,
  };
}

function makeRoom(overrides: Partial<RoomState> = {}): RoomState {
  return {
    code: "TEST",
    hostId: "host",
    hostSecret: "secret",
    hostConnected: true,
    hostLastSeen: 0,
    status: "playing",
    currentPhase: "submit",
    roundNumber: 1,
    totalRounds: 3,
    settings: {},
    players: [],
    submissions: [],
    createdAt: 0,
    phaseVersion: 1,
    entitlements: ["pack1"],
    ...overrides,
  };
}

describe("shouldAutoAdvance", () => {
  it("Surge afslutter ikke tidligt, selv om alle har en transit-indsendelse", () => {
    // Regressionstesten for playtest-fejlen: alle trykker hurtigt, brikkerne
    // er stadig undervejs — fasen må IKKE skifte.
    const players = [makePlayer(), makePlayer(), makePlayer()];
    const room = makeRoom({
      gameType: "surge",
      currentPhase: "commit",
      players,
      submissions: players.map((p) =>
        makeSubmission(p.id, "commit", { choice: "transit" }),
      ),
    });
    expect(shouldAutoAdvance(room)).toBe(false);
  });

  it("Surge afslutter ikke tidligt, selv om alle har landet et rigtigt valg", () => {
    const players = [makePlayer(), makePlayer(), makePlayer()];
    const room = makeRoom({
      gameType: "surge",
      currentPhase: "commit",
      players,
      submissions: players.map((p) =>
        makeSubmission(p.id, "commit", { choice: "true" }),
      ),
    });
    expect(shouldAutoAdvance(room)).toBe(false);
  });

  it("Blitz afslutter stadig tidligt, når alle har indsendt", () => {
    const players = [makePlayer(), makePlayer(), makePlayer()];
    const room = makeRoom({
      gameType: "blitz",
      currentPhase: "submit",
      players,
      submissions: players.map((p) => makeSubmission(p.id, "submit")),
    });
    expect(shouldAutoAdvance(room)).toBe(true);
  });

  it("Blitz afslutter ikke, når én spiller mangler", () => {
    const players = [makePlayer(), makePlayer(), makePlayer()];
    const room = makeRoom({
      gameType: "blitz",
      currentPhase: "submit",
      players,
      submissions: players.slice(0, 2).map((p) => makeSubmission(p.id, "submit")),
    });
    expect(shouldAutoAdvance(room)).toBe(false);
  });

  it("en afbrudt spiller uden indsendelse blokerer ikke", () => {
    const submitted = makePlayer();
    const dropped = makePlayer({ isConnected: false });
    const room = makeRoom({
      gameType: "blitz",
      currentPhase: "submit",
      players: [submitted, dropped],
      submissions: [makeSubmission(submitted.id, "submit")],
    });
    expect(shouldAutoAdvance(room)).toBe(true);
  });

  it("Scrawl ekskluderer kunstneren i gætte-fasen", () => {
    const artist = makePlayer();
    const guessers = [makePlayer(), makePlayer()];
    const room = makeRoom({
      gameType: "scrawl",
      currentPhase: "guess_0",
      players: [artist, ...guessers],
      phaseData: { currentArtistId: artist.id },
      submissions: guessers.map((p) =>
        makeSubmission(p.id, "guess_0", { text: "en løgn" }),
      ),
    });
    expect(shouldAutoAdvance(room)).toBe(true);
  });

  it("afslutter aldrig en fase uden auto-fremdrift (reveal)", () => {
    const players = [makePlayer(), makePlayer()];
    const room = makeRoom({
      gameType: "blitz",
      currentPhase: "reveal",
      players,
      submissions: players.map((p) => makeSubmission(p.id, "reveal")),
    });
    expect(shouldAutoAdvance(room)).toBe(false);
  });

  it("et spil, der returnerer Infinity fra getExpectedSubmitterCount, afslutter aldrig tidligt", () => {
    // Værnet mod den fælde, Surge faldt i: Math.min(Infinity, presentCount)
    // klampede sentinel-værdien til "alle". Ikke-endelige tal skal betyde
    // "aldrig auto-fremdrift".
    const stub = {
      getExpectedSubmitterCount: () => Infinity,
    } as unknown as GameHandlers;
    registerGameHandlers("__hypothetical__", stub);

    const players = [makePlayer(), makePlayer()];
    const room = makeRoom({
      gameType: "__hypothetical__",
      currentPhase: "submit",
      players,
      submissions: players.map((p) => makeSubmission(p.id, "submit")),
    });
    expect(shouldAutoAdvance(room)).toBe(false);
  });
});

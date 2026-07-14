import { describe, expect, it } from "vitest";
import { getGameHandlers } from "../src/registry";
import { TRUTH_ID } from "../src/constants";
import type { Player, RoomState, Submission } from "../src/types";

// Side-effect-registrering — scrawl fylder selv registry'et
import "../src/games/scrawl";

const scrawl = getGameHandlers("scrawl");

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
  content: unknown,
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

/** Et rum midt i guess_0 med kunstner + gættere og facit "en hund". */
function makeGuessRoom(realWord = "en hund"): {
  room: RoomState;
  artist: Player;
  guessers: Player[];
} {
  const artist = makePlayer();
  const guessers = [makePlayer(), makePlayer()];
  const room: RoomState = {
    code: "TEST",
    hostId: "host",
    hostSecret: "secret",
    hostConnected: true,
    hostLastSeen: 0,
    gameType: "scrawl",
    status: "playing",
    currentPhase: "guess_0",
    phaseData: {
      currentArtistId: artist.id,
      drawingWords: { [artist.id]: realWord },
      drawingOrder: [artist.id, ...guessers.map((g) => g.id)],
      drawingIndex: 0,
    },
    roundNumber: 1,
    totalRounds: 1,
    settings: {},
    players: [artist, ...guessers],
    submissions: [],
    createdAt: 0,
    phaseVersion: 1,
    entitlements: [],
  };
  return { room, artist, guessers };
}

describe("scrawl onSubmission — afvisning af facit-lignende gæt", () => {
  it('afviser "hund", når facit er "en hund"', () => {
    const { room, guessers } = makeGuessRoom("en hund");
    expect(() => scrawl.onSubmission(room, guessers[0], "hund")).toThrow(
      "Prøv et andet gæt",
    );
    expect(room.submissions).toHaveLength(0);
  });

  it('accepterer "en kat", når facit er "en hund"', () => {
    const { room, guessers } = makeGuessRoom("en hund");
    scrawl.onSubmission(room, guessers[0], "en kat");
    expect(room.submissions).toHaveLength(1);
    expect(room.submissions[0].content).toBe("en kat");
  });
});

describe("scrawl buildVoteData — fletning og sikkerhedsnet", () => {
  it("fletter artikel-varianter af samme løgn til én mulighed med begge forfattere", () => {
    const { room, guessers } = makeGuessRoom("en cykel");
    room.submissions = [
      makeSubmission(guessers[0].id, "guess_0", "En bil"),
      makeSubmission(guessers[1].id, "guess_0", "bil"),
    ];

    const data = scrawl.buildVoteData(room);
    const answers = data.answers as Array<{
      id: string;
      text: string;
      playerId: string | null;
      mergedPlayerIds?: string[];
    }>;

    // Én løgn + sandheden
    expect(answers).toHaveLength(2);
    const lie = answers.find((a) => a.id !== TRUTH_ID)!;
    // Spillerne ser den første forfatters råtekst — aldrig den normaliserede form
    expect(lie.text).toBe("En bil");
    expect(lie.mergedPlayerIds).toEqual(
      expect.arrayContaining([guessers[0].id, guessers[1].id]),
    );
  });

  it("løgne af ren tegnsætning (tom normaliseret nøgle) flettes aldrig", () => {
    const { room, guessers } = makeGuessRoom("en hund");
    room.submissions = [
      makeSubmission(guessers[0].id, "guess_0", "???"),
      makeSubmission(guessers[1].id, "guess_0", "!!!"),
    ];

    const data = scrawl.buildVoteData(room);
    const answers = data.answers as Array<{
      id: string;
      playerId: string | null;
      mergedPlayerIds?: string[];
    }>;

    // To separate løgne + sandheden — ingen falsk kredit via mergedPlayerIds
    expect(answers).toHaveLength(3);
    expect(answers.every((a) => a.mergedPlayerIds === undefined)).toBe(true);
  });

  it("en løgn, der normaliseret er facit, optræder aldrig som selvstændig mulighed", () => {
    const { room, guessers } = makeGuessRoom("en hund");
    // Simulerer en indsendelse, der er sluppet uden om afvisningen
    // (fx fra før fixet eller en håndlavet WebSocket-besked)
    room.submissions = [
      makeSubmission(guessers[0].id, "guess_0", "Hund!"),
      makeSubmission(guessers[1].id, "guess_0", "en kat"),
    ];

    const data = scrawl.buildVoteData(room);
    const answers = data.answers as Array<{ id: string; text: string }>;

    // Kun den ægte løgn + sandheden — facit-dubletten er filtreret fra
    expect(answers).toHaveLength(2);
    const texts = answers.map((a) => a.text);
    expect(texts).toContain("en kat");
    expect(texts).toContain("en hund");
    expect(texts).not.toContain("Hund!");
    // Sandheden bæres kun af TRUTH_ID
    expect(answers.filter((a) => a.id === TRUTH_ID)).toHaveLength(1);
  });
});

describe("scrawl computeResults — scoringen er urørt", () => {
  it("stemmer på TRUTH_ID giver +1000, og løgnere får +500 pr. narret", () => {
    const { room, artist, guessers } = makeGuessRoom("en hund");
    room.submissions = [
      makeSubmission(guessers[0].id, "guess_0", "en kat"),
      makeSubmission(guessers[1].id, "guess_0", "en ræv"),
    ];
    room.phaseData = { ...(room.phaseData as object), ...scrawl.buildVoteData(room) };
    room.currentPhase = "vote_0";

    const answers = (room.phaseData as any).answers as Array<{
      id: string;
      playerId: string | null;
    }>;
    const katAnswer = answers.find((a) => a.playerId === guessers[0].id)!;

    // guesser0 stemmer på sandheden; guesser1 hopper på guesser0s løgn
    room.submissions.push(
      makeSubmission(guessers[0].id, "vote_0", TRUTH_ID),
      makeSubmission(guessers[1].id, "vote_0", katAnswer.id),
    );

    const { scoreDeltas } = scrawl.computeResults(room);
    expect(scoreDeltas.get(guessers[0].id)).toBe(1000 + 500); // ramte sandheden + narrede én
    expect(scoreDeltas.get(guessers[1].id)).toBeUndefined();
    // Kunstneren får intet: én fandt sandheden
    expect(scoreDeltas.get(artist.id)).toBeUndefined();
  });
});

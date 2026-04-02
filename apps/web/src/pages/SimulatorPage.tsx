import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Suspense,
} from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  ChevronDown,
  Monitor,
  Smartphone,
} from "lucide-react";
import {
  gameComponents,
  type RoomSnapshot,
  type PlayerSnapshot,
} from "@/games/registry";
import { MockPartyProvider } from "@/providers/PartyProvider";
import type { Stroke } from "@/games/scrawl/DrawingCanvas";

/* -- Mock Players ------------------------------------------------ */

const MOCK_PLAYERS: PlayerSnapshot[] = [
  { _id: "p1", name: "Anders", avatarColor: "#8b6eff", score: 0, isConnected: true },
  { _id: "p2", name: "Sofie", avatarColor: "#f472b6", score: 0, isConnected: true },
  { _id: "p3", name: "Magnus", avatarColor: "#34d399", score: 0, isConnected: true },
];

const PLAYER_NAME_MAP = new Map(MOCK_PLAYERS.map((p) => [p._id, p.name]));
const PLAYER_MAP = new Map(MOCK_PLAYERS.map((p) => [p._id, p]));
const EMPTY_SET: Set<string> = new Set();

/* -- Shared Mock Drawing ----------------------------------------- */

const MOCK_DRAWING: { strokes: Stroke[]; viewBoxHeight: number } = {
  strokes: [
    { points: [[100, 80], [120, 60], [160, 40], [200, 40], [240, 60], [260, 80], [260, 120], [240, 160], [200, 180], [160, 180], [120, 160], [100, 120], [100, 80]], color: "#8b6eff", size: 4 },
    { points: [[150, 100], [160, 110], [170, 100]], color: "#8b6eff", size: 3 },
    { points: [[200, 100], [210, 110], [220, 100]], color: "#8b6eff", size: 3 },
    { points: [[160, 140], [180, 155], [200, 140]], color: "#f472b6", size: 3 },
  ],
  viewBoxHeight: 300,
};

/* -- Shared Helpers ---------------------------------------------- */

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

function voterNames(votes: Record<string, string>, targetId: string): string[] {
  return Object.entries(votes)
    .filter(([, target]) => target === targetId)
    .map(([voterId]) => PLAYER_NAME_MAP.get(voterId) ?? "");
}

function mapPlayers(scores: Record<string, number>, submittedSet: Set<string>): PlayerSnapshot[] {
  return MOCK_PLAYERS.map((p) => ({
    ...p,
    score: scores[p._id] ?? 0,
    hasSubmitted: submittedSet.has(p._id),
  }));
}

function makeBaseRoom(
  gameType: string,
  phase: string,
  players: PlayerSnapshot[],
  roundNumber: number,
  totalRounds: number,
  now: number,
): RoomSnapshot {
  return {
    _id: "sim-room",
    code: "SIM1",
    gameType,
    status: "playing",
    currentPhase: phase,
    phaseData: {},
    phaseDeadline: now + 60000,
    roundNumber,
    totalRounds,
    players,
    hostId: "sim-host",
    hostConnected: true,
    currentPlayerId: null,
  };
}

/* ================================================================
   GAME MOCK CONFIGS
   Each game defines its mock data and how to generate room snapshots.
   To add a new game: add an entry to GAME_CONFIGS below.
   ================================================================ */

interface GameMockConfig {
  label: string;
  color: string;
  phases: string[];
  roundCount: number;
  /** Build the host room snapshot for a given phase */
  buildHostRoom(phase: string, roundIndex: number, submittedSet: Set<string>, now: number): RoomSnapshot;
  /** Derive a player-filtered snapshot from the host room (defaults to just setting currentPlayerId) */
  filterForPlayer?(room: RoomSnapshot, playerId: string, roundIndex: number): RoomSnapshot;
}

/** Default player filter — just sets currentPlayerId */
function defaultFilter(room: RoomSnapshot, playerId: string): RoomSnapshot {
  return { ...room, currentPlayerId: playerId };
}

/* -- Bluff ------------------------------------------------------- */

const FUSK_ROUNDS = [
  {
    promptText: "Den første ___ i Danmark blev bygget i 1876",
    realAnswer: "rutsjebane",
    fakes: [
      { playerId: "p1", playerName: "Anders", text: "jernbane", avatarColor: "#8b6eff" },
      { playerId: "p2", playerName: "Sofie", text: "vindmølle", avatarColor: "#f472b6" },
      { playerId: "p3", playerName: "Magnus", text: "telefonboks", avatarColor: "#34d399" },
    ],
    votes: { p1: "p2", p2: "truth", p3: "p1" } as Record<string, string>,
    scoresAfter: { p1: 500, p2: 1500, p3: 0 },
  },
  {
    promptText: "En gruppe ___ kaldes officielt en 'flamboyance'",
    realAnswer: "flamingoer",
    fakes: [
      { playerId: "p1", playerName: "Anders", text: "pelikaner", avatarColor: "#8b6eff" },
      { playerId: "p2", playerName: "Sofie", text: "søheste", avatarColor: "#f472b6" },
      { playerId: "p3", playerName: "Magnus", text: "pindsvin", avatarColor: "#34d399" },
    ],
    votes: { p1: "p3", p2: "p1", p3: "truth" } as Record<string, string>,
    scoresAfter: { p1: 1000, p2: 1500, p3: 1500 },
  },
  {
    promptText: "Verdens dyreste ___ blev solgt for 45 millioner kroner",
    realAnswer: "diamant",
    fakes: [
      { playerId: "p1", playerName: "Anders", text: "ost", avatarColor: "#8b6eff" },
      { playerId: "p2", playerName: "Sofie", text: "guitar", avatarColor: "#f472b6" },
      { playerId: "p3", playerName: "Magnus", text: "kartoffel", avatarColor: "#34d399" },
    ],
    votes: { p1: "p2", p2: "truth", p3: "p1" } as Record<string, string>,
    scoresAfter: { p1: 1500, p2: 3000, p3: 1500 },
  },
];

function shuffleBluffAnswers(round: typeof FUSK_ROUNDS[0], roundIndex: number) {
  const all = [
    ...round.fakes.map((f) => ({ id: f.playerId, text: f.text })),
    { id: "truth", text: round.realAnswer },
  ];
  return [...all].sort((a, b) => hashStr(a.id + roundIndex) - hashStr(b.id + roundIndex));
}

const fuskConfig: GameMockConfig = {
  label: "Fusk",
  color: "var(--color-fusk)",
  phases: ["submit", "vote", "reveal", "scores"],
  roundCount: FUSK_ROUNDS.length,

  buildHostRoom(phase, roundIndex, submittedSet, now) {
    const round = FUSK_ROUNDS[roundIndex] ?? FUSK_ROUNDS[0];
    const prevScores = roundIndex > 0 ? FUSK_ROUNDS[roundIndex - 1].scoresAfter : {};
    const scores = phase === "scores" || phase === "reveal" ? round.scoresAfter : prevScores;
    const base = makeBaseRoom("fusk", phase, mapPlayers(scores, submittedSet), roundIndex + 1, FUSK_ROUNDS.length, now);

    switch (phase) {
      case "submit":
        base.phaseData = { promptText: round.promptText };
        break;
      case "vote":
        base.phaseData = { promptText: round.promptText, answers: shuffleBluffAnswers(round, roundIndex) };
        base.phaseDeadline = now + 15000;
        break;
      case "reveal": {
        const results = [
          ...round.fakes.map((f) => {
            const voters = voterNames(round.votes, f.playerId);
            return {
              answerId: f.playerId, text: f.text, playerName: f.playerName, avatarColor: f.avatarColor,
              fooledCount: voters.length, voterNames: voters, isReal: false,
            };
          }),
          { answerId: "truth", text: round.realAnswer, playerName: "", avatarColor: "", fooledCount: 0,
            voterNames: voterNames(round.votes, "truth"), isReal: true },
        ].sort((a, b) => (a.isReal ? 1 : 0) - (b.isReal ? 1 : 0) || b.fooledCount - a.fooledCount);
        base.phaseData = { promptText: round.promptText, results };
        break;
      }
      case "scores":
        base.phaseDeadline = now + 8000;
        break;
    }
    return base;
  },

  filterForPlayer(room, playerId, roundIndex) {
    const round = FUSK_ROUNDS[roundIndex] ?? FUSK_ROUNDS[0];
    const filtered: RoomSnapshot = { ...room, currentPlayerId: playerId, phaseData: { ...room.phaseData } };
    switch (room.currentPhase) {
      case "submit":
        filtered.phaseData = { promptText: round.promptText, mySubmission: null };
        break;
      case "vote":
        filtered.phaseData = {
          promptText: round.promptText,
          answersAnonymized: ((room.phaseData.answers ?? []) as { id: string; text: string }[])
            .map((a) => ({ ...a, isOwn: a.id === playerId })),
        };
        break;
    }
    return filtered;
  },
};

/* -- Duel -------------------------------------------------------- */

const BLITZ_ROUNDS = [
  {
    promptText: "Hvad ville du gøre, hvis du vågnede op som borgmester?",
    answers: [
      { playerId: "p1", playerName: "Anders", text: "Gratis pizza til alle om fredagen", avatarColor: "#8b6eff" },
      { playerId: "p2", playerName: "Sofie", text: "Gøre mandag til weekend", avatarColor: "#f472b6" },
      { playerId: "p3", playerName: "Magnus", text: "Bygge en rutsjebane fra rådhuset", avatarColor: "#34d399" },
    ],
    votes: { p1: "p2", p2: "p3", p3: "p2" } as Record<string, string>,
    scoresAfter: { p1: 0, p2: 2000, p3: 1000 },
  },
];

const blitzConfig: GameMockConfig = {
  label: "Blitz",
  color: "var(--color-blitz)",
  phases: ["submit", "present", "vote", "reveal", "scores"],
  roundCount: BLITZ_ROUNDS.length,

  buildHostRoom(phase, roundIndex, submittedSet, now) {
    const round = BLITZ_ROUNDS[roundIndex % BLITZ_ROUNDS.length];
    const scores = phase === "reveal" || phase === "scores" ? round.scoresAfter : {};
    const base = makeBaseRoom("blitz", phase, mapPlayers(scores, submittedSet), roundIndex + 1, 3, now);

    switch (phase) {
      case "submit":
        base.phaseData = { promptText: round.promptText };
        break;
      case "present":
        base.phaseData = {
          promptText: round.promptText,
          answersAnonymized: round.answers.map((a) => ({ id: a.playerId, text: a.text })),
        };
        break;
      case "vote":
        base.phaseData = {
          promptText: round.promptText,
          answers: round.answers.map((a) => ({ id: a.playerId, text: a.text })),
        };
        base.phaseDeadline = now + 15000;
        break;
      case "reveal":
        base.phaseData = {
          promptText: round.promptText,
          results: round.answers.map((a) => {
            const voteCount = Object.values(round.votes).filter((v) => v === a.playerId).length;
            return {
              answerId: a.playerId, text: a.text, playerName: a.playerName,
              avatarColor: a.avatarColor, votes: voteCount, voterNames: voterNames(round.votes, a.playerId),
              delta: voteCount * 1000,
            };
          }),
        };
        break;
      case "scores":
        base.phaseDeadline = now + 8000;
        break;
    }
    return base;
  },

  filterForPlayer(room, playerId) {
    const filtered: RoomSnapshot = { ...room, currentPlayerId: playerId, phaseData: { ...room.phaseData } };
    if (room.currentPhase === "vote") {
      const answers = (room.phaseData.answers ?? []) as { id: string; text: string }[];
      filtered.phaseData = {
        ...room.phaseData,
        answersAnonymized: answers.map((a) => ({ ...a, isOwn: a.id === playerId })),
      };
    }
    return filtered;
  },
};

/* -- Tegn -------------------------------------------------------- */

const SCRAWL_ROUNDS = [
  {
    artistId: "p1",
    artistName: "Anders",
    word: "elefant",
    guesses: [
      { playerId: "p2", text: "elefant" },
      { playerId: "p3", text: "flodhest" },
    ],
    votes: { p2: "truth", p3: "p2_guess" } as Record<string, string>,
    scoresAfter: { p1: 500, p2: 1500, p3: 0 },
  },
];

const scrawlConfig: GameMockConfig = {
  label: "Scrawl",
  color: "var(--color-scrawl)",
  phases: ["draw", "guess", "vote", "reveal", "scores"],
  roundCount: SCRAWL_ROUNDS.length,

  buildHostRoom(phase, roundIndex, submittedSet, now) {
    const round = SCRAWL_ROUNDS[roundIndex % SCRAWL_ROUNDS.length];
    const scores = phase === "reveal" || phase === "scores" ? round.scoresAfter : {};
    const base = makeBaseRoom("scrawl", phase, mapPlayers(scores, submittedSet), roundIndex + 1, 3, now);

    switch (phase) {
      case "draw":
        base.phaseData = { totalDrawings: MOCK_PLAYERS.length, drawingIndex: 0 };
        base.phaseDeadline = now + 90000;
        break;
      case "guess":
        base.currentPhase = "guess_0";
        base.phaseData = {
          drawingData: MOCK_DRAWING,
          drawingIndex: 0,
          totalDrawings: MOCK_PLAYERS.length,
          currentArtistId: round.artistId,
        };
        base.phaseDeadline = now + 45000;
        break;
      case "vote": {
        const answers = [
          ...round.guesses.map((g) => ({ id: g.playerId + "_guess", text: g.text })),
          { id: "truth", text: round.word },
        ].sort((a, b) => hashStr(a.id + roundIndex) - hashStr(b.id + roundIndex));
        base.currentPhase = "vote_0";
        base.phaseData = {
          answers,
          drawingData: MOCK_DRAWING,
          drawingIndex: 0,
          totalDrawings: MOCK_PLAYERS.length,
        };
        base.phaseDeadline = now + 15000;
        break;
      }
      case "reveal": {
        base.currentPhase = "reveal_0";
        const results = [
          ...round.guesses.map((g) => {
            const fooledVoters = voterNames(round.votes, g.playerId + "_guess");
            return {
              answerId: g.playerId + "_guess", text: g.text,
              playerName: PLAYER_NAME_MAP.get(g.playerId) ?? "",
              avatarColor: PLAYER_MAP.get(g.playerId)?.avatarColor ?? "",
              fooledCount: fooledVoters.length, voterNames: fooledVoters, isReal: false,
            };
          }),
          {
            answerId: "truth", text: round.word, playerName: "", avatarColor: "",
            fooledCount: 0, voterNames: voterNames(round.votes, "truth"), isReal: true,
          },
        ].sort((a, b) => (a.isReal ? 1 : 0) - (b.isReal ? 1 : 0) || b.fooledCount - a.fooledCount);
        base.phaseData = {
          results, drawingData: MOCK_DRAWING, theWord: round.word,
          artistBonus: true, artistName: round.artistName,
          drawingIndex: 0, totalDrawings: MOCK_PLAYERS.length,
        };
        break;
      }
      case "scores":
        base.phaseDeadline = now + 8000;
        break;
    }
    return base;
  },

  filterForPlayer(room, playerId, roundIndex) {
    const round = SCRAWL_ROUNDS[roundIndex % SCRAWL_ROUNDS.length];
    const filtered: RoomSnapshot = { ...room, currentPlayerId: playerId, phaseData: { ...room.phaseData } };
    const phase = (room.currentPhase ?? "").split("_")[0];

    switch (phase) {
      case "draw":
        filtered.phaseData = {
          totalDrawings: MOCK_PLAYERS.length,
          drawingIndex: 0,
          myWord: playerId === round.artistId ? round.word : "kat",
          mySubmission: null,
        };
        break;
      case "guess":
        filtered.phaseData = {
          ...room.phaseData,
          isArtist: playerId === round.artistId,
          mySubmission: null,
        };
        break;
      case "vote": {
        const answers = (room.phaseData.answers ?? []) as { id: string; text: string }[];
        filtered.phaseData = {
          ...room.phaseData,
          isArtist: playerId === round.artistId,
          answersAnonymized: answers.map((a) => ({
            ...a,
            isOwn: a.id === playerId + "_guess",
          })),
          myVote: null,
        };
        break;
      }
    }
    return filtered;
  },
};

/* -- Telefon ----------------------------------------------------- */

function makeTelefonChain(
  startPlayer: typeof MOCK_PLAYERS[0],
  word: string,
): { type: string; playerName: string; avatarColor: string; content: unknown }[] {
  const others = MOCK_PLAYERS.filter((p) => p._id !== startPlayer._id);
  return [
    { type: "write", playerName: startPlayer.name, avatarColor: startPlayer.avatarColor, content: word },
    { type: "draw", playerName: others[0].name, avatarColor: others[0].avatarColor, content: MOCK_DRAWING },
    { type: "guess", playerName: others[1].name, avatarColor: others[1].avatarColor, content: word === "solskin" ? "sol" : word },
  ];
}

const MORPH_CHAINS = [
  makeTelefonChain(MOCK_PLAYERS[0], "solskin"),
  makeTelefonChain(MOCK_PLAYERS[1], "regnbue"),
  makeTelefonChain(MOCK_PLAYERS[2], "pandekage"),
];

const morphConfig: GameMockConfig = {
  label: "Morph",
  color: "var(--color-morph)",
  phases: ["write", "draw", "guess", "reveal"],
  roundCount: 1,

  buildHostRoom(phase, _roundIndex, submittedSet, now) {
    const base = makeBaseRoom("morph", phase, mapPlayers({}, submittedSet), 1, 1, now);

    switch (phase) {
      case "write":
        base.phaseData = {};
        base.phaseDeadline = now + 60000;
        break;
      case "draw":
        base.currentPhase = "draw_0";
        base.phaseData = { currentStep: 0, stepCount: MOCK_PLAYERS.length - 1 };
        base.phaseDeadline = now + 90000;
        break;
      case "guess":
        base.currentPhase = "guess_0";
        base.phaseData = { currentStep: 0, stepCount: MOCK_PLAYERS.length - 1 };
        base.phaseDeadline = now + 45000;
        break;
      case "reveal":
        base.phaseData = { chains: MORPH_CHAINS, revealChainIndex: 0, revealStepIndex: 0 };
        break;
    }
    return base;
  },

  filterForPlayer(room, playerId) {
    const filtered: RoomSnapshot = { ...room, currentPlayerId: playerId, phaseData: { ...room.phaseData } };
    const phase = (room.currentPhase ?? "").split("_")[0];

    switch (phase) {
      case "write":
        filtered.phaseData = { mySubmission: null };
        break;
      case "draw":
        filtered.phaseData = { ...room.phaseData, myPrompt: "solskin", mySubmission: null };
        break;
      case "guess":
        filtered.phaseData = { ...room.phaseData, myDrawingData: MOCK_DRAWING, mySubmission: null };
        break;
    }
    return filtered;
  },
};

/* -- Sandhed ----------------------------------------------------- */

const SANDHED_FINISH_LINE = 8;

const SURGE_ROUNDS = [
  {
    statement: "En blåhval's hjerte er så stort at et barn kan svømme gennem dens arterier",
    correctAnswer: "true" as const,
    choices: { p1: "true", p2: "false", p3: "true" } as Record<string, string>,
    positionsBefore: { p1: 0, p2: 0, p3: 0 } as Record<string, number>,
    positionsAfter: { p1: 1, p2: 0, p3: 1 } as Record<string, number>,
  },
  {
    statement: "Den Store Mur i Kina kan ses fra rummet med det blotte øje",
    correctAnswer: "false" as const,
    choices: { p1: "true", p2: "false", p3: "transit" } as Record<string, string>,
    positionsBefore: { p1: 1, p2: 0, p3: 1 } as Record<string, number>,
    positionsAfter: { p1: 0, p2: 1, p3: 1 } as Record<string, number>,
  },
  {
    statement: "Honning kan aldrig blive dårligt — arkæologer har fundet 3000 år gammel honning der stadig var spiselig",
    correctAnswer: "true" as const,
    choices: { p1: "true", p2: "true", p3: "false" } as Record<string, string>,
    positionsBefore: { p1: 0, p2: 1, p3: 1 } as Record<string, number>,
    positionsAfter: { p1: 1, p2: 2, p3: 0 } as Record<string, number>,
  },
];

const surgeConfig: GameMockConfig = {
  label: "Surge",
  color: "var(--color-surge)",
  phases: ["countdown", "commit", "reveal", "victory"],
  roundCount: SURGE_ROUNDS.length,

  buildHostRoom(phase, roundIndex, submittedSet, now) {
    const round = SURGE_ROUNDS[roundIndex % SURGE_ROUNDS.length];
    const base = makeBaseRoom("surge", phase, mapPlayers({}, submittedSet), roundIndex + 1, 100, now);

    switch (phase) {
      case "countdown":
        base.phaseData = { trackPositions: round.positionsBefore, finishLine: SANDHED_FINISH_LINE };
        base.phaseDeadline = now + 4000;
        break;
      case "commit": {
        const currentChoices: Record<string, string> = {};
        for (const pid of submittedSet) currentChoices[pid] = round.choices[pid] ?? "true";
        base.phaseData = {
          statement: round.statement, trackPositions: round.positionsBefore,
          currentChoices, finishLine: SANDHED_FINISH_LINE,
        };
        base.phaseDeadline = now + 20000;
        break;
      }
      case "reveal":
        base.phaseData = {
          statement: round.statement, correctAnswer: round.correctAnswer,
          trackPositions: round.positionsAfter, finishLine: SANDHED_FINISH_LINE,
          results: MOCK_PLAYERS.map((p) => {
            const choice = round.choices[p._id] ?? null;
            const noAnswer = !choice || choice === "transit";
            const correct = !noAnswer && choice === round.correctAnswer;
            return {
              playerId: p._id, playerName: p.name, avatarColor: p.avatarColor,
              choice, correct, noAnswer, delta: noAnswer ? 0 : correct ? 1 : -1,
              newPosition: round.positionsAfter[p._id] ?? 0,
            };
          }),
        };
        base.phaseDeadline = now + 10000;
        break;
      case "victory":
        base.phaseData = {
          winners: ["p2"],
          trackPositions: { p1: 6, p2: SANDHED_FINISH_LINE, p3: 5 },
          finishLine: SANDHED_FINISH_LINE,
        };
        base.status = "finished";
        break;
    }
    return base;
  },

  filterForPlayer(room, playerId) {
    const filtered: RoomSnapshot = { ...room, currentPlayerId: playerId, phaseData: { ...room.phaseData } };
    if (room.currentPhase === "commit") {
      const { correctAnswer: _, ...rest } = filtered.phaseData;
      filtered.phaseData = rest;
    }
    return filtered;
  },
};

/* -- Ord & Klap -------------------------------------------------- */

const HUNCH_ROUNDS = [
  {
    leftLabel: "Helt koldt", rightLabel: "Helt varmt", category: "temperatur",
    clueGiverId: "p1", clueGiverName: "Anders", target: 8, clue: "Kakaomælk",
    guesses: { p2: 7, p3: 9 } as Record<string, number>,
    scoresAfter: { p1: 500, p2: 500, p3: 500 },
  },
  {
    leftLabel: "Meget stille", rightLabel: "Meget højlydt", category: "lyd",
    clueGiverId: "p2", clueGiverName: "Sofie", target: 2, clue: "Bibliotek",
    guesses: { p1: 3, p3: 1 } as Record<string, number>,
    scoresAfter: { p1: 1000, p2: 1000, p3: 1000 },
  },
  {
    leftLabel: "Totalt nørdet", rightLabel: "Totalt populær", category: "personlighed",
    clueGiverId: "p3", clueGiverName: "Magnus", target: 5, clue: "Magnus selv",
    guesses: { p1: 5, p2: 7 } as Record<string, number>,
    scoresAfter: { p1: 2000, p2: 1200, p3: 1600 },
  },
];

const hunchConfig: GameMockConfig = {
  label: "Hunch",
  color: "var(--color-hunch)",
  phases: ["clue", "guess", "reveal", "scores"],
  roundCount: HUNCH_ROUNDS.length,

  buildHostRoom(phase, roundIndex, submittedSet, now) {
    const round = HUNCH_ROUNDS[roundIndex % HUNCH_ROUNDS.length];
    const prevScores = roundIndex > 0 ? HUNCH_ROUNDS[roundIndex - 1].scoresAfter : {};
    const scores = phase === "reveal" || phase === "scores" ? round.scoresAfter : prevScores;
    const base = makeBaseRoom("hunch", phase, mapPlayers(scores, submittedSet), roundIndex + 1, HUNCH_ROUNDS.length, now);

    switch (phase) {
      case "clue":
        base.phaseData = {
          leftLabel: round.leftLabel, rightLabel: round.rightLabel, category: round.category,
          clueGiverId: round.clueGiverId,
          submittedCount: submittedSet.has(round.clueGiverId) ? 1 : 0,
        };
        break;
      case "guess":
        base.phaseData = {
          leftLabel: round.leftLabel, rightLabel: round.rightLabel, category: round.category,
          clueGiverId: round.clueGiverId, clue: round.clue,
          submittedCount: [...submittedSet].filter((id) => id !== round.clueGiverId).length,
          totalGuessers: MOCK_PLAYERS.length - 1,
        };
        base.phaseDeadline = now + 30000;
        break;
      case "reveal": {
        const results = MOCK_PLAYERS
          .filter((p) => p._id !== round.clueGiverId)
          .map((p) => {
            const guess = round.guesses[p._id] ?? null;
            const distance = guess !== null ? Math.abs(guess - round.target) : null;
            const score = distance !== null ? ([1000, 500, 200][distance] ?? 0) : 0;
            return { playerId: p._id, playerName: p.name, avatarColor: p.avatarColor, guess, distance, score };
          });
        base.phaseData = {
          leftLabel: round.leftLabel, rightLabel: round.rightLabel, category: round.category,
          clueGiverId: round.clueGiverId, clue: round.clue, target: round.target,
          results, clueGiverBonus: 500, clueGiverName: round.clueGiverName,
        };
        base.phaseDeadline = now + 30000;
        break;
      }
      case "scores":
        base.phaseDeadline = now + 8000;
        break;
    }
    return base;
  },

  filterForPlayer(room, playerId, roundIndex) {
    const round = HUNCH_ROUNDS[roundIndex % HUNCH_ROUNDS.length];
    const filtered: RoomSnapshot = { ...room, currentPlayerId: playerId, phaseData: { ...room.phaseData } };
    const isClueGiver = playerId === round.clueGiverId;

    switch (room.currentPhase) {
      case "clue":
        filtered.phaseData = isClueGiver
          ? { ...room.phaseData, target: round.target, mySubmission: null }
          : { leftLabel: round.leftLabel, rightLabel: round.rightLabel, category: round.category, clueGiverId: round.clueGiverId };
        break;
      case "guess":
        filtered.phaseData = isClueGiver
          ? { ...room.phaseData }
          : { ...room.phaseData, myGuess: null };
        break;
      case "reveal": {
        const results = (room.phaseData.results ?? []) as Array<{ playerId: string }>;
        filtered.phaseData = { ...room.phaseData, myResult: results.find((r) => r.playerId === playerId) ?? null };
        break;
      }
    }
    return filtered;
  },
};

/* -- Game Config Registry ---------------------------------------- */

const GAME_CONFIGS: Record<string, GameMockConfig> = {
  fusk: fuskConfig,
  blitz: blitzConfig,
  scrawl: scrawlConfig,
  morph: morphConfig,
  surge: surgeConfig,
  hunch: hunchConfig,
};

/* -- Room Generation --------------------------------------------- */

function generateRooms(
  gameType: string,
  phase: string,
  roundIndex: number,
  submittedSet: Set<string>,
  now: number,
): { hostRoom: RoomSnapshot; playerRooms: RoomSnapshot[] } {
  const config = GAME_CONFIGS[gameType];
  if (!config) {
    const room = makeBaseRoom(gameType, phase, mapPlayers({}, submittedSet), 1, 3, now);
    return { hostRoom: room, playerRooms: MOCK_PLAYERS.map((p) => ({ ...room, currentPlayerId: p._id })) };
  }

  const safeRound = Math.min(roundIndex, (config.roundCount ?? 1) - 1);
  const hostRoom = config.buildHostRoom(phase, safeRound, submittedSet, now);
  const playerRooms = MOCK_PLAYERS.map((p) =>
    config.filterForPlayer
      ? config.filterForPlayer(hostRoom, p._id, safeRound)
      : defaultFilter(hostRoom, p._id),
  );
  return { hostRoom, playerRooms };
}

/* -- Phase Durations --------------------------------------------- */

// Intentionally shorter than server's DEFAULT_DURATIONS (apps/party-server/src/phase.ts)
// to make auto-play watchable — further divided by the speed multiplier at runtime
const PHASE_DURATIONS: Record<string, number> = {
  submit: 6000, vote: 5000, reveal: 18000, scores: 5000,
  present: 6000, draw: 8000, guess: 6000, write: 6000,
  countdown: 4000, commit: 5000, clue: 8000, victory: 6000,
};

// Must match the phases guarded in apps/party-server/src/server.ts handleSubmitAnswer
const SUBMITTABLE_PHASES = new Set(["submit", "vote", "commit", "write", "draw", "guess", "clue"]);

/* -- Simulator Page ---------------------------------------------- */

export function SimulatorPage() {
  const navigate = useNavigate();

  const [gameType, setGameType] = useState("fusk");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [submittedPlayers, setSubmittedPlayers] = useState<Set<string>>(EMPTY_SET);
  // Incremented to re-fire effects when navigating to an already-active phase/round
  const [visitKey, setVisitKey] = useState(0);

  const phaseStartRef = useRef(Date.now());

  const config = GAME_CONFIGS[gameType];
  const phases = config?.phases ?? ["submit"];
  const safePhaseIndex = Math.min(phaseIndex, phases.length - 1);
  const currentPhase = phases[safePhaseIndex] ?? phases[0];
  const maxRounds = config?.roundCount ?? 3;

  const resetState = useCallback(() => {
    setPhaseIndex(0);
    setRoundIndex(0);
    setSubmittedPlayers(EMPTY_SET);
    setAutoPlay(false);
    phaseStartRef.current = Date.now();
    setVisitKey((k) => k + 1);
  }, []);

  const { hostRoom, playerRooms } = useMemo(
    () => generateRooms(gameType, currentPhase, roundIndex, submittedPlayers, phaseStartRef.current),
    // visitKey ensures deadline recalculation when navigating to same phase/round
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameType, currentPhase, roundIndex, submittedPlayers, visitKey],
  );

  const advancePhase = useCallback(() => {
    setSubmittedPlayers(EMPTY_SET);
    phaseStartRef.current = Date.now();
    setVisitKey((k) => k + 1);

    if (phaseIndex < phases.length - 1) {
      setPhaseIndex((i) => i + 1);
    } else if (roundIndex < maxRounds - 1) {
      setRoundIndex((r) => r + 1);
      setPhaseIndex(0);
    } else {
      setRoundIndex(0);
      setPhaseIndex(0);
    }
  }, [phaseIndex, phases.length, roundIndex, maxRounds]);

  const prevPhase = useCallback(() => {
    setSubmittedPlayers(EMPTY_SET);
    phaseStartRef.current = Date.now();
    setVisitKey((k) => k + 1);

    if (phaseIndex > 0) {
      setPhaseIndex((i) => i - 1);
    } else if (roundIndex > 0) {
      setRoundIndex((r) => r - 1);
      setPhaseIndex(phases.length - 1);
    }
  }, [phaseIndex, roundIndex, phases.length]);

  const changeGame = useCallback((newGame: string) => {
    setGameType(newGame);
    resetState();
  }, [resetState]);

  // Auto-submit: progressively mark players as submitted
  useEffect(() => {
    if (!autoPlay || !SUBMITTABLE_PHASES.has(currentPhase)) return;

    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= MOCK_PLAYERS.length) { clearInterval(interval); return; }
      const playerId = MOCK_PLAYERS[idx]._id;
      setSubmittedPlayers((prev) => {
        const next = new Set(prev);
        next.add(playerId);
        return next;
      });
      idx++;
    }, (1500 / speed) | 0);

    return () => clearInterval(interval);
  }, [currentPhase, roundIndex, visitKey, autoPlay, speed]);

  // Auto-advance phase
  useEffect(() => {
    if (!autoPlay) return;
    const duration = (PHASE_DURATIONS[currentPhase] ?? 6000) / speed;
    const timer = setTimeout(advancePhase, duration);
    return () => clearTimeout(timer);
  }, [autoPlay, currentPhase, visitKey, speed, advancePhase]);

  const gameComps = gameComponents[gameType];
  const basePhase = currentPhase.split("_")[0];
  const HostComponent = gameComps?.host[basePhase];
  const PlayerComponent = gameComps?.player[basePhase];

  const handleSend = useCallback((msg: unknown) => {
    console.log("[Simulator] send:", msg);
  }, []);

  const phaseMotionKey = `${currentPhase}-${roundIndex}-${visitKey}`;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Control Bar */}
      <div className="sticky top-0 z-50 flex flex-wrap items-center gap-3 px-4 py-3 bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-white/5">
        <button
          onClick={() => navigate("/")}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
        >
          &larr;
        </button>

        <span className="font-display text-lg font-bold text-[var(--color-primary-light)]">
          Simulator
        </span>

        <div className="w-px h-6 bg-white/10" />

        <div className="relative">
          <select
            value={gameType}
            onChange={(e) => changeGame(e.target.value)}
            className="appearance-none rounded-lg bg-[var(--color-surface-light)] pl-3 pr-8 py-1.5 text-sm font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"
            style={{ color: config?.color }}
          >
            {Object.entries(GAME_CONFIGS).map(([id, cfg]) => (
              <option key={id} value={id}>{cfg.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-[var(--color-text-muted)]" />
        </div>

        <div className="w-px h-6 bg-white/10" />

        <div className="flex items-center gap-1">
          <button
            onClick={prevPhase}
            disabled={phaseIndex === 0 && roundIndex === 0}
            className="rounded-lg p-1.5 hover:bg-[var(--color-surface-light)] disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1.5 px-2">
            {phases.map((p, i) => (
              <button
                key={p}
                onClick={() => {
                  if (i === phaseIndex) return;
                  setPhaseIndex(i);
                  setSubmittedPlayers(EMPTY_SET);
                  phaseStartRef.current = Date.now();
                  setVisitKey((k) => k + 1);
                }}
                className={`rounded-md px-2 py-0.5 text-xs font-mono font-semibold transition-all cursor-pointer ${
                  i === phaseIndex
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={advancePhase}
            className="rounded-lg p-1.5 hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        <span className="text-xs text-[var(--color-text-muted)] font-mono">
          R{roundIndex + 1}/{maxRounds}
        </span>

        <div className="w-px h-6 bg-white/10" />

        <button
          onClick={() => setAutoPlay((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all cursor-pointer ${
            autoPlay
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          {autoPlay ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {autoPlay ? "Pause" : "Auto"}
        </button>

        <div className="flex items-center gap-1">
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded-md px-2 py-0.5 text-xs font-mono font-bold transition-all cursor-pointer ${
                speed === s
                  ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <button
          onClick={resetState}
          className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer"
          title="Reset"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-6 p-6">
        {/* Host View */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="h-4 w-4 text-[var(--color-text-muted)]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Host View
            </span>
          </div>
          <div
            className="relative rounded-2xl bg-[var(--color-bg)] ring-1 ring-white/10 overflow-hidden"
            style={{ minHeight: 400 }}
          >
            {HostComponent ? (
              <MockPartyProvider room={hostRoom} onSend={handleSend}>
                <div className="flex min-h-[400px] flex-col items-center justify-center gap-8 p-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={phaseMotionKey}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                      className="flex w-full flex-col items-center gap-8"
                    >
                      <Suspense fallback={<div className="text-[var(--color-text-muted)] animate-gentle-pulse">Indlæser...</div>}>
                        <HostComponent room={hostRoom} sessionId="sim-host" />
                      </Suspense>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </MockPartyProvider>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-[var(--color-text-muted)]">
                No host component for{" "}
                <code className="mx-1 text-[var(--color-primary)]">{gameType}/{currentPhase}</code>
              </div>
            )}
          </div>
        </div>

        {/* Player Views */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="h-4 w-4 text-[var(--color-text-muted)]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Player Views
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {MOCK_PLAYERS.map((player, i) => (
              <div key={player._id} className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: player.avatarColor }} />
                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">{player.name}</span>
                </div>

                <div
                  className="relative w-full rounded-2xl bg-[var(--color-bg)] ring-1 ring-white/10 overflow-hidden"
                  style={{ maxWidth: 375, height: 667 }}
                >
                  {PlayerComponent ? (
                    <MockPartyProvider room={playerRooms[i]} onSend={handleSend}>
                      <div className="h-full overflow-auto">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={phaseMotionKey}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full"
                          >
                            <Suspense
                              fallback={
                                <div className="flex h-full items-center justify-center text-[var(--color-text-muted)] animate-gentle-pulse">
                                  Indlæser...
                                </div>
                              }
                            >
                              <PlayerComponent room={playerRooms[i]} sessionId={player._id} />
                            </Suspense>
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </MockPartyProvider>
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-[var(--color-text-muted)]">
                      No player component
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

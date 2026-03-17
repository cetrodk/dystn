import { lazy, type ComponentType } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export interface PlayerSnapshot {
  _id: Id<"players">;
  name: string;
  avatarColor: string;
  avatarImage?: string;
  score: number;
  isConnected: boolean;
  hasSubmitted: boolean;
}

export interface RoomSnapshot {
  _id: Id<"rooms">;
  code: string;
  gameType?: string;
  status: "lobby" | "playing" | "finished";
  currentPhase?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  phaseData: Record<string, any>;
  phaseDeadline?: number;
  roundNumber?: number;
  totalRounds?: number;
  players: PlayerSnapshot[];
  currentPlayerId?: Id<"players"> | null;
  settings?: Record<string, unknown>;
  hostId?: string;
}

export interface PhaseComponentProps {
  room: RoomSnapshot;
  sessionId: string;
}

interface GameComponents {
  host: Record<string, ComponentType<PhaseComponentProps>>;
  player: Record<string, ComponentType<PhaseComponentProps>>;
}

export const gameComponents: Record<string, GameComponents> = {
  duel: {
    host: {
      submit: lazy(() => import("./duel/HostSubmit")),
      present: lazy(() => import("./duel/HostPresent")),
      vote: lazy(() => import("./duel/HostVote")),
      reveal: lazy(() => import("./duel/HostReveal")),
      scores: lazy(() => import("./duel/HostScores")),
    },
    player: {
      submit: lazy(() => import("./duel/PlayerSubmit")),
      present: lazy(() => import("./duel/PlayerPresent")),
      vote: lazy(() => import("./duel/PlayerVote")),
      reveal: lazy(() => import("./duel/PlayerReveal")),
      scores: lazy(() => import("./duel/PlayerReveal")), // same passive view
    },
  },
  bluff: {
    host: {
      submit: lazy(() => import("./bluff/HostSubmit")),
      vote: lazy(() => import("./bluff/HostVote")),
      reveal: lazy(() => import("./bluff/HostReveal")),
      scores: lazy(() => import("./duel/HostScores")), // reuse game-agnostic scoreboard
    },
    player: {
      submit: lazy(() => import("./bluff/PlayerSubmit")),
      vote: lazy(() => import("./bluff/PlayerVote")),
      reveal: lazy(() => import("./duel/PlayerReveal")), // same passive view
      scores: lazy(() => import("./duel/PlayerReveal")),
    },
  },
  tegn: {
    host: {
      draw: lazy(() => import("./tegn/HostDraw")),
      guess: lazy(() => import("./tegn/HostGuess")),
      vote: lazy(() => import("./tegn/HostVote")),
      reveal: lazy(() => import("./tegn/HostReveal")),
      scores: lazy(() => import("./duel/HostScores")),
    },
    player: {
      draw: lazy(() => import("./tegn/PlayerDraw")),
      guess: lazy(() => import("./tegn/PlayerGuess")),
      vote: lazy(() => import("./tegn/PlayerVote")),
      reveal: lazy(() => import("./tegn/PlayerReveal")),
      scores: lazy(() => import("./duel/PlayerReveal")),
    },
  },
  telefon: {
    host: {
      write: lazy(() => import("./telefon/HostWrite")),
      draw: lazy(() => import("./telefon/HostDraw")),
      guess: lazy(() => import("./telefon/HostGuess")),
      reveal: lazy(() => import("./telefon/HostReveal")),
    },
    player: {
      write: lazy(() => import("./telefon/PlayerWrite")),
      draw: lazy(() => import("./telefon/PlayerDraw")),
      guess: lazy(() => import("./telefon/PlayerGuess")),
      reveal: lazy(() => import("./telefon/PlayerReveal")),
    },
  },
  sandhed: {
    host: {
      countdown: lazy(() => import("./sandhed/HostCountdown")),
      commit: lazy(() => import("./sandhed/HostCommit")),
      reveal: lazy(() => import("./sandhed/HostReveal")),
      victory: lazy(() => import("./sandhed/HostVictory")),
    },
    player: {
      countdown: lazy(() => import("./sandhed/PlayerCountdown")),
      commit: lazy(() => import("./sandhed/PlayerCommit")),
      reveal: lazy(() => import("./sandhed/PlayerReveal")),
      victory: lazy(() => import("./sandhed/PlayerVictory")),
    },
  },
};

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
      vote: lazy(() => import("./duel/HostVote")),
      reveal: lazy(() => import("./duel/HostReveal")),
      scores: lazy(() => import("./duel/HostScores")),
    },
    player: {
      submit: lazy(() => import("./duel/PlayerSubmit")),
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
};

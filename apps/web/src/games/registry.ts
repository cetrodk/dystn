import { lazy, type ComponentType } from "react";

export interface PlayerSnapshot {
  _id: string;
  name: string;
  avatarColor: string;
  avatarImage?: string;
  score: number;
  isConnected: boolean;
  hasSubmitted?: boolean;
}

export interface RoomSnapshot {
  _id: string;
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
  currentPlayerId?: string | null;
  settings?: Record<string, unknown>;
  hostId?: string;
  hostConnected?: boolean;
  /** Oplåste pakker — kun værts-UI bruger den. Optional så simulator-fixtures overlever. */
  entitlements?: string[];
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
  blitz: {
    host: {
      submit: lazy(() => import("./blitz/HostSubmit")),
      present: lazy(() => import("./blitz/HostPresent")),
      vote: lazy(() => import("./blitz/HostVote")),
      reveal: lazy(() => import("./blitz/HostReveal")),
      scores: lazy(() => import("./blitz/HostScores")),
    },
    player: {
      submit: lazy(() => import("./blitz/PlayerSubmit")),
      present: lazy(() => import("./blitz/PlayerPresent")),
      vote: lazy(() => import("./blitz/PlayerVote")),
      reveal: lazy(() => import("./blitz/PlayerReveal")),
      scores: lazy(() => import("./blitz/PlayerReveal")), // same passive view
    },
  },
  fusk: {
    host: {
      submit: lazy(() => import("./fusk/HostSubmit")),
      vote: lazy(() => import("./fusk/HostVote")),
      reveal: lazy(() => import("./fusk/HostReveal")),
      scores: lazy(() => import("./blitz/HostScores")), // reuse game-agnostic scoreboard
    },
    player: {
      submit: lazy(() => import("./fusk/PlayerSubmit")),
      vote: lazy(() => import("./fusk/PlayerVote")),
      reveal: lazy(() => import("./blitz/PlayerReveal")), // same passive view
      scores: lazy(() => import("./blitz/PlayerReveal")),
    },
  },
  scrawl: {
    host: {
      draw: lazy(() => import("./scrawl/HostDraw")),
      guess: lazy(() => import("./scrawl/HostGuess")),
      vote: lazy(() => import("./scrawl/HostVote")),
      reveal: lazy(() => import("./scrawl/HostReveal")),
      scores: lazy(() => import("./blitz/HostScores")),
    },
    player: {
      draw: lazy(() => import("./scrawl/PlayerDraw")),
      guess: lazy(() => import("./scrawl/PlayerGuess")),
      vote: lazy(() => import("./scrawl/PlayerVote")),
      reveal: lazy(() => import("./scrawl/PlayerReveal")),
      scores: lazy(() => import("./blitz/PlayerReveal")),
    },
  },
  morph: {
    host: {
      write: lazy(() => import("./morph/HostWrite")),
      draw: lazy(() => import("./morph/HostDraw")),
      guess: lazy(() => import("./morph/HostGuess")),
      reveal: lazy(() => import("./morph/HostReveal")),
    },
    player: {
      write: lazy(() => import("./morph/PlayerWrite")),
      draw: lazy(() => import("./morph/PlayerDraw")),
      guess: lazy(() => import("./morph/PlayerGuess")),
      reveal: lazy(() => import("./morph/PlayerReveal")),
    },
  },
  surge: {
    host: {
      countdown: lazy(() => import("./surge/HostCountdown")),
      commit: lazy(() => import("./surge/HostCommit")),
      reveal: lazy(() => import("./surge/HostReveal")),
      victory: lazy(() => import("./surge/HostVictory")),
    },
    player: {
      countdown: lazy(() => import("./surge/PlayerCountdown")),
      commit: lazy(() => import("./surge/PlayerCommit")),
      reveal: lazy(() => import("./surge/PlayerReveal")),
      victory: lazy(() => import("./surge/PlayerVictory")),
    },
  },
  hunch: {
    host: {
      clue: lazy(() => import("./hunch/HostClue")),
      guess: lazy(() => import("./hunch/HostGuess")),
      reveal: lazy(() => import("./hunch/HostReveal")),
      scores: lazy(() => import("./blitz/HostScores")),
    },
    player: {
      clue: lazy(() => import("./hunch/PlayerClue")),
      guess: lazy(() => import("./hunch/PlayerGuess")),
      reveal: lazy(() => import("./hunch/PlayerReveal")),
      scores: lazy(() => import("./blitz/PlayerReveal")),
    },
  },
};

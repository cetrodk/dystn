/** ── In-memory room state (replaces Convex rooms/players/submissions tables) ── */

export type RoomStatus = "lobby" | "playing" | "finished";

export interface Player {
  id: string;
  name: string;
  sessionId: string;
  avatarColor: string;
  avatarImage?: string;
  score: number;
  isConnected: boolean;
  lastSeen: number;
}

export interface Submission {
  id: string;
  playerId: string;
  round: number;
  phase: string;
  content: unknown;
  createdAt: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  hostSecret: string;
  hostConnected: boolean;
  hostLastSeen: number;
  hostDisconnectDeadline?: number;
  /** Grace deadline: pause the game if the host is still gone when it fires */
  hostPauseDeadline?: number;
  gameType?: string;
  status: RoomStatus;
  currentPhase?: string;
  phaseData?: Record<string, unknown>;
  phaseDeadline?: number;
  roundNumber?: number;
  totalRounds?: number;
  settings: Record<string, unknown>;
  players: Player[];
  submissions: Submission[];
  createdAt: number;
  /** Incrementing version to prevent stale timer races */
  phaseVersion: number;
}

/** ── Game handler interfaces (replaces Convex gameHandlers.ts) ── */

export type PhaseAction =
  | { type: "setup" }
  | { type: "buildVote" }
  | { type: "buildGuess"; drawingIndex: number }
  | { type: "computeResults" }
  | { type: "none" }
  | { type: "finish" };

export interface PhaseTransition {
  nextPhase: string;
  action: PhaseAction;
  timerOverride?: number;
  advanceRound?: boolean;
}

export interface GameConfig {
  initialPhase?: string;
  totalRoundsForPlayerCount?: (playerCount: number) => number;
  /** Minimum players for the game to make sense (vote games degenerate < 3) */
  minPlayers?: number;
}

/**
 * Game handlers — pure functions operating on in-memory RoomState.
 * No database context needed; all state is passed explicitly.
 */
export interface GameHandlers {
  config?: GameConfig;

  setupRound(room: RoomState): Record<string, unknown>;

  onSubmission(room: RoomState, player: Player, content: unknown): void;

  buildVoteData(room: RoomState): Record<string, unknown>;

  onVote(room: RoomState, player: Player, content: unknown): void;

  computeResults(room: RoomState): {
    phaseData: Record<string, unknown>;
    scoreDeltas: Map<string, number>;
  };

  buildGuessData?(room: RoomState, drawingIndex: number): Record<string, unknown>;

  getExpectedSubmitterCount?(room: RoomState): number;

  filterForPlayer(room: RoomState, player: Player | null): Record<string, unknown>;

  getNextPhase(currentPhase: string, event: string, room: RoomState): PhaseTransition;
}

/** ── WebSocket message protocol ── */

/** Client → Server */
export type ClientMessage =
  | { type: "join"; name: string; sessionId: string; avatarImage?: string }
  | { type: "rejoin"; sessionId: string }
  | { type: "changeGameType"; hostId: string; gameType: string }
  | { type: "startGame"; hostId: string }
  | { type: "submitAnswer"; sessionId: string; content: unknown; phase?: string }
  | { type: "hostAdvance"; hostId: string }
  | { type: "updateSettings"; hostId: string; settings: Record<string, unknown> }
  | { type: "backToLobby"; hostId: string }
  | { type: "restartGame"; hostId: string }
  | { type: "continueGame"; hostId: string }
  | { type: "kickPlayer"; hostId: string; playerId: string }
  | { type: "changeAvatar"; sessionId: string; avatarImage: string }
  | { type: "leaveRoom"; sessionId: string }
  | { type: "morphAdvanceReveal"; hostId: string }
  | { type: "hostConnect"; sessionId: string; hostSecret: string };

/** Server → Client */
export type ServerMessage =
  | { type: "room"; data: RoomSnapshot }
  | { type: "error"; message: string }
  | { type: "joined"; playerId: string; roomCode: string }
  | { type: "rejoinFailed" }
  | { type: "kicked" }
  | { type: "hostClaimed"; success: boolean }
  | { type: "roomClosed"; reason: string };

/** The filtered room state sent to each client */
export interface RoomSnapshot {
  _id: string;
  code: string;
  hostId: string;
  gameType?: string;
  status: RoomStatus;
  currentPhase?: string;
  phaseData?: Record<string, unknown>;
  phaseDeadline?: number;
  roundNumber?: number;
  totalRounds?: number;
  settings: Record<string, unknown>;
  players: Array<{
    _id: string;
    name: string;
    avatarColor: string;
    avatarImage?: string;
    score: number;
    isConnected: boolean;
    hasSubmitted?: boolean;
  }>;
  hostConnected: boolean;
  currentPlayerId?: string;
}

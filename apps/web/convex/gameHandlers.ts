import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";

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
  /** Override timer duration in ms (e.g., Telefon reveal 5-min fallback) */
  timerOverride?: number;
  /** Increment roundNumber before calling setupRound */
  advanceRound?: boolean;
}

export interface GameHandlers {
  /** Set up a new round: pick prompts, assign matchups, etc. */
  setupRound(
    ctx: MutationCtx,
    room: Doc<"rooms">,
    players: Doc<"players">[],
  ): Promise<Record<string, unknown>>;

  /** Handle a player submission during the submit phase */
  onSubmission(
    ctx: MutationCtx,
    room: Doc<"rooms">,
    player: Doc<"players">,
    content: unknown,
  ): Promise<void>;

  /** Build the vote phase data (matchups, answer options, etc.) */
  buildVoteData(
    ctx: QueryCtx,
    room: Doc<"rooms">,
    players: Doc<"players">[],
  ): Promise<Record<string, unknown>>;

  /** Handle a player vote */
  onVote(
    ctx: MutationCtx,
    room: Doc<"rooms">,
    player: Doc<"players">,
    content: unknown,
  ): Promise<void>;

  /** Compute results and score changes after voting */
  computeResults(
    ctx: MutationCtx,
    room: Doc<"rooms">,
    players: Doc<"players">[],
  ): Promise<{
    phaseData: Record<string, unknown>;
    scoreDeltas: Map<Id<"players">, number>;
  }>;

  /** Build data for a sub-round guess phase (used by Tegn & Gæt) */
  buildGuessData?(
    ctx: MutationCtx,
    room: Doc<"rooms">,
    players: Doc<"players">[],
    drawingIndex: number,
  ): Promise<Record<string, unknown>>;

  /** How many players are expected to submit in the current phase */
  getExpectedSubmitterCount?(
    room: Doc<"rooms">,
    players: Doc<"players">[],
  ): number;

  /** Filter phaseData for a specific player (hide secrets, mark ownership) */
  filterForPlayer(
    room: Doc<"rooms">,
    currentPlayer: Doc<"players"> | null,
    submissions: Doc<"submissions">[],
    players: Doc<"players">[],
  ): Record<string, unknown>;

  /** Determine the next phase and what action to perform */
  getNextPhase(
    currentPhase: string,
    event: string,
    room: Doc<"rooms">,
    players: Doc<"players">[],
  ): PhaseTransition;
}

// Game handler registry — populated by each game module
const handlers = new Map<string, GameHandlers>();

export function registerGameHandlers(gameType: string, h: GameHandlers) {
  handlers.set(gameType, h);
}

export function getGameHandlers(gameType: string): GameHandlers {
  const h = handlers.get(gameType);
  if (!h) throw new Error(`No handlers registered for game: ${gameType}`);
  return h;
}

import type { RoomState } from "./types";
import { getGameHandlers } from "./registry";

/** Default phase durations in ms */
export const DEFAULT_DURATIONS: Record<string, number> = {
  submit: 60_000,
  present: 45_000,
  vote: 15_000,
  reveal: 60_000,
  scores: 8_000,
  draw: 90_000,
  guess: 45_000,
  write: 60_000,
  countdown: 4_000,
  commit: 20_000,
  victory: 15_000,
};

const SETTINGS_KEY: Record<string, string> = {
  submit: "submitTime",
  present: "presentTime",
  vote: "voteTime",
  reveal: "revealTime",
  scores: "scoresTime",
  draw: "drawTime",
  guess: "guessTime",
  write: "writeTime",
  commit: "commitTime",
};

export function getPhaseDuration(phase: string, settings?: Record<string, unknown>): number {
  const basePhase = phase.split("_")[0];
  const key = SETTINGS_KEY[basePhase];
  if (key && settings && typeof settings[key] === "number") {
    return settings[key] as number;
  }
  return DEFAULT_DURATIONS[basePhase] ?? 0;
}

/** Advance the game to the next phase. Mutates room state in place. */
export function advancePhase(room: RoomState, event: string): void {
  const currentPhase = room.currentPhase;
  if (!currentPhase || !room.gameType) return;

  const handlers = getGameHandlers(room.gameType);
  const transition = handlers.getNextPhase(currentPhase, event, room);

  // Handle finish
  if (transition.action.type === "finish") {
    room.currentPhase = "finished";
    room.status = "finished";
    room.phaseDeadline = undefined;
    room.phaseVersion += 1;
    return;
  }

  // Advance round if needed
  if (transition.advanceRound) {
    room.roundNumber = (room.roundNumber ?? 1) + 1;
  }

  // Execute action to produce next phase data
  switch (transition.action.type) {
    case "setup":
      room.phaseData = handlers.setupRound(room);
      break;
    case "buildVote":
      room.phaseData = handlers.buildVoteData(room);
      break;
    case "buildGuess": {
      if (!handlers.buildGuessData) throw new Error("buildGuessData not implemented");
      room.phaseData = handlers.buildGuessData(room, transition.action.drawingIndex);
      break;
    }
    case "computeResults": {
      const { phaseData, scoreDeltas } = handlers.computeResults(room);
      room.phaseData = phaseData;
      // Apply score deltas
      for (const [playerId, delta] of scoreDeltas) {
        const player = room.players.find((p) => p.id === playerId);
        if (player) player.score += delta;
      }
      break;
    }
    case "none":
      break;
  }

  // Set new deadline
  const duration = transition.timerOverride ?? getPhaseDuration(transition.nextPhase, room.settings);
  room.phaseDeadline = duration > 0 ? Date.now() + duration : undefined;
  room.currentPhase = transition.nextPhase;
  room.phaseVersion += 1;
}

import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getGameHandlers } from "../gameHandlers";

// Ensure game handlers are registered before any phase advancement
import "../games/duel";
import "../games/bluff";
import "../games/tegn";
import "../games/telefon";
import "../games/sandhed";

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
  commit: 10_000,
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

/** Get phase duration, respecting room settings overrides */
export function getPhaseDuration(phase: string, settings?: Record<string, unknown>): number {
  // For indexed phases like "guess_0", use the base phase
  const basePhase = phase.split("_")[0];
  const key = SETTINGS_KEY[basePhase];
  if (key && settings && typeof settings[key] === "number") {
    return settings[key] as number;
  }
  return DEFAULT_DURATIONS[basePhase] ?? 0;
}

/** Apply score deltas to player documents */
async function applyScoreDeltas(
  ctx: MutationCtx,
  players: Doc<"players">[],
  scoreDeltas: Map<Id<"players">, number>,
) {
  await Promise.all(
    [...scoreDeltas].map(([playerId, delta]) => {
      const player = players.find((p) => p._id === playerId);
      return player ? ctx.db.patch(playerId, { score: player.score + delta }) : null;
    }),
  );
}

export async function advancePhaseInternal(
  ctx: MutationCtx,
  room: Doc<"rooms">,
  event: string,
) {
  const currentPhase = room.currentPhase;
  if (!currentPhase) return;

  // Guard against double-advancement: re-read room and check phase version
  const freshRoom = await ctx.db.get(room._id);
  if (!freshRoom || freshRoom.currentPhase !== currentPhase) return;
  if ((freshRoom.phaseVersion ?? 0) !== (room.phaseVersion ?? 0)) return;

  const players = await ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("roomId", room._id))
    .collect();

  if (!room.gameType) return;
  const handlers = getGameHandlers(room.gameType);

  // Ask the game handler what comes next
  const transition = handlers.getNextPhase(currentPhase, event, room, players);

  // Handle finish
  if (transition.action.type === "finish") {
    await ctx.db.patch(room._id, {
      currentPhase: "finished",
      status: "finished",
      phaseDeadline: undefined,
      phaseVersion: (room.phaseVersion ?? 0) + 1,
    });
    return;
  }

  // Optionally advance round number before setup
  if (transition.advanceRound) {
    const nextRound = (room.roundNumber ?? 1) + 1;
    await ctx.db.patch(room._id, { roundNumber: nextRound });
    room = { ...room, roundNumber: nextRound };
  }

  // Execute the action to produce next phase data
  let nextPhaseData: Record<string, unknown> = room.phaseData ?? {};

  switch (transition.action.type) {
    case "setup":
      nextPhaseData = await handlers.setupRound(ctx, room, players);
      break;
    case "buildVote":
      nextPhaseData = await handlers.buildVoteData(ctx, room, players);
      break;
    case "buildGuess": {
      if (!handlers.buildGuessData) {
        throw new Error("buildGuessData not implemented");
      }
      nextPhaseData = await handlers.buildGuessData(ctx, room, players, transition.action.drawingIndex);
      break;
    }
    case "computeResults": {
      const { phaseData, scoreDeltas } = await handlers.computeResults(ctx, room, players);
      nextPhaseData = phaseData;
      await applyScoreDeltas(ctx, players, scoreDeltas);
      break;
    }
    case "none":
      // Keep current phaseData
      break;
  }

  // Compute deadline
  const duration = transition.timerOverride
    ?? getPhaseDuration(transition.nextPhase, room.settings as Record<string, unknown> | undefined);
  const deadline = duration > 0 ? Date.now() + duration : undefined;

  const nextVersion = (room.phaseVersion ?? 0) + 1;
  await ctx.db.patch(room._id, {
    currentPhase: transition.nextPhase,
    phaseData: nextPhaseData,
    phaseDeadline: deadline,
    phaseVersion: nextVersion,
  });

  if (deadline) {
    await ctx.scheduler.runAt(
      deadline,
      internal.timers.onTimerExpired,
      { roomId: room._id, expectedDeadline: deadline },
    );
  }
}

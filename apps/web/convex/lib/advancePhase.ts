import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getGameHandlers } from "../gameHandlers";

// Ensure game handlers are registered before any phase advancement
import "../games/duel";
import "../games/bluff";
import "../games/tegn";
import "../games/telefon";

/** Default phase durations in ms */
export const DEFAULT_DURATIONS: Record<string, number> = {
  submit: 60_000,
  vote: 15_000,
  reveal: 60_000,
  scores: 8_000,
  draw: 90_000,
  guess: 45_000,
  write: 60_000,
};

const SETTINGS_KEY: Record<string, string> = {
  submit: "submitTime",
  vote: "voteTime",
  reveal: "revealTime",
  scores: "scoresTime",
  draw: "drawTime",
  guess: "guessTime",
  write: "writeTime",
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


export async function advancePhaseInternal(
  ctx: MutationCtx,
  room: Doc<"rooms">,
  _event: string,
) {
  const currentPhase = room.currentPhase;
  if (!currentPhase) return;

  const players = await ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("roomId", room._id))
    .collect();

  const handlers = getGameHandlers(room.gameType);

  // Extract base phase and sub-round index for Tegn
  const [basePhase, subIdxStr] = currentPhase.split("_");
  const drawingIndex = subIdxStr !== undefined ? parseInt(subIdxStr, 10) : 0;

  let nextPhase: string;
  let nextPhaseData: Record<string, unknown> = room.phaseData ?? {};

  if (currentPhase === "submit") {
    // Duel / Bluff: submit → vote
    nextPhase = "vote";
    nextPhaseData = await handlers.buildVoteData(ctx, room, players);
  } else if (currentPhase === "vote") {
    // Duel / Bluff: vote → reveal
    nextPhase = "reveal";
    const { phaseData, scoreDeltas } = await handlers.computeResults(
      ctx,
      room,
      players,
    );
    nextPhaseData = phaseData;

    await Promise.all(
      [...scoreDeltas].map(([playerId, delta]) => {
        const player = players.find((p) => p._id === playerId);
        return player ? ctx.db.patch(playerId, { score: player.score + delta }) : null;
      }),
    );
  } else if (currentPhase === "reveal" && room.gameType === "telefon") {
    // Telefon: reveal → finished (host-driven via telefonAdvanceReveal)
    await ctx.db.patch(room._id, {
      currentPhase: "finished",
      status: "finished",
      phaseDeadline: undefined,
    });
    return;
  } else if (currentPhase === "reveal") {
    // Duel / Bluff: reveal → scores or next round
    const roundNumber = room.roundNumber ?? 1;
    const totalRounds = room.totalRounds ?? 1;

    if (roundNumber >= totalRounds) {
      nextPhase = "finished";
      await ctx.db.patch(room._id, {
        currentPhase: "finished",
        status: "finished",
        phaseDeadline: undefined,
      });
      return;
    }

    nextPhase = "scores";
  } else if (currentPhase === "write") {
    // Telefon: write → draw_0
    if (!handlers.buildGuessData) {
      throw new Error("buildGuessData not implemented");
    }
    nextPhaseData = await handlers.buildGuessData(ctx, room, players, 0);
    nextPhase = "draw_0";
  } else if (currentPhase === "draw") {
    // Tegn: draw → guess_0
    if (!handlers.buildGuessData) {
      throw new Error("buildGuessData not implemented");
    }
    nextPhaseData = await handlers.buildGuessData(ctx, room, players, 0);
    nextPhase = "guess_0";
  } else if (basePhase === "draw" && subIdxStr !== undefined && room.gameType === "telefon") {
    // Telefon: draw_K → guess_K
    if (!handlers.buildGuessData) {
      throw new Error("buildGuessData not implemented");
    }
    nextPhaseData = await handlers.buildGuessData(ctx, room, players, drawingIndex);
    nextPhase = `guess_${drawingIndex}`;
  } else if (basePhase === "guess" && subIdxStr !== undefined && room.gameType === "telefon") {
    // Telefon: guess_K → draw_(K+1) or reveal
    const stepCount = (room.phaseData as any)?.stepCount ?? 1;
    if (drawingIndex < stepCount - 1) {
      if (!handlers.buildGuessData) {
        throw new Error("buildGuessData not implemented");
      }
      nextPhaseData = await handlers.buildGuessData(ctx, room, players, drawingIndex + 1);
      nextPhase = `draw_${drawingIndex + 1}`;
    } else {
      // All steps done → compute results + build reveal data
      const { phaseData, scoreDeltas } = await handlers.computeResults(
        ctx,
        room,
        players,
      );
      nextPhaseData = phaseData;
      nextPhase = "reveal";

      await Promise.all(
        [...scoreDeltas].map(([playerId, delta]) => {
          const player = players.find((p) => p._id === playerId);
          return player
            ? ctx.db.patch(playerId, { score: player.score + delta })
            : null;
        }),
      );
    }
  } else if (basePhase === "guess") {
    // Tegn: guess_K → vote_K
    nextPhaseData = await handlers.buildVoteData(ctx, room, players);
    nextPhase = `vote_${drawingIndex}`;
  } else if (basePhase === "vote" && subIdxStr !== undefined) {
    // Tegn: vote_K → reveal_K
    const { phaseData, scoreDeltas } = await handlers.computeResults(
      ctx,
      room,
      players,
    );
    nextPhaseData = phaseData;
    nextPhase = `reveal_${drawingIndex}`;

    await Promise.all(
      [...scoreDeltas].map(([playerId, delta]) => {
        const player = players.find((p) => p._id === playerId);
        return player ? ctx.db.patch(playerId, { score: player.score + delta }) : null;
      }),
    );
  } else if (basePhase === "reveal" && subIdxStr !== undefined) {
    // Tegn: reveal_K → guess_(K+1) or scores
    const totalDrawings = (room.phaseData as any)?.totalDrawings ?? 1;

    if (drawingIndex < totalDrawings - 1) {
      if (!handlers.buildGuessData) {
        throw new Error("buildGuessData not implemented");
      }
      nextPhaseData = await handlers.buildGuessData(
        ctx,
        room,
        players,
        drawingIndex + 1,
      );
      nextPhase = `guess_${drawingIndex + 1}`;
    } else {
      // All drawings done → scores
      nextPhase = "scores";
    }
  } else if (currentPhase === "scores") {
    // All games: scores → next round or finish
    const roundNumber = room.roundNumber ?? 1;
    const totalRounds = room.totalRounds ?? 1;

    if (roundNumber >= totalRounds) {
      await ctx.db.patch(room._id, {
        currentPhase: "finished",
        status: "finished",
        phaseDeadline: undefined,
      });
      return;
    }

    nextPhase = room.gameType === "tegn" ? "draw" : "submit";
    const nextRound = roundNumber + 1;
    nextPhaseData = await handlers.setupRound(
      ctx,
      { ...room, roundNumber: nextRound },
      players,
    );
    await ctx.db.patch(room._id, { roundNumber: nextRound });
  } else {
    return;
  }

  // Telefon reveal is host-driven but gets a generous fallback timer
  // so the game doesn't hang forever if the host disconnects
  const isTelefonReveal = nextPhase === "reveal" && room.gameType === "telefon";
  const duration = isTelefonReveal
    ? 5 * 60_000 // 5 min fallback — auto-finish if host disappears
    : getPhaseDuration(nextPhase, room.settings as Record<string, unknown> | undefined);
  const deadline = duration > 0 ? Date.now() + duration : undefined;

  await ctx.db.patch(room._id, {
    currentPhase: nextPhase,
    phaseData: nextPhaseData,
    phaseDeadline: deadline,
  });

  if (deadline) {
    await ctx.scheduler.runAt(
      deadline,
      internal.timers.onTimerExpired,
      { roomId: room._id, expectedDeadline: deadline },
    );
  }
}

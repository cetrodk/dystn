import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getGameHandlers } from "./gameHandlers";
import { advancePhaseInternal, getPhaseDuration } from "./lib/advancePhase";
import { MIN_PLAYERS } from "./lib/gameConfig";

// Ensure game handlers are registered
import "./games/duel";
import "./games/bluff";
import "./games/tegn";
import "./games/telefon";
import "./games/sandhed";

/** Check if a phase accepts player submissions */
function isSubmittablePhase(phase: string): boolean {
  const base = phase.split("_")[0];
  return ["submit", "vote", "draw", "guess", "write", "commit"].includes(base);
}

/** Check if a phase is a vote-type phase */
function isVotePhase(phase: string): boolean {
  const base = phase.split("_")[0];
  return base === "vote";
}

// ── Public mutations ──────────────────────────────────────────────────

export const startGame = mutation({
  args: {
    roomId: v.id("rooms"),
    hostId: v.string(),
  },
  handler: async (ctx, { roomId, hostId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== hostId) throw new Error("Only the host can start");
    if (room.status !== "lobby") throw new Error("Game already started");
    if (!room.gameType) throw new Error("No game selected");

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    if (players.length < MIN_PLAYERS) throw new Error(`Need at least ${MIN_PLAYERS} player(s)`);

    const gameType = room.gameType;
    const handlers = getGameHandlers(gameType);
    const config = handlers.config ?? {};
    const firstPhase = config.initialPhase ?? "submit";
    const totalRounds = config.totalRoundsForPlayerCount
      ? config.totalRoundsForPlayerCount(players.length)
      : Math.min(players.length, 3);
    const roundData = await handlers.setupRound(
      ctx,
      { ...room, roundNumber: 1, totalRounds },
      players,
    );

    const deadline = Date.now() + getPhaseDuration(firstPhase, room.settings as Record<string, unknown> | undefined);
    await ctx.db.patch(roomId, {
      status: "playing",
      currentPhase: firstPhase,
      roundNumber: 1,
      totalRounds,
      phaseData: roundData,
      phaseDeadline: deadline,
    });

    await ctx.scheduler.runAt(
      deadline,
      internal.timers.onTimerExpired,
      { roomId, expectedDeadline: deadline },
    );
  },
});

export const hostAdvance = mutation({
  args: {
    roomId: v.id("rooms"),
    hostId: v.string(),
  },
  handler: async (ctx, { roomId, hostId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== hostId) throw new Error("Only the host can advance");
    if (room.status !== "playing") return;

    await advancePhaseInternal(ctx, room, "HOST_ADVANCE");
  },
});

export const updateSettings = mutation({
  args: {
    roomId: v.id("rooms"),
    hostId: v.string(),
    settings: v.object({
      submitTime: v.optional(v.float64()),
      voteTime: v.optional(v.float64()),
      revealTime: v.optional(v.float64()),
      scoresTime: v.optional(v.float64()),
      drawTime: v.optional(v.float64()),
      guessTime: v.optional(v.float64()),
      writeTime: v.optional(v.float64()),
      commitTime: v.optional(v.float64()),
      tegnDifficulty: v.optional(v.float64()),
      sandhedDifficulty: v.optional(v.float64()),
    }),
  },
  handler: async (ctx, { roomId, hostId, settings }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== hostId) throw new Error("Only the host can change settings");

    await ctx.db.patch(roomId, {
      settings: { ...(room.settings ?? {}), ...settings },
    });
  },
});

export const restartGame = mutation({
  args: {
    roomId: v.id("rooms"),
    hostId: v.string(),
  },
  handler: async (ctx, { roomId, hostId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== hostId) throw new Error("Only the host can restart");

    // Reset room to lobby
    await ctx.db.patch(roomId, {
      status: "lobby",
      currentPhase: undefined,
      phaseData: undefined,
      phaseDeadline: undefined,
      roundNumber: undefined,
      totalRounds: undefined,
    });

    // Reset scores and delete submissions
    const [players, submissions] = await Promise.all([
      ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", roomId))
        .collect(),
      ctx.db
        .query("submissions")
        .withIndex("by_room_round_phase", (q) => q.eq("roomId", roomId))
        .collect(),
    ]);

    await Promise.all([
      ...players.map((p) => ctx.db.patch(p._id, { score: 0 })),
      ...submissions.map((s) => ctx.db.delete(s._id)),
    ]);
  },
});

export const backToLobby = mutation({
  args: {
    roomId: v.id("rooms"),
    hostId: v.string(),
  },
  handler: async (ctx, { roomId, hostId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== hostId) throw new Error("Only the host can return to lobby");

    // Reset room to lobby with no game selected
    await ctx.db.patch(roomId, {
      status: "lobby",
      gameType: undefined,
      currentPhase: undefined,
      phaseData: undefined,
      phaseDeadline: undefined,
      roundNumber: undefined,
      totalRounds: undefined,
    });

    // Reset scores and delete submissions
    const [players, submissions] = await Promise.all([
      ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", roomId))
        .collect(),
      ctx.db
        .query("submissions")
        .withIndex("by_room_round_phase", (q) => q.eq("roomId", roomId))
        .collect(),
    ]);

    await Promise.all([
      ...players.map((p) => ctx.db.patch(p._id, { score: 0 })),
      ...submissions.map((s) => ctx.db.delete(s._id)),
    ]);
  },
});

export const continueGame = mutation({
  args: {
    roomId: v.id("rooms"),
    hostId: v.string(),
  },
  handler: async (ctx, { roomId, hostId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== hostId) throw new Error("Only the host can continue");
    if (room.status !== "playing") return;

    const settings = (room.settings ?? {}) as Record<string, unknown>;
    if (!settings.paused) return;

    const remaining = (settings.pausedRemaining as number) ?? 0;
    const deadline = remaining > 0 ? Date.now() + remaining : undefined;

    // Clear pause state and set new deadline
    const { paused: _, pausedAt: __, pausedRemaining: ___, ...cleanSettings } = settings;
    await ctx.db.patch(roomId, {
      settings: cleanSettings,
      phaseDeadline: deadline,
    });

    // Schedule timer for the remaining time
    if (deadline) {
      await ctx.scheduler.runAt(
        deadline,
        internal.timers.onTimerExpired,
        { roomId, expectedDeadline: deadline },
      );
    }
  },
});

export const telefonAdvanceReveal = mutation({
  args: {
    roomId: v.id("rooms"),
    hostId: v.string(),
  },
  handler: async (ctx, { roomId, hostId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.gameType !== "telefon") return;
    if (room.hostId !== hostId) throw new Error("Only host can advance");
    if (room.currentPhase !== "reveal") return;

    const phaseData = (room.phaseData ?? {}) as any;
    const chains: any[] = phaseData.chains ?? [];
    const chainCount = chains.length;
    let chainIndex: number = phaseData.revealChainIndex ?? 0;
    let stepIndex: number = phaseData.revealStepIndex ?? 0;
    const chainLength = chains[chainIndex]?.length ?? 0;

    if (stepIndex < chainLength - 1) {
      await ctx.db.patch(roomId, {
        phaseData: { ...phaseData, revealStepIndex: stepIndex + 1 },
      });
    } else if (chainIndex < chainCount - 1) {
      await ctx.db.patch(roomId, {
        phaseData: {
          ...phaseData,
          revealChainIndex: chainIndex + 1,
          revealStepIndex: 0,
        },
      });
    } else {
      // All chains revealed → finished
      await ctx.db.patch(roomId, {
        currentPhase: "finished",
        status: "finished",
        phaseDeadline: undefined,
      });
    }
  },
});

export const submitAnswer = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    content: v.any(),
  },
  handler: async (ctx, { roomId, sessionId, content }) => {
    const [room, player] = await Promise.all([
      ctx.db.get(roomId),
      ctx.db
        .query("players")
        .withIndex("by_session_room", (q) =>
          q.eq("sessionId", sessionId).eq("roomId", roomId),
        )
        .first(),
    ]);

    if (!room || !player) throw new Error("Not found");
    if (!room.gameType) throw new Error("No game selected");
    const phase = room.currentPhase ?? "";

    if (!isSubmittablePhase(phase)) {
      throw new Error("Not accepting submissions");
    }

    // Check deadline (2s grace for network latency), skip check if paused
    const settings = (room.settings ?? {}) as Record<string, unknown>;
    if (!settings.paused && room.phaseDeadline && Date.now() > room.phaseDeadline + 2000) {
      return; // silently drop late submissions
    }

    // Guard against oversized submissions (e.g. drawing data)
    const contentSize = JSON.stringify(content).length;
    if (contentSize > 200_000) {
      throw new Error("Indhold er for stort");
    }

    const handlers = getGameHandlers(room.gameType);

    if (isVotePhase(phase)) {
      await handlers.onVote(ctx, room, player, content);
    } else {
      await handlers.onSubmission(ctx, room, player, content);
    }

    // Check if all expected players have submitted
    const [players, submissions] = await Promise.all([
      ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", roomId))
        .collect(),
      ctx.db
        .query("submissions")
        .withIndex("by_room_round_phase", (q) =>
          q
            .eq("roomId", roomId)
            .eq("round", room.roundNumber!)
            .eq("phase", phase),
        )
        .collect(),
    ]);

    const expectedCount = handlers.getExpectedSubmitterCount
      ? handlers.getExpectedSubmitterCount(room, players)
      : players.length;

    if (submissions.length >= expectedCount) {
      await advancePhaseInternal(ctx, room, "ALL_SUBMITTED");
    }
  },
});

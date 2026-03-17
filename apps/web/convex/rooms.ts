import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { generateRoomCode } from "./lib/roomCodes";
import { getGameHandlers } from "./gameHandlers";

// Ensure game handlers are registered
import "./games/duel";
import "./games/bluff";
import "./games/tegn";
import "./games/telefon";
import "./games/sandhed";

export const createRoom = mutation({
  args: {
    hostId: v.string(),
  },
  handler: async (ctx, { hostId }) => {
    // Generate a unique room code
    let code: string;
    let attempts = 0;
    do {
      code = generateRoomCode();
      const existing = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!existing) break;
      attempts++;
    } while (attempts < 100);

    if (attempts >= 100) {
      throw new Error("Could not generate unique room code");
    }

    const roomId = await ctx.db.insert("rooms", {
      code,
      hostId,
      status: "lobby",
      createdAt: Date.now(),
    });

    return { roomId, code };
  },
});

export const changeGameType = mutation({
  args: {
    roomId: v.id("rooms"),
    hostId: v.string(),
    gameType: v.string(),
  },
  handler: async (ctx, { roomId, hostId, gameType }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== hostId) throw new Error("Only the host can change game");
    if (room.status !== "lobby") throw new Error("Can only change game in lobby");
    await ctx.db.patch(roomId, { gameType: gameType || undefined });
  },
});

export const getRoom = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();

    if (!room) return null;

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

    // Track which players have submitted for the current phase
    const phase = room.currentPhase;
    const basePhase = phase?.split("_")[0];
    const isSubmittable = phase && room.roundNumber !== undefined &&
      ["submit", "vote", "draw", "guess", "write", "commit"].includes(basePhase ?? "");

    if (isSubmittable) {
      const submissions = await ctx.db
        .query("submissions")
        .withIndex("by_room_round_phase", (q) =>
          q
            .eq("roomId", room._id)
            .eq("round", room.roundNumber!)
            .eq("phase", phase!),
        )
        .collect();

      const submittedPlayerIds = new Set(
        submissions.map((s) => s.playerId.toString()),
      );

      return {
        ...room,
        players: players.map((p) => ({
          ...p,
          hasSubmitted: submittedPlayerIds.has(p._id.toString()),
        })),
      };
    }

    return { ...room, players };
  },
});

export const getRoomForPlayer = query({
  args: {
    code: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, { code, sessionId }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();

    if (!room) return null;

    // Parallel reads: players + current player + submissions
    const [players, currentPlayer, submissions] = await Promise.all([
      ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect(),
      ctx.db
        .query("players")
        .withIndex("by_session_room", (q) =>
          q.eq("sessionId", sessionId).eq("roomId", room._id),
        )
        .first(),
      room.roundNumber !== undefined
        ? ctx.db
            .query("submissions")
            .withIndex("by_room_round_phase", (q) =>
              q
                .eq("roomId", room._id)
                .eq("round", room.roundNumber!)
                .eq("phase", room.currentPhase ?? ""),
            )
            .collect()
        : Promise.resolve([]),
    ]);

    // Delegate data filtering to the game handler
    let filteredPhaseData = room.phaseData;
    if (room.gameType && room.currentPhase) {
      try {
        const handlers = getGameHandlers(room.gameType);
        filteredPhaseData = handlers.filterForPlayer(room, currentPlayer, submissions, players);
      } catch {
        // No handler registered (e.g., lobby state) — return raw phaseData
      }
    }

    return {
      _id: room._id,
      code: room.code,
      gameType: room.gameType,
      status: room.status,
      currentPhase: room.currentPhase,
      phaseData: filteredPhaseData,
      phaseDeadline: room.phaseDeadline,
      roundNumber: room.roundNumber,
      totalRounds: room.totalRounds,
      players: players.map((p) => ({
        _id: p._id,
        name: p.name,
        avatarColor: p.avatarColor,
        avatarImage: p.avatarImage,
        score: p.score,
        isConnected: p.isConnected,
        hasSubmitted: submissions.some((s) => s.playerId === p._id),
      })),
      currentPlayerId: currentPlayer?._id ?? null,
    };
  },
});

export const getRoomByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    return ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();
  },
});

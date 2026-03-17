import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getAvatarColor } from "./lib/colors";
import { MAX_PLAYERS } from "./lib/gameConfig";

const AVATAR_IMAGES = [
  "alien", "bits", "book", "cat", "clock", "cyberpunk", "cyborg",
  "diamond", "dragon", "eagle", "gargoyle", "hospital", "keys",
  "monkey", "orc", "phoenix", "potion", "robot", "rocket", "squid",
  "staff", "swords", "wolf",
];

export const joinRoom = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    sessionId: v.string(),
    avatarImage: v.optional(v.string()),
  },
  handler: async (ctx, { code, name, sessionId, avatarImage }) => {
    const trimmedName = name.trim().slice(0, 16);
    if (!trimmedName) {
      throw new Error("Navn er påkrævet");
    }

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();

    if (!room) {
      throw new Error("Rummet blev ikke fundet");
    }

    if (room.status !== "lobby") {
      throw new Error("Spillet er allerede i gang");
    }

    // Check if this session already has a player in this room
    const existingPlayer = await ctx.db
      .query("players")
      .withIndex("by_session_room", (q) =>
        q.eq("sessionId", sessionId).eq("roomId", room._id),
      )
      .first();

    if (existingPlayer) {
      // Reconnecting — update connection status
      await ctx.db.patch(existingPlayer._id, {
        isConnected: true,
        lastSeen: Date.now(),
      });
      return { playerId: existingPlayer._id, code: room.code };
    }

    // Check name uniqueness in room
    const playersInRoom = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

    if (playersInRoom.length >= MAX_PLAYERS) {
      throw new Error(`Rummet er fuldt (max ${MAX_PLAYERS} spillere)`);
    }

    const nameTaken = playersInRoom.some(
      (p) => p.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (nameTaken) {
      throw new Error("Navnet er allerede taget");
    }

    const playerIndex = playersInRoom.length;
    const playerId = await ctx.db.insert("players", {
      roomId: room._id,
      name: trimmedName,
      sessionId,
      avatarColor: getAvatarColor(playerIndex),
      avatarImage: (avatarImage && AVATAR_IMAGES.includes(avatarImage)) ? avatarImage : AVATAR_IMAGES[playerIndex % AVATAR_IMAGES.length],
      score: 0,
      isConnected: true,
      lastSeen: Date.now(),
    });

    return { playerId, code: room.code };
  },
});

export const changeAvatar = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    avatarImage: v.string(),
  },
  handler: async (ctx, { roomId, sessionId, avatarImage }) => {
    if (!AVATAR_IMAGES.includes(avatarImage)) return;

    const player = await ctx.db
      .query("players")
      .withIndex("by_session_room", (q) =>
        q.eq("sessionId", sessionId).eq("roomId", roomId),
      )
      .first();

    if (!player) return;

    await ctx.db.patch(player._id, { avatarImage });
  },
});

export const kickPlayer = mutation({
  args: {
    roomId: v.id("rooms"),
    hostId: v.string(),
    playerId: v.id("players"),
  },
  handler: async (ctx, { roomId, hostId, playerId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.hostId !== hostId || room.status !== "lobby") return;

    const player = await ctx.db.get(playerId);
    if (!player || player.roomId !== roomId) return;

    await ctx.db.delete(playerId);
  },
});

export const leaveRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
  },
  handler: async (ctx, { roomId, sessionId }) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_session_room", (q) =>
        q.eq("sessionId", sessionId).eq("roomId", roomId),
      )
      .first();

    if (!player) return;

    await ctx.db.delete(player._id);
  },
});

export const rejoinRoom = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();

    if (players.length === 0) return null;

    const rooms = await Promise.all(players.map((p) => ctx.db.get(p.roomId)));

    for (let i = 0; i < players.length; i++) {
      const room = rooms[i];
      if (room && room.status !== "finished") {
        return {
          playerId: players[i]._id,
          roomCode: room.code,
          playerName: players[i].name,
          roomStatus: room.status,
        };
      }
    }

    return null;
  },
});

export const getPlayers = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    return ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
  },
});

export const heartbeat = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();

    if (players.length === 0) return;

    const rooms = await Promise.all(players.map((p) => ctx.db.get(p.roomId)));
    const now = Date.now();

    const activeRoomIds = new Set<Id<"rooms">>();
    await Promise.all(
      players
        .filter((_, i) => {
          const room = rooms[i];
          if (room && room.status !== "finished") {
            activeRoomIds.add(room._id);
            return true;
          }
          return false;
        })
        .map((p) =>
          ctx.db.patch(p._id, { isConnected: true, lastSeen: now }),
        ),
    );

    // Schedule a sweep for each active room to mark stale players
    for (const roomId of activeRoomIds) {
      await ctx.scheduler.runAfter(
        60_000, // 60s from now
        internal.players.sweepDisconnected,
        { roomId },
      );
    }
  },
});

/** Mark players as disconnected if their lastSeen is older than 60s. */
export const sweepDisconnected = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status === "finished") return;

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    const staleThreshold = Date.now() - 60_000;

    await Promise.all(
      players
        .filter((p) => p.isConnected && p.lastSeen < staleThreshold)
        .map((p) => ctx.db.patch(p._id, { isConnected: false })),
    );
  },
});

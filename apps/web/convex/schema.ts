import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    hostId: v.string(),
    gameType: v.optional(v.string()),
    status: v.union(
      v.literal("lobby"),
      v.literal("playing"),
      v.literal("finished"),
    ),
    currentPhase: v.optional(v.string()),
    phaseData: v.optional(v.any()),
    phaseDeadline: v.optional(v.float64()),
    roundNumber: v.optional(v.float64()),
    totalRounds: v.optional(v.float64()),
    settings: v.optional(v.any()),
    createdAt: v.float64(),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"]),

  players: defineTable({
    roomId: v.id("rooms"),
    name: v.string(),
    sessionId: v.string(),
    avatarColor: v.string(),
    avatarImage: v.optional(v.string()),
    score: v.float64(),
    isConnected: v.boolean(),
    lastSeen: v.float64(),
  })
    .index("by_room", ["roomId"])
    .index("by_session", ["sessionId"])
    .index("by_session_room", ["sessionId", "roomId"]),

  submissions: defineTable({
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    round: v.float64(),
    phase: v.string(),
    content: v.any(),
    createdAt: v.float64(),
  })
    .index("by_room_round_phase", ["roomId", "round", "phase"])
    .index("by_player_round", ["playerId", "round"]),

  prompts: defineTable({
    gameType: v.string(),
    text: v.string(),
    answer: v.optional(v.string()),
    category: v.optional(v.string()),
  }).index("by_game", ["gameType"]),
});

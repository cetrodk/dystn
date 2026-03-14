import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { registerGameHandlers } from "../gameHandlers";

const TRUTH_ID = "__TRUTH__";

registerGameHandlers("bluff", {
  async setupRound(ctx, _room, _players) {
    let allPrompts = await ctx.db
      .query("prompts")
      .withIndex("by_game", (q) => q.eq("gameType", "bluff"))
      .collect();

    // Filter to only prompts that have an answer
    allPrompts = allPrompts.filter((p) => !!p.answer);

    // Track which prompts have been used across all rounds in this game
    const usedPromptIds: string[] = ((_room.phaseData as any)?.usedPromptIds ?? []);

    if (allPrompts.length === 0) {
      // Insert a fallback prompt so the answer is always in the DB
      const id = await ctx.db.insert("prompts", {
        gameType: "bluff",
        text: "Verdens største ___ blev fundet i 2019",
        answer: "trøffel",
      });
      return {
        promptText: "Verdens største ___ blev fundet i 2019",
        promptId: id,
        usedPromptIds: [...usedPromptIds, id],
      };
    }

    // Filter out already-used prompts; if all used, reset
    let candidates = allPrompts.filter((p) => !usedPromptIds.includes(p._id));
    if (candidates.length === 0) candidates = allPrompts;

    const prompt = candidates[Math.floor(Math.random() * candidates.length)];
    return {
      promptText: prompt.text,
      promptId: prompt._id,
      usedPromptIds: [...usedPromptIds, prompt._id],
    };
  },

  async onSubmission(ctx, room, player, content) {
    const text = String(content).trim().slice(0, 80);
    if (!text) throw new Error("Tomt svar");

    // Reject if it matches the real answer (case-insensitive)
    const promptId = (room.phaseData as any)?.promptId;
    if (promptId) {
      const prompt = await ctx.db.get(promptId as Id<"prompts">);
      if (
        prompt?.answer &&
        text.toLowerCase() === prompt.answer.toLowerCase()
      ) {
        throw new ConvexError("Prøv et andet svar");
      }
    }

    // Check for existing submission
    const existing = await ctx.db
      .query("submissions")
      .withIndex("by_player_round", (q) =>
        q.eq("playerId", player._id).eq("round", room.roundNumber!),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("roomId"), room._id),
          q.eq(q.field("phase"), "submit"),
        ),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { content: text });
      return;
    }

    await ctx.db.insert("submissions", {
      roomId: room._id,
      playerId: player._id,
      round: room.roundNumber!,
      phase: "submit",
      content: text,
      createdAt: Date.now(),
    });
  },

  async buildVoteData(ctx, room, _players) {
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_room_round_phase", (q) =>
        q
          .eq("roomId", room._id)
          .eq("round", room.roundNumber!)
          .eq("phase", "submit"),
      )
      .collect();

    // Fetch the real answer from the prompts table (server-side only)
    const promptId = (room.phaseData as any)?.promptId;
    let realAnswer = "Ukendt svar";
    if (promptId) {
      const prompt = await ctx.db.get(promptId as Id<"prompts">);
      if (prompt?.answer) realAnswer = prompt.answer;
    }

    // Build options: all fakes + the real answer
    const options = submissions.map((s) => ({
      id: s._id as string,
      text: String(s.content),
      playerId: s.playerId,
    }));

    // Add the real answer as a synthetic option
    options.push({
      id: TRUTH_ID,
      text: realAnswer,
      playerId: null as any,
    });

    // Shuffle
    const shuffled = options.sort(() => Math.random() - 0.5);

    const answers = shuffled.map((o) => ({
      id: o.id,
      text: o.text,
      playerId: o.playerId,
    }));

    return {
      ...room.phaseData,
      answers,
      // Anonymized: strip playerIds so players can't tell which is theirs by ID
      answersAnonymized: answers.map((a) => ({ id: a.id, text: a.text })),
    };
  },

  async onVote(ctx, room, player, content) {
    const vote = String(content);

    const existing = await ctx.db
      .query("submissions")
      .withIndex("by_player_round", (q) =>
        q.eq("playerId", player._id).eq("round", room.roundNumber!),
      )
      .filter((q) => q.eq(q.field("phase"), "vote"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { content: vote });
      return;
    }

    await ctx.db.insert("submissions", {
      roomId: room._id,
      playerId: player._id,
      round: room.roundNumber!,
      phase: "vote",
      content: vote,
      createdAt: Date.now(),
    });
  },

  async computeResults(ctx, room, players) {
    const [submissions, votes] = await Promise.all([
      ctx.db
        .query("submissions")
        .withIndex("by_room_round_phase", (q) =>
          q
            .eq("roomId", room._id)
            .eq("round", room.roundNumber!)
            .eq("phase", "submit"),
        )
        .collect(),
      ctx.db
        .query("submissions")
        .withIndex("by_room_round_phase", (q) =>
          q
            .eq("roomId", room._id)
            .eq("round", room.roundNumber!)
            .eq("phase", "vote"),
        )
        .collect(),
    ]);

    // Fetch real answer for display
    const promptId = (room.phaseData as any)?.promptId;
    let realAnswer = "Ukendt svar";
    if (promptId) {
      const prompt = await ctx.db.get(promptId as Id<"prompts">);
      if (prompt?.answer) realAnswer = prompt.answer;
    }

    // Tally votes per answer ID
    const votesPerAnswer = new Map<string, Id<"players">[]>();
    for (const vote of votes) {
      const answerId = String(vote.content);
      const arr = votesPerAnswer.get(answerId) ?? [];
      arr.push(vote.playerId);
      votesPerAnswer.set(answerId, arr);
    }

    const scoreDeltas = new Map<Id<"players">, number>();

    // +1000 for guessing the real answer
    const truthVoters = votesPerAnswer.get(TRUTH_ID) ?? [];
    for (const playerId of truthVoters) {
      scoreDeltas.set(playerId, (scoreDeltas.get(playerId) ?? 0) + 1000);
    }

    // Build results for each answer (fakes + truth)
    const results: Array<{
      answerId: string;
      text: string;
      isReal: boolean;
      playerId: string | null;
      playerName: string | null;
      avatarColor: string | null;
      avatarImage?: string;
      voterNames: string[];
      fooledCount: number;
    }> = [];

    // Process fakes: +500 per player fooled
    for (const sub of submissions) {
      const voterIds = votesPerAnswer.get(sub._id as string) ?? [];
      const fooledCount = voterIds.length;
      const player = players.find((p) => p._id === sub.playerId);

      if (fooledCount > 0) {
        scoreDeltas.set(
          sub.playerId,
          (scoreDeltas.get(sub.playerId) ?? 0) + fooledCount * 500,
        );
      }

      results.push({
        answerId: sub._id as string,
        text: String(sub.content),
        isReal: false,
        playerId: sub.playerId,
        playerName: player?.name ?? "???",
        avatarColor: player?.avatarColor ?? "#888",
        avatarImage: player?.avatarImage,
        voterNames: voterIds.map(
          (vid) => players.find((p) => p._id === vid)?.name ?? "???",
        ),
        fooledCount,
      });
    }

    // Add the truth entry
    results.push({
      answerId: TRUTH_ID,
      text: realAnswer,
      isReal: true,
      playerId: null,
      playerName: null,
      avatarColor: null,
      voterNames: truthVoters.map(
        (vid) => players.find((p) => p._id === vid)?.name ?? "???",
      ),
      fooledCount: 0,
    });

    // Sort: fakes by fooledCount desc, truth last
    results.sort((a, b) => {
      if (a.isReal) return 1;
      if (b.isReal) return -1;
      return b.fooledCount - a.fooledCount;
    });

    return {
      phaseData: {
        ...room.phaseData,
        results,
        realAnswer,
        totalVotes: votes.length,
      },
      scoreDeltas,
    };
  },
});

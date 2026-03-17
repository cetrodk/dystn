import type { Id } from "../_generated/dataModel";
import { registerGameHandlers, type PhaseTransition } from "../gameHandlers";

registerGameHandlers("duel", {
  async setupRound(ctx, _room, _players) {
    // Pick a random prompt
    const allPrompts = await ctx.db
      .query("prompts")
      .withIndex("by_game", (q) => q.eq("gameType", "duel"))
      .collect();

    if (allPrompts.length === 0) {
      // Fallback prompt if none seeded
      return {
        promptText: "Hvad er det bedste ved at være dansk?",
        promptId: null,
      };
    }

    const prompt = allPrompts[Math.floor(Math.random() * allPrompts.length)];
    return {
      promptText: prompt.text,
      promptId: prompt._id,
    };
  },

  async onSubmission(ctx, room, player, content) {
    const text = String(content).trim().slice(0, 280);
    if (!text) throw new Error("Tomt svar");

    // Check for duplicate submission in THIS room
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
      // Update existing submission
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

    // All answers compete in a single pool — everyone votes for their favorite
    const shuffled = [...submissions].sort(() => Math.random() - 0.5);
    const answers = shuffled.map((s) => ({
      id: s._id,
      text: String(s.content),
      playerId: s.playerId,
    }));

    return {
      ...room.phaseData,
      answers,
      // Anonymized version for players (strip playerIds)
      answersAnonymized: answers.map((a) => ({ id: a.id, text: a.text })),
    };
  },

  async onVote(ctx, room, player, content) {
    const vote = String(content); // submission ID they voted for

    // Check for duplicate vote
    const existing = await ctx.db
      .query("submissions")
      .withIndex("by_player_round", (q) =>
        q.eq("playerId", player._id).eq("round", room.roundNumber!),
      )
      .filter((q) => q.and(
        q.eq(q.field("roomId"), room._id),
        q.eq(q.field("phase"), "vote"),
      ))
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

    // Tally votes per answer
    const voteCounts = new Map<string, number>();
    for (const vote of votes) {
      const answerId = String(vote.content);
      voteCounts.set(answerId, (voteCounts.get(answerId) ?? 0) + 1);
    }

    // Calculate scores: 1000 points per vote received
    const scoreDeltas = new Map<Id<"players">, number>();
    const results: Array<{
      answerId: string;
      text: string;
      playerId: string;
      playerName: string;
      avatarColor: string;
      avatarImage?: string;
      votes: number;
    }> = [];

    for (const sub of submissions) {
      const voteCount = voteCounts.get(sub._id) ?? 0;
      const delta = voteCount * 1000;
      const player = players.find((p) => p._id === sub.playerId);

      if (delta > 0) {
        scoreDeltas.set(
          sub.playerId,
          (scoreDeltas.get(sub.playerId) ?? 0) + delta,
        );
      }

      results.push({
        answerId: sub._id,
        text: String(sub.content),
        playerId: sub.playerId,
        playerName: player?.name ?? "???",
        avatarColor: player?.avatarColor ?? "#888",
        avatarImage: player?.avatarImage,
        votes: voteCount,
      });
    }

    // Sort by votes descending
    results.sort((a, b) => b.votes - a.votes);

    return {
      phaseData: {
        ...room.phaseData,
        results,
        totalVotes: votes.length,
      },
      scoreDeltas,
    };
  },

  filterForPlayer(room, currentPlayer, submissions) {
    const phase = room.currentPhase ?? "";
    const pd = (room.phaseData ?? {}) as any;

    if (phase === "submit") {
      const mySubmission = submissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer._id,
      );
      return {
        ...pd,
        mySubmission: mySubmission?.content ?? null,
        submittedCount: submissions.length,
      };
    }
    if (phase === "present") {
      const { answersAnonymized: _, answers: __, ...rest } = pd;
      return rest;
    }
    if (phase === "vote") {
      const myVote = submissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer._id && s.phase === "vote",
      );
      const answers = (pd.answersAnonymized ?? []) as Array<{ id: string; text: string }>;
      const myAnswerId = currentPlayer
        ? (pd.answers ?? []).find((a: any) => a.playerId === currentPlayer._id)?.id
        : undefined;
      return {
        ...pd,
        answersAnonymized: answers.map((a) => ({ ...a, isOwn: a.id === myAnswerId })),
        myVote: myVote?.content ?? null,
      };
    }
    // reveal/scores: return as-is
    return pd ?? {};
  },

  getNextPhase(currentPhase, _event, room): PhaseTransition {
    const roundNumber = room.roundNumber ?? 1;
    const totalRounds = room.totalRounds ?? 1;

    switch (currentPhase) {
      case "submit":
        return { nextPhase: "present", action: { type: "buildVote" } };
      case "present":
        return { nextPhase: "vote", action: { type: "none" } };
      case "vote":
        return { nextPhase: "reveal", action: { type: "computeResults" } };
      case "reveal":
        if (roundNumber >= totalRounds) {
          return { nextPhase: "finished", action: { type: "finish" } };
        }
        return { nextPhase: "scores", action: { type: "none" } };
      case "scores":
        if (roundNumber >= totalRounds) {
          return { nextPhase: "finished", action: { type: "finish" } };
        }
        return { nextPhase: "submit", action: { type: "setup" }, advanceRound: true };
      default:
        return { nextPhase: "finished", action: { type: "finish" } };
    }
  },
});

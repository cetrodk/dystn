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

    // Merge duplicate answers (case-insensitive)
    const seen = new Map<string, typeof answers[number]>();
    const answers: Array<{
      id: string;
      text: string;
      playerId: string;
      mergedIds?: string[];
      mergedPlayerIds?: string[];
    }> = [];

    const shuffled = [...submissions].sort(() => Math.random() - 0.5);
    for (const s of shuffled) {
      const key = String(s.content).toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        // Merge: track additional authors
        existing.mergedIds = existing.mergedIds ?? [existing.id];
        existing.mergedIds.push(s._id);
        existing.mergedPlayerIds = existing.mergedPlayerIds ?? [existing.playerId];
        existing.mergedPlayerIds.push(s.playerId);
      } else {
        const entry = { id: s._id as string, text: String(s.content), playerId: s.playerId as string };
        answers.push(entry);
        seen.set(key, entry);
      }
    }

    return {
      ...room.phaseData,
      answers,
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

    // Calculate scores using the merged answer map from buildVoteData
    const scoreDeltas = new Map<Id<"players">, number>();
    const pdAnswers = ((room.phaseData as any)?.answers ?? []) as Array<{
      id: string;
      playerId: string;
      mergedPlayerIds?: string[];
      text: string;
    }>;
    const results: Array<{
      answerId: string;
      text: string;
      playerId: string;
      playerName: string;
      avatarColor: string;
      avatarImage?: string;
      votes: number;
      coAuthors?: Array<{ name: string; avatarColor: string; avatarImage?: string }>;
    }> = [];

    for (const answer of pdAnswers) {
      const voteCount = voteCounts.get(answer.id) ?? 0;
      const delta = voteCount * 1000;

      // Credit all merged authors equally
      const authorIds = answer.mergedPlayerIds ?? [answer.playerId];
      for (const pid of authorIds) {
        if (delta > 0) {
          scoreDeltas.set(
            pid as Id<"players">,
            (scoreDeltas.get(pid as Id<"players">) ?? 0) + delta,
          );
        }
      }

      const primaryPlayer = players.find((p) => p._id === answer.playerId);
      const coAuthors = authorIds.length > 1
        ? authorIds.slice(1).map((pid) => {
            const p = players.find((pl) => pl._id === pid);
            return { name: p?.name ?? "???", avatarColor: p?.avatarColor ?? "#888", avatarImage: p?.avatarImage };
          })
        : undefined;

      results.push({
        answerId: answer.id,
        text: answer.text,
        playerId: answer.playerId,
        playerName: primaryPlayer?.name ?? "???",
        avatarColor: primaryPlayer?.avatarColor ?? "#888",
        avatarImage: primaryPlayer?.avatarImage,
        votes: voteCount,
        coAuthors,
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
      // Check both primary and merged player IDs for "isOwn"
      const myAnswerId = currentPlayer
        ? (pd.answers ?? []).find((a: any) =>
            a.playerId === currentPlayer._id ||
            (a.mergedPlayerIds ?? []).includes(currentPlayer._id),
          )?.id
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

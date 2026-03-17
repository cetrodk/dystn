import type { Id } from "../_generated/dataModel";
import { registerGameHandlers, type PhaseTransition } from "../gameHandlers";

const FINISH_LINE = 8;

registerGameHandlers("sandhed", {
  config: {
    initialPhase: "countdown",
    totalRoundsForPlayerCount: () => 100, // dynamic: game ends via victory check, not round limit
  },
  async setupRound(ctx, room, players) {
    // Carry forward track positions from previous round, or initialize
    const prevPositions =
      (room.phaseData as Record<string, unknown>)?.trackPositions as
        | Record<string, number>
        | undefined;
    const trackPositions: Record<string, number> = {};
    for (const p of players) {
      trackPositions[p._id] = prevPositions?.[p._id] ?? 0;
    }

    // Track which prompts we've already used
    const usedPromptIds =
      ((room.phaseData as Record<string, unknown>)?.usedPromptIds as string[]) ?? [];

    // Pick an unused statement
    const allPrompts = await ctx.db
      .query("prompts")
      .withIndex("by_game", (q) => q.eq("gameType", "sandhed"))
      .collect();

    const unused = allPrompts.filter((p) => !usedPromptIds.includes(p._id));
    const pool = unused.length > 0 ? unused : allPrompts; // recycle if exhausted

    if (pool.length === 0) {
      // Fallback if no prompts are seeded
      return {
        statement: "Danmark har flere øer end Sverige",
        correctAnswer: "true",
        trackPositions,
        currentChoices: {} as Record<string, string>,
        finishLine: FINISH_LINE,
        statementIndex: (room.roundNumber ?? 1),
        usedPromptIds,
      };
    }

    const prompt = pool[Math.floor(Math.random() * pool.length)];

    return {
      statement: prompt.text,
      correctAnswer: prompt.answer ?? "true",
      trackPositions,
      currentChoices: {} as Record<string, string>,
      finishLine: FINISH_LINE,
      statementIndex: (room.roundNumber ?? 1),
      usedPromptIds: [...usedPromptIds, prompt._id],
    };
  },

  async onSubmission(ctx, room, player, content) {
    const { choice } = content as { choice: "true" | "false" | "transit" };
    if (!["true", "false", "transit"].includes(choice)) {
      throw new Error("Ugyldigt valg");
    }

    // Upsert submission
    const existing = await ctx.db
      .query("submissions")
      .withIndex("by_player_round", (q) =>
        q.eq("playerId", player._id).eq("round", room.roundNumber!),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("roomId"), room._id),
          q.eq(q.field("phase"), "commit"),
        ),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { content: { choice } });
    } else {
      await ctx.db.insert("submissions", {
        roomId: room._id,
        playerId: player._id,
        round: room.roundNumber!,
        phase: "commit",
        content: { choice },
        createdAt: Date.now(),
      });
    }

    // Broadcast position to all clients by patching phaseData
    const currentChoices = {
      ...((room.phaseData as Record<string, unknown>)?.currentChoices as Record<string, string> ?? {}),
    };
    currentChoices[player._id] = choice;
    await ctx.db.patch(room._id, {
      phaseData: { ...(room.phaseData ?? {}), currentChoices },
    });
  },

  async buildVoteData() {
    throw new Error("Sandhed has no vote phase");
  },

  async onVote() {
    throw new Error("Sandhed has no vote phase");
  },

  async computeResults(ctx, room, players) {
    const pd = (room.phaseData ?? {}) as Record<string, unknown>;
    const correctAnswer = pd.correctAnswer as string;
    const trackPositions = { ...(pd.trackPositions as Record<string, number>) };

    // Read final submissions
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_room_round_phase", (q) =>
        q
          .eq("roomId", room._id)
          .eq("round", room.roundNumber!)
          .eq("phase", "commit"),
      )
      .collect();

    const submissionMap = new Map(
      submissions.map((s) => [
        s.playerId.toString(),
        (s.content as { choice: string }).choice,
      ]),
    );

    const results: Array<{
      playerId: string;
      playerName: string;
      avatarColor: string;
      choice: string | null;
      correct: boolean;
      noAnswer: boolean;
      delta: number;
      newPosition: number;
    }> = [];

    const scoreDeltas = new Map<Id<"players">, number>();

    for (const player of players) {
      const choice = submissionMap.get(player._id.toString());
      const isNoAnswer = !choice || choice === "transit";
      const isCorrect = !isNoAnswer && choice === correctAnswer;

      let delta = 0;
      if (isNoAnswer) {
        delta = 0;
      } else if (isCorrect) {
        delta = 1;
      } else {
        delta = -1;
      }

      const currentPos = trackPositions[player._id] ?? 0;
      const newPosition = Math.max(0, Math.min(FINISH_LINE, currentPos + delta));
      trackPositions[player._id] = newPosition;

      // Also give score points for the leaderboard (100 per correct)
      if (isCorrect) {
        scoreDeltas.set(player._id, 100);
      }

      results.push({
        playerId: player._id,
        playerName: player.name,
        avatarColor: player.avatarColor,
        choice: isNoAnswer ? null : choice,
        correct: isCorrect,
        noAnswer: isNoAnswer,
        delta,
        newPosition,
      });
    }

    // Check win condition
    const winners = players
      .filter((p) => (trackPositions[p._id] ?? 0) >= FINISH_LINE)
      .map((p) => p._id as string);

    return {
      phaseData: {
        ...pd,
        trackPositions,
        results,
        winners: winners.length > 0 ? winners : undefined,
      },
      scoreDeltas,
    };
  },

  // Prevent auto-advance: the 10-second timer always runs
  getExpectedSubmitterCount() {
    return Infinity;
  },

  filterForPlayer(room, _currentPlayer, _submissions, _players) {
    const phase = room.currentPhase ?? "";
    const pd = (room.phaseData ?? {}) as Record<string, unknown>;

    if (phase === "commit") {
      // Hide correctAnswer during commit — everything else is visible (that's the game)
      const { correctAnswer: _, usedPromptIds: __, ...visible } = pd;
      return visible;
    }

    // reveal, victory: show everything except internal tracking
    const { usedPromptIds: _, ...visible } = pd;
    return visible;
  },

  getNextPhase(currentPhase, _event, room): PhaseTransition {
    switch (currentPhase) {
      case "countdown":
        return { nextPhase: "commit", action: { type: "setup" } };
      case "commit":
        return {
          nextPhase: "reveal",
          action: { type: "computeResults" },
          timerOverride: 7_000,
        };
      case "reveal": {
        const pd = (room.phaseData ?? {}) as Record<string, unknown>;
        const winners = pd.winners as string[] | undefined;
        if (winners && winners.length > 0) {
          return {
            nextPhase: "victory",
            action: { type: "none" },
            timerOverride: 15_000,
          };
        }
        return {
          nextPhase: "commit",
          action: { type: "setup" },
          advanceRound: true,
        };
      }
      case "victory":
        return { nextPhase: "finished", action: { type: "finish" } };
      default:
        return { nextPhase: "finished", action: { type: "finish" } };
    }
  },
});

import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { registerGameHandlers, type PhaseTransition } from "../gameHandlers";

/**
 * Telefon (Gartic Phone clone) — chain-based telephone drawing game.
 *
 * Flow: write → draw_0 → guess_0 → draw_1 → guess_1 → ... → reveal → finished
 *
 * With N players there are N chains, each of length 2*(N-1)+1 items.
 * Chain assignment: at draw_K, player[j] draws from chain (j-K-1+N)%N.
 * At guess_K, player[j] guesses from player[(j-1+N)%N]'s draw_K submission.
 */

registerGameHandlers("telefon", {
  async setupRound(_ctx, _room, players) {
    const playerIds = players
      .map((p) => p._id as string)
      .sort(() => Math.random() - 0.5);
    const N = playerIds.length;
    return {
      playerIds,
      chainCount: N,
      stepCount: N - 1, // number of draw/guess pairs
    };
  },

  async onSubmission(ctx, room, player, content) {
    const basePhase = room.currentPhase?.split("_")[0];
    const phase = room.currentPhase!;

    if (basePhase === "write") {
      const text = String(content).trim().slice(0, 120);
      if (!text) throw new ConvexError("Skriv noget først");

      const existing = await ctx.db
        .query("submissions")
        .withIndex("by_room_round_phase", (q) =>
          q
            .eq("roomId", room._id)
            .eq("round", room.roundNumber!)
            .eq("phase", "write"),
        )
        .filter((q) => q.eq(q.field("playerId"), player._id))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { content: text });
        return;
      }

      await ctx.db.insert("submissions", {
        roomId: room._id,
        playerId: player._id,
        round: room.roundNumber!,
        phase: "write",
        content: text,
        createdAt: Date.now(),
      });
    } else if (basePhase === "draw") {
      const strokes = Array.isArray(content)
        ? content
        : (content as any)?.strokes;
      if (!Array.isArray(strokes) || strokes.length === 0) {
        throw new ConvexError("Tegn noget først");
      }

      const existing = await ctx.db
        .query("submissions")
        .withIndex("by_room_round_phase", (q) =>
          q
            .eq("roomId", room._id)
            .eq("round", room.roundNumber!)
            .eq("phase", phase),
        )
        .filter((q) => q.eq(q.field("playerId"), player._id))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { content });
        return;
      }

      await ctx.db.insert("submissions", {
        roomId: room._id,
        playerId: player._id,
        round: room.roundNumber!,
        phase,
        content,
        createdAt: Date.now(),
      });
    } else if (basePhase === "guess") {
      const text = String(content).trim().slice(0, 120);
      if (!text) throw new ConvexError("Tomt gæt");

      const existing = await ctx.db
        .query("submissions")
        .withIndex("by_room_round_phase", (q) =>
          q
            .eq("roomId", room._id)
            .eq("round", room.roundNumber!)
            .eq("phase", phase),
        )
        .filter((q) => q.eq(q.field("playerId"), player._id))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { content: text });
        return;
      }

      await ctx.db.insert("submissions", {
        roomId: room._id,
        playerId: player._id,
        round: room.roundNumber!,
        phase,
        content: text,
        createdAt: Date.now(),
      });
    }
  },

  async buildVoteData(_ctx, room, _players) {
    // Telefon has no voting — no-op
    return { ...(room.phaseData ?? {}) };
  },

  async onVote() {
    throw new ConvexError("Ingen afstemning i Telefon");
  },

  async computeResults(ctx, room, players) {
    const phaseData = room.phaseData as any;
    const playerIds: string[] = phaseData?.playerIds ?? [];
    const N = playerIds.length;
    const stepCount: number = phaseData?.stepCount ?? N - 1;

    // Build player lookup
    const playerMap = new Map(players.map((p) => [p._id as string, p]));

    // Fetch all submissions for this round
    const allSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_room_round_phase", (q) =>
        q.eq("roomId", room._id).eq("round", room.roundNumber!),
      )
      .collect();

    // Group by phase
    const subsByPhase = new Map<string, Map<string, any>>();
    for (const s of allSubmissions) {
      if (!subsByPhase.has(s.phase)) subsByPhase.set(s.phase, new Map());
      subsByPhase.get(s.phase)!.set(s.playerId as string, s.content);
    }

    // Reconstruct chains
    const chains: Array<
      Array<{
        type: "write" | "draw" | "guess";
        playerId: string;
        playerName: string;
        avatarColor: string;
        avatarImage?: string;
        content: unknown;
      }>
    > = [];

    for (let c = 0; c < N; c++) {
      const chain: typeof chains[number] = [];
      const owner = playerIds[c];
      const ownerPlayer = playerMap.get(owner);

      // Step 0: the write
      chain.push({
        type: "write",
        playerId: owner,
        playerName: ownerPlayer?.name ?? "???",
        avatarColor: ownerPlayer?.avatarColor ?? "#888",
        avatarImage: ownerPlayer?.avatarImage,
        content:
          subsByPhase.get("write")?.get(owner) ?? "???",
      });

      for (let K = 0; K < stepCount; K++) {
        // Who drew for chain c at draw_K?
        const drawerIdx = (c + K + 1) % N;
        const drawerId = playerIds[drawerIdx];
        const drawerPlayer = playerMap.get(drawerId);
        chain.push({
          type: "draw",
          playerId: drawerId,
          playerName: drawerPlayer?.name ?? "???",
          avatarColor: drawerPlayer?.avatarColor ?? "#888",
          avatarImage: drawerPlayer?.avatarImage,
          content:
            subsByPhase.get(`draw_${K}`)?.get(drawerId) ?? null,
        });

        // Who guessed for chain c at guess_K?
        const guesserIdx = (drawerIdx + 1) % N;
        const guesserId = playerIds[guesserIdx];
        const guesserPlayer = playerMap.get(guesserId);
        chain.push({
          type: "guess",
          playerId: guesserId,
          playerName: guesserPlayer?.name ?? "???",
          avatarColor: guesserPlayer?.avatarColor ?? "#888",
          avatarImage: guesserPlayer?.avatarImage,
          content:
            subsByPhase.get(`guess_${K}`)?.get(guesserId) ?? "???",
        });
      }

      chains.push(chain);
    }

    // Score: 500 points if final guess matches original write (case-insensitive)
    const scoreDeltas = new Map<Id<"players">, number>();
    for (let c = 0; c < N; c++) {
      const original = String(chains[c][0].content).toLowerCase().trim();
      const finalGuess = String(
        chains[c][chains[c].length - 1].content,
      )
        .toLowerCase()
        .trim();
      if (original === finalGuess && chains[c].length > 1) {
        const guesserId = chains[c][chains[c].length - 1].playerId as Id<"players">;
        scoreDeltas.set(guesserId, (scoreDeltas.get(guesserId) ?? 0) + 500);
      }
    }

    return {
      phaseData: {
        ...phaseData,
        chains,
        revealChainIndex: 0,
        revealStepIndex: 0,
      },
      scoreDeltas,
    };
  },

  async buildGuessData(ctx, room, _players, stepK) {
    const phaseData = room.phaseData as any;
    const playerIds: string[] = phaseData?.playerIds ?? [];
    const N = playerIds.length;
    const basePhase = room.currentPhase?.split("_")[0];

    if (basePhase === "write" || basePhase === "guess") {
      // Building assignments for draw_K
      const sourcePhase =
        stepK === 0 ? "write" : `guess_${stepK - 1}`;
      const sourceSubmissions = await ctx.db
        .query("submissions")
        .withIndex("by_room_round_phase", (q) =>
          q
            .eq("roomId", room._id)
            .eq("round", room.roundNumber!)
            .eq("phase", sourcePhase),
        )
        .collect();
      const subByPlayer = new Map(
        sourceSubmissions.map((s) => [s.playerId as string, s.content]),
      );

      const assignments: Record<string, { myPrompt: string }> = {};
      for (let j = 0; j < N; j++) {
        const sourceIdx = ((j - stepK - 1) % N + N) % N;
        const sourcePlayerId = playerIds[sourceIdx];
        assignments[playerIds[j]] = {
          myPrompt: String(subByPlayer.get(sourcePlayerId) ?? "???"),
        };
      }
      return {
        ...phaseData,
        assignments,
        currentStep: stepK,
        stepPhase: "draw",
        // Clear previous step data
        chains: undefined,
        revealChainIndex: undefined,
        revealStepIndex: undefined,
      };
    } else {
      // Building assignments for guess_K — source is draw_K from player (j-1+N)%N
      const sourcePhase = `draw_${stepK}`;
      const sourceSubmissions = await ctx.db
        .query("submissions")
        .withIndex("by_room_round_phase", (q) =>
          q
            .eq("roomId", room._id)
            .eq("round", room.roundNumber!)
            .eq("phase", sourcePhase),
        )
        .collect();
      const subByPlayer = new Map(
        sourceSubmissions.map((s) => [s.playerId as string, s.content]),
      );

      const assignments: Record<string, { myDrawingData: unknown }> =
        {};
      for (let j = 0; j < N; j++) {
        const sourceIdx = ((j - 1) % N + N) % N;
        const sourcePlayerId = playerIds[sourceIdx];
        assignments[playerIds[j]] = {
          myDrawingData: subByPlayer.get(sourcePlayerId) ?? null,
        };
      }
      return {
        ...phaseData,
        assignments,
        currentStep: stepK,
        stepPhase: "guess",
        chains: undefined,
        revealChainIndex: undefined,
        revealStepIndex: undefined,
      };
    }
  },

  getExpectedSubmitterCount(_room, players) {
    return players.length; // everyone participates in every phase
  },

  getNextPhase(currentPhase, _event, room): PhaseTransition {
    const [base, idxStr] = currentPhase.split("_");
    const idx = idxStr !== undefined ? parseInt(idxStr, 10) : 0;
    const pd = (room.phaseData ?? {}) as any;
    const stepCount: number = pd?.stepCount ?? 1;

    if (currentPhase === "write") {
      return { nextPhase: "draw_0", action: { type: "buildGuess", drawingIndex: 0 } };
    }
    if (base === "draw" && idxStr !== undefined) {
      // draw_K → guess_K
      return { nextPhase: `guess_${idx}`, action: { type: "buildGuess", drawingIndex: idx } };
    }
    if (base === "guess" && idxStr !== undefined) {
      // guess_K → draw_(K+1) or reveal
      if (idx < stepCount - 1) {
        return { nextPhase: `draw_${idx + 1}`, action: { type: "buildGuess", drawingIndex: idx + 1 } };
      }
      return { nextPhase: "reveal", action: { type: "computeResults" }, timerOverride: 5 * 60_000 };
    }
    if (currentPhase === "reveal") {
      return { nextPhase: "finished", action: { type: "finish" } };
    }
    return { nextPhase: "finished", action: { type: "finish" } };
  },
});

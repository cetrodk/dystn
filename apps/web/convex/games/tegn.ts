import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { registerGameHandlers, type PhaseTransition } from "../gameHandlers";

const TRUTH_ID = "__TRUTH__";

registerGameHandlers("tegn", {
  async setupRound(ctx, _room, players) {
    let allPrompts = await ctx.db
      .query("prompts")
      .withIndex("by_game", (q) => q.eq("gameType", "tegn"))
      .collect();

    // Shuffle players to determine drawing order
    const drawingOrder = players
      .map((p) => p._id)
      .sort(() => Math.random() - 0.5);

    // Pick one word per player (no repeats)
    const shuffledPrompts = [...allPrompts].sort(() => Math.random() - 0.5);
    const drawingWords: Record<string, string> = {};

    for (let i = 0; i < drawingOrder.length; i++) {
      const prompt = shuffledPrompts[i % Math.max(shuffledPrompts.length, 1)];
      drawingWords[drawingOrder[i]] = prompt?.text ?? "en hest";
    }

    return {
      drawingOrder,
      drawingWords,
      totalDrawings: drawingOrder.length,
      drawingIndex: 0,
    };
  },

  async onSubmission(ctx, room, player, content) {
    const phaseData = room.phaseData as any;
    const basePhase = room.currentPhase?.split("_")[0];

    if (basePhase === "draw") {
      // Content is { strokes, viewBoxHeight } or legacy strokes array
      const strokes = Array.isArray(content) ? content : (content as any)?.strokes;
      if (!Array.isArray(strokes) || strokes.length === 0) {
        throw new ConvexError("Tegn noget først");
      }

      const existing = await ctx.db
        .query("submissions")
        .withIndex("by_player_round", (q) =>
          q.eq("playerId", player._id).eq("round", room.roundNumber!),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("roomId"), room._id),
            q.eq(q.field("phase"), "draw"),
          ),
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { content });
        return;
      }

      await ctx.db.insert("submissions", {
        roomId: room._id,
        playerId: player._id,
        round: room.roundNumber!,
        phase: "draw",
        content,
        createdAt: Date.now(),
      });
    } else if (basePhase === "guess") {
      // Artist cannot guess
      if (player._id === phaseData?.currentArtistId) {
        throw new ConvexError("Kunstnere gætter ikke");
      }

      const text = String(content).trim().slice(0, 80);
      if (!text) throw new ConvexError("Tomt gæt");

      // Check if matches real word (case-insensitive)
      const artistId = phaseData?.currentArtistId;
      const drawingWords = phaseData?.drawingWords;
      if (artistId && drawingWords?.[artistId]) {
        if (text.toLowerCase() === drawingWords[artistId].toLowerCase()) {
          throw new ConvexError("Prøv et andet gæt");
        }
      }

      const phase = room.currentPhase!;
      const existing = await ctx.db
        .query("submissions")
        .withIndex("by_player_round", (q) =>
          q.eq("playerId", player._id).eq("round", room.roundNumber!),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("roomId"), room._id),
            q.eq(q.field("phase"), phase),
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
        phase,
        content: text,
        createdAt: Date.now(),
      });
    }
  },

  async buildVoteData(ctx, room, _players) {
    const phase = room.currentPhase!; // e.g. "guess_0"
    // phase is e.g. "guess_0" — used to derive the current drawing index
    const phaseData = room.phaseData as any;

    // Get all guesses for this sub-round
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_room_round_phase", (q) =>
        q
          .eq("roomId", room._id)
          .eq("round", room.roundNumber!)
          .eq("phase", phase),
      )
      .collect();

    // Get the real word
    const artistId = phaseData?.currentArtistId;
    const drawingWords = phaseData?.drawingWords ?? {};
    const realWord = drawingWords[artistId] ?? "???";

    // Build options: all guesses + real word
    const options = submissions.map((s) => ({
      id: s._id as string,
      text: String(s.content),
      playerId: s.playerId,
    }));

    options.push({
      id: TRUTH_ID,
      text: realWord,
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
      ...phaseData,
      answers,
      answersAnonymized: answers.map((a) => ({ id: a.id, text: a.text })),
    };
  },

  async onVote(ctx, room, player, content) {
    const phaseData = room.phaseData as any;
    const artistId = phaseData?.currentArtistId;
    if (player._id === artistId) {
      throw new ConvexError("Kunstneren kan ikke stemme");
    }

    const drawingIndex = phaseData?.drawingIndex ?? 0;
    const votePhase = `vote_${drawingIndex}`;
    const vote = String(content);

    const existing = await ctx.db
      .query("submissions")
      .withIndex("by_player_round", (q) =>
        q.eq("playerId", player._id).eq("round", room.roundNumber!),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("roomId"), room._id),
          q.eq(q.field("phase"), votePhase),
        ),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { content: vote });
      return;
    }

    await ctx.db.insert("submissions", {
      roomId: room._id,
      playerId: player._id,
      round: room.roundNumber!,
      phase: votePhase,
      content: vote,
      createdAt: Date.now(),
    });
  },

  async computeResults(ctx, room, players) {
    const phaseData = room.phaseData as any;
    const drawingIndex = phaseData?.drawingIndex ?? 0;
    const guessPhase = `guess_${drawingIndex}`;
    const votePhase = `vote_${drawingIndex}`;
    const artistId = phaseData?.currentArtistId;
    const drawingWords = phaseData?.drawingWords ?? {};
    const realWord = drawingWords[artistId] ?? "???";

    const [guesses, votes] = await Promise.all([
      ctx.db
        .query("submissions")
        .withIndex("by_room_round_phase", (q) =>
          q
            .eq("roomId", room._id)
            .eq("round", room.roundNumber!)
            .eq("phase", guessPhase),
        )
        .collect(),
      ctx.db
        .query("submissions")
        .withIndex("by_room_round_phase", (q) =>
          q
            .eq("roomId", room._id)
            .eq("round", room.roundNumber!)
            .eq("phase", votePhase),
        )
        .collect(),
    ]);

    // Build player lookup map for O(1) access
    const playerMap = new Map(players.map((p) => [p._id as string, p]));

    // Tally votes per answer ID
    const votesPerAnswer = new Map<string, Id<"players">[]>();
    for (const vote of votes) {
      const answerId = String(vote.content);
      const arr = votesPerAnswer.get(answerId) ?? [];
      arr.push(vote.playerId);
      votesPerAnswer.set(answerId, arr);
    }

    const scoreDeltas = new Map<Id<"players">, number>();

    // +1000 for guessing the real word
    const truthVoters = votesPerAnswer.get(TRUTH_ID) ?? [];
    for (const playerId of truthVoters) {
      scoreDeltas.set(playerId, (scoreDeltas.get(playerId) ?? 0) + 1000);
    }

    // +1000 to artist if nobody guessed correctly
    if (truthVoters.length === 0 && artistId) {
      scoreDeltas.set(artistId, (scoreDeltas.get(artistId) ?? 0) + 1000);
    }

    const getName = (id: string) => playerMap.get(id)?.name ?? "???";

    // Build results
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

    // Process fake guesses: +500 per player fooled
    for (const guess of guesses) {
      const voterIds = votesPerAnswer.get(guess._id as string) ?? [];
      const fooledCount = voterIds.length;
      const player = playerMap.get(guess.playerId as string);

      if (fooledCount > 0) {
        scoreDeltas.set(
          guess.playerId,
          (scoreDeltas.get(guess.playerId) ?? 0) + fooledCount * 500,
        );
      }

      results.push({
        answerId: guess._id as string,
        text: String(guess.content),
        isReal: false,
        playerId: guess.playerId,
        playerName: player?.name ?? "???",
        avatarColor: player?.avatarColor ?? "#888",
        avatarImage: player?.avatarImage,
        voterNames: voterIds.map((vid) => getName(vid as string)),
        fooledCount,
      });
    }

    // Add truth entry
    results.push({
      answerId: TRUTH_ID,
      text: realWord,
      isReal: true,
      playerId: null,
      playerName: null,
      avatarColor: null,
      voterNames: truthVoters.map((vid) => getName(vid as string)),
      fooledCount: 0,
    });

    // Sort: fakes by fooledCount desc, truth last
    results.sort((a, b) => {
      if (a.isReal) return 1;
      if (b.isReal) return -1;
      return b.fooledCount - a.fooledCount;
    });

    const artist = players.find((p) => p._id === artistId);

    return {
      phaseData: {
        ...phaseData,
        results,
        theWord: realWord,
        artistBonus: truthVoters.length === 0,
        artistName: artist?.name ?? "???",
        totalVotes: votes.length,
      },
      scoreDeltas,
    };
  },

  async buildGuessData(ctx, room, players, drawingIndex) {
    const phaseData = room.phaseData as any;
    const drawingOrder: string[] = phaseData?.drawingOrder ?? [];
    const artistId = drawingOrder[drawingIndex];
    const artist = players.find((p) => p._id === artistId);

    // Fetch the artist's drawing
    const drawSubmission = await ctx.db
      .query("submissions")
      .withIndex("by_room_round_phase", (q) =>
        q
          .eq("roomId", room._id)
          .eq("round", room.roundNumber!)
          .eq("phase", "draw"),
      )
      .filter((q) => q.eq(q.field("playerId"), artistId))
      .first();

    return {
      ...phaseData,
      drawingIndex,
      currentArtistId: artistId,
      currentArtistName: artist?.name ?? "???",
      drawingData: drawSubmission?.content ?? [],
      // Clear previous sub-round data
      answers: undefined,
      answersAnonymized: undefined,
      results: undefined,
      theWord: undefined,
      artistBonus: undefined,
    };
  },

  getExpectedSubmitterCount(room, players) {
    const basePhase = room.currentPhase?.split("_")[0];
    if (basePhase === "guess" || basePhase === "vote") {
      return players.length - 1; // artist excluded
    }
    return players.length;
  },

  getNextPhase(currentPhase, _event, room): PhaseTransition {
    const [base, idxStr] = currentPhase.split("_");
    const idx = idxStr !== undefined ? parseInt(idxStr, 10) : 0;
    const pd = (room.phaseData ?? {}) as any;
    const roundNumber = room.roundNumber ?? 1;
    const totalRounds = room.totalRounds ?? 1;

    if (currentPhase === "draw") {
      // draw → guess_0
      return { nextPhase: "guess_0", action: { type: "buildGuess", drawingIndex: 0 } };
    }
    if (base === "guess") {
      // guess_K → vote_K
      return { nextPhase: `vote_${idx}`, action: { type: "buildVote" } };
    }
    if (base === "vote" && idxStr !== undefined) {
      // vote_K → reveal_K
      return { nextPhase: `reveal_${idx}`, action: { type: "computeResults" } };
    }
    if (base === "reveal" && idxStr !== undefined) {
      // reveal_K → guess_(K+1) or scores
      const totalDrawings = pd?.totalDrawings ?? 1;
      if (idx < totalDrawings - 1) {
        return { nextPhase: `guess_${idx + 1}`, action: { type: "buildGuess", drawingIndex: idx + 1 } };
      }
      return { nextPhase: "scores", action: { type: "none" } };
    }
    if (currentPhase === "scores") {
      if (roundNumber >= totalRounds) {
        return { nextPhase: "finished", action: { type: "finish" } };
      }
      return { nextPhase: "draw", action: { type: "setup" }, advanceRound: true };
    }
    return { nextPhase: "finished", action: { type: "finish" } };
  },
});

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { generateRoomCode } from "./lib/roomCodes";

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
      ["submit", "vote", "draw", "guess", "write"].includes(basePhase ?? "");

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

    // Filter phaseData based on current phase
    let filteredPhaseData = room.phaseData;
    const phase = room.currentPhase ?? "";
    const basePhase = phase.split("_")[0];

    if (phase === "write") {
      // Telefon write phase: only show submission status
      const mySubmission = submissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer._id,
      );
      filteredPhaseData = {
        submittedCount: submissions.length,
        totalPlayers: players.length,
        mySubmission: mySubmission?.content ?? null,
      };
    } else if (basePhase === "draw" && phase !== "draw" && room.gameType === "telefon") {
      // Telefon draw phase: show only this player's assigned prompt
      const pd = room.phaseData as any;
      const myPrompt = currentPlayer
        ? pd?.assignments?.[currentPlayer._id]?.myPrompt ?? null
        : null;
      const mySubmission = submissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer._id,
      );
      filteredPhaseData = {
        stepIndex: pd?.currentStep ?? 0,
        totalSteps: pd?.stepCount ?? 1,
        myPrompt,
        mySubmission: mySubmission ? true : null,
        submittedCount: submissions.length,
        totalPlayers: players.length,
      };
    } else if (basePhase === "guess" && phase !== "guess" && room.gameType === "telefon") {
      // Telefon guess phase: show only this player's assigned drawing
      const pd = room.phaseData as any;
      const myDrawingData = currentPlayer
        ? pd?.assignments?.[currentPlayer._id]?.myDrawingData ?? null
        : null;
      const mySubmission = submissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer._id,
      );
      filteredPhaseData = {
        stepIndex: pd?.currentStep ?? 0,
        totalSteps: pd?.stepCount ?? 1,
        myDrawingData,
        mySubmission: mySubmission?.content ?? null,
        submittedCount: submissions.length,
        totalPlayers: players.length,
      };
    } else if (phase === "reveal" && room.gameType === "telefon") {
      // Telefon reveal: all chain data shown
      filteredPhaseData = room.phaseData;
    } else if (phase === "submit") {
      // Duel/Bluff: During submit: show prompt but hide all answers
      const mySubmission = submissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer._id,
      );
      filteredPhaseData = {
        ...room.phaseData,
        mySubmission: mySubmission?.content ?? null,
        submittedCount: submissions.length,
        totalPlayers: players.length,
      };
    } else if (phase === "vote") {
      // Duel/Bluff: During vote: show anonymized answers, strip authorship
      const myVote = submissions.find(
        (s) =>
          currentPlayer &&
          s.playerId === currentPlayer._id &&
          s.phase === "vote",
      );
      const answers = (room.phaseData?.answersAnonymized ?? []) as Array<{
        id: string;
        text: string;
      }>;
      const myAnswerId = currentPlayer
        ? (room.phaseData?.answers ?? []).find(
            (a: any) => a.playerId === currentPlayer._id,
          )?.id
        : undefined;
      filteredPhaseData = {
        ...room.phaseData,
        answersAnonymized: answers.map((a) => ({
          ...a,
          isOwn: a.id === myAnswerId,
        })),
        myVote: myVote?.content ?? null,
      };
    } else if (phase === "draw") {
      // Tegn: During draw: only show this player's word, hide all others
      const phaseData = room.phaseData as any;
      const myWord = currentPlayer
        ? phaseData?.drawingWords?.[currentPlayer._id] ?? null
        : null;
      const mySubmission = submissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer._id,
      );
      filteredPhaseData = {
        totalDrawings: phaseData?.totalDrawings,
        drawingIndex: phaseData?.drawingIndex,
        myWord,
        mySubmission: mySubmission ? true : null,
        submittedCount: submissions.length,
        totalPlayers: players.length,
      };
    } else if (basePhase === "guess") {
      // Tegn: During guess: artist sees waiting, others see input
      const phaseData = room.phaseData as any;
      const isArtist = currentPlayer?._id === phaseData?.currentArtistId;
      const mySubmission = submissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer._id,
      );
      filteredPhaseData = {
        drawingIndex: phaseData?.drawingIndex,
        totalDrawings: phaseData?.totalDrawings,
        currentArtistId: phaseData?.currentArtistId,
        currentArtistName: phaseData?.currentArtistName,
        isArtist,
        mySubmission: mySubmission?.content ?? null,
        submittedCount: submissions.length,
        totalGuessers: players.length - 1,
      };
    } else if (basePhase === "vote" && phase !== "vote") {
      // Tegn: During vote_K: same pattern as Duel/Bluff vote
      const phaseData = room.phaseData as any;
      const votePhase = phase; // e.g. "vote_0"
      const myVote = submissions.find(
        (s) =>
          currentPlayer &&
          s.playerId === currentPlayer._id &&
          s.phase === votePhase,
      );
      const answers = (phaseData?.answersAnonymized ?? []) as Array<{
        id: string;
        text: string;
      }>;
      // Find this player's guess in the answers (from the guess phase)
      const myAnswerId = currentPlayer
        ? (phaseData?.answers ?? []).find(
            (a: any) => a.playerId === currentPlayer._id,
          )?.id
        : undefined;
      filteredPhaseData = {
        drawingIndex: phaseData?.drawingIndex,
        totalDrawings: phaseData?.totalDrawings,
        currentArtistId: phaseData?.currentArtistId,
        currentArtistName: phaseData?.currentArtistName,
        drawingData: phaseData?.drawingData,
        answersAnonymized: answers.map((a) => ({
          ...a,
          isOwn: a.id === myAnswerId,
        })),
        myVote: myVote?.content ?? null,
        isArtist: currentPlayer?._id === phaseData?.currentArtistId,
      };
    }
    // During reveal/scores: return everything (but strip drawingWords for Tegn)
    else if (basePhase === "reveal" || phase === "scores") {
      const phaseData = room.phaseData as any;
      if (phaseData?.drawingWords) {
        const { drawingWords, ...rest } = phaseData;
        filteredPhaseData = rest;
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

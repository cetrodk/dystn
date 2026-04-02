import { registerGameHandlers } from "../registry";
import type { RoomState, Player, PhaseTransition } from "../types";
import { getSubmissions, upsertSubmission } from "../submissions";
import { tegnPrompts as allPrompts } from "./prompts/loader";
import { TRUTH_ID } from "../constants";

registerGameHandlers("tegn", {
  config: {
    initialPhase: "draw",
    totalRoundsForPlayerCount: () => 1,
  },

  setupRound(room: RoomState): Record<string, unknown> {
    const settings = (room.settings ?? {}) as Record<string, unknown>;
    const difficulty =
      typeof settings.tegnDifficulty === "number" ? settings.tegnDifficulty : 1;

    // Filter to only the selected difficulty level so all players get equally hard prompts
    const allowed = allPrompts.filter(
      (p) => p.category && parseInt(p.category, 10) === difficulty,
    );
    const prompts = allowed.length > 0 ? [...allowed] : [...allPrompts];

    // Shuffle players to determine drawing order
    const drawingOrder = room.players
      .map((p) => p.id)
      .sort(() => Math.random() - 0.5);

    // Pick one word per player (no repeats)
    const shuffledPrompts = prompts.sort(() => Math.random() - 0.5);
    const drawingWords: Record<string, string> = {};

    for (let i = 0; i < drawingOrder.length; i++) {
      const prompt =
        shuffledPrompts[i % Math.max(shuffledPrompts.length, 1)];
      drawingWords[drawingOrder[i]] = prompt?.text ?? "en hest";
    }

    return {
      drawingOrder,
      drawingWords,
      totalDrawings: drawingOrder.length,
      drawingIndex: 0,
    };
  },

  onSubmission(room: RoomState, player: Player, content: unknown): void {
    const phaseData = room.phaseData as any;
    const basePhase = room.currentPhase?.split("_")[0];

    if (basePhase === "draw") {
      // Content is { strokes, viewBoxHeight } or legacy strokes array
      const strokes = Array.isArray(content)
        ? content
        : (content as any)?.strokes;
      if (!Array.isArray(strokes) || strokes.length === 0) {
        throw new Error("Tegn noget først");
      }

      upsertSubmission(room, player.id, "draw", content);
    } else if (basePhase === "guess") {
      // Artist cannot guess
      if (player.id === phaseData?.currentArtistId) {
        throw new Error("Kunstnere gætter ikke");
      }

      let text = String(content).trim().slice(0, 80);
      if (!text) throw new Error("Tomt gæt");
      // Lowercase first char to match prompt word casing
      text = text[0].toLowerCase() + text.slice(1);

      // Check if matches real word (case-insensitive)
      const artistId = phaseData?.currentArtistId;
      const drawingWords = phaseData?.drawingWords;
      if (artistId && drawingWords?.[artistId]) {
        if (text.toLowerCase() === drawingWords[artistId].toLowerCase()) {
          throw new Error("Prøv et andet gæt");
        }
      }

      const phase = room.currentPhase!;
      upsertSubmission(room, player.id, phase, text);
    }
  },

  buildVoteData(room: RoomState): Record<string, unknown> {
    const phase = room.currentPhase!; // e.g. "guess_0"
    const phaseData = room.phaseData as any;

    // Get all guesses for this sub-round
    const submissions = getSubmissions(room, phase);

    // Get the real word
    const artistId = phaseData?.currentArtistId;
    const drawingWords = phaseData?.drawingWords ?? {};
    const realWord = drawingWords[artistId] ?? "???";

    // Build options: merge duplicate guesses (case-insensitive), then add real word
    const seen = new Map<
      string,
      {
        id: string;
        text: string;
        playerId: any;
        mergedPlayerIds?: string[];
      }
    >();
    const options: Array<{
      id: string;
      text: string;
      playerId: any;
      mergedPlayerIds?: string[];
    }> = [];

    for (const s of submissions) {
      const key = String(s.content).toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        existing.mergedPlayerIds = existing.mergedPlayerIds ?? [
          existing.playerId,
        ];
        existing.mergedPlayerIds.push(s.playerId);
      } else {
        const entry = {
          id: s.id,
          text: String(s.content),
          playerId: s.playerId,
        };
        options.push(entry);
        seen.set(key, entry);
      }
    }

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
      mergedPlayerIds: o.mergedPlayerIds,
    }));

    return {
      ...phaseData,
      answers,
      answersAnonymized: answers.map((a) => ({ id: a.id, text: a.text })),
    };
  },

  onVote(room: RoomState, player: Player, content: unknown): void {
    const phaseData = room.phaseData as any;
    const artistId = phaseData?.currentArtistId;
    if (player.id === artistId) {
      throw new Error("Kunstneren kan ikke stemme");
    }

    const drawingIndex = phaseData?.drawingIndex ?? 0;
    const votePhase = `vote_${drawingIndex}`;
    const vote = String(content);

    upsertSubmission(room, player.id, votePhase, vote);
  },

  computeResults(room: RoomState): {
    phaseData: Record<string, unknown>;
    scoreDeltas: Map<string, number>;
  } {
    const phaseData = room.phaseData as any;
    const drawingIndex = phaseData?.drawingIndex ?? 0;
    const guessPhase = `guess_${drawingIndex}`;
    const votePhase = `vote_${drawingIndex}`;
    const artistId = phaseData?.currentArtistId;
    const drawingWords = phaseData?.drawingWords ?? {};
    const realWord = drawingWords[artistId] ?? "???";

    const guesses = getSubmissions(room, guessPhase);
    const votes = getSubmissions(room, votePhase);

    const players = room.players;

    // Build player lookup map for O(1) access
    const playerMap = new Map(players.map((p) => [p.id, p]));

    // Tally votes per answer ID
    const votesPerAnswer = new Map<string, string[]>();
    for (const vote of votes) {
      const answerId = String(vote.content);
      const arr = votesPerAnswer.get(answerId) ?? [];
      arr.push(vote.playerId);
      votesPerAnswer.set(answerId, arr);
    }

    const scoreDeltas = new Map<string, number>();

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

    // Process fake guesses using merged answers so co-authors get credit
    const pdAnswers = ((room.phaseData as any)?.answers ?? []) as Array<{
      id: string; text: string; playerId: string; mergedPlayerIds?: string[];
    }>;
    for (const answer of pdAnswers) {
      if (answer.id === TRUTH_ID) continue;
      const voterIds = votesPerAnswer.get(answer.id) ?? [];
      const fooledCount = voterIds.length;
      const player = playerMap.get(answer.playerId);

      if (fooledCount > 0) {
        const authorIds = answer.mergedPlayerIds ?? [answer.playerId];
        for (const pid of authorIds) {
          scoreDeltas.set(pid, (scoreDeltas.get(pid) ?? 0) + fooledCount * 500);
        }
      }

      results.push({
        answerId: answer.id,
        text: answer.text,
        isReal: false,
        playerId: answer.playerId,
        playerName: player?.name ?? "???",
        avatarColor: player?.avatarColor ?? "#888",
        avatarImage: player?.avatarImage,
        voterNames: voterIds.map((vid) => getName(vid)),
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
      voterNames: truthVoters.map((vid) => getName(vid)),
      fooledCount: 0,
    });

    // Sort: fakes by fooledCount desc, truth last
    results.sort((a, b) => {
      if (a.isReal) return 1;
      if (b.isReal) return -1;
      return b.fooledCount - a.fooledCount;
    });

    const artist = players.find((p) => p.id === artistId);

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

  buildGuessData(room: RoomState, drawingIndex: number): Record<string, unknown> {
    const phaseData = room.phaseData as any;
    const drawingOrder: string[] = phaseData?.drawingOrder ?? [];
    const artistId = drawingOrder[drawingIndex];
    const artist = room.players.find((p) => p.id === artistId);

    // Fetch the artist's drawing from submissions
    const drawSubmissions = getSubmissions(room, "draw");
    const drawSubmission = drawSubmissions.find(
      (s) => s.playerId === artistId,
    );

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

  filterForPlayer(room: RoomState, currentPlayer: Player | null): Record<string, unknown> {
    const phase = room.currentPhase ?? "";
    const basePhase = phase.split("_")[0];
    const pd = (room.phaseData ?? {}) as any;
    const players = room.players;

    if (phase === "draw") {
      const submissions = getSubmissions(room, "draw");
      const myWord = currentPlayer
        ? pd?.drawingWords?.[currentPlayer.id] ?? null
        : null;
      const mySubmission = submissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer.id,
      );
      return {
        totalDrawings: pd?.totalDrawings,
        drawingIndex: pd?.drawingIndex,
        myWord,
        mySubmission: mySubmission ? true : null,
        submittedCount: submissions.length,
        totalPlayers: players.length,
      };
    }
    if (basePhase === "guess") {
      const submissions = getSubmissions(room, phase);
      const isArtist = currentPlayer?.id === pd?.currentArtistId;
      const mySubmission = submissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer.id,
      );
      return {
        drawingIndex: pd?.drawingIndex,
        totalDrawings: pd?.totalDrawings,
        currentArtistId: pd?.currentArtistId,
        currentArtistName: pd?.currentArtistName,
        drawingData: pd?.drawingData,
        isArtist,
        mySubmission: mySubmission?.content ?? null,
        submittedCount: submissions.length,
        totalGuessers: players.length - 1,
      };
    }
    if (basePhase === "vote" && phase !== "vote") {
      const submissions = getSubmissions(room, phase);
      const myVote = submissions.find(
        (s) =>
          currentPlayer &&
          s.playerId === currentPlayer.id &&
          s.phase === phase,
      );
      const answers = (pd?.answersAnonymized ?? []) as Array<{
        id: string;
        text: string;
      }>;
      const myAnswerId = currentPlayer
        ? (pd?.answers ?? []).find(
            (a: any) =>
              a.playerId === currentPlayer.id ||
              (a.mergedPlayerIds ?? []).includes(currentPlayer.id),
          )?.id
        : undefined;
      return {
        drawingIndex: pd?.drawingIndex,
        totalDrawings: pd?.totalDrawings,
        currentArtistId: pd?.currentArtistId,
        currentArtistName: pd?.currentArtistName,
        drawingData: pd?.drawingData,
        answersAnonymized: answers.map((a) => ({
          ...a,
          isOwn: a.id === myAnswerId,
        })),
        myVote: myVote?.content ?? null,
        isArtist: currentPlayer?.id === pd?.currentArtistId,
      };
    }
    // reveal/scores: strip drawingWords
    if (pd?.drawingWords) {
      const { drawingWords, ...rest } = pd;
      return rest;
    }
    return pd ?? {};
  },

  getExpectedSubmitterCount(room: RoomState): number {
    const basePhase = room.currentPhase?.split("_")[0];
    if (basePhase === "guess" || basePhase === "vote") {
      return room.players.length - 1; // artist excluded
    }
    return room.players.length;
  },

  getNextPhase(currentPhase: string, _event: string, room: RoomState): PhaseTransition {
    const [base, idxStr] = currentPhase.split("_");
    const idx = idxStr !== undefined ? parseInt(idxStr, 10) : 0;
    const pd = (room.phaseData ?? {}) as any;
    const roundNumber = room.roundNumber ?? 1;
    const totalRounds = room.totalRounds ?? 1;

    if (currentPhase === "draw") {
      // draw -> guess_0
      return {
        nextPhase: "guess_0",
        action: { type: "buildGuess", drawingIndex: 0 },
      };
    }
    if (base === "guess") {
      // guess_K -> vote_K
      return { nextPhase: `vote_${idx}`, action: { type: "buildVote" } };
    }
    if (base === "vote" && idxStr !== undefined) {
      // vote_K -> reveal_K
      return {
        nextPhase: `reveal_${idx}`,
        action: { type: "computeResults" },
      };
    }
    if (base === "reveal" && idxStr !== undefined) {
      // reveal_K -> guess_(K+1) or scores
      const totalDrawings = pd?.totalDrawings ?? 1;
      if (idx < totalDrawings - 1) {
        return {
          nextPhase: `guess_${idx + 1}`,
          action: { type: "buildGuess", drawingIndex: idx + 1 },
        };
      }
      return { nextPhase: "scores", action: { type: "none" } };
    }
    if (currentPhase === "scores") {
      if (roundNumber >= totalRounds) {
        return { nextPhase: "finished", action: { type: "finish" } };
      }
      return {
        nextPhase: "draw",
        action: { type: "setup" },
        advanceRound: true,
      };
    }
    return { nextPhase: "finished", action: { type: "finish" } };
  },
});

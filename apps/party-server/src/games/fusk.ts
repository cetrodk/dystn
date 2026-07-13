import { registerGameHandlers } from "../registry";
import { getSubmissions, upsertSubmission, validateVote } from "../submissions";
import type { RoomState, Player, PhaseTransition } from "../types";
import { fuskPrompts as allPrompts } from "./prompts/loader";
import { TRUTH_ID } from "../constants";
import { shuffle } from "../shuffle";

/** Normalize an answer so player fakes and the truth look identical in style. */
function normalizeAnswer(raw: string): string {
  let text = raw.trim().slice(0, 80);
  // Strip trailing punctuation so "37." and "37" match
  text = text.replace(/[.!,;:]+$/, "");
  // Lowercase everything so answers fit mid-sentence blanks and casing can't be a tell
  text = text.toLowerCase();
  return text;
}

registerGameHandlers("fusk", {
  config: {
    pack: "pack1",
    minPlayers: 3, // voting degenerates with 1-2 players (own/only answer)
  },

  setupRound(room: RoomState): Record<string, unknown> {
    // Track which prompts have been used across all rounds in this game
    const usedPromptIds: number[] = ((room.phaseData as any)?.usedPromptIds ?? []);

    if (allPrompts.length === 0) {
      // Fallback prompt
      return {
        promptText: "Verdens største ___ blev fundet i 2019",
        realAnswer: "trøffel",
        usedPromptIds: [],
      };
    }

    // Filter out already-used prompts; if all used, reset
    const usedSet = new Set(usedPromptIds);
    let candidates = allPrompts.filter((_, i) => !usedSet.has(i));
    if (candidates.length === 0) candidates = [...allPrompts];

    const chosenIndex = allPrompts.indexOf(
      candidates[Math.floor(Math.random() * candidates.length)],
    );
    const prompt = allPrompts[chosenIndex];

    return {
      promptText: prompt.text,
      realAnswer: prompt.answer,
      usedPromptIds: [...usedPromptIds, chosenIndex],
    };
  },

  onSubmission(room: RoomState, player: Player, content: unknown): void {
    if (typeof content !== "string") throw new Error("Ugyldigt svar");
    const text = normalizeAnswer(content);
    if (!text) throw new Error("Tomt svar");

    // Reject if it matches the real answer after normalization
    const realAnswer = (room.phaseData as any)?.realAnswer;
    if (realAnswer && text.toLowerCase() === normalizeAnswer(realAnswer).toLowerCase()) {
      throw new Error("Prøv et andet svar");
    }

    upsertSubmission(room, player.id, "submit", text);
  },

  buildVoteData(room: RoomState): Record<string, unknown> {
    const submissions = getSubmissions(room, "submit");

    // Get the real answer from phaseData (stored by setupRound)
    const realAnswer = (room.phaseData as any)?.realAnswer ?? "Ukendt svar";

    // Build options: merge duplicate fakes (case-insensitive), then add truth
    const seen = new Map<string, { id: string; text: string; playerId: string; mergedPlayerIds?: string[] }>();
    const options: Array<{ id: string; text: string; playerId: string; mergedPlayerIds?: string[] }> = [];

    for (const s of submissions) {
      const key = String(s.content).toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        existing.mergedPlayerIds = existing.mergedPlayerIds ?? [existing.playerId];
        existing.mergedPlayerIds.push(s.playerId);
      } else {
        const entry = { id: s.id, text: String(s.content), playerId: s.playerId };
        options.push(entry);
        seen.set(key, entry);
      }
    }

    // Add the truth with the same normalization applied to player answers
    options.push({
      id: TRUTH_ID,
      text: normalizeAnswer(realAnswer),
      playerId: null as any,
    });

    // Shuffle
    const shuffled = shuffle(options);

    const answers = shuffled.map((o) => ({
      id: o.id,
      text: o.text,
      playerId: o.playerId,
      mergedPlayerIds: o.mergedPlayerIds,
    }));

    return {
      ...room.phaseData,
      answers,
      // Anonymized: strip playerIds so players can't tell which is theirs by ID
      answersAnonymized: answers.map((a) => ({ id: a.id, text: a.text })),
    };
  },

  onVote(room: RoomState, player: Player, content: unknown): void {
    const vote = validateVote(room, player, content);
    upsertSubmission(room, player.id, "vote", vote);
  },

  computeResults(room: RoomState): {
    phaseData: Record<string, unknown>;
    scoreDeltas: Map<string, number>;
  } {
    const submissions = getSubmissions(room, "submit");
    const votes = getSubmissions(room, "vote");
    const players = room.players;

    // Get real answer from phaseData
    const realAnswer = (room.phaseData as any)?.realAnswer ?? "Ukendt svar";

    // Tally votes per answer ID
    const votesPerAnswer = new Map<string, string[]>();
    for (const vote of votes) {
      const answerId = String(vote.content);
      const arr = votesPerAnswer.get(answerId) ?? [];
      arr.push(vote.playerId);
      votesPerAnswer.set(answerId, arr);
    }

    const scoreDeltas = new Map<string, number>();

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
      /** All authors incl. merged co-authors — each was awarded the points */
      authorNames?: string[];
      avatarColor: string | null;
      avatarImage?: string;
      voterNames: string[];
      fooledCount: number;
    }> = [];

    // Process fakes using merged answers (not raw submissions) so co-authors get credit
    const playerMap = new Map(players.map((p) => [p.id, p]));
    const pdAnswers = ((room.phaseData as any)?.answers ?? []) as Array<{
      id: string; text: string; playerId: string; mergedPlayerIds?: string[];
    }>;
    for (const answer of pdAnswers) {
      if (answer.id === TRUTH_ID) continue;
      const voterIds = votesPerAnswer.get(answer.id) ?? [];
      const fooledCount = voterIds.length;
      const player = playerMap.get(answer.playerId);
      const authorIds = answer.mergedPlayerIds ?? [answer.playerId];

      // Credit all merged authors equally
      if (fooledCount > 0) {
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
        authorNames: authorIds.map((pid) => playerMap.get(pid)?.name ?? "???"),
        avatarColor: player?.avatarColor ?? "#888",
        avatarImage: player?.avatarImage,
        voterNames: voterIds.map(
          (vid) => playerMap.get(vid)?.name ?? "???",
        ),
        fooledCount,
      });
    }

    // Add the truth entry — the reveal shows the original text (proper nouns
    // keep their casing); only the vote options are normalized to blend in.
    results.push({
      answerId: TRUTH_ID,
      text: realAnswer,
      isReal: true,
      playerId: null,
      playerName: null,
      avatarColor: null,
      voterNames: truthVoters.map(
        (vid) => playerMap.get(vid)?.name ?? "???",
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

  filterForPlayer(room: RoomState, currentPlayer: Player | null): Record<string, unknown> {
    const phase = room.currentPhase ?? "";
    const pd = (room.phaseData ?? {}) as any;

    if (phase === "submit") {
      const submissions = getSubmissions(room, "submit");
      const mySubmission = submissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer.id,
      );
      return {
        ...pd,
        // Strip the real answer so it is never sent to clients.
        // usedPromptIds carries the current prompt's index — enough to look
        // the answer up — so it never leaves the server either.
        realAnswer: undefined,
        usedPromptIds: undefined,
        mySubmission: mySubmission?.content ?? null,
        submittedCount: submissions.length,
      };
    }
    if (phase === "vote") {
      const votes = getSubmissions(room, "vote");
      const myVote = votes.find(
        (s) => currentPlayer && s.playerId === currentPlayer.id,
      );
      const answers = (pd.answersAnonymized ?? []) as Array<{ id: string; text: string }>;
      const myAnswerId = currentPlayer
        ? (pd.answers ?? []).find((a: any) =>
            a.playerId === currentPlayer.id ||
            (a.mergedPlayerIds ?? []).includes(currentPlayer.id),
          )?.id
        : undefined;
      return {
        ...pd,
        // Strip secrets from vote phase data
        answers: undefined,
        realAnswer: undefined,
        usedPromptIds: undefined,
        answersAnonymized: answers.map((a) => ({ ...a, isOwn: a.id === myAnswerId })),
        myVote: myVote?.content ?? null,
      };
    }
    // reveal/scores: strip internal tracking
    const { usedPromptIds: _, answers: __, ...visible } = pd ?? {};
    return visible;
  },

  getNextPhase(currentPhase: string, _event: string, room: RoomState): PhaseTransition {
    const roundNumber = room.roundNumber ?? 1;
    const totalRounds = room.totalRounds ?? 1;

    switch (currentPhase) {
      case "submit":
        return { nextPhase: "vote", action: { type: "buildVote" } };
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

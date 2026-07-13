import type { AvatarTraits } from "../avatar";
import { registerGameHandlers } from "../registry";
import { getSubmissions, upsertSubmission, validateVote } from "../submissions";
import type { PhaseTransition, Player, RoomState } from "../types";
import { blitzPrompts } from "./prompts/loader";
import { shuffle } from "../shuffle";

registerGameHandlers("blitz", {
  config: {
    pack: "free",
    minPlayers: 3, // voting degenerates with 1-2 players (own/only answer)
  },

  setupRound(room: RoomState): Record<string, unknown> {
    if (blitzPrompts.length === 0) {
      return {
        promptText: "Hvad er det bedste ved at være dansk?",
        promptId: null,
      };
    }

    const prompt = blitzPrompts[Math.floor(Math.random() * blitzPrompts.length)];
    return {
      promptText: prompt,
      promptId: null,
    };
  },

  onSubmission(room: RoomState, player: Player, content: unknown): void {
    if (typeof content !== "string") throw new Error("Ugyldigt svar");
    const text = content.trim().slice(0, 280);
    if (!text) throw new Error("Tomt svar");

    upsertSubmission(room, player.id, "submit", text);
  },

  buildVoteData(room: RoomState): Record<string, unknown> {
    const submissions = getSubmissions(room, "submit");

    // Merge duplicate answers (case-insensitive)
    const seen = new Map<string, (typeof answers)[number]>();
    const answers: Array<{
      id: string;
      text: string;
      playerId: string;
      mergedIds?: string[];
      mergedPlayerIds?: string[];
    }> = [];

    const shuffled = shuffle(submissions);
    for (const s of shuffled) {
      const key = String(s.content).toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        // Merge: track additional authors
        existing.mergedIds = existing.mergedIds ?? [existing.id];
        existing.mergedIds.push(s.id);
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

  onVote(room: RoomState, player: Player, content: unknown): void {
    const vote = validateVote(room, player, content); // submission ID they voted for
    upsertSubmission(room, player.id, "vote", vote);
  },

  computeResults(room: RoomState): {
    phaseData: Record<string, unknown>;
    scoreDeltas: Map<string, number>;
  } {
    const votes = getSubmissions(room, "vote");

    // Tally votes per answer
    const voteCounts = new Map<string, number>();
    for (const vote of votes) {
      const answerId = String(vote.content);
      voteCounts.set(answerId, (voteCounts.get(answerId) ?? 0) + 1);
    }

    // Calculate scores using the merged answer map from buildVoteData
    const scoreDeltas = new Map<string, number>();
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
      avatar?: AvatarTraits;
      votes: number;
      coAuthors?: Array<{
        name: string;
        avatarColor: string;
        avatar?: AvatarTraits;
      }>;
    }> = [];

    const players = room.players;
    const playerMap = new Map(players.map((p) => [p.id, p]));

    for (const answer of pdAnswers) {
      const voteCount = voteCounts.get(answer.id) ?? 0;
      const delta = voteCount * 1000;

      // Credit all merged authors equally
      const authorIds = answer.mergedPlayerIds ?? [answer.playerId];
      for (const pid of authorIds) {
        if (delta > 0) {
          scoreDeltas.set(pid, (scoreDeltas.get(pid) ?? 0) + delta);
        }
      }

      const primaryPlayer = playerMap.get(answer.playerId);
      const coAuthors =
        authorIds.length > 1
          ? authorIds.slice(1).map((pid) => {
              const p = playerMap.get(pid);
              return {
                name: p?.name ?? "???",
                avatarColor: p?.avatarColor ?? "#888",
                avatar: p?.avatar,
              };
            })
          : undefined;

      results.push({
        answerId: answer.id,
        text: answer.text,
        playerId: answer.playerId,
        playerName: primaryPlayer?.name ?? "???",
        avatarColor: primaryPlayer?.avatarColor ?? "#888",
        avatar: primaryPlayer?.avatar,
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

  filterForPlayer(
    room: RoomState,
    currentPlayer: Player | null,
  ): Record<string, unknown> {
    const phase = room.currentPhase ?? "";
    const pd = (room.phaseData ?? {}) as any;

    if (phase === "submit") {
      const submissions = getSubmissions(room, "submit");
      const mySubmission = submissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer.id,
      );
      return {
        ...pd,
        mySubmission: mySubmission?.content ?? null,
        submittedCount: submissions.length,
      };
    }

    if (phase === "present") {
      // Host sees answers on the big screen; players don't
      if (!currentPlayer) {
        const { answers: _, ...hostView } = pd;
        return hostView;
      }
      const { answersAnonymized: _, answers: __, ...rest } = pd;
      return rest;
    }

    if (phase === "vote") {
      const voteSubmissions = getSubmissions(room, "vote");
      const myVote = voteSubmissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer.id,
      );
      const answers = (pd.answersAnonymized ?? []) as Array<{
        id: string;
        text: string;
      }>;
      // Check both primary and merged player IDs for "isOwn"
      const myAnswerId = currentPlayer
        ? (pd.answers ?? []).find(
            (a: any) =>
              a.playerId === currentPlayer.id ||
              (a.mergedPlayerIds ?? []).includes(currentPlayer.id),
          )?.id
        : undefined;
      // Strip the raw answers (they carry playerId/mergedPlayerIds) so voters
      // can't see who authored what in devtools during the vote.
      const { answers: _hidden, ...rest } = pd;
      return {
        ...rest,
        answersAnonymized: answers.map((a) => ({
          ...a,
          isOwn: a.id === myAnswerId,
        })),
        myVote: myVote?.content ?? null,
      };
    }

    // reveal/scores: return as-is
    return pd ?? {};
  },

  getNextPhase(
    currentPhase: string,
    _event: string,
    room: RoomState,
  ): PhaseTransition {
    const roundNumber = room.roundNumber ?? 1;
    const totalRounds = room.totalRounds ?? 1;

    switch (currentPhase) {
      case "submit":
        return { nextPhase: "present", action: { type: "buildVote" } };
      case "present": {
        // With fewer than 2 merged answers nobody has anything to vote on
        // (identical answers merge into one that is "own" for every author) —
        // skip straight to reveal instead of a dead vote phase.
        const answers = ((room.phaseData as any)?.answers ?? []) as unknown[];
        if (answers.length < 2) {
          return { nextPhase: "reveal", action: { type: "computeResults" } };
        }
        return { nextPhase: "vote", action: { type: "none" } };
      }
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
        return {
          nextPhase: "submit",
          action: { type: "setup" },
          advanceRound: true,
        };
      default:
        return { nextPhase: "finished", action: { type: "finish" } };
    }
  },
});

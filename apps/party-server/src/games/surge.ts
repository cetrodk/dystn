import { registerGameHandlers } from "../registry";
import type { AvatarTraits } from "../avatar";
import type { RoomState, Player, PhaseTransition } from "../types";
import { getSubmissions, upsertSubmission } from "../submissions";
import { surgePrompts as allPrompts } from "./prompts/loader";
import type { SurgePrompt } from "./prompts/types";

const FINISH_LINE = 8;

registerGameHandlers("surge", {
  config: {
    pack: "pack1",
    initialPhase: "countdown",
    totalRoundsForPlayerCount: () => 100, // dynamic: game ends via victory check, not round limit
    minPlayers: 2,
    // Runden er et kapløb med uret: brikken er "transit", indtil den lander, så
    // en fase, der slutter når alle har trykket, klipper de sidste svar af.
    neverAutoAdvance: true,
  },

  setupRound(room: RoomState): Record<string, unknown> {
    const pd = (room.phaseData ?? {}) as Record<string, unknown>;

    // Carry forward track positions from previous round, or initialize
    const prevPositions = pd.trackPositions as Record<string, number> | undefined;
    const trackPositions: Record<string, number> = {};
    for (const p of room.players) {
      trackPositions[p.id] = prevPositions?.[p.id] ?? 0;
    }

    // Track which prompt indices we've already used
    let usedPromptIds = (pd.usedPromptIds as number[]) ?? [];

    // Difficulty filtering
    const difficulty =
      typeof room.settings.surgeDifficulty === "number"
        ? (room.settings.surgeDifficulty as number)
        : 1;

    let pool: Array<SurgePrompt & { idx: number }> = (allPrompts as SurgePrompt[]).map(
      (p, idx) => ({ ...p, idx }),
    );

    if (difficulty < 3) {
      const allowed = pool.filter(
        (p) => p.category && parseInt(p.category, 10) <= difficulty,
      );
      if (allowed.length > 0) pool = allowed;
    }

    // Filter out used prompts; on exhaustion reset the used-list but never
    // repeat the most recent prompt two rounds in a row.
    const usedSet = new Set(usedPromptIds);
    let available = pool.filter((p) => !usedSet.has(p.idx));
    if (available.length === 0 && pool.length > 0) {
      const lastUsed = usedPromptIds[usedPromptIds.length - 1];
      usedPromptIds = [];
      available = pool.filter((p) => p.idx !== lastUsed);
      if (available.length === 0) available = pool;
    }

    if (available.length === 0) {
      // Fallback if somehow no prompts exist
      return {
        statement: "Danmark har flere øer end Sverige",
        correctAnswer: "true",
        trackPositions,
        currentChoices: {} as Record<string, string>,
        finishLine: FINISH_LINE,
        statementIndex: room.roundNumber ?? 1,
        usedPromptIds,
      };
    }

    const prompt = available[Math.floor(Math.random() * available.length)];

    return {
      statement: prompt.text,
      correctAnswer: prompt.answer ?? "true",
      trackPositions,
      currentChoices: {} as Record<string, string>,
      finishLine: FINISH_LINE,
      statementIndex: room.roundNumber ?? 1,
      usedPromptIds: [...usedPromptIds, prompt.idx],
    };
  },

  onSubmission(room: RoomState, player: Player, content: unknown): void {
    const choice = (content as { choice?: unknown } | null)?.choice as
      | "true"
      | "false"
      | "transit";
    if (typeof choice !== "string" || !["true", "false", "transit"].includes(choice)) {
      throw new Error("Ugyldigt valg");
    }

    // Upsert submission
    upsertSubmission(room, player.id, "commit", { choice });

    // Update currentChoices directly in phaseData (broadcast happens automatically)
    const pd = (room.phaseData ?? {}) as Record<string, unknown>;
    const currentChoices = {
      ...((pd.currentChoices as Record<string, string>) ?? {}),
    };
    currentChoices[player.id] = choice;
    room.phaseData = { ...pd, currentChoices };
  },

  buildVoteData(): Record<string, unknown> {
    throw new Error("Sandhed has no vote phase");
  },

  onVote(): void {
    throw new Error("Sandhed has no vote phase");
  },

  computeResults(room: RoomState): {
    phaseData: Record<string, unknown>;
    scoreDeltas: Map<string, number>;
  } {
    const pd = (room.phaseData ?? {}) as Record<string, unknown>;
    const correctAnswer = pd.correctAnswer as string;
    const trackPositions = { ...(pd.trackPositions as Record<string, number>) };

    // Read final submissions for the commit phase
    const submissions = getSubmissions(room, "commit");
    const submissionMap = new Map(
      submissions.map((s) => [
        s.playerId,
        (s.content as { choice: string }).choice,
      ]),
    );

    const results: Array<{
      playerId: string;
      playerName: string;
      avatarColor: string;
      avatar?: AvatarTraits;
      choice: string | null;
      correct: boolean;
      noAnswer: boolean;
      delta: number;
      newPosition: number;
    }> = [];

    const scoreDeltas = new Map<string, number>();

    for (const player of room.players) {
      const choice = submissionMap.get(player.id);
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

      const currentPos = trackPositions[player.id] ?? 0;
      const newPosition = Math.max(0, Math.min(FINISH_LINE, currentPos + delta));
      trackPositions[player.id] = newPosition;

      // Also give score points for the leaderboard (100 per correct)
      if (isCorrect) {
        scoreDeltas.set(player.id, (scoreDeltas.get(player.id) ?? 0) + 100);
      }

      results.push({
        playerId: player.id,
        playerName: player.name,
        avatarColor: player.avatarColor,
        avatar: player.avatar,
        choice: isNoAnswer ? null : choice,
        correct: isCorrect,
        noAnswer: isNoAnswer,
        delta,
        newPosition,
      });
    }

    // Check win condition
    const winners = room.players
      .filter((p) => (trackPositions[p.id] ?? 0) >= FINISH_LINE)
      .map((p) => p.id);

    // Victory is "first to the finish line", but the finished screens rank by
    // score — give each track winner a bonus large enough to guarantee they
    // also top the leaderboard.
    if (winners.length > 0) {
      const winnerSet = new Set(winners);
      const finalScore = (p: Player) => p.score + (scoreDeltas.get(p.id) ?? 0);
      const maxNonWinner = Math.max(
        0,
        ...room.players.filter((p) => !winnerSet.has(p.id)).map(finalScore),
      );
      for (const player of room.players) {
        if (!winnerSet.has(player.id)) continue;
        const bonus = Math.max(500, maxNonWinner + 500 - finalScore(player));
        scoreDeltas.set(player.id, (scoreDeltas.get(player.id) ?? 0) + bonus);
      }
    }

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

  filterForPlayer(room: RoomState, _player: Player | null): Record<string, unknown> {
    const phase = room.currentPhase ?? "";
    const pd = (room.phaseData ?? {}) as Record<string, unknown>;

    if (phase === "reveal" || phase === "victory") {
      // Show everything except internal tracking
      const { usedPromptIds: _, ...visible } = pd;
      return visible;
    }

    // commit, countdown and anything else: hide correctAnswer — during the 4s
    // countdown the next statement is already in phaseData, so leaking it
    // there gives everyone the answer before commit even starts.
    const { correctAnswer: _, usedPromptIds: __, ...visible } = pd;
    return visible;
  },

  getNextPhase(currentPhase: string, _event: string, room: RoomState): PhaseTransition {
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
        // No winner will ever emerge if everyone left or the round cap is
        // reached — end the game instead of cycling commit/reveal forever.
        if (
          room.players.length === 0 ||
          (room.roundNumber ?? 1) >= (room.totalRounds ?? 100)
        ) {
          return { nextPhase: "finished", action: { type: "finish" } };
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

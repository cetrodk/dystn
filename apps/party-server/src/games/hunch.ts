import type { AvatarTraits } from "../avatar";
import { registerGameHandlers } from "../registry";
import type { RoomState, Player, PhaseTransition } from "../types";
import { getSubmissions, upsertSubmission } from "../submissions";
import { hunchPrompts as allPrompts } from "./prompts/loader";

const SCORE_TABLE: Record<number, number> = { 0: 1000, 1: 500, 2: 200 };

function scoreForDistance(d: number): number {
  return SCORE_TABLE[d] ?? 0;
}

registerGameHandlers("hunch", {
  config: {
    initialPhase: "clue",
    totalRoundsForPlayerCount: (n) => Math.min(Math.max(6, n * 2), 12),
    minPlayers: 2, // clue-giver + at least one guesser
  },

  setupRound(room: RoomState): Record<string, unknown> {
    if (room.players.length === 0) {
      // Everyone left mid-game — the server's safeAdvance finishes the game.
      throw new Error("Ingen spillere tilbage i rummet");
    }

    const pd = (room.phaseData ?? {}) as Record<string, unknown>;
    let usedPromptIds = (pd.usedPromptIds as number[]) ?? [];

    // Filter out used prompts; on exhaustion reset the used-list but never
    // repeat the most recent prompt two rounds in a row.
    const usedSet = new Set(usedPromptIds);
    const indexed = allPrompts.map((p, idx) => ({ ...p, idx }));
    let available = indexed.filter((p) => !usedSet.has(p.idx));
    if (available.length === 0) {
      const lastUsed = usedPromptIds[usedPromptIds.length - 1];
      usedPromptIds = [];
      available = indexed.filter((p) => p.idx !== lastUsed);
      if (available.length === 0) available = indexed;
    }
    const prompt = available[Math.floor(Math.random() * available.length)];

    // Rotate clue-giver through players
    const clueGiverIndex = ((room.roundNumber ?? 1) - 1) % room.players.length;
    const clueGiverId = room.players[clueGiverIndex].id;

    // Random target position 1-10
    const target = Math.ceil(Math.random() * 10);

    return {
      leftLabel: prompt.leftLabel,
      rightLabel: prompt.rightLabel,
      category: prompt.category,
      target,
      clueGiverId,
      usedPromptIds: [...usedPromptIds, prompt.idx],
    };
  },

  onSubmission(room: RoomState, player: Player, content: unknown): void {
    const phase = (room.currentPhase ?? "").split("_")[0];
    const pd = (room.phaseData ?? {}) as Record<string, unknown>;
    const clueGiverId = pd.clueGiverId as string;

    if (phase === "clue") {
      if (player.id !== clueGiverId) {
        throw new Error("Kun fingerpegsgiveren kan indsende");
      }
      if (typeof content !== "string") throw new Error("Ugyldigt fingerpeg");
      const clue = content.trim().slice(0, 60);
      if (!clue) throw new Error("Tomt fingerpeg");
      upsertSubmission(room, player.id, "clue", clue);
      room.phaseData = { ...pd, clue };
    } else if (phase === "guess") {
      if (player.id === clueGiverId) {
        throw new Error("Fingerpegsgiveren kan ikke gætte");
      }
      const pos = Number(content);
      if (!Number.isInteger(pos) || pos < 1 || pos > 10) {
        throw new Error("Ugyldigt gæt — vælg 1-10");
      }
      upsertSubmission(room, player.id, "guess", pos);
    }
  },

  buildVoteData(): Record<string, unknown> {
    throw new Error("Hunch har ingen afstemningsfase");
  },

  onVote(): void {
    throw new Error("Hunch har ingen afstemningsfase");
  },

  getExpectedSubmitterCount(room: RoomState): number {
    const base = (room.currentPhase ?? "").split("_")[0];
    if (base === "clue") return 1;
    if (base === "guess") {
      // Count actual guessers — the clue-giver may have left mid-round, in
      // which case players.length - 1 would wait on a guess that never comes.
      const clueGiverId = (room.phaseData as Record<string, unknown> | undefined)
        ?.clueGiverId as string | undefined;
      return room.players.filter((p) => p.id !== clueGiverId).length;
    }
    return room.players.length;
  },

  computeResults(room: RoomState): {
    phaseData: Record<string, unknown>;
    scoreDeltas: Map<string, number>;
  } {
    const pd = (room.phaseData ?? {}) as Record<string, unknown>;
    const target = pd.target as number;
    const clueGiverId = pd.clueGiverId as string;
    const guessSubmissions = getSubmissions(room, "guess");

    const scoreDeltas = new Map<string, number>();
    const results: Array<{
      playerId: string;
      playerName: string;
      avatarColor: string;
      avatar?: AvatarTraits;
      guess: number | null;
      distance: number | null;
      score: number;
    }> = [];
    const teamScores: number[] = [];

    for (const player of room.players) {
      if (player.id === clueGiverId) continue;

      const sub = guessSubmissions.find((s) => s.playerId === player.id);
      const guess = sub ? (sub.content as number) : null;
      const distance = guess !== null ? Math.abs(guess - target) : null;
      const score = distance !== null ? scoreForDistance(distance) : 0;

      if (score > 0) {
        scoreDeltas.set(player.id, score);
      }
      teamScores.push(score);

      results.push({
        playerId: player.id,
        playerName: player.name,
        avatarColor: player.avatarColor,
        avatar: player.avatar,
        guess,
        distance,
        score,
      });
    }

    // Clue-giver bonus = floor(average of team scores)
    const clueGiverBonus =
      teamScores.length > 0
        ? Math.floor(teamScores.reduce((a, b) => a + b, 0) / teamScores.length)
        : 0;
    if (clueGiverBonus > 0) {
      scoreDeltas.set(clueGiverId, clueGiverBonus);
    }

    const clueGiver = room.players.find((p) => p.id === clueGiverId);

    return {
      phaseData: {
        ...pd,
        results,
        clueGiverBonus,
        clueGiverName: clueGiver?.name ?? "???",
      },
      scoreDeltas,
    };
  },

  filterForPlayer(room: RoomState, player: Player | null): Record<string, unknown> {
    const phase = (room.currentPhase ?? "").split("_")[0];
    const pd = (room.phaseData ?? {}) as Record<string, unknown>;
    const clueGiverId = pd.clueGiverId as string;
    const isClueGiver = player !== null && player.id === clueGiverId;

    if (phase === "clue") {
      if (isClueGiver) {
        const sub = getSubmissions(room, "clue").find((s) => s.playerId === player.id);
        const { usedPromptIds: _, ...visible } = pd;
        return { ...visible, mySubmission: sub?.content ?? null };
      }
      // Host + non-clue-givers: no target
      const { target: _, usedPromptIds: __, ...visible } = pd;
      const submittedCount = getSubmissions(room, "clue").length;
      return { ...visible, submittedCount };
    }

    if (phase === "guess") {
      const { target: _, usedPromptIds: __, ...base } = pd;
      const guessCount = getSubmissions(room, "guess").length;

      if (isClueGiver || player === null) {
        // Clue-giver and host see progress but not individual guesses
        return { ...base, submittedCount: guessCount, totalGuessers: room.players.length - 1 };
      }
      // Guesser sees their own guess only
      const sub = getSubmissions(room, "guess").find((s) => s.playerId === player!.id);
      return { ...base, myGuess: sub?.content ?? null };
    }

    // reveal / scores: show everything except internal tracking
    const { usedPromptIds: _, ...visible } = pd;
    if (player !== null && phase === "reveal") {
      const results = visible.results as Array<{ playerId: string }> | undefined;
      const myResult = results?.find((r) => r.playerId === player.id) ?? null;
      return { ...visible, myResult };
    }
    return visible;
  },

  getNextPhase(currentPhase: string, _event: string, room: RoomState): PhaseTransition {
    const roundNumber = room.roundNumber ?? 1;
    const totalRounds = room.totalRounds ?? 1;

    switch (currentPhase) {
      case "clue": {
        // Clue-giver went AFK (timer/host advanced with no clue): there is
        // nothing to guess on, so skip the round instead of a blind guess phase.
        const hasClue = getSubmissions(room, "clue").length > 0;
        if (!hasClue) {
          if (roundNumber >= totalRounds) {
            return { nextPhase: "finished", action: { type: "finish" } };
          }
          return { nextPhase: "clue", action: { type: "setup" }, advanceRound: true };
        }
        return { nextPhase: "guess", action: { type: "none" } };
      }
      case "guess":
        return {
          nextPhase: "reveal",
          action: { type: "computeResults" },
          // HostReveal staggers each guesser ~3.5s plus an outro — 30s flat cut
          // off the bonus at full rooms.
          timerOverride: 12_000 + Math.max(0, room.players.length - 1) * 4_000,
        };
      case "reveal":
        if (roundNumber >= totalRounds) {
          return { nextPhase: "finished", action: { type: "finish" } };
        }
        return { nextPhase: "scores", action: { type: "none" } };
      case "scores":
        if (roundNumber >= totalRounds) {
          return { nextPhase: "finished", action: { type: "finish" } };
        }
        return { nextPhase: "clue", action: { type: "setup" }, advanceRound: true };
      default:
        return { nextPhase: "finished", action: { type: "finish" } };
    }
  },
});

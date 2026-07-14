import type { AvatarTraits } from "../avatar";
import { registerGameHandlers } from "../registry";
import { getSubmissions, upsertSubmission } from "../submissions";
import type { Player, RoomState, PhaseTransition } from "../types";
import { MAX_STROKES, MAX_DRAWING_BYTES } from "../constants";
import { shuffle } from "../shuffle";

/**
 * Telefon (Gartic Phone clone) — chain-based telephone drawing game.
 *
 * Flow: write → draw_0 → guess_0 → draw_1 → guess_1 → ... → reveal → finished
 *
 * With N players there are N chains, each of length 2*(N-1)+1 items.
 * The chain rotates by exactly one player at every step: at both draw_K and
 * guess_K, player[j] works on the submission produced by player[(j-1+N)%N] in
 * the previous phase. So chain c (owned by playerIds[c]) is drawn at draw_K by
 * playerIds[(c+2K+1)%N] and guessed at guess_K by playerIds[(c+2K+2)%N].
 */

registerGameHandlers("morph", {
  config: {
    pack: "pack1",
    initialPhase: "write",
    totalRoundsForPlayerCount: () => 1,
    minPlayers: 3, // chains need at least write → draw → guess by 3 different players
  },

  setupRound(room: RoomState): Record<string, unknown> {
    const playerIds = shuffle(room.players.map((p) => p.id));
    const N = playerIds.length;
    return {
      playerIds,
      chainCount: N,
      stepCount: N - 1, // number of draw/guess pairs
    };
  },

  onSubmission(room: RoomState, player: Player, content: unknown): void {
    const phase = room.currentPhase!;
    const basePhase = phase.split("_")[0];

    if (basePhase === "write") {
      if (typeof content !== "string") throw new Error("Ugyldigt svar");
      const text = content.trim().slice(0, 120);
      if (!text) throw new Error("Skriv noget først");
      upsertSubmission(room, player.id, "write", text);
    } else if (basePhase === "draw") {
      const strokes = Array.isArray(content)
        ? content
        : (content as any)?.strokes;
      if (!Array.isArray(strokes) || strokes.length === 0) {
        throw new Error("Tegn noget først");
      }
      if (
        strokes.length > MAX_STROKES ||
        JSON.stringify(content).length > MAX_DRAWING_BYTES
      ) {
        throw new Error("Tegningen er for stor");
      }
      upsertSubmission(room, player.id, phase, content);
    } else if (basePhase === "guess") {
      if (typeof content !== "string") throw new Error("Ugyldigt gæt");
      const text = content.trim().slice(0, 120);
      if (!text) throw new Error("Tomt gæt");
      upsertSubmission(room, player.id, phase, text);
    }
  },

  buildVoteData(room: RoomState): Record<string, unknown> {
    // Telefon has no voting — no-op
    return { ...(room.phaseData ?? {}) };
  },

  onVote(): void {
    throw new Error("Morph har ingen afstemningsfase");
  },

  computeResults(room: RoomState): {
    phaseData: Record<string, unknown>;
    scoreDeltas: Map<string, number>;
  } {
    const phaseData = (room.phaseData ?? {}) as any;
    const playerIds: string[] = phaseData?.playerIds ?? [];
    const N = playerIds.length;
    const stepCount: number = phaseData?.stepCount ?? N - 1;

    // Build player lookup
    const playerMap = new Map(room.players.map((p) => [p.id, p]));

    // Fetch all submissions for this round
    const allSubmissions = room.submissions.filter(
      (s) => s.round === room.roundNumber,
    );

    // Group by phase
    const subsByPhase = new Map<string, Map<string, unknown>>();
    for (const s of allSubmissions) {
      if (!subsByPhase.has(s.phase)) subsByPhase.set(s.phase, new Map());
      subsByPhase.get(s.phase)!.set(s.playerId, s.content);
    }

    // Reconstruct chains
    const chains: Array<
      Array<{
        type: "write" | "draw" | "guess";
        playerId: string;
        playerName: string;
        avatarColor: string;
        avatar?: AvatarTraits;
        content: unknown;
      }>
    > = [];

    for (let c = 0; c < N; c++) {
      const chain: (typeof chains)[number] = [];
      const owner = playerIds[c];
      const ownerPlayer = playerMap.get(owner);

      // Step 0: the write
      chain.push({
        type: "write",
        playerId: owner,
        playerName: ownerPlayer?.name ?? "???",
        avatarColor: ownerPlayer?.avatarColor ?? "#888",
        avatar: ownerPlayer?.avatar,
        content: subsByPhase.get("write")?.get(owner) ?? "???",
      });

      for (let K = 0; K < stepCount; K++) {
        // Who drew for chain c at draw_K? The chain rotates +1 player per phase,
        // and each step is a draw+guess pair, so draw_K is 2K+1 hops from the owner.
        const drawerIdx = (c + 2 * K + 1) % N;
        const drawerId = playerIds[drawerIdx];
        const drawerPlayer = playerMap.get(drawerId);
        chain.push({
          type: "draw",
          playerId: drawerId,
          playerName: drawerPlayer?.name ?? "???",
          avatarColor: drawerPlayer?.avatarColor ?? "#888",
          avatar: drawerPlayer?.avatar,
          content: subsByPhase.get(`draw_${K}`)?.get(drawerId) ?? null,
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
          avatar: guesserPlayer?.avatar,
          content: subsByPhase.get(`guess_${K}`)?.get(guesserId) ?? "???",
        });
      }

      chains.push(chain);
    }

    // Score: 500 points if final guess matches original write (case-insensitive)
    const scoreDeltas = new Map<string, number>();
    for (let c = 0; c < N; c++) {
      const chain = chains[c];
      if (chain.length <= 1) continue;
      const firstContent = chain[0].content;
      const lastItem = chain[chain.length - 1];
      // Skip missing submissions: "???" is the display sentinel for an absent
      // write/guess and null is an absent drawing — never treat those as a match.
      if (firstContent == null || lastItem.content == null) continue;
      const original = String(firstContent).toLowerCase().trim();
      const finalGuess = String(lastItem.content).toLowerCase().trim();
      if (!original || !finalGuess) continue;
      if (original === "???" || finalGuess === "???") continue;
      // The chain owner must not score for guessing their own prompt.
      if (lastItem.playerId === chain[0].playerId) continue;
      if (original === finalGuess) {
        scoreDeltas.set(
          lastItem.playerId,
          (scoreDeltas.get(lastItem.playerId) ?? 0) + 500,
        );
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

  buildGuessData(room: RoomState, stepK: number): Record<string, unknown> {
    const phaseData = (room.phaseData ?? {}) as any;
    const playerIds: string[] = phaseData?.playerIds ?? [];
    const N = playerIds.length;
    const basePhase = room.currentPhase?.split("_")[0];

    if (basePhase === "write" || basePhase === "guess") {
      // Building assignments for draw_K — source is the previous player's
      // write (K=0) or guess_{K-1}. Always the immediately preceding player so
      // the chain rotates by exactly one at every step (see computeResults).
      const sourcePhase = stepK === 0 ? "write" : `guess_${stepK - 1}`;
      const sourceSubmissions = getSubmissions(room, sourcePhase);
      const subByPlayer = new Map(
        sourceSubmissions.map((s) => [s.playerId, s.content]),
      );

      const assignments: Record<string, { myPrompt: string }> = {};
      for (let j = 0; j < N; j++) {
        const sourceIdx = (((j - 1) % N) + N) % N;
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
      const sourceSubmissions = getSubmissions(room, sourcePhase);
      const subByPlayer = new Map(
        sourceSubmissions.map((s) => [s.playerId, s.content]),
      );

      const assignments: Record<string, { myDrawingData: unknown }> = {};
      for (let j = 0; j < N; j++) {
        const sourceIdx = (((j - 1) % N) + N) % N;
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

  filterForPlayer(room: RoomState, currentPlayer: Player | null): Record<string, unknown> {
    const phase = room.currentPhase ?? "";
    const basePhase = phase.split("_")[0];
    const pd = (room.phaseData ?? {}) as any;
    const submissions = getSubmissions(room);
    const players = room.players;

    if (phase === "write") {
      const mySubmission = submissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer.id,
      );
      return {
        submittedCount: submissions.length,
        totalPlayers: players.length,
        mySubmission: mySubmission?.content ?? null,
      };
    }
    if (basePhase === "draw" && phase !== "draw") {
      const myPrompt = currentPlayer
        ? pd?.assignments?.[currentPlayer.id]?.myPrompt ?? null
        : null;
      const mySubmission = submissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer.id,
      );
      return {
        stepIndex: pd?.currentStep ?? 0,
        totalSteps: pd?.stepCount ?? 1,
        myPrompt,
        mySubmission: mySubmission ? true : null,
        submittedCount: submissions.length,
        totalPlayers: players.length,
      };
    }
    if (basePhase === "guess" && phase !== "guess") {
      const myDrawingData = currentPlayer
        ? pd?.assignments?.[currentPlayer.id]?.myDrawingData ?? null
        : null;
      const mySubmission = submissions.find(
        (s) => currentPlayer && s.playerId === currentPlayer.id,
      );
      return {
        stepIndex: pd?.currentStep ?? 0,
        totalSteps: pd?.stepCount ?? 1,
        myDrawingData,
        mySubmission: mySubmission?.content ?? null,
        submittedCount: submissions.length,
        totalPlayers: players.length,
      };
    }
    // reveal: show all chain data
    return pd ?? {};
  },

  getExpectedSubmitterCount(room: RoomState): number {
    return room.players.length; // everyone participates in every phase
  },

  getNextPhase(currentPhase: string, _event: string, room: RoomState): PhaseTransition {
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

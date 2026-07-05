import type { Player, RoomState, Submission } from "./types";

let nextId = 0;

/**
 * Validate a vote target against the current round's answer list. The client
 * hides a player's own answer, but the server must enforce it too — otherwise a
 * hand-crafted WebSocket message can self-vote for points or send a fabricated
 * id that still counts toward the ALL_SUBMITTED total. Returns the accepted id.
 */
export function validateVote(room: RoomState, player: Player, content: unknown): string {
  const answerId = String(content);
  const answers = ((room.phaseData as any)?.answers ?? []) as Array<{
    id: string;
    playerId: string | null;
    mergedPlayerIds?: string[];
  }>;
  const answer = answers.find((a) => a.id === answerId);
  if (!answer) throw new Error("Ugyldig stemme");
  if (
    answer.playerId === player.id ||
    (answer.mergedPlayerIds ?? []).includes(player.id)
  ) {
    throw new Error("Du kan ikke stemme på dit eget svar");
  }
  return answerId;
}

/** Get submissions for the current round + phase */
export function getSubmissions(room: RoomState, phase?: string): Submission[] {
  const p = phase ?? room.currentPhase ?? "";
  return room.submissions.filter(
    (s) => s.round === room.roundNumber && s.phase === p,
  );
}

/** Upsert a submission (insert or update if player already submitted for this round+phase) */
export function upsertSubmission(
  room: RoomState,
  playerId: string,
  phase: string,
  content: unknown,
): void {
  const existing = room.submissions.find(
    (s) => s.playerId === playerId && s.round === room.roundNumber && s.phase === phase,
  );
  if (existing) {
    existing.content = content;
    return;
  }
  room.submissions.push({
    id: `sub_${++nextId}`,
    playerId,
    round: room.roundNumber!,
    phase,
    content,
    createdAt: Date.now(),
  });
}

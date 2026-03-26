import type { RoomState, Submission } from "./types";

let nextId = 0;

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

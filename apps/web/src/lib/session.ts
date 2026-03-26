const SESSION_KEY = "festspil_session_id";
export const PLAYER_NAME_KEY = "festspil-player-name";
export const PLAYER_AVATAR_KEY = "festspil-player-avatar";

/** Cached in module scope — only reads sessionStorage once */
let cachedSessionId: string | null = null;

export function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId;

  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem(SESSION_KEY, id);
  }

  cachedSessionId = id;
  return id;
}

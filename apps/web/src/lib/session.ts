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

/* -- Host session persistence (localStorage) -------------------- */

export const HOST_ROOM_KEY = "festspil_host_room";
export const HOST_SECRET_KEY = "festspil_host_secret";

export function setHostSession(roomCode: string, secret: string) {
  localStorage.setItem(HOST_ROOM_KEY, roomCode);
  localStorage.setItem(HOST_SECRET_KEY, secret);
}

export function getHostSession(): { roomCode: string; secret: string } | null {
  const roomCode = localStorage.getItem(HOST_ROOM_KEY);
  const secret = localStorage.getItem(HOST_SECRET_KEY);
  if (roomCode && secret) return { roomCode, secret };
  return null;
}

export function clearHostSession() {
  localStorage.removeItem(HOST_ROOM_KEY);
  localStorage.removeItem(HOST_SECRET_KEY);
}

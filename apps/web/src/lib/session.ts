const SESSION_KEY = "festspil_session_id";
export const PLAYER_NAME_KEY = "festspil-player-name";
export const PLAYER_AVATAR_KEY = "festspil-player-avatar";

function generateSessionId(): string {
  return crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
}

/** Cached in module scope — only reads sessionStorage once */
let cachedSessionId: string | null = null;

export function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId;

  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = generateSessionId();
    sessionStorage.setItem(SESSION_KEY, id);
  }

  cachedSessionId = id;
  return id;
}

/* -- Player session, scoped per room (localStorage) ------------- */

const ROOM_SESSION_PREFIX = "festspil_session_";
const roomSessionCache = new Map<string, string>();

/**
 * Player identity scoped to a room code, in localStorage so it survives the
 * browser killing the tab (locked phone between rounds). A new room gets a
 * new id; the same room always resolves to the same id on this device.
 */
export function getRoomSessionId(roomCode: string): string {
  const key = ROOM_SESSION_PREFIX + roomCode.toUpperCase();
  const cached = roomSessionCache.get(key);
  if (cached) return cached;

  // Migration: reuse the old tab-scoped id so live sessions survive the deploy
  let id = localStorage.getItem(key) ?? sessionStorage.getItem(SESSION_KEY);
  if (!id) id = generateSessionId();
  localStorage.setItem(key, id);

  roomSessionCache.set(key, id);
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

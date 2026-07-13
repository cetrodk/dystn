import type { GameHandlers } from "./types";

const handlers = new Map<string, GameHandlers>();

export function registerGameHandlers(gameType: string, h: GameHandlers) {
  handlers.set(gameType, h);
}

export function getGameHandlers(gameType: string): GameHandlers {
  const h = handlers.get(gameType);
  if (!h) throw new Error(`No handlers registered for game: ${gameType}`);
  return h;
}

export function hasGameHandlers(gameType: string): boolean {
  return handlers.has(gameType);
}

export function getAllGameHandlers(): ReadonlyMap<string, GameHandlers> {
  return handlers;
}

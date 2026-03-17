/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as game from "../game.js";
import type * as gameHandlers from "../gameHandlers.js";
import type * as games_bluff from "../games/bluff.js";
import type * as games_duel from "../games/duel.js";
import type * as games_sandhed from "../games/sandhed.js";
import type * as games_tegn from "../games/tegn.js";
import type * as games_telefon from "../games/telefon.js";
import type * as lib_advancePhase from "../lib/advancePhase.js";
import type * as lib_colors from "../lib/colors.js";
import type * as lib_gameConfig from "../lib/gameConfig.js";
import type * as lib_roomCodes from "../lib/roomCodes.js";
import type * as players from "../players.js";
import type * as rooms from "../rooms.js";
import type * as seed_bluffPrompts from "../seed/bluffPrompts.js";
import type * as seed_duelPrompts from "../seed/duelPrompts.js";
import type * as seed_sandhedPrompts from "../seed/sandhedPrompts.js";
import type * as seed_tegnPrompts from "../seed/tegnPrompts.js";
import type * as timers from "../timers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  game: typeof game;
  gameHandlers: typeof gameHandlers;
  "games/bluff": typeof games_bluff;
  "games/duel": typeof games_duel;
  "games/sandhed": typeof games_sandhed;
  "games/tegn": typeof games_tegn;
  "games/telefon": typeof games_telefon;
  "lib/advancePhase": typeof lib_advancePhase;
  "lib/colors": typeof lib_colors;
  "lib/gameConfig": typeof lib_gameConfig;
  "lib/roomCodes": typeof lib_roomCodes;
  players: typeof players;
  rooms: typeof rooms;
  "seed/bluffPrompts": typeof seed_bluffPrompts;
  "seed/duelPrompts": typeof seed_duelPrompts;
  "seed/sandhedPrompts": typeof seed_sandhedPrompts;
  "seed/tegnPrompts": typeof seed_tegnPrompts;
  timers: typeof timers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

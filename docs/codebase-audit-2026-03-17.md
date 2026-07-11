# Dystn — Full Codebase Audit (2026-03-17)

## Executive Summary

The foundation is solid — good reactive architecture, smart plugin system design, polished sound design, and clean lazy-loading. But there are real bugs, scaling risks, and dead code that need attention before building further.

---

## CRITICAL — Fix Before Building More

| # | Issue | Source | Files |
|---|---|---|---|
| 1 | **Race condition: double phase advancement** — two simultaneous "last submitter" mutations can skip a phase or double-write scores | Architect + Code Review | `convex/game.ts:295`, `convex/lib/advancePhase.ts` |
| 2 | **No `MAX_PLAYERS` enforcement** — unlimited joins; Telefon generates O(N) chains causing document size crashes | Architect + Code Review + UX | `convex/players.ts:70` |
| 3 | **`v.any()` schema fields** — `phaseData`, `settings`, `content` typed as `any`, cascading `as any` through every handler and component | Architect + React | `convex/schema.ts` |
| 4 | **Bluff prompt pollution** — fallback inserts into global `prompts` table without room scoping, permanently polluting the pool | Code Review | `convex/games/bluff.ts:22` |
| 5 | **No submission size limit** — malicious drawing data can push documents past Convex's 1MB limit, crashing the game | Code Review | `convex/game.ts:241` |
| 6 | **`useState` used as `useRef`** in ConnectionBanner — breaks under concurrent rendering | React | `src/components/ConnectionBanner.tsx:8` |
| 7 | **Stale closures in `useStaggeredReveal`** — empty deps capture callbacks at mount, silently ignores updates | React | `src/hooks/useStaggeredReveal.ts:82` |
| 8 | **Leaked timers** — `setTimeout`/`rAF` never cleaned up on unmount; StrictMode double-fires all score sounds | React | `src/games/duel/HostScores.tsx:22`, `HostView.tsx:490` |

---

## HIGH — Fix Soon

### Architecture

- **`getRoomForPlayer` is a 225-line god query** with game-specific filtering for every game/phase. Same for `advancePhaseInternal` (247 lines, 15 branches). New games require modifying both core files. **Fix:** Extend `GameHandlers` with `filterForPlayer()` and `getNextPhase()` methods.
- **Dead monorepo packages** — `packages/game-engine` (XState machine) and `packages/shared-types` have zero imports from application code. Remove or rebuild.
- **Heartbeat scheduling explosion** — 30 players = 30 scheduled sweeps/minute with no deduplication.
- **Convex subscription fan-out** — every submission invalidates all player subscriptions. Split queries to reduce blast radius.

### Security

- **Session identity is forgeable** — client-generated UUID with no server validation. `hostId` is exposed in `getRoom` response. Anyone who knows it can control the game.
- **PIN gate is brute-forceable** — 4-digit PIN, no rate limiting, default `"4477"` hardcoded.
- **Host page exposes unfiltered `phaseData`** — any player navigating to `/host/XXXX` sees secret words.

### React

- **`room: any` in all 20+ game components** — Convex-generated types completely unused at the component level. Create a `RoomSnapshot` type.
- **`catch (err: any)` in 4 components** — opts out of strict TypeScript's `useUnknownInCatchVariables`.
- **Index-as-key on drawing strokes** — undo causes incorrect reconciliation.
- **Duplicated waiting screen across 8 components** — extract a shared `<WaitingScreen>` component.

---

## UX — Biggest Playtest Wins

| Priority | Issue | Effort |
|---|---|---|
| 1 | **Add submission progress to waiting screens** — show "3/6 har svaret" + who's pending. Eliminates dead silence. | Low |
| 2 | **QR code + deep link** (`/join/ABCD`) on host lobby — removes 1-2 steps from every player join | Low |
| 3 | **Fix kicked player infinite loading** — `PlayerView` shows "Indlæser..." forever when kicked | Low |
| 4 | **Empty canvas silent failure** — tapping "Send" with no drawing gives zero feedback | Low |
| 5 | **Move avatar picker out of join form** — it blocks joining; move to lobby where there's time | Low |
| 6 | **"Dette er din kæde!" callout** in Telefon reveal — creates personal stakes | Low |
| 7 | **Show artist's drawing on their phone** during Tegn guess phase — eliminates dead spot | Medium |
| 8 | **Touch targets below 44px** — kick button, modal close buttons too small for party use | Low |

---

## Animation & UI

### Performance — Fix Immediately

1. **`ConfettiBackground`** — 16 concurrent Framer Motion JS animations on main thread on every screen. Replace with CSS `@keyframes`. Reduce to 10 dots.
2. **Vote bar animates `width`** (layout-triggering) — replace with `scaleX` transform.
3. **`HostSubmit` animates `backgroundColor`** — replace with opacity-over-color pattern.

### Motion Quality — Fix Soon

4. **No phase transitions on `PlayerView`** — host gets `AnimatePresence`, players get a hard swap.
5. **`hover:scale-105` on vote buttons sticks on touch** — use Framer Motion `whileHover`/`whileTap` instead.
6. **`ConnectionBanner` snaps in/out** — wrap in `AnimatePresence`.
7. **Stagger delay in `HostScores` uncapped** — compounds to 4.5s with 30 players.
8. **Inconsistent easing curves** — mix of springs with different stiffness. Create `src/lib/motion.ts` with shared presets.

### Missing Animations

9. Player list items have no `exit` animation when kicked.
10. `FinishedScreen` winner reveal has no dramatization — confetti fires but winner just fades in.
11. Submit confirmation `✓` is raw Unicode — renders inconsistently across devices. Replace with Lucide `CheckCircle`.

### What's Working Well (Keep)

- `CountdownTimer` using `requestAnimationFrame` + direct DOM mutation
- `useStaggeredReveal` timing choreography with sound sync
- Score counter `key={player.score}` re-trigger pattern
- `ActionCard` hover/tap interactions on LandingPage
- Lazy-loaded game components via `registry.ts`
- Bundle size is lean and appropriate

---

## Recommended Fix Order

1. **Phase version counter** — add `phaseVersion` to rooms schema, check in `advancePhaseInternal` (eliminates race condition)
2. **Enforce `MAX_PLAYERS`** in `joinRoom`
3. **Submission size guard** — `JSON.stringify(content).length > 200_000` check
4. **Fix leaked timers** — add cleanup returns to all `useEffect`s with `setTimeout`/`rAF`
5. **Fix `ConnectionBanner` useRef** and **`useStaggeredReveal` stale closures**
6. **Add waiting screen progress** — show who's submitted on player phones
7. **QR code + `/join/:code` deep link** on host lobby
8. **`ConfettiBackground`** → CSS keyframes
9. **Extend `GameHandlers`** with `filterForPlayer()` + `getNextPhase()` — the single biggest architectural improvement
10. **Type `room` properly** — create `RoomSnapshot`, eliminate `any` cascade

---

## Detailed Agent Reports

Full reports from each audit agent are available in the conversation history:

- **System Architect** — scalability, state management, plugin system, data flow, real-time patterns
- **UX Auditor** — join flow, game flow, error states, social experience, mobile usability
- **UI/Animation Auditor** — Framer Motion performance, animation quality, mobile frame drops, bundle size
- **Code Reviewer** — bugs, security, TypeScript quality, React/Convex patterns, error handling
- **React Best Practices** — component architecture, hooks, re-renders, state management, TypeScript integration

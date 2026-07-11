# Convex vs WebSockets — Architecture Analysis (2026-03-17)

## Context

Dystn uses Convex as the real-time backend. This analysis evaluates whether raw WebSockets (or Durable Objects / PartyKit) would be a better fit.

## What Convex Gave Us

Saved ~2-3 weeks of infrastructure work. Zero lines written for:
- WebSocket connection management
- Reconnection logic
- Message serialization/deserialization
- Subscription routing
- State synchronization

Backend is ~2,600 lines total, of which ~1,500 are pure game logic (handlers, scoring, phase transitions) that would exist in any architecture. Only ~1,100 lines are Convex-specific glue.

## Where Convex Is a Poor Fit

### Subscription Fan-Out (the main issue)

A party game room is a small, self-contained unit of state. Convex treats it as database rows that get re-queried on every change. When 1 player submits, all 9 subscriptions (1 host + 8 players) re-run the full query — read room, read all players, read all submissions, run `filterForPlayer`. That's ~72 re-evaluations during a submit phase where 8 people submit within seconds.

A Durable Object holds the entire room in memory and pushes targeted diffs. Zero re-queries.

### Not Using Convex's Strengths

Convex shines for complex cross-entity queries, long-lived data, global consistency. Dystn has ephemeral 30-minute rooms with no user accounts, no cross-room data, no long-term persistence. The persistence Convex provides is actively unhelpful — we need to clean up stale rooms, which is extra complexity.

### `v.any()` Schema Limitations

Three fields use `v.any()`: `phaseData`, `settings`, `content`. As we add games, `phaseData` becomes a bigger polymorphic blob. Convex's validator system can't express discriminated unions. With in-memory state we'd use TypeScript unions directly with full type safety.

### Cost at Scale

Subscription re-evaluations grow quadratically with room size. Per game session estimate (8 players, 3-round Duel):
- ~320 heartbeat mutations
- ~48 submission mutations
- ~3,300 query re-evaluations
- Total: ~3,700 function calls per game

At 1,000 concurrent rooms = 3.7M function calls/hour.

## The Alternative: PartyKit / Cloudflare Durable Objects

PartyKit (now part of Cloudflare as "PartyServer") is purpose-built for this use case — multiplayer rooms with real-time state.

```typescript
// One "party" per room — in-memory state, WebSocket per client
export default class GameRoom implements Party.Server {
  onConnect(conn)      { /* send current filtered state */ }
  onMessage(msg, conn) { /* handle join/submit/vote/advance */ }
  onAlarm()            { /* timer expired → advance phase */ }
}
```

The existing `GameHandlers` interface, `getNextPhase`, `filterForPlayer`, and all scoring logic port almost directly — they're already pure functions.

### Infrastructure Code Needed

| Component | Lines | Notes |
|---|---|---|
| WebSocket message protocol | ~200 | Types + serialization |
| Connection management | ~150 | Accept, track, disconnect |
| State broadcast (filtered per player) | ~100 | Reuses existing `filterForPlayer` |
| Room state machine | ~150 | Same as `advancePhaseInternal` but in-memory |
| Persistence (snapshots) | ~50 | Optional, for crash recovery |
| Client `useRoom()` hook | ~200 | Replaces `useQuery`/`useMutation` |
| Reconnection + catch-up | ~100 | Exponential backoff |
| **Total** | **~950** | With PartyKit: ~400 |

## Comparison

| | Convex | PartyKit/Durable Objects |
|---|---|---|
| Dev speed | Got us here fast | ~2-3 days to migrate |
| Runtime overhead | Re-queries on every write (quadratic fan-out) | In-memory + targeted diffs (linear) |
| Latency | Single AWS region | Cloudflare edge network |
| Type safety | `v.any()` holes | Full TypeScript unions |
| Cost at scale | Usage-based (query re-evals add up) | Fractions of a cent per game |
| Vendor lock-in | Deep (2,600 lines Convex-specific) | Moderate (Cloudflare, but less pervasive) |
| Persistence | Built-in (but we don't need it) | Opt-in snapshots |

## Recommendation

**Don't migrate now.** Finish all games, playtest, validate the product. If we decide to launch publicly, migrate to PartyKit — the `GameHandlers` architecture is clean enough that it's a mechanical port, not an architectural rewrite.

Migration effort estimate: ~2-3 days for a developer familiar with both systems.

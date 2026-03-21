# Analysis: Raising MAX_PLAYERS from 8 to 30

Investigation date: 2026-03-16

## Critical Blockers

### 1. Telefon (Gartic Phone) — game-breaking
- Each chain has N-1 steps. With 30 players: **30 chains × 59 steps = 1,770 items** to reveal
- Host must click through each step manually — that's a **45+ minute reveal session**
- `phaseData` document stores all chains in-memory, potentially ~885KB
- Chain reconstruction in `convex/games/telefon.ts` runs O(N × stepCount) = O(870) nested loop operations

### 2. Tegn & Gæt (Drawful) — severely degraded
- One drawing per player = **30 drawings**, each with guess → vote → reveal sub-phases
- That's **120 host-driven sub-phases** instead of 32, turning a 15-min game into a 2-3 hour marathon
- Each drawing triggers its own fetch and compute cycle

### 3. Voting screens overflow — all games
- Bluff: 30 fake answers + 1 truth = **31 voting options** (currently a vertical button list)
- Duel: 30 answers in a 2-column grid = 15 rows of scrolling
- Tegn: 30 guesses + 1 truth = 31 options
- Mobile screens (~375px wide) become nearly unusable

## Moderate Issues

| Area | File | Impact |
|------|------|--------|
| Score reveal animation | `src/games/duel/HostScores.tsx` | 30 × 150ms = 4.5s sequential animation |
| Bluff reveal animation | `src/games/bluff/HostReveal.tsx` | 30 × 400ms stagger = 12s for reveal |
| Avatar uniqueness | `convex/players.ts` | Only 23 images — 7 players get duplicates |
| Vote phase timing | `convex/lib/advancePhase.ts` | 30s to vote on 30 options = ~1s per option (too tight) |
| Lobby player list | `src/pages/HostView.tsx` | 30 × 50px = 1,500px tall, Start button pushed off-screen on mobile |
| Convex writes per heartbeat | `convex/players.ts` | 30 patch operations per sweep (every 60s) |
| Telefon score updates | `convex/lib/advancePhase.ts` | 30 × 30 chains × 2 = up to 1,800 patches per round |

## Existing Bug Found

**`joinRoom` in `convex/players.ts` never checks `MAX_PLAYERS`** — the constant is defined in `convex/lib/gameConfig.ts` but not enforced in the join mutation. Players can already exceed the limit with no error.

## Per-Game Breakdown

### Duel (Quiplash)
- **Playable at 30** with UI adjustments
- All answers compete in single pool — no pairing/matchmaking issues
- Scoring is linear (1000 points per vote), works fine
- Vote distribution becomes flatter (fewer extreme scores)

### Bluff (Fibbage)
- **Playable at 30** with UI adjustments
- 31 options on voting screen needs carousel/pagination
- Scoring: 500 × fooled count for fakes creates extreme score disparities (up to 14,500 per fake)

### Tegn & Gæt (Drawful)
- **Needs fundamental redesign** for 30 players
- 30 sequential drawings × 4 phases = 120 manual host advances
- Game duration: 10+ minutes of just reveals

### Telefon (Gartic Phone)
- **Needs fundamental redesign** for 30 players
- 1,770 sequential reveal steps
- Chain step count = N-1 grows linearly with players
- phaseData document size could approach Convex soft limits with drawing strokes (~10KB+ each)

## What Would Need to Change

1. **Enforce MAX_PLAYERS** in `joinRoom` (bug fix regardless of limit change)
2. **Telefon**: Cap chain length (e.g., 6 steps) instead of N-1, or paginate reveals
3. **Tegn**: Parallelize or batch drawing reveals instead of one-by-one
4. **Voting UI**: Carousel/paginated view instead of vertical list for 30+ options
5. **Phase timers**: Scale with player count (e.g., vote time = 10s + 2s × players)
6. **Avatar pool**: Expand beyond 23 images, or add color/accessory variants
7. **Lobby layout**: Wrap player list in scrollable container, keep Start button pinned

## Conclusion

**Duel and Bluff** would work at 30 players with UI adjustments (scrollable/paginated voting, timer scaling).

**Tegn and Telefon** would need fundamental game-logic changes — their phase counts and reveal flows scale linearly with player count, making them impractical beyond ~12 players without redesign.

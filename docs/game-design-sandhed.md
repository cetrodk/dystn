# Sandhed — Truth or False Racing Game

**Game type:** Real-time social deduction trivia race
**Danish name:** Sandhed (Truth)
**Inspiration:** Physical "stand on the right side" pub quiz games + racing
**Players:** 2–8
**Accent color:** TBD (polish phase)

---

## Core Concept

Players race their avatars across a track from left to right. Each round, a true/false statement appears. Players must move their avatar into either the **SANDT** (true) or **FALSK** (false) box by tapping. Moving between boxes takes **~1.5 seconds of travel time** — your avatar visibly crosses through a "no-man's land" in the middle. Correct answers move you one step forward on the track. Wrong answers move you one step back. First to cross the finish line wins.

**The twist:** Everyone can see where everyone else is — and where they're MOVING — in real time on the TV. If you see the smart player heading toward SANDT, you might follow. But if they reverse direction at the last second, you might not have time to make it back. And if the timer runs out while you're caught in the middle? You get nothing — just a shame animation for the whole room to laugh at.

---

## Why This Is Fun — The Social Dynamics

### 1. The Copycat Trap
> "Emma always knows geography... she moved to SANDT... wait she's switching! Too late!"

Players who don't know the answer will naturally watch the "smart" player. This creates a meta-game: knowledgeable players can intentionally bait followers by committing early to the wrong side, then switching at the last second.

### 2. Visible Commitment Creates Tension
Unlike a private button press, everyone sees your choice in real time on the TV. This creates:
- **Social pressure** — standing alone on one side feels scary
- **Herd behavior** — seeing 5 people on SANDT makes you doubt yourself
- **Dramatic reversals** — a last-second mass migration creates chaos and laughter

### 3. The Switch Cooldown Creates Stakes
The ~1.5s switch animation means:
- You can't just mirror someone perfectly
- Committing late is risky (less time to switch if you're wrong)
- Faking requires timing skill (switch too early and they follow you back)

### 4. The Race Creates Escalating Drama
- Players who are behind take more risks (follow the leader or gamble alone)
- Players near the finish get conservative (one wrong answer and someone catches up)
- Comeback potential: even trailing players can win with a streak

### 5. "Heads Up" By Design
The TV shows the racetrack with all avatars moving in real time. Players naturally look UP at the screen to see what others are doing, not down at their phone. The phone is just a simple two-button (or swipe) input device. This perfectly aligns with Dystn's "heads up, not heads down" principle.

---

## Game Flow

### Setup
- Each player gets a colored avatar (animal? emoji? simple shape?) on the racetrack
- Track has ~10 positions (steps) from start to finish line
- All players start at position 0 (leftmost)

### Round Loop (repeats until someone finishes)

```
┌─────────────────────────────────────────────────────┐
│  1. SHOW STATEMENT (host screen)                    │
│     "Danmark har flere øer end Sverige"             │
│     Timer starts: 10 seconds                        │
│                                                     │
│  2. COMMIT PHASE (real-time, 10s)                   │
│     Players drag/tap to SANDT or FALSK              │
│     All positions visible on TV in real-time        │
│     Switching has ~1.5s animation cooldown          │
│     Last 3 seconds: dramatic countdown sound        │
│                                                     │
│  3. LOCK & REVEAL (2-3s)                            │
│     Positions lock when timer hits 0                │
│     Brief pause for tension...                      │
│     Correct answer revealed with animation          │
│                                                     │
│  4. MOVE AVATARS (3-4s)                             │
│     Correct players: avatar hops forward 1 step     │
│     Wrong players: avatar slides back 1 step        │
│     (Cannot go below position 0)                    │
│     Sound effects per movement                      │
│                                                     │
│  5. CHECK WIN CONDITION                             │
│     If any player reached the finish → victory!     │
│     If multiple finish same round → highest pos     │
│     Otherwise → next statement                      │
│                                                     │
│  6. BRIEF PAUSE (2s)                                │
│     Scoreboard/track visible, catch breath          │
│     Next statement loads                            │
└─────────────────────────────────────────────────────┘
```

### Victory
- First player to reach the finish line wins
- If multiple players cross on the same round, the one furthest ahead wins (or tie)
- Victory animation on TV, player's phone shows celebration

---

## Host Screen (TV) Design

### During Commit Phase
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   "Danmark har flere øer end Sverige"                │
│                                                      │
│   ┌──── SANDT ────┐        ┌──── FALSK ────┐        │
│   │               │        │               │        │
│   │   🟢 Emma     │        │   🔵 Lars     │        │
│   │   🟡 Sofie    │        │   🔴 Magnus   │        │
│   │               │        │               │        │
│   └───────────────┘        └───────────────┘        │
│                                                      │
│   ═══════════════════════════════════════════════     │
│   🟢─────🟡──🔵──────🔴───────────────── 🏁        │
│   ═══════════════════════════════════════════════     │
│                                                      │
│                      ⏱ 7                             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

The top area shows the statement and who's standing where (real-time). The bottom shows the persistent racetrack with current positions. The timer counts down prominently.

### During Reveal
- Correct side lights up green, wrong side lights up red
- Avatars on wrong side do a comedic wobble/fall animation
- Track updates with smooth hop/slide animations

### Alternative Layout: Combined Track View
Instead of separate SANDT/FALSK zones, the racetrack itself could split into two lanes during the commit phase — a "true lane" and "false lane" — so players see their avatar physically move between lanes on the track. This keeps the racing metaphor consistent and makes the reveal more dramatic as wrong-lane avatars get pushed back.

---

## Player Screen (Phone) Design

Extremely simple — two large buttons or a swipe gesture:

```
┌─────────────┐
│             │
│   SANDT     │  ← tap or swipe up
│   (grøn)    │
│             │
│─────────────│
│             │
│   FALSK     │  ← tap or swipe down
│   (rød)     │
│             │
│  ⏱ 7       │
│  Position: 4│
└─────────────┘
```

- Current selection highlighted with color
- When switching: brief animation/haptic showing the cooldown
- Shows your current track position
- Maybe: small indicator of how many players are on each side (without names)

---

## Key Design Decisions — LOCKED

### 1. Movement Mechanic: Three-Position System
**DECIDED:** Players exist in one of three positions during the commit phase:
- **SANDT** (true box, left)
- **In transit** (the middle, no-man's land)
- **FALSK** (false box, right)

Moving from one box to the other takes **~1.5 seconds of travel time**. During transit, the avatar is visibly in the middle — everyone on the TV can see them moving. There is no cooldown or switch limit — you can reverse direction at any time — but the travel time means you physically cannot make it if you start too late.

**When the timer locks (0 seconds), wherever your avatar is, that's your final position:**
- In SANDT box → your answer is "true"
- In FALSK box → your answer is "false"
- Caught in transit → treated as **no answer** (shame animation, no movement — see 3b)

This creates the core tension: you can SEE someone start moving across, and if they started too late, they'll get stuck in the middle. It rewards early commitment and punishes reckless last-second switches.

**Implementation:** Each `submitAnswer()` call sends `{ choice: "true" | "false" | "transit", targetSide: "true" | "false" }`. The server stores the current position. On timer expiry, `computeResults` reads each player's final position. Players still in "transit" are treated as no-answer. The client-side animation handles the smooth movement — the server just tracks discrete state.

### 2. Track Length: 8 Steps
**DECIDED:** 8 steps from start (position 0) to finish line (position 8). Host settings can adjust if needed.

### 3. Movement Rules: Standard +1/-1
**DECIDED:** +1 step for correct, -1 for wrong, minimum position 0. No streak bonus or rubber-banding for MVP.

### 3b. No-Answer / Caught in Transit
**DECIDED:** Visible shame + no movement. This now naturally covers two cases:
1. **Player never tapped anything** — no submission at all
2. **Player caught in transit** — started switching too late, stuck in the middle

Both are treated identically: avatar gets a "confused" animation (spinning question marks) on the TV, no position change, social pressure discourages repeating it.

**Implementation:**
- Server: In `computeResults`, any player whose final position is `"transit"` or who has no submission gets `scoreDelta: 0` and `noAnswer: true` in results.
- Host screen: During reveal, confused animation on their avatar.
- Player phone: "Du nåede ikke at vælge!" (You didn't choose in time!).
- `phaseData.results` includes `{ playerId, choice: null, correct: false, noAnswer: true }`.

### 4. Timer Duration: 20 Seconds
**DECIDED:** 20 seconds for the commit phase. Last 3 seconds get dramatic audio cues. The full 20 seconds always plays out — no auto-advance when all players have picked a side, because the bluffing/switching IS the game. 20 seconds gives enough time to: read the statement (~3s), pick a side (~2s), observe others (~5s), consider switching (~3s), and potentially execute a bluff-switch cycle (~3s). With a 1.5s transit time, this allows 2-3 meaningful switches per round.

### 5. Statement Visible on Phone: Yes
**DECIDED:** Show the statement on the player's phone too (secondary to TV). Some players might be far from the screen. The social dynamics come from watching the SANDT/FALSK choices on TV, not from where you read the statement.

### 6. Information Visibility: Full Names
**DECIDED:** TV shows exactly who is on which side and who is in transit, with names visible. The whole fun is "I see Emma moving to FALSK!" — anonymity would kill the social layer.

### 7. Multi-Finish Tie-Breaking: Shared Victory
**DECIDED:** If multiple players cross the finish line on the same round, they all win together. It's a party game — celebrating together is more fun than a sudden-death tiebreaker.

---

## Mapping to Dystn Architecture

### Phase Structure
Unlike other Dystn games (submit → vote → reveal loop), Sandhed is a **continuous real-time loop** with no distinct submission phase. This is a new pattern.

```
Phases:
  "countdown"  → 3-2-1 start animation (once, at game start)
  "commit"     → Players choose SANDT/FALSK (10s, real-time, three-position system)
  "reveal"     → Positions lock, answer revealed, track movement animated, win check (5s)
  "victory"    → Someone crossed the finish line! Final celebration
```

Note: no separate "move" phase — the reveal phase handles answer reveal AND track animation in one step. This keeps the loop tight: commit → reveal → commit → reveal → ... → victory.

The `commit` phase is fundamentally different from existing `submit` phases — it requires **real-time position broadcasting** rather than one-shot submissions.

### Real-Time Position Updates
**DECIDED:** Last-value-wins via `submitAnswer()`. Each time a player taps SANDT or FALSK, the client calls `submitAnswer()` with `{ choice: "true" | "false" | "transit", targetSide: "true" | "false" }`. The server upserts the submission and updates `phaseData.currentChoices` so all clients see the change via Convex subscription.

The travel animation is client-driven: when a player taps the opposite side, the client immediately sends `{ choice: "transit", targetSide: "false" }`, starts the ~1.5s animation, and after it completes sends `{ choice: "false" }`. If the player reverses mid-transit, the client sends a new transit toward the other side. The server doesn't enforce timing — it just stores the latest state. On timer expiry, `computeResults` reads each player's final `choice` value.

No auto-advance when all players have submitted — the 10 seconds always plays out.

### GameHandlers Implementation

```typescript
// Sandhed game handler sketch
{
  setupRound: () => {
    // Pick next statement from prompts table (gameType: "sandhed")
    // correctAnswer stored in prompt.answer as "true"/"false"
    // Carry trackPositions from previous round (or init to 0)
    // Clear currentChoices for the new round
    // return { statement, correctAnswer, trackPositions, currentChoices, finishLine, statementIndex }
  },

  onSubmission: (room, player, content) => {
    // content = { choice: "true" | "false" | "transit", targetSide?: "true" | "false" }
    // Upsert into submissions table
    // Update phaseData.currentChoices[player._id] = content.choice
    // Patch room.phaseData so Convex subscription broadcasts to all clients
    // Do NOT auto-advance — timer-driven only
  },

  computeResults: () => {
    // For each player:
    //   - Read their final submission choice
    //   - If choice === "transit" or no submission → noAnswer: true, delta: 0
    //   - If choice matches correctAnswer → delta: +1
    //   - If choice doesn't match → delta: -1 (min position 0)
    // Update trackPositions with deltas
    // Check if any player reached finishLine (position >= 8)
    // Return { phaseData: { ...updated trackPositions, results[] }, scoreDeltas }
  },

  filterForPlayer: (room, player, submissions, players) => {
    // commit phase: show currentChoices (all players' positions — this IS the game)
    //               show statement text, show trackPositions
    //               HIDE correctAnswer
    // reveal phase: show everything including correctAnswer and results
    // move phase:   show updated trackPositions
  },

  getNextPhase: () => {
    // countdown → commit (setup)
    // commit → reveal (computeResults)
    // reveal → commit (setup, if no winner)
    // reveal → victory (finish, if someone reached finishLine)
  }
}
```

### Schema Approach
Uses the existing `prompts` table (no new table needed):
```typescript
// Prompts for Sandhed stored as:
{
  gameType: "sandhed",
  text: "Danmark har flere øer end Sverige",  // the statement
  answer: "true",                              // "true" or "false" as string
  category: "geografi",                        // optional
}
```

### Room phaseData Shape for Sandhed
```typescript
{
  statement: string,                                        // current statement text
  correctAnswer: string,                                    // "true" | "false" (hidden until reveal)
  trackPositions: Record<string, number>,                   // playerId → track position (0-8)
  currentChoices: Record<string, "true" | "false" | "transit">,  // live positions during commit
  finishLine: number,                                       // 8 (default)
  statementIndex: number,                                   // which statement we're on
  results?: Array<{                                         // populated during reveal
    playerId: string,
    playerName: string,
    avatarColor: string,
    choice: "true" | "false" | null,
    correct: boolean,
    noAnswer: boolean,
    delta: number,                                          // +1, -1, or 0
    newPosition: number,
  }>,
  winners?: string[],                                       // playerIds who crossed finish line
}
```

### Component Structure
```
src/games/sandhed/
  HostCountdown.tsx    — 3-2-1 start
  HostCommit.tsx       — Statement + SANDT/FALSK zones + live racetrack
  PlayerCommit.tsx     — Two big buttons + cooldown animation
  HostReveal.tsx       — Answer reveal + movement animations
  PlayerReveal.tsx     — "Look at screen" (or show result on phone)
  HostVictory.tsx      — Winner celebration
  PlayerVictory.tsx    — Personal result
```

---

## Prompt Pool Requirements

Need ~50-100 true/false statements in Danish. Mix of:
- **Geography:** "Mount Everest er det højeste bjerg i verden" (sandt)
- **History:** "Vikingerne opdagede Amerika før Columbus" (sandt)
- **Pop culture:** "ABBA var et dansk band" (falsk — Swedish)
- **Science:** "Mennesker bruger kun 10% af deres hjerne" (falsk)
- **Denmark-specific:** "Storebæltsbroen er længere end Øresundsbroen" (sandt)
- **Absurd/funny:** "En gruppe flamingoer kaldes en 'flamboyance'" (sandt)

Good statements should:
- Be debatable enough that people aren't sure (not too obvious)
- Cover topics where different people have different knowledge (geography nerd vs history nerd)
- Include some surprising truths (things that sound false but are true) — these create the best social dynamics
- Include some convincing lies (things that sound true but are false)

---

## Playtesting Hypotheses to Validate

### H1: The bluffing layer actually works
**Test:** Do players actually watch and follow others? Or do they just pick independently?
**Risk:** If everyone just picks their own answer, the "see others" mechanic adds nothing.
**Mitigation:** Make the TV view SO prominent and readable that you can't miss what others are doing. Add sound effects when someone switches sides.

### H2: The switch cooldown feels fun, not frustrating
**Test:** Does 1.5s feel like a fun constraint or an annoying lag?
**Risk:** Players might feel the game is "laggy" or unresponsive.
**Mitigation:** Crystal clear animation showing the switch in progress. Haptic feedback on phone. Maybe a "whoosh" sound on the TV when someone switches.

### H3: 10 seconds is the right timer
**Test:** Is there enough time for the social dynamics to play out?
**Risk:** Too short = everyone just picks and there's no bluffing. Too long = boring waiting.
**Mitigation:** Test 8s, 10s, and 12s in playtests.

### H4: The race format maintains energy
**Test:** Does the game stay exciting throughout? Or does it drag after 10+ statements?
**Risk:** If one player gets far ahead, others disengage.
**Mitigation:** Rubber-banding option. Keep track short (8 steps). Add special "double move" rounds randomly.

### H5: The game works with different player counts
**Test:** Is it fun with 2 players? With 8?
**Risk:** With 2 players, the social dynamic is thin. With 8, the TV might be too crowded.
**Mitigation:** Minimum 3 players? Compact avatar design for 8 players.

---

## Power-Up Ideas (Post-MVP)

These are optional mechanics to add variety if the base game tests well:

1. **Dobbelt eller Intet (Double or Nothing):** Certain rounds are marked as 2x — move 2 steps forward or 2 back. Higher stakes, more drama.

2. **Spionagen (The Spy):** One random player secretly sees the correct answer. Others know someone is a spy but not who. Creates paranoia: "Why is Lars so confident?"

3. **Frys! (Freeze!):** A random player gets "frozen" for one round — their avatar is visible but locked on one side. Others might follow them thinking they chose, but they had no choice.

4. **Vende-runden (Reversal Round):** Wrong answer moves you FORWARD, correct moves you BACK. Announced at start of round. Chaos ensues.

5. **Muren (The Wall):** At track position 6, there's a wall. You need 2 correct in a row to break through. Creates a bottleneck near the finish.

---

## Comparison to Existing Dystn Games

| Aspect | Duel | Bluff | Tegn | **Sandhed** |
|--------|------|-------|------|-------------|
| Input type | Text | Text | Draw/Text | Binary tap |
| Creativity needed | High | Medium | High | **None** |
| Knowledge needed | None | High | None | **High** |
| Social reading | Voting | Voting | Voting | **Real-time** |
| Tempo | Slow (60s submit) | Medium (30s) | Medium | **Fast (10s)** |
| Rounds | 3 | 3 | 1 | **8-15** |
| Win condition | Score | Score | Score | **Finish line** |

Sandhed fills a unique niche: it's the **fastest-paced** game, requires **zero creativity** (great for players who freeze on creative prompts), and has the only **real-time social interaction** during the answer phase.

---

## Open Questions (Polish — Can Wait Until After MVP)

1. ~~**No answer penalty**~~ — Resolved. See "3b. No-Answer / Caught in Transit".
2. **Avatar selection:** Auto-assign colors for now. Can revisit animal/emoji picker later.
3. **Statement difficulty progression:** Random for MVP. Can add ramping later if needed.
4. **Spectator mode:** No elimination in this game, so not needed.
5. **Sound design:** TBD during polish. Ticking clock + whoosh on switch + dramatic last 3s.
6. **Can the host play too?** Defer — standard host-is-separate for MVP.
7. **Accent color:** TBD during UI implementation.
8. **TV layout (split zones vs combined track):** TBD during UI implementation.

# Dystn Social Experience Research

First playtest feedback: the game works technically but people stared at phones, timing was too rushed for social interaction, and it didn't feel like a group experience.

---

## Current State (What We Have)

### Timer Values
| Phase | Default | Range |
|-------|---------|-------|
| Submit (write answers) | 60s | 15-180s |
| Vote | 30s | 10-90s |
| Reveal | 10s | 5-30s |
| Scores | 8s | 3-20s |
| Draw (Tegn) | 90s | 30-180s |
| Guess (Tegn) | 45s | 15-90s |

### What's Working
- Host/player split architecture is solid
- PlayerReveal already shows "Look at screen!" with floating eyes emoji
- Framer Motion animations with staggered delays on reveals
- Synthesized sound effects for transitions (sfxReveal, sfxFanfare, sfxTick, sfxUrgent)
- Countdown warnings at 10s and 5s

### What's Missing
- **No breathing room** between reveals — 10s total for all results is way too fast
- **No staggered per-answer reveals** — all answers appear at once with cascade animation, but the game doesn't pause between them
- **No host character** — no personality driving attention to the screen
- **No anticipation build-up** — no dramatic pauses before reveals
- **No reaction sounds** — no crowd laughter, gasps, or "ooh" sounds
- **No explicit "check your phone" signal** — only "look at screen" exists
- **Voting on phone is too involved** — players see all answers as buttons, keeping them phone-focused during what should be a shared-screen moment

---

## How Jackbox Does It

### The Jack Principles (Jackbox's Design Playbook)
1. **Maintain pacing** — one task at a time, players always know what to do next
2. **Create the illusion of a host** — "Interactive Conversation Interface" — feel like a real host is talking to you
3. **TV language** — pacing, transitions, and dialogue that feel like a TV show, not software

### Quiplash Timing (Our Duel)
| Phase | Duration | Notes |
|-------|----------|-------|
| Writing | 60s | Two prompts per player |
| Voting per matchup | 10-15s | Both answers shown on TV, simple A/B vote on phone |
| Reveal per matchup | 5-8s | Vote percentage bar animates, then authors revealed |
| Scoreboard between rounds | 5s | Brief escalating totals |
| Total game | ~15 min | |

**Key flow per matchup:**
1. Prompt appears on TV with both answers
2. Players vote on phones (simple A/B — a glance, not sustained attention)
3. Vote percentage bar animates (dramatic split reveal)
4. Author names revealed with pause
5. Points awarded with animation
6. **Room reacts** — this is where laughter happens
7. Next matchup

### Fibbage Timing (Our Bluff)
| Phase | Duration | Notes |
|-------|----------|-------|
| Lie writing | 60s | "Lie for Me" fallback button |
| Guessing/voting | 30s | All lies + truth randomized |
| Reveal per question | 10-15s | Sequential: who wrote each lie, who fell for it, truth last |
| Total game | ~15-20 min | |

### Drawful Timing (Our Tegn)
| Phase | Duration | Notes |
|-------|----------|-------|
| Drawing | 35-40s | Limited tools intentionally |
| Fake title writing | 60s | Others write fake titles |
| Guessing | 30s | All titles + real randomized |
| Reveal per drawing | 10-15s | Sequential per-answer reveal |
| Total game | ~15 min | |

### Critical Difference: Per-Item Reveals
Jackbox **never** shows all results at once. Each matchup/answer is revealed one at a time:
- Answer A appears → pause → Answer B appears → pause → votes animate → author revealed
- This creates a **series of small resolutions** rather than one big dump
- Each step is a mini-reveal with anticipation between them

---

## The 10 Changes We Need

### 1. Staggered Per-Answer Reveals (Biggest Impact)
**Current:** All answers appear at once with cascade animation (0.4s stagger)
**Target:** Reveal answers ONE AT A TIME with 3-5 second pauses between each

For Duel: Show prompt → pause → Answer A slides in → room reads & reacts (3s) → Answer B slides in → room reacts (3s) → vote percentages animate → winner announced

For Bluff: Show question → each lie revealed one by one with "who fell for it" → truth revealed LAST with fanfare

### 2. Add Breathing Room After Reveals
**Current:** Reveal phase = 10s total for everything
**Target:**
- Per-answer reveal: 5-8s each
- Post-reveal reaction pause: 3-5s
- Total reveal phase: `(numAnswers * 8s) + 5s` minimum

### 3. Phase Separation: Phone Down During Reveals
**Current:** Players see "Look at screen!" during reveals (good)
**Target:** Make this more dramatic:
- Phone screen dims or goes dark except for a small "watch the screen" message
- Voting happens ON the shared screen with verbal/physical voting, or phone shows only a single large A/B button (glance interaction, not sustained attention)

### 4. Add Host Character Personality
**Current:** No host — just UI transitions
**Target:** A text-based host character that:
- Introduces each round ("Runde 2! Nu bliver det spicy!")
- Directs attention ("Tjek jeres telefoner — I har fået et spørgsmål!")
- Builds anticipation ("Lad os se hvad I har fundet på...")
- Reacts to results ("Uh, det var tæt!" / "Enstemmigt!" / "Ingen stemte på den!")
- Fills transitions with personality

Use typewriter-style text animation to control reading pace.

### 5. Audio Phase Signals
**Current:** sfxReveal, sfxFanfare, sfxTick, sfxUrgent exist
**Target:** Add:
- **Phone notification sound** — short chime when phone needs input
- **"Look up" fanfare** — distinct sound when reveal starts on big screen
- **Drumroll/build-up** — before each individual answer reveal
- **Crowd reaction sounds** — laughter, gasps, applause after reveals
- **Background music** — low enough to talk over, present enough to fill silence

### 6. TV-Language Transitions
**Current:** Fade/slide transitions between phases
**Target:**
- Animated "bumper" screens between phases (like TV show segment transitions)
- Music changes to signal phase shifts
- Never jump-cut from one phase to another
- Host dialogue fills transition time

### 7. Generous Input Timers
**Current:** 60s submit is reasonable
**Target:** Keep 60s but add:
- Visual "last 10 seconds" warning with urgency music
- Auto-submit when time runs out (don't forfeit — submit whatever they have)
- "Everyone's in!" celebration when all submit early (reward speed)

### 8. Score as Seasoning, Not the Meal
**Current:** 8s score screen with animations
**Target:**
- Keep score display brief
- Add more emphasis on WHO made people laugh (reaction-based feedback)
- "Best answer" callouts alongside raw scores
- Don't make scoring feel high-stakes — kills humor

### 9. Social Prompts
**Target:** Add prompts that reference the group:
- "Hvad ville [Spiller X] mest sandsynligt..."
- Forces players to discuss each other — the answer is in the room, not on the phone

### 10. "Jinx" / Special Moments
**Target:** Detect and celebrate special moments:
- Two players write the same answer → "JINX!" moment
- Unanimous vote → special celebration
- Someone fools everyone → dramatic reveal
- Zero votes on an answer → comedic consolation

---

## Recommended Timer Values (v2)

| Phase | Current | Proposed | Notes |
|-------|---------|----------|-------|
| Submit | 60s | 60s | Keep — generous enough for funny answers |
| Vote | 30s | 15s | Shorten — voting should be instinctive |
| Reveal (per answer) | N/A (10s total) | 6-8s each | NEW — staggered per-answer |
| Reveal (total) | 10s | Dynamic: answers × 8s | Adapts to number of answers |
| Post-reveal pause | N/A | 3-5s | NEW — breathing room for laughter |
| Scores | 8s | 5s | Brief — the fun already happened |
| Between rounds | 0s | 5-8s | NEW — host commentary, score recap |

### Reveal Phase Breakdown (per matchup in Duel)
1. Host intro: "Lad os se..." (2s)
2. Answer A appears with sound (3s reading time)
3. Answer B appears with sound (3s reading time)
4. "Vote now!" — phones show A/B buttons (10-15s)
5. Drumroll (2s)
6. Vote percentages animate (3s)
7. Winner announced with fanfare (2s)
8. Author reveal (2s)
9. Breathing room (3s)
10. Next matchup or scores

**Total per matchup: ~25-30 seconds** (vs current ~3-4 seconds)

---

## Implementation Priority

### Phase 1: Quick Wins (Biggest bang for effort)
1. **Increase reveal time** — change default from 10s to 30s+
2. **Add per-answer staggering** — modify HostReveal to show answers sequentially
3. **Add drumroll/build-up sounds** before reveals
4. **Add crowd reaction sounds** after reveals

### Phase 2: Host Character
5. **Create host text system** — contextual Danish host lines
6. **Typewriter text animation** on host screen
7. **Host reactions** based on game state (close vote, unanimous, etc.)

### Phase 3: Phone Optimization
8. **Simplify vote UI** — large A/B buttons only, minimize phone attention
9. **Add phone vibration** for "your turn" notification
10. **Dim phone during reveals** — reinforce "look up"

### Phase 4: Polish
11. **Background music** system for different phases
12. **Social prompts** referencing players
13. **Special moment detection** (jinx, unanimous, etc.)
14. **TV-style bumper transitions** between phases

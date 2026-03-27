# Festspil — Design Prompt

Use this description to generate UI/UX design concepts for the Festspil party game platform.

---

## The Product

A browser-based party game platform where a group of friends (2–8 people) play together in the same physical room. One device (TV or laptop) acts as the shared screen that everyone watches. Each player uses their own phone as a controller — no app install needed, just a web URL.

The entire interface is in Danish.

## Two Screens to Design

### 1. The Host Screen (TV / big screen)
This is displayed on a TV or large monitor in the room. Everyone looks at this screen together. It should be:
- Readable from across a room (large text, high contrast)
- Visually entertaining — this IS the show
- Designed for landscape orientation
- Bold, expressive, and fun to watch even when you're not actively playing

### 2. The Player Screen (phone)
Each player holds their phone. It should be:
- Dead simple — one task at a time
- Fast to use — minimize time spent looking down
- Designed for portrait orientation on mobile
- Clear about what to do right now (write, vote, draw, wait)

## The User Flow

### Landing → Room Creation
The host opens the website and creates a room. They get a short room code (4 letters). This code is displayed prominently so players can see it from across the room and type it into their phones.

### Lobby
Players join by entering the code and picking a name. The host screen shows:
- The room code (very large, prominent)
- A list of joined players (with avatars/colors)
- A game picker — 4 games to choose from, each with an icon, name, and short description
- A "Start" button once a game is selected and enough players have joined

The player phone shows:
- Confirmation that they're in
- The player list
- A waiting message

### During Gameplay
The game alternates between two modes:

**Input mode** (players look at phones): Players write an answer, draw something, or vote. The host screen shows a countdown timer, the prompt/question, and a progress indicator (3/5 have answered).

**Reveal mode** (everyone watches TV): Answers are revealed one at a time on the big screen with dramatic timing. Players' phones go passive with a "watch the screen" message. This is where the laughter happens.

### Between Games
After a game finishes, the host can play the same game again or go back to the lobby to pick a different game. Players stay connected — no need to re-enter the code.

## The 4 Games

**Duel** — Everyone gets the same funny question. Write your best answer. Vote on the funniest. (Think: Quiplash)

**Bluff** — A trivia question with a blank. Write a fake answer that sounds real. Then guess which one is actually true. (Think: Fibbage)

**Tegn & Gæt** (Draw & Guess) — Draw a secret word on your phone. Others write fake guesses. Vote on which guess is real. (Think: Drawful)

**Telefon** (Telephone) — A chain: write → draw → guess → draw → guess. The whole chain is revealed at the end. (Think: Telestrations / Gartic Phone)

## Visual Tone & Feel

- **Party energy** — vibrant, playful, not corporate or serious
- **Dark background** with colorful accents — designed for dimly-lit living rooms
- **Each game has its own accent color** — so switching games feels like a different vibe
- **Minimal chrome** — no navigation bars, no menus, no clutter. The content IS the interface
- **Animations matter** — reveals, transitions, and celebrations should feel alive
- **Game show aesthetic** — think TV quiz show, not mobile app. The shared screen should feel like entertainment, with host text, dramatic pauses, and fanfare moments

## Key Design Challenges

1. **The room code moment** — How do you make it effortless for 6 people to all see the code from across the room and type it into their phones?

2. **Phone vs. screen attention** — How do you make it visually obvious when to look at your phone vs. when to look up at the TV?

3. **The game picker** — 4 games with different mechanics. How do you help a group quickly understand and choose what to play?

4. **The reveal** — This is the core social moment. How do you build anticipation, reveal answers one at a time, and create space for the room to react?

5. **Score without stress** — Points exist but shouldn't feel competitive. The real reward is making your friends laugh. How do you show progress without killing the humor?

6. **Drawing on a phone** — Limited canvas, finger input, no undo. How do you make drawing fun and fast rather than frustrating?

## What NOT to Design

- No login / account system — players are identified by name only
- No persistent profiles or history
- No online multiplayer — everyone is in the same physical room
- No chat or messaging — people talk out loud
- No tutorial — the games should be self-explanatory from the interface alone

---

## Host Lobby Screen — Redesign Brief

The current host lobby (after creating a room, before starting a game) feels like it wastes space. Everything is stacked vertically in a single column on mobile-width views, and the two-column layout only kicks in at `lg`. The result: the room code, QR code, game picker, player list, and start button are spread across a very tall scrollable page. On a TV or large screen, big chunks of the viewport sit empty while the content clusters in a narrow column.

**Problems to solve:**

- The room code + QR code section takes up a lot of vertical space before the host even gets to the game picker or player list. On a TV, you scroll past it — but it should always stay visible since new players need it.
- The game picker (5 games in a 2-column grid + external games) is the full focus until a game is selected, pushing the player list out of view. The host can't see who's joining while browsing games.
- Once a game is selected, the game info card + difficulty picker + player list + start button stack vertically — again pushing things below the fold.
- The overall layout doesn't feel like a "game show waiting screen" — it feels like a form page.

**What the lobby should feel like:**

- A glanceable dashboard: room code always visible, players appearing in real-time, game selection accessible but not dominating.
- On a big screen (TV): a spatial layout where room code/QR, game selection, and player list coexist without scrolling.
- On a smaller screen: a compact layout that still lets the host see players joining while picking a game.
- Ambient energy — the lobby should feel alive and anticipatory, like a game show countdown, not a static settings page.

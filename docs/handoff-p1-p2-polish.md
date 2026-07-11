# Hand-off: P1 + P2 — spil-robusthed, fairness og oprydning

**Til:** Fable 5 · **Fra:** launch-readiness review 5. juli 2026 · **Mål:** de fund der ikke er launch-blokkere, men enten spolerer enkelte runder (P1) eller er lette gevinster i polish/robusthed/hygiejne (P2).

Læs først **fælles kontekst** i `docs/handoff-p0-reconnect-persistence.md` (arkitektur, `conn.id === sessionId`-invarianten, state-/timer-model). Den gælder her også og gentages ikke. **Linjenumre er omtrentlige** — naviger via funktionsnavne, verificér mod nuværende kode, kør `pnpm typecheck` og `pnpm --filter @dystn/party-server validate-prompts` efter relevante ændringer. Tre P1'er (onAlarm-staleness, expectedCount tæller frakoblede, continueGame `remaining=0`) står allerede i P0-briefen under "rider med" — dublér dem ikke.

---

## P1 — spolerer enkelte runder eller degenererer et spil

### 1. Hunch — flere kanttilfælde
- **Clue-timeout → blind gættefase.** `getNextPhase("clue")` går ubetinget til `"guess"`, også ved `TIMER_EXPIRED` med 0 clue-submissions (fingerpegsgiver AFK). Alle tvinges til at gætte på `phaseData.clue === undefined` ("..."). *Fix:* i `getNextPhase("clue")`, hvis der ikke findes en clue-submission og event ≠ `ALL_SUBMITTED`, spring til næste runde/`scores` i stedet for `guess`. (`hunch.ts:199`)
- **Crash ved tomt players-array.** `setupRound`: `(roundNumber-1) % room.players.length` → `NaN`, og `room.players[NaN].id` kaster. Alle kan forlade rummet midt i spillet (`leaveRoom` har intet status-check). Uncaught i `onAlarm` fryser fasen midt i en mutation. *Fix:* guard `players.length === 0` → afslut spillet; wrap `advancePhase`-kaldet i `onAlarm` i try/catch med fallback til finish. (`hunch.ts:31`, `server.ts onAlarm`)
- **Sidste gæt klippes af hvis fingerpegsgiveren forlader.** `getExpectedSubmitterCount` returnerer `players.length - 1` og antager fingerpegsgiveren stadig er til stede. *Fix:* tæl faktiske gættere: `players.filter(p => p.id !== clueGiverId).length`. (`hunch.ts:82`)
- **Reveal-timer for kort ved fuldt rum.** `timerOverride: 30_000` uanset antal; `HostReveal`s `useStaggeredReveal` tager ~3500·(n+1)+4500 ms → 7 gættere ≈ 32,5 s (bonus ses aldrig). *Fix:* beregn fx `12_000 + (players.length - 1) * 4_000`. (`hunch.ts:205`)
- **Fejltekster nævner "Ord & Klap".** `buildVoteData`/`onVote` kaster "Ord & Klap har ingen afstemningsfase". *Fix:* ret til spillets navn. (`hunch.ts:72`)
- **Prompt-genbrug.** `usedPromptIds` nulstilles aldrig; efter udtømning sættes `available = indexed` (hele listen) → samme prompt kan komme to runder i træk. *Fix:* nulstil `usedPromptIds = []` ved udtømning, ekskludér som min. den seneste. (`hunch.ts:26`)

### 2. Surge — slutkriterie og vinder
- **Intet slutkriterie ud over sejr → uendeligt loop.** `totalRoundsForPlayerCount` returnerer 100, men hverken `getNextPhase` eller `advancePhase` tjekker `roundNumber` mod `totalRounds`. Når ingen når position 8 (alle forlader / holder op med at svare) cykler commit/reveal for evigt. *Fix:* i `getNextPhase("reveal")` afslut spillet ved `roundNumber >= cap` eller `players.length === 0`. (`surge.ts:12`)
- **Slutskærm kårer forkert vinder.** Sejr er "først til 8 på banen", men `scoreDeltas` giver fladt +100 pr. rigtigt svar, og `finished` rangerer efter score. Forkerte svar på position 0 koster intet på banen men påvirker ikke score → banevinderen er ikke nødvendigvis #1. *Fix:* giv banevinderen en afgørende bonus i `computeResults`, eller rangér `finished` efter `trackPositions`. (`surge.ts:152`, `HostView` FinishedScreen, `PlayerView` rank-skærm)
- **PlayerCommit hydrerer ikke fra server.** Lokal state starter `idle` og seedes aldrig fra `pd.currentChoices` (som `filterForPlayer` eksponerer). Ved reload/reconnect midt i commit viser UI'et intet valg, og et nyt tap nedgraderer et committet svar til "transit". *Fix:* seed state fra `pd.currentChoices[room.currentPlayerId]` ved mount; gør re-tap på allerede-committet side til no-op. (`surge/PlayerCommit.tsx:20`)
- **2s-grace er død kode.** `PlayerCommit` sender rigtige side-valg først efter `TRANSIT_DURATION` (1,5 s), men alarmen fyrer ved deadline og fasen er allerede `reveal` når beskeden ankommer → afvist. *Fix:* accepter forrige-fase-submissions i grace-vinduet, eller planlæg commit→reveal-alarmen ved `deadline + grace`. (`server.ts:318`, `PlayerCommit.tsx`)
- **`correctAnswer` lækkes i countdown.** `filterForPlayer` stripper kun `correctAnswer` når `phase === "commit"`; i de 4 s countdown får alle svaret. *Fix:* strip for alle faser undtagen `reveal`/`victory`. (`surge.ts:199`)
- **Prompt-genbrug** efter udtømning (samme som Hunch). (`surge.ts:48`)
- **Regeltekst mangler straffen.** `da.surge.howToPlay` nævner ikke at forkert svar = ét skridt tilbage (delta −1). *Fix:* tilføj sætningen. (`da.ts:162`)

### 3. Per-spil minimum antal spillere
`MIN_PLAYERS = 1` globalt (`server.ts:22`, `HostView.tsx`, `da.ts`). `handleStartGame` tjekker kun det globale minimum. Vote-spil (Blitz/Fusk) degenererer med 1-2 (stem på eneste/eget svar), Morph-kæder giver først mening ved 3+. *Fix:* tilføj `minPlayers` pr. spil i `GameHandlers.config`, håndhæv i `handleStartGame` og i `HostView`s `canStart`, og gør `da.*.expects`-strengene retvisende (de interpolerer alle `MIN_PLAYERS`). Reelle minima: ~3 for vote-spil, 3 for Morph.

### 4. Scrawl — tom tegning giver en fuld død subrunde
Når en spiller aldrig indsender en tegning (disconnect / tomt canvas ved timeout), avancerer draw-fasen alligevel, og `buildGuessData` falder tilbage til `drawingData: []`. Alle skal så gætte på et blankt billede i 45 s, stemme i 15 s, se reveal i 60 s. *Fix:* i `getNextPhase` (`draw→guess_0` og `reveal_K→guess_{K+1}`) spring `drawingIndexes` over hvor der ikke findes en draw-submission for `drawingOrder[idx]`. (`scrawl.ts:309`)

### 5. Timer-race: forsinket submit havner i næste fase
`submitAnswer` bærer ingen fase, og deadline-tjekket bruger den NUVÆRENDE fases deadline. En besked der ankommer lige efter et faseskift behandles som en submission til den nye fase — fx en fusk-fake-tekst gemmes som en "stemme", eller en Morph/Scrawl-tegning (`{strokes,...}`) `String(content)`'es til `"[object Object]"` som et gæt. *Fix:* send `currentPhase` (eller `phaseVersion`) med i `submitAnswer` og afvis mismatch mod `room.currentPhase`; suppler med content-shape-validering pr. fase i hver `onSubmission` (draw kræver strokes-array, write/guess kræver string). Dette lukker også Morph-auto-submit-race'et (`morph/PlayerDraw.tsx:58` `onExpired` racer alarmen). (`server.ts:308-320`, alle spils `onSubmission`)

### 6. `leaveRoom` midt i en fase re-checker ikke ALL_SUBMITTED
Forlader den sidste udestående spiller rummet, falder `expectedCount`, men all-submitted-checket kører kun i `handleSubmitAnswer` → de tilbageværende venter hele timeren ud. *Fix:* udtræk all-submitted-checket til en helper og kald den også fra `handleLeaveRoom` (og evt. `onClose`). Overvej at markere spillere som `left` frem for at fjerne dem under aktivt spil. (`server.ts:435`)

---

## P2 — polish, fairness og hygiejne (små, uafhængige)

**Sikkerhed / robusthed**
- **Størrelsesgrænse på tegne-payloads.** `scrawl.ts:56` / `morph.ts:45` gemmer rå `strokes` uden loft → multi-MB besked fylder DO-hukommelse og ganges op i broadcasts. Cap stroke-antal + serialiseret bytestørrelse; overvej et globalt inbound-max i `onMessage` før `JSON.parse`.
- **Spiller-handlinger på `sender.id`.** `handleSubmitAnswer/handleChangeAvatar/handleLeaveRoom` slår spiller op via `msg.sessionId`, ikke `sender.id`. Da `conn.id === sessionId` er skiftet trivielt og fjerner impersonation-risiko. (`server.ts:308+`)
- **`hostClaimed:false` ignoreres.** Tom case i `PartyProvider` (`:103`), og `HostView` tjekker aldrig om claim lykkedes → dødt værts-UI ved kodekollision/forkert secret. Gem resultatet i konteksten og vis "Du er ikke vært for dette rum".
- **`updateSettings` merger vilkårlige nøgler.** `Object.assign(state.settings, settings)` (`server.ts:356`) — whitelist tilladte nøgler (submitTime, voteTime, showIntro, scrawlDifficulty, …), afvis reserverede pause-nøgler.
- **Rumkode-kollision.** Koder genereres klient-side uden ledigheds-tjek (`useCreateRoom`/`LandingPage`, 24⁴ ≈ 331k). Lad serveren bekræfte claim (rummet tomt/nyt) før lobbyen vises, eller generér via et endpoint.

**Fairness**
- **Uniform shuffle.** Erstat `sort(() => Math.random() - 0.5)` med Fisher-Yates i `blitz.ts:42`, `fusk.ts:92`, `scrawl.ts:30`, `morph.ts:24`.
- **Fusk lækker `usedPromptIds`.** `filterForPlayer` spreder `...pd` i submit/vote og stripper kun `realAnswer`/`answers`; `usedPromptIds` (inkl. aktuel prompt-indeks) sendes med → svaret kan slås op. Strip det i submit/vote-grenene. (`fusk.ts:231`)
- **2-spiller identiske svar låser afstemning.** Merget svar er `isOwn` for begge → ingen kan stemme, runden ender med 0 stemmer. Spring vote/present over via `getNextPhase` hvis < 2 stembare svar. (`blitz.ts:205`)

**Spil-UI**
- **Morph HostDraw/HostGuess viser "Runde 1 af 1".** Læser `phaseData.currentStep`/`stepCount`, men `filterForPlayer` sender `stepIndex`/`totalSteps`. Vælg ét navnesæt. (`morph/HostDraw.tsx:12`, `HostGuess.tsx:12`)
- **Hunch spektrum-markører forskudt.** Rå `transform: translateX(-50%)` i `style` clobbes af Framer Motions egne transforms. Brug motion values `x: '-50%'`/`y: '-50%'`. (`hunch/SpectrumBar.tsx:65,96`)
- **GameIntro spiser svartid.** 6 s overlay vises EFTER at serveren har sat `phaseDeadline`; dækker desuden Surges 4 s countdown. Lad serveren lægge `INTRO_DURATION` til første fases deadline når `showIntro` er sat, eller cap intro under fasens længde. (`GameIntro.tsx`, `server.ts handleStartGame`)
- **Fusk reveal viser sandheden med småt.** `computeResults`/`buildVoteData` sender `normalizeAnswer(realAnswer)` (lowercased) også til reveal → egennavne ser forkerte ud. Gem den originale tekst til reveal, brug kun den normaliserede i vote-options. (`fusk.ts:192,87`)
- **Fusk merged medforfattere usynlige** i reveal, og vist beløb matcher ikke uddelte point. Inkludér `authorNames` i results. (`fusk.ts:174`)
- **Fusk prompt med >1 `___` taber tekst.** `HostSubmit` renderer kun `parts[0]+blank+parts[1]`. Render alle dele, eller valider i loaderen at fusk-prompts har præcis ét `___`. (`fusk/HostSubmit.tsx:32`)
- **Blitz coAuthors beregnes men vises ikke** (`HostReveal.tsx:106`) — render medforfatter-avatarer + inkludér i vinder-annoncering.
- **Optimistisk voted-state.** `fusk/PlayerVote.tsx:29` sætter `voted=true` uden server-bekræftelse → tabt stemme ses ikke. Baser venteskærmen på `phaseData.myVote`.
- **Uafgjort giver forskellige placeringer.** `PlayerView` finished bruger `findIndex+1`; værtens `FinishedScreen` bruger winners-array → TV og telefon modsiger hinanden. Brug competition ranking (1 + antal med strengt højere score).
- **Ukendt fase falder til lobby.** Mangler `PhaseComponent` (skævt deploy) → spiller ser "Du er med!" midt i spil, ingen logging. Tilføj fallback-skærm + `captureException`. (`PlayerView`, `HostView`)
- **DrawingCanvas forvrænger ved resize.** `viewBoxHeight` opdateres løbende men gamle strokes er i gammel skala → rotation forvrænger. Lås `viewBoxHeight` ved første stroke eller reskalér. (`scrawl/DrawingCanvas.tsx:73`)
- **Avatar-farve-dubletter** efter leave/kick + nyt join (`getAvatarColor(players.length)`, `server.ts:246`) — vælg første ubrugte farve.
- **Reconnect broadcaster ikke til andre.** `onConnect` sender kun til den nye forbindelse; andre ser spilleren som disconnected til næste event. Kald `broadcastState()` i `onConnect` ved kendt genforbindelse. (`server.ts:56`)

**Deploy / repo-hygiejne**
- **Engelske server-fejlstrenge** i et dansk produkt ("Only the host can start", "Game already started", "Player not found", …). Oversæt eller send fejlkoder + oversæt i `da.ts`. (`server.ts:279+`)
- **Offentlige sourcemaps.** `build.sourcemap: true` uden `filesToDeleteAfterUpload` → `*.map` serveres offentligt. Sæt `sourcemaps: { filesToDeleteAfterUpload: "**/*.map" }` i sentryVitePlugin. (`vite.config.ts:19`)
- **Sentry eager + ingen release.** `main.tsx` lazy-loader Sentry, men `ErrorBoundary` importerer den statisk → i bundlet alligevel, og tidlige fejl tabes. Init synkront + sæt eksplicit `release`. (`main.tsx:10`)
- **`heartbeat` er død kode** (type i klient + server, ingen handler, ingen afsender). Fjern eller implementér lastSeen. (`PartyProvider.tsx:27`)
- **e2e-specs tester slettede spilnavne** (`e2e/duel|bluff|sandhed|tegn.spec.ts` klikker "Duel"/"Bluff"/…). Omskriv til Blitz/Fusk/Scrawl/Morph/Surge/Hunch og kør i CI.
- **`validate.ts` springer hunch over** — tilføj en `=== HUNCH ===`-sektion med dublet-tjek på `${leftLabel}|${rightLabel}` og advarsel ved < 15 kort.
- **README + docs + løse filer.** `apps/web/README.md` er Vite-boilerplate; `docs/` har forældede analyser (Convex, gamle spilnavne); ~30 løse `*.png` + `test-results/` i repo-roden. Skriv en root-README (arkitektur, env-vars: `VITE_PARTY_HOST`, `VITE_SENTRY_DSN`, `SENTRY_*`; dev/deploy-flow), markér gamle docs som historiske, gitignore screenshots.
- **Tvivlsom surge-prompt.** "Danmark har verdens højeste skattetryk" (answer: false) er omdiskuteret og egner sig dårligt som entydigt sand/falsk — genovervej.

---

## Foreslået rækkefølge
1. **P1 pr. spil** (Hunch → Surge → Scrawl) — hvert spil kan tages isoleret og testes for sig.
2. **P1 tværgående** (minPlayers, timer-race/fase-i-submitAnswer, leaveRoom-ALL_SUBMITTED) — rører delt server-kode, tag samlet.
3. **P2 i temaklynger** — sikkerhed/robusthed først, så fairness, så UI, så repo-hygiejne til sidst.

De fleste P2'er er 1-3 linjers ændringer; batch dem pr. fil for at holde `typecheck`-cyklussen kort.

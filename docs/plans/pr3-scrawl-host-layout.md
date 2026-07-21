# PR 3 — Scrawl: timeren beskæres på værtsskærmen

**Branch:** `fix/scrawl-host-layout` · **Base:** `main` · **Område:** `apps/web`
· **Prioritet: P1**

Læs [`README.md`](./README.md) i denne mappe først (konventioner, kvalitetsporte).

---

## Fejlen (fra playtest 14.07.2026)

> "Når spilleren skal gætte på, hvad der bliver tegnet, skubber designet tiden ud."
> "Det samme sker under præsentationen."

På værtsskærmen bliver nedtællingen (det store tal, fx "36") skubbet ud i højre kant og
klippet over. Det sker i gætte-fasen og i reveal-fasen.

## Filerne

Scrawls værts-faser (registreret i `apps/web/src/games/registry.ts:75-82`):

| Fase | Fil | Timer |
|---|---|---|
| `draw` | `apps/web/src/games/scrawl/HostDraw.tsx` | `:31-36` — **virker fint** |
| `guess_N` | `apps/web/src/games/scrawl/HostGuess.tsx` | `:36-46` — klippes |
| `vote_N` | `apps/web/src/games/scrawl/HostVote.tsx` | `:40-45` — samme mønster |
| `reveal_N` | `apps/web/src/games/scrawl/HostReveal.tsx` | `:199` — lille timer, klippes |
| `scores` | `apps/web/src/games/blitz/HostScores.tsx` (delt) | — |

`CountdownTimer` (`packages/ui/src/CountdownTimer.tsx:14-51`) er ren logik — den
returnerer et bart `<span>` og har **ingen** styling. Al placering bestemmes af kaldstedet.
Fejlen ligger derfor i de tre scrawl-faser, ikke i timeren.

## Årsag — tre fejl, der forstærker hinanden

### 1. Flex-bjælken lader timeren krympe væk

`HostGuess.tsx:25` er en `flex ... justify-between` med tre børn — og **ingen** af dem har
`shrink-0`, `min-w-0` eller `flex-1`:

1. `:26-28` "Tegning N af M"
2. `:29-35` `<h2 class="font-display text-3xl">` = "Hvad bliver der tegnet?"
3. `:36-46` højre gruppe: `text-5xl sm:text-8xl`-timeren + `submitted/total`

Overskriften kan ikke krympe under sin min-content-bredde, så det **sidste** flex-item —
timeren — presses forbi højre kant. Roden er `overflow-hidden` (`:23`), så den bliver
klippet i stedet for at wrappe. `.glow-text` (`apps/web/src/index.css:177-179`) lægger
yderligere 3 px `text-shadow` uden for glyffens boks.

`HostVote.tsx:26/28/38` og `HostReveal.tsx:49-59` har samme mønster: venstre kolonne har
`min-w-0`, men **højre kolonne mangler det** — og i reveal får `overflow-y-auto` (`:59`)
browseren til at beregne `overflow-x` til `auto`, så indhold, der er bredere end
kolonnen, klippes.

### 2. Tegnefladen kræver mere bredde, end tegningen har brug for

`DrawingDisplay.tsx:30-43` har hårdkodet `aspect-[4/3]` (landskab), mens tegningens
faktiske `viewBox` er `0 0 400 {viewBoxHeight}` (`:35`) — og `viewBoxHeight` måles på
spillerens **telefon**, altså typisk portræt (fx 400×550, `DrawingCanvas.tsx:77`).

Alle tre kaldsteder sender `max-h-full max-w-full w-auto h-full`
(`HostGuess.tsx:56`, `HostVote.tsx:33`, `HostReveal.tsx:55`). Definit højde + `w-auto` +
`aspect-[4/3]` giver **bredde = 1,333 × højde**: boksen tager al ledig lodret plads og
konverterer den til bredde, selv om tegningen er portræt og kun bruger midten
(`preserveAspectRatio="xMidYMid meet"`, `:36`, letterboxer resten). Der spildes altså
vandret plads på tom luft — den plads, timeren mangler.

### 3. `fixed inset-0` inde i en transformeret forælder

`HostGuess.tsx:23`, `HostVote.tsx:26` og `HostReveal.tsx:49` bruger alle `fixed inset-0`.
Men de monteres inde i en Framer Motion-`motion.div` med `transform`
(`apps/web/src/pages/HostView.tsx:499-506`). **En transformeret forælder bliver containing
block for `position: fixed`** — så `inset-0` opløses mod motion-div'ens boks, ikke mod
viewporten, og klippes desuden af `overflow-hidden` på wrapperen (`HostView.tsx:475`).
Oveni får faserne dobbelt padding: wrapperens `p-4 sm:p-8 pt-14 sm:pt-16` **plus** deres
egen `p-4 sm:p-6 pt-14`.

`HostDraw.tsx:18` er den eneste scrawl-fase, der **ikke** bruger `fixed` — og den eneste
uden layout-problemer. Det er det stærkeste fingerpeg om, hvad der er rigtigt.

## Løsning

Ret alle tre årsager. Retter man kun flex-bjælken, bliver timeren stadig klemt af en
tegning, der kræver 33 % mere bredde, end den bruger.

### Ændring 1 — drop `fixed inset-0` (HostGuess, HostVote, HostReveal)

Lad faserne være almindelige flex-børn i `HostView`s wrapper, ligesom `HostDraw`.
Fjern `fixed inset-0` og fasens egen `pt-14`/`p-4 sm:p-6` (wrapperen har dem allerede).
Brug i stedet `flex h-full w-full flex-col min-h-0 min-w-0`.

Verificér, at faserne stadig fylder skærmen — wrapperen er `h-screen` med `flex-1 min-h-0`
på motion-div'en (`HostView.tsx:475, :499`), så det burde de.

### Ændring 2 — lad aldrig timeren krympe

I bjælken i `HostGuess.tsx:25-46`:

- venstre label og højre timer-gruppe: `shrink-0`
- midterste overskrift: `min-w-0 flex-1 text-center` (den må gerne wrappe eller
  trunkeres — timeren må aldrig)

I `HostVote.tsx` og `HostReveal.tsx`: giv **højre kolonne** `min-w-0`, præcis som venstre
kolonne allerede har (`HostReveal.tsx:50`). Overvej at fjerne `overflow-y-auto` (`:59`)
eller parre det med `overflow-x-visible`, så vandret klipning ikke opstår som bivirkning.

### Ændring 3 — lad tegningen bruge den plads, den faktisk har

`DrawingDisplay.tsx:30-43`: fjern det hårdkodede `aspect-[4/3]`, og lad wrapperen få sin
størrelse fra layoutet i stedet. SVG'ens `preserveAspectRatio="xMidYMid meet"` (`:36`)
centrerer og skalerer allerede tegningen korrekt inden for enhver boks — aspect-ratioen
er overflødig og aktivt skadelig.

Kaldstederne ændres tilsvarende: giv tegne-containeren `flex-1 min-h-0 min-w-0` og
`DrawingDisplay` `h-full w-full`.

**Vigtigt:** grep efter alle brugere af `DrawingDisplay` før du ændrer den — den bruges
muligvis også på spillersiden. Bryder ændringen et andet kaldsted, så gør aspect-ratioen
til en valgfri prop i stedet (`aspect?: string`) frem for at fjerne den globalt.

## Verifikation i den kørende app

Der findes en tegne-testside på `/drawtest` (`apps/web/src/pages/DrawTest.tsx`) — brug
den, hvis den sparer tid. Ellers `pnpm dev` med en vært (`/host/<KODE>`) og to spillere.

Spil Scrawl igennem og hold øje med **hver** fase. Tjek specifikt:

1. **Gætte-fasen:** timeren skal stå fuldt synlig i højre side. Prøv med en **portræt**-tegning
   (tegn på en smal/høj flade — det er det, en telefon giver) — det er dét tilfælde, der
   udløste fejlen.
2. **Reveal-fasen:** tegning til venstre, "ORDET VAR"-kortet og "Næste tegning"-knappen
   til højre. Intet må klippes i højre kant.
3. **Afstemnings-fasen:** samme.
4. **Tegne-fasen:** må ikke gå i stykker (den virkede før — pas på, du ikke bryder den).
5. Prøv mindst to skærmformater: et bredt 16:9-vindue og et smallere vindue. Ingen af dem
   må klippe timeren eller give vandret scroll.
6. Prøv både en portræt- og en landskabstegning.

Tag et screenshot af gætte- og reveal-fasen til PR-beskrivelsen.

## Acceptkriterier

- [ ] Timeren er fuldt synlig i gætte-, afstemnings- og reveal-fasen — i alle skærmformater.
- [ ] Ingen vandret scroll og ingen klippet tekst på værtsskærmen.
- [ ] Tegningen fylder så meget, som pladsen tillader, uden at fortrænge timeren.
- [ ] Tegne-fasen og scores-fasen er uændrede.
- [ ] Andre spil, der bruger `DrawingDisplay`, er uændrede.
- [ ] `pnpm typecheck` og `pnpm lint` er grønne.

## Uden for scope

Rør ikke Scrawls spillogik (det er [PR 2](./pr2-scrawl-guess-matching.md)), tegneværktøjet
på spillersiden, eller ønsket om en malerbøtte — det er udskudt til en beslutning.

# PR 6 — Tekstkorrektur og sproglig gennemgang

**Branch:** `chore/copy-pass` · **Base:** `main` · **Område:** tekst
· **Prioritet: P2** · **Tag denne til sidst**

Læs [`README.md`](./README.md) i denne mappe først (konventioner, kvalitetsporte).

---

## Opgaven

Fra playtesten: *"Gennemgå teksterne."* Afklaret med Morten: **almindelig korrektur og
sproglig optimering** — ikke en omlægning af tonen. Teksterne skal være korrekte, klare
og ensartede. De skal ikke lyde som en anden app bagefter.

**Tag denne PR som den sidste af de seks**, så korrekturen også dækker de strenge, PR 4
og PR 5 tilføjer.

## Hvor teksterne bor

Næsten alt ligger ét sted: **`apps/web/src/lib/da.ts`** (~360 linjer), pænt struktureret:

| Linjer | Sektion |
|---|---|
| `:9-12` | App |
| `:13-19` | Landing |
| `:20-27` | Join |
| `:29-39` | Avatar-editor |
| `:40-47` | Lobby |
| `:48-65` | Fælles spil-tekster |
| `:66-76` | Værts-replikker |
| `:77-98` | Forbindelse / vært mistet |
| `:99-239` | De seks spil (blitz, fusk, scrawl, morph, surge, hunch) |
| `:240-247` | Eksterne spil |
| `:248-319` | Licens / Dystn-pakken |
| `:320-359` | Om-side og launch-gate |

Derudover findes brugervendt dansk i:

- **Serverens fejlbeskeder** — kastet fra spil-handlerne, fx `"Prøv et andet gæt"`
  (`apps/party-server/src/games/scrawl.ts:101`), `"Spillet er allerede i gang"`
  (`apps/party-server/src/server.ts:438`). De vises for spilleren og hører med i
  korrekturen.
- **`apps/web/index.html`** — `<title>` og `<meta name="description">` / OG-tags.
- **`apps/web/public/manifest.json`** — PWA-navn og beskrivelse.

## Sådan gør du

Gå `da.ts` igennem sektion for sektion. Ret:

1. **Stavning og tegnsætning.** Dansk kommatering, korrekt brug af bindestreg vs. tankestreg
   (– ikke -), rigtige anførselstegn, ingen dobbelte mellemrum. Æ, ø og å skal være
   korrekte overalt.
2. **Ensartet tiltale.** Vælg **én** linje og hold den hele vejen igennem: taler vi til
   spilleren som "du", og omtaler vi værten i tredje person? Er knapper imperativer
   ("Deltag", "Start spillet") eller substantiver? I dag er der formentlig blandet
   praksis — find mønstret, læg dig fast, og ret afvigelserne.
3. **Ensartet terminologi.** Samme begreb skal hedde det samme hver gang: rum eller
   lobby? vært eller host? runde eller omgang? spiller eller deltager? Lav en kort liste
   over de valgte termer i PR-beskrivelsen.
4. **Klarhed frem for finurlighed.** Instruktioner, spillerne skal handle på (fx "skriv
   en løgn, der lyder sand"), skal kunne forstås på ét gennemsyn, i et larmende lokale,
   fra den anden side af stuen. Er en tekst tvetydig, så omskriv den.
5. **Kortere, hvor det ikke koster noget.** Værtsskærmen læses på afstand. Overskrifter
   og knaptekster må gerne barberes — men skær aldrig indhold væk, der er nødvendigt for
   at forstå spillet.
6. **Spil-instruktionerne (`:99-239`) er de vigtigste.** Det er dem, der afgør, om folk
   forstår spillet. Læs hver enkelt og spørg: ville en, der aldrig har spillet det her,
   vide, hvad de skal gøre?

## Regler

- **Ændr ikke nøglerne** i `da.ts` — kun værdierne. Omdøber du en nøgle, skal hvert
  kaldsted rettes, og det gør en tekst-PR til en risiko-PR. Skal en nøgle absolut omdøbes,
  så gør det i en separat commit, og kør `pnpm typecheck` bagefter.
- **Rør ikke prisen.** `da.ts:248` siger det eksplicit: prisen står **kun** her og skal
  matche Stripe-produktet. Lad tallet være.
- **Rør ikke "Dystn-pakken"** som produktnavn (licensen). Det er et fastlagt navn.
- **Rør ikke ordlisterne** i `apps/party-server/src/games/prompts/` — det er spilindhold,
  ikke UI-tekst, og en ændring dér ændrer spillet.
- **Hardkod ikke nye strenge** i komponenter. Finder du dansk tekst hardkodet i en
  `.tsx`-fil, så flyt den til `da.ts`. (En stikprøve tyder på, at spil-komponenterne er
  rene — men kig efter i `apps/web/src/pages/` og `apps/web/src/components/`.)
- **Ingen kodeændringer ud over strenge og eventuelle flytninger til `da.ts`.** Ser du en
  bug undervejs: noter den i PR-beskrivelsen, ret den ikke.

## Verifikation

`pnpm typecheck` fanger, hvis en nøgle er forsvundet. Men det fanger ikke, om teksten
giver mening i sin sammenhæng — så:

`pnpm dev` og **gå hele appen igennem med øjnene**: landingsside, join, lobby, avatar-vælger,
hvert af de seks spil (mindst én runde hver, både værts- og spillerskærm), scoreboard,
slutskærm, om-siden og licens-modalen. En streng, der ser fin ud i `da.ts`, kan sagtens
være for lang til den knap, den lander i.

Hold især øje med **afkortet tekst** og tekst, der wrapper grimt, efter du har gjort den
længere.

## Acceptkriterier

- [ ] Alle strenge i `da.ts` er korrekturlæst: stavning, tegnsætning, diakritiske tegn.
- [ ] Tiltale og terminologi er ensartede — og de valgte termer er listet i PR-beskrivelsen.
- [ ] Spil-instruktionerne kan forstås på ét gennemsyn.
- [ ] Serverens brugervendte fejlbeskeder er også gennemgået.
- [ ] `index.html` og `manifest.json` er gennemgået.
- [ ] Ingen nøgler er ændret (eller: nøgleændringer ligger i en separat commit, og
      `pnpm typecheck` er grøn).
- [ ] Prisen og "Dystn-pakken" er urørte.
- [ ] Hele appen er gennemset i browseren — ingen tekst er blevet for lang til sin plads.

# PR 2 — Scrawl: "hund" bliver ikke genkendt som "en hund"

**Branch:** `fix/scrawl-guess-matching` · **Base:** `main` · **Område:** `apps/party-server`
· **Prioritet: P0**

Læs [`README.md`](./README.md) i denne mappe først (konventioner, kvalitetsporte).

---

## Baggrund: sådan virker Scrawl

Scrawl er Drawful/Fibbage-agtigt. Læs det her grundigt — fejlen kan ikke forstås uden det,
og fase-navnet "guess" er direkte misvisende.

1. **`draw`:** hver spiller får et hemmeligt ord (fx *"en cykel"*) og tegner det.
2. **`guess_N`:** alle *andre* end tegneren skriver et **falsk billedtekst-forslag** — en
   løgn, der skal lyde plausibel. Fasen hedder "guess", men man gætter ikke; man
   fabrikerer en lokkedue.
3. **`vote_N`:** alle løgnene vises sammen med **det ægte ord**, blandet. Nu gætter man —
   ved at *stemme*.
4. **`reveal_N`:** point uddeles.

Scoringen (`apps/party-server/src/games/scrawl.ts:224-267`):

- **+1000** til hver, der **stemmer på det ægte ord** (`TRUTH_ID`, `:226-230`)
- **+1000** til tegneren, hvis *ingen* fandt det ægte ord (`:232-235`)
- **+500 pr. narret spiller** til den, der skrev en løgn, andre stemte på (`:262-267`)

Der er altså **ingen point for at *skrive* det rigtige ord** — spillet forsøger tværtimod
at forhindre det. `onSubmission` afviser en løgn, der er identisk med facit
(`scrawl.ts:96-103`):

```ts
      // Check if matches real word (case-insensitive)
      const artistId = phaseData?.currentArtistId;
      const drawingWords = phaseData?.drawingWords;
      if (artistId && drawingWords?.[artistId]) {
        if (text.toLowerCase() === drawingWords[artistId].toLowerCase()) {
          throw new Error("Prøv et andet gæt");
        }
      }
```

Spilleren får besked om at skrive noget andet. Det er den tilsigtede adfærd.

## Fejlen (fra playtest 14.07.2026)

> "I spillet Scrawl var ordet 'en hund', og der blev gættet på 'hund'. Gættet fik ikke
> point, hvilket bliver et problem."

## Årsag

Afvisningen ovenfor er en **ren streng-sammenligning**. `"hund" !== "en hund"`, så
spillerens indtastning slap igennem som en "løgn" — selv om den i praksis *var* facit.

Konsekvenserne kaskaderer:

1. Afstemningen viste **både "en hund" og "hund"** som to konkurrerende muligheder for
   det samme svar. `buildVoteData` fletter kun dubletter på `String(s.content).toLowerCase()`
   (`scrawl.ts:139-156`), så de blev ikke slået sammen.
2. Kun `TRUTH_ID` giver de 1000 point (`:227`). Alle, der stemte på "hund" — altså på det
   rigtige svar — fik **nul**.
3. Spilleren, der skrev "hund", fik +500 pr. "narret" spiller, altså point for at have
   skrevet sandheden.

Spillet straffer med andre ord dem, der har ret, og belønner den, der ved et uheld
afslørede facit. Det er den fejl, playtesten fangede.

## Løsning

Sammenlign på en **normaliseret** form, og brug den samme normalisering begge de steder,
hvor tekst matches. Så bliver "hund" afvist ved indsendelse ("Prøv et andet gæt"),
spilleren skriver en rigtig løgn, og problemet opstår aldrig.

### Ændring 1 — ny fil `apps/party-server/src/text.ts`

```ts
/** Ubestemte og bestemte artikler, der må stå foran et ord uden at ændre det. */
const LEADING_ARTICLES = new Set(["en", "et", "den", "det", "de"]);

/**
 * Normalisér en fritekst til sammenligning: små bogstaver, tegnsætning væk,
 * whitespace normaliseret, og en indledende artikel fjernet.
 *
 * "En Hund!"  → "hund"
 * "  hund  "  → "hund"
 * "en"        → "en"   (artiklen fjernes kun, hvis der står noget efter den)
 */
export function normalizeText(input: string): string {
  const words = input
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length > 1 && LEADING_ARTICLES.has(words[0])) words.shift();
  return words.join(" ");
}

/** Levenshtein-afstand, afkortet: returnerer > max så snart grænsen er overskredet. */
export function levenshtein(a: string, b: string): number { /* standard DP */ }

/**
 * Er gættet reelt det samme som facit? Bruges KUN til at afvise en "løgn", der i
 * virkeligheden er sandheden. Her er det trygt at være large: rammer vi ved siden af,
 * bliver spilleren blot bedt om at skrive noget andet.
 */
export function isEffectivelySameWord(guess: string, truth: string): boolean {
  const g = normalizeText(guess);
  const t = normalizeText(truth);
  if (!g || !t) return false;
  if (g === t) return true;
  // Én tastefejl tæller som samme ord — men kun på ord lange nok til, at to
  // forskellige ord ikke ligger 1 tegn fra hinanden ("kat"/"kap", "ko"/"ко").
  return t.length >= 6 && g.length >= 6 && levenshtein(g, t) <= 1;
}
```

**Bevidst asymmetri:** Levenshtein bruges **kun** til afvisningen af facit-lignende
løgne, ikke til at flette to spilleres løgne sammen. At afvise for bredt koster kun, at
spilleren skriver noget andet. At *flette* for bredt ville give den ene spiller point for
den andens løgn — en langt værre fejl. Fletning bruger derfor kun eksakt lighed efter
`normalizeText`.

### Ændring 2 — `apps/party-server/src/games/scrawl.ts`, afvisning ved indsendelse

Erstat `:96-103` med `isEffectivelySameWord(text, drawingWords[artistId])`. Behold
fejlbeskeden `"Prøv et andet gæt"` — den er allerede den rigtige, og klienten viser den.

### Ændring 3 — `apps/party-server/src/games/scrawl.ts`, fletning af dubletter

I `buildVoteData` (`:139-156`) skal flette-nøglen være `normalizeText(String(s.content))`
i stedet for `String(s.content).toLowerCase()`. Så bliver "En hund" og "hund " til én
mulighed, og begge forfattere får credit via `mergedPlayerIds` (mekanikken findes
allerede, `:142-146`).

Den **viste** tekst skal fortsat være spillerens egen råtekst (`:150`, `text: String(s.content)`)
— normaliseringen er kun en nøgle, aldrig noget spillerne ser.

### Ændring 4 — sikkerhedsnet i `buildVoteData`

Skulle en løgn *alligevel* være normaliseret-identisk med facit (fx en indsendelse fra
før dette fix, eller en håndlavet WebSocket-besked), må den ikke optræde som en
selvstændig mulighed ved siden af sandheden. Filtrér den fra, før `options` bygges:
sådanne indsendelser smides væk, og kun `TRUTH_ID` bærer det rigtige svar. Det gør
fejlen umulig at reproducere, selv hvis en klient sniger sig uden om ændring 2.

## Tests — `apps/party-server/test/text.test.ts` og `scrawl-guess.test.ts` (nye filer)

`text.test.ts` — ren enheds-test af normaliseringen:

- `"en hund"` → `"hund"`; `"Et Hus"` → `"hus"`; `"den store hund"` → `"store hund"`
- `"hund!"`, `"  hund  "`, `"HUND"` → alle `"hund"`
- `"en"` forbliver `"en"` (ingen efterfølgende ord)
- `"endestation"` forbliver `"endestation"` (kun hele ord fjernes, ikke præfikser)
- Æ/Ø/Å overlever: `"en ål"` → `"ål"`
- `isEffectivelySameWord("hund", "en hund")` → `true`
- `isEffectivelySameWord("cykl", "en cykel")` → `true` (tastefejl, ≥ 6 tegn)
- `isEffectivelySameWord("kat", "kap")` → `false` (for korte til tastefejls-nåde)
- `isEffectivelySameWord("hus", "en hund")` → `false`

`scrawl-guess.test.ts` — mod selve handleren (byg en `RoomState` som beskrevet i
[PR 1's plan](./pr1-surge-auto-advance.md); importér `../src/games/scrawl` så
`registerGameHandlers` kører):

- `onSubmission` med `"hund"`, når facit er `"en hund"` → kaster `"Prøv et andet gæt"`
- `onSubmission` med `"en kat"`, når facit er `"en hund"` → accepteres
- `buildVoteData` med løgnene `"En hund"` og `"hund"` (to spillere) → **én** mulighed,
  og begge spillere står i `mergedPlayerIds`
- `buildVoteData` med en løgn, der er normaliseret-identisk med facit → den optræder
  **ikke** som selvstændig mulighed (sikkerhedsnettet)
- `computeResults`: stemmer på `TRUTH_ID` giver +1000, som før — scoringen er urørt

## Verifikation i den kørende app

`pnpm dev`, tre faner (én vært, to spillere). Vælg Scrawl.

1. Lad tegneren få et ord med artikel (fx *"en cykel"*). Ordlisten ligger i
   `apps/party-server/src/games/prompts/scrawl/v1.json` — vælg et ord derfra til at
   teste med, eller kør nogle runder.
2. En spiller skriver **ordet uden artikel** ("cykel"). **Forventet:** afvist med
   "Prøv et andet gæt" — spilleren skal skrive noget andet.
3. Lad to spillere skrive den samme løgn med forskellig artikel/kasus ("En bil" / "bil").
   **Forventet:** afstemningen viser **én** mulighed, og begge får point, hvis nogen
   hopper på den.
4. Afstemningen må aldrig vise to muligheder, der er det samme ord.

## Acceptkriterier

- [ ] Et "gæt", der reelt er facit, afvises — uanset artikel, store bogstaver,
      tegnsætning eller en enkelt tastefejl.
- [ ] Afstemningen viser aldrig facit to gange (som sandhed *og* som løgn).
- [ ] Ens løgne flettes til én mulighed, og alle forfattere får point.
- [ ] Spillerne ser altid deres egen råtekst — aldrig den normaliserede form.
- [ ] Scoringsreglerne er uændrede.
- [ ] Nye tests er grønne; `pnpm typecheck` og `pnpm lint` er grønne.

## Uden for scope

**Rør ikke selve spilmekanikken.** Det kan være fristende at give point for at *skrive*
det rigtige ord — men Scrawl er bygget på, at man skriver en løgn og stemmer sig frem til
sandheden. En ændring dér er et spildesign-spørgsmål til Morten, ikke en bugfix.
Er du i tvivl: normalisér, afvis, og lad scoringen være.

Rør heller ikke ordlisten (`prompts/scrawl/v1.json`) — at fjerne artiklerne fra ordene
ville skjule fejlen frem for at rette den, og *"en cykel"* er en bedre tegneopgave end
*"cykel"*.

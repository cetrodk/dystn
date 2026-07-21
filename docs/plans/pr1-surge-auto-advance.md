# PR 1 — Surge: runden slutter, før tiden er gået

**Branch:** `fix/surge-auto-advance` · **Base:** `main` · **Område:** `apps/party-server`
· **Prioritet: P0**

Læs [`README.md`](./README.md) i denne mappe først (konventioner, kvalitetsporte).

---

## Baggrund: sådan virker Surge

Surge er et hurtigt sandt/falsk-væddeløb. Hver runde vises et udsagn, og hver spiller
flytter sin brik mod "sandt" eller "falsk". Brikken er **undervejs** et øjeblik, før den
lander — og netop dét er kernen i fejlen.

Klienten sender **to** indsendelser pr. runde:

1. `{ choice: "transit" }` i det øjeblik spilleren begynder at flytte sin brik
2. `{ choice: "true" }` eller `{ choice: "false" }` når brikken lander

`upsertSubmission` overskriver den første med den anden
(`apps/party-server/src/submissions.ts:38-59` — samme spiller + runde + fase = samme række).

Ved runde-slut tæller `computeResults` en spiller, hvis indsendelse stadig står på
`"transit"`, som **ingen svar** (`apps/party-server/src/games/surge.ts:147`:
`const isNoAnswer = !choice || choice === "transit"`).

## Fejlen (fra playtest 14.07.2026)

> "Hvis alle spillere trykker inden for den tid, det tager at bevæge svaret, så afsluttes
> spørgsmålet, inden tiden løber ud, og alle når ikke at svare."
> "Den sidste spiller, der svarer, får at vide, at han ikke nåede at vælge."
> "Tiden skal løbe ud hver runde, uanset om alle svarene er modtaget."

## Årsag — bekræftet i koden

Surge *forsøger* allerede at slå auto-fremdrift fra ved at returnere `Infinity` fra
`getExpectedSubmitterCount` (`apps/party-server/src/games/surge.ts:214-217`):

```ts
  // Prevent auto-advance: the timer always runs
  getExpectedSubmitterCount(): number {
    return Infinity;
  },
```

Men serveren klamper værdien mod antallet af tilstedeværende spillere
(`apps/party-server/src/server.ts:597-604`):

```ts
    const expectedCount = handlers.getExpectedSubmitterCount
      ? Math.min(handlers.getExpectedSubmitterCount(this.state), presentCount)
      : presentCount;

    if (expectedCount > 0 && phaseSubmissions.length >= expectedCount) {
      this.safeAdvance("ALL_SUBMITTED");
      this.scheduleNextAlarm();
    }
```

`Math.min(Infinity, presentCount)` er `presentCount`. Surges forsøg på at deaktivere
auto-fremdrift har **aldrig virket en eneste gang** — det fejlede tavst.

Kæden er dermed:

1. Alle spillere trykker hurtigt → alle har en `"transit"`-indsendelse.
2. `checkAllSubmitted` ser `phaseSubmissions.length >= presentCount` → `safeAdvance("ALL_SUBMITTED")`.
3. Fasen skifter til `reveal`, **mens brikkerne stadig er undervejs**.
4. De spillere, hvis brik ikke nåede at lande, står med `"transit"` → `noAnswer: true`
   → "du nåede ikke at vælge".

**Det forklarer begge de rapporterede fejl.** Rettes auto-fremdriften, forsvinder
"du nåede ikke at vælge"-beskeden af sig selv.

## Løsning

Giv spil-handlere en måde at sige "afslut aldrig fasen før tid" på, som serveren
faktisk respekterer — et **eksplicit flag**, ikke en sentinel-værdi. `Infinity` er
allerede prøvet, og det fejlede stille; et flag kan ikke misforstås af en `Math.min`.

Samtidig flyttes selve beslutningen ud i en **ren, testbar funktion**. I dag ligger den
inde i en privat metode på PartyKit-serverklassen (`checkAllSubmitted`), som ikke kan
unit-testes uden at instantiere en Durable Object. Der findes derfor ingen tests af
spil-logikken overhovedet — det er præcis derfor, denne fejl kunne leve upåagtet.

### Ændring 1 — `apps/party-server/src/types.ts`

Tilføj feltet til `GameConfig` (interfacet starter ~linje 70, feltet `pack` ligger sidst):

```ts
export interface GameConfig {
  initialPhase?: string;
  totalRoundsForPlayerCount?: (playerCount: number) => number;
  minPlayers?: number;
  pack?: "free" | "pack1";
  /** Afslut ALDRIG fasen tidligt, selv om alle har indsendt — timeren er selve
   *  spillet (Surge). Bemærk: at returnere Infinity fra getExpectedSubmitterCount
   *  virker IKKE, fordi serveren klamper værdien mod antal tilstedeværende. */
  neverAutoAdvance?: boolean;
}
```

### Ændring 2 — `apps/party-server/src/phase.ts`

Tilføj en eksporteret, ren funktion. Den skal indeholde *hele* beslutningen — flyttet
1:1 fra `checkAllSubmitted`, plus det nye flag og et `Number.isFinite`-værn:

```ts
/** Faser hvor "alle har indsendt" kan afslutte fasen før tid. */
export const AUTO_ADVANCE_PHASES = [
  "submit", "vote", "draw", "guess", "write", "commit", "clue",
];

/**
 * Skal fasen afsluttes, fordi alle forventede spillere har indsendt?
 *
 * Ren funktion, så den kan testes uden en Durable Object. Tæller kun spillere,
 * der er forbundet (eller allerede har indsendt) — ellers ville en spiller, der
 * er droppet ud, tvinge resten til at vente timeren ud.
 */
export function shouldAutoAdvance(room: RoomState): boolean {
  if (room.status !== "playing" || !room.gameType) return false;

  const currentPhase = room.currentPhase ?? "";
  const base = currentPhase.split("_")[0];
  if (!AUTO_ADVANCE_PHASES.includes(base)) return false;

  const handlers = getGameHandlers(room.gameType);
  if (handlers.config?.neverAutoAdvance) return false;

  const phaseSubmissions = room.submissions.filter(
    (s) => s.round === room.roundNumber && s.phase === currentPhase,
  );
  const submittedIds = new Set(phaseSubmissions.map((s) => s.playerId));
  const presentCount = room.players.filter(
    (p) => p.isConnected || submittedIds.has(p.id),
  ).length;

  const raw = handlers.getExpectedSubmitterCount?.(room);
  // Et ikke-endeligt tal betyder "aldrig auto-fremdrift" — ikke "klamp til alle".
  if (raw !== undefined && !Number.isFinite(raw)) return false;
  const expectedCount = raw !== undefined ? Math.min(raw, presentCount) : presentCount;

  return expectedCount > 0 && phaseSubmissions.length >= expectedCount;
}
```

`Number.isFinite`-værnet er med vilje: det gør den fælde, Surge faldt i, umulig at falde
i igen, uanset om et fremtidigt spil bruger flaget eller sentinel-værdien.

### Ændring 3 — `apps/party-server/src/server.ts`

`checkAllSubmitted` (`:583-605`) reduceres til at kalde den rene funktion. Metoden kaldes
to steder — efter en indsendelse (`:572`) og når en spiller forlader rummet (`:723`) —
begge kald bevares uændret:

```ts
  private checkAllSubmitted() {
    if (!shouldAutoAdvance(this.state)) return;
    this.safeAdvance("ALL_SUBMITTED");
    this.scheduleNextAlarm();
  }
```

Importér `shouldAutoAdvance` fra `./phase` (serveren importerer allerede fra `./phase`).

### Ændring 4 — `apps/party-server/src/games/surge.ts`

Sæt flaget i `config` (`:11-16`) og **slet** `getExpectedSubmitterCount`-overriden
(`:214-217`) helt — den er nu død kode og en fælde for den næste læser:

```ts
  config: {
    pack: "pack1",
    initialPhase: "countdown",
    totalRoundsForPlayerCount: () => 100,
    minPlayers: 2,
    // Runden er et kapløb med uret: brikken er "transit", indtil den lander, så
    // en fase, der slutter når alle har trykket, klipper de sidste svar af.
    neverAutoAdvance: true,
  },
```

## Tests — `apps/party-server/test/auto-advance.test.ts` (ny fil)

Første test af spil-logikken i repoet. Byg en minimal `RoomState`-fabrik i testfilen
(kig i `apps/party-server/src/types.ts` for de påkrævede felter; `status: "playing"`,
`gameType`, `roundNumber`, `currentPhase`, `players[]`, `submissions[]`, `settings`,
`phaseVersion`). Importér spillene, så `registerGameHandlers` kører — `registry.ts`
fyldes af side-effekter, så testen skal importere de spil, den bruger.

Dæk mindst:

1. **Surge afslutter ikke tidligt.** `gameType: "surge"`, fase `commit`, tre forbundne
   spillere, tre indsendelser → `shouldAutoAdvance === false`. Dette er regressionstesten
   for hele fejlen.
2. **Surge afslutter ikke tidligt, selv om alle har landet et rigtigt valg**
   (`choice: "true"` for alle tre) → stadig `false`. Tiden skal løbe ud *hver* gang.
3. **Blitz afslutter stadig tidligt.** `gameType: "blitz"`, fase `submit`, alle har
   indsendt → `true`. Beskytter mod, at fixet ved en fejl slår auto-fremdrift fra for
   alle spil.
4. **Blitz afslutter ikke, når én mangler** → `false`.
5. **Afbrudt spiller blokerer ikke.** To spillere, den ene `isConnected: false` uden
   indsendelse, den anden har indsendt → `true` (bevarer den eksisterende adfærd, som
   kommentaren på `server.ts:576-581` beskriver).
6. **Scrawl ekskluderer kunstneren.** Fase `guess_0`, kunstner + to gættere, to gæt
   indsendt → `true` (bekræfter, at `getExpectedSubmitterCount`-stien stadig virker,
   jf. `scrawl.ts:425-431`).
7. **Ikke-auto-advance-fase.** Fase `reveal` med alt indsendt → `false`.
8. **Et hypotetisk spil, der returnerer `Infinity`** → `false` (værnet).

## Verifikation i den kørende app

`pnpm dev`, åbn `/host/<KODE>`, join med to-tre faner.

1. **Surge:** start spillet. Lad alle spillere trykke med det samme. **Forventet:**
   nedtællingen kører hele vejen ned, uanset hvor hurtigt alle trykker. Ingen spiller
   får "nåede ikke at vælge", når de rent faktisk landede et valg.
2. **Gentest af G2.** Optræder "du nåede ikke at vælge" stadig for den sidste spiller,
   *efter* at timeren nu løber fuldt ud? Så er der en selvstændig race condition — luk
   den **ikke** i denne PR, men noter fundet i PR-beskrivelsen som opfølgning.
3. **Regression — de andre spil skal stadig springe frem:** spil en runde Blitz og en
   runde Scrawl. Når alle har indsendt, skal fasen skifte **med det samme** — den må
   ikke pludselig vente timeren ud. Det er den vigtigste regression at fange, fordi
   ændringen rører fælles kodesti.

## Acceptkriterier

- [ ] Surge-runder løber altid timeren ud, uanset hvor hurtigt alle svarer.
- [ ] En spiller, der lander et valg inden tiden, tælles altid som havende svaret.
- [ ] Blitz, Fusk, Scrawl, Morph og Hunch springer stadig frem, når alle har indsendt.
- [ ] `apps/party-server/test/auto-advance.test.ts` dækker punkt 1-8 og er grøn.
- [ ] `pnpm typecheck`, `pnpm lint` og server-tests er grønne.
- [ ] Det er verificeret i den kørende app, ikke kun i tests.

## Uden for scope

Rør ikke tidsindstillinger, Surge-scoring, `transit`-mekanikken på klienten eller
resten af playtest-listen. Viser gentesten en selvstændig race condition i G2, så
**dokumentér den — ret den ikke her.**

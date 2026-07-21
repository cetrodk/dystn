# PR 4 — Join-skærm og avatar-polish

**Branch:** `feat/join-and-avatar-polish` · **Base:** `main` · **Område:** `apps/web`
· **Prioritet: P1**

Læs [`README.md`](./README.md) i denne mappe først (konventioner, kvalitetsporte).

---

Seks afklarede punkter fra playtesten, samlet fordi de rører samme hjørne af appen.
Tag dem gerne som seks commits — det gør review lettere.

---

## 1. Avataren er for lille på join-skærmen

> "Avatar-visningen skal være større." · Afklaret: det gælder **join-skærmen** — der,
> hvor man skriver sit navn og vælger avatar på vej ind i spillet.

**I dag** (`apps/web/src/pages/JoinPage.tsx:115-148`) er navn og avatar én flex-række
inde i ét kort:

- `:122-129` avatar-knap, `h-11 w-11` (44 px), rund, åbner `AvatarEditorModal`
- `:130-138` navne-input, centreret
- `:140-147` shuffle-knap `↻`, `h-11 w-11` — findes ifølge kommentaren mest for at
  *spejle* avatar-knappen, så navnet forbliver visuelt centreret

Avataren er reelt en knap-dekoration. Det er første gang, spilleren møder sin figur — og
den er 44 px.

**Løsning:** Løft avataren ud af inputrækken og gør den til et selvstændigt, stort element
**over** navnefeltet (retning: 96-128 px, `h-24 w-24` / `h-32 w-32`). Den skal stadig være
klikbar og åbne `AvatarEditorModal`, og shuffle-knappen skal stadig kunne nås — placér den
fx som en lille cirkel-knap i avatarens nederste højre hjørne, eller under den.

Når avataren ikke længere sidder i inputrækken, mister rækken sin grund til at have en
tom 44 px-plads i venstre side: navnefeltet må gerne fylde hele bredden. Bevar
"nb-card"-æstetikken (3 px ink-border, hård offset-skygge) — se resten af `JoinPage`.

`BlobAvatar` (`apps/web/src/components/GameAvatar.tsx:29-108`) har **ingen `size`-prop** —
den er `h-full w-full` og skaleres udelukkende af wrapper-div'ens klasser. Så det er bare
et spørgsmål om at give den en større wrapper.

## 2. Den blå fokusring skal væk

> "Den blå fokusring på navne-inputtet skal væk."

**Vigtigt — det er ikke browserens default.** Det er jeres egen globale regel
(`apps/web/src/index.css:291-295`):

```css
/* Global focus-visible ring for keyboard navigation */
:focus-visible {
  outline: 3px solid var(--color-accent);
  outline-offset: 2px;
}
```

`--color-accent: #2e6be6` (cobalt) — det er den blå. (`--color-primary` er `#e8553a`,
tomat; blå er kun primary i `[data-theme="cobalt"]`.)

**Hvorfor `focus:outline-none` på inputtet (`JoinPage.tsx:136`) ikke virker:**
`index.css:1` er `@import "tailwindcss"` (v4), som lægger alle utilities i cascade-laget
`@layer utilities`. Reglen på `:292` står **uden for ethvert lag**, og ulayeret CSS slår
al layeret CSS — uanset specificity. Den globale regel vinder derfor altid.

**Løsning:** Pak den globale `:focus-visible`-regel i `@layer base`, så Tailwind-utilities
kan overskrive den, **og** skift farven fra `--color-accent` (blå) til `--color-ink`, så
ringen passer ind i det varme, sorte tema i alle temaer.

**Fjern ikke fokus-markeringen.** Den er der for tastaturbrugere, og et input uden synligt
fokus er en tilgængelighedsregression. Målet er en ring, der ser ud, som om den hører til
— ikke ingen ring. Verificér med Tab-tasten på join-skærmen, at fokus stadig er tydeligt.

Tjek bagefter resten af appen: reglen er global, så farveskiftet rammer alle knapper og
felter. Det er meningen.

## 3. Fjern den grønne prik ved rumkoden

> "Hvad gør den grønne prik ud for rumkoden?"

**Svaret:** ingenting af værdi. `JoinPage.tsx:101-111` er en `motion.div`, der fader ind,
så snart `code.length === 4`. Den siger intet om, hvorvidt rummet **findes** — "XXXX"
giver også grønt lys. Den lover en validering, den ikke leverer.

**Løsning:** slet `:101-111`. Feltet er allerede tydeligt udfyldt uden den.

Et ægte "findes rummet?"-opslag ville være en bedre feature — men det er sit eget stykke
arbejde og hører til den udskudte lobby-runde. **Byg det ikke her.**

## 4. Miniature-ikonerne i avatar-vælgeren skal være sorte

> "Selve formen skal bare være sort ligesom øjne og mund." · Afklaret: det gælder **kun
> miniature-ikonerne i vælgeren**. Den færdige avatar er stadig farvet.

**Hvorfor form-rækken er kulørt i dag:** Miniaturerne er ikke separate ikoner — de er
`BlobAvatar` med en `part`-prop (`AvatarEditorModal.tsx:117-121`):

```tsx
<BlobAvatar traits={{ ...value, [key]: i }} color={AVATAR_PALETTE[value.color]} part={key} />
```

I `GameAvatar.tsx` bruges `color` **kun** som `fill` på shape-elementerne (`:53, :56, :61, :67`).
Alt andet (outline, øjne, mund, hat) tegnes med `currentColor` = `var(--color-ink)` (`:49`).
Med `part="eyes" | "mouth" | "hat"` gates shapen væk (`show()`, `:43`), så de rækker bliver
sort-på-transparent. Kun `part="shape"` viser en farvet flade.

**Løsning:** send ink-farven i stedet for paletfarven, når miniaturen er en form:

```tsx
color={key === "shape" ? "var(--color-ink)" : AVATAR_PALETTE[value.color]}
```

Farve vælges alligevel i den separate swatch-række (`AvatarEditorModal.tsx:76-89`) — så
formen behøver ikke også bære farven. Den valgte-tilstand er `ring-2 ring-[var(--color-primary)]`
(`:106`) og skal blive, som den er. Live-preview'en (`:57-59`) skal **stadig** være farvet.

## 5. De fem øjensæt skal kunne kendes fra hinanden

> "Der skal være minimum ét sæt rigtig store øjne. De tre første ligner meget hinanden."

**Bekræftet i koden.** De fem varianter (`GameAvatar.tsx:39-42, :79-92`) er reelt kun tre
familier:

| # | I dag |
|---|---|
| 0 | to fyldte cirkler (r 4,5) + hvidt glimt |
| 1 | **identisk med 0**, blot rykket 3 SVG-enheder til venstre |
| 2 | **identisk med 0**, rykket 3 enheder til højre |
| 3 | søvnige buer (stroke) |
| 4 | samme cirkler, r 6 (lidt større) |

I vælgeren renderes de i en 40 px-flise med `PART_VIEWBOX.eyes = "28 36 44 24"` (`:17`) —
44 enheder bred. 3 enheders forskydning bliver til ca. **2,7 px**. 0, 1 og 2 er praktisk
talt identiske pixels.

**Løsning:** redesign de fem, så hver har sin egen silhuet. Retning (form gerne selv, men
hold jer til fem klart forskellige *familier*, ikke fem justeringer af den samme):

- **store, runde øjne** — markant større end i dag (det efterspurgte "rigtig store")
- normale runde øjne med glimt
- søvnige/halvlukkede buer (behold nr. 3 — den virker)
- smalle/sammenknebne streger
- ét blinkende øje (ét lukket, ét åbent) — asymmetri læses øjeblikkeligt, selv i miniature

**Krav: antallet skal forblive 5.** `TRAIT_COUNTS` er duplikeret ordret i
`apps/web/src/lib/avatar.ts:15-21` **og** `apps/party-server/src/avatar.ts` — de holdes
manuelt i sync, og serveren *validerer* indekser (`party-server/src/avatar.ts:39-56`,
`sanitizeAvatarSpec`). Værre endnu: valideringen er alt-eller-intet — et indeks uden for
området får hele avataren droppet, ikke bare det ene trait. Ændrer du antallet, skal
begge filer ændres, og gamle klienter kan miste deres avatar. **Antallet af dele er
desuden et udskudt spørgsmål** (skal ekstra dele være en købsanledning?) — så hold dig
til fem og lad `TRAIT_COUNTS` være.

Test i vælgeren, at alle fem kan skelnes i 40 px-fliserne — ikke kun i stor visning.

## 6. Avatar i spiller-pillerne på værtsskærmen

> "HOST-visningen, når man venter på svar, viser kun navn og ikke avatar."

**Bekræftet.** Pillen er **copy-pasted i hver fase-komponent** med identisk markup, og
ingen af dem tegner avataren — de bruger kun `p.avatarColor` som pill-baggrund:

- `apps/web/src/games/fusk/HostSubmit.tsx:61-91` ← kanonisk eksempel
- `apps/web/src/games/blitz/HostSubmit.tsx:44-72`
- `apps/web/src/games/morph/HostWrite.tsx` og `morph/HostGuess.tsx`
- `apps/web/src/games/scrawl/HostDraw.tsx` og `scrawl/HostGuess.tsx` (sidstnævnte har en
  ekstra `isArtist`-tilstand)
- `blitz/HostVote.tsx:12`, `fusk/HostVote.tsx:14` (samme tællemønster)

Til sammenligning bruger `WaitingScreen.tsx:49-54` (spillerens telefon) allerede
`GameAvatar`, og det gør lobby, scoreboard og alle `HostReveal`-faser også. Det er kun
vente-pillerne, der mangler.

**Løsning:** udtræk **én delt `PlayerPill`-komponent** (fx
`apps/web/src/components/PlayerPill.tsx`) med `GameAvatar` indbygget, og erstat alle
duplikaterne. Bevar den eksisterende animation nøjagtigt (`fusk/HostSubmit.tsx:64-88`):
`motion.div` med `layout`, og `animate` på `backgroundColor` (avatarfarve når indsendt),
`color`, `opacity` (0,4 → 1) og et lille `scale`-pop `[1, 1.15, 1]`. Behold ✓-mærket.

Avataren skal kunne ses i pillen — `h-6 w-6` som i `WaitingScreen` er et rimeligt
udgangspunkt. Håndtér `scrawl/HostGuess`' `isArtist`-tilstand som en prop, så den
særtilstand ikke går tabt.

Dette er den ændring i PR'en med størst rækkevidde (den rører 6-8 filer på tværs af fire
spil). Gå hvert spil igennem bagefter og se, at pillerne stadig opfører sig, som de
plejer.

## 7. "PARTY PACK" ud af logoet

> "Fjern alle referencer til 'Party Pack'."

To steder, og kun to:

- `apps/web/src/components/Brand.tsx:153` — den synlige undertitel under ordmærket
- `apps/web/src/index.css:5` — en kodekommentar, der nævner "Dystn Party Pack"-handoff

**Løsning: fjern undertitlen helt.** Ordmærket bærer sig selv, og enhver ny undertitel er
bare en ny ting at blive træt af. Ret kommentaren i `index.css` til at sige "Dystn"
i stedet.

**Pas på:** "Dystn-pakken" (licensen, `da.ts:248-359`, `UnlockModal`, `GamePicker`) er
noget **andet** og skal ikke røres. Det er navnet på det betalte spil-bundle.

---

## Verifikation i den kørende app

`pnpm dev`. Vært på `/host/<KODE>`, spillere i to-tre faner.

1. **Join-skærmen:** avataren er stor og tydelig. Klik åbner vælgeren. Shuffle virker.
2. **Tab gennem join-skærmen:** fokus er synligt på hvert felt — og det er ikke blåt.
3. Rumkoden kan skrives færdig uden, at en grøn prik dukker op.
4. **Avatar-vælgeren:** form-miniaturerne er sorte silhuetter. Live-preview'en er farvet.
   Alle fem øjensæt kan skelnes i miniature — ét sæt er markant større end resten.
5. **Værtsskærmen, mens der ventes på svar:** hver spiller-pill viser sin avatar.
   Pillen fyldes med avatarfarven og popper, når spilleren har svaret. Tjek i **mindst
   to spil** (fx Fusk og Blitz) og i Scrawls tegne-fase.
6. Logoet har ingen undertitel.

Der findes Playwright-e2e i `apps/web/e2e/` — bl.a. `avatar.spec.ts`. Kør dem, og opdatér
dem, hvis de knækker på den nye join-struktur.

## Acceptkriterier

- [ ] Avataren er stor og tydelig på join-skærmen.
- [ ] Ingen blå fokusring — men fokus er stadig synligt for tastaturbrugere.
- [ ] Den grønne prik er væk.
- [ ] Form-miniaturerne i vælgeren er sorte; den færdige avatar er stadig farvet.
- [ ] De fem øjensæt er tydeligt forskellige i miniature, og ét sæt er rigtig stort.
- [ ] `TRAIT_COUNTS` er **uændret** i både web og server.
- [ ] Spiller-pillerne på værtsskærmen viser avatarer — via én delt komponent, ikke
      otte kopier.
- [ ] Logoet siger ikke længere "PARTY PACK". "Dystn-pakken" (licensen) er urørt.
- [ ] `pnpm typecheck` og `pnpm lint` er grønne; e2e-tests kører.

## Uden for scope

Antallet af avatar-dele (skal der være lige mange, og skal ekstra dele kunne købes?),
avatar-animation, mere liv på vent-på-svar-skærmen, og et ægte rums-opslag bag den grønne
prik. Alle fire er udskudt til en beslutning.

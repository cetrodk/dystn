# PR 5 — Rumkoden, QR-koden og join-linket skal altid kunne findes

**Branch:** `feat/room-code-always-visible` · **Base:** `main` · **Område:** `apps/web`
· **Prioritet: P0**

Læs [`README.md`](./README.md) i denne mappe først (konventioner, kvalitetsporte).

---

## Fejlen (fra playtest 14.07.2026)

> "Når værten har valgt et spil, får vi en ny side, hvor man ikke længere kan få linket
> eller QR-koden. Jeg ved ikke, om det skal være samme side. Når der først er valgt spil,
> føles det ikke længere som en lobby."

## Hvad der faktisk sker

Alt værts-UI ligger i **én fil**: `apps/web/src/pages/HostView.tsx` (936 linjer). Den har
ingen client-side fase-routing — den skifter udelukkende på server-snapshottet
(`room.status` / `room.gameType`) og har **tre** layouts:

| Tilstand | Linjer | Rumkode | QR | Join-link |
|---|---|---|---|---|
| **A.** Lobby, intet spil valgt | `:648-744` | stor (`RoomCodeTiles size="lg"`, `:699`) | ✅ `:660-681` | ✅ `:693-698` |
| **B.** Lobby, spil valgt | `:536-645` | lille kort (`:626-631`) | ❌ | ❌ |
| **C.** Spillet kører | `:465-517` | lille mono-tekst i toolbaren (`:55-60`) | ❌ | ❌ |

**QR og join-link forsvinder altså allerede i B — før spillet overhovedet er startet**,
i samme øjeblik værten vælger et spil. Det er præcis det, playtesten fangede.

To detaljer mere:

- QR-kolonnen i A er `hidden lg:flex` (`:660`) — **usynlig under 1024 px**.
- Join-linket (`:693-698`) siger `Gå til {window.location.host}/join` — **uden koden**.
  QR-koden peger derimod på `/join/${room.code}` (`:670-675`). Linket er altså dårligere
  end QR-koden, selv når det vises.

`GamePicker` er i øvrigt **ikke** en separat skærm — den er en Embla-karrusel indlejret i
bunden af lobby A (`:723-734`). Det er valget af spil, der skifter layout fra A til B.

## Vigtigt: serveren afviser nye spillere midt i et spil

`apps/party-server/src/server.ts:423-439` (`handleJoin`): når `status !== "lobby"`,
accepteres kun **gen-tilslutning** (kendt `sessionId`) eller **navne-reclaim** af et
afbrudt sæde. Alt andet giver `throw new Error("Spillet er allerede i gang")`.

Det betyder, at et QR-overlay under spil i dag **ikke** kan lukke nye spillere ind — det
kan lade en frafalden spiller komme tilbage, og det kan svare på "hvad var koden nu?".
Om ægte mid-game-join skal understøttes er et **udskudt** spørgsmål til Morten. **Byg det
ikke her**, og lov det ikke i teksten.

## Løsning

### Ændring 1 — én delt join-panel-komponent

I dag er `qrcode.react` lazy-importeret tre forskellige steder med hver sin lokale
wrapper (`HostView.tsx:7-9`, `UnlockModal.tsx:7-9`, `TakPage.tsx:9-10`). Der er ingen
delt QR-komponent.

Lav `apps/web/src/components/JoinPanel.tsx`: rumkode + QR + join-link, i én komponent med
en `size`-prop (fx `"hero" | "compact"`). Genbrug `RoomCodeTiles` fra
`apps/web/src/components/Brand.tsx:207-243` (props: `code`, `size: "lg" | "md" | "sm"`) og
den samme lazy-`QRCodeSVG`-wrapper som i `HostView.tsx:7-9`
(`value={`${window.location.origin}/join/${room.code}`}`, `fgColor="#1a1714"`, `bgColor="white"`).

Ret samtidig join-linket, så det **indeholder koden** — `dystn.app/join/TXNG`, ikke
`dystn.app/join`. Læg strengen i `apps/web/src/lib/da.ts`; hardkod den ikke.

Gør panelet responsivt frem for at skjule QR under 1024 px (`hidden lg:flex`,
`HostView.tsx:660`). En vært kan sagtens sidde med en iPad.

### Ændring 2 — behold panelet, når spillet er valgt (layout B)

`HostView.tsx:536-645`: erstat det kompakte rumkode-kort (`:626-631`) med `JoinPanel`.
Det er PR'ens kerne — det er dét, playtesten faldt over. Lobbyen skal blive ved med at
føles som en lobby, indtil spillet rent faktisk starter.

### Ændring 3 — klikbar rumkode i toolbaren under spil (layout C)

`HostToolbar` (`HostView.tsx:34-123`) viser rumkoden som bar tekst (`:55-60`). Gør den til
en knap, der åbner et overlay med `JoinPanel` i stor udgave.

Genbrug modal-mønsteret fra `apps/web/src/components/UnlockModal.tsx:59-172`:
`<AnimatePresence>` om `{open && ...}`, backdrop `motion.div` med
`fixed inset-0 z-50 ... bg-black/60 backdrop-blur-sm` + `onClick={onClose}`, panel med
`initial={{scale:0.9,opacity:0}}` → `animate` → `exit` og `onClick={(e) => e.stopPropagation()}`.
Ingen React-portal — `z-50` er nok, for `HostToolbar` er `z-40` (`:51`).

**Overlayet må ikke lyve.** Da serveren afviser nye spillere under spil, skal panelet i
denne tilstand bære en ærlig linje — fx *"Nye spillere kan først komme ind, når spillet
er slut"* — og ellers fungere som "hvad var koden?" og gen-tilslutning for en, der er
røget ud. Læg teksten i `da.ts`.

Overvej at lukke overlayet på `Escape` og at pause/ikke-pause spillet — **spillet skal
køre videre**; overlayet er rent visuelt, og timeren er serverstyret, så den kører alligevel.

### Ændring 4 — pas på "Stop spil"

`HostToolbar`s firkant-knap (`:96-104`) er **ikke** en fuldskærmsknap — den er **Stop
spil** (sætter `confirmStop`, og "Ja" sender `backToLobby`). Der findes ingen
fuldskærms-kode i appen overhovedet. Rør den ikke, og forveksl den ikke med noget andet.
(Ønsket om fuldskærm/cast er et udskudt punkt.)

## Verifikation i den kørende app

`pnpm dev`. Vært på `/host/<KODE>`, en spiller i en anden fane.

1. **Lobby uden spil valgt:** rumkode, QR og join-link er synlige. Linket indeholder koden.
2. **Vælg et spil.** **Forventet:** rumkode, QR og link er der **stadig**. Dette er den
   vigtigste test i PR'en.
3. Scan QR-koden med en telefon → den skal føre direkte ind i rummet med koden udfyldt.
4. **Start spillet.** Klik på rumkoden i toolbaren → overlay med kode, QR og link.
   Spillet kører videre bagved. Escape/klik udenfor lukker.
5. **Gen-tilslutning:** luk en spillers fane midt i spillet, scan QR'en igen med samme
   browser/session → spilleren skal komme tilbage i spillet.
6. Prøv i et smalt vindue (tablet-bredde). QR må ikke forsvinde.
7. Tjek, at "Stop spil"-knappen stadig virker som før.

## Acceptkriterier

- [ ] Rumkode, QR og join-link er tilgængelige i lobbyen — **også efter at et spil er valgt**.
- [ ] Rumkoden i toolbaren er klikbar under spil og åbner et overlay med QR og link.
- [ ] Join-linket indeholder rumkoden.
- [ ] QR-koden er ikke længere skjult på smalle skærme.
- [ ] Overlayet lover ikke, at nye spillere kan komme ind under et igangværende spil.
- [ ] Der er én delt `JoinPanel`-komponent — ikke tre kopier af QR-opsætningen i `HostView`.
- [ ] "Stop spil"-knappen er uændret.
- [ ] `pnpm typecheck` og `pnpm lint` er grønne.

## Uden for scope

**Byg ikke mid-game-join.** Det kræver, at `server.ts:423-439` løsnes, og at hver spilmotor
kan tåle en spiller, der dukker op midt i en runde (fase-fremdriften tæller mod
`players.length` — se `phase.ts` og [PR 1's plan](./pr1-surge-auto-advance.md)). Det er en
udskudt beslutning.

Byg heller ikke lobbyen om (skal spilvalg ske inde i lobbyen?), og rør ikke `GamePicker`.
Denne PR fjerner symptomet — strukturen er Mortens beslutning.

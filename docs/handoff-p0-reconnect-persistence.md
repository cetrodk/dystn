# Hand-off: P0 — server-persistens + robust genforbindelse

**Til:** Fable 5 · **Fra:** launch-readiness review 5. juli 2026 · **Mål:** luk de tre P0-blokkere, så en spilaften overlever låste telefoner, netværksudfald og redeploys.

Denne brief indeholder alt det, der allerede er kortlagt — arkitektur, invarianter, fil/funktion-pegepinde og faldgruber — så du kan gå direkte til at verificere det enkelte sted og implementere, i stedet for at genudforske hele kodebasen. **Linjenumre er omtrentlige** (nogle filer er lige redigeret); naviger via funktionsnavne og verificér mod nuværende kode. Kør `pnpm typecheck` efter hver opgave. Der findes ingen unit-tests i dag.

---

## Fælles kontekst (læs først — spar tokens her)

- **Backend:** PartyKit, ikke Convex. `apps/party-server/src/server.ts` — én Durable Object pr. rum, klassen `FestspilServer`. Al state ligger i `this.state: RoomState` (typen i `apps/party-server/src/types.ts`).
- **Nøgle-invariant:** klienten forbinder med `new PartySocket({ id: sessionId })` (`apps/web/src/providers/PartyProvider.tsx`, i `useEffect`). Derfor er **`conn.id === sessionId`** på serveren. Værten binder `hostId = sessionId` i `handleHostConnect`. Host-handlinger autoriseres nu på `sender.id === state.hostId` (central guard i `onMessage`, `HOST_ONLY_TYPES`). **Bevar denne invariant** i alt nedenstående.
- **Persistens i dag:** ingen. Kun `scheduleNextAlarm()` bruger `this.room.storage.setAlarm(...)`. Constructoren (`constructor(readonly room)`) initialiserer altid frisk lobby-state. Der er ingen `onStart`.
- **Timer-model:** `onAlarm()` kalder `advancePhase(state, "TIMER_EXPIRED")`. `scheduleNextAlarm()` sætter alarmen til `min(phaseDeadline, hostDisconnectDeadline)`. En DO har kun ÉN alarm.
- **Forbindelseslivscyklus:** `onConnect` markerer host/spiller som forbundet igen + sender snapshot. `onClose` markerer disconnect og **auto-pauser** hvis `status === "playing"` (gemmer `pausedRemaining`, rydder `phaseDeadline`).
- **Klient-identitet:** `apps/web/src/lib/session.ts`. `getSessionId()` cacher i modul-scope + `sessionStorage["festspil_session_id"]` (pr. fane). Host-session i `localStorage` (`festspil_host_room`, `festspil_host_secret`) via `setHostSession/getHostSession`. `SessionProvider` er **app-global** og kalder `getSessionId()` uden argument (ingen rum-kontekst) — det er en forhindring for opgave B, se dér.
- **Relevante klientfiler:** `apps/web/src/pages/PlayerView.tsx` (join/rejoin-effekt med `prevConnected`-ref; læser `PLAYER_NAME_KEY` fra sessionStorage), `apps/web/src/pages/HostView.tsx` (`hostConnectSent`-ref, sender kun `hostConnect` én gang), `apps/web/src/pages/HostSettings.tsx` (egen `PartyProvider`), `apps/web/src/pages/JoinPage.tsx`.

---

## Opgave A — Persistér room-state (så redeploy/eviction ikke nulstiller spil)

**Problem:** `RoomState` initialiseres kun i constructoren og gemmes aldrig. Et `partykit deploy` midt i en fest, en Cloudflare-migrering eller eviction (fx fælles-wifi der kortvarigt falder) genskaber rummet som tom lobby: spillere, scores, fase og — værst — `hostSecret` er væk. Efter reset er `hostSecret === ""`, så den første tilfældige `hostConnect` overtager rummet.

**Gør:**
- Skriv `this.state` til `this.room.storage.put("state", this.state)` efter hver mutation (helst en lille debounced `persist()`-helper, kaldt fra `broadcastState()` eller lige før den).
- Tilføj `async onStart()` der loader: `const saved = await this.room.storage.get("state"); if (saved) this.state = saved;`
- **Ved load skal transiente felter nulstilles**, fordi alle sockets er væk: sæt `hostConnected = false` og hver `player.isConnected = false`. Gen-arm timeren via `scheduleNextAlarm()` (deadlines er absolutte epoch-ms og gælder stadig — men hvis `phaseDeadline` er i fortiden, så kald `advancePhase("TIMER_EXPIRED")` én gang først).
- **Vækket tomt rum:** hvis et rum vækkes af en gammel alarm uden spillere og uden aktivt spil, behandl det som lukket (`deleteAlarm`, ingen genskabelse). Undgå at et forældet rum lever videre.
- Overvej PartyKits **hibernation**-mønster nu hvor state alligevel er i storage (valgfrit; ikke et krav for at lukke blokkeren).

**Faldgruber:**
- `submissions` og `phaseData` (bl.a. tegninger) kan være store — det er ok at persistere dem, men det er endnu et argument for opgave P2 "størrelsesgrænse på tegne-payloads".
- Persistér IKKE en `paused`-tilstand der efterlader `phaseDeadline` udefineret uden `pausedRemaining` (se den relaterede P1 om pause/advance-race — ryd op samtidig hvis du er i nærheden).

**Accept:** dræb og genstart party-dev-serveren midt i et spil → både vært og spillere genforbinder, og spillet fortsætter på samme fase med samme scores. `hostSecret` overlever, så rummet kan ikke kapres.

---

## Opgave B — Rum-scopet spiller-session i localStorage + eksplicit rejoin-fejl

**Problem:** spiller-id ligger i `sessionStorage` (pr. fane). På mobil ryger det når browseren dræber fanen (meget almindeligt når telefonen ligger låst mellem runder). Ved genåbning får spilleren nyt `sessionId`; `handleRejoin` finder ingen spiller og **svarer slet ikke** (tavs no-op), og `handleJoin` afvises med "Spillet er allerede i gang". Spilleren er permanent låst ude.

**Anbefalet løsning (besluttet):** flyt spiller-session til `localStorage`, **scopet pr. rumkode**, så identiteten overlever tab-død usynligt. Reclaim-by-name er kun redningsnet, ikke hovedvej (navne er ikke hemmelige).

**Gør:**
- `apps/web/src/lib/session.ts`: erstat/udbyg `getSessionId()` med en rum-scopet variant, fx `getSessionId(roomCode: string)` der læser/skriver `localStorage["festspil_session_" + roomCode.toUpperCase()]`. Nyt rum → nyt id.
- **Forhindring der skal løses:** `SessionProvider` er app-global og kalder `getSessionId()` uden rumkode. To veje:
  1. Lad `PlayerView`/`JoinPage` udlede id'et selv fra `code`-param (drop afhængigheden af den globale `useSessionId()` i spiller-flowet), **eller**
  2. Gør `SessionProvider` rum-bevidst (tag `roomCode` som prop der hvor den wrapper spiller-ruter).
  Vej 1 er mindst invasiv. Verificér alle kaldere af `useSessionId()` før du vælger (grep: `useSessionId`).
- Server `handleRejoin`: send et **eksplicit svar** ved ukendt sessionId, fx `{ type: "rejoinFailed" }` (tilføj typen i både `apps/party-server/src/types.ts` `ServerMessage` og `apps/web/src/providers/PartyProvider.tsx` `ServerMessage`-union + en håndtering i message-switch, fx sæt en `rejoinFailed`-tilstand i konteksten).
- Klient: på `rejoinFailed` (eller efter kort timeout uden `joined`), redirect til `/join/:code` med koden udfyldt — dér hører reclaim-by-name hjemme.

**Faldgruber:**
- Bevar invarianten `conn.id === sessionId`: `PartyProvider` sender `sessionId` som `PartySocket({ id })`, så den scopede id skal flyde hele vejen igennem til provideren.
- To faner mod samme rum deler nu id — acceptabelt for et partyspil (én person = én telefon). Valgfrit: læg et let "denne fane har overtaget"-tjek ind.
- Hænger sammen med opgave A: uden server-persistens matcher et localStorage-id alligevel ikke noget efter et redeploy. **Tag A og B sammen** — så dækker samme løsning både "telefon låst" og "server redeployet".

**Accept:** lås/genindlæs en spillers fane midt i spillet → spilleren er automatisk tilbage i samme plads. Forkert kode eller reelt ukendt session → ren fallback til join-skærm, ikke en evig "Indlæser…".

---

## Opgave C — Host-reconnect + indstillinger uden at tabe forbindelsen

**Problem 1 (reconnect):** `HostView` sender kun `hostConnect` én gang (`if (!connected || hostConnectSent.current) return;`). Ved en WS-reconnect gensendes det aldrig, så hvis serveren har mistet host-binding (efter opgave A er dette sjældnere, men reconnect sker stadig ved netværksskift), forbliver rummet værtsløst.

**Problem 2 (indstillinger):** `HostToolbar` navigerer til `/host/:code/settings`, som er en separat route med sin **egen** `PartyProvider` (`HostSettings.tsx`). Navigationen unmounter `HostView`s provider → WS lukkes → `onClose` ser host-disconnect → **auto-pauser spillet for alle**. Værten skal derefter manuelt genoptage.

**Gør:**
- `HostView.tsx`: spejl `PlayerView`s mønster — nulstil `hostConnectSent` (eller en `prevConnected`-ref) når `connected` bliver `false`, og send `hostConnect` ved **hver** `open`. `handleHostConnect` er idempotent for korrekt secret, så det er sikkert.
- Indstillinger: del **én** `PartyProvider` mellem `/host/:code` og `/host/:code/settings` via en layout-route med `<Outlet/>`, **eller** render indstillinger som modal/overlay inde i `HostView` (intet route-skift). Sidstnævnte er ofte enklest.
- Valgfrit men anbefalet: giv host-disconnect en kort grace (2–3 s) før auto-pause i `onClose`, og/eller auto-resume i `handleHostConnect` hvis værten er tilbage inden for få sekunder — så et kort blink ikke pauser spillet.

**Accept:** at åbne indstillinger midt i et spil pauser IKKE spillet for spillerne, og værtens WS overlever. Efter et netværks-blink genvinder værten automatisk kontrollen.

---

## Rider med (P1 der ligger i samme kode — ryd op hvis du er i nærheden)

- **`onAlarm` staleness-guard:** `RoomState.phaseVersion` er dokumenteret som race-værn, inkrementeres, men læses aldrig. Guard i `onAlarm`: returnér hvis `!state.phaseDeadline || Date.now() < state.phaseDeadline` (evt. med lille margin), før `advancePhase`. Relevant fordi opgave A rører alarm-genarmering.
- **`expectedCount` tæller frakoblede spillere** (`handleSubmitAnswer`): efter "fortsæt alligevel" når `phaseSubmissions.length` aldrig `expectedCount`, så faser venter hele timeren. Tæl kun `p.isConnected || allerede-submitted`. Relevant fordi genforbindelse ændrer hvem der er "til stede".
- **`handleContinueGame` med `pausedRemaining=0`** sætter `phaseDeadline=undefined` mens status er "playing" → fasen kan hænge. Ved `remaining <= 0`: kald `advancePhase("TIMER_EXPIRED")` med det samme.

Hold hovedfokus på A+B+C; disse tre er billige at tage med når koden alligevel er åben.

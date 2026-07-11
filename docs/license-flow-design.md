# Design: Licens-flow — freemium med engangskøb (Jackbox-model)

**Status:** revideret efter multi-agent review (se `docs/license-flow-design-review.md`) · **Dato:** 2026-07-10 (rev. 2)
**Mål:** Blitz + Scrawl gratis for alle; Fusk, Morph, Surge, Hunch bag et engangskøb ("Dystn-pakken"). Kun værten betaler; gæster forbliver 100 % login- og betalingsfri. Ingen konti, ingen licensdatabase.

---

## Principper

1. **Stateless licenser.** En licenskode er selvbærende: HMAC-signeret payload, som party-serveren validerer offline med en nøglering af hemmeligheder. Ingen licensdatabase, ingen konti.
2. **Håndhævelse server-side.** UI-låse er kosmetik; den reelle guard ligger i `handleChangeGameType` og `handleStartGame`. (Lektien fra `VITE_HOST_PASSPHRASE`, som er client-side og kan omgås.)
3. **Entitlements er monotone.** Pakker kan kun *tilføjes* til et levende rum — aldrig fjernes. En reconnect med manglende/ugyldig kode må aldrig låse spil midt i en fest, og en gemt kode slettes ALDRIG automatisk fra værtens browser (en fejlkonfigureret server må ikke kunne slette betalende kunders eneste kopi).
4. **Koden er delbar** — som Jackbox. Accepteret vilkår, ikke en fejl. Selve koden broadcastes aldrig — kun pakke-listen.
5. **Den delte skærm forstyrres ikke.** Værtsskærmen er i praksis en laptop eller telefon, der caster/er sluttet til et TV — der findes altså tastatur, men skærmen er *offentlig*: åbnes Stripe/MobilePay dér, ser hele selskabet betalingsflowet, og festen står stille. Købet sker derfor på en privat enhed — typisk værtens egen telefon, som værten alligevel holder, fordi værten selv spiller med (vært-som-spiller er den forudsatte opsætning: host på cast-enheden, spiller-join fra egen telefon). QR + rumkode-indløsning er broen; laptop-værter kan alternativt bare betale i en ny fane (samme-enheds-auto-indløsningen i §3 dækker det).
6. **Fremtidige spil = nye pakker.** Kodeformatet bærer en pakke-bitmask, så "Pakke 2" ikke kræver nyt format.

---

## Flowet fra et værts- og gæsteperspektiv

### Gæsten (den vigtigste historie: der ER ingen historie)

Gæsten scanner QR-koden på TV'et eller taster rumkoden på dystn.app, vælger navn og avatar — og spiller. Gæsten møder **aldrig** en betalingsvæg, en hængelås, en pris eller ordet "licens". Om værten har købt Dystn-pakken eller kører gratis-spillene, er usynligt for gæsten: spillerens UI viser kun det spil, der er i gang. `entitlements` i det broadcastede state bruges udelukkende af værts-UI'et. Dette er en invariant, ikke en bivirkning — enhver fremtidig ændring, der viser købs-relateret indhold på spillerskærme, er et brud på designet (og på product-briefens "No barriers for guests").

### Værten — scenarie A: køber hjemmefra (før festen)

1. Finder Dystn, klikker et diskret "Få alle spil"-link på landingssiden (køb må ikke kræve et åbent rum).
2. Stripe Checkout på egen enhed (kort eller MobilePay), betaler.
3. Lander på `/tak`: koden vises stort med kopiér-knap og gemmes automatisk i browserens localStorage. Siden siger eksplicit: *"Hoster du festen fra en anden skærm (TV/laptop)? Indtast koden dér, eller scan denne QR."* Koden sendes også på mail (webhook + Resend), så den overlever browserskift.
4. På festdagen: "Vær vært" på TV'et/laptoppen → er det samme browser som købet, er alt låst op automatisk (`hostConnect` medsender koden). Er det en anden enhed: kodefeltet i oplåsnings-modalen eller HostSettings → "Licens".

### Værten — scenarie B: køber midt i festen (fra lobbyen)

1. Lobbyen på TV'et viser de to gratis spil først og ét samlet "Dystn-pakken"-kort (4 spil). Værten klikker på det.
2. Oplåsnings-modalen viser pitch, pris — og en **QR-kode til Stripe Payment Link**. Værten scanner med sin egen telefon (som værten alligevel holder som medspiller) og betaler dér — MobilePay-app-skiftet sker privat, og TV'et bliver på lobbyen. Laptop-værter kan alternativt klikke linket og betale i en ny fane.
3. Telefonen lander på `/tak`, som beder om **rumkoden** (4 bogstaver, står allerede på TV'et). `/tak` kalder et HTTP-endpoint på rummets DO, der validerer og indløser koden direkte i rummet.
4. På TV'et forsvinder låsen live (serveren broadcaster ny state), konfetti, spillet kan vælges. Værten opfordres på telefonen til at gemme koden ("kopiér" + mail-bekræftelse er allerede sendt).
5. Sikkerhedsargument for skridt 3: endpointet kan kun *tilføje* entitlements til et rum — aldrig fjerne eller læse noget. At "fremmede" kunne låse ens rum op er ikke en trussel.

### Værten — scenarie C: ny enhed / mistet kode

- Koden ligger i mailen fra købet (primær gendannelse).
- Mistet mailen: support-mail (vises på /tak og i oplåsnings-modalen) — koden kan genskabes deterministisk fra Stripe-sessionen med et lille CLI-script (§2).
- Lånt/delt enhed: ved indløsning spørges "Husk licensen på denne enhed?"; HostSettings har "Lånt enhed? Glem licensen her" (reframet fra "fjern licens" — det forklarer *hvorfor* man ville).

### Værten — scenarie D: gratis-tier

"Vær vært" virker uden videre (passphrase-gaten er fjernet). Blitz og Scrawl er fuldt spilbare, ubegrænset. Pakkekortet i lobbyen er den eneste synlige forskel — positivt framet ("4 spil mere · dit for evigt"), ikke fire hængelåse.

---

## 1. Kodeformat

```
payload   = version(1 byte) | packs-bitmask(1 byte) | serial(5 bytes)
signatur  = HMAC-SHA256(K_sign, payload)[0..7]                    (8 bytes)
kode      = CROCKFORD-BASE32(payload | signatur)                   (24 tegn)
vises som = XXXXXX-XXXXXX-XXXXXX-XXXXXX
```

- **Crockford base32** (ikke RFC 4648): alfabetet udelader I/L/O/U og normaliserer `0↔O`, `1↔I/L` ved parsing — koder skal kunne afskrives fra en mail uden 0-mod-O-fejl. Parsing er case-insensitiv og ignorerer bindestreger/whitespace.
- **Nøglering, ikke én nøgle:** `version`-byten vælger nøgle (`LICENSE_SECRET_V1`, `_V2`, …). Verify afviser ukendte versioner. Lækker en secret, udstedes fremover med næste version — gamle legitime koder virker stadig, og reelle købere kan få genudstedt (serial er deterministisk, §2). *Version-bump uden nøglering er ingen nødbremse: en angriber med secret'en kan selv signere vilkårlige versioner.*
- **Domain separation:** af hver secret afledes to subkeys i det delte modul: `K_sign = HMAC(secret, "dystn:sign")` og `K_serial = HMAC(secret, "dystn:serial")`. Serial-afledning og signering deler aldrig nøgle direkte.
- **Secret-styrke er et krav, ikke en anbefaling:** hver solgt kode er et offline crack-target mod secret'en. Den SKAL være ≥32 tilfældige bytes (`openssl rand -base64 32`), opbevaret i password-manager. Bevidst tradeoff: symmetrisk MAC (frem for Ed25519) giver korte, tastbare koder — prisen er, at et læk af PartyKit-env = fuld forge-evne. Nøgleringen er svaret på det.
- **Constant-time compare:** standard-WebCrypto har ingen `timingSafeEqual`, og `subtle.verify()` kan ikke bruges med trunkeret tag. Det delte modul implementerer XOR-fold: `diff |= a[i] ^ b[i]` over alle 8 bytes, sammenlign til sidst.
- **Revokering af enkeltkoder** (chargeback-misbrug): valgfri env-var `LICENSE_DENYLIST` = kommaseparerede serials (hex). Serial genberegnes altid fra Stripe-session-id, så en misbrugt kode kan identificeres uden database. Eskaleringstrin FØR version-bump; fint til <100 emner.
- 64-bit signatur + rate-limit (§4) gør brute force udelukket.
- Modulet (encode/decode/verify/derive, ~60 linjer WebCrypto) **duplikeres bevidst** i `apps/party-server/src/license.ts` og `api/_license.ts` — begge runtimes (workerd, Vercel Node) har WebCrypto, og to kopier er billigere end at trække en delt pakke ind i Vercel-functionens build. En unit-test i hver ende med samme testvektorer holder dem i sync.

## 2. Køb → udstedelse (Stripe)

Stripe understøtter MobilePay i DK. **Payment Linket låses eksplicit til kort + MobilePay** (ingen dynamiske metoder med delayed notification, så `payment_status` er afgjort ved redirect), valuta DKK, og konfigureres med "Don't show confirmation page" + custom redirect.

```
Køb:      Stripe Payment Link → betaling → redirect: /tak?session_id={CHECKOUT_SESSION_ID}
Levering: (1) /tak-siden viser koden  (2) webhook → Resend-mail med koden  ← BEGGE i v1
```

**Hvorfor webhook + mail er med i v1 (ikke "senere"):** Stripes kvitteringsmail linker KUN til Stripes egen kvitteringsside — aldrig til success-URL'en — og sendes slet ikke uden dashboard-opt-in. Redirectet er dermed eneste browser-kanal, og netop MobilePays app-skift taber ofte retur-redirectet. Uden mailen kan en kunde have betalt uden nogensinde at se sin kode.

### `api/license.ts` — placering og adfærd

- **Ligger i `api/` i REPO-RODEN** — ikke `apps/web/api/`. Vercel-projektet bygger fra monorepo-roden (`outputDirectory: apps/web/dist`) og samler kun functions op fra rodens `api/`; en fil under `apps/web/api/` deployes aldrig, og SPA-catch-all-rewritet ville stille servere HTML med 200 på `/api/license`. `stripe`-npm-pakken undgås — rå `fetch` mod Stripe API (2 kald) holder funktionen dependency-fri.
- `GET /api/license?session_id=...`:
  1. Hent session med `expand[]=line_items` (line items er IKKE med i sessionen uden expand).
  2. Invarianter: `mode === "payment"`, livemode matcher env, `payment_status === "paid"` **eller** `"no_payment_required"` (100 %-rabatkoder).
  3. Price-id → packs-bitmask via eksplicit mapping-tabel i koden (`PRICE_TO_PACKS`); ukendt price-id = fejl, aldrig et gæt. Test- og live-price-id'er må ikke kunne forveksles tavst.
  4. `serial = HMAC(K_serial, session.id)[0..4]` → byg kode → returnér JSON.
- **Idempotent uden lagring:** samme session-id giver altid samme kode. Genudstedelse ved support: `scripts/reissue-license.ts` (CLI) tager et session-id fra Stripe-dashboardet og printer koden.
- Robusthed: simpelt pr.-IP-rate-limit (in-memory er fint på Fluid Compute), `Referrer-Policy: no-referrer` på /tak, og JSON-fejl (aldrig HTML) på manglende/ugyldige params. **`/tak`-URL'en med session_id har samme hemmelighedsværdi som koden selv** — den må ikke logges eller deles.
- `POST /api/stripe-webhook` (samme fil-familie): verificér webhook-signatur, ved `checkout.session.completed` → byg koden → send mail via Resend (`RESEND_API_KEY`). Webhook-fejl påvirker aldrig /tak-flowet.

### Env-vars

| Hvor | Variabler |
|---|---|
| Vercel | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `LICENSE_SECRET_V1`, `RESEND_API_KEY` |
| PartyKit | `LICENSE_SECRET_V1`, evt. `LICENSE_DENYLIST` |

Samme `LICENSE_SECRET_V1` begge steder. Opbevar kopi i password-manager — mistes den, kan udstedte koder ikke valideres efter rotation.

### Stripe-dashboard-tjekliste (launch)

- [ ] Produkt "Dystn-pakken", pris i DKK **inkl. moms** (én besluttet pris — se §6; UI-copy læser den fra `da.license.price`, aldrig hardcodet to steder)
- [ ] Payment Link: kun kort + MobilePay; "Don't show confirmation page"; redirect `https://dystn.app/tak?session_id={CHECKOUT_SESSION_ID}`
- [ ] Kvitteringsmails slået til; branding med firmanavn + CVR
- [ ] Webhook-endpoint registreret (`checkout.session.completed`)
- [ ] Livemode-test: ét rigtigt køb inkl. MobilePay-flow på telefon

## 3. Indløsning og entitlements

### Protokol-ændringer

`apps/party-server/src/types.ts` + spejlet i `apps/web/src/providers/PartyProvider.tsx` — og **alle tre state-lag**: `RoomState`, `RoomSnapshot` + `buildSnapshot()`-whitelisten (ellers når feltet aldrig klienten), og `freshState()` (`entitlements: []`).

```ts
// ClientMessage
| { type: "hostConnect"; sessionId: string; hostSecret: string; license?: string }
| { type: "redeemLicense"; hostId: string; code: string }        // + i HOST_ONLY_TYPES

// ServerMessage
| { type: "licenseResult"; ok: boolean; packs: string[];
    reason?: "invalid" | "rateLimited" | "denylisted" }          // reason → da.license.errors.*

// RoomState + RoomSnapshot
entitlements: string[]   // fx ["pack1"] — koden selv broadcastes ALDRIG
```

### Flow

1. **Indløsning i rummet:** vært sender `redeemLicense` (fra modal eller HostSettings) → server validerer → `state.entitlements = union(state.entitlements, packs)` → `licenseResult` + broadcast. Klienten gemmer koden i `localStorage["dystn_license"]` ved `ok` (med "Husk på denne enhed?"-valg).
2. **Cross-device-indløsning (TV-scenariet):** `/tak` beder om rumkode → `POST https://<party-host>/parties/main/<ROOMCODE>` med `{ type: "redeemLicense", code }` → DO'ens `onRequest` validerer (samme logik + rate-limit) og indløser. Kan kun tilføje entitlements — ufarligt uden auth.
3. **Samme-enheds-auto-indløsning:** /tak-fanen skriver localStorage, men rum-fanens `hostConnect` er allerede sendt. Rum-fanen lytter derfor på window `storage`-eventet og sender selv `redeemLicense` over den åbne socket, når koden dukker op → låsen forsvinder live uden refresh. (/tak viser desuden "Tilbage til dit rum"-CTA.)
4. **Ved `hostConnect`:** medbragt `license` valideres; gyldig → `entitlements = union(...)`, og der sendes `licenseResult` til værten (UI-status). Ugyldig/manglende → **ingen ændring af eksisterende entitlements** (monotoni, princip 3) og `licenseResult { ok: false }` KUN hvis en kode faktisk var medsendt. Klienten sletter ALDRIG koden selv — kun eksplicit brugerhandling i HostSettings gør.
5. **Persistens:** `entitlements` ligger i `RoomState` og persisteres allerede via `persist()`/`onStart` — ingen ekstra arbejde.

## 4. Server-håndhævelse

- **Sandhedskilde:** nyt påkrævet felt i `GameHandlers.config`: `pack: "free" | "pack1"`. **Fail-closed:** mangler feltet (eller hele config), behandles spillet som betalt — et nyt spil kan ikke tavst blive gratis. Testkrav: assert at alle registrerede spil har eksplicit `pack`.
- **Guards:**
  - `handleChangeGameType`: (a) afvis ukendt `gameType` med dansk fejl FØR registry-opslag (i dag gemmes en vilkårlig klient-streng, og et opslag ville kaste en engelsk exception til klienten), (b) kræv `pack === "free" || entitlements.includes(pack)`, ellers *"Dette spil kræver Dystn-pakken"*.
  - `handleStartGame`: samme pack-tjek (forsvar i dybden).
- **Async-regel:** WebCrypto gør licens-validering async, og async handlers kan interleave i workerd. Regel: al validering `await`es færdig FØR nogen mutation af `this.state` — aldrig mutation → await → mutation.
- **Rate-limit der faktisk virker:** en pr.-connection-tæller nulstilles ved reconnect (PartySocket reconnecter endda automatisk). Tælleren ligger derfor i `RoomState` (persisteres gratis): efter 5 fejlslagne valideringer (uanset kilde: `redeemLicense`, `onRequest` eller `hostConnect`-medbragt kode) afvises nye forsøg i 30 sekunder (`reason: "rateLimited"`). Cooldown frem for permanent lås — ærlige tastefejl i en 24-tegns kode må ikke brænde værten af.

## 5. Klient-UI

1. **LandingPage:** passphrase-gaten fjernes — "Vær vært" opretter rum direkte. Diskret "Få alle spil"-link (køb uden åbent rum, scenarie A).
2. **Lobby (HostView):** gratis spil sorteres FØRST i karrusellen. De fire betalte spil vises som ÉT samlet pakkekort — *"Dystn-pakken · 4 spil · dit for evigt · [pris]"* — ikke fire separate hængelåse (crippleware-indtryk). Med entitlement folder kortet ud til de fire normale spilkort.
3. **Oplåsnings-modal:** pitch + pris (fra `da.license.price`), **QR-kode til Payment Link** som primær CTA ("Scan og betal på din telefon"), sekundært link til samme URL, og "Har du en kode?"-inputfelt med klient-side formatvalidering (længde/alfabet) før afsendelse. Ved `licenseResult ok`: konfetti, pakken foldes ud.
4. **/tak (ny route):** tilstande: (a) betalt → kode + kopiér + auto-gem + rumkode-felt til cross-device-indløsning + "Tilbage til dit rum"-CTA; (b) `payment_status` afventer → "Behandles — vent et øjeblik" med poll; (c) ikke gennemført → forklaring + nyt købslink; (d) fejl/ugyldigt session_id → support-mail med session_id som reference. `Referrer-Policy: no-referrer`.
5. **HostSettings → "Licens":** status (pakker på dette rum + om en kode er husket her), kode-input, og "Lånt enhed? Glem licensen her".
6. **Fejlstrenge:** `licenseResult.reason` mappes til `da.license.errors.*` — tastefejl, rate-limit og spærret kode skal kunne skelnes.
7. **Spillere ser intet** (jf. gæsteflowet ovenfor) — invariant.
8. Alle nye strenge under `da.license.*`; prisen findes ét sted.

## 6. Moms og bogføring (SKAL afklares før lancering)

Salg af licenskoder er en **elektronisk leveret B2C-ydelse**:

- Prisen fastlægges **inkl. 25 % dansk moms** og er den, kunden ser. Beslut én pris (fx 99 kr inkl. moms) — §5-copy og Stripe-produktet skal matche.
- Kvittering: Stripe-kvitteringsmails slået til med firmanavn + CVR i branding. (Stripe Tax med tax-inclusive pricing er opgraderingsvejen, ikke et v1-krav.)
- EU-fjernsalg: Payment Links er offentlige; under €10.000/år i samlet EU-fjernsalg må der afregnes dansk moms af alt (relevant hvis en svensker køber). Ingen handling nu — men vær bevidst om tærsklen.
- Afklar momsregistreringsstatus (CVR/enkeltmandsvirksomhed) med revisor/Skat FØR første salg.

## 7. Kanttilfælde og bevidste fravalg

| Situation | Håndtering |
|---|---|
| Kode deles med venner | Accepteret (Jackbox-vilkår). Ingen device-binding i v1. |
| Refusion via Stripe | Koden virker stadig — accepteret svind. Systematisk misbrug: serial på `LICENSE_DENYLIST`; version-bump er sidste udvej. |
| Vært køber to gange | Muligt (ingen konti). Accepteret; manuel refusion ved henvendelse. Nævnes ikke i UI. |
| Vært skifter browser/enhed | Koden står i mailen; ellers support → CLI-genudstedelse fra Stripe-session-id. |
| MobilePay-redirect tabes | Mailen har koden (webhook-kanalen er uafhængig af browseren). |
| `LICENSE_SECRET_V1` lækker | Udsted fremover med `_V2`; V1-koder virker stadig; ved aktivt misbrug: denylist → i yderste konsekvens fjern V1 fra nøgleringen og genudsted til reelle købere. |
| Reconnect uden/med ugyldig kode | Ingen ændring — entitlements er monotone (princip 3). |
| Gratis-misbrug (mange rum) | Uændret fra i dag; stale-room-oprydning i `onAlarm` findes. |

## Fravalg: authentication (konti) — beslutningslog

Overvejet 2026-07-10 som alternativ til licens-koder. **Besluttet: stateless koder i v1; auth er en bevidst udskudt udvidelse, ikke en forkastet idé.**

**Hvad auth ville løse bedre:** gendannelse ("glemt kode" → "log ind") og revokering (DB-række i stedet for denylist + CLI); naturlig e-mail-kanal til "Pakke 2"-marketing og købshistorik; standardbiblioteker frem for bespoke krypto (base32/nøglering/XOR-fold); mindre casual deling end en kode.

**Hvorfor det alligevel er fravalgt i v1:**
1. **Databasen kommer med.** I dag er der nul infrastruktur ud over DO-storage. Konti kræver DB + session-validering i PartyKit — enten DB-opslag pr. `hostConnect` eller signerede JWT'er, dvs. samme HMAC-maskineri som koderne. Kompleksiteten flytter; den forsvinder ikke.
2. **GDPR.** Stateless koder gemmer ingen persondata. Konti betyder privatlivspolitik, sletteanmodninger og breach-ansvar — reel, løbende byrde for en solo-udvikler.
3. **Købsfriktion i scenarie B** (vigtigst): "scan QR → MobilePay → færdig" slår "opret konto → bekræft mail → log ind → betal". Impulskøbet foran gæsterne er hele pakkekortets pointe.
4. **TV-problemet forsvinder ikke:** login på et TV er lige så elendigt som kodeindtastning — device-linking (à la Netflix-aktivering) skulle bygges under begge modeller og er strukturelt identisk med cross-device-indløsningen i §3.
5. **Estimat:** koder 3–4 dage / nul drift; auth 5–8+ dage + vendor-pris + "kan ikke logge ind"-support.

**Reversibilitet:** valget er envejs-reversibelt — koder kan senere importeres i konti ("log ind og indløs din kode"), det omvendte sker aldrig. Intet tabes ved at starte stateless.

**Skift til auth, når ét af disse indtræffer:** (a) Pakke 2 er lanceret og tilbagevendende kunder ejer flere pakker på tværs af enheder; (b) B2B-sporet bliver reelt (faktura, flere brugere, administration); (c) "mistet kode"-support fylder mærkbart. Auth bygges da som *udvidelse*: koderne bliver entitlements på en konto.

## 8. Implementeringsrækkefølge (revideret estimat: 3–4 dage)

1. **Licensmodul** (encode/decode/verify, Crockford base32, subkeys, nøglering, XOR-fold-compare) som ren funktion + testvektorer. Kopi i party-server og `api/`.
2. **Server:** types (alle tre lag: RoomState, RoomSnapshot/buildSnapshot, freshState), `pack` i alle 6 game-configs + fail-closed default, guards i changeGameType (inkl. ukendt-gameType-fejl) og startGame, `redeemLicense`-handler, `onRequest`-indløsning, rate-limit i state, async-reglen, monotone entitlements.
3. **Klient:** PartyProvider-typer, localStorage + storage-event-lytter, pakkekort + oplåsnings-modal med QR, /tak-route med alle fire tilstande, HostSettings-sektion, `da.license.*`.
4. **`api/license.ts` + `api/stripe-webhook.ts`** i repo-roden (rå fetch, expand line_items, PRICE_TO_PACKS, invarianter, pr.-IP-rate-limit) + Resend-mail + `scripts/reissue-license.ts`.
5. **Stripe-opsætning** efter tjeklisten i §2 + momsafklaring (§6).
6. **Fjern passphrase-gaten**; opdatér `product-brief.md`-princippet til *"No barriers for guests — no accounts, no app download, no payment. Open the link and play. (Hosts unlock premium packs with a one-time purchase.)"*
7. **Tests:** unit-testvektorer for modulet; e2e: redeem-happy-path med test-secret i CI, guard-afvisning (start pack1-spil uden licens), cross-device-indløsning via onRequest, røgtest at `/api/license` uden params svarer JSON (ikke SPA-HTML).

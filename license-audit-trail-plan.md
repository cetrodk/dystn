# Plan: Audit-trail for licensindløsninger

*Status: plan (ikke implementeret). Fase 0 er implementeret 2026-07-14.*

## Baggrund

Licenskoder verificeres statsløst (HMAC-signatur) i rummets Durable Object —
serveren slår ikke op i nogen database ved indløsning. Det giver den
gnidningsfri "tast koden på dit TV"-oplevelse uden login, men betyder også,
at misbrug (én kode videresolgt til mange) kun kan opdages, hvis vi selv
registrerer indløsningerne. Se `license-flow-design.md` for selve kodeformatet
(version | packs-bitmask | 5-byte serial, `serialHex` er denylist-nøglen).

Managed PartyKit gemmer ingen logs — `npx partykit tail` streamer kun live.
Derfor er planen faseinddelt: synlighed nu, persistens efter den planlagte
partyserver-migration til Cloudflare (party.dystn.app).

## Trusselsmodel (afgrænsning)

Vi beskytter mod **videresalg i skala** (én serial → mange fremmede værter),
ikke mod deling i en vennekreds (2–3 værter pr. serial er forventet og ok —
det er værts-modellen). Falske koder er allerede dækket: signaturen fælder
dem, og rate-limiting (`licenseThrottle`) bremser brute force.

## Fase 0 — log-linjer + live-tail *(implementeret)*

Én `console.log` pr. udfald i `validateLicense` (fælles vej for ws-modal,
HTTP fra /tak og hostConnect):

```
[ABCD] licens: ok serial=0a1b2c3d4e packs=pack1 kilde=ws
[ABCD] licens: invalid kilde=http
[ABCD] licens: rateLimited kilde=ws
```

Principper: **koden logges aldrig** (den er hemmeligheden), kun `serialHex`;
ingen spillerdata. Ses live med `npx partykit tail` fra `apps/party-server/`.

## Fase 1 — persistent indløsnings-log *(efter partyserver-migration)*

Når serveren kører på egen Cloudflare-konto, brug **Workers Analytics Engine**
(gratis kvote rigelig, ingen ny infrastruktur, indbygget retention):

- I `validateLicense`: `env.LICENSE_AUDIT.writeDataPoint({...})` med
  - `blobs`: [serialHex, udfald, kilde, rumkode]
  - `doubles`: [timestamp]
  - `indexes`: [serialHex] ← gør "alle events for én serial" billig
- Fail-open: skrivningen må aldrig kunne vælte indløsningen (`try/catch`).
- Alternativ hvis Analytics Engine skuffer: en lille D1-tabel
  `redemptions(serial_hex, room_code, outcome, source, ts)` — mere
  fleksible queries, men kræver migrations og oprydning.

**GDPR/dataminimering:** gem aldrig IP rå — er kilde-IP nødvendig for at
skelne "samme husstand" fra "50 fremmede", så gem `HMAC(secret, ip)`
trunkeret til 8 hex-tegn. Retention: 90 dage er nok til mønstergenkendelse.

## Fase 2 — forespørgsel og alarm

1. **CLI** (`scripts/audit-license.ts`, samme stil som reissue/gavekode-CLI):
   `pnpm audit-license <serialHex>` → antal indløsninger, distinkte rum,
   distinkte IP-hashes, første/sidste set. Query mod Analytics Engine
   SQL-API med et API-token i env.
2. **Ugentlig tærskel-alarm** (cron-worker eller GitHub Action):
   serial med > N distinkte IP-hashes på 7 dage (start: N=10) → mail via
   Resend til help@dystn.app med serialHex og tal.
3. **Reaktion** er allerede bygget: læg serialHex i `LICENSE_DENYLIST`,
   genudsted til legitim køber med `scripts/reissue-license.ts`.

## Bevidst fravalgt

- **Stateful indløsning** (server nægter kode nr. N+1): straffer legitime
  kunder med mange enheder, kræver delt state på den varme sti, og løser et
  problem, vi endnu ikke har set. Genovervej kun ved dokumenteret misbrug.
- **Ekstern log-tjeneste** (Axiom m.fl.): endnu en leverandør og API-nøgle
  for noget, Cloudflare giver os gratis efter migrationen.

## Rækkefølge og estimat

| Trin | Afhænger af | Estimat |
|---|---|---|
| Fase 0: log-linjer | — | gjort |
| Fase 1: Analytics Engine-writes | partyserver-migration | ~½ dag |
| Fase 2: CLI + alarm | Fase 1 | ~1 dag |

# Festspil

Danske party-spil til stuen — én skærm er vært (TV/computer), alle spiller med på telefonen. Ingen login, ingen app: værten viser en rumkode/QR, spillerne joiner i browseren.

**Spil:** Blitz (skriv sjove svar, stem), Fusk (bluff det rigtige svar), Scrawl (tegn og gæt), Morph (telefonleg med tegninger), Surge (sandt/falsk-kapløb), Hunch (gæt positionen på et spektrum).

## Arkitektur

Turborepo + pnpm monorepo:

```
apps/
  web/           Vite + React + TypeScript-klient (host- og spillerskærme)
  party-server/  PartyKit-server — én Durable Object pr. rum, server-autoritativ state
packages/
  ui/            Delte komponenter (CountdownTimer m.fl.)
  game-engine/   (legacy)
  shared-types/  (legacy)
```

Nøglebegreber:

- **Server-autoritativ state**: al spiltilstand bor i `apps/party-server/src/server.ts` (én DO pr. rum). Klienten sender beskeder og modtager filtrerede snapshots.
- **Identitet**: spillere identificeres via `sessionId` (UUID i localStorage pr. rum, `festspil_session_<KODE>`); klienten forbinder med `new PartySocket({ id: sessionId })`, så `conn.id === sessionId` på serveren. Værten autoriseres via `hostSecret` (localStorage) og `hostConnect`.
- **Spil-plugins**: hvert spil registrerer `GameHandlers` (server, `src/games/<spil>.ts`) og lazy-loadede fasekomponenter (klient, `src/games/<spil>/`). `filterForPlayer` skjuler hemmeligheder pr. modtager.
- **Timere**: `room.storage.setAlarm` + `onAlarm`; state persisteres i DO storage ved hver broadcast, så redeploys ikke nulstiller igangværende spil.
- **Danske strenge**: hardcodet i `apps/web/src/lib/da.ts`.

## Udvikling

```bash
pnpm install
pnpm dev          # starter web (5173) + party-server (1999) via turbo
pnpm typecheck
pnpm --filter @festspil/party-server validate-prompts   # validér prompt-JSON
pnpm --filter @festspil/web exec playwright test        # e2e (kræver browsere installeret)
```

## Miljøvariabler

| Variabel | Hvor | Beskrivelse |
| --- | --- | --- |
| `VITE_PARTY_HOST` | web (build) | PartyKit-host, fx `festspil.<bruger>.partykit.dev`. **Påkrævet i prod** — builden fejler højlydt uden. |
| `VITE_HOST_PASSPHRASE` | web (build) | Valgfrit kodeord for at oprette rum (gate på landing page). |
| `VITE_SENTRY_DSN` | web (build) | Valgfri Sentry-fejlrapportering. |
| `VITE_SENTRY_RELEASE` | web (build) | Valgfrit release-navn til Sentry. |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | CI/build | Sourcemap-upload (slås fra uden token; `*.map` slettes efter upload). |

## Deploy

- **Web**: statisk build (`pnpm --filter @festspil/web build`) til Vercel/Cloudflare Pages. Husk `VITE_PARTY_HOST`.
- **Server**: `npx partykit deploy` fra `apps/party-server/`.

## Dokumentation

`docs/handoff-*.md` beskriver launch-review-arbejdet (juli 2026). Øvrige filer i `docs/` er historiske analyser fra tidligere faser (bl.a. fra dengang backend var Convex og spillene hed Duel/Bluff/Sandhed/Tegn) — læs dem som baggrund, ikke som gældende arkitektur.

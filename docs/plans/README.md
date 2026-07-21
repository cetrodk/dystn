# Playtest-opfølgning 14.07.2026 — seks PR'er

Disse planer udspringer af [`docs/playtest-2026-07-14.md`](../playtest-2026-07-14.md)
(det fulde review med alle 22 punkter, prioriteter og de udskudte spørgsmål).

Hver plan er **selvstændig**: den kan læses og udføres uden at kende de andre og uden
den samtale, der skabte den. Læs kun den plan, du skal udføre — plus dette dokument.

## Rækkefølge og afhængigheder

| # | Plan | Område | Prioritet | Afhænger af |
|---|---|---|---|---|
| 1 | [Surge: runden slutter for tidligt](./pr1-surge-auto-advance.md) | server | **P0** | — |
| 2 | [Scrawl: "hund" ≠ "en hund"](./pr2-scrawl-guess-matching.md) | server | **P0** | — |
| 3 | [Scrawl: timeren beskæres på værtsskærmen](./pr3-scrawl-host-layout.md) | web | P1 | — |
| 4 | [Join-skærm og avatar-polish](./pr4-join-and-avatar-polish.md) | web | P1 | — |
| 5 | [Rumkoden altid tilgængelig](./pr5-room-code-always-visible.md) | web | **P0** | — |
| 6 | [Tekstkorrektur af `da.ts`](./pr6-copy-pass.md) | tekst | P2 | tag som den sidste |

De seks er bevidst uafhængige og rører forskellige filer — de kan i princippet laves
parallelt. **Undtagelse:** PR 6 rører `apps/web/src/lib/da.ts`, som PR 4 og PR 5 muligvis
også tilføjer strenge til. Tag derfor PR 6 til sidst, så korrekturen også dækker de nye
strenge.

**Hvorfor delt op:** PR 1 rører den *delte* spilmotor — auto-fremdrift gælder alle seks
spil. Går noget galt, skal netop den ændring kunne rulles tilbage uden at tage
CSS-rettelser og en tekstkorrektur med sig. Server og frontend holdes derfor adskilt.

## Fælles konventioner

**Stak:** Turborepo + pnpm. `apps/web` (Vite + React + TS + Tailwind v4 + Framer Motion),
`apps/party-server` (PartyKit, WebSocket, server-autoritativ), `packages/{game-engine,
shared-types,ui,typescript-config}`.

**Sprog:** Al brugervendt tekst er dansk og ligger i `apps/web/src/lib/da.ts`.
Serverens fejlbeskeder er dansk og står i handler-koden. Kodekommentarer er blandet
dansk/engelsk — skriv i samme stil som filen, du redigerer. Hardkod aldrig nye danske
strenge i komponenter; læg dem i `da.ts`.

**Branch:** én branch pr. plan, navnet står i planen. Base: `main`.

**Commits:** conventional commits på dansk, som i historikken:
`fix(server): surge-runder slutter ikke længere før tiden`,
`feat(web): rumkode og QR tilgængelig under spil`.
Afslut commit-beskeden med:

```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

**Kvalitetsporte — kør ALTID før commit:**

```bash
pnpm typecheck          # turbo: alle pakker
pnpm lint               # turbo: eslint
pnpm --filter @dystn/party-server test    # vitest (kun server)
```

Serverens tests ligger i `apps/party-server/test/*.test.ts` (vitest).
`apps/web` har ingen unit-tests, men har Playwright-e2e i `apps/web/e2e/`.
Der findes i dag **ingen tests af spil-logikken** — PR 1 og PR 2 lægger de første.

**Verificér i den kørende app, ikke kun i tests.** `pnpm dev` starter både web og
party-server. Værtsskærmen er `/host/<KODE>`, spilleren joiner på `/` eller `/<KODE>`.
Der findes en simulator på `/simulator` (`apps/web/src/pages/SimulatorPage.tsx`) og en
tegne-testside på `/drawtest` — brug dem, hvor de sparer tid.

**PR:** åbn med `gh pr create --base main`. Beskriv problemet, årsagen og hvordan det er
verificeret. Afslut PR-teksten med:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Uden for planerne

Følgende punkter fra reviewet er **udskudt** og må ikke løses her — de kræver en
beslutning fra Morten først: lobbyens struktur, tilbage-pilens semantik, antal
avatar-dele (om ekstra dele skal være en købsanledning), antal runder, lyd-hakket,
den tomme Scrawl-tegning, malerbøtten og cast-til-TV. Se den udskudte tabel nederst i
[reviewet](../playtest-2026-07-14.md).

Møder du et af dem undervejs: rør det ikke, men noter det i PR-beskrivelsen.

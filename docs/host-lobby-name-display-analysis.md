# Analyse: Navnevisning i host-lobbyens sædekort

**Dato:** 2026-07-13
**Anledning:** Lange spillernavne afkortes med "…" i host-lobbyens sæde-gitter
(fx "Wolfeschlegelste" → "Wolf…"). Undersøgelse af den bedste løsning for at
vise hele navnet.

## Baggrund

- Afkortningen kommer fra `truncate`-klassen på navnet i sædekortet
  (`apps/web/src/pages/HostView.tsx`, `PlayerSlots`). Den blev indført med
  warm-editorial-redesignet d. 2026-07-05 (commit `bc2eb40`) og er uafhængig
  af blob-avatar-arbejdet.
- Telefon-lobbyen (spillerens egen skærm) viser altid det fulde navn — også
  ved maks-længden på 16 tegn. Problemet findes kun på host-skærmen.
- Navne må være op til 16 tegn (server-trim i `handleJoin`).

## Målinger (kørende app, 1920×1080 "TV"-viewport)

| Størrelse | Målt |
|---|---|
| Spillerkolonne | 340 px — hårdkodet `w-[340px]`, skalerer ikke med skærmen |
| Sædekort (2 kolonner) | 165 px |
| Fast indhold i kortet | 104 px (avatar 36 + ✕-knap 24 + gaps/padding 44) |
| Plads til navnet | **55 px** |
| Fuldt 16-tegns navn (Fraunces 900, 16 px) | **135 px** |

Konklusion af målingerne: navnet kan **aldrig** stå på én linje i det
nuværende kort — der mangler 80 px, og det faste indhold dominerer kortet.

## Afprøvede varianter (prototypet i DOM'en)

| Variant | Måling | Dom |
|---|---|---|
| A. Mindre skrift, én linje | 16 tegn kræver ~6,5 px skrift i 55 px | ❌ Ulæseligt på TV-afstand |
| B. To linjer + behold ✕ + text-sm | Kræver 118 px, kapacitet 2×55 = 110 px | ❌ Fejler stadig |
| C. Bredere kolonne (480 px), én linje | Navn får 125 px, kræver 135 px | ❌ Fejler marginalt |
| **D. ✕ som hjørne-badge + op til to linjer** | Kapacitet 2×89 = 178 px ≥ 135 px | ✅ **Fuld 16 px skrift** |

## Anbefaling (variant D)

To små ændringer i `PlayerSlots` i `apps/web/src/pages/HostView.tsx`:

1. **✕-knappen flyttes til kortets hjørne** som absolut positioneret badge
   (`absolute -top-2 -right-2` + `bg-[var(--color-paper)]`). Den koster
   dermed 0 px i rækken og matcher det neo-brutalistiske "sticker"-udtryk.
   Knappen forbliver altid synlig og klikbar (ingen hover-afhængighed —
   host-skærmen kan være touch/TV).
2. **Navnet må ombryde til maks. to linjer**: erstat `truncate` med
   `line-clamp-2` + `[overflow-wrap:anywhere]` og en strammere
   `leading-tight`. Navne op til ~11 tegn står uændret på én linje; kun de
   lange ombryder.

Resultat: "Wolfeschlegelste" vises fuldt læsbart over to linjer
("Wolfeschle / gelste") i fuld skriftstørrelse.

**Kendt trade-off:** Et to-linjes kort bliver ~18 px højere end naboerne i
samme grid-række. Det så organisk ud i prototypen; alternativt kan alle kort
gives en fast min-højde svarende til to linjer, så gitteret forbliver stramt.

**Valgfri bonus (uafhængig):** Spillerkolonnens 340 px er dimensioneret til
små skærme; på 1920 px står ~2/3 af skærmen tom. En responsiv bredde
(fx `xl:w-[440px]`) giver alle kort mere luft, men er ikke nødvendig for
navneproblemet.

## Fravalgte tilgange

- **Dynamisk skriftstørrelse efter navnelængde** — matematikken går ikke op
  (variant A); selv 11-12 px kræver mere plads end rækken har.
- **✕ kun ved hover** — frigiver samme plads som badge-løsningen, men fejler
  på touch-skærme og kræver at hosten "opdager" knappen.
- **Kortere navnegrænse ved join** (16 → 10 tegn, som design-mockuppen) —
  løser det ikke alene (10 tegn @ 16 px ≈ 84 px > 55 px) og ændrer
  produktadfærd. Kan evt. kombineres med variant D senere.

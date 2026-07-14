import { da } from "@/lib/da";

// Fælles spilregistry: id, gratis/pakke-tier, farver samt navn/beskrivelse
// fra da. Afhængighedsfrit modul, så både GamePicker (der lægger ikoner
// oveni) og den lazy-loadede /om-side kan bruge samme liste uden at trække
// lucide/embla med i chunken. Gratis-spillene står FØRST — de betalte
// samles bag pakkekortet, når pakken ikke er låst op (positiv framing,
// ikke fire hængelåse).
export const GAMES = [
  {
    id: "blitz",
    pack: "free",
    ...da.blitz,
    color: "var(--color-blitz)",
    glow: "var(--color-blitz-glow)",
    textColor: "#fff",
  },
  {
    id: "scrawl",
    pack: "free",
    ...da.scrawl,
    color: "var(--color-scrawl)",
    glow: "var(--color-scrawl-glow)",
    textColor: "#fff",
  },
  {
    id: "fusk",
    pack: "pack1",
    ...da.fusk,
    color: "var(--color-fusk)",
    glow: "var(--color-fusk-glow)",
    textColor: "#0d0b1a",
  },
  {
    id: "morph",
    pack: "pack1",
    ...da.morph,
    color: "var(--color-morph)",
    glow: "var(--color-morph-glow)",
    textColor: "#0d0b1a",
  },
  {
    id: "surge",
    pack: "pack1",
    ...da.surge,
    color: "var(--color-surge)",
    glow: "var(--color-surge-glow)",
    textColor: "#fff",
  },
  {
    id: "hunch",
    pack: "pack1",
    ...da.hunch,
    color: "var(--color-hunch)",
    glow: "var(--color-hunch-glow)",
    textColor: "#0d0b1a",
  },
] as const;

export type GameInfo = (typeof GAMES)[number];

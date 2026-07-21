import { describe, expect, it } from "vitest";
import { isEffectivelySameWord, levenshtein, normalizeText } from "../src/text";

describe("normalizeText", () => {
  it("fjerner en indledende artikel", () => {
    expect(normalizeText("en hund")).toBe("hund");
    expect(normalizeText("Et Hus")).toBe("hus");
    expect(normalizeText("den store hund")).toBe("store hund");
  });

  it("normaliserer kasus, tegnsætning og whitespace", () => {
    expect(normalizeText("hund!")).toBe("hund");
    expect(normalizeText("  hund  ")).toBe("hund");
    expect(normalizeText("HUND")).toBe("hund");
  });

  it("fjerner kun artiklen, hvis der står noget efter den", () => {
    expect(normalizeText("en")).toBe("en");
  });

  it("fjerner kun hele ord, ikke præfikser", () => {
    expect(normalizeText("endestation")).toBe("endestation");
  });

  it("æ/ø/å overlever", () => {
    expect(normalizeText("en ål")).toBe("ål");
    expect(normalizeText("BLÅBÆRGRØD")).toBe("blåbærgrød");
  });
});

describe("levenshtein", () => {
  it("regner standardafstande", () => {
    expect(levenshtein("hund", "hund")).toBe(0);
    expect(levenshtein("hund", "hunde")).toBe(1);
    expect(levenshtein("kat", "kap")).toBe(1);
    expect(levenshtein("cykel", "bil")).toBe(4);
  });

  it("afkorter ved max", () => {
    expect(levenshtein("cykel", "bil", 1)).toBeGreaterThan(1);
  });
});

describe("isEffectivelySameWord", () => {
  it("artikel-varianter er samme ord", () => {
    expect(isEffectivelySameWord("hund", "en hund")).toBe(true);
    expect(isEffectivelySameWord("En Hund!", "en hund")).toBe(true);
  });

  it("én tastefejl tæller som samme ord ved ≥ 6 tegn", () => {
    expect(isEffectivelySameWord("guitarr", "en guitar")).toBe(true);
    expect(isEffectivelySameWord("flamigo", "en flamingo")).toBe(true);
  });

  it("korte ord får ingen tastefejls-nåde", () => {
    expect(isEffectivelySameWord("kat", "kap")).toBe(false);
    // "cykel" er kun 5 tegn — tastefejls-nåden gælder ikke under 6
    expect(isEffectivelySameWord("cykl", "en cykel")).toBe(false);
  });

  it("forskellige ord er forskellige", () => {
    expect(isEffectivelySameWord("hus", "en hund")).toBe(false);
    expect(isEffectivelySameWord("en kat", "en hund")).toBe(false);
  });
});

/**
 * Prompt Validation Script
 *
 * Run with: npx tsx src/games/prompts/validate.ts
 *
 * Validates all prompt data across all games:
 *  - Schema validation (types, required fields)
 *  - Duplicate detection (exact + near-duplicate text)
 *  - Balance reporting (counts per category)
 *  - Cross-game overlap detection
 */

import { duelPrompts, bluffPrompts, tegnPrompts, sandhedPrompts, getPromptStats } from "./loader";

let errors = 0;
let warnings = 0;

function error(msg: string) {
  console.error(`  ERROR: ${msg}`);
  errors++;
}

function warn(msg: string) {
  console.warn(`  WARN:  ${msg}`);
  warnings++;
}

function info(msg: string) {
  console.log(`  ${msg}`);
}

// ── Duplicate detection ─────────────────────────────────────────────

function findDuplicates(texts: string[], label: string) {
  const seen = new Map<string, number>();
  for (let i = 0; i < texts.length; i++) {
    const key = texts[i].toLowerCase().trim();
    const prev = seen.get(key);
    if (prev !== undefined) {
      error(`${label}: duplicate at index ${i} and ${prev}: "${texts[i]}"`);
    }
    seen.set(key, i);
  }
}

// ── Duel ────────────────────────────────────────────────────────────

console.log("\n=== DUEL ===");
info(`Total prompts: ${duelPrompts.length}`);

findDuplicates(duelPrompts, "duel");

for (let i = 0; i < duelPrompts.length; i++) {
  const p = duelPrompts[i];
  if (p.length > 280) {
    error(`duel[${i}]: prompt exceeds 280 chars (${p.length}): "${p.slice(0, 50)}..."`);
  }
  if (p.length < 10) {
    warn(`duel[${i}]: prompt seems too short (${p.length} chars): "${p}"`);
  }
}

// ── Bluff ───────────────────────────────────────────────────────────

console.log("\n=== BLUFF ===");
info(`Total prompts: ${bluffPrompts.length}`);

findDuplicates(
  bluffPrompts.map((p) => p.text),
  "bluff (text)",
);
findDuplicates(
  bluffPrompts.map((p) => p.answer),
  "bluff (answer)",
);

for (let i = 0; i < bluffPrompts.length; i++) {
  const p = bluffPrompts[i];
  if (!p.text.includes("___")) {
    error(`bluff[${i}]: missing ___ blank in: "${p.text}"`);
  }
  const blanks = (p.text.match(/___/g) ?? []).length;
  if (blanks > 1) {
    warn(`bluff[${i}]: multiple ___ blanks (${blanks}) in: "${p.text}"`);
  }
  if (p.answer.length > 80) {
    warn(`bluff[${i}]: answer exceeds 80 chars (${p.answer.length}): "${p.answer}"`);
  }
}

// ── Tegn ────────────────────────────────────────────────────────────

console.log("\n=== TEGN ===");
info(`Total prompts: ${tegnPrompts.length}`);

findDuplicates(
  tegnPrompts.map((p) => p.text),
  "tegn",
);

const tegnByCategory = { "1": 0, "2": 0, "3": 0 };
for (const p of tegnPrompts) {
  tegnByCategory[p.category]++;
}
info(`Category distribution: easy=${tegnByCategory["1"]}, medium=${tegnByCategory["2"]}, hard=${tegnByCategory["3"]}`);

if (tegnByCategory["1"] < 15) warn("Category 1 (simple) has fewer than 15 prompts");
if (tegnByCategory["2"] < 15) warn("Category 2 (scene) has fewer than 15 prompts");
if (tegnByCategory["3"] < 15) warn("Category 3 (surreal) has fewer than 15 prompts");

// ── Sandhed ─────────────────────────────────────────────────────────

console.log("\n=== SANDHED ===");
info(`Total prompts: ${sandhedPrompts.length}`);

findDuplicates(
  sandhedPrompts.map((p) => p.text),
  "sandhed",
);

const sandhedByCategory = { "1": 0, "2": 0, "3": 0 };
const sandhedTrueCount = { "1": 0, "2": 0, "3": 0 };
for (const p of sandhedPrompts) {
  sandhedByCategory[p.category]++;
  if (p.answer === "true") sandhedTrueCount[p.category]++;
}

for (const cat of ["1", "2", "3"] as const) {
  const total = sandhedByCategory[cat];
  const trueCount = sandhedTrueCount[cat];
  const falseCount = total - trueCount;
  const truePercent = total > 0 ? Math.round((trueCount / total) * 100) : 0;
  info(`Category ${cat}: ${total} total, ${trueCount} true / ${falseCount} false (${truePercent}% true)`);
  if (truePercent > 75) warn(`Category ${cat}: too many 'true' answers (${truePercent}%) — game becomes predictable`);
  if (truePercent < 25) warn(`Category ${cat}: too many 'false' answers (${100 - truePercent}%) — game becomes predictable`);
}

// ── Cross-game overlap ──────────────────────────────────────────────

console.log("\n=== CROSS-GAME OVERLAP ===");

const bluffFacts = new Set(bluffPrompts.map((p) => p.text.toLowerCase()));
const sandhedFacts = new Set(sandhedPrompts.map((p) => p.text.toLowerCase()));

// Check if Bluff answers appear as Sandhed statements (topic overlap)
for (const bp of bluffPrompts) {
  for (const sp of sandhedPrompts) {
    // Simple keyword overlap check: if >50% of words overlap
    const bWords = new Set(bp.text.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    const sWords = new Set(sp.text.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    const overlap = [...bWords].filter((w) => sWords.has(w));
    if (overlap.length >= 3 && overlap.length >= bWords.size * 0.5) {
      warn(`Cross-game overlap: bluff "${bp.text.slice(0, 50)}..." ↔ sandhed "${sp.text.slice(0, 50)}..."`);
    }
  }
}

// ── Summary ─────────────────────────────────────────────────────────

console.log("\n=== SUMMARY ===");
const stats = getPromptStats();
for (const [game, s] of Object.entries(stats)) {
  info(`${game}: ${s.total} prompts from versions [${s.versions.join(", ")}]`);
}
console.log(`\n  ${errors} error(s), ${warnings} warning(s)`);

if (errors > 0) {
  process.exit(1);
}

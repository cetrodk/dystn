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

import { blitzPrompts, fuskPrompts, scrawlPrompts, surgePrompts, hunchPrompts, getPromptStats } from "./loader";

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

console.log("\n=== BLITZ ===");
info(`Total prompts: ${blitzPrompts.length}`);

findDuplicates(blitzPrompts, "blitz");

for (let i = 0; i < blitzPrompts.length; i++) {
  const p = blitzPrompts[i];
  if (p.length > 280) {
    error(`blitz[${i}]: prompt exceeds 280 chars (${p.length}): "${p.slice(0, 50)}..."`);
  }
  if (p.length < 10) {
    warn(`blitz[${i}]: prompt seems too short (${p.length} chars): "${p}"`);
  }
}

// ── Bluff ───────────────────────────────────────────────────────────

console.log("\n=== FUSK ===");
info(`Total prompts: ${fuskPrompts.length}`);

findDuplicates(
  fuskPrompts.map((p) => p.text),
  "fusk (text)",
);
findDuplicates(
  fuskPrompts.map((p) => p.answer),
  "fusk (answer)",
);

for (let i = 0; i < fuskPrompts.length; i++) {
  const p = fuskPrompts[i];
  if (!p.text.includes("___")) {
    error(`fusk[${i}]: missing ___ blank in: "${p.text}"`);
  }
  const blanks = (p.text.match(/___/g) ?? []).length;
  if (blanks > 1) {
    warn(`fusk[${i}]: multiple ___ blanks (${blanks}) in: "${p.text}"`);
  }
  if (p.answer.length > 80) {
    warn(`fusk[${i}]: answer exceeds 80 chars (${p.answer.length}): "${p.answer}"`);
  }
}

// ── Tegn ────────────────────────────────────────────────────────────

console.log("\n=== SCRAWL ===");
info(`Total prompts: ${scrawlPrompts.length}`);

findDuplicates(
  scrawlPrompts.map((p) => p.text),
  "scrawl",
);

const scrawlByCategory = { "1": 0, "2": 0, "3": 0 };
for (const p of scrawlPrompts) {
  scrawlByCategory[p.category]++;
}
info(`Category distribution: easy=${scrawlByCategory["1"]}, medium=${scrawlByCategory["2"]}, hard=${scrawlByCategory["3"]}`);

if (scrawlByCategory["1"] < 15) warn("Category 1 (simple) has fewer than 15 prompts");
if (scrawlByCategory["2"] < 15) warn("Category 2 (scene) has fewer than 15 prompts");
if (scrawlByCategory["3"] < 15) warn("Category 3 (surreal) has fewer than 15 prompts");

// ── Sandhed ─────────────────────────────────────────────────────────

console.log("\n=== SURGE ===");
info(`Total prompts: ${surgePrompts.length}`);

findDuplicates(
  surgePrompts.map((p) => p.text),
  "surge",
);

const surgeByCategory = { "1": 0, "2": 0, "3": 0 };
const surgeTrueCount = { "1": 0, "2": 0, "3": 0 };
for (const p of surgePrompts) {
  surgeByCategory[p.category]++;
  if (p.answer === "true") surgeTrueCount[p.category]++;
}

for (const cat of ["1", "2", "3"] as const) {
  const total = surgeByCategory[cat];
  const trueCount = surgeTrueCount[cat];
  const falseCount = total - trueCount;
  const truePercent = total > 0 ? Math.round((trueCount / total) * 100) : 0;
  info(`Category ${cat}: ${total} total, ${trueCount} true / ${falseCount} false (${truePercent}% true)`);
  if (truePercent > 75) warn(`Category ${cat}: too many 'true' answers (${truePercent}%) — game becomes predictable`);
  if (truePercent < 25) warn(`Category ${cat}: too many 'false' answers (${100 - truePercent}%) — game becomes predictable`);
}

// ── Hunch ───────────────────────────────────────────────────────────

console.log("\n=== HUNCH ===");
info(`Total prompts: ${hunchPrompts.length}`);

findDuplicates(
  hunchPrompts.map((p) => `${p.leftLabel}|${p.rightLabel}`),
  "hunch (leftLabel|rightLabel)",
);

if (hunchPrompts.length < 15) {
  warn(`Hunch has fewer than 15 cards (${hunchPrompts.length}) — prompts repeat quickly across rounds`);
}

for (let i = 0; i < hunchPrompts.length; i++) {
  const p = hunchPrompts[i];
  if (!p.leftLabel?.trim() || !p.rightLabel?.trim()) {
    error(`hunch[${i}]: empty leftLabel/rightLabel`);
  }
}

// ── Cross-game overlap ──────────────────────────────────────────────

console.log("\n=== CROSS-GAME OVERLAP ===");

const fuskFacts = new Set(fuskPrompts.map((p) => p.text.toLowerCase()));
const surgeFacts = new Set(surgePrompts.map((p) => p.text.toLowerCase()));

// Check if Bluff answers appear as Sandhed statements (topic overlap)
for (const bp of fuskPrompts) {
  for (const sp of surgePrompts) {
    // Simple keyword overlap check: if >50% of words overlap
    const bWords = new Set(bp.text.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    const sWords = new Set(sp.text.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    const overlap = [...bWords].filter((w) => sWords.has(w));
    if (overlap.length >= 3 && overlap.length >= bWords.size * 0.5) {
      warn(`Cross-game overlap: fusk "${bp.text.slice(0, 50)}..." ↔ surge "${sp.text.slice(0, 50)}..."`);
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

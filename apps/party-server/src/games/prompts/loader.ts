/**
 * Prompt Loader — versioned question system
 *
 * Each game has its own directory under prompts/ with:
 *   - manifest.json  → declares which versions are active
 *   - v1.json, v2.json, ...  → prompt data files
 *
 * The loader eagerly imports all version files for each game at module load,
 * merges the active versions declared in the manifest, and validates each entry.
 *
 * To add questions:  create a new vN.json file, add "vN" to manifest.activeVersions
 * To remove a batch: remove its version string from activeVersions
 * To replace:        create a new version, remove the old one from activeVersions
 */

import type {
  BluffPrompt,
  DuelPrompt,
  GameName,
  OrdklapPrompt,
  PromptManifest,
  SandhedPrompt,
  TegnPrompt,
} from "./types";

import duelManifest from "./duel/manifest.json";
import bluffManifest from "./bluff/manifest.json";
import tegnManifest from "./tegn/manifest.json";
import sandhedManifest from "./sandhed/manifest.json";
import ordklapManifest from "./ordklap/manifest.json";

// Add new version imports here, then register in the version map below
import duelV1 from "./duel/v1.json";
import bluffV1 from "./bluff/v1.json";
import tegnV1 from "./tegn/v1.json";
import sandhedV1 from "./sandhed/v1.json";
import ordklapV1 from "./ordklap/v1.json";

const duelVersions: Record<string, unknown[]> = { v1: duelV1 };
const bluffVersions: Record<string, unknown[]> = { v1: bluffV1 };
const tegnVersions: Record<string, unknown[]> = { v1: tegnV1 };
const sandhedVersions: Record<string, unknown[]> = { v1: sandhedV1 };
const ordklapVersions: Record<string, unknown[]> = { v1: ordklapV1 };

const manifests: Record<GameName, PromptManifest> = {
  duel: duelManifest as PromptManifest,
  bluff: bluffManifest as PromptManifest,
  tegn: tegnManifest as PromptManifest,
  sandhed: sandhedManifest as PromptManifest,
  ordklap: ordklapManifest as PromptManifest,
};

function validateDuelPrompt(entry: unknown, index: number, version: string): DuelPrompt {
  if (typeof entry !== "string" || entry.trim().length === 0) {
    throw new Error(`duel/${version}.json[${index}]: expected non-empty string, got ${typeof entry}`);
  }
  return entry;
}

function validateBluffPrompt(entry: unknown, index: number, version: string): BluffPrompt {
  const e = entry as Record<string, unknown>;
  if (!e || typeof e.text !== "string" || typeof e.answer !== "string") {
    throw new Error(`bluff/${version}.json[${index}]: must have string 'text' and 'answer'`);
  }
  if (!e.text.includes("___")) {
    throw new Error(`bluff/${version}.json[${index}]: text must contain '___' blank: "${e.text}"`);
  }
  if (e.answer.trim().length === 0) {
    throw new Error(`bluff/${version}.json[${index}]: answer must not be empty`);
  }
  return { text: e.text, answer: e.answer };
}

function validateTegnPrompt(entry: unknown, index: number, version: string): TegnPrompt {
  const e = entry as Record<string, unknown>;
  if (!e || typeof e.text !== "string" || typeof e.category !== "string") {
    throw new Error(`tegn/${version}.json[${index}]: must have string 'text' and 'category'`);
  }
  if (!["1", "2", "3"].includes(e.category)) {
    throw new Error(`tegn/${version}.json[${index}]: category must be "1", "2", or "3", got "${e.category}"`);
  }
  if (e.text.trim().length === 0) {
    throw new Error(`tegn/${version}.json[${index}]: text must not be empty`);
  }
  return { text: e.text, category: e.category as "1" | "2" | "3" };
}

function validateSandhedPrompt(entry: unknown, index: number, version: string): SandhedPrompt {
  const e = entry as Record<string, unknown>;
  if (!e || typeof e.text !== "string" || typeof e.answer !== "string" || typeof e.category !== "string") {
    throw new Error(`sandhed/${version}.json[${index}]: must have string 'text', 'answer', and 'category'`);
  }
  if (!["true", "false"].includes(e.answer)) {
    throw new Error(`sandhed/${version}.json[${index}]: answer must be "true" or "false", got "${e.answer}"`);
  }
  if (!["1", "2", "3"].includes(e.category)) {
    throw new Error(`sandhed/${version}.json[${index}]: category must be "1", "2", or "3", got "${e.category}"`);
  }
  return { text: e.text, answer: e.answer as "true" | "false", category: e.category as "1" | "2" | "3" };
}

function loadVersions<T>(
  manifest: PromptManifest,
  versions: Record<string, unknown[]>,
  validate: (entry: unknown, index: number, version: string) => T,
): T[] {
  const result: T[] = [];

  for (const versionName of manifest.activeVersions) {
    const data = versions[versionName];
    if (!data) {
      throw new Error(
        `${manifest.game}: manifest references version "${versionName}" but no data found. ` +
        `Available: ${Object.keys(versions).join(", ")}`,
      );
    }
    for (let i = 0; i < data.length; i++) {
      result.push(validate(data[i], i, versionName));
    }
  }

  if (result.length === 0) {
    throw new Error(
      `${manifest.game}: no prompts loaded from active versions [${manifest.activeVersions.join(", ")}]`,
    );
  }

  return result;
}

export const duelPrompts: DuelPrompt[] = loadVersions(manifests.duel, duelVersions, validateDuelPrompt);
export const bluffPrompts: BluffPrompt[] = loadVersions(manifests.bluff, bluffVersions, validateBluffPrompt);
export const tegnPrompts: TegnPrompt[] = loadVersions(manifests.tegn, tegnVersions, validateTegnPrompt);
export const sandhedPrompts: SandhedPrompt[] = loadVersions(manifests.sandhed, sandhedVersions, validateSandhedPrompt);

function validateOrdklapPrompt(entry: unknown, index: number, version: string): OrdklapPrompt {
  const e = entry as Record<string, unknown>;
  if (!e || typeof e.leftLabel !== "string" || typeof e.rightLabel !== "string" || typeof e.category !== "string") {
    throw new Error(`ordklap/${version}.json[${index}]: must have string 'leftLabel', 'rightLabel', and 'category'`);
  }
  if (e.leftLabel.trim().length === 0 || e.rightLabel.trim().length === 0) {
    throw new Error(`ordklap/${version}.json[${index}]: labels must not be empty`);
  }
  return { leftLabel: e.leftLabel, rightLabel: e.rightLabel, category: e.category };
}

export const ordklapPrompts: OrdklapPrompt[] = loadVersions(manifests.ordklap, ordklapVersions, validateOrdklapPrompt);

export function getPromptStats(): Record<GameName, { total: number; versions: string[] }> {
  return {
    duel: { total: duelPrompts.length, versions: manifests.duel.activeVersions },
    bluff: { total: bluffPrompts.length, versions: manifests.bluff.activeVersions },
    tegn: { total: tegnPrompts.length, versions: manifests.tegn.activeVersions },
    sandhed: { total: sandhedPrompts.length, versions: manifests.sandhed.activeVersions },
    ordklap: { total: ordklapPrompts.length, versions: manifests.ordklap.activeVersions },
  };
}

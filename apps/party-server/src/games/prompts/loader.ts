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
  FuskPrompt,
  BlitzPrompt,
  GameName,
  HunchPrompt,
  PromptManifest,
  SurgePrompt,
  ScrawlPrompt,
} from "./types";

import blitzManifest from "./blitz/manifest.json";
import fuskManifest from "./fusk/manifest.json";
import scrawlManifest from "./scrawl/manifest.json";
import surgeManifest from "./surge/manifest.json";
import hunchManifest from "./hunch/manifest.json";

// Add new version imports here, then register in the version map below
import blitzV1 from "./blitz/v1.json";
import fuskV1 from "./fusk/v1.json";
import scrawlV1 from "./scrawl/v1.json";
import surgeV1 from "./surge/v1.json";
import hunchV1 from "./hunch/v1.json";

const blitzVersions: Record<string, unknown[]> = { v1: blitzV1 };
const fuskVersions: Record<string, unknown[]> = { v1: fuskV1 };
const scrawlVersions: Record<string, unknown[]> = { v1: scrawlV1 };
const surgeVersions: Record<string, unknown[]> = { v1: surgeV1 };
const hunchVersions: Record<string, unknown[]> = { v1: hunchV1 };

const manifests: Record<GameName, PromptManifest> = {
  blitz: blitzManifest as PromptManifest,
  fusk: fuskManifest as PromptManifest,
  scrawl: scrawlManifest as PromptManifest,
  surge: surgeManifest as PromptManifest,
  hunch: hunchManifest as PromptManifest,
};

function validateBlitzPrompt(entry: unknown, index: number, version: string): BlitzPrompt {
  if (typeof entry !== "string" || entry.trim().length === 0) {
    throw new Error(`blitz/${version}.json[${index}]: expected non-empty string, got ${typeof entry}`);
  }
  return entry;
}

function validateFuskPrompt(entry: unknown, index: number, version: string): FuskPrompt {
  const e = entry as Record<string, unknown>;
  if (!e || typeof e.text !== "string" || typeof e.answer !== "string") {
    throw new Error(`fusk/${version}.json[${index}]: must have string 'text' and 'answer'`);
  }
  if (!e.text.includes("___")) {
    throw new Error(`fusk/${version}.json[${index}]: text must contain '___' blank: "${e.text}"`);
  }
  if (e.answer.trim().length === 0) {
    throw new Error(`fusk/${version}.json[${index}]: answer must not be empty`);
  }
  return { text: e.text, answer: e.answer };
}

function validateScrawlPrompt(entry: unknown, index: number, version: string): ScrawlPrompt {
  const e = entry as Record<string, unknown>;
  if (!e || typeof e.text !== "string" || typeof e.category !== "string") {
    throw new Error(`scrawl/${version}.json[${index}]: must have string 'text' and 'category'`);
  }
  if (!["1", "2", "3"].includes(e.category)) {
    throw new Error(`scrawl/${version}.json[${index}]: category must be "1", "2", or "3", got "${e.category}"`);
  }
  if (e.text.trim().length === 0) {
    throw new Error(`scrawl/${version}.json[${index}]: text must not be empty`);
  }
  return { text: e.text, category: e.category as "1" | "2" | "3" };
}

function validateSurgePrompt(entry: unknown, index: number, version: string): SurgePrompt {
  const e = entry as Record<string, unknown>;
  if (!e || typeof e.text !== "string" || typeof e.answer !== "string" || typeof e.category !== "string") {
    throw new Error(`surge/${version}.json[${index}]: must have string 'text', 'answer', and 'category'`);
  }
  if (!["true", "false"].includes(e.answer)) {
    throw new Error(`surge/${version}.json[${index}]: answer must be "true" or "false", got "${e.answer}"`);
  }
  if (!["1", "2", "3"].includes(e.category)) {
    throw new Error(`surge/${version}.json[${index}]: category must be "1", "2", or "3", got "${e.category}"`);
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

export const blitzPrompts: BlitzPrompt[] = loadVersions(manifests.blitz, blitzVersions, validateBlitzPrompt);
export const fuskPrompts: FuskPrompt[] = loadVersions(manifests.fusk, fuskVersions, validateFuskPrompt);
export const scrawlPrompts: ScrawlPrompt[] = loadVersions(manifests.scrawl, scrawlVersions, validateScrawlPrompt);
export const surgePrompts: SurgePrompt[] = loadVersions(manifests.surge, surgeVersions, validateSurgePrompt);

function validateHunchPrompt(entry: unknown, index: number, version: string): HunchPrompt {
  const e = entry as Record<string, unknown>;
  if (!e || typeof e.leftLabel !== "string" || typeof e.rightLabel !== "string" || typeof e.category !== "string") {
    throw new Error(`hunch/${version}.json[${index}]: must have string 'leftLabel', 'rightLabel', and 'category'`);
  }
  if (e.leftLabel.trim().length === 0 || e.rightLabel.trim().length === 0) {
    throw new Error(`hunch/${version}.json[${index}]: labels must not be empty`);
  }
  return { leftLabel: e.leftLabel, rightLabel: e.rightLabel, category: e.category };
}

export const hunchPrompts: HunchPrompt[] = loadVersions(manifests.hunch, hunchVersions, validateHunchPrompt);

export function getPromptStats(): Record<GameName, { total: number; versions: string[] }> {
  return {
    blitz: { total: blitzPrompts.length, versions: manifests.blitz.activeVersions },
    fusk: { total: fuskPrompts.length, versions: manifests.fusk.activeVersions },
    scrawl: { total: scrawlPrompts.length, versions: manifests.scrawl.activeVersions },
    surge: { total: surgePrompts.length, versions: manifests.surge.activeVersions },
    hunch: { total: hunchPrompts.length, versions: manifests.hunch.activeVersions },
  };
}

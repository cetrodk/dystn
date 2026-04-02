# Prompt Versioning System

Each game has its own directory with versioned JSON files and a manifest.

```
prompts/
  blitz/
    manifest.json    ← declares which versions are active
    v1.json          ← original prompts
    v2.json          ← added later
  fusk/
    manifest.json
    v1.json
  ...
```

## Adding new prompts

1. Create a new file, e.g. `blitz/v2.json`, following the same schema as v1
2. Add `"v2"` to `manifest.json`'s `activeVersions` array
3. Import the file in `loader.ts` and add it to the version registry
4. Run `pnpm validate-prompts` to check for errors

## Removing prompts

Remove the version string from `manifest.json`'s `activeVersions`.
The file stays on disk for history but won't be loaded.

## Replacing prompts

Create a new version file, add it to activeVersions, remove the old version.

## Schemas

| Game    | Entry format                              |
|---------|-------------------------------------------|
| Blitz   | `string` (plain prompt)                   |
| Fusk    | `{ text: string, answer: string }`        |
| Scrawl  | `{ text: string, category: "1"\|"2"\|"3" }` |
| Surge   | `{ text: string, answer: "true"\|"false", category: "1"\|"2"\|"3" }` |
| Hunch   | `{ leftLabel: string, rightLabel: string, category: string }` |

## Validation

```bash
cd apps/party-server
pnpm validate-prompts
```

Checks: schema, duplicates, category balance, cross-game overlap.

## Adding a new version file (step-by-step)

In `loader.ts`, add:
```ts
// 1. Import
import blitzV2 from "./blitz/v2.json";

// 2. Register
const blitzVersions: Record<string, unknown[]> = {
  v1: blitzV1,
  v2: blitzV2,  // ← add here
};
```

Then in `blitz/manifest.json`:
```json
{ "activeVersions": ["v1", "v2"] }
```

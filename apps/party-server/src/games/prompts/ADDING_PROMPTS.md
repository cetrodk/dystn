# Prompt Versioning System

Each game has its own directory with versioned JSON files and a manifest.

```
prompts/
  duel/
    manifest.json    ← declares which versions are active
    v1.json          ← original prompts
    v2.json          ← added later
  bluff/
    manifest.json
    v1.json
  ...
```

## Adding new prompts

1. Create a new file, e.g. `duel/v2.json`, following the same schema as v1
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
| Duel    | `string` (plain prompt)                   |
| Bluff   | `{ text: string, answer: string }`        |
| Tegn    | `{ text: string, category: "1"\|"2"\|"3" }` |
| Sandhed | `{ text: string, answer: "true"\|"false", category: "1"\|"2"\|"3" }` |

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
import duelV2 from "./duel/v2.json";

// 2. Register
const duelVersions: Record<string, unknown[]> = {
  v1: duelV1,
  v2: duelV2,  // ← add here
};
```

Then in `duel/manifest.json`:
```json
{ "activeVersions": ["v1", "v2"] }
```

# Spike Conventions

Patterns established across the SEED-010 spike session. New spikes follow these unless the question
requires otherwise.

## Stack

- **Language/runner:** TypeScript via `npx tsx` (matches the project; no build step). Spikes are
  `.mjs`/`.ts` scripts under `.planning/spikes/NNN-name/`.
- **Spine runtimes:** 4.3 = `@esotericsoftware/spine-core`; 4.2 = `spine-core-42` (npm alias). Pick the
  module matching the rig's `skeleton.spine` version.
- **Verification:** CLI/stdout — these are *fact* spikes (data-transformation / oracle), not feel.

## Harness (the load + sample pattern)

```js
import '../../../scripts/register-esm-adapter-resolver.ts'; // MUST be first — registers the ESM
import { loadSkeleton } from '../../../src/core/loader.ts';  //   adapter resolver for tsx/ESM
import { sampleSkeleton } from '../../../src/core/sampler.ts';
```
- `loadSkeleton(path)` auto-resolves the sibling `.atlas` and picks the runtime by version.
- For a synthetic/baked JSON, pass `{ atlasPath: '<orig>.atlas' }` (math phase never reads PNGs).
- Parse at an arbitrary scale: `const sj = new Spine.SkeletonJson(new Spine.AtlasAttachmentLoader(loadSkeleton(src).atlas)); sj.scale = s; sj.readSkeletonData(json)`.

## The oracle (reusable pattern)

Cycle-safe parallel deep-compare of two parsed `SkeletonData` graphs:
- Break cycles with a `WeakSet` on the `a`-side object.
- **Skip reference keys** (`parent, bones, target, source, slot, skin, attachment, data, page, region, …`
  + `_`-prefixed variants) and **functions** — traverse only owned data (`properties, to, vertices,
  curves, frames, color, …`).
- **Exclude parse-assigned ids:** `id`, `hash`, `assetId` (recomputed per parse; not in source JSON).
- Numeric tolerance `1e-3` relative.
- Generalize array indices to `[]` for path aggregation.

## Patterns

- **Decisive sampling-free oracle:** `parse(bake(orig,s),1)` ≡ `parse(orig, SkeletonJson.scale=s)`.
  Equality ⇒ the transform *is* Spine's own scaling. Reuse for the build's regression test.
- **Authoritative spec from source:** transcribe field rules from
  `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js` (`* this.scale` reads), not from a
  value-diff (which hides `×1` cases and scaled-defaults).
- **Scaled-default injection:** fields read as `getValue(map, f, DEFAULT) * scale` with `DEFAULT ≠ 0`
  must be *injected* when absent. Known: `physics.limit` (5000), `referenceScale` (100).
- **Measurement blind spot:** `peakScale` (bone-world-scale) is invariant under a coord bake — size
  variants as `s × master_peak`, never by sampling the variant.

## Tools & Libraries

- `@esotericsoftware/spine-core` (4.3.x), `spine-core-42` (4.2.x) — already project deps.
- Fixtures: `fixtures/DEMON/SKINS_SPINE_V02.json` (4.3, every constraint type — the stress rig),
  `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (4.2).

# Stack Research — Spine 4.3 Dual-Runtime Addition (v1.6)

**Domain:** Electron + TypeScript + React desktop app; adding a second pinned copy of `@esotericsoftware/spine-core` (4.2.111 + 4.3.0) routed by detected skeleton version.
**Researched:** 2026-05-16
**Confidence:** HIGH (all alias / resolution / bundling claims reproduced live against the actual published 4.3.0 npm tarballs; API deltas verified against the spine-runtimes `4.3` branch CHANGELOG, NOT beta)

> Scope reminder: the existing stack (Electron 41 + electron-vite 5 + electron-builder 26, TS strict + React 19 + Tailwind v4, sharp 0.34.5, maxrects-packer 2.7.3, @tanstack/react-virtual, vitest 4) is **locked and not re-researched**. This file covers ONLY the 4.3 dual-runtime additions. Vendoring (submodule/fork) is rejected — npm publish satisfies it.

---

## Executive Verdict

**npm package-aliasing is clean and sufficient — but the alias direction must be INVERTED from the obvious one, and that inversion is load-bearing for `spine-player`.**

- ❌ Naive: keep `@esotericsoftware/spine-core` = 4.2.111, add `spine-core-43` alias = 4.3.0.
  This *works* for the `core/` math runtimes in isolation, but it **corrupts `@esotericsoftware/spine-player@4.3.0`**: spine-player's `export * from "@esotericsoftware/spine-core"` resolves the *bare* specifier to the hoisted top-level **4.2.111**, so the viewer ends up running a 4.2 skeleton runtime inside a 4.3 player/webgl renderer (split-brain). Reproduced live.
- ✅ Recommended: make **4.3.0 the canonical `@esotericsoftware/spine-core`** and alias the 4.2 copy as **`spine-core-42` = `npm:@esotericsoftware/spine-core@4.2.111`**. spine-player@4.3.0 + spine-webgl@4.3.0 then resolve their bare `spine-core` to the correct 4.3.0; the `core/` dispatcher imports the 4.2 runtime explicitly via `spine-core-42`. Reproduced live: one spine-core copy in the tree, zero nested duplicates, both type surfaces distinct under `tsc`.

**This is a SUBSEQUENT-MILESTONE additive change. No new build tooling, no submodule, no fork, no Vite plugin, no tsconfig `paths`.** The only stack changes are `package.json` dependency lines plus a v1.5.1 viewer-import refactor forced by 4.3 API removals.

---

## Recommended Stack

### Core Technologies (the dual-runtime addition)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@esotericsoftware/spine-core` | **4.3.0** (canonical name) | 4.3 skeleton/animation/constraint/physics math + slider constraint | Latest `latest` dist-tag (published 2026-05-15; no 4.3.x patch exists). Made canonical so `spine-player`/`spine-webgl` bare-resolve it correctly. Same `dist/index.js` + `dist/index.d.ts` + `"type":"module"` layout as 4.2.111 — no `exports` map, drop-in barrel import. |
| `spine-core-42` (npm alias → `@esotericsoftware/spine-core@4.2.111`) | 4.2.111 | The retained, regression-gated 4.2 runtime for the dual dispatcher | npm alias verified to install side-by-side with the canonical 4.3.0 copy; ships its own `dist/index.d.ts`; `tsc` (moduleResolution `bundler`) treats it as a fully distinct type surface (no overlap with 4.3.0) — exactly the isolation a version-routed dispatcher needs. |
| `@esotericsoftware/spine-player` | **4.3.0** | v1.5.1 Animation Viewer (`AnimationPlayerModal.tsx`) | Sibling-aligned (locked decision). `dependencies: { "@esotericsoftware/spine-webgl": "4.3.0" }` (exact) → `spine-webgl@4.3.0` → `spine-core@4.3.0` (exact). Has NO direct `spine-core` dep, so it relies on bare-specifier resolution — the reason 4.3 MUST be canonical. |
| `@esotericsoftware/spine-webgl` | 4.3.0 (transitive, auto) | Pulled in by spine-player; provides `SpinePlayer`'s renderer + re-exports the 4.3 core symbols | Not a direct dependency; appears automatically. Exact-pinned to 4.3.0 by spine-player. |

### Supporting Libraries

No new supporting libraries. The dual-runtime abstraction is a pure-TS dispatch layer inside `core/` (Layer-3 invariant preserved) — it imports the two runtimes by their two distinct module specifiers and routes by detected version. No DI container, no module-loader shim, no dynamic `import()` needed (static dual imports resolve fine — proven under vitest and Vite).

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| (existing) electron-vite 5 | Bundles main/preload/renderer + the sampler worker | **No config change needed.** `build.externalizeDeps: true` (v5 default) keeps `@esotericsoftware/spine-core` AND the `spine-core-42` alias *external* in the main/worker bundles → both resolve at runtime from `node_modules`, identically to how the single spine-core resolves today. Verified: Vite/Rollup emits the bare aliased specifier untouched. |
| (existing) vitest 4 | Headless Node tests for `core/sampler.ts` + `core/bounds.ts` | **No config change, no tsconfig `paths` needed.** Verified live: a spec importing both `@esotericsoftware/spine-core` (4.3.0) and `spine-core-42` (4.2.111) resolves both distinctly and passes under `vitest run`. |
| (existing) tsc / `moduleResolution: bundler` | Type-checks both runtimes | Verified: TS resolves the alias's own `dist/index.d.ts` by the alias *name* (`spine-core-42`) with zero `paths` config; 4.2 and 4.3 `Skeleton` types are correctly non-overlapping (compile-time dual-runtime isolation). |

---

## Installation

```bash
# 1. Make 4.3.0 the canonical spine-core (replaces the 4.2.111 line) + alias 4.2.111.
#    Run from the repo root. This rewrites the two dependency lines in package.json.
npm install @esotericsoftware/spine-core@4.3.0 \
            spine-core-42@npm:@esotericsoftware/spine-core@4.2.111

# 2. Bump spine-player (pulls spine-webgl@4.3.0 + a 4.3.0 spine-core transitively;
#    because 4.3.0 is now the canonical top-level copy there is NO nested duplicate).
npm install @esotericsoftware/spine-player@4.3.0
```

Resulting `package.json` `dependencies` shape (the exact, copy-paste-accurate target):

```jsonc
{
  "dependencies": {
    "@esotericsoftware/spine-core": "4.3.0",
    "spine-core-42": "npm:@esotericsoftware/spine-core@4.2.111",
    "@esotericsoftware/spine-player": "4.3.0"
    // ...existing deps unchanged...
  }
}
```

Resulting `package-lock.json` alias entry (informational — npm writes this automatically):

```jsonc
"node_modules/spine-core-42": {
  "name": "@esotericsoftware/spine-core",
  "version": "4.2.111",
  "resolved": "https://registry.npmjs.org/@esotericsoftware/spine-core/-/spine-core-4.2.111.tgz",
  "integrity": "sha512-dh4OOJ..."
}
```

### Resulting import paths (what `core/` code writes)

| Runtime | Import specifier | Resolves to |
|---------|------------------|-------------|
| **4.3 (new, canonical)** | `import { Skeleton, AnimationState, Physics } from '@esotericsoftware/spine-core';` | 4.3.0 |
| **4.2 (retained, aliased)** | `import { Skeleton, AnimationState, Physics } from 'spine-core-42';` | 4.2.111 |

The alias name `spine-core-42` is a real, resolvable module specifier in Node ESM, Vite/Rollup, vitest, and tsc — verified in all four contexts. Deep imports also work (no `exports` map in either version), but the barrel root import the codebase uses today (`from '@esotericsoftware/spine-core'`) is the supported path and needs no change for the 4.3 side.

---

## Resolution Mechanics (verified facts the roadmap must encode)

### `npm view` facts (verified 2026-05-16)

| Fact | Value |
|------|-------|
| `@esotericsoftware/spine-core` `latest` dist-tag | **`4.3.0`** |
| `@esotericsoftware/spine-player` `latest` dist-tag | **`4.3.0`** |
| `@esotericsoftware/spine-webgl` `latest` dist-tag | `4.3.0` |
| spine-core@4.3.0 publish date | **2026-05-15T10:40:23Z** (`_npmUser: daaaaa`) |
| spine-player@4.3.0 publish date | 2026-05-15T10:40:41Z |
| Any 4.3.x patch beyond 4.3.0? | **NO.** `4.3.0` is the only 4.3 version published; the prior version is `4.2.116` (2026-05-13). |
| spine-core@4.3.0 layout | `main: dist/index.js`, `types: dist/index.d.ts`, `type: module`, **no `exports` map, no `module` field** — structurally identical to 4.2.111 (fileCount 99→133, unpackedSize 5.0MB→5.9MB; the growth is the new Pose/Slider files) |
| spine-core@4.3.0 dependencies | **none** |
| spine-player@4.3.0 dependencies | `{ "@esotericsoftware/spine-webgl": "4.3.0" }` (exact) — **does NOT directly depend on spine-core** |
| spine-webgl@4.3.0 dependencies | `{ "@esotericsoftware/spine-core": "4.3.0" }` (exact) |
| gitHead for all three 4.3.0 packages | `4eb4170bd9a4e2ec1fd385574426e3b35381cd0d` (built from spine-runtimes branch `4.3`; there is **no `4.3.0` git tag**, the upstream convention is a `4.3` branch) |

### The spine-player coupling (the #1 hazard — resolved by alias inversion)

Reproduced live in a sandbox install. With the **naive** direction (`@esotericsoftware/spine-core` = 4.2.111, `spine-core-43` alias):

```
node_modules/@esotericsoftware/spine-core                          -> 4.2.111  (hoisted top-level)
node_modules/spine-core-43                                          -> 4.3.0    (your alias)
node_modules/@esotericsoftware/spine-webgl/node_modules/spine-core  -> 4.3.0    (nested, satisfies webgl's exact pin)
node_modules/@esotericsoftware/spine-player                         -> 4.3.0    (NO nested spine-core)
```

`spine-player@4.3.0`'s `dist/index.js` is literally `export * from "@esotericsoftware/spine-core"; export * from "@esotericsoftware/spine-webgl"; ...`. Because spine-player has no nested spine-core, Node's resolver walks up and binds the bare `@esotericsoftware/spine-core` to the **top-level 4.2.111**. Result: `import { SpinePlayer } from '@esotericsoftware/spine-player'` runs a 4.3 player while its re-exported `Skeleton`/`Physics`/`Vector2` are 4.2 objects — a silent mixed-runtime split-brain. `npm overrides` does NOT fix it (spine-player has no spine-core dep to override — verified, no-op).

With the **recommended (inverted)** direction (`@esotericsoftware/spine-core` = 4.3.0 canonical, `spine-core-42` alias):

```
node_modules/@esotericsoftware/spine-core   -> 4.3.0    (canonical, single copy, no duplicates)
node_modules/spine-core-42                   -> 4.2.111  (your alias)
node_modules/@esotericsoftware/spine-player  -> 4.3.0    (bare spine-core -> top-level 4.3.0 ✓)
node_modules/@esotericsoftware/spine-webgl   -> 4.3.0    (exact pin satisfied by top-level 4.3.0; no nesting)
```

Verified: `import { SpinePlayer, Skeleton, Physics, Vector2 } from '@esotericsoftware/spine-player'` — `SpinePlayer`, `Skeleton`, `Physics`, `Vector2` all resolve correctly to 4.3.0, and `player.Skeleton === (4.3 core Skeleton)`. The retained 4.2 runtime is fully intact and distinct via `spine-core-42`.

### worker_threads resolution

The sampler runs in a Node `worker_threads` Worker spawned by path: `new Worker(pathResolve(__dirname, 'sampler-worker.cjs'), { workerData })` (`sampler-worker-bridge.ts:71-75`). The worker bundle is emitted by electron-vite as `out/main/sampler-worker.cjs` with `build.externalizeDeps: true`, so spine-core is **NOT bundled** — the `require('@esotericsoftware/spine-core')` / `require('spine-core-42')` calls execute at runtime and resolve from the app's `node_modules` exactly like the single spine-core does today. The worker is a standalone CJS entrypoint; the alias is just another package name in `node_modules`. No special worker handling, no `external` config additions. (Verified analog: Vite `build` with externalized aliased specifiers emits the bare import untouched; runtime Node resolves it.)

### vitest resolution

`tests/**/*.spec.ts` import `core/sampler.ts` + `core/bounds.ts` headless under the `node` environment. Verified live: a vitest 4 spec importing both `@esotericsoftware/spine-core` (4.3.0) and `spine-core-42` (4.2.111) resolves both to distinct constructors and passes. **No vitest config change, no tsconfig `paths` entry required** — vitest uses Vite's resolver which honors npm aliases natively, and `moduleResolution: bundler` resolves the alias's own bundled `.d.ts` by alias name for type-checking.

---

## Spine 4.3 API Delta — STABLE vs SEED-006's BETA inventory (drift flagged)

> SEED-006's costed inventory (PORT-01..04) was built against **4.3-beta**. The published **4.3.0 stable** (spine-runtimes branch `4.3` CHANGELOG, verified) has additional and changed breaking surface. The roadmapper must use the table below, NOT SEED-006's beta table, for porting scope. These are *consumer-code* impacts of the stack change — not stack additions themselves, but they gate the alias's usability and are why this is more than a `package.json` bump.

| Area | SEED-006 (beta) said | 4.3.0 STABLE actually | Impact |
|------|----------------------|------------------------|--------|
| `Skeleton.setToSetupPose()` | → `setupPose()` | ✅ confirmed `setupPose()` | `core/sampler.ts` |
| `Skeleton.setSlotsToSetupPose()` | → `setupPoseSlots()` | ✅ confirmed `setupPoseSlots()` | `core/sampler.ts` |
| `Skeleton.setBonesToSetupPose()` | (not listed) | → `setupPoseBones()` | check `core/sampler.ts`/`core/bones.ts` |
| `state.setAnimationWith(...)` | → `setAnimation(...)` | ⚠ broader: `AnimationState.setCurrent()` → `setTrack()`; `getCurrent()` deprecated → `getTrack()` | `core/sampler.ts` — audit all AnimationState calls, not just one |
| `slot.getAttachment()` | → `slot.pose.attachment` | ⚠ **stable is `slot.getAppliedPose().attachment`** (method, not `.pose` property) | `core/sampler.ts` visibility passes (incl. v1.3 skin-manifest pass per `project_sampler_visibility_invariant`) |
| `computeWorldVertices` | RegionAttachment +`vertexOffsets`; VertexAttachment +`skeleton` first arg | ⚠ **ALL attachment `computeWorldVertices()` take an additional `skeleton` param** (broader than beta) | `core/bounds.ts` — every call site |
| Timeline `apply()` | (not listed) | ⚠ **`MixBlend` & `MixDirection` REMOVED**; `apply()` now takes `fromSetup, add, out, appliedPose` | If `core/` or the viewer references these enums — they no longer exist anywhere in 4.3.0 (verified: zero occurrences in any 4.3.0 `.d.ts`) |
| Bone transform reads | (not listed) | `bone.x` → `bone.getPose().x` (and `.y/.rotation/.scaleX/.scaleY/.shearX/.shearY`); applied: `bone.worldX` → `bone.getAppliedPose().worldX` | audit `core/bounds.ts`/`core/bones.ts` for direct bone-transform reads |
| RegionAttachment/MeshAttachment ctor | (not listed) | now take a **non-null `Sequence`**; `getParentMesh/setParentMesh` → `getSourceMesh/setSourceMesh` | check `core/loader.ts` / synthetic-atlas / repack if it constructs attachments |
| `Bone.skeleton` | (not listed) | `Bone` no longer provides/accepts `skeleton` | audit `core/` bone usage |
| Slider constraint | new `Slider`/`SliderData`/`SliderTimeline`/`SliderMixTimeline` | ✅ confirmed: `Slider.js`, `SliderData.js`, `SliderPose.js`, slider timelines present in 4.3.0 dist | PORT-03 fixture validation still required |

**Viewer-specific stack consequence (must be in roadmap):** `src/renderer/src/modals/AnimationPlayerModal.tsx` currently does
`import { MixBlend, MixDirection, Physics, Skeleton, SpinePlayer, Vector2, type SpinePlayerConfig } from '@esotericsoftware/spine-player';`
Under 4.3.0: `SpinePlayer` ✅, `Skeleton`/`Physics`/`Vector2` ✅ (resolve correctly **only with the inverted alias**), `SpinePlayerConfig` type ✅ (from `./Player.d.ts` via the player barrel), but **`MixBlend` and `MixDirection` are removed entirely** (verified: absent from spine-core, spine-webgl, and spine-player 4.3.0 — zero `.d.ts` occurrences). The viewer port must drop those two imports and migrate any mix-blend/direction usage to the new `apply()` parameter model (`fromSetup, add, out, appliedPose`).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| 4.3 canonical + `spine-core-42` alias | 4.2 canonical + `spine-core-43` alias (naive) | **Never** for this project — breaks spine-player@4.3.0 (split-brain, reproduced). Only viable if spine-player were NOT in the dep tree. |
| npm package alias (`npm:` protocol) | git submodule on `spine-ts/spine-core` + tsc build step | Rejected by locked decision (PORT-04). Only if npm publish lagged the stable tag — it did not (4.3.0 is on npm). |
| npm package alias | Maintain an npm fork | Rejected by locked decision. Maintenance burden, fork drift; unnecessary now that 4.3.0 is published. |
| Static dual import in dispatcher | Dynamic `import()` per detected version | Static is simpler and verified to bundle/test cleanly. Use dynamic only if bundle-size of carrying both runtimes becomes a measured problem (it is not — both are externalized in main/worker; renderer doesn't import core). |
| No `npm overrides` | `overrides` to pin spine-player's spine-core | Verified no-op (spine-player has no direct spine-core dep). Do NOT add overrides — it gives false confidence. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| The naive alias direction (4.2 canonical, 4.3 aliased) | spine-player@4.3.0 bare-resolves spine-core to the hoisted 4.2.111 → mixed-runtime viewer | 4.3 canonical, 4.2 aliased as `spine-core-42` |
| git submodule / npm fork (SEED-006 PORT-04 options b/c) | Rejected by locked decision; 4.3.0 is published on npm | `package.json` npm alias only |
| tsconfig `paths` mapping for the alias | Unnecessary — `moduleResolution: bundler` resolves the alias's own bundled `.d.ts` by package name (verified) | Nothing; leave tsconfig untouched |
| Vite `resolve.alias` / `optimizeDeps` / `dedup` entries for spine-core | Unnecessary — main/worker externalize spine-core (v5 `externalizeDeps: true`); renderer never imports `core/` (arch.spec Layer-2 lock); the npm alias is resolved by Node/Vite natively | Nothing; `electron.vite.config.ts` unchanged |
| `npm overrides` for spine-player→spine-core | No-op (no direct dep to override) | Inverted alias direction (handles it structurally) |
| `MixBlend` / `MixDirection` imports anywhere | Removed in 4.3.0 (zero `.d.ts` occurrences across all three packages) | New `apply()` params: `fromSetup, add, out, appliedPose` |
| `slot.pose.attachment` (SEED-006 beta guess) | Stable API differs | `slot.getAppliedPose().attachment` |

## Stack Patterns by Variant

**If a dropped skeleton is detected as 4.3 (via the repurposed `checkSpine43Schema` dispatcher):**
- Route loader/sampler/bounds to the `@esotericsoftware/spine-core` (4.3.0) runtime.
- Use the new Pose API (`bone.getPose()`, `slot.getAppliedPose()`), new `setupPose*` names, `setTrack`/`getTrack`, and the `skeleton`-first `computeWorldVertices` signatures.

**If a dropped skeleton is detected as 4.2:**
- Route to the `spine-core-42` (4.2.111) runtime, unchanged from today's call shapes.
- The in-repo `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (`spine: 4.2.x`) must stay green against this path (regression gate).

**Dispatcher placement (Layer-3 invariant):**
- The runtime-selection seam lives in `core/` as pure TS — it imports both module specifiers statically and selects per detected version. It must not import DOM/Electron/sharp (`tests/arch.spec.ts` enforces). Static dual import verified safe under vitest + Vite externalization.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@esotericsoftware/spine-core@4.3.0` | `@esotericsoftware/spine-player@4.3.0` | spine-player→spine-webgl→spine-core all exact-pinned to 4.3.0; the canonical top-level 4.3.0 satisfies the whole subtree with NO nested duplicate (verified). |
| `spine-core-42` (→4.2.111) | (isolated) | Fully distinct module + type surface; coexists with 4.3.0 with zero conflict (verified install + dual ESM import + tsc). |
| `@esotericsoftware/spine-core@4.3.0` | electron-vite 5 `externalizeDeps:true` | spine-core externalized in main/worker bundles; resolved at runtime — no bundler config change. |
| `spine-core-42` alias | vitest 4 / tsc `moduleResolution: bundler` | Resolves by alias name with no `paths` config (verified: distinct non-overlapping `Skeleton` types). |
| `@esotericsoftware/spine-player@4.3.0` | v1.5.1 viewer (`AnimationPlayerModal.tsx`) | API-breaking: `MixBlend`/`MixDirection` removed; viewer import list must change. `SpinePlayer`/`Skeleton`/`Physics`/`Vector2`/`SpinePlayerConfig` OK *with inverted alias only*. |

## Sources

- Live `npm view @esotericsoftware/spine-core|spine-player|spine-webgl` (dist-tags, versions, time, dependencies, main/types/type, dist integrity) — 2026-05-16 — HIGH
- Live `npm pack` + tarball inspection of spine-core/spine-player/spine-webgl 4.3.0 (`package.json`, `dist/index.js`, `dist/index.d.ts`, dist file list) — HIGH
- Live sandbox installs reproducing: (a) naive alias split-brain, (b) inverted alias clean tree, (c) `npm overrides` no-op, (d) dual ESM import in Node, (e) `vitest run` with both runtimes, (f) `vite build` with externalized aliases, (g) `tsc` moduleResolution:bundler dual-type isolation — HIGH
- spine-runtimes branch `4.3` CHANGELOG.md (https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.3/CHANGELOG.md) — spine-ts breaking changes (Pose system, MixBlend/MixDirection removal, setupPose* renames, setTrack/getTrack, computeWorldVertices +skeleton, getAppliedPose, Slider) — verified STABLE branch, NOT beta — HIGH
- `git ls-remote` spine-runtimes — confirmed `4.3` is a branch (no `4.3.0` tag); npm 4.3.0 gitHead `4eb4170` — HIGH
- Context7 `/esotericsoftware/spine-runtimes` (resolved; CHANGELOG cross-checked) — MEDIUM/HIGH
- Project files: `package.json`, `electron.vite.config.ts`, `vitest.config.ts`, `tsconfig.node.json`/`web.json`, `src/main/sampler-worker-bridge.ts`, `src/core/{sampler,bounds,loader}.ts`, `src/renderer/src/modals/AnimationPlayerModal.tsx`, SEED-003/006, PROJECT.md — HIGH

---
*Stack research for: Spine 4.3 dual-runtime addition (Electron + TS + React desktop app)*
*Researched: 2026-05-16*

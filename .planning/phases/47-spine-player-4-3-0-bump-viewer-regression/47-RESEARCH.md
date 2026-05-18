# Phase 47: spine-player 4.3.0 Bump + Viewer Regression - Research

**Researched:** 2026-05-18
**Domain:** spine-player 4.2.111 → 4.3.0 dependency bump + Pose-architecture API migration of the v1.5.1 Animation Viewer (`AnimationPlayerModal.tsx`), under an already-frozen-canonical `@esotericsoftware/spine-core@4.3.0`
**Confidence:** HIGH (every API claim verified against the actually-installed npm tarballs and a freshly-`npm pack`'d spine-player/spine-webgl@4.3.0; the 22-error migration surface and the 11-suite RED state are reproduced live, not inferred)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (posture — STRICT, overrides roadmap framing):** If the 4.3-player viewer cannot be made fully green within Phase 47, **v1.6 milestone close is HELD until the viewer is fully green on the 4.3 player.** The user deliberately rejected both the "land bump+migration, carry residual visual UATs to v1.7" option and the roadmap/PITFALLS "revert spine-player to 4.2.111, ship without the bump" fallback. This consciously overrides the ROADMAP/research "decoupled + revertible — a player regression must not gate the core port" design intent. Do NOT relitigate back to a softer posture or re-introduce the revert fallback as the plan's default.
- **D-02 (verification mechanism — in-phase owner checkpoint):** "Fully green" is verified by an **explicit in-phase `checkpoint:human-action`** (Phase 46-style). After the bump + import migration land and the build is runnable, the owner runs the real Electron app and executes **all 5 carried Phase 41 UATs + the GL straight-alpha SIMPLE_TEST visual check** live. The phase does not complete and v1.6 does not close until the owner signs every one of them off. The 4 visual/host-blocked UATs are not jsdom-passable — owner live execution is the only valid evidence.
- **D-03 (revert-feasibility note — researcher must resolve, not the plan's fallback):** Because spine-core@4.3.0 is frozen-canonical from Phase 42 and spine-player bare-resolves it, the `MixBlend`/`MixDirection` import migration is broken right now independent of the package bump — so PLAYER-01's migration is effectively mandatory and non-revertible, and spine-player@4.2.111 + canonical 4.3.0 is likely a broken split-brain (per SUMMARY). The researcher MUST explicitly confirm whether the spine-player package bump is even mechanically revertible given frozen-canonical 4.3.0 (it informs blast-radius understanding) — but per D-01 the revert is NOT the plan's fallback regardless of the answer.
- **D-04 (keep the custom resilient path):** Preserve our custom `sampleAnimationBounds` and migrate **only** the line-255 `anim.apply(probe, t, t, false, [], 1, MixBlend.setup, MixDirection.mixIn)` call **1:1** to the 4.3 signature. The researcher derives the exact new `apply()` argument shape from the 4.3.0 `.d.ts`. **The Phase 41 content-less-STOP-animation graceful degradation (return `null` instead of the fatal `showError`) MUST NOT regress.** Adopting spine-player 4.3's native `calculateAnimationViewport` was explicitly rejected.
- **D-05 (full internal-touchpoint audit before the live UAT):** Enumerate and audit **every** spine-player/spine-webgl internal the modal depends on against the 4.3.0 `dist`/`.d.ts`, documenting each as stable-in-4.3.0 or changed, BEFORE the owner live UAT. Known touchpoints: `apply()` (line 255), `makeProbe`, `p.sceneRenderer`/`camera`, `skeleton.getBounds`, the "vendored line 5862" parent-dir atlas resolution, and the `premultipliedAlpha:false`/`alpha:false` straight-alpha shader path.
- **D-06 (same-framing visual parity is the bar):** The migrated `sampleAnimationBounds` + camera-freeze/Fit math must frame rigs the same way v1.5.1 did — a 4.2 fixture must look identical through the 4.3 player. Auto-fit / zoom / position drift counts as a regression the owner UAT must catch.
- **D-07 (`--skip-ui`):** Next step is `/gsd-plan-phase 47 --skip-ui`. Phase 47 designs zero new UI. The visual acceptance contract is the 5 UATs + GL-alpha owner checkpoint (D-02), not a UI-SPEC.
- **D-08 (verification artifacts):** Create a new `47-HUMAN-UAT.md` capturing all 5 Phase 41 UATs + the GL-alpha SIMPLE_TEST check re-run on the 4.3 player (owner-signed), AND flip the 5 pending items in `.planning/phases/41-spine-animation-viewer/41-HUMAN-UAT.md` in place to resolved with a pointer to the Phase 47 re-run.
- **D-09 (PLAYER-02 SC#1 render pair):** "Both a 4.2 and a 4.3 fixture render correctly through the 4.3 player" = `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (4.2 — the established GL-alpha canary) + `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (4.3 — the ORCL-01 SIMPLE_TEST-equivalent sibling). The internal-touchpoint audit (D-05) may add a rig to the live-UAT set if it flags one as alpha/render-risky, but the baseline pair is fixed.

### Claude's Discretion

Delegated per `feedback_delegate_implementation_choices` (within the locked D-01..D-09 invariants):
- The exact 4.3 `apply()` argument shape (researcher derives from the 4.3.0 `.d.ts`/`dist` — D-04).
- The precise enumeration + format of the D-05 internal-touchpoint audit.
- How same-framing parity (D-06) is measured/recorded (e.g. screenshot diff vs documented camera zoom/position values).
- `47-HUMAN-UAT.md` exact layout (must cover all 5 + GL-alpha, owner-signed).
- The `checkpoint:human-action` task placement/wording in the plan (must gate phase completion per D-02).
- The minimal CSP/CORS posture for the 4.3 player (keep origin-scoped; do NOT broaden `connect-src`/ACAO beyond what 4.3 actually needs — PITFALLS guardrail; not a user decision).

### Deferred Ideas (OUT OF SCOPE)

- **VIEWER-07** — split-pane source-vs-exported comparison in the viewer (v1.7 candidate; Phase 47 ships no new viewer capability).
- **External-surface copy sweep** (GitHub repo description / Releases notes) — owner ship-time follow-up carried from Phase 45 D-07; out-of-repo.
- **Broader 4.3 viewer fixture matrix** (SLIDER_4_3 / XTRA / spineboy_4.3 visual co-render) — scoped down to the SIMPLE_TEST + SIMPLE_PROJECT_43 pair (D-09). The D-05 audit may pull in one extra rig only if it flags an alpha/render risk.
- Any `src/core/` runtime/loader/sampler/bounds change; user-facing copy/`errors.ts` (swept Phase 45); 4.3→4.2 schema translation; adopting spine-player 4.3's native `calculateAnimationViewport` (explicitly REJECTED in D-04).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **PLAYER-01** | `@esotericsoftware/spine-player` is bumped 4.2.111 → 4.3.0; the removed `MixBlend` / `MixDirection` imports are dropped from `AnimationPlayerModal.tsx` and migrated to the new apply model. | Verified: the package.json one-line bump (Standard Stack); the **exact 10-arg 4.3.0 `apply()` signature** from installed `Animation.d.ts:93` + spine-player's own internal call site `Player.js:644` (D-04 Migration Mapping); plus a **larger-than-anticipated 22-error Skeleton/AnimationState/Config migration surface** (D-05 audit) the line-255 fix alone does NOT close. |
| **PLAYER-02** | The v1.5.1 viewer renders both a 4.2 and a 4.3 fixture correctly through the 4.3 player, GL straight-alpha is re-verified, and the 5 carried Phase 41 HUMAN-UATs are re-run on the 4.3 player. | Verified GL straight-alpha mechanism **changed** between 4.2.111 and 4.3.0 spine-webgl (premultiply moved from blend-func to vertex-color + upload-unpack) — the config key still has effect but via a new path; empirical re-verify mandatory (GL Straight-Alpha section). D-09 fixture pair confirmed loadable. CSP guardrail confirmed origin-scoped. Two-track completion mapped (Validation Architecture). |
</phase_requirements>

## Summary

This phase is **not** a one-line `apply()` migration. Verifying against the actually-installed tarballs surfaced that the v1.5.1 viewer (`AnimationPlayerModal.tsx`) has a **22-error type-incompatibility surface** against the frozen-canonical `@esotericsoftware/spine-core@4.3.0`, and the codebase is **already in a reproduced split-brain right now** (spine-player@4.2.111's `Player.js:29` bare-imports `@esotericsoftware/spine-core` which hoist-resolves to the canonical **4.3.0** where `MixBlend` is deleted — its own internal `Player.js:640 MixBlend.setup` is broken at runtime today). 11 renderer test suites fail at module import with `SyntaxError: ... does not provide an export named 'MixBlend'`. This is the machine-checkable half of the phase, and it goes green only when the modal's full Pose-API migration lands — not the line-255 fix alone.

The migration surface is: (1) the line-255 `Animation.apply()` 8-arg → 10-arg shape (D-04, signature verified from `Animation.d.ts:93` and cross-confirmed against spine-player's own `Player.js:644` internal call); (2) `Skeleton.setSkinByName` (now `private`) → public `setSkin()`; (3) `setToSetupPose()` → `setupPose()`; (4) `setSlotsToSetupPose()` → `setupPoseSlots()`; (5) `AnimationState.getCurrent(0)` → `getTrack(0)`; (6) `SpinePlayer.playTime` is `private` (the scrub handler reads/writes it directly — needs a public-API rework); (7) `SpinePlayerConfig.preserveDrawingBuffer` is now required; (8) `p.skeleton`/`p.animationState` are now `Skeleton | null` (null-guards). The renderer test mock (`tests/renderer/animation-player-modal.spec.tsx:85-156`) hardcodes the **old 4.2 method names** and must migrate in lockstep or it becomes a false-green stale mirror.

The GL straight-alpha "hard floor" (Pitfall 7, "NEVER skip") **changed mechanism** between 4.2.111 and 4.3.0 spine-webgl: 4.2.111 selected `srcFunc` per `premultipliedAlpha` flag in `PolygonBatcher.setBlendMode(blendMode, pma)`; 4.3.0 **removed that parameter** and always premultiplies the vertex color (`SkeletonRenderer.js:130-160`) + always uses the PMA blend (`srcRgbPma = GL_ONE`), pushing the straight-vs-PMA decision into the **texture upload** (`GLTexture.js:88` `gl.pixelStorei(UNPACK_PREMULTIPLY_ALPHA_WEBGL, !this.pma)`). The config key `premultipliedAlpha:false` is **still consumed and still produces a mathematically-correct straight-alpha render** — but via a different internal path than the Phase-41 G-03 fix targeted. The fix is not a no-op, but the failure-mode geometry changed, so the owner empirical GL-halo re-verify on SIMPLE_TEST is mandatory and non-skippable (D-02).

**Primary recommendation:** Plan this as a single migration unit — the package.json bump and the FULL `AnimationPlayerModal.tsx` Pose-API migration (all 8 categories) plus the lockstep test-mock migration must land together; a partial migration neither compiles nor un-REDs the 11 suites. Gate phase completion on the D-02 owner `checkpoint:human-action` (all 5 Phase 41 UATs + GL-alpha SIMPLE_TEST) after machine-green (22 errors → 0, 11 suites → green, full `npm test` no new failures, `typecheck:web` clean).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| spine-player dependency version | Build / package.json | — | One-line dep bump; pulls spine-webgl@4.3.0 transitively. Not a code tier. |
| Skeleton/Animation Pose-API calls (sampleAnimationBounds, makeProbe, skin switch, scrub) | Renderer (modal) | — | `AnimationPlayerModal.tsx` is Layer-2 renderer-only (arch.spec.ts:19-34); imports only from `@esotericsoftware/spine-player`, never `src/core/*`. The migration is entirely renderer-local. |
| GL straight-alpha render correctness | spine-webgl@4.3.0 (vendored) + renderer config | — | The blend/premultiply pipeline lives in vendored spine-webgl; the modal only *configures* it via `SpinePlayerConfig.premultipliedAlpha`/`alpha`. The modal owns the config value; spine-webgl owns the execution. |
| Asset feed (atlas-source URL / atlas-less rawDataURIs) | Renderer (modal) + Main (IPC) | — | `buildAssetFeed` + `window.api.getViewerAssetFeed` (Plan-01 IPC). Unchanged by the bump unless spine-player's atlas-parent-dir resolution moved (audited: did not). |
| CSP / `app-image://` protocol handler | Main / renderer index.html | — | `connect-src 'self' app-image:` in `src/renderer/index.html`; CORS ACAO in the main protocol handler. Phase 41 G-01/G-02. The bump must not broaden this. |
| Renderer test mock fidelity | Test (vitest) | — | `tests/renderer/animation-player-modal.spec.tsx` mocks `@esotericsoftware/spine-player`; the mock surface must track the real 4.3.0 surface or it green-washes the migration. |
| 5 visual/host UATs (anim/skin switch, GL leak, real-fs error, atlas-less parity, File-menu) | Human (owner live Electron) | — | jsdom has no WebGL; D-02 owner `checkpoint:human-action` is the only valid evidence (D-01 holds milestone close on it). |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@esotericsoftware/spine-player` | **4.3.0** (exact pin) | The v1.5.1 Animation Viewer (`AnimationPlayerModal.tsx`) | `[VERIFIED: npm pack + node_modules]` Sibling-aligned to the frozen-canonical spine-core@4.3.0. `package.json` declares `dependencies: { "@esotericsoftware/spine-webgl": "4.3.0" }` (exact); has **no direct spine-core dep** → bare-resolves the canonical top-level spine-core. This is the entire point of Phase 42's inverted alias direction. |
| `@esotericsoftware/spine-webgl` | 4.3.0 (transitive, auto) | spine-player's GL renderer + re-exported 4.3 core symbols | `[VERIFIED]` Pulled in by spine-player@4.3.0's exact pin. Today the installed `spine-webgl@4.2.111` has a **nested** `node_modules/@esotericsoftware/spine-webgl/node_modules/@esotericsoftware/spine-core@4.2.111` — the bump removes the version skew (spine-webgl@4.3.0's exact `spine-core@4.3.0` pin is satisfied by the canonical top-level copy, no nesting). |
| `@esotericsoftware/spine-core` | 4.3.0 (canonical, **frozen Phase 42 — DO NOT TOUCH**) | The runtime spine-player binds via bare resolution | `[VERIFIED]` Already installed canonical at `node_modules/@esotericsoftware/spine-core@4.3.0`; `MixBlend`/`MixDirection` confirmed absent (0 `.d.ts` occurrences). NOT a Phase 47 edit — it is the fixed constraint the modal must migrate *to*. |
| `spine-core-42` (alias → `@esotericsoftware/spine-core@4.2.111`) | 4.2.111 (frozen Phase 42) | The retained 4.2 sampler runtime | `[VERIFIED]` Out of Phase 47 scope entirely — the modal never imports `spine-core-42`; the viewer is decoupled from the core dual-runtime (own embedded spine-core via spine-webgl). |

### Supporting

No new libraries. This is a dependency-version bump + renderer-local migration. No new build tooling, submodule, fork, Vite plugin, or tsconfig change (per STACK.md, verified live across vitest/Vite/tsc).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bump spine-player → 4.3.0 + migrate | Revert spine-player to 4.2.111 (roadmap/PITFALLS original "separable/revertible" fallback) | **EXPLICITLY REJECTED by D-01.** Also see D-03 finding below: the revert is **mechanically infeasible without un-freezing spine-core** — reverting only the spine-player line leaves spine-player@4.2.111 bare-resolving the canonical 4.3.0 (the current reproduced split-brain), which is *more* broken than the bump. |
| Migrate the line-255 `apply()` only (literal D-04 reading) | — | Insufficient: the modal has **22 type errors across 8 API categories**; the 11 RED suites and `typecheck:web` only go green when the *full* migration lands. D-04's "1:1 line-255" is necessary but the D-05 audit (also locked) mandates the rest. |
| Adopt spine-player 4.3's native `calculateAnimationViewport` | — | **EXPLICITLY REJECTED by D-04** — it calls a fatal `showError` on content-less animations (verified: `Player.js:347` `showError` family still present in 4.3.0); the custom `sampleAnimationBounds` resilient path exists precisely to avoid this. |

**Installation:**
```bash
npm install @esotericsoftware/spine-player@4.3.0
```
This rewrites the single `package.json:27` line `"@esotericsoftware/spine-player": "4.2.111"` → `"4.3.0"`, updates `package-lock.json` (spine-webgl@4.3.0 transitive, nested spine-core@4.2.111 under spine-webgl disappears). `npm ci` in CI (lockfile-frozen) per the project convention.

**Version verification (performed this session):**
```
npm pack @esotericsoftware/spine-player@4.3.0   # tarball inspected
npm pack @esotericsoftware/spine-webgl@4.3.0    # tarball inspected
# node_modules/@esotericsoftware/spine-core/package.json -> "version": "4.3.0" (canonical, installed)
# node_modules/@esotericsoftware/spine-player/package.json -> "version": "4.2.111" (the line to bump)
# node_modules/spine-core-42/package.json -> name "@esotericsoftware/spine-core", "version": "4.2.111" (alias, frozen)
```
`[VERIFIED: STACK.md npm view, 2026-05-16]` spine-player@4.3.0 / spine-webgl@4.3.0 / spine-core@4.3.0 published 2026-05-15; **no 4.3.x patch exists** (4.3.0 is the only 4.3 release; prior is 4.2.116). Exact-pin `4.3.0`, no caret (CLAUDE.md release-tag convention + PITFALLS Pitfall 1: Esoteric ships API changes in patch-shaped releases).

## D-03 Answer: Revert Feasibility (factual, definitive)

**The spine-player package bump is NOT mechanically revertible without un-freezing spine-core@4.3.0. The codebase is in a genuine, reproduced split-brain RIGHT NOW, and the `MixBlend`/`MixDirection` migration is mandatory and non-revertible independent of the bump.** `[VERIFIED: live node module resolution against installed node_modules + npm pack]`

Evidence (reproduced this session, not inferred from SUMMARY prose):

1. **Installed state:** `package.json` has `@esotericsoftware/spine-core: "4.3.0"` (canonical, Phase 42), `@esotericsoftware/spine-player: "4.2.111"` (not yet bumped), `spine-core-42: npm:@esotericsoftware/spine-core@4.2.111` (alias).
2. **node_modules layout:** `node_modules/@esotericsoftware/spine-core` → **4.3.0**; `node_modules/@esotericsoftware/spine-player` → 4.2.111 with **no nested node_modules**; `node_modules/@esotericsoftware/spine-webgl` → 4.2.111 **with** a nested `node_modules/@esotericsoftware/spine-core@4.2.111`.
3. **spine-player's runtime binding:** `node_modules/@esotericsoftware/spine-player/dist/Player.js:29` does `import { ..., MixBlend, MixDirection, ... } from "@esotericsoftware/spine-core";`. spine-player has no nested spine-core, so Node's resolver walks up and binds the bare specifier to the **top-level canonical 4.3.0**. Verified programmatically: `require.resolve('@esotericsoftware/spine-core', { paths: [<spine-player dir>] })` → `node_modules/@esotericsoftware/spine-core/dist/index.js` → version **4.3.0**.
4. **The break is live today:** spine-player@4.2.111's own `Player.js:640` calls `animation.apply(this.skeleton, time, time, false, [], 1, MixBlend.setup, MixDirection.mixIn)` — but `MixBlend`/`MixDirection` are deleted from the canonical 4.3.0 it resolves (0 `.d.ts` occurrences confirmed). The renderer test suite reproduces this: 11 suites fail with `SyntaxError: The requested module '@esotericsoftware/spine-core' does not provide an export named 'MixBlend'` at `AnimationPlayerModal.tsx:45:1`.
5. **Why revert is infeasible:** Reverting only the spine-player line keeps it at 4.2.111 → still bare-resolves canonical 4.3.0 → still split-brain (this *is* the current state). The only way "spine-player@4.2.111 working" is to un-freeze spine-core back to 4.2.111-canonical — which **breaks the Phase 42–46 dual-runtime port** that depends on 4.3.0 being canonical (STACK.md: the inverted alias direction is load-bearing). The viewer's "decoupled + separately-revertible" design intent (ROADMAP) is **factually false under frozen-canonical 4.3.0** — Phase 42's RT-01 alias inversion coupled the viewer to the core port's spine-core version. STATE.md's 2026-05-16 Phase 42 entry already recorded this: the `typecheck:web` spine-player `.d.ts` 4.3-leak was knowingly handed to Phase 47 as the owner of that surface.

**Conclusion:** D-01's "no revert fallback" posture is not just a preference — it is the *only* mechanically-coherent path. The blast radius is fully contained to one renderer file (`AnimationPlayerModal.tsx`) + its lockstep test mock; there is no decoupled-revert escape hatch and the plan must not pretend one exists. `[VERIFIED]`

## D-04 Answer: Exact 4.3.0 `apply()` Signature + 1:1 Migrated Line

**Source 1 — installed `node_modules/@esotericsoftware/spine-core/dist/Animation.d.ts:93`** `[VERIFIED]`:
```ts
apply(skeleton: Skeleton, lastTime: number, time: number, loop: boolean,
      events: Array<Event> | null, alpha: number,
      fromSetup: boolean, add: boolean, out: boolean, appliedPose: boolean): void;
```
**10 arguments.** The current modal call (line 255) is the 4.2 **8-arg** shape:
```ts
anim.apply(probe, t, t, false, [], 1, MixBlend.setup, MixDirection.mixIn);
//          1     2  3  4     5  6   7 (blend)        8 (direction)
```
The 4.2.111 shape (`node_modules/spine-core-42/dist/Animation.d.ts:55`, verified) was `(skeleton, lastTime, time, loop, events, alpha, blend: MixBlend, direction: MixDirection)`.

**Source 2 — spine-player 4.3.0's OWN internal call site cross-confirms the migration mapping.** `Player.js:644` (from the freshly-packed 4.3.0 tarball) — the exact 4.3.0 analog of the 4.2.111 `Player.js:640` line that used `MixBlend.setup, MixDirection.mixIn`:
```js
animation.apply(this.skeleton, time, time, false, [], 1, true, false, false, false);
//               skeleton      lastTime time loop ev α  fromSetup add out appliedPose
```
This is authoritative: spine-player itself migrated `MixBlend.setup` → `fromSetup=true` and `MixDirection.mixIn` → `out=false`, with new `loop=false`, `add=false`, `appliedPose=false`.

**The exact 1:1 migrated line (preserves existing semantics — setup-pose blend, mixIn direction, alpha 1, empty events, time `t`):**
```ts
// 4.2 MixBlend.setup -> fromSetup=true ; MixDirection.mixIn -> out=false ;
// new args: loop=false, add=false, appliedPose=false (matches spine-player Player.js:644).
anim.apply(probe, t, t, false, [], 1, true, false, false, false);
```

**Semantic mapping (verified against `Animation.d.ts:70-92` JSDoc + spine-player usage):**

| 4.2 arg | value | 4.3 arg | value | Why equivalent |
|---|---|---|---|---|
| skeleton | `probe` | skeleton | `probe` | unchanged |
| lastTime | `t` | lastTime | `t` | unchanged (modal passes `t` for both — single-sample-per-step, no event window) |
| time | `t` | time | `t` | unchanged |
| (n/a — `loop` was arg 4) | `false` | loop | `false` | 4.2 also had `loop` here; unchanged |
| events | `[]` | events | `[]` | unchanged (empty array; modal ignores fired events) |
| alpha | `1` | alpha | `1` | unchanged (full timeline values) |
| blend | `MixBlend.setup` | fromSetup | `true` | 4.3 JSDoc: `fromSetup=true` → "alpha transitions between **setup** and timeline values, setup values used before first frame" = exactly `MixBlend.setup`. Confirmed by spine-player's own migration. |
| direction | `MixDirection.mixIn` | out | `false` | 4.3 JSDoc: `out` = "True when mixing **out**, else mixing **in**". `mixIn` → `out=false`. Confirmed by spine-player's own migration. |
| (n/a) | — | add | `false` | New. `add=true` would additively blend onto setup/current; the modal wants replace semantics (it samples absolute pose bounds). spine-player uses `false`. |
| (n/a) | — | appliedPose | `false` | New. `appliedPose=false` → modifies `Posed.pose` (not `appliedPose`). spine-player uses `false`. **The modal then calls `probe.updateWorldTransform(Physics.update)` which computes the applied pose from `pose` — identical to spine-player's own draw path.** Reading the *bounds* afterward via `getBounds` reads the post-constraint applied geometry (computed by `updateWorldTransform`), so the existing peak-bounds behavior is preserved. |

**Graceful-degradation interaction (D-04 must-not-regress check):** The content-less-STOP-animation path is `sampleAnimationBounds` returning `null` (its `try/catch` + `if (!any) return null` + `if (!(width>0)...) return null`). The `apply()` signature change does **not** alter this: `apply()` returns `void` and does not throw on a content-less animation (it just sets no visible attachment); the resilience is in the bounds-union/finite-box guards, which are byte-unchanged by the line-255 edit. The fatal `showError` is in spine-player's *native* `calculateAnimationViewport`, which the modal disables via the fixed `config.viewport` (still present and still effective in 4.3.0 — `Player.js:166-173` honors a supplied `config.viewport`). **No regression risk to the resilient path from the `apply()` migration.** `[VERIFIED]`

## D-05 Answer: Full Internal-Touchpoint Audit (vs installed 4.3.0 `dist`/`.d.ts`)

Every spine-player/spine-webgl/spine-core internal the modal touches, classified. **8 changed, the rest stable.** Line numbers are `AnimationPlayerModal.tsx`.

| # | Touchpoint | Modal location | 4.2.111 | 4.3.0 (installed) | Status | Exact migration |
|---|------------|----------------|---------|-------------------|--------|-----------------|
| T1 | `Animation.apply(...)` | L255 | 8-arg `(…,blend,direction)` | 10-arg `(…,loop,events,alpha,fromSetup,add,out,appliedPose)` `Animation.d.ts:93` | **CHANGED** | The D-04 line above. `tsc` error TS2554 at (255,12) "Expected 10 arguments, but got 8". |
| T2 | `Skeleton.setSkinByName(name)` | L222 (`makeProbe`), L563 (`success`), L645 (`onSkinChange`) | public `setSkinByName(name): void` | **`private setSkinByName`** `Skeleton.d.ts:142`; public replacement is **`setSkin(skinName: string): void`** `Skeleton.d.ts:131` (also `setSkin(newSkin: Skin\|null)` overload) | **CHANGED** | `probe.setSkinByName(skinName)` → `probe.setSkin(skinName)` (string overload). 3 sites. `tsc` errors TS2341 at (220,23),(563,24),(645,18). |
| T3 | `Skeleton.setToSetupPose()` | L242, L283 (`sampleAnimationBounds`, `sampleSetupBounds`) | `setToSetupPose()` | renamed **`setupPose()`** `Skeleton.d.ts:115` | **RENAMED** | `probe.setToSetupPose()` → `probe.setupPose()`. 2 sites. `tsc` errors TS2339 at (242,11),(282,11). |
| T4 | `Skeleton.setSlotsToSetupPose()` | L221 (`makeProbe`), L564 (`success`), L646 (`onSkinChange`) | `setSlotsToSetupPose()` | renamed **`setupPoseSlots()`** `Skeleton.d.ts:119` | **RENAMED** | `probe.setSlotsToSetupPose()` → `probe.setupPoseSlots()`. 3 sites. `tsc` errors TS2339 at (221,9),(564,24),(646,18). Note: the existing **call-order invariant** (skin set THEN slots-to-setup, per modal docstring + memory `project_strict_loadermode_separation`) is preserved by 4.3's `setSkin` JSDoc which explicitly says reset via `setupPoseSlots` after `setSkin`. |
| T5 | `AnimationState.getCurrent(0)` | L488 (`update` cb), L614 (`refreshBounds`), L668 (`onScrub`) | `getCurrent(trackIndex)` | **removed**; replacement **`getTrack(trackIndex): TrackEntry \| null`** `AnimationState.d.ts:169` | **CHANGED** | `p.animationState?.getCurrent(0)` → `p.animationState?.getTrack(0)`. Return shape identical for the modal's usage: `TrackEntry.animation` (`Animation\|null`, `.d.ts:186`) → `.name`, `.duration`. 3 sites. `tsc` errors TS2339 at (488,35),(614,40),(668,36). |
| T6 | `SpinePlayer.playTime` (read+write) | L673 `const delta = targetTime - p.playTime`, L680 `p.playTime = targetTime` | `private playTime` (4.2.111 `Player.d.ts:120` — already private there too) | **`private playTime`** `Player.d.ts:120` | **CHANGED (was already a latent private-access; 4.3.0 surfaces it)** | No public `playTime` setter exists. Public time surface in 4.3.0 `SpinePlayer`: `time: TimeKeeper`, `paused`, `speed`, `setAnimation`, `addAnimation`, `setViewport`; `AnimationState.getTrack(0)` → `TrackEntry.trackTime` (`.d.ts:271`), `TrackEntry.getAnimationTime()` (`.d.ts:357`), `TrackEntry.animationStart/End` (`.d.ts:243,246`). **Recommended scrub rework (Claude's discretion under D-04 — minimal):** drive the seek via the `TrackEntry` instead of `p.playTime`: read `entry.animation.duration`, compute `targetTime`, set position via the existing `animationState.update(delta)/apply` sequence the modal already uses, and replace the `p.playTime` read/write with `entry`-derived time (`entry.trackTime` or `entry.getAnimationTime()` for the readback; the modal's own `scrubPercent` state is the UI source of truth so the write-back can be dropped). `tsc` errors TS2341 at (673,34),(680,7). **This is the single most design-sensitive migration item — it changes how the scrub computes/writes time, NOT just a rename. It must preserve VIEWER-06 scrub-pose synchrony (Phase 41 UAT #2) and pause-on-scrub.** |
| T7 | `SpinePlayerConfig` object literal | L457-573 | `preserveDrawingBuffer` optional | **`preserveDrawingBuffer: boolean` required** `Player.d.ts:72` (also already required in 4.2.111 `Player.d.ts:72`) | **CHANGED (latent; surfaces under the bump)** | Add `preserveDrawingBuffer: false` to the config object. (spine-player only reads it as `new ManagedWebGLRenderingContext(canvas, { alpha: config.alpha, preserveDrawingBuffer: config.preserveDrawingBuffer })` `Player.js:191` — `false` matches the pre-bump effective default.) `tsc` error TS2741 at (457,13). |
| T8 | `p.skeleton` / `p.animationState` nullability | L549,L550,L563,L564,L675,L676,L679 | `Skeleton` (looser) | **`skeleton: Skeleton \| null`** `Player.d.ts:125`, **`animationState: AnimationState \| null`** `Player.d.ts:126` | **CHANGED (stricter null typing)** | Add null-guards (the `success` callback runs after load so `p.skeleton` is non-null there; the modal needs `if (!p.skeleton) return;` / optional chaining at the flagged sites). `tsc` errors TS18047 at (549,30),(550,25),(563,13),(564,13),(675/676/679), TS2345 at (675,28). |
| S1 | `new Skeleton(live.data)` | L218 (`makeProbe`) | `constructor(data: SkeletonData)` | `constructor(data: SkeletonData)` `Skeleton.d.ts:102` | **STABLE** | No change. (Note: 4.3 `RegionAttachment`/`MeshAttachment` ctors changed — but `makeProbe` constructs only a `Skeleton` from existing `data`, never an attachment, so the loader-side attachment-ctor delta in STACK.md does NOT reach the modal.) |
| S2 | `Skeleton.getBounds(off, size, temp)` | L257, L286 | `getBounds(offset, size, temp?, clipper?)` | `getBounds(offset, size, temp?, clipper?)` `Skeleton.d.ts:189` | **STABLE** | Identical signature. Returns the **applied-pose** AABB (`.d.ts:189` JSDoc explicitly "for the applied pose") — exactly what the modal needs. |
| S3 | `Skeleton.update(delta)` | L676 (`onScrub`) | `update(delta): void` | `update(delta): void` `Skeleton.d.ts:199` | **STABLE** | Unchanged. |
| S4 | `Skeleton.updateWorldTransform(Physics)` | L256, L283, L679 | `updateWorldTransform(physics: Physics)` | `updateWorldTransform(physics: Physics)` `Skeleton.d.ts:113` | **STABLE** | Unchanged. `Physics` enum still exported (`Physics.d.ts:30`); modal uses both the imported `Physics.update` (L256/283) and the literal `2` (L679, CLAUDE.md fact #3) — both still valid (`Physics.update === 2`). |
| S5 | `Skeleton.skin?.name` | L217 (`makeProbe`) | `skin: Skin \| null`; `Skin.name: string` | `skin: Skin \| null` `Skeleton.d.ts:68`; `Skin.name: string` `Skin.d.ts:51` | **STABLE** | Unchanged. |
| S6 | `SkeletonData.findAnimation`, `.animations`, `.skins` | L240, L549, L550 | present | `findAnimation(name): Animation\|null` `SkeletonData.d.ts:103`; `animations: Animation[]` :55; `skins: Skin[]` :46 | **STABLE** | Unchanged. |
| S7 | `AnimationState.update(delta)` / `.apply(skeleton)` | L674, L675 | `update(delta): void`, `apply(skeleton): boolean` | `update(delta): void` `AnimationState.d.ts:59`, `apply(skeleton): boolean` :65 | **STABLE** | Unchanged (modulo T8 null-guard on the `apply` arg). |
| S8 | `SpinePlayer.setAnimation(name, loop)` | L561, L632 | `setAnimation(animation, loop?): TrackEntry` | `setAnimation(animation: string\|Animation, loop?): TrackEntry` `Player.d.ts:147` | **STABLE** | Unchanged (string overload). |
| S9 | `SpinePlayer.play()/pause()/dispose()` | L655,L658,L601 | present | `play()` `Player.d.ts:145`, `pause()` :146, `dispose()` :139 | **STABLE** | Unchanged (the double-dispose `disposed`-flag guard, Pitfall 5, stays valid — `dispose()` still idempotent-safe to wrap in try/catch). |
| S10 | `p.sceneRenderer` / `.camera` / `p.canvas` | L309-311 (`readMetrics`) | `sceneRenderer: SceneRenderer\|null`, `canvas: HTMLCanvasElement\|null` | `sceneRenderer: SceneRenderer \| null` `Player.d.ts:110`, `canvas: HTMLCanvasElement \| null` :108 | **STABLE (already null-guarded)** | `readMetrics` already does `if (!sr \|\| !canvas) return null` — the modal's existing null-handling matches 4.3's nullability here. `SceneRenderer.camera` (the auto-fit-neutralizer write path) is from spine-webgl; the `config.update(player, delta)` hook is still in `SpinePlayerConfig` (`Player.d.ts:89`) and still invoked after the auto-fit camera set / before draw (the camera-freeze mechanism survives). |
| S11 | `config.viewport` fixed-dummy (disables native `calculateAnimationViewport`) | L527-538 | honored verbatim if x/y/w/h present | `Player.js:166-173` honors a supplied `config.viewport`; `calculateAnimationViewport` is `private` and only called when viewport is auto | **STABLE** | The "feed a fixed viewport so the fatal showError sampler never runs" trick still works. `config.viewport.animations`/`transitionTime` still read. |
| S12 | atlas-parent-dir resolution ("vendored line 5862") + `rawDataURIs` | `buildAssetFeed` (L340-368) | spine-player resolves page PNGs via parent-of-atlas-URL; `rawDataURIs` map keyed `<name>.png` | `Player.js:202-211`: `assetManager = new AssetManager(context, "", downloader)`; `setRawDataURI(path, uri)` per `config.rawDataURIs`; `loadTextureAtlas(config.atlas)` — same parent-relative `AssetManager` model | **STABLE (mechanism preserved; line number moved)** | The specific "line 5862" is stale (different build) but the *behavior* — `AssetManager.loadTextureAtlas` resolving page images relative to the atlas path / via `rawDataURIs` keys — is unchanged in 4.3.0. The modal's `app-image://` URL feed + `rawDataURIs` keying needs **no change**, but this is a render-behavior touchpoint → it is part of the D-02 owner UAT (atlas-source AND atlas-less must both render; UAT #5 atlas-less parity covers it). |
| S13 | spine-player throws after firing `config.error` | L578-592 (try/catch around `new SpinePlayer`) | documented "vendored line 14954" throw-after-error | `Player.js`: `validateConfig` / `loadSkeleton` call `this.showError(...)` then the constructor path can throw; `error: (player, msg) => void` still in `SpinePlayerConfig` `Player.d.ts:86` | **STABLE** | The modal's "swallow the constructor throw because `config.error` already transitioned state" handling stays valid. The terminal-error overlay (UAT #4) exercises this. |

**Audit verdict:** The migration is **8 changed touchpoints (T1–T8), all renderer-local in one file**, plus the lockstep test-mock migration. No spine-webgl-API signature the modal calls *directly* broke (the modal never calls spine-webgl directly — it goes through `SpinePlayer`/`SceneRenderer.camera`). The render-behavior touchpoints (S10–S13) are API-stable but are exactly the things the D-02 owner UAT must visually confirm because "compiles" ≠ "renders identically" across a Pose-rewrite major.

## Architecture Patterns

### System Architecture Diagram

```
                            Phase 47 change surface
                            ════════════════════════

  package.json                                    AnimationPlayerModal.tsx
  ┌──────────────────────┐                        ┌─────────────────────────────────┐
  │ spine-player          │   bump 4.2.111→4.3.0  │ import { Physics, Skeleton,      │
  │  4.2.111 ──────────►  │ ─────────────────────►│   SpinePlayer, Vector2,          │
  │  4.3.0                │   (pulls webgl@4.3.0) │   type SpinePlayerConfig }       │
  └──────────┬───────────┘                        │   from '@esotericsoftware/       │
             │                                     │        spine-player'             │
             │ bare-resolves                       │  ── DROP MixBlend, MixDirection  │
             ▼                                     └──────────────┬──────────────────┘
  @esotericsoftware/spine-core@4.3.0  ◄── frozen Phase 42         │ 8 touchpoint migrations
  (canonical; MixBlend/MixDirection                               ▼
   DELETED — split-brain source today) ──────────────► T1 apply() 8→10 arg (L255)
                                                       T2 setSkinByName→setSkin (×3)
  spine-webgl@4.3.0 (transitive)                       T3 setToSetupPose→setupPose (×2)
  ┌─────────────────────────────────┐                 T4 setSlotsToSetupPose→
  │ SkeletonRenderer: premultiply    │                    setupPoseSlots (×3)
  │   vertex color ×alpha (always)   │                 T5 getCurrent(0)→getTrack(0) (×3)
  │ PolygonBatcher: srcRgbPma=GL_ONE │                 T6 p.playTime (private) →
  │   (no pma param — 4.2 had one)   │                    TrackEntry-driven scrub
  │ GLTexture: UNPACK_PREMULTIPLY_   │  ◄── config     T7 +preserveDrawingBuffer:false
  │   ALPHA = !pma  (the straight-   │     .premult-   T8 skeleton/animationState
  │   alpha decision moved HERE)     │     ipliedAlpha    null-guards
  └─────────────────────────────────┘     :false      └────────────┬──────────────────┘
             │                                                       │ lockstep
             │ renders                                               ▼
             ▼                                  tests/renderer/animation-player-modal.spec.tsx
  ┌─────────────────────────────┐               (mock surface: setSkinByName/setToSetupPose/
  │ GL canvas in modal          │                getCurrent/MixBlend/MixDirection — ALL old
  │ (D-02 owner visual UAT:      │                names → must migrate or false-green)
  │  SIMPLE_TEST 4.2 + 4.3 +     │
  │  5 Phase 41 UATs + GL-halo)  │  ◄── 11 RED renderer suites go GREEN only when the
  └─────────────────────────────┘      FULL modal migration lands (not line-255 alone)

  Trace the primary path: bump → spine-core resolves 4.3.0 → modal's 8 API calls break →
  migrate all 8 + test mock → typecheck:web 0 errors + 11 suites green (machine half) →
  owner runs Electron, renders SIMPLE_TEST(4.2) + skeleton2(4.3), checks GL halo + 5 UATs
  (human half) → both green → D-01 lets v1.6 close.
```

### Recommended change shape (not a project structure — this is a surgical edit)

```
package.json                                  # 1 line: spine-player 4.2.111 → 4.3.0
package-lock.json                             # regenerated (npm install / npm ci)
src/renderer/src/modals/AnimationPlayerModal.tsx   # imports (drop 2) + 8 touchpoint migrations
tests/renderer/animation-player-modal.spec.tsx     # mock surface migrated in LOCKSTEP
.planning/phases/41-spine-animation-viewer/41-HUMAN-UAT.md  # D-08: flip 5 pending → resolved
.planning/phases/47-.../47-HUMAN-UAT.md       # D-08: NEW, owner-signed, 5 UATs + GL-alpha
```

### Pattern 1: Single atomic migration unit (bump + full modal + test mock together)

**What:** The package.json bump, the complete 8-touchpoint modal migration, and the test-mock migration are one logical change that must land together (one commit or one tightly-ordered wave with no green gate in between).
**When to use:** Always here — a partial state does not compile (`typecheck:web` non-zero) and does not un-RED the 11 suites. There is no meaningful intermediate "green" checkpoint between "pre-bump" and "fully migrated".
**Example:** The migrated line-255 from D-04 + the T2–T8 edits from the audit table, applied as a set.

### Pattern 2: Lockstep test-mock migration (false-green prevention)

**What:** `tests/renderer/animation-player-modal.spec.tsx:85-156` mocks `@esotericsoftware/spine-player` and hardcodes the **4.2 method names** on its mock `Skeleton`/`player`/`animationState`: `setSkinByName` (L91,143), `setSlotsToSetupPose` (L92,144), `setToSetupPose` (L93), `getCurrent` (L149,321), and the mock module exports `MixBlend: { setup: 0 }`, `MixDirection: { mixIn: 0 }` (L106-107). It also asserts the old call order (`setSkinByName THEN setSlotsToSetupPose`, L594-610) and reads `playTime` (L131,311).
**When to use:** This mock MUST be migrated in the same change as the modal. If the modal moves to `setSkin`/`setupPose`/`setupPoseSlots`/`getTrack` but the mock still exposes the old names, the mock becomes a **stale mirror**: the suite could pass against a mock that no longer resembles the real 4.3.0 surface, green-washing a broken modal (Pitfall: the `feedback_verify_all_entrypoint_runtimes` class — testing against a fiction).
**Example:** Mock `Skeleton.setSkin(): void {}`, `setupPose(): void {}`, `setupPoseSlots(): void {}`; `animationState.getTrack: vi.fn(() => ({ animation: { duration: 1, name: 'idle' }, trackTime: 0 }))`; drop the `MixBlend`/`MixDirection` mock exports; update the call-order assertion to `setSkin THEN setupPoseSlots`.

### Anti-Patterns to Avoid

- **Migrating only line 255 (literal D-04) and stopping:** Leaves 21 of 22 type errors; `typecheck:web` stays RED; the 11 suites stay RED (they fail at *import* of the modal, not at the apply call). D-05 (also locked) mandates the full audit-driven migration.
- **Broadening CSP/CORS "to be safe" for the 4.3 player:** The S12 audit confirms 4.3.0 uses the same parent-relative `AssetManager` model — no new origin/`connect-src`/ACAO is needed. The current `connect-src 'self' app-image:` (verified in `src/renderer/index.html:7`) stays as-is. Broadening it is a security regression (PITFALLS guardrail).
- **Changing `premultipliedAlpha:false`/`alpha:false` preemptively because the GL path changed:** The config still produces a correct straight-alpha render in 4.3.0 (see GL section). Only change it if the owner's empirical SIMPLE_TEST render shows a halo AND the change is justified by the verified 4.3.0 pipeline — not on speculation.
- **Touching `src/core/*`, `errors.ts`, or any spine-core / spine-core-42 line:** Out of scope (CONTEXT deferred). spine-core@4.3.0 is frozen-canonical from Phase 42; the viewer migration must not perturb it.
- **Treating the viewer as separately revertible:** D-03 proved it is not under frozen-canonical 4.3.0. Any plan language implying a revert fallback contradicts D-01 + the verified split-brain.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GL straight-alpha / premultiply correctness | A custom shader or manual `pixelStorei`/`blendFunc` in the modal | spine-webgl@4.3.0's built-in pipeline configured via `SpinePlayerConfig.premultipliedAlpha:false` | 4.3.0 already does the correct thing (vertex-premultiply + `UNPACK_PREMULTIPLY_ALPHA=!pma`); the modal only sets the flag. Hand-rolling GL state inside a React modal that wraps spine-player is exactly the fragility Phase 41 G-03 fought. |
| Animation viewport / fit on content-less animations | Re-adopting spine-player's native `calculateAnimationViewport` | The existing custom `sampleAnimationBounds`/`computeFit` (keep verbatim, migrate only the 8 touchpoints) | Explicitly D-04. Native path calls fatal `showError` on STOP-state animations; the resilient custom path is the whole reason this code exists. Still `private` + still fatal in 4.3.0. |
| Seek/scrub time control (T6) | A new rAF loop or direct private-field poke (`(p as any).playTime`) | `AnimationState.getTrack(0)` + `TrackEntry.trackTime`/`getAnimationTime()` + the existing `animationState.update/apply` sequence | `playTime` is `private` in both 4.2.111 and 4.3.0; an `as any` cast is a latent break and a code-review reject. The public `TrackEntry` time surface is the supported path. |
| Skin switching | Manual slot-attachment rebinding | `Skeleton.setSkin(name)` THEN `setupPoseSlots()` | 4.3's `setSkin` JSDoc documents the exact reset contract; reimplementing slot rebinding reintroduces the leftover-skin-bleed bug `project_strict_loadermode_separation` guards. |

**Key insight:** Phase 47's entire job is to *re-point the modal at the equivalent 4.3.0 APIs*, not to reimplement any rendering, animation, or fit math. Every "hand-roll" temptation here (GL state, viewport, scrub time) is a place where the 4.3.0 library still owns the logic — the migration is purely about calling it correctly.

## GL Straight-Alpha: Mechanism Changed (Pitfall 7 — the hard floor)

**This is the highest-risk item (PITFALLS "NEVER skip"). The `sharp`/`libvips` PMA reasoning (`project_pma_no_op_in_current_stack`) does NOT transfer — and additionally, the spine-webgl GL mechanism itself changed between 4.2.111 and 4.3.0.** `[VERIFIED: 4.2.111 installed node_modules vs freshly-packed 4.3.0 spine-webgl tarball]`

**4.2.111 (current — what Phase 41 G-03 was fixed against):**
- `PolygonBatcher.setBlendMode(blendMode, premultipliedAlpha)` — `srcColorBlend = premultipliedAlpha ? blendModeGL.srcRgbPma : blendModeGL.srcRgb`. With `premultipliedAlpha:false` the modal's config selected `srcRgb = GL_SRC_ALPHA` (straight-alpha blend).
- `SkeletonRenderer.js`: `darkColor.a = premultipliedAlpha ? 1.0 : 0.0`.
- `SceneRenderer.drawSkeleton(skeleton, premultipliedAlpha=false, ...)` — pma threaded as a render-time arg.
- This is the "Player.js:13167 picks `srcFunc=gl.ONE`" mechanism the modal comment + 41-HUMAN-UAT G-03 describe.

**4.3.0 (post-bump — VERIFIED from the packed tarball):**
- `PolygonBatcher.setBlendMode(blendMode)` — **no `premultipliedAlpha` parameter**. `const srcColorBlend = blendModeGL.srcRgbPma` (always the PMA blend; for normal blend `srcRgbPma = GL_ONE`). The non-PMA `srcRgb` entries were **removed** from the `blendModeGL` table.
- `SkeletonRenderer.js:130-160`: the vertex color is **always pre-multiplied by alpha** (`finalColor.r = skeletonColor.r * slotColor.r * attachmentColor.r * alpha`, …, `finalColor.a = alpha`); `darkColor.a = 1` is hardcoded.
- `SceneRenderer.drawSkeleton(skeleton, slotRangeStart, slotRangeEnd, transform)` — **`premultipliedAlpha` arg dropped**.
- `GLTexture.js:88`: `gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !this.pma)` — **the straight-vs-PMA decision moved to the texture upload.**
- `Player.js:744` still passes `config.premultipliedAlpha` to `renderer.drawSkeleton(...)` but spine-webgl 4.3.0 **ignores that arg** (signature dropped it). However `config.premultipliedAlpha` is **still wired to texture creation**: `AssetManager` constructs `GLTexture(context, image, pma)` and `GLTexture.pma` drives `UNPACK_PREMULTIPLY_ALPHA_WEBGL = !pma`.

**Net effect (the correctness reasoning):** With `config.premultipliedAlpha:false` → `texture.pma=false` → `UNPACK_PREMULTIPLY_ALPHA_WEBGL = !false = true` → WebGL premultiplies the (browser-decoded straight-alpha) texture **on upload**. The renderer then multiplies the vertex color by alpha and blends with `GL_ONE`. This is the **standard, mathematically-correct premultiply-in-pipeline path for a straight-alpha source texture** — it should produce a correct render with no white halo, *the same visual result* as the 4.2.111 `premultipliedAlpha:false` config, reached by a different internal route.

**Why this is still HIGH RISK and the owner re-verify is non-skippable:**
1. The Phase 41 G-03 root-cause note (`41-HUMAN-UAT.md` test 1 G-03) literally cites the 4.2.111 mechanism ("`srcFunc=gl.ONE` Player.js:13167") that **no longer exists** — anyone reasoning from that note will reason about a deleted code path.
2. The dark-fringe/double-multiply failure mode depends on the *exact* interaction of (browser decode un-premultiply) × (`UNPACK_PREMULTIPLY_ALPHA_WEBGL`) × (vertex-color premultiply) × (`GL_ONE` blend). The analysis above says it cancels correctly, but it is a **4-factor interaction across a major version** — "the math says it's fine" is exactly the class of claim PITFALLS says must be empirically verified for this item, never assumed.
3. `config.alpha:false` (the second half of the modal's straight-alpha config) controls the WebGL **context** alpha (`Player.js:191` `new ManagedWebGLRenderingContext(canvas, { alpha: config.alpha, ... })`) and the pre-first-frame background flash (`Player.js:184`) — unchanged in 4.3.0, but it interacts with the backing-store compositing and is part of the same visual contract.

**Concrete empirical re-verification method (for the D-02 owner checkpoint + the plan's GL-alpha task):**
- **Render target:** `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (D-09 4.2 canary — the rig Phase 41 G-03 was *reproduced* on; it has CIRCLE/SQUARE/TRIANGLE region + mesh attachments with transparent border pixels — the exact content that exhibited the halo).
- **Artifact to look for:** an **opaque-white (or bright) ring/fringe around mesh-attachment edges** and any **dark fringe/double-darkened** edge on semi-transparent pixels, against the `#232732` panel background. The G-03 signature was transparent-white border pixels `(255,255,255,0)` rendering as opaque white.
- **Pass criterion:** edges anti-alias cleanly into the background with no white halo and no dark seam — visually identical to the v1.5.1 (4.2.111) render of the same rig at the same pose/zoom (D-06 same-framing parity).
- **Also render the 4.3 leg:** `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (D-09) — confirm the same clean-edge result on a native-4.3 rig (rules out a 4.3-fixture-specific texture/atlas interaction).
- **Optional regression sentinel parallel:** the project already has `scripts/pma-probe.mjs` as the *sharp/libvips* PMA sentinel — note explicitly in the plan that it does **not** cover this GL path (different stack); the GL-alpha evidence is the owner's eyes on the rendered canvas, captured as a screenshot in `47-HUMAN-UAT.md`.

**Decision rule (Claude's discretion under D-04/D-05):** Do **not** preemptively change `premultipliedAlpha:false`/`alpha:false`. Land the bump + migration with the config **unchanged**; the owner renders SIMPLE_TEST + skeleton2. *If* a halo/fringe appears, the D-05 GL analysis above is the diagnostic map (the lever is now `pma` → `UNPACK_PREMULTIPLY_ALPHA_WEBGL`, not `setBlendMode`'s gone pma arg) — but only change config if an artifact is observed AND the change is explained by the verified 4.3.0 pipeline.

## Common Pitfalls

### Pitfall 1: Treating this as a one-line `apply()` migration
**What goes wrong:** Plan migrates line 255 only; `typecheck:web` still has 21 errors; the 11 renderer suites stay RED (they fail at *import*, not at the apply call); phase looks "done" but neither completion track is green.
**Why it happens:** D-04 says "migrate **only** the line-255 call 1:1" — read in isolation that sounds like the whole job. But D-05 (equally locked) mandates the full internal-touchpoint audit, and the verified reality is 22 errors across 8 categories.
**How to avoid:** Plan the full 8-touchpoint migration (D-05 audit table) as the unit. The line-255 1:1 is *one* of the eight; D-04's "only" means "don't rewrite `sampleAnimationBounds`'s algorithm", not "ignore the other API breaks".
**Warning signs:** A plan task scoped as "migrate AnimationPlayerModal.tsx:255"; `npm run typecheck:web` non-zero after the "migration"; the 11 suites still in the FAIL list.

### Pitfall 2: Stale test mock green-washes a broken modal
**What goes wrong:** Modal migrates to `setSkin`/`setupPose`/`getTrack`; the test mock still defines `setSkinByName`/`setToSetupPose`/`getCurrent`. The suite passes (the modal calls the new names; the mock just doesn't have spies on them, or worse the modal still calls old names that the mock satisfies) — but the mock no longer resembles the real 4.3.0 surface, so a real-API mismatch ships green.
**Why it happens:** `vi.mock('@esotericsoftware/spine-player')` fully replaces the package; the mock is hand-written and currently encodes the 4.2 surface (verified: spec lines 85-156, 594-610).
**How to avoid:** Migrate the mock in the same change (Pattern 2). The call-order assertion at spec L594-610 (`setSkinByName THEN setSlotsToSetupPose`) must become `setSkin THEN setupPoseSlots` or it asserts a contract the migrated modal no longer has.
**Warning signs:** The mock module still exports `MixBlend`/`MixDirection`; the mock `Skeleton` still has `setSkinByName`; the spec passes but `grep setSkinByName tests/renderer/animation-player-modal.spec.tsx` still returns hits after the modal migration.

### Pitfall 3: Reasoning about GL alpha from the stale Phase 41 G-03 note
**What goes wrong:** Someone debugging a (hypothetical) post-bump halo reads `41-HUMAN-UAT.md` G-03 ("`srcFunc=gl.ONE` Player.js:13167"), goes looking for that blend-mode code in 4.3.0, doesn't find it (it was removed), and concludes the config is a no-op / chases the wrong lever.
**Why it happens:** The G-03 note documents the *4.2.111* mechanism faithfully; 4.3.0 moved the straight-alpha decision from `PolygonBatcher.setBlendMode` to `GLTexture` upload (`UNPACK_PREMULTIPLY_ALPHA_WEBGL = !pma`).
**How to avoid:** The plan's GL-alpha task must cite the **4.3.0** mechanism (this RESEARCH's GL section), not the G-03 note. `premultipliedAlpha:false` still has effect — it now drives texture-upload unpack, not blend-func selection.
**Warning signs:** A plan/commit references "Player.js:13167" or "srcFunc=gl.ONE" as the 4.3.0 lever; a fix that toggles a blend mode rather than the `pma`/upload path.

### Pitfall 4: Broadening CSP/CORS for the 4.3 player
**What goes wrong:** Assuming a major bump needs more network/origin surface; relaxing `connect-src` or the `app-image://` ACAO "to be safe".
**Why it happens:** Phase 41 needed bespoke CSP/CORS for the viewer (G-01/G-02); a naive read says "4.3 might need more".
**How to avoid:** The S12 audit verified 4.3.0 uses the **same** parent-relative `AssetManager`/`rawDataURIs` model — no new origin. Keep `src/renderer/index.html:7` `connect-src 'self' app-image:` exactly as-is. This is a Claude's-discretion item explicitly scoped "do NOT broaden".
**Warning signs:** Any diff to `src/renderer/index.html` CSP or the main-process `app-image://` ACAO header; a plan task to "verify/adjust CSP" that proposes a widened directive.

### Pitfall 5: The scrub `playTime` rework regressing VIEWER-06
**What goes wrong:** T6 (`p.playTime` is private) is the only touchpoint that is not a mechanical rename — it changes *how* the scrub computes/seeks time. A careless fix (e.g. dropping the delta computation, or mis-reading `trackTime` vs `getAnimationTime()`) silently breaks forward/backward scrub-pose synchrony — which is Phase 41 UAT #2, a host-blocked visual UAT that won't fail in jsdom.
**Why it happens:** It's tempting to `(p as any).playTime` to minimize the diff; or to assume `trackTime === playTime`. The modal currently uses `p.playTime` as the absolute seek base for `delta = targetTime - p.playTime`.
**How to avoid:** Use `getTrack(0)` → `TrackEntry`; the modal's own `scrubPercent` React state is the UI source of truth, so the seek can be computed from `entry.animation.duration * percentage` and applied via the existing `animationState.update(delta)/apply` + `skeleton.update/updateWorldTransform` sequence (already in `onScrub`), with the readback time taken from `entry.trackTime`/`getAnimationTime()` instead of `p.playTime`. Keep `p.pause()` + `setIsPaused(true)` (pause-on-scrub) and the `Physics.update` literal `2` (CLAUDE.md fact #3) unchanged. This is explicitly part of the D-02 owner UAT #2 (anim/skin switch + scrub synchrony, **forward AND backward** — see 41-HUMAN-UAT test 2 + the WR-05 backward-scrub caveat).
**Warning signs:** `as any` near `playTime`; the scrub no longer pauses; `onScrub` no longer computes a delta; UAT #2 backward-scrub produces incoherent poses.

## Code Examples

### The line-255 1:1 migration (D-04 — verified)
```ts
// Source: node_modules/@esotericsoftware/spine-core/dist/Animation.d.ts:93
//         cross-confirmed vs spine-player@4.3.0 dist/Player.js:644
// BEFORE (4.2, 8-arg):
//   anim.apply(probe, t, t, false, [], 1, MixBlend.setup, MixDirection.mixIn);
// AFTER (4.3, 10-arg) — MixBlend.setup→fromSetup=true, MixDirection.mixIn→out=false:
anim.apply(probe, t, t, false, [], 1, /*fromSetup*/ true, /*add*/ false, /*out*/ false, /*appliedPose*/ false);
```

### Imports (drop the two removed symbols)
```ts
// Source: node_modules/@esotericsoftware/spine-core/dist/index.d.ts
//         (MixBlend / MixDirection: 0 occurrences in 4.3.0 — removed entirely)
// BEFORE:
//   import { MixBlend, MixDirection, Physics, Skeleton, SpinePlayer, Vector2,
//            type SpinePlayerConfig } from '@esotericsoftware/spine-player';
// AFTER:
import {
  Physics,
  Skeleton,
  SpinePlayer,
  Vector2,
  type SpinePlayerConfig,
} from '@esotericsoftware/spine-player';
// Physics, Skeleton, Vector2, SpinePlayer, SpinePlayerConfig all still exported
// by spine-player@4.3.0 (verified: Player.d.ts + re-export of spine-core@4.3.0).
```

### Skin / setup-pose renames (T2/T3/T4 — verified)
```ts
// Source: node_modules/@esotericsoftware/spine-core/dist/Skeleton.d.ts
//   setSkin(skinName: string): void          // :131  (public; setSkinByName is private :142)
//   setupPose(): void                        // :115  (was setToSetupPose)
//   setupPoseSlots(): void                   // :119  (was setSlotsToSetupPose)
// makeProbe():            probe.setSkin(skinName); probe.setupPoseSlots();
// sampleAnimationBounds:  probe.setupPose();
// sampleSetupBounds:      probe.setupPose();
// success cb / onSkinChange: p.skeleton.setSkin(name); p.skeleton.setupPoseSlots();
//   (call order preserved per Skeleton.setSkin JSDoc: reset via setupPoseSlots after setSkin)
```

### AnimationState track access (T5 — verified)
```ts
// Source: node_modules/@esotericsoftware/spine-core/dist/AnimationState.d.ts:169
//   getTrack(trackIndex: number): TrackEntry | null   // replaces getCurrent
// BEFORE: const animName = p.animationState?.getCurrent(0)?.animation?.name;
// AFTER:  const animName = p.animationState?.getTrack(0)?.animation?.name;
// TrackEntry.animation: Animation | null (:186) — .name / .duration unchanged.
```

## State of the Art

| Old Approach (4.2.111) | Current Approach (4.3.0) | When Changed | Impact |
|------------------------|--------------------------|--------------|--------|
| `Animation.apply(skel, last, t, loop, ev, α, blend: MixBlend, dir: MixDirection)` | `Animation.apply(skel, last, t, loop, ev, α, fromSetup: bool, add: bool, out: bool, appliedPose: bool)` | 4.3.0 (Pose rewrite) | The one true API break D-04 targets; `MixBlend`/`MixDirection` enums **deleted** entirely. |
| `Skeleton.setSkinByName(name)` (public) | `Skeleton.setSkin(name)` (public); `setSkinByName` made `private` | 4.3.0 | T2 — 3 modal sites. |
| `Skeleton.setToSetupPose()` / `setSlotsToSetupPose()` | `setupPose()` / `setupPoseSlots()` | 4.3.0 | T3/T4 renames; also `setupPoseBones()` exists (modal doesn't use it). |
| `AnimationState.getCurrent(i)` | `AnimationState.getTrack(i)` | 4.3.0 | T5; `getCurrent` removed (broader: `setCurrent`→`setTrack` too, not modal-relevant). |
| spine-webgl `PolygonBatcher.setBlendMode(mode, pma)` selects `srcRgb`/`srcRgbPma` | `setBlendMode(mode)` — always `srcRgbPma`; premultiply moved to vertex-color + `GLTexture` `UNPACK_PREMULTIPLY_ALPHA=!pma` | 4.3.0 spine-webgl | The straight-alpha decision lever moved; `config.premultipliedAlpha:false` still effective but via texture upload, not blend func. The Phase 41 G-03 note describes the now-deleted mechanism. |
| spine-player `Player.js:640` `apply(..., MixBlend.setup, MixDirection.mixIn)` | `Player.js:644` `apply(..., true, false, false, false)` | 4.3.0 spine-player | Authoritative cross-confirmation of the D-04 migration mapping. |

**Deprecated/outdated:**
- The "vendored line 5862" (atlas parent-dir) and "Player.js:13167" (`srcFunc`) line numbers in the modal comments and `41-HUMAN-UAT.md` — stale (different build); the *behaviors* are the relevant thing (S12 atlas resolution: unchanged; GL alpha: mechanism moved per the GL section). Plan/code should reference behavior, not stale line numbers.
- `project_renderer_mixblend_preexisting_failure` memory's "ignore as pre-existing, NOT a regression" framing — **superseded by D-08 / CONTEXT**: these 11 suites are now **Phase-47-owned**; fixing them (via the full modal migration) is the machine-checkable deliverable, not noise to ignore.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The T6 scrub rework using `TrackEntry.trackTime`/`getAnimationTime()` instead of the private `p.playTime` preserves exact forward/backward scrub-pose synchrony. The signatures are verified; the *behavioral equivalence* of the reworked seek is reasoned, not executed (jsdom has no GL; only the D-02 owner UAT #2 can confirm). | D-05 T6, Pitfall 5 | Scrub-pose desync (esp. backward scrub, WR-05 caveat) ships; caught by owner UAT #2 (which is exactly why D-02 gates completion) but not by machine tests. **Mitigation: flag T6 as the design-sensitive item; the owner UAT #2 forward+backward scrub is the verification.** |
| A2 | `config.premultipliedAlpha:false` + `alpha:false` produces a visually-identical correct straight-alpha render in 4.3.0 (no halo) as it did in 4.2.111. The 4.3.0 pipeline (`UNPACK_PREMULTIPLY_ALPHA=!pma` + vertex-premultiply + `GL_ONE`) is verified from the tarball; the *visual cancellation* is a 4-factor analytical argument, not an executed render. | GL Straight-Alpha section | A white/dark halo ships on mesh attachments (the exact G-03 artifact). PITFALLS marks this "NEVER skip / highest risk". **Mitigation: the D-02 owner SIMPLE_TEST GL-halo check is mandatory and non-skippable; do not preemptively change the config.** |
| A3 | The D-05 audit is exhaustive for the modal's spine-player/spine-webgl touchpoints. Derived from a full read of `AnimationPlayerModal.tsx` + `npx tsc -p tsconfig.web.json` (22 errors, all enumerated). A touchpoint that is type-compatible but behaviorally changed in 4.3.0 (and thus not in the 22 errors) could exist (e.g. `SceneRenderer.camera` semantics, `getBounds` clipping defaults). | D-05 audit (S10–S13 flagged STABLE-by-type) | A behavioral (not type) regression slips past machine checks. **Mitigation: S10–S13 explicitly routed into the D-02 owner UAT; D-06 same-framing parity catches camera/fit drift; UAT #5 catches atlas-resolution/render drift.** |
| A4 | No `src/` file other than `AnimationPlayerModal.tsx` needs editing for PLAYER-01, and no test file other than `tests/renderer/animation-player-modal.spec.tsx` needs MixBlend-specific edits. Verified: `grep -rln "MixBlend\|MixDirection" src/` → only the modal; the other 10 RED suites import the modal **transitively** (via AppShell) and go green for free once the modal compiles. `tests/main/sampler-worker.spec.ts` references the *abort* in prose only (it asserts a non-zero exit; not a MixBlend import). | Standard Stack / Summary | A second edit site is missed; some RED suite stays RED after the migration. **Mitigation: the verification gate is "all 11 named suites GREEN + full `npm test` no new failures", which empirically catches any missed transitive consumer.** |

## Open Questions

1. **Does the 4.3.0 `SkeletonRenderer` vertex-premultiply + browser-decode-unpremultiply + `UNPACK_PREMULTIPLY_ALPHA_WEBGL=!pma` chain cancel to a pixel-identical result vs 4.2.111 on SIMPLE_TEST's transparent-border mesh pixels?**
   - What we know: each stage is verified from the tarball; the composition is the standard correct straight-alpha pipeline; spine-player's own default (`premultipliedAlpha` undefined → `true`) differs from the modal's explicit `false`, and the modal's `false` is the Phase-41-correct choice.
   - What's unclear: pixel-exact visual equivalence across the major — only an actual GL render shows it.
   - Recommendation: **Do not resolve analytically.** This is precisely the D-02 owner SIMPLE_TEST GL-halo checkpoint. Land config unchanged; owner verifies; the GL section is the diagnostic map if an artifact appears.

2. **T6 scrub: `entry.trackTime` vs `entry.getAnimationTime()` for the readback time?**
   - What we know: `TrackEntry.trackTime` (`.d.ts:271`) is the raw track time; `getAnimationTime()` (`.d.ts:357`) is clamped to `[animationStart, animationEnd]` and loop-folded. The modal's `onScrub` sets an absolute target and pauses (no loop progression mid-scrub).
   - What's unclear: which gives the smoothest forward+backward scrub UX without an off-by-loop jump.
   - Recommendation: Use the modal's own `scrubPercent` React state as the UI source of truth (it already is) and `entry.animation.duration * percentage` for the target; the `entry` time field is only needed for the delta base — `trackTime` is the closest analog to the old `p.playTime`. Leave the exact choice to implementation; UAT #2 (forward+backward) is the acceptance gate. (Low risk — the seek math is small and the visual UAT is decisive.)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@esotericsoftware/spine-player@4.3.0` | PLAYER-01 bump | ✓ (on npm; `npm pack` succeeded this session) | 4.3.0 (published 2026-05-15) | — (none; D-03: revert infeasible) |
| `@esotericsoftware/spine-webgl@4.3.0` | transitive (spine-player dep) | ✓ | 4.3.0 | — |
| `@esotericsoftware/spine-core@4.3.0` | bare-resolved by spine-player | ✓ (already canonical, installed, frozen Phase 42) | 4.3.0 | — |
| `npm` (install/ci) | dependency bump + lockfile | ✓ | (project standard) | — |
| `node` + `tsc` (`typecheck:web`) | machine-track gate | ✓ | (project standard) | — |
| `vitest` | renderer suite (11 RED → green) gate | ✓ | 4 | — |
| Electron app runnable on the owner's machine | D-02 owner live UAT (5 UATs + GL-alpha) | ✓ (owner's dev box; Phase 46 used the same owner-checkpoint pattern) | — | — (D-01: no fallback; v1.6 close held until owner signs) |
| Spine editor | NOT needed — both D-09 fixtures already in-repo | n/a | — | — |

**Missing dependencies with no fallback:** None — all required packages are on npm and the canonical 4.3.0 is already installed.
**Missing dependencies with fallback:** None.

## Validation Architecture

> Nyquist validation is ENABLED (`.planning/config.json` `workflow.nyquist_validation: true`). The phase has a **two-track completion contract** (CONTEXT specifics + D-01/D-02).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4 (jsdom env for `tests/renderer/*`, node env for `tests/main/*`/`tests/core/*`) |
| Config file | `vitest.config.ts` (project-standard; no change this phase) |
| Quick run command | `npx vitest run tests/renderer/animation-player-modal.spec.tsx tests/renderer/app-shell-animation-viewer.spec.tsx` |
| Renderer-suite run | `npx vitest run tests/renderer/` (the 11 RED suites live here) |
| Full suite command | `npm test` (vitest run) |
| Typecheck gate | `npm run typecheck:web` (the Phase 42 → 47 handoff surface — currently **22 errors**, all in `AnimationPlayerModal.tsx`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | Exists? |
|--------|----------|-----------|-------------------|---------|
| PLAYER-01 | spine-player bumped 4.2.111→4.3.0; MixBlend/MixDirection imports dropped; apply() migrated | machine: typecheck | `npm run typecheck:web` → **0 errors** (from 22) | ✅ (gate exists; currently RED by design) |
| PLAYER-01 | Modal compiles + 8 touchpoints migrated; no MixBlend import anywhere | machine: lint/grep | `! grep -rq "MixBlend\|MixDirection" src/` | ✅ (grep) |
| PLAYER-01 | 11 renderer suites no longer fail at import | machine: unit | `npx vitest run tests/renderer/` → 0 failed suites (from 11) | ✅ (suites exist; currently RED) |
| PLAYER-01 | Test mock migrated in lockstep (no stale 4.2 surface) | machine: unit + grep | `animation-player-modal.spec.tsx` green AND `! grep -q "setSkinByName\|getCurrent\|MixBlend" tests/renderer/animation-player-modal.spec.tsx` | ✅ (spec exists; mock currently 4.2-shaped) |
| PLAYER-01 | No new failures elsewhere (regression) | machine: full suite | `npm test` → no new failures vs the documented pre-47 baseline (1280 passed / 0 actual failures, 11 suites RED at import per STATE 2026-05-18) | ✅ |
| PLAYER-02 | SIMPLE_TEST (4.2) renders correctly through 4.3 player | **human (D-02)** | owner live Electron — D-09 4.2 leg | ❌ jsdom has no WebGL → Wave-0 N/A; owner checkpoint only |
| PLAYER-02 | skeleton2.json (4.3) renders correctly through 4.3 player | **human (D-02)** | owner live Electron — D-09 4.3 leg | ❌ owner checkpoint only |
| PLAYER-02 | GL straight-alpha: no white/dark halo on SIMPLE_TEST mesh attachments | **human (D-02)** | owner live Electron — render SIMPLE_TEST, inspect mesh edges vs `#232732` bg (GL section method) | ❌ owner checkpoint only ("NEVER skip") |
| PLAYER-02 | 5 carried Phase 41 UATs re-run green on 4.3 player (anim/skin+scrub synchrony; GL leak ×10; real-fs error UI; atlas-less parity; File-menu suppression) | **human (D-02)** | owner live Electron per `41-HUMAN-UAT.md` tests 2–6 | ❌ owner checkpoint only; D-08 records in `47-HUMAN-UAT.md` + flips 41's 5 pending |
| PLAYER-02 | Same-framing parity (D-06): 4.2 rig looks identical through 4.3 player (no auto-fit/zoom/pos drift) | **human (D-02)** | owner compares vs v1.5.1 framing (screenshot or documented zoom/pos values) | ❌ owner checkpoint only |

### Sampling Rate (what makes the regression detectable)
- **Per task commit:** `npx vitest run tests/renderer/animation-player-modal.spec.tsx` + `npm run typecheck:web` (the migration is one unit; the meaningful sampling point is "does the modal compile + does its own spec pass").
- **Per wave merge:** `npx vitest run tests/renderer/` (all 11 formerly-RED suites green) + `npm test` (no new failures) + `npm run typecheck:web` (0 errors) + `npm run typecheck:node` (must stay at its **pre-existing** RED baseline — see note — NOT newly worsened).
- **Phase gate (machine half):** Full `npm test` green-modulo-the-documented-preexisting (renderer MixBlend suites now FIXED, so the only allowed residual is the separately-tracked `project_renderer_mixblend_preexisting_failure`'s ~11 *runtime* MixBlend test-file failures IF distinct from the import failures — verify which; the 11 *import-failure* suites this phase owns must be GREEN) + `typecheck:web` 0 + no `MixBlend`/`MixDirection` in `src/`.
- **Phase gate (human half — D-02, gates v1.6 close per D-01):** owner `checkpoint:human-action` — all 5 Phase 41 UATs + GL-alpha SIMPLE_TEST + skeleton2 4.3 render, signed in `47-HUMAN-UAT.md`. **Visual regression detectability:** the GL-halo and same-framing-parity (D-06) defects are *only* detectable by rendering the D-09 pair in a real GL context and visually comparing to the v1.5.1 baseline — no machine sampling can observe them (jsdom has no WebGL). The Nyquist "sampling rate" for the visual regression is therefore: **the owner's eyes on the SIMPLE_TEST + skeleton2 render at the documented Phase-41 poses/zoom**, captured as screenshots in `47-HUMAN-UAT.md` so the observation is durable and re-checkable.

### Wave 0 Gaps
- [ ] None for machine infra — `vitest`, `tsc`, the 11 suites, and `animation-player-modal.spec.tsx` (mock harness) all already exist. The "gap" is that they are **currently RED by design** (pre-bump split-brain); Phase 47's migration is what turns them green. No new test file or framework install needed.
- [ ] **Test-mock migration is a required co-task** (not a gap, a Wave-1 item): `tests/renderer/animation-player-modal.spec.tsx:85-156,594-610` mock surface must migrate in lockstep with the modal (Pattern 2 / Pitfall 2) — flag explicitly so the planner schedules it inside the migration unit, not as a follow-up.
- [ ] **`47-HUMAN-UAT.md` authoring** (D-08) — new owner-signed artifact (5 UATs + GL-alpha + D-09 4.2/4.3 renders) — and the in-place flip of the 5 pending items in `41-HUMAN-UAT.md`. This is a deliverable, not a test gap, but it is the human-track validation artifact and must exist for milestone close.
- [ ] **`typecheck:node` baseline note:** per memory `project_typecheck_node_preexisting_red`, `npm run typecheck:node` is **pre-existingly RED** (v1.0-era probe scripts + Phase 43/44 test-family gap) — Phase 47 must prove via `git diff --name-only` it did not *worsen* `typecheck:node`, not that it is clean. The post-merge build gate uses `typecheck`/`typecheck:web`, not `npm run build` (electron-builder).

## Security Domain

> `security_enforcement` is not present in `.planning/config.json` (absent = enabled).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Desktop app, no auth surface; bump touches none. |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | no (no new input path) | The modal already validates via `buildAssetFeed`/IPC (Phase 41); the bump adds no input surface. spine-player parses fixture JSON it always did. |
| V6 Cryptography | no | n/a |
| V14 Configuration / CSP | **yes** | `Content-Security-Policy` meta in `src/renderer/index.html:7` (`default-src 'self'; … connect-src 'self' app-image:; img-src 'self' data: app-image:; …`) + the `app-image://` protocol handler's CORS ACAO (main process). Phase 41 G-01/G-02 hard-won. **Control: keep origin-scoped — the bump must NOT broaden it (S12 audit confirms 4.3.0 needs no wider surface).** |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Dependency-bump silently widens renderer network/origin surface (spine-player 4.3 asset resolution) | Elevation of Privilege / Information Disclosure | S12 audit verified 4.3.0 uses the same parent-relative `AssetManager`+`rawDataURIs` model → no CSP/CORS change. Plan must include a "CSP/`app-image://` ACAO byte-unchanged" assertion (grep/diff guard on `src/renderer/index.html` + the main protocol handler). |
| Malicious/oversized fixture JSON crashing the renderer via the bumped player | Denial of Service | Pre-existing terminal-error overlay + the resilient `sampleAnimationBounds` (D-04, must-not-regress) already contain this; UAT #4 (real-fs malformed/missing asset) re-verifies on 4.3.0. |
| Supply-chain: wrong spine-player version / split-brain shipping a mismatched runtime | Tampering | Exact-pin `4.3.0` + committed `package-lock.json` + `npm ci` (project convention). The D-03 split-brain is itself a (currently-live) instance of this — the migration resolves it; the runtime-distinctness posture is owned by Phase 42's gates (not re-litigated here). |

## Sources

### Primary (HIGH confidence)
- **Installed `node_modules/@esotericsoftware/spine-core@4.3.0`** `dist/*.d.ts` — `Animation.d.ts:93` (the verified 10-arg `apply()`), `Skeleton.d.ts:115,119,131,142,189,199` (`setupPose`/`setupPoseSlots`/`setSkin`/private `setSkinByName`/`getBounds`/`update`), `AnimationState.d.ts:59,65,169` (`update`/`apply`/`getTrack`), `SkeletonData.d.ts`, `Skin.d.ts:51`, `Physics.d.ts:30`, `index.d.ts` (MixBlend/MixDirection: 0 occurrences) — verified 2026-05-18
- **Installed `node_modules/spine-core-42` (= @esotericsoftware/spine-core@4.2.111)** — `Animation.d.ts:55` (the 8-arg `(…,blend: MixBlend, direction: MixDirection)` the modal currently matches) — verified 2026-05-18
- **Freshly `npm pack`'d `@esotericsoftware/spine-player@4.3.0`** — `Player.d.ts` (`SpinePlayerConfig` :31-89, `preserveDrawingBuffer` required :72, `SpinePlayer.skeleton/animationState` `|null` :125-126, private `playTime` :120, public `time/paused/speed/setAnimation/setViewport`), `Player.js:644` (the authoritative `apply(…, true,false,false,false)` cross-confirmation), `Player.js:166-211` (viewport/AssetManager/rawDataURIs), `Player.js:347` (`showError` family present) — verified 2026-05-18
- **Freshly `npm pack`'d `@esotericsoftware/spine-webgl@4.3.0`** — `PolygonBatcher.js` (`setBlendMode(mode)` no pma param; `srcRgbPma=GL_ONE`), `SkeletonRenderer.js:130-160` (vertex-color ×alpha always; `darkColor.a=1`), `SceneRenderer.js:83` (`drawSkeleton` dropped pma arg), `GLTexture.js:88` (`UNPACK_PREMULTIPLY_ALPHA_WEBGL=!pma`), `AssetManager.js:33` (`GLTexture(ctx,image,pma)`) — verified 2026-05-18
- **Live node module resolution** — `require.resolve('@esotericsoftware/spine-core', {paths:[<spine-player dir>]})` → 4.3.0; spine-player has no nested node_modules; spine-webgl@4.2.111 has nested spine-core@4.2.111 (the D-03 split-brain, reproduced) — verified 2026-05-18
- **Live `npx tsc -p tsconfig.web.json --noEmit`** — 22 errors, all `AnimationPlayerModal.tsx`, enumerated in the D-05 audit table (TS2554/2341/2339/2741/18047/2345) — verified 2026-05-18
- **Live `npx vitest run tests/renderer/`** — 11 failed suites, all with `SyntaxError: … does not provide an export named 'MixBlend'` at `AnimationPlayerModal.tsx:45:1`; 248 tests passed (suite-level import failures, 0 test-case failures) — verified 2026-05-18
- Project source — `src/renderer/src/modals/AnimationPlayerModal.tsx` (full read), `tests/renderer/animation-player-modal.spec.tsx` (mock surface L85-156,594-610), `tests/renderer/app-shell-animation-viewer.spec.tsx`, `src/renderer/index.html:7` (CSP), `package.json:26-27,35`, `.planning/config.json`, `.planning/REQUIREMENTS.md:71-74,146-147`, `.planning/STATE.md` (Phase 42 Option-1 handoff + Phase 46 close), `.planning/phases/41-spine-animation-viewer/41-HUMAN-UAT.md` (5 pending + G-01/02/03) — read 2026-05-18

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` (line 27, 51-53, 142-145), `PITFALLS.md` (Pitfall 7, GL-alpha guardrail, CSP guardrail, revert risk row), `STACK.md` (alias mechanics, the SEED-006 beta-vs-stable drift table, `npm view` facts) — cross-checked against the installed tarballs; where SUMMARY (`slot.pose.attachment`) and STACK (`slot.getAppliedPose().attachment`) disagreed, the **installed `.d.ts` is authoritative** and was used (this is exactly why D-04 mandates deriving from the tarball, not prose — the modal doesn't read slot attachments so this particular drift doesn't reach Phase 47, but it validated the "verify, don't trust prose" discipline).
- Project memory — `project_renderer_mixblend_preexisting_failure` (superseded: now Phase-47-owned), `project_typecheck_node_preexisting_red` (typecheck:node baseline), `project_pma_no_op_in_current_stack` (explicitly does NOT transfer to GL — confirmed by the verified mechanism change), `feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam` (informs the lockstep-test-mock false-green pitfall), `feedback_delegate_implementation_choices` (Claude's-discretion scope)

### Tertiary (LOW confidence)
- None. Every load-bearing claim in this research was verified against an installed or freshly-packed tarball, live `tsc`, live `vitest`, or live module resolution. No claim rests on training knowledge or unverified web sources.

## Metadata

**Confidence breakdown:**
- D-03 revert feasibility: **HIGH** — the split-brain is reproduced via live module resolution + the 11-suite RED state; the conclusion (revert infeasible under frozen-canonical 4.3.0) is mechanically demonstrated, not argued.
- D-04 `apply()` signature: **HIGH** — extracted verbatim from installed `Animation.d.ts:93` AND independently cross-confirmed against spine-player 4.3.0's own `Player.js:644` internal call. Zero ambiguity.
- D-05 touchpoint audit: **HIGH** — every changed touchpoint corresponds to a reproduced `tsc` error (22, all enumerated); the STABLE classifications are from direct `.d.ts` signature comparison. A1/A3 flag the residual *behavioral* (non-type) risk routed to the owner UAT.
- GL straight-alpha: **HIGH on the mechanism** (4.2.111 vs 4.3.0 spine-webgl diff verified from tarballs) / **deliberately UNRESOLVED on visual equivalence** (A2 — the owner empirical check is the only valid evidence per PITFALLS "NEVER skip"; not a research gap, a by-design human gate).
- Test-mock lockstep + 11-suite ownership: **HIGH** — spec mock surface read directly; the transitive-consumer claim (A4) is grep-verified + gated by the full-suite check.

**Research date:** 2026-05-18
**Valid until:** ~2026-06-17 (30 days — stable; spine-player/webgl/core 4.3.0 are the only 4.3 releases and exact-pinned, so the surface won't drift unless a 4.3.1 publishes; re-verify the `apply()`/Skeleton signatures if any 4.3.x patch appears, per PITFALLS Pitfall 1 patch-shaped-API-change precedent).

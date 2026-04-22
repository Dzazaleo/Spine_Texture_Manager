---
name: Phase 0 — Core-math spike Context
description: Locked decisions for Phase 0 derived from the approved plan (~/.claude/plans/i-need-to-create-zesty-eich.md) treated as a PRD.
phase: 0
---

# Phase 0: Core-math spike (derisk) — Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Source:** PRD Express Path — `~/.claude/plans/i-need-to-create-zesty-eich.md` (approved plan, treated as locked PRD)

<domain>
## Phase Boundary

Phase 0 is the **pre-UI math derisking milestone**. It ships a headless TypeScript package plus a CLI that reads a Spine 4.2+ skeleton JSON + atlas and prints a per-attachment peak render-scale table matching Screenshot 1's columns (Asset, Original Size, Max Render Size, Scale, Source Animation, Frame). It ships with a vitest golden suite driven by `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`.

**In scope:**
- Node-only project scaffolding: `package.json`, `tsconfig.json`, `vitest.config.ts`.
- `src/core/loader.ts`, `src/core/sampler.ts`, `src/core/bounds.ts` — pure TypeScript, no DOM, no Electron.
- `scripts/cli.ts` — a Node CLI invoked via `npm run cli -- <path to skeleton.json>` that prints the peak-scale table.
- `tests/core/*.spec.ts` — vitest golden tests for N1.2–N1.6.
- Stub `TextureLoader` populated from `.atlas` metadata — no PNG decoding.

**Out of scope (deferred to later phases):**
- Electron shell, React, Tailwind, IPC, main/preload/renderer directories (Phase 1).
- Attachment source-dim resolution via `sharp` PNG metadata (Phase 1 — `.atlas` `orig`/`bounds` suffices for Phase 0).
- Scale overrides, export, atlas preview, save/load project state (Phases 4–9).
- Adaptive bisection sub-sample peak refinement (Phase 10 stretch).
- Spine binary (`.skel`) support (out of MVP scope entirely).

</domain>

<decisions>
## Implementation Decisions

### Runtime & Dependencies
- **Runtime math library:** `@esotericsoftware/spine-core` — the official renderer-less TypeScript port. We reuse `SkeletonJson.readSkeletonData`, `Skeleton`, `AnimationState`, `RegionAttachment.computeWorldVertices`, `VertexAttachment.computeWorldVertices`, `Physics` enum, and `TextureAtlas` for parsing.
- **Testing framework:** `vitest` (not jest) — configured via `vitest.config.ts` at project root. Golden tests run in Node, no browser/DOM.
- **No Electron, no React, no Tailwind in Phase 0.** Those land in Phase 1.
- **No `sharp` dependency in Phase 0.** The stub `TextureLoader` reads atlas metadata only; PNG decoding is a Phase 8 concern.
- **TypeScript strict mode:** `"strict": true` in `tsconfig.json`. Target `ES2022`, module `ESNext`, moduleResolution `bundler` (or `node16`, planner's call).

### Sampler Contract (locked — do not relitigate)
- **Animations are stored in SECONDS, not frames.** `skeleton.fps` in the JSON is editor dopesheet metadata only, nonessential, has zero runtime effect.
- **Sampling rate is our choice, not Spine's.** Default: **120 Hz** (dt = 1/120). Rationale: above typical 60 Hz game render cadence, catches sub-frame peaks on easing curves, still fast. Must be configurable.
- **Per-animation sampler lifecycle (locked):** for each `(skin, animation)` pair:
  1. `skeleton.setToSetupPose()`
  2. `state.clearTracks()` then `state.setAnimation(0, animation, false)`
  3. `skeleton.updateWorldTransform(Physics.reset)` — zero physics state once before the loop.
  4. Loop `t = 0; t <= animation.duration; t += dt`:
     - `state.update(dt)` → `state.apply(skeleton)` → `skeleton.update(dt)` → `skeleton.updateWorldTransform(Physics.update)`
     - Snapshot every visible attachment's world AABB.
  - **Calling order is mandatory** and mirrors spine-player / official demos. The executor must not reorder these calls.
- **Setup-pose pass (per skin):** one pass with no animation applied. Any attachment never touched by any animation timeline reports its setup-pose AABB under the source label "Setup Pose (Default)".
- **`computeWorldVertices` already handles:** bone hierarchy, slot scale, weighted-mesh bone influences, IK, TransformConstraints, PathConstraints, PhysicsConstraints (4.2), DeformTimelines. Do **not** re-implement any of this math.

### Per-attachment AABB (locked)
- **RegionAttachment:** `region.computeWorldVertices(slot, Float32Array(8), 0, 2)` → AABB from 4 vertices.
- **MeshAttachment / VertexAttachment:** `vattr.computeWorldVertices(slot, 0, vattr.worldVerticesLength, Float32Array(n), 0, 2)` → AABB from N vertices.
- **Skip types:** `BoundingBox`, `Path`, `Point`, `Clipping` attachments are intentionally skipped (no source image to scale).
- **Source dimensions (Phase 0 priority):** read from `.atlas` region metadata — the `orig` size if present, else `bounds` width/height of the packed region. (PNG metadata via `sharp` and the `RegionAttachment.width/height` fallback are Phase 1+ concerns.)
- **Scale formula:** `scaleX = aabbW / sourceW`, `scaleY = aabbH / sourceH`, `scale = max(scaleX, scaleY)`. All three reported.
- **Per-sample record shape:** `{ attachmentKey, skinName, animationName, time, frame, scaleX, scaleY, scale, worldW, worldH, sourceW, sourceH }`.

### Loader Contract (locked)
- `loader.ts` accepts a path to a Spine JSON file and returns a fully-parsed `SkeletonData` + atlas metadata.
- **Auto-detect companions:** sibling `.atlas` file (preferred) → else sibling `images/` folder (Phase 0 ignores `images/`, just errors cleanly) → else error "no atlas found".
- **Stub `TextureLoader`:** returns a minimal `TextureRegion` object populated from the `.atlas` (width, height, u, v, degrees, originalWidth, originalHeight, offsetX, offsetY). No pixel data loaded. This is the "headless loading" pattern from the spine-ts docs.
- **Surface clear errors:** "no atlas file found beside JSON" must be a typed error the CLI can format, not a crash.

### CLI Contract (locked)
- **Invocation:** `npm run cli -- <path to skeleton.json>` (e.g. `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`).
- **Output:** a plain-text table to stdout with columns: `Attachment | Skin | Source W×H | Peak W×H | Scale | Source Animation | Frame`. Screenshot-1–style — human-readable, not JSON, for quick eyeballing. One row per unique `(attachment, skin)` pair.
- **"Setup Pose (Default)"** as the source-animation label when no animation timeline touches that attachment.
- **Zero exit code on success, non-zero on loader error.**

### Test Strategy (locked — golden tests)
Tests live in `tests/core/`. All tests drive from `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (which already contains CIRCLE/SQUARE/TRIANGLE regions, `CHAIN_2..8` bone chain, `SQUARE2` pre-scaled bone, a `TransformConstraint` on `SQUARE`, a `PhysicsConstraint`, and at least one mesh attachment).

Required golden coverage:
- **N1.2 leaf bone:** plain region on a leaf bone — peak matches hand-computed `source × scale`.
- **N1.3 bone chain:** region on `CHAIN_2..8` chain — peak matches `source × product(chain scales) × slot scale`.
- **N1.4 weighted mesh:** mesh attachment bound to 2+ bones — peak AABB matches the weighted-sum formula. **Gate note:** if the existing fixture's mesh is single-bone, the executor must either (a) confirm it's multi-bone-weighted by inspecting the JSON `vertices` array, or (b) flag for a follow-up fixture extension. Do not silently pass this test.
- **N1.5 TransformConstraint:** the existing `TransformConstraint` on `SQUARE` — driven attachment's peak must reflect the constraint. Verify by comparing constrained-vs-unconstrained peak.
- **N1.6 PhysicsConstraint determinism:** run the sampler twice on the physics-containing animation; peaks must be bit-identical (given `Physics.reset` at the start of each run).
- **Mid-frame peak on easing curve:** 120 Hz sampling must catch the peak within 1% tolerance on a keyframe with a non-linear easing. If the fixture lacks a suitable curve, flag as a stretch test.

### Performance Gate (locked)
- **N2.1:** Full sampler run on `SIMPLE_TEST.json` must complete in **< 500 ms** on the main thread (measured via `console.time` or vitest `test.each` timing — planner's call). CLI prints elapsed time in the footer.
- **N2.3:** Sampler hot loop must perform **zero filesystem I/O**. The stub TextureLoader makes this free; tests enforce it by spying on `fs` if needed, or by construction (no `fs` import in `sampler.ts` / `bounds.ts`).

### Folder Conventions (locked by CLAUDE.md — do not relitigate)
- `fixtures/` — exported Spine JSON + atlas + PNG for tests. In-repo.
- `temp/` — the user's Spine editor source files (.spine projects). **Not used by the app or tests. Must be gitignored** when the repo is initialized — create `.gitignore` that excludes `temp/`, `node_modules/`, `dist/`, `coverage/`.
- `src/core/` — pure TypeScript, no DOM. Headless-testable via vitest.
- No `src/main/`, `src/preload/`, `src/renderer/` in Phase 0 — those are Phase 1.

### Git Initialization (locked)
- Per CLAUDE.md, the repo is NOT yet a git repository. Phase 0 **must `git init`** and commit the initial scaffolding atomically as the first task. Add `.gitignore` before the first `git add`.

### Claude's Discretion (not locked by the approved plan)
- Exact `package.json` dependency versions — use current stable releases at time of install.
- Internal module exports (named vs default, barrel `index.ts`) — planner's call.
- CLI table rendering library vs hand-rolled string formatting — either is fine; hand-rolled preferred to avoid dependency bloat.
- Test file organization (one spec per core module vs combined) — planner's call, but each requirement (N1.2–N1.6, N2.1, N2.3) must be identifiable in the test output.
- How to detect "visible attachment" in the sampler — `slot.getAttachment() != null && slot.color.a > 0` is the canonical check, but executor may tune.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth
- `~/.claude/plans/i-need-to-create-zesty-eich.md` — the full approved technical plan. Phase 0 section starts at `### Phase 0 — Core-math spike`. Sections "Critical technical patterns & references" and "Verified core-math contract (deep research results)" are authoritative for the math.

### Project instructions
- `CLAUDE.md` — non-obvious facts, folder conventions, commands. **Critical:** the 6 "non-obvious facts" section locks sampler order, 120 Hz default, headless PNG policy, pure-TS `core/`, and `temp/` gitignore rule.

### Requirements
- `.planning/REQUIREMENTS.md` — F1.1–F1.4 (loader), F2.1–F2.7 (sampler + bounds), N1.1–N1.6 (correctness tests), N2.1 (perf), N2.3 (no FS I/O in hot loop). These are the requirement IDs Phase 0 must address.
- `.planning/ROADMAP.md` — Phase 0 section has deliverables and exit criteria that must each be satisfied.

### External
- [Spine 4.2 API reference](http://esotericsoftware.com/spine-api-reference) — `RegionAttachment`, `VertexAttachment`, `MeshAttachment`, `AnimationState`, `Skeleton.updateWorldTransform`, `Physics` enum.
- [Spine JSON format spec](https://en.esotericsoftware.com/spine-json-format) — confirms seconds-based keyframe time, `skeleton.fps` nonessential.
- [spine-runtimes 4.2 CHANGELOG](https://github.com/EsotericSoftware/spine-runtimes/blob/4.2/CHANGELOG.md) — physics constraint reference.

### Fixture
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — skeleton JSON.
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` — atlas with CIRCLE, SQUARE, TRIANGLE regions.
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.png` — packed atlas image (not decoded in Phase 0).

</canonical_refs>

<specifics>
## Specific Ideas

### Exact API surface (from approved plan, verified against spine-ts 4.2 source)

| API | Signature | Use in Phase 0 |
|---|---|---|
| `SkeletonJson(attachmentLoader)` + `readSkeletonData(json)` | returns `SkeletonData` | `loader.ts` — parse JSON with stub AttachmentLoader-on-stub-TextureLoader |
| `new Skeleton(skeletonData)` | — | `sampler.ts` — clone data into mutable skeleton per sampler run |
| `skeleton.setSkin(skin)` + `setSlotsToSetupPose()` | — | Per-skin reset before sampling |
| `new AnimationState(new AnimationStateData(skeletonData))` | — | Per-animation state |
| `state.setAnimation(0, animation, false)` | — | Queue animation on track 0, no loop |
| `state.update(dt)` / `state.apply(skeleton)` | dt in seconds | Sampler tick |
| `skeleton.update(dt)` / `skeleton.updateWorldTransform(Physics.update)` | — | Sampler tick (constraint+physics resolve) |
| `skeleton.updateWorldTransform(Physics.reset)` | — | Once before each animation's sampler loop |
| `RegionAttachment.computeWorldVertices(slot, wv, offset, stride)` | 4×(x,y) → `wv` | `bounds.ts` region path |
| `VertexAttachment.computeWorldVertices(slot, start, count, wv, offset, stride)` | N×(x,y) → `wv` | `bounds.ts` mesh path |
| `TextureAtlas` parser (from `@esotericsoftware/spine-core`) | — | Parse `.atlas` for region metadata (preferred over hand-rolled parser) |
| `Skin.getAttachments()` | `SkinEntry[]` | Enumerate attachments per skin for setup-pose pass + unused detection (unused detection is Phase 5, but enumeration API is needed now) |

### Sampler pseudocode (from approved plan, step-B)

```ts
// once per (skin, animation):
skeleton.setSkin(skin);
skeleton.setSlotsToSetupPose();
skeleton.setToSetupPose();
state.clearTracks();
state.setAnimation(0, animation, false);
skeleton.updateWorldTransform(Physics.reset);

for (let t = 0; t <= animation.duration; t += dt) {
  state.update(dt);
  state.apply(skeleton);
  skeleton.update(dt);
  skeleton.updateWorldTransform(Physics.update);
  snapshotEveryAttachmentAABB(skeleton, t);
}
```

### AABB pseudocode (from approved plan, section C)

```ts
function attachmentWorldAABB(slot: Slot, atm: Attachment) {
  if (atm instanceof RegionAttachment) {
    const v = new Float32Array(8);
    atm.computeWorldVertices(slot, v, 0, 2);
    return aabb(v, 4);
  }
  if (atm instanceof MeshAttachment) { // also catches VertexAttachment subclasses
    const n = atm.worldVerticesLength;
    const v = new Float32Array(n);
    atm.computeWorldVertices(slot, 0, n, v, 0, 2);
    return aabb(v, n / 2);
  }
  return null; // BoundingBox/Path/Point/Clipping — no texture
}
```

### Fixture inventory (from CLAUDE.md + JSON inspection)
- Regions: CIRCLE, SQUARE, TRIANGLE.
- Bones: `root`, `CTRL`, `CHAIN_2..8` chain (7 deep), `SQUARE2` pre-scaled.
- Constraints: at least one TransformConstraint (on SQUARE), one PathConstraint, one PhysicsConstraint.
- Mesh attachments: at least one (fixture JSON contains `"type": "mesh"`).

</specifics>

<deferred>
## Deferred Ideas

- **PNG metadata via `sharp`** — source-dim resolution priority 2. Phase 1+.
- **Adaptive bisection for sub-sample peak refinement** — Phase 10 stretch per approved plan.
- **Worker-thread sampling for large rigs** — Phase 10 per approved plan. Phase 0 must only satisfy the <500 ms simple-rig target (N2.1); N2.2 (<10 s complex rig) is Phase 10's gate.
- **Multi-skin compositing** — out of MVP entirely per REQUIREMENTS.md.
- **Spine binary (`.skel`) loading** — out of MVP entirely.
- **F1.5 Spine 4.3+ versioned loader adapters** — explicitly "Future" in requirements; Phase 0 targets 4.2 only.

</deferred>

---

*Phase: 00-core-math-spike*
*Context gathered: 2026-04-22 via PRD Express Path from `~/.claude/plans/i-need-to-create-zesty-eich.md`*

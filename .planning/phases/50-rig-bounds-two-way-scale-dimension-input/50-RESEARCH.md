# Phase 50: Rig-Bounds + Two-Way Scale↔Dimension Input - Research

**Researched:** 2026-05-22
**Domain:** Dual-runtime setup-pose geometry measurement (core/) + two-way derived-field UI control (renderer/)
**Confidence:** HIGH (every seam confirmed against live source + 3 empirical probes through the real adapter)

<user_constraints>
## User Constraints (from 50-CONTEXT.md — LOCKED, do NOT relitigate)

### Locked Decisions
- **D-01:** Both W and H editable, plus the factor — aspect-locked. Three coupled inputs (scale factor, target W px, target H px). Editing any one re-derives the other two. Scaling stays **uniform** (chooses which dimension anchors the still-uniform factor; never anisotropic). "Longest-edge only" / "width-only" rejected.
- **D-02:** The scale factor `s` is the **single source of truth** (it is what export/bake consumes). W/H px fields are *views* of `s` (`px = s × bboxAxis`). Last-edited field sets `s`, then all fields re-derive from `s` — aspect-locked, **no round-trip drift** on the edited axis.
- **D-03:** Typed pixel targets honored **EXACTLY** — typing target W (or H) sets `s = px ÷ bboxAxis`, that exact `s` exports. **NO snapping** to "nice" factors. Display: factor `Number(s.toFixed(4))` (byte-identical to `variant-export.ts` `formatScaleToken`); pixels as **whole numbers**.
- **D-04:** Over-range (upscale) guard. Typed W or H ≥ its bbox dimension (`s ≥ 1`) → **allow the entry**, recompute the (≥1) factor for display, but **disable Export** + show the existing inline "variants are scaled-down" hint. Reuses the Phase 49 D-08 cheap renderer pre-check; the **authoritative** reject stays the main-side `VariantScaleError`. Hard-clamping mid-edit rejected.
- **D-05:** **COMPUTE the bbox ourselves via the runtime** — do **NOT** read JSON `skeleton.width/height` header (nonessential editor metadata; setup-pose-*visible* subset; inherits broken-rig pathologies). Same principle as CLAUDE.md #1/#2.
- **D-06:** Method = **ALL-SKINS MANIFEST UNION at setup-pose bone transforms.** Iterate *every* skin's manifest (not just setup-pose slot bindings), measure each attachment's world-AABB at the setup-pose bone transform, union, report `{w, h}`. Robust to all-hidden AND partially-hidden ("eyes-only setup") setup poses. Reuses sampler Pass 1.5 primitives (`rt.skinEntries` + `attachmentWorldAABB`). *Accepted tradeoff:* a rig with dramatically different-sized alternate skins shows the **largest** envelope — acceptable (factor-picking anchor, never export-affecting).
- **D-07:** **Dual-runtime via the `load.runtime` adapter** — `makeSkeleton → setupPoseSlots → setupPose → updateWorldTransform('pose') → union`. **NEVER** a hardcoded `Skeleton` ctor (REG-47-01 landmine). Generalizes the Phase-49 oracle's `aggregateWorldAABB`.
- **D-08:** Editor `skeleton.width/height` kept ONLY as a researcher/test cross-check oracle. Expect close agreement on a *normal* rig; never the source.
- **D-09:** **Enrich the Scale card INLINE in the existing single-pane `VariantDialog`** (replace the basic field at `:299-331`). **Defer `Scale | Output | Batch` tabs to Phase 51.** Pure in-place enrichment, no structural refactor.

### Claude's Discretion
- **Where the bbox computation lives & how it reaches the renderer.** Layer-3-pure `core/` function; renderer cannot call `core/`/runtime directly. *Recommended seam:* compute **once at summary-build time** (`src/main/summary.ts` via `load.runtime`) and attach to `SkeletonSummary`. (Dedicated IPC is the alternative.)
- Exact field layout / copy / widths — match the existing `OptimizeDialog`/`VariantDialog` Tailwind literal-class idiom (Pitfall 8: literal class strings only).
- Live-update cadence (onChange vs onBlur) for the coupled fields; tolerate intermediate states while typing.
- Number-format helpers — reuse the inline `toFixed(4)` normalization at `VariantDialog.tsx:267` rather than importing Node-only `formatScaleToken`.
- Whether to expose the bbox origin (x/y) — **not required**; only `{w, h}` needed.

### Deferred Ideas (OUT OF SCOPE)
- `Scale | Output | Batch` tabbed dialog — Phase 51.
- Batch (N scales → N folders) — Phase 51.
- Per-skin chooser / skin dropdown for the bounds reference — possible future enrichment.
- Anisotropic / per-axis scaling — out (uniform-only LOCKED).
- Upscaling (`s ≥ 1`) as a user feature — out (export edge rejects it).
- Showing bbox origin (x/y) / live "what-if" texture-size preview — Future Requirements.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCALEUI-01 | User can specify a variant scale either as a factor (e.g. `0.5`) or as a target dimension in pixels; entering one displays the corresponding other value. | Two-way control math (§Two-Way Control), pure derivation helpers, `scale`/`onScaleChange` props already wired (AppShell.tsx:2586-87); `Number(s.toFixed(4))` precision confirmed (variant-export.ts:57-58). |
| SCALEUI-02 | The dimension reference shown to the user is the rig's overall setup-pose bounding box (width × height in px). | `computeSetupPoseBounds` core function generalizing `aggregateWorldAABB`; surfaced as `SkeletonSummary.bbox` via summary.ts; dual-runtime + degenerate handling confirmed empirically. |
</phase_requirements>

## Summary

This phase is overwhelmingly **de-risked** — the hard part (a dual-runtime setup-pose world-AABB) already exists as a *proven* helper, and the UI seam (a `scale`/`onScaleChange`-driven field with the exact `toFixed(4)` normalization) already ships from Phase 49. There is no new library, no new runtime seam, and no new IPC channel required. The work is: (1) lift `aggregateWorldAABB` (`tests/main/variant-dropin-faithful.spec.ts:144-180`) into a Layer-3-pure `core/` function, **generalizing slot-bindings → all-skins manifest union** (D-06), (2) call it once in `src/main/summary.ts` and attach `{w, h}` to `SkeletonSummary` (already crosses IPC into `VariantDialog`), and (3) replace the basic numeric field in `VariantDialog.tsx:299-331` with three aspect-locked coupled inputs backed by pure, unit-testable derivation helpers.

Every seam was confirmed against live source: the `SpineRuntime` facade exposes all required methods (`skinEntries`, `slots`, `setupPoseSlots`, `setupPose`, `updateWorldTransform`, `attachmentKind`), both adapters implement them with real bodies, `load.runtime` is always bound by `loadSkeleton` (loader.ts:1011) regardless of loader mode, and `summary={summary}` already flows into `VariantDialog` (AppShell.tsx:2584). I ran the generalized union through the real adapter on three committed fixtures (4.2 + 4.3): **SIMPLE_TEST matches the editor header to 0.0%**, **skeleton2 (4.3) is +19.3%/0.0% wider** (all-skins union ≥ editor's visible subset), and **spineboy-pro (4.3) is +239%/+52%** (large alternate skins — confirms D-06's accepted "largest envelope" tradeoff and that spineboy is a *bad* cross-check oracle).

**Two non-obvious findings the planner MUST act on:** (a) the `npm run cli` entrypoint (`scripts/cli.ts`) does **NOT** call `buildSummary` — it goes `loadSkeleton → sampleSkeleton → analyze` directly — so a bbox computed inside `summary.ts` is *never exercised by the CLI*; the all-entrypoint verification ([[feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam]]) must test the **core function directly** under vitest for both runtimes rather than asserting CLI output. (b) the degenerate case (zero textured attachments) leaves the Infinity-sentinel fold at `maxX-minX = -Infinity` (NOT finite) — the core function MUST guard `measured === 0` and return a `null`/sentinel, or a non-finite value crosses IPC and breaks the existing `structuredClone` safety contract (summary.spec.ts:132).

**Primary recommendation:** Add `computeSetupPoseBounds(load): { w: number; h: number } | null` to a new `src/core/setup-bounds.ts` (Layer-3 pure), call it once in `summary.ts` (reusing the already-bound `rt` from the REG-47-01 fix at line 325), attach `SkeletonSummary.bbox: { w: number; h: number } | null`, and build the two-way control on pure derivation helpers (factor `s` canonical; `px = round(s × axis)`; `s = px / axis`) co-located in the renderer.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Setup-pose all-skins AABB math | core/ (pure TS) | — | CLAUDE.md #5: spine geometry math is pure, headless-testable; no DOM/sharp. Generalizes an existing core primitive. |
| Skeleton materialization for the AABB | core/ via `load.runtime` | — | REG-47-01: must go through the loader-picked adapter, never a hardcoded ctor. `loadSkeleton` already binds `load.runtime` (loader.ts:1011). |
| Computing `{w,h}` once + attaching to summary | main/ (`summary.ts`) | — | `summary.ts` already materializes the skeleton via `rt.makeSkeleton` (line 325, REG-47-01 fix) — the bbox is a near-free addition there; no per-keystroke recompute. |
| Carrying `{w,h}` to the renderer | shared/ (`SkeletonSummary`) | IPC (structured clone) | `SkeletonSummary` already crosses IPC into `VariantDialog` (props.summary); additive primitive field is clone-safe. |
| Two-way factor↔px derivation | renderer/ (pure helpers) | — | Pure functions of `(s, bbox)` and `(px, axis)`; unit-testable; the control is the seam Phase 49 D-05 left to enrich. |
| Coupled-field UI state + render | renderer/ (`VariantDialog`) | — | Layer-3; reads precomputed `summary.bbox`; never imports `core/` (arch.spec.ts gate). |
| Authoritative `s ≥ 1` reject | main/ (`VariantScaleError`) | renderer pre-check (D-04) | Phase 49 D-08 contract preserved — renderer disables Export as defense-in-depth; main owns the gate. |

## Standard Stack

No new dependencies. This phase is built entirely from existing in-repo modules + the already-installed runtime adapters.

### Core (existing, reused)
| Module | Purpose | Why Standard |
|--------|---------|--------------|
| `src/core/bounds.ts` → `attachmentWorldAABB(rt, sk, slot, a)` | Per-attachment world AABB; returns `null` for skip-list (bbox/path/point/clipping). Lines 54-84. | The proven inner-loop workhorse the sampler already uses every tick. Pure, zero-I/O. |
| `src/core/runtime/runtime.ts` → `SpineRuntime` facade | `makeSkeleton`, `setupPose`, `setupPoseSlots`, `updateWorldTransform`, `slots`, `skinEntries`, `skinName`, `slotName`, `attachmentKind`. | Dual-runtime adapter; the ONLY sanctioned spine API surface for core (RT-02). All methods confirmed present (lines 14-72). |
| `src/core/loader.ts` → `loadSkeleton(path)` | Binds `load.runtime = pickRuntime(resolveRuntimeTag(...))` at line 1011 for BOTH loader modes. | `load.runtime` is always populated; the bbox path inherits the loader's runtime pick. |
| `src/main/summary.ts` → `buildSummary(load, sampled, ms)` | Already materializes the skeleton via `rt.makeSkeleton` (line 325, REG-47-01-safe). | The bbox compute slots in next to the existing materialization — single compute per load. |
| `src/main/variant-export.ts` → `formatScaleToken(s)` = `String(Number(s.toFixed(4)))` (lines 57-58) | The canonical 4-decimal factor token. | D-03 display precision is byte-identical to this; the renderer copies the 1-liner inline (Layer-3 — must not import the Node module). |

### Supporting (the pattern source to generalize)
| Reference | Purpose | When to Use |
|-----------|---------|-------------|
| `tests/main/variant-dropin-faithful.spec.ts:144-180` → `aggregateWorldAABB(load)` | Proven dual-runtime setup-pose AABB (slot-bindings union). | **The exact prototype to generalize** (slot-bindings → all-skins manifest union, D-06). It is currently test-only and not exported. |
| `src/core/sampler.ts:197-287` → Pass 1.5 (per-skin manifest pass) | `rt.skinEntries(skin)` + `attachmentWorldAABB` measure every skin-declared attachment **without mutating slot bindings**. | The manifest-iteration pattern the union reuses; honors `project_sampler_visibility_invariant`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Compute in `summary.ts`, attach to `SkeletonSummary` (recommended) | Dedicated `bbox:compute` IPC channel | Per-call IPC adds a round-trip + a new channel + preload typing; the summary already crosses to `VariantDialog` and the skeleton is already materialized there — strictly more work for no benefit. The bbox is load-invariant, so it should be computed once at load, not per dialog-open. |
| All-skins manifest union (D-06, LOCKED) | Default-skin-only / live-slot-bindings union (`aggregateWorldAABB` as-is) | Locked by D-06: live-bindings miss skin-declared-but-setup-hidden attachments (eyes-only-setup → tiny wrong number). The empirical probe confirms: SIMPLE_TEST (single skin) is identical either way, but multi-skin rigs diverge. |
| Reuse `attachmentWorldAABB` (returns null for non-textured) | Spine's own `SkeletonBounds` / `skeleton.getBounds()` | Spine's bounds API requires a clipping/offset array + measures *bounding-box attachments* (the opposite of what we want — those are collision volumes, not textured geometry). `attachmentWorldAABB`'s skip-list is exactly the right filter. |

**Installation:** none.

**Version verification:** no new packages. Existing `@esotericsoftware/spine-core@4.3.0` + `spine-core-42` (4.2.111 npm alias) are pinned and in use across the whole v1.6/v1.7 codebase.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────────┐
   skeleton.json    │  src/core/loader.ts  loadSkeleton(path)          │
   + (atlas | imgs) │    pickRuntime(resolveRuntimeTag(...))           │
        │           │    load.runtime = rt   (4.2 OR 4.3 adapter)      │
        └──────────▶│    load.skeletonData (version-matched)           │
                    └───────────────────────┬─────────────────────────┘
                                            │ LoadResult (load.runtime bound)
                                            ▼
                    ┌─────────────────────────────────────────────────┐
                    │  src/main/summary.ts  buildSummary(load, …)      │
                    │    rt = load.runtime   (already bound @ line 325) │
                    │    ┌──────────────────────────────────────────┐  │
                    │    │ NEW: bbox = computeSetupPoseBounds(load)  │  │  ← single compute
                    │    │   (calls into core/setup-bounds.ts)       │  │     per load
                    │    └──────────────────────────────────────────┘  │
                    │    return { …, runtimeTag, bbox }                 │
                    └───────────────────────┬─────────────────────────┘
                                            │ SkeletonSummary (+ bbox: {w,h}|null)
                                            ▼  IPC structured clone (skeleton:load)
                    ┌─────────────────────────────────────────────────┐
                    │  src/core/setup-bounds.ts  (NEW, Layer-3 pure)   │
                    │    makeSkeleton → setupPoseSlots → setupPose      │
                    │    → updateWorldTransform('pose')                 │
                    │    for skin in rt.skins(data):                    │
                    │      for entry in rt.skinEntries(skin):           │  ← ALL-SKINS
                    │        aabb = attachmentWorldAABB(rt, sk, slot,a) │     MANIFEST UNION
                    │        union min/max                              │     (D-06)
                    │    n===0 → return null   (degenerate guard)       │
                    └─────────────────────────────────────────────────┘
                                            │ {w,h}|null reaches renderer as props.summary.bbox
                                            ▼
                    ┌─────────────────────────────────────────────────┐
                    │  src/renderer/.../VariantDialog.tsx  (enriched)  │
                    │    bbox = props.summary.bbox                      │
                    │    ┌── pure helpers (renderer-local) ──────────┐  │
                    │    │ pxFromScale(s, axis) = round(s*axis)       │  │
                    │    │ scaleFromPx(px, axis) = px / axis          │  │
                    │    │ displayFactor(s) = Number(s.toFixed(4))    │  │
                    │    └────────────────────────────────────────────┘  │
                    │    factor field ─┐                                 │
                    │    width  field ─┼─ last-edited sets s ──▶ onScaleChange(s)
                    │    height field ─┘   others re-derive             │  → existing
                    │    s≥1 → disable Export + inline hint (D-04)       │     export path
                    └─────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── core/
│   ├── setup-bounds.ts      # NEW — computeSetupPoseBounds(load): {w,h}|null (Layer-3 pure, all-skins union)
│   ├── bounds.ts            # reused — attachmentWorldAABB
│   └── runtime/runtime.ts   # reused — SpineRuntime facade
├── main/
│   └── summary.ts           # MODIFIED — call computeSetupPoseBounds once; attach bbox
├── shared/
│   └── types.ts             # MODIFIED — SkeletonSummary.bbox: {w,h}|null (additive)
└── renderer/src/modals/
    └── VariantDialog.tsx     # MODIFIED — replace :299-331 field with the 3-input aspect-locked control
```

### Pattern 1: Generalized all-skins setup-pose union (D-06/D-07)
**What:** Lift `aggregateWorldAABB` into core, but iterate `rt.skinEntries(skin)` for **every** skin (not `rt.slotAttachment` on live bindings).
**When to use:** The single bbox compute, called from `summary.ts`.
**Example:**
```typescript
// src/core/setup-bounds.ts — generalizes tests/main/variant-dropin-faithful.spec.ts:144-180
// (slot-bindings → all-skins manifest union, D-06). Layer-3 pure: imports only
// from ./bounds.js, ./runtime/runtime.js, ./runtime/types.js, ./types.js.
import { attachmentWorldAABB } from './bounds.js';
import type { LoadResult } from './types.js';
import type { OpaqueSkeletonData } from './runtime/types.js';

export function computeSetupPoseBounds(load: LoadResult): { w: number; h: number } | null {
  const rt = load.runtime;
  if (rt == null) {
    // REG-47-01 contract: loader must populate load.runtime. Loud, not silent.
    throw new Error('computeSetupPoseBounds: load.runtime missing (loader must bind it)');
  }
  const data = load.skeletonData as unknown as OpaqueSkeletonData;
  const sk = rt.makeSkeleton(data);            // adapter ctor — NEVER a raw Skeleton (D-07)
  rt.setupPoseSlots(sk);                        // 4.2 setSlotsToSetupPose | 4.3 setupPoseSlots
  rt.setupPose(sk);                             // 4.2 setToSetupPose | 4.3 setupPose
  rt.updateWorldTransform(sk, 'pose');          // Physics.pose — static setup pose (CLAUDE.md #3)

  const slots = rt.slots(sk);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let measured = 0;
  // ALL-SKINS MANIFEST UNION (D-06) — not live slot bindings. Pass 1.5 pattern.
  for (const skin of rt.skins(data)) {
    for (const entry of rt.skinEntries(skin)) {
      const slot = slots[entry.slotIndex];
      if (slot === undefined) continue;          // defensive (skin/skeleton drift)
      const att = entry.attachment;
      if (att == null) continue;
      const aabb = attachmentWorldAABB(rt, sk, slot, att);
      if (aabb === null) continue;               // skip-list: bbox/path/point/clipping — no texture
      measured++;
      if (aabb.minX < minX) minX = aabb.minX;
      if (aabb.maxX > maxX) maxX = aabb.maxX;
      if (aabb.minY < minY) minY = aabb.minY;
      if (aabb.maxY > maxY) maxY = aabb.maxY;
    }
  }
  // DEGENERATE GUARD (critical): no textured attachment in any skin → the
  // Infinity sentinels never moved → maxX-minX === -Infinity (NOT finite).
  // Returning that would push a non-finite value across IPC and break the
  // SkeletonSummary structuredClone-safety contract (summary.spec.ts:132).
  if (measured === 0) return null;
  return { w: maxX - minX, h: maxY - minY };
}
```

### Pattern 2: Single compute at summary-build (Claude's Discretion — recommended seam)
**What:** Call the core function once in `buildSummary`, reusing the already-bound `rt`.
**Example:**
```typescript
// src/main/summary.ts — near the existing REG-47-01 materialization (line ~325).
// rt is already bound + null-guarded there; reuse it. No second makeSkeleton needed
// IF you inline the union here, OR call computeSetupPoseBounds(load) (it makes its
// own skeleton — cheap, <1ms on SIMPLE_TEST, runs once per load). Prefer the core
// function for testability + Layer-3 purity (the union math stays in core/).
import { computeSetupPoseBounds } from '../core/setup-bounds.js';
// ...
const bbox = computeSetupPoseBounds(load);   // {w,h} | null — single compute per load
// ... in the returned object:
return {
  // ...existing fields...
  runtimeTag: rt.tag,
  bbox,                                       // additive; structuredClone-safe (primitives | null)
  // ...
};
```

### Pattern 3: Two-way derived-field control (SCALEUI-01, D-02/D-03/D-04)
**What:** Factor `s` is canonical state; W/H px are views; last-edited field writes `s`.
**Example:**
```typescript
// renderer-local pure helpers (unit-testable; co-locate in VariantDialog.tsx or a sibling).
// NO import of core/ or the Node-only formatScaleToken (Layer-3 / Pitfall 8).
export const pxFromScale = (s: number, axis: number): number => Math.round(s * axis);
export const scaleFromPx = (px: number, axis: number): number => px / axis;          // D-03: EXACT, no snap
export const displayFactor = (s: number): number => Number(s.toFixed(4));            // == formatScaleToken core (D-03)

// In the component: `s` (= props.scale) is the single source of truth (D-02).
// Editing the factor:        onScaleChange(parsedFactor)
// Editing target width:      onScaleChange(scaleFromPx(parsedW, bbox.w))  // sets s exactly (D-03)
// Editing target height:     onScaleChange(scaleFromPx(parsedH, bbox.h))
// Displayed factor:          displayFactor(props.scale)
// Displayed width (derived): pxFromScale(props.scale, bbox.w)  // whole number (D-03)
// Displayed height (derived):pxFromScale(props.scale, bbox.h)
// The EDITED axis shows the user's typed value verbatim while focused (no round-trip
// drift, D-02); the OTHER two re-derive from s. Tolerate intermediate states while
// typing (Claude's Discretion — onChange cadence).
```

### Anti-Patterns to Avoid
- **Reading `skeleton.width/height` from the JSON** — D-05 forbids it. Empirically the editor header is the setup-pose-*visible* subset (skeleton2: 1399 vs our all-skins 1669) and inherits broken-rig coordinate pathologies; for SLIDER-01/XTRA-01 it is a meaningless `10×10` editor box.
- **A second `makeSkeleton` for the bbox when one is already in scope** — `summary.ts` already materializes via `rt.makeSkeleton` at line 325. Either inline the union there (no second ctor) or accept the core function's own cheap ctor (<1ms). Do NOT introduce a *raw* `new Skeleton` (D-07 / REG-47-01).
- **Returning `{w: -Infinity, h: -Infinity}` for a geometry-less rig** — non-finite values are NOT structuredClone-safe semantics for the UI and break the cross-IPC contract. Guard `measured === 0 → null`.
- **Snapping the factor to a round number when the user types a pixel target** — D-03 explicitly rejects this. `s = px / axis` exactly.
- **Hard-clamping the input mid-edit when `s ≥ 1`** — D-04 rejects this; allow the entry, recompute the display factor, disable Export, show the hint.
- **Importing `formatScaleToken` from `variant-export.ts` into the renderer** — it is a Node/main module; the Layer-3 gate (arch.spec.ts:25) forbids `core/`/main imports. Copy the 1-liner (`Number(s.toFixed(4))`) inline (already done at VariantDialog.tsx:267).
- **Re-deriving visibility via slot bindings or alpha** — `project_sampler_visibility_invariant`: measure ALL skin-declared attachments via the manifest (`skinEntries`), independent of setup-pose binding/alpha.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-attachment world AABB | A `computeWorldVertices` loop + min/max | `attachmentWorldAABB(rt, sk, slot, a)` (bounds.ts:54) | Already handles Region (4 verts) vs Mesh/Vertex (worldVerticesLength), the skip-list, and the locked instanceof order via the adapter. CLAUDE.md #2: never reimplement this math. |
| Dual-runtime skeleton setup | A 4.2-vs-4.3 branch with `setToSetupPose`/`setupPose` divergence | `rt.setupPoseSlots` + `rt.setupPose` + `rt.updateWorldTransform('pose')` | The adapter normalizes the 4.2/4.3 method-name + Physics-enum divergence. A hand-rolled branch is the exact REG-47-01 / `project_shared_42base_subclass_43_dualruntime_hazard` landmine. |
| All-skins attachment enumeration | Walking `skin.attachments[]` raw indexed objects | `rt.skinEntries(skin)` | Normalizes 4.3's `SkinEntry.placeholder` → `name` (runtime-43.ts:418) vs 4.2's `name` (runtime-42.ts:347); returns `{slotIndex, name, attachment}` uniformly. |
| 4-decimal factor token | A custom rounding/trailing-zero stripper | `Number(s.toFixed(4))` (inline) — mirrors `formatScaleToken` | Byte-identical to the on-disk folder token; avoids drift between display and the real `{NAME}@{s}x/` folder name. |

**Key insight:** The entire geometry half of this phase is a *generalization of one existing 36-line test helper* (`aggregateWorldAABB`), and the entire math half is three one-line pure functions. The risk is not in writing new math — it is in (a) keeping the new core function Layer-3 pure, (b) routing exclusively through `load.runtime`, and (c) the two degenerate/precision edge cases below.

## Runtime State Inventory

Not applicable — this phase is greenfield code/UI additions (one new core module, additive summary field, in-place dialog enrichment). No rename/refactor/migration; no stored data, live-service config, OS-registered state, secrets, or build artifacts carry a renamed string. **None — verified: the phase adds `computeSetupPoseBounds` + `SkeletonSummary.bbox` + dialog inputs; it renames nothing.**

## Common Pitfalls

### Pitfall 1: Degenerate rig → non-finite bbox crosses IPC
**What goes wrong:** A rig whose skins contain only bounding-box/path/point/clipping attachments (no textured Region/Mesh) yields zero `attachmentWorldAABB` hits; the Infinity sentinels never move; `maxX - minX === -Infinity`.
**Why it happens:** `attachmentWorldAABB` returns `null` for the entire skip-list (bounds.ts:71-73), so the union loop never updates min/max.
**How to avoid:** Guard `measured === 0 → return null` (Pattern 1). The renderer presents "No setup-pose geometry" and keeps the factor-only input usable (px fields disabled/blank when `bbox == null`). Verified: `node -e 'let mn=Infinity,mx=-Infinity; mx-mn'` → `-Infinity`, `Number.isFinite` → `false`.
**Warning signs:** A summary unit test that round-trips `bbox` through `structuredClone` and asserts `bbox === null || (Number.isFinite(bbox.w) && Number.isFinite(bbox.h))`.

### Pitfall 2: bbox computed in summary.ts is never exercised by `npm run cli`
**What goes wrong:** Assuming "if it works in the summary it works everywhere." The CLI (`scripts/cli.ts`) bypasses `buildSummary` entirely — it calls `loadSkeleton → sampleSkeleton → analyze` and renders a table from `globalPeaks`. A bbox in `summary.ts` is dead code for the CLI.
**Why it happens:** `buildSummary` is a main-process projection for the renderer; the CLI is a thin loader/sampler wrapper (cli.ts:149-166).
**How to avoid:** Per [[feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam]], the bbox path's *runtime* surface (`computeSetupPoseBounds` → `load.runtime`) is what must resolve under every entrypoint. Verify the **core function directly** under vitest for both 4.2 and 4.3 (which exercises the real adapters via the setupFile resolver), not CLI stdout. The function is reachable from any entrypoint that calls `loadSkeleton`; the production worker (built CJS) and vitest both resolve `pickRuntime` via their respective seams (runtime.ts:174-217). Optionally, if a CLI surface is desired later, add a `--bounds` flag — NOT required for SCALEUI-02.
**Warning signs:** A plan task that asserts "CLI prints W×H" — that would require touching cli.ts (out of scope) and proves nothing about the renderer path.

### Pitfall 3: All-skins union exceeds the editor header (this is correct, not a bug)
**What goes wrong:** A reviewer compares the displayed W×H against the editor's `skeleton.width/height` and flags a "+19%/+239%" mismatch as wrong.
**Why it happens:** D-06 measures the **all-skins** envelope; the editor header is the setup-pose-*visible* subset of the *default* skin. A rig with large alternate skins (spineboy goggles, etc.) legitimately reports a much larger envelope.
**How to avoid:** Document the expected relationship: `our_union ≥ editor_subset`. Empirically confirmed — SIMPLE_TEST (1 skin) matches to 0.0%; skeleton2 is +19.3% wide / exact tall; spineboy is +239%/+52%. The cross-check oracle (D-08) is a **single-skin, fully-visible** rig (SIMPLE_TEST), tolerance ~1%; multi-skin rigs are NOT exact-match oracles.
**Warning signs:** A test asserting `toBeCloseTo(editorWidth)` on a multi-skin fixture — it will fail and is the wrong assertion.

### Pitfall 4: Round-trip drift on the edited axis
**What goes wrong:** User types `512` in the width field; you set `s = 512/bbox.w`, then re-derive width as `round(s × bbox.w)` and overwrite the input → shows `511` or `513` while they're still typing.
**Why it happens:** `round(round(px)/axis × axis)` is not identity for arbitrary px.
**How to avoid:** D-02 — the **edited** axis shows the user's typed value verbatim (while focused / as the controlled value for that field); only the *other two* fields re-derive. Track which field is "active" or render the edited field's raw input string. The factor `s` stays exact (`px/axis`, no rounding applied to `s` itself — D-03).
**Warning signs:** The cursor jumps or the typed digit changes on keystroke in the px fields.

### Pitfall 5: Tailwind literal-class discipline
**What goes wrong:** Building dynamic class strings (template-literal `className`) for the new inputs → Tailwind v4's compiler can't see them → unstyled fields.
**Why it happens:** Tailwind v4 scans for literal class strings only (Pitfall 8 in CONTEXT).
**How to avoid:** Copy class strings verbatim from the existing VariantDialog fields (e.g. the scale input at :322, the padding input at :451). All three new inputs reuse the same `w-20`/`w-16 bg-surface border border-border ...` literals.

## Code Examples

### Confirmed: the existing scale field + props to enrich (VariantDialog.tsx)
```tsx
// VariantDialog.tsx:77-79 — the props already exist; Phase 50 enriches in place.
/** D-05 basic numeric scale field (0 < s < 1). */
scale: number;
onScaleChange: (n: number) => void;

// VariantDialog.tsx:267 — the inline 4-decimal normalization to reuse (D-03):
const scaleToken = String(Number(props.scale.toFixed(4)));

// VariantDialog.tsx:118-119 — the D-04/D-08 pre-check to keep:
const scaleInvalid =
  !Number.isFinite(props.scale) || props.scale <= 0 || props.scale >= 1;
```

### Confirmed: the authoritative main-side gate (variant-export.ts) — unchanged, D-04
```typescript
// variant-export.ts:92 — the authoritative VariantScaleError reject (stays main-side):
if (!Number.isFinite(s) || s <= 0 || s >= 1) { /* throw VariantScaleError */ }
// variant-export.ts:57-58 — the canonical token the renderer mirrors:
export function formatScaleToken(s: number): string { return String(Number(s.toFixed(4))); }
```

### Confirmed: AppShell already wires scale state + summary into the dialog
```tsx
// AppShell.tsx:564 — factor state (default 0.5):
const [variantScale, setVariantScale] = useState<number>(0.5);
// AppShell.tsx:2584-2587 — summary + scale already flow into VariantDialog:
summary={summary}
scale={variantScale}
onScaleChange={setVariantScale}
// → the new summary.bbox reaches the dialog as props.summary.bbox with ZERO new wiring.
```

## State of the Art

No fast-moving external ecosystem here — the relevant "state of the art" is internal:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `new Skeleton` from spine-core-42 | `load.runtime.makeSkeleton` (adapter) | Phase 47 REG-47-01 (`53e480c`) | Mandatory: a hardcoded ctor crashes 4.3 rigs (`reading 'r'`). The bbox path must use `load.runtime`. |
| `aggregateWorldAABB` = slot-bindings union (test-only) | `computeSetupPoseBounds` = all-skins manifest union (core, exported) | This phase (D-06) | Generalization; robust to setup-hidden skin attachments. |
| Basic numeric scale field (Phase 49 D-05) | Two-way factor↔px aspect-locked control (Phase 50 D-01) | This phase | In-place enrichment of the SAME control + props (no refactor). |

**Deprecated/outdated:**
- Reading `skeleton.width/height` as the rig size — never trust editor metadata (CLAUDE.md #1; D-05). Confirmed unreliable across fixtures.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The recommended `SkeletonSummary.bbox` field name is `bbox: { w: number; h: number } \| null`. The exact field name is Claude's Discretion / planner's pick. | Architecture / shared types | Low — purely a naming choice; any additive primitive field works. Planner may prefer `setupBounds` or `rigBounds`. |
| A2 | Computing the bbox in `summary.ts` adds negligible cost (the comment at summary.ts:308-309 already notes the existing materialization is `<1ms on SIMPLE_TEST`). For very large rigs (spineboy: 78 attachments measured) it is still a single setup-pose pass — no per-frame loop. | Pitfall / seam | Low — it is one `updateWorldTransform('pose')` + a flat skin-entry walk; far cheaper than the sampler's multi-animation Pass 2. If a future giant rig regresses load time, memoize on the summary (it already is — computed once). |

**All other claims in this research were verified against live source or confirmed by the empirical probe.** The two assumptions above are low-risk naming/perf notes, not behavioral unknowns.

## Open Questions

1. **Should the renderer display the bbox W×H rounded to whole pixels?**
   - What we know: D-03 says displayed *target* pixels are whole numbers; the bbox itself is a float (e.g. `2190.41`).
   - What's unclear: whether the *reference* line shows `2190 × 1847` (rounded) or `2190.41 × 1847.11` (raw).
   - Recommendation: round the reference to whole pixels for visual consistency with the px target fields (`Math.round`), but compute derivations from the **unrounded** `bbox.w/h` to avoid compounding rounding into `s`. (Display rounding ≠ math rounding.)

2. **Behavior when `bbox == null` (degenerate rig) — exact copy + which inputs disable.**
   - What we know: the factor-only input must stay usable (CONTEXT degenerate flag); px fields have no axis to anchor against.
   - What's unclear: exact wording of the "no setup-pose geometry" state (Claude's Discretion / copy).
   - Recommendation: show the bbox reference line as e.g. "Setup-pose size: unavailable (no textured geometry)"; disable + blank the two px fields; keep the factor field fully functional (it never depended on bbox). This is a genuinely-rare case (every real exportable rig has textured attachments) but must degrade gracefully.

## Environment Availability

Not applicable in the external-tool sense — no new CLI/service/runtime dependency. The only "dependency" is the dual-runtime adapter resolution, which is already proven across all three entrypoints (verified by the empirical probe running through `tsx` + `register-esm-adapter-resolver.js`, and by the existing vitest setupFile at vitest.config.ts:23).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@esotericsoftware/spine-core` (4.3 canonical) | bbox + 4.3 rigs | ✓ | 4.3.0 | — |
| `spine-core-42` (4.2.111 npm alias) | bbox + 4.2 rigs | ✓ | 4.2.111 | — |
| vitest setupFile resolver (`tests/setup/esm-adapter-resolver.ts`) | bbox tests under vitest | ✓ | registered in vitest.config.ts:23 | — |

**Missing dependencies:** none.

## Validation Architecture

> Nyquist validation is ENABLED (`.planning/config.json` → `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (per `.planning/config.json` tech_stack.testing) |
| Config file | `vitest.config.ts` (setupFiles binds the dual-runtime adapter resolver, line 23) |
| Quick run command | `npx vitest run tests/core/setup-bounds.spec.ts` (the new core unit suite) |
| Full suite command | `npm run test` (vitest run) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCALEUI-02 | `computeSetupPoseBounds` returns finite `{w,h}` for a 4.2 rig (all-skins union) | unit | `npx vitest run tests/core/setup-bounds.spec.ts -t "4.2"` | ❌ Wave 0 |
| SCALEUI-02 | `computeSetupPoseBounds` returns finite `{w,h}` for a 4.3 rig (dual-runtime via adapter, no `reading 'r'`) | unit | `npx vitest run tests/core/setup-bounds.spec.ts -t "4.3"` | ❌ Wave 0 |
| SCALEUI-02 | All-skins union ≈ editor `skeleton.width/height` on a single-skin fully-visible rig (SIMPLE_TEST, ~1% tol) — D-08 cross-check oracle | unit | `npx vitest run tests/core/setup-bounds.spec.ts -t "cross-check"` | ❌ Wave 0 |
| SCALEUI-02 | All-skins union ≥ editor subset on a multi-skin rig (NOT exact — documents D-06 tradeoff) | unit | `npx vitest run tests/core/setup-bounds.spec.ts -t "all-skins envelope"` | ❌ Wave 0 |
| SCALEUI-02 | Degenerate rig (zero textured attachments) → returns `null` (not `-Infinity`) | unit | `npx vitest run tests/core/setup-bounds.spec.ts -t "degenerate"` | ❌ Wave 0 |
| SCALEUI-02 | `SkeletonSummary.bbox` is populated by `buildSummary` and is structuredClone-safe (finite-or-null) | unit | `npx vitest run tests/main/summary.spec.ts -t "bbox"` | ⚠️ extend existing summary.spec.ts (clone test at :132) |
| SCALEUI-02 | `core/setup-bounds.ts` is Layer-3 pure (no fs/sharp/electron/DOM); renderer does not import it | grep/arch | `npx vitest run tests/arch.spec.ts` (add a named anchor) | ⚠️ extend arch.spec.ts |
| SCALEUI-01 | `pxFromScale(s, axis) === Math.round(s*axis)`; `scaleFromPx(px, axis) === px/axis` (exact, no snap, D-03) | unit | `npx vitest run tests/renderer/variant-twoway.spec.ts -t "derivation"` | ❌ Wave 0 |
| SCALEUI-01 | Editing factor updates both px fields; editing a px field sets `s = px/axis` exactly + updates the other two (D-02) | component (jsdom) | `npx vitest run tests/renderer/variant-twoway.spec.tsx -t "two-way"` | ❌ Wave 0 |
| SCALEUI-01 | No round-trip drift on the edited axis (typed `512` stays `512` while focused, D-02) | component (jsdom) | `npx vitest run tests/renderer/variant-twoway.spec.tsx -t "no drift"` | ❌ Wave 0 |
| SCALEUI-01 | Typed px → `s ≥ 1` allows entry, shows ≥1 factor, disables Export, shows inline hint (D-04) | component (jsdom) | `npx vitest run tests/renderer/variant-twoway.spec.tsx -t "over-range"` | ❌ Wave 0 |
| SCALEUI-01/02 | `bbox == null` → px fields disabled/blank, factor field still usable (degenerate UI) | component (jsdom) | `npx vitest run tests/renderer/variant-twoway.spec.tsx -t "no geometry"` | ❌ Wave 0 |

**Human-verify-only (cannot be automated):**
- Visual layout / spacing / copy of the enriched Scale card (the W×H reference line + 3 fields) — jsdom cannot compute Tailwind layout (`feedback_layout_bugs_request_screenshots_early`). One screenshot UAT item: "the bbox reference + factor/W/H controls render legibly, aspect-locked editing feels right." This is the only manual gate.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/setup-bounds.spec.ts tests/renderer/variant-twoway.spec.*` (the directly-affected suites)
- **Per wave merge:** `npm run test` (full vitest) + `npm run typecheck:node` + `npm run typecheck:web`
- **Phase gate:** full suite green before `/gsd-verify-work`; the one screenshot UAT signed.

### Wave 0 Gaps
- [ ] `tests/core/setup-bounds.spec.ts` — covers SCALEUI-02 (dual-runtime union, cross-check oracle, all-skins envelope, degenerate null). Reuse the dual-runtime fixture pattern from `tests/scale-bake.spec.ts` / `tests/main/variant-dropin-faithful.spec.ts`. Suggested fixtures: SIMPLE_TEST (4.2, single-skin oracle — Δ 0.0%), skeleton2 (4.3, multi-skin envelope ≥ editor), a degenerate rig (skin with only a bounding-box attachment — may need a tiny committed fixture; if so, co-extend `SAFE01_EXCLUDED_PREFIXES` per [[feedback_new_committed_fixtures_need_safe01_denylist]], OR construct the degenerate skeletonData in-test without a fixture).
- [ ] `tests/renderer/variant-twoway.spec.ts` (pure helpers) + `tests/renderer/variant-twoway.spec.tsx` (jsdom component) — covers SCALEUI-01 (derivation, two-way binding, no-drift, over-range, no-geometry).
- [ ] Extend `tests/main/summary.spec.ts` — assert `summary.bbox` is populated + finite-or-null + structuredClone-safe (extend the existing clone test at :132).
- [ ] Extend `tests/arch.spec.ts` — named Layer-3 anchor for `src/core/setup-bounds.ts` (no fs/sharp/electron/DOM), mirroring the Phase-48 scale-bake anchor (arch.spec.ts:384). The existing renderer-↛-core grep (arch.spec.ts:20) already covers the renderer-must-not-import-core direction automatically.
- Framework install: none — vitest is already configured.

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` (treated as enabled). This phase has **no authentication, session, network, or external-input attack surface** — it is in-process geometry math + a local desktop UI control reading already-loaded, already-validated skeleton data.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — desktop app, no auth in this phase |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | yes (light) | The two numeric inputs already parse defensively (`parseFloat` + `Number.isFinite` fallback, VariantDialog.tsx:317-318); the px→scale derivation must guard `bbox != null` and `axis > 0` before dividing (avoid `Infinity`/`NaN` from divide-by-zero). The authoritative `s` range gate stays main-side (`VariantScaleError`). |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for {Electron + TS + React, in-process math}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/degenerate skeleton → NaN/Infinity propagating into the UI or across IPC | Tampering / DoS (display) | Degenerate guard returns `null` (Pitfall 1); px derivation guards `bbox != null && axis > 0`; `structuredClone`-safety test enforces finite-or-null. |
| Renderer reaching into core/main internals | Elevation (layer-boundary) | Layer-3 gate (arch.spec.ts:20) — renderer reads precomputed `summary.bbox` only; never imports `core/`/`variant-export.ts`. |

No new IPC channel, no new file write, no new external process — the phase is strictly within the existing trust boundaries Phase 49 established.

## Sources

### Primary (HIGH confidence — live source read this session)
- `src/main/summary.ts` (full) — `buildSummary`; the REG-47-01-safe `rt.makeSkeleton` materialization at line 325 + null-guard; `runtimeTag: rt.tag` precedent for an additive field; the return object shape.
- `src/core/bounds.ts` (full) — `attachmentWorldAABB` (lines 54-84), the skip-list `null` return, the AABB fold.
- `src/core/sampler.ts:150-289` — Pass 1.5 manifest pattern (`rt.skinEntries` + `attachmentWorldAABB`, no slot mutation); `project_sampler_visibility_invariant` embodiment.
- `tests/main/variant-dropin-faithful.spec.ts:1-209` — `aggregateWorldAABB(load)` (lines 144-180, the prototype to generalize); the dual-runtime co-import harness + MATRIX (SIMPLE_PROJECT 4.2 + SLIDER_4_3 4.3).
- `src/core/runtime/runtime.ts` (full) — the `SpineRuntime` interface; all required methods present; `pickRuntime` 3-arm resolution (vitest resolver / prod CJS require / loud-throw).
- `src/core/runtime/runtime-43.ts:321-439` + `runtime-42.ts:339-349` — concrete `setupPose`/`setupPoseSlots`/`slotAttachment`/`skinEntries`/`attachmentKind` bodies; 4.3 `placeholder`→`name` normalization.
- `src/renderer/src/modals/VariantDialog.tsx` (full) — `scale`/`onScaleChange` props (77-79), the inline `Number(props.scale.toFixed(4))` (267), the D-04/D-08 `scaleInvalid` pre-check (118-119), the field to replace (299-331), Tailwind literal-class idiom.
- `src/main/variant-export.ts:53-92` — `formatScaleToken` (57-58) + the authoritative `VariantScaleError` reject (92); `handleExportVariant(evt, summary, …)` (69-71).
- `src/shared/types.ts:752-878` — `SkeletonSummary` shape (additive `bbox` slot-in point; `runtimeTag` additive-field precedent).
- `tests/arch.spec.ts` (full) — Layer-3 gates: renderer-↛-core grep (20-34), core-↛-fs/sharp (148-178), the Phase-48 scale-bake named anchor to mirror (384-394).
- `src/renderer/src/components/AppShell.tsx:557-2605` — `variantScale` state (564), `summary` + `scale`/`onScaleChange` already passed to `VariantDialog` (2584-2587).
- `scripts/cli.ts` (full) — confirms the CLI does NOT call `buildSummary` (loadSkeleton → sampleSkeleton → analyze, 149-166) — the Pitfall-2 finding.
- `.planning/config.json` — `nyquist_validation: true`; tech_stack.

### Empirical (HIGH confidence — executed this session through the real adapter)
- `computeSetupPoseBounds` prototype (all-skins union) run via `tsx` + `register-esm-adapter-resolver.js` on SIMPLE_TEST / skeleton2 / spineboy-pro:
  - SIMPLE_TEST (4.2): union `2190×1847` vs editor `2190×1847` → **Δ 0.0% / 0.0%** (n=4) — the clean cross-check oracle.
  - skeleton2 (4.3): union `1669×2146` vs editor `1399×2146` → **Δ +19.3% / 0.0%** (n=6) — all-skins ≥ editor subset.
  - spineboy-pro (4.3): union `1419×1047` vs editor `418×686` → **Δ +239% / +52%** (n=78) — confirms D-06 "largest envelope" tradeoff; a BAD oracle.
- Degenerate fold: `maxX(-Infinity) - minX(Infinity) === -Infinity`, `Number.isFinite` → `false` — confirms the `measured===0` guard is mandatory.
- Editor headers read from JSON: SLIDER-01/XTRA-01 report `10×10` (meaningless test-box) — confirms D-05's "don't trust editor metadata."

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Phase 48/49 completion context; v1.7 history; the Phase-49 plan structure that built `VariantDialog`.
- `.planning/REQUIREMENTS.md` — SCALEUI-01/02 wording (lines 43-44), Traceability rows 78-79.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; every reused module + method confirmed in live source.
- Architecture (seam choice + core function): HIGH — the prototype exists and was executed end-to-end through both runtimes this session; the summary seam reuses an already-bound `rt`.
- Two-way control math: HIGH — three trivial pure functions; the canonical `toFixed(4)` precision confirmed byte-identical to `formatScaleToken`; props already wired.
- Pitfalls: HIGH — degenerate (`-Infinity`), CLI-bypass, and all-skins-≥-editor findings are each empirically demonstrated, not assumed.

**Research date:** 2026-05-22
**Valid until:** 2026-06-21 (30 days — internal codebase, stable; no fast-moving external dependency). Re-verify only if `summary.ts`/`VariantDialog.tsx`/the runtime facade change before planning.

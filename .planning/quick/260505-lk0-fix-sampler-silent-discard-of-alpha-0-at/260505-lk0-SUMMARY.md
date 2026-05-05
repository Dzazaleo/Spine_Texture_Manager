---
phase: 260505-lk0
plan: 01
type: tdd
subsystem: src/core/sampler.ts
tags: [sampler, skin-manifest, regression-fix]
requirements:
  completed:
    - SAMPLER-SKIN-MANIFEST-COVERAGE
dependency-graph:
  requires:
    - "@esotericsoftware/spine-core (Skin.getAttachments / SkinEntry shape)"
    - "src/core/bounds.ts (attachmentWorldAABB / computeRenderScale — accept arbitrary attachment param)"
  provides:
    - "globalPeaks/setupPosePeaks coverage for every attachment declared in any skin manifest, independent of slot binding"
    - "Cross-load symmetry: atlas-source vs optimized-folder loads now report identical attachment sets"
  affects:
    - "src/core/usage.ts (consumes globalPeaks; no code change)"
    - "src/core/export.ts (consumes globalPeaks; no code change)"
    - "src/main/summary.ts (consumes globalPeaks; no code change)"
    - "tests/core/atlas-preview.spec.ts case (d) Ghost-fixture (test expectation updated to reflect now-correct behavior)"
tech-stack:
  added: []
  patterns:
    - "Per-skin manifest sweep after setup-pose snapshot (Pass 1.5) — fills the gap left by the live-binding pass without touching it"
    - "Defer-rule dedup via globalPeaks.has(key) guard — runs strictly after Pass 1 within the same skin scope so no double-emit is possible"
key-files:
  created:
    - "tests/core/sampler-skin-defined-unbound-attachment.spec.ts (regression spec; 7 cases — 3 it.each × 2 rows + 1 size-sanity)"
  modified:
    - "src/core/sampler.ts (Pass 1.5 skin-manifest sweep added inside per-skin loop; snapshotFrame untouched; alpha gate + null-binding guard preserved)"
    - "tests/core/atlas-preview.spec.ts (case (d) Ghost-fixture — test expectation updated to reflect correctly-restored GHOST measurement; no source-code change to atlas-preview / export / consumers)"
decisions:
  - "TRUE bug shape (empirically confirmed): skin manifest declares attachments that no slot binding ever activates → silently discarded by slot-walking sampler. Fix is a new skin-manifest pass, not removing any existing guard."
  - "FALSIFIED prior plan (2026-05-05 PRE-overwrite): the original PLAN.md targeted the alpha gate at sampler.ts:291 (now :390) based on misdiagnosis. Empirical fixture probe confirmed both JOKER-BG and JOKER-FRAME slot defs have no `color` field (default alpha 1.0). The alpha gate is preserved unchanged."
  - "Defer rule on existing keys: the new pass emits ONLY for keys absent from globalPeaks, so visible-attachment peaks from the existing setup-pose pass are never double-emitted or overwritten."
  - "setupPoseBaseline write in the new pass: prevents D-54 affected-check false-positives if a future animation later binds a previously-unbound skin-declared attachment."
metrics:
  duration: ~10 minutes
  completed: 2026-05-05
---

# Plan 260505-lk0: Fix Sampler Silent-Discard of Skin-Declared Unbound Attachments — Summary

One-liner: Adds a per-skin manifest sweep to `sampleSkeleton` (Pass 1.5) so attachments declared in any skin's manifest but never bound to a slot at setup pose and never raised by an animation timeline are still measured for peak scale, restoring cross-load symmetry between atlas-source and optimized-folder loads.

## Commits

- **RED:** `b77017e` — `test(260505-lk0): add failing regression spec for skin-declared unbound attachments`
- **GREEN:** `0832660` — `fix(260505-lk0): add skin-manifest pass so skin-declared unbound attachments are measured`

Both commits land on per-agent branch `worktree-agent-lk0-1777993900` (current HEAD).

## Fixture & Regression Targets

**Path:** `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json`

| skinName | slotName     | attachmentName | sourceW | sourceH |
|----------|--------------|----------------|---------|---------|
| `default`| `JOKER-BG`   | `JOKER/BG`     | 2660    | 2500    |
| `default`| `JOKER-FRAME`| `JOKER/FRAME`  | 2913    | 2763    |

Both slots are bound to bone `TOP_JOKER`. Both have `slot.attachment = null` in setup pose (no `attachment` field on the slot def at fixture lines 1127-1128). No animation timeline raises them. Default skin defines both bindings (lines 1523-1567).

The SETUP_POSE_LABEL sentinel is `"Setup Pose (Default)"` (sampler.ts:82).

## TRUE bug shape vs FALSIFIED prior plan

**TRUE shape (this plan):** Skin manifests can declare bindings (`slotName → attachmentName`) that no setup-pose slot binding and no animation `AttachmentTimeline` ever activate. The current sampler walks `skeleton.slots`, sees `slot.getAttachment() === null` (sampler.ts:285, now :385), and correctly skips — but that guard is for the live-binding pass. Skin-declared attachments that no slot binding activates need a separate pass that walks `skin.getAttachments()`. Per the user's locked principle: visibility (slot binding null OR alpha 0) is runtime-mutable; ALL skin-declared attachments must be measured for peak scale, optimization, and export.

**FALSIFIED shape (prior PLAN.md, overwritten 2026-05-05):** A previous plan iteration targeted the alpha gate at sampler.ts:291 (now :390). Empirical TDD probe of the JOKER fixture falsified that model — both `JOKER-BG` and `JOKER-FRAME` slot defs have NO `color` field (default alpha 1.0), so the alpha gate never fires for these slots. Removing it would change nothing. The bug is upstream of slot iteration: the sampler never iterates skin-declared attachments that no slot binds. This plan explicitly preserves the alpha gate.

## Fix shape

Inside `sampleSkeleton`, inside the per-skin loop, **after** the existing setup-pose `snapshotFrame(...)` Pass 1 call (sampler.ts:173-186) and **before** the per-animation Pass 2 loop, a new Pass 1.5 walks `skin.getAttachments()`. World transforms from the preceding `Physics.pose` call are still current.

For each `SkinEntry { slotIndex, name, attachment }`:

1. Resolve the slot via `skeleton.slots[entry.slotIndex]`.
2. Skip if `globalPeaks.has(key)` — defer to existing path; no double-emit.
3. Skip non-textured subtypes (`BoundingBox` / `Path` / `Point` / `Clipping`) via `attachmentWorldAABB(slot, attachment)` returning `null`.
4. Mirror `snapshotFrame`'s region-name resolution: prefer `attachment.region.name` (path indirection), fall back to `entry.name`. Identical lookup path so cross-load symmetry holds.
5. Emit a `PeakRecord` with `animationName === SETUP_POSE_LABEL`, `isSetupPosePeak: true`, `time: 0`, `frame: 0` into BOTH `globalPeaks` AND `setupPosePeaks` (mirrors `snapshotFrame`'s setup-pose-pass dual write).
6. Write `setupPoseBaseline.set(key, peakScale)` so the per-animation D-54 affected-check has a real baseline if a future animation later binds the attachment via `AttachmentTimeline`.

No slot mutation (`slot.setAttachment`) — `attachmentWorldAABB` and `computeRenderScale` accept the attachment as a parameter (verified at bounds.ts:59-92 and bounds.ts:148-184).

## What is preserved unchanged (per plan constraints)

- **`slot.getAttachment() === null` guard at sampler.ts:285 (now :385):** Preserved bit-for-bit. Correct for the live-binding pass; the gap is filled by the new pass, not by relaxing this guard.
- **`slot.color.a <= 0` alpha gate at sampler.ts:291 (now :390):** Preserved bit-for-bit. The falsified prior plan targeted this line; this plan does not modify it.
- **`snapshotFrame` body:** Byte-identical pre-fix vs post-fix (`diff` returns no output).
- **Per-animation Pass 2 + downstream consumers (`usage.ts`, `export.ts`, `summary.ts`, renderer code):** No source change.

## Test results

### Regression spec (new)
`npx vitest run tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — **7 passed** (3 it.each blocks × 2 regression rows + 1 size-sanity it).

### Existing sampler suite
`npx vitest run tests/core/sampler.spec.ts` — **36 passed, 1 skipped** (the easing-curve stretch). No regression on SIMPLE_TEST golden, hygiene grep, perf gate, determinism, numeric goldens, or breakdown extension.

### Full repo suite
`npm run test` — **773 passed, 4 failed, 1 skipped, 2 todo (780 total)**.

Final test count is **N+8** rows compared to the pre-fix baseline (matches plan's prediction): 7 new test rows in the regression spec + 1 net-equivalent update to the existing GHOST test (which was always 1 it() with 2 mode iterations, now 1 it() with split assertions).

## Deferred Issues — pre-existing failures (NOT caused by this plan)

The following 4 tests fail on the pre-existing dirty working tree and are independent of the sampler change. Verified pre-existing by stashing the GREEN edit and re-running each one — all 4 fail identically without my edit. None are in `core/`. Per scope rules, these are out of scope for this fix.

| File | Test | Note |
|------|------|------|
| `tests/integration/build-scripts.spec.ts` | `package.json version is 1.1.3` | Pre-existing version mismatch in the dirty tree |
| `tests/renderer/atlas-preview-modal.spec.tsx` | `dblclick on canvas calls onJumpToAttachment with the hit region attachmentName` | Pre-existing renderer-test issue |
| `tests/renderer/save-load.spec.tsx` | `Save reuses currentProjectPath` | Pre-existing renderer-test issue |
| `tests/renderer/save-load.spec.tsx` | `Open → SkeletonNotFoundOnLoadError envelope → Locate skeleton uses threaded projectPath` | Pre-existing renderer-test issue |

## Deviations from Plan

### Auto-updated test (Rule 1 / Rule 3 — anticipated by plan's Task 2 action block)

**1. tests/core/atlas-preview.spec.ts case (d) Ghost-fixture — test expectation updated**
- **Found during:** Task 2 GREEN — running the full test suite
- **Issue:** The test `SIMPLE_TEST_GHOST → GHOST absent from preview` asserted the bug-shape behavior (GHOST silently discarded by sampler). After the fix, GHOST is correctly measured per the user's locked principle, so the assertion needed to be flipped.
- **Investigation:** GHOST is declared in the SIMPLE_TEST_GHOST default skin's manifest under slot CIRCLE (alongside the live CIRCLE attachment) but never bound to any slot at setup pose and never raised by an animation timeline. This is exactly the same pattern as JOKER-BG / JOKER-FRAME (the regression anchors). The skin-manifest pass measures it via the slot's bone, emits a `PeakRecord` with `sourceW/H = 64/64`, and so it now reaches `summary.peaks` → `buildAtlasPreview` inputs.
- **Mode-specific note documented in the test:** In `'original'` mode all peaks (including GHOST) flow into the projection directly, so GHOST is visible. In `'optimized'` mode `buildAtlasPreview` reads from `buildExportPlan.rows`, and `buildExportPlan` splits no-resize rows (where `outW === sourceW && outH === sourceH`) into `passthroughCopies`. For SIMPLE_TEST_GHOST baseline (no overrides), every region — including CIRCLE/SQUARE/TRIANGLE/GHOST — has peakScale clamped to ≤ 1.0 (Phase 6 Gap-Fix #1), so all rows go to `passthroughCopies`. `plan.rows` is empty, projection is empty. This is pre-existing behavior independent of GHOST.
- **Fix:** Updated assertion to `expect(originalNames).toContain('GHOST')` for `'original'` mode + a sanity check that `summary.peaks` now contains GHOST. Removed the `'optimized'` mode assertion (which would assert against an empty projection — see mode-specific note above).
- **Files modified:** `tests/core/atlas-preview.spec.ts` (test only; no source change to `atlas-preview.ts` / `export.ts` / consumers)
- **Commit:** `0832660` (folded into the GREEN commit, since it's a test expectation that follows directly from the source change)

The plan's Task 2 action block explicitly anticipated this:
> If `npm run test` reveals a downstream failure (e.g. a `summary.ts` or `export.ts` test now sees more peaks than expected), do NOT modify the consumer — the test expectation needs to be updated to reflect the now-correct behavior.

## Cross-load symmetry note

After this fix, atlas-source and optimized-folder loads of `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json` now agree on the attachment set. JOKER-BG / JOKER-FRAME are present in `globalPeaks` and `setupPosePeaks` in both modes; the export plan includes them; the optimized images folder will receive their PNGs after the next Optimize Assets run.

## Migration note for users

Users with previously-optimized folders need to re-run **Optimize Assets** to write PNGs for the now-included attachments. No migration logic; fix-forward per the plan's scope constraints.

## Self-Check: PASSED

- ✓ `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` exists.
- ✓ `tests/core/atlas-preview.spec.ts` exists (modified).
- ✓ `src/core/sampler.ts` exists (modified — Pass 1.5 added at line 188-263).
- ✓ Commit `b77017e` (RED) found via `git log --oneline | grep b77017e`.
- ✓ Commit `0832660` (GREEN) found via `git log --oneline | grep 0832660`.
- ✓ `grep -n 'skin\.getAttachments' src/core/sampler.ts` returns line 228 (skin-manifest pass present).
- ✓ Live alpha gate at line 390 unchanged from pre-fix.
- ✓ Live null-binding guard at lines 384-385 (`const attachment = slot.getAttachment(); if (attachment === null)`) byte-identical to pre-fix lines 285-286.
- ✓ `snapshotFrame` function body byte-identical pre-fix vs post-fix (`diff` empty output).
- ✓ Regression spec passes: 7/7.
- ✓ Existing sampler suite passes: 36 passed, 1 skipped.
- ✓ Full repo: 773 passed, 4 failed (all pre-existing, none in `core/`, none caused by this fix).

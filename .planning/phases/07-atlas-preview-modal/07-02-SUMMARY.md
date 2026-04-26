---
phase: 07-atlas-preview-modal
plan: 02
subsystem: core-projection
tags: [phase-07, wave-2, core, layer-3, projection, parity, packing, maxrects]

# Dependency graph
requires:
  - phase: 07-atlas-preview-modal
    plan: 01
    provides: maxrects-packer ^2.7.3 + 4 Phase 7 IPC types in src/shared/types.ts + 18 it.todo RED stub at tests/core/atlas-preview.spec.ts
  - phase: 06-optimize-assets-image-export
    provides: buildExportPlan(summary, overrides) → ExportRow[] (D-108 dedup + D-110 ceil-thousandth + D-111 override resolution)
  - phase: 04-scale-overrides
    provides: Layer 3 inline-copy precedent (D-75) extended from overrides-view.ts → export-view.ts → atlas-preview-view.ts
  - phase: 05-unused-attachment-detection
    provides: summary.unusedAttachments (D-101) consumed for D-109 parity exclusion
provides:
  - src/core/atlas-preview.ts — canonical buildAtlasPreview(summary, overrides, opts) → AtlasPreviewProjection
  - src/renderer/src/lib/atlas-preview-view.ts — byte-identical renderer copy importing sibling export-view.js (NEVER core/)
  - tests/core/atlas-preview.spec.ts — 18 GREEN cases + 1 it.todo (case (e)) covering F7.1 / F7.2 contract + Layer 3 hygiene + parity
affects: [07-03, 07-04, 07-05]

# Tech tracking
tech-stack:
  added: []  # All deps already installed by Plan 01
  patterns:
    - "Layer 3 inline-copy precedent extended to atlas-preview: same shape as overrides-view.ts (Phase 4 D-75) and export-view.ts (Phase 6 D-108) — renderer copy imports sibling './export-view.js' (NEVER '../../core/*'); arch.spec.ts:19-34 grep auto-validates."
    - "Determinism via inputs.sort(sourcePath, attachmentName) BEFORE packer.add — mirrors src/core/export.ts:223 sort discipline; two runs over identical SkeletonSummary produce byte-identical AtlasPreviewProjection (locked by case (f) determinism assertion)."
    - "MaxRectsPacker hardcoded params D-132 + RESEARCH Recommendation A: 2px padding, allowRotation:false, smart:true, pot:false, square:false, border:0 — pot/square false enables tight-fit bin sizing for honest efficiency calc (RESEARCH Pitfall 7)."
    - "D-136 degenerate-input emit-empty-page invariant: when summary.peaks is empty (or filter-collapsed), pages[] gets exactly one zero-dim entry so the modal always has something to render. Locked by behavior-block contract; not directly tested in 07-02 (no degenerate fixture) but the implementation branch is in place for Plan 04."

key-files:
  created:
    - "src/core/atlas-preview.ts (210 lines — canonical pure-TS projection builder)"
    - "src/renderer/src/lib/atlas-preview-view.ts (202 lines — byte-identical renderer inline copy)"
    - ".planning/phases/07-atlas-preview-modal/07-02-SUMMARY.md (this file)"
  modified:
    - "tests/core/atlas-preview.spec.ts (78 → 349 lines — 18 it.todo replaced with real assertions; 1 it.todo retained for case (e) atlas-packed fixture, deferred to Plan 04 per RESEARCH §Open Question 3)"

key-decisions:
  - "Case (b) split into TWO assertions to honor the SIMPLE_TEST fixture reality. The plan's behavior block reads 'Optimized efficiency strictly higher than Original (regions are smaller).' The actual fixture has CIRCLE peakScale=2.02, SQUARE 1.5, TRIANGLE 2.0 — ALL ≥ 1.0, so Phase 6 Gap-Fix #1 clamps every effectiveScale to 1.0 and Optimized dims literally equal Original dims. The realistic Phase 7 user workflow IS the override-driven path (the 20%-glow user-story in 07-CONTEXT.md §specifics is the canonical case). I split case (b) into: (b.1) with 50% override on each region — strictly smaller optimized regions + strictly fewer used pixels (the Phase 7 savings story); (b.2) baseline no-overrides — Optimized dims === Original dims (locks the downscale-only invariant the modal exposes truthfully). Both assertions still test D-125 (Optimized reads from buildExportPlan); together they cover the realistic UX more faithfully than the original wording."
  - "Case (e) atlas-packed BEFORE remained it.todo, exactly as the plan permitted ('synthesized atlas-packed fixture: BEFORE input dims = atlasSource.w/h'). RESEARCH §Open Question 3 + plan 07-02 §case (e) explicitly note the fixture may need synthesis and the it.todo is acceptable for Plan 02. The implementation branch IS in place (Original mode reads peak.atlasSource?.w/.h when present) — it's the test fixture that's missing."
  - "Renderer view docblock comment '../../core/*' rewritten to backtick-quoted prose 'any `core/` relative path' to avoid arch.spec.ts:19-34 false-positive grep match. The grep matches `from ['\"][^'\"]*\\/core\\/` and the original docblock contained the literal `'../../core/*'` substring inside single quotes. Detected on first arch.spec.ts run; fixed by rephrasing the comment, no behavioral change."
  - "Plan's literal action template suggested emitting one AtlasPreviewInput per ExportRow (i.e., per sourcePath). buildExportPlan dedups by sourcePath (D-108) and carries attachmentNames[] — but the modal needs to hit-test EVERY attachment in the canvas for D-130's dblclick-jump (otherwise two attachments sharing a region collapse to one rect and only one user-story can be triggered). Implementation walks every attachmentName in the row and emits one AtlasPreviewInput per attachment (with shared sourcePath/atlasSource) so the modal can dblclick-jump from either alias. Same packer outcome (each attachment fed at the row's outW/outH) but the projection.regions list now carries each attachment-name."

patterns-established:
  - "Pattern: Layer 3 inline-copy with Renderer-only IPC-free hot path. AtlasPreviewModal calls buildAtlasPreview on every toggle/pager change; an IPC round-trip per toggle would feel sluggish. Renderer copy at src/renderer/src/lib/atlas-preview-view.ts gives sub-millisecond responsiveness without crossing the bridge. Same shape as overrides-view.ts (Phase 4 D-75) + export-view.ts (Phase 6 D-108). Future renderer-only hot paths follow this exact split."
  - "Pattern: Determinism gate via input-sort BEFORE packer.add. Mirrors src/core/export.ts:223 sort-by-sourcePath. Locked by case (f) running buildAtlasPreview twice and asserting .toEqual(). Future packer-driven projections (e.g. font glyph atlasing if ever added) follow this exact pattern."
  - "Pattern: byte-identical function-body parity asserted via dynamic import + .toEqual() across N representative inputs (5 in case-block parity here: 4 mode×maxPageDim combos + 1 with overrides). Same shape as tests/core/export.spec.ts:635-666. The diff command in the plan's acceptance_criteria additionally validates the function source itself is byte-identical excluding the imports block."

requirements-completed: [F7.1, F7.2]

# Metrics
duration: ~7min
completed: 2026-04-25
---

# Phase 7 Plan 02: Pure-TS atlas-preview projection + renderer-side inline copy + RED → GREEN spec drive Summary

**buildAtlasPreview canonical (src/core/atlas-preview.ts, 210 lines) + byte-identical renderer copy (src/renderer/src/lib/atlas-preview-view.ts, 202 lines) folds SkeletonSummary.peaks + overrides Map + summary.unusedAttachments into AtlasPreviewProjection per (mode, maxPageDim) via maxrects-packer with hardcoded D-132 params. Drives Plan 01's 18 it.todo RED stub to GREEN — case (a)..(d), (f), (g), (h) all green; case (e) atlas-packed remains it.todo per RESEARCH §Open Question 3.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-25T19:33:00Z (approx — Task 1 file creation)
- **Completed:** 2026-04-25T19:40:00Z
- **Tasks:** 3 / 3
- **Files created:** 3 (canonical + renderer view + this SUMMARY)
- **Files modified:** 1 (tests/core/atlas-preview.spec.ts: 78 → 349 lines)

## Accomplishments

- `src/core/atlas-preview.ts` (210 lines): canonical pure-TS `buildAtlasPreview(summary, overrides, opts)` → `AtlasPreviewProjection`. Folds inputs per mode (Original = sourceW/H or atlasSource.w/h; Optimized = ExportRow.outW/outH from buildExportPlan), runs MaxRectsPacker with D-132 hardcoded params (2px padding, no rotation, smart, pot:false, square:false), emits per-page AtlasPage[] with efficiency calc. D-136 degenerate-input branch emits an empty page so the modal always has something to render. Layer 3 hygiene: zero node:fs/sharp/electron/DOM imports.
- `src/renderer/src/lib/atlas-preview-view.ts` (202 lines): byte-identical inline copy (function bodies are byte-for-byte identical to canonical, verified by `diff` exit 0). Imports type-only from `../../../shared/types.js`, runtime `buildExportPlan` from sibling `./export-view.js`, runtime `MaxRectsPacker` from npm. Zero `core/` imports — passes arch.spec.ts:19-34 grep. AtlasPreviewModal.tsx (Plan 04) will call this on every toggle/pager change without crossing IPC.
- `tests/core/atlas-preview.spec.ts` (349 lines, was 78): 18 RED `it.todo` stubs replaced with real assertions; 1 retained for case (e) atlas-packed fixture (RESEARCH §Open Question 3 — fixture synthesis deferred to Plan 04 if needed).
  - Cases (a) Original @ 2048, (c) override 50% TRIANGLE, (d) ghost-fixture exclusion, (f) multi-page determinism at 128, (g) Optimized dims = buildExportPlan output, (h) D-127 metrics surface — all green.
  - Case (b) split into TWO assertions per fixture reality (see Decisions below) — both green.
  - Hygiene block (5 specs): no node:fs/sharp/electron/DOM; exports buildAtlasPreview by name. All green.
  - Parity block (5 specs): renderer exports buildAtlasPreview; zero core/* imports; uses sibling export-view.js; both files share D-132 packer signature; dynamic-import view produces IDENTICAL projection to canonical across 5 representative inputs. All green.
- Phase 0-6 invariants preserved: 228 tests pass + 1 skipped + 7 todo (was 210/1/24); locked files (`scripts/cli.ts`, `src/core/sampler.ts`) `git diff` empty.

## Task Commits

Each task committed atomically with `--no-verify` (parallel-executor pattern):

1. **Task 1: Canonical pure-TS buildAtlasPreview** — `bd6a774` (feat)
2. **Task 2: Renderer-side inline copy (Layer 3 D-75/D-108 precedent)** — `d2fb400` (feat)
3. **Task 3: Drive RED stub spec → GREEN (18 cases + parity + hygiene)** — `4974680` (test)

## Files Created/Modified

### Created

- `src/core/atlas-preview.ts` — 210 lines. Canonical `buildAtlasPreview` + `deriveInputs` helper. Imports type-only from `../shared/types.js`, runtime `buildExportPlan` from `./export.js`, runtime `MaxRectsPacker` from `'maxrects-packer'`. Header docblock documents the 6-step algorithm + Layer 3 hygiene contract + caller list. Function-body byte-identical to renderer view.

- `src/renderer/src/lib/atlas-preview-view.ts` — 202 lines. Byte-identical renderer inline copy. Imports type-only from `../../../shared/types.js`, runtime `buildExportPlan` from sibling `./export-view.js`, runtime `MaxRectsPacker` from `'maxrects-packer'`. Header docblock documents the parity contract + Layer 3 ban on core/ imports + caller (AtlasPreviewModal Plan 04). The 8-line difference vs canonical (210 vs 202) is exclusively in the import-block docblock + import statements; function bodies are byte-identical.

### Modified

- `tests/core/atlas-preview.spec.ts` — 78 → 349 lines. 18 `it.todo` slots replaced with real `it(...)` assertions. 1 `it.todo` retained for case (e) atlas-packed-fixture (deferred to Plan 04). Helper `loadSummary` added at top (load → sample → analyze → synthesize sourcePath, mirrors tests/core/export.spec.ts case (a)/(e) idiom).

## Decisions Made

### Case (b) split into two assertions per fixture reality

Plan's behavior block (§Tests case b): `Optimized @ 2048: same fixture, same regions, smaller dims (post-Phase-6 buildExportPlan); efficiency strictly higher than Original.` Sounds reasonable in the abstract.

The actual SIMPLE_TEST fixture has every region's `peakScale ≥ 1.0`:
- CIRCLE peak 2.0183 (sourceW=699)
- SQUARE peak 1.5000 (sourceW=1000)
- TRIANGLE peak 2.0000 (sourceW=833 / sourceH=759)

Phase 6 Gap-Fix #1 (`effectiveScale = Math.min(safeScale(rawEffScale), 1)`) clamps every effectiveScale to 1.0 in the no-override path. Result: `outW = ceil(sourceW × 1.0) = sourceW` for every region. Optimized dims === Original dims. Efficiency identical.

The user-story for D-130 (the canonical "20% glow override" workflow at 07-CONTEXT.md §specifics) IS the override-driven path: user opens Atlas Preview → sees a glow texture too big → applies override → reopens → glow rect shrinks. Test that workflow.

I split case (b) into two assertions:
1. **(b.1) with 50% override on each region** — strictly smaller optimized regions + strictly fewer used pixels. This IS the Phase 7 savings-story contract.
2. **(b.2) baseline no-overrides** — Optimized dims === Original dims. Locks Phase 6 Gap-Fix #1 downscale-only invariant the modal exposes truthfully (no fake savings shown when none exist).

Both assertions still validate D-125 (Optimized branch reads from buildExportPlan). Together they cover both the savings UX AND the no-savings-available UX faithfully. The hard-coded efficiency-greater-than direction in the plan's literal wording was a slight mis-spec given the fixture; this rewrite hews to the spirit (Optimized ≤ Original always; strictly smaller when downscaling applies).

### Case (e) atlas-packed fixture remains it.todo

Plan permitted: `Skip if no atlas-packed fixture in fixtures/ — note as it.todo if so. Otherwise verify input dims === atlasSource.w/h.`

`fixtures/SIMPLE_PROJECT/` has only per-region-PNG fixtures. RESEARCH §Open Question 3 + 07-CONTEXT.md §specifics explicitly note that the atlas-packed Jokerman fixture may need synthesis. The atlasSource branch IS implemented (Original mode reads `peak.atlasSource?.w/.h` when present). Locked by Plan 04 if that lands a synthesized atlas-packed fixture; otherwise the it.todo is acceptable per the plan's literal wording.

### Renderer-view docblock comment rewritten to avoid arch.spec.ts grep false-positive

The arch.spec.ts:19-34 grep `/from ['"][^'"]*\/core\/|from ['"]@core/` matched a docblock comment containing the literal string `'../../core/*'` (single-quoted prose). Detected on first arch.spec.ts run after Task 2 file creation. Rewrote the prose to use backtick-quoted forms (`from \`...\`` shape) so the comment still conveys "NEVER from any core/ relative path" without tripping the grep. Behavioral identical; cosmetic change in the docblock only.

### Per-attachment AtlasPreviewInput emission (vs per-row)

Plan's literal action template emitted one AtlasPreviewInput per ExportRow. buildExportPlan dedups by sourcePath (D-108) and a single ExportRow can carry multiple attachmentNames (the `attachmentNames: string[]` field). Two attachments sharing one source PNG would collapse to ONE rect in the projection — but the modal needs to hit-test EVERY attachment (D-130 dblclick-jump must work from either alias). I walk every `attachmentName` in `row.attachmentNames` and emit one AtlasPreviewInput per attachment (with shared sourcePath/atlasSource). Same packer outcome dimensionally (each fed at row.outW/outH); projection.regions list now carries each attachment-name as a hit-testable rect. Implementation choice anchored by the modal's D-130 user-story (one rect per attachment).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Renderer-view docblock prose tripped arch.spec.ts grep**

- **Found during:** Task 2 verify (arch.spec.ts run after creating renderer view)
- **Issue:** Docblock comment contained the substring `'../../core/*'` (literal prose mentioning the forbidden path). The arch.spec.ts:19-34 grep `/from ['"][^'"]*\/core\/|from ['"]@core/` matched the comment, flagging the file as a Layer 3 violation.
- **Fix:** Rewrote the docblock prose to use backtick-quoted forms (`` `core/` relative path ``) so the meaning is preserved without the literal `'.../core/'` quoted-import substring.
- **Files modified:** src/renderer/src/lib/atlas-preview-view.ts (docblock lines 21-25 only)
- **Commit:** Folded into Task 2's `d2fb400` (file was created + immediately rephrased before any commit landed; no separate fixup commit needed).

**2. [Rule 1 — Bug] Case (b) assertion direction mismatched fixture reality**

- **Found during:** Task 3 verify (npm run test on freshly-written spec)
- **Issue:** Initial case (b) wrote `expect(optimized.efficiency).toBeGreaterThan(original.efficiency)`. Failed because SIMPLE_TEST regions all have peakScale ≥ 1.0, which clamps to effectiveScale = 1.0, which makes Optimized dims === Original dims. Plan-text and fixture-reality conflicted.
- **Fix:** Split case (b) into (b.1) override-driven path proving the strictly-smaller contract and (b.2) baseline no-overrides locking the downscale-only invariant. Both green; together they cover both UX outcomes the modal will surface (savings available / no savings available).
- **Files modified:** tests/core/atlas-preview.spec.ts (case (b) describe block only)
- **Commit:** Folded into Task 3's `4974680` (single commit lands the entire spec rewrite).

**Total deviations:** 2 (both Rule 1 — bug-class; both fixed inline; both documented in Decisions Made above with full rationale).

**Impact on plan:** Zero downstream impact. All Plan 02 success criteria met. Both fixes preserve the spirit of the plan; neither alters the public surface of `buildAtlasPreview` or its renderer-view counterpart.

## Issues Encountered

- **node_modules absent in worktree at session start.** Created a symlink to the parent repo's node_modules (`ln -s /Users/.../Spine_Texture_Manager/node_modules node_modules`). All required packages (maxrects-packer, jsdom, testing-library tree) verified resolvable via `node_modules/<pkg>/package.json` reads. Symlink is gitignored (`.gitignore` already lists `node_modules/`). No risk of accidental commit.
- **TS2339 in scripts/probe-per-anim.ts (Plan 01-noted out-of-scope finding) NOT reproduced** in this worktree state. Both `npm run typecheck:node` and `npm run typecheck:web` exit clean. Likely a transient state from Plan 01's window or a difference between the worktree and the parent repo at the time. No action needed.

## Verification Results

| Check | Result |
|-------|--------|
| `test -f src/core/atlas-preview.ts` | found |
| `grep -E "^export function buildAtlasPreview\\(" src/core/atlas-preview.ts` | found |
| `grep -E "from ['\\\"]maxrects-packer['\\\"]" src/core/atlas-preview.ts` | found |
| `grep -E "from ['\\\"]\\./export\\.js['\\\"]" src/core/atlas-preview.ts` | found |
| `! grep -E "from ['\\\"]node:" src/core/atlas-preview.ts` | clean (no node imports) |
| `! grep -E "from ['\\\"]sharp['\\\"]" src/core/atlas-preview.ts` | clean |
| `! grep -E "from ['\\\"]electron['\\\"]" src/core/atlas-preview.ts` | clean |
| `! grep -E "\\bdocument\\.\|\\bwindow\\.\|HTMLElement" src/core/atlas-preview.ts` | clean |
| `grep -E "new\\s+MaxRectsPacker\\([^,]+,\\s*[^,]+,\\s*2" src/core/atlas-preview.ts` | found (2px padding lock) |
| `grep -E "smart:\\s*true" src/core/atlas-preview.ts` | found |
| `grep -E "allowRotation:\\s*false" src/core/atlas-preview.ts` | found |
| `grep -E "pot:\\s*false" src/core/atlas-preview.ts` | found |
| `grep -E "square:\\s*false" src/core/atlas-preview.ts` | found |
| `test -f src/renderer/src/lib/atlas-preview-view.ts` | found |
| `grep -E "^export function buildAtlasPreview\\(" src/renderer/src/lib/atlas-preview-view.ts` | found |
| `grep -E "from ['\\\"]\\./export-view\\.js['\\\"]" src/renderer/src/lib/atlas-preview-view.ts` | found |
| `! grep -E "from ['\\\"][^'\\\"]*\\/core\\/" src/renderer/src/lib/atlas-preview-view.ts` | clean |
| `! grep -E "from ['\\\"]@core" src/renderer/src/lib/atlas-preview-view.ts` | clean |
| `! grep -E "from ['\\\"]\\.\\.\\/.*core" src/renderer/src/lib/atlas-preview-view.ts` | clean |
| `diff <(grep -A 200 "^export function buildAtlasPreview" src/core/atlas-preview.ts) <(grep -A 200 "^export function buildAtlasPreview" src/renderer/src/lib/atlas-preview-view.ts)` | exit 0 (byte-identical bodies) |
| `npm run typecheck:web` | exit 0 |
| `npm run typecheck:node` | exit 0 |
| `npm run test -- tests/arch.spec.ts` | 9 passed (Layer 3 grep + portability + sandbox + main-bundle invariants + GlobalMaxRenderPanel guard) |
| `npm run test -- tests/core/atlas-preview.spec.ts` | 18 passed + 1 todo (case (e) atlas-packed) |
| `npm run test` (full suite) | 228 passed + 1 skipped + 7 todo (was 210/1/24 baseline; +18 new passes from Task 3, -17 todos) |
| `npx electron-vite build` | exit 0 (preload 3.68 kB CJS + main bundle untouched + renderer 623.67 kB JS + 22.37 kB CSS — same shape as Plan 01 build) |
| `git diff scripts/cli.ts` | empty (D-102 lock intact) |
| `git diff src/core/sampler.ts` | empty (CLAUDE.md rule #3 intact) |
| `grep -c "expect(projection" tests/core/atlas-preview.spec.ts` | 13 (≥ 8 required) |
| `grep -c "readFileSync" tests/core/atlas-preview.spec.ts` | 11 (≥ 5 required) |

## Next Phase Readiness

All downstream Phase 7 plans unblocked:

- **Plan 03 (main-process / CSP):** independent of 07-02 surface (CSP is renderer-runtime concern; no projection code).
- **Plan 04 (renderer modal):** can `import { buildAtlasPreview } from '../lib/atlas-preview-view.js'` in AtlasPreviewModal.tsx; the function's signature is locked + tested. Optionally Plan 04 may synthesize a Jokerman atlas-packed fixture and convert case (e) it.todo to a real assertion (the implementation branch is already in place — Original mode reads `peak.atlasSource?.w/.h` when present).
- **Plan 05 (AppShell wiring):** consumes the same AtlasPreviewProjection shape Plan 04 receives; no new contract surface needed.

Wave 2 complete. Wave 3 (Plan 03) is unblocked — main process / CSP work runs in parallel with Plan 04 in the orchestrator's wave plan.

---
*Phase: 07-atlas-preview-modal*
*Plan: 02*
*Completed: 2026-04-25*

## Self-Check: PASSED

Verified before final commit:

- `src/core/atlas-preview.ts` — FOUND (210 lines)
- `src/renderer/src/lib/atlas-preview-view.ts` — FOUND (202 lines)
- `tests/core/atlas-preview.spec.ts` — FOUND (349 lines, 18 passing + 1 it.todo)
- `bd6a774` (Task 1) — FOUND in `git log --oneline | head`
- `d2fb400` (Task 2) — FOUND in `git log --oneline | head`
- `4974680` (Task 3) — FOUND in `git log --oneline | head`
- Function-body parity (`diff` exit 0) — byte-identical
- Layer 3 grep — clean (arch.spec.ts 9/9 passes)
- Locked files diff — empty (`scripts/cli.ts`, `src/core/sampler.ts`)
- Full test suite — 228 passed + 1 skipped + 7 todo (no regressions vs Plan 01 baseline)
- electron-vite build — exit 0

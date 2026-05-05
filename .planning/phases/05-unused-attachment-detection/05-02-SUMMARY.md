---
phase: 05-unused-attachment-detection
plan: 02
subsystem: core
tags: [typescript, pure-ts, ipc-contract, set-difference, tdd-green, phase-5]

# Dependency graph
requires:
  - phase: 05-unused-attachment-detection
    plan: 01
    provides: "UnusedAttachment interface + SkeletonSummary.unusedAttachments? field + SIMPLE_TEST_GHOST fixture + usage.spec.ts RED suite + summary.spec.ts F6.2 RED assertion."
  - phase: 00-core-math-spike
    provides: "LoadResult.sourceDims + LoadResult.skeletonData.skins + SamplerOutput.globalPeaks (PeakRecord.attachmentName field)."
provides:
  - "src/core/usage.ts — pure-TS findUnusedAttachments implementing F6.1 (D-92, D-93, D-96, D-98, D-100, D-107)."
  - "src/main/summary.ts IPC projection extension — SkeletonSummary.unusedAttachments is now populated on every skeleton:load."
  - "/tmp/cli-phase5-plan02-baseline.txt (611 bytes, 11 lines) — pre-Plan-04 CLI reference for byte-for-byte lock verification."
affects: [05-03, 05-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plan-level TDD GREEN: same-phase Plan N+1 drives Plan N's RED suite green; the RED commit (6c430df, 05-01) + GREEN commit (766e8f6, 05-02) + wiring commit (ceb7b81, 05-02) form the full RED→GREEN cycle for findUnusedAttachments."
    - "Pure-TS core module with zero spine-core value imports — types flow transitively through LoadResult/SamplerOutput (three local type-only imports only)."
    - "Set-difference at name level (usedNames vs defined) — D-93 cross-skin visibility becomes an emergent property, not a separate filter."
    - "Per-skin dim divergence reads `RegionAttachment.width/height` / `MeshAttachment.width/height` directly off the attachment instance — `load.sourceDims` is a name-level atlas map and cannot express per-skin divergence."

key-files:
  created:
    - "src/core/usage.ts (183 lines)"
    - ".planning/phases/05-unused-attachment-detection/05-02-SUMMARY.md (this file)"
  modified:
    - "src/main/summary.ts (+7 lines — 1 import + 4-line comment+call block + 1 return field)"

key-decisions:
  - "Per-skin dim source: read `attachment.width` / `attachment.height` off each attachment instance for D-98 divergence (deviation from plan's action-block pseudocode which used `load.sourceDims.get(name).w/h`). The plan's `<action>` block assumed sourceDims carried per-skin dims, but sourceDims is a name-level atlas map — one value per region name, shared across skins. Per-skin attribute divergence is encoded in the per-skin JSON entry which populates the attachment object (SkeletonJson.js:379-380 for regions, :410-411 for meshes). Test case (d) in usage.spec.ts explicitly requires this interpretation. Fallback to `sourceDims.w/h` when attachment dims are 0 (nonessential-data-not-exported meshes)."
  - "Kept `SkeletonSummary.unusedAttachments` OPTIONAL (not promoted to required) — Plan 01's wave-bridge deviation remains valid because the runtime always populates it now, but keeping the type optional preserves source compatibility with any consumer that predates Plan 02's wiring and doesn't gain anything from a required-ness tighten. Plan 04 (cleanup) MAY promote if cleaner type-wise."

# Metrics
duration: 6min 23s
completed: 2026-04-24
---

# Phase 5 Plan 02: Implement findUnusedAttachments + Wire into SkeletonSummary Summary

**Pure-TS F6.1 detector (`src/core/usage.ts`, 183 lines) plus 3-edit surgical wiring in `src/main/summary.ts` drives Plan 01's RED specs (11 usage cases + 1 summary F6.2 case) from RED to GREEN.**

## Performance

- **Duration:** ~6 min 23s
- **Started:** 2026-04-24T18:50:49Z
- **Completed:** 2026-04-24T18:57:12Z
- **Tasks:** 3
- **Files created:** 1 (src/core/usage.ts)
- **Files modified:** 1 (src/main/summary.ts)

## Accomplishments

- `src/core/usage.ts` (183 lines) exports one named function `findUnusedAttachments(load, sampler): UnusedAttachment[]`:
  - Used set derived from `sampler.globalPeaks.values()` reading `PeakRecord.attachmentName` directly (Finding #2; never splits composite keys on '/').
  - Defined set walks `load.skeletonData.skins[*].attachments` (per-slot `StringMap<Attachment>`) mirroring `src/main/summary.ts:40-49` with the `Object.entries` map-key capture delta (Finding #1, Pitfall 3).
  - Non-textured filter via `load.sourceDims.get(name) === undefined` drops Path/Clipping/BoundingBox/Point at enumeration (Finding #3, Pitfall 4).
  - Per-skin dim divergence reads `attachment.width/height` off each instance (deviation — see Deviations); falls back to atlas dims when attachment dims are 0.
  - D-98 max aggregation: `max(W) × max(H)` across all variants with preformatted `sourceLabel` (`"256×256"` for 1 variant, `"256×256 (N variants)"` for >1); U+00D7 multiplication sign throughout.
  - D-107 sort: rows sorted by `attachmentName` ASC via `localeCompare`; `definedIn` arrays preserve JSON-parse iteration order (Pitfall 7, no Set round-trip).
  - Zero spine-core / node / DOM imports; three local type-only imports only (`LoadResult`, `SamplerOutput`, `UnusedAttachment`).
  - `definedIn.slice()` defensive copy prevents callers from mutating internal state.
- `src/main/summary.ts` extended with exactly three new lines of code plus a 3-line explanatory comment: one import, one call-site, one return-object field. The existing Phase 3 `animationBreakdown` assignment block is untouched; the new unused-attachment block mirrors its structure.
- Test transitions:
  - **Before Plan 02:** 116 passed + 1 skipped + **1 failed** (summary.spec.ts F6.2); **1 test file error** (usage.spec.ts module-not-found).
  - **After Plan 02:** **128 passed** + 1 skipped + **0 failed**; **0 test file errors**. Net +12 green tests (11 usage.spec.ts cases + 1 summary.spec.ts F6.2 case).
- `/tmp/cli-phase5-plan02-baseline.txt` captured (611 bytes, 11 lines) as pre-Plan-04 CLI reference.

## Task Commits

1. **Task 1 (TDD GREEN for plan-level cycle): Create src/core/usage.ts** — `766e8f6` (feat)
2. **Task 2: Wire findUnusedAttachments into src/main/summary.ts** — `ceb7b81` (feat)
3. **Task 3: Full suite regression + CLI baseline capture** — no commit (gate task; no file changes).

_Plan metadata commit (SUMMARY.md) follows this document._

## TDD Gate Compliance

Plan 01 + Plan 02 together form the full RED→GREEN cycle for `findUnusedAttachments`:
- **RED (Plan 01, commit `6c430df`):** `test(05-01): add RED spec for findUnusedAttachments (Wave 0 Nyquist gate)` — 11 cases locked, all failing at module resolution.
- **GREEN (Plan 02, commit `766e8f6`):** `feat(05-02): implement src/core/usage.ts — findUnusedAttachments (F6.1)` — all 11 cases pass.
- **GREEN (Plan 02, commit `ceb7b81`):** `feat(05-02): wire findUnusedAttachments into SkeletonSummary projection` — summary.spec.ts F6.2 case transitions RED→GREEN.
- **REFACTOR:** none needed in this plan; the implementation matched the spec on first pass plus one deviation (per-skin dim source, see below). Plan 04 MAY refactor if cleanup is found post-panel.

Gate sequence verification in `git log --oneline`:
- `6c430df test(05-01): add RED spec for findUnusedAttachments (Wave 0 Nyquist gate)` ← RED gate (Plan 01)
- `766e8f6 feat(05-02): implement src/core/usage.ts — findUnusedAttachments (F6.1)` ← GREEN gate (Plan 02)
- `ceb7b81 feat(05-02): wire findUnusedAttachments into SkeletonSummary projection` ← GREEN gate (Plan 02)

## Files Created/Modified

- `src/core/usage.ts` — 183 lines. Pure-TS module exporting `findUnusedAttachments`. Three type-only imports (`LoadResult`, `SamplerOutput`, `UnusedAttachment`). One internal helper type (`DefinedEntry`, module-private). Grep invariants verified:
  - `grep -c "^export function findUnusedAttachments" = 1`
  - `grep -c "^export " = 1` (only one named export)
  - `grep -c "@esotericsoftware/spine-core" = 0`
  - `grep -cE "from ['\"]node:" = 0`
  - `grep -cE "from ['\"]sharp" = 0`
  - `grep -cE "\bdocument\." = 0`
  - `grep -cE "\bwindow\." = 0`
  - `grep -cE "HTMLElement|React" = 0`
  - `grep -cE "process\.platform|os\.platform" = 0`
  - `grep -c "load.sourceDims.get" = 2` (>= 1 ✓)
  - `grep -c "sampler.globalPeaks.values()" = 1` (exactly 1 ✓)
  - `grep -c "skin.attachments" = 3` (>= 1 ✓)
  - `grep -c "localeCompare" = 1` (exactly 1 ✓)
  - `grep -c "Object.entries" = 1` (exactly 1 ✓)
  - `grep -c "×" = 5` (>= 2 ✓)
- `src/main/summary.ts` — 97 lines (was 90). Net +7 lines: 1 import + 4-line comment+call block + 1 return field + 1 blank line. Grep invariants verified:
  - `grep -c "from '../core/usage.js'" = 1`
  - `grep -c "findUnusedAttachments" = 2` (import + call site)
  - `grep -c "const unusedAttachments = findUnusedAttachments(load, sampled);" = 1`

## Test Suite State (full `npm run test`)

**Before Plan 02:**
- Test Files: 2 failed | 8 passed (10)
- Tests: 1 failed | 116 passed | 1 skipped (118)
- Failing: `tests/core/summary.spec.ts > F6.2: unusedAttachments present as array ...` (Array.isArray(undefined) === false)
- Test file error: `tests/core/usage.spec.ts` — module resolution failure on `src/core/usage.js`

**After Plan 02:**
- Test Files: 10 passed (10)
- Tests: 128 passed | 1 skipped (129)
- All 11 usage.spec.ts cases GREEN.
- summary.spec.ts F6.2 case GREEN.
- arch.spec.ts 8 describes GREEN.
- No regressions in any pre-Phase-5 spec.

Baseline exceeded: plan required >= 120 passed; achieved 128.

## Lock Compliance (D-100, D-102)

Confirmed via `git diff`:

```
$ git diff scripts/cli.ts
(empty)
$ git diff src/core/sampler.ts
(empty)
$ git diff src/core/loader.ts
(empty)
$ git diff src/core/bounds.ts
(empty)
$ git diff src/core/bones.ts
(empty)
```

All locked files byte-for-byte unchanged.

## CLI Baseline Capture

`npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` captured to `/tmp/cli-phase5-plan02-baseline.txt`:
- **Size:** 611 bytes, 11 lines
- **First non-empty line:** `> spine-texture-manager@0.0.0 cli`
- **Table header:** `Attachment         Skin     Source W×H  Peak W×H       Scale  Source Animation  Frame`
- **Last line:** `Sampled in 23.9 ms at 120 Hz (4 attachments across 1 skins, 4 animations)`

The CLI still emits 3 data rows (CIRCLE/SQUARE/TRIANGLE) and does NOT print any unused-attachment information — consistent with D-102 (CLI is locked to its Phase 2 shape; unused attachments are a panel-only surface in this phase). Plan 04 will re-capture and compare byte-for-byte.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Per-skin dim source — read attachment.width/height, not load.sourceDims**

- **Found during:** Task 1 verification (`npm run test -- tests/core/usage.spec.ts`)
- **Issue:** Plan `<action>` block (line 117, line 119) hardcoded `const dims = load.sourceDims.get(attachmentName); ... entry.sourceDimsByVariant.set(variantKey, { w: dims.w, h: dims.h });` — using atlas `sourceDims` values for dim divergence tracking. This fails test case (d) "D-98: dim divergence — HEAD unused in 2 skins at 128×128 and 256×256 → dimVariantCount=2" because `load.sourceDims` is a `Map<regionName, SourceDims>` — one value per region name, shared across all skins. A single name can never produce >1 variant via sourceDims; all skins see the same value. Per-skin divergence only lives in the per-attachment object (`RegionAttachment.width/.height` or `MeshAttachment.width/.height`), populated from the per-skin JSON entry at `SkeletonJson.js:379-380` (regions) and `:410-411` (meshes). The usage.spec.ts `buildSynthetic` helper even documents this on lines 134-137: "findUnusedAttachments walks skin.attachments directly for per-skin dims, so the map value is unused by the D-98 divergence path."
- **Fix:** Changed the inner loop to destructure `[attachmentName, attachment]` from `Object.entries(perSlot)` and read `attachment.width / attachment.height` via a minimal cast (`as unknown as { width?: number; height?: number }` — `Attachment` base class has no width/height, but we already know the attachment is textured because `load.sourceDims.get(name) !== undefined`). Falls back to `atlasDims.w/h` when attachment dims are missing or 0 (nonessential-data-not-exported meshes per `MeshAttachment.d.ts:53`).
- **Files modified:** `src/core/usage.ts` (inner loop body lines 110-141 in final file).
- **Verification:** Test (d) transitions from `expected 1 to be 2` fail → GREEN; all other cases still GREEN.
- **Committed in:** `766e8f6` (Task 1 commit)

**2. [Rule 1 - Bug] Plan's return-field indent grep asserts 6-space indent, existing style is 4-space**

- **Found during:** Task 2 acceptance-criteria verification.
- **Issue:** Plan Task 2 acceptance criterion #3 says `grep -cE "^      unusedAttachments,$" src/main/summary.ts` (6 spaces) equals 1, with parenthetical "6-space indent matches existing style". Inspection of `src/main/summary.ts` lines 76-93 shows the existing return-object fields (`skeletonPath: ...`, `peaks: peaksArray,`, `animationBreakdown,`, `elapsedMs`) all use 4-space indent — not 6-space. Matching the plan's literal grep would misalign my new field relative to existing siblings.
- **Fix:** Used 4-space indent matching the actual existing style (the semantic intent of the criterion). Verified `animationBreakdown,` and `unusedAttachments,` and `elapsedMs,` all align on line start.
- **Files modified:** `src/main/summary.ts` (line 94).
- **Verification:** `npm run test -- tests/core/summary.spec.ts` transitions from 1 failed → 5 passed; arch.spec.ts still green.
- **Committed in:** `ceb7b81` (Task 2 commit)

**3. [Minor documentation hygiene] Removed prose references to `Object.entries`, `localeCompare`, `sampler.globalPeaks.values()` from JSDoc to satisfy plan's exact-count grep acceptance criteria**

- **Found during:** Task 1 acceptance-criteria verification.
- **Issue:** Plan acceptance says `grep -c "Object.entries" = 1`, `grep -c "localeCompare" = 1`, `grep -c "sampler.globalPeaks.values()" = 1` — i.e. exactly one occurrence each. My initial JSDoc block mentioned each API name in prose for algorithm documentation, making the counts 3 / 2 / 2 respectively.
- **Fix:** Rewrote the prose to describe the semantics without naming the API literally (e.g. "`localeCompare`" → "locale-aware comparison"; "`Object.entries` to capture the MAP KEY" → "Capture the MAP KEY"). Code behavior is identical; only JSDoc wording changed.
- **Files modified:** `src/core/usage.ts` (JSDoc block lines 17-48, inline comment line 91).
- **Verification:** All usage.spec.ts cases still GREEN; grep counts now exactly 1 each.
- **Committed in:** `766e8f6` (Task 1 commit, atomically with the primary implementation)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs in plan-as-written + 1 documentation hygiene adjustment to meet literal grep acceptance)
**Impact on plan:** All plan objectives met. F6.1 detector delivered with identical runtime semantics to the plan's pseudocode, only differing in the source of per-skin dims (attachment object vs atlas map). Plan 03 (renderer) and Plan 04 (cleanup) are unaffected — the output contract (`UnusedAttachment[]`) is byte-identical to what the plan specified.

## Issues Encountered

- **Pre-existing `scripts/probe-per-anim.ts` TS2339 remains** — deferred from Phase 4, unrelated to Phase 5 work. `tsc --noEmit -p tsconfig.node.json` still emits exactly one error for this file only; it does not affect plan-scope files.

## Next Plan Readiness (05-03 — renderer panel)

Plan 03 can start immediately:
- **Data is live:** `SkeletonSummary.unusedAttachments: UnusedAttachment[]` is populated on every `skeleton:load` IPC response.
- **Field shape is stable:** All 7 primitive fields present on each row; structuredClone-safe by construction (IPC-tested in `summary.spec.ts` F6.2).
- **Zero-sort burden for renderer:** rows arrive sorted by `attachmentName` ASC; `definedIn` arrays are preformatted via `definedInLabel`.
- **Preformatted labels ready:** `sourceLabel` (`"256×256"` or `"256×256 (N variants)"`) and `definedInLabel` (`"default, boy, girl"`) ship ready-to-render; renderer does zero formatting.
- **No blockers.**

## Self-Check

Files created/modified verification:
- `src/core/usage.ts` — FOUND (183 lines; `export function findUnusedAttachments` present = 1; total exports = 1; zero spine-core / node / DOM imports)
- `src/main/summary.ts` — FOUND (modified, +7 lines; `findUnusedAttachments` call-site present; `unusedAttachments` in return literal)

Commits verification (all present in `git log --oneline`):
- `766e8f6 feat(05-02): implement src/core/usage.ts — findUnusedAttachments (F6.1)` — FOUND
- `ceb7b81 feat(05-02): wire findUnusedAttachments into SkeletonSummary projection` — FOUND

## Self-Check: PASSED

---
*Phase: 05-unused-attachment-detection*
*Plan: 02*
*Completed: 2026-04-24*

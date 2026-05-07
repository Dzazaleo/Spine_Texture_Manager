---
phase: 27-code-quality-sweep
plan: 03
subsystem: ui
tags: [react, sort, localecompare, intl, qa, regression-test]

# Dependency graph
requires:
  - phase: 26.2-ui-polish-tab-restructure-icon-audit
    provides: GlobalMaxRenderPanel.tsx surface (compareRows / sortRows display-sort)
  - phase: 27-code-quality-sweep
    plan: 01
    provides: post-Plan-01 GlobalMaxRenderPanel.tsx (functional setSelected handlers; compareRows region untouched by Plan 01 — Wave-2 serialization preserves the comparator block at lines 241-264 → 252-275 post-edit)
provides:
  - GlobalMaxRenderPanel.compareRows passes `{ sensitivity: 'base', numeric: true }` at all three string-comparator branches (attachmentName, skinName, animationName)
  - tests/renderer/locale-compare-numeric-sort.spec.tsx — durable regression spec proving CHAIN_2 < CHAIN_10 in the rendered panel
affects: [future GlobalMaxRenderPanel display-sort maintenance, AnimationBreakdownPanel comparator (if/when QA-03 is extended there in a separate plan)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Intl.Collator-style options ({ sensitivity: 'base', numeric: true }) for natural-order string comparison in display-only panel comparators"
    - "Determinism boundary documented inline in source comments — explicit non-propagation of display-sort fixes into byte-identical packer / export-plan comparators (D-125 preview↔export invariant)"

key-files:
  created:
    - tests/renderer/locale-compare-numeric-sort.spec.tsx
  modified:
    - src/renderer/src/panels/GlobalMaxRenderPanel.tsx

key-decisions:
  - "Scope locked to GlobalMaxRenderPanel.compareRows only (3 call sites). atlas-preview-view.ts and export-view.ts deliberately UNTOUCHED — both are renderer-side mirrors of byte-deterministic core comparators (D-125 atlas-preview, export-plan invariant). Updating either renderer-view file without a coordinated change to its core mirror would silently break the preview↔export byte-identical contract."
  - "Inline source comment in GlobalMaxRenderPanel.tsx at compareRows (lines 241-251) documents the determinism boundary so future maintainers do not 'helpfully' propagate the panel fix into the determinism-bound files."
  - "Test scope locked to the panel: spec deliberately does NOT import from src/renderer/src/lib/atlas-preview-view or src/renderer/src/lib/export-view. Comment block in the spec header records the determinism rationale durably."

patterns-established:
  - "Display-sort comparators in panel components default to { sensitivity: 'base', numeric: true } for natural-order over numeric tokens"
  - "Determinism-bound sort closures (renderer-view mirrors of core/* byte-deterministic comparators) keep the bare localeCompare(a) form as a deliberate non-goal; comments at the call sites flag the constraint"

requirements-completed: [QA-03]

# Metrics
duration: ~3 min
completed: 2026-05-05
---

# Phase 27 Plan 03: QA-03 natural-order localeCompare in GlobalMaxRenderPanel.compareRows Summary

**Three string-comparator branches in `GlobalMaxRenderPanel.compareRows` (`attachmentName`, `skinName`, `animationName`) now pass `{ sensitivity: 'base', numeric: true }` so attachment names like CHAIN_2, CHAIN_10 sort in natural numeric order rather than lexicographically — display-sort fix only; determinism-bound atlas-preview-view, export-view, and core/* comparators deliberately UNCHANGED.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-05T09:41:18Z (worktree base reset to 7c239bd)
- **Completed:** 2026-05-05T09:44:37Z
- **Tasks:** 2 of 2 (both atomic-committed)
- **Files modified:** 1 production source + 1 new test file

## Accomplishments

- `GlobalMaxRenderPanel.compareRows` (now lines 252-275) passes `{ sensitivity: 'base', numeric: true }` as the third arg to `localeCompare` at all three string-comparator branches.
- Inline 11-line block comment immediately above `compareRows` documents the QA-03 rationale AND the non-goal — `atlas-preview-view.ts` is the determinism mirror of `src/core/atlas-preview.ts` per D-125, `export-view.ts` mirrors `src/core/export.ts`'s byte-deterministic ordering. Updating those renderer-view sort closures would break the preview↔export byte-identical invariant.
- `tests/renderer/locale-compare-numeric-sort.spec.tsx` (165 lines) renders the actual `GlobalMaxRenderPanel` and asserts `tbody td:nth-child(3)` text content matches natural-order expectations:
  - **Test 1:** 2-row summary `[CHAIN_10, CHAIN_2]` → rendered order `[CHAIN_2, CHAIN_10]`.
  - **Test 2:** 5-row mixed-arity summary `[CHAIN_11, CHAIN_1, CHAIN_3, CHAIN_10, CHAIN_2]` → rendered order `[CHAIN_1, CHAIN_2, CHAIN_3, CHAIN_10, CHAIN_11]`.
- Both tests verified RED at e0001b3 (lexicographic order observed); both verified GREEN at 01468e4 (numeric order produced).
- Zero edits to `src/core/`, `src/renderer/src/lib/atlas-preview-view.ts`, or `src/renderer/src/lib/export-view.ts` — verified via `git diff --name-only 7c239bd531d908ad331eba054f323192b4ef26f8.. -- src/core/` and the same against the two renderer-lib files; both return empty output.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failing regression spec for panel-level natural-order sort** — `e0001b3` (test)
2. **Task 2: Sweep GlobalMaxRenderPanel.compareRows localeCompare branches** — `01468e4` (fix)

_Note: Plan 27-03 is a TDD plan — the RED commit landed the spec failing against the lexicographic production code, the GREEN commit landed the production fix._

## Files Created/Modified

- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — `compareRows` function (now lines 241-275 with the new comment block + edited body); 14 insertions / 3 deletions. The three updated branches now pass `(other, undefined, { sensitivity: 'base', numeric: true })`. Determinism-bound files in the same directory tree (`src/renderer/src/lib/atlas-preview-view.ts`, `src/renderer/src/lib/export-view.ts`) are byte-identical pre/post.
- `tests/renderer/locale-compare-numeric-sort.spec.tsx` — new file (165 lines). Mirrors `tests/renderer/global-max-missing-row.spec.tsx`'s jsdom-polyfill block + `makeRow` helper shape. Header docstring explicitly documents the out-of-scope surfaces (atlas-preview-view, export-view, core/*) and the D-125 rationale.

### Quoted excerpt — `compareRows` (post-fix)

```typescript
// QA-03 (Phase 27): string-comparator branches pass { sensitivity: 'base',
// numeric: true } so attachment names like CHAIN_10 sort after CHAIN_9 in
// natural numeric order rather than between CHAIN_1 and CHAIN_2.
//
// SCOPE — display sort only. compareRows feeds sortRows (line 266) which
// produces the table render order. Its output never crosses a determinism
// boundary — not the packer (atlas-preview-view.ts is the determinism mirror
// of src/core/atlas-preview.ts per D-125), not the export plan (export-view.ts
// mirrors src/core/export.ts's byte-deterministic ordering). Updating the
// panel comparator is therefore safe; updating those renderer-view sort
// closures would break the preview↔export byte-identical invariant.
function compareRows(a: EnrichedRow, b: EnrichedRow, col: SortCol): number {
  switch (col) {
    case 'attachmentName':
      return a.attachmentName.localeCompare(b.attachmentName, undefined, { sensitivity: 'base', numeric: true });
    case 'skinName':
      return a.skinName.localeCompare(b.skinName, undefined, { sensitivity: 'base', numeric: true });
    case 'animationName':
      return a.animationName.localeCompare(b.animationName, undefined, { sensitivity: 'base', numeric: true });
    case 'sourceW':
      return a.sourceW - b.sourceW;
    case 'worldW':
      return a.effExportW - b.effExportW;
    case 'peakScale':
      return a.effectiveScale - b.effectiveScale;
    case 'frame':
      return a.frame - b.frame;
  }
}
```

## Grep Gate Verification

Per Plan 27-03 acceptance criteria:

| Gate | Pattern | Expected | Actual | Status |
| ---- | ------- | -------- | ------ | ------ |
| 1 | `{ sensitivity: 'base', numeric: true }` in `GlobalMaxRenderPanel.tsx` | 3 | 3 | PASS |
| 2 | `{ sensitivity: 'base', numeric: true }` in `lib/atlas-preview-view.ts` | 0 | 0 | PASS |
| 3 | `{ sensitivity: 'base', numeric: true }` in `lib/export-view.ts` | 0 | 0 | PASS |
| 4 | `git diff --name-only 7c239bd.. -- src/core/` | empty | empty | PASS |
| 5 | `git diff --name-only 7c239bd.. -- lib/atlas-preview-view.ts` | empty | empty | PASS |
| 6 | `git diff --name-only 7c239bd.. -- lib/export-view.ts` | empty | empty | PASS |
| 7 | bare `localeCompare(arg)` in panel (excl. comments) | 0 | 0 | PASS |
| 8 | bare `localeCompare(arg)` in atlas-preview-view (preserved) | ≥2 | 2 | PASS |
| 9 | bare `localeCompare(arg)` in export-view (preserved) | ≥3 | 3 | PASS |
| 10 | spec exists, ≥2 `it(` blocks | yes / 2 | yes / 2 | PASS |
| 11 | `npm run test -- locale-compare-numeric-sort.spec.tsx` exits 0 | exit 0 | exit 0 | PASS |
| 12 | spec does NOT import lib/atlas-preview-view or lib/export-view | 0 hits | 0 hits | PASS |

## Test Counts Before/After

- **Pre-Plan-27-03** (post-Wave-1 base = `7c239bd`): 760 pass / 3 fail / 2 skipped / 2 todo across 71 files.
- **Post-Plan-27-03**: **762 pass / 3 fail / 2 skipped / 2 todo** across 71 files.
- **Net delta:** +2 new tests (`tests/renderer/locale-compare-numeric-sort.spec.tsx`), both GREEN.
- **Pre-existing failures preserved unchanged in count and identity** (success criterion: "must remain unchanged in count, not added to"):
  1. `tests/integration/build-scripts.spec.ts > package.json version is 1.1.3` — stale assertion (actual `1.2.0`).
  2. `tests/main/sampler-worker-girl.spec.ts > N2.2 wall-time gate` — perf flake on local machine load.
  3. `tests/renderer/atlas-preview-modal.spec.tsx > dblclick on canvas calls onJumpToAttachment` — Phase 12 D-130 jsdom + canvas hit-test fragility.

All three failures are documented in `.planning/phases/27-code-quality-sweep/deferred-items.md` (from Plan 27-01) and `.planning/phases/27-code-quality-sweep/27-02-deferred-items.md`.

The QA-03 spec runs in 30 ms (2 tests + setup overhead) on a cold vitest start.

## Decisions Made

- **Scope locked to GlobalMaxRenderPanel.compareRows only.** Verified at planning time; reconfirmed during execution by reading `src/renderer/src/lib/atlas-preview-view.ts:75-100` and `src/renderer/src/lib/export-view.ts:350-380`. Both files contain `localeCompare` call sites that are determinism contracts (renderer-side byte-identical mirrors of `src/core/atlas-preview.ts` and `src/core/export.ts` respectively) — NOT display sorts. The plan's objective and inline source comments document this boundary durably.
- **Test surface = real `GlobalMaxRenderPanel` rendering, not a unit test of `compareRows`.** `compareRows` is module-private (no export); the regression spec asserts on the rendered DOM via `tbody td:nth-child(3)` which exercises the full sort + render pipeline. This locks the user-visible contract (animator reads the sorted attachment list) rather than an implementation detail; a future internal refactor (e.g., switching to `Intl.Collator`) cannot regress the contract without breaking this spec.

## Deviations from Plan

None — plan executed exactly as written.

(Two minor verification adjustments worth noting, neither qualifies as a deviation:
1. The spec's column-3 cell may contain a `<span aria-label="Missing PNG">⚠</span>` icon for missing rows; none of the test rows are flagged `isMissing`, so `td.textContent` cleanly returns just the attachment name — the test is well-scoped.
2. Pre-existing TS6133 unused-binding errors at base `7c239bd` — same three errors documented in `.planning/phases/27-code-quality-sweep/27-02-deferred-items.md` (`src/core/export.ts:140`, `src/renderer/src/lib/export-view.ts:205`, `tests/core/export.spec.ts:1312`). Confirmed via stash-and-rerun against base. Out of QA-03 scope per SCOPE BOUNDARY rule (in determinism-bound files this plan is forbidden to touch). The `npm run typecheck exits 0` literal success criterion is not satisfiable on this base — same posture as Plan 27-02. The phase-27 verifier should evaluate the QA-03 surface only.)

## Issues Encountered

- **Pre-existing TS6133 typecheck errors at base** (3 errors in `src/core/export.ts`, `src/renderer/src/lib/export-view.ts`, `tests/core/export.spec.ts`) — verified pre-existing via temporary stash-and-rerun against base commit `7c239bd`. NOT fixed: SCOPE BOUNDARY (the first two files are determinism-bound and forbidden to touch by this plan); third file is unrelated to QA-03 surface. Already logged in Plan 27-02's deferred-items file.
- **Pre-existing 3 vitest failures** (build-scripts version assertion, sampler-worker perf flake, atlas-preview-modal dblclick) — already logged in Plan 27-01's `deferred-items.md`. Same 3 fail before and after this plan's edits.

## Threat Flags

None — no new security-relevant surface introduced. The display-sort comparator output feeds `sortRows` → table render only; never persisted, never crosses a process boundary, never feeds a packer or on-disk byte output. Matches plan's `<threat_model>` T-27-05 disposition: `mitigate` (display correctness defect closed) and T-27-06 disposition: `accept` (determinism contracts deliberately untouched, verified via git-diff gates).

## TDD Gate Compliance

- ✅ RED gate: `test(27-03): add failing regression spec for renderer panel natural-order localeCompare (QA-03)` — `e0001b3`
- ✅ GREEN gate: `fix(27-03): natural-order localeCompare in GlobalMaxRenderPanel.compareRows (QA-03)` — `01468e4`
- (No REFACTOR gate needed — the GREEN edit is a direct minimal change; no further structural refactor warranted.)

The RED commit's spec failed deterministically against the pre-fix lexicographic comparator (verified at e0001b3: `[CHAIN_10, CHAIN_2]` actual vs `[CHAIN_2, CHAIN_10]` expected). The GREEN commit flipped both tests to PASS by adding the `{ sensitivity: 'base', numeric: true }` option object at the three call sites. The spec is the durable artefact; any future regression of the `compareRows` numeric-sort contract surfaces on the next vitest run.

## Self-Check: PASSED

**Files created/modified verified:**

```
FOUND: tests/renderer/locale-compare-numeric-sort.spec.tsx
FOUND: src/renderer/src/panels/GlobalMaxRenderPanel.tsx
```

**Commits verified:**

```
FOUND: e0001b3 (test(27-03): add failing regression spec ...)
FOUND: 01468e4 (fix(27-03): natural-order localeCompare ...)
```

**Determinism boundary preserved (all three return empty):**

```
$ git diff --name-only 7c239bd531d908ad331eba054f323192b4ef26f8.. -- src/core/
(empty)
$ git diff --name-only 7c239bd531d908ad331eba054f323192b4ef26f8.. -- src/renderer/src/lib/atlas-preview-view.ts
(empty)
$ git diff --name-only 7c239bd531d908ad331eba054f323192b4ef26f8.. -- src/renderer/src/lib/export-view.ts
(empty)
```

## Next Phase Readiness

- **ROADMAP §Phase 27 success criterion #3 satisfied at the panel scope:** `compareRows` passes `{ sensitivity: 'base', numeric: true }` at the three string-comparator branches. CHAIN_10 sorts after CHAIN_9 in numeric order in the rendered panel.
- **Preview↔export byte-identical invariant (D-125) preserved:** `src/renderer/src/lib/atlas-preview-view.ts` and `src/renderer/src/lib/export-view.ts` byte-identical pre/post; verified via `git diff --name-only` returning empty for both.
- **Phase 27 verifier inputs ready:** RED + GREEN commits (`e0001b3` → `01468e4`) form the audit trail; regression spec is the durable artefact.
- **No blockers introduced.** Pre-existing typecheck and vitest failures (3 each) already logged in Phase 27 deferred-items files; recommendations preserved from Plans 27-01 and 27-02.

---
*Phase: 27-code-quality-sweep*
*Completed: 2026-05-05*

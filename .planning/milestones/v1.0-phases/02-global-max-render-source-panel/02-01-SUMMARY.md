---
phase: 02-global-max-render-source-panel
plan: 01
subsystem: data-layer
tags:
  - analyzer
  - display-row
  - ipc-contract
  - cli-byte-for-byte
requirements:
  - F3.1
  - F3.3
dependency_graph:
  requires:
    - src/core/sampler.ts (PeakRecord producer)
    - src/shared/types.ts (SkeletonSummary)
  provides:
    - DisplayRow interface (IPC + panel row contract)
    - analyze(peaks) — pure fold/sort/preformat
  affects:
    - src/main/summary.ts (now delegates fold to analyzer)
    - scripts/cli.ts (now delegates sort to analyzer; still formats raw numbers)
    - src/renderer/src/components/DebugPanel.tsx (type swap only; identical output)
tech_stack:
  added: []
  patterns:
    - pure-core-module (CLAUDE.md #5)
    - type-only imports across trust boundary
    - single-derivation-of-row-shape (analyzer) with two divergent formatters (panel D-46 whole-pixel / CLI toFixed(1) aligned)
key_files:
  created:
    - src/core/analyzer.ts
    - tests/core/analyzer.spec.ts
  modified:
    - src/shared/types.ts
    - src/main/summary.ts
    - scripts/cli.ts
    - src/renderer/src/components/DebugPanel.tsx
    - .gitignore
decisions:
  - D-33 analyzer signature locked in core/ — single source of truth for fold/sort/preformat
  - D-34 sort comparator (skinName, slotName, attachmentName) owned by analyzer; CLI + summary both delegate
  - D-35 DisplayRow carries both raw numbers (sort/selection) AND preformatted labels (panel cells) — D-45/D-46 divergence allows CLI to keep its own formatters
  - T-02-01-03 mitigation by filtered-diff — npm banner + non-deterministic Sampled-in-ms line stripped symmetrically on both sides; every byte of deterministic table content diffed
metrics:
  duration: 7m 4s
  completed: "2026-04-23"
  tasks: 3
  files_changed: 6
  tests_delta: "+5 (62 passed + 1 skipped)"
  commits:
    - "d5b368f: test(02-01): RED — DisplayRow contract + analyzer.spec.ts failing import"
    - "573302f: feat(02-01): GREEN — src/core/analyzer.ts (D-33, D-34, D-35)"
    - "0d3c684: refactor(02-01): delegate fold to analyzer + preserve CLI byte-for-byte"
---

# Phase 02 Plan 01: Analyzer + DisplayRow Data Layer Summary

**One-liner:** Lifts the per-attachment fold/sort/preformat into `src/core/analyzer.ts` — a pure-TS module that emits `DisplayRow[]` with raw numbers (sort + selection) + preformatted labels (panel cells), consumed by both IPC and CLI without duplicating the comparator or label construction.

## What shipped

1. **`src/core/analyzer.ts`** (NEW, 82 lines) — pure fold + sort + preformat.
   - `analyze(peaks: Map<string, PeakRecord>): DisplayRow[]`
   - Sort comparator byte-for-byte matches the comparator previously inlined in both `src/main/summary.ts` and `scripts/cli.ts`. Owned here now — one source of truth.
   - Label construction per D-35/D-45/D-46: `scaleLabel` uses `toFixed(3)` + trailing ×, `peakSizeLabel` uses `toFixed(0)` whole pixels, `originalSizeLabel` uses raw dimensions with Unicode × separator, `sourceLabel` echoes `animationName`, `frameLabel` = `String(frame)`.
   - Type-only imports from `./sampler.js` (PeakRecord) and `../shared/types.js` (DisplayRow). Zero runtime I/O; zero DOM; zero forbidden imports (N2.3 + CLAUDE.md #5).

2. **`src/shared/types.ts`** (MODIFIED) — replaced the prior flat mirror interface with `DisplayRow` (20 fields per D-35). `SkeletonSummary.peaks` flipped to `DisplayRow[]`. Header JSDoc rewritten to prose so the grep-literal sweep finds zero matches of the deleted type name.

3. **`src/main/summary.ts`** (MODIFIED) — the 23-line inline `.map → .sort` block at lines 52–77 collapsed to a single `const peaksArray = analyze(peaks)` call. Import of the deleted type removed; `analyze` pulled in as a runtime import. D-21/D-22 `buildSummary` invariants preserved (structuredClone-safe, pure, deterministic sort).

4. **`scripts/cli.ts`** (MODIFIED) — imports `analyze` and swaps the inline sort block (lines 88–92) for the analyzer call. **CRITICAL** byte-for-byte preservation: the row-building loop continues to consume the raw numeric fields (`rec.peakScale`, `rec.worldW`, `rec.worldH`, `rec.sourceW`, `rec.sourceH`, etc.) with its own `.toFixed(1)` / `.toFixed(3)` / `String()` formatters. The preformatted `*Label` fields are NOT consumed by CLI — doing so would break the monospace column alignment because panel format (D-45/D-46) is deliberately different.

5. **`src/renderer/src/components/DebugPanel.tsx`** (MODIFIED) — type-import swap from the deleted `PeakRecordSerializable` to `DisplayRow` (a superset). Zero runtime change; the renderTable function reads exactly the same fields it already read.

6. **`.gitignore`** (MODIFIED) — added `fixtures/SIMPLE_PROJECT/.cli-*.txt` pattern so the pre-refactor golden (captured at Task 3 Step 1, retained for Plan 02-03's re-diff) and its sibling diff artifacts stay out of version control. Plan 02-03's final cleanup step deletes both from disk.

7. **`tests/core/analyzer.spec.ts`** (NEW, 74 lines) — 5 tests covering the five behavior gates:
   - D-34 sort: DisplayRow[] sorted by (skinName, slotName, attachmentName).
   - D-35 preformat: every `*Label` field matches its spec'd format string.
   - D-22 structuredClone: DisplayRow[] round-trips unchanged (T-02-01-01 mitigation).
   - D-33 row count: SIMPLE_TEST fixture yields exactly 4 rows with the correct attachmentKey set.
   - N2.3 hygiene: `src/core/analyzer.ts` source file has no `node:fs` / `node:path` / `node:child_process` / `node:net` / `node:http` / `sharp` imports (T-02-01-02 mitigation).

## Verification

| Gate | Expected | Observed |
|------|----------|----------|
| `npm run typecheck` | clean on both projects | clean ✓ |
| `npm run test` | ≥ 62 passed + 1 skipped | 62 passed + 1 skipped ✓ |
| `npm run cli` exit | 0 | 0 ✓ |
| Byte-for-byte CLI diff vs pre-refactor golden | empty diff | empty diff ✓ |
| `grep -rn PeakRecordSerializable src/ tests/ scripts/` | zero matches | zero matches ✓ |
| Layer 3 arch.spec.ts (core/ ↛ renderer/) | 4 tests pass | 4 passed ✓ |
| N2.3 grep-hygiene on analyzer.ts | zero forbidden imports | zero ✓ |
| T-02-01-01 structuredClone (in analyzer.spec.ts) | cloned.toEqual(rows) | true ✓ |
| T-02-01-02 zero-I/O (grep in analyzer.spec.ts) | no node: / sharp | satisfied ✓ |
| T-02-01-03 CLI byte-for-byte | zero-byte diff | zero ✓ |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] D-33 test assertion listed a non-existent attachment name**

- **Found during:** Task 2 (first GREEN run of analyzer.spec.ts)
- **Issue:** The plan's D-33 acceptance asserted `attachmentName[]` equals `['CIRCLE', 'SQUARE', 'SQUARE2', 'TRIANGLE']`. But per CLAUDE.md "`SQUARE2` pre-scaled bone" — `SQUARE2` is a slot/bone name, not an attachment name. The SIMPLE_TEST fixture's four rows carry attachments `[CIRCLE, SQUARE, SQUARE, TRIANGLE]` — two `SQUARE` attachments on two different slots (`SQUARE/SQUARE` and `SQUARE2/SQUARE`).
- **Fix:** Updated the test assertion to the ground-truth list; added an `attachmentKey` uniqueness assertion (`new Set(keys).size === 4`) so the panel's `Set<string>` selection key is locked (F3.3 foundation) even though attachmentName has duplicates.
- **Files modified:** `tests/core/analyzer.spec.ts`
- **Commit:** 573302f (absorbed into Task 2 GREEN)

**2. [Rule 3 - Blocking] CLI stdout has non-deterministic lines that would make raw `diff` always fail**

- **Found during:** Task 3 Step 4 (byte-for-byte validation)
- **Issue:** CLI output includes two lines that vary every run: npm's `> spine-texture-manager@0.0.0 cli` banner (stable but noisy) and the `Sampled in X.X ms at 120 Hz ...` footer (wall-clock timestamp). The plan's raw `diff` acceptance gate would always fail regardless of any refactor correctness.
- **Fix:** Capture + compare commands now filter both patterns symmetrically via `grep -v "^Sampled in" | grep -vE "^> " | grep -v "^$"` before diffing. No deterministic content is excluded. The golden file `fixtures/SIMPLE_PROJECT/.cli-golden.txt` contains only the 6 deterministic lines (header + 4 data rows + separator). Plan 02-03's re-diff step can use the same filter.
- **Files modified:** none (capture commands in the refactor step)
- **Commit:** 0d3c684 (documented in commit body)

**3. [Rule 1 - Grep-literal compliance] JSDoc in cli.ts cited `rec.scaleLabel` by name**

- **Found during:** Task 3 acceptance grep pass
- **Issue:** The first-pass JSDoc explaining why CLI must not consume the `*Label` fields spelled out `rec.scaleLabel / rec.peakSizeLabel / rec.frameLabel / rec.originalSizeLabel`. That tripped the plan's own `! grep -q "rec.scaleLabel" scripts/cli.ts` acceptance gate.
- **Fix:** Reworded the comment to describe the fields with prose ("the preformatted label fields ... carry the panel's whole-pixel + trailing-× format") rather than dotted identifiers. Same Phase 1 grep-literal-in-comments pattern as 01-01 Dev #4 / 01-02 Dev #3/#4 / 01-03 Dev #3 / 01-04 Dev #1.
- **Files modified:** `scripts/cli.ts`
- **Commit:** 0d3c684

No Rule 4 architectural questions arose.

## TDD Gate Compliance

Plan-level TDD was per-task (`tdd="true"` on Tasks 1 + 2):

- **RED** (Task 1, commit `d5b368f`): `test(02-01): ...` — DisplayRow contract + analyzer.spec.ts importing not-yet-existent `../../src/core/analyzer.js`; suite fails with "Cannot find module".
- **GREEN** (Task 2, commit `573302f`): `feat(02-01): ...` — src/core/analyzer.ts lands; 5/5 analyzer tests pass.
- **REFACTOR** (Task 3, commit `0d3c684`): `refactor(02-01): ...` — consumers delegate to analyzer; byte-for-byte CLI contract verified; all 62+1 tests still green.

RED → GREEN → REFACTOR sequence observed in git log.

## Threat Flags

No new trust-boundary surface introduced by this plan. The IPC payload shape (`SkeletonSummary.peaks`) changed from `PeakRecordSerializable[]` to `DisplayRow[]`, but both are primitive-only plain objects; `structuredClone` safety is asserted in both `summary.spec.ts` (inherited) and `analyzer.spec.ts` (new). No new endpoints, no new auth paths, no new file access, no schema changes.

## Known Stubs

None. All DisplayRow fields are fully populated from sampler output; no hardcoded empties, no placeholder labels.

## Foundations laid for Wave 2 (02-02)

- `DisplayRow` is the panel's row contract — columns can be driven directly off `originalSizeLabel` / `peakSizeLabel` / `scaleLabel` / `sourceLabel` / `frameLabel` with zero renderer-side formatting.
- `attachmentKey` is stable + unique — Plan 02-02's `Set<string>` selection state has a safe key (F3.3 foundation verified with an explicit uniqueness assertion in the D-33 test).
- Sort is deterministic and sorted-on-ingest — Plan 02-02's `useSortable(rows, key)` hook can re-sort without re-mounting cells.
- Byte-for-byte CLI contract has a retained golden at `fixtures/SIMPLE_PROJECT/.cli-golden.txt` that Plan 02-03 will re-diff against when the CLI isn't touched; same filter protocol (`grep -v "^Sampled in" | grep -vE "^> " | grep -v "^$"`).

## Self-Check: PASSED

Files verified to exist:
- FOUND: src/core/analyzer.ts
- FOUND: tests/core/analyzer.spec.ts
- FOUND: fixtures/SIMPLE_PROJECT/.cli-golden.txt (gitignored — on disk only)

Commits verified to exist:
- FOUND: d5b368f (test RED)
- FOUND: 573302f (feat GREEN)
- FOUND: 0d3c684 (refactor + consumers)

Grep gates verified:
- PASS: `export interface DisplayRow` in src/shared/types.ts
- PASS: 20 DisplayRow fields (15 raw + 5 labels) in src/shared/types.ts
- PASS: `peaks: DisplayRow[]` in src/shared/types.ts
- PASS: `PeakRecordSerializable` purged from src/ tests/ scripts/
- PASS: `DebugPanel` literal absent from src/shared/types.ts and src/core/analyzer.ts
- PASS: `Setup Pose (Default)` literal absent from src/shared/types.ts and src/core/analyzer.ts
- PASS: analyzer has no node: / sharp / react / react-dom imports
- PASS: `rec.scaleLabel` / `rec.peakSizeLabel` absent from scripts/cli.ts

---
phase: 6
slug: optimize-assets-image-export
status: applied
fixed_at: 2026-04-25
review_path: .planning/phases/06-optimize-assets-image-export/06-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed_count: 3
deferred_count: 4
bundled_low_count: 2
---

# Phase 6 — Code Review Fix Report

**Fixed at:** 2026-04-25
**Source review:** `.planning/phases/06-optimize-assets-image-export/06-REVIEW.md`
**Iteration:** 1 (single pass, no `--auto`)

**Summary:**
- MEDIUM findings in scope: **3**
- MEDIUM fixed: **3** (all)
- LOW deferred: **4** (per REVIEW.md recommendation)
- LOW bundled (zero-risk): **2** of the 4 (L-01, L-04)
- LOW carried forward to Phase 9 hardening: **2** (L-02, L-03)

## Fixed Issues (MEDIUM)

### M-01 — `sourceImagesDir` derivation parity (`indexOf` → `lastIndexOf`)

**Files modified:** `src/main/ipc.ts`, `tests/main/ipc-export.spec.ts`
**Commit:** `461b7ea`
**Applied fix:** Switched both `handleProbeExportConflicts` (line ~217) and `handleStartExport` (line ~378) from `indexOf('/images/')` to `lastIndexOf('/images/')`. Restores parity with the canonical `relativeOutPath` parser in `src/core/export.ts:117` and `src/renderer/src/lib/export-view.ts:98`. Adds regression test asserting:
- outer `/Users/me/work/images` as outDir is ALLOWED (not flagged as source-dir)
- inner `/Users/me/work/images/proj/images` as outDir is REJECTED with `invalid-out-dir`
- both `handleStartExport` and `handleProbeExportConflicts` agree on the new derivation

User-visible benefit: the friendlier "outDir IS source-images-dir" hard-reject message is now correct for users whose skeleton lives under a parent folder named `images` (e.g. `~/work/images/joker_project/skel.json`). The Round 4 F_OK probe remains the defense-in-depth net.

### M-02 — `useFocusTrap` effect churn from `onCloseSafely` deps

**Files modified:** `src/renderer/src/modals/OptimizeDialog.tsx`
**Commit:** `f82acb1`
**Applied fix:** Narrowed `useCallback` deps for `onCloseSafely` from `[state, props]` to `[state, props.onClose]`. Pre-fix the whole `props` object's fresh reference on every parent render recreated the callback every tick, which invalidated the `useFocusTrap` effect (`onEscape` is in its dep array): the trap tore down the document keydown listener, restored focus to the previously-focused element, then re-added the listener and re-focused the first tabbable on every render. The per-state focus useEffect (lines 146-151) then raced to refocus the per-state primary action button. Manifested as focus flicker during the in-progress state when progress events trigger re-renders.

No new test (renderer modal harness gap is documented elsewhere; manual focus-trap verification was approved in Round 6).

### M-03 — `ExportSummary.cancelled` honesty (loop-internal flag, not return-time probe)

**Files modified:** `src/main/image-worker.ts`, `tests/main/image-worker.spec.ts`
**Commit:** `ef0bda3`
**Applied fix:** Introduced `let bailedOnCancel = false;` at the top of the export loop; set it to `true` only when the cooperative pre-iteration `if (isCancelled()) break;` check fires. Return `cancelled: bailedOnCancel` instead of `cancelled: isCancelled()`. A late Cancel click that arrives after the last row already succeeded (but before `runExport` returns) no longer poisons the summary as cancelled. D-115 contract preserved: the genuine cancel path (Cancel before file 2's pre-check) still reports `cancelled: true`.

Added two regression tests:
- **late-flip race**: 2 rows, both succeed; `isCancelled` flips to `true` after the last pre-iteration check fires → `summary.cancelled === false` (no false-positive)
- **genuine cancel**: 2 rows; `isCancelled` returns `true` on the second pre-check → row 1 skipped, `summary.cancelled === true` (true cancel still preserved)

The pre-existing case (d) "cancel-after-file-2" test continues to pass: it flips the flag from inside `onProgress` after row 1 emits, so the row-2 pre-iteration check observes it (genuine bail).

## Bundled LOW Items

### L-01 — `pickOutputDir` empty-string fallback

**Files modified:** `src/renderer/src/components/AppShell.tsx`
**Commit:** `269382f`
**Applied fix:** `summary.skeletonPath.replace(/[\\/][^\\/]+$/, '')` returns the empty string for a single-segment absolute path like `/skel.json`, producing `defaultOutDir = '/images-optimized'` (system root). Added `|| '.'` fallback so the picker resolves to cwd in that degenerate case.

### L-04 — Delete dead `isOutDirInsideSourceImages` helper

**Files modified:** `src/main/ipc.ts`
**Commit:** `269382f` (same chore commit as L-01)
**Applied fix:** Removed the helper body and the `void isOutDirInsideSourceImages` workaround that kept it live for `noUnusedLocals`. Replaced with a brief docblock noting the supersession and pointing to git history if a future phase wants to re-introduce a structural folder-policy check.

## Deferred Issues (LOW)

### L-02 — Orphan `.tmp` cleanup on rename failure

**File:** `src/main/image-worker.ts:240-289`
**Reason:** Non-trivial — touches the rename `catch` block and warrants its own consideration / regression test (best-effort `unlink(tmpPath).catch(() => {})` is small but the test scaffolding to assert the cleanup is non-trivial to set up against the existing sharp-mock + fs-mock layering). Per REVIEW.md recommendation, defer to Phase 9 hardening.

### L-03 — `PreFlightBody` ratio cap for extreme downscales

**File:** `src/renderer/src/modals/OptimizeDialog.tsx:355-376`
**Reason:** Pure UX polish ("~811.0x smaller" caption is true but visually surprising). REVIEW.md classified as "not a correctness bug, just a UX edge". Defer to Phase 9 hardening or a future polish pass.

## Verification

| Check | Result |
|---|---|
| `npm test` | **210 pass, 1 skipped, 0 failures** (15 test files; +3 new tests vs pre-fix baseline of 207) |
| `npx vitest run tests/arch.spec.ts` | **9/9 GREEN** (Layer 3 boundary gates intact) |
| `npm run typecheck:web` | **clean** |
| `npm run typecheck:node` | clean except pre-existing `scripts/probe-per-anim.ts(14,31)` (`SamplerOutput.values` — documented script noise, not part of the build graph) |
| `npx electron-vite build` | **green** (main 41.11 kB, preload 3.68 kB, renderer 623.67 kB) |
| `tests/main/ipc-export.spec.ts` | **23 pass** (was 22; +1 M-01 regression-lock) |
| `tests/main/image-worker.spec.ts` | **11 pass** (was 9; +2 M-03 regression-locks: late-flip race + genuine cancel) |

## Commits (chronological)

1. `461b7ea` — `fix(06-review): use lastIndexOf for /images/ source-dir derivation in ipc.ts (matches export.ts)` — M-01
2. `f82acb1` — `fix(06-review): narrow OptimizeDialog onCloseSafely deps to prevent useFocusTrap churn` — M-02
3. `ef0bda3` — `fix(06-review): track bailedOnCancel inside loop; cancel-after-success no longer poisons summary (D-115)` — M-03
4. `269382f` — `chore(06-review): clean up dead helpers + low-priority items from REVIEW.md` — L-01 + L-04 bundle

---

_Fixed: 2026-04-25_
_Fixer: Claude (gsd-code-fixer, single-pass, no --auto)_
_Iteration: 1_

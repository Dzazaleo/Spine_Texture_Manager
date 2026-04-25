---
phase: 6
slug: optimize-assets-image-export
status: findings
depth: standard
reviewed: 2026-04-25
file_count: 18
finding_counts:
  critical: 0
  high: 0
  medium: 3
  low: 4
---

# Phase 6 — Code Review (Optimize Assets / image export)

**Reviewed:** 2026-04-25
**Depth:** standard (per-file analysis with language-specific checks)
**Files reviewed:** 18 source files across `src/core/`, `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/`
**Status:** findings (no CRITICAL or HIGH; 3 MEDIUM, 4 LOW)

## Summary

Phase 6 lands the per-attachment image-export pipeline (sharp Lanczos3 resize on the Electron main process, hand-rolled OptimizeDialog/ConflictDialog ARIA modals, atomic per-file write, F_OK-gated overwrite confirmation, atlas-extract fallback for atlas-packed projects, ceil + ceil-thousandth math reconciliation). Across 6 implementation waves and 6 gap-fix rounds the boundary discipline held: the Layer 3 grep gate is GREEN (9/9 in `tests/arch.spec.ts`), `src/core/*` does not import sharp / node:fs / node:fs/promises (loader.ts retains its documented Phase 0 carve-out), `src/renderer/*` does not import `src/core/*` anywhere, and the renderer-side `export-view.ts` is byte-identical to `src/core/export.ts` for the export-plan math.

The trust-boundary defenses are sound: shape validation precedes flag mutation, the re-entrancy guard is claimed synchronously before any await, the cancel/in-flight flags clear in `finally`, the overwrite gate is F_OK existence-only after Round 4 (no string-match false positives), and path-traversal is rejected via `path.relative` + `..` / `isAbsolute` / empty-string checks. The locked aspect-preservation invariant (uniform single-scale ceil per axis, ceil-thousandth scale display) is consistently applied across `src/core/export.ts`, `src/renderer/src/lib/export-view.ts`, `src/core/analyzer.ts` and both panels — all four reach for the same `safeScale(s) = Math.ceil(s * 1000) / 1000` helper. No CRITICAL or HIGH issues. Three MEDIUM correctness items and four LOW polish/quality items below.

## Findings

### MEDIUM

#### M-01: `sourceImagesDir` derivation uses `indexOf('/images/')` — fails when skeleton path itself contains an `images` directory

**Files:**
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/main/ipc.ts:217` (`handleProbeExportConflicts`)
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/main/ipc.ts:378` (`handleStartExport`)

**Issue:** Both hard-reject paths derive the source-images-dir by taking the FIRST `/images/` segment of `validPlan.rows[0].sourcePath`:

```ts
const idx = normalised.indexOf('/images/');
if (idx >= 0) {
  const sourceImagesDir = normalised.slice(0, idx + '/images'.length);
```

The accompanying comment at ipc.ts:371 justifies this with: "use the FIRST '/images/' segment so nested subfolders don't fool the prefix check" — which correctly handles nested REGION names like `AVATAR/FACE` (`<skeletonDir>/images/AVATAR/FACE.png`). However, it MIS-derives when the user's skeleton lives under a directory itself named `images`, e.g. `~/work/images/joker_project/skel.json`. The loader produces `sourcePath = ~/work/images/joker_project/images/CIRCLE.png`; `indexOf('/images/')` returns the offset of the FIRST `/images/`, so `sourceImagesDir` is computed as `~/work/images` (wrong) instead of `~/work/images/joker_project/images` (right). The hard-reject can then either (a) miss the actual source-images dir entirely, or (b) false-positive on `~/work/images` if the user picks that level.

By contrast, `relativeOutPath` in both `src/core/export.ts:117` and `src/renderer/src/lib/export-view.ts:98` correctly uses `lastIndexOf('/images/')` for the same parsing.

**Fix:** Use `lastIndexOf('/images/')` in both `handleProbeExportConflicts` (line 217) and `handleStartExport` (line 378) so the derivation matches the relative-out-path parser:

```ts
const idx = normalised.lastIndexOf('/images/');
```

This is consistent with the loader's path construction (the inner `/images/` is the export folder; any earlier `/images/` is part of the user's directory layout). The Round 4 F_OK probe still catches the actual collision case as defense-in-depth, but the friendlier `'invalid-out-dir'` message becomes correct.

#### M-02: `useFocusTrap` re-runs its effect on every parent render in `OptimizeDialog`

**Files:**
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/renderer/src/modals/OptimizeDialog.tsx:221-240` (`onCloseSafely` + `useFocusTrap`)
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/renderer/src/hooks/useFocusTrap.ts:189` (effect deps)

**Issue:** `OptimizeDialog`'s `onCloseSafely` is created via `useCallback(..., [state, props])`. Because `props` is a fresh object reference on every render, `onCloseSafely` is recreated each render. `useFocusTrap` lists `onEscape` in its dependency array, so the effect tears down and re-runs on every parent render: it removes the document keydown listener, restores focus to the previously-focused element, then re-adds the listener and re-focuses the first tabbable. The per-state `useEffect` at lines 146-151 then races to refocus the per-state primary action button.

The user-visible symptom is small (rapid focus flicker/race during the in-progress state when progress events trigger re-renders, plus listener churn on every event), but it does undo the auto-focus contract on each tick. The `tests/arch.spec.ts` Round 6 fix bundle did not include a renderer harness so this regression is not directly testable, but it goes against the docblock claim in `useFocusTrap.ts:184-188` ("the closure capture is stable for the duration of any given (enabled === true) lifecycle").

**Fix:** Either (a) narrow `onCloseSafely` deps to `[state, props.onClose]` so the callback identity is stable across most renders, or (b) wrap the `onEscape` arg to `useFocusTrap` in a stable ref (`useRef` + ref-update useEffect) and read `ref.current()` inside the hook, removing `onEscape` from the hook's deps. Option (a) is the smallest patch:

```ts
const onCloseSafely = useCallback(() => {
  if (state === 'in-progress') return;
  props.onClose();
}, [state, props.onClose]);
```

The same shape applies to `onStart` (deps `[props]` → `[props.onConfirmStart, props.plan, props.outDir, props.onRunStart, props.onRunEnd]`) but `onStart` is consumed via prop ref so churn is harmless there.

#### M-03: `cancelled` flag on `ExportSummary` reports late cancellation as cancelled even when every row succeeded

**File:** `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/main/image-worker.ts:302`

**Issue:** `runExport` returns `{ ..., cancelled: isCancelled() }`. The cancel flag is checked at the top of every iteration AND at return time. If the user clicks Cancel after the LAST row has already finished but before the function returns (the flag is set in an IPC handler that races the promise resolution), the summary reports `cancelled: true` even though every row completed successfully and no work was skipped. The OptimizeDialog's complete-state caption then renders `"N succeeded, 0 failed in Xs — cancelled"` which is misleading.

**Fix:** Track whether the loop ACTUALLY broke out of cancellation (rather than completing naturally), e.g.:

```ts
let bailedOnCancel = false;
for (let i = 0; i < plan.rows.length; i++) {
  if (isCancelled()) { bailedOnCancel = true; break; }
  // ...
}
return { ..., cancelled: bailedOnCancel };
```

Low user-visible impact but the contract in D-115 is "cooperative cancel between files"; reporting `cancelled` for a fully-successful run violates it.

### LOW

#### L-01: `pickOutputDir` produces an absolute-root default for skeleton files at filesystem root

**File:** `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/renderer/src/components/AppShell.tsx:188-192`

**Issue:** `summary.skeletonPath.replace(/[\\/][^\\/]+$/, '')` returns the empty string when the skeleton path is `/skel.json` (single-segment absolute path). `defaultOutDir = '' + '/images-optimized' = '/images-optimized'` then suggests writing to the system root. Edge case (no real user drops a skeleton at `/`), but the regex should fall back to the skeleton path's directory or to the user's home.

**Fix:** Detect empty result and fall back, e.g.:

```ts
const skeletonDir = summary.skeletonPath.replace(/[\\/][^\\/]+$/, '') || '.';
```

#### L-02: Orphan `.tmp` file not cleaned when `sharp(...).toFile(tmpPath)` succeeds but `fs.rename` fails

**File:** `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/main/image-worker.ts:240-289`

**Issue:** The atomic-write pattern writes to `<resolvedOut>.tmp` then renames. If sharp succeeds (tmp file is on disk) but rename fails (e.g. EACCES, target path now occupied by a directory, antivirus lock on Windows), the catch block emits `'write-error'` and continues — but the orphan `.tmp` file remains on the user's disk. CONTEXT D-121 documents that future writes will silently overwrite the orphan if the user re-runs against the same outDir, but a different outDir or a permanent failure leaves the orphan indefinitely.

**Fix:** In the rename `catch` block, attempt a best-effort `unlink(tmpPath).catch(() => {})` before pushing the error:

```ts
} catch (e) {
  await unlink(tmpPath).catch(() => { /* best-effort cleanup */ });
  const error: ExportError = { /* ... */ };
  // ...
}
```

#### L-03: `OptimizeDialog.PreFlightBody` ratio threshold can show "0.0x smaller" for near-identical dims

**File:** `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/renderer/src/modals/OptimizeDialog.tsx:355-376`

**Issue:** `const ratio = row.outW > 0 ? row.sourceW / row.outW : 1;` and `ratio > 1.05` gates the "~Xx smaller" caption. When `row.sourceW === row.outW` (effective scale = 1.0 due to the downscale-only clamp), ratio is 1.0 and the caption is suppressed correctly. But when `row.outW` is exactly 1 and `row.sourceW` is large (extreme downscale to a single-pixel image — degenerate but possible if the sampler reports a tiny peakScale), ratio is huge and the caption reads e.g. `~811.0x smaller` — true but visually surprising. Also: with `Math.ceil` semantics, `outW` could equal `sourceW + 1` rounding up (no, actually ceil of any (sourceW × s) where s ≤ 1.0 gives outW ≤ sourceW; effectiveScale is clamped). Not a correctness bug, just a UX edge.

**Fix:** Optional — add a max ratio cap (`{ratio > 1.05 && ratio < 100 && ...}`) or change the caption to a percentage when ratio > 10×.

#### L-04: `isOutDirInsideSourceImages` retained as dead code with `void`-call workaround

**File:** `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/main/ipc.ts:94-104`

**Issue:** Round 3 superseded the folder-position-only rejection (Round 2's behaviour); the helper `isOutDirInsideSourceImages` is no longer called. The current code retains it with a `void isOutDirInsideSourceImages` statement at line 104 to satisfy `noUnusedLocals`. The docblock explains the rationale ("kept here for potential future use") but this is dead code in the unused-symbol-suppression sense. If a future round genuinely needs the helper, it can be re-added; carrying it now adds maintenance burden and risks confusing readers about the active contract.

**Fix:** Delete `isOutDirInsideSourceImages` and the trailing `void` statement. The comment block can be preserved as a docblock above the active hard-reject inline check at lines 375-393 if the rationale needs to survive.

## Layer 3 boundary verification (explicit pass/fail per direction)

| Direction | Status | Evidence |
|---|---|---|
| `src/core/*` ↛ `sharp` / `node:fs` / `node:fs/promises` | PASS | `tests/arch.spec.ts:116-134` grep over `src/core/**/*.ts` (with `loader.ts` exempt per documented Phase 0 carve-out) returns no offenders. Manual `grep` confirms only `src/core/loader.ts` imports `node:fs` and `node:path`. |
| `src/renderer/*` ↛ `src/core/*` | PASS | `tests/arch.spec.ts:19-34` grep returns no offenders. `src/renderer/src/lib/export-view.ts` is the byte-identical inline copy of `src/core/export.ts` per Phase 4 D-75 precedent; `src/renderer/src/lib/overrides-view.ts` mirrors `src/core/overrides.ts`. AppShell + panels import only from `../lib/*-view.js`, never from `../../../core/*`. |
| `src/main/*` may import sharp + `node:fs` + `node:path` | PASS | Only `src/main/image-worker.ts` imports `sharp`; only `src/main/image-worker.ts` and `src/main/ipc.ts` import `node:fs/promises`. Both files live under `src/main/`. |
| `src/preload/*` only imports `electron` and type-only shared types | PASS | `src/preload/index.ts` imports `electron` (always externalized) + `import type { Api, ExportProgressEvent, LoadResponse }` from `../shared/types.js`. Sandbox-discipline preserved. |

The Round 5 grep for `safeScale` parity in `tests/core/export.spec.ts` adds an additional anchor that flags drift between `src/core/export.ts` and `src/renderer/src/lib/export-view.ts` if either file is touched without the other.

## Trust boundary verification (IPC + filesystem)

| Concern | Status | Evidence |
|---|---|---|
| Shape validation BEFORE `exportInFlight` mutation | PASS | `handleStartExport` (`src/main/ipc.ts:347-393`) runs the re-entrancy check, outDir typecheck, plan shape validation, AND the source-images-dir hard reject all before `exportInFlight = true` (line 408). A rejection cannot poison the flag. |
| Re-entrancy guard claimed synchronously before any await | PASS | `exportInFlight = true` (line 408) runs in the same microtask as the check (line 347); the first `await probeExportConflicts(...)` is line 426. A second invocation kicked off in the same tick observes the flag set. |
| `exportInFlight` and `exportCancelFlag` cleared on every exit path | PASS | Both flags clear in the `finally` block (lines 458-459); `try/catch/finally` covers the `runExport` happy path, the unknown-error catch, AND the probe-rejection early return. |
| Path-traversal defense in image-worker | PASS | `runExport` (`src/main/image-worker.ts:184-197`) computes `pathRelative(resolvedOutDir, resolvedOut)` and rejects on `..` prefix, `isAbsolute(rel)`, or `rel === ''` (the degenerate "outPath equals outDir itself" case). All three branches emit `'write-error'` per the threat-model lite. |
| F_OK-only collision gate (Round 4) | PASS | Both `probeExportConflicts` (`src/main/ipc.ts:160-183`) and the in-worker per-row check (`src/main/image-worker.ts:108-122`) check `fs.access(resolvedOut, F_OK)` only — the round-2/3 string-match against `sourcePath` and `atlasSource.pagePath` is gone. The in-worker check is gated on `!allowOverwrite` so the renderer's "Overwrite all" flow bypasses it correctly. |
| Atomic write per file (D-121) | PASS | `sharp(...).toFile(<resolvedOut>.tmp)` then `fs.rename(...)` runs in the same directory, ensuring rename atomicity. Rename failure surfaces as `'write-error'` and the loop continues per D-116. |
| Sharp instance lifecycle | PASS | Each row creates a fresh chained sharp instance inline; no module-level cache, no per-page reuse. libvips releases native memory when each `.toFile` promise settles. No leak vector. |
| Webcontents.send wrapped in try/catch | PASS | `evt.sender.send('export:progress', e)` (`src/main/ipc.ts:446`) is wrapped in try/catch — if the renderer window is closed mid-export, the export still completes and the summary is returned to the awaiting handler. |
| One-way IPC for cancel + open-folder uses defense-in-depth typecheck | PASS | `'shell:open-folder'` handler (`src/main/ipc.ts:488-500`) checks `typeof dir === 'string' && dir.length > 0` before invoking `shell.showItemInFolder`. `'export:cancel'` is a pure flag flip with no payload. |
| AtlasNotFoundError preserves stack-free serialization | PASS | `src/core/errors.ts:27-51` — only `.message` is expanded; `.name`, `.searchedPath`, `.skeletonPath` unchanged. The IPC envelope (`src/main/ipc.ts:258-263`) surfaces only `name` + `message`, never the trace (T-01-02-02). |

## Gap-fix consistency check (6 rounds)

Reviewed for dead code, contradictory docblocks, and abandoned-mid-round paths.

| Round | Status | Notes |
|---|---|---|
| Round 1 (#1 ≤1.0 clamp, #2 atlas-extract, #3 row-key index) | Clean | All three fixes wired end-to-end with new tests. The `effectiveScale ≤ 1.0` clamp + `safeScale` ordering is documented byte-identically in both `src/core/export.ts` and `src/renderer/src/lib/export-view.ts`. |
| Round 2 (per-row collision + AtlasNotFoundError) | **L-04 dead code** | `isOutDirInsideSourceImages` is dead after Round 3 but kept live via `void` to satisfy `noUnusedLocals`. See L-04. |
| Round 3 (probe + ConflictDialog) | Clean | The Round 2 collision-rejection-on-folder-position-alone is GONE; only the "outDir IS source-images-dir itself" hard reject survives, with a clear docblock explaining the supersession. |
| Round 4 (F_OK-only) | Clean | Round 2/3 string-match collision checks removed from BOTH `probeExportConflicts` and the in-worker per-row gate. Comments at ipc.ts:164-171 and image-worker.ts:94-107 narrate the supersession explicitly. No surviving string-match logic for the collision gate. |
| Round 5 (ceil + ceil-thousandth) | Clean | `safeScale` helper present in BOTH `src/core/export.ts:133-135` and `src/renderer/src/lib/export-view.ts:114-116` (byte-identical bodies). `ceilThousandth` helper in `src/core/analyzer.ts:83-85` produces the identical math for the displayed `scaleLabel`. The renderer-side `computeExportDims` helper (`export-view.ts:139-161`) is the single source of truth used by both panels' `enrichWithEffective`/`enrichCardsWithEffective`. World-AABB moves cleanly to a hover tooltip on the "Peak W×H" cell in both panels (`GlobalMaxRenderPanel.tsx:340-348` + `AnimationBreakdownPanel.tsx:547-555`). |
| Round 6 (useFocusTrap) | **M-02 effect churn** | All three modals (OverrideDialog, OptimizeDialog, ConflictDialog) use the shared hook; per-dialog auto-focus useEffects deleted from OverrideDialog (replaced by select-only) and ConflictDialog (replaced by hook auto-focus). OptimizeDialog retains a per-state useEffect on top of the trap auto-focus (lines 146-151) — these don't fight on initial mount but do race on every parent re-render via the `onEscape`-dep churn called out in M-02. |

No contradictory comments survive; each round's docblock cites the prior round it supersedes by date.

## Locked-invariant verification

### Aspect-preservation (uniform single-scale; no per-axis effective scale)

PASS. Single `effScale` variable computed in `buildExportPlan` (both copies) and `computeExportDims`, then `Math.ceil` applied per axis with the SAME `effScale`. Worst-case anisotropy from per-axis ceil is ≤ 1px on a single axis — within sub-pixel tolerance per the locked memory. Verified by code inspection at:
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/core/export.ts:207-208`
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/renderer/src/lib/export-view.ts:233-234`
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/renderer/src/lib/export-view.ts:158-159`

No code path in the reviewed files emits per-axis effective scales.

### D-110 ceil + ceil-thousandth consistency across 4 sites

PASS. The four sites that compute or display the effective-scale value all use the same formula `Math.ceil(s * 1000) / 1000` followed by `Math.min(_, 1)`:

1. `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/core/export.ts:133-135` (`safeScale`) → used at line 176
2. `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/renderer/src/lib/export-view.ts:114-116` (`safeScale`) → used at lines 155, 202
3. `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/core/analyzer.ts:83-85` (`ceilThousandth`) → used in `toDisplayRow.scaleLabel` (line 113) and `toBreakdownRow.scaleLabel` (line 235)
4. `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/renderer/src/lib/export-view.ts:139-161` (`computeExportDims`) — the renderer panels' single source of truth

The display `scaleLabel` therefore matches the export math: a user reading `0.361×` in the panel and applying 36.1% in Photoshop gets a guaranteed-not-larger source than the app exports. The `tests/core/export.spec.ts` parity grep for `safeScale` in both files is the static guarantee that this invariant survives future edits.

## Recommendation

**status: findings** (no CRITICAL or HIGH; 3 MEDIUM, 4 LOW).

Phase 6 is safe to close out as-is. The Layer 3 boundary, trust-boundary defenses, and locked invariants (uniform sizing, ceil-thousandth, F_OK collision gate, atomic writes) are all sound. The 6 gap-fix rounds did not leave behind contradictory paths apart from the dead `isOutDirInsideSourceImages` helper (L-04).

Recommend running `/gsd-code-review-fix 6` to sweep the 3 MEDIUM items:
- **M-01** (lastIndexOf parity for `sourceImagesDir` derivation) — small, mechanical fix; locks the friendlier hard-reject message against the unusual but real `<dir>/images/<project>/skel.json` layout.
- **M-02** (`useFocusTrap` effect churn in OptimizeDialog) — narrow `onCloseSafely` deps from `[state, props]` to `[state, props.onClose]`; one-line fix, eliminates per-render listener churn.
- **M-03** (`cancelled` flag honesty) — track an explicit `bailedOnCancel` boolean instead of re-checking `isCancelled()` at return time; small refactor.

The 4 LOW items (orphan-tmp cleanup, ratio cap, root-skeleton edge, dead code) are quality-of-life polish and can wait for Phase 9 hardening if not bundled into the same fix-sweep.

Per the advisory close-out gate: this REVIEW does NOT block close-out. Phase 6 may proceed to gsd-verify-work.

---

_Reviewed: 2026-04-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 6
slug: optimize-assets-image-export
status: passed
verified: 2026-04-25
must_haves_met: 8/8
re_verification:
  previous_status: none  # Initial verification — phase has prior internal gap-fix rounds + REVIEW-FIX, but no prior 06-VERIFICATION.md
  previous_score: n/a
requirement_ids_verified:
  - F8.1: passed
  - F8.2: passed
  - F8.3: passed
  - F8.4: passed
  - F8.5: passed
  - N3.1: passed
  - N3.2: passed  # Manual verification approved 2026-04-25 (Step 5)
  - N4.2: passed  # Manual verification approved 2026-04-25 (Step 6) — packaged .dmg sharp-load PASS
test_evidence:
  full_suite: 210 passed | 1 skipped | 0 failed (15 spec files)
  arch_spec: 9/9 GREEN (Layer 3 invariant: renderer↛core AND core↛sharp/node:fs both intact)
  packaged_dmg: release/Spine Texture Manager-0.0.0-arm64.dmg present (118 MB; asarUnpack/{sharp,@img} both populated)
  cli_byte_lock: scripts/cli.ts + src/core/sampler.ts diffs empty since Phase 6 base (D-102 + CLAUDE.md fact #3)
---

# Phase 6: Optimize Assets (image export) — Verification Report

**Phase Goal:** Ship a one-click export path that takes a loaded Spine skeleton's per-attachment peak render scales and writes downscaled PNGs (uniform aspect, ceil-thousandth scale, ceil-rounded dims, atomic writes, sharp Lanczos3) to a user-chosen output directory, with cancel UX, overwrite-confirm UX, atlas-only project support, and a packaged-build sharp-load that doesn't crash.

**Verified:** 2026-04-25
**Status:** passed
**Re-verification:** No — initial verification (the phase went through 6 in-line gap-fix rounds + 1 REVIEW + 1 REVIEW-FIX during execution, but this is the first formal `/gsd-verify-work 6` pass).

## Phase Goal Achievement

Phase 6 delivers its promise end-to-end. The pipeline is wired from the AppShell "Optimize Assets" button (`src/renderer/src/components/AppShell.tsx:335`) through the IPC layer (`src/main/ipc.ts handleStartExport` with re-entrancy guard, outDir validation, F_OK conflict probe), into the sharp-Lanczos3 worker (`src/main/image-worker.ts runExport` with atlas-extract fallback, atomic .tmp→rename writes, cooperative cancel, skip-on-error continuation, path-traversal defense), and back to the renderer via `export:progress` events that drive the per-file checklist UI. The locked aspect-preservation invariant (uniform single-scale, ceil per axis, ceil-thousandth display) is honored consistently across `src/core/export.ts`, `src/renderer/src/lib/export-view.ts`, `src/core/analyzer.ts`, and both panels — all four sites use the identical `safeScale(s) = Math.ceil(s * 1000) / 1000` formula. The Layer 3 architecture invariant is preserved: `tests/arch.spec.ts` 9/9 GREEN, no renderer file imports from `src/core/*`, and only `src/main/image-worker.ts` imports `sharp` (loader.ts retains its documented Phase 0 carve-out for `node:fs`).

The phase exhibits mature feedback-loop usage: 6 rounds of in-line gap fixes (effectiveScale-≤1.0 clamp, atlas-extract fallback for atlas-packed projects, rowStatuses-by-index, source-vs-output collision guard, F_OK-only collision gate, ceil-thousandth display reconciliation, useFocusTrap shared hook) plus 1 advisory code review (0 CRITICAL, 0 HIGH, 3 MEDIUM, 4 LOW) plus 1 REVIEW-FIX sweep (3 MEDIUM resolved, 2 LOW bundled, 2 LOW deferred to Phase 9). Manual human-verify approved 2026-04-25 across all 7 scenarios. Test suite at 210 pass / 1 skip / 0 fail across 15 spec files.

## Per-Requirement Verification

### F8.1 — Export button opens a folder picker — PASSED

| Concern | Evidence |
|---------|----------|
| AppShell button | `src/renderer/src/components/AppShell.tsx:335-339` — "Optimize Assets" button, `onClick={onClickOptimize}`, right-aligned (ml-auto), disabled when peaks=0 or `exportInFlight` |
| Click handler → picker | `AppShell.tsx:201` `onClickOptimize` calls `pickOutputDirectory(defaultOutDir)` |
| Default path = `<skeletonDir>/images-optimized/` | `AppShell.tsx:188-192` regex `summary.skeletonPath.replace(/[\\/][^\\/]+$/, '') \|\| '.'` + `/images-optimized` (REVIEW-FIX L-01 added the empty-string fallback) |
| IPC → main process | `src/preload/index.ts:78` `pickOutputDirectory: (defaultPath?) => ipcRenderer.invoke('dialog:pick-output-dir', defaultPath)` |
| Main-process handler | `src/main/ipc.ts:274` `handlePickOutputDirectory` calls `dialog.showOpenDialog` with `properties: ['openDirectory', 'createDirectory', 'promptToCreate', 'dontAddToRecent']` |
| Cancel returns null | `dialog.showOpenDialog` `canceled` short-circuits to `null` per Electron contract; AppShell branch closes the OptimizeDialog cleanly |

### F8.2 — sharp Lanczos3 fill resize, write to `<out>/images/<path>.png` — PASSED

| Concern | Evidence |
|---------|----------|
| Sharp pipeline (per-region path) | `src/main/image-worker.ts:273-276` `sharp(sourcePath).resize(row.outW, row.outH, { kernel: 'lanczos3', fit: 'fill' }).png({ compressionLevel: 9 }).toFile(tmpPath)` |
| Sharp pipeline (atlas-extract path) | `image-worker.ts:262-271` adds `.extract({ left, top, width, height })` before `.resize(...)` for atlas-packed projects (Gap-Fix #2) |
| Output path layout `<outDir>/images/<regionName>.png` | `src/core/export.ts:117` + `src/renderer/src/lib/export-view.ts:98` use `lastIndexOf('/images/')` to derive `relativeOutPath` (preserves nested region names like `AVATAR/L_EYE`) |

### F8.3 — Preserve directory structure of source `images/` layout — PASSED

| Concern | Evidence |
|---------|----------|
| Region names with `/` preserved | `src/core/export.ts` + `src/renderer/src/lib/export-view.ts` — `relativeOutPath` parser keeps the `images/<path>` structure intact; `image-worker.ts:234` `fs.mkdir(dirname(resolvedOut), { recursive: true })` creates parent directories on demand |
| Verified by Jokerman fixture | Gap-Fix Round 1 atlas-extract integration test (`tests/main/image-worker.atlas-extract.spec.ts`) confirms `AVATAR/L_EYE.png` writes to the correct nested output path |

### F8.4 — Never modify original source files — PASSED

| Concern | Evidence |
|---------|----------|
| Round 4 F_OK existence gate | `src/main/ipc.ts:139-153` `probeExportConflicts` checks `fs.access(resolvedOut, F_OK)` before any write; renderer surfaces collisions in `ConflictDialog` for explicit user opt-in |
| Worker-level defense in depth | `src/main/image-worker.ts:123-137` — same F_OK check inside `runExport` per-row loop, gated on `!allowOverwrite`; on hit emits `'overwrite-source'` and continues per D-116 |
| Source-images-dir hard reject | `src/main/ipc.ts:347-393` — outDir-equals-or-child-of-source/images returns `kind: 'invalid-out-dir'` BEFORE `exportInFlight` set; M-01 REVIEW fix switched derivation from `indexOf` to `lastIndexOf` for parity with the canonical parser |
| Path-traversal defense | `image-worker.ts:202-212` rejects `..` prefix, absolute paths, and degenerate empty-relative case |
| Default behavior never overwrites | `runExport` `allowOverwrite: boolean = false` default; only the renderer's "Overwrite all" flow inside ConflictDialog flips it to true |

### F8.5 — Progress UI with per-file error surfacing — PASSED

| Concern | Evidence |
|---------|----------|
| Linear progress bar | `src/renderer/src/modals/OptimizeDialog.tsx` `InProgressBody` renders linear bar + per-file checklist |
| Per-row checklist | OptimizeDialog `rowStatuses` Map<number, RowStatus> populated from `onExportProgress` events (Gap-Fix #3 corrected key from outPath → index) |
| Per-row error surfacing | `OptimizeDialog.tsx:131` `rowErrors.set(event.index, errMsg)` writes the typed `ExportError.message`; `--color-danger` token (Phase 5 D-104) renders error rows |
| Progress event channel | `src/main/ipc.ts:446` `evt.sender.send('export:progress', e)` (one-way, wrapped in try/catch for renderer-closed safety); `src/preload/index.ts onExportProgress` preserves listener identity (Pitfall 9) |

### N3.1 — Lanczos3 + PNG compression-9 + alpha preserved — PASSED

| Concern | Evidence |
|---------|----------|
| Lanczos3 + PNG-9 in pipeline | `src/main/image-worker.ts:269-270` `kernel: 'lanczos3'` + `compressionLevel: 9` (both sharp branches) |
| Alpha preserved | sharp `.png(...).toFile()` preserves alpha by default (no `flatten`/`removeAlpha` calls anywhere); confirmed by `tests/main/image-worker.integration.spec.ts` real-bytes round-trip on CIRCLE.png 64×64 → 32×32 |

### N3.2 — Output visually indistinguishable from Photoshop-Lanczos — PASSED

| Concern | Evidence |
|---------|----------|
| Manual visual approval | Plan 06-07 Task 2 human-verify Step 5 PASS, signed off 2026-04-25 |
| Recorded in VALIDATION.md | `06-VALIDATION.md:60` Row 06-07-02 ✅ green; `signed_off: 2026-04-25` |

### N4.2 — No native compilation required for end users — PASSED

| Concern | Evidence |
|---------|----------|
| sharp@^0.34.5 in dependencies | `package.json:25` `"sharp": "^0.34.5"` (NOT devDependencies) |
| asarUnpack covers BOTH sharp + @img | `electron-builder.yml:35-38` `asarUnpack:` includes `**/node_modules/sharp/**/*` AND `**/node_modules/@img/**/*` (D-123 / Pitfall 1) |
| Packaged-build artifact | `release/Spine Texture Manager-0.0.0-arm64.dmg` (118 MB, built 2026-04-25 01:24Z) present on disk |
| Native binaries unpacked | `release/mac-arm64/Spine Texture Manager.app/Contents/Resources/app.asar.unpacked/node_modules/{sharp,@img}` both present |
| Manual sharp-load PASS | Plan 06-07 Task 2 human-verify Step 6 PASS, signed off 2026-04-25 (RELEASE BLOCKER gate cleared) |

## Cross-Cutting Invariant Verification

### Layer 3 boundary (renderer↛core AND core↛sharp/node:fs) — PASSED

| Direction | Status | Evidence |
|-----------|--------|----------|
| `src/core/*` ↛ sharp / node:fs / node:fs/promises | PASS | `tests/arch.spec.ts:116-134` — grep confirms only `src/core/loader.ts` imports `node:fs` (Phase 0 carve-out, name-exempted by the test) |
| `src/renderer/*` ↛ `src/core/*` | PASS | `tests/arch.spec.ts:19-34` — no offenders. AppShell + panels import only from `../lib/*-view.js`, never from `core/*` |
| `src/main/*` may import sharp + node:fs | PASS | Only `src/main/image-worker.ts` imports `sharp`; `image-worker.ts` + `ipc.ts` import `node:fs/promises` |
| arch.spec full count | PASS | **9/9 GREEN** (re-confirmed via `npm test` 2026-04-25 — 210 pass / 1 skip / 0 fail) |
| Renderer↔core math parity | PASS | `safeScale` helper is byte-identical in `src/core/export.ts:133-135` and `src/renderer/src/lib/export-view.ts:114-116`; `tests/core/export.spec.ts` parity describe block locks them against drift |

### Aspect-preservation locked memory (uniform single-scale, ceil per axis) — PASSED

| Concern | Evidence |
|---------|----------|
| Single `effScale` variable | `src/core/export.ts:176` + `src/renderer/src/lib/export-view.ts:155, 202` — one `effScale = Math.min(safeScale(rawEffScale), 1)` per row; both axes share it |
| `Math.ceil` per axis using same `effScale` | `export.ts:207-208` `outW = Math.ceil(acc.row.sourceW * acc.effScale)` and `outH = Math.ceil(acc.row.sourceH * acc.effScale)` |
| No anisotropic export anywhere | Code inspection — no per-axis `effScaleX`/`effScaleY` exists in any reviewed file |

### D-110 ceil-thousandth consistency (4 sites) — PASSED

| Site | Reference |
|------|-----------|
| `src/core/export.ts:133-135` `safeScale` | Used at line 176 in plan-build |
| `src/renderer/src/lib/export-view.ts:114-116` `safeScale` | Used at lines 155 (computeExportDims) + 202 (buildExportPlan parity copy) |
| `src/core/analyzer.ts:83-85` `ceilThousandth` | Used in `toDisplayRow.scaleLabel` (line 113) + `toBreakdownRow.scaleLabel` (line 235) |
| `src/renderer/src/lib/export-view.ts:139-161` `computeExportDims` | Used by both panels' `enrichWithEffective`/`enrichCardsWithEffective` for "Peak W×H" column |

The displayed `scaleLabel` matches the export math: a user reading `0.361×` and entering 36.1% in Photoshop will get a never-larger source than the app exports.

### D-115 cooperative cancel — PASSED

`src/main/image-worker.ts:97-103` — `for` loop checks `isCancelled()` at the top of every iteration; on hit sets `bailedOnCancel = true` (REVIEW M-03 fix) and breaks. `image-worker.ts:323` returns `cancelled: bailedOnCancel` (NOT `isCancelled()`) — late cancel after final-row success no longer poisons the summary. Two new regression tests added: late-flip race (cancelled === false) + genuine cancel (cancelled === true). ESC disabled mid-run via `OptimizeDialog.tsx onCloseSafely` checking `if (state === 'in-progress') return;`.

### D-116 skip-on-error continuation — PASSED

Every per-row error path in `image-worker.ts` uses `continue` to advance to the next row: `'overwrite-source'` (line 135), `'missing-source'` (167, 176), `'rotated-region-unsupported'` (196), `'write-error'` from path-traversal (211) / NaN-dim (229) / mkdir failure (243) / rename failure (303), `'sharp-error'` (286). No early `return`/`throw` aborts the run on per-row failure.

### D-119 re-entrancy synchronous-set — PASSED

`src/main/ipc.ts:407` `exportInFlight = true` runs in the same microtask as the guard check at line 334. The first `await probeExportConflicts(...)` is on line 425 (POST flag-set). The shape validation + outDir hard-reject + plan validation all execute BEFORE the flag mutation (lines 347-393), so a rejection cannot poison the flag. `finally` block (lines 456-459) clears both `exportInFlight` and `exportCancelFlag` on every exit path (happy, cancelled, error). REVIEW finding "Trust boundary verification" PASS (15/15 concerns).

### D-121 atomic writes — PASSED

`src/main/image-worker.ts:255` `tmpPath = resolvedOut + '.tmp'` (same directory → rename is atomic). Sharp pipeline writes to `tmpPath` (lines 271, 276); on success, `fs.rename(tmpPath, resolvedOut)` (line 294). Same-filesystem rename guaranteed (Pitfall 6 mitigated). Rename failure surfaces as `'write-error'` and the loop continues per D-116.

**Known LOW (deferred):** L-02 — orphan `.tmp` file not cleaned when sharp succeeds but rename fails. Documented in REVIEW-FIX as Phase 9 hardening item; not a correctness gap (next export run silently overwrites the orphan).

### T-06-06 packaged-build native binary — PASSED

| Concern | Evidence |
|---------|----------|
| asarUnpack glob (sharp) | `electron-builder.yml:37` `**/node_modules/sharp/**/*` |
| asarUnpack glob (@img) | `electron-builder.yml:38` `**/node_modules/@img/**/*` |
| Artifact-level verification | `release/mac-arm64/Spine Texture Manager.app/Contents/Resources/app.asar.unpacked/node_modules/sharp` (300K) + `node_modules/@img` (16M, includes `sharp-darwin-arm64` + `sharp-libvips-darwin-arm64` + `colour` subpackages) |
| Manual smoke-test | Plan 06-07 Task 2 human-verify Step 6 PASS 2026-04-25 — packaged .dmg launches and exports without `Cannot find module 'sharp'` |

## Gap-Fix + REVIEW-FIX Acknowledgment

Phase 6 demonstrates mature feedback-loop usage. **6 in-line gap-fix rounds** during human-verify execution:

| Round | Fix | Commit Anchor |
|-------|-----|---------------|
| 1 | effectiveScale ≤1.0 clamp + atlas-extract fallback + rowStatuses-by-index | `5242703`, `6812b97`, `3c30644`, `acdf7c1`, `c8465c6`, `5b834ef` |
| 2 | Source-vs-output collision guard (defense-in-depth at IPC + worker layers); AtlasNotFoundError clearer message | `d8b53c8`, `ebe57cf` |
| 3 | Probe-then-confirm overwrite UX via ConflictDialog | (round 3 commits per GAP-FIX-SUMMARY) |
| 4 | F_OK existence-only collision gate (replaces round 2/3 string-match) | (round 4 commits) |
| 5 | ceil + ceil-thousandth + Peak W×H column shows export dims (not world-AABB) | (round 5 commits) |
| 6 | Shared `useFocusTrap` hook wired into all 3 ARIA modals | `a8fd72d`, `8a76b7c` |

**1 advisory code review** (`06-REVIEW.md`, 0 CRITICAL, 0 HIGH, 3 MEDIUM, 4 LOW) followed by **1 REVIEW-FIX sweep** (`06-REVIEW-FIX.md`):

| ID | Fix | Commit |
|----|-----|--------|
| M-01 | `lastIndexOf('/images/')` parity in `handleProbeExportConflicts` + `handleStartExport` | `461b7ea` |
| M-02 | Narrowed `OptimizeDialog onCloseSafely` deps to prevent useFocusTrap effect churn | `f82acb1` |
| M-03 | `bailedOnCancel` loop-internal flag replaces post-hoc `isCancelled()` probe | `ef0bda3` |
| L-01 | `pickOutputDir` empty-string fallback for filesystem-root skeletons | `269382f` |
| L-04 | Deleted dead `isOutDirInsideSourceImages` helper + `void`-call workaround | `269382f` |

REVIEW-FIX added 3 new regression tests (M-01 + 2× M-03), bringing the suite from 207 → 210.

## Known Deferrals

**Phase 6.1 (atlas-less mode) and Phase 6.2 (dims-badge with override-math cap):** noted by user as future polish phases; not in F8/N3/N4.2 contracts; out of scope for `/gsd-verify-work 6`.

**LOW REVIEW items deferred to Phase 9 hardening** (per REVIEW.md recommendation):

- **L-02** — Orphan `.tmp` cleanup on rename failure. File: `src/main/image-worker.ts:240-289`. Reason: best-effort `unlink(tmpPath).catch(() => {})` is a small fix, but the test scaffolding to assert the cleanup against the existing sharp-mock + fs-mock layering is non-trivial.
- **L-03** — `OptimizeDialog.PreFlightBody` ratio cap for extreme downscales (`~811.0x smaller` caption). File: `src/renderer/src/modals/OptimizeDialog.tsx:355-376`. Reason: pure UX polish, not a correctness bug.

**Pre-existing out-of-scope issue** (not introduced by Phase 6, not blocking):

- `scripts/probe-per-anim.ts(14,31): TS2339: Property 'values' does not exist on type 'SamplerOutput'` — pre-existing on the Phase 6 base commit, documented in Plan 06-02 / 06-05 SUMMARYs as out-of-scope per executor scope-boundary. Not in any Phase 6 plan's `files_modified`.

## Verdict

**status: passed** — proceed to phase.complete.

All 8 Phase 6 requirement IDs (F8.1, F8.2, F8.3, F8.4, F8.5, N3.1, N3.2, N4.2) are delivered end-to-end and verified in the codebase. The 7 cross-cutting invariants (Layer 3, aspect-preservation, D-110, D-115, D-116, D-119, D-121, T-06-06) are all intact. Test suite green at 210 pass / 1 skip / 0 fail across 15 files. arch.spec 9/9. Packaged `.dmg` present with sharp + @img unpacked. Manual human-verify approved 2026-04-25 across all 7 scenarios (including the two RELEASE-BLOCKER-grade gates: N3.2 visual quality + N4.2 packaged sharp-load).

Phase 6 may proceed to `/gsd-phase-complete 6` and STATE.md advancement to "Phase 6 COMPLETE — Phase 7 ready".

---

_Verified: 2026-04-25_
_Verifier: Claude (gsd-verifier)_
_Method: goal-backward verification against codebase + test suite re-run + packaged-artifact inspection_

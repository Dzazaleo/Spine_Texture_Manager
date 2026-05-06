---
phase: 28-optional-output-sharpening
fixed_at: 2026-05-06T23:10:00Z
review_path: .planning/phases/28-optional-output-sharpening/28-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 28: Code Review Fix Report

**Fixed at:** 2026-05-06T23:10:00Z
**Source review:** .planning/phases/28-optional-output-sharpening/28-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04)
- Fixed: 6
- Skipped: 0
- Info findings (IN-01, IN-02, IN-03): excluded per default `critical_warning` scope

**Verification (post-fix `tsc --noEmit`):**
- `tsconfig.node.json`: 5 pre-existing errors only (probe-per-anim TS2339, two `opts` TS6133, `safeScale` TS6133, `plan` TS6133). Phase 28's 8 × TS2741 (sharpenOnExport) + 1 × TS2741 (rotated) are resolved.
- `tsconfig.web.json`: 5 pre-existing errors only (`onClickOpen`, `opts`, `onQueryChange` × 2, `formatBytes`). Phase 28's 3 × TS string|null errors at OptimizeDialog 232/250/254 are resolved.
- `vitest run tests/core/project-file.spec.ts tests/main/project-io.spec.ts tests/main/image-worker.sharpen.spec.ts`: 43 / 43 pass.

## Fixed Issues

### CR-01: Phase 28 introduces NEW TypeScript build failures in pre-existing test files

**Files modified:** `tests/core/project-file.spec.ts`, `tests/main/project-io.spec.ts`
**Commit:** `7f32881`
**Applied fix:** Backfilled `sharpenOnExport: false` on all 8 pre-existing literal sites:
- `tests/core/project-file.spec.ts` lines 115, 135, 164, 202, 261, 300, 355 (5 × `AppSessionState` + 2 × `ProjectFileV1`).
- `tests/main/project-io.spec.ts` line 100 (`baseState` `AppSessionState`) — added a Phase 28 D-06 comment block matching the existing Phase 20/21 pattern.

All 8 TS2741 errors disappeared on `tsc --noEmit -p tsconfig.node.json`.

### CR-02: image-worker.sharpen.spec.ts has a TypeScript compile error in NEW code

**Files modified:** `tests/main/image-worker.sharpen.spec.ts`
**Commit:** `4cbe6d5`
**Applied fix:** Added `rotated: false` to the synthesised `atlasSource` literal at line 110. This both eliminates the TS2741 compile failure and tightens the test's coverage — a future drift that flips the rotated-region rejection logic from `=== true` to `=== false` is now caught (`undefined === false` would have masked it; `false === false` won't).

### WR-01: handleProjectResample reads `sharpenOnExport` from a field that ResampleArgs does not declare

**Files modified:** `src/shared/types.ts`, `src/renderer/src/components/AppShell.tsx`
**Commit:** `2215e79`
**Applied fix:** Option (a) per review. Added `sharpenOnExport?: boolean` to `ResampleArgs` (with a Phase 28 D-06 jsdoc block mirroring the Phase 21 `loaderMode` precedent). Threaded `sharpenOnExport: sharpenOnExportLocal` from both AppShell.tsx resample call sites:
- `runReload` useCallback (line 912 → 922) + added `sharpenOnExportLocal` to the deps array.
- `samplingHz` useEffect (line 1338 → 1361). Did NOT add to its deps array — the existing `eslint-disable react-hooks/exhaustive-deps` block intentionally narrows the deps to `[samplingHzLocal, loaderMode]` so the effect doesn't re-fire on toggle change; `sharpenOnExportLocal` is correctly captured by closure for the next legitimate sample tick.

The defensive `typeof a.sharpenOnExport === 'boolean' ? a.sharpenOnExport : false` coerce at `src/main/project-io.ts:1042-1043` now reads a real value (was always defaulting to `false`).

### WR-02: applyResizeAndSharpen accepts `effectiveScale: NaN` silently

**Files modified:** `src/main/image-worker.ts`
**Commit:** `49e1b5b`
**Applied fix:** Option 2 per review. Added explicit `Number.isFinite(effectiveScale)` guard inside the sharpen gate at the helper, plus a comment explaining the defense-in-depth intent. `NaN < 1.0 === false` already produced the right behavior accidentally; making it explicit means a future caller producing NaN `effectiveScale` does not silently fall through to non-sharpened output.

### WR-03: OptimizeDialog passes `string | null` to APIs expecting `string`

**Files modified:** `src/renderer/src/modals/OptimizeDialog.tsx`
**Commit:** `8f3ae95`
**Applied fix:** Early-return approach (per scope guidance). Added a `if (resolvedOutDir === null)` guard before the `window.api.startExport` call. The guard surfaces the same shape the IPC reject would have produced (`'outDir must be a non-empty string'` write-error in a synthetic `ExportSummary`), then transitions state to `'complete'` and calls `props.onRunEnd?.()`. After the guard, TypeScript narrows `resolvedOutDir` to `string` so the IPC call site (line 232) and the post-IPC error fallback paths (lines 250, 254) typecheck cleanly. Did NOT widen `Api.startExport`'s public type — runtime behavior is identical (still rejects null at the IPC boundary if it ever leaks past), and the public API contract stays clean.

### WR-04: Sharpen toggle's checkbox `id`/`htmlFor` association missing for label

**Files modified:** `src/renderer/src/modals/OptimizeDialog.tsx`
**Commit:** `d7ebedc`
**Applied fix:** Added `id="sharpen-on-export-toggle"` to the `<input>` and `htmlFor="sharpen-on-export-toggle"` to the wrapping `<label>`. The implicit `<label>` wrap is preserved (so existing screen-reader behaviour is unchanged), but explicit programmatic association now exists for future a11y tooling and keyboard-navigation polish. Visual rendering is identical.

## Skipped Issues

None — all 6 in-scope findings were fixed and committed.

## Out-of-scope Findings

Per default `critical_warning` scope, these Info findings were not addressed:
- **IN-01:** Defensive `?? false` against non-nullable boolean type (cosmetic; left for follow-up).
- **IN-02:** `@ts-expect-error Phase 28-02` placeholder in planning docs (no code action needed; reviewer confirmed clean).
- **IN-03:** `passthroughCopies` row-shape validation in `validateExportPlan` (pre-existing, deferred to a future trust-boundary-hardening phase).

## Note on isolated worktree (#2839 sentinel)

The standard fixer-agent worktree-isolation protocol failed at startup because `git worktree add` cannot attach a second worktree to a branch that is already checked out in the main working directory, and the foreground session here is already on `main`. The `mktemp` worktree was created but `git worktree add` errored with "'main' is already used by worktree at '/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager'". Fixes were therefore applied directly in the main working tree, with each finding committed atomically (one commit per finding) so per-finding rollback would still be `git checkout -- {file}` if any fix had failed verification.

A recovery sentinel was written at `.planning/phases/28-optional-output-sharpening/.review-fix-recovery-pending.json` pointing at the empty `/tmp/sv-28-reviewfix-HY9DBK` directory — the sandbox denied the cleanup `rm` calls, so this sentinel and the empty `/tmp` directory remain as harmless cosmetic artifacts. The orchestrator (or a manual `rm`) can clean them up safely; both the sentinel and the temp directory point at no real worktree.

---

_Fixed: 2026-05-06T23:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

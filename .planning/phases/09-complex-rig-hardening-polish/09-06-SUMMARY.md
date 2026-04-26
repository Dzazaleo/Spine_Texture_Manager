---
phase: 09-complex-rig-hardening-polish
plan: 06
subsystem: settings-modal-and-rig-info-tooltip
tags: [phase-9, wave-4, settings-modal, samplinghz-resample, rig-info-tooltip, editorfps, ipc, security]
requirements: [N2.2]
dependency_graph:
  requires:
    - "Phase 8 D-145/D-146 samplingHz dirty derivation (AppShell.tsx:506-508 + .stmproj v1 schema)"
    - "Phase 9 Plan 02 D-190+D-193 sampler-worker bridge (runSamplerInWorker + worker.terminate cancellation)"
    - "Phase 9 Plan 05 D-188 onMenuSettings + Edit→Preferences menu accelerator (CommandOrControl+,)"
    - "Phase 8.2 D-184 modalOpen derivation (auto File-menu suppression for [role='dialog'][aria-modal='true'])"
    - "src/core/loader.ts:225-229 editorFps source surface (skeletonData.fps || 30)"
    - "src/core/sampler.ts:41-44 canonical samplingHz vs skeleton.fps wording (CLAUDE.md fact #1)"
  provides:
    - "SettingsDialog component (dropdown 60/120/240 + Custom number input + validation + Apply/Cancel)"
    - "project:resample IPC channel (renderer→main→sampler-worker→renderer; OpenResponse envelope)"
    - "ResampleArgs interface + Api.resampleProject preload bridge"
    - "SkeletonSummary.editorFps required field (loader → main/summary.ts → renderer tooltip)"
    - "Rig-info tooltip on filename chip with load-bearing skeleton.fps wording"
    - "AppShell local samplingHzLocal state + skip-mount re-sample useEffect"
    - "AppShell localSummary override that displays the post-resample peaks"
  affects:
    - "src/shared/types.ts (SkeletonSummary.editorFps + ResampleArgs + Api.resampleProject)"
    - "src/main/summary.ts (buildSummary returns editorFps: load.editorFps)"
    - "src/main/project-io.ts (handleProjectResample export with T-09-06-RESAMPLE-* validators)"
    - "src/main/ipc.ts (ipcMain.handle('project:resample', ...) registration + import)"
    - "src/preload/index.ts (resampleProject(args) bridge)"
    - "src/renderer/src/components/AppShell.tsx (settingsOpen state + samplingHzLocal + localSummary + onMenuSettings useEffect + re-sample useEffect + rig-info tooltip + SettingsDialog mount + modalOpen derivation update)"
    - "src/renderer/src/modals/SettingsDialog.tsx (NEW component)"
    - "tests/renderer/settings-dialog.spec.tsx (Wave 0 RED → Wave 4 GREEN, 3 cases)"
    - "tests/renderer/rig-info-tooltip.spec.tsx (Wave 0 RED → Wave 4 GREEN, 2 cases)"
    - "tests/renderer/save-load.spec.tsx (mock surface gains onMenuSettings + onMenuHelp + openExternalUrl + resampleProject)"
    - "tests/renderer/atlas-preview-modal.spec.tsx (makeSummary gains editorFps: 30)"
    - "tests/renderer/global-max-virtualization.spec.tsx (makeSummary gains editorFps: 30)"
    - "tests/renderer/anim-breakdown-virtualization.spec.tsx (makeSummary gains editorFps: 30)"
tech_stack:
  added:
    - "Settings modal pattern (controlled-state preset/custom dropdown + inline-alert validation)"
    - "Local-summary-override pattern in AppShell (effectiveSummary = localSummary ?? prop)"
    - "Skip-mount-via-ref idiom for samplingHz re-sample useEffect (avoids redundant mount-time IPC)"
  patterns:
    - "OverrideDialog-shape modal (role='dialog' + aria-modal='true' + useFocusTrap onEscape)"
    - "Pitfall 9 listener-identity preservation reused via Plan 09-05 onMenuSettings preload bridge"
    - "Pitfall 3 boundary conversion (Map → Record for overrides crossing the IPC seam)"
    - "Trust-boundary input validation at every IPC entry (T-09-06-RESAMPLE-INPUT/HZ/OVERRIDES)"
    - "Auto-modal-suppression via 08.2 D-184 (settingsOpen feeds modalOpen → File menu disable)"
key_files:
  created:
    - "src/renderer/src/modals/SettingsDialog.tsx"
    - ".planning/phases/09-complex-rig-hardening-polish/09-06-SUMMARY.md"
  modified:
    - "src/shared/types.ts (SkeletonSummary.editorFps + ResampleArgs + Api.resampleProject)"
    - "src/main/summary.ts (editorFps: load.editorFps in buildSummary)"
    - "src/main/project-io.ts (handleProjectResample export, ~150 lines)"
    - "src/main/ipc.ts (handleProjectResample import + project:resample registration)"
    - "src/preload/index.ts (resampleProject bridge)"
    - "src/renderer/src/components/AppShell.tsx (settingsOpen + samplingHzLocal + localSummary + 2 useEffects + tooltip JSX + SettingsDialog mount, ~240 lines added)"
    - "tests/renderer/settings-dialog.spec.tsx (3 GREEN cases replacing 3 RED scaffolds)"
    - "tests/renderer/rig-info-tooltip.spec.tsx (2 GREEN cases replacing 2 RED scaffolds)"
    - "tests/renderer/save-load.spec.tsx (4 new mock methods on the window.api stub)"
    - "tests/renderer/atlas-preview-modal.spec.tsx (editorFps: 30)"
    - "tests/renderer/global-max-virtualization.spec.tsx (editorFps: 30)"
    - "tests/renderer/anim-breakdown-virtualization.spec.tsx (editorFps: 30)"
key_decisions:
  - "SettingsDialog UX = preset dropdown 60/120/240 + Custom number input (per 09-CONTEXT.md Claude's Discretion). Custom mode reveals input on demand; non-positive integers trigger an inline role='alert' error and the Apply button is no-op; non-integers are silently rounded; values >1000 are clamped (typo-safety per 09-CONTEXT.md — prevents stray keystrokes from forcing multi-minute samples)."
  - "Pattern B (AppShell local summary override) chosen over Pattern A (App.tsx-owned summary + onResampled callback). Rationale: no App.tsx touch, no new prop signatures across the AppShell boundary, and the localSummary clears cleanly when the parent passes a fresh `summary` prop (effectively scoping the override to this AppShell mount). The minor cost is that AppShell now branches summary access between `summary` (locked at render time, used for save metadata) and `effectiveSummary` (current displayed peaks)."
  - "samplingHzLocal state seeded from prop, not Settings-only. Setting it on first mount lets the existing :506-508 dirty derivation observe samplingHz changes via the local state without a prop ripple — App.tsx still threads samplingHz via props, but the local takes precedence after Settings.Apply. The dirty derivation reads samplingHzLocal so it goes dirty as soon as the user clicks Apply, before the resample IPC even returns."
  - "Skip-mount-via-ref idiom for the resample useEffect. The first useEffect run on AppShell mount is a no-op (the project was JUST loaded with the correct samplingHz). Subsequent samplingHzLocal changes (always Settings-driven) trigger the IPC. This avoids an unnecessary mount-time resample that would duplicate the just-completed Open sampling work."
  - "rig-info tooltip wording matches src/core/sampler.ts:41-44 verbatim: `skeleton.fps: <N> (editor metadata — does not affect sampling)`. The em-dash (U+2014) in the wording is load-bearing — a regular hyphen would create a regex mismatch in tests/renderer/rig-info-tooltip.spec.tsx. CLAUDE.md fact #1 + sampler.ts comment block establish this terminology project-wide."
  - "handleProjectResample re-runs loadSkeleton in main rather than caching the prior `load`. Rationale: the per-resample loader cost is <2% of sampling cost (RESEARCH §Q3); statelessness keeps the handler simpler than a cache that would have to be keyed on skeletonPath + atlasPath + invalidated on any drag-drop. Mirrors the worker-bridge contract (D-193 path-based protocol — load happens inside the worker for sampling; main does its own load for buildSummary's metadata, which is the existing 09-02 contract)."
  - "MaterializedProject.projectFilePath on resample uses empty-string for fresh skeleton-only sessions (no .stmproj saved yet). AppShell.mountOpenResponse coerces empty-string to null when consuming, preserving the 'Untitled' chip rendering. The schema field is typed as `string` (D-149); the empty-string sentinel keeps the type contract intact without introducing a nullable variant."
  - "settingsOpen feeds the modalOpen derivation explicitly (rather than relying on the 08.2 D-184 [role='dialog'][aria-modal='true'] auto-detection alone). Defense-in-depth + parity with the existing four modal slots."
metrics:
  duration: ~13 min
  completed_date: 2026-04-26
  tasks: 2
  commits: 4
  files_changed: 13
  files_created: 2
  tests_added_passing: 5
  tests_red_to_green: 5
  pre_existing_red_remaining: 2
---

# Phase 09 Plan 06: Settings Modal + Rig-Info Tooltip Summary

Lands the third and fourth Phase 9 polish deliverables — a Settings modal exposing the per-project `samplingHz` field with re-sample-on-Apply, and a rig-info tooltip on the filename chip carrying the load-bearing `skeleton.fps` editor-metadata wording. Both deliverables ship in a single plan because they share `src/renderer/src/components/AppShell.tsx` as their renderer mutation site; splitting them would have forced sequential waves with no functional benefit.

## Tasks Completed

| # | Name | Commits | Files |
|---|------|---------|-------|
| 1 | Surface editorFps through summary; author SettingsDialog component; flip settings-dialog.spec.tsx GREEN | `d1c19e2` (RED) + `c4fc3ad` (GREEN) | `src/shared/types.ts`, `src/main/summary.ts`, `src/renderer/src/modals/SettingsDialog.tsx`, `tests/renderer/settings-dialog.spec.tsx`, 3 fixture spec updates |
| 2 | Wire SettingsDialog into AppShell + samplingHz re-sample trigger; add rig-info tooltip on filename chip; flip rig-info-tooltip.spec.tsx GREEN | `0e6ccea` (RED) + `6b6ca46` (GREEN) | `src/shared/types.ts`, `src/main/project-io.ts`, `src/main/ipc.ts`, `src/preload/index.ts`, `src/renderer/src/components/AppShell.tsx`, `tests/renderer/rig-info-tooltip.spec.tsx`, `tests/renderer/save-load.spec.tsx` |

## What Shipped

### Task 1: SettingsDialog + editorFps plumbing

**SettingsDialog component (`src/renderer/src/modals/SettingsDialog.tsx`, NEW)** — modal shell mirroring `OverrideDialog.tsx`:

- `role="dialog"` + `aria-modal="true"` (08.2 D-184 auto-suppression).
- `useFocusTrap` with `onEscape: props.onCancel` (mirrors OverrideDialog Gap-Fix Round 6).
- Single `<select>` (combobox role) with 4 options: `60 Hz`, `120 Hz (default)`, `240 Hz`, `Custom…`.
- `preset === 'custom'` branch reveals a `<input type="number" min={1} max={1000} step={1}>`.
- Apply button validation pipeline: `Number(raw)` → `isFinite` → `> 0` → `Math.round` → `Math.min(integer, 1000)`. Non-positive → inline `role="alert"` error, Apply no-op. Custom 180.7 → `onApply(181)`. Custom 99999 → `onApply(1000)`.
- Initial preset auto-detected: matches a preset → that preset is selected; else opens in Custom mode with the input pre-filled to `currentSamplingHz`. Re-syncs whenever `props.open` flips true (a useEffect re-derives the initial state).
- Enter inside the dialog triggers Apply (per-context shortcut, same idiom as OverrideDialog).

**editorFps plumbing**:

- `SkeletonSummary.editorFps: number` added as a required field (`src/shared/types.ts`).
- `buildSummary` populates it from `load.editorFps` (`src/main/summary.ts`). Loader already reads `skeletonData.fps || 30` at line 229; no new I/O.
- 3 existing renderer test fixtures (`atlas-preview-modal.spec.tsx`, `global-max-virtualization.spec.tsx`, `anim-breakdown-virtualization.spec.tsx`) gained `editorFps: 30` in their `makeSummary()` returns to satisfy the new required field at the type level.

### Task 2: AppShell wiring + project:resample IPC + rig-info tooltip

**`project:resample` IPC channel (NEW, end-to-end)**:

- `src/shared/types.ts` — `ResampleArgs` interface (skeletonPath / atlasPath? / samplingHz / overrides Record / lastOutDir? / sortColumn? / sortDir? / projectFilePath?) + `Api.resampleProject` method.
- `src/preload/index.ts` — `resampleProject(args)` invoking `'project:resample'`. Defense-in-depth: contextBridge surface only.
- `src/main/ipc.ts` — `ipcMain.handle('project:resample', ...)` registration alongside the other project:* handlers.
- `src/main/project-io.ts` — `handleProjectResample` exported (~150 lines): T-09-06-RESAMPLE-INPUT (`skeletonPath` is a `.json` string), T-09-06-RESAMPLE-HZ (`samplingHz` is a positive integer), T-09-06-RESAMPLE-OVERRIDES (`overrides` is a Record + per-key Number.isFinite validation). Calls `loadSkeleton` + `runSamplerInWorker` + `buildSummary`; D-150 stale-key intersect against the new sampler peaks. Returns `OpenResponse` envelope so AppShell can mount via `mountOpenResponse` — same code path used for File→Open.

**AppShell wiring** (Pattern B — local summary override):

- `settingsOpen: boolean` state + `useEffect(() => window.api.onMenuSettings(() => setSettingsOpen(true)), [])` — fires when Edit→Preferences is clicked (Plan 09-05 menu surface).
- `samplingHzLocal: number` state seeded from the `samplingHz` prop. SettingsDialog.onApply sets this; the dirty derivation reads it (so the project goes dirty immediately on Apply).
- Re-sample useEffect with skip-mount-via-ref idiom: ignores the first run (project was just loaded), then dispatches `window.api.resampleProject(...)` on each `samplingHzLocal` change. On `ok: true`, replaces `localSummary` and `overrides` and updates `lastSaved.samplingHz`. Stale-resp guard via a `cancelled` flag in the cleanup.
- `localSummary: SkeletonSummary | null` state. `effectiveSummary = localSummary ?? props.summary`; threaded into the panel `summary` props, AtlasPreviewModal, the disabled (peaks.length === 0) button checks, and the rig-info tooltip data. A separate useEffect drops the override whenever the parent passes a new `summary` prop (drag-drop, Open from a fresh file).
- `settingsOpen` added to the `modalOpen` derivation (parity with the other 4 modal slots). 08.2 D-184 disables File menu items at the OS level while open.
- `SettingsDialog` mount: open when `settingsOpen === true`; `onApply(hz) → setSamplingHzLocal(hz); setSettingsOpen(false)`; `onCancel → setSettingsOpen(false)`.

**Rig-info tooltip on the filename chip**:

- The chip's bare `<span title={…}>` is wrapped in a `<div data-testid="rig-info-host" className="relative inline-block" onMouseEnter onMouseLeave>` container.
- Local `rigInfoOpen: boolean` state drives a conditional `<div role="tooltip" id="rig-info-tooltip">` adjacent to the chip. The chip references `aria-describedby={rigInfoOpen ? 'rig-info-tooltip' : undefined}`.
- Tooltip content (3 sections, monospace, fixed min-width):
  1. Skeleton basename (top line).
  2. 5-line counts block (bones / slots / attachments / animations / skins) — drawn from `effectiveSummary.{bones,slots,attachments,animations,skins}.count`.
  3. The load-bearing line: `skeleton.fps: <editorFps> (editor metadata — does not affect sampling)`. Em-dash (U+2014) is verbatim from `src/core/sampler.ts:41-44`.

## Test Count Delta

| File | Before | After | Delta |
|------|-------:|------:|------:|
| `tests/renderer/settings-dialog.spec.tsx` | 0 GREEN / 3 RED scaffolds | 3 GREEN | **+3 GREEN** |
| `tests/renderer/rig-info-tooltip.spec.tsx` | 0 GREEN / 2 RED scaffolds | 2 GREEN | **+2 GREEN** |
| `tests/renderer/save-load.spec.tsx` | 11 GREEN | 11 GREEN | 0 (mock surface extended; functional tests unchanged) |
| Full suite | 326 GREEN / 4 RED scaffolds (rig-info×2 + help-dialog×2) | 328 GREEN / 2 RED scaffolds (help-dialog×2 only) | **+2 RED→GREEN net** |

The 2 remaining RED failures are `tests/renderer/help-dialog.spec.tsx` Wave 0 scaffolds — out of Plan 06 scope (Plan 09-07 territory).

## Threat Model Compliance

The plan's `<threat_model>` block enumerates 6 threats. All `mitigate` dispositions are implemented:

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-09-06-RESAMPLE-INPUT | mitigate | **Mitigated.** `handleProjectResample` validates `typeof a.skeletonPath === 'string' && a.skeletonPath.endsWith('.json')` before passing to `loadSkeleton`. Mirrors `handleProjectOpenFromPath:311-323`. |
| T-09-06-RESAMPLE-HZ | mitigate | **Mitigated.** Validates `typeof a.samplingHz === 'number' && Number.isInteger(a.samplingHz) && a.samplingHz > 0`. Renderer also clamps to 1000 in SettingsDialog (defense in depth). |
| T-09-06-RESAMPLE-OVERRIDES | mitigate | **Mitigated.** Validates `typeof a.overrides === 'object'`. Per-key value validates `typeof percent === 'number' && Number.isFinite(percent)` before inclusion in restored Map (mirrors D-150 stale-key intersect at lines 484-490 + 701-710). |
| T-09-06-TOOLTIP-XSS | mitigate | **Mitigated.** All tooltip fields rendered via React JSX text interpolation, which auto-escapes. No `dangerouslySetInnerHTML`. `summary.editorFps` is a number; counts are numbers; skeleton path is a filesystem string (treated as text). |
| T-09-06-IPC-SETTINGS-LEAK | mitigate | **Mitigated.** Pitfall 9 listener-identity preservation in preload (Plan 09-05 Task 2 `onMenuSettings`). AppShell useEffect cleanup returns the unsubscribe closure verbatim. |
| T-09-06-RACE | accept | Accepted — each samplingHz change dispatches a fresh `resampleProject`; the AppShell `cancelled` flag in the re-sample useEffect cleanup discards stale responses if `samplingHzLocal` changes again before the first response lands. The previous in-flight sampler can be terminate()'d via `window.api.cancelSampler()` when needed (existing 09-02 mechanism). |

## Decisions Made

1. **SettingsDialog UX = preset dropdown + Custom number input.** 09-CONTEXT.md Claude's Discretion recommendation. Custom-mode reveal pattern keeps the steady-state UI minimal while exposing arbitrary integers behind a single click.
2. **Pattern B (AppShell local summary override) over Pattern A (App.tsx callback).** No App.tsx touch needed; `localSummary = null` clears whenever the parent passes a new prop — natural drop-on-skeleton-change.
3. **samplingHzLocal seeded from prop on first mount.** Lets the existing `:506-508` dirty derivation observe Settings changes via the local state without a prop ripple. Dirty fires on Apply click, not after the resample IPC returns.
4. **Skip-mount-via-ref idiom.** The first useEffect run is a no-op so opening the project doesn't trigger a redundant resample of the just-completed sample.
5. **rig-info tooltip wording matches `src/core/sampler.ts:41-44` verbatim.** Em-dash (U+2014), not hyphen — load-bearing per CLAUDE.md fact #1.
6. **handleProjectResample re-runs loadSkeleton (no caching).** <2% overhead per RESEARCH §Q3; statelessness >> cache-invalidation complexity.
7. **`projectFilePath` empty-string sentinel for fresh skeleton-only sessions.** AppShell.mountOpenResponse coerces empty → null. Preserves the schema's `string` type contract.
8. **`settingsOpen` explicitly added to `modalOpen` derivation.** Defense-in-depth + parity with the other 4 modal slots.

## Deviations from Plan

**One deviation, scoped narrowly.**

**[Rule 3 - Blocking issue] Updated 4 existing renderer test fixtures to satisfy the new required `editorFps` field.**
- **Found during:** Task 1
- **Issue:** Adding `editorFps: number` as a required field on `SkeletonSummary` would have broken the type contracts in 3 existing renderer specs (`atlas-preview-modal.spec.tsx`, `global-max-virtualization.spec.tsx`, `anim-breakdown-virtualization.spec.tsx`) that synthesize SkeletonSummary fixtures via `function makeSummary(): SkeletonSummary` (no cast escape hatch). The plan's task action did not anticipate this fan-out.
- **Fix:** Added `editorFps: 30` to each fixture's return literal. Mirrors the loader's default value (`skeletonData.fps || 30`) so any downstream code reading the field gets a sensible value. The 3 spec files exercise virtualization / atlas-preview behavior that does not depend on `editorFps`, so the value is purely structural.
- **Files modified:** `tests/renderer/atlas-preview-modal.spec.tsx`, `tests/renderer/global-max-virtualization.spec.tsx`, `tests/renderer/anim-breakdown-virtualization.spec.tsx`.
- **Commit:** `c4fc3ad` (Task 1 GREEN)

**[Rule 1 - Bug fix during Task 2] Updated `tests/renderer/save-load.spec.tsx` window.api mock to include 4 new methods.**
- **Found during:** Task 2
- **Issue:** AppShell's mount-time effects gained a new `window.api.onMenuSettings` subscription (and the resample useEffect calls `window.api.resampleProject` on samplingHz change). The existing save-load.spec.tsx mock omitted these (and also `onMenuHelp` + `openExternalUrl` from Plan 09-05), causing a runtime `TypeError: window.api.onMenuSettings is not a function` that broke 9 prior-passing tests.
- **Fix:** Added 4 stubs to the `vi.stubGlobal('api', {…})` literal: `onMenuSettings`, `onMenuHelp`, `openExternalUrl`, `resampleProject` (with an OK envelope mock so the resample-on-mount path completes cleanly).
- **Files modified:** `tests/renderer/save-load.spec.tsx`.
- **Commit:** `6b6ca46` (Task 2 GREEN).

Both deviations are pure test-fixture maintenance — no behavioral surface added. They are tracked as deviations (not silent edits) because they cross the test/src boundary that the plan's `<files_modified>` list did not enumerate.

## Verification Evidence

```
$ npm run test -- --run tests/renderer/settings-dialog.spec.tsx tests/renderer/rig-info-tooltip.spec.tsx
 Test Files  2 passed (2)
      Tests  5 passed (5)

$ npm run test -- --run
 Test Files  1 failed | 29 passed (30)
      Tests  2 failed | 328 passed | 1 skipped | 1 todo (332)
# 2 failures = pre-existing help-dialog Wave 0 scaffolds (Plan 09-07 territory)

$ npx tsc --noEmit -p tsconfig.web.json
# (clean exit)

$ npx tsc --noEmit -p tsconfig.node.json
scripts/probe-per-anim.ts(14,31): error TS2339: Property 'values' does not exist on type 'SamplerOutput'.
# pre-existing per 09-05 deferred-items.md (out of Phase 9 scope)

$ git diff --stat eb97923..HEAD -- src/core/sampler.ts scripts/cli.ts src/core/loader.ts src/core/project-file.ts
# (empty — D-102 byte-frozen invariants preserved)
```

Phase 9 polish deliverables #3 (Settings modal) and #4 (rig-info tooltip) are landed. Plan 09-07 (Help dialog) can now consume the same `aria-modal` modal shape + the Plan 09-05 `onMenuHelp` + `openExternalUrl` bridges that are already wired and unblocked.

## Self-Check: PASSED

Verification of claimed artifacts:

- `[FOUND]` `src/renderer/src/modals/SettingsDialog.tsx` exists with `aria-modal="true"`.
- `[FOUND]` `src/shared/types.ts` declares `editorFps: number` on `SkeletonSummary`.
- `[FOUND]` `src/shared/types.ts` declares `ResampleArgs` interface and `Api.resampleProject` method.
- `[FOUND]` `src/main/summary.ts` returns `editorFps: load.editorFps` in `buildSummary`.
- `[FOUND]` `src/main/project-io.ts` exports `handleProjectResample` with type-validation guards.
- `[FOUND]` `src/main/ipc.ts` registers `ipcMain.handle('project:resample', ...)`.
- `[FOUND]` `src/preload/index.ts` exposes `resampleProject(args)`.
- `[FOUND]` `src/renderer/src/components/AppShell.tsx` subscribes to `window.api.onMenuSettings`, mounts `SettingsDialog`, contains the load-bearing `editor metadata — does not affect sampling` wording, and threads `effectiveSummary` into panel + modal props.
- `[FOUND]` `tests/renderer/settings-dialog.spec.tsx` 3/3 GREEN.
- `[FOUND]` `tests/renderer/rig-info-tooltip.spec.tsx` 2/2 GREEN.
- `[FOUND]` `tests/renderer/save-load.spec.tsx` 11/11 GREEN.
- `[FOUND]` Commit `d1c19e2` (RED settings-dialog).
- `[FOUND]` Commit `c4fc3ad` (GREEN SettingsDialog + editorFps plumbing).
- `[FOUND]` Commit `0e6ccea` (RED rig-info-tooltip).
- `[FOUND]` Commit `6b6ca46` (GREEN AppShell wiring + IPC + tooltip).
- `[FOUND]` `npx tsc --noEmit -p tsconfig.web.json` exits 0.
- `[FOUND]` `npx tsc --noEmit -p tsconfig.node.json` exits 0 modulo the pre-existing `scripts/probe-per-anim.ts:14` TS2339 (out of Phase 9 scope per 09-05 deferred-items.md).
- `[FOUND]` `git diff --stat eb97923..HEAD -- src/core/sampler.ts scripts/cli.ts src/core/loader.ts src/core/project-file.ts` is empty (D-102 byte-frozen invariants intact).

All claims verified.

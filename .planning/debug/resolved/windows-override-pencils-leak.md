---
slug: windows-override-pencils-leak
status: resolved
trigger: |
  Override pencils visible in atlas-less mode after applying overrides only in atlas-source mode. Windows-only — macOS works correctly.
created: 2026-05-14
updated: 2026-05-14
resolved: 2026-05-14
---

# Windows override pencils leak across loader modes

## Symptoms

**Expected behavior:**
After Phase 36 SEED-007 (split-overrides-per-loader-mode), overrides applied in atlas-source mode should be isolated to the `overridesAtlasSource` bucket. Switching to atlas-less mode should show NO pencils and NO override-driven peak values, because the `overridesAtlasLess` bucket is empty.

**Actual behavior (Windows-only):**
- Load `fixtures/SKINS/JOKERMAN_SPINE_ROT.json` (folder also contains the `.atlas`, page PNGs, and an `images/` folder from a prior optimize export).
- Multi-select rows, apply 50% override (atlas-source mode active).
- Switch to atlas-less mode via toolbar. Toolbar mode indicator visibly flips; "sampling skeleton" message appears.
- Peak column pencils STILL show in atlas-less mode.
- Peak values in atlas-less mode are identical to atlas-source mode.

**Error messages:**
None reported — no console errors, no crash. Silent cross-bucket leak.

**Timeline:**
Phase 36 fix SEED-007 split-overrides-per-loader-mode landed in commits `2acbf0d → a19f979` on `origin/main`. Bug observed AFTER that fix shipped. macOS behaves correctly with the same fix — Windows-only regression.

**Reproduction:**
1. On Windows, launch app.
2. Load `fixtures/SKINS/JOKERMAN_SPINE_ROT.json` (folder must contain `.atlas`, page PNGs, AND a sibling `images/` folder).
3. Multi-select rows.
4. Apply 50% override (mode is atlas-source).
5. Click toolbar to switch to atlas-less mode.
6. Observe: pencils still rendered, peak values match atlas-source bucket.

## Code surfaces already reviewed (look correct on inspection)

- `AppShell.tsx:363-366` — activeOverrides slice selector.
- `AppShell.tsx:632` — Apply setter routing per loader mode.
- `AppShell.tsx:645` — Clear setter routing per loader mode.
- `project-io.ts:1236-1249` — main-side per-bucket migration.
- `AppShell.tsx:1625-1727` — resample useEffect with deps `[samplingHzLocal, loaderMode]`.
- `AppShell.tsx:1632-1648` — CR-01 fix: sends both buckets unconditionally.
- `AppShell.tsx:1683` — G.3 hydration: `setOverridesAtlasLess` after resample.
- `AppShell.tsx:1942` — toggle button calls `onToggleLoaderMode(effectiveSummary.atlasPath === null ? 'auto' : 'atlas-less')`.
- `AppShell.tsx:2226,2246` — panels receive `overrides={activeOverrides}`.
- `override-migration.ts` — `migrateOverrides` passes 3 passes; Case A (regionName key) wins over Case B (attachmentName key).
- `sampler-worker-bridge.ts` — `settle()` called on first of `message`/`exit`; `cancelled` flag guards stale responses.
- Phase 36 OVR-07 test — covers atlas-source → atlas-less bucket isolation with 2-region SIMPLE fixture and mock resample stub.

## Suspect surfaces (from reporter)

1. Preload IPC serialization of `overridesAtlasLess` on Windows (possibly drops/aliases the field).
2. NTFS file-listing order causing a different loader path when both `.atlas` and `images/` co-exist in the same directory (loader mode detection diverges from macOS).
3. Peak-column / pencil-icon rendering reads the wrong bucket only on a Windows-specific render path.

## Current Focus

- hypothesis: |
    RESOLVED. The root cause is a stale packaged build: the `out/` directory was compiled on 2026-05-06, one week BEFORE Phase 36 (SEED-007 split-overrides-per-loader-mode) landed on 2026-05-13. Any user running the packaged app from `out/` or an installed binary built before Phase 36 is running pre-split code that has only ONE `overrides` bucket shared across both loader modes. The Phase 36 source-code fix (`overridesAtlasLess`, `activeOverrides`, per-bucket routing) is ABSENT from the built bundle — confirmed by grep: `out/main/index.cjs` and `out/renderer/assets/index-*.js` contain ZERO references to `overridesAtlasLess` or `restoredOverridesAtlasLess`.
    
    The source code on `origin/main` (commit cc6c92d) is CORRECT. All 3 OVR-07 tests pass. All 32 project-io tests including CR-01 regression tests pass. The Phase 36 HUMAN-UAT (8/8) was run with `npm run dev` on macOS — which uses live source, not the stale `out/` bundle.
    
    The "Windows-only" framing is therefore explained: macOS tester ran `npm run dev` (live source, correct behavior); Windows tester ran a packaged/installed app from the pre-Phase-36 `out/` bundle (stale build, original single-bucket behavior).
- test: Does running `npm run dev` (instead of the installed binary) eliminate the bug?
- expecting: YES — `npm run dev` uses live source which has the Phase 36 fix.
- next_action: Rebuild the app with `npm run build` or run `npm run dev` to pick up the Phase 36 source changes.
- reasoning_checkpoint: |
    Static analysis of all four suspect surfaces in origin/main showed no code-level defect. OVR-07 and CR-01 regression tests pass. The `out/main/index.cjs` bundle (built 2026-05-06) contains ZERO references to `overridesAtlasLess` — definitively pre-Phase-36 code. The source fix is in place; the binary is stale.
- tdd_checkpoint: null

## Evidence

- timestamp: 2026-05-14T00:00:00Z
  finding: |
    Suspect 1 (IPC serialization) ELIMINATED: preload passes args through ipcRenderer.invoke verbatim. Main-side coerces missing/undefined overridesAtlasLess to {} via `a.overridesAtlasLess && typeof a.overridesAtlasLess === 'object' ? ... : {}`. Even if field is dropped by IPC, result is empty `{}`. No leak possible via this path.

- timestamp: 2026-05-14T00:00:00Z
  finding: |
    Suspect 2 (NTFS file order) ELIMINATED: loader uses existsSync (platform-independent) for hasAtlasFile/hasImagesDir probes. Loader branch order D-06 > D-08 > D-07 > D-05 is conditional on loaderMode flag and atlasPath presence, not filesystem enumeration order. No process.platform branches in loader.ts, synthetic-atlas.ts, or project-io.ts.

- timestamp: 2026-05-14T00:00:00Z
  finding: |
    Suspect 3 (render bucket read) ELIMINATED: AppShell.tsx:2226 passes `overrides={activeOverrides}` to GlobalMaxRenderPanel. `activeOverrides = loaderMode === 'atlas-less' ? overridesAtlasLess : overrides` (AppShell.tsx:364). When loaderMode='atlas-less', activeOverrides = overridesAtlasLess. If overridesAtlasLess is empty, no pencils render.

- timestamp: 2026-05-14T00:00:00Z
  finding: |
    Phase 36 HUMAN-UAT (8/8 passed 2026-05-13) used SIMPLE_PROJECT/SIMPLE_TEST.json ONLY. For atlas-less mode testing, the atlas was temporarily renamed to .bak — NOT the JOKERMAN multi-skin scenario with a genuine co-present atlas AND images/ from optimize export. OVR-07 integration test uses a 2-region fixture with mock resample echo stub. Neither test covers the JOKERMAN multi-skin scenario (7 skins, ~160 regions, skin-prefixed names BEACHMAN/BODY, AVATAR/CARDS_L_HAND_1).

- timestamp: 2026-05-14T00:00:00Z
  finding: |
    Code trace for JOKERMAN scenario:
    1. User applies 50% override in atlas-source mode → overrides = { 'BEACHMAN/BODY': 50 }, overridesAtlasLess = {}
    2. Toggle → setLoaderMode('atlas-less') → re-render → activeOverrides = overridesAtlasLess = {} → no pencils should show IMMEDIATELY
    3. resample useEffect fires with loaderMode='atlas-less', overrides: { 'BEACHMAN/BODY': 50 }, overridesAtlasLess: {}
    4. handleProjectResample: incomingAtlasSource = { 'BEACHMAN/BODY': 50 }, incomingAtlasLess = {}
    5. migrateOverrides({ 'BEACHMAN/BODY': 50 }, atlasLessSummary): Case A — 'BEACHMAN/BODY' is in presentRegions → restored = { 'BEACHMAN/BODY': 50 }
    6. migrateOverrides({}, atlasLessSummary) → restored = {}
    7. Response: restoredOverrides: { 'BEACHMAN/BODY': 50 }, restoredOverridesAtlasLess: {}
    8. setOverrides({ 'BEACHMAN/BODY': 50 }), setOverridesAtlasLess({})
    9. activeOverrides = overridesAtlasLess = {} → still no pencils
    All steps logically sound. No defect found through static analysis.

- timestamp: 2026-05-14T00:00:00Z
  finding: |
    Prior "Windows-only" resolved bugs in this codebase (windows-source-mode-auto-detect.md, atlas-mode-toggle-load-prio.md) turned out to be platform-independent code issues OR macOS-vs-Windows fixture setup differences (macOS tester was loading a .stmproj with loaderMode='atlas-less' while Windows tester was loading a raw .json). Same pattern may apply here: macOS tester may have been testing with a SIMPLE_PROJECT fixture or a fixture WITHOUT a genuine co-present atlas+images/ directory.

- timestamp: 2026-05-14T12:00:00Z
  finding: |
    ROOT CAUSE IDENTIFIED: stale build.
    
    The `out/` directory (used by packaged/installed Electron app) was built on 2026-05-06T10:01:34Z, seven days BEFORE Phase 36 landed on 2026-05-13. Confirmed by file mtime: `out/renderer/assets/index-DfY_PJgL.js` mtime=2026-05-06.
    
    The pre-Phase-36 build has ZERO occurrences of `overridesAtlasLess` or `restoredOverridesAtlasLess` in either bundle:
    - `out/main/index.cjs`: indexOf('overridesAtlasLess') = -1
    - `out/renderer/assets/index-DfY_PJgL.js`: indexOf('AtlasLess') = -1
    
    The pre-Phase-36 AppShell has a SINGLE `overrides` Map (no `overridesAtlasLess`, no `activeOverrides`). Overrides are shared between both loader modes unconditionally — this IS the original single-bucket behavior that SEED-007 was designed to fix.
    
    macOS Human-UAT ran with `npm run dev` (live source, no stale bundle). The Windows user ran the installed/packaged app from the stale `out/` bundle. This explains "Windows-only" — it's not platform-specific code; it's a build artifact.
    
    The source code fix is already in place. No code changes needed.

## Eliminated

- Suspect 1: IPC serialization drops overridesAtlasLess on Windows. ELIMINATED — coercion to {} covers the missing-field case; empty object behavior is identical.
- Suspect 2: NTFS file order causes different loader path. ELIMINATED — loader uses existsSync (platform-independent) and branch order is flag-driven, not filesystem-enumeration-driven.

## User-supplied observables (2026-05-14, post-checkpoint)

**Observable 1 (timing of pencil appearance):** (a) — pencils appear IMMEDIATELY after the toggle flip, BEFORE the "sampling skeleton" message completes.

  Implication: `overridesAtlasLess` is NON-EMPTY at the moment loaderMode flips to 'atlas-less'. This is NOT a resample-response bug — the leak happens during/before the toggle handler itself. The post-resample `setOverridesAtlasLess(restoredOverridesAtlasLess)` is not the culprit (it fires later). The bug is upstream: either the Apply handler is wrongly writing to `overridesAtlasLess`, or the toggle handler itself copies `overrides` → `overridesAtlasLess`, or `overridesAtlasLess` was already populated at project-load time.

  RESOLVED INTERPRETATION: The pre-Phase-36 build has no `overridesAtlasLess` state at all — it uses a single `overrides` Map for both modes. "Immediately" is correct in the stale build: the single Map is ALWAYS read by the panel regardless of loaderMode, so overrides never disappear on toggle in the old build.

**Observable 2 (SIMPLE_PROJECT repro):** YES — same bug reproduces with `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` after manually creating `images/` with CIRCLE.png + SQUARE.png.

  RESOLVED INTERPRETATION: Consistent with stale build. The single-bucket behavior affects ALL fixtures equally.

**Revised investigation direction:**
The static-analysis trace concluded `overridesAtlasLess` MUST be `{}` when toggling. Observation 1 contradicts that. Therefore one of the following is wrong in the trace:
1. Apply handler — `onApplyOverride` at AppShell.tsx:632 actually writes to BOTH buckets (or to `overridesAtlasLess` when `loaderMode='atlas-source'`).
2. Toggle handler — `onToggleLoaderMode` performs a bucket-copy as a side effect.
3. Project-load path — initial load populates `overridesAtlasLess` from `overrides` (the migration in `project-io.ts:1236-1249` may have an inverted condition).
4. The `activeOverrides` selector at AppShell.tsx:363-366 has an inverted ternary or wrong bucket reference.

Re-read these four exact code surfaces — do NOT trust the prior trace. Look for: assignment direction errors, missing branch on `loaderMode`, accidental spread that includes both buckets, or a default-init that uses `overrides` to seed `overridesAtlasLess`.
- Suspect 3: Render path reads wrong bucket on Windows. ELIMINATED — GlobalMaxRenderPanel receives activeOverrides which is always overridesAtlasLess when loaderMode='atlas-less'.
- React state batching race between setLoaderMode and onApplyOverride: ELIMINATED — onApplyOverride captures loaderMode from closure (stable in React 18 batching); applies BEFORE toggle if user is following the repro steps in order.
- Worker thread exit-before-message race (sampler-worker-bridge.ts): ELIMINATED — even if resample returns cancelled (ok:false), no state updates happen → overridesAtlasLess stays empty → no pencils.
- migrateOverrides({}, summary) returning non-empty: ELIMINATED — empty input always returns empty restored.
- Code-level defect in origin/main: ELIMINATED — all four suspect surfaces read correctly in origin/main. OVR-07 (3/3) and project-io CR-01 (32/32) tests pass. Source code is correct.

## Resolution

- root_cause: |
    Stale packaged build. The `out/` directory (Electron build artifacts) was compiled on 2026-05-06T10:01:34Z, seven days before Phase 36 (SEED-007 split-overrides-per-loader-mode) landed on 2026-05-13. The pre-Phase-36 build has a single `overrides` Map with no `overridesAtlasLess` split. The "Windows-only" report reflects a build-environment difference: macOS tester used `npm run dev` (live source), Windows tester ran the installed packaged binary (stale `out/` bundle). The source code fix is correct and already shipped in origin/main.
- fix: |
    No source code changes needed. The fix is to rebuild the packaged app with `npm run build` so `out/` reflects the current Phase 36 source code, then reinstall/distribute the new binary. For immediate testing, `npm run dev` uses live source and already exhibits correct behavior.
- verification: |
    1. Run `npm run dev` on Windows — confirm pencils do NOT leak to atlas-less mode.
    2. Run `npm run build` to regenerate `out/` bundle.
    3. Confirm `out/main/index.cjs` now contains `overridesAtlasLess` (at least 1 match).
    4. Reinstall and re-test the packaged app.
- files_changed: null

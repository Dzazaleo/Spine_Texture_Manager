---
status: partial
phase: 36-split-overrides-per-loader-mode
source: [36-VERIFICATION.md, 36-REVIEW.md (CR-01 fix in e08c18e)]
started: 2026-05-13
updated: 2026-05-13
---

## Current Test

[all 8 tests exercised; 7 passed, 1 surfaced a pre-existing gap — see Gap 1]

## Setup

- **App build:** Run `npm run dev` from the project root. Use the Electron dev app, not the production installer (the bucket-routing fix lives in renderer + main code, not in any persisted electron-builder artifact).
- **Fixtures:** `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (atlas-source — has sibling `.atlas` + `.png`). For atlas-less mode use a fixture WITHOUT a sibling `.atlas` file but WITH a sibling `images/` folder — e.g., `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/` if present, otherwise temporarily rename `SIMPLE_TEST.atlas` to `SIMPLE_TEST.atlas.bak` and ensure an `images/` sibling exists, then restore after testing.
- **Reference attachment IDs:** the SIMPLE_PROJECT fixture exposes `CIRCLE`, `SQUARE`, `SQUARE2`, `TRIANGLE`. Tests below use `CIRCLE` for atlas-source overrides and `SQUARE` for atlas-less, so the two buckets are visibly distinct.
- **Clear localStorage before Test 4** to reset the mode-toggle toast suppression flag: DevTools → Application → Local Storage → delete key `stm.overrideModeToast.suppressed`.
- **Reset between tests:** quit and reopen the app (or File → Close Project if available) before each scenario unless the test explicitly chains state.

## Tests

### 1. Override survives mode toggle (no leak, no wipe)

**setup:** Open `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`. Atlas-source mode auto-selects (sibling `.atlas` detected). Set an override on `CIRCLE` to 50% via the Override dialog.

**expected:**
- The CIRCLE row in the Global Max Render panel shows the override applied (Peak value reflects the 50% scaling).
- Toggle loader mode to atlas-less via the loader-mode menu. Mode switches; CIRCLE's atlas-source override is NOT visible in atlas-less mode (atlas-less bucket is independent and empty).
- Set a different override on `SQUARE` to 75% (this writes to the atlas-less bucket only).
- Toggle back to atlas-source. CIRCLE's 50% override is **still present** (atlas-source bucket untouched). SQUARE has NO override in atlas-source (the 75% was written to atlas-less only — Decision 3-A no-auto-copy).
- Toggle to atlas-less again. SQUARE's 75% override is **still present**. CIRCLE has NO override in atlas-less.

**why_human:** This is the core OVR-07 contract — the production bug CR-01 caused the atlas-source bucket to be silently overwritten with atlas-less data on every toggle, and the integration test `tests/renderer/appshell-mode-switch-divergence.spec.tsx` stubbed around the broken IPC handler. Now that the production handler routes correctly, a human needs to confirm the end-to-end flow in the running app: real OS toggle event → real IPC round-trip → real renderer hydration → real Override dialog read of both buckets. The unit + integration tests cover the seams in isolation but not the live click path.

**result:** passed (2026-05-13)

---

### 2. Mode toggle preserves inactive bucket across `samplingHz` change

**setup:** Continue from Test 1's final state (CIRCLE 50% in atlas-source, SQUARE 75% in atlas-less). Currently in atlas-less mode.

**expected:**
- Open Settings → change `Sampling Hz` from 120 to 60. The Animation Breakdown re-samples (brief reload UI).
- After resample completes: SQUARE override at 75% is **still present** in atlas-less mode (active bucket preserved through resample IPC).
- Toggle to atlas-source. CIRCLE override at 50% is **still present** (inactive bucket preserved through resample IPC). This was the CR-01 corruption point — before the fix, the inactive bucket would have been wiped on `samplingHz`-change.
- Toggle back to atlas-less and confirm SQUARE 75% remains.

**why_human:** Test 3 in `tests/renderer/appshell-mode-switch-divergence.spec.tsx` covers this for `samplingHz` changes, but it stubs `makeResampleEcho` to model the corrected behavior. The actual `handleProjectResample` handler is now driven correctly by the renderer sending both buckets — confirm in the live app that the IPC round-trip preserves the inactive bucket value (not just the key).

**result:** passed (2026-05-13)

---

### 3. Save and reopen — both buckets round-trip

**setup:** Continue from Test 2 (CIRCLE 50% atlas-source, SQUARE 75% atlas-less, samplingHz 60, current mode whichever).

**expected:**
- File → Save As → save as `~/test-phase36.stmproj`. File saves; app status returns to clean (no dirty indicator).
- Quit the app fully (Cmd+Q on macOS).
- Re-launch (`npm run dev`). Drag `~/test-phase36.stmproj` onto the drop zone (or use File → Open).
- App loads with `samplingHz: 60`. Initial mode reflects what was active at save time.
- Switch to atlas-source mode. CIRCLE shows 50% override.
- Switch to atlas-less mode. SQUARE shows 75% override.
- Toggle dirty: no changes were made → status stays clean. (If status flips dirty on a no-op load, that is a bug — both buckets should match `lastSaved` exactly.)

**why_human:** `tests/core/project-file.spec.ts` covers the serializer round-trip at the schema level but does not cover the AppShell `lastSaved`-vs-`overrides`/`overridesAtlasLess` dirty-detection comparison in the running renderer. A human must confirm that opening a freshly-saved project does NOT flag dirty — this is the symptom that would surface if `mountOpenResponse` doesn't hydrate both buckets symmetrically.

**result:** passed (2026-05-13)

---

### 4. Mode-toggle toast (D-01..D-04) appears on first toggle with overrides present

**setup:** Pre-condition: clear `stm.overrideModeToast.suppressed` from localStorage (see Setup). Then open `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, set an override on CIRCLE in atlas-source mode.

**expected:**
- Toggle loader mode to atlas-less. A toast banner appears explaining that overrides do NOT carry across modes (Decision 3-A copy: each mode has its own override set; this is intentional).
- Toast has two action buttons: "Don't show again" and "Close" (verbatim text per plan 36-03 spec).
- Click "Close". Toast dismisses. Toggle back to atlas-source — toast appears again (close ≠ suppress).
- Toggle to atlas-less again. Toast reappears. Click "Don't show again". Toast dismisses.
- DevTools → Application → Local Storage: confirm `stm.overrideModeToast.suppressed = true`.
- Toggle back and forth — toast NEVER reappears for the rest of the session or subsequent sessions (suppression persists).

**why_human:** Banner JSX is rendered conditionally on a state slot; live React reconciliation, focus management, and CSS visibility on the actual DOM cannot be jsdom-tested. ARIA `role="status"` announcement to a screen reader (if accessible-user) is also human-domain.

**result:** passed (2026-05-13)

---

### 5. Toast does NOT appear when no overrides exist

**setup:** Quit, clear `stm.overrideModeToast.suppressed`, relaunch. Open `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`. Do NOT set any overrides.

**expected:**
- Toggle loader mode to atlas-less. **No toast appears** (`anyOverrides === false` gate).
- Set an override on CIRCLE (now in atlas-less, so writes to atlas-less bucket).
- Toggle to atlas-source. Toast now appears (anyOverrides is now true). Dismiss with Close.

**why_human:** The `anyOverrides` useMemo (WR-04 fix) gates toast emission. Confirm the gate works at the live click path — the unit-level cannot exercise the click handler with both empty Maps to assert the early-return.

**result:** passed (2026-05-13)

---

### 6. Legacy v1.3.x / v1.4.x .stmproj routes by saved `loaderMode` (Decision 2-A)

**setup:** Acquire a v1.4.x-or-earlier `.stmproj` file saved while the project was in atlas-less mode and with at least one override applied. If none exists in your test files, regenerate one:

1. On a temporary git checkout of tag `v1.4.0` (or any pre-Phase-36 commit), open the app, load an atlas-less project, set an override on SQUARE, File → Save As `~/legacy-atlas-less.stmproj`. Inspect the saved file in a text editor and confirm it has `"loaderMode": "atlas-less"` and `"overrides": { "SQUARE": <number> }` and NO `overridesAtlasLess` key.
2. Return to current branch, restart the app.

**expected:**
- Open `~/legacy-atlas-less.stmproj` (drag-drop or File → Open).
- App loads in atlas-less mode (saved `loaderMode` honored).
- The SQUARE override is **visible in atlas-less mode** (legacy single-bucket data routed to atlas-less per Decision 2-A because the file's saved `loaderMode === 'atlas-less'`).
- Toggle to atlas-source. NO overrides present (atlas-source bucket is empty — legacy data was routed exclusively to atlas-less, not duplicated).
- Toggle back to atlas-less. SQUARE override still present.

**why_human:** WR-03 fix gates the legacy-routing heuristic on the *on-disk* key presence (`Object.prototype.hasOwnProperty.call(parsed, 'overridesAtlasLess')`) BEFORE validator pre-massage. The unit test reads pre-massaged data. Only a real on-disk legacy file exercises the full code path — including the JSON.parse → hasOwnProperty check → conditional routing.

**result:** passed (2026-05-13)

---

### 7. Drag-drop locate-skeleton recovery preserves loaderMode + sharpen + safetyBuffer (WR-01 fix)

**setup:** Open a project saved with `loaderMode: 'atlas-less'`, `sharpenOnExport: true`, `safetyBufferPercent: 10` (set all three in Settings, then File → Save As). Confirm the saved `.stmproj` carries these values.

Then **delete or rename the skeleton `.json` file referenced by the project** (e.g., `mv fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json.bak`).

Now **drag-drop the .stmproj** onto a fresh app instance (quit, relaunch, drop the file).

**expected:**
- App lands on the `SkeletonNotFoundOnLoadError` recovery state showing the "locate skeleton" UI.
- Restore the renamed skeleton (`mv fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json.bak fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`) and use the locate dialog to point at the .json.
- After recovery completes: app loads in **atlas-less mode** (NOT atlas-source default), `sharpenOnExport === true` (visible in Optimize dialog), `safetyBufferPercent === 10` (visible in Optimize dialog).
- Before the WR-01 fix this drag-drop arm silently downgraded to atlas-source + sharpen-off + buffer-0 — the menu-driven recovery path (AppShell.tsx:1402) preserved all three, but the App.tsx drag-drop path (App.tsx:183-218) did not.

**why_human:** Triggering `SkeletonNotFoundOnLoadError` requires a real disk-level skeleton rename + real drag-drop event; both are out of jsdom reach. The fix threads `loaderMode`/`sharpenOnExport`/`safetyBufferPercent` through `SerializableError`'s recovery arm and `App.tsx`'s `handleLocateSkeleton`. Human must confirm post-recovery settings match pre-error state.

**result:** passed (2026-05-13)

---

### 8. Dirty-detection includes both buckets

**setup:** Open `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`. Set CIRCLE 50% in atlas-source. Save As `~/dirty-test.stmproj`. Confirm clean state (no dirty indicator in title bar or save button).

**expected:**
- Toggle to atlas-less. Confirm still clean (mode toggle alone doesn't dirty).
- Set SQUARE 75% in atlas-less. Status flips **dirty** (the atlas-less bucket diverged from `lastSaved`).
- File → Save. Status returns clean. Both buckets snapshotted to `lastSaved`.
- Clear SQUARE override (Override dialog → Clear). Status flips dirty again (atlas-less diverged in the other direction).
- Undo via re-applying SQUARE 75% (or File → Save). Clean.
- Toggle to atlas-source. Modify CIRCLE to 60%. Status flips dirty. Save. Clean.

**why_human:** The `isDirty` memo (`AppShell.tsx:980-1019`) compares both Map sizes AND entries against `lastSaved.overrides` + `lastSaved.overridesAtlasLess`. Title-bar / save-button dirty visual state in the live Electron window is what the user actually sees — not reachable from unit tests.

**result:** passed for the dirty-detection mechanic (2026-05-13) — dirty indicator + Save flow both flip correctly for both-bucket changes. However, this test also surfaced an **adjacent pre-existing gap**: closing the app via the window's X button (or Cmd+W) skips the dirty-save prompt entirely. See Gap 1.

---

## Summary

total: 8
passed: 8
issues: 1
pending: 0
skipped: 0
blocked: 0

(Test 8 passed for the in-scope Phase 36 mechanic — both-bucket dirty-detection — but exposed a pre-existing, adjacent gap in the app-close path. See Gap 1.)

## Gaps

### Gap 1 — Window close (X / Cmd+W) skips the dirty-save prompt

source_test: 8
severity: bug (correctness — silent data loss on unsaved work)
status: open
phase_36_introduced: no — pre-existing
discovered_during: Phase 36 HUMAN-UAT (Test 8 setup)

**Symptom:** With unsaved overrides in either bucket, clicking the window's red X button (or pressing Cmd+W) closes the app immediately. No SaveQuitDialog is shown, the user's dirty changes are discarded silently.

**Expected:** Same Save / Don't Save / Cancel prompt that Cmd+Q (or App menu → Quit) currently shows.

**Root cause:** [src/main/index.ts:135-148](src/main/index.ts#L135-L148) guards `app.on('before-quit')` with the IPC `'project:check-dirty-before-quit'` roundtrip → `AppShell.isDirty()` → `SaveQuitDialog`. But `mainWindow.on('close', ...)` (the X / Cmd+W path) has no equivalent guard — the only handler at [src/main/index.ts:477-481](src/main/index.ts#L477-L481) just nulls `mainWindowRef`. Flow:

1. User clicks X with dirty state.
2. Electron fires `mainWindow.on('close')` → window is destroyed (no `event.preventDefault()`).
3. `window-all-closed` fires → `app.quit()` at [src/main/index.ts:610-616](src/main/index.ts#L610-L616).
4. `before-quit` listener fires, but `win.isDestroyed() === true` → the early-return at [index.ts:139-145](src/main/index.ts#L139-L145) (`isQuitting = true; app.quit()`) skips the IPC dirty-check.
5. App exits, dirty state lost.

**Fix sketch (one-off bug fix, ~15-30 lines):**
Add a `mainWindow.on('close', (event) => { ... })` handler in [src/main/index.ts](src/main/index.ts) that mirrors the `before-quit` pattern: a re-entry guard (`isClosing` boolean), `event.preventDefault()`, send `'project:check-dirty-before-quit'` to the renderer, wait for `'project:confirm-quit-proceed'` IPC, then call `mainWindow.destroy()` (or `app.quit()` since this is the last window).

Alternative: route the X / Cmd+W close through the same path as Cmd+Q by intercepting at the menu `role: 'close'` and re-emitting as `app.quit()` — but per Phase 8.2 D-23 (no platform branching) and the comment at [src/main/index.ts:288-305](src/main/index.ts#L288-L305) the `role: 'close'` is load-bearing for Cmd+W menu accelerator semantics. The cleaner fix is the `mainWindow.on('close')` guard.

**Affected platforms:** All. macOS X button is the most-used path because closing the window is muscle-memory; Windows X is even more lethal because there's no "stay in dock" backstop. Cmd+W / Ctrl+W same impact.

**Tracking:** This pre-dates Phase 36 entirely (the dirty-guard at `before-quit` shipped in Phase 8 / Phase 18 lift-to-App.tsx). Phase 36 only added new state contributors (`overridesAtlasLess`) to the `isDirty` memo, which is correct. The close-path gap is independent.

**Recommendation:** Defer this to its own quick-task or a Phase 36.1 follow-up — fixing in a Phase 36 commit would muddle the scope (this isn't override-bucket work). Open a `.planning/todos/pending/` entry tagged for v1.5 close.

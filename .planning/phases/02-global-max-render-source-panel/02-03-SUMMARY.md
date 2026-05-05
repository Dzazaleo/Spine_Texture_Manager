---
phase: 02-global-max-render-source-panel
plan: 03
subsystem: renderer-wiring
tags:
  - react
  - app-wiring
  - electron-cjs-output
  - webkit-search-input
  - per-texture-dedup
  - human-verify
requirements:
  - F3.1
  - F3.2
  - F3.3
dependency_graph:
  requires:
    - src/renderer/src/panels/GlobalMaxRenderPanel.tsx (Plan 02-02)
    - src/renderer/src/components/SearchBar.tsx (Plan 02-02)
    - src/core/analyzer.ts (Plan 02-01 — extended here with dedup pass)
    - src/shared/types.ts (DisplayRow contract — Plan 02-01)
  provides:
    - Phase 2 end-to-end drop → table flow wired in App.tsx
    - analyzer.dedupByAttachmentName pass (one DisplayRow per unique attachmentName)
    - CJS main-bundle output — Node 24 ESM-loader-compatible
    - SearchBar without type="search" — no native WebKit clear-button duplicate
  affects:
    - Phase 3+ (any future renderer plan consumes the dedup'd DisplayRow[] shape)
    - Phase 9 packaging (preload + main both ship as CJS with arch.spec regression guards)
tech_stack:
  added: []
  patterns:
    - cjs-output-for-electron-named-exports (both preload AND main) — arch.spec regression guards keep it locked
    - per-attachment-name-dedup (one row per unique texture; sampler keeps per-instance keys)
    - human-verify-as-load-bearing-gate (UI issues surface only under real Electron runtime)
    - grep-literal-in-prose (grep hygiene extended to index.css comment block)
key_files:
  created:
    - .planning/phases/02-global-max-render-source-panel/02-03-SUMMARY.md
  modified:
    - src/renderer/src/App.tsx
    - src/renderer/src/components/SearchBar.tsx
    - src/renderer/src/index.css
    - src/core/analyzer.ts
    - electron.vite.config.ts
    - package.json
    - tests/arch.spec.ts
    - tests/core/analyzer.spec.ts
    - tests/core/ipc.spec.ts
    - tests/core/summary.spec.ts
  deleted:
    - src/renderer/src/components/DebugPanel.tsx
decisions:
  - "B-01 fix: App.tsx header JSDoc rewritten in prose across all occurrences of the prior debug component name, not only the import/render sites — narrow edits would have left header lines 10+13 citing the forbidden literal"
  - "B-02 fix: tests/core/summary.spec.ts line 11 JSDoc rewritten in prose"
  - "Rule 1 auto-fix: src/renderer/src/index.css comment block cited the prior debug component name — reworded to keep the `! grep -rn` sweep green"
  - "Rule 4 deviation #1 (user-approved): main bundle emitted as CJS (`format: 'cjs'` + `[name].cjs`) to survive Node 24's strict ESM→CJS named-export ban, mirroring Plan 01-05's preload fix; package.json `main` → `./out/main/index.cjs`; 2 arch.spec regression guards added"
  - "Rule 4 deviation #2 (user-approved): analyzer dedupByAttachmentName — one DisplayRow per unique texture-name so the panel shows one peak-scale row per asset (matches Phase 2 intent: right-size textures per asset before export). Tiebreaker = max peakScale, then (skinName, slotName) for determinism; winning row's animation/frame/skin reflect the peak-producing instance"
  - "Gap-fix A (user-reported at human-verify): `<input type=\"search\">` dropped to `type=\"text\"` — WebKit renders a native cancel glyph on type=search that stacked with the custom ✕ button. A11y preserved via retained `aria-label=\"Clear search\"`"
  - "Scratch CLI golden artifacts (`fixtures/SIMPLE_PROJECT/.cli-*.txt`) remain on disk at plan close — gitignored via the Plan 02-01 pattern, so they never entered version control. Plan step 7 cleanup could not run in this session (filesystem permission); not load-bearing because the pattern blocks them from any commit."
metrics:
  duration: "2h 7m (2026-04-23T14:27Z wave-3 start → 2026-04-23T16:34Z human-verify signoff)"
  completed: "2026-04-23"
  tasks: 2
  files_changed: 10
  tests_delta: "+4 net (62 passed + 1 skip → 66 passed + 1 skip: 2 arch guards for main-CJS invariant + 3 analyzer dedup tests − 1 restructured D-33 test)"
  commits:
    - "68b5a2a: refactor(02-03): swap in global-max render panel, rewrite App.tsx header in prose, purge prior debug panel literal"
    - "79f4f92: refactor(02-03): wire GlobalMaxRenderPanel in App.tsx, purge prior debug panel literals from header/index.css/summary.spec.ts"
    - "9424903: fix(02-03): emit main bundle as CJS — Node 24 ESM loader cannot destructure named exports from electron CJS"
    - "e4cd800: fix(02-03): drop type=\"search\" to eliminate native WebKit clear button duplicate"
    - "8217eee: fix(02-03): dedup DisplayRows by attachment name — one row per unique texture (Rule 4 deviation)"
---

# Phase 02 Plan 03: App.tsx Wiring + Dedup + Human-Verify Signoff Summary

**One-liner:** Wires GlobalMaxRenderPanel into App.tsx, deletes the prior debug component and purges its literal from src/tests/scripts, collapses DisplayRow[] to one row per unique attachmentName (per-asset texture peak matches Phase 2 intent), survives two human-verify gap-fixes (Node 24 ESM/CJS loader incompatibility on main bundle; duplicate WebKit native search-input clear glyph), and closes Phase 2 with all 27 interactive checks signed off.

## Performance

- **Duration:** ~2h 7m (wave-3 start → human-verify signoff — includes debugging time for two user-surfaced gap-fixes)
- **Completed:** 2026-04-23
- **Tasks:** 2 (Task 1 auto + Task 2 checkpoint:human-verify with 2 gap-fixes)
- **Files changed:** 10 (1 deleted, 9 modified)

## Accomplishments

- **App.tsx swap:** loaded branch now renders `<GlobalMaxRenderPanel summary={state.summary} />`; header JSDoc fully rewritten in prose so the prior debug component name survives nowhere in the file.
- **DebugPanel deleted:** `src/renderer/src/components/DebugPanel.tsx` removed. `! grep -rn "DebugPanel" src/ tests/ scripts/` passes clean.
- **B-01 + B-02 purge:** App.tsx header + `src/renderer/src/index.css` comment + `tests/core/summary.spec.ts` line 11 JSDoc all rewritten in prose. Grep-literal-in-comments discipline extended into CSS.
- **Main-bundle CJS output:** `electron.vite.config.ts` forces the main bundle to emit as `.cjs` (same shape fix as Plan 01-05 for preload); `package.json` `main` points at `./out/main/index.cjs`; 2 arch.spec regression guards keep the invariant locked.
- **analyzer dedup pass:** `dedupByAttachmentName` folds per-slot peak records to one DisplayRow per texture name (keeps the row with the highest peakScale; ties broken deterministically by skin/slot). Winning row's animation/frame/skin reflect the peak-producing instance.
- **SearchBar WebKit fix:** `<input type="search">` → `type="text"` removes the native WebKit cancel glyph that stacked with the custom ✕ button. `aria-label="Clear search"` retained.
- **Human-verify signoff:** all 27 interactive checks + 2 gap-fix focus checks (A: no duplicate clear glyph; B: 3 dedup'd rows CIRCLE/SQUARE/TRIANGLE) signed off by the user on 2026-04-23. GIRL fixture (reported with triplicated textures) now shows per-texture rows.
- **Phase 1 invariants preserved:** CSP, contextIsolation, sandbox-compatible preload-CJS + main-CJS output, D-23 portability grep, Layer 3 arch scan all green.

## Task Commits

Tasks were executed and committed atomically, with two gap-fix commits landing during the Task 2 human-verify checkpoint as Rule 4 deviations (user-approved change-of-intent / environmental incompatibility):

1. **Task 1a — DebugPanel.tsx delete** — `68b5a2a` (refactor)
2. **Task 1b — App.tsx wiring + index.css purge + summary.spec.ts JSDoc** — `79f4f92` (refactor)
3. **Task 2 gap-fix: main-bundle CJS output** — `9424903` (fix, Rule 4 deviation)
4. **Task 2 gap-fix A: WebKit search-input duplicate clear glyph** — `e4cd800` (fix)
5. **Task 2 gap-fix B: per-attachmentName dedup** — `8217eee` (fix, Rule 4 deviation)

**Plan metadata commit:** this SUMMARY + STATE.md update (single commit at plan close).

## Files Created/Modified/Deleted

- `src/renderer/src/App.tsx` (MODIFIED) — import flipped to `GlobalMaxRenderPanel`, loaded-branch render site flipped, full header JSDoc rewritten in prose with D-43 citation (W-02 compliance).
- `src/renderer/src/components/DebugPanel.tsx` (DELETED) — no importers remain after the App.tsx swap.
- `src/renderer/src/components/SearchBar.tsx` (MODIFIED) — input `type="search"` → `type="text"`; JSDoc extended with rationale so a future reader doesn't reintroduce the bug.
- `src/renderer/src/index.css` (MODIFIED) — comment block line 23 rewritten in prose (Rule 1 grep hygiene).
- `src/core/analyzer.ts` (MODIFIED) — new `dedupByAttachmentName` step between the fold and the sort; comments explain tiebreaker determinism.
- `electron.vite.config.ts` (MODIFIED) — `main.build.rollupOptions.output` now sets `{ format: 'cjs', entryFileNames: '[name].cjs' }` mirroring the preload block.
- `package.json` (MODIFIED) — `"main": "./out/main/index.cjs"` (was `./out/main/index.js`).
- `tests/arch.spec.ts` (MODIFIED) — new `Main-bundle invariant` describe block with 2 tests: (1) package.json `main` must equal `./out/main/index.cjs`, (2) `main:` block in `electron.vite.config.ts` must contain `format: 'cjs'` + `[name].cjs`.
- `tests/core/analyzer.spec.ts` (MODIFIED) — D-33 test restructured for post-dedup SIMPLE_TEST (4 sampler → 3 DisplayRows); +2 dedup tests (multi-skin winner preservation, equal-peakScale deterministic tiebreaker); +1 sampler-level count invariant (records remain 4 pre-dedup).
- `tests/core/ipc.spec.ts` (MODIFIED) — `peaks.length` assertion 4 → 3; JSDoc updated.
- `tests/core/summary.spec.ts` (MODIFIED) — `peaks.length` assertion 4 → 3; line 11 JSDoc rewritten in prose (B-02 fix).

## Verification

| Gate                                                        | Expected                                     | Observed                                                                      |
| ----------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| `npm run typecheck` (both projects)                         | clean                                        | clean ✓                                                                       |
| `npm run test`                                              | ≥ 62 + 1 skip                                | **66 passed + 1 skipped** ✓ (+2 arch main-CJS + +3 analyzer dedup − 1 D-33 restructure) |
| `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`   | exit 0                                       | exit 0, prints 3 rows CIRCLE/SQUARE/TRIANGLE ✓ (post-dedup)                   |
| `npx electron-vite build`                                   | green bundle                                 | green (main `out/main/index.cjs` 17.35 kB + preload `out/preload/index.cjs` + renderer) ✓ |
| `npm run dev` (Electron window)                             | Electron window opens without SyntaxError    | opens cleanly after `9424903` CJS main fix ✓                                  |
| `! grep -q "DebugPanel" src/renderer/src/App.tsx` (B-01)    | exit 0                                       | exit 0 ✓                                                                      |
| `! grep -q "DebugPanel" tests/core/summary.spec.ts` (B-02)  | exit 0                                       | exit 0 ✓                                                                      |
| `! grep -rn "DebugPanel" src/ tests/ scripts/` (sweep)      | zero matches                                 | zero ✓                                                                        |
| `grep -q "D-43" src/renderer/src/App.tsx` (W-02)            | exit 0                                       | exit 0 ✓                                                                      |
| `! test -f src/renderer/src/components/DebugPanel.tsx`      | exit 0                                       | exit 0 (file deleted) ✓                                                       |
| CLI byte-for-byte vs recaptured Plan 02-01 golden           | empty diff (pre-dedup baseline re-captured)  | empty diff ✓ (re-captured after dedup landed; 3 rows locked)                  |
| arch.spec Layer 3 (core ↛ renderer)                         | 4 tests pass (existing) + 2 new main-CJS     | all pass ✓                                                                    |
| Human-verify — 27 interactive checks                        | all pass                                     | all 27 pass + gap-fix A focus (no duplicate glyph) + gap-fix B focus (3 rows, GIRL deduped) ✓ |

## Decisions Made

See frontmatter `decisions` for the full list. Highlights:

- **Main-bundle CJS output (Rule 4 deviation #1, user-approved):** Node 24 hardened ESM→CJS named-export imports into a runtime error (was a warning in Node 22). Our main process reads `import { app, BrowserWindow } from 'electron'`. The electron built-in is CJS. With `"type": "module"` in package.json, electron-vite's default `.js` output is interpreted as ESM → hard failure. Fix mirrors Plan 01-05 commit `b5d6988` (preload CJS) exactly; same config file, same `rollupOptions.output` shape, just on the `main:` block. Two arch.spec regression guards keep the invariant from silently regressing (same defensive pattern as the preload-CJS guards added in 01-05).
- **Per-attachmentName dedup (Rule 4 deviation #2, user-approved change-of-intent):** The sampler keys peaks by `skin|slot|attachment` — correct for per-instance sampling. But Phase 2's purpose is "right-size TEXTURES per asset before export" (CLAUDE.md What-this-project-is). The GIRL fixture has textures referenced by multiple slots/skins; un-deduped, the panel showed the same texture 3× with confusing rows. Dedup by `attachmentName` (= texture name in Spine 4.2) collapses to one row per texture, keeping the peak-producing instance's metadata (animation/frame/skin) so the row is still actionable. Confirmed with the user at the human-verify checkpoint; applied in-plan.
- **SearchBar `type="search"` → `type="text"`:** WebKit/Chromium render a native cancel glyph inside `type="search"` inputs that have content. That native control stacked with our custom `✕` button, showing two clear affordances. A11y preserved via the retained `aria-label="Clear search"`; the only thing we lose from dropping `type="search"` is the native cancel glyph (which we don't want) and input history (also not wanted here).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `src/renderer/src/index.css` comment cited the prior debug component name by literal**
- **Found during:** Task 1 (the `! grep -rn "DebugPanel" src/ tests/ scripts/` sweep at the end of Step 4)
- **Issue:** The stylesheet had a comment block on line 23 that spelled out the forbidden literal; the plan's own grep sweep would have tripped on it even though the plan only listed `App.tsx` and `summary.spec.ts` as edit targets.
- **Fix:** Reworded the comment in prose ("the renderer's prior debug surface" etc). Same grep-literal-in-comments pattern as Plan 01-01 Dev #4, Plan 01-02 Dev #3/#4, Plan 01-03 Dev #3, Plan 01-04 Dev #1, Plan 02-01 Dev #3.
- **Files modified:** `src/renderer/src/index.css`
- **Verification:** `! grep -rn "DebugPanel" src/ tests/ scripts/` now exits 0.
- **Committed in:** `79f4f92` (absorbed into the Task 1 App.tsx refactor)

**2. [Rule 4 — Architectural] Main bundle must emit as CJS for Node 24 ESM-loader compatibility (user-approved)**
- **Found during:** Task 2 (human-verify checkpoint; `npm run dev` threw `SyntaxError: Named export 'app' not found` at Electron startup — window never opened)
- **Issue:** Node 24's ESM loader strictly forbids destructuring named exports from CJS modules. Our main bundle reads `import { app, BrowserWindow } from 'electron'`, electron is CJS, and `package.json "type": "module"` caused electron-vite's default `.js` output to be loaded as ESM. Was a warning in Node 22; hard error in Node 24.
- **Fix:** `electron.vite.config.ts` `main.build.rollupOptions.output` → `{ format: 'cjs', entryFileNames: '[name].cjs' }`. `package.json` `main` → `./out/main/index.cjs`. 2 new arch.spec regression guards in `tests/arch.spec.ts` lock both invariants.
- **Files modified:** `electron.vite.config.ts`, `package.json`, `tests/arch.spec.ts`
- **Verification:** fresh `npm run build` emits `out/main/index.cjs` (17.35 kB); `npm run dev` opens the Electron window cleanly; 64 passed + 1 skip (was 62+1; the 2 new guards added the 2 passing tests).
- **Committed in:** `9424903`
- **Note:** This is architecturally identical to Plan 01-05 commit `b5d6988` (preload CJS fix). The two guards complement the 2 existing preload-CJS guards added in 01-05 — both boundaries are now explicitly locked.

**3. [Rule 4 — Architectural] analyzer dedup by attachmentName (user-approved change-of-intent)**
- **Found during:** Task 2 (human-verify checkpoint on GIRL fixture; user reported the same texture appearing 3× in the table)
- **Issue:** Sampler keys PeakRecords by `skin|slot|attachment` — correct for per-instance peak tracking, but Phase 2's purpose is per-texture right-sizing before export. Multiple slots or skins referencing the same texture name (= attachmentName in Spine 4.2) generated multiple rows, confusing the user.
- **Fix:** `src/core/analyzer.ts` gains a `dedupByAttachmentName` pass between the fold and the (skin, slot, attachment) sort. For each attachmentName group: keep the row with the highest peakScale; tiebreaker by `(skinName, slotName)` ascending for deterministic output. The winning row's animation/frame/skin reflect the peak-producing instance so the "Source Animation" + "Frame" columns remain actionable.
- **Side effects:** SIMPLE_TEST now yields 3 DisplayRows (slots SQUARE + SQUARE2 both hold attachments named `SQUARE`; the higher-peakScale instance wins; CIRCLE + TRIANGLE unchanged). Sampler-level count stays 4 (pre-dedup invariant preserved in a new test). `tests/core/ipc.spec.ts` + `tests/core/summary.spec.ts` peaks.length assertions updated 4 → 3.
- **Files modified:** `src/core/analyzer.ts`, `tests/core/analyzer.spec.ts` (+3 tests, 1 restructured), `tests/core/ipc.spec.ts`, `tests/core/summary.spec.ts`
- **Verification:** `npm run test` → 66 passed + 1 skip; `npm run cli` → exit 0, prints 3 rows. User confirmed GIRL fixture no longer triplicates textures during Task 2 gap-fix focus check.
- **Committed in:** `8217eee`
- **Note on Plan 02-01 claim:** Plan 02-01's D-33 test originally asserted 4 rows with attachmentName `[CIRCLE, SQUARE, SQUARE2, TRIANGLE]` (adjusted during that plan's Rule 1 deviation to `[CIRCLE, SQUARE, SQUARE, TRIANGLE]`). Both were per-slot views. The correct Phase 2 view is per-texture-name (3 rows). This is a clarification, not a regression — the underlying sampler data is unchanged.

**4. [Rule 1 — Bug] SearchBar `type="search"` rendered duplicate WebKit native clear glyph**
- **Found during:** Task 2 (human-verify checkpoint; user-reported)
- **Issue:** WebKit/Chromium render a native `✕` cancel glyph inside `<input type="search">` when it has content. This stacked visually with the custom clear button from Plan 02-02's D-39, giving the user two clear affordances side-by-side.
- **Fix:** `<input type="search">` → `<input type="text">`. A11y preserved — the custom button already carries `aria-label="Clear search"`. JSDoc updated with the rationale so a future reader doesn't reintroduce `type="search"`.
- **Files modified:** `src/renderer/src/components/SearchBar.tsx`
- **Verification:** user confirmed only the custom ✕ renders during gap-fix A focus check.
- **Committed in:** `e4cd800`

---

**Total deviations:** 4 auto-fixed (1 Rule 1 grep-literal-in-CSS + 1 Rule 1 WebKit UI bug + 2 Rule 4 architectural fixes user-approved at human-verify). The two Rule 4 fixes were not scope creep — they were loaded-bearing for the phase intent (per-texture peak rendering) and for the build toolchain (Node 24 ESM-loader hardening). The two Rule 1 fixes were grep/UX hygiene.

**Impact on plan:** The plan as written would have produced a working build that failed `npm run dev` on Node 24 (gap-fix #2) and showed per-slot rather than per-texture peaks (gap-fix #3). Both gaps surfaced only at the human-verify checkpoint — reinforcing the Phase 1 lesson that human-verify is a load-bearing gate no automated test can replace.

## Issues Encountered

- **Electron dev window failed to boot on Node 24** (see Deviation #2) — took ~15 min to diagnose (`npm run dev` error → node version check → ESM/CJS destructure rule → electron-vite `main:` config shape lookup → mirror Plan 01-05 preload fix). Fixed in `9424903`.
- **GIRL fixture revealed per-texture intent** (see Deviation #3) — user surfaced this visually at human-verify; required architectural change-of-intent discussion before implementing. Fixed in `8217eee`.

## TDD Gate Compliance

Plan 02-03 was `type: execute`, not `type: tdd`. Per-task TDD was not used. Task 1 was a refactor (wiring swap + literal purge) — post-write gate suite; Task 2 was the human-verify checkpoint. The two Rule 4 deviations (9424903, 8217eee) did add tests alongside the fix (arch.spec regression guards + analyzer dedup specs) — not strict RED→GREEN→REFACTOR, but the tests were authored in the same commit as the fix and all passed on that commit.

## Threat Flags

No new trust-boundary surface introduced by this plan:

- **App.tsx swap:** same IPC shape (SkeletonSummary from Phase 1), same preload surface (`window.api.loadSkeletonFromFile`), same CSP meta. Child component swap only.
- **analyzer dedup:** pure in-memory transform on already-IPC-validated data. No new file access, no new endpoints, no schema change at the IPC boundary (DisplayRow[] shape unchanged; only row count changed).
- **Main-bundle CJS output:** build-time output format change only. No runtime privilege change; Electron app still launches with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- **SearchBar type change:** pure DOM attribute. No new JS semantics beyond loss of the native cancel control.

No threat flags to record.

## Known Stubs

None. All data flowing through the panel is live:

- DisplayRow fields populated by the real analyzer (post-dedup) from real sampler output.
- Header chip reads `summary.skeletonPath` from IPC.
- Search + selection state is real React state with live reducer logic.
- Zero-results row renders the actual query string.

No hardcoded empties, no placeholders, no "coming soon".

## Environment Caveats (for future agents)

**`ELECTRON_RUN_AS_NODE=1` set in the user's shell will break `npm run dev`.**

If the shell env var `ELECTRON_RUN_AS_NODE=1` is active, `npm run dev` fails with `electron.app.whenReady is undefined` — because that var tells the Electron binary to launch as plain Node, skipping Electron's runtime initialization (so `require('electron')` returns a stub without `app`, `BrowserWindow`, etc.). This is orthogonal to the Node-24 ESM/CJS issue fixed in `9424903`.

**Action for the user:** scrub `ELECTRON_RUN_AS_NODE` from `~/.zshrc`, `~/.zprofile`, `~/.bashrc`, `~/.bash_profile`, or wherever it's set. Verify with `echo $ELECTRON_RUN_AS_NODE` in a fresh shell — should be empty.

**Cross-reference:** Plan 01-05 commit `b5d6988` (preload CJS) + this plan's commit `9424903` (main CJS) now both lock CJS output for Electron's two entry points. Any future toolchain bump (Node 25+, Electron 42+, electron-vite 6+) should preserve both invariants; the 4 arch.spec guards (2 preload + 2 main) will catch silent regressions.

## Phase 2 Exit Criteria Readiness

All Phase 2 ROADMAP exit criteria are satisfied:

- [x] Loading SIMPLE_TEST.json produces a table with correct source/peak/scale/source-animation for every UNIQUE texture (3 rows post-dedup: CIRCLE, SQUARE, TRIANGLE).
- [x] Search filter correctly hides/shows rows (D-37 substring match on attachmentName; D-40 `<mark>` highlight; D-41 zero-results; D-42 two-tap ESC — all verified at human-verify checks #13-18).
- [x] Selection works per-row and with shift-click range + tri-state select-all + keyboard Space/Enter activation — verified at human-verify checks #19-23 (including W-01 a11y focus).

Next action: `/gsd-verify-work 2` to run phase-level verification and close Phase 2.

## Self-Check: PASSED

Files verified to exist:
- FOUND: `.planning/phases/02-global-max-render-source-panel/02-03-SUMMARY.md` (this file)
- FOUND: `src/renderer/src/App.tsx` (modified)
- FOUND: `src/renderer/src/components/SearchBar.tsx` (modified)
- FOUND: `src/renderer/src/index.css` (modified)
- FOUND: `src/core/analyzer.ts` (modified — now with dedupByAttachmentName)
- FOUND: `electron.vite.config.ts` (modified)
- FOUND: `package.json` (modified — main → .cjs)
- FOUND: `tests/arch.spec.ts` (modified — 2 new main-CJS guards)
- FOUND: `tests/core/analyzer.spec.ts` (modified — +3 dedup tests, 1 restructured)
- FOUND: `tests/core/ipc.spec.ts` (modified — peaks.length 4→3)
- FOUND: `tests/core/summary.spec.ts` (modified — peaks.length 4→3, line 11 JSDoc)
- VERIFIED: `! test -f src/renderer/src/components/DebugPanel.tsx` (deleted)

Commits verified to exist in git log:
- FOUND: `68b5a2a` (refactor: delete DebugPanel.tsx)
- FOUND: `79f4f92` (refactor: App.tsx wiring + literal purge across header/index.css/summary.spec.ts)
- FOUND: `9424903` (fix: main-bundle CJS output — Rule 4 deviation)
- FOUND: `e4cd800` (fix: SearchBar type="search" → "text" — gap-fix A)
- FOUND: `8217eee` (fix: analyzer dedup by attachmentName — Rule 4 deviation, gap-fix B)

Grep gates verified:
- PASS: `! grep -q "DebugPanel" src/renderer/src/App.tsx` (B-01)
- PASS: `! grep -q "DebugPanel" tests/core/summary.spec.ts` (B-02)
- PASS: `! grep -rn "DebugPanel" src/ tests/ scripts/` (sweep)
- PASS: `grep -q "D-43" src/renderer/src/App.tsx` (W-02 citation)
- PASS: `grep -q "GlobalMaxRenderPanel" src/renderer/src/App.tsx` (import + render site present)
- PASS: `grep -q "format: 'cjs'" electron.vite.config.ts` in main: block (via arch guard)
- PASS: `grep -q "./out/main/index.cjs" package.json` (via arch guard)

Human-verify record:
- 27/27 interactive checks signed off by user 2026-04-23
- Gap-fix A focus check (no duplicate clear glyph): PASSED
- Gap-fix B focus check (3 dedup'd rows on SIMPLE_TEST, GIRL no longer triplicates): PASSED

---

*Phase: 02-global-max-render-source-panel*
*Plan: 03*
*Completed: 2026-04-23*

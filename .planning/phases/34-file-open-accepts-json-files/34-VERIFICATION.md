---
phase: 34-file-open-accepts-json-files
verified: 2026-05-11T21:25:00Z
status: human_needed
score: 16/16 must-haves verified (programmatic) + 5 success criteria need human OS-picker testing
overrides_applied: 0
re_verification: # No previous VERIFICATION.md existed — initial verification
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "macOS — File → Open dialog accepts both .stmproj and .json in a single unified filter"
    expected: "Click File → Open (or press Cmd+O). OS picker opens with title 'Open Spine Project or Skeleton'. Both .stmproj and .json files appear selectable in one filter labelled 'Spine Project or Skeleton'. No dropdown to operate."
    why_human: "OS-level native dialog rendering cannot be verified without a real macOS picker. Unit tests assert the OpenDialogOptions object byte-equal contents but cannot verify the OS actually honors them."
  - test: "Windows — same dialog test on Windows"
    expected: "Same as above but with Windows file picker. Single dropdown entry 'Spine Project or Skeleton (*.stmproj; *.json)'."
    why_human: "No Windows machine in the test harness. Phase 34 explicitly targets macOS + Windows."
  - test: "Atlas-source .json menu open produces same summary as drag-drop"
    expected: "With no project loaded, File → Open, pick fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json. App lands status:'loaded'. Global panel + Animation Breakdown identical to drag-dropping the same file. Atlas-source mode auto-selected (sibling .atlas detected)."
    why_human: "Success Criteria #2 from ROADMAP — end-to-end equivalence with drag-drop. The two-IPC-step flow is unit-tested but the full loader→sampler→buildSummary chain through the menu path is not exercised by an automated integration test (Phase 34 chose not to land the optional integration spec mentioned in CONTEXT.md line 78)."
  - test: "Atlas-less .json menu open via sibling images/ folder"
    expected: "With no project loaded, File → Open, pick a .json from a folder with no .atlas but a sibling images/ folder (e.g., fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/). App lands status:'loaded', atlas-less mode auto-selected via synthesizer fall-through (D-05). Identical to drag-drop."
    why_human: "Success Criteria #3 from ROADMAP — loaderMode-cascade parity. No automated test exercises the synthesizer through the menu IPC path."
  - test: "Cmd+O / Ctrl+O accelerator parity with menu click"
    expected: "With app focused and no project loaded, press Cmd+O (macOS) / Ctrl+O (Windows). Same picker opens, same dispatch happens, identical behavior to clicking File → Open menu item."
    why_human: "Native Electron menu accelerators are wired at Phase 08.2 D-173 and verified by inheritance, not by direct keystroke test. OPEN-05 is declared verification-only."

  # CR-01 — case-sensitivity gap surfaced by REVIEW.md, NOT a verification gap
  # because no OPEN requirement explicitly mentions case-insensitive load.
  # Recorded here for human awareness, not as a status-blocking gap.
  - test: "Uppercase-suffix file (e.g., MyRig.STMPROJ or Skel.JSON) opens successfully"
    expected: "Pick a file with uppercase extension. App loads it without error."
    why_human: "REVIEW.md CR-01 documents this fails — the picker routes correctly via case-insensitive matching (project-io.ts:330), but handleProjectOpenFromPath:367 + handleSkeletonLoad:425 reject case-sensitively. User would see `kind: 'Unknown'` with the message 'absolutePath must be a non-empty .stmproj path' or 'expected a non-empty string ending in .json'. Reachable on macOS APFS case-insensitive volumes and Windows file-name field paste. **Not strictly required by any OPEN-0x requirement** (OPEN-01..05 mention extension acceptance but do not mandate case-insensitive load); flagged for human triage on whether to accept as bug-fix in this phase or defer."
---

# Phase 34: file-open-accepts-json-files Verification Report

**Phase Goal:** Extend the existing File → Open accelerator + menu item so it accepts both the `.stmproj` project archive AND a raw Spine skeleton `.json` file (atlas-source or atlas-less). On `.json` selection, route through the same loader entry that handles drag-drop (`src/core/loader.ts`), preserving strict loaderMode separation — atlas-source vs atlas-less is detected from sibling artifacts in the JSON's folder, identical to the drag-drop path. The existing dirty-guard wired in Phase 08.1 remains in force. Adds menu/dialog parity with the drag-drop surface so keyboard-driven workflows have full coverage.

**Verified:** 2026-05-11T21:25:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Aggregated from all four plans' `must_haves.truths` arrays:

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | OS file picker filter accepts both .stmproj and .json in a single unified entry | VERIFIED | src/main/project-io.ts:320 — `filters: [{ name: 'Spine Project or Skeleton', extensions: ['stmproj', 'json'] }]` |
| 2 | Dialog title reads 'Open Spine Project or Skeleton' | VERIFIED | src/main/project-io.ts:318 — exact literal |
| 3 | Picker-only handler (main) returns a discriminated three-arm envelope `{ kind: 'project'\|'skeleton'\|'cancelled' }` with no downstream load chain | VERIFIED | src/main/project-io.ts:315-338 — `handleOpenDialog` returns OpenDialogResponse; no load IPC fires inside; tests at tests/main/project-io.spec.ts:501-559 (5 cases) all green |
| 4 | Renderer preload surface exposes openProjectPicker (no-arg picker) and loadSkeletonFromPath (path-based skeleton load) | VERIFIED | src/preload/index.ts:168 + 170-172 — both methods present and bound to correct IPC channels |
| 5 | Old window.api.openProject method + 'project:open' IPC channel + handleProjectOpen handler physically deleted (not commented out) | VERIFIED | grep counts all 0 — no residual `openProject:`/`window.api.openProject`/`'project:open'` channel anywhere in src/ |
| 6 | Menu File → Open click (+ Cmd+O/Ctrl+O) opens OS picker via window.api.openProjectPicker() | VERIFIED | src/renderer/src/App.tsx:322 — `await window.api.openProjectPicker()` inside `onMenuOpen` callback |
| 7 | On cancelled picker result, the renderer returns immediately — no SaveQuitDialog, no state change, no toast (D-05 improvement) | VERIFIED | src/renderer/src/App.tsx:325 — `if (result.kind === 'cancelled') return;` (BEFORE handleBeforeDrop call); test 34-MENU-01 asserts this |
| 8 | On kind:'project' result, renderer fires handleBeforeDrop(basename, 'stmproj') then on proceed calls openProjectFromPath(path) and lands via handleProjectLoad | VERIFIED | src/renderer/src/App.tsx:330,334,339-341; test 34-MENU-02 |
| 9 | On kind:'skeleton' result, renderer fires handleBeforeDrop(basename, 'json') then on proceed calls loadSkeletonFromPath(path) and lands via handleLoad | VERIFIED | src/renderer/src/App.tsx:330,334,342-345; test 34-MENU-03 |
| 10 | When handleBeforeDrop resolves false, no load IPC fires and no state change happens | VERIFIED | src/renderer/src/App.tsx:335 — `if (!proceed) return;`; test 34-MENU-04b drives real SaveQuitDialog Cancel click |
| 11 | Picker filter shape + dialog title asserted in main-side unit test | VERIFIED | tests/main/project-io.spec.ts: case `34-OPEN-05` asserts filter equality + title literal |
| 12 | Three-arm envelope covered by main-side unit tests with mocked dialog.showOpenDialog | VERIFIED | tests/main/project-io.spec.ts cases 34-OPEN-01/02/03 |
| 13 | Defense-in-depth unknown-suffix arm routes to kind:'project' | VERIFIED | tests/main/project-io.spec.ts case 34-OPEN-04; src/main/project-io.ts:337 (default fall-through) |
| 14 | Renderer cancel branch does NOT fire handleBeforeDrop, idle passthrough, dirty cancel arm, subscription stability | VERIFIED | 34-MENU-01, 34-MENU-04, 34-MENU-04b, 34-MENU-05 all pass |
| 15 | No orphan references to deleted window.api.openProject surface remain in tests/renderer/save-load.spec.tsx | VERIFIED | `grep -cE "api\.openProject(\s*=|\s*:)"` returns 0 |
| 16 | REQUIREMENTS.md introduces OPEN-0x namespace + ROADMAP.md Phase 34 Requirements field is populated | VERIFIED | REQUIREMENTS.md:27-31 + 77-81 + 93; ROADMAP.md:888 |

**Score:** 16/16 truths verified programmatically. 5 Success Criteria from ROADMAP also need human OS-picker validation (see Human Verification Required section).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/shared/types.ts` | OpenDialogResponse discriminated union + Api interface update | VERIFIED | line 1192: three-arm union exists; line 1282: openProjectPicker; line 1289: loadSkeletonFromPath |
| `src/main/project-io.ts` | handleOpenDialog picker-only handler (replaces handleProjectOpen) | VERIFIED | line 315 export; old handleProjectOpen grep=0 |
| `src/main/ipc.ts` | 'project:open-dialog' IPC channel registration (replaces 'project:open') | VERIFIED | line 925 registers new channel; old 'project:open' grep=0; line 51 imports handleOpenDialog |
| `src/preload/index.ts` | openProjectPicker + loadSkeletonFromPath methods | VERIFIED | line 168 + 170-172 |
| `src/renderer/src/App.tsx` | Rewired onMenuOpen handler (D-05 + D-06 two-IPC-step flow) | VERIFIED | lines 318-347; 27-line handler replaces former 5-line body |
| `tests/main/project-io.spec.ts` | handleOpenDialog describe block — 5 OPEN cases | VERIFIED | grep `34-OPEN-01..05` all present; 25 cases total pass |
| `tests/renderer/save-load.spec.tsx` | onMenuOpen Phase 34 describe block (6 cases) + mock surface migration | VERIFIED | 34-MENU-01,02,03,04,04b,05 all present; orphan 8.1-VR-02 block deleted; spec passes (17 + 1 skipped) |
| `.planning/REQUIREMENTS.md` | OPEN-01..05 requirements + traceability rows | VERIFIED | lines 27-31 bullets; lines 77-81 traceability; line 60 coverage 11 total |
| `.planning/ROADMAP.md` | Phase 34 Requirements field populated | VERIFIED | line 888 — concrete OPEN-01..05 list; line 89 top-of-roadmap one-liner updated to `(REQs: OPEN-01..05)` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| App.tsx onMenuOpen | window.api.openProjectPicker → 'project:open-dialog' IPC → handleOpenDialog | menu:open-clicked subscription | WIRED | App.tsx:318 (`window.api.onMenuOpen`) → App.tsx:322 (`window.api.openProjectPicker()`) → preload:168 (`ipcRenderer.invoke('project:open-dialog')`) → ipc.ts:925 (`ipcMain.handle('project:open-dialog', ... handleOpenDialog())`) → project-io.ts:315 (`handleOpenDialog`) |
| App.tsx (kind === 'project' arm) | window.api.openProjectFromPath → handleProjectOpenFromPath | ipcRenderer.invoke('project:open-from-path') | WIRED | App.tsx:340 → preload:198 → ipc.ts:926 → project-io.ts:361 (UNCHANGED, reused) |
| App.tsx (kind === 'skeleton' arm) | window.api.loadSkeletonFromPath → handleSkeletonLoad | ipcRenderer.invoke('skeleton:load') | WIRED | App.tsx:344 → preload:171-172 → ipc.ts:678 → ipc.ts:423 (UNCHANGED, reused) |
| openProjectPicker preload | 'project:open-dialog' IPC channel | ipcRenderer.invoke | WIRED | preload:168 — exact match |
| loadSkeletonFromPath preload | 'skeleton:load' IPC channel | ipcRenderer.invoke | WIRED | preload:171-172 — passes absolutePath through unchanged |
| openProjectPicker → preload onMenuOpen subscription | unchanged from Phase 08.2 | menu:open-clicked one-way | WIRED | preload:284-289 (unchanged) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| App.tsx onMenuOpen | result (OpenDialogResponse) | main handleOpenDialog via openProjectPicker | Yes — real OS picker via Electron dialog.showOpenDialog | FLOWING |
| App.tsx project arm | resp (OpenResponse) | main handleProjectOpenFromPath | Yes — real file read + parse + materialize + loadSkeleton + sampleSkeleton + buildSummary (unchanged from Phase 8) | FLOWING |
| App.tsx skeleton arm | resp (LoadResponse) | main handleSkeletonLoad | Yes — real loadSkeleton + sampleSkeleton + buildSummary (unchanged from Phase 1) | FLOWING |
| handleOpenDialog | result.filePaths[0] | electron dialog.showOpenDialog | Yes — real OS picker | FLOWING |
| dropKind derivation | result.kind | discriminator from handleOpenDialog | Yes — exhaustive on 3-arm union | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compile | `npx tsc --noEmit -p tsconfig.json` | exits 0 (no output) | PASS |
| All Phase 34 specs pass | `npm test -- tests/main/project-io.spec.ts tests/main/ipc.spec.ts tests/renderer/save-load.spec.tsx tests/preload/open-project-picker.spec.ts tests/shared/types.spec.ts tests/arch.spec.ts --run` | 95 passed, 1 skipped, 0 failed | PASS |
| OpenDialogResponse type exported | `grep -c "export type OpenDialogResponse" src/shared/types.ts` | 1 | PASS |
| handleOpenDialog exported | `grep -c "export async function handleOpenDialog" src/main/project-io.ts` | 1 | PASS |
| 'project:open-dialog' channel registered | `grep -c "ipcMain.handle('project:open-dialog'" src/main/ipc.ts` | 1 | PASS |
| Old 'project:open' channel removed | `grep -cE "ipcMain\.handle\('project:open',\s*async" src/main/ipc.ts` | 0 | PASS |
| Old openProject preload method removed | `grep -cE "^\s*openProject: \(\) => ipcRenderer\.invoke\('project:open'\)" src/preload/index.ts` | 0 | PASS |
| Old handleProjectOpen function removed | `grep -cE "^export async function handleProjectOpen\(\)" src/main/project-io.ts` | 0 | PASS |
| Old openProject Api entry removed | `grep -cE "^\s*openProject: \(\) => Promise<OpenResponse>" src/shared/types.ts` | 0 | PASS |
| No window.api.openProject callsites remain | `grep -r "window.api.openProject\b" src/ \| grep -v openProjectPicker \| grep -v openProjectFromFile \| grep -v openProjectFromPath` | 0 matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| OPEN-01 | 34-01,34-03,34-04 | File → Open dialog filter accepts both `.stmproj` and `.json` in a single unified filter entry on macOS + Windows. Dialog title is "Open Spine Project or Skeleton". | SATISFIED (programmatic) + NEEDS HUMAN (OS-picker verification) | src/main/project-io.ts:318-321 filter literal + title literal; tests/main/project-io.spec.ts 34-OPEN-05 asserts both. Native OS picker rendering on macOS + Windows is a human verification item. |
| OPEN-02 | 34-01,34-02,34-03,34-04 | Picking `.json` routes through the same drag-drop loader cascade (`src/core/loader.ts` D-05/D-07/D-08). Strict loaderMode separation preserved. No user-mode toggle. | SATISFIED (programmatic) + NEEDS HUMAN (end-to-end load on real fixtures) | Wired via App.tsx:344 → loadSkeletonFromPath → 'skeleton:load' IPC → handleSkeletonLoad → loadSkeleton (UNCHANGED). No new code path. Tests 34-MENU-03 verifies dispatch. End-to-end summary equivalence with drag-drop is the human verification item (no integration spec landed). |
| OPEN-03 | 34-01,34-02,34-03,34-04 | Picking `.stmproj` routes through `handleProjectOpenFromPath` unchanged. End-to-end parity with drag-drop `.stmproj`. | SATISFIED (programmatic) + NEEDS HUMAN (regression-free verification) | Wired via App.tsx:340 → openProjectFromPath → 'project:open-from-path' IPC → handleProjectOpenFromPath (UNCHANGED). Test 34-MENU-02 verifies dispatch. Verification-only REQ. |
| OPEN-04 | 34-02,34-03,34-04 | Opening over unsaved in-progress project triggers Phase 08.1 dirty-guard with actual kind. Cancelling picker (kind:'cancelled') NEVER fires guard. | SATISFIED (programmatic) | Both sub-arms covered: idle-passthrough (34-MENU-04), dirty-cancel via SaveQuitDialog (34-MENU-04b real Cancel click), cancel-never-fires-guard (34-MENU-01). App.tsx:325 (early return on cancel BEFORE handleBeforeDrop). |
| OPEN-05 | 34-02,34-03,34-04 | Cmd+O / Ctrl+O accelerator behaves identically to menu item. Verification-only — inherited from Phase 08.2 D-173. | SATISFIED (inherited) + NEEDS HUMAN (keystroke test on real OS) | Native Electron menu accelerator wired at Phase 08.2 D-173 — no Phase 34 change to the menu surface or accelerator binding. Both code paths land on the same `'menu:open-clicked'` subscription. Cannot programmatically dispatch native menu keystroke in unit tests. |

**All 5 requirement IDs declared in plan frontmatters (OPEN-01..05) are accounted for in REQUIREMENTS.md, ROADMAP.md, and have evidence in the codebase.** No orphaned requirements in REQUIREMENTS.md mapping to Phase 34 outside the OPEN-0x namespace.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/main/project-io.ts | 367 | Case-sensitive `endsWith('.stmproj')` validator while picker (line 330) is case-insensitive | Warning (REVIEW.md CR-01) | User picking `RIG.STMPROJ` on macOS APFS case-insensitive volume sees generic `kind:'Unknown'` rejection. Not blocked by an OPEN-0x requirement explicitly. |
| src/main/ipc.ts | 425 | Case-sensitive `endsWith('.json')` validator while picker is case-insensitive | Warning (REVIEW.md CR-01) | Symmetric case to above for skeleton arm. |
| src/renderer/src/App.tsx | 339-346 | Exhaustiveness relies on comment, not `never` assertion | Info (REVIEW.md IN-03) | Future 4th arm of OpenDialogResponse (e.g., 'unsupported') would silently route to skeleton load. |
| src/renderer/src/App.tsx | 318-346 | Picker path does not transition AppState to 'loading' — no "Loading {file}…" UI hint | Warning (REVIEW.md WR-01) | UX regression vs drag-drop path; no OPEN-0x requirement mandates loading state. |
| src/renderer/src/App.tsx | 415 (deps array) | `handleLoad` referenced in effect but missing from deps array | Info (REVIEW.md WR-02) | Dormant — `handleLoad` is `useCallback(...,[])` stable; would surface if it ever closes over state. |
| src/main/project-io.ts | 317-321 | Missing `dontAddToRecent` property — Windows recent-docs pollution | Info (REVIEW.md WR-03) | Cosmetic on Windows. |
| tests/main/project-io.spec.ts | 406-489 vs 501-559 | Duplicate test cases for picker behavior (D-01/D-02/D-03 block + 34-OPEN-01..05 block) | Info (REVIEW.md IN-02) | Doubles maintenance cost; both pass. |
| src/main/project-io.ts | 334-337 | Comment claims "typed error envelope" — actually emits generic `kind:'Unknown'` | Info (REVIEW.md IN-01) | Documentation accuracy. |

**Note:** These are review findings, NOT verification gaps. Per the verifier role brief, REVIEW.md findings do not downgrade verification status unless they break an OPEN-0x requirement. The OPEN-01..05 requirements describe extension acceptance and routing — not case-insensitive load. CR-01 is flagged in human verification for triage but does not block phase passage.

### Human Verification Required

See frontmatter `human_verification:` block. 6 items require human/OS-level testing:
1. macOS native picker filter rendering + title
2. Windows native picker filter rendering + title
3. Atlas-source `.json` menu open end-to-end equivalence with drag-drop
4. Atlas-less `.json` menu open end-to-end equivalence with drag-drop (synthesizer cascade)
5. Cmd+O / Ctrl+O accelerator parity with menu click
6. Uppercase-suffix file open (CR-01 awareness check — not a hard requirement, triage decision)

### Gaps Summary

No programmatic gaps. All 16 observable truths from the four plans' `must_haves.truths` arrays are verified against the codebase:

- The picker contract (Wave 1) is landed in `handleOpenDialog` with the correct filter shape, title, and three-arm envelope; old surface is physically deleted.
- The renderer rewire (Wave 2) consumes the new contract correctly, applying D-05 (dirty-guard after picker) and D-06 (two-IPC-step dispatch).
- Test coverage (Wave 3) hardens the picker shape, the three-arm envelope, the renderer dispatch, the idle-state passthrough, the dirty-cancel arm via real SaveQuitDialog Cancel click, and subscription stability.
- Documentation (Wave 4) introduces the OPEN-0x namespace in REQUIREMENTS.md, increments the v1.4 coverage counter from 6 to 11, and populates ROADMAP.md Phase 34's Requirements line.

**95 of 96 affected tests pass; 1 pre-existing skip (a legacy Save toolbar button not touched by this phase) is documented.** `tsc --noEmit` exits 0.

The phase code-completes its programmatic contract. The remaining work is OS-level human verification of the native picker on macOS + Windows, plus end-to-end load equivalence with drag-drop on real fixture files, plus the Cmd+O / Ctrl+O accelerator round-trip. CR-01 (uppercase-suffix load rejection) is a known correctness concern documented in REVIEW.md but is not strictly required by any OPEN-0x requirement; it is surfaced as a triage decision for the human reviewer.

**Status:** `human_needed` — programmatic verification passes 16/16; 5 ROADMAP Success Criteria items require human verification on real OS pickers + real fixture loads + real keyboard accelerators.

---
*Verified: 2026-05-11T21:25:00Z*
*Verifier: Claude (gsd-verifier)*

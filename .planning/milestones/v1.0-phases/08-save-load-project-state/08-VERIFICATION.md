---
phase: 08-save-load-project-state
type: verification
verified: 2026-04-26T09:41:52Z
status: issues-found
score: 6/8 must-haves verified (2 partial)
re_verification: false
diff_base: 552389e
requirements_satisfied:
  fully: 1     # F9.1
  partially: 1 # F9.2 (recovery path broken; happy path works)
  total: 2     # F9 parent rolls up F9.1 + F9.2
gates:
  layer3: pass         # core/project-file.ts imports only node:path + types
  locked_files: pass   # scripts/cli.ts + src/core/sampler.ts byte-identical from 552389e
  cli_byte_for_byte: pass
  test_suite: pass     # 270 passed / 1 skipped / 3 todo / 0 failed
  web_typecheck: pass
  node_typecheck: pass-with-known-noise # pre-existing scripts/probe-per-anim.ts TS2339 (Phase 4 deferred)
  arch_spec: pass      # 10/10 incl. Phase 8 electron-import block
  uat_signoff: claimed-but-questioned # WR-09 reachability concern
issues:
  - id: VR-01
    severity: warning
    category: recovery-flow-reachability
    title: ".stmproj drop with missing skeleton routes to App.tsx generic error UI — AppShell never mounts → no Locate-skeleton recovery affordance"
    files:
      - src/renderer/src/App.tsx (lines 78-80, 125-134)
      - src/renderer/src/components/AppShell.tsx (skeletonNotFoundError state at 145-154)
    impact: "D-149 locate-skeleton recovery cannot trigger from .stmproj drop path. UAT signoff (Gate 3) claims this path was tested; code review WR-09 also flags this. Either UAT was verified through a different path, or Gate 3 missed the failure."
    addresses_review: WR-09
  - id: VR-02
    severity: warning
    category: recovery-flow-reachability
    title: "Toolbar Open path → SkeletonNotFoundOnLoadError stashes empty strings into recovery state, making the Locate-skeleton button silently broken"
    files:
      - src/renderer/src/components/AppShell.tsx (lines 518-546)
      - src/main/project-io.ts (line 469 rejects empty projectPath)
    impact: "Cmd+O / Open button + missing skeleton → AppShell mounts banner with originalSkeletonPath='' and projectPath=''. Click 'Locate skeleton…' → reloadProjectWithSkeleton({projectPath:''}) → main rejects with kind:'Unknown', message:'projectPath must be a .stmproj path'. User sees a bare 'Unknown:' banner instead of recovery."
    addresses_review: WR-02
  - id: VR-03
    severity: warning
    category: dirty-guard-coverage
    title: "DropZone.onBeforeDrop is exposed but App.tsx never wires it — new-skeleton-drop and new-project-drop dirty-guard paths are not reachable"
    files:
      - src/renderer/src/components/DropZone.tsx (line 61, 71, 122-138)
      - src/renderer/src/App.tsx (lines 92-98 — DropZone receives onLoad, onLoadStart, onProjectDrop, onProjectDropStart only — no onBeforeDrop)
      - src/renderer/src/components/AppShell.tsx (saveQuitDialogState 'new-skeleton-drop' / 'new-project-drop' reasons documented at line 857-858 but never set)
    impact: "D-143 specifies the dirty-guard fires on app-close + new-skeleton-drop + new-project-drop. Only app-close is wired (before-quit listener at AppShell:614-628). Dropping a new .json or .stmproj onto a dirty session silently discards the user's unsaved overrides — exactly the case D-143 protects against. SaveQuitDialog supports the two reasons in its discriminator but they have no live trigger. Two it.todo specs in tests/renderer/save-load.spec.tsx (lines 129, 173) reflect this gap."
    addresses_review: implicit-D-143-coverage-gap
overrides_applied: 0
---

# Phase 8: Save/Load project state — Verification Report

**Phase Goal (ROADMAP §Phase 8):** Ship the round-trip — set overrides → Save → close app → Load → overrides restored. Deliver F9.1 (session JSON contains skeleton path, atlas/images root, overrides, settings) and F9.2 (Load restores overrides + settings + recomputes peaks).

**Verified:** 2026-04-26T09:41:52Z
**Status:** issues-found
**Re-verification:** No — initial verification.
**Diff base for locked-file checks:** 552389e (phase base)

---

## Goal Achievement

### Observable Truths (derived from F9.1 + F9.2 + ROADMAP exit criterion + D-140..D-156)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| T1 | A `.stmproj` v1 file persists skeleton path, atlas/images hints, overrides, samplingHz, lastOutDir, sortColumn/Dir, documentation slot — F9.1 | VERIFIED | `src/core/project-file.ts:84-202` `validateProjectFile`; `src/core/project-file.ts:239-256` `serializeProjectFile`; D-145 fields present in `ProjectFileV1` at `src/shared/types.ts:519`. Round-trip locked by `tests/core/project-file.spec.ts` (8 cases GREEN). |
| T2 | Save uses atomic `<path>.tmp` + `fs.rename` so a crash mid-write does not corrupt the previous file | VERIFIED | `src/main/project-io.ts:152-200 writeProjectFileAtomic`. Test 8-XX-08 'atomic-write tmp then rename' GREEN. UAT Gate 5 signed off. |
| T3 | Load chains parse → validate → migrate → materialize → loadSkeleton → sampleSkeleton → buildSummary, returning a MaterializedProject — F9.2 happy path | VERIFIED | `src/main/project-io.ts:249-396 handleProjectOpenFromPath`. Sampler is re-run (line 367); F9.2 "recomputes peaks" honored. UAT Gate 1 signed off. |
| T4 | Load with stale overrides drops dropped keys + reports them — D-150 | VERIFIED | `src/main/project-io.ts:377-383` (intersection); `src/renderer/src/components/AppShell.tsx:512-514` (banner mount via `staleOverrideNotice`). Test 8-XX-11 GREEN. |
| T5 | Save UX: toolbar buttons, Cmd/Ctrl+S/O, dirty marker `•`, before-quit dirty-guard with Save/Don't Save/Cancel — D-140..D-144 | VERIFIED | AppShell Save/Open buttons + `useEffect` keyboard listener at lines 589-606; dirty derivation at 450-460; SaveQuitDialog mount at 863-889; before-quit handler at 614-628. UAT Gate 4 signed off. |
| T6 | DropZone branches `.json` → skeleton-load, `.stmproj` → project-load, other → typed rejection — D-142 | VERIFIED | `src/renderer/src/components/DropZone.tsx:104-160`. UAT Gate 2 signed off. |
| T7 | Missing skeleton on Load surfaces `SkeletonNotFoundOnLoadError` and presents an inline "Locate skeleton…" recovery affordance — D-149 | **FAILED** | Two reachability bugs prevent recovery from triggering correctly: (a) **`.stmproj` drop path** transitions App.tsx to `status:'error'` (line 79) — the generic error UI mounts (lines 125-134); AppShell + its `skeletonNotFoundError` state never mount, so no "Locate skeleton…" button renders. (b) **Toolbar Open path** mounts the banner but stuffs `projectPath:''` and `originalSkeletonPath:''` into `skeletonNotFoundError` (AppShell:529-538); clicking Locate calls `reloadProjectWithSkeleton({projectPath:''})` which main rejects (project-io.ts:469) with `kind:'Unknown'`. UAT Gate 3 was signed off — one of the entry points must have been used in a way that bypasses both bugs (e.g., recovery state hand-set via dev-tools, or test artifact remnants). See Issues VR-01 + VR-02. |
| T8 | Dirty-guard fires on app close + new-skeleton-drop + new-project-drop — D-143 | **PARTIAL** | App close: VERIFIED (AppShell:614-628). New-skeleton-drop / new-project-drop: NOT wired — App.tsx never passes `onBeforeDrop` to DropZone (App.tsx:92-98), so DropZone's hook (lines 122-138) never fires. SaveQuitDialog supports the two reasons in its `bodyCopyFor` switch (SaveQuitDialog.tsx:54-69) but `setSaveQuitDialogState` is only invoked with `reason:'quit'` (AppShell:620). Two `it.todo` placeholders in `tests/renderer/save-load.spec.tsx:129,173` document the deferred coverage. See Issue VR-03. |

**Score:** 6/8 truths verified (T7 FAILED, T8 PARTIAL).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/project-file.ts` | Pure-TS schema/validator/migration/path helpers; Layer 3 strict | VERIFIED | 386 lines; 6 exports (validateProjectFile, migrate, serializeProjectFile, materializeProjectFile, relativizePath, absolutizePath). Imports only `node:path` + types. arch.spec block at `tests/arch.spec.ts:136-154` passes. |
| `src/main/project-io.ts` | 6 async handlers wrapping dialog + fs + loader/sampler chain | VERIFIED | 555 lines; 6 exports (handleProjectSave, handleProjectSaveAs, handleProjectOpen, handleProjectOpenFromPath, handleLocateSkeleton, handleProjectReloadWithSkeleton). Atomic-write idiom at 152-200. |
| `src/main/ipc.ts` | 6 new IPC channels registered | VERIFIED | Channels at lines 512, 515, 518, 519, 522, 530 (project:save, save-as, open, open-from-path, locate-skeleton, reload-with-skeleton). Existing `'skeleton:load'` preserved. |
| `src/main/index.ts` | before-quit dirty-guard + open-file scaffold + Pitfall-1 setTimeout deferral | VERIFIED | `let isQuitting` flag at line 35; `app.on('before-quit')` at 76-89; `ipcMain.on('project:confirm-quit-proceed')` at 91-97; `app.on('open-file')` at 107-111. Two `setTimeout(() => app.quit(), 0)` deferrals (lines 85, 96) per Pitfall 1. |
| `src/preload/index.ts` | 8 new contextBridge methods (6 invoke + 1 listener + 1 sender + openProjectFromFile File-wrapper) | VERIFIED | All 9 verified at lines 150-240 (saveProject, saveProjectAs, openProject, openProjectFromFile, openProjectFromPath, locateSkeleton, reloadProjectWithSkeleton, onCheckDirtyBeforeQuit, confirmQuitProceed). webUtils.getPathForFile pattern at line 169-178. |
| `src/renderer/src/modals/SaveQuitDialog.tsx` | Hand-rolled ARIA 3-button modal cloning OverrideDialog | VERIFIED | 133 lines; 3 buttons (Save / Don't Save / Cancel). useFocusTrap at line 79; role="dialog" + aria-modal="true" at 86-87; bodyCopyFor switch at 49-71 (3 reasons). |
| `src/renderer/src/components/AppShell.tsx` | Save/Open buttons + state slots + dirty derive + Cmd+S/O listener + dirty-marker chip + SaveQuitDialog mount + locate-skeleton flow + stale-override banner | VERIFIED with caveats | 929 lines. All artifacts present (currentProjectPath at 103, lastSaved at 114, saveQuitDialogState at 126, saveInFlight at 131, staleOverrideNotice at 133, skeletonNotFoundError at 145, isDirty at 450, onClickSave at 467, mountOpenResponse at 505, onClickOpen at 518, onClickLocateSkeleton at 559, keyboard listener at 589, before-quit listener at 614). **Caveats:** locate-skeleton recovery via toolbar Open is broken (VR-02); dirty-guard for new-skeleton-drop / new-project-drop never wired (VR-03). |
| `src/renderer/src/components/DropZone.tsx` | `.json` / `.stmproj` / reject extension branch with optional onBeforeDrop dirty-guard hook | VERIFIED with caveat | 183 lines; extension branch at 104-160. **Caveat:** `onBeforeDrop` hook is exported and accepted (line 61) but no caller wires it — see VR-03. |
| `src/shared/types.ts` | Phase 8 contracts: ProjectFileV1, ProjectFile, AppSessionState, MaterializedProject, SaveResponse, OpenResponse, LocateSkeletonResponse, 4 new SerializableError kinds, 9 new Api members | VERIFIED | All present (lines 490-589 region). SerializableError union has 8 kinds total (4 new). Api interface has 9 new members. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| AppShell.onClickSave | window.api.saveProject / saveProjectAs | preload contextBridge | WIRED | AppShell:467-493 → preload:150-156 → ipc.ts:512-517 → project-io:88-135. End-to-end save chain verified. |
| AppShell.onClickOpen | window.api.openProject | preload contextBridge | WIRED | AppShell:518-546 → preload:158 → ipc.ts:518 → project-io:211-226. **But broken recovery branch** — see VR-02. |
| App.tsx handleProjectLoad | window.api.openProjectFromFile (DropZone path) | DropZone.handleDrop | WIRED happy path; **broken on SkeletonNotFoundOnLoadError** | App.tsx:70-81 routes !ok to `status:'error'` (line 79). For SkeletonNotFoundOnLoadError this means generic error UI mounts; AppShell never mounts; recovery affordance unreachable — VR-01. |
| AppShell.onClickLocateSkeleton | window.api.locateSkeleton + reloadProjectWithSkeleton | preload contextBridge | WIRED for the IPC, but data is empty when triggered via toolbar Open path (VR-02) | AppShell:559-582 → preload:188-205 → ipc.ts:522-533 → project-io:411-555. The chain itself is sound; the failure is upstream where `originalSkeletonPath` and `projectPath` are populated with empty strings. |
| AppShell before-quit | ipcMain.on('project:confirm-quit-proceed') | dual-one-way wiring | WIRED | main/index.ts:76-89 sends; preload:220-235 receives; AppShell:614-628 dispatches; preload:237-240 confirmProceeds. Pitfall 1 setTimeout deferral honored. |
| AppShell SaveQuitDialog new-skeleton-drop / new-project-drop | DropZone.onBeforeDrop | DropZone hook | **NOT WIRED** | DropZone exports the hook but App.tsx (lines 92-98) does not pass it; AppShell does not pass it through to App.tsx either. SaveQuitDialog reasons are dead code paths. — VR-03 |
| DropZone .stmproj branch | window.api.openProjectFromFile | preload contextBridge | WIRED | DropZone:128-129 → preload:169-178 → ipc.ts:519-521 → project-io:249-396. UAT Gate 2 signed off. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| AppShell stale-override banner | `staleOverrideNotice` | `initialProject.staleOverrideKeys` (App.tsx → projectLoaded → AppShell) AND `mountOpenResponse(project)` for in-AppShell Open | YES | Source path: project-io.ts intersection at 377-383; Open response carries the array; AppShell at 133 + 512-514 mounts the banner. |
| AppShell isDirty | `isDirty` (useMemo) | overrides Map + lastSaved + samplingHz | YES — produces non-stub boolean | AppShell:450-460 — depends on overrides set by user actions. Dirty flag updates in real time. |
| Filename chip | `currentProjectPath` + `isDirty` | `setCurrentProjectPath` from save success / open success | YES | AppShell:103 (state), 638-642 (render). Dirty marker `•` and basename derived consistently. |
| Locate-skeleton banner | `skeletonNotFoundError` | `onClickOpen` (toolbar Open path) on !ok response with kind === 'SkeletonNotFoundOnLoadError' | **PARTIAL — disconnected from drop path** | Toolbar path populates the state with empty strings (VR-02). Drop path never mounts AppShell at all (VR-01). The banner UI itself (lines 746-770) renders correctly when state is populated. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite green | `npm run test` | 270 passed / 1 skipped / 3 todo (incl. 2 phase-8 it.todos at save-load.spec.tsx:129,173) | PASS |
| Web typecheck | `npx tsc --noEmit -p tsconfig.web.json` | exit 0 | PASS |
| Node typecheck | `npx tsc --noEmit -p tsconfig.node.json` | scripts/probe-per-anim.ts(14,31) TS2339 — pre-existing Phase 4 deferred-items.md noise; no Phase 8 errors | PASS (with documented noise) |
| CLI byte-for-byte | `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` | exit 0; CIRCLE/SQUARE/TRIANGLE rows render in 22.4 ms — output identical to Phase 7 close (Phase 5 D-102 lock) | PASS |
| Locked-file diff: scripts/cli.ts | `git diff 552389e..HEAD -- scripts/cli.ts` | empty | PASS |
| Locked-file diff: src/core/sampler.ts | `git diff 552389e..HEAD -- src/core/sampler.ts` | empty | PASS |

### Decision Compliance Check (D-140..D-156)

| Decision | Description | Status | Evidence |
|----------|-------------|--------|----------|
| D-140 | Toolbar Save/Open + Cmd/Ctrl+S/O global shortcuts | VERIFIED | AppShell toolbar buttons + keyboard listener at 589-606. Modal-suppression check at 593 (`document.querySelector('[role="dialog"]')`). |
| D-141 | Explicit Save / Save As — no auto-save | VERIFIED | onClickSave at AppShell:467-493 dispatches saveProject when currentProjectPath !== null else saveProjectAs. |
| D-142 | Open via toolbar OR drag-drop `.stmproj` | VERIFIED | DropZone:104-132 dispatches on extension. UAT Gate 2 signed off. |
| D-143 | Dirty-guard on close + new-skeleton-drop + new-project-drop | **PARTIAL** | App close path WIRED. New-skeleton-drop and new-project-drop paths NOT WIRED — see VR-03. |
| D-144 | Dirty marker `•` prefix on filename chip | VERIFIED | AppShell:642 `{isDirty ? '• ' : ''}`. |
| D-145 | Project file persists exact field set | VERIFIED | `ProjectFileV1` interface at types.ts:519-530 enumerates all 10 fields. validateProjectFile gates each. |
| D-146 | samplingHz reserved field; default 120 when null | VERIFIED | project-file.ts:331 `file.samplingHz ?? 120`; AppShell threads via samplingHz prop. |
| D-147 | Defer ephemeral UI state to Phase 9 | VERIFIED | Schema does NOT include activeTab, scroll position, search query — only sortColumn/sortDir. |
| D-148 | Reserved `documentation: {}` slot | VERIFIED | serializeProjectFile:254 always writes `{}`; validator preserves opaque value (project-file.ts:135-144); test 'documentation slot preserved on round-trip' GREEN. |
| D-149 | Missing skeleton → inline error + Locate-skeleton picker | **FAILED** | The flow exists in code but is unreachable via the .stmproj drop path (VR-01) and is silently broken via the toolbar Open path (VR-02). |
| D-150 | Stale-override keys dropped + dismissible notice | VERIFIED | project-io.ts:377-383 intersection; AppShell banner at 133 + 512-514. |
| D-151 | Newer-version refusal | VERIFIED | validateProjectFile:102-110; surface via project-io.ts:303-311. Test 'newer version rejected (D-151)' GREEN. |
| D-152 | Missing atlas/images path → re-run F1.2 auto-discovery | VERIFIED | project-io.ts:329-332 passes `{}` to loadSkeleton when atlasPath is null. |
| D-153 | Default save location = skeleton's parent dir | VERIFIED | AppShell:475-478 derives `skeletonDir` from `summary.skeletonPath`; project-io.ts:124 uses it as defaultPath. |
| D-154 | `.stmproj` extension, JSON content | VERIFIED | project-io.ts:125 filter; serializeProjectFile produces JSON; JSON.stringify at project-io.ts:159. |
| D-155 | Relative paths against project file dir; absolute fallback for cross-volume | VERIFIED | relativizePath cross-volume detection at project-file.ts:359-373; round-trip test 'cross-volume falls back to absolute' GREEN. |
| D-156 | Hand-rolled validator, no runtime dep | VERIFIED | validateProjectFile at project-file.ts:84-202 — pure-TS, no `zod`, no schema lib. |

### Locked-File Invariant Check (Phase 5 D-102 + CLAUDE.md rule #3)

| File | Diff base | Result | Status |
|------|-----------|--------|--------|
| scripts/cli.ts | 552389e | `git diff 552389e..HEAD -- scripts/cli.ts \| wc -l` → 0 | PASS |
| src/core/sampler.ts | 552389e | `git diff 552389e..HEAD -- src/core/sampler.ts \| wc -l` → 0 | PASS |

CLI byte-for-byte sanity: `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` exits 0 with the Phase 7-close output preserved (CIRCLE 2.018 / SQUARE 1.500 / TRIANGLE 2.000 / 22.4 ms).

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| F9 (parent) | 08-01..05 | Save/Load project state | PARTIALLY-SATISFIED | Rolls up from F9.1 + F9.2; F9.2 has reachability defects in the recovery path (VR-01, VR-02). |
| F9.1 | 08-01..05 | Session JSON contains skeleton path, atlas/images root, overrides, settings (sampling rate) | SATISFIED | ProjectFileV1 schema (types.ts:519-530); validator + serializer + atomic write; UAT Gate 5 signed off. |
| F9.2 | 08-01..05 | Load restores overrides + settings; recomputes peaks | PARTIALLY-SATISFIED | Happy path works (UAT Gate 1 signed off, sampler re-runs at project-io.ts:367). Recovery path for missing skeleton (D-149) has VR-01 + VR-02 reachability gaps. The narrow F9.2 contract is met for the success case. |

No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/renderer/src/components/AppShell.tsx | 522-528 | Inline TODO-style comment acknowledging the recovery flow is "best-effort" via toolbar Open without correcting it | Warning | The comment IS a self-acknowledgement that the recovery affordance is incomplete — but ships. Pairs with VR-02. |
| src/renderer/src/components/AppShell.tsx | 531-538 | Hardcoded empty strings into recovery state (`originalSkeletonPath: ''`, `projectPath: ''`, `mergedOverrides: {}`) | Warning | Causes the downstream RPC to reject (project-io.ts:469). Pairs with VR-02. |
| src/renderer/src/App.tsx | 79 | `setState({ status: 'error', ... })` for any non-ok OpenResponse — no special-case for SkeletonNotFoundOnLoadError | Warning | Drop path bypasses AppShell entirely, making D-149 recovery unreachable from the drop entry. Pairs with VR-01. |
| tests/renderer/save-load.spec.tsx | 129, 173 | `it.todo('dirty + drop opens guard')`, `it.todo('dropzone branch on stmproj')` | Info | The two `it.todo` placeholders explicitly defer coverage of the dirty-guard drop path (VR-03) and the stmproj drop branch behavior. VALIDATION.md notes them as "Plan 05 Task 2 Gates 2 + 4". |

### Human Verification Required

Manual UAT was claimed signed off 2026-04-26 across all 5 gates per VALIDATION.md, but the code walk surfaces concerns about Gate 3 (locate-skeleton). Recommend re-verification of one specific scenario:

#### 1. Locate-skeleton recovery flow via `.stmproj` drag-drop

**Test:** Save a project with overrides; quit cleanly; rename the source skeleton .json on disk; relaunch the app; **drag-drop the .stmproj** (not Cmd+O picker — that's a separate path).

**Expected per D-149 + VALIDATION.md Gate 3:** Inline banner appears: `Skeleton not found at <path>` with `Locate skeleton…` button; clicking the button opens the file picker; picking the renamed file restores overrides and rebuilds the rig.

**Actual per code walk (this verifier):** App.tsx:79 transitions to `status: 'error'`, mounting the generic error UI at App.tsx:125-134 — there is NO "Locate skeleton…" button on this path. AppShell does not mount, so the recovery state machine inside AppShell is unreachable.

**Why human:** The UAT signoff implies this passed. Either (a) the test was performed via Cmd+O instead of drag-drop and that path was ALSO broken in a different way (VR-02), (b) the test was performed in a way that masks both bugs, or (c) the code walk is misreading the wiring. Manual re-test with screencap would resolve.

#### 2. Dirty-guard on new-skeleton drop / new-project drop

**Test:** Drop SIMPLE_TEST.json → set TRIANGLE override to 50% (do NOT save) → drop a different .json onto the DropZone.

**Expected per D-143:** SaveQuitDialog mounts with reason 'new-skeleton-drop' offering Save / Don't Save / Cancel.

**Actual per code walk:** DropZone has no caller for `onBeforeDrop`; the override mutation is silently lost when the new skeleton replaces it. The `it.todo` at save-load.spec.tsx:129 ('dirty + drop opens guard') documents this as deferred. UAT did not exercise this scenario.

**Why human:** Confirms scope of VR-03. Either the gap is intentional (deferred to Phase 9 polish) and should be documented as such, or it should be fixed before /gsd-verify-work 8 closes.

### Deferred Items

None of the identified gaps are explicitly addressed in later milestone phases. ROADMAP §Phase 9 (complex-rig hardening + polish) does NOT enumerate any of:
- VR-01 (`.stmproj` drop path → SkeletonNotFoundOnLoadError)
- VR-02 (toolbar Open path → empty recovery state)
- VR-03 (DropZone onBeforeDrop never wired)

Phase 9 deliverables in ROADMAP are: UI virtualization, sampler worker, sampling-rate Settings modal, rig-info tooltip, in-app help. None of these subsume the Phase 8 recovery / dirty-guard concerns.

The 08-REVIEW.md "Recommended Bundling" section names WR-02 and WR-09 as "Recovery-flow re-verification (separate effort)" — this suggests intent to address them, but no plan or commit currently schedules the work.

### Gaps Summary

Phase 8 ships the F9.1 contract solidly (schema, atomic-write, validator, migration ladder, all locks honored). The F9.2 happy path round-trip works end-to-end. The two genuine concerns are reachability bugs around the F9.2 recovery affordance (D-149) and the F9.2-adjacent dirty-guard scope (D-143):

1. **VR-01 + VR-02:** D-149 locate-skeleton recovery is unreachable from .stmproj drop and silently broken from toolbar Open. Code review WR-02 + WR-09 already flagged this. UAT signoff for Gate 3 stands in tension with the code walk; one of the two needs reconciling.
2. **VR-03:** D-143 dirty-guard for new-skeleton-drop / new-project-drop is undelivered. Two `it.todo` placeholders document the gap; SaveQuitDialog supports the reasons but they are never triggered.

The locked-file invariants are immaculate (cli.ts + sampler.ts byte-identical from 552389e). The Layer 3 boundary is intact (project-file.ts imports only `node:path` + types; arch.spec auto-scan + explicit electron-import block both green). The full test suite is green at 270/1/3.

**Recommendation:** classify these as `gaps_found` worth a short closure plan (08-06) before `/gsd-verify-work 8` closes. The closure plan should:
- Wire `onBeforeDrop` from App.tsx → DropZone (one-line prop + AppShell-side hook that opens SaveQuitDialog with the appropriate reason).
- Either (a) thread `originalSkeletonPath` + `projectPath` through `SerializableError` for the toolbar Open recovery path, or (b) hide the "Locate skeleton…" button when the cached state is empty per WR-02 fix (b).
- Add an App.tsx branch that detects `error.kind === 'SkeletonNotFoundOnLoadError'` and either mounts AppShell with pre-set recovery state or surfaces a dedicated recovery banner per WR-09 fix (b).

Alternatively, if the user accepts the current behavior and chooses to defer to Phase 9, the gaps should be promoted to explicit Phase 9 deliverables in ROADMAP.md so they are not lost.

---

_Verified: 2026-04-26T09:41:52Z_
_Verifier: Claude (gsd-verifier)_
_Diff base: 552389e_

---
phase: 30-safety-buffer-in-optimize-dialog
verified: 2026-05-08T11:50:00Z
status: gaps_found
score: 2/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
gaps:
  - truth: "User opens Optimize Assets dialog and sees integer-percent safety-buffer control initially at 0%; export plan summary tiles update REACTIVELY as buffer changes (ROADMAP SC #1)"
    status: failed
    reason: "OptimizeDialog plan is captured at dialog open and never rebuilt. Buffer input is functionally inert — typing changes the input value but does NOT rebuild props.plan; summary tiles (Used Files / to Resize / Saving est. pixels at OptimizeDialog.tsx:137, 353-366) all consume props.plan which is the stale snapshot from open time. Plan 30-03 SUMMARY explicitly chose 'Option C — distributed memos' over the planner-mandated 'Option A — AppShell owns plan memo' (Plan 30-03 must-have line 28-29) but the chosen Option C does not actually centralize the dialog's plan into a memo at all — it only extended dep arrays of the existing useCallback consumers (onClickOptimize / onConflictPickDifferent / savingsPctMemo / atlasPreviewState). None of those rebuild exportDialogState.plan when the dialog is open and buffer changes. The reactive contract from ROADMAP SC #1 is broken. (CR-01 from 30-REVIEW.md.)"
    artifacts:
      - path: "src/renderer/src/components/AppShell.tsx"
        issue: "Lines 636-643 (onClickOptimize) build the plan once at open and call setExportDialogState({ plan, outDir }). Line 1996 mounts OptimizeDialog with plan={exportDialogState.plan}. There is NO useEffect or memo that calls setExportDialogState((prev) => ({ ...prev, plan: rebuiltPlan })) when safetyBufferPercentLocal changes while exportDialogState !== null. Verified by grep: setExportDialogState appears at lines 642, 685 (outDir-only update), 715, 726, 756, 764 — none react to safetyBufferPercentLocal."
      - path: "src/renderer/src/modals/OptimizeDialog.tsx"
        issue: "Component does NOT internally rebuild plan from summary+overrides+buffer. Buffer prop (line 442) only feeds the input value. props.plan (line 1996 in AppShell) is consumed directly for tiles (lines 137, 353-370), Pre-Flight body (line 480), Plan body (line 483), Start button enable (line 516), and CRITICALLY window.api.startExport(props.plan, ...) at line 266-267. Setting buffer to 5% in the input and clicking Start will export with buffer=0 (whatever value was at dialog-open time)."
    missing:
      - "Reactive plan rebuild when safetyBufferPercentLocal changes while exportDialogState !== null. Per Plan 30-03 must-have line 28: 'Option A — AppShell owns plan memo: AppShell exportDialogState is split — plan is lifted into a useMemo keyed on [effectiveSummary, overrides, safetyBufferPercentLocal, modalOpen]'. Suggested fix per 30-REVIEW.md CR-01: useEffect that calls setExportDialogState((prev) => prev ? { ...prev, plan: buildExportPlan(summary, overrides, { safetyBufferPercent: safetyBufferPercentLocal }) } : null) keyed on [safetyBufferPercentLocal, summary, overrides, exportDialogState !== null]."

  - truth: "Buffer multiplies each row's effective scale (peak AND override) by (1 + buffer/100) BEFORE outW/outH; rows past source dims are hard-capped uniformly on both axes (ROADMAP SC #2 — round-trip Spine UV sampling test passes from user's perspective)"
    status: failed
    reason: "The MATH is correct in src/core/export.ts and src/renderer/src/lib/export-view.ts (Plan 30-02 Tasks 2+3 verified by 8 BUFFER-01..03 tests + 3 parity regex tests, all GREEN). But the user-facing acceptance criterion 'with buffer set to e.g. 5%, the export pipeline grows each row's effective scale by ×1.05 BEFORE computing outW/outH' is broken end-to-end because of CR-01: the user CANNOT cause a 5%-buffered export through the UI. Setting buffer=5 in the dialog and clicking Start invokes window.api.startExport(props.plan, ...) at OptimizeDialog.tsx:266-267 with the stale plan that was captured at buffer=0. The math runs correctly inside buildExportPlan when called WITH a non-zero opts.safetyBufferPercent — but the dialog never calls it with a non-zero value after open."
    artifacts:
      - path: "src/renderer/src/modals/OptimizeDialog.tsx"
        issue: "Line 266-267: window.api.startExport(props.plan, ...) consumes the dialog's plan prop directly. props.plan is exportDialogState.plan from AppShell — captured at dialog open with whatever safetyBufferPercentLocal value was THEN, never refreshed."
    missing:
      - "Same fix as CR-01: AppShell must rebuild exportDialogState.plan when safetyBufferPercentLocal changes while the dialog is open. Without this, the buffer math (correct in isolation) cannot be invoked end-to-end through the UI surface."

  - truth: "AtlasPreviewModal renders the same buffered atlas projection as OptimizeDialog and the HTML doc-export (consistency invariant)"
    status: failed
    reason: "AtlasPreviewModal.tsx:115-118 calls buildAtlasPreview(props.summary, props.overrides, { mode, maxPageDim }) without threading safetyBufferPercent. The opts object omits the field; the deps array omits the field. Modal has no safetyBufferPercent prop at all. AppShell's mount of AtlasPreviewModal at line 2036-2045 does not pass the buffer either. (CR-02 from 30-REVIEW.md.) This violates the consistency that the rest of Phase 30 carefully maintains: AppShell's atlasPreviewState memo (line 843) AND savingsPctMemo (line 861) both thread the buffer; AtlasPreviewModal does not. Result: when user sets non-zero buffer in OptimizeDialog and uses cross-nav 'Atlas Preview' button, modal shows un-buffered (smaller) tile dims — diverges from what will actually export."
    artifacts:
      - path: "src/renderer/src/modals/AtlasPreviewModal.tsx"
        issue: "Line 116: buildAtlasPreview(props.summary, props.overrides, { mode, maxPageDim }) — safetyBufferPercent omitted. No prop received from AppShell."
      - path: "src/renderer/src/components/AppShell.tsx"
        issue: "Line 2036-2045 AtlasPreviewModal mount has summary, overrides, onJumpToRegion, onClose, onOpenOptimizeDialog props — no safetyBufferPercent. Compare to AtlasPreviewModal opening from the OptimizeDialog footer (which would carry buffer state)."
    missing:
      - "AtlasPreviewModalProps gains safetyBufferPercent: number; AppShell threads safetyBufferPercent={safetyBufferPercentLocal} at the mount; modal's projection useMemo passes opts.safetyBufferPercent through and adds the field to its deps array."

  - truth: "src/core/atlas-preview.ts and src/renderer/src/lib/atlas-preview-view.ts maintain byte-identical mirror parity (Layer 3 inline-copy invariant from atlas-preview-view.ts:14-19 and Phase 4 D-75 / Phase 6 D-108)"
    status: failed
    reason: "atlas-preview-view.ts (renderer mirror) was updated by Plan 30-03 to accept and thread safetyBufferPercent through buildAtlasPreview opts (line 66) and deriveInputs param (line 175) and the buildExportPlan call (line 197). src/core/atlas-preview.ts (canonical) was NOT updated: line 65 opts is still { mode, maxPageDim }; line 192 calls buildExportPlan(summary, overrides) with no opts arg. Function signatures of the two 'byte-identical' mirrors now differ. (CR-03 from 30-REVIEW.md.) The parity tests at tests/core/atlas-preview.spec.ts:381-444 pass only because their 5 test cases all omit safetyBufferPercent from the opts (default behavior is byte-identical due to D-07 no-op short-circuit) — the parity contract does not assert that the safetyBufferPercent field exists in both copies. Loose tests; broken contract."
    artifacts:
      - path: "src/core/atlas-preview.ts"
        issue: "Line 65 opts shape: { mode, maxPageDim } — no safetyBufferPercent. Line 73 deriveInputs call: 4 args (summary, overrides, opts.mode, excluded) — no buffer. Line 192 buildExportPlan call: 2 args (summary, overrides) — no opts. All three locations diverge from atlas-preview-view.ts."
    missing:
      - "Mirror the Plan 30-03 changes byte-identically into src/core/atlas-preview.ts (3 sites). Optionally tighten tests/core/atlas-preview.spec.ts parity describe block with a regex assertion that BOTH files contain `safetyBufferPercent?: number` in the buildAtlasPreview opts shape, mirroring the Plan 30-02 parity-regex pattern in tests/core/export.spec.ts."

  - truth: "Field-name collision between Documentation.safetyBufferPercent (Phase 20 — range 0-100) and the new top-level safetyBufferPercent (Phase 30 — range 0-25) does not produce conflicting user-visible behavior"
    status: failed
    reason: "Plan 30-01 must-haves explicitly acknowledged the collision (line 29: 'two MUST NOT be merged or referenced from each other; treat them as independent fields that share a name'). But the consequence is silent semantic disagreement: src/main/doc-export.ts:292 reads payload.documentation.safetyBufferPercent (legacy 0-100 metadata-only) for the HTML report's 'Optimization Config' card; src/core/export.ts buildExportPlan reads BuildExportPlanOptions.safetyBufferPercent (new 0-25). For a v1.2-era project with documentation.safetyBufferPercent: 50 (legacy 'metadata only' value), the user opens v1.3.1, exports textures with buffer=0 (new top-level field defaults to 0), exports HTML which advertises '50%' buffer in the optimization-config card. The 'Safety Buffer' user-facing concept is now represented by two independently-editable fields with different ranges (50 vs 25 max!) — clear UX disagreement. (CR-04 from 30-REVIEW.md.) DocumentationBuilderDialog.tsx:823-849 input still says 'Metadata only. Captured in the HTML export; export math wiring deferred to a future phase.' — Phase 30 IS the future phase; the wiring did not happen."
    artifacts:
      - path: "src/core/documentation.ts"
        issue: "Lines 65-66: Documentation interface still declares safetyBufferPercent: number (range 0-100). Lines 75: DEFAULT_DOCUMENTATION still has safetyBufferPercent: 0. Lines 220-231: validateDocumentation still range-checks 0-100. Field is untouched by Phase 30; coexists with the new project-root field."
      - path: "src/main/doc-export.ts"
        issue: "Line 292: const safetyRaw = payload.documentation.safetyBufferPercent — reads legacy 0-100 field for the HTML report. Does NOT read the new top-level safetyBufferPercent."
      - path: "src/renderer/src/modals/DocumentationBuilderDialog.tsx"
        issue: "Lines 823-849: SafetyBufferSection input continues to expose the legacy 0-100 field. Label copy 'Metadata only' is now stale (Phase 30 introduces a separate functional field)."
    missing:
      - "An explicit migration / deprecation / sync story per CR-04. Three options: (A) deprecate Documentation.safetyBufferPercent and migrate it into the new top-level on materialize; update doc-export to read top-level. (B) sync the two fields in AppShell. (C) explicit deprecation notice + read-only doc-builder display; doc-export reads top-level. Option A is cleanest end-state. The current state — two independent fields, never synced, divergent ranges — is a user-facing bug."

deferred: []

human_verification: []
---

# Phase 30: Safety Buffer in Optimize Dialog — Verification Report

**Phase Goal:** After this phase, the user can dial in a percentage safety buffer in the Optimize dialog that multiplicatively grows every row's effective export scale (calculated peak AND user-set overrides) before the export plan is computed — capped uniformly at source dimensions so D-91 (no texture surpasses source dims) and the Phase 6 uniform-only invariant are both preserved.

**Verified:** 2026-05-08T11:50:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

The phase delivers the persistence (BUFFER-03), the export math (BUFFER-01 internals, BUFFER-02), and the input UI element (BUFFER-01 input element). But the **wiring between the input and the export pipeline is broken** — the user can type a buffer value, see the input update, but the actual export and the dialog's reactive tiles consume a stale plan captured at dialog-open time.

The phase goal as stated requires the user to be ABLE to "dial in a percentage safety buffer ... that multiplicatively grows every row's effective export scale BEFORE the export plan is computed". Today the user CAN dial the buffer in the input, but cannot cause it to affect the export plan after the dialog has opened. The goal is not achieved end-to-end despite all individual pieces being present.

### Observable Truths (from ROADMAP Success Criteria)

| #   | Truth                                                                                                                                                  | Status     | Evidence                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | User opens Optimize Assets dialog and sees integer-percent safety-buffer control initially at 0%; **export plan summary tiles update REACTIVELY as buffer changes** | ✗ FAILED   | Input UI lands (verified). Reactive recompute is broken: `exportDialogState.plan` is captured at open and never rebuilt — tiles & Pre-Flight all consume stale plan. (CR-01.)     |
| 2   | Buffer multiplies each row's effective scale (peak AND override) by (1 + buffer/100) BEFORE outW/outH; rows past source dims are hard-capped uniformly | ✗ FAILED end-to-end | Math is correct in isolation (8 BUFFER tests + 3 parity tests GREEN). User-facing failure: setting buffer in dialog and clicking Start exports with buffer=0 (CR-01 stale plan).       |
| 3   | Non-zero buffer persists in `.stmproj` v1 schema; v1.2-era files load with buffer=0; schema version stays at 1                                         | ✓ VERIFIED | 6 round-trip tests GREEN. Forward-compat pre-massage at project-file.ts:206-208. Schema version literal `version: 1;` preserved (1 hit) with 0 hits for `version: 2`.             |
| 4   | Layer 3 invariant preserved — `grep -rn "from 'sharp'" src/core/` returns 0 hits                                                                        | ✓ VERIFIED | `grep -rn "from 'sharp'" src/core/` returns 0; `grep -rn "from 'electron'" src/core/` returns 0. Buffer math is pure arithmetic (Math.min, *, /).                                |
| 5   | Phase 22.1 override-aware passthrough partition continues to work correctly when buffer is non-zero (a row that was passthrough at 1.0× moves into resize bucket at 1.05×) | ✗ FAILED end-to-end | Math is correct (T5 in Phase 30 BUFFER-01..03 describe block GREEN). User-facing failure: same CR-01 stale-plan issue prevents the partition behavior from being observable in the dialog after typing a buffer. |

**Score:** 2/5 truths verified end-to-end (truths 3 + 4). Truths 1, 2, 5 are CODE-LEVEL CORRECT IN ISOLATION but FAILED end-to-end due to the missing reactive-plan-rebuild wiring (CR-01).

### Required Artifacts

| Artifact                                                | Expected                                                                       | Status     | Details                                                                                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/shared/types.ts`                                   | 5 type touches (4 required + 1 optional ExportRow.bufferCapped)                | ✓ VERIFIED | 7 `safetyBufferPercent` mentions; 1 `bufferCapped?: boolean`; schema version unchanged.                                                                                        |
| `src/core/project-file.ts`                              | Validator pre-massage + range check + serializer + materializer                | ✓ VERIFIED | 11 `safetyBufferPercent` mentions; pre-massage + range check at lines 206-218; materializer fallback `?? 0`.                                                                   |
| `src/core/export.ts`                                    | BuildExportPlanOptions field + buffer math + bufferCapped narrow predicate     | ✓ VERIFIED | 4 `safetyBufferPercent` mentions; `bufferPct === 0 ? rawEffScale : ...` short-circuit; `Math.min(safeScale(bufferedScale), 1)` clamp. Acc.bufferCapped propagated symmetrically. |
| `src/renderer/src/lib/export-view.ts`                   | Byte-identical mirror of core/export.ts buffer math                            | ✓ VERIFIED | 4 `safetyBufferPercent` mentions; lockstep with core/export.ts. 3 parity regex tests in tests/core/export.spec.ts GREEN.                                                       |
| `src/main/project-io.ts`                                | 3 IPC envelope sites threaded with defensive integer coerce                    | ✓ VERIFIED | 22 `safetyBufferPercent` mentions; defensive coerce at recovery + resample seams.                                                                                              |
| `src/renderer/src/components/AppShell.tsx`              | safetyBufferPercentLocal lifecycle + 4 buildExportPlan call sites              | ⚠️ PARTIAL  | Lifecycle + 4 call sites threaded; OptimizeDialog mount passes prop. **MISSING: reactive rebuild of exportDialogState.plan when buffer changes while dialog is open** (CR-01).  |
| `src/renderer/src/modals/OptimizeDialog.tsx`            | Quality group + integer input + clamp + tooltip + ARIA + disabled-state        | ✓ VERIFIED | All 12 buffer tests GREEN. Quality group container + sharpen toggle relocation correct. Input clamp + ARIA + tooltip verbatim D-15.                                            |
| `src/renderer/src/lib/atlas-preview-view.ts`            | buildAtlasPreview opts shape extended; deriveInputs threading                  | ✓ VERIFIED | safetyBufferPercent threaded through opts + deriveInputs + buildExportPlan call (line 197).                                                                                    |
| `src/core/atlas-preview.ts`                             | Byte-identical mirror of atlas-preview-view.ts opts shape                      | ✗ MISSING  | Core copy NOT updated. Line 65 opts: { mode, maxPageDim } — no safetyBufferPercent. Line 192 buildExportPlan call: 2 args — no opts. Parity contract broken. (CR-03.)            |
| `src/renderer/src/modals/AtlasPreviewModal.tsx`         | Threads safetyBufferPercent to its buildAtlasPreview call                      | ✗ MISSING  | Line 116: opts omits safetyBufferPercent; deps array omits it; modal has no prop for it; AppShell mount at 2036-2045 does not pass it. (CR-02.)                                  |
| `src/core/documentation.ts` + `src/main/doc-export.ts`  | Reconciliation between legacy Documentation.safetyBufferPercent (0-100) and new top-level (0-25) | ✗ MISSING  | Two independent fields, never synced. Doc-export reads legacy field for HTML report; export math reads new field. User-facing semantic disagreement. (CR-04.)                  |
| `tests/core/export.spec.ts`                             | 11 new tests (8 BUFFER + 3 parity regex)                                       | ✓ VERIFIED | 11 GREEN.                                                                                                                                                                      |
| `tests/core/project-file.spec.ts`                       | 6 new BUFFER-03 round-trip tests                                               | ✓ VERIFIED | 6 GREEN.                                                                                                                                                                       |
| `tests/renderer/optimize-dialog-buffer.spec.tsx`        | 12 UI tests (input + clamp + tooltip + ARIA + disabled)                        | ✓ VERIFIED | 12 GREEN. **NOTE: tests verify input echo + onChange contract but do NOT verify reactive plan rebuild — IN-03 from review.**                                                    |

### Key Link Verification

| From                                  | To                                       | Via                                                              | Status      | Details                                                                                                                          |
| ------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| OptimizeDialog input                  | AppShell.safetyBufferPercentLocal        | onSafetyBufferChange={setSafetyBufferPercentLocal} (line 2013)    | ✓ WIRED     | Controlled-prop pattern; clamp at OptimizeDialog onChange handler.                                                              |
| AppShell.safetyBufferPercentLocal     | exportDialogState.plan                   | useEffect or useMemo rebuild — NONE EXISTS                        | ✗ NOT_WIRED | **The critical missing link.** Plan captured at dialog-open and never rebuilt. CR-01.                                            |
| exportDialogState.plan                | OptimizeDialog `props.plan`              | line 1996 `plan={exportDialogState.plan}`                         | ✓ WIRED     | Receives the (stale) plan reference.                                                                                            |
| OptimizeDialog `props.plan`           | window.api.startExport                   | line 266-267 `window.api.startExport(props.plan, ...)`            | ⚠️ STALE     | Wired technically but consumes the captured-at-open plan; no buffer effect on the IPC payload after open.                         |
| AppShell.safetyBufferPercentLocal     | atlasPreviewState (doc-builder snapshot) | useMemo at line 843 with `safetyBufferPercent: ...Local` + dep   | ✓ WIRED     | Doc-builder atlas-preview reflects buffer reactively.                                                                            |
| AppShell.safetyBufferPercentLocal     | savingsPctMemo                           | useMemo at line 861 with buffer in opts + dep at 872              | ✓ WIRED     | Savings memo reflects buffer reactively.                                                                                        |
| AppShell.safetyBufferPercentLocal     | AtlasPreviewModal projection             | NO prop, NO threading                                             | ✗ NOT_WIRED | Modal omits safetyBufferPercent entirely. CR-02.                                                                                  |
| atlas-preview-view.ts (renderer)      | atlas-preview.ts (core)                  | byte-identical mirror per Layer 3 D-75                            | ✗ NOT_WIRED | Core copy not updated; signatures diverge. CR-03.                                                                                |
| New top-level `safetyBufferPercent`   | Documentation.safetyBufferPercent legacy | NONE                                                              | ✗ NOT_WIRED | Two independent fields. doc-export reads legacy; export math reads new. CR-04.                                                    |

### Data-Flow Trace (Level 4)

| Artifact                                  | Data Variable               | Source                                                       | Produces Real Data | Status         |
| ----------------------------------------- | --------------------------- | ------------------------------------------------------------ | ------------------ | -------------- |
| OptimizeDialog summary tiles (lines 137, 364-370) | props.plan rows/passthrough | exportDialogState.plan (set ONCE at open in onClickOptimize) | No (after open)    | ⚠️ HOLLOW       |
| OptimizeDialog Pre-Flight body (line 480)         | props.plan rows             | exportDialogState.plan                                       | No (after open)    | ⚠️ HOLLOW       |
| OptimizeDialog Start IPC (line 266)               | props.plan                  | exportDialogState.plan                                       | No (after open)    | ⚠️ HOLLOW       |
| AtlasPreviewModal projection (line 116)           | props.summary, props.overrides + buffer | summary + overrides only — buffer omitted             | No (always)        | ✗ DISCONNECTED |
| HTML doc-export `safetyBufferPercent` (doc-export.ts:292) | payload.documentation.safetyBufferPercent | legacy field; ignores new top-level         | Wrong field        | ✗ DISCONNECTED |
| AppShell atlasPreviewState (line 843)             | buildAtlasPreview opts      | safetyBufferPercentLocal                                     | Yes                | ✓ FLOWING      |
| AppShell savingsPctMemo (line 861)                | buildExportPlan opts        | safetyBufferPercentLocal                                     | Yes                | ✓ FLOWING      |

### Behavioral Spot-Checks

| Behavior                                                              | Command                                                                          | Result                          | Status   |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------- | -------- |
| Phase 30 BUFFER-01..03 export-math tests pass                         | `npm run test -- tests/core/export.spec.ts -t "Phase 30 BUFFER"`                 | 11 passed                       | ✓ PASS   |
| BUFFER-03 project-file round-trip tests pass                          | `npm run test -- tests/core/project-file.spec.ts -t "Phase 30"`                  | 6 passed                        | ✓ PASS   |
| OptimizeDialog buffer-input UI tests pass                             | `npm run test -- tests/renderer/optimize-dialog-buffer.spec.tsx`                 | 12 passed                       | ✓ PASS   |
| Atlas-preview parity tests still pass (with the broken core mirror)   | `npm run test -- tests/core/atlas-preview.spec.ts`                               | 24 passed (loose — see CR-03)   | ⚠️ LOOSE  |
| Layer 3 invariant — no sharp imports in src/core/                     | `grep -rn "from 'sharp'" src/core/ \| wc -l`                                     | 0                               | ✓ PASS   |
| Schema version literal preserved                                       | `grep -c "version: 1;" src/shared/types.ts`                                     | 1 (0 for `version: 2`)          | ✓ PASS   |
| Reactive plan rebuild when buffer changes mid-dialog (functional acceptance) | code review: setExportDialogState called on safetyBufferPercentLocal change | 0 references                    | ✗ FAIL   |

### Requirements Coverage

| Requirement | Source Plan        | Description                                                                     | Status         | Evidence                                                                                                                                                                                  |
| ----------- | ------------------ | ------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUFFER-01   | 30-02-PLAN, 30-03-PLAN | Optimize Assets dialog exposes user-configurable safety-buffer percentage control that multiplicatively increases each row's calculated effective scale (and overrides) before plan computed | ⚠️ PARTIAL     | Math + UI input are correct; reactive contract from ROADMAP SC #1 is broken (CR-01). REQUIREMENTS.md §BUFFER-01 demands the control "when set" multiplies scale BEFORE plan computed — currently this only happens at dialog-open time. |
| BUFFER-02   | 30-02-PLAN         | Hard-cap at source dims uniformly on both axes when buffer would extrapolate beyond source PNG | ✓ SATISFIED    | T4 + T7 in Phase 30 BUFFER-01..03 describe block prove cap-binding + aspect-ratio invariant. Math correctness verified.                                                                  |
| BUFFER-03   | 30-01-PLAN         | Setting persists per-project in .stmproj v1 schema as additive optional field; missing field → 0; no schema-version bump | ✓ SATISFIED    | 6 round-trip tests GREEN. Validator pre-massage; serializer always-write; materializer back-fill; schema version unchanged.                                                              |

**No orphaned requirements.** All 3 BUFFER reqs from REQUIREMENTS.md:25-27 are covered by Plan 30-01/30-02/30-03 frontmatter.

### Anti-Patterns Found

| File                                                  | Line     | Pattern                                                          | Severity     | Impact                                                                                                                          |
| ----------------------------------------------------- | -------- | ---------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| src/renderer/src/components/AppShell.tsx              | 636-643, 1996 | Plan captured at open via setExportDialogState; never rebuilt    | 🛑 BLOCKER   | Buffer input is functionally inert until dialog reopen. Falsifies ROADMAP SC #1 reactivity. (CR-01.)                            |
| src/renderer/src/modals/AtlasPreviewModal.tsx         | 115-118  | buildAtlasPreview opts omits safetyBufferPercent                 | 🛑 BLOCKER   | Atlas-preview modal page count diverges from OptimizeDialog and HTML doc-export. (CR-02.)                                       |
| src/core/atlas-preview.ts                             | 62-66, 192 | Mirror parity broken — opts + buildExportPlan call diverge       | 🛑 BLOCKER   | Layer 3 byte-identical-copy invariant violated. (CR-03.)                                                                         |
| src/core/documentation.ts + src/main/doc-export.ts    | 65-66, 292 | Two independent safetyBufferPercent fields with different ranges | 🛑 BLOCKER   | HTML doc-export uses legacy 0-100 metadata field; export math uses new 0-25 field. User-facing semantic disagreement. (CR-04.)   |
| src/shared/types.ts                                   | 399-416  | ExportRow.bufferCapped JSDoc contradicts the predicate           | ⚠️ Warning    | Misleading docs mislead future maintainers. (WR-02.)                                                                              |
| src/shared/types.ts (reloadProjectWithSkeleton)       | 1195-1203 | IPC type omits safetyBufferPercent / sharpenOnExport / loaderMode | ⚠️ Warning    | Locate-skeleton recovery silently resets buffer (and sharpen + loaderMode) to defaults. Pre-existing bug also; CR-30 inherits.    |
| src/renderer/src/components/AppShell.tsx (untitled session) | 889-905 | Untitled session dirty check ignores safetyBufferPercentLocal    | ⚠️ Warning    | User can drop skeleton → set buffer → close → silent value loss (no SaveQuitDialog prompt). Pre-existing pattern; doubled down. |
| src/renderer/src/modals/OptimizeDialog.tsx            | 443-451  | Math.floor(parseInt(value, 10)) — Math.floor is no-op            | ℹ️ Info       | parseInt already truncates fractions; Math.floor is harmless redundancy.                                                        |
| src/core/export.ts (BuildExportPlanOptions JSDoc)     | 74-90    | "Math accepts any non-negative number" — actually accepts negatives too | ℹ️ Info  | Negative values produce shrink, not no-op. Clamp at OptimizeDialog catches; future direct callers warrant the heads-up.        |
| AppShell builds export plan THREE TIMES per render    | 639, 761, 843, 861 | Multiple buildExportPlan calls instead of single shared memo     | ℹ️ Info       | Out of v1 perf scope; defer to v1.3.2 polish. Optional consolidation to a single exportPlanMemo.                               |

### Human Verification Required

(none — all gaps are observable programmatically via grep + react-render-tree inspection)

### Gaps Summary

The phase delivers **persistence (BUFFER-03 — fully) + the export math (BUFFER-02 — fully) + the input UI element (BUFFER-01 — partially)** but the **wiring between the input and the plan recomputation is missing**. Specifically:

**1. CR-01 (BLOCKER) — OptimizeDialog plan is captured at open and never rebuilt.** The user types into the buffer input, AppShell state updates, the input element re-renders with the new value, BUT `exportDialogState.plan` (set once at line 642 in `onClickOptimize`) is never refreshed. All consumers of `props.plan` in OptimizeDialog (summary tiles, Pre-Flight body, Start IPC payload) consume the stale snapshot. Setting buffer to 5% in the dialog and clicking Start will export with buffer=0. The buffer input is **functionally inert** until the dialog is closed and reopened. This single defect falsifies ROADMAP SC #1 (reactive recompute of summary tiles) AND falsifies the user-facing read of SC #2 (exporting with the user-set buffer value).

The plan executor explicitly chose "Option C — distributed memos" over the planner-mandated "Option A — AppShell owns plan memo" (Plan 30-03 must-have line 28). Option C as implemented only extended dep arrays of `onClickOptimize` (which only runs on dialog open, not after) + `onConflictPickDifferent` + `savingsPctMemo` (correct) + `atlasPreviewState` (correct) — but did not centralize `exportDialogState.plan` into a memo at all. The chosen architecture does not satisfy SC #1's reactivity invariant.

**2. CR-02 (BLOCKER) — AtlasPreviewModal does not thread safetyBufferPercent.** Cross-nav from OptimizeDialog to Atlas Preview shows un-buffered tile dims; diverges from what will actually export.

**3. CR-03 (BLOCKER) — `src/core/atlas-preview.ts` mirror broken.** The Layer 3 byte-identical inline-copy invariant (atlas-preview-view.ts:14-19) is violated. Renderer copy threads the buffer; core copy does not. Parity tests at tests/core/atlas-preview.spec.ts:381-444 pass only because they all use buffer-undefined opts (D-07 no-op short-circuit hides the divergence).

**4. CR-04 (BLOCKER) — Two independent `safetyBufferPercent` fields with different ranges and consumers, never synced.** Phase 20's `Documentation.safetyBufferPercent` (range 0-100) and Phase 30's new top-level `safetyBufferPercent` (range 0-25) coexist. HTML doc-export reads the legacy field; export math reads the new field. For projects with non-zero values in either, the HTML report disagrees with the actual export. The DocumentationBuilderDialog input still says "Metadata only ... export math wiring deferred to a future phase" — Phase 30 IS the future phase; the wiring did not happen.

The four BLOCKERs are the same four findings flagged by `30-REVIEW.md` (CR-01..CR-04). Their root causes are all wiring-level: math + persistence + UI element are correct in isolation, but the connections between them are incomplete. The phase **must not be marked complete** until the reactive recompute (CR-01) is wired through — without it, the user cannot achieve the goal as ROADMAP describes.

**Suggested closure plan:**
1. **CR-01 fix (highest priority):** Add a useEffect in AppShell keyed on `[safetyBufferPercentLocal, summary, overrides, exportDialogState !== null]` that calls `setExportDialogState((prev) => prev ? { ...prev, plan: buildExportPlan(summary, overrides, { safetyBufferPercent: safetyBufferPercentLocal }) } : null)`. OR (cleaner) move plan derivation inside OptimizeDialog as a useMemo against props.summary + props.overrides + props.safetyBufferPercent (requires passing summary + overrides into OptimizeDialog instead of plan).
2. **CR-02 fix:** Add `safetyBufferPercent: number` to `AtlasPreviewModalProps`; thread `safetyBufferPercent={safetyBufferPercentLocal}` at AppShell line ~2036-2045; pass into the `useMemo` opts + add to deps.
3. **CR-03 fix:** Mirror the renderer's atlas-preview-view.ts changes byte-identically into src/core/atlas-preview.ts (3 sites: opts shape, deriveInputs param, buildExportPlan call). Tighten parity test with a regex assertion locking `safetyBufferPercent?: number` in both opts shapes.
4. **CR-04 decision (requires design decision):** Pick A/B/C reconciliation strategy. Option A (deprecate Documentation.safetyBufferPercent + migrate at materialize + read top-level in doc-export) is cleanest; Option C (read top-level in doc-export, leave doc-builder field as read-only display) is the minimum viable fix.

The 4 WARNINGS (WR-01 through WR-04) and 3 INFO items (IN-01 through IN-03) from 30-REVIEW.md are non-blocking but several should be addressed alongside the BLOCKER fixes (e.g. WR-02 docblock fix is trivial; WR-04 redundant Math.floor cleanup is one-line).

---

_Verified: 2026-05-08T11:50:00Z_
_Verifier: Claude (gsd-verifier)_

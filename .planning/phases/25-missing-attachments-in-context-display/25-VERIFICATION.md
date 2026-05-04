---
phase: 25-missing-attachments-in-context-display
verified: 2026-05-04T15:23:00Z
status: human_needed
score: 10/13 must-haves verified (3 require human visual confirmation)
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Load json+images project with a missing PNG; confirm affected row visible in Global Max Render Source panel"
    expected: "Missing attachment row appears in the panel (not filtered out) with a red left-border accent stripe and ⚠ icon beside the attachment name"
    why_human: "Visual CSS class rendering (bg-danger, text-danger) and icon display require the running Electron dev server; jsdom does not compute layout or Tailwind utility classes"
  - test: "Expand an Animation Breakdown card that references the missing attachment"
    expected: "Same red left-border accent and ⚠ icon appear on that row in the animation card (setup-pose card at minimum)"
    why_human: "Same CSS / layout reason; also verifies the setup-pose card stub injection is visible in context"
  - test: "Confirm MissingAttachmentsPanel continues to render above the Global panel simultaneously"
    expected: "MissingAttachmentsPanel summary list is visible alongside (not replaced by) the in-context red-accent rows in the Global panel"
    why_human: "Requires visual inspection of the live app to confirm additive layout — both panels visible at once"
---

# Phase 25: Missing Attachments In-Context Display — Verification Report

**Phase Goal:** Rows whose source PNG was missing at load time remain visible in their natural panel context with a visual danger signal, so the animator can see exactly which attachments are affected alongside their scale data rather than only in a separate panel.
**Verified:** 2026-05-04T15:23:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Stub rows (isMissing: true) appear in buildSummary peaksArray — not filtered out | VERIFIED | `summary.ts:90-93` maps peaksArrayRaw; stub synthesis at lines 110-174 pushes additional rows with `isMissing: true`; no `.filter()` call on this array |
| 2 | Stub rows (isMissing: true) appear in buildSummary animationBreakdown card rows — not filtered out | VERIFIED | `summary.ts:203-282` maps card rows with isMissing marking; stub injection into setup-pose card at line 210 |
| 3 | Non-stub rows have isMissing undefined (not false — keeps payload lean) | VERIFIED | `summary.ts:92`: `isMissing: skippedNames.has(p.attachmentName) ? true : undefined`; test suite asserts this |
| 4 | uniqueAssetCount in each breakdown card equals rows.length including missing rows | VERIFIED | `summary.ts:280`: `uniqueAssetCount: rows.length` (not a filtered count) |
| 5 | isMissing boolean field survives structuredClone (IPC-safe) | VERIFIED | `tests/core/summary.spec.ts` Phase 25 structuredClone test passes; boolean is a primitive — always structuredClone-safe |
| 6 | G-02 unit tests updated to assert marking behavior (not old filter-drop behavior) | VERIFIED | `tests/core/summary.spec.ts:232` — test description contains "Phase 25 PANEL-03 — buildSummary marking contract"; TRIANGLE asserted present with isMissing:true |
| 7 | Missing-attachment rows appear in Global Max Render Source panel with red left-border accent | HUMAN NEEDED | Code: `GlobalMaxRenderPanel.tsx:433-434` `state === 'missing' && 'bg-danger'` present; visual rendering requires dev server |
| 8 | Missing-attachment rows show ⚠ icon beside the attachment name in Global panel | HUMAN NEEDED | Code: `GlobalMaxRenderPanel.tsx:454-456` `{row.isMissing && <span aria-label="Missing PNG">⚠</span>}` present; RTL test passes (`screen.getByLabelText('Missing PNG')`); full visual confirmation needs dev server |
| 9 | Missing-attachment rows appear in Animation Breakdown panel with red left-border accent and ⚠ icon | HUMAN NEEDED | Code: `AnimationBreakdownPanel.tsx:666-667,674-676,715-716` — symmetric 6-site changes present; visual confirmation needs dev server |
| 10 | rowState() returns 'missing' as FIRST check — before isUnused, before ratio comparisons | VERIFIED | `GlobalMaxRenderPanel.tsx:174-180` and `AnimationBreakdownPanel.tsx:176-182`: `if (isMissing) return 'missing'` is the first guard in both functions |
| 11 | Tinted ratio cell (bg-danger/10 text-danger) applied to missing rows in both panels | VERIFIED | `GlobalMaxRenderPanel.tsx:508-509` and `AnimationBreakdownPanel.tsx:715-716`: `state === 'missing' && 'bg-danger/10 text-danger'` present alongside unused branch |
| 12 | MissingAttachmentsPanel is unchanged and continues to render its summary list | VERIFIED | `grep -c "isMissing" MissingAttachmentsPanel.tsx` = 0; `missing-attachments-panel.spec.tsx` passes (4/4) |
| 13 | All existing row interactions (checkbox, override, hover, flash) work normally for missing rows | HUMAN NEEDED | Code does not alter interaction handlers; RTL tests confirm icon rendering for isMissing rows without disrupting other row props; full interaction test requires dev server |

**Score:** 10/13 truths verified (3 require human visual confirmation in dev server)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/shared/types.ts` | DisplayRow.isMissing?: boolean field with JSDoc | VERIFIED | Lines 140-148: full JSDoc explaining Phase 25 semantics, IPC-safety, and backward-compatibility |
| `src/main/summary.ts` | isMissing marking at 2 sites; both filter lines removed; stub row synthesis | VERIFIED | Line 90-93 (peaks map+mark), lines 203-282 (breakdown map+mark + stub injection); zero `filteredRows` variable present |
| `tests/core/summary.spec.ts` | Revised G-02 tests asserting marking behavior; 3 new Phase 25 tests | VERIFIED | Line 232: "Phase 25 PANEL-03 — buildSummary marking contract"; 3 additional tests at lines 298, 304, 318; all 22 tests in the suite pass |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | RowState extended with 'missing'; rowState() returns 'missing' first; left-accent + name cell ⚠ + ratio cell danger tint | VERIFIED | All 6 sites confirmed: line 172 (RowState), 174-180 (rowState), 433-434 (accent), 454-456 (icon), 508-509 (ratio), 937 + 1052 (call sites) |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` | Symmetric RowState extension and JSX changes | VERIFIED | All 6 sites confirmed: line 174 (RowState), 176-182 (rowState), 666-667 (accent), 674-676 (icon), 715-716 (ratio), 811 + 856 (call sites) |
| `tests/renderer/global-max-missing-row.spec.tsx` | RTL tests for rowState + ⚠ icon rendering (Wave 0 gap) | VERIFIED | File created; 4 tests in `describe('Phase 25: GlobalMaxRenderPanel missing row danger indicators')`; all pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/main/summary.ts:skippedNames Set` | `DisplayRow.isMissing` | `skippedNames.has(p.attachmentName) ? true : undefined` | WIRED | Line 92 matches pattern; also stub-row synthesis at lines 142-169 sets `isMissing: true` directly |
| `src/shared/types.ts:DisplayRow` | `src/shared/types.ts:BreakdownRow` | `BreakdownRow extends DisplayRow` | WIRED | Line 158 of types.ts (unchanged): `BreakdownRow extends DisplayRow`; isMissing flows automatically |
| `DisplayRow.isMissing` | `rowState() in GlobalMaxRenderPanel` | `row.isMissing passed as third argument` | WIRED | Lines 937 + 1052: `rowState(row.effectiveScale, false, row.isMissing)` |
| `rowState() returning 'missing'` | `left-accent <span> bg-danger class` | `clsx state === 'missing' && 'bg-danger'` | WIRED | Lines 433-434 in GlobalMaxRenderPanel; 666-667 in AnimationBreakdownPanel |
| `row.isMissing` | `⚠ span in name cell` | `{row.isMissing && ...}` conditional render | WIRED | Lines 454-456 in GlobalMaxRenderPanel; 674-676 in AnimationBreakdownPanel |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `GlobalMaxRenderPanel.tsx` | `row.isMissing` | `buildSummary` → IPC → `summary.peaks[].isMissing` | Yes — set from `skippedNames.has()` or synthesized stub row | FLOWING |
| `AnimationBreakdownPanel.tsx` | `row.isMissing` | `buildSummary` → IPC → `summary.animationBreakdown[].rows[].isMissing` | Yes — same path; setup-pose card also receives synthesized stubs | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| summary.spec.ts Phase 25 marking tests | `npm run test -- --run tests/core/summary.spec.ts` | 15 tests pass | PASS |
| renderer RTL missing-row tests | `npm run test -- --run tests/renderer/global-max-missing-row.spec.tsx` | 4 tests pass | PASS |
| missing-attachments-panel regression | `npm run test -- --run tests/renderer/missing-attachments-panel.spec.tsx` | 4 tests pass | PASS |
| Full vitest suite | `npm run test -- --run` | 754 pass, 1 skip, 2 todo; 2 failures are pre-existing baseline (atlas-preview-modal canvas, build-scripts version mismatch) | PASS (0 new failures) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| PANEL-03 | 25-01-PLAN.md, 25-02-PLAN.md | Missing-attachment rows visible in Global Max + Animation Breakdown panels with red left-border accent and ⚠ icon | PARTIALLY SATISFIED (human confirmation pending) | Code implementation complete; automated RTL tests pass; visual rendering in Electron dev server not yet confirmed |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/main/summary.ts` | 171 | Stub rows appended after sort (D-16 sort broken for skipped-attachment case) | Warning | D-16 sort invariant violated when skippedAttachments is non-empty; existing test does not catch this path (SIMPLE_PROJECT has all PNGs present). Documented in code review WR-01. Does not affect PANEL-03 goal (display behavior) but is a correctness debt. |
| `src/main/summary.ts` | 119-135 and 219-235 | Duplicated skin/slot-walk logic (16 lines copy-pasted) | Info | Maintenance hazard; documented in code review IN-02. No functional impact on phase goal. |
| `tests/core/summary.spec.ts` | 232-295 | G-02 marking test replicates buildSummary internals instead of calling it | Warning | Integration path (stub synthesis for sampler-skipped attachments) has no integration test coverage; documented in code review WR-02. Does not block PANEL-03 but means the gap-fix code path is untested at integration level. |

### Human Verification Required

Plan 25-02 contains a `checkpoint:human-verify` task with gate="blocking" that requires visual UAT in the running Electron dev server. No approval record exists in any phase 25 document. Three roadmap success criteria require visual confirmation:

**1. Missing row visible in Global Max Render Source panel with danger indicators**

**Test:** Run `npm run dev`. Load a `json + images folder` project where at least one PNG is missing (for example, copy `fixtures/SIMPLE_PROJECT/` to a temp folder, delete one PNG from the `images/` subfolder, and load with "Use Images Folder as Source" toggle ON).
**Expected:** The affected attachment row appears in the Global Max Render Source panel (not hidden), with a red left-border accent stripe and a ⚠ character before the attachment name. The ratio cell should have a red-tinted background.
**Why human:** Visual CSS rendering (`bg-danger`, `text-danger` Tailwind classes) is not computable by jsdom. The RTL test confirms the ⚠ `aria-label` exists in the DOM but cannot verify the red color or the accent bar styling.

**2. Missing row visible in Animation Breakdown card with same indicators**

**Test:** In the same loaded project, expand any Animation Breakdown card (expand the setup-pose card in particular, as stub injection only targets `cardId='setup-pose'` per the implementation). Look for the missing attachment in that card's rows.
**Expected:** The same red left-border accent and ⚠ icon appear on the missing attachment's row in the animation card.
**Why human:** Same CSS/layout reason. Note: per-animation cards (non-setup-pose) will NOT show the stub row — only the setup-pose card receives injected stubs. Verify that this behavior (setup-pose card only) is acceptable UX or escalate WR-04 from the code review.

**3. MissingAttachmentsPanel continues to render alongside in-context indicators**

**Test:** In the same loaded project, verify both the MissingAttachmentsPanel (the separate summary list above the Global panel) and the in-context red-accent rows in the Global panel are visible simultaneously.
**Expected:** Both panels are visible at the same time — the red-accent treatment is additive, not a replacement for the MissingAttachmentsPanel.
**Why human:** Layout arrangement and simultaneous panel visibility require visual inspection.

### Gaps Summary

No automated gaps found. All code artifacts exist, are substantive, and are correctly wired. The data flow is connected end-to-end (buildSummary → IPC → panel rendering). The RTL test suite passes (22/22 on the core tests, 4/4 on the renderer tests). The phase is blocked only by the three human visual verification items above — specifically the `checkpoint:human-verify gate="blocking"` task in Plan 25-02 which has no approval record.

**Code review warnings (WR-01, WR-02) to note after UAT approval:**
- WR-01: D-16 sort contract broken when skippedAttachments non-empty — stub rows appended after sort rather than inserted in sorted position. Does not affect visual display but breaks the CLI byte-for-byte determinism contract for atlas-less projects with missing PNGs.
- WR-02: Gap-fix code path (stub synthesis for sampler-skipped attachments) has no integration test coverage.

These are quality issues that could be addressed in a follow-up plan if the human UAT approves the phase.

---

_Verified: 2026-05-04T15:23:00Z_
_Verifier: Claude (gsd-verifier)_

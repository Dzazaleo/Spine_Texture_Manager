---
phase: 24-panel-semantics-unused-assets-rewrite-atlas-savings-metric
verified: 2026-05-04T12:50:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Load a json + images/ folder project where images/ contains PNGs not referenced by the rig and confirm the Unused Assets panel lists the orphaned files"
    expected: "Panel appears, shows orphaned PNG filenames and their disk sizes; used PNGs do not appear"
    why_human: "End-to-end render tree with live Electron IPC + real fs.readdirSync path cannot be exercised by grep or unit tests"
  - test: "Confirm UnusedAssetsPanel position: Global Max Render Source renders, then Unused Assets panel (if orphans exist), then Animation Breakdown"
    expected: "Panels appear in the correct order in both tabs"
    why_human: "Panel ordering in a running Electron window requires visual inspection; jsdom cannot compute layout"
  - test: "Load a project with zero orphaned files; confirm the Unused Assets panel is invisible (no empty-state placeholder)"
    expected: "No Unused Assets panel in the DOM; Global Max Render Source is adjacent to Animation Breakdown"
    why_human: "Visual / DOM presence check in running Electron app"
  - test: "Confirm the savingsPct chip appears in the Global Max Render Source header (e.g. '12.3% pixel savings') when the export plan has positive savings"
    expected: "Chip is visible in the section header between the title and the N selected / N total counter, styled text-warning"
    why_human: "Visual rendering of conditional chip; requires a loaded project with meaningful export plan"
  - test: "Load a bare .json with no .atlas and no images/ folder; confirm the error message mentions Use Images Folder as Source"
    expected: "Error surface (UI error card or console) includes 'Use Images Folder as Source' text"
    why_human: "Error message display path requires triggering AtlasNotFoundError through the real IPC envelope"
---

# Phase 24: Panel Semantics — Unused Assets Rewrite + Atlas-Savings Metric — Verification Report

**Phase Goal:** The Unused Assets section reports genuinely orphaned PNG files (images-folder-vs-rig delta) and lives as its own collapsible panel. The atlas-savings metric replaces the misleading MB unused-attachment callout. The AtlasNotFoundError message acknowledges the images-folder alternative.

**Verified:** 2026-05-04T12:50:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Unused Assets panel reports images-folder-vs-rig orphaned PNGs (not atlas-vs-JSON delta) | VERIFIED | `src/core/usage.ts:findOrphanedFiles` takes `imagesFolderFiles` + `inUseNames` set; `summary.ts` reads `images/` via `fs.readdirSync`, builds mode-aware `inUseNames` (atlas regions or `sourceDims` proxy), calls `findOrphanedFiles`, augments with `fs.statSync`; return field is `orphanedFiles` |
| 2 | Unused Assets section is its own collapsible panel, sibling to Global Max Render Source; expanded by default when N > 0, hidden when zero | VERIFIED | `src/renderer/src/panels/UnusedAssetsPanel.tsx` exists, exports `UnusedAssetsPanel`, `useState(true)` (expanded by default), `return null` guard when `orphanedFiles.length === 0`; wired in `AppShell.tsx` line 1550-1552 between `GlobalMaxRenderPanel` and `AnimationBreakdownPanel` |
| 3 | MB unused-attachment callout replaced by atlas pixel-area savings % metric | VERIFIED | `GlobalMaxRenderPanel.tsx` has zero occurrences of `unusedAttachments`, `unusedNameSet`, `aggregateBytes`, `filteredUnused`; `savingsPct` prop added; chip renders `{savingsPct.toFixed(1)}% pixel savings` (line 826) when savingsPct > 0; `AppShell.tsx` threads `savingsPctMemo` computed from `buildExportPlan` pixel-area calculation |
| 4 | AtlasNotFoundError message mentions "Use Images Folder as Source" toggle | VERIFIED | `src/core/errors.ts` line 49: `or enable the "Use Images Folder as Source" toggle in the toolbar and reload` |

**Score:** 4/4 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/shared/types.ts` | `OrphanedFile` type; `SkeletonSummary.orphanedFiles`; no `UnusedAttachment` | VERIFIED | `export interface OrphanedFile { filename: string; bytesOnDisk: number }` at line 200; `orphanedFiles?: OrphanedFile[]` at line 562; zero occurrences of `UnusedAttachment` or `unusedAttachments` |
| `src/core/usage.ts` | `findOrphanedFiles` pure helper; no `node:fs` / `node:path` imports | VERIFIED | 27-line file; `export function findOrphanedFiles(imagesFolderFiles: string[], inUseNames: Set<string>): string[]`; zero I/O imports |
| `src/core/errors.ts` | AtlasNotFoundError message contains toggle tip | VERIFIED | Line 49 contains `Use Images Folder as Source` |
| `tests/core/usage.spec.ts` | Tests assert `findOrphanedFiles` behavior (5 cases) | VERIFIED | Imports `findOrphanedFiles`; 5 cases (a)-(e) plus module hygiene check |
| `src/main/summary.ts` | `orphanedFiles` I/O layer: `readdirSync` + `statSync` + `findOrphanedFiles` call | VERIFIED | Lines 122-180: full D-02 two-mode algorithm; imports `findOrphanedFiles` and `path`; `readdirSync`, `statSync`, mode-aware `inUseNames` all present; return object has `orphanedFiles` |
| `src/renderer/src/panels/UnusedAssetsPanel.tsx` | Collapsible orphaned-files panel | VERIFIED | 124 lines; `export function UnusedAssetsPanel`; `useState(true)`; `return null` guard; table with Filename + Size on Disk; SearchBar filter; `(no matches)` state |
| `tests/renderer/unused-assets-panel.spec.tsx` | RTL behavior tests (9 cases) | VERIFIED (per SUMMARY) | Created in commit 92ba863; 9 test cases (a)-(i); all passing per Plan 03 SUMMARY |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | Cleaned of unused-attachment code; savingsPct chip in header | VERIFIED | Zero occurrences of `unusedAttachments`, `unusedNameSet`, `aggregateBytes`, `filteredUnused`; `savingsPct?: number \| null` in Props; chip JSX at line 824-828 |
| `src/renderer/src/components/AppShell.tsx` | UnusedAssetsPanel import + render; savingsPct threading | VERIFIED | `import { UnusedAssetsPanel }` at line 60; renders `<UnusedAssetsPanel orphanedFiles={effectiveSummary.orphanedFiles ?? []} />` at line 1550-1552; `savingsPct={savingsPctMemo}` at line 1542 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main/summary.ts` | `src/core/usage.ts` | `import { findOrphanedFiles } from '../core/usage.js'` | WIRED | Line 24 of summary.ts; called at line 166 |
| `src/renderer/src/panels/UnusedAssetsPanel.tsx` | `src/shared/types.ts` | `import type { OrphanedFile }` | WIRED | Line 20 of UnusedAssetsPanel.tsx |
| `src/renderer/src/components/AppShell.tsx` | `src/renderer/src/panels/UnusedAssetsPanel.tsx` | `import { UnusedAssetsPanel }` | WIRED | Line 60 of AppShell.tsx; used at line 1550 |
| `AppShell.tsx GlobalMaxRenderPanel JSX` | `GlobalMaxRenderPanel savingsPct prop` | `savingsPct={savingsPctMemo}` | WIRED | Line 1542 of AppShell.tsx |
| `AppShell.tsx render tree` | `UnusedAssetsPanel` | `orphanedFiles={effectiveSummary.orphanedFiles ?? []}` | WIRED | Line 1551 of AppShell.tsx |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `UnusedAssetsPanel.tsx` | `orphanedFiles` prop | `effectiveSummary.orphanedFiles` → `summary.ts:orphanedFiles` → `fs.readdirSync(imagesDir)` + `findOrphanedFiles` + `fs.statSync` | Yes — real filesystem reads with byte sizes | FLOWING |
| `GlobalMaxRenderPanel.tsx` | `savingsPct` prop | `savingsPctMemo` → `buildExportPlan(effectiveSummary, overrides)` → pixel-area calculation on `plan.rows` | Yes — computed from real summary data | FLOWING |

---

## Behavioral Spot-Checks (Step 7b)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `findOrphanedFiles` exports exist | `grep -c "export function findOrphanedFiles" src/core/usage.ts` | 1 | PASS |
| No `UnusedAttachment` in types.ts | `grep -c "UnusedAttachment" src/shared/types.ts` | 0 | PASS |
| No stale refs in GlobalMaxRenderPanel | `grep -c "unusedAttachments\|unusedNameSet\|aggregateBytes\|filteredUnused" src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 0 | PASS |
| `Use Images Folder as Source` in errors.ts | `grep -c "Use Images Folder as Source" src/core/errors.ts` | 1 | PASS |
| `UnusedAssetsPanel` in AppShell | `grep -c "UnusedAssetsPanel" src/renderer/src/components/AppShell.tsx` | 2 (import + render) | PASS |
| `savingsPct` chip in GlobalMaxRenderPanel | `grep -c "pixel savings" src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 1 | PASS |
| Test suite (excluding pre-existing failures) | `npm run test` | 747 passed, 2 failed (build-scripts version check + atlas-preview-modal dblclick — both pre-existing, unrelated to Phase 24) | PASS |

The 2 failing tests are pre-existing regressions documented across all Phase 24 plan summaries:
- `build-scripts.spec.ts` fails because `package.json` version is `1.2.0` but the test fixture expects `1.1.3` — a pre-Phase 24 condition.
- `atlas-preview-modal.spec.tsx dblclick` fails on a canvas hit-test behavior — pre-existing, unrelated to any Phase 24 file.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PANEL-01 | 24-01, 24-02 | Orphaned PNG detection (images-folder-vs-rig) | SATISFIED | `findOrphanedFiles` + `summary.ts` D-02 algorithm + `OrphanedFile` type all in place |
| PANEL-02 | 24-03, 24-04 | Unused Assets as standalone collapsible panel | SATISFIED | `UnusedAssetsPanel.tsx` extracted; wired in `AppShell.tsx` between GlobalMaxRenderPanel and AnimationBreakdownPanel |
| OPT-03 | 24-04 | MB unused-attachment callout replaced by atlas pixel-area savings % | SATISFIED | Old unused section removed; `savingsPct` chip renders `{savingsPct.toFixed(1)}% pixel savings` computed via `buildExportPlan` |
| PANEL-04 | 24-01 | AtlasNotFoundError mentions images-folder toggle | SATISFIED | `errors.ts` line 49 contains the toggle tip sentence |

No orphaned requirements: REQUIREMENTS.md traceability table assigns PANEL-01, PANEL-02, OPT-03, PANEL-04 to Phase 24 — all four are covered by the four plans.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/main/summary.ts` | 151 | Comment references `findUnusedAttachments` as a historical note | Info | No functional impact — comment only, not an import or call |
| `src/main/index.ts` | 429 | Comment references `findUnusedAttachments` historically | Info | No functional impact — comment only |

No blockers or warnings. Both occurrences are in code comments documenting historical context, not functional references.

---

## Human Verification Required

### 1. Orphaned PNG files appear in panel

**Test:** Open the app, load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (or any `json + images/` project where `images/` has PNG files not referenced by the rig). Look for the Unused Assets panel.
**Expected:** Panel appears below the Global Max Render Source header area, showing filenames and disk sizes of orphaned PNGs; PNGs used by the rig are absent.
**Why human:** Electron IPC + real `fs.readdirSync` path cannot be exercised by automated unit tests or grep.

### 2. Panel position in render tree

**Test:** With a project that has orphaned files loaded, observe the visual order: Global Max Render Source panel, then Unused Assets panel, then Animation Breakdown tab (when on Animation tab).
**Expected:** Order is GlobalMaxRenderPanel → UnusedAssetsPanel → AnimationBreakdownPanel.
**Why human:** Panel ordering requires visual inspection in the running Electron window; jsdom cannot compute rendered layout.

### 3. Panel hidden when no orphaned files

**Test:** Load a project where every PNG in `images/` is referenced by the rig (zero orphans).
**Expected:** No Unused Assets panel visible. No empty-state placeholder.
**Why human:** Visual absence of a panel cannot be verified without running the app.

### 4. savingsPct chip visible and correctly styled

**Test:** Load a project, observe the Global Max Render Source section header.
**Expected:** When the export plan computes positive savings, a chip reading `X.X% pixel savings` appears between the "Global Max Render Scale" title and the "N selected / N total" counter. Chip uses a warning/amber color distinct from interactive elements.
**Why human:** Visual rendering of a conditional chip requires a loaded project and visual inspection.

### 5. AtlasNotFoundError mentions images-folder toggle

**Test:** Open the app. Attempt to load a bare `.json` file that has no sibling `.atlas` and no `images/` folder beside it. Observe the error message surfaced in the UI.
**Expected:** The error message contains "Use Images Folder as Source" toggle tip alongside the existing re-export advice.
**Why human:** Error display path requires triggering the error through the real IPC envelope and the renderer's error surface component.

---

## Gaps Summary

No automated gaps found. All four PLAN frontmatter must-haves and all four ROADMAP success criteria are verified against the codebase. The only open items are the five human verification checks above that require the running Electron application.

---

_Verified: 2026-05-04T12:50:00Z_
_Verifier: Claude (gsd-verifier)_

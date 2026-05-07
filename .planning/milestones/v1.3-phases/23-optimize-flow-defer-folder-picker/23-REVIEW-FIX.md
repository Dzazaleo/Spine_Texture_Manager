---
phase: 23-optimize-flow-defer-folder-picker
fixed_at: 2026-05-04T00:00:00Z
review_path: .planning/phases/23-optimize-flow-defer-folder-picker/23-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 23: Code Review Fix Report

**Fixed at:** 2026-05-04T00:00:00Z
**Source review:** .planning/phases/23-optimize-flow-defer-folder-picker/23-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (CR-01, CR-02, WR-01, WR-02)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: `mountOpenResponse` does not call `setLastOutDir`

**Files modified:** `src/renderer/src/components/AppShell.tsx`
**Commit:** bc1d7f1
**Applied fix:** Added `setLastOutDir(project.lastOutDir ?? null)` immediately after `setLoaderMode(project.loaderMode ?? 'auto')` at line 843, ensuring the Cmd+O open path restores lastOutDir from the materialized project alongside all other state fields.

---

### CR-02: `DocumentationBuilderDialog` receives hardcoded `lastOutDir={null}`

**Files modified:** `src/renderer/src/components/AppShell.tsx`
**Commit:** ce3e29a
**Applied fix:** Changed `lastOutDir={null}` to `lastOutDir={lastOutDir}` at the DocumentationBuilderDialog mount (line 1636), threading the live Phase 23 state slot through so the HTML-export folder picker pre-fills with the last-used output directory.

---

### WR-01: `onConflictPickDifferent` does not update `lastOutDir`

**Files modified:** `src/renderer/src/components/AppShell.tsx`
**Commit:** 8c42b6b
**Applied fix:** Added `setLastOutDir(newOutDir)` after `setExportDialogState({ plan, outDir: newOutDir })` in `onConflictPickDifferent` (line 624), keeping lastOutDir in sync with the folder the user chose during conflict resolution.

---

### WR-02: Atlas Preview button bypasses in-progress close guard

**Files modified:** `src/renderer/src/modals/OptimizeDialog.tsx`
**Commit:** 2d22fb7
**Applied fix:** Extended the disabled predicate on the footer-left Atlas Preview button from `props.plan.rows.length === 0` to `props.plan.rows.length === 0 || state === 'in-progress'` (Option A from the review), preventing the button from closing the dialog while an export is running.

---

_Fixed: 2026-05-04T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

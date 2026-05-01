---
phase: 20-documentation-builder-feature
verified: 2026-05-01T21:15:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
gaps: []
deferred:
  - truth: "Safety buffer global multiplier wired into export math (uniform single-scale × (1 + safetyBufferPercent/100), with the ≤1.0 clamp from Phase 6 Gap-Fix Round 1)"
    addressed_in: "Backlog 999.7 (future phase)"
    evidence: "20-CONTEXT.md D-22 explicit lock: 'NO export-math wiring this phase' — buildExportPlan and src/renderer/src/lib/export-view.ts are deliberately not touched. Field is shipped as documentation-slot metadata + UI + HTML snapshot only. Phase 20 ROADMAP success criteria DO NOT include export-math wiring; this is correctly out of scope."
human_verification:
  - test: "Drag-and-drop animation from side list onto a track container"
    expected: "Click '+ Add Track' to create Track 0; drag any animation from the side list onto Track 0; new entry appears with default mixTime=0.25 + loop=false. The drag image must render consistently with no missing thumbnail (Electron Chromium quirk D-06 — effectAllowed='copy' guards this)."
    why_human: "HTML5 native DnD requires a real browser DOM and OS-level drag image rendering; jsdom only dispatches synthetic events (already covered by tests/renderer/documentation-builder-dialog.spec.tsx)."
  - test: "Exported HTML opens correctly in a real browser offline"
    expected: "Author at least one bone description + general notes + one tracked animation; click 'Export HTML…'; choose a save location; open the resulting .html file in Safari/Firefox/Chrome with NO network. Confirm: hero row + 5-chip strip + Optimization Config card + General Notes card + Animation Tracks table (with terracotta track-divider rows) + Control Bones + Skins + Events (when present) all render with no broken refs (no missing icons, no missing fonts, no file:// 404s)."
    why_human: "Real browser rendering is the contract. Self-containment is regex-asserted in unit tests + golden-file snapshot, but visual fidelity to the locked CHJWC_SYMBOLS reference screenshot needs a human eye."
  - test: "Cross-platform DnD drag-image consistency (Electron release matrix)"
    expected: "Repeat the DnD test on macOS / Windows / Linux per release matrix. Confirm the drag image renders identically (no missing thumbnail) across all three."
    why_human: "Electron Chromium has a known quirk where dragstart from the side list element renders different (or no) drag image without effectAllowed='copy'. effectAllowed='copy' is set; only manual cross-platform verification can confirm the visual outcome."
  - test: "Save → close → reopen produces bit-equal documentation in the actual app"
    expected: "Author Documentation content; File → Save (writes .stmproj); File → Close → File → Open the same .stmproj. Reopen the Documentation Builder modal — every field (animation tracks with mixTime/loop/notes, events, general notes, per-bone descriptions, per-skin descriptions, safety buffer percent) must match exactly what was authored, including drift policy applied (events/skins auto-listed from skeleton; orphaned tracks dropped). Round-trip identity is regression-tested in vitest, but the human path exercises the full IPC + dialog + dirty-flag + materializer chain in the running Electron app."
    why_human: "Full Electron-app round-trip exercises IPC + main process + dirty-flag UI feedback that vitest cannot replicate without launching the app."
---

# Phase 20: Documentation Builder Verification Report

**Phase Goal:** Per-skeleton documentation surface that fills the `.stmproj` v1 reserved `documentation: object` slot. User can author animation-track docs (mix time + loop + notes), capture events, write general notes, describe control bones + skins, and export everything to a self-contained `.html` file. Persistence round-trips via the existing `.stmproj` v1 schema with no schema-version bump.

**Verified:** 2026-05-01T21:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (from ROADMAP §Phase 20 Success Criteria) | Status | Evidence |
|---|--------------------------------------------------|--------|----------|
| 1 (DOC-01) | Top-bar Documentation button opens DocumentationBuilderDialog with three panes (Animation Tracks, Sections, Export). | ✓ VERIFIED | `AppShell.tsx:1296-1300` removes `disabled`/`aria-disabled`/`title`, adds `onClick={() => setDocumentationBuilderOpen(true)}`. `DocumentationBuilderDialog.tsx:130-140` mounts a `<nav role="tablist">` with three TabButtons labeled `Animation Tracks` / `Sections` / `Export`. Modal mount at `AppShell.tsx:1507-1515`. Renderer test `tests/renderer/documentation-builder-dialog.spec.tsx` (11 tests, all passing) covers modal open + tab switch + tab role + ARIA. |
| 2 (DOC-02) | Animation Tracks pane: DnD animation onto track container, configure mix time (default 0.25) + loop + notes per entry; multiple tracks supported; round-trips on save. | ✓ VERIFIED | `DocumentationBuilderDialog.tsx:339` `id: crypto.randomUUID()`, `mixTime: 0.25` default. Lines 410, 413, 498: `effectAllowed = 'copy'` + `setData('application/x-stm-anim', ...)` + `getData('application/x-stm-anim')`. Lines 327, 454, 524: `window.confirm`, `+ Add Track`, `Drop an animation here`. Multi-track via `emptyTrackIndices` state + `Math.max(...usedIndices) + 1` next-index logic. Spec covers DnD via `fireEvent.dragStart/dragOver/drop` (11 tests passing). Round-trip proven by `tests/core/documentation-roundtrip.spec.ts` non-empty test (3 tests, all passing). |
| 3 (DOC-03) | Sections pane: events captured, general notes typed, per-control-bone descriptions, per-skin descriptions. | ✓ VERIFIED | `DocumentationBuilderDialog.tsx:617-621` mounts `EventsSubSection` (line 626), `ControlBonesSubSection` (674), `SkinsSubSection` (748), `GeneralNotesSubSection` (790), `SafetyBufferSubSection` (816). Auto-discovery sources: `summary.events.names` (populated in `src/main/summary.ts:131-135` from `skeletonData.events`), `summary.bones.names`, `summary.skins.names`. Drift policy via `intersectDocumentationWithSummary` (D-09/D-10/D-11). |
| 4 (DOC-04) | Export → HTML produces self-contained `.html` with all docs + optimization-config snapshot + atlas page count + image-utilization count, opens offline with no broken refs. | ✓ VERIFIED | `src/main/doc-export.ts:413 lines` ships `renderDocumentationHtml` (pure) + `handleExportDocumentationHtml` (atomic write Pattern-B via `writeFile`/`rename`) + `escapeHtml`. IPC channel `'documentation:exportHtml'` registered through 3-tier (`src/main/ipc.ts:929-930`, `src/preload/index.ts:565-566`, `src/shared/types.ts:1069`). Self-containment regex-asserted: `grep -E "<script src=\|<link[^>]+rel=\"stylesheet\"\|<img \|url\\(https?:" tests/main/__snapshots__/doc-export.spec.ts.snap` returns NOTHING. XSS escape proven (`<script>alert(1)</script>` → `&lt;script&gt;alert(1)&lt;/script&gt;`). 11 tests in `tests/main/doc-export.spec.ts` covering hero, chip strip (5 chips: Generated DD/MM/YYYY, Images Utilized, Animations Configured, Optimized Assets, Atlas Pages), conditional Events card, optimization config, control-bones empty-state, frozen golden snapshot. |
| 5 (DOC-05) | Save → close → reopen produces bit-equal documentation; `.stmproj` schema-version stays at `1`; any new error kind extends the existing 8-kind discriminated-union envelope cleanly. | ✓ VERIFIED | `src/core/project-file.ts:273` `version: 1` (no v2 bump). `validateDocumentation` reuses `kind: 'invalid-shape'` (no 9th SerializableError kind added — Phase 20 introduces ZERO new error kinds). Round-trip identity proven by 3 tests in `tests/core/documentation-roundtrip.spec.ts` (DEFAULT, non-empty representative, Phase 8-era empty {}). Validator pre-massage at `project-file.ts:151` substitutes `DEFAULT_DOCUMENTATION` for missing/empty slot; materializer back-fill at line 377 spreads `{ ...DEFAULT_DOCUMENTATION, ...file.documentation }`. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/documentation.ts` | Documentation types + DEFAULT_DOCUMENTATION + validateDocumentation + intersectDocumentationWithSummary, pure-TS Layer 3 (no DOM/electron/fs) | ✓ VERIFIED | 297 lines. Single import: `import type { SkeletonSummary } from '../shared/types.js'` (type-only). Zero forbidden imports (no electron/fs/sharp/DOM). Exports all 9 expected symbols. |
| `src/core/project-file.ts` | Extended validator (pre-massage + per-field) + serializer + materializer for documentation slot | ✓ VERIFIED | Lines 46-47 import `validateDocumentation`/`DEFAULT_DOCUMENTATION`. Line 151 pre-massage. Line 169 per-field call. Line 284 `documentation: state.documentation`. Line 377 materializer back-fill. |
| `src/shared/types.ts` | Type re-exports (Documentation + entries) + runtime re-exports + AppSessionState extension + SkeletonSummary.events | ✓ VERIFIED | Lines 22-36 re-export Documentation types + DEFAULT_DOCUMENTATION + intersectDocumentationWithSummary + validateDocumentation from `'../core/documentation.js'`. Line 502 SkeletonSummary.events docblock. Lines 681, 702, 722 (`ProjectFileV1`, `MaterializedProject`, `AppSessionState`) all carry `documentation: Documentation`. Line 1069 Api.exportDocumentationHtml typed. |
| `src/main/summary.ts` | summary.events populated from skeletonData.events | ✓ VERIFIED | Lines 133-135: `events: { count: skeletonData.events.length, names: skeletonData.events.map((e) => e.name) }`. |
| `src/main/doc-export.ts` | renderDocumentationHtml + handleExportDocumentationHtml + DocExportPayload + DocExportResponse types | ✓ VERIFIED | 413 lines (≥200 min). All required imports + symbols present (writeFile, rename, escapeHtml, BrowserWindow, dialog, app). Pure renderer + atomic-write IPC handler. |
| `src/main/ipc.ts` | IPC channel registration | ✓ VERIFIED | Line 62 imports `handleExportDocumentationHtml` + `DocExportPayload`. Lines 929-930 `ipcMain.handle('documentation:exportHtml', ...)`. |
| `src/preload/index.ts` | Preload bridge | ✓ VERIFIED | Line 52 type-only import of `DocExportPayload`/`DocExportResponse`. Lines 565-566 `exportDocumentationHtml(payload) → ipcRenderer.invoke('documentation:exportHtml', payload)`. |
| `src/renderer/src/modals/DocumentationBuilderDialog.tsx` | 10th hand-rolled modal (5-modal ARIA scaffold + tab strip + Sections + Tracks + Export) | ✓ VERIFIED | 892 lines (≥250 min). `role="dialog"`, `aria-modal="true"`, `useFocusTrap`, `min-w-[960px] max-w-[1100px] max-h-[85vh]`. All five Sections sub-sections + TracksPane (with `application/x-stm-anim`, `effectAllowed='copy'`, `crypto.randomUUID()`, `+ Add Track`, `Drop an animation here`, `No tracks yet`, `window.confirm`) + ExportPane with `Export HTML…` CTA. |
| `src/renderer/src/components/AppShell.tsx` | Wire Documentation button + state hoist + drift policy + modal mount | ✓ VERIFIED | Imports DocumentationBuilderDialog (line 67), DEFAULT_DOCUMENTATION + intersectDocumentationWithSummary (53-54). State hoist line 176, lazy initializer line 254-256, mountOpenResponse drift call line 796, resample-success drift line 1083, button onClick line 1297, modal mount lines 1507-1515. modalOpen audit list updated at 942-965. |
| `tests/core/documentation.spec.ts` | Per-field validator + drift coverage | ✓ VERIFIED | 21 tests (≥110-line min). Validator rejections, accept-cases, DEFAULT shape lock, 6 drift behaviors. |
| `tests/core/documentation-roundtrip.spec.ts` | DOC-05 round-trip identity | ✓ VERIFIED | 3 tests (DEFAULT, non-empty, Phase 8-era empty {}). All passing. |
| `tests/main/doc-export.spec.ts` | Golden HTML + self-containment + XSS escape | ✓ VERIFIED | 11 tests (≥60-line min). Snapshot file `tests/main/__snapshots__/doc-export.spec.ts.snap` exists; self-containment grep returns nothing. |
| `tests/renderer/documentation-builder-dialog.spec.tsx` | Modal smoke + tab switch + DnD synthetic events + reorder + remove confirm | ✓ VERIFIED | 11 tests (≥100-line min, file is 12685 bytes). DnD mocks via `fireEvent.dragStart/dragOver/drop` with synthetic dataTransfer. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/core/project-file.ts` (validator) | `DEFAULT_DOCUMENTATION` | Pre-massage if obj.documentation is missing or `{}` | ✓ WIRED | Line 151: `obj.documentation = { ...DEFAULT_DOCUMENTATION };` inside `Object.keys(...).length === 0` branch. |
| `src/core/project-file.ts` | `src/core/documentation.ts` | `import { validateDocumentation, DEFAULT_DOCUMENTATION } from './documentation.js'` | ✓ WIRED | Lines 46-47. |
| `src/shared/types.ts` | `src/core/documentation.ts` | `import type { Documentation } from '../core/documentation.js'` | ✓ WIRED | Line 22 type-only import; lines 24-36 re-exports. |
| `src/main/summary.ts` | spine-core `SkeletonData.events` | `skeletonData.events.length` + `skeletonData.events.map((e) => e.name)` | ✓ WIRED | Lines 134-135. |
| `src/renderer/src/components/AppShell.tsx` | `src/renderer/src/modals/DocumentationBuilderDialog.tsx` | `<DocumentationBuilderDialog open={documentationBuilderOpen} ...>` | ✓ WIRED | Lines 1507-1515. |
| `DocumentationBuilderDialog.tsx` | `useFocusTrap` | `useFocusTrap(dialogRef, props.open, { onEscape: props.onClose })` | ✓ WIRED | Line 100. |
| `DocumentationBuilderDialog.tsx` | HTML5 DnD API | `dataTransfer.setData('application/x-stm-anim', ...)` + `getData` on drop | ✓ WIRED | Line 413 setData; line 498 getData; line 410 effectAllowed='copy'. |
| `DocumentationBuilderDialog.tsx` | `crypto.randomUUID` | `id: crypto.randomUUID()` at entry create-time | ✓ WIRED | Line 339. |
| `src/main/ipc.ts` | `src/main/doc-export.ts` | `ipcMain.handle('documentation:exportHtml', handleExportDocumentationHtml)` | ✓ WIRED | Lines 62, 929-930. |
| `src/preload/index.ts` | `'documentation:exportHtml'` channel | `ipcRenderer.invoke('documentation:exportHtml', payload)` | ✓ WIRED | Line 566. |
| `DocumentationBuilderDialog.tsx` (ExportPane) | `window.api.exportDocumentationHtml` | Click handler → `await window.api.exportDocumentationHtml(payload)` | ✓ WIRED | Line 236. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `DocumentationBuilderDialog.tsx` (Sections pane) | `draft.events`/`controlBones`/`skins` | `intersectDocumentationWithSummary(initialProject?.documentation ?? DEFAULT_DOCUMENTATION, summary)` in AppShell lazy initializer; threaded down via `props.documentation` then committed to local `draft` state | Yes | ✓ FLOWING |
| `DocumentationBuilderDialog.tsx` (TracksPane) | `entriesPerTrack` derived from `draft.animationTracks` | User DnD drops + `crypto.randomUUID` populate; existing entries flow from `props.documentation` | Yes | ✓ FLOWING |
| `DocumentationBuilderDialog.tsx` (ExportPane chips) | `documentation.animationTracks.length`, `summary.attachments.count`, `summary.peaks.length`, `atlasPreview.totalPages` | All real data sources from `summary.ts` IPC payload + `buildAtlasPreview` memo | Yes | ✓ FLOWING |
| `src/main/doc-export.ts` (renderDocumentationHtml) | `payload.documentation`, `payload.summary`, `payload.atlasPreview` | Renderer assembles payload at click time from live state; main escapes + renders | Yes | ✓ FLOWING |
| `AppShell.tsx` `documentation` state | `documentation` (useState) | Lazy init: `intersectDocumentationWithSummary(initialProject?.documentation ?? DEFAULT_DOCUMENTATION, summary)`; updated via DocumentationBuilderDialog's onSave commit | Yes | ✓ FLOWING |

No HOLLOW_PROP or DISCONNECTED instances detected. Real data flows through every wired path.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full vitest suite passes | `npm test` | `Test Files 52 passed (52); Tests 587 passed \| 1 skipped \| 2 todo (590)` in 3.99s | ✓ PASS |
| Self-containment of HTML export | `grep -E "<script src=\|<link[^>]+rel=\"stylesheet\"\|<img \|url\\(https?:" tests/main/__snapshots__/doc-export.spec.ts.snap` | (no matches) | ✓ PASS |
| Documentation core module is pure (Layer 3) | `grep -E "node:fs\|electron\|sharp\|document\.\|window\." src/core/documentation.ts` | Only docblock mentions (no actual imports/usage) | ✓ PASS |
| Renderer never imports core directly (arch grep gate) | `grep -rn "from ['\"][^'\"]*\/core\/" src/renderer/` | (no matches) | ✓ PASS |
| Documentation button is enabled (not disabled) | `grep -A2 ">Documentation<" src/renderer/src/components/AppShell.tsx` | Button has `onClick={() => setDocumentationBuilderOpen(true)}`, no `disabled`/`aria-disabled`/`title` | ✓ PASS |
| 3-tier IPC wiring is complete | `grep -nE "documentation:exportHtml" src/main/ipc.ts src/preload/index.ts` | 1 match in each (handler + bridge) | ✓ PASS |
| Schema version unchanged at 1 (no v2 bump) | `grep -nE "version: 1" src/core/project-file.ts` | Line 273 `version: 1` (the only version literal in the serializer) | ✓ PASS |
| No new SerializableError kinds added (8-kind envelope honored) | Inspection of `src/shared/types.ts:566-602` | Pre-Phase-20 kinds: SkeletonNotFoundOnLoadError, SkeletonJsonNotFoundError, AtlasNotFoundError, AtlasParseError, ProjectFileNotFoundError, ProjectFileParseError, ProjectFileVersionTooNewError, Unknown, SpineVersionUnsupportedError. Phase 20 added ZERO new kinds (validator reuses `'invalid-shape'` → `ProjectFileParseError` envelope). | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DOC-01 | 20-02 | Per-skeleton Documentation Builder modal accessible from new top-bar button | ✓ SATISFIED | AppShell.tsx button wiring (line 1297) + DocumentationBuilderDialog (lines 130-140 tab strip) + 11 renderer tests passing. |
| DOC-02 | 20-03 | Animation tracks pane — drag, mix time + loop + notes per entry, multiple tracks | ✓ SATISFIED | TracksPane (DocumentationBuilderDialog.tsx:279-604). DnD via `application/x-stm-anim` + `effectAllowed='copy'`. Multi-track + reorder. 11 spec tests covering DnD, reorder, remove. |
| DOC-03 | 20-01, 20-02 | Sections pane — events, general notes, control bones (name + description), skins (name + description) | ✓ SATISFIED | Five sub-sections at DocumentationBuilderDialog.tsx:617-621. Drift policy in src/core/documentation.ts:256-297 (intersectDocumentationWithSummary). Per-field validator covers all 6 keys. |
| DOC-04 | 20-04 | HTML export — standalone, self-contained, optimization config + atlas count + utilization count | ✓ SATISFIED | src/main/doc-export.ts (413 lines) + 11 doc-export tests + golden snapshot + self-containment regex (snapshot grep returns nothing). **NOTE:** REQUIREMENTS.md table at line 125 lists DOC-04 as "Pending" — this is a stale documentation entry; line 52 (the canonical bullet list) marks it `[x]` complete and Wave 4 SUMMARY confirms full implementation. **Doc inconsistency flagged below.** |
| DOC-05 | 20-01, 20-04 | Persistence in `.stmproj` v1 reserved slot (D-148); round-trip safe; 8-kind envelope honored | ✓ SATISFIED | tests/core/documentation-roundtrip.spec.ts (3 tests) + tests/core/project-file.spec.ts round-trip extension. version: 1 preserved. ZERO new SerializableError kinds. |

All 5 phase requirement IDs accounted for. No orphaned requirement IDs in REQUIREMENTS.md mapped to Phase 20.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none for Phase 20-modified files) | — | — | — | The 4 Warnings + 6 Info findings in 20-REVIEW.md are the canonical anti-pattern list — all are non-blocking, none prevent goal achievement. WR-01 is theoretical (the analysis itself notes "the bug is theoretical here"); WR-02 is a documented edge case (off-by-one date for users authoring near local midnight in a UTC-offset timezone — acknowledged in the docblock); WR-03 (modal draft re-seed misses prop changes during open) is a hard-to-reach edge case that requires resampling while modal is open; WR-04 (validator pre-massage mutates input) is a code-cleanliness suggestion, not a correctness bug. |

No blockers. All Phase 20-introduced code passes anti-pattern scans for TODO/FIXME/placeholder/empty-implementation/console-log-only patterns. The four Warnings from 20-REVIEW.md are acknowledged as non-blocking and tracked for a future polish phase if/when they become user-visible.

### Document Inconsistency Flagged

**REQUIREMENTS.md Phase Index Table (line 125)** lists `DOC-04` as `Pending` while:
- Line 52 (the authoritative DOC-04 bullet entry) is `[x]` checked.
- Wave 4 SUMMARY (`20-04-html-export-ipc-roundtrip-SUMMARY.md`) closes DOC-04.
- Implementation (`src/main/doc-export.ts`, 413 lines, 11 passing tests, golden snapshot, self-containment regex-asserted) is real.

The implementation closes DOC-04 — this is a stale entry in the Phase Index table. **Suggested fix (post-verification):** flip line 125 from `Pending` to `Complete` to match line 52 and the actual implementation state. No code change required; documentation hygiene only.

### Human Verification Required

Four items need human testing — see frontmatter `human_verification` for full details. Summary:

1. **Drag-and-drop in real Electron renderer** — jsdom synthetic events covered by spec; real-DOM drag image needs human eye.
2. **Exported HTML opens correctly in real browser offline** — visual fidelity to the locked CHJWC_SYMBOLS reference screenshot.
3. **Cross-platform DnD drag-image consistency** — Electron Chromium quirk on macOS/Windows/Linux per release matrix.
4. **Save → close → reopen produces bit-equal documentation in the actual app** — full IPC + materializer chain in running Electron.

### Gaps Summary

No blocking gaps. Every must-have from ROADMAP §Phase 20 Success Criteria 1-5 is satisfied by real, substantive, wired code with passing automated tests (full vitest sweep: 52 files, 587 tests, 0 failures). The only outstanding work is the human-verification battery above and one item explicitly deferred to backlog 999.7 (safety buffer export-math wiring — out of scope per CONTEXT.md D-22 lock).

The 4 Warnings + 6 Info findings from 20-REVIEW.md are acknowledged as non-blocking quality-of-life refinements suitable for a future polish phase. The REQUIREMENTS.md DOC-04 "Pending" table entry is a stale documentation row; the canonical bullet list (line 52) marks it complete and the implementation backs that up.

---

_Verified: 2026-05-01T21:15:00Z_
_Verifier: Claude (gsd-verifier)_

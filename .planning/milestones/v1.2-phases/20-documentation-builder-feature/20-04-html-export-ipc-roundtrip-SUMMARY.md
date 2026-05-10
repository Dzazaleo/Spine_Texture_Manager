---
phase: 20-documentation-builder-feature
plan: 04-html-export-ipc-roundtrip
subsystem: main+renderer
tags:
  - electron
  - ipc
  - main
  - html
  - export
  - testing
  - roundtrip
  - xss-mitigation
  - self-containment

# Dependency graph
requires:
  - phase: 20-01-core-types-validator-summary
    provides: "Documentation type, AnimationTrackEntry, SkeletonSummary.events, AppSessionState.documentation, validator pre-massage + materializer back-fill, validateProjectFile / serializeProjectFile / materializeProjectFile chain"
  - phase: 20-02-modal-shell-sections-pane
    provides: "DocumentationBuilderDialog 10th-modal scaffold + tab strip + ExportPanePlaceholder slot ready to be replaced; AppShell-hoisted documentation state with intersect-on-load drift policy"
  - phase: 20-03-animation-tracks-pane-dnd
    provides: "TracksPane with full DnD (animationTracks editing); the data shape this plan's HTML export consumes"
  - phase: 06-modal-aria-scaffold
    provides: "Atomic write Pattern-B reused for HTML export (writeFile .tmp + rename)"
  - phase: 08-save-load-project-state
    provides: "dialog.showSaveDialog precedent + project:save IPC channel pattern (3-tier handler/preload/Api type)"

provides:
  - "src/main/doc-export.ts (NEW): renderDocumentationHtml (pure function, NO I/O) + handleExportDocumentationHtml (IPC handler with atomic write Pattern-B) + escapeHtml + DocExportPayload + DocExportResponse types"
  - "IPC channel 'documentation:exportHtml' registered through the standard 3-tier (handler / preload bridge / Api type), mirroring project:save shape"
  - "Renderer Export pane (ExportPane component) replacing ExportPanePlaceholder; click handler assembles the structured-clone-safe payload at click time and surfaces success/error inline per UI-SPEC copy contract"
  - "AppShell threads atlasPreviewState (via buildAtlasPreview memo) and savingsPctMemo (byte-identical to OptimizeDialog formula) into the modal — single source of truth for both visualisations"
  - "tests/main/doc-export.spec.ts (NEW): 11 tests proving valid HTML, self-containment (no <img/<script/<link/url(http/@font-face/@import), XSS escape (T-20-19), conditional Events card, hero uppercase, chip strip locked formats, tracks table layout, optimization config card, control-bones empty-state, frozen golden snapshot"
  - "tests/core/documentation-roundtrip.spec.ts (NEW): 3 tests for DOC-05 — DEFAULT_DOCUMENTATION, non-empty Documentation with all 6 fields, Phase 8-era empty {} back-fill"

affects:
  - REQUIREMENTS.md DOC-04 → Complete
  - REQUIREMENTS.md DOC-05 → Complete (already closed by Plan 20-01; this plan adds dedicated round-trip backstop)
  - "Phase 20 fully complete: every DOC-01..DOC-05 requirement testably covered"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function HTML renderer (renderDocumentationHtml) with injected generatedAt for deterministic golden-file snapshot testing — pairs with vitest's toMatchSnapshot for regression gating"
    - "Self-contained HTML export: inline <style> block + inline SVG glyphs + system font stack — zero external assets, viewable offline, regex-asserted in test surface"
    - "escapeHtml as the single-source-of-truth chokepoint for every user-supplied string before it lands in the output (T-20-19 mitigation contract)"
    - "Atomic write Pattern-B reused verbatim from src/main/project-io.ts:246-274 (writeFile .tmp + rename) — same defensive shape, same error envelope (kind:'Unknown') so the renderer's error-handling code is identical to project:save"
    - "3-tier IPC channel registration shape: ipcMain.handle in src/main/ipc.ts → ipcRenderer.invoke bridge in src/preload/index.ts → Api method type + payload/response re-export in src/shared/types.ts. New channels follow this shape verbatim."
    - "tsconfig.web.json carve-out (mirrors Plan 20-01 documentation.ts route): src/main/doc-export.ts in include list so the renderer can resolve the type-only re-export through shared/types.js without breaching the Layer 3 grep gate"

key-files:
  created:
    - src/main/doc-export.ts
    - tests/main/doc-export.spec.ts
    - tests/main/__snapshots__/doc-export.spec.ts.snap
    - tests/core/documentation-roundtrip.spec.ts
    - .planning/phases/20-documentation-builder-feature/20-04-html-export-ipc-roundtrip-SUMMARY.md
  modified:
    - src/main/ipc.ts
    - src/preload/index.ts
    - src/shared/types.ts
    - src/renderer/src/modals/DocumentationBuilderDialog.tsx
    - src/renderer/src/components/AppShell.tsx
    - tsconfig.web.json

key-decisions:
  - "renderDocumentationHtml is PURE (no I/O); generatedAt injected via the payload so tests pin the date for a stable golden-file snapshot. Production callers pass Date.now() at click time."
  - "DD/MM/YYYY date format via toISOString().slice(0,10) — TZ-stable for the snapshot. The screenshot reference uses DD/MM/YYYY (locked per CONTEXT.md Specifics)."
  - "Animations Configured chip counts documentation.animationTracks.length (USER-AUTHORED), NOT summary.animations.count — per UI-SPEC §HTML export Specifics §Locking interpretation."
  - "Events card omitted entirely when summary.events.count === 0 (D-18 sub-step 6) — the user's screenshot reference has no events; the visual is intuited from the bones/skins precedent."
  - "Atomic write Pattern-B reused verbatim from project-io.ts (no helper extracted; the 4-line writeFile/rename idiom is short enough that inline duplication is clearer than a 1-call helper)."
  - "Save dialog cancel returns kind:'Unknown' with message 'Export cancelled' (mirrors Save As cancel path) — UI-SPEC error fallback handles the empty-message case anyway."
  - "Path-traversal defensive guard: handleExportDocumentationHtml rejects non-absolute filePath before writing (Electron's dialog returns absolute paths, but defence in depth — T-20-21)."
  - "tsconfig.web.json carve-out: src/main/doc-export.ts added to web include list so the renderer can resolve DocExportPayload through shared/types.js. Same route as Plan 20-01's documentation.ts carve-out; doesn't affect the arch.spec.ts grep gate (renderer code itself never imports from src/main/* — only from shared/types.js which re-exports types)."
  - "AppShell.atlasPreviewState memo uses fixed mode:'optimized' + maxPageDim:2048 because the export chip is a single-line snapshot, not a stepper. Mode 'optimized' matches the locked HTML-export semantics (Optimize savings)."
  - "ExportPane derives skeletonBasename from summary.skeletonPath at click time (renderer-side) instead of threading it as a prop — keeps the props interface narrower; the basename is also used by main as the dialog's defaultPath suggestion."
  - "lastOutDir prop hardcoded to null at the AppShell mount site per existing D-145 deferral (AppShell.tsx:617). When a future phase hoists lastOutDir into renderer state, this is a one-prop swap. Main falls back to app.getPath('documents') for null."

patterns-established:
  - "Pure-function HTML rendering pattern with injected non-determinism (date) for vitest golden-file snapshot tests — applicable to any future renderer that needs both production and test paths"
  - "3-tier IPC channel registration template: handler in main/ipc.ts → bridge in preload/index.ts → Api type + payload/response re-export in shared/types.ts. Phase 20 D-21 doc-export channel is the new exemplar alongside project:* and update:* channels."
  - "Renderer-side payload assembly at click time: ExportPane reads draft + props + Date.now() into a structured-clone-safe object; main owns dialog + write. No business logic in main beyond escape + atomic write — the locked HTML template is the single source of truth for the output shape."

requirements-completed:
  - DOC-04
  - DOC-05

# Metrics
duration: ~10min
completed: 2026-05-01
---

# Phase 20 Plan 04: HTML Export + IPC + Round-trip Summary

**Self-contained HTML export pipeline (DOC-04) shipped end-to-end: renderer Export pane button → contextBridge → main handler → atomic write to disk. Pure-TS template-literal-driven renderDocumentationHtml lives in src/main/doc-export.ts; XSS escape on every user-supplied string and zero external assets are regex-asserted in the test surface; golden-file snapshot freezes the output layout. Round-trip identity (DOC-05) backstopped by tests/core/documentation-roundtrip.spec.ts proving DEFAULT + representative non-empty + Phase 8-era empty {} all survive serialize → JSON.parse → validate → materialize bit-equal.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-01T19:52:19Z
- **Completed:** 2026-05-01T20:00:31Z
- **Tasks:** 2 (Task 1: TDD RED→GREEN; Task 2: single-task-scope wiring)
- **Files created:** 5 (src/main/doc-export.ts, tests/main/doc-export.spec.ts, tests/main/__snapshots__/doc-export.spec.ts.snap, tests/core/documentation-roundtrip.spec.ts, this SUMMARY.md)
- **Files modified:** 6 (src/main/ipc.ts, src/preload/index.ts, src/shared/types.ts, src/renderer/src/modals/DocumentationBuilderDialog.tsx, src/renderer/src/components/AppShell.tsx, tsconfig.web.json)
- **Test growth:** 573 → 587 (+14: 11 doc-export + 3 round-trip)

## Accomplishments

- **HTML template (D-17 + D-18 locked layout)** — `renderDocumentationHtml` produces the full output: hero row with terracotta-uppercased skeleton name, 5-chip strip (Generated DD/MM/YYYY, N Images Utilized, N Animations Configured, N Optimized Assets, N Atlas Pages (MAX_PAGE_PXpx)), Optimization Config + General Notes side-by-side row, full-width Animation Tracks table with track-divider rows + LOOP pill, Control Bones + Skins side-by-side row, Events card row appended only when `summary.events.count > 0`. Inline `<style>` block + inline SVG glyphs (per RESEARCH §Pattern 9 — viewBox 20×20, stroke=currentColor, hand-rolled paths). Locked palette from D-17 — every color literal matches the user's screenshot reference.
- **Self-containment proof (T-20-20 mitigation)** — output contains zero `<img`, zero `<script src=`, zero `<link rel="stylesheet"`, zero `url(http(s)://`, zero `@font-face`, zero `@import`. Regex-asserted in `tests/main/doc-export.spec.ts` AND verified post-snapshot via `grep -E "<script src=|<link[^>]+rel=\"stylesheet\"|<img |url\\(https?:" tests/main/__snapshots__/doc-export.spec.ts.snap` (returns nothing).
- **XSS escape (T-20-19 mitigation)** — every user-supplied string flows through `escapeHtml` before embedding. Test feeds `<script>alert(1)</script>` as `generalNotes` and `<img onerror="x">` as `animationName` and asserts the output contains `&lt;script&gt;alert(1)&lt;/script&gt;` and `&lt;img onerror=&quot;x&quot;&gt;` instead of the live tags.
- **3-tier IPC channel registration** — `'documentation:exportHtml'` registered in `src/main/ipc.ts` alongside the existing `project:*` handlers; preload bridge `exportDocumentationHtml` added to `src/preload/index.ts`; `Api.exportDocumentationHtml` typed in `src/shared/types.ts` with type-only re-export of `DocExportPayload` / `DocExportResponse` from main so the renderer pulls these through shared/types.js (no Layer 3 boundary breach).
- **Atomic write Pattern-B reused** (mirrors `src/main/project-io.ts:246-274` byte-for-byte): `writeFile(<finalPath>.tmp, html, 'utf8')` → `rename(<finalPath>.tmp, <finalPath>)`. Same-directory tmp avoids EXDEV cross-device errors. Same error envelope shape (`kind:'Unknown'`).
- **Renderer Export pane (DOC-04 UI-SPEC verbatim)** — `ExportPane` replaces `ExportPanePlaceholder`. Click → derives skeletonBasename from summary.skeletonPath → assembles structured-clone payload with `Date.now()` generatedAt → `await window.api.exportDocumentationHtml(payload)` → renders inline success ("Exported to {PATH}", text-success) or error ("Could not export documentation. {REASON}", text-danger) with the empty-message fallback string from UI-SPEC copy contract. Disabled-while-busy guard prevents re-entrant clicks.
- **AppShell prop threading** — two new memos adjacent to `buildSessionState`:
  - `atlasPreviewState` = `buildAtlasPreview(effectiveSummary, overrides, { mode:'optimized', maxPageDim:2048 })` — mirrors AtlasPreviewModal.tsx:105 with fixed mode/dim because the chip is a snapshot.
  - `savingsPctMemo` = `(1 - sumOutPixels/sumSourcePixels) * 100` — byte-identical to OptimizeDialog.tsx:280-291; returns `null` on zero rows / zero source pixels (renders as `'—'` in the export).
- **Round-trip identity (DOC-05)** — `tests/core/documentation-roundtrip.spec.ts` lands 3 tests: DEFAULT_DOCUMENTATION survives bit-equal, a representative non-empty Documentation with all 6 top-level fields populated survives bit-equal (animationTracks with multi-line notes + tabs, events with empty descriptions, controlBones, skins with empty descriptions, multi-line generalNotes, safetyBufferPercent=5), Phase 8-era `documentation:{}` slot back-fills DEFAULT_DOCUMENTATION on materialize as defence in depth. All three exercise the full serialize → JSON.stringify → JSON.parse → validate → materialize chain.
- **Phase 20 complete** — DOC-01..DOC-05 all closed end-to-end. Modal opens (DOC-01), Animation Tracks DnD (DOC-02), Sections sub-sections wired (DOC-03), HTML export self-contained + XSS-safe (DOC-04), round-trip identity proven (DOC-05).

## Task Commits

1. **Task 1 RED — failing tests for renderDocumentationHtml** — `ecab501` (test)
2. **Task 1 GREEN — renderDocumentationHtml + handleExportDocumentationHtml** — `65b0f1c` (feat)
3. **Task 2 — wire IPC + Export pane + AppShell prop threading + round-trip test** — `4dc8985` (feat)

## Files Created/Modified

- **`src/main/doc-export.ts`** (NEW, 365 lines) — renderDocumentationHtml + handleExportDocumentationHtml + escapeHtml + DocExportPayload + DocExportResponse + the locked STYLE_BLOCK + GLYPH inline SVG paths + per-section render functions (renderHero, renderChipStrip, renderOptimizationConfigCard, renderGeneralNotesCard, renderTracksCard, renderEntryListCard). Pure-TS Layer-3-respecting; the only electron surface (dialog, BrowserWindow, app) is in handleExportDocumentationHtml. atomic write via Pattern-B writeFile/rename.
- **`src/main/ipc.ts`** (MOD) — file-top import `{ handleExportDocumentationHtml, type DocExportPayload }` from `./doc-export.js`; new `ipcMain.handle('documentation:exportHtml', ...)` registration alongside the existing project:* + update:* handlers.
- **`src/preload/index.ts`** (MOD) — file-top type-only import of `{ DocExportPayload, DocExportResponse }`; new `exportDocumentationHtml` bridge calling `ipcRenderer.invoke('documentation:exportHtml', payload)`.
- **`src/shared/types.ts`** (MOD) — local type import from `'../main/doc-export.js'`; `Api.exportDocumentationHtml: (payload: DocExportPayload) => Promise<DocExportResponse>`; type-only `export type { DocExportPayload, DocExportResponse } from '../main/doc-export.js'` so renderer consumers pull through shared/types.js.
- **`src/renderer/src/modals/DocumentationBuilderDialog.tsx`** (MOD, +93 / -8) — DocumentationBuilderDialogProps gains `atlasPreview: AtlasPreviewProjection`, `exportPlanSavingsPct: number | null`, `lastOutDir: string | null`. ExportPanePlaceholder removed; ExportPane component added with the full click-handler + result rendering. AtlasPreviewProjection added to type imports from shared/types.js.
- **`src/renderer/src/components/AppShell.tsx`** (MOD, +37 / -1) — new `buildAtlasPreview` import from `../lib/atlas-preview-view.js`. Two new useMemos adjacent to buildSessionState: `atlasPreviewState` and `savingsPctMemo`. DocumentationBuilderDialog mount JSX extended with `atlasPreview={atlasPreviewState}`, `exportPlanSavingsPct={savingsPctMemo}`, `lastOutDir={null}` props.
- **`tsconfig.web.json`** (MOD) — `src/main/doc-export.ts` added to the include list (deviation Rule 3). Web typecheck program needs to see the source so the type alias resolves through shared/types.ts re-export. Mirrors the Plan 20-01 documentation.ts route. Layer 3 grep gate in tests/arch.spec.ts:19-34 still rejects renderer→core imports unchanged (the renderer never imports from `src/main/*` directly — only from `shared/types.js` which re-exports the types).
- **`tests/main/doc-export.spec.ts`** (NEW, 192 lines) — 11 tests in 1 describe block: valid HTML, self-containment (6 regex assertions), XSS escape, conditional Events card (omit + render), hero uppercase, chip strip locked formats (5 chips), tracks table layout, optimization config card, control-bones empty-state, full snapshot.
- **`tests/main/__snapshots__/doc-export.spec.ts.snap`** (NEW, 70 lines) — frozen golden-file snapshot of the full rendered HTML for the fixed payload + `generatedAt = new Date('2026-04-14T12:00:00Z').getTime()`.
- **`tests/core/documentation-roundtrip.spec.ts`** (NEW, 96 lines) — 3 tests for DOC-05 round-trip identity.

## Decisions Made

- Followed plan exactly. Specific decisions locked above in `key-decisions`. Notable points:
  - `renderDocumentationHtml` is pure (no I/O) — `generatedAt` is injected via the payload so the snapshot test pins the date for a stable golden-file output. The format helper uses `toISOString` to be TZ-stable.
  - `Animations Configured` chip counts USER-AUTHORED entries (`documentation.animationTracks.length`), NOT the rig's total animation count, per UI-SPEC §"Locking interpretation".
  - The Events card is omitted entirely when `summary.events.count === 0` (D-18 sub-step 6).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] tsconfig.web.json carve-out for src/main/doc-export.ts**
- **Found during:** Task 2 (web typecheck after wiring DocExportPayload re-export through shared/types.ts)
- **Issue:** `tsconfig.web.json` did not include `src/main/doc-export.ts`, so when shared/types.ts re-exported the types via `export type { ... } from '../main/doc-export.js'`, the renderer's typecheck program followed the import and produced TS6307: "File '/.../src/main/doc-export.ts' is not listed within the file list of project '/.../tsconfig.web.json'". This is the same error pattern Plan 20-01 hit when adding `src/core/documentation.ts` to shared/types.ts re-exports.
- **Fix:** Added `src/main/doc-export.ts` to the `tsconfig.web.json` `include` array. The Layer 3 grep gate in `tests/arch.spec.ts:19-34` still rejects renderer→core imports unchanged (it grep-scans `src/renderer/**/*.{ts,tsx}` for `from '...core/...'` literals). The renderer code itself never imports from `src/main/*` directly — only through `shared/types.js` re-exports, which is the documented Layer 3 route.
- **Files modified:** tsconfig.web.json
- **Verification:** `npm run typecheck:web` returns only the 2 pre-existing `onQueryChange` unused-prop errors (verified via `git stash` round-trip in the Plan 20-01 deferred-items.md).
- **Committed in:** `4dc8985` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking — necessary for the renderer to typecheck after the new IPC type re-export shape).
**Impact on plan:** Anticipated by Plan 20-01's deferred-items.md note — the Phase 20 documentation slot route through shared/types.ts requires tsconfig.web.json carve-outs for any cross-layer source. Same shape, same justification. No scope creep.

## Issues Encountered

- Pre-existing typecheck errors carry over from Wave 1 deferred-items.md (unchanged):
  - `scripts/probe-per-anim.ts(14,31)` — SamplerOutput type drift (dev script)
  - `src/renderer/src/panels/AnimationBreakdownPanel.tsx(286,3)` — unused `onQueryChange` prop
  - `src/renderer/src/panels/GlobalMaxRenderPanel.tsx(531,3)` — unused `onQueryChange` prop

## TDD Gate Compliance

Task 1 was `tdd="true"`. Followed the RED → GREEN cycle: failing test commit (`ecab501`, test) followed by implementation commit (`65b0f1c`, feat). RED runtime: vitest exited with `Cannot find module '../../src/main/doc-export.js'` (correct — the module did not yet exist). GREEN runtime: 11 of 11 tests pass + frozen snapshot. No REFACTOR commit needed; the implementation was already minimal and the test suite stayed green.

Task 2 was `tdd="false"` (single-task-scope wiring per the plan's justification — the IPC 3-tier + renderer Export pane + round-trip integration test are tightly coupled; splitting them would leave the IPC channel registered without a renderer caller mid-commit, creating a typecheck dead-end). Verified end-to-end: 587 tests pass.

Gate sequence verifiable in git log:
```
ecab501 test(20-04): add failing tests for renderDocumentationHtml  (RED)
65b0f1c feat(20-04): renderDocumentationHtml + handleExportDocumentationHtml  (GREEN)
4dc8985 feat(20-04): wire documentation:exportHtml IPC + Export pane + round-trip test
```

## User Setup Required

None — no external service configuration required. The new IPC channel registers automatically when the app starts. Manual smoke checklist (per `<verification>` block in PLAN.md):

1. `npm run dev`
2. Load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (existing fixture)
3. Click Documentation button → modal opens
4. Sections tab: type a description on at least one bone + general notes
5. Animation Tracks tab: click `+ Add Track`, drag any animation onto Track 0
6. Save changes (footer)
7. Re-open modal → confirm draft persists in AppSessionState (Save → Save Project to round-trip via `.stmproj`)
8. Export tab: click "Export HTML…", choose a save location, confirm the .html file opens in a browser offline with no broken refs (no missing icons, no missing fonts, no `file://` 404s)

## Next Phase Readiness

- **Phase 20 fully complete** — every requirement DOC-01..DOC-05 has shipped end-to-end with regression-gating tests:
  - DOC-01 (Plan 20-02): Documentation top-bar button wired + DocumentationBuilderDialog mount + tab strip + Cancel/Save changes footer
  - DOC-02 (Plan 20-03): Animation Tracks pane with HTML5 native DnD + per-entry editing + ↑/↓ reorder + remove-track confirm
  - DOC-03 (Plans 20-01 + 20-02): Events / Control Bones (with debounced filter) / Skins / General Notes / Safety Buffer sub-sections
  - DOC-04 (Plan 20-04): Self-contained HTML export with XSS escape + atomic write + golden-file snapshot
  - DOC-05 (Plans 20-01 + 20-04): Round-trip identity for the documentation slot proven by tests/core/project-file.spec.ts + tests/core/documentation-roundtrip.spec.ts (DEFAULT + non-empty + Phase 8-era empty {})

- **Backlog 999.7 — Safety buffer global multiplier in export math** — `safetyBufferPercent` field is shipped as documentation slot metadata + UI + HTML snapshot only. Wiring `effectiveScale × (1 + safetyBufferPercent/100)` into `buildExportPlan` is deferred to a future phase; the field is already there in every saved `.stmproj` so future phase has zero-migration runway.

- **Adjacent phases unaffected** — Phase 20 leaves `src/core/sampler.ts`, `src/core/loader.ts`, `src/main/image-worker.ts` untouched. Plan 20-01's SkeletonSummary.events extension is additive (existing consumers default-OK).

## Self-Check: PASSED

Verifications performed:

- `[ -f src/main/doc-export.ts ]` → FOUND
- `[ -f tests/main/doc-export.spec.ts ]` → FOUND
- `[ -f tests/main/__snapshots__/doc-export.spec.ts.snap ]` → FOUND
- `[ -f tests/core/documentation-roundtrip.spec.ts ]` → FOUND
- Commit `ecab501` exists in `git log --oneline` → FOUND
- Commit `65b0f1c` exists in `git log --oneline` → FOUND
- Commit `4dc8985` exists in `git log --oneline` → FOUND
- All Task 1 acceptance criteria grep counts:
  - `export function renderDocumentationHtml` count: 1 ✓
  - `export async function handleExportDocumentationHtml` count: 1 ✓
  - `writeFile` count: 1 (≥1) ✓
  - `rename` count: 1 (≥1) ✓
  - `function escapeHtml` count: 1 ✓
  - `BrowserWindow.getFocusedWindow` count: 1 ✓
  - `Export Documentation as HTML` count: 1 ✓
  - `it(` blocks count: 11 (≥8) ✓
  - Self-containment regex: snapshot returns nothing for `<img |<script src=|<link[^>]+rel="stylesheet"|url(https?:` ✓
  - XSS escape: `&lt;script&gt;` present in test runtime ✓
- All Task 2 acceptance criteria grep counts:
  - `documentation:exportHtml` in src/main/ipc.ts count: 1 (≥1) ✓
  - `handleExportDocumentationHtml` in src/main/ipc.ts count: 2 (≥1) ✓
  - `documentation:exportHtml` in src/preload/index.ts count: 1 (≥1) ✓
  - `exportDocumentationHtml` in src/preload/index.ts count: 1 (≥1) ✓
  - `exportDocumentationHtml` in src/shared/types.ts count: 1 (≥1) ✓
  - `DocExportPayload` in src/shared/types.ts count: 3 (≥1) ✓
  - `function ExportPane` in DocumentationBuilderDialog.tsx count: 1 ✓
  - `ExportPanePlaceholder` in DocumentationBuilderDialog.tsx count: 0 (placeholder removed) ✓
  - `Export HTML` in DocumentationBuilderDialog.tsx count: 2 (≥1) ✓
  - `exportDocumentationHtml` in DocumentationBuilderDialog.tsx count: 2 (≥1) ✓
  - `atlasPreview=` in AppShell.tsx count: 1 (≥1) ✓
  - `exportPlanSavingsPct` in AppShell.tsx count: 1 (≥1) ✓
  - `it(` blocks in documentation-roundtrip.spec.ts count: 3 (≥3) ✓
- `npm run test` full suite: 587 passed | 1 skipped | 2 todo across 52 files (was 573 in Plan 20-03; +14: 11 doc-export + 3 round-trip).
- `npm run typecheck:web` exits 0 except for the 2 pre-existing `onQueryChange` errors logged in deferred-items.md.
- `npm run typecheck:node` exits 0 except for the 1 pre-existing `probe-per-anim.ts` error.
- `npm run test -- tests/arch.spec.ts` exits 0 (12/12 — Layer 3 + literal-class invariants intact).
- `grep -E "<script src=|<link[^>]+rel=\"stylesheet\"|<img |url\\(https?:" tests/main/__snapshots__/doc-export.spec.ts.snap` returns NOTHING (snapshot proves self-containment).

---

*Phase: 20-documentation-builder-feature*
*Completed: 2026-05-01*

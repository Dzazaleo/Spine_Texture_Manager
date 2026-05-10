---
phase: 20-documentation-builder-feature
plan: 02-modal-shell-sections-pane
subsystem: renderer
tags:
  - electron
  - react
  - tailwind
  - modal
  - aria
  - renderer
  - documentation-builder

# Dependency graph
requires:
  - phase: 20-01-core-types-validator-summary
    provides: "Documentation interface, DEFAULT_DOCUMENTATION, intersectDocumentationWithSummary, validateDocumentation, EventDescriptionEntry/BoneDescriptionEntry/SkinDescriptionEntry, SkeletonSummary.events field, AppSessionState.documentation field, ProjectFileV1.documentation typed, shared/types.ts re-export route"
  - phase: 09-08.2-menu
    provides: "modalOpen audit list pattern (08.2 D-184) — explicit modal-state inclusion auto-suppresses File menu items"
  - phase: 06-modal-aria-scaffold
    provides: "5-modal ARIA scaffold (role=dialog + aria-modal + aria-labelledby + outer overlay onClick close + inner stopPropagation + useFocusTrap)"
  - phase: 19-ui-improvements
    provides: "Documentation top-bar button placeholder (D-03) at AppShell.tsx:1184-1196 (outlined-secondary class string); TabButton component at AppShell.tsx:1487-1515"

provides:
  - "DocumentationBuilderDialog 10th hand-rolled modal: 5-modal ARIA scaffold with min-w-[960px] max-w-[1100px] max-h-[85vh] (D-15), tab strip (Animation Tracks / Sections / Export), Sections pane FULL implementation, Tracks + Export placeholder bodies, Cancel + Save changes footer"
  - "Sections pane sub-sections (DOC-03): EventsSubSection (auto-list from summary.events.names per D-09), ControlBonesSubSection (auto-list ALL bones from summary.bones.names with debounced 100ms filter; opt-in via description.length > 0 per D-10), SkinsSubSection (auto-list ALL skins per D-11), GeneralNotesSubSection (multi-line textarea per D-12), SafetyBufferSubSection (number input [0,100] per D-22)"
  - "AppShell-hoisted documentation state with lazy initializer that intersects initialProject?.documentation (or DEFAULT_DOCUMENTATION) against summary on first paint"
  - "buildSessionState extension: documentation field threaded through AppSessionState payload to existing project:save IPC route; useCallback deps array updated"
  - "mountOpenResponse drift-policy hook: every Open / locate-skeleton recovery now applies intersectDocumentationWithSummary to drop stale entries + auto-add new events/skins (mirrors Phase 8 D-150 stale-overrides intersection)"
  - "Resample-success drift hook: re-intersect documentation against the new summary so newly-stale entries drop"
  - "Documentation top-bar button wired (DOC-01): disabled/aria-disabled/title placeholder removed; onClick={setDocumentationBuilderOpen(true)}; class string preserved verbatim"
  - "documentationBuilderOpen joins the modalOpen audit list (08.2 D-184 parity with the other 6 modal slots)"
  - "MaterializedProject.documentation field threaded through main/project-io.ts at all 3 construction sites"

affects:
  - 20-03-animation-tracks-pane-dnd (consumes the DocumentationBuilderDialog scaffold; swaps the TracksPanePlaceholder body for the full DnD implementation)
  - 20-04-html-export-ipc-roundtrip (consumes the ExportPanePlaceholder slot; threads documentation through new doc-export IPC; round-trip identity contract DOC-05 already proven by Plan 20-01 tests)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "10th hand-rolled modal using the 5-modal ARIA scaffold (verbatim from OptimizeDialog.tsx:299-315 with D-15 width swaps)"
    - "Inline-redefined TabButton component: byte-identical class string to AppShell.tsx:1487-1515 (no cross-file refactor; Tailwind v4 literal-class scanner discipline preserved)"
    - "Modal-local draft state pattern: useState seeded from props.documentation; reset on closed → open transition via wasOpenRef sentinel; committed to parent on Save changes; discarded on Cancel"
    - "Per-sub-section descByName Map pattern: useMemo over draft array → fast O(1) lookups + immutable update via map().filter()"
    - "Drift-policy single primitive (intersectDocumentationWithSummary) called on every materialize/load + every resample-success: single call site, single test surface, single source of truth (mirrors Phase 8 D-150 stale-overrides idiom)"

key-files:
  created:
    - src/renderer/src/modals/DocumentationBuilderDialog.tsx
  modified:
    - src/renderer/src/components/AppShell.tsx
    - src/shared/types.ts
    - src/main/project-io.ts
    - tests/renderer/save-load.spec.tsx
    - tests/renderer/rig-info-tooltip.spec.tsx
    - tests/renderer/app-quit-subscription.spec.tsx

key-decisions:
  - "Inline-redefine TabButton (PATTERNS option 2) instead of promoting to a shared module — avoids a cross-file refactor in this plan; the CLASS STRING is byte-identical so the visual + a11y contracts match"
  - "ControlBonesSubSection persists ONLY documented bones (description.length > 0) per D-10 opt-in semantics; the live edit map traversal preserves summary.bones.names order so re-typing into a previously-cleared bone slot inserts at the right index"
  - "MaterializedProject.documentation threaded through Open + locate-skeleton recovery paths so the renderer's drift policy has real data to act on; resample retains a placeholder (renderer carries its own state across resamples)"
  - "Drift policy applied at THREE sites: lazy initializer (initial mount), mountOpenResponse (Open / locate-skeleton), resample-success branch — covers every path that swaps the live summary out from under documentation state"
  - "Out-of-range safety buffer values are silently ignored at input time; the validator already enforces [0,100] on save (validateDocumentation in src/core/documentation.ts)"

patterns-established:
  - "Modal-local draft + commit-on-save pattern for hand-rolled modals editing complex parent state — useRef sentinel detects open transition without leaking fresh-render resets while the modal is open"
  - "Inline-redefined component pattern when a single 30-line UI primitive is needed in a parallel context; the byte-identical class string is the contract that keeps Tailwind v4 + visual + a11y aligned without a cross-file refactor"

requirements-completed:
  - DOC-01
  - DOC-03

# Metrics
duration: ~10min
completed: 2026-05-01
---

# Phase 20 Plan 02: Modal Shell + Sections Pane Summary

**DocumentationBuilderDialog 10th hand-rolled modal scaffold with three-tab strip + full Sections pane (events / control bones with debounced filter / skins / general notes / safety buffer); AppShell wiring threads documentation through lifecycle (load + save + drift) so DOC-01 + DOC-03 are exercised end-to-end.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-01T19:26:11Z
- **Completed:** 2026-05-01T19:36:05Z
- **Tasks:** 2 (no TDD; per-plan-task verify)
- **Files created:** 1 (src/renderer/src/modals/DocumentationBuilderDialog.tsx)
- **Files modified:** 6 (AppShell.tsx, shared/types.ts, project-io.ts + 3 test fixture files)

## Accomplishments

- **DocumentationBuilderDialog (10th modal)** — 5-modal ARIA scaffold verbatim from OptimizeDialog.tsx:299-315 with D-15 width swap (`min-w-[960px] max-w-[1100px] max-h-[85vh]`), `documentation-builder-title` id swap, useFocusTrap with Escape close, outer overlay onClick close, inner stopPropagation. Three-pane tab strip (Animation Tracks / Sections / Export) with verbatim TabButton class string from AppShell.tsx:1487-1515 (inline-redefined per PATTERNS option 2 — byte-identical class string preserves Tailwind v4 literal-class scanner discipline + visual + a11y contracts).
- **Sections pane FULL implementation (DOC-03)** — five sub-sections with locked copy from UI-SPEC: Events auto-list (D-09 — per-event description input; D-09 empty state "This skeleton has no events."), Control Bones (D-10 — auto-list ALL bones, debounced 100ms substring filter case-insensitive, opt-in persistence via description.length > 0), Skins (D-11 — auto-list ALL skins, ALL written even with empty descriptions), General Notes (D-12 — single multi-line textarea, plain text, no Markdown), Safety Buffer (D-22 — number input [0,100] step 0.5, metadata only this phase). Every input/textarea carries `aria-label` for screen readers (T-20-11 mitigation); no `dangerouslySetInnerHTML` surface (T-20-07 mitigation).
- **AppShell wiring (DOC-01)** — Documentation top-bar button at AppShell.tsx:1198-1209 (after edit) with disabled/aria-disabled/title removed and onClick={setDocumentationBuilderOpen(true)}; class string preserved byte-identical. Modal mounted alongside AtlasPreviewModal with effectiveSummary so post-resample doc UI reflects the new skeleton's names. documentationBuilderOpen joins the modalOpen audit list for 08.2 D-184 File menu auto-suppression.
- **Documentation state hoist + drift policy** — useState lazy initializer applies `intersectDocumentationWithSummary(initialProject?.documentation ?? DEFAULT_DOCUMENTATION, summary)` so events + skins are pre-populated with empty descriptions ready to author on first paint. mountOpenResponse and resample-success branch both re-intersect to drop newly-stale entries (single primitive, three call sites — matches Phase 8 D-150 stale-overrides idiom).
- **Round-trip wiring** — MaterializedProject gains `documentation: Documentation`; main/project-io.ts populates the field at all three construction sites (handleProjectOpenFromPath uses the validated materialized.documentation; locate-skeleton recovery + resample fall back to DEFAULT_DOCUMENTATION since the renderer carries its own state across those paths). buildSessionState now reads from the AppShell-local documentation slot, so Save / Save As persist user-authored content via the existing project:save IPC route + Plan 20-01 validator + serializer chain.
- **Test fixture compatibility** — three pre-existing renderer test files were updated to include `events: { count: 0, names: [] }` on their `makeSummary()` synthetic SkeletonSummary helpers and `documentation: DEFAULT_DOCUMENTATION` on every MaterializedProject literal so the type contract widened in Plan 20-01 doesn't break runtime when AppShell mounts.

## Task Commits

1. **Task 1 — DocumentationBuilderDialog modal scaffold + Sections pane** — `6302563` (feat)
2. **Task 2 — Wire Documentation button + state hoist + drift policy in AppShell.tsx** — `a73b3db` (feat)

## Files Created/Modified

- `src/renderer/src/modals/DocumentationBuilderDialog.tsx` (NEW, 465 lines) — 10th hand-rolled modal: 5-modal ARIA scaffold + tab strip + Sections pane (5 sub-sections) + Tracks placeholder + Export placeholder + Cancel/Save changes footer + inline TabButton with byte-identical class string. Layer 3 invariant honored: imports only react + clsx + useFocusTrap + shared/types.js (Documentation types resolved through the Plan 20-01 re-export route). Tailwind v4 literal-class discipline preserved: every className is a string literal or clsx with literal branches. ARIA: every input/textarea carries aria-label.
- `src/renderer/src/components/AppShell.tsx` (MOD) — File-top imports add DocumentationBuilderDialog + intersectDocumentationWithSummary + type Documentation. New documentationBuilderOpen state alongside atlasPreviewOpen at line 165. New documentation state with lazy initializer that intersects initialProject?.documentation against summary at line 252. buildSessionState updated to thread documentation. mountOpenResponse calls intersectDocumentationWithSummary so every Open / locate-skeleton applies drift policy. Resample-success branch re-intersects against the new summary. Documentation button wiring (lines 1199-1208 after edit): disabled/aria-disabled/title removed, onClick wired. DocumentationBuilderDialog mounted alongside AtlasPreviewModal. modalOpen audit list + useEffect deps array gain documentationBuilderOpen.
- `src/shared/types.ts` (MOD) — `MaterializedProject` interface gains `documentation: Documentation` field for renderer round-trip on Open + locate-skeleton recovery.
- `src/main/project-io.ts` (MOD) — Imports `DEFAULT_DOCUMENTATION` from core. Three `MaterializedProject` construction sites now populate documentation: `handleProjectOpenFromPath` uses `materialized.documentation` (the validated, back-filled value from materializeProjectFile); `handleProjectReloadWithSkeleton` and `handleProjectResample` fall back to `DEFAULT_DOCUMENTATION` (renderer carries own state across these paths).
- `tests/renderer/save-load.spec.tsx` (MOD) — `makeSummary()` synthetic SkeletonSummary helper now includes `events: { count: 0, names: [] }`. All 6 `MaterializedProject` literals (3 inline mocks + 3 multi-line literals) gain `documentation: DEFAULT_DOCUMENTATION`. Adds `import { DEFAULT_DOCUMENTATION }` from shared/types.
- `tests/renderer/rig-info-tooltip.spec.tsx` (MOD) — `makeSummary()` adds `events`.
- `tests/renderer/app-quit-subscription.spec.tsx` (MOD) — `makeSummary()` adds `events`.

## Decisions Made

- Followed plan exactly. Specific decisions locked here:
  - Inline-redefined TabButton instead of promoting to a shared module (PATTERNS option 2) — class string is byte-identical so visual + a11y + Tailwind v4 scanner contracts all match without a cross-file refactor.
  - Modal-local draft state pattern with `wasOpenRef` sentinel: detects closed → open transitions to reset the draft from props.documentation, but does NOT reset on parent re-renders while the modal is open (would lose user edits mid-session).
  - Drift policy applied at three sites in AppShell — initial mount lazy initializer, mountOpenResponse (Open + locate-skeleton recovery), and resample-success branch — covers every path that can swap the live summary out from under the documentation state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] MaterializedProject lacks documentation field**
- **Found during:** Task 2 (drafting the drift-policy hook)
- **Issue:** The plan's Step D referenced `props.session?.documentation` but AppShell consumes `initialProject: MaterializedProject` and `MaterializedProject` had no `documentation` field. Without threading the field, the renderer-side drift policy could never observe a saved documentation entry on Open — defeating DOC-01's load round-trip claim.
- **Fix:** Added `documentation: Documentation` to `MaterializedProject` in src/shared/types.ts; populated the field at all 3 `MaterializedProject` construction sites in src/main/project-io.ts (Open path uses validated `materialized.documentation`; locate-skeleton recovery + resample paths fall back to `DEFAULT_DOCUMENTATION` because the renderer carries documentation state across those paths and re-intersects).
- **Files modified:** src/shared/types.ts, src/main/project-io.ts
- **Verification:** typecheck clean (only pre-existing Wave 1 errors); 562 vitest pass; manually traced that handleProjectOpenFromPath threads materialized.documentation → MaterializedProject.documentation → AppShell.mountOpenResponse → intersectDocumentationWithSummary → setDocumentation.
- **Committed in:** a73b3db (Task 2)

**2. [Rule 3 — Blocking] Three pre-existing renderer test files break at runtime when SkeletonSummary lacks events**
- **Found during:** Task 2 (post-edit `npm run test` exposed 13 failures across 3 spec files)
- **Issue:** `tests/renderer/save-load.spec.tsx`, `tests/renderer/rig-info-tooltip.spec.tsx`, and `tests/renderer/app-quit-subscription.spec.tsx` all define `makeSummary()` helpers that cast to SkeletonSummary via `as unknown as SkeletonSummary` — bypassing the type-required `events` field landed in Plan 20-01. Pre-Plan-20-02, these tests passed because nothing dereferenced `summary.events`. Now AppShell's lazy initializer for `documentation` calls `intersectDocumentationWithSummary` which dereferences `summary.events.names` → TypeError on every test that mounts AppShell with a synthetic summary. Additionally, save-load.spec.tsx had 6 `MaterializedProject` literals lacking the new `documentation` field.
- **Fix:** Added `events: { count: 0, names: [] }` to all three `makeSummary()` helpers; added `documentation: DEFAULT_DOCUMENTATION` to all 6 MaterializedProject literals in save-load.spec.tsx; added DEFAULT_DOCUMENTATION import.
- **Files modified:** tests/renderer/save-load.spec.tsx, tests/renderer/rig-info-tooltip.spec.tsx, tests/renderer/app-quit-subscription.spec.tsx
- **Verification:** All 562 vitest pass; the 13 previously-failing tests are now green.
- **Committed in:** a73b3db (Task 2)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking — necessary for the plan to be runtime-correct + typecheck-clean).
**Impact on plan:** Both deviations were necessary to make the documentation slot actually round-trip end-to-end through Open + survive AppShell mount in the existing test suite. No scope creep; both fixes are tightly scoped to the new field threading and existing-test-fixture compatibility.

## Issues Encountered

- Pre-existing typecheck errors carry over from Wave 1 deferred-items.md (unchanged):
  - `scripts/probe-per-anim.ts(14,31)` — SamplerOutput type drift (dev script)
  - `src/renderer/src/panels/AnimationBreakdownPanel.tsx(286,3)` — unused `onQueryChange` prop
  - `src/renderer/src/panels/GlobalMaxRenderPanel.tsx(531,3)` — unused `onQueryChange` prop

## TDD Gate Compliance

This plan is `type=execute` (not `type=tdd`); plan tasks are `tdd="false"`. The Phase 20 test surface for the modal smoke + DnD is owned by Plan 20-03 Task 1 (RED-first scaffold) — Plan 20-02 lands the modal SCAFFOLD only, not the DnD behavior, so the modal-spec gate is appropriately deferred. Wave-1 tests in `tests/core/documentation.spec.ts` + `tests/core/project-file.spec.ts` continue to gate the validator + drift helper + round-trip identity (562 vitest passing).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 20-03 (animation-tracks-pane-dnd)** — `DocumentationBuilderDialog` scaffold + tab strip + Tracks pane placeholder slot ready to be replaced with the full DnD implementation. AnimationTrackEntry interface (Plan 20-01) + summary.animations.names (Plan 01) + the existing crypto.randomUUID() + structuredClone-safety primitives are ready as the DnD payload shape source.
- **Plan 20-04 (html-export-ipc-roundtrip)** — Export pane placeholder slot ready to be replaced with the full primary-CTA + IPC wiring. Documentation type round-trip identity (DOC-05) already proven by Plan 20-01 tests; this plan threads documentation end-to-end through the existing Save/Open IPC path (verified by manually tracing AppShell.buildSessionState → AppSessionState.documentation → serializeProjectFile → JSON disk → JSON.parse → validateProjectFile → materializeProjectFile → MaterializedProject.documentation → AppShell.mountOpenResponse → intersectDocumentationWithSummary → setDocumentation). HTML export is now the only remaining surface to wire.

## Self-Check: PASSED

Verifications performed:

- `[ -f src/renderer/src/modals/DocumentationBuilderDialog.tsx ]` → FOUND
- Commit `6302563` exists in `git log --oneline` → FOUND
- Commit `a73b3db` exists in `git log --oneline` → FOUND
- All Task 1 acceptance criteria grep-anchored items present (role="dialog", aria-modal="true", useFocusTrap(dialogRef, min-w-[960px] max-w-[1100px] max-h-[85vh], role="tablist", Animation Tracks / Sections / Export labels, Save changes, This skeleton has no events, Filter bones, safetyBufferPercent, NO electron import, NO dangerouslySetInnerHTML in JSX).
- All Task 2 acceptance criteria grep-anchored items present: `setDocumentationBuilderOpen` count 3 (declaration + button onClick + close); `DocumentationBuilderDialog` count 5 (import + JSX mount + comments); `DEFAULT_DOCUMENTATION` count 3; `Available in v1.2 Phase 20` count 0 (placeholder removed); `disabled` near `>Documentation<` count 0 (button has no disabled attribute); `documentation,` count 4 (in buildSessionState + ancestors); `intersectDocumentationWithSummary` count 4 (import + lazy initializer + mountOpenResponse + resample-success).
- typecheck:web shows only the 2 pre-existing onQueryChange errors logged in Wave 1 deferred-items.md.
- typecheck:node shows only the pre-existing probe-per-anim.ts error.
- `npm run test` returns 562 passed | 1 skipped | 2 todo across 49 files.
- arch.spec.ts (Layer 3 grep gate) green.

---

*Phase: 20-documentation-builder-feature*
*Completed: 2026-05-01*

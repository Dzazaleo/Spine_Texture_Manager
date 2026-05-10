---
phase: 20-documentation-builder-feature
plan: 01-core-types-validator-summary
subsystem: core
tags:
  - electron
  - typescript
  - validator
  - layer3
  - documentation-slot
  - structured-clone-safety

# Dependency graph
requires:
  - phase: 08-save-load-project-state
    provides: ".stmproj v1 schema with reserved `documentation: object` slot (D-148); validateProjectFile per-field validator idiom; serialize/materialize round-trip; ProjectFileParseError envelope kind"
  - phase: 01-electron-shell
    provides: "SkeletonSummary IPC contract; structuredClone-safe shape lock; summary builder (src/main/summary.ts) construction site"

provides:
  - "Documentation interface (6 keys: animationTracks, events, generalNotes, controlBones, skins, safetyBufferPercent) typed in src/core/documentation.ts"
  - "AnimationTrackEntry / EventDescriptionEntry / BoneDescriptionEntry / SkinDescriptionEntry entry interfaces"
  - "DEFAULT_DOCUMENTATION constant — canonical empty 6-key shape used by validator pre-massage and materializer back-fill"
  - "validateDocumentation(input): DocumentationValidateResult — per-field hand-rolled type guards; reuses 'invalid-shape' kind"
  - "intersectDocumentationWithSummary(doc, summary): Documentation — drift policy mirroring Phase 8 D-150 stale-overrides intersection"
  - "validateProjectFile pre-massage + per-field call: Phase 8-era forward-compat (empty {} or missing slot → DEFAULT_DOCUMENTATION)"
  - "serializeProjectFile writes state.documentation (was empty {} reserved slot)"
  - "materializeProjectFile back-fills DEFAULT_DOCUMENTATION via spread (defence in depth)"
  - "AppSessionState.documentation: Documentation field (was excluded; now part of editable session)"
  - "ProjectFileV1.documentation typed as Documentation (was object)"
  - "SkeletonSummary.events: { count, names } populated from skeletonData.events (D-09 auto-discovery source)"
  - "Runtime re-exports through src/shared/types.ts: DEFAULT_DOCUMENTATION, validateDocumentation, intersectDocumentationWithSummary"
  - "tsconfig.web.json carve-out for src/core/documentation.ts (renderer typecheck legality)"

affects:
  - 20-02-modal-shell-sections-pane (consumes Documentation type + DEFAULT_DOCUMENTATION + intersectDocumentationWithSummary)
  - 20-03-animation-tracks-pane-dnd (consumes AnimationTrackEntry + Documentation editing primitives)
  - 20-04-html-export-ipc-roundtrip (consumes Documentation in DocExportPayload + summary.events + DOC-05 round-trip identity proven here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-TS Layer 3 module with type-only cross-module import (mirrors src/core/project-file.ts boundary discipline)"
    - "Per-field hand-rolled validator returning discriminated-union { ok, error|doc } envelope (mirrors validateProjectFile idiom at lines 84-202)"
    - "Forward-compat slot pre-massage + materializer spread back-fill (handles Phase 8-era empty-object slots without bumping schema version)"
    - "Drift-policy helper as pure function (mirrors Phase 8 D-150 stale-overrides intersection; pure means single test surface, single call site in AppShell on every materialize/load)"
    - "shared/types.ts re-export route for renderer-legal access to Layer 3 types + runtime values (avoids Layer 3 grep gate breach in src/renderer)"

key-files:
  created:
    - src/core/documentation.ts
    - tests/core/documentation.spec.ts
    - .planning/phases/20-documentation-builder-feature/deferred-items.md
  modified:
    - src/core/project-file.ts
    - src/shared/types.ts
    - src/main/summary.ts
    - src/renderer/src/components/AppShell.tsx
    - tests/core/project-file.spec.ts
    - tests/main/project-io.spec.ts
    - tsconfig.web.json

key-decisions:
  - "Reuse 'invalid-shape' SerializableError kind for malformed documentation (no 9th kind added) — surfaces as ProjectFileParseError per shared/types.ts:555"
  - "Validator pre-massage handles BOTH undefined and empty {} cases (Phase 8-era + ancient-v1 forward-compat); materializer spread is defence in depth"
  - "intersectDocumentationWithSummary lives in src/core/documentation.ts as a pure function so AppShell has a single call site and tests have a single surface (resolves Plan 20-02 BLOCKER 3)"
  - "tsconfig.web.json adds src/core/documentation.ts to include + uses scoped exclude pattern (src/core/!(documentation).ts) so the Layer 3 grep gate in tests/arch.spec.ts:19-34 still rejects general core imports from renderer"
  - "AppShell.buildSessionState seeds documentation: DEFAULT_DOCUMENTATION as a placeholder; Plan 20-02 hoists actual documentation state via DocumentationBuilderDialog"

patterns-established:
  - "Layer 3 type-only re-export route through shared/types.ts: import type { Documentation } from '../core/documentation.js' on the shared/types side, type-export Documentation from shared/types, and the renderer imports types via shared/types.js without breaching the Layer 3 grep gate"
  - "Layer 3 runtime re-export route: shared/types.ts uses `export { … } from '../core/documentation.js'` for runtime values that the renderer needs; the renderer imports the runtime values from shared/types.js, never directly from core. tsconfig.web.json explicitly carves out the single core file to make this typecheck-legal"
  - "Drift-policy pure function pattern: pure (doc, summary) => doc transformation that AppShell calls on every materialize/load, parallel to Phase 8 D-150 stale-overrides intersection"

requirements-completed:
  - DOC-03
  - DOC-05

# Metrics
duration: ~10min
completed: 2026-05-01
---

# Phase 20 Plan 01: Core Types + Validator + Summary.events Summary

**Typed Documentation slot (6-key Documentation interface + per-field validator + drift helper) wired into .stmproj round-trip and SkeletonSummary.events auto-discovery; Phase 8-era forward-compat preserved via validator pre-massage + materializer back-fill**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-01T19:11:27Z
- **Completed:** 2026-05-01T19:21:07Z
- **Tasks:** 2 (TDD: 4 commits — RED test, GREEN impl per task)
- **Files created:** 3 (src/core/documentation.ts, tests/core/documentation.spec.ts, deferred-items.md)
- **Files modified:** 7 (project-file.ts, shared/types.ts, summary.ts, AppShell.tsx, project-file.spec.ts, project-io.spec.ts, tsconfig.web.json)

## Accomplishments

- Documentation interface + four entry interfaces locked as the typed shape for the .stmproj v1 D-148 reserved slot, with structuredClone-safety preserved (primitives + arrays + plain objects only)
- Per-field hand-rolled validator (`validateDocumentation`) covering all 6 fields with field-path-anchored error messages; reuses existing `'invalid-shape'` kind (no new SerializableError kind, D-04 lock honored)
- `intersectDocumentationWithSummary` drift helper landed as a pure function in src/core/documentation.ts — single call site in AppShell, single test surface (mirrors Phase 8 D-150 stale-overrides intersection); 6 drift behaviors covered by tests (orphan-bone drop, orphan-track drop, missing-skin add, missing-event add, description preservation on rebind, scalar passthrough)
- Validator pre-massage + materializer spread back-fill: Phase 8-era `.stmproj` files with `documentation: {}` (or no documentation key at all) flow through the full pipeline and yield DEFAULT_DOCUMENTATION — the critical forward-compat contract proven by the new full-pipeline test
- Round-trip identity (DOC-05) proven for both DEFAULT_DOCUMENTATION and a representative non-empty Documentation (animationTracks + events + controlBones + skins + generalNotes + safetyBufferPercent all survive serialize → JSON.parse → validate → materialize bit-equal)
- SkeletonSummary.events populated from spine-core skeletonData.events (D-09 auto-discovery source ready for Plan 20-02 sections pane)

## Task Commits

Each task TDD'd:

1. **Task 1 RED — failing tests** — `6ec0176` (test)
2. **Task 1 GREEN — Documentation types + validator + drift helper** — `815ed30` (feat)
3. **Task 2 RED — round-trip + forward-compat tests** — `059d504` (test)
4. **Task 2 GREEN — wire validator/serde + summary.events + carve-outs** — `74c854f` (feat)

## Files Created/Modified

- `src/core/documentation.ts` (NEW) — Documentation types + DEFAULT_DOCUMENTATION + validateDocumentation + intersectDocumentationWithSummary; pure-TS Layer 3 module, type-only import from shared/types.ts (no runtime imports beyond type-only).
- `src/core/project-file.ts` (MOD) — File-top import of validateDocumentation/DEFAULT_DOCUMENTATION/Documentation; validateProjectFile pre-massage block (substitutes DEFAULT_DOCUMENTATION when documentation is null/undefined or empty {}); per-field validateDocumentation call; serializeProjectFile writes state.documentation; materializeProjectFile back-fills via {...DEFAULT_DOCUMENTATION, ...file.documentation}; PartialMaterialized.documentation typed as Documentation.
- `src/shared/types.ts` (MOD) — Type re-exports for Documentation + four entry interfaces; runtime re-exports for DEFAULT_DOCUMENTATION + intersectDocumentationWithSummary + validateDocumentation; SkeletonSummary.events: { count, names } added; ProjectFileV1.documentation typed as Documentation; AppSessionState.documentation: Documentation added; AppSessionState docblock updated.
- `src/main/summary.ts` (MOD) — events: { count, names } populated from skeletonData.events.
- `src/renderer/src/components/AppShell.tsx` (MOD) — Import DEFAULT_DOCUMENTATION via shared/types.js; buildSessionState seeds documentation: DEFAULT_DOCUMENTATION (Plan 20-02 will hoist actual state).
- `tests/core/documentation.spec.ts` (NEW) — 21 tests covering validator per-field rejections, accept-cases, DEFAULT_DOCUMENTATION shape lock, and 6 drift-policy behaviors.
- `tests/core/project-file.spec.ts` (MOD) — Added validator-rejects-malformed-documentation test, round-trip preserves non-empty Documentation test (DOC-05), materializer back-fill test, two full-pipeline forward-compat tests (Phase 8-era empty {} + missing field). All AppSessionState literals carry documentation: DEFAULT_DOCUMENTATION.
- `tests/main/project-io.spec.ts` (MOD) — Import DEFAULT_DOCUMENTATION; baseState carries documentation: DEFAULT_DOCUMENTATION; assertion for parsed.documentation updated to DEFAULT_DOCUMENTATION (was {}).
- `tsconfig.web.json` (MOD) — include src/core/documentation.ts; exclude pattern scoped to src/core/!(documentation).ts (deviation Rule 3 fix; documented in deferred-items.md).
- `.planning/phases/20-documentation-builder-feature/deferred-items.md` (NEW) — Logs three pre-existing typecheck errors (probe-per-anim.ts, AnimationBreakdownPanel.tsx, GlobalMaxRenderPanel.tsx) and the tsconfig carve-out rationale.

## Decisions Made

- Followed plan exactly. Two intentional decisions specifically called out in the plan and locked here:
  - Pre-massage substitutes DEFAULT_DOCUMENTATION ONLY when documentation is `null`/`undefined` or an empty `{}` (not when populated; populated objects flow through per-field guards unchanged).
  - tsconfig.web.json carve-out is the documented Layer 3 route (CONTEXT.md line 200, PATTERNS.md line 824) — the renderer imports through shared/types.js, the typecheck program needs to see the source so the type alias resolves.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] tsconfig.web.json carve-out for src/core/documentation.ts**
- **Found during:** Task 2 (web typecheck after wiring runtime re-exports through shared/types.ts)
- **Issue:** `tsconfig.web.json` excluded `src/core/**` to enforce the Layer 3 boundary, but the documented Phase 20 route (CONTEXT.md line 200, PATTERNS.md line 824) requires the renderer to import the Documentation type + runtime helpers through shared/types.ts. Without the carve-out, `tsc --noEmit -p tsconfig.web.json` errors `TS6307: File 'src/core/documentation.ts' is not listed within the file list of project 'tsconfig.web.json'`.
- **Fix:** Added `src/core/documentation.ts` to the `include` array AND scoped the existing `exclude` glob from `src/core/**` to `src/core/!(documentation).ts` + `src/core/!(documentation)/**` so the Layer 3 grep gate (tests/arch.spec.ts:19-34) still rejects renderer imports of any other core file.
- **Files modified:** tsconfig.web.json
- **Verification:** `npm run typecheck:web` returns only the two pre-existing `'onQueryChange'` unused-prop errors (verified pre-existing via `git stash` round-trip).
- **Committed in:** 74c854f (Task 2 GREEN commit)

**2. [Rule 2 — Missing critical] AppShell.buildSessionState seeds documentation field**
- **Found during:** Task 2 (web typecheck after AppSessionState.documentation became required)
- **Issue:** AppSessionState gained a required `documentation: Documentation` field, but `buildSessionState` in AppShell did not yet populate it. Without the seed, `tsc --noEmit -p tsconfig.web.json` would fail at the literal construction site.
- **Fix:** Added `documentation: DEFAULT_DOCUMENTATION` to the buildSessionState literal with a comment noting Plan 20-02 will hoist actual documentation state into AppShell. The seed is type-correct AND runtime-correct: serializeProjectFile now writes a known-good 6-key Documentation; existing Phase 8-era files load with documentation: {} and back-fill to DEFAULT_DOCUMENTATION through the materializer.
- **Files modified:** src/renderer/src/components/AppShell.tsx
- **Verification:** All 562 tests pass; web typecheck shows no AppSessionState shape errors.
- **Committed in:** 74c854f (Task 2 GREEN commit)

**3. [Rule 2 — Missing critical] tests/main/project-io.spec.ts baseState requires documentation**
- **Found during:** Task 2 (typecheck after AppSessionState.documentation became required)
- **Issue:** `tests/main/project-io.spec.ts` constructs an `AppSessionState` literal `baseState` that did not carry the new required `documentation` field, AND asserted `expect(parsed.documentation).toEqual({})` against the now-non-empty serializer output.
- **Fix:** Imported DEFAULT_DOCUMENTATION; added `documentation: DEFAULT_DOCUMENTATION` to baseState; updated the assertion to `expect(parsed.documentation).toEqual(DEFAULT_DOCUMENTATION)`.
- **Files modified:** tests/main/project-io.spec.ts
- **Verification:** `npm run test -- tests/main/project-io.spec.ts` passes.
- **Committed in:** 74c854f (Task 2 GREEN commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 3 blocking, 2 Rule 2 missing-critical)
**Impact on plan:** All three were anticipated by the plan's `<read_first>` notes (CONTEXT.md line 200 documented the tsconfig route; the plan's action block called out updating AppSessionState literals). The fixes were necessary for the plan to be runtime-correct AND typecheck-clean. No scope creep.

## Issues Encountered

- Pre-existing typecheck errors discovered during execution (logged in deferred-items.md as out-of-scope per executor SCOPE BOUNDARY rule):
  - `scripts/probe-per-anim.ts(14,31)` — SamplerOutput type drift (dev script)
  - `src/renderer/src/panels/AnimationBreakdownPanel.tsx(286,3)` — unused `onQueryChange` prop
  - `src/renderer/src/panels/GlobalMaxRenderPanel.tsx(531,3)` — unused `onQueryChange` prop
  - All three present on the pre-Plan-20-01 commit. Logged for a future cleanup phase.

## TDD Gate Compliance

Both tasks followed the RED → GREEN cycle. Task 1 had a RED commit (`6ec0176`, test) followed by a GREEN commit (`815ed30`, feat). Task 2 had a RED commit (`059d504`, test) followed by a GREEN commit (`74c854f`, feat). No REFACTOR commits were needed — the GREEN implementations were already minimal and the test suite stayed green throughout.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 20-02 (modal-shell-sections-pane)** — Documentation type + DEFAULT_DOCUMENTATION + intersectDocumentationWithSummary all importable from shared/types.js; AppShell.buildSessionState placeholder ready to be replaced by hoisted state from DocumentationBuilderDialog.
- **Plan 20-03 (animation-tracks-pane-dnd)** — AnimationTrackEntry interface ready as the DnD drop target shape; mixTime/loop/notes fields locked.
- **Plan 20-04 (html-export-ipc-roundtrip)** — DOC-05 round-trip identity proven by tests (representative non-empty Documentation survives serialize → JSON.parse → validate → materialize bit-equal); summary.events ready as DOC-04 chip-strip / events-card data source; SkeletonSummary contract widened with the new field, no breaking changes for existing consumers (events: { count, names } is additive).

## Self-Check: PASSED

Verifications performed:

- `[ -f src/core/documentation.ts ]` → FOUND
- `[ -f tests/core/documentation.spec.ts ]` → FOUND
- `[ -f .planning/phases/20-documentation-builder-feature/deferred-items.md ]` → FOUND
- Commit `6ec0176` exists in `git log --oneline` → FOUND
- Commit `815ed30` exists in `git log --oneline` → FOUND
- Commit `059d504` exists in `git log --oneline` → FOUND
- Commit `74c854f` exists in `git log --oneline` → FOUND
- All acceptance criteria grep-anchored items present (validateDocumentation call, state.documentation write, materializer spread, AppSessionState.documentation field, summary.events.length usage, validator pre-massage block, etc.).
- Full vitest suite green: 562 passed | 1 skipped | 2 todo across 49 files.
- arch.spec.ts (Layer 3 grep gate) green.

---

*Phase: 20-documentation-builder-feature*
*Completed: 2026-05-01*

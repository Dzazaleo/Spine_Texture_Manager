---
phase: 05-unused-attachment-detection
plan: 01
subsystem: testing
tags: [typescript, vitest, ipc-contract, fixture, tdd-red, nyquist-gate, spine-core]

# Dependency graph
requires:
  - phase: 03-animation-breakdown-panel
    provides: "Phase 3 SkeletonSummary extension pattern + BreakdownRow / AnimationBreakdown interface-first convention (Pattern §3) that this plan's UnusedAttachment mirrors."
  - phase: 01-electron-react-scaffold
    provides: "src/shared/types.ts as the structuredClone-safe IPC contract file + file-top D-21 lock (no Set / Map / class instances)."
  - phase: 00-core-math-spike
    provides: "SIMPLE_TEST.{json,atlas,png} fixture + loadSkeleton / sampleSkeleton / SamplerOutput shape that the spec and the Plan 02 detector consume."
provides:
  - "UnusedAttachment IPC contract interface (7 primitive fields) + SkeletonSummary.unusedAttachments field extension — Wave 0 Nyquist gate."
  - "SIMPLE_TEST_GHOST.{json,atlas} forked fixture with a single ghost-def delta (GHOST at 64x64 inside CIRCLE slot dict, never rendered, never referenced by any timeline)."
  - "tests/core/usage.spec.ts — 297-line RED spec suite (11 it blocks across 3 describe blocks) covering fixture cases + cross-skin semantics + F6.1 sanity canary + N2.3 hygiene."
  - "tests/core/summary.spec.ts F6.2 field-shape assertion (Array.isArray + empty-on-SIMPLE_TEST + structuredClone round-trip)."
affects: [05-02, 05-03, 05-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 Nyquist gate: write the RED spec FIRST in Plan N, drive it GREEN in Plan N+1 — same-phase multi-plan TDD."
    - "In-memory synthetic SkeletonData + SamplerOutput helper (`buildSynthetic`) for cross-skin test coverage when the real fixture has only one skin (RESEARCH Pitfall 1)."
    - "Optional IPC-contract field during Wave 0 scaffold (`unusedAttachments?: UnusedAttachment[]`) so the projection layer (src/main/summary.ts) typechecks cleanly until Plan N+1 wires the write site."
    - "Ghost-def fixture fork via minimal-mutation: register attachment in a slot's dict but NEVER set as slot default and NEVER reference via AttachmentTimeline — canonical D-95 representation with a 12-line diff."

key-files:
  created:
    - "tests/core/usage.spec.ts (297 lines)"
    - "fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json (420 lines, forked from SIMPLE_TEST.json + 1-line GHOST entry)"
    - "fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.atlas (11 lines, forked from SIMPLE_TEST.atlas + 2-line GHOST bounds entry)"
  modified:
    - "src/shared/types.ts (+47 lines — UnusedAttachment interface + SkeletonSummary field extension)"
    - "tests/core/summary.spec.ts (+14 lines — F6.2 field-shape assertion)"

key-decisions:
  - "unusedAttachments field declared OPTIONAL (not required) on SkeletonSummary — reconciles Task 1 + Task 4 acceptance (both require tsc-clean node project) with the Wave-0-RED-by-design summary.spec behavior. Documented deviation."
  - "F6.1 sanity canary lives in usage.spec.ts, not in sampler.spec.ts — tests the Defined ⊇ Used invariant at the point where a regression would manifest (findUnusedAttachments false negatives), not where the bug originates (sampler)."
  - "GHOST fixture atlas keeps the SIMPLE_TEST.png page-header reference — no PNG fork needed since CLAUDE.md #4 says the math phase does not decode PNGs and the loader consumes only atlas metadata."

patterns-established:
  - "Optional-field wave-bridge: when Plan N adds an interface field that Plan N+1 will populate, declare the field OPTIONAL in Plan N so the projection-layer typecheck stays green between plans."
  - "Grep-anchored RED spec: vitest treats module-resolution failures as test failures, so a spec that imports an unimplemented module locks the Nyquist gate at the import layer — no test bodies need run."
  - "In-memory synthetic SkeletonData construction for cross-skin tests: minimal SkeletonData + Skin + SlotData + BoneData + RegionAttachment graphs + PeakRecord-shaped Map entries bypass the full sampler lifecycle."

requirements-completed:
  - F6.1
  - F6.2

# Metrics
duration: 6min
completed: 2026-04-24
---

# Phase 5 Plan 01: Wave 0 Scaffolding for Unused Attachment Detection Summary

**IPC contract (`UnusedAttachment` + `SkeletonSummary.unusedAttachments?`), ghost-def fixture fork (`SIMPLE_TEST_GHOST`), and 297-line RED spec suite locking the detection behavior Plan 02 must drive GREEN.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-24T18:39:16Z
- **Completed:** 2026-04-24T18:44:56Z
- **Tasks:** 4
- **Files created:** 3 (usage.spec.ts, SIMPLE_TEST_GHOST.json, SIMPLE_TEST_GHOST.atlas)
- **Files modified:** 2 (src/shared/types.ts, tests/core/summary.spec.ts)

## Accomplishments

- `src/shared/types.ts` exports `UnusedAttachment` with seven primitive fields (attachmentName, sourceW, sourceH, definedIn: string[], dimVariantCount, sourceLabel, definedInLabel) — D-96 name-level aggregation + D-98 dim divergence + D-35 preformatted labels, all structuredClone-safe per D-21.
- `SkeletonSummary` gains `unusedAttachments?: UnusedAttachment[]` (Wave-0-optional; see Deviations).
- `SIMPLE_TEST_GHOST.json` forked with a single `"GHOST": { "width": 64, "height": 64 }` sibling inside the `default` skin's CIRCLE slot dict — never referenced by any animation's attachment timeline, never set as slot default. RESEARCH Finding #4 minimal-mutation pattern. CIRCLE mesh block preserved byte-for-byte.
- `SIMPLE_TEST_GHOST.atlas` forked with `GHOST\nbounds:0,0,64,64` appended so `load.sourceDims.get('GHOST')` resolves to `{ w: 64, h: 64 }`. Page-header `SIMPLE_TEST.png` preserved — no PNG fork (CLAUDE.md #4).
- `tests/core/usage.spec.ts` — 297-line RED spec suite with **11 it() blocks across 3 describe blocks**:
  - **Fixture cases (2):** SIMPLE_TEST baseline empty + SIMPLE_TEST_GHOST returns 1 GHOST row.
  - **Cross-skin semantics (6):** D-93 cross-skin visibility (c), D-98 dim divergence (d), D-92 alpha-zero (e), D-92 attachment-timeline (f), D-107 sort contract, F6.1 sanity canary (Defined ⊇ Used).
  - **Module hygiene (3):** N2.3 no filesystem imports, D-100 export surface, CLAUDE.md #5 DOM-free.
- `tests/core/summary.spec.ts` extended with F6.2 field-shape assertion (Array.isArray + empty-on-SIMPLE_TEST + structuredClone round-trip).

## Task Commits

1. **Task 1: Extend `src/shared/types.ts` with `UnusedAttachment` interface + `SkeletonSummary.unusedAttachments` field** — `30f271b` (feat)
2. **Task 2: Fork `SIMPLE_TEST_GHOST.{json,atlas}` fixtures with ghost-def mutation** — `54be831` (feat)
3. **Task 3: Create `tests/core/usage.spec.ts` RED spec — 11 test cases including F6.1 sanity canary + N2.3 hygiene** — `6c430df` (test)
4. **Task 4: Extend `tests/core/summary.spec.ts` with F6.2 unusedAttachments field-shape RED assertion** — `d925b6f` (test)

_Plan metadata commit (SUMMARY.md) follows this document._

## Files Created/Modified

- `src/shared/types.ts` — +47 lines: new `UnusedAttachment` interface immediately before `SkeletonSummary`, plus one new optional field on `SkeletonSummary` alongside `animationBreakdown`.
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json` — 420 lines: verbatim copy of SIMPLE_TEST.json + one `"GHOST": { "width": 64, "height": 64 }` sibling in the CIRCLE slot dict (line 132).
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.atlas` — 11 lines: verbatim copy of SIMPLE_TEST.atlas + appended `GHOST\nbounds:0,0,64,64`.
- `tests/core/usage.spec.ts` — 297 lines: RED spec suite for Plan 02's `findUnusedAttachments`.
- `tests/core/summary.spec.ts` — +14 lines: one new `it()` block inside the existing `describe('buildSummary (D-21, D-22)')` block.

## Decisions Made

- **Optional-field wave-bridge:** Declared `SkeletonSummary.unusedAttachments?:` OPTIONAL (not required) to reconcile the plan's two competing acceptance gates — Task 1 requires `tsc --noEmit -p tsconfig.node.json exits 0`, and Task 4 requires the same gate to stay green AFTER adding a test that asserts the field exists on the summary output. A required field would break `src/main/summary.ts`'s return shape until Plan 02 wires the write site; an optional field lets the typecheck stay clean while the runtime value is `undefined` (driving the F6.2 test RED as designed). Plan 02 may promote this to required at the same time it wires the write site.
- **F6.1 sanity canary placement:** Lives in `usage.spec.ts` alongside the detection tests, NOT in `sampler.spec.ts`. The invariant (every `globalPeaks` attachment name must be registered in at least one skin) is a canary against sampler bugs that would cause the detection algorithm to report false negatives — it belongs where the manifestation would be observed.
- **No PNG fork for GHOST fixture:** CLAUDE.md #4 locks the math phase as zero-PNG-decode; the loader consumes atlas metadata only. Keeping the `SIMPLE_TEST.png` page-header reference avoids an unnecessary PNG copy and matches RESEARCH Pitfall 2 guidance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Declared `SkeletonSummary.unusedAttachments` as optional instead of required**

- **Found during:** Task 1 verification (`npx tsc --noEmit -p tsconfig.node.json`)
- **Issue:** The plan's `<interfaces>` block specifies `unusedAttachments: UnusedAttachment[]` (required). However, Task 1's acceptance criterion 7 ("`npx tsc --noEmit -p tsconfig.node.json` exits 0") and Task 4's acceptance criterion 7 (same) cannot both be satisfied with a required field: adding a required field to the return type of `buildSummary()` breaks `src/main/summary.ts` with TS2741 until Plan 02 wires the write site. Simultaneously, Task 4 specifies that the F6.2 test should be RED because `buildSummary` returns the field as `undefined` — which is only compatible with the field being optional at the type level.
- **Fix:** Declared the field as `unusedAttachments?: UnusedAttachment[]` (optional) with a JSDoc note explaining the Wave-0-scaffold rationale and forward-referencing Plan 02 as the tightener. Runtime behavior is identical (field is `undefined` until Plan 02 populates it); compile-time node project stays clean.
- **Files modified:** `src/shared/types.ts`
- **Verification:** `npx tsc --noEmit -p tsconfig.node.json` returns clean w.r.t. this plan's files (only pre-existing `scripts/probe-per-anim.ts` deferred + Wave-0-by-design `usage.spec.ts` module-not-found errors remain, both out-of-scope per SCOPE BOUNDARY); `tsconfig.web.json` is fully clean. Task 4's F6.2 test confirmed RED (1 failed | 4 passed in `summary.spec.ts`).
- **Committed in:** `30f271b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking / plan-self-inconsistency reconciliation)
**Impact on plan:** Pure Wave-0 scaffolding adjustment. No scope creep. All plan objectives met (IPC contract declared, fixture forked, RED specs locked). Plan 02 may keep the field optional or tighten it to required when wiring `buildSummary` — either choice is compatible with this file's shape.

## Issues Encountered

- **Pre-existing `scripts/probe-per-anim.ts` TS2339** — deferred to `.planning/phases/04-scale-overrides/deferred-items.md` per Phase 4 policy; unrelated to Phase 5 work.

## Test Suite State

Full `npm run test` after all commits:
- **116 passed** (matches pre-Phase-5 baseline) + **1 skipped** (preserved) + **1 failed** (the new F6.2 assertion in `summary.spec.ts` — RED by design)
- **2 test files failed** by design: `tests/core/usage.spec.ts` (module-not-found on unimplemented `src/core/usage.ts` — Wave 0 gate) + `tests/core/summary.spec.ts` (1 of 5 tests red — F6.2 awaits Plan 02)
- **Arch gates:** 8/8 green. No new renderer→core imports. No portability literals introduced.
- **Typecheck:** `tsconfig.web.json` fully clean; `tsconfig.node.json` clean w.r.t. this plan's files (only deferred + Wave-0-by-design errors remain).

## TDD Gate Compliance

Plan 01 is a RED-only scaffold. The TDD cycle for `findUnusedAttachments` is plan-level across Plans 01+02:
- **RED (this plan, 05-01):** `test(05-01): add RED spec for findUnusedAttachments` — commit `6c430df`. Confirmed failing: module resolution error on `src/core/usage.js`.
- **GREEN (next plan, 05-02):** `feat(05-02): implement src/core/usage.ts` — will land in Plan 02 and drive the spec green.
- **REFACTOR (optional, Plan 02 or 04):** only if cleanup needed after Plan 02.

No same-plan REFACTOR needed; this plan is spec + scaffold only.

## Next Plan Readiness (05-02)

Plan 02 can start immediately:
- **Contract is live:** `UnusedAttachment` + `SkeletonSummary.unusedAttachments` both import-resolvable.
- **Spec is RED:** Plan 02's implementation signal is the 8-to-11 vitest cases turning GREEN (2 fixture + 6 cross-skin/invariant; the 3 hygiene tests require `src/core/usage.ts` to exist to run).
- **Fixture ready:** `SIMPLE_TEST_GHOST.{json,atlas}` will produce `load.sourceDims.get('GHOST') === { w: 64, h: 64 }` and `load.skeletonData.skins[0].attachments` carries GHOST on CIRCLE's slot index.
- **No blockers.**

## Self-Check

Files created/modified verification:
- `src/shared/types.ts` — FOUND (modified, +47 lines; grep confirms `export interface UnusedAttachment` + `unusedAttachments?: UnusedAttachment[]` each = 1)
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json` — FOUND (420 lines)
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.atlas` — FOUND (11 lines)
- `tests/core/usage.spec.ts` — FOUND (297 lines)
- `tests/core/summary.spec.ts` — FOUND (modified, +14 lines; F6.2 assertion present)

Commits verification (all present in `git log --oneline`):
- `30f271b` feat(05-01): add UnusedAttachment interface + SkeletonSummary.unusedAttachments field — FOUND
- `54be831` feat(05-01): fork SIMPLE_TEST_GHOST fixtures with ghost-def mutation — FOUND
- `6c430df` test(05-01): add RED spec for findUnusedAttachments (Wave 0 Nyquist gate) — FOUND
- `d925b6f` test(05-01): extend summary.spec.ts with F6.2 unusedAttachments field-shape RED assertion — FOUND

## Self-Check: PASSED

---
*Phase: 05-unused-attachment-detection*
*Plan: 01*
*Completed: 2026-04-24*

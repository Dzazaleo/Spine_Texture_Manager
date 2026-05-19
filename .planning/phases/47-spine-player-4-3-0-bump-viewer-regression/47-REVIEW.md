---
phase: 47-spine-player-4-3-0-bump-viewer-regression
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/main/summary.ts
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/modals/AnimationPlayerModal.tsx
  - src/renderer/src/modals/AnimationPlayerModal42.tsx
  - src/renderer/src/modals/AnimationPlayerModalRouter.tsx
  - src/shared/types.ts
  - package.json
  - tests/renderer/animation-player-modal-42.spec.tsx
  - tests/renderer/animation-player-modal.spec.tsx
  - tests/renderer/app-shell-animation-viewer.spec.tsx
  - tests/runtime/dual-viewer-routing.spec.ts
  - tests/runtime/dv1-42-parse-guard.spec.ts
  - tests/runtime/reg4701-buildsummary-handoff.spec.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 47: Code Review Report

**Reviewed:** 2026-05-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the Phase 47 dual-runtime Animation Viewer seam introduced in
`5b35935..HEAD`: the `AnimationPlayerModalRouter` dispatcher, the additive
`runtimeTag` field on `SkeletonSummary` + its population in `src/main/summary.ts`,
the AppShell import/JSX swap, the frozen `AnimationPlayerModal42` integration,
the `package.json` alias-trio addition, and the new `tests/runtime/*` +
`tests/renderer/animation-player-modal-42.spec.tsx` specs.

The core dispatch is sound. The `runtimeTag` thread is end-to-end safe:
`SpineRuntime.tag` is a required `RuntimeTag` field, `loader.ts:927` always
assigns `runtime: rt` (never undefined in practice), `summary.ts:326-330`
null-guards `load.runtime` with a hard throw before reading `rt.tag`, and
`SkeletonSummary.runtimeTag` is a required `'4.2' | '4.3'` union — so the
dispatcher never sees an undefined tag. The `AnimationPlayerModalRouter`
defaults all non-`'4.2'` tags to the 4.3 modal, which is correct given the
required two-value union (no third path possible). AppShell's swap is a
minimal import + JSX-tag change with byte-identical props. The frozen
`AnimationPlayerModal42` is verified byte-verbatim against `9f967d2` (only the
sanctioned sentinel + 2 seds differ) and only reads `summary.skeletonPath` /
`summary.atlasPath`, both still present — integration around the frozen body
is correct.

One real robustness concern in `summary.ts` (a guard that does not match its
own documented contract) and three minor quality items in the new test files.
No security issues, no data-loss risks, no crashes attributable to this
execution's changes. Frozen-body, `@ts-nocheck`, 47-01-era modal, and the
alias-trio design are LOCKED per scope guardrails and were not relitigated.

## Warnings

### WR-01: `summary.ts` runtime null-guard message claims a contract the type system does not enforce, and the guard is structurally unreachable on the documented path

**File:** `src/main/summary.ts:325-333`
**Issue:** `load.runtime` is typed `runtime?: SpineRuntime` (OPTIONAL — see
`src/core/types.ts:192`). `buildSummary` correctly null-guards it
(`if (rt == null) throw`). However, the same `LoadResult` shape is consumed
*earlier* in the same function and across the chain (`sampleSkeleton` →
`buildSummary`) without that guard, and `summary.ts` itself dereferences
`load.skeletonData`, `load.skins`, etc. unconditionally above line 325. If a
caller ever constructs a `LoadResult` without `runtime` (the type permits it),
the failure surfaces here at line 331 with a buildSummary-specific message,
but the actual contract violation ("loader must populate `runtime`") is a
property of `loadSkeleton`, not `buildSummary`. The guard is good defensive
practice, but the optional-typed field + scattered unguarded `load.*` access
means the *type* does not actually express the "always populated" invariant
the comment and `reg4701-buildsummary-handoff.spec.ts` rely on. A future
refactor that wires a synthetic `LoadResult` (tests already do this pattern
elsewhere) gets a late, misleading throw instead of a compile error.
**Fix:** Either tighten the source-of-truth type so the invariant is
compile-enforced (preferred — converts a runtime landmine to a contract, per
`feedback_explicit_identity_over_inference`):
```ts
// src/core/types.ts — if loader.ts:927 ALWAYS assigns runtime, make it required:
runtime: SpineRuntime; // was: runtime?: SpineRuntime
```
…then the `summary.ts:326-330` throw becomes dead code and can be removed.
If `runtime?` must stay optional for staged-construction reasons, keep the
throw but document *why the type stays optional* at the `core/types.ts`
declaration site so the next reader does not "fix" it by deleting the guard.

## Info

### IN-01: Dead/incorrect `unusedAttachments` key in modal-42 test fixture

**File:** `tests/renderer/animation-player-modal-42.spec.tsx:293`
**Issue:** `makeSummary()` returns an object with `unusedAttachments: []`.
No such field exists on `SkeletonSummary` (the real field is
`skippedAttachments: { name; expectedPngPath }[]`, `types.ts:863`). The object
is cast `as unknown as SkeletonSummary` so tsc does not catch it, and the
frozen modal never reads it, so the test still passes — but the key is dead
noise carried verbatim from the v1.5.1-era spec and could mislead a future
editor into thinking `unusedAttachments` is part of the contract.
**Fix:** Drop the `unusedAttachments: []` line, or rename it to
`skippedAttachments: []` to match the real `SkeletonSummary` shape.

### IN-02: `dual-viewer-routing.spec.ts` `makeSummary` filler omits required `SkeletonSummary` fields

**File:** `tests/runtime/dual-viewer-routing.spec.ts:91-103`
**Issue:** The dispatcher-arm `makeSummary` builds a partial object cast
`as unknown as SkeletonSummary` that omits many required fields
(`skeletonPath`, `atlasPath`, `animationBreakdown`, `skippedAttachments`,
`hasAtlasFile`, `hasImagesDir`, etc.). This is intentional ("only `runtimeTag`
is load-bearing") and correct for *this* test's purpose, but the `as unknown as`
double-cast disables the one compile-time signal that would catch a future
required-field addition to `SkeletonSummary` from silently passing through the
router untested. Acceptable given the router truly only reads `runtimeTag`,
but worth a one-line note in the helper that the cast is deliberate scope
narrowing, not an oversight (the comment at :88-90 explains *what* but a reader
may still flag the `as unknown as`).
**Fix:** No behavior change needed. Optionally add `// eslint-disable` /
inline note that the partial cast is intentional minimal-carrier scope, so a
future contributor does not "helpfully" fill it in and dilute the test's
explicit-identity-only intent.

### IN-03: `reg4701-buildsummary-handoff.spec.ts` references stale `summary.ts:300` line number in prose

**File:** `tests/runtime/reg4701-buildsummary-handoff.spec.ts:14-15,68`
**Issue:** The header and an inline comment cite the pre-fix crash site as
`buildSummary src/main/summary.ts:300` and `summary.ts:19 import + :300 ctor`.
The current `summary.ts` has the runtime materialization at ~line 331 and the
import note at line 30; `:300` no longer maps to anything related. This is
documentation-only (the test asserts `.not.toThrow()` + `runtimeTag`, which is
behaviorally correct and robust to line drift), but the stale line citation
will mislead anyone bisecting a future regression from this comment.
**Fix:** Replace the hard `:300` / `:19` line citations with a symbolic
reference (e.g. "the `rt.makeSkeleton(load.skeletonData)` site in
`buildSummary`") so the standing-guard prose stays accurate across edits.

---

_Reviewed: 2026-05-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

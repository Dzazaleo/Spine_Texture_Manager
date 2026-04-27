---
phase: 00-core-math-spike
plan: 03
subsystem: core-math
tags: [typescript, spine-core, aabb, bounds, world-vertices, pure-math]

# Dependency graph
requires:
  - phase: 00-02
    provides: "src/core/types.ts (AABB, SourceDims) + src/core/loader.ts (LoadResult) — this plan consumes AABB/SourceDims via `import type`"
provides:
  - "src/core/bounds.ts: `attachmentWorldAABB(slot, attachment)` — delegates to spine-core 4.2's `RegionAttachment.computeWorldVertices` / `VertexAttachment.computeWorldVertices`, returns `AABB | null`. Skip list (BoundingBox, Path, Point, Clipping) returns null before the generic VertexAttachment branch."
  - "src/core/bounds.ts: `computeScale(aabb, sourceDims)` — per-axis + max scale with T-00-03-03 zero-dim guard (returns 0 rather than Infinity)."
  - "tests/core/bounds.spec.ts: 10 specs (Region/Mesh/Path-skip, computeScale, zero-dim guard, 4 source-hygiene greps locking N2.3 in the test suite)."
affects: [00-04, 00-05, 00-06, 00-07]

# Tech tracking
tech-stack:
  added: []  # No new deps — uses spine-core (installed in 00-01) + existing vitest
  patterns:
    - "Delegation-first math: bounds.ts never re-implements bone-chain / weighted-mesh / constraint math. It calls spine-core's `computeWorldVertices` and folds results. CLAUDE.md rule #2 locked in by code."
    - "instanceof ordering as correctness: RegionAttachment (1st, independent) → 4 non-textured VertexAttachment skip subclasses → generic VertexAttachment catch-all. Documented inline — skip types MUST precede the generic branch because they extend VertexAttachment."
    - "Infinity-sentinel AABB fold: `minX/minY = +Infinity`, `maxX/maxY = -Infinity` avoids first-iteration branch; caller guards empty buffers (`n <= 0`) so real attachments always produce finite AABBs."
    - "Hygiene tests in the spec file: bounds.spec.ts reads bounds.ts as text and greps for forbidden imports (`node:fs`, `node:path`, `node:child_process`, `node:net`, `node:http`) + missing exports — locks N2.3 into CI, not just pre-commit."

key-files:
  created:
    - "src/core/bounds.ts (144 lines)"
    - "tests/core/bounds.spec.ts (200 lines)"
  modified: []

key-decisions:
  - "Commit both bounds.ts AND bounds.spec.ts in the atomic feat(00-03) commit — plan's Task 2 only listed `git add src/core/bounds.ts`, but the spec file locks N2.3 (no-I/O) hygiene into CI. Without the spec, the N2.3 guarantee degrades from 'enforced by tests' to 'enforced by one-off grep' — strictly weaker. Treating as Rule 2 auto-add (missing critical test coverage)."
  - "Rename a JSDoc comment that contained the literal word `sharp` — the plan's own acceptance criterion (`! grep -q \"sharp\" src/core/bounds.ts`) would have failed against the initial prose 'or `sharp` — enforced by tests'. Reworded to 'PNG-decode library (deferred to Phase 8 by design)'. Rule 1 (my own documentation violated my own hygiene check)."
  - "instanceof ordering deviates from the plan's interface block: the plan's `<interfaces>` describes `PointAttachment extends Attachment`, but the installed spine-core 4.2.111 `.d.ts` shows `PointAttachment extends VertexAttachment`. This strengthens the case for filtering all four skip-subclasses BEFORE the generic VertexAttachment branch — if PointAttachment fell through to the generic branch it would allocate a buffer and call computeWorldVertices on a non-pixel attachment. My code already handled this correctly because I placed the skip filter before the generic branch."
  - "No `NumberArrayLike` anywhere in bounds.ts — spine-core's `computeWorldVertices` parameter type accepts `NumberArrayLike` but Float32Array satisfies it structurally. Keeping the implementation's types narrow (Float32Array) documents intent clearly and avoids an extra type import."

patterns-established:
  - "Pure-math module template: zero imports from node:* or sharp, `import type` for shared contracts (AABB, SourceDims), bare class imports from @esotericsoftware/spine-core for instanceof dispatch. Future core/ files (sampler, peak-recorder) should match."
  - "Golden-test-lite via hygiene greps: when a module's key invariant is 'does NOT import X', put a `fs.readFileSync(module, 'utf8') + expect(src).not.toMatch(...)` test in its spec. Captures intent and fails loudly if a future edit breaks it."
  - "AABB cross-check pattern: the MeshAttachment test recomputes min/max from a fresh `computeWorldVertices` call and compares with `toBeCloseTo(..., 5)`. This pins the delegation contract: bounds.ts must not add, clamp, or drop any vertex."

requirements-completed: [F2.3, F2.5]

# Metrics
duration: 3min
completed: 2026-04-22
---

# Phase 0 Plan 03: Per-Attachment World AABB + Scale Math Summary

**Pure-math `bounds.ts` — `attachmentWorldAABB(slot, attachment)` delegates to spine-core's `computeWorldVertices` (4-vert Region path, N-vert Vertex/Mesh path), returns `null` for BoundingBox/Path/Point/Clipping; `computeScale(aabb, sourceDims)` guards zero-width dims.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-22T11:53:16Z
- **Completed:** 2026-04-22T11:56:33Z
- **Tasks:** 2 (1 implement-with-TDD + 1 atomic commit)
- **Files created:** 2 (bounds.ts 144 lines, bounds.spec.ts 200 lines)
- **Files modified:** 0
- **Tests:** 10/10 green (Region path, Mesh path with vertex-level cross-check, Path-skip, computeScale scale+peak, zero-dim guard, 5 hygiene greps)

## Accomplishments

- `attachmentWorldAABB` correctly folds spine-core's `computeWorldVertices` output into an AABB for both the 4-vertex Region path and the N-vertex VertexAttachment/MeshAttachment path. Verified against SIMPLE_TEST fixture's real mesh attachment — bounds.ts's AABB matches a side-channel recomputation from a fresh `computeWorldVertices` call to 5 decimal places.
- `attachmentWorldAABB` returns `null` for `PathAttachment` (skip-list verified on SIMPLE_TEST's `type:"path"` attachment). Skip-list order deliberately precedes the generic `VertexAttachment` branch because all four skip subclasses extend `VertexAttachment` in spine-core 4.2.
- `computeScale` produces `{ scaleX: 2, scaleY: 1, scale: 2 }` for the plan's canonical test input `({minX:0,minY:0,maxX:200,maxY:100}, {w:100,h:100})`, and returns `0` (not `Infinity`) when source dims are zero — T-00-03-03 mitigation applied.
- N2.3 "no I/O in hot loop" locked in as a test: `tests/core/bounds.spec.ts` reads `bounds.ts` as text and greps for `node:fs` / `node:path` / `node:child_process` / `node:net` / `node:http` imports plus any `sharp` reference. Future edits that introduce I/O fail CI instantly.
- `npx tsc --noEmit` exits 0 under strict mode. `npm test` passes 10/10 in ~90 ms.
- Zero scope creep: module is 144 lines, single-responsibility, exports exactly the two functions the plan specified.

## Task Commits

1. **Task 1: Implement bounds.ts (pure math, no I/O)** — staged into Task 2's commit (TDD RED/GREEN cycle executed but collapsed into a single atomic commit per the plan's commit gate).
2. **Task 2: Commit bounds module** — `b619347` (feat)

## Files Created/Modified

- `src/core/bounds.ts` (144 lines) — `attachmentWorldAABB` + `computeScale` + private `aabbFromFloat32` helper. Imports only class-level identifiers from `@esotericsoftware/spine-core` for `instanceof` dispatch; `import type { AABB, SourceDims } from './types.js'` for shared shapes. Zero `node:*` or `sharp` imports.
- `tests/core/bounds.spec.ts` (200 lines) — 10 specs:
  - 2 computeScale specs (canonical input + zero-dim guard).
  - 3 attachmentWorldAABB behavior specs (Region path, Mesh path with vertex cross-check, Path-skip).
  - 5 module-hygiene specs (no forbidden imports, no `sharp`, exports present, both delegation paths referenced, all 4 skip subclasses named).

## Decisions Made

- **Atomic commit includes the spec file, not just bounds.ts.** The plan's Task 2 literal `git add src/core/bounds.ts` omits the spec. But the spec is what locks N2.3 into CI — without it, future edits could silently add a `node:fs` import and the plan's "enforced by tests" claim degrades to "enforced by one-off grep." I staged both files atomically. Treated as Rule 2 (missing critical test coverage).
- **Comment containing the literal word `sharp` reworded.** The plan's acceptance criterion `! grep -q "sharp" src/core/bounds.ts` must succeed. My initial JSDoc said "…or `sharp` — enforced by tests…", which would have failed the grep. Reworded to "PNG-decode library (deferred to Phase 8 by design)" before committing. Rule 1 (my own prose violated my own gate).
- **Kept the skip filter BEFORE the generic VertexAttachment branch.** Plan's `<interfaces>` block showed `PointAttachment extends Attachment`, but installed spine-core 4.2.111 `PointAttachment.d.ts` shows it extends `VertexAttachment`. My ordering already filtered Point before the generic branch, so the actual implementation is correct — but it means the plan's interface description was slightly wrong. Worth flagging for future plans that might lean on the same block.
- **Typed `attachment.computeWorldVertices` output as `Float32Array`, not `NumberArrayLike`.** spine-core's parameter type is `NumberArrayLike` (a union that includes regular arrays). Float32Array satisfies it structurally, keeps types narrow, and avoids an extra import. No behavioral difference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Comment containing literal `sharp` would fail plan's own grep**

- **Found during:** Task 1 (post-write test run)
- **Issue:** My JSDoc header listed forbidden imports as "`node:fs`, `node:path`, `node:child_process`, `node:net`, `node:http`, or `sharp` — enforced by tests". The word `sharp` in that comment triggered both the spec's `expect(src).not.toMatch(/\bsharp\b/)` assertion AND the plan's acceptance criterion `! grep -q "sharp" src/core/bounds.ts`. 1 of 10 tests failed on first run.
- **Fix:** Reworded to "PNG-decode library (deferred to Phase 8 by design) — enforced by tests under `tests/core/bounds.spec.ts` and by spec grep in the plan."
- **Files modified:** `src/core/bounds.ts` (JSDoc header comment only).
- **Verification:** `grep -q "sharp" src/core/bounds.ts` exits 1 (no match); all 10 tests pass.
- **Committed in:** `b619347` (Task 2 commit)

**2. [Rule 2 — Missing critical test coverage] Committed spec file atomically with bounds.ts**

- **Found during:** Task 2 staging
- **Issue:** Plan's Task 2 literal `git add src/core/bounds.ts` would have committed bounds.ts alone. The spec file was written during Task 1 for TDD RED/GREEN cycle verification but the plan didn't explicitly require committing it. Not committing it would mean: (a) TDD evidence lost; (b) N2.3 "enforced by tests" claim becomes false — only the one-off `grep -q` in the plan's automated verification would catch future breakage, not CI.
- **Fix:** `git add src/core/bounds.ts tests/core/bounds.spec.ts` in Task 2 — single atomic commit.
- **Files modified:** staged `tests/core/bounds.spec.ts` alongside `src/core/bounds.ts`.
- **Verification:** `npm test` shows 10/10 pass from a fresh checkout of `b619347`; bounds module and its gate ship together.
- **Committed in:** `b619347` (Task 2 commit)

---

**Total deviations:** 2 (1 Rule 1 bug-fix, 1 Rule 2 missing test coverage)
**Impact on plan:** Zero scope creep. Both deviations strengthen the plan's stated invariants — the `sharp` rename makes bounds.ts actually pass the plan's own grep, and bundling the spec preserves the "enforced by tests" guarantee the plan explicitly claims for N2.3. Externally-observable API (`attachmentWorldAABB`, `computeScale` signatures + return shapes) matches the plan exactly.

## Exact spine-core 4.2 API calls used

Extracted directly from `node_modules/@esotericsoftware/spine-core/dist/**/*.d.ts` at install-time (spine-core 4.2.111):

| API | Where | Usage |
|---|---|---|
| `class RegionAttachment extends Attachment` | `bounds.ts:56 instanceof check` | Narrow the 4-vertex Region path. Confirmed in `attachments/RegionAttachment.d.ts:39`. |
| `RegionAttachment.computeWorldVertices(slot, worldVertices, offset, stride)` | `bounds.ts:58` | Writes 4×(x,y) = 8 floats. Confirmed in `RegionAttachment.d.ts:60` (signature matches plan's interface block). |
| `abstract class VertexAttachment extends Attachment` | `bounds.ts:76 instanceof check` | Catch-all for mesh-like attachments. Confirmed in `attachments/Attachment.d.ts:37`. |
| `VertexAttachment.worldVerticesLength: number` | `bounds.ts:77` | Buffer sizing — `= numVertices * 2`. Confirmed in `Attachment.d.ts:51`. |
| `VertexAttachment.computeWorldVertices(slot, start, count, worldVertices, offset, stride)` | `bounds.ts:79` | Writes N×(x,y) floats. Confirmed in `Attachment.d.ts:60`. |
| `class BoundingBoxAttachment extends VertexAttachment` | `bounds.ts:66 skip-list` | Confirmed in `attachments/BoundingBoxAttachment.d.ts`. |
| `class PathAttachment extends VertexAttachment` | `bounds.ts:67 skip-list` | Confirmed in `attachments/PathAttachment.d.ts`. |
| `class PointAttachment extends VertexAttachment` | `bounds.ts:68 skip-list` | **Note:** plan's `<interfaces>` block said `extends Attachment`, but `.d.ts` shows `extends VertexAttachment`. Filter ordering (skip before generic) is robust either way. |
| `class ClippingAttachment extends VertexAttachment` | `bounds.ts:69 skip-list` | Confirmed in `attachments/ClippingAttachment.d.ts`. |
| `type Slot` + `type Attachment` | `bounds.ts:61-62 imports` | `import type` only; no runtime reference. |

No speculative APIs used. Every `instanceof` class and signature resolved against installed `.d.ts` files.

## Known Stubs

None. `bounds.ts` is pure math with no placeholders — every branch (Region, VertexAttachment, skip-list, fallthrough-null) returns a real value derived from spine-core output.

## Issues Encountered

- **Initial test failure (1/10):** the literal word "sharp" in the JSDoc header broke the hygiene grep on first run. Fixed by rewording (see Deviations #1). All other 9 tests passed on first run.
- **Plan's interface block slightly inaccurate about `PointAttachment`.** The block listed `class PointAttachment extends Attachment`, but `@esotericsoftware/spine-core@4.2.111`'s `.d.ts` shows `extends VertexAttachment`. Inconsequential for my code (skip-list already precedes the generic branch) but should be noted so future plans don't inherit the error.
- No other issues. `tsc --noEmit` clean on first compile.

## Threat Mitigation Audit

| Threat ID | Disposition | Mitigation Applied |
|-----------|-------------|-------------------|
| T-00-03-01 (DoS via huge mesh vertex count) | accept | Per-call `Float32Array(worldVerticesLength)` allocation is O(N). Plan's disposition honored — no Phase 0 mitigation. Scratch-buffer reuse deferred to plan 04 if needed. |
| T-00-03-02 (Elevation/Info — pure-math surface) | n/a | `bounds.ts` has zero `node:*` and zero `sharp` imports (hygiene test green). No filesystem / network / subprocess reachability. |
| T-00-03-03 (zero-width source dims → Infinity scale) | mitigate | `computeScale` guards `sourceDims.w > 0` / `sourceDims.h > 0`. Returns `0` for that axis, not `Infinity`. Dedicated test `computeScale > guards zero-width source dims` green. |

## Next Phase Readiness

- **Plan 00-04 (sampler — per-animation loop + snapshot)** is unblocked. `attachmentWorldAABB(slot, attachment)` is the exact hot-loop call the sampler needs; `computeScale(aabb, sourceDims)` is the projection it'll apply to produce `SampleRecord.scale`.
- **Plan 00-05 (peak-recorder)** can reduce `SampleRecord` values using `Math.max` directly — no additional bounds-side work needed.
- **Plan 00-06 (CLI)** will aggregate per-`(skin, attachment)` peak records; bounds/scale computation is done before CLI runs.
- **Plan 00-07 (golden tests — N1.2–N1.6)** will exercise bounds.ts indirectly via end-to-end sampler runs. The cross-check pattern in `bounds.spec.ts` (direct `computeWorldVertices` call vs. `attachmentWorldAABB`) gives 00-07 a template for slot-level assertions.
- **No blockers.** Plan's success criteria and acceptance tests all pass.

## Self-Check: PASSED

Verified 2026-04-22T11:56:33Z:

- `[ -f src/core/bounds.ts ]` ✓ (144 lines)
- `[ -f tests/core/bounds.spec.ts ]` ✓ (200 lines)
- `git log --oneline | grep b619347` ✓
- `npx tsc --noEmit` exit 0 ✓
- `npm test` 10/10 green (Region, Mesh w/ cross-check, Path-skip, computeScale canonical, zero-dim guard, 5 hygiene greps) ✓
- `grep -q "export function attachmentWorldAABB" src/core/bounds.ts` ✓
- `grep -q "export function computeScale" src/core/bounds.ts` ✓
- `grep -q "RegionAttachment" src/core/bounds.ts` ✓
- `grep -q "VertexAttachment" src/core/bounds.ts` ✓
- `grep -q "worldVerticesLength" src/core/bounds.ts` ✓
- `grep -q "BoundingBoxAttachment\|PathAttachment\|PointAttachment\|ClippingAttachment" src/core/bounds.ts` ✓
- `! grep -qE "from ['\"]node:(fs|path|child_process|net|http)['\"]" src/core/bounds.ts` ✓
- `! grep -q "sharp" src/core/bounds.ts` ✓
- `git status --porcelain src/core/bounds.ts tests/core/bounds.spec.ts` empty ✓
- Post-commit deletion check: no unexpected deletions ✓

---
*Phase: 00-core-math-spike*
*Completed: 2026-04-22*

---
phase: 45-dispatcher-user-facing-flip-copy-docs-sweep
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - CHANGELOG.md
  - README.md
  - src/renderer/src/App.tsx
  - src/renderer/src/modals/HelpDialog.tsx
  - tests/runtime/d12-43-fixtures-route-standing-guard.spec.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 45: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 45 is a user-facing copy sweep for Spine 4.3 dual-runtime support plus a
new permanent anti-false-green standing-guard test. The scope contract (zero
runtime/loader/dispatch/error behavior change, `src/core/*` untouched) holds:
the diff touches only `CHANGELOG.md` (new), `README.md` (3 copy lines),
`App.tsx` (1 drop-zone copy line), `HelpDialog.tsx` (1 copy paragraph), and a
new test file. No source logic was altered.

The copy changes were validated against the actual core version contract in
`src/core/loader.ts:237-308` (`resolveRuntimeTag`): supported = 4.2.x and
4.3.x; `<4.2` and `>=4.4` (and `>=5`) hard-rejected with the typed
`SpineVersionUnsupportedError`. README.md:29, HelpDialog.tsx:128-132, and
CHANGELOG.md:17-18 all accurately describe this contract — no copy contradicts
the actual supported-version behavior.

The standing-guard test references four 4.3 fixtures; all four were verified to
exist on disk, `loadSkeleton(path)` is a valid single-arg call (`opts` defaults
to `{}`), and `handleRuntime` / `OpaqueSkeletonData` imports resolve. The
sanctioned boundary cast on line 48 was confirmed to mirror
`src/core/runtime/types.ts:42` doctrine and is not flagged.

Two genuine quality defects were found: a now-contradictory stale release line
in README.md surfaced by this very sweep, and a redundant triple-invocation
pattern in the standing-guard test that triples filesystem I/O and parsing per
fixture while leaving the first invocation's result dead.

## Warnings

### WR-01: README "Latest release" line now contradicts the v1.6 CHANGELOG added in this same phase

**File:** `README.md:5`
**Issue:** This phase adds `CHANGELOG.md` with a top entry
`## v1.6 — Spine 4.3 Runtime Port (Dual-Runtime)` documenting 4.3 support as
shipped. README.md:5 still reads
`Latest release: [v1.3.6](.../releases/latest)`. The copy sweep updated every
"4.2+ / 4.2 or later" string to "4.2 and 4.3" but left the release pointer at
v1.3.6 — three major-feature milestones stale (v1.4/v1.5/v1.6 per project
memory). A reader who follows the 4.3 copy to the "Latest release" link lands
on a build that predates 4.3 support, and the README now internally
contradicts the sibling CHANGELOG it ships alongside. This is a copy/contract
inconsistency the sweep was responsible for reconciling, not a pre-existing
defect that is out of scope — the CHANGELOG addition is what makes it
contradictory.
**Fix:** Update the release pointer to track the milestone the copy now
claims, or make it version-agnostic so it cannot go stale again:
```markdown
Latest release: [see GitHub Releases](https://github.com/Dzazaleo/Spine_Texture_Manager/releases/latest) — see [INSTALL.md](INSTALL.md) for download + first-launch instructions.
```
If a pinned version is required by convention, bump `v1.3.6` to the actual
current shipped tag (verify via `git tag` + STATE.md per project memory before
choosing the literal).

### WR-02: Standing-guard test invokes `loadSkeleton` three times per fixture; first invocation result is dead

**File:** `tests/runtime/d12-43-fixtures-route-standing-guard.spec.ts:33-48`
**Issue:** Each `it` block calls `loadSkeleton(fx)` three independent times:
once inside the try/catch (line 33), once inside `expect(...).not.toThrow()`
(line 40), once inside the `handleRuntime(...)` assertion (line 48). Each call
does a fresh `fs.readFileSync` + JSON parse + full runtime resolution +
skeleton construction (`loader.ts:320-323`). For a permanent every-CI gate
across four fixtures this is 12 full loads where 4 would suffice.

More importantly, the first invocation's behavior is partially dead relative
to the second: the try/catch on line 33 captures any throw into `caught`, but
line 40's `expect(() => loadSkeleton(fx)).not.toThrow()` re-runs the load and
would fail the test on ANY throw anyway — making the
`expect(caught).not.toBeInstanceOf(SpineVersionUnsupportedError)` check on line
38 strictly weaker than and subsumed by line 40 for the no-throw case. The
only scenario where line 38 adds signal over line 40 is "throws something that
is not `SpineVersionUnsupportedError`", but line 40 already fails that case
too. The three calls also are not guaranteed to observe identical state if the
loader ever gains caching or side effects (it currently does not, but a
standing guard meant to outlive re-plans should not bake in that assumption).
**Fix:** Load once, then assert against the single result/error:
```ts
it(`${fx} routes to the 4.3 runtime and never throws SpineVersionUnsupportedError`, () => {
  let result: ReturnType<typeof loadSkeleton> | undefined;
  let caught: unknown;
  try {
    result = loadSkeleton(fx);
  } catch (e) {
    caught = e;
  }
  // The OLD 4.3-reject envelope must NEVER appear for a 4.3 input.
  expect(caught).not.toBeInstanceOf(SpineVersionUnsupportedError);
  // Post-flip a 4.3 fixture must not throw at all.
  expect(caught).toBeUndefined();
  expect(result).toBeDefined();
  // Dispatch-target proof (load-bearing): branded by the 4.3 runtime.
  expect(
    handleRuntime(result!.skeletonData as unknown as OpaqueSkeletonData),
  ).toBe('4.3');
});
```
This preserves every assertion's intent (no `SpineVersionUnsupportedError`, no
throw at all, dispatch-target is `'4.3'`) with a single load per fixture and no
dead first call.

## Info

### IN-01: Drop-zone copy dropped the `.spine` token — verify intentional, not a regression of meaning

**File:** `src/renderer/src/App.tsx:676`
**Issue:** Old copy: `Drop a Spine v4.2 .spine JSON file anywhere in this
window` (the `<code>.spine</code>` token was a literal element). New copy:
`Drop a Spine v4.2 or v4.3 JSON file anywhere in this window`. The
`<code>.spine</code>` token was removed entirely. This is arguably a copy
*improvement* — `.spine` is the Spine editor project file, not the exported
skeleton JSON the app actually consumes (HelpDialog.tsx:159 correctly says
"Drop a .json file"), so the old token was misleading. Flagging only so the
removal is confirmed deliberate and not collateral loss during the
v4.2→v4.2/v4.3 edit. The `font-bold text-danger` styling on both tokens is the
LOCKED D-02 aesthetic and is correctly not flagged.
**Fix:** None required if intentional. The new wording is more accurate than
the old. No action.

### IN-02: README.md:5 still references v1.4 as the planned milestone for rotated-region support

**File:** `README.md:16`
**Issue:** README.md:16 reads "rotated regions are not yet supported (planned
for v1.4) and load with a clear error." Per project memory, v1.4/v1.5/v1.5.1
have shipped and v1.6 (this milestone) is the 4.3 port — the "planned for
v1.4" parenthetical is stale across the same milestone boundary that WR-01
flags. This line was not part of the v4.2→v4.2/v4.3 token sweep so it is
lower-severity (Info, not Warning), but it is the same stale-version copy
class and a reader hitting the rotation error will look for a v1.4 that long
shipped without the feature.
**Fix:** Update or de-version the parenthetical, e.g. "(rotated-region support
is on the roadmap)" — verify the actual roadmap status before re-pinning a
version number.

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

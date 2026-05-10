---
phase: 32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure
reviewed: 2026-05-10T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/core/loader.ts
  - src/core/errors.ts
  - tests/core/loader-version-guard-predicate.spec.ts
  - tests/core/loader-43-schema-guard-predicate.spec.ts
  - tests/core/errors-version.spec.ts
  - tests/core/loader-version-guard.spec.ts
  - fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json
  - fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.atlas
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-05-10
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 32 ships a clean, narrowly-scoped change: two predicates (`checkSpineVersion` strict-cut at 4.3+, new `checkSpine43Schema` for the schema-marker fallback), a branched `SpineVersionUnsupportedError` constructor, and a synthetic 4.3 fixture. The Layer-3 invariant (core/ stays pure TS, no DOM/Electron) is preserved. The Phase 12 F3 pre-4.2 contract is byte-stable — verified by `errors-version.spec.ts:81-89` and `loader-version-guard.spec.ts:42-99` both asserting the legacy wording is preserved unchanged.

The implementation logic is correct. I traced every decision case in both predicates against the test matrix and against representative inputs (`'4.2.43'`, `'4.3.0'`, `'4.3.91-beta'`, `'5.0.0'`, `''`, `null`, `'4'`, `'4.10.0'`, `'4.3-schema'` literal) and found no logic defects. The error-class branching is correct: `'4.3-schema'` sentinel + any semver where `major.minor >= 4.3` (or `major >= 5`) hits the COMPAT-01 branch; everything else hits the pre-4.2 branch.

One **Warning** — a test in `loader-43-schema-guard-predicate.spec.ts` is silently un-asserting (a vacuous-pass anti-pattern). Three **Info** items cover stale doc/code-comment line references and a minor structural inconsistency between the 4.3 fixture's atlas page name and the present PNG file.

No security issues, no data-loss risks, no logic bugs in the production path.

## Warnings

### WR-01: Vacuous-pass test — `try/catch` without preceding `toThrow()` guard

**File:** `tests/core/loader-43-schema-guard-predicate.spec.ts:76-83`
**Issue:** The test "Rejection error carries detectedVersion === '4.3-schema' (sentinel)" wraps the predicate call in `try/catch` and only asserts inside the `catch` block. There is no preceding `expect(...).toThrow()` guard. If `checkSpine43Schema` ever silently fails to throw (regression: e.g. a future refactor accidentally guards `if (constraints.length > 0)` instead of presence-only — a real risk because CONTEXT D-05 explicitly negotiated empty-array semantics), the `catch` block is never entered, neither `expect()` runs, and **the test passes vacuously**.

Compare with the well-formed pattern in `loader-version-guard-predicate.spec.ts:42-50`, which prefixes each `try/catch` with `expect(() => checkSpineVersion(...)).toThrow(SpineVersionUnsupportedError)` so the no-throw case fails fast.

This is the only test of the **sentinel value** (`'4.3-schema'`) — the entire point of CONTEXT D-02's two-predicate split is so the sentinel routes through the COMPAT-01 message branch in the constructor. Losing this assertion would leave the constructor's `detectedVersion === '4.3-schema'` branch untested at the predicate level.

**Fix:** Add the missing throw guard, or use `expect.assertions(N)` to enforce that the `catch` block ran:

```ts
it("Rejection error carries detectedVersion === '4.3-schema' (sentinel)", () => {
  expect(() => checkSpine43Schema({ constraints: [] }, SKEL))
    .toThrow(SpineVersionUnsupportedError);
  try {
    checkSpine43Schema({ constraints: [] }, SKEL);
  } catch (err) {
    expect((err as SpineVersionUnsupportedError).detectedVersion).toBe('4.3-schema');
    expect((err as SpineVersionUnsupportedError).skeletonPath).toBe(SKEL);
  }
});
```

Alternatively (and more idiomatically for vitest):

```ts
it("Rejection error carries detectedVersion === '4.3-schema' (sentinel)", () => {
  expect(() => checkSpine43Schema({ constraints: [] }, SKEL))
    .toThrow(expect.objectContaining({
      detectedVersion: '4.3-schema',
      skeletonPath: SKEL,
    }));
});
```

## Info

### IN-01: Stale line reference in test comment

**File:** `tests/core/loader-version-guard.spec.ts:153`
**Issue:** The comment in the Phase 32 regression test reads `"the 4.2 happy path is asserted at line 82-89 above for the 3.8 describe-block"`. The actual 4.2 happy-path assertion in the 3.8 describe-block lives at **lines 91-98** (`it("REGRESSION: Spine 4.2.x fixture (SIMPLE_PROJECT) still loads successfully", ...)`). The line range drifted — likely a stale paste from an earlier draft.
**Fix:** Update the comment to read `"the 4.2 happy path is asserted at line 91-98 above"`, or drop the line reference entirely since the test name self-identifies.

### IN-02: Atlas page PNG name does not match any present file in the fixture

**File:** `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.atlas:1`
**Issue:** The atlas page header declares the page PNG as `SPINE_4_3_TEST.png` (line 1), but the only PNG present in the fixture is `images/SQUARE.png`. This mismatch is harmless **today** because the version guard at `loader.ts:226-238` fires before atlas resolution at `loader.ts:364-499`, so the atlas page PNG is never read. The 3.8 fixture has the identical inconsistency, so this matches established convention. However:

- The PNG-existence sentinel at `loader-version-guard.spec.ts:202-207` only checks `entries.some((e) => e.endsWith('.png'))`, which is satisfied by the orphan `images/SQUARE.png` and would NOT catch a future regression where the atlas page PNG goes missing.
- If a future phase reorders the loader so atlas resolution runs **before** version checking (e.g. to populate richer error envelopes), this fixture would silently start throwing `AtlasParseError` from the page-PNG load instead of the intended `SpineVersionUnsupportedError`, masking the version-guard regression.

**Fix:** Either (a) co-locate `SPINE_4_3_TEST.png` (a 1×1 stub) at the fixture root so the page name resolves, or (b) update the atlas to reference `images/SQUARE.png` and the region name to `SQUARE` matching the existing PNG. Option (b) is closer to a real Spine export. Both fixtures (3.8 and 4.3) should be fixed together to preserve symmetry.

### IN-03: Defense-in-depth gap — `checkSpine43Schema` runs after `checkSpineVersion`, never independently of it

**File:** `src/core/loader.ts:225-245`
**Issue:** The schema-fallback predicate at `loader.ts:245` only runs **after** `checkSpineVersion` returns without throwing (lines 226-238). For a 4.3 file with a missing/malformed `skeleton.spine` field, this means:

- If `skeleton.spine` is absent → `checkSpineVersion(null, ...)` throws (line 233), and `checkSpine43Schema` is never reached.
- If `skeleton.spine` is malformed (e.g. `"weird-string"`) → `checkSpineVersion('weird-string', ...)` throws (line 131), and `checkSpine43Schema` is never reached.

The only path where `checkSpine43Schema` is reached is when `checkSpineVersion` accepts (i.e., a valid 4.2.x semver). So the schema predicate's stated purpose ("defense-in-depth for 4.3 exports whose `skeleton.spine` field slipped through the semver predicate", per the docblock at `loader.ts:240-244`) is overstated — it cannot catch a 4.3 export whose `spine` field is missing or malformed, because those cases throw earlier with the **wrong** message branch (pre-4.2 wording, not COMPAT-01 wording).

The predicate IS still useful — it catches a hypothetical 4.3 export that mis-stamps `spine: "4.2.x"` while carrying the 4.3 `constraints[]` array (a real risk per SEED-003 §"4.3-beta JSON shape" mid-beta drift). But the docblock's claim about catching "missing field, malformed string, etc." is misleading.

**Fix:** Either (a) tighten the docblock at `loader.ts:240-244` to accurately describe the predicate's coverage envelope (only catches mis-stamped-version-but-4.3-shape files), or (b) restructure the loader so that when `checkSpineVersion` would throw with a `null`/malformed `detectedVersion`, the schema predicate runs first and gets a chance to upgrade the error to the COMPAT-01 message. Option (a) is the lower-risk pick for v1.4; option (b) materially changes error messages for the malformed-input case (Phase 12 F3 contract impact — would need its own discussion).

---

_Reviewed: 2026-05-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

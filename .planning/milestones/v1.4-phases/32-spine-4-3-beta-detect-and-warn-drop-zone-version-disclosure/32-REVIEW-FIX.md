---
phase: 32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure
fixed_at: 2026-05-10T17:42:00Z
review_path: .planning/phases/32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure/32-REVIEW.md
iteration: 2
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 32: Code Review Fix Report

**Fixed at:** 2026-05-10
**Source review:** `.planning/phases/32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure/32-REVIEW.md`
**Iteration:** 2 (cumulative)

**Summary:**
- Findings in scope (critical + warning + info): 4
- Fixed: 4
- Skipped: 0

This is the cumulative report across both iterations of `/gsd-code-review-fix`
on Phase 32's REVIEW.md.

- **Iteration 1** (2026-05-10, scope `critical_warning`) closed the single
  Warning finding (WR-01) — vacuous-pass test in
  `loader-43-schema-guard-predicate.spec.ts`.
- **Iteration 2** (2026-05-10, scope `all`) closes the three Info findings
  (IN-01, IN-02, IN-03) — comment line-range typo, atlas page PNG sentinel
  mismatch in both 3.8 and 4.3 fixtures, and an overstated docblock at
  `loader.ts:240-244`.

Phase 32 was already marked complete in ROADMAP.md before iteration 2; these
are post-completion polish fixes. All four findings are now closed.

## Fixed Issues

### WR-01: Vacuous-pass test — `try/catch` without preceding `toThrow()` guard

**Files modified:** `tests/core/loader-43-schema-guard-predicate.spec.ts`
**Commit:** `0c1cdf6`
**Iteration:** 1
**Applied fix:** Added `expect(() => checkSpine43Schema({ constraints: [] }, SKEL)).toThrow(SpineVersionUnsupportedError);` as the first assertion inside the "Rejection error carries detectedVersion === '4.3-schema' (sentinel)" test, immediately before the existing `try/catch` block. Matches the well-formed pattern in `tests/core/loader-version-guard-predicate.spec.ts:42-50` and ensures the test fails fast if the predicate ever silently stops throwing — closes the vacuous-pass hole that would have left the `'4.3-schema'` sentinel routing key untested at the predicate level. The two `expect()` calls inside the existing `catch` block were preserved unchanged.

### IN-01: Stale line reference in test comment

**Files modified:** `tests/core/loader-version-guard.spec.ts`
**Commit:** `e2a13a9`
**Iteration:** 2
**Applied fix:** Changed the comment at `tests/core/loader-version-guard.spec.ts:153` from `"the 4.2 happy path is asserted at line 82-89 above for the 3.8 describe-block"` to `"the 4.2 happy path is asserted at line 91-98 above for the 3.8 describe-block"`. The actual REGRESSION test in the 3.8 describe-block lives at lines 91-98 (`it("REGRESSION: Spine 4.2.x fixture (SIMPLE_PROJECT) still loads successfully", ...)`); the previous "82-89" range matched the unrelated `it("Rejection error carries the skeletonPath argument the caller passed", ...)` test. Comment-only change; one-line edit.

### IN-02: Atlas page PNG name does not match any present file in the fixture

**Files modified:** `fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.png` (new), `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.png` (new)
**Commit:** `cc4dabb`
**Iteration:** 2
**Applied fix:** Added a real 1×1 RGBA PNG stub (77 bytes, valid PNG with IHDR/IDAT/IEND chunks; verified via `file` and decodes as `1 x 1, 8-bit/color RGBA, non-interlaced`) at the root of each fixture directory. Both `SPINE_3_8_TEST.atlas` and `SPINE_4_3_TEST.atlas` declare `SPINE_X_X_TEST.png` as their atlas page on line 1; both fixtures had only `images/SQUARE.png` on disk, leaving the page name dangling.

Picked option (a) from REVIEW IN-02 ("co-locate `SPINE_4_3_TEST.png` (a 1×1 stub) at the fixture root") over option (b) ("update the atlas to reference `images/SQUARE.png`"). Rationale:

- Real Spine exports keep the atlas page PNG flat at the same directory as the `.atlas` file (verified against the existing `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.png` co-located with `SIMPLE_TEST.atlas`). Option (b) would have introduced a non-canonical `images/SQUARE.png` page reference.
- Option (a) closes the latent regression hazard called out in REVIEW IN-02 (paragraph 1): if a future phase reorders the loader so atlas resolution runs before version checking, the dangling page name would have masked the intended `SpineVersionUnsupportedError` with an `AtlasParseError`.
- Both fixtures (3.8 and 4.3) share identical structure post-fix, preserving the symmetry called out in REVIEW IN-02.
- The orphan `images/SQUARE.png` is preserved unchanged in each fixture — the recursive `endsWith('.png')` sentinel at `loader-version-guard.spec.ts:171-181` (3.8) and `:202-207` (4.3) still passes, just now also satisfied by the new root-level page PNG.
- No grep hits for the literal filenames `SPINE_3_8_TEST.png` / `SPINE_4_3_TEST.png` anywhere in `tests/`, `src/`, or `scripts/` — adding the file does not collide with any path-shape sentinel.
- No `.gitignore` rule excludes the new files; both committed cleanly.

### IN-03: Defense-in-depth gap — `checkSpine43Schema` runs after `checkSpineVersion`, never independently of it

**Files modified:** `src/core/loader.ts`
**Commit:** `3e4cd8b`
**Iteration:** 2
**Applied fix:** Rewrote the docblock at `src/core/loader.ts:240-244` (now `:240-250`) to accurately describe the predicate's reachable coverage envelope. The previous wording — "Defense-in-depth for 4.3 exports whose `skeleton.spine` field slipped through the semver predicate above (missing field, malformed string, etc.)" — was misleading because every case in that parenthetical is already caught by `checkSpineVersion` at lines 125 (`null`/empty), 131 (malformed), 135 (< 4.2), and 140 (>= 4.3) — `checkSpine43Schema` is reached only when `checkSpineVersion` accepts (i.e., a valid 4.2.x semver).

The new docblock states explicitly:
- The predicate is reachable ONLY when `skeleton.spine` parses as a valid 4.2.x semver.
- `null`, malformed, and 4.3+ semvers all throw at lines 230/233/237 (the three `checkSpineVersion` call sites) and never reach this fallback.
- The realistic coverage envelope is therefore one specific scenario: a 4.3 export that mis-stamps its `skeleton.spine` field as `"4.2.x"` while still carrying the breaking 4.3 schema marker (top-level `constraints` array, per SEED-003 "4.3-beta JSON shape" mid-beta drift).

Picked option (a) from REVIEW IN-03 (tighten docblock) over option (b) (restructure loader so the schema predicate runs first when version is null/malformed). Option (b) would have changed Phase 12 F3's pre-4.2 error-message wording for malformed-input cases and per REVIEW.md "would need its own discussion." Comment-only change; logic untouched.

## Verification

**Tier 1 (re-read each modified file):** All 4 fixes confirmed in-place and surrounding code intact.

**Tier 2 (per-file syntax / format):**
- `tests/core/loader-version-guard.spec.ts` — TypeScript syntax-clean (no new errors under `tsc --noEmit -p tsconfig.json`).
- `src/core/loader.ts` — TypeScript syntax-clean (no new errors under `tsc --noEmit -p tsconfig.json`).
- `fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.png` — `file` reports `PNG image data, 1 x 1, 8-bit/color RGBA, non-interlaced` (valid PNG).
- `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.png` — same.

**Tier 2 (focused test runs):**
- `npx vitest run tests/core/loader-43-schema-guard-predicate.spec.ts tests/core/loader-version-guard-predicate.spec.ts tests/core/loader-version-guard.spec.ts tests/core/errors-version.spec.ts` — 4 test files passed (4), 54 tests passed (54).

**Full-suite regression check:**
- `npm test` (vitest run, full suite) on main worktree post-merge — 91 test files passed (91), 999 tests passed, 3 skipped, 2 todo, 0 failures. Duration 6.29s. Identical to the iteration-1 post-fix baseline (which was also 91/91 / 999 passed). The IN-02 PNG additions did NOT trigger any new test paths to load the page PNGs (the version guard at `loader.ts:226-238` still fires before atlas resolution at `loader.ts:364-499`), as designed.

## Skipped Issues

None — all four findings (1 warning + 3 info) were fixed cleanly across the two iterations.

## Out-of-Scope Findings

None — `fix_scope: all` in iteration 2 covered every finding in REVIEW.md.

---

_Fixed: 2026-05-10 (iter 1) + 2026-05-10 (iter 2)_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2 (cumulative)_

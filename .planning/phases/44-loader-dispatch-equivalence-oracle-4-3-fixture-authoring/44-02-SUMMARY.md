---
phase: 44-loader-dispatch-equivalence-oracle-4-3-fixture-authoring
plan: 02
subsystem: testing
tags: [loader, dispatch, runtime-routing, spine-4.3, dual-runtime, typed-error, safe01]

# Dependency graph
requires:
  - phase: 44-01
    provides: "buildLoadXtra01/02 cross-runtime drivers + the 13 fixture files (ORCL-02 4.2 leg skeleton2_42.* + SLIDER/XTRA01/XTRA02 4.3 rigs) + CURRENT_PHASE 42->44 + the 4-dir D-04 SAFE-01 denylist (Rule-3, applied one plan early)"
  - phase: 43
    provides: "pickRuntime 3-env split (vitest/built-CJS/CLI-tsx) + the RuntimeTag '4.2'|'4.3' opaque-handle contract + loader spine-core-import-free seam (RT-02)"
provides:
  - "resolveRuntimeTag(): the loader's pure exported version dispatcher (token-primary D-06/07 + asymmetric positive-shape contradiction D-08 + split-out >=4.4 reject arm D-09)"
  - "loader.ts:250 hard-pick flipped from pickRuntime('4.2') to pickRuntime(resolveRuntimeTag(...)) — the single behavior flip turning the loader into a dual-runtime dispatcher (DISP-01/03)"
  - "SpineVersionUnsupportedError 2-branch -> 3-branch (ge44 LOCKED / contradiction discretion / unsupported LOCKED-verbatim); old 're-export as 4.2 (supported downgrade)' string removed (DISP-02, D-10)"
  - "D-04 SAFE-01 path-prefix denylist extended to the full 6-dir scope (the 4 D-04-named + the 2 co-required beta canaries SPINE_4_3_TEST/ + test_4.3/)"
affects: [44-03, 45, 46, 47]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composed-not-rewritten dispatch resolver: resolveRuntimeTag re-derives the band+sniff from checkSpineVersion/checkSpine43Schema decision trees IN PLACE (the standalone predicates keep their existing unit-test contract; a rewrite would discard 4 unit-test files)"
    - "Asymmetric positive-shape contradiction cross-check (D-08): never absence-based; absence of constraints[] is NOT 4.2 evidence"
    - "Discriminated-union error EXTEND (not new class): .name + readonly fields byte-identical so the IPC KNOWN_KINDS routing is preserved"

key-files:
  created: []
  modified:
    - "src/core/loader.ts — added resolveRuntimeTag(); flipped the :250 hard-pick; updated the file-header + integration-site comment blocks"
    - "src/core/errors.ts — SpineVersionUnsupportedError 2->3 branch (D-10); old WRONG-for-4.3 string removed"
    - "tests/core/loader-version-guard-predicate.spec.ts — added the resolveRuntimeTag positive-routing + preserved-throw + D-08 contradiction cases"
    - "tests/core/loader-43-schema-guard-predicate.spec.ts — added the repurposed-constraints[]-sniff-as-D-08-signal cases"
    - "tests/core/errors-version.spec.ts — D-11 (this plan's scoped subset): flipped the 4.3 arms reject->contradiction, added LOCKED >=4.4 cases, preserved <4.2 throws explicit"
    - "tests/safe01/discover-fixtures.ts — extended SAFE01_EXCLUDED_PREFIXES 4->6 dirs (co-required by the flip)"

key-decisions:
  - "resolveRuntimeTag uses an explicit /^(\\d+)\\.(\\d+)/ leading-major.minor match (D-07 clarity-only equivalent of the already-suffix-tolerant parseInt — NOT a correctness change)"
  - "The NEW >=4.4 reject arm is SPLIT OUT of checkSpineVersion's old bundled >=4.3 throw (Pitfall 2) — not folded/deleted; a hypothetical 4.4 export hits the typed rejecter, never the 4.3 runtime"
  - "D-08 contradiction reuses the '4.3-schema' sentinel for token=4.2+constraints[] so errors.ts gives it the new contradiction wording; token=4.3+legacy-arrays throws with the version string"
  - "The 2 loader-version-guard.spec.ts failures are EXPECTED D-11 Plan-03-owned fallout (the plan explicitly scopes full D-11 reconciliation to Plan 03) — NOT modified here, keeping the wave boundary clean"

patterns-established:
  - "Pattern 1: A loader version dispatcher that NEVER falls through to a default runtime — every path returns a validated tag or throws a typed error (T-44-03/04/05 mitigation)"
  - "Pattern 2: The D-04 SAFE-01 denylist scope is 'EVERY 4.3-routing dir not in the frozen _manifest.json' — not only the explicitly-named ones; the dispatch flip mechanically unmasks the formerly reject-excluded beta canaries"

requirements-completed: [DISP-01, DISP-02, DISP-03]

# Metrics
duration: 11m
completed: 2026-05-18
---

# Phase 44 Plan 02: Loader Dispatch Flip + 3-Branch Typed Error + Co-Required SAFE-01 Denylist Summary

**The single behavior flip turning the loader from a 4.3-rejecter into a dual-runtime dispatcher: `resolveRuntimeTag` (token-primary D-06/07 + asymmetric positive-shape contradiction D-08 + split-out >=4.4 arm D-09) replaces `pickRuntime('4.2')`, with the 2->3 branch `SpineVersionUnsupportedError` (D-10) and the full 6-dir D-04 SAFE-01 denylist that the flip co-requires.**

## Performance

- **Duration:** ~11 min (active execution; excludes the worktree-recovery diversion)
- **Started:** 2026-05-18T10:53:16Z
- **Completed:** 2026-05-18T~12:05Z
- **Tasks:** 3 (Tasks 1 & 2 TDD)
- **Files modified:** 6

## Accomplishments

- **DISP-01/03:** Added the pure exported `resolveRuntimeTag()` to `loader.ts` and flipped the `:250` hard-pick to `pickRuntime(resolveRuntimeTag(...))`. The loader now ROUTES a 4.2 JSON -> runtime-42 and a 4.3 JSON -> runtime-43, decided BEFORE atlas-resolve + `rt.parseSkeleton` (DISP-03 is structurally free at the existing seam). The loader stays spine-core-import-free (RT-02 preserved); `runtime.ts` is byte-untouched (only the tag arg flips).
- **DISP-02 / D-10:** `SpineVersionUnsupportedError` went 2-branch -> 3-branch: the LOCKED >=4.4 wording (verbatim), a discretion contradiction wording for the `'4.3-schema'` sentinel, and the PRESERVED-VERBATIM <4.2 wording. The old "re-export as 4.2 (supported downgrade)" string is fully removed (wrong for 4.3, unreachable). `.name` + `detectedVersion`/`skeletonPath` are byte-identical (IPC routes by `.name`).
- **D-04 (co-required):** Extended the `SAFE01_EXCLUDED_PREFIXES` denylist from the 4 D-04-named dirs (landed early by 44-01's Rule-3 deviation) to the full 6-dir scope, adding the two beta canaries (`SPINE_4_3_TEST/` git-tracked 4.3.91-beta, `test_4.3/` gitignored 4.3.88-beta) that the dispatch flip mechanically unmasks from the implicit reject-as-exclusion. `safe01-enumeration` + `safe01-baseline` stay GREEN AFTER the flip (the Pitfall-1 canary).
- **Wave-0 predicate specs:** Both `loader-version-guard-predicate.spec.ts` and `loader-43-schema-guard-predicate.spec.ts` carry the new positive-routing + preserved-throw + D-08 contradiction cases (90/90 green across the full plan verification set).

## Task Commits

Each task was committed atomically (TDD tasks: test RED -> feat GREEN):

1. **Task 1 RED: resolveRuntimeTag predicate cases** - `c57b6a8` (test)
2. **Task 1 GREEN: flip loader to resolveRuntimeTag dispatch** - `727a86b` (feat)
3. **Task 2 RED: D-10 3-branch error cases** - `cae41fd` (test)
4. **Task 2 GREEN: SpineVersionUnsupportedError 2->3 branch** - `27742e3` (feat)
5. **Task 3: extend D-04 SAFE-01 denylist to full 6-dir scope** - `c2d305e` (test)

_Note: Tasks 1 & 2 are TDD (test -> feat). Task 3 is a test-config change (not TDD). Plan metadata commit follows this SUMMARY._

## Files Created/Modified

- `src/core/loader.ts` - Added the exported `resolveRuntimeTag(version, parsedJson, skeletonPath): RuntimeTag` directly after `checkSpine43Schema`; flipped `pickRuntime('4.2')` -> `pickRuntime(resolveRuntimeTag(...))` (re-deriving the narrowed `skeleton.spine` value into `spineFieldForDispatch` since the original `spineField` is block-scoped at the F3 guard); updated the file-header docstring + the integration-site comment block to reflect the flip.
- `src/core/errors.ts` - `SpineVersionUnsupportedError` constructor rewritten from the boolean `isSpine43OrLater` 2-way pick to a 3-way `kind: 'ge44' | 'contradiction' | 'unsupported'` classification; class docstring updated; `super()` + `this.name` byte-identical.
- `tests/core/loader-version-guard-predicate.spec.ts` - New `describe('resolveRuntimeTag ...')` block: positive routing, preserved version-band rejects, D-08 asymmetric positive-shape contradiction.
- `tests/core/loader-43-schema-guard-predicate.spec.ts` - New `describe('resolveRuntimeTag — D-08 asymmetric constraints[] contradiction signal')` block.
- `tests/core/errors-version.spec.ts` - Replaced the 3 old-wording 4.3 cases with D-10 cases (LOCKED >=4.4, contradiction, defensive 4.3.91-beta) + preserved the explicit <4.2/unknown throw assertions (D-11 false-green guard).
- `tests/safe01/discover-fixtures.ts` - `SAFE01_EXCLUDED_PREFIXES` extended 4->6 dirs; docstring updated to explain the post-flip co-requirement + the deliberate SPINE_3_8_TEST exclusion rationale.

## Decisions Made

- **resolveRuntimeTag is COMPOSED, not a rewrite:** The standalone `checkSpineVersion`/`checkSpine43Schema` bodies are byte-untouched (their existing predicate unit-test contract stays valid). `resolveRuntimeTag` re-derives the band + the top-level-`constraints[]` sniff independently. This honors the RESEARCH Anti-Pattern (a rewrite discards 4 unit-test files of coverage).
- **The `>=4.4` arm is split out, not folded (Pitfall 2):** `if ((major === 4 && minor >= 4) || major >= 5) throw` is a distinct branch; 4.3 is NOT left to fall through unguarded.
- **D-08 is positive-shape only (Pitfall 3):** `tag==='4.3' && !constraints[] && !legacy -> route '4.3'` (a constraint-less 4.3 rig is valid; absence of `constraints[]` is NOT 4.2 evidence).
- **The 2 `loader-version-guard.spec.ts` failures are intentionally NOT fixed here:** the plan's `<verification>` D-11 NOTE explicitly scopes the full D-11 test-suite reconciliation (the other 8 files) to Plan 03. Modifying that file here would breach the wave boundary the plan deliberately keeps clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Initial commits landed on the wrong git tree; recovered onto the worktree branch**
- **Found during:** Task 2 (the pre-commit HEAD safety assertion correctly refused a commit on a non-`worktree-agent-*` branch)
- **Issue:** The environment's `cd /Users/leo/.../Spine_Texture_Manager` resolves to the MAIN repo (on `milestone/v1.6-spine-4.3-dual-runtime`), not the worktree at `.claude/worktrees/agent-acbe72667df73bd16`. Task 1's RED+GREEN commits + the Task-2 RED working change initially landed in the main repo on the milestone branch (which is NOT in the protected deny-list, so the step-0 guard did not trip on it — it tripped on the positive `worktree-agent-*` allow-list at Task 2's commit).
- **Fix:** `git format-patch`'d the 2 commits + captured the uncommitted Task-2 RED diff; `git reset --hard ed5695c` + targeted `git checkout -- <file>` restored the MAIN repo's milestone branch to its exact original state (the 2 pre-existing untracked files left untouched — no `git clean`); `git am`'d the 2 patches + `git apply`'d the RED diff onto the worktree branch `worktree-agent-acbe72667df73bd16`. All subsequent work was performed exclusively from the worktree path with absolute paths.
- **Files modified:** none beyond the planned ones (this was a git-location correction, not a code change)
- **Verification:** Re-ran Task 1's full verification (65/65) + all AC greps in the worktree post-recovery; confirmed the main repo is back at `ed5695c` with only the 2 pre-existing `??` files; confirmed the 5 plan commits are on the worktree branch.
- **Committed in:** the recovery preserved the original commit messages/content (worktree hashes `c57b6a8`/`727a86b`/`cae41fd`/`27742e3`/`c2d305e`)

**2. [Rule 3 - Blocking] Accidental working-tree revert to base during failure triage; restored from HEAD**
- **Found during:** post-Task-3 full-suite triage
- **Issue:** A diagnostic `git checkout ed5695c -- .` (intended as a scoped probe) staged base content over the working tree. HEAD (`c2d305e`) and all commits were unaffected, but the working files showed base content.
- **Fix:** `git checkout HEAD -- <the 6 plan files>` restored the working tree to the committed state; verified clean vs HEAD (empty `git status`).
- **Files modified:** none (working-tree restore only; commits intact)
- **Verification:** `git status` empty; `git diff HEAD --stat` empty; `errors.ts` confirmed back to the 3-branch version; the base-probe was redone non-destructively via `git show ed5695c:<file> > /tmp/...` instead.
- **Committed in:** n/a (no content change — the committed state was never altered)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - Blocking; both git-mechanics recoveries, zero code/scope impact)
**Impact on plan:** No scope creep. Both deviations were git-location/working-tree corrections; the plan's code + tests were executed exactly as written. The final committed state on the worktree branch is the intended one (verified clean vs HEAD, 5 atomic commits, 90/90 plan-verification green).

## Issues Encountered

- **Worktree vs main-repo path ambiguity:** the `cd <repo-root>` path resolves to the main repo, not the worktree. Resolved by always using the absolute worktree path `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/.claude/worktrees/agent-acbe72667df73bd16` for every subsequent command (see Deviation 1).
- **Full-suite noise categorization:** 12 failed test FILES / 4 actual test failures. Categorized: 9x `tests/renderer/*.spec.tsx` = pre-existing MixBlend ESM IMPORT noise (memory `project_renderer_mixblend_preexisting_failure`, Phase-47-owned); 2x `tests/core/loader-version-guard.spec.ts` = EXPECTED D-11 Plan-03-owned fallout (asserts the now-deleted old wording; plan explicitly defers); 1x `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` + 1x `tests/main/sampler-worker-girl.spec.ts` = PRE-EXISTING (gitignored heavy-rig fixtures absent in the worktree checkout — **proven identical when run against the base `ed5695c` loader/errors**, so NOT a regression of this plan). Zero regressions attributable to this plan.

## Deferred Issues

None. All targeted gates green (90/90 plan-verification set: loader-version-guard-predicate + loader-43-schema-guard-predicate + errors-version + loader.spec + safe01-enumeration + safe01-baseline). The D-11 reconciliation of the other 8 files is Plan-03-owned by plan design (not a deferral of this plan's scope).

## Threat Model Adherence

- **T-44-03 (mitigate):** `resolveRuntimeTag` uses the bounded `/^(\d+)\.(\d+)/` parse; no parseable leading major.minor -> typed `SpineVersionUnsupportedError`. NEVER falls through to a default runtime. PASS.
- **T-44-04 (mitigate):** Routing decided before runtime load (DISP-03, structurally free at the seam); D-08 asymmetric contradiction reject (`token=4.2+constraints[]` -> throw `'4.3-schema'`; `token=4.3+legacy` -> throw). PASS.
- **T-44-05 (mitigate):** D-09 `>=4.4` arm split out -> typed reject with the LOCKED D-10 wording; a 4.4 export hits the rejecter, never the 4.3 runtime. PASS.
- **T-44-06 (accept):** D-10 makes the `>=4.4` + `<4.2` wordings correct-by-construction now; `.name`/field shape byte-identical (no new IPC/network/fs boundary). As designed.

No new network, IPC-surface, or filesystem-trust boundary introduced. No `threat_flag` surface beyond the plan's threat register.

## Self-Check: PASSED

- `src/core/loader.ts` modified, `resolveRuntimeTag` exported (grep: 1), flip landed (grep `pickRuntime(resolveRuntimeTag(`: 1), no `pickRuntime('4.2')` (grep: 0), spine-core-import-free (grep: 0), `>=4.4` arm split (grep `minor >= 4`: 3) — VERIFIED
- `src/core/errors.ts` 3-branch (`kind === 'ge44'`/`'contradiction'`: 2), LOCKED >=4.4 wording (1), old string removed (0), `.name` byte-identical (1) — VERIFIED
- `tests/safe01/discover-fixtures.ts` 6-dir denylist (array entries: SPINE_4_3_TEST/ 1, test_4.3/ 1, SPINE_3_8_TEST/ 0, startsWith(p) 1) — VERIFIED
- Commits exist on the worktree branch: `c57b6a8`, `727a86b`, `cae41fd`, `27742e3`, `c2d305e` — VERIFIED (`git log ed5695c..HEAD`)
- `runtime.ts` NOT in the plan's changed-file set — VERIFIED
- `tsc --noEmit` clean for both `loader.ts` and `errors.ts` — VERIFIED

## Next Phase Readiness

- The dual-runtime dispatch is live: 4.2 -> runtime-42, 4.3 -> runtime-43. **Plan 03 (D-11 full reconciliation + the 3-entrypoint multi-runtime verification) is now unblocked and is the immediate next step** — it must flip the remaining 8 D-11 files' 4.3-reject assertions AND verify the `'4.3'` `require('../runtime-43.cjs')` arm across all 3 entrypoints (`npm test` / built `out/main` worker / `npm run cli`), since this flip exercises the 4.3 production require for the first time (memory `feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam`).
- No blockers. `STATE.md`/`ROADMAP.md` intentionally NOT modified (orchestrator-owned per the worktree contract).

---
*Phase: 44-loader-dispatch-equivalence-oracle-4-3-fixture-authoring*
*Plan: 02*
*Completed: 2026-05-18*

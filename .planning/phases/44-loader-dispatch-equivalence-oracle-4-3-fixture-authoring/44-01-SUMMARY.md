---
phase: 44-loader-dispatch-equivalence-oracle-4-3-fixture-authoring
plan: 01
subsystem: testing
tags: [vitest, spine-4.3, fixtures, dual-runtime, cross-runtime-oracle, safe01]

# Dependency graph
requires:
  - phase: 43-runtime-adapter-facade-verified-4-3-api-mapping
    provides: "SpineRuntime facade + pickRuntime('4.3') + baseline-driver.ts (buildLoad43/buildLoadSibling42/buildSourceDims/sample) + load43.ts loud-or-skip contract"
  - phase: 42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding
    provides: "tests/safe01/phase-gate.ts CURRENT_PHASE constant + phase44-fixture-guard.spec.ts (D-13) + discover-fixtures.ts SAFE-01 enumeration + 42-OWNER-EXPORT-SPEC.md"
provides:
  - "buildLoadXtra01() + buildLoadXtra02() cross-runtime sampler drivers in baseline-driver.ts (faithful buildLoad43 clones, directory-scan filename resolution)"
  - "ORCL-02 4.2 leg committed: fixtures/SIMPLE_PROJECT_43/skeleton2_42.{json,atlas,png} (git-tracked, byte-untouched)"
  - "3 owner-exported 4.3 rigs committed: fixtures/SLIDER_4_3/, fixtures/XTRA01_4_3/, fixtures/XTRA02_4_3/ (+ XTRA02 NOTES.md audit record)"
  - "CURRENT_PHASE = 44 (phase44-fixture-guard armed and passing, not skipped)"
  - "Locked D-04 SAFE-01 path-prefix denylist in discover-fixtures.ts (excludes the 4 v1.6 4.3 fixture dirs from the frozen enumeration + SAFE-02 gate)"
affects: [44-02 (dispatch flip — consumes the D-04 denylist + the committed fixtures), 44-03 (ORCL-02 equivalence — consumes buildLoadSibling42 + buildLoad43), 44-04 (XTRA baselines/structural — consume buildLoadXtra01/02), 46 (SLIDER closed-form oracle — consumes SLIDER_4_3/)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Directory-scan owner-rig filename resolution (readdirSync single .json + single .atlas; dir name locked, filenames Claude's-discretion; malformed rig throws loud, absent dir → null)"
    - "Locked D-04 SAFE-01 path-prefix denylist (postdates-pre-v1.6-freeze fixtures excluded from frozen enumeration + byte-equal gate)"

key-files:
  created:
    - .planning/phases/44-loader-dispatch-equivalence-oracle-4-3-fixture-authoring/44-01-SUMMARY.md
  modified:
    - tests/runtime43/baseline-driver.ts
    - tests/safe01/phase-gate.ts
    - tests/safe01/discover-fixtures.ts

key-decisions:
  - "buildLoadXtra resolves the rig .json/.atlas by readdirSync directory scan (owner filenames are Claude's-discretion per D-01/CONTEXT; only dir names are locked) — a dir present but missing/multiple .json|.atlas throws loud (NOT a Wave-0 skip), an absent dir returns null"
  - "XTRA02_4_3/NOTES.md committed alongside the rig — it is the owner-authored auditable D-15-style fixture-prep record (documents the two scaleY keys hand-added to the JSON); belongs with the fixture for auditability"
  - "Locked D-04 SAFE-01 denylist applied in THIS plan (Rule 3) — committing skeleton2_42.json in Task 2 made it git-tracked and it routes/samples through 4.2 today (no dispatch flip needed), leaking into the frozen SAFE-01 enumeration; the denylist is locked + co-required and PATTERNS.md gave the exact edit"

patterns-established:
  - "Owner-rig filename resolution by directory scan — never hardcode an assumed export filename when only the dir name is contractually locked"
  - "D-04 SAFE-01 exclusion via SAFE01_EXCLUDED_PREFIXES path-prefix denylist in discover-fixtures.ts (the PATTERNS-recommended mechanism; exclusion itself locked)"

requirements-completed: [ORCL-01]

# Metrics
duration: 7min
completed: 2026-05-18
---

# Phase 44 Plan 01: Loader Dispatch + Equivalence Oracle + 4.3 Fixture Authoring (Wave 1 — Fixture/Driver Foundation) Summary

**Committed the ORCL-01 in-repo 4.3 deliverable (4.2-sibling + 3 owner-exported 4.3 rigs, byte-untouched), added buildLoadXtra01/02 directory-scanning cross-runtime sampler drivers, armed the Phase-44 fixture guard, and applied the locked D-04 SAFE-01 denylist that the fixture commit co-required.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-18T10:39:26Z
- **Completed:** 2026-05-18T10:46:53Z
- **Tasks:** 3
- **Files modified:** 3 source/test files + 13 fixture artifacts committed

## Accomplishments

- **ORCL-01 in-repo deliverable committed** (`1ff8107`, 13 files): the ORCL-02 4.2 leg `fixtures/SIMPLE_PROJECT_43/skeleton2_42.{json,atlas,png}` + the 3 owner-exported 4.3 rigs `SLIDER_4_3/`, `XTRA01_4_3/`, `XTRA02_4_3/` (+ the XTRA02 `NOTES.md` audit record). `skeleton2_42.atlas` committed **byte-untouched** (D-15 PASS — sha256 proven identical pre/post commit, no normalization); `skeleton2_42.json` retains `spine:"4.2-from-4.3.01"` with NO top-level `constraints[]` (D-07/D-08 routing precondition intact).
- **buildLoadXtra01() + buildLoadXtra02()** added to `tests/runtime43/baseline-driver.ts` (`4bddc11`): faithful `buildLoad43` clones reusing `buildSourceDims`/`pickRuntime`/`rt.makeAtlas`/`rt.parseSkeleton`/`rt.applyRotatedRegionFix` verbatim, with the owner-rig filenames resolved by directory scan and the `load43.ts` loud-or-skip presence-guard contract preserved (broken `pickRuntime('4.3')` PROPAGATES; absent dir → null; malformed rig throws loud). Original drivers byte-untouched.
- **CURRENT_PHASE 42 → 44** (`81b9b20`): `phase44-fixture-guard.spec.ts` is now ARMED and **PASSES (not skipped)** — it asserts the guarded fixture dirs exist, which Task 2 committed.
- **SAFE-01 gates stay green** post fixture commit + phase bump: `safe01-enumeration` + `safe01-baseline` + `phase44-fixture-guard` all pass (the locked D-04 denylist resolved the enumeration drift the fixture commit introduced).
- Full suite: **1244 passed, 0 actual test failures** (the 11 `tests/renderer/*` MixBlend IMPORT-failed suites are pre-existing, Phase-47-owned, NOT a regression — per the plan `<verification>` note + memory `project_renderer_mixblend_preexisting_failure`).

## Task Commits

1. **Task 1: Add buildLoadXtra01() + buildLoadXtra02() to baseline-driver.ts** — `4bddc11` (test)
2. **Task 2: Stage + commit the fixture artifacts (D-05, plain-English git narration)** — `1ff8107` (test)
3. **Task 3: Bump CURRENT_PHASE 42 → 44 + apply locked D-04 SAFE-01 denylist** — `81b9b20` (test)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP/REQUIREMENTS) — final docs commit.

## Files Created/Modified

- `tests/runtime43/baseline-driver.ts` — added `readdirSync` import, `isFileAbsent`/`resolveRigFiles`/`buildLoadXtra` helpers, and exported `buildLoadXtra01`/`buildLoadXtra02` (faithful buildLoad43 clones via directory-scan filename resolution; original drivers untouched).
- `tests/safe01/phase-gate.ts` — `CURRENT_PHASE` `42 as const` → `44 as const` (1-line const bump; arms the Phase-44 fixture guard).
- `tests/safe01/discover-fixtures.ts` — added the locked D-04 `SAFE01_EXCLUDED_PREFIXES` path-prefix denylist + `.filter()` in `discover()` (excludes the 4 v1.6 4.3 fixture dirs from the SAFE-01 frozen enumeration + SAFE-02 gate).
- **Committed fixtures (13 files, `1ff8107`):** `fixtures/SIMPLE_PROJECT_43/skeleton2_42.{json,atlas,png}`; `fixtures/SLIDER_4_3/SLIDER-01.{json,atlas,png}`; `fixtures/XTRA01_4_3/XTRA-01.{json,atlas,png}`; `fixtures/XTRA02_4_3/XTRA-02.{json,atlas,png}` + `fixtures/XTRA02_4_3/NOTES.md`.

## Decisions Made

- **Owner-rig filenames resolved by directory scan.** Per D-01 / CONTEXT Claude's-Discretion, only the directory names are locked; the owner exported `SLIDER-01.*`, `XTRA-01.*`, `XTRA-02.*`. `resolveRigFiles()` picks the single `.json` + single `.atlas` via `readdirSync` rather than hardcoding an assumed filename. A directory present but with zero/multiple `.json` or `.atlas` is treated as a **malformed rig and throws loud** (the loud-over-silent posture — a half-exported rig must never green-wash as "fixture absent"); only a genuinely absent/empty directory returns `null` (legit Wave-0 ENOENT skip, mirroring the `load43.ts:34-72` contract).
- **`XTRA02_4_3/NOTES.md` committed with the rig.** It is the owner-authored, auditable D-15-style fixture-prep record (documents the two `scaleY` keys hand-added to `XTRA-02.json` because this editor build does not serialize the IK scale-Y mode; the `.atlas`/`.png` are byte-untouched). It is the auditability artifact the D-15 pattern calls for and belongs with the fixture.
- **`.DS_Store` correctly excluded.** The macOS Finder-junk file in `XTRA02_4_3/` was not staged — the project `.gitignore` excludes all `.DS_Store` globally; `git add fixtures/XTRA02_4_3/` skipped it automatically.
- **Plain-English git narration throughout Task 2** (memory `user_git_experience` / `feedback_explain_git`): every git step (presence check → D-15 confirm → stage → gitignore-safety → commit) was narrated in plain English before running, the user ran no git, and nothing was pushed (memory `feedback_dont_push_release_tags`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Applied the locked D-04 SAFE-01 path-prefix denylist in this plan**

- **Found during:** Task 3 (CURRENT_PHASE bump — its acceptance criteria require `safe01-enumeration` + `safe01-baseline` to stay green; they failed).
- **Issue:** Task 2 committed `fixtures/SIMPLE_PROJECT_43/skeleton2_42.json`, making it git-tracked. Its `spine` token `"4.2-from-4.3.01"` parses (via the existing suffix-tolerant `parseInt`) to major=4/minor=2 and it has NO top-level `constraints[]`, so the **existing** loader (pre-Plan-02 dispatch flip) routes it to runtime-42 and it samples successfully. `discover-fixtures.ts`'s `globSync('fixtures/**/*.json')` therefore auto-discovered it and included it → the frozen SAFE-01 enumeration drifted 11→12 (`safe01-enumeration` fail) and `safe01-baseline` demanded a non-existent frozen baseline for it (`SAFE-01 baseline missing` fail). This blocked Task 3's acceptance criteria ("the phase-gate bump alone does NOT break SAFE-01").
- **Fix:** Applied the **locked D-04** exclusion exactly as specified in `44-PATTERNS.md` §"`tests/safe01/discover-fixtures.ts` (MOD — path-prefix denylist, D-04)": added `SAFE01_EXCLUDED_PREFIXES` (`fixtures/SIMPLE_PROJECT_43/`, `fixtures/SLIDER_4_3/`, `fixtures/XTRA01_4_3/`, `fixtures/XTRA02_4_3/`) + a `.filter()` in `discover()`. The D-04 exclusion is **locked** (CONTEXT D-04: "the exclusion itself is locked"); only the mechanism is discretionary, and the path-prefix denylist is the PATTERNS-recommended mechanism. PATTERNS.md explicitly flagged this as "CO-REQUIRED BY THE DISPATCH FLIP — not independent polish (Pitfall 1)"; here it surfaced one step earlier (the fixture commit alone, not the dispatch flip, made `skeleton2_42.json` route+sample) — applying it now is also strictly correct for the Plan-02 dispatch flip (verified: `SLIDER-01.json`/`XTRA-01.json`/`XTRA-02.json`/`skeleton2.json` all have `spine 4.3.x` + top-level `constraints[]`, so they are still naturally rejected by the existing `checkSpine43Schema` today but will route post-flip — the denylist pre-empts that leak too).
- **Files modified:** `tests/safe01/discover-fixtures.ts`
- **Verification:** `npx vitest run tests/safe01/phase44-fixture-guard.spec.ts tests/safe01/safe01-enumeration.spec.ts tests/safe01/safe01-baseline.spec.ts` → 3 files / 35 tests pass, exit 0; full plan `<verification>` (runtime43 + the 3 safe01 specs) → 6 files / 40 tests pass, exit 0.
- **Committed in:** `81b9b20` (part of the Task 3 commit, with the phase-gate bump).

**Subtlest-correctness verification (PATTERNS.md flagged it):** I enumerated every git-tracked `fixtures/**/*.json` and cross-checked against `tests/safe01/baselines/_manifest.json` (11 frozen). Other 4.3/3.8-ish git-tracked rigs (`SPINE_4_3_TEST/`, `SPINE_3_8_TEST/`) are still naturally excluded by the EXISTING version-rejecters pre-flip (3.8 → `<4.2` reject; 4.3 → top-level-`constraints[]` reject) and are correctly NOT in the manifest — they do not appear in the enumeration received-set and need no denylist entry at Phase 44 (the Plan-02 dispatch flip + its own D-11/D-04 work owns re-checking them post-flip; gitignored `test_4.3/` cannot enter the manifest regardless). The 4-prefix locked denylist is the precise minimal correct set for this plan.

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking).
**Impact on plan:** The D-04 denylist is a locked, co-required exclusion fully specified by the plan's own PATTERNS.md (exact code given). No scope creep — it is the mechanically-mandated fix that lets Task 3's acceptance criteria pass and pre-empts the identical Plan-02 dispatch-flip leak. The plan's task structure assumed the denylist would land with the dispatch flip (Plan 02); committing the fixtures in Plan 01 (Task 2) surfaced the requirement one plan earlier, which is strictly safe and correct.

## Issues Encountered

- **`cat -A` / `timeout` unavailable on macOS (BSD userland).** Used the `Read` tool to inspect the atlas file shape and ran vitest without an external `timeout` wrapper instead. No impact on outcome.

## User Setup Required

None — no external service configuration required. (All git operations were performed by the executor with plain-English narration; the user ran no git and nothing was pushed.)

## Known Stubs

None. This plan commits real owner-exported fixture bytes (no synthesized/placeholder fixtures) and adds fully-wired driver functions consumed by later Phase-44 plans (44-03 ORCL-02 / 44-04 XTRA baselines+structural). The XTRA builders are intentionally not yet consumed by any spec **this wave** (the XTRA specs are Plan 04 by design) — they compile and the runtime43 harness stays green; this is the planned Wave-1 sequencing, not a stub.

## Next Phase Readiness

- **Plan 02 (dispatch flip)** ready: the locked D-04 denylist is already in place (pre-empts the `safe01-enumeration` leak the flip would otherwise cause); the committed 4.3 fixtures + the armed `phase44-fixture-guard` are present.
- **Plan 03 (ORCL-02 equivalence)** ready: `buildLoadSibling42()` + `buildLoad43()` + `sample()` are in `baseline-driver.ts`; the ORCL-02 4.2 leg (`skeleton2_42.*`) is committed and confirmed to route to runtime-42 (token `4.2-from-4.3.01`, no top-level `constraints[]`).
- **Plan 04 (XTRA baselines + structural)** ready: `buildLoadXtra01()`/`buildLoadXtra02()` are exported and faithful clones; the XTRA rigs + `XTRA02_4_3/NOTES.md` are committed.
- **Phase 46 (SLIDER closed-form oracle)** unblocked: `fixtures/SLIDER_4_3/` exists and is git-tracked/redistributable.
- No blockers. The dispatch seam (`loader.ts:250` `pickRuntime('4.2')`) is unchanged this plan — it is Plan 02's single behavior flip and was correctly NOT touched here.

## Self-Check: PASSED

All created/modified files verified present on disk (SUMMARY, baseline-driver.ts, phase-gate.ts, discover-fixtures.ts, the 5 fixture rigs + XTRA02 NOTES.md). All 3 task commits verified in git history: `4bddc11`, `1ff8107`, `81b9b20`.

---
*Phase: 44-loader-dispatch-equivalence-oracle-4-3-fixture-authoring*
*Completed: 2026-05-18*

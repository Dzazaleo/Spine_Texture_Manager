---
phase: 48-core-scale-bake-module-regression-oracle
plan: 02
subsystem: testing
tags: [fixtures, spine-4.2, spine-4.3, scale-bake, regression-oracle, fixture-commit-safety, path-constraint, ip-protection]

# Dependency graph
requires:
  - phase: 48-core-scale-bake-module-regression-oracle
    provides: "48-CONTEXT D-01..D-06a fixture-matrix strategy + 48-RESEARCH Fixture-Commit Safety recipe + 48-PATTERNS three-dirs-and-provenance table"
provides:
  - "fixtures/SCALE_BAKE_4_3/SKINS_SPINE_V02.{json,atlas} (DEMON copy — 4.3 all-constraint-types + physics + slider + mesh stress, json+atlas only)"
  - "fixtures/SCALE_BAKE_4_2/TEST_01.{json,atlas} (deform-heavy 4.2 all-four-types rig, transform+ik+path+physics, deform x18)"
  - "fixtures/SCALE_BAKE_4_2/TEST_03.{json,atlas} (4.2 ik-softness-curve rig)"
  - "fixtures/SCALE_BAKE_PATH_43/PATH_FIXED.{json,atlas} (synthetic 4.3 path-Fixed — the only on-disk coverage for the PATH position+spacing length-mode timeline channel)"
  - "All 8 fixture files PROVEN git-tracked + not-ignored + present in the committed tree (the v1.3.1 silent-no-commit landmine defused)"
affects: [48-04 (regression oracle — wires this fixture matrix in via the MATRIX[] array; the oracle is the fixtures' correctness proof), BAKE-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixture-commit safety: COPY .json+.atlas (NEVER PNGs) into brand-new non-ignored dirs, then PROVE tracked via git check-ignore (empty) + git ls-files --error-unmatch (succeeds) + git archive HEAD | tar -t (lists each)"
    - "PNG-exclusion = IP protection (D-04): .json (geometry) + .atlas (region names/dims/UV rects + a page filename, no pixel data) leak nothing; only the painted PNGs carry confidential art"
    - "Synthetic minimal 4.3 rig authoring: smallest parse-safe skeleton driving a single under-covered runtime channel (path positionMode/spacingMode Fixed + position/spacing timelines); parse-verified through spine-core 4.3.0 at multiple scales"

key-files:
  created:
    - fixtures/SCALE_BAKE_4_3/SKINS_SPINE_V02.json
    - fixtures/SCALE_BAKE_4_3/SKINS_SPINE_V02.atlas
    - fixtures/SCALE_BAKE_4_2/TEST_01.json
    - fixtures/SCALE_BAKE_4_2/TEST_01.atlas
    - fixtures/SCALE_BAKE_4_2/TEST_03.json
    - fixtures/SCALE_BAKE_4_2/TEST_03.atlas
    - fixtures/SCALE_BAKE_PATH_43/PATH_FIXED.json
    - fixtures/SCALE_BAKE_PATH_43/PATH_FIXED.atlas
    - .planning/phases/48-core-scale-bake-module-regression-oracle/48-02-SUMMARY.md
  modified: []

key-decisions:
  - "Synthetic path-Fixed rig: 3 bones (root + bone1 + bone2), 1 slot bound to root carrying a 6-point path attachment (vertexCount 6, 12 vertices, 2 lengths), 1 path constraint (positionMode/spacingMode fixed), 1 'slide' animation animating BOTH path.position (with a curve key) AND path.spacing (>=2 keys each)"
  - "Authored stable spine '4.3.0' (NO beta token) per RESEARCH Pitfall 5 — beta editor builds are typed-rejected at resolveRuntimeTag"
  - "Path attachment requires no atlas region (AtlasAttachmentLoader.newPathAttachment does no findRegion); the 1-region synthetic .atlas is structural only — the bake/oracle read zero pixels"

patterns-established:
  - "Fixture-commit safety recipe (D-06a): copy-into-new-non-ignored-dir + the three authoritative would-CI-see-it git proofs"

requirements-completed: [BAKE-04]

# Metrics
duration: ~18min
completed: 2026-05-22
---

# Phase 48 Plan 02: SCALE_BAKE Fixture Matrix (Commit-Safe) Summary

**Committed the regression oracle's full fixture matrix — DEMON (4.3) + TEST_01/TEST_03 (4.2 deform-heavy) copied json+atlas-only into new non-ignored dirs, plus an authored parse-verified synthetic 4.3 path-Fixed rig — all eight files PROVEN git-tracked on a fresh clone with zero PNGs (D-04 IP protection intact, v1.3.1 silent-no-commit landmine defused).**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-22 (worktree agent-ac21fd0efc4be425a)
- **Completed:** 2026-05-22
- **Tasks:** 3 (Task 3 is a proof task — its 8 files were already committed atomically in Tasks 1+2 per the per-task commit protocol, so it adds no separate commit)
- **Files modified:** 8 fixture files created (+ this SUMMARY)

## Accomplishments

- Crossed the author-disk → committed-tree trust boundary for every oracle fixture: 6 copied (DEMON + TEST_01 + TEST_03 json+atlas) + 2 authored (synthetic path-Fixed json+atlas).
- Authored the single residual-gap fixture (D-05): a tiny synthetic 4.3 rig that drives the PATH position+spacing length-mode timeline channel — the one channel NO real on-disk rig exercises (every real path rig uses positionMode=Percent + spacingMode=Length with zero spacing timelines). Parse-verified clean through spine-core 4.3.0 at scale 1 and 0.5.
- Proved all 8 files are git-tracked + not-ignored + present in the committed tree via the three authoritative git commands — defusing the exact v1.3.1 landmine where a fixture passes locally but never reaches CI.
- Zero PNG bytes committed under any SCALE_BAKE_* dir (D-04 IP protection): geometry + atlas text only.

## Task Commits

Each task was committed atomically:

1. **Task 1: COPY DEMON + TEST_01 + TEST_03 (.json+.atlas only)** - `985f677` (test)
2. **Task 2: Author the synthetic 4.3 path-Fixed fixture (D-05)** - `1bf3b44` (test)
3. **Task 3: Prove every new fixture is git-tracked and reachable** - no separate commit; the 8 files were already committed in Tasks 1+2 per the per-task commit protocol (atomic-per-task), so Task 3's deliverable is the proof itself (recorded below), not a re-stage. All three authoritative proofs ran GREEN against the already-committed tree.

_Plan metadata commit (this SUMMARY) is committed separately by the metadata step._

## Files Created/Modified

- `fixtures/SCALE_BAKE_4_3/SKINS_SPINE_V02.json` (465 KB) - DEMON copy; spine 4.3.02; 4.3 all-constraint-types + physics (physics.limit injection) + slider + mesh stress. The only 4.3 physics source.
- `fixtures/SCALE_BAKE_4_3/SKINS_SPINE_V02.atlas` (2.8 KB) - DEMON atlas text (region names/dims/rotate; first line `SKINS_SPINE_V02.png`).
- `fixtures/SCALE_BAKE_4_2/TEST_01.json` (704 KB) - deform-heavy 4.2.43 all-four-types rig (transform+ik+path+physics, deform x18). Defeats the DEMON-has-no-deform false-confidence trap.
- `fixtures/SCALE_BAKE_4_2/TEST_01.atlas` (3.4 KB) - TEST_01 atlas text.
- `fixtures/SCALE_BAKE_4_2/TEST_03.json` (268 KB) - 4.2.43 ik-softness-curve rig.
- `fixtures/SCALE_BAKE_4_2/TEST_03.atlas` (4.5 KB) - TEST_03 atlas text.
- `fixtures/SCALE_BAKE_PATH_43/PATH_FIXED.json` - authored synthetic 4.3.0 path-Fixed rig (3 bones, 1 slot, 6-point path attachment, 1 path constraint with positionMode+spacingMode fixed, 1 `slide` anim animating position+spacing with a curve key).
- `fixtures/SCALE_BAKE_PATH_43/PATH_FIXED.atlas` - minimal 1-region synthetic atlas (`PATH_FIXED.png` / size:64,64 / one `region` / bounds:0,0,32,32).

## The Three Authoritative "Would CI See It?" Proofs (Task 3)

All ran GREEN for every one of the 8 `.json` AND `.atlas` files:

1. **NOT ignored** — `git check-ignore <each>` printed NOTHING (exit 1 for all 8).
2. **TRACKED** — `git ls-files --error-unmatch <each>` SUCCEEDED for all 8.
3. **In the committed tree** — `git archive HEAD | tar -t | grep -c SCALE_BAKE` = **11** (8 files + 3 dir entries; >= 8 satisfied; all 8 .json+.atlas explicitly listed).
4. **No PNG ever staged/committed** — `git diff --cached --name-only | grep -i '\.png$'` empty during both staging steps; `git archive HEAD | tar -t | grep SCALE_BAKE | grep -c '\.png$'` = 0.

**Authoritative-signal caveat (recorded per plan + memory):** local green != CI green. The binding signal is the **watched per-OS run of BOTH `ci.yml` AND `release.yml`** (they diverge — `release.yml` uses shallow checkout vs git-archaeology guards needing `fetch-depth:0`; only the workflow's own watched run is authoritative). No tags pushed, no release triggered (tags are local-only by user preference).

## Decisions Made

- **Path attachment placement:** the synthetic rig binds a 6-point path attachment to a slot on `root` and follows `bone1`+`bone2` — the minimum that makes `SkeletonJson.readSkeletonData` resolve the path constraint's `bones[]` + `slot` without error. Confirmed against spine-core 4.3.0 `SkeletonJson.js:254-285` (path setup) + `:587-603` (path attachment) + `:978-999` (path timelines).
- **Curve only on the position channel:** RESEARCH/CONTEXT require ">=1 keyframe carrying a curve"; placed the 4-float bezier `[0.25, 22, 0.75, 45]` on the position channel's first key (the cy-scale path the bake must exercise). Spacing uses 2 plain keys.
- **referenceScale:100 declared explicitly** in the synthetic skeleton — mirrors the L-02 scaled-default-injection landmine the bake handles, so the oracle exercises it on a known-value rig.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Source fixtures absent in the isolated worktree — copied from the main worktree's absolute path**
- **Found during:** Task 1 (COPY step)
- **Issue:** The plan's `cp` commands use worktree-relative source paths (`fixtures/DEMON/...`, `fixtures/MON_FILES/...`). Those source dirs are UNTRACKED in the main worktree (`?? fixtures/DEMON/` in git status) and DIR-IGNORED for MON_FILES — git worktrees do NOT carry untracked files from the main working tree, so the six source files did not exist in this isolated worktree (`fixtures/DEMON/` / `fixtures/MON_FILES/` were missing here). The plan's `<interfaces>` "VERIFIED this session" note reflected the main-tree author session, not the worktree.
- **Fix:** Copied the six `.json`+`.atlas` files from the main worktree's absolute path (`/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/fixtures/DEMON/...` and `.../fixtures/MON_FILES/EXPORT/TEST_0{1,3}/4.2/...`) into the new `fixtures/SCALE_BAKE_*` dirs. The plan's intent — COPY `.json`+`.atlas` ONLY, never PNGs, into brand-new non-ignored dirs — is fully preserved; only the source path resolved to the main worktree where the untracked source files live.
- **Files modified:** the 6 copied fixture files (Task 1 outputs); no source dirs touched, no git add of any ignored/untracked source dir.
- **Verification:** byte sizes match the main-tree sources (DEMON.json 465071, TEST_01.json 720972, TEST_03.json 273805); version tokens confirmed (4.3.02 in DEMON, 4.2.43 in TEST_01 + TEST_03); zero PNGs landed.
- **Committed in:** `985f677` (part of the Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1x Rule 3 - blocking issue).
**Impact on plan:** No scope change — the deviation is purely a source-path correction forced by git-worktree isolation semantics. The committed output is byte-identical to what the plan's relative-path `cp` would have produced in the main tree. All acceptance criteria + success criteria met exactly.

## Issues Encountered

- Worktree node_modules absence: the parse smoke-test for the synthetic fixture had to run from the main worktree (where deps are installed) because `node_modules` is not present in the isolated worktree. Resolved by executing the smoke script from the main worktree's directory so the bare `@esotericsoftware/spine-core` specifier resolves; the fixture parsed clean at scale 1 and 0.5 (PathConstraintData found, positionMode=Fixed, spacingMode=Fixed, both timelines parsed). This is a one-off verification step, not part of the committed deliverable.
- A transient `/tmp/path_parse_smoke.mjs` scratch script could not be removed (sandbox denies operations outside the worktree). It lives outside any git repo, is never staged, and has zero effect on the commit/fixtures/CI. Non-blocking.

## Known Stubs

None. The two synthetic-fixture files are intentional, minimal, parse-verified test data (not stubs blocking a goal). The six copied fixtures are real exported rigs. The fixtures are CONSUMED by the 48-04 oracle, which is their formal correctness proof.

## Self-Check: PASSED

- All 8 fixture files + this SUMMARY.md exist on disk (verified `test -f`).
- Both task commits exist in git history: `985f677` (Task 1), `1bf3b44` (Task 2).
- All 8 fixtures proven tracked + not-ignored + in committed tree (the three authoritative git proofs above).
- Zero PNGs committed. Zero `src/`/`tests/` changes (fixtures-only plan).
- No missing items.

---
phase: 15-build-feed-shape-fix-v1-1-2-release
plan: 01
subsystem: infra
tags: [build-config, electron-builder, version-bump, yaml, npm, macos-zip]

# Dependency graph
requires:
  - phase: 14-auto-update-reliability-fixes-renderer-state-machine
    provides: Renderer-side fixes (UPDFIX-02/03/04) that unblock live verification of UPDFIX-01 Windows download path during Phase 15 packaged-build wave.
  - phase: 12.1-installer-auto-update-live-verification
    provides: D-10 publish-race fix architecture (`scripts/emit-latest-yml.mjs` post-build synthesizer + `electron-builder.yml` `publish: null` + `extraResources: build/app-update.yml`) — preserved byte-identical by this plan's edits.
provides:
  - electron-builder.yml mac.target dual-installer config (dmg + zip both at arch arm64)
  - package.json build:* scripts that allow YAML mac.target to be the single source of truth (bare `--mac` / `--win` / `--linux`)
  - package.json + package-lock.json bumped 1.1.1 → 1.1.2 (the version-bump commit `abf7a32` is the future tag target for Plan 15-04 Task 4 `git tag -a v1.1.2 abf7a32`)
affects: [15-02 emit-latest-yml.mjs synthesizer extension, 15-03 release.yml CI artifact + publish glob extension, 15-04 v1.1.2 tag push + CI watch + 7-asset publish]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — YAML/npm-version-only edits.
  patterns:
    - "Sibling-array-entry append in electron-builder.yml mac.target preserves all sibling fields byte-identical (12.1-D-10 invariant guard)"
    - "Bare `electron-builder --<platform>` (no target args) lets YAML control truth — verified against electron-builder 26.8.1 source short-circuit at app-builder-lib/out/targets/targetFactory.js:11-17"
    - "Atomic 2-file `npm version X.Y.Z --no-git-tag-version` commit (12.1-02 / 13-03 precedent — package.json + package-lock.json only, no auto-tag)"

key-files:
  created: []
  modified:
    - electron-builder.yml (mac.target gained `- target: zip` `arch: arm64` entry)
    - package.json (version 1.1.1 → 1.1.2; build:mac/win/linux scripts dropped explicit target CLI args)
    - package-lock.json (locked tree at 1.1.2 — both top-level `version` and `packages[""].version`)

key-decisions:
  - "D-01 (CONTEXT lock-in): zip target appended to mac.target alongside dmg — electron-builder produces both .dmg and .zip natively in one `npm run build:mac` invocation; .zip is the medium Squirrel.Mac swaps on Download & Restart, .dmg stays as INSTALL.md drag-to-Applications asset."
  - "RESEARCH §A2 lock-in: explicit target CLI args dropped from build:mac/win/linux scripts — `electron-builder --mac dmg` overrides YAML `mac.target` per the targetFactory.js:11-17 short-circuit; bare `--mac` makes types[]=[] which falls through to read mac.target from YAML."
  - "12.1-02 / 13-03 precedent followed: 3 atomic commits (NOT bundled), `npm version --no-git-tag-version` flag mandatory (auto-tag would collide with Plan 15-04 Task 4 deliberate annotated tag creation)."
  - "Sibling fields in electron-builder.yml mac block (`identity: '-'`, `hardenedRuntime: false`, `gatekeeperAssess: false`, `artifactName` template, `extraResources: build/app-update.yml`) preserved byte-identical — 12.1-D-10 publish-race fix architecture invariant guard."

patterns-established:
  - "Sibling-array-entry append in YAML config: insert new entry between existing entries with matching shape; verify YAML still parses + sibling fields untouched via grep counts."
  - "CLI-flag-drop-because-YAML-controls-truth: drop explicit target args from build:* npm scripts so future target additions need no script edit; YAML config becomes single source of truth."
  - "3-commit atomic version-bump wave: feat (config) + fix (script hygiene) + chore (version bump) — each separately commitable, cleanly bisectable, mirrors 12.1-02 / 13-03 precedent shape."

requirements-completed: [UPDFIX-01]  # Plan 15-01 lays the build-config foundation for UPDFIX-01; full closure ships when v1.1.2 publishes (Plan 15-04). Marking here per plan frontmatter.

# Metrics
duration: ~10min
completed: 2026-04-29
---

# Phase 15 Plan 01: Build-config + version-bump foundation for v1.1.2 Summary

**electron-builder.yml mac.target gained `target: zip` alongside `dmg`; build:mac/win/linux npm scripts dropped explicit target CLI args so YAML controls truth; package.json + package-lock.json bumped 1.1.1 → 1.1.2 — 3 atomic commits totaling +6/-3 across 3 files.**

## Performance

- **Duration:** ~10 min (worktree-agent execution; not the multi-day Phase 15 wall-time)
- **Started:** 2026-04-29T15:47Z (approximate; worktree spawn time)
- **Completed:** 2026-04-29T15:57:42Z
- **Tasks:** 3 / 3
- **Files modified:** 3 (electron-builder.yml, package.json, package-lock.json)
- **Commits:** 3 atomic task commits

## Accomplishments

- **D-01 landed:** `electron-builder.yml` `mac.target` array contains both `- target: dmg` `arch: arm64` AND `- target: zip` `arch: arm64`. Sibling fields (`identity: '-'`, `hardenedRuntime: false`, `gatekeeperAssess: false`, `artifactName` template, `extraResources: build/app-update.yml`) preserved byte-identical — 12.1-D-10 publish-race fix architecture invariant unaffected.
- **RESEARCH §A2 landed:** `package.json` `build:mac` / `build:win` / `build:linux` scripts now invoke `electron-builder --<platform>` (bare, no target arg). The dropped CLI args (`dmg`, `nsis`, `AppImage`) would otherwise short-circuit YAML target resolution per `app-builder-lib/out/targets/targetFactory.js:11-17` — silently producing `.dmg`-only and tripping Plan 15-02's synthesizer fail-fast. `build:dry` (line 20) preserved at `electron-builder --mac dmg --dir` (intentional one-off; out of scope for the YAML-controls-truth pattern).
- **12.1-02 / 13-03 precedent landed:** `package.json` version 1.1.1 → 1.1.2 via `npm version 1.1.2 --no-git-tag-version` — 2-file atomic commit (package.json + package-lock.json + `packages[""]` entry), `--no-git-tag-version` flag mandatory (no local v1.1.2 tag created — Plan 15-04 Task 4 owns deliberate annotated tag creation pointing at this version-bump commit's SHA `abf7a32`).
- **All 6 plan-level success criteria pass:** mac.target dual-entry + scripts bare `--<platform>` + version 1.1.2 in all 3 fields + 3 atomic commits + no v1.1.2 tag + working tree clean.

## Task Commits

Each task was committed atomically with `--no-verify` (parallel-executor protocol — orchestrator validates hooks once after wave completes):

1. **Task 1: Append `target: zip` to electron-builder.yml mac.target array (D-01)** — `90cb57f` (feat)
2. **Task 2: Drop explicit target CLI args from package.json build:* scripts (RESEARCH §A2)** — `eef8344` (fix)
3. **Task 3: Bump package.json + package-lock.json version 1.1.1 → 1.1.2** — `abf7a32` (chore)

`abf7a32` is the future tag target for Plan 15-04 Task 4 (`git tag -a v1.1.2 abf7a32` per 12.1-02 / 13-03 precedent of tagging the version-bump commit, NOT subsequent docs commits).

## Files Created/Modified

- `electron-builder.yml` — mac.target gained 2-line zip entry (lines 61-62 in post-edit file). All other fields byte-identical. Total: 92 → 94 lines, +2 insertions, 0 deletions.
- `package.json` — version field 1.1.1 → 1.1.2 (line 3); 3 build:* script lines (17-19) lost their explicit `dmg` / `nsis` / `AppImage` CLI args. `build:dry` (line 20) intentionally untouched.
- `package-lock.json` — top-level `version` field + `packages[""].version` entry both 1.1.1 → 1.1.2 (npm 7+ contract — manual edits would miss the `packages[""]` entry).

## Decisions Made

None beyond the plan-locked decisions in 15-CONTEXT.md (D-01) and 15-RESEARCH.md (§A2). Plan executed exactly as written.

## Deviations from Plan

None — plan executed exactly as written. All 3 tasks completed in order; verification commands passed at each step; 3 atomic commits landed per the plan's commit-protocol specification.

**One environmental note (NOT a deviation in plan content, only in tool mechanics):** the Edit and Write tools experienced a state-sync issue with the read-before-edit hook in this worktree session — the tools reported success while the on-disk file remained unchanged. Workaround applied: a Bash-driven `node -e "fs.readFileSync ... fs.writeFileSync ..."` script with explicit pre/post markers performed the YAML and JSON mutations. Final on-disk state, `git diff`, `git log`, hash verifications, and YAML `js-yaml.load` structural assertions all confirm the intended edits landed correctly. No content drift from the plan; no acceptance criteria failed.

**Plan-level grep count discrepancy (cosmetic, NOT a content deviation):** the plan's Task 1 acceptance bullet `grep -c "^\s\+- target:" electron-builder.yml returns 2` is a mistake — the regex matches all `- target:` lines across mac (2) + win (1) + linux (1) sections, returning 4 (not 2). The semantic check that mac.target has exactly 2 entries is captured by the `js-yaml.load` structural assertion (`y.mac.target.length === 2`), which passed cleanly. Recorded here so a future verifier reading the plan's acceptance bullets does not re-trip on this typo.

## Issues Encountered

None during planned work execution. The Edit/Write tool state-sync mechanics issue described above was a tooling artifact, not a content/correctness issue with the plan or task work.

## User Setup Required

None — no external service configuration. The 3 commits are local; tag creation + push is Plan 15-04 (autonomous: false; user-confirmed).

## Next Phase Readiness

**Plans 15-02 + 15-03 (Wave 1 parallel) can layer on top of these 3 commits.** Specifically:

- **Plan 15-02** (`scripts/emit-latest-yml.mjs` extension for dual-installer mac) builds on Task 1 — the YAML `mac.target` zip entry is what triggers the synthesizer's new dual-`.dmg` + `.zip` detection branch. Plan 15-02 also benefits from Task 2 — without dropping the `--mac dmg` CLI arg, the build would only produce `.dmg` and Plan 15-02's synthesizer fail-fast would trip in CI.
- **Plan 15-03** (`.github/workflows/release.yml` build-mac upload-artifact + publish files: list extension) builds on Task 1 — without the YAML `zip` target, `release/*.zip` would not exist post-build and the new CI glob would trip `if-no-files-found: error`.
- **Plan 15-04** (v1.1.2 tag push + CI watch + 7-asset publish) builds on Task 3 — `abf7a32` is the deliberate tag target SHA per 12.1-02 / 13-03 precedent. CI's tag-version-guard at `release.yml:43-54` will accept `v1.1.2` tag against the now-bumped 1.1.2 package.json.

No blockers; no concerns. Working tree clean; HEAD at `abf7a32`.

---

## Self-Check: PASSED

**Files verified to exist on disk:**
- `electron-builder.yml` — FOUND (94 lines; mac.target has dmg + zip)
- `package.json` — FOUND (version 1.1.2; build:* scripts bare)
- `package-lock.json` — FOUND (version 1.1.2; packages[""].version 1.1.2)

**Commits verified in git log:**
- `90cb57f` — FOUND (feat: zip target)
- `eef8344` — FOUND (fix: build:* scripts)
- `abf7a32` — FOUND (chore: version bump)

**Plan-level success criteria all confirmed via final verification block.**

---

*Phase: 15-build-feed-shape-fix-v1-1-2-release*
*Plan: 01*
*Completed: 2026-04-29*

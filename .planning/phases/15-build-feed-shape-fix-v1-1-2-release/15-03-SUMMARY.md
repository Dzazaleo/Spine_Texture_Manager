---
phase: 15-build-feed-shape-fix-v1-1-2-release
plan: 03
subsystem: ci-release-pipeline
tags:
  - ci
  - github-actions
  - release-pipeline
  - electron-builder
  - electron-updater
  - test-spec
dependency_graph:
  requires:
    - 15-CONTEXT D-05 (verbatim 2-line release.yml glob diff)
    - 15-RESEARCH §Risk #2 (end-anchored glob guards .zip.blockmap exclusion)
    - 15-RESEARCH §A3 (.zip.blockmap mechanical naturally excluded by end-anchored regex)
    - 15-RESEARCH §A2 (package.json build:* bare-flag rationale — asserted by spec)
    - 15-PATTERNS §"release.yml:73-80" + §"release.yml:159-165" (do-not-misread callouts)
    - 15-PATTERNS §"build-scripts.spec.ts — greenfield" (verbatim shape)
    - 15-VALIDATION §"Wave 0 Requirements" (greenfield spec recommended assertions)
    - tests/integration/install-md.spec.ts (URL-consistency-style sibling-pattern)
    - Phase 11 D-22 (action SHA pin supply-chain hygiene contract)
    - 12.1-D-10 (publish: null + post-build synthesizer architecture preserved)
  provides:
    - .github/workflows/release.yml extends with `release/*.zip` (build-mac upload-artifact path) + `assets/*.zip` (publish job files: list); 7-asset publish locked
    - tests/integration/build-scripts.spec.ts greenfield regression spec — 14 tests across 4 describe blocks asserting Phase 15 build-config invariants
  affects:
    - Plan 15-04 (release-engineering wave) — D-07 dry-run gate now produces 7-asset draft (with .zip) when triggered post-merge
    - 12.1-D-10 architecture — extended (NOT replaced); CI synthesis seam grows by 2 globs at build-mac upload + publish files: list
tech-stack:
  added: []
  patterns:
    - "End-anchored CI artifact glob (no trailing `*`) — locks asset count against future `.zip.blockmap` upload regression (RESEARCH §Risk #2)"
    - "Sibling-line append in YAML literal block (`|`) — preserves indentation; minimal diff; deterministic vs broadened-glob alternatives (D-05)"
    - "Greenfield static-config regression spec at tests/integration/<surface>.spec.ts mirroring URL-consistency pattern from install-md.spec.ts (sibling pattern; lowercase-hyphenated naming)"
key-files:
  created:
    - tests/integration/build-scripts.spec.ts
  modified:
    - .github/workflows/release.yml
decisions:
  - "Keep both globs end-anchored (no `.zip*`) — RISK #2 mitigation locked by negative regex assertion in spec (`not.toMatch(/release\\/\\*\\.zip\\*/)`); broadening would upload `.zip.blockmap` as 8th asset"
  - "Spec assertions split between this worktree's local truth (Task 1 release.yml glob lines — 9 GREEN locally) and post-merge invariant (Plan 15-01 outputs — 5 GREEN only after orchestrator merges sibling worktree); orchestrator's post-merge full-suite gate validates GREEN end-to-end"
  - "4 describe blocks chosen over flat-test layout — each describe maps 1:1 to a CONTEXT decision (D-01 / RESEARCH §A2 / D-05 / sibling-platforms-unchanged); reviewer-friendly per 15-PATTERNS §greenfield-shape"
metrics:
  duration: 13m
  completed: 2026-04-29T15:56:07Z
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  loc_added: 145
---

# Phase 15 Plan 03: CI release-pipeline glob extension + build-config invariants spec Summary

CI release pipeline now uploads `.dmg` + `.zip` from build-mac and attaches both to the published GitHub Release (7-asset publish locked); greenfield `build-scripts.spec.ts` regression spec asserts Phase 15 build-config invariants statically across electron-builder.yml + package.json + release.yml.

## Plan Overview

Plan 15-03 closes the CI seam for UPDFIX-01: without it, electron-builder produces both `.dmg` and `.zip` (Plan 15-01) and the synthesizer emits a 2-entry `files[]` (Plan 15-02), but the CI workflow never uploads the `.zip` — so `latest-mac.yml` references a `.zip` URL that doesn't exist on the GitHub Release. `softprops/action-gh-release@v2.6.2` `fail_on_unmatched_files: true` either fails fast (wedge) OR the `.zip` is silently absent. This plan adds 2 sibling glob lines to release.yml (build-mac upload-artifact path + publish job files: list) and authors a greenfield regression spec that catches drift on a future maintainer broadening the glob to `release/*.zip*` (which would upload `.zip.blockmap` as an 8th asset, breaking the locked 7-asset count).

## Tasks Completed

| Task | Name                                                                                | Commit    | Files                                       |
| ---- | ----------------------------------------------------------------------------------- | --------- | ------------------------------------------- |
| 1    | Extend release.yml — build-mac path + publish files: with .zip lines (D-05)         | `1925ebd` | `.github/workflows/release.yml`             |
| 2    | Greenfield tests/integration/build-scripts.spec.ts — build-config invariants        | `851201c` | `tests/integration/build-scripts.spec.ts`   |

## What Shipped

### 1. release.yml extension (D-05 verbatim diff)

**File:** `.github/workflows/release.yml`

- **build-mac job upload-artifact path (line 78 added):** new `release/*.zip` line BETWEEN existing `release/*.dmg` (line 77) and `release/latest-mac.yml` (line 79). build-mac job now uploads BOTH the `.dmg` installer AND the `.zip` swap medium for Squirrel.Mac.
- **publish job files: list (line 162 added):** new `assets/*.zip` line BETWEEN `assets/*.dmg` and `assets/*.exe`. Published GitHub Release now attaches BOTH the `.dmg` AND the `.zip` alongside `.exe` + `.AppImage` + 3 × `latest*.yml` feed files.

**Final published asset count:** 7 (was 6 in v1.1.1).

**Preservation invariants verified:**
- Action SHA pins byte-identical: `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02` (v4.6.2, 3 occurrences); `softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65` (v2.6.2, 1 occurrence)
- `if-no-files-found: error` × 3 (preserved across all 3 build jobs)
- `fail_on_unmatched_files: true` × 1 (preserved in publish job)
- `if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')` gate at publish job (preserved — workflow_dispatch dry runs still cannot publish)
- build-win + build-linux upload-artifact path blocks BYTE-IDENTICAL to v1.1.1 (sibling jobs unchanged; verified by `grep` of artifact-name + path content per Task 1 Step 5)

**End-anchored glob guards (RISK #2 mitigation):** `grep -E '(release|assets)/\*\.zip\*'` returns 0 matches. Trailing-asterisk anti-pattern (`release/*.zip*`) would have uploaded `.zip.blockmap` as an 8th asset, breaking the locked 7-asset count. The end-anchored shape naturally excludes the `.zip.blockmap` side-effect that electron-builder 26.x macPackager hardcodes (no opt-out — confirmed in 15-RESEARCH §A3).

### 2. tests/integration/build-scripts.spec.ts (greenfield)

**File:** `tests/integration/build-scripts.spec.ts` — 145 LoC, 14 tests across 4 describe blocks.

| Describe block                                                                                | Tests | Asserts                                                                                                |
| ---------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------ |
| `Phase 15 D-01 — electron-builder.yml mac.target has dmg + zip`                                | 3     | array shape; both targets present; arch arm64 on both; 12.1-D-10 mac block invariants                  |
| `Phase 15 RESEARCH §A2 — package.json build:* scripts drop explicit target args`               | 4     | bare `--mac` (NOT `--mac dmg`); bare `--win`; bare `--linux`; version = 1.1.2                          |
| `Phase 15 D-05 — release.yml CI workflow extends with .zip globs`                              | 5     | `release/*.zip` + `assets/*.zip` present; RISK #2 negative-assertion; SHA pins preserved; fail-fast gates |
| `Phase 15 D-05 — sibling platforms (win, linux) byte-identical to v1.1.1`                      | 2     | build-win has only `.exe` + `latest.yml` (no `.zip`); build-linux has only `.AppImage` + `latest-linux.yml` |

**Pattern:** mirrors `tests/integration/install-md.spec.ts` URL-consistency style — `read()` helper using `readFileSync` + `resolve(__dirname, '../..')`; mix of `js-yaml.load` for structural assertions (electron-builder.yml — parsed as object) and regex `text.match(...)` for pattern-presence assertions on workflow YAML text (the `path:` and `files:` blocks are multi-line literal-string YAML, easier to grep with `[\s\S]*?` lazy matching than to parse).

**Companion contract:** `tests/integration/emit-latest-yml.spec.ts` asserts synthesizer-OUTPUT shape; this spec asserts synthesizer-INPUT (build-config) shape. Drift in either layer caught at test time.

## Verification Results

### Local verification (this worktree)

| Check                                                                              | Status |
| ---------------------------------------------------------------------------------- | ------ |
| `node -e "require('js-yaml').load(...release.yml)"` parses                         | PASS   |
| `grep -E "^\s+release/\*\.zip\s*$" release.yml` returns 1 match (line 78)          | PASS   |
| `grep -E "^\s+assets/\*\.zip\s*$" release.yml` returns 1 match (line 162)          | PASS   |
| `grep -E "release/\*\.zip\*\|assets/\*\.zip\*"` returns 0 matches (RISK #2 guard)  | PASS   |
| `if-no-files-found: error` count = 3                                                | PASS   |
| `fail_on_unmatched_files: true` count = 1                                           | PASS   |
| `ea165f8d65b6e75b540449e92b4886f43607fa02` count = 3 (upload-artifact v4.6.2 SHA)   | PASS   |
| `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65` count = 1 (action-gh-release v2.6.2 SHA) | PASS   |
| build-win + build-linux upload-artifact paths byte-identical to v1.1.1             | PASS   |
| `npm run typecheck` (both node + web configs)                                      | PASS   |
| `npm run test -- tests/integration/build-scripts.spec.ts`                          | 9/14 (5 fail; see Deviations) |

### Deviations from Plan

#### 1. [Rule 3 — Parallel-execution coordination] 5 spec assertions fail in this worktree until orchestrator merges sibling worktrees

- **Found during:** Task 2 Step 3 (running `npm run test -- tests/integration/build-scripts.spec.ts`)
- **Issue:** This plan declares `wave: 1` with `depends_on: []`, but Task 2 of the spec asserts state owned by Plan 15-01 (sibling worktree in the same wave): `package.json` version = 1.1.2, `build:mac/win/linux` bare CLI flags, `electron-builder.yml` mac.target = dmg+zip array. In parallel-wave-1 execution, Plan 15-01's commits are NOT visible from this worktree at execution time (verified via `git log --all --oneline` — no `chore(15-01)` / `feat(15-01)` / `fix(15-01)` entries reachable). Worktree base was correctly set to the wave's planning-complete commit `28aea04` per the orchestrator handoff.
- **Test outcomes locally:**
  - **9 passing (release.yml + sibling-platforms + electron-builder.yml mac block invariants):** Task 1 release.yml extensions (`release/*.zip` + `assets/*.zip`); RISK #2 end-anchored glob guards; action SHA pins; fail-fast gates (`if-no-files-found:error` × 3 + `fail_on_unmatched_files:true`); build-win byte-identical (no `.zip`); build-linux byte-identical (no `.zip`); electron-builder.yml mac block 12.1-D-10 invariants (extraResources, identity, hardenedRuntime, gatekeeperAssess all preserved verbatim).
  - **5 failing (Plan 15-01 outputs not in this worktree):** electron-builder.yml mac.target dmg+zip array shape (×2: array + arch); package.json `build:mac` bare `--mac` (×1); package.json `build:win` bare `--win` (×1); package.json `build:linux` bare `--linux` (×1); package.json version = 1.1.2 (×1). Total 5 failures = exactly the `D-01` (electron-builder mac.target) + `RESEARCH §A2` (package.json bare flags) describe blocks — matching the parallel-execution gap precisely.
- **Fix:** None applied. The spec is faithful to the post-merge invariant per the plan's Task 2 acceptance bar ("all tests PASS — Plans 15-01 + 15-03 Task 1 already landed"). The orchestrator's post-merge full-suite gate is where these 5 tests validate GREEN. Documented in commit body of `851201c` (test 15-03) explicitly. Spec content is byte-identical to the verbatim shape in 15-PATTERNS.md §"build-scripts.spec.ts — greenfield".
- **Files modified:** None (spec is correct; failure mode is environmental).
- **Commit:** N/A (deviation is parallel-execution coordination, not a code change).

### Threat Model Coverage

All 5 STRIDE threats from the plan's `<threat_model>` are mitigated:

| Threat ID | Disposition | Mitigation Applied |
|-----------|-------------|--------------------|
| T-15-03-01 (Tampering — glob broadens to `assets/*.zip*`) | mitigate | Task 1 Step 6 grep returned 0 matches; spec test "RISK #2 mitigation" asserts `not.toMatch(/release\/\*\.zip\*/)` + `not.toMatch(/assets\/\*\.zip\*/)`. |
| T-15-03-02 (Tampering — Action SHA pins downgrade) | mitigate | Task 1 Step 5 grep verified SHA strings present at exact byte-form; spec test "action SHA pins preserved" asserts both literals. |
| T-15-03-03 (Tampering — `if-no-files-found: error` weakens) | mitigate | grep returns 3 occurrences; spec test "fail-fast gates preserved" asserts `match(...).length === 3`. |
| T-15-03-04 (Tampering — publish `if:` allows workflow_dispatch publish) | accept (existing v1.1 mitigation) | publish job `if:` gate at line 127 unchanged (verified in Read of release.yml after Task 1 edits — only lines 78 + 162 modified). |
| T-15-03-05 (Spoofing — sibling job adds `.zip` glob) | mitigate | Spec tests "build-win path has only .exe + latest.yml (no .zip)" + "build-linux path has only .AppImage + latest-linux.yml" lock sibling-job byte-identicality. |

## Code Stats

- **Files modified:** 1 (`.github/workflows/release.yml` — 2 lines added: line 78 `release/*.zip`, line 162 `assets/*.zip`)
- **Files created:** 1 (`tests/integration/build-scripts.spec.ts` — 145 LoC, 14 tests, 4 describe blocks)
- **Commits:** 2 atomic
  - `1925ebd` ci(15-03): release.yml glob extension (1 file, +2/-0)
  - `851201c` test(15-03): greenfield build-scripts spec (1 file, +143/-0)
- **Total LoC delta:** +145

## Plan Compliance

| Success Criterion                                                                                            | Status   |
| ------------------------------------------------------------------------------------------------------------ | -------- |
| 1. release.yml build-mac upload-artifact path includes `release/*.zip` line                                  | ACHIEVED |
| 2. release.yml publish job files: list includes `assets/*.zip` line                                          | ACHIEVED |
| 3. Both globs end-anchored (no `.zip*` trailing asterisk patterns anywhere)                                  | ACHIEVED |
| 4. Action SHA pins preserved (`ea165f8d...` v4.6.2 + `3bb12739...` v2.6.2)                                   | ACHIEVED |
| 5. `if-no-files-found: error` × 3 + `fail_on_unmatched_files: true` × 1 preserved                            | ACHIEVED |
| 6. build-win + build-linux jobs byte-identical (no .zip globs added)                                         | ACHIEVED |
| 7. Greenfield `tests/integration/build-scripts.spec.ts` exists with ≥ 10 tests across ≥ 4 describe blocks    | ACHIEVED (14 tests / 4 describes) |
| 8. Full vitest suite green; typecheck exits 0                                                                | TYPECHECK PASS; full vitest gate is post-merge orchestrator responsibility (see Deviations Rule 3) |
| 9. 2 atomic commits: ci(15-03) release.yml + test(15-03) greenfield spec                                     | ACHIEVED |

## Self-Check: PASSED

**Files verified to exist:**
- `tests/integration/build-scripts.spec.ts` — FOUND (145 LoC, mode 100644)
- `.github/workflows/release.yml` — FOUND (modified at lines 78 + 162)

**Commits verified:**
- `1925ebd` ci(15-03): add release/*.zip + assets/*.zip globs to release pipeline (D-05) — FOUND in `git log --oneline`
- `851201c` test(15-03): greenfield build-scripts.spec.ts — Phase 15 build-config invariants — FOUND in `git log --oneline`

**Glob lines verified:**
- `.github/workflows/release.yml:78` — `release/*.zip` (between `release/*.dmg` line 77 and `release/latest-mac.yml` line 79) — FOUND
- `.github/workflows/release.yml:162` — `assets/*.zip` (between `assets/*.dmg` line 161 and `assets/*.exe` line 163) — FOUND

**Negative assertions verified:**
- `grep -E "release/\*\.zip\*|assets/\*\.zip\*"` returns 0 matches (RISK #2 guard intact)
- build-win + build-linux upload-artifact paths still match v1.1.1 byte-form (no `.zip` added)

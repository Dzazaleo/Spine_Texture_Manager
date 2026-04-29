---
phase: 12-auto-update-tester-install-docs
plan: 02
subsystem: infra
tags: [electron-updater, electron-builder, github-actions, ci, github-releases, auto-update, matrix-strategy]

# Dependency graph
requires:
  - phase: 11-ci-release-pipeline-github-actions-draft-release
    provides: ".github/workflows/release.yml (5-job pipeline with SHA-pinned actions, atomic publish, --publish never bake-in); electron-builder.yml with publish: null (Pitfall 1 belt-and-braces); .github/release-template.md envsubst-rendered body"
provides:
  - "electron-updater@6.8.3 runtime dependency installed (consumed by Plan 12-01)"
  - "electron-builder.yml publish block flipped from null to GitHub provider (owner=Dzazaleo, repo=Spine_Texture_Manager, releaseType=release) → app-update.yml now baked into bundled resources/ at build time"
  - "release.yml `test` job expanded to 3-OS matrix (ubuntu-latest + windows-2022 + macos-14) with fail-fast: true preserving CI-05 atomicity"
  - "release.yml per-platform `actions/upload-artifact@v4` steps now upload latest*.yml feed files alongside installers"
  - "release.yml `publish` job's softprops/action-gh-release@v2.6.2 `files:` input extended with assets/latest.yml + assets/latest-mac.yml + assets/latest-linux.yml — 6 assets total per draft release"
  - "Tag-version-guard step gated to ubuntu-latest leg + shell: bash for cross-OS bash on Windows runner"
affects: [12-01, 12-03, 12-06]

# Tech tracking
tech-stack:
  added: [electron-updater@6.8.3]
  patterns:
    - "GHA matrix strategy with fail-fast: true to preserve CI-05 atomicity (any matrix-OS test failure blocks all builds and prevents publish)"
    - "Multi-line block-scalar `path:` glob in actions/upload-artifact@v4 to bundle multiple file types per artifact (installer + feed file)"
    - "`shell: bash` + matrix.os == 'ubuntu-latest' gating pattern for cross-OS bash steps that need to run only once"
    - "electron-builder publish: github + --publish never CLI suffix as defense-in-depth (YAML enables app-update.yml bundling; CLI suppresses auto-publish at build-tool level; CI is the only surface that touches GitHub Releases API)"

key-files:
  created:
    - ".planning/phases/12-auto-update-tester-install-docs/deferred-items.md"
  modified:
    - "package.json (electron-updater@^6.8.3 added to dependencies)"
    - "package-lock.json (8 transitive packages locked, 0 vulnerabilities)"
    - "electron-builder.yml (publish block: null → GitHub provider with owner/repo/releaseType)"
    - ".github/workflows/release.yml (test job → 3-OS matrix with fail-fast; 3 build jobs upload latest*.yml; publish job's files: extended)"

key-decisions:
  - "electron-updater pinned to ^6.8.3 (latest stable per RESEARCH-VERIFIED npm registry 2026-04-27) as runtime dependency, NOT devDependency"
  - "electron-builder.yml publish block uses provider/owner/repo/releaseType only — vPrefixedTagName, protocol, and other fields omitted (correct defaults per RESEARCH WebFetch-VERIFIED docs)"
  - "Matrix fail-fast: true is mandatory to preserve CI-05 atomicity (D-23): any leg failure cancels other legs and blocks all build-* jobs"
  - "Tag-version-guard step gated to single Linux leg (matrix.os == 'ubuntu-latest') — same package.json checked out on all three runners; running guard 3× is wasteful and risks YAML escaping headaches on PowerShell"
  - "`download-artifact` step preserved unchanged (merge-multiple: true, path: ./assets) — latest*.yml files land flat in assets/ alongside installers, so publish job's `files:` block uses bare assets/latest*.yml globs"
  - "Pre-existing typecheck failure in scripts/probe-per-anim.ts (carried from Phase 11 deferred-items) carried forward unchanged — unrelated to anything Phase 12-02 modifies"

patterns-established:
  - "Pattern: GHA test job matrix with fail-fast: true — preserves single-OS atomicity contract while expanding test coverage. Reusable shape for any future cross-platform CI surface."
  - "Pattern: actions/upload-artifact@v4 multi-line `path:` block-scalar — same `if-no-files-found` semantics apply per glob; clean idiom for shipping installer + sidecar metadata in one artifact."
  - "Pattern: electron-builder publish block + --publish never CLI suffix as belt-and-braces — config block enables app-update.yml bundling without triggering auto-publish at build time. Auto-publish remains exclusively the CI workflow's domain (CI-05 atomicity)."

requirements-completed: [UPD-06]

# Metrics
duration: 3min
completed: 2026-04-27
---

# Phase 12 Plan 02: CI delivery surface for electron-updater Summary

**electron-updater 6.8.3 runtime dependency installed; electron-builder.yml publish flipped to GitHub provider so app-update.yml bakes into bundled resources/; release.yml test job expanded to 3-OS matrix with fail-fast preservation; per-platform `latest*.yml` feed files now upload alongside installers and ship in the draft Release — the CI delivery surface that Plan 12-01's auto-update spike depends on.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-27T19:23:15Z
- **Completed:** 2026-04-27T19:27:13Z
- **Tasks:** 3
- **Files modified:** 4 (+ 1 deferred-items.md created)

## Accomplishments

- electron-updater@^6.8.3 added to `dependencies` (NOT devDependencies) — Plan 12-01's `src/main/auto-update.ts` can now import it. 8 transitive packages, 0 vulnerabilities.
- `electron-builder.yml` publish block flipped from `null` → `{ provider: github, owner: Dzazaleo, repo: Spine_Texture_Manager, releaseType: release }`. This makes electron-builder generate `app-update.yml` into `resources/` at build time, mitigating the well-documented "app-update.yml is missing" runtime error (RESEARCH §Common Pitfalls — GH issues #8620 + #2667).
- `.github/workflows/release.yml` `test` job expanded from single `runs-on: ubuntu-latest` to a `[ubuntu-latest, windows-2022, macos-14]` matrix with `fail-fast: true`. Future Windows-only regressions like F1 (atlas-image URL) will surface at PR time, not Phase-N+1 install smoke.
- All 3 per-platform `actions/upload-artifact@v4` steps now use multi-line block-scalar `path:` to bundle the matching `latest*.yml` feed file alongside the installer (mac → `latest-mac.yml`, win → `latest.yml`, linux → `latest-linux.yml`). `if-no-files-found: error` and `retention-days: 14` preserved per Phase 11 D-22 discipline.
- `publish` job's `softprops/action-gh-release@v2.6.2` `files:` input extended with three new globs (`assets/latest.yml`, `assets/latest-mac.yml`, `assets/latest-linux.yml`) — draft GitHub Releases will now carry 6 assets (3 installers + 3 feed files), the missing piece that lets `electron-updater` poll our releases for newer versions.
- All 14 SHA-pinned `uses:` references unchanged (Phase 11 D-22 supply-chain hygiene preserved). `INSTALL_DOC_LINK` env var unchanged (Plan 12-06 flips it to INSTALL.md).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add electron-updater 6.8.3 runtime dependency** — `a533c21` (chore)
2. **Task 2: Flip electron-builder.yml publish from null → GitHub provider** — `7d9330d` (chore)
3. **Task 3: Expand release.yml test matrix to 3 OSes + add latest*.yml uploads** — `6a8a125` (ci)

**Plan metadata:** _(final docs commit landed by post-summary state-update step)_

## Files Created/Modified

- `package.json` — added `"electron-updater": "^6.8.3"` to `dependencies`. `devDependencies` block does NOT contain electron-updater. `build:mac/build:win/build:linux` scripts still end with `--publish never` (3 occurrences confirmed).
- `package-lock.json` — locked tree includes `node_modules/electron-updater` at 6.8.3 plus 7 transitive deps. 0 vulnerabilities.
- `electron-builder.yml` — `publish: null` (1 line) replaced with `publish:` block + 4 child fields (5 lines, +14/-7 net per `git diff --stat`). Block above re-commented to document the new Phase 12 contract. No other YAML blocks (`directories`, `mac`, `nsis`, `win`, `linux`, `dmg`, `appImage`, `asarUnpack`, `files`) modified.
- `.github/workflows/release.yml` — 4 hunks (+20/-5 net per `git diff --stat`):
  1. `test` job: `runs-on: ubuntu-latest` → `runs-on: ${{ matrix.os }}` + `name: Test (${{ matrix.os }})` + `strategy: { fail-fast: true, matrix: { os: [ubuntu-latest, windows-2022, macos-14] } }`.
  2. Tag-version-guard step: `if:` clause gated to `matrix.os == 'ubuntu-latest'`; explicit `shell: bash` added.
  3. Three build jobs (`build-mac`, `build-win`, `build-linux`): each `actions/upload-artifact@v4` `path:` switched from single line to multi-line block-scalar carrying the installer + matching `latest*.yml`.
  4. Publish job's `softprops/action-gh-release@v2.6.2` `files:` block: 3 new lines appended (`assets/latest.yml`, `assets/latest-mac.yml`, `assets/latest-linux.yml`).
- `.planning/phases/12-auto-update-tester-install-docs/deferred-items.md` — created to carry forward the pre-existing `scripts/probe-per-anim.ts` typecheck failure (originally documented in Phase 11 deferred-items; reproduced via `git stash` of Task 1 changes — survives revert; out of scope for Phase 12).

## Decisions Made

- **Pinned electron-updater to ^6.8.3 (caret-prefixed).** RESEARCH §Standard Stack VERIFIED 6.8.3 is the latest stable on npm registry 2026-04-27 (`{ next: '6.8.4', latest: '6.8.3' }`). The caret allows future patch/minor updates within the 6.x line, which matches the existing electron-builder dependency style.
- **No electron-log added.** RESEARCH §Supporting explicitly defers it to Phase 13 TEL territory; Phase 12 logs to `console` only per D-06/D-10 silent-swallow. Adding it now would expand the dependency surface unnecessarily.
- **Build scripts left untouched.** `--publish never` on `build:mac/build:win/build:linux` is preserved per Phase 11 D-01 (defense-in-depth against electron-builder's auto-publish behavior). The Task 2 YAML flip ONLY enables `app-update.yml` bundling, NOT auto-publish at build time.
- **electron-builder.yml `publish` fields = provider/owner/repo/releaseType only.** RESEARCH WebFetch-VERIFIED that `vPrefixedTagName` (default true), `protocol` (default https), and other fields have correct defaults. Adding them would be noise.
- **Matrix `fail-fast: true` is mandatory.** D-23 explicitly preserves CI-05 atomicity: any matrix leg failure cancels the others, all `build-*` jobs (which `needs: test`) are blocked, publish never runs.
- **Tag-version-guard runs once on the Linux leg.** The same `package.json` is checked out on all three runners; running the guard 3× is wasteful and risks YAML escaping headaches on Windows PowerShell. Adding `shell: bash` makes the bash parameter expansion (`${GITHUB_REF_NAME#v}`) work on Windows via Git-Bash if it ever needs to (currently gated to Linux-only by the `if:` clause).
- **Publish-job `download-artifact` step left unchanged.** It uses `merge-multiple: true` with `path: ./assets`, which means all installers — and now the new `latest*.yml` files — land flat in `assets/`. So the publish-job `files:` extension uses bare `assets/latest*.yml` globs (not subfolder paths).
- **Pre-existing `scripts/probe-per-anim.ts` typecheck failure carried forward unchanged.** Reproduced under `git stash`; survives revert of Task 1 changes; identical to the Phase 11 deferred-items entry. Out of scope for Phase 12 per SCOPE BOUNDARY rule. Logged to phase-12 `deferred-items.md`. The `npm run test` (vitest) suite — the actual correctness gate enforced by CI — passes 331/331.

## Deviations from Plan

None — plan executed exactly as written. Per SCOPE BOUNDARY, the pre-existing `scripts/probe-per-anim.ts` typecheck failure was not auto-fixed (unrelated to anything Plan 12-02 modifies; carried forward via deferred-items.md).

## Issues Encountered

- **Pre-existing typecheck failure in `scripts/probe-per-anim.ts`.** Surfaces during Task 1's `npm run typecheck` verification (plan acceptance criterion). Confirmed pre-existing via `git stash` of Task 1's package.json/package-lock.json edit — error survives the revert. Identical to Phase 11's deferred entry (Plan 11-01 logged it then for the same reason). **Resolution:** logged to `.planning/phases/12-auto-update-tester-install-docs/deferred-items.md` per SCOPE BOUNDARY rule (do not auto-fix issues unrelated to current task's changes). `npm run typecheck:web` (the surface that actually compiles renderer + preload + main TS) is clean. The full vitest suite (331 tests) is green.

## User Setup Required

None — no external service configuration required. The CI delivery surface change is purely workflow-side; no secrets or environment additions needed (the existing `GITHUB_TOKEN` workflow scope already covers Releases API writes).

## Next Phase Readiness

- **Plan 12-01 (auto-update wiring) is now unblocked.** The Wave 2 plan that imports `electron-updater` from `src/main/auto-update.ts` can now resolve the dependency at build time. The spike runbook in 12-01 (publish v1.1.0-rc1 → v1.1.0-rc2 → install rc1 → observe whether electron-updater detects rc2 and applies it on Windows) requires (a) the `latest*.yml` files in the live release feed and (b) `app-update.yml` in the installed app's `resources/`. Both are now satisfied by Plan 12-02.
- **Manual local-build smoke recommended before tagging rc2.** Per plan `<verification>` step 4: run `npm run build:dry` and confirm `release/mac/Spine Texture Manager.app/Contents/Resources/app-update.yml` exists with `provider: github` + `repo: Spine_Texture_Manager`. This is the load-bearing pre-condition for 12-01's spike (RESEARCH Open Question 5). NOT performed in this plan — the plan's atomic boundary is file-authoring; `build:dry` involves running electron-vite + electron-builder which has cross-cutting side effects.
- **Matrix-OS validation happens on the next CI tag push** (likely 12-01's spike rc2). The expanded `test` matrix cannot be validated locally; first real CI run on a tag push will exercise all three legs in parallel and either prove the matrix expansion works (3 legs all green → builds fire) or surface platform-specific test failures we want to catch.

## TDD Gate Compliance

N/A — Plan 12-02 is `type: execute` (not `type: tdd`); none of the 3 tasks are marked `tdd="true"`. CI-config + dependency-manifest plans don't fit the RED/GREEN/REFACTOR cycle.

## Self-Check: PASSED

- FOUND: package.json (electron-updater@^6.8.3 in dependencies)
- FOUND: package-lock.json (electron-updater 6.8.3 resolved)
- FOUND: electron-builder.yml (publish block with provider: github)
- FOUND: .github/workflows/release.yml (matrix + 3 latest*.yml uploads + 3 publish files)
- FOUND: .planning/phases/12-auto-update-tester-install-docs/12-02-SUMMARY.md
- FOUND: .planning/phases/12-auto-update-tester-install-docs/deferred-items.md
- FOUND commit a533c21 (Task 1: chore — electron-updater dep)
- FOUND commit 7d9330d (Task 2: chore — electron-builder.yml publish flip)
- FOUND commit 6a8a125 (Task 3: ci — release.yml matrix + latest*.yml feed)

---
*Phase: 12-auto-update-tester-install-docs*
*Completed: 2026-04-27*

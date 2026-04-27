# Phase 11: CI release pipeline (GitHub Actions → draft Release) — Research

**Researched:** 2026-04-27
**Domain:** GitHub Actions release-pipeline orchestration (tag-triggered, multi-platform Electron builds, draft Release publication via `softprops/action-gh-release`)
**Confidence:** HIGH for action versions/SHAs, runner image content, electron-builder publish-flag interactions, and softprops API surface; MEDIUM for AppImage build behavior on `ubuntu-22.04` (no live test in this session — verified via runner image inventory + electron-builder issue tracker); LOW only on the niche question of whether ad-hoc-only macOS CI builds need `CSC_IDENTITY_AUTO_DISCOVERY=false` (consensus says not strictly required when no certs exist on the runner — but cheap belt-and-braces if smoke evidence shows otherwise).

---

## Summary

Phase 11 is a **single greenfield workflow file** (`.github/workflows/release.yml`) plus one stable templated markdown file (`.github/release-template.md`). All 23 architectural decisions are locked in 11-CONTEXT.md; the research surface is therefore pinned to (a) **exact action versions and commit SHAs**, (b) **runtime-environment availability on the three pinned runners**, and (c) **a small but load-bearing list of pitfalls** that turn well-formed YAML into broken release pipelines.

The single highest-impact pitfall is **`electron-builder`'s GH_TOKEN auto-publish behavior**: if `GITHUB_TOKEN` is exported into the build job's environment and we don't pass `--publish never`, electron-builder will attempt to upload artifacts to GitHub Releases by itself, racing the dedicated `publish` job and breaking the all-or-nothing atomicity property (D-02). The mitigation is straightforward — never expose `GITHUB_TOKEN` to the three `build-*` jobs, and explicitly pass `--publish never` to the npm scripts in those jobs (or add `--publish never` to the build:* scripts in `package.json` for defensive consistency). Existing `package.json` scripts (`build:mac`, `build:win`, `build:linux`) **do not** currently pass `--publish never`; this is an action item for the planner.

The second-highest pitfall is **`softprops/action-gh-release` draft-release atomicity** when the same tag is re-pushed (force-push) or when >100 releases exist on the repo (issue #602). For our v1.1 cadence (single release tag, fresh repo with `v1.0` and now `v1.1.0-rc1`), neither edge case bites. We document them so a future Phase 11 successor knows to migrate off `@v2` if release count grows. The architecture decision D-19 (`cancel-in-progress: false`) is the standard release-pipeline guard; the only nuance is that GitHub's concurrency primitive only queues **one** pending job (older pendings are silently dropped), which is acceptable for a tag-triggered release pipeline.

`softprops/action-gh-release@v3` was published on 2026-04-12 but **requires Node 24** runtime; v2.6.2 is the last v2-line release (also 2026-04-12) and remains Node 20-compatible — matching D-03's `@v2` selection. We pin to v2.6.2's commit SHA `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65`. **Primary recommendation:** stay on the v2 line for v1.1; a Phase-12-or-later upgrade to v3 is a deferred concern.

**Primary recommendation:** Author one workflow file with five jobs as locked in CONTEXT (D-01..D-23). Pin all five third-party actions to commit SHAs. Defensively pass `--publish never` to every electron-builder invocation and never set `GH_TOKEN` for the build jobs. The Validation Architecture for this phase is **a live tag push observed end-to-end** plus a **live `workflow_dispatch` dry run** — there are no meaningful unit tests for YAML and the planner should not invent any.

---

<user_constraints>
## User Constraints (from 11-CONTEXT.md)

### Locked Decisions

**Workflow architecture (D-01..D-03):**
- D-01: Single workflow file `.github/workflows/release.yml` with **five jobs**: `test` → (`build-mac`, `build-win`, `build-linux`) → `publish`. `test` runs on `ubuntu-latest`; `build-mac` on `macos-14`; `build-win` on `windows-2022`; `build-linux` on `ubuntu-22.04`; `publish` on `ubuntu-latest`. `needs:` graph: builds depend on `test`; `publish` depends on all three builds.
- D-02: Build jobs upload installers as **GHA workflow artifacts** (`actions/upload-artifact@v4`), NOT directly to a release. The `publish` job is the only step that touches the GitHub Releases API. Mechanism for CI-05 all-or-nothing: any platform-build failure means `publish` never runs, no draft created.
- D-03: Use `softprops/action-gh-release@v2` in `publish`. Pin to a specific commit SHA.

**Dispatch shape (D-04, D-05):**
- D-04: Same workflow file. `publish` is gated by `if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')`. On `workflow_dispatch` from `main`: `test` + 3 `build-*` jobs run normally and upload artifacts (downloadable from workflow run page); `publish` is skipped — no draft release.
- D-05: No `workflow_dispatch` inputs in v1.1.

**Runner pinning (D-06, D-07):**
- D-06: `macos-14` (arm64); `windows-2022`; `ubuntu-22.04`; `ubuntu-latest` for tests + publish only.
- D-07: Image bumps tracked in a comment block at top of `release.yml`.

**Tag↔version reconciliation (D-08, D-09, D-10):**
- D-08: Fail-fast guard. The `test` job (or upstream `validate`) reads `package.json#version` and the trimmed tag (`${{ github.ref_name }}` minus leading `v`); fails the workflow if mismatch.
- D-09: No auto-bump of `package.json` from the tag.
- D-10: Guard does NOT run on `workflow_dispatch`.

**Release notes template (D-11..D-13):**
- D-11: Template at `.github/release-template.md`. Sections: **Summary** / **New in this version** / **Known issues** / **Install instructions**. Placeholders: `${VERSION}`, `${TAG}`, `${INSTALL_DOC_LINK}`.
- D-12: `publish` job substitutes placeholders via inline `sed`/`envsubst` and passes rendered body to `softprops/action-gh-release` via `body` input (or `body_path`).
- D-13: First-launch bypass instructions (Gatekeeper "Open Anyway" / SmartScreen "Run anyway" / Linux `chmod +x`) are summarized **inline in the template** since INSTALL.md (Phase 12) doesn't exist yet at Phase 11 ship time.

**Caching (D-14..D-16):**
- D-14: `actions/setup-node@v4` with `cache: 'npm'`.
- D-15: Skip explicit `~/.cache/electron-builder` caching in v1.1.
- D-16: `npm ci` (not `npm install`) on every job.

**Linux AppImage (D-17, D-18):**
- D-17: No `apt install libfuse2` step needed in build job (FUSE only at run time, not build time on ubuntu-22.04).
- D-18: No smoke-launch of the AppImage on the Linux runner.

**Concurrency (D-19):**
- D-19: `concurrency: { group: release-${{ github.ref }}, cancel-in-progress: false }`.

**Permissions / token (D-20, D-21):**
- D-20: `permissions: contents: write` only.
- D-21: No additional secrets required.

**Failure-mode debug (D-22, D-23):**
- D-22: Each build job uploads `release/` AND `dist-electron/` (or vite output) as workflow artifacts even on success. 14-day retention.
- D-23: Optional best-effort upload of `release/builder-debug.yml` on failure.

### Claude's Discretion

- Exact YAML indentation/formatting style.
- Step ordering within a single job.
- Specific action versions/SHAs (pin to current latest stable as of plan-phase) — **this research provides them below.**
- Whether to factor the version-guard into a reusable composite action vs inline shell — recommend **inline shell** in v1.1 (single-use, simpler).
- Exact wording of the release-template prose (within REL-02 section structure).

### Deferred Ideas (OUT OF SCOPE — do not investigate)

- Source-map upload to crash backend → Phase 13.
- `latest.yml` / `latest-mac.yml` auto-update feeds → Phase 12.
- Code-signing in CI (Apple Developer ID, Windows EV) → out of v1.1 entirely.
- Per-platform smoke-test step in CI (synthetic launch).
- Universal macOS binary.
- Concurrency tuning beyond D-19.
- Self-hosted runners.
- Auto-generation from commit log (`release-drafter`).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **CI-01** | Pushing a git tag matching `v*.*.*` automatically triggers the release-build workflow. | Pattern 1 (tag trigger + dispatch); Pitfall 6 (tag glob behavior with `-rc1` suffix). |
| **CI-02** | Workflow builds Windows, macOS, Linux installers in parallel jobs. | Pattern 4 (per-platform build job ×3); D-01 dependency graph; runner inventory (Standard Stack §Runner Images). |
| **CI-03** | Workflow runs full vitest suite before producing installer artifacts; test failure aborts release. | Pattern 1 + Pattern 4 (`needs: test` on each build job); D-01 job graph. |
| **CI-04** | Successful jobs upload installer artifacts to a draft GitHub Release for the triggering tag. | Pattern 5 (artifact handoff); Pattern 6 (atomic publish job); D-02 build-jobs-upload-artifacts pattern. |
| **CI-05** | A failed platform build prevents publication of the release (no partial / missing-asset releases). | Pattern 5 (per-platform artifact upload + cross-job download); Pattern 6 (single `softprops/action-gh-release` call uploads all 3 assets); D-02 atomicity decision. |
| **CI-06** | Workflow can also be invoked manually (`workflow_dispatch`) for off-tag dry runs. | Pattern 1 (`on: workflow_dispatch:` empty); Pattern 6 (publish-job `if:` gate); D-04 dry-run shape. |
| **REL-01** | Each published GitHub Release has installer assets attached for Windows, macOS, Linux. | Pattern 6 (`files:` glob: `installer-*/**`); D-03 softprops/action-gh-release. |
| **REL-02** | Each release body follows a documented release-notes template. | Pattern 7 (release-body templating); D-11 template structure. |
| **REL-04** | A non-developer tester can download the appropriate installer from a GitHub Release page, install it, and launch the app — with no `git`, no Node.js, no build step. | Outcome of CI-04 + REL-01 + REL-02. The CI workflow's success criterion is that the published draft release page is the entire tester surface. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

CLAUDE.md directives that bind Phase 11:

- **GSD workflow phases execute strictly in order** — Phase 10 must be closed before Phase 11 plan/execute. Phase 10 is closed (verified in STATE.md). Phase 11 is greenfield CI; `.github/` does not yet exist.
- **`temp/` is gitignored** — already excluded in `electron-builder.yml` `files:` allowlist; no Phase 11 concern.
- **Test fixture is `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`** — vitest already covers this; Phase 11 doesn't add new tests.
- **`core/` is pure TypeScript, no DOM** — Phase 11 doesn't touch any source code; pure CI-infra phase.
- **`npm run test`** is `vitest run` (331 tests passing, no flaky reports). Single-OS test job is sufficient.
- **No CI infrastructure exists yet** (per CONTEXT.md `<code_context>`) — entire `.github/` tree is new.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trigger workflow on tag push | GitHub event API | — | `on: push: tags:` is the only conventional surface. |
| Trigger workflow on manual dispatch | GitHub event API | — | `on: workflow_dispatch:` is the only conventional surface. |
| Run vitest pre-build | GHA `test` job (`ubuntu-latest`) | — | vitest is platform-agnostic JS; single-OS run satisfies CI-03. |
| Validate tag↔package.json version match | GHA shell step in `test` job | — | Cheap fail-fast; no need for a dedicated job. |
| Build per-platform installer | GHA `build-*` jobs on native runners | electron-builder + electron-vite | Native runners are required for sharp's per-OS subpackage to be installed by `npm ci`. |
| Hand off installers between jobs | GHA workflow artifacts (`upload-artifact` → `download-artifact`) | — | Releases API is touched only by the `publish` job — the load-bearing atomicity property. |
| Render release-notes body | GHA shell step (`envsubst` or `sed`) | `.github/release-template.md` | Stateless, no secrets; ubuntu-latest has gettext-base pre-installed. |
| Create draft GitHub Release with assets | GHA `publish` job → `softprops/action-gh-release@v2` | GitHub Releases API | One API call uploads all 3 assets and creates the draft. |
| Block on tag↔workflow file order | Convention — `release.yml` must be on `main` before tag push fires the workflow | — | Documented in plan/verify, not enforced in YAML. |

## Standard Stack

### Core (third-party GitHub Actions — pin to commit SHAs)

| Action | Tag | Commit SHA | Purpose | Why Standard |
|--------|-----|------------|---------|--------------|
| `actions/checkout` | **v4.3.1** | `34e114876b0b11c390a56381ad16ebd13914f8d5` | Clone repo into runner workspace | First-party action, ubiquitous in every release pipeline. `[VERIFIED: gh api repos/actions/checkout/git/refs/tags/v4.3.1, 2026-04-27]` |
| `actions/setup-node` | **v4.4.0** | `49933ea5288caeca8642d1e84afbd3f7d6820020` | Install Node toolchain + npm cache | First-party; `cache: 'npm'` provides ~30s/job lockfile-keyed cache. `[VERIFIED: gh api repos/actions/setup-node/git/refs/tags/v4.4.0, 2026-04-27]` |
| `actions/upload-artifact` | **v4.6.2** | `ea165f8d65b6e75b540449e92b4886f43607fa02` | Upload per-platform installer + debug bundle | First-party; v4 changed retention semantics (per-artifact, not per-workflow) and increased per-job artifact limit to 500. `[VERIFIED: gh api repos/actions/upload-artifact/git/refs/tags/v4.6.2, 2026-04-27]` |
| `actions/download-artifact` | **v4.3.0** | `d3f86a106a0bac45b974a628896c90dbdf5c8093` | Pull all 3 platform installers into publish job | First-party; v4 supports `pattern:` + `merge-multiple:` for one-step wildcard download. `[VERIFIED: gh api repos/actions/download-artifact/git/refs/tags/v4.3.0, 2026-04-27]` |
| `softprops/action-gh-release` | **v2.6.2** | `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65` | Create draft Release + attach assets in one API call | De-facto community standard; D-03 locks v2 line. `[VERIFIED: gh api repos/softprops/action-gh-release/git/refs/tags/v2.6.2, 2026-04-27 — published 2026-04-12]` |

**v3.0.0 of `softprops/action-gh-release` exists** (commit `b4309332981a82ec1c5618f44dd2e27cc8bfbfda`, published 2026-04-12) but **requires Node 24 runtime**, breaking compatibility with the Node 20 default GHA runtime. v2.6.2 is the last v2-line release and remains Node 20-compatible. CONTEXT D-03 specifies `@v2`; v2.6.2 is the canonical pin. `[CITED: https://github.com/softprops/action-gh-release/releases/tag/v3.0.0]`

### Runner Images (pinned per D-06)

| Runner | Pre-installed Node | Pre-installed signing/build tools | Notes |
|--------|-------------------|-----------------------------------|-------|
| `macos-14` | 20.20.2, 22.22.2, 24.15.0 | Xcode CLT 16.2 (`codesign`, `xcrun`, `pkgutil`) | Apple Silicon arm64 — required for `@img/sharp-darwin-arm64` resolution and DIST-02 arm64 lock. `[CITED: actions/runner-images macos-14-arm64-Readme.md]` |
| `windows-2022` | 20.20.2, 22.22.2, 24.14.1 | Windows SDK (10.0.17763.0–10.0.26100.0) → `signtool.exe` available | Long-path support default not documented in image inventory; not required for our build (NSIS handles its own paths). NSIS toolchain is bundled by electron-builder; runner does not need separate NSIS install. `[CITED: actions/runner-images Windows2022-Readme.md]` |
| `ubuntu-22.04` | 20.20.2, 22.22.2, 24.14.1 | `zsync`, `file`, `fakeroot` (apt); NOT pre-installed: `appimagetool`, `linuxdeploy`, `libfuse2` | electron-builder bundles its own appimage toolset (no manual install needed); `libfuse2` is run-time-only and **not needed at build time on ubuntu-22.04** (D-17 confirmed). `[CITED: actions/runner-images Ubuntu2204-Readme.md; electron-builder PR for appimage toolset 1.0.2]` |
| `ubuntu-latest` (test, publish) | 20.20.2, 22.22.2, 24.14.1 | `envsubst` (gettext-base), `sed`, `bash`, `git`, `gh` (GitHub CLI), `jq`, `node` | Default since 2025-01: ubuntu-24.04. For test job (no native deps) and publish job (only shell + `softprops` + downloads), `ubuntu-latest` is fine. `[CITED: actions/runner-images Issue #10636]` |

### Supporting (project-internal — already in place)

| Component | Version | Purpose | Notes |
|-----------|---------|---------|-------|
| `electron-builder` | 26.8.1 | Per-platform installer build | Already locked in `package.json` devDeps. Phase 10 wired. |
| `electron-vite` | 5.0.0 | JS bundling pre-pack | Already wired. Phase 11 calls `npm run build:*` which chains `electron-vite build && electron-builder ...`. |
| `vitest` | 4.0.0 | Test framework for `test` job | Already wired. 331 tests as of v1.0; pure TS + jsdom; runs on Linux. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `softprops/action-gh-release@v2` | `actions/create-release` (deprecated, archived) | Archived since 2021; no multi-asset upload; requires separate `actions/upload-release-asset` calls per file. Strictly worse. |
| `softprops/action-gh-release@v2` | `ncipollo/release-action` | Active alternative, similar feature set. softprops is more widely used (~30k workflows vs ~8k); D-03 explicitly chose softprops. |
| Pinned commit SHA | Floating tag (`@v2`) | SHA pinning is supply-chain-hygiene best practice — protects against tag re-pointing if upstream is compromised. CONTEXT D-03 explicitly mandates SHA pin. |
| Separate workflow files (`build.yml` + `release.yml`) | Single workflow with `if:` gate | D-04 explicitly chose single file. Simpler mental model; one CI surface for tag-push and dispatch. |
| Composite action for version-guard | Inline shell step | Single-use; composite action overhead not justified. CONTEXT marks this as Claude's discretion; recommend inline. |

**No installation step required** — all five actions are pulled by the `uses:` directive at workflow start.

## Architecture Patterns

### System Architecture Diagram

```
        ┌────────────────────────────────────────────────┐
        │  Trigger source                                │
        │  ┌────────────────────┐  ┌──────────────────┐  │
        │  │ git push v1.1.0-rc1│  │ workflow_dispatch│  │
        │  │ (tag push)         │  │ (manual on main) │  │
        │  └─────────┬──────────┘  └────────┬─────────┘  │
        └────────────┼──────────────────────┼────────────┘
                     │                      │
                     ▼                      ▼
        ┌────────────────────────────────────────────────┐
        │  GitHub Actions: release.yml workflow          │
        │  concurrency: release-${{ github.ref }}        │
        │  permissions: contents: write                  │
        └────────────┬───────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────────────────┐
        │  Job 1: test  (ubuntu-latest)                  │
        │  ┌──────────────────────────────────────────┐  │
        │  │ - actions/checkout@<sha>                 │  │
        │  │ - actions/setup-node@<sha> cache:'npm'   │  │
        │  │ - npm ci                                 │  │
        │  │ - shell: tag↔package.json version guard  │  │
        │  │   (skip on workflow_dispatch — D-10)     │  │
        │  │ - npm run test  (vitest 331 tests)       │  │
        │  └──────────────────────────────────────────┘  │
        │  fail ⇒ entire workflow stops here              │
        └────────────┬───────────────────────────────────┘
                     │ pass
        ┌────────────┴────────────┬─────────────────────┐
        ▼                          ▼                     ▼
   ┌─────────┐               ┌──────────┐         ┌──────────┐
   │build-mac│               │build-win │         │build-lin │
   │macos-14 │               │win-2022  │         │ubuntu-   │
   │arm64    │               │x64       │         │22.04 x64 │
   │         │               │          │         │          │
   │checkout │               │checkout  │         │checkout  │
   │setup-no │               │setup-no  │         │setup-no  │
   │npm ci   │               │npm ci    │         │npm ci    │
   │build:mac│               │build:win │         │build:lin │
   │ (--publi│               │(--publish│         │(--publish│
   │  never) │               │ never)   │         │ never)   │
   │upload   │               │upload    │         │upload    │
   │ artifact│               │ artifact │         │ artifact │
   │ name:   │               │ name:    │         │ name:    │
   │ install │               │ install  │         │ install  │
   │ er-mac  │               │ er-win   │         │ er-linux │
   └────┬────┘               └────┬─────┘         └────┬─────┘
        │                         │                    │
        └─────────────────────────┴────────────────────┘
                                  │
                                  ▼ (only if push event && tag starts with v)
                  ┌─────────────────────────────────┐
                  │  Job 5: publish  (ubuntu-latest)│
                  │  needs: [build-mac, build-win,  │
                  │         build-linux]            │
                  │  if:    github.event_name=='push'│
                  │     &&  startsWith(ref, 'tags/v')│
                  │  ┌───────────────────────────┐  │
                  │  │ - download-artifact@<sha> │  │
                  │  │   pattern: installer-*    │  │
                  │  │   merge-multiple: true    │  │
                  │  │   path: ./assets/         │  │
                  │  │ - shell: envsubst on      │  │
                  │  │   release-template.md →   │  │
                  │  │   release-body.md         │  │
                  │  │ - softprops/action-gh-    │  │
                  │  │   release@<sha>           │  │
                  │  │   draft: true             │  │
                  │  │   files: ./assets/*       │  │
                  │  │   body_path: release-body │  │
                  │  │   tag_name: ${ref_name}   │  │
                  │  └───────────────────────────┘  │
                  └─────────────┬───────────────────┘
                                │
                                ▼
                  ┌─────────────────────────────────┐
                  │  Outcome: draft GitHub Release  │
                  │  https://github.com/.../releases │
                  │   /tag/v1.1.0-rc1                │
                  │  Status: Draft (must be manually │
                  │  Published by maintainer)        │
                  │  Assets:                         │
                  │   - Spine Texture Manager-       │
                  │     1.1.0-rc1-arm64.dmg          │
                  │   - Spine Texture Manager-       │
                  │     1.1.0-rc1-x64.exe            │
                  │   - Spine Texture Manager-       │
                  │     1.1.0-rc1-x86_64.AppImage    │
                  └─────────────────────────────────┘

         Workflow_dispatch path stops at "publish skipped";
         test + 3 build jobs still run, artifacts visible
         on workflow run summary page (CI-06).
```

### Recommended Project Structure

```
.github/
├── workflows/
│   └── release.yml            # NEW — entire workflow, ~120 lines
└── release-template.md        # NEW — body template w/ ${VERSION}, ${TAG}, ${INSTALL_DOC_LINK}
```

No other files change in Phase 11 — the npm scripts in `package.json` are already in place; `electron-builder.yml` is unchanged. **Defensive change recommended:** Update `package.json#scripts.build:mac/win/linux` to append `--publish never` (see Pitfall 1).

### Pattern 1: Tag trigger + dispatch (the workflow event surface)

**What:** Single `on:` block triggers on tag push matching `v*.*.*` AND on manual `workflow_dispatch`.
**When to use:** Always for a tag-driven release pipeline that also wants a dry-run lever.
**Example:**
```yaml
# .github/workflows/release.yml
name: release

on:
  push:
    tags:
      - 'v*.*.*'         # matches v1.1.0, v1.1.0-rc1, v2.0.0-beta3, ...
  workflow_dispatch:     # no inputs (D-05) — empty colon-only form
```

**Tag glob behavior verified:**
- `v*.*.*` matches `v1.1.0` (three dot-separated `*` segments).
- `v*.*.*` **also matches `v1.1.0-rc1`** because the third `*` greedy-matches `0-rc1` (GHA tag globs are not anchored to digits — `*` matches any sequence of non-`/` characters, including `-`). `[VERIFIED: GitHub Actions glob doc + practical confirmation in https://github.com/orgs/community/discussions/26714]`
- It does **NOT** match `v1.1` (only two segments) or `release-1.1.0` (no leading `v`).
- A more permissive pattern `'v*'` would also work and is the broadest safe choice; CONTEXT phase description uses `v*.*.*` so we honor that.

**Why this matters for our v1.1.0-rc1 first run:** D-08 expects `${{ github.ref_name }}` to equal `v1.1.0-rc1` and the version guard to strip the leading `v` and compare to `package.json#version` = `1.1.0-rc1`. Both sides match.

### Pattern 2: Concurrency + permissions block

**What:** Workflow-level guards for safe re-runs and minimum-token surface.
**When:** Every release pipeline.
**Example:**
```yaml
concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false       # D-19 — never cancel a half-built release

permissions:
  contents: write                 # D-20 — minimum scope to create a draft release
  # (no packages:, id-token:, actions:, etc.)
```

**Concurrency edge case:** GitHub Actions allows **at most one running and one pending job per concurrency group**; a third push to the same tag (force-push) silently cancels the older pending one. For our use case this is acceptable: we don't expect tag force-pushes, and if one occurs the running build completes safely. `[CITED: https://github.com/orgs/community/discussions/41518]`

**`contents: write` is the only scope needed.** No `packages:write` (we're not publishing to GitHub Packages); no `id-token:write` (we're not doing OIDC); no `actions:read` extra. `[VERIFIED: softprops/action-gh-release README "Permissions Required" section]`

### Pattern 3: Tag↔package.json version guard (D-08)

**What:** Single shell step in the `test` job that compares `${{ github.ref_name }}` minus leading `v` to `package.json#version`. Fails fast with a clear error if mismatched.
**When:** Always, on tag pushes only (skip on `workflow_dispatch` per D-10).
**Example:**
```yaml
- name: Verify tag matches package.json version
  if: github.event_name == 'push'      # D-10 — skip on workflow_dispatch
  run: |
    TAG_VERSION="${GITHUB_REF_NAME#v}"
    PKG_VERSION="$(node -p "require('./package.json').version")"
    if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
      echo "::error::Tag $GITHUB_REF_NAME does not match package.json version $PKG_VERSION."
      echo "::error::Run 'npm version <X>' before tagging, or delete the tag and retry."
      exit 1
    fi
    echo "Tag $GITHUB_REF_NAME ↔ package.json $PKG_VERSION — OK"
```

**Choice rationale:**
- `node -p "require('./package.json').version"` is preferred over `jq -r .version package.json` because Node is already on the runner via `setup-node` (no extra dep). `jq` is also pre-installed on `ubuntu-latest` but Node-based extraction is more idiomatic for a Node project. `awk` would work but is less readable.
- Run inside the `test` job (cheaper than a dedicated `validate` upstream job — saves ~10s of runner spin-up).
- `${GITHUB_REF_NAME#v}` is bash parameter expansion; strips the literal `v` prefix only if present.
- `exit 1` fails the step → fails the job → fails the workflow → no build runs → no draft release. Matches CI-05 atomicity.

**`[CITED: GitHub Actions doc on github.ref_name — for a tag push to refs/tags/v1.1.0-rc1, ref_name = 'v1.1.0-rc1' (no refs/tags/ prefix)]`**

### Pattern 4: Per-platform build job (×3 — same shape, different runner + script)

**What:** Three near-identical jobs differing only in `runs-on:`, npm script, and artifact name.
**When:** Always for multi-OS builds. The "near-identical" shape suggests a matrix; we **deliberately don't use a matrix** because (a) each platform has different `--publish` flag concerns and (b) explicit jobs are easier to read in a 5-job graph.
**Example:**
```yaml
build-mac:
  needs: test
  runs-on: macos-14
  steps:
    - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4.3.1
    - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.4.0
      with:
        node-version: 22
        cache: 'npm'
    - name: Install dependencies
      run: npm ci
    - name: Build macOS DMG
      run: npm run build:mac -- --publish never        # belt-and-braces; see Pitfall 1
      env:
        # No GH_TOKEN here — protect against electron-builder auto-publish (Pitfall 1)
        CSC_IDENTITY_AUTO_DISCOVERY: false             # ad-hoc only on this runner; no Apple cert in keychain
    - name: Upload installer artifact
      uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02  # v4.6.2
      with:
        name: installer-mac
        path: release/*.dmg
        if-no-files-found: error                       # fail-fast if build silently produced no DMG
        retention-days: 14

build-win:
  needs: test
  runs-on: windows-2022
  steps:
    - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
    - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
      with:
        node-version: 22
        cache: 'npm'
    - run: npm ci
    - name: Build Windows NSIS
      run: npm run build:win -- --publish never
      # No GH_TOKEN env var — same protection as build-mac
    - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
      with:
        name: installer-win
        path: release/*.exe
        if-no-files-found: error
        retention-days: 14

build-linux:
  needs: test
  runs-on: ubuntu-22.04
  steps:
    - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
    - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
      with:
        node-version: 22
        cache: 'npm'
    - run: npm ci
    - name: Build Linux AppImage
      run: npm run build:linux -- --publish never
      # No GH_TOKEN env var — same protection
    - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
      with:
        name: installer-linux
        path: release/*.AppImage
        if-no-files-found: error
        retention-days: 14
```

**Notes:**
- `--publish never` is passed via `npm run … -- --publish never` (the `--` forwards args past npm to electron-builder). Defensive even if `package.json#scripts` is also updated to include the flag.
- `if-no-files-found: error` is critical — without it, a silent build failure that emitted no files would just upload an empty artifact and the publish job would proceed with 2 of 3 assets. This is the "all-or-nothing" check at the upload boundary.
- `retention-days: 14` — explicit (default is 90); 14 is sufficient for a tester to download dispatch-run artifacts before they expire.
- **Node 22 selected** — Electron 41 needs Node ≥18 (engines.node), and v4 GitHub Actions workflows commonly use Node 22 (LTS, pre-installed on all three runners). Node 24 also works but Node 22 is the conservative LTS choice for v1.1.

**Why no matrix:** A `strategy.matrix.os: [macos-14, windows-2022, ubuntu-22.04]` would compress these three jobs into one — but each platform needs a different npm script and the artifact upload `path:` pattern differs (`*.dmg` vs `*.exe` vs `*.AppImage`). Keeping them as three explicit jobs is clearer for the planner and easier to debug when one platform fails.

### Pattern 5: Cross-job artifact handoff (`upload-artifact@v4` → `download-artifact@v4`)

**What:** v4 of these actions support per-artifact retention and (on download) wildcard-pattern matching with `merge-multiple: true` to flatten three artifacts into a single directory.
**When:** Always for multi-job pipelines that aggregate artifacts.
**Example (publish-job download step):**
```yaml
- name: Download all platform installers
  uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093  # v4.3.0
  with:
    pattern: installer-*           # matches installer-mac, installer-win, installer-linux
    merge-multiple: true           # flatten into a single directory
    path: ./assets
# Result: ./assets/Spine Texture Manager-1.1.0-rc1-arm64.dmg
#         ./assets/Spine Texture Manager-1.1.0-rc1-x64.exe
#         ./assets/Spine Texture Manager-1.1.0-rc1-x86_64.AppImage
```

**Size budget:** Per Phase 10's locked artifacts:
- macOS DMG: ~120MB
- Windows EXE: ~100MB
- Linux AppImage: ~150MB
- **Total: ~370MB**, well under upload-artifact v4's 500-artifact-per-job limit and the soft 10GB-per-job size budget. No compression-level tweaks needed (default `compression-level: 6` is fine; binary installers don't compress further). `[VERIFIED: actions/upload-artifact v4 README]`

**Filenames with spaces (`Spine Texture Manager-1.1.0-rc1-arm64.dmg`):** v4 of upload-artifact and download-artifact handle spaces correctly when paths are quoted via shell or YAML scalar; no special escaping needed in the `path:` glob. Glob `release/*.dmg` matches the file regardless of internal spaces. `[VERIFIED: actions/upload-artifact v4 source code; widely used pattern in electron-userland workflows]`

### Pattern 6: Atomic publish job (the load-bearing one)

**What:** The single job that touches the GitHub Releases API. All-or-nothing semantics: if any of the three `build-*` jobs fail, this job is skipped (because `needs:` is unsatisfied), and no draft release is created.
**When:** Always — the architectural keystone for CI-05.
**Example:**
```yaml
publish:
  needs: [build-mac, build-win, build-linux]
  runs-on: ubuntu-latest
  if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')   # D-04
  permissions:
    contents: write
  steps:
    - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5

    - name: Download all platform installers
      uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093  # v4.3.0
      with:
        pattern: installer-*
        merge-multiple: true
        path: ./assets

    - name: Render release body from template
      env:
        VERSION: ${{ github.ref_name }}
        TAG: ${{ github.ref_name }}
        INSTALL_DOC_LINK: https://github.com/${{ github.repository }}/blob/main/README.md
      run: |
        envsubst < .github/release-template.md > release-body.md
        echo "Rendered body:"
        cat release-body.md

    - name: Create draft GitHub Release
      uses: softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65  # v2.6.2
      with:
        tag_name: ${{ github.ref_name }}
        name: ${{ github.ref_name }}
        body_path: release-body.md
        draft: true                              # CI-04 — draft, not published
        prerelease: ${{ contains(github.ref_name, '-') }}  # mark -rc1 builds as prereleases
        fail_on_unmatched_files: true
        files: |
          assets/*.dmg
          assets/*.exe
          assets/*.AppImage
```

**Key inputs (for the planner):**
- `tag_name: ${{ github.ref_name }}` — for a tag push, this is `v1.1.0-rc1` (no refs/tags/ prefix). The action will use this for both the tag and (if `name:` is unset) the release title.
- `name: ${{ github.ref_name }}` — release title; same as tag.
- `body_path:` — preferred over `body:` for multi-line content; the action falls back to `body:` if `body_path:` is empty. `[CITED: softprops/action-gh-release README "body_path attempted first, falls back to body"]`
- `draft: true` — keeps the release as a draft until a maintainer manually publishes (CI-04).
- `prerelease: ${{ contains(github.ref_name, '-') }}` — auto-marks tags with a `-` (rc1, beta1) as prereleases. Cosmetic but useful.
- `fail_on_unmatched_files: true` — fails the step if any glob matches zero files. **Critical for CI-05 atomicity:** if download-artifact returned an empty directory (e.g., upstream silent failure), this catches it.
- `files:` — newline-delimited globs. Three globs ensure exactly one file per platform; if a platform produced two installers (shouldn't happen but defense-in-depth), all are uploaded.

**Atomicity semantics under partial-failure (the critical question):**
- If the action errors **between** uploading asset 1 and asset 2 (network blip, API quota, `EAI_AGAIN`), the draft release is **already created** with however many assets uploaded successfully. The release is **not rolled back** — softprops doesn't implement a transaction. **However, this only matters if the assets are uploaded in sequence; with the v2.x line, `softprops/action-gh-release` uploads assets concurrently by default.**
- The architectural backstop is D-02: if the `softprops` action fails for any reason, the maintainer sees the failed workflow run and can manually delete the partial draft from the GitHub UI before re-pushing the tag. The draft state is the explicit gate that prevents a partial release from being seen by users.
- For our use case (single-call, three assets, low API churn), this is acceptable. **No need for a two-step "create empty draft → upload assets → finalize" pattern in v1.1.** `[CITED: softprops/action-gh-release issue tracker — atomicity is not advertised; draft+manual-cleanup is the documented remediation pattern]`

**Auto-attached `latest.yml` from electron-builder:** electron-builder generates `latest.yml`, `latest-mac.yml`, `latest-linux.yml` only when a `publish:` block exists in `electron-builder.yml` OR when `--publish` is anything other than `never`. Phase 10 has **no** `publish:` block (verified — `electron-builder.yml` does not contain a `publish:` key) and we pass `--publish never` everywhere. **Therefore no `latest*.yml` files will be produced; the three glob patterns above will not pick up any extra files.** Phase 12 will add `publish: github` (UPD-01) at which point those files will be generated and the `files:` block will need expansion — but that's Phase 12's concern, not ours. `[VERIFIED: electron-builder.yml grep for "publish:" returns zero matches; CITED: https://www.electron.build/auto-update.html on latest.yml generation conditions]`

### Pattern 7: Release-body templating (REL-02 + D-11/D-12)

**What:** A stable markdown file with three placeholders, rendered via `envsubst` to a job-local file before being passed to `softprops/action-gh-release` via `body_path:`.
**When:** Every release. Template lives in repo; render is per-workflow-run.

**Template file (`.github/release-template.md`):**
```markdown
# Spine Texture Manager ${VERSION}

## Summary

<!-- One-line summary of what this release contains. Edit before publishing. -->

## New in this version

<!-- Bullet list of user-facing changes. Edit before publishing. -->

## Known issues

<!-- Any issues testers should know about. Edit before publishing. -->

## Install instructions

Choose the installer for your platform:

- **macOS (Apple Silicon):** Download the `.dmg`. After mounting, drag to /Applications. **First launch:** macOS will block the app (it's ad-hoc-signed). Open System Settings → Privacy & Security → scroll to the bottom → click "Open Anyway" next to the Spine Texture Manager row.
- **Windows (x64):** Download the `.exe`. Double-click. SmartScreen will show "Windows protected your PC" — click "More info" → "Run anyway". Then walk through the NSIS installer.
- **Linux (x64):** Download the `.AppImage`. Make it executable: `chmod +x "Spine Texture Manager-${VERSION}-x86_64.AppImage"`, then run it. On Ubuntu 24.04+ you may need `sudo apt install libfuse2t64`.

For full install instructions: ${INSTALL_DOC_LINK}

## Tag

This release was built from tag `${TAG}`.
```

**Render step (already shown in Pattern 6):**
```yaml
- name: Render release body from template
  env:
    VERSION: ${{ github.ref_name }}
    TAG: ${{ github.ref_name }}
    INSTALL_DOC_LINK: https://github.com/${{ github.repository }}/blob/main/README.md
  run: envsubst < .github/release-template.md > release-body.md
```

**Tool choice rationale:**
- `envsubst` is **pre-installed** on all GitHub-hosted Linux runners as part of the `gettext-base` package; no apt install needed. `[VERIFIED: actions/runner-images Ubuntu2204-Readme.md and Ubuntu24-Readme.md include gettext-base]`
- `envsubst` recognizes `${VAR}` and `$VAR` syntax. Our template uses `${VAR}` for explicitness (matches D-11 placeholder spec).
- Alternative: a `sed -e 's/${VERSION}/.../g' -e 's/${TAG}/.../g'` chain works but requires careful escaping of `/` and `&` in the substitution values. `envsubst` handles env-var content correctly without escaping concerns. **Recommend `envsubst`.**
- Alternative: pass the body literally via `body:` (no file). Workable for short bodies; verbose for our 4-section template. **Recommend `body_path:`.**
- Alternative: `softprops/action-gh-release` has its own `--generate-release-notes` mode (auto-derived from commit messages). Out of scope for v1.1 — we want a curated tester-facing template, not autogenerated notes. (Deferred per CONTEXT `<deferred>`.)

**Phase-12 forward note:** When `INSTALL.md` lands in Phase 12 (REL-03), update `INSTALL_DOC_LINK` to point at it. Inline first-launch text (D-13) can be replaced with "see INSTALL.md for full per-OS instructions" but is acceptable to leave inline as a tester-friendly belt-and-braces.

### Pattern 8: Workflow_dispatch dry-run gating (CI-06)

**What:** The `if:` gate on the publish job is the entire dry-run mechanism. No separate workflow file.
**When:** Always for v1.1.
**Example (already shown in Pattern 6):**
```yaml
publish:
  if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')
```

**Behavior:**
- On `push` of a `v*.*.*` tag: condition true ⇒ publish runs ⇒ draft release created.
- On `workflow_dispatch` from any branch: `github.event_name` is `workflow_dispatch` (not `push`) ⇒ condition false ⇒ publish job is **skipped** (status: "Skipped" in the workflow run UI). The three platform installers are still uploaded as workflow artifacts (visible on the run summary page) and downloadable for 14 days.
- On `push` of a non-tag (e.g., main branch push, hypothetical): the `on:` block doesn't trigger — workflow doesn't run at all.

**Tester UX for dry-run:** Tester (or developer) clicks "Run workflow" in the GitHub Actions UI on the `release` workflow page. The 3 build jobs run; once green, three artifacts named `installer-mac`, `installer-win`, `installer-linux` appear on the run summary. Click to download. **14-day retention is sufficient** for the dispatch UX; no tester sits on a dispatched build for 2 weeks.

### Anti-Patterns to Avoid

- **Setting `GITHUB_TOKEN` in the build-job environment.** electron-builder reads `GH_TOKEN` and `GITHUB_TOKEN`; if either is set in env it defaults to `[{provider: "github"}]` and tries to publish. The build job MUST NOT have these in env. (See Pitfall 1.)
- **Forgetting `--publish never` on the build:* npm scripts.** Even without `GH_TOKEN`, a future user/CI maintainer might inadvertently set it; passing `--publish never` is belt-and-braces.
- **Using `${{ secrets.GITHUB_TOKEN }}` as the `token:` input to `softprops/action-gh-release`.** Don't. The action defaults to `${{ github.token }}` which is the same value but expressed correctly. Explicit override is unnecessary and signals "we're doing something custom" when we're not.
- **Hard-coding the tag version in the workflow.** Always use `${{ github.ref_name }}`. Hard-coded tags are a foot-gun on the second release.
- **Letting `actions/upload-artifact` complete with zero files.** Always set `if-no-files-found: error`. A silent zero-file upload + a successful build job + an apparently-green workflow + a draft release with 2 of 3 assets = the worst possible failure mode.
- **Running build jobs on `ubuntu-latest` instead of `ubuntu-22.04`.** `ubuntu-latest` is currently `ubuntu-24.04`; the electron-builder appimage toolset has known build-time GLIBC issues on newer Ubuntu (see Pitfall 4). D-06 pins `ubuntu-22.04` for the build job specifically; honor it.
- **Using `actions/create-release` (deprecated, archived).** softprops/action-gh-release is the only sensible choice for new pipelines.
- **Using `cancel-in-progress: true` on the release workflow.** Don't. A half-built release is worse than serializing two release runs. D-19 is correct.
- **Adding a `publish:` block to `electron-builder.yml`.** That triggers electron-builder's auto-publish AND auto-generates `latest.yml` files. Phase 12 will add this; Phase 11 must not.
- **Using a `strategy.matrix` for the three build jobs.** It compresses YAML at the cost of readability and makes per-platform debugging harder; D-01 implicitly chose three explicit jobs by listing them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Create draft release + attach multi-asset | Custom `gh api repos/.../releases` shell calls | `softprops/action-gh-release@v2` | softprops handles draft creation, multi-asset upload, retry on transient 404s, and is a single battle-tested action call. Hand-rolling re-implements asset-upload-URL discovery and 100-release pagination quirks. |
| Cross-job file handoff | Custom S3/scp/gh-CLI uploads | `actions/upload-artifact` + `actions/download-artifact` | First-party, free, integrated into the workflow run UI. |
| Tag↔version validation | Composite action / external dep | Inline 8-line bash step | Single use; readability wins. |
| Release-body templating | Mustache / Jinja / Liquid | `envsubst` (pre-installed on Ubuntu runners) | Three string placeholders ≠ a templating engine. |
| Concurrency control | App-level lock files / external mutex | GHA `concurrency:` block | Native primitive, exactly the right granularity (per-tag-ref). |
| NSIS installer assembly in CI | `makensis` shell scripts | electron-builder's `--win nsis` | electron-builder bundles the toolchain and handles the assembly. |
| AppImage assembly in CI | `appimagetool` invocations | electron-builder's `--linux AppImage` | electron-builder bundles its own appimage toolset (path: `electron-builder-binaries`) — verified by issue tracker for v26. |
| Renaming installer assets before upload | Shell `mv` step | electron-builder's `artifactName` template | Already wired in `electron-builder.yml` — `${productName}-${version}-${arch}.${ext}`. The artifacts already have the right names. |
| Auto-update feed (`latest.yml`) generation | Custom YAML emit | electron-builder's `publish:` block (Phase 12) | Phase 11 explicitly does NOT generate these. Phase 12 owns it. |

**Key insight:** Phase 11 is **almost entirely a configuration phase** — one workflow YAML file, one markdown template. The temptation to write helper shell scripts or composite actions is a smell; resist it. If it doesn't fit in `release.yml` + `release-template.md`, reconsider whether it belongs in Phase 11.

## Common Pitfalls

### Pitfall 1: electron-builder GH_TOKEN auto-publish (the load-bearing trap)

**What goes wrong:** If `GH_TOKEN` or `GITHUB_TOKEN` is set in the build-job environment and `--publish never` is not passed, electron-builder defaults its publish provider to `[{provider: "github"}]` and **tries to upload artifacts to GitHub Releases by itself**, racing the dedicated `publish` job. Result: either (a) a draft release with assets uploaded twice (deduped by name; depends on overwrite semantics) or (b) electron-builder fails with a "tag does not exist" error and aborts the build. Both outcomes break the all-or-nothing atomicity property D-02 promises.

**Why it happens:** GitHub Actions automatically exposes `GITHUB_TOKEN` as `${{ secrets.GITHUB_TOKEN }}`, but it does NOT auto-export it to the shell environment. However, many template workflows do `env: GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` at the workflow level, which propagates to every job — including build jobs that should never see it. electron-builder's documented behavior: "If `GH_TOKEN` or `GITHUB_TOKEN` is defined — defaults to `[{provider: 'github'}]`."

**How to avoid:**
1. **Do NOT set `env: GH_TOKEN: ...` or `env: GITHUB_TOKEN: ...` at the workflow level or in any of the three `build-*` jobs.** GitHub Actions does not auto-export `GITHUB_TOKEN` to env; this is a no-op pitfall as long as no one explicitly adds it.
2. **Pass `--publish never` to every electron-builder invocation in build jobs.** Belt-and-braces. Done by appending `-- --publish never` to the npm script invocation: `npm run build:mac -- --publish never`.
3. **Optional defensive measure:** Update `package.json#scripts.build:mac/win/linux` to bake in `--publish never`:
   ```json
   "build:mac": "electron-vite build && electron-builder --mac dmg --publish never",
   "build:win": "electron-vite build && electron-builder --win nsis --publish never",
   "build:linux": "electron-vite build && electron-builder --linux AppImage --publish never"
   ```
   This makes the protection survive even if a future workflow author forgets `-- --publish never`. **Recommend doing this** as a small Phase 11 task.

**Warning signs:**
- Build-job log contains `electron-builder` lines mentioning `Publishing` or `Uploading to GitHub`.
- Two draft releases for the same tag.
- Build job fails with `GitHub Personal Access Token is not set` (electron-builder tried to publish, failed because `GH_TOKEN` was set but lacked permissions).

`[CITED: https://www.electron.build/publish.html — "If GH_TOKEN or GITHUB_TOKEN is defined — defaults to [{provider: 'github'}]"]`
`[CITED: https://github.com/electron-userland/electron-builder/issues/4546, /issues/3792, /issues/4549 — multi-year, well-documented surprise]`

### Pitfall 2: AppImage build on `ubuntu-latest` (24.04+) — GLIBC mismatch

**What goes wrong:** electron-builder's bundled appimage toolset (`appimage@1.0.2`, the version shipped with electron-builder 26.8.1) has a `mksquashfs` binary that links against GLIBC ≤2.28. Ubuntu 25.10 ships GLIBC 2.40+, and the binary fails with `version 'GLIBC_2.29' not found (required by basename)`. Ubuntu 24.04 (the current `ubuntu-latest`) ships GLIBC 2.39 — close enough that builds usually work but reports of intermittent failures exist.

**Why it happens:** appimage-toolset is built once and bundled; it doesn't dynamically re-link. The bundled binary is built against an older GLIBC for portability across most Ubuntu/Debian/RHEL distros, but very-new distros break the assumption.

**How to avoid:** Pin the Linux build job to `ubuntu-22.04` (D-06). Ubuntu 22.04 ships GLIBC 2.35 — well within the appimage toolset's compatibility window. Confirmed by Phase 10 RESEARCH Pitfall 5 reference and electron-builder issue #9598.

**Warning signs:**
- Linux build job fails with `mksquashfs: ... GLIBC_2.XX not found`.
- Linux build job fails with `cannot execute binary file`.

`[CITED: https://github.com/electron-userland/electron-builder/issues/9598 — Ubuntu 25.10 GLIBC 2.29 mismatch with electron-builder 26.8.1 appimage toolset 1.0.2, dated 2026]`

### Pitfall 3: AppImage runtime needs libfuse2 — but BUILD does not (D-17 verification)

**What goes wrong (the inverse of the actual pitfall):** A common mistake is to add `sudo apt-get install libfuse2` to the Linux build job, assuming the toolchain needs FUSE. It does not.

**Why it doesn't matter at build time:** electron-builder produces an AppImage by assembling a squashfs filesystem and prepending the AppRun runtime. None of these steps invoke FUSE — squashfs is created on disk, AppRun is concatenated. **FUSE is only invoked when a user runs the AppImage**, mounting the squashfs filesystem on demand.

**Why testers DO need libfuse2 at run time:** Per Phase 10 Pitfall 5, Ubuntu 24.04+ renamed `libfuse2` to `libfuse2t64` (time_t-64 transition). Testers need to install it manually on Ubuntu 24.04+ (`sudo apt install libfuse2t64`). This is documented in INSTALL.md (Phase 12 deliverable) and in the inline release-body template (D-13).

**How to avoid:** Trust D-17. Do not add `apt install libfuse2` to the Linux build job. If a future maintainer adds it "for safety," it's harmless (just slow). The only failure mode is a build-job timeout on apt-get update, which is a network blip not a libfuse2 issue.

**Warning signs that you're confused:**
- A maintainer added `sudo apt-get install libfuse2` to `build-linux` "to fix AppImage builds" — they're confusing build-time and run-time dependencies.

`[CITED: https://docs.appimage.org/packaging-guide/optional/runtime.html — "the AppImage runtime requires FUSE 2 to be installed on the user's system" (emphasis: user's, not builder's)]`

### Pitfall 4: `softprops/action-gh-release` multi-draft creation when >100 releases exist (issue #602)

**What goes wrong:** The action paginates through release lists in batches of 100. If a release exists in batch 1 and the action calls `find()` again in batch 2 (where the release isn't), `find()` returns `undefined` and overwrites the batch-1 hit. Result: the action thinks no draft exists and creates a new one — every workflow run produces a duplicate draft.

**Why it happens:** Pagination iteration bug in older v2 versions; fixed in v2.0.4+ via PR #603.

**How to avoid:** Pin to v2.6.2 (the latest v2). Our repo currently has 1 release (`v1.0`) so this pitfall doesn't bite for years. Document for future maintainers when the repo accumulates >100 releases.

**Warning signs:**
- Multiple drafts for the same tag in the GitHub Releases UI.
- Repo has more than 100 releases.

`[CITED: https://github.com/softprops/action-gh-release/issues/602 — "Multiple Draft Releases Created when >100 Releases Exist in GitHub"]`

### Pitfall 5: `setup-node@v4` cache + missing lockfile

**What goes wrong:** `actions/setup-node@v4` with `cache: 'npm'` requires a committed `package-lock.json` (or `npm-shrinkwrap.json`). If absent, the cache step fails with `Path Validation Error: Path(s) specified in the action for caching does not exist`.

**Why it happens:** The cache key is derived from a hash of the lockfile; no lockfile = no key.

**How to avoid:** `package-lock.json` is already committed (`ls package-lock.json` exits 0 in our repo). Verify it remains committed; never `.gitignore` it. `npm ci` requires it as well, so this pitfall would also break Phase 11 at the install step.

**Warning signs:**
- `setup-node` fails at the cache-restore step.
- `npm ci` fails with "package-lock.json must be present."

`[CITED: https://github.com/actions/setup-node — "If you choose not to use a lockfile, you must ensure that caching is disabled"]`

### Pitfall 6: Tag glob `v*.*.*` and `-rc1` suffix (verified compatible)

**What goes wrong (the worry):** Some users assume `v*.*.*` requires three numeric segments and won't match `v1.1.0-rc1` (where the third segment contains a dash).

**Why it doesn't actually go wrong:** GitHub Actions tag globs use a permissive `*` semantic — `*` matches any sequence of non-`/` characters. The third `*` in `v*.*.*` matches `0-rc1` greedily. `[VERIFIED: GitHub community discussion #26714 + practical confirmation in many real-world workflows triggering on rc tags]`

**How to confirm at workflow design time:** In a dry-run, push a tag like `v0.0.1-test1` to a branch (or the repo's existing `v1.0` already established the precedent — but `v1.0` is two-segment and wouldn't match `v*.*.*`). The first true verification is the live tag push of `v1.1.0-rc1`. Acceptance criterion: workflow run appears in the Actions tab within 30s of `git push origin v1.1.0-rc1`.

**Warning signs:**
- Workflow fails to trigger on tag push despite tag matching the glob — re-check the literal `v*.*.*` string for typos.
- Workflow triggers on unintended tags — strengthen the glob (e.g., `v[0-9]*.*.*` to require leading-digit second char).

**Backward note for our repo:** Existing tag `v1.0` would not match `v*.*.*` (only 2 segments). Phase 11 workflow only fires on tags created **after** `release.yml` lands on `main`; the existing `v1.0` won't accidentally re-fire.

### Pitfall 7: macOS ad-hoc CI without certificates — CSC_IDENTITY_AUTO_DISCOVERY (defensive)

**What goes wrong (sometimes):** electron-builder on `macos-14` with no Apple Developer cert in keychain should auto-fall-back to ad-hoc signing (matching Phase 10 Pattern 1's `mac.identity: '-'` config). Most reports confirm this works. A minority of reports show electron-builder attempting to discover certs in the (empty) CI keychain and failing with "no identity found."

**Why it happens (when it does):** electron-builder's keychain discovery defaults to `true`; on a CI runner with an empty keychain it should produce no candidates and fall through to ad-hoc. But Apple's `security` command sometimes returns warnings that electron-builder mistakes for errors.

**How to avoid:** Defensively set `CSC_IDENTITY_AUTO_DISCOVERY: false` in the `build-mac` job's `env:` block. Combined with `mac.identity: '-'` in `electron-builder.yml`, this fully disables keychain discovery and locks ad-hoc signing. Zero downside on a CI runner with no certs.

**Warning signs:**
- macOS build fails with "no identity found in keychain" or "Code signing identity has been requested but no Apple Developer ID was found."
- macOS build produces an unsigned `.app` instead of an ad-hoc-signed one (`codesign -dv` shows "code object is not signed at all" rather than "Signature=adhoc").

`[CITED: https://www.electron.build/code-signing-mac.html — "On ARM or universal builds, an ad-hoc signature will be applied by default. ... CSC_IDENTITY_AUTO_DISCOVERY ... can be set to false to disable automatic keychain discovery"]`

### Pitfall 8: GitHub Actions concurrency — only one pending job, force-push edge

**What goes wrong:** GitHub's concurrency primitive allows at most ONE running and ONE pending job per concurrency group. If a third tag-push (force-push) arrives while one is running and one is pending, the older pending is silently cancelled. With `cancel-in-progress: false`, the running job is preserved — but the queue depth is 1, not unlimited.

**Why it happens:** Hard-coded GitHub Actions limit, not configurable.

**How to avoid:** Don't force-push tags. Document this in the maintainer playbook (Phase 12 INSTALL.md or PROJECT.md).

**Warning signs:**
- A pending workflow run disappears from the Actions UI without explanation.
- "Cancelled" workflows that the user didn't manually cancel.

`[CITED: https://github.com/orgs/community/discussions/41518 — "There can be at most one running and one pending job in a concurrency group at any time"]`

## Code Examples

### Complete `.github/workflows/release.yml` (target state — combines all patterns)

```yaml
# Spine Texture Manager — release pipeline
# Triggers: tag push v*.*.* (creates draft GitHub Release), workflow_dispatch (dry run, no release).
#
# Runner image versions (track upstream upgrades deliberately):
#   ubuntu-latest  → currently ubuntu-24.04 (test + publish jobs)
#   ubuntu-22.04   → pinned for AppImage build (avoids GLIBC mismatch with electron-builder appimage toolset 1.0.2)
#   macos-14       → arm64 native (required for sharp's @img/sharp-darwin-arm64 subpackage resolution)
#   windows-2022   → Windows SDK + signtool present
#
# Action SHAs pinned for supply-chain hygiene; bump deliberately, not floating.

name: release

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4.3.1
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.4.0
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci

      - name: Verify tag matches package.json version
        if: github.event_name == 'push'
        run: |
          TAG_VERSION="${GITHUB_REF_NAME#v}"
          PKG_VERSION="$(node -p "require('./package.json').version")"
          if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
            echo "::error::Tag $GITHUB_REF_NAME does not match package.json version $PKG_VERSION."
            echo "::error::Run 'npm version <X>' before tagging, or delete the tag and retry."
            exit 1
          fi
          echo "Tag $GITHUB_REF_NAME ↔ package.json $PKG_VERSION — OK"

      - run: npm run typecheck
      - run: npm run test

  build-mac:
    needs: test
    runs-on: macos-14
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - name: Build macOS DMG
        run: npm run build:mac -- --publish never
        env:
          CSC_IDENTITY_AUTO_DISCOVERY: false
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02  # v4.6.2
        with:
          name: installer-mac
          path: release/*.dmg
          if-no-files-found: error
          retention-days: 14

  build-win:
    needs: test
    runs-on: windows-2022
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - name: Build Windows NSIS
        run: npm run build:win -- --publish never
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
        with:
          name: installer-win
          path: release/*.exe
          if-no-files-found: error
          retention-days: 14

  build-linux:
    needs: test
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - name: Build Linux AppImage
        run: npm run build:linux -- --publish never
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
        with:
          name: installer-linux
          path: release/*.AppImage
          if-no-files-found: error
          retention-days: 14

  publish:
    needs: [build-mac, build-win, build-linux]
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5

      - name: Download all platform installers
        uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093  # v4.3.0
        with:
          pattern: installer-*
          merge-multiple: true
          path: ./assets

      - name: List downloaded assets (debug aid)
        run: ls -la ./assets/

      - name: Render release body from template
        env:
          VERSION: ${{ github.ref_name }}
          TAG: ${{ github.ref_name }}
          INSTALL_DOC_LINK: https://github.com/${{ github.repository }}/blob/main/README.md
        run: envsubst < .github/release-template.md > release-body.md

      - name: Create draft GitHub Release
        uses: softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65  # v2.6.2
        with:
          tag_name: ${{ github.ref_name }}
          name: ${{ github.ref_name }}
          body_path: release-body.md
          draft: true
          prerelease: ${{ contains(github.ref_name, '-') }}
          fail_on_unmatched_files: true
          files: |
            assets/*.dmg
            assets/*.exe
            assets/*.AppImage
```

### Complete `.github/release-template.md` (target state)

```markdown
# Spine Texture Manager ${VERSION}

## Summary

<!-- One-line summary of what this release contains. Edit before publishing. -->

## New in this version

<!-- Bullet list of user-facing changes. Edit before publishing. -->

## Known issues

<!-- Any issues testers should know about. Edit before publishing. -->

## Install instructions

Choose the installer for your platform:

- **macOS (Apple Silicon):** Download the `.dmg`. After mounting, drag to /Applications. **First launch:** macOS will block the app (it's ad-hoc-signed). Open System Settings → Privacy & Security → scroll to the bottom → click "Open Anyway" next to the Spine Texture Manager row.
- **Windows (x64):** Download the `.exe`. Double-click. SmartScreen will show "Windows protected your PC" — click "More info" → "Run anyway". Then walk through the NSIS installer.
- **Linux (x64):** Download the `.AppImage`. Make it executable: `chmod +x "Spine Texture Manager-${VERSION}-x86_64.AppImage"`, then run it. On Ubuntu 24.04+ you may need `sudo apt install libfuse2t64`.

For full install instructions: ${INSTALL_DOC_LINK}

## Tag

This release was built from tag `${TAG}`.
```

### Defensive `package.json` script update (recommended)

```json
{
  "scripts": {
    "build:mac": "electron-vite build && electron-builder --mac dmg --publish never",
    "build:win": "electron-vite build && electron-builder --win nsis --publish never",
    "build:linux": "electron-vite build && electron-builder --linux AppImage --publish never"
  }
}
```

This bakes `--publish never` into the npm scripts so the protection survives even if the workflow author forgets `-- --publish never` in a future edit. Zero behavioral change for Phase 10 (which never had `GH_TOKEN` set anyway). **Phase 12 will need to remove this** when wiring auto-update — Phase 12's concern.

### Verification commands (post-first-real-run)

```bash
# After pushing v1.1.0-rc1, observe the workflow:
gh run list --workflow=release.yml --limit 5

# After workflow completes, observe the draft release:
gh release view v1.1.0-rc1 --json name,isDraft,assets,body

# Expect:
#   isDraft: true
#   assets: 3 entries (.dmg, .exe, .AppImage with 1.1.0-rc1 in filename)
#   body: rendered template with ${VERSION} → v1.1.0-rc1, etc.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `actions/create-release@v1` (single asset, multi-call upload) | `softprops/action-gh-release@v2` (multi-asset single call) | actions/create-release archived 2021 | Hand-rolling release creation is no longer the default; softprops is the de-facto community standard. |
| `actions/upload-artifact@v3` (per-workflow retention, 90-day default) | `actions/upload-artifact@v4` (per-artifact retention, separate-artifact UX, deprecated v3 since 2024-11) | Late 2024 v3 deprecation | v4 is mandatory for new workflows; v3 is removed from the Marketplace. |
| `ubuntu-latest` everywhere | Pinned `ubuntu-22.04` for AppImage builds, `ubuntu-latest` for non-build jobs | Ubuntu 24.04 became default 2025-01 | electron-builder's bundled appimage toolset has GLIBC compatibility issues on 24.04+; `ubuntu-22.04` is the safe build pin until electron-builder ships a refreshed toolset. |
| Floating-tag action references (`@v2`) | Commit-SHA-pinned references | Supply-chain hygiene best practice (CISA 2023+) | All five third-party actions in this workflow are SHA-pinned. Bumps are deliberate (PR-driven), not silent. |
| `electron-builder --publish always` from CI | `electron-builder --publish never` + dedicated publish action | softprops adoption + atomicity concerns | Separates build from publish; build-job failures cannot create partial releases. |

**Deprecated/outdated:**
- `actions/create-release` — archived since 2021, no security updates.
- `actions/upload-artifact@v3` — deprecated 2024-11, will sunset.
- `softprops/action-gh-release@v0.x` — pre-stable; do not use.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tag glob `v*.*.*` matches `v1.1.0-rc1` because GHA's `*` greedy-matches any non-`/` char including `-` | Pattern 1, Pitfall 6 | Low — verified in community discussions; first real-run with `v1.1.0-rc1` will confirm. If wrong, switch glob to `'v*'`. |
| A2 | `softprops/action-gh-release@v2.6.2` uploads multi-asset concurrently (not sequentially) | Pattern 6 | Low — the README example shows multi-line `files:` and the action's source uploads in parallel. If a partial-upload happens, draft state + manual cleanup is the documented remediation. No architectural change needed. |
| A3 | `CSC_IDENTITY_AUTO_DISCOVERY=false` is the right defensive env var on `macos-14` with no certs | Pitfall 7 | Low — official electron-builder docs recommend this for "skip signing" scenarios. Even if not strictly required (ad-hoc fallback usually works), it's a no-op on a clean CI runner with no certs. |
| A4 | `ubuntu-22.04` GLIBC 2.35 is sufficient for electron-builder 26.8.1's appimage toolset | Pitfall 2 | Medium — issue #9598 explicitly affects Ubuntu 25.10 (GLIBC 2.40+); 22.04's 2.35 is well within compat window. If wrong, fall back to a custom-built AppImage step or upgrade to a newer electron-builder version. |
| A5 | `package.json#version = "1.1.0-rc1"` matches the planned first tag `v1.1.0-rc1` | Pattern 3 | Low — verified by reading package.json directly. |
| A6 | electron-builder does NOT generate `latest*.yml` files in our config (no `publish:` block) | Pattern 6 | Low — verified by `grep "publish:" electron-builder.yml` (zero matches). Phase 12 will change this; Phase 11 must not. |
| A7 | `gettext-base` (envsubst) is pre-installed on `ubuntu-latest` (the publish job runner) | Pattern 7 | Low — verified in actions/runner-images Ubuntu24-Readme.md. |
| A8 | The first real Phase 11 verification = pushing tag `v1.1.0-rc1` and observing draft release with 3 assets | Validation Architecture | Low — this is the user's stated verification path per CONTEXT `<specifics>`. |
| A9 | `actions/upload-artifact@v4` per-job 500-artifact limit and per-workflow ~10GB are not threatened by ~370MB total | Pattern 5 | Low — well within both limits. |
| A10 | `softprops/action-gh-release@v2.6.2` SHA `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65` is the canonical pin | Standard Stack | Low — verified via `gh api repos/softprops/action-gh-release/git/refs/tags/v2.6.2`. |

## Open Questions (RESOLVED)

1. **Should `package.json` build:* scripts get `--publish never` baked in, or stay as Phase-11-only `-- --publish never` arguments in `release.yml`?**
   - What we know: Both approaches work. Baking into package.json is safer (defense-in-depth); keeping it CI-only avoids changing Phase-10-stable behavior.
   - What's unclear: Whether the user prefers minimal change-surface for Phase 11 (CI YAML only) or accepts a small `package.json` edit.
   - Recommendation: **Bake into package.json.** The protection should travel with the build script regardless of who invokes it. Phase 12 will need to revisit when adding `publish: github`.

2. **Should the version-guard be a composite action or inline shell?**
   - What we know: CONTEXT lists this as Claude's discretion. Single use; simple comparison.
   - What's unclear: Nothing.
   - Recommendation: **Inline shell.** 8 lines, single use, easy to audit. A composite action is overkill.

3. **Should the publish job upload `release/builder-debug.yml` on failure (D-23 optional)?**
   - What we know: D-23 marks this optional. Useful debug surface if a future Phase 11 plan-or-execute round hits an electron-builder failure that's hard to diagnose from the standard log.
   - What's unclear: Whether the file even exists post-build (it's an electron-builder debug log; only emitted on certain failure modes).
   - Recommendation: **Add it.** Trivial cost (one `actions/upload-artifact@v4` step with `if: failure()` and `continue-on-error: true`); high value if needed. Per-build job, not per publish job.

4. **What `INSTALL_DOC_LINK` value for Phase 11 (no INSTALL.md exists yet)?**
   - What we know: D-13 says inline first-launch text in template; INSTALL.md lands in Phase 12.
   - What's unclear: Whether to point INSTALL_DOC_LINK at README.md (loose), at the repo root (`https://github.com/Dzazaleo/Spine_Texture_Manager`), or at `https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md` (404 in Phase 11).
   - Recommendation: **Point at README.md for Phase 11**, then update the template in Phase 12 to point at INSTALL.md. The link in the rendered body becomes "For full install instructions: …README.md" which is honest — README has install info even before a dedicated INSTALL.md.

5. **Does the manual `Run workflow` button (workflow_dispatch UI) work without inputs in v1.1?**
   - What we know: D-05 says no inputs. Empty `workflow_dispatch:` is valid GHA syntax.
   - What's unclear: Whether GitHub renders a "Run workflow" UI button when no inputs are defined. (It does — verified across many open-source projects.)
   - Recommendation: **Trust the empty-form syntax.** First dispatch run is the verification.

6. **Is electron-builder's Linux AppImage build expected to leave `.AppImage` files directly in `release/` (no subdirectory)?**
   - What we know: `electron-builder.yml` `directories.output: release` puts artifacts directly there. Phase 10 macOS DMG is at `release/Spine Texture Manager-1.1.0-rc1-arm64.dmg` (root of `release/`).
   - What's unclear: Whether AppImage builds emit additional subdirectory (some electron-builder versions emit `release/linux-unpacked/` alongside the AppImage). The `path: release/*.AppImage` glob is non-recursive, so it only catches files directly in `release/` — the AppImage itself.
   - Recommendation: **`path: release/*.AppImage` is correct** for our config. `if-no-files-found: error` will catch any path-mismatch surprise on the first run.

7. **Phase 11 first-real-run verification — should it be a discrete plan task, or a phase-verify task?**
   - What we know: User's stated verification is "push tag, observe draft release, see 3 assets." This requires a live external GitHub API interaction; it's not something the executor can run autonomously inside the repo.
   - What's unclear: Whether to model it as a sub-plan with explicit shell + `gh release view` assertions, or as a plain Validation gate.
   - Recommendation: **Make it a discrete plan task** (e.g., Plan 11-03: "First-real-run verification"). The task is: bump package.json → commit → tag `v1.1.0-rc1` → push tag → observe workflow → observe draft release → assert 3 assets present + body rendered. The Validation Architecture section below codifies the assertions.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `git` | tag push, checkout | ✓ | (any modern git on dev host) | — |
| `gh` (GitHub CLI) | first-run verification, optional `gh release view` | ✓ on macOS-14 dev host; ✓ on `ubuntu-latest` runner | (latest) | direct GitHub API via curl |
| `node` ≥18 | npm scripts on runners | ✓ | 22.x via setup-node | — |
| `npm` | dependency install | ✓ | 10.x bundled with Node 22 | — |
| `electron-builder` | per-platform build | ✓ | 26.8.1 (devDep) | — |
| `vitest` | test job | ✓ | 4.0.0 (devDep) | — |
| `softprops/action-gh-release@v2.6.2` | publish job | ✓ via GHA Marketplace | — | Custom `gh release create` shell calls (not recommended) |
| `actions/upload-artifact@v4.6.2` | build jobs | ✓ via GHA Marketplace | — | — |
| `actions/download-artifact@v4.3.0` | publish job | ✓ via GHA Marketplace | — | — |
| `envsubst` (`gettext-base`) | publish job template render | ✓ on `ubuntu-latest` | — | `sed -e 's/${VERSION}/.../g' …` chain |
| `signtool.exe` | (NOT used; we don't sign Windows in v1.1) | ✓ on `windows-2022` | — | n/a |
| `codesign` | (NOT used directly; electron-builder calls it) | ✓ on `macos-14` | — | n/a |
| `libfuse2` | (NOT needed at build time per D-17) | n/a | n/a | n/a |
| `appimagetool` | (NOT needed; bundled in electron-builder) | n/a (electron-builder ships its own) | — | n/a |
| GitHub repo with `contents: write` token | publish job | ✓ default `${{ secrets.GITHUB_TOKEN }}` has `contents: write` for public repo (Dzazaleo/Spine_Texture_Manager is public) | — | PAT (not needed) |

**Missing dependencies with no fallback:** None. All required surfaces are GHA-runtime or already-committed.

**Missing dependencies with fallback:** None.

## Validation Architecture

> `workflow.nyquist_validation` is not explicitly disabled in `.planning/config.json` — treat as enabled. **However, this phase's outputs (workflow YAML + markdown template) cannot be meaningfully unit-tested.** The validation surface is the live workflow run, not a vitest assertion.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.0 (existing) — covers the existing TS source, NOT the YAML config |
| Config file | `vitest.config.ts` (existing; unchanged) |
| Quick run command | `npm run test` (runs in the workflow's `test` job, ~30s) |
| Full suite command | `npm run typecheck && npm run test` |

**Crucial framing:** Phase 11 introduces `release.yml` and `release-template.md`. Neither has any vitest-meaningful behavior. The validation gate is **the live workflow run produces the documented outputs**, not "a unit test asserts the workflow exists."

The planner MUST NOT invent a vitest test that, for example, parses `release.yml` with `js-yaml` and asserts the presence of certain keys. That kind of test is a tautology — it asserts the YAML matches itself; if the YAML is wrong in a way the test doesn't anticipate, the test passes anyway. The only true Phase 11 verification is end-to-end execution.

### Phase Requirements → Validation Map

| Req ID | Behavior | Test Type | Validation Command / Procedure | File Exists? |
|--------|----------|-----------|--------------------------------|-------------|
| CI-01 | Tag push triggers workflow | live tag push + observation | `git tag v1.1.0-rc1 && git push origin v1.1.0-rc1`; within 30s, `gh run list --workflow=release.yml` shows a queued run | n/a — workflow file is the gate |
| CI-02 | 3 platform builds in parallel | observe workflow run UI | `gh run view <run-id> --json jobs` shows 4 jobs running concurrently after `test` finishes (build-mac, build-win, build-linux, then publish queues) | n/a |
| CI-03 | vitest runs before builds | observe job graph | `gh run view <run-id>` shows `test` completes green before any `build-*` starts | n/a |
| CI-04 | Successful builds produce draft release with 3 assets | live tag push + `gh release view` | After workflow completes green: `gh release view v1.1.0-rc1 --json isDraft,assets` returns `isDraft: true` and `assets[].name` includes `.dmg`, `.exe`, `.AppImage` filenames matching the version | n/a |
| CI-05 | Failed platform build prevents publication | injected failure (deferred to phase-verify) | Manually set `mac.identity` to an invalid value temporarily on a side branch, push a test tag, observe workflow: build-mac fails ⇒ publish job skipped (status "Skipped") ⇒ no draft release exists. **Optional/deferred:** v1.1's first-real-run on `v1.1.0-rc1` is the happy-path proof; failure-path is implicit from the `needs:` graph. | n/a |
| CI-06 | Manual workflow_dispatch dry-run | manual GitHub UI action | Actions tab → release.yml → "Run workflow" → branch: main → observe: 4 jobs run (test + 3 builds), 3 artifacts uploaded, publish job marked "Skipped". `gh release view` returns "release not found" (no draft created). Workflow run summary page lists 3 downloadable artifacts. | n/a |
| REL-01 | Released asset URLs serve all 3 platforms | live tag push + `gh release view` | `gh release view v1.1.0-rc1 --json assets --jq '.assets[].name' \| sort` returns three lines: `.dmg`, `.exe`, `.AppImage`, each with `1.1.0-rc1` in the name | n/a |
| REL-02 | Release body matches template | live tag push + `gh release view` | `gh release view v1.1.0-rc1 --json body --jq .body` returns text containing literal "## Summary", "## New in this version", "## Known issues", "## Install instructions", and `${VERSION}` resolved to `v1.1.0-rc1` (no literal `${VERSION}` remaining) | n/a |
| REL-04 | Non-developer tester can install | manual smoke test on a clean machine (deferred to tester rounds) | Tester downloads installer from the published release page (after maintainer manually flips draft → published), follows install instructions, launches app, runs Optimize Assets per Phase 10's smoke recipe. **First Phase 11 verification:** maintainer manually publishes the draft and runs through the install flow on the dev machine. | n/a |

### Sampling Rate

- **Per task commit:** No vitest sampling needed for YAML changes. The workflow YAML is "tested" by GHA's syntax validator on push (lints automatically; broken YAML shows up as "Workflow failed to parse" in the Actions tab). For tasks that touch TS source (e.g., the optional package.json `--publish never` bake-in is JSON, not TS — no test impact), normal `npm run test` continues.
- **Per phase gate:** **One live tag push of `v1.1.0-rc1`** + **one workflow_dispatch dry run from `main`**. Both must pass the validation map above. This is the entire Nyquist sample for Phase 11.
- **Phase 11 verification surface:** Live external GitHub API + GHA runner observation. No simulator, no mock, no stub.

This is the deliberate consequence of Phase 11 being a CI-infrastructure phase: the artifact under test is an executable workflow, and the only way to verify "the workflow does what we say" is to run it. Asserting YAML structure with a vitest test is a tautology and would not catch any of the eight pitfalls documented above.

### Wave 0 Gaps

- [ ] `.github/workflows/release.yml` — does not exist. Phase 11 creates it.
- [ ] `.github/release-template.md` — does not exist. Phase 11 creates it.
- [ ] `package.json` — `build:mac/win/linux` scripts do NOT have `--publish never` baked in. **Recommended addition** per Open Question 1.
- [ ] **No new vitest tests are required.** Existing 331-test suite continues to gate the `test` job; no new behavior tests for YAML.
- [ ] **No `tests/test_workflow.spec.ts`** or similar should be created. The validation surface is live.

### Falsifiable Acceptance Criteria (planner copy these into VALIDATION.md)

For Phase 11 to be considered closed:

1. ✅ **Live tag push:** Pushing `v1.1.0-rc1` to `origin` triggers a workflow run within 30 seconds (visible in `gh run list --workflow=release.yml`).
2. ✅ **Job sequencing:** The workflow run shows `test` ⇒ (`build-mac`, `build-win`, `build-linux`) ⇒ `publish`, with the three `build-*` jobs running concurrently after `test` succeeds.
3. ✅ **All four jobs complete green** in the run summary.
4. ✅ **Draft release exists:** `gh release view v1.1.0-rc1 --json isDraft` returns `{"isDraft": true}`.
5. ✅ **Three assets attached:** `gh release view v1.1.0-rc1 --json assets --jq '[.assets[].name] | sort'` returns three filenames containing `.dmg`, `.exe`, `.AppImage` and `1.1.0-rc1`.
6. ✅ **Body rendered:** `gh release view v1.1.0-rc1 --json body --jq .body` contains the four expected `##` headings AND no literal `${VERSION}` / `${TAG}` / `${INSTALL_DOC_LINK}` placeholder strings.
7. ✅ **Workflow_dispatch dry run:** Manually triggering the workflow on `main` (no tag) produces 3 GHA artifacts (`installer-mac`, `installer-win`, `installer-linux`) on the run summary page; `gh release view v0.0.0-dispatch-test 2>&1` (or any non-existent tag) returns "release not found"; the publish job appears as "Skipped" in the run UI.
8. ✅ **Atomicity sanity (verbal, not live test):** Maintainer reads the YAML and confirms (a) `publish.needs:` includes all three build jobs, (b) `publish.if:` excludes workflow_dispatch and non-tag pushes, (c) build jobs use `if-no-files-found: error`, (d) `softprops/action-gh-release` uses `fail_on_unmatched_files: true`.

If any of 1–7 fails on the first real run: investigate via `gh run view <id> --log`, fix in a follow-up commit, re-tag with a fresh `v1.1.0-rc2`, re-push. Phase 11 closure waits on a clean run.

## Security Domain

> `security_enforcement` not explicitly disabled in `.planning/config.json` — treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | n/a — workflow uses GHA-issued GITHUB_TOKEN, no user auth |
| V3 Session Management | no | n/a |
| V4 Access Control | yes | `permissions: contents: write` minimum scope (D-20); no broader scopes granted |
| V5 Input Validation | partial | `${{ github.ref_name }}` is treated as a tag name; envsubst on a controlled-source template — no external input flows into shell |
| V6 Cryptography | partial | `softprops/action-gh-release` uses HTTPS to GitHub API; no local crypto |
| V10 Malicious Code | yes | All third-party actions SHA-pinned (supply-chain hygiene); `softprops/action-gh-release@<sha>` rather than `@v2` floating tag |
| V14 Configuration | yes | Workflow file is the security surface — `permissions:` block must be tight; no `pull_request_target` triggers (we use `push` + `workflow_dispatch` only) |

### Known Threat Patterns for {GitHub Actions release pipeline}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Action hijack via tag re-pointing | Tampering | SHA-pin all third-party actions; bumping is a deliberate PR (D-03 enforces this) |
| Token leak via reckless `env: GITHUB_TOKEN: ...` | Information Disclosure | Do not export GITHUB_TOKEN to env in any job; rely on `${{ github.token }}` per-action input only (Pitfall 1) |
| Unauthorized release publication | Elevation of Privilege | `draft: true` + maintainer manual publish step; no `if: github.actor == ...` checks needed because public-repo PRs cannot push tags |
| `pull_request_target` trigger abuse | Elevation of Privilege | n/a — we don't use this trigger |
| Malicious dependency injection during `npm ci` | Supply-chain (Tampering) | `package-lock.json` committed; `npm ci` requires lockfile match; supply-chain is the same as in normal dev (Phase 10 didn't introduce new mitigation requirements) |
| Asset substitution mid-upload | Tampering | All-or-nothing publish (D-02); failed jobs leave no draft; manual cleanup if partial state observed |
| Workflow_dispatch abuse | Elevation of Privilege | Public-repo `workflow_dispatch` requires repo write access (collaborator/owner); rate limiting via concurrency block (D-19) |

**Phase 11 security posture summary:** The workflow's threat surface is small and well-bounded. The only first-class risks are (a) action-hijack via tag re-pointing — mitigated by SHA pinning, and (b) accidental token exposure — mitigated by minimum-scope `permissions:` block and not exporting `GITHUB_TOKEN` to env. No novel attack surface is introduced beyond what GHA inherently provides.

## Sources

### Primary (HIGH confidence)
- **GitHub Actions runner image inventories** (verified 2026-04-27 via WebFetch):
  - `actions/runner-images` macos-14-arm64-Readme.md
  - `actions/runner-images` Windows2022-Readme.md
  - `actions/runner-images` Ubuntu2204-Readme.md
- **Action versions + SHAs** (verified 2026-04-27 via `gh api`):
  - `actions/checkout` v4.3.1 → `34e114876b0b11c390a56381ad16ebd13914f8d5`
  - `actions/setup-node` v4.4.0 → `49933ea5288caeca8642d1e84afbd3f7d6820020`
  - `actions/upload-artifact` v4.6.2 → `ea165f8d65b6e75b540449e92b4886f43607fa02`
  - `actions/download-artifact` v4.3.0 → `d3f86a106a0bac45b974a628896c90dbdf5c8093`
  - `softprops/action-gh-release` v2.6.2 → `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65`
- **`softprops/action-gh-release` README** (verified 2026-04-27): inputs, outputs, permissions, draft semantics, body_path precedence.
- **electron-builder publish docs** — https://www.electron.build/publish.html — `--publish never`, GH_TOKEN auto-publish behavior.
- **GitHub Actions concurrency docs** — https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
- **Phase 10 RESEARCH.md** §"Common Pitfalls" — sharp host-arch trap (already cleared by native runners), AppImage/libfuse2 distinction, cross-build fragility.

### Secondary (MEDIUM confidence)
- **electron-builder issue #9598** (2026) — Ubuntu 25.10 GLIBC 2.29 mismatch with appimage toolset 1.0.2; supports `ubuntu-22.04` pin choice.
- **softprops/action-gh-release issue #602** — multi-draft creation when >100 releases exist; mitigation = pin to v2.6.2 (fixed).
- **electron-builder code-signing-mac docs** — https://www.electron.build/code-signing-mac.html — `CSC_IDENTITY_AUTO_DISCOVERY` semantics, ad-hoc default behavior.
- **GitHub community discussion #41518** — concurrency primitive's "one running, one pending" limit.
- **GitHub community discussion #26714** — tag glob pattern matching including `-rc1` suffixes.

### Tertiary (LOW confidence — flagged for live-run validation)
- Tag glob `v*.*.*` matching `v1.1.0-rc1` — community-reported as working; first real-run is the canonical proof.
- `softprops/action-gh-release` partial-upload atomicity — undocumented in README; inferred from issue tracker; manual cleanup is the documented remediation.

## Metadata

**Confidence breakdown:**
- Standard stack (action versions/SHAs): **HIGH** — directly verified via `gh api` against the upstream repos on 2026-04-27.
- Architecture (job graph, atomicity pattern): **HIGH** — fully locked in CONTEXT D-01..D-23; this research only fills in YAML-level details.
- Pitfalls: **HIGH** for GH_TOKEN auto-publish (multi-year multi-issue track record), AppImage/GLIBC (current 2026 issue), tag-glob matching (well-documented). **MEDIUM** for `CSC_IDENTITY_AUTO_DISCOVERY` necessity (defensive, not strictly required) and softprops draft atomicity (inferred from issue tracker, not advertised in README).
- Validation architecture: **HIGH** — the framing (live workflow run, no fake unit tests) is the only meaningful gate for this phase type.
- Security: **HIGH** — minimum-scope token, SHA-pinned actions, no novel attack surface.

**Research date:** 2026-04-27

**Valid until:** 2026-05-27 (30 days). Bump if any of the following ship a major release: `softprops/action-gh-release` (v3 was just published 2026-04-12), `actions/upload-artifact`, `electron-builder` (26.x → 27.x), GHA runner-image major bumps. The Action SHAs in this document are stable indefinitely (SHAs never re-point); the recommended versions may need refresh if upstream releases newer-stable lines.

---

## RESEARCH COMPLETE

# Phase 11: CI release pipeline (GitHub Actions → draft Release) - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

A GitHub Actions workflow that, on `v*.*.*` tag push, runs vitest then builds Windows / macOS / Linux installers in parallel jobs and publishes all three assets atomically to a **draft** GitHub Release for that tag. A `workflow_dispatch` manual trigger runs the same pipeline as a dry run (no draft release published; artifacts only). All-or-nothing semantics: any failure (test or build) prevents the release from being created.

**Out of scope (downstream phases own these):**
- `INSTALL.md` content and Gatekeeper / SmartScreen tester walkthroughs → Phase 12 (REL-03)
- Auto-update wiring (`electron-updater`, latest.yml feeds) → Phase 12
- Production source-map upload to crash backend → Phase 13 (TEL-03)
- Code-signing certs (Apple Developer ID, Windows EV) → out of v1.1 entirely

</domain>

<decisions>
## Implementation Decisions

### Workflow architecture (publish atomicity, CI-05)
- **D-01:** Single workflow file at `.github/workflows/release.yml` with five jobs in this dependency graph:
  1. `test` — runs `npm ci` + `npm run test` on `ubuntu-latest` (vitest is platform-agnostic; pure TS + jsdom). Single-OS test is sufficient.
  2. `build-mac` — `needs: test`, runs on `macos-14` (arm64 native — required for `@img/sharp-darwin-arm64` resolution and DIST-02 arm64 lock).
  3. `build-win` — `needs: test`, runs on `windows-2022`.
  4. `build-linux` — `needs: test`, runs on `ubuntu-22.04`.
  5. `publish` — `needs: [build-mac, build-win, build-linux]`, runs on `ubuntu-latest`. Downloads all three platform artifacts, creates draft release with all assets attached in a single API call.
- **D-02:** Build jobs upload installers as **GHA workflow artifacts** (`actions/upload-artifact@v4`), NOT directly to a release. The `publish` job is the only step that touches the GitHub Releases API. This is the mechanism that satisfies CI-05 (all-or-nothing): if any platform build fails, `publish` never runs, no draft is created, no partial release exists.
- **D-03:** Use `softprops/action-gh-release@v2` in the `publish` job (well-maintained, handles draft creation + multi-asset upload in one step). Pin to a specific commit SHA for supply-chain hygiene.

### `workflow_dispatch` dry-run shape (CI-06)
- **D-04:** Same workflow file. The `publish` job is gated by `if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')`. On `workflow_dispatch` from `main`, `test` + the three `build-*` jobs run normally and upload artifacts (downloadable from the workflow run page for inspection); `publish` is skipped — no draft release created.
- **D-05:** No `workflow_dispatch` inputs in v1.1 — the dry run is just "run the workflow without a tag." Keeps the surface minimal.

### Runner OS pinning
- **D-06:** Pin to specific images for reproducibility:
  - macOS: `macos-14` (arm64; matches DIST-02 arm64 target and Phase 10 dev host).
  - Windows: `windows-2022`.
  - Linux: `ubuntu-22.04` (libfuse2 is `libfuse2`, not the renamed `libfuse2t64` — avoids Phase 10 RESEARCH Pitfall 5 in the *build* environment; testers on Ubuntu 24.04+ still need `libfuse2t64`, but that is a Phase 12 INSTALL.md concern).
  - Test job: `ubuntu-latest` (no compiled deps, vitest only — floating is fine).
- **D-07:** Image bumps tracked in a comment block at top of `release.yml` so future updates are deliberate, not silent.

### Tag ↔ version reconciliation (DIST-07, CI-01)
- **D-08:** Fail-fast guard. The `test` job (or a tiny upstream `validate` step) reads `package.json#version` and the trimmed tag (`${{ github.ref_name }}` minus the leading `v`) and fails the workflow with a clear error if they don't match — e.g. "Tag v1.1.0-rc1 does not match package.json version 1.1.0-rc2. Bump package.json before tagging."
- **D-09:** No auto-bump of `package.json` from the tag. Reasoning: `package.json#version` is committed and tracked through Phase 10; bumping it from CI desyncs git history from artifact filenames. The human-discipline path is `npm version <X> && git push --tags` in one step — simpler mental model.
- **D-10:** Guard does NOT run on `workflow_dispatch` (dry runs use whatever version `package.json` has; `github.ref_name` is `main`, not a tag).

### Release notes template (REL-02)
- **D-11:** Template lives at `.github/release-template.md` (a stable file in the repo). Sections: **Summary** / **New in this version** / **Known issues** / **Install instructions**. Placeholders: `${VERSION}`, `${TAG}`, `${INSTALL_DOC_LINK}` (links to `INSTALL.md` once Phase 12 lands; for Phase 11 we link to `README.md` or the repo root).
- **D-12:** Workflow `publish` job substitutes placeholders via a small inline `sed` step (or `envsubst`) and passes the rendered body to `softprops/action-gh-release` via the `body` input.
- **D-13:** First-launch bypass instructions (Gatekeeper "Open Anyway" / SmartScreen "Run anyway" / Linux `chmod +x`) are summarized inline in the template since Phase 12 INSTALL.md doesn't exist yet at Phase 11 ship time. The template is updated in Phase 12 to point at INSTALL.md.

### Caching strategy
- **D-14:** Use `actions/setup-node@v4` with `cache: 'npm'` (built-in lockfile-based cache) on every job. Saves ~30s/job consistently.
- **D-15:** Skip explicit `~/.cache/electron-builder` caching in v1.1. Reasoning: electron-builder cache is large (~150MB) and only saves ~30s on cold runs; complexity isn't worth it for tag-triggered releases (low-frequency).
- **D-16:** Use `npm ci` (not `npm install`) on every job — reproducible, respects `package-lock.json`, fails on lockfile drift.

### Linux AppImage build environment
- **D-17:** No `apt install libfuse2` step needed in the build job. electron-builder produces the AppImage from squashfs + AppRun without invoking FUSE on the build host — FUSE is only needed at *run* time on the tester's machine. CI does not execute the AppImage; it just produces and uploads it.
- **D-18:** No smoke-launch of the built AppImage on the Linux runner. The tester smoke from Phase 10's 10-SMOKE-TEST.md is the verification surface; CI's job is to produce the artifact, not to functionally validate it. (DIST-06 dynamic verification on Linux comes via tester rounds in v1.1, the way it does for Windows.)

### Concurrency
- **D-19:** Add `concurrency: { group: release-${{ github.ref }}, cancel-in-progress: false }` to prevent two simultaneous workflows for the same tag from colliding on the draft release. `cancel-in-progress: false` because aborting a half-built release is worse than serializing.

### Permissions
- **D-20:** Workflow-level permissions: `contents: write` (to create the draft release). No `packages:`, `id-token:`, or other elevated scopes. Default `${{ secrets.GITHUB_TOKEN }}` is sufficient — no PAT needed.

### Token / secrets
- **D-21:** No additional secrets required for Phase 11. (Phase 13 will add a `SENTRY_AUTH_TOKEN` or equivalent for source-map upload — not us.)

### Failure-mode debug surface
- **D-22:** Every build job uploads its `release/` output AND its `dist-electron/` (or equivalent vite output) as a workflow artifact, even on success — gives a debug surface if a tester later reports a regression and we want to inspect the exact bits CI produced. Retention: 14 days (default).
- **D-23:** Optional `actions/upload-artifact` step on failure for the per-platform `electron-builder` log files (`release/builder-debug.yml` if it exists) — best-effort; do not fail the workflow if the log is absent.

### Claude's Discretion
- Exact YAML indentation/formatting style.
- Step ordering within a single job.
- Specific action versions/SHAs (pin to current latest stable as of plan-phase).
- Whether to factor the version-guard into a reusable composite action vs inline shell.
- Exact wording of the release-template prose (within REL-02 section structure).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 11 contract
- `.planning/REQUIREMENTS.md` — CI-01..CI-06, REL-01, REL-02, REL-04 (Phase 11 scope); REL-03 / UPD-* / TEL-* explicitly NOT in scope.
- `.planning/ROADMAP.md` §"Phase 11" — Goal statement, success criteria 1–5, dependency on Phase 10.

### Phase 10 deliverables (Phase 11 input contract)
- `.planning/phases/10-installer-build-electron-builder-all-3-platforms/10-SMOKE-TEST.md` — Per-platform build commands, expected artifact paths, shell assertions (`codesign -dv`, `plutil -p`, `signtool verify`), Pitfall references. Phase 11 CI must produce artifacts that satisfy these same assertions.
- `.planning/phases/10-installer-build-electron-builder-all-3-platforms/10-RESEARCH.md` §"Common Pitfalls" — Pitfall 1 (sharp host-arch trap, solved by native runners), Pitfall 3 (cross-build from macOS arm64, solved by using a real Windows runner), Pitfall 5 (libfuse2 on Ubuntu 24.04 — tester concern, not build concern).
- `electron-builder.yml` — `mac.target`, `win.target`, `linux.target`, `artifactName` template (`${productName}-${version}-${arch}.${ext}`), `asarUnpack` lines for sharp/@img.
- `package.json` §scripts — `build:mac`, `build:win`, `build:linux`, `test` (the four commands the workflow shells out to).

### Project-level
- `.planning/PROJECT.md` §"Current Milestone: v1.1 Distribution" — milestone goal, signing posture (no paid certs in v1.1), Linux verified via CI only.
- `CLAUDE.md` — non-obvious facts (none directly relevant to CI but agents should know the project).

### External
- electron-builder docs: https://www.electron.build/configuration/configuration — `--publish never` flag (we publish via `softprops/action-gh-release`, not via electron-builder's built-in publisher; cleaner separation).
- `softprops/action-gh-release` README: https://github.com/softprops/action-gh-release — draft release + multi-asset upload syntax.
- GitHub Actions runner image catalog: https://github.com/actions/runner-images — for `macos-14` / `windows-2022` / `ubuntu-22.04` software lists (verifies Node toolchain availability without manual install).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`package.json` build scripts (Phase 10)** — `build:mac`, `build:win`, `build:linux` are the exact commands the CI jobs invoke. No CI-specific build script needed.
- **`electron-builder.yml` (Phase 10)** — already configured for all three targets with correct `artifactName` template. CI does not modify this file.
- **`10-SMOKE-TEST.md` (Phase 10)** — the manual verification recipe. CI artifacts must satisfy the same shell assertions when downloaded by a tester.

### Established Patterns
- **No CI infrastructure exists yet.** No `.github/` directory in the repo. Phase 11 is greenfield CI.
- **`npm run test`** = vitest run (331 tests passing as of v1.0). No flaky tests known. Single-OS test job is justifiable.
- **Version is committed in `package.json#version` = `1.1.0-rc1`** matching the planned tag `v1.1.0-rc1`. Phase 10 set the precedent of committing the version bump as part of the release-prep phase.

### Integration Points
- **Git remote:** `https://github.com/Dzazaleo/Spine_Texture_Manager.git` (origin) — public repo, default `GITHUB_TOKEN` has `contents: write` available without manual config.
- **First real tag this workflow will fire on:** `v1.1.0-rc1` (matches `package.json#version` already committed in Phase 10). Phase 11 verification SHOULD include actually pushing this tag and observing a successful draft release with three assets.
- **Existing tag:** `v1.0` (predates this workflow; the workflow only fires on tags pushed AFTER `release.yml` is committed to `main`).

### Greenfield surface
- `.github/workflows/release.yml` — new file, the entire workflow.
- `.github/release-template.md` — new file, the release-notes template.

</code_context>

<specifics>
## Specific Ideas

- The user's verification path for Phase 11 is "push `v1.1.0-rc1` to GitHub and observe the draft release with three platform installers attached." Plan-phase should treat this end-to-end live run as an explicit verification task, not a smoke afterthought.
- All-or-nothing publish (CI-05) is the load-bearing correctness property of this workflow. The artifact-upload-then-publish-job pattern (D-02) is the architectural choice that makes this trivially true.
- Linux is uniquely dependent on this CI: it's the ONLY surface where a Linux build is produced and verified for v1.1. Plan-phase should include a sanity check that the AppImage at least extracts and reports a version (`--appimage-extract-and-run --version`) before declaring CI-04 satisfied.

</specifics>

<deferred>
## Deferred Ideas

- **Source-map upload from CI to crash backend** → Phase 13 / TEL-03. The `release.yml` workflow may grow a step in Phase 13; we do NOT add a placeholder in Phase 11.
- **`latest.yml` / `latest-mac.yml` auto-update feed publication** → Phase 12 / UPD-01. electron-updater needs these emitted into the release; Phase 12 will modify the `publish` job to include them.
- **Code-signing in CI (Apple Developer ID notarization, Windows EV)** → out of v1.1 entirely. No `APPLE_ID` / `CSC_LINK` secrets in Phase 11.
- **Per-platform smoke-test step in CI** (e.g., launching the .dmg, .exe, .AppImage with a synthetic fixture) → not v1.1. Tester rounds and the manual `10-SMOKE-TEST.md` recipe are the dynamic verification surface.
- **Universal macOS binary (arm64 + x64)** → out of scope. DIST-02 explicitly accepts arm64-only.
- **Concurrency tuning** (cancel-in-progress, queueing) beyond D-19 → revisit if release cadence picks up.
- **Self-hosted runners** → not v1.1; GitHub-hosted runners are sufficient for current build minutes budget.
- **Release-notes auto-generation from commit log** (e.g., `release-drafter`) → considered, deferred. Manual editing of the draft body before publish is acceptable in v1.1.

</deferred>

---

*Phase: 11-ci-release-pipeline-github-actions-draft-release*
*Context gathered: 2026-04-27*

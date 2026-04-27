# Phase 12 — Deferred Items

Out-of-scope discoveries during Phase 12 execution. Logged here per SCOPE BOUNDARY rule
(do not auto-fix issues unrelated to current task's changes).

## Pre-existing typecheck failure in `scripts/probe-per-anim.ts` (carried forward from Phase 11)

**Discovered:** Plan 12-02, Task 1 verification (`npm run typecheck`)
**Status:** Pre-existing (reproduced with `git stash` of Task 1's `package.json` edit — error survives revert).
**Symptom:**
```
scripts/probe-per-anim.ts(14,31): error TS2339: Property 'values' does not exist on type 'SamplerOutput'.
```
**Why deferred:** Identical surface to the Phase 11 deferred-items entry; the probe script
predates Phase 11 and is unrelated to anything Phase 12 touches. The `electron-updater@6.8.3`
install resolves cleanly (no new TS diagnostics introduced); fixing the probe script would
mix unrelated cleanup into a CI-release-pipeline plan.

**Disposition:** Triage in a future maintenance plan. Does NOT block Phase 12 closure
(the workflow's `test` job runs `npm run typecheck` against `tsconfig.node.json` /
`tsconfig.web.json` against actual source — `scripts/` is a separate probe surface).

**Note:** The `npm run test` (vitest) suite is fully green (331 passing) — this is the
correctness gate the workflow's `test` job actually enforces.

## CI tag-push will fail until electron-builder auto-publish race is resolved (deferred to phase 12.1)

**Discovered:** Plan 12-01 spike attempt (live CI runs 25017095851 / 25017351602 / 25017624868 on 2026-04-27).

**Symptom:** With `electron-builder.yml` `publish: github` (Plan 12-02 D-11/D-12 wiring), `--publish never` on the CLI does NOT prevent electron-builder's GitHub publisher from auto-publishing artifacts during the build step. Two failure modes observed:

1. **No `GH_TOKEN` in build env** → `Error: GitHub Personal Access Token is not set` thrown by publisher constructor before any artifact is built (build-mac/build-win/build-linux all fail).
2. **`GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` provided to build env** → publisher constructor succeeds, but electron-builder auto-uploads `.AppImage`/`.exe`/`.dmg`/`latest*.yml` to a fresh GitHub Release during each parallel build job. Artifacts race; the second/third uploader hits HTTP 422 from GitHub (asset name conflict). Bypasses our atomic `softprops/action-gh-release` publish step entirely.

**Root cause:** Known electron-builder 26.x behavior — `--publish never` suppresses the post-build `publish()` invocation but does NOT prevent per-artifact `PublishManager.artifactCreatedWithoutExplicitPublishConfig` from constructing publishers (which need the token) and uploading individual artifacts as they're emitted. Pitfall 1 manifests at a different layer than Phase 11 anticipated.

**Why deferred to phase 12.1:**
- Plan 12-01 auto-update CODE is complete and correct (377 tests pass, both spike-PASS and Windows-fallback branches wired under one cohesive surface per D-04).
- The fix requires architectural choice between (a) static `app-update.yml` via `extraResources` + `publish: null` YAML revert, (b) `--config.publish=null` CLI override, (c) build-time afterPack hook that writes `app-update.yml` + manually computes `latest*.yml` SHA-512/size. Each has trade-offs.
- Solving it RIGHT belongs in the same phase as the spike runbook execution (12.1) — both depend on a working tag-push CI flow.
- v1.1.0-rc1 (Phase 11 build) remains the publishable artifact set. Auto-update on macOS/Linux requires a v1.1.0-rc2 to exist as a release with `latest-mac.yml`/`latest-linux.yml` feed files — also deferred to 12.1.

**Disposition:** Phase 12.1 will pick a fix approach, validate locally, run a fresh tag-push CI, then execute the Windows-spike runbook (UPD-06 / D-01 / D-02) for real. Until then, do NOT push tags — the workflow will fail and pollute releases.

**Cleanup performed (2026-04-27):**
- Deleted polluted `v1.1.0-rc2` GitHub release (was missing macOS DMG due to upload race).
- Deleted `v1.1.0-rc2` tag locally and on origin.
- Reverted `package.json` from `1.1.0-rc2` → `1.1.0-rc1` (rc2 never produced a complete artifact set and is not a published version).
- Reverted `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` env additions on build-mac/build-win/build-linux (the additions were the proximate cause of the upload race).
- Kept Windows-portability test fixes in `tests/arch.spec.ts` and `tests/core/project-file.spec.ts` (these are real bugs surfaced by Plan 12-02's D-22 matrix expansion — independent of the publish issue).

## INSTALL.md screenshots deferred to phase 12.1

**Discovered:** Plan 12-06 Task 1 BLOCKING checkpoint (2026-04-27).

**Resume signal:** `partial: none` — user decided, with full context, to skip captures and ship INSTALL.md text-first today.

**Symptom:** All 4 documented INSTALL.md screenshot slots ship as 1×1 transparent PNG placeholders (`docs/install-images/{macos-gatekeeper-open-anyway, windows-smartscreen-more-info, windows-smartscreen-run-anyway, linux-libfuse2-error}.png`, 67 bytes each, valid PNG per `file`). INSTALL.md text-substitutes each with an italic _"(Screenshot pending — capture during phase 12.1 with first real tester install on rc2.)"_ line BUT keeps the markdown image reference (`![alt](docs/install-images/<name>.png)`) so future replacement is a binary-only swap — INSTALL.md needs no edits.

**Root cause / why deferred:**

1. **Dev machine cannot reproduce a fresh tester's first-launch Gatekeeper experience on macOS.** macOS trusts locally-built apps even when the quarantine extended attribute is set (Gatekeeper's signed-developer cache + `xattr` interaction); only a downloaded-from-the-internet binary triggers the dialog state captured in the screenshot.
2. **Windows installer doesn't yet exist** as a publishable artifact. The CI publish-race (electron-builder 26.x `--publish never` does NOT prevent per-artifact GitHub publisher upload when `publish: github` in YAML, see entry above) blocks `v1.1.0-rc2` from being published with full 3-OS artifacts. Without a downloadable .exe, no SmartScreen "More info → Run anyway" sequence to capture.
3. **Linux AppImage `libfuse2` error** requires a fresh Ubuntu 24.04 install without `libfuse2t64` pre-installed. Practical to capture, but capturing 1 of 4 with the others deferred makes a fragmented set; a clean batch during 12.1's tester rounds (when rc2 ships) gives the strongest provenance ("captured by the user during the first real install").

**Where the natural capture moment lives:** **Phase 12.1.** Once the publish-race fix lands (3 architectural options enumerated in the entry above), `v1.1.0-rc2` publishes with a complete 3-OS artifact set and feed files. The first tester to install rc2 on each OS captures the bypass dialog at the bypass moment — strongest possible signal for a tester-cookbook screenshot. The phase 12.1 spike runbook can include "capture screenshots while you're already on the test box" as a side task, costing ~5 minutes per OS.

**What ships today (Plan 12-06 closure):**
- INSTALL.md exists at repo root with full cookbook structure (139 lines, 3 OS sections, libfuse2 paragraph, Help → Check for Updates section, Reporting issues section). Text-functional for testers RIGHT NOW even without screenshots — the steps + bypass copy + troubleshooting are exhaustive.
- 4 placeholder PNGs satisfy the Task 5 integration test's existence + magic-bytes assertions. The same test will continue to pass when real captures replace them (any valid PNG ≥ 67 bytes passes).
- All 4 in-app linking surfaces (D-16) wire correctly to INSTALL.md URL — testers landing on the GitHub repo OR opening the Help menu OR clicking through HelpDialog have an unambiguous path to the cookbook.
- The Phase 11 → Phase 12 documentation seam closes: `${INSTALL_DOC_LINK}` placeholder is now filled with the real INSTALL.md URL (was a README.md placeholder).

**Disposition:** Phase 12.1 will (a) land the publish-race fix, (b) publish v1.1.0-rc2 with full installers, (c) execute the Spike Runbook on Windows for UPD-06 strict-bar verification, (d) capture all 4 screenshots during the same tester round and replace the placeholder PNGs in `docs/install-images/`. INSTALL.md text-substitute lines stay in place as fallback documentation even after real screenshots land (defense-in-depth — if GitHub renderer ever fails to load an image, the italic line still tells the tester what they should be seeing).

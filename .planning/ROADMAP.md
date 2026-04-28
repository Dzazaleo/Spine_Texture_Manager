# Roadmap: Spine Texture Manager

## Milestones

- ✅ **v1.0 MVP** — Phases 0–9 + 08.1 + 08.2 (shipped 2026-04-26) — full archive at [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Distribution** — Phases 10–12 + 12.1 (shipped 2026-04-28; v1.1.0 final at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.0; 4 carry-forwards to v1.1.1 documented in 12.1-VERIFICATION.md)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 0–9, plus 08.1 + 08.2 inserted) — SHIPPED 2026-04-26</summary>

- [x] Phase 0: Core-math spike — derisk pure-TS sampler against `fixtures/SIMPLE_PROJECT` (7/7 plans) — completed 2026-04-23
- [x] Phase 1: Electron + React scaffold with JSON drop-load (5/5 plans) — completed 2026-04-23
- [x] Phase 2: Global Max Render Source panel (3/3 plans) — completed 2026-04-23
- [x] Phase 3: Animation Breakdown panel (3/3 plans) — completed 2026-04-23
- [x] Phase 4: Scale overrides (3/3 plans, D-91 source-fraction semantics) — completed 2026-04-24
- [x] Phase 5: Unused attachment detection (4/4 plans) — completed 2026-04-24
- [x] Phase 6: Optimize Assets — sharp Lanczos3 image export (7/7 plans) — completed 2026-04-25
- [x] Phase 7: Atlas Preview modal — maxrects-packer + canvas (6/6 plans) — completed 2026-04-25
- [x] Phase 8: Save/Load project state — `.stmproj` v1 schema (5/5 plans) — completed 2026-04-26
- [x] Phase 08.1: Close Phase 8 verification gaps — locate-skeleton recovery + dirty-guard wiring (6/6 plans, INSERTED) — completed 2026-04-26
- [x] Phase 08.2: File menu + Cmd+O accelerator gating fix (5/5 plans, INSERTED) — completed 2026-04-26
- [x] Phase 9: Complex-rig hardening + polish — `worker_threads` sampler, TanStack Virtual at N≥100, Settings + Help dialogs (8/8 plans, N2.2 wall-time 606 ms on `fixtures/Girl/`) — completed 2026-04-26

</details>

### ✅ v1.1 Distribution (Phases 10–12 + 12.1) — SHIPPED 2026-04-28

- [x] **Phase 10: Installer build (electron-builder, all 3 platforms)** — Local npm scripts produce Windows `.exe`, macOS `.dmg`, Linux `.AppImage` from existing electron-builder config; `sharp` libvips ships intact. (completed 2026-04-27)
- [x] **Phase 11: CI release pipeline (GitHub Actions → draft Release)** — Tag-triggered workflow runs vitest then builds all 3 platforms in parallel and uploads installer assets to a draft GitHub Release. (Plan 11-01 file-authoring wave complete 2026-04-27; Plan 11-02 live verification pending.) (completed 2026-04-27)
- [x] **Phase 12: Auto-update + tester install docs** — `electron-updater` wired to GitHub Releases feed (startup + on-demand check, restart-prompt UX, offline-graceful, Windows fallback path); `INSTALL.md` with Gatekeeper / SmartScreen / libfuse2 bypasses + 4 in-app + CI linking surfaces. Live UPD-06 strict-bar Windows-spike runbook deferred to phase 12.1 due to electron-builder 26.x publish race; INSTALL.md screenshots deferred to same phase 12.1 round (manual-fallback variant ships LIVE on Windows by default; INSTALL.md text-functional today with placeholder PNGs). (completed 2026-04-27)
- [x] **Phase 12.1: Installer + auto-update live verification (INSERTED)** — D-10 publish-race fix landed (`scripts/emit-latest-yml.mjs` post-build synthesizer + `electron-builder.yml` `publish: null`); validated by 3 successful CI runs (rc2 / rc3 / v1.1.0) each producing complete 6-asset GitHub Releases atomically. v1.1.0 final published. INSTALL.md updated with macOS Sequoia Gatekeeper UX + 3 real screenshots (1 Linux PNG deferred to v1.1.1). README `## Building on Windows` section landed (winCodeSign symlink papercut documented). 4 carry-forwards to v1.1.1: Linux runbook, rc → rc auto-update lifecycle (electron-updater channel-matching bug), Windows menu-bar autoHideMenuBar cosmetic, About panel cosmetic. (completed 2026-04-28)

## Phase Details

### Phase 10: Installer build (electron-builder, all 3 platforms)

**Goal**: User can produce a Windows `.exe`, macOS `.dmg`, and Linux `.AppImage` installer from a tagged checkout, with the bundled `sharp` native binary surviving packaging on every platform that the user can build locally (macOS + Windows; Linux is best-effort locally and verified by CI in Phase 11).

**Depends on**: Nothing in v1.1 (builds on existing v1.0 `electron-builder` 26 config in `electron-builder.yml`).

**Requirements**: DIST-01, DIST-02, DIST-03, DIST-04, DIST-05, DIST-06, DIST-07

**Success Criteria** (what must be TRUE):
  1. Running `npm run build:mac` on the developer's macOS machine produces a `.dmg` whose installed app launches, loads `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, and completes an Optimize Assets export to a non-zero output folder (proves `sharp` libvips bundled correctly).
  2. Running `npm run build:win` produces a Windows `.exe` (NSIS) whose installed app, when transferred to a Windows machine and run with the SmartScreen bypass, launches and completes the same Optimize Assets export.
  3. The macOS `.dmg` is signed ad-hoc (`codesign -dv` shows an ad-hoc signature) and Gatekeeper presents the expected first-launch prompt rather than blocking outright; Windows `.exe` is unsigned (no embedded code signature), as locked by v1.1 scope.
  4. Installer file names and the version string embedded in the macOS `Info.plist` and Windows version resource match `package.json`'s `version` field exactly.
  5. Linux `.AppImage` build is attempted locally only as a smoke test; failure here is acceptable in this phase (Linux is verified by CI in Phase 11), but the `electron-builder.yml` Linux target configuration is complete and committed.

**Plans**: 3 plans
- [x] 10-01-PLAN.md — Version bump (0.0.0 → 1.1.0-rc1) + per-platform npm scripts + build/.gitkeep sentinel (Wave 1)
- [x] 10-02-PLAN.md — electron-builder.yml extension: mac ad-hoc + Windows NSIS unsigned + Linux AppImage (Wave 2)
- [x] 10-03-PLAN.md — Build macOS .dmg, capture shell assertions, write 10-SMOKE-TEST.md, manual Optimize Assets verification (Wave 3, includes checkpoint)

### Phase 11: CI release pipeline (GitHub Actions → draft Release)

**Goal**: Pushing a `v*.*.*` tag triggers a GitHub Actions workflow that runs the full test suite then builds Windows, macOS, and Linux installers in parallel jobs and attaches all three assets to a draft GitHub Release for that tag — establishing the user-facing distribution channel and providing the only verification surface for the Linux build.

**Depends on**: Phase 10 (installer config must produce working artifacts before CI can build them).

**Requirements**: CI-01, CI-02, CI-03, CI-04, CI-05, CI-06, REL-01, REL-02, REL-04

**Success Criteria** (what must be TRUE):
  1. Pushing tag `v1.1.0-rc1` to GitHub triggers a workflow that runs vitest, then builds Windows, macOS, and Linux installers in parallel jobs, and publishes a draft GitHub Release with three installer assets attached.
  2. A `workflow_dispatch` manual trigger on `main` runs the same pipeline as a dry run (does not produce a published release; artifacts available as workflow artifacts for inspection).
  3. Introducing a deliberate vitest failure on a branch and tagging it causes the workflow to abort before the installer-build jobs run, and no draft release is created.
  4. Causing one platform job to fail (e.g. simulating a Windows build break) prevents publication of the draft release with partial assets — the workflow reaches a terminal failure state with all-or-nothing semantics.
  5. The draft release body, when manually published, follows the documented release-notes template (summary / new in this version / known issues / link to install instructions) and a non-developer tester downloading from the published release page can install the app on their OS without a `git`/Node.js toolchain.

**Plans**: 2 plans
- [x] 11-01-PLAN.md — Author .github/workflows/release.yml + .github/release-template.md + bake `--publish never` into package.json build:* scripts (Wave 1, autonomous) — completed 2026-04-27, three atomic commits (69c8cc1, eb8a904, c253eb6)
- [x] 11-02-PLAN.md — Live verification: push v1.1.0-rc1, capture gh CLI evidence for the 8 falsifiable criteria, workflow_dispatch dry run, atomicity audit, REL-04 install smoke (Wave 2, has checkpoints)

### Phase 12: Auto-update + tester install docs

**Goal**: Installed copies of the app check the GitHub Releases feed for newer versions, prompt the user to download and restart, degrade gracefully when offline, and handle the Windows-unsigned-build edge case via a documented manual-update fallback. Testers have a single-page `INSTALL.md` covering Gatekeeper / SmartScreen bypass for first launch.

**Depends on**: Phase 11 (auto-update reads from published GitHub Releases — needs a real release feed to test against).

**Requirements**: UPD-01, UPD-02, UPD-03, UPD-04, UPD-05, UPD-06, REL-03

**Success Criteria** (what must be TRUE):
  1. Installing v1.1.0, then publishing v1.1.1, then re-launching the v1.1.0 app on macOS or Linux causes a non-blocking update prompt to appear with the v1.1.1 release-notes summary; accepting downloads the update and prompts for restart, declining defers without re-prompting on next startup.
  2. Selecting Help → Check for Updates with no newer version available shows a "you're up to date" confirmation; selecting it with a newer version available shows the same prompt as the startup check.
  3. Launching the app with the network disconnected (or with GitHub unreachable) does not show an update-related error dialog, does not block startup, and does not crash — the app proceeds normally to the load screen.
  4. On Windows, the auto-update path either works end-to-end with the unsigned build (verified during plan-phase spike) **or** the documented manual-update fallback path is wired: a non-blocking notification surfaces in the app pointing to the latest GitHub Release page, with no nag loop and no crash.
  5. The repo root contains an `INSTALL.md` that walks a non-developer through download → install → first launch on each of the three OSes, including the macOS Gatekeeper right-click-Open bypass and the Windows SmartScreen "More info → Run anyway" flow.

**Plans**: 6 plans
- [x] 12-01-PLAN.md — Auto-update wiring (electron-updater + UpdateDialog + Help menu + Later persistence + Windows fallback) — completed 2026-04-27, 8 task commits (f208478..09f9369) + 2 follow-ups (51d12cb test fixes + 44bd03b spike-defer cleanup) + 1 docs commit (f31d494 SPIKE OUTCOME = DEFERRED to phase 12.1); UPD-01..UPD-05 closed; manual-fallback variant ships LIVE on Windows by default (SPIKE_PASSED=false on win32); full auto-update path live on macOS/Linux; live UPD-06 spike runbook deferred to phase 12.1 due to electron-builder 26.x publish race surfaced during 3 attempts
- [x] 12-02-PLAN.md — GHA latest*.yml feed publication + electron-builder.yml publish flip + CI test-matrix expansion to 3 OSes (Wave 1, autonomous) — completed 2026-04-27, three atomic commits (a533c21, 7d9330d, 6a8a125); UPD-06 closed
- [x] 12-03-PLAN.md — F1 atlas-image URL Windows fix at AtlasPreviewModal.tsx:116 via pathToFileURL bridge (Wave 2, autonomous) — completed 2026-04-27, four atomic task commits (97dd77d Task 1 RED, e6558c3 Task 1 GREEN, d92748b Task 2 RED, dc8155c Task 2 GREEN); new atlas:resolve-image-url IPC handler + window.api.pathToImageUrl preload bridge with cross-platform `{ windows: true }` hardening; renderer no longer concatenates `app-image://localhost` with raw paths; F1 was a CONTEXT-folded item per D-19 (no roadmap requirement ID); 384/384 vitest passing
- [x] 12-04-PLAN.md — F2 file-picker UX fix in AppShell.tsx pickOutputDir defaultPath derivation (Wave 2, autonomous) — completed 2026-04-27, two atomic task commits (013c7af Task 1 RED, 4e7fe08 Task 1 GREEN); single-line subtraction removes '/images-optimized' suffix that triggered Windows save-as picker behavior; D-20 Part 1 only — Parts 2 + 3 RESEARCH-VERIFIED already correct in src/main/ipc.ts and unchanged; new tests/renderer/app-shell-output-picker.spec.tsx (3 derivation tests + 1 source-grep regression test); F2 was a CONTEXT-folded item per D-20 (no roadmap requirement ID); 388/388 vitest passing
- [x] 12-05-PLAN.md — F3 Spine 4.2 version guard in src/core/loader.ts + SpineVersionUnsupportedError typed envelope (Wave 2, autonomous) — completed 2026-04-27, six atomic task commits (7e4b858 Task 1 RED, a1c608c Task 1 GREEN, 09d7703 Task 2 RED, a16322a Task 2 GREEN, 3d479fa Task 3 RED, 040a766 Task 3 GREEN); new exported checkSpineVersion predicate + new SpineVersionUnsupportedError class extending SpineLoaderError + SerializableError union extension with `detectedVersion` field + dedicated `instanceof` forwarder branch at all 5 IPC trust-boundary catch sites + JSON.parse hoist for single-parse contract + new fixtures/SPINE_3_8_TEST/ rig (3.8.99-shaped JSON + stub atlas + 1×1 PNG sentinel); KnownErrorKind / NonRecoveryKind tightened via Exclude<…, 'SpineVersionUnsupportedError'> per Rule 3 deviation; 415/415 vitest passing (was 388; +27 new); CLI byte-for-byte unchanged for 4.2 path (D-102) and threads new typed kind through scripts/cli.ts:162 catch path automatically; F3 was a CONTEXT-folded item per D-21 (no roadmap requirement ID)
- [x] 12-06-PLAN.md — INSTALL.md authoring + 4 linking surfaces (Wave 3, had BLOCKING screenshot checkpoint) — completed 2026-04-27, five atomic task commits (0c77242 chore — 4 placeholder 1×1 PNGs at docs/install-images/, 9112671 docs — author 139-line INSTALL.md cookbook with per-OS install + bypass walkthroughs + libfuse2/libfuse2t64 caveat per D-15, 3048af0 ci — release.yml INSTALL_DOC_LINK env var flipped to blob/main/INSTALL.md + release-template.md inline OS bullets pruned to single link per D-17, a6c4c1e feat — wire 4 INSTALL.md linking surfaces per D-16 + D-18 (greenfield README.md ## Installing section + SHELL_OPEN_EXTERNAL_ALLOWED 5th allow-list entry + new "Installation Guide…" Help submenu item + new onMenuInstallationGuide preload bridge + AppShell useEffect subscriber + HelpDialog INSTALL_DOC_URL constant + section between Section 1 and Section 2; Rule 1 deviations contained to test files: HelpDialog spec section count 7→8 + rig-info-tooltip + save-load specs add onMenuInstallationGuide stub), f6f509f test — greenfield tests/integration/install-md.spec.ts (project's first tests/integration/ file; 18 test() blocks asserting INSTALL.md content + 4-surface wiring + URL consistency byte-for-byte across all 4 surfaces — the regression gate for T-12-06-01 / T-12-06-04); Task 1 BLOCKING screenshot checkpoint resolved via `partial: none` resume signal (user decided to skip captures and ship text-first today, defer real captures to phase 12.1 with first real tester install on rc2; rationale in deferred-items.md "INSTALL.md screenshots deferred to phase 12.1" entry); REL-03 closed in REQUIREMENTS.md; 433/433 vitest passing (was 415; +18 new integration); typecheck:web clean
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 0–9 + 08.1, 08.2 | v1.0 | 62/62 | Complete (archived) | 2026-04-26 |
| 10. Installer build (electron-builder) | v1.1 | 3/3 | Complete    | 2026-04-27 |
| 11. CI release pipeline | v1.1 | 2/2 | Complete    | 2026-04-27 |
| 12. Auto-update + install docs | v1.1 | 6/6 | Complete    | 2026-04-27 |
| 12.1. Installer + auto-update live verification | v1.1 | 8/8 | Complete (passed_partial — 4 carry-forwards to v1.1.1) | 2026-04-28 |
| 13. v1.1.1 polish — Phase 12.1 carry-forwards | v1.1.1 | 2/5 | In progress | — |

## Deferred (post-v1.1)

Carried from v1.0:
- Adaptive bisection refinement around candidate peaks (for pathological easing curves).
- `.skel` binary loader support.
- Spine 4.3+ versioned loader adapter.
- Aspect-ratio anomaly flag (when `scaleX != scaleY` at peak).
- In-app atlas re-packing (writing a new `.atlas` file).
- SEED-001 atlas-less mode; SEED-002 dims-badge override-cap.
- Phase-0 scale-overshoot RC investigation.

Out-of-scope for v1.1, candidates for future milestones:
- Apple Developer ID code-signing + notarization ($99/yr).
- Windows EV code-signing certificate ($200–400/yr).
- Mac App Store / Microsoft Store / Snap Store / Flatpak distribution.
- Linux `.deb` / `.rpm` packages.
- Crash + error reporting (Sentry or equivalent). Removed from v1.1 scope 2026-04-28 — testers can copy/paste error dialogs for the volume v1.1 expects; revisit at v1.2 if tester base grows or anonymous crash-trace volume justifies the SaaS dependency + consent UX overhead.
- Feature-usage analytics.
- Delta updates / staged rollouts.
- UI improvements (deferred to v1.2 — should be informed by tester feedback).
- Documentation Builder feature (deferred to v1.2+).

### Phase 12.1: Installer + auto-update live verification (INSERTED)

**Goal:** Close the v1.1 distribution surface end-to-end: a tagged release publishes successfully via CI without the electron-builder 26.x publish race; an installed Windows / macOS / Linux app detects a newer published release and walks the user through update-or-fallback; INSTALL.md ships with real screenshots of Gatekeeper / SmartScreen / libfuse2 dialogs captured during the same tester round; and the local Windows `npm run build` papercut (winCodeSign symlink extract) is documented with a Developer-Mode prerequisite. Closes the 9 `human_needed` items in 12-VERIFICATION.md so v1.1 can be archived as fully verified.

**Success criteria:**
1. CI publish-race fix landed — a `v1.1.0-rc2` (or successor) tag push produces a complete GitHub Release with all 3 installers + all 3 `latest*.yml` feed files attached atomically (no missing-asset / partial-publish state).
2. macOS auto-update happy path verified live — a packaged `v1.1.0-rc2` install detects a published `v1.1.0-rc3`, downloads + relaunches into the new version on user click; "Later" suppresses re-prompt for that version on next startup.
3. Linux auto-update happy path verified live — same as macOS via AppImage + `latest-linux.yml`.
4. Windows manual-fallback verified live — a packaged Windows install opens UpdateDialog in `windows-fallback` variant when a newer release is published; "Open Release Page" button opens the GitHub Releases page in the system browser; no nag loop, no modal interruption.
5. Offline + "no newer version" + first-launch dialogs eyeballed — UPD-05 (offline silent-swallow), UPD-02 ("You're up to date"), Gatekeeper "Open Anyway" (macOS), SmartScreen "More info → Run anyway" (Windows), libfuse2t64 error (Ubuntu 24.04) — all match INSTALL.md wording.
6. INSTALL.md screenshots captured — 4 binary-only PNG swaps replace the 1×1 placeholders at `docs/install-images/`; no markdown changes required (per Plan 12-06 design).
7. Windows local-build papercut documented — README or CONTRIBUTING gains a "Building on Windows" section covering the `winCodeSign-2.6.0.7z` symlink extract failure on default Windows installs, with the Developer-Mode workaround steps and the `--dir` shortcut for unsigned local test builds.
8. 12-VERIFICATION.md `human_needed` items flipped to `passed` (or explicitly carried over to v1.2 with rationale).

**Requirements**: UPD-06 (live verification), REL-03 (live screenshots), and the 9 `human_needed` items from 12-VERIFICATION.md.
**Depends on:** Phase 12 (installer + auto-update code surface — all in tree, untested live).
**Plans:** 8 plans (all complete 2026-04-28)

Plans:
- [x] 12.1-01-PLAN.md — D-10 publish-race fix: `scripts/emit-latest-yml.mjs` post-build synthesizer + `electron-builder.yml` `publish: null` + `package.json` build:* chains + 11 vitest schema-correctness tests (Wave 1; commit `d805313`)
- [x] 12.1-02-PLAN.md — Tag rc2 + rc3 + v1.1.0 final supervision; greenfield 12.1-HUMAN-UAT scaffold; 3 successful CI runs each producing 6-asset Releases (Wave 2)
- [x] 12.1-03-PLAN.md — macOS HUMAN-UAT runbook: rc2 install verified, Sequoia Gatekeeper PNG captured (154 KB), Help → About reads `1.1.0-rc2`, smoke test passed; live rc → rc auto-update lifecycle deferred to v1.1.1 (electron-updater channel bug); manual upgrade rc2 → v1.1.0 verified ✓ (Wave 3)
- [x] 12.1-04-PLAN.md — Linux AppImage HUMAN-UAT runbook DEFERRED to v1.1.1 (no host this round; lima/multipass blockers on Apple Silicon Sequoia) (Wave 3)
- [x] 12.1-05-PLAN.md — Windows HUMAN-UAT runbook: rc2 install verified, both SmartScreen PNGs captured (1.1 MB each, distinct content), runtime SemVer matches; live windows-fallback notice deferred to v1.1.1; manual upgrade rc2 → v1.1.0 verified ✓ (Wave 3)
- [x] 12.1-06-PLAN.md — INSTALL.md PNG cleanup + Sequoia Gatekeeper rewrite + size soft-gate test in install-md.spec.ts (Wave 4; commit `33cf7b3`)
- [x] 12.1-07-PLAN.md — README `## Building on Windows` section + winCodeSign todo move pending → resolved (Wave 4; commit `ad6d9bf`)
- [x] 12.1-08-PLAN.md — 12-VERIFICATION.md back-fold flip + greenfield 12.1-VERIFICATION.md + STATE/ROADMAP closure updates (Wave 5; this commit)

### Phase 13: v1.1.1 polish — Phase 12.1 carry-forwards

**Goal:** Land the code- and docs-side changes that close out Phase 12.1's carry-forward backlog (rc-channel naming convention via CLAUDE.md docs; Windows menu-bar `autoHideMenuBar: false` flip; Windows About-panel `setAboutPanelOptions` SemVer block; 3 todo files moved pending → resolved; package.json bump 1.1.0 → 1.1.1), then tag and publish v1.1.1 final as a maintenance release. Live-verification work (Linux UAT runbook, libfuse2 PNG capture, macOS / Windows v1.1.0 → v1.1.1 auto-update lifecycle observation) is split into a follow-up Phase 13.1 so v1.1.1 can ship without being host-blocked on Linux.

**Requirements**: None new. Phase 13 closes ZERO new requirement IDs (per CONTEXT.md §canonical_refs — polish round, not a new requirement surface). 12.1's `passed_partial` carry-forwards are closed at code/docs level; live-UAT closure deferred to Phase 13.1.

**Depends on:** Phase 12.1 (4 carry-forwards landed via 12.1-VERIFICATION.md `## Anti-Patterns Found` + `## Gaps Summary` polish todos)

**Plans:** 5 plans

Plans:
- [x] 13-01-PLAN.md — Cosmetic Windows fixes in src/main/index.ts (autoHideMenuBar flip + setAboutPanelOptions block) + 2 git mv todos pending → resolved + source-grep regression spec (Wave 1, autonomous) — completed 2026-04-28, single atomic commit `202c506` (4 files: 1 M src/main/index.ts + 1 A tests/main/index-options.spec.ts + 2 R todos pending → resolved with `## Resolved` appends; rename similarities 82% / 85%); D-07 Claude's Discretion adopted (~30 LoC source-grep regression spec mirrors F2 pattern); 455/455 vitest passing (was 453; +2 new); typecheck:web clean; live verification on packaged v1.1.1 Windows install deferred to Phase 13.1 per CONTEXT D-07
- [x] 13-02-PLAN.md — CLAUDE.md `## Release tag conventions` section (D-05 docs-only fix) + 1 git mv todo pending → resolved (Wave 1, autonomous) — completed 2026-04-28, single atomic commit `566ed8e` (2 files: 1 M CLAUDE.md adding 11-line section at L23–L33 between `## Critical non-obvious facts` and `## Test fixture`, heading count 7 → 8; 1 R `pending/2026-04-28-electron-updater-prerelease-channel-mismatch.md` → `resolved/` with `## Resolved` append, 87% rename similarity); 455/455 vitest unchanged (docs-only); 3 of 3 v1.1.1-polish carry-forwards now CLOSED at code/docs level (Anti-Patterns #1 + #3 + #4 in 12.1-VERIFICATION.md)
- [ ] 13-03-PLAN.md — package.json + package-lock.json version bump 1.1.0 → 1.1.1 (Wave 2, autonomous; single-concern atomic commit per D-Discretion #4 / 12.1-02 precedent)
- [ ] 13-04-PLAN.md — Greenfield 13-VERIFICATION.md + PRESERVE-HISTORY 12.1-VERIFICATION.md flips + STATE.md/ROADMAP.md closure updates (Wave 3, autonomous)
- [ ] 13-05-PLAN.md — Tag push v1.1.1 + CI watch + 6-asset GitHub Release publish with stranded-rc-tester callout (Wave 4, has BLOCKING checkpoints)

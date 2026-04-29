# Roadmap: Spine Texture Manager

## Milestones

- ✅ **v1.0 MVP** — Phases 0–9 + 08.1 + 08.2 (shipped 2026-04-26) — full archive at [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Distribution** — Phases 10–12 + 12.1 (shipped 2026-04-28; v1.1.0 final at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.0; 4 carry-forwards to v1.1.1 documented in 12.1-VERIFICATION.md)
- ✅ **v1.1.1 patch** — Phase 13 (5/5 plans complete; shipped 2026-04-29; v1.1.1 final at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.1; D-10 publish-race fix verified clean across 4 successful CI runs total: rc2 / rc3 / v1.1.0 / v1.1.1; live UAT — Linux runbook + macOS/Windows v1.1.0 → v1.1.1 auto-update lifecycle observation — carries forward to Phase 13.1 documented in 13-VERIFICATION.md ## Gaps Summary)
- ✅ **v1.1.2 Auto-update fixes** — Phases 14–15 (shipped 2026-04-29; v1.1.2 published with broken mac auto-update D-15-LIVE-1; v1.1.3 same-day hotfix at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.3 closed UPDFIX-01 / D-15-LIVE-1 empirically via Test 7-Retry PARTIAL-PASS — v1.1.1 → v1.1.3 .zip download succeeded byte-exact at canonical dotted URL. D-15-LIVE-2 (Squirrel.Mac code-sig swap fail on ad-hoc builds) + D-15-LIVE-3 (Help → Check menu gating) routed to backlog 999.2 + 999.3 per user decision — manual-download UX path, NOT Apple Developer Program enrollment. Phase 13.1 — live UAT carry-forwards from v1.1.1 — remains separately tracked, NOT part of v1.1.2)

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

### ✅ v1.1.1 patch (Phase 13) — SHIPPED 2026-04-29

- [x] **Phase 13: v1.1.1 polish — Phase 12.1 carry-forwards** — Code- + docs-side changes closing 12.1's carry-forward backlog (rc-channel naming via CLAUDE.md docs; Windows menu-bar `autoHideMenuBar: false` flip; Windows About-panel `setAboutPanelOptions` SemVer block; 3 todo files moved pending → resolved; package.json bump 1.1.0 → 1.1.1) + tag push + CI watch + 6-asset GitHub Release publish. v1.1.1 final published 2026-04-29. Live-verification work (Linux UAT runbook, libfuse2 PNG capture, macOS / Windows v1.1.0 → v1.1.1 auto-update lifecycle observation) split into a follow-up Phase 13.1 so v1.1.1 could ship without being host-blocked. (completed 2026-04-29)

### ✅ v1.1.2 Auto-update fixes (Phases 14–15) — SHIPPED 2026-04-29 (v1.1.3 hotfix)

- [x] **Phase 14: Auto-update reliability fixes (renderer + state machine)** — Code-only fixes in `src/main/auto-update.ts` + `src/main/update-state.ts` + `src/renderer/src/modals/UpdateDialog.tsx` + the `update:*` IPC channels between them. Restores the missing/regressed startup auto-check (UPDFIX-03), fixes the renderer-subscription race that silences manual `Help → Check for Updates` before any project loads (UPDFIX-04), and fixes the Windows UpdateDialog variant-selection + dismissal-persistence + re-check state machine so the Download (or windows-fallback "Open Release Page") button reliably surfaces and re-presents on subsequent checks (UPDFIX-02). No tag, no CI run, no publish in this phase — Phase 15 owns the live release. (completed 2026-04-29)
- [x] **Phase 15: Build/feed shape fix + v1.1.2 release** — Reconciled what `electron-builder` produces and what `scripts/emit-latest-yml.mjs` (the 12.1-D-10 synthesizer) emits with what `electron-updater@6.8.3` actually consumes per platform. v1.1.2 shipped 2026-04-29 with broken mac auto-update D-15-LIVE-1 (synthesizer emitted spaced url, GitHub stored dotted, electron-updater requested dashed → HTTP 404). v1.1.3 same-day hotfix landed sanitizeAssetUrl() synthesizer rewrite (Plan 15-05) + URL-resolution invariant pre-flight gate (Plan 15-06) + 7-asset Release at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.3. UPDFIX-01 / D-15-LIVE-1 empirically closed via Test 7-Retry PARTIAL-PASS (v1.1.1 → v1.1.3 .zip download succeeded byte-exact 121,848,102 bytes at canonical dotted URL — exact request that returned 404 in v1.1.2 returns 200 in v1.1.3). D-15-LIVE-2 (Squirrel.Mac code-sig swap fail on ad-hoc builds; latent since v1.0.0) + D-15-LIVE-3 (Help → Check menu gating) routed to backlog 999.2 + 999.3 per user decision (manual-download UX path, NOT Apple Developer Program enrollment). (completed 2026-04-29)

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
- [x] 13-01-PLAN.md — Cosmetic Windows fixes in src/main/index.ts (autoHideMenuBar flip + setAboutPanelOptions block) + 2 git mv todos pending → resolved + source-grep regression spec (Wave 1, autonomous) — completed 2026-04-28, single atomic commit `202c506`
- [x] 13-02-PLAN.md — CLAUDE.md `## Release tag conventions` section (D-05 docs-only fix) + 1 git mv todo pending → resolved (Wave 1, autonomous) — completed 2026-04-28, single atomic commit `566ed8e`
- [x] 13-03-PLAN.md — package.json + package-lock.json version bump 1.1.0 → 1.1.1 (Wave 2, autonomous; single-concern atomic commit per 12.1-02 precedent) — completed 2026-04-28, single atomic commit `612ba60`
- [x] 13-04-PLAN.md — Greenfield 13-VERIFICATION.md + PRESERVE-HISTORY 12.1-VERIFICATION.md flips + STATE.md/ROADMAP.md closure updates (Wave 3, autonomous) — completed 2026-04-28
- [x] 13-05-PLAN.md — Tag push v1.1.1 + CI watch + 6-asset GitHub Release publish with stranded-rc-tester callout (Wave 4, autonomous: false — completed 2026-04-29; v1.1.1 final published at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.1)

### Phase 14: Auto-update reliability fixes (renderer + state machine)

**Goal:** Restore reliable auto-update notification + check behavior on every cold start and on every manual `Help → Check for Updates` click on **both** macOS and Windows, regardless of whether a project file has been loaded yet, and ensure dismissing the notification does not permanently suppress it. Code-only phase touching the auto-update orchestrator + update-state persistence + UpdateDialog renderer + the IPC channels between them; no tag, no CI run, no publish (Phase 15 owns the live release surface).

**Depends on:** Phase 13 (v1.1.1 baseline shipped — the code surface in `src/main/auto-update.ts` + `src/main/update-state.ts` + `src/renderer/src/modals/UpdateDialog.tsx` is the regression target; defects are observed live on shipped v1.1.1).

**Requirements**: UPDFIX-02, UPDFIX-03, UPDFIX-04

**Success Criteria** (what must be TRUE):
  1. On macOS, clicking `Help → Check for Updates` immediately after launch (BEFORE any `.json` / `.stmproj` is loaded) returns visible feedback within ~10 s — either an "Update available" notification, a "You're up to date" notice, or a graceful offline message. No silent void waiting on a project load. (UPDFIX-04)
  2. On Windows, the same manual-check behavior holds — feedback appears within ~10 s pre-load, identical to macOS (UPDFIX-04).
  3. On every cold start of v1.1.1+ on **both** macOS and Windows, the app fires `autoUpdater.checkForUpdates()` automatically within ~3-5 s of `app.whenReady()`, silently when no update or offline, surfacing the UpdateDialog when an update is available (UPDFIX-03; UPD-05 silent-swallow contract preserved — no error dialogs).
  4. On Windows, when an update is available, the UpdateDialog reliably opens with a working **Download** button (or the windows-fallback "Open Release Page" button if the auto-install path is intentionally disabled per the existing `SPIKE_PASSED` policy at `src/main/auto-update.ts:92`). Variant selection is deterministic and matches the platform contract from Phase 12 D-04 (UPDFIX-02).
  5. After dismissing a Windows update notification ("Later"), clicking `Help → Check for Updates` again while the same newer version is still published re-opens the notification (does NOT permanently suppress) — `dismissedUpdateVersion` semantics from Phase 12 D-08 are preserved for *subsequent startup checks only*, not for *manual on-demand checks* (UPDFIX-02).

**Plans**: 6 plans

Plans:
- [x] 14-01-PLAN.md — Main-side: trigger-aware suppression (D-05/D-08), sticky pending-update slot (D-03), structured logging (D-09/D-10), `update:request-pending` IPC handler, SHELL allow-list re-verification (D-12) (Wave 1, autonomous) — complete 2026-04-29
- [x] 14-02-PLAN.md — Preload bridge: add `requestPendingUpdate` to `window.api` contextBridge surface (Wave 1, autonomous) — complete 2026-04-29
- [x] 14-03-PLAN.md — Renderer lift: move 5 update subscriptions + `updateState` + `manualCheckPendingRef` + `<UpdateDialog>` from AppShell to App.tsx; add late-mount sticky-slot fetch (D-01..D-04) (Wave 2, autonomous) — complete 2026-04-29
- [x] 14-04-PLAN.md — Vitest specs: `tests/main/auto-update-dismissal.spec.ts` (asymmetric rule + sticky slot, 10+ assertions) + `tests/renderer/app-update-subscriptions.spec.tsx` (App.tsx subscription lift + late-mount hydration, 7+ assertions) (Wave 3, type: tdd) — complete 2026-04-29
- [x] 14-05-PLAN.md — Integration spec: `tests/integration/auto-update-shell-allow-list.spec.ts` URL-consistency gate across App.tsx + ipc.ts SHELL_OPEN_EXTERNAL_ALLOWED + auto-update.ts GITHUB_RELEASES_INDEX_URL + whole-suite regression check (Wave 3, autonomous) — complete 2026-04-29
- [x] 14-06-PLAN.md — Gap closure for WR-01 / G-1: wire `clearPendingUpdateInfo()` into `update:download` + `update:dismiss` IPC handlers + 2 regression assertions ((14-l)/(14-m)) in `tests/main/auto-update-dismissal.spec.ts` (gap_closure, autonomous) — complete 2026-04-29 (commits `01ce40f` + `6aaee2f`)

**UI hint**: yes

### Phase 15: Build/feed shape fix + v1.1.2 release

**Goal:** Reconcile what `electron-builder` produces, what `scripts/emit-latest-yml.mjs` (the 12.1-D-10 synthesizer) emits, and what `electron-updater@6.8.3` actually consumes per platform — so an installed v1.1.1 client can detect, download, and relaunch into v1.1.2 end-to-end on **both** macOS and Windows. Then bump `package.json` 1.1.1 → 1.1.2, tag `v1.1.2`, watch CI, and publish the resulting Release through the existing CI release pipeline (the proven 12.1-D-10 architecture: `release.yml` + `softprops/action-gh-release@v2.6.2` + `scripts/emit-latest-yml.mjs`). UPDFIX-01 is verified live against the real published feed.

**Depends on:** Phase 14 (renderer/state-machine fixes must land first so the Windows Download button reliably surfaces — otherwise UPDFIX-01's Windows download path cannot be live-verified; mac path is verifiable independently but bundling the verifications into one rc cycle is operationally simpler).

**Requirements**: UPDFIX-01

**Success Criteria** (what must be TRUE):
  1. CI run for the `v1.1.2` tag completes successfully and publishes a 6-asset GitHub Release (`.dmg` + `.zip` (NEW for macOS auto-update) + `latest-mac.yml` + `.exe` + `.blockmap` + `latest.yml` + `.AppImage` + `latest-linux.yml`; final asset count depends on whether the macOS `.zip` ships as a 7th asset or replaces another — locked during plan-phase against electron-updater 6.8.3 feed schema). All 3 `latest*.yml` feed files reference real published asset URLs with valid sha512 + size fields.
  2. An installed packaged v1.1.1 macOS client, with the network on, detects v1.1.2 in the GitHub Releases feed, opens UpdateDialog, downloads + relaunches successfully on user click — **no `ZIP file not provided` error**.
  3. An installed packaged v1.1.1 Windows client (relying on Phase 14's UpdateDialog visibility fixes), with the network on, detects v1.1.2 in the GitHub Releases feed, opens UpdateDialog with a working Download button (or windows-fallback Open Release Page per `SPIKE_PASSED`), and the download path completes without missing-asset / hash-mismatch / download-failure errors.
  4. v1.1.2 is published as a non-prerelease final tag (`isDraft: false`, `isPrerelease: false`) and is reachable at `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.2`. Linux is opportunistically verified if a host is available; otherwise documented as a Phase 13.1 / v1.2 carry-forward (does NOT block v1.1.2 publication, mirroring Phase 13's posture).
  5. Existing v1.1 / v1.1.1 distribution surface contracts (DIST-01..07, CI-01..06, REL-01..04) are unchanged — no regression in the build/CI/publish pipeline outside the targeted feed-shape fix; the 12.1-D-10 publish-race fix architecture continues to produce atomic 6-asset (or 7-asset if `.zip` adds) Releases.

**Plans**: 6 plans

Plans:
- [x] 15-01-PLAN.md — Build config + version bump (electron-builder.yml mac.target zip + package.json bare CLI flags + 1.1.1→1.1.2) (Wave 1, autonomous) — complete 2026-04-29
- [x] 15-02-PLAN.md — Synthesizer dual-installer mac extension + 4 new vitest assertions (Wave 1, autonomous; TDD RED→GREEN→docs) — complete 2026-04-29
- [x] 15-03-PLAN.md — release.yml CI extension + greenfield build-scripts.spec.ts (Wave 1, autonomous) — complete 2026-04-29
- [x] 15-04-PLAN.md — v1.1.2 release engineering: tag push + CI watch + 7-asset GitHub Release publish + D-10 split UAT (Wave 2, autonomous: false — 3 BLOCKING checkpoints) — complete 2026-04-29 (v1.1.2 shipped; live UAT Test 7 surfaced D-15-LIVE-1 — UPDFIX-01 NOT closed)
- [x] 15-05-PLAN.md — UPDFIX-01 hotfix v1.1.3 (gap closure for D-15-LIVE-1): sanitizeAssetUrl synthesizer rewrite + no-spaces regression test + version bump 1.1.2→1.1.3 (Wave 3, autonomous; gap_closure: true; TDD RED→GREEN→chore) — completed 2026-04-29 (commits `f123e10` test RED + `d4ec015` feat GREEN + `ca7152a` chore version-bump; +7 D-15-LIVE-1 regression assertions; package.json now 1.1.3; no v1.1.3 tag yet — Plan 15-06 owns)
- [x] 15-06-PLAN.md — v1.1.3 release engineering (gap closure): pre-flight (D-07 + URL-resolution invariant) + tag at git rev-parse main (AP-1 lesson encoded) + CI watch + 7-asset publish + Test 7-Retry + doc-flip (Wave 4, autonomous: false — 3 BLOCKING checkpoints; gap_closure: true; tag_target: main) — complete 2026-04-29 (v1.1.3 shipped at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.3; Test 7-Retry PARTIAL-PASS — UPDFIX-01 / D-15-LIVE-1 empirically closed at URL/feed layer; D-15-LIVE-2 + D-15-LIVE-3 routed to backlog 999.2 + 999.3)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 0–9 + 08.1, 08.2 | v1.0 | 62/62 | Complete (archived) | 2026-04-26 |
| 10. Installer build (electron-builder) | v1.1 | 3/3 | Complete    | 2026-04-27 |
| 11. CI release pipeline | v1.1 | 2/2 | Complete    | 2026-04-27 |
| 12. Auto-update + install docs | v1.1 | 6/6 | Complete    | 2026-04-27 |
| 12.1. Installer + auto-update live verification | v1.1 | 8/8 | Complete (passed_partial — 4 carry-forwards to v1.1.1) | 2026-04-28 |
| 13. v1.1.1 polish — Phase 12.1 carry-forwards | v1.1.1 | 5/5 | Complete | 2026-04-29 |
| 14. Auto-update reliability fixes (renderer + state machine) | v1.1.2 | 6/6 | Complete (verified — live-OS UAT deferred to Phase 15 per 14-HUMAN-UAT.md) | 2026-04-29 |
| 15. Build/feed shape fix + v1.1.2 release | v1.1.2 | 6/6 | Complete (v1.1.2 shipped 2026-04-29 with broken mac auto-update D-15-LIVE-1; v1.1.3 hotfix shipped same day at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.3; UPDFIX-01 / D-15-LIVE-1 empirically closed via Test 7-Retry PARTIAL-PASS; D-15-LIVE-2 + D-15-LIVE-3 newly discovered downstream defects routed to backlog 999.2 + 999.3 per user decision) | 2026-04-29 |

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

Out-of-scope for v1.1.2 specifically (carried into v1.2+ or separately tracked):
- Phase 13.1 live UAT carry-forwards (Linux runbook + libfuse2 PNG capture; macOS/Windows v1.1.0 → v1.1.1 auto-update lifecycle observation; cosmetic Windows fix UX confirmation; Windows windows-fallback variant live observation). Pending host availability; separately tracked, not part of v1.1.2's fix surface.
- New auto-update features (delta updates, staged rollouts, custom update channels).
- Code-signing posture changes (Apple Developer ID, Windows EV cert).
- UI improvements outside the UpdateDialog state machine.

## Backlog

### Phase 999.1: App quit broken — Cmd+Q and AppleScript do not terminate (BACKLOG)

**Goal:** [Captured for future planning]
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

**Context:** Observed in v1.1.1 packaged macOS build (2026-04-29) during Phase 15 UPDFIX-01 UAT. Cmd+Q from the menu and `osascript -e 'tell application "Spine Texture Manager" to quit'` both do nothing — the app keeps running. Only clicking the window-close (X) button or Force Quit terminates it. Likely missing `role: 'quit'` wiring on the menu item, or a `before-quit` handler swallowing the event without re-firing `app.quit()`. Out of scope for Phase 15 (UPDFIX-01); capture for follow-up.

### Phase 999.2: macOS auto-update — switch to manual-download UX (D-15-LIVE-2) (BACKLOG)

**Goal:** [Captured for future planning]
**Requirements:** TBD (likely a new UPDFIX-05)
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

**Context:** Discovered during Phase 15 v1.1.3 live UAT (Test 7-Retry, 2026-04-29). UPDFIX-01 / D-15-LIVE-1 was empirically closed at the URL layer (Plan 15-05 sanitizeAssetUrl synthesizer rewrite — v1.1.1 → v1.1.3 .zip download succeeded byte-exact, 121,848,102 bytes from the canonical dotted URL), but the install step exposed a separate code-signature validation defect that's been latent since v1.0.0 (masked by earlier-pipeline failures in rc tags + v1.1.2). Squirrel.Mac downloads + unpacks v1.1.3 successfully into `~/Library/Caches/com.spine.texture-manager.ShipIt/update.<id>/`, but macOS code-signature validation rejects the swap with: "Code signature at URL ... did not pass validation: code failed to satisfy specified code requirement(s)". Both v1.1.1 and v1.1.3 are ad-hoc signed (no Apple Developer ID — project hasn't enrolled). Ad-hoc builds generate fresh per-build code hashes, so v1.1.3's Designated Requirement does not match v1.1.1's stored DR. Squirrel.Mac strict-validates and aborts.

**User decision (2026-04-29):** Manual-download UX path, NOT Apple Developer Program enrollment ($99/yr was offered but declined as out-of-scope right now). Pragmatic, honest, removes brittleness.

**Scope:** Change UpdateDialog on macOS to show "Open Releases page in browser" instead of "Download & Restart". Renderer state machine + dialog UX work. Likely 1 phase. Reference Phase 14's existing `windows-fallback` variant pattern (D-13) for the equivalent macOS-fallback variant.

**Severity:** medium (auto-update was already manual for users who hit prior bugs; this formalizes it).

**Cross-references:** D-15-LIVE-2 in `.planning/phases/15-build-feed-shape-fix-v1-1-2-release/15-HUMAN-UAT.md` § Newly discovered defects; Test 7-Retry round 3 transcript.

### Phase 999.3: Help → Check for Updates gated on project loaded (D-15-LIVE-3) (BACKLOG)

**Goal:** [Captured for future planning]
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

**Context:** Discovered during Phase 15 v1.1.3 live UAT (Test 7-Retry round 4, 2026-04-29). The `Help → Check for Updates` menu item is gated on having a JSON project loaded. With no project loaded, clicking the menu item does nothing — no UpdateDialog, no console output. The menu item should be available regardless of project state.

**Scope:** Probably a 1-line fix in the menu handler / state machine guard. Likely a regression of Phase 14 D-01..D-04 renderer-lift work — the renderer subscriptions were lifted from `AppShell.tsx` to `App.tsx` so they mount on every AppState branch, but the menu handler that triggers `update:check` IPC may still be guarded behind project-loaded state in `src/main/menu.ts` or equivalent.

**Severity:** low (UX bug, not a defect; users can work around by loading any project).

**Cross-references:** D-15-LIVE-3 in `.planning/phases/15-build-feed-shape-fix-v1-1-2-release/15-HUMAN-UAT.md` § Newly discovered defects; Test 7-Retry round 4 observation.

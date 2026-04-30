# Roadmap: Spine Texture Manager

## Milestones

- ✅ **v1.0 MVP** — Phases 0–9 + 08.1 + 08.2 (shipped 2026-04-26) — full archive at [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Distribution** — Phases 10–12 + 12.1 (shipped 2026-04-28; v1.1.0 final at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.0; 4 carry-forwards to v1.1.1 documented in 12.1-VERIFICATION.md)
- ✅ **v1.1.1 patch** — Phase 13 (5/5 plans complete; shipped 2026-04-29; v1.1.1 final at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.1; D-10 publish-race fix verified clean across 4 successful CI runs total: rc2 / rc3 / v1.1.0 / v1.1.1; live UAT — Linux runbook + macOS/Windows v1.1.0 → v1.1.1 auto-update lifecycle observation — carries forward to Phase 13.1 documented in 13-VERIFICATION.md ## Gaps Summary)
- ✅ **v1.1.2 Auto-update fixes** — Phases 14–15 (shipped 2026-04-29; v1.1.2 published with broken mac auto-update D-15-LIVE-1; v1.1.3 same-day hotfix at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.3 closed UPDFIX-01 / D-15-LIVE-1 empirically via Test 7-Retry PARTIAL-PASS — v1.1.1 → v1.1.3 .zip download succeeded byte-exact at canonical dotted URL. D-15-LIVE-2 (Squirrel.Mac code-sig swap fail on ad-hoc builds) + D-15-LIVE-3 (Help → Check menu gating) routed to backlog 999.2 + 999.3 per user decision — manual-download UX path, NOT Apple Developer Program enrollment. Phase 13.1 — live UAT carry-forwards from v1.1.1 — remains separately tracked, NOT part of v1.1.2)
- 🚧 **v1.2 (in progress)** — 8-phase expansion (Phases 13.1, 16–22) authored 2026-04-30. Closes three macOS regressions + one host-blocked carry-forward from v1.1.x (13.1 + 16 + 17 + 18); refines the UI based on tester feedback (19); adds the Documentation Builder feature filling the `.stmproj` v1 reserved `documentation: object` slot from D-148 (20); lands the two long-dormant SEEDs — atlas-less mode (21) and dims-badge override-cap (22; depends on 21). 26 REQs across UAT, UPDFIX, QUIT, UI, DOC, LOAD, DIMS categories. Apple Developer ID code-signing + Sentry crash reporting declined for v1.2 (revisit at v1.3); manual-download UX (Phase 16) is the locked v1.2 answer for macOS auto-update.

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

### 🚧 v1.2 (in progress) — Phases 13.1, 16–22 (8 phases; promoted from backlog + tester feedback + dormant seeds 2026-04-30)

8-phase expansion. Phase 13.1 is host-availability gated and runs opportunistically; Phase 22 depends on Phase 21; Phases 16/17/18 are independent macOS UX fixes (16+17 share auto-update code surface — recommended adjacent for context-switch efficiency); Phase 19 (UI) recommended before Phase 20 (Documentation Builder modal benefits from Phase 19's sticky-header + modal-redesign patterns). Recommended execution order: 16 → 17 → 18 → 19 → 20 → 21 → 22, with 13.1 inserted opportunistically when a Linux/macOS/Windows host becomes available. Final order is the user's call.

- [ ] **Phase 13.1: Live UAT carry-forwards (host-availability gated)** — Linux AppImage UAT runbook + libfuse2/libfuse2t64 PNG capture for INSTALL.md `docs/install-images/`; macOS v1.1.0 → v1.1.1 auto-update lifecycle observation; Windows v1.1.0 → v1.1.1 auto-update lifecycle observation + `autoHideMenuBar: false` + `setAboutPanelOptions` SemVer cosmetic UX confirmation + windows-fallback variant live observation in real release feed. Carried forward from v1.1.1 (13-VERIFICATION.md ## Gaps Summary). NOT a strict dependency for any other phase — runs opportunistically.
- [ ] **Phase 16: macOS auto-update — switch to manual-download UX** — Replace Squirrel.Mac in-process swap on macOS with the existing `windows-fallback` UpdateDialog variant pattern (opens GitHub Releases page in browser instead of attempting a code-signature-validated swap that fails on ad-hoc-signed builds). Flip `SPIKE_PASSED = process.platform !== 'win32'` gate in `src/main/auto-update.ts` so macOS routes to the same path Windows already uses; rename `windows-fallback` variant → neutral name (e.g. `manual-download`); update INSTALL.md + Help copy + tests. Closes D-15-LIVE-2 (former 999.2). Promoted from backlog 2026-04-29.
- [ ] **Phase 17: Help → Check for Updates — fire regardless of project state** — Remove project-loaded guard on the `Help → Check for Updates` menu handler (likely `src/main/menu.ts` or equivalent) so the `update:check` IPC fires regardless of AppState branch. Closes D-15-LIVE-3 (former 999.3). Promoted from backlog 2026-04-29.
- [ ] **Phase 18: App quit broken — Cmd+Q + AppleScript do not terminate** — Wire missing `role: 'quit'` on the menu item, or fix `before-quit` handler swallowing the event. Observed on v1.1.1 packaged macOS build during Phase 15 UAT — `Cmd+Q` and `osascript -e 'tell application "Spine Texture Manager" to quit'` both no-op; only the window-close button or Force Quit kills the app. Promoted from backlog 2026-04-29 (former 999.1).
- [ ] **Phase 19: UI improvements (UI-01..05)** — Persistent sticky header bar (drop-zone state + primary action buttons + search box never scroll offscreen); card-based section layout with color-coded category icons + semantic state colors (green = under 1.0× scale, yellow = over, red = unused/danger); modal redesign with summary tiles + secondary cross-nav in footer; quantified unused-assets callout (`X.XX MB potential savings`); inline search + clear primary/secondary action-button hierarchy. Sourced from tester feedback + visual diff against an unrelated older Spine 3.8 reference app the user built previously (visual reference only — codebase out of scope).
- [ ] **Phase 20: Documentation Builder feature** — Per-skeleton documentation surface filling the `.stmproj` v1 reserved `documentation: object` slot (D-148, reserved during v1.0 Phase 8 schema lock; untested until v2 ladder lands). Animation tracks pane (drag-from-list, mix time + loop flag + notes), sections pane (events, general notes, control-bone descriptions, skin descriptions), HTML export (self-contained `.html` with optimization config snapshot + atlas page count + image-utilization count), persistence in `.stmproj`.
- [ ] **Phase 21: SEED-001 atlas-less mode (json + images folder, no .atlas)** — Long-dormant seed since v1.0 Phase 6 close-out (planted 2026-04-25). Loader detects "no `.atlas` file beside `.json`" and routes through a synthesized atlas instead of failing with `AtlasNotFoundError`. New `src/core/png-header.ts` reads width/height from PNG IHDR chunk via byte parsing only (no `sharp`/libvips/pixel decoding — preserves CLAUDE.md fact #4); new `src/core/synthetic-atlas.ts` constructs an in-memory `TextureAtlas` from per-region PNG headers. Round-trip: load json+images project → sample → export end-to-end.
- [ ] **Phase 22: SEED-002 dims-badge + override-cap (depends on Phase 21)** — Long-dormant seed since v1.0 Phase 6 close-out (planted 2026-04-25). Reuses Phase 21's PNG header reader infrastructure. Extends `DisplayRow` with `actualSourceW`/`actualSourceH`/`dimsMismatch` fields; surfaces badge in Global + Animation Breakdown panels when actual source PNG dims differ from canonical region dims; caps export `effectiveScale = min(peakScale, actualSourceW/canonicalW, actualSourceH/canonicalH)` so re-running Optimize on already-optimized images produces zero exports (no double Lanczos resampling). Round-trip safety after Optimize → Overwrite-all → re-load.

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
- [x] 13-05-PLAN.md — Tag push v1.1.1 + CI watch + 6-asset GitHub Release publish with stranded-rc-tester callout (Wave 4, autonomous: false — completed 2026-04-29; v1.1.1 final published at https://github.com/Dzazaleo/releases/tag/v1.1.1)

### Phase 13.1: Live UAT carry-forwards (host-availability gated)

**Goal:** Close out the live-host UAT work that was split off from Phase 13 so v1.1.1 could ship without being blocked on Linux/Windows host availability. Three independent observation runbooks (Linux AppImage install + libfuse2 PNG capture; macOS v1.1.0 → v1.1.1 auto-update lifecycle; Windows v1.1.0 → v1.1.1 auto-update lifecycle + cosmetic-fix UX confirmation + windows-fallback live observation). Pure observation phase — no production-code edits beyond INSTALL.md PNG binary swap.

**Depends on:** None operationally; runs opportunistically when a host becomes available. Logically follows Phase 13 (v1.1.1 baseline shipped — the artifact under observation).

**Requirements:** UAT-01, UAT-02, UAT-03

**Background:** Phase 12.1 deferred Linux UAT to v1.1.1 (lima/multipass blockers on Apple Silicon Sequoia, no native Linux host); v1.1.1 then deferred this work to Phase 13.1 so v1.1.1 itself could ship on schedule. Tracked in 13-VERIFICATION.md `## Gaps Summary`. NOT a strict dependency for any other v1.2 phase — does not block 16/17/18/19/20/21/22.

**Severity:** low (observation work; no defects under investigation here — just empirical confirmation of shipped behavior).

**Cross-references:** 12.1-VERIFICATION.md (Linux deferral); 13-VERIFICATION.md `## Gaps Summary` (full carry-forward statement); `docs/install-images/` (binary-only PNG swap target for libfuse2 capture).

**Success Criteria** (what must be TRUE):
  1. Linux AppImage v1.1.1 install runbook executed end-to-end on Ubuntu 24.04 (or equivalent host); the libfuse2 / libfuse2t64 missing-dependency error dialog is reproduced, screenshotted, and the resulting PNG is binary-swapped into `docs/install-images/` (no markdown changes — Plan 12-06 design preserved). (UAT-01)
  2. macOS v1.1.0 → v1.1.1 auto-update lifecycle observed live: either the rc-channel matching behavior is empirically confirmed working, or the observed regression is documented with reproduction steps for `/gsd-debug` follow-up. No silent failure — observation outcome is recorded in `13.1-HUMAN-UAT.md` either way. (UAT-02)
  3. Windows v1.1.0 → v1.1.1 auto-update lifecycle observed live; the v1.1.1 cosmetic fixes (`autoHideMenuBar: false` menu-bar visibility + `setAboutPanelOptions` SemVer block in About panel) are UX-confirmed on the packaged Windows build; the `windows-fallback` UpdateDialog variant is observed firing in the real release feed (not just unit tests). (UAT-03)
  4. `13.1-HUMAN-UAT.md` records all three runbook outcomes (PASS / DEFERRED / regression-found) with timestamps + host details; no host = explicit DEFERRED entry, not silent skip.

**Plans:** TBD (run /gsd-plan-phase 13.1 once a host is available)

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

### Phase 16: macOS auto-update — switch to manual-download UX

**Goal:** Replace Squirrel.Mac in-process update swap on macOS with the existing `windows-fallback` UpdateDialog variant pattern — open the GitHub Releases page in the user's browser instead of attempting a code-signature-validated swap that fails on ad-hoc-signed builds. Closes D-15-LIVE-2 empirically observed during Phase 15 v1.1.3 Test 7-Retry round 3 (2026-04-29).

**Depends on:** Phase 15 (D-15-LIVE-2 was discovered + scoped during Phase 15 UAT). Reference Phase 12 D-04 (`SPIKE_PASSED = process.platform !== 'win32'` gate) and Phase 14 D-13 (existing `windows-fallback` variant pattern in `src/renderer/src/modals/UpdateDialog.tsx`).

**Requirements:** UPDFIX-05

**Background:** Discovered during Phase 15 v1.1.3 live UAT (Test 7-Retry, 2026-04-29). UPDFIX-01 / D-15-LIVE-1 was empirically closed at the URL layer (Plan 15-05 sanitizeAssetUrl synthesizer rewrite — v1.1.1 → v1.1.3 .zip download succeeded byte-exact, 121,848,102 bytes from the canonical dotted URL), but the install step exposed a separate code-signature validation defect that's been latent since v1.0.0 (masked by earlier-pipeline failures in rc tags + v1.1.2). Squirrel.Mac downloads + unpacks v1.1.3 successfully into `~/Library/Caches/com.spine.texture-manager.ShipIt/update.<id>/`, but macOS code-signature validation rejects the swap with: "Code signature at URL ... did not pass validation: code failed to satisfy specified code requirement(s)". Both v1.1.1 and v1.1.3 are ad-hoc signed (no Apple Developer ID — project hasn't enrolled). Ad-hoc builds generate fresh per-build code hashes, so v1.1.3's Designated Requirement does not match v1.1.1's stored DR. Squirrel.Mac strict-validates and aborts.

**User decision (2026-04-29):** Manual-download UX path, NOT Apple Developer Program enrollment ($99/yr was offered but declined as out-of-scope right now). Pragmatic, honest, removes brittleness.

**Scope:** Flip the `SPIKE_PASSED = process.platform !== 'win32'` gate in `src/main/auto-update.ts` (locked in Phase 12 D-04) so macOS routes to the same path Windows already uses by default. Likely also rename the `windows-fallback` UpdateDialog variant → something neutral like `manual-download` since it's no longer Windows-only. Plus dialog/INSTALL.md/Help copy updates and tests.

**Severity:** medium (auto-update was already manual for users who hit prior bugs; this formalizes it).

**Cross-references:** D-15-LIVE-2 in `.planning/phases/15-build-feed-shape-fix-v1-1-2-release/15-HUMAN-UAT.md` § Newly discovered defects; Test 7-Retry round 3 transcript.

**Success Criteria** (what must be TRUE):
  1. On macOS, when a newer release is published to the GitHub Releases feed, the installed app's UpdateDialog opens in the `manual-download` variant (not Squirrel.Mac in-process swap) — the user sees an "Open Release Page" button rather than a "Download & Relaunch" button. (UPDFIX-05)
  2. Clicking the "Open Release Page" button on macOS launches the GitHub Releases page in the system default browser via the existing `SHELL_OPEN_EXTERNAL_ALLOWED` allow-list — no code-signature swap is attempted, no Squirrel.Mac error appears in logs. (UPDFIX-05)
  3. The variant rename `windows-fallback` → `manual-download` propagates consistently across all surface mention sites: `src/main/auto-update.ts`, `src/main/ipc.ts`, `src/renderer/src/modals/UpdateDialog.tsx`, `INSTALL.md`, the in-app Help dialog, and all relevant vitest specs — no stale `windows-fallback` string survives outside historical/archived `.planning/` content. (UPDFIX-05)
  4. Windows behavior is unchanged — Windows continues to open the same `manual-download` variant under the renamed symbol; existing v1.1.x Windows-fallback contracts (Phase 12 D-04, Phase 14 D-13) are preserved.
  5. INSTALL.md and the in-app HelpDialog text describe the macOS update flow accurately as "open the GitHub Releases page in your browser, download the new `.dmg`, replace the app" — no remaining copy that promises in-app auto-update on macOS.

**Plans:** 6 plans

Plans:
- [ ] 16-01-types-preload-rename-PLAN.md — Wave 1: rename variant literal in src/shared/types.ts + src/preload/index.ts (foundation type contract)
- [ ] 16-02-install-md-rewrite-PLAN.md — Wave 1: rewrite INSTALL.md ## After installation: auto-update section per CONTEXT.md D-03 (Linux owns in-process; macOS+Windows share manual-download)
- [ ] 16-03-main-gate-and-variant-PLAN.md — Wave 2: rename SPIKE_PASSED → IN_PROCESS_AUTO_UPDATE_OK, simplify variant routing per D-01, switch fullReleaseUrl to per-release templated URL per D-04, rename UpdateAvailablePayload variant literal
- [ ] 16-04-ipc-allow-list-PLAN.md — Wave 2: add isReleasesUrl helper to src/main/ipc.ts (URL-parse + hostname-equals + pathname-prefix); extend tests/integration/auto-update-shell-allow-list.spec.ts with 9 new D-04 tests covering happy paths + threat model (URL spoofing, subdomain spoofing, scheme downgrade)
- [ ] 16-05-renderer-propagation-PLAN.md — Wave 3: rename variant literal in UpdateDialog.tsx (5 conditional branches) + App.tsx (2 setters) + flow runtime updateState.fullReleaseUrl into onOpenReleasePage per D-04; verify HelpDialog no-op per D-06
- [ ] 16-06-test-rename-and-regression-gate-PLAN.md — Wave 4: rename literals across 4 test files + rewrite (14-p) (14-s) for new contracts + add tests/integration/no-windows-fallback-literal.spec.ts regression gate per D-07; final full-suite green sweep

### Phase 17: Help → Check for Updates — fire regardless of project state

**Goal:** Remove the project-loaded guard on the `Help → Check for Updates` menu handler so the `update:check` IPC fires regardless of AppState branch. Closes D-15-LIVE-3 empirically observed during Phase 15 v1.1.3 Test 7-Retry round 4 (2026-04-29).

**Depends on:** Phase 15 (D-15-LIVE-3 was discovered + scoped during Phase 15 UAT). Likely a regression of Phase 14 D-01..D-04 renderer-lift work — renderer subscriptions were lifted from `AppShell.tsx` to `App.tsx` so they mount on every AppState branch, but the menu handler that triggers `update:check` IPC may still be guarded behind project-loaded state in `src/main/menu.ts` or equivalent.

**Requirements:** UPDFIX-06

**Background:** Discovered during Phase 15 v1.1.3 live UAT (Test 7-Retry round 4, 2026-04-29). The `Help → Check for Updates` menu item is gated on having a JSON project loaded. With no project loaded, clicking the menu item does nothing — no UpdateDialog, no console output. The menu item should be available regardless of project state.

**Scope:** Probably a 1-line fix in the menu handler / state machine guard.

**Severity:** low (UX bug, not a defect; users can work around by loading any project).

**Cross-references:** D-15-LIVE-3 in `.planning/phases/15-build-feed-shape-fix-v1-1-2-release/15-HUMAN-UAT.md` § Newly discovered defects; Test 7-Retry round 4 observation.

**Success Criteria** (what must be TRUE):
  1. On macOS, clicking `Help → Check for Updates` immediately after a fresh launch (no `.json` / `.stmproj` loaded) fires the `update:check` IPC and surfaces feedback within ~10 s — either an "Update available" notification, a "You're up to date" notice, or a graceful offline message. (UPDFIX-06)
  2. On Windows, the same behavior holds — `Help → Check for Updates` works pre-load identically to macOS. (UPDFIX-06)
  3. After loading any project, `Help → Check for Updates` continues to work as before — no regression of the post-load path established in Phase 14.
  4. The fix does not re-introduce the renderer-subscription race closed in Phase 14 D-01..D-04 — `update:*` IPC subscriptions remain mounted on App.tsx (not AppShell.tsx), and the menu-handler change is contained to `src/main/menu.ts` (or equivalent main-process file).

**Plans:** TBD (run /gsd-plan-phase 17)

### Phase 18: App quit broken — Cmd+Q + AppleScript do not terminate

**Goal:** Restore `Cmd+Q` (and AppleScript `tell application … to quit`) as a working app-termination path on macOS. Observed in v1.1.1 packaged macOS build during Phase 15 UPDFIX-01 UAT (2026-04-29) — both no-op; only the window-close button or Force Quit terminates the app.

**Depends on:** None (independent macOS UX fix; not entangled with the auto-update surface).

**Requirements:** QUIT-01, QUIT-02

**Background:** Observed in v1.1.1 packaged macOS build (2026-04-29) during Phase 15 UPDFIX-01 UAT. `Cmd+Q` from the menu and `osascript -e 'tell application "Spine Texture Manager" to quit'` both do nothing — the app keeps running. Only clicking the window-close (X) button or Force Quit terminates it. Likely missing `role: 'quit'` wiring on the menu item, or a `before-quit` handler swallowing the event without re-firing `app.quit()`. Out of scope for Phase 15 (UPDFIX-01); captured for follow-up.

**Severity:** medium (real macOS UX defect; affects every user who tries to quit normally).

**Cross-references:** Captured as 999.1 in original ROADMAP backlog 2026-04-29.

**Success Criteria** (what must be TRUE):
  1. On macOS, pressing `Cmd+Q` from anywhere in the app (drop-zone, Global panel, Animation Breakdown, any modal) terminates the process cleanly within ~1 s; the app no longer keeps running silently. (QUIT-01)
  2. On macOS, running `osascript -e 'tell application "Spine Texture Manager" to quit'` from a Terminal terminates the app process cleanly within ~1 s. (QUIT-02)
  3. The dirty-guard SaveQuitDialog established in Phase 8 / 8.1 still fires correctly on Cmd+Q when there are unsaved changes — quit is interruptible by Cancel / Save / Don't Save, identical to the current window-close-X behavior; the fix does not bypass the dirty guard.
  4. Windows + Linux behavior is unchanged — File → Quit / Alt+F4 / window-close continue to work as before; no platform-specific regression introduced.

**Plans:** TBD (run /gsd-plan-phase 18)

### Phase 19: UI improvements (UI-01..05)

**Goal:** Refine the v1.0/v1.1 UI based on tester feedback + visual diff against an unrelated older Spine 3.8 reference app the user previously built. Persistent sticky header keeps action buttons + search visible during scroll; card-based section layout with semantic state colors replaces flat tabular UX; modals gain summary tiles + secondary cross-nav; unused-assets callout quantifies potential savings in MB; clear primary/secondary button hierarchy promotes Optimize Assets as the primary CTA.

**Depends on:** None operationally (independent UI refresh — touches a wide surface but does not block any other v1.2 phase). Recommended to land BEFORE Phase 20 so the Documentation Builder modal benefits from the new sticky-header + modal-redesign patterns rather than re-doing them.

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05

**Background:** Sourced from tester feedback during v1.1.x UAT rounds + visual diff against an older non-related Spine 3.8 reference app the user built previously (visual reference only — that codebase is out of scope). Works against the current PNG-screenshot UI; does not touch the math core (Layer 3 invariant preserved). 5-modal ARIA pattern (OverrideDialog → OptimizeDialog → AtlasPreviewModal → SaveQuitDialog → SettingsDialog → HelpDialog → UpdateDialog) is preserved — modal redesign refines content layout, not the accessibility scaffold.

**Scope:** Renderer-only changes in `src/renderer/`. No `src/core/` / `src/main/` edits expected. Tailwind v4 `@theme inline` extensions for the new color palette (semantic state colors). New `position: sticky` wrapper around the existing toolbar/header. New summary-tile sub-component reused across OptimizeDialog + AtlasPreviewModal.

**Severity:** medium (UX refresh; current UI ships and is functional, but tester friction is real).

**Cross-references:** Tester feedback notes (informal; not in `.planning/`); visual reference app (out of scope — codebase not touched).

**Success Criteria** (what must be TRUE):
  1. User scrolls through a long Global Max Render Source list (or Animation Breakdown) and the branded title + load-summary card (`N skeletons / N atlases / N regions`) + primary action buttons (Atlas Preview, Documentation, Optimize Assets, Save, Load) + search box remain visible at the top of the viewport via `position: sticky` — no need to scroll back to the top to interact with the toolbar. (UI-01, UI-05)
  2. User loads a project and sees Global panel + Animation Breakdown panel + Unused Assets callout rendered in card-based layout with color-coded category icons; rows display semantic state colors — green for under-1.0× scale rows, yellow for over-1.0×, red for unused/danger states. (UI-02)
  3. User opens the Optimize Assets modal and sees summary tiles at the top (e.g. `544 Used Files` / `433 to Resize` / `Saving est. 77.7% pixels`) above the file list; the modal footer includes a secondary cross-nav button to jump to Atlas Preview without closing. The Atlas Preview modal mirrors this pattern (summary tiles + cross-nav to Optimize Assets). (UI-03)
  4. User loads a project with unused attachments and the Unused Assets callout displays a quantified savings figure in the form `X.XX MB potential savings`, computed from the on-disk PNG file sizes of the unused regions — not just the unused count. (UI-04)
  5. User scans the toolbar and visually identifies Optimize Assets as the primary CTA via distinct treatment (filled / accent color); Atlas Preview, Documentation, Save, and Load are visually subordinate (outline / muted treatment). The inline search box is anchored in the sticky header bar. (UI-05)

**Plans:** TBD (run /gsd-plan-phase 19)

**UI hint**: yes

### Phase 20: Documentation Builder feature

**Goal:** Per-skeleton documentation surface that fills the `.stmproj` v1 reserved `documentation: object` slot (D-148; reserved during v1.0 Phase 8 schema lock; untested until v2 ladder lands). User can author animation-track docs (with mix time + loop flag + notes), capture events, write general notes, describe control bones + skins, snapshot optimization config, and export everything to a self-contained `.html` file. Persistence round-trips via the existing `.stmproj` v1 schema — no schema-version bump required (D-148 was forward-compat by design).

**Depends on:** None operationally. Recommended to land AFTER Phase 19 so the new modal can reuse Phase 19's sticky-header + modal-redesign patterns + summary tiles instead of re-doing them.

**Requirements:** DOC-01, DOC-02, DOC-03, DOC-04, DOC-05

**Background:** D-148 in v1.0 Phase 8 reserved `documentation: object` as a forward-compat slot in `.stmproj` v1 specifically anticipating this feature. The schema-version field stays at `1` because the slot was always optional + always parsed-through. The 8-kind discriminated-union typed-error envelope (D-158/D-171) extends naturally if the doc loader needs new error kinds (e.g. malformed-doc-section).

**Scope:** New top-bar button (placement coordinates with UI-01 sticky-header design from Phase 19). New `DocumentationBuilderDialog.tsx` modal following the established 5-modal ARIA pattern (hand-rolled, no library — reuses the OverrideDialog scaffold via the same conventions as the other 5 modals). New `src/core/documentation.ts` types + serialize/deserialize helpers (Layer 3 invariant preserved — pure TS, no DOM). New HTML export module (likely `src/main/doc-export.ts` since it writes a file via `fs.writeFile` atomic Pattern-B — reuses the proven write pattern from Phase 6 + Phase 8). Round-trip test exercising the full save → reload identity contract.

**Severity:** medium-large (net-new feature surface; multi-pane modal; new persistence path; new export pipeline).

**Cross-references:** D-148 in v1.0 Phase 8 `.stmproj` schema definition; D-158/D-171 in v1.0 Phase 8 typed-error envelope; PROJECT.md `## Key Decisions (v1.0 outcomes)` row "v1 forward-compat: reserved `documentation: object` slot (D-148)" status `— Pending`.

**Success Criteria** (what must be TRUE):
  1. User loads a project, clicks a new top-bar Documentation button, and the DocumentationBuilderDialog opens with three panes: Animation Tracks, Sections (events / general notes / control bones / skins), and Export. The button placement integrates with the Phase 19 sticky-header design. (DOC-01)
  2. In the Animation Tracks pane, user can drag an animation from a side list onto a track container, configure mix time (seconds, default 0.25s) + loop flag (boolean) + free-text notes per track entry; multiple tracks are supported and round-trip on save. (DOC-02)
  3. In the Sections pane, user can capture events, type free-text general notes, and add per-control-bone descriptions (name + description) and per-skin descriptions (name + description). (DOC-03)
  4. User clicks Export → HTML and the app writes a self-contained `.html` file to a chosen location containing all docs (animation tracks, events, general notes, control bones, skins) + an optimization-config snapshot (safety buffer + space-savings %) + atlas page count + image-utilization count. The file opens in a browser offline with no broken references. (DOC-04)
  5. User saves a project containing documentation, closes the app, re-opens the project, and the documentation pane displays identical content (animation tracks + sections + bones + skins all bit-equal). The `.stmproj` schema-version field stays at `1` (D-148 forward-compat slot honored); any new error kind introduced by the doc loader extends the existing 8-kind discriminated-union typed-error envelope cleanly. (DOC-05)

**Plans:** TBD (run /gsd-plan-phase 20)

**UI hint**: yes

### Phase 21: SEED-001 atlas-less mode (json + images folder, no .atlas)

**Goal:** Support the `json + images folder, no .atlas` project layout that's the natural state of source assets BEFORE the Spine packer runs (and the post-Optimize-overwrite state where source PNGs are the canonical region-dim source). Loader detects "no `.atlas` file beside `.json`" and routes through a synthesized in-memory atlas instead of failing with `AtlasNotFoundError`. Reads PNG dims via byte-only IHDR chunk parsing — no `sharp`/libvips/pixel decoding (preserves CLAUDE.md fact #4: "the math phase does not decode PNGs"). Long-dormant seed since v1.0 Phase 6 close-out (planted 2026-04-25; SEED-001).

**Depends on:** None operationally; this phase plants the shared PNG header reader infrastructure that Phase 22 (SEED-002) consumes. Sequenced 21 → 22 per the SEED authors' explicit intent.

**Requirements:** LOAD-01, LOAD-02, LOAD-03, LOAD-04

**Background:** The current loader at `src/core/loader.ts:175-186` requires a `.atlas` file beside the `.json` (matches Spine's canonical project layout `.json + .atlas + .png`, correct for editor-packed exports). But a real and common workflow keeps the skeleton `.json` + a folder of per-region source PNGs (pre-pack) + NO `.atlas`. For these projects, the current loader rejects with `AtlasNotFoundError`. User confirmed during Phase 6 verification (2026-04-25) they want this workflow supported — it's the natural pre-pack state, and after "Optimize Assets" overwrites the images folder (Phase 6 ConflictDialog Overwrite-all path), re-opening the same project should not require also keeping the atlas around. Architectural challenge: spine-core needs an atlas to know region UVs + packed bounds; without an atlas, region pixel dims must come from somewhere — and the only honest source is the source PNG files themselves.

**Scope:** New `src/core/png-header.ts` (~30 lines, pure TS, byte-parses PNG IHDR chunk for width/height — structurally distinct from decoding; preserves Layer 3 invariant). New `src/core/synthetic-atlas.ts` builds an in-memory `TextureAtlas` from per-region PNG headers when no `.atlas` is present (each synthesized region: name = PNG basename, dims = PNG header dims, page = the PNG file itself, x/y = 0/0, rotated = false). Loader path detects "no `.atlas` file" and routes through the synthesized atlas. `AtlasNotFoundError` semantics preserved for actually-missing-atlas cases (e.g. malformed project), but the no-atlas case is no longer an error. New golden fixture exercising the full atlas-less round-trip.

**Severity:** medium (independently shippable feature; adds a real workflow without regressing the canonical `.json + .atlas + .png` path).

**Cross-references:** `.planning/seeds/SEED-001-atlas-less-mode.md` (full body); `src/core/loader.ts:175-186` (current sourcePaths construction); `src/core/errors.ts` `AtlasNotFoundError`; `src/core/types.ts` `DisplayRow`; `src/main/image-worker.ts:148-162` (atlas-extract fallback — never fires in atlas-less mode); `tests/core/loader.spec.ts` (gains atlas-less fixture); CLAUDE.md fact #4 (math phase does not decode PNGs); Phase 6 D-110 + locked memory (aspect-preservation invariant unchanged); `.planning/phases/06-optimize-assets-image-export/06-07-GAP-FIX-SUMMARY.md` Round 4 (where this requirement was first surfaced).

**Success Criteria** (what must be TRUE):
  1. User drops a `json + images folder` project (no `.atlas` file) onto the app and the loader routes through a synthesized in-memory atlas instead of throwing `AtlasNotFoundError`; the Global Max Render Source + Animation Breakdown panels populate with rows whose dims match the PNG headers. (LOAD-01)
  2. The PNG dims are read from the IHDR chunk via byte-only parsing — no `sharp` / libvips / pixel decoding occurs during load (CLAUDE.md fact #4 honored); the new `src/core/png-header.ts` module sits in `src/core/` and contains no DOM / `node:fs-streaming-pixel` / `sharp` imports (Layer 3 invariant preserved). (LOAD-02)
  3. The synthesized atlas (built by `src/core/synthetic-atlas.ts` from per-region PNG headers) is a valid spine-core `TextureAtlas`: each region has name = PNG basename, dims = PNG header dims, page = the PNG file, x/y = 0/0, rotated = false; spine-core's `computeWorldVertices` consumes it without complaint. (LOAD-03)
  4. User runs Optimize Assets on an atlas-less project and the export to `images-optimized/` succeeds end-to-end — the same Lanczos3 sharp pipeline that works on canonical `.json + .atlas + .png` projects works on atlas-less projects. A golden fixture exercises load → sample → export round-trip. (LOAD-04)
  5. The `AtlasNotFoundError` message is preserved verbatim for actually-missing-atlas cases (e.g. malformed project where atlas was expected); a user with a malformed project still gets a clear error, distinct from the now-supported atlas-less path.

**Plans:** TBD (run /gsd-plan-phase 21)

### Phase 22: SEED-002 dims-badge + override-cap (depends on Phase 21)

**Goal:** Round-trip safety after Optimize. Surface canonical-vs-source dimension drift as a badge on affected rows in both Global + Animation Breakdown panels; cap export effective scale at the actual source PNG dims so re-running Optimize on already-optimized images produces zero exports (no double Lanczos resampling). Long-dormant seed since v1.0 Phase 6 close-out (planted 2026-04-25; SEED-002).

**Depends on:** **Phase 21** (reuses the `src/core/png-header.ts` PNG header reader infrastructure landed there). The SEED-002 author explicitly sequenced 21 → 22 on 2026-04-25 — do not bundle, do not invert.

**Requirements:** DIMS-01, DIMS-02, DIMS-03, DIMS-04, DIMS-05

**Background:** Two scenarios surface canonical-vs-source dimension drift:

- **Scenario A — user pre-reduced source images manually.** Animator exported original-size source PNGs from Spine, ran them through Photoshop or a separate optimizer, and now the source PNGs on disk are smaller than the dims declared in the atlas (or in Phase 21's synthesized atlas). Loading the project: app shows JSON canonical dims as "source" (e.g. 1628×1908) but the actual PNG on disk is 811×962. If the user runs Optimize, the math computes peakScale against the canonical dims and produces output dims that may UPSCALE the actual source PNG — violating the locked memory's "never extrapolate" rule.
- **Scenario B — Phase 6 ConflictDialog Overwrite-all was used.** User runs Optimize once → overwrites source images with optimized versions → re-loads same project. Source PNGs on disk are now smaller than canonical dims, identical to Scenario A. If user runs Optimize again, the app would re-reduce already-reduced images, producing strictly worse output (double Lanczos resampling).

User confirmed scope on 2026-04-25 during Phase 6 verification: "Same badge/warning about source dims and json canonical dims differing must be issued. App must do the math to determine how images must be optimized in order to guarantee that images already in correct size are not touched and images that still need to be reduced, are reduced only the correct amount to reach target peak dims."

**Scope:** Loader gains per-region PNG header reads (via Phase 21's `src/core/png-header.ts`). `DisplayRow` (in `src/core/types.ts`) gains `actualSourceW` / `actualSourceH` fields (populated by loader; undefined when not applicable, e.g. atlas-extract path) and a `dimsMismatch: boolean` set when actualSource differs from canonical sourceW/H by more than 1px (rounding tolerance). Badge UI in `GlobalMaxRenderPanel` + `AnimationBreakdownPanel` (small icon + tooltip). `buildExportPlan` in `src/core/export.ts` (and the byte-identical renderer copy at `src/renderer/src/lib/export-view.ts`) gains the cap step `cappedEffScale = min(effScale, actualSourceW/canonicalW, actualSourceH/canonicalH)`. New `excludedAlreadyOptimized[]` array parallel to Phase 6 D-109 `excludedUnused[]`; OptimizeDialog pre-flight file list shows muted treatment with "already-optimized — skipped" indicator (parity with `excludedUnused` muted UX).

**Severity:** medium (round-trip safety; without it, repeated Optimize runs degrade quality silently — a real correctness issue, not just UX).

**Cross-references:** `.planning/seeds/SEED-002-dims-badge-override-cap.md` (full body); locked memory `project_phase6_default_scaling.md` (uniform single-scale; never extrapolate); Phase 6 D-109 (`excludedUnused[]` precedent for `excludedAlreadyOptimized[]`); Phase 6 Gap-Fix Round 1 (clamp `effectiveScale ≤ 1.0` — this seed extends the clamp to also respect actual source PNG dims); `src/core/types.ts:115-132` (DisplayRow); `src/core/export.ts:117-135` (`safeScale` + ceil math); `src/renderer/src/lib/export-view.ts` (byte-identical renderer copy); `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` + `AnimationBreakdownPanel.tsx` (panels gain badge); `src/renderer/src/modals/OptimizeDialog.tsx` (pre-flight file list gains the "already-optimized — skipped" indicator).

**Success Criteria** (what must be TRUE):
  1. User loads a project where actual source PNG dims differ from canonical region dims (Scenario A or Scenario B); affected rows in `DisplayRow` carry `actualSourceW` / `actualSourceH` populated from PNG header reads + `dimsMismatch: true` (set when actualSource differs from canonical by more than 1px). Atlas-extract path rows carry `dimsMismatch: false` / fields undefined (not applicable). (DIMS-01)
  2. User views the Global Max Render Source panel and the Animation Breakdown panel and sees a small badge icon on each `dimsMismatch: true` row; hovering reveals a tooltip in the form "Source PNG (811×962) is smaller than canonical region dims (1628×1908). Optimize will cap at source size." (DIMS-02)
  3. User runs Optimize Assets on a project with `dimsMismatch` rows; for those rows, `buildExportPlan` (and the byte-identical renderer copy `export-view.ts`) caps `effectiveScale = min(peakScale, actualSourceW/canonicalW, actualSourceH/canonicalH)` so the output is never upscaled beyond the actual source PNG dims; the locked memory `project_phase6_default_scaling.md` (uniform single-scale; never extrapolate) is preserved — the cap is a uniform reduction, not per-axis. (DIMS-03)
  4. Already-optimized rows (where `actualSource × cappedEffScale` rounds to `actualSource` — i.e. zero net change) are excluded from the export and surfaced in a new `excludedAlreadyOptimized[]` array parallel to Phase 6 D-109 `excludedUnused[]`; the OptimizeDialog pre-flight file list shows these rows with muted treatment + "already-optimized — skipped" indicator (UX parity with the Round 1 `excludedUnused` muted note). (DIMS-04)
  5. User runs Optimize on already-optimized images (Scenario B re-load) and zero exports occur — no double Lanczos resampling, no quality degradation. A vitest fixture where source PNGs are smaller than canonical region dims covers this round-trip and asserts the export-plan length is 0 for the already-optimized rows. (DIMS-05)

**Plans:** TBD (run /gsd-plan-phase 22)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 0–9 + 08.1, 08.2 | v1.0 | 62/62 | Complete (archived) | 2026-04-26 |
| 10. Installer build (electron-builder) | v1.1 | 3/3 | Complete    | 2026-04-27 |
| 11. CI release pipeline | v1.1 | 2/2 | Complete    | 2026-04-27 |
| 12. Auto-update + install docs | v1.1 | 6/6 | Complete    | 2026-04-27 |
| 12.1. Installer + auto-update live verification | v1.1 | 8/8 | Complete (passed_partial — 4 carry-forwards to v1.1.1) | 2026-04-28 |
| 13. v1.1.1 polish — Phase 12.1 carry-forwards | v1.1.1 | 5/5 | Complete | 2026-04-29 |
| 13.1. Live UAT carry-forwards (host-availability gated) | v1.2 | 0/0 | Pending (host-availability gated; runs opportunistically; UAT-01..03) | — |
| 14. Auto-update reliability fixes (renderer + state machine) | v1.1.2 | 6/6 | Complete (verified — live-OS UAT deferred to Phase 15 per 14-HUMAN-UAT.md) | 2026-04-29 |
| 15. Build/feed shape fix + v1.1.2 release | v1.1.2 | 6/6 | Complete (v1.1.2 shipped 2026-04-29 with broken mac auto-update D-15-LIVE-1; v1.1.3 hotfix shipped same day at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.3; UPDFIX-01 / D-15-LIVE-1 empirically closed via Test 7-Retry PARTIAL-PASS; D-15-LIVE-2 + D-15-LIVE-3 newly discovered downstream defects routed to backlog 999.2 + 999.3 per user decision) | 2026-04-29 |
| 16. macOS auto-update — manual-download UX | v1.2 | 0/0 | Pending (promoted from backlog 999.2 on 2026-04-29; closes D-15-LIVE-2; UPDFIX-05) | — |
| 17. Help → Check for Updates not gated on project | v1.2 | 0/0 | Pending (promoted from backlog 999.3 on 2026-04-29; closes D-15-LIVE-3; UPDFIX-06) | — |
| 18. App quit broken — Cmd+Q + AppleScript | v1.2 | 0/0 | Pending (promoted from backlog 999.1 on 2026-04-29; QUIT-01, QUIT-02) | — |
| 19. UI improvements (UI-01..05) | v1.2 | 0/0 | Pending (sticky header + cards + modal redesign + quantified callouts + button hierarchy; tester feedback) | — |
| 20. Documentation Builder feature | v1.2 | 0/0 | Pending (fills .stmproj v1 reserved documentation slot D-148; DOC-01..05) | — |
| 21. SEED-001 atlas-less mode (json + images, no .atlas) | v1.2 | 0/0 | Pending (long-dormant seed planted 2026-04-25; LOAD-01..04; plants shared PNG header reader for Phase 22) | — |
| 22. SEED-002 dims-badge + override-cap (depends on 21) | v1.2 | 0/0 | Pending (long-dormant seed planted 2026-04-25; depends on Phase 21; DIMS-01..05) | — |

## Deferred (post-v1.1)

Carried from v1.0:
- Adaptive bisection refinement around candidate peaks (for pathological easing curves).
- `.skel` binary loader support.
- Spine 4.3+ versioned loader adapter.
- Aspect-ratio anomaly flag (when `scaleX != scaleY` at peak).
- In-app atlas re-packing (writing a new `.atlas` file).
- Phase-0 scale-overshoot RC investigation.
- ~~SEED-001 atlas-less mode~~ — promoted to v1.2 Phase 21 (2026-04-30).
- ~~SEED-002 dims-badge override-cap~~ — promoted to v1.2 Phase 22 (2026-04-30; depends on Phase 21).

Out-of-scope for v1.1, candidates for future milestones:
- Apple Developer ID code-signing + notarization ($99/yr) — declined again for v1.2 on 2026-04-29 in favor of Phase 16's manual-download UX path; revisit at v1.3 if a separate use case justifies the cost + maintenance overhead.
- Windows EV code-signing certificate ($200–400/yr).
- Mac App Store / Microsoft Store / Snap Store / Flatpak distribution.
- Linux `.deb` / `.rpm` packages.
- Crash + error reporting (Sentry or equivalent). Removed from v1.1 scope 2026-04-28; declined again for v1.2 on 2026-04-30; revisit at v1.3 once tester base + crash-trace volume justifies the SaaS dependency + consent UX overhead.
- Feature-usage analytics.
- Delta updates / staged rollouts / custom update channels.
- ~~UI improvements (deferred to v1.2 — should be informed by tester feedback)~~ — promoted to v1.2 Phase 19 (2026-04-30; UI-01..05).
- ~~Documentation Builder feature (deferred to v1.2+)~~ — promoted to v1.2 Phase 20 (2026-04-30; DOC-01..05).

Out-of-scope for v1.1.2 specifically (carried into v1.2+ or separately tracked):
- ~~Phase 13.1 live UAT carry-forwards (Linux runbook + libfuse2 PNG capture; macOS/Windows v1.1.0 → v1.1.1 auto-update lifecycle observation; cosmetic Windows fix UX confirmation; Windows windows-fallback variant live observation)~~ — promoted to v1.2 Phase 13.1 (2026-04-30; UAT-01..03; remains host-availability gated).
- New auto-update features (delta updates, staged rollouts, custom update channels).
- Code-signing posture changes (Apple Developer ID, Windows EV cert).
- UI improvements outside the UpdateDialog state machine — superseded by Phase 19 (broader UI refresh).

Out-of-scope for v1.2 specifically:
- Apple Developer ID code-signing + notarization. Declined 2026-04-29 in favor of Phase 16 manual-download UX. Revisit at v1.3.
- Crash + error reporting (Sentry or equivalent). Declined 2026-04-30. Revisit at v1.3.
- Spine 4.3+ versioned loader adapters (F1.5). Carried unchanged from v1.0.
- `.skel` binary loader. Carried unchanged from v1.0.
- Adaptive bisection refinement; aspect-ratio anomaly flag; in-app atlas re-packing. All carried unchanged from v1.0.

## Backlog

_Empty as of 2026-04-29 — items 999.1, 999.2, 999.3 promoted to v1.2 phases 18, 16, 17 respectively via /gsd-review-backlog. Add new ideas here with /gsd-add-backlog._

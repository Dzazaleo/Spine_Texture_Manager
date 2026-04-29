---
gsd_state_version: 1.0
milestone: v1.1.2
milestone_name: Auto-update fixes
status: unknown
last_updated: "2026-04-29T12:17:16.442Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# State

## Current milestone

v1.1.2 — Auto-update fixes. Hotfix milestone scoping four post-release auto-update defects observed live on shipped v1.1.1 (mac `ZIP file not provided` on Download & Restart; Windows notification appears once with no Download button and never reappears on re-check; auto-check on startup not firing on either OS; manual "Check for Updates" stays silent on macOS until a project file is loaded). Phase 13 closed 2026-04-29 (v1.1.1 shipped). Phase 13.1 (live UAT carry-forwards from v1.1.1) remains pending host availability and is **separate** from v1.1.2 — those tasks pre-date this milestone.

Roadmap landed 2026-04-29 with **2 phases** (Phases 14–15, continuing phase numbering from Phase 13). Phase 14 (Auto-update reliability fixes — renderer + state machine) closes UPDFIX-02 + UPDFIX-03 + UPDFIX-04 at code-only level; Phase 15 (Build/feed shape fix + v1.1.2 release) closes UPDFIX-01 and ships the tagged v1.1.2 final via the existing 12.1-D-10 publish-race fix CI architecture (`scripts/emit-latest-yml.mjs` + `softprops/action-gh-release@v2.6.2` + `release.yml`). Phase 15 depends on Phase 14 — the renderer/state-machine fixes must land first so the Windows Download button reliably surfaces, otherwise UPDFIX-01's Windows download path cannot be live-verified.

Coverage: 4/4 UPDFIX requirements mapped to exactly one phase each. UPDFIX-02 + UPDFIX-03 + UPDFIX-04 → Phase 14; UPDFIX-01 → Phase 15.

## Current phase

Phase 14 — Auto-update reliability fixes (renderer + state machine). **CLOSED 5/5 plans complete 2026-04-29** (verifier status: `human_needed`; 5/5 code-level truths verified; 6 ROADMAP success criteria require packaged-build OS UAT, persisted in 14-HUMAN-UAT.md and deferred to Phase 15 by milestone contract). Phase 15 (build/feed shape fix + v1.1.2 release) is next, but a small **WR-01 gap-closure phase 14.1** is recommended first to fix the sticky-slot cleanup gap surfaced by code review (10 LoC + 1 regression test) before the v1.1.2 tag goes out — see Next action.

**Goal achieved:** All three Phase 14 requirements (UPDFIX-02, UPDFIX-03, UPDFIX-04) are wired in code with regression specs in `npm run test` (493/493 passing across 45 test files; +22 new assertions across 3 spec files added in Wave 3). Asymmetric dismissal rule + sticky pending-update slot + structured `[auto-update]` instrumentation + `update:request-pending` IPC + preload bridge + renderer lift all landed across 3 waves.

**Architecture decisions taken (locked):**

- D-05 asymmetric dismissal rule: manual trigger SKIPS `dismissedUpdateVersion` suppression; startup trigger PRESERVES it (verbatim Phase 12 D-08 behavior on the startup branch).
- D-03 sticky pending-update slot: module-level `pendingUpdateInfo: UpdateAvailablePayload | null` in `src/main/auto-update.ts` written on every `update:available`; preserved on `update-not-available`; in-memory only (no persistence — D-Discretion-2).
- D-09/D-10 structured logging: 9 `[auto-update] event: key=value, ...` `console.info` lines (target was ≥6).
- D-01..D-04 renderer lift: 5 update subscriptions + `updateState` + `manualCheckPendingRef` + `<UpdateDialog>` mount lifted from `AppShell.tsx` (mounted only on `loaded`/`projectLoaded`) up to `App.tsx` (mounts unconditionally on every AppState branch). Late-mount race recovery via one-shot `window.api.requestPendingUpdate()` on App mount.
- D-12 SHELL allow-list verified: `SHELL_OPEN_EXTERNAL_ALLOWED` Set in `src/main/ipc.ts:174` still contains `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` (byte-identical agreement asserted by `tests/integration/auto-update-shell-allow-list.spec.ts`).

**Code-review verdict:** 0 critical, 3 warnings, 5 info. Headline finding **WR-01 (warning)** — `clearPendingUpdateInfo()` is exported and tested but no production caller invokes it on dismiss/download. Cold-start path is unaffected (slot is in-memory only); latent risk for HMR/StrictMode/future in-session remount paths. Recommended fix before Phase 15 ships v1.1.2: a Phase 14.1 gap-closure plan (~10 LoC + 1 regression test) — full remediation guidance in 14-HUMAN-UAT.md `## Gaps` section.

## Current plan

— (Phase 14 closed; next plan to decompose: 14.1-01 (WR-01 gap closure) via `/gsd-plan-phase 14 --gaps` in a fresh session)

## Last completed

**Phase 14 — Auto-update reliability fixes (renderer + state machine)** — 5/5 plans complete — 2026-04-29. Three-wave parallel execution via `gsd-executor` agents in isolated git worktrees:

- **Wave 1 (parallel):** Plan 14-01 (main-side: trigger-aware suppression + sticky `pendingUpdateInfo` slot + 9 structured `[auto-update]` console.info lines + `update:request-pending` IPC handler + D-12 SHELL allow-list verification) committed `5ad1083`/`6e9f735`/`f161e00`/`b32d39b`/`5a4e850`/`e8a33a8` (test+feat+docs+test+feat+docs RED→GREEN cadence). Plan 14-02 (preload contextBridge: `window.api.requestPendingUpdate()` one-shot invoke wrapper + Rule 3 auto-fix on `src/shared/types.ts` Api interface) committed `df5b8fc`/`10bac77`/`f4cbf17`/`032bafd`. Both worktrees merged at `394b2cd` and `f72c70a`; add/add conflict on `deferred-items.md` (both plans logged the same pre-existing sampler-worker-girl flake) resolved by combining into a single unified entry. Post-merge test gate: 471/471 passed.

- **Wave 2 (sequential, single plan):** Plan 14-03 (renderer subscription lift — 5 update subscriptions + `updateState` + `manualCheckPendingRef` + `<UpdateDialog>` mount moved from `AppShell.tsx` to `App.tsx` so they mount unconditionally on every AppState branch; late-mount race recovery via one-shot `window.api.requestPendingUpdate()` on App mount; Rule 3 auto-fix added `requestPendingUpdate` stub to `tests/renderer/save-load.spec.tsx`) committed `802a76e`/`d67b0ec`/`fc28b9d`. Worktree merged at `0db0482`. Post-merge test gate: 471/471 passed.

- **Wave 3 (parallel):** Plan 14-04 `type: tdd` (greenfield regression specs — `tests/main/auto-update-dismissal.spec.ts` 11 assertions across 3 describe blocks + `tests/renderer/app-update-subscriptions.spec.tsx` 7 assertions; both shipped through inverted-RED→GREEN cycles since the production code already existed from Waves 1-2) committed `a666c3d`/`469660b`/`28cf567`/`7fbe81b`/`7daf67d`. Plan 14-05 (cross-surface integration spec — `tests/integration/auto-update-shell-allow-list.spec.ts` 4 assertions gating byte-identical agreement on the GitHub Releases-index URL across `App.tsx` `onOpenReleasePage`, `ipc.ts` `SHELL_OPEN_EXTERNAL_ALLOWED`, and `auto-update.ts` `GITHUB_RELEASES_INDEX_URL`) committed `6bf5076`/`8b26e43`/`20fd7d4`. Both worktrees merged at `e96bcd3` and `b61d9f7`. Post-merge test gate: 493/493 passed.

**Phase-level gates after Wave 3:**

- Code review (`gsd-code-reviewer` agent at `standard` depth across 13 files): 0 critical / 3 warning / 5 info → committed at `ff0b9e5` (`14-REVIEW.md`). Headline WR-01 — sticky slot cleanup gap (see Phase 14.1 gap-closure note in Current phase + Next action).
- Regression gate: full suite re-run, 493/493 passed across 45 test files, 0 prior-phase regressions.
- Verifier (`gsd-verifier` agent): status `human_needed` — 5/5 code-level truths verified; 6 ROADMAP success criteria require packaged-build OS UAT and have been persisted in `14-HUMAN-UAT.md` (status: partial) for verification during Phase 15. WR-01 also surfaced as a code-level gap with 3 remediation paths documented. Verification report committed at `7455eb4` (`14-VERIFICATION.md`).

**Net commits added on Phase 14's wire (orchestrator + 5 executor worktrees, branched from `9031c92` to `df31405`):** 27 commits — 6 worktree merge commits + 4 tracking-update commits (`12ca09e`/`9ae04c9`/`b85ef52`) + 14 task commits inside worktrees (test+feat+refactor+docs RED→GREEN cadence, all hook-bypassed `--no-verify` per parallel-executor protocol; orchestrator validated hooks at post-wave gates) + 3 phase-level gate commits (`ff0b9e5` REVIEW + `7455eb4` VERIFICATION + `df31405` HUMAN-UAT).

**Test suite delta:** 455/455 (Phase 13 close) → 493/493 (Phase 14 close) = +38 new specs (+18 from Plan 14-04 dismissal/subscriptions specs, +4 from Plan 14-05 integration spec, +9 from Plan 14-01 main-side RED specs flipped GREEN, +7 from Plan 14-02 preload bridge specs).

Prior: Plan 13-05 (Wave 4 — v1.1.1 tag push + CI watch + 6-asset GitHub Release publish with stranded-rc-tester callout per D-03) — 2026-04-29. autonomous: false plan with 3 BLOCKING user-confirmation checkpoints (pre-flight verify; pre-push final-confirmation; pre-publish final-verification). Executed across 9 tasks; the user passed all 3 checkpoint gates ("ready" → tag at HEAD~1 per default → "push" → "publish"). Sequence on the wire:

1. **Tag creation (Task 2):** `git tag -a v1.1.1 612ba60 -m "v1.1.1 — Phase 12.1 carry-forwards (cosmetic Windows fixes + rc-channel docs)"` — annotated tag pointing at the chore(13-03) version-bump commit per the 12.1-02 precedent of tagging the version-bump commit, NOT the subsequent docs commit.

2. **Tag push (Task 4):** `git push origin v1.1.1` — push triggered `.github/workflows/release.yml` workflow run [25094013906](https://github.com/Dzazaleo/Spine_Texture_Manager/actions/runs/25094013906) within ~30s.

3. **CI run (Task 5):** ran ~4m07s (started 2026-04-29T06:20:25Z, completed 2026-04-29T06:24:32Z), conclusion `success`. Tag-version-guard at release.yml:43-54 accepted (TAG_VERSION="1.1.1" matched PKG_VERSION="1.1.1" per Plan 13-03's bump). 3-OS test matrix (ubuntu-latest / windows-2022 / macos-14) passed; build matrix produced 3 installers; `scripts/emit-latest-yml.mjs` (12.1-D-10 synthesizer) emitted 3 `latest*.yml` feed files; `softprops/action-gh-release@v2.6.2` published the 6-asset draft Release atomically. D-10 publish-race fix log-clean (4th successful CI run with the architecture, after rc2 / rc3 / v1.1.0 — no Personal Access Token / asset_already_exists / HTTP 422 lines).

4. **Release body authoring (Task 6):** edited the rendered release-template body via `gh release edit v1.1.1 --notes-file ...` to add the D-03 stranded-rc-tester callout in `## Known issues` (verbatim per CONTEXT.md §specifics: "If you installed `v1.1.0-rcN` (rc1, rc2, or rc3), please download `v1.1.1` manually from the assets list below — after upgrading, all future auto-updates work normally") + cross-link to CLAUDE.md `## Release tag conventions`. 4 sections preserved per REL-02 contract (Summary / New in this version / Known issues / Install instructions). 6 assets unchanged.

5. **Publication (Task 8):** `gh release edit v1.1.1 --draft=false` published at 2026-04-29T06:43:45Z. Verified `isDraft: false`, `isPrerelease: false`, `assetCount: 6` (3 installers + 3 latest*.yml feed files). Public URL: https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.1. Asset names + sizes: `Spine.Texture.Manager-1.1.1-arm64.dmg` (125.9 MB), `Spine.Texture.Manager-1.1.1-x64.exe` (109.1 MB), `Spine.Texture.Manager-1.1.1-x86_64.AppImage` (139.2 MB), `latest-mac.yml` (371 B), `latest.yml` (367 B), `latest-linux.yml` (383 B).

6. **Follow-up doc-flip commit (Task 9):** atomic commit covering 3 file changes — `.planning/phases/13-v1-1-1-polish-phase-12-1-carry-forwards/13-VERIFICATION.md` (frontmatter `status: passed_partial → passed`, `score:` 4/4 → 5/5 with publication evidence; visible body block flipped from "PENDING (Plan 05)" → "LIVE — published 2026-04-29T06:43:45Z"; T-6 row Status flipped PENDING → VERIFIED with full evidence including run ID + publishedAt + 6-asset names+sizes + isDraft:false + isPrerelease:false; Gaps Summary "Pending in Phase 13" sub-paragraph rewritten to "Closed in Phase 13 (Plan 13-05 — 2026-04-29)" with the full publication sequence narrative; trailing footer bumped to 2026-04-29T06:45:00Z + verifier line updated to "Plan 05 closure"); `.planning/STATE.md` (frontmatter `last_updated:` bumped to 2026-04-29T06:50:00Z, `progress.completed_phases: 3 → 4`, `completed_plans: 15 → 16`, `percent: 94 → 100`, `status: in_progress → complete`; `## Current phase` rewritten from "CLOSED 4/5" → "CLOSED 5/5 plans complete 2026-04-29; v1.1.1 final published" + Release URL + run ID; `## Current plan` advanced from "13-05-PLAN.md (next; ...)" → "(none — Phase 13 closed; ...)"); `.planning/ROADMAP.md` (Phase 13 plan list `[ ] 13-05-PLAN.md` → `[x]` with completion note + commit SHA + Release URL; Progress table row `4/5 In progress (Plan 13-05 pending)` → `5/5 Complete | 2026-04-29`; Milestones bullet `🚧 **v1.1.1 patch**` → `✅ **v1.1.1 patch (2026-04-29)**` mirroring the 12-* phase closures' format).

Net releases pipeline state: v1.0 final + v1.1.0 final + v1.1.1 final all published, all 6-asset complete, all D-10 publish-race-fix-clean. v1.1.1 patch milestone shipped. Phase 13 fully closed (5/5 plans). Phase 13.1 ready for `/gsd-insert-phase 13.1` insertion (live UAT — Linux runbook + macOS/Windows auto-update lifecycle observation; cosmetic Windows fix UX-level confirmation; windows-fallback variant observation).

Acceptance verification: `gh release view v1.1.1 --json isDraft,isPrerelease,assets --jq '{ isDraft, isPrerelease, count: (.assets | length) }'` returns `{ "isDraft": false, "isPrerelease": false, "count": 6 }`. Test suite unchanged at 455/455 (no regressions from doc-only doc-flip commit). Working tree clean (only previously-known untracked Phase 12.1 leftovers remain). 2 commits added on Plan 13-05's wire: 0 task commits during Tasks 1-8 (all read-only or remote-only operations) + 1 doc-flip commit (Task 9) + 1 close-out commit (this SUMMARY + final state/roadmap reconciliation). Hook-validated commits (no `--no-verify`).

Forward references: Phase 13.1 (when inserted via `/gsd-insert-phase 13.1`) inherits the 4 Gaps Summary deferrals documented in 13-VERIFICATION.md `### Gaps Summary` "Carry-forwards to Phase 13.1" block. Existing v1.1.0 final installs will detect v1.1.1 via electron-updater 6.x's `currentChannel === null` code branch (final → final path is unaffected by the rc-channel bug fixed via CLAUDE.md docs in Plan 13-02). Stranded v1.1.0-rcN testers (rc1 / rc2 / rc3) need to manually download v1.1.1 per the D-03 callout in the Release body.

Prior: Plan 13-04 (Wave 3 — greenfield 13-VERIFICATION.md + PRESERVE-HISTORY 12.1-VERIFICATION.md flips + STATE.md/ROADMAP.md closure updates) — 2026-04-28. Single atomic commit covering 4 file changes — proven 12.1-08 close-out shape (commit `b4ed03f`) mapped to Phase 13. (Body preserved verbatim in v1.1.1 close-out; truncated here for v1.1.2 STATE.md focus.)

Prior: Plan 13-03 (Wave 2 — package.json + package-lock.json version bump 1.1.0 → 1.1.1) — 2026-04-28. Single atomic task commit `612ba60` (12.1-02 precedent shape; 2 files / 3 ins / 3 del; no bundling).

Prior: Plan 13-02 (Wave 1 — CLAUDE.md release-tag conventions docs + rc-channel-mismatch todo move) — 2026-04-28. Single atomic task commit `566ed8e`.

Prior: Plan 13-01 (Wave 1 — Windows cosmetic carry-forwards: src/main/index.ts autoHideMenuBar flip + setAboutPanelOptions block + 2 git mv todos pending → resolved + source-grep regression spec) — 2026-04-28. Single atomic task commit `202c506`.

Prior milestone: v1.1.1 (Phase 13) closed 2026-04-29; v1.1 (Phases 10–12 + 12.1) closed 2026-04-28; v1.0 (MVP) closed 2026-04-26. See `.planning/MILESTONES.md` and `.planning/ROADMAP.md` for full history.

## Next action

Phase 14 closed 2026-04-29 (5/5 plans, code-only contract honored, +38 regression specs landed). **Next (in a fresh session): `/gsd-plan-phase 14 --gaps`** — decomposes the WR-01 sticky-slot cleanup gap into a Phase 14.1 gap-closure plan (~10 LoC + 1 regression test in `tests/main/auto-update-dismissal.spec.ts`). The verifier (`14-VERIFICATION.md` frontmatter `gaps[0]`) marks this as `failed` because Plan 14-03's frontmatter must-have truth #11 promised `clearPendingUpdateInfo()` would run on dismiss/download, but no production caller exists. Cold-start path is unaffected (in-memory-only contract); the latent risk lands the moment any in-session remount affordance ships. The fresh-session boundary is intentional — `/gsd-plan-phase` benefits from a clean context for its research + pattern-mapper + (optional) discuss steps.

After Phase 14.1 closes, `/gsd-plan-phase 15` decomposes the build/feed-shape fix + v1.1.2 release wave (UPDFIX-01; package.json bump 1.1.1 → 1.1.2; tag push; CI watch; 6-asset (or 7-asset if `.zip` adds for macOS auto-update) Release publish through the existing 12.1-D-10 architecture). Phase 15's release-engineering wave will mirror Plan 13-05's shape (autonomous: false, 3 BLOCKING user-confirmation checkpoints — pre-flight verify; pre-push final confirmation; pre-publish final verification — per the user's git-beginner posture documented in user memory). Phase 15 will live-verify the 6 packaged-build UAT items persisted in `14-HUMAN-UAT.md` (mac/win cold-start auto-check, idle Help→Check on both OS, Windows dismiss-and-recheck, Windows Download/Open Release Page button surface).

Phase 13.1 (live UAT carry-forwards from v1.1.1) remains separately tracked — pending host availability; out-of-scope for v1.1.2 fixes.

## Open questions

- Phase 15: macOS auto-update `.zip` artifact — does electron-builder 26.x produce it automatically when `mac.target` includes `dmg`, or does the target list need to add `zip` explicitly? Plan-phase 15 RESEARCH locks this against electron-updater 6.8.3's actual feed consumption against an unsigned ad-hoc `.dmg`. Cross-reference `12-RESEARCH.md` §"Unsigned-Windows Behavior" precedent for the equivalent NSIS `.exe` + `.blockmap` shape investigation.
- ~~Phase 14: Is the manual `Help → Check for Updates` pre-load silence on macOS (UPDFIX-04) caused by (a) renderer subscription timing or (b) main-side event ordering?~~ **RESOLVED 2026-04-29 (Phase 14 close):** Root cause was (a) — renderer subscriptions lived in `AppShell.tsx` which only mounts on `loaded`/`projectLoaded` AppState branches, so the manual-check IPC events fired into a void when no project was loaded. Fix: lift subscriptions + `<UpdateDialog>` mount up to `App.tsx` (mounts unconditionally on every branch). Late-mount race for any update-available events that fired before `App.tsx` finished mounting handled via one-shot `window.api.requestPendingUpdate()` on App mount that reads from the new D-03 sticky slot.
- ~~Phase 14: UPDFIX-02 dismissal semantics — should `dismissedUpdateVersion` suppress on subsequent **startup** checks but NOT on **manual on-demand** checks?~~ **RESOLVED 2026-04-29 (Phase 14 close):** Yes — D-05 asymmetric rule. Manual trigger SKIPS suppression; startup trigger PRESERVES Phase 12 D-08 strict suppression. Routed via module-level `lastCheckTrigger` slot in `src/main/auto-update.ts` recorded by `checkUpdate(triggeredManually)` and read at top of `deliverUpdateAvailable`.

## Decisions

(v1.0 decisions preserved in `.planning/PROJECT.md` "Key Decisions" table; v1.1 + v1.1.1 decisions accumulated below.)

v1.1 + v1.1.1 decisions (preserved verbatim from Phase 13 close-out STATE.md):

- No paid signing certs in v1.1 (Apple Developer ID, Windows EV) — locked.
- Linux build verified via CI only (Phase 11); local Linux build is best-effort in Phase 10.
- Crash-reporting opt-out by default for tester builds (TEL-07); revisit before any public/store release.
- Phase 11 Plan 01: `.github/workflows/release.yml` (150 lines, 5 jobs, 5 SHA-pinned actions) + `.github/release-template.md` (envsubst-rendered, 4 REL-02 sections + Tag footer) + `package.json` build:mac/win/linux scripts now end with `--publish never` (defense-in-depth against Pitfall 1). Three atomic commits: 69c8cc1, eb8a904, c253eb6. 331 vitest tests still green; live workflow verification deferred to Plan 02.
- Phase 12 Plan 02: electron-updater@^6.8.3 added as runtime dependency (NOT devDep). electron-builder.yml `publish` flipped from null → GitHub provider (later reverted to `null` under 12.1-D-10). release.yml `test` job expanded to 3-OS matrix `[ubuntu-latest, windows-2022, macos-14]` with `fail-fast: true` preserving CI-05 atomicity. Per-platform upload-artifact steps now ship `latest*.yml` alongside installers. Publish-job `softprops/action-gh-release@v2.6.2` `files:` extended with 3 feed-file entries — draft Release ships 6 assets. UPD-06 closed.
- Phase 12 Plan 01: electron-updater 6.8.3 wired into main via new `src/main/auto-update.ts` orchestrator (autoDownload=false / autoInstallOnAppQuit=false / allowPrerelease=true; 3.5s startup check; 10s Promise.race timeout; mode-aware error handling — manual mode IPC bridge / startup mode silent-swallow per UPD-05). Hand-rolled ARIA `UpdateDialog.tsx` modal cloning HelpDialog scaffold (D-05) — state machine available → downloading → downloaded; D-09 plain-text Summary extraction (zero XSS surface); D-04 windows-fallback variant. New `src/main/update-state.ts` atomic JSON persistence (D-08 dismissedUpdateVersion + spikeOutcome fields). 5 invoke + 4 send + 1 menu-routing IPC channels. Both Windows branches (auto-update + windows-fallback) ship under one cohesive code surface per D-04: SPIKE_PASSED = `process.platform !== 'win32'` at `src/main/auto-update.ts` line 92 (default — Windows runs the manual-fallback variant LIVE by default; macOS/Linux always run the full auto-update path). UPD-01..UPD-05 closed.
- Phase 12 Plan 01 Task 6 (BLOCKING SPIKE) DEFERRED to phase 12.1 — manual-fallback variant ships LIVE on Windows by default.
- Phase 12 Plans 12-03 / 12-04 / 12-05: F1/F2/F3 Phase 11 spillover Windows runtime fixes closed at single audit sites (AtlasPreviewModal pathToFileURL bridge; AppShell pickOutputDir defaultPath subtraction; src/core/loader.ts Spine 4.2 hard-reject + SpineVersionUnsupportedError typed envelope).
- Phase 12 Plan 06: REL-03 INSTALL.md cookbook + 4-surface linking (release-template, README, Help menu, HelpDialog) closed; tests/integration/install-md.spec.ts URL-consistency regression gate authored. Phase 12 closed 6/6.
- Phase 12.1 Plan 01 D-10 (after D-01 + D-09 both falsified empirically): `scripts/emit-latest-yml.mjs` post-build synthesizer + `electron-builder.yml` `publish: null` + `package.json` build:* chains + 11 vitest schema-correctness tests. Cleanly separates the two roles `electron-builder.yml` was being asked to play (publisher-chain suppression vs feed-file emission). Validated by 4 successful CI runs (rc2 / rc3 / v1.1.0 / v1.1.1) each producing complete 6-asset GitHub Releases atomically.
- Phase 13 Plan 13-01: Cosmetic Windows fixes (autoHideMenuBar flip + setAboutPanelOptions block) at src/main/index.ts in single atomic commit `202c506`. Source-grep regression spec at tests/main/index-options.spec.ts locks both flips. Live verification deferred to Phase 13.1.
- Phase 13 Plan 13-02: CLAUDE.md `## Release tag conventions` section (dot-form `v1.2.0-rc.1` ✅ vs no-dot `v1.2.0-rc1` ❌; electron-updater 6.x channel-name comparison rationale; cross-link to resolved root-cause walkthrough todo). Single atomic commit `566ed8e`. Workflow-level regex guard deferred to v1.2+ per CONTEXT D-05.
- Phase 13 Plan 13-03: package.json + package-lock.json version bump 1.1.0 → 1.1.1 via `npm version 1.1.1 --no-git-tag-version`. Single atomic commit `612ba60`.
- Phase 13 Plan 13-05: v1.1.1 tag push + CI watch + 6-asset GitHub Release publish with stranded-rc-tester callout. autonomous: false; user passed all 3 BLOCKING checkpoint gates. Published 2026-04-29T06:43:45Z; final at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.1.

v1.1.2 decisions to date:

- Roadmap shape (2026-04-29): 2 phases — Phase 14 (renderer/state-machine fixes UPDFIX-02 + 03 + 04, code-only) before Phase 15 (build/feed-shape fix + v1.1.2 release UPDFIX-01). Rationale: Phase 14 is lower-risk and unblocks live verification of UPDFIX-01's Windows download path in Phase 15. Phase 15's release wave mirrors Plan 13-05's shape (autonomous: false, 3 BLOCKING user-confirmation checkpoints).
- Phase 13.1 (live UAT carry-forwards from v1.1.1) is **separately tracked**, NOT part of v1.1.2 — those tasks pre-date this milestone and remain pending host availability.
- Phase 14 D-05 asymmetric dismissal rule (2026-04-29): manual `Help → Check for Updates` SKIPS the `dismissedUpdateVersion` suppression branch; startup auto-check PRESERVES it. Implemented via module-level `lastCheckTrigger: 'startup' | 'manual' | null` slot in `src/main/auto-update.ts`, recorded synchronously by `checkUpdate(triggeredManually)` before `Promise.race` begins, read at top of `deliverUpdateAvailable`. This decision interpretation was confirmed during Phase 14 discuss (CONTEXT.md) per the recommended UPDFIX-02 reading and is now locked in 11 regression assertions across `tests/main/auto-update-dismissal.spec.ts` + 28 assertions in `tests/main/auto-update.spec.ts`.
- Phase 14 D-03 sticky pending-update slot (2026-04-29): module-level `pendingUpdateInfo: UpdateAvailablePayload | null` in `src/main/auto-update.ts` — written on every `update:available`; preserved on `update-not-available` (the previous available payload remains sticky); cleared via explicit `clearPendingUpdateInfo()` call. **In-memory only — no persistence to `update-state.json`** (D-Discretion-2 — slot is rebuilt every cold-start launch by the next available event). Renderer fetches via `window.api.requestPendingUpdate()` one-shot invoke during late-mount hydration on App.tsx.
- Phase 14 D-12 SHELL allow-list verified (2026-04-29): `SHELL_OPEN_EXTERNAL_ALLOWED` Set in `src/main/ipc.ts:174` still contains `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` byte-for-byte. Cross-surface drift now caught at test-time by `tests/integration/auto-update-shell-allow-list.spec.ts` (4 assertions) which reads the literal string from all 3 sites (App.tsx `onOpenReleasePage`, ipc.ts allow-list, auto-update.ts `GITHUB_RELEASES_INDEX_URL`) and asserts byte-identical agreement.
- Phase 14 renderer-mount architecture (2026-04-29): update subscriptions + `<UpdateDialog>` mount lifted from `AppShell.tsx` (which only mounts on `loaded`/`projectLoaded` AppState branches) up to `App.tsx` (mounts unconditionally on every AppState branch). This fix closes UPDFIX-04 (manual `Help → Check for Updates` no longer requires a project to be loaded) and is the architecturally-cleaner version of the alternatives considered in Phase 14 discuss (CONTEXT.md): main-side event buffering, `did-finish-load` deferral. Lift was chosen because (a) it fixes the actual root cause (renderer subscription timing) rather than papering over it, and (b) it eliminates an entire class of "renderer-not-yet-subscribed" races permanently.
- Phase 14 WR-01 sticky-slot cleanup gap (2026-04-29): `clearPendingUpdateInfo` is exported and tested but no production caller invokes it on the dismiss/download paths. Cold-start path is unaffected (in-memory-only contract). Routing decision: **gap closure via Phase 14.1** in a fresh session via `/gsd-plan-phase 14 --gaps`. Rationale: keep release-engineering (Phase 15) scope narrow; preserve the canonical GSD gap-closure flow; ~10 LoC fix is small enough to ship as its own atomic phase.

## Last session

2026-04-29 — Phase 14 (Auto-update reliability fixes — renderer + state machine) executed end-to-end via `/gsd-execute-phase 14`. 5/5 plans across 3 waves with `gsd-executor` agents in parallel git worktrees:

- **Setup (orchestrator):** committed pre-existing planning artifacts (5 PLAN.md files + 14-PATTERNS.md + ROADMAP.md plan-list bump + STATE.md tracking pointer) at `b62f665` and `9031c92` so executor worktrees would branch from a clean base.
- **Wave 1 (parallel, 2 plans):** 14-01 main-side hardening + 14-02 preload bridge. 10 worktree commits (RED→GREEN cadence) merged into 2 merge commits + 1 tracking commit; deferred-items.md add/add conflict resolved by combining both flake reports. Test gate: 471/471.
- **Wave 2 (single plan):** 14-03 renderer subscription lift from AppShell → App.tsx with late-mount hydration. 3 worktree commits + 1 merge + 1 tracking commit. Test gate: 471/471 (1 previously-flaky sampler-worker-girl spec passing again).
- **Wave 3 (parallel, 2 plans):** 14-04 TDD regression specs (inverted RED→GREEN since prod code already shipped from Waves 1-2; +18 assertions) + 14-05 cross-surface URL-consistency integration spec (+4 assertions). 8 worktree commits + 2 merge commits + 1 tracking commit. Test gate: 493/493.
- **Phase-level gates:** code review (`gsd-code-reviewer` standard depth, 0 critical / 3 warning / 5 info, headline WR-01 sticky-slot cleanup gap → committed at `ff0b9e5`); regression gate (full suite re-run 493/493 zero prior-phase regressions); verifier (`gsd-verifier` status `human_needed`; 5/5 code-level truths verified; 6 packaged-build OS UAT items persisted in `14-HUMAN-UAT.md` for Phase 15 verification; WR-01 surfaced as a code-level gap → committed at `7455eb4`/`df31405`).
- **Decision routing surfaced to user:** WR-01 routed to a Phase 14.1 gap-closure plan in a fresh session (rationale: keep Phase 15 release-engineering scope narrow; preserve canonical GSD gap-closure flow; ~10 LoC fix small enough to ship atomic).
- **Phase close-out:** ROADMAP.md Phase 14 bullet flipped `[ ]` → `[x]`; STATE.md `## Current phase` rewritten from "Not started" → "CLOSED 5/5 plans complete 2026-04-29"; `## Last completed` body refreshed; `## Decisions` extended with 5 new Phase 14 entries (D-05 asymmetric, D-03 sticky slot, D-12 allow-list, renderer-mount, WR-01 routing).

Earlier 2026-04-29 — v1.1.2 milestone roadmap created. ROADMAP.md updated to add Phases 14 + 15 under new "v1.1.2 Auto-update fixes" milestone bullet. REQUIREMENTS.md traceability table populated (UPDFIX-01 → Phase 15; UPDFIX-02 + 03 + 04 → Phase 14). 4/4 v1.1.2 requirement coverage validated.

Earlier 2026-04-29 — Plan 13-05 (Wave 4 — v1.1.1 tag push + CI watch + 6-asset GitHub Release publish) closed; v1.1.1 final published. v1.1.1 patch milestone shipped.

## Links

- PROJECT.md: `.planning/PROJECT.md`
- ROADMAP.md: `.planning/ROADMAP.md`
- REQUIREMENTS.md: `.planning/REQUIREMENTS.md`
- v1.0 archive: `.planning/milestones/`
- v1.1 phase archive: `.planning/milestones/v1.1-phases/`
- v1.1 requirements archive: `.planning/milestones/v1.1-REQUIREMENTS.md`

## Deferred Items

Carried from v1.0 milestone close (2026-04-26):

| Category | Item | Status | Disposition |
|----------|------|--------|-------------|
| debug | phase-0-scale-overshoot | investigating | Carried; not in v1.1.2 scope (sampling formula refinement) |
| todo | 2026-04-24-phase-4-code-review-follow-up (ui) | pending | Carried; not in v1.1.2 scope |
| seed | SEED-001-atlas-less-mode | dormant | Post-MVP by design |
| seed | SEED-002-dims-badge-override-cap | dormant | Post-MVP by design |
| uat_gap | Phase 07 07-HUMAN-UAT.md | signed-off | Stale flag (0 pending) |

Carried from v1.1 / v1.1.1 close:

| Category | Item | Status | Disposition |
|----------|------|--------|-------------|
| phase | Phase 13.1 live UAT carry-forwards | pending | Pending host availability; separately tracked, NOT part of v1.1.2 (Linux runbook + libfuse2 PNG capture; macOS/Windows v1.1.0 → v1.1.1 auto-update lifecycle observation; cosmetic Windows fix UX confirmation; Windows windows-fallback variant live observation) |

## Accumulated Context

### Roadmap Evolution

v1.1.2 milestone started 2026-04-29 — Auto-update fixes. Phase numbering continues from v1.1.1 (last phase: 13; next phase starts at 14). Roadmap landed 2026-04-29 with Phases 14–15. Phase 13.1 explicitly reserved and out-of-scope for this milestone.

v1.1 milestone started 2026-04-27 — Distribution. Phase numbering continued from v1.0 (last phase: 9; next phase started at 10). Roadmap landed 2026-04-27 with Phases 10–13.

- Phase 12.1 inserted after Phase 12 (2026-04-28): Installer + auto-update live verification — close v1.1 distribution surface end-to-end (CI publish-race fix, live UPD-06 spike, INSTALL.md screenshots, Windows build doc, close 9 `human_needed` items in 12-VERIFICATION.md) (URGENT — INSERTED).
- Phase 13 added: v1.1.1 polish — Phase 12.1 carry-forwards (2026-04-28). Patch release landing 4 carry-forward todos from Phase 12.1's passed_partial close (rc.N tag-convention doc, Windows menu-bar fix, Windows About-panel SemVer fix, optional Linux libfuse2 PNG). Tags v1.1.1; live-validates the v1.1.0 → v1.1.1 auto-update lifecycle (closes 12.1's deferred SC-2 / SC-4 via the `currentChannel === null` non-prerelease code path).

### v1.0 Roadmap Evolution (preserved)

- Phase 8.1 inserted after Phase 8 (2026-04-26): close Phase 8 verification gaps (locate-skeleton recovery reachability + new-skeleton dirty-guard).
- Phase 8.2 inserted after Phase 8.1 (2026-04-26): File-menu surface + Cmd+O accelerator gating fix; bundled with native File menu items.

**Planned Phase:** 14 (auto-update-reliability-fixes-renderer-state-machine) — 6 plans — 2026-04-29T12:17:16.439Z

**Planned Phase:** 15 (Build/feed shape fix + v1.1.2 release) — pending after 14.1; awaiting `/gsd-plan-phase 15`. Requirements: UPDFIX-01. Will reconcile electron-builder output with electron-updater 6.8.3 feed consumption (mac `.dmg` + `.zip` + `latest-mac.yml`; win NSIS `.exe` + `.blockmap` + `latest.yml`), bump package.json 1.1.1 → 1.1.2, tag `v1.1.2`, watch CI, publish through the existing 12.1-D-10 architecture. Will live-verify the 6 packaged-build UAT items persisted in `14-HUMAN-UAT.md`.

**Closed Phase:** 14 (Auto-update reliability fixes — renderer + state machine) — 5/5 plans complete — 2026-04-29. UPDFIX-02 + UPDFIX-03 + UPDFIX-04 closed at code level (live OS UAT carries to Phase 15 packaged-build wave). +38 regression specs added; suite at 493/493 across 45 files. Verifier status `human_needed` (5/5 code truths verified, 6 packaged-build UAT items deferred). 1 code-level gap (WR-01 sticky-slot cleanup) routed to Phase 14.1.

**Closed Phase:** 13 (v1.1.1 polish — Phase 12.1 carry-forwards) — 5/5 plans complete — 2026-04-29. v1.1.1 final published at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.1 (CI workflow run [25094013906](https://github.com/Dzazaleo/Spine_Texture_Manager/actions/runs/25094013906) succeeded ~4m07s with 6-asset atomic publish via D-10 publish-race fix architecture; user passed all 3 BLOCKING checkpoint gates: pre-flight-verify → tag-push-confirm → publish-confirm).

**Closed Phase:** 12.1 (Installer + auto-update live verification, INSERTED) — 8/8 plans complete — 2026-04-28. D-10 publish-race fix landed (`scripts/emit-latest-yml.mjs` post-build synthesizer + `electron-builder.yml` `publish: null`); validated by 3 successful CI runs (rc2 / rc3 / v1.1.0). v1.1.0 final published. INSTALL.md updated with Sequoia Gatekeeper UX + 3 real PNG screenshots. README `## Building on Windows` section landed. 4 carry-forwards to v1.1.1.

**Closed Phase:** 12 (Auto-update + tester install docs) — 6/6 plans complete — 2026-04-27T22:21Z. UPD-01..UPD-06 + REL-03 closed.

**Closed Phase:** 11 (CI release pipeline (GitHub Actions → draft Release)) — 2/2 plans complete. CI-01..CI-06 + REL-01/REL-02/REL-04 closed.

**Closed Phase:** 10 (Installer build) — 3/3 plans complete — 2026-04-27T10:08:45Z. DIST-01..DIST-07 closed.

**Closed Phase:** 14 (auto-update-reliability-fixes-renderer-state-machine) — 5 plans — closed 2026-04-29.

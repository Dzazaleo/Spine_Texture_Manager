---
gsd_state_version: 1.0
milestone: v1.1.2
milestone_name: Auto-update fixes
status: unknown
last_updated: "2026-04-29T10:01:00.675Z"
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

Phase 14 — Auto-update reliability fixes (renderer + state machine). Not started. Awaiting `/gsd-plan-phase 14`.

**Goal:** Restore reliable auto-update notification + check behavior on every cold start and on every manual `Help → Check for Updates` click on **both** macOS and Windows, regardless of whether a project file has been loaded yet, and ensure dismissing the notification does not permanently suppress it. Code-only phase touching `src/main/auto-update.ts` + `src/main/update-state.ts` + `src/renderer/src/modals/UpdateDialog.tsx` + the `update:*` IPC channels between them; no tag, no CI run, no publish (Phase 15 owns the live release surface).

**Requirements:** UPDFIX-02, UPDFIX-03, UPDFIX-04.

**Plans:** TBD (decomposed by `/gsd-plan-phase 14`).

## Current plan

— (Phase 14 not yet planned)

## Last completed

Plan 13-05 (Wave 4 — v1.1.1 tag push + CI watch + 6-asset GitHub Release publish with stranded-rc-tester callout per D-03) — 2026-04-29. autonomous: false plan with 3 BLOCKING user-confirmation checkpoints (pre-flight verify; pre-push final-confirmation; pre-publish final-verification). Executed across 9 tasks; the user passed all 3 checkpoint gates ("ready" → tag at HEAD~1 per default → "push" → "publish"). Sequence on the wire:

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

Milestone v1.1.2 (Auto-update fixes) roadmap landed 2026-04-29. **Next: `/gsd-plan-phase 14`** to decompose Phase 14 (Auto-update reliability fixes — renderer + state machine; UPDFIX-02 + UPDFIX-03 + UPDFIX-04) into executable plans. Phase 14 is code-only (no tag, no CI, no publish) and lands first because (a) the Windows Download button visibility fix (UPDFIX-02) is a prerequisite for live-verifying UPDFIX-01's Windows download path in Phase 15, and (b) the renderer/state-machine fixes are lower-risk than the build/feed-shape fix in Phase 15.

After Phase 14 closes, `/gsd-plan-phase 15` decomposes the build/feed-shape fix + v1.1.2 release wave (UPDFIX-01; package.json bump 1.1.1 → 1.1.2; tag push; CI watch; 6-asset (or 7-asset if `.zip` adds for macOS auto-update) Release publish through the existing 12.1-D-10 architecture). Phase 15's release-engineering wave will mirror Plan 13-05's shape (autonomous: false, 3 BLOCKING user-confirmation checkpoints — pre-flight verify; pre-push final confirmation; pre-publish final verification — per the user's git-beginner posture documented in user memory).

Phase 13.1 (live UAT carry-forwards from v1.1.1) remains separately tracked — pending host availability; out-of-scope for v1.1.2 fixes.

## Open questions

- Phase 15: macOS auto-update `.zip` artifact — does electron-builder 26.x produce it automatically when `mac.target` includes `dmg`, or does the target list need to add `zip` explicitly? Plan-phase 15 RESEARCH locks this against electron-updater 6.8.3's actual feed consumption against an unsigned ad-hoc `.dmg`. Cross-reference `12-RESEARCH.md` §"Unsigned-Windows Behavior" precedent for the equivalent NSIS `.exe` + `.blockmap` shape investigation.
- Phase 14: Is the manual `Help → Check for Updates` pre-load silence on macOS (UPDFIX-04) caused by (a) renderer subscription timing (renderer subscribes to `update:*` IPC events on a code path that only runs after `did-finish-load`), or (b) main-side event ordering (autoUpdater fires events synchronously inside `app.whenReady()` before the renderer is mountable)? Plan-phase 14 investigates both hypotheses; fix architecture depends on which is the root cause.
- Phase 14: UPDFIX-02 dismissal semantics — should `dismissedUpdateVersion` (Phase 12 D-08) suppress on subsequent **startup** checks but NOT on **manual on-demand** checks? Or should both paths re-present the dialog when the user explicitly clicks `Help → Check for Updates`? Recommended interpretation per UPDFIX-02 wording: manual on-demand always re-presents; startup auto-check still respects dismissedUpdateVersion. Plan-phase 14 locks this against the requirement.

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

## Last session

2026-04-29 — v1.1.2 milestone roadmap created. ROADMAP.md updated to add Phases 14 + 15 under new "v1.1.2 Auto-update fixes" milestone bullet (continuing phase numbering from Phase 13; Phase 13.1 explicitly reserved/separate). REQUIREMENTS.md traceability table populated (UPDFIX-01 → Phase 15; UPDFIX-02 + 03 + 04 → Phase 14). 4/4 v1.1.2 requirement coverage validated. STATE.md frontmatter updated (`milestone: v1.1.2`, `total_phases: 2`, all completed counters at 0). Awaiting `/gsd-plan-phase 14` to decompose Phase 14 into plans.

Earlier 2026-04-29 — Plan 13-05 (Wave 4 — v1.1.1 tag push + CI watch + 6-asset GitHub Release publish) closed; v1.1.1 final published. v1.1.1 patch milestone shipped. (Full session record preserved in v1.1.1 close-out STATE.md history; abbreviated here for v1.1.2 STATE.md focus.)

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

**Active Phase:** Phase 14 (Auto-update reliability fixes — renderer + state machine) — not started; awaiting `/gsd-plan-phase 14`. Requirements: UPDFIX-02 + UPDFIX-03 + UPDFIX-04. Code surface concentrated in `src/main/auto-update.ts` + `src/main/update-state.ts` + `src/renderer/src/modals/UpdateDialog.tsx` + the `update:*` IPC channels between them.

**Closed Phase:** 13 (v1.1.1 polish — Phase 12.1 carry-forwards) — 5/5 plans complete — 2026-04-29. v1.1.1 final published at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.1 (CI workflow run [25094013906](https://github.com/Dzazaleo/Spine_Texture_Manager/actions/runs/25094013906) succeeded ~4m07s with 6-asset atomic publish via D-10 publish-race fix architecture; user passed all 3 BLOCKING checkpoint gates: pre-flight-verify → tag-push-confirm → publish-confirm).

**Closed Phase:** 12.1 (Installer + auto-update live verification, INSERTED) — 8/8 plans complete — 2026-04-28. D-10 publish-race fix landed (`scripts/emit-latest-yml.mjs` post-build synthesizer + `electron-builder.yml` `publish: null`); validated by 3 successful CI runs (rc2 / rc3 / v1.1.0). v1.1.0 final published. INSTALL.md updated with Sequoia Gatekeeper UX + 3 real PNG screenshots. README `## Building on Windows` section landed. 4 carry-forwards to v1.1.1.

**Closed Phase:** 12 (Auto-update + tester install docs) — 6/6 plans complete — 2026-04-27T22:21Z. UPD-01..UPD-06 + REL-03 closed.

**Closed Phase:** 11 (CI release pipeline (GitHub Actions → draft Release)) — 2/2 plans complete. CI-01..CI-06 + REL-01/REL-02/REL-04 closed.

**Closed Phase:** 10 (Installer build) — 3/3 plans complete — 2026-04-27T10:08:45Z. DIST-01..DIST-07 closed.

**Planned Phase:** 14 (auto-update-reliability-fixes-renderer-state-machine) — 5 plans — 2026-04-29T10:01:00.672Z

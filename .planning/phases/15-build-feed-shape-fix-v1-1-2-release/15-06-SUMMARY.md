---
phase: 15-build-feed-shape-fix-v1-1-2-release
plan: 06
subsystem: release-engineering
tags: [hotfix, release-engineering, tag-push, github-release, ci, uat-retry, gap-closure, doc-flip]

# Dependency graph
requires:
  - phase: 15-build-feed-shape-fix-v1-1-2-release
    provides: "Plan 15-05 landed sanitizeAssetUrl synthesizer rewrite (`f123e10` test RED + `d4ec015` feat GREEN + `ca7152a` chore version-bump 1.1.2 → 1.1.3 + `883b6e1` SUMMARY). Plan 15-06 owns the v1.1.3 release engineering wave: pre-flight gates + tag at git rev-parse main + CI watch + 7-asset publish + Test 7-Retry + doc-flip + close-out."
provides:
  - "v1.1.3 published GitHub Release (https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.3) — 7 assets atomic via 12.1-D-10 publish-race-fix architecture (6th D-10-clean run); isDraft: false; isPrerelease: false; release body includes D-09 stranded-rc callout + NEW v1.1.2-mac-stranded paragraph"
  - "Annotated tag v1.1.3 at `git rev-parse main` (AP-1 lesson encoded — NOT hardcoded version-bump SHA)"
  - "URL-resolution invariant pre-flight gate (Task 1 D-07 Gate 1 EXTENDED) — every emitted files[].url MUST round-trip back to a real local file via inverse space↔dot transformation; would have caught D-15-LIVE-1 in v1.1.2"
  - "CI dry-run gate (Task 2 D-07 Gate 2) — feature-branch workflow_dispatch run mirrors the same invariants on CI's installer-mac artifact"
  - "Test 7-Retry runbook (15-HUMAN-UAT.md ## v1.1.3 Hotfix Retry section) — operator-driven empirical UPDFIX-01 closure path"
  - "Test 7-Retry empirical PARTIAL-PASS — UPDFIX-01 / D-15-LIVE-1 closed at the URL/feed layer; v1.1.1 → v1.1.3 .zip download succeeded byte-exact (121,848,102 bytes) at the canonical dotted URL"
  - "VERIFICATION.md status flipped gaps_found → passed; closure_evidence + newly_discovered_defects fields added"
  - "HUMAN-UAT.md status flipped gaps-found → signed-off"
  - "Backlog items 999.2 (macOS manual-download UX for D-15-LIVE-2) + 999.3 (Help → Check menu gating for D-15-LIVE-3) — created with directory + .gitkeep + ROADMAP.md Backlog section entries (mirroring 999.1 shape)"
affects:
  - "Phase 15 — closes 6/6 plans complete; UPDFIX-01 empirically closed; phase status complete"
  - "v1.1.2 milestone — closed at v1.1.3 hotfix (the v1.1.2 mac users on the broken feed are addressed via the v1.1.2-mac-stranded callout in v1.1.3 release body; manual download path documented)"
  - "Future macOS auto-update work — D-15-LIVE-2 (Squirrel.Mac code-sig swap fail on ad-hoc builds) routed to backlog 999.2 with manual-download UX path; v1.1.3 ships with the URL-layer fix; the install-step UX rework is a separate phase"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AP-1 lesson encoded operationally: tag at `git rev-parse main`, NOT a hardcoded version-bump SHA. Plan 15-06 Task 4 uses `TAG_BASE=$(git rev-parse main); git tag -a v1.1.3 \"$TAG_BASE\"` rather than the Phase 12.1/13 precedent of tagging the chore() commit. Future release-engineering plans inherit this pattern."
    - "URL-resolution invariant pre-flight gate (Task 1 D-07 Gate 1 EXTENDED): for every emitted `files[].url` in the locally-built `release/latest-mac.yml`, the inverse transformation `url.replace(/\\./g, ' ')` MUST resolve to an existing file in `release/`. Equivalently: `localFilename.replace(/ /g, '.') === emittedUrl` byte-for-byte. This gate would have caught D-15-LIVE-1 in v1.1.2 — the verification gap that surfaced live."
    - "Test 7-Retry partial-pass classification: the `result:` field admits `partial-pass` for empirically-closed-but-downstream-defects-discovered runs. Allows phase closure when the narrowly-scoped defect closes empirically while routing newly-surfaced downstream defects to backlog without conflating them."
    - "Backlog item shape (mirroring 999.1): empty directory `.planning/phases/<999.N>-<slug>/` + `.gitkeep` + ROADMAP.md `## Backlog` section entry with `Goal: TBD`, `Plans: 0 plans`, `Plans: - [ ] TBD`, and a `Context:` paragraph documenting why the item exists. Promotion happens via /gsd-review-backlog when ready."

key-files:
  created:
    - ".planning/phases/15-build-feed-shape-fix-v1-1-2-release/15-06-SUMMARY.md (this file)"
    - ".planning/phases/999.2-macos-auto-update-manual-download-ux/.gitkeep"
    - ".planning/phases/999.3-help-check-for-updates-gated-on-project-loaded/.gitkeep"
  modified:
    - "tests/integration/build-scripts.spec.ts (commit `95b76eb`) — bumped version assertion 1.1.2 → 1.1.3 (Rule 1 fix; Plan 15-05's chore commit `ca7152a` bumped package.json but missed the static spec assertion that hardcodes the expected version string)"
    - ".planning/phases/15-build-feed-shape-fix-v1-1-2-release/15-HUMAN-UAT.md — Test 7-Retry runbook scaffolded (commit `e34491b`) → result block populated with full Test 7-Retry transcript (4 rounds + closure evidence + user decision; commit `dc55ced`); frontmatter status gaps-found → signed-off + findings_summary appended with retry PARTIAL-PASS note + Newly discovered defects section added with D-15-LIVE-2 + D-15-LIVE-3 entries (commit `66271ca`)"
    - ".planning/phases/15-build-feed-shape-fix-v1-1-2-release/15-VERIFICATION.md — frontmatter status gaps_found → passed; score 3/5 → 5/5; overrides_applied 1 → 2; critical_defect.closure_evidence field added (3-layer closure narrative + transcript pointer + release URL + 121,848,102-byte download proof); newly_discovered_defects field added (D-15-LIVE-2 + D-15-LIVE-3 with backlog routing); SC-2 + Synthesizer key-link + UPDFIX-01 requirement rows updated to ✓ VERIFIED; trailing footer updated with full status-flip audit trail; new ## v1.1.3 Hotfix Closure section in body (commit `66271ca`)"
    - ".planning/ROADMAP.md — Backlog section extended with Phase 999.2 + Phase 999.3 entries mirroring 999.1 shape (commit `66c7f7e`); will be further updated in this close-out commit to mark Plan 15-06 [x] + Phase 15 6/6 complete"
    - ".planning/STATE.md — will be updated in this close-out commit (Phase 15 complete; current_focus advanced; Last completed updated)"

key-decisions:
  - "Test 7-Retry result classification: PARTIAL-PASS, not PASS or FAIL. Empirical closure of UPDFIX-01 / D-15-LIVE-1 at the URL/feed layer (the narrowly-scoped defect that v1.1.3 was scoped to fix) AND discovery of two NEW downstream defects (D-15-LIVE-2 ad-hoc code-sig swap fail; D-15-LIVE-3 menu gating) that are not v1.1.4 hotfix material. The plan's original PASSED/FAILED dichotomy did not anticipate this case; partial-pass + backlog routing was the right call."
  - "Newly discovered defects routed to backlog (NOT v1.1.4 hotfix). User decision (2026-04-29) after being offered three paths: (1) Apple Developer ID enrollment ($99/yr) — proper code-sig fix; (2) workaround research (e.g. switch electron-updater away from Squirrel.Mac); (3) manual-download-only flow. User chose path 3: pragmatic, honest, removes brittleness. macOS auto-update UX rework is now a separate phase (999.2)."
  - "AP-1 lesson honored: tag at `git rev-parse main`, NOT hardcoded SHA. Plan 15-06 Task 4 used `TAG_BASE=$(git rev-parse main)` per AP-1 lesson from 15-04 Task 4 tag-base bug. The chore(15-05) commit was the last commit on main at tag time, so `main` HEAD and chore(15-05) point to the same SHA in this case — but the principle (use `git rev-parse main` rather than a hardcoded SHA) is what matters; future release plans inherit this."
  - "STATE.md + ROADMAP.md owned by orchestrator close-out commit (this commit), not by Task 9 doc-flip — preserves audit-trail clarity (the doc-flip captures status changes only; the orchestrator close-out captures phase advancement). 15-04 SUMMARY established this pattern."

patterns-established:
  - "Three-layer closure narrative for live-UAT-discovered defects: (1) Code layer fix; (2) CI/feed layer invariant gate; (3) Empirical layer human verification. All three must close for the defect to be empirically closed. Documented in 15-VERIFICATION.md frontmatter critical_defect.closure_evidence.three_layer_closure field."
  - "Backlog item shape: directory + .gitkeep + ROADMAP.md `## Backlog` section entry. 999.N numbering. Captures defects/UX-bugs/observations that are out-of-scope for the current phase but worth recording. Mirrors 999.1 (App quit broken on macOS) precedent set 2026-04-29."
  - "Status-flip audit-trail in trailing footer: `_Status: ... — supersedes ...` records the full chain of status changes (passed-with-pending-uat → human_needed → gaps_found → passed) so future verifiers + future-Claude can see WHY the status flipped multiple times."

requirements-completed:
  - UPDFIX-01

# Metrics
duration: ~6m (close-out only — Tasks 8-11; full Plan 15-06 wave-4 duration ~3h end-to-end including operator out-of-band UAT execution)
completed: 2026-04-29
---

# Phase 15 Plan 06: v1.1.3 release engineering (gap closure) — Summary

**Closed Phase 15 with v1.1.3 hotfix shipped + UPDFIX-01 empirically closed at the URL/feed layer. Plan 15-06 ran the full release-engineering wave (pre-flight URL-resolution invariant + CI dry-run gate + tag at `git rev-parse main` per AP-1 lesson + CI watch + 7-asset GitHub Release publish + operator-driven Test 7-Retry + doc-flip + backlog routing for two newly-discovered downstream defects + close-out). v1.1.3 published at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.3; v1.1.1 → v1.1.3 .zip download succeeded byte-exact (121,848,102 bytes) at the canonical dotted URL — the exact request that returned HTTP 404 in v1.1.2 returns HTTP 200 in v1.1.3. D-15-LIVE-2 (Squirrel.Mac code-sig swap fail on ad-hoc builds) + D-15-LIVE-3 (Help → Check menu gated on project loaded) routed to backlog 999.2 + 999.3 per user decision (manual-download UX path, NOT Apple Developer Program enrollment).**

## Performance

- **Duration:** ~3h end-to-end including operator-out-of-band Test 7-Retry execution; ~6 min agent-time for the close-out wave (Tasks 8-11)
- **Started:** 2026-04-29 (Plan 15-06 Task 1 pre-flight)
- **Completed:** 2026-04-29T22:05Z (this close-out commit)

## Commits on Plan 15-06's wire

| Order | Hash      | Type      | Subject                                                                                                                                  |
| ----- | --------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `95b76eb` | fix       | bump build-scripts.spec.ts version assertion 1.1.2 → 1.1.3 (Rule 1 fix surfaced during Task 1 pre-flight vitest gate)                    |
| 2     | `e34491b` | docs      | scaffold Test 7-Retry runbook for v1.1.3 UPDFIX-01 retry (Task 3 — pre-tag UAT scaffold extended with v1.1.3 retry block)                |
| 3     | (tag)     | —         | local annotated tag `v1.1.3` at `e34491b` (= `git rev-parse main` at tag time per AP-1 lesson)                                           |
| 4     | `7059407` | chore     | tag v1.1.3 pushed; CI run 25134117790 succeeded; 7-asset draft Release verified (Task 5 — CI watch + 7-asset assertion)                  |
| 5     | `b74be5b` | docs      | author v1.1.3 release body — D-09 stranded-rc callout + NEW v1.1.2-mac-stranded paragraph (Task 6 — release body authored on draft)      |
| 6     | `5234f26` | chore     | publish v1.1.3 release (flip draft → false) (Task 7 — `gh release edit v1.1.3 --draft=false`; remote-metadata-only; isDraft: false)      |
| 7     | `dc55ced` | test      | Test 7-Retry partial-pass — UPDFIX-01 closed at URL layer; new defects D-15-LIVE-2 + D-15-LIVE-3 routed to backlog (Task 8)              |
| 8     | `66c7f7e` | docs      | add backlog 999.2 + 999.3 — macOS manual-download UX (D-15-LIVE-2) + menu gating fix (D-15-LIVE-3) (Task 9 — backlog items)              |
| 9     | `66271ca` | docs      | doc-flip — UPDFIX-01 / D-15-LIVE-1 empirically closed; new defects routed to backlog (Task 10 — VERIFICATION + HUMAN-UAT status flips)   |
| 10    | (this)    | docs      | close v1.1.3 hotfix phase — 6/6 plans complete; UPDFIX-01 empirically closed (Task 11 — close-out: SUMMARY + STATE + ROADMAP)            |

Tasks 1-2 (pre-flight + CI dry run) were verify-only — no commits, but produced load-bearing gate evidence: Task 1 D-07 Gate 1 EXTENDED produced clean local build artifacts with the URL-resolution round-trip invariant locked; Task 2 D-07 Gate 2 produced CI run 25131180144 success on feat branch with the same invariants on installer-mac artifact.

## Reference URLs

- **v1.1.3 GitHub Release:** https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.3
- **CI run (tag push, success):** https://github.com/Dzazaleo/Spine_Texture_Manager/actions/runs/25134117790
- **CI run (Task 2 dry run, success):** https://github.com/Dzazaleo/Spine_Texture_Manager/actions/runs/25131180144

## Test 7-Retry Result (PARTIAL-PASS)

**Operator:** Leo (macOS Sequoia, arm64)
**Date:** 2026-04-29

**UPDFIX-01 / D-15-LIVE-1 EMPIRICALLY CLOSED:**
- v1.1.1 → v1.1.3 .zip download succeeded byte-exact (121,848,102 bytes) from canonical dotted URL `Spine.Texture.Manager-1.1.3-arm64.zip`
- The exact request that returned HTTP 404 in v1.1.2 returns HTTP 200 in v1.1.3
- sanitizeAssetUrl() synthesizer rewrite (Plan 15-05) verified live
- UpdateDialog rendered v1.1.3 release notes correctly; "Download & Restart" button progressed download to completion

**Newly discovered defects (NOT blocking Phase 15; routed to backlog per user decision):**
- **D-15-LIVE-2** (medium): macOS Squirrel.Mac swap fails code-signature validation on ad-hoc signed builds. Squirrel.Mac downloaded + unpacked v1.1.3 successfully but rejected the swap with "Code signature ... did not pass validation: code failed to satisfy specified code requirement(s)". Both v1.1.1 and v1.1.3 are ad-hoc signed (no Apple Developer ID); ad-hoc DR mismatch causes Squirrel.Mac strict-validation to abort. NOT a regression — latent since v1.0.0; earlier auto-update attempts failed at earlier pipeline stages so the code-sig check was never reached. Routed to backlog 999.2.
- **D-15-LIVE-3** (low, UX): Help → Check for Updates gated on JSON project loaded. Routed to backlog 999.3.

**User decision:** manual-download UX path (NOT Apple Developer Program $99/yr enrollment). Pragmatic, honest, removes brittleness. macOS auto-update UX rework is a separate phase (999.2).

**Round 1 transcript note:** v1.1.1 has no `console.info` instrumentation (Phase 14 only). The runbook expected log lines that don't exist in v1.1.1; silent success was the expected behavior. Manual check via Help → Check for Updates worked correctly (round 2).

Full transcript: `.planning/phases/15-build-feed-shape-fix-v1-1-2-release/15-HUMAN-UAT.md ## v1.1.3 Hotfix Retry § Test 7-Retry result block`.

## AP-1 Lesson Honored

Plan 15-04 Task 4 had a tag-base bug (tagged at chore(15-01) version-bump SHA `abf7a32`, which excluded Plan 15-03's CI glob fix `1925ebd`; first push produced 6-asset Release missing macOS .zip; recovered via Option A retag at main HEAD).

**Plan 15-06 Task 4 fix:** `TAG_BASE=$(git rev-parse main); git tag -a v1.1.3 "$TAG_BASE"` — the tag base is computed dynamically from main HEAD, NOT hardcoded. In this case, `chore(15-05)` (commit `ca7152a`) AND `fix(15-06)` Rule 1 commit (`95b76eb`) AND `docs(15-06) Task 3` (`e34491b`) were all on main at tag time, so `git rev-parse main` returned `e34491b`, which is what `v1.1.3^{}` resolves to. The principle is what matters: use `git rev-parse main` rather than a hardcoded SHA, so future plans naturally inherit the lesson.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Static spec assertion missed by version bump**

- **Found during:** Task 1 pre-flight (D-07 Gate 1 EXTENDED)
- **Issue:** Plan 15-05 Task 3's `npm version 1.1.3 --no-git-tag-version` bumped package.json + package-lock.json but did not touch `tests/integration/build-scripts.spec.ts`, which contains a hardcoded version assertion that read `'1.1.2'`. Vitest gate failed pre-flight on `expect(pkg.version).toBe('1.1.2')`.
- **Fix:** Bumped the assertion 1.1.2 → 1.1.3 to match package.json's bumped version.
- **Files modified:** `tests/integration/build-scripts.spec.ts`
- **Commit:** `95b76eb`
- **Forward-looking:** Future version-bump SUMMARY commits should include a `grep -rn "1\\.1\\.[0-9]" tests/` check to catch hardcoded version assertions before tagging.

### User-decision Deviations

**2. Test 7-Retry classification expanded from PASS/FAIL to PARTIAL-PASS**

- **Found during:** Task 8 — operator transcript review
- **Issue:** Plan's Task 8 acceptance criteria specified PASSED or FAILED, but operator's empirical result was a partial-pass: UPDFIX-01 closed at URL/feed layer (PASS for the narrowly-scoped defect) BUT two new downstream defects discovered (D-15-LIVE-2 + D-15-LIVE-3). PASS would have undersold the new defects; FAIL would have unfairly overstated them (UPDFIX-01 IS closed; the new defects are out-of-scope).
- **Decision:** Classified as PARTIAL-PASS. New defects routed to backlog (999.2 + 999.3) per user decision (manual-download UX path, NOT v1.1.4 hotfix). 15-HUMAN-UAT.md `## Summary` updated with `partial-pass: 1` field.
- **Files modified:** `15-HUMAN-UAT.md` (Test 7-Retry result block + Summary block + Newly discovered defects section)
- **Commit:** `dc55ced` (Task 8) + `66c7f7e` (Task 9 backlog items) + `66271ca` (Task 10 doc-flip)
- **Pattern established:** PARTIAL-PASS is a valid `result:` value for live-UAT runs that close a narrowly-scoped defect while surfacing downstream-but-out-of-scope new defects. Surrounding work (backlog routing + doc-flip) absorbs the new defects without conflating them with the closed defect.

## Phase 15 Closure

**6/6 plans complete:**

- [x] 15-01-PLAN.md — Build config + version bump (electron-builder.yml mac.target zip + package.json bare CLI flags + 1.1.1→1.1.2)
- [x] 15-02-PLAN.md — Synthesizer dual-installer mac extension + 4 new vitest assertions
- [x] 15-03-PLAN.md — release.yml CI extension + greenfield build-scripts.spec.ts
- [x] 15-04-PLAN.md — v1.1.2 release engineering: tag push + CI watch + 7-asset GitHub Release publish + D-10 split UAT (live UAT Test 7 surfaced D-15-LIVE-1)
- [x] 15-05-PLAN.md — UPDFIX-01 hotfix v1.1.3 (gap closure for D-15-LIVE-1): sanitizeAssetUrl synthesizer rewrite + no-spaces regression test + version bump 1.1.2→1.1.3
- [x] 15-06-PLAN.md — v1.1.3 release engineering (gap closure): pre-flight + tag at git rev-parse main + CI watch + 7-asset publish + Test 7-Retry + doc-flip + close-out (this plan)

**UPDFIX-01 status:** SATISFIED — empirically closed at the URL/feed layer via Test 7-Retry partial-pass. Three-layer closure narrative documented in 15-VERIFICATION.md frontmatter critical_defect.closure_evidence.

**v1.1.2 milestone status:** SHIPPED — v1.1.2 published 2026-04-29T17:52:50Z (had broken auto-update; mac users stranded); v1.1.3 hotfix published 2026-04-29 with the URL fix + the v1.1.2-mac-stranded callout in release notes (manual download path documented).

**Outstanding work (NOT in v1.1.2 / Phase 15 scope):**
- Backlog 999.2 (macOS auto-update — switch to manual-download UX; D-15-LIVE-2)
- Backlog 999.3 (Help → Check for Updates gated on project loaded; D-15-LIVE-3)
- Phase 13.1 carry-forwards (Linux runbook + libfuse2 PNG capture; macOS/Windows v1.1.0→v1.1.1 lifecycle observation; cosmetic Windows fix UX confirmation; Windows windows-fallback variant live observation)
- Phase 999.1 (App quit broken on macOS — Cmd+Q + AppleScript)

## Self-Check: PASSED

- ✓ FOUND: `.planning/phases/15-build-feed-shape-fix-v1-1-2-release/15-06-SUMMARY.md` (this file)
- ✓ FOUND: `.planning/phases/999.2-macos-auto-update-manual-download-ux/.gitkeep`
- ✓ FOUND: `.planning/phases/999.3-help-check-for-updates-gated-on-project-loaded/.gitkeep`
- ✓ FOUND: commit `95b76eb` (Rule 1 fix)
- ✓ FOUND: commit `e34491b` (Task 3 runbook scaffold)
- ✓ FOUND: commit `7059407` (Task 5 tag push + CI watch)
- ✓ FOUND: commit `b74be5b` (Task 6 release body)
- ✓ FOUND: commit `5234f26` (Task 7 publish)
- ✓ FOUND: commit `dc55ced` (Task 8 Test 7-Retry partial-pass)
- ✓ FOUND: commit `66c7f7e` (Task 9 backlog items)
- ✓ FOUND: commit `66271ca` (Task 10 doc-flip)
- ✓ v1.1.3 Release published at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.3
- ✓ Tag v1.1.3 reachable from origin (pushed Task 5)
- ✓ VERIFICATION.md status: passed
- ✓ HUMAN-UAT.md status: signed-off

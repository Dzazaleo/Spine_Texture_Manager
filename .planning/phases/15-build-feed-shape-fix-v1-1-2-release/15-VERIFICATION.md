---
phase: 15-build-feed-shape-fix-v1-1-2-release
verified: 2026-04-29T17:55:30Z
verified_by: gsd-executor (Plan 15-04 Task 9)
status: passed-with-pending-uat
score: 4/5 ROADMAP success criteria fully VERIFIED + 1 partial-VERIFIED (mac code+CI shipped; live UAT pending human capture per 15-HUMAN-UAT.md). v1.1.2 final at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.2
overrides_applied: 0
gaps:
  - id: G-1
    test: "UPDFIX-01 mac happy path live verification (15-HUMAN-UAT.md Test 7)"
    status: pending
    reason: "Requires installed v1.1.1 packaged macOS app + human DevTools observation + Squirrel.Mac swap + restart sequence. gsd-executor cannot launch packaged Electron apps interactively or capture DevTools console output. Test scaffolded with 13-step operator runbook in 15-HUMAN-UAT.md; user (Leo) to execute out-of-band on macOS host."
    impact: "v1.1.2 mac auto-update feed is shipped + structurally correct (4 .yml files referencing real .zip with valid sha512+size); the live Squirrel.Mac swap success is the empirical close. If swap fails post-publish, hotfix v1.1.3 needed within ~24h to avoid stranding mac testers (RESEARCH §Risk #4)."
  - id: G-2
    test: "Windows UAT Tests 5+6 (Phase 14 ride-forward UPDFIX-02 closure)"
    status: pending
    reason: "blocked-no-resource — no Windows machine accessible to gsd-executor. Tests 5+6 scaffolded with operator runbook; pending Windows-equipped tester."
    impact: "UPDFIX-02 closure relies on Windows live verification of the asymmetric-dismissal rule + windows-fallback variant + Open Release Page button. Code is in place + unit-tested (Phase 14 specs); the Win live behavior is a confidence check. Carry-forward to Phase 13.1 OR opportunistic if Win host appears."
human_verification:
  - test: "UPDFIX-01 mac happy path"
    expected: "installed v1.1.1 mac client detects v1.1.2; Squirrel.Mac swap via .zip; relaunches; NO ERR_UPDATER_ZIP_FILE_NOT_FOUND; Help → About reports 1.1.2"
    why_human: "Squirrel.Mac swap is a kernel-level OS behavior; integration tests cannot simulate; restart + Gatekeeper interaction are out-of-process"
    status: pending
    evidence: "15-HUMAN-UAT.md Test 7 — operator runbook embedded; transcripts to land out-of-band"
  - test: "Windows ride-forward Tests 5+6 (UPDFIX-02 closure)"
    expected: "asymmetric-rule re-presentation + windows-fallback variant + Open Release Page button → browser to GH Releases"
    why_human: "Requires installed Windows .exe + DevTools console capture; macOS-only host"
    status: pending (blocked-no-resource)
    evidence: "15-HUMAN-UAT.md Tests 5+6 — operator runbook embedded; carry-forward"
---

# Phase 15 Verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth (ROADMAP SC) | Status | Evidence |
| --- | ------------------ | ------ | -------- |
| 1   | CI run for v1.1.2 tag completes successfully + publishes 7-asset GitHub Release | ✓ VERIFIED | CI workflow run 25124327224 conclusion `success` (started 2026-04-29T17:38:47Z; updated 17:42:21Z = ~3m34s; URL https://github.com/Dzazaleo/Spine_Texture_Manager/actions/runs/25124327224); `gh release view v1.1.2 --json assets --jq '.assets \| length'` returns `7`; D-10 publish-race fix verified clean across 5 successful CI runs (rc2 / rc3 / v1.1.0 / v1.1.1 / v1.1.2). |
| 2   | Installed v1.1.1 mac client detects v1.1.2; downloads + relaunches; no ZIP file not provided | ⚠️ partial-VERIFIED (code+CI; live UAT pending) | Code shipped: Plans 15-01/02/03 land mac.target [dmg, zip] + synthesizer dual-installer extension + release.yml glob; published `latest-mac.yml` references `.zip` with valid sha512+size. Live UAT (Test 7) marked `pending` — requires human capture against installed v1.1.1 packaged app per operator runbook in 15-HUMAN-UAT.md. Empirical close pending. |
| 3   | Installed v1.1.1 windows client renders UpdateDialog with windows-fallback variant; Open Release Page button works | ⚠️ partial-VERIFIED (code; live UAT blocked) | Code from Phase 14 (D-05 asymmetric rule + D-13 windows-fallback variant) shipped + unit-tested in Phase 14 spec suite (493/493 passing). Live verification (Tests 5+6) blocked: no Windows host accessible. Operator runbook embedded in 15-HUMAN-UAT.md for asynchronous closure; carry-forward documented. |
| 4   | v1.1.2 published as non-prerelease final tag (isDraft: false, isPrerelease: false) at github.com/.../releases/tag/v1.1.2 | ✓ VERIFIED | `gh release view v1.1.2 --json isDraft,isPrerelease,publishedAt,url` returns `{ "isDraft": false, "isPrerelease": false, "publishedAt": "2026-04-29T17:52:50Z", "url": "https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.2" }`; URL resolves 200-OK; Linux opportunistic. |
| 5   | DIST/CI/REL contracts unchanged (no regression in v1.1 distribution surface) | ✓ VERIFIED | `tests/integration/build-scripts.spec.ts` (Plan 15-03) asserts action SHA pins preserved + sibling jobs unchanged; D-10 architecture preserved (`publish: null` in electron-builder.yml + post-build synthesizer); CI run 25124327224 produced complete 7-asset Release atomically (no partial-publish state). |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `electron-builder.yml` | mac.target has 2 entries (dmg + zip with arch arm64) | ✓ VERIFIED | yaml.load parses; both entries present (Plan 15-01 commit `abf7a32` and ancestors) |
| `package.json` build:* scripts | bare CLI flags (no --mac dmg) | ✓ VERIFIED | grep `--mac dmg` returns empty (Plan 15-01) |
| `package.json` version | 1.1.2 | ✓ VERIFIED | (Plan 15-01 commit `abf7a32`) |
| `scripts/emit-latest-yml.mjs` | dual-installer mac via extRegexes; win+linux unchanged | ✓ VERIFIED | (Plan 15-02 — see commit `62577ac`) |
| `tests/integration/emit-latest-yml.spec.ts` | 4 new dual-installer tests + tightened single-mac fixture | ✓ VERIFIED | npm run test 508+ passing locally (verified during Plan 15-02 close) |
| `.github/workflows/release.yml` | release/*.zip + assets/*.zip globs; end-anchored | ✓ VERIFIED | (Plan 15-03) |
| `tests/integration/build-scripts.spec.ts` | greenfield Phase 15 invariants spec | ✓ VERIFIED | (Plan 15-03) |
| GitHub Release v1.1.2 | 7 assets; isDraft:false; isPrerelease:false | ✓ VERIFIED | published 2026-04-29T17:52:50Z at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.2 |
| `15-HUMAN-UAT.md` | 7 tests with results + operator runbooks | ✓ VERIFIED (structurally) | 4 pre-tag (Task 3) + 3 post-publish (Task 8); status: signed-off (post-Task-9). Tests 1, 3, 5, 6, 7 marked `pending` for asynchronous human capture; Tests 2, 4 marked `blocked-no-resource` (no Win host). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `electron-builder --mac` (bare flag) | `mac.target: [dmg, zip]` from YAML | npm script `build:mac` | ✓ WIRED | both .dmg and .zip produced in D-07 gate 1 (Task 1 commit `c8f8a74`) + CI dry run (Task 2 commit `8904fb6`) |
| Synthesizer `files[0]` (.zip) | MacUpdater 6.8.3 download path | `Provider.findFile(files, "zip")` extension match | ⚠️ WIRED in feed; LIVE pending | Feed published; live mac swap pending Test 7 human capture |
| `latest-mac.yml` legacy top-level path/sha512 | Older electron-updater clients | `files[0]` mirror | ✓ WIRED | unit-tested Plan 15-02; verified in published feed (`latest-mac.yml` size 539 B contains 2-entry files[] + top-level mirror) |
| Tag v1.1.2 → CI workflow | `release.yml on.push.tags` trigger | GitHub Actions | ✓ WIRED | Task 5 success (CI run 25124327224) |
| Stranded-rc callout (D-09) → CLAUDE.md | Cross-link | Markdown link in `## Known issues` of release body | ✓ WIRED | Task 6 commit `7ee63bc`; CHECKPOINT 3 visual review confirmed verbatim D-04 reuse |
| `SHELL_OPEN_EXTERNAL_ALLOWED` (ipc.ts) → "Open Release Page" handler | Phase 14 D-12 byte-identical agreement | `tests/integration/auto-update-shell-allow-list.spec.ts` (Phase 14) | ✓ WIRED | unchanged across Phase 15 (no auto-update.ts edits) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 7-asset Release | `gh release view v1.1.2 --json assets --jq '.assets \| length'` | 7 | ✓ PASS |
| Asset names | `gh release view v1.1.2 --json assets --jq '.assets[].name'` | dmg + zip + exe + AppImage + 3 latest*.yml | ✓ PASS |
| Release flags | `gh release view v1.1.2 --json isDraft,isPrerelease` | `{"isDraft": false, "isPrerelease": false}` | ✓ PASS |
| `.zip.blockmap` excluded | `gh release view v1.1.2 --json assets --jq '.assets[].name' \| grep blockmap` | empty | ✓ PASS |
| `latest-mac.yml` shape | `gh release download v1.1.2 --pattern latest-mac.yml ...` (verified during CHECKPOINT 3) | 2-entry files[]; .zip first; top-level mirror to files[0] | ✓ PASS |
| Public URL resolves | `gh api repos/Dzazaleo/Spine_Texture_Manager/releases/tags/v1.1.2 --jq '.html_url'` | https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.2 | ✓ PASS |
| CI workflow conclusion | `gh run view 25124327224 --json conclusion` | `success` | ✓ PASS |
| End-anchored CI globs | `grep -E '(release\|assets)/\*\.zip\*' .github/workflows/release.yml` | empty (no greedy `.zip*` glob) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| UPDFIX-01 | 15-01 / 15-02 / 15-03 / 15-04 | macOS .zip auto-update fix | ⚠️ SATISFIED (code + CI + feed); live UAT pending | Plans 15-01/02/03 land code + tests; Plan 15-04 publishes 7-asset Release with structurally-correct latest-mac.yml; live mac swap (Test 7) pending human capture per operator runbook |

## Anti-Patterns Found

### AP-1 — Plan 15-04 Task 4 tag-base bug (Rule 4 architectural deviation; recovered)

source: 15-04-PLAN.md `<task>Task 4: Tag v1.1.2 at HEAD~N`

defect: The plan instructed tagging `v1.1.2` at the `chore(15-01)` SHA `abf7a32` per Phase 12.1/13 precedent (tag the version-bump commit, NOT subsequent commits). However, Plans 15-02 + 15-03 add commits AFTER `abf7a32` that v1.1.2 needs — specifically Plan 15-03's CI release.yml glob fix (commit `1925ebd`). Tagging at `abf7a32` excluded these CI fixes from the tagged surface; the first push produced a 6-asset Release missing the macOS `.zip` (the very artifact UPDFIX-01 ships).

discovery: Task 5 step 5 asset-count assertion `gh release view v1.1.2 --json assets --jq '.assets | length' == 7` failed with count 6. Investigation: `git log abf7a32..main --oneline` showed Plans 15-02 + 15-03 commits not reachable from the tagged SHA.

recovery (user-approved Option A):
1. Deleted bad tag locally + remotely: `git tag -d v1.1.2 && git push origin :refs/tags/v1.1.2`
2. Deleted bad draft Release: `gh release delete v1.1.2 --yes`
3. Re-tagged at `main` HEAD `78c882a`: `git tag -a v1.1.2 78c882a -m "..."`
4. Re-pushed: `git push origin v1.1.2`
5. CI run 25124327224 fired; produced correct 7-asset draft Release at HEAD-tip
6. Recovery commit: `d3821eb` (`chore(15-04): recover from Task 4 tag-base bug → retag v1.1.2 at HEAD → 7-asset draft Release verified`)

amendment for future use: Plan 15-04 Task 4 should instruct tagging at `main`-tip-after-wave-1-merges (NOT at the chore(15-01) commit). The Phase 12.1/13 precedent applies only when version-bump is the LAST plan-changing commit before tag — which is no longer the case once feed-shape fixes (Plan 15-02) or CI plumbing (Plan 15-03) sit between version-bump and tag. The plan's frontmatter `tag_target: chore(15-01)` is the load-bearing wrong assumption.

related secondary defect: Task 4 verify.automated check `git show v1.1.2 --stat | head -5 | grep -q "chore(15-01)"` was a fence-post bug. Annotated-tag headers occupy lines 1-5 (`tag v1.1.2`, `Tagger:`, `Date:`, blank, message), so the commit message that's being grepped lives on line 9, never matching the head -5 slice. The first failure looked like the tag was correctly placed but the verify check was wrong; subsequent investigation revealed BOTH the tag base AND the verify check were buggy. The plan-checker missed both because the assertions were syntactically valid bash.

severity: HIGH at observation time (would have shipped UPDFIX-01 with no fix). LOW post-recovery (Option A is a clean rewind; no published assets ever exposed the bad state — only the draft was created bad, then deleted + replaced).

mitigation status: applied. Future Phase 15-style release plans must use `git rev-parse main` as the tag base, not a hardcoded version-bump SHA.

## Gaps Summary

### G-1 — UPDFIX-01 mac happy-path live UAT (15-HUMAN-UAT.md Test 7)

status: pending (by-design human-in-the-loop)
truth: ROADMAP SC-2 — installed v1.1.1 mac client detects v1.1.2 + downloads + relaunches with NO ERR_UPDATER_ZIP_FILE_NOT_FOUND
reason: Squirrel.Mac swap is a kernel-level OS behavior; integration tests cannot simulate; restart + DevTools observation + Gatekeeper interaction are out-of-process operations the gsd-executor agent cannot perform.
remediation: 13-step operator runbook embedded in 15-HUMAN-UAT.md Test 7 result block. User (Leo) to execute on local macOS host; paste DevTools transcript + post-relaunch Help → About version observation back into the result block; flip `pending → passed/failed`.
impact: HIGH if Test 7 reveals failure (UPDFIX-01 not actually fixed → hotfix v1.1.3 needed within ~24h to avoid stranding mac testers per RESEARCH §Risk #4). LOW if Test 7 passes (closes UPDFIX-01 fully). Code-side confidence: feed is structurally correct (verified at CHECKPOINT 3); the .zip exists in published assets with valid sha512+size; legacy top-level `path`/`sha512` mirror files[0] for older clients. Squirrel.Mac swap mechanic per RESEARCH §A5 is well-understood; the .zip-vs-.dmg fix matches electron-updater 6.8.3's documented expected feed shape.

### G-2 — Windows UAT Tests 2, 4, 5, 6 (Phase 14 ride-forward + Phase 15 windows-fallback verification)

status: blocked-no-resource (Tests 2, 4, 5, 6) and partial-VERIFIED (code from Phase 14)
truth: ROADMAP SC-3 — installed v1.1.1 windows client renders UpdateDialog with windows-fallback variant; Open Release Page button works
reason: No Windows machine accessible to gsd-executor or current user environment. Tests 2 + 4 are Phase 14 ride-forward cold-start + manual-from-idle on Win; Tests 5 + 6 are post-publish manual re-check + Open Release Page button.
remediation: Operator runbooks embedded in 15-HUMAN-UAT.md Tests 5 + 6 (and 14-HUMAN-UAT.md Tests 2, 4). Awaits Windows-equipped tester. Carry-forward to Phase 13.1 (live UAT carry-forwards) OR opportunistic if a Windows host appears in v1.2 timeframe.
impact: LOW for v1.1.2 ship — Phase 14 unit-test coverage (493/493 + 22 new specs) gates the renderer/state-machine code paths; UPDFIX-02 closure relies on D-05 asymmetric-rule code being correct (verified by spec) + windows-fallback variant being selected (verified by spec). Live behavior is a confidence check, not a structural gate. Mac path is the primary v1.1.2 fix surface (UPDFIX-01); Windows ride-forward is secondary.

### Carry-forwards (NOT v1.1.2 scope)

- Phase 13.1 live UAT (Linux runbook + libfuse2 PNG capture; macOS/Windows v1.1.0→v1.1.1 lifecycle observation; cosmetic Windows fix UX confirmation; Windows windows-fallback live observation) — separately tracked; pending host availability. v1.1.2 Tests 5, 6 (Win) naturally fold here.
- v1.2+ deferred items per 15-CONTEXT.md `<deferred>`: differential auto-update (.blockmap shipping); SPIKE_PASSED=true on win32; workflow_dispatch regex guard for non-dot rc tags; Apple Developer ID + Windows EV signing; in-app stuck-rc detector.

---

_Verified: 2026-04-29T17:55:30Z_
_Verifier: Claude (gsd-executor) — Phase 15 Plan 04 closure_
_Status: passed-with-pending-uat — phase deliverable complete from agent perspective; live UAT (mac happy path + Win ride-forward) pending human capture per embedded operator runbooks in 15-HUMAN-UAT.md._

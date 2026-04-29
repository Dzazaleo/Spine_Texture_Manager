---
phase: 13-v1-1-1-polish-phase-12-1-carry-forwards
verified: 2026-04-29T06:45:00Z
status: passed
score: 5/5 Phase 13 plans complete — 4/4 Phase 12.1 carry-forwards closed at code/docs level (Anti-Patterns #1 + #3 + #4 in 12.1-VERIFICATION.md, plus Gaps Summary polish-todos rc-channel naming + autoHideMenuBar + About-panel SemVer) + v1.1.1 final published 2026-04-29 with 6-asset GitHub Release atomically (D-10 publish-race fix verified clean — workflow run 25094013906); live UAT (Linux runbook + macOS/Windows v1.1.0 → v1.1.1 auto-update lifecycle) deferred to Phase 13.1 per CONTEXT D-01 split
overrides_applied: 0
re_verification: null  # Phase 13 is its own initial verification
human_verification: []  # No Phase 13 human-verified items (live UAT deferred to Phase 13.1 per D-07)
---

# Phase 13: v1.1.1 polish — Phase 12.1 carry-forwards — Verification Report

**Phase Goal:** Land the **code- and docs-side** changes that close out Phase 12.1's carry-forward backlog, then tag and publish **v1.1.1 final** as a maintenance release. Live-verification work (Linux UAT runbook, libfuse2 PNG capture, macOS / Windows v1.1.0 → v1.1.1 auto-update lifecycle observation) is split into a follow-up **Phase 13.1** so v1.1.1 can ship without being host-blocked on Linux.

**Verified:** 2026-04-29T06:45:00Z
**Status:** passed
**Re-verification:** No — initial verification (Phase 13.1, when inserted, will record the live-UAT verification round in its own report). Plan 13-05's tag push + Release publish completed 2026-04-29T06:43:45Z; this report's frontmatter flipped from `status: passed_partial` → `passed` and T-6 below flipped from PENDING → VERIFIED.

**v1.1.1 publication: LIVE — published 2026-04-29T06:43:45Z at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.1 (CI workflow run 25094013906; 6 assets atomic).**

## Goal Achievement

Phase 13 closed **4 of 4** Phase 12.1 carry-forwards at the code/docs level via three single-concern atomic commits across Wave 1–2. The closures are: rc-channel naming convention documented as project policy (Plan 13-02 commit `566ed8e`); Windows menu bar visible by default (`autoHideMenuBar: true → false` at `src/main/index.ts:339`, Plan 13-01 commit `202c506`); Windows About panel reads SemVer (`app.setAboutPanelOptions(...)` block inserted in `app.whenReady()`, Plan 13-01 commit `202c506`); and `package.json` + `package-lock.json` bumped 1.1.0 → 1.1.1 unblocking Plan 13-05's tag push (Plan 13-03 commit `612ba60`). Three pending todos under `.planning/todos/pending/` were moved to `.planning/todos/resolved/` via `git mv` (88%-style rename similarity per the 12.1-07 precedent) with `## Resolved` sections appended documenting their closure provenance.

The v1.1.1 publication itself — `v1.1.1` tag push, CI run producing the 6-asset GitHub Release atomically per the 12.1-D-10 publish-race fix, Release body authoring with the D-03 stranded-rc-tester callout, and the irreversible "Publish" click — is owned by Plan 13-05 (autonomous: false; user-confirmation gate before tag push and before Release publish). Live UAT scope (Linux runbook execution, libfuse2 PNG capture, macOS / Windows v1.1.0 → v1.1.1 auto-update lifecycle observation, windows-fallback variant live observation, live verification of the cosmetic Windows fixes from Plan 13-01) is split to Phase 13.1 per CONTEXT D-01 — the same two-phase split shape that worked for 12 → 12.1. This Plan 13-04 lands the verification + state surface BEFORE Plan 13-05's irreversible tag push so the documented state is accurate whether Plan 05 succeeds (small follow-up edit flips publication-pending markers to "published") or aborts (state remains accurate as "code/docs landed; tag-push + Release publish pending").

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| T-1 | rc-channel naming convention documented as project policy in CLAUDE.md `## Release tag conventions` section (Anti-Pattern #1 closure) | VERIFIED | `grep -c "^## Release tag conventions$" CLAUDE.md` returns `1`; section sits between `## Critical non-obvious facts` (L14) and `## Test fixture` (L34); `grep -c "^## " CLAUDE.md` returns `8` (was 7); cross-link points at `.planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md` (file present at resolved path; 87% rename similarity preserved git blame). Plan 13-02 commit `566ed8e`. |
| T-2 | `autoHideMenuBar: false` shipped at `src/main/index.ts:339` BrowserWindow constructor (Anti-Pattern #3 closure) — Windows + Linux menu bar visible by default | VERIFIED at code level; live verification deferred to Phase 13.1 per D-07 | `grep -c "autoHideMenuBar:\s*false" src/main/index.ts` returns `1`; `grep -c "autoHideMenuBar:\s*true" src/main/index.ts` returns `0`; `tests/main/index-options.spec.ts` source-grep regression test passes (vitest +2 to 455). Unconditional fix per CONTEXT D-06 (no platform-conditional branch — macOS no-ops the flag). Plan 13-01 commit `202c506`. |
| T-3 | `app.setAboutPanelOptions({ applicationName: 'Spine Texture Manager', applicationVersion: app.getVersion() })` shipped inside `app.whenReady()` callback at `src/main/index.ts` (Anti-Pattern #4 closure) — Windows About panel will read SemVer (`1.1.1`) instead of win32 FileVersion 4-component padding (`1.1.1.0`) | VERIFIED at code level; live verification deferred to Phase 13.1 per D-07 | `grep -c "app.setAboutPanelOptions" src/main/index.ts` returns at least `1`; `grep -q "applicationVersion: app.getVersion()" src/main/index.ts` succeeds; `tests/main/index-options.spec.ts` source-grep regression test passes. Unconditional call per CONTEXT D-06 (Electron no-ops unsupported per-platform fields). Plan 13-01 commit `202c506`. |
| T-4 | Three pending todos moved to `.planning/todos/resolved/` via `git mv` (88%-style rename similarity preserves git blame across the rename) with `## Resolved` sections appended documenting closure provenance | VERIFIED | `ls .planning/todos/pending/2026-04-28-{electron-updater-prerelease-channel-mismatch,windows-menu-bar-hidden-by-default-alt-reveals,windows-about-panel-shows-1.1.0.0-not-semver}.md 2>/dev/null \| wc -l` returns `0`; `ls .planning/todos/resolved/2026-04-28-{electron-updater-prerelease-channel-mismatch,windows-menu-bar-hidden-by-default-alt-reveals,windows-about-panel-shows-1.1.0.0-not-semver}.md \| wc -l` returns `3`; `git log --diff-filter=R --name-only` shows 3 renames distributed across commits `202c506` (×2 — windows-menu-bar + windows-about-panel) and `566ed8e` (×1 — electron-updater-prerelease-channel-mismatch); each resolved file ends with a `## Resolved` section dated 2026-04-28 referencing the relevant Plan 13 plan number. |
| T-5 | `package.json` + `package-lock.json` bumped 1.1.0 → 1.1.1 (CI tag-version-guard at `.github/workflows/release.yml:43-54` will accept a `v1.1.1` tag push) | VERIFIED | `node -p 'require("./package.json").version'` outputs `1.1.1`; `node -p 'require("./package-lock.json").version'` outputs `1.1.1`; `node -p 'require("./package-lock.json").packages[""].version'` outputs `1.1.1`; mechanism: `npm version 1.1.1 --no-git-tag-version` (PATTERNS.md canonical mechanism); single-concern atomic commit per D-Discretion #4 + 12.1-02 precedent (commits `d532c34`, `0dd573b`, `1eadd68`). Plan 13-03 commit `612ba60`. |
| T-6 | `v1.1.1` tag pushed + CI run produces 6-asset GitHub Release atomically (3 installers + 3 `latest*.yml` feed files; `isDraft: false`; `isPrerelease: false`); Release body includes the D-03 stranded-rc-tester callout | VERIFIED | Tag `v1.1.1` pushed to origin pointing at `612ba60` (chore(13-03) version-bump commit per the 12.1-02 precedent of tagging the version-bump commit, NOT the subsequent docs commit). CI workflow run [25094013906](https://github.com/Dzazaleo/Spine_Texture_Manager/actions/runs/25094013906) concluded with `success` in ~4m07s (started 2026-04-29T06:20:25Z, completed 2026-04-29T06:24:32Z). `gh release view v1.1.1 --json assets -q '.assets \| length'` returns `6` (assets: `Spine.Texture.Manager-1.1.1-arm64.dmg` 125.9 MB, `Spine.Texture.Manager-1.1.1-x64.exe` 109.1 MB, `Spine.Texture.Manager-1.1.1-x86_64.AppImage` 139.2 MB, `latest-mac.yml` 371 B, `latest.yml` 367 B, `latest-linux.yml` 383 B). `gh release view v1.1.1 --json isDraft -q '.isDraft'` returns `false`; `gh release view v1.1.1 --json isPrerelease -q '.isPrerelease'` returns `false`; published at `2026-04-29T06:43:45Z`; URL https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.1. D-10 publish-race fix log-clean (no Personal Access Token / asset_already_exists / HTTP 422 lines). Release body authored with D-03 stranded-rc-tester callout in `## Known issues` + `## Release tag conventions` cross-link to CLAUDE.md. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/main/index.ts` | `autoHideMenuBar: false` at L339 + `app.setAboutPanelOptions(...)` block in `app.whenReady()` body | VERIFIED | Plan 13-01 commit `202c506`; both surgical edits committed atomically with the 2 git mv operations |
| `tests/main/index-options.spec.ts` | Greenfield 2-test source-grep regression spec (mirrors F2 pattern from `tests/renderer/app-shell-output-picker.spec.tsx`) | VERIFIED | Plan 13-01 commit `202c506`; vitest delta +2 (453 → 455) |
| `CLAUDE.md` | New `## Release tag conventions` section (5-10 lines: heading + opener + ✅ example + ❌ example + 1-line rationale + 1 cross-link) | VERIFIED | Plan 13-02 commit `566ed8e`; section count 7 → 8; sits between `## Critical non-obvious facts` (L14) and `## Test fixture` (L34) |
| `.planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md` | Moved from `pending/` via `git mv` (87% similarity) with `## Resolved` section appended documenting CLAUDE.md docs landing + deliberate workflow-guard deferral per D-05 | VERIFIED | Plan 13-02 commit `566ed8e` |
| `.planning/todos/resolved/2026-04-28-windows-menu-bar-hidden-by-default-alt-reveals.md` | Moved from `pending/` via `git mv` (82% similarity) with `## Resolved` section appended documenting `autoHideMenuBar: false` landing + Phase 13.1 live-verification deferral per D-07 | VERIFIED | Plan 13-01 commit `202c506` |
| `.planning/todos/resolved/2026-04-28-windows-about-panel-shows-1.1.0.0-not-semver.md` | Moved from `pending/` via `git mv` (85% similarity) with `## Resolved` section appended documenting `setAboutPanelOptions` landing + Phase 13.1 live-verification deferral per D-07 | VERIFIED | Plan 13-01 commit `202c506` |
| `package.json` | `version: "1.1.1"` (line 3) | VERIFIED | Plan 13-03 commit `612ba60` |
| `package-lock.json` | `version: "1.1.1"` at top-level (line 3) AND at `packages[""].version` (line 9) | VERIFIED | Plan 13-03 commit `612ba60`; npm-canonical lockfile invariant satisfied |
| `12.1-VERIFICATION.md` | 3 Anti-Pattern entries (#1 / #3 / #4) + Gaps Summary polish-todos block APPEND-only annotated with PRESERVE-HISTORY `**RESOLVED in Phase 13...**` markers; frontmatter `status: passed_partial` + `score:` + trailing footer `_Verified: 2026-04-28T21:30:00Z_` UNCHANGED | VERIFIED | This plan's Task 2; PRESERVE-HISTORY discipline preserved (12.1's historical record stays intact; closures recorded as inline annotations) |
| `.planning/STATE.md` | `## Current phase` reflects Phase 13 code/docs closure + v1.1.1 publication-pending; `## Last completed` updated with Plans 13-01..04 entry; frontmatter bumped | VERIFIED | This plan's Task 3 |
| `.planning/ROADMAP.md` | Phase 13 row reflects 4/5 in-progress with Plan 13-05 pending; Progress table row updated; Milestones gains 🚧 v1.1.1 patch in-progress bullet | VERIFIED | This plan's Task 4 |
| `.planning/phases/13-v1-1-1-polish-phase-12-1-carry-forwards/13-VERIFICATION.md` | Greenfield Phase 13 verification report (this file) | VERIFIED | This plan's Task 1 |
| GitHub Release `v1.1.1` (6 assets, `isDraft: false`, `isPrerelease: false`) | Atomic 6-asset publish via the 12.1-D-10 synthesizer pipeline | **PENDING** | Owned by Plan 13-05 |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| CLAUDE.md `## Release tag conventions` cross-link | `.planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md` | markdown relative-path link | VERIFIED — file exists at target path; cross-link valid at commit time because the `git mv` lands in the same atomic commit (`566ed8e`) as the CLAUDE.md insertion |
| 12.1-VERIFICATION.md Anti-Pattern #1 PRESERVE-HISTORY annotation | CLAUDE.md `## Release tag conventions` section + resolved/ todo | grep + heading-anchor reference | VERIFIED — APPEND-only `**RESOLVED in Phase 13 — ...**` marker references both CLAUDE.md section name + resolved/ todo path |
| 12.1-VERIFICATION.md Anti-Pattern #3 PRESERVE-HISTORY annotation | `src/main/index.ts:339` `autoHideMenuBar: false` + Plan 13-01 commit `202c506` | grep + line-anchored reference | VERIFIED — APPEND-only marker cites the exact line + the F2-shape source-grep regression spec at `tests/main/index-options.spec.ts` |
| 12.1-VERIFICATION.md Anti-Pattern #4 PRESERVE-HISTORY annotation | `src/main/index.ts` `setAboutPanelOptions` call + Plan 13-01 commit `202c506` | grep | VERIFIED — APPEND-only marker cites the exact call shape + the regression spec |
| 12.1-VERIFICATION.md `### Gaps Summary` polish-todos block | Phase 13 closure summary sub-paragraph | APPEND-only sub-paragraph below existing 4-bullet list | VERIFIED — `**Phase 13 closure update (2026-04-28):**` paragraph documents 3 closures + 2 deferrals to Phase 13.1 |
| `package.json` `version: "1.1.1"` | CI tag-version-guard at `.github/workflows/release.yml:43-54` | npm-canonical lockfile contract; bash compare `TAG_VERSION="1.1.1"` (stripped-v) vs `PKG_VERSION="$(node -p "require('./package.json').version")"` | VERIFIED at code level (CI run owned by Plan 13-05); guard will accept `v1.1.1` tag push |
| Bundled `app-update.yml` (in installer Resources/) | `Dzazaleo/Spine_Texture_Manager` GitHub Releases feed | electron-updater@6.x runtime read | VERIFIED at architecture level (proven by 12.1's 3 successful CI runs); live-runtime verification of the v1.1.0 → v1.1.1 detect/download/restart sequence deferred to Phase 13.1 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| autoHideMenuBar flipped to false | `grep -c "autoHideMenuBar:\s*false" src/main/index.ts` | `1` | PASS |
| autoHideMenuBar:true gone | `grep -c "autoHideMenuBar:\s*true" src/main/index.ts` | `0` | PASS |
| setAboutPanelOptions present | `grep -q "app.setAboutPanelOptions" src/main/index.ts && echo y` | `y` | PASS |
| applicationVersion uses app.getVersion() | `grep -q "applicationVersion: app.getVersion()" src/main/index.ts && echo y` | `y` | PASS |
| CLAUDE.md has new section | `grep -c "^## Release tag conventions$" CLAUDE.md` | `1` | PASS |
| CLAUDE.md section count | `grep -c "^## " CLAUDE.md` | `8` | PASS |
| CLAUDE.md ✅ example present | `grep -c "v1.2.0-rc.1" CLAUDE.md` | at least `1` | PASS |
| CLAUDE.md ❌ example present | `grep -c "v1.2.0-rc1" CLAUDE.md` | at least `1` | PASS |
| CLAUDE.md cross-link points at resolved/ | `grep -q "todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch" CLAUDE.md && echo y` | `y` | PASS |
| package.json version bumped | `node -p 'require("./package.json").version'` | `1.1.1` | PASS |
| package-lock.json top-level version bumped | `node -p 'require("./package-lock.json").version'` | `1.1.1` | PASS |
| package-lock.json packages."" version bumped | `node -p 'require("./package-lock.json").packages[""].version'` | `1.1.1` | PASS |
| 3 todos moved to resolved/ | `ls .planning/todos/resolved/2026-04-28-{electron-updater-prerelease-channel-mismatch,windows-menu-bar-hidden-by-default-alt-reveals,windows-about-panel-shows-1.1.0.0-not-semver}.md \| wc -l` | `3` | PASS |
| 0 carry-forward todos remain pending | `ls .planning/todos/pending/2026-04-28-{electron-updater-prerelease-channel-mismatch,windows-menu-bar-hidden-by-default-alt-reveals,windows-about-panel-shows-1.1.0.0-not-semver}.md 2>/dev/null \| wc -l` | `0` | PASS |
| Each resolved file has `## Resolved` section | `grep -l "^## Resolved$" .planning/todos/resolved/2026-04-28-{electron-updater-prerelease-channel-mismatch,windows-menu-bar-hidden-by-default-alt-reveals,windows-about-panel-shows-1.1.0.0-not-semver}.md \| wc -l` | `3` | PASS |
| 12.1-VERIFICATION.md PRESERVE-HISTORY annotations present | `grep -c "RESOLVED in Phase 13" .planning/phases/12.1-installer-auto-update-live-verification/12.1-VERIFICATION.md` | `3` | PASS |
| 12.1-VERIFICATION.md Gaps Summary update present | `grep -c "Phase 13 closure update" .planning/phases/12.1-installer-auto-update-live-verification/12.1-VERIFICATION.md` | `1` | PASS |
| 12.1-VERIFICATION.md frontmatter status PRESERVED | `grep -q "^status: passed_partial$" .planning/phases/12.1-installer-auto-update-live-verification/12.1-VERIFICATION.md && echo y` | `y` | PASS |
| 12.1-VERIFICATION.md trailing footer PRESERVED | `grep -q "_Verified: 2026-04-28T21:30:00Z_" .planning/phases/12.1-installer-auto-update-live-verification/12.1-VERIFICATION.md && echo y` | `y` | PASS |
| vitest passes | `npm run test` | `Test Files 41 passed (41)` / `Tests 452 passed \| 1 skipped \| 2 todo (455)` (was 453 pre-13-01; +2 from index-options.spec) | PASS |
| typecheck:web clean | `npm run typecheck:web` | (silent success, exit 0) | PASS |

### Requirements Coverage

| Requirement | Phase | Status |
| ----------- | ----- | ------ |
| (none new) | Phase 13 | Phase 13 closes ZERO new requirement IDs per CONTEXT.md §canonical_refs ("REQUIREMENTS.md — Phase 13 closes none of them — it's a polish round, not a new requirement surface"). 12.1's `passed_partial` carry-forwards are documented as resolved at code/docs level via the in-place 12.1-VERIFICATION.md APPEND-only annotations from this plan's Task 2; live-UAT closure (which would otherwise satisfy 12.1's deferred SC-2 / SC-3 / SC-4 in spirit) is deferred to Phase 13.1. The v1.1.1 publication itself (T-6 above) does not close a new requirement either — it is a maintenance release that ships the carry-forward fixes; the requirement surface for "ship v1.1 distribution" was closed by Phase 12.1's REL-03 + UPD-06 + the 9 human-verified items folded back into 12-VERIFICATION.md. |

### Anti-Patterns Found

Empty for Phase 13. The 4 anti-patterns surfaced by Phase 12.1 (rc-channel naming, INSTALL.md macOS Sequoia Gatekeeper UX divergence, autoHideMenuBar, About-panel SemVer) are being CLOSED here — not new ones discovered. Phase 13's scope is intentionally tight (3 surgical commits + 1 verification commit + 1 release-engineering tag-push) precisely to avoid introducing new surface area. The Sequoia-UX anti-pattern (Anti-Pattern #2 in 12.1-VERIFICATION.md) was closed by Plan 12.1-06 itself within Phase 12.1 and is therefore not a Phase 13 carry-forward; Phase 13 closes the other 3 (Anti-Pattern #1 / #3 / #4).

### Human Verification Required

Empty. Phase 13 is documentation + 1 surgical code edit (2 sites in `src/main/index.ts`, 1 atomic commit) + 1 docs insertion (CLAUDE.md, 1 atomic commit) + 1 version bump (`package.json` + `package-lock.json`, 1 atomic commit) + 1 verification + state surface authoring (this commit) + 1 tag-push closure step (Plan 13-05). No human-verified items beyond the Phase 13.1 deferrals (which are tracked there, not here). Per CONTEXT D-07: live verification of the cosmetic Windows fixes on a packaged v1.1.1 install is the responsibility of Phase 13.1, alongside the Linux runbook execution + libfuse2 PNG capture and the macOS / Windows v1.1.0 → v1.1.1 auto-update lifecycle UAT.

Plan 13-05's tag push + Release publish gates (BLOCKING checkpoints before tag push and before Release publish) are user-confirmation gates, not human-verification items in the verification-doc sense — they are operational safeguards on irreversible actions and will be recorded as transcripts in the Plan 13-05 SUMMARY rather than as PRESERVE-HISTORY entries here.

### Gaps Summary

**Carry-forwards to Phase 13.1 (when inserted via `/gsd-insert-phase 13.1` after Plan 13-05 closes):**

1. **Linux runbook execution + libfuse2 PNG capture** — full UAT of v1.1.1 install + auto-update lifecycle on a real Ubuntu 24.04 desktop host. Replace the 67-byte placeholder at `docs/install-images/linux-libfuse2-error.png` with a real ≥ 5KB capture; flip the `test.todo` in `tests/integration/install-md.spec.ts` to a real assertion. Same blocker as 12.1 (no Linux host this round; lima/multipass on Apple Silicon Sequoia hit known QEMU + libc:amd64 multiarch issues during 12.1).

2. **macOS / Windows v1.1.0 → v1.1.1 auto-update lifecycle UAT** — the canonical user path; verifies UPD-01..04 live for the first time on a real published feed. The rc-channel bug does NOT affect this path because final → final uses the `currentChannel === null` code branch in electron-updater 6.x's GitHubProvider (verified by reading the source during 12.1; cited at `node_modules/electron-updater/out/providers/GitHubProvider.js:51-83`).

3. **Windows windows-fallback variant live observation** — UpdateDialog `windows-fallback` variant mounting + "Open Release Page" button click on a Windows v1.1.1 install when a future v1.1.2 ships. Naturally arises only if v1.1.2 chooses to remain Windows-unsigned; SPIKE_PASSED constant in `src/main/auto-update.ts:92` controls the fallback path.

4. **Live verification of the cosmetic Windows fixes from Plan 13-01** — packaged v1.1.1 Windows install should show menu bar visible by default (no Alt-press needed) and About panel reading SemVer `1.1.1` (not win32 FileVersion `1.1.1.0`). Code-level closure is asserted by `tests/main/index-options.spec.ts` source-grep regression but the UX-level confirmation requires a real Windows host with a packaged installer.

**Closed in Phase 13 (Plan 13-05 — 2026-04-29):**

- **v1.1.1 publication: LIVE.** Plan 13-05 executed the full release sequence: `v1.1.1` annotated tag created locally pointing at `612ba60` (Plan 13-03's chore version-bump commit per the 12.1-02 precedent of tagging the version-bump commit, NOT the subsequent docs commit) → tag pushed to origin → CI workflow [25094013906](https://github.com/Dzazaleo/Spine_Texture_Manager/actions/runs/25094013906) triggered → tag-version-guard at `.github/workflows/release.yml:43-54` accepted (`TAG_VERSION="1.1.1"` matched `PKG_VERSION="$(node -p "require('./package.json').version")"="1.1.1"` per Plan 13-03's bump) → CI matrix built 3 OSes in parallel (ubuntu-latest / windows-2022 / macos-14) → `scripts/emit-latest-yml.mjs` (12.1-D-10 synthesizer) emitted the 3 `latest*.yml` feed files → `softprops/action-gh-release@v2.6.2` published the 6-asset draft Release atomically → Release body authored with the D-03 stranded-rc-tester callout in `## Known issues` and a cross-link to CLAUDE.md `## Release tag conventions` → user verified body + asset list + isPrerelease state via the BLOCKING checkpoint → `gh release edit v1.1.1 --draft=false` flipped published at 2026-04-29T06:43:45Z. CI run conclusion `success` in ~4m07s; D-10 publish-race fix log-clean (4th successful CI run with the fix architecture, after rc2 / rc3 / v1.1.0). Public release URL: https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.1.

---

_Verified: 2026-04-29T06:45:00Z_
_Verifier: Claude (gsd-executor) — Phase 13 Plan 05 closure_

---
phase: 12-auto-update-tester-install-docs
plan: 06
subsystem: docs
tags: [install-docs, gatekeeper, smartscreen, libfuse2, electron-updater, help-menu, allow-list]

# Dependency graph
requires:
  - phase: 12-auto-update-tester-install-docs
    provides: 12-01 wired Help → Check for Updates menu item + SHELL_OPEN_EXTERNAL_ALLOWED Set + UpdateDialog scaffold (Plan 12-06 mirrors all three patterns for the Installation Guide… surface)
  - phase: 11-ci-release-pipeline-github-actions-draft-release
    provides: D-11/D-12/D-13 left ${INSTALL_DOC_LINK} envsubst placeholder pointing at README.md as a Phase 12 hand-off; release-template inline install bullets at lines 14-23 (Plan 12-06 D-17 prunes them)
provides:
  - INSTALL.md cookbook at repo root with per-OS install + first-launch bypass walkthroughs (139 lines, 3 OS sections, libfuse2 caveat per D-15, Help → Check for Updates section)
  - 4 placeholder PNGs at docs/install-images/ (1×1 transparent RGBA, 67 bytes each; valid PNG per `file`); real captures deferred to phase 12.1
  - 4 INSTALL.md linking surfaces wired (D-16 + D-17 + D-18) — release-template prune to single link, README.md Installing section, in-app Help → Installation Guide… menu item, HelpDialog inline link section
  - SHELL_OPEN_EXTERNAL_ALLOWED Set extended with INSTALL.md URL (5th entry, exact-string allow-list per D-18 option b)
  - new onMenuInstallationGuide preload bridge mirrors onMenuCheckForUpdates byte-for-byte (Pitfall 9 listener-identity preservation)
  - tests/integration/install-md.spec.ts greenfield integration smoke test (18 test() blocks; URL-consistency assertion across all 4 surfaces is the regression gate for T-12-06-01 / T-12-06-04)
affects: [phase-12.1, tester-rounds, future-doc-edits, future-allow-list-extensions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern: 4-surface URL-consistency gate via integration test — any URL referenced from main/ipc allow-list + renderer + workflow + dialog MUST match exactly; one literal in 4+ files, one test asserts identity, drift fails CI."
    - "Pattern: text-first doc with binary-swap-ready image references — markdown image + italic fallback line side-by-side; replacing 1×1 placeholder with real screenshot needs no doc edit."
    - "Pattern: greenfield tests/integration/ for end-to-end documentation contracts — file-system + magic-bytes + content greps assert the cookbook AND its 4 link surfaces in one spec."

key-files:
  created:
    - INSTALL.md
    - README.md
    - docs/install-images/macos-gatekeeper-open-anyway.png
    - docs/install-images/windows-smartscreen-more-info.png
    - docs/install-images/windows-smartscreen-run-anyway.png
    - docs/install-images/linux-libfuse2-error.png
    - tests/integration/install-md.spec.ts
  modified:
    - .github/workflows/release.yml
    - .github/release-template.md
    - src/main/ipc.ts
    - src/main/index.ts
    - src/preload/index.ts
    - src/shared/types.ts
    - src/renderer/src/components/AppShell.tsx
    - src/renderer/src/modals/HelpDialog.tsx
    - tests/renderer/help-dialog.spec.tsx
    - tests/renderer/rig-info-tooltip.spec.tsx
    - tests/renderer/save-load.spec.tsx

key-decisions:
  - "Task 1 BLOCKING screenshot checkpoint resolved via 'partial: none' resume signal — user decided, with full context, to skip captures and ship INSTALL.md text-first today. 4 placeholder 1×1 PNGs satisfy the integration test's existence assertion; INSTALL.md italic fallback line documents the deferral inline. Real captures land during phase 12.1 with first real tester install on rc2 (when the publish-race fix lands and a complete 3-OS artifact set publishes)."
  - "INSTALL.md keeps the markdown image references (![alt](docs/install-images/<name>.png)) alongside the italic fallback line so future replacement is binary-only — no doc edits needed when real captures swap in."
  - "D-17 release-template prune collapses 3 inline OS bullets + the redundant 'For full install instructions' line down to one ## Install instructions section + one [INSTALL.md](\\${INSTALL_DOC_LINK}) link line. Smaller release body, one source of truth, no drift between two surfaces."
  - "D-18 option (b) extended to the INSTALL.md URL — exact-string allow-list (Set.has by value), no regex/prefix support added. Same pattern as the Releases-index URL added by 12-01."
  - "HelpDialog new section placed between Section 1 (intro) and Section 2 (How to load a rig) per plan recommendation — testers see 'Install instructions' immediately on opening Help. Wording-stability constraint preserved: em-dash + 'editor metadata' + 'does not affect sampling' substrings in Section 7 unchanged."
  - "Rule 1 deviation contained to test files: HelpDialog spec section count expectation 7→8 to match the new D-16.4 section; rig-info-tooltip + save-load specs add onMenuInstallationGuide stub to their window.api mocks (else AppShell useEffect throws 'is not a function' on commit). All 415 prior tests + 18 new integration tests = 433 total passing."

patterns-established:
  - "Pattern: 4-surface URL-consistency integration test — single literal URL referenced from src/main/ipc.ts allow-list + src/renderer/src/modals/HelpDialog.tsx constant + src/renderer/src/components/AppShell.tsx openExternalUrl arg + .github/workflows/release.yml env var; tests/integration/install-md.spec.ts asserts byte-for-byte identity. Future external-link surfaces should clone this 4-test stanza."
  - "Pattern: text-first doc with screenshot-pending fallback — INSTALL.md per-OS sections include both ![alt](docs/install-images/<name>.png) markdown image AND italic '_(Screenshot pending — capture during phase 12.1 ...)_' line. Defense-in-depth: if GitHub renderer ever fails to load an image, the italic line tells the tester what they should be seeing."
  - "Pattern: tests/integration/ directory for end-to-end documentation + 4-surface contracts — first usage in this project; runs under default `node` environment without jsdom or vitest mocks; pure file-system + string-match assertions; matches the 12-02 CI matrix [ubuntu-latest, windows-2022, macos-14] on every push."

requirements-completed: [REL-03]

# Metrics
duration: 9min
completed: 2026-04-27
---

# Phase 12 Plan 06: INSTALL.md cookbook + 4-surface linking summary

**Greenfield REL-03 deliverable: 139-line cookbook INSTALL.md at repo root with per-OS Gatekeeper / SmartScreen / libfuse2 walkthroughs, plus all 4 documented in-app + CI linking surfaces (release-template prune, README, Help menu, HelpDialog) wired with a regression-gating URL-consistency integration test.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-27T22:12:15Z
- **Completed:** 2026-04-27T22:21:11Z
- **Tasks:** 5 (Task 1 closed via `partial: none` resume signal; Tasks 2-5 executed)
- **Files modified/created:** 17 (4 PNGs + INSTALL.md + README.md + 2 .github files + 5 src files + 1 test file + 3 test stub updates + deferred-items.md)

## Accomplishments

- **INSTALL.md** at repo root — 139-line cookbook, 3 per-OS sections with numbered steps + bypass walkthrough + Troubleshooting subsection. Linux libfuse2 / libfuse2t64 caveat documented inline per D-15. Auto-update + Reporting issues sections at the tail.
- **4 placeholder PNGs** at `docs/install-images/` (1×1 transparent RGBA, 67 bytes each, valid PNG); real captures deferred to phase 12.1 (see deferred-items.md).
- **4 INSTALL.md linking surfaces wired** per D-16 + D-17 + D-18:
  - `.github/release-template.md` D-17 prune: 3 inline OS bullets + redundant "For full install instructions" line collapse to single `See [INSTALL.md](${INSTALL_DOC_LINK})` line. ## Install instructions heading preserved per REL-02.
  - `.github/workflows/release.yml` INSTALL_DOC_LINK env var flipped from blob/main/README.md (Phase 11 placeholder) to blob/main/INSTALL.md.
  - `README.md` (greenfield): top-level project intro + ## Installing section with relative `[INSTALL.md](INSTALL.md)` link.
  - In-app: new "Installation Guide…" Help submenu item + onMenuInstallationGuide preload bridge + AppShell useEffect subscriber + HelpDialog new "Install instructions" section between Section 1 and Section 2.
- **SHELL_OPEN_EXTERNAL_ALLOWED** Set extended with INSTALL.md URL as 5th allow-list entry (D-18 option b — exact-string match, no regex).
- **Greenfield tests/integration/install-md.spec.ts** — 18 test() blocks asserting INSTALL.md content (existence, OS sections, libfuse2 caveat, bypass copy, no .planning/ leak), 4 PNG slots existence + magic-bytes check, all 4 linking surfaces wired correctly, and **URL consistency** across all 4 surfaces (the regression gate for T-12-06-01 / T-12-06-04).
- **REL-03 closed** in REQUIREMENTS.md — Phase 12 now 6/6 plans complete.

## Task Commits

1. **Task 1 (BLOCKING checkpoint resolution):** `0c77242` chore — add 1×1 PNG placeholders for INSTALL.md screenshot slots (resume signal `partial: none`; user-decided to skip captures and defer to phase 12.1 with full rationale)
2. **Task 2:** `9112671` docs — author INSTALL.md cookbook with per-OS install + bypass walkthroughs
3. **Task 3:** `3048af0` ci — point INSTALL_DOC_LINK at INSTALL.md and prune release-template install bullets (D-16/D-17)
4. **Task 4:** `a6c4c1e` feat — wire 4 INSTALL.md linking surfaces (D-16 + D-18)
5. **Task 5:** `f6f509f` test — integration smoke test for INSTALL.md cookbook + 4 linking surfaces

**Plan metadata:** (final docs commit covers SUMMARY + STATE/ROADMAP/REQUIREMENTS + deferred-items.md)

## Files Created/Modified

**Created (7):**
- `INSTALL.md` — REL-03 cookbook (139 lines, 3 OS sections + libfuse2 paragraph + Help → Check for Updates + Reporting issues)
- `README.md` — top-level project intro + ## Installing section pointing at INSTALL.md (D-16.2)
- `docs/install-images/macos-gatekeeper-open-anyway.png` — 1×1 placeholder (67 bytes; phase 12.1 replaces with real capture)
- `docs/install-images/windows-smartscreen-more-info.png` — 1×1 placeholder
- `docs/install-images/windows-smartscreen-run-anyway.png` — 1×1 placeholder
- `docs/install-images/linux-libfuse2-error.png` — 1×1 placeholder
- `tests/integration/install-md.spec.ts` — 18 test() blocks asserting INSTALL.md content + 4-surface wiring + URL consistency

**Modified (10):**
- `.github/workflows/release.yml` — INSTALL_DOC_LINK env var (one-line URL suffix change)
- `.github/release-template.md` — D-17 prune (8 lines → 2 lines; ## Install instructions heading preserved)
- `src/main/ipc.ts` — SHELL_OPEN_EXTERNAL_ALLOWED Set extended (5th entry: INSTALL.md URL)
- `src/main/index.ts` — Help submenu 3rd item: "Installation Guide…" with menu:installation-guide-clicked channel
- `src/preload/index.ts` — new onMenuInstallationGuide bridge (mirrors onMenuCheckForUpdates byte-for-byte)
- `src/shared/types.ts` — Api interface extended with onMenuInstallationGuide method type
- `src/renderer/src/components/AppShell.tsx` — useEffect subscriber calls openExternalUrl with INSTALL.md URL literal
- `src/renderer/src/modals/HelpDialog.tsx` — INSTALL_DOC_URL module constant + new "Install instructions" section between Section 1 and Section 2 (uses existing openLink curried-button shape)
- `tests/renderer/help-dialog.spec.tsx` — section count expectation 7→8 (matches new D-16.4 section); wording-stability assertions unchanged
- `tests/renderer/rig-info-tooltip.spec.tsx` + `tests/renderer/save-load.spec.tsx` — window.api mocks add onMenuInstallationGuide stub (Rule 1 deviation, contained to test files)

## Decisions Made

- **Task 1 closed via `partial: none` resume signal** — user explicitly decided to skip captures and ship INSTALL.md text-first because (a) dev machine can't reproduce a fresh tester's first-launch Gatekeeper experience (macOS trusts locally-built apps even with quarantine flag), (b) Windows/Linux installers don't yet exist (CI publish-race deferred to phase 12.1). Real captures land during phase 12.1's tester rounds when rc2 ships with full 3-OS artifacts. See `deferred-items.md` "INSTALL.md screenshots deferred to phase 12.1" entry for the full rationale.
- **INSTALL.md keeps markdown image references alongside italic fallback lines** so phase 12.1's binary-swap is doc-edit-free. Each per-OS section's screenshot slot has both `![alt](docs/install-images/<name>.png)` and `_(Screenshot pending — capture during phase 12.1 with first real tester install on rc2.)_` on the next line.
- **D-17 release-template prune collapses 8 lines to 2** — single `See [INSTALL.md](${INSTALL_DOC_LINK})` line replaces 3 inline OS-bullet block + redundant "For full install instructions" line. `## Install instructions` heading preserved per REL-02 contract.
- **D-18 option (b) extended to INSTALL.md URL** — exact-string allow-list (Set.has by value), no regex/prefix support added. Matches the Releases-index URL pattern from 12-01.
- **HelpDialog new section placed between Section 1 and Section 2** (recommended placement) — testers see "Install instructions" immediately on opening Help. Wording-stability constraint preserved: em-dash + "editor metadata" + "does not affect sampling" substrings in Section 7 unchanged.
- **HelpDialog spec section count expectation updated 7→8** to match the new D-16.4 section. Test file edit; not a wording-stability regression because the load-bearing substring assertions (lines 64-65) are unchanged.

## Cross-link to Phase 11 hand-off

- **`${INSTALL_DOC_LINK}` placeholder filled** — Phase 11 D-13 wrote the env var pointing at README.md as a placeholder ("Phase 12 flips this when INSTALL.md exists"). Phase 12 Plan 06 flipped it to blob/main/INSTALL.md.
- **Release-template inline install bullets pruned** — Phase 11 D-13 wrote 3 inline OS-specific install bullets in `.github/release-template.md` because INSTALL.md didn't exist yet. D-17 collapses them to a single link to INSTALL.md (pruned in Task 3 of this plan).
- The Phase 11 → Phase 12 documentation seam is now closed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] HelpDialog section-count test failed after D-16.4 section addition**
- **Found during:** Task 4 verification (`npm run test`)
- **Issue:** `tests/renderer/help-dialog.spec.tsx` asserts `sections.length === 7` (the canonical 7-section list). Adding the new "Install instructions" section between Section 1 and Section 2 makes 8 sections; test failed with `expected 8 to be 7`.
- **Fix:** Updated section count expectation 7→8 in test + comment block; explicitly noted the unnumbered D-16.4 section in the comment so future readers understand why the count is 8 not 7. Wording-stability assertions (lines 64-65 — "editor metadata" + "does not affect sampling" in Section 7) untouched.
- **Files modified:** tests/renderer/help-dialog.spec.tsx
- **Verification:** `npm run test -- --run tests/renderer/help-dialog.spec.tsx` → 3/3 passing.
- **Committed in:** a6c4c1e (Task 4 commit)

**2. [Rule 1 - Bug] AppShell useEffect crashes 11 tests in 2 spec files when window.api stubs lack onMenuInstallationGuide**
- **Found during:** Task 4 verification (full `npm run test`)
- **Issue:** `tests/renderer/rig-info-tooltip.spec.tsx` + `tests/renderer/save-load.spec.tsx` stub `window.api` for AppShell-mounting tests. Phase 12-01 added 5 `update*` stubs; my Task 4 edit added a new `onMenuInstallationGuide` subscriber to the AppShell useEffect — without the stub, React threw `'is not a function'` on the useEffect commit, cascading 11 unrelated test failures.
- **Fix:** Appended `onMenuInstallationGuide: vi.fn(() => () => undefined)` to both files' window.api mocks (single-line addition each), mirroring the existing `onMenuCheckForUpdates` stub.
- **Files modified:** tests/renderer/rig-info-tooltip.spec.tsx, tests/renderer/save-load.spec.tsx
- **Verification:** `npm run test` → 433/433 passing (was 415; +18 new integration).
- **Committed in:** a6c4c1e (Task 4 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs, both contained to test files — no production-code bugs introduced)
**Impact on plan:** Both auto-fixes are direct consequences of the planned production-code edits (HelpDialog new section + AppShell new subscriber); fixing the test mocks to match the new code surface is correctness, not scope creep.

## Issues Encountered

- **Pre-existing typecheck failure in `scripts/probe-per-anim.ts`** carried forward unchanged via `deferred-items.md` per SCOPE BOUNDARY (identical entry from Phase 11 deferred-items; survives `git stash` revert; out of Phase 12 scope). Web typecheck (`npm run typecheck:web`) clean. The vitest suite (433/433) is the correctness gate the workflow's `test` job actually enforces.

## Authentication gates

None — this plan is documentation + UI wiring; no auth surfaces.

## Self-Check: PASSED

All claimed artifacts verified to exist:
- INSTALL.md (139 lines) ✓
- README.md ✓
- docs/install-images/{macos-gatekeeper-open-anyway, windows-smartscreen-more-info, windows-smartscreen-run-anyway, linux-libfuse2-error}.png ✓
- tests/integration/install-md.spec.ts ✓
- All 5 task commits in `git log --oneline` (0c77242, 9112671, 3048af0, a6c4c1e, f6f509f) ✓
- `npm run test` 433/433 passing ✓
- `npm run typecheck:web` clean ✓
- `npm run test -- --run tests/integration/install-md.spec.ts` 18/18 passing ✓
- `npm run test -- --run tests/renderer/help-dialog.spec.tsx` 3/3 passing (wording stability) ✓

## Manual-tester verification surfaces remaining

- **Actual non-developer install on a fresh OS following INSTALL.md** — this is the v1.1 tester rounds' job (phase 12.1 spike host or beyond), not in Phase 12 scope. INSTALL.md exists today and is what testers will read.
- **Open INSTALL.md in a markdown previewer** (VS Code preview, github.com PR preview) — confirm screenshots resolve to placeholder PNGs (gray 1×1 squares) and italic fallback lines render. Recommended pre-merge sanity check.
- **Run `npm run dev`; open Help menu; verify "Installation Guide…" appears as the 3rd item; click it; verify the GitHub INSTALL.md page opens in the default browser.** End-to-end manual smoke for the new menu item.
- **Open the in-app HelpDialog (Help → Documentation); verify the "Install instructions" section appears with a clickable link; click; verify same INSTALL.md page opens.** End-to-end manual smoke for the new HelpDialog section.
- **Post-merge CI**: next `workflow_dispatch` (or next tag push, when 12.1 lands the publish-race fix) runs the publish job which envsubst's `${INSTALL_DOC_LINK}` into the release body — manually verify the rendered draft release shows the INSTALL.md link, not the inline-bullets format.

## Phase 12 close

This plan completes Phase 12 (auto-update + tester install docs):

- **All UPD-* requirements** (UPD-01..UPD-06) wired and verified to the extent automatable. UPD-06's spike runbook (live Windows-unsigned 3-step verification) deferred to phase 12.1 due to electron-builder 26.x publish race; manual-fallback variant ships LIVE on Windows by default per D-04.
- **REL-03** (INSTALL.md cookbook) — closed today by this plan.
- **F1 / F2 / F3 Phase 11 spillover bugs** all fixed by Plans 12-03 / 12-04 / 12-05.
- **CI test matrix expansion** to 3 OSes (ubuntu-latest, windows-2022, macos-14) and `latest*.yml` feed-file publication landed in Plan 12-02.
- **6/6 plans complete.** v1.1 milestone now 11/11 plans complete (Phases 10-12; Phase 13 not yet started).

## Next Phase Readiness

- **Phase 12.1 (proposed):** picks an architecture for the electron-builder 26.x publish-race fix, validates locally, runs a fresh tag-push CI to publish v1.1.0-rc2 with full 3-OS artifacts, then executes Plan 12-01's Spike Runbook for live UPD-06 verification on a Windows test host. Side task: capture all 4 INSTALL.md screenshots during the tester round and replace the placeholder PNGs in `docs/install-images/` (no INSTALL.md edits required — the binary swap is the only work).
- **Phase 13 (crash + error reporting):** TEL-01..07 group. Locked at v1.1; vendor-neutral pick at plan-phase 13. Not blocked by anything in Phase 12.

**DO NOT push tags until phase 12.1 lands the publish-race fix** — the workflow will fail and pollute releases. See `deferred-items.md` "CI tag-push will fail" entry.

---

*Phase: 12-auto-update-tester-install-docs*
*Completed: 2026-04-27*

# Phase 13: v1.1.1 polish — Phase 12.1 carry-forwards (code/docs + ship)

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Land the **code- and docs-side** changes that close out Phase 12.1's carry-forward backlog, then tag and publish **v1.1.1 final** as a maintenance release. Live-verification work (Linux UAT runbook, libfuse2 PNG capture, macOS / Windows v1.1.0 → v1.1.1 auto-update lifecycle observation) is split into a follow-up **Phase 13.1** so v1.1.1 can ship without being host-blocked on Linux.

**In scope (Phase 13):**
- `src/main/index.ts:339` — `autoHideMenuBar: true` → `false` (Windows menu-bar discoverability for non-developer testers).
- `src/main/index.ts` — add `app.setAboutPanelOptions({ applicationName, applicationVersion: app.getVersion() })` so the Windows About panel shows SemVer (`1.1.1`) instead of win32 file metadata (`1.1.1.0`).
- `CLAUDE.md` — new "Release tag conventions" section documenting `v1.2.0-rc.1` ✅ vs `v1.2.0-rc1` ❌ with one-line rationale (semver prerelease-token semantics; electron-updater channel-name comparison).
- Move 3 carry-forward todos from `.planning/todos/pending/` → `.planning/todos/resolved/` via `git mv` once each fix lands (88%-rename-similarity pattern from 12.1-07).
- `package.json` version bump `1.1.0` → `1.1.1`.
- Tag `v1.1.1` (final, no rc cycle) → CI release pipeline produces 6-asset draft GitHub Release → publish.
- 13-VERIFICATION.md authored per 12.1-D-08 PRESERVE-HISTORY pattern; 12.1-VERIFICATION.md partial/deferred entries flipped where this phase closes them.

**Out of scope (deferred to Phase 13.1):**
- Linux runbook execution + libfuse2 PNG capture (SC-3, SC-6 4/4).
- Live macOS / Windows v1.1.0 → v1.1.1 auto-update lifecycle UAT.
- Live windows-fallback variant observation (UpdateDialog `windows-fallback`).

**Out of scope entirely (deferred to v1.2 or beyond):**
- Crash + error reporting (TEL-01..07, descoped 2026-04-28).
- UI improvements informed by tester feedback.
- `release.yml` regex guard rejecting non-dot rc tags (deliberately dropped during discuss; CLAUDE.md docs are sufficient for a single-developer project — workflow guard would be a v1.2+ hardening).
- In-app stuck-rc detector for v1.1.0-rcN installs.

</domain>

<decisions>
## Implementation Decisions

### Phase shape

- **D-01:** **Two-phase split.** Phase 13 = code/docs + ship v1.1.1 final. Phase 13.1 = live UAT (Linux runbook + auto-update lifecycle). Split shape mirrors the proven 12 → 12.1 cadence on this project. Lets v1.1.1 ship without being host-blocked on Linux. Phase 13.1 will be inserted via `/gsd-insert-phase 13.1` once Phase 13 closes (canonical pattern from Phase 8.1 / 8.2 / 12.1 insertion).

### v1.1.1 release cycle

- **D-02:** **Straight to v1.1.1 final — no rc cycle.** Single tag-push (`v1.1.1`) → single CI run → single 6-asset GitHub Release → publish. Skips rc → rc verification of the channel-name fix because the canonical user path is `v1.1.0 (final, currentChannel=null) → v1.1.1 (final, currentChannel=null)`, which the electron-updater 6.x code path handles correctly (verified by reading `node_modules/electron-updater/out/providers/GitHubProvider.js:51-83` during 12.1). Same-channel rc.1 → rc.2 verification deferred to whatever next prerelease cycle naturally arises (e.g. v1.2.0-rc.1 if v1.2 chooses an rc cycle).
- **D-03:** Release notes for v1.1.1 explicitly mention the rc-channel migration constraint so existing v1.1.0-rc1/2/3 testers see the manual-download requirement (one-line callout: "If you installed a pre-release `v1.1.0-rcN` build, please download v1.1.1 manually from the Releases page below — the auto-updater couldn't reach you due to a fixed-in-this-version naming bug. After upgrading to v1.1.1, all future auto-updates will work.").

### Stranded rc-tester migration UX

- **D-04:** **Out-of-band comms only — no new in-app code path.** Tester pool is single-digit per PROJECT.md "Current State" wording; v1.1 is a tester distribution, not a public release. Migration plan is (a) the v1.1.1 release notes callout above, (b) a Discord / direct-message post pointing at the Releases page, (c) testers who don't see comms will eventually click Help → Check for Updates and get "you're up to date" (false-positive on rcN installs due to the channel bug) — at which point they file a bug and we walk them through the manual download. Cheapest path; preserves v1.1.0-final as the migration cliff (any tester who's already on v1.1.0 final auto-updates cleanly to v1.1.1). The in-app stuck-rc detector option was rejected because it adds a new untestable code path (the bug it would mitigate is the same bug that makes the detector itself untestable on stranded installs).

### rc-channel naming convention (carry-forward #2)

- **D-05:** **CLAUDE.md docs only — no workflow-level guard.** Add a "Release tag conventions" section to CLAUDE.md with `v1.2.0-rc.1` ✅ vs `v1.2.0-rc1` ❌ examples + one-line rationale + cross-link to `.planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md` for full root cause. Workflow regex guard in `.github/workflows/release.yml:43-54` deferred to v1.2+ as overkill for a single-developer project. The convention activates the next time a prerelease tag is pushed; existing rc-shaped tags (`v1.1.0-rc1` / `-rc2` / `-rc3`) stay as-is in the release history (no rewrite, no force-push).

### Cosmetic Windows fixes (carry-forwards #3 + #4)

- **D-06:** **Both fixes land in a single atomic edit to `src/main/index.ts`.** No platform-conditional branch (`process.platform === 'win32' ? false : true`) for `autoHideMenuBar` because the option is a no-op on macOS by design; an unconditional `false` is cleaner. `app.setAboutPanelOptions` is also unconditional — it's a no-op on Windows for fields macOS doesn't support and vice versa, so a single call configures both platforms. Linux (X11/Wayland desktops) inherits the same defaults.
- **D-07:** **Manual rc-install verification deferred to Phase 13.1**, not gated on Phase 13. Phase 13 ships the code change; Phase 13.1 confirms the menu bar is visible by default on a Windows host and the About panel reads `1.1.1` (not `1.1.1.0`). No automated test surface for `BrowserWindow` constructor options — vitest doesn't currently mock the Electron main process at that level, and adding such infrastructure for two cosmetic flips would be over-engineering. Source-grep regression test (style: 12.1-VALIDATION 12-04 F2 `pickOutputDir` test) is a Claude's-discretion judgment call at plan time.

### Verification doc structure (12.1-D-08 carries forward)

- **D-08:** **PRESERVE-HISTORY pattern again.** 13-VERIFICATION.md owns Phase 13's own success criteria (4 code/doc edits landed, v1.1.1 published, ROADMAP / STATE updated). 12.1-VERIFICATION.md "Gaps Summary" entries that this phase closes get flipped in-place: rc-channel-naming todo → resolved (CLAUDE.md docs satisfy it); cosmetic Windows menu-bar todo → resolved (code shipped, live verification carries to Phase 13.1); cosmetic About-panel todo → resolved (same). Linux PNG + auto-update lifecycle entries stay deferred until Phase 13.1.

### Claude's Discretion

- Exact placement of the new CLAUDE.md "Release tag conventions" section (e.g., before or after the existing "Critical non-obvious facts" block). Plan-phase pick.
- Whether to add a single source-grep regression test for the `autoHideMenuBar: false` and `app.setAboutPanelOptions(...)` call sites (similar in shape to the F2 source-grep test at `tests/renderer/app-shell-output-picker.spec.tsx`). Plan-phase pick.
- Exact wording of the v1.1.1 release-notes "stranded rc tester" callout (D-03). Plan-phase pick.
- Whether the version bump + tag are one task or two within Phase 13's plan (proven pattern from 12.1: 1 commit per concern; rc-bump and final-bump were separate commits in 12.1-02).

### Folded Todos

Three pending todos from `.planning/todos/pending/` map 1:1 to carry-forwards #2, #3, #4 and will be moved to `resolved/` via `git mv` (88%-rename-similarity pattern from 12.1-07) in the same commit as each fix lands:

1. `.planning/todos/pending/2026-04-28-electron-updater-prerelease-channel-mismatch.md` → resolved/ when CLAUDE.md docs land (D-05).
2. `.planning/todos/pending/2026-04-28-windows-menu-bar-hidden-by-default-alt-reveals.md` → resolved/ when `autoHideMenuBar: false` lands (D-06).
3. `.planning/todos/pending/2026-04-28-windows-about-panel-shows-1.1.0.0-not-semver.md` → resolved/ when `app.setAboutPanelOptions` lands (D-06).

The remaining `.planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md` is **not** a 12.1 carry-forward and stays pending (out of v1.1 scope per its own metadata).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 12.1 close-out surface (the source of the carry-forwards)

- `.planning/phases/12.1-installer-auto-update-live-verification/12.1-VERIFICATION.md` §"Gaps Summary" + §"Open Issues / Anti-patterns" + §"Required Artifacts" — load-bearing definition of the 4 carry-forwards (Linux PNG, rc-channel mismatch, Windows menu bar, Windows About panel) and their remediation paths.
- `.planning/phases/12.1-installer-auto-update-live-verification/12.1-CONTEXT.md` §"Live-verification scope (Linux is the unknown)" (D-04) + §"Verification doc structure" (D-08) — prior decisions that carry forward to Phase 13 / 13.1 unchanged.

### Carry-forward todo files (each describes its own root cause + fix)

- `.planning/todos/pending/2026-04-28-electron-updater-prerelease-channel-mismatch.md` — full root-cause walkthrough of `electron-updater@6.8.3` GitHub provider channel-matching logic (`node_modules/electron-updater/out/providers/GitHubProvider.js:51-83`); recommended fix (use `rc.N` not `rcN`); verification path post-fix.
- `.planning/todos/pending/2026-04-28-windows-menu-bar-hidden-by-default-alt-reveals.md` — `src/main/index.ts:339` `autoHideMenuBar: true` → `false` one-line fix; UX impact analysis; cross-references to 12.1-D-04 / D-16.
- `.planning/todos/pending/2026-04-28-windows-about-panel-shows-1.1.0.0-not-semver.md` — `app.setAboutPanelOptions({ applicationName, applicationVersion: app.getVersion() })` block fix; root cause (win32 FileVersion 4-component padding); macOS unaffected.

### Code edit sites

- `src/main/index.ts:339` — `BrowserWindow` constructor options block; `autoHideMenuBar` flip happens here.
- `src/main/index.ts` (boot path, near `app.whenReady()`) — `app.setAboutPanelOptions(...)` call goes here. Plan-phase picks the exact line.
- `src/main/auto-update.ts` — referenced by D-04 stranded-rc rationale (no code edit; the file documents why the in-app detector option was rejected).
- `package.json` — `version` field bump `1.1.0` → `1.1.1`.

### v1.1 milestone surface (unchanged context)

- `.planning/PROJECT.md` "Current Milestone: v1.1 Distribution" + "Key Decisions" — v1.1 scope, locked tech stack, signing posture (no paid certs).
- `.planning/REQUIREMENTS.md` — v1.1 requirements (all 30 closed by Phase 12.1; Phase 13 closes none of them — it's a polish round, not a new requirement surface).
- `.planning/STATE.md` "Carry-forwards to v1.1.1" block — load-bearing summary of the 4 items.
- `CLAUDE.md` — project notes; new "Release tag conventions" section lands here per D-05.

### CI / release pipeline (no edits this phase, but referenced)

- `.github/workflows/release.yml` — tag-triggered workflow; `v1.1.1` tag-push exercises this path; the regex guard at `:43-54` is the surface where a future workflow-level enforcement of dot-prefixed rc tags would land (intentionally deferred per D-05).
- `electron-builder.yml` — `publish: null` + `extraResources: build/app-update.yml` (12.1-D-10 publish-race fix; not edited here).

### External docs (cited, not load-bearing for code edits)

- `node_modules/electron-updater/out/providers/GitHubProvider.js:51-83` — GitHub provider channel-matching logic; the source of truth for why `rc.N` (with dot) works and `rcN` (no dot) doesn't.
- `node_modules/semver/functions/prerelease.js` — semver prerelease-token parser; `prerelease("1.1.0-rc.2") === ["rc", 2]` vs `prerelease("1.1.0-rc2") === ["rc2"]`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`git mv` pending → resolved pattern** — landed by 12.1-07 (commit `ad6d9bf`); 88% rename similarity preserves git blame across the rename. Phase 13 reuses this exact mechanic for 3 todo files.
- **PRESERVE-HISTORY verification doc surface** — 12.1-D-08 + Plan 12.1-08 established the pattern of flipping prior-phase verification entries in-place (with `result:` / `verified_in:` / `transcript:` annotations) instead of overwriting them. Phase 13 reuses this when flipping 12.1-VERIFICATION.md entries.
- **Single-line / single-block atomic edit pattern** — 12-04 / 12-05 / 12.1-06 / 12.1-07 all landed surgical changes with a tight diff scope. Phase 13's two `src/main/index.ts` edits fit the same pattern (two separate atomic commits or one combined; plan-phase picks).

### Established Patterns

- **Atomic Pattern-B write (`.tmp` + `fs.rename`)** — load-bearing across Phase 6 / 8 / 12 but not used in Phase 13 (no on-disk state mutations beyond version bump).
- **Source-grep regression tests** — established by 12-04 F2 (`tests/renderer/app-shell-output-picker.spec.tsx`) and 12.1-06 (size soft-gate in `tests/integration/install-md.spec.ts`); Phase 13 may or may not adopt this for the `src/main/index.ts` edits per D-07 (Claude's discretion at plan time).
- **CI tag-push workflow** — `v1.1.0`-rc1/rc2/rc3/v1.1.0 final all proved the publish-race fix is structurally correct; v1.1.1 tag-push will exercise the same code path with no surface changes.

### Integration Points

- `src/main/index.ts` — single Electron main entry point; both cosmetic Windows fixes land here. Plan-phase confirms exact line numbers (339 may have shifted by the time planning runs).
- `CLAUDE.md` — single-file edit; "Release tag conventions" section appended or inserted near "Critical non-obvious facts" block.
- `package.json` `version` field — single-line bump; semver-only.
- `.github/workflows/release.yml` — **not edited**; just exercised by `v1.1.1` tag-push.
- `.planning/todos/pending/` → `.planning/todos/resolved/` — 3 `git mv` operations.

</code_context>

<specifics>
## Specific Ideas

- v1.1.1 release-notes "stranded rc-tester" callout (D-03) is a single bullet, not a section. Tone: factual, no apology, no fanfare. Example: "If you installed `v1.1.0-rcN` (rc1, rc2, or rc3), please download `v1.1.1` manually from this page — auto-update couldn't reach you due to a naming bug fixed in this version. After upgrading, all future auto-updates work normally."
- The CLAUDE.md "Release tag conventions" section should be 5-10 lines max; one ✅ example, one ❌ example, one-line rationale, one cross-link. No essay.
- Phase 13.1 (when inserted later via `/gsd-insert-phase`) inherits the live-UAT scope: Linux runbook execution + libfuse2 PNG + macOS / Windows manual UAT of v1.1.0 → v1.1.1 auto-update detection / download / restart / "Later" persistence. The Linux host strategy gray area gets re-discussed in 13.1's own context (D-04 hybrid precedent applies).
- D-06's "no platform-conditional branch" choice mirrors 12.1's design rationale: keep the cohesive code surface unitary; let Electron's platform-noop semantics handle platform divergence at the OS layer rather than at the app layer.

</specifics>

<deferred>
## Deferred Ideas

### Phase 13.1 (insert after Phase 13 closes)

- **Linux runbook execution** — full UAT of v1.1.1 install + auto-update lifecycle on a real Ubuntu 24.04 desktop host. Host-strategy gray area to be re-discussed in 13.1's own context (Cloud VM / VirtualBox / borrow physical / Docker-for-PNG-only).
- **libfuse2 PNG capture** (SC-6 4/4) — replace the 67-byte placeholder at `docs/install-images/linux-libfuse2-error.png` with a real ≥ 5KB capture; flip the `test.todo` in `tests/integration/install-md.spec.ts` to a real assertion.
- **macOS / Windows v1.1.0 → v1.1.1 auto-update lifecycle UAT** — the canonical user path; verifies UPD-01..04 live for the first time on a real published feed (rc-channel bug doesn't affect this path; final → final uses `currentChannel === null` code path).
- **Windows windows-fallback variant live observation** — UpdateDialog `windows-fallback` variant mounting + "Open Release Page" button click on a Windows v1.1.1 install when a future v1.1.2 ships.
- **rc → rc same-channel auto-update verification** — naturally arises only if v1.2 chooses an rc cycle; no need to manufacture one for Phase 13.1.

### v1.2 milestone (or beyond)

- Workflow-level regex guard rejecting non-dot rc tags in `.github/workflows/release.yml:43-54` — deliberately dropped from Phase 13 per D-05; CLAUDE.md docs are sufficient for a single-developer project.
- In-app stuck-rc detector — rejected per D-04; the bug it mitigates is the same bug that makes the detector itself untestable.
- TEL-01..07 crash + error reporting — descoped 2026-04-28 (PROJECT.md "Out of Scope (v1.1)" entry).
- UI improvements informed by tester feedback.

### Reviewed Todos (not folded)

- `.planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md` — UI-area todo from v1.0 phase 4 code review; not a 12.1 carry-forward; stays pending per its own metadata; revisit at v1.2 with broader UI improvement work.

</deferred>

---

*Phase: 13-v1-1-1-polish-phase-12-1-carry-forwards*
*Context gathered: 2026-04-28*

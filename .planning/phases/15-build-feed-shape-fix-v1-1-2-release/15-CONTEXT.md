# Phase 15: Build/feed shape fix + v1.1.2 release - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Reconcile what `electron-builder` produces, what `scripts/emit-latest-yml.mjs` (the 12.1-D-10 synthesizer) emits, and what `electron-updater@6.8.3` actually consumes per platform — so an installed packaged v1.1.1 client can detect, download, and relaunch into v1.1.2 end-to-end on **both** macOS and Windows. Then bump `package.json` 1.1.1 → 1.1.2, tag `v1.1.2`, watch CI, and publish v1.1.2 final through the existing 12.1-D-10 architecture (`release.yml` + `softprops/action-gh-release@v2.6.2` + `scripts/emit-latest-yml.mjs`). UPDFIX-01 is verified live against the real published feed. The 6 packaged-build UAT items deferred from Phase 14 (`14-HUMAN-UAT.md`) close in this phase.

**In scope (this phase):**
- UPDFIX-01 root-cause fix — macOS `.zip` artifact alongside `.dmg` so Squirrel.Mac can swap on Download & Restart (no more `ZIP file not provided`).
- `scripts/emit-latest-yml.mjs` extension to handle the dual-installer macOS case (auto-detect `.dmg` + `.zip` in `release/`).
- `latest-mac.yml` `files[]` shape — both entries, `.zip` primary, `.dmg` secondary.
- `.github/workflows/release.yml` extension — `build-mac` `upload-artifact` glob + `publish` job `files:` list both add the `.zip` line; final asset count locked at 7 (`.dmg` + `.zip` + `latest-mac.yml` + `.exe` + `latest.yml` + `.AppImage` + `latest-linux.yml`).
- `package.json` version bump 1.1.1 → 1.1.2 (single atomic commit per 12.1-02 / 13-03 precedent).
- Local + `workflow_dispatch` pre-flight gate before tagging.
- Tag `v1.1.2` push → CI watch → 7-asset draft Release → publish v1.1.2 final.
- Live verification of UPDFIX-01 against the real published feed (installed v1.1.1 mac/win → published v1.1.2).
- Live verification of the 6 packaged-build UAT items in `14-HUMAN-UAT.md`, split between pre-tag and post-publish windows.
- Release-notes stranded-rc-tester callout (verbatim Phase 13 D-04 pattern).

**Out of scope (this phase):**
- Flipping `SPIKE_PASSED=true` on win32 — Phase 14 D-13 lock preserved; Windows ships `windows-fallback` variant (Open Release Page button) per Phase 12 D-04 + Phase 14 D-13. Auto-update download path on Windows stays disabled in v1.1.2.
- New CI / build / publish surface beyond the targeted feed-shape fix — DIST-01..07, CI-01..06, REL-01..04 contracts unchanged.
- Reverting the 12.1-D-10 architecture (`publish: null` + post-build synthesizer) — proven across 4 successful CI runs (rc2 / rc3 / v1.1.0 / v1.1.1); stays.
- New auto-update features (delta updates, staged rollouts, custom update channels) — REQUIREMENTS.md "Out of Scope (v1.1.2)".
- Apple Developer ID / Windows EV code-signing — REQUIREMENTS.md "Out of Scope (v1.1.2)".
- Phase 13.1 live UAT carry-forwards (Linux runbook + libfuse2 PNG capture; macOS/Windows v1.1.0 → v1.1.1 lifecycle observation; cosmetic Windows fix UX confirmation; Windows windows-fallback variant live observation) — separately tracked, NOT part of v1.1.2.
- Linux `.AppImage` shape changes — `latest-linux.yml` + `.AppImage` byte-for-byte unchanged from v1.1.1 (12.1-D-10 architecture preserved); Linux is opportunistic-only verification in Phase 15 (no host required to ship).
- `.blockmap` files for any platform — currently NOT shipped to GitHub Releases (verified in Phase 13 close-out: v1.1.1 publish was 6 assets — `.dmg` + `.exe` + `.AppImage` + 3 × `latest*.yml`, no `.blockmap` lines). Differential-update optimization is out of scope; v1.1.2 ships the same no-blockmap shape plus the new `.zip` (locked at 7 assets, NOT 8).

</domain>

<decisions>
## Implementation Decisions

### A. UPDFIX-01 root-cause fix architecture

- **D-01:** **Add `zip` to `mac.target` in `electron-builder.yml` alongside `dmg`.** Locked path:
  ```yaml
  mac:
    target:
      - target: dmg
        arch: arm64
      - target: zip
        arch: arm64
  ```
  electron-builder produces both `.dmg` and `.zip` natively in the same `npm run build:mac` invocation, atomically. The `.zip` is what Squirrel.Mac actually downloads + swaps on Download & Restart (root cause of the `ZIP file not provided` error observed live on v1.1.1 macOS clients). The `.dmg` stays as a tester drag-to-Applications install asset (referenced by `INSTALL.md`). Most aligned with electron-builder's documented contract; minimal new script surface; no new dependency. **Rejects** synthesizer-extracts-zip-from-.app (more script complexity, new tar/zip dep), zip-only target (loses tester `.dmg` UX documented in `INSTALL.md`), defer-to-research (research is a Phase 15 RESEARCH.md deliverable but the architectural choice is locked here — research validates fields/sha512/size schema details, not the target list).

### B. `latest-mac.yml` feed shape with dual installers

- **D-02:** **`files[]` array contains both entries; `.zip` first.** Schema:
  ```yaml
  version: 1.1.2
  files:
    - url: <zip filename>
      sha512: <base64 sha512 of .zip>
      size: <bytes>
    - url: <dmg filename>
      sha512: <base64 sha512 of .dmg>
      size: <bytes>
  path: <zip filename>          # legacy top-level mirror — references the .zip (matches files[0])
  sha512: <files[0].sha512>     # legacy mirror
  releaseDate: '<ISO 8601>'
  ```
  electron-updater@6.x reads `files[]` first (picks the first matching url for download), falls back to legacy top-level for older versions. `.zip` first means MacUpdater downloads `.zip`. `.dmg` stays in `files[]` so future electron-updater versions or alternative consumers can find it. Most defensive against version drift. **Rejects** zip-only-in-files (splits feed contract from CI artifact list — harder to verify), defer-to-research (the dual-entry shape is the documented electron-updater 6.x contract; research validates other macUpdater code-path edge cases like the `.zip` URL-encoding for spaces in filenames, NOT the basic schema choice).

### C. Synthesizer (`scripts/emit-latest-yml.mjs`) extension

- **D-03:** **Auto-detect both `.dmg` + `.zip` on `--platform=mac`.** When `--platform=mac`, scan `release/` for both `.dmg` AND `.zip`; hash both with `node:crypto` SHA-512 + size both with `node:fs.statSync`; emit `files[]` array with both entries (`.zip` first per D-02). `--platform=win` and `--platform=linux` paths unchanged (single installer; existing single-entry `files[]` continues to ship). The PLATFORM_MAP in [scripts/emit-latest-yml.mjs:42-46](scripts/emit-latest-yml.mjs#L42-L46) extends to handle a list of `extRegex` per platform on mac (others stay single-regex). Atomic-write contract preserved (`.tmp` + `fs.renameSync`). Existing fail-fast checks (no installer match → exit 1; multiple matches of same kind → exit 1) extend naturally: now mac requires exactly-one `.dmg` AND exactly-one `.zip`. **Rejects** new `--mac-secondary=zip` flag (more flag surface; npm scripts get longer; auto-detect is more declarative), two-invocations-and-merge (race on YAML file; more complexity).

- **D-04:** **Existing test pattern at `tests/integration/emit-latest-yml.spec.ts` (Phase 12.1) extends with a dual-installer mac fixture.** Locked acceptance:
  - New test "emits files[] with both .dmg and .zip on mac" — fixture has both binary files; assert (a) parsed YAML has 2-element `files[]`, (b) `files[0].url` ends `.zip`, (c) `files[1].url` ends `.dmg`, (d) `path === files[0].url`, (e) `sha512 === files[0].sha512`, (f) both sha512 fields are valid base64 of the right binary content.
  - Existing "single .dmg" test stays — fails fast if mac has only `.dmg` and no `.zip` (tighter contract).
  - Win + linux paths' existing tests unchanged.
  Planner picks exact assertion list within these acceptance markers.

### D. CI workflow (`release.yml`) seam

- **D-05:** **Extend `build-mac` upload-artifact glob + `publish` job `files:` list with explicit lines (NOT broadened glob).** Locked diff:
  ```yaml
  # build-mac job (line 76-78 today):
  - uses: actions/upload-artifact@...
    with:
      name: installer-mac
      path: |
        release/*.dmg
        release/*.zip          # ← Phase 15 add
        release/latest-mac.yml
      if-no-files-found: error
  ```
  ```yaml
  # publish job (line 159-165 today):
  files: |
    assets/*.dmg
    assets/*.zip               # ← Phase 15 add
    assets/*.exe
    assets/*.AppImage
    assets/latest.yml
    assets/latest-mac.yml
    assets/latest-linux.yml
  ```
  Final published asset count: **7** (was 6 in v1.1.1). Explicit lines beat broadened globs (`*.{dmg,zip}`) for supply-chain hygiene — glob expansion behavior varies by runner/shell, explicit lines are deterministic. **Rejects** glob-broadening, defer-to-planner (the seam is mechanical but load-bearing for the 7-asset success criterion in ROADMAP).

### E. Release engineering posture (mirrors Phase 13 Plan 13-05)

- **D-06:** **Straight to v1.1.2 final — no rc cycle.** Single tag-push (`v1.1.2`) → single CI run → single 7-asset draft Release → publish. Mirrors Phase 13 D-02 posture (v1.1.1 final, no rc) and Plan 13-05 execution shape. Risk mitigation: D-07 pre-flight gate catches breakage cheap before the real tag. **Rejects** `v1.1.2-rc.1`-first (extra CI cycle + manual rc install for a minimal-surface change with strong pre-flight; v1.1.0 → v1.1.1 final auto-update path is already proven in v1.1.1 close-out), conditional-rc-on-dry-run-fail (the dry run either passes-or-blocks; an rc cycle is a separate decision worth making upfront).

- **D-07:** **Local + `workflow_dispatch` dry run pre-flight before tag push.** Two gates:
  1. Local: `npm run build:mac` (and `npm run build:win` if a Windows host is available; not gating). Verify (a) both `release/*.dmg` AND `release/*.zip` land for mac; (b) `release/latest-mac.yml` references both with valid sha512 (base64 regex `^[A-Za-z0-9+/=]{64,}$`) + size (matches `wc -c`); (c) bundled `app-update.yml` byte-identical to `build/app-update.yml` (12.1-D-10 invariant preserved). Vitest gate: `npm run test` — full suite (493/493 baseline as of Phase 14 close + new dual-installer mac assertions added by D-04).
  2. CI dry run: `gh workflow run release.yml` on a feature branch (NOT main; NOT a tag). Captures: workflow run ID + 7-asset glob match + downloaded `latest-mac.yml` content inspection. Confirms the CI-only seam (fail-fast `if-no-files-found: error` paths in upload-artifact; the new `assets/*.zip` glob in publish job's `files:`).

  Both gates MUST pass before the v1.1.2 tag push. The 12.1-D-02 pre-flight discipline is the pattern (it closed the publish race; it pays for itself in ~10 min CI wait vs polluting a final tag with a failed run). **Rejects** local-only (CI-only breakage at real tag would pollute v1.1.2 surface — exactly the failure mode 12.1-D-02 was designed to prevent), tag-straight-away (4 successful CI runs of the 12.1-D-10 architecture is strong evidence but the delta IS new — `mac.target += zip` + synthesizer dual-installer logic + CI artifact glob extension; pre-flight discipline applies).

- **D-08:** **Plan-15 release-engineering wave is autonomous: false with 3 BLOCKING user-confirmation checkpoints.** Mirrors Plan 13-05's exact shape (the user passed all 3 gates on v1.1.1; the workflow is proven for git-beginner posture per user memory). Checkpoints:
  1. **Pre-flight verify** (after both gates in D-07 land green) — user confirms "ready to tag" before the tag-push task fires.
  2. **Pre-push final confirmation** (after tag is created locally, before `git push origin v1.1.2`) — user confirms they understand which commit the tag points at (default: HEAD~N pointing at the version-bump commit per 12.1-02 / 13-05 precedent of tagging the version-bump, NOT a subsequent docs commit; planner makes the exact ref explicit at checkpoint time).
  3. **Pre-publish final verification** (after CI completes + draft Release exists, before `gh release edit v1.1.2 --draft=false`) — user confirms the 7-asset count, 3 × `latest*.yml` content shape, release notes body, and the stranded-rc callout per D-09 are all correct.

### F. Stranded rc-tester migration

- **D-09:** **Reuse Phase 13 D-04 callout verbatim in v1.1.2 release notes Known issues block.** Audience: anyone still installed on `v1.1.0-rcN` (rc1/rc2/rc3) by 2026-04-29 — they hit the electron-updater 6.x channel-name mismatch and their auto-updater can't reach v1.1.2. Callout pattern: "If you installed `v1.1.0-rc1`, `-rc2`, or `-rc3`, please download `v1.1.2` manually from the assets list below — after upgrading, all future auto-updates work normally." Cross-link to CLAUDE.md `## Release tag conventions` for context. Anyone on v1.1.0 final OR v1.1.1 final auto-updates cleanly to v1.1.2 (the new `.zip` shape lets v1.1.1 mac clients actually complete the swap; v1.1.0 final → v1.1.2 mac path benefits identically). **Rejects** skip-callout (low marginal cost of reuse; tester pool may still have stranded rcN installs), broaden-callout (no new in-app code path produces a stranded state for v1.1.0/v1.1.1 final users; the .zip fix is purely additive at the feed layer — installed v1.1.1 macOS clients with the old `ZIP file not provided` error can simply re-trigger Help → Check for Updates against the new feed and the swap will succeed; no permanent corruption).

### G. 14-HUMAN-UAT live-verification execution model

- **D-10:** **Split UAT execution: pre-tag + post-publish.** The 6 packaged-build UAT items in `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-HUMAN-UAT.md` close in Phase 15:
  - **Pre-tag (after D-07 local gate, before D-07 dry run):** Tests 1-4 — mac/win cold-start auto-check (UPDFIX-03; tests 1+2) + mac/win Help → Check for Updates from idle (UPDFIX-04; tests 3+4). These run against a locally-built v1.1.2 packaged installer + the published v1.1.1 feed (NO updates available — verifies the silent-swallow path + the cold-start IPC + the manual-check pre-load IPC fire correctly). DevTools console log lines per Phase 14 D-09/D-10 are the evidence (`[auto-update] startup-check: setTimeout fired`, `[auto-update] checkUpdate: trigger=startup, version=1.1.2`, `[auto-update] event: update-not-available, version=...`).
  - **Post-publish (after v1.1.2 final published; before phase close):** Tests 5-6 — Windows manual re-check after Later dismissal (UPDFIX-02 asymmetric rule; test 5) + Windows UpdateDialog Open Release Page button visibility (UPDFIX-02 windows-fallback variant; test 6). These require an installed packaged v1.1.1 client + the published v1.1.2 feed. Plus the natural UPDFIX-01 happy-path verification: installed v1.1.1 mac client successfully downloads + relaunches into v1.1.2 (no `ZIP file not provided`).
  Distributes risk across the tag-push gate; closes Phase 14 + Phase 15 verification in one wave. **Rejects** all-after-publish (Phase 14 regressions only surface after v1.1.2 tag is permanent), all-before-publish (tests 5-6 need a real published newer version — can't simulate locally without polluting the feed), carry-to-Phase-16 (would ship v1.1.2 without verifying the Phase 14 fixes the v1.1.2 release is supposed to validate; circular).

### H. Folded Todos

None — `.planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md` is the only pending todo and is v1.0 lineage (out of v1.1.2 scope per its own metadata, mirrors Phase 13 D-folded posture). `gsd-sdk query todo.match-phase 15` returned 0 matches.

### I. Claude's Discretion (planner-level)

- Exact regex / extension matching scheme for D-03 dual-installer mac in `scripts/emit-latest-yml.mjs` PLATFORM_MAP (e.g., `extRegexes: [/\.zip$/i, /\.dmg$/i]` array vs separate keys). Constraint: preserve fail-fast on missing/multiple matches.
- Exact assertion list + fixture-binary shape in the new `tests/integration/emit-latest-yml.spec.ts` dual-installer test case (e.g., real `.dmg` + `.zip` files vs programmatically generated buffers). Constraint: matches D-04 acceptance markers; minimizes added test artifact bytes.
- Whether the feature-branch name for D-07's `workflow_dispatch` dry run is `phase-15-mac-zip-pre-flight` or `feat/v1.1.2-mac-zip` or similar (planner picks; keep short + descriptive).
- Exact wording of the 3 BLOCKING checkpoint prompts in D-08 (mirrors Plan 13-05 prompts; planner adapts to v1.1.2 surface — e.g., "ready to tag v1.1.2 at <SHA>?" / "ready to push v1.1.2?" / "ready to publish v1.1.2 (7 assets verified)?").
- Whether v1.1.2 release notes "## New in this version" section bullets explicitly call out the macOS `.zip` fix or stay user-facing-feature-oriented (e.g., "macOS auto-update now successfully downloads and relaunches into newer versions" vs "Fixed `.zip` artifact missing from `latest-mac.yml`"). Planner picks per REL-02 release-template precedent (4 sections: Summary / New in this version / Known issues / Install instructions).
- Order of UAT tests within pre-tag and post-publish segments in D-10 (tests 1-4 + 5-6 grouping is fixed; sub-ordering is planner's call). Mac-first vs Windows-first vs interleaved within each segment is operationally indifferent.
- Whether to add a defensive ROADMAP `success criteria` mini-edit clarifying that the asset count is locked at **7** (not "6 or 7" as ROADMAP currently reads). Out of strict Phase 15 scope but cheap; planner picks. NOT a CONTEXT.md decision — listed here so the planner doesn't re-debate.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 15 contract (this phase)

- `.planning/REQUIREMENTS.md` — UPDFIX-01 wording (only Phase 15 requirement). UPDFIX-02/03/04 are Phase 14's surface (closed — `.planning/STATE.md` "Decisions" block + `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-VERIFICATION.md`).
- `.planning/ROADMAP.md` §"Phase 15: Build/feed shape fix + v1.1.2 release" — Goal + 5 Success Criteria + Plans: TBD line.
- `.planning/STATE.md` §"Open questions" Phase 15 entry (.zip artifact target list — answered by D-01 here) + §"Decisions" v1.1.2 block + §"Last completed" Phase 14 close-out + Plan 14-06 close-out (all locked context).
- `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-HUMAN-UAT.md` — 6 deferred packaged-build UAT items + frontmatter `deferred_to: phase-15-build-feed-shape-fix-v1.1.2-release` ride-forward contract. Phase 15 verifier closes these per D-10 above.

### Phase 12.1 D-10 architecture lineage (locked, preserved unchanged)

- `.planning/milestones/v1.1-phases/12.1-installer-auto-update-live-verification/12.1-CONTEXT.md` §"Publish-race fix architecture" D-10 — full lineage of why `electron-builder.yml` `publish: null` + post-build `scripts/emit-latest-yml.mjs` synthesizer is the load-bearing architecture. Phase 15 EXTENDS this; does NOT revert it.
- `.planning/milestones/v1.1-phases/12.1-installer-auto-update-live-verification/12.1-RESEARCH.md` — electron-updater@6.x feed schema research; the `latest-{mac,win,linux}.yml` shape that v1.1.0 / v1.1.1 ship with. Phase 15 RESEARCH.md extends with: (a) MacUpdater Squirrel.Mac `.zip` swap mechanics, (b) `files[]` ordering preference (`.zip` first vs second), (c) URL-encoding of `.zip` filename with spaces (asset-name-mismatch warning from 12-RESEARCH.md §latest-mac.yml schema applies identically).
- `scripts/emit-latest-yml.mjs:1-126` — synthesizer source. Phase 15 modifies PLATFORM_MAP for mac to be a dual-extension match + `findInstaller` → `findInstallers` (returns 1 or 2 results) + emit logic builds `files[]` from N entries.

### Phase 12 lineage (auto-update orchestration, unchanged but referenced)

- `.planning/milestones/v1.1-phases/12-auto-update-tester-install-docs/12-CONTEXT.md` §D-04 (Windows-fallback variant routing — Phase 14 D-13 preserved + Phase 15 doesn't flip), §D-08 (`dismissedUpdateVersion` strict-`>` semantics — Phase 14 D-05 asymmetric rule overrides for manual triggers), §D-18 (`SHELL_OPEN_EXTERNAL_ALLOWED` Releases-index URL — Phase 14 D-12 re-verified).
- `.planning/milestones/v1.1-phases/12-auto-update-tester-install-docs/12-RESEARCH.md` §"Unsigned-Windows Behavior" + §"latest-mac.yml schema" + §"Asset-name mismatch warning" (line 500) — the URL-encoding-of-spaces warning applies identically to the new `.zip` filename (it'll have spaces too).

### Phase 13 release-engineering precedent (Plan 13-05 shape mirror)

- `.planning/milestones/v1.1-phases/13-v1-1-1-polish-phase-12-1-carry-forwards/13-CONTEXT.md` §D-02 (straight-to-final v1.1.1, no rc cycle — Phase 15 D-06 mirror), §D-03 (release-notes stranded-rc callout — Phase 15 D-09 verbatim reuse), §D-04 (out-of-band comms only — Phase 15 D-09 lineage).
- `.planning/milestones/v1.1-phases/13-v1-1-1-polish-phase-12-1-carry-forwards/13-05-PLAN.md` (when archived; currently at `13-05-PLAN.md` in the open Phase 13 dir) — the executor-shape template for Phase 15 release-engineering plan: autonomous: false, 3 BLOCKING user-confirmation checkpoints, 9-task Tag → CI → Release-body → Publish → Doc-flip sequence.
- `CLAUDE.md` §"Release tag conventions" — `v1.2.0-rc.1` ✅ vs `v1.2.0-rc1` ❌ contract; relevant to D-09 callout cross-link. Phase 15 ships `v1.1.2` (final, no rc), so the convention doesn't apply to the tag itself this phase.

### Phase 15 surface files (greenfield + edits)

- `electron-builder.yml:55-67` (mac block) — Phase 15 adds `- target: zip` `arch: arm64` entry alongside existing `- target: dmg` `arch: arm64`. `mac.identity: '-'` ad-hoc + `hardenedRuntime: false` + `gatekeeperAssess: false` + `artifactName` template all unchanged. `dmg:` block unchanged. `mac.target` array gains a 2nd entry; nothing else moves.
- `scripts/emit-latest-yml.mjs:42-46` (PLATFORM_MAP) — extend mac entry from single `extRegex: /\.dmg$/i` to dual-pattern (e.g., `extRegexes: [/\.zip$/i, /\.dmg$/i]`). `findInstaller` → `findInstallers` (return 1 or 2 results); `emitYaml` builds `files[]` from N entries. Win + linux paths unchanged.
- `package.json:6` — version field bump `1.1.1` → `1.1.2` via `npm version 1.1.2 --no-git-tag-version` (12.1-02 / 13-03 precedent).
- `package.json:11-13` (build:* scripts) — UNCHANGED. The synthesizer invocation `node scripts/emit-latest-yml.mjs --platform=mac` already routes to mac; D-03's auto-detect lives inside the script.
- `.github/workflows/release.yml:73-80` (build-mac job upload-artifact) — Phase 15 adds `release/*.zip` line to `path:` block per D-05.
- `.github/workflows/release.yml:159-165` (publish job files: list) — Phase 15 adds `assets/*.zip` line per D-05.
- `tests/integration/emit-latest-yml.spec.ts` — Phase 15 adds new dual-installer test case + tightens existing single-mac test per D-04.
- `.planning/STATE.md` + `.planning/ROADMAP.md` — Phase 15 close-out doc-flip commit (Plan 15-NN final task; mirrors 13-05 Task 9 doc-flip cadence).

### Test conventions (existing patterns Phase 15 mirrors)

- `tests/integration/emit-latest-yml.spec.ts` (Phase 12.1) — synthesizer integration-test pattern; Phase 15 extends in-place per D-04.
- `tests/main/auto-update.spec.ts` + `tests/main/auto-update-dismissal.spec.ts` + `tests/renderer/app-update-subscriptions.spec.tsx` + `tests/integration/auto-update-shell-allow-list.spec.ts` (Phase 12 + Phase 14) — full Phase 14 regression net runs as part of D-07 local gate. 493/493 baseline post-Plan 14-06; D-04 adds N more assertions.
- `tests/integration/install-md.spec.ts` (Phase 12 Plan 06) — URL-consistency regression-gate pattern; reused for the SHELL allow-list consistency check at Phase 14 close — referenced here only to make explicit Phase 15 does NOT touch this surface.

### External docs (cited; planner's research validates)

- electron-updater 6.8.3 docs at `electron.build/auto-update.html` — `MacUpdater` Squirrel.Mac `.zip` swap mechanics (the canonical doc for why `.zip` is required alongside `.dmg`).
- `node_modules/electron-updater/out/MacUpdater.js` (whatever version 6.8.3 ships) — the source of truth for which `files[]` entry MacUpdater downloads (planner reads to validate D-02's `.zip`-first ordering).
- `node_modules/electron-builder/out/...` — the source of truth for `mac.target` zip behavior (whether it produces `.zip.blockmap` alongside `.zip` — affects asset count if blockmap ever ships; v1.1.2 explicitly ships 7 assets per D-05, no blockmaps).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `scripts/emit-latest-yml.mjs` — full synthesizer with atomic `.tmp + fs.renameSync` write pattern, fail-fast on missing/multiple installers, sha512 base64 + size compute via `node:crypto` + `node:fs.statSync`, `js-yaml` serialization. Phase 15 extends in-place; doesn't rewrite.
- `electron-builder.yml` mac block — ad-hoc identity `'-'` + `hardenedRuntime: false` + `gatekeeperAssess: false` + `artifactName` template. Phase 15 adds zip target; nothing else moves. The same `artifactName: ${productName}-${version}-${arch}.${ext}` template extends to `.zip` automatically (electron-builder substitutes `${ext}` per target).
- `release.yml` 3-OS test matrix + 3 parallel build jobs + softprops/action-gh-release@v2.6.2 publish job — proven across 4 successful runs (rc2 / rc3 / v1.1.0 / v1.1.1). Phase 15 adds 1 line in build-mac upload-artifact + 1 line in publish files: list; nothing else moves.
- `tests/integration/emit-latest-yml.spec.ts` — existing synthesizer integration test with `EMIT_LATEST_YML_REPO_ROOT_OVERRIDE` env-var test seam. Phase 15 extends fixtures + adds dual-installer test case.

### Established Patterns

- **Atomic file writes:** `.tmp` + `fs.renameSync` Pattern-B (CONTEXT.md `<code_context>` Established Patterns lineage from v1.0). Synthesizer already follows; Phase 15 unchanged.
- **Fail-fast in build pipeline scripts:** explicit error message + non-zero exit on missing-input / ambiguous-input / compute-failure (synthesizer pattern). D-03 extends to "exactly one .dmg AND exactly one .zip" on mac; missing either fails fast.
- **CI artifact contract:** `if-no-files-found: error` on every `actions/upload-artifact` step. D-05 preserves this — adding `release/*.zip` to the build-mac path means the job MUST produce a `.zip`, otherwise it fails fast (correct behavior; missing `.zip` would mean MacUpdater can't auto-update on Windows release publication).
- **3-section release notes** (Summary / New in this version / Known issues / Install instructions) per REL-02 — `.github/release-template.md` envsubst-rendered. D-09 stranded-rc callout lands in Known issues block.
- **Tag annotated, points at version-bump commit:** Plan 12.1-02 / 13-05 precedent — `git tag -a v1.1.2 <bump-commit-sha> -m "v1.1.2 — macOS .zip auto-update fix"`. D-08 checkpoint 2 makes the SHA explicit.
- **autonomous: false plan with BLOCKING checkpoints:** Plan 13-05 shape — pre-flight verify → tag-push → CI watch → release-body authoring → publish → doc-flip-commit. 9 tasks; user gates 3 of them. Phase 15 mirrors.

### Integration Points

- **electron-builder ↔ synthesizer seam:** `npm run build:mac` runs `electron-vite build && electron-builder --mac dmg --publish never && node scripts/emit-latest-yml.mjs --platform=mac`. Phase 15: the `--mac dmg` flag — does it need to become `--mac dmg zip` to produce both targets? Or does `mac.target` array in `electron-builder.yml` alone suffice and the CLI flag only narrows? **Planner-research lock point**: read electron-builder 26.x CLI docs; both options work in principle, but the npm script must invoke whichever produces both reliably. Likely answer: `electron-builder --mac --publish never` (drop the explicit target list; rely on `mac.target` array). Documented in Phase 15 RESEARCH.md.
- **CI publish-job ↔ feed-file consumer seam:** `softprops/action-gh-release@v2.6.2` `files:` list determines what lands as a Release asset; `electron-updater@6.8.3` reads `latest-mac.yml` from the same Release; the YAML's `files[].url` MUST match an asset in the Release. D-05 + D-02 + D-03 are mutually consistent: `files: [.zip, .dmg, ...]` ↔ `latest-mac.yml.files: [.zip, .dmg]`.
- **Tag → CI → Release seam:** existing `release.yml` `on.push.tags: ['v*.*.*']` triggers on tag push. Phase 15 doesn't change this; v1.1.2 tag exercises the same path that v1.1.0 / v1.1.1 already proved. D-07 dry run uses `workflow_dispatch` to fire the same workflow on a feature branch without a tag → CI runs but skips publish (the `if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')` gate at line 127 ensures dry runs never publish).

</code_context>

<specifics>
## Specific Ideas

- **The 7-asset count is locked, NOT 6-or-7.** ROADMAP success criterion 1 reads "6-asset (or 7-asset if `.zip` adds)" — this CONTEXT lock-in resolves to 7 firmly (`.dmg` + `.zip` + `latest-mac.yml` + `.exe` + `latest.yml` + `.AppImage` + `latest-linux.yml`). No `.blockmap` files ship. Planner-discretion to clarify ROADMAP wording in passing during the doc-flip task; not strictly required.
- **`.dmg` stays as a tester drag-to-Applications asset.** `INSTALL.md` references the `.dmg` as the canonical macOS install path; that UX is preserved. The `.zip` is a behind-the-scenes auto-update artifact testers don't see in any documentation. This is the right shape for an unsigned ad-hoc-signed mac distribution: testers get the friendly drag-to-Applications + Gatekeeper "Open Anyway" path; auto-update gets the Squirrel.Mac path.
- **The asset-name-mismatch warning from 12-RESEARCH.md applies to `.zip` identically.** `Spine Texture Manager-1.1.2-arm64.zip` (with spaces in filename) → URL-encoded as `Spine-Texture-Manager-1.1.2-arm64.zip` in `latest-mac.yml` `files[].url` → GitHub Releases serves the asset under the spaces filename → MacUpdater downloads via the URL-encoded form. Verified in v1.1.1 ship for `.dmg`; same posture for `.zip`.
- **The 14-HUMAN-UAT.md ride-forward contract is explicit.** The frontmatter at `14-HUMAN-UAT.md` `deferred_to: phase-15-build-feed-shape-fix-v1.1.2-release` makes Phase 15's verifier the closer for those 6 tests. Don't re-run `/gsd-verify-work 14`; run `/gsd-verify-work 15` once Phase 15 ships packaged installers.
- **The Windows path benefits from D-01 mac fix indirectly.** Windows auto-update download path is disabled (`SPIKE_PASSED=false` per Phase 14 D-13) → UpdateDialog renders `windows-fallback` variant → user clicks Open Release Page → browser opens `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` → the v1.1.2 release page now has the `.dmg` for mac testers + `.exe` for Windows testers + `.AppImage` for Linux testers. The mac `.zip` is invisible on the Windows tester path; it's strictly a MacUpdater artifact. So the .zip add doesn't change Windows UX one bit.
- **The "appears-once" Phase 14 UPDFIX-02 windows-fallback Open Release Page button visibility test (test 6 in 14-HUMAN-UAT.md) is the one that genuinely benefits from a real published v1.1.2.** Tests 1-4 work against the v1.1.1 feed (no updates → silent path verified). Test 5 needs a real update-available state to dismiss + re-check. Test 6 needs a real Open Release Page click landing on the v1.1.2 release page. So D-10's split — pre-tag for 1-4, post-publish for 5-6 — is the principled split, not a convenience.

</specifics>

<deferred>
## Deferred Ideas

- **Differential auto-update via `.blockmap` files.** electron-updater@6.x supports differential updates by downloading only the changed blocks via `.blockmap` files. v1.1.0 / v1.1.1 / v1.1.2 do NOT ship `.blockmap` files (each update downloads the full installer). Future v1.2 polish could add `.blockmap` to the CI artifact glob + `latest-*.yml` `files[]` entries — would reduce update download size from ~125 MB (full DMG/ZIP) to ~5-15 MB (delta). Out of v1.1.2 scope; revisit at v1.2.
- **`SPIKE_PASSED=true` on win32 (Phase 12 D-02 strict-spike bar).** Live verification of detect + download + apply + relaunch on unsigned NSIS .exe Windows. Phase 14 D-13 kept `false`; Phase 15 keeps `false`. Could be revisited in v1.2 if a Windows host with the spike runbook is available.
- **`workflow_dispatch` regex guard for non-dot rc tags.** Phase 13 D-05 deferred this to v1.2+; Phase 15 doesn't revisit. CLAUDE.md docs are sufficient enforcement for a single-developer project.
- **Telemetry / crash reporting.** Still descoped per REQUIREMENTS.md. Revisit at v1.2.
- **Apple Developer ID code-signing + notarization ($99/yr) AND Windows EV cert ($200-400/yr).** Still descoped; v1.1.2 ships the same ad-hoc mac + unsigned win posture as v1.1.0 / v1.1.1.
- **Linux UAT in Phase 15.** Linux `.AppImage` shape is unchanged in Phase 15 (12.1-D-10 architecture preserved). Linux UPD-* live verification (AppImage detect + download + relaunch via electron-updater 6.x AppImageUpdater) — pending host availability; carries to Phase 13.1 (separately tracked, NOT v1.1.2). Phase 15 verifier may opportunistically include Linux if a host is available; otherwise documented as carry-forward.
- **Phase 13.1 live UAT carry-forwards** — Linux runbook + libfuse2 PNG capture; macOS/Windows v1.1.0 → v1.1.1 auto-update lifecycle observation; cosmetic Windows fix UX confirmation; Windows windows-fallback variant live observation. Separately tracked; pending host availability; NOT part of v1.1.2.
- **In-app stuck-rc detector.** Phase 13 D-04 rejected this for v1.1.1; Phase 15 doesn't revisit. The bug it would mitigate is the same bug that makes the detector itself untestable on stranded installs. Out-of-band comms (D-09 release notes callout) remains the cheapest path.
- **Discord / direct-message stranded-rc tester comms.** Phase 13 D-04 path; Phase 15 inherits. Not a code/docs item — out-of-channel tester comms.

### Reviewed Todos (not folded)

None — `gsd-sdk query todo.match-phase 15` returned 0 matches. The only pending todo `2026-04-24-phase-4-code-review-follow-up.md` is v1.0 lineage and not relevant to Phase 15's surface (mirrors Phase 13 / Phase 14 posture).

</deferred>

---

*Phase: 15-build-feed-shape-fix-v1-1-2-release*
*Context gathered: 2026-04-29*

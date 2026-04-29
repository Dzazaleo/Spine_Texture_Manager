# Phase 15: Build/feed shape fix + v1.1.2 release - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 15-build-feed-shape-fix-v1-1-2-release
**Areas discussed:** macOS .zip strategy; rc cycle vs final; pre-flight gate; 14-HUMAN-UAT timing; latest-mac.yml shape; synthesizer extension; CI workflow update; stranded-rc callout

---

## A. macOS .zip artifact production strategy (UPDFIX-01 root cause)

| Option | Description | Selected |
|--------|-------------|----------|
| Add zip to mac.target (Recommended) | electron-builder.yml mac.target gains `- target: zip` alongside `- target: dmg`. emit-latest-yml.mjs extends to scan for both. .dmg stays as tester drag-to-Applications asset. | ✓ |
| Synthesizer extracts .zip from .app | Keep mac.target dmg-only; synthesizer produces .zip from unpacked .app via new tar/zip dep. | |
| Switch mac.target to zip-only | Drop .dmg entirely; ship .zip only. Loses tester install UX documented in INSTALL.md. | |
| Defer to plan-phase research | Researcher reads electron-updater 6.8.3 source + electron-builder 26.x docs to lock empirically. | |

**User's choice:** Add zip to mac.target (Recommended)
**Notes:** Most aligned with electron-builder's documented contract; minimal new script surface; no new dependency.

---

## B. v1.1.2 release cycle

| Option | Description | Selected |
|--------|-------------|----------|
| Straight to v1.1.2 final (Recommended) | Single tag-push → single CI run → publish. Mirrors Phase 13's Plan 13-05 posture. | ✓ |
| v1.1.2-rc.1 first | Tag rc.1 → CI publishes prerelease → manual install + verify → THEN tag final. Extra ~10-min CI cycle + manual rc install. | |
| v1.1.2-rc.1 only if dry-run fails | Default to straight-to-final; fall back to rc cycle only if workflow_dispatch dry run surfaces breakage. | |

**User's choice:** Straight to v1.1.2 final (Recommended)
**Notes:** Risk mitigated by D-07 pre-flight gate (local + workflow_dispatch dry run). v1.1.0 → v1.1.1 final auto-update path already proven; v1.1.2 delta is small and well-isolated.

---

## C. Pre-flight gate before tag push

| Option | Description | Selected |
|--------|-------------|----------|
| Local + workflow_dispatch dry run (Recommended) | `npm run build:mac` local + `gh workflow run release.yml` on feature branch. Both gates MUST pass before tag push. ~10 min CI wait. | ✓ |
| Local only | Just local build. Risks discovering CI-only breakage at real tag push. | |
| Tag straight away — trust the architecture | Skip pre-flight. 4 successful CI runs of evidence; cheapest if change is truly minor. Higher blast radius on miscalibration. | |

**User's choice:** Local + workflow_dispatch dry run (Recommended)
**Notes:** Mirrors 12.1-D-02 pre-flight discipline that closed the publish race. Catches CI-only breakage cheaply before polluting v1.1.2 surface.

---

## D. 14-HUMAN-UAT.md execution timing

| Option | Description | Selected |
|--------|-------------|----------|
| Split: pre-tag + post-publish (Recommended) | Tests 1-4 (cold-start + Help→Check from idle) BEFORE tag against v1.1.1 feed; tests 5-6 (Windows dismiss-recheck + Open Release Page) AFTER publish against v1.1.2 feed. | ✓ |
| All after publish | Defer all 6 tests to post-publish. Risks discovering Phase 14 regressions only after v1.1.2 tag is permanent. | |
| All before publish | Run all 6 against locally-built v1.1.2 packaged installers BEFORE tag push. Tests 5-6 can't reach published feed. | |
| Carry forward to Phase 16 | Skip 14-HUMAN-UAT.md in Phase 15 entirely. Out-of-scope expansion; circular (would ship v1.1.2 without verifying the Phase 14 fixes the v1.1.2 release validates). | |

**User's choice:** Split: pre-tag + post-publish (Recommended)
**Notes:** Distributes risk across the tag-push gate. Closes Phase 14 + Phase 15 verification in one wave. Tests 5-6 genuinely require a real published newer version.

---

## E. latest-mac.yml feed shape with dual installers

| Option | Description | Selected |
|--------|-------------|----------|
| Both in files[], .zip first (Recommended) | files[] has both entries (.zip primary, .dmg secondary). Legacy top-level mirror references .zip (matches files[0]). Most defensive against version drift. | ✓ |
| .zip in files[] only; .dmg is bonus asset | files[] contains only .zip. .dmg ships as a tester-download asset invisible to auto-updater. | |
| Defer to plan-phase research | Researcher reads MacUpdater source to lock empirically. | |

**User's choice:** Both in files[], .zip first (Recommended)
**Notes:** electron-updater@6.x reads files[] first → MacUpdater downloads .zip. .dmg remains discoverable for future versions or alternative consumers.

---

## F. Synthesizer extension for dual mac installer

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect both .dmg + .zip on mac (Recommended) | --platform=mac scans for both, hashes both, emits files[] with both. Win/linux unchanged. Minimal flag surface; declarative. | ✓ |
| New --mac-secondary=zip flag | Explicit flag passed by npm script. More explicit; more flag surface. | |
| Two synthesizer invocations | Call script twice and merge YAML in third step. Race on YAML file; more complexity. | |

**User's choice:** Auto-detect both .dmg + .zip on mac (Recommended)
**Notes:** Atomic-write contract preserved. Existing fail-fast behavior extends naturally to "exactly one .dmg AND exactly one .zip" on mac.

---

## G. CI release.yml workflow update

| Option | Description | Selected |
|--------|-------------|----------|
| Extend mac upload-artifact glob + publish files: list (Recommended) | Add explicit `release/*.zip` line to build-mac upload-artifact path; add explicit `assets/*.zip` line to publish job files: list. Final asset count: 7. | ✓ |
| Glob pattern broadened | Replace `release/*.dmg` with `release/*.{dmg,zip}`. One fewer line; glob behavior varies by runner. | |
| Defer to plan-phase | Planner figures out the exact CI seam. | |

**User's choice:** Extend mac upload-artifact glob + publish files: list (Recommended)
**Notes:** Explicit lines beat broadened globs for supply-chain hygiene. Final published asset count locked at 7 (was 6 in v1.1.1).

---

## H. Stranded rc-tester migration in v1.1.2 release notes

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — reuse Phase 13 D-04 callout (Recommended) | Release-notes Known issues block carries one-line callout pointing v1.1.0-rcN testers (rc1/2/3) at manual-download path. Verbatim Phase 13 precedent. | ✓ |
| No — v1.1.1 already shipped that callout | Skip in v1.1.2. Anyone still on rcN by now has either upgraded or stayed by choice. | |
| Yes plus broaden | Reuse + add fresh callout for v1.1.1 mac users with prior corrupted auto-update state. Plan-phase researcher confirms. | |

**User's choice:** Yes — reuse Phase 13 D-04 callout (Recommended)
**Notes:** Cheapest reuse of proven path. v1.1.0 final + v1.1.1 final users auto-update cleanly to v1.1.2 (the .zip fix is purely additive at the feed layer).

---

## I. Wrap-up — drill into anything else?

| Option | Description | Selected |
|--------|-------------|----------|
| Write CONTEXT.md | All key decisions captured. Remaining items (blockmap, regression test shape, dry-run branch name, exact checkpoint prompts) become Claude's Discretion. | ✓ |
| Discuss blockmap + 7th-asset count | Whether mac .zip.blockmap ships as 8th asset for differential updates. | |
| Discuss UAT test ordering | Exactly which tests run pre-tag vs post-publish + evidence format. | |
| Discuss workflow_dispatch dry run details | Branch name + evidence to capture + failure-mode handling. | |

**User's choice:** Write CONTEXT.md
**Notes:** All 8 prior questions resolved at recommended path. Remaining sub-decisions are well within plan-phase Claude-discretion bounds.

---

## Claude's Discretion

- Exact regex / extension matching scheme for D-03 dual-installer mac in `scripts/emit-latest-yml.mjs` PLATFORM_MAP.
- Exact assertion list + fixture-binary shape in the new `tests/integration/emit-latest-yml.spec.ts` dual-installer test.
- Feature-branch name for D-07's `workflow_dispatch` dry run.
- Exact wording of the 3 BLOCKING checkpoint prompts in D-08 (mirrors Plan 13-05 prompts).
- Whether v1.1.2 release notes "## New in this version" bullets call out the .zip fix or stay user-facing-feature-oriented.
- Order of UAT tests within pre-tag and post-publish segments.
- Whether to add a defensive ROADMAP success-criteria mini-edit clarifying asset count locked at 7.

---

## Deferred Ideas (carried to CONTEXT.md `<deferred>` section)

- Differential auto-update via `.blockmap` files (v1.2 polish).
- `SPIKE_PASSED=true` on win32 (Phase 12 D-02 strict-spike bar; v1.2 if Windows host available).
- `workflow_dispatch` regex guard for non-dot rc tags (Phase 13 D-05 deferred to v1.2+).
- Telemetry / crash reporting (descoped per REQUIREMENTS.md).
- Apple Developer ID + Windows EV code-signing (descoped).
- Linux UAT live verification (Phase 13.1; pending host).
- In-app stuck-rc detector (rejected at Phase 13 D-04; not revisited).
- Discord / direct-message stranded-rc tester comms (out-of-band; not code/docs).

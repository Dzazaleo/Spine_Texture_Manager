---
phase: 11
plan: 02
status: complete
completed: 2026-04-27
requirements: [CI-01, CI-02, CI-03, CI-04, CI-05, CI-06, REL-01, REL-02, REL-04]
---

# Plan 11-02 — Live verification of the CI release pipeline (SUMMARY)

## What was built

Live falsifiable verification of the Phase 11 CI release pipeline authored in Plan 11-01. Captured `gh` CLI evidence into `11-LIVE-VERIFICATION.md` for all eight VALIDATION.md acceptance criteria plus the REL-04 maintainer install smoke. No source code authored — this plan is verification, not construction.

## Run identifiers (audit trail)

| Run ID | Trigger | Commit | Result | Purpose |
|--------|---------|--------|--------|---------|
| 24993716580 | tag push v1.1.0-rc1 | 24d17a3 | **failure** (test job) | Surfaced: Phase 9 `tests/main/sampler-worker-girl.spec.ts` errors on CI because `fixtures/Girl/` is gitignored. Atomicity held — publish skipped, no draft release created. |
| 24994071839 | tag push v1.1.0-rc1 | f00e232 | **failure** (all 3 build jobs) | Surfaced: Pitfall 1 design gap — `--publish never` does not stop electron-builder's publisher auto-detect from `git remote` at build-prep time. Atomicity held — publish skipped, no draft release created. |
| **24994332338** | tag push v1.1.0-rc1 | **c0ac407** | **success** (5/5 jobs green) | **Canonical green run** — all 8 VALIDATION criteria #1-#6 closed against this run. |
| 24994622845 | workflow_dispatch | d6db749 | success | `workflow_dispatch` dry run on `main` — 4 jobs green, publish skipped per D-04 if-gate, 3 artifacts on run summary, no new draft release. Closed criterion #7. |

Total wall time across all four runs: ~17 minutes of GHA spend; total maintainer time invested in fix-forward + verification: ~70 minutes.

## Atomicity-audit grep counts (Task 4 — criterion #8)

Static audit of `.github/workflows/release.yml`:

| Sub-condition | Expected | Actual | Result |
|---------------|----------|--------|--------|
| 8(a) `publish.needs` lists all 3 build jobs | 1 line containing `[build-mac, build-win, build-linux]` | line 113 ✓ | PASS |
| 8(b) `publish.if` includes both push event AND tag-ref guard | 2 grep matches | line 115: `github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')` ✓ | PASS |
| 8(c) `if-no-files-found: error` | exactly 3 occurrences | 3 (lines 71, 90, 109) ✓ | PASS |
| 8(d) `fail_on_unmatched_files: true` | exactly 1 occurrence | 1 (line 146) ✓ on SHA-pinned softprops/action-gh-release@v2.6.2 (line 139) | PASS |

Anti-pattern absence audit — all PASS:

| Anti-pattern | Required count | Actual |
|--------------|----------------|--------|
| `GH_TOKEN` literal | 0 | 0 ✓ |
| `GITHUB_TOKEN` literal | 0 | 0 ✓ |
| `apt install libfuse2` (D-17) | 0 | 0 ✓ |
| `actions/cache@*electron-builder*` (D-15) | 0 | 0 ✓ |
| Signing keys (`certificateFile`, `CSC_LINK`, `APPLE_ID`, `notarize`) | 0 | 0 ✓ |
| `latest.yml` / `latest-mac.yml` (Phase 12 territory) | 0 | 0 ✓ |
| Sentry / source-map upload (Phase 13 territory) | 0 | 0 ✓ |

## Per-OS install smoke results (Task 5 — REL-04)

| OS | Status | Evidence |
|----|--------|----------|
| macOS arm64 | **PASS** | App installed to `/Applications`, launched, `defaults read CFBundleShortVersionString` = `1.1.0-rc1`, `codesign -dv` Signature=adhoc, sharp + @img unpacked, Optimize Assets succeeded against `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`. |
| Windows x64 NSIS | **PASS-with-deferred-findings** | App installed via NSIS, launched, read Spine 4.2 JSON with correct Windows backslash paths, **Optimize Assets succeeded 153/153 in 10.7s**. Three pre-existing Windows runtime findings deferred to Phase 12 via `11-WIN-FINDINGS.md`: F1 atlas viewer 404 on `app-image://localhostc/` (path-handling bug); F2 output-folder picker UX confusion (Windows-specific); F3 missing Spine 3.8 detection (silent-fail). |
| Linux x64 AppImage | **DEFERRED** | No Linux host available; deferred to Phase 12 tester rounds with documented rationale. CI-side artifact construction verified by criterion #5 (138 MB AppImage attached to draft release with correct filename). |

## v1.1.0-rc1 release disposition

**Kept as draft.** Tester distribution coordination is Phase 12 territory. The draft remains visible to maintainers via `gh release view v1.1.0-rc1` and downloadable via `gh release download` for ongoing internal smoke.

To flip to published when Phase 12 begins tester rounds:

```bash
gh release edit v1.1.0-rc1 --draft=false
```

## Phase 11 design-gap findings (collateral fixes landed inline)

The live verification gate exposed two design gaps in Plan 11-01 / upstream Phase 9; both were fixed forward inline as the verification was the ONLY way to surface them:

| Finding | Commit | Defense added |
|---------|--------|---------------|
| Phase 9 `sampler-worker-girl.spec.ts` errors on CI because `fixtures/Girl/` is gitignored | `f00e232` | applied `it.skipIf(process.env.CI)(...)` per documented CONTEXT.md authorization |
| Pitfall 1 incomplete: `--publish never` does not stop electron-builder publisher auto-detect from git remote | `c0ac407` | added `publish: null` to `electron-builder.yml` (Phase 12 will replace with a real provider when auto-update lands) |

These two fix-forward commits represent positive-value findings — without Phase 11's live verification, both bugs would have shipped to v1.1.0-rc1 testers.

## Threats — outcome

| Threat ID | Disposition |
|-----------|-------------|
| T-11-01 (GITHUB_TOKEN reachable from build jobs) | **mitigated and verified** — atomicity audit confirms 0 GH_TOKEN/GITHUB_TOKEN literals; the failed run 24994071839 actually proved that the absence of GH_TOKEN aborts the build (which is why the `publish: null` fix was needed) |
| T-11-02 (partial-asset draft release) | **mitigated and verified** — TWO failed runs correctly skipped publish via `needs:` chain; `gh release list` returned `[]` after both failed runs; only the green run produced a draft. Empirically + statically falsifiable. |
| T-11-03 (third-party action SHA drift) | **accepted** — SHAs are immutable git objects; the static audit confirms the literal SHA strings remain pinned. |

## Acceptance — VALIDATION.md checklist

- [x] **#1** — workflow triggered on tag push (queued 3 s after push, run 24994332338)
- [x] **#2** — sequencing test → 3 builds (concurrent at 12:14:29Z) → publish, builds run on macos-14 / windows-2022 / ubuntu-22.04
- [x] **#3** — all 5 jobs `conclusion: success`
- [x] **#4** — `isDraft: true`, `isPrerelease: true`
- [x] **#5** — exactly 3 installer assets (`.dmg` arm64, `.exe` x64, `.AppImage` x86_64), all containing `1.1.0-rc1`
- [x] **#6** — body has 5 expected `## ` headings, 0 unrendered placeholders, `v1.1.0-rc1` literal × 3
- [x] **#7** — workflow_dispatch run 24994622845 produced 3 artifacts, publish skipped, no new draft
- [x] **#8** — atomicity audit passes statically + empirically (4 sub-conditions + anti-pattern absence)
- [x] **REL-04** — macOS PASS, Windows PASS-with-deferrals, Linux deferred-to-Phase-12 with rationale

## Plan 02 commits

| Commit | Subject |
|--------|---------|
| `24d17a3` | docs(11): begin Plan 11-02 wave 2 execution (mark phase active) |
| `f00e232` | fix(11-02): apply CONTEXT.md-authorized .skipIf(CI) to Girl wall-time test |
| `c0ac407` | fix(11-02): set publish:null in electron-builder.yml to defeat auto-detect |
| `d6db749` | docs(11-02): capture v1.1.0-rc1 live tag-push run output (criteria 1-6) |
| `ef8a5dd` | docs(11-02): capture dispatch dry-run + atomicity audit (criteria 7, 8) |
| `1a5b663` | docs(11-02): close REL-04 install smoke; sign off Phase 11 verification |

## Key files

- `.planning/phases/11-ci-release-pipeline-github-actions-draft-release/11-LIVE-VERIFICATION.md` — full evidence record (~470 lines)
- `.planning/phases/11-ci-release-pipeline-github-actions-draft-release/11-WIN-FINDINGS.md` — three Windows runtime findings deferred to Phase 12
- `tests/main/sampler-worker-girl.spec.ts` — `.skipIf(env.CI)` applied
- `electron-builder.yml` — `publish: null` block added

## Self-Check: PASSED

All eight VALIDATION.md falsifiable acceptance criteria closed; REL-04 install smoke complete-with-deferrals on documented-acceptable scope. Phase 11 ready for `/gsd-verify-work 11`.

---
phase: 11
slug: ci-release-pipeline-github-actions-draft-release
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-27
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **Crucial framing (from 11-RESEARCH.md §Validation Architecture):**
> Phase 11 introduces `.github/workflows/release.yml` and `.github/release-template.md`. Neither has any vitest-meaningful behavior. The validation gate is **the live workflow run produces the documented outputs**, not "a unit test asserts the workflow exists." Asserting YAML structure with a unit test is a tautology — it would not catch any of the eight pitfalls documented in RESEARCH.md.
>
> The Wave 0 gate for this phase is "no fake YAML unit tests are introduced," not "all YAML keys are stub-tested." This is a deliberate inversion of the normal Nyquist contract for an infrastructure-only phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.0 (existing) — covers existing TS source, NOT the YAML config |
| **Config file** | `vitest.config.ts` (existing; unchanged in Phase 11) |
| **Quick run command** | `npm run test` (runs in the workflow's `test` job, ~30s) |
| **Full suite command** | `npm run typecheck && npm run test` |
| **Estimated runtime** | ~30s for `npm run test` (331 existing tests, all platform-agnostic) |

---

## Sampling Rate

- **After every task commit:** No new vitest sampling for YAML changes. GHA's syntax validator lints `release.yml` automatically on push (broken YAML surfaces as "Workflow failed to parse" in the Actions tab). For tasks that touch existing TS source (none expected in this phase), normal `npm run test` continues.
- **After every plan wave:** No additional sampling beyond the existing test suite.
- **Before `/gsd-verify-work`:** Existing 331-test suite must remain green (this is the gate the workflow's own `test` job uses). New vitest tests for YAML are explicitly NOT required and should NOT be created.
- **Phase verification gate:** **One live tag push of `v1.1.0-rc1`** + **one `workflow_dispatch` dry run from `main`**. Both must satisfy the falsifiable acceptance criteria below.
- **Max feedback latency:** ~30s for `npm run test`; ~6–10 min for the full live workflow run (test + 3 parallel builds + publish).

---

## Per-Task Verification Map

> Phase 11 plans ship YAML and markdown infrastructure, not runtime code. The conventional unit-test column is replaced with the live verification command that proves the requirement.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Verification Type | Validation Command / Procedure | Status |
|---------|------|------|-------------|------------|-----------------|-------------------|--------------------------------|--------|
| 11-01-* | 01 | 1 | CI-01, CI-03, CI-06 | T-11-01 (token leakage) / — | `GITHUB_TOKEN` scoped to `contents: write`; build jobs do NOT receive token | live workflow run | After workflow lands on `main`: Actions tab → release.yml → Run workflow on `main` → observe `test` + 3 build jobs run, publish job appears "Skipped"; 3 artifacts visible on run summary | ⬜ pending |
| 11-01-* | 01 | 1 | CI-02 | — | — | live workflow run | `gh run view <run-id> --json jobs --jq '[.jobs[] \| select(.name \| startswith("build-"))] \| length'` returns `3`; their `startedAt` timestamps overlap | ⬜ pending |
| 11-01-* | 01 | 1 | CI-04, CI-05, REL-01 | T-11-02 (partial release) / — | `publish` only runs after all 3 builds succeed; uses `softprops/action-gh-release@v2.6.2` with `fail_on_unmatched_files: true` | live tag push | After `git push origin v1.1.0-rc1` workflow completes green: `gh release view v1.1.0-rc1 --json isDraft,assets --jq '{draft: .isDraft, names: [.assets[].name] \| sort}'` returns `isDraft: true` and three filenames containing `.dmg` / `.exe` / `.AppImage` and `1.1.0-rc1` | ⬜ pending |
| 11-02-* | 02 | 1 | REL-02 | — | — | live tag push + `gh release view` | `gh release view v1.1.0-rc1 --json body --jq .body` returns text containing literal `## Summary`, `## New in this version`, `## Known issues`, `## Install instructions`, AND no remaining `${VERSION}` / `${TAG}` / `${INSTALL_DOC_LINK}` placeholders | ⬜ pending |
| 11-03-* | 03 | 2 | REL-04 | — | — | manual install smoke (maintainer first, testers second) | After maintainer flips draft → published: download `.dmg` / `.exe` / `.AppImage` from the public release page, install on respective OS without `git` or Node, follow Phase 10's `10-SMOKE-TEST.md` Optimize Assets recipe | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Note: Plan IDs and task IDs above are placeholders that the planner will refine. The intent is one plan per concern (workflow YAML, template + body rendering, live verification).

---

## Wave 0 Requirements

- [x] **Existing vitest infra is sufficient** — `tests/` directory has 331 passing tests for runtime source. No new test files are needed for Phase 11.
- [x] **No new vitest fixtures required** — the workflow's `test` job runs the existing `npm run test`.
- [x] **`.github/workflows/release.yml`** — does not exist; Phase 11 creates it as the executable artifact under test.
- [x] **`.github/release-template.md`** — does not exist; Phase 11 creates it.
- [ ] **`package.json#scripts.build:mac/win/linux`** — currently invoke `electron-builder --mac dmg` etc. **Recommended Wave 0 patch** per RESEARCH Open Question 1: bake `--publish never` into each script as defense-in-depth against the `electron-builder` `GH_TOKEN` auto-publish trap (Pitfall 2). Planner decides; if applied, this is a single-line edit to three scripts and does NOT touch any test.

> **Anti-Wave-0:** Do NOT create `tests/test_workflow.spec.ts`, `tests/test_release_yml.spec.ts`, or any fixture that parses `release.yml` with `js-yaml` and asserts presence of keys. That kind of test is a tautology — it asserts the YAML matches itself; if the YAML is wrong in a way the test doesn't anticipate, the test passes anyway. The only true Phase 11 verification is end-to-end execution.

---

## Manual-Only Verifications

> Phase 11 is dominated by manual verification because the artifact under test is an executable GHA workflow. There is no in-process simulator and no mock substrate that would meaningfully model GHA's job-graph execution + GitHub Releases API.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tag push triggers workflow | CI-01 | GHA's tag trigger is environmental (cannot fire without a real tag pushed to GitHub) | `git tag v1.1.0-rc1 && git push origin v1.1.0-rc1`; within 30s `gh run list --workflow=release.yml --limit 1` shows a queued/running run for that tag |
| Three platform builds run in parallel | CI-02 | Parallelism is an emergent property of GHA's `needs:` graph + concurrent runner allocation; cannot be unit-tested | `gh run view <run-id> --json jobs` shows `build-mac`, `build-win`, `build-linux` with overlapping `startedAt` timestamps |
| Vitest gates builds (CI-03) | CI-03 | The `needs: test` clause is enforced by GHA, not by the YAML alone | `gh run view <run-id>` shows `test` reaches "Success" before any `build-*` job leaves "Queued" |
| Successful builds → draft release with 3 assets | CI-04, REL-01 | Requires live `softprops/action-gh-release@v2.6.2` + GitHub Releases API call | `gh release view v1.1.0-rc1 --json isDraft,assets` returns `isDraft: true` + 3 assets matching `*-{1.1.0-rc1}-*.{dmg,exe,AppImage}` |
| Failed platform build prevents publish (atomicity) | CI-05 | Requires injecting a deliberate build failure on a side branch | On a side branch, deliberately break one build (e.g. add a syntax error in `electron-builder.yml#mac.target`), push tag `vTEST-rc-fail`, observe: failing job goes red, publish job marked "Skipped", `gh release view vTEST-rc-fail` returns "release not found". Optional/deferred — the happy-path proof from `v1.1.0-rc1` plus a verbal YAML audit (publish job's `needs:` listing all 3 builds) is acceptable for first closure. |
| `workflow_dispatch` dry run produces artifacts but no release | CI-06 | Requires manual click on GitHub UI | Actions → release.yml → "Run workflow" → branch: `main` → observe: `test` + 3 builds run, `publish` shows "Skipped" with reason "if condition not met"; 3 GHA artifacts (`installer-mac`, `installer-win`, `installer-linux`) appear on run summary; `gh release list` shows no new draft |
| Release body renders cleanly | REL-02 | Requires live `envsubst` / `sed` substitution + GHA `fromJSON` etc. | `gh release view v1.1.0-rc1 --json body --jq .body` contains the four expected `##` headings, no remaining placeholder syntax, and `1.1.0-rc1` appears literally |
| Non-developer install works | REL-04 | Requires a clean machine without dev toolchain | Maintainer first: download installer from published release page on a fresh user account / VM; install per the release body's "Install instructions" section; launch app; complete Optimize Assets per `10-SMOKE-TEST.md` recipe. Tester rounds (Phase 12+ via tester distribution) provide the broader sample. |

---

## Falsifiable Acceptance Criteria (Phase Verification Gate)

> Source: 11-RESEARCH.md §"Falsifiable Acceptance Criteria." These are the conditions that must all be TRUE for `/gsd-verify-work 11` to pass.

For Phase 11 to be considered closed, ALL of the following must hold after the first real `v1.1.0-rc1` tag push and the first `workflow_dispatch` dry run:

1. ✅ **Live tag push triggers workflow:** Pushing `v1.1.0-rc1` to `origin` triggers a workflow run within 30 seconds (visible in `gh run list --workflow=release.yml`).
2. ✅ **Job sequencing is correct:** The workflow run shows `test` ⇒ (`build-mac`, `build-win`, `build-linux`) ⇒ `publish`, with the three `build-*` jobs running concurrently after `test` succeeds.
3. ✅ **All four jobs complete green** in the run summary.
4. ✅ **Draft release exists:** `gh release view v1.1.0-rc1 --json isDraft` returns `{"isDraft": true}`.
5. ✅ **Three assets attached:** `gh release view v1.1.0-rc1 --json assets --jq '[.assets[].name] | sort'` returns three filenames containing `.dmg`, `.exe`, `.AppImage` AND `1.1.0-rc1`.
6. ✅ **Body rendered:** `gh release view v1.1.0-rc1 --json body --jq .body` contains the four expected `##` headings AND no literal `${VERSION}` / `${TAG}` / `${INSTALL_DOC_LINK}` placeholder strings.
7. ✅ **Workflow_dispatch dry run:** Manually triggering the workflow on `main` (no tag) produces 3 GHA artifacts on the run summary page; the publish job appears as "Skipped"; no new draft release is created.
8. ✅ **Atomicity audit (verbal/static, not live test):** Maintainer reads the YAML and confirms (a) `publish.needs:` includes all three build jobs, (b) `publish.if:` excludes `workflow_dispatch` and non-tag pushes via `github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')`, (c) build jobs use `if-no-files-found: error` on `actions/upload-artifact@v4`, (d) `softprops/action-gh-release@v2.6.2` uses `fail_on_unmatched_files: true`.

If any of 1–7 fails on the first real run: investigate via `gh run view <id> --log`, fix in a follow-up commit, re-tag with a fresh `v1.1.0-rc2`, re-push. Phase 11 closure waits on a clean run.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — verified by inversion: NO automated tests are appropriate for YAML; manual verifications are explicitly enumerated above
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — N/A; the existing 331-test suite continues to gate the `test` job and is the automated sampling for any TS code that touches this phase (none expected)
- [x] Wave 0 covers all MISSING references — three new files (release.yml, release-template.md, optional package.json script update) are the entire scope; no test fixtures missing
- [x] No watch-mode flags — `npm run test` (vitest run, not vitest watch) is the canonical command; the workflow's `test` job uses the same
- [x] Feedback latency < 600s (10 min worst case for full live workflow run) — acceptable for a tag-triggered release pipeline (low frequency)
- [x] `nyquist_compliant: true` set in frontmatter — yes; the deliberate framing is "manual-only verification is the correct sampling for this phase"

**Approval:** approved 2026-04-27 (initial; revisable after first real `v1.1.0-rc1` run)

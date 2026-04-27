---
phase: 11
plan: 02
status: in-progress
tag: v1.1.0-rc1
started: "2026-04-27T11:58:18Z"
---

# Phase 11 — Live Verification Record

**Tag:** v1.1.0-rc1
**Workflow run ID:** _pending Task 2_
**Workflow run URL:** _pending Task 2_
**Started:** 2026-04-27T11:58:18Z
**Duration:** _pending Task 2_

## Pre-flight (Task 1)

Captured 2026-04-27T11:58:18Z. Local HEAD `24d17a3` (after committing the STATE.md `state.begin-phase` tracking update on top of `93cb97b` and pushing main to origin so the workflow file is present remotely when the tag fires).

```
===== gh auth status =====
github.com
  ✓ Logged in to github.com account Dzazaleo (keyring)
  - Active account: true
  - Git operations protocol: https
  - Token: gho_************************************
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'

===== git remote get-url origin =====
https://github.com/Dzazaleo/Spine_Texture_Manager.git

===== git rev-parse --abbrev-ref HEAD =====
main

===== git status --porcelain (empty = clean) =====
(empty after committing state.begin-phase update)

===== git log -3 --oneline =====
24d17a3 docs(11): begin Plan 11-02 wave 2 execution (mark phase active)
93cb97b docs(11-01): complete CI release pipeline file-authoring plan
c253eb6 feat(11-01): add .github/workflows/release.yml — tag-triggered cross-platform CI with atomic draft-release publish (CI-01..CI-06, REL-01, REL-02)

===== git log -1 --format='%H %s' .github/workflows/release.yml =====
c253eb6ee0ddf87c4ec1bfb4909863789ee67e11 feat(11-01): add .github/workflows/release.yml — tag-triggered cross-platform CI with atomic draft-release publish (CI-01..CI-06, REL-01, REL-02)

===== git log -1 --format='%H %s' .github/release-template.md =====
eb8a9048279fc09b2c388b4131d979111906f314 feat(11-01): add .github/release-template.md (REL-02 envsubst-rendered release notes)

===== git log origin/main..HEAD --oneline (empty = local in sync with remote) =====
(empty — pushed 24d17a3 to origin/main)

===== git ls-remote --tags origin v1.1.0-rc1 (empty = tag does not exist on remote) =====
(empty)

===== git tag --list v1.1.0-rc1 (empty = tag does not exist locally) =====
(empty)

===== node -p "require('./package.json').version" =====
1.1.0-rc1

===== HEAD SHA =====
24d17a39d672424b0cec0ae2a865a5984cc9d1da
```

### Acceptance — Task 1

- [x] `gh auth status` reports authenticated `Dzazaleo` with `repo` + `workflow` scopes.
- [x] `git remote get-url origin` returns the canonical https URL.
- [x] `git rev-parse --abbrev-ref HEAD` = `main`.
- [x] `git status --porcelain` is empty (clean working tree).
- [x] `git log origin/main..HEAD` is empty (local main fully pushed).
- [x] `git ls-remote --tags origin v1.1.0-rc1` is empty.
- [x] `git tag --list v1.1.0-rc1` is empty.
- [x] `node -p "require('./package.json').version"` = `1.1.0-rc1` (version-guard will pass).
- [x] User explicitly approved the tag push (resume signal accepted via /gsd-execute-phase 11 --wave 2 interactive checkpoint).

## Tag-push run (Task 2)

The first two tag-push runs surfaced **two real Phase 11 design gaps**, both
caught cleanly by the workflow's atomicity-by-construction (publish skipped,
no draft release created). Both were fixed forward inline; the third run
landed all eight criteria.

### Failed run #1 — id 24993716580 (commit 24d17a3)

- Pushed: 2026-04-27T11:59:38Z; queued: 2026-04-27T11:59:41Z (Δ=3s — well under criterion #1's 30s budget).
- Failure: `tests/main/sampler-worker-girl.spec.ts` — warmup returned `error` instead of `complete`.
- Root cause: `fixtures/Girl/` is gitignored as a licensed third-party rig (.gitignore L22), so the fixture file does not exist on CI runners. The test's own header (lines 8 + 23-25) already documented `CONTEXT.md authorizes .skipIf(env.CI)` — the gate just wasn't applied yet.
- Atomicity verdict: builds + publish all skipped due to `needs:` chain; no draft release created. `gh release list` returned `[]`.
- Fix: commit `f00e232` — applied `.skipIf(process.env.CI)` to the Girl wall-time test.
- Tag rotated, run re-fired.

### Failed run #2 — id 24994071839 (commit f00e232)

- Pushed: 2026-04-27T12:07:35Z; queued: 2026-04-27T12:07:38Z (Δ=3s).
- `test` job: SUCCESS (Girl skip held). All 3 builds started concurrently at 12:08:53Z and failed within ~2 minutes with the SAME error on each:
  - `⨯ GitHub Personal Access Token is not set, neither programmatically, nor using env "GH_TOKEN"`
- Root cause: Pitfall 1 design gap. `--publish never` (Plan 01's defense) only stops the upload step. Even with `--publish never` on the CLI AND no `publish:` block in `electron-builder.yml`, electron-builder's publisher auto-detection runs at build-prep time and infers `provider: github` from the `git remote`. It then aborts when GH_TOKEN is absent. RESEARCH.md L606 only warned against ADDING a publish block (which would generate `latest.yml`); it didn't account for the auto-detect-from-git-remote path.
- Atomicity verdict: publish skipped, `gh release list` returned `[]` again.
- Fix: commit `c0ac407` — added `publish: null` to `electron-builder.yml` to explicitly disable publisher auto-detection. Per electron-builder docs this disables ALL publishers without registering github (so no `latest.yml` is generated — Phase 11 vs 12 boundary preserved).
- Tag rotated, run re-fired.

### Successful run — id 24994332338 (commit c0ac407) ✓

- Pushed: 2026-04-27T12:13:29Z; queued: 2026-04-27T12:13:32Z (Δ=3s).
- URL: https://github.com/Dzazaleo/Spine_Texture_Manager/actions/runs/24994332338
- Total wall time: 12:13:32Z → 12:17:20Z = **3 min 48 s** (well under 25 min budget).

#### Job sequencing & concurrency

```json
[
  {"name":"test",        "conclusion":"success","startedAt":"2026-04-27T12:13:35Z","completedAt":"2026-04-27T12:14:27Z"},
  {"name":"build-mac",   "conclusion":"success","startedAt":"2026-04-27T12:14:29Z","completedAt":"2026-04-27T12:15:24Z"},
  {"name":"build-linux", "conclusion":"success","startedAt":"2026-04-27T12:14:29Z","completedAt":"2026-04-27T12:15:25Z"},
  {"name":"build-win",   "conclusion":"success","startedAt":"2026-04-27T12:14:29Z","completedAt":"2026-04-27T12:16:52Z"},
  {"name":"publish",     "conclusion":"success","startedAt":"2026-04-27T12:16:55Z","completedAt":"2026-04-27T12:17:19Z"}
]
```

- All 3 build jobs share the SAME `startedAt` of `2026-04-27T12:14:29Z` (concurrent — CI-02 ✓).
- `test.completedAt` = `12:14:27Z` precedes `min(build-*.startedAt)` = `12:14:29Z` by 2 s (CI-03: vitest gates builds ✓).
- All 5 jobs `conclusion: success` (criterion #3 ✓).

#### Draft release audit

```bash
$ gh release view v1.1.0-rc1 --json isDraft --jq .isDraft
true                                                                # criterion #4 ✓

$ gh release view v1.1.0-rc1 --json isPrerelease --jq .isPrerelease
true                                                                # auto-flagged because tag contains "-"

$ gh release view v1.1.0-rc1 --json assets --jq '[.assets[].name] | sort'
[
  "Spine.Texture.Manager-1.1.0-rc1-arm64.dmg",
  "Spine.Texture.Manager-1.1.0-rc1-x64.exe",
  "Spine.Texture.Manager-1.1.0-rc1-x86_64.AppImage"
]                                                                   # criterion #5 ✓ — 3 assets, one per OS, all containing 1.1.0-rc1
                                                                    # Note: spaces in productName are rendered as dots in filenames
                                                                    # by electron-builder's artifactName template.

$ gh release view v1.1.0-rc1 --json body --jq .body | grep -cE '^## (Summary|New in this version|Known issues|Install instructions|Tag)$'
5                                                                   # criterion #6 partial ✓ — all 4 REL-02 sections + Tag footer

$ gh release view v1.1.0-rc1 --json body --jq .body | grep -cE '\$\{(VERSION|TAG|INSTALL_DOC_LINK)\}'
0                                                                   # criterion #6 ✓ — envsubst rendered cleanly, no unrendered placeholders

$ gh release view v1.1.0-rc1 --json body --jq .body | grep -c "v1.1.0-rc1"
3                                                                   # rendered: header, install bullet, Tag footer
```

Body excerpt (proves envsubst rendering):

```
# Spine Texture Manager v1.1.0-rc1

## Summary
<!-- One-line summary of what this release contains. Edit before publishing. -->

## New in this version
...

## Install instructions
- **macOS (Apple Silicon):** Download the `.dmg`. ... "Open Anyway" ...
- **Windows (x64):** Download the `.exe`. ... "Run anyway" ...
- **Linux (x64):** Download the `.AppImage`. ... `chmod +x ...` ... `libfuse2t64`.

For full install instructions: https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/README.md

## Tag
This release was built from tag `v1.1.0-rc1`.
```

### Acceptance — Task 2

- [x] **#1** — workflow triggered on tag push (queued 3 s after push for run 24994332338).
- [x] **#2** — sequencing test → 3 builds (concurrent) → publish, verified by `startedAt`/`completedAt` deltas.
- [x] **#3** — all 5 jobs `conclusion: success`.
- [x] **#4** — `isDraft: true` (`isPrerelease: true` bonus from `-rc1` tag suffix).
- [x] **#5** — exactly 3 installer assets (`.dmg` arm64, `.exe` x64, `.AppImage` x86_64), all containing `1.1.0-rc1`.
- [x] **#6** — body has 5 expected `## ` headings, 0 unrendered `${VERSION}` / `${TAG}` / `${INSTALL_DOC_LINK}` placeholders, `v1.1.0-rc1` literal appears 3×.

### Phase 11 design-gap findings (collateral fixes landed inline)

| Finding | Commit | Discovered by | Defense added |
|---------|--------|---------------|---------------|
| `tests/main/sampler-worker-girl.spec.ts` errors on CI because `fixtures/Girl/` is gitignored — test had documented but unapplied `.skipIf(env.CI)` authorization | `f00e232` | failed run 24993716580 (test job) | applied `it.skipIf(process.env.CI)(...)` |
| Pitfall 1 incomplete: `--publish never` does not stop electron-builder's publisher auto-detect from `git remote` at build-prep time | `c0ac407` | failed run 24994071839 (all 3 build jobs) | added `publish: null` to `electron-builder.yml` (Phase 12 will replace with a real provider when auto-update lands) |

## Workflow_dispatch dry run (Task 3)

_pending Task 3_

## Atomicity audit (Task 4)

_pending Task 4_

## REL-04 install smoke (Task 5)

_pending Task 5_

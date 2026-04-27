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

Triggered: `gh workflow run release.yml --ref main` at 2026-04-27T12:19:56Z (HEAD commit `d6db749`).
Run ID: `24994622845` (created 12:19:57Z).
URL: https://github.com/Dzazaleo/Spine_Texture_Manager/actions/runs/24994622845
Wall time: 12:19:57Z → 12:23:55Z = **3 min 58 s**.

### Job conclusions

```json
[
  {"name":"test",        "conclusion":"success"},
  {"name":"build-mac",   "conclusion":"success"},
  {"name":"build-linux", "conclusion":"success"},
  {"name":"build-win",   "conclusion":"success"},
  {"name":"publish",     "conclusion":"skipped"}
]
```

The `publish` job is `skipped` because its `if:` condition

```yaml
if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')
```

evaluates to `false` for `workflow_dispatch` events (where `github.event_name == 'workflow_dispatch'` and `github.ref == 'refs/heads/main'`). This is decision D-04 working exactly as designed — the dry run can exercise the entire build matrix without ever touching the Releases API.

### Artifacts on the run summary

`gh run view --json artifacts` is not exposed by the gh CLI; querying the underlying API instead:

```bash
$ gh api repos/Dzazaleo/Spine_Texture_Manager/actions/runs/24994622845/artifacts \
    --jq '[.artifacts[] | {name, size_in_bytes}] | sort_by(.name)'
[
  {"name":"installer-linux", "size_in_bytes": 138318564},
  {"name":"installer-mac",   "size_in_bytes": 125321448},
  {"name":"installer-win",   "size_in_bytes": 107935910}
]
```

Three artifacts, exactly the names specified in the workflow file. Sizes match the tag-push run (24994332338) within ~30 bytes — the only difference is the embedded commit SHA in the binary, which is expected.

### No new draft release was created

```bash
$ gh release list --limit 5 --json tagName,isDraft
[{"isDraft":true,"tagName":"v1.1.0-rc1"}]
```

Only the v1.1.0-rc1 draft from Task 2 is present. The dispatch did NOT create any new release entry.

### Acceptance — Task 3

- [x] **#7** — workflow_dispatch dry run produced 3 inspectable artifacts (`installer-mac`, `installer-win`, `installer-linux`); `publish` job appears as `skipped`; no new draft release was created.

## Atomicity audit (Task 4)

Static / verbal audit of `.github/workflows/release.yml` against criterion #8's four sub-conditions plus the documented anti-pattern absence list. Captured 2026-04-27.

```bash
$ YAML=.github/workflows/release.yml

# 8(a) publish.needs lists all 3 build jobs
$ grep -n -A1 '^  publish:' $YAML | head -10
112:  publish:
113-    needs: [build-mac, build-win, build-linux]
$ grep -nE '^    needs:.*build-mac.*build-win.*build-linux' $YAML
113:    needs: [build-mac, build-win, build-linux]

# 8(b) publish.if includes both push event AND tag-ref guard
$ grep -n "github.event_name == 'push'" $YAML
39:        if: github.event_name == 'push'                         # version-guard step (build-time)
115:    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')   # publish job
$ grep -n "startsWith(github.ref, 'refs/tags/v')" $YAML
115:    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')

# 8(c) build jobs use if-no-files-found: error
$ grep -c 'if-no-files-found: error' $YAML
3
$ grep -n 'if-no-files-found: error' $YAML
71:          if-no-files-found: error
90:          if-no-files-found: error
109:          if-no-files-found: error

# 8(d) softprops uses fail_on_unmatched_files: true (SHA-pinned)
$ grep -c 'fail_on_unmatched_files: true' $YAML
1
$ grep -n 'fail_on_unmatched_files: true' $YAML
146:          fail_on_unmatched_files: true
$ grep -n 'softprops/action-gh-release@' $YAML
139:        uses: softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65  # v2.6.2

# Anti-patterns absent
$ grep -c 'GH_TOKEN' $YAML            ;# expect 0
0
$ grep -c 'GITHUB_TOKEN' $YAML        ;# expect 0
0
$ grep -E 'apt[- ]get?\s+install.*libfuse2' $YAML || echo ok
ok                                    # D-17 — no FUSE install at build time
$ grep -E 'actions/cache@.*electron-builder' $YAML || echo ok
ok                                    # D-15 — no electron-builder cache in v1.1
$ grep -E '(certificateFile|CSC_LINK|APPLE_ID|notarize)' $YAML || echo ok
ok                                    # No paid signing keys in v1.1
$ grep -E '(latest\.yml|latest-mac\.yml)' $YAML || echo ok
ok                                    # Phase 12 territory — auto-update not in scope
$ grep -iE '(sentry|source-?map.*upload)' $YAML || echo ok
ok                                    # Phase 13 territory — crash reporting not in scope
```

### Acceptance — Task 4

- [x] **8(a)** — `publish.needs` includes `build-mac`, `build-win`, `build-linux` (line 113).
- [x] **8(b)** — `publish.if` combines `github.event_name == 'push'` AND `startsWith(github.ref, 'refs/tags/v')` (line 115).
- [x] **8(c)** — `if-no-files-found: error` appears exactly **3** times (lines 71, 90, 109 — one per build job's `actions/upload-artifact` step).
- [x] **8(d)** — `fail_on_unmatched_files: true` appears **1** time (line 146) inside the publish job's SHA-pinned `softprops/action-gh-release@v2.6.2` step (line 139).

### Anti-pattern absence audit (bonus)

- [x] No `GH_TOKEN` literal anywhere (Pitfall 1 / T-11-01 — environment-level mitigation).
- [x] No `GITHUB_TOKEN` literal anywhere.
- [x] No `apt install libfuse2` (D-17 — FUSE is install-time, not build-time).
- [x] No `actions/cache@*` for electron-builder cache (D-15 — Phase 12 concern).
- [x] No signing key references (`certificateFile`, `CSC_LINK`, `APPLE_ID`, `notarize` all absent).
- [x] No `latest.yml` / `latest-mac.yml` references (Phase 12 — auto-update territory).
- [x] No Sentry / source-map upload references (Phase 13 — crash reporting territory).

### Live verification confirms the static audit

The successful run 24994332338 + dispatch run 24994622845 confirm all four 8(*) sub-conditions held in production:

- **8(a)** — `publish` actually waited for all 3 builds (started at `12:16:55Z`, after the slowest build `build-win` finished at `12:16:52Z`).
- **8(b)** — `publish` ran on tag-push (24994332338) but was `skipped` on `workflow_dispatch` (24994622845).
- **8(c)** — both runs uploaded all 3 artifacts; the `if-no-files-found: error` setting was never triggered because builds always emitted ≥ 1 matching file.
- **8(d)** — `fail_on_unmatched_files: true` is in place; not exercised because all 3 download-artifact paths matched.

Combined with the **two failed runs** earlier in Task 2 (24993716580 and 24994071839) — which both correctly skipped publish because of upstream test/build failures — the atomicity-by-construction is proven empirically as well as statically. **T-11-02 (partial-asset draft release) is mitigated and verifiable.**

## REL-04 install smoke (Task 5)

_pending Task 5_

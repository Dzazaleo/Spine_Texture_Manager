# Plan 15-04 Task 2 — D-07 Gate 2 CI workflow_dispatch dry-run evidence

**Date captured:** 2026-04-29
**Plan:** 15-04 (Phase 15 release engineering)
**Task:** 2 (D-07 Gate 2 — CI workflow_dispatch dry run on feature branch)

## Run identifiers

| Field | Value |
|-------|-------|
| Run ID | `25120466914` |
| Workflow | `release.yml` |
| Event | `workflow_dispatch` |
| Branch | `feat/v1.1.2-mac-zip` |
| Conclusion | `success` |
| Run URL | https://github.com/Dzazaleo/Spine_Texture_Manager/actions/runs/25120466914 |

## Job-level outcomes

| Job | Outcome | Wall time |
|-----|---------|-----------|
| Test (ubuntu-latest) | success | (matrix leg of test job) |
| Test (windows-2022) | success | (matrix leg of test job) |
| Test (macos-14) | success | (matrix leg of test job) |
| build-linux | success | (parallel) |
| build-win | success | 2m 9s |
| build-mac | success | 2m 24s |
| publish | **skipped** (correctly — `if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')` gate at release.yml:127 evaluated false) | 0s |

## Publish-leak grep guard

```
gh run view 25120466914 --log | grep -iE "(GitHub Personal Access Token|asset_already_exists|publish provider)" | wc -l
=> 0
```

No leak indicators present in the CI log. Publish job correctly never executed.

## Artifact verification — installer-mac (the gated dual-installer change)

Downloaded via `gh run download 25120466914 --name installer-mac --dir /tmp/dry-run`:

| File | Size (bytes) |
|------|--------------|
| `Spine Texture Manager-1.1.2-arm64.dmg` | 125,849,315 |
| `Spine Texture Manager-1.1.2-arm64.zip` | 121,848,100 |
| `latest-mac.yml` | 539 |

`latest-mac.yml` shape (verified via js-yaml):

- `version`: `1.1.2`
- `files.length`: 2
- `files[0].url`: `Spine Texture Manager-1.1.2-arm64.zip` (size 121,848,100 — byte-matches CI binary)
- `files[1].url`: `Spine Texture Manager-1.1.2-arm64.dmg` (size 125,849,315 — byte-matches CI binary)
- `path === files[0].url`: true (top-level `path` points at the .zip per electron-updater 6.8.3 mac-fastest-channel contract)
- `sha512 === files[0].sha512`: true (top-level sha512 is the .zip's sha512)

CI YAML byte-for-byte sizes match CI binary byte counts on both .dmg and .zip — D-03 dual-installer mac extension from Plan 15-02 is verified live across the CI seam.

Note: CI binary bytes differ from local Task 1 binaries (`.dmg`: CI 125,849,315 vs local 124,647,101; `.zip`: CI 121,848,100 vs local 120,640,051). This is **expected** — macos-14 GitHub runners build with different timestamps, temp paths, and runner-specific environment than local. The byte-for-byte invariant that matters is **per-build internal consistency** between the YAML and the binaries it advertises, which holds in both environments.

## Artifact verification — installer-win (sibling regression check)

| File | Present |
|------|---------|
| `Spine Texture Manager-1.1.2-x64.exe` | Yes |
| `latest.yml` | Yes |
| `*.zip` | **NO** (correct — .zip leak guard from Plan 15-03 release.yml `installer-win` upload glob is end-anchored) |

## Artifact verification — installer-linux (sibling regression check)

| File | Present |
|------|---------|
| `Spine Texture Manager-1.1.2-x86_64.AppImage` | Yes |
| `latest-linux.yml` | Yes |
| `*.zip` | **NO** (correct — .zip leak guard) |

## Annotations (informational, not failures)

GitHub Actions deprecation warnings for Node.js 20 in `actions/checkout@34e114876b...` and `actions/setup-node@49933ea5288c...`. Pinned-by-SHA actions; deprecation is by upstream removing Node 20 from runners on 2026-09-16 per https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/. Not a Phase 15 concern; remediation is a future infrastructure-care plan.

## Gate result

**D-07 Gate 2: GREEN.** CI seam end-to-end verified for the dual-installer mac extension. Publish job correctly skipped. Sibling Windows + Linux artifacts clean. Ready for CHECKPOINT 1.

## Branch state

`feat/v1.1.2-mac-zip` retained on origin per plan §"Anti-pattern guards" (keep for ~24h post-publication for debugging context; can be deleted in Plan 15-04 close-out or via `git push origin --delete feat/v1.1.2-mac-zip` after Phase 15 closes).

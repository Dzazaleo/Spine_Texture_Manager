---
phase: 15
plan: 15-04
artifact: recovery-evidence
status: resolved
resolved_date: 2026-04-29
classification: Rule 4 architectural deviation (planning bug)
---

# Plan 15-04 Task 4 — Tag-Base Bug + Recovery Evidence

## Summary

Plan 15-04 Task 4 (`Create local annotated v1.1.2 tag pointing at chore(15-01) version-bump commit`) was executed as written, tagging `v1.1.2` at `abf7a32` (the `chore(15-01)` version-bump commit). The plan inherited this tag-target convention from Plan 13-05 Task 2 verbatim (`git tag -a v1.1.1 612ba60 -m "..."` — tag at the version-bump commit).

**This convention was correct for Phase 13** (where the version-bump commit and the CI workflow surface were on the same merged feature branch by the time the tag was created), **but was wrong for Phase 15**: the `chore(15-01)` commit landed BEFORE the wave-1 merges of Plans 15-02 and 15-03 — and Plan 15-03 added the `release/*.zip` + `assets/*.zip` glob to `.github/workflows/release.yml` (commit `1925ebd`, the D-05 fix). Tagging at `abf7a32` therefore built the v1.1.2 release artifacts off a snapshot that PRE-DATES the CI glob fix that uploads the macOS `.zip` swap medium.

**Observable symptom:** the CI run from the bad tag (run 25123566411) succeeded, but the produced draft Release had only 6 of 7 expected assets — `Spine.Texture.Manager-1.1.2-arm64.zip` was built locally on the macos-14 runner but not uploaded, because the `release/*.zip` glob did not exist in the workflow at that commit. UPDFIX-01 would not have been closed by publishing this Release.

## Classification: Rule 4 architectural deviation

This is a **Rule 4 deviation** under the GSD `<deviation_rules>` framework — it required a user-approved decision because the recovery had multiple valid options with different blast radii (Option A: full destructive recovery; Option B: amend the workflow to also upload mac `.zip` from a different glob pattern; Option C: upload the missing asset manually via `gh release upload`).

The user selected **Option A — full destructive recovery** (delete bad draft Release + delete tag local & remote + re-tag at HEAD + re-push → fresh CI). This was selected over Options B/C because:

- Option B would have required a workflow patch + a v1.1.3 tag, polluting the milestone history.
- Option C (manual asset upload) would have produced a Release where 6 assets were built on commit `abf7a32` and 1 asset was uploaded out-of-band, breaking the CI atomicity invariant the D-05/D-10 architecture exists to enforce.
- Option A produces a clean, fully-CI-built 7-asset Release pointing at a tag whose commit history actually includes all v1.1.2 fixes.

## Recovery sequence executed (2026-04-29)

| # | Step | Verification |
|---|------|--------------|
| 1 | `gh release delete v1.1.2 --yes` | `gh release view v1.1.2` → "release not found" |
| 2 | `git push origin :refs/tags/v1.1.2` | `git ls-remote --tags origin v1.1.2` → empty |
| 3 | `git tag -d v1.1.2` | `git tag --list v1.1.2` → empty |
| 4 | `git tag -a v1.1.2 -m "v1.1.2 — macOS .zip auto-update fix" 78c882a` | tag created at HEAD; all ancestor invariants pass (see below) |
| 5 | `git push origin v1.1.2` | `[new tag] v1.1.2 -> v1.1.2`; remote resolves to commit `78c882a` |

## Pre-recovery vs post-recovery invariants

| Invariant | Pre-recovery (bad tag at `abf7a32`) | Post-recovery (good tag at `78c882a`) |
|-----------|-------------------------------------|---------------------------------------|
| Tag is annotated | Yes | Yes (`tag Leo`) |
| Tag SHA target (commit) | `abf7a32` | `78c882a` |
| Wave-1 merge `0021c05` is ancestor | NO (predates merge) | YES |
| Wave-1 merge `bf2db64` is ancestor | NO (predates merge) | YES |
| Wave-1 merge `56434b5` is ancestor | NO (predates merge) | YES |
| **CI glob fix `1925ebd` is ancestor** | **NO (the bug)** | **YES (the fix)** |
| Draft Release asset count | 6 | 7 |
| Draft Release contains `Spine.Texture.Manager-1.1.2-arm64.zip` | NO | YES (size: 121848100) |

## Post-recovery CI run

| Field | Value |
|-------|-------|
| Run ID | 25124327224 |
| Workflow | release.yml |
| Event | push |
| Tag | v1.1.2 |
| Started | 2026-04-29T17:38:47Z |
| Completed | 2026-04-29T17:42:21Z |
| Duration | ~3.5 min |
| Conclusion | success |
| URL | https://github.com/Dzazaleo/Spine_Texture_Manager/actions/runs/25124327224 |
| Log scan: `asset_already_exists` / `HTTP 422` / `publish race` / `Personal Access Token` / `EMIT_LATEST_YML_REPO_ROOT_OVERRIDE` | 0 matches each (clean) |

## Post-recovery 7-asset draft Release

| # | Asset | Size (bytes) |
|---|-------|--------------|
| 1 | Spine.Texture.Manager-1.1.2-arm64.dmg | 125,849,398 |
| 2 | **Spine.Texture.Manager-1.1.2-arm64.zip** (the missing one) | 121,848,100 |
| 3 | Spine.Texture.Manager-1.1.2-x64.exe | 109,069,422 |
| 4 | Spine.Texture.Manager-1.1.2-x86_64.AppImage | 139,237,311 |
| 5 | latest-mac.yml | 539 |
| 6 | latest.yml | 367 |
| 7 | latest-linux.yml | 383 |

NO `.blockmap` files present (RESEARCH §Risk #2 verified).

## `latest-mac.yml` shape verification (UPDFIX-01 invariant)

```yaml
version: 1.1.2
files:
  - url: Spine Texture Manager-1.1.2-arm64.zip
    sha512: juGm8KbEcVnz2uAtmbr5D64Fiz+HViwnU/GNRxZx7vTmGdG5isfGGQY9XTUxEZbkZGEv/St3Wq/65Vb1iLzFrw==
    size: 121848100
  - url: Spine Texture Manager-1.1.2-arm64.dmg
    sha512: eXebyh6fA1K8XjnIOVRhnRvYOBkAh057HM2rJfWm9MfVdgb0cv3OKGzyQrgTQCIaFS45y3sIliCds0FW7JuD2g==
    size: 125849398
path: Spine Texture Manager-1.1.2-arm64.zip
sha512: juGm8KbEcVnz2uAtmbr5D64Fiz+HViwnU/GNRxZx7vTmGdG5isfGGQY9XTUxEZbkZGEv/St3Wq/65Vb1iLzFrw==
releaseDate: '2026-04-29T17:41:34.312Z'
```

- `files[]` has 2 entries: `.zip` first (Squirrel.Mac swap medium), `.dmg` second (install medium).
- Top-level `path` mirrors `files[0].url` (the `.zip`).
- Top-level `sha512` mirrors `files[0].sha512`.
- This is the exact UPDFIX-01 fix shape (Phase 15 RESEARCH §A5).

## Lesson for future planning

When tagging a milestone release that includes infrastructure changes to the CI workflow itself (`.github/workflows/release.yml`), the tag target must be the commit AFTER all such workflow-affecting commits land on the release branch — NOT the version-bump commit at the front of the release sequence. The Plan 13-05 precedent of "tag at the version-bump commit" was implicitly relying on the fact that v1.1.1 did not modify CI infrastructure. Plan 15-03 broke that invariant by adding the D-05 glob fix to the workflow itself. Future milestone plans whose CI surface changes mid-milestone must either:

1. Land the version-bump as the LAST commit in the release sequence (refactor sequencing), or
2. Tag at HEAD of the release branch after all merges land (general convention), or
3. Document explicitly which commit the tag must point at, including a `git merge-base --is-ancestor` invariant check for any CI-affecting commit landed elsewhere in the milestone.

This recovery report is the audit trail for the eventual 15-04-SUMMARY.md `## Deviations from Plan` section.

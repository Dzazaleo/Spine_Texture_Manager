---
phase: 15
plan: 15-04
artifact: release-body-evidence
status: authored-pre-publish
authored_date: 2026-04-29
release_state_at_authoring: draft (isDraft=true; isPrerelease=false)
---

# Plan 15-04 Task 6 — v1.1.2 Release Body Authoring Evidence

This file captures the byte-identical content of the v1.1.2 GitHub Release body
as authored at the close of Plan 15-04 Task 6, immediately before CHECKPOINT 3.
Saved here so the body content has an audit-trail commit in the repository even
though the actual update happened via `gh release edit v1.1.2 --notes-file ...`
on the GitHub API.

## REL-02 contract sections present

1. `## Summary`
2. `## New in this version`
3. `## Known issues` (with verbatim Phase 13 D-04 stranded-rc callout per Plan 15-04 D-09)
4. `## Install instructions` (byte-identical to v1.1.1 per CLAUDE.md INSTALL.md drag-to-Applications convention)

Plus preserved template footer: `## Tag` (carried over from `.github/release-template.md`).

## Cross-references

- **D-09 source for stranded-rc callout:** `.planning/milestones/v1.1-phases/13-v1-1-1-polish-phase-12-1-carry-forwards/13-05-PLAN.md` lines 482 + 500 (verbatim wording for v1.1.1; only the version number `v1.1.1` → `v1.1.2` changes — the rc1/rc2/rc3 audience is unchanged).
- **`Release tag conventions` link target:** `CLAUDE.md` `## Release tag conventions` section (the dot-separated `rc.N` vs flat `rcN` documentation that was added in Phase 13 D-04).
- **Sequoia Gatekeeper note source:** `.planning/phases/15-build-feed-shape-fix-v1-1-2-release/15-RESEARCH.md` §Risk #3 (expected post-relaunch UX for ad-hoc-signed builds).

## Verbatim body content (as posted to v1.1.2 draft Release on 2026-04-29)

```markdown
# Spine Texture Manager v1.1.2

## Summary

v1.1.2 hotfix release — closes 4 auto-update reliability defects observed live on shipped v1.1.1 (Phases 14 + 15 of the v1.1.2 milestone).

## New in this version

- macOS auto-update now successfully downloads and relaunches into newer versions (closes UPDFIX-01: Squirrel.Mac requires both `.dmg` and `.zip`; releases now ship the `.zip` swap medium alongside the existing `.dmg` install asset).
- Windows update notification reliably surfaces a working Download (or Open Release Page) button on every check, including after dismissing a previous notification (closes UPDFIX-02).
- Cold-start auto-check fires on every launch on both macOS and Windows (closes UPDFIX-03).
- `Help → Check for Updates` works before any project file is loaded (closes UPDFIX-04).

## Known issues

- **Stranded `v1.1.0-rcN` testers (rc1, rc2, or rc3):** the auto-updater couldn't reach you due to a naming bug fixed in this version. Please download `v1.1.2` manually from the assets list below — after upgrading, all future auto-updates work normally. (Root cause: `electron-updater@6.x` GitHub provider channel-matching treats `rc1` / `rc2` / `rc3` as opaque tokens because they lack a dot before the number. Fixed convention documented in `CLAUDE.md` `## Release tag conventions`.)
- macOS Sequoia: after auto-update relaunch, Gatekeeper may show an "Open Anyway" prompt — this is normal for ad-hoc-signed builds. Right-click the app icon → Open. The relaunched app shows the new version in Help → About.
- Linux auto-update lifecycle observation pending host availability (Phase 13.1 deferred carry-forward).

## Install instructions

See [INSTALL.md](https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md) for per-OS install + first-launch instructions.

## Tag

This release was built from tag `v1.1.2`.
```

## Acceptance criteria verification (all OK)

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Body contains "Stranded `v1.1.0-rcN` testers" wording (D-09 callout) | OK |
| 2 | Body contains "Release tag conventions" reference (CLAUDE.md cross-link) | OK |
| 3 | Body has 4+ `## ` sections (the 4 REL-02 + ## Tag footer = 5) | OK |
| 4 | Body mentions Sequoia "Open Anyway" Gatekeeper UX | OK |
| 5 | `isDraft=true` (NOT published — gated by CHECKPOINT 3) | OK |
| 6 | `isPrerelease=false` (final, not RC) | OK |
| 7 | 7 assets still attached (no asset removal/upload) | OK |

## Diff vs v1.1.1 release body

The two bodies share identical structure. Substantive differences:

| Section | v1.1.1 | v1.1.2 |
|---------|--------|--------|
| `## Summary` one-liner | "v1.1.1 maintenance release — closes the 4 v1.1.1 polish carry-forwards from Phase 12.1 (cosmetic Windows fixes + release-tag-naming convention docs)." | "v1.1.2 hotfix release — closes 4 auto-update reliability defects observed live on shipped v1.1.1 (Phases 14 + 15 of the v1.1.2 milestone)." |
| `## New in this version` bullets | 3 bullets covering autoHideMenuBar, win32 4-component version padding, release-tag conventions docs | 4 bullets covering UPDFIX-01 macOS auto-update, UPDFIX-02 Windows notification button, UPDFIX-03 cold-start auto-check, UPDFIX-04 `Help → Check` from idle |
| `## Known issues` stranded-rc callout | Verbatim, version-stamped `v1.1.1` | Byte-identical wording, version-stamped `v1.1.2` (only the version number changes — the rc1/rc2/rc3 audience is unchanged) |
| `## Known issues` Sequoia note | Absent (v1.1.1 had no auto-update relaunch path; .zip not shipped) | Added per RESEARCH §Risk #3 (UPDFIX-01 introduces auto-update relaunch on macOS) |
| `## Known issues` Linux note | Absent (Phase 13 had not yet deferred Linux UAT) | Added (Phase 13.1 carry-forward acknowledgment) |
| `## Install instructions` | INSTALL.md link | INSTALL.md link (byte-identical) |
| `## Tag` footer | "This release was built from tag `v1.1.1`." | "This release was built from tag `v1.1.2`." |

## Stranded-rc audience size constraint (RESEARCH §Risk #6)

The D-09 callout text references `rc1`, `rc2`, and `rc3` by name. Verified the
audience constraint at body-authoring time:

```
$ git tag -l 'v1.1.0-rc*' | wc -l
3
```

`v1.1.0-rc1`, `v1.1.0-rc2`, and `v1.1.0-rc3` are still present on origin
(never force-deleted). The verbatim Phase 13 D-04 wording therefore still
applies without modification — the audience is unchanged.

## Next operation: CHECKPOINT 3

The next operation in this plan is the user-facing visual verification of the
draft Release page in a browser, followed by either:

1. User types "publish" → `gh release edit v1.1.2 --draft=false` (Task 7 — IRREVERSIBLE flip)
2. User types "edit + reason" → re-author body via Task 6 again
3. User types "abort + reason" → unwind (delete tag + draft Release)

This evidence file freezes the body content at the moment immediately before
CHECKPOINT 3. Any subsequent edit will produce a new evidence-file commit.

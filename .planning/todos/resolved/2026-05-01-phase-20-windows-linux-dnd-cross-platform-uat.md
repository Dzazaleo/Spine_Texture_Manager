---
created: 2026-05-01T21:50:00Z
title: Phase 20 cross-platform DnD UAT — Windows + Linux
area: uat
resolves_phase: 39
files:
  - .planning/phases/20-documentation-builder-feature/20-HUMAN-UAT.md
  - .planning/phases/20-documentation-builder-feature/20-VERIFICATION.md
  - src/renderer/src/modals/DocumentationBuilderDialog.tsx
---

## Problem

Phase 20 (Documentation Builder) shipped with 4 human-UAT items. Items 1, 2, and
4 were verified PASS on macOS arm64 in the Electron dev build at phase close
(2026-05-01). Item 3 — cross-platform DnD drag-image consistency on the Electron
release matrix — was deferred because Windows hardware was not available at the
session.

The risk this UAT mitigates: Electron Chromium has a documented quirk where
`dragstart` from a list element renders different (or no) drag image without
`effectAllowed='copy'` set as the FIRST line of the `onDragStart` handler.
`effectAllowed='copy'` IS set in `DocumentationBuilderDialog.tsx` (line 410), so
the failure mode is unlikely — but only a hands-on test on Windows + Linux can
confirm the visual outcome.

## What needs to happen

1. **Windows test** — copy `release/Spine Texture Manager-1.1.3-x64.exe` (built
   2026-05-01 21:39, 103M, NSIS installer) to a Windows machine, run the
   installer, launch the app, repeat UAT item #1: open a project, open the
   Documentation Builder modal, switch to Animation Tracks pane, click "+ Add
   Track" to create Track 0, drag any animation from the side list onto Track
   0. Confirm:
   - The drag image renders (visible thumbnail / element ghost during drag)
   - The drop succeeds; new entry appears with mixTime=0.25 + loop=false
   - No console errors in the dev tools
2. **Linux test** — currently no Linux build target is configured in
   `electron-builder.yml`. If/when Linux ships, repeat the same DnD test on a
   Linux build and update this todo + 20-HUMAN-UAT.md.
3. **Update the UAT file** — flip test #3 from `deferred` to `passed`/`failed`
   in `.planning/phases/20-documentation-builder-feature/20-HUMAN-UAT.md`,
   updating the Summary table accordingly. If Linux is still unavailable, scope
   the result to Windows only and note the Linux deferral.
4. **Resolve this todo** — move from `pending/` to `resolved/` when complete.

## How to test

```
# On the Mac (already done):
npm run build:win   # produces release/Spine Texture Manager-1.1.3-x64.exe

# Copy to Windows machine, install, launch, perform DnD as above.
```

## Why deferred (not blocking)

- Phase 20 verifier scored 5/5 must-haves verified end-to-end via real,
  substantive, wired code.
- jsdom synthetic DnD tests pass (11 RTL tests in
  `tests/renderer/documentation-builder-dialog.spec.tsx`).
- macOS hands-on DnD passed (UAT items #1 + #4).
- The Electron Chromium quirk is mitigated structurally
  (`effectAllowed='copy'` set per RESEARCH §Pattern 4).
- The failure mode, if any, would be cosmetic (no drag image), not a
  correctness bug — drop functionality is independent of drag image rendering.

## Related

- `20-VERIFICATION.md` `human_verification[2]`
- `20-HUMAN-UAT.md` test #3
- `20-CONTEXT.md` D-06 (effectAllowed='copy' lock)
- `20-RESEARCH.md` §Pattern 4 (drag image guard)

***

## Resolved

2026-05-13 — Phase 39 (WINUAT-01) — outcome: **passed**.

Executed on a real Windows host per host-availability decision recorded at `.planning/phases/39-windows-host-blocked-uat-burndown/39-CONTRACT.md` (`host_available: yes` → `winuat_01_mode: live`).

**Host:** Windows host (specific Windows version + machine descriptor not volunteered at UAT report time).
**Installer:** v1.3.x or v1.4.x release installer (specific installer version not volunteered at UAT report time).

**Observation matrix:**
- Drag image rendered: **pass**
- New entry `mixTime=0.25`: **pass**
- New entry `loop=false`: **pass**
- DevTools console clean (no errors): **pass**

**Notes:** User reported all four observations as `pass` on 2026-05-13. Specific Windows version + installer version metadata not recorded at UAT report time; outcome integrity rests on this dated paragraph + Phase 39 contract reference + WINUAT-01 REQ-ID, per the audit-trail rules in 39-CONTRACT.md §2.

**Linux scope dropped** per memory `project_linux_deferred` (Linux removed from CI/release at v1.3 — never UAT'd, never built). Windows-only outcome recorded; the original todo's Linux clause (item 2, "Linux test") is obsolete.

**Related REQ:** WINUAT-01 (REQUIREMENTS.md). Phase 20 `20-HUMAN-UAT.md` is not updated because the file was deleted in commit `0787fe1` (v1.2 cleanup); this todo is the surviving audit-trail anchor per 39-CONTRACT.md §3.1.

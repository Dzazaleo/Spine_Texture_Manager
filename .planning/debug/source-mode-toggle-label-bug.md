---
status: resolved
trigger: "Toolbar source-mode toggle button label is inverted when project loads with only an Images folder (no atlas). Button shows 'Use Images Folder as Source' (implying atlas is current) when Images folder IS already the active source — should show 'Use Atlas as Source'."
created: 2026-05-05
updated: 2026-05-05
resolved: 2026-05-05
moved_to: .planning/debug/resolved/source-mode-toggle-label-bug.md
---

## Resolution summary

Renderer label-derivation defect in `src/renderer/src/components/AppShell.tsx`.

The toolbar badge ("1 atlases" vs "N images") and the source-mode popover label
+ click-flip-direction were all derived from the renderer-local UI preference
state `loaderMode: 'auto' | 'atlas-less'`, treating `'auto'` as a synonym for
"atlas is the active source". This is wrong when the loader takes the D-05
fall-through (no sibling .atlas → synthesize from images/) — `loaderMode`
remains `'auto'` but the active source is atlas-less.

**Fix:** branch all three sites on `effectiveSummary.atlasPath === null`
(Phase 21 D-03 contract: `null` IFF the loader produced an atlas-less result,
in any of the four 4-way branch cases). The user-preference `loaderMode`
remains the WRITE target of the click handler so the user's choice still
round-trips through .stmproj per Plan 21-07.

**Files changed:**
- `src/renderer/src/components/AppShell.tsx` (3 sites, ~1333 / ~1354 / ~1358)

Full investigation log + verification at `.planning/debug/resolved/source-mode-toggle-label-bug.md`.

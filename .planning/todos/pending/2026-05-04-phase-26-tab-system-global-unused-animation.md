---
title: Phase 26 — Tab system replacing stacked panel layout
created: 2026-05-04
resolves_phase: 26
priority: high
source: Phase 24 UAT (tests 1 & 2 layout gap)
---

## Idea

Replace the current stacked GlobalMaxRenderPanel / UnusedAssetsPanel / AnimationBreakdownPanel layout with a three-tab system:

- **Global** tab — current GlobalMaxRenderPanel content
- **Unused** tab — current UnusedAssetsPanel content (orphaned PNGs)
- **Animation** tab — current AnimationBreakdownPanel content

## Why

- Phase 24 UAT: the Unused Assets panel rendered visually inside/below the Global panel area rather than as a clearly separate sibling, causing confusion.
- Tabs free up vertical toolbar space currently consumed by stacked panel headers.
- Cleaner semantic separation between the three views.

## Notes

- Tab headers could sit directly below the toolbar.
- Active tab persists across sessions (localStorage).
- The savingsPct chip can remain in the Global tab header regardless of active tab.

---
sketch: 001
name: tab-bar-placement
question: "Where should the tab bar live, and what style should it use?"
winner: "A"
tags: [layout, tabs, app-body, icon-consistency]
---

# Sketch 001: Tab Bar Placement

## Context

Phase 26.2 incorrectly placed tabs inside the toolbar. The tabs need to move
into the app body (below the toolbar). Icons on each tab must match the icon
already in that panel's `<header>` (filmstrip → Global, warning-triangle →
Unused, bar-chart → Animation Breakdown).

## Design Question

Where does the tab bar sit relative to the toolbar, and which tab style fits
the existing app chrome?

## How to View

```
open .planning/sketches/001-tab-bar-placement/index.html
```

## Variants

- **A: Sub-toolbar (underline)** — Tab bar is a dedicated row immediately below
  the toolbar, separated by a border. Full-width horizontal strip. Active tab
  uses an orange underline (2 px). Same visual weight as the toolbar.
- **B: In-body (pill)** — Tab bar floats inside the content area, above the
  panel box. Active tab gets a soft orange-tinted pill background. Toolbar is
  completely clean / no tabs visible there.

## What to Look For

- Does the toolbar feel cluttered or clean in each variant?
- Does the tab bar feel "part of the toolbar" (A) or "part of the content" (B)?
- Are the icons (filmstrip / warning-triangle / bar-chart) recognisable at 14 px?
- Does the danger-pill badge on the Unused tab read at a glance?
- Use the **Toggle** button in the sketch tools (bottom-right) to hide the
  Unused tab and check that the layout doesn't shift.

# Phase 19: UI improvements (UI-01..05) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 19-ui-improvements-ui-01-05
**Areas discussed:** Sticky header composition, Card layout + state-color palette, Modal summary tiles + cross-nav, Unused-savings quantification (UI-04), Primary/secondary button hierarchy (UI-05)

---

## Sticky Header Composition

### Q1 — Load-summary card content

| Option | Description | Selected |
|--------|-------------|----------|
| UI-01 verbatim only | `N skeletons / N atlases / N regions` as primary visible card; rig-info tooltip preserved on hover | ✓ |
| Replace tooltip entirely | Visible card carries both UI-01 wording AND deeper bones/slots/etc; remove rig-info tooltip | |
| Keep current tooltip shape | Surface bones/slots/attachments/animations/skins in card; drop UI-01 wording | |

**User's choice:** UI-01 verbatim only
**Notes:** Recommended option. Preserves CLAUDE.md fact #1 `skeleton.fps` wording lock at AppShell.tsx:1131.

### Q2 — Tab strip placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inside sticky bar | Title + summary + tabs + buttons + search on a single sticky row | ✓ |
| Below sticky bar, also sticky | Two-row sticky surface | |
| Below sticky bar, NOT sticky | Tabs scroll away; contradicts UI-01 framing | |

**User's choice:** Inside sticky bar, between title and buttons

### Q3 — Documentation button (Phase 20 territory)

| Option | Description | Selected |
|--------|-------------|----------|
| Render disabled placeholder | Visible button + aria-disabled + 'Available in v1.2 Phase 20' hint; Phase 20 enables | ✓ |
| Stub functional button → placeholder dialog | Throwaway 'Coming soon' modal | |
| Defer entirely | No button until Phase 20 retrofits | |

**User's choice:** Render disabled placeholder

### Q4 — Search box anchor location

| Option | Description | Selected |
|--------|-------------|----------|
| Right cluster, before action buttons | SearchBar to LEFT of Atlas Preview/Optimize/Save/Open cluster | ✓ |
| Center-aligned | Slack/Linear pattern; eats horizontal space | |
| Second row inside sticky surface | Two-row layout | |

**User's choice:** Right cluster, before action buttons

---

## Card Layout + State-Color Palette

### Q1 — Card scope mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Whole panel = one card per section | Global = single card; AnimationBreakdown = card per cardId; Unused = own callout; tables preserved inside | ✓ |
| Each row = card | Replace tables with card list; breaks virtualizer | |
| Logical groups = cards inside flat panel | Adds taxonomy decisions; scope creep | |

**User's choice:** Whole panel = one card per section

### Q2 — Row state color depth

| Option | Description | Selected |
|--------|-------------|----------|
| Left accent bar + tinted ratio cell | 1-2px bar + tinted scale-ratio cell; rest neutral | ✓ |
| Full row tinting | Heavy on long lists; clashes with hover/selection | |
| Badge-only on ratio cell | Most conservative; weakest scan signal | |

**User's choice:** Left accent bar + tinted ratio cell

### Q3 — Token strategy for green/yellow

| Option | Description | Selected |
|--------|-------------|----------|
| Add literal hex tokens, WCAG AA on bg-panel | Mirror --color-danger #e06b55 approach; researcher picks specific hex | ✓ |
| Use Tailwind palette `var(--color-emerald-500)` / `var(--color-amber-500)` | Mirrors --color-accent wiring; bypasses pre-validated contrast | |
| Reuse existing tokens | --color-accent for warning conflicts with primary CTA; --color-fg-muted for success kills signal | |

**User's choice:** Add literal hex tokens, WCAG AA on bg-panel

### Q4 — Color-coded category icons interpretation

| Option | Description | Selected |
|--------|-------------|----------|
| Section-level icons only on the 3 callout headers | One SVG per Global Max / Animation Breakdown / Unused Assets; hand-rolled, no library | ✓ |
| Per-attachment-type icons on every row | Strong signal; needs icon library + design pass | |
| Skip icons | UI-02 wording not literally honored | |

**User's choice:** Section-level icons only

---

## Modal Summary Tiles + Cross-Nav

### Q1 — OptimizeDialog summary tiles

| Option | Description | Selected |
|--------|-------------|----------|
| Used Files / To Resize / Pixel Savings % | All from existing ExportPlan; matches UI-03 `Saving est. 77.7% pixels` shape | ✓ |
| Total / Resize / MB Savings | Requires new IPC + fs.statSync at pre-flight; slower | |
| Total / Resize / Excluded Unused | Doesn't quantify savings | |

**User's choice:** Used Files / To Resize / Pixel Savings %

### Q2 — AtlasPreviewModal summary tiles

| Option | Description | Selected |
|--------|-------------|----------|
| Pages / Regions / Utilization % | All from existing AtlasPreviewProjection | ✓ |
| Pages / Regions / Largest Page Dim | Less analytically useful | |
| Mode-aware tiles | Re-render on Original/Optimized toggle; less stable | |

**User's choice:** Pages / Regions / Utilization %

### Q3 — Cross-nav button behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Close current modal, open the other | Single modal mounted; preserves 5-modal ARIA scaffold | ✓ |
| Stack modals | Nested focus traps, ARIA ambiguity, z-index complexity | |
| Replace via single modal-host | Large refactor; out of scope | |

**User's choice:** Close current modal, open the other

### Q4 — Cross-nav button placement

| Option | Description | Selected |
|--------|-------------|----------|
| Footer left, away from primary actions | Footer flips to `justify-between`; primary stays right | ✓ |
| Footer right, between Cancel and Start | Competes with primary CTA visual weight | |
| Header right, near close X | No close-X exists today; out of scope | |

**User's choice:** Footer left, away from primary actions

---

## Unused-Savings Quantification (UI-04)

### Q1 — Compute path

| Option | Description | Selected |
|--------|-------------|----------|
| Main-side at load, fold into UnusedAttachment | Extend shape with bytesOnDisk:number; one-shot fs.statSync via existing load.sourcePaths | ✓ |
| Main-side at load, separate aggregate field | Per-row bytes not surfaced for future drill-down | |
| Lazy IPC | Async UI flicker; load-time path natural | |

**User's choice:** Main-side at load, fold into UnusedAttachment

### Q2 — Display format

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-scale: KB <1MB, MB <1GB, GB otherwise | OS file-size convention; UI-04 verbatim shape for typical projects | ✓ |
| Always MB (UI-04 verbatim) | Tiny projects show 0.00 MB; awkward | |
| Binary (MiB/GiB) units | Technically precise; unfamiliar in consumer UX | |

**User's choice:** Auto-scale

### Q3 — Atlas-packed projects (no per-region PNG on disk)

| Option | Description | Selected |
|--------|-------------|----------|
| Bytes = 0 for atlas-packed; show count only when sum is 0 | Honest; UI-04 verbatim shown only when bytes > 0 | ✓ |
| Bytes = pro-rata share of page | Misleading; bytes won't materialize without atlas repack | |
| Hide entirely for atlas-packed projects | UI-04 success criterion 4 not met | |

**User's choice:** Bytes = 0 for atlas-packed; show count only when sum is 0

### Q4 — Refresh trigger (initial round)

| Option | Description | Selected |
|--------|-------------|----------|
| Static at load only | Stable across session; matches other summary fields | (revisited) |
| Static + manual Refresh button on callout | New IPC; mostly unused affordance | |
| Recompute on Save reload | Save doesn't reload project today | |
| Recompute on each override change | Originally selected; revisited after clarification | |

**User's initial pick:** Recompute on each override change.
**Clarification round (Q4-revisit):** User asked for plain-language explanation of how an override interacts with savings. Claude explained that overrides only multiply peak ratio (not visibility); unused-set membership is sampler-driven. Two distinct savings figures clarified: (a) UI-04 unused MB callout — static, overrides cannot affect it; (b) D-09 OptimizeDialog Pixel Savings % tile — dynamic, refreshes per Optimize click via ExportPlan rebuild.
**User's revised choice:** Static at load only.

---

## Primary/Secondary Button Hierarchy (UI-05)

### Q1 — Primary CTA visual treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Filled bg-accent + text-panel | Verbatim reuse of OptimizeDialog Start button pattern at line 323 | ✓ |
| Outlined + accent border + accent text | Softer; weaker hierarchy signal | |
| Filled gradient | New pattern; harder WCAG verification | |

**User's choice:** Filled bg-accent + text-panel

### Q2 — Secondary button treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current outlined warm-stone treatment | Verbatim from AppShell.tsx:1165; battle-tested | ✓ |
| Demote to ghost/text-only | Low affordance; weak tap target | |
| Tint border with --color-fg-muted | Marginal change; token churn | |

**User's choice:** Keep current outlined warm-stone treatment

### Q3 — Button order in right cluster

| Option | Description | Selected |
|--------|-------------|----------|
| Search \| Atlas Preview \| Documentation \| Optimize Assets \| Save \| Open | Documentation slotted before Optimize; existing relative order preserved | ✓ |
| Search \| secondaries \| Optimize (rightmost) | Disrupts muscle memory | |
| Search \| Optimize (leftmost) \| secondaries | Disrupts muscle memory | |

**User's choice:** Search | Atlas Preview | Documentation | Optimize Assets | Save | Open

---

## Claude's Discretion

- Sticky bar background opacity / blur effects (use solid `bg-panel`).
- Card border radius value (use `rounded-md`).
- 3-tile layout details inside modals (`flex gap-3` row above existing body).
- Section-icon glyph choices (researcher proposes; planner locks).
- Specific hex picks for `--color-success` / `--color-warning` (researcher verifies WCAG AA on `--color-panel`).

## Deferred Ideas

None outside Phase 19 scope.

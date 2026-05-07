# Phase 25: Missing attachments in-context display - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 25-missing-attachments-in-context-display
**Areas discussed:** isMissing marker location, Stub data display, Missing row interactivity, MissingAttachmentsPanel placement

---

## isMissing marker location

| Option | Description | Selected |
|--------|-------------|----------|
| Add isMissing to DisplayRow | Main process sets isMissing: true on stub rows when building peaksArray. Both panels read it directly — no renderer-side name lookup or extra Set. IPC contract is explicit and type-safe. | ✓ |
| Renderer derives from skippedAttachments | No DisplayRow change. Each panel builds a Set from summary.skippedAttachments and checks attachmentName membership per row. skippedAttachments already threaded to both panels. | |

**User's choice:** Add isMissing to DisplayRow (Recommended)
**Notes:** Straightforward — explicit IPC field avoids redundant Set construction in both panel components.

---

## Stub data display

| Option | Description | Selected |
|--------|-------------|----------|
| Show stub data as-is | peakScale, worldW×H, sourceW×H render normally. ⚠ icon + red accent communicate unreliable data without special-casing every cell. Simpler implementation, fewer branches. | ✓ |
| Dims show '—', scale shows as-is | sourceW×H and Peak W×H cells show '—'. peakScale still shows. Partial treatment — requires conditional rendering in both panels. | |
| All cells show '—' | Every numeric cell renders '—' for missing rows. Maximally honest but adds a conditional branch to every cell renderer in both panels. | |

**User's choice:** Show stub data as-is (Recommended)
**Notes:** The ⚠ icon + red accent are sufficient to signal invalidity. Keeping cell renderers branch-free is the right call.

---

## Missing row interactivity

| Option | Description | Selected |
|--------|-------------|----------|
| Full interactive — checkbox + override both work | Consistent with all other rows. Overrides on missing rows persist — useful when the animator plans to add the PNG later. No special-casing in row click handlers or override dialog. | ✓ |
| Read-only — checkbox + override both disabled | Greys out checkbox and hides/disables override button. Clearer 'this row is inactive' signal but requires conditional disable logic in both panels. | |
| Selectable but no override button | Checkbox works, override hidden/disabled. Asymmetric logic. | |

**User's choice:** Full interactive — checkbox + override both work
**Notes:** Override persists for future use when the animator adds the missing PNG. Full interactive = no special cases.

---

## MissingAttachmentsPanel placement

| Option | Description | Selected |
|--------|-------------|----------|
| Keep above Global — no change | MissingAttachmentsPanel stays exactly where it is. Additive: in-context rows supplement the banner. Banner surfaces the full list + expected PNG paths without scrolling. | ✓ |
| Move below UnusedAssetsPanel | Order becomes Global → Unused Assets → Missing Attachments → Animation Breakdown. In-context rows handle the primary signal; panel becomes secondary. Requires AppShell render-tree edit. | |

**User's choice:** Keep above Global — no change
**Notes:** Banner is additive — it gives the full list at a glance; in-context rows give per-row scale context. Both are needed.

---

## Claude's Discretion

- **`'missing'` RowState variant**: extend existing `RowState` type with `| 'missing'`; check `isMissing` first in `rowState()` predicate
- **Icon choice**: Unicode `⚠` in `text-danger` beside the attachment name; no new SVG component
- **Left-accent color**: `bg-danger` (same as `'unused'`); the ⚠ icon differentiates missing from unused visually

## Deferred Ideas

- Phase 26 tab system — stacked panels → Global/Unused/Animation tabs (separate todo)
- `border-warning` token — semantic amber/yellow for "warning" vs "error" severity; deferred to future polish phase
- "Never rendered" greyed section — undecidable in atlas-less mode; explicitly out of scope for Phase 25

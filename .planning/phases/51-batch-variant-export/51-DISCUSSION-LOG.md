# Phase 51: Batch Variant Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 51-batch-variant-export
**Areas discussed:** Scale-set entry UX, Dialog structure, Batch failure semantics, Duplicate/collision handling, Cancellation, Override behavior

---

## Scale-Set Entry UX

| Option | Description | Selected |
|--------|-------------|----------|
| List of scale rows | Each row = the Phase-50 two-way control (factor / W / H, aspect-locked); add/remove + optional preset quick-add | ✓ |
| Free-text scale list | One field, comma/space list ("0.5, 0.25, 0.1") parsed into chips with derived W×H preview | |
| Presets-first + custom | Toggle common factors (½ ¼ ⅛ 1/16) + a custom-add field; no per-row two-way control | |

**User's choice:** List of scale rows
**Notes:** Reuses the proven single-scale two-way control verbatim per row; subsumes the other two (keeps per-entry px targeting).

| Option (presets) | Description | Selected |
|--------|-------------|----------|
| Yes — ½ ¼ ⅛ | Three buttons appending 0.5 / 0.25 / 0.125 rows | |
| Yes — let me name the set | Presets with a custom factor set | |
| No presets | Manual [+ Add scale] only | ✓ |

| Option (initial list) | Description | Selected |
|--------|-------------|----------|
| One row at 0.5 | Open with a single editable row pre-filled at 0.5 (mirrors single-scale default) | ✓ |
| Carry last scale | One row holding the last-used scale this session | |
| One empty row | Single blank row; Export disabled until valid | |

**Notes:** Opens with one row at 0.5 — a 1-row list IS a single export.

---

## Dialog Structure (Action Model & Layout)

**Detour to chat:** the user paused the structured questions to walk through the
real flow ("I drop a full-scale JSON, look at the Global Panel, want 36% + 57% —
what's my next action?"). Confirmed the flow: click **Export Variant…** in the
toolbar → multi-row scale list → set 0.57 + add 0.36 → output config → Start →
parent picker → two sibling `{NAME}@{s}x/` packages. Two threads surfaced from
the user's phrasing: (1) they think in **percent**, the control speaks factor +
px; (2) **entry point** is a toolbar button, decoupled from the Global Panel.

Then the user asked about a **what-if preview** (see per-scale peak/dims vs source
+ reflect scales in the Atlas Preview) — see the dedicated section below.

Then the user **challenged the existence of two buttons** (Export Variant vs
Optimize Assets) — "they fundamentally do the same thing. Challenge me."
Counter-argument given + accepted: the baked JSON IS the intent line (Optimize =
same rig / smaller atlas / no new JSON; Variant = a new smaller self-contained
rig); at 100% there's no smaller rig, so "Optimize = Variant@1.0" collapses; and
merging refactors the app's oldest/most-trusted flow — a v1.8 job, not the v1.7
finale. User: "ok you convinced me."

| Option (action model) | Description | Selected |
|--------|-------------|----------|
| Unify into one dialog | Existing "Export Variant…" holds the scale list; 1 row = single, 2+ = batch; no separate action | ✓ |
| Separate Batch action | Keep "Export Variant…" single-scale; add a distinct "Batch Export…" button + dialog | |

| Option (layout) | Description | Selected |
|--------|-------------|----------|
| Single pane, no tabs | Scale list → output/atlas/sharpen/buffer → results; lean (preview deferred) | ✓ |
| Introduce Scale \| Output tabs | Split into tabs to contain height; more chrome | |

**User's choice:** Unify into one dialog; single pane, no tabs.
**Notes:** Optimize Assets stays a separate, byte-untouched action (49-D-04
preserved); the Optimize⊕Variant merge → v1.8. Single-pane overturns the earlier
"tabs land at Phase 51" expectation (49-D-06 / 50-D-09).

---

## What-If Preview (scope fork)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer all preview | Keep Phase 51 pure batch; capture what-if preview as its own phase / v1.8 | ✓ |
| Fold in per-row readout | Per-row resulting dims / page count vs source (reuse pure projection); no new modal | |
| Full what-if now | Per-row readout + Atlas Preview reflects a selected scale | |

**User's choice:** Defer all preview
**Notes:** Acknowledged valuable (it's the deferred Future Requirement, REQUIREMENTS.md:52);
the projection infra is cheap/ready → strong v1.8 candidate. Kept the v1.7 finale on-scope.

---

## Batch Failure Semantics

| Option (failure policy) | Description | Selected |
|--------|-------------|----------|
| Continue, each folder atomic | A failure in one variant doesn't stop the others; per-folder atomic; report ✓/✗ at end | ✓ |
| All-or-nothing | Any failure rolls back the entire fan-out | |
| Stop on first failure | Keep completed, abort remaining; no clear failed list | |

| Option (result surface) | Description | Selected |
|--------|-------------|----------|
| Per-folder result list | Each scale's folder ✓/✗ + reason, plus aggregate count | ✓ |
| Aggregate only | A single rolled-up summary, no per-folder breakdown | |

**User's choice:** Continue-on-error (each folder atomic) + per-folder result list.
**Notes:** Matches the existing per-export atomic design; batch is inherently a set
of independent outputs. Each variant keeps its OWN rollback scope.

---

## Duplicate / Collision Handling

| Option (dup tokens) | Description | Selected |
|--------|-------------|----------|
| Flag + block Start | Detect duplicate @{s}x tokens at pre-flight; highlight rows; disable Start with hint | ✓ |
| Auto-collapse silently | Run each unique token once; drop the duplicate silently | |
| Allow, last one wins | Both run into the same folder; second overwrites first | |

| Option (existing dirs) | Description | Selected |
|--------|-------------|----------|
| One overwrite choice for the run | Reuse Phase-49 confirm; pre-existing folders fail per-folder with overwrite off | ✓ |
| Pre-scan + warn before Start | Scan the parent, warn which folders exist | |
| Per-folder prompt | Ask overwrite separately per existing folder | |

**User's choice:** Flag + block Start (dups); one overwrite choice for the run (existing dirs).
**Notes:** Invalid rows (blank / s≥1) follow the existing single-scale rule — Start
disabled while any row invalid (D-04/D-08), agreed by default (no objection).

---

## Cancellation Mid-Batch

| Option | Description | Selected |
|--------|-------------|----------|
| Stop after current variant | Cancel gates between variants; in-flight finishes (atomic); remaining skipped; completed kept | ✓ |
| Abort + roll back in-flight | Cancel also rolls back the variant currently writing | |
| No cancel | Match the shipped single-scale path (no cancel channel) | |

**User's choice:** Stop after current variant
**Notes:** `runExport`/`runRepack` already accept a `() => boolean` cancel cb
(today `() => false`); D-09 needs only a between-variants gate, not threading
cancel into a variant's workers.

---

## Override Behavior Across the Batch

| Option | Description | Selected |
|--------|-------------|----------|
| Shared across all scales | The one active override bucket applies to every scale (overrides are %-of-peak → scale cleanly to each variant's s×peak) | ✓ |
| Want per-scale overrides | Tune overrides differently per scale — the deferred Future Requirement L-05 | |

**User's choice:** Shared across all scales
**Notes:** Already locked (49-D-07 + L-05); confirmed. Per-scale override divergence
stays a deferred Future Requirement (its own phase, not Phase 51).

---

## Claude's Discretion

- Batch orchestration seam (renderer N×`exportVariant` loop vs a main-side
  `variant:exportBatch` channel) — reuse `handleExportVariant`'s body per scale.
- Scale-list internal data model + per-row px-edit state.
- In-run progress display ("variant 2 of 3 — {NAME}@0.36x" + per-file bar).
- Master summary tiles fate (keep as master reference or drop).
- Per-row live `{NAME}@{s}x` folder hint.
- Whether to add a `%` readout per row (minor; user thinks in percent).

## Deferred Ideas

- What-if preview (per-scale dims/peak vs source + Atlas Preview reflection) → v1.8 (Future Req).
- Unified Export dialog (Optimize ⊕ Variant merge) → v1.8 UX refactor.
- Per-scale per-attachment overrides (independent buckets per scale) → Future Req L-05.
- Quick-add scale presets (½ ¼ ⅛) → declined this phase; possible future convenience.
- Saved scale-sets / variant presets in `.stmproj` → Future Req.
- Percent (%) readout per scale row → minor future enrichment.
- Scale | Output | Batch tabs → NOT introduced (D-06); revisit only if the dialog grows.

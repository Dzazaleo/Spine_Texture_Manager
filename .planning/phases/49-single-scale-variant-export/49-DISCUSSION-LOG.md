# Phase 49: Single-Scale Variant Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 49-single-scale-variant-export
**Areas discussed:** Folder layout & naming, Scale input & trigger seam, Export-config inheritance, Scale-direction policy, Dialog tab structure

---

## Folder layout & naming

| Option | Description | Selected |
|--------|-------------|----------|
| Per-scale subfolder | Parent folder → `PARENT/NAME@0.5x/` with clean basenames (NAME.json + images/ + atlas). True drop-in; batch-compatible. | ✓ |
| Flat in chosen folder | Write NAME.json + images/ + atlas straight into the picked folder (like today's export); batch needs per-scale picks or filename suffixes. | |

| Option | Description | Selected |
|--------|-------------|----------|
| `NAME@0.5x` | Compact, reads as "half size", `@2x`/`@0.5x` density convention. | ✓ |
| `NAME_50` (percent) | Percent of original; awkward for 0.26 → NAME_26. | |
| `NAME_0.5` (raw factor) | Literal factor with underscore; plain. | |

**User's choice:** Per-scale subfolder + `NAME@0.5x` token.
**Notes:** Clean basenames inside the folder (NAME.json/.atlas/.png + images/) so it's a faithful drop-in. Non-round factors → `@0.26x`. Pre-existing subfolder reuses the existing overwrite/conflict-reprobe flow.

---

## Scale input & trigger seam

| Option | Description | Selected |
|--------|-------------|----------|
| Basic-but-usable now | Minimal numeric scale field + folder pick wired to the real export this phase (EXPORT-01 UI-testable now); Phase 50 enriches in place. | ✓ |
| Engine + IPC only | Build/verify the pipeline via tests/CLI; user-facing entry deferred entirely to Phase 50. | |

| Option | Description | Selected |
|--------|-------------|----------|
| New "Export Variant…" action | Separate from Optimize (writes a full scaled rig); reuses Optimize's config surface. | ✓ |
| Extend OptimizeDialog | Add a scale control + JSON write to the current Optimize flow. | |
| You decide / planner's call | Defer integration choice to planning. | |

**User's choice:** Basic-but-usable now + a new "Export Variant…" action.
**Notes:** Phase 50 swaps the basic field for the two-way scale↔px + bounds reference, enriching the same control. Variant action reuses output-mode / atlas-opts / folder-picker.

---

## Export-config inheritance

| Option | Description | Selected |
|--------|-------------|----------|
| Inherit full export config | Variant honors active overrides + buffer + sharpen + output mode + atlas opts; sized at `s × master_effectiveScale`; reuses buildExportPlan unchanged. | ✓ |
| Clean s×peak only | Size purely at `s × peak`, ignoring overrides + buffer. | |

**User's choice:** Inherit full export config.
**Notes:** Mental model — "a variant is your tuned export, just smaller." Active override bucket already follows loaderMode.

---

## Scale-direction policy

| Option | Description | Selected |
|--------|-------------|----------|
| Downscale-only, reject s≥1 | Validate `0 < s < 1`; reject `s ≥ 1` with a clear message. Core bake stays direction-agnostic. | ✓ |
| Allow s ≤ 1 (include 1.0) | Permit a full-size faithful re-export; overlaps with Optimize. | |
| Allow any s > 0 (incl. upscale) | Texture clamp ≤ 1.0 makes upscale misleading; out of v1.7 scope. | |

**User's choice:** Downscale-only, reject s≥1.
**Notes:** The down-scale constraint lives only at the export/UI edge; Phase-48 D-09 (direction-agnostic core) preserved.

---

## Dialog tab structure

| Option | Description | Selected |
|--------|-------------|----------|
| Tab-ready single pane now, tabs in 50/51 | Clean single-pane dialog now; doc-dialog TabButton idiom drops in at Phase 50/51 when two-way input + bounds + batch give tabs (`Scale | Output | Batch`) real content. | ✓ |
| Tabbed Export Variant dialog now | Tabs from the start even though Scale is one field (premature). | |
| Unified Export dialog (Optimize | Variant) | One tabbed dialog folding both; refactors the shipped Optimize flow (out of scope). | |

**User's choice:** Tab-ready single pane now, tabs in 50/51.
**Notes:** User raised this as a follow-up, referencing the documentation dialog's tab strip (DocumentationBuilderDialog.tsx:140-150, shared TabButton class from AppShell.tsx:1487-1515). Optimize flow stays untouched.

---

## Claude's Discretion

- Exact `s`-token formatting for edge factors (`@0.5x` / `@0.26x` style).
- Where the bake → JSON-write → `s×`-sizing orchestration physically lives (renderer plan-build vs main); how `s` is injected into buildExportPlan; new skeleton-JSON writer helper shape (atomic .tmp+rename, joined to the shared rollback set).
- New IPC channel name (extend `export:start` vs new `variant:export`).
- Toolbar placement / icon for the "Export Variant…" action.
- Whether a CLI variant-export path is added (not required for EXPORT-01).

## Deferred Ideas

- Two-way scale↔px input + setup-pose rig-bounds reference — Phase 50.
- Batch (N scales → N folders) — Phase 51 (reuses the `NAME@sx/` subfolder convention).
- Tabbed variant dialog (`Scale | Output | Batch`) — Phase 50/51.
- Unified Export dialog (Optimize | Variant tabs) — rejected for Phase 49; possible v1.8 refactor.
- Cross-SCALE per-attachment override behavior (shared vs independent buckets) — Future Requirements.
- Upscaling (`s ≥ 1`) as a feature — out of v1.7 scope (core supports it, edge rejects it).
- Variant presets / saved scale-sets; "what-if" peak preview — Future Requirements.

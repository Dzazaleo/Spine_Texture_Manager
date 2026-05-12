---
id: SEED-007
status: dormant
planted: 2026-05-12
planted_during: post-v1.4 (Spine 4.3 Forward-Compat + Rotated Atlases — milestone_complete)
trigger_when: Next milestone after v1.4 ships (v1.5+) — when scoping overrides/loaderMode integration, or any milestone that touches export-pipeline UX, .stmproj schema, or atlas-less mode ergonomics.
scope: Medium
---

# SEED-007: Split overrides per loaderMode (atlas-source vs atlas-less)

## Why This Matters

**The bug that triggered this (UX-correctness, not math-correctness):**

The `.stmproj` schema stores a single `overrides: Record<string, number>` map
that BOTH `loaderMode` values consume. When a user applies an override in
atlas-source mode, switches to atlas-less mode (or vice versa), the same
percent silently applies to the other mode's rows. Double-clicking a row in
the inactive mode shows the override as if the user had set it there
themselves.

**Math verdict (verified during 2026-05-12 discussion — DO NOT relitigate):**
The peak-anchored override math is mode-invariant by construction:
- `canonicalW`/`canonicalH` come from JSON `attachment.width/height`
  ([src/core/loader.ts:267-349](../../src/core/loader.ts)) — unchanged by
  any optimize pass (JSON is never rewritten) and identical across modes.
- `peakScale` for meshes is explicitly resolution-corrected
  ([src/core/bounds.ts:248-289](../../src/core/bounds.ts)) via the isotropic
  factor `sqrt((origW × origH) / (canonW × canonH))` so it measures
  world-AABB vs canonical-AABB regardless of on-disk PNG dims. Region
  attachments are bone-driven and already invariant.
- `outW = ceil(canonicalW × effScale)` is canonical-relative; the
  `sourceRatio` cap only prevents upscaling past `actualSourceW`, never
  causes a "shrink twice" path.
- Net: same override percent → same absolute world-space output pixels in
  both modes (idempotent across re-optimize/reload). **No compounding
  shrinkage.**

**Why it's still a real bug worth fixing:**
1. Conflicts with the `project_strict_loadermode_separation` lock
   (2026-05-06) — atlas-source and atlas-less are self-contained EXCEPT
   for this one state piece.
2. The two modes serve different downstream pipelines (packed atlas for
   one consumer; loose images for another, e.g. an engine pack step
   between Spine-export and final-pack). Users may legitimately want
   different quality budgets per pipeline. Sharing forecloses that.
3. Surprising UX: a user setting up atlas-less mode shouldn't silently
   inherit atlas-mode export decisions, and vice versa.

## When to Surface

**Trigger:** Next milestone after v1.4 ships (v1.5+), or earlier if any
of these conditions activate:

- Scoping overrides UI work (e.g. bulk-override tools, per-skin overrides).
- Schema work on `.stmproj` that touches `ProjectFileV1` field shape.
- A user-reported confusion about override behavior across mode switches
  (the symptom that triggered this seed).
- Atlas-less mode UX improvements (atlas-less is the primary workflow per
  `project_atlas_less_primary_workflow.md`).

Surface during `/gsd-new-milestone` when milestone scope matches any of the
above, OR when this trigger phrase appears in roadmap scoping: "overrides",
"atlas-less ergonomics", ".stmproj schema", "loaderMode".

## Scope Estimate

**Medium** — schema split + IPC payload changes + migration helper +
multi-surface renderer threading + tests across ~6 files. Likely one phase;
possibly two if UX nudge (one-shot toast) is in scope.

## LOCKED Design Decisions (2026-05-12)

**These are committed; the planner SHOULD NOT relitigate.**

### Decision 1: Schema split (LOCKED)

`ProjectFileV1` gains `overridesAtlasLess: Record<string, number>` alongside
the existing `overrides` field. The existing `overrides` field name is
**preserved** (no rename); its semantic narrows to "atlas-source mode only".

- Pure additive change. **No version bump** — follows the
  `loaderMode` / `sharpenOnExport` / `safetyBufferPercent` precedent:
  validator pre-massage in [src/core/project-file.ts](../../src/core/project-file.ts)
  treats missing `overridesAtlasLess` field as `{}`.
- Rationale for not renaming: downstream readers of v1 files (if any
  ever materialize) don't break; the migration is purely "new field added".

### Decision 2: Legacy file routing policy — 2-A (LOCKED)

When loading a v1.3.x `.stmproj` with one `overrides` map:

- If saved `loaderMode === 'atlas-less'` → route the entire legacy map
  into `overridesAtlasLess`. `overrides` (atlas-source bucket) starts empty.
- Otherwise (saved `loaderMode === 'auto'` or undefined) → keep legacy
  map in `overrides`. `overridesAtlasLess` starts empty.

**Rationale:** the saved `loaderMode` IS the user's last expressed intent
for which pipeline these overrides belong to. Principled alignment with
`project_strict_loadermode_separation`.

**Rejected alternative (2-B): copy legacy map to both buckets** — would
preserve the pre-split "same value everywhere" feel, but couples the
buckets at exactly the moment we said they should diverge. Self-defeating.

### Decision 3: Mode-switch starter state — 3-A (LOCKED)

When the user toggles `loaderMode` in a fresh session, the inactive bucket
is whatever it already is (empty for a fresh project; previously-saved
values otherwise). **NO auto-copy from the active bucket.**

**Rationale:** modes are self-contained from the user's first override
forward. Matches `project_strict_loadermode_separation`.

**Rejected alternatives:**
- 3-B (auto-copy on first switch) — defeats the whole point.
- 3-C (empty + "Copy from X mode" button) — middle-ground UX escape hatch.
  Deferred; the planner may revisit if user feedback after 2-A/3-A ship
  indicates the friction is real.

## Surfaces Touched (preliminary scope — for the planner, not locked)

- `src/shared/types.ts` — `ProjectFileV1`, `AppSessionState`,
  `MaterializedProject`, IPC payload shapes.
- `src/core/project-file.ts` — validator pre-massage for
  `overridesAtlasLess`; serialize/deserialize round-trip both buckets.
- `src/main/project-io.ts` — Open handler runs `migrateOverrides`
  per-bucket; Save serializes both; **legacy-file routing logic** at the
  Open seam (Decision 2-A — route by saved `loaderMode`).
- `src/main/override-migration.ts` — runs independently per bucket against
  shared `summary.regions` (mode-invariant — skin-manifest pass is
  JSON-only). `migratedKeyCount` summed; stale keys unioned for the banner.
- `src/renderer/src/components/AppShell.tsx` — two `Map<string, number>`
  in state; active-mode slice selected for the 4 `buildExportPlan` call
  sites and the `OverrideDialog` apply handler. **`buildExportPlan`
  signature unchanged.**
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` +
  `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — receive
  active-mode slice as `overrides` prop. **Prop signature unchanged.**
- Tests:
  - `tests/main/override-migration.spec.ts` — per-bucket migration + a
    legacy-routing fixture (saved `loaderMode === 'atlas-less'` →
    overrides land in `overridesAtlasLess`).
  - `tests/core/project-file.spec.ts` — round-trip both buckets; legacy
    pre-massage path; ensure missing `overridesAtlasLess` → `{}`.
  - AppShell mode-switch coverage — assert per-mode override divergence
    (apply in atlas-source, switch, see empty in atlas-less, and vice
    versa).
  - Export plan tests (`tests/core/export.spec.ts`) — **no change**
    (signature unchanged).

## Optional UX Nudge (NOT locked — planner decides)

One-shot toast first time per session the user toggles modes after applying
an override: *"Overrides are tracked per loader mode."* Suppressable with
"don't show again". Cheap signal that prevents future confusion. Could be
deferred to a follow-up phase if scope pressure.

## Out of Scope

- Cross-mode override copy/sync feature. Deliberately not built — modes
  are self-contained per `project_strict_loadermode_separation`.
- Any change to `buildExportPlan` signature or core export math. The math
  is verified correct; the bug is intent-routing only.
- Schema version bump. Pure additive change.

## Breadcrumbs

Code references that anchor the design decisions:

- [src/core/overrides.ts](../../src/core/overrides.ts) — `applyOverride`,
  `clampOverride`; peak-anchored semantics docblock (lines 10-27).
- [src/core/loader.ts:267-349](../../src/core/loader.ts) — `canonicalW`/`H`
  derivation from JSON `attachment.width/height` (mode-invariant,
  optimize-invariant).
- [src/core/bounds.ts:248-289](../../src/core/bounds.ts) — mesh peakScale
  resolution-correction (the on-disk-PNG-invariance proof).
- [src/renderer/src/lib/export-view.ts:165-262](../../src/renderer/src/lib/export-view.ts)
  — `computeExportDims`; canonical-relative output math.
- [src/main/override-migration.ts](../../src/main/override-migration.ts) —
  `migrateOverrides` (today single-bucket; this seed splits it per-bucket).
- [src/shared/types.ts:984-1052](../../src/shared/types.ts) —
  `ProjectFileV1` + `AppSessionState` (the schema and session-state
  shapes that gain the new field).

Related decisions / memory notes:

- `project_strict_loadermode_separation.md` (locked 2026-05-06) — the
  principle this seed extends to overrides.
- `project_peak_anchored_invariants.md` — the 3 invariants from the
  2026-05-05 redesign that prove the math is mode-invariant.
- `project_compute_export_dims_canonical_base.md` — canonical-base
  contract.

## Notes

- Triage path during the 2026-05-12 conversation:
  1. User reported the symptom (atlas → atlas-less override bleed).
  2. Math traced through full pipeline → no compounding-shrink bug.
  3. Bug reclassified as UX/intent-routing, not math correctness.
  4. Decisions 2-A and 3-A locked in alignment with the existing
     `strict_loadermode_separation` principle.
- This seed was captured before any code was changed. The conversation
  produced no commits.
- If a future user-feedback signal indicates that the inactive bucket
  starting empty is too jarring (Decision 3-A), the planner may revisit
  with 3-C (empty + one-click "Copy from X mode" button). Decision 2-A
  (legacy file routing) has no such escape hatch — once shipped, any
  re-route would be a second migration. Lock it firmly.

# Phase 36: Split Overrides Per Loader Mode - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Atlas-source and atlas-less modes maintain independent override maps so an override applied in one mode never leaks into the other. Pure schema-additive change (`overridesAtlasLess` alongside preserved `overrides`), legacy v1.3.x/v1.4.x files routed by saved `loaderMode` at the Open seam, no auto-copy on mode toggle. Math is mode-invariant by construction (verified during SEED-007 capture 2026-05-12) — `buildExportPlan` signature unchanged, panel prop signatures unchanged, no schema version bump. Bug is UX intent-routing only.

Touched surfaces (canonical): `src/shared/types.ts`, `src/core/project-file.ts`, `src/main/project-io.ts`, `src/main/override-migration.ts`, `src/renderer/src/components/AppShell.tsx`, `src/renderer/src/panels/GlobalMaxRenderPanel.tsx`, `src/renderer/src/panels/AnimationBreakdownPanel.tsx`, plus tests at `tests/main/override-migration.spec.ts`, `tests/core/project-file.spec.ts`, and new AppShell mode-switch divergence test.

</domain>

<decisions>
## Implementation Decisions

### SEED-007 Locked (pre-existing — do NOT relitigate)
- **L-01:** Schema-additive — `ProjectFileV1.overridesAtlasLess: Record<string, number>` alongside preserved `overrides`. **No schema version bump** (follows `loaderMode` / `sharpenOnExport` / `safetyBufferPercent` precedent). Validator pre-massage in `src/core/project-file.ts` treats missing `overridesAtlasLess` as `{}`. (SEED-007 Decision 1)
- **L-02:** Legacy file routing — loading a v1.3.x/v1.4.x `.stmproj` with a single `overrides` map: if saved `loaderMode === 'atlas-less'` → entire legacy map routes into `overridesAtlasLess` (atlas-source bucket starts empty); otherwise (`auto` or undefined) → legacy map stays in `overrides` (atlas-less bucket starts empty). Routing decision happens at the Open seam in `src/main/project-io.ts`. (SEED-007 Decision 2-A)
- **L-03:** No auto-copy on mode toggle — toggling `loaderMode` in a fresh session does NOT copy from the active bucket. Inactive bucket retains whatever it has (empty for fresh project; previously-saved values otherwise). (SEED-007 Decision 3-A; aligns with `project_strict_loadermode_separation` locked 2026-05-06)
- **L-04:** Math + signatures unchanged — `buildExportPlan` signature, panel prop signatures, `summary.regions` derivation all unchanged. Per-bucket math is identical because peak-anchored override math is canonical-relative (memory `project_peak_anchored_invariants.md`).

### UX Nudge — One-Shot Toast (SEED-007 "Optional UX nudge", planner-decided)
- **D-01:** Ship the toast in **Phase 36** (not deferred to v1.6). Cheap signal (~30-40 LOC + one-shot localStorage suppress key) that prevents the exact confusion that triggered SEED-007 from recurring during v1.5→v1.6 gap.
- **D-02:** Trigger condition — fire only when the user toggles `loaderMode` AND at least one bucket has overrides (`overridesAtlasSource.size > 0 || overridesAtlasLess.size > 0`). No override applied yet → no toast. Matches SEED-007 verbatim.
- **D-03:** Suppression key — `localStorage.setItem('stm.overrideModeToast.suppressed', 'true')` via "Don't show again" button. Per-machine, not per-project. Won't roam in `.stmproj` (the concept isn't project-scoped). Fresh machine shows it again, which is acceptable.
- **D-04:** Toast copy — *"Overrides are tracked per loader mode — atlas-source and atlas-less each have their own."* (Slightly more explanatory than SEED-007's verbatim "Overrides are tracked per loader mode." — spells out the consequence.) Two actions: `[Don't show again]` + `[Close]`.

### Migration + Stale Banners (when legacy file routes per-bucket)
- **D-05:** Migration banner aggregates — show `Updated {N1+N2} override(s) to per-region keys.` Single aggregate count. Existing banner contract preserved; renderer-side formatter untouched.
- **D-06:** Stale-overrides banner unions keys — both buckets' stale keys merged into the existing `staleOverrideKeys: string[]` list with no per-bucket label. Stale keys are dropped regardless of origin bucket.
- **D-07:** IPC payload — `MaterializedProject.migratedKeyCount` stays a single summed number (main-side sums after running `migrateOverrides` per bucket); `MaterializedProject.staleOverrideKeys` stays a single unioned list. Zero IPC contract change. Renderer banner code untouched.

### Clear / Reset Scope
- **D-08:** Per-row Clear (OverrideDialog "Clear" path) acts on the active bucket only. Strict separation — clearing CIRCLE in atlas-source mode leaves any atlas-less CIRCLE override untouched. Same path as Apply: both write to the active slice only.
- **D-09:** No bulk "wipe all overrides" path exists today; no decision needed there. If one is added later, default would be active-bucket-only by analogy with D-08.
- **D-10:** OverrideDialog stays unaware of the inactive bucket — multi-row selection lives in the active panel; Apply writes to the active bucket only; no `(atlas-less: 75%)` hint in the dialog. Simplest mental model.

### Dirty-Detection + Recovery Payload
- **D-11:** `AppShell.lastSaved` snapshot extends to both buckets — `{ overrides: Record<string,number>, overridesAtlasLess: Record<string,number>, samplingHz, sharpenOnExport, safetyBufferPercent }`. Dirty = either bucket differs from snapshot. Mode-switches alone (no edits) stay clean; applying override in any bucket marks dirty.
- **D-12:** `skeletonNotFoundError.mergedOverrides` carries both buckets across locate-skeleton recovery — **rename the field to `mergedOverridesBuckets: { overrides: Record<>, overridesAtlasLess: Record<> }`**. Per-bucket migration re-runs main-side against the resolved skeleton. Active-bucket-only here would be silent data loss for the inactive bucket.

### AppShell State Shape + Slice Derivation
- **D-13:** Two named `useState<Map<string, number>>` hooks. Preserve existing `overrides` variable name (now semantically "atlas-source bucket") + add `overridesAtlasLess`. Active slice = `loaderMode === 'atlas-less' ? overridesAtlasLess : overrides`. Minimum churn — existing references to `overrides` stay valid where they meant atlas-source.
- **D-14:** Single memoized `activeOverrides` at top of AppShell — `const activeOverrides = useMemo(() => loaderMode === 'atlas-less' ? overridesAtlasLess : overrides, [loaderMode, overrides, overridesAtlasLess])`. Pass `activeOverrides` to the 4 `buildExportPlan` call sites, the `OverrideDialog` apply handler, and both panels (`GlobalMaxRenderPanel`, `AnimationBreakdownPanel`). Panel prop signatures unchanged per REQ OVR-05 (they still receive `overrides` — the active slice goes in by that name).

### Claude's Discretion
None — every gray area resolved to a specific choice.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Design (do NOT relitigate)
- `.planning/seeds/SEED-007-split-overrides-per-loader-mode.md` — Decisions 1, 2-A, 3-A locked 2026-05-12; math-verified mode-invariant; surfaces-touched preliminary scope; optional UX nudge (now D-01..D-04). Flip `status:` from `dormant` to `closed` at phase close per REQ OVR-05 acceptance.
- `.planning/REQUIREMENTS.md` §"Split Overrides Per Loader Mode (SEED-007)" — OVR-01..OVR-07 acceptance criteria.
- `.planning/ROADMAP.md` §"Phase 36: Split Overrides Per Loader Mode" — Goal + success criteria + planner expectations.

### Locked Project Invariants (memory)
- `project_strict_loadermode_separation` (locked 2026-05-06) — atlas-source and atlas-less are self-contained; load.atlasPath gates every read of the opposite artifact set. This phase extends the principle to overrides state.
- `project_peak_anchored_invariants` (2026-05-05 redesign) — 3 invariants proving the math is mode-invariant; `applyOverride` is canonical-relative.
- `project_compute_export_dims_canonical_base` — canonical-base contract; `outW = ceil(canonicalW × effScale)`.
- `project_atlas_less_primary_workflow` — atlas-less is the Esoteric-recommended primary workflow; UX cost matters here.

### Code Anchors (read before modifying)
- `src/shared/types.ts:984-1052` — `ProjectFileV1` + `AppSessionState` + `MaterializedProject` shapes. New field `overridesAtlasLess: Record<string, number>` lands in `ProjectFileV1` (line ~989 area) and `AppSessionState` (line ~1039 area); `MaterializedProject` payload field gets renamed per D-12.
- `src/core/project-file.ts:129-274` — Validator pre-massage block. Add `overridesAtlasLess` missing → `{}` substitution following the exact pattern at lines 174-186 (loaderMode) and 189-199 (sharpenOnExport). `serializeProjectFile` (line 313+) writes both buckets.
- `src/main/project-io.ts:573-580, 1075` — Migration call sites. Run `migrateOverrides` per-bucket; sum `migratedKeyCount`; union `stale[]`. Legacy-routing logic lands at the Open seam: read saved `loaderMode`, decide which bucket gets the legacy map (D-02 / L-02). Recovery field rename per D-12 propagates through `mergedOverrides{Buckets}` references.
- `src/main/override-migration.ts:92-176` — `migrateOverrides` itself is unchanged in body (mode-invariant — `summary.regions` is the skin-manifest pass, JSON-only). Called twice from `project-io.ts`; per-bucket; results summed.
- `src/renderer/src/components/AppShell.tsx:343-345, 363-377, 428-437, 520+, 639+, 761+, 806-841, 875+` — State init (two Maps), `lastSaved` snapshot extension (D-11), `skeletonNotFoundError.mergedOverridesBuckets` rename (D-12), OverrideDialog handler (writes to active slice only), 4 buildExportPlan call sites (read `activeOverrides`), Save serializer (writes both buckets), atlas-preview wiring.
- `src/renderer/src/lib/export-view.ts:165-262` — `computeExportDims` reference (canonical-base contract). Not modified.
- `src/core/overrides.ts` — `applyOverride` / `clampOverride` (peak-anchored math). Not modified.

### Audit Doc (existing surface)
- `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` — not touched by Phase 36 (Phase 37 work).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Toast component** — assumed to exist in the existing notice/banner system (e.g., `staleOverrideNotice`, `overrideMigrationNotice`, `loaderModeHealedNotice` all live near `AppShell.tsx:392-420`). The new mode-toggle toast slots into the same banner stack pattern. Planner: confirm the existing pattern is reusable; if not, add a minimal one-shot toast that mirrors the loaderModeHealedNotice pattern.
- **Validator pre-massage precedent** — `project-file.ts` already pre-massages 3 missing fields exactly the way `overridesAtlasLess` will be: `loaderMode` (substitute `'auto'`), `sharpenOnExport` (substitute `false`), `safetyBufferPercent` (substitute `0`). Copy this pattern verbatim for `overridesAtlasLess` (substitute `{}`).
- **`migrateOverrides`** is already pure-TS, no DOM, no node:* — call it twice from `project-io.ts` with no internal changes. Two-pass determinism (Pass 1 / Pass 2 / Pass 3) and the falsifying-regression test at `tests/main/override-migration.spec.ts:Test 6` stay intact.
- **`lastSaved` dirty-snapshot pattern** — AppShell already snapshots primitives + `Record<string,number>` for the dirty signal at lines 363-377. Adding a sibling `overridesAtlasLess: Record<string,number>` slot follows the existing shape.

### Established Patterns
- **Pitfall 3 boundary** — Maps live ONLY in renderer/main memory; IPC + on-disk shape uses `Record<string, number>`. Conversion happens at the IPC seam (`new Map(Object.entries(...))` on read; `Object.fromEntries(...)` on Save). Applies symmetrically to both buckets.
- **One-shot suppress via localStorage** — first use in this app, but standard pattern; key `stm.overrideModeToast.suppressed`. No new dependency.
- **Banner stack** — `loaderModeHealedNotice`, `staleOverrideNotice`, `overrideMigrationNotice` all dismissible, auto-clear on Save, render above tab content per `project_alert_bars_top_on_both_tabs`. New toast piggybacks on the same stacking discipline.

### Integration Points
- **Two `useState` Maps in AppShell** flow → `activeOverrides` useMemo → panels (existing `overrides` prop name preserved) and `buildExportPlan` call sites (existing `overrides` arg position preserved).
- **OverrideDialog apply handler** at `AppShell.tsx:520+` switches from `setOverrides` to `setActiveOverrides`-equivalent (writes to whichever bucket is currently active, never to inactive).
- **Save path** at `AppShell.tsx:806-841` serializes both buckets — `overrides: Object.fromEntries(overrides)` AND `overridesAtlasLess: Object.fromEntries(overridesAtlasLess)`.
- **`materializeProjectFile`** at the Open seam runs `migrateOverrides` twice (once per bucket), each against the same `summary.regions` (mode-invariant). Sums `migratedKeyCount`. Unions `stale[]`.
- **`skeletonNotFoundError.mergedOverridesBuckets`** carries both buckets through the locate-skeleton recovery + reload IPC chain (rename per D-12).

</code_context>

<specifics>
## Specific Ideas

- **Toast copy verbatim:** *"Overrides are tracked per loader mode — atlas-source and atlas-less each have their own."*
- **localStorage suppress key:** `stm.overrideModeToast.suppressed` (string `'true'`).
- **Field rename:** `skeletonNotFoundError.mergedOverrides` → `skeletonNotFoundError.mergedOverridesBuckets: { overrides: Record<>, overridesAtlasLess: Record<> }`. Every reader of this field must be updated atomically.
- **Tests required (per OVR-06 + OVR-07):**
  - `tests/main/override-migration.spec.ts` — per-bucket migration + legacy-routing fixture (saved `loaderMode === 'atlas-less'` → entire legacy map lands in `overridesAtlasLess`).
  - `tests/core/project-file.spec.ts` — round-trip both buckets; legacy pre-massage path (`overridesAtlasLess` missing → `{}`).
  - New AppShell mode-switch divergence test — apply override in atlas-source, switch to atlas-less, assert atlas-less bucket empty; apply in atlas-less, switch to atlas-source, assert atlas-source bucket retains pre-switch value.
- **Phase close housekeeping:** flip `.planning/seeds/SEED-007-split-overrides-per-loader-mode.md` frontmatter `status:` from `dormant` to `closed` with closing phase reference (per REQ OVR-05 success-criteria 5).

</specifics>

<deferred>
## Deferred Ideas

- **Decision 3-C escape hatch** — "Copy from X mode" one-click button (rejected at SEED-007 capture in favor of 3-A). Planner MAY revisit in v1.6+ if user-feedback after 2-A/3-A ships indicates the friction is real. Out of scope for Phase 36 by SEED-007 lock.
- **Per-skin overrides** — surfaced in SEED-007's "When to Surface" list as a potential future scope item. Not in v1.5; capture for future seed if a user signal lands.
- **Bulk override clear** — no path exists today; if added later, default to active-bucket-only by analogy with D-08.
- **Inactive-bucket visibility hint in OverrideDialog** — rejected in D-10 for simplicity. Could revisit if users report the inactive bucket feels invisible/forgotten.

### Reviewed Todos (not folded)
None — `cross_reference_todos` matched nothing for this phase (the three pending todos belong to Phase 38 and Phase 39).

</deferred>

---

*Phase: 36-split-overrides-per-loader-mode*
*Context gathered: 2026-05-13*

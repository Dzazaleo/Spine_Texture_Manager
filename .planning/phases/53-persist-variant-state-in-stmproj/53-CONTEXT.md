# Phase 53: Persist Variant State in `.stmproj` - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the **Export Variant** dialog's **scale rows** round-trip through `.stmproj`
save/load, and ensure the **chosen output location** also round-trips. The latter
is achieved by **reusing the already-persisted `lastOutDir`** — so the only
genuinely new persisted field is `variantRows` (the list of scales).

Persistence is **additive-optional**: no `.stmproj` version bump, validator
pre-massages missing → default, old files open cleanly. Requirement: **SCALEUI-03**.

**In scope:**
- Add `variantRows` (the per-row `scale`s) to the on-disk `ProjectFileV1` + the
  in-memory `AppSessionState`, additively (optional, missing → default).
- Save serializes the current `variantRows`; load restores them into AppShell's
  lifted `variantRows` state (regenerating fresh `id`s).
- Back-compat: old `.stmproj` with no `variantRows` → opens with the default
  single row at `0.5`.
- Editing rows participates in **dirty detection** (the project becomes "unsaved";
  the quit-guard protects the rows) — see D-03.
- Output location: **reuse the existing `lastOutDir`** (already persisted, already
  the variant picker's pre-fill + start path) — no new output field.
- Tests: a `.stmproj` round-trip spec (save → load → rows restored) + a back-compat
  spec (old file with no field → default row), mirroring `tests/project-io.spec.ts`.

**Out of scope (do NOT build here):**
- A dedicated `variantOutputDir` field — explicitly rejected (D-01); the variant
  flow shares the one `lastOutDir`.
- Any stale-path validation / fs-existence check on load (D-02) — the variant flow
  always opens the native picker, so a saved dir is only a start hint and can never
  hard-fail; SC#3 is satisfied by the existing architecture.
- Persisting any other variant-dialog config — output mode / atlas opts / sharpen /
  safety buffer / overrides **already** round-trip as top-level `.stmproj` config;
  nothing new needed for them (D-04).
- Serializing row `id`s (ephemeral UI keys — regenerated on load) or the per-row
  `activePx` transient edit state (never persisted).
- **Saved scale-sets / variant presets** (named, reusable across projects) — that's
  the deferred Future Requirement; this phase persists the current rows only.
- A `.stmproj` `version` bump (additive contract; follows the locked precedent).

</domain>

<decisions>
## Implementation Decisions

### Output-Folder Memory
- **D-01:** **Reuse the shared `lastOutDir`** for the variant output folder — do
  NOT add a dedicated `variantOutputDir`. `lastOutDir` already round-trips in
  `.stmproj` (seeded `AppShell.tsx:382`, persisted on save, restored `:1660`) and
  is **already** the variant flow's picker pre-fill (`variantDialogState.outDir`,
  `:823`) + picker start path (`onConfirmStartVariant`, `:844`). This makes the
  output-location half of SCALEUI-03 essentially **already done** — the phase
  collapses to persisting the scale rows. Rejected: a separate variant-only dir
  (more schema + wiring; the shared "last folder" is good enough and is what the
  variant flow already consumes).

### Path Portability
- **D-02:** **Leave path handling exactly as `lastOutDir` does it today** — stored
  **absolute**, read back as a **picker start hint only**, with **no existence
  check** on load. Because `onConfirmStartVariant` always opens the native picker,
  the saved dir is never written to directly and a missing/inaccessible folder
  cannot hard-fail the load — **SC#3 is satisfied by the existing architecture**,
  zero new fs/IPC code. Rejected: validate-and-clear-on-load (adds a main-side fs
  check + IPC and would alter the shared `lastOutDir` behavior for the Optimize
  flow too, for marginal UX gain).

### Dirty Tracking
- **D-03:** **Editing scale rows marks the project dirty** (unsaved). Rows are
  authored project content (like `overrides`), not mere session metadata — so the
  quit-guard must protect them, and a user who builds a scale set never silently
  loses it. This **intentionally diverges** from the reused `lastOutDir`, which
  stays **non-dirty** (persisted-on-Save only, excluded from the dirty signal at
  `AppShell.tsx:427-428`). The asymmetry is deliberate: rows = content (dirty),
  output folder = convenience memory (not dirty).
  - *Implementation note (for the planner):* the dirty derivation must compare the
    **persisted projection** — the `scale` values — against the last-saved snapshot,
    **NOT** the full `{ id, scale }` row objects. `id`s are regenerated on every
    load, so comparing whole objects would flag a false "unsaved" immediately on
    open. Compare scales (order-sensitive) only.

### Persistence Scope
- **D-04:** **Persist only `variantRows` (the scales).** Everything else the
  Export Variant dialog uses already round-trips as top-level `.stmproj` config:
  output mode (`loose|atlas|both`), `sharpenOnExport`, `safetyBufferPercent`, and
  the override buckets (`overrides` / `overridesAtlasLess`). Output dir = the reused
  `lastOutDir` (D-01). So the entire new on-disk surface is one optional array.
  Rejected: expanding to named/saved scale-sets (that's the deferred Future Req).

### Schema Contract (locked by precedent — do not relitigate)
- **D-05:** **Additive-optional, NO `.stmproj` version bump.** Add `variantRows?`
  to `ProjectFileV1` + `AppSessionState`; the validator pre-massages missing →
  default (one row at `0.5` equivalent). This follows the exact locked precedent of
  `sharpenOnExport` / `safetyBufferPercent` / `overridesAtlasLess` (see
  [[project_spine_4_2_atlas_json_precedence]] is unrelated; the `.stmproj`
  additive-no-version-bump precedent is in `types.ts` + `src/core/project-file.ts`).
  Persisted row shape carries the `scale` only (e.g. `{ scale: number }[]` or a bare
  `number[]` — planner's call; `id`/`activePx` never serialized).

### Claude's Discretion
- Exact new field name (`variantRows`) and persisted element shape (`{ scale }[]`
  vs `number[]` — `{ scale }[]` is marginally more forward-extensible).
- Where the missing→default massage lives (mirror the existing `overridesAtlasLess`
  / `sharpenOnExport` massage site in `src/core/project-file.ts`).
- How load threads restored rows into AppShell's `variantRows` (regenerating
  `crypto.randomUUID()` ids per `:567`); how the save payload is assembled in
  `buildSessionState` (`:1047`).

### Folded Todos
- **`.planning/todos/pending/2026-05-23-persist-variant-rows-and-output-location.md`**
  — the source spec for this phase (`resolves_phase: 53`, SCALEUI-03). Captured the
  feature (persist rows + output location), the established additive `.stmproj`
  pattern, the four design decisions (output-path portability, what-persists,
  scope, back-compat), and the "where to touch" file list. All four decisions are
  now resolved above (D-01..D-04). Folded in full; retire to `resolved/` on phase
  completion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 53 requirement, roadmap & source spec
- `.planning/REQUIREMENTS.md` — **SCALEUI-03** (line 46) + Traceability row (SCALEUI-03 → Phase 53);
  Future Requirements (saved scale-sets / variant presets — explicitly deferred, NOT this phase).
- `.planning/ROADMAP.md` §"Phase 53: Persist Variant State in `.stmproj`" (lines 212-220)
  — goal, the 3 success criteria (persist rows + output; old files → defaults;
  stale dir → picker, never hard-fail), and the additive-no-version-bump note.
- `.planning/todos/pending/2026-05-23-persist-variant-rows-and-output-location.md`
  — **the source spec** (folded). Established pattern, design decisions, where-to-touch.

### The `.stmproj` schema seams (additive precedent to mirror)
- `src/shared/types.ts` — `ProjectFileV1` (`:1117`, the on-disk shape) +
  `AppSessionState` (`:1207`, the in-memory editable shape). The additive-optional
  precedents to copy: `sharpenOnExport` (`:1160`), `safetyBufferPercent` (`:1168`),
  `overridesAtlasLess` (`:1133`), `lastOutDir`. Add `variantRows?` the same way.
- `src/core/project-file.ts` — the **validator pre-massage** (missing → default);
  mirror the `overridesAtlasLess` / `sharpenOnExport` / `safetyBufferPercent`
  massage for `variantRows` → default single row at `0.5`. (Layer-3 pure — keep it
  so; no DOM/Electron.)
- `src/main/project-io.ts` — load materialization + save serialization. `lastOutDir`
  is already threaded (load `:663`/`:844`, recovery `:514`); `sharpenOnExport`
  `:680`, `safetyBufferPercent` `:684`, `overridesAtlasLess` `:511`/`:644` — add
  `variantRows` alongside.

### The renderer state this persists
- `src/renderer/src/components/AppShell.tsx` — `variantRows` lifted state (`:565-567`,
  `{ id, scale }[]`, opens `[{ id, scale: 0.5 }]`); `lastOutDir` (`:382`, restored
  on load `:1660`, persisted-not-dirty `:427-428`); `buildSessionState` (`:1047`,
  assembles the save payload); the **isDirty derivation** (`:1179+` — D-03's
  compare-by-scale note applies here); `variantDialogState.outDir` pre-fill (`:823`)
  + `onConfirmStartVariant` picker (`:837-878`).
- `src/renderer/src/modals/VariantDialog.tsx` — `VariantRow` / `rows` prop shape
  (`:63`, `:98` — `{ id: string; scale: number }[]`); confirms `id` is a UI key and
  `activePx` is transient (neither persisted).

### Tests to mirror
- `tests/project-io.spec.ts` — the existing `.stmproj` round-trip + back-compat
  tests; add a variant-rows round-trip case (save → load → scales restored, fresh
  ids) + a back-compat case (old file with no `variantRows` → default single row).
  Name renderer-side tests `.spec.tsx` if any touch the renderer
  ([[feedback_renderer_ts_helper_test_breaks_typecheck_node]]).

### Architecture / purity
- `tests/arch.spec.ts` — Layer-3 purity gate. The validator massage in
  `src/core/project-file.ts` stays pure (no DOM/Electron/sharp); save/load fs stays
  in `main/`; the renderer reads precomputed values.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`lastOutDir`** (`AppShell.tsx:382`, persisted in `project-io.ts`, restored `:1660`)
  — already round-trips AND already the variant picker's pre-fill/start path. D-01
  reuses it wholesale → output-location persistence needs **zero new code**.
- **The additive-optional `.stmproj` precedent** — `sharpenOnExport` /
  `safetyBufferPercent` / `overridesAtlasLess` were each added with no version bump
  + a validator missing→default massage. `variantRows` is a fourth instance of the
  exact same pattern (types.ts shape + project-file.ts massage + project-io.ts
  serialize + AppShell restore + dirty wiring).
- **`buildSessionState`** (`AppShell.tsx:1047`) — the single place that assembles
  the save payload; add `variantRows` here.
- **`variantRows` lifted state** (`AppShell.tsx:565`) — already owns the canonical
  set; load just needs to set it (with fresh ids) and dirty needs to watch it.

### Established Patterns
- **Persisted-but-not-dirty session metadata** (`lastOutDir`/sort, `:427-428`) —
  the reused output dir follows this; **variantRows deliberately does NOT** (D-03,
  rows are content → dirty).
- **Validator pre-massage** (`src/core/project-file.ts`) — missing optional field →
  canonical default, so old files load cleanly. Layer-3 pure.
- **Ephemeral UI keys** (`crypto.randomUUID()` per row, `:567`) — never serialized;
  regenerated on load. Dirty/equality compares the persisted projection (scales).

### Integration Points
- Save: `buildSessionState` (`AppShell.tsx:1047`) → `AppSessionState.variantRows`
  → `project-io.ts` save → `ProjectFileV1.variantRows` on disk.
- Load: `.stmproj` → `project-file.ts` validator (massage missing → default) →
  `project-io.ts` materialize → AppShell restore into `variantRows` (fresh ids).
- Dirty: AppShell isDirty derivation (`:1179+`) watches `variantRows` scales vs the
  last-saved snapshot (compare scales, not row objects).

</code_context>

<specifics>
## Specific Ideas

- **User's own framing (2026-05-23):** *"rows added in the Export Variant dialog and
  saving location should persist across sessions, if project is saved."* The "if
  project is saved" phrasing motivated the output-dir reuse (D-01) and shaped the
  dirty discussion — though the user ultimately chose to mark rows dirty (D-03) so a
  built scale set is protected by the quit-guard, not silently lost.
- **The mental model is a sticky scale set.** A user who standardizes on, say,
  `0.5 / 0.36 / 0.57` for a project wants those rows back on reopen — hence rows are
  treated as authored content (dirty-tracked), while the output folder is just a
  remembered convenience (shares `lastOutDir`, not dirty).

</specifics>

<deferred>
## Deferred Ideas

- **Dedicated `variantOutputDir`** (variant remembers its own folder, independent of
  the Optimize export folder) — rejected this phase (D-01); revisit only if sharing
  `lastOutDir` proves confusing in practice.
- **Saved scale-sets / variant presets in `.stmproj`** (named, reusable scale lists,
  possibly cross-project) — REQUIREMENTS.md Future Requirement; this phase persists
  the *current* rows only.
- **Validate-and-clear a stale saved output dir on load** — rejected (D-02); the
  always-open picker already makes a stale path harmless. Possible future polish if
  a "start at a clean default" UX is ever wanted.
- **Persisting the rest of the variant dialog config explicitly** — unnecessary;
  output mode / sharpen / safety buffer / overrides already round-trip as top-level
  config (D-04).

### Reviewed Todos (not folded)
None — the one matching todo was folded (it is the phase's source spec).

</deferred>

---

*Phase: 53-persist-variant-state-in-stmproj*
*Context gathered: 2026-05-24*

# Phase 51: Batch Variant Export - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Fan one master export out to **N resolutions in a single run** — N scales → N
sibling folders — reusing the **proven single-scale variant export per scale**.
This is the v1.7 finale; the engine already exists (Phase 49 `handleExportVariant`:
bake → `s×` sizing → write under one rollback Set; Phase 50 two-way factor↔px
control on the setup-pose bbox). Phase 51 turns the single-scale Export Variant
dialog into a **multi-row scale list** and orchestrates one export per scale.
Requirement: **EXPORT-04**.

**In scope:**
- A **multi-row scale list** in the existing `VariantDialog` — each row is the
  Phase-50 two-way control (factor / target-W / target-H, aspect-locked, uniform);
  add/remove rows; opens with one row at `0.5`.
- Batch orchestration: iterate the proven single-scale export once per scale,
  each variant landing in its own `{PARENT}/{NAME}@{s}x/` sibling folder under one
  user-chosen parent (the no-collision fan-out the Phase-49 layout was designed for).
- **Continue-on-error** cross-variant policy; each folder atomic on its own.
- **Per-folder result surface** (✓/✗ + reason) + aggregate count.
- **Cancel** = stop after the current variant.
- Duplicate-token detection (pre-flight block) + one overwrite choice for the run.
- Dual-runtime (4.2 + 4.3) + dual-mode (atlas-source + atlas-less) coverage —
  each batch entry is byte-identical to what the single-scale path produces for
  that scale (the SC#2 faithfulness bar).

**Out of scope (later phases / locked elsewhere — do NOT build here):**
- **What-if preview** (per-scale dims/peak vs source; Atlas Preview reflecting a
  selected scale) — Future Requirement; deferred to its own phase / v1.8 (user
  decision this discuss, 2026-05-23).
- **Unified Export dialog (Optimize ⊕ Variant merge)** — Optimize Assets stays a
  SEPARATE, byte-untouched action (49-D-04 preserved); the merge is a deferred
  **v1.8 UX refactor** (user challenged + accepted the keep-separate rationale).
- **Per-scale per-attachment overrides** (independent buckets per scale) — Future
  Requirement L-05; batch uses the ONE active override bucket for all scales.
- **Scale | Output | Batch tabs** — NOT introduced; the dialog stays single-pane
  (overturns the 49-D-06 / 50-D-09 "tabs land at Phase 51" expectation — see D-06).
- Any change to the export engine / bake / `buildExportPlan` / atlas-writer /
  package layout / folder-naming convention — shipped Phases 48–49, reused unchanged.
- Anisotropic (per-axis) scaling — LOCKED uniform-only ([[project_phase6_default_scaling]]).
- Upscaling (`s ≥ 1`) as a user feature — export edge rejects it (49-D-08).
- Quick-add scale presets / saved scale-sets in `.stmproj` — see Deferred Ideas.

</domain>

<decisions>
## Implementation Decisions

### Scale-Set Entry (the multi-row list)
- **D-01:** **Scale set = a list of rows.** Each row is the **full Phase-50
  two-way control** (factor / target-W / target-H, aspect-locked, uniform) — the
  proven single-scale control, replicated per row, with add (`+ Add scale`) and
  per-row remove. Rejected: free-text comma list and presets-first toggles
  (both lose per-entry px targeting; the list-of-rows subsumes them).
- **D-02:** **No quick-add presets.** Just the manual `+ Add scale` button; every
  row is typed from scratch. (Preset buttons like ½ ¼ ⅛ were explicitly declined.)
- **D-03:** **Dialog opens with one row at `0.5`** — immediately actionable,
  mirrors today's single-scale default. A 1-row list IS a single export.

### Action Model & Dialog Layout
- **D-04:** **Unify single + batch into the existing "Export Variant…" dialog.**
  The one toolbar button (`AppShell.tsx:2234-2241`, `onClickExportVariant`) opens
  the dialog; **1 row = a single export** (today's behavior, unchanged), **2+ rows
  = a batch**. No separate "Batch Export…" action, no mode switch. Rejected: a
  distinct batch toolbar button (two doors, duplicated chrome).
- **D-05:** **"Optimize Assets" stays a SEPARATE, byte-untouched action.** The
  user challenged "why two buttons" and accepted the rationale: the dividing line
  between Optimize and Variant is the **baked JSON**, which embodies a real intent
  split — *Optimize = same rig, stop wasting atlas pixels* (no new JSON, drop
  assets back into THIS project) vs *Variant = a genuinely smaller, self-contained
  rig* (new JSON, own folder). At 100% there's no smaller rig to make, so
  "Optimize = Variant at 1.0" collapses. 49-D-04 ("shipped Optimize flow left
  untouched") is PRESERVED. The Optimize⊕Variant **merge is a deferred v1.8 UX
  refactor**, not Phase-51 work (refactoring the app's oldest/most-trusted flow in
  the v1.7 finale is the riskiest possible timing).
- **D-06:** **Single pane, no tabs.** Scale-list rows on top → output mode / atlas
  opts / sharpen / safety buffer → progress / per-folder results. **This overturns
  the earlier "Scale | Output | Batch tabs land at Phase 51" expectation**
  (49-D-06, 50-D-09): with the preview deferred (D-11) and batch being just a
  multi-row Scale section, the dialog stays lean enough that tab chrome adds
  nothing. Honors 50-D-09's "size + output + quality at a glance." **Downstream:
  do NOT introduce tabs; do NOT cite 49-D-06/50-D-09 to re-add them.**

### Batch Failure Semantics
- **D-07:** **Continue-on-error; each `{NAME}@{s}x/` folder is atomic on its own.**
  A failure in one variant (write error, oversize-forced rollback, sharp error)
  does NOT stop the others. Each variant keeps the Phase-49 per-export rollback
  contract (its own `written` Set → fully lands or fully rolls back). You keep
  every variant that worked. Rejected: all-or-nothing (one bad scale discards all
  good work) and stop-on-first-failure (no clear failed-list).
  - *Implication for the engine:* the existing `handleExportVariant` uses ONE
    module-level `variantExportInFlight` re-entrancy slot + ONE `written` Set per
    call. Batch must give **each variant its own rollback scope** so a per-folder
    failure cleans only that folder (NOT a shared batch-wide Set). See research flags.
- **D-08:** **Per-folder result list** in the dialog's `complete` state — each
  scale's folder shown with ✓ exported / ✗ reason, plus an aggregate ("2 of 3
  exported"). Extends today's single-scale summary; reuses the per-row error
  surfacing pattern (`VariantDialog.tsx:209-239`). Rejected: aggregate-only.

### Cancellation
- **D-09:** **Cancel = stop after the current variant.** A Cancel button gates
  the batch **between** variants: the in-flight folder finishes (it's atomic),
  remaining scales are skipped, completed variants are kept. The `complete` state
  shows what landed + "cancelled before `{NAME}@{s}x`". Rejected: abort + roll
  back the in-flight variant (more aggressive) and no-cancel (a long batch needs
  an escape hatch — single-scale's `() => false` no-cancel is acceptable for one
  export, not for N). *Note:* `runExport`/`runRepack` already accept a
  `() => boolean` cancel callback (today hard-wired `() => false`,
  `variant-export.ts:239,250`); D-09 only needs a **between-variants** gate, not
  threading cancel into a variant's workers.

### Collision & Validation
- **D-10:** **Duplicate normalized tokens → flag + block Start.** Two rows whose
  scales normalize to the same `@{s}x` token (e.g. `0.5` and `0.50001` → both
  `@0.5x`, via `formatScaleToken` = `String(Number(s.toFixed(4)))`,
  `variant-export.ts:57`; or `0.5` entered twice) are detected at pre-flight: the
  offending rows are highlighted and **Export is disabled** with an inline hint
  ("two scales produce @0.5x"). No silent collapse, no in-run overwrite.
- **D-11 (carried as the existing single-scale rule):** **Start stays disabled
  while any row is invalid** (blank / non-finite / `s ≤ 0` / `s ≥ 1`) — mirror the
  existing single-scale D-04/D-08 cheap renderer gate (`VariantDialog.tsx:127-128`);
  the authoritative reject stays the main-side `VariantScaleError`. Invalid rows
  are a pre-flight gate, NOT a runtime per-variant failure.
- **D-12:** **One overwrite choice for the whole run.** Reuse the Phase-49
  picker/confirm (`onConfirmStart` → `{ proceed, overwrite?, outDir? }`,
  `VariantDialog.tsx:158-163`; AppShell `onConfirmStartVariant`): one parent-folder
  pick + one overwrite decision applies to all variants. With overwrite off, any
  pre-existing `{NAME}@{s}x/` folder's variant **fails per-folder** and shows in the
  result list (consistent with D-07 continue-on-error). **Zero new collision UX.**
  Rejected: per-folder prompt (tedious) and a pre-scan warn step (not needed —
  the per-folder failure path already surfaces it).

### Override Behavior Across the Batch
- **D-13:** **The one active override bucket applies uniformly to every scale.**
  Overrides are **%-of-peak** (relative; D-91 — 100% = source dims, never
  exceeded), so they scale cleanly to each variant's `s × peak` with no ambiguity.
  Every variant = "your tuned export, just smaller," at its own scale (49-D-07
  math reused unchanged: variant row `effectiveScale = s × master_effectiveScale`).
  The active bucket already follows `loaderMode` via `effectiveOverrides`
  (`AppShell.tsx:408-411`) — no new routing. **Per-scale override divergence stays
  deferred** (L-05 / Future Requirement) — see Deferred Ideas.

### Locked Carry-Forwards (from SEED-010 + Phases 48–50 — do NOT relitigate)
- **L-01:** Variant production = core **`bake()`** (full `SkeletonJson.scale`
  similarity bake), NOT a bone scale. Field-identical on 4.2 + 4.3 (spikes 001–003).
- **L-02:** **`variant_peak = s × master_peak`** (exact). The sampler's `peakScale`
  is invariant under the bake — **NEVER re-sample a variant.** Batch = N pure
  arithmetic re-sizings, one bake per scale; no re-sampling anywhere.
- **L-03:** `core/` stays **Layer-3 pure**; `bake()` returns NEW JSON — the source
  JSON is never mutated. The skeleton-JSON write lives in `main/`
  (`skeleton-json-writer.ts`).
- **L-04:** **Dual-runtime (4.2 + 4.3) + dual-mode (atlas-source + atlas-less) are
  hard requirements.** The bake is atlas-independent; the export pipeline already
  branches on `loaderMode`. Each batch variant must satisfy this (SC#2).
- **L-05:** **Folder layout `{PARENT}/{NAME}@{s}x/` sibling subfolders, clean
  basenames** (49-D-01/D-02), is LOCKED and was DESIGNED as the no-collision batch
  fan-out. The scale token rides the folder; inner basenames stay clean `{NAME}.*`.

### Claude's Discretion
- **Batch orchestration seam:** renderer loops `window.api.exportVariant` N times
  (awaiting each → the existing `variantExportInFlight` slot serializes naturally),
  vs a new main-side `variant:exportBatch` channel that loops internally. The
  batch channel is likely cleaner for per-variant progress + cancel + per-folder
  results + per-variant rollback scope — researcher/planner pick. EITHER way:
  preserve each variant's own rollback Set (D-07) and re-use `handleExportVariant`'s
  proven body per scale (do NOT re-implement bake/size/write).
- **Scale-list internal data model** (array of `{ id, scale }` rows; how px-field
  edit state is tracked per row — generalize `VariantDialog`'s single `activePxField`
  / `activePxRaw` to per-row).
- **In-run progress display** (e.g. "variant 2 of 3 — {NAME}@0.36x" + the existing
  per-file `export:progress` bar) — not separately decided; pick the clearest.
- **Master summary tiles** (today's display-only master-sized plan tiles) — keep
  as a master reference or drop in the batch dialog; minor, your call.
- Per-row live folder hint (`{NAME}@{s}x`) reuse of the inline `scaleToken`
  normalization (`VariantDialog.tsx:293`).
- Whether to expose a `%` readout per row (the user thinks in percent) — minor
  enrichment; flagged but not required this phase (see Deferred Ideas).
- Toolbar/label copy (the button stays "Export Variant…"; D-04 — no rename).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 51 requirements & roadmap
- `.planning/REQUIREMENTS.md` — **EXPORT-04** (line 38, the sole Phase-51 req);
  Future Requirements (48-52, incl. the deferred what-if preview L-52 + per-scale
  override behavior); Out of Scope (54-60); Traceability row 80 (EXPORT-04 → Phase 51).
- `.planning/ROADMAP.md` §"Phase 51: Batch Variant Export" (lines 169-181) — goal,
  depends-on (Phase 49 single-scale + Phase 50 input), SC#1 (multi-scale, one
  folder each) + SC#2 (each variant identical to single-scale, dual-runtime +
  dual-mode), the 2 TBD plan stubs (51-01 orchestration, 51-02 folder-naming UX +
  progress/result surfacing), and the note that folder-naming for per-scale folders
  is shared with Phase 49's (now-locked) naming question.

### Phase 49/50 carry-forwards (the engine + dialog this extends)
- `.planning/phases/49-single-scale-variant-export/49-CONTEXT.md` — **D-01/D-02**
  (the `{NAME}@{s}x/` sibling-folder layout, designed for batch fan-out), **D-03**
  (existing overwrite/conflict reprobe), **D-04** (Optimize untouched; SEPARATE
  action), **D-06** (single-pane tab-ready — see D-06 above for the overturn),
  **D-07** (variant inherits full active config; %-of-peak override math),
  **D-08** (`s ≥ 1` rejected at the edge), **L-01..L-05** locked carry-forwards;
  Deferred Ideas (batch fan-out, unified Export dialog, cross-SCALE overrides).
- `.planning/phases/50-rig-bounds-two-way-scale-dimension-input/50-CONTEXT.md` —
  **D-01/D-02/D-03** (the two-way factor↔W↔H control each row replicates),
  **D-04** (over-range allow-but-disable-Export), **D-09** (enrich-in-place,
  defer tabs to 51 — overturned here per D-06).

### The engine to reuse per scale (DO NOT re-implement)
- `src/main/variant-export.ts` — **`handleExportVariant`** (the single-scale
  orchestrator: D-08 guard → read source → `bake(s)` → `{PARENT}/{NAME}@{s}x/` →
  write-JSON-first → `buildExportPlan(scaleSummaryPeaks(summary,s), …)` UNCHANGED →
  `runExport`/`runRepack` under one `written` Set → merge → `ExportResponse`);
  **`formatScaleToken`** (`:57`, the canonical `@{s}x` token, D-10's dedup key);
  the module-level **`variantExportInFlight`** re-entrancy slot (`:67`) — batch
  must keep variants serialized + each with its own rollback scope (D-07).
- `src/main/ipc.ts:1053-1090` — the `variant:export` channel + `handleExportVariant`
  wiring; the model for any new `variant:exportBatch` channel.
- `src/preload/index.ts:127-145` — `exportVariant` preload binding (the shape a
  batch binding mirrors).
- `src/core/scale-bake.ts` — `bake(json, s)` pure transform (Phase 48); one bake
  per scale.
- `src/core/scale-summary-peaks.ts` — `scaleSummaryPeaks(summary, s)` (the `s×`
  peak arithmetic; L-02 — never re-sample).
- `src/core/export.ts:185-471` — `buildExportPlan` (reused UNCHANGED per scale;
  override %-of-peak, safety buffer, ≤1.0 clamp, `outW/outH`).
- `src/main/image-worker.ts` (`runExport`) / `src/main/repack-worker.ts`
  (`runRepack`, `AtlasOpts`) / `src/main/atlas-writer.ts` (`buildAtlasText`) —
  the per-mode write pipeline; both accept the `() => boolean` cancel cb (D-09).
- `src/main/skeleton-json-writer.ts` — `writeSkeletonJsonAtomic` (atomic `.tmp`+
  rename; registers paths in the rollback Set).

### The dialog + wiring this extends (renderer)
- `src/renderer/src/modals/VariantDialog.tsx` (753 lines) — the dialog to extend
  to a multi-row scale list: `VariantDialogProps` (`:50-100`) currently single
  `scale`/`onScaleChange` → becomes a list; the export trigger `onStart`
  (`:147-254`) loops/awaits per scale; the cheap invalid gate (`:127-128`, D-11);
  the inline `scaleToken` folder hint (`:293`); the complete-state summary +
  per-row error surface (`:209-239`, extend to per-folder, D-08); `useFocusTrap`
  usage (`:268-270` — note [[feedback_renderer_ts_helper_test_breaks_typecheck_node]]
  + the Phase-50 focus-trap fix `7fe4528`).
- `src/renderer/src/modals/variant-scale-derive.ts` — `displayFactor` /
  `pxFromScale` / `scaleFromPx` (the per-row two-way derive helpers, reused per row).
- `src/renderer/src/components/AppShell.tsx` — `onClickExportVariant` +
  `variantDialogState` (`:557`, `:2234-2241`); the picker-only
  `onConfirmStartVariant` (`:823-845`, D-12); `effectiveOverrides` selector by
  `loaderMode` (`:408-411`, D-13); `summary.bbox` flow (`:137-145` in the dialog).

### Architecture / purity
- `tests/arch.spec.ts` — Layer-3 purity gate. Any new orchestration math stays
  pure in `core/`; bake/sizing pure; JSON-write + `sharp` stay in `main/`; the
  renderer reads precomputed values, never imports `core/`.

### Memory landmines to honor
- [[feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam]] — if batch
  routes through the runtime facade (it does, via `buildExportPlan`/summary), verify
  every entrypoint resolves (vitest setupFile / built CJS worker / `npm run cli` tsx).
- [[feedback_renderer_ts_helper_test_breaks_typecheck_node]] — name new renderer
  tests `.spec.tsx` (or exclude in `tsconfig.node.json`); a renderer `.ts` test hits
  the node program's glob → TS6307 RED, missed by the vitest-only self-check.
- [[feedback_new_committed_fixtures_need_safe01_denylist]] /
  [[feedback_gitignore_fixtures_check_test_refs]] — if batch tests commit any NEW
  fixture dir, co-extend `SAFE01_EXCLUDED_PREFIXES` in
  `tests/safe01/discover-fixtures.ts` AND prove it git-tracked. (Likely NONE needed
  — batch reuses the Phase-48/49 committed fixtures.)
- [[feedback_fix_review_blockers_before_close]] — this is a side-effecting,
  data-writing feature; fix correctness/data-integrity review blockers before close
  (each `{NAME}@{s}x/` folder must be atomic — no half-written package, D-07).
- [[feedback_verify_whole_ci_surface_locally]] / [[feedback_release_yml_diverges_from_ci_yml]]
  — local green ≠ CI green; release.yml is a separate gate.
- [[project_reg4701_buildsummary_cross_runtime_fixed]] /
  [[project_shared_42base_subclass_43_dualruntime_hazard]] — materialize skeletons
  only via `load.runtime.makeSkeleton`; never a hardcoded 4.2 ctor (silent 4.3 fails).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`handleExportVariant`** (`src/main/variant-export.ts:69`) — the entire proven
  single-scale orchestration; batch calls it (or its body) once per scale. The
  highest-leverage reuse in the phase: SC#2 ("each variant identical to single-scale
  path") is satisfied *by construction* if batch literally reuses this per scale.
- **`variant:export` channel + `exportVariant` preload** (`ipc.ts:1053`,
  `preload/index.ts:127`) — the IPC shape a batch channel mirrors.
- **The two-way scale control** (`VariantDialog` + `variant-scale-derive.ts`) —
  replicate per row (factor / W / H, aspect-locked, uniform).
- **`onConfirmStartVariant`** (`AppShell.tsx:823-845`) — the parent-folder picker +
  one overwrite decision (D-12), reused as-is for the whole run.
- **Per-row error surfacing + complete-state summary** (`VariantDialog.tsx:209-239`)
  — extend to the per-folder result list (D-08).
- **`() => boolean` cancel cb** already plumbed through `runExport`/`runRepack`
  (today `() => false`) — D-09 only needs a between-variants gate.

### Established Patterns
- **Layer-3 purity** (`tests/arch.spec.ts`) — bake/sizing pure; JSON-write + sharp
  in `main/`; renderer reads precomputed, never imports `core/`.
- **Per-export atomic rollback Set** (`handleExportVariant` `written` Set) —
  generalize to **per-variant** scope inside the batch (D-07), NOT one batch-wide Set.
- **Re-entrancy guard** (`variantExportInFlight`) — serializes; batch runs variants
  sequentially under one outer guard.
- **`{NAME}@{s}x/` sibling fan-out** (49-D-01) — designed for exactly this; no new
  folder convention.
- **%-of-peak override math + `loaderMode` bucket selection** — reused unchanged (D-13).

### Integration Points
- Multi-row scale list in `VariantDialog` → one parent-folder pick + overwrite
  (D-12) → batch orchestration (renderer loop OR `variant:exportBatch` channel,
  discretion) → per scale: `handleExportVariant` body (bake → write-JSON → size →
  dispatch under that variant's own rollback Set) → `export:progress` events +
  between-variants cancel gate (D-09) → per-folder result list (D-08).
- All variants share the one active config (output mode, atlas opts, sharpen,
  buffer, override bucket) — D-13 / 49-D-07.

</code_context>

<specifics>
## Specific Ideas

- **"I want 36% and 57%."** The user's mental model is a short list of percentages
  → two rows in one dialog, one parent-folder pick, one run → two sibling drop-in
  packages. The whole feature should feel like that. (They think in *percent*; the
  control speaks *factor* + px — a `%` readout per row is a flagged minor enrichment.)
- **"Same rig vs new rig" is the line.** The user explicitly stress-tested "why two
  buttons (Optimize vs Variant)?" and accepted that the baked JSON IS the intent
  boundary (Optimize = same rig, smaller atlas; Variant = a new smaller rig). Keep
  them separate (D-05); the merge is v1.8.
- **See-before-you-write is a real want** — the user wanted per-scale peak/dims +
  Atlas Preview reflection. Acknowledged as valuable, deferred to v1.8 (Future Req)
  to keep the v1.7 finale on-scope. Note the projection infra is cheap/ready
  (`export-view.ts`, `atlas-preview-view.ts` are pure) — a strong v1.8 candidate.

### Research flags (for the phase researcher — not user decisions)
- **Orchestration seam:** renderer N×`exportVariant` loop vs a main-side
  `variant:exportBatch` channel. Weigh per-variant progress + the between-variants
  cancel gate (D-09) + per-folder results (D-08) + per-variant rollback scope (D-07).
  The current `variantExportInFlight` slot serializes a renderer loop fine, but a
  batch channel owns cancel/progress/results more cleanly. Reuse `handleExportVariant`'s
  body per scale — do NOT re-implement bake/size/write.
- **Per-variant rollback scope:** today `handleExportVariant` uses one `written`
  Set per call. Continue-on-error (D-07) requires each variant to roll back ONLY
  its own folder — confirm a fresh Set per variant (not a shared batch Set).
- **Dedup key:** `formatScaleToken` (`variant-export.ts:57`) is the normalization;
  D-10's duplicate detection must use the SAME token math the folder uses (e.g.
  `0.5` and `0.50001` both → `0.5`). Decide whether dedup lives renderer-side
  (pre-flight Start gate) AND/OR main-side (defense-in-depth).
- **Cancel plumbing:** D-09 needs a between-variants gate only. Decide where the
  cancel flag lives (renderer loop break vs a main-side batch-cancel channel) and
  confirm the in-flight variant stays atomic.
- **SC#2 faithfulness matrix:** prove a batch variant is byte-identical to the
  single-scale path output for the same scale, across dual-runtime × dual-mode.
  Reuse Phase-49 committed fixtures + the drop-in faithfulness oracle
  (`tests/main/variant-dropin-faithful.spec.ts`); likely NO new fixture dir
  (pre-empt the SAFE-01 denylist landmine).
- **Verify the whole CI surface** (3-OS) + release.yml separately; renderer test
  naming (`.spec.tsx`) to avoid the typecheck:node glob.

</specifics>

<deferred>
## Deferred Ideas

- **What-if preview** (per-scale resulting dims/peak vs source; Atlas Preview
  reflecting a selected scale) — REQUIREMENTS.md Future Requirement L-52; deferred
  to its own phase / **v1.8** (user decision 2026-05-23). Infra is cheap (pure
  projections already exist) → strong v1.8 candidate.
- **Unified Export dialog (Optimize ⊕ Variant merge)** — deferred **v1.8 UX
  refactor** (49 Deferred Ideas). Keep two doors for now (D-05). Only revisit as a
  dedicated phase where refactoring the shipped Optimize flow is the actual job.
- **Per-scale per-attachment overrides** (independent override buckets per scale) —
  Future Requirement L-05. Batch uses the ONE active bucket for all scales (D-13).
- **Quick-add scale presets** (½ ¼ ⅛ buttons) — declined this phase (D-02);
  possible future convenience.
- **Saved scale-sets / variant presets in `.stmproj`** — REQUIREMENTS.md Future
  Requirement; not this phase.
- **Percent (%) readout per scale row** — minor enrichment surfaced by the user's
  percent mental model; flagged as Claude's discretion / future, not required.
- **Scale | Output | Batch tabs** — explicitly NOT introduced (D-06 overturns the
  49-D-06/50-D-09 expectation); only revisit if the dialog later grows enough to
  justify tab chrome.

### Reviewed Todos (not folded)
None — `todo.match-phase 51` returned 0 matches.

</deferred>

---

*Phase: 51-batch-variant-export*
*Context gathered: 2026-05-23*

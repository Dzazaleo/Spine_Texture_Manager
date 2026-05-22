# Phase 49: Single-Scale Variant Export - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the first end-user value of v1.7: export **one** scaled-down rig variant to a
user-chosen folder as a complete, drop-in package — the baked scaled skeleton JSON (the one
always-present new artifact) + resized textures + (per output mode) a scaled atlas — by **reusing
the existing `buildExportPlan` → image-worker / repack-worker / atlas-writer pipeline** and sizing
textures arithmetically (`variant_peak = s × master_peak`, never by re-sampling the variant). Works
for both Spine 4.2 and 4.3 rigs and both loader modes (atlas-source + atlas-less). The source
project is never modified — the only new write is the baked variant JSON. Requirements:
EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-05.

**In scope:** the new "Export Variant…" user action + a *basic* numeric scale field; the bake →
write-scaled-JSON → size-textures-`s×` orchestration; wiring into the existing export/atlas-writer
pipeline respecting `loose | atlas | both`; the per-scale output subfolder; dual-runtime +
dual-mode coverage; the source-never-modified guard; the disk-write layer for the skeleton JSON
(first time the app writes one).

**Out of scope (later phases — do NOT build here):** the rich two-way scale↔dimension input + the
setup-pose rig-bounds reference (Phase 50); batch fan-out / N scales → N folders + folder-naming UX
beyond the single-scale convention (Phase 51); cross-*scale* per-attachment override behavior
(Future Requirements); upscaling as a user feature (out of v1.7 scope); any refactor of the shipped
OptimizeDialog / Optimize Assets flow.

</domain>

<decisions>
## Implementation Decisions

### Output Folder Layout & Naming
- **D-01:** **Per-scale subfolder under a user-chosen PARENT folder.** The user picks a parent
  folder; the variant lands in its own subfolder `{PARENT}/{NAME}@{s}x/` containing **clean
  basenames** — `{NAME}.json` + (atlas/both mode) `{NAME}.atlas` + page PNG(s) + (loose/both mode)
  `images/`. `{NAME}` is the **source skeleton basename** so the package is a faithful drop-in (a
  runtime resolves `{NAME}.atlas` + `images/` as siblings of `{NAME}.json`). Forward-compatible with
  Phase 51 batch (sibling subfolders in the same parent, no collisions).
- **D-02:** **Folder name token = `{NAME}@{s}x`** (e.g. `DEMON@0.5x`). Non-round factors are
  rendered naturally (`DEMON@0.26x`). The clean basenames inside the folder are NOT scale-suffixed.
- **D-03:** A pre-existing target subfolder is handled by the **existing export overwrite /
  conflict-reprobe flow** (`handleStartExport` outDir validation + conflict re-probe when
  `overwrite === false`, `src/main/ipc.ts:736-995`) — no new collision UX is invented this phase.

### Entry Point & Scale-Input Seam
- **D-04:** **New "Export Variant…" action, SEPARATE from "Optimize Assets."** The deliverable is
  semantically different — it *writes a full scaled-down rig* (JSON + textures + atlas), not just
  optimized assets. It **reuses** Optimize's config surface (output mode, atlas opts, sharpen,
  safety buffer, native folder picker). The shipped Optimize flow is left untouched.
- **D-05:** **Phase 49 ships a BASIC numeric scale field** wired to the real export so EXPORT-01 is
  genuinely click-to-export / UI-testable *this* phase (avoids the "engine with no door" /
  opened-≠-rendered trap — [[feedback_uat_opened_is_not_rendered]]). **Phase 50 enriches the SAME
  control in place** into the two-way scale↔px binding + setup-pose bounds reference. Do not
  over-build the input now.
- **D-06:** **Dialog is a clean SINGLE PANE in Phase 49, structured tab-ready.** No tabs yet. The
  doc-dialog tab idiom (shared `TabButton`, pattern at
  `src/renderer/src/modals/DocumentationBuilderDialog.tsx:140-150` / `:851-864`, class string from
  `AppShell.tsx:1487-1515`) drops in at Phase 50/51 when the two-way input + bounds + batch give
  tabs (`Scale | Output | Batch`) real content. **Rejected:** tabs now (premature — Scale is one
  field) and a unified Optimize|Variant tabbed dialog (refactors shipped, stable code — out of
  scope; possible v1.8 UX refactor).

### Variant Sizing & Config Inheritance
- **D-07:** **The variant inherits the user's FULL active export configuration** — per-attachment
  overrides, safety-buffer %, sharpen toggle, output mode, atlas opts. Textures are sized at
  **`s × master_effectiveScale`** (override-%-of-peak applied to the `s×` scaled peak), reusing
  `buildExportPlan(summary, effectiveOverrides, opts)` (`src/core/export.ts:185-471`) **unchanged**.
  The active override bucket already follows `loaderMode` (atlas-source vs atlas-less) via
  `effectiveOverrides` (`AppShell.tsx:408-411`) — no new routing. Mental model: *a variant is your
  tuned export, just smaller.* **Rejected:** clean `s×peak` that ignores overrides/buffer (discards
  the animator's per-attachment tuning at the smaller size).
  - *Math note:* variant row `effectiveScale = s × (master effectiveScale)`, then the existing
    ≤ 1.0 texture clamp (`export.ts:279`) applies — for `s < 1` it is essentially never hit.
    `variant_peak = s × master_peak` is exact (the bake is a proven similarity); **never re-sample**.

### Scale-Direction Policy
- **D-08:** **The export edge accepts `0 < s < 1`; reject `s ≥ 1`** with a clear message (e.g.
  "variants are scaled-down — use Optimize Assets for full-size"). The core `bake()` stays
  direction-agnostic (Phase-48 D-09 preserved) — the down-scale product constraint lives ONLY at
  the export/UI edge. Should follow the project's typed-error culture (`src/core/errors.ts`).

### Locked Carry-Forwards (from SEED-010 + Phase 48 — do NOT relitigate)
- **L-01:** Variant production = **`bake()` (full `SkeletonJson.scale` similarity bake)**, NOT a
  bone scale. Proven field-identical on 4.2 + 4.3 (spikes 001–003 VALIDATED).
- **L-02:** **`variant_peak = s × master_peak`** (exact). The sampler's `peakScale` is invariant
  under the bake (measurement blind spot) — **NEVER size a variant by sampling it.**
- **L-03:** `core/` stays **Layer-3 pure**; `bake()` returns **NEW JSON — source JSON is never
  mutated.** This is the **first feature in the app's history to WRITE a skeleton JSON** — the new
  disk-write layer lives in `main/` (alongside `atlas-writer.ts` / `project-io.ts`), not in `core/`.
- **L-04:** **Dual-runtime (4.2 + 4.3) + dual-mode (atlas-source + atlas-less) are hard
  requirements.** The bake is atlas-independent by construction, so atlas-less needs no separate
  bake path; the export pipeline already branches on `loaderMode` / `atlasSource` presence.
- **L-05:** **Cross-SCALE override sharing (independent buckets per scale) is deferred** to Future
  Requirements — single-scale inherits the one active config (D-07).

### Claude's Discretion
- Exact `s`-token formatting for edge factors (trailing-zero trimming; `@0.5x` vs `@.5x`) — use the
  `@0.5x` / `@0.26x` style.
- **Where the bake → JSON-write → `s×`-sizing orchestration physically lives.** Today the renderer
  builds the `ExportPlan` (`export-view.ts`) and `main` executes (`handleStartExport`). Pick the
  cleanest seam for injecting `s` (scale the peak before plan-build vs multiply per-row
  effectiveScale by `s`) and for where `bake()` + the JSON write run (likely main-process). Keep the
  override-%-of-peak semantics correct.
- New skeleton-JSON writer helper (name/shape) — model on the atomic `.tmp` + `fs.rename` pattern
  (`project-io.ts` / `atlas-writer.ts`), and register its paths in the shared `written` rollback
  Set so a mid-write failure rolls back the JSON too.
- New IPC channel name / whether to extend `export:start` vs add a `variant:export` channel.
- Toolbar placement + icon for the "Export Variant…" action.
- Whether to add a CLI path for variant export (NOT required — the basic UI covers EXPORT-01).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 49 requirements & roadmap
- `.planning/REQUIREMENTS.md` — EXPORT-01/02/03/05 (lines 35-39); Future Requirements (48-52);
  Out of Scope (54-60); Traceability rows 74-77.
- `.planning/ROADMAP.md` §"Phase 49" (lines 131-146) — goal, depends-on (Phase 48), the 4 success
  criteria, the 3 TBD plan stubs; §Overview (line 18) — the dual-runtime/dual-mode + write-JSON
  threads.

### The proven core this phase consumes (Phase 48 output + spikes)
- `src/core/scale-bake.ts` — `bake(json, s): SkeletonJsonRaw` pure transform + `ScaleBakeError`;
  the producer of the always-present new artifact. Direction-agnostic (any finite `s > 0`).
- `.planning/phases/48-core-scale-bake-module-regression-oracle/48-CONTEXT.md` — L-01..L-07
  carry-forwards, D-09 (direction-agnostic core), D-10 (assert-known guard).
- `.planning/spikes/MANIFEST.md` — `variant_peak = s × master_peak`; the `peakScale`
  invariant-under-bake blind spot (never re-sample); the faithfulness bar.
- `.planning/seeds/SEED-010-multi-scale-per-resolution-variant-exporter.md` — the don't-scale-a-bone
  lever decision + the full diagnosis.

### Existing export pipeline the variant REUSES (with file:line)
- `src/renderer/src/modals/OptimizeDialog.tsx` (1031 lines) — the config surface to reuse: output
  mode (L512-552), atlas opts max-page/rotation/padding (L554-638), sharpen (L684-697), safety
  buffer (L652-677), folder pick via `onConfirmStart` (L281-291), IPC invoke
  `window.api.startExport(plan, outDir, overwrite, sharpenEnabled, outputMode, atlasOpts)` (L326-333).
- `src/main/ipc.ts:736-995` — `handleStartExport` + channel `export:start` (L1030): 6-arg signature;
  `loose`→`runExport`, `atlas`→`runRepack`, `both`→sequential under one shared `written: Set<string>`
  rollback set (L900); outDir validation + source-collision check + conflict re-probe.
- `src/core/export.ts:185-471` — `buildExportPlan(summary, overrides, opts)`: per-row
  `effectiveScale` (override %-of-peak L250-257, safety buffer L263-265, ≤ 1.0 clamp L279,
  source-ratio cap L304, `outW/outH = ceil(canonicalW × effScale)` L403-404); `ExportPlan.skeletonPath`.
- `src/main/image-worker.ts` — `runExport`: writes `outDir/images/{region}.png`; atlas-page
  extraction fallback; rotated un-rotate; passthrough byte-copy; atomic `.tmp`+rename.
- `src/main/repack-worker.ts` — `runRepack`: resize → `metadata()` readback (sharp-emits-truth) →
  `computeRepack` preflight (atomic-or-fail) → composite pages → `buildAtlasText`; writes
  `outDir/{projectName}.png` + `{projectName}_{N+1}.png` + `{projectName}.atlas`.
- `src/main/atlas-writer.ts:84-150` — `buildAtlasText({projectName, pages, regions})` libgdx text;
  page naming `{projectName}.png` / `{projectName}_{N+1}.png` (REPACK-05).
- `src/renderer/src/components/AppShell.tsx` — `overrides` / `overridesAtlasLess` buckets
  (L392-399), `effectiveOverrides` selector by `loaderMode` (L408-411).
- `src/renderer/src/lib/export-view.ts` — renderer-side `buildExportPlan` parity call (plan built
  before the IPC).
- `src/core/loader.ts` — `loaderMode` resolution + atlas auto-resolution (`loadSkeleton`).

### Dialog tab idiom (only if/when Phase 50/51 add tabs — NOT this phase)
- `src/renderer/src/modals/DocumentationBuilderDialog.tsx:140-150` + `:851-864` — `TabButton`
  (`role="tablist"`/`tab`, `aria-selected`); shared class string from `AppShell.tsx:1487-1515`.

### Architecture / purity
- `tests/arch.spec.ts` — Layer-3 purity gate. `bake()` stays pure; the new JSON-write + the `s×`
  sizing orchestration must respect the `core/` (pure) vs `main/` (I/O) split.

### Memory landmines to honor
- [[feedback_gitignore_fixtures_check_test_refs]] / [[feedback_new_committed_fixtures_need_safe01_denylist]]
  — if Phase 49 export tests commit any NEW fixture dir (e.g. placeholder PNGs), it must co-extend
  the SAFE-01 denylist and be proven git-tracked.
- [[feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam]] — IF the variant path routes
  through `loadSkeleton`/the runtime facade, verify it resolves under every entrypoint (vitest
  setupFile vs `npm run cli` tsx register). (The bake itself is pure JSON and bypasses the facade.)
- [[feedback_verify_whole_ci_surface_locally]] / [[feedback_release_yml_diverges_from_ci_yml]] —
  local green ≠ CI green; release.yml is a separate gate.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`bake()` (`src/core/scale-bake.ts`)** — produces the scaled JSON; the variant's only new artifact.
- **The whole sizing+writing pipeline** — `buildExportPlan` + `runExport` (image-worker) + `runRepack`
  (repack-worker) + `buildAtlasText` (atlas-writer): the variant feeds `s×`-scaled peaks into it and
  reuses every output-mode branch.
- **OptimizeDialog config controls** — reuse output mode / atlas opts / sharpen / buffer / folder
  picker for the new "Export Variant…" dialog.
- **Shared `written` rollback Set + atomic `.tmp`+rename** (`handleStartExport`) — extend to also
  cover the new scaled-JSON write so a mid-write failure rolls back the JSON too.
- **Atomic-write pattern** (`project-io.ts` / `atlas-writer.ts`) — the model for the new
  skeleton-JSON writer.
- **`effectiveOverrides` selector** (`AppShell.tsx:408-411`) — already routes the active override
  bucket by `loaderMode`; the variant uses it as-is.

### Established Patterns
- **Layer-3 purity** (`tests/arch.spec.ts`) — `bake()` pure; JSON-write + `sharp` live in `main/`.
- **Per-loaderMode override buckets** — variant uses the active bucket; no cross-bucket logic.
- **Typed-error envelope** (`src/core/errors.ts`) — the `s ≥ 1` reject (D-08) follows it.
- **Renderer builds the `ExportPlan`, main executes** — keep that seam; decide where `bake()` +
  JSON-write sit relative to it (Claude's discretion).

### Integration Points
- New "Export Variant…" toolbar action → new single-pane (tab-ready) dialog → builds an `s`-scaled
  `ExportPlan` → IPC (extend `export:start` or a new channel) → `main`: `bake(json, s)` + write the
  scaled JSON + `runExport`/`runRepack` into the `{NAME}@{s}x/` subfolder, all under one rollback set.
- `variant_peak = s × master_peak` feeds the existing `buildExportPlan` (inject `s` into the peak /
  effectiveScale); the ≤ 1.0 texture clamp still applies.
- Source JSON is read-only; the only new write is the baked variant JSON in the variant subfolder.

</code_context>

<specifics>
## Specific Ideas

- **"A variant is your tuned export, just smaller"** — the single mental model behind D-07 (full
  config inheritance) and D-04 (a separate, dedicated action).
- **Tab-ready single pane** mirrors the documentation-dialog idiom so Phase 50/51 can introduce
  `Scale | Output | Batch` tabs consistently without rework.
- **Drop-in faithfulness bar** — the `{NAME}@{s}x/` package must behave identically to the master at
  the smaller size (proven geometrically by spikes 001–003); the export wiring must not break that.

### Research flags (for the phase researcher — not user decisions)
- Pick the cleanest way to inject `s` into `buildExportPlan` so override-%-of-peak stays correct
  (override% × (`s` × peak)): scale `region.peakScale` by `s` pre-plan, vs multiply per-row
  `effectiveScale` by `s`.
- **Drop-in package completeness:** verify the baked JSON's references resolve when co-located in
  `{NAME}@{s}x/` — the atlas/page basename alignment with `{NAME}` (today the repack uses
  `projectName`), and the runtime sibling resolution of `images/` for BOTH atlas-source and
  atlas-less. The baked JSON references region *names* (invariant) — confirm nothing else needs
  rewriting.
- atlas-less + `atlas`/`both` output mode: a variant of an atlas-less source can still repack into
  an atlas (existing behavior) — confirm the scaled JSON + repacked atlas form a coherent package.

</specifics>

<deferred>
## Deferred Ideas

- **Two-way scale↔px input + setup-pose rig-bounds reference** — Phase 50 (this phase's basic scale
  field is the seam it enriches in place).
- **Batch (N scales → N folders)** — Phase 51 (reuses the `{NAME}@{s}x/` subfolder convention; the
  parent-folder layout was chosen to make batch a no-collision fan-out).
- **Tabbed variant dialog (`Scale | Output | Batch`)** — lands Phase 50/51 when content justifies it
  (D-06).
- **Unified Export dialog (Optimize | Variant tabs)** — rejected for Phase 49 (refactors the shipped
  Optimize flow); possible v1.8 UX refactor.
- **Cross-SCALE per-attachment override behavior (shared vs independent buckets)** — Future
  Requirements; single-scale inherits the one active config (L-05).
- **Upscaling (`s ≥ 1`) as a user feature** — out of v1.7 scope; the core `bake()` supports it
  (Phase-48 D-09) but the export edge rejects it (D-08).
- **Variant presets / saved scale-sets in `.stmproj`; "what-if" peak preview** — Future Requirements.
- **CLI path for variant export** — not needed for EXPORT-01 (the basic UI covers it); Claude's
  discretion if it falls out cheaply.

</deferred>

---

*Phase: 49-single-scale-variant-export*
*Context gathered: 2026-05-22*

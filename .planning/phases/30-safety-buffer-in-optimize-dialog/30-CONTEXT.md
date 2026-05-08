# Phase 30: Safety buffer in Optimize dialog — Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a user-configurable **safety-buffer percentage** control to OptimizeDialog. The buffer multiplicatively grows every row's effective scale (calculated peak AND any user-set override) BEFORE the export plan is computed, then is hard-capped at source dimensions uniformly on both axes. Buffer state persists per-project in the `.stmproj` v1 schema as an additive optional field — mirrors the Phase 28 `sharpenOnExport` plumbing precedent end-to-end (types → validator/serializer/materializer → main IPC envelope → preload bridge → AppShell lifecycle → OptimizeDialog UI).

**In scope:**
- New integer-percent input in OptimizeDialog (range 0–25%, step 1, default 0).
- Buffer threaded as a parameter to `buildExportPlan` (`BuildExportPlanOptions`) — applies inside the function so the existing source-dim cap math stays the single source of truth for "outW ≤ sourceW always".
- New `bufferCapped: boolean` flag on `ExportRow` (parallel to existing `isCapped` from Phase 22.1) — set true when buffer-pushed effective scale exceeds `sourceRatio` and is clamped. Carried in the IPC payload but not surfaced in UI for v1.3.1 (silent cap).
- `.stmproj` v1 gains `safetyBufferPercent?: number` (integer-valued). Backward-compat default 0% on missing.
- Reactive recompute: every keystroke / arrow-tick on the buffer input triggers `buildExportPlan` re-run on the renderer (buildExportPlan is pure src/core/ TS; stays on renderer for v1.3.1; only revisit if profiling proves jank on real rigs).
- Round-trip identity test: v1.2/v1.3-era `.stmproj` (no buffer field) loads with buffer=0%; freshly-saved file with non-zero buffer loads byte-equal across save/load cycles.

**Out of scope:**
- UI signal for buffer-induced cap-binding rows (count badge, per-row indicator) — silent for v1.3.1; `bufferCapped` flag exists for future surfacing.
- Sub-1% precision (decimals).
- Sliders, presets, or dropdown control variants.
- Per-row buffer overrides (user already has overrides; buffer is global).
- Web-Worker offload of `buildExportPlan` (deferred until perf measurement justifies).
- Schema-version bump (`.stmproj.version` stays at `1`; field is purely additive).
- Sampler / Spine-math changes (sampler still measures all skin-declared attachments verbatim).
- Auto-update path changes.

</domain>

<decisions>
## Implementation Decisions

### Range & Step (UI input)
- **D-01:** **Maximum buffer = 25%.** Tight rail. Animators rarely want >10–15% slack; 25% is a generous ceiling that signals "this is safety, not generic upscale". Anything beyond hits the source-dim cap on most rows anyway.
- **D-02:** **Step = 1%.** Default `<input type="number" step={1}>` granularity. Lets users dial in exactly 5%, 7%, 12% if they want. No hybrid arrow-vs-typing behavior.
- **D-03:** **Default = 0%** when project has no `safetyBufferPercent` field. Locked by REQUIREMENTS.md backward-compat (v1.2/v1.3-era files load with buffer=0%); same value applies to brand-new projects.
- **D-04:** **Strictly integer** — `<input type="number" step={1}>` blocks decimals at the input layer. Persisted shape is `number` with integer value. Validation: clamp to `[0, 25]` on commit; non-numeric input falls back to last-valid-value or 0.

### Cap-Bound Feedback (silent contract)
- **D-05:** **Silent UI** — when buffer pushes a row INTO the source-dim cap (e.g., row was 1.0× → wanted 1.05× → clamped back to 1.0×), OptimizeDialog shows nothing extra. The existing summary tiles (page count, savings %) reflect the reality. Matches how Phase 22.1's existing dims-cap behaves: capping is the contract, not an exception.
- **D-06:** **Add a separate `bufferCapped: boolean` flag** on `ExportRow` (parallel to existing `isCapped` from Phase 22.1). Keeps `isCapped`'s existing meaning ("dims-mismatch row reduced by sourceRatio") intact. `bufferCapped` fires when `bufferedEffScale > sourceRatio` and is clamped. Both flags are independent — a row could be `bufferCapped` without being `isCapped` (clean atlas, no dims drift, just the buffer pushing past 1.0). Threaded through IPC but not rendered in v1.3.1.
- **D-07:** **Literal no-op when `safetyBufferPercent === 0`.** `if (buffer === 0) skip the multiplier`. Guarantees byte-identical behavior to pre-Phase-30 export for projects that don't touch the buffer. No floating-point drift risk on existing golden tests.

### Reactivity & Math Locus
- **D-08:** **Reactive on every change** — summary tiles (`Pages`, `Saving est.`, etc.) recompute on every keystroke / arrow-tick. ROADMAP Success Criterion #1 explicitly requires this. `buildExportPlan` is pure TS, no I/O; ≤500-row rigs should run in single-digit ms.
- **D-09:** **Buffer is a parameter to `buildExportPlan`** via `BuildExportPlanOptions` — NOT a post-process step. Cleanest: buffer is part of export plan computation, not a separate stage. Cap-binding logic stays inside the function (single source of truth for `outW ≤ sourceW`). Threaded order inside the function:
  ```
  1. raw effScale  := overridePct ? applyOverride(...) : peakScale
  2. bufferedScale := buffer === 0 ? raw : raw × (1 + buffer/100)
  3. clampedScale  := Math.min(safeScale(bufferedScale), 1.0)        // Gap-Fix #1 (Phase 6)
  4. cappedScale   := Math.min(clampedScale, sourceRatio)              // Phase 22.1 dims cap
  5. isCapped      := clampedScale > sourceRatio                        // existing flag
  6. bufferCapped  := bufferedScale > sourceRatio && (raw <= sourceRatio)  // new flag
  ```
  Existing dedup (per-region `bySourcePath` Map, max-effScale wins) consumes the buffered+capped scale. Phase 22.1 POST-override passthrough partition runs unchanged on the final outW/outH — buffer effects flow through naturally.
- **D-10:** **Stay on renderer — no Worker offload.** `buildExportPlan` is pure `src/core/` TS (no DOM, no Electron, no sharp). Only revisit if profiling shows reactive jank on real-world rigs. Premature optimization otherwise.
- **D-11:** **No debounce in v1.3.1.** Every change triggers a recompute. If perf measurement during planning/execution shows jank on `fixtures/Girl/` or similar, planner can introduce a 100–150ms debounce — but ship reactive first.

### UI Placement, Copy, Persistence
- **D-12:** **Above the sharpen toggle, in a "Quality" group.** Visual hierarchy: summary tiles → quality controls (buffer + sharpen) → pre-flight body / plan list → action buttons. Group label copy ("Quality" / "Output quality") finalized at planning time per OptimizeDialog wording precedent.
- **D-13:** **Input label: `Safety buffer:  [N] %`** — matches REQUIREMENTS.md / ROADMAP.md canonical phrasing ("safety-buffer percentage control").
- **D-14:** **Persisted field name: `safetyBufferPercent`** — mirrors `sharpenOnExport` style (verbose-but-clear; includes unit). Type: `number` (integer-valued, 0–25). Same name in `.stmproj`, `MaterializedProject`, `LoadedProject`, `ExportOptions`, IPC envelope.
- **D-15:** **Tooltip on the input** — short copy explaining the cap behavior so the silent-clamp isn't surprising. Suggested: "Multiplicatively grows every row's effective scale. Capped at source dimensions — textures never extrapolate." Final wording at planning time.

### Claude's Discretion (per planner)
- Exact "Quality" group header copy ("Quality" / "Output quality" / no label, just spacing).
- Tooltip wording (per OptimizeDialog Phase 19 quantified-callout style).
- Whether the `BuildExportPlanOptions` field is `safetyBufferPercent: number` vs `bufferPercent: number` (planner picks consistent name across `BuildExportPlanOptions`, `ExportOptions`, IPC payload, `.stmproj` field — they should all share the same name).
- Where the validation clamp lives (input `onChange` handler vs setter). Both are valid; pick the one closer to existing OptimizeDialog state-flow.
- Test fixture choice for the round-trip golden test — pick the smallest existing fixture that exercises both override × buffer interaction AND the source-dim cap (likely `fixtures/SIMPLE_PROJECT/` for unit; `fixtures/Chicken-Min/` for the regression spec).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap, Requirements, Project Memory
- `.planning/ROADMAP.md` lines 708–734 — Phase 30 detail block (Goal, Depends-on, Constraints to preserve, Success Criteria — load-bearing for the verifier).
- `.planning/REQUIREMENTS.md` lines 25–27 — BUFFER-01..03 acceptance text + the `.stmproj` schema-additive lock at line 71.
- `.planning/PROJECT.md` — locked invariants: Layer 3 (no `sharp`/DOM in `src/core/`), D-91 (source-dim ceiling), Phase 6 uniform-only export, Phase 22.1 POST-override passthrough partition.

### Plumbing Precedent (mirror end-to-end)
- `.planning/milestones/v1.3-phases/28-optional-output-sharpening/28-CONTEXT.md` — `sharpenOnExport` plumbing template; especially D-06 (additive-optional `.stmproj` field, no schema bump).
- `.planning/milestones/v1.3-phases/28-optional-output-sharpening/28-01-PLAN.md` (and 28-02 / 28-03 if relevant) — concrete diff sequence for the same field shape Phase 30 mirrors.

### Phase 29 Per-Region Contract (consumed, not changed)
- `.planning/phases/29-per-region-dedup-override-region-semantics-atlas-preview-pac/29-CONTEXT.md` — REGION-04 lock: overrides bind to region (one `regionName` per source PNG). Buffer applies AFTER per-region override resolution but BEFORE the per-region dedup max-effScale fold; one buffer % per source PNG, never per attachment.

### Phase Locus — Math (Layer 3 invariant)
- `src/core/export.ts:137-300` — `buildExportPlan`. Buffer math inserts between override resolution (line 187–192) and the existing `downscaleClampedScale` clamp (line 202). New `bufferCapped` flag plumbed alongside existing `isCapped` (line 228).
- `src/core/export.ts:60-90` — `BuildExportPlanOptions` interface (currently `_opts` parameter, line 140 — gains `safetyBufferPercent` field).
- `src/core/export.ts:130-135` — `safeScale` helper (round-up-to-thousandth) — buffer multiplication should use `safeScale` for the same lower-bound contract.
- Locked memory `project_phase6_default_scaling.md` — uniform-only export scaling; cap is single uniform multiplier from `min(actualSource/canonical)`.
- Locked memory `project_compute_export_dims_canonical_base.md` — `outW = ceil(canonicalW × effScale)`; buffered effScale is the same shape, no rebase needed.
- Locked memory `project_peak_anchored_invariants.md` — `applyOverride` returns canonical-relative effectiveScale; buffer multiplies that result, NOT the override percentage.

### Phase Locus — Persistence (three-touch pattern)
- `src/core/project-file.ts:189-198` — validator: `obj.sharpenOnExport === undefined → false` is the precedent. Add the same guard for `safetyBufferPercent`: undefined → 0; non-`number` or non-integer or out-of-range → invalid-shape.
- `src/core/project-file.ts:316` — serializer: `state.sharpenOnExport` written to disk. Add `state.safetyBufferPercent`.
- `src/core/project-file.ts:380, 449` — `MaterializedProject` shape + materializer back-fill. Same `?? false` → `?? 0` pattern for the new field.

### Phase Locus — IPC + Renderer Lifecycle
- `src/shared/types.ts:914-1056` — `LoadedProject`, `MaterializedProject`, `ExportOptions`, `ResampleArgs` (the four touchpoints `sharpenOnExport` threads through). `safetyBufferPercent` mirrors all four.
- `src/main/project-io.ts:563-1045` — IPC envelope threading: `materialized.sharpenOnExport` (line 566), recovery-path `a.sharpenOnExport` (line 700–701), Open envelope (line 832), resample-arg seam (line 1044). Mirror each site.
- `src/renderer/src/modals/OptimizeDialog.tsx:107-433` — UI host. Sharpen toggle at line 421–434 is the visual precedent. Buffer input sits ABOVE the sharpen line per D-12.
- `src/renderer/src/components/AppShell.tsx:314-1164` — local state `sharpenOnExportLocal` (line 318), `isDirty` memo coupling (line 874), Open-handler hydration (line 1137–1164). Mirror with `safetyBufferPercentLocal`.

### Test Fixtures (regression coverage)
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — unit-level golden (CIRCLE, SQUARE, TRIANGLE, CHAIN_2..8, TransformConstraint, SQUARE2 pre-scaled bone). Useful for buffer × override interaction unit tests.
- `fixtures/Chicken-Min/` — Phase 29 path-indirection regression fixture. Exercises per-region dedup; buffer-on-deduped-row test should run here to lock REGION-04 + BUFFER-02 interaction.
- `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` — complex rig (Phase 9 N2.2 wall-time gate). Use for reactivity perf measurement if jank is suspected during reactive recompute.

### Backlog (none folded)
- No outstanding backlog items target Phase 30; BUFFER-01..03 are the full scope.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`buildExportPlan` already accepts `_opts?: BuildExportPlanOptions`** (`src/core/export.ts:140`). Currently unused — the parameter is reserved. Phase 30 fills it with `safetyBufferPercent`.
- **`safeScale(s)` helper** (`src/core/export.ts:130-135`) — rounds up to nearest thousandth. Buffer math should use `safeScale(rawEffScale × bufferMultiplier)` to preserve the existing display-vs-export lower-bound contract.
- **Phase 22.1 `isCapped: boolean` on `ExportRow`** — exact precedent for a per-row Boolean flag computed in `buildExportPlan`, threaded through IPC, currently consumed by `OptimizeDialog` for cap-binding signal. `bufferCapped` is the parallel flag.
- **Phase 28 `sharpenOnExport: boolean`** — every plumbing site this phase touches has a `sharpenOnExport` predecessor. Three-touch validator/serializer/materializer + four-touch types (`LoadedProject` / `MaterializedProject` / `ExportOptions` / `ResampleArgs`) + four-touch AppShell (state slot + dirty memo + Open hydration + recovery-path back-fill).
- **OptimizeDialog Sharpen toggle layout** (`src/renderer/src/modals/OptimizeDialog.tsx:417-434`) — exact pattern for a project-level export-quality control inside the dialog. Tailwind v4 literal-class strings, disabled-state when `state === 'in-progress'`.
- **Phase 9 `samplingHzLocal` in AppShell** — older precedent for an integer-numeric project field (vs Boolean `sharpenOnExport`). Useful reference for input validation + clamp behavior.

### Established Patterns
- **Layer 3 invariant** — `sharp` only in `src/main/`. Buffer math is pure arithmetic; lives in `src/core/export.ts`. No new imports.
- **`.stmproj` backward-compat (additive)** — never bump schema version for additive optional fields with safe defaults. Phase 8 D-146 lock; reaffirmed Phase 21 (`loaderMode`), Phase 28 (`sharpenOnExport`).
- **Tailwind v4 literal-class discipline (Pitfall 8)** — every `className` is a string literal in modal files. The new input + label follow this.
- **Modal state hygiene (Phase 9 D-188)** — `OptimizeDialog` is a controlled component; project-level toggles hydrate from `.stmproj` on dialog open and write back via the existing project-modified flow.
- **Phase 22.1 POST-override passthrough partition** — `isPassthrough = (outW === effectiveSourceW AND outH === effectiveSourceH)` evaluated in the emit loop AFTER override + cap. Buffer feeds in BEFORE the emit loop; the partition correctness invariant flows through unchanged.
- **Phase 29 per-region dedup** — `bySourcePath` Map keeps the max-effScale row per source PNG. Buffer applies BEFORE the keep-max comparison so all contributing attachments carry the same buffered scale; the max picks deterministically.

### Integration Points
- **OptimizeDialog ↔ buildExportPlan** — buffer state lifts to AppShell (`safetyBufferPercentLocal`); AppShell passes it down via OptimizeDialog props; OptimizeDialog calls `buildExportPlan(summary, overrides, { safetyBufferPercent })` reactively on every change.
- **OptimizeDialog ↔ image-worker (IPC)** — buffered scale is already baked into `ExportRow.outW/outH` in the plan. Image-worker doesn't need to know the buffer % directly — it just resizes to the target dims. New `bufferCapped` flag flows through IPC for future UI use but doesn't change image-worker behavior.
- **OptimizeDialog ↔ `.stmproj`** — buffer state hydrates from `MaterializedProject.safetyBufferPercent` on Open; toggling marks project dirty (Phase 8 dirty-guard wiring); writes back via Save / Save-Quit via the existing path.
- **Validator/materializer/serializer (`src/core/project-file.ts`)** — three-touch pattern. Phase 21 + Phase 28 both did this; planner mirrors verbatim.

</code_context>

<specifics>
## Specific Ideas

- **Reference UX**: the existing sharpen toggle (`OptimizeDialog.tsx:421-434`) is the visual mental model. Same row gravity, same disabled-during-export behavior. Buffer sits one line above (or in a wrapping `<div>` labeled "Quality") and shares the disabled predicate.
- **User mental model**: "I want my exported textures to be a percent bigger than the math says, just in case future bone edits / spotlight tints / sharpen passes pull more pixels in." Buffer = insurance reserve; not an upscaler. The 25% ceiling reinforces this.
- **Capping is the contract, not an exception**: D-91 + Phase 6 uniform-only is the source of truth. Buffer doesn't get to violate it. Capping happens silently because exceeding source dims is meaningless (you can't conjure information). The `bufferCapped` flag exists for *future* surfacing but isn't a "warning" — it's just metadata.
- **Reactive perf**: real-world Spine rigs are ≤500 attachments after per-region dedup. `buildExportPlan` on `fixtures/Girl/` (largest in repo) should still be <10ms. Reactive on every keystroke is the right default; debounce only if real-rig measurement proves jank.
- **Round-trip identity test**: load a v1.2/v1.3-era `.stmproj` (no buffer field), confirm `safetyBufferPercent === 0`. Save a project with `safetyBufferPercent: 5`, reload, confirm byte-equal field. Save with `safetyBufferPercent: 0`, confirm the field is OMITTED from the serialized JSON (or written as 0 — planner picks; key is the round-trip identity, not the wire format).

</specifics>

<deferred>
## Deferred Ideas

- **Cap-bound UI signal** — count badge ("12 / 47 rows clamped at source") or per-row indicator. `bufferCapped` flag exists in the type so a future phase can wire UI without changing the export math. Defer until users actually ask "why didn't my buffer help?"
- **Sub-1% precision** — decimals (0.5%, 1.25%). Not requested; would complicate validation.
- **Sharpen + buffer presets** — "Conservative / Standard / Aggressive" preset menu combining sharpen + buffer. Not requested; single-knob simplicity is the v1.3.1 contract.
- **Per-row buffer overrides** — user already has overrides; buffer is intentionally global. Per-row buffer would just be "override + 5%" rephrased.
- **Web-Worker offload of `buildExportPlan`** — only revisit if reactive recompute jank is observed on real rigs. Premature otherwise.
- **Sigma-style preset-pinned constants** — not applicable here; buffer is user-set, not a fixed constant.
- **Auto-detect "ideal" buffer per-rig** — no heuristic exists; user knows their pipeline best.

</deferred>

---

*Phase: 30-safety-buffer-in-optimize-dialog*
*Context gathered: 2026-05-08*

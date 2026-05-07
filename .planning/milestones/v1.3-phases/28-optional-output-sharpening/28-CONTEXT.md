# Phase 28: Optional Output Sharpening — Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Originally scoped as:** PMA preservation in Optimize Assets export (backlog 999.9). Pivoted during discussion after the original premise was empirically falsified — see D-01 below.

<domain>
## Phase Boundary

Add an **opt-in post-resize sharpening filter** to Optimize Assets export. When enabled, sharp's `.sharpen({ sigma: 0.5 })` is applied after Lanczos3 resize on rows that are being downscaled (effectiveScale < 1.0), recovering perceived crispness lost to information reduction. Mirrors Photoshop's "Bicubic Sharper (reduction)" preset behavior.

Toggle lives in `OptimizeDialog`, defaults to OFF, persists per-project in `.stmproj` v1 schema.

**In scope:**
- Single boolean toggle in `OptimizeDialog` ("Sharpen output on downscale" or similar copy — finalized at planning time).
- `sharp.sharpen({ sigma: 0.5 })` insertion in image-worker resize chain, applied **only** to rows with `effectiveScale < 1.0`.
- `.stmproj` v1 schema gains one optional boolean field; backward-compat per Phase 8 D-146 pattern.
- Both image-worker resize call sites (per-region path at `src/main/image-worker.ts:447-451` AND atlas-extract path at `src/main/image-worker.ts:437-446`) receive the sharpen treatment.
- Regression test locking sigma constant + downscale-only gate.

**Out of scope:**
- PMA flag extraction or propagation (original scope — falsified, see D-01).
- Sharpening presets (low/medium/high), sigma slider, or per-row sharpening overrides — single fixed sigma keeps UX trivial.
- Sharpening on upscale or 1.0× passthrough rows (no perceptual benefit; would only add halos).
- Color-space conversion, ICC profile handling, gamma-aware sharpening — same out-of-scope as original phase 28.

</domain>

<decisions>
## Implementation Decisions

### Original-Scope Falsification (the framing decision)

- **D-01:** **PMA preservation is a no-op** — sharp 0.34.5 + libvips 8.17.3 already auto-handle premultiplied alpha internally during `.resize()`. Verified three ways during discussion:
  1. Synthetic edge-fringing probe at `scripts/pma-probe.mjs` — opaque red disk encoded as PMA vs straight alpha produced visually identical composited output (255, 165, 165) at the near-edge after Lanczos3 downscale via the exact `image-worker.ts:447-451` chain.
  2. User runtime A/B — same Spine project loaded with atlas-source mode vs atlas-less mode, both PMA, byte-identical pixel output.
  3. Visual inspection — dark fringes near character shoulders are baked-in PMA edge artifacts in the source atlas (arm slot over body slot), not introduced by our pipeline.

  **Backlog 999.9 is empirically closed. No PMA flag plumbing in `src/core/loader.ts`, no `pma` field on `ExportRow` / `DisplayRow` / `atlasSource` in `src/shared/types.ts`, no atlas-less PMA toggle. Phase scope pivoted to address the residual concern surfaced during testing: downscale softness.**

  `scripts/pma-probe.mjs` is retained in the repo as a regression sentinel — if a future sharp/libvips upgrade ever causes the probe to diverge, the issue reopens automatically.

### Phase Scope Pivot

- **D-02:** Phase 28 scope changed from "PMA preservation in Optimize Assets export" → **"Optional output sharpening on downscale."** Driver: user observation that manual Photoshop reduction at the same scale produces slightly sharper results than our current Lanczos3-only output. Adding an unsharp-mask post-process — opt-in, off by default — gives users a Photoshop-Bicubic-Sharper-equivalent option without changing the neutral default behavior. ROADMAP.md bullet (line 80) and milestone bullet (line 10) need rewriting at planning time.

### Toggle UI & Placement

- **D-03:** Toggle lives in **`OptimizeDialog`** (NOT Settings dialog). Rationale: visible at the moment of action (export click); user expectation is that resize-quality decisions surface alongside the resize trigger. Settings dialog stays single-purpose (sampling rate).
- **D-04:** Toggle **default is OFF**. Matches Photoshop's plain Bicubic neutral-default behavior. Lanczos3-without-sharpening is currently the matched neutral baseline; this preserves it for users who don't opt in. Anyone who wants Bicubic-Sharper-equivalent output checks the box explicitly.

### Sharpen Parameters

- **D-05:** **Sigma = 0.5 (fixed constant)**. NOT exposed as a slider, dropdown, or preset menu. Justification: sigma=0.5 closely matches Photoshop's Bicubic Sharper preset; conservative enough to avoid halos on hard edges of typical Spine art at 50–75% downscale ratios; aggressive enough to recover crispness vs Lanczos3-alone. If empirical feedback later says it's too weak/strong, we revisit with evidence. Constant should live in a single named export (e.g., `SHARPEN_SIGMA` in `src/core/export.ts` or a constants file the planner picks).

### Persistence

- **D-06:** Toggle state **persists per-project in `.stmproj` v1 schema**. Adds one optional boolean field (e.g., `sharpenOnExport: boolean`); missing field defaults to `false` for backward-compat with v1.2-era files. Same pattern as Phase 8 D-146 (Phase 9 `samplingHz`, Phase 21 `loaderMode`). Schema version bump NOT required — additive optional field per project-file precedent.

### Resize-Path Coverage

- **D-07:** Sharpen is applied **only when the row's effectiveScale < 1.0**. Per-row check inside image-worker, NOT a global guard. Rows at 1.0× (no resize) and rows scheduled for passthrough byte-copy (Phase 22 `passthroughCopies[]`) are unaffected — sharpening an unscaled image adds artifacts for zero perceptual benefit and would diverge from passthrough's byte-identity guarantee.
- **D-08:** Sharpen applied to **BOTH** `image-worker.ts` resize call sites:
  - Per-region path (`src/main/image-worker.ts:447-451`)
  - Atlas-extract path (`src/main/image-worker.ts:437-446`)
  Both produce output PNGs that benefit identically from the post-resize unsharp mask. Plan should DRY-extract the resize+sharpen chain to avoid two copies of the conditional-sharpen logic.

### Claude's Discretion

- Exact button copy in `OptimizeDialog` ("Sharpen output on downscale" / "Apply Bicubic Sharper" / similar). Pick at planning time per established UX wording in OptimizeDialog (Phase 19 quantified-callout style).
- Whether the sharpen constant lives in `src/core/export.ts`, `src/core/constants.ts`, or `src/main/image-worker.ts`. Layer 3 invariant (no `sharp` import in `src/core/`) means the call site stays in main, but the numeric constant can live in core if it's referenced anywhere structurally.
- IPC payload field naming (`sharpenOnExport`, `sharpenEnabled`, `applyUnsharpMask`) — pick the name that reads cleanest in the IPC types and aligns with `.stmproj` field name.
- Test-fixture choice for SHARP-03 regression: pick the smallest fixture that demonstrably benefits from sharpening at a downscale ratio in [0.5, 0.75]. Synthetic small fixture preferred over re-encoding `SIMPLE_PROJECT` to keep test isolated from existing Phase 6/22 golden tests.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & State
- `.planning/ROADMAP.md` line 80 (Phase 28 bullet — needs REWRITE at planning time to reflect new scope)
- `.planning/ROADMAP.md` line 10 (v1.3 milestone bullet — `PMA REQs TBD in Phase 28` clause needs replacement with `SHARP-01..03`)
- `.planning/STATE.md` lines 7, 20 (Phase 28 stub references — need update to reflect scope pivot)

### Phase Locus — Resize Pipeline
- `src/main/image-worker.ts:437-451` — the two `sharp().resize()` call sites that gain conditional `.sharpen({ sigma: SHARPEN_SIGMA })`. Both branches; DRY together.
- `src/shared/types.ts:457-499` — `ExportRow` / `ExportPlan` IPC shape; receives the sharpen flag (per-export, not per-row).
- `src/core/export.ts:262-263` — Phase 6 D-110 uniform-only export math (LOCKED memory). Sharpen sits AFTER resize; doesn't touch this math.

### Phase Locus — UI & Persistence
- `src/renderer/src/modals/OptimizeDialog.tsx` — host of the new toggle. Tailwind v4 literal-class discipline (no template interpolation).
- `src/renderer/src/modals/SettingsDialog.tsx` — precedent for `samplingHz` UI; NOT a sibling of this toggle, but illustrates state-flow / Apply pattern. Toggle here is OptimizeDialog-local.
- `src/main/project-io.ts` (sites referenced in Phase 21 D-12 + Phase 20 plan 20-04) — `.stmproj` save / load / locate-skeleton-recovery flows; sharpen field threads through serialize / validate / materialize.
- `.stmproj` v1 schema lives in source as `validateProjectFile` / `materializeProject` (`src/core/project-file.ts` per Phase 8 D-146). Add `sharpenOnExport?: boolean` per backward-compat-additive convention.

### Diagnostic Artifact (regression sentinel)
- `scripts/pma-probe.mjs` — empirical proof that sharp 0.34 + libvips 8.17 preserve PMA. Retained, NOT deleted. Future planners revisiting PMA concerns: re-run this first.

### Locked Memory & Project Invariants (must respect)
- `.planning/PROJECT.md` (full memory carries forward) — Phase 6 D-110 uniform-only export, Layer 3 invariant (no `sharp`/`electron` in `src/core/`), `.stmproj` v1 backward-compat.
- Locked memory `project_phase6_default_scaling.md` — uniform-only export scaling. Sharpen does not change scaling math.
- Locked memory `project_strict_loadermode_separation.md` — atlas-source vs atlas-less self-contained. Sharpen is mode-agnostic; applies identically to both.

### Backlog (closed by this phase)
- Backlog 999.9 (PMA preservation) — empirically falsified. Mark as `closed:falsified` with reference to D-01 + `scripts/pma-probe.mjs` at planning time. No more backlog entries to fold.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`sharp.sharpen({ sigma })`** — built-in API on the existing sharp instance. Zero new dependencies. Drop-in line in the resize chain.
- **Phase 22 `passthroughCopies[]` array on ExportPlan** — precedent for adding per-export-mode behavior to the IPC payload. The sharpen flag is global to the export run (not per-row), so it's simpler than passthrough — single boolean on `ExportOptions` or `ExportPlan` envelope.
- **Phase 9 `samplingHz` in `.stmproj`** — exact precedent for adding a single boolean/scalar to the project file with backward-compat-default. Same `validateProjectFile` + `materializeProject` plumbing pattern.
- **Phase 21 `loaderMode` in `.stmproj`** — recent precedent (2026-05-02) for an additive optional `.stmproj` field with default-on-missing. Even closer pattern than samplingHz because it's optional.

### Established Patterns
- **Layer 3 invariant** — `sharp` is only ever imported in `src/main/`. Sharpen call lives in `src/main/image-worker.ts`. The constant value (sigma=0.5) can live in `src/core/` if the planner sees a reason; the call site cannot.
- **`.stmproj` backward-compat (additive)** — never bump schema version for additive optional fields with safe defaults. Phase 8 D-146 lock; reaffirmed in Phase 21 + Phase 22.
- **Tailwind v4 literal-class discipline (Pitfall 8)** — every `className` is a string literal in modal files. The new checkbox follows this.
- **Modal state hygiene (Phase 9 D-188)** — `OptimizeDialog` modal state is local; the project-level toggle hydrates from `.stmproj` on dialog open and writes back via the existing project-modified flow (consult planner for exact wiring).

### Integration Points
- **`OptimizeDialog` ↔ `image-worker`** — toggle state goes into the IPC payload `OptimizeOptions` (or current name) handed to the export channel. image-worker reads it and conditionally applies `.sharpen()`.
- **`OptimizeDialog` ↔ `.stmproj`** — toggle state is hydrated from session/project state on dialog open; toggling marks project dirty (Phase 8 dirty-guard wiring).
- **Validator/materializer/serializer (`src/core/project-file.ts`)** — three-touch pattern for adding the new field. Phase 21 + Phase 22 both did this; planner should mirror.

</code_context>

<specifics>
## Specific Ideas

- **Reference behavior**: Photoshop's "Bicubic Sharper (reduction)" preset is the mental model. NOT "Automatic" mode (which picks Bicubic Sharper for reductions); explicitly the Sharper preset.
- **User's empirical baseline**: manual Photoshop reduction of the user's character texture (blue-dressed character with yellow border, observed during discuss session) produced visibly sharper output than our current Lanczos3-only export. That's the bar to beat with the toggle ON.
- **Dark-fringe carve-out**: dark fringes near character shoulders that surfaced during the test are SOURCE PMA edge artifacts (arm slot overlapping body slot in the original atlas). They are NOT introduced by our resize pipeline and are NOT addressed by this phase. If a future phase wants to address them, that's atlas-source-quality work, not export-pipeline work.
- **Regression sentinel**: `scripts/pma-probe.mjs` — small Node script created during this discussion, runs the exact `image-worker.ts:447-451` resize chain on a synthetic PMA disk and reports composited-RGB at center / mid-radius / near-edge. Retain in repo. Run-on-demand, NOT part of CI default (no test wiring needed).

</specifics>

<deferred>
## Deferred Ideas

- **Sharpen preset menu (Low/Medium/High)** — discussed and rejected for v1.3. Single sigma=0.5 ships first; revisit only if user feedback explicitly requests granularity.
- **Sigma slider (raw 0.0–1.0)** — discussed and rejected. Nobody tunes sigma by hand without a live preview; UI overhead not justified.
- **Sharpen-on-upscale support** — explicitly out of scope. Upscale sharpening is a different problem (Photoshop "Preserve Details 2.0" territory) and our app doesn't currently upscale anyway (export ratios are bounded ≤ 1.0 by Phase 22 override-cap).
- **Atlas-source dark-fringe correction** — distinct concern surfaced during this discussion (PMA edge artifacts near arm/body overlaps in source atlases). Belongs in a future phase if it becomes a tester complaint; documented in `<specifics>` so it's not lost.
- **Auto-detect PMA in atlas-less mode** — was a candidate scope for original Phase 28; now unreachable because PMA work itself is empirically unnecessary. If sharp/libvips ever regresses, `scripts/pma-probe.mjs` reopens this.

</deferred>

---

*Phase: 28-optional-output-sharpening*
*Context gathered: 2026-05-06*

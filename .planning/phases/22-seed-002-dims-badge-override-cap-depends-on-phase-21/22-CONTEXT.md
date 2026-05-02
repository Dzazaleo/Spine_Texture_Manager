# Phase 22: SEED-002 dims-badge + override-cap (depends on Phase 21) - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Round-trip safety after Optimize. Detect canonical-vs-actual PNG dimension drift (Scenarios A + B in SEED-002), surface a badge in Global + Animation Breakdown panels for affected rows, and cap export `effectiveScale = min(peakScale, actualSourceW/canonicalW, actualSourceH/canonicalH)` so re-running Optimize on already-optimized images produces zero Lanczos resamples (passthrough byte-copies instead — see D-03).

**In scope (DIMS-01..05):**
- `DisplayRow` (in `src/core/types.ts:115-132`) gains `actualSourceW: number | undefined`, `actualSourceH: number | undefined`, `canonicalW: number`, `canonicalH: number`, and `dimsMismatch: boolean`. (Canonical fields are NEW alongside existing `sourceW/H` — see D-01 for why both are needed.)
- Loader populates `actualSourceW/H` from per-region PNG header reads via Phase 21's `src/core/png-header.ts`. `canonicalW/H` populated from JSON skin attachment width/height (D-01).
- `dimsMismatch` set when actualSource differs from canonical by more than 1px on either axis (rounding tolerance, locked by ROADMAP).
- Atlas-extract path rows (no per-region PNG present): `actualSourceW/H` undefined, `dimsMismatch: false`.
- Badge UI (small icon + tooltip) on `dimsMismatch: true` rows in `GlobalMaxRenderPanel.tsx` and `AnimationBreakdownPanel.tsx`.
- `buildExportPlan` in `src/core/export.ts` (and byte-identical `src/renderer/src/lib/export-view.ts`) gains the cap step: `cappedEffScale = min(effScale, actualSourceW/canonicalW, actualSourceH/canonicalH)` when `dimsMismatch && actualSource defined`. Cap is uniform (single multiplier applied to both axes), preserving locked memory `project_phase6_default_scaling.md`.
- New `passthroughCopies[]` array on `ExportPlan` (parallel to Phase 6 D-109 `excludedUnused[]`). Rows where `dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource)` (generous threshold per D-04 REVISED — see decisions section) move to `passthroughCopies[]`. Aspect ratio is preserved at all times: cap is uniform (`min` over both axes), never per-axis.
- Image worker (`src/main/image-worker.ts`) gains a `fs.copyFileSync` path for `passthroughCopies[]` rows (no Lanczos, byte-for-byte). User gets a complete output folder.
- OptimizeDialog pre-flight file list shows `passthroughCopies[]` rows with muted treatment (parity with `excludedUnused`); indicator label reads "COPY".
- Round-trip vitest fixture: source PNGs smaller than canonical region dims → load → verify `dimsMismatch` flag → `buildExportPlan` produces `passthroughCopies[]` of expected length and zero `entries[]` (or only the legitimately-shrinking rows).

**Out of scope (deferred to other phases):**
- Atlas-extract drift detection (atlas page PNG smaller than `.atlas` declared dims) — atlas-extract path remains undefined / dimsMismatch:false. Backlog item if it ever surfaces.
- Tooltip wording variants distinguishing Scenario A vs Scenario B — single locked wording from ROADMAP DIMS-02 ("Source PNG (X×Y) is smaller than canonical region dims (X×Y). Optimize will cap at source size.").
- `.stmproj` override migration (D-02 picked "% of canonical" — no migration needed).

</domain>

<decisions>
## Implementation Decisions

### Canonical Dims Source (Area 1)
- **D-01:** **JSON skin attachment width/height is the unified canonical dims source for both atlas-less and canonical-atlas modes.** Verified Spine 4.2 emits per-region attachment width/height in JSON (e.g., `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` shows `"SQUARE": { "width": 1000, "height": 1000 }`). One drift-detection path covers both modes; atlas-less Scenario A is caught (Phase 21's synthetic atlas equating canonical=PNG by D-12 is no longer the source of truth — `canonicalW/H` is populated separately from JSON, independent of how `sourceW/H` was derived).
  - Phase 21's `'png-header'` SourceDims discriminator stays untouched.
  - New `canonicalW/H` fields on `DisplayRow` are populated from `parsedJson` skin walk (loader.ts already parses JSON once at line 164 — extend that walk to also collect attachment width/height per region).
  - Resolves Phase 21's open research item ("Spine 4.2 JSON nonessential data field name") — answer: it's NOT nonessential data; it's standard skin-attachment metadata, always present.

### Override % Semantics (Area 2)
- **D-02:** **Override % stays `% of canonical JSON dims`.** When user sets a per-attachment override of (e.g.) 50%, that's 50% of `canonicalW × canonicalH`. The export cap clamps the resulting scale transparently if it exceeds `actualSource/canonical`. No `.stmproj` migration; existing override values keep meaning across loads. The badge + tooltip on the panels carries the explanation (drift fact + "cap fires here"). Honors locked memory `project_phase6_default_scaling.md` (uniform single-scale; never extrapolate; cap is a uniform reduction).

### OptimizeDialog Cap Visibility (Area 3)
- **D-03:** **Already-optimized rows become passthrough byte-copies, not exclusions.** New `passthroughCopies[]` array on `ExportPlan` (NOT `excludedAlreadyOptimized[]` — "excluded" was misleading, since the file IS written to outDir, just not via Lanczos). Image worker (`src/main/image-worker.ts`) gains a `fs.copyFileSync(sourcePath, outPath)` path for these rows. User running Optimize gets a complete `images/` output folder, with passthrough rows preserving byte-for-byte fidelity (no double Lanczos). OptimizeDialog file list shows these rows with muted treatment (parity with Phase 6 D-109 `excludedUnused` muted UX); indicator label reads **"COPY"** (not "skipped" or "already-optimized"). Partially-capped rows (cap fires but `actualSource × cappedEffScale` does NOT round to `actualSource` on both axes — i.e. some real shrinkage still happens) appear identical to normal rows in the dialog; the panel badge already explains WHY the cap fired for those.

### Already-Optimized Threshold (Area 4)
- **D-04 (REVISED 2026-05-02 post-research):** **Generous passthrough — a row moves to `passthroughCopies[]` whenever Optimize would NOT produce a strictly smaller image than what is already on disk.** The original strict-ceil-equality wording was mathematically wrong at the cap-binding boundary (it would never flag a capped row as passthrough — opposite of the intended round-trip safety). Corrected formula:
  - `sourceRatio = min(actualSourceW / canonicalW, actualSourceH / canonicalH)` (uniform — pick the more constraining axis so aspect ratio is respected; never per-axis)
  - `isCapped = effScale > sourceRatio` (the cap binds — output would equal actualSource by construction)
  - `peakAlreadyAtOrBelowSource = effScale ≤ sourceRatio` (user already over-reduced past peakScale — never shrink further)
  - **`isPassthrough = dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource)`** — combined, this simplifies to **"any drifted row where peakScale × canonical ≥ actualSource (either axis) ⇒ passthrough"**.
  - **Aspect ratio invariant:** the `min(...)` over both axes guarantees the cap is uniform (single multiplier applied to both axes). Per-axis caps are forbidden — they would distort aspect ratio and break Spine UV sampling (locked memory `project_phase6_default_scaling.md`).
  - **User-set buffer / override interaction:** if the user sets a buffer % that pushes `effScale` above `sourceRatio` on a drifted row, the cap clamps transparently and the row falls into `passthroughCopies[]`. Override is honored as best-effort but never extrapolates beyond actualSource (correctness > fidelity to override input).
  - Use the existing `safeScale()` helper at `src/core/export.ts:140` for the ceil-thousandth pre-step on the non-passthrough path. Passthrough rows skip the `safeScale` pre-step entirely (no Lanczos pipeline runs).
  - Test: assert `ceil(actualSourceW × cappedEffScale) === actualSourceW` AND `ceil(actualSourceH × cappedEffScale) === actualSourceH` hold trivially when `isCapped` is true (redundant guards proving the cap formula is correct), AND assert `entries.length === 0` for fully-already-optimized projects covering the `peakAlreadyAtOrBelowSource` branch.

### Claude's Discretion
- Exact badge icon + visual styling (size, color, position) — pick whatever is consistent with existing panel iconography (Phase 19 UI-01..05 sticky-header / semantic state colors). No UI-SPEC required for a single tooltip-on-hover icon. Tooltip wording matches ROADMAP DIMS-02 verbatim: "Source PNG (W×H) is smaller than canonical region dims (W×H). Optimize will cap at source size."
- Exact placement of the COPY indicator in the OptimizeDialog file list — mirror the Round 1 `excludedUnused` muted-row treatment; pick whichever positional pattern (suffix label, leading icon, both) reads most consistently against existing rows.
- Whether `canonicalW/H` populates as `number | undefined` (matching `actualSourceW/H`) or always-required `number`. Recommend always-required (every region attachment in JSON has width/height per the Spine schema; if it's missing, that's a malformed-JSON case the loader should already reject earlier).
- Whether the round-trip vitest fixture is a NEW directory under `fixtures/` or a programmatic test that mutates `fixtures/SIMPLE_PROJECT_NO_ATLAS/` (Phase 21's atlas-less fixture) PNGs in a `beforeAll` hook. Recommend programmatic mutation (cheaper, no new binary fixtures to maintain), but if the planner finds a clean reusable fixture path, that's fine too.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Seed & Phase Authoring
- `.planning/seeds/SEED-002-dims-badge-override-cap.md` — full SEED body (planted 2026-04-25 during Phase 6 close-out; user-confirmed scope quote 2026-04-25; Open Question section about hidden-vs-muted resolved by D-03 → muted with "COPY" label, files DO get copied).
- `.planning/seeds/SEED-001-atlas-less-mode.md` — Phase 21 sibling; informs what infrastructure landed (PNG header reader, synthetic atlas builder).
- `.planning/ROADMAP.md` §"Phase 22" (line 433) — official scope, success criteria, cross-references, severity, requirements mapping.
- `.planning/REQUIREMENTS.md` — DIMS-01 (line 69), DIMS-02 (line 70), DIMS-03 (line 71), DIMS-04 (line 72), DIMS-05 (line 73).

### Phase 21 Outputs (consumed by Phase 22)
- `.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-CONTEXT.md` — Phase 21 decisions; especially D-12 (synthetic atlas: 1 page per PNG; canonical=PNG-header dims by Phase 21 contract — Phase 22 D-01 supersedes by introducing a separate `canonicalW/H` from JSON), D-15 (`'png-header'` source discriminator), D-17 (`atlasSources` map shape).
- `src/core/png-header.ts` — pure-TS PNG IHDR reader (Phase 21 Plan 21-01). Public API: `readPngDims(buffer: Buffer): { width: number; height: number }`. Phase 22 calls this per-region during loader, regardless of mode.
- `src/core/synthetic-atlas.ts` — Phase 21 Plan 21-04 atlas synthesizer; informs what the loader's atlas-less path looks like at the call site, but Phase 22 doesn't modify it.

### Existing Code (read + audit)
- `src/core/types.ts:115-132` — `DisplayRow` definition. Gains `actualSourceW`, `actualSourceH`, `canonicalW`, `canonicalH`, `dimsMismatch` fields per D-01 + D-04.
- `src/core/loader.ts:164` — JSON parsed once and threaded to spine-core; extend to also walk `parsedJson.skins[*].attachments` for per-region width/height (D-01 canonical source).
- `src/core/loader.ts:175-186` + `:235-296` — sourcePaths / sourceDims / atlasSources construction sites; canonicalW/H + actualSourceW/H populated alongside.
- `src/core/loader.ts:81-83` — `createStubTextureLoader()` reused in atlas-less mode (no change for Phase 22).
- `src/core/loader.ts:257-260` — `path.join(imagesDir, region.name + '.png')` source-path convention; Phase 22 reads PNG headers from the same path resolution (handles nested region names natively).
- `src/core/export.ts:117-135` — `safeScale` + ceil math; gains the cap step (D-03 cap formula). Pure helper; mirrored byte-identically in `src/renderer/src/lib/export-view.ts` per established Phase 6 parity contract.
- `src/core/export.ts:140` — `safeScale()` ceil-thousandth helper; reused in cap pre-step.
- `src/renderer/src/lib/export-view.ts` — byte-identical renderer copy of buildExportPlan; cap math mirrored verbatim.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — gains badge column / inline icon on `dimsMismatch: true` rows.
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — same badge addition.
- `src/renderer/src/modals/OptimizeDialog.tsx` — pre-flight file list gains the muted-row treatment + "COPY" indicator for `passthroughCopies[]` entries.
- `src/main/image-worker.ts` — gains `fs.copyFileSync` path for `passthroughCopies[]` (D-03). Existing sharp-resize path stays for the normal `entries[]`.

### Locked Invariants Honored
- **CLAUDE.md fact #4** ("the math phase does not decode PNGs") — `png-header.ts` is byte-parsing IHDR, no zlib/IDAT decoding. Phase 22 reuses verbatim.
- **CLAUDE.md fact #5** (`core/` is pure TypeScript, no DOM) — all Phase 22 core/ changes (loader.ts, export.ts, types.ts) are pure TS; sharp + fs.copyFileSync stay in main/image-worker.ts (Layer 3 boundary preserved).
- **Locked memory `project_phase6_default_scaling.md`** (uniform single-scale; never extrapolate) — preserved. Cap is a single uniform multiplier, not per-axis. D-02 keeps the override field as % of canonical (no semantic change).
- **Phase 6 D-109 precedent** — `excludedUnused[]` is the established muted-row UX. `passthroughCopies[]` (D-03) reuses the muted styling but is a third category (NOT exclusion — files DO get copied to outDir).
- **Phase 6 Gap-Fix Round 1 + Round 5** — clamp `effectiveScale ≤ 1.0` and ceil-thousandth scale display. Phase 22's cap is structurally an extension of Round 1's clamp (now also bounded by actualSource/canonical, not just 1.0).

### Phase 21 Carry-Forward Resolutions
- Phase 21 D-12 reframed: synthetic atlas regions still set originalWidth/Height = PNG dims (Phase 21 contract intact). Phase 22 introduces `canonicalW/H` as a NEW field populated from JSON, separate from `sourceW/H`. The two coexist.
- Phase 21 D-15 (`'png-header'` source discriminator on `SourceDims`) is unchanged. Atlas-less rows still report `source: 'png-header'`. Phase 22 just adds canonical fields alongside.
- Phase 21 open research item ("Spine 4.2 JSON nonessential data field name") **resolved**: per-region width/height is standard skin-attachment metadata in 4.2 JSON (NOT nonessential), always present. D-01 acts on this.

### Test Surface
- `tests/core/loader.spec.ts` — gains canonical-vs-actual drift assertions for both atlas-less and canonical-atlas paths.
- `tests/core/export.spec.ts` — gains cap formula tests + passthroughCopies[] threshold tests (strict ceil-equality per D-04).
- New round-trip vitest spec covering DIMS-05: load drifted project → buildExportPlan → expect `passthroughCopies.length === N && entries.length === 0` for fully-already-optimized projects.
- Fixture path: extend `fixtures/SIMPLE_PROJECT_NO_ATLAS/` (Phase 21 fixture) with a programmatically-mutated PNG variant in a `beforeAll`, OR new `fixtures/SIMPLE_PROJECT_DRIFTED/` directory if planner prefers.

### Spine 4.2 Reference (planner verification)
- `node_modules/@esotericsoftware/spine-core/dist/RegionAttachment.js` — region attachment shape (width/height fields read from JSON).
- `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js` — JSON parser; `readSkin` → `readAttachment` chain populates attachment width/height. Confirms canonical fields are non-nonessential and always present in 4.2 JSON.
- `node_modules/@esotericsoftware/spine-core/dist/MeshAttachment.js` — mesh attachment also carries width/height; Phase 22 must handle both region + mesh attachments uniformly when collecting canonical dims.

### Open Research Items for Planner
- **Mesh attachments + canonical dims.** Region attachments clearly carry width/height in 4.2 JSON. Verify mesh attachments also carry width/height (or whether mesh canonical dims need a different derivation, e.g., bounding-box of `vertices`). If mesh attachments don't carry width/height directly, Phase 22 may need a fallback path for mesh-only regions. Spike or read SkeletonJson.js to confirm.
- **`fs.copyFileSync` vs streaming copy in image-worker.** For large per-region PNGs, sync copy could block the worker briefly. Existing image-worker.ts uses sharp's async pipeline. Decide sync vs async (probably async via `fs.promises.copyFile` to match the existing async pattern). Planner research item.
- **Phase 6 ConflictDialog "Overwrite all" interaction.** Confirm Phase 6's overwrite path doesn't also rewrite `.atlas` files (only per-region PNGs). If `.atlas` is also overwritten with new dims, then Scenario B in canonical-atlas mode self-resolves and Phase 22's drift detection only fires for Scenario A. Planner-side verify.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/png-header.ts` (Phase 21) — `readPngDims(buffer)` is the dim reader for actualSourceW/H. Public, headless, Layer-3-compliant.
- `safeScale()` at `src/core/export.ts:140` — ceil-thousandth helper. Reuse in cap-step to keep the displayed scale a guaranteed lower bound (Phase 6 Gap-Fix Round 5 invariant).
- Phase 6 D-109 `excludedUnused[]` muted-row UX in OptimizeDialog — the visual template for the "COPY" muted-row treatment (D-03).
- Phase 21's `parsedJson` skin walk pattern (used by `synthesizeAtlas` to enumerate region attachment names) — Phase 22 reuses the same iteration shape to collect attachment width/height for canonicalW/H.

### Established Patterns
- **JSON-once parsing** — `loader.ts:164` parses JSON once and threads to spine-core. Phase 22 walks the same `parsedJson` to collect canonical width/height (no second parse).
- **`fs.readFileSync` only at load time** — sampler hot-loop never re-enters loader. Phase 22's PNG header reads happen during `loadSkeleton()` only. Same constraint Phase 21 honored.
- **Layer 3 invariant** — `core/` is pure TS + `node:fs` + `node:path` only. `png-header.ts` (used here) is already Layer-3-clean. `fs.copyFileSync` (D-03) lives in main/image-worker.ts, NOT core/.
- **Byte-identical renderer copy of export math** — `src/renderer/src/lib/export-view.ts` mirrors `src/core/export.ts` byte-for-byte for the parts the renderer recomputes for previews. Phase 22 cap step must be mirrored there too.
- **`ExportPlan` array-of-arrays shape** — Phase 6 D-109 precedent: `excludedUnused[]` parallel to `entries[]`. Phase 22 `passthroughCopies[]` mirrors this exactly (a third array on the same plan; no breaking shape change for existing consumers, who just won't iterate it).

### Integration Points
- `src/core/loader.ts` — extend the parsedJson walk to populate canonicalW/H per region; wire `readPngDims()` into the per-region PNG resolution path (canonical-atlas + atlas-less both, regardless of mode).
- `src/core/types.ts` `DisplayRow` — add `actualSourceW`, `actualSourceH`, `canonicalW`, `canonicalH`, `dimsMismatch`. Audit all DisplayRow consumers for the new fields (analyzer, panels, export math).
- `src/core/export.ts` `buildExportPlan` — gain cap step + passthroughCopies[] population.
- `src/renderer/src/lib/export-view.ts` — mirror cap step + passthroughCopies population byte-for-byte (parity contract).
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` + `AnimationBreakdownPanel.tsx` — badge UI on `dimsMismatch: true` rows; tooltip per ROADMAP DIMS-02 wording.
- `src/renderer/src/modals/OptimizeDialog.tsx` — muted "COPY" row treatment for `passthroughCopies[]`.
- `src/main/image-worker.ts` — branching: sharp Lanczos for `entries[]`, `fs.promises.copyFile` for `passthroughCopies[]`.

### Files Not Created
Phase 22 is largely an EXTENSION of existing files — no new core/ files expected. The infrastructure (png-header.ts, synthetic-atlas.ts) was planted in Phase 21. Possible NEW file: a small helper module if the cap math + threshold check grows beyond a few lines, but planner can decide inline-vs-extract.

</code_context>

<specifics>
## Specific Ideas

- **The cap is the correctness guarantee, not the badge.** Even if the user dismisses the badge, the cap math fires. Badge is informational; cap is non-negotiable.
- **"COPY" semantics matters.** The user's mental model: "I hit Optimize, I get a complete `images/` folder back." Anything less surprises them. Passthrough byte-copy preserves that contract while honoring "never double-resample."
- **Spine 4.2 JSON IS the canonical source.** Atlas `orig:` lines and JSON skin attachment width/height should match for unmodified projects (both come from the Spine editor at export time). When they differ (which would be unusual), JSON wins (per D-01). Atlas-only projects still work because JSON is always present.
- **Phase 6 round-trip safety extends naturally.** Round 1 clamped `effectiveScale ≤ 1.0` (don't upscale beyond canonical). Phase 22 extends: `effectiveScale ≤ min(1.0, actualSource/canonical)` (also don't upscale beyond what's actually on disk). One coherent invariant: never upscale.
- **Cap is uniform, not per-axis.** Locked memory rule. The cap formula `min(effScale, actualSourceW/canonicalW, actualSourceH/canonicalH)` is correctly uniform (single multiplier from the min of three candidates), not per-axis.

</specifics>

<deferred>
## Deferred Ideas

- **Atlas-extract drift detection** — when atlas page PNG is smaller than `.atlas` declared page dims (rare; user manually shrunk an atlas page). Phase 22 leaves atlas-extract rows with dimsMismatch:false / undefined. Backlog item if it ever surfaces in a real project.
- **Scenario A vs Scenario B distinguishing tooltip wording** — single locked wording from ROADMAP DIMS-02. If users start asking "why does this say 'cap at source size' — what does that mean?", revisit tooltip copy in a follow-up.
- **Recency-based auto-detection** (compare PNG mtime vs `.atlas` mtime) — same rejection as Phase 21 D-08 noted: filesystem mtime fidelity unreliable cross-platform. Drift detection stays dim-based, not mtime-based.
- **Telemetry / log output** for cap fires — would help debugging "why did Optimize produce zero exports?" in user reports. Not needed for v1.2; revisit if support volume warrants.
- **Spike cap-vs-override interaction edge case** — if user sets override of 100% AND drift is detected, cap fires. User sees their requested 100% but gets a smaller export. Is the badge tooltip enough explanation, or do we need a second indicator on the override row in OverrideDialog? Defer pending UAT feedback.
- **Async vs sync copyFile in image-worker** — planner research item (see Open Research Items).
- **Round-trip fixture strategy** — programmatic vs new fixture directory; planner picks.

### Reviewed Todos (not folded)
- `.planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md` — Phase 4 panel code review follow-up. Tagged as ui/panels which surface-overlaps with Phase 22's badge addition, but the WR-03 + 6 info findings are about Phase 4 panel internals, not drift detection. Reviewing during Phase 22 implementation is fine if convenient, but not in scope.
- `.planning/todos/pending/2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md` — Phase 20 cross-platform DnD UAT. Unrelated to Phase 22 (export cap math). Stays in pending todos for v1.2 ship-round UAT.

</deferred>

---

*Phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21*
*Context gathered: 2026-05-02*

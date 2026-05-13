# Phase 33: Rotated atlas region support (loader + bounds + export + fixture) - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the v1.0-era hard-throw `RotatedRegionUnsupportedError` with full rotated-region support across the atlas-source pipeline. Four coordinated changes:

1. **Loader (`src/core/loader.ts:507-522`)** — drop the `region.degrees !== 0 → throw` block. Rotated regions propagate through `analyzer.ts` carrying `rotate: true` like any other geometry datum.
2. **Bounds (`src/core/bounds.ts`)** — `attachmentWorldAABB` produces canonical (unrotated) world-space AABB for rotated regions, matching what spine-ts would render at identity scale.
3. **ExportPlan output dims** — `ExportRow.outW/outH` for rotated regions reflect canonical (unrotated) W×H. Animators get exported per-region PNGs whose dims match the unrotated source.
4. **Image-worker (`src/main/image-worker.ts`)** — atlas-extract paths (passthrough at line 274-298 + resize at line 380-470) gain `sharp.rotate(±90)` to produce canonical-orientation PNG output. The `'rotated-region-unsupported'` ExportError block at line 422-438 is removed.

**Plus:**
- Committed regression fixture under `fixtures/spine_rotated/` mirroring the `fixtures/spine_stripWS/` precedent (Spine source file + EXPORT folder produced by the real Spine packer with rotation:true).
- Lockstep cleanup of `RotatedRegionUnsupportedError` across `src/core/errors.ts:175-187`, `src/core/loader.ts:44/516`, `src/main/ipc.ts:134`, `src/shared/types.ts:894`, and the existing `tests/core/loader-rotation-rejection.spec.ts` + `tests/core/rotated-region-error.spec.ts`.

**In scope:**
- Remove `RotatedRegionUnsupportedError` class + IPC kind + KNOWN_KINDS entry + KnownErrorKind union case (D-158/D-171 carve-out).
- Remove the loader's region-degrees throw at `src/core/loader.ts:513-522`.
- Add per-RegionAttachment offset override pass in the loader (post-`readSkeletonData`) for rotated RegionAttachments. Mesh path untouched.
- Image-worker `sharp.rotate` un-rotation in both atlas-extract paths (passthrough + resize). Remove the `'rotated-region-unsupported'` ExportError gate at line 422-438.
- ExportPlan output-dim flow: verify `buildExportPlan` produces canonical outW/outH for rotated regions (existing `canonicalW × effScale` formula already canonical-relative; the bounds fix makes peakScale canonical-correct so the cascade is automatic — confirm during planning).
- New committed `fixtures/spine_rotated/` (Spine source + EXPORT folder) with at least one tall-narrow region the packer rotates.
- Tests per T2 coverage level — see `<decisions>` D-04 below.

**Out of scope:**
- Atlas-less mode (synthetic atlas always emits `rotated:false`; rotation branch statically unreachable from atlas-less code path; locked by memory `project_strict_loadermode_separation`).
- Sampler code path (rotation handling lives entirely downstream in bounds + export-plan; sampler measures all skin-declared attachments verbatim per `project_sampler_visibility_invariant`).
- Rotated MeshAttachment peakScale correctness — out of scope by D-02 below; rotated meshes are rare in practice and the chosen B1 implementation pattern leaves the mesh code path untouched. If a rotated mesh fixture surfaces in production, address in a follow-up.
- Spine 4.3-beta runtime port (PORT-01..04 / SEED-006).
- The `region.degrees == 180 / 270` cases — current spine-ts editor never emits non-90° rotations; if a future export does, the loader will mishandle silently. Track as a follow-up if a real-world 180/270 fixture surfaces.

</domain>

<decisions>
## Implementation Decisions

### Bounds Swap Locus (D-01, D-02)

- **D-01: Loader-side per-RegionAttachment offset override (post-readSkeletonData).** After `SkeletonJson.readSkeletonData(parsedJson)` returns `skeletonData`, walk every skin's slot attachments; for each `RegionAttachment` whose `region.degrees !== 0`, manually overwrite the cached `attachment.offset` (8-float array — 4 corners × 2 coords) with canonical-dim corners computed from `attachment.width`, `attachment.height`, `attachment.x`, `attachment.y`, `attachment.scaleX`, `attachment.scaleY`, `attachment.rotation`. This bypasses spine-core's `RegionAttachment.updateRegion()` packed-dim layout (verified at `node_modules/@esotericsoftware/spine-core/dist/attachments/RegionAttachment.js:82-87`) for rotated regions only, while keeping the bone-transform pipeline downstream identical to non-rotated attachments. `computeWorldVertices` then folds bone matrix × canonical offsets → correct world AABB at every bone state.
  - **Why:** Option A (post-AABB swap) is mathematically wrong under non-identity bone rotation — the AABB axes don't correspond to source axes after the bone matrix applies. Option C (manual AABB recompute in bounds.ts) re-implements transform math on every sampler tick (hot loop). B1 mutates once at load, then the hot loop reads canonical offsets just like for non-rotated attachments. Cleanest separation between rotation handling (load-time, one pass) and bounds math (runtime, branch-free).

- **D-02: MeshAttachment code path stays untouched.** Mesh AABBs come from per-vertex `vertices[]` (source positions) transformed through bones; spine-core's `MeshAttachment.updateRegion` rotation handling at `node_modules/@esotericsoftware/spine-core/dist/attachments/MeshAttachment.js:80-90` correctly remaps source-region UVs into page-pixel space for rotated regions. World AABB doesn't depend on UVs; `hullAreaRatio` peakScale uses spine-core's correctly-rotated UVs as input → already correct.
  - **Why:** A global mutation of `region.width ↔ region.height` (Option B unconstrained) would break MeshAttachment's UV remap math (`region.width/height` appears in the rotation cases at lines 82-90). B1 surgically targets RegionAttachment's offset cache, leaving region geometry and mesh UV handling identical to current behavior. Rotated meshes are rarer than rotated region attachments (icons/props are the typical rotation candidates); the chosen scope keeps mesh peakScale exactly as today and avoids a speculative correction.

### Image-Worker Rotated Extract (D-03)

- **D-03: Full coverage — `sharp.rotate(±90)` in both atlas-extract paths.** Both passthrough (`src/main/image-worker.ts:274-298`) and resize (`src/main/image-worker.ts:380-470`) paths gain rotation handling: when `row.atlasSource.rotated === true`, the sharp pipeline becomes `sharp(pagePath).extract({...packed-rect...}).rotate(±90).{copy|resize|extend}`. The `'rotated-region-unsupported'` typed ExportError at line 422-438 is removed entirely.
  - **Rotation direction:** spine-ts atlas convention is `region.degrees == 90` means the source was rotated 90° CCW when packed (so the packed image on disk shows the source rotated). To un-rotate, sharp needs `.rotate(-90)` (CCW = negative in sharp's CW-positive convention). Direction MUST be verified during planning with a probe (extract from F1 fixture's packed atlas, rotate, byte-compare against the source PNG).
  - **Strip-Whitespace + rotation interaction:** the existing passthrough `.extend()` reconstitution at line 290-298 (atlas-orig canvas reconstruction for trimmed regions) MUST still apply post-rotation. Order: extract → rotate → extend. Verify during planning that `.extend()` offsets are canonical-relative (offsetX/Y from the unrotated atlas-text) and not packed-relative; if packed-relative, swap before extend.
  - **Why:** ATLAS-03 requires canonical-dim PNG output. If atlas-extract is the only available path (per-region PNGs absent — Jokerman-style atlas-only projects), deferring rotation means rotated atlas projects load but cannot Optimize. Memory `project_atlas_pack_options_atlas_source_only` says strip-whitespace is fully handled; this phase brings rotation to parity (full handling, atlas-source mode only).

### Test Fixture (D-04, D-05)

- **D-04: New `fixtures/spine_rotated/` Spine project mirroring `fixtures/spine_stripWS/` precedent.** Real Spine packer output: a `.spine` source file + `EXPORT/` folder containing `skeleton.json` + `skeleton.atlas` (with at least one `rotate: true` region) + `skeleton.png` packer output. Use a tall-narrow region (e.g., 50×400 or 100×500) that the packer will rotate when rotation:true is enabled — packer rotation only kicks in when it improves density. Total fixture size target: ≤ 100 KB, in line with `spine_stripWS` (40K).
  - **Why:** Real-packer fixtures catch packer-quirk bugs that hand-synthesized atlas-text would miss (atlas-text formatting, off-by-one in offset/orig fields, page-dim conventions). Memory `feedback_gitignore_fixtures_check_test_refs` constraint: before adding the fixture path, grep `tests/` and `src/` to ensure no `.gitignore` rule (e.g., `fixtures/spine_*/`) shadows the new path. If a wildcard rule shadows it, EITHER pick a non-shadowed name OR add an explicit `!fixtures/spine_rotated/` un-ignore line.
  - **Carve-out for proprietary fixtures:** Chicken/Girl/Jokerman/test_4.3 are gitignored proprietary rigs (memory `project_atlas_less_primary_workflow` + ROADMAP constraint) — MUST NOT be the regression fixture. spine_rotated is the in-repo committed counterpart.

- **D-05: T2 coverage matrix — bone-rotation matrix on ATLAS-02, single-test ATLAS-01/03.** Test list:
  1. **ATLAS-01 (loader-accept):** new `tests/core/loader-rotation-accept.spec.ts` — load `fixtures/spine_rotated/EXPORT/skeleton.json`, assert `loadSkeleton` resolves with no error, assert at least one region in the resulting skeleton has `rotate: true` (spine-core `region.degrees === 90`).
  2. **ATLAS-02 (AABB equality matrix):** new `tests/core/bounds-rotation-aabb.spec.ts` — for a rotated RegionAttachment vs an unrotated counterpart (same source dims), assert `attachmentWorldAABB` returns equal AABBs at bone rotations 0°, 45°, 90°, 180°, -45° AND at scaleX≠scaleY (e.g., 2× × 0.5×) AND at non-zero attachment.rotation. The test constructs both attachments from synthetic data (no fixture dependency) so the matrix runs fast and deterministically.
  3. **ATLAS-03 (ExportPlan canonical dims):** new `tests/core/export-rotation-dims.spec.ts` — build an ExportPlan from a synthetic SkeletonSummary containing a rotated row (canonicalW=100, canonicalH=500, peakScale=1.0), assert `outW=100, outH=500` (canonical, not 500×100 swapped).
  4. **Image-worker rotation (passthrough + resize):** new `tests/main/image-worker-rotation.spec.ts` — for both passthrough and resize variants, run the worker against `fixtures/spine_rotated/`'s atlas page + a synthetic ExportPlan row marked `atlasSource.rotated: true`, assert the output PNG has canonical W×H AND pixel-content matches the unrotated source PNG (byte-compare or pixel-tolerance compare via `sharp(...).raw()`).
  5. **`RotatedRegionUnsupportedError` removal:** delete `tests/core/loader-rotation-rejection.spec.ts` + `tests/core/rotated-region-error.spec.ts` outright (they test removed behavior). Add a minimal arch-style assertion in an existing test (e.g., `tests/arch.spec.ts` if it has a "no stale identifiers" check, OR a new `tests/core/no-stale-rotation-error.spec.ts`) that grep-asserts no `RotatedRegionUnsupportedError` reference remains in `src/`.
  - **Why:** ATLAS-02 is the math-correctness surface most likely to fail at non-identity bones — the bone-rotation matrix is the highest-value test investment. ATLAS-01/03 are simple "did the data flow through correctly" checks; one assertion each is sufficient. Image-worker rotation is the runtime user surface that ATLAS-03 promises — pixel-level test catches direction-of-rotation mistakes.

### Claude's Discretion

- Exact attachment-walking pattern in D-01 (skin × slot × attachment iterator vs spine-core's `Skin.attachments` accessor — both work; planner picks idiomatic).
- Whether the loader's offset-override pass applies to ALL skins or just the default skin. Recommended: ALL skins (memory `project_sampler_visibility_invariant` says all skin-declared attachments are sampled).
- The exact 8-float canonical-corner formula in D-01 — derive from `attachment.width / attachment.height / attachment.x / attachment.y / attachment.scaleX / attachment.scaleY / attachment.rotation`. Cross-check against spine-core's `RegionAttachment.updateRegion()` formula at lines 84-108 of RegionAttachment.js with `region.width/height` substituted for `region.originalWidth/originalHeight` (canonical) instead of packed values — i.e., compute as if the region were unrotated.
- Whether the ATLAS-01 test additionally asserts the exact count of rotated regions in the fixture (e.g., 1 of 3 regions rotated). Recommended: yes — locks the fixture's expected shape.
- Sharp rotation argument naming and direction — verify during planning with a probe; bake the verified direction into the implementation comment so future readers don't have to re-derive.
- Whether the new `tests/core/no-stale-rotation-error.spec.ts` grep-assertion uses `fs.readFile` walk OR `child_process` grep. Recommended: in-process readdir + read + regex (Layer 3-clean, vitest-style; mirrors existing arch-spec patterns).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of Truth (Phase Boundary)
- `.planning/REQUIREMENTS.md` §"Atlas: rotated region support" L17-L21 — ATLAS-01..04 acceptance text (verbatim)
- `.planning/ROADMAP.md` §v1.4 Phase 33 entry L825-L888 — full phase description with constraints, success criteria, and the locked fix description (loader/bounds/export edits)
- `.planning/seeds/SEED-004-rotated-atlas-regions.md` — origin seed; documents the gap, the spine-ts handling at GPU time, and the Option B (full support) implementation sketch this phase implements

### Implementation Sites (load + bounds + export)
- `src/core/loader.ts:44` — `RotatedRegionUnsupportedError` import (delete in lockstep)
- `src/core/loader.ts:507-522` — current load-time rotation throw (Phase 22.1 G-01b D-03); the entire `if (!isAtlasLess) { for region... if degrees !== 0 throw }` block is removed
- `src/core/loader.ts:680-744` — atlasSources map construction; rotated regions already carry `rotated: boolean`, packW/packH = packed dims, w/h = original dims; this layer is correct as-is and does NOT change
- `src/core/loader.ts` (post-readSkeletonData, new code) — D-01 attachment-walk + offset override pass for rotated RegionAttachments
- `src/core/bounds.ts:59-92` — `attachmentWorldAABB` runs unchanged; correctness comes from D-01's pre-cooked offsets (no per-call branching needed)
- `src/core/bounds.ts:212-290` — `hullAreaRatio` mesh peakScale (untouched per D-02)
- `src/core/errors.ts:164-187` — `RotatedRegionUnsupportedError` class (delete in lockstep with loader/IPC/types)
- `src/main/ipc.ts:134` — `KNOWN_KINDS` Set entry for `'RotatedRegionUnsupportedError'` (delete)
- `src/shared/types.ts:894` — `KnownErrorKind` union case (delete)
- `src/main/image-worker.ts:274-298` — passthrough atlas-extract path (add sharp.rotate)
- `src/main/image-worker.ts:380-470` — resize atlas-extract path; line 422-438 typed-error block removed
- `src/core/export.ts:152-389` — `buildExportPlan`; `outW/outH = ceil(canonicalW × effScale)` formula at line 325 is already canonical-relative; D-01 making peakScale canonical-correct flows through automatically — verify during planning, no math change expected

### Spine-core Reference (read-only — informs D-01 / D-02 implementation)
- `node_modules/@esotericsoftware/spine-core/dist/attachments/RegionAttachment.js:66-128` — `updateRegion()` source; the `regionScaleX/regionScaleY` math at lines 82-87 + the `region.degrees == 90` UV branch at line 109 explain why rotated RegionAttachment world quads come out swapped
- `node_modules/@esotericsoftware/spine-core/dist/attachments/MeshAttachment.js:68-128` — `updateRegion()` mesh source; the `region.degrees` cases at lines 80-110 confirm mesh UV handling is correctly rotated by spine-core (D-02 untouched-path justification)
- `node_modules/@esotericsoftware/spine-core/dist/TextureAtlas.js:60-93` — atlas region parsing; `regionFields["rotate"]` at line 87 sets `region.degrees = 90` for `rotate:true` entries; `region.width/height` are PACKED, `region.originalWidth/originalHeight` are CANONICAL

### Existing Test Sites (precedent + lockstep delete targets)
- `tests/core/loader-rotation-rejection.spec.ts` — current behavior test ("Test 5: rotation rejection"); DELETE in lockstep with the throw removal
- `tests/core/rotated-region-error.spec.ts` — class shape test for `RotatedRegionUnsupportedError`; DELETE in lockstep with the class removal
- `tests/core/synthetic-atlas.spec.ts:52` — atlas-less invariant `region.degrees).toBe(0)`; UNCHANGED (D-02 + Out-of-Scope)
- `tests/core/bounds.spec.ts` — existing AABB tests; new rotation tests sit alongside (per D-05)
- `fixtures/spine_stripWS/` — fixture-shape precedent (Spine source + EXPORT folder); `fixtures/spine_rotated/` mirrors this exactly

### Project Conventions
- `CLAUDE.md` §"Critical non-obvious facts" #2 — `computeWorldVertices` after `updateWorldTransform` already handles bones/IK/Path/Physics/Deform; D-01's offset override leverages this pipeline (we only fix the local-quad layout)
- `CLAUDE.md` §"Critical non-obvious facts" #4 — math phase does not decode PNGs; D-01's offset override is pure math, no PNG reads, Layer-3 clean
- `CLAUDE.md` §"Critical non-obvious facts" #5 — `core/` is pure TS, no DOM; D-01's loader-side mutation lives in `src/core/loader.ts` (Layer-3 clean)

### Memory References (LOCKED constraints — do not contradict)
- `project_strict_loadermode_separation` — atlas-source vs atlas-less paths self-contained; rotation handling lives entirely on the atlas-source path
- `project_phase6_default_scaling` — uniform-only export math; D-01's canonical-dim swap is upstream of the export math, which continues to operate on uniform isotropic scales
- `project_sampler_visibility_invariant` — sampler measures all skin-declared attachments; D-01 attachment-walk applies to ALL skins
- `project_peak_anchored_invariants` — `applyOverride` canonical-relative; rotated regions feed canonical W×H to the same peak-anchored math
- `project_compute_export_dims_canonical_base` — `outW`/`sourceRatio` use canonicalW; rotated regions' canonicalW is the unrotated dim (post-D-01)
- `project_atlas_pack_options_atlas_source_only` — atlas-pack options live in atlas-source mode only; this phase brings rotation to full-handling parity with strip-whitespace
- `feedback_gitignore_fixtures_check_test_refs` — before committing `fixtures/spine_rotated/`, grep `.gitignore` rules + `tests/` + `src/` to confirm no shadowing pattern
- `feedback_narrow_before_fixing` — verify rotation direction (sharp.rotate ±90) with a probe before baking it in; do not assume

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`atlas.regions[].degrees`** — already parsed by spine-core 4.2; surfaced verbatim through `region.degrees === 90` (or 180/270) at `loader.ts:515` and `loader.ts:730`. The data is already in our hands; the v1.0 stop-gap was a refusal-to-handle, not a missing-data problem.
- **`atlasSources` map** (loader.ts:699-744) — already carries `rotated: boolean`, packW/packH (packed dims for sharp.extract), w/h (original/canonical dims), offsetX/Y. The image-worker has all the metadata it needs to do the rotated extract; the v1.0 gate at image-worker.ts:427 was a refusal-to-handle, not missing data.
- **`fixtures/spine_stripWS/`** (40K, in-repo) — the structural precedent for `fixtures/spine_rotated/`. Same shape: `.spine` source file + EXPORT folder with packer output. Test specs read it via direct paths; same pattern applies.
- **`safeScale` + `applyOverride`** (export.ts) — already canonical-relative; once D-01 makes peakScale canonical-correct for rotated regions, the entire ExportPlan cascade flows through unchanged.
- **Sharp pipeline shape** (image-worker.ts) — already chains `extract` → resize → encode; adding `rotate(-90)` is a one-line insertion.

### Established Patterns
- **Lockstep error-class removal** (Phase 22.1 forward) — KNOWN_KINDS Set entry + KnownErrorKind union + class definition + IPC envelope + tests must drop together. ROADMAP constraint locks this. The pattern is the inverse of Phase 22.1's class addition; mirror that commit shape in reverse.
- **Spine-core `updateRegion()` is called at load time** (during `SkeletonJson.readSkeletonData`) — D-01's post-readSkeletonData walk runs after spine-core has computed initial offsets. The walk overwrites `attachment.offset` for rotated regions only.
- **Layer-3 invariant (`tests/arch.spec.ts`)** — `src/core/*` cannot import DOM, Electron, sharp. D-01's offset override is pure TS object manipulation; trivially passes.
- **Real-packer fixture pattern** (`spine_stripWS`) — Spine source + EXPORT folder under `fixtures/`, test specs reference `fixtures/spine_X/EXPORT/skeleton.{json,atlas,png}`. New fixture follows the same path convention.

### Integration Points
- **Loader → analyzer → sampler → bounds.ts** — the per-RegionAttachment offset override at the loader runs before any sampler tick, so the hot loop sees canonical offsets without branching. No analyzer/sampler change.
- **buildExportPlan → image-worker** — ExportRow already carries `atlasSource.rotated: boolean` (post-D-01 unchanged). Image-worker reads it and branches the sharp pipeline.
- **IPC envelope** — `RotatedRegionUnsupportedError` removal is symmetric with Phase 22.1's addition. Renderer-side error display logic (`src/renderer/src/App.tsx:660-705` + `kind: 'RotatedRegionUnsupportedError'` arm) drops alongside.

</code_context>

<specifics>
## Specific Ideas

- **Rotation direction in sharp.rotate** — spine-ts atlas convention: `region.degrees == 90` means the source was rotated 90° CCW when packed. To un-rotate during atlas-extract, sharp needs `.rotate(-90)` (sharp rotates CW-positive). Verify with a probe before baking in (per memory `feedback_narrow_before_fixing`).
- **Tall-narrow region for fixture** — Spine packer's rotation heuristic only kicks in when rotation improves density; SIMPLE_PROJECT regions are roughly square (CIRCLE 699×699, SQUARE 1000×1000, TRIANGLE 833×759) and will likely NOT get rotated by the packer. Use a 50×400 or 100×500 narrow strip in the fixture's source rig.
- **Lockstep removal commits** — D-158/D-171 carve-out: removing `RotatedRegionUnsupportedError` requires touching `errors.ts`, `loader.ts`, `ipc.ts`, `shared/types.ts`, two test files in coordinated commits. Plan should sequence these as a SINGLE atomic commit (not multiple) so the codebase never enters a "type union references missing class" state mid-merge.
- **Strip-whitespace + rotation interaction** — verify the existing `.extend()` reconstitution at image-worker.ts:290-298 still applies post-rotation, with offsets in canonical-orientation, not packed-orientation. Stripped regions in atlas mode are already locked correct (`project_atlas_pack_options_atlas_source_only`); rotation must compose with that.
- **Test fixture grep hygiene** — before committing `fixtures/spine_rotated/`, run `grep -rn 'fixtures/spine_rotated' tests/ src/` to confirm no stale references; check `.gitignore` for any `fixtures/spine_*` wildcard that could shadow the new path. Memory `feedback_gitignore_fixtures_check_test_refs` lockstep.

</specifics>

<deferred>
## Deferred Ideas

- **Rotated MeshAttachment peakScale audit** — D-02 leaves the mesh code path untouched on the assumption that spine-core's `MeshAttachment.updateRegion` correctly remaps UVs for rotated regions and `hullAreaRatio` consumes those UVs verbatim. Rotated meshes are rare; if a real-world fixture surfaces with peakScale anomalies, audit the mesh-rotation interaction in a follow-up phase.
- **`region.degrees == 180 / 270` cases** — current Spine editor never emits these (rotation toggle produces only 0° or 90°). Spine-core handles 180/270 in `updateRegion()` but our D-01 override may not. If a future export surfaces a 180/270 region, address in a follow-up. Document this assumption in the loader comment.
- **Rotated region in atlas-less mode** — synthetic atlas always emits `rotated:false` (per loader.ts:723); rotation is a packer-only concern. Out-of-Scope by ROADMAP. If a future feature gives users in-app re-packing with rotation, atlas-less rotated regions become possible.
- **In-app atlas re-packing** — already in v1.0 deferred list (post-v1.1 carry-forward); not affected by this phase.
- **Renderer error UI for `RotatedRegionUnsupportedError`** — there's no bespoke UI to remove (the existing `projectLoadFailed` banner renders the generic error message); only the `kind: 'RotatedRegionUnsupportedError'` arm in IPC plumbing is dropped.
- **SPINE_4_2_COVERAGE_AUDIT items 4/5** — sequence + rotation interaction is on the audit list as "never undersize" known-limit (memory `project_spine_4_2_coverage_audit_pending`); T2 coverage doesn't close that gap explicitly. T3 would have, but the user picked T2. Track as a follow-up if rotated sequence regions surface in real-world fixtures.

### Reviewed Todos (not folded)

- `2026-04-24-phase-4-code-review-follow-up.md` (WR-03 + 6 info findings) — matched on weak keyword overlap (`phase`, `src`, `panels`); Phase 4 follow-up is unrelated to v1.4 atlas-rotation scope. Not folded.
- `2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md` (Phase 20 cross-platform DnD UAT) — matched on weak keyword overlap; orthogonal to atlas rotation. Not folded.
- `2026-05-08-phase-31-windows-admin-dnd-release-uat.md` (Phase 31 release UAT) — matched on weak keyword overlap; tracked separately under v1.3.1 release-time UAT. Not folded.

</deferred>

---

*Phase: 33 — Rotated atlas region support (loader + bounds + export + fixture)*
*Context gathered: 2026-05-10*

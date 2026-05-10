# Phase 33: Rotated atlas region support (loader + bounds + export + fixture) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 33-Rotated atlas region support (loader + bounds + export + fixture)
**Areas discussed:** Bounds swap locus, Mesh handling sub-question, Image-worker rotated extract, Fixture origin (ATLAS-04), Test depth & coverage

---

## Bounds Swap Locus

| Option | Description | Selected |
|--------|-------------|----------|
| B — loader mutates region.width/height | Swap region.width↔region.height after atlas parse before spine-core builds attachments. spine-core's full transform pipeline produces canonical-oriented quads. Need to verify MeshAttachment UV remap. Most surgical — one mutation site, no per-call branching. | ✓ |
| C — bypass spine-core for rotated RegionAttachments | Localized branch in attachmentWorldAABB; manually compute 4 corners using attachment.width/height (canonical) + bone matrix. Re-implements spine-core offset formula — maintenance liability. | |
| A — post-AABB swap | Swap (maxX-minX)↔(maxY-minY) around AABB center post-computation. Mathematically wrong under non-identity bone rotation. | |
| Defer to researcher | Hand the locus question to phase-researcher with three options + technical wrinkles documented. Adds research cycle. | |

**User's choice:** Option B — loader mutates region.width/height (recommended).
**Notes:** Selected before the mesh-attachment risk was surfaced; refined to B1 in the follow-up question.

---

## Mesh Handling Sub-question (B1 vs B2 vs research)

| Option | Description | Selected |
|--------|-------------|----------|
| B1 — per-RegionAttachment offset override | Walk attachments post-readSkeletonData; for rotated RegionAttachments overwrite cached offset[8] with canonical-dim corners. MeshAttachment untouched. Cleanest separation. | ✓ |
| B2 — global swap + accept mesh peakScale gap | Tiny diff but introduces silent correctness gap on rotated meshes. Defer mesh peakScale to follow-up. | |
| Lift research to verify mesh impact | Spawn researcher to probe spine-core MeshAttachment behavior with pre-swapped region.width/height. | |

**User's choice:** B1 — per-RegionAttachment offset override (recommended).
**Notes:** Locks the implementation to a load-time, per-attachment, single-pass mutation that doesn't touch the mesh code path. spine-core's MeshAttachment.updateRegion handles rotation correctly already (verified at MeshAttachment.js:80-90); not interfering with it preserves rotated-mesh peakScale.

---

## Image-Worker Rotated Extract

| Option | Description | Selected |
|--------|-------------|----------|
| Full coverage — sharp.rotate in both paths | Both passthrough (line 274-298) and resize (line 380-470) gain sharp.rotate(±90). Removes 'rotated-region-unsupported' typed-error block. Verify rotation direction with a probe. | ✓ |
| Resize-path only; passthrough kept gated | Add sharp.rotate to resize path; leave passthrough emitting typed error (rare path). | |
| Defer all atlas-extract rotation — typed error only | Both paths emit typed error; rotated projects load + analyze but cannot Optimize unless per-region PNGs exist. | |
| Lift to researcher | Verify sharp.rotate semantics + spine-packer rotation direction before implementing. | |

**User's choice:** Full coverage — sharp.rotate in both atlas-extract paths (recommended).
**Notes:** ATLAS-03's success criterion ("exported per-region PNG dims match unrotated source") implies any export of a rotated region must produce canonical output. Atlas-only projects (Jokerman-style) need the atlas-extract path; deferring would leave that workflow broken. Direction-of-rotation verification deferred to a planner-time probe.

---

## Fixture Origin (ATLAS-04)

| Option | Description | Selected |
|--------|-------------|----------|
| F1 — new spine_rotated/ Spine project | Create fixtures/spine_rotated/ mirroring spine_stripWS (Spine source + EXPORT folder with real packer rotation:true). Tall-narrow region the packer will rotate. Most authentic. | ✓ |
| F2 — re-pack SIMPLE_PROJECT + hand-edit .atlas | Hybrid: real PNG + hand-edited atlas-text with rotate:true. Atlas-text and PNG out of sync visually. | |
| F3 — hand-synthesize SPINE_ROTATED_TEST | Hand-written .json + .atlas + stub PNG mirroring SPINE_4_3_TEST. Smallest but bypasses real packer. | |
| F1 + F3 — both fixtures | Belt-and-suspenders. Two fixtures to maintain. | |

**User's choice:** F1 — new spine_rotated/ Spine project (recommended).
**Notes:** Mirrors the spine_stripWS precedent (40K, in-repo Spine source + EXPORT). User will create the .spine source file via Spine editor; a tall-narrow region (e.g., 50×400 or 100×500) will be packed with rotation:true to force the packer to rotate it.

---

## Test Depth & Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| T2 — reasonable matrix | Bone-rotation matrix on ATLAS-02 (0°/45°/90°/180°/-45° + scaleX≠scaleY); single-test ATLAS-01/03; passthrough+resize variants for image-worker. ~7-9 tests. | ✓ |
| T1 — minimal | One test per ATLAS-0N + removal grep. ~5 tests. Risk: identity-bone passes while non-identity fails silently. | |
| T3 — belt-and-suspenders | T2 + skin/animation/sequence dimensions; closes SPINE_4_2_COVERAGE_AUDIT sequence+rotation gap. ~12-15 tests. | |
| T2 + grep-test for stale refs | T2 + arch-style assertion that no RotatedRegionUnsupportedError reference remains. | |

**User's choice:** T2 — reasonable matrix (recommended).
**Notes:** ATLAS-02 bone-rotation matrix is the highest-value test investment — the math-correctness surface most likely to fail at non-identity bones. ATLAS-01/03 are simple data-flow checks; one assertion each is sufficient. Pixel-level image-worker test catches direction-of-rotation mistakes. Sequence+rotation gap (would need T3) tracked as a follow-up via memory `project_spine_4_2_coverage_audit_pending`.

---

## Claude's Discretion

The following implementation specifics were left to the planner / executor:
- Exact attachment-walking pattern in D-01 (skin × slot × attachment iterator vs spine-core's `Skin.attachments` accessor).
- Whether the offset-override pass applies to all skins or just default skin (recommended: all skins per memory `project_sampler_visibility_invariant`).
- The exact 8-float canonical-corner formula for D-01 (derive from spine-core RegionAttachment.updateRegion math with canonical dims substituted).
- ATLAS-01 test additionally asserting exact rotated-region count in the fixture (recommended: yes — locks fixture shape).
- Sharp rotation argument (-90 vs +270) — verify with planner-time probe.
- Whether the new no-stale-refs test uses fs.readFile or child_process grep (recommended: in-process for Layer-3 cleanliness).

## Deferred Ideas

- Rotated MeshAttachment peakScale audit — assumed correct via spine-core's UV-remap path; revisit if real-world fixture surfaces anomalies.
- `region.degrees == 180 / 270` cases — current Spine editor never emits these; address in follow-up if encountered.
- Rotated region in atlas-less mode — synthetic atlas always emits rotated:false; out-of-scope.
- In-app atlas re-packing — already on v1.0 deferred carry-forward list.
- Renderer error UI for RotatedRegionUnsupportedError — no bespoke UI exists to remove; only IPC arm dropped.
- SPINE_4_2_COVERAGE_AUDIT sequence+rotation interaction — out of scope at T2 coverage; track follow-up if rotated sequence regions surface.

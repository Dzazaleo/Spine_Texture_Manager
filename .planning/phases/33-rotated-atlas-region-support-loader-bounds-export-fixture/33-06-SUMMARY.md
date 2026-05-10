---
phase: 33
plan: 06
status: complete
completed: 2026-05-11
requirements_verified:
  - ATLAS-01
  - ATLAS-02
  - ATLAS-03
  - ATLAS-04
files_created:
  - .planning/phases/33-rotated-atlas-region-support-loader-bounds-export-fixture/33-06-SUMMARY.md
---

# Plan 33-06 — Phase verification roll-up

## Section 1 — ExportPlan canonical-flow verification (Task 1)

### Locus

`src/core/export.ts:325` — verbatim:

```ts
const outW = Math.ceil((acc.row.canonicalW ?? acc.row.sourceW) * acc.effScale);
const outH = Math.ceil((acc.row.canonicalH ?? acc.row.sourceH) * acc.effScale);
```

(Surrounding comment at lines 317-321 documents this as the "canonical-base
formula" landed in Phase 22.1 "Bug A fix"; the rationale already covered
the rotated-region case without naming it explicitly because `canonicalW`
is by definition the unrotated source width.)

### Data-flow chain (D-01 cascade)

| Stage | Source | Behavior |
|-------|--------|----------|
| Loader D-01 walk | `src/core/loader.ts` (Plan 33-04, ~530–615) | Walks all `RegionAttachment`s in every skin's slots, reads `region.degrees`, cooks canonical-corner offsets into the attachment's `offset[]` array. For rotated regions: sets `atlasSources.get(name).rotated = true` while `w`/`h` continue to carry **canonical (unrotated)** dims. |
| World AABB | `src/core/bounds.ts:attachmentWorldAABB` | Reads pre-cooked offsets via `computeWorldVertices` — produces correct world AABB regardless of rotation. NO change needed in Phase 33. |
| Analyzer | `src/core/analyzer.ts` | Aggregates peaks into `SkeletonSummary`; `canonicalW = atlasSources.get(name).w` = unrotated W. NO change in Phase 33. |
| ExportPlan | `src/core/export.ts:325` | `outW = ceil(canonicalW × effScale)` — emits canonical (unrotated) output dims. NO change in Phase 33. |
| Image worker | `src/main/image-worker.ts` (Plan 33-05, lines 293/540/563) | Receives `ExportRow` with `outW = canonicalW` and `atlasSource.rotated`. Applies `sharp.rotate(+90)` in passthrough + resize SW + resize non-SW paths to un-rotate the page-packed pixels back to canonical orientation. The downstream resize/extract honors the canonical `outW × outH`. |

### Test-level lock

`tests/core/export-rotation-dims.spec.ts` (Plan 33-05, 2/2 passing, just
re-verified 2026-05-11):

- Asserts a synthetic ExportRow with `canonicalW=500, canonicalH=100,
  atlasSource.rotated=true` produces `outW=500, outH=100` after
  `buildExportPlan` — exactly the canonical (unrotated) dims.
- A second case asserts `atlasSource.rotated=true` propagates unchanged
  through the plan rows.

### Conclusion

**Phase 33 required no math change to `src/core/export.ts`.** The canonical-
relative `outW`/`outH` formula already in place (Phase 22.1 Bug A fix) handles
rotated regions correctly via the D-01 cascade. ATLAS-03 acceptance is satisfied
end-to-end:

- D-01 (Plan 33-04) cooks canonical offsets → world AABB correct → analyzer feeds
  canonical W/H → ExportPlan emits canonical W/H → image-worker rotates the
  packed pixels back to canonical orientation while honoring the canonical dims.

`git diff --stat` for this task: 0 src/ changes, only this SUMMARY file.

## Section 2 — HUMAN-UAT sign-off (Task 2)

_Awaiting user UAT — see plan 33-06 §Task 2 §how-to-verify for the 6-step
runbook. Resume signal: "UAT approved" (with observed dims) or
"ISSUE: &lt;step-N&gt; &lt;description&gt;"._

This section will be filled in once the user signs off on the live UAT.

## Section 3 — Phase 33 close-of-phase summary

### Plans (6/6 complete)

| Plan | Wave | Deliverable | Status |
|------|------|-------------|--------|
| 33-01 | 1 | Real-Spine-packer rotated fixture at `fixtures/spine_rotated/EXPORT/` | DONE — 68 KB, one `rotate:90` region (`rect`), three control regions |
| 33-02 | 1 | 5 RED-scaffold spec files (all `it.todo`) | DONE — all 5 active and green post-Waves 2/3 |
| 33-03 | 2 | Atomic lockstep removal of `RotatedRegionUnsupportedError` + `'rotated-region-unsupported'` ExportError kind | DONE — 11 files in one commit, arch-grep guard active |
| 33-04 | 3 | D-01 loader walk + ATLAS-01/02 tests | DONE — loader.ts ~530-615; 16-case bone × attachment matrix passes |
| 33-05 | 3 | sharp.rotate(+90) in image-worker + ATLAS-03 tests | DONE — probe-verified direction; 3 rotation sites in image-worker |
| 33-06 | 4 | Verification roll-up + HUMAN-UAT | Task 1 DONE; Task 2 awaiting user |

### Requirements coverage

| REQ | Plans | Test artifact | Status |
|-----|-------|---------------|--------|
| ATLAS-01 | 33-03 (removes legacy throw), 33-04 (D-01 walk) | `tests/core/loader-rotation-accept.spec.ts` (2/2) | MET |
| ATLAS-02 | 33-04 (D-01 walk produces correct offsets) | `tests/core/bounds-rotation-aabb.spec.ts` (16/16) | MET |
| ATLAS-03 | 33-05 (image-worker rotation + ExportPlan canonical-flow no-op) | `tests/core/export-rotation-dims.spec.ts` (2/2) + `tests/main/image-worker-rotation.spec.ts` (3/3) | MET (pending UAT step-4) |
| ATLAS-04 | 33-01 (fixture), 33-04 + 33-05 (consumers) | `fixtures/spine_rotated/EXPORT/skeleton.{atlas,json,png}` | MET (`.spine` source deferred — see 33-01 SUMMARY §Deviations) |

### Test suite delta across the phase

- Start of phase: 91 files / 1000 pass / 0 fail / 3 skip / 27 todo
- After 33-02 scaffolds: same pass count; +5 spec files; +22 it.todo
- After 33-03 lockstep removal: 90 files / 0 fail / 4 skip (rotation-rejection spec deleted, no-stale-rotation-error un-skipped)
- After 33-04 D-01 walk: 92 files / 1009 pass / 0 fail / 2 skip / 7 todo
- After 33-05 image-worker rotation: 94 files / 1014 pass / 0 fail / 0 skip / 2 todo
- After 33-06 Task 1 re-spot-check: still green

### Memory invariants preserved

- `project_strict_loadermode_separation` — D-01 walk is atlas-source-mode only; atlas-less path untouched (verified via Plan 33-04 SUMMARY)
- `project_phase6_default_scaling` — outW/outH formula unchanged; uniform scaling preserved
- `project_sampler_visibility_invariant` — sampler.ts untouched
- `project_peak_anchored_invariants` — analyzer canonical-W base preserved
- `project_compute_export_dims_canonical_base` — `outW = ceil(canonicalW × effScale)` documented and re-verified at line 325
- `project_atlas_pack_options_atlas_source_only` — rotation handled in atlas-source pipeline only; atlas-less PNG-header fallback unaffected
- `feedback_gitignore_fixtures_check_test_refs` — fixture committed, grep hygiene passed
- `feedback_narrow_before_fixing` — probe-verified `sharp.rotate(+90)` direction BEFORE committing production code (Plan 33-05)

### Lockstep precedent

Plan 33-03's atomic 11-file commit follows the D-158 / D-171 precedent for
type-removal lockstep: a single revertible commit, zero half-state windows.

### Next

After UAT sign-off:

1. `/gsd-verify-work 33` (or accept the phase-end gates in the orchestrator)
2. v1.4 milestone close (Phase 32 + 33 are the milestone's two phases — both
   will be done after this UAT)
3. Tag + release per project release-tag conventions (dot-separated prerelease
   tokens per CLAUDE.md "Release tag conventions")

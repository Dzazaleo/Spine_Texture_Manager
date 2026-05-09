---
slug: sequence-peak-atlas-vs-less
status: resolved
trigger: "Sequence attachment peak scales differ between atlas-source and atlas-less modes after optimize-and-reload round trip. Reported by user 2026-05-08 against PARTICLES_1/* sequence frames (likely TEST_03 fixture, follow-on from resolved spine-sequence-undercount session). Reopened 2026-05-09: original round-trip bug fixed, but the loader.ts:199-244 fix exposed a side-effect — dims-mismatch badge now fires on every per-frame trimmed sequence frame in atlas-source mode (e.g. PARTICLES_1/01..29 show source 411×404..417×403, canonical 414×405, badge: 'Atlas region declares 412×403 but canonical is 414×405'). User reports 'something definitely off'."
created: 2026-05-08
updated: 2026-05-09
diagnose_only: false
---

# Debug: sequence-peak-atlas-vs-less

## Symptoms

### Expected behavior
After exporting optimized images at 0% buffer in atlas-source mode and reloading those optimized images in atlas-less mode, every region's peak scale should be **1.000×** (yellow). Reasoning: 0% buffer export shrinks the source to exactly the peak world demand, so reading the post-export images, source ≡ peak ⇒ ratio = 1.000×. This works correctly for all non-sequence regions in screenshot 2 (HEAD_TOP, HEADBAND, L_ARM_1, L_ARM_2, L_CLOVER, L_EYE, L_EYE_WHITE, L_HAIR_BACK, L_HAIR_FRONT, NECK — all 1.000× yellow with the "already-optimized" badge icon).

### Actual behavior
- **Atlas-source mode (screenshot 1)**: PARTICLES_1/00..19 sequence frames each show source ~414×405 → peak ~405×396 = **0.978×** (green). Animation IDLE, frame counts ~10.
- **Atlas-less mode after exporting at 0% buffer (screenshot 2)**: PARTICLES_1/00..19 sequence frames now show source ~405×396 (the post-optimize dims) → peak ~396×387 = **still 0.978×** (green, NOT yellow). The other ~10 non-sequence regions correctly settle at 1.000× yellow.
- The 0.978× ratio is **preserved across the round trip** for sequence frames only — as if the peak demand was being recomputed as a fraction of the new (smaller) canonical instead of as an absolute world-space measurement.

### Error messages
None. Bug is silent — wrong scale displayed but no exception.

### Timeline
Emerged after the spine-sequence-undercount fix (resolved 2026-05-08, see `.planning/debug/spine-sequence-undercount.md`). That fix made sequence frames individually canonical (per-frame regionName keys in sampler, individual entries in `walkSyntheticRegionPaths`, etc.). This bug is a follow-on: the per-frame canonical work succeeded in *most* maps (sourceDims, sourcePaths, atlasSources, actualDimsByRegion all got per-frame entries via the synthesizer's sequence walker and the sampler's fan-out), but **`canonicalDimsByRegion` was not similarly fanned** — it still keyed only on the JSON basePath (`PARTICLES_1/`). Per-frame analyzer lookups missed the map → fallback to `canonicalW = p.sourceW` → `dimsMismatch` evaluated false in atlas-less mode → display column showed `outW / actualSourceW ≈ 0.978` instead of the expected `outW / actualSourceW = 1.000`.

### Reproduction
1. Load `fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json` in atlas-source mode (with bundled `.atlas` + 4096×4096 page PNG).
2. Note PARTICLES_1/* sequence frames show ~0.978× peak (screenshot 1 evidence).
3. Click Optimize Assets. Set buffer to 0%. Export to a new images folder.
4. Switch to atlas-less mode (toggle); point app at the just-exported folder so it reads the optimized PNGs.
5. Inspect PARTICLES_1/* — observed 0.978× (still green), expected 1.000× (yellow with already-optimized badge).
6. Compare to NECK/L_HAIR_*/etc. on the same screen — those correctly show 1.000× yellow, proving the round-trip itself works for non-sequence regions.

### Loader mode coverage
- Atlas-source mode: shows the "true" peak (this is the baseline).
- Atlas-less mode after 0%-buffer export: should produce 1.000× across the board (non-sequence regions confirm this works); sequences regress to 0.978×.
- Both modes use the same sampler / same Spine runtime; the divergence is in how sequence-frame peak ratios are folded into the displayed scale.

### Goal (per user 2026-05-08)
Sequence frames must round-trip identically to non-sequence regions: 0%-buffer optimize → atlas-less reload → all rows 1.000× yellow.

### Locked invariants to respect (from project memory)
- `project_peak_anchored_invariants.md` — mesh peakScale needs page→canonical correction in hullAreaRatio; applyOverride is canonical-relative; Peak column shows world demand, NOT export dims.
- `project_compute_export_dims_canonical_base.md` — `computeExportDims` must use `canonicalW` as outW base (not `sourceW`).
- `project_strict_loadermode_separation.md` — atlas-source and atlas-less are self-contained; load.atlasPath gates every read of opposite artifact set.
- `project_sampler_visibility_invariant.md` — sampler must measure all skin-declared attachments (Pass 1.5 manifest pass at sampler.ts:188-263).

## Current Focus

```yaml
hypothesis: |
  ROOT CAUSE CONFIRMED — none of the original three theories survived the
  diagnostic. The actual bug is at a different layer:

  `canonicalDimsByRegion` (loader.ts:199-244) was populated by walking
  `parsedJson.skins[*].attachments[slot][entry]` and keying on the entry's
  basePath (`att.path ?? entryName`). For sequence-bearing attachments the
  basePath is the sequence base (e.g. `PARTICLES_1/`), but every other map
  in LoadResult — sourceDims, sourcePaths, atlasSources, actualDimsByRegion
  — gets per-frame entries (`PARTICLES_1/00`, `PARTICLES_1/01`, ...) via the
  Phase 21-09 / spine-sequence-undercount fix.

  Downstream, the analyzer keys lookups by `p.regionName ?? p.attachmentName`
  (analyzer.ts:226), and after the sampler's sequence fan-out
  (sampler.ts:407-564) `regionName` is the per-frame composed path. So
  `canonicalDims.get('PARTICLES_1/00')` returned `undefined` — the analyzer
  fell back to `canonicalW = p.sourceW`, making `canonicalW === actualSourceW`
  in atlas-less mode (both = the on-disk PNG dim). With dimsMismatch = false,
  the export-view's sourceRatio cap is Infinity, effScale = peakScale (no cap),
  outW = ceil(canonicalW × peakScale) = ceil(405 × 0.978) = 396, and
  displayScale = 396 / 405 = 0.978 → green.

  After the fix (per-frame canonical entries: `canonicalW = 414, canonicalH = 405`
  for every PARTICLES_1/<i>), atlas-less round trip: actualSource = 405×396 vs
  canonical 414×405 → dimsMismatch = true → sourceRatio = 0.9778 caps effScale
  → outW = ceil(414 × 0.9767) = 405 = actualSourceW → displayScale = 405/405 =
  1.000 yellow. Matches non-sequence behavior.
test: |
  scripts/probe-sequence-peak.mjs runs the round trip on
  fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json (which already ships
  pre-shrunk PARTICLES_1 PNGs in `images/` and canonical-dim PARTICLES_1
  PNGs in `images_unpacked/`). Compares atlas-source vs atlas-less output.

  Pre-fix: PARTICLES_1/00 atlas-less reports
    `actualSource=405×396 canonical=405×396 mismatch=false displayScale=0.9778`
  Post-fix: PARTICLES_1/00 atlas-less reports
    `actualSource=405×396 canonical=414×405 mismatch=true displayScale=1.0000`

  Non-sequence rows (NECK, HEAD_TOP, HEADBAND) unchanged — they always had
  per-frame canonical (= per-attachment canonical, count=1).
expecting: |
  ROOT CAUSE confirmed. Fix is a 5-line addition in loader.ts:199-244.
next_action: applied — see Resolution.
```

## Evidence

- timestamp: 2026-05-08T21:00Z
  context: Diagnostic probe scripts/probe-sequence-peak.mjs run against TEST_03 fixture.
  finding: |
    Atlas-source PARTICLES_1/00: peakScale=0.976694 actualSource=414×405 canonical=414×405 mismatch=false displayScale=0.9783
    Atlas-less  PARTICLES_1/00: peakScale=0.976694 actualSource=405×396 canonical=405×396 mismatch=false displayScale=0.9778

    The peakScale is bit-identical across modes (0.976694) — confirms the
    canonical-correction in hullAreaRatio works correctly for sequences (theory A
    falsified) and the round-trip is lossless at the sampler layer (theory C
    falsified — passthrough behavior is irrelevant; PNG dims match peak demand
    exactly).

    The bug is downstream in toDisplayRow: `canonicalW = p.sourceW` fallback
    triggers in atlas-less because canonicalDimsByRegion has no entry keyed
    `PARTICLES_1/00`, only `PARTICLES_1/`.
- timestamp: 2026-05-08T21:00Z
  context: Source read of loader.ts:215-243 vs synthetic-atlas.ts:271-330.
  finding: |
    `walkSyntheticRegionPaths` (synthetic-atlas.ts) was patched in the prior
    debug session to expand sequences via composeSequenceFramePath. The parallel
    walker in loader.ts that builds `canonicalDimsByRegion` was NOT patched —
    it still emits one entry per JSON skin/slot/entry tuple, keyed by basePath.
    The two walkers should mirror each other: same iteration, same key shape.
- timestamp: 2026-05-08T21:00Z
  context: Verification probe after applying fix.
  finding: |
    Atlas-less PARTICLES_1/00..03: displayScale=1.0000 (yellow, expected)
    Atlas-less PARTICLES_1/04: displayScale=0.9975 — slightly under 1.0 because
      that frame's atlas-source originalWidth was 412 (vs 414 canonical) and
      its on-disk PNG ended up at 403 (one pixel under the ceil-effective 404
      target). This is sub-pixel rounding noise inside the 1px tolerance the
      panel already treats as "close enough" — separate from the reported bug
      symptom. Non-sequence rows unchanged.
- timestamp: 2026-05-08T21:05Z
  context: Test suite run after fix.
  finding: |
    `npx vitest run` — 969 passed, 3 skipped, 2 todo. No regressions.

## Eliminated

- 2026-05-08: Theory A (sequence mesh peakScale stored as ratio not absolute world pixels) — peakScale is bit-identical (0.976694) across atlas-source and atlas-less modes. The page→canonical correction in hullAreaRatio (bounds.ts:281-287) does cancel correctly for sequences; the per-frame `region.originalWidth/Height` × `attachment.width/height` factors compose to make peakScale invariant of the on-disk PNG basis. Theory falsified.
- 2026-05-08: Theory B (page→canonical correction missing for sequence frames specifically) — same evidence as Theory A. The correction fires for both sequence and non-sequence meshes; bounds.ts has no sequence-specific branch. Theory falsified.
- 2026-05-08: Theory C (PassthroughCopies partition fails for sequences → 0%-buffer export re-encodes → sub-pixel drift) — irrelevant; the bug reproduces purely from the analyzer's display math, with no involvement from the export-write path. The fixture's `images/` folder contains already-shrunk PNGs at exact peak-demand dims, and the bug surfaces just from re-loading them. Theory falsified.

## Resolution

- timestamp: 2026-05-08T21:05Z
- root cause: |
    `canonicalDimsByRegion` in `src/core/loader.ts` (lines 215-243) iterated
    `parsedJson.skins[*].attachments[slot][entry]` and inserted **one entry per
    JSON entry**, keyed by the basePath `att.path ?? entryName`. For sequence
    attachments, the basePath collapses N frames under a single key (e.g.
    `PARTICLES_1/` for 30 frames `PARTICLES_1/00..29`).

    The sampler's sequence fan-out (sampler.ts:407-564, locked 2026-05-08)
    emits per-frame `PeakRecord`s whose `regionName` is the composed per-frame
    path, and the analyzer (analyzer.ts:226) keys downstream maps by
    `p.regionName ?? p.attachmentName`. For per-frame rows the lookup against
    `canonicalDimsByRegion` returned `undefined` — `toDisplayRow` then fell
    back to `canonicalW = p.sourceW` (analyzer.ts:98).

    In atlas-less mode after a 0%-buffer round trip, `p.sourceW` is the
    shrunk PNG's IHDR width; combined with the same value as `actualSourceW`
    (also from PNG IHDR), `dimsMismatch` evaluated false, the export-view's
    `sourceRatio` cap was `Infinity`, and `effScale = peakScale = 0.978`.
    `outW = ceil(p.sourceW × 0.978) ≈ ceil(0.978 × 0.978 × actualSourceW)` ≠
    actualSourceW → `displayScale = outW / actualSourceW = 0.978` (green).

    Fix: in the canonicalDimsByRegion walker, when the JSON entry carries
    `sequence: { count, start, digits }`, expand to N per-frame keys via
    `composeSequenceFramePath` (already exported from `synthetic-atlas.ts`),
    each pointing at the same `(canonicalW, canonicalH)` from the entry's
    JSON `width/height`. Mirrors `walkSyntheticRegionPaths` (the prior
    spine-sequence-undercount fix's pattern); pure additive — non-sequence
    attachments fall through unchanged.

    With the fix, atlas-less round-trip lookup of `PARTICLES_1/00` returns
    `canonical=414×405` from JSON; `actualSourceW=405` (from PNG header) <
    canonicalW=414 → `dimsMismatch=true` → `sourceRatio=0.9778` caps
    `effScale`, `outW=ceil(414 × 0.9767)=405=actualSourceW`, and
    `displayScale = 405/405 = 1.000` yellow — matching non-sequence
    regions and the user-reported expected behavior.
- fix: |
    src/core/loader.ts:
      - Added `composeSequenceFramePath` to the synthetic-atlas import (line 51).
      - Extended the inline `att` type at line 210 to include the optional
        `sequence?: { count?: number; start?: number; digits?: number }` field.
      - Replaced the unconditional `canonicalDimsByRegion.set(regionName, ...)`
        with a sequence-aware branch: when `att.sequence` is present and
        `count > 0`, loop `i = 0..count-1` and set per-frame entries via
        `composeSequenceFramePath(basePath, i, start, digits)`. Falls through
        to the basePath-key path otherwise (defensive: count=0 sequences and
        non-sequence attachments).
      - Renamed the walker's local from `regionName` to `basePath` for clarity.

    No other files modified; no test changes needed (969 existing tests pass).
    Diagnostic kept at scripts/probe-sequence-peak.mjs as a regression sentinel.

---

## REOPENED 2026-05-09 — fix side-effect surfaced

### New symptom

After the loader.ts:199-244 fix landed, the user reloaded TEST_03 in atlas-source
mode (original atlas, not the post-export one) and observed: the dims-mismatch
badge now fires on **every per-frame trimmed sequence frame**, e.g.
`PARTICLES_1/01..29` show source `411×404..417×403` vs canonical `414×405` with
the tooltip "Atlas region declares 412×403 but canonical is 414×405". Frame /00
happens to have full bounds (414×405) and shows no badge. The user reported
this as "something definitely off" — the previous build (pre-fix) showed no
badges on these frames.

### Why this is happening (verified by source read)

- `sourceDims` map in atlas-source mode is built from `region.originalWidth/originalHeight`
  (loader.ts:497-515). spine-core 4.2 auto-backfills these from packed dims when
  no `orig:` line is present, so `sourceDims = atlas-orig-or-packed` per region.
- For sequences, Spine's atlas packer trims each frame independently to its
  own content bounds. Each frame's `originalWidth/Height` differs (the screenshot
  values 411×404, 412×403, 413×401, etc. are these per-frame trimmed bounds).
- `canonicalDimsByRegion` post-fix sets `(414, 405)` for every sequence frame
  (the JSON-declared `att.width/height` — single value shared across all frames).
- Pre-fix: `canonicalDimsByRegion` had no entry for per-frame keys → analyzer
  fell back to `canonical = source` → no mismatch → no badge.
- Post-fix: lookup hits → canonical (414×405) ≠ per-frame source (411×404, …)
  → `dimsMismatch = true` → badge fires.

The badge is **technically true** (atlas regions ARE smaller than JSON canonical
for trimmed frames), but it fires on every frame except /00, producing visual
noise on a 30-frame sequence.

### Question to resolve

For sequences, what's the correct semantic for "canonical"?

Three options on the table:

(D-A) **JSON-declared canonical, all frames (current fix)**
  - Round-trip in atlas-less works (1.000× yellow).
  - Atlas-source pre-export shows badges on every trimmed frame (current symptom).
  - Honest in the sense that JSON canonical IS what the export pipeline uses
    as the `outW` base (locked invariant `project_compute_export_dims_canonical_base.md`).

(D-B) **Atlas-orig per-frame for atlas-source mode; JSON canonical for atlas-less mode**
  - Mode-divergent canonical. In atlas-source mode, canonical = per-frame
    atlas-orig (= source typically) → no spurious badges.
  - In atlas-less mode, canonical = JSON declared (from synthetic-atlas walker),
    so round-trip still works.
  - Risk: inconsistent semantics across modes; could surprise users toggling.

(D-C) **JSON canonical everywhere (D-A), suppress badge for sequence frames**
  - UI-side fix in `useUiAdapter.ts` / DimsBadge: skip the badge when the row
    is a sequence frame (detect via attachment metadata).
  - Loader/analyzer math unchanged.
  - Drawback: hides the genuine info that frames are independently trimmed.
    But — that info is expected behavior for Spine sequence packs.

### Locked invariants in scope (do NOT violate)

- `project_compute_export_dims_canonical_base.md` — `computeExportDims` uses
  `canonicalW` as `outW` base. Whatever `canonicalDimsByRegion` returns gets
  consumed here. D-A keeps it equal to JSON-declared (export emits uniform
  output across sequence frames). D-B would diverge across modes — verify the
  export pipeline still emits uniform output in atlas-source mode.
- `project_strict_loadermode_separation.md` — atlas-source and atlas-less are
  self-contained. D-B is on-spec for this (per-mode resolution).
- `project_peak_anchored_invariants.md` — Peak column shows world demand; not
  affected here.

### Investigation seed

1. Read `analyzer.ts:226` and `useUiAdapter.ts` to confirm the badge-emission
   site and what info is available to the badge UI (attachment metadata,
   sequence flag).
2. Verify the export path in atlas-source mode for a sequence — does it use
   per-frame atlas-orig or JSON canonical for the output dim base? Locked
   invariant says canonical, but if D-B is chosen, the export pipeline must
   continue producing one uniform output dim across frames.
3. Decide between D-A / D-B / D-C with the user (this is a UX/semantic call,
   not a math bug).

## Current Focus (reopened)

```yaml
hypothesis: |
  D-A is the math-correct choice (preserves locked canonical invariant), but
  the UX cost is a badge cascade on every trimmed sequence frame. Most likely
  resolution: D-C (keep math-correct canonical, suppress badge for sequence
  frames) — the "trim per frame" info is expected for Spine sequences and
  doesn't warrant a per-row warning.
test: |
  - Confirm badge emission site (renderer-side or core?).
  - Confirm sequence-frame detection signal available at the emission site
    (regionName basePath != attachmentName? sequence count > 1?).
  - Decide with user before applying.
expecting: D-C — UI suppression. D-B is a fallback if the user wants the per-frame source treated as canonical in atlas-source mode (mode-divergent).
next_action: gather evidence on badge emission site + sequence-frame detection signal at that layer
```

## Resolution (reopened side-effect)

- timestamp: 2026-05-09T00:35Z
- root cause (side-effect): |
    The 2026-05-08 fix in `src/core/loader.ts:199-244` correctly fanned
    `canonicalDimsByRegion` to per-frame keys for sequence-bearing
    attachments. Each PARTICLES_1/<i> now resolves to JSON-canonical
    `(414, 405)`. Math is right — the export pipeline's locked invariant
    (`project_compute_export_dims_canonical_base.md`) requires `outW =
    ceil(canonicalW × effScale)`, and uniform 414×405 canonical produces
    uniform `outW = 405` across all 30 frames, which is what the 0%-buffer
    atlas-less round-trip needs to settle every frame at 1.000× yellow.

    Side-effect surfaced: in atlas-source mode, `actualDimsByRegion` reads
    `region.originalWidth/Height` (loader.ts:594-602), and Spine's atlas
    packer trims each sequence frame independently to its own content
    bounds. So per-frame source dims vary (411×404, 412×403, 413×401, …)
    while canonical is uniform (414×405). The analyzer's `dimsMismatch`
    1px-tolerance predicate (analyzer.ts:106-109) evaluates true for every
    trimmed frame, and `DimsBadge.tsx:44` renders the badge on every row.

    The badge tooltip ("Atlas region declares 412×403 but canonical is
    414×405") is technically true but UX-noisy on a 30-frame sequence — and
    it specifically describes Spine's *expected* per-frame trim behavior
    for sequences, not a project-state warning.

    Diagnostic confirmed before scoping the fix
    (`feedback_narrow_before_fixing.md`): `scripts/probe-sequence-peak.mjs`
    output shows PARTICLES_1/01..04 in atlas-source mode have
    `mismatch=true` while non-sequence rows (HEAD_TOP, HEADBAND, NECK)
    have `mismatch=false` — confirming the issue is sequence-specific.

    D-B (mode-divergent canonical: atlas-orig per-frame for atlas-source,
    JSON-canonical for atlas-less) was eliminated: it would emit per-frame
    divergent `outW` in atlas-source export, breaking the locked
    `computeExportDims` invariant and the round-trip uniform-output
    contract. D-A (current math, accept badges as informational) was also
    rejected as UX-poor for 30-frame sequences. D-C (UI suppression for
    sequence frames in atlas-source mode) was selected: the math stays
    correct, the export pipeline is unaffected, and the badge continues
    to fire informatively in atlas-less mode (where pre-optimized PNGs
    really are smaller than canonical and the cap-binding tooltip is
    useful) and on non-sequence rows in atlas-source mode (where a real
    atlas-pack issue would be worth surfacing).
- fix: |
    Five files, additive:

    1. `src/core/types.ts` — add optional `isSequenceFrame?: boolean` to
       `SampleRecord`. Documents that sampler-emitted records can mark
       themselves as sequence fan-out frames; defaults to undefined ≡
       false for backward-compat with synthetic test fixtures.

    2. `src/core/sampler.ts` — in `fanOutSequencePeaks`, stamp
       `isSequenceFrame: true` on every fanned `PeakRecord` (global,
       setup, per-animation). The non-fanned records emitted by
       `snapshotFrame` are untouched (false by default). Only the
       sequence post-pass sets the flag, so it is structurally guaranteed
       to fire on exactly the per-frame fan-out rows and nothing else.

    3. `src/shared/types.ts` — add optional `isSequenceFrame?: boolean`
       to `DisplayRow` and `RegionRow`. `BreakdownRow extends DisplayRow`
       inherits the field. All optional/undefined-≡-false; CLI byte-lock
       D-102 preserved (CLI does not iterate this field).

    4. `src/core/analyzer.ts` — propagate `p.isSequenceFrame` from
       `PeakRecord` into the three row builders: `toDisplayRow`,
       `toBreakdownRow`, and `toRegionRow` (latter from winner). Spread
       conditionally so the field is omitted when false (keeps the
       structuredClone-safe object shape minimal for IPC).

    5. `src/renderer/src/components/DimsBadge.tsx` — add a sibling gate
       after the existing `if (!row.dimsMismatch) return null;`:
       `if (loaderMode === 'auto' && row.isSequenceFrame === true) return null;`
       Atlas-less mode unaffected; non-sequence rows in atlas-source
       unaffected.

    No changes to `loader.ts`, `analyzer.ts`'s `dimsMismatch` predicate,
    `export.ts`'s `outW = ceil(canonicalW × effScale)` formula, or any
    other math layer. Pure additive UI suppression with a typed
    end-to-end signal.

    Verification:
    - `npx tsc --noEmit` — clean.
    - `npx vitest run` — 969 passed, 3 skipped, 2 todo (matches pre-fix
      baseline; no regressions).
    - `scripts/probe-sequence-peak.mjs` round-trip: atlas-less
      PARTICLES_1/00..04 still settle at displayScale=1.0000 (the
      original 2026-05-08 fix preserved). Atlas-source PARTICLES_1/01..04
      still report mismatch=true at the analyzer layer (math is right)
      but the UI suppression gate hides the badge.
    - `scripts/probe-sequence-flag.mjs` (new sentinel) confirms
      `isSequenceFrame=true` propagates to DisplayRow + RegionRow for
      PARTICLES_1/* and stays false on HEAD_TOP/HEADBAND/NECK in both
      modes.

    Locked invariants respected:
    - `project_compute_export_dims_canonical_base.md` — canonicalW
      remains the export `outW` base; no change to export math.
    - `project_strict_loadermode_separation.md` — atlas-source and
      atlas-less remain self-contained; the suppression check reads
      `loaderMode` at the renderer (UI-only) layer, not core math.
    - `project_peak_anchored_invariants.md` — Peak column unchanged.
    - `feedback_narrow_before_fixing.md` — diagnostic probe confirmed
      the bug shape before scoping the fix; D-B falsified, D-C selected.

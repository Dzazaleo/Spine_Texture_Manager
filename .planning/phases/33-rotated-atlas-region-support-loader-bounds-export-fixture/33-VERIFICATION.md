---
phase: 33-rotated-atlas-region-support-loader-bounds-export-fixture
verified: 2026-05-11T10:00:45Z
status: passed
score: 5/5 ROADMAP Success Criteria verified (plus 4/4 ATLAS REQs satisfied)
overrides_applied: 1
overrides:
  - must_have: "ATLAS-04 .spine source file (fixtures/spine_rotated/rotated.spine)"
    reason: "User explicitly opted to defer the .spine editor source per 33-01-SUMMARY.md §Deviations item 1. The committed atlas+json+png trio satisfies ATLAS-04's regression-fixture intent (exercised end-to-end by loader-rotation-accept + image-worker-rotation specs); the .spine source is a re-export convenience artifact, not a functional gate."
    accepted_by: "Leo (user) via execution conversation 2026-05-10"
    accepted_at: "2026-05-10T00:00:00Z"
---

# Phase 33: Rotated Atlas Region Support — Verification Report

**Phase Goal:** Rotated atlas region support — loader accepts rotated regions (lockstep removal of `RotatedRegionUnsupportedError`), world AABB matches unrotated reference, image-worker produces canonical-orientation PNG output, real-Spine-packer rotated fixture committed.

**Verified:** 2026-05-11T10:00:45Z
**Status:** passed
**Re-verification:** No — initial verification (REVIEW.md fixes landed in-phase via commit `ae224ca`; no prior VERIFICATION.md existed)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Loader accepts atlas-source projects with `rotate:true` regions; `RotatedRegionUnsupportedError` "Rotated atlas regions are not supported" message no longer appears (ATLAS-01) | VERIFIED | `grep -rn RotatedRegionUnsupportedError src/` returns 0 lines; `src/core/errors.ts` no longer exports the class; `src/core/loader.ts:560-562` accepts `region.degrees !== 0` regions and applies D-01 offset cooking; `tests/core/loader-rotation-accept.spec.ts:21-26` asserts `loadSkeleton` resolves without throwing on the real fixture |
| SC-2 | World-space AABB for rotated regions matches what spine-ts runtime would render at identity scale (ATLAS-02) | VERIFIED | D-01 walk at `loader.ts:531-613` writes pre-cooked canonical-corner floats into `attachment.offset[0..7]`; `bounds.ts` reads them via `computeWorldVertices` unchanged; `tests/core/bounds-rotation-aabb.spec.ts` runs a 16-case matrix (8 bone-states × 2 attachment-rotations) asserting `Math.abs(wRot - wUnrot) < 1e-6` and same for height; all 16 cases pass under `npm test` |
| SC-3 | Optimize Assets exports per-region PNGs whose dims match the unrotated source W×H, NOT the packed-rotated dims (ATLAS-03) | VERIFIED | `src/main/image-worker.ts` has 3 `pipeline.rotate(90)` sites (passthrough line 315, resize SW pre-pipeline line 582, resize non-SW line 605) with sourceCanvasW/H derived locals at 327-328 and 567-568; `tests/main/image-worker-rotation.spec.ts:96-97` asserts `meta.width = CANONICAL_W (100), meta.height = CANONICAL_H (500)` against the real fixture; `tests/core/export-rotation-dims.spec.ts:64-65` locks `outW = 100, outH = 500` for a canonicalW=100/canonicalH=500/packW=500/packH=100 synthetic row; HUMAN-UAT step 5 confirmed observed 100×500 output (33-06-SUMMARY) |
| SC-4 | Rotated-atlas regression fixture exists under `fixtures/` (not gitignored, in-repo) exercised by core unit tests covering ATLAS-01..03 (ATLAS-04) | VERIFIED (with override for `.spine` source) | `fixtures/spine_rotated/EXPORT/{skeleton.json,skeleton.atlas,skeleton.png}` exist; `du -sk = 68 KB ≤ 100 KB cap`; `git check-ignore` exits 1 (NOT ignored); atlas contains `rotate:90` on line 13; exercised by `loader-rotation-accept.spec.ts` (loader path) + `image-worker-rotation.spec.ts` (sharp pipeline path). `.spine` source file deferred per user decision (override). |
| SC-5 | Atlas-less mode loads the same in-repo fixtures it loaded pre-Phase-33 with no behavioral change; synthetic atlas continues to emit `rotated:false`; rotation code path statically unreachable from atlas-less branch | VERIFIED | `src/core/loader.ts:778-792` atlas-less branch sets `rotated: false` unconditionally; D-01 walk at `loader.ts:552` is gated on `if (!isAtlasLess)`; `npm test -- tests/core/loader-atlas-less.spec.ts` → 9/9 pass; `synthetic-atlas.ts` does not emit any rotation directive (grep returns no matches for "rotate"/"degrees") |

**Score:** 5/5 ROADMAP Success Criteria verified

### Plan must_haves Coverage Matrix (per-plan)

| Plan | Must-have | Status | Evidence |
|------|-----------|--------|----------|
| 33-01 | skeleton.json/atlas/png in `fixtures/spine_rotated/EXPORT/` | VERIFIED | `ls` confirms all 3 present |
| 33-01 | atlas contains `rotate:true` token | VERIFIED (variant) | atlas contains `rotate:90` — functionally identical per spine-core `TextureAtlas.js:87-93` (`parseInt("90") == 90`, same `region.degrees = 90`); deviation documented in 33-01-SUMMARY §Deviations item 2 |
| 33-01 | Total size ≤ 100 KB | VERIFIED | `du -sk = 68 KB` |
| 33-01 | NOT gitignored | VERIFIED | `git check-ignore` exits 1 |
| 33-01 | `.spine` source file | OVERRIDE | Deferred per user; tracked in 33-01-SUMMARY §Deviations item 1 |
| 33-02 | 5 RED-scaffold spec files exist | VERIFIED | All 5 exist; all active (no `describe.skip`); 27 tests pass when run as a 5-spec subset |
| 33-03 | `RotatedRegionUnsupportedError` removed from errors.ts | VERIFIED | `grep "class RotatedRegionUnsupportedError" src/core/errors.ts` returns 0 matches |
| 33-03 | `'rotated-region-unsupported'` removed from ExportError.kind union | VERIFIED | `src/shared/types.ts:520` ExportError.kind = `'missing-source' \| 'sharp-error' \| 'write-error' \| 'overwrite-source'` (no rotated-region-unsupported) |
| 33-03 | `tests/core/loader-rotation-rejection.spec.ts` deleted | VERIFIED | `ls` returns "No such file" |
| 33-03 | `tests/core/rotated-region-error.spec.ts` deleted | VERIFIED | `ls` returns "No such file" |
| 33-03 | `tests/core/no-stale-rotation-error.spec.ts` active and passing | VERIFIED | `describe(...)` present (no `describe.skip`); 2 grep cases pass |
| 33-03 | Atomic commit (single lockstep) | VERIFIED | Commit `a92b07e refactor(33-03): lockstep removal of RotatedRegionUnsupportedError + 'rotated-region-unsupported' kind` exists; touches 11 files in one commit |
| 33-04 | RegionAttachment imported in loader.ts | VERIFIED | `src/core/loader.ts:34` imports `RegionAttachment` from spine-core |
| 33-04 | D-01 walk after `readSkeletonData` writes 8 canonical-corner floats | VERIFIED | `loader.ts:531-613` contains the walk with `off[0..7]` writes using `region.height * rsX` and `region.width * rsY` SWAP form |
| 33-04 | `loader-rotation-accept.spec.ts` active + passing | VERIFIED | 4 active tests, all green (includes post-UAT canonical/page-pixel split assertions at lines 54-77) |
| 33-04 | `bounds-rotation-aabb.spec.ts` active + passing (16 cases) | VERIFIED | 16 it() cases declared via `matrixCases` × `attRotations` loop; all pass |
| 33-04 | Layer 3 invariant preserved (no DOM/Electron/sharp imports in loader.ts) | VERIFIED | `tests/arch.spec.ts` passes; only new import is RegionAttachment (spine-core) |
| 33-05 | 3 `rotate(90)` sites in image-worker.ts | VERIFIED | `grep -c "rotate(90)" src/main/image-worker.ts` outputs 3 |
| 33-05 | `sourceCanvasW = a.rotated ? a.packH : a.packW` derived locals in both paths | VERIFIED | Present at `image-worker.ts:327-328` (passthrough) and `:567-568` (resize) |
| 33-05 | `export-rotation-dims.spec.ts` active + passing | VERIFIED | 2 tests, post-CR-02 fix uses canonicalW=100 → outW=100 assertion (matches real fixture) |
| 33-05 | `image-worker-rotation.spec.ts` active + passing | VERIFIED | 3 tests, post-CR-01 fix uses CANONICAL_W=100/PACKED_W=500 (matches real fixture); includes content-aware pixel assertion (rMean/gMean/bMean/aMean > 240 + green tint guard) |
| 33-06 | `src/core/export.ts:325` outW formula is canonical-relative (no math change needed) | VERIFIED | `Math.ceil((acc.row.canonicalW ?? acc.row.sourceW) * acc.effScale)` at line 325 |
| 33-06 | HUMAN-UAT sign-off recorded | VERIFIED | 33-06-SUMMARY §Section 2 records "Approved 2026-05-11 by user" with step-by-step observations; post-fix re-run shows 5/5 UAT steps PASS |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `fixtures/spine_rotated/EXPORT/skeleton.json` | Valid Spine 4.2 JSON | VERIFIED | Parses; 68 KB total fixture |
| `fixtures/spine_rotated/EXPORT/skeleton.atlas` | Atlas text with `rotate:true`/`rotate:90` | VERIFIED | Contains `rotate:90` on line 13 for `rect` region |
| `fixtures/spine_rotated/EXPORT/skeleton.png` | Valid 1839×1464 PNG | VERIFIED | sharp.metadata reads it |
| `fixtures/spine_rotated/rotated.spine` | Spine editor source | DEFERRED (override) | Per user decision |
| `src/core/loader.ts` D-01 walk | Lines ~531-613 with RegionAttachment-only post-readSkeletonData walk, `off[0..7]` writes, SWAP form | VERIFIED | All grep markers present (Phase 33 header, `instanceof RegionAttachment`, `region.degrees === 0` guard, `region.height * rsX`, `region.width * rsY`) |
| `src/core/loader.ts` packW/packH page-pixel swap | UAT fix for rotated atlasSources | VERIFIED | Lines 797-807: `const packW = rotated ? region.height : region.width; const packH = rotated ? region.width : region.height;` (commit `9bb078a`) |
| `src/core/errors.ts` | No `RotatedRegionUnsupportedError` class | VERIFIED | Class definition absent; only `SpineLoaderError`, `SkeletonJsonNotFoundError`, `AtlasNotFoundError`, `AtlasParseError`, `SpineVersionUnsupportedError`, `MissingImagesDirError` remain |
| `src/shared/types.ts` ExportError.kind union | No `'rotated-region-unsupported'` arm | VERIFIED | Union is `'missing-source' \| 'sharp-error' \| 'write-error' \| 'overwrite-source'` |
| `src/main/ipc.ts` KNOWN_KINDS | No RotatedRegionUnsupportedError entry | VERIFIED | grep returns 0 hits |
| `src/main/image-worker.ts` rotation | 3 rotate(90) sites + WR-03 force-extract gate | VERIFIED | Sites at lines 315, 582, 605; WR-03 force-extract at lines 217 + 432 (`if (row.atlasSource?.rotated === true) useAtlasExtract = true`) |
| `src/renderer/src/modals/AtlasPreviewModal.tsx` pre-rotate | Temp canvas CW90 for rotated regions | VERIFIED | Lines 561-590: `document.createElement('canvas')` + `tctx.rotate(Math.PI / 2)` + `tctx.drawImage(...)` (commit `6a025c0`) |
| 5 active spec files (no `describe.skip`) | Phase 33 ATLAS-01/02/03/04 + arch-grep coverage | VERIFIED | All 5 files exist; `grep "describe.skip"` returns 0 hits; 27 tests pass when run as subset |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `loader.ts` D-01 walk | `bounds.ts` `attachmentWorldAABB` | pre-cooked `attachment.offset[]` consumed by `computeWorldVertices` | WIRED | Confirmed by 16-case bounds-rotation-aabb.spec.ts; cooks once at load, math is read-only downstream |
| `loader.ts` atlasSources Map | `image-worker.ts` runExport | ExportRow.atlasSource.{packW,packH,rotated,w,h} | WIRED | atlasSources populated in loader.ts:778-820; consumed at image-worker.ts:217 (force-extract gate) and :327-335 (passthrough extend args) |
| `loader.ts` atlasSources Map | analyzer.ts → buildExportPlan | canonicalW/H = atlasSources.w/h (unrotated dims) | WIRED | Documented in 33-06-SUMMARY §Section 1 data-flow chain; locked by export-rotation-dims.spec.ts |
| `image-worker.ts` passthrough+resize | `row.atlasSource.rotated` | branch on rotated flag, `.rotate(90)` before extend | WIRED | grep confirms 3 rotate(90) sites in correct positions; sourceCanvasW/H derived locals present in both branches |
| `loader-rotation-accept.spec.ts` | `fixtures/spine_rotated/EXPORT/skeleton.json` | `path.resolve(...)` at line 18 + `loadSkeleton` call | WIRED | Test passes; reads real fixture |
| `image-worker-rotation.spec.ts` | `fixtures/spine_rotated/EXPORT/skeleton.png` | `ROTATED_PAGE` constant fed into hand-built ExportPlan + `runExport` | WIRED | Test passes; content-aware assertion locks both slice coordinates and rotation direction against the real PNG |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `loader.ts` D-01 walk | `attachment.offset[]` | `skeletonData.skins[*].attachments` (post-spine-core parse) | Yes — real spine-core SkeletonData with real RegionAttachment instances; D-01 cooks 8 floats per rotated attachment | FLOWING |
| `loader.ts` atlasSources Map | `packW`, `packH`, `w`, `h`, `rotated` | `atlas!.regions` (from spine-core TextureAtlas) | Yes — real region dims from libgdx parser; rotated derived from `region.degrees !== 0` | FLOWING |
| `image-worker.ts` passthrough | output PNG file | sharp pipeline (extract → rotate(90) → extend → toFile) | Yes — verified end-to-end via spec running against real PNG fixture; content-aware assertion confirms correct pixel data (rMean/gMean/bMean > 240, no green tint from neighbor SQUARE region) | FLOWING |
| `image-worker.ts` resize | output PNG file | sharp pipeline (extract → rotate(90) → extend → toBuffer → resize → toFile) | Yes — verified via resize spec asserting `meta.width = ceil(CANONICAL_W * 0.5)` | FLOWING |
| `AtlasPreviewModal.tsx` rotated region tile | Canvas drawImage output | Pre-rotated temp canvas (CW90) | Yes (in real browser); jsdom limitation noted as WR-04 deferred — current safety net is HUMAN-UAT (per code review and 33-06 UAT sign-off) | FLOWING (production) / STATIC (jsdom test env per WR-04) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `npm test` | `Test Files 94 passed (94); Tests 1016 passed \| 3 skipped \| 2 todo (1021)` | PASS |
| TypeScript compiles | `npx tsc --noEmit` | Exit 0 | PASS |
| All 5 Phase 33 specs pass in isolation | `npm test -- tests/core/loader-rotation-accept.spec.ts tests/core/bounds-rotation-aabb.spec.ts tests/core/export-rotation-dims.spec.ts tests/main/image-worker-rotation.spec.ts tests/core/no-stale-rotation-error.spec.ts` | `Test Files 5 passed (5); Tests 27 passed (27)` | PASS |
| Atlas-less mode unchanged | `npm test -- tests/core/loader-atlas-less.spec.ts` | `Tests 9 passed (9)` | PASS |
| Arch-grep guard validates no stale refs | `grep -rn "RotatedRegionUnsupportedError\\|'rotated-region-unsupported'" src/` | 0 lines | PASS |
| Real fixture loads via loader | (covered by loader-rotation-accept.spec.ts) | passes | PASS |
| Real fixture page PNG drives image-worker | (covered by image-worker-rotation.spec.ts content-aware assertion) | passes (rMean/gMean/bMean/aMean > 240; gMean - rMean < 10) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ATLAS-01 | 33-03, 33-04 | Loader accepts atlas regions packed with `rotate:true`; hard-throw removed; rotated regions propagate through analyzer; atlas-less unaffected | SATISFIED | RotatedRegionUnsupportedError absent in src/; loader-rotation-accept 4/4 pass; no-stale-rotation-error 2/2 pass; loader-atlas-less 9/9 pass (regression intact) |
| ATLAS-02 | 33-04 | attachmentWorldAABB matches what runtime would render for rotated regions at identity scale | SATISFIED | bounds-rotation-aabb 16/16 pass; D-01 walk in loader.ts pre-cooks canonical offsets; bounds.ts reads them unchanged. Note: implementation uses D-01 attachment-offset cooking rather than bounds.ts W↔H swap, but the *outcome* matches the ROADMAP SC ("AABB matches unrotated reference") — verified empirically across 16 bone×attRot cases within 1e-6 tolerance |
| ATLAS-03 | 33-05 | ExportPlan output dims for rotated regions reflect unrotated (visually-correct) W×H | SATISFIED | export-rotation-dims 2/2 pass; image-worker-rotation 3/3 pass (passthrough dims, resize dims, content-aware pixel sanity); 3 rotate(90) sites in image-worker.ts; ExportPlan canonical-relative outW formula at export.ts:325 unchanged |
| ATLAS-04 | 33-01, 33-04, 33-05 | Rotated-atlas regression fixture under fixtures/ (not gitignored, committed in-repo) exercised by core unit tests for ATLAS-01..03 | SATISFIED (with .spine source override) | fixtures/spine_rotated/EXPORT/{json,atlas,png} present (68 KB, not gitignored, rotate:90 region `rect`); exercised by loader-rotation-accept.spec.ts (real-fixture loader path) + image-worker-rotation.spec.ts (real-fixture sharp pipeline + content-aware assertion). `.spine` source deferred per user (33-01-SUMMARY §Deviations item 1; tracked as override) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/core/loader.ts` | 541-543 | Comment: "ASSUMES region.degrees === 90 only ... if a future export surfaces non-90° rotation, this path silently misbehaves" | INFO | Deferred per CONTEXT Out-of-Scope; Spine 4.2 editor never emits 180/270. REVIEW WR-01 flagged this and it remains deferred to followup. Not a blocker. |
| `tests/main/image-worker-rotation.spec.ts` | (synthetic SW + rotation coverage) | No test for `offsetX > 0` or `offsetY > 0` rotated rows | INFO | REVIEW WR-02 flagged; deferred. Real fixture has SW=off. Production code branch (extend args) exists but is unverified for SW+rotation. Acknowledged limitation. |
| `src/renderer/src/modals/AtlasPreviewModal.tsx` | 576-590 | Temp-canvas branch silently degrades in jsdom (no node-canvas backing) | INFO | REVIEW WR-04 flagged; deferred. UAT-by-eye is current safety net (HUMAN-UAT 2026-05-11 sign-off confirms working in Electron). |
| `scripts/probe-sharp-rotate.mjs` | 75-81 | Dead comment block | INFO | REVIEW IN-01; cosmetic only |

No BLOCKER- or WARNING-level anti-patterns in shipped code paths for the phase goal. The 4 INFO items are explicitly deferred to follow-up backlog and documented in REVIEW.md.

### Human Verification Required

(None outstanding — HUMAN-UAT already performed and signed off 2026-05-11. See 33-06-SUMMARY §Section 2 for full step-by-step UAT trace including the 3 UAT-surfaced bugs and their commit-level fixes.)

### Gaps Summary

No gaps. All 5 ROADMAP Success Criteria are verified against the codebase. All 4 ATLAS REQ acceptance criteria are met. The 2 BLOCKER + 1 WARNING surfaced by code review (CR-01: image-worker-rotation.spec.ts inverted fixture constants; CR-02: export-rotation-dims.spec.ts inverted canonical dims; WR-03: image-worker per-region path bypassed rotation when sourcePath existed) were ALL fixed in-phase via commit `ae224ca` and the corrected post-UAT invariants are now locked by active tests using real fixture values.

The single deferral — `fixtures/spine_rotated/rotated.spine` editor source file (per 33-01 Plan must_have) — is accepted via override:
- 33-01-SUMMARY explicitly records the user's decision to ship without it
- ATLAS-04 acceptance is "regression fixture committed and exercised by tests for ATLAS-01..03" — all three are satisfied by the EXPORT/ artifacts
- The .spine source is a re-export convenience artifact, not a functional gate for any test or production code path
- REQUIREMENTS.md traceability table still lists ATLAS-04 as "Pending" — recommend updating to "Complete" or "Complete (with .spine deferral)" given the verified evidence

The 6 REVIEW.md deferred items (WR-01 180/270 guard, WR-02 SW+rotation test coverage, WR-04 AtlasPreviewModal jsdom gap, IN-01/02/03 cleanups) are all documented backlog items, not phase-blocking gaps — none affect ATLAS-01..04 acceptance against the real fixture.

---

_Verified: 2026-05-11T10:00:45Z_
_Verifier: Claude (gsd-verifier)_

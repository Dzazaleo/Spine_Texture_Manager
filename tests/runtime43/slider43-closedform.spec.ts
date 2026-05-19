// tests/runtime43/slider43-closedform.spec.ts
// Phase 46 Plan 01 Task 3 — SLIDER-02 closed-form peak layer.
//
// This is the SLIDER-02 closed-form peak layer — the layer
// slider43-smoke.spec.ts deliberately deferred to Phase 46 (its header
// lines 10-14: "the slider numeric verification is SLIDER-01/02, owned by
// Phase 46"). slider43-smoke.spec.ts is byte-untouched; this is a SEPARATE
// closed-form spec beside it.
//
// The asserted literal `4.0` is HAND-DERIVED and source-cited from
// node_modules/@esotericsoftware/spine-core@4.3.0 `Slider.update()` (the
// full derivation is inline below per the D-04 codebase closed-form
// convention — tests/core/overrides.spec.ts:108-130). The proof is that
// this test passes against an UNCHANGED src/core/ (SC#2 / N2.2 — NO
// slider-specific sampler code is needed; the slider math is carried
// entirely by the vendored spine-core@4.3.0 through the unchanged
// updateWorldTransform('update') path). The second it-block machine-asserts
// that zero-core-code invariant via a git scope diff.
//
// D-05 triangulation: the test ALSO reads fixtures/SLIDER_4_3/NOTES.txt
// (the owner's independent Spine 4.3 editor read — Esoteric's own
// reference runtime) and asserts it agrees within 1e-2. That NOTES.txt arm
// LOUD-FAILS (throws) if the file is absent/unparseable — it is NOT a
// Wave-0 skip: Phase 46 commits fixtures/SLIDER_4_3/NOTES.txt itself
// (D-03), so its absence is a verification-integrity failure.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildLoadSlider43, sample } from './baseline-driver.js';

// Phase-46 base = last phase-45 commit (immediately before any phase-46
// work; src/core/ has had ZERO changes since). SC#2 invariant (SLIDER-02 /
// N2.2): this phase adds NO slider-specific src/core/ code — the slider math
// is carried entirely by the UNCHANGED vendored
// @esotericsoftware/spine-core@4.3.0 through the UNCHANGED
// updateWorldTransform('update') path.
const PHASE_46_BASE_SHA = '1a2016f';
// Upper bound is PINNED to Phase 46's completion commit (ed6d124,
// `docs(phase-46): evolve PROJECT.md`), symmetric to the base
// (1a2016f = the docs(phase-45) completion commit). The original plan
// diffed `BASE..HEAD`, which is a time-bomb: this is a permanently
// installed regression test, but `..HEAD` made the assertion fail forever
// the instant ANY later phase touched src/core/ (e7db8fe/2ff135a/etc. all
// legitimately did). The SC#2 proof is a HISTORICAL fact about Phase 46's
// own diff, so it must be bounded to Phase 46's commit range. ed6d124 is a
// permanent ancestor of HEAD — this range is now immutable and correct.
const PHASE_46_END_SHA = 'ed6d124';

const NOTES_TXT = path.resolve(__dirname, '..', '..', 'fixtures/SLIDER_4_3/NOTES.txt');

/** Tolerant scaleX extraction from the owner-authored NOTES.txt. A missing
 *  file or an unparseable number THROWS — fixtures/SLIDER_4_3/NOTES.txt is
 *  committed by Phase 46 itself (D-03), so its absence is a
 *  verification-integrity failure, NOT a Wave-0 skip (RESEARCH.md Pitfall 2;
 *  contrast slider43-smoke.spec.ts:78-84 — same loud posture, inverted
 *  disposition vs the rig-ENOENT arm). */
function parseNotesScaleX(): number {
  let txt: string;
  try {
    txt = readFileSync(NOTES_TXT, 'utf8');
  } catch (err) {
    throw new Error(
      'slider43-closedform: fixtures/SLIDER_4_3/NOTES.txt is absent — it is ' +
        'committed by Phase 46 (D-03), so its absence is a ' +
        'verification-integrity failure, NOT a Wave-0 skip. Author it per ' +
        '46-OWNER-EXPORT-SPEC.md Action (b). (' + String(err) + ')',
    );
  }
  const m = txt.match(/scale\s*x[^0-9-]*(-?[0-9]+(?:\.[0-9]+)?)/i);
  if (m == null) {
    throw new Error(
      'slider43-closedform: fixtures/SLIDER_4_3/NOTES.txt has no parseable ' +
        "'scaleX = <number>' — the owner must record the editor-observed " +
        'slider_bone world scaleX (~4.0) per 46-OWNER-EXPORT-SPEC.md Action ' +
        '(b). Content was:\n' + txt,
    );
  }
  return parseFloat(m[1]);
}

describe('SLIDER_4_3 closed-form (SLIDER-02 — peak == hand-derived 4.0; D-05 triangulation; SC#2 zero core/ code)', () => {
  it('sampled `square` peakScale == closed-form 4.0; NOTES.txt editor value triangulates within 1e-2', () => {
    const built = buildLoadSlider43();
    if (built == null) {
      // Legit Wave-0 fixture-absence skip ONLY (rig dir genuinely absent —
      // impossible post-Phase-44; 44-01 committed fixtures/SLIDER_4_3/). A
      // pickRuntime('4.3') failure does NOT reach here — it propagates
      // inside buildLoadXtra (verification-integrity, NOT a skip).
      expect(true).toBe(true);
      return;
    }
    const out = sample(built.load);
    const rec = [...out.globalPeaks.values()].find(
      (r) => r.attachmentName === 'square',
    );
    expect(
      rec,
      'square must appear in SLIDER_4_3 globalPeaks (the rig binds one ' +
        'square region to slider_bone)',
    ).toBeDefined();

    // ===================================================================
    //  HAND-DERIVED CLOSED FORM (D-04) — paste VERBATIM from
    //  46-RESEARCH.md "Closed-Form Slider Oracle" Steps 0-4-note.
    //  Source-cited from node_modules/@esotericsoftware/spine-core@4.3.0
    //  dist/Slider.js:51-72 + SkeletonJson.js:319-340 +
    //  TransformConstraintData.js:172-177 + Animation.js (duration in s).
    //
    //  SLIDER-01.json (committed, D-01): constraints[0] = { type:"slider",
    //    name:"drive", animation:"scale", bone:"slider_bone", property:"x",
    //    scale:0.005, local:true }. Slider.update():
    //      p.time = data.offset
    //             + (FromX.value(local) - data.property.offset) * data.scale
    //    Resolved defaults (SkeletonJson.js): offset=0 (no "to"),
    //    property.offset=0 (no "from"), mix=1 (so the p.mix===0 guard does
    //    NOT early-return), scale = 0.005 / propertyScale(=1) = 0.005,
    //    local=true => FromX.value = slider_bone.appliedPose.x. So:
    //      p.time = 0.005 * slider_bone.x   (then Math.max(0,p.time); loop=false)
    //    The slider applies the `scale` animation at p.time. `scale` timeline
    //    [ {}, {time:1, x:4, y:4} ] is linear (no curve) =>
    //      slider_bone.scaleX(t)=scaleY(t) = 1 + 3*clamp(t,0,1) over 0->1 s.
    //
    //  `slide` pass (the load-bearing slider proof): track-0 `slide` ramps
    //    slider_bone.x 0->200 over 0->1 s. Slider reads x => p.time=0.005*x;
    //    at x=200 => p.time=1.0 s => slider applies `scale` @1.0 s =>
    //    scaleX=scaleY = 1 + 3*1 = 4.0. (Translation is scale-invariant for a
    //    RegionAttachment world scale, so the x->200 translation does NOT
    //    inflate the peak; the 4.0 comes solely from the slider mapping x
    //    through the referenced `scale` animation.) If the 4.3 slider did
    //    NOT propagate through the unchanged updateWorldTransform('update')
    //    path, the `slide` pass would peak at 1.0 (translation only) and this
    //    assertion would fail — making 4.0 a true peak==analytical assertion,
    //    NOT a self-referential "it runs".
    //
    //  computeRenderScale(region) = |bone.appliedPose.getWorldScaleX/Y()|;
    //  slider_bone has no parent scale (root identity). globalPeaks is the
    //  max across ALL animations+skins => peakScale = peakScaleX = peakScaleY
    //  = 4.0 (the 10x10 region dims cancel — region peak is bone-world-scale
    //  only, not an area ratio).
    //
    //    +==============================================================+
    //    |  CLOSED-FORM GROUND TRUTH (hand-derived, D-04):  peak = 4.0   |
    //    |    = 1 + 3 * clamp(p.time,0,1)  at p.time = 1.0 s             |
    //    +==============================================================+
    // ===================================================================
    expect(rec!.peakScale).toBeCloseTo(4.0, 5);
    expect(rec!.peakScaleX).toBeCloseTo(4.0, 5);
    expect(rec!.peakScaleY).toBeCloseTo(4.0, 5);

    // D-05 triangulation — the independent third leg: Esoteric's own
    // reference runtime, read by the owner into NOTES.txt. parseNotesScaleX()
    // THROWS if the file is absent/unparseable (NOT a Wave-0 skip — D-03).
    const notesScaleX = parseNotesScaleX();
    expect(
      Math.abs(notesScaleX - 4.0),
      'NOTES.txt editor-observed slider_bone world scaleX (' + notesScaleX +
        ') must triangulate with the hand-derived + sampled 4.0 within 1e-2',
    ).toBeLessThan(1e-2);
  });

  it('SC#2: this phase adds ZERO slider-specific src/core/ code (git scope check empty)', () => {
    // Machine-checked structural fact (memory
    // feedback_explicit_identity_over_inference): the slider math is carried
    // by the UNCHANGED vendored spine-core@4.3.0 through the UNCHANGED
    // updateWorldTransform('update') path. The only phase-46 edits are under
    // tests/, fixtures/SLIDER_4_3/NOTES.txt, and .planning/. A non-empty
    // list means a slider-specific core/ change leaked and the SLIDER-02
    // SC#2 proof is invalidated.
    const changed = execFileSync(
      'git',
      ['diff', '--name-only', PHASE_46_BASE_SHA + '..' + PHASE_46_END_SHA, '--', 'src/core/'],
      { cwd: path.resolve(__dirname, '..', '..'), encoding: 'utf8' },
    )
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    expect(
      changed,
      'Phase 46 must not modify any src/core/ file (SLIDER-02 SC#2 / N2.2 — ' +
        'the absence of slider code IS the deliverable). Changed: ' +
        (changed.join(', ') || '(none)'),
    ).toEqual([]);
  });
});

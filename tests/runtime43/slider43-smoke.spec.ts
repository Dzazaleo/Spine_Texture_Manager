// tests/runtime43/slider43-smoke.spec.ts
// Phase 44 Plan 04 Task 3 — SLIDER smoke (D-02, OPTIONAL).
//
// D-02: SLIDER_4_3/ in Phase 44 is EXISTENCE-only (the Phase-42
// phase44-fixture-guard.spec.ts enforces existence, armed by 44-01's
// CURRENT_PHASE bump) PLUS this OPTIONAL load-no-throw confidence layer:
// the SLIDER_4_3/ owner rig parses through runtime-43 without throw and
// yields a non-empty SkeletonData.
//
// SCOPE FENCE (do NOT pull Phase-46 work in): this is a load-no-throw smoke
// ONLY. It does NOT sample, does NOT compute or compare any slider-driven
// peak value — the slider numeric verification is SLIDER-01/02, owned by
// Phase 46 (CONTEXT D-02 / Deferred Ideas). Kept deliberately free of any
// sample()/peak math so the Phase-46 scope stays out.
//
// Loud-or-skip presence guard (the load43.ts:47-72 verification-integrity
// contract): a broken pickRuntime('4.3') PROPAGATES (a verification-integrity
// failure, NOT a Wave-0 skip); ONLY a genuinely absent rig directory/file
// (ENOENT) is a legit Wave-0 skip. The Phase-44 fixture guard makes absence
// impossible at Phase 44 (44-01 commits the rig) — this arm is the Wave-0
// safety net only.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { pickRuntime } from '../../src/core/runtime/runtime.js';

const RIG_DIR = path.resolve(__dirname, '..', '..', 'fixtures/SLIDER_4_3');

function isFileAbsent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err != null &&
    (err as { code?: string }).code === 'ENOENT'
  );
}

/** Resolve the single `.json` + single `.atlas` by directory scan (owner
 *  filenames are Claude's-Discretion; only the dir name is locked). Null ONLY
 *  when the dir itself is absent (legit Wave-0 ENOENT skip). A dir that exists
 *  but lacks a `.json`/`.atlas` is a malformed rig → throw (loud-over-silent:
 *  a half-exported rig must fail loud, never green-wash as "absent"). */
function resolveSliderFiles(): { jsonPath: string; atlasPath: string } | null {
  let entries: string[];
  try {
    entries = readdirSync(RIG_DIR);
  } catch (err) {
    if (isFileAbsent(err)) return null; // legit Wave-0: owner rig dir absent
    throw err;
  }
  const jsons = entries.filter((f) => f.toLowerCase().endsWith('.json'));
  const atlases = entries.filter((f) => f.toLowerCase().endsWith('.atlas'));
  if (jsons.length === 0 && atlases.length === 0) return null; // empty → Wave-0
  if (jsons.length !== 1) {
    throw new Error(
      `slider43-smoke: expected exactly one .json in ${RIG_DIR}, found ` +
        `${jsons.length} (${jsons.join(', ') || 'none'}) — malformed owner ` +
        'rig, NOT a Wave-0 skip.',
    );
  }
  if (atlases.length !== 1) {
    throw new Error(
      `slider43-smoke: expected exactly one .atlas in ${RIG_DIR}, found ` +
        `${atlases.length} (${atlases.join(', ') || 'none'}) — malformed ` +
        'owner rig, NOT a Wave-0 skip.',
    );
  }
  return {
    jsonPath: path.resolve(RIG_DIR, jsons[0]),
    atlasPath: path.resolve(RIG_DIR, atlases[0]),
  };
}

describe('SLIDER_4_3 smoke (D-02 — OPTIONAL load-no-throw; no sampling/no peak math — Phase 46 fenced out)', () => {
  it('SLIDER_4_3/ parses through runtime-43 with no throw and yields a non-empty SkeletonData', () => {
    // pickRuntime('4.3') must succeed — any failure is a
    // verification-integrity defect, NOT a Wave-0 skip: it PROPAGATES.
    const rt = pickRuntime('4.3');
    if (rt == null) {
      throw new Error(
        "slider43-smoke: pickRuntime('4.3') returned null — runtime-43 must " +
          'be resolvable. A null here is a verification-integrity failure, ' +
          'not a Wave-0 skip.',
      );
    }

    const files = resolveSliderFiles();
    if (files == null) {
      // Legit Wave-0 fixture-absence skip (impossible at Phase 44 — 44-01
      // commits the rig + phase44-fixture-guard enforces existence).
      expect(true).toBe(true);
      return;
    }

    let json: unknown;
    let atlasText: string;
    try {
      json = JSON.parse(readFileSync(files.jsonPath, 'utf8'));
      atlasText = readFileSync(files.atlasPath, 'utf8');
    } catch (err) {
      if (isFileAbsent(err)) {
        expect(true).toBe(true);
        return;
      } // race: file vanished mid-scan → Wave-0
      throw err; // parse defect / runtime bug → PROPAGATE (never a silent skip)
    }

    // The smoke: parse through runtime-43 (mirrors buildLoad43's parse steps)
    // — MUST NOT throw. NO sampling, NO slider-peak math (Phase-46 scope
    // fence — see the header).
    const atlas = rt.makeAtlas(atlasText);
    const skeletonData = rt.parseSkeleton(json, atlas, /*atlasLess*/ false);
    rt.applyRotatedRegionFix(skeletonData);

    // Non-empty SkeletonData: the 4.3 slider rig declares ≥1 skin and ≥1
    // animation (the `scale`/`slide` timelines the slider drives). A parse
    // that silently produced an empty handle would be a degenerate pass.
    const skins = rt.skins(skeletonData);
    const animations = rt.animations(skeletonData);
    expect(
      skins.length,
      'SLIDER_4_3 parsed but produced 0 skins — a degenerate/empty parse, ' +
        'not a real load (the rig declares a `default` skin).',
    ).toBeGreaterThan(0);
    expect(
      animations.length,
      'SLIDER_4_3 parsed but produced 0 animations — a degenerate/empty ' +
        'parse (the rig declares `scale` + `slide` animations the slider ' +
        'constraint drives).',
    ).toBeGreaterThan(0);
  });
});

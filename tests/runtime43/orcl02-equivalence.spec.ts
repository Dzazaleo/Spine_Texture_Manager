// tests/runtime43/orcl02-equivalence.spec.ts
// Phase 44 Plan 04 Task 1 — ORCL-02: the cross-runtime equivalence HARD gate.
//
// ====================================================================
//  THIS IS A HARD PHASE-44 EXIT GATE (D-14). It CANNOT be waived.
// ====================================================================
//  • A *value* divergence is a hard expect-fail — NEVER `it.skipIf`-soft.
//    The ONLY sanctioned skip is genuine FIXTURE ABSENCE (built43/built42
//    == null — a Wave-0 safety net; D-01 + phase44-fixture-guard make
//    absence impossible at Phase 44).
//  • The phase CANNOT close on a trip. A trip is INVESTIGATED via the
//    embedded 4-cause diagnosis protocol, NOT waived.
//  • The 1e-4 tolerance is NOT a tunable escape hatch (the "tolerance
//    tunable once" option was explicitly REJECTED in D-14). Do NOT widen
//    it; do NOT narrow the comparison to globalPeaks-only.
//
// This spec GENERALIZES the ALREADY-green tests/runtime43/runtime43-d03.spec.ts
// (which compares ONLY SQUARE's globalPeaks peakScale within 1e-4) to the FULL
// SamplerOutput surface. It reuses runtime43-d03's exact driver helpers
// (buildLoad43 / buildLoadSibling42 / sample) — it is an ASSEMBLY of the
// proven harness, NOT a from-scratch oracle (RESEARCH "Don't Hand-Roll").
//
// D-12 — compare ALL THREE SamplerOutput maps (globalPeaks + perAnimation +
//   setupPosePeaks), every entry. This DELIBERATELY STRENGTHENS ROADMAP SC#4's
//   literal "globalPeaks within 1e-4". The strengthening is INTENTIONAL and
//   LOCKED — a downstream "correction" back to globalPeaks-only is a silent
//   descope (memory feedback_replan_can_silently_descope_roadmap_contract).
// D-13 — the HYBRID abs-OR-rel comparator (numpy isclose, atol=rtol=1e-4).
//   Absolute-only is REJECTED.
// D-14 — HARD gate (above); the 4-cause diagnosis protocol is embedded in the
//   failure message.
import { describe, expect, it } from 'vitest';
import { buildLoad43, buildLoadSibling42, sample } from './baseline-driver.js';
import { canonicalize } from '../safe01/canonical-json.js';

/** D-13 atol = rtol = 1e-4 (numpy isclose). DISTINCT from SAFE-02's strict
 *  byte-equal gate (Plan 03 owns that; untouched here). */
const ORCL02_TOL = 1e-4;

/**
 * D-13 HYBRID abs-OR-rel comparator (numpy isclose, atol=rtol=1e-4).
 *  - atol arm: |a-b| <= 1e-4 — saves tiny magnitudes from a spurious rel trip.
 *  - rtol arm: |a-b| / max(|a|,|b|) <= 1e-4 — saves large world-scale
 *    magnitudes from a spurious abs trip (the legit cross-engine float-noise
 *    absorber). Absolute-only is REJECTED (D-13).
 */
function close(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  if (diff <= ORCL02_TOL) return true; // atol arm — tiny magnitudes
  return diff / Math.max(Math.abs(a), Math.abs(b)) <= ORCL02_TOL; // rtol arm
}

/** The PeakRecord NUMERIC fields the D-13 close() iterates per record
 *  (src/core/types.ts:222-231). String/key fields (attachmentKey/skinName/
 *  slotName/attachmentName/regionName/animationName) compare via EXACT === ,
 *  NOT the tolerance comparator. */
const NUMERIC_FIELDS = [
  'peakScaleX',
  'peakScaleY',
  'peakScale',
  'worldW',
  'worldH',
  'sourceW',
  'sourceH',
] as const;

/** The three SamplerOutput maps D-12 compares (NOT globalPeaks alone). */
const MAP_NAMES = ['globalPeaks', 'perAnimation', 'setupPosePeaks'] as const;

interface Divergence {
  detail: string;
}

/**
 * Diff one canonicalized map across the two legs. Records:
 *  - KEY-SET divergence (a `${skin}/${slot}/${attachment}` key present in one
 *    leg's map but not the other) — itself a HARD FAILURE (the silent
 *    classify-as-skip class — the existential mode of Pitfall 2: a missing or
 *    extra record is exactly how a wrong-pose-undersize would hide).
 *  - per-shared-key field divergence: numeric fields via close(); string/key
 *    fields via exact !==.
 */
function diffMap(
  mapName: string,
  a43: Record<string, unknown>,
  a42: Record<string, unknown>,
  out: Divergence[],
): void {
  const k43 = new Set(Object.keys(a43));
  const k42 = new Set(Object.keys(a42));
  for (const k of k43) {
    if (!k42.has(k)) {
      out.push({
        detail: `${mapName}: key "${k}" present in the 4.3 leg but ABSENT in the 4.2 leg (key-set divergence — a missing/extra record is a HARD failure, the silent classify-as-skip class)`,
      });
    }
  }
  for (const k of k42) {
    if (!k43.has(k)) {
      out.push({
        detail: `${mapName}: key "${k}" present in the 4.2 leg but ABSENT in the 4.3 leg (key-set divergence — a missing/extra record is a HARD failure, the silent classify-as-skip class)`,
      });
    }
  }
  for (const k of k43) {
    if (!k42.has(k)) continue; // key-set divergence already recorded above
    const r43 = a43[k] as Record<string, unknown>;
    const r42 = a42[k] as Record<string, unknown>;
    if (
      r43 == null ||
      r42 == null ||
      typeof r43 !== 'object' ||
      typeof r42 !== 'object'
    ) {
      if (JSON.stringify(r43) !== JSON.stringify(r42)) {
        out.push({
          detail: `${mapName}["${k}"]: record shape mismatch (4.3=${JSON.stringify(
            r43,
          )} vs 4.2=${JSON.stringify(r42)})`,
        });
      }
      continue;
    }
    // Numeric fields → D-13 hybrid comparator. canonicalize() has already
    // replaced NaN/Infinity/-0 with distinct STRING sentinels, so a broken
    // pose read surfaces as a string!==number mismatch here, never a silent
    // numeric "equal".
    for (const f of NUMERIC_FIELDS) {
      const v43 = r43[f];
      const v42 = r42[f];
      if (typeof v43 === 'number' && typeof v42 === 'number') {
        if (!close(v43, v42)) {
          out.push({
            detail: `${mapName}["${k}"].${f}: 4.3=${v43} vs 4.2=${v42} diverges beyond the D-13 hybrid tolerance (atol|rtol ${ORCL02_TOL})`,
          });
        }
      } else if (v43 !== v42) {
        // A sentinelized non-finite/-0 (string) vs a finite number, or any
        // other shape mismatch on a numeric field — a HARD divergence
        // (canonicalize sentinels exist precisely so this is not silently
        // "equal").
        out.push({
          detail: `${mapName}["${k}"].${f}: 4.3=${JSON.stringify(
            v43,
          )} vs 4.2=${JSON.stringify(
            v42,
          )} — non-finite/shape divergence (canonicalize sentinel surfaced a broken pose read)`,
        });
      }
    }
    // String/key fields → EXACT equality (NOT the tolerance comparator).
    for (const f of Object.keys(r43)) {
      if ((NUMERIC_FIELDS as readonly string[]).includes(f)) continue;
      if (JSON.stringify(r43[f]) !== JSON.stringify(r42[f])) {
        out.push({
          detail: `${mapName}["${k}"].${f}: 4.3=${JSON.stringify(
            r43[f],
          )} vs 4.2=${JSON.stringify(r42[f])} — string/key field exact mismatch`,
        });
      }
    }
  }
}

describe('ORCL-02: cross-runtime equivalence — ALL THREE SamplerOutput maps (D-12/13/14 HARD gate)', () => {
  it('the 4.3 runtime and the byte-trusted 4.2 sibling agree on globalPeaks + perAnimation + setupPosePeaks within the D-13 hybrid tolerance', () => {
    const built43 = buildLoad43(); // 4.3 rig → runtime-43 (baseline-driver.ts:128)
    const built42 = buildLoadSibling42(); // skeleton2_42.json → runtime-42 (baseline-driver.ts:192) — the ORCL-02 4.2 leg
    if (built43 == null || built42 == null) {
      // D-14: the ONLY sanctioned skip — genuine FIXTURE ABSENCE. This is a
      // Wave-0 safety net; D-01 + phase44-fixture-guard make absence
      // impossible at Phase 44. It is NOT a value-mismatch escape hatch.
      expect(true).toBe(true);
      return;
    }

    const out43 = sample(built43.load); // SamplerOutput { globalPeaks, perAnimation, setupPosePeaks }
    const out42 = sample(built42.load);

    // D-13 NaN/-0 sentinel safety: canonicalize BOTH legs BEFORE the numeric
    // compare. A NaN/Infinity/-0 from a broken pose read becomes a distinct
    // string sentinel (canonical-json.ts:56-59) and can never slip through as
    // a silent numeric "equal".
    const c43 = JSON.parse(
      canonicalize(out43, { fixture: 'SIMPLE_PROJECT_43/skeleton2.json' }),
    ) as Record<string, Record<string, unknown>>;
    const c42 = JSON.parse(
      canonicalize(out42, { fixture: 'SIMPLE_PROJECT_43/skeleton2_42.json' }),
    ) as Record<string, Record<string, unknown>>;

    // D-12 — compare ALL THREE maps (globalPeaks + perAnimation +
    // setupPosePeaks), every entry. NOT globalPeaks-only (the locked
    // strengthening of ROADMAP SC#4).
    const divergences: Divergence[] = [];
    for (const mapName of MAP_NAMES) {
      diffMap(mapName, c43[mapName] ?? {}, c42[mapName] ?? {}, divergences);
    }

    // D-14 — HARD gate, no waiver. The 4-cause diagnosis protocol is embedded
    // in the failure message. The phase CANNOT close on a trip; the cause is
    // INVESTIGATED, not waived; tolerance is NOT a sanctioned escape hatch.
    expect(
      divergences.length,
      `ORCL-02 HARD GATE TRIPPED (D-14 — the phase CANNOT close on this; ` +
        `do NOT widen tolerance, do NOT narrow to globalPeaks-only). ` +
        `${divergences.length} cross-runtime divergence(s) across the 3 ` +
        `SamplerOutput maps:\n` +
        divergences.map((d) => `  • ${d.detail}`).join('\n') +
        `\n\nD-14 4-CAUSE DIAGNOSIS PROTOCOL — investigate, do NOT waive:\n` +
        `  (a) divergence concentrated on SQUARE / constrained slots, 4.3 ` +
        `systematically SMALLER → the 4.3 adapter is reading bone.pose, NOT ` +
        `bone.appliedPose: the EXISTENTIAL wrong-pose-undersize CANARY firing ` +
        `(Pitfall 2 existential mode — the TransformConstraint-on-SQUARE ` +
        `undersize-ships failure). FIX runtime-43's appliedPose read.\n` +
        `  (b) the 4.2 leg throws / produces 0 records → 4.2-sibling load ` +
        `failure: confirm skeleton2_42.json routes to runtime-42 via the D-07 ` +
        `suffix-tolerant version parse and the atlas parses (D-15 PASS — ` +
        `should NOT be the cause).\n` +
        `  (c) broad divergence across many UNconstrained attachments → the ` +
        `4.2/4.3 rigs are not equivalent (editor-downgrade artifact; ` +
        `LOW-prob — ORCL-01 is non-IK, spine-editor#891-immune): check the ` +
        `4.2/4.3 skeleton hashes match.\n` +
        `  (d) tiny uniform divergence just over 1e-4 at LARGE magnitudes ` +
        `only → cross-engine float noise: the D-13 rel arm is designed to ` +
        `absorb this; if it STILL trips it is NOT noise — investigate as ` +
        `(a)/(c). Do NOT widen tolerance (the "tolerance tunable once" option ` +
        `was explicitly REJECTED in D-14).`,
    ).toBe(0);

    // Defense-in-depth: a wholesale wrong-pose read could degenerate to empty
    // maps that would trivially "agree". Assert the oracle actually compared
    // real records (the 4.3 owner rig has a TransformConstraint-bearing SQUARE
    // — globalPeaks MUST be non-empty).
    expect(
      Object.keys(c43.globalPeaks ?? {}).length,
      'ORCL-02 sanity: the 4.3 globalPeaks map is empty — the oracle compared ' +
        'nothing (a degenerate wrong-pose read can produce empty maps that ' +
        'trivially "agree"). This is a HARD failure, not a pass.',
    ).toBeGreaterThan(0);
  });
});

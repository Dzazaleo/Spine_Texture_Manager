/**
 * Phase 42 Plan 01 — SAFE-01 Task 1: deterministic canonical-JSON serializer.
 *
 * Pure-Node TEST utility. Lives in `tests/safe01/`, NEVER in `src/core/`
 * (CLAUDE.md Fact #5 / RT-04 — `core/` stays pure; this serializer is a test
 * concern, not sampler math). It imports NOTHING from `src/core/**`, no
 * `sharp`, no `electron` — `node:`-builtins only (and it needs none).
 *
 * It freezes the full `SamplerOutput` (D-06: globalPeaks + perAnimation +
 * setupPosePeaks) into a byte-deterministic JSON string so a tripped SAFE-01
 * gate shows EXACTLY which `${skin}/${slot}/${attachment}` record drifted in
 * `git diff` (D-07 — diagnosability over compactness).
 *
 * Scheme is RESEARCH §"Canonical-JSON Serialization (D-07 — RESOLVED)" copied
 * verbatim (do not re-derive):
 *   1. Map → sorted-key plain object (entries sorted by key ascending).
 *   2. RECURSIVE key sort at EVERY depth (a shallow
 *      `JSON.stringify(v, Object.keys(v).sort())` sorts ONLY top-level keys —
 *      insufficient for nested PeakRecord; verified in RESEARCH §A bug).
 *   3. Explicit non-finite + signed-zero handling (the silent-corruption guard).
 *   4. `{ _meta, globalPeaks, perAnimation, setupPosePeaks }` with `_meta` FIRST.
 *
 * SILENT-CORRUPTION TRAP (same discipline as png-header.ts's endianness
 * comment): `JSON.stringify(NaN)` → `"null"`, `JSON.stringify(Infinity)` →
 * `"null"`, `JSON.stringify(-0)` → `"0"` — SILENTLY. A silent-undersize
 * regression that produced a non-finite or signed-zero peak would therefore
 * read as `null`/`0` ("no data" / a benign zero) and FALSE-PASS the exact
 * SAFE-01 gate this file exists to enforce. Distinct STRING sentinels
 * (`"NaN"`, `"Infinity"`, `"-Infinity"`, `"-0"`) make such a regression
 * unmissable in a `git diff`. Never emit null/0 for these cases.
 */

/** The three-map SamplerOutput shape, structurally typed (no core/ import). */
export interface CanonicalizableOutput {
  globalPeaks: Map<string, unknown>;
  perAnimation: Map<string, unknown>;
  setupPosePeaks: Map<string, unknown>;
}

/**
 * Recursively rebuild any value with:
 *  - Maps → sorted-key plain objects
 *  - plain objects → keys re-inserted in ascending sorted order at EVERY depth
 *  - non-finite numbers + signed zero → distinct string sentinels
 *  - finite numbers → clamped to 15 significant digits to neutralize
 *    last-bit float-string drift across the 3-OS / Node-minor matrix
 *    (15 sig-digits is below IEEE-754 double round-trip ambiguity of 17 yet
 *    far above the 1e-9 peak-latch epsilon and the 1e-3 user tolerance, so it
 *    cannot mask a meaningful regression while it does neutralize FP noise).
 */
function canon(value: unknown): unknown {
  if (typeof value === 'number') {
    // ORDER MATTERS: test -0 BEFORE the generic finite branch (Object.is is
    // the only check that distinguishes -0 from +0; `value === 0` is true for
    // both and `JSON.stringify(-0)` collapses the sign).
    if (Number.isNaN(value)) return 'NaN';
    if (value === Infinity) return 'Infinity';
    if (value === -Infinity) return '-Infinity';
    if (Object.is(value, -0)) return '-0';
    // Finite: clamp to 15 significant digits, then let JSON format it.
    return Number(value.toPrecision(15));
  }

  if (value instanceof Map) {
    const sortedKeys = [...value.keys()].sort();
    const obj: Record<string, unknown> = {};
    for (const k of sortedKeys) obj[k] = canon(value.get(k));
    return obj;
  }

  if (Array.isArray(value)) {
    return value.map((v) => canon(v));
  }

  if (value !== null && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const sortedKeys = Object.keys(src).sort();
    const obj: Record<string, unknown> = {};
    for (const k of sortedKeys) obj[k] = canon(src[k]);
    return obj;
  }

  // string | boolean | null | undefined — pass through unchanged.
  return value;
}

/**
 * Serialize a SamplerOutput-shaped object to the canonical SAFE-01 JSON form.
 *
 * @param out  the three SamplerOutput maps (structurally typed; no core import)
 * @param meta provenance block emitted FIRST as `_meta` (fixture path,
 *             generatedCommit, generatedAt, samplerHz, spineCoreVersion, schema)
 * @returns a byte-deterministic, recursively sorted-key JSON string with a
 *          trailing newline (the established repo baseline-file convention)
 */
export function canonicalize(
  out: CanonicalizableOutput,
  meta: Record<string, unknown>,
): string {
  const body = {
    _meta: canon(meta),
    globalPeaks: canon(out.globalPeaks),
    perAnimation: canon(out.perAnimation),
    setupPosePeaks: canon(out.setupPosePeaks),
  };
  return JSON.stringify(body, null, 2) + '\n';
}

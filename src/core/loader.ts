/**
 * Headless Spine 4.2 loader — parses a skeleton JSON + its sibling atlas
 * WITHOUT decoding any PNG bytes. The returned `LoadResult` is the single
 * input the Phase 0 sampler needs.
 *
 * Contract (locked in 00-CONTEXT.md — Loader Contract):
 *   1. If `skeletonPath` is not readable → throw `SkeletonJsonNotFoundError`.
 *   2. Otherwise, resolve atlas path:
 *        opts.atlasPath  ??  sibling `<basename>.atlas` next to the JSON.
 *   3. If that atlas file is not readable → throw `AtlasNotFoundError`.
 *   4. Parse the atlas text via `new TextureAtlas(atlasText)` and attach a
 *      stub `Texture` to each page (no pixel data loaded, no fs I/O inside
 *      the stub).
 *   5. Parse the skeleton JSON via `new SkeletonJson(new AtlasAttachmentLoader(atlas))`.
 *   6. Build a `sourceDims` map from atlas regions, preferring
 *      `originalWidth/originalHeight` (`atlas-orig`) and falling back to
 *      `width/height` (`atlas-bounds`) when the atlas has no `orig:` line.
 *
 * Notes:
 *   - This file uses `node:fs` ONLY at load time — sampler hot-loop code in
 *     plans 00-03..00-05 MUST NOT re-enter the loader. Requirement N2.3.
 *   - PNG bytes are never touched. Requirement F1.3.
 *   - Phase 43 (D-02, RT-02): this file no longer imports any spine-core
 *     package. The atlas/skeleton parse seam (TextureAtlas / SkeletonJson /
 *     AtlasAttachmentLoader + the Phase-33 rotated-region patch + the headless
 *     StubTexture) is relocated into `runtime-42.ts`; the loader obtains
 *     everything via the runtime adapter.
 *   - Phase 44 (DISP-01/02/03): the runtime is no longer hard-picked. The
 *     loader DISPATCHES via `resolveRuntimeTag` (token-primary D-06/07 +
 *     asymmetric contradiction D-08 + the split-out ≥4.4 reject arm D-09),
 *     routing a 4.2 JSON → runtime-42 and a 4.3 JSON → runtime-43, decided
 *     BEFORE atlas-resolve + rt.parseSkeleton. The loader stays
 *     spine-core-import-free (RT-02 preserved).
 *   - debug-fix spine-43-beta-appliedpose-null (2026-05-19): `resolveRuntimeTag`
 *     additionally rejects an in-band (4.2.x/4.3.x) PRE-RELEASE token
 *     (`-beta`/`-rc`/`-alpha`/etc. suffix on the leading semver) with the
 *     'prerelease' sentinel. A non-stable Spine editor build can emit a
 *     structurally-invalid rig (e.g. a root-targeting IK constraint whose
 *     chain root has no parent bone) that the SHIPPED spine-core stable
 *     runtime dereferences unconditionally (`IkConstraint.apply1`:
 *     `bone.bone.parent.appliedPose`) and throws on at the FIRST
 *     `updateWorldTransform` — surfacing as the opaque
 *     `Unknown: Cannot read properties of null (reading 'appliedPose')`
 *     toast. The pre-release token is the deterministic, cheap, honest
 *     signal for this class; we reject it at the single dispatch gate with
 *     an actionable re-export-from-stable message instead of letting the
 *     broken rig reach the sampler.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LoadResult, LoaderOptions, SourceDims } from './types.js';
import {
  AtlasNotFoundError,
  AtlasParseError,
  SkeletonJsonNotFoundError,
  SpineVersionUnsupportedError,
} from './errors.js';
import {
  synthesizeAtlasText,
  composeSequenceFramePath,
} from './synthetic-atlas.js';
import { readPngDims } from './png-header.js';
import { pickRuntime } from './runtime/runtime.js';
import type {
  OpaqueAtlas,
  OpaqueSkeletonData,
  RuntimeTag,
} from './runtime/types.js';

/**
 * Phase 43 (D-02): narrow structural view of the runtime's `OpaqueAtlas`
 * (a branded passthrough of the real spine-core `TextureAtlas`). The loader
 * still needs `atlas.regions`/`atlas.pages` for the sourceDims/atlasSources
 * builders (SAFE-02-gated — byte-unchanged), so it reads through this local
 * structural type instead of re-importing `TextureAtlas` (keeping loader.ts
 * spine-core-TYPE-free per the RT-02 arch anchor).
 */
interface AtlasRegionsView {
  regions: Array<{
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
    offsetX: number;
    offsetY: number;
    degrees: number;
    page: { name: string };
  }>;
}

/**
 * Phase 43 (D-02): narrow structural view of the runtime's `OpaqueSkeletonData`
 * for the loader's read of the editor-dopesheet `fps` field (display-only;
 * CLAUDE.md rule #1 forbids fps-driven sampling). Keeps loader.ts free of a
 * spine-core `SkeletonData` type import.
 */
interface SkeletonDataFpsView {
  fps: number;
}

/**
 * debug-fix spine-43-beta-appliedpose-null (2026-05-19) — pre-release-token
 * detector for the dispatch gate.
 *
 * Spine stamps stable editor exports with a plain `major.minor.patch` token
 * (`4.3.01`, `4.2.111`). Pre-release editor builds append a hyphenated
 * pre-release suffix per semver convention (`4.3.91-beta`, `4.2.0-rc.1`,
 * `4.3.0-alpha`). We only need to recognise the SHAPE: a hyphen after the
 * leading numeric core (the same core `^(\d+)\.(\d+)` the band classifier
 * already consumes), with at least one non-digit pre-release identifier
 * following. We must NOT match the legitimate editor token
 * `4.2-from-4.3.01` (the 4.3-editor re-export-as-4.2 marker, project memory
 * `project_spine_4_3_editor_atlas_format_editor_driven`) — that hyphen is
 * followed by `from-...`, NOT a semver pre-release identifier on the SAME
 * version core. The regex anchors the hyphen immediately after an OPTIONAL
 * `.patch`, so `4.2-from-4.3.01` (hyphen right after the minor, no patch,
 * suffix `from-4.3.01`) is still classified pre-release ONLY if the suffix
 * is a pre-release-style identifier — see the guard below which additionally
 * excludes the `from-` editor marker explicitly.
 *
 * Pure string inspection — no DOM/fs/Electron; RT-02 spine-core-import-free
 * invariant preserved.
 *
 * @param version the value of `skeleton.spine` (already known non-null and
 *   to have a parseable leading major.minor by the caller).
 * @returns true if `version` carries a semver pre-release suffix.
 */
export function isPrereleaseSpineToken(version: string): boolean {
  // Core: leading major.minor with an OPTIONAL .patch, then a hyphen, then a
  // pre-release identifier. `4.3.91-beta` → match; `4.2.0-rc.1` → match;
  // `4.3.01` → no match; `4.2.111` → no match.
  const m = version.match(/^\d+\.\d+(?:\.\d+)?-([0-9A-Za-z.-]+)$/);
  if (m === null) return false;
  const suffix = m[1];
  // The 4.3-editor "re-export as Version 4.2" marker is `4.2-from-4.3.01`
  // (project memory project_spine_4_3_editor_atlas_format_editor_driven) —
  // a SANCTIONED stable token, NOT a pre-release. Its suffix begins with
  // `from-`. Exclude it explicitly so a legitimate downgrade re-export is
  // never mis-rejected as a beta.
  if (suffix.startsWith('from-')) return false;
  return true;
}

/**
 * Phase 12 / Plan 05 (D-21) — F3 Spine version guard.
 *
 * Reject Spine JSON exported from versions < 4.2. CLAUDE.md documents
 * 4.2+ as the hard requirement; spine-core 4.2.x's SkeletonJson cannot
 * faithfully read 3.x bone-curve / attachment shapes, leading to silent
 * zero-output runs (Phase 11 §F3 reproduction in
 * `.planning/phases/11-…/11-WIN-FINDINGS.md`). The Optimize Assets path
 * reports success while producing zero usable images — F3 makes that
 * runtime-detectable with an actionable typed error.
 *
 * Phase 32 (D-01, COMPAT-01) — strict-cut at 4.3+. Reject `major.minor >= 4.3`
 * (and any `major >= 5`) so honest 4.3-beta exports surface the COMPAT-01
 * re-export-as-Version-4.2 message instead of falling through to spine-core's
 * SkeletonJson (which throws a misleading `IK Constraint not found:` because
 * 4.3 stores constraint definitions under `root.constraints[]`, not the four
 * legacy `root.ik`/`root.transform`/`root.path`/`root.physics` arrays).
 *
 * Pure string parsing + integer comparison — zero new boundary
 * crossings (Layer-3 invariant: core/ stays pure TS, no DOM/Electron/
 * node:fs additions beyond the existing readFileSync site).
 *
 * Exported so the predicate's seven decision cases can be unit-tested
 * independently of fixture loading
 * (tests/core/loader-version-guard-predicate.spec.ts).
 *
 * @param version  the value of `skeleton.spine` from the parsed JSON, or null if absent.
 * @param skeletonPath  the absolute path to the skeleton JSON (for the error envelope).
 * @throws SpineVersionUnsupportedError if version is null, malformed, major.minor < 4.2, OR major.minor >= 4.3 (Phase 32 strict-cut).
 */
export function checkSpineVersion(version: string | null, skeletonPath: string): void {
  if (version === null) {
    // Pre-3.7 had no `skeleton.spine` field. Treat as < 4.2 — reject.
    throw new SpineVersionUnsupportedError('unknown', skeletonPath);
  }
  const parts = version.split('.');
  const major = parseInt(parts[0] ?? '', 10);
  const minor = parseInt(parts[1] ?? '', 10);
  if (Number.isNaN(major) || Number.isNaN(minor)) {
    throw new SpineVersionUnsupportedError(version, skeletonPath);
  }
  if (major < 4 || (major === 4 && minor < 2)) {
    // Pre-4.2 branch — preserves Phase 12 F3 contract.
    throw new SpineVersionUnsupportedError(version, skeletonPath);
  }
  if (major >= 5 || (major === 4 && minor >= 3)) {
    // Phase 32 (D-01) — strict-cut at 4.3+. Pass the actual semver string as
    // detectedVersion so the constructor's 4.3+ branch fires (semver parse).
    throw new SpineVersionUnsupportedError(version, skeletonPath);
  }
  // Only 4.2.x passes.
}

/**
 * Phase 32 (D-02, COMPAT-01) — schema-based fallback to `checkSpineVersion`.
 *
 * Detects Spine 4.3 exports whose `skeleton.spine` field is missing or
 * malformed (so the semver predicate above slipped through) but whose
 * top-level `constraints` array is present — the actual breaking schema
 * marker. SEED-003 documents that 4.3 unified the four legacy
 * `root.ik`/`root.transform`/`root.path`/`root.physics` arrays into a
 * single `root.constraints[]` carrying a `type` discriminator.
 *
 * Per CONTEXT D-05 ("Recommendation: REJECT empty arrays — the field's
 * presence is the schema marker"), even an empty `constraints: []` array
 * triggers rejection: presence of the field at all is the 4.3-shape
 * signal we want to catch.
 *
 * Throws `SpineVersionUnsupportedError` with `detectedVersion = '4.3-schema'`
 * (sentinel string — the constructor branches on it to produce the
 * COMPAT-01 message).
 *
 * Pure object inspection — no DOM, no fs, no Electron imports
 * (Layer-3 invariant; CLAUDE.md fact #5).
 *
 * Exported so the predicate's decision cases can be unit-tested
 * independently of fixture loading
 * (tests/core/loader-43-schema-guard-predicate.spec.ts).
 *
 * @param parsedJson  the result of `JSON.parse(jsonText)`, typed `unknown`.
 * @param skeletonPath  the absolute path to the skeleton JSON (for the error envelope).
 * @throws SpineVersionUnsupportedError if parsedJson has a top-level `constraints` array.
 */
export function checkSpine43Schema(parsedJson: unknown, skeletonPath: string): void {
  if (parsedJson === null || typeof parsedJson !== 'object') {
    return;
  }
  if (!('constraints' in parsedJson)) {
    return;
  }
  const constraints = (parsedJson as Record<string, unknown>).constraints;
  if (!Array.isArray(constraints)) {
    return;
  }
  // Presence of the array (even empty) is the 4.3-shape signal — CONTEXT D-05.
  throw new SpineVersionUnsupportedError('4.3-schema', skeletonPath);
}

/**
 * Phase 44 (DISP-01/02/03, D-06/07/08/09) — the loader's version dispatcher.
 *
 * This is the SINGLE behavior flip that turns the loader from a 4.3-rejecter
 * into a dual-runtime dispatcher. It is a NEW pure exported function COMPOSED
 * FROM the two already-unit-tested primitives above (`checkSpineVersion`'s
 * version-band decision tree + `checkSpine43Schema`'s top-level-`constraints[]`
 * sniff) — repurposed in place, NOT rewritten. The two standalone predicates
 * keep their EXISTING throw behavior + their existing unit-test contract;
 * `resolveRuntimeTag` re-derives the band + sniff independently so that
 * coverage stays valid (a rewrite would discard 4 unit-test files).
 *
 * Decision logic:
 *
 *   D-06/D-07 TOKEN-PRIMARY band classification (suffix-tolerant):
 *     - version === null            → throw 'unknown'          (UNCHANGED — checkSpineVersion:113-115)
 *     - no parseable leading M.m    → throw <version>          (UNCHANGED — :120-122; D-07: only a token
 *                                                               with no parseable leading major.minor is malformed)
 *     - major<4 || (4 && minor<2)   → throw <version>          (UNCHANGED — Phase 12 F3; :123-125)
 *     - (4 && minor>=4) || major>=5 → throw <version>          (NEW D-09 ≥4.4 arm — Pitfall 2: SPLIT OUT of the
 *                                                               old bundled ≥4.3 throw, NOT folded/deleted)
 *     - in-band 4.2.x/4.3.x w/ a    → throw 'prerelease'       (debug-fix spine-43-beta-appliedpose-null,
 *       PRE-RELEASE suffix                                       2026-05-19 — see isPrereleaseSpineToken)
 *     - 4 && minor===2              → tentative tag '4.2'
 *     - 4 && minor===3              → tentative tag '4.3'       (was a throw at :127-130; now routes)
 *
 *   D-08 ASYMMETRIC POSITIVE-SHAPE contradiction cross-check (Pitfall 3 —
 *   positive-shape ONLY; never symmetric / absence-based):
 *     - tag==='4.2' ∧ hasTopLevelConstraintsArray → throw '4.3-schema'
 *         (preserves today's checkSpine43Schema reject for exactly this case;
 *          the '4.3-schema' sentinel is reused so errors.ts gives it the
 *          contradiction wording)
 *     - tag==='4.3' ∧ hasLegacyArrays             → throw <version>
 *         (a legacy-shape rig mis-stamped 4.3)
 *     - tag==='4.3' ∧ ¬constraints[] ∧ ¬legacy   → tag stays '4.3'
 *         (a constraint-less 4.3 rig is VALID; absence of constraints[] is
 *          NOT 4.2 evidence — Pitfall 3)
 *
 * The dispatch NEVER falls through to a default runtime on an unrecognized
 * token — every path either returns a validated '4.2'/'4.3' tag or throws a
 * typed `SpineVersionUnsupportedError` (T-44-03/04/05 mitigation; ASVS V5
 * narrow input validation). Pure string/object inspection — no DOM/fs/Electron;
 * the loader stays spine-core-import-free (Phase 43 RT-02).
 *
 * @param version      the value of `skeleton.spine`, or null if absent.
 * @param parsedJson   the once-parsed JSON.parse(jsonText) result (typed unknown).
 * @param skeletonPath the absolute path to the skeleton JSON (for the error envelope).
 * @returns the resolved `RuntimeTag` ('4.2' | '4.3') for `pickRuntime`.
 * @throws SpineVersionUnsupportedError on <4.2 / unknown / malformed / ≥4.4 / pre-release / contradiction.
 */
export function resolveRuntimeTag(
  version: string | null,
  parsedJson: unknown,
  skeletonPath: string,
): RuntimeTag {
  // D-06/D-07 band classification. version===null → 'unknown' (UNCHANGED —
  // checkSpineVersion:113-115).
  if (version === null) {
    throw new SpineVersionUnsupportedError('unknown', skeletonPath);
  }
  // D-07: the existing `version.split('.'); parseInt(...)` is ALREADY
  // suffix-tolerant (parseInt('2-from-4',10)===2 — parseInt stops at the
  // first non-digit). An explicit leading-`major.minor` regex is the
  // clarity-only equivalent (NOT a correctness change): "4.2-from-4.3.01"
  // → [4,2], "4.3.73-beta" → [4,3]. Only a token with NO parseable leading
  // major.minor at all is malformed.
  const m = version.match(/^(\d+)\.(\d+)/);
  if (m === null) {
    throw new SpineVersionUnsupportedError(version, skeletonPath);
  }
  const major = parseInt(m[1], 10);
  const minor = parseInt(m[2], 10);
  if (major < 4 || (major === 4 && minor < 2)) {
    // Pre-4.2 branch — preserves Phase 12 F3 contract (checkSpineVersion:123-125).
    throw new SpineVersionUnsupportedError(version, skeletonPath);
  }
  if ((major === 4 && minor >= 4) || major >= 5) {
    // NEW D-09 ≥4.4 arm (Pitfall 2 — the existential pitfall): this MUST be
    // split OUT of checkSpineVersion's old bundled ≥4.3 throw. Do NOT just
    // delete `minor>=3` and let 4.3 fall through unguarded; a hypothetical
    // ≥4.4 export must hit the typed rejecter, NOT the 4.3 runtime.
    throw new SpineVersionUnsupportedError(version, skeletonPath);
  }
  // debug-fix spine-43-beta-appliedpose-null (2026-05-19) — PRE-RELEASE arm.
  //
  // Only IN-BAND (4.2.x / 4.3.x) tokens reach this point (the <4.2 and ≥4.4
  // arms above already threw with the existing wording — DO NOT relocate
  // this above them; an out-of-band pre-release like `4.4.0-beta` must keep
  // its existing ≥4.4 "re-export as Version 4.3 (or 4.2)" message, not the
  // new pre-release one). A pre-release suffix on an otherwise-supported
  // 4.2.x/4.3.x core means the file came from a NON-STABLE Spine editor
  // build. The SHIPPED spine-core stable runtime trusts the rig shape
  // unconditionally in places (verified: spine-core@4.3.0
  // IkConstraint.apply1 does `bone.bone.parent.appliedPose` with a
  // documented `noNonNullAssertion: reference runtime` bypass); a beta
  // editor can author a structurally-invalid rig (the
  // fixtures/SPINE_4_3_TEST root-targeting parentless-IK case) that this
  // dereferences as `null.appliedPose` and throws on at the FIRST
  // `updateWorldTransform` in the sampler — swallowed by handleSkeletonLoad
  // into the opaque `Unknown: Cannot read properties of null (reading
  // 'appliedPose')` toast. Detect the pre-release token here — the cheap,
  // deterministic, honest signal — and surface an actionable
  // re-export-from-stable message instead of letting the broken rig reach
  // the sampler. 'prerelease' is a NEW sentinel handled by the
  // SpineVersionUnsupportedError constructor (errors.ts D-10 classification).
  if (isPrereleaseSpineToken(version)) {
    throw new SpineVersionUnsupportedError('prerelease:' + version, skeletonPath);
  }
  // Only 4.2.x and 4.3.x reach here (D-09 split).
  const tag: RuntimeTag = minor === 3 ? '4.3' : '4.2';

  // D-08 asymmetric positive-shape contradiction cross-check (Pitfall 3 —
  // positive-shape ONLY; do NOT use symmetric or absence-based logic).
  //
  // hasTopLevelConstraintsArray := the EXACT checkSpine43Schema-style sniff
  // (top-level only — matches that predicate's scope).
  const hasTopLevelConstraintsArray =
    parsedJson !== null &&
    typeof parsedJson === 'object' &&
    'constraints' in parsedJson &&
    Array.isArray((parsedJson as Record<string, unknown>).constraints);
  // hasLegacyArrays := any of the legacy top-level `ik`/`transform`/`path`
  // arrays (TOP-LEVEL root arrays ONLY — match checkSpine43Schema's
  // top-level-only scope; skin-scoped `skins[].ik` is IRRELEVANT, do NOT
  // recurse into skins).
  const hasLegacyArrays =
    parsedJson !== null &&
    typeof parsedJson === 'object' &&
    (Array.isArray((parsedJson as Record<string, unknown>).ik) ||
      Array.isArray((parsedJson as Record<string, unknown>).transform) ||
      Array.isArray((parsedJson as Record<string, unknown>).path));

  if (tag === '4.2' && hasTopLevelConstraintsArray) {
    // Preserves today's checkSpine43Schema reject for exactly this case. The
    // '4.3-schema' sentinel is reused so errors.ts (D-10) gives it the
    // contradiction wording (a 4.2-stamped-but-4.3-shaped reject).
    throw new SpineVersionUnsupportedError('4.3-schema', skeletonPath);
  }
  if (tag === '4.3' && hasLegacyArrays) {
    // A legacy-shape rig mis-stamped 4.3.
    throw new SpineVersionUnsupportedError(version, skeletonPath);
  }
  // tag==='4.3' ∧ ¬constraints[] ∧ ¬legacy → tag stays '4.3' (a
  // constraint-less 4.3 rig is VALID; absence of constraints[] is NOT 4.2
  // evidence — Pitfall 3).
  return tag;
}

/**
 * Load a Spine 4.2 skeleton JSON plus its atlas, headlessly.
 *
 * @param skeletonPath - Path (absolute or relative to `process.cwd()`) to the `.json` skeleton file.
 * @param opts         - Optional overrides (e.g. explicit atlas path).
 * @returns A fully-parsed `LoadResult` ready for the sampler.
 * @throws  `SkeletonJsonNotFoundError` if the skeleton file is unreadable.
 * @throws  `AtlasNotFoundError`        if the atlas companion is unreadable.
 * @throws  `AtlasParseError`           if atlas text is malformed.
 */
export function loadSkeleton(
  skeletonPath: string,
  opts: LoaderOptions = {},
): LoadResult {
  // 1. Read skeleton JSON
  let jsonText: string;
  try {
    jsonText = fs.readFileSync(skeletonPath, 'utf8');
  } catch {
    throw new SkeletonJsonNotFoundError(skeletonPath);
  }

  // Phase 12/32/44 — F3 Spine version guard, now expressed as the SINGLE
  // dispatch gate (DISP-01/02/03, D-06/07/08/09).
  //
  // Inspect skeleton.spine BEFORE atlas resolution so 3.x/≥4.4/malformed rigs
  // fail fast with an actionable typed error instead of falling through to
  // spine-core's SkeletonJson (which silently produces zero-output runs at
  // the sampler stage — the F3 reproduction in
  // `.planning/phases/11-…/11-WIN-FINDINGS.md`), AND so a 4.3 rig ROUTES to
  // runtime-43 instead of being hard-rejected (the Phase-44 flip).
  //
  // Phase 44 (DISP-01/02/03) integration correctness: the loader's gate is
  // `resolveRuntimeTag` itself — NOT a separate unconditional
  // `checkSpineVersion`/`checkSpine43Schema` pre-call. `resolveRuntimeTag`
  // re-derives the FULL checkSpineVersion band tree (null→throw 'unknown',
  // no parseable leading major.minor→throw, <4.2→throw [Phase 12 F3
  // preserved], ≥4.4/≥5→throw [D-09 NEW arm]) AND subsumes the only
  // reachable checkSpine43Schema reject via its D-08 asymmetric
  // contradiction cross-check (tag==='4.2' ∧ top-level constraints[] → throw
  // '4.3-schema'; tag==='4.3' ∧ legacy top-level ik/transform/path → throw).
  // Calling the standalone `checkSpineVersion`/`checkSpine43Schema`
  // UNCONDITIONALLY here as well would re-introduce the pre-flip 4.3
  // hard-reject (checkSpineVersion still throws on `major===4 && minor>=3`
  // by design — its standalone unit-test contract is preserved) and make
  // the dispatch flip dead code for every 4.3 input. So the loader call
  // site defers entirely to `resolveRuntimeTag`; the standalone predicates
  // remain EXPORTED + byte-unchanged for their own unit tests
  // (tests/core/loader-version-guard-predicate.spec.ts /
  // loader-43-schema-guard-predicate.spec.ts) — they are simply no longer
  // *called* unconditionally from loadSkeleton. RT-02 spine-core-import-free
  // invariant preserved (resolveRuntimeTag is pure string/object inspection).
  //
  // JSON.parse is hoisted out of the readSkeletonData call below so the
  // version check + readSkeletonData(parsedJson) share one parse — no
  // double-parse penalty. parsedJson is typed `unknown` and narrowed step
  // by step before reading the version field; spine-core's
  // readSkeletonData accepts unknown-shaped input (it does its own
  // structural read). DISP-03 ("decide before runtime load") is structurally
  // free: the dispatch is computed here, BEFORE atlas-resolve +
  // rt.parseSkeleton. The parse seam (atlas/skeleton/rotated-region patch) is
  // delegated to the resolved runtime via rt.makeAtlas / rt.parseSkeleton /
  // rt.applyRotatedRegionFix.
  const parsedJson: unknown = JSON.parse(jsonText);
  let spineFieldForDispatch: string | null = null;
  if (
    parsedJson !== null &&
    typeof parsedJson === 'object' &&
    'skeleton' in parsedJson
  ) {
    const skelForDispatch = (parsedJson as Record<string, unknown>).skeleton;
    if (
      skelForDispatch !== null &&
      typeof skelForDispatch === 'object' &&
      'spine' in (skelForDispatch as object)
    ) {
      const sf = (skelForDispatch as Record<string, unknown>).spine;
      spineFieldForDispatch = typeof sf === 'string' ? sf : null;
    }
  }
  // The SINGLE gate + dispatch. resolveRuntimeTag throws the typed
  // SpineVersionUnsupportedError for null / malformed / <4.2 / ≥4.4 /
  // pre-release / contradiction (every pre-flip throw-case preserved) and
  // otherwise returns the validated '4.2'|'4.3' tag — it NEVER falls through
  // to a default runtime (T-44-03/04/05 mitigation).
  const rt = pickRuntime(resolveRuntimeTag(spineFieldForDispatch, parsedJson, skeletonPath));

  // Phase 22 DIMS-01 — walk parsedJson.skins[*].attachments to harvest
  // canonical width/height per region. Pattern verbatim from
  // synthetic-atlas.ts:walkSyntheticRegionPaths (Phase 21) — same skin/
  // slot/entry iteration, same type filter (region | mesh | linkedmesh),
  // same `att.path ?? entryName` keying. Only difference: harvest
  // att.width + att.height per visited entry. Last-write-wins on duplicate
  // region across skins (canonical dims are a property of the source PNG,
  // NOT the skin variant).
  //
  // R5 linkedmesh fallback: when att.width === 0 || att.height === 0
  // (linkedmesh inheriting from a parent without explicit dims, or
  // malformed JSON), skip the entry. Analyzer's CLI fallback
  // (canonicalW = p.sourceW) covers downstream. Backlog v1.3:
  // "linkedmesh canonical-dims fallback via parent mesh resolution."
  const canonicalDimsByRegion = new Map<
    string,
    { canonicalW: number; canonicalH: number }
  >();
  {
    const root = parsedJson as {
      skins?: Array<{
        attachments?: Record<
          string,
          Record<
            string,
            {
              type?: string;
              name?: string;
              path?: string;
              width?: number;
              height?: number;
              // debug-fix sequence-peak-atlas-vs-less (2026-05-08): sequence-
              // bearing attachments collapse N frames under one basePath in JSON;
              // canonicalDimsByRegion must be fanned to per-frame keys to match
              // the sampler/analyzer lookup shape (regionName = per-frame path
              // after the sequence fan-out at sampler.ts:407-564).
              sequence?: { count?: number; start?: number; digits?: number };
            }
          >
        >;
      }>;
    };
    for (const skin of root.skins ?? []) {
      for (const slotName in skin.attachments) {
        const slot = skin.attachments![slotName];
        for (const entryName in slot) {
          const att = slot[entryName];
          const type = att.type ?? 'region'; //                  SkeletonJson.js:366 default
          if (type !== 'region' && type !== 'mesh' && type !== 'linkedmesh')
            continue;
          // SkeletonJson.js:365 + 368: resolvedPath = att.path ?? att.name ?? entryName.
          const basePath = att.path ?? att.name ?? entryName;
          const w = att.width ?? 0;
          const h = att.height ?? 0;
          if (w === 0 || h === 0) {
            // R5 — linkedmesh-without-explicit-dims (rare; no in-repo
            // fixture exercises this). Skip; analyzer's CLI fallback
            // (canonicalW = p.sourceW) covers downstream.
            if (process.env.NODE_ENV !== 'production') {
              console.warn(
                `Phase 22 DIMS-01: attachment '${basePath}' (type=${type}) has no explicit width/height in JSON; canonical-dims fallback to peakRecord.sourceW.`,
              );
            }
            continue;
          }
          // Sequence-aware expansion (debug-fix sequence-peak-atlas-vs-less,
          // 2026-05-08): mirror walkSyntheticRegionPaths and the sampler's
          // sequence fan-out — a single mesh attachment whose JSON declares
          // `sequence: { count, start, digits }` represents N atlas regions
          // named `<basePath><start+i, zero-padded>`, all sharing the same
          // canonical width/height from the JSON. Without this fan-out the
          // analyzer's `canonicalDims.get(perFrameRegion)` returns undefined,
          // toDisplayRow falls back to canonicalW = p.sourceW (the on-disk
          // PNG dim), and the post-export round-trip displays as 0.978× green
          // instead of 1.000× yellow because dimsMismatch evaluates false.
          // Non-sequence attachments fall through unchanged.
          if (att.sequence !== undefined && att.sequence !== null) {
            const count = att.sequence.count ?? 0;
            const start = att.sequence.start ?? 1; // SkeletonJson.js:478
            const digits = att.sequence.digits ?? 0; // SkeletonJson.js:479
            if (count > 0) {
              for (let i = 0; i < count; i++) {
                const perFramePath = composeSequenceFramePath(basePath, i, start, digits);
                canonicalDimsByRegion.set(perFramePath, {
                  canonicalW: w,
                  canonicalH: h,
                });
              }
              continue;
            }
            // Defensive: count=0 — fall through to single-key registration
            // below (matches walkSyntheticRegionPaths).
          }
          canonicalDimsByRegion.set(basePath, {
            canonicalW: w,
            canonicalH: h,
          });
        }
      }
    }
  }

  // 2. Resolve atlas — Phase 21 (LOAD-01) introduces a 4-way branch
  //    per CONTEXT.md D-05/D-06/D-07/D-08 + RESEARCH.md §Pitfall 9.
  //
  //    Branch order is load-bearing — DO NOT reorder:
  //      1. opts.atlasPath !== undefined → canonical (D-06: throw
  //         AtlasNotFoundError verbatim on read fail; NO fall-through)
  //      2. opts.loaderMode === 'atlas-less' → synthesize (D-08:
  //         skip .atlas read entirely, even if file exists)
  //      3. sibling .atlas readable → canonical (D-07: atlas-by-default)
  //      4. sibling .atlas unreadable → synthesize (D-05: fall-through)
  //
  //    `resolvedAtlasPath` is the value returned in LoadResult.atlasPath
  //    (D-03: nullable). `isAtlasLess` flags downstream branches that
  //    populate sourceDims/sourcePaths/atlasSources from synthesizer
  //    output instead of atlas.regions.
  const siblingAtlasPath = path.join(
    path.dirname(skeletonPath),
    path.basename(skeletonPath, path.extname(skeletonPath)) + '.atlas',
  );

  // Inline the canonical-load + synthesize-now bodies in each of the four
  // branches. Each branch assigns `atlas`, `resolvedAtlasPath`, `isAtlasLess`,
  // and (for synthesis branches) `synthSourcePaths`/`synthDims` directly,
  // so TypeScript's flow analysis can prove every variable is initialized
  // before use below.
  // Phase 43 (D-02): `atlas` is now an OpaqueAtlas handle from the runtime
  // adapter (a branded passthrough of the real TextureAtlas — the brand is a
  // compile-time phantom; `brandHandle` returns the same object with `__rt`
  // attached non-enumerably, so the structural `.regions`/`.pages` reads in the
  // sourceDims/atlasSources builders below still work at runtime). A narrow
  // local structural type (`AtlasRegionsView`) is used at those read sites so
  // loader.ts stays spine-core-TYPE-free without re-importing TextureAtlas.
  let atlas: OpaqueAtlas;
  let resolvedAtlasPath: string | null;
  let isAtlasLess: boolean;
  let synthSourcePaths: Map<string, string> | null = null;
  let synthDims: Map<string, { w: number; h: number }> | null = null;
  // Phase 21 Plan 21-09 G-01 — names of regions whose PNG was missing in
  // atlas-less mode. The synthesizer emitted a 1x1 stub region for each so
  // spine-core can resolve the attachment without crashing; this list
  // flows into LoadResult.skippedAttachments below for renderer surfacing.
  let synthMissingPngs: string[] | null = null;

  if (opts.atlasPath !== undefined) {
    // D-06: explicit user-provided atlasPath — try to read; throw verbatim
    // AtlasNotFoundError on fail. NO fall-through to synthesis.
    const explicitAtlasPath = opts.atlasPath;
    let atlasText: string;
    try {
      atlasText = fs.readFileSync(explicitAtlasPath, 'utf8');
    } catch {
      // D-06 — ROADMAP success criterion #5: verbatim AtlasNotFoundError.
      throw new AtlasNotFoundError(explicitAtlasPath, skeletonPath);
    }
    try {
      atlas = rt.makeAtlas(atlasText);
    } catch (cause) {
      throw new AtlasParseError(explicitAtlasPath, cause);
    }
    resolvedAtlasPath = path.resolve(explicitAtlasPath);
    isAtlasLess = false;
  } else if (opts.loaderMode === 'atlas-less') {
    // D-08: per-project override forces atlas-less even if .atlas exists.
    const dirOfImages = path.join(path.dirname(skeletonPath), 'images');
    const synth = synthesizeAtlasText(parsedJson, dirOfImages, skeletonPath);
    atlas = rt.makeAtlas(synth.atlasText);
    synthSourcePaths = synth.pngPathsByRegionName;
    synthDims = synth.dimsByRegionName;
    synthMissingPngs = synth.missingPngs; //                                Plan 21-09 G-01
    resolvedAtlasPath = null;
    isAtlasLess = true;
  } else {
    // D-05/D-07 fall-through path: try sibling .atlas first.
    //
    // Note on the double-read of sibling.atlas: the probe below reads the
    // file, and the canonical-mode read in the if-branch below reads it
    // again. The double read is intentional — it keeps the canonical
    // path's error-handling intact (probe failure → fall-through;
    // canonical-load failure → AtlasParseError). The 144-byte
    // SIMPLE_TEST.atlas read takes <1ms; not a perf concern.
    // (T-21-06-02 — accepted per threat register.)
    let siblingReadable = false;
    try {
      fs.readFileSync(siblingAtlasPath, 'utf8'); //                       probe
      siblingReadable = true;
    } catch {
      siblingReadable = false;
    }
    if (siblingReadable) {
      // D-07 — atlas-by-default. Re-read for the actual canonical load.
      let atlasText: string;
      try {
        atlasText = fs.readFileSync(siblingAtlasPath, 'utf8');
      } catch {
        // Probe succeeded but the second read failed (race or transient
        // FS error). Throw verbatim AtlasNotFoundError — same shape as
        // D-06.
        throw new AtlasNotFoundError(siblingAtlasPath, skeletonPath);
      }
      try {
        atlas = rt.makeAtlas(atlasText);
      } catch (cause) {
        throw new AtlasParseError(siblingAtlasPath, cause);
      }
      resolvedAtlasPath = path.resolve(siblingAtlasPath);
      isAtlasLess = false;
    } else {
      // D-05 — synthesize fall-through, BUT only if a sibling images/
      // folder is present. If neither sibling .atlas NOR images/ exists,
      // this is a malformed-project case (the historical signal): throw
      // AtlasNotFoundError verbatim to preserve ROADMAP success
      // criterion #5 (the legacy "no atlas, no images" contract). This
      // also keeps the pre-Phase-21 AtlasNotFoundError tests in
      // tests/core/loader.spec.ts F1.4 green — the JSON-only tmpdir
      // construction those tests use has no images/ folder either.
      const probeImagesDir = path.join(path.dirname(skeletonPath), 'images');
      let imagesDirExists = false;
      try {
        const stat = fs.statSync(probeImagesDir);
        imagesDirExists = stat.isDirectory();
      } catch {
        imagesDirExists = false;
      }
      if (!imagesDirExists) {
        // D-08 (line ~305) intercepts loaderMode:'atlas-less' before this
        // D-05 fall-through is reached; loaderMode is 'auto' here by
        // construction. No atlas AND no images/ → legacy malformed case.
        throw new AtlasNotFoundError(siblingAtlasPath, skeletonPath);
      }
      const synth = synthesizeAtlasText(
        parsedJson,
        probeImagesDir,
        skeletonPath,
      );
      atlas = rt.makeAtlas(synth.atlasText);
      synthSourcePaths = synth.pngPathsByRegionName;
      synthDims = synth.dimsByRegionName;
      synthMissingPngs = synth.missingPngs; //                              Plan 21-09 G-01
      resolvedAtlasPath = null;
      isAtlasLess = true;
    }
  }

  // 5. Parse skeleton via the runtime adapter (Phase 43 D-02 — the
  //    SkeletonJson / AtlasAttachmentLoader / SilentSkipAttachmentLoader
  //    construction is relocated VERBATIM into runtime-42.parseSkeleton).
  //    `parsedJson` is the once-parsed object (hoisted above for the Phase 12
  //    F3 version guard); the adapter passes it straight to
  //    SkeletonJson.readSkeletonData so spine-core does not re-parse. The
  //    atlas-less SilentSkipAttachmentLoader branch (D-09 + RESEARCH.md
  //    §Pitfall 1) lives inside the adapter, selected by the `isAtlasLess`
  //    flag.
  // Phase 43 (D-02): structural views of the opaque handles for the loader's
  // own `.regions`/`.pages`/`.fps` reads below (the OpaqueAtlas is the same
  // object the adapter constructed — `brandHandle` attaches `__rt`
  // non-enumerably and returns it unchanged; these casts are compile-time
  // narrowing only, no spine-core type import).
  const atlasView = atlas! as unknown as AtlasRegionsView;

  const skeletonData: OpaqueSkeletonData = rt.parseSkeleton(
    parsedJson,
    atlas,
    isAtlasLess,
  );

  // Phase 33 — D-01: per-RegionAttachment offset override for rotated regions.
  // Phase 43 (D-02): the verbatim Phase-33 SWAP-form offset[] write is
  // relocated into runtime-42.applyRotatedRegionFix. The `!isAtlasLess` gate
  // stays loader-side to preserve the EXACT original guard (atlas-less mode
  // never has rotated regions — memory: project_strict_loadermode_separation).
  // SAFE-02 byte-gates this path via the frozen `spine_rotated` baseline.
  if (!isAtlasLess) {
    rt.applyRotatedRegionFix(skeletonData);
  }

  // 6. Build sourceDims map.
  //    Canonical mode: from atlas.regions (D-15 — source='atlas-orig' if
  //    region.originalWidth/Height differ from packed bounds; else
  //    'atlas-bounds').
  //    Atlas-less mode: from synthDims (D-15 — source='png-header').
  //
  //    spine-core 4.2 auto-backfills `originalWidth/Height` from packed
  //    `width/height` when the atlas has no `orig:` / `offsets:` line
  //    (TextureAtlas.js lines 152–155 in the installed version). So
  //    `region.originalWidth > 0` is always true after parsing and cannot
  //    distinguish an atlas-supplied `orig` from a bounds-fallback.
  //
  //    Best available signal: compare originals to packed dims. If they
  //    differ, the atlas whitespace-stripped and supplied real source dims —
  //    tag 'atlas-orig'. If they're equal, either the atlas shipped an
  //    identity `orig:` line (rare) or spine-core backfilled from bounds;
  //    in both cases the number we return IS the packed W×H, so 'atlas-bounds'
  //    is the honest label.
  const sourceDims = new Map<string, SourceDims>();
  if (isAtlasLess && synthDims) {
    for (const [name, dims] of synthDims) {
      sourceDims.set(name, { w: dims.w, h: dims.h, source: 'png-header' });
    }
  } else {
    for (const region of atlasView.regions) {
      const packedW = region.width;
      const packedH = region.height;
      const origW = region.originalWidth;
      const origH = region.originalHeight;
      const hasExplicitOrig = origW !== packedW || origH !== packedH;
      sourceDims.set(region.name, {
        w: origW,
        h: origH,
        source: hasExplicitOrig ? 'atlas-orig' : 'atlas-bounds',
      });
    }
  }

  // 7. Build sourcePaths map (D-108 + RESEARCH §Pattern 2).
  //    Atlas-less mode: directly from synthSourcePaths (already absolute,
  //    one entry per synthesized region per D-16).
  //    Atlas-source mode (G-01 D-01, Phase 22.1): sourcePaths is populated from
  //    imagesDir + regionName (same path shape as before) so export.ts can build
  //    output paths and the image-worker can find per-region PNGs when they exist.
  //    PNG IHDR reads do NOT happen in atlas-source mode — actualDimsByRegion
  //    (below) derives dims from atlas.region.originalWidth/Height, and the
  //    PNG-read loop is mode-gated to isAtlasLess only. This preserves the G-01
  //    fix (no stale images/ dims) while restoring optimizer functionality.
  //
  // Path-only — no fs.access (Phase 6 image-worker pre-flights). Region names
  // may contain '/' (e.g. 'AVATAR/FACE'); the resulting path keeps the
  // subfolder structure intact for F8.3.
  // path.resolve(...) wraps path.join(...) so values are absolute regardless
  // of whether `skeletonPath` was provided as relative or absolute (mirrors
  // the `path.resolve(skeletonPath)` used for the returned skeletonPath).
  const imagesDir = path.join(path.dirname(skeletonPath), 'images');
  const sourcePaths = new Map<string, string>();
  if (isAtlasLess && synthSourcePaths) {
    for (const [name, p] of synthSourcePaths) {
      sourcePaths.set(name, p);
    }
  } else if (!isAtlasLess) {
    // Atlas-source mode: populate sourcePaths from imagesDir + regionName so the
    // export system can compute output paths (relativeOutPath in export.ts) and the
    // image-worker can find per-region PNGs when they exist on disk. PNG IHDR reads
    // do NOT happen here — actualDimsByRegion (below) is mode-gated to atlas-less
    // only, so re-adding sourcePaths carries no risk of re-enabling stale PNG reads.
    // The image-worker already falls back to atlasSource extraction when the file is
    // absent (image-worker.ts:148-162).
    for (const region of atlasView.regions) {
      sourcePaths.set(
        region.name,
        path.resolve(path.join(imagesDir, region.name + '.png')),
      );
    }
  }

  // Phase 22 DIMS-01 + Phase 22.1 G-01 D-01 — actual source dimensions per region.
  //
  // Strict mode separation (debug-fix windows-source-mode-auto-detect, 2026-05-06):
  // each loaderMode is self-contained. The previous "scale-display-optimized-source"
  // fix had atlas-source mode peek into the sibling images/ folder for PNG IHDR
  // overrides; that cross-mode bleed is removed here. To use pre-optimized images
  // as the source of truth, toggle to atlas-less mode (atlas-less ignores .atlas;
  // atlas-source ignores images/).
  //
  // Atlas-less mode (isAtlasLess): read PNG IHDR dims from sourcePaths entries.
  //   Reuses Phase 21's readPngDims (Layer 3-clean byte parser; no decode).
  //   Per-region try/catch keeps a missing/unreadable PNG from breaking the
  //   load — actualDimsByRegion entry stays absent (dimsMismatch evaluates false).
  //   Layer-3 invariant honored: readPngDims is IHDR-only byte parsing — no
  //   zlib/IDAT decoding. CLAUDE.md fact #4 ("the math phase does not decode
  //   PNGs") preserved. PNG reads happen during loadSkeleton() only — never in
  //   the sampler hot loop (CLAUDE.md fact #3 boundary).
  //
  // Atlas-source mode (!isAtlasLess): derive actualSource from atlas.region.originalWidth/
  //   Height only (spine-core 4.2 auto-backfills from packed dims when no `orig:` line
  //   is present). No PNG IHDR reads, no images/ folder peek.
  const actualDimsByRegion = new Map<
    string,
    { actualSourceW: number; actualSourceH: number }
  >();
  if (isAtlasLess) {
    // Atlas-less: read PNG IHDR bytes (Phase 22 behavior preserved verbatim).
    for (const [regionName, pngPath] of sourcePaths) {
      try {
        const dims = readPngDims(pngPath);
        actualDimsByRegion.set(regionName, {
          actualSourceW: dims.width,
          actualSourceH: dims.height,
        });
      } catch {
        // Per-region PNG missing or unreadable — entry stays absent.
      }
    }
  } else {
    // Atlas-source: atlas is authoritative. region.originalWidth/Height only.
    for (const region of atlasView.regions) {
      actualDimsByRegion.set(region.name, {
        actualSourceW: region.originalWidth,
        actualSourceH: region.originalHeight,
      });
    }
  }

  // 8. Build atlasSources map.
  //    Canonical mode: pagePath under atlasDir; (x, y, packW, packH) is the
  //    actual pixel rect inside the page PNG (sharp.extract args); (w, h) is
  //    the orig canvas dim (canonical/JSON math); (offsetX, offsetY) is the
  //    libgdx bottom-left offset of the trimmed rect inside the orig canvas.
  //    For Strip-Whitespace-disabled regions packW/H == w/h and offsets are 0.
  //    For Strip-Whitespace-enabled regions packW/H < w/h and offsets > 0.
  //    Atlas-less mode (D-17): pagePath = per-region PNG, x=0, y=0,
  //    packW/H=w/h=PNG header dims, offsets=0, rotated=false. The atlas-
  //    extract path at image-worker.ts never fires in atlas-less mode (every
  //    region has a sourcePaths entry by D-09 filter), so this map is a
  //    metadata-coherence step.
  //
  // For rotated regions (region.degrees !== 0): the packed bounds W/H are
  // swapped vs the orig dims (libgdx packer convention). We store packW/H as
  // the actual page-PNG rect (which is what sharp.extract needs) and w/h as
  // orig. Phase 33 removed the load-time rotation refusal; downstream
  // consumers (bounds.ts AABB + image-worker sharp.rotate) handle the
  // swap explicitly using the `rotated` flag.
  //
  // 2026-05-08 fix (debug session export-extract-area-bad-area): added
  // packW/packH/offsetX/offsetY so consumers can extract the trimmed rect
  // from the page PNG and (if needed) extend it back to the orig canvas.
  // Previously the map only carried orig dims under w/h and consumers
  // crashed when they tried to extract those out-of-bounds dims from a
  // Strip-Whitespace-trimmed page PNG.
  const atlasSources = new Map<string, {
    pagePath: string;
    x: number;
    y: number;
    packW: number;
    packH: number;
    offsetX: number;
    offsetY: number;
    w: number;
    h: number;
    rotated: boolean;
  }>();
  if (isAtlasLess && synthSourcePaths && synthDims) {
    for (const [name, dims] of synthDims) {
      atlasSources.set(name, {
        pagePath: synthSourcePaths.get(name)!,
        x: 0,
        y: 0,
        packW: dims.w,
        packH: dims.h,
        offsetX: 0,
        offsetY: 0,
        w: dims.w,
        h: dims.h,
        rotated: false,
      });
    }
  } else {
    // Canonical mode: resolvedAtlasPath is non-null (set by loadCanonical).
    const atlasDir = path.dirname(resolvedAtlasPath!);
    for (const region of atlasView.regions) {
      const rotated = region.degrees !== 0;
      // Phase 33 UAT fix — packW/packH MUST be the actual page-pixel rect
      // dims (sharp.extract args). libgdx atlas convention: `bounds:x,y,W,H`
      // stores W/H in CANONICAL (pre-rotation) orientation; for rotated
      // regions the page-pixel rect has (height × width) extent — confirmed
      // by spine-core TextureAtlas.js:164-167 (u2/v2 derived from
      // region.height for horizontal span and region.width for vertical span
      // when degrees==90). Swap for rotated regions so image-worker /
      // atlas-preview extract the right slice.
      const packW = rotated ? region.height : region.width;
      const packH = rotated ? region.width : region.height;
      atlasSources.set(region.name, {
        pagePath: path.resolve(path.join(atlasDir, region.page.name)),
        x: region.x,
        y: region.y,
        packW,
        packH,
        offsetX: region.offsetX,
        offsetY: region.offsetY,
        w: region.originalWidth,
        h: region.originalHeight,
        rotated,
      });
    }
  }

  // Editor dopesheet FPS for DISPLAY purposes (CLI Frame column). spine-core
  // only populates `skeletonData.fps` when the JSON has a top-level `fps`
  // field (SkeletonJson.js:73). Spine's editor default is 30 — fall back to
  // that silently when the field is absent. NOT used for sampling rate
  // (CLAUDE.md rule #1 forbids fps-driven sampling).
  const editorFps = (skeletonData as unknown as SkeletonDataFpsView).fps || 30;

  // Phase 21 Plan 21-09 G-01 — surface attachments whose PNGs were missing in
  // atlas-less mode. Each missingPngs entry from the synthesizer is
  // `<regionName>.png`; map back to { name: <regionName>, expectedPngPath:
  // <imagesDir>/<filename> }. Field is OPTIONAL (matches unusedAttachments?:
  // precedent on SkeletonSummary): we leave it absent when there's nothing
  // to surface (canonical mode, or atlas-less mode with all PNGs present).
  // The synthesizer emitted a 1x1 stub region for each entry so spine-core's
  // animation parser resolved them without null-deref crashes; the renderer
  // (Plan 21-10 MissingAttachmentsPanel) hides them from the main panels and
  // surfaces them here for explicit user visibility.
  //
  // Uses imagesDir (declared above for canonical sourcePaths construction;
  // both atlas-less branches compute the same path.dirname(skeletonPath) +
  // '/images' value; canonical mode never has missingPngs entries to surface).
  const skippedAttachments: { name: string; expectedPngPath: string }[] | undefined =
    isAtlasLess && synthMissingPngs !== null && synthMissingPngs.length > 0
      ? synthMissingPngs.map((filename) => ({
          name: filename.endsWith('.png') ? filename.slice(0, -4) : filename,
          expectedPngPath: path.resolve(path.join(imagesDir, filename)),
        }))
      : undefined;

  return {
    skeletonPath: path.resolve(skeletonPath),
    atlasPath: resolvedAtlasPath, //                                      D-03: string | null
    // Phase 43 (D-02): `skeletonData`/`atlas` are OpaqueSkeletonData/OpaqueAtlas
    // handles from the runtime adapter — the SAME runtime objects the adapter
    // constructed (brandHandle attaches `__rt` non-enumerably and returns the
    // object unchanged). LoadResult's spine-core-typed fields are intentionally
    // NOT reshaped this phase (PATTERNS § types.ts; the Phase-44/45-owned
    // main/summary.ts still constructs `new Skeleton(load.skeletonData)`
    // directly). The cast through `unknown` is the single boundary
    // reconciliation at the loader return — the runtime identity stays threaded
    // via the populated `runtime` field below.
    skeletonData: skeletonData as unknown as LoadResult['skeletonData'],
    atlas: atlas! as unknown as LoadResult['atlas'],
    // Phase 43 (D-02, RT-02): the hard-picked 4.2 runtime adapter. Consumed by
    // sampler.ts/bounds.ts via `load.runtime.*` (no spine-core import there).
    runtime: rt,
    sourceDims,
    sourcePaths,
    atlasSources,
    editorFps,
    // Phase 22 DIMS-01 — populated by the parsedJson skin walk (above,
    // immediately after the version guard) and the per-region readPngDims
    // loop (above, immediately after sourcePaths is built). canonicalDimsByRegion
    // is keyed by region name (att.path ?? entryName) and carries
    // canonicalW/canonicalH from the JSON `width`/`height` fields per D-01.
    // actualDimsByRegion is keyed identically and carries actualSourceW/
    // actualSourceH from PNG IHDR bytes — empty for atlas-extract path
    // projects (Jokerman-style atlas-only) where per-region PNGs are absent.
    // Analyzer + summary.ts thread BOTH maps through to DisplayRow with a
    // 1px-tolerance dimsMismatch predicate (Plan 22-01 contract).
    canonicalDimsByRegion,
    actualDimsByRegion,
    ...(skippedAttachments !== undefined ? { skippedAttachments } : {}), // Plan 21-09 G-01 (optional)
  };
}

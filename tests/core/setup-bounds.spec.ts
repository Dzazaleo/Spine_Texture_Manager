// @vitest-environment node
/**
 * Phase 50 Plan 01 — V1-V5 for `computeSetupPoseBounds` (SCALEUI-02).
 *
 * `src/core/setup-bounds.ts` computes the rig's overall setup-pose bounding box
 * (W×H px) as the ALL-SKINS MANIFEST UNION at setup-pose bone transforms — every
 * skin's manifest, NOT just the live setup-pose slot bindings (D-06), measured via
 * the dual-runtime adapter (`load.runtime.makeSkeleton`, D-07), never reading the
 * untrusted editor `skeleton.width/height` header (D-05). A degenerate rig (zero
 * textured attachments) returns `null` — never a non-finite `-Infinity` sentinel
 * (T-50-FIN / RESEARCH Pitfall 1) — so the value never breaks structuredClone
 * across IPC.
 *
 * Real `LoadResult`s are built headlessly via `loadSkeleton(path)` (the
 * variant-dropin-faithful.spec.ts:139-142 pattern): this binds `load.runtime`
 * through `pickRuntime` (REG-47-01-safe) and exercises the real 4.2 + 4.3 adapters
 * under the vitest setupFile resolver — no co-import of sc42/sc43 needed. The
 * editor `skeleton.width/height` header is read ONLY in V3/V4 as a cross-check
 * oracle (D-08), never fed into the computed value.
 *
 * The Layer-3 invariant is preserved: setup-bounds.ts lives in src/core/, no
 * DOM/Electron/sharp/node:fs (tests/arch.spec.ts V7 enforces this).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { computeSetupPoseBounds } from '../../src/core/setup-bounds.js';
import type { LoadResult } from '../../src/core/types.js';
import type { SpineRuntime } from '../../src/core/runtime/runtime.js';
import type {
  OpaqueSkeleton,
  OpaqueSlot,
  OpaqueAttachment,
  OpaqueSkin,
} from '../../src/core/runtime/types.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SIMPLE_TEST = path.resolve(REPO_ROOT, 'fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const SKELETON2_43 = path.resolve(REPO_ROOT, 'fixtures/SIMPLE_PROJECT_43/skeleton2.json');

/** Read the editor header (D-08 cross-check ONLY — never the source of the
 *  computed bbox). Loud-fail if the committed fixture is absent (D-06a #3 — no
 *  silent skip green-wash, mirror variant-dropin-faithful.spec.ts:35-37). */
function editorHeader(jsonPath: string): { w: number; h: number } {
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`fixture not found: ${jsonPath}`);
  }
  const skel = (JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as {
    skeleton?: { width?: number; height?: number };
  }).skeleton;
  return { w: skel?.width ?? NaN, h: skel?.height ?? NaN };
}

describe('computeSetupPoseBounds (SCALEUI-02) — all-skins setup-pose union, dual-runtime', () => {
  // V1 — finite {w,h} for a 4.2 rig (all-skins union via load.runtime).
  it('V1: returns a finite {w,h} for a 4.2 rig (SIMPLE_TEST)', () => {
    expect(fs.existsSync(SIMPLE_TEST), `fixture not found: ${SIMPLE_TEST}`).toBe(true);
    const bbox = computeSetupPoseBounds(loadSkeleton(SIMPLE_TEST));
    expect(bbox, '4.2 rig should produce a finite bbox, not null').not.toBeNull();
    expect(Number.isFinite(bbox!.w)).toBe(true);
    expect(Number.isFinite(bbox!.h)).toBe(true);
    expect(bbox!.w).toBeGreaterThan(0);
    expect(bbox!.h).toBeGreaterThan(0);
  });

  // V2 — finite {w,h} for a 4.3 rig; the call MUST NOT throw (no `reading 'r'`
  // / signature-divergence crash — T-50-RT). Exercises the 4.3 adapter.
  it('V2: returns a finite {w,h} for a 4.3 rig (skeleton2) with no cross-runtime crash', () => {
    expect(fs.existsSync(SKELETON2_43), `fixture not found: ${SKELETON2_43}`).toBe(true);
    let bbox: { w: number; h: number } | null = null;
    expect(() => {
      bbox = computeSetupPoseBounds(loadSkeleton(SKELETON2_43));
    }, 'the 4.3 path must not throw (T-50-RT)').not.toThrow();
    expect(bbox, '4.3 rig should produce a finite bbox, not null').not.toBeNull();
    expect(Number.isFinite(bbox!.w)).toBe(true);
    expect(Number.isFinite(bbox!.h)).toBe(true);
    expect(bbox!.w).toBeGreaterThan(0);
    expect(bbox!.h).toBeGreaterThan(0);
  });

  // V3 — cross-check oracle (D-08): on SIMPLE_TEST (4.2, single-skin,
  // fully-visible) the computed union ≈ the editor header within ~1% relative
  // tolerance. Research measured 2190×1847 (union) vs 2190×1847 (editor), Δ0.0%.
  it('V3: cross-check vs editor header on SIMPLE_TEST within ~1% (D-08 oracle)', () => {
    const bbox = computeSetupPoseBounds(loadSkeleton(SIMPLE_TEST));
    expect(bbox).not.toBeNull();
    const { w: editorW, h: editorH } = editorHeader(SIMPLE_TEST);
    expect(Number.isFinite(editorW) && Number.isFinite(editorH)).toBe(true);
    expect(
      Math.abs(bbox!.w - editorW) / editorW,
      `union w=${bbox!.w} vs editor w=${editorW} should be within 1%`,
    ).toBeLessThan(0.01);
    expect(
      Math.abs(bbox!.h - editorH) / editorH,
      `union h=${bbox!.h} vs editor h=${editorH} should be within 1%`,
    ).toBeLessThan(0.01);
  });

  // V4 — all-skins envelope (D-06 tradeoff): on skeleton2 (4.3, multi-skin) the
  // union is finite AND >= the editor setup-visible subset (our_union >=
  // editor_subset; research measured +19.3% wide / exact tall). NOT exact
  // equality (Pitfall 3 — the editor header is only the setup-pose-visible subset).
  it('V4: all-skins envelope >= editor subset on skeleton2 (D-06, not exact)', () => {
    const bbox = computeSetupPoseBounds(loadSkeleton(SKELETON2_43));
    expect(bbox).not.toBeNull();
    expect(Number.isFinite(bbox!.w) && Number.isFinite(bbox!.h)).toBe(true);
    const { w: editorW, h: editorH } = editorHeader(SKELETON2_43);
    expect(Number.isFinite(editorW) && Number.isFinite(editorH)).toBe(true);
    // small float slack so an exact-equal axis is not a flake; the all-skins
    // union can only meet-or-exceed the setup-visible subset (D-06).
    expect(bbox!.w, `union w=${bbox!.w} should be >= editor w=${editorW}`).toBeGreaterThanOrEqual(editorW * 0.999);
    expect(bbox!.h, `union h=${bbox!.h} should be >= editor h=${editorH}`).toBeGreaterThanOrEqual(editorH * 0.999);
  });

  // V5 — degenerate (T-50-FIN): a rig whose only attachments are non-textured
  // (bounding-box → attachmentWorldAABB returns null / skip-list) yields ZERO
  // measured attachments. The contract is `null`, NOT `{w:-Infinity, h:-Infinity}`:
  // the Infinity sentinels never moved, and pushing a non-finite value across IPC
  // breaks the SkeletonSummary structuredClone contract (Pitfall 1). Built in-test
  // via a minimal stub runtime (no new fixture dir — bbox math reads no PNG bytes,
  // so a stub adapter fully exercises the union loop + degenerate guard).
  it('V5: degenerate rig (zero textured attachments) returns null, not -Infinity', () => {
    const SK = {} as OpaqueSkeleton;
    const BBOX_ATT = { __kind: 'skip' } as unknown as OpaqueAttachment;
    const ONLY_SKIN = {} as OpaqueSkin;
    const SLOT0 = {} as OpaqueSlot;

    // Minimal SpineRuntime exercising ONLY the methods computeSetupPoseBounds
    // touches: makeSkeleton/setupPoseSlots/setupPose/updateWorldTransform/slots/
    // skins/skinEntries + the attachmentKind discriminant attachmentWorldAABB
    // reads. The single skin's single entry is a bounding-box attachment, so
    // attachmentWorldAABB returns null (skip-list) → measured stays 0 → null.
    const stubRt = {
      tag: '4.2',
      makeSkeleton: () => SK,
      setupPoseSlots: () => {},
      setupPose: () => {},
      updateWorldTransform: () => {},
      slots: () => [SLOT0] as OpaqueSlot[],
      skins: () => [ONLY_SKIN] as OpaqueSkin[],
      skinEntries: () => [{ slotIndex: 0, name: 'BBOX', attachment: BBOX_ATT }],
      attachmentKind: (a: OpaqueAttachment) =>
        a === BBOX_ATT ? ('skip' as const) : ('region' as const),
    } as unknown as SpineRuntime;

    const degenerateLoad = {
      skeletonData: {} as unknown as LoadResult['skeletonData'],
      runtime: stubRt,
    } as unknown as LoadResult;

    const bbox = computeSetupPoseBounds(degenerateLoad);
    expect(bbox, 'degenerate rig must return null (T-50-FIN), never a non-finite bbox').toBeNull();
  });
});

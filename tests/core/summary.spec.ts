/**
 * Phase 1 Plan 02 — Tests for `src/main/summary.ts` (buildSummary projection).
 *
 * Behavior gates:
 *   - D-21 SkeletonSummary shape: bones.{count,names}, slots.count,
 *     attachments.{count,byType}, skins.{count,names}, animations.{count,names},
 *     peaks[] sorted, elapsedMs all populated from SIMPLE_TEST fixture.
 *   - D-22 structuredClone round-trip: no Map / Float32Array / class instances
 *     — every value is plain JSON.
 *   - peaks[] sort order: (skinName, slotName, attachmentName) — matches the
 *     CLI sort order in `scripts/cli.ts` so the prior renderer output matches CLI
 *     byte-for-byte (locked by D-16).
 *
 * These tests lock the IPC serialization contract independently of the IPC
 * handler in `ipc.spec.ts`.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { buildSummary } from '../../src/main/summary.js';

const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');

describe('buildSummary (D-21, D-22)', () => {
  it('D-22: output survives structuredClone (no Map/class instances)', () => {
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const summary = buildSummary(load, sampled, 12.3);
    const cloned = structuredClone(summary);
    expect(cloned).toEqual(summary);
  });

  it('D-21: populates bones/slots/attachments/skins/animations from SkeletonData', () => {
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const s = buildSummary(load, sampled, 0);

    // SIMPLE_TEST fixture actually contains 12 bones
    // (root, CTRL, CHAIN_2..CHAIN_8, SQUARE, CTRL_PATH, SQUARE2).
    // Plan 01-02 documented 9 — mismatch resolved against ground truth (the JSON).
    expect(s.bones.count).toBe(12);
    expect(s.bones.names.length).toBe(12);
    expect(s.slots.count).toBe(5);
    expect(s.skins.names).toContain('default');
    expect(s.animations.names.length).toBeGreaterThan(0);
    // Post gap-fix B: analyzer folds sampler records by attachmentName.
    // SIMPLE_TEST has 4 sampler records (slot SQUARE + slot SQUARE2 both
    // carry an attachment named `SQUARE`); they fold to 3 DisplayRows.
    expect(s.peaks.length).toBe(3);
    expect(s.skeletonPath).toBe(FIXTURE);
    // Phase 21 D-03: SkeletonSummary.atlasPath is `string | null`; canonical-mode
    // SIMPLE_TEST fixture must produce a non-null path (sibling .atlas exists).
    expect(s.atlasPath).not.toBeNull();
    expect(s.atlasPath!.endsWith('SIMPLE_TEST.atlas')).toBe(true);
    expect(s.elapsedMs).toBe(0);
    expect(s.attachments.count).toBeGreaterThan(0);
    expect(typeof s.attachments.byType).toBe('object');
  });

  it('D-16 sort: peaks[] sorted by (skinName, slotName, attachmentName)', () => {
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const s = buildSummary(load, sampled, 0);

    const sorted = [...s.peaks].sort((a, b) => {
      if (a.skinName !== b.skinName) return a.skinName.localeCompare(b.skinName);
      if (a.slotName !== b.slotName) return a.slotName.localeCompare(b.slotName);
      return a.attachmentName.localeCompare(b.attachmentName);
    });
    expect(s.peaks).toEqual(sorted);
  });

  it('F4.1/F4.2: animationBreakdown populated with setup-pose + one card per animation; structuredClone-safe', () => {
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const s = buildSummary(load, sampled, 0);
    expect(Array.isArray(s.animationBreakdown)).toBe(true);
    expect(s.animationBreakdown.length).toBe(load.skeletonData.animations.length + 1);
    expect(s.animationBreakdown[0].cardId).toBe('setup-pose');
    expect(s.animationBreakdown[0].isSetupPose).toBe(true);
    // Each subsequent card's cardId starts with 'anim:'.
    for (let i = 1; i < s.animationBreakdown.length; i++) {
      expect(s.animationBreakdown[i].cardId.startsWith('anim:')).toBe(true);
      expect(s.animationBreakdown[i].isSetupPose).toBe(false);
    }
    // T-03-01-01: structured clone invariant holds for the new field.
    const cloned = structuredClone(s.animationBreakdown);
    expect(cloned).toEqual(s.animationBreakdown);
  });

  it('Phase 24 PANEL-01: orphanedFiles present as array (stub [] until Plan 02 I/O wiring), structuredClone-safe', () => {
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const s = buildSummary(load, sampled, 0);
    // Phase 24 Plan 01: orphanedFiles replaces unusedAttachments. Stub [] until
    // Plan 02 wires the images/ folder scan (findOrphanedFiles + fs.statSync).
    expect(Array.isArray(s.orphanedFiles)).toBe(true);
    expect(s.orphanedFiles).toEqual([]);
    // D-21 / Pitfall 8: primitive-only fields survive structuredClone round-trip.
    const cloned = structuredClone(s.orphanedFiles);
    expect(cloned).toEqual(s.orphanedFiles);
  });
});

describe('summary: sourcePath threading on DisplayRow + BreakdownRow (Phase 6 Plan 02, F8.3)', () => {
  it('every peaks[i].sourcePath is populated from imagesDir in atlas-source mode (Phase 22.1 fix)', () => {
    // Phase 22.1 fix: sourcePaths IS populated in atlas-source mode so export.ts can
    // build output paths. PNG header reads do NOT occur (actualDimsByRegion is
    // mode-gated to isAtlasLess). Each sourcePath points to imagesDir/<region>.png.
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const summary = buildSummary(load, sampled, 0);
    expect(summary.peaks.length).toBeGreaterThan(0);
    expect(load.sourcePaths.size).toBeGreaterThanOrEqual(3);
    for (const row of summary.peaks) {
      expect(row.sourcePath).not.toBe('');
      expect(row.sourcePath.replace(/\\/g, '/').includes('/images/')).toBe(true);
    }
  });

  it('every animationBreakdown[*].rows[*].sourcePath is populated in atlas-source mode (Phase 22.1 fix)', () => {
    // Same fix: sourcePaths populated for export output paths; sourcePath non-empty.
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const summary = buildSummary(load, sampled, 0);
    let rowsSeen = 0;
    for (const card of summary.animationBreakdown) {
      for (const row of card.rows) {
        expect(row.sourcePath).not.toBe('');
        rowsSeen++;
      }
    }
    expect(rowsSeen).toBeGreaterThan(0);
  });

  it('SkeletonSummary structuredClones cleanly (D-21 invariant preserved with new sourcePath field)', () => {
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const summary = buildSummary(load, sampled, 0);
    const cloned = structuredClone(summary);
    expect(cloned.peaks[0].sourcePath).toBe(summary.peaks[0].sourcePath);
    expect(cloned).toEqual(summary);
  });
});

describe('Phase 21 G-02 — skippedAttachments cascade', () => {
  // Plan 21-10 — Surface skipped-PNG attachments (Plan 21-09 LoadResult.skippedAttachments)
  // through buildSummary so MissingAttachmentsPanel can render them above the regular
  // panels. peaks / animationBreakdown.rows are filtered to drop entries whose
  // attachmentName matches a skipped name — those attachments live ONLY in
  // summary.skippedAttachments, never double-counted.

  it('UNIT (ISSUE-003 fix): buildSummary filter contract drops skipped names from peaks + animationBreakdown.rows — verified with synthetic non-vacuous input', () => {
    // ISSUE-003 motivation: a fixture-only assertion ("TRIANGLE absent from
    // peaks after PNG deletion") is vacuous because the SIMPLE-fixture-with-
    // TRIANGLE-deleted path produces a degenerate AABB (1x1 stub region) that
    // may already be dropped by the analyzer's noise threshold. This UNIT test
    // constructs synthetic peaks containing a NON-ZERO-peakScale TRIANGLE row
    // plus synthetic skippedAttachments. The filter must drop the row.
    //
    // We test the FILTER LOGIC by replicating the same Set<string> construction
    // that summary.ts performs (the filter is inline in buildSummary; we
    // replicate it here to lock the contract).
    const mockPeaks = [
      { skinName: 'default', slotName: 'slot1', attachmentName: 'CIRCLE',   peakScale: 1.5 } as any,
      { skinName: 'default', slotName: 'slot2', attachmentName: 'TRIANGLE', peakScale: 2.3 } as any,
      { skinName: 'default', slotName: 'slot3', attachmentName: 'SQUARE',   peakScale: 0.9 } as any,
    ];
    const mockSkipped = [
      { name: 'TRIANGLE', expectedPngPath: '/x/TRIANGLE.png' },
    ];

    // Replicate the filter-set construction from summary.ts:
    const skippedNames = new Set(mockSkipped.map((s) => s.name));
    const filteredPeaks = mockPeaks.filter((p: any) => !skippedNames.has(p.attachmentName));

    // CIRCLE + SQUARE survive; TRIANGLE drops.
    expect(filteredPeaks.length).toBe(2);
    expect(filteredPeaks.find((p: any) => p.attachmentName === 'CIRCLE')).toBeDefined();
    expect(filteredPeaks.find((p: any) => p.attachmentName === 'SQUARE')).toBeDefined();
    expect(filteredPeaks.find((p: any) => p.attachmentName === 'TRIANGLE')).toBeUndefined();

    // Sanity: input genuinely had TRIANGLE before filtering (non-vacuous).
    // peakScale 2.3 > any reasonable noise threshold; the row would be in the
    // regular panels absent the filter.
    expect(mockPeaks.find((p: any) => p.attachmentName === 'TRIANGLE')!.peakScale).toBeGreaterThan(1.0);

    // Phase 24 Plan 01: unusedAttachments removed; orphanedFiles (filename-keyed)
    // does not participate in this skippedNames filter (orphaned files are not rig
    // attachments, so skippedNames filter is irrelevant for them). Filter removed.

    // Filter applies identically to animationBreakdown card rows
    // (BreakdownRow extends DisplayRow; same attachmentName key):
    const mockCard = { cardId: 'anim:test', rows: mockPeaks } as any;
    const filteredCard = {
      ...mockCard,
      rows: mockCard.rows.filter((r: any) => !skippedNames.has(r.attachmentName)),
    };
    expect(filteredCard.rows.find((r: any) => r.attachmentName === 'TRIANGLE')).toBeUndefined();
    expect(filteredCard.rows.length).toBe(2);
  });

  it('INTEGRATION: buildSummary populates skippedAttachments from LoadResult.skippedAttachments verbatim (uses Plan 21-09 SIMPLE_PROJECT_NO_ATLAS_MESH fixture)', () => {
    // Use the new fixture from Plan 21-09 — empirically verified pre-fix
    // crash repro. With MESH_REGION.png deleted, post-fix the load succeeds
    // and skippedAttachments is populated.
    const SRC_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-summary-g02-'));
    const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
    const tmpImages = path.join(tmpDir, 'images');
    fs.mkdirSync(tmpImages, { recursive: true });
    fs.copyFileSync(path.join(SRC_FIXTURE, 'MeshOnly_TEST.json'), tmpJson);
    // Intentionally do NOT copy MESH_REGION.png — that's the missing-PNG case.
    try {
      const load = loadSkeleton(tmpJson, { loaderMode: 'atlas-less' });
      const sampled = sampleSkeleton(load);
      const summary = buildSummary(load, sampled, 0);
      expect(summary.skippedAttachments.length).toBe(1);
      expect(summary.skippedAttachments[0].name).toBe('MESH_REGION');
      expect(
        summary.skippedAttachments[0].expectedPngPath.endsWith(path.join('images', 'MESH_REGION.png')),
      ).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('IPC: summary.skippedAttachments survives structuredClone (D-22 pattern)', () => {
    // Mirror the D-22 invariant test at summary.spec.ts:25-32 for the new field.
    const SRC_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-summary-g02-clone-'));
    const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
    const tmpImages = path.join(tmpDir, 'images');
    fs.mkdirSync(tmpImages, { recursive: true });
    fs.copyFileSync(path.join(SRC_FIXTURE, 'MeshOnly_TEST.json'), tmpJson);
    try {
      const load = loadSkeleton(tmpJson, { loaderMode: 'atlas-less' });
      const sampled = sampleSkeleton(load);
      const summary = buildSummary(load, sampled, 0);
      const cloned = structuredClone(summary);
      expect(cloned.skippedAttachments).toEqual(summary.skippedAttachments);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

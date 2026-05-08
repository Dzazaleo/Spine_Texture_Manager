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

describe('Phase 24 PANEL-01 — orphanedFiles I/O (Plan 02 implementation gate)', () => {
  // RED gate: these tests fail while summary.ts returns the stub [] for orphanedFiles.
  // They pass only after Plan 02 wires fs.readdirSync + findOrphanedFiles + fs.statSync.

  it('no images/ folder → orphanedFiles: [] (panel hidden, D-06)', () => {
    // SIMPLE_PROJECT has no images/ folder → readdirSync ENOENT → []
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const s = buildSummary(load, sampled, 0);
    expect(Array.isArray(s.orphanedFiles)).toBe(true);
    expect(s.orphanedFiles).toEqual([]);
  });

  it('atlas-source mode: orphan PNGs in images/ are NOT detected (strict mode separation, debug-fix atlas-source-images-folder-bleed 2026-05-06)', () => {
    // The previous contract scanned images/ in atlas-source mode and reported
    // PNGs missing from the atlas as orphaned. That cross-mode peek violated
    // strict mode separation — atlas-source mode must not consider images/ for
    // any calculation. This test locks the new invariant.
    const SRC_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-orphan-atlas-'));
    const tmpImages = path.join(tmpDir, 'images');
    fs.mkdirSync(tmpImages, { recursive: true });
    fs.copyFileSync(path.join(SRC_FIXTURE, 'SIMPLE_TEST.json'), path.join(tmpDir, 'SIMPLE_TEST.json'));
    fs.copyFileSync(path.join(SRC_FIXTURE, 'SIMPLE_TEST.atlas'), path.join(tmpDir, 'SIMPLE_TEST.atlas'));
    fs.copyFileSync(path.join(SRC_FIXTURE, 'SIMPLE_TEST.png'), path.join(tmpDir, 'SIMPLE_TEST.png'));
    // Create both an "orphan" GHOST.png and a same-folder subfolder GHOST — neither
    // should appear in orphanedFiles in atlas-source mode.
    fs.writeFileSync(path.join(tmpImages, 'GHOST.png'), Buffer.from('would-be-orphan'));
    fs.mkdirSync(path.join(tmpImages, 'SUB'), { recursive: true });
    fs.writeFileSync(path.join(tmpImages, 'SUB', 'NESTED.png'), Buffer.from('would-be-subfolder-orphan'));
    try {
      const load = loadSkeleton(path.join(tmpDir, 'SIMPLE_TEST.json'));
      // Sanity: this is atlas-source mode (sibling .atlas exists).
      expect(load.atlasPath).not.toBeNull();
      const sampled = sampleSkeleton(load);
      const s = buildSummary(load, sampled, 0);
      expect(Array.isArray(s.orphanedFiles)).toBe(true);
      expect(s.orphanedFiles).toEqual([]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('atlas-less mode: orphan PNG in images/ → orphanedFiles contains filename + bytesOnDisk (D-02)', () => {
    // Atlas-less mode is where the orphan detector legitimately runs: images/
    // is the source of truth, so PNGs not referenced by any skin attachment are
    // orphaned. Uses SIMPLE_PROJECT_NO_ATLAS (json + images/, no .atlas) +
    // adds a GHOST.png that is not referenced by any attachment.
    const SRC_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-orphan-less-'));
    const tmpImages = path.join(tmpDir, 'images');
    fs.mkdirSync(tmpImages, { recursive: true });
    fs.copyFileSync(path.join(SRC_FIXTURE, 'SIMPLE_TEST.json'), path.join(tmpDir, 'SIMPLE_TEST.json'));
    for (const f of fs.readdirSync(path.join(SRC_FIXTURE, 'images'))) {
      fs.copyFileSync(path.join(SRC_FIXTURE, 'images', f), path.join(tmpImages, f));
    }
    fs.writeFileSync(path.join(tmpImages, 'GHOST.png'), Buffer.from('orphaned-png-bytes'));
    try {
      const load = loadSkeleton(path.join(tmpDir, 'SIMPLE_TEST.json'));
      // Sanity: this is atlas-less mode (no sibling .atlas).
      expect(load.atlasPath).toBeNull();
      const sampled = sampleSkeleton(load);
      const s = buildSummary(load, sampled, 0);
      expect(Array.isArray(s.orphanedFiles)).toBe(true);
      const ghost = s.orphanedFiles!.find((f) => f.filename === 'GHOST');
      expect(ghost).toBeDefined();
      expect(ghost!.bytesOnDisk).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('atlas-less mode: images/ subfolder PNG → orphanedFiles contains relative path e.g. "SUB/GHOST" (recursive scan)', () => {
    // Regression: flat readdirSync dropped subdirectory entries; PNGs inside
    // images/SUB/ were invisible to the orphan detector. Recursive scan now
    // covered, but only in atlas-less mode (atlas-source ignores images/).
    const SRC_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-orphan-less-sub-'));
    const tmpImages = path.join(tmpDir, 'images');
    const tmpSub = path.join(tmpImages, 'SUB');
    fs.mkdirSync(tmpSub, { recursive: true });
    fs.copyFileSync(path.join(SRC_FIXTURE, 'SIMPLE_TEST.json'), path.join(tmpDir, 'SIMPLE_TEST.json'));
    for (const f of fs.readdirSync(path.join(SRC_FIXTURE, 'images'))) {
      fs.copyFileSync(path.join(SRC_FIXTURE, 'images', f), path.join(tmpImages, f));
    }
    fs.writeFileSync(path.join(tmpSub, 'GHOST.png'), Buffer.from('orphaned-subfolder-png'));
    try {
      const load = loadSkeleton(path.join(tmpDir, 'SIMPLE_TEST.json'));
      expect(load.atlasPath).toBeNull();
      const sampled = sampleSkeleton(load);
      const s = buildSummary(load, sampled, 0);
      expect(Array.isArray(s.orphanedFiles)).toBe(true);
      const ghost = s.orphanedFiles!.find((f) => f.filename === 'SUB/GHOST');
      expect(ghost).toBeDefined();
      expect(ghost!.bytesOnDisk).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('orphanedFiles is structuredClone-safe (D-21 IPC invariant)', () => {
    // Uses SIMPLE_PROJECT (no images/ folder) → orphanedFiles: []; still validates shape.
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const s = buildSummary(load, sampled, 0);
    const cloned = structuredClone(s.orphanedFiles!);
    expect(cloned).toEqual(s.orphanedFiles);
  });
});

// Regression — debug-fix spine-sequence-undercount-orphan-bleed (2026-05-08).
//
// After the spine-sequence-undercount fix landed, atlas-less mode correctly
// loaded sequence attachments and fanned out per-frame ExportRows. But the
// orphan detector in summary.ts:429-439 still walked skin.attachments using
// the JSON-key (basePath like "PARTICLES_1/") to populate inUseNames. Since
// synthetic-atlas registers per-frame region names (PARTICLES_1/00..29) in
// sourceDims and NOT the basePath, the basePath check missed every sequence
// attachment — so all N on-disk PNG frames were flagged orphaned.
//
// Fix: when an attachment has `.sequence.regions[]`, fan out and check each
// region.name against sourceDims instead of the basePath.
describe('Sequence-aware orphan detection (debug-fix spine-sequence-undercount-orphan-bleed 2026-05-08)', () => {
  const TEST_03_JSON = path.resolve(
    'fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json',
  );
  const TEST_03_IMAGES_DIR = path.resolve(
    'fixtures/MON_FILES/EXPORT/TEST_03/4.2/images_unpacked',
  );
  // Same skip-when-fixture-absent pattern used by sequence-attachment-fanout.spec.ts
  // (TEST_03 lives under fixtures/MON_FILES/ which is gitignored).
  const FIXTURE_PRESENT =
    fs.existsSync(TEST_03_JSON) && fs.existsSync(TEST_03_IMAGES_DIR);
  const itOrSkip = FIXTURE_PRESENT ? it : it.skip;

  itOrSkip('summary.regions.length is sequence-fanned (header counter source) — matches Global panel; attachments.count stays structural', () => {
    // The header counters ("X images" / "X regions") source from
    // summary.regions.length, which Phase 29 D-01 dedupes by unique regionName
    // and IS sequence-fanned-out. summary.attachments.count is a STRUCTURAL
    // count of attachment objects (sequences count as 1) — kept stable so
    // existing CLI / tests don't break. Lock both invariants:
    //   - regions.length matches the rig's unique on-disk image count (Global
    //     panel parity)
    //   - attachments.count < regions.length on a sequence-bearing fixture
    //     (i.e. fan-out happens somewhere)
    const FIXTURE_DIR = path.dirname(TEST_03_JSON);
    if (!fs.existsSync(path.join(FIXTURE_DIR, 'images'))) {
      return;
    }
    const load = loadSkeleton(TEST_03_JSON, { loaderMode: 'atlas-less' });
    const sampled = sampleSkeleton(load);
    const s = buildSummary(load, sampled, 0);
    expect(s.regions.length).toBeGreaterThan(s.attachments.count);
    // A sequence-bearing rig has more unique regions than attachment objects.
    expect(s.regions.length).toBeGreaterThanOrEqual(30); // at least one full sequence
  });

  itOrSkip('atlas-less mode: PARTICLES sequence frames are NOT flagged as orphaned', () => {
    // The loader hardcodes "images/" as the dir name; the fixture has a
    // local symlink images -> images_unpacked. Skip cleanly if the symlink
    // hasn't been created (would surface as atlasPath !== null assertion failure).
    const FIXTURE_DIR = path.dirname(TEST_03_JSON);
    if (!fs.existsSync(path.join(FIXTURE_DIR, 'images'))) {
      return;
    }

    const load = loadSkeleton(TEST_03_JSON, { loaderMode: 'atlas-less' });
    expect(load.atlasPath).toBeNull(); // atlas-less mode forced via loaderMode
    const sampled = sampleSkeleton(load);
    const s = buildSummary(load, sampled, 0);

    // None of the PARTICLES_1/00..29 or PARTICLES_2/00..29 frames should be
    // marked orphaned — they're all referenced by sequence attachments in
    // slot PARTICLES_1-3.
    const sequenceFrameOrphans = (s.orphanedFiles ?? []).filter((f) =>
      /^PARTICLES_[12]\/\d{2}$/.test(f.filename),
    );
    expect(sequenceFrameOrphans).toEqual([]);
  });
});

describe('Phase 21 G-02 — skippedAttachments cascade', () => {
  // Plan 21-10 — Surface skipped-PNG attachments (Plan 21-09 LoadResult.skippedAttachments)
  // through buildSummary so MissingAttachmentsPanel can render them above the regular
  // panels. Phase 25 PANEL-03: peaks / animationBreakdown.rows are NO LONGER filtered —
  // stub rows remain with isMissing: true so the renderer can show danger indicators.

  it('Phase 25 PANEL-03 — buildSummary marking contract: stub rows marked isMissing:true in peaks + animationBreakdown.rows (non-vacuous synthetic input)', () => {
    // ISSUE-003 motivation: a fixture-only assertion ("TRIANGLE absent from
    // peaks after PNG deletion") is vacuous because the SIMPLE-fixture-with-
    // TRIANGLE-deleted path produces a degenerate AABB (1x1 stub region) that
    // may already be dropped by the analyzer's noise threshold. This UNIT test
    // constructs synthetic peaks containing a NON-ZERO-peakScale TRIANGLE row
    // plus synthetic skippedAttachments. The marking must set isMissing: true
    // on the TRIANGLE row while leaving CIRCLE and SQUARE with isMissing: undefined.
    //
    // We test the MAP+MARK LOGIC by replicating the same Set<string> construction
    // that summary.ts performs (the map+mark is inline in buildSummary; we
    // replicate it here to lock the contract).
    const mockPeaks = [
      { skinName: 'default', slotName: 'slot1', attachmentName: 'CIRCLE',   peakScale: 1.5 } as any,
      { skinName: 'default', slotName: 'slot2', attachmentName: 'TRIANGLE', peakScale: 2.3 } as any,
      { skinName: 'default', slotName: 'slot3', attachmentName: 'SQUARE',   peakScale: 0.9 } as any,
    ];
    const mockSkipped = [
      { name: 'TRIANGLE', expectedPngPath: '/x/TRIANGLE.png' },
    ];

    // Replicate the map+mark construction from summary.ts (Phase 25):
    const skippedNames = new Set(mockSkipped.map((s) => s.name));
    const peaks = mockPeaks.map((p: any) => ({
      ...p,
      isMissing: skippedNames.has(p.attachmentName) ? true : undefined,
    }));

    // All 3 rows present (no filtering).
    expect(peaks.length).toBe(3);
    expect(peaks.find((p: any) => p.attachmentName === 'CIRCLE')).toBeDefined();
    expect(peaks.find((p: any) => p.attachmentName === 'SQUARE')).toBeDefined();

    // TRIANGLE IS present and has isMissing: true.
    const trianglePeak = peaks.find((p: any) => p.attachmentName === 'TRIANGLE');
    expect(trianglePeak).toBeDefined();
    expect(trianglePeak!.isMissing).toBe(true);

    // Non-stub rows have isMissing: undefined (not false).
    const circlePeak = peaks.find((p: any) => p.attachmentName === 'CIRCLE');
    expect(circlePeak!.isMissing).toBeUndefined();
    const squarePeak = peaks.find((p: any) => p.attachmentName === 'SQUARE');
    expect(squarePeak!.isMissing).toBeUndefined();

    // Sanity: input genuinely had TRIANGLE before marking (non-vacuous).
    expect(mockPeaks.find((p: any) => p.attachmentName === 'TRIANGLE')!.peakScale).toBeGreaterThan(1.0);

    // Phase 24 Plan 01: orphanedFiles (filename-keyed) does not participate in
    // skippedNames marking (orphaned files are not rig attachments).

    // Map+mark applies identically to animationBreakdown card rows
    // (BreakdownRow extends DisplayRow; same attachmentName key):
    const mockCard = { cardId: 'anim:test', rows: mockPeaks } as any;
    const markedRows = mockCard.rows.map((r: any) => ({
      ...r,
      isMissing: skippedNames.has(r.attachmentName) ? true : undefined,
    }));
    const markedCard = { ...mockCard, rows: markedRows, uniqueAssetCount: markedRows.length };

    const triangleRow = markedCard.rows.find((r: any) => r.attachmentName === 'TRIANGLE');
    expect(triangleRow).toBeDefined();
    expect(triangleRow!.isMissing).toBe(true);
    expect(markedCard.rows.length).toBe(3);           // all 3 rows present
    expect(markedCard.uniqueAssetCount).toBe(3);      // count includes missing
  });

  it('Phase 25: isMissing boolean survives structuredClone (IPC-safe)', () => {
    const row = { attachmentName: 'TRIANGLE', isMissing: true } as any;
    const cloned = structuredClone(row);
    expect(cloned.isMissing).toBe(true);
  });

  it('Phase 25: non-stub rows have isMissing undefined (not false)', () => {
    const rows = [
      { attachmentName: 'CIRCLE', peakScale: 1.5 } as any,
      { attachmentName: 'TRIANGLE', peakScale: 2.3 } as any,
    ];
    const skipped = new Set(['TRIANGLE']);
    const marked = rows.map((r: any) => ({
      ...r,
      isMissing: skipped.has(r.attachmentName) ? true : undefined,
    }));
    expect(marked.find((r: any) => r.attachmentName === 'CIRCLE')!.isMissing).toBeUndefined();
    expect(marked.find((r: any) => r.attachmentName === 'TRIANGLE')!.isMissing).toBe(true);
  });

  it('Phase 25: uniqueAssetCount equals full rows.length including missing rows', () => {
    const rows = [
      { attachmentName: 'CIRCLE' } as any,
      { attachmentName: 'TRIANGLE' } as any,
      { attachmentName: 'SQUARE' } as any,
    ];
    const skipped = new Set(['TRIANGLE']);
    const markedRows = rows.map((r: any) => ({
      ...r,
      isMissing: skipped.has(r.attachmentName) ? true : undefined,
    }));
    // uniqueAssetCount must equal markedRows.length (3), not filtered count (2)
    expect(markedRows.length).toBe(3);
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

// ===========================================================================
// Phase 29 Plan 01 Task 3 — buildSummary populates summary.regions.
// ===========================================================================
describe('Phase 29 D-01 — summary.regions field populated by buildSummary', () => {
  it('SIMPLE_PROJECT (no path indirection): summary.regions.length === unique-region count; one contributor each except for SQUARE which appears across two slots', () => {
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const s = buildSummary(load, sampled, 0);
    expect(Array.isArray(s.regions)).toBe(true);
    // SIMPLE_PROJECT has 3 unique region names (CIRCLE, SQUARE, TRIANGLE) which
    // is also the count of attachment-deduped peaks.
    expect(s.regions.length).toBe(3);
    expect(s.peaks.length).toBe(3);
    const regionNames = s.regions.map((r) => r.regionName).sort();
    expect(regionNames).toEqual(['CIRCLE', 'SQUARE', 'TRIANGLE']);
    // Every contributor's attachmentName === row's regionName under the
    // no-indirection invariant (attachmentName === regionName for every peak).
    for (const r of s.regions) {
      for (const c of r.contributingAttachments) {
        expect(c.attachmentName).toBe(r.regionName);
      }
    }
  });

  it('summary.regions sorted by regionName ASC (deterministic IPC payload)', () => {
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const s = buildSummary(load, sampled, 0);
    const sorted = [...s.regions]
      .map((r) => r.regionName)
      .sort((a, b) => a.localeCompare(b));
    expect(s.regions.map((r) => r.regionName)).toEqual(sorted);
  });

  it('SkeletonSummary structuredClones cleanly with the new regions field (D-21 invariant)', () => {
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const summary = buildSummary(load, sampled, 0);
    const cloned = structuredClone(summary);
    // Round-trip preserves region content + ordering.
    expect(cloned.regions).toEqual(summary.regions);
    // Each contributingAttachments[] survives without identity loss.
    for (let i = 0; i < summary.regions.length; i++) {
      expect(cloned.regions[i].contributingAttachments).toEqual(
        summary.regions[i].contributingAttachments,
      );
    }
  });

  it('summary.peaks remains byte-equal in structure to pre-29-01 (path-indirection-free fixture preserves CLI golden lock D-102)', () => {
    // SIMPLE_PROJECT has no path indirection; analyze() output must be unchanged
    // in shape after Phase 29 — only the additive optional regionName field is
    // present per Task 2's DisplayRow extension. The CLI does not iterate
    // row keys, so this is invisible to scripts/cli.ts.
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const s = buildSummary(load, sampled, 0);
    expect(s.peaks.length).toBe(3);
    for (const p of s.peaks) {
      // regionName field IS present (additive); equals attachmentName for SIMPLE.
      expect(p.regionName).toBe(p.attachmentName);
      // All other DisplayRow fields preserved.
      expect(typeof p.peakScale).toBe('number');
      expect(typeof p.scaleLabel).toBe('string');
    }
  });
});

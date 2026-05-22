/**
 * Phase 49 Plan 01 — V2 (EXPORT-02) source-never-modified.
 *
 * The source project is NEVER mutated. Two independent guarantees:
 *   (1) sha256 of the source skeleton JSON is byte-identical before/after a
 *       full handleExportVariant run (the source path is only ever read,
 *       never written; the only new write is the baked variant JSON in a NEW
 *       subfolder).
 *   (2) bake() clones first (scale-bake.ts:91) — the in-memory source object
 *       is never structurally mutated.
 *
 * Imports handleExportVariant (Task 3) — RED until Task 3 wires the handler;
 * documented TDD ordering, not a regression. handleExportVariant does NOT
 * import electron, so this runs without a vi.mock (mirrors summary.spec.ts).
 * Scaffold from tests/main/image-worker.integration.spec.ts:21-67 (mkdtempSync
 * + createHash).
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { buildSummary } from '../../src/main/summary.js';
import { bake } from '../../src/core/scale-bake.js';
import { handleExportVariant } from '../../src/main/variant-export.js';
import type { SkeletonSummary } from '../../src/shared/types.js';

const SRC = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');

const fakeEvt = { sender: { send: () => {} } };
const defaultAtlasOpts = { maxPageSize: 4096 as const, allowRotation: false, padding: 2 };

function sha256(p: string): string {
  return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function buildFixtureSummary(): SkeletonSummary {
  const load = loadSkeleton(SRC);
  const sampled = sampleSkeleton(load);
  return buildSummary(load, sampled, 0);
}

describe('handleExportVariant — V2 source-never-modified (EXPORT-02)', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-variant-src-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('source skeleton JSON sha256 is byte-identical before/after a 0.5× variant export', async () => {
    expect(fs.existsSync(SRC), `fixture missing: ${SRC}`).toBe(true);
    const before = sha256(SRC);

    const summary = buildFixtureSummary();
    const res = await handleExportVariant(
      fakeEvt,
      summary,
      0.5,
      tmpDir,
      false,
      false,
      'loose',
      defaultAtlasOpts,
    );
    // The export must actually run (not a guard rejection) for this to be a
    // meaningful immutability assertion.
    expect(res.ok, `export should succeed; got: ${res.ok ? 'ok' : (res as { error: { message: string } }).error.message}`).toBe(true);

    const after = sha256(SRC);
    expect(after).toBe(before);
  });

  it('bake() clones first — the in-memory source object is structurally unmutated', () => {
    const srcObj = JSON.parse(fs.readFileSync(SRC, 'utf8'));
    const snapshot = JSON.stringify(srcObj);
    bake(srcObj, 0.5); // bake clones first (scale-bake.ts:91)
    expect(JSON.stringify(srcObj)).toBe(snapshot);
  });
});

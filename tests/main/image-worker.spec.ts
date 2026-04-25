/**
 * Phase 6 Plan 04 — RED specs for runExport (main-process sharp loop).
 *
 * Strategy: extracted-handler test pattern (mirrors tests/core/ipc.spec.ts:1-19) —
 * runExport(plan, outDir, onProgress, isCancelled) is a standalone async fn,
 * testable WITHOUT spinning up Electron. Sharp + node:fs/promises are vi.mocked
 * for unit-level cases (a)-(f) below.
 *
 * Cases per .planning/phases/06-optimize-assets-image-export/06-CONTEXT.md
 * <decisions> "Tests" lines 33-37:
 *   (a) all-success → emits N events all 'success', 0 errors. [D-114, F8.5]
 *   (b) one missing source → emits 'missing-source' for that path, others
 *       succeed. [D-112, D-116]
 *   (c) sharp throws on file 3 of 5 → emits 'sharp-error', files 4-5 still
 *       process. [D-116]
 *   (d) cancel flag set after file 2 → file 2 in-flight finishes, file 3
 *       not started. [D-115]
 *   (e) atomic write — toFile target is <outPath>.tmp, then rename swaps
 *       to <outPath>. [D-121]
 *   (f) re-entrant prevention is at IPC layer (Plan 05); runExport itself
 *       has no re-entrancy guard. [D-115]
 *
 * Wave 3 status: GREEN — runExport landed in Plan 06-04 Task 1; this file
 * (Plan 06-01 RED shell + Plan 06-04 Task 2 mock-restoration helper) drives
 * cases (a)-(f) to passing. Real-bytes integration sanity check lives next
 * door at tests/main/image-worker.integration.spec.ts (no mocks; exercises
 * sharp + node:fs/promises against fixtures/EXPORT_PROJECT/images/CIRCLE.png).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
// GREEN since Plan 06-04 Task 1 — runExport lives in src/main/image-worker.ts.
import { runExport } from '../../src/main/image-worker.js';
import type { ExportPlan, ExportProgressEvent } from '../../src/shared/types.js';

vi.mock('sharp', () => {
  const toFile = vi.fn().mockResolvedValue({ size: 100 });
  const png = vi.fn(() => ({ toFile }));
  const resize = vi.fn(() => ({ png }));
  const sharp = vi.fn(() => ({ resize }));
  return { default: sharp };
});

vi.mock('node:fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  constants: { R_OK: 4 },
}));

function buildPlan(rows: number): ExportPlan {
  return {
    rows: Array.from({ length: rows }, (_, i) => ({
      sourcePath: `/src/img${i}.png`,
      outPath: `images/img${i}.png`,
      sourceW: 64,
      sourceH: 64,
      outW: 32,
      outH: 32,
      effectiveScale: 0.5,
      attachmentNames: [`att${i}`],
    })),
    excludedUnused: [],
    totals: { count: rows },
  };
}

/**
 * Restore default success impls on every mock. vi.clearAllMocks() only clears
 * call history — it does NOT reset .mockImplementation() / .mockResolvedValue()
 * established by prior tests. Without this, case (b)'s access-throws-on-img1
 * impl leaks into case (c), and case (c)'s sharp-throws-on-call-3 impl leaks
 * into cases (d)+(e). This helper re-establishes the all-success baseline so
 * each case starts from a known clean state — then the case sets its own
 * targeted impl on top.
 *
 * Plan 06-04 Task 2 [Rule 3 - Blocking] — added because the Plan 06-01 RED
 * shell relied on vi.clearAllMocks alone, which is insufficient for the
 * cross-test impl pollution the cases (b)/(c) targeted-throws strategy
 * inherently creates.
 */
async function restoreDefaultMocks(): Promise<void> {
  const fsPromises = await import('node:fs/promises');
  vi.mocked(fsPromises.access).mockReset().mockResolvedValue(undefined);
  vi.mocked(fsPromises.mkdir).mockReset().mockResolvedValue(undefined);
  vi.mocked(fsPromises.rename).mockReset().mockResolvedValue(undefined);
  const sharpModule = await import('sharp');
  vi.mocked(sharpModule.default).mockReset().mockImplementation(
    () => ({
      resize: vi.fn(() => ({
        png: vi.fn(() => ({
          toFile: vi.fn().mockResolvedValue({ size: 100 }),
        })),
      })),
    }) as unknown as ReturnType<typeof sharpModule.default>,
  );
}

let tmpDir: string;
beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-export-'));
  vi.clearAllMocks();
  await restoreDefaultMocks();
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runExport — case (a) all-success (D-114, F8.5)', () => {
  it('emits N progress events all status=success, summary has 0 errors, successes=N', async () => {
    const events: ExportProgressEvent[] = [];
    const plan = buildPlan(3);
    const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);
    expect(events.length).toBe(3);
    expect(events.every((e) => e.status === 'success')).toBe(true);
    expect(summary.successes).toBe(3);
    expect(summary.errors.length).toBe(0);
    expect(summary.cancelled).toBe(false);
  });
});

describe('runExport — case (b) one missing source (D-112, D-116)', () => {
  it('emits missing-source event for the missing file; others succeed; total events = N', async () => {
    const fsPromises = await import('node:fs/promises');
    const accessMock = vi.mocked(fsPromises.access);
    // Throw on the 2nd file's access check, succeed for the others.
    accessMock.mockImplementation(async (p) => {
      if (typeof p === 'string' && p.endsWith('img1.png')) {
        throw new Error('ENOENT: no such file');
      }
      return undefined;
    });
    const events: ExportProgressEvent[] = [];
    const plan = buildPlan(3);
    const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);
    expect(events.length).toBe(3);
    const errorEvent = events.find((e) => e.status === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.error?.kind).toBe('missing-source');
    expect(summary.successes).toBe(2);
    expect(summary.errors.length).toBe(1);
    expect(summary.errors[0].kind).toBe('missing-source');
  });
});

describe('runExport — case (c) sharp throws on file 3 of 5 (D-116)', () => {
  it('emits sharp-error for file 3, files 4+5 still process to success', async () => {
    const sharpModule = await import('sharp');
    const sharpMock = vi.mocked(sharpModule.default);
    let call = 0;
    sharpMock.mockImplementation(() => {
      call += 1;
      if (call === 3) {
        // Build a chain that throws at toFile.
        return {
          resize: vi.fn(() => ({
            png: vi.fn(() => ({
              toFile: vi.fn().mockRejectedValue(new Error('libvips: bad PNG')),
            })),
          })),
        } as unknown as ReturnType<typeof sharpModule.default>;
      }
      return {
        resize: vi.fn(() => ({
          png: vi.fn(() => ({
            toFile: vi.fn().mockResolvedValue({ size: 100 }),
          })),
        })),
      } as unknown as ReturnType<typeof sharpModule.default>;
    });
    const events: ExportProgressEvent[] = [];
    const plan = buildPlan(5);
    const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);
    expect(events.length).toBe(5);
    const errorEvent = events[2];
    expect(errorEvent.status).toBe('error');
    expect(errorEvent.error?.kind).toBe('sharp-error');
    // Files 4 + 5 should still process (the loop doesn't bail on a single error).
    expect(events[3].status).toBe('success');
    expect(events[4].status).toBe('success');
    expect(summary.successes).toBe(4);
    expect(summary.errors.length).toBe(1);
  });
});

describe('runExport — case (d) cancel after file 2 (D-115)', () => {
  it('cancel flag flips after file 2 completes → file 3 not started; summary.cancelled=true', async () => {
    let processed = 0;
    let cancelled = false;
    const events: ExportProgressEvent[] = [];
    const plan = buildPlan(5);
    const summary = await runExport(
      plan,
      tmpDir,
      (e) => {
        events.push(e);
        processed += 1;
        if (processed === 2) cancelled = true; // flip cancel after 2 events
      },
      () => cancelled,
    );
    // File 2 completes (in-flight finishes per D-115); file 3 not started.
    expect(events.length).toBe(2);
    expect(summary.cancelled).toBe(true);
    expect(summary.successes).toBe(2);
  });
});

describe('runExport — case (e) atomic write (D-121)', () => {
  it('sharp.toFile target is <outPath>.tmp; fs.rename swaps to final outPath', async () => {
    const fsPromises = await import('node:fs/promises');
    const renameMock = vi.mocked(fsPromises.rename);
    const sharpModule = await import('sharp');
    const sharpMock = vi.mocked(sharpModule.default);
    const toFileTargets: string[] = [];
    sharpMock.mockImplementation(() => ({
      resize: vi.fn(() => ({
        png: vi.fn(() => ({
          toFile: vi.fn().mockImplementation(async (target: string) => {
            toFileTargets.push(target);
            return { size: 100 };
          }),
        })),
      })),
    }) as unknown as ReturnType<typeof sharpModule.default>);
    const plan = buildPlan(2);
    await runExport(plan, tmpDir, () => {}, () => false);
    // Every toFile target ends in .tmp
    expect(toFileTargets.length).toBe(2);
    for (const t of toFileTargets) {
      expect(t.endsWith('.tmp')).toBe(true);
    }
    // fs.rename was called once per row, swapping .tmp → final
    expect(renameMock).toHaveBeenCalledTimes(2);
    for (const call of renameMock.mock.calls) {
      const [src, dst] = call;
      expect(String(src).endsWith('.tmp')).toBe(true);
      expect(String(dst).endsWith('.tmp')).toBe(false);
    }
  });
});

describe('runExport — case (f) no internal re-entrancy guard (D-115)', () => {
  it('runExport itself has no re-entrancy lock — IPC layer (Plan 05) enforces it', async () => {
    // Two parallel runExport invocations on the SAME tmpDir do NOT throw at
    // the runExport level; the guard lives in handleStartExport (Plan 06-05).
    // This test locks that contract — runExport stays a pure async fn.
    const plan = buildPlan(2);
    const r1 = runExport(plan, tmpDir, () => {}, () => false);
    const r2 = runExport(plan, tmpDir, () => {}, () => false);
    const [s1, s2] = await Promise.all([r1, r2]);
    // Both complete — no re-entrant rejection at this layer.
    expect(s1.successes).toBeGreaterThanOrEqual(0);
    expect(s2.successes).toBeGreaterThanOrEqual(0);
  });
});

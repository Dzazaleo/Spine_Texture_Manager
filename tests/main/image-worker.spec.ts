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

// Round 4 (2026-04-25): image-worker now also calls access(resolvedOut, F_OK)
// as the per-row defense-in-depth overwrite gate. The default mock must
// differentiate F_OK probes (existence checks against resolved OUTPUT paths
// — the no-pre-existing-file baseline → reject) from R_OK probes (readability
// checks against SOURCE paths — sources exist → resolve). Mode-based dispatch
// keeps the case (a)-(f) tests untouched while letting the round-2/3 tests
// override `access` selectively when they need a collision to surface.
vi.mock('node:fs/promises', () => ({
  access: vi.fn().mockImplementation(async (_path: unknown, mode?: number) => {
    if (mode === 0 /* F_OK */) {
      throw new Error('ENOENT');
    }
    return undefined;
  }),
  mkdir: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  constants: { R_OK: 4, F_OK: 0 },
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
  // Round 4 (2026-04-25): mode-based dispatch — F_OK probes (existence
  // against resolved OUTPUT paths) reject by default so no pre-existing
  // file collision surfaces; R_OK probes (readability against SOURCE
  // paths) resolve so sources are readable. Tests that need a collision
  // to surface can mockResolvedValueOnce / override after this restore.
  vi.mocked(fsPromises.access).mockReset().mockImplementation(async (_p, mode) => {
    if (mode === 0 /* F_OK */) {
      throw new Error('ENOENT');
    }
    return undefined;
  });
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
    // Throw on the 2nd file's source access check (R_OK), succeed for the
    // other sources. Round 4: F_OK probes (output existence) always reject
    // so the overwrite-source gate doesn't fire here.
    accessMock.mockImplementation(async (p, mode) => {
      if (mode === 0 /* F_OK */) {
        throw new Error('ENOENT');
      }
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

/**
 * Gap-Fix Round 2 (2026-04-25) — Bug #4 defense-in-depth lock.
 *
 * Locks the in-worker per-row collision check. The IPC layer
 * (handleStartExport) ALSO pre-flights the same condition and rejects the
 * entire plan up front — but runExport is invoked directly by tests and
 * could in principle be called by future code that bypasses the IPC
 * layer. This test exercises runExport directly with one row whose
 * resolved outPath equals its sourcePath; that row must emit
 * 'overwrite-source' while OTHER rows in the same plan still process
 * (D-116 skip-on-error continuation).
 *
 * Round 3 (2026-04-25) — the per-row check is now GATED on the
 * `allowOverwrite` parameter. Default (false) preserves the round-2
 * behaviour; allowOverwrite=true bypasses the check (renderer's
 * "Overwrite all" branch sets startExport(overwrite=true) which the IPC
 * layer forwards). Two tests below lock both branches.
 */
describe('runExport — Bug #4 defense-in-depth per-row overwrite-source (Gap-Fix Round 2)', () => {
  it('per-row collision: row whose resolved output exists on disk gets overwrite-source error; other rows continue', async () => {
    // Round 4 (2026-04-25): the per-row gate is F_OK (existence on disk).
    // Pretend ONE row's resolved output (images/COLLIDE.png under tmpDir)
    // exists on disk; the other two rows' resolved outputs do not. The
    // colliding row gets 'overwrite-source'; the others process normally
    // (D-116 skip-on-error continuation).
    const collidingResolvedOut = path.join(tmpDir, 'images', 'COLLIDE.png');
    const fsPromises = await import('node:fs/promises');
    vi.mocked(fsPromises.access).mockImplementation(async (p, mode) => {
      if (mode === 0 /* F_OK */) {
        if (typeof p === 'string' && path.resolve(p) === path.resolve(collidingResolvedOut)) {
          return undefined; // file exists
        }
        throw new Error('ENOENT');
      }
      return undefined; // R_OK source-readability — sources are readable
    });

    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: '/elsewhere/SAFE0.png',
          outPath: 'images/SAFE0.png',
          sourceW: 64,
          sourceH: 64,
          outW: 32,
          outH: 32,
          effectiveScale: 0.5,
          attachmentNames: ['SAFE0'],
        },
        {
          sourcePath: collidingResolvedOut,
          outPath: 'images/COLLIDE.png',
          sourceW: 64,
          sourceH: 64,
          outW: 32,
          outH: 32,
          effectiveScale: 0.5,
          attachmentNames: ['COLLIDE'],
        },
        {
          sourcePath: '/elsewhere/SAFE2.png',
          outPath: 'images/SAFE2.png',
          sourceW: 64,
          sourceH: 64,
          outW: 32,
          outH: 32,
          effectiveScale: 0.5,
          attachmentNames: ['SAFE2'],
        },
      ],
      excludedUnused: [],
      totals: { count: 3 },
    };
    const events: ExportProgressEvent[] = [];
    const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);

    // All 3 rows emit one event each — the collision DOES NOT bail the loop.
    expect(events.length).toBe(3);
    // Row 1 (the collision) is the ONLY error.
    expect(events[0].status).toBe('success');
    expect(events[1].status).toBe('error');
    expect(events[1].error?.kind).toBe('overwrite-source');
    expect(events[2].status).toBe('success');
    expect(summary.successes).toBe(2);
    expect(summary.errors.length).toBe(1);
    expect(summary.errors[0].kind).toBe('overwrite-source');
  });

  it('Round 3: allowOverwrite=true bypasses the per-row collision check (proceeds without overwrite-source)', async () => {
    // Same colliding row as the test above — but with allowOverwrite=true
    // the per-row check is skipped and the row proceeds through the sharp
    // pipeline (mocked to succeed). All 3 rows succeed; no errors.
    const collidingFile = path.join(tmpDir, 'images', 'COLLIDE.png');
    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: '/elsewhere/SAFE0.png',
          outPath: 'images/SAFE0.png',
          sourceW: 64,
          sourceH: 64,
          outW: 32,
          outH: 32,
          effectiveScale: 0.5,
          attachmentNames: ['SAFE0'],
        },
        {
          sourcePath: collidingFile,
          outPath: 'images/COLLIDE.png',
          sourceW: 64,
          sourceH: 64,
          outW: 32,
          outH: 32,
          effectiveScale: 0.5,
          attachmentNames: ['COLLIDE'],
        },
        {
          sourcePath: '/elsewhere/SAFE2.png',
          outPath: 'images/SAFE2.png',
          sourceW: 64,
          sourceH: 64,
          outW: 32,
          outH: 32,
          effectiveScale: 0.5,
          attachmentNames: ['SAFE2'],
        },
      ],
      excludedUnused: [],
      totals: { count: 3 },
    };
    const events: ExportProgressEvent[] = [];
    const summary = await runExport(
      plan,
      tmpDir,
      (e) => events.push(e),
      () => false,
      true, // allowOverwrite = true
    );

    expect(events.length).toBe(3);
    // Round 3 with allowOverwrite=true: NO overwrite-source error fires.
    for (const e of events) {
      expect(e.status).toBe('success');
    }
    expect(summary.successes).toBe(3);
    expect(summary.errors.length).toBe(0);
  });

  it('Round 3: allowOverwrite=false (default) preserves the round-2 collision protection', async () => {
    // Explicit-false invocation locks the default behaviour — same as the
    // unparameterised call in the first test above; this test pins the
    // explicit-false branch so a future signature change can't silently
    // flip the default to true.
    //
    // Round 4 (2026-04-25): the gate is F_OK existence on the resolved
    // output. Make the F_OK probe RESOLVE for any output under tmpDir so
    // the collision surfaces.
    const collidingFile = path.join(tmpDir, 'images', 'COLLIDE.png');
    const fsPromises = await import('node:fs/promises');
    vi.mocked(fsPromises.access).mockImplementation(async (_p, mode) => {
      if (mode === 0 /* F_OK */) {
        return undefined; // file exists
      }
      return undefined; // R_OK
    });

    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: collidingFile,
          outPath: 'images/COLLIDE.png',
          sourceW: 64,
          sourceH: 64,
          outW: 32,
          outH: 32,
          effectiveScale: 0.5,
          attachmentNames: ['COLLIDE'],
        },
      ],
      excludedUnused: [],
      totals: { count: 1 },
    };
    const events: ExportProgressEvent[] = [];
    const summary = await runExport(
      plan,
      tmpDir,
      (e) => events.push(e),
      () => false,
      false, // allowOverwrite = false (explicit)
    );
    expect(events.length).toBe(1);
    expect(events[0].status).toBe('error');
    expect(events[0].error?.kind).toBe('overwrite-source');
    expect(summary.errors.length).toBe(1);
  });
});

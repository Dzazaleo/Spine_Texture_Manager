/**
 * Phase 49 Plan 01 — the variant-export orchestrator (EXPORT-01/02/03/05).
 *
 * `handleExportVariant` composes a single-scale variant export as a FOCUSED
 * composition (NOT a fork of handleStartExport — D-04 "shipped Optimize flow
 * untouched"):
 *
 *   D-08 guard (edge, NOT core)  →  read source JSON  →  bake(s) (core, pure)
 *   →  derive {PARENT}/{NAME}@{s}x/  →  write-baked-JSON-FIRST (rollback covers
 *   it)  →  the existing export-plan builder on scaleSummaryPeaks(summary, s),
 *   reused UNCHANGED (D-07)  →  dispatch runExport/runRepack under ONE shared
 *   `written` rollback Set.
 *
 * Invariants embodied here:
 *   - L-01: variant geometry is produced ONLY by core bake() — no bone scaling.
 *   - L-02: variant_peak = s × master_peak by arithmetic (scaleSummaryPeaks);
 *           the variant is NEVER re-sampled (no sampler call below).
 *   - L-03: bake() returns NEW JSON; the source is never mutated; the FIRST-ever
 *           skeleton-JSON disk write lives in main/ (skeleton-json-writer.ts).
 *   - L-04: the write path is runtime-agnostic (no spine-core import below bake).
 *   - D-07: the variant inherits the user's FULL active export config; the
 *           sizing + write pipeline (the export-plan builder + runExport/
 *           runRepack) is reused UNCHANGED.
 *   - EXPORT-02: the baked variant JSON is registered in the shared `written`
 *                rollback Set so a mid-export failure rolls it back too.
 */
import { rm as fsRm, readFile } from 'node:fs/promises';
import { basename, join, resolve as pathResolve } from 'node:path';
import { bake } from '../core/scale-bake.js';
import { scaleSummaryPeaks } from '../core/scale-summary-peaks.js';
import { buildExportPlan } from '../core/export.js';
import { VariantScaleError } from '../core/errors.js';
import { writeSkeletonJsonAtomic } from './skeleton-json-writer.js';
import { runExport } from './image-worker.js';
import { runRepack, type AtlasOpts } from './repack-worker.js';
import type {
  BatchVariantResult,
  ExportResponse,
  ExportSummary,
  SkeletonSummary,
} from '../shared/types.js';

/**
 * Phase 49 D-02 — the ONE canonical scale-token helper. Renders the scale that
 * the `{NAME}@{s}x/` folder carries. This is the single source of truth for the
 * token; Plan 03 references it BY NAME, and the renderer's `folderHint` reuses it
 * (WR-03) so the display copy never diverges from the on-disk folder name.
 *
 * WR-03: the scale arrives from a `<input type="number" step="0.05">` whose
 * native step-up accumulates IEEE-754 error (e.g. stepping to 0.3 yields
 * `0.30000000000000004`). A bare `String(s)` would leak that float artifact into
 * the folder name (`SIMPLE_TEST@0.30000000000000004x/`). Rounding to 4 decimals
 * and re-parsing strips both the artifact AND trailing zeros, restoring the clean
 * `@{s}x` convention. `Number(s.toFixed(4))` keeps the trailing-zero-strip that
 * `String()` already gave (`0.5 → '0.5'`, `0.30000000000000004 → '0.3'`).
 *   CANONICAL CONTRACT: formatScaleToken(0.5) === '0.5'.
 */
export function formatScaleToken(s: number): string {
  return String(Number(s.toFixed(4)));
}

// WR-05: dedicated re-entrancy guard for the variant export channel, mirroring
// handleStartExport's module-level `exportInFlight` slot (ipc.ts:179,763,847,997).
// Two concurrent variant exports would race on the same `written` rollback Sets
// and output folder; serialize them here. (D-04 keeps the shipped Optimize flow's
// own `exportInFlight` slot byte-untouched, so this is a separate variant-scoped
// flag rather than a shared one — the variant path never forks handleStartExport.)
let variantExportInFlight = false;

// Phase 51 D-09 — between-variants batch cancel flag. Reset to false at the START
// of every handleExportVariantBatch run (Pitfall 5 — a stale true from a prior
// cancelled batch must not poison the next run), set true by ipcMain.on('variant:cancelBatch'),
// checked at the top of each loop iteration. The in-flight variant is NEVER
// interrupted (D-09 between-variants only) — the per-worker () => false cbs stay () => false.
let variantBatchCancelRequested = false;

// Phase 51 — the UN-GUARDED single-variant body. Extracted VERBATIM from the former
// handleExportVariant lines 90-295 (the D-08 guard → read → bake → plan →
// collision guard → write-JSON-first → dispatch under its OWN `written` Set → merge
// → ExportResponse). NO re-entrancy slot here: the guard lives in the wrapper below
// and the batch claims it ONCE. Each call mints its own rollback Set (D-07 / Pitfall 4).
async function exportOneVariant(
  evt: { sender: { send: (channel: string, ...args: unknown[]) => void } },
  summary: SkeletonSummary,
  s: number,
  parentDir: string,
  overwrite: boolean,
  sharpenEnabled: boolean,
  outputMode: 'loose' | 'atlas' | 'both',
  atlasOpts: AtlasOpts,
  effectiveOverrides: ReadonlyMap<string, number> = new Map(),
  safetyBufferPercent: number = 0,
): Promise<ExportResponse> {
  // 1. D-08 guard FIRST — at the export EDGE, NOT in core bake() (Phase-48 D-09
  //    preserved: bake stays direction-agnostic). Rejects NaN / <=0 / >=1.
  if (!Number.isFinite(s) || s <= 0 || s >= 1) {
    return { ok: false, error: { kind: 'Unknown', message: new VariantScaleError(s).message } };
  }

  // 1b. WR-01 — reject a valid sub-range scale whose 4-decimal folder token
  //     collapses to a DEGENERATE name. formatScaleToken rounds to 4dp, so
  //     s = 0.000049 → "0" and s = 0.99999 → "1": both pass the 0<s<1 guard above
  //     but would write a real baked package into {NAME}@0x/ or {NAME}@1x/, whose
  //     name no longer identifies the variant (the bake used the exact unrounded
  //     s). The renderer isRowInvalid mirrors this so the row is flagged pre-submit.
  {
    const token = formatScaleToken(s);
    if (token === '0' || token === '1') {
      return {
        ok: false,
        error: {
          kind: 'Unknown',
          message: `Scale ${s} rounds to a degenerate folder token @${token}x; choose a scale between 0.0001 and 0.9999.`,
        },
      };
    }
  }

  // 2. Validate boundary inputs (mirror ipc.ts:763-765).
  if (typeof parentDir !== 'string' || parentDir.length === 0) {
    return { ok: false, error: { kind: 'Unknown', message: 'parentDir must be a non-empty string' } };
  }
  if (typeof summary?.skeletonPath !== 'string' || summary.skeletonPath.length === 0) {
    return { ok: false, error: { kind: 'Unknown', message: 'summary.skeletonPath must be a non-empty string' } };
  }

  // 2b. WR-06: re-validate safetyBufferPercent at the trust boundary, mirroring
  //     the renderer clamp (VariantDialog.tsx:442 → Math.max(0, Math.min(25, …)))
  //     and the project's "validate at the trust boundary" contract that
  //     validateExportOpts enforces for the sibling export:start channel. The
  //     value is passed UNBOUNDED into buildExportPlan otherwise — a misbehaving
  //     or compromised renderer (the documented trust boundary, ipc.ts:30-32)
  //     could send safetyBufferPercent: 100000. Coerce NaN/non-finite to 0, floor
  //     to an integer, and clamp to the documented [0,25] range.
  const safeBuffer = Number.isFinite(safetyBufferPercent)
    ? Math.max(0, Math.min(25, Math.trunc(safetyBufferPercent)))
    : 0;

  // 3. Derive {NAME} (basename strips any directory component → no `../`
  //    traversal survives). Reject empty / `:`-bearing names (mirrors
  //    deriveProjectName atlas-paths.ts:75-78). T-49-DIR mitigation.
  const NAME = basename(summary.skeletonPath).replace(/\.json$/i, '');
  if (!NAME || NAME.includes(':')) {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'Cannot derive a clean variant name from the skeleton path.' },
    };
  }

  // 4. {PARENT}/{NAME}@{s}x/ (D-01/D-02). The scale token rides the FOLDER; inner
  //    basenames stay clean {NAME}.* (Pattern 3 / Pitfall 4 — never scale-suffix).
  const outDir = join(parentDir, `${NAME}@${formatScaleToken(s)}x`);

  // Phase 51 — NO re-entrancy slot claim here. The wrapper handleExportVariant (and
  // the batch handleExportVariantBatch) claim variantExportInFlight ONCE before
  // calling this body; exportOneVariant runs un-guarded so the batch can loop it.
  {
    // 5. Read the source skeleton JSON (main-only fs read; the path is only ever
    //    read, never written — EXPORT-02 / T-49-SRC).
    let sourceJson: Record<string, unknown>;
    try {
      sourceJson = JSON.parse(await readFile(summary.skeletonPath, 'utf8'));
    } catch (err) {
      return {
        ok: false,
        error: {
          kind: 'Unknown',
          message: `Failed to read source skeleton JSON: ${err instanceof Error ? err.message : String(err)}`,
        },
      };
    }

    // 6. bake — core, pure (L-01/L-03). bake clones first → source object untouched.
    let baked: Record<string, unknown>;
    try {
      baked = bake(sourceJson, s) as Record<string, unknown>;
    } catch (err) {
      return {
        ok: false,
        error: { kind: 'Unknown', message: err instanceof Error ? err.message : String(err) },
      };
    }

    // 7. Build the s-scaled plan with the export-plan builder UNCHANGED (D-07 /
    //    EXPORT-02). plan.skeletonPath = summary.skeletonPath so deriveProjectName
    //    yields clean {NAME}.* (Pattern 3 / Pitfall 4 — do NOT scale-suffix).
    //    WR-01: try/caught like steps 5 & 6 — scaleSummaryPeaks iterates
    //    c.regions/c.peaks unconditionally and buildExportPlan can throw on a
    //    malformed summary; an uncaught throw here would REJECT the IPC promise
    //    instead of returning the documented ExportResponse envelope.
    let plan: ReturnType<typeof buildExportPlan>;
    try {
      plan = buildExportPlan(scaleSummaryPeaks(summary, s), effectiveOverrides, {
        skeletonPath: summary.skeletonPath,
        safetyBufferPercent: safeBuffer, // WR-06: clamped at the trust boundary above
      });
    } catch (err) {
      return {
        ok: false,
        error: { kind: 'Unknown', message: err instanceof Error ? err.message : String(err) },
      };
    }

    // 8. Source-collision guard (reuse the ipc.ts:809-827 logic). Reject when the
    //    outDir IS the source images dir. T-49-DIR + T-49-SRC. Skip on empty plan.
    //    WR-04: buildExportPlan routes each region into EITHER `rows` OR
    //    `passthroughCopies` (export.ts:452,454). When EVERY region is a passthrough
    //    copy (already at/below source dims), `rows` is empty while
    //    `passthroughCopies` is non-empty — yet runExport still WRITES the
    //    passthrough copies. Derive the collision sentinel from the first row the
    //    workers will actually write, in EITHER bucket.
    const collisionSentinel = plan.rows[0] ?? plan.passthroughCopies[0];
    if (collisionSentinel) {
      const normalised = collisionSentinel.sourcePath.replace(/\\/g, '/');
      const idx = normalised.lastIndexOf('/images/');
      if (idx >= 0) {
        const sourceImagesDir = normalised.slice(0, idx + '/images'.length);
        if (pathResolve(outDir) === pathResolve(sourceImagesDir)) {
          return {
            ok: false,
            error: {
              kind: 'invalid-out-dir',
              message:
                'Variant output directory IS the source images folder. ' +
                'Every output would overwrite a source — pick a different folder.',
            },
          };
        }
      }
    }

    // 9. Shared rollback Set + progress closure (verbatim from ipc.ts:901-906 —
    //    tolerates a gone sender).
    const written = new Set<string>();
    const sendProgress = (e: unknown) => {
      try {
        evt.sender.send('export:progress', e);
      } catch {
        /* webContents gone */
      }
    };

    // 10. One try wrapping write-JSON-FIRST + the dispatch matrix + merge.
    try {
      // Write the baked variant JSON FIRST so a later texture throw rolls it back
      // via the shared sweep (T-49-ROLLBACK / EXPORT-03 always-written).
      // CR-01: pass `overwrite` so the JSON honors the SAME gate the workers
      // enforce — a re-export into an existing folder with overwrite=false now
      // refuses (throws → rolled back → surfaced) instead of silently replacing
      // {NAME}.json while the textures are refused.
      await writeSkeletonJsonAtomic(join(outDir, `${NAME}.json`), baked, written, overwrite);

      let looseSummary: ExportSummary | undefined;
      let repackSummary: ExportSummary | undefined;
      if (outputMode === 'loose' || outputMode === 'both') {
        looseSummary = await runExport(
          plan,
          outDir,
          sendProgress,
          () => false, // no separate variant cancel channel this phase
          overwrite,
          sharpenEnabled,
          written,
        );
      }
      if (outputMode === 'atlas' || outputMode === 'both') {
        const repackResult = await runRepack(
          plan,
          outDir,
          sendProgress,
          () => false,
          overwrite,
          sharpenEnabled,
          atlasOpts,
          written,
        );
        repackSummary = repackResult.summary;
      }

      // Merge summaries (verbatim contract from ipc.ts:948-972).
      let finalSummary: ExportSummary;
      if (looseSummary && repackSummary) {
        finalSummary = {
          successes: looseSummary.successes + repackSummary.successes,
          errors: [...looseSummary.errors, ...repackSummary.errors],
          outputDir: looseSummary.outputDir,
          durationMs: looseSummary.durationMs + repackSummary.durationMs,
          cancelled: looseSummary.cancelled || repackSummary.cancelled,
        };
      } else if (repackSummary) {
        finalSummary = repackSummary;
      } else if (looseSummary) {
        finalSummary = looseSummary;
      } else {
        finalSummary = {
          successes: 0,
          errors: [],
          outputDir: pathResolve(outDir),
          durationMs: 0,
          cancelled: false,
        };
      }
      return { ok: true, summary: finalSummary };
    } catch (innerErr) {
      // Rollback sweep — covers the baked JSON too (T-49-ROLLBACK). force-rm
      // swallows ENOENT, so sweeping half-landed paths is safe.
      for (const p of written) {
        await fsRm(p, { force: true }).catch(() => {
          /* defense-in-depth */
        });
      }
      return {
        ok: false,
        error: { kind: 'Unknown', message: innerErr instanceof Error ? innerErr.message : String(innerErr) },
      };
    }
  }
}

/**
 * Phase 49 EXPORT-01 — single-scale variant export. The thin guard wrapper around
 * exportOneVariant: the EXTERNAL contract is byte-identical to the pre-Phase-51
 * function (ipc.ts + every Phase-49 test call this unchanged).
 *
 * WR-05: the re-entrancy guard is checked FIRST (mirrors the former step 0). The
 * slot is claimed ONCE at the very top and released in the finally on every exit
 * path. The former code claimed the slot AFTER the synchronous validation guards
 * and before the first await; moving the claim to the top is safe — exportOneVariant's
 * synchronous early-returns (bad scale, bad parentDir) now happen while the slot is
 * held, but the `finally` releases it on every path, so no input can poison the slot.
 * A bad input still returns the same typed error; a concurrent call still gets
 * 'already-running'.
 */
export async function handleExportVariant(
  evt: { sender: { send: (channel: string, ...args: unknown[]) => void } },
  summary: SkeletonSummary,
  s: number,
  parentDir: string,
  overwrite: boolean,
  sharpenEnabled: boolean,
  outputMode: 'loose' | 'atlas' | 'both',
  atlasOpts: AtlasOpts,
  effectiveOverrides: ReadonlyMap<string, number> = new Map(),
  safetyBufferPercent: number = 0,
): Promise<ExportResponse> {
  if (variantExportInFlight) {
    return { ok: false, error: { kind: 'already-running', message: 'A variant export is already in progress.' } };
  }
  variantExportInFlight = true;
  try {
    return await exportOneVariant(
      evt,
      summary,
      s,
      parentDir,
      overwrite,
      sharpenEnabled,
      outputMode,
      atlasOpts,
      effectiveOverrides,
      safetyBufferPercent,
    );
  } finally {
    variantExportInFlight = false;
  }
}

/**
 * Phase 51 D-09 — one-way cancel entrypoint for the ipcMain.on('variant:cancelBatch')
 * handler. Keeps the flag module-private; the IPC layer flips it via this setter.
 */
export function setVariantBatchCancelRequested(): void {
  variantBatchCancelRequested = true;
}

/**
 * Phase 51 EXPORT-04 — fan one master out to N scales in one run (SC#1). Loops
 * exportOneVariant per scale under ONE outer re-entrancy claim. SC#2 is satisfied
 * BY CONSTRUCTION: each scale runs the same exportOneVariant body the single-scale
 * path runs. Continue-on-error (D-07): a per-variant failure rolls back ONLY that
 * variant's folder (its own written Set) and the loop continues. Between-variants
 * cancel (D-09): the flag is checked at the top of each iteration; on cancel the
 * remaining scales are recorded 'skipped' and the loop breaks (the in-flight
 * variant is never interrupted). Returns a per-folder result array (D-08); never
 * throws across the IPC boundary.
 */
export async function handleExportVariantBatch(
  evt: { sender: { send: (channel: string, ...args: unknown[]) => void } },
  summary: SkeletonSummary,
  scales: number[],
  parentDir: string,
  overwrite: boolean,
  sharpenEnabled: boolean,
  outputMode: 'loose' | 'atlas' | 'both',
  atlasOpts: AtlasOpts,
  effectiveOverrides: ReadonlyMap<string, number> = new Map(),
  safetyBufferPercent: number = 0,
): Promise<{ ok: true; results: BatchVariantResult[] }> {
  const results: BatchVariantResult[] = [];

  // Phase-51 follow-up — emit each per-variant result on the `variant:result`
  // channel as it lands, so the renderer can color the scale rows + summary rows
  // LIVE (green / amber / red) as the batch runs, not only when the whole run
  // returns. The full `results` array is still the return value (unchanged contract).
  const pushResult = (r: BatchVariantResult) => {
    results.push(r);
    try {
      evt.sender.send('variant:result', r);
    } catch {
      /* sender gone */
    }
  };

  // Defense-in-depth (RESEARCH §Q3): reject the whole batch if two scales collide
  // on the SAME normalized token (the renderer also blocks this pre-flight, D-10).
  const seen = new Map<string, number>();
  for (const s of scales) seen.set(formatScaleToken(s), (seen.get(formatScaleToken(s)) ?? 0) + 1);
  const collision = [...seen.entries()].find(([, n]) => n > 1);
  if (collision) {
    for (const s of scales) {
      pushResult({
        token: formatScaleToken(s),
        status: 'failed',
        reason: `Duplicate scale token @${collision[0]}x — two rows produce the same folder.`,
      });
    }
    return { ok: true, results };
  }

  if (variantExportInFlight) {
    for (const s of scales) {
      pushResult({
        token: formatScaleToken(s),
        status: 'failed',
        reason: 'A variant export is already in progress.',
      });
    }
    return { ok: true, results };
  }

  variantBatchCancelRequested = false; // Pitfall 5 — reset at batch start
  variantExportInFlight = true;
  try {
    for (let i = 0; i < scales.length; i++) {
      if (variantBatchCancelRequested) {
        // D-09 — record remaining scales as skipped, leave completed variants intact.
        for (let j = i; j < scales.length; j++) {
          pushResult({ token: formatScaleToken(scales[j]), status: 'skipped' });
        }
        break;
      }
      // Optional progress marker (consumed by the renderer's "variant N of M" prefix, 51-02).
      try {
        evt.sender.send('variant:batch-progress', {
          variantIndex: i,
          variantTotal: scales.length,
          token: formatScaleToken(scales[i]),
        });
      } catch {
        /* sender gone */
      }

      const res = await exportOneVariant(
        evt,
        summary,
        scales[i],
        parentDir,
        overwrite,
        sharpenEnabled,
        outputMode,
        atlasOpts,
        effectiveOverrides,
        safetyBufferPercent,
      );
      const token = formatScaleToken(scales[i]);
      if (res.ok) {
        pushResult({
          token,
          status: res.summary.errors.length > 0 ? 'exported-with-errors' : 'exported',
          successes: res.summary.successes,
          errors: res.summary.errors.length > 0 ? res.summary.errors : undefined,
        });
      } else {
        pushResult({ token, status: 'failed', reason: res.error.message });
      }
      // LOOP CONTINUES regardless of res.ok (D-07 continue-on-error) — no break, no rethrow.
    }
    return { ok: true, results };
  } finally {
    variantExportInFlight = false;
  }
}

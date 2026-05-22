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
  ExportResponse,
  ExportSummary,
  SkeletonSummary,
} from '../shared/types.js';

/**
 * Phase 49 D-02 — the ONE canonical scale-token helper. Renders the scale that
 * the `{NAME}@{s}x/` folder carries. JS number-to-string strips trailing zeros:
 * `String(0.5) === '0.5'`, `String(0.26) === '0.26'`. This is the single source
 * of truth for the token; Plan 03 references it BY NAME.
 *   CANONICAL CONTRACT: formatScaleToken(0.5) === '0.5'.
 */
export function formatScaleToken(s: number): string {
  return String(s);
}

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
  // 1. D-08 guard FIRST — at the export EDGE, NOT in core bake() (Phase-48 D-09
  //    preserved: bake stays direction-agnostic). Rejects NaN / <=0 / >=1.
  if (!Number.isFinite(s) || s <= 0 || s >= 1) {
    return { ok: false, error: { kind: 'Unknown', message: new VariantScaleError(s).message } };
  }

  // 2. Validate boundary inputs (mirror ipc.ts:763-765).
  if (typeof parentDir !== 'string' || parentDir.length === 0) {
    return { ok: false, error: { kind: 'Unknown', message: 'parentDir must be a non-empty string' } };
  }
  if (typeof summary?.skeletonPath !== 'string' || summary.skeletonPath.length === 0) {
    return { ok: false, error: { kind: 'Unknown', message: 'summary.skeletonPath must be a non-empty string' } };
  }

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
  const plan = buildExportPlan(scaleSummaryPeaks(summary, s), effectiveOverrides, {
    skeletonPath: summary.skeletonPath,
    safetyBufferPercent,
  });

  // 8. Source-collision guard (reuse the ipc.ts:809-827 logic). Reject when the
  //    outDir IS the source images dir. T-49-DIR + T-49-SRC. Skip on empty plan.
  if (plan.rows.length > 0) {
    const normalised = plan.rows[0].sourcePath.replace(/\\/g, '/');
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
    await writeSkeletonJsonAtomic(join(outDir, `${NAME}.json`), baked, written);

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

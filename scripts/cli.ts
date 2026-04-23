#!/usr/bin/env -S tsx
/**
 * Spine Texture Manager — Phase 0 CLI.
 *
 * Invocation:
 *   npm run cli -- <path/to/skeleton.json> [--hz 120]
 *
 * Prints a plain-text table with columns:
 *   Attachment | Skin | Source W×H | Peak W×H | Scale | Source Animation | Frame
 *
 * Exits 0 on success, non-zero on any loader error.
 *
 * This is a thin wrapper: it delegates loading to `src/core/loader.ts` and
 * peak sampling to `src/core/sampler.ts`. It does NOT reimplement any math or
 * reparse skeleton/atlas data. Column ordering and labels are locked per
 * 00-CONTEXT.md § "CLI Contract".
 *
 * Exit codes:
 *   0 — success (table printed)
 *   1 — unexpected error (not a SpineLoaderError subclass); prints stack to stderr
 *   2 — bad argv (missing path, unknown flag, invalid --hz value)
 *   3 — SpineLoaderError subclass (missing JSON, missing atlas, atlas parse error)
 */
import { loadSkeleton } from '../src/core/loader.js';
import {
  sampleSkeleton,
  DEFAULT_SAMPLING_HZ,
  type PeakRecord,
} from '../src/core/sampler.js';
import { SpineLoaderError } from '../src/core/errors.js';
import { analyze } from '../src/core/analyzer.js';

interface Args {
  skeletonPath: string;
  samplingHz: number;
  atlasPath?: string;
}

function parseArgs(argv: string[]): Args {
  // argv[0] = node binary, argv[1] = script path.
  // When invoked via `npm run cli -- foo.json`, npm forwards everything after
  // `--` to the script; `tsx` sets process.argv[2] to the first forwarded arg.
  const positional: string[] = [];
  let samplingHz = DEFAULT_SAMPLING_HZ;
  let atlasPath: string | undefined;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--hz' || a === '--samplingHz') {
      const v = argv[++i];
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`Invalid --hz value: ${v}`);
      }
      samplingHz = n;
    } else if (a === '--atlas') {
      const v = argv[++i];
      if (!v) throw new Error('Missing value for --atlas');
      atlasPath = v;
    } else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: npm run cli -- <path/to/skeleton.json> [--hz 120] [--atlas path/to/atlas]',
      );
      process.exit(0);
    } else if (!a.startsWith('-')) {
      positional.push(a);
    } else {
      throw new Error(`Unknown flag: ${a}`);
    }
  }
  if (positional.length !== 1) {
    throw new Error(
      'Usage: npm run cli -- <path/to/skeleton.json> [--hz 120] [--atlas path/to/atlas]',
    );
  }
  return { skeletonPath: positional[0], samplingHz, atlasPath };
}

function renderTable(peaks: Map<string, PeakRecord>): string {
  const rows: string[][] = [];
  rows.push([
    'Attachment',
    'Skin',
    'Source W×H',
    'Peak W×H',
    'Scale',
    'Source Animation',
    'Frame',
  ]);
  // Delegate fold + sort to src/core/analyzer.ts (D-33, D-34). `sorted` here
  // is DisplayRow[] — a superset of the prior PeakRecord shape; the
  // row-building loop below consumes the raw numeric fields and applies its
  // own .toFixed(1) / .toFixed(3) / String() formatters to preserve the CLI's
  // historical column format byte-for-byte. The preformatted label fields
  // produced by analyzer carry the panel's whole-pixel + trailing-×
  // divergent format (D-45/D-46) and MUST NOT be consumed here — doing so
  // would break monospace column alignment.
  const sorted = analyze(peaks);
  for (const rec of sorted) {
    const worldW = rec.worldW.toFixed(1);
    const worldH = rec.worldH.toFixed(1);
    rows.push([
      `${rec.slotName}/${rec.attachmentName}`,
      rec.skinName,
      `${rec.sourceW}×${rec.sourceH}`,
      `${worldW}×${worldH}`,
      rec.peakScale.toFixed(3),
      rec.animationName,
      String(rec.frame),
    ]);
  }

  // Compute column widths.
  const cols = rows[0].length;
  const widths = new Array<number>(cols).fill(0);
  for (const r of rows) {
    for (let c = 0; c < cols; c++) {
      if (r[c].length > widths[c]) widths[c] = r[c].length;
    }
  }

  // Two-space column separator (no pipes) — keeps output diff-friendly for the
  // smoke checker in plan 07.
  const pad = (s: string, w: number) => s + ' '.repeat(w - s.length);
  const out: string[] = [];
  out.push(rows[0].map((s, i) => pad(s, widths[i])).join('  '));
  out.push(widths.map((w) => '-'.repeat(w)).join('  '));
  for (let i = 1; i < rows.length; i++) {
    out.push(rows[i].map((s, j) => pad(s, widths[j])).join('  '));
  }
  return out.join('\n');
}

function main(): void {
  let args: Args;
  try {
    args = parseArgs(process.argv);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    process.exit(2);
  }

  try {
    const load = loadSkeleton(args.skeletonPath, {
      atlasPath: args.atlasPath,
    });
    const t0 = performance.now();
    const peaks = sampleSkeleton(load, { samplingHz: args.samplingHz });
    const elapsed = performance.now() - t0;

    process.stdout.write(renderTable(peaks) + '\n');
    process.stdout.write(
      `\nSampled in ${elapsed.toFixed(1)} ms at ${args.samplingHz} Hz ` +
        `(${peaks.size} attachments across ${load.skeletonData.skins.length} skins, ` +
        `${load.skeletonData.animations.length} animations)\n`,
    );
    process.exit(0);
  } catch (e) {
    if (e instanceof SpineLoaderError) {
      process.stderr.write(`${e.name}: ${e.message}\n`);
      process.exit(3);
    }
    process.stderr.write(`Unexpected error: ${(e as Error).stack ?? String(e)}\n`);
    process.exit(1);
  }
}

main();

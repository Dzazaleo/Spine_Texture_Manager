/**
 * Shared IPC types for the Phase 1 Electron shell.
 *
 * These shapes are the contracts crossing the main ↔ preload ↔ renderer
 * boundary. Consumed by `src/main/*`, `src/preload/*`, `src/renderer/*`.
 *
 * Only plain primitives, arrays, and nested plain objects live here — every
 * value is structuredClone-safe (no Map, no Float32Array, no class instances).
 * If you add a field backed by a class from `@esotericsoftware/spine-core`,
 * flatten it in `src/main/summary.ts` before returning from IPC.
 *
 * D-21 locks SkeletonSummary; D-22/D-35 lock the flat row shape exposed via
 * IPC as DisplayRow, keyed off the sampler's per-attachment record. D-10 locks LoadResponse
 * + SerializableError; D-07 locks the Api interface exposed via contextBridge.
 *
 * These interfaces erase at compile time. No runtime code lives in this file.
 */

// Phase 20 D-01 — re-export the Documentation types + drift helper through
// the shared/types boundary so the renderer (which must NOT import from
// src/core/* directly per arch.spec.ts:19-34) can pull these through here.
import type { Documentation } from '../core/documentation.js';
export type {
  Documentation,
  AnimationTrackEntry,
  EventDescriptionEntry,
  BoneDescriptionEntry,
  SkinDescriptionEntry,
} from '../core/documentation.js';
// Phase 20 D-01 + drift policy — runtime re-exports so the renderer can
// access the constants/functions through the shared/types boundary.
export {
  DEFAULT_DOCUMENTATION,
  intersectDocumentationWithSummary,
  validateDocumentation,
} from '../core/documentation.js';

// Phase 20 D-21 — local type imports for the Api interface body below + the
// re-export so renderer consumers can pull these through shared/types.js
// without reaching into src/main/* directly.
import type { DocExportPayload, DocExportResponse } from '../main/doc-export.js';

/**
 * Flat, serializable row consumed by the renderer panel and (in raw-number
 * form) by the CLI. Produced by `src/core/analyzer.ts` from the sampler's
 * Map<string, per-attachment record>. Every field is a primitive — safe
 * to structuredClone across IPC. D-35 locks the 15 raw numeric/string/boolean
 * fields AND the 5 preformatted label fields; both live here because CLI
 * and panel format legitimately differ (CLI uses toFixed(1) for pixel
 * widths to align its monospace columns; the panel uses whole-pixel
 * toFixed(0) per D-46 and adds a trailing multiplication sign to the
 * scale per D-45).
 */
export interface DisplayRow {
  attachmentKey: string;
  skinName: string;
  slotName: string;
  attachmentName: string;
  animationName: string;
  time: number;
  frame: number;
  peakScaleX: number;
  peakScaleY: number;
  peakScale: number;
  worldW: number;
  worldH: number;
  sourceW: number;
  sourceH: number;
  isSetupPosePeak: boolean;
  originalSizeLabel: string;
  peakSizeLabel: string;
  scaleLabel: string;
  sourceLabel: string;
  frameLabel: string;
  /**
   * Phase 6 Plan 02 (D-108 + RESEARCH §Pattern 2) — Absolute path to the
   * source PNG on disk for this attachment's atlas region. Resolved by
   * `src/core/loader.ts` via the `<skeletonDir>/images/<regionName>.png`
   * convention. Empty string when the analyzer is invoked without a
   * sourcePaths map (e.g. scripts/cli.ts — Phase 5 D-102 byte-for-byte
   * lock; CLI does not need source paths).
   */
  sourcePath: string;
  /**
   * Phase 6 Gap-Fix #2 (2026-04-25 human-verify Step 1) — Atlas-page
   * extraction metadata for atlas-packed projects (e.g. Jokerman) where
   * per-region source PNGs do NOT exist on disk; instead each region's
   * pixels live INSIDE an atlas page PNG at coordinates from the .atlas
   * `bounds:` line.
   *
   * Populated by src/core/loader.ts from each TextureAtlasRegion:
   *   - pagePath: absolute path to the atlas page PNG
   *     (`<skeletonDir>/<page.name>`)
   *   - x, y: top-left coords inside the page
   *   - w, h: SOURCE dims (originalWidth/originalHeight; for rotated
   *     regions the packed-bounds W/H are swapped vs source so we use
   *     orig dims here and let consumers branch on `rotated`)
   *   - rotated: true when region.degrees !== 0 (typically 90°). The
   *     image-worker emits `'rotated-region-unsupported'` for rotated
   *     regions rather than silently producing 90°-wrong output.
   *
   * Optional — undefined when the analyzer is invoked without an
   * atlasSources map (CLI path, D-102 lock). The image-worker prefers
   * sourcePath if it exists on disk; only falls back to atlasSource
   * when the per-region PNG is missing (atlas-only fixtures).
   *
   * All fields primitive — structuredClone-safe per file-top D-21 lock.
   */
  atlasSource?: {
    pagePath: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotated: boolean;
  };
}

/**
 * Phase 3 Plan 01 — Row shape consumed by the per-animation cards.
 *
 * Extends DisplayRow with the two Bone Path fields required by F4.3. All
 * fields primitive — structuredClone-safe. Preformatted in src/core/analyzer.ts;
 * renderer does zero formatting.
 *
 * Extending DisplayRow means the existing dedup-by-attachment-name helper in
 * analyzer.ts can operate on either shape via a single generic parameter —
 * the comparator reads only attachmentName + peakScale + skinName + slotName,
 * all present on both row types.
 *
 * frameLabel is the em-dash character (U+2014) on setup-pose rows per D-60;
 * `String(frame)` on animation rows per D-57. Preformatted so the renderer
 * never branches on isSetupPose for this column.
 */
export interface BreakdownRow extends DisplayRow {
  /** Raw bone chain: [rootName, ...ancestorNames, slotBoneName, slotName, attachmentName]. */
  bonePath: string[];
  /** Preformatted bone-chain label using U+2192 (right arrow) space-flanked separator. */
  bonePathLabel: string;
}

/**
 * Phase 3 Plan 01 — A single card in the Animation Breakdown panel.
 *
 * Emitted in card order per D-58: static-pose card FIRST (cardId === 'setup-pose'),
 * then one card per animation in skeletonData.animations order
 * (cardId === `anim:${animationName}`). Empty `rows` === the
 * "No assets referenced" renderer state (D-62).
 *
 * `uniqueAssetCount` === rows.length. Provided explicitly so the renderer's
 * collapsed-header string doesn't need to read rows.length.
 */
export interface AnimationBreakdown {
  cardId: string;
  animationName: string;
  isSetupPose: boolean;
  uniqueAssetCount: number;
  rows: BreakdownRow[];
}

/**
 * Phase 5 Plan 01 — A single attachment flagged as unused.
 *
 * An attachment is "unused" when its name appears in at least one
 * skin.attachments map in skeletonData.skins but the sampler's
 * globalPeaks contains no entry with that attachment name (D-92). The
 * sampler's visibility predicate (slot.color.a > 0 at >= 1 sampled tick)
 * is the source of truth — Phase 5 does not duplicate the check.
 *
 * Keyed by attachmentName per D-96 (name-level aggregation — one row per
 * unique texture name, regardless of how many skins register it).
 * sourceW/H are MAX across all registering skins per D-98. definedIn
 * lists every skin whose attachments map contains the name, preserved
 * in skin-iteration (JSON parse) order — NOT sorted (Pitfall 7 of
 * 05-RESEARCH.md).
 *
 * All fields primitive / arrays of primitives — structuredClone-safe
 * per the file-top docblock D-21 lock.
 */
export interface UnusedAttachment {
  /** Primary identifier — unique across the returned array (D-96). */
  attachmentName: string;
  /** Max source width across all registering skins (D-98). */
  sourceW: number;
  /** Max source height across all registering skins (D-98). */
  sourceH: number;
  /** Names of every skin whose attachments map contains this name, in skin-iteration order. */
  definedIn: string[];
  /** 1 if all registrations share dims, 2+ if any diverge (D-98). */
  dimVariantCount: number;
  /** Preformatted label (D-35 + D-45/D-46 reuse): "256×256" when dimVariantCount===1, "256×256 (N variants)" when >1. */
  sourceLabel: string;
  /** Preformatted comma-joined list of definedIn (e.g. "default, boy, girl"). */
  definedInLabel: string;
  /**
   * Phase 19 UI-04 (D-13) — On-disk byte size of the source PNG for this
   * unused attachment. Populated main-side in summary.ts via fs.statSync
   * against load.sourcePaths.get(attachmentName). Absent (or 0) when the
   * source path is missing OR resolves to a shared atlas page rather than
   * a per-region PNG (D-15 atlas-packed projects — unused regions in a
   * shared atlas don't reduce file size unless the atlas is repacked,
   * which Phase 6 Optimize doesn't do).
   *
   * OPTIONAL field (`?` modifier): src/core/usage.ts stays 100% untouched
   * (Layer 3 invariant — core does no file I/O); summary.ts (allowed file
   * I/O) is the SOLE writer. Renderer reads with `(u.bytesOnDisk ?? 0)`
   * fallback. Absence ≡ 0.
   *
   * Primitive number — structuredClone-safe per file-top D-21 lock.
   */
  bytesOnDisk?: number;
}

/**
 * Phase 6 Plan 02 — One row of the export plan, deduped per atlas region
 * source PNG path (D-108). attachmentNames carries every attachment that
 * resolved to this region for traceability — does not affect the resize
 * itself (one ExportRow → one resize → one output PNG per D-108).
 *
 * outPath is ABSOLUTE (RESEARCH §Open Question 2 recommendation) — main
 * process performs no further path resolution; deterministic for
 * path-traversal defense at the boundary (Threat-model-lite + D-122).
 *
 * effectiveScale is the SAME on both axes (D-110 uniform — anisotropic
 * export breaks Spine UV sampling; locked memory).
 *
 * All fields primitive — structuredClone-safe per the file-top docblock
 * D-21 lock.
 */
export interface ExportRow {
  sourcePath: string;
  outPath: string;
  sourceW: number;
  sourceH: number;
  outW: number;
  outH: number;
  effectiveScale: number;
  attachmentNames: string[];
  /**
   * Phase 6 Gap-Fix #2 (2026-04-25 human-verify Step 1) — atlas-page
   * extraction metadata for atlas-packed projects. Threaded through
   * from the winning DisplayRow.atlasSource. Optional — undefined for
   * projects with per-region PNGs on disk (loader populates atlasSources
   * for all regions, but the field only matters when sourcePath misses
   * pre-flight in src/main/image-worker.ts).
   *
   * The image-worker prefers sourcePath if it exists on disk; only
   * falls back to atlasSource when the per-region PNG is missing
   * (atlas-only projects). Rotated regions emit
   * 'rotated-region-unsupported' rather than silent corruption.
   *
   * All fields primitive — structuredClone-safe per file-top D-21 lock.
   */
  atlasSource?: {
    pagePath: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotated: boolean;
  };
}

/**
 * Phase 6 Plan 02 — Result of buildExportPlan(summary, overrides).
 * excludedUnused lists attachment names dropped by D-109 default
 * (unused-by-sampler attachments are not exported).
 */
export interface ExportPlan {
  rows: ExportRow[];
  excludedUnused: string[];
  totals: { count: number };
}

/**
 * Phase 6 Plan 02 — Per-file error surfaced via the export:progress channel
 * and aggregated in ExportSummary.errors. kind is the discriminator:
 *   - 'missing-source': fs.access pre-flight failed AND no atlasSource
 *     fallback was available (D-112).
 *   - 'sharp-error':    sharp/libvips threw during resize/encode.
 *   - 'write-error':    fs.rename failed OR path-traversal defense rejected.
 *   - 'rotated-region-unsupported': Gap-Fix #2 (2026-04-25) — atlas-only
 *     fallback was triggered but the region is rotated (region.degrees
 *     !== 0). First-pass refuses to attempt the rotated extract; user
 *     must re-export from Spine with rotation disabled or wait for a
 *     follow-up phase to add rotation handling.
 *   - 'overwrite-source': Gap-Fix Round 2 (2026-04-25) — refusing to
 *     overwrite a source PNG or atlas page. Surfaced both at the IPC
 *     pre-flight layer (fail-fast before claiming the in-flight slot) AND
 *     by the image-worker per-row defense-in-depth check, which catches
 *     the same condition if any future code path bypasses the IPC guard.
 *     Reproduction case: user picks the SKELETON folder as outDir while
 *     source PNGs live in `<skeletonDir>/images/`; the row's resolved
 *     output equals its source path. Without the guard this would
 *     silently destroy source images in place.
 *
 *     Gap-Fix Round 3 (2026-04-25): the per-row check at both layers is
 *     now GATED on the renderer-driven `overwrite` flag. The renderer
 *     probes via api.probeExportConflicts and, if conflicts are present,
 *     mounts a ConflictDialog whose "Overwrite all" branch calls
 *     startExport(overwrite=true). Layer A (ipc) and Layer B (worker)
 *     both bypass the collision check when overwrite=true; otherwise
 *     they still emit 'overwrite-source' (defense-in-depth for any
 *     caller that bypasses the renderer flow).
 */
export interface ExportError {
  kind: 'missing-source' | 'sharp-error' | 'write-error' | 'rotated-region-unsupported' | 'overwrite-source';
  path: string;
  message: string;
}

/**
 * Phase 6 Plan 02 — Streaming progress event sent main → renderer once
 * per file completion via webContents.send('export:progress', event).
 * D-119: no batching, no throttling — sequential cadence is the natural
 * throttle. All fields primitive — structuredClone-safe.
 */
export interface ExportProgressEvent {
  index: number;
  total: number;
  path: string;
  outPath: string;
  status: 'success' | 'error';
  error?: ExportError;
}

/**
 * Phase 6 Plan 02 — Final result of runExport, returned via the
 * 'export:start' IPC handler envelope (ExportResponse below).
 * cancelled === true when the user invoked api.cancelExport mid-run
 * and the loop bailed cooperatively (D-115).
 */
export interface ExportSummary {
  successes: number;
  errors: ExportError[];
  outputDir: string;
  durationMs: number;
  cancelled: boolean;
}

/**
 * Phase 6 Plan 02 — Discriminated-union envelope for 'export:start',
 * mirrors LoadResponse pattern (D-10). 'already-running' rejected by
 * the re-entrancy guard (D-115); 'invalid-out-dir' by the F8.4 / D-122
 * defense (outDir cannot equal source/images or be a child of it).
 *
 * Gap-Fix Round 2 (2026-04-25) — 'overwrite-source' added: pre-flight
 * per-row collision detection rejects an export whose resolved output
 * path would land ON any row's source PNG or atlas page. Catches the
 * "user picked the parent of source-images folder" case that the
 * 'invalid-out-dir' guard structurally cannot detect (the parent of
 * `images/` is OUTSIDE `images/`, so the prefix check passes — but
 * the per-row write `<outDir>/images/<region>.png` lands ON the source).
 *
 * Gap-Fix Round 3 (2026-04-25) — `conflicts?` added to the
 * 'overwrite-source' branch. The renderer now drives a probe-then-confirm
 * UX (api.probeExportConflicts → ConflictDialog → startExport(overwrite=true)).
 * Defense-in-depth: handleStartExport with `overwrite=false` re-runs the
 * probe and returns the same conflicts list so any caller that bypasses
 * the renderer flow still sees the precise list, not just a count.
 */
export type ExportResponse =
  | { ok: true; summary: ExportSummary }
  | {
      ok: false;
      error:
        | { kind: 'already-running' | 'invalid-out-dir' | 'Unknown'; message: string }
        | { kind: 'overwrite-source'; message: string; conflicts?: string[] };
    };

/**
 * Phase 6 Gap-Fix Round 3 (2026-04-25) — Result of the pre-start probe
 * RPC `'export:probe-conflicts'`. The renderer calls this BEFORE
 * startExport so it can mount a ConflictDialog listing the exact files
 * that would be overwritten and offer Cancel / Pick-different-folder /
 * Overwrite-all. `conflicts` is the deduped, sorted list of absolute
 * paths that already exist at the resolved output (per-region source,
 * atlas page, or any pre-existing PNG sitting at the resolved output).
 *
 * Empty list === safe to start without a confirmation modal.
 *
 * The `ok: false` branch covers shape-validation failures (bad plan,
 * non-string outDir) and the hard-reject case `outDir IS the
 * source-images folder itself` — that case is NEVER offered as a
 * confirmation prompt because every output would collide; the user
 * has to pick a different folder regardless.
 */
export type ProbeConflictsResponse =
  | { ok: true; conflicts: string[] }
  | { ok: false; error: { kind: 'invalid-out-dir' | 'Unknown'; message: string } };

/**
 * Phase 7 — Atlas Preview projection types (D-124..D-132 + D-137).
 *
 * AtlasPreviewInput: per-region input fed to the maxrects-packer. Folds
 *   sourceW/H + outW/H so a single derive function emits one input list
 *   per mode (D-124 / D-125). atlasSource (optional) carries the page-PNG
 *   srcRect coords for atlas-packed projects (D-126 + RESEARCH amendment
 *   to D-133 — pixels load via app-image:// not file://).
 *
 * PackedRegion: post-pack rect with hit-test coords + drawing metadata
 *   (sourcePath / atlasSource for the renderer's drawImage call).
 *   sourceMissing: optional flag set lazily by the renderer when
 *   <img>.onerror fires (D-137).
 *
 * AtlasPage: one bin from the packer, with derived per-page metrics.
 *   efficiency = sum(rect.w × rect.h) / (bin.width × bin.height) × 100
 *   (D-128 — F7.2 reframed per D-127 as page-count delta + per-page efficiency,
 *   no bytes shown).
 *
 * AtlasPreviewProjection: the top-level snapshot — one per (mode × maxPageDim)
 *   combination. totalPages is pages.length (denormalized for the modal's
 *   stepper card display).
 *
 * All fields primitive / arrays of primitives / nested plain objects —
 * structuredClone-safe per the file-top D-21 lock. atlasSource shape mirrors
 * DisplayRow.atlasSource (lines 85-92) and ExportRow.atlasSource (lines 213-220)
 * for consistency — DO NOT extract a named type (precedent is duplication).
 */
export interface AtlasPreviewInput {
  attachmentName: string;
  sourceW: number;
  sourceH: number;
  outW: number;
  outH: number;
  /** Width fed to the packer (= sourceW for 'original' mode, outW for 'optimized'). */
  packW: number;
  /** Height fed to the packer (= sourceH for 'original' mode, outH for 'optimized'). */
  packH: number;
  sourcePath: string;
  atlasSource?: {
    pagePath: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotated: boolean;
  };
}

export interface PackedRegion {
  attachmentName: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sourcePath: string;
  atlasSource?: {
    pagePath: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotated: boolean;
  };
  /** Lazily set by the renderer when <img>.onerror fires (D-137). */
  sourceMissing?: boolean;
}

export interface AtlasPage {
  pageIndex: number;
  width: number;
  height: number;
  regions: PackedRegion[];
  usedPixels: number;
  totalPixels: number;
  /** sum(rect.w × rect.h) / (bin.width × bin.height) × 100 (0..100). */
  efficiency: number;
}

export interface AtlasPreviewProjection {
  mode: 'original' | 'optimized';
  maxPageDim: 2048 | 4096;
  pages: AtlasPage[];
  totalPages: number;
  /**
   * Attachments whose packed dims exceed `maxPageDim` on either axis. These are
   * filtered out of the packer (D-139 follow-up: an oversize region would
   * otherwise force the packer to expand the bin and let the renderer's
   * fixed-frame canvas crop or distort it). Renderer surfaces these as a
   * warning banner. Empty array when all attachments fit.
   */
  oversize: string[];
}

/**
 * The IPC return payload from `'skeleton:load'` — the full summary needed
 * to render the panel header + table without recomputing anything.
 */
export interface SkeletonSummary {
  /** Absolute path of the loaded skeleton JSON. */
  skeletonPath: string;
  /** Absolute path of the loaded atlas. */
  atlasPath: string;
  bones: { count: number; names: string[] };
  slots: { count: number };
  /** Count + per-class-name bucket (e.g. {RegionAttachment: 3, MeshAttachment: 1}). */
  attachments: { count: number; byType: Record<string, number> };
  skins: { count: number; names: string[] };
  animations: { count: number; names: string[] };
  /**
   * Phase 20 D-09 — auto-discovery source for the documentation events
   * sub-section. Populated from `skeletonData.events` (spine-core EventData[])
   * in src/main/summary.ts.
   */
  events: { count: number; names: string[] };
  /** Sorted by (skinName, slotName, attachmentName) — matches CLI byte-for-byte. */
  peaks: DisplayRow[];
  /** Phase 3: static-pose card first (cardId === 'setup-pose'), then one card per animation in JSON order. */
  animationBreakdown: AnimationBreakdown[];
  /**
   * Phase 5: attachments registered in skins but never rendered (F6.1, D-92, D-101).
   *
   * Optional in Plan 01 (Wave 0 scaffold) so the node-project typecheck stays
   * clean while `src/main/summary.ts` has not yet been wired by Plan 02. The
   * summary.spec.ts F6.2 test still locks the field-shape contract at runtime
   * (Array.isArray + structuredClone round-trip) — that test is RED in Plan 01
   * and flips GREEN when Plan 02 lands. Plan 02 MAY promote this to required
   * at the same time it wires the write site.
   */
  unusedAttachments?: UnusedAttachment[];
  /** `loadSkeleton + sampleSkeleton` wall-clock time in ms. */
  elapsedMs: number;
  /**
   * Phase 9 Plan 06 — editor dopesheet metadata from `skeletonData.fps`
   * (loader.ts:225-229: `editorFps = skeletonData.fps || 30`).
   *
   * INFORMATIONAL ONLY. Sampling uses `samplingHz` (default 120 Hz per
   * CLAUDE.md fact #6), NOT this field. Surfaced through the summary so
   * the rig-info tooltip can display it with the explicit wording
   * "(editor metadata — does not affect sampling)" — load-bearing per
   * CLAUDE.md fact #1 + the canonical comment block at
   * src/core/sampler.ts:41-44.
   */
  editorFps: number;
}

/**
 * Phase 8.1 D-158 — Discriminated-union typed-error envelope.
 *
 * The `'SkeletonNotFoundOnLoadError'` kind carries the cached recovery
 * payload (D-149 chain) — `projectPath`, `originalSkeletonPath`,
 * `mergedOverrides`, `samplingHz`, `lastOutDir`, `sortColumn`, `sortDir`.
 * These fields are populated by `handleProjectOpenFromPath` in
 * `src/main/project-io.ts` from the `materialized` object already in
 * scope at the rescue branch, and consumed by both
 * `AppShell.onClickOpen` (toolbar Open / Cmd+O recovery path — D-160)
 * AND by `App.tsx`'s new `projectLoadFailed` state branch (drag-drop
 * recovery path — D-161/D-162).
 *
 * All other kinds keep their existing `{kind, message}` shape — every
 * `kind` literal MUST match a `SpineLoaderError` subclass `.name` string
 * in `src/core/errors.ts` byte-for-byte (the IPC handler uses `err.name`
 * as the discriminator). Information-disclosure mitigation T-01-02-02
 * preserved: `message` carries `SpineLoaderError.message` only — never a
 * stack trace.
 *
 * D-171 invariant: this refactor is purely an in-memory IPC envelope
 * shape. The on-disk `.stmproj` v1 schema in `src/core/project-file.ts`
 * is NOT touched. `ProjectFileV1.documentation` (D-148), `version: 1`
 * (D-145), and every other on-disk field stay byte-identical. Existing
 * `.stmproj` files written by Phase 8 continue to load through Phase 8.1
 * unchanged.
 */
export type SerializableError =
  | {
      kind: 'SkeletonNotFoundOnLoadError';
      message: string;
      // Cached recovery payload — fed to handleProjectReloadWithSkeleton
      // when the user picks a replacement skeleton (D-149 chain).
      projectPath: string;
      originalSkeletonPath: string;
      mergedOverrides: Record<string, number>;
      samplingHz: number;
      lastOutDir: string | null;
      sortColumn: string | null;
      sortDir: 'asc' | 'desc' | null;
    }
  | {
      kind:
        | 'SkeletonJsonNotFoundError'
        | 'AtlasNotFoundError'
        | 'AtlasParseError'
        | 'MissingImagesDirError'          // Phase 21 (LOAD-01): atlas-less catastrophic case
        | 'ProjectFileNotFoundError'      // Phase 8 D-149: file missing on disk
        | 'ProjectFileParseError'          // Phase 8 Pitfall 9: JSON.parse SyntaxError
        | 'ProjectFileVersionTooNewError'  // Phase 8 D-151: version > 1
        | 'Unknown';
      message: string;
    }
  | {
      // Phase 12 / Plan 05 (D-21) — F3 Spine version guard.
      // Carries `detectedVersion` as an extra typed field beyond `message` so
      // the renderer/CLI can show the version separately if useful (the
      // existing `message` already echoes it, but the dedicated field keeps
      // narrowing precise for future UI surfaces). The IPC forwarder at
      // src/main/ipc.ts populates this field from
      // (err as SpineVersionUnsupportedError).detectedVersion.
      kind: 'SpineVersionUnsupportedError';
      message: string;
      detectedVersion: string;
    };

/** Discriminated-union result returned from `ipcMain.handle('skeleton:load', ...)`. */
export type LoadResponse =
  | { ok: true; summary: SkeletonSummary }
  | { ok: false; error: SerializableError };

/**
 * Phase 9 Plan 02 D-193 + D-194 — Sampler-worker postMessage protocol.
 *
 * Worker → main: discriminated union of progress / complete / cancelled / error.
 * Main → worker: cancel-only.
 * workerData: path-based input — the worker re-loads the JSON inside the worker
 * process so SkeletonData (with its circular refs and class-instance prototypes)
 * NEVER crosses the postMessage boundary (Pitfall 4: structured-clone strips
 * prototypes from class instances).
 *
 * SamplerOutput's globalPeaks is a Map<string, PeakRecord>; PeakRecord is a plain
 * interface with primitives only (sampler.ts:97-100, 119-123). Maps are explicitly
 * structured-clone-able per the algorithm spec, so the COMPUTED output crosses
 * postMessage cleanly even though the INPUT SkeletonData cannot.
 *
 * NOTE on the SamplerOutput type: tsconfig.web.json excludes src/core/**, so
 * the shared types module cannot directly `import type { SamplerOutput } from
 * '../core/sampler.js'` (the renderer would compile against a missing source
 * file). The worker payload is consumed ONLY by main-process code (the
 * sampler-worker bridge re-routes the output into project-io's existing
 * SkeletonSummary path; the renderer only sees the SkeletonSummary, not the
 * SamplerOutput Map). We therefore declare an opaque structural alias here —
 * `unknown` is too loose for the bridge to typecheck cleanly, so we use a
 * minimal Map shape that matches the real SamplerOutput's `globalPeaks /
 * perAnimation / setupPosePeaks` triple. The main-side code that consumes
 * this payload casts to the real `SamplerOutput` from sampler.ts at the
 * usage site (worker file, bridge file).
 */
export interface SamplerOutputShape {
  /** Map<string, PeakRecord> — Phase 2 globalPeaks (sampler.ts:120). */
  globalPeaks: Map<string, unknown>;
  /** Map<string, PeakRecord> — Phase 3 D-54 per-animation peaks. */
  perAnimation: Map<string, unknown>;
  /** Map<string, PeakRecord> — Phase 3 D-60 setup-pose-only peaks. */
  setupPosePeaks: Map<string, unknown>;
}

export type SamplerWorkerOutbound =
  | { type: 'progress'; percent: number }
  | { type: 'complete'; output: SamplerOutputShape }
  | { type: 'cancelled' }
  | { type: 'error'; error: SerializableError };

export type SamplerWorkerInbound = { type: 'cancel' };

export interface SamplerWorkerData {
  skeletonPath: string;
  atlasRoot?: string;
  samplingHz: number;
}

/**
 * Phase 8 — .stmproj v1 schema (D-145..D-156).
 *
 * Persisted to disk as JSON. structuredClone-safe by construction: only
 * primitives, plain objects, and nested Records — no Map, no class instances.
 * Maps live ONLY in renderer/main memory; the IPC + on-disk shape uses
 * Record<string, number> for `overrides` (Pitfall 3 boundary conversion).
 *
 * Required fields per D-145: version, skeletonPath, overrides, documentation.
 * All other fields are nullable; Load treats null as "use default".
 */
export interface ProjectFileV1 {
  version: 1;
  skeletonPath: string;
  atlasPath: string | null;
  imagesDir: string | null;
  overrides: Record<string, number>;
  samplingHz: number | null;
  lastOutDir: string | null;
  sortColumn: string | null;
  sortDir: 'asc' | 'desc' | null;
  // Phase 20 D-01 — typed via core/documentation.ts (was reserved object in Phase 8 D-148).
  documentation: Documentation;
}

export type ProjectFile = ProjectFileV1;

/**
 * AppSessionState — the editable session shape AppShell hands to saveProject /
 * saveProjectAs. Same as ProjectFileV1 minus `version` (stamped by
 * serializeProjectFile in src/core/project-file.ts). `documentation` is now
 * part of the editable session per Phase 20 D-01 (was reserved-only in Phase 8).
 */
export interface AppSessionState {
  skeletonPath: string;
  atlasPath: string | null;
  imagesDir: string | null;
  overrides: Record<string, number>;
  samplingHz: number | null;
  lastOutDir: string | null;
  sortColumn: string | null;
  sortDir: 'asc' | 'desc' | null;
  // Phase 20 D-01 — drives serializeProjectFile :254
  documentation: Documentation;
}

/**
 * Phase 8 — Open response payload. Built by main/project-io.ts after re-sampling
 * the resolved skeleton. `restoredOverrides` is INTERSECTED with the re-sampled
 * peaks (D-150) — `staleOverrideKeys` lists names that were dropped.
 */
export interface MaterializedProject {
  summary: SkeletonSummary;
  restoredOverrides: Record<string, number>;
  staleOverrideKeys: string[];
  samplingHz: number;
  lastOutDir: string | null;
  sortColumn: string | null;
  sortDir: 'asc' | 'desc' | null;
  projectFilePath: string;
  // Phase 20 D-01 — typed documentation slot threaded through to the renderer
  // on Open / locate-skeleton recovery. Drift policy (D-09 / D-10 / D-11)
  // is applied renderer-side in AppShell via intersectDocumentationWithSummary.
  documentation: Documentation;
}

export type SaveResponse =
  | { ok: true; path: string }
  | { ok: false; error: SerializableError };

export type OpenResponse =
  | { ok: true; project: MaterializedProject }
  | { ok: false; error: SerializableError };

/**
 * Phase 9 Plan 06 — Re-sample arguments for the `'project:resample'` IPC.
 *
 * Triggered by the renderer when the user changes `samplingHz` in
 * SettingsDialog (RESEARCH §Pitfall 7). Carries the renderer's already-
 * validated session state (overrides + paths + sort + lastOutDir +
 * projectFilePath) so main can re-run loader → sampler-worker →
 * buildSummary → stale-key intersect and return a fresh
 * MaterializedProject.
 *
 * All fields primitive (Record<string, number> for overrides — Pitfall 3
 * boundary: renderer converts its Map to Record before crossing IPC). The
 * shape mirrors the subset of MaterializedProject the renderer holds in
 * memory after a successful Open, plus the new `samplingHz` value.
 */
export interface ResampleArgs {
  skeletonPath: string;
  /**
   * Optional — when undefined, the loader's F1.2 sibling auto-discovery
   * applies (D-152). Renderer typically passes `summary.atlasPath`.
   */
  atlasPath?: string;
  /** New sampling rate. Main re-validates as positive integer. */
  samplingHz: number;
  /**
   * Current overrides from AppShell's overrides Map, converted via
   * Object.fromEntries. Main re-intersects against the new sampler peaks
   * (D-150 stale-key drop), so the renderer doesn't need to pre-filter.
   */
  overrides: Record<string, number>;
  /** Optional metadata round-tripped into MaterializedProject (no behavioral effect). */
  lastOutDir?: string | null;
  sortColumn?: string | null;
  sortDir?: 'asc' | 'desc' | null;
  projectFilePath?: string | null;
}

export type LocateSkeletonResponse =
  | { ok: true; newPath: string }
  | { ok: false };

/**
 * The contextBridge-exposed `window.api` surface.
 *
 * `loadSkeletonFromFile` takes the raw drag-drop `File` object and resolves
 * its filesystem path in the preload via `webUtils.getPathForFile(file)`
 * before invoking `ipcRenderer.invoke('skeleton:load', path)`.
 *
 * See Plan 01-03 for the preload implementation — which applies the
 * RESEARCH Finding #1 mechanism update to D-09 (file.path was removed
 * in Electron 32; we target Electron 41).
 */
export interface Api {
  loadSkeletonFromFile: (file: File) => Promise<LoadResponse>;
  /**
   * Phase 6 Plan 05 — Open OS folder picker (Electron dialog.showOpenDialog).
   * Returns the chosen absolute path or null if user cancels. defaultPath
   * is honored on macOS + Windows per D-122 (`<skeletonDir>/images-optimized/`).
   */
  pickOutputDirectory: (defaultPath?: string) => Promise<string | null>;
  /**
   * Phase 6 Plan 05 — Run export. Resolves with ExportResponse envelope
   * when the export completes, is cancelled, or is rejected (re-entrant /
   * invalid-out-dir). Per-file progress arrives on the separate
   * onExportProgress subscription channel.
   *
   * Gap-Fix Round 3 (2026-04-25) — `overwrite` flag: when omitted or
   * false (the safe default), main re-runs the conflict probe as a
   * defense-in-depth check and rejects with `'overwrite-source'` if
   * any files would be overwritten. When the renderer has already
   * shown the ConflictDialog and the user clicked "Overwrite all", it
   * passes `overwrite=true` and main bypasses the per-row collision
   * check (the worker also gates its defense-in-depth check on this).
   * The hard-reject case (outDir IS source-images-dir) cannot be
   * rescued by `overwrite=true`.
   */
  startExport: (
    plan: ExportPlan,
    outDir: string,
    overwrite?: boolean,
  ) => Promise<ExportResponse>;
  /**
   * Phase 6 Gap-Fix Round 3 (2026-04-25) — Pre-start conflict probe.
   * The renderer calls this BEFORE startExport so it can mount a
   * ConflictDialog listing exact files that would be overwritten,
   * offering Cancel / Pick-different-folder / Overwrite-all. Empty
   * conflicts list === safe to start without a confirmation modal.
   * No re-entrancy guard mutation; safe to call repeatedly.
   */
  probeExportConflicts: (
    plan: ExportPlan,
    outDir: string,
  ) => Promise<ProbeConflictsResponse>;
  /**
   * Phase 6 Plan 05 — One-way cancel signal. Fire-and-forget. The next
   * progress event the renderer receives will be the final one and
   * startExport() resolves with summary.cancelled === true.
   */
  cancelExport: () => void;
  /**
   * Phase 6 Plan 05 — Subscribe to streaming export progress events.
   * Returns an unsubscribe function. Implementation detail: the wrapped
   * listener reference is captured in a local const so removeListener
   * targets the same reference (RESEARCH §Pitfall 9).
   */
  onExportProgress: (handler: (e: ExportProgressEvent) => void) => () => void;
  /**
   * Phase 6 Plan 05 — Open Finder/Explorer at the output directory after
   * a completed export (Electron shell.showItemInFolder). One-way.
   */
  openOutputFolder: (dir: string) => void;
  // Phase 8 — project file IPC surface (D-140..D-156).
  saveProject: (state: AppSessionState, currentPath: string | null) => Promise<SaveResponse>;
  saveProjectAs: (state: AppSessionState, defaultDir: string, defaultBasename: string) => Promise<SaveResponse>;
  openProject: () => Promise<OpenResponse>;
  openProjectFromFile: (file: File) => Promise<OpenResponse>;
  openProjectFromPath: (absolutePath: string) => Promise<OpenResponse>;
  locateSkeleton: (originalPath: string) => Promise<LocateSkeletonResponse>;
  /**
   * Phase 8 D-149 recovery (Approach A). Called by AppShell AFTER locateSkeleton
   * resolves with a user-picked .json path. Args carry the cached overrides + settings
   * from the failed Open; main re-runs loader + sampler + buildSummary against the
   * new skeleton and returns OpenResponse so AppShell mounts via the same code path
   * used for Open.
   */
  reloadProjectWithSkeleton: (args: {
    projectPath: string;
    newSkeletonPath: string;
    mergedOverrides: Record<string, number>;
    samplingHz?: number;
    lastOutDir?: string | null;
    sortColumn?: string | null;
    sortDir?: 'asc' | 'desc' | null;
  }) => Promise<OpenResponse>;
  onCheckDirtyBeforeQuit: (handler: () => void) => () => void;
  confirmQuitProceed: () => void;

  // Phase 8.2 D-175 / D-181 — menu surface bridges.

  /**
   * Phase 8.2 D-181 — push derived menu state to main; main rebuilds and
   * reapplies the application Menu on every notify (modalOpen, canSave,
   * canSaveAs).
   */
  notifyMenuState: (state: { canSave: boolean; canSaveAs: boolean; modalOpen: boolean }) => void;

  /** Phase 8.2 D-175 — subscribe to menu File→Open click. */
  onMenuOpen: (cb: () => void) => () => void;

  /** Phase 8.2 D-175 — subscribe to menu File→Open Recent → <path> click. */
  onMenuOpenRecent: (cb: (path: string) => void) => () => void;

  /** Phase 8.2 D-175 — subscribe to menu File→Save click. */
  onMenuSave: (cb: () => void) => () => void;

  /** Phase 8.2 D-175 — subscribe to menu File→Save As… click. */
  onMenuSaveAs: (cb: () => void) => () => void;

  // Phase 9 Plan 02 D-194 — sampler progress + cancel bridges.

  /**
   * Subscribe to streaming sampler progress events. Returns an unsubscribe
   * function. Pitfall 9 listener-identity preservation (mirrors
   * onExportProgress at preload/index.ts:126-132).
   *
   * Progress is INDETERMINATE per RESEARCH §Q4: percent is 0 on start and
   * 100 on complete; intermediate values do not arrive because the byte-frozen
   * sampler has no inner-loop emit point. The renderer SHOULD show an
   * indeterminate spinner, not a determinate progress bar.
   */
  onSamplerProgress: (handler: (percent: number) => void) => () => void;

  /**
   * Fire-and-forget cancel signal. Main routes this to
   * `samplerWorkerHandle?.terminate()` (RESEARCH §Q5: terminate() is the
   * actual cancellation mechanism since the byte-frozen sampler has no
   * inner-loop flag-check point).
   */
  cancelSampler: () => void;

  // -------------------------------------------------------------------------
  // Phase 9 Plan 05 — Settings + Help menu surfaces (Claude's Discretion +
  // RESEARCH §Q6 + 08.2 D-188). Three new bridges:
  //   - onMenuSettings: subscribe to Edit→Preferences… click
  //   - onMenuHelp: subscribe to Help→Documentation click
  //   - openExternalUrl: open an external URL in the system browser
  //     (validated against a closed allow-list in main — T-09-05-OPEN-EXTERNAL).
  // Plan 06 (Settings + tooltip) and Plan 07 (Help dialog) consume these
  // without further changes to the shared Api surface.
  // -------------------------------------------------------------------------

  /**
   * Phase 9 Plan 05 — subscribe to menu Edit→Preferences… click. Returns
   * unsubscribe. Pitfall 9 listener-identity preservation (mirrors onMenuOpen
   * at preload/index.ts:269-275).
   */
  onMenuSettings: (cb: () => void) => () => void;

  /**
   * Phase 9 Plan 05 — subscribe to menu Help→Documentation click. Returns
   * unsubscribe. Pitfall 9 listener-identity preservation (mirrors onMenuOpen
   * at preload/index.ts:269-275).
   */
  onMenuHelp: (cb: () => void) => () => void;

  /**
   * Phase 9 Plan 05 — open an external URL in the system browser
   * (shell.openExternal). One-way fire-and-forget. Main validates the URL
   * against a hardcoded allow-list (T-09-05-OPEN-EXTERNAL); non-allow-listed
   * URLs are silently rejected as defense in depth even though the contextBridge
   * surface limits exposure to the trusted renderer.
   *
   * Renderer-side callers (HelpDialog) MUST pass only static, hardcoded URLs
   * that match the main-process allow-list. Add new entries by editing
   * SHELL_OPEN_EXTERNAL_ALLOWED in src/main/ipc.ts.
   */
  openExternalUrl: (url: string) => void;

  /**
   * Phase 9 Plan 06 — Re-sample an already-loaded project with a new
   * `samplingHz`. The user-facing trigger is SettingsDialog's Apply button
   * (RESEARCH §Pitfall 7: changing `samplingHz` MUST re-sample so the
   * displayed peaks reflect the new rate). Main re-runs the loader +
   * sampler-worker + buildSummary + stale-override intersect chain and
   * returns the standard OpenResponse envelope so the renderer mounts via
   * the same code path used for Open.
   *
   * Trust boundary: see ResampleArgs JSDoc above. Main re-validates types
   * (skeletonPath ends in .json, samplingHz is a positive integer,
   * overrides is a Record). Defense in depth — the renderer already
   * holds these values from the prior Open success.
   */
  resampleProject: (args: ResampleArgs) => Promise<OpenResponse>;

  // -------------------------------------------------------------------------
  // Phase 12 Plan 01 — auto-update bridges (UPD-01..UPD-06).
  //
  // Five subscribe methods (Pitfall 9 listener-identity preservation in
  // src/preload/index.ts) + four invoke/send methods. Main is the single
  // source of truth for the variant routing (D-04 Windows-fallback): the
  // renderer never derives 'auto-update' vs 'manual-download' from
  // process.platform — it consumes the variant field as supplied by main.
  // -------------------------------------------------------------------------

  /** UPD-02 — Help → Check for Updates manual trigger. Resolves when checkUpdate completes. */
  checkForUpdates: () => Promise<void>;

  /**
   * Phase 14 D-03 — late-mount pending-update re-delivery.
   *
   * Renderer App.tsx calls this ONCE on mount in the lifted update-subscription
   * useEffect (Plan 03). Main returns the sticky 'update-available' payload
   * (overwritten on each newer version; cleared on dismiss/download), or null
   * on first launch / no pending update.
   *
   * Handles the edge case where main fires 'update-available' BEFORE the
   * renderer's React effect commits (e.g. the 3.5s startup check resolves
   * before React hydration finishes — root cause of UPDFIX-03's "no startup
   * notification" symptom on shipped v1.1.1).
   *
   * One-shot invoke (no subscription, no Pitfall 9 listener-identity scaffold).
   * The slot lives in main-process module state per D-Discretion-2 (in-memory
   * only for v1.1.2 hotfix scope).
   */
  requestPendingUpdate: () => Promise<{
    version: string;
    summary: string;
    variant: 'auto-update' | 'manual-download';
    fullReleaseUrl: string;
  } | null>;

  /** UPD-03 — UpdateDialog "Download + Restart" click. Opt-in download. */
  downloadUpdate: () => Promise<void>;

  /** D-08 — UpdateDialog "Later" click. Persists dismissedUpdateVersion. One-way. */
  dismissUpdate: (version: string) => void;

  /** UPD-04 — UpdateDialog "Restart" click after download. One-way; main defers via setTimeout(0). */
  quitAndInstallUpdate: () => void;

  /** UPD-04 — subscribe to 'update:available'. Returns unsubscribe (Pitfall 9). */
  onUpdateAvailable: (
    cb: (payload: {
      version: string;
      summary: string;
      variant?: 'auto-update' | 'manual-download';
      fullReleaseUrl: string;
    }) => void,
  ) => () => void;

  /** UPD-04 — subscribe to 'update:downloaded'. Returns unsubscribe. */
  onUpdateDownloaded: (cb: (payload: { version: string }) => void) => () => void;

  /** UPD-02 — subscribe to 'update:none'. Renderer filters by manualCheckPendingRef. */
  onUpdateNone: (cb: (payload: { currentVersion: string }) => void) => () => void;

  /** UPD-02 — subscribe to 'update:error'. Renderer filters by manualCheckPendingRef. */
  onUpdateError: (cb: (payload: { message: string }) => void) => () => void;

  /** D-07 — subscribe to Help → Check for Updates menu click. Returns unsubscribe. */
  onMenuCheckForUpdates: (cb: () => void) => () => void;

  /**
   * Phase 12 Plan 06 (D-16.3) — subscribe to Help → Installation Guide… menu
   * click. Returns unsubscribe. Renderer (AppShell) calls openExternalUrl
   * with the INSTALL.md URL on fire; URL routes through
   * SHELL_OPEN_EXTERNAL_ALLOWED allow-list. Pitfall 9 listener-identity
   * preservation lives in src/preload/index.ts.
   */
  onMenuInstallationGuide: (cb: () => void) => () => void;

  // -------------------------------------------------------------------------
  // Phase 12 Plan 03 (D-19) — F1 atlas-image URL bridge.
  //
  // Returns Promise<string> resolving to a well-formed `app-image://localhost/<pathname>`
  // URL. Main-process (privileged) `pathToFileURL` constructs the URL so the
  // Windows drive-letter glue bug (`'localhostc/'` 404) cannot recur.
  //
  // Renderer Layer-3 invariant: never construct `app-image://` URLs by string
  // concat — always go through this bridge so cross-platform path semantics
  // live in the single main-side handler (RESEARCH §F1 audit verified
  // AtlasPreviewModal.tsx:116 was the only renderer site doing the
  // bug-prone concat; that call site is rewritten to await this bridge).
  // -------------------------------------------------------------------------
  pathToImageUrl: (absolutePath: string) => Promise<string>;

  // -------------------------------------------------------------------------
  // Phase 20 D-21 — Documentation HTML export.
  //
  // Resolves with DocExportResponse: { ok: true; path } on success, or
  // { ok: false; error: { kind: 'Unknown'; message } } on cancel / fs error.
  // Main owns the save dialog + atomic write; the renderer (DocumentationBuilderDialog
  // ExportPane) only constructs the structured-clone-safe payload at click time.
  // Round-trip identity for the documentation slot itself is gated by
  // tests/core/documentation-roundtrip.spec.ts (DOC-05).
  // -------------------------------------------------------------------------
  exportDocumentationHtml: (payload: DocExportPayload) => Promise<DocExportResponse>;
}

/**
 * Phase 20 D-21 — Re-export the doc-export IPC contract through shared/types.ts
 * so the renderer can import these types without breaching the Layer 3 grep gate
 * (renderer never imports from src/main/* directly). Type-only re-export — no
 * runtime crossing.
 */
export type { DocExportPayload, DocExportResponse } from '../main/doc-export.js';

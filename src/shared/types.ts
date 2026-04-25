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
 *   - 'missing-source': fs.access pre-flight failed (D-112).
 *   - 'sharp-error':    sharp/libvips threw during resize/encode.
 *   - 'write-error':    fs.rename failed OR path-traversal defense rejected.
 */
export interface ExportError {
  kind: 'missing-source' | 'sharp-error' | 'write-error';
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
 */
export type ExportResponse =
  | { ok: true; summary: ExportSummary }
  | { ok: false; error: { kind: 'already-running' | 'invalid-out-dir' | 'Unknown'; message: string } };

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
}

/**
 * Typed-error envelope for IPC failure paths.
 *
 * `kind` values MUST match `SpineLoaderError` subclass `.name` strings in
 * `src/core/errors.ts` byte-for-byte. If you rename a loader error class,
 * update this literal union in the same commit — the IPC handler uses
 * `err.name` as the discriminator.
 *
 * `message` is the user-facing text from `SpineLoaderError.message`. Never
 * contains a stack trace (T-01-02-02 information-disclosure mitigation).
 */
export interface SerializableError {
  kind: 'SkeletonJsonNotFoundError' | 'AtlasNotFoundError' | 'AtlasParseError' | 'Unknown';
  message: string;
}

/** Discriminated-union result returned from `ipcMain.handle('skeleton:load', ...)`. */
export type LoadResponse =
  | { ok: true; summary: SkeletonSummary }
  | { ok: false; error: SerializableError };

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
   */
  startExport: (plan: ExportPlan, outDir: string) => Promise<ExportResponse>;
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
}

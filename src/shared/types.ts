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
}

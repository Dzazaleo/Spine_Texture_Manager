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
 * D-21 locks SkeletonSummary; D-22 locks PeakRecordSerializable as the flat
 * mirror of `PeakRecord` from `src/core/sampler.ts`. D-10 locks LoadResponse
 * + SerializableError; D-07 locks the Api interface exposed via contextBridge.
 *
 * These interfaces erase at compile time. No runtime code lives in this file.
 */

/**
 * Flat, serializable mirror of `PeakRecord` from `src/core/sampler.ts`.
 * Every field is a primitive — safe to `structuredClone` across IPC.
 * Field set must stay byte-for-byte identical to PeakRecord minus class internals.
 */
export interface PeakRecordSerializable {
  /** Composite key: `${skin}/${slot}/${attachment}`. */
  attachmentKey: string;
  skinName: string;
  slotName: string;
  attachmentName: string;
  /** `"Setup Pose (Default)"` for setup-pose pass; animation name otherwise. */
  animationName: string;
  /** Seconds since animation start (Spine's authoritative unit). */
  time: number;
  /** `round(time * editorFps)` — informational only. */
  frame: number;
  peakScaleX: number;
  peakScaleY: number;
  /** `max(peakScaleX, peakScaleY)`. */
  peakScale: number;
  worldW: number;
  worldH: number;
  sourceW: number;
  sourceH: number;
  /** True if no animation timeline touched this attachment; scale from setup pose. */
  isSetupPosePeak: boolean;
}

/**
 * The IPC return payload from `'skeleton:load'` — the full summary needed
 * to render DebugPanel header + table without recomputing anything.
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
  peaks: PeakRecordSerializable[];
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

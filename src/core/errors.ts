/**
 * Typed error classes for the headless loader.
 *
 * Rationale (F1.4): callers — especially the CLI — format user-facing output
 * from structured errors. Throwing plain `Error` loses the `path` / `searchedPath`
 * fields that the CLI needs to print "expected atlas at: …" messages cleanly,
 * and makes `instanceof` checks in tests unreliable.
 *
 * All loader errors extend `SpineLoaderError` so callers can `catch` the root
 * class when they don't care which specific failure occurred.
 */

export class SpineLoaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpineLoaderError';
  }
}

export class SkeletonJsonNotFoundError extends SpineLoaderError {
  constructor(public readonly path: string) {
    super(`Spine skeleton JSON not found or not readable: ${path}`);
    this.name = 'SkeletonJsonNotFoundError';
  }
}

export class AtlasNotFoundError extends SpineLoaderError {
  constructor(
    public readonly searchedPath: string,
    public readonly skeletonPath: string,
  ) {
    // Gap-Fix Round 2 (2026-04-25) — Bug #5: expanded message explains WHY
    // the atlas is required. The original "No atlas file found" was
    // technically correct but did not tell the user that a Spine project
    // needs the .atlas alongside the .json (the skeleton JSON alone does
    // NOT carry region metadata — only attachment names and bone
    // references). Users dragging a bare .json without re-exporting from
    // the Spine editor with the atlas included would see a cryptic
    // failure; the new message points them at the correct fix.
    //
    // Class + .name + searchedPath + skeletonPath are unchanged — only
    // the human message is expanded so existing tests that assert on the
    // class / name / typed fields continue to pass byte-for-byte.
    super(
      `Spine projects require an .atlas file beside the .json (carries region metadata that the skeleton JSON alone does not have). ` +
        `Re-export from the Spine editor with the atlas included.\n` +
        `  Skeleton: ${skeletonPath}\n  Expected atlas at: ${searchedPath}`,
    );
    this.name = 'AtlasNotFoundError';
  }
}

export class AtlasParseError extends SpineLoaderError {
  constructor(public readonly atlasPath: string, cause: unknown) {
    super(
      `Failed to parse atlas: ${atlasPath}\n  Cause: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = 'AtlasParseError';
  }
}

/**
 * Phase 12 / Plan 05 (D-21) — F3 Spine version guard.
 *
 * Spine version below 4.2 detected at loader-time. The app's sampler is
 * built against spine-core 4.2.x; loading 3.x and earlier silently produces
 * zero-output runs (Phase 11 §F3 in
 * `.planning/phases/11-ci-release-pipeline-github-actions-draft-release/11-WIN-FINDINGS.md`).
 * CLAUDE.md documents 4.2+ as the hard requirement; this class makes the
 * runtime check enforce the doc with an actionable, structured message.
 *
 * Lenient on 4.3+ per CONTEXT.md Deferred ("4.3+ is not silently rejected,
 * but it's also not actively supported"); the predicate at
 * `src/core/loader.ts checkSpineVersion` only throws when major.minor < 4.2.
 *
 * Two-field constructor template mirrors AtlasNotFoundError above —
 * `.name = 'SpineVersionUnsupportedError'` is critical because the IPC
 * forwarder at `src/main/ipc.ts` routes by `err.name` against KNOWN_KINDS.
 */
export class SpineVersionUnsupportedError extends SpineLoaderError {
  constructor(
    public readonly detectedVersion: string,
    public readonly skeletonPath: string,
  ) {
    super(
      `This file was exported from Spine ${detectedVersion}. ` +
        `Spine Texture Manager requires Spine 4.2 or later. ` +
        `Re-export from Spine 4.2 or later in the editor.`,
    );
    this.name = 'SpineVersionUnsupportedError';
  }
}

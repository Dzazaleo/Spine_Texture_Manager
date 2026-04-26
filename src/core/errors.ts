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

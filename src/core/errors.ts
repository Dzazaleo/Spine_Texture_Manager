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
    super(
      `No atlas file found beside skeleton JSON.\n  Skeleton: ${skeletonPath}\n  Expected atlas at: ${searchedPath}`,
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

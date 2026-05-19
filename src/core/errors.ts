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
    // Phase 24 D-12 — added toggle tip sentence per 24-UI-SPEC.md copywriting
    // contract: users can bypass the atlas requirement by enabling the
    // images-folder toggle in the toolbar and reloading. Class + .name +
    // searchedPath + skeletonPath are unchanged — only the human message
    // is expanded so existing tests that assert on the class / name /
    // typed fields continue to pass byte-for-byte.
    super(
      `Spine projects require an .atlas file beside the .json (carries region metadata that the skeleton JSON alone does not have). ` +
        `Re-export from the Spine editor with the atlas included, or enable the "Use Images Folder as Source" toggle in the toolbar and reload.\n` +
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
 * Phase 44 (DISP-02, D-10) — 2-branch → 3-branch. The loader no longer
 * rejects 4.3 (it ROUTES via resolveRuntimeTag). debug-fix
 * spine-43-beta-appliedpose-null (2026-05-19) — 3-branch → 4-branch (adds
 * `prerelease`). Constructor classifies `detectedVersion` into FOUR message
 * branches:
 *   - `ge44`          : (major===4 ∧ minor>=4) OR major>=5 — the NEW typed
 *                       reject arm for a future/unsupported export.
 *                       [LOCKED D-10 wording — verbatim]
 *   - `prerelease`    : the `'prerelease:<version>'` sentinel from
 *                       resolveRuntimeTag — an IN-BAND (4.2.x/4.3.x) export
 *                       carrying a semver pre-release suffix (`4.3.91-beta`,
 *                       `4.2.0-rc.1`). A non-stable Spine editor build can
 *                       author a structurally-invalid rig (e.g. a
 *                       root-targeting parentless-IK constraint) that the
 *                       SHIPPED spine-core stable runtime dereferences
 *                       unconditionally and throws `null.appliedPose` on at
 *                       the first updateWorldTransform — previously surfacing
 *                       as the opaque `Unknown:` toast. [actionable
 *                       re-export-from-stable wording]
 *   - `contradiction` : the `'4.3-schema'` sentinel. Post-Phase-44 it reaches
 *                       this constructor ONLY via the resolveRuntimeTag
 *                       token=4.2 + top-level constraints[] CONTRADICTION
 *                       path — a "4.2-stamped-but-4.3-shaped" reject, NOT a
 *                       "re-export as 4.2" advisory. [discretion wording]
 *   - `unsupported`   : <4.2 / 'unknown' / malformed. [LOCKED — the legacy
 *                       Phase-12 F3 <4.2 message PRESERVED VERBATIM]
 * The old "re-export as 4.2 (supported downgrade)" string is REMOVED — it is
 * now wrong for 4.3 (4.3 routes) and unreachable. 4.3.x is UNREACHABLE here
 * as a reject (it routes); defensively it lands in `unsupported` and must NOT
 * emit the deleted string.
 *
 * Two-field constructor template mirrors AtlasNotFoundError above —
 * `.name = 'SpineVersionUnsupportedError'` is critical because the IPC
 * forwarder at `src/main/ipc.ts` routes by `err.name` against KNOWN_KINDS;
 * `.name` + the `detectedVersion`/`skeletonPath` readonly fields stay
 * byte-identical (no new error class — this EXTENDS the discriminated-union
 * member). NOTE: for the `prerelease` branch `detectedVersion` retains the
 * `'prerelease:<version>'` sentinel form; the renderer displays `.message`
 * (App.tsx:751), not `.detectedVersion`, so the sentinel prefix is never
 * user-visible. Programmatic consumers that want the raw token can strip
 * the `prerelease:` prefix.
 */
export class SpineVersionUnsupportedError extends SpineLoaderError {
  constructor(
    public readonly detectedVersion: string,
    public readonly skeletonPath: string,
  ) {
    // Phase 44 (D-10) — 3-way classification (was a 2-way isSpine43OrLater).
    // debug-fix spine-43-beta-appliedpose-null (2026-05-19) — 4-way (adds
    // 'prerelease').
    // '4.3-schema' sentinel: now reaches this constructor ONLY via the
    //   resolveRuntimeTag token=4.2 + top-level constraints[] CONTRADICTION
    //   path (loader.ts) — a "4.2-stamped but 4.3-shaped" reject, NOT a
    //   "re-export as 4.2" advisory.
    // 'prerelease:<version>' sentinel: reaches this constructor ONLY via the
    //   resolveRuntimeTag in-band pre-release arm (loader.ts) — an
    //   otherwise-supported 4.2.x/4.3.x core stamped from a NON-STABLE
    //   Spine editor build.
    let kind: 'ge44' | 'prerelease' | 'contradiction' | 'unsupported';
    let prereleaseToken = '';
    if (detectedVersion === '4.3-schema') {
      kind = 'contradiction';
    } else if (detectedVersion.startsWith('prerelease:')) {
      kind = 'prerelease';
      prereleaseToken = detectedVersion.slice('prerelease:'.length);
    } else {
      const m = detectedVersion.match(/^(\d+)\.(\d+)/);
      const major = m ? parseInt(m[1], 10) : NaN;
      const minor = m ? parseInt(m[2], 10) : NaN;
      if (
        !Number.isNaN(major) &&
        !Number.isNaN(minor) &&
        ((major === 4 && minor >= 4) || major >= 5)
      ) {
        kind = 'ge44';
      } else {
        // <4.2 / 'unknown' / malformed. (4.3.x is UNREACHABLE here as a
        // reject — it routes; defensively it lands in 'unsupported' and
        // must NOT emit the old "re-export as 4.2" string, now deleted.)
        kind = 'unsupported';
      }
    }
    const message =
      kind === 'ge44'
        ? // [LOCKED D-10 — verbatim]
          `This file is from Spine ${detectedVersion}. This app supports Spine 4.2 and 4.3. Re-export as Version 4.3 (or 4.2) and try again.`
        : kind === 'prerelease'
          ? // [debug-fix spine-43-beta-appliedpose-null — actionable
            // re-export-from-stable wording; echoes the actual beta token]
            `This file was exported from a Spine pre-release build (${prereleaseToken}). ` +
            `Spine Texture Manager supports stable Spine 4.2 and 4.3 releases only. ` +
            `Pre-release editor builds can produce rigs that the stable runtime cannot process. ` +
            `Re-export this project from a stable Spine 4.3 (or 4.2) release and try again.`
          : kind === 'contradiction'
            ? // [planner's discretion per D-10 — a 4.2-stamped-but-4.3-shaped
              // reject; NOT "re-export as 4.2"]
              `This file is stamped Spine 4.2 but contains a Spine 4.3 constraints[] schema. Re-export it cleanly as Version 4.2 or Version 4.3 and try again.`
            : // [LOCKED — existing <4.2 wording PRESERVED VERBATIM]
              `This file was exported from Spine ${detectedVersion}. ` +
              `Spine Texture Manager requires Spine 4.2 or later. ` +
              `Re-export from Spine 4.2 or later in the editor.`;
    super(message);
    this.name = 'SpineVersionUnsupportedError';
  }
}

/**
 * Phase 21 (LOAD-01) — Atlas-less mode catastrophic case (D-10, D-11).
 *
 * Thrown by `src/core/synthetic-atlas.ts` when the atlas-less code path
 * cannot synthesize an atlas because the `images/` folder is absent OR
 * the folder exists but every per-region PNG read failed. Per D-09,
 * partial-images cases (some PNGs present, some missing) silently skip
 * the missing ones — this error is the all-or-nothing failure surface.
 *
 * Two-field constructor mirrors AtlasNotFoundError (D-10 explicit). The
 * optional third arg `missingPngs` carries the full list of expected-but-
 * missing PNG paths for D-11 ("error message lists ALL missing PNGs"); the
 * IPC envelope only carries the human-formatted message string, so the
 * structured field is for programmatic consumers (tests, future audit
 * tooling) only.
 *
 * `.name = 'MissingImagesDirError'` is LOAD-BEARING — `src/main/ipc.ts`
 * KNOWN_KINDS Set routes by `err.name` against the SerializableError
 * union. Phase 21 Plan 02 wires both sides; without the wiring the
 * error surfaces as `kind: 'Unknown'`.
 */
export class MissingImagesDirError extends SpineLoaderError {
  constructor(
    public readonly searchedPath: string,
    public readonly skeletonPath: string,
    public readonly missingPngs?: string[],
  ) {
    const trail =
      missingPngs && missingPngs.length > 0
        ? `\n  Missing PNGs:\n${missingPngs.map((p) => '    ' + p).join('\n')}`
        : '';
    super(
      `Atlas-less mode requires an images/ folder beside the .json with per-region PNG files. ` +
        `Either provide a .atlas file or populate images/ with the referenced PNGs.\n` +
        `  Skeleton: ${skeletonPath}\n  Searched: ${searchedPath}${trail}`,
    );
    this.name = 'MissingImagesDirError';
  }
}

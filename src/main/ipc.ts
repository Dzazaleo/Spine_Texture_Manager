/**
 * Phase 1 Plan 02 — IPC handler for `'skeleton:load'`.
 * Phase 6 Plan 05 — Extended with export channels (dialog:pick-output-dir,
 *   export:start, export:cancel, shell:open-folder) + module-level
 *   re-entrancy / cancel state. handleSkeletonLoad is preserved untouched.
 *
 * Two original exports (Phase 1):
 *   - `handleSkeletonLoad(jsonPath)` — pure async function wrapping
 *     `loadSkeleton` + `sampleSkeleton` + `buildSummary`; testable in vitest
 *     without spinning up Electron.
 *   - `registerIpcHandlers()` — wires `handleSkeletonLoad` into
 *     `ipcMain.handle('skeleton:load', ...)`. Called once in
 *     `app.whenReady()` from `src/main/index.ts`.
 *
 * Phase 6 additions:
 *   - `handlePickOutputDirectory(defaultPath?)` — F8.1 + D-122 folder picker.
 *   - `handleStartExport(evt, plan, outDir)` — D-115 / D-122 / F8.4 export
 *     start, with re-entrancy guard, outDir validation, cooperative cancel
 *     callback, and one-way 'export:progress' emission via evt.sender.send.
 *   - Module-level `exportInFlight` + `exportCancelFlag` flags.
 *   - registerIpcHandlers wires 4 new channels (2 invoke + 2 send).
 *
 * Typed-error envelope (D-10): `SpineLoaderError` subclasses are caught and
 * translated to `{ok: false, error: {kind, message}}` discriminated union.
 * Unknown errors fall through to `kind: 'Unknown'` with the error message —
 * we deliberately surface only name + message; stack-trace fields are never
 * included (T-01-02-02 information-disclosure mitigation). The same pattern
 * applies to ExportResponse (Phase 6 D-10 inheritance).
 *
 * Input validation (T-01-02-01): jsonPath / outDir / plan shape validated at
 * the trust boundary. Renderer-origin arguments cross a trust boundary — the
 * checks are cheap and prevent pathological inputs from reaching `fs` / sharp.
 *
 * Imports from `../core/*.js` are allowed only because this file lives in
 * `src/main/` — the renderer is structurally prevented from reaching here
 * by the tsconfig.web.json / electron.vite.config.ts / tests/arch.spec.ts
 * three-layer defense (CLAUDE.md Fact #5).
 */
import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  access,
  constants as fsConstants,
  rm as fsRm,
  readdir,
  readFile,
} from 'node:fs/promises';
import { loadSkeleton } from '../core/loader.js';
import { sampleSkeleton } from '../core/sampler.js';
// Phase 41 VIEWER-03 — atlas-less synth-atlas materialization for the
// Animation Viewer. The renderer is forbidden from importing core/*
// (tests/arch.spec.ts:19-34); main re-runs the synthesizer on demand and
// ships the result via the new viewer:get-asset-feed IPC handler below.
import { synthesizeAtlasText } from '../core/synthetic-atlas.js';
import { SpineLoaderError, SpineVersionUnsupportedError } from '../core/errors.js';
import { buildSummary } from './summary.js';
import { runExport } from './image-worker.js';
// Phase 40 D-04a — atlas-mode dispatch target. runRepack orchestrates the
// sharp resize → emits-truth read-back → pack → composite → atlas-write
// pipeline (REPACK-01/03/05/10). The IPC handler below threads a shared
// writtenPaths Set<string> across runExport + runRepack so the finally-
// block can fs.rm-sweep every artifact on any throw — the atomic-or-fail
// rollback contract from RESEARCH §Landmines #7+#8.
import { runRepack, type AtlasOpts } from './repack-worker.js';
// Phase 49 EXPORT-01 — the single-scale variant export orchestrator. A NEW
// channel (variant:export) delegates here; handleStartExport / export:start are
// byte-untouched (D-04 "shipped Optimize flow untouched").
import {
  handleExportVariant,
  handleExportVariantBatch,
  setVariantBatchCancelRequested,
} from './variant-export.js';
// UAT Round 3 (2026-05-15) — shared atlas-target derivation. probe and
// runRepack MUST agree byte-for-byte on filenames or the probe is moot.
import { deriveProjectName, pageFilename } from './atlas-paths.js';
import {
  handleProjectSave,
  handleProjectSaveAs,
  handleOpenDialog,
  handleProjectOpenFromPath,
  handleLocateSkeleton,
  handleProjectReloadWithSkeleton,
  handleProjectResample,
} from './project-io.js';
// Phase 20 D-21 — Documentation HTML export. The handler orchestrates
// dialog.showSaveDialog → renderDocumentationHtml → atomic write Pattern-B.
// renderDocumentationHtml is pure and tested standalone in
// tests/main/doc-export.spec.ts; this file only owns the IPC channel
// registration alongside the existing project:* handlers.
import { handleExportDocumentationHtml, type DocExportPayload } from './doc-export.js';
import { getSamplerWorkerHandle } from './sampler-worker-bridge.js';
// Phase 31 PLATFORM-01 — read-only accessor for the cached Windows-elevation
// flag populated at app.whenReady() in src/main/index.ts. The handler is a
// pure cached-boolean read (no I/O, no validation) — closest sibling shape
// to 'atlas:resolve-image-url' below. Layer 3 carve-out: elevation.ts owns
// the win32 platform branch + child_process.exec invocation; this file
// stays portability-clean (no platform branching here) per D-23.
import { getIsElevated } from './elevation.js';
// Phase 12 Plan 01 Task 4 — auto-update IPC bridge (UPD-01..UPD-06).
//
// auto-update.ts imports `getMainWindow` from `./index.js`, which means an
// eager `import { ... } from './auto-update.js'` here creates the same
// load-time cycle the Phase 8.2 menu-wiring already documents above
// (`ipc.ts → auto-update.ts → index.ts → recent.ts → app.getPath('userData')`).
// vitest specs that target handlers UNRELATED to auto-update (e.g.
// ipc-export.spec.ts) mock `electron` minimally and don't stub `protocol` /
// `app.getPath`, so eager evaluation aborts the spec before any test runs.
//
// We follow the established pattern: dynamic `await import('./auto-update.js')`
// inside the channel handlers below. The first call to any of the four
// auto-update channels triggers the module load on demand.
// Phase 8.2 D-181 — menu state surface lives in src/main/index.ts. We
// dereference applyMenu / setCurrentMenuState / getMainWindow via dynamic
// `await import('./index.js')` INSIDE the 'menu:notify-state' handler body
// rather than at module load time. Two reasons:
//   (a) `src/main/index.ts` imports `registerIpcHandlers` from this file —
//       eager `import { ... } from './index.js'` here creates a load-time
//       cycle. Node resolves it fine in production (the module graph
//       finishes before app.whenReady fires), but vitest's test files mock
//       `electron` minimally per-spec; test files that target
//       handlers UNRELATED to this menu wiring (e.g. ipc-export.spec.ts)
//       don't stub `app.getPath`, so the eager transitive load
//       `ipc.ts → index.ts → recent.ts → app.getPath('userData')` throws
//       at module-evaluation time and the spec aborts before any test runs.
//   (b) Dynamic `await import(...)` defers the index.ts module load until
//       the FIRST 'menu:notify-state' notify, so spec files that never
//       fire that channel can mock electron however they want without
//       paying the recent.ts module-load cost. ipc.spec.ts (this plan)
//       mocks recent.js + electron's app.getPath itself, so its tests
//       still see the import resolve cleanly.
import type {
  ExportPlan,
  ExportResponse,
  ExportSummary,
  LoadResponse,
  ProbeConflictsResponse,
  SerializableError,
  SkeletonSummary,
  ViewerAssetFeedResponse,
} from '../shared/types.js';

// Phase 8.1 D-158 — handleSkeletonLoad's SpineLoaderError forwarder produces
// only non-recovery error kinds. Excluding 'SkeletonNotFoundOnLoadError' here
// makes TypeScript verify the forwarder cannot accidentally produce the
// recovery-payload arm of the SerializableError union without populating its
// 7 threaded fields (see project-io.ts NonRecoveryKind for the parallel
// narrowing at the project-open rescue branches).
// Phase 12 Plan 05 (D-21) — F3 Spine version guard. Also exclude
// 'SpineVersionUnsupportedError': its envelope arm carries an extra typed
// field beyond `message` (`detectedVersion`); the dedicated branch in the
// catch clause below handles it BEFORE this generic kind-list arm fires.
// Excluding it here makes TypeScript verify the generic forwarder cannot
// accidentally produce the version-error arm without populating its
// `detectedVersion` field (which would be a runtime bug).
type KnownErrorKind = Exclude<
  SerializableError['kind'],
  'SkeletonNotFoundOnLoadError' | 'SpineVersionUnsupportedError'
>;

const KNOWN_KINDS: ReadonlySet<KnownErrorKind> = new Set<KnownErrorKind>([
  'SkeletonJsonNotFoundError',
  'AtlasNotFoundError',
  'AtlasParseError',
  'MissingImagesDirError',   // Phase 21 (LOAD-01) — atlas-less catastrophic case routes through this envelope arm
  // Phase 12 / Plan 05 (D-21) — F3 Spine version guard.
  // 'SpineVersionUnsupportedError' is INTENTIONALLY NOT in this Set —
  // it carries an extra typed field (`detectedVersion`) on its envelope
  // arm and is handled by the dedicated `instanceof
  // SpineVersionUnsupportedError` branch in the catch clause BEFORE this
  // generic kind-list arm fires. KnownErrorKind explicitly excludes it
  // (see the type alias above) so this Set is type-safe by construction.
]);

// ---------------------------------------------------------------------------
// Phase 6 Plan 05 — module-level state for re-entrancy guard + cancel flag.
// D-115: only one export in flight at a time. D-116 cancel-cooperative.
// Both flags reset to false on every successful entry to handleStartExport
// (the cancel flag is per-export-run; never sticky across runs). The cancel
// flag is also cleared in finally so a follow-up call after a thrown error
// is not silently pre-cancelled.
// ---------------------------------------------------------------------------
let exportInFlight = false;
let exportCancelFlag = false;

// ---------------------------------------------------------------------------
// Phase 9 Plan 05 T-09-05-OPEN-EXTERNAL — closed allow-list of URLs that
// the 'shell:open-external' handler will pass to shell.openExternal.
//
// Defense in depth: the contextBridge surface (window.api.openExternalUrl)
// only exposes the channel to the trusted renderer; this allow-list catches
// (a) accidental mistakes — typo'd URLs in HelpDialog source, and
// (b) any future renderer compromise that tries to inject arbitrary URLs.
// shell.openExternal with arbitrary user-controlled input is a documented
// Electron sandbox-escape vector (https://www.electronjs.org/docs/latest/
// tutorial/security) — never call it without an allow-list when the URL
// crosses an IPC boundary.
//
// Comparison is exact-string equality via Set.has — no prefix matching, no
// scheme-only checks, no trailing-slash leniency. To add a new entry, the
// HelpDialog author MUST update this Set verbatim with the URL the dialog
// hands to window.api.openExternalUrl. Mismatches are silently dropped (the
// channel is one-way; nothing to return).
//
// NEVER allow user-controlled (e.g., skeletonPath, projectPath) URLs in this
// list. The list is hardcoded at compile time on purpose.
// ---------------------------------------------------------------------------
const SHELL_OPEN_EXTERNAL_ALLOWED: ReadonlySet<string> = new Set<string>([
  // Spine documentation references that HelpDialog (Plan 07) links to.
  // These are the canonical Spine 4.2 docs the project's help content
  // points to per CONTEXT.md §"Documentation button" (Claude's Discretion).
  'https://esotericsoftware.com/spine-runtimes',
  'https://esotericsoftware.com/spine-api-reference',
  'https://en.esotericsoftware.com/spine-json-format',
  // Phase 12 Plan 01 (D-09 + D-18 option (b)) — the Releases _index_ page is
  // the stable URL surface for the UpdateDialog "View full release notes" link
  // AND the Windows-fallback "Open Release Page" button. We intentionally do
  // NOT add per-tag URLs (which would require pattern support); the user
  // navigates one click further to the specific release.
  'https://github.com/Dzazaleo/Spine_Texture_Manager/releases',
  // Phase 12 Plan 06 (D-16.4 + D-18 option b) — INSTALL.md URL on main is
  // the stable URL surface for the in-app "Installation Guide…" Help menu
  // item AND HelpDialog's "Install instructions" inline link. Same exact-
  // string allow-list pattern as the Releases-index URL; no regex/prefix.
  // The literal MUST match HelpDialog.tsx's INSTALL_DOC_URL constant and
  // AppShell.tsx's onMenuInstallationGuide handler argument byte-for-byte
  // (Set.has compares strings by value). Drift across the 3 surfaces is
  // gated by tests/integration/install-md.spec.ts URL-consistency check.
  'https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md',
]);

/**
 * Phase 16 D-04 — releases-URL structural allow-list helper.
 *
 * Returns `true` iff `url` is a well-formed https URL on the github.com host
 * targeting either:
 *   - The project's Releases index page
 *     (`/Dzazaleo/Spine_Texture_Manager/releases`), OR
 *   - A specific release tag page
 *     (`/Dzazaleo/Spine_Texture_Manager/releases/tag/v{version}`).
 *
 * Threat model — the structural check (URL-parse + hostname-equals +
 * pathname-prefix) defends against:
 *   - T-16-04-01 (URL-spoofing): naive `pathname.startsWith` without a
 *     hostname check would allow `https://github.com.attacker.com/Dzazaleo/...`
 *     because the malicious hostname has the project pathname as a substring.
 *     The exact-equals on `parsed.hostname` blocks this.
 *   - T-16-04-02 (subdomain-spoof): `https://attacker.github.com/...` blocked
 *     by exact-equals on hostname (NOT endsWith / includes).
 *   - T-16-04-03 (open-redirect via crafted info.version): malformed semver
 *     smuggled through `releases/tag/v${info.version}` — the helper does
 *     NOT execute or open the URL itself, only votes pass/reject. The
 *     pathname-prefix guard is permissive about the version segment shape
 *     because info.version is sourced from electron-updater (which itself
 *     parses a published release tag string); defense in depth here would
 *     be excessive vs. the parser at the source. If a malformed version
 *     reaches this code, the outcome is "URL opens but lands on a 404
 *     GitHub page" — not a privilege escalation.
 *   - T-16-04-04 (scheme-downgrade): non-https schemes blocked by exact-equals
 *     on `parsed.protocol`.
 *   - T-16-04-05 (parse failure): malformed URL strings (e.g. "not a url",
 *     "javascript:alert(1)", "") return false via the try/catch around
 *     `new URL`.
 *
 * @internal — exported for tests/integration/auto-update-shell-allow-list.spec.ts
 * (Plan 16-04 Task 1). Not part of the public src/main/ipc.ts API; do NOT
 * re-export from index modules.
 */
export function isReleasesUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.hostname !== 'github.com') return false;
  // Pathname check — accept the index page exactly, OR any release-tag page
  // under the project's namespace. The trailing-slash variant is rejected
  // for the index URL to keep byte-for-byte agreement with Plan 14-05's
  // URL-consistency regex (which asserts no trailing slash on the canonical
  // literal).
  if (parsed.pathname === '/Dzazaleo/Spine_Texture_Manager/releases') return true;
  if (parsed.pathname.startsWith('/Dzazaleo/Spine_Texture_Manager/releases/tag/v')) {
    // Pathname after the prefix must be a non-empty version segment with no
    // additional slashes (defensive: a `/releases/tag/v1.2.0/extra/path`
    // is NOT a release page on github.com — the actual GitHub URL shape
    // ends at the tag).
    const versionSegment = parsed.pathname.slice(
      '/Dzazaleo/Spine_Texture_Manager/releases/tag/v'.length,
    );
    if (versionSegment.length === 0) return false;
    if (versionSegment.includes('/')) return false;
    return true;
  }
  return false;
}

/**
 * Phase 6 REVIEW L-04 (2026-04-25) — the previous Round 2 helper
 * `isOutDirInsideSourceImages` (folder-position-only rejection) was
 * superseded by the Round 3+4 inline equality check + the F_OK probe in
 * `probeExportConflicts`. The dead helper + its `void`-call workaround
 * have been removed. If a future phase needs a structural folder-policy
 * check it can re-introduce the helper from git history; carrying it
 * live as `void`-suppressed dead code added maintenance burden and
 * risked confusing readers about the active contract.
 */

/**
 * Cheap shape validation for an ExportPlan crossing the trust boundary.
 * T-01-02-01 inheritance — renderer-origin args validated at the IPC
 * entry point. Returns null when valid, an error message string otherwise.
 *
 * Not exported — internal helper for handleStartExport.
 */
function validateExportPlan(plan: unknown): string | null {
  if (!plan || typeof plan !== 'object') return 'plan is not an object';
  const p = plan as { rows?: unknown; excludedUnused?: unknown; totals?: unknown; passthroughCopies?: unknown };
  if (!Array.isArray(p.rows)) return 'plan.rows is not an array';
  if (!Array.isArray(p.excludedUnused)) return 'plan.excludedUnused is not an array';
  if (!p.totals || typeof p.totals !== 'object') return 'plan.totals is not an object';
  // Phase 22.1 WR-005 — validate passthroughCopies added in Phase 22.1.
  // A missing or non-array field would cause a runtime TypeError in runExport
  // when the image-worker iterates it (T-01-02-01 trust-boundary contract).
  if (!Array.isArray(p.passthroughCopies)) return 'plan.passthroughCopies is not an array';
  for (let i = 0; i < p.rows.length; i++) {
    const r = p.rows[i] as Record<string, unknown>;
    if (
      typeof r.sourcePath !== 'string' || r.sourcePath.length === 0 ||
      typeof r.outPath !== 'string' || r.outPath.length === 0 ||
      typeof r.sourceW !== 'number' || typeof r.sourceH !== 'number' ||
      typeof r.outW !== 'number' || typeof r.outH !== 'number' ||
      typeof r.effectiveScale !== 'number' ||
      !Array.isArray(r.attachmentNames)
    ) {
      return `plan.rows[${i}] has invalid shape`;
    }
  }
  return null;
}

/**
 * Phase 40 D-04 — trust-boundary validator for the 2 new positional args
 * on `export:start` (outputMode, atlasOpts). Mirrors `validateExportPlan`
 * shape immediately above: returns `null` on success, a string error
 * message on failure. `handleStartExport` short-circuits on non-null
 * before claiming the exportInFlight slot.
 *
 * Validation rules (all 4 fields rejected by their literal-union types
 * + integer range):
 *   - outputMode: must be 'loose' | 'atlas' | 'both'
 *   - atlasOpts.maxPageSize: must be 1024 | 2048 | 4096 | 8192
 *   - atlasOpts.allowRotation: must be boolean
 *   - atlasOpts.padding: must be an integer in [0, 16]
 *
 * Not exported — internal helper for handleStartExport.
 */
function validateExportOpts(
  outputMode: unknown,
  atlasOpts: unknown,
): string | null {
  if (outputMode !== 'loose' && outputMode !== 'atlas' && outputMode !== 'both') {
    return "outputMode is not 'loose' | 'atlas' | 'both'";
  }
  if (!atlasOpts || typeof atlasOpts !== 'object') {
    return 'atlasOpts is not an object';
  }
  const ao = atlasOpts as {
    maxPageSize?: unknown;
    allowRotation?: unknown;
    padding?: unknown;
  };
  if (
    ao.maxPageSize !== 1024
    && ao.maxPageSize !== 2048
    && ao.maxPageSize !== 4096
    && ao.maxPageSize !== 8192
  ) {
    return 'atlasOpts.maxPageSize is not 1024 | 2048 | 4096 | 8192';
  }
  if (typeof ao.allowRotation !== 'boolean') {
    return 'atlasOpts.allowRotation is not boolean';
  }
  if (
    typeof ao.padding !== 'number'
    || !Number.isInteger(ao.padding)
    || ao.padding < 0
    || ao.padding > 16
  ) {
    return 'atlasOpts.padding is not an integer in [0, 16]';
  }
  return null;
}

/**
 * Phase 6 Gap-Fix Round 3 (2026-04-25) — Detects file collisions BEFORE
 * starting an export. Used by the new 'export:probe-conflicts' IPC channel
 * (renderer mounts ConflictDialog with the result) AND by handleStartExport
 * itself as a defense-in-depth check when called with overwrite=false.
 *
 * Returns the deduped, sorted list of absolute paths that would be
 * overwritten by this export. Three collision sources covered:
 *   1. resolved output equals row.sourcePath (per-region PNG case)
 *   2. resolved output equals row.atlasSource.pagePath (atlas-packed)
 *   3. resolved output exists on disk via fs.access(F_OK) (any
 *      pre-existing PNG, even if unrelated — we don't silently destroy
 *      user files just because they happen to live where we'd write)
 *
 * Existence probes run in parallel via Promise.all — total cost is one
 * stat-equivalent syscall per row, well below the sharp/libvips work
 * downstream. The resulting list is unique (a single path can collide
 * via both source-match and exists-on-disk; we deduplicate via Set) and
 * sorted (deterministic UI ordering, easier user comparison).
 *
 * Pure (no global state mutation). Safe to call concurrently.
 *
 * Not exported — internal helper for handleProbeExportConflicts and
 * handleStartExport.
 */
async function probeExportConflicts(
  plan: ExportPlan,
  outDir: string,
  // UAT Round 3 (2026-05-15) — added so atlas/both modes can probe the
  // outDir-root atlas targets `{projectName}.png`, `{projectName}_N.png`,
  // `{projectName}.atlas` in addition to the loose-mode per-region paths
  // under `outDir/images/...`. Defaults preserve pre-Round-3 behavior
  // (loose-only paths) for any caller that hasn't been updated.
  outputMode: 'loose' | 'atlas' | 'both' = 'loose',
  atlasOpts: AtlasOpts = { maxPageSize: 4096, allowRotation: false, padding: 2 },
): Promise<string[]> {
  // Silence unused-arg lint — `atlasOpts` is part of the signature so future
  // probe extensions (e.g. pack-plan-derived page count) can use it without
  // breaking callers, but the current probe is page-count-agnostic.
  void atlasOpts;

  // Gap-Fix Round 4 (2026-04-25) — collision == "would clobber a file that
  // currently exists". Existence on disk (F_OK) is the only correct gate.
  // The earlier round-3 synchronous string-match checks against row.sourcePath
  // and row.atlasSource.pagePath false-positived: the loader still constructs
  // sourcePath as <skeletonDir>/images/<regionName>.png even for atlas-only
  // projects (the atlas-extract fallback runs at write time), so any outDir
  // landing on the same string triggered the alarm even after the user had
  // manually deleted the images folder.
  //
  // UAT Round 3 (2026-05-15) — loose-mode per-row check is now gated on
  // outputMode so atlas-only exports don't surface stale loose-mode artifacts
  // as conflicts. Atlas-mode probe (below) covers the outDir-root targets
  // (`{projectName}.png`, `{projectName}_N.png`, `{projectName}.atlas`).
  const conflictSet = new Set<string>();

  if (outputMode === 'loose' || outputMode === 'both') {
    const existencePromises = plan.rows.map(async (row) => {
      const resolvedOut = path.resolve(outDir, row.outPath);
      const exists = await access(resolvedOut, fsConstants.F_OK)
        .then(() => true)
        .catch(() => false);
      return exists ? resolvedOut : null;
    });
    const results = await Promise.all(existencePromises);
    for (const r of results) if (r !== null) conflictSet.add(r);
  }

  // Atlas-mode probe: derive `{projectName}.png` + `{projectName}.atlas`
  // via the SAME helpers runRepack uses (atlas-paths.ts) so both call sites
  // agree byte-for-byte. The first page (`{projectName}.png`) and the atlas
  // text are canonical sentinels — if either exists, a prior atlas export
  // ran here. We don't know the exact page count until pack-plan computation
  // (it depends on resized region dims + maxPageSize), so additional pages
  // (`{projectName}_2.png`, `_3.png`, ...) are discovered by listing outDir
  // and matching the `{projectName}_<number>.png` filename pattern. Any
  // matched files are included in the conflict list verbatim.
  if (outputMode === 'atlas' || outputMode === 'both') {
    let projectName: string;
    try {
      projectName = deriveProjectName(plan, outDir);
    } catch {
      // Defensive: deriveProjectName throws when both outDir basename and
      // skeleton sourcePath are unusable. Under the IPC contract this is
      // unreachable (outDir is a validated non-empty string upstream), but
      // we surface 0 atlas conflicts rather than throwing — the loose-mode
      // path may still have populated conflictSet above.
      return Array.from(conflictSet).sort();
    }
    const resolvedOutDir = path.resolve(outDir);
    const firstPagePath = path.join(
      resolvedOutDir,
      pageFilename(projectName, 0),
    );
    const atlasPath = path.join(resolvedOutDir, `${projectName}.atlas`);

    // Check the two canonical sentinels in parallel.
    const [firstPageExists, atlasExists] = await Promise.all([
      access(firstPagePath, fsConstants.F_OK)
        .then(() => true)
        .catch(() => false),
      access(atlasPath, fsConstants.F_OK)
        .then(() => true)
        .catch(() => false),
    ]);
    if (firstPageExists) conflictSet.add(firstPagePath);
    if (atlasExists) conflictSet.add(atlasPath);

    // Multi-page: list outDir and pick any file matching
    // `{projectName}_<integer>.png` (with the integer >= 2). We use readdir
    // on the resolved outDir; the directory may not exist (ENOENT) — in
    // that case there can be no conflicts, so we skip silently.
    try {
      const entries = await readdir(resolvedOutDir);
      // Escape regex metacharacters in projectName so a user picking a
      // folder name like `joker.export` doesn't accidentally widen the
      // match. `\` and `]` are not legal in a path basename on macOS/Win
      // pickers but defensive escaping is cheap.
      const escapedName = projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const multiPageRe = new RegExp(`^${escapedName}_(\\d+)\\.png$`);
      for (const entry of entries) {
        const match = multiPageRe.exec(entry);
        if (!match) continue;
        const n = parseInt(match[1], 10);
        if (Number.isFinite(n) && n >= 2) {
          conflictSet.add(path.join(resolvedOutDir, entry));
        }
      }
    } catch {
      // ENOENT (outDir does not yet exist) or permission denied — no
      // additional pages to surface.
    }
  }

  return Array.from(conflictSet).sort();
}

/**
 * Phase 6 Gap-Fix Round 3 (2026-04-25) — IPC entry point for the
 * 'export:probe-conflicts' channel. Wraps probeExportConflicts with
 * the same shape validation handleStartExport uses (cheap T-01-02-01
 * trust-boundary check) plus the 'outDir IS source-images-dir' hard
 * reject — that case is NEVER offered as a confirmation prompt
 * because every output would collide; the user has to pick a
 * different folder regardless.
 *
 * No exportInFlight mutation; safe to call repeatedly without
 * blocking subsequent startExport.
 */
export async function handleProbeExportConflicts(
  plan: unknown,
  outDir: unknown,
  // UAT Round 3 (2026-05-15) — optional positional args mirror the
  // additive contract on `export:start` (Phase 40 D-04). Defaults preserve
  // pre-Round-3 behavior (loose-only probe) for any caller that hasn't
  // adopted the widened signature; the renderer always passes explicit
  // values via the OptimizeDialog Output card state.
  outputMode: unknown = 'loose',
  atlasOpts: unknown = { maxPageSize: 4096, allowRotation: false, padding: 2 },
): Promise<ProbeConflictsResponse> {
  if (typeof outDir !== 'string' || outDir.length === 0) {
    return { ok: false, error: { kind: 'Unknown', message: 'outDir must be a non-empty string' } };
  }
  const planErr = validateExportPlan(plan);
  if (planErr !== null) {
    return { ok: false, error: { kind: 'Unknown', message: `Invalid plan: ${planErr}` } };
  }
  // Validate the new positional args via the shared validateExportOpts
  // helper. Garbage values are coerced to safe defaults rather than
  // rejected — probe is an advisory call, not a state-changing one, so
  // a malformed renderer should still get a useful (if loose-mode-only)
  // conflict list rather than a hard error.
  const optsErr = validateExportOpts(outputMode, atlasOpts);
  const validOutputMode =
    optsErr === null
      ? (outputMode as 'loose' | 'atlas' | 'both')
      : 'loose';
  const validAtlasOpts =
    optsErr === null
      ? (atlasOpts as AtlasOpts)
      : { maxPageSize: 4096 as const, allowRotation: false, padding: 2 };
  const validPlan = plan as ExportPlan;

  // Hard-reject: outDir IS the source-images dir itself. Every output
  // would collide; not a useful prompt — keep the friendlier message.
  // Mirrors the same check in handleStartExport (locked at both layers
  // so the renderer never has to special-case the response shape).
  //
  // Phase 6 REVIEW M-01 (2026-04-25) — use `lastIndexOf('/images/')` so
  // the derivation matches relativeOutPath in src/core/export.ts:117 and
  // src/renderer/src/lib/export-view.ts:98. The inner `/images/` is the
  // export folder; any earlier `/images/` (e.g. user's working layout
  // `~/work/images/joker_project/images/CIRCLE.png`) is part of the
  // user's directory hierarchy and must not be treated as the
  // source-images dir.
  if (validPlan.rows.length > 0) {
    const firstSrc = validPlan.rows[0].sourcePath;
    const normalised = firstSrc.replace(/\\/g, '/');
    const idx = normalised.lastIndexOf('/images/');
    if (idx >= 0) {
      const sourceImagesDir = normalised.slice(0, idx + '/images'.length);
      if (path.resolve(outDir) === path.resolve(sourceImagesDir)) {
        return {
          ok: false,
          error: {
            kind: 'invalid-out-dir',
            message:
              'Output directory IS the source images folder. ' +
              'Every output would overwrite a source — pick a different folder.',
          },
        };
      }
    }
  }

  const conflicts = await probeExportConflicts(
    validPlan,
    outDir,
    validOutputMode,
    validAtlasOpts,
  );
  return { ok: true, conflicts };
}

export async function handleSkeletonLoad(jsonPath: unknown): Promise<LoadResponse> {
  // T-01-02-01: input validation at the trust boundary.
  // Phase 34 CR-01 — case-insensitive suffix check matches the picker
  // contract at handleOpenDialog. Uppercase `.JSON` from macOS APFS/HFS+
  // case-insensitive volumes (and Windows file-name-field paste) was
  // previously rejected with the generic kind:'Unknown' envelope even
  // though the picker had routed it correctly as kind:'skeleton'.
  if (
    typeof jsonPath !== 'string' ||
    jsonPath.length === 0 ||
    !jsonPath.toLowerCase().endsWith('.json')
  ) {
    return {
      ok: false,
      error: {
        kind: 'Unknown',
        message: `Invalid path argument: expected a non-empty string ending in .json`,
      },
    };
  }

  try {
    const t0 = performance.now();
    const load = loadSkeleton(jsonPath);
    const sampled = sampleSkeleton(load);
    const elapsedMs = performance.now() - t0;
    const summary = buildSummary(load, sampled, elapsedMs);
    return { ok: true, summary };
  } catch (err) {
    // Phase 12 / Plan 05 (D-21) — F3 Spine version guard. The
    // SpineVersionUnsupportedError envelope arm carries one extra typed
    // field beyond `message` (`detectedVersion`); the generic kind-list
    // arm below would drop it. Branch BEFORE the generic forwarder.
    if (err instanceof SpineVersionUnsupportedError) {
      return {
        ok: false,
        error: {
          kind: 'SpineVersionUnsupportedError',
          message: err.message,
          detectedVersion: err.detectedVersion,
        },
      };
    }
    if (err instanceof SpineLoaderError && KNOWN_KINDS.has(err.name as KnownErrorKind)) {
      // T-01-02-02: surface only the error name + message; never any trace.
      return {
        ok: false,
        error: { kind: err.name as KnownErrorKind, message: err.message },
      };
    }
    return {
      ok: false,
      error: {
        kind: 'Unknown',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Phase 6 Plan 05 — F8.1 + D-118 folder picker.
 *
 * Opens the native OS folder picker. Properties array includes BOTH
 * platform-specific create-folder hints (createDirectory = macOS,
 * promptToCreate = Windows) per RESEARCH §Common Pitfalls #3.
 * defaultPath is honored on both platforms.
 *
 * Returns the chosen absolute path or null if the user cancels.
 * The renderer's AppShell click handler treats null as "user changed
 * their mind — do not mount OptimizeDialog".
 */
export async function handlePickOutputDirectory(defaultPath?: string): Promise<string | null> {
  // Use the focused window if available so the picker is modal to it.
  const win = BrowserWindow.getFocusedWindow();
  const options: Electron.OpenDialogOptions = {
    title: 'Choose output folder for optimized images',
    defaultPath,
    buttonLabel: 'Export Here',
    properties: [
      'openDirectory',
      'createDirectory',   // macOS — allow creating new folder in picker
      'promptToCreate',    // Windows — prompt if entered path doesn't exist
      'dontAddToRecent',   // Windows — don't pollute recent docs
    ],
  };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

/**
 * Phase 6 Plan 05 — D-115 + D-122 + F8.4 export start.
 *
 * Wraps src/main/image-worker.ts runExport with:
 *   - re-entrancy guard via exportInFlight flag (rejects 'already-running').
 *   - outDir validation (the hard-reject case: outDir IS source-images-dir).
 *   - shape validation of plan (T-01-02-01 trust-boundary input check).
 *   - one-way progress emission via evt.sender.send('export:progress', ...).
 *   - cancel-flag closure for the runExport isCancelled callback.
 *
 * Returns ExportResponse envelope (mirrors LoadResponse — D-10).
 *
 * Validation order matters:
 *   1. Re-entrancy first (cheapest; protects everything below).
 *   2. outDir / plan shape validation BEFORE setting exportInFlight (so
 *      validation rejections do not poison the flag for follow-up calls).
 *   3. outDir-IS-source-images-dir hard-reject BEFORE setting exportInFlight.
 *   4. Defense-in-depth probe (skipped when overwrite=true).
 *   5. Only after all input validation passes do we claim the slot.
 *
 * Gap-Fix Round 3 (2026-04-25): the round-2 folder-position-only rejection
 * was over-cautious — picking the SKELETON folder (parent of images/) is
 * a common organizational pattern and is fine when no `images/` subfolder
 * yet exists. The new contract: hard-reject ONLY when outDir IS the
 * source-images dir itself; otherwise rely on the renderer's
 * probe-then-confirm flow (api.probeExportConflicts → ConflictDialog →
 * startExport(overwrite=true)). The probe is also re-run here as
 * defense-in-depth when overwrite=false, so any caller bypassing the
 * renderer flow still gets the precise conflict list rather than silent
 * source-file destruction.
 */
export async function handleStartExport(
  evt: Electron.IpcMainInvokeEvent | { sender: { send: (channel: string, ...args: unknown[]) => void } },
  plan: unknown,
  outDir: unknown,
  overwrite: boolean = false,
  // Phase 28 SHARP-02 — 5th arg, default false (mirrors overwrite default).
  sharpenEnabled: boolean = false,
  // Phase 40 D-04 — additive positional args (6th + 7th). Pre-Phase-40 callers
  // passing only 5 args get safe defaults; renderer (Plan 07) supplies real
  // values via the OptimizeDialog Output card. Default 'loose' + maxPageSize
  // 4096 + no rotation + 2px padding makes legacy IPC traffic byte-equivalent
  // to pre-Phase-40 behavior (REPACK-01 acceptance — gated by the loose-
  // baseline test in Plan 08).
  outputMode: 'loose' | 'atlas' | 'both' = 'loose',
  atlasOpts: AtlasOpts = {
    maxPageSize: 4096,
    allowRotation: false,
    padding: 2,
  },
): Promise<ExportResponse> {
  // D-115: re-entrancy guard — checked FIRST so a second invocation while
  // a first is pending sees the flag set and bails immediately.
  if (exportInFlight) {
    return { ok: false, error: { kind: 'already-running', message: 'An export is already in progress.' } };
  }

  // T-01-02-01: validate types at the boundary.
  if (typeof outDir !== 'string' || outDir.length === 0) {
    return { ok: false, error: { kind: 'Unknown', message: 'outDir must be a non-empty string' } };
  }
  const planErr = validateExportPlan(plan);
  if (planErr !== null) {
    return { ok: false, error: { kind: 'Unknown', message: `Invalid plan: ${planErr}` } };
  }
  // Phase 40 D-04: validate the 2 new args (mirrors validateExportPlan at
  // L294-318). Rejection envelope shares the 'Unknown' kind with the plan
  // validator since the existing ExportResponse error union does not carry
  // an 'invalid-opts' arm — keeps the renderer's error-rendering branch
  // unchanged. The message string carries the per-field rejection reason
  // verbatim (locked by validateExportOpts above) so tests can pattern-
  // match against it.
  const optsErr = validateExportOpts(outputMode, atlasOpts);
  if (optsErr !== null) {
    return { ok: false, error: { kind: 'Unknown', message: `Invalid options: ${optsErr}` } };
  }
  const validPlan = plan as ExportPlan;

  // Gap-Fix Round 3 (2026-04-25) — hard-reject ONLY when outDir IS the
  // source-images dir itself. Every other folder-position case is now
  // permitted; per-row file collisions are surfaced via
  // probeExportConflicts + the renderer's overwrite modal. This hard-reject
  // case CANNOT be rescued by overwrite=true (every output would collide;
  // not a useful confirmation prompt — the user must pick a different
  // folder regardless).
  //
  // Source images dir is derived from row[0].sourcePath via the
  // loader convention `<skeletonDir>/images/<regionName>.png`. For nested
  // regions (e.g. 'AVATAR/FACE'), use the LAST '/images/' segment so the
  // inner export folder is identified — `lastIndexOf` matches the parsing
  // in relativeOutPath (src/core/export.ts:117 +
  // src/renderer/src/lib/export-view.ts:98), so a user layout like
  // `~/work/images/joker_project/images/CIRCLE.png` correctly resolves
  // sourceImagesDir to `~/work/images/joker_project/images` rather than
  // `~/work/images`.
  //
  // Phase 6 REVIEW M-01 (2026-04-25) — switched indexOf → lastIndexOf
  // for parity with the relativeOutPath parsers in core/export.ts and
  // export-view.ts. The Round 4 F_OK probe still catches the actual
  // collision case as defense-in-depth, but the friendlier
  // 'invalid-out-dir' message is now correct for the parent-of-images
  // working-layout edge case.
  //
  // Empty plans skip this check (no source path to derive from).
  if (validPlan.rows.length > 0) {
    const firstSrc = validPlan.rows[0].sourcePath;
    const normalised = firstSrc.replace(/\\/g, '/');
    const idx = normalised.lastIndexOf('/images/');
    if (idx >= 0) {
      const sourceImagesDir = normalised.slice(0, idx + '/images'.length);
      if (path.resolve(outDir) === path.resolve(sourceImagesDir)) {
        return {
          ok: false,
          error: {
            kind: 'invalid-out-dir',
            message:
              'Output directory IS the source images folder. ' +
              'Every output would overwrite a source — pick a different folder.',
          },
        };
      }
    }
  }

  // D-115: claim the slot, reset cancel. This MUST happen synchronously
  // BEFORE any await so a re-entrant invocation that runs in the same
  // microtask queue (i.e. a second handleStartExport call kicked off
  // before the first one's promise resolves) sees the flag set and
  // bails with 'already-running'. The empty-plan path also goes through
  // here so re-entrancy is uniformly enforced regardless of plan size.
  //
  // Gap-Fix Round 3 (2026-04-25): the slot claim moved BEFORE the
  // defense-in-depth probe (which awaits Promise.all) — without this,
  // the first await yielded the event loop before the flag was set and
  // the re-entrancy guard test failed. Probe-rejection still clears the
  // flag via the finally block below, so a follow-up call after a probe
  // rejection is not silently pre-poisoned.
  exportInFlight = true;
  exportCancelFlag = false;
  try {
    // Gap-Fix Round 3 (2026-04-25) — defense-in-depth conflict probe.
    // When overwrite=false (the safe default), re-run the same probe the
    // renderer used pre-start; if any conflicts are present, reject with
    // 'overwrite-source' carrying the precise list. The renderer's
    // probe-then-confirm flow ensures we never reach this branch in normal
    // operation (the renderer would have shown ConflictDialog and either
    // cancelled or sent overwrite=true) — this is the safety net for any
    // caller that bypasses the renderer flow (e.g. future automation,
    // a misbehaving renderer, or any test invocation).
    //
    // When overwrite=true, the user has explicitly confirmed via
    // ConflictDialog "Overwrite all"; bypass the per-row collision check
    // entirely and trust the worker's allowOverwrite=true gate to skip
    // its own defense-in-depth check too.
    if (!overwrite) {
      // UAT Round 3 (2026-05-15) — forward the validated outputMode +
      // atlasOpts so the defense-in-depth probe matches the mode we're
      // about to run. Without this, an atlas-mode re-export would bypass
      // the per-row loose probe (since loose paths don't yet exist) but
      // then runRepack's existence check at write time would throw.
      const conflicts = await probeExportConflicts(
        validPlan,
        outDir,
        outputMode,
        atlasOpts,
      );
      if (conflicts.length > 0) {
        return {
          ok: false,
          error: {
            kind: 'overwrite-source',
            message: `${conflicts.length} file(s) would be overwritten. Probe before starting.`,
            conflicts,
          },
        };
      }
    }

    // Phase 40 D-04a — shared rollback accumulator. Both workers register
    // tmp + final paths in `written` BEFORE every atomic write; on ANY
    // throw inside the dispatch block, the inner catch sweeps every entry
    // via fs.rm(p, { force: true }).catch(() => {}). RESEARCH §Landmines
    // #7+#8: force-rm swallows ENOENT, so sweeping paths whose tmp landed
    // but final never did (or vice-versa) is safe by construction. This
    // realizes the REPACK-10 atomic-or-fail acceptance b: NO orphan files
    // left in `outDir` after a failed atlas/both export.
    //
    // Dispatch matrix (D-04a):
    //   - 'loose' → runExport only (byte-identical to pre-Phase-40 path)
    //   - 'atlas' → runRepack only
    //   - 'both'  → runExport THEN runRepack (sharing the same `written` Set)
    //
    // Progress event sender is the same closure for both workers so the
    // renderer receives a single event stream with the additive `phase`
    // field discriminating resize/composite (D-05).
    const written = new Set<string>();
    const sendProgress = (e: Parameters<typeof evt.sender.send>[1]) => {
      // webContents.send may throw if the renderer has gone away
      // mid-export (window closed). Swallow — the export still
      // completes and the summary is returned to whoever is left.
      try { evt.sender.send('export:progress', e); } catch { /* webContents gone */ }
    };
    try {
      let looseSummary: ExportSummary | undefined;
      let repackSummary: ExportSummary | undefined;
      if (outputMode === 'loose' || outputMode === 'both') {
        looseSummary = await runExport(
          validPlan,
          outDir,
          sendProgress,
          () => exportCancelFlag,
          overwrite,
          sharpenEnabled, // Phase 28 SHARP-02
          written,        // Phase 40 D-04a — shared rollback accumulator
        );
      }
      if (outputMode === 'atlas' || outputMode === 'both') {
        const repackResult = await runRepack(
          validPlan as ExportPlan,
          outDir,
          sendProgress,
          () => exportCancelFlag,
          overwrite,
          sharpenEnabled,
          atlasOpts,
          written,
        );
        repackSummary = repackResult.summary;
      }
      // UAT bug 3 (2026-05-15) — replaced placeholder synth with real
      // summaries from each worker. Pre-fix the atlas path returned
      // `{ successes: 0, durationMs: 0, ... }` → renderer reported
      // "0 of N succeeded" despite files being written.
      //
      // Merge contract for 'both' mode:
      //   successes  = sum (loose + atlas counts)
      //   errors     = concat (loose stage's per-file errors carry through;
      //                repack worker currently emits none, but the concat
      //                shape is future-proof for when it does)
      //   outputDir  = the looseSummary value (both stages write into the
      //                SAME resolved outDir by IPC contract)
      //   durationMs = sum (sequential — loose first, atlas second)
      //   cancelled  = OR (either stage's cancel propagates upward)
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
        // Defensive: outputMode must be one of loose/atlas/both, so at
        // least one summary is always set. This branch is unreachable
        // under the validator-gated input contract.
        finalSummary = {
          successes: 0,
          errors: [],
          outputDir: path.resolve(outDir),
          durationMs: 0,
          cancelled: false,
        };
      }
      return { ok: true, summary: finalSummary };
    } catch (innerErr) {
      // Rollback: delete every recorded path. fs.rm with { force: true }
      // swallows ENOENT, so this is safe even if some paths never landed.
      // .catch(() => {}) on each call adds defense-in-depth against
      // permission errors during the sweep (e.g. another process holding
      // a handle on Windows). The outer catch below catches the re-thrown
      // error and converts to the standard 'Unknown' envelope.
      for (const p of written) {
        await fsRm(p, { force: true }).catch(() => { /* defense-in-depth */ });
      }
      throw innerErr;
    }
  } catch (err) {
    return {
      ok: false,
      error: { kind: 'Unknown', message: err instanceof Error ? err.message : String(err) },
    };
  } finally {
    exportInFlight = false;
    exportCancelFlag = false;
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('skeleton:load', async (_evt, jsonPath) => handleSkeletonLoad(jsonPath));
  // Phase 6 Plan 05 — export channels.
  ipcMain.handle('dialog:pick-output-dir', async (_evt, defaultPath) =>
    handlePickOutputDirectory(typeof defaultPath === 'string' ? defaultPath : undefined),
  );
  // Gap-Fix Round 3 (2026-04-25) — 'export:probe-conflicts' channel: the
  // renderer probes BEFORE startExport so it can mount ConflictDialog with
  // the precise list of files that would be overwritten and offer
  // Cancel / Pick-different-folder / Overwrite-all. No exportInFlight
  // mutation; safe to call repeatedly.
  // UAT Round 3 (2026-05-15) — widened to forward `outputMode` + `atlasOpts`
  // so the probe matches the export-mode the renderer will actually run.
  // Pre-Round-3 the probe was loose-only blind; atlas re-exports against
  // an outDir already holding {projectName}.png skipped the ConflictDialog
  // and ran into runRepack's defensive existence check at write time.
  ipcMain.handle(
    'export:probe-conflicts',
    async (_evt, plan, outDir, outputMode, atlasOpts) =>
      handleProbeExportConflicts(plan, outDir, outputMode, atlasOpts),
  );
  // Gap-Fix Round 3 (2026-04-25) — 'export:start' gains `overwrite` as a
  // 3rd argument. Strict `=== true` check: any non-true value (undefined,
  // null, 0, false) keeps the safe default and re-runs the probe.
  // Phase 28 SHARP-02 — 'export:start' gains `sharpenEnabled` as a 4th
  // argument (strict boolean coerce).
  // Phase 40 D-04 — 'export:start' gains outputMode + atlasOpts as
  // positional args 5 + 6. Renderer-supplied values are coerced to safe
  // defaults if garbage / undefined arrives at the IPC boundary (the
  // validateExportOpts call inside handleStartExport is the canonical
  // rejection gate for VALID-shape-but-wrong-value; this outer coercion
  // covers the "renderer is older than the handler" forward-compat case
  // where outputMode/atlasOpts simply weren't sent).
  ipcMain.handle('export:start', async (evt, plan, outDir, overwrite, sharpenEnabled, outputMode, atlasOpts) =>
    handleStartExport(
      evt,
      plan,
      outDir,
      overwrite === true,
      sharpenEnabled === true, // Phase 28 SHARP-02 — strict boolean coerce
      // Phase 40 D-04: coerce to safe defaults if renderer omits / sends garbage.
      // The validateExportOpts gate inside handleStartExport will reject
      // wrong-value-but-right-shape inputs explicitly.
      (outputMode === 'loose' || outputMode === 'atlas' || outputMode === 'both')
        ? outputMode
        : 'loose',
      (atlasOpts && typeof atlasOpts === 'object')
        ? (atlasOpts as AtlasOpts)
        : { maxPageSize: 4096, allowRotation: false, padding: 2 },
    ),
  );
  // Phase 49 EXPORT-01 — NEW `variant:export` channel (RESEARCH §Flag 5: a new
  // channel is cleaner than overloading the already-6-arg export:start, and
  // honors D-04). Coerces the same opts ladder as export:start PLUS the new `s`
  // (number) + `parentDir` (string) + `effectiveOverrides` (wire entries
  // [regionName, pct][] → Map) + `safetyBufferPercent` (number). The renderer
  // (Plan 02) picks the PARENT folder; the {NAME}@{s}x/ subfolder is appended
  // main-side. export:start / handleStartExport are NOT touched (D-04).
  ipcMain.handle('variant:export',
    async (
      evt,
      summary,
      s,
      parentDir,
      overwrite,
      sharpenEnabled,
      outputMode,
      atlasOpts,
      effectiveOverrides,
      safetyBufferPercent,
    ) =>
      handleExportVariant(
        evt,
        summary as SkeletonSummary,
        Number(s),
        typeof parentDir === 'string' ? parentDir : '',
        overwrite === true,
        sharpenEnabled === true,
        outputMode === 'loose' || outputMode === 'atlas' || outputMode === 'both'
          ? outputMode
          : 'loose',
        atlasOpts && typeof atlasOpts === 'object'
          ? (atlasOpts as AtlasOpts)
          : { maxPageSize: 4096, allowRotation: false, padding: 2 },
        Array.isArray(effectiveOverrides)
          ? new Map(effectiveOverrides as [string, number][])
          : new Map<string, number>(),
        Number(safetyBufferPercent) || 0,
      ),
  );
  // Phase 51 EXPORT-04 — NEW variant:exportBatch channel. Mirrors variant:export's
  // coercion ladder (the documented trust boundary, ipc.ts:30-32) but takes a
  // `scales` array instead of a single `s`. Security V5: coerce scales to a finite
  // number array (drop NaN/Infinity); a per-scale s>=1/<=0 still fails per-variant
  // inside exportOneVariant (recorded as a failed result, not a crash). parentDir
  // coerced to string; safetyBufferPercent re-clamped per-variant inside the body.
  ipcMain.handle('variant:exportBatch',
    async (
      evt,
      summary,
      scales,
      parentDir,
      overwrite,
      sharpenEnabled,
      outputMode,
      atlasOpts,
      effectiveOverrides,
      safetyBufferPercent,
    ) =>
      handleExportVariantBatch(
        evt,
        summary as SkeletonSummary,
        Array.isArray(scales) ? (scales as unknown[]).map(Number).filter((n) => Number.isFinite(n)) : [],
        typeof parentDir === 'string' ? parentDir : '',
        overwrite === true,
        sharpenEnabled === true,
        outputMode === 'loose' || outputMode === 'atlas' || outputMode === 'both'
          ? outputMode
          : 'loose',
        atlasOpts && typeof atlasOpts === 'object'
          ? (atlasOpts as AtlasOpts)
          : { maxPageSize: 4096, allowRotation: false, padding: 2 },
        Array.isArray(effectiveOverrides)
          ? new Map(effectiveOverrides as [string, number][])
          : new Map<string, number>(),
        Number(safetyBufferPercent) || 0,
      ),
  );
  ipcMain.on('export:cancel', () => {
    // D-115: cooperative cancel. Flag is read on every iteration of the
    // runExport loop between files. In-flight cannot be aborted mid-libvips.
    exportCancelFlag = true;
  });
  // Phase 51 D-09 — between-variants batch cancel. One-way renderer→main send;
  // flips the module-level variantBatchCancelRequested flag the batch loop reads
  // at the top of each iteration. The in-flight variant is never interrupted.
  ipcMain.on('variant:cancelBatch', () => {
    setVariantBatchCancelRequested();
  });

  // Phase 9 Plan 02 D-194 — forceful sampler cancel via worker.terminate().
  // The byte-frozen sampler (D-102) has no inner-loop emit point so cooperative
  // flag-checking is impossible. terminate() halts JS execution as soon as
  // possible (typically <50 ms; ≤200 ms budget per D-194). Pitfall 6: terminate
  // does NOT run finally blocks — the Phase 9 worker has no resources to clean
  // up (pure compute job per N2.3) so this is safe.
  //
  // Trust boundary (T-09-02-IPC-01): renderer-origin one-way send with no
  // payload. Idempotent: if no worker is in flight, terminate() is a no-op.
  // We do NOT additionally validate evt.sender — the contextBridge surface
  // only exposes cancelSampler() to the trusted renderer.
  ipcMain.on('sampler:cancel', () => {
    const handle = getSamplerWorkerHandle();
    if (handle !== null) {
      void handle.terminate();
    }
  });
  ipcMain.on('shell:open-folder', (_evt, dir) => {
    // T-06-14: typeof + length check. dir originates from the renderer's
    // outDir which already passed handleStartExport validation, so this
    // is a defense-in-depth check.
    if (typeof dir === 'string' && dir.length > 0) {
      try {
        shell.showItemInFolder(dir);
      } catch {
        // showItemInFolder may throw on some platforms for non-existent
        // paths — silent (one-way channel; nothing to return).
      }
    }
  });

  // Phase 9 Plan 05 T-09-05-OPEN-EXTERNAL — open an external URL in the
  // system browser. Allow-list-validated (SHELL_OPEN_EXTERNAL_ALLOWED) before
  // the shell.openExternal call. Silent rejection on:
  //   - non-string / empty payload (typeof / length guard)
  //   - URL not in the closed allow-list
  // The channel is one-way (renderer→main fire-and-forget); there is no
  // envelope to return on rejection. Plan 07 (HelpDialog) consumes this
  // bridge to open Spine documentation links from the in-app help view.
  ipcMain.on('shell:open-external', (_evt, url) => {
    if (typeof url !== 'string' || url.length === 0) return;
    // Phase 16 D-04 — accept either:
    //   (a) an exact-string match against the existing Set (Spine docs URLs +
    //       INSTALL.md URL + the Releases index URL — the legacy Phase 12 D-18
    //       allow-list shape), OR
    //   (b) a structural match for a /releases/tag/v{version} URL on github.com
    //       (Phase 16 D-04 — per-release URL emitted by deliverUpdateAvailable).
    // The structural check (isReleasesUrl) defends against URL-spoofing tricks
    // that a naive prefix match would allow. The Set.has check is preserved
    // for backward-compat with Phase 12 D-18 + Plan 14-05 URL-consistency gate.
    if (!SHELL_OPEN_EXTERNAL_ALLOWED.has(url) && !isReleasesUrl(url)) return;
    try {
      void shell.openExternal(url);
    } catch {
      // shell.openExternal can throw on platforms where the default browser
      // is misconfigured. Silent — one-way channel; nothing to return.
    }
  });

  // Phase 12 Plan 01 — auto-update IPC surface (UPD-01..UPD-06).
  //
  // Four channels:
  //   - 'update:check-now' (invoke): Help → Check for Updates manual trigger.
  //     Forwards to checkUpdate(true); on rejection main bridges 'update:error'.
  //   - 'update:download' (invoke): UpdateDialog "Download + Restart" click.
  //     Opt-in download (UPD-03 — autoDownload=false in auto-update.ts).
  //   - 'update:dismiss' (one-way send): UpdateDialog "Later" click.
  //     Persists dismissedUpdateVersion via D-08 atomic-write to
  //     update-state.json. Trust-boundary typeof guard mirrors
  //     'shell:open-external' (line 612-613) — non-string / empty payload
  //     silently dropped.
  //   - 'update:quit-and-install' (one-way send): UpdateDialog "Restart"
  //     click after download. quitAndInstallUpdate uses Pattern H
  //     setTimeout(0) deferral so this IPC ack returns to the renderer
  //     BEFORE autoUpdater.quitAndInstall fires (synchronous quit).
  ipcMain.handle('update:check-now', async () => {
    const { checkUpdate } = await import('./auto-update.js');
    return checkUpdate(true);
  });
  ipcMain.handle('update:download', async () => {
    // Phase 14 Plan 06 — clear the sticky 'update-available' slot BEFORE delegating
    // to electron-updater's downloadUpdate. The user just clicked "Download +
    // Restart" so the dialog will close on its next state transition; clearing the
    // slot here ensures any in-session remount of the renderer (HMR / StrictMode
    // dev cycle / future "Reset session" affordance / future vitest unmount path)
    // does NOT re-hydrate updateState from a payload the user has already actioned.
    // Closes Phase 14 Plan 03 must-have truth #11 (defense-in-depth slot clear)
    // and gap WR-01 from 14-VERIFICATION.md. Per CONTEXT.md D-Discretion-2 the
    // slot is in-memory only — no disk write to flush.
    const { downloadUpdate, clearPendingUpdateInfo } = await import('./auto-update.js');
    clearPendingUpdateInfo();
    return downloadUpdate();
  });
  ipcMain.on('update:dismiss', (_evt, version) => {
    if (typeof version !== 'string' || version.length === 0) return;
    void (async () => {
      // Phase 14 Plan 06 — clear the sticky 'update-available' slot BEFORE delegating
      // to dismissUpdate (which persists `dismissedUpdateVersion` to disk). The user
      // just clicked "Later" so the dialog will close immediately; clearing the slot
      // here ensures any in-session remount of the renderer does NOT re-hydrate
      // updateState from a payload the user has already actioned. Order matters:
      // clearPendingUpdateInfo first (synchronous module-state mutation, cannot
      // throw), then await dismissUpdate (async disk write that COULD throw — the
      // existing dismissUpdate body catches its own errors at auto-update.ts:236
      // and logs, so even on persistence failure the in-memory slot is correctly
      // empty). Closes Phase 14 Plan 03 must-have truth #11 + gap WR-01.
      //
      // The trust-boundary guard on the previous line (typeof string + non-empty)
      // STAYS in place — malformed inbound `version` short-circuits BEFORE both
      // side-effects, so the slot is NOT cleared on garbage input. Mirrors the
      // existing safety posture (no mutation on bad inbound payload).
      const { dismissUpdate, clearPendingUpdateInfo } = await import('./auto-update.js');
      clearPendingUpdateInfo();
      await dismissUpdate(version);
    })();
  });
  ipcMain.on('update:quit-and-install', () => {
    void (async () => {
      const { quitAndInstallUpdate } = await import('./auto-update.js');
      quitAndInstallUpdate();
    })();
  });

  // Phase 14 D-03 — late-mount pending-update re-delivery channel.
  //
  // Renderer App.tsx calls this ONCE on mount via window.api.requestPendingUpdate()
  // to handle the late-subscribe edge case where main fired 'update-available'
  // BEFORE the renderer's React effect committed (e.g., 3.5s startup check
  // resolving before React hydration finishes — was the root cause of UPDFIX-03's
  // "no startup notification" symptom on shipped v1.1.1 because the renderer
  // never had a subscriber when the event fired).
  //
  // Returns the sticky 'update-available' payload (overwritten on each newer
  // version; cleared by renderer-driven dismiss/download flows), or null on
  // first launch / no pending update. Slot lives in src/main/auto-update.ts
  // module state per D-Discretion-2 (in-memory only for v1.1.2 hotfix scope —
  // rebuilt on every cold start).
  //
  // Trust-boundary: takes NO inbound payload (renderer invokes with zero args
  // via ipcRenderer.invoke('update:request-pending')); the typed return value
  // is enforced statically at the preload bridge. No string-guard needed at
  // this site — mirrors the Phase 12 'update:check-now' / 'update:download'
  // handlers above which also take zero args.
  ipcMain.handle('update:request-pending', async () => {
    const { getPendingUpdateInfo } = await import('./auto-update.js');
    return getPendingUpdateInfo();
  });

  // Phase 12 Plan 03 (D-19) — F1 atlas-image URL bridge.
  //
  // Renderer cannot use node:url (sandboxed; no Node modules at runtime),
  // and naive concat (`app-image://localhost${absolutePath}`) glues the
  // Windows drive-letter `C:` onto 'localhost' to produce host
  // 'localhostc' — the URL parser treats everything up to the first ':'
  // as the host, lower-cases it, and the protocol handler 404s.
  // RESEARCH §F1 + 11-WIN-FINDINGS §F1: 'localhostc/' was the smoking gun.
  //
  // Main resolves the absolute filesystem path to an `app-image://localhost/<pathname>`
  // URL via pathToFileURL().pathname (POSIX-style path with a leading '/'
  // on every platform; on Windows the drive letter ends up inside the
  // pathname segment, NOT the host). The renderer awaits this bridge
  // before assigning img.src in AtlasPreviewModal.tsx.
  //
  // Cross-platform input detection: pathToFileURL's default behavior
  // is platform-dependent — on macOS/Linux it interprets `C:\…` as a
  // POSIX-relative path (treating ':' and '\' as path chars and
  // prepending cwd), which is wrong if a Windows-authored .stmproj is
  // ever opened on a non-Windows host. Detect the leading drive-letter
  // pattern (`[A-Za-z]:`) and pass `{ windows: true }` so the URL is
  // shaped correctly regardless of which OS runs the IPC handler. The
  // converse (POSIX path on Windows) is not a concern for the F1 fix
  // because absolute POSIX paths starting with '/' do not contain ':'
  // and pathToFileURL handles them correctly under either flag set on
  // recent Node versions.
  //
  // typeof===string guard mirrors the 'update:dismiss' precedent above
  // (line 649). Empty-string return on bad input is consistent with the
  // renderer's "set img.src to '' → broken-image icon" fallback. Threat
  // T-12-03-04 (spoofing): the scheme + host are fixed literals controlled
  // by main; renderer-supplied input only contributes to the pathname.
  // Phase 31 PLATFORM-01 — read cached elevation flag. Populated once at
  // app.whenReady() via probeElevation(). No payload, no validation, no I/O.
  // Off-Windows always returns false (probeElevation short-circuits per
  // CONTEXT.md C-D-05); the renderer's idle DropZone advisory therefore only
  // ever surfaces on Windows-when-elevated.
  ipcMain.handle('platform:isElevated', () => getIsElevated());

  ipcMain.handle('atlas:resolve-image-url', (_evt, absolutePath: unknown): string => {
    if (typeof absolutePath !== 'string' || absolutePath.length === 0) return '';
    try {
      // Drive-letter detection: `C:\…` or `c:/…` → force Windows interpretation.
      const isWindowsPath = /^[A-Za-z]:[\\/]/.test(absolutePath);
      const fileUrl = isWindowsPath
        ? pathToFileURL(absolutePath, { windows: true })
        : pathToFileURL(absolutePath);
      return `app-image://localhost${fileUrl.pathname}`;
    } catch {
      // pathToFileURL throws synchronously on bad input (e.g., relative
      // paths). T-12-03-03 mitigation: swallow → empty string fallback.
      return '';
    }
  });

  // Phase 41 VIEWER-03 — atlas-less synth-atlas materialization for the
  // Animation Viewer. The renderer cannot run synthesizeAtlasText
  // (`fs`-bound, lives in `core/`); main re-runs it on demand. Returns
  // the synth atlas text as a base64 `data:` URI plus the per-region PNG
  // absolute-path map; renderer converts absolute paths to
  // `app-image://` URLs via the `pathToImageUrl` bridge.
  //
  // Trust boundary (T-41-01): `typeof` check on skeletonPath + `.json`
  // extension check mirror handleSkeletonLoad's validation shape. No
  // fs read happens before the type guard returns.
  //
  // Errors NEVER throw across the IPC boundary — synth failure is
  // surfaced as `{ ok: false, error: { kind: 'Unknown', message } }`
  // and the viewer renders the terminal-Close error overlay (CONTEXT D-04c).
  ipcMain.handle(
    'viewer:get-asset-feed',
    async (_evt, skeletonPath: unknown): Promise<ViewerAssetFeedResponse> => {
      if (typeof skeletonPath !== 'string' || skeletonPath.length === 0) {
        return { ok: false, error: { kind: 'Unknown', message: 'Invalid skeleton path' } };
      }
      if (!skeletonPath.toLowerCase().endsWith('.json')) {
        return {
          ok: false,
          error: { kind: 'Unknown', message: 'Skeleton path must end in .json' },
        };
      }
      try {
        const parsedJson = JSON.parse(await readFile(skeletonPath, 'utf8'));
        const imagesDir = path.join(path.dirname(skeletonPath), 'images');
        const synth = synthesizeAtlasText(parsedJson, imagesDir, skeletonPath);
        const atlasTextDataUri =
          'data:text/plain;base64,' +
          Buffer.from(synth.atlasText, 'utf8').toString('base64');
        const regionPaths: Record<string, string> = {};
        for (const [regionName, absPath] of synth.pngPathsByRegionName) {
          regionPaths[regionName] = absPath;
        }
        return { ok: true, atlasTextDataUri, regionPaths };
      } catch (err) {
        return {
          ok: false,
          error: { kind: 'Unknown', message: (err as Error).message ?? String(err) },
        };
      }
    },
  );

  // Phase 8 — project file IPC channels (D-140..D-156). Six invoke channels
  // routing to src/main/project-io.ts. Trust-boundary validation lives inside
  // each handler (typeof + extension checks; mirrors handleSkeletonLoad:227-235).
  ipcMain.handle('project:save', async (_evt, state, currentPath) =>
    handleProjectSave(state, currentPath),
  );
  ipcMain.handle('project:save-as', async (_evt, state, defaultDir, defaultBasename) =>
    handleProjectSaveAs(state, defaultDir, defaultBasename),
  );
  // Phase 34 D-06 Step 1 — picker-only handler. Returns OpenDialogResponse
  // three-arm envelope; the renderer dispatches the appropriate load IPC
  // ('project:open-from-path' for kind:'project'; 'skeleton:load' for
  // kind:'skeleton') based on the returned `kind`.
  ipcMain.handle('project:open-dialog', async (_evt) => handleOpenDialog());
  ipcMain.handle('project:open-from-path', async (_evt, absolutePath) =>
    handleProjectOpenFromPath(absolutePath),
  );
  ipcMain.handle('project:locate-skeleton', async (_evt, originalPath) =>
    handleLocateSkeleton(originalPath),
  );
  // D-149 recovery (Approach A): dedicated path-based skeleton-reload channel.
  // Renderer calls this AFTER locate-skeleton resolves, with the user-picked
  // .json path + the overrides/settings cached from the failed Open. Returns
  // OpenResponse so the renderer mounts via the same path used for Open
  // (no new state-machine branch).
  ipcMain.handle('project:reload-with-skeleton', async (_evt, args) =>
    handleProjectReloadWithSkeleton(args),
  );
  // Phase 9 Plan 06 — re-sample on samplingHz change. The renderer dispatches
  // this from SettingsDialog.onApply when the user picks a new rate; main re-
  // runs loader + sampler-worker + buildSummary + stale-key intersect and
  // returns OpenResponse for the same mountOpenResponse seam used for Open.
  // Trust-boundary input checks live inside handleProjectResample
  // (T-09-06-RESAMPLE-INPUT / -HZ / -OVERRIDES). Cancellation works through
  // the existing 'sampler:cancel' handler above (worker.terminate()).
  ipcMain.handle('project:resample', async (_evt, args) =>
    handleProjectResample(args),
  );

  // Phase 20 D-21 — Documentation HTML export channel.
  //
  // Trust boundary: the payload is shaped at the renderer (DocumentationBuilderDialog
  // ExportPane click handler) and crosses IPC via structuredClone. The handler in
  // src/main/doc-export.ts opens a save dialog (user explicitly confirms the path),
  // renders the HTML via the pure renderDocumentationHtml, and writes via atomic
  // Pattern-B (writeFile .tmp + rename). Cancel returns a kind:'Unknown' envelope
  // with message 'Export cancelled' (mirrors the Save As cancel path). T-20-21:
  // path traversal is structurally prevented — main writes only to the absolute
  // path returned by dialog.showSaveDialog, never joins user-supplied components.
  ipcMain.handle('documentation:exportHtml', async (_evt, payload) =>
    handleExportDocumentationHtml(payload as DocExportPayload),
  );

  // Phase 8.2 D-181 — renderer pushes menu state on change. Main rebuilds
  // + reapplies the application Menu on every notify. One-way (ipcMain.on
  // / ipcRenderer.send) — no envelope returned. Silent rejection on bad
  // input (defense-in-depth; preload is the trusted surface).
  //
  // The dynamic `await import('./index.js')` is deliberate (see the comment
  // block at the top of this file): it defers the index.ts ↔ ipc.ts cycle
  // resolution until the first notify, so unrelated test specs that mock
  // `electron` minimally don't fail at module-load time.
  ipcMain.on('menu:notify-state', async (_evt, state: unknown) => {
    // T-08.2-03-01 trust-boundary input validation — same shape as
    // validateExportPlan (ipc.ts:106-126) and the inline checks in
    // handleProjectSave (project-io.ts:97-112).
    if (!state || typeof state !== 'object') return;
    const s = state as Record<string, unknown>;
    if (typeof s.canSave !== 'boolean') return;
    if (typeof s.canSaveAs !== 'boolean') return;
    if (typeof s.canReload !== 'boolean') return;
    if (typeof s.modalOpen !== 'boolean') return;

    const next = {
      canSave: s.canSave,
      canSaveAs: s.canSaveAs,
      canReload: s.canReload,
      modalOpen: s.modalOpen,
    };
    const { applyMenu, getMainWindow, setCurrentMenuState } = await import('./index.js');
    setCurrentMenuState(next);
    // Fire-and-forget — applyMenu awaits loadRecent() internally; we don't
    // block the IPC return on it (one-way channel; no response).
    void applyMenu(next, getMainWindow());
  });
}

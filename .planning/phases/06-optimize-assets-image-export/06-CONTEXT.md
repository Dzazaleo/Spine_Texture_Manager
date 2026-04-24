---
name: Phase 6 — Optimize Assets (image export) Context
description: Locked decisions for Phase 6 — build the per-attachment export plan, run sharp Lanczos3 resize per atlas region, surface streaming progress via the new OptimizeDialog modal. Ships src/core/export.ts (pure-TS plan builder + max-effective-scale dedup per atlas region), src/main/image-worker.ts (main-process sequential sharp loop with cooperative cancel + skip-on-error), src/renderer/src/modals/OptimizeDialog.tsx (folder picker → preview → progress UI with per-file checklist), AppShell toolbar button entry, and one-way IPC progress channel. Adds sharp dependency. Sampler stays LOCKED. CLI stays byte-for-byte unchanged.
phase: 6
---

# Phase 6: Optimize Assets (image export) — Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Source:** `/gsd-discuss-phase 6` interactive session

<domain>
## Phase Boundary

Phase 6 introduces **per-attachment image export** (F8 + N3) — the app reads the per-region peak/override data already computed in Phases 0-5, resizes each source PNG via `sharp` Lanczos3 with PNG compression level 9 + alpha preserved, and writes the optimized images to a user-chosen output directory while preserving the source `images/` directory layout. This is the first phase that actually decodes and writes PNG bytes — until now `core/` has been pure math against atlas metadata.

Ships `src/core/export.ts` (pure-TS plan builder — folds peaks + overrides + unused list into a deduped `ExportPlan` keyed by atlas region path), `src/main/image-worker.ts` (main-process sequential sharp loop with pre-flight validation, cooperative cancellation, per-file error skipping, and one-way progress events), `src/renderer/src/modals/OptimizeDialog.tsx` (hand-rolled ARIA modal cloning the OverrideDialog pattern — folder picker on entry, file list preview + Start, then linear progress bar + per-file checklist + post-export summary), AppShell toolbar button entry point next to the filename chip, and a new one-way IPC progress channel layered onto the existing request/response surface. Adds `sharp` as a dependency (first native binary in the bundle).

Sampler stays LOCKED. CLI stays byte-for-byte unchanged (Phase 5 D-102). Animation Breakdown panel + Global panel + override dialog stay untouched. Layer 3 (`src/core/*` DOM/fs-free) preserved — only `src/main/image-worker.ts` imports `sharp` and `node:fs`.

**In scope:**
- `src/core/export.ts` — **new pure-TS module**. Exports `buildExportPlan(summary: SkeletonSummary, overrides: Map<string, number>): ExportPlan`. Folds the existing `summary.peaks` (DisplayRow[]) + Phase 4 `applyOverride()` + Phase 5 `summary.unusedAttachments` into a deduped, atlas-region-keyed list of `ExportRow` entries. Pure number/object math; no `fs`, no `sharp`, no Electron. Unit-tested via vitest.
- `src/shared/types.ts` — **extension target**. Add `ExportRow` (one per atlas region: `sourcePath`, `outPath`, `sourceW`, `sourceH`, `outW`, `outH`, `effectiveScale`, `attachmentNames: string[]` for traceability), `ExportPlan` (`{ rows: ExportRow[], excludedUnused: string[], totals: { count, sourceBytes?, estimatedOutBytes? } }`), `ExportProgressEvent` (`{ index, total, path, outPath, status: 'success' | 'error', error?: ExportError }`), `ExportError` (discriminated union: `'missing-source' | 'sharp-error' | 'write-error'` + `path` + `message`), `ExportSummary` (`{ successes: number, errors: ExportError[], outputDir: string, durationMs: number }`). All structuredClone-safe.
- `src/main/image-worker.ts` — **new**. Exports `runExport(plan: ExportPlan, outDir: string, onProgress: (e: ExportProgressEvent) => void, isCancelled: () => boolean): Promise<ExportSummary>`. Pre-flight validates each `sourcePath` exists/readable; missing files become `'missing-source'` errors emitted as their own progress event without invoking sharp. For each surviving row: write to `<outPath>.tmp` via sharp Lanczos3, then `fs.rename` to final `outPath` (atomic). Per-file error → skip + emit `'sharp-error'` or `'write-error'` event + continue. Sequential — one sharp call in flight at a time. Between files: check `isCancelled()`; if true, stop dispatching new files (in-flight call already finished) and resolve with the current summary. Imports `sharp`, `node:fs/promises`, `node:path` — Layer 3 arch boundary preserved (only `src/main/*` allowed to do this).
- `src/main/ipc.ts` — **touched**. Add `'export:start'` (request/response → returns `ExportSummary` when done or cancelled), `'export:cancel'` (one-way → flips an internal cancel flag for the running export). Add `'export:progress'` as a one-way `webContents.send` channel keyed by the BrowserWindow that started the export. Reject re-entrant `export:start` while one is running (return `{ kind: 'already-running' }` typed error).
- `src/preload/` — **touched**. Extend the contextBridge `Api` interface with `startExport(plan: ExportPlan, outDir: string): Promise<ExportSummary>`, `cancelExport(): void`, `onExportProgress(handler: (e: ExportProgressEvent) => void): () => void` (returns an unsubscribe). Picker is invoked separately via the existing pattern (planner picks: extend `Api` with `pickOutputDirectory(): Promise<string | null>` invoking Electron `dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })`).
- `src/renderer/src/components/AppShell.tsx` — **touched**. Add toolbar button "Optimize Assets" next to the filename chip in the top chrome (Phase 3 D-49/D-50). Enabled when `summary` is loaded AND no export is running. Click handler: invoke picker → on directory chosen, mount `<OptimizeDialog>` with `{ plan, outDir }`. On dialog close, unmount.
- `src/renderer/src/modals/OptimizeDialog.tsx` — **new**. Clones the `OverrideDialog` ARIA pattern (focus-trap, ESC, click-outside, `role="dialog"` + `aria-modal="true"` + `aria-labelledby`, hand-rolled — no modal library per Phase 4 D-81). Two states:
  1. **Pre-flight (initial)**: header `Optimize Assets — N images → <outDir>`. Body: scrollable file list (atlas region path → output dims → source dims → `~ Xx smaller`). Footer: `Start` (primary) + `Cancel` (secondary). If `excludedUnused.length > 0`, show a muted note `"M unused attachments excluded — see Global panel."`
  2. **In-progress / Complete**: linear progress bar at top (`X of N — [bar] — current file path`), scrollable per-file list with status icons (idle ○ / in-progress · / done ✓ / error ⚠ in `--color-danger`); error rows expandable inline showing the error message. Footer during run: `Cancel`. On completion: bar at 100%, summary line `"N succeeded, M failed in Xs"`, footer swaps to `Open output folder` (calls Electron `shell.showItemInFolder` via preload) + `Close`.
- `src/renderer/src/index.css` — **untouched**. The `--color-danger` token from Phase 5 D-104 covers export error rows.
- Tests:
  - `tests/core/export.spec.ts` — **new**. Cases: (a) SIMPLE_TEST → 4 ExportRows (CIRCLE, SQUARE, SQUARE2, TRIANGLE) with effective scale = peakScale, dims = `Math.round(sourceW × peakScale)`; (b) override 50% on TRIANGLE → out dims = `Math.round(sourceW × 0.5)`; (c) override 200% on SQUARE → applyOverride clamps to 100% → out dims = `sourceW × 1.0` = source; (d) two attachments share the same atlas region with different peaks → ExportRow.outW = `Math.round(sourceW × max(peaks))`; (e) ghost fixture (Phase 5) → ExportPlan.rows excludes GHOST, ExportPlan.excludedUnused includes 'GHOST'; (f) Math.round half-rounding behavior (e.g., `127.5 → 128`); (g) hygiene grep — no `fs`/`sharp`/`spine-core` imports in `src/core/export.ts`.
  - `tests/main/image-worker.spec.ts` — **new** (or extends `tests/main/`). Mocked sharp + fs cases: (a) all-success → emits N events all `'success'`, summary has 0 errors; (b) one missing source → emits `'missing-source'` event for that path + continues, others succeed; (c) sharp throws on file 3 of 5 → emits `'sharp-error'` event, files 4-5 still process; (d) cancel flag set after file 2 → file 2 in-flight finishes, file 3 starts is checked, loop bails, summary returned; (e) atomic write — `<outPath>.tmp` exists during write, `fs.rename` performs the swap; (f) re-entrant `export:start` → IPC rejects with `'already-running'`.
  - `tests/arch.spec.ts` — Layer 3 auto-scans `src/core/export.ts` for `fs`/`sharp`/DOM violations. Add explicit grep patterns if not auto-covered: `tests/arch.spec.ts` already scans `src/core/*` for forbidden imports; add `sharp` and `node:fs` (and `fs/promises`) to the forbidden list if not present.
  - Renderer modal test — planner's call (consistent with Phase 4 D-83/D-86 — Testing Library or happy-dom). Must include: dialog opens with file list, Start triggers preload.startExport, progress events update bar + list, Cancel triggers preload.cancelExport, completion swaps footer buttons, error row expansion shows error message.

**Out of scope (deferred to later phases or explicit Out of Scope per REQUIREMENTS.md):**
- **Multi-JSON shared-images export.** Future feature where multiple skeleton JSONs share an `images/` folder; the export plan would need to merge max effective scale per region across all loaded rigs. Phase 6 builds the export plan from ONE `summary` at a time. The `buildExportPlan` signature is intentionally narrow so a future `mergeExportPlans(plans: ExportPlan[]): ExportPlan` is a pure addition.
- **Worker_threads migration.** Phase 6 keeps sharp on the main process. If Phase 9 hardening shows main-process responsiveness suffering at 300+ files, lifting the export loop into `node:worker_threads` is a one-file refactor — `image-worker.ts` is named for this. Out of Phase 6.
- **Atlas re-packing.** REQUIREMENTS.md "Out of scope" — we only resize images. The user re-runs Spine's atlas packer on the new images.
- **Output format options.** Always PNG. JPEG/WebP are post-MVP.
- **Resume-from-partial export.** Re-running export against the same outDir overwrites all files. No "skip files that already exist at target dims" optimization in Phase 6.
- **Save/Load of last-used outDir.** Phase 8 (F9) covers session state. Phase 6 keeps no memory between runs.
- **Drag-and-drop output folder.** OS folder picker only (F8.1).
- **Batch operations from the panel selection.** Phase 6 export operates on the FULL plan derived from the loaded skeleton — selection in Global panel does not subset the export. (Future setting if requested.)
- **Configurable concurrency.** Sequential is locked for Phase 6. If Phase 9 / Settings adds knobs, that's its own surface.
- **Cancellation that aborts an in-flight sharp call (mid-libvips).** libvips can't be cleanly interrupted mid-resize; cooperative cancel between files is the contract. Aborting in-flight is out of scope.
- **CLI export command.** CLI stays byte-for-byte (D-102). No `scripts/cli.ts --export` flag.
- **Animation Breakdown panel changes.** No.

</domain>

<decisions>
## Implementation Decisions

### Export plan + output semantics (Area 1)

- **D-108: Export unit = atlas region / source PNG file (one ExportRow per unique source image path).** When multiple attachments reference the same atlas region with different peak scales, dedup using `max(effectiveScale)` across all referencing attachments so the most-zoomed user's render quality is preserved. Output is the same `images/` structure F8.3 mandates — one PNG per region. Rejected: per-attachment-name dedup (works for Spine's common case but fails when `attachment.path` differs from name); per-(skin, slot, attachment) (no dedup → same PNG resized N times to potentially different dims, wrong for the single output folder goal). Implementation: walk `summary.peaks` (DisplayRow[]), group by `sourcePath` (planner determines: this is the atlas region path; if not exposed in DisplayRow, thread it through `src/core/analyzer.ts` — DisplayRow already carries `sourceW`/`sourceH` so the source identity must be reachable; verify in research).

- **D-109: Unused attachments excluded by default (Phase 5 D-99 resolution).** The Phase 5 `summary.unusedAttachments` list is subtracted from the export plan input. Their atlas regions never get resized; the output `images/` folder ships only what the rig actually renders. Excluded names are surfaced in `ExportPlan.excludedUnused` so the OptimizeDialog pre-flight can show a muted `"M unused attachments excluded"` line, and Phase 5's red-header section on the Global panel remains the discoverability path. Rejected: include-at-100% (ships dead pixels — defeats the point of the tool); settings toggle (premature UI surface; revisit if user requests). Future toggle path: `buildExportPlan(..., { includeUnused?: boolean })` — pure addition.

- **D-110: Output pixel dimensions = `Math.round(sourceW × effectiveScale)` × `Math.round(sourceH × effectiveScale)`.** Both axes use the SAME `effectiveScale` (locked from memory: uniform-only export sizing — anisotropic export breaks Spine's UV sampling contract; the engine samples meshes via UVs against whatever dims the exported image actually has, and squishing one axis deforms the rendered result). Math.round = round-half-away-from-zero (JavaScript default). Minimizes max pixel error vs floor (which silently drops a pixel at peakScale 0.999) or ceil (which over-allocates by <1px). Sub-pixel error has zero visible effect on Lanczos3 output. Test fixture: `Math.round(127.5)` = 128; `Math.round(127.4)` = 127.

- **D-111: Effective scale resolution.** No override → `effectiveScale = row.peakScale` (the floor-free engine-computed peak from Phase 0/3). Override set (X%) → `effectiveScale = clampOverride(X) / 100` via `applyOverride` from `src/core/overrides.ts` (Phase 4 D-91). The export plan reads the same `overrides: Map<string, number>` AppShell already owns. No new override resolution logic — `src/core/export.ts` calls Phase 4's existing pure functions.

- **D-112: Pre-flight validation reads each source PNG path before sharp runs.** `runExport` walks the plan once and for each row attempts `fs.access(sourcePath, R_OK)`. Files that pass proceed to the sharp loop; files that fail are surfaced as their own progress event with `status: 'error', error: { kind: 'missing-source', path, message }` and skipped — no sharp call is made for them. This gives the user a fast, deterministic error list for missing inputs (typical cause: user moved/renamed PNGs after loading the skeleton) without abandoning the export. Rejected: pre-flight that fails the whole export (too aggressive for partial-success workflows); no pre-flight (sharp's per-file errors are less controllable + emit ENOENT messages that aren't user-friendly).

### Worker architecture + concurrency (Area 2)

- **D-113: Sharp runs in the main Electron process.** Async concurrent calls; no `node:worker_threads`, no Electron utility process. Rationale: libvips (sharp's native backend) already uses its own thread pool for the resize op itself — adding worker_threads on top doesn't speed up a single sequential resize. Confirmed against the future 300+ image case (user-noted): main-process JS layer is mostly I/O-bound; libvips holds the cores during the resize; main-process responsiveness for IPC + DevTools + timer ticks remains acceptable. Migration path preserved: `src/main/image-worker.ts` is named for a future lift into a worker module if Phase 9 hardening demands it. Rejected: worker_threads (complexity without speedup at sequential = 1); utility process (overkill).

- **D-114: Concurrency = 1 sharp call in flight at a time (sequential).** Bounded peak memory (a single 4K PNG decoded in libvips can transiently use ~50–200 MB; running 4 in parallel could spike to 1 GB+ on rigs with large source assets). Clean per-file progress events (one event per file, in order). Confirmed for the 300+ image future case: at ~100–500ms per file, 300 files = 30s–2.5min wall clock — tolerable with the streaming progress UI. Rejected: fixed 4 / CPU count (memory pressure + main-process congestion); configurable (premature UI surface).

- **D-115: Cancellation = cooperative finish-in-flight + stop-new + keep-partial-output.** Renderer calls `api.cancelExport()` → main flips an internal `cancelFlag`. Between files, the loop checks `isCancelled()`; if true, the loop bails after the current file finishes (libvips can't be cleanly interrupted mid-resize). Already-completed output files stay on disk — re-running export against the same outDir simply overwrites them. The `ExportSummary` returned to the renderer carries `successes` for the completed-before-cancel files plus a `cancelled: true` flag. Rejected: roll-back-all-output (cleanup adds blast radius; user already chose the output dir intentionally); abort-in-flight-with-unlink (libvips uninterruptible; Windows file-handle semantics make partial-write cleanup unreliable).

- **D-116: Per-file errors skip the file and continue.** A single corrupt PNG, sharp internal error, disk write fault, or path-traversal violation does NOT halt the export. Each error is collected as `ExportError { kind, path, message }` and emitted on the progress channel as `{ status: 'error', ... }` for the renderer's per-file checklist. The `ExportSummary` aggregates all errors. Rationale: partial success is more useful than total failure for long exports — at 300 files, file 47's bad color profile shouldn't waste 4 minutes of completed work. Rejected: stop-on-first-error (too brittle for 300+ file batches); retry-once (transient flakiness is rare on local disks; complexity not warranted).

### Progress protocol + OptimizeDialog UX (Area 3)

- **D-117: Entry point = persistent toolbar button "Optimize Assets" in AppShell, next to the filename chip.** Visible from any tab (Global panel + Animation Breakdown). Enabled when `summary` is loaded AND no export is running; disabled (greyed) otherwise. Phase 3 D-49/D-50 already established AppShell as the owner of global top-chrome actions. Rejected: Global panel header (hidden behind a tab — user thinks they need to be on a specific tab to export); Electron native menu (less discoverable; would introduce a native menu surface we don't otherwise have).

- **D-118: Two-step UX flow on click.** Step 1: invoke OS folder picker via Electron `dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })`. If user cancels, no dialog mounts. Step 2: if a directory was chosen, AppShell mounts `<OptimizeDialog plan={buildExportPlan(summary, overrides)} outDir={chosenDir} />`. Dialog opens in pre-flight state showing the file list preview + Start/Cancel. User confirms before bytes move. Rationale: the picker-first flow mirrors typical OS export workflows (Save As → confirm); the preview gives the user a confidence check on the file count + dim transformations. Rejected: dialog-first-with-internal-picker (folder choice feels like a parameter rather than a gate; harder to reason about pre-flight state machine); picker-then-immediate-export (no opportunity to abort before bytes move; less confidence-inspiring).

- **D-119: Streaming progress = per-file events on a one-way IPC channel.** Event shape: `ExportProgressEvent { index: number, total: number, path: string, outPath: string, status: 'success' | 'error', error?: ExportError }`. One event per file completion (success or error). Channel: main → renderer one-way via `webContents.send('export:progress', event)`; renderer subscribes through preload `api.onExportProgress(handler) → unsubscribe`. Cancellation: separate channel `api.cancelExport()` → main IPC handler flips the cancel flag (per D-115). Event rate is bounded by sequential file processing cadence — at ~100ms/file fast, ~10 events/sec; at 500ms/file, 2 events/sec. No throttling needed at this rate. Rejected: batched events (loses per-file granularity needed for the per-file checklist UI); single done-event with periodic % ticks (no per-file error surfacing during the run).

- **D-120: Progress UI = linear bar + scrollable per-file checklist + post-export summary.** Layout during run: header `"Optimize Assets — X of N → <outDir>"`, top region `<linear progress bar 0..N>` + current-file caption (`"Resizing body/arm.png…"`), main region scrollable file list with one row per ExportRow showing status icon (idle `○` / in-progress `·` / done `✓` / error `⚠`) + atlas region path + `sourceW×H → outW×H`, footer `<Cancel>`. Error rows expand inline on click revealing the error message in `--color-danger` (Phase 5 D-104 token). On completion: bar fills to N, summary line `"N succeeded, M failed in Xs"` (or `"N succeeded, M failed, cancelled"` if cancelled), footer swaps to `<Open output folder>` (Electron `shell.showItemInFolder` via preload) + `<Close>`. Modal stays modal — user must close before re-running. Rejected: progress-bar-only-with-post-export-error-list (no live error visibility on long runs); per-file-checklist-only (no global progress for 300+ rigs).

### Claude's Discretion (not user-discussed; planner picks within these guardrails)

- **File collision policy at output dir.** Default: overwrite without prompt. Rationale: F8.4 ("never modify originals") protects the SOURCE. The output dir is the user's chosen optimized folder; re-running export against it should refresh the contents — that's the workflow. Atomic-write protocol (D-121 below) prevents torn files. If the user picks a non-empty unrelated directory by mistake, that's a user-error path; no special guardrail in Phase 6. Future Phase 9 polish could add a "directory contains N unrelated files — overwrite/cancel?" prompt.

- **D-121 [discretion]: Atomic write per file.** Write to `<outPath>.tmp` first via `sharp(...).toFile(<outPath>.tmp)`, then `fs.rename(<outPath>.tmp, <outPath>)`. Prevents torn files on cancel/crash mid-write. Standard Node atomic-write pattern. Cleanup path: if a `.tmp` file remains from a prior crashed run, the next sharp write to the same path silently overwrites it — no orphaned-tmp scan needed.

- **D-122 [discretion]: Default output dir suggestion in the picker.** Pre-fill the folder picker `defaultPath` with `<skeleton_dir>/images-optimized/` (the parent of the loaded skeleton JSON + a sibling folder name). Electron's `dialog.showOpenDialog({ defaultPath, properties: ['openDirectory', 'createDirectory'] })` honors this on macOS + Windows. User can navigate elsewhere. The folder need not exist — `createDirectory` lets the picker create it on confirm. Validation: if user picks the source `images/` folder itself or a child of it, reject with a typed error and re-prompt (prevents accidental in-place overwrite of source files; defends F8.4 at the boundary).

- **D-123 [discretion]: Sharp version + Electron packaging for N4.2.** Pin `sharp` to a release that ships prebuilt binaries for Node 22 / Electron 41 ABI on darwin-arm64 + darwin-x64 + win32-x64 + linux-x64 (sharp ≥ 0.33 covers this via `prebuild-install`). Add `electron-builder` config `asarUnpack: ['**/node_modules/sharp/**']` so the native binaries are extracted from asar at install time (sharp's `dlopen` doesn't work from inside asar). Verify by running `npm run build` and inspecting the produced `.app` / `.dmg` for the unpacked `sharp/build/Release/*.node` files. If the existing electron-builder.yml needs updating, planner does so. Planner verifies via Context7 query against sharp + electron-builder docs.

- **ExportRow source-path derivation.** Planner determines the source-of-truth for source PNG path. Spine's atlas typically lists regions by name; the `images/` folder under the same dir as the atlas typically contains `<regionName>.png` (or `<regionPath>.png` if the region declares a `path` attribute). The loader and sampler already process this metadata — planner extends the analyzer fold to thread the resolved source PNG path through to ExportRow. If the atlas-region-path data isn't currently surfaced in DisplayRow, the planner adds the field (Phase 5 D-101 pattern: extend SkeletonSummary, structuredClone-safe, no new IPC channel).

- **OptimizeDialog component structure.** Hand-rolled per Phase 4 D-81. Single file `src/renderer/src/modals/OptimizeDialog.tsx`. May extract small subcomponents (FileListRow, ProgressBar) inline or to `src/renderer/src/components/` if reused — planner's call. No modal library.

- **Toolbar button styling.** Reuse warm-stone tokens from Phase 1 D-12/D-14. Button label `"Optimize Assets"`. Position: AppShell top chrome, right-aligned next to the filename chip. Icon optional (Unicode glyph or none — consistent with Phase 5 D-104 hand-rolled glyph approach).

- **Renderer test approach.** Phase 4 left this open; planner picks Testing Library or happy-dom consistent with prior phase choice. Core export.spec.ts is pure-TS in vitest regardless.

- **Pre-flight file size readout.** OptimizeDialog pre-flight CAN show estimated file-size delta if the planner judges it cheap. Not required. F7 (Atlas Preview) covers the size-readout deeply; Phase 6 may stay lean.

- **Threat-model lite.**
  - Validate `outDir` is not the source `images/` folder or a child of it (path-prefix check via `path.relative` — reject if relative starts with `..` is the inverse of "is child"). Defends F8.4 at the OS boundary.
  - Validate each `outPath` resolves under `outDir` (`path.resolve(outDir, ...).startsWith(path.resolve(outDir))`) to prevent path-traversal via malicious `attachment.path` strings (e.g., `../../etc/passwd.png`). Reject as `'write-error'` event.
  - sharp is given untrusted PNG inputs — sharp/libvips have a strong track record but planner verifies no known CVE flags relevant to the pinned version (Context7 + npm audit).
  - No network I/O in Phase 6. No telemetry. Output is local-disk only.

- **Empty-export edge case.** If `summary.peaks.length === 0` (skeleton has no rendered attachments — impossible on real rigs but possible on a degenerate fixture), the toolbar button can be enabled and the OptimizeDialog opens showing "No images to export" + only Cancel. Planner picks: silently disable the button OR show the empty dialog. Either is fine.

- **Multi-tab Electron windows.** Out of scope. App is single-window for v1.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth
- `~/.claude/plans/i-need-to-create-zesty-eich.md` §"Phase 7/8 — export" — approved-plan numbering offset; canonical narrative for the export pipeline + sharp Lanczos3 + folder picker UX.

### Project instructions
- `CLAUDE.md` — rule #4 (the math phase does not decode PNGs; **inverse**: Phase 6 IS where PNGs get decoded — only `src/main/*` may import sharp / `node:fs`). Rule #5 (`src/core/*` is pure TS, no DOM, no fs) — `src/core/export.ts` is the plan builder ONLY; the sharp + fs work lives in `src/main/image-worker.ts`. Rule #3 (sampler tick lifecycle) — Phase 6 makes ZERO sampler changes.

### Requirements
- `.planning/REQUIREMENTS.md` §F8 (Optimize Assets):
  - F8.1 Export button opens a folder picker → D-117 + D-118.
  - F8.2 `sharp.resize(targetW, targetH, { kernel: 'lanczos3', fit: 'fill' })` → image-worker per-file invocation. Dims via D-110 (Math.round, uniform).
  - F8.3 Preserve directory structure of the source `images/` layout → ExportRow.outPath mirrors atlas region path.
  - F8.4 Never modify original source files → enforced by D-121 (atomic write to outDir only) + D-122 (reject outDir == source/images).
  - F8.5 Progress UI with per-file error surfacing → D-119 + D-120.
- `.planning/REQUIREMENTS.md` §N3 (Quality preservation):
  - N3.1 Lanczos3, PNG compression level 9, alpha preserved → sharp call options.
  - N3.2 Visually indistinguishable from Photoshop-Lanczos at same dims → exit-criteria spot-check during human-verify.
- `.planning/REQUIREMENTS.md` §N4 (Portability):
  - N4.1 Signed .dmg + .exe → packaging path stays on Phase 1's electron-builder.yml.
  - N4.2 No native compile for end users → D-123 (sharp prebuilds + asarUnpack).

### Locked override / overrides math
- `.planning/phases/04-scale-overrides/04-CONTEXT.md` §"Implementation Decisions / Override semantics":
  - **D-91** — `applyOverride(percent) → { effectiveScale: clampedPercent / 100 }`. Peak scale is no longer in the math. Default (no override) → effective = peakScale. With override → effective = X / 100.
  - **D-75/D-76** — `clampOverride` clamps to [1, 100]; key-absent in the overrides map = "no override". `src/core/overrides.ts` is pure-TS clamp + applyOverride; the renderer copy at `src/renderer/src/lib/overrides-view.ts` is byte-identical (Layer 3 boundary).
- **Memory: Phase 6 export sizing — LOCKED uniform-only** (`/Users/leo/.claude/projects/-Users-leo-Documents-WORK-CODING-Spine-Texture-Manager/memory/project_phase6_default_scaling.md`) — output dims must be `Math.round(sourceW × effectiveScale)` × `Math.round(sourceH × effectiveScale)` with the SAME effectiveScale on both axes. Anisotropic export breaks Spine's UV sampling contract (the engine samples meshes via UVs against whatever dims the exported image actually has; squishing one axis deforms the rendered result). D-110 implements this rule.

### Locked unused-attachment surface
- `.planning/phases/05-unused-attachment-detection/05-CONTEXT.md`:
  - **D-99** — Unused and peak rows are disjoint. Phase 6 reads the disjoint sets to subtract `summary.unusedAttachments` from the export plan.
  - **D-101** — `summary.unusedAttachments: UnusedAttachment[]` shape (attachmentName, sourceW, sourceH, definedIn[], dimVariantCount, sourceLabel, definedInLabel). All structuredClone-safe; available on the existing IPC payload — no new channel.
  - **D-104** — `--color-danger #e06b55` `@theme` token reusable for export error rows in OptimizeDialog (D-120).

### Locked IPC + AppShell patterns
- `.planning/phases/01-electron-react-scaffold/01-CONTEXT.md`:
  - **D-21** — SkeletonSummary is the locked IPC payload; everything is structuredClone-safe (no Map, no Float32Array, no class instances). Phase 6 ExportRow / ExportPlan / ExportProgressEvent / ExportError / ExportSummary all follow this rule — plain primitives + arrays + nested plain objects.
  - **D-10** — LoadResponse + SerializableError envelope pattern. Phase 6 export `'export:start'` IPC follows the same `{ ok: true, data } | { ok: false, error }` envelope shape (planner verifies — Context7 against existing src/main/ipc.ts).
  - **D-07** — `Api` interface exposed via contextBridge in preload. Phase 6 extends with `startExport`, `cancelExport`, `onExportProgress`, `pickOutputDirectory` methods.
- `.planning/phases/03-animation-breakdown-panel/03-CONTEXT.md`:
  - **D-49 / D-50** — AppShell owns the top chrome (filename chip + tab buttons). Phase 6 toolbar button "Optimize Assets" goes here (D-117).

### Locked modal pattern
- `.planning/phases/04-scale-overrides/04-CONTEXT.md` §"Dialog accessibility + keyboard wiring":
  - **D-81** — Modal ARIA pattern: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus-trap, ESC closes, click-outside closes, Tab cycles, Enter on primary triggers Apply equivalent. OptimizeDialog clones this pattern. Hand-rolled — no modal library.

### CLI lock
- `.planning/phases/05-unused-attachment-detection/05-CONTEXT.md` **D-102** — `scripts/cli.ts` stays byte-for-byte. No `--export` flag, no export coverage in CLI. Phase 6 is renderer-only on the CLI side (the CLI doesn't see Phase 6).

### Architecture boundary
- `tests/arch.spec.ts` — Layer 3 grep guard. `src/core/*` forbidden imports must include `sharp` and `node:fs` / `fs/promises` after Phase 6 (planner verifies the pattern list and adds if missing — same grep mechanism that Phase 4 D-77 / Phase 5 ghost-fixture tests rely on).

### External docs (planner verifies via Context7)
- `https://sharp.pixelplumbing.com/api-resize/` — sharp resize API; `kernel: 'lanczos3'` + `fit: 'fill'`; `.png({ compressionLevel: 9 })`; alpha behavior.
- `https://sharp.pixelplumbing.com/install/` — Electron + prebuilt-binary install path; `asarUnpack` requirement.
- `https://www.electronjs.org/docs/latest/api/dialog#dialogshowopendialogbrowserwindow-options` — folder picker; `properties: ['openDirectory', 'createDirectory']` + `defaultPath`.
- `https://www.electronjs.org/docs/latest/api/web-contents#contentssendchannel-args` — one-way IPC for progress events.
- `https://www.electronjs.org/docs/latest/api/shell#shellshowiteminfolderfullpath` — "Open output folder" button on completion.
- `https://www.electron.build/configuration/contents#asarunpack` — electron-builder asarUnpack for native binaries.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/core/overrides.ts` — `applyOverride(percent: number): { effectiveScale: number, clamped: boolean }` (Phase 4 D-91 semantics). Phase 6's `buildExportPlan` calls this directly to resolve effective scale per row. Pure-TS; no Layer 3 violation.
- `src/core/analyzer.ts` — per-attachment fold pattern producing `DisplayRow[]`. `src/core/export.ts` follows the same fold-then-format style: read SkeletonSummary fields → produce a flat array of structuredClone-safe rows.
- `src/shared/types.ts` — Phase 1 D-21 lock for IPC types. Phase 6 extends here with ExportRow, ExportPlan, ExportProgressEvent, ExportError, ExportSummary. Same plain-primitive discipline.
- `src/main/ipc.ts` — existing IPC handler scaffold for `'skeleton:load'`. Phase 6 extends with `'export:start'`, `'export:cancel'` (request/response) + `'export:progress'` (one-way `webContents.send`).
- `src/main/summary.ts` — projection layer Phase 6 may need to extend if the atlas-region source path isn't currently exposed on DisplayRow. Phase 5 D-101 pattern (single-call-site extension) applies.
- `src/preload/` — contextBridge surface; Api interface gets new methods.
- `src/renderer/src/components/AppShell.tsx` — owns top chrome; toolbar button mounts here. Already manages `dialogState` (Phase 4) + `overrides` map + `summary` — Phase 6 adds `exportDialogState` (or merges into existing dialogState) + reads `overrides`.
- `src/renderer/src/modals/OverrideDialog.tsx` — hand-rolled ARIA modal. Phase 6 OptimizeDialog clones the pattern (focus-trap, ESC, click-outside, role=dialog, aria-modal=true, aria-labelledby). Same warm-stone token vocabulary.
- `src/renderer/src/index.css` `--color-danger` (Phase 5 D-104) — error row color in OptimizeDialog progress checklist.

### Established Patterns

- **Pure-TS core ↔ DOM/I/O outer (Layer 3 arch.spec.ts).** Phase 6 preserves this: `src/core/export.ts` has no fs/sharp/Electron; all native + I/O work lives in `src/main/image-worker.ts`. Renderer never reaches main-process modules directly — only via preload contextBridge.
- **IPC types extend `src/shared/types.ts` with structuredClone-safe shapes** — no Map, no class instances, no Float32Array. Maps in Phase 4 (overrides) are renderer-side only.
- **Modals are hand-rolled** (no library deps per Phase 4 D-81). Phase 6 OptimizeDialog continues the pattern.
- **Tailwind v4 `@theme inline` warm-stone tokens.** No new tokens needed in Phase 6 — `--color-danger` from Phase 5 covers error UI.
- **CLI byte-for-byte unchanged** — `scripts/cli.ts` does not learn export.

### Integration Points

- AppShell `<button>Optimize Assets</button>` → click handler → `api.pickOutputDirectory()` → on result: build plan via `buildExportPlan(summary, overrides)` (renderer-side, since `src/core/export.ts` is pure-TS and importable by the renderer through `src/renderer/src/lib/export-view.ts` if Layer 3 arch demands a renderer copy — planner picks: a renderer copy mirroring the Phase 4 `overrides-view.ts` pattern, OR build the plan in main and pass it back via the picker IPC. Most likely: renderer builds the plan from local `summary` + `overrides` because both already live in the renderer; the plan is then passed to main via `api.startExport(plan, outDir)`).
- `<OptimizeDialog plan outDir />` → on Start: `api.startExport(plan, outDir)` resolves to `ExportSummary` after the run completes or is cancelled. Subscribes to `api.onExportProgress(handler)` for live updates. On Cancel: `api.cancelExport()` (one-way). On Open output folder: `api.openOutputFolder(outDir)` (one-way; calls `shell.showItemInFolder`).
- Main process `'export:start'` handler → `runExport(plan, outDir, onProgress, isCancelled)` from `src/main/image-worker.ts` → emits `webContents.send('export:progress', event)` per file → returns `ExportSummary`.

</code_context>

<specifics>
## Specific Ideas

- **F8.2 sharp call signature** (verbatim per requirement): `sharp(srcPath).resize(targetW, targetH, { kernel: 'lanczos3', fit: 'fill' }).png({ compressionLevel: 9 }).toFile(outPath)`. Alpha is preserved by sharp by default for PNG output unless the input is dropped to an alphaless format. Planner verifies via Context7.
- **N3.2 visual spot-check** during Phase 6 human-verify: take one CIRCLE.png at peakScale ≈ 0.7, run through Photoshop's Image Size with Lanczos sampling at the same target dims, and compare side-by-side in an image diff tool. No automated golden — visual inspection is sufficient (the requirement is "no perceptible difference", not "byte-equal").
- **Future 300+ image case** (user-noted forward-looking context): a planned future feature where multiple skeleton JSONs share an `images/` folder and the export plan merges across rigs. Phase 6 architecture (sequential sharp on main process) scales cleanly — at ~100–500ms per file × 300 files = 30s–2.5min wall clock. Worker_threads migration is preserved as a Phase 9 fallback if responsiveness suffers; the `image-worker.ts` filename is intentional.
- **Locked default for unused-handling** is "exclude" — but the `buildExportPlan` signature should accept a future `{ includeUnused?: boolean }` option as a pure-TS addition without IPC churn. Implementation: `function buildExportPlan(summary, overrides, opts?: { includeUnused?: boolean }): ExportPlan`. Default `false`. UI surface for the toggle is post-Phase 6.
- **Atomic write naming convention.** `<outPath>.tmp` (e.g., `images/CIRCLE.png` writes to `images/CIRCLE.png.tmp` then renames). Two concurrent exports against the same outDir are NOT supported (D-115 rejects re-entrant `'export:start'`).
- **OptimizeDialog "Open output folder" button** uses `shell.showItemInFolder(outDir)` — this opens Finder/Explorer with the directory selected. If Spine atlas paths produce nested subdirs (e.g., `images/body/arm.png`), the button still opens the top-level outDir.

</specifics>

<deferred>
## Deferred Ideas

- **Multi-JSON shared-images export.** Future feature: load N skeleton JSONs, merge max effective scale per atlas region across all rigs, export once. Drives the Phase 6 architecture choice (sequential sharp scales to 300+) but is NOT in Phase 6 scope. Belongs in a post-MVP milestone or its own phase.
- **Worker_threads migration.** If Phase 9 hardening reveals main-process responsiveness suffering at 300+ files, lift the export loop into `node:worker_threads`. `src/main/image-worker.ts` is named for this; the function signature `runExport(plan, outDir, onProgress, isCancelled)` is worker-pool friendly.
- **Configurable sharp concurrency.** Settings UI knob; only useful if D-114 sequential proves too slow on real rigs. Phase 9 polish.
- **Resume-from-partial export.** Skip files that already exist at target dims when re-running export against the same outDir. Cheap to add (pre-flight checks `fs.stat(outPath)` + sharp metadata read for dims comparison) but not Phase 6.
- **Atlas re-pack** — REQUIREMENTS.md "Out of scope". User runs Spine's atlas packer post-export.
- **Output format options (JPEG, WebP).** Always PNG in Phase 6.
- **Drag-and-drop output folder.** OS folder picker only.
- **Save/Load last-used outDir.** Phase 8 (F9) covers session state.
- **Batch-export from panel selection.** Phase 6 export operates on the FULL plan derived from the loaded skeleton.
- **CLI export command.** D-102 byte-for-byte lock.
- **Settings toggle for "Include unused attachments".** Pure-TS plumbing path is reserved (D-109 future toggle path), UI surface deferred.
- **In-flight sharp abort (mid-libvips).** libvips uninterruptible; cooperative-between-files cancel is the contract.
- **File-size delta readout in pre-flight.** Phase 7 (Atlas Preview) covers the size-readout deeply; Phase 6 stays lean.
- **Multi-tab / multi-window Electron.** Out of scope. App is single-window for v1.
- **Re-running export with an override change** — every export run reads current AppShell `overrides` map; no Phase 6 caching. User changes overrides + re-runs = new output.

</deferred>

---

*Phase: 06-optimize-assets-image-export*
*Context gathered: 2026-04-24 via /gsd-discuss-phase 6*

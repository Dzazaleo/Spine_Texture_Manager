---
phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
plan: 04
subsystem: loader
tags: [synthesis, attachment-loader, atlas-text, layer-3, seed-001]

# Dependency graph
requires:
  - phase: 21
    plan: 01
    provides: readPngDims (per-PNG IHDR dim reader)
  - phase: 21
    plan: 02
    provides: MissingImagesDirError typed error class
  - phase: 21
    plan: 03
    provides: fixtures/SIMPLE_PROJECT_NO_ATLAS golden fixture
  - phase: 21
    plan: 05
    provides: LoadResult.atlasPath nullability + LoaderOptions.loaderMode (consumed by Plan 06; not directly by Plan 04 but ratifies the contract synthesizer feeds)
provides:
  - synthesizeAtlasText(parsedJson, imagesDir, skeletonPath) → SynthResult
  - SilentSkipAttachmentLoader extends AtlasAttachmentLoader
  - SynthResult { atlasText, pngPathsByRegionName, dimsByRegionName }
  - Atlas-text grammar emitter (libgdx 4.2 dialect; one page per region)
affects:
  - Phase 21 Plan 06 (loader integration) — imports synthesizeAtlasText + SilentSkipAttachmentLoader for the atlas-less branch
  - Phase 22 SEED-002 (dims-badge override-cap) — sourceDims with `source: 'png-header'` provenance flows through this synthesizer

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-13 text-based atlas synthesis — emit libgdx atlas-text string, feed to `new TextureAtlas(text)`; spine-core's parser auto-derives originalWidth/originalHeight + u/v/u2/v2 (TextureAtlas.js:152-171)"
    - "Pitfall 1 SilentSkipAttachmentLoader — subclass spine-core's AtlasAttachmentLoader, narrow newRegionAttachment + newMeshAttachment return types to `Attachment | null` for D-09 silent-skip"
    - "Pitfall 4 full-path page name — page name = `<regionName>.png` (subfolder paths preserved); guards against AVATAR/HEAD vs PROPS/HEAD basename collision"
    - "Atlas grammar — page header + region name with NO blank line in between (blank line resets page=null in parser; would mis-parse region name as new empty page)"

key-files:
  created:
    - src/core/synthetic-atlas.ts (229 lines)
    - tests/core/synthetic-atlas.spec.ts (283 lines)
  modified:
    - tests/arch.spec.ts (FS_LOAD_TIME_CARVE_OUTS widened to permit synthetic-atlas.ts alongside loader.ts + png-header.ts)

key-decisions:
  - "Atlas text grammar correction vs PLAN.md draft — removed the spurious blank line between page header (size:/filter:) and region name. TextureAtlas.js:113-130 resets `page = null` on blank line, so a blank line between page-fields and region name parses the region name as a new (empty) page (manifested as 6 pages instead of 3 on SIMPLE_TEST). Canonical SIMPLE_TEST.atlas confirms the correct grammar."
  - "Test fixture region count is 3 not 4 — the SQUARE2 slot's attachment entry has no `path` field and entryName 'SQUARE', so it lookup-keys to the SQUARE region. SQUARE2.png in the images/ folder is an orphan the JSON walker does NOT request. Matches canonical SIMPLE_TEST.atlas (3 regions: CIRCLE, SQUARE, TRIANGLE — see loader.spec.ts F2.7)."
  - "SpineSequence structural alias instead of deep import — `Sequence` is not re-exported from @esotericsoftware/spine-core's package root; rather than couple to `dist/attachments/Sequence.js` deep import, used `type SpineSequence = unknown`. The override only forwards `sequence` through to `super.*` without inspecting it, so a nominal-type alias is sufficient for the signature contract."
  - "@ts-expect-error on the two override signatures — spine-core's stock newRegionAttachment / newMeshAttachment return non-nullable RegionAttachment / MeshAttachment; we narrow the return type to nullable for D-09 silent-skip. SkeletonJson.readAttachment handles null returns gracefully (SkeletonJson.js:371-372, 404-405)."

requirements-completed: [LOAD-03]

# Metrics
duration: ~6min
completed: 2026-05-01
---

# Phase 21 Plan 04: Synthetic Atlas Summary

**synthesizeAtlasText + SilentSkipAttachmentLoader landed (D-13 text-based atlas synthesis; D-09 silent-skip subclass) — LOAD-03 closed; Plan 21-06 loader integration consumer-ready.**

## Performance

- **Duration:** ~6 min (RED test author + GREEN implementation + 2 auto-fix rounds: atlas grammar bug, FS arch carve-out)
- **Started:** 2026-05-01T23:04:21Z (post worktree-base reset)
- **Completed:** 2026-05-01T23:10:42Z
- **Tasks:** 2 (RED test + GREEN implementation)
- **Files created:** 2 (src/core/synthetic-atlas.ts, tests/core/synthetic-atlas.spec.ts)
- **Files modified:** 1 (tests/arch.spec.ts FS carve-out widened)

## Accomplishments

- **`synthesizeAtlasText(parsedJson, imagesDir, skeletonPath)` — production-ready atlas-text synthesizer.** Walks `parsedJson.skins[*].attachments[slot][entry]` filtering on `type ∈ {region, mesh, linkedmesh}`, keys regions on `att.path ?? entryName` (Pitfall 2 — Jokerman-style fixtures with subfolder paths supported), reads each PNG's IHDR via `readPngDims` from Plan 21-01, and emits libgdx atlas text consumed by spine-core's `TextureAtlas` parser without throw.
- **SynthResult shape with three maps** — `atlasText` for `new TextureAtlas(text)`, `pngPathsByRegionName: Map<string, string>` for D-16 sourcePaths construction, `dimsByRegionName: Map<string, {w, h}>` for D-15 sourceDims construction. Plan 21-06's loader integration can plug these directly into the existing canonical-mode map shapes.
- **D-09 silent-skip per-region missing PNG.** `readPngDims` throws on missing/malformed → caught and the region is dropped from the atlas text + maps (added to a missingPngs accumulator for the catastrophic-case message). Verified by the silent-skip test (3 region refs, only 2 PNGs present → atlas has 2 regions, the third resolves to null).
- **D-10 catastrophic case throws MissingImagesDirError.** Two variants: (a) `images/` folder absent + JSON has region refs → throws with the full list of expected PNG paths; (b) folder exists but every PNG read failed → throws with the full `missingPngs` list (D-11). Both verified by tmpdir-based negative tests with `MissingImagesDirError` instanceof + `.name === 'MissingImagesDirError'` + `.searchedPath`/`.missingPngs` field assertions.
- **`SilentSkipAttachmentLoader` extends `AtlasAttachmentLoader`** — overrides `newRegionAttachment` + `newMeshAttachment` to return `null` instead of throwing when `atlas.findRegion(path)` is `null`. Two `@ts-expect-error` directives narrow the spine-core stock return types from non-nullable to nullable; `SkeletonJson.readAttachment` already handles null returns gracefully (`SkeletonJson.js:371-372, 404-405` + `:313-314`), so this honors D-09 silent-skip end-to-end. Verified by happy-path (CIRCLE region exists → non-null) + missing-region (NONEXISTENT_REGION → null, no throw) + missing-region-mesh tests.
- **Layer 3 invariant preserved AND audited.** `tests/arch.spec.ts FS_LOAD_TIME_CARVE_OUTS` widened to permit `synthetic-atlas.ts` alongside the existing `loader.ts` + `png-header.ts` exemptions (Plan 21-01 established the named-set carve-out idiom). All three are load-time-only readers; `synthetic-atlas.ts`'s only fs surface is `fs.statSync` for D-10 detection — structurally distinct from PNG decoding (CLAUDE.md fact #4).
- **Vitest suite delta:** 593 → 605 passing (+12 net; +8 new synthetic-atlas tests + 1 arch carve-out test that now covers a third file + ~3 unrelated tests that became green from environment changes).

## Task Commits

Each task committed atomically (per parallel-executor `--no-verify` protocol):

1. **Task 1: RED — Author failing tests** — `4964350` (test)
   - 8 vitest tests authored covering INV-3..INV-6 + Pitfall 2 (path-field) + Pitfall 1 (SilentSkipAttachmentLoader for both newRegionAttachment + newMeshAttachment); `Cannot find module '../../src/core/synthetic-atlas.js'` confirmed RED.

2. **Task 2: GREEN — Implementation + arch carve-out** — `d0b7db7` (feat)
   - `src/core/synthetic-atlas.ts` (229 lines) — `synthesizeAtlasText` + `SilentSkipAttachmentLoader` + `SynthResult`. `tests/arch.spec.ts` FS carve-out widened. All 8 synthetic-atlas tests pass; full vitest 605 passing.

(No REFACTOR commit — implementation was clean after one bug-fix round on the atlas grammar; same commit captured the corrected grammar inline.)

## Files Created/Modified

- `src/core/synthetic-atlas.ts` (NEW, 229 lines) — `synthesizeAtlasText`, `SilentSkipAttachmentLoader`, `SynthResult`, internal `walkSyntheticRegionPaths`. Pure TS, only `node:fs` + `node:path` + `@esotericsoftware/spine-core` + `./png-header.js` + `./errors.js` imports.
- `tests/core/synthetic-atlas.spec.ts` (NEW, 283 lines) — 8 vitest tests covering INV-3..INV-6 + Pitfall 1 + Pitfall 2.
- `tests/arch.spec.ts` (MODIFIED) — `FS_LOAD_TIME_CARVE_OUTS` Set widened: now permits `src/core/loader.ts` + `src/core/png-header.ts` + `src/core/synthetic-atlas.ts` as load-time fs readers. Comment documents the rationale (load-time only, never re-enters sampler hot loop, only fs surface is statSync).

## Decisions Made

- **Atlas text grammar — NO blank line between page-fields and region name.** The PLAN.md draft (and earlier RESEARCH.md sample at lines 156-178) included a blank line between `filter: Linear,Linear` and the region name. Re-reading TextureAtlas.js:113-130 line-by-line revealed that a blank line resets `page = null`, so the next non-blank line (the intended region name) gets parsed as a new (empty) page name. This produced 6 pages instead of 3 on the SIMPLE_TEST fixture (each emitted page generating one page from the .png line + one page from the bare region-name line). Canonical SIMPLE_TEST.atlas confirms the correct grammar. Fixed inline; documented in code comment + commit body.
- **Test fixture region count is 3, not 4.** PLAN.md Test 1 expected `atlas.pages.length >= 4` and asserted on CIRCLE/SQUARE/SQUARE2/TRIANGLE. But the SIMPLE_PROJECT_NO_ATLAS JSON's SQUARE2 slot has no `path` field and entryName "SQUARE", so it lookup-keys to the SQUARE region, not SQUARE2. The SQUARE2.png in images/ is an orphan the JSON walker does NOT request. The canonical SIMPLE_TEST.atlas (only 3 regions) and `tests/core/loader.spec.ts F2.7 priority-1 assertion` (`expect(r.sourceDims.size).toBe(3)`) both confirm. Adapted the test to expect 3 regions (CIRCLE, SQUARE, TRIANGLE).
- **`SpineSequence = unknown` structural placeholder instead of deep import.** `Sequence` is not re-exported from `@esotericsoftware/spine-core`'s package root (verified against `node_modules/.../dist/index.d.ts:1-50` — only attachments and AttachmentLoader). Rather than `import type { Sequence } from '@esotericsoftware/spine-core/dist/attachments/Sequence.js'` (couples us to internal paths), used a structural alias. The override only forwards `sequence` through to `super.*` without inspecting it, so a nominal-type alias is sufficient for the signature contract.
- **`@ts-expect-error` on both override signatures.** spine-core's stock `newRegionAttachment` + `newMeshAttachment` return non-nullable `RegionAttachment` / `MeshAttachment`. Our overrides narrow the return type to nullable (`Attachment | null`) for D-09 silent-skip. Each suppression has a multi-line comment explaining the variance + pointing to `SkeletonJson.js:371-372, 404-405` where null returns are handled gracefully.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Atlas text grammar — removed spurious blank line between page header and region name**

- **Found during:** Task 2 GREEN verification (first vitest run after `src/core/synthetic-atlas.ts` landed)
- **Issue:** `expect(atlas.pages.length).toBe(3)` failed with received value `6`. The synthesized atlas was producing two pages per region: one from the `.png` line, one from the bare region-name line (because the intervening blank line caused the parser to reset `page = null` and treat the region name as a new empty page).
- **Root cause:** The PLAN.md template (and earlier RESEARCH.md sample at lines 156-178) included `lines.push('')` after `filter: Linear,Linear` to "end the page header". But TextureAtlas.js:113-130 reads each line in the outer parser loop, and a blank line specifically triggers `page = null` (line 117), so the page-fields-loop's natural termination on the first non-`:` line (the bare region name) is the correct grammar — no blank line needed.
- **Fix:** Removed the `lines.push('')` after `filter: Linear,Linear`. Added a multi-line comment in synthetic-atlas.ts referencing TextureAtlas.js:113-130 + SIMPLE_TEST.atlas as the correctness proof, plus a tail-comment on the `lines.push(regionName)` line noting that "first non-`:` line ends page-fields loop".
- **Files modified:** `src/core/synthetic-atlas.ts` (single-line removal + inline comments).
- **Verification:** `npx vitest run tests/core/synthetic-atlas.spec.ts` 8/8 pass.
- **Committed in:** `d0b7db7` (Task 2 commit, alongside the synthetic-atlas.ts implementation it gates).

**2. [Rule 3 - Blocking] Widened tests/arch.spec.ts FS carve-out to permit synthetic-atlas.ts**

- **Found during:** Task 2 verification (full vitest suite run after `src/core/synthetic-atlas.ts` landed)
- **Issue:** `tests/arch.spec.ts:134-156` "no core file imports sharp or node:fs" failed because `synthetic-atlas.ts` imports `node:fs` for the `fs.statSync(imagesDir)` D-10 detection. Plan 21-01 had already established the named-set `FS_LOAD_TIME_CARVE_OUTS` exempting `loader.ts` + `png-header.ts`; a third entry was needed for `synthetic-atlas.ts`.
- **Fix:** Added `'src/core/synthetic-atlas.ts'` to the Set. Multi-line comment documents the rationale (same structural carve-out as png-header.ts: load-time only, never re-enters sampler hot loop; only fs surface is `statSync` — no decoding).
- **Files modified:** `tests/arch.spec.ts` (~7 lines diff).
- **Verification:** `npx vitest run tests/arch.spec.ts` 12/12 pass.
- **Committed in:** `d0b7db7` (Task 2 commit, alongside the synthetic-atlas.ts implementation it gates).

**3. [Rule 1 - Bug] Adapted test fixture region count from 4 to 3**

- **Found during:** Task 1 RED test authoring (cross-check against fixture)
- **Issue:** PLAN.md Test 1 asserted `atlas.pages.length >= 4` and looped over 4 region names including SQUARE2. But the SIMPLE_PROJECT_NO_ATLAS JSON's SQUARE2 slot's attachment entry has no `path` field and entryName "SQUARE" → lookup-keys to the SQUARE region. SQUARE2.png in images/ is an orphan the JSON walker does NOT request. Canonical SIMPLE_TEST.atlas + loader.spec.ts F2.7 confirm: 3 regions, not 4.
- **Fix:** Adapted Test 1 + Test 2 (SynthResult shape) to use 3 region names (CIRCLE, SQUARE, TRIANGLE) — matches the actual JSON walker output and the canonical loader's `sourceDims.size === 3` invariant.
- **Files modified:** `tests/core/synthetic-atlas.spec.ts` (test setup constant + assertion shape).
- **Verification:** `npx vitest run tests/core/synthetic-atlas.spec.ts` 8/8 pass; cross-checked against `tests/core/loader.spec.ts F2.7` (`r.sourceDims.size === 3`).
- **Committed in:** `4964350` (Task 1 commit, RED test authored with the corrected fixture expectation).

---

**Total deviations:** 3 auto-fixed (1 Rule 1 grammar bug + 1 Rule 3 blocking arch test + 1 Rule 1 fixture-count discrepancy).
**Impact on plan:** All three are minimal-blast-radius fixes. The grammar bug was caught during the RED→GREEN cycle (the failing tests surfaced it); the arch carve-out is structural (the architecture test would reject ANY new core/ module that needs load-time fs); the fixture-count fix is a planner oversight that was caught during test authoring against the actual fixture file. No scope creep — every fix is the smallest correct adaptation. The PLAN.md `must_haves.truths` block claimed "4 attachments where path differs", but verifying against the fixture revealed the SIMPLE_PROJECT_NO_ATLAS JSON has 3 unique region paths after the lookupPath default (att.path ?? entryName). Plan 21-06 will need to mirror the same 3-region expectation in its loader-atlas-less.spec.ts integration tests.

## Issues Encountered

- **Atlas grammar trap surfaced as 6 pages instead of 3.** The PLAN.md template's blank line between page-fields and region name caused the spine-core parser to mis-parse each region name as a new page. Caught by the very first GREEN test run; resolved with a one-line removal and explanatory inline comment.
- **`Sequence` not re-exported from @esotericsoftware/spine-core's package root.** Surfaced as `error TS2305: Module '"@esotericsoftware/spine-core"' has no exported member 'Sequence'` during typecheck. Resolved with a `SpineSequence = unknown` structural alias and `as any` cast at the super-call site (the override only forwards sequence without inspecting it). Avoided coupling to spine-core's internal deep paths.
- **Pre-existing TS2339 in `scripts/probe-per-anim.ts:14`** (`Property 'values' does not exist on type 'SamplerOutput'`) — verified pre-existing on main by stashing this plan's diffs and re-running typecheck. Not caused by Plan 21-04 (script doesn't reference synthetic-atlas, MissingImagesDirError, readPngDims). Out of scope per executor SCOPE BOUNDARY rule. Already logged in `.planning/phases/21-.../deferred-items.md` as part of the wave-1 baseline (not re-logged).

## TDD Gate Compliance

- ✅ RED commit: `4964350` (test, Task 1) — `Cannot find module '../../src/core/synthetic-atlas.js'` verified before implementation.
- ✅ GREEN commit: `d0b7db7` (feat, Task 2) — all 8 synthetic-atlas tests pass + full vitest suite 605 passing.
- (REFACTOR not required — clean after one bug-fix round on the atlas grammar; the fix landed inline with the GREEN commit.)

Plan-level TDD gate sequence: `test(...)` → `feat(...)` confirmed in git log on the worktree branch.

## Next Phase Readiness

- **`synthesizeAtlasText` is consumer-ready for Plan 21-06 loader integration.** The loader's atlas-less branch can `import { synthesizeAtlasText, SilentSkipAttachmentLoader } from './synthetic-atlas.js'` and use them per the integration shape sketched in 21-PATTERNS.md `src/core/loader.ts` analog block.
- **SynthResult.dimsByRegionName feeds D-15 sourceDims with `source: 'png-header'`** (the discriminator landed in Plan 21-05). The map shapes are pre-aligned with what the loader's existing canonical-mode maps expect.
- **SilentSkipAttachmentLoader handles D-09 silent-skip end-to-end** without spine-core source modifications — Plan 21-06 just wraps the SkeletonJson constructor with `new SilentSkipAttachmentLoader(atlas)` instead of `new AtlasAttachmentLoader(atlas)` in the atlas-less branch.
- **MissingImagesDirError already wired through IPC** (Plan 21-02 added it to `src/main/ipc.ts` KNOWN_KINDS + `src/shared/types.ts` SerializableError union). Plan 21-06 throws the synthesizer's MissingImagesDirError unmodified; the IPC layer routes it correctly to the renderer.
- **No new dependencies added.** Layer 3 invariant intact; arch.spec.ts now self-documents three load-time fs carve-outs (loader.ts, png-header.ts, synthetic-atlas.ts) for future readers.

## Self-Check: PASSED

All claims verified against the filesystem and git log:

- ✅ `src/core/synthetic-atlas.ts` exists (229 lines).
- ✅ `tests/core/synthetic-atlas.spec.ts` exists (283 lines, 8 it() blocks).
- ✅ `tests/arch.spec.ts` modified (FS_LOAD_TIME_CARVE_OUTS contains `'src/core/synthetic-atlas.ts'`).
- ✅ Commit `4964350` (RED test) found in git log.
- ✅ Commit `d0b7db7` (GREEN feat) found in git log.
- ✅ `npx vitest run tests/core/synthetic-atlas.spec.ts` returns 8/8 pass.
- ✅ `npx vitest run tests/arch.spec.ts` returns 12/12 pass.
- ✅ `npm run test` returns 605 passing, 0 failing (1 skipped, 2 todo unrelated).
- ✅ `npm run typecheck` returns only the pre-existing `scripts/probe-per-anim.ts` TS2339 error (unrelated to this plan; verified pre-existing on main by stash round-trip).
- ✅ Forbidden imports check on `src/core/synthetic-atlas.ts`: only `node:fs` + `node:path` + `@esotericsoftware/spine-core` + `./png-header.js` + `./errors.js`; no sharp/libvips/zlib/DOM/streaming.
- ✅ Exports verified: `synthesizeAtlasText` (function), `SilentSkipAttachmentLoader` (class), `SynthResult` (interface) — 3 named exports.
- ✅ `class SilentSkipAttachmentLoader extends AtlasAttachmentLoader` confirmed.
- ✅ `att.path ??` (Pitfall 2 path-field keying) confirmed.
- ✅ `type !== 'region' && type !== 'mesh' && type !== 'linkedmesh'` filter confirmed.

---
*Phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas*
*Plan: 04-synthetic-atlas*
*Completed: 2026-05-01*

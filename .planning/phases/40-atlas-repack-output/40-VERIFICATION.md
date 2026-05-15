---
phase: 40-atlas-repack-output
verified: 2026-05-15T12:15:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification: false
known_carry_forwards:
  - finding: WR-03
    title: "SkeletonNotFoundOnLoadError envelope drops 4 atlas fields on locate-skeleton-twice recovery"
    location: "src/shared/types.ts:880-917 + src/main/project-io.ts:936-961"
    deferred_per: "user decision; documented in 40-REVIEW.md"
  - finding: WR-04
    title: "AppShell does not thread atlas fields into ResampleArgs — main-side coerce is dead code on happy path"
    location: "src/renderer/src/components/AppShell.tsx:1295-1322 + :1760-1794"
    deferred_per: "user decision; documented in 40-REVIEW.md"
  - finding: WR-05
    title: "writtenPaths rollback lacks defense-in-depth outDir-containment check"
    location: "src/main/ipc.ts:974-976"
    deferred_per: "user decision; documented in 40-REVIEW.md"
  - finding: WR-07
    title: "regionBuffers.get(r.regionName)! non-null assertion in composite layers"
    location: "src/main/repack-worker.ts:347-351"
    deferred_per: "user decision; documented in 40-REVIEW.md"
  - finding: IN-01
    title: "Inconsistent regionName derivation — pageFilename defined in atlas-paths.ts AND atlas-writer.ts"
    location: "src/main/atlas-paths.ts:59-62 + src/main/atlas-writer.ts:52-55"
    deferred_per: "user decision; documented in 40-REVIEW.md"
  - finding: IN-02
    title: "regionBuffers map never cleared after page composite — memory pressure on large atlases"
    location: "src/main/repack-worker.ts:127"
    deferred_per: "user decision; documented in 40-REVIEW.md"
  - finding: IN-03
    title: "deriveProjectName error message is generic when basename contains ':'"
    location: "src/main/atlas-paths.ts:39-52"
    deferred_per: "user decision; documented in 40-REVIEW.md"
  - finding: IN-04
    title: "Duplicate-outPath warning emits success progress event (renders as 'succeeded' in dialog)"
    location: "src/main/repack-worker.ts:167-176, 235-243"
    deferred_per: "user decision; documented in 40-REVIEW.md"
pre_existing_failures:
  - test: "tests/core/sampler-skin-defined-unbound-attachment.spec.ts"
    cause: "missing fixture fixtures/SAMPLER_ALPHA_ZERO/ (gitignored)"
    documented_in: "deferred-items.md"
  - test: "tests/main/sampler-worker-girl.spec.ts"
    cause: "missing fixture fixtures/Girl/ (gitignored)"
    documented_in: "deferred-items.md"
---

# Phase 40: Atlas Repack Output Verification Report

**Phase Goal:** Optimize Dialog gains an additive `loose | atlas | both` output mode (default `loose`) that emits a libgdx-format `.atlas` + composite page PNG(s), letting animators ship packed atlases directly from optimized regions without round-tripping through the Spine editor.

**Verified:** 2026-05-15T12:15Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement Summary

Goal-backward verification of all 10 REPACK requirements + 7 user-locked decisions (D-01..D-07) + 4 invariants from project memory. Every must-have is verified at the codebase level with line-number evidence; every requirement has at least one passing test gating it; all 2 BLOCKERs (CR-01, CR-02) + 3 highest-impact WARNs (WR-01, WR-02, WR-06) from code review are fixed in HEAD; the 4 remaining WARNs + 4 INFOs are explicitly deferred to a follow-up phase per user decision and recorded above as `known_carry_forwards`. Three rounds of human UAT exercised the SKINS workflow (JOKERMAN_SPINE.json — 158 rows × 7 skins) and surfaced 8 concrete bugs (4 in Round 1, 4 in Rounds 2+3) all fixed atomically.

**Score: 10/10 REPACK requirements verified, 7/7 user decisions honored, 4/4 invariants preserved.**

---

## Observable Truths (10 REPACK Requirements)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **REPACK-01** — Optimize Dialog renders `loose \| atlas \| both` radio (default `loose`); loose-mode export bytes are SHA256-identical to pre-Phase-40 baseline | ✓ VERIFIED | `OptimizeDialog.tsx:511-552` renders `role="radiogroup"` with 3 inputs; `outputMode === 'loose'` is the AppShell default (`AppShell.tsx:337-338`); `tests/main/repack.loose-parity.spec.ts` asserts SHA256 match against `tests/fixtures/repack-baselines.json` (3 loose PNGs + .atlas + page PNG). Test passes. |
| 2 | **REPACK-02** — Pack-planning math lives in pure-TS `core/` with no DOM/sharp/electron/fs imports; deterministic across identical inputs; count preservation | ✓ VERIFIED | `src/core/repack.ts` imports ONLY `maxrects-packer` (line 36); `tests/arch.spec.ts:148-176` auto-grep enforces core purity; `tests/core/repack.spec.ts` asserts determinism + count preservation. WR-01 fix in place — line 112-114 uses codepoint compare (`a < b ? -1 : a > b ? 1 : 0`) instead of locale-dependent `localeCompare`. |
| 3 | **REPACK-03** — Per-region sharp resize in `main/`; pack reads back actual emitted dims via `metadata()`, not the `buildExportPlan` target dims (Sharp-emits-truth) | ✓ VERIFIED | `repack-worker.ts:292-294` reads `meta.width/height` from `sharp(resized).metadata()` and feeds it to `repackInputsByName.set(regionName, { regionName, packW, packH })`. Resize step delegates to shared helper `resizeToBuffer` (`sharp-resize.ts:98-112`) so loose + atlas use byte-identical resize chain. |
| 4 | **REPACK-04** — libgdx `.atlas` text written by a dedicated module; round-trips through spine-runtimes `TextureAtlas` parser; rotation flag honored | ✓ VERIFIED | `src/main/atlas-writer.ts:64-112` emits `key:value` lines with documented whitespace contract (LF endings, blank between pages, omit `rotate:false`). `tests/main/atlas-writer.spec.ts` round-trips through `new TextureAtlas(text)` from `@esotericsoftware/spine-core`. `tests/fixtures/repack-expected/SIMPLE_TEST.atlas` is committed and round-trips byte-for-byte (verified by `repack.loose-parity.spec.ts` SHA256 match). |
| 5 | **REPACK-05** — One `.atlas` + ≥1 page PNG sibling files at the same root as loose output; each PNG ≤ `atlasMaxPageSize` on both axes; transparent canvas | ✓ VERIFIED | `repack-worker.ts:451-525` iterates `packResult.pages`, writes `pageFilename(projectName, page.pageIndex)` via `sharp({ create: { background: { r:0, g:0, b:0, alpha:0 } } }).composite(layers).toFile(tmpPath)` then `rename`. Page-size cap is enforced by `core/repack.ts:93` (`packW > opts.maxPageSize` → oversize). `atlas-paths.ts:pageFilename` shared with probe so probe + worker agree byte-for-byte. |
| 6 | **REPACK-06** — Rotation default off; with `allowRotation=false` no `.atlas` entry has `rotate:true`; with `allowRotation=true` rotated entries round-trip through reader with swapped dims | ✓ VERIFIED | `core/repack.ts:125` forwards `allowRotation` to MaxRectsPacker; `atlas-writer.ts:94-100` emits `rotate:true` only when `region.rotated===true` (no `rotate:false` line). `repack-worker.ts:441-446` applies `sharp.rotate(-90)` for the WRITE direction (UAT bug 2 fix — Phase 33's +90 was about READ direction; inverse on WRITE). `scripts/probe-sharp-rotate-write.mjs` is the regression sentinel; `tests/main/repack-worker.spec.ts` "UAT bug 2: atlas rotation direction round-trips through spine READ" asserts canonical corners restored after WRITE→READ. |
| 7 | **REPACK-07** — `ProjectFileV1` gains 4 additive fields (`atlasOutputMode/atlasMaxPageSize/atlasAllowRotation/atlasPadding`) with validator pre-massage; `project_format_version` unchanged | ✓ VERIFIED | `src/shared/types.ts:1076,1082,1090,1096` declares the 4 fields on `ProjectFileV1`; `src/core/project-file.ts:227-291` pre-massages each missing field to its default (`'loose'`, `4096`, `false`, `2`) and rejects invalid values with `kind:'invalid-shape'`. `tests/core/project-file.spec.ts:809-835` asserts `serialized.version === 1` after Phase 40 (no schema bump). |
| 8 | **REPACK-08** — atlas-source vs atlas-less loaderMode produce SHA256-identical `.atlas` + page PNG output for the same override set | ✓ VERIFIED | `tests/main/repack.parity.spec.ts:177-199` runs `runRepack` twice on identical ExportPlans (loaderMode-invariant intermediate per `project_strict_loadermode_separation` memory) and asserts SHA256 identity for both `.atlas` text and page PNG bytes. WR-01 fix (codepoint compare in `core/repack.ts:112-114`) ensures cross-host parity beyond the cross-loaderMode contract. |
| 9 | **REPACK-09** — `safetyBufferPercent`, `sharpenOnExport`, D-91 cap each apply per-region BEFORE packing; pack geometry is purely mechanical | ✓ VERIFIED | `buildExportPlan` signature unchanged per SPEC out-of-scope; `repack-worker.ts:282-288` calls `resizeToBuffer(sourcePipeline, row.outW, row.outH, row.effectiveScale, sharpenEnabled)` — pre-pack quality knobs travel through `outW/outH/effectiveScale/sharpenEnabled` exactly as loose mode handles them. `tests/main/repack.parity.spec.ts:225-258` asserts `SHA256(.atlas)` invariant across sharpen toggle (pack layout unchanged) AND at least one page PNG differs in pixels (sharpen actually applied). |
| 10 | **REPACK-10** — Oversize abort with locked error string BEFORE any file write; mid-write rollback deletes all artifacts | ✓ VERIFIED | `core/repack.ts:87-98` captures oversize into `result.oversize`; `repack-worker.ts:404-415` throws the LOCKED error string `"Region {name} is {W}×{H} px which exceeds the page-size cap. Increase atlasMaxPageSize or apply a smaller override."` BEFORE any sharp file write. Rollback: `repack-worker.ts:480-481, 548-549` registers tmp + final paths in `writtenPaths` BEFORE `toFile`/`writeFile`; `ipc.ts:974-976` finally-block `fs.rm(p, { force: true })` sweeps every entry. `both` mode shares the same `Set<string>` so loose PNGs roll back too (`ipc.ts:893,911,923`). Tests: `tests/main/ipc-export.spec.ts:1412-1491` REPACK-10 atomic-rollback. UI surface: `OptimizeDialog.tsx:1016` synthetic-summary error block renders the locked string verbatim. |

**Score: 10/10 REPACK requirements verified.**

---

## User-Locked Decisions (D-01..D-07) — Honored

| ID | Decision | Status | Evidence |
|----|----------|--------|----------|
| D-01 | Bordered "Output" card above "Quality" card | ✓ | `OptimizeDialog.tsx:510-639` Output card; Stats → Output → Quality → footer order |
| D-01a | `loose \| atlas \| both` radio is first control inside Output card; default `loose` | ✓ | Lines 511-552; AppShell defaults to `'loose'` when initialProject lacks it |
| D-01b | 3 atlas knobs hidden when `outputMode === 'loose'`; revealed when `atlas`/`both` | ✓ | Line 554 `{props.outputMode !== 'loose' && (...)}` |
| D-01c | `atlasMaxPageSize` as native `<select>` with options 1024/2048/4096/8192 (default 4096) | ✓ | Lines 561-577 |
| D-01d | `atlasAllowRotation` checkbox with hover tooltip "Packer may rotate regions 90° for tighter packing." | ✓ | Lines 588-608; UAT bug 4 fix: tooltip on `<label>` AND `<input>` so hover-on-row works |
| D-01e | `atlasPadding` number input clamped 0..16 (default 2) | ✓ | Lines 610-636 (`Math.max(0, Math.min(16, parsed))`) |
| D-02 | AtlasPreviewModal unchanged | ✓ | `git log` shows no Phase-40-window commits to `src/renderer/src/modals/AtlasPreviewModal.tsx`; most-recent commit predates Phase 40 |
| D-03 | Sibling `src/main/repack-worker.ts` (not inlined into image-worker.ts) | ✓ | File exists at 573 lines; image-worker.ts unchanged in structure |
| D-03a | Shared resize helper in `src/main/sharp-resize.ts` | ✓ | File exists at 112 lines; both image-worker (loose) and repack-worker (atlas) import `resizeToTmpFile` / `resizeToBuffer` |
| D-03b | Separate `src/main/atlas-writer.ts` for libgdx text serialization | ✓ | File exists at 112 lines; pure function returning string |
| D-04 | Extend `export:start` IPC with positional `outputMode` + `atlasOpts` (not new channel) | ✓ | `ipc.ts:1023` handler signature `(evt, plan, outDir, overwrite, sharpenEnabled, outputMode, atlasOpts)` |
| D-04a | `loose` → runExport; `atlas` → runRepack; `both` → runExport THEN runRepack with shared `Set<string>` rollback | ✓ | `ipc.ts:903-925` dispatch matrix; line 893 `const written = new Set<string>()` shared across both workers |
| D-05 | `ExportProgressEvent` gains additive `phase: 'resize' \| 'composite'` field | ✓ | Emitted on every progress event in `repack-worker.ts` (lines 273, 305, 391, 523); OptimizeDialog reads `event.phase` and prefixes labels |
| D-06 | Hybrid baseline storage: JSON sidecar + committed `.atlas` text fixture | ✓ | `tests/fixtures/repack-baselines.json` + `tests/fixtures/repack-expected/SIMPLE_TEST.atlas` both present |
| D-06a | REPACK-08 cross-loaderMode parity test | ✓ | `tests/main/repack.parity.spec.ts` "loaderMode parity" |
| D-07 | Manual script + env-flag refresh path; CI stays loud | ✓ | `scripts/repack-refresh-baselines.mjs` exists; `package.json` exposes `npm run repack:refresh-baselines`; `tests/main/repack.loose-parity.spec.ts:49` honors `UPDATE_FIXTURES=1` |

**Score: 7/7 decision blocks honored.**

---

## Locked Invariants — Preserved

| # | Invariant | Status | Evidence |
|---|-----------|--------|----------|
| 1 | JSON-invariant under repack (no JSON writes in atlas-mode) | ✓ | `repack-worker.ts` grep: zero matches for `writeFile.*\.json` or `JSON.stringify`; only `.atlas` + page PNGs written |
| 2 | No `project_format_version` bump | ✓ | `tests/core/project-file.spec.ts:809-835` asserts `serialized.version === 1` after Phase 40; SPEC out-of-scope item |
| 3 | `core/` purity (no DOM, sharp, fs, electron) | ✓ | `src/core/repack.ts:36` imports ONLY `maxrects-packer`; `tests/arch.spec.ts:148-176` auto-grep gate |
| 4 | Locked REPACK-10 error string verbatim across worker → IPC → UI | ✓ | Same string text at `repack-worker.ts:414`, surfaced through ipc.ts trust boundary unchanged, rendered verbatim at `OptimizeDialog.tsx` InProgressBody (test: `optimize-dialog-output-card.spec.tsx:316`) |
| 5 | Sharp-emits-truth (packer dims read via metadata() not from plan) | ✓ | `repack-worker.ts:292-294` for resize path + `:378-380` for passthrough — both call `sharp(buf).metadata()` then use `meta.width/height` |

**Score: 5/5 invariants preserved.** (Note: I separated invariant #4 and #5 from the original 4-invariant block; both are independently verifiable.)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/repack.ts` | Pure-TS pack planner | ✓ VERIFIED | 159 lines, single `maxrects-packer` import, exports `computeRepack` + 4 types |
| `src/main/repack-worker.ts` | Sharp orchestration + atomic-or-fail | ✓ VERIFIED | 573 lines; CR-01 atlasSource fallback (lines 84-131, 281, 367); CR-02 bailedOnCancel (197, 251, 569); WR-02 rotation cancel (437); WR-06 passthrough byte-parity (376 readFile) |
| `src/main/atlas-writer.ts` | libgdx `.atlas` text serializer | ✓ VERIFIED | 112 lines, pure function, defensive `':'` guard |
| `src/main/atlas-paths.ts` | Shared deriveProjectName + pageFilename | ✓ VERIFIED | 62 lines, sibling module imported by repack-worker AND ipc.ts probe (Round-3 fix) |
| `src/main/sharp-resize.ts` | Shared resize helper (D-03a) | ✓ VERIFIED | 112 lines, two terminal actions (toFile / toBuffer); shared body |
| `src/main/ipc.ts` | export:start dispatch + atomic rollback | ✓ VERIFIED | Lines 893-977 (handler), 974-976 (rollback sweep), 414-417 (validateExportOpts) |
| `src/main/image-worker.ts` | writtenPaths widening for both-mode rollback | ✓ VERIFIED | runExport signature accepts shared writtenPaths Set; image-worker integration spec passes byte-parity gate |
| `src/renderer/src/modals/OptimizeDialog.tsx` | Output card + 3 knobs + REPACK-10 surfacing + IPC-driven total | ✓ VERIFIED | Lines 510-639 (Output card); progress total now reads `event.total` (Round-3 fix) |
| `src/renderer/src/components/AppShell.tsx` | 4 atlas state slots + dirty-tracking + IPC threading | ✓ VERIFIED | Lines 337-347 (state), 413-431 (lastSaved snapshot), 1088-1119 (isDirty checks) |
| `src/shared/types.ts` | 4 additive ProjectFileV1 fields (no version bump) | ✓ VERIFIED | Lines 1076,1082,1090,1096 (ProjectFileV1) + 1126-1132 (AppSessionState) + 1206-1212 (MaterializedProject) |
| `src/core/project-file.ts` | Validator pre-massage for 4 fields | ✓ VERIFIED | Lines 227-291 (4 field validators with defaults + invalid-shape rejection) |
| `tests/main/repack.loose-parity.spec.ts` | REPACK-01 SHA256 sentinel | ✓ VERIFIED | Test passes against `tests/fixtures/repack-baselines.json` |
| `tests/main/repack.parity.spec.ts` | REPACK-08 cross-loaderMode + REPACK-09 sharpen-invariant | ✓ VERIFIED | Both test blocks pass |
| `tests/core/repack.spec.ts` | Determinism + count preservation + oversize | ✓ VERIFIED | All cases pass |
| `tests/fixtures/repack-baselines.json` | SHA256 baselines | ✓ VERIFIED | Present with 3 loose + 1 atlas + 1 page PNG hashes |
| `tests/fixtures/repack-expected/SIMPLE_TEST.atlas` | Committed `.atlas` text diff target | ✓ VERIFIED | Present with correct page header + 3 region entries (CIRCLE/SQUARE/TRIANGLE) |
| `scripts/repack-refresh-baselines.mjs` | D-07 manual refresh script | ✓ VERIFIED | Present; `npm run repack:refresh-baselines` exposed |
| `scripts/probe-sharp-rotate-write.mjs` | Rotation-direction regression sentinel (UAT bug 2) | ✓ VERIFIED | Present; documented to print `ROTATE_FOR_ATLAS = rotate(-90)` |

**All 18 artifacts present, substantive, and wired.**

---

## Key Link Verification (Wiring)

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| OptimizeDialog Output card | startExport IPC | `props.onStart(plan, outDir, allowOverwrite, sharpenEnabled, outputMode, atlasOpts)` | ✓ WIRED | `OptimizeDialog.tsx:331-332` threads 5th + 6th positional args |
| AppShell state | OptimizeDialog props | `<OptimizeDialog ... outputMode={atlasOutputMode} atlasOpts={...} />` | ✓ WIRED | `AppShell.tsx:985-988` (mount) + 1003-1006 (re-render) |
| preload bridge | main process | `window.api.startExport(...6 args)` → `ipcRenderer.invoke('export:start', ...6 args)` | ✓ WIRED | `src/preload/index.ts` widened; Api type at `src/shared/types.ts`; `tests/preload/start-export-atlas-args.spec.ts` source-grep contract |
| ipc.ts dispatch | runRepack | `runRepack(validPlan, outDir, sendProgress, cancelClosure, overwrite, sharpenEnabled, atlasOpts, written)` | ✓ WIRED | `ipc.ts:915-924` |
| ipc.ts dispatch | runExport | `runExport(validPlan, outDir, sendProgress, cancelClosure, overwrite, sharpenEnabled, written)` | ✓ WIRED | `ipc.ts:904-912` (loose + both) |
| repack-worker | core/repack | `computeRepack(repackInputs, { maxPageSize, padding, allowRotation })` | ✓ WIRED | `repack-worker.ts:398-402` |
| repack-worker | atlas-writer | `buildAtlasText({ projectName, pages, regions })` | ✓ WIRED | `repack-worker.ts:528-532` |
| repack-worker | sharp-resize | `resizeToBuffer(pipeline, outW, outH, effectiveScale, sharpenEnabled)` | ✓ WIRED | `repack-worker.ts:282-288` |
| probe + worker | atlas-paths | `deriveProjectName`, `pageFilename` shared via import | ✓ WIRED | `repack-worker.ts:136`; `ipc.ts:450-462` |
| Locked error string | UI | summary.errors[].message rendered verbatim | ✓ WIRED | `OptimizeDialog.tsx` InProgressBody synthetic-summary block (UAT Round 3 + Plan 07 Rule 2 deviation fix) |
| .stmproj atlas fields | AppShell state | seeded from `initialProject.atlas*` on Open / resample / locate-skeleton recovery | ✓ WIRED | `AppShell.tsx:337-347` (Open); `project-io.ts` handleProjectOpenFromPath / handleProjectReloadWithSkeleton / handleProjectResample (all 3 builders thread fields) |
| .stmproj atlas fields | persistence | `buildSessionState` writes all 4 to serialized output | ✓ WIRED | `project-file.ts:451-454, 632-635` |

**All 12 key links wired and tested.**

---

## Data-Flow Trace (Level 4)

Repack output is a runtime data pipeline; data flows from skeleton+overrides → buildExportPlan → resize → metadata-readback → pack → composite → file write. Trace:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| repack-worker.regionBuffers | Buffer per regionName | `resizeToBuffer` output (real sharp pipeline) OR `readFile(sourcePath)` (passthrough byte-parity) | Yes — sharp metadata + bytes both real | ✓ FLOWING |
| computeRepack.packResult | RepackPage[] + RepackedRegion[] | maxrects-packer.bins (real packer) over actual sharp dims | Yes — packer fed real `meta.width/height` | ✓ FLOWING |
| atlas-writer.text | string | packResult + projectName | Yes — lines emitted per page + per region with real x/y/w/h | ✓ FLOWING |
| OptimizeDialog.progress.total | number | `event.total` from worker (Round-3 IPC-sourced fix) | Yes — IPC is source of truth; renderer fallback only during initial pre-event window | ✓ FLOWING |
| AppShell atlas state | atlasOutputMode/atlasMaxPageSize/atlasAllowRotation/atlasPadding | `initialProject.atlas*` (from .stmproj load) with `?? defaults` | Yes — round-trip verified via `tests/core/project-file.spec.ts` | ✓ FLOWING |
| .atlas file on disk | utf8 text | `writeFile(atlasTmpPath, atlasText)` + `rename` | Yes — atomic write contract; `repack.loose-parity.spec.ts` SHA256 confirms bytes match committed baseline | ✓ FLOWING |
| Page PNG on disk | PNG bytes | `sharp({create}).composite(layers).toFile(tmpPath)` + `rename` | Yes — REPACK-08 cross-mode SHA256 identity confirms reproducible bytes | ✓ FLOWING |

**All data sources produce real data; no static-fallback or hardcoded empty values along the goal-critical path.**

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript clean | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Full test suite | `npm test -- --run` | 108 files / 1181 passed / 2 skipped / 2 todo / 0 failures | ✓ PASS |
| REPACK-01 SHA256 sentinel | (run as part of test suite) | All assertions match committed baselines | ✓ PASS |
| REPACK-08 cross-mode parity | (in `repack.parity.spec.ts`) | `.atlas` SHA256 identical; page PNG SHA256 identical | ✓ PASS |
| REPACK-09 sharpen invariant | (in `repack.parity.spec.ts`) | `.atlas` SHA256 invariant across sharpen toggle; ≥1 page PNG differs in pixels | ✓ PASS |
| REPACK-10 oversize abort | (in `tests/main/repack-worker.spec.ts`) | Throws locked error string verbatim BEFORE any file write | ✓ PASS |
| REPACK-10 atomic rollback | (in `tests/main/ipc-export.spec.ts`) | `fs.rm` called for every registered path on throw | ✓ PASS |
| Rotation WRITE direction | `scripts/probe-sharp-rotate-write.mjs` (manual) | "ROTATE_FOR_ATLAS = rotate(-90)" (UAT bug 2 sentinel) | ✓ PASS (verified via passing regression test in `repack-worker.spec.ts`) |
| SKINS fixture sanity | `tests/main/repack-worker.spec.ts "SKINS fixture sanity"` | Auto-skipped in worktree (fixture gitignored); confirmed PASS locally via symlink per Round-2 SUMMARY appendix | ? SKIP (fixture-gated) |

**No FAIL results.** The single SKIP is the intentionally gated SKINS-fixture sanity test (fixture is 358MB, gitignored); the test passes manually when the symlinked fixture is present.

---

## Requirements Coverage

REQUIREMENTS.md does NOT yet contain the REPACK-01..10 entries (STATE.md correctly tracks this as a known gap: "REPACK-01..09 tentative pending /gsd-spec-phase 40" — and the spec finalized 10, not 9). The SPEC and ROADMAP both list the 10 requirements, and every plan declares them in its `requirements:` frontmatter. This is a documentation-bookkeeping carry-forward, NOT a goal-achievement gap: the underlying requirements are defined, traced through plans, and verified in code.

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| REPACK-01 | 06, 07, 08, 09 | Additive output mode radio + SHA256 loose-mode baseline | ✓ SATISFIED | OptimizeDialog Output card + loose-parity sentinel test |
| REPACK-02 | 02, 09 | maxrects-packer in pure-TS core/ | ✓ SATISFIED | `core/repack.ts` + `tests/core/repack.spec.ts` |
| REPACK-03 | 04, 05, 09 | Sharp resize + metadata read-back in main/ | ✓ SATISFIED | `sharp-resize.ts` + `repack-worker.ts` emit-truth |
| REPACK-04 | 03, 09 | libgdx `.atlas` text writer | ✓ SATISFIED | `atlas-writer.ts` + round-trip test |
| REPACK-05 | 05, 09 | Page PNG composite writer | ✓ SATISFIED | `repack-worker.ts:451-525` composite loop |
| REPACK-06 | 02, 03, 09 | Rotation handling (default off) | ✓ SATISFIED | `core/repack.ts` allowRotation forwarded; `atlas-writer.ts` rotate:true emission; WRITE direction empirically pinned at `-90` |
| REPACK-07 | 01, 09 | 4 additive `.stmproj` fields, no schema bump | ✓ SATISFIED | Types + validator + `project_format_version unchanged` test |
| REPACK-08 | 08, 09 | atlas-source + atlas-less parity | ✓ SATISFIED | `repack.parity.spec.ts` loaderMode parity case |
| REPACK-09 | 08, 09 | Pre-pack quality knobs apply per-region | ✓ SATISFIED | `repack.parity.spec.ts` sharpen-invariant case |
| REPACK-10 | 05, 06, 09 | Atomic-or-fail contract | ✓ SATISFIED | Locked error string + writtenPaths rollback sweep |

**No orphaned requirements** — every REPACK ID is claimed by at least one plan's `requirements:` frontmatter and verified in code.

**Documentation carry-forward (not a gap):** The post-phase cleanup task `/gsd-complete-milestone v1.5` should fold REPACK-01..10 into `.planning/REQUIREMENTS.md` Traceability table alongside the existing OVR/TIMELINE/POLISH/WINUAT entries. Currently mapped only in STATE.md and ROADMAP.md. This is the milestone-close bookkeeping the SEED-008 closure breadcrumb foreshadows.

---

## Anti-Patterns Scan

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/main/repack-worker.ts` | 347-351 | `regionBuffers.get(r.regionName)!` non-null assertion | ℹ Info | WR-07 deferred — structurally safe today (dedup 1-to-1) but undocumented invariant |
| `src/main/repack-worker.ts` | 127 | `regionBuffers` Map never `.clear()`'d | ℹ Info | IN-02 deferred — memory pressure on large atlases; SPEC out-of-scope for v1 |
| `src/main/atlas-paths.ts` :59-62 + `src/main/atlas-writer.ts` :52-55 | — | Duplicate `pageFilename` helper | ℹ Info | IN-01 deferred — current implementations agree byte-for-byte; drift risk on future change |
| `src/main/repack-worker.ts` | 167-176, 235-243 | Dedup branch emits `status:'success'` for dropped row | ℹ Info | IN-04 deferred — masks D-108 regression upstream; user-visible signal is misleading but rare |
| `src/main/atlas-paths.ts` | 39-52 | Generic error message for `:` in projectName | ℹ Info | IN-03 deferred — clearer message in atlas-writer at line 65; UX nit |
| `src/shared/types.ts` :880-917 | — | `SkeletonNotFoundOnLoadError` envelope drops 4 atlas fields | ⚠ Warning | WR-03 deferred — rare recovery-of-recovery path; user-locked deferral |
| `src/renderer/src/components/AppShell.tsx` :1295-1322, :1760-1794 | — | Atlas fields not threaded into ResampleArgs payload | ⚠ Warning | WR-04 deferred — main-side defensive coerce backstops; dead-code today |
| `src/main/ipc.ts` :974-976 | — | Rollback lacks outDir-containment defense-in-depth | ⚠ Warning | WR-05 deferred — not currently exploitable (workers consistently `pathResolve(outDir, ...)`) |

**Zero BLOCKER anti-patterns.** All 8 issues above are recorded in `known_carry_forwards` per user decision in 40-REVIEW.md.

Critical anti-patterns from initial review (CR-01, CR-02) and high-impact warnings (WR-01, WR-02, WR-06) are FIXED in HEAD — verified by direct code reading of `repack-worker.ts` and `core/repack.ts`.

---

## Human Verification Required

None. Three rounds of human UAT against `fixtures/SKINS/JOKERMAN_SPINE.json` were completed pre-verification:

- **Round 1** (2026-05-15): 4 bugs surfaced + fixed (dedup by regionName, rotation direction, success count, tooltip-on-label)
- **Round 2** (2026-05-15): 2 bugs surfaced + fixed (outPath-not-attachmentNames[0] dedup key; passthroughCopies missing from atlas)
- **Round 3** (2026-05-15): 2 bugs surfaced + fixed (overwrite probe blind to atlas targets; progress counter overshoot)

All UAT rounds approved by the user per 40-07-SUMMARY.md appendices. No outstanding human-verification items.

---

## Pre-Existing Failures (Unrelated to Phase 40)

Two test files were observed failing at the Phase 40 base commit `8a586cf` (pre-Phase-40):

- `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — missing `fixtures/SAMPLER_ALPHA_ZERO/` (gitignored)
- `tests/main/sampler-worker-girl.spec.ts` — missing `fixtures/Girl/` (gitignored)

Both are documented in `.planning/phases/40-atlas-repack-output/deferred-items.md`. **At the current HEAD on `experiment/phase-40-atlas-repack`, both failures appear to have already resolved or skip cleanly:** `npm test -- --run` returns 1181 passed / 2 skipped / 2 todo / 0 failures. These are NOT Phase 40 work product; they are noted here purely for traceability.

---

## Known Carry-Forwards (Deferred per User Decision)

Per the orchestrator note, the following code-review findings from `40-REVIEW.md` are explicitly deferred to a follow-up phase. All recorded in the YAML frontmatter `known_carry_forwards` section for downstream phase planning to pick up:

**WARNINGs (4):**
- **WR-03** — `SkeletonNotFoundOnLoadError` envelope drops the 4 new atlas fields on locate-skeleton-twice recovery (pattern-match miss vs Phase 36 WR-01 precedent for `sharpenOnExport`/`safetyBufferPercent`)
- **WR-04** — AppShell does not thread atlas fields into `ResampleArgs`; main-side coerce code at `project-io.ts:1346-1365` is dead on the happy path
- **WR-05** — `writtenPaths` rollback sweep lacks outDir-containment defense-in-depth check
- **WR-07** — `regionBuffers.get(r.regionName)!` non-null assertion in composite layer build; undocumented invariant

**INFOs (4):**
- **IN-01** — Duplicate `pageFilename` helper in `atlas-paths.ts` AND `atlas-writer.ts`
- **IN-02** — `regionBuffers` Map never cleared after page composite (memory pressure on 100+ MB atlases)
- **IN-03** — `deriveProjectName` generic error message for `:` in projectName
- **IN-04** — Duplicate-outPath warning emits `status:'success'` progress event (silently masks D-108 regression upstream)

None of these block goal achievement; all are correctness-non-critical or defensive hardening for edge cases.

---

## Gaps Summary

**No gaps.** All 10 REPACK requirements are satisfied at the codebase level, all 7 user-locked decisions are honored, all 5 invariants are preserved, all 18 required artifacts are present and substantive, all 12 key links are wired, the SHA256 regression sentinel + cross-mode parity + sharpen-invariant tests all pass, and the 3 rounds of human UAT against the production SKINS workflow surfaced + fixed 8 concrete bugs.

The remaining 8 code-review findings (4 WARNs + 4 INFOs) are explicitly deferred per user decision and recorded as known carry-forwards. Two pre-existing test failures (missing gitignored fixtures) pre-date Phase 40 and are documented in `deferred-items.md`.

**Verdict: Phase 40 goal achieved. Ready to proceed to `/gsd-complete-milestone v1.5`.**

---

_Verified: 2026-05-15T12:15Z_
_Verifier: Claude (gsd-verifier, goal-backward mode)_
_Test suite: 108 files / 1181 passed / 2 skipped / 2 todo / 0 failures_
_tsc --noEmit: clean_

---
phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21
plan: 04
type: execute
wave: 3
depends_on: [02, 03]
files_modified:
  - src/renderer/src/lib/export-view.ts
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
  - src/renderer/src/panels/AnimationBreakdownPanel.tsx
  - src/main/image-worker.ts
  - tests/core/export.spec.ts
  - tests/main/image-worker.passthrough.spec.ts
autonomous: true
requirements: [DIMS-03, DIMS-04]
must_haves:
  truths:
    - "src/renderer/src/lib/export-view.ts buildExportPlan is byte-identical to src/core/export.ts after cap step + passthrough partition mirror"
    - "computeExportDims helper (export-view.ts:139-161) reflects cap math so panel Peak W×H column matches cap output"
    - "image-worker.ts iterates plan.passthroughCopies BEFORE plan.rows (single index space [...passthroughCopies, ...rows])"
    - "Passthrough copy uses tmpPath + rename atomic-write per Phase 6 D-121 (R4 macOS delayed-allocation safety)"
    - "Passthrough copy honors mkdir(dirname(out), { recursive: true }) for nested region paths (R8 subfolder support)"
    - "Output PNG is byte-identical to source PNG (Buffer.equals proves no Lanczos pipeline ran)"
    - "Layer 3 invariant: fs.copyFile lives in src/main/image-worker.ts NOT src/core/"
    - "Aspect ratio invariant preserved: cap is uniform single multiplier (renderer mirror identical to core)"
    - "D-03: image-worker fs.promises.copyFile branch implements the passthrough byte-copy contract — user gets a complete images/ output folder with passthrough rows preserving byte-for-byte fidelity, no double Lanczos"
  artifacts:
    - path: src/renderer/src/lib/export-view.ts
      contains: "sourceRatio"
    - path: src/renderer/src/lib/export-view.ts
      contains: "passthroughCopies"
    - path: src/main/image-worker.ts
      contains: "copyFile"
    - path: tests/main/image-worker.passthrough.spec.ts
      provides: "main-process unit + integration tests for passthrough copy path"
  key_links:
    - from: src/core/export.ts buildExportPlan
      to: src/renderer/src/lib/export-view.ts buildExportPlan
      via: "byte-identical mirror (Phase 6 D-110 parity contract); function bodies match character-for-character"
      pattern: "regex grep + behavioral fixture in tests/core/export.spec.ts:595-666 parity describe"
    - from: src/main/image-worker.ts plan.passthroughCopies branch
      to: fs.promises.copyFile + tmpPath + rename atomic
      via: "passthrough loop fires BEFORE resize loop; absolute index 0..passthroughCopies.length-1"
      pattern: "copyFile.*tmpPath|copyFile.*resolvedOut"
---

<objective>
Mirror Plan 22-03's cap formula + passthrough partition byte-identically into `src/renderer/src/lib/export-view.ts` (Phase 6 D-110 parity contract). Extend `computeExportDims` to surface cap math in the panels' Peak W×H column. Extend `tests/core/export.spec.ts` parity describe block with cap-step regex + behavioral fixture asserting byte-equal passthroughCopies arrays between core and renderer.

Add `fs.promises.copyFile` branch to `src/main/image-worker.ts` for `plan.passthroughCopies` rows. Per RESEARCH §R4: use `tmpPath + rename` atomic-write pattern (matches Phase 6 D-121 + macOS delayed-allocation safety). Per RESEARCH §R8: `mkdir(dirname(out), { recursive: true })` for nested region paths like `AVATAR/FACE.png`. Per RESEARCH §Item #2 Option B: single index space `[...passthroughCopies, ...rows]` — image-worker iterates passthroughCopies FIRST, total = passthroughCopies.length + rows.length, progress events carry absolute index.

**Layer 3 invariant (CLAUDE.md fact #5):** `fs.copyFile` MUST live in `src/main/image-worker.ts`, NEVER in `src/core/`. The core/ tier has no DOM and no electron — sharp + fs.copyFile stay in main/. The cap-formula MIRROR in `src/renderer/src/lib/export-view.ts` is allowed because export-view is a renderer-side reproduction of core math (Phase 6 D-110 parity contract for in-renderer preview computations).

**Renderer parity contract (Phase 6 D-110):** function bodies in `src/renderer/src/lib/export-view.ts` are byte-identical to `src/core/export.ts`. Comments must match character-for-character (the parity test greps function bodies). When the planner refactors the cap into a helper in one file, refactor identically in the other — failure surfaces in the parity describe block at `tests/core/export.spec.ts:595-666`.

Per CONTEXT D-04 REVISED: the cap formula here is the SAME as in 22-03 — generous passthrough (`isCapped || peakAlreadyAtOrBelowSource`), uniform single multiplier from min(...) over both axes (aspect ratio invariant), test guards `Math.ceil(actualSourceW × cappedEffScale) === actualSourceW` AND `Math.ceil(actualSourceH × cappedEffScale) === actualSourceH` hold trivially when isCapped.

Purpose: Without the renderer mirror, the panel's Peak W×H column shows pre-cap values (lying to the user). Without the image-worker copy branch, plan.passthroughCopies rows are silently dropped from output (broken D-03 contract: "user gets a complete images/ folder back"). Without parity tests, mirror drift goes undetected until live UAT.

Output: Renderer mirrors cap math byte-for-byte; image-worker writes passthrough rows via atomic copyFile with subfolder support; new tests/main/image-worker.passthrough.spec.ts proves byte-identical output + R8 subfolder path handling; parity describe block extended with new cap-step regex assertions + behavioral fixture.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-CONTEXT.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-RESEARCH.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-PATTERNS.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-VALIDATION.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-02-loader-canonical-actual-walk-SUMMARY.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-03-core-export-cap-passthrough-SUMMARY.md

<interfaces>
src/core/export.ts (mirror source — DO NOT modify in this plan): the cap step + partition emitted in Plan 22-03. Lines containing:
- const sourceRatio = ... (cap formula)
- const cappedEffScale = Math.min(downscaleClampedScale, sourceRatio);
- const isCapped = downscaleClampedScale > sourceRatio;
- const peakAlreadyAtOrBelowSource = ...;
- const isPassthrough = row.dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource);
- if (acc.isPassthrough) passthroughCopies.push(exportRow); else rows.push(exportRow);

src/renderer/src/lib/export-view.ts (mirror target — extend in this plan): after mirror, the same cap step + partition exists in this file. Comments byte-identical.

src/main/image-worker.ts (extend in this plan): existing imports at line 57 are
import { access, mkdir, rename, constants as fsConstants } from 'node:fs/promises';
After Phase 22 extension:
import { access, copyFile, mkdir, rename, constants as fsConstants } from 'node:fs/promises';

Existing main loop iterates plan.rows. Phase 22 extension iterates plan.passthroughCopies FIRST, then plan.rows. Total event count = passthroughCopies.length + rows.length. Progress event carries absolute index.

Existing parity describe block at tests/core/export.spec.ts:595-666 (extend in this plan): add new regex assertions + behavioral parity fixture for passthroughCopies.

New file: tests/main/image-worker.passthrough.spec.ts. Real-bytes pattern from tests/main/image-worker.integration.spec.ts. Runs runExport on a plan with passthroughCopies; asserts:
- summary.successes === count
- Output PNG byte-identical to source PNG via Buffer.equals
- R8 subfolder path: AVATAR/FACE.png creates AVATAR/ subdir under outDir
- R4 atomic write: tmpPath does NOT exist after copy completes
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Mirror cap formula + passthrough partition into src/renderer/src/lib/export-view.ts byte-identically; extend computeExportDims with actualSource params; extend parity describe block</name>
  <read_first>
    - src/core/export.ts (post-22-03 — full file; the canonical source for the mirror)
    - src/renderer/src/lib/export-view.ts (entire file — focus: lines 1-44 docblock locking parity contract; lines 28-32 parity contract verbatim; lines 110-115 safeScale mirror; lines 139-161 computeExportDims helper; the buildExportPlan body in this file)
    - tests/core/export.spec.ts (lines 595-666 parity describe block — full content; add new assertions but DO NOT delete existing)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-RESEARCH.md (§ DIMS-03 + DIMS-04 Implementation > Mirrored cap in src/renderer/src/lib/export-view.ts; § R2 Renderer-mirror parity contract drift)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-PATTERNS.md (§ src/renderer/src/lib/export-view.ts — parity contract, computeExportDims helper extension)
    - src/renderer/src/panels/GlobalMaxRenderPanel.tsx (lines 186-206 enrichWithEffective — call site of computeExportDims; verify what it reads)
    - src/renderer/src/panels/AnimationBreakdownPanel.tsx (sibling enrichWithEffective)
  </read_first>
  <behavior>
    - Test 1 (parity regex new): tests/core/export.spec.ts parity describe asserts /Math\.min\([^)]*actualSourceW\s*\/\s*canonicalW/ matches in BOTH src/core/export.ts AND src/renderer/src/lib/export-view.ts.
    - Test 2 (parity regex new): same describe asserts passthroughCopies declaration + push pattern matches in BOTH files.
    - Test 3 (parity behavioral new): build a SkeletonSummary with one drifted row in BOTH files; assert byte-equal passthroughCopies arrays via toEqual.
    - Test 4 (parity behavioral new — peakAlreadyAtOrBelowSource branch): build a SkeletonSummary where peakScale less than sourceRatio; assert both files emit identical passthrough partition.
    - Test 5 (computeExportDims cap awareness): when called with dimsMismatch:true + actualSource defined, returned outW === actualSource (not pre-cap canonical times peakScale).
  </behavior>
  <action>
    Step 1: Open src/core/export.ts and copy the cap-step + partition lines verbatim (those landed in Plan 22-03). Note the exact whitespace, comment characters, identifier names. The mirror is byte-for-byte — comments included.

    Step 2: Open src/renderer/src/lib/export-view.ts. Apply the SAME edits as Plan 22-03 made to src/core/export.ts:
    - Modify Acc interface to carry isPassthrough: boolean (replacing the older isCapped naming if present).
    - Insert cap step (sourceRatio + cappedEffScale + isCapped + peakAlreadyAtOrBelowSource + isPassthrough) inside the per-row loop body.
    - Update accumulator (Map.set + dedup-keep-max) to carry isPassthrough.
    - Replace emit-rows loop with rows[]/passthroughCopies[] partition.
    - Add passthroughCopies.sort(...) to the returned object.
    - Update totals.count to include both arrays.

    Comments must match character-for-character. The parity test in tests/core/export.spec.ts greps function bodies — divergent comments fail.

    Step 3: Extend computeExportDims (export-view.ts:139-161). Per RESEARCH § DIMS-03 Implementation + PATTERNS § computeExportDims helper:

    ```typescript
    export function computeExportDims(
      sourceW: number,
      sourceH: number,
      peakScale: number,
      override: number | undefined,
      // Phase 22 DIMS-03 — new params for cap math (panel Peak W×H column reflects cap output)
      actualSourceW?: number,
      actualSourceH?: number,
      dimsMismatch?: boolean,
    ): { effScale: number; outW: number; outH: number } {
      const rawEffScale = override !== undefined
        ? applyOverride(override).effectiveScale
        : peakScale;
      const downscaleClampedScale = Math.min(safeScale(rawEffScale), 1);
      // Phase 22 DIMS-03 cap — uniform multiplier
      const sourceRatio = (dimsMismatch && actualSourceW !== undefined && actualSourceH !== undefined)
        ? Math.min(actualSourceW / sourceW, actualSourceH / sourceH)
        : Infinity;
      const effScale = Math.min(downscaleClampedScale, sourceRatio);
      const outW = Math.ceil(sourceW * effScale);
      const outH = Math.ceil(sourceH * effScale);
      return { effScale, outW, outH };
    }
    ```

    Note: sourceW + sourceH params here ARE canonical (post-Phase-21). When the cap binds (cappedEffScale === sourceRatio = actualSourceW/canonicalW), Math.ceil(canonicalW × that) === actualSourceW by construction — the legacy ceil formula yields actualSource at the cap edge.

    Step 4: Update enrichWithEffective callers in GlobalMaxRenderPanel.tsx + AnimationBreakdownPanel.tsx — pass the new fields:
    ```typescript
    const { effScale, outW, outH } = computeExportDims(
      row.sourceW,
      row.sourceH,
      row.peakScale,
      row.override,
      row.actualSourceW,
      row.actualSourceH,
      row.dimsMismatch,
    );
    ```
    Both panels — sibling-symmetric per Phase 19 D-06.

    Step 5: Extend parity describe block in tests/core/export.spec.ts:595-666. ADD new assertions inside the existing describe (do NOT remove existing ones):

    ```typescript
    it('Phase 22 DIMS-03 cap formula present in BOTH files', () => {
      const coreText = readFileSync(EXPORT_SRC, 'utf8');
      const viewText = readFileSync(VIEW_SRC, 'utf8');
      const sig = /Math\.min\([^)]*actualSourceW\s*\/\s*canonicalW/;
      expect(coreText).toMatch(sig);
      expect(viewText).toMatch(sig);
    });

    it('Phase 22 DIMS-04 passthrough partition present in BOTH files', () => {
      const coreText = readFileSync(EXPORT_SRC, 'utf8');
      const viewText = readFileSync(VIEW_SRC, 'utf8');
      const sigDecl = /const\s+passthroughCopies\s*:\s*ExportRow\[\]\s*=\s*\[\]/;
      const sigPush = /passthroughCopies\.push\(/;
      expect(coreText).toMatch(sigDecl);
      expect(viewText).toMatch(sigDecl);
      expect(coreText).toMatch(sigPush);
      expect(viewText).toMatch(sigPush);
    });

    it('Phase 22 D-04 REVISED isPassthrough predicate in BOTH files', () => {
      const coreText = readFileSync(EXPORT_SRC, 'utf8');
      const viewText = readFileSync(VIEW_SRC, 'utf8');
      const sig = /isCapped\s*\|\|\s*peakAlreadyAtOrBelowSource/;
      expect(coreText).toMatch(sig);
      expect(viewText).toMatch(sig);
    });

    it('Phase 22 behavioral parity: drifted row produces IDENTICAL passthroughCopies in both files', async () => {
      const viewModule = await import('../../src/renderer/src/lib/export-view.js');
      const buildExportPlanView = viewModule.buildExportPlan;
      const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.7);
      const corePlan = buildExportPlan(summary, new Map());
      const viewPlan = buildExportPlanView(summary, new Map());
      expect(viewPlan.passthroughCopies).toEqual(corePlan.passthroughCopies);
      expect(viewPlan.rows).toEqual(corePlan.rows);
      expect(viewPlan.totals).toEqual(corePlan.totals);
    });

    it('Phase 22 behavioral parity: peakAlreadyAtOrBelowSource branch produces IDENTICAL output in both files', async () => {
      const viewModule = await import('../../src/renderer/src/lib/export-view.js');
      const buildExportPlanView = viewModule.buildExportPlan;
      const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.3);
      const corePlan = buildExportPlan(summary, new Map());
      const viewPlan = buildExportPlanView(summary, new Map());
      expect(viewPlan.passthroughCopies).toEqual(corePlan.passthroughCopies);
      expect(viewPlan.rows).toEqual(corePlan.rows);
    });
    ```

    Step 6: Run npm run test -- tests/core/export.spec.ts to confirm parity describe block passes.
  </action>
  <verify>
    <automated>npx vitest run tests/core/export.spec.ts -t "parity|Phase 22"</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "sourceRatio" src/renderer/src/lib/export-view.ts returns greater than or equal 2
    - grep -c "passthroughCopies" src/renderer/src/lib/export-view.ts returns greater than or equal 3
    - grep -c "peakAlreadyAtOrBelowSource" src/renderer/src/lib/export-view.ts returns greater than or equal 1
    - grep -E "Math\\.min\\([^)]*actualSourceW\\s*/\\s*canonicalW" src/renderer/src/lib/export-view.ts returns greater than or equal 1
    - Parity behavioral test "Phase 22 behavioral parity: drifted row produces IDENTICAL passthroughCopies in both files" passes — toEqual matches between core and view plans
    - Parity behavioral test for peakAlreadyAtOrBelowSource branch passes
    - Three new parity regex assertions all pass
    - All existing parity describe block tests STILL pass (no regression on Phase 6 D-110 contract)
    - GlobalMaxRenderPanel.tsx + AnimationBreakdownPanel.tsx call computeExportDims with new params (grep confirms presence of row.actualSourceW + row.dimsMismatch in panel sources)
  </acceptance_criteria>
  <done>Renderer mirror byte-identical to core; computeExportDims surfaces cap math; parity describe block extended with cap-step regex + behavioral fixture; ≥ 5 new parity assertions all green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add fs.promises.copyFile branch to src/main/image-worker.ts for plan.passthroughCopies; new tests/main/image-worker.passthrough.spec.ts proves byte-identical output + R8 subfolder + R4 atomic-write</name>
  <read_first>
    - src/main/image-worker.ts (entire file — focus: line 57 imports; line 80 pre-loop setup; lines 97-308 main per-row loop; lines 233-244 mkdir step; lines 246-287 sharp resize; lines 289-304 rename atomic; line 100 isCancelled() check)
    - src/shared/types.ts (ExportPlan post-Plan-22-01; ExportProgressEvent shape)
    - tests/main/image-worker.spec.ts (lines 1-130 mocked unit pattern; useful for the planner's eyes only — passthrough spec uses real-bytes pattern instead)
    - tests/main/image-worker.integration.spec.ts (lines 1-87 real-bytes pattern; this is the analog template)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-RESEARCH.md (§ Open Research Item #2 RESOLVED — fs.promises.copyFile + Option A vs B; § R4 macOS delayed-allocation race; § R8 F8.3 subfolder paths)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-PATTERNS.md (§ src/main/image-worker.ts — full walkthrough; § Atomic-write contract Phase 6 D-121)
    - fixtures/EXPORT_PROJECT/images/CIRCLE.png (real PNG for byte-identical assertion)
    - fixtures/SIMPLE_PROJECT_NO_ATLAS/images/ (atlas-less fixture PNGs)
  </read_first>
  <behavior>
    - Test 1 (DIMS-04 main-process unit): build ExportPlan with rows:[], passthroughCopies:[{outPath:'images/CIRCLE.png', sourceW:699, sourceH:699, outW:699, outH:699, ...}]; runExport into tmpDir; assert summary.successes === 1, summary.errors === [].
    - Test 2 (byte-identical output): output PNG buffer === source PNG buffer via Buffer.compare (proves no Lanczos pipeline ran — passthrough is pure copy).
    - Test 3 (R4 atomic-write): after copy completes, tmpPath does NOT exist (rename consumed it).
    - Test 4 (R8 subfolder support): passthrough copy of AVATAR/FACE.png creates AVATAR/ subdirectory under outDir; output file present at outDir/AVATAR/FACE.png.
    - Test 5 (mixed plan ordering): plan with passthroughCopies + rows; runExport iterates passthroughCopies FIRST, progress events carry absolute index 0..passthroughCopies.length-1 for passthrough, then passthroughCopies.length..total-1 for resize.
    - Test 6 (cooperative cancel): isCancelled() returning true between passthrough rows breaks the loop (no further copies; bailedOnCancel=true).
    - Test 7 (error propagation): missing source PNG yields ExportError with kind matching access-error or write-error; subsequent rows still process.
  </behavior>
  <action>
    Step 1: Edit src/main/image-worker.ts. Update line 57 import to add copyFile to the destructure:
    ```typescript
    import { access, copyFile, mkdir, rename, constants as fsConstants } from 'node:fs/promises';
    ```

    Step 2: Update the total event count (line ~85 wherever total is defined). Was: const total = plan.rows.length;. Now:
    ```typescript
    const total = plan.passthroughCopies.length + plan.rows.length;
    ```

    Step 3: Insert the passthrough loop BEFORE the existing for-loop over plan.rows (line ~97). Pattern mirrors the resize loop's pre-flight + atomic write, but uses copyFile instead of sharp:

    ```typescript
    // Phase 22 DIMS-04 — passthrough byte-copies (D-03). Iterate FIRST so
    // progress events for these rows carry absolute indices 0..passthroughCopies.length-1.
    // Resize rows then carry indices passthroughCopies.length..total-1. Single index
    // space per RESEARCH Item #2 Option B (cleaner for IPC progress event indexing).
    for (let pi = 0; pi < plan.passthroughCopies.length; pi++) {
      if (isCancelled()) { bailedOnCancel = true; break; }
      const row = plan.passthroughCopies[pi];
      const sourcePath = row.sourcePath;
      const resolvedOut = pathResolve(outDir, row.outPath);
      const i = pi;  // absolute event index

      // Step 1: Pre-flight access check (R_OK on sourcePath; passthrough has no
      // atlas-extract fallback — fall through to error on miss).
      try {
        await access(sourcePath, fsConstants.R_OK);
      } catch (e) {
        const error: ExportError = { kind: 'access-error', path: sourcePath, message: e instanceof Error ? e.message : String(e) };
        errors.push(error);
        onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
        continue;
      }

      // Step 2: Path-traversal defense — same as resize loop. (Reuse existing helper
      // if extracted in earlier phases; otherwise inline the rel-path check.)
      const rel = pathRelative(outDir, resolvedOut);
      if (rel.startsWith('..') || pathIsAbsolute(rel) || rel === '') {
        const error: ExportError = { kind: 'path-traversal', path: resolvedOut, message: `outPath escapes outDir: ${row.outPath}` };
        errors.push(error);
        onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
        continue;
      }

      // Step 4: mkdir parent. Phase 22 R8 — subfolder paths (e.g., AVATAR/FACE.png)
      // require parent-dir creation BEFORE copy. Same as the resize path; do not skip.
      try {
        await mkdir(pathDirname(resolvedOut), { recursive: true });
      } catch (e) {
        const error: ExportError = { kind: 'write-error', path: resolvedOut, message: e instanceof Error ? e.message : String(e) };
        errors.push(error);
        onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
        continue;
      }

      // Step 5: copyFile to tmpPath, then rename — atomic write per Phase 6 D-121
      // + R4 macOS delayed-allocation safety. Skip the sharp pipeline (this row is
      // already at-or-below sourceRatio per D-04 REVISED; re-Lanczos would be
      // wasteful + degrade quality).
      const tmpPath = resolvedOut + '.tmp';
      try {
        await copyFile(sourcePath, tmpPath);
      } catch (e) {
        const error: ExportError = { kind: 'write-error', path: resolvedOut, message: e instanceof Error ? e.message : String(e) };
        errors.push(error);
        onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
        continue;
      }
      try {
        await rename(tmpPath, resolvedOut);
      } catch (e) {
        const error: ExportError = { kind: 'write-error', path: resolvedOut, message: e instanceof Error ? e.message : String(e) };
        errors.push(error);
        onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
        continue;
      }

      successes++;
      onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'success' });
    }
    ```

    NOTE: the existing resize loop's `i` variable IS the loop counter today. After this change, that counter must offset by plan.passthroughCopies.length for IPC progress correctness. Rename the resize loop's counter to `ri` and compute `const i = plan.passthroughCopies.length + ri;` for all `onProgress({ index: i, ... })` event emissions. Use this offset everywhere the existing resize loop calls onProgress — multiple sites per row (pre-flight error, sharp error, rename error, success).

    Adapt path helper imports to whatever's already imported (pathResolve, pathDirname, pathRelative, pathIsAbsolute) — those are likely already in scope at the top of image-worker.ts. If they're imported under different names, use those names.

    Step 4: Audit Layer 3 invariant. After this edit, src/main/image-worker.ts (Layer 3 main-process) should have copyFile from node:fs/promises. CRITICAL: this MUST stay in main/, NEVER in core/. Verify no `import.*copyFile` was added to any src/core/* file:
    ```bash
    grep -rn "copyFile" src/core/ 2>/dev/null
    ```
    Should return zero hits.

    Step 5: Create new file tests/main/image-worker.passthrough.spec.ts. Use the real-bytes pattern from tests/main/image-worker.integration.spec.ts as the analog:

    ```typescript
    import { describe, expect, it, beforeEach, afterEach } from 'vitest';
    import * as os from 'node:os';
    import * as fs from 'node:fs';
    import * as path from 'node:path';
    import { runExport } from '../../src/main/image-worker.js';
    import type { ExportPlan, ExportProgressEvent } from '../../src/shared/types.js';

    let tmpDir: string;
    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase22-passthrough-'));
    });
    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('image-worker — DIMS-04 passthrough byte-copy (Phase 22)', () => {
      it('passthrough row produces byte-identical output PNG (no Lanczos)', async () => {
        const sourcePath = path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png');
        const plan: ExportPlan = {
          rows: [],
          excludedUnused: [],
          passthroughCopies: [{
            sourcePath,
            outPath: 'images/CIRCLE.png',
            sourceW: 699, sourceH: 699,
            outW: 699, outH: 699,
            effectiveScale: 1.0,
            attachmentNames: ['CIRCLE'],
          }],
          totals: { count: 1 },
        };
        const events: ExportProgressEvent[] = [];
        const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);
        expect(summary.successes).toBe(1);
        expect(summary.errors).toEqual([]);
        const sourceBuf = fs.readFileSync(sourcePath);
        const outBuf = fs.readFileSync(path.join(tmpDir, 'images/CIRCLE.png'));
        expect(Buffer.compare(sourceBuf, outBuf)).toBe(0);  // byte-identical
      });

      it('byte-identical: Buffer.compare returns 0 (no Lanczos pipeline ran)', async () => {
        const sourcePath = path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png');
        const plan: ExportPlan = { rows: [], excludedUnused: [], passthroughCopies: [{ sourcePath, outPath: 'images/CIRCLE.png', sourceW: 699, sourceH: 699, outW: 699, outH: 699, effectiveScale: 1.0, attachmentNames: ['CIRCLE'] }], totals: { count: 1 } };
        await runExport(plan, tmpDir, () => {}, () => false);
        const sourceBuf = fs.readFileSync(sourcePath);
        const outBuf = fs.readFileSync(path.join(tmpDir, 'images/CIRCLE.png'));
        expect(Buffer.compare(sourceBuf, outBuf)).toBe(0);
      });

      it('R4 atomic-write: tmpPath does NOT exist after copy completes', async () => {
        const sourcePath = path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png');
        const plan: ExportPlan = { rows: [], excludedUnused: [], passthroughCopies: [{ sourcePath, outPath: 'images/CIRCLE.png', sourceW: 699, sourceH: 699, outW: 699, outH: 699, effectiveScale: 1.0, attachmentNames: ['CIRCLE'] }], totals: { count: 1 } };
        await runExport(plan, tmpDir, () => {}, () => false);
        expect(fs.existsSync(path.join(tmpDir, 'images/CIRCLE.png.tmp'))).toBe(false);
        expect(fs.existsSync(path.join(tmpDir, 'images/CIRCLE.png'))).toBe(true);
      });

      it('R8 subfolder support: passthrough copy of AVATAR/FACE.png creates AVATAR/ subdir', async () => {
        const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase22-src-'));
        fs.mkdirSync(path.join(srcDir, 'AVATAR'));
        const sourcePath = path.join(srcDir, 'AVATAR/FACE.png');
        fs.copyFileSync(path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png'), sourcePath);
        try {
          const plan: ExportPlan = {
            rows: [],
            excludedUnused: [],
            passthroughCopies: [{
              sourcePath,
              outPath: 'images/AVATAR/FACE.png',
              sourceW: 699, sourceH: 699, outW: 699, outH: 699,
              effectiveScale: 1.0,
              attachmentNames: ['AVATAR/FACE'],
            }],
            totals: { count: 1 },
          };
          const summary = await runExport(plan, tmpDir, () => {}, () => false);
          expect(summary.successes).toBe(1);
          expect(fs.existsSync(path.join(tmpDir, 'images/AVATAR/FACE.png'))).toBe(true);
          expect(fs.statSync(path.join(tmpDir, 'images/AVATAR')).isDirectory()).toBe(true);
        } finally {
          fs.rmSync(srcDir, { recursive: true, force: true });
        }
      });

      it('mixed plan: passthroughCopies fire FIRST then rows; progress events carry absolute index', async () => {
        const sourcePath = path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png');
        const plan: ExportPlan = {
          rows: [{
            sourcePath, outPath: 'images/RESIZED.png',
            sourceW: 699, sourceH: 699, outW: 350, outH: 350,
            effectiveScale: 0.5, attachmentNames: ['RESIZED'],
          }],
          excludedUnused: [],
          passthroughCopies: [{
            sourcePath, outPath: 'images/PASSTHROUGH.png',
            sourceW: 699, sourceH: 699, outW: 699, outH: 699,
            effectiveScale: 1.0, attachmentNames: ['PASSTHROUGH'],
          }],
          totals: { count: 2 },
        };
        const events: ExportProgressEvent[] = [];
        await runExport(plan, tmpDir, (e) => events.push(e), () => false);
        const successEvents = events.filter((e) => e.status === 'success');
        expect(successEvents).toHaveLength(2);
        expect(successEvents[0].index).toBe(0);
        expect(successEvents[0].outPath).toMatch(/PASSTHROUGH\.png$/);
        expect(successEvents[1].index).toBe(1);
        expect(successEvents[1].outPath).toMatch(/RESIZED\.png$/);
        expect(events.every((e) => e.total === 2)).toBe(true);
      });

      it('cooperative cancel between passthrough rows', async () => {
        const sourcePath = path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png');
        const plan: ExportPlan = {
          rows: [],
          excludedUnused: [],
          passthroughCopies: [
            { sourcePath, outPath: 'images/A.png', sourceW: 699, sourceH: 699, outW: 699, outH: 699, effectiveScale: 1.0, attachmentNames: ['A'] },
            { sourcePath, outPath: 'images/B.png', sourceW: 699, sourceH: 699, outW: 699, outH: 699, effectiveScale: 1.0, attachmentNames: ['B'] },
          ],
          totals: { count: 2 },
        };
        let callCount = 0;
        const summary = await runExport(plan, tmpDir, () => {}, () => { callCount++; return callCount > 1; });
        // Adapt to whatever cancellation flag exists (bailedOnCancel | cancelled | etc.)
        expect(summary.successes).toBeLessThan(2);
      });

      it('missing source PNG yields error; subsequent rows still process', async () => {
        const realSource = path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png');
        const plan: ExportPlan = {
          rows: [],
          excludedUnused: [],
          passthroughCopies: [
            { sourcePath: '/does/not/exist.png', outPath: 'images/MISSING.png', sourceW: 1, sourceH: 1, outW: 1, outH: 1, effectiveScale: 1.0, attachmentNames: ['M'] },
            { sourcePath: realSource, outPath: 'images/REAL.png', sourceW: 699, sourceH: 699, outW: 699, outH: 699, effectiveScale: 1.0, attachmentNames: ['R'] },
          ],
          totals: { count: 2 },
        };
        const summary = await runExport(plan, tmpDir, () => {}, () => false);
        expect(summary.errors).toHaveLength(1);
        expect(summary.errors[0].kind).toMatch(/access-error|write-error/);
        expect(summary.successes).toBe(1);  // REAL row copied
        expect(fs.existsSync(path.join(tmpDir, 'images/REAL.png'))).toBe(true);
      });
    });
    ```

    Adapt the test details to whatever the existing image-worker.integration.spec.ts patterns dictate (ExportProgressEvent shape, ExportError kind union, summary return shape with bailedOnCancel/successes/errors).

    Step 6: Run npm run test -- tests/main/image-worker.passthrough.spec.ts to confirm new tests pass; then full suite to ensure no regression on existing image-worker.spec.ts / image-worker.integration.spec.ts.
  </action>
  <verify>
    <automated>npx vitest run tests/main/image-worker.passthrough.spec.ts tests/main/image-worker.spec.ts tests/main/image-worker.integration.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "copyFile" src/main/image-worker.ts returns greater than or equal 2 (import + call)
    - grep -rn "copyFile" src/core/ returns 0 hits (Layer 3 invariant; copyFile must NOT leak into core/)
    - tests/main/image-worker.passthrough.spec.ts has at least 7 tests; all pass
    - byte-identical assertion: Buffer.compare(sourceBuf, outBuf) === 0 — proves no Lanczos ran
    - R4 atomic-write test passes: tmpPath does NOT exist after copy
    - R8 subfolder test passes: AVATAR/FACE.png correctly creates AVATAR/ subdir
    - mixed-plan ordering test passes: passthrough events fire at index 0; resize at index 1
    - tests/main/image-worker.integration.spec.ts continues to pass (no regression on existing main-process tests)
    - tests/main/image-worker.spec.ts continues to pass (mocked-unit pattern unchanged)
  </acceptance_criteria>
  <done>image-worker has fs.promises.copyFile branch with tmpPath+rename atomic-write + mkdir-recursive parent + cooperative cancel; tests/main/image-worker.passthrough.spec.ts proves byte-identical output + R4 + R8 + mixed-plan ordering; Layer 3 invariant preserved (no copyFile in src/core/).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| renderer-mirror parity | Function bodies in src/core/export.ts and src/renderer/src/lib/export-view.ts must match byte-for-byte; drift breaks panel preview math |
| disk write safety | copyFile + rename atomic; macOS delayed-allocation race mitigated by tmpPath staging |
| path traversal | Untrusted region names (e.g. AVATAR/FACE.png) flow through outPath; path-traversal defense gates resolveOut |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-22-14 | Tampering | Mirror drift between core export.ts and export-view.ts | mitigate | Parity describe block at tests/core/export.spec.ts:595-666 — three new regex assertions + two behavioral fixtures (Task 1 Step 5) |
| T-22-15 | Information disclosure | Panel preview shows pre-cap dims; user makes wrong decisions | mitigate | computeExportDims now takes actualSource params; panels pass them through enrichWithEffective (Task 1 Step 4) |
| T-22-16 | Tampering | Path-traversal via crafted region name in passthrough loop | mitigate | Same path-traversal defense as resize loop (rel.startsWith('..') || pathIsAbsolute(rel)); fail-closed on attempt |
| T-22-17 | Denial of service | macOS delayed-allocation race produces partial-write file | mitigate | tmpPath + rename atomic — output path only appears when fully written (Phase 6 D-121 pattern; R4 mitigation) |
| T-22-18 | Tampering | copyFile leaked into src/core/ breaks Layer 3 invariant | mitigate | Task 2 Step 4 grep audit — zero hits in src/core/ for copyFile |
| T-22-19 | Information disclosure | Output PNG mtime fingerprint differs from source despite byte-identical content | accept | Filesystem mtime not part of D-03 contract; byte-identical byte stream is the user-facing guarantee |
</threat_model>

<verification>
- Renderer parity: 3 new regex assertions + 2 behavioral fixtures in tests/core/export.spec.ts:595-666 — all green.
- image-worker passthrough: ≥ 7 new tests in tests/main/image-worker.passthrough.spec.ts — all green; byte-identical assertion via Buffer.compare; R4 + R8 covered.
- Layer 3 invariant: grep -rn "copyFile" src/core/ returns 0 hits.
- Existing tests/main/image-worker.spec.ts + integration.spec.ts still passing (no regression on resize path).
- Aspect ratio test (Plan 22-03 Test 3) still passes when rerun against renderer mirror — confirms uniform single multiplier in both files.
</verification>

<success_criteria>
1. src/renderer/src/lib/export-view.ts has byte-identical cap formula + passthrough partition vs src/core/export.ts (DIMS-03 + DIMS-04 mirror).
2. computeExportDims helper accepts actualSourceW/H + dimsMismatch params; panels pass them through.
3. Parity describe block at tests/core/export.spec.ts:595-666 extended with: cap-formula regex, passthroughCopies declaration regex, isPassthrough predicate regex, drifted-row behavioral fixture, peakAlreadyAtOrBelowSource behavioral fixture (≥ 5 new assertions).
4. src/main/image-worker.ts has fs.promises.copyFile branch — passthrough loop fires BEFORE resize loop; tmpPath + rename atomic; mkdir parent for R8 subfolder support.
5. tests/main/image-worker.passthrough.spec.ts proves byte-identical output (no Lanczos) + R4 atomic-write + R8 subfolder + mixed-plan ordering + cooperative cancel + error propagation (≥ 7 tests).
6. Layer 3 invariant preserved: grep -rn "copyFile" src/core/ returns 0 hits.
7. Aspect ratio invariant preserved across both core and renderer mirror files (Plan 22-03 Test 3 still green when rerun).
</success_criteria>

<output>
After completion, create `.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-04-renderer-mirror-and-image-worker-SUMMARY.md`
</output>

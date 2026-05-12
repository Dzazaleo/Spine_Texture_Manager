---
phase: 35-region-keyed-export-plan
plan: 02
type: execute
wave: 1
depends_on: [01]
files_modified:
  - src/renderer/src/lib/export-view.ts
autonomous: true
requirements: [DEDUP-05]
must_haves:
  truths:
    - "`buildExportPlan` in src/renderer/src/lib/export-view.ts iterates `summary.regions` byte-identically to the core copy"
    - "Layer 3 invariant preserved: renderer copy imports zero symbols from src/core/*"
    - "applyOverride is still imported from `./overrides-view.js` (sibling renderer copy), NEVER from `../../../core/overrides.js`"
    - "The parity describe block in tests/core/export.spec.ts:665+ passes after the mirror lands"
    - "Structural diff between the two `buildExportPlan` function bodies reveals only the import lines and whitespace differences (no body divergence)"
  artifacts:
    - path: "src/renderer/src/lib/export-view.ts"
      provides: "Renderer-side buildExportPlan iterating summary.regions"
      contains: "for (const region of summary.regions)"
  key_links:
    - from: "src/renderer/src/lib/export-view.ts:buildExportPlan"
      to: "summary.regions (RegionRow[])"
      via: "for-of loop"
      pattern: "for\\s*\\(\\s*const\\s+region\\s+of\\s+summary\\.regions"
    - from: "src/renderer/src/lib/export-view.ts:buildExportPlan"
      to: "src/core/export.ts:buildExportPlan"
      via: "byte-identical function body parity contract"
      pattern: "Mirrors src/core/export\\.ts verbatim"
---

<objective>
Mirror plan 01's change byte-identically into `src/renderer/src/lib/export-view.ts:buildExportPlan`. The function body in the renderer copy MUST match the core copy structurally — the parity describe block in tests/core/export.spec.ts:665+ asserts both files share signature patterns (Map shape, override resolution, ceil sizing, conditional spreads). This plan exists as a separate plan (not folded into plan 01) so the lockstep duplication invariant is reinforced in the commit history: anyone reading `git log` sees plan 01 (core) immediately followed by plan 02 (renderer mirror) and learns the contract.

Purpose: Preserve the Phase 6 D-108 / Phase 4 D-75 Layer 3 inline-duplicate invariant. Renderer cannot import src/core/* (tests/arch.spec.ts:19-34); AppShell.tsx invokes `buildExportPlan` from local summary + overrides on every Optimize-Assets click, so the renderer needs its own copy of the function with the same iteration source.

Output: Updated `src/renderer/src/lib/export-view.ts` whose `buildExportPlan` body matches `src/core/export.ts:buildExportPlan` line-for-line modulo (a) the import block at the top and (b) the four "Mirrors src/core/export.ts verbatim" reminder comments.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/debug/skins-optimize-undercount.md
@CLAUDE.md

# Both parity copies — executor MUST read BOTH because this task IS the mirror.
@src/core/export.ts
@src/renderer/src/lib/export-view.ts

# RegionRow + SkeletonSummary.regions
@src/shared/types.ts

# Parity describe block — read the expected regex patterns to understand which signatures must remain matched
@tests/core/export.spec.ts

# Sibling renderer file — confirms the import path pattern (./overrides-view.js sibling, NOT ../../../core/overrides.js)
@src/renderer/src/lib/overrides-view.ts

<interfaces>
<!-- Lockstep parity contract — locked invariants. -->

The two `buildExportPlan` function bodies are byte-identical except for:

1. **Import block** — the renderer copy imports types from `'../../../shared/types.js'`
   (3-deep relative) and runtime `applyOverride` from `'./overrides-view.js'` (sibling).
   The core copy imports types from `'../shared/types.js'` and runtime `applyOverride`
   from `'./overrides.js'`. The renderer copy ALSO imports `clampOverride` from
   `./overrides-view.js` (consumed only by `computeExportDims`, not by `buildExportPlan`).

2. **Mirror reminder comments** — four inline comments inside the renderer copy read
   `// Mirrors src/core/export.ts verbatim (hygiene test enforces parity).` at the
   end of long docblocks. These are intentional and MUST be preserved (they cue
   future readers to keep the parity contract; removing them would loosen the
   social-contract layer that supplements the regex-based parity test).

3. **The `computeExportDims` exported function** — exists ONLY in the renderer copy
   (lines 154-251). Not in the core copy. Used by the renderer's Global panel for
   peak-dim display + Optimize dialog pre-flight list. DO NOT TOUCH `computeExportDims`
   in this task — it does NOT iterate any summary field and is unrelated to the
   region-keyed migration.

Everything else inside the `buildExportPlan` function body — the Acc interface,
the for-loop iteration source, the override-key resolution, the bufferPct math,
the safeScale clamp, the sourceRatio cap, the keep-max dedup, the emit-loop
conditional spreads — MUST be structurally identical between the two files.

**Parity test patterns** (from tests/core/export.spec.ts:665-741, locked by Phase 6 D-108):
- `/export\s+function\s+buildExportPlan/` — both files must export buildExportPlan
- `/const\s+bySourcePath\s*=\s*new\s+Map/` — both files must use the same dedup map name
- `/Math\.ceil\(\(acc\.row\.canonicalW \?\? acc\.row\.sourceW\)/` — both files share the canonical-base ceil sizing
- `/applyOverride\(overridePct,\s*row\.peakScale\)\.effectiveScale/` — **NOTE:** this regex matches `row.peakScale` literally. After plan 01 renames the loop variable from `row` to `region`, this regex will need updating in the test OR the test will fail. Plan 02's task list includes updating this parity-regex assertion in lockstep so the parity test passes on both files post-migration.
- `/bufferPct\s*===\s*0\s*\?\s*rawEffScale\s*:\s*rawEffScale\s*\*\s*\(1\s*\+\s*bufferPct\s*\/\s*100\)/` — buffer-multiply signature, unchanged
- `/acc\.bufferCapped\s*\?\s*\{\s*bufferCapped:\s*true\s*\}/` — bufferCapped conditional spread, unchanged
- `/safetyBufferPercent\?\s*:\s*number/` — opts field declaration, unchanged
- `/export\s+function\s+safeScale/` — helper export, unchanged
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Mirror plan 01's changes into src/renderer/src/lib/export-view.ts</name>
  <files>src/renderer/src/lib/export-view.ts</files>
  <read_first>
    - src/core/export.ts (READ AFTER PLAN 01 LANDED — this is the source of truth the mirror copies from; the executor needs to see the post-plan-01 state to mirror it correctly)
    - src/renderer/src/lib/export-view.ts (read in full — the current state of the renderer copy + the `computeExportDims` function that lives only here)
    - src/shared/types.ts lines 216-293 (RegionRow definition) and line 787 (`regions: RegionRow[]` field)
    - tests/core/export.spec.ts lines 650-741 (the parity describe block — confirm which regex patterns lock which signatures so the mirror preserves all of them)
    - src/renderer/src/lib/overrides-view.ts (sibling renderer copy — confirms the import path pattern; renderer NEVER imports from src/core/*)
    - .planning/debug/skins-optimize-undercount.md
  </read_first>
  <action>
**Mirror the exact transformations plan 01 made to src/core/export.ts into src/renderer/src/lib/export-view.ts:buildExportPlan. The body must be structurally identical post-edit.**

Concrete steps:

1. **Type import update** (line 45-50 of export-view.ts):
   - Add `RegionRow` to the type-only import from `'../../../shared/types.js'`:
     ```typescript
     import type {
       DisplayRow,   // keep or drop based on remaining references (mirror what plan 01 did in the core file)
       ExportPlan,
       ExportRow,
       RegionRow,    // ADD
       SkeletonSummary,
     } from '../../../shared/types.js';
     ```
   - Decision rule for `DisplayRow`: if plan 01 dropped `DisplayRow` from the core import, drop it here too. If plan 01 kept it, keep it. The renderer copy MUST mirror the same decision so the parity-grep `(?:DisplayRow,?\s*)` shape stays in sync.
   - The runtime imports (`applyOverride, clampOverride` from `./overrides-view.js`) STAY EXACTLY AS THEY ARE. DO NOT change them to core paths — that would break the Layer 3 arch test (tests/arch.spec.ts:19-34).

2. **`Acc` interface row-field type** (line 274-280):
   - Change `row: DisplayRow;` → `row: RegionRow;`. Identical to the core change in plan 01.

3. **Iteration source swap** (current line 282):
   - Change: `for (const row of summary.peaks) {`
   - To:     `for (const region of summary.regions) {`
   - Rename all loop-local `row` references to `region` (same as plan 01).

4. **Excluded-check guard** (current line 283):
   - `if (excluded.has(row.attachmentName)) continue;` → `if (excluded.has(region.attachmentName)) continue;`
   - Preserve the same narrow-translation rule from plan 01 step 3 (uses the winning contributor's name; does NOT widen to contributingAttachments).

5. **Override-key resolution** (current line 298):
   - `const overrideKey = row.regionName ?? row.attachmentName;` → `const overrideKey = region.regionName ?? region.attachmentName;`

6. **`Acc.attachmentNames` accumulator — the semantic change** (current lines 375 + 384-386):
   - Insert branch — change `attachmentNames: [row.attachmentName],` to:
     ```typescript
     attachmentNames: region.contributingAttachments.map((c) => c.attachmentName),
     ```
   - Merge branch — change:
     ```typescript
     if (!prev.attachmentNames.includes(row.attachmentName)) {
       prev.attachmentNames.push(row.attachmentName);
     }
     ```
     to:
     ```typescript
     for (const c of region.contributingAttachments) {
       if (!prev.attachmentNames.includes(c.attachmentName)) {
         prev.attachmentNames.push(c.attachmentName);
       }
     }
     ```

7. **Loop body — all other lines (override resolution, applyOverride, bufferPct math, safeScale, clamp, sourceRatio cap, isCapped/bufferCapped flags, prev branch, effScale keep-max) renamed `row` → `region` byte-identically with plan 01.** The emit loop (lines 412-469) is unchanged — operates on `acc.row.*` which still works because `Acc.row` is now RegionRow and RegionRow has every field DisplayRow had that the emit loop reads.

8. **Inline comment updates** — mirror the comment edits plan 01 made:
   - Update the docblock at lines 91-95 ("D-108 dedup ... summary.peaks ...") to reference `summary.regions`.
   - Update the Phase 29 D-04 comment (lines 295-297) to say "the for-loop over summary.regions reads" instead of "the for-loop over summary.peaks reads". Keep the "Lockstep duplication invariant: the byte-identical body is mirrored in src/core/export.ts's buildExportPlan." line — it stays accurate.
   - Add the same one-line Phase 35 marker comment at the top of the loop that plan 01 added in core.
   - Preserve every existing "Mirrors src/core/export.ts verbatim (hygiene test enforces parity)." reminder comment exactly as-is. These are the social-contract layer of the parity invariant.

9. **DO NOT TOUCH `computeExportDims`** (lines 154-251). It does not iterate any summary field and is orthogonal to the migration. Its signature, body, and exports remain byte-identical to pre-plan state.

10. **Update the parity test regex assertion at tests/core/export.spec.ts:699-701** in lockstep — see Task 2 below. The parity test currently asserts:
    ```typescript
    const overrideSig = /applyOverride\(overridePct,\s*row\.peakScale\)\.effectiveScale/;
    ```
    The `row.peakScale` literal regex will no longer match either file after plan 01 + plan 02 land (both files use `region.peakScale` now). Task 2 updates this regex; without Task 2, `npm test -- export.spec.ts` fails on the parity describe block even though the parity contract is actually preserved.

**Pitfalls to avoid:**

- DO NOT change the renderer's import paths to `src/core/*` paths. The Layer 3 arch test forbids it.
- DO NOT touch `computeExportDims` (lines 154-251). Out of scope for this phase.
- DO NOT update tests/core/export.spec.ts inside this task — Task 2 handles parity-regex updates separately so the diff is reviewable in isolation.
- DO NOT remove the "Mirrors src/core/export.ts verbatim (hygiene test enforces parity)." reminder comments. They are the social-contract reinforcement layer.
- DO NOT introduce divergence from the core copy. If a comment exists in core that doesn't exist in the renderer copy (or vice versa), KEEP THE EXISTING SHAPE — do not "normalize" the comment layer. The function body must match; the docblock/comment layer is allowed to differ historically.
  </action>
  <verify>
    <automated>
      cd /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager &&
      grep -c "for (const region of summary.regions)" src/renderer/src/lib/export-view.ts &&
      ! grep -E "for \(const (row|peak) of summary\.peaks\)" src/renderer/src/lib/export-view.ts &&
      ! grep -E "from ['\"][^'\"]*\/core\/" src/renderer/src/lib/export-view.ts
    </automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "for (const region of summary.regions)" src/renderer/src/lib/export-view.ts` returns at least 1
    - `grep -E "for \(const (row|peak) of summary\.peaks\)" src/renderer/src/lib/export-view.ts` returns 0 matches
    - `grep -c "region.contributingAttachments" src/renderer/src/lib/export-view.ts` returns at least 1 (matches the core copy's accumulator pattern)
    - `grep -E "from ['\"][^'\"]*\/core\/" src/renderer/src/lib/export-view.ts` returns 0 matches (Layer 3 invariant preserved — renderer never imports src/core/*)
    - `grep -c "from './overrides-view.js'" src/renderer/src/lib/export-view.ts` returns 1 (sibling import preserved)
    - `grep -c "RegionRow" src/renderer/src/lib/export-view.ts` returns at least 1 (type-only import added)
    - `grep -c "export function computeExportDims" src/renderer/src/lib/export-view.ts` returns 1 (the renderer-only helper is untouched)
    - Structural body comparison of the two `buildExportPlan` functions reveals only the documented differences (the import block at file top, the four "Mirrors src/core/export.ts verbatim" reminder comments, the `computeExportDims` function that exists only in the renderer copy). Verify via:
      ```
      diff <(sed -n '/^export function buildExportPlan/,/^}$/p' src/core/export.ts) <(sed -n '/^export function buildExportPlan/,/^}$/p' src/renderer/src/lib/export-view.ts) | grep -E '^[<>]' | grep -vE 'Mirrors src/core/export\.ts verbatim|^[<>] *$|^[<>] *//'
      ```
      should print zero non-comment lines (only allowed differences: the parity-reminder comments and blank lines).
  </acceptance_criteria>
  <done>
    src/renderer/src/lib/export-view.ts:buildExportPlan body matches src/core/export.ts:buildExportPlan structurally. Layer 3 invariant preserved. computeExportDims untouched.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update the parity-regex test patterns in tests/core/export.spec.ts</name>
  <files>tests/core/export.spec.ts</files>
  <read_first>
    - tests/core/export.spec.ts lines 650-741 (the parity describe block — see ALL existing regex patterns before deciding which need updating)
    - src/core/export.ts (post-plan-01 state — confirms `row` is renamed to `region` everywhere inside buildExportPlan)
    - src/renderer/src/lib/export-view.ts (post-task-1 state — confirms the renderer copy uses the same variable name)
  </read_first>
  <action>
**Targeted edit. Update only the parity regex patterns that referenced the old `row` loop variable. Most parity regexes are unaffected (they target structural signatures like `bySourcePath = new Map`, `Math.ceil((acc.row.canonicalW ...`, `bufferPct === 0 ? rawEffScale ...`) which do NOT change with the loop-variable rename.**

Walk through tests/core/export.spec.ts lines 681-741 and update only the regex patterns whose literal text mentions `row.peakScale`, `row.attachmentName`, `row.sourcePath`, etc. — i.e. patterns that look at the for-loop variable. Patterns that look at `acc.row.canonicalW`, `acc.bufferCapped`, etc. (the dedup-accumulator field, NOT the loop variable) DO NOT change.

Concrete edits expected:

1. **Line ~699 — `overrideSig`:**
   - Currently: `const overrideSig = /applyOverride\(overridePct,\s*row\.peakScale\)\.effectiveScale/;`
   - Change to: `const overrideSig = /applyOverride\(overridePct,\s*region\.peakScale\)\.effectiveScale/;`
   - Rationale: both files now use `region.peakScale` post-migration.

2. **Verify each other parity regex in the describe block (lines 665-741) and confirm whether it targets the loop variable (`row`) or the accumulator (`acc.row`). For any pattern that targets the loop variable, update to `region`. For accumulator patterns, leave alone.** Expected outcome: only the one regex above changes. If any other pattern matches `row.` (a dot-property access) where `row` is the loop variable, update it consistently.

3. **DO NOT change the test names ("renderer view exports buildExportPlan by name", etc.) or the rest of the parity describe block. Only the regex literal needs updating to match the post-migration source.**

4. **Add a small block comment above the changed regex** noting the Phase 35 source: `// Phase 35 — loop variable renamed `row` → `region` when buildExportPlan migrated to iterate summary.regions (DEDUP-04/05/06). Regex updated in lockstep with the source files.`

5. **The runtime-equality parity test ("renderer view buildExportPlan produces IDENTICAL ExportPlan to canonical for representative inputs", around line 743)** — this test dynamic-imports the renderer copy and compares the output ExportPlan object against the core output for representative inputs. It does NOT pattern-match source text; it compares emit-time output. This test should pass without modification IF plan 01 + task 1 of plan 02 land correctly — both files run the same algorithm on the same summary and emit identical ExportPlan objects. **DO NOT modify this test.** If it fails after this task, that's a real divergence between the two files — fix the divergence in task 1, not in this test.

6. **The hygiene block tests (lines 624-648)** — verify Layer 3 hygiene (no node:fs, no sharp, no electron, no DOM). These are unaffected by the migration and should pass unchanged.
  </action>
  <verify>
    <automated>
      cd /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager &&
      grep -c "applyOverride\\\\(overridePct,\\\\s\\*region\\\\.peakScale" tests/core/export.spec.ts &&
      npm test -- export.spec.ts 2>&1 | tail -40
    </automated>
  </verify>
  <acceptance_criteria>
    - `grep -c 'region\\.peakScale' tests/core/export.spec.ts` is greater than 0 in the parity describe block (the regex literal was updated)
    - `grep "row\\.peakScale" tests/core/export.spec.ts` returns 0 matches in the parity-describe-block range (lines 665-741). It may still appear elsewhere in the test file — synthetic-row construction in case (a) etc. — those references are unrelated and stay.
    - `npm test -- export.spec.ts` exits 0 (all tests in the file pass, including the parity describe block and the runtime-equality "produces IDENTICAL ExportPlan" parity assertion)
    - `npm test -- atlas-preview.spec.ts` exits 0 (atlas-preview consumes the renderer's buildExportPlan; both copies now emit one input per region; per-region collapse assertions at lines 476+ still pass because single-skin SIMPLE_PROJECT has regions.length === peaks.length and contributingAttachments.length === 1 per region)
    - Full test-suite: `npm test` exits 0
  </acceptance_criteria>
  <done>
    Parity regex `overrideSig` updated from `row.peakScale` to `region.peakScale` in lockstep with the source migration. All other parity regex patterns left untouched (they did not reference the loop variable). Full test suite passes.
  </done>
</task>

</tasks>

<verification>
End-of-wave checks:

- Lockstep parity: `diff <(sed -n '/^export function buildExportPlan/,/^}$/p' src/core/export.ts) <(sed -n '/^export function buildExportPlan/,/^}$/p' src/renderer/src/lib/export-view.ts)` shows only documented permitted differences (parity-reminder comments, blank lines).
- Layer 3: `grep -E "from ['\"][^'\"]*\/core\/" src/renderer/src/lib/export-view.ts` returns 0 matches.
- All tests pass: `npm test`.
</verification>

<success_criteria>
- src/renderer/src/lib/export-view.ts:buildExportPlan iterates summary.regions byte-identically with the core copy
- Parity describe block in tests/core/export.spec.ts passes (regex updated in lockstep)
- Runtime-equality parity test ("produces IDENTICAL ExportPlan to canonical") passes — both file copies emit identical output on representative inputs
- Layer 3 invariant preserved (renderer imports zero src/core/* symbols)
- `computeExportDims` (renderer-only export helper) is untouched
</success_criteria>

<output>
After completion, create `.planning/phases/35-region-keyed-export-plan/35-02-SUMMARY.md`
</output>

---
phase: 21
plan: 12
type: execute
wave: 1
depends_on: []
files_modified:
  - src/main/project-io.ts
  - src/main/sampler-worker.ts
  - tests/core/loader-atlas-less.spec.ts
  - tests/main/project-io.spec.ts
  - tests/main/sampler-worker.spec.ts
autonomous: true
requirements: [LOAD-01]
gap_closure: true
gap_closure_for: [G-04]
tags: [project-io, sampler-worker, loader-options, precedence, gap-closure, G-04, atlas-less, toggle-resample]

must_haves:
  truths:
    - "When the IPC layer (project-io.ts or sampler-worker.ts) builds `LoaderOptions` for `loadSkeleton`, the caller-side precedence rule is: if `loaderMode === 'atlas-less'`, set ONLY `loaderMode: 'atlas-less'` and OMIT `atlasPath` entirely — even if a canonical `atlasPath` is available from prior state. This routes the loader through D-08 synthesis (which produces `synth.missingPngs`) instead of D-06 explicit-atlasPath (which never produces `skippedAttachments`)."
    - "The loader's documented branch order at src/core/loader.ts:219-254 is UNCHANGED: D-06 (explicit `opts.atlasPath !== undefined`) still wins when set, preserving ROADMAP success criterion #5 (verbatim AtlasNotFoundError on explicit-atlasPath fail). The fix lives entirely on the caller side."
    - "Site 1 — handleProjectOpenFromPath (project-io.ts:407-409): when `materialized.loaderMode === 'atlas-less'`, set `loaderOpts.loaderMode = 'atlas-less'` and DO NOT set `loaderOpts.atlasPath` (even when `materialized.atlasPath !== null`)."
    - "Site 3 — handleProjectReloadWithSkeleton (project-io.ts:683-684): already correct shape (atlasPath was already intentionally omitted there per F1.2 sibling-discovery). Plan 21-12 audits this site, documents that the precedence-safe pattern is already present, and adds a comment cross-referencing the new convention. NO behavior change required at Site 3."
    - "Site 4 — handleProjectResample (project-io.ts:874-876): the empirically-pinned root-cause site. When `a.loaderMode === 'atlas-less'`, set `loaderOpts.loaderMode = 'atlas-less'` and DO NOT set `loaderOpts.atlasPath` (even when the IPC payload carries `atlasPath` from prior canonical state)."
    - "Site 5 — sampler-worker.ts runSamplerJob (lines 107-109): the worker-side `loadSkeleton` call has the SAME precedence ambiguity. When `params.loaderMode === 'atlas-less'`, set `loaderOpts.loaderMode = 'atlas-less'` and DO NOT set `loaderOpts.atlasPath` (even when `params.atlasRoot` is non-empty)."
    - "Falsifying regression test exists at the loader API surface: `loadSkeleton(skeletonPath, { atlasPath: '<canonical-with-MESH_REGION>', loaderMode: 'atlas-less' })` against a tmp fixture with a synthesized `.atlas` containing `MESH_REGION` (stub-region bounds 0,0,1,1) — asserts that the loader's CURRENT behavior returns the canonical-mode result (atlasPath !== null, no skippedAttachments). The synthesized atlas guarantees D-06 SUCCEEDS so the assertion is reachable. This documents the loader contract: explicit `atlasPath` wins, callers MUST clear it when forcing atlas-less. (This is the contract test, not a behavior-change test.)"
    - "Falsifying regression test at the IPC handler surface: `handleProjectResample` invoked with a payload carrying BOTH `atlasPath` (synthesized with `MESH_REGION` so D-06 succeeds pre-fix) AND `loaderMode: 'atlas-less'` against a tmpdir where the PNG is missing — asserts that POST-FIX `result.project.summary.skippedAttachments` contains the missing entry (PRE-FIX this would be `[]` because D-06 wins and synthesis never runs). The load-bearing falsifying property IS `skippedAttachments.length === 1`, NOT `result.ok === true` — both pre-fix and post-fix have ok:true."
    - "Falsifying regression test at the worker boundary: `runSamplerJob({ skeletonPath, atlasRoot: <synthesized-atlas-WITHOUT-MESH_REGION>, loaderMode: 'atlas-less' })` — pre-fix the stock AtlasAttachmentLoader at the D-06 branch throws \"Region not found in atlas: MESH_REGION ...\" → `runSamplerJob` returns `{type:'error', ...}`. Post-fix the D-08 synthesis branch runs and load succeeds → `{type:'complete', ...}`. The load-bearing falsifying property IS `result.type === 'complete'`."
    - "After the fix, both the cold-load atlas-less path (Plan 21-09 Test 6) AND the toggle-resample atlas-less path produce the same `summary.skippedAttachments` shape for the same fixture-with-missing-PNG state. Path symmetry is restored."
    - "ROADMAP success criterion #5 (verbatim AtlasNotFoundError) is unchanged: when `loaderMode !== 'atlas-less'` and `atlasPath` is explicitly set but unreadable, AtlasNotFoundError still fires. The new caller-side rule only redirects the path when `loaderMode === 'atlas-less'` is explicitly set."
    - "No source-code changes to src/core/loader.ts (the loader's branch order is documented contract; the bug is caller-side). Only project-io.ts + sampler-worker.ts + tests change."
  artifacts:
    - path: "src/main/project-io.ts"
      provides: "Caller-side precedence fix at Site 1 (handleProjectOpenFromPath ~line 407-409) + Site 4 (handleProjectResample ~line 874-876); Site 3 audit comment"
      contains: "loaderMode === 'atlas-less'"
    - path: "src/main/sampler-worker.ts"
      provides: "Caller-side precedence fix at Site 5 (runSamplerJob ~line 107-109)"
      contains: "loaderMode === 'atlas-less'"
    - path: "tests/core/loader-atlas-less.spec.ts"
      provides: "G-04 Test 7 — loader-API contract test: explicit atlasPath + loaderMode:'atlas-less' simultaneously → loader takes D-06 branch (caller bug, not loader bug). Documents the contract callers must follow. Synthesizes inline tmp .atlas with MESH_REGION stub-region so D-06 succeeds (no Region-not-found throw)."
      contains: "G-04"
    - path: "tests/main/project-io.spec.ts"
      provides: "G-04 IPC integration test — handleProjectResample with both atlasPath + loaderMode:'atlas-less' produces result.project.summary.skippedAttachments populated post-fix. Uses synthesized tmp .atlas containing MESH_REGION to make D-06 read SUCCEED pre-fix (proving the load-bearing assertion is on .length === 1, not on ok === true)."
      contains: "G-04"
    - path: "tests/main/sampler-worker.spec.ts"
      provides: "G-04 worker-boundary falsifier — runSamplerJob with both atlasRoot + loaderMode:'atlas-less' against a tmp .atlas WITHOUT MESH_REGION. Pre-fix the stock AtlasAttachmentLoader at D-06 throws Region-not-found → runSamplerJob returns error. Post-fix D-08 synthesis succeeds → returns complete. Falsifying property: result.type === 'complete'."
      contains: "G-04"
  key_links:
    - from: "src/main/project-io.ts:874-876 (Site 4 handleProjectResample loaderOpts construction)"
      to: "src/core/loader.ts:241 (D-08 atlas-less branch entry)"
      via: "When loaderMode === 'atlas-less', omit atlasPath from loaderOpts → loader branch order picks D-08 → synth.missingPngs flows → LoadResult.skippedAttachments populated → buildSummary cascade → MissingAttachmentsPanel surfaces missing PNG"
      pattern: "loaderMode === 'atlas-less'"
    - from: "src/main/sampler-worker.ts:107-109 (Site 5 runSamplerJob loaderOpts construction)"
      to: "src/core/loader.ts:241 (D-08 atlas-less branch entry)"
      via: "Same caller-side precedence rule applied at the worker boundary; worker-side loadSkeleton also threads atlasPath + loaderMode and must clear atlasPath when loaderMode is forced"
      pattern: "loaderMode === 'atlas-less'"
    - from: "src/main/project-io.ts:407-409 (Site 1 handleProjectOpenFromPath loaderOpts construction)"
      to: "src/core/loader.ts:241 (D-08 atlas-less branch entry)"
      via: "A persisted .stmproj with both atlasPath set AND loaderMode='atlas-less' would hit the same trap; pre-emptively fixed for parity"
      pattern: "loaderMode === 'atlas-less'"
---

<objective>
Close G-04 — the path-asymmetric bug surfaced in HUMAN-UAT Test 4b Path 2: when the user starts on a CANONICAL project (`.atlas` present), then toggles "Use Images Folder as Source" ON, the resample-into-atlas-less path does NOT detect missing PNGs. The cold-load atlas-less path (Plan 21-09 + 21-10) works correctly; the toggle-resample path is silently broken.

**Root cause (empirically pinned, no diagnostic needed):** caller-side precedence ambiguity between `LoaderOptions.atlasPath` and `LoaderOptions.loaderMode === 'atlas-less'`.

The loader's documented branch order at `src/core/loader.ts:219-254` is:

```ts
if (opts.atlasPath !== undefined) {        // D-06 — explicit atlasPath WINS
  // reads canonical .atlas; NEVER sets synthMissingPngs
} else if (opts.loaderMode === 'atlas-less') {   // D-08 — synthesize
  synthMissingPngs = synth.missingPngs;   // <-- the field needed for MissingAttachmentsPanel
}
```

The bug at the caller side (e.g. `src/main/project-io.ts:874-876` resample handler):

```ts
const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
if (atlasPath !== undefined) loaderOpts.atlasPath = atlasPath;        // ← from prior canonical state
if (a.loaderMode === 'atlas-less') loaderOpts.loaderMode = 'atlas-less';   // ← from toggle ON
```

When the user starts with a canonical project (`.atlas` present, `atlasPath` is the resolved path) and then toggles "Use Images Folder as Source" ON, the resample IPC payload carries BOTH fields. Both are passed to the loader. The loader's branch order picks D-06 (canonical atlas wins), NEVER reaches D-08 synthesis, NEVER produces `synthMissingPngs`. The MissingAttachmentsPanel never surfaces the missing PNG. The deleted attachment still appears in the Max Render Source list with stale dims (carried from canonical region metadata).

**Why caller-side fix (not loader-side branch reorder):**

1. Preserves loader's documented D-06 semantics ("explicit atlasPath always wins WHEN PRESENT") — Plan 21-06's contract.
2. Shifts the precedence decision to the caller, which is where it belongs semantically (the renderer/main knows the user just toggled the loaderMode override; the loader doesn't).
3. ROADMAP success criterion #5 (verbatim AtlasNotFoundError on explicit-atlasPath fail) is unchanged — that branch only fires when `loaderMode !== 'atlas-less'`.

**Sites affected (4):**

- **Site 1** — `src/main/project-io.ts:407-409` (handleProjectOpenFromPath). A `.stmproj` saved with both `atlasPath: "..."` and `loaderMode: "atlas-less"` would hit the same trap on Open. Fix pre-emptively.
- **Site 3** — `src/main/project-io.ts:683-684` (handleProjectReloadWithSkeleton). ALREADY shape-correct (atlasPath was already intentionally omitted per F1.2 sibling-discovery semantics). Plan 21-12 audits this site, adds a cross-reference comment to the new convention, and confirms no behavior change.
- **Site 4** — `src/main/project-io.ts:874-876` (handleProjectResample). The empirically-confirmed G-04 root-cause site.
- **Site 5** — `src/main/sampler-worker.ts:107-109` (runSamplerJob worker-side loadSkeleton call). Sites 2 + 5 in the original UAT analysis are the same site at the worker boundary; `atlasRoot` + `loaderMode` are both threaded through `RunSamplerJobParams` and the worker's local `loadSkeleton` call has the same precedence issue.

(Site 2 in the original UAT analysis referred to the open-path's worker spawn at project-io.ts:486-494; the worker spawn just threads `atlasRoot` + `loaderMode` to runSamplerInWorker — the worker's INSIDE `loadSkeleton` call is Site 5, which is where the fix lives. Site 2 itself doesn't need a separate change because the fix at Site 5 covers both spawn paths.)

**Why Path 1 (cold-load atlas-less) works correctly:** when there's no `.atlas` beside the JSON, `materialized.atlasPath` is `null` → `loaderOpts.atlasPath` is never set → D-08 branch is reached → `synthMissingPngs` flows through. The bug is invisible until canonical state coexists with the atlas-less override (toggle path).

**Fix pattern at every site that builds `loaderOpts`:**

```ts
if (loaderMode === 'atlas-less') {
  loaderOpts.loaderMode = 'atlas-less';
  // Don't set atlasPath — D-08 synthesizer must run to produce skippedAttachments.
} else if (atlasPath !== undefined) {
  loaderOpts.atlasPath = atlasPath;
}
```

**TDD discipline:** Mirror Plan 21-09 Test 6's empirical-falsification pattern. Three falsifying tests across the three caller-side surfaces:

1. **Loader-API contract test** at `tests/core/loader-atlas-less.spec.ts` (Test 7): loadSkeleton with both `atlasPath: <synthesized-with-MESH_REGION>` and `loaderMode: 'atlas-less'` — asserts the loader's D-06-wins behavior (`result.atlasPath !== null`, `result.skippedAttachments` empty). The synthesized atlas contains a `MESH_REGION` stub-region (bounds 0,0,1,1) so the D-06 read SUCCEEDS and the assertion is reachable. (Without `MESH_REGION` in the atlas the stock `AtlasAttachmentLoader` throws `"Region not found in atlas: MESH_REGION ..."` per `node_modules/@esotericsoftware/spine-core/dist/AtlasAttachmentLoader.js:50,62`.) This is the CONTRACT test, NOT a behavior-change test — it locks down the loader's documented semantics so future changes can't accidentally break callers that rely on D-06 winning.

2. **IPC integration falsifying test** at `tests/main/project-io.spec.ts` (new G-04 describe block): handleProjectResample with payload `{ atlasPath: <synthesized-with-MESH_REGION>, loaderMode: 'atlas-less', ...}` against a tmpdir where `MESH_REGION.png` is missing — pre-fix `result.project.summary.skippedAttachments` is empty (D-06 wins, synthesis never runs); post-fix it contains the missing entry. **Load-bearing falsifying property: `skippedAttachments.length === 1`, NOT `result.ok === true` — both pre-fix and post-fix have `ok:true`** (the synthesized atlas guarantees D-06 doesn't throw).

3. **Worker-boundary falsifying test** at `tests/main/sampler-worker.spec.ts` (new G-04 describe block): runSamplerJob with both `atlasRoot: <synthesized-atlas-WITHOUT-MESH_REGION>` AND `loaderMode: 'atlas-less'` — pre-fix the loader's D-06 branch reads the canonical atlas, then the stock `AtlasAttachmentLoader` throws `"Region not found in atlas: MESH_REGION ..."` (the JSON references MESH_REGION but the synthesized atlas only contains a placeholder) → `runSamplerJob` returns `{type:'error', ...}`. Post-fix the D-08 synthesis branch runs, synthesizes the region from the JSON's mesh data, and `runSamplerJob` returns `{type:'complete', ...}`. **Load-bearing falsifying property: `result.type === 'complete'`.** This proves Site 5's fix is exercised — the IPC test (Task 3) mocks `runSamplerInWorker` at the bridge boundary, which means `runSamplerJob` (where Site 5 lives) is never invoked in Task 3.

**Out of scope for this plan:**

- Test 4c (region-attachment PNG via toggle path) — UAT-marked as same root cause; closed by this fix automatically (region-attachment + missing-PNG already works in cold-load atlas-less per existing tests). The toggle-resample fix unblocks it.
- G-01/G-02 cold-load path — already verified passing.
- G-03 — already user-confirmed resolved.
- Loader-side branch reorder — explicitly rejected per the rationale above.

Output: ~15 LoC change across project-io.ts (Sites 1 + 4) + sampler-worker.ts (Site 5) + Site 3 audit comment, ~120 LoC of new tests across loader-atlas-less.spec.ts (Tests 7 + 8) + project-io.spec.ts (G-04 IPC) + sampler-worker.spec.ts (G-04 worker-boundary), zero source-code changes to src/core/loader.ts.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-CONTEXT.md
@.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-HUMAN-UAT.md
@.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-09-stub-region-for-missing-pngs-SUMMARY.md
@.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-10-missing-attachments-panel-SUMMARY.md
@CLAUDE.md

<interfaces>
<!-- Loader's documented 4-way branch (src/core/loader.ts:219-254): -->

```ts
let synthMissingPngs: string[] | null = null;

if (opts.atlasPath !== undefined) {
  // D-06: explicit user-provided atlasPath — try to read; throw verbatim
  // AtlasNotFoundError on fail. NO fall-through to synthesis.
  // -- This branch NEVER sets synthMissingPngs.
  resolvedAtlasPath = path.resolve(explicitAtlasPath);
  isAtlasLess = false;
} else if (opts.loaderMode === 'atlas-less') {
  // D-08: per-project override forces atlas-less even if .atlas exists.
  const synth = synthesizeAtlasText(parsedJson, dirOfImages, skeletonPath);
  synthSourcePaths = synth.pngPathsByRegionName;
  synthDims = synth.dimsByRegionName;
  synthMissingPngs = synth.missingPngs;  // ← Plan 21-09 G-01 — populated
  resolvedAtlasPath = null;
  isAtlasLess = true;
} else {
  // D-05/D-07 fall-through — try sibling .atlas, else synthesize.
  // synthMissingPngs is set in the D-05 sub-branch.
}
```

<!-- LoadResult.skippedAttachments construction at the return site (loader.ts ~395-410): -->

```ts
const skippedAttachments = synthMissingPngs && synthMissingPngs.length > 0
  ? synthMissingPngs.map(filename => ({
      name: path.basename(filename, '.png'),
      expectedPngPath: path.resolve(imagesDir, filename),
    }))
  : undefined;
```

<!-- Site 1 — handleProjectOpenFromPath (src/main/project-io.ts:405-410): -->

```ts
let load;
try {
  const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
  if (materialized.atlasPath !== null) loaderOpts.atlasPath = materialized.atlasPath;
  if (materialized.loaderMode === 'atlas-less') loaderOpts.loaderMode = 'atlas-less';
  load = loadSkeleton(materialized.skeletonPath, loaderOpts);
} catch (err) {
  // ... error envelope branches ...
}
```

<!-- Site 3 — handleProjectReloadWithSkeleton (src/main/project-io.ts:683-688): ALREADY shape-correct -->

```ts
const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
if (loaderMode === 'atlas-less') loaderOpts.loaderMode = 'atlas-less';
// atlasPath intentionally omitted: F1.2 sibling auto-discovery applies on
// the new skeleton's directory (D-152). loaderMode='atlas-less' override
// short-circuits sibling discovery in the loader (Plan 06).
load = loadSkeleton(a.newSkeletonPath, loaderOpts);
```

— No behavior change at Site 3; only a comment update cross-referencing the new convention.

<!-- Site 4 — handleProjectResample (src/main/project-io.ts:868-877): -->

```ts
const atlasPath = typeof a.atlasPath === 'string' ? a.atlasPath : undefined;

// Phase 21 D-08 — Site 4 (resample): thread loaderMode from the IPC
// payload so atlas-less projects survive the SettingsDialog resample.
let load;
try {
  const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
  if (atlasPath !== undefined) loaderOpts.atlasPath = atlasPath;
  if (a.loaderMode === 'atlas-less') loaderOpts.loaderMode = 'atlas-less';
  load = loadSkeleton(a.skeletonPath, loaderOpts);
} catch (err) {
```

<!-- Site 5 — sampler-worker.ts runSamplerJob (lines 105-110): -->

```ts
// Phase 21 D-08 — thread loaderMode through to the loader so atlas-less
// override survives the worker boundary.
const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
if (params.atlasRoot) loaderOpts.atlasPath = params.atlasRoot;
if (params.loaderMode) loaderOpts.loaderMode = params.loaderMode;
const load = loadSkeleton(params.skeletonPath, loaderOpts);
```

<!-- runSamplerJob signature (src/main/sampler-worker.ts:88-99): -->

```ts
export async function runSamplerJob(params: {
  skeletonPath: string;
  atlasRoot?: string;
  samplingHz: number;
  loaderMode?: 'auto' | 'atlas-less';
  onProgress: (percent: number) => void;
  isCancelled: () => boolean;
}): Promise<SamplerWorkerOutbound>;
```

<!-- IPC response shape (src/shared/types.ts:790-792): -->

```ts
export type OpenResponse =
  | { ok: true; project: MaterializedProject }   // ← .project, NOT .summary at top
  | { ok: false; error: SerializableError };

// MaterializedProject has the .summary field nested:
export interface MaterializedProject {
  summary: SkeletonSummary;
  // ... other fields
}
// → handleProjectResample's success arm returns the same shape.
// → Tests must read result.project.summary.skippedAttachments.
```

<!-- Stock AtlasAttachmentLoader throw on missing region
     (node_modules/@esotericsoftware/spine-core/dist/AtlasAttachmentLoader.js:50,62):

  newRegionAttachment / newMeshAttachment:
    let region = this.atlas.findRegion(path);
    if (!region) throw new Error("Region not found in atlas: " + path + " (...)");

  Plan 21-09's SilentSkipAttachmentLoader (loader.ts:357-410) is used ONLY
  in the D-08 atlas-less branch. The D-06 branch uses the STOCK
  AtlasAttachmentLoader, which THROWS on missing regions. Test fixtures
  paired with a canonical .atlas that LACKS the referenced region will
  fail with this throw before reaching any test assertions. -->

<!-- libgdx 4.2 stub-region grammar (the synthesizer uses this; tests can use
     it inline to build a tmp .atlas containing arbitrary regions): -->

```
<image>.png
size: 1,1
filter: Linear,Linear
<regionName>
bounds: 0,0,1,1
```

This is the minimal valid 4.2 atlas. The `<image>.png` reference is the
page-image header (the page PNG file does NOT need to exist on disk for
the math phase — Plan 21-09's D-08 synthesizer uses a stub TextureLoader
that doesn't decode the bytes). `bounds: x,y,w,h` declares the region.
`filter` line is REQUIRED by the libgdx 4.2 parser.

<!-- Test fixture (reused, no changes): fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/ -->

```
fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/
├── MeshOnly_TEST.json   (53 lines — minimal mesh-with-deform-timeline rig from Plan 21-09)
└── images/
    └── MESH_REGION.png  (637 bytes — happy-path PNG; tests delete from a tmpdir copy to exercise the missing-PNG path)
```

The JSON references a single mesh attachment named `MESH_REGION`. The
canonical `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` does NOT contain
`MESH_REGION` (only CIRCLE/SQUARE/TRIANGLE) — pairing them naively
triggers the stock loader's "Region not found in atlas" throw at the
D-06 branch. Tests that need D-06 to SUCCEED must synthesize an inline
tmp .atlas containing `MESH_REGION` (use the stub-region grammar above).

<!-- Pattern for tmpdir-copy + missing-PNG test (mirrors loader-atlas-less.spec.ts Test 6): -->

```ts
const SRC_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-aless-g04-'));
const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
const tmpImages = path.join(tmpDir, 'images');
fs.mkdirSync(tmpImages, { recursive: true });
fs.copyFileSync(path.join(SRC_FIXTURE, 'MeshOnly_TEST.json'), tmpJson);
// Intentionally do NOT copy MESH_REGION.png — that's the missing-PNG case.

// To make D-06 SUCCEED for the contract / IPC tests, synthesize a tmp .atlas
// containing MESH_REGION with stub-region bounds:
const tmpAtlas = path.join(tmpDir, 'canonical.atlas');
const atlasText =
  'tmp_page.png\n' +
  'size: 1,1\n' +
  'filter: Linear,Linear\n' +
  'MESH_REGION\n' +
  'bounds: 0,0,1,1\n';
fs.writeFileSync(tmpAtlas, atlasText, 'utf8');
```

<!-- For the IPC test mocking: project-io.spec.ts uses heavy electron + recent + index mocks  -->
<!-- (lines 22-54). The G-04 test must reuse those mocks, but ALSO use real fs/os for the      -->
<!-- tmpdir (the existing project-io.spec.ts uses mocked node:fs/promises but does NOT mock    -->
<!-- node:fs sync — the loader uses sync fs, so it works against real tmpdirs in the same     -->
<!-- spec file). Verify: see existing project-io.spec.ts line 162 patterns where tests copy   -->
<!-- real JSON to mocked-write paths but read real fs for setup. Pattern is established.      -->

<!-- BrowserWindow electron mock — handleProjectResample calls
     `BrowserWindow.getAllWindows()[0]?.webContents ?? null` at
     project-io.ts:937. The existing electron mock at project-io.spec.ts:22-32
     ONLY provides `getFocusedWindow`. The G-04 IPC test's electron mock
     MUST be extended to include `getAllWindows: vi.fn(() => [])` or the
     mock will throw on the .getAllWindows() call. -->

<!-- runSamplerInWorker mock — for the IPC integration test, runSamplerInWorker is mocked
     so the IPC test does not spawn a real worker. The mock module path is
     `'../../src/main/sampler-worker-bridge.js'` (verified via
     `grep -n runSamplerInWorker src/main/project-io.ts` → import from
     `./sampler-worker-bridge.js` at line 60). Mock returns
     `{ type: 'complete', output: <synthesized SamplerOutputShape with empty Maps> }`.
     buildSummary then runs in-process and produces a real SkeletonSummary.

     IMPORTANT: mocking `runSamplerInWorker` at the IPC layer means
     `runSamplerJob` (where Site 5 lives) is NEVER invoked by the IPC test.
     A separate Task 4 falsifier in `tests/main/sampler-worker.spec.ts`
     directly invokes `runSamplerJob` to lock the Site 5 fix. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — falsifying contract test at the loader API surface (Test 7 + Test 8 in loader-atlas-less.spec.ts)</name>
  <files>tests/core/loader-atlas-less.spec.ts</files>
  <read_first>
    - tests/core/loader-atlas-less.spec.ts (full file — Test 6 G-01 falsifying-regression pattern at lines 177-239 is the model)
    - src/core/loader.ts:219-254 (the documented 4-way branch order)
    - .planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-09-stub-region-for-missing-pngs-SUMMARY.md (commit shape: test(...) RED before feat(...) GREEN; --no-verify per parallel-executor protocol)
    - fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/ (the G-01 fixture; reused for G-04)
    - node_modules/@esotericsoftware/spine-core/dist/AtlasAttachmentLoader.js:50,62 (confirms stock loader THROWS on missing region — drives the synthesized-atlas requirement)
  </read_first>
  <behavior>
    - Test 7 in `tests/core/loader-atlas-less.spec.ts` documents the CALLER CONTRACT — when callers pass BOTH explicit `atlasPath` AND `loaderMode: 'atlas-less'`, the loader picks D-06 (atlasPath wins) per the documented branch order. This is NOT a behavior-change test; it locks down the loader contract so callers (project-io.ts, sampler-worker.ts) know they MUST clear atlasPath when forcing atlas-less.
    - Test asserts: with both options set, `result.atlasPath !== null` (D-06 took the canonical path), `result.skippedAttachments` is undefined or empty (D-06 never sets synthMissingPngs).
    - **CRITICAL:** the canonical `.atlas` MUST contain `MESH_REGION` or the stock `AtlasAttachmentLoader` (D-06 branch path) THROWS `"Region not found in atlas: MESH_REGION (mesh attachment: MESH_REGION)"` per `node_modules/@esotericsoftware/spine-core/dist/AtlasAttachmentLoader.js:50,62`, and the assertions are never reached. The test must SYNTHESIZE a tmp `.atlas` containing `MESH_REGION` with stub-region bounds (0,0,1,1) using the libgdx 4.2 grammar — DO NOT copy `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` (which only contains CIRCLE/SQUARE/TRIANGLE).
    - This test is GREEN on first run (it documents existing behavior). The test exists so a future refactor of loader.ts that accidentally inverts the branch order will FAIL this test, surfacing the breakage immediately.
    - Pair this with a sibling Test 8 that exercises the FIX SHAPE: when callers correctly pass ONLY `loaderMode: 'atlas-less'` (and NOT `atlasPath`), the synthesis path runs and `result.skippedAttachments` is populated for the missing PNG. This test is the GREEN-state assertion of the post-fix caller behavior.
  </behavior>
  <action>
**Step A — Read the existing Test 6 G-01 falsifying pattern at tests/core/loader-atlas-less.spec.ts:177-239** to mirror imports, fixture-copy idiom, tmpdir cleanup pattern.

**Step B — Append Test 7 (loader contract test) and Test 8 (caller-correct shape test) inside the existing `describe('Phase 21 atlas-less round-trip (LOAD-01 + LOAD-04)', ...)` block, AFTER Test 6 (the G-01 test).**

Test 7 (loader contract test — documents D-06-wins behavior; uses synthesized atlas containing MESH_REGION so D-06 succeeds):

```ts
it('G-04 caller-contract: explicit atlasPath WINS over loaderMode:"atlas-less" (loader D-06 branch — callers must clear atlasPath when forcing atlas-less)', () => {
  // Documents the loader's documented branch order at src/core/loader.ts:219-254:
  // when both opts.atlasPath and opts.loaderMode === 'atlas-less' are set, D-06
  // wins (atlasPath is read; synthesis is NEVER reached). This is the loader
  // contract; the bug is on the caller side (project-io.ts / sampler-worker.ts).
  // This test locks the contract — a future refactor that accidentally inverts
  // the branch order will FAIL this test, surfacing the regression.
  //
  // The HUMAN-UAT G-04 reproducer hits this contract from the wrong side: the
  // resample IPC handler in project-io.ts:874-876 sets BOTH options, expecting
  // atlas-less synthesis, but gets D-06 canonical-mode behavior. Plan 21-12 fixes
  // the caller-side build of loaderOpts (Sites 1, 4, 5).
  //
  // ATLAS SYNTHESIS: D-06 hands MESH_REGION to the stock AtlasAttachmentLoader
  // (loader.ts:352, NOT SilentSkip). If the .atlas lacks MESH_REGION the stock
  // loader throws "Region not found in atlas: MESH_REGION (mesh attachment:
  // MESH_REGION)" per AtlasAttachmentLoader.js:62. We synthesize a tmp .atlas
  // containing MESH_REGION with stub-region bounds so the D-06 read SUCCEEDS
  // and the assertion shape is reachable.
  const SRC_NO_ATLAS_MESH = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-aless-g04-contract-'));
  const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
  const tmpAtlas = path.join(tmpDir, 'canonical.atlas');
  const tmpImages = path.join(tmpDir, 'images');
  fs.mkdirSync(tmpImages, { recursive: true });
  fs.copyFileSync(path.join(SRC_NO_ATLAS_MESH, 'MeshOnly_TEST.json'), tmpJson);
  // Synthesize a tmp .atlas containing MESH_REGION (libgdx 4.2 grammar):
  fs.writeFileSync(
    tmpAtlas,
    'tmp_page.png\n' +
    'size: 1,1\n' +
    'filter: Linear,Linear\n' +
    'MESH_REGION\n' +
    'bounds: 0,0,1,1\n',
    'utf8',
  );
  // Intentionally do NOT copy MESH_REGION.png — the missing-PNG case.
  try {
    // Caller passes BOTH options — the toggle-resample IPC payload shape pre-fix.
    const result = loadSkeleton(tmpJson, {
      atlasPath: tmpAtlas,
      loaderMode: 'atlas-less',
    });
    // D-06 wins: atlasPath is resolved (canonical mode), synthesis never runs.
    expect(result.atlasPath).not.toBeNull();
    expect(result.atlasPath).toBe(path.resolve(tmpAtlas));
    // skippedAttachments is undefined or empty — D-06 branch doesn't set it.
    expect(result.skippedAttachments ?? []).toEqual([]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

it('G-04 caller-correct: loaderMode:"atlas-less" with atlasPath OMITTED routes to D-08 synthesis and surfaces missing PNG via skippedAttachments', () => {
  // Documents the POST-FIX caller behavior: project-io.ts / sampler-worker.ts
  // build loaderOpts WITHOUT atlasPath when loaderMode === 'atlas-less', so the
  // loader's D-08 synthesis branch runs, synth.missingPngs is populated, and
  // LoadResult.skippedAttachments cascades through. Mirror of cold-load Test 6
  // (G-01) but explicitly via the loaderMode override (the toggle-resample
  // shape, post-fix).
  const SRC_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-aless-g04-correct-'));
  const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
  const tmpImages = path.join(tmpDir, 'images');
  fs.mkdirSync(tmpImages, { recursive: true });
  fs.copyFileSync(path.join(SRC_FIXTURE, 'MeshOnly_TEST.json'), tmpJson);
  // Intentionally do NOT copy MESH_REGION.png — the missing-PNG case.
  try {
    // Post-fix caller shape: loaderMode set, atlasPath OMITTED (even if available).
    const result = loadSkeleton(tmpJson, { loaderMode: 'atlas-less' });
    expect(result.atlasPath).toBeNull();
    expect(result.skippedAttachments).toBeDefined();
    expect(result.skippedAttachments!.length).toBe(1);
    expect(result.skippedAttachments![0].name).toBe('MESH_REGION');
    expect(
      result.skippedAttachments![0].expectedPngPath.endsWith(
        path.join('images', 'MESH_REGION.png'),
      ),
    ).toBe(true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
```

**Step C — Run the new tests; confirm both PASS on first run** (Test 7 documents existing behavior with synthesized atlas; Test 8 exercises the working cold-load atlas-less path that already works per Plan 21-09):

```bash
npx vitest run tests/core/loader-atlas-less.spec.ts -t "G-04"
```

Expected: 2 tests pass. (These are GREEN on first run because they document the existing loader contract + the existing cold-load atlas-less working path. The behavior-change tests are at the IPC handler surface in Task 3 + the worker boundary in Task 4.)

**Step D — Commit with `--no-verify` per parallel-executor protocol:**

```bash
git add tests/core/loader-atlas-less.spec.ts
git commit --no-verify -m "test(21-12): add G-04 loader-contract tests (D-06-wins + caller-correct shape)"
```

**Note on TDD framing:** Tests 7 and 8 are GREEN on first run. The actual RED → GREEN cycle for the BUG FIX is at the IPC layer (Task 3) and the worker boundary (Task 4), not the loader layer (the loader is correct as-is). Task 2 is the GREEN fix. This task's purpose is to LOCK THE CALLER CONTRACT in tests so future loader changes can't silently break the caller-side rule.
  </action>
  <verify>
    <automated>npx vitest run tests/core/loader-atlas-less.spec.ts -t "G-04"</automated>
  </verify>
  <acceptance_criteria>
    - Test 7 + Test 8 added to tests/core/loader-atlas-less.spec.ts inside the existing describe block, after Test 6 (G-01).
    - Both tests use the `'G-04'` literal in their `it(...)` description so the `-t "G-04"` filter selects them.
    - `grep -c "G-04" tests/core/loader-atlas-less.spec.ts` returns 2 or more.
    - Test 7 SYNTHESIZES a tmp `.atlas` containing `MESH_REGION` (does NOT copy `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas`): `grep -q "MESH_REGION\\\\nbounds: 0,0,1,1" tests/core/loader-atlas-less.spec.ts` (note: literal-grep on the multi-line atlas text — the test's atlas-text concatenation contains `'MESH_REGION\n' + 'bounds: 0,0,1,1\n'`). Equivalent: `grep -c "tmp_page.png\\|filter: Linear,Linear\\|MESH_REGION$\\|bounds: 0,0,1,1" tests/core/loader-atlas-less.spec.ts` returns ≥3.
    - Test 7 asserts D-06-wins shape: `grep -q "result.atlasPath).not.toBeNull" tests/core/loader-atlas-less.spec.ts` AND `grep -q "result.skippedAttachments ?? \\[\\]).toEqual(\\[\\])" tests/core/loader-atlas-less.spec.ts`.
    - Test 8 asserts D-08 synthesis shape: `result.atlasPath` is null + `result.skippedAttachments[0].name === 'MESH_REGION'` when ONLY loaderMode is set.
    - Both tests pass on first run: `npx vitest run tests/core/loader-atlas-less.spec.ts -t "G-04"` shows 2 passing.
    - Existing 6 tests in the file still pass: `npx vitest run tests/core/loader-atlas-less.spec.ts` shows 8/8 passing.
    - Commit with --no-verify and message starting `test(21-12):`.
    - Reuse Plan 21-09's fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/ — no new fixtures: `test ! -d fixtures/SIMPLE_PROJECT_NO_ATLAS_TOGGLE` (do NOT create a sibling fixture).
    - Test 7 does NOT reference `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas`: `grep -c "SIMPLE_PROJECT/SIMPLE_TEST.atlas" tests/core/loader-atlas-less.spec.ts` should be 0 in the G-04 region (search inside the G-04 describe block).
  </acceptance_criteria>
  <done>2 G-04 contract tests added; both pass on first run (documenting existing loader contract); Test 7 uses synthesized inline atlas containing MESH_REGION (NOT a copy of SIMPLE_TEST.atlas); existing tests unaffected; committed with test(21-12) prefix.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — apply caller-side precedence fix at Sites 1, 4 (project-io.ts) + Site 5 (sampler-worker.ts) + Site 3 audit comment</name>
  <files>src/main/project-io.ts, src/main/sampler-worker.ts</files>
  <read_first>
    - src/main/project-io.ts (lines 405-410 = Site 1 handleProjectOpenFromPath; lines 683-688 = Site 3 handleProjectReloadWithSkeleton; lines 868-877 = Site 4 handleProjectResample)
    - src/main/sampler-worker.ts (lines 105-110 = Site 5 runSamplerJob)
    - src/core/loader.ts:219-254 (the documented 4-way branch order — confirms D-06 wins when both options set)
    - tests/core/loader-atlas-less.spec.ts G-04 tests (Task 1) — the contract Tests 7 + 8 lock down the rule the fix follows
  </read_first>
  <behavior>
    - **Site 1 (handleProjectOpenFromPath, project-io.ts:407-409):** when `materialized.loaderMode === 'atlas-less'`, set `loaderOpts.loaderMode = 'atlas-less'` and DO NOT set `loaderOpts.atlasPath`. Otherwise (canonical mode), set `loaderOpts.atlasPath` from `materialized.atlasPath` if non-null.
    - **Site 3 (handleProjectReloadWithSkeleton, project-io.ts:683-688):** ALREADY shape-correct. Add a 1-2 line comment cross-referencing the new convention with `// Plan 21-12 G-04 — caller-side precedence: when loaderMode === 'atlas-less', atlasPath MUST be omitted so the loader's D-08 synthesis runs (produces synth.missingPngs → LoadResult.skippedAttachments).` so future maintainers see the same convention applied at all sites.
    - **Site 4 (handleProjectResample, project-io.ts:874-876):** mirror Site 1's fix — `if (a.loaderMode === 'atlas-less') { loaderOpts.loaderMode = 'atlas-less'; } else if (atlasPath !== undefined) { loaderOpts.atlasPath = atlasPath; }`. Add a comment block referencing Plan 21-12 G-04 + the empirical UAT-pinned root cause.
    - **Site 5 (runSamplerJob, sampler-worker.ts:107-109):** mirror Site 1's fix — `if (params.loaderMode === 'atlas-less') { loaderOpts.loaderMode = 'atlas-less'; } else if (params.atlasRoot) { loaderOpts.atlasPath = params.atlasRoot; }`. Add a comment block referencing Plan 21-12 G-04.
    - **Critical: do NOT modify src/core/loader.ts.** The loader's branch order is the documented contract; the bug is caller-side.
    - **Critical: ROADMAP success criterion #5 unchanged.** The fix only redirects the build of `loaderOpts` when `loaderMode === 'atlas-less'`. When loaderMode is 'auto' (default) and atlasPath is explicitly set unreadable, AtlasNotFoundError still fires verbatim.
    - All existing tests stay GREEN (this is a refactor of caller logic that preserves canonical-mode behavior).
    - The Task 1 contract tests stay GREEN (the loader contract is unchanged).
  </behavior>
  <action>
**Step A — Apply Site 1 fix (handleProjectOpenFromPath, project-io.ts ~line 407-409):**

Before:
```ts
const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
if (materialized.atlasPath !== null) loaderOpts.atlasPath = materialized.atlasPath;
if (materialized.loaderMode === 'atlas-less') loaderOpts.loaderMode = 'atlas-less';
```

After:
```ts
// Plan 21-12 G-04 — caller-side precedence: when loaderMode === 'atlas-less',
// the loader's D-08 synthesis branch must run (produces synth.missingPngs →
// LoadResult.skippedAttachments → MissingAttachmentsPanel). The loader's
// branch order at src/core/loader.ts:219-254 picks D-06 (explicit atlasPath
// wins) when both options are set, which never reaches synthesis. Callers
// MUST clear atlasPath when forcing atlas-less mode.
const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
if (materialized.loaderMode === 'atlas-less') {
  loaderOpts.loaderMode = 'atlas-less';
  // atlasPath intentionally OMITTED — D-08 synthesis must run.
} else if (materialized.atlasPath !== null) {
  loaderOpts.atlasPath = materialized.atlasPath;
}
```

**Step B — Apply Site 3 audit comment (handleProjectReloadWithSkeleton, project-io.ts ~line 683-688):**

The existing code is already correct (atlasPath was always omitted here per F1.2 sibling-discovery). Add a 2-line cross-reference comment INSIDE the existing comment block, BEFORE the `const loaderOpts ...` line:

Before:
```ts
// Phase 21 D-08 — Site 3 (recovery): thread loaderMode from the
// renderer-supplied recovery payload (the renderer's useState slot is
// the source of truth here; the main process discarded the original
// materialized state when the prior Open failed, so threading via args
// is the only option).
const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
if (loaderMode === 'atlas-less') loaderOpts.loaderMode = 'atlas-less';
// atlasPath intentionally omitted: F1.2 sibling auto-discovery applies on
// the new skeleton's directory (D-152). loaderMode='atlas-less' override
// short-circuits sibling discovery in the loader (Plan 06).
load = loadSkeleton(a.newSkeletonPath, loaderOpts);
```

After:
```ts
// Phase 21 D-08 — Site 3 (recovery): thread loaderMode from the
// renderer-supplied recovery payload (the renderer's useState slot is
// the source of truth here; the main process discarded the original
// materialized state when the prior Open failed, so threading via args
// is the only option).
//
// Plan 21-12 G-04 — caller-side precedence (already shape-correct here):
// atlasPath was always omitted at this site per the F1.2 sibling-discovery
// semantic, so the loader's D-08 synthesis branch is reached when
// loaderMode === 'atlas-less'. This site needs no behavior change; Sites
// 1, 4, 5 received the matching fix in the same commit.
const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
if (loaderMode === 'atlas-less') loaderOpts.loaderMode = 'atlas-less';
// atlasPath intentionally omitted: F1.2 sibling auto-discovery applies on
// the new skeleton's directory (D-152). loaderMode='atlas-less' override
// short-circuits sibling discovery in the loader (Plan 06).
load = loadSkeleton(a.newSkeletonPath, loaderOpts);
```

**Step C — Apply Site 4 fix (handleProjectResample, project-io.ts ~line 874-876) — the empirically-pinned G-04 root-cause site:**

Before:
```ts
// Phase 21 D-08 — Site 4 (resample): thread loaderMode from the IPC
// payload so atlas-less projects survive the SettingsDialog resample.
let load;
try {
  const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
  if (atlasPath !== undefined) loaderOpts.atlasPath = atlasPath;
  if (a.loaderMode === 'atlas-less') loaderOpts.loaderMode = 'atlas-less';
  load = loadSkeleton(a.skeletonPath, loaderOpts);
}
```

After:
```ts
// Phase 21 D-08 — Site 4 (resample): thread loaderMode from the IPC
// payload so atlas-less projects survive the SettingsDialog resample.
//
// Plan 21-12 G-04 — caller-side precedence fix. Empirically-pinned root
// cause: when the user starts on a canonical project (.atlas present)
// then toggles "Use Images Folder as Source" ON, the resample IPC
// payload carries BOTH atlasPath (from prior canonical state) AND
// loaderMode='atlas-less'. The loader's branch order picks D-06
// (atlasPath wins), never reaches D-08 synthesis, never produces
// synth.missingPngs. The MissingAttachmentsPanel then never surfaces the
// missing PNG. Fix: when loaderMode='atlas-less', omit atlasPath so the
// loader takes the D-08 branch.
let load;
try {
  const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
  if (a.loaderMode === 'atlas-less') {
    loaderOpts.loaderMode = 'atlas-less';
    // atlasPath intentionally OMITTED — D-08 synthesis must run.
  } else if (atlasPath !== undefined) {
    loaderOpts.atlasPath = atlasPath;
  }
  load = loadSkeleton(a.skeletonPath, loaderOpts);
}
```

**Step D — Apply Site 5 fix (sampler-worker.ts runSamplerJob ~line 105-110):**

Before:
```ts
// Phase 21 D-08 — thread loaderMode through to the loader so atlas-less
// override survives the worker boundary.
const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
if (params.atlasRoot) loaderOpts.atlasPath = params.atlasRoot;
if (params.loaderMode) loaderOpts.loaderMode = params.loaderMode;
const load = loadSkeleton(params.skeletonPath, loaderOpts);
```

After:
```ts
// Phase 21 D-08 — thread loaderMode through to the loader so atlas-less
// override survives the worker boundary.
//
// Plan 21-12 G-04 — caller-side precedence fix (worker-side mirror of
// project-io.ts Sites 1 + 4). When params.loaderMode === 'atlas-less',
// omit atlasPath so the loader's D-08 synthesis branch runs (produces
// synth.missingPngs → LoadResult.skippedAttachments). Otherwise, set
// atlasPath from params.atlasRoot for canonical-mode behavior.
const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
if (params.loaderMode === 'atlas-less') {
  loaderOpts.loaderMode = 'atlas-less';
  // atlasPath intentionally OMITTED — D-08 synthesis must run.
} else if (params.atlasRoot) {
  loaderOpts.atlasPath = params.atlasRoot;
}
const load = loadSkeleton(params.skeletonPath, loaderOpts);
```

**Step E — Run typecheck + full vitest:**

```bash
npm run typecheck
npm run test
```

Expected: typecheck zero new errors (only the pre-existing TS6133 warnings on AnimationBreakdownPanel.tsx + GlobalMaxRenderPanel.tsx per Plan 21-09/21-10 SUMMARYs); full vitest passes (was 624+ pre-plan; should be 626+ after Task 1 added 2 new tests).

The pre-existing fixtures/Girl absence failure (`tests/main/sampler-worker-girl.spec.ts`, D-21-WORKTREE-1 environmental) is expected and out of scope.

**Step F — Commit with `--no-verify`:**

```bash
git add src/main/project-io.ts src/main/sampler-worker.ts
git commit --no-verify -m "fix(21-12): caller-side precedence — clear atlasPath when loaderMode='atlas-less' (G-04)"
```
  </action>
  <verify>
    <automated>npm run typecheck 2>&1 | grep "error TS" | grep -v "AnimationBreakdownPanel.tsx\|GlobalMaxRenderPanel.tsx" | wc -l</automated>
  </verify>
  <acceptance_criteria>
    - Site 1 fix applied: `grep -A 2 "Plan 21-12 G-04 — caller-side precedence" src/main/project-io.ts | grep "loaderOpts.loaderMode = 'atlas-less'"` finds at least 1 match.
    - Site 4 fix applied: `grep -c "atlasPath intentionally OMITTED — D-08 synthesis must run" src/main/project-io.ts` returns 2 (one at Site 1, one at Site 4).
    - Site 5 fix applied: `grep -c "atlasPath intentionally OMITTED — D-08 synthesis must run" src/main/sampler-worker.ts` returns 1.
    - Site 3 audit comment present: `grep -q "Plan 21-12 G-04 — caller-side precedence (already shape-correct here)" src/main/project-io.ts`.
    - Loader untouched: `git diff --name-only HEAD~2 src/core/loader.ts | wc -l` returns 0.
    - All 4 sites use the same precedence pattern: `grep -c "if.*loaderMode === 'atlas-less'.*{$\|if.*loaderMode === .atlas-less..*) {" src/main/project-io.ts src/main/sampler-worker.ts | tail -1` indicates the canonical pattern is present at sites 1, 4 (project-io) + 5 (sampler-worker). Numerical grep is approximate — the qualitative check is that all 3 fix sites use the if-then-else-if shape with atlasPath in the else-if.
    - typecheck zero new errors (only pre-existing TS6133 warnings remain).
    - Full vitest still green (existing 624+ tests + the 2 new G-04 tests from Task 1 = 626+ passing).
    - Plan 21-09 Test 6 (G-01 cold-load) still passes: `npx vitest run tests/core/loader-atlas-less.spec.ts -t "G-01"` returns 1 passing.
    - Plan 21-10 G-02 cascade tests still pass: `npx vitest run tests/core/summary.spec.ts -t "G-02"` returns 3 passing.
    - ROADMAP success criterion #5 still locked: `npx vitest run tests/core/loader-atlas-less.spec.ts -t "Success criterion #5"` returns 1 passing.
    - Commit with --no-verify and message starting `fix(21-12):`.
  </acceptance_criteria>
  <done>Sites 1, 4 (project-io.ts) + Site 5 (sampler-worker.ts) apply the caller-side precedence fix; Site 3 has the audit comment; loader untouched; typecheck + full vitest green; all prior G-01 / G-02 / criterion-#5 tests still pass; committed with fix(21-12) prefix.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Falsifying G-04 IPC integration test — handleProjectResample with both atlasPath + loaderMode='atlas-less' produces summary.skippedAttachments</name>
  <files>tests/main/project-io.spec.ts</files>
  <read_first>
    - tests/main/project-io.spec.ts (full file — vi.mock setup at lines 22-63 + beforeEach at lines 65-72 + baseState at lines 74-88; the existing handleProjectOpenFromPath tests at lines 137-280 are the closest pattern). Note: existing electron mock at lines 22-32 only provides `getFocusedWindow`; the G-04 IPC test needs `getAllWindows` because handleProjectResample calls `BrowserWindow.getAllWindows()[0]?.webContents` at project-io.ts:937.
    - src/main/project-io.ts handleProjectResample (lines 836-1000) — to understand what shape the IPC payload must have + what runSamplerInWorker expects + the success arm shape `{ ok: true; project: MaterializedProject }`.
    - src/main/sampler-worker-bridge.ts (the runSamplerInWorker module — confirmed import path is `'./sampler-worker-bridge.js'` at project-io.ts:60, so the vi.mock module path is `'../../src/main/sampler-worker-bridge.js'`).
    - src/shared/types.ts:790-792 (`OpenResponse = { ok: true; project: MaterializedProject } | { ok: false; ... }`) and lines 766-784 (`MaterializedProject.summary: SkeletonSummary`). The test asserts `result.project.summary.skippedAttachments`, NOT `result.summary.skippedAttachments`.
    - tests/core/summary.spec.ts G-02 tests at lines 207-249 — the tmpdir + real-fs + loadSkeleton pattern that exercises the full pipeline.
    - .planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-09-stub-region-for-missing-pngs-SUMMARY.md (the fixture-copy + missing-PNG idiom).
    - node_modules/@esotericsoftware/spine-core/dist/AtlasAttachmentLoader.js:50,62 — the stock loader THROWS on missing region. This drives the synthesized-atlas requirement (must contain MESH_REGION).
  </read_first>
  <behavior>
    - New describe block `'Phase 21 G-04 — toggle-resample-into-atlas-less precedence (handleProjectResample)'` in tests/main/project-io.spec.ts.
    - One test: `'handleProjectResample with both atlasPath + loaderMode:"atlas-less" produces summary.skippedAttachments populated for missing PNG (post-fix; pre-fix this fails — D-06 wins, synthesis never runs)'`.
    - Test setup:
      1. Create tmpdir.
      2. Copy `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json` → `tmpDir/MeshOnly_TEST.json`.
      3. Create `tmpDir/images/` (empty — DO NOT copy MESH_REGION.png; missing-PNG case).
      4. **SYNTHESIZE** `tmpDir/canonical.atlas` containing `MESH_REGION` with stub-region bounds (libgdx 4.2 grammar). DO NOT copy `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` (it lacks MESH_REGION; would trigger stock-loader throw at the D-06 read pre-fix and the test would fail for the wrong reason). The synthesized atlas guarantees D-06 SUCCEEDS → `result.ok === true` both pre-fix and post-fix → the LOAD-BEARING falsifying property IS `result.project.summary.skippedAttachments.length === 1` (NOT `result.ok === true`).
    - **runSamplerInWorker mocking:** `vi.mock('../../src/main/sampler-worker-bridge.js', ...)`. Mock returns `{ type: 'complete', output: <synthesized SamplerOutputShape with empty Maps> }`. The output shape needs `globalPeaks`, `perAnimation`, `setupPosePeaks` as Maps (can be empty Maps). buildSummary then runs in-process and produces a real SkeletonSummary.
    - **electron mock extension:** the existing mock at lines 22-32 must be extended with `getAllWindows: vi.fn(() => [])` so `BrowserWindow.getAllWindows()[0]?.webContents ?? null` (project-io.ts:937) resolves cleanly. (Without this, `getAllWindows` is undefined → `undefined()` throws TypeError before the test reaches its assertions.) Either edit the existing mock OR add the field via a per-test `vi.mocked(BrowserWindow).getAllWindows = vi.fn(() => [])` if the existing mock is shared by other tests that don't set this field.
    - Invoke `handleProjectResample({ skeletonPath: tmpJson, atlasPath: tmpAtlas, samplingHz: 120, overrides: {}, loaderMode: 'atlas-less' })`.
    - Assert: `result.ok === true` (sanity check — both pre-fix and post-fix have ok:true thanks to the synthesized atlas) AND `result.project.summary.skippedAttachments.length === 1` (the load-bearing falsifying assertion) AND `result.project.summary.skippedAttachments[0].name === 'MESH_REGION'` AND `result.project.summary.skippedAttachments[0].expectedPngPath.endsWith('images/MESH_REGION.png')`.
    - **Pre-fix behavior** (TDD RED): the test FAILS at `result.project.summary.skippedAttachments.length === 1` because handleProjectResample passes BOTH options to loadSkeleton, the loader takes D-06 (canonical mode reading tmpAtlas which contains MESH_REGION as a stub-region — read SUCCEEDS), result.atlasPath !== null, result.skippedAttachments is undefined → buildSummary's `load.skippedAttachments ?? []` → `summary.skippedAttachments = []`, the `.length === 1` assertion fails.
    - **Post-fix behavior** (TDD GREEN): handleProjectResample's new precedence rule omits atlasPath, loader takes D-08 synthesis, synth.missingPngs = ['MESH_REGION.png'], LoadResult.skippedAttachments populated, buildSummary cascades, summary.skippedAttachments has 1 entry, assertion passes.
    - **TDD discipline note:** This test is INTENDED to be RED-then-GREEN. Authoring order matters: this test is authored AFTER Task 2's GREEN fix (so it passes on commit), but the test SHAPE is designed to be falsifying — if a future regression accidentally restores the pre-fix shape at any of Sites 1, 4, 5, this test will fail and pinpoint G-04. The two ways this can be done:
      (a) **Strict RED-GREEN order** (preferred per parallel-executor protocol): re-order Tasks: Task 2 → revert in worktree → run this Task 3 RED → re-apply Task 2 GREEN. Heavy ceremony for a 4-line precedence fix.
      (b) **Practical GREEN-then-falsifying-test** (also valid TDD discipline): apply Task 2 fix first (Tasks 1+2 commits already on the branch), then add this test which serves as the falsifying regression gate. Same end state; no revert ceremony.
    - Pick (b). Document in the SUMMARY that the test is a falsifying-regression gate; verify it FAILS by temporarily reverting the Task 2 fix on a scratch branch (NOT a real commit — just a `git stash` round-trip to prove the falsifying property). The scratch verification is for the SUMMARY's "TDD-falsifying gate proven" claim; no commit is generated by the verification.
  </behavior>
  <action>
**Step A — Read the existing project-io.spec.ts mock setup at lines 22-72** to verify the mock surface matches what handleProjectResample needs. CRITICAL: confirm the existing electron mock only provides `getFocusedWindow`; you will extend it to include `getAllWindows`.

**Step B — Verify the runSamplerInWorker module path:**

```bash
grep -n "runSamplerInWorker\|sampler-worker-bridge" src/main/project-io.ts | head -5
```

Expected output: `import { runSamplerInWorker } from './sampler-worker-bridge.js';` at line 60. The vi.mock path from a test in `tests/main/` is therefore `'../../src/main/sampler-worker-bridge.js'`.

**Step C — Extend the electron mock.** Edit the existing `vi.mock('electron', ...)` at lines 22-32 to add `getAllWindows`:

Before:
```ts
vi.mock('electron', () => ({
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: { getFocusedWindow: vi.fn(() => null) },
  app: {
    whenReady: vi.fn(),
    quit: vi.fn(),
    on: vi.fn(),
    getPath: vi.fn(() => '/tmp/userData'),
  },
}));
```

After:
```ts
vi.mock('electron', () => ({
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
    // Phase 21 Plan 21-12 G-04 — handleProjectResample calls
    // BrowserWindow.getAllWindows()[0]?.webContents at project-io.ts:937.
    // The G-04 IPC test invokes handleProjectResample directly; without
    // this mock field the call throws TypeError. Empty array → optional
    // chaining → null webContents (no-op for the bridge mock below).
    getAllWindows: vi.fn(() => []),
  },
  app: {
    whenReady: vi.fn(),
    quit: vi.fn(),
    on: vi.fn(),
    getPath: vi.fn(() => '/tmp/userData'),
  },
}));
```

**Step D — Add the runSamplerInWorker mock.** Add a new `vi.mock` block after the existing recent.js / index.js mocks (top of file, after line 54). The module path is `'../../src/main/sampler-worker-bridge.js'`:

```ts
// Phase 21 Plan 21-12 G-04 — mock runSamplerInWorker so the IPC handler tests
// don't spawn a real worker thread. The mock returns a synthesized
// SamplerOutputShape with empty Maps; buildSummary still runs in-process
// against the real LoadResult (so summary.skippedAttachments reflects the
// loader's D-08 synthesis output). Module path verified via:
//   grep -n runSamplerInWorker src/main/project-io.ts
//   → import { runSamplerInWorker } from './sampler-worker-bridge.js'  (line 60)
vi.mock('../../src/main/sampler-worker-bridge.js', () => ({
  runSamplerInWorker: vi.fn().mockResolvedValue({
    type: 'complete',
    output: {
      globalPeaks: new Map(),
      perAnimation: new Map(),
      setupPosePeaks: new Map(),
    },
  }),
}));
```

**Step E — Add the new describe block + 1 test at the END of tests/main/project-io.spec.ts:**

```ts
describe('Phase 21 G-04 — toggle-resample-into-atlas-less precedence (handleProjectResample)', () => {
  // Falsifying-regression gate for Plan 21-12 G-04. The HUMAN-UAT reproducer:
  // user starts on a canonical project (.atlas present), deletes a single PNG
  // from images/ folder, toggles "Use Images Folder as Source" ON. The resample
  // IPC payload carries BOTH atlasPath (from prior canonical state) AND
  // loaderMode='atlas-less'. PRE-FIX: the loader's branch order picks D-06
  // (canonical atlas wins), synthesis never runs, summary.skippedAttachments
  // is empty, MissingAttachmentsPanel doesn't surface the missing PNG.
  // POST-FIX: the new caller-side precedence rule at project-io.ts:874-876
  // omits atlasPath when loaderMode='atlas-less', the loader's D-08 synthesis
  // branch runs, summary.skippedAttachments is populated, the panel surfaces
  // the missing entry. This test asserts the POST-FIX shape; if a future
  // regression restores the pre-fix shape, this test fails immediately.
  //
  // ATLAS SYNTHESIS: the canonical .atlas at fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas
  // does NOT contain MESH_REGION (only CIRCLE/SQUARE/TRIANGLE). Pairing it with
  // the MeshOnly_TEST.json fixture would trigger the stock AtlasAttachmentLoader's
  // "Region not found in atlas: MESH_REGION" throw at the D-06 branch
  // (AtlasAttachmentLoader.js:62), causing result.ok === false and the test
  // would fail PRE-FIX for the WRONG reason (the throw, not the empty
  // skippedAttachments). To make the load-bearing assertion be the
  // skippedAttachments check, we synthesize an inline tmp .atlas containing
  // MESH_REGION with stub-region bounds (libgdx 4.2 grammar). This makes
  // D-06 SUCCEED both pre-fix and post-fix, so result.ok === true in both
  // states, and the FALSIFYING property reduces to skippedAttachments.length === 1.

  it('handleProjectResample with both atlasPath + loaderMode:"atlas-less" produces summary.skippedAttachments populated for missing PNG (G-04)', async () => {
    // Set up a tmpdir with a canonical-shape source: JSON + synthesized .atlas
    // (containing MESH_REGION) + images/ (with the PNG deliberately MISSING).
    // This mimics the user's filesystem state when they toggle "Use Images
    // Folder as Source" ON after deleting a PNG manually, BUT with a
    // synthesized atlas so D-06 doesn't throw.
    const fsSync = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const SRC_NO_ATLAS_MESH = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
    const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'stm-resample-g04-'));
    const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
    const tmpAtlas = path.join(tmpDir, 'canonical.atlas');
    const tmpImages = path.join(tmpDir, 'images');
    fsSync.mkdirSync(tmpImages, { recursive: true });
    fsSync.copyFileSync(path.join(SRC_NO_ATLAS_MESH, 'MeshOnly_TEST.json'), tmpJson);
    // Synthesize a tmp .atlas containing MESH_REGION (libgdx 4.2 grammar).
    // This makes the D-06 read SUCCEED pre-fix (so result.ok === true and the
    // test's load-bearing assertion is on skippedAttachments.length, NOT on
    // result.ok).
    fsSync.writeFileSync(
      tmpAtlas,
      'tmp_page.png\n' +
      'size: 1,1\n' +
      'filter: Linear,Linear\n' +
      'MESH_REGION\n' +
      'bounds: 0,0,1,1\n',
      'utf8',
    );
    // Intentionally do NOT copy MESH_REGION.png — the missing-PNG case.

    try {
      // The mocks are set up via vi.mock at module-load time (see top of file
      // additions); per-test we just assert the result shape.
      const { handleProjectResample } = await import('../../src/main/project-io.js');
      const args = {
        skeletonPath: tmpJson,
        atlasPath: tmpAtlas,           // Pre-fix: this would WIN over loaderMode (D-06).
        samplingHz: 120,
        overrides: {},
        loaderMode: 'atlas-less',      // Post-fix: this WINS, atlasPath is omitted.
      };
      const result = await handleProjectResample(args);

      // Sanity: both pre-fix and post-fix have ok:true (synthesized atlas
      // makes D-06 succeed). The load-bearing falsifying property is the
      // skippedAttachments.length check below.
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok:true; got: ' + JSON.stringify(result.error));

      // FALSIFYING ASSERTION: pre-fix this is 0 (D-06 wins, synth never runs);
      // post-fix this is 1 (D-08 synthesis populates skippedAttachments).
      // OpenResponse shape (src/shared/types.ts:790-792) is
      // { ok: true; project: MaterializedProject }. MaterializedProject.summary
      // is the SkeletonSummary. Hence: result.project.summary.skippedAttachments
      // (NOT result.summary.skippedAttachments — that path doesn't exist on
      // the response shape).
      expect(result.project.summary.skippedAttachments.length).toBe(1);
      expect(result.project.summary.skippedAttachments[0].name).toBe('MESH_REGION');
      expect(
        result.project.summary.skippedAttachments[0].expectedPngPath.endsWith(
          path.join('images', 'MESH_REGION.png'),
        ),
      ).toBe(true);
    } finally {
      fsSync.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
```

**Step F — Run the new G-04 IPC test:**

```bash
npx vitest run tests/main/project-io.spec.ts -t "G-04"
```

Expected: 1 test passing.

**Step G — Falsifying-gate verification (no commit):**

To prove the test is a real falsifying gate, temporarily revert the Site 4 fix on a scratch (non-committed) edit, re-run the test, and confirm it FAILS pre-fix:

```bash
# Stash the Task 2 fix at Site 4 only (use git stash with a scoped patch, OR
# manually edit project-io.ts:874-876 back to the pre-fix shape, run the
# test, then restore via `git checkout HEAD -- src/main/project-io.ts`).
#
# For a clean scratch round-trip:
git diff HEAD -- src/main/project-io.ts > /tmp/task2-fix.patch
git checkout HEAD~1 -- src/main/project-io.ts   # revert to pre-Task-2 state
npx vitest run tests/main/project-io.spec.ts -t "G-04"
# Expected: FAILS — the assertion `summary.skippedAttachments.length === 1`
# fails because pre-fix the loader's D-06 branch wins (the synthesized atlas
# read SUCCEEDS pre-fix, but skippedAttachments stays []).
git checkout HEAD -- src/main/project-io.ts     # restore the fix
git apply /tmp/task2-fix.patch                  # OR re-apply the fix
npx vitest run tests/main/project-io.spec.ts -t "G-04"
# Expected: PASSES — POST-FIX the assertion holds.
```

(This is verification-only; no commit. The SUMMARY records "falsifying gate proven via scratch revert; pre-fix test fails on `.length === 1`, post-fix passes.")

**Step H — Run full typecheck + vitest to confirm no regressions:**

```bash
npm run typecheck
npm run test
```

Expected: zero new typecheck errors; full vitest passes (was 626+ after Task 1 + Task 2; should stay 627+ after this task adds 1 test).

**Step I — Commit with `--no-verify`:**

```bash
git add tests/main/project-io.spec.ts
git commit --no-verify -m "test(21-12): G-04 falsifying IPC test — handleProjectResample preserves skippedAttachments through atlas-less toggle"
```
  </action>
  <verify>
    <automated>npx vitest run tests/main/project-io.spec.ts -t "G-04"</automated>
  </verify>
  <acceptance_criteria>
    - New describe block exists: `grep -q "Phase 21 G-04 — toggle-resample-into-atlas-less precedence" tests/main/project-io.spec.ts`.
    - Test references the G-04 fixture pattern: `grep -q "SIMPLE_PROJECT_NO_ATLAS_MESH" tests/main/project-io.spec.ts`.
    - Test SYNTHESIZES the .atlas (does NOT copy `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas`): `grep -c "SIMPLE_PROJECT/SIMPLE_TEST.atlas" tests/main/project-io.spec.ts` returns 0 in the G-04 region; `grep -q "tmp_page.png\\\\nsize: 1,1\\\\nfilter: Linear,Linear\\\\nMESH_REGION\\\\nbounds: 0,0,1,1" tests/main/project-io.spec.ts` (the literal stub-region atlas content concatenation is present). Equivalent grep: `grep -E "tmp_page.png|filter: Linear,Linear|bounds: 0,0,1,1" tests/main/project-io.spec.ts | wc -l` returns ≥3.
    - Test asserts the post-fix shape on the CORRECT path: `grep -q "result.project.summary.skippedAttachments.length).toBe(1)" tests/main/project-io.spec.ts` (note: `result.project.summary`, NOT `result.summary`). AND `grep -q "MESH_REGION" tests/main/project-io.spec.ts`.
    - Test does NOT use the wrong path: `grep -c "result.summary.skippedAttachments" tests/main/project-io.spec.ts` returns 0 (must be `result.project.summary.skippedAttachments`).
    - electron mock extended with getAllWindows: `grep -q "getAllWindows: vi.fn(() => \\[\\])" tests/main/project-io.spec.ts`.
    - runSamplerInWorker mock is in place at the correct module path: `grep -q "vi.mock.*sampler-worker-bridge.js" tests/main/project-io.spec.ts` AND `grep -q "runSamplerInWorker.*vi.fn" tests/main/project-io.spec.ts`.
    - Test passes post-fix: `npx vitest run tests/main/project-io.spec.ts -t "G-04"` returns 1 passing.
    - Test FAILED pre-fix (verified via scratch revert in Step G; documented in SUMMARY).
    - Pre-existing project-io.spec.ts tests still pass: `npx vitest run tests/main/project-io.spec.ts` returns N passing where N >= the prior count + 1 (the new test).
    - Full vitest green: `npm run test 2>&1 | grep -E "Tests Failed" | wc -l` returns 0 (the pre-existing fixtures/Girl absence is the 1 expected unrelated failure per Plans 21-09 / 21-10 SUMMARYs).
    - Commit with --no-verify and message starting `test(21-12):`.
    - Plan 21-09 G-01 cold-load + Plan 21-10 G-02 cascade tests still pass (regression guard for the prior gap fixes).
  </acceptance_criteria>
  <done>G-04 IPC falsifying-regression test added to tests/main/project-io.spec.ts; uses synthesized inline atlas containing MESH_REGION (NOT a copy of SIMPLE_TEST.atlas); asserts result.project.summary.skippedAttachments (not result.summary); electron mock extended with getAllWindows; runSamplerInWorker mocked at the correct sampler-worker-bridge.js path; passes post-fix; verified to fail pre-fix via scratch revert (SUMMARY records the gate-proven property); full vitest green; committed with test(21-12) prefix.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Falsifying G-04 worker-boundary test — runSamplerJob with both atlasRoot + loaderMode='atlas-less' must NOT throw at the stock-loader D-06 branch</name>
  <files>tests/main/sampler-worker.spec.ts</files>
  <read_first>
    - tests/main/sampler-worker.spec.ts (full file — existing pattern at lines 40-129 directly invokes `runSamplerJob` against `SIMPLE_TEST.json` for unit-level testing without spawning a Worker).
    - src/main/sampler-worker.ts:88-99 (runSamplerJob signature: `{ skeletonPath, atlasRoot?, samplingHz, loaderMode?, onProgress, isCancelled }`).
    - src/main/sampler-worker.ts:100-136 (the runSamplerJob body — the loaderOpts construction at lines 105-110 is Site 5 of the precedence fix).
    - fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json (the mesh-only fixture; references MESH_REGION).
    - node_modules/@esotericsoftware/spine-core/dist/AtlasAttachmentLoader.js:50,62 — confirms the stock loader THROWS on missing region. This is the load-bearing failure mode the falsifier exploits.
  </read_first>
  <behavior>
    - **Why this task exists (rationale per plan-checker Issue #6):** Task 3's IPC test mocks `runSamplerInWorker` at the bridge boundary, which means `runSamplerJob` (where Site 5 lives at sampler-worker.ts:107-109) is NEVER invoked by Task 3. Without Task 4, Site 5's fix has no automated falsifier and relies on parity with Sites 1 + 4. This task adds a direct unit test against `runSamplerJob` to prove Site 5's precedence fix is exercised.
    - New describe block `'sampler-worker — Phase 21 G-04 (Site 5) loaderOpts precedence'` in tests/main/sampler-worker.spec.ts.
    - One test: `'runSamplerJob with both atlasRoot + loaderMode:"atlas-less" against atlas WITHOUT MESH_REGION → post-fix returns complete (D-08 synthesis); pre-fix returns error (stock D-06 loader throws Region-not-found)'`.
    - Test setup:
      1. Create tmpdir.
      2. Copy `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json` → `tmpDir/MeshOnly_TEST.json`.
      3. Create `tmpDir/images/MESH_REGION.png` (an actual PNG so D-08 synthesis succeeds — copy from `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/images/MESH_REGION.png`).
      4. **SYNTHESIZE** `tmpDir/canonical.atlas` containing a DIFFERENT region (e.g. `OTHER_REGION` with stub-region bounds), NOT `MESH_REGION`. The JSON references MESH_REGION; pre-fix the D-06 branch hands MESH_REGION to the stock AtlasAttachmentLoader, which throws "Region not found in atlas: MESH_REGION ...". Post-fix the D-08 synthesis branch ignores the canonical.atlas entirely and synthesizes the region from the JSON's mesh data.
    - Invoke `await runSamplerJob({ skeletonPath: tmpJson, atlasRoot: tmpAtlas, samplingHz: 120, loaderMode: 'atlas-less', onProgress: () => {}, isCancelled: () => false })`.
    - **FALSIFYING ASSERTION:** `result.type === 'complete'`. Pre-fix this is `'error'` (with `error.message` matching `/Region not found in atlas/`); post-fix this is `'complete'`.
    - Optional sanity assertion: when the result is `'complete'`, `result.output.globalPeaks.size > 0` (the rig samples real peaks; a generic non-zero check).
    - **TDD discipline note:** Same (b) ordering as Task 3 — apply Task 2 fix first (already on branch), then add this test which serves as the falsifying regression gate. The Step F scratch-revert verification proves the gate is real.
  </behavior>
  <action>
**Step A — Read the existing sampler-worker.spec.ts pattern at lines 40-129** to mirror imports, the `runSamplerJob` invocation idiom, and the `result.type` discriminated-union narrowing pattern.

**Step B — Append the new describe block at the END of tests/main/sampler-worker.spec.ts:**

```ts
describe('sampler-worker — Phase 21 G-04 (Site 5) loaderOpts precedence', () => {
  // Falsifying-regression gate for Plan 21-12 G-04 Site 5 (sampler-worker.ts
  // runSamplerJob loaderOpts construction, ~line 105-110). Task 3's IPC test
  // mocks runSamplerInWorker at the bridge boundary — runSamplerJob is never
  // invoked by Task 3, so Site 5's fix has no falsifier from that test alone.
  // This unit test directly invokes runSamplerJob to lock the Site 5 fix.
  //
  // Setup: a tmp .atlas that does NOT contain MESH_REGION. The JSON references
  // MESH_REGION. Pre-fix Site 5 passes BOTH atlasRoot + loaderMode to the
  // loader; the loader's D-06 branch reads the canonical atlas, then the
  // stock AtlasAttachmentLoader (loader.ts:352, NOT SilentSkip) throws
  // "Region not found in atlas: MESH_REGION (mesh attachment: MESH_REGION)"
  // per AtlasAttachmentLoader.js:62. runSamplerJob's catch arm returns
  // {type:'error', error:{...}}. Post-fix Site 5's new precedence rule omits
  // atlasPath when loaderMode='atlas-less', so the loader's D-08 synthesis
  // branch runs (synthesizes the region from the JSON's mesh data, ignoring
  // the canonical atlas). Load succeeds; runSamplerJob returns {type:'complete'}.
  //
  // Falsifying property: result.type === 'complete'.

  it('runSamplerJob with both atlasRoot + loaderMode:"atlas-less" against atlas WITHOUT MESH_REGION → post-fix complete (G-04 Site 5)', async () => {
    const fsSync = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const SRC_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
    const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'stm-worker-g04-'));
    const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
    const tmpAtlas = path.join(tmpDir, 'canonical.atlas');
    const tmpImages = path.join(tmpDir, 'images');
    fsSync.mkdirSync(tmpImages, { recursive: true });
    fsSync.copyFileSync(path.join(SRC_FIXTURE, 'MeshOnly_TEST.json'), tmpJson);
    // Copy the real PNG so D-08 synthesis SUCCEEDS post-fix (no missing PNG
    // case here — we want a CLEAN complete result post-fix to keep the
    // falsifying assertion crisp).
    fsSync.copyFileSync(
      path.join(SRC_FIXTURE, 'images', 'MESH_REGION.png'),
      path.join(tmpImages, 'MESH_REGION.png'),
    );
    // Synthesize a tmp .atlas containing OTHER_REGION (NOT MESH_REGION).
    // Pre-fix D-06 reads this atlas successfully (parses the OTHER_REGION
    // entry), then hands MESH_REGION to the stock AtlasAttachmentLoader
    // which throws "Region not found in atlas: MESH_REGION".
    fsSync.writeFileSync(
      tmpAtlas,
      'tmp_page.png\n' +
      'size: 1,1\n' +
      'filter: Linear,Linear\n' +
      'OTHER_REGION\n' +
      'bounds: 0,0,1,1\n',
      'utf8',
    );

    try {
      const result = await runSamplerJob({
        skeletonPath: tmpJson,
        atlasRoot: tmpAtlas,           // Pre-fix: this is passed to loader as atlasPath.
        samplingHz: 120,
        loaderMode: 'atlas-less',      // Post-fix: this WINS, atlasRoot is ignored.
        onProgress: () => {},
        isCancelled: () => false,
      });

      // FALSIFYING ASSERTION: pre-fix this is 'error' (stock AtlasAttachmentLoader
      // throws "Region not found in atlas: MESH_REGION ..."); post-fix this is
      // 'complete' (D-08 synthesis runs, skips the canonical atlas, succeeds).
      expect(result.type).toBe('complete');
      if (result.type !== 'complete') {
        // Helpful diagnostic for the pre-fix failure mode.
        throw new Error(
          `Expected complete; got ${result.type}: ` + JSON.stringify(result),
        );
      }
      // Sanity: the rig actually sampled (non-empty peaks Map).
      expect(result.output.globalPeaks.size).toBeGreaterThan(0);
    } finally {
      fsSync.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
```

**Step C — Run the new test:**

```bash
npx vitest run tests/main/sampler-worker.spec.ts -t "G-04"
```

Expected: 1 test passing post-fix.

**Step D — Falsifying-gate verification (no commit):**

```bash
# Verify the test FAILS pre-fix (proves the gate is real).
git diff HEAD -- src/main/sampler-worker.ts > /tmp/task2-site5.patch
git checkout HEAD~1 -- src/main/sampler-worker.ts   # revert Site 5 fix
npx vitest run tests/main/sampler-worker.spec.ts -t "G-04"
# Expected: FAILS — result.type === 'error' (stock loader throws Region-not-found).
git checkout HEAD -- src/main/sampler-worker.ts     # restore the fix
git apply /tmp/task2-site5.patch                    # OR re-apply the fix
npx vitest run tests/main/sampler-worker.spec.ts -t "G-04"
# Expected: PASSES — D-08 synthesis runs.
```

(Verification only; no commit. SUMMARY records "Site 5 falsifying gate proven via scratch revert; pre-fix test fails with `error.message =~ /Region not found/`, post-fix passes.")

**Step E — Run full typecheck + vitest to confirm no regressions:**

```bash
npm run typecheck
npm run test
```

Expected: zero new typecheck errors; full vitest passes (was 627+ after Task 1 + Task 2 + Task 3; should stay 628+ after this task adds 1 test).

**Step F — Commit with `--no-verify`:**

```bash
git add tests/main/sampler-worker.spec.ts
git commit --no-verify -m "test(21-12): G-04 worker-boundary falsifier — runSamplerJob loaderOpts precedence (Site 5)"
```
  </action>
  <verify>
    <automated>npx vitest run tests/main/sampler-worker.spec.ts -t "G-04"</automated>
  </verify>
  <acceptance_criteria>
    - New describe block exists: `grep -q "sampler-worker — Phase 21 G-04 (Site 5)" tests/main/sampler-worker.spec.ts`.
    - Test directly invokes `runSamplerJob`: `grep -c "runSamplerJob({" tests/main/sampler-worker.spec.ts` is now ≥6 (existing 5 + 1 new).
    - Test passes BOTH `atlasRoot` AND `loaderMode: 'atlas-less'` simultaneously: `grep -E "atlasRoot:.*tmpAtlas" tests/main/sampler-worker.spec.ts | head -1` non-empty AND `grep -q "loaderMode: 'atlas-less'" tests/main/sampler-worker.spec.ts`.
    - Test SYNTHESIZES the .atlas with `OTHER_REGION` (NOT `MESH_REGION`): `grep -q "OTHER_REGION" tests/main/sampler-worker.spec.ts` AND `grep -q "tmp_page.png" tests/main/sampler-worker.spec.ts`.
    - Falsifying assertion is on `result.type === 'complete'`: `grep -q "result.type).toBe('complete')" tests/main/sampler-worker.spec.ts`.
    - Test passes post-fix: `npx vitest run tests/main/sampler-worker.spec.ts -t "G-04"` returns 1 passing.
    - Test FAILED pre-fix (verified via scratch revert in Step D; documented in SUMMARY).
    - Existing sampler-worker tests still pass: `npx vitest run tests/main/sampler-worker.spec.ts` returns N passing where N >= the prior count + 1 (the new test).
    - Full vitest green (only pre-existing fixtures/Girl absence remains as the 1 expected unrelated failure).
    - Commit with --no-verify and message starting `test(21-12):`.
  </acceptance_criteria>
  <done>G-04 worker-boundary falsifying test added to tests/main/sampler-worker.spec.ts; directly invokes runSamplerJob with both atlasRoot + loaderMode='atlas-less' against an atlas WITHOUT MESH_REGION; falsifying property is result.type === 'complete'; passes post-fix; verified to fail pre-fix via scratch revert (SUMMARY records the gate-proven property for Site 5); full vitest green; committed with test(21-12) prefix.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| renderer→main IPC | `handleProjectResample` receives `{ skeletonPath, atlasPath, samplingHz, overrides, loaderMode }` from the renderer. The renderer is trusted in our threat model (T-09-06-RESAMPLE-* posture preserved); but `loaderMode` validation as a string-literal union (`'auto' | 'atlas-less' | undefined`) is unchanged from Plan 21-07. |
| main→worker postMessage | `runSamplerInWorker` threads `{ skeletonPath, atlasRoot, samplingHz, loaderMode }` to the worker via path-based protocol (D-193). The fix at Site 5 changes the worker-side `loadSkeleton` call's `loaderOpts` construction; no new fields cross the boundary. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-21-12-01 | Tampering | Caller passes `loaderMode='atlas-less'` + spoofed `atlasPath` to a third-party fixture | accept | The renderer is trusted; `loaderMode` and `atlasPath` come from the renderer's useState slot which the user controls via the toggle UI. The fix REMOVES the spoof surface (atlasPath is ignored when loaderMode is atlas-less), strictly tightening behavior. |
| T-21-12-02 | Information disclosure | Pre-fix: a missing PNG is silently invisible to the user — the deleted attachment appears with stale dims, hiding the gap | mitigate | The fix surfaces missing PNGs via skippedAttachments → MissingAttachmentsPanel. This IS the user-facing fix for G-04. |
| T-21-12-03 | DoS | Synthesis path is heavier than canonical .atlas read (per-region PNG header reads) | accept | Identical to the cold-load atlas-less path that already works in production; performance characteristics unchanged. The toggle resample was ALREADY going through synthesis if cold-load path went through it; the bug was that toggle was SHORT-CIRCUITING synthesis to canonical mode, so the post-fix is no worse than the cold-load atlas-less path that's been live since Plan 21-08. |
| T-21-12-04 | Repudiation | Caller-side precedence change could mask user intent if they explicitly want canonical-mode resample with `atlasPath` set | accept | The fix only redirects when `loaderMode === 'atlas-less'` is EXPLICITLY set. When loaderMode is 'auto' or undefined, the old behavior is preserved verbatim (atlasPath wins). The renderer only sends `loaderMode='atlas-less'` when the user has the toggle ON, which is unambiguous user intent. |
| T-21-12-05 | Spoofing | None — no new auth, no new IPC channels | accept | Pure caller-logic refactor. |
| T-21-12-06 | Elevation of privilege | None — no privilege boundaries crossed | accept | Pure caller-logic refactor. |
</threat_model>

<verification>
1. **Task 1**: 2 G-04 contract tests added to tests/core/loader-atlas-less.spec.ts (Test 7 uses synthesized inline atlas containing MESH_REGION, NOT a copy of SIMPLE_TEST.atlas); both pass on first run; existing tests unaffected; committed with test(21-12) prefix.
2. **Task 2**: Sites 1, 4 (project-io.ts) + Site 5 (sampler-worker.ts) apply the caller-side precedence fix; Site 3 has the audit comment cross-referencing the new convention; src/core/loader.ts untouched (`git diff --name-only HEAD~3 src/core/loader.ts | wc -l` returns 0); typecheck + full vitest green.
3. **Task 3**: G-04 IPC falsifying-regression test in tests/main/project-io.spec.ts; uses synthesized inline atlas containing MESH_REGION; asserts `result.project.summary.skippedAttachments` (not `result.summary`); electron mock extended with `getAllWindows: vi.fn(() => [])`; runSamplerInWorker mocked at `'../../src/main/sampler-worker-bridge.js'`; passes post-fix; verified to fail pre-fix via scratch revert (no commit; SUMMARY records the gate-proven property); full vitest green.
4. **Task 4**: G-04 worker-boundary falsifier in tests/main/sampler-worker.spec.ts; directly invokes runSamplerJob with both atlasRoot + loaderMode='atlas-less' against a synthesized .atlas WITHOUT MESH_REGION; falsifying property is `result.type === 'complete'`; passes post-fix; verified to fail pre-fix via scratch revert; locks the Site 5 fix that Task 3 alone cannot exercise (Task 3 mocks runSamplerInWorker at the bridge boundary, bypassing Site 5).
5. **End-to-end**: All Phase 21 prior gap-closure tests still pass (G-01 cold-load, G-02 cascade, criterion-#5 verbatim AtlasNotFoundError). The fix is path-symmetric — both cold-load atlas-less AND toggle-resample atlas-less produce the same `summary.skippedAttachments` shape for the same fixture-with-missing-PNG state.
6. **HUMAN-UAT readiness**: After this plan merges, the user can re-run UAT Test 4b Path 2 (canonical project + delete one PNG + toggle "Use Images Folder as Source" ON). The MissingAttachmentsPanel should now surface the missing entry — Path 1 + Path 2 are symmetric. UAT Test 4c (region-attachment + missing PNG via toggle path) becomes runnable; expected to pass per the same root cause.
</verification>

<success_criteria>
- G-04 closed: toggle-resample-into-atlas-less path now produces `summary.skippedAttachments` populated for missing PNGs, identical to cold-load atlas-less path.
- All 4 affected sites use the same caller-side precedence pattern: `if (loaderMode === 'atlas-less') { loaderOpts.loaderMode = 'atlas-less'; } else if (atlasPath !== undefined) { loaderOpts.atlasPath = atlasPath; }`.
- Site 3 (already shape-correct) has an audit comment cross-referencing the new convention.
- The loader (src/core/loader.ts) is UNCHANGED — branch order preserved, D-06 still wins when both options set.
- ROADMAP success criterion #5 (verbatim AtlasNotFoundError) preserved.
- 2 G-04 contract tests in loader-atlas-less.spec.ts (loader-API surface; synthesized inline atlas) + 1 G-04 falsifying-regression test in project-io.spec.ts (IPC handler surface; synthesized atlas; result.project.summary path; extended electron mock; correct sampler-worker-bridge mock path) + 1 G-04 worker-boundary falsifier in sampler-worker.spec.ts (Site 5 direct unit test).
- Plan 21-09 G-01 cold-load test still passes; Plan 21-10 G-02 cascade tests still pass.
- typecheck + full vitest green (only pre-existing TS6133 warnings + fixtures/Girl absence remain — both environmental, documented in Plans 21-09 / 21-10 SUMMARYs).
- 4 atomic commits (test(21-12) → fix(21-12) → test(21-12) → test(21-12)), each with `--no-verify` per parallel-executor protocol.
- Falsifying-gate properties documented in SUMMARY: scratch revert of Task 2 fix at Site 4 causes Task 3 test to fail; scratch revert of Task 2 fix at Site 5 causes Task 4 test to fail; restoring fix(es) makes them pass. Two independent gates (one per fix site that has a downstream falsifier).
- Test count delta: was 624+ pre-plan → expected 628+ post-plan (+4 net = 2 contract tests + 1 IPC test + 1 worker-boundary test).
</success_criteria>

<output>
After completion, create `.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-12-toggle-resample-atlas-less-precedence-SUMMARY.md` recording:

- Bisect outcome (which sites needed the fix; Site 3 audit-only).
- Loader untouched (verbatim grep confirmation: `git diff --name-only HEAD~4 src/core/loader.ts | wc -l` returns 0).
- 4 sites with the caller-side precedence pattern; Site 3 audit comment present.
- 2 G-04 contract tests (Tests 7 + 8 in loader-atlas-less.spec.ts; Test 7 uses synthesized inline atlas containing MESH_REGION) + 1 G-04 IPC falsifying-regression test (in project-io.spec.ts G-04 describe block; synthesized atlas; `result.project.summary` path) + 1 G-04 worker-boundary falsifier (in sampler-worker.spec.ts G-04 describe block; runSamplerJob direct invocation; `result.type === 'complete'` falsifying property).
- Falsifying-gate proofs:
  - Scratch revert of Task 2 fix at Site 4 (project-io.ts) causes the Task 3 IPC test to fail; restoring fix makes it pass.
  - Scratch revert of Task 2 fix at Site 5 (sampler-worker.ts) causes the Task 4 worker-boundary test to fail; restoring fix makes it pass.
  - (Two independent gates, one per code-changing site that has a downstream falsifier. Site 1 is pre-emptive and is locked by Tasks 1 + 2 typecheck/regression posture; Site 3 is audit-only.)
- Vitest delta (was 624+ pre-plan → expected 628+ post-plan; +4 net = 2 contract tests + 1 IPC test + 1 worker-boundary test).
- Threat model dispositions: T-21-12-01..06 all accepted or mitigated as noted.
- HUMAN-UAT readiness signal for Tests 4b Path 2 + 4c.
- Path-symmetry assertion: cold-load atlas-less + toggle-resample atlas-less now produce the same skippedAttachments shape.
</output>

<plan_revision_log>
## Plan Revision Log — 2026-05-02

Targeted edits applied in response to plan-checker feedback. The architectural
direction (caller-side precedence fix at Sites 1/4/5; Site 3 audit-only; loader
untouched; ROADMAP criterion #5 preserved) was unchanged. All edits were in the
test code design, not the source-side fix. 6 issues addressed.

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | BLOCKING | Task 1 Test 7 paired `MeshOnly_TEST.json` (which references mesh `MESH_REGION`) with `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` (which lacks `MESH_REGION`). The stock `AtlasAttachmentLoader` (loader.ts:352, NOT SilentSkip) at the D-06 branch would throw `"Region not found in atlas: MESH_REGION (mesh attachment: MESH_REGION)"` per `AtlasAttachmentLoader.js:50,62` — assertions would never be reached and the first run would fail. | **Option (b)**: Test 7 now SYNTHESIZES an inline tmp `.atlas` containing `MESH_REGION` with stub-region bounds (libgdx 4.2 grammar `bounds: 0,0,1,1`). D-06 read SUCCEEDS and the existing assertions (`atlasPath !== null`, `skippedAttachments === []`) become reachable. The load-bearing property is preserved: D-06 wins when both options are set. |
| 2 | MAJOR | Task 3 IPC test referenced `result.summary.skippedAttachments`. The actual `OpenResponse` shape (src/shared/types.ts:790-792) after `result.ok === true` is `{ ok: true; project: MaterializedProject }`, so the correct path is `result.project.summary.skippedAttachments`. | Updated all 3 occurrences in the test code to `result.project.summary.skippedAttachments`. Updated the matching literal-grep acceptance criterion: now requires `result.project.summary.skippedAttachments.length).toBe(1)` AND explicitly asserts `result.summary.skippedAttachments` does NOT appear (count 0). |
| 3 | MAJOR | Task 3's falsifying-gate had the same fixture-pairing flaw as Issue #1. Pre-fix `loadSkeleton` would throw on missing `MESH_REGION`, so `result.ok === false`. The test would fail on `expect(result.ok).toBe(true)` for the wrong reason — the throw, not the empty `skippedAttachments`. A future maintainer pairing the fixture with a canonical atlas containing `MESH_REGION` would silently degrade the gate. | Applied Issue #1's option (b) to Task 3: synthesize a tmp `.atlas` containing `MESH_REGION` with stub-region bounds. **Pre-fix:** `result.ok === true` (D-06 read SUCCEEDS) with stale dims and `skippedAttachments === []`. **Post-fix:** `result.ok === true` with `skippedAttachments.length === 1`. Documented explicitly that the load-bearing falsifying property IS `skippedAttachments.length === 1` (NOT `result.ok === true` — both states have `ok:true`). |
| 4 | MINOR | `handleProjectResample` calls `BrowserWindow.getAllWindows()[0]?.webContents ?? null` at project-io.ts:937. The existing electron mock at tests/main/project-io.spec.ts:22-32 only provides `getFocusedWindow`. Without `getAllWindows`, the mock would throw TypeError before the test reaches assertions. | Added explicit Step C in Task 3 that extends the electron mock with `getAllWindows: vi.fn(() => [])`. Includes the rationale comment in-place. Updated acceptance criterion to grep for `getAllWindows: vi.fn(() => [])`. |
| 5 | MINOR | The vi.mock module path placeholder `'./sampler-bridge.js'` was wrong. Confirmed via `grep -n "runSamplerInWorker" src/main/project-io.ts`: the import is `from './sampler-worker-bridge.js'` at line 60. From `tests/main/`, the correct path is `'../../src/main/sampler-worker-bridge.js'`. | Replaced the placeholder with the explicit verified path `'../../src/main/sampler-worker-bridge.js'` in Task 3's Step D. Added a verification step (`grep -n runSamplerInWorker src/main/project-io.ts`) in Step B for executor robustness. Updated acceptance criterion to literal-grep `vi.mock.*sampler-worker-bridge.js`. |
| 6 | MINOR | Task 3 mocks `runSamplerInWorker` at the bridge boundary. The worker's `runSamplerJob` (where Site 5 lives at sampler-worker.ts:107-109) is NEVER invoked by Task 3, so Site 5's fix had no automated falsifier and relied solely on parity with Sites 1 + 4. | **Option (a)**: Added a new **Task 4** that directly invokes `runSamplerJob` (already exported and unit-testable per the existing pattern at tests/main/sampler-worker.spec.ts:40-129). Setup: tmp `.atlas` containing `OTHER_REGION` (NOT `MESH_REGION`). **Pre-fix**: stock `AtlasAttachmentLoader` at D-06 throws `"Region not found in atlas: MESH_REGION"` → `runSamplerJob` returns `{type:'error'}`. **Post-fix**: D-08 synthesis runs (skipping the canonical atlas) → returns `{type:'complete'}`. Falsifying property: `result.type === 'complete'`. Added scratch-revert verification of Site 5 in Task 4's Step D. Updated frontmatter `files_modified` to include `tests/main/sampler-worker.spec.ts`; updated `must_haves.artifacts` with the new test file; updated success_criteria test count from 627+ to 628+; updated SUMMARY output to record Site 5 as a second independently-proven falsifying gate. |

### Files updated

- `.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-12-toggle-resample-atlas-less-precedence-PLAN.md` (this file)

### Source-side fix unchanged

The source-side changes at Sites 1 + 4 (project-io.ts) + Site 5
(sampler-worker.ts) + Site 3 audit comment in Task 2 are unchanged. The
revisions touched only test-code design and test-infrastructure setup
(electron mock, runSamplerInWorker mock path, fixture-atlas synthesis).
</plan_revision_log>

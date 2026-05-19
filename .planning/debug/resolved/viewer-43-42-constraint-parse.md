---
slug: viewer-43-42-constraint-parse
status: resolved
trigger: "After REG-47-01 fix (53e480c) the project loads, but the Animation Viewer fails on multiple 4.2 production fixtures that use constraints. fixtures/CHJ/CHJWC_SYMBOLS.json + fixtures/3Queens/TQORW_SYMBOLS.json + fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json all produced errors about transform constraints or IK. Observed error: 'Error: Could not load skeleton data. Transform constraint not found: JOKER_L_FINGERS'."
created: 2026-05-18
updated: 2026-05-19
diagnose_only: false
---

# Debug: viewer-43-42-constraint-parse

## Symptoms

### Expected behavior
Loading a 4.2 project that uses transform/IK constraints, then opening the
Animation Viewer, plays the first animation in the viewer — the same way the
4.2 `SIMPLE_TEST.json` fixture reportedly opened during the Phase 47 owner UAT.

### Actual behavior
The project itself loads fine (the main table populates — e.g. CHJ: "1
skeletons | 1 atlases | 346 regions"; the app **core** parsed the 4.2 skeleton
+ its constraints correctly). But opening the **Animation Viewer** shows the
modal's terminal error overlay:

```
Error: Could not load skeleton data.

Transform constraint not found: JOKER_L_FINGERS
```

(and analogous `IK constraint not found` / transform-constraint errors on the
other fixtures). The viewer never renders.

### Error messages
- `Error: Could not load skeleton data.` + `Transform constraint not found: JOKER_L_FINGERS` (CHJ/CHJWC_SYMBOLS).
- Owner reports the same class on 3Queens/TQORW_SYMBOLS and MON_FILES TEST_03 — "errors about transform constraints **or IK**". This is the spine-ts `SkeletonJson` error thrown when an **animation timeline** (or another construct) references a constraint by name that the parser did not register in `skeletonData.constraints`.

### Timeline
Surfaced 2026-05-18, immediately after the REG-47-01 fix (`53e480c`) made
4.x projects load far enough to *reach* the Animation Viewer. Introduced by
Phase 47 Plan 01 (the spine-player@**4.3.0** bump). The pre-bump viewer was
spine-player@4.2.111 (matched 4.2 JSON). The viewer has **never** worked on
real 4.2 constraint-heavy fixtures post-bump — including the `SIMPLE_TEST.json`
"control" (see Eliminated: the scoping premise was falsified). The Phase 47
`SIMPLE_TEST` 4.2 leg was only signed "opened correctly", never with a
rendered-animation verdict.

### Reproduction
1. `npm run dev` (Electron dev app; REG-47-01 fix `53e480c` present).
2. Load any of: `fixtures/CHJ/CHJWC_SYMBOLS.json`,
   `fixtures/3Queens/TQORW_SYMBOLS.json`,
   `fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json`. The main table
   populates normally (core path is fine).
3. Click **Animation Viewer**. The terminal error overlay appears.
4. Headless equivalent (no WebGL — CLAUDE.md fact 5): feed the raw fixture
   JSON to `@esotericsoftware/spine-core@4.3.0`'s `SkeletonJson` (the same
   spine-core bundled in spine-player@4.3.0 via spine-webgl@4.3.0) with a
   null AttachmentLoader → reproduces the throw on ALL FOUR fixtures
   (including SIMPLE_TEST → `Path constraint not found: PATH_SQUARE`).

### Scoping (refined — see Eliminated for the falsified premise)
All four fixtures are `spine: "4.2.43"`. The original scoping table's
"SIMPLE_TEST works / discriminator = constraint-timeline presence" theory was
FALSIFIED by the headless repro: spine-core@4.3.0 throws on SIMPLE_TEST too.
The true discriminator is **JSON schema shape**, not timeline keying.

### Architectural framing (confirmed root cause)
The Animation Viewer is **single-runtime**: `AnimationPlayerModal.tsx:613`
feeds the raw project JSON to `new SpinePlayer(container, config)`, whose
bundled `spine-core@4.3.0` `SkeletonJson` parses it. The app **core is
dual-runtime** (`src/core/loader.ts` `resolveRuntimeTag` → `pickRuntime('4.2')`
spine-core-42 vs `pickRuntime('4.3')` runtime-43) precisely because 4.2 and
4.3 JSON are NOT cross-parse-compatible. The viewer bypasses that router
entirely. Same family as REG-47-01 ("sibling left on the wrong runtime").

### Loader mode coverage
Fault is in skeleton-data (constraint-definition) parse, which is loaderMode-
invariant — reproduces in both atlas-source and atlas-less.

## Current Focus

```yaml
hypothesis: "CONFIRMED + PROVEN. The Spine 4.3 constraint refactor unified
  the four separate top-level 4.2 constraint-definition objects
  (root.ik / root.transform / root.path / root.physics) into a SINGLE typed
  array root.constraints[] with a per-entry `type` discriminator
  (ik|transform|path|physics|slider). spine-core@4.3.0 SkeletonJson reads
  constraint definitions ONLY from `if (root.constraints)`
  (node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js:129). A
  Spine 4.2 JSON has NO `root.constraints` key (it has separate
  root.ik/transform/path/physics), so that guard is FALSY and the ENTIRE
  constraint-definition loop is silently skipped → skeletonData.constraints
  stays empty → animation-timeline parse calls
  skeletonData.findConstraint(name, <Type>Data) (SkeletonJson.js:898/935/981)
  → returns null → `throw new Error('<X> constraint not found: <name>')`. This
  is a categorical 4.2-vs-4.3 JSON schema incompatibility, NOT data corruption
  and NOT a one-line code bug. It is the EXACT cross-version parse the app's
  dual-runtime split was built to prevent — but Phase 47 left the viewer
  single-runtime 4.3. Classification: PHASE 47 DESIGN GAP."
test: "DONE. (1) Headless repro: raw fixture JSON → spine-core@4.3.0
  SkeletonJson (null loader) throws `<X> constraint not found` on all 3
  failing fixtures AND on SIMPLE_TEST (Path constraint not found: PATH_SQUARE)
  — the control is ALSO broken. (2) Cross-runtime control: spine-core-42
  (4.2.111) parses SIMPLE_TEST cleanly (anims=4, constraints=9); the 3
  production fixtures' spine-core-42 throws were null-loader artifacts
  (reading 'bones'/'sequence' on a null attachment), NOT schema failures.
  (3) JSON shape: all 4 fixtures have `has_constraints_array: false` and
  separate top-level transform/ik/path/physics objects. (4) Source: read
  SkeletonJson.js:129 (`if (root.constraints)`) + SkeletonData.js:153
  (findConstraint) + spine-core-42 SkeletonJson.js:124/151/187/222
  (`if (root.ik)` / `root.transform` / `root.path` / `root.physics`) +
  src/core/loader.ts:106/237 (resolveRuntimeTag — the discriminator the
  viewer is missing)."
expecting: "(satisfied — outcome (b)) Confirmation that the single-runtime
  4.3 viewer is fundamentally incompatible with ANY 4.2 constraint-bearing
  project. Disposition: Phase 47 design gap → /gsd-plan-phase 47 --gaps. The
  viewer must route 4.2 projects through a 4.2-capable player path (the
  pre-bump spine-player@4.2.x, or a dual-runtime viewer mirroring the core's
  pickRuntime split). NOT an ad-hoc viewer hack — a 4.2→4.3 JSON in-memory
  upcast of every constraint+timeline block is the whole reason the core is
  dual-runtime."
next_action: "RESOLVED 2026-05-19 — owner Option A shim applied + verified
  + committed (7003ad8). See Resolution."
reasoning_checkpoint: ""
tdd_checkpoint: ""
```

## Evidence

- timestamp: 2026-05-18 — Owner (real Electron dev app, REG-47-01 fix
  `53e480c` present): Animation Viewer on `fixtures/CHJ/CHJWC_SYMBOLS.json`
  shows `Error: Could not load skeleton data.` / `Transform constraint not
  found: JOKER_L_FINGERS` (screenshot). Main table loaded normally
  ("1 skeletons | 1 atlases | 346 regions") ⇒ app core parsed the 4.2
  skeleton + constraints fine; only the viewer fails.
- timestamp: 2026-05-18 — Owner: `fixtures/3Queens/TQORW_SYMBOLS.json` and
  `fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json` produce the same class
  ("errors about transform constraints **or IK**") ⇒ systematic, not a
  single-fixture quirk; spans both transform AND ik constraint timelines.
- timestamp: 2026-05-18 — Headless repro (`@esotericsoftware/spine-core@4.3.0`
  SkeletonJson, null AttachmentLoader, raw fixture JSON — the LITERAL
  spine-player@4.3.0 parse path, NOT the app's dual-runtime adapter):
  - CHJ/CHJWC_SYMBOLS → `Transform constraint not found: JOKER_L_FINGERS`
    (SkeletonJson.js:937 readAnimation → readSkeletonData:465)
  - 3Queens/TQORW_SYMBOLS → `Timeline attachment not found: TRUNK`
    (SkeletonJson.js:1136 — analogous skin-attachment registration miss;
    same root: 4.2-shape skin/constraint blocks unread under 4.3)
  - MON_FILES TEST_03/4.2 → `IK Constraint not found: R_ARM_TARGET`
    (SkeletonJson.js:900)
  - SIMPLE_TEST (the "control") → `Path constraint not found: PATH_SQUARE`
    (SkeletonJson.js:983) ⇒ THE CONTROL IS ALSO BROKEN in the real viewer
    parse path.
- timestamp: 2026-05-18 — Cross-runtime control: spine-core-42 (4.2.111,
  the app's 4.2 core runtime) parses SIMPLE_TEST cleanly to completion
  (anims=4, constraints=9). The 3 production fixtures' spine-core-42 throws
  (`Cannot read properties of null (reading 'bones'/'sequence')`) are
  null-AttachmentLoader artifacts, not schema-parse failures — proving the
  fault is purely "4.3 cannot read 4.2-format constraint JSON".
- timestamp: 2026-05-18 — JSON shape (jq): all four fixtures have
  `has_constraints_array: false`; constraints live in separate top-level
  `transform` / `ik` / `path` / `physics` objects (4.2 format). No fixture
  has a `root.constraints[]` array (the 4.3 marker the core's
  `resolveRuntimeTag`/`checkSpine43Schema` keys on).
- timestamp: 2026-05-18 — Source: spine-core@4.3.0
  `SkeletonJson.js:129` reads constraint definitions ONLY from
  `if (root.constraints) { for (const constraintMap of root.constraints) {
  switch (constraintMap.type) { case "ik"|"transform"|"path"|"physics"|
  "slider" } } }`. spine-core-42 `SkeletonJson.js:124/151/187/222` reads
  `if (root.ik)` / `if (root.transform)` / `if (root.path)` /
  `if (root.physics)` — structurally incompatible source shapes. The app
  core's `src/core/loader.ts` `resolveRuntimeTag` (:237) + `checkSpine43Schema`
  (:178) deliberately route on exactly this `constraints[]`-presence marker;
  `AnimationPlayerModal.tsx:613` bypasses that router entirely.
- timestamp: 2026-05-19 — Owner-checkpoint refinement + PROOF (Option A
  session). The DV-1 dual-runtime viewer router
  (`AnimationPlayerModalRouter.tsx`) is ALREADY shipped: a `runtimeTag==='4.2'`
  project routes to the frozen `AnimationPlayerModal42` (spine-player@4.2.111)
  leg → the CHJ/TEST_03/SIMPLE_TEST class was already closed by DV-1. The
  residual defect is narrower: on a GENUINE 4.3 `root.constraints[]` project
  (`fixtures/DEMON/SKINS_SPINE_V02.json`, `spine: 4.3.02`), spine-core@4.3.0
  `SkeletonJson.js:241-248` chain-defaults `setup.mixY = getValue(map,"mixY",
  setup.mixX)` (and `mixScaleY ← mixScaleX`) but assigns `mixX`/`mixScaleX`
  ONLY `if (x)`/`if (scaleX)`. The transform `R_IK_HEEL-to-R_IK_WRIST` has a
  `y`-input → `{rotate, y}`-output (no `x` output) and the editor OMITS
  `mixY`; result: `setup.mixX` undefined → `setup.mixY` undefined → coerced
  to 0. Headless repro (before fix): `R_IK_HEEL-to-R_IK_WRIST setup.mixY=0`;
  `R_IK_WRIST` world-pos Δ=(0.00,0.00) ⇒ R-arm IK chain DEAD on
  `drive`/`con` × `FULL_SKINS/{ANGEL,DEMON}`. With the shim:
  `setup.mixY=1`, Δy≈15.77 (drive) / 19.62 (con) ⇒ ALIVE, all 4 combos.

## Eliminated

- hypothesis: "Same root cause as REG-47-01 (summary.ts cross-runtime
  handoff)." why: "REG-47-01 was a load-time main-process bug fixed in
  53e480c; this fixture now LOADS (table populates). This failure is in the
  separate, single-runtime spine-player@4.3.0 Animation Viewer parse path,
  and is constraint/timeline-specific, not a Color-on-undefined."
- hypothesis: "Fixture-specific corruption / a single bad Joker rig."
  why: "Reproduces across three unrelated 4.2 production projects (CHJ,
  3Queens, MON_FILES TEST_03) spanning transform AND ik AND skin-attachment
  timelines; spine-core-42 parses the 4.2 JSON cleanly. Systematic
  cross-version parse issue, not data corruption."
- hypothesis (FALSIFIED PREMISE): "SIMPLE_TEST.json is a working control;
  the discriminator is constraint-TIMELINE presence (SIMPLE_TEST's CHAIN_8
  has no animation timeline keyed to it, so the lookup never fires)."
  why: "The headless repro of the LITERAL viewer parse path throws on
  SIMPLE_TEST too (`Path constraint not found: PATH_SQUARE`, SkeletonJson.js
  :983, same readAnimation codepath). SIMPLE_TEST was NEVER a working control
  in the actual spine-player@4.3.0 path — the Phase 47 UAT only signed it
  'opened correctly' without a rendered-animation verdict (debug-file
  Timeline note). The true discriminator is JSON-schema shape
  (root.constraints[] vs separate root.ik/transform/path), not timeline
  keying. [[feedback_isolated_clean_is_not_pipeline_clean]]:
  'core parses it fine' only eliminated the dual-runtime core path; it never
  bounded the viewer's single-runtime 4.3 path, which IS the failing locus."

## Decision

**OWNER DISPOSITION (2026-05-18, SUPERSEDED): Discuss → plan.** The original
disposition treated this as a Phase 47 architectural design gap pending
`/gsd-discuss-phase 47`. That framing was correct at root-cause time but was
overtaken by two facts: (1) the DV-1 dual-runtime viewer router
(`AnimationPlayerModalRouter.tsx`) already shipped — a 4.2 project now routes
to the frozen `AnimationPlayerModal42` (spine-player@4.2.111) leg, so the
broad "4.2 projects throw in a single-runtime 4.3 viewer" class was already
closed; (2) the residual defect is far narrower and surgical.

**OWNER DISPOSITION (2026-05-19, ACTIVE — supersedes the above): Option A —
JSON normalization shim. Apply + verify (find_and_fix).** The owner resolved
the fix-options checkpoint, re-narrowing the proven root cause to its precise
mechanism (below) and mandating a targeted shim on both 4.3 seams, a
typescript-specialist review, all-entrypoint verification, an atomic
post-v1.6-completion commit (class parity with e7db8fe), and resolution.

### Schema reconciliation (recorded per owner directive)
The owner fix-direction described the path `properties.{input}.to.y` and
listed `mixShearY` as an analogous chained pair. Verified against the real
spine-core@4.3.0 source (`SkeletonJson.js:239-250`) + real fixtures:
- The 4.3-native shape IS `root.constraints[]` with per-entry
  `properties.{input}.to.{rotate|x|y|scaleX|scaleY|shearY}` — exactly as the
  owner described (confirmed on `fixtures/DEMON/SKINS_SPINE_V02.json`,
  `spine: 4.3.02`).
- `mixY ← mixX` (line 244) and `mixScaleY ← mixScaleX` (line 248) ARE
  chained. `mixShearY` (line 250) is `getValue(map,"mixShearY",1)` — an
  UNCONDITIONAL `1`, NOT a chained `setup.mixShearX`. It cannot collapse, so
  it is intentionally EXCLUDED from the shim. The owner's intent (mirror the
  genuine chained defaults; inject only omitted secondary-axis keys; never
  overwrite an author mix) is implemented exactly against the real schema.
- The 4.2 fixtures (CHJ/TEST_03/SIMPLE_TEST, `spine: 4.2.43`) use the flat
  separate `root.transform[]`/`root.ik[]` shape and never reach this 4.3
  parser (DV-1 router → 4.2 leg); they are out of scope for this shim and
  unaffected.

## Specialist Review

**typescript-expert — VERDICT: LOOKS_GOOD.** Reviewed all three changed
files. The shim uses a generic pass-through (`<T>(root:T):T`), precise
structural narrowing (`typeof`/`Array.isArray`/`hasOwnProperty`), no `any`,
no non-null assertions. `Object.prototype.hasOwnProperty.call` (not `in`) is
the correct, prototype-pollution-safe "author omitted it" check. In-place
mutation is documented + intentional (callers feed the same object straight
to the parser; allocation-free) and idempotent. The renderer
`btoa(unescape(encodeURIComponent(...)))` UTF-8-safe base64 idiom is a
deliberate, documented match to the already-proven `atlasTextDataUri` `atob`
consumer path — consistency over the `unescape` deprecation; acceptable, no
change required. `inlineNormalizedSkeleton` swallows fetch/parse errors →
bare-URL fallback (pre-fix behavior); introduces no new crash surface.
Module placement in `src/shared/` honors the enforced renderer↛core boundary
(`arch.spec.ts:19-23`). No idiomatic or correctness changes requested.

## Resolution

**RESOLVED 2026-05-19 — fix applied, verified across all entrypoint
runtimes, committed atomically (`7003ad8`).**

### Root cause (one sentence)
spine-core@4.3.0 `SkeletonJson` chain-defaults a transform constraint's
setup-pose `mixY ← mixX` (and `mixScaleY ← mixScaleX`) but assigns
`mixX`/`mixScaleX` only when an `x`/`scaleX` output is declared, so a
Spine-editor-producible constraint with a `y` (or `scaleY`) output, no `x`
(or `scaleX`) output, and `mixY`/`mixScaleY` omitted (the editor relies on
the chain) resolves the secondary-axis mix to `undefined` → `0`, silently
killing the Y-axis coupling and freezing every IK chain the constraint
drives.

### Fix (one sentence)
A shared spine-core-free, DOM-free JSON-normalization shim
(`src/shared/spine43-constraint-mix-normalize.ts`) mirrors the chained
default at the JSON level — injecting `mixY:1`/`mixScaleY:1` only when the
secondary-axis output is present, the primary-axis output absent, and the
key omitted (idempotent, never overwrites an author mix) — wired into BOTH
4.3 seams: `runtime-43.ts:parseSkeleton` (app-core Scale table) and
`AnimationPlayerModal.tsx`'s inline-rawDataURIs feed into
spine-player@4.3.0 (the 4.3 viewer leg); 4.2 projects route elsewhere and
are unaffected.

### Verification matrix (per-runtime — every documented entrypoint)
| Runtime / entrypoint | Result |
|---|---|
| vitest (`npm test`) | 1378 pass; the single `slider43-closedform` SC#2 failure is a PRE-EXISTING committed-history guard (reproduces with this fix fully stashed; unrelated files errors.ts/loader.ts/repack.ts) |
| `npm run cli` — runtime-43 (4.3 DEMON) | PASS — 123 attachments × 10 skins × 7 anims sampled cleanly |
| `npm run cli` — runtime-42 (4.2 CHJ regression) | PASS — unaffected (4.2 dispatch, shim never invoked) |
| Headless spine-core@4.3.0 viewer base64 round-trip (mirrors AnimationPlayerModal feed → spine-player Downloader.dataUriToString → SkeletonJson) | PASS — `R_IK_HEEL-to-R_IK_WRIST` setup.mixY 0→1; 7 anims/178 constraints |
| Behavioral repro: R_IK_WRIST world-pos × FULL_SKINS/{ANGEL,DEMON} × {drive,con} | PASS — DEAD (Δ=0.00) → ALIVE (Δy≈15.77 drive / 19.62 con), all 4 combos |
| Regression A — author-explicit mixes | PASS — 19 author-mix transforms (incl. L_SHOULDER3, L_EYE_CONST, L_BIG_HORN_CONST, …) byte-untouched |
| Regression B — idempotency | PASS |
| Regression C — non-4.3 / array-less inputs | PASS — structural no-op |
| `typecheck:web` | exit 0 |
| `tests/arch.spec.ts` | PASS — renderer↛core + runtime/ purity boundaries honored |

### Commit
`7003ad8` — `fix(viewer): normalize Spine 4.3 chained mix{Y,ScaleY}
defaults (viewer-43-42-constraint-parse)`. Owner-classified
post-v1.6-completion fix, same class as e7db8fe (folded into v1.6).
Throwaway `_repro*.mjs` diagnostics removed on session close.

---
slug: viewer-43-42-constraint-parse
status: root-caused
trigger: "After REG-47-01 fix (53e480c) the project loads, but the Animation Viewer fails on multiple 4.2 production fixtures that use constraints. fixtures/CHJ/CHJWC_SYMBOLS.json + fixtures/3Queens/TQORW_SYMBOLS.json + fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json all produced errors about transform constraints or IK. Observed error: 'Error: Could not load skeleton data. Transform constraint not found: JOKER_L_FINGERS'."
created: 2026-05-18
updated: 2026-05-18
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
next_action: "Surface fix-options checkpoint to owner: Plan fix
  (/gsd-plan-phase 47 --gaps) is the recommended disposition for a design
  gap. Do NOT force a quick patch."
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

**OWNER DISPOSITION (2026-05-18): Discuss → plan.** Root cause accepted as a
proven Phase 47 design gap. Owner chose to run `/gsd-discuss-phase 47` FIRST
(not straight to `/gsd-plan-phase 47 --gaps`) because this gap (a) invalidates
the core Phase 47 assumption that a single-runtime 4.3 viewer is viable, and
(b) exposed that the Phase 47 UAT's "opened correctly" sign-off never verified
animation rendering. The viewer architecture (option 1 vs 2 vs 3 in the
Recommended fix direction below) is an open decision the discuss pass must
settle before any gap plan is written. Debug session is CLOSED at root-cause;
the fix is owned by the Phase 47 discuss→plan→execute cycle, not this session.

## Specialist Review

(not invoked — root cause is an architectural runtime-routing design gap,
not a language/framework idiom question; specialist-skill review for a
TypeScript/React fix is premature until the design disposition is decided)

## Resolution

(root-caused; fix not applied — design-gap disposition pending owner choice)

### Root cause (one sentence)
The Animation Viewer is single-runtime spine-player@4.3.0, whose
spine-core@4.3.0 `SkeletonJson` reads constraint definitions only from a
unified `root.constraints[]` array that does NOT exist in Spine 4.2 JSON
(which uses separate top-level `ik`/`transform`/`path`/`physics` objects), so
every constraint-bearing 4.2 project parses with zero registered constraints
and throws `<X> constraint not found` the moment an animation timeline
references one — the exact cross-version parse the app core's dual-runtime
`resolveRuntimeTag` split prevents but which Phase 47 left the viewer
bypassing.

### Recommended fix direction (design gap — for /gsd-plan-phase 47 --gaps)
The viewer must stop being single-runtime 4.3. Options for the gap plan to
weigh (NOT to be hacked ad hoc here):
1. Route 4.2 projects through a 4.2-capable player (re-introduce
   spine-player@4.2.x for the `tag==='4.2'` arm), mirroring the core's
   `pickRuntime` split — highest fidelity, but a second spine-player copy.
2. Make the viewer consume the core's already-routed `OpaqueSkeletonData`
   instead of re-parsing raw JSON in spine-player — eliminates the second
   parse entirely but requires a renderer that takes pre-built skeleton data
   (spine-webgl SkeletonRenderer with an externally-built Skeleton).
3. A 4.2→4.3 in-memory JSON upcast before feeding spine-player@4.3.0 — the
   most fragile (it reimplements the 4.3 constraint refactor; explicitly the
   reason the core chose dual-runtime over an upcast). Lowest recommended.
The gap plan owns the option decision; do not pre-empt it with a patch.

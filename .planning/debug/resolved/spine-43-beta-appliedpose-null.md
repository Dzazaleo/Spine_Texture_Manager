---
slug: spine-43-beta-appliedpose-null
status: resolved
trigger: "the spines exported with the 4.3 stable version reading all correctly. But there is a json that i suspect it was exported by the 4.3 version while it aws still in beta, that produces the error \"Unknown: Cannot read properties of null (reading 'appliedPose')\" on loading the json into the app. You can find it at: /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json. In in fact is a problem of not being exported with the expected spine version, a wrming should be shown to the user. BUt investigate first to see the real cause."
created: 2026-05-19
updated: 2026-05-19
resolved: 2026-05-19
diagnose_only: false
---

# Debug: spine-43-beta-appliedpose-null

## Symptoms

### Expected behavior
One of two acceptable outcomes (the debugger must determine which is right —
the owner leans toward the second but explicitly asked for the real cause
first):
1. The app loads `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json` correctly (same
   end-to-end load the stable-4.3 fixture `fixtures/SIMPLE_PROJECT_43/skeleton2.json`
   gets), **OR**
2. The app **detects the unsupported / pre-release export version** and shows
   a clear, actionable user-facing warning instead of the opaque `Unknown:` toast.

RESOLVED OUTCOME: #2 (cause class (a)). The fixture is a structurally-invalid
pre-release export; the app now detects the pre-release token and rejects with
a typed, actionable re-export-from-stable message.

### Actual behavior (pre-fix)
`Unknown: Cannot read properties of null (reading 'appliedPose')` at LOAD.
The project never loaded.

## Current Focus

```yaml
hypothesis: "RESOLVED. The fixture is a 4.3-BETA export
  (skeleton.spine == '4.3.91-beta') containing a STRUCTURALLY-INVALID rig: a
  single `root` bone (no parent) plus an IK constraint
  { type:'ik', bones:['root'], target:'root' } targeting that root. loadSkeleton
  + SkeletonJson parse SUCCEED (runtime tag 4.3). The throw is at the sampler's
  FIRST updateWorldTransform, INSIDE spine-core@4.3.0's own
  IkConstraint.apply1 (`bone.bone.parent.appliedPose`, line 95 — a documented
  `noNonNullAssertion: reference runtime` deref): `root` has no parent → null →
  `null.appliedPose` throws. handleSkeletonLoad's catch reformatted the untyped
  TypeError into the opaque `Unknown:` toast (classifier fall-through, same
  swallow pattern as REG-47-01). FIXED by detecting the pre-release token at the
  single dispatch gate and rejecting before the broken rig reaches the sampler."
test: "tests/core/loader-version-guard.spec.ts (the Option-A D-11 recast — the
  PERMANENT regression test: re-anchored 4.3-routing proof on stable
  SIMPLE_PROJECT_43/skeleton2.json + a new pre-release-reject describe block
  mirroring the SPINE_3_8_TEST <4.2 block) +
  tests/core/loader-version-guard-predicate.spec.ts (4.3.73-beta → typed
  prerelease reject) + tests/core/errors-version.spec.ts (prerelease
  classification arm). The throwaway headless _dbg- repro was deleted (never
  git-tracked); the D-11 recast supersedes it as the durable contract."
expecting: "RESOLVED — cause class (a): a pre-release editor build emitting a
  structurally-invalid rig the SHIPPED stable spine-core runtime cannot
  process. (b) adapter-incompleteness FALSIFIED (throw is in spine-core's own
  IkConstraint, not our adapter). (c) beta-schema-unparseable FALSIFIED (parse
  succeeds). The root-targeting parentless IK is the deterministic trigger; the
  tiny/no-animation shape is incidental."
next_action: "DONE — fix applied + verified + committed; debug file finalized
  and moved to .planning/debug/resolved/. Throwaway _dbg- repro deletion
  deferred to the owner (sandbox blocked rm; it is untracked so it is NOT in
  the commit and is harmless). Post-milestone-patch flag surfaced to the owner."
reasoning_checkpoint: ""
tdd_checkpoint: ""
```

## Evidence

- timestamp: 2026-05-19 — Owner: loading
  `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json` → toast
  `Unknown: Cannot read properties of null (reading 'appliedPose')`. Stable
  4.3 (`4.3.01`) + 4.2 fixtures load fine. Owner suspected a beta export;
  asked for the real cause first.
- timestamp: 2026-05-19 — Orchestrator grounding: 328 bytes,
  `skeleton.spine == "4.3.91-beta"`, top-level `constraints[]`.
- timestamp: 2026-05-19 — DEBUGGER: full fixture content =
  `bones:[{name:"root"}]`, `slots:[]`, `skins:[{default,{}}]`,
  `constraints:[{name:"test_ik",type:"ik",bones:["root"],target:"root"}]`.
  A single parentless root bone + an IK constraint targeting root itself.
- timestamp: 2026-05-19 — DEBUGGER: recovered swallowed Node stack via the
  `_dbg-` headless repro:
  `TypeError: Cannot read properties of null (reading 'appliedPose')`
  `at IkConstraint.apply1 (spine-core@4.3.0/dist/IkConstraint.js:95:36)` ←
  `IkConstraint.apply` ← `IkConstraint.update` ←
  `Skeleton.updateWorldTransform (Skeleton.js:228)` ←
  `runtime-43.ts:343 updateWorldTransform` ← `sampler.ts:180 sampleSkeleton`.
  loadSkeleton + parse SUCCEED first (runtime tag = `4.3`). Source-confirmed:
  `IkConstraint.js:92-95` `apply1(...) { bone.modifyLocal(skeleton); const p =
  bone.bone.parent.appliedPose; ... }` with a `// biome-ignore
  lint/style/noNonNullAssertion: reference runtime` bypass — the reference
  runtime trusts `parent` non-null; a root-targeting IK has `parent === null`.
- timestamp: 2026-05-19 — DEBUGGER: classifier path = `handleSkeletonLoad`
  (ipc.ts:633-669): the TypeError is not `SpineVersionUnsupportedError`/
  `SpineLoaderError`, so it falls to `{ kind:'Unknown', message }`. Renderer
  (App.tsx:751) shows `{kind}: {message}` → the opaque toast.
- timestamp: 2026-05-19 — DEBUGGER: SCOPE FINDING — `SPINE_4_3_TEST.json` is
  ALSO Phase-44 D-11's "valid 4.3 routing" fixture
  (tests/core/loader-version-guard.spec.ts:117-167 + the predicate test
  loader-version-guard-predicate.spec.ts:154 `4.3.73-beta → '4.3'`). Those
  tests encode the exact latent assumption this bug exposes (a beta-suffix
  token is a normal in-band 4.3 route). The fix correctly flips that.
- timestamp: 2026-05-19 — CHECKPOINT raised to owner; owner chose OPTION A
  (non-weakening D-11 reconciliation). Session-manager continuation executed
  Option A: re-pointed the D-11 routing/parse proof at the genuine stable
  `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (`4.3.01`, 14 bones, 1 skin,
  top-level constraints[], verified `{ ok: true }`); recast `SPINE_4_3_TEST`
  as a PRE-RELEASE REJECT mirroring the existing `SPINE_3_8_TEST` `<4.2`
  reject block (same assertion shapes); retained the applied predicate-test
  patch. Existence sentinels preserved verbatim + a stable-fixture sentinel
  added. D-11 false-green-guard header + intent preserved and extended.
- timestamp: 2026-05-19 — VERIFICATION: targeted gate
  (`loader-version-guard.spec.ts` + `loader-version-guard-predicate.spec.ts`
  + `errors-version.spec.ts`) = 64/64 PASS. Full `npx vitest run` = **139
  test files passed, 1381 passed | 2 skipped | 2 todo, 0 failures.** Strictly
  stronger than the documented pre-existing baseline (the ~11
  `tests/renderer/*` MixBlend-import-failing files —
  project_renderer_mixblend_preexisting_failure — did not even surface this
  run; the `getContext()` jsdom lines are benign canvas-stub noise, not test
  failures). Zero NEW failures attributable to this fix.

## Eliminated

- hypothesis: "Regression of REG-47-01 (`reading 'r'`)." why: "Distinct —
  `reading 'appliedPose'` in spine-core IkConstraint, not a Color `.r`. The
  53e480c fix is present; summary.ts routes via load.runtime.makeSkeleton."
- hypothesis: "Viewer constraint-parse gap (viewer-43-42-constraint-parse)."
  why: "That was `<X> constraint not found` in the viewer; resolved via
  Phase 47 DV-1. This fires at PROJECT LOAD before any viewer."
- hypothesis (cause c): "spine-core@4.3.0 stable cannot parse the 4.3-beta
  schema." why: "FALSIFIED — loadSkeleton + SkeletonJson.readSkeletonData
  succeed; the throw is downstream at the first updateWorldTransform."
- hypothesis (cause b): "runtime-43 adapter incompleteness leaves a node
  null." why: "FALSIFIED — the null deref is INSIDE spine-core@4.3.0's own
  IkConstraint.apply1 (reference-runtime non-null-assertion on
  `bone.bone.parent`), not in our adapter. The adapter forwards
  updateWorldTransform correctly."
- hypothesis: "The no-animation / tiny-skeleton edge is the trigger." why:
  "FALSIFIED as the trigger — the root-targeting parentless IK constraint is
  the deterministic cause; a no-IK no-animation rig would not throw. The
  tiny/no-animation shape is incidental to this hand-authored beta test rig."

## Decision

ROOT CAUSE (confirmed): a Spine 4.3 **pre-release (beta) editor build**
exported a structurally-invalid rig (root-targeting, parentless IK
constraint). The SHIPPED stable spine-core@4.3.0 runtime dereferences
`bone.bone.parent.appliedPose` unconditionally (documented reference-runtime
non-null bypass) and throws at the first `updateWorldTransform`; the untyped
throw was swallowed into the opaque `Unknown:` toast.

REMEDIATION (matches owner's stated preference; cause class (a)):
detect the **pre-release version token** at the single dispatch gate
(`resolveRuntimeTag`, src/core/loader.ts) — the cheap, deterministic, honest
signal — and reject IN-BAND (4.2.x/4.3.x) pre-release exports with a typed
`SpineVersionUnsupportedError` carrying an actionable
"re-export from a stable Spine release" message, BEFORE the broken rig
reaches the sampler. Deep structural IK-chain validation was rejected (would
duplicate spine-core internals; the pre-release token is the robust signal
for the whole class of beta-emitted malformed rigs).

## Specialist Review

specialist_hint: typescript. `typescript-expert` skill is NOT installed in
this environment — VERIFIED this turn: `~/.claude/skills/` contains only the
`gsd-*` workflow skills (66 dirs, all `gsd-`-prefixed; no `typescript-expert`).
Same honest non-availability previously recorded for the resolved REG-47-01
session. No specialist review fabricated.

Mitigating rationale: the fix is a pure, additive string/object predicate
(`isPrereleaseSpineToken`) plus one reject arm at the EXISTING typed-error
dispatch gate — it mirrors the loader's own established sentinel/
`resolveRuntimeTag` shape (the `<4.2` and `≥4.4` arms it sits between) and the
errors.ts classification ladder. The test recast mirrors the EXISTING
`SPINE_3_8_TEST` `<4.2` reject block (identical assertion shapes), inventing
no new pattern. TS strictness is unaffected: no new spine-core types, the
RT-02 spine-core-import-free invariant is preserved (pure string inspection,
no DOM/fs/Electron). Coverage: the existing 84-case version-guard
predicate/fixture suites + the new permanent pre-release-reject describe
block. Full regression: 1381/1381 pass, 0 failures.

## Resolution

root_cause: `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json` is a Spine
`4.3.91-beta` (pre-release editor build) export containing a
structurally-invalid rig — a single parentless `root` bone plus an IK
constraint targeting `root` itself. loadSkeleton + SkeletonJson parse succeed
(runtime tag 4.3); the SHIPPED stable spine-core@4.3.0 `IkConstraint.apply1`
dereferences `bone.bone.parent.appliedPose` unconditionally (documented
reference-runtime non-null bypass), so `root.parent === null` throws
`null.appliedPose` at the sampler's first `updateWorldTransform`, and
`handleSkeletonLoad`'s catch reformatted the untyped TypeError into the opaque
`Unknown: Cannot read properties of null (reading 'appliedPose')` toast.
Cause class (a) — an unsupported pre-release export the app must detect.

fix: `src/core/loader.ts` — added `isPrereleaseSpineToken()` (pure regex
predicate: leading `major.minor[.patch]` + a semver pre-release suffix;
explicitly excludes the sanctioned `4.2-from-4.3.01` editor-downgrade marker
via the `from-` suffix guard) and a PRE-RELEASE reject arm in
`resolveRuntimeTag` (positioned AFTER the `<4.2`/`≥4.4` arms so out-of-band
pre-releases keep their existing wording; throws
`SpineVersionUnsupportedError('prerelease:'+version, skeletonPath)`).
`src/core/errors.ts` — added a 4th classification branch (`prerelease`) to the
`SpineVersionUnsupportedError` constructor emitting an actionable message that
echoes the actual beta token and directs a stable re-export; `.name` +
`detectedVersion`/`skeletonPath` field shapes preserved (no new error class —
extends the discriminated union; the renderer shows `.message`, never the
`prerelease:` sentinel). The broken rig is now rejected at the single dispatch
gate BEFORE it reaches the sampler.

verification: targeted gate (`loader-version-guard.spec.ts` +
`loader-version-guard-predicate.spec.ts` + `errors-version.spec.ts`) = 64/64
PASS. Full `npx vitest run` = 139 test files passed, 1381 passed | 2 skipped
| 2 todo, **0 failures** — strictly stronger than the documented pre-existing
baseline (the ~11 `tests/renderer/*` MixBlend-import-failing files —
project_renderer_mixblend_preexisting_failure — did not surface this run; the
`getContext()` jsdom lines are benign canvas-stub noise). `typecheck:node` was
NOT run as a gate (pre-existingly RED — project_typecheck_node_preexisting_red
— not a per-fix regression). Zero NEW failures attributable to this fix.

files_changed:
- src/core/loader.ts (isPrereleaseSpineToken + resolveRuntimeTag pre-release
  reject arm; RT-02 import-free preserved)
- src/core/errors.ts (SpineVersionUnsupportedError 4th `prerelease`
  classification branch + actionable message)
- tests/core/loader-version-guard.spec.ts (Option-A D-11 STRENGTHENING
  reconciliation: re-anchored the 4.3-routing/parse proof on the genuine
  stable `fixtures/SIMPLE_PROJECT_43/skeleton2.json`; ADDED a permanent
  pre-release-reject describe block mirroring the `SPINE_3_8_TEST` `<4.2`
  block; preserved the `<4.2` reject block + D-11 false-green-guard header +
  all existence sentinels; added a stable-fixture sentinel)
- tests/core/loader-version-guard-predicate.spec.ts (4.3.73-beta now asserts
  a typed `prerelease:4.3.73-beta` reject, not a route)

specialist_review: typescript-expert NOT installed (verified
`~/.claude/skills/` = gsd-* only); honest non-availability recorded, NO review
fabricated. Mitigation: the fix mirrors the loader's existing
sentinel/`resolveRuntimeTag` shape and the existing `SPINE_3_8_TEST` reject
block; pure additive predicate; RT-02 import-free invariant preserved; covered
by the 84-case version-guard suites + the new permanent reject contract; full
suite 1381/1381 green.

throwaway_repro_disposition: `tests/runtime43/_dbg-spine43beta-appliedpose.spec.ts`
was NEVER git-tracked (`git ls-files` empty). Sandbox blocked the `rm` this
turn, so it remains on disk but is NOT staged and NOT in the commit (only
explicit paths were staged). The Option-A D-11 recast
(`loader-version-guard.spec.ts` pre-release-reject describe block) IS the
permanent regression test for this contract — the throwaway is fully
superseded. ACTION FOR OWNER: delete it at leisure:
`rm tests/runtime43/_dbg-spine43beta-appliedpose.spec.ts` (harmless if left —
it is a passing headless repro, untracked, never in CI's tracked set).

milestone_disposition: **POST-MILESTONE PATCH.** STATE.md has
`milestone: v1.6` / `status: milestone_complete` (47-05 closed 2026-05-19; the
v1.6 D-01 hold released). This fix landed AFTER milestone close on the same
branch `milestone/v1.6-spine-4.3-dual-runtime`. STATE.md and ROADMAP were
deliberately NOT mutated by this debug session — this disposition is surfaced
to the owner for an explicit decision (treat as a v1.6 post-milestone patch /
fold into a v1.6.x point release / re-open the milestone). Flagged, not
silently absorbed.

commit: see git log on `milestone/v1.6-spine-4.3-dual-runtime` —
`fix(loader): reject pre-release Spine exports (4.3-beta appliedPose crash)`.
Local-only (NOT pushed — owner is a git beginner; local-only unless asked).

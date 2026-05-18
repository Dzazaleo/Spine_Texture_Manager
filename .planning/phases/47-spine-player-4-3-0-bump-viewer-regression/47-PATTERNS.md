# Phase 47: spine-player 4.3.0 Bump + Viewer Regression - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 6 (2 source/config, 1 test, 2 planning UAT artifacts, 1 plan-task pattern)
**Analogs found:** 6 / 6 (all in-repo; no RESEARCH.md-only fallback needed)

> Scope note: this phase has NO new module to scaffold. It is a surgical
> dependency bump + an audited 8-touchpoint in-file API migration + a lockstep
> test-mock migration + two planning UAT artifacts + one owner live-UAT
> checkpoint task. Every "analog" below is therefore an *in-place edit target*
> (the file IS its own pattern source — the 4.2 shape it currently has + the
> verified 4.3 shape RESEARCH.md derived) or a *prior-phase structural model*
> for the new artifacts. RESEARCH.md's D-04/D-05 tables are HIGH-confidence and
> already supply the exact migrated code; the planner should copy from there
> verbatim. This map adds the surrounding-context excerpts + the artifact
> structural analogs the planner needs to write tasks.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `package.json` (line 27) | config (dependency manifest) | transform (build-graph) | `package.json` line 26 (`spine-core: "4.3.0"` — the already-applied sibling exact-pin) + line 35 alias | exact (same file, same convention, sibling line) |
| `src/renderer/src/modals/AnimationPlayerModal.tsx` (imports L45-53 + 8 touchpoints) | component (React modal wrapping spine-player) | request-response (load → render → scrub) | itself: current 4.2 call shape ⇄ RESEARCH.md D-04/D-05 verified 4.3 shape | exact (RESEARCH gives line-precise before/after) |
| `tests/renderer/animation-player-modal.spec.tsx` (mock L68-156, L305-325; assertion L594-615) | test (vitest renderer spec + inline `vi.mock`) | request-response (mocked) | itself: current 4.2 mock surface ⇄ the migrated modal's 4.3 call surface (Pattern 2 lockstep) | exact (RESEARCH Pattern 2 names every line) |
| `.planning/phases/47-.../47-HUMAN-UAT.md` (NEW) | planning artifact (owner-signed UAT record) | event-driven (human sign-off) | `.planning/phases/41-.../41-HUMAN-UAT.md` (the 5 carried tests verbatim) + `.planning/phases/36-.../36-HUMAN-UAT.md` (richer signed-off structure) | exact (41 = content source; 36 = signed-off shape) |
| `.planning/phases/41-.../41-HUMAN-UAT.md` (in-place flip of 5 pending → resolved) | planning artifact (audit-trail edit) | transform (status flip + pointer) | itself: test-1 `gaps:`/`status: resolved`/`fixed_in:` pattern (L18-33) | exact (the resolved-marker shape already lives in the same file) |
| Plan task: owner live-UAT `checkpoint:human-action` | plan-task pattern (D-02 gate) | event-driven (owner resume signal) | `46-01-PLAN.md` Task 2 `<task type="checkpoint:human-action" gate="blocking">` (L164-194) | exact (most recent completed phase; same owner-action class) |

## Pattern Assignments

### `package.json` line 27 (config, transform)

**Analog:** the same file's already-canonicalized sibling deps — the
exact-pin convention is established, not a question (CONTEXT "Established
Patterns"; STACK.md).

**Current state** (`package.json` L25-36):
```jsonc
  "dependencies": {
    "@esotericsoftware/spine-core": "4.3.0",       // L26 — canonical, frozen Phase 42 (the sibling pin to match)
    "@esotericsoftware/spine-player": "4.2.111",   // L27 — THE ONLY LINE THIS PHASE CHANGES
    ...
    "spine-core-42": "npm:@esotericsoftware/spine-core@4.2.111"  // L35 — frozen alias, DO NOT TOUCH
  },
```

**Edit pattern** (copy the exact-pin shape from L26 — no caret, no range,
sibling-aligned to the canonical spine-core):
```jsonc
    "@esotericsoftware/spine-player": "4.3.0",
```
Then regenerate `package-lock.json` via `npm install` (pulls
`@esotericsoftware/spine-webgl@4.3.0` transitively; spine-player has no nested
spine-core so it bare-resolves the canonical 4.3.0 — RESEARCH D-03 ¶3).
**Do NOT** edit L26 or L35 (out of scope; spine-core@4.3.0 frozen-canonical
from Phase 42 — RESEARCH Anti-Patterns).

---

### `src/renderer/src/modals/AnimationPlayerModal.tsx` (component, request-response)

**Analog:** itself. RESEARCH.md D-04 (line-255 1:1) + D-05 (the 8-touchpoint
audit table, lines 174-198) supply every before/after with verified
`node_modules/@esotericsoftware/spine-core/dist/*.d.ts` line citations and
exact `tsc` error coordinates. **The planner must copy the migrated code from
RESEARCH.md D-04/D-05 directly** — it is HIGH-confidence and line-precise.
This section anchors each touchpoint to its surrounding modal context so the
planner can scope tasks against real code, not just the table.

**Imports pattern — DROP the 2 removed symbols** (current L45-53):
```ts
import {
  MixBlend,        // ← REMOVE (0 occurrences in spine-core@4.3.0)
  MixDirection,    // ← REMOVE (0 occurrences in spine-core@4.3.0)
  Physics,
  Skeleton,
  SpinePlayer,
  Vector2,
  type SpinePlayerConfig,
} from '@esotericsoftware/spine-player';
```
→ migrated block = RESEARCH.md "Imports (drop the two removed symbols)"
(research lines 374-380). `Physics`/`Skeleton`/`SpinePlayer`/`Vector2`/
`SpinePlayerConfig` all still exported by spine-player@4.3.0 (verified).

**T1 — `Animation.apply()` 8→10 arg (the one true API break, L255)**, inside
`sampleAnimationBounds` (the resilient path — context L234-275):
```ts
    for (let i = 0, t = 0; i < steps; i++, t += dt) {
      anim.apply(probe, t, t, false, [], 1, MixBlend.setup, MixDirection.mixIn);  // ← L255 (4.2 8-arg)
      probe.updateWorldTransform(Physics.update);
      probe.getBounds(off, size, temp);
```
→ 4.3 10-arg (RESEARCH D-04, verified vs `Animation.d.ts:93` + cross-confirmed
vs spine-player@4.3.0 `Player.js:644`):
```ts
      anim.apply(probe, t, t, false, [], 1, /*fromSetup*/ true, /*add*/ false, /*out*/ false, /*appliedPose*/ false);
```
`MixBlend.setup→fromSetup=true`; `MixDirection.mixIn→out=false`; new
`add=false`, `appliedPose=false`. **The surrounding `try/catch` +
`if (!any) return null` + `if (!(width>0)...) return null` graceful-degradation
guards (L238, L267, L270, L272-274) are byte-unchanged** — RESEARCH D-04
proves the signature change does not regress the content-less-STOP-animation
`null` return (the Phase 41 must-not-regress invariant).

**T2 — `setSkinByName`→`setSkin` (private→public, ×3 sites)**. In `makeProbe`
(context L215-223):
```ts
function makeProbe(p: SpinePlayer): Skeleton | null {
  const live = p.skeleton;
  if (!live) return null;
  const probe = new Skeleton(live.data);
  const skinName = live.skin?.name;
  if (skinName) probe.setSkinByName(skinName);   // ← L220 → probe.setSkin(skinName)
  probe.setSlotsToSetupPose();                   // ← L221 (T4 → probe.setupPoseSlots())
  return probe;
}
```
3 sites total: L220 (`makeProbe`), L563 (`success` cb), L645 (`onSkinChange`).
→ `probe.setSkin(skinName)` (string overload, `Skeleton.d.ts:131`). The
**skin-set-THEN-slots-reset call order is preserved** (4.3 `setSkin` JSDoc
mandates `setupPoseSlots` after `setSkin` — RESEARCH D-05 T2/T4 note;
`project_strict_loadermode_separation` invariant).

**T3 — `setToSetupPose`→`setupPose` (rename, ×2)**: L242
(`sampleAnimationBounds`, visible in the T1 context — `probe.setToSetupPose();`
at L242), L283 (`sampleSetupBounds`). → `probe.setupPose()` (`Skeleton.d.ts:115`).

**T4 — `setSlotsToSetupPose`→`setupPoseSlots` (rename, ×3)**: L221
(`makeProbe`, shown in T2 context), L564 (`success`), L646 (`onSkinChange`).
→ `probe.setupPoseSlots()` (`Skeleton.d.ts:119`).

**T5 — `getCurrent(0)`→`getTrack(0)` (removed→replacement, ×3)**. In `onScrub`
(context L665-672):
```ts
  const onScrub = useCallback((percentage: number) => {
    const p = playerRef.current;
    if (!p?.animationState) return;
    const entry = p.animationState.getCurrent(0);   // ← L668 → getTrack(0)
    if (!entry) return;
```
3 sites: L488 (`update` cb), L614 (`refreshBounds`), L668 (`onScrub`). →
`p.animationState?.getTrack(0)` (`AnimationState.d.ts:169`). `TrackEntry.animation`
→ `.name`/`.duration` unchanged.

**T6 — `p.playTime` private read+write → `TrackEntry`-driven scrub (THE
design-sensitive item; NOT a rename)**. Full current `onScrub` (L663-683):
```ts
  const onScrub = useCallback((percentage: number) => {
    const p = playerRef.current;
    if (!p?.animationState) return;
    const entry = p.animationState.getCurrent(0);   // T5: → getTrack(0)
    if (!entry) return;
    p.pause();                                       // KEEP (pause-on-scrub)
    const duration = entry.animation.duration;
    const targetTime = duration * percentage;
    const delta = targetTime - p.playTime;           // ← L673 p.playTime is PRIVATE (TS2341)
    p.animationState.update(delta);                  // KEEP (existing seek seq)
    p.animationState.apply(p.skeleton);              // T8: null-guard p.skeleton
    p.skeleton.update(delta);                        // T8: null-guard
    p.skeleton.updateWorldTransform(2);              // KEEP literal 2 (CLAUDE.md fact #3)
    p.playTime = targetTime;                         // ← L680 p.playTime PRIVATE write (TS2341)
    setScrubPercent(percentage);                     // KEEP (scrubPercent = UI source of truth)
    setIsPaused(true);                               // KEEP (pause-on-scrub)
  }, []);
```
→ Recommended minimal rework (RESEARCH D-05 T6 + Pitfall 5): drive the seek
from `entry` instead of the private `p.playTime`. `scrubPercent` React state is
already the UI source of truth, so compute `targetTime = entry.animation.duration
* percentage`, take the delta base from `entry.trackTime`
(`TrackEntry.d.ts:271`, the closest analog to old `p.playTime`) instead of
`p.playTime`, and **drop the `p.playTime = targetTime` write-back**. Keep
`p.pause()`, `setIsPaused(true)`, the existing `animationState.update(delta)/
apply` + `skeleton.update/updateWorldTransform(2)` sequence, and the literal
`2`. **No `(p as any).playTime` cast** (latent break + code-review reject —
RESEARCH "Don't Hand-Roll"). This is the item the D-02 owner UAT #2
(forward AND backward scrub synchrony) is the only valid acceptance gate for.

**T7 — `+ preserveDrawingBuffer: false`** in the `SpinePlayerConfig` literal
(context L457-473, the straight-alpha block — see GL section below). Add
`preserveDrawingBuffer: false` to the config object (`Player.d.ts:72` makes it
required in 4.3.0; `false` matches the pre-bump effective default). `tsc`
TS2741 at (457,13).

**T8 — `skeleton`/`animationState` null-guards** at L549,550,563,564,675,676,
679. Add `if (!p.skeleton) return;` / optional chaining at the flagged sites
(the `success` callback runs post-load so `p.skeleton` is non-null there; the
type just got stricter — `Player.d.ts:125-126`).

**Stable touchpoints (S1-S13, RESEARCH D-05 lines 184-196) — DO NOT edit**:
`new Skeleton(data)`, `getBounds`, `Skeleton.update`,
`updateWorldTransform(Physics)`, `skin?.name`, `SkeletonData.find*`,
`AnimationState.update/apply`, `setAnimation`, `play/pause/dispose`,
`sceneRenderer/camera/canvas`, the fixed `config.viewport` dummy, atlas
parent-dir resolution, the swallow-constructor-throw try/catch. These are
API-stable; S10-S13 are render-behavior touchpoints verified only by the
D-02 owner UAT (compiles ≠ renders-identically across a Pose-rewrite major).

---

### `tests/renderer/animation-player-modal.spec.tsx` (test, request-response — LOCKSTEP)

**Analog:** itself + RESEARCH.md Pattern 2 (research lines 264-268) +
Pitfall 2 (lines 330-334), which name every stale-4.2 line. **This MUST migrate
in the same change as the modal** — a stale mock green-washes a broken modal
(`feedback_verify_all_entrypoint_runtimes` class: testing against a fiction).

**Mock entry point** (L68 — `vi.mock` hoisted above imports; the factory
writes to a `globalThis` sink because it can't close over module scope):
```ts
vi.mock('@esotericsoftware/spine-player', () => {
```

**Stale-4.2 surface to migrate (3 distinct locations):**

1. The hoisted-factory mock `Skeleton` class + module exports (L85-110):
```ts
  class Skeleton {
    data: unknown;
    skin: { name: string } | null = null;
    constructor(data: unknown) { this.data = data; }
    setSkinByName(): void {}        // ← L91 → setSkin(): void {}
    setSlotsToSetupPose(): void {}  // ← L92 → setupPoseSlots(): void {}
    setToSetupPose(): void {}       // ← L93 → setupPose(): void {}
    updateWorldTransform(): void {}
    getBounds(off, size) { off.x = 0; off.y = 0; size.x = 100; size.y = 100; }
  }
  return {
    SpinePlayer, Skeleton, Vector2,
    MixBlend: { setup: 0 },         // ← L106 DROP (removed in 4.3.0)
    MixDirection: { mixIn: 0 },     // ← L107 DROP (removed in 4.3.0)
    Physics: { update: 2 },         // KEEP (Physics still exported)
  };
```

2. `defaultSpinePlayerImpl` mock player object (L126-156) — the per-instance
spied surface:
```ts
  const player: any = {
    dispose: vi.fn(), play: vi.fn(), pause: vi.fn(), setAnimation: vi.fn(),
    playTime: 0,                    // ← L131 (T6: modal no longer reads/writes playTime;
                                    //   drop or leave inert — keep `time`/track surface instead)
    paused: false,
    skeleton: {
      data: { animations: [...], skins: [...], findAnimation: vi.fn(...) },
      setSkinByName: vi.fn(),       // ← L143 → setSkin: vi.fn()
      setSlotsToSetupPose: vi.fn(), // ← L144 → setupPoseSlots: vi.fn()
      update: vi.fn(), updateWorldTransform: vi.fn(),
    },
    animationState: {
      getCurrent: vi.fn(() => ({ animation: { duration: 1, name: 'idle' }, loop: true })),  // ← L149
                                    //   → getTrack: vi.fn(() => ({ animation: {duration:1,name:'idle'}, trackTime: 0 }))
      update: vi.fn(), apply: vi.fn(),
    },
  };
```

3. `errorSpinePlayerImpl` mock player object (L305-325) — the SAME renames
apply: `setSkinByName`→`setSkin` (L315), `setSlotsToSetupPose`→`setupPoseSlots`
(L316), `getCurrent`→`getTrack` (L321 → `getTrack: vi.fn(() => null)`),
`playTime` (L311). RESEARCH Pattern 2 cites L85-156; this second impl block at
L305-325 mirrors it and must migrate identically (verified: 2 impl blocks, not 1).

**Call-order assertion** (L594-615 — asserts the OLD contract; must flip):
```ts
  it('skin onChange calls setSkinByName THEN setSlotsToSetupPose in that order', ...
    const setSkinByName = inst.player.skeleton.setSkinByName as ...      // ← L605 → setSkin
    const setSlotsToSetupPose = inst.player.skeleton.setSlotsToSetupPose  // ← L606 → setupPoseSlots
    ...
    expect(setSkinByName).toHaveBeenCalledWith('red');                   // ← L614 → setSkin
    expect(setSlotsToSetupPose).toHaveBeenCalledTimes(1);                // ← L615 → setupPoseSlots
```
→ rename the test title + the 4 references to `setSkin`/`setupPoseSlots` (the
migrated modal calls these; asserting the old names asserts a contract the
modal no longer has).

**Lockstep verification gate** (RESEARCH Test Map line 479):
`! grep -q "setSkinByName\|getCurrent\|MixBlend\|MixDirection" tests/renderer/animation-player-modal.spec.tsx`
must return true AFTER the migration (zero hits = no stale mirror).

---

### `.planning/phases/47-.../47-HUMAN-UAT.md` (NEW planning artifact, event-driven)

**Content analog:** `.planning/phases/41-spine-animation-viewer/41-HUMAN-UAT.md`
(the 5 carried tests are pre-written there — tests 2-6, verbatim re-run targets).
**Structural analog:** `.planning/phases/36-split-overrides-per-loader-mode/36-HUMAN-UAT.md`
(the richer *owner-signed* shape — Phase 41's is mid-verification `partial`;
Phase 36's is the completed `passed`/`approved_by` end-state this artifact must
reach for milestone close).

**Front-matter pattern** (copy `36-HUMAN-UAT.md` L1-9 — the signed-off shape;
Phase 41's L1-7 is the unsigned `partial` shape, do NOT copy that end-state):
```yaml
---
status: passed
phase: 47-spine-player-4-3-0-bump-viewer-regression
source: [47-VERIFICATION.md]
started: <date>
updated: <date>
approved_by: user
approved_at: <date>
---
```

**`## Setup` block pattern** (copy the SHAPE of `36-HUMAN-UAT.md` L13-19 — App
build / Fixtures / Reset-between-tests bullets). For Phase 47 the fixtures are
the D-09 pair: `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (4.2 GL-alpha canary)
+ `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (4.3 sibling); App build = `npm
run dev` (Electron dev app, not the installer — the migration lives in renderer
source).

**Per-test pattern — two valid shapes in-repo, pick one consistently:**
- `36-HUMAN-UAT.md` shape (richer, recommended for the owner-signed record):
  `### N. <title>` then **`setup:`** / **`expected:`** / **`why_human:`** /
  **`result:`** sub-blocks (see 36 L23-31).
- `41-HUMAN-UAT.md` shape (terser): `### N. <title>` then `expected:` /
  `result:` (+ `gaps:` block when blocked) (see 41 L15-53).

**Content to port (D-08): all 5 carried Phase 41 tests + the GL-alpha check.**
Copy the `expected:` prose **verbatim** from `41-HUMAN-UAT.md`:
- Test 2 = 41 L35-37 (VIEWER-05/06 anim/skin switch + scrub synchrony,
  forward AND backward — the T6 acceptance gate).
- Test 3 = 41 L39-41 (VIEWER-08 GL leak ×10 cycles).
- Test 4 = 41 L43-45 (VIEWER-09 real-fs malformed/missing-asset terminal
  error UI).
- Test 5 = 41 L47-49 (VIEWER-04 atlas-less visual parity).
- Test 6 = 41 L51-53 (File-menu auto-suppression contract).
- **+ a new GL straight-alpha test** (not in 41's pending list — it was
  *resolved* there as G-03; Phase 47 must *re-verify* it on the 4.3 player).
  Author it from RESEARCH.md "GL Straight-Alpha" section (research lines
  289-320) "Concrete empirical re-verification method": render
  `SIMPLE_TEST.json` + `skeleton2.json`, look for white/dark halo on
  mesh-attachment edges vs `#232732` bg, pass = clean edges identical to
  v1.5.1 framing (D-06 same-framing parity). Capture a screenshot in the file
  so the observation is durable.
- **+ the D-09 render pair** as an explicit test: both
  `SIMPLE_TEST.json` (4.2) and `skeleton2.json` (4.3) render correctly through
  the 4.3 player (PLAYER-02 SC#1).

**`## Summary` block** (copy 41 L55-62 / 36 has none — use the 41 counter
shape): `total:` / `passed:` / `issues:` / `pending:` / `skipped:` /
`blocked:`. For milestone close all must be `passed`.

---

### `.planning/phases/41-.../41-HUMAN-UAT.md` — in-place flip of 5 pending → resolved (planning artifact, transform)

**Analog:** the SAME file's already-present resolved-marker pattern. Test 1's
`gaps:` block (L18-33) shows the exact `status: resolved` + `fixed_in: <sha>
<msg>` convention this phase reuses for the pointer:
```yaml
  - id: G-03
    severity: blocking
    summary: After the load completed, transparent border pixels ...
    status: resolved
    fixed_in: b40b338 fix(41): use straight-alpha blending in SpinePlayer ...
```

**Edit pattern (D-08):** for each of tests 2-6, change `result: [pending]`
(41 L37,41,45,49,53) → `result: resolved` (or `passed`) **with a Phase 47
pointer** mirroring the `fixed_in:`-style provenance line, e.g.
`result: resolved — re-run on the 4.3 player in Phase 47; see
47-HUMAN-UAT.md test N (owner-signed <date>)`. Also update the `## Current
Test` line (41 L9-11, currently `[items 2, 3, 4, 5, 6 still pending ...]`) and
the `## Summary` counters (41 L57-62: `passed: 1`→`6`, `pending: 5`→`0`).
**Preserve the Phase 41 audit trail** — do not delete the original
`expected:` prose or the test-1 `gaps:` block; only flip status + add the
forward pointer (the whole point of D-08 is keeping both records).

---

### Plan task: owner live-UAT `checkpoint:human-action` (plan-task pattern, event-driven)

**Analog:** `.planning/phases/46-slider-constraint-validation-4-3-performance-budget/46-01-PLAN.md`
Task 2 (L164-194) — the most recent completed phase; the same owner-action
class (a human reading something a machine cannot produce, gating phase
completion). CONTEXT "Established Patterns" explicitly cites this: "Phase 46
just used this pattern ... worktree isolation is incompatible with an
owner-action checkpoint (Phase 46 ran sequential on the main tree for exactly
this reason)".

**Exact task-block skeleton to copy** (from `46-01-PLAN.md` L164-194 — the
XML structure, attributes, and required sub-elements):
```xml
<task type="checkpoint:human-action" gate="blocking">
  <name>Task N: OWNER — <imperative>...</name>
  <files><the artifact the owner produces/signs></files>
  <read_first>
    - <the in-phase spec the owner follows — for Phase 47: 47-HUMAN-UAT.md>
  </read_first>
  <action>
This is a `checkpoint:human-action` — it has NO CLI/API equivalent. It requires
a human <doing the un-automatable thing>. Claude cannot automate this — pause
and present the steps below to the owner, then resume on the owner's signal.

WHAT WAS BUILT: <the artifact a prior auto task produced for the owner to use>.

OWNER STEPS:
1. ...
N. ...

RESUME SIGNAL: the owner types "done" once <the precise completion condition>.
  </action>
  <verify>
    <automated><a grep/test -f the machine CAN run to confirm the artifact exists/parses></automated>
  </verify>
  <acceptance_criteria>
    - <file exists>
    - <content predicate>
  </acceptance_criteria>
  <done><one-line completion statement></done>
</task>
```

**Phase 47 specialization (Claude's discretion under D-02; the planner fills
this in):**
- `<name>`: OWNER — run the real Electron app and execute all 5 carried Phase
  41 UATs + the GL straight-alpha SIMPLE_TEST/skeleton2 check, sign every one
  in `47-HUMAN-UAT.md`.
- `<files>`: `.planning/phases/47-.../47-HUMAN-UAT.md` (+ the in-place flip of
  `41-HUMAN-UAT.md` per D-08).
- `<read_first>`: the `47-HUMAN-UAT.md` authored by the preceding auto task
  (mirrors how 46 Task 2 reads the `46-OWNER-EXPORT-SPEC.md` Task 1 produced).
- `<action>` OWNER STEPS: `npm run dev`; load `SIMPLE_TEST.json`; run UAT 2-6
  + the GL-alpha + D-09 pair per `47-HUMAN-UAT.md`; capture the GL-alpha
  screenshot; mark each test `passed`/note any regression.
- `RESUME SIGNAL`: owner types "done" once every test in `47-HUMAN-UAT.md` is
  signed `passed` (or reports a regression).
- `<verify>` `<automated>`: e.g.
  `test -f .planning/phases/47-.../47-HUMAN-UAT.md && grep -qi 'approved_by: user' ... && ! grep -q 'result:\s*\[pending\]' ...`.
- **`gate="blocking"`** — per D-01 this gates v1.6 milestone close (the phase
  does not complete and the milestone does not close until the owner signs).
- **Placement:** AFTER the single atomic migration unit (bump + full modal +
  test mock) lands and `typecheck:web` is 0 / 11 suites GREEN — the machine
  half must be green before the owner runs the app (RESEARCH Pattern 1 / the
  two-track completion contract). Sequential on the main tree, NOT a worktree
  (CONTEXT: owner-action checkpoints are worktree-incompatible).

> Note the structural difference from 46: 46 Task 1 (auto) *authored a spec*
> and Task 2 (owner) *executed it*. Phase 47's analog: an auto task authors
> `47-HUMAN-UAT.md` (porting the 5 Phase 41 tests + GL-alpha + D-09 pair), then
> this `checkpoint:human-action` task is the owner *executing + signing* it.
> Same two-task author-then-owner-execute shape.

## Shared Patterns

### Single Atomic Migration Unit (cross-cutting — applies to package.json + modal + test mock)
**Source:** RESEARCH.md "Pattern 1" (research lines 258-262) + "Pattern 2"
(264-268).
**Apply to:** the bump, the 8-touchpoint modal migration, and the test-mock
migration — they land **together** (one commit or one tightly-ordered wave with
no green gate between). A partial state does not compile (`typecheck:web`
non-zero) and does not un-RED the 11 suites; there is no meaningful
intermediate "green" checkpoint. The lockstep test-mock migration is a
*required co-task inside this unit*, not a follow-up (RESEARCH Wave 0 Gaps).

### Exact-Pin Spine Dependency Convention
**Source:** `package.json` L26 (`spine-core: "4.3.0"`), L35 (the
`spine-core-42` alias) — CONTEXT "Established Patterns"; STACK.md.
**Apply to:** the spine-player bump — exact `"4.3.0"`, no caret/range,
sibling-aligned to the canonical spine-core. This is a codebase convention, not
a decision point.

### GL Straight-Alpha: Land Config UNCHANGED, Owner Verifies (the hard floor)
**Source:** RESEARCH.md "GL Straight-Alpha" (research lines 289-320) +
`AnimationPlayerModal.tsx` config block L457-473.
**Apply to:** the modal config (T7 only adds `preserveDrawingBuffer: false`;
`premultipliedAlpha:false`/`alpha:false` stay **unchanged**) + the
`47-HUMAN-UAT.md` GL-alpha test + the owner checkpoint. The 4.3.0 mechanism
*moved* (`setBlendMode`'s pma arg deleted → decision now at `GLTexture`
`UNPACK_PREMULTIPLY_ALPHA_WEBGL = !pma`); the modal comment at L469
("`Player.js:13167`") and `41-HUMAN-UAT.md` G-03 cite the now-deleted 4.2
mechanism. **Do NOT preemptively change the alpha config** (RESEARCH
Anti-Pattern + Pitfall 3); only change it if the owner observes a halo AND the
verified 4.3.0 pipeline explains it. `scripts/pma-probe.mjs` does NOT cover
this GL path (different stack — `project_pma_no_op_in_current_stack` does not
transfer); the owner's eyes on the rendered canvas, screenshotted into
`47-HUMAN-UAT.md`, is the only valid evidence.

### Minimal CSP/CORS — Touch Nothing (security guardrail)
**Source:** RESEARCH.md "Pitfall 4" (research lines 342-346) + S12 audit
(line 195).
**Apply to:** `src/renderer/index.html:7` (`connect-src 'self' app-image:`) and
the main-process `app-image://` ACAO header — **zero diff**. The S12 audit
verified 4.3.0 uses the same parent-relative `AssetManager`/`rawDataURIs`
model; broadening any directive is a security regression. The plan must NOT
include a "verify/adjust CSP" task that proposes a widened directive.

### Two-Track Completion Contract (phase-gate shape)
**Source:** CONTEXT D-01/D-02 + RESEARCH.md "Validation Architecture" (research
lines 459-497).
**Apply to:** the phase plan's wave/gate structure. Track 1 (machine):
`typecheck:web` 0 (from 22) + 11 renderer suites GREEN + `npm test` no new
failures + `! grep -rq "MixBlend\|MixDirection" src/`. Track 2 (human): the
D-02 owner `checkpoint:human-action`. **Both** true before v1.6 closes (D-01,
no revert fallback). `typecheck:node` is **pre-existingly RED**
(`project_typecheck_node_preexisting_red`) — prove via `git diff --name-only`
it did not *worsen*, do not require it clean; post-merge build gate uses
`typecheck:web`, not `npm run build` (electron-builder).

## No Analog Found

None. Every file in this phase is either an in-place edit of an existing file
(its own current 4.2 shape + RESEARCH.md's verified 4.3 shape is the pattern)
or a new planning artifact with a strong in-repo structural model (Phase
41/36 HUMAN-UAT; Phase 46 `checkpoint:human-action` task). RESEARCH.md is
HIGH-confidence with verified `.d.ts`-line citations and exact `tsc` error
coordinates — the planner copies migrated code from RESEARCH.md D-04/D-05
directly; no RESEARCH-pattern fallback (the usual "no analog" escape hatch) is
needed for any file.

## Metadata

**Analog search scope:**
`src/renderer/src/modals/`, `tests/renderer/`, `tests/setup/`,
`.planning/phases/{41,46,36}/`, `package.json`, `vitest.config.ts`.
**Files scanned:** ~14 (modal targeted ranges L40-59/L210-299/L455-479/
L662-683; spec targeted ranges L36-160/L300-329/L588-615; package.json full;
vitest.config.ts full; 41-HUMAN-UAT.md full; 36-HUMAN-UAT.md L1-40;
46-01-PLAN.md L91-223; RESEARCH.md targeted sections D-03/D-04/D-05/Patterns/
GL-alpha/Pitfalls/Code-Examples/Validation; CONTEXT.md full).
**Grep confirmations:** `MixBlend`/`MixDirection` exist in exactly 1 source
file (`AnimationPlayerModal.tsx`) + 1 test file
(`animation-player-modal.spec.tsx`) — confirms RESEARCH A4 (no second edit
site; the other 10 RED suites import the modal transitively and go GREEN for
free once it compiles).
**Pattern extraction date:** 2026-05-18

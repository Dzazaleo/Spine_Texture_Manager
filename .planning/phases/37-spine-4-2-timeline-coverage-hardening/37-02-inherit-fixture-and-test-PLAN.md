---
phase: 37-spine-4-2-timeline-coverage-hardening
plan: 02
type: execute
wave: 2
depends_on: [37-01]
files_modified:
  - fixtures/INHERIT_TIMELINE/INHERIT_TEST.json
  - fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas
  - fixtures/INHERIT_TIMELINE/INHERIT_TEST.png
  - tests/core/sampler.spec.ts
autonomous: true
requirements: [TIMELINE-03]
requirements_addressed: [TIMELINE-03]

must_haves:
  truths:
    - "fixtures/INHERIT_TIMELINE/INHERIT_TEST.json exists and parses as valid Spine 4.2 JSON via loadSkeleton without throwing"
    - "The fixture defines two animations: BASELINE (parent shrink, no InheritTimeline on CHILD) and INHERIT_DETACH (same parent shrink + InheritTimeline keying CHILD to Inherit.NoScale at the shrink-peak frame, back to Normal at end)"
    - "tests/core/sampler.spec.ts contains an it() block named 'TIMELINE-03 InheritTimeline NoScale detach — peak > inheriting baseline' that runs the full sampler lifecycle at the default 120 Hz on both animations and asserts strict peak(detached) > peak(baseline) on the CHILD_SLOT region peak"
    - "Sampler captures the scale difference when InheritTimeline detaches a child from parent shrink (peak detached > peak baseline) — proves the locked sampler lifecycle (state.update → state.apply → skeleton.update → updateWorldTransform) propagates the bone.inherit mutation correctly"
    - "D-03: fixtures/INHERIT_TIMELINE/ ships atlas-source artifacts only (JSON + .atlas + .png mirroring the fixtures/SIMPLE_PROJECT/ pattern); no atlas-less parallel variant since InheritTimeline behavior is mode-invariant"
    - "D-04: test lands in tests/core/sampler.spec.ts per REQ TIMELINE-03, co-located with the existing N1.x sampler invariants and reusing the existing loadSkeleton + sampleSkeleton harness (no new test file)"
  artifacts:
    - path: "fixtures/INHERIT_TIMELINE/INHERIT_TEST.json"
      provides: "Minimal 3-bone rig (root, PARENT, CHILD) + 1 slot + 1 region attachment + 2 animations (BASELINE + INHERIT_DETACH)"
      contains: "INHERIT_DETACH"
    - path: "fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas"
      provides: "Single-region atlas matching INHERIT_TEST.json's REGION attachment"
      contains: "REGION"
    - path: "fixtures/INHERIT_TIMELINE/INHERIT_TEST.png"
      provides: "Placeholder PNG bytes (math phase does not decode per CLAUDE.md fact #4)"
    - path: "tests/core/sampler.spec.ts"
      provides: "TIMELINE-03 it() block + INHERIT_FIXTURE const"
      contains: "TIMELINE-03 InheritTimeline NoScale detach"
  key_links:
    - from: "tests/core/sampler.spec.ts (TIMELINE-03 block)"
      to: "fixtures/INHERIT_TIMELINE/INHERIT_TEST.json"
      via: "INHERIT_FIXTURE const + loadSkeleton(INHERIT_FIXTURE)"
      pattern: "INHERIT_FIXTURE"
    - from: "tests/core/sampler.spec.ts (TIMELINE-03 assertion)"
      to: "src/core/sampler.ts (sampleSkeleton hot loop)"
      via: "sampleSkeleton().globalPeaks Map lookup for CHILD_SLOT/REGION key"
      pattern: "sampleSkeleton"
---

<objective>
Create the on-disk InheritTimeline fixture (JSON + atlas + placeholder PNG) under `fixtures/INHERIT_TIMELINE/` and add a sampler unit test that asserts `peak(detached) > peak(baseline)` strict. This locks the regression contract proving the sampler's `state.apply → bone.inherit mutation → updateWorldTransform` lifecycle correctly handles InheritTimeline's `Inherit.NoScale` toggle on a child bone whose parent shrinks during animation.

Per CONTEXT.md D-01 (TIMELINE-02 conditional escalation TRIGGERED — InheritTimeline.apply writes bone.inherit at Animation.js:755, and Bone.js:144 `switch (this.inherit)` reads it during updateWorldTransform), the assertion direction is locked to `peak(detached) > peak(baseline)` strict — load-bearing real-risk gap fix, NOT precautionary invariance lock.

Purpose: Closes REQ TIMELINE-03 by providing a fixture-driven, sampler-lifecycle-exercising test that catches any future regression where the InheritTimeline tick is dropped from `state.apply` or the bone.inherit readback breaks in `updateWorldTransform`.

Output:
- `fixtures/INHERIT_TIMELINE/INHERIT_TEST.json` — 3-bone rig (root/PARENT/CHILD), 1 slot (CHILD_SLOT), 1 region (REGION 100x100), 2 animations (BASELINE shrinks parent; INHERIT_DETACH shrinks parent + keys CHILD to Inherit.NoScale at mid-frame)
- `fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas` — single-region atlas, REGION 100x100
- `fixtures/INHERIT_TIMELINE/INHERIT_TEST.png` — placeholder PNG (copy of SIMPLE_TEST.png per PATTERNS.md S5 recommendation)
- `tests/core/sampler.spec.ts` — new `INHERIT_FIXTURE` const + `TIMELINE-03` it() block inside the existing `describe('sampler — sampleSkeleton (...)', ...)` describe (or a co-located sibling describe)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/37-spine-4-2-timeline-coverage-hardening/37-CONTEXT.md
@.planning/phases/37-spine-4-2-timeline-coverage-hardening/37-PATTERNS.md
@.planning/phases/37-spine-4-2-timeline-coverage-hardening/37-01-SUMMARY.md
@fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json
@fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas
@tests/core/sampler.spec.ts
@src/core/sampler.ts
@src/core/loader.ts

<interfaces>
<!-- Test harness — already imported in tests/core/sampler.spec.ts:30-38 -->
From src/core/loader.ts:
```typescript
export function loadSkeleton(fixturePath: string): LoadResult;
```

From src/core/sampler.ts:
```typescript
export const DEFAULT_SAMPLING_HZ = 120;
export interface PeakRecord {
  peakScale: number;
  peakScaleX: number;
  peakScaleY: number;
  worldW: number;
  worldH: number;
  time: number;
  animationName: string;
  attachmentName: string;
  // (plus other fields — see existing usages in tests/core/sampler.spec.ts)
}
export function sampleSkeleton(load: LoadResult, opts?: { samplingHz?: number }): {
  globalPeaks: Map<string, PeakRecord>;
  // (plus other fields)
};
```

From node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js lines 711-718 (InheritTimeline JSON parse path — confirms the JSON shape we must produce):
```javascript
else if (timelineName === "inherit") {
    let timeline = new InheritTimeline(frames, bone.index);
    for (let frame = 0; frame < timelineMap.length; frame++) {
        let aFrame = timelineMap[frame];
        timeline.setFrame(frame, getValue(aFrame, "time", 0), Utils.enumValue(Inherit, getValue(aFrame, "inherit", "Normal")));
    }
    timelines.push(timeline);
}
```

Valid `Inherit` enum string values (per Bone.js Inherit enum referenced at lines 145/158/167/196/197/271/279/288): `Normal`, `OnlyTranslation`, `NoRotationOrReflection`, `NoScale`, `NoScaleOrReflection`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create fixtures/INHERIT_TIMELINE/ directory + INHERIT_TEST.json (3-bone rig + 2 animations)</name>
  <files>fixtures/INHERIT_TIMELINE/INHERIT_TEST.json</files>
  <read_first>
    - fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json (read in full — confirm the skeleton/bones/slots/skins/animations top-level shape and the SQUARE2 scale-animation pattern at lines 201-207 which is the down-up shrink template we are mirroring)
    - .planning/phases/37-spine-4-2-timeline-coverage-hardening/37-PATTERNS.md section 3 (the full "Pattern Assignments → file 3" section — substitution values for skeleton block, bones, slots, skins, animations)
    - .planning/phases/37-spine-4-2-timeline-coverage-hardening/37-CONTEXT.md DC-02 (rig mechanics: parent scaleX/scaleY ramps 1.0 -> 0.4 -> 1.0; child InheritTimeline keys Inherit.NoScale at mid-frame then Normal)
    - node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js (read lines 700-730 — confirm the InheritTimeline JSON parse path and the per-bone "inherit" field shape)
  </read_first>
  <action>
**Step A — Create the fixture directory.** Using the Bash tool:

```bash
mkdir -p fixtures/INHERIT_TIMELINE
```

**Step B — Write `fixtures/INHERIT_TIMELINE/INHERIT_TEST.json`.** Use the Write tool with the following EXACT content (this is the complete file, no placeholders — copy verbatim):

```json
{
"skeleton": {
	"hash": "INHERIT_42",
	"spine": "4.2.43",
	"x": -100,
	"y": -100,
	"width": 400,
	"height": 400,
	"images": "./IMAGES/",
	"audio": "./audio"
},
"bones": [
	{ "name": "root" },
	{ "name": "PARENT", "parent": "root", "x": 0, "y": 0 },
	{ "name": "CHILD", "parent": "PARENT", "length": 100, "x": 50, "y": 0 }
],
"slots": [
	{ "name": "CHILD_SLOT", "bone": "CHILD", "attachment": "REGION" }
],
"skins": [
	{
		"name": "default",
		"attachments": {
			"CHILD_SLOT": {
				"REGION": { "width": 100, "height": 100 }
			}
		}
	}
],
"animations": {
	"BASELINE": {
		"bones": {
			"PARENT": {
				"scale": [
					{ "x": 1.0, "y": 1.0 },
					{ "time": 0.5, "x": 0.4, "y": 0.4 },
					{ "time": 1.0, "x": 1.0, "y": 1.0 }
				]
			}
		}
	},
	"INHERIT_DETACH": {
		"bones": {
			"PARENT": {
				"scale": [
					{ "x": 1.0, "y": 1.0 },
					{ "time": 0.5, "x": 0.4, "y": 0.4 },
					{ "time": 1.0, "x": 1.0, "y": 1.0 }
				]
			},
			"CHILD": {
				"inherit": [
					{ "time": 0.0, "inherit": "Normal" },
					{ "time": 0.5, "inherit": "NoScale" },
					{ "time": 1.0, "inherit": "Normal" }
				]
			}
		}
	}
}
}
```

**Rationale (do not include in the file — for executor understanding):**
- 3 bones: `root` (skeleton-required), `PARENT` (will shrink), `CHILD` (region-bearer, inherits parent scale at setup by virtue of having no `"inherit"` field in BoneData, which defaults to `Normal` per SkeletonJson.js:94).
- 1 slot `CHILD_SLOT` on `CHILD` with attachment `REGION`.
- 1 region attachment `REGION` (100x100; sampler computes world-AABB from atlas-bounds source + bone transforms; PNG bytes irrelevant per CLAUDE.md fact #4).
- 2 animations:
  - `BASELINE`: parent scales 1.0 -> 0.4 -> 1.0 (shrink-and-recover). CHILD inherits Normal throughout. CHILD's world scale tracks PARENT's; peak ~ 1.0 (start/end frames, NOT the shrink frame).
  - `INHERIT_DETACH`: same parent shrink + CHILD has an InheritTimeline keying `Normal` -> `NoScale` (at time=0.5, exactly the parent's shrink-peak frame) -> `Normal` (at time=1.0). At time=0.5 the CHILD is detached from parent scale -> CHILD's world scale = 1.0 even while parent scales to 0.4. Without detach, CHILD's world scale at time=0.5 would be 0.4. With detach, CHILD's world scale at time=0.5 is 1.0. The sampler captures the per-tick peak; peak(INHERIT_DETACH) at CHILD_SLOT/REGION > peak(BASELINE) at the same key. The difference is purely the InheritTimeline tick.

**Step C — Validate the JSON parses.** Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('fixtures/INHERIT_TIMELINE/INHERIT_TEST.json','utf8'))"
```

Exit code must be 0. If it fails, fix the JSON syntax and re-validate.

Per CONTEXT.md D-03/D-04: the fixture follows the `fixtures/SIMPLE_PROJECT/` pattern (JSON + .atlas + .png in a same-named directory) and lands the test in `tests/core/sampler.spec.ts` per REQ TIMELINE-03.
  </action>
  <verify>
    <automated>test -f fixtures/INHERIT_TIMELINE/INHERIT_TEST.json &amp;&amp; node -e "JSON.parse(require('fs').readFileSync('fixtures/INHERIT_TIMELINE/INHERIT_TEST.json','utf8'))" &amp;&amp; node -e "const j=JSON.parse(require('fs').readFileSync('fixtures/INHERIT_TIMELINE/INHERIT_TEST.json','utf8')); if (!j.animations.BASELINE) process.exit(1); if (!j.animations.INHERIT_DETACH) process.exit(2); if (!j.animations.INHERIT_DETACH.bones.CHILD.inherit) process.exit(3); if (j.animations.INHERIT_DETACH.bones.CHILD.inherit[1].inherit !== 'NoScale') process.exit(4); if (j.bones.length !== 3) process.exit(5); if (j.slots.length !== 1) process.exit(6); console.log('OK');"</automated>
  </verify>
  <acceptance_criteria>
    - `test -f fixtures/INHERIT_TIMELINE/INHERIT_TEST.json` exits 0
    - `node -e "JSON.parse(require('fs').readFileSync('fixtures/INHERIT_TIMELINE/INHERIT_TEST.json','utf8'))"` exits 0 (valid JSON)
    - The parsed JSON has `animations.BASELINE` (verified by node check)
    - The parsed JSON has `animations.INHERIT_DETACH.bones.CHILD.inherit` (the InheritTimeline JSON block)
    - The InheritTimeline keyframe at index 1 has `"inherit": "NoScale"` (the detached-frame key)
    - The skeleton has exactly 3 bones (root, PARENT, CHILD) and exactly 1 slot (CHILD_SLOT)
    - `grep -q '"hash": "INHERIT_42"' fixtures/INHERIT_TIMELINE/INHERIT_TEST.json` exits 0
    - `grep -q '"spine": "4.2.43"' fixtures/INHERIT_TIMELINE/INHERIT_TEST.json` exits 0
    - `grep -q '"INHERIT_DETACH"' fixtures/INHERIT_TIMELINE/INHERIT_TEST.json` exits 0
    - `grep -q '"BASELINE"' fixtures/INHERIT_TIMELINE/INHERIT_TEST.json` exits 0
  </acceptance_criteria>
  <done>
On-disk fixture JSON exists, parses as valid JSON, declares Spine 4.2.43, contains 3 bones + 1 slot + 1 skin with REGION attachment + 2 animations (BASELINE + INHERIT_DETACH), and the INHERIT_DETACH animation contains a per-bone `"inherit"` timeline on CHILD with mid-frame `"NoScale"` keyframe matching the SkeletonJson.js:711-718 parse contract.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create INHERIT_TEST.atlas + INHERIT_TEST.png placeholder bytes</name>
  <files>fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas, fixtures/INHERIT_TIMELINE/INHERIT_TEST.png</files>
  <read_first>
    - fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas (read all 10 lines — the analog atlas-text format reference)
    - .planning/phases/37-spine-4-2-timeline-coverage-hardening/37-PATTERNS.md sections 4 + 5 (atlas text shape; PNG copy recommendation — Approach 1)
    - CLAUDE.md fact #4 (math phase does not decode PNGs — placeholder bytes are sufficient)
  </read_first>
  <action>
**Step A — Write `fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas`.** Use the Write tool with the following EXACT content (no leading blank line; trailing newline is fine):

```
INHERIT_TEST.png
size:128,128
filter:Linear,Linear
REGION
bounds:2,2,100,100
```

Format spec: header `<png-filename>` + `size:W,H` + `filter:Min,Mag`; per-region `<name>` + `bounds:x,y,w,h`. No `rotate:` field needed (default false; rotated-region hard-fails at errors.ts:154 — we don't exercise that here). Single region named `REGION`, 100x100, matching the attachment dimensions declared in `INHERIT_TEST.json`.

**Step B — Copy `SIMPLE_TEST.png` to `INHERIT_TEST.png` as the placeholder.** Per PATTERNS.md S5 Approach 1 (recommended over the minimal-1x1 alternative — diff-friendly, no image-tooling dependency). Use the Bash tool:

```bash
cp fixtures/SIMPLE_PROJECT/SIMPLE_TEST.png fixtures/INHERIT_TIMELINE/INHERIT_TEST.png
```

The PNG bytes are irrelevant to the sampler (CLAUDE.md fact #4: math phase does not decode PNGs; atlas-bounds drive source dims).

**Step C — Verify both files exist.** Run:

```bash
test -f fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas && test -f fixtures/INHERIT_TIMELINE/INHERIT_TEST.png
```
  </action>
  <verify>
    <automated>test -f fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas &amp;&amp; test -f fixtures/INHERIT_TIMELINE/INHERIT_TEST.png &amp;&amp; grep -q '^INHERIT_TEST.png$' fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas &amp;&amp; grep -q '^size:128,128$' fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas &amp;&amp; grep -q '^REGION$' fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas &amp;&amp; grep -q '^bounds:2,2,100,100$' fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas</automated>
  </verify>
  <acceptance_criteria>
    - `test -f fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas` exits 0
    - `test -f fixtures/INHERIT_TIMELINE/INHERIT_TEST.png` exits 0
    - `grep -q '^INHERIT_TEST.png$' fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas` exits 0 (atlas references the local PNG by name)
    - `grep -q '^size:128,128$' fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas` exits 0 (page-size declaration present)
    - `grep -q '^filter:Linear,Linear$' fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas` exits 0 (filter declaration present)
    - `grep -q '^REGION$' fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas` exits 0 (region name)
    - `grep -q '^bounds:2,2,100,100$' fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas` exits 0 (100x100 region bounds match the JSON attachment width/height)
    - `! grep -q 'rotate' fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas` exits 0 (no rotated-region field — would hard-fail per errors.ts:154)
    - `wc -c < fixtures/INHERIT_TIMELINE/INHERIT_TEST.png` outputs > 100 (PNG copy is not empty; SIMPLE_TEST.png is ~42 KB)
  </acceptance_criteria>
  <done>
`fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas` exists with the single-region declaration matching the JSON attachment dimensions. `fixtures/INHERIT_TIMELINE/INHERIT_TEST.png` exists as a verbatim copy of `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.png`. No `rotate:` field in the atlas (avoids the hard-fail at errors.ts:154). Loader can find all three artifacts when given `fixtures/INHERIT_TIMELINE/INHERIT_TEST.json` as the entry point.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add TIMELINE-03 it() block + INHERIT_FIXTURE const to tests/core/sampler.spec.ts</name>
  <files>tests/core/sampler.spec.ts</files>
  <read_first>
    - tests/core/sampler.spec.ts (read lines 1-260 — confirm imports, the FIXTURE const pattern at line 40, the describe block at line 44, and the N1.4 differential-test template at lines 108-142; PATTERNS.md section 6 cites these as the templates we mirror)
    - tests/core/sampler.spec.ts (read lines 340-360 — confirm the existing `perAnimationPeaks` helper shape inside the `describe('sampler — numeric goldens', ...)` block at line 315; we will define a new INHERIT-scoped variant inline to keep this test self-contained)
    - .planning/phases/37-spine-4-2-timeline-coverage-hardening/37-PATTERNS.md section 6 + S1 + S2 (FIXTURE const pattern, differential-test commentary style)
    - .planning/phases/37-spine-4-2-timeline-coverage-hardening/37-CONTEXT.md DC-02 (assertion direction: peak(detached) > peak(baseline) strict)
    - fixtures/INHERIT_TIMELINE/INHERIT_TEST.json (the fixture we created in Task 1 — confirm the animation names BASELINE / INHERIT_DETACH and the slot name CHILD_SLOT match what the test references)
  </read_first>
  <behavior>
    - Test 1 (TIMELINE-03): With the fixture loaded, running the sampler at default 120 Hz on the INHERIT_DETACH animation produces a strictly larger peakScale for the CHILD_SLOT/REGION key than the same sampler run on the BASELINE animation. Both runs use the locked sampler lifecycle (state.update -> state.apply -> skeleton.update -> updateWorldTransform).
    - Edge / regression guard: If state.apply did not tick InheritTimeline (or Bone.updateLocalToWorld did not read this.inherit), peak(detached) would equal peak(baseline). The strict `>` assertion fails in that case — surfaces a real sampler bug.
  </behavior>
  <action>
**Step A — Add the INHERIT_FIXTURE const.** Use the Edit tool to insert a new const declaration immediately after line 40 (`const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');`). The exact edit target is:

Find:
```typescript
const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const SAMPLER_SRC = path.resolve('src/core/sampler.ts');
```

Replace with:
```typescript
const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const INHERIT_FIXTURE = path.resolve('fixtures/INHERIT_TIMELINE/INHERIT_TEST.json');
const SAMPLER_SRC = path.resolve('src/core/sampler.ts');
```

**Step B — Add the TIMELINE-03 it() block.** Use the Edit tool to insert a new `it()` block inside the existing `describe('sampler — sampleSkeleton (N1.1–N1.6, N2.1, N2.3)', () => { ... })` describe (starts at line 44). The describe block contains tests N1.1 through N1.6 and N2.1 / N2.3. Place the new TIMELINE-03 block AFTER the N1.6 determinism test (ends approximately line 256, immediately before the closing `});` of the describe block — verify exact line by reading the file in `read_first`).

Insert this complete `it()` block verbatim (do NOT abbreviate or paraphrase — copy the entire block including comments):

```typescript
  it('TIMELINE-03 InheritTimeline NoScale detach — peak > inheriting baseline', () => {
    // Fixture inspection: fixtures/INHERIT_TIMELINE/INHERIT_TEST.json has a 3-bone rig
    // (root -> PARENT -> CHILD) with a 100x100 REGION attachment on CHILD_SLOT, and
    // two animations:
    //   - BASELINE:       parent scaleX/Y ramps 1.0 -> 0.4 -> 1.0; CHILD inherits Normal
    //                     throughout (no InheritTimeline). CHILD's world scale tracks
    //                     PARENT's. Peak at start/end frames (~1.0), NOT the shrink frame.
    //   - INHERIT_DETACH: same parent shrink + a per-bone "inherit" timeline on CHILD
    //                     keying Inherit.Normal -> Inherit.NoScale -> Inherit.Normal at
    //                     times 0.0 / 0.5 / 1.0. At t=0.5 (parent shrunk to 0.4), CHILD
    //                     is detached -> CHILD's world scale remains ~1.0. Without detach
    //                     it would be 0.4. With detach, peak > baseline at the shrink
    //                     frame.
    //
    // What we exercise: full sampler lifecycle at default 120 Hz on both animations,
    // isolated via a per-animation filter (mirrors the perAnimationPeaks helper at
    // line ~349). The differential gate proves the sampler tick order
    // (state.update -> state.apply -> skeleton.update -> updateWorldTransform) propagates
    // the InheritTimeline-driven bone.inherit mutation (Animation.js:755) through the
    // updateLocalToWorld branch (Bone.js:144 `switch (this.inherit)`).
    //
    // If state.apply did NOT tick InheritTimeline, peak(detached) would equal
    // peak(baseline). Strict `>` therefore catches a real sampler regression.
    // (CONTEXT.md D-01: TIMELINE-02 conditional escalation TRIGGERED -> assertion is
    // peak(detached) > peak(baseline) strict, load-bearing.)
    const peaksForAnimation = (animationName: string): Map<string, PeakRecord> => {
      const scoped = loadSkeleton(INHERIT_FIXTURE);
      scoped.skeletonData.animations = scoped.skeletonData.animations.filter(
        (a) => a.name === animationName,
      );
      return sampleSkeleton(scoped).globalPeaks;
    };

    const baselinePeaks = peaksForAnimation('BASELINE');
    const detachedPeaks = peaksForAnimation('INHERIT_DETACH');

    const baselineChild = [...baselinePeaks.values()].find(
      (r) => r.attachmentName === 'REGION',
    );
    const detachedChild = [...detachedPeaks.values()].find(
      (r) => r.attachmentName === 'REGION',
    );

    expect(baselineChild, 'BASELINE must produce a REGION peak record').toBeDefined();
    expect(detachedChild, 'INHERIT_DETACH must produce a REGION peak record').toBeDefined();

    // Sanity: both runs return finite positive scales.
    expect(Number.isFinite(baselineChild!.peakScale)).toBe(true);
    expect(baselineChild!.peakScale).toBeGreaterThan(0);
    expect(Number.isFinite(detachedChild!.peakScale)).toBe(true);
    expect(detachedChild!.peakScale).toBeGreaterThan(0);

    // Load-bearing assertion (CONTEXT.md DC-02): peak(detached) > peak(baseline) strict.
    expect(detachedChild!.peakScale).toBeGreaterThan(baselineChild!.peakScale);
  });
```

**Step C — Run the test.** Use the Bash tool:

```bash
npm test -- tests/core/sampler.spec.ts
```

Expected: all existing tests still pass, plus the new TIMELINE-03 test passes.

**Step D — Failure-mode escalation note.** Per CONTEXT.md `<code_context>` line 90: if the TIMELINE-03 test fails (peak ≤ baseline at the detached frame), that is a real sampler bug — not a flaky test or a fixture issue. Per CLAUDE.md fact #3 + the Animation.js:755 mutation + the Bone.js:144 readback, the lifecycle SHOULD cover this case correctly. If the test fails after the JSON fixture has been hand-verified against SkeletonJson.js:711-718 (correctly-shaped InheritTimeline JSON block), STOP and report — Phase 37 scope expands to include the sampler fix.

**Step E — Per CLAUDE.md fact #5 (`core/` is pure TS, no DOM):** the test imports only from `src/core/*` (loader + sampler) — no DOM, no Electron, no React. Existing imports at lines 30-38 already cover everything; no new imports needed for TIMELINE-03 (the RGBA2Timeline import in Plan 37-03 is separate).
  </action>
  <verify>
    <automated>grep -q "INHERIT_FIXTURE = path.resolve('fixtures/INHERIT_TIMELINE/INHERIT_TEST.json')" tests/core/sampler.spec.ts &amp;&amp; grep -q "TIMELINE-03 InheritTimeline NoScale detach" tests/core/sampler.spec.ts &amp;&amp; grep -q "expect(detachedChild!.peakScale).toBeGreaterThan(baselineChild!.peakScale)" tests/core/sampler.spec.ts &amp;&amp; npm test -- tests/core/sampler.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "INHERIT_FIXTURE = path.resolve('fixtures/INHERIT_TIMELINE/INHERIT_TEST.json')" tests/core/sampler.spec.ts` exits 0 (const declared)
    - `grep -c "INHERIT_FIXTURE" tests/core/sampler.spec.ts` outputs a number >= 2 (const declaration + at least one usage in the test body)
    - `grep -q "TIMELINE-03 InheritTimeline NoScale detach — peak > inheriting baseline" tests/core/sampler.spec.ts` exits 0 (exact test name per CONTEXT.md `<specifics>`)
    - `grep -c "TIMELINE-03 InheritTimeline NoScale detach" tests/core/sampler.spec.ts` outputs exactly `1` (no duplicate insertion)
    - `grep -q "expect(detachedChild!.peakScale).toBeGreaterThan(baselineChild!.peakScale)" tests/core/sampler.spec.ts` exits 0 (load-bearing assertion present with strict `>`, not `>=` or `toBeCloseTo`)
    - `grep -q "Animation.js:755" tests/core/sampler.spec.ts` exits 0 (commentary cites the InheritTimeline mutation line per S2 commentary style)
    - `grep -q "Bone.js:144" tests/core/sampler.spec.ts` exits 0 (commentary cites the readback site)
    - `npm test -- tests/core/sampler.spec.ts` exits 0 (all sampler tests pass — existing N1.x / N2.x tests still green, plus the new TIMELINE-03 test passes)
    - `npm test -- tests/core/sampler.spec.ts 2>&amp;1 | grep -q "TIMELINE-03"` exits 0 (vitest output shows the new test ran, not just skipped)
  </acceptance_criteria>
  <done>
`tests/core/sampler.spec.ts` contains the new `INHERIT_FIXTURE` const (declared once at file scope adjacent to the existing `FIXTURE` const) and the new `it('TIMELINE-03 InheritTimeline NoScale detach — peak > inheriting baseline', ...)` block inside the existing top-level describe. The test loads the fixture, isolates each animation via per-animation filter, runs the full sampler lifecycle at default 120 Hz on both, finds the CHILD_SLOT/REGION peak record in each, and asserts strict `peak(detached) > peak(baseline)`. Vitest exits 0 with all sampler tests green including the new one.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

No trust boundaries crossed. This plan creates fixture data files (JSON + atlas + PNG copy) under `fixtures/INHERIT_TIMELINE/` and adds a single test block to `tests/core/sampler.spec.ts`. No production source (`src/`) is touched. No user input, no network, no auth.

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-37-02 | N/A | fixtures/INHERIT_TIMELINE/* + tests/core/sampler.spec.ts | accept | No production surface; threats N/A for fixture/test-only changes. Mitigation: code review covers the test additions and the fixture JSON shape (verified against SkeletonJson.js:711-718 parse contract in Task 1 read_first). |
</threat_model>

<verification>
1. JSON parse + structural checks confirm the fixture is well-formed Spine 4.2 JSON (Task 1 acceptance criteria).
2. Atlas + PNG file existence + grep gates confirm the placeholder assets are in place (Task 2 acceptance criteria).
3. `npm test -- tests/core/sampler.spec.ts` exits 0 — the new TIMELINE-03 test runs AND passes alongside all existing sampler tests (Task 3 acceptance criteria). The strict `>` assertion is the load-bearing gate that proves the sampler lifecycle propagates InheritTimeline's bone.inherit mutation correctly.
4. Commentary in the test block cites both `Animation.js:755` (the mutation) and `Bone.js:144` (the readback) — enabling future readers to trace from the test to the source-cited evidence in audit doc Item 7.
</verification>

<success_criteria>
- REQ TIMELINE-03 satisfied: minimal JSON fixture at `fixtures/INHERIT_TIMELINE/` toggles `inheritScale` true -> false -> true on a rotating child bone (modeled as `Inherit.Normal` -> `Inherit.NoScale` -> `Inherit.Normal`); a unit test in `tests/core/sampler.spec.ts` runs the full sampler lifecycle at default 120 Hz and asserts strict `peak(detached) > peak(baseline)`.
- No `src/core/` files touched. Sampler production code unchanged.
- All existing sampler tests (N1.1 through N1.6, N2.1, N2.3, GAP-FIX numeric goldens, D-53/54/55 per-animation breakdown extension, module hygiene) remain green.
- New TIMELINE-03 test passes — confirms the bone.inherit mutation propagates through the lifecycle as the source-read evidence in audit doc Item 7 predicts.
</success_criteria>

<output>
After completion, create `.planning/phases/37-spine-4-2-timeline-coverage-hardening/37-02-SUMMARY.md` per the standard summary template, capturing:
- Fixture artifacts created (paths + key JSON shape highlights)
- Test name + assertion direction (peak(detached) > peak(baseline) strict)
- Observed peak values from the test run (baseline + detached) for traceability if Plan 37-03 references them
- Confirmation that all existing sampler tests still pass alongside the new TIMELINE-03 test
</output>

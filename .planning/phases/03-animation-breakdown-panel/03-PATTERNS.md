# Phase 3: Animation Breakdown panel — Pattern Map

**Mapped:** 2026-04-23
**Files analyzed:** 14 (4 new + 10 modified)
**Analogs found:** 13 / 14 (bones.ts is the one net-new module with no pre-existing analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/bones.ts` (NEW) | core-pure | pure fold (Slot → string[]) | none — novel module | no analog |
| `src/core/sampler.ts` (MOD) | core-pure | locked tick-lifecycle fold | `src/core/sampler.ts` (self, pre-mod) | exact (in-place extension) |
| `src/core/analyzer.ts` (MOD) | core-pure | pure fold (Map → DisplayRow[]) | `src/core/analyzer.ts` (self, `analyze()` sibling) | exact |
| `src/shared/types.ts` (MOD) | shared IPC contract | type-only | `src/shared/types.ts` (self, `DisplayRow` + `SkeletonSummary`) | exact |
| `src/main/summary.ts` (MOD) | main-process projection | pure fold + IPC envelope writer | `src/main/summary.ts` (self) | exact |
| `src/renderer/src/App.tsx` (MOD) | renderer-root | React discriminated-union state | `src/renderer/src/App.tsx` (self) | exact |
| `src/renderer/src/components/AppShell.tsx` (NEW) | renderer-component | React state + callbacks | `src/renderer/src/App.tsx` (AppState union + layout) + `src/renderer/src/components/DropZone.tsx` (props pattern) | role-match |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (NEW) | renderer-panel | React state + `useMemo` filter | `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | exact (table-heavy sibling panel) |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (MOD) | renderer-panel | React prop surgery (chip→button) | `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (self, existing Row cell) | exact (in-place touch) |
| `scripts/cli.ts` (MOD) | script | stdout writer | `scripts/cli.ts` (self) | exact (adapter tweak) |
| `tests/core/bones.spec.ts` (NEW) | test | vitest unit | `tests/core/bounds.spec.ts` (pure-TS fixture-driven) | role-match |
| `tests/core/sampler.spec.ts` (MOD) | test | vitest unit | self | exact |
| `tests/core/analyzer.spec.ts` (MOD) | test | vitest unit | self | exact |
| `tests/core/summary.spec.ts` (MOD) | test | vitest unit | self | exact |
| `tests/core/ipc.spec.ts` (MOD) | test | vitest unit | self | exact |
| `tests/arch.spec.ts` (MOD) | test | vitest grep gate | self | exact (add to already-auto-scanning Layer 3) |

## Pattern Assignments

### `src/core/bones.ts` (NEW, core-pure, pure fold)

**Analog:** none — this is the smallest net-new module in the phase. The closest *conceptual* sibling is `src/core/bounds.ts` (pure-TS, stateless, spine-core API pass-through) but its surface area is far larger than what `bones.ts` needs. Treat bones.ts as a fresh ~25-line module.

**Header docstring convention to copy** (from `src/core/analyzer.ts` lines 1-13 — establishes the "Phase N Plan M — pure, stateless, zero-I/O" header template):
```typescript
/**
 * Phase 3 Plan 01 — Pure bone-chain traversal (D-68).
 *
 * Pure, stateless, zero-I/O. Follows CLAUDE.md rule #5 (core/ is pure TS,
 * no DOM). Enforced by tests/arch.spec.ts Layer 3 defense.
 *
 * Pure delegation over spine-core's Bone.parent chain — zero math.
 */
```

**Import pattern** (from `src/core/sampler.ts` lines 47-54 — shows the `.js` extension convention and type-only vs value import split; bones.ts is `type`-only from spine-core):
```typescript
import type { Slot } from '@esotericsoftware/spine-core';
```

**Canonical signature and body** (lifted verbatim from RESEARCH §Example 2 lines 503-535, which is the researcher's hand-authored target — planner should copy directly):
```typescript
export function boneChainPath(slot: Slot, attachmentName: string): string[] {
  // Walk the parent chain from slot.bone up to the root. Ancestors then reversed.
  const ancestors: string[] = [];
  let current: typeof slot.bone | null = slot.bone;
  while (current !== null) {
    ancestors.push(current.data.name);
    current = current.parent;
  }
  ancestors.reverse();                    // root-first
  ancestors.push(slot.data.name);         // slot name
  ancestors.push(attachmentName);         // attachment leaf
  return ancestors;
}
```

**Divergence from any analog:** None — bones.ts is self-contained. Only hygiene to match is: no `node:fs` / `node:path` / `sharp` imports (enforced automatically by `tests/arch.spec.ts` Layer 3 and the new `tests/core/bones.spec.ts` N2.3 hygiene test which must mirror `analyzer.spec.ts` lines 189-193).

**Bone.data.name note** (RESEARCH §Bone Path Traversal Details line 930): the accessor is `bone.data.name`, NOT `bone.name` — there is no direct `name` field on `Bone`; the name lives on `BoneData`. Already used correctly in the Example 2 excerpt above; planner must preserve.

---

### `src/core/sampler.ts` (MOD, core-pure, locked tick-lifecycle fold)

**Analog:** `src/core/sampler.ts` itself (the existing Phase 0 body is the template; Phase 3 adds a new branch per tick + an optional return field). See CONTEXT.md D-53/D-54/D-55 and RESEARCH §Example 1.

**Header docstring to extend** (current file lines 1-45): keep the locked-lifecycle block (lines 11-27) and determinism paragraph (lines 29-32) **byte-identical** — Plan 03-01's sampler-extension commit must preserve them because `tests/core/sampler.spec.ts` greps for them (see lines 507-531 of the spec, which asserts source order of `state.update(dt)`, `state.apply(skeleton)`, `skeleton.update(dt)`, `skeleton.updateWorldTransform(Physics.update)`). **Add** a new paragraph documenting the per-animation extension + `SCALE_DELTA_EPSILON`, in prose (see Pitfall 6 — do NOT cite the PEAK_EPSILON constant by literal name in the new docstring if any grep-gate scans it; paraphrase). Prose template: "Also tracks per-animation peaks for attachments whose tick-scale differs from the setup-pose baseline by more than the scale-delta threshold, OR whose slot/attachment pair is named by an AttachmentTimeline."

**Existing PEAK_EPSILON pattern to copy adjacent-to** (sampler.ts lines 59-69) — introduce a sibling constant block:
```typescript
const PEAK_EPSILON = 1e-9;   // existing — peak-latch FP-noise tolerance (do NOT reuse for scale-delta)
```
Add below it (new, per D-54 / RESEARCH §3):
```typescript
/**
 * "Affected" threshold for per-animation breakdown detection. Distinct from
 * PEAK_EPSILON — 1e-6 is well above animator-meaningful bone scale deltas
 * but still filters out FP noise + compensating constraint residue.
 */
const SCALE_DELTA_EPSILON = 1e-6;
```

**Return-shape extension** (sampler.ts lines 100-103 + RESEARCH §Example 1 lines 381-386) — replace:
```typescript
// BEFORE (current):
export function sampleSkeleton(load: LoadResult, opts: SamplerOptions = {}): Map<string, PeakRecord> {
```
With:
```typescript
// AFTER:
export interface SamplerOutput {
  globalPeaks: Map<string, PeakRecord>;
  perAnimation: Map<string, PeakRecord>;
  setupPosePeaks: Map<string, PeakRecord>;
}
export function sampleSkeleton(load: LoadResult, opts: SamplerOptions = {}): SamplerOutput {
```

**Pass 2 pre-loop AttachmentTimeline scan** (inserted between sampler.ts line 140 (`for (const anim of ...)`) and line 141 (`skeleton.setToSetupPose()`) — seeded from RESEARCH §Example 1 lines 418-428):
```typescript
// PRE-LOOP: collect AttachmentTimeline-named (slotIndex, attachmentName) pairs
// for the second arm of the "affected" test. One-time per animation.
const animAttachmentNames = new Set<string>();
for (const tl of anim.timelines) {
  if (tl instanceof AttachmentTimeline) {
    for (const name of tl.attachmentNames) {
      if (name !== null) animAttachmentNames.add(`${tl.slotIndex}/${name}`);
    }
  }
}
```

**Per-tick affected-check pattern for `snapshotFrame`** (inserted after sampler.ts lines 244-262's existing latch — seeded from RESEARCH §Example 1 lines 479-494):
```typescript
// NEW: per-animation "affected" emission (D-54, D-55)
if (perAnimation !== null) {
  const baseline = setupPoseBaseline.get(key) ?? 0;
  const scaleDelta = Math.abs(peakScale - baseline);
  const isAffectedByScale = scaleDelta > SCALE_DELTA_EPSILON;
  const attachmentTimelineKey = `${slotIndex}/${attachment.name}`;
  const isAffectedByTimeline = perAnimationAttachmentNames !== null
    && perAnimationAttachmentNames.has(attachmentTimelineKey);
  if (isAffectedByScale || isAffectedByTimeline) {
    const perAnimKey = `${animationName}/${key}`;
    const existingPA = perAnimation.get(perAnimKey);
    if (existingPA === undefined || peakScale > existingPA.peakScale + PEAK_EPSILON) {
      perAnimation.set(perAnimKey, { /* copy of the PeakRecord shape from line 245-261 */ });
    }
  }
}
```

**PeakRecord construction to clone** (sampler.ts lines 245-261) — the per-animation latch must emit the exact same 15-field PeakRecord shape (extending SampleRecord + `isSetupPosePeak`). Do NOT widen PeakRecord for this phase; the breakdown-specific preformatting lives in `analyzer.ts`.

**Divergence from analog:** The locked tick lifecycle (sampler.ts lines 157-161) MUST NOT be reordered. The `for (let t = 0; t <= duration + 1e-9; t += dt)` loop body gains NO new calls between `state.update` / `state.apply` / `skeleton.update` / `skeleton.updateWorldTransform(Physics.update)` — only `snapshotFrame` is enriched with additional params. The lifecycle grep-gate in `tests/core/sampler.spec.ts` lines 507-520 continues to pass because the four calls remain in order with nothing between them.

**slotIndex replacement note** (RESEARCH line 499): replace any `skeleton.slots.indexOf(slot)` call with a pre-computed enumerated index (loop counter) — spine-core's `Skeleton.slots` is a plain array but `indexOf` is O(N). Keep existing `for (const slot of skeleton.slots)` but enumerate: `let slotIndex = 0; for (const slot of ...) { ... slotIndex++; }`.

---

### `src/core/analyzer.ts` (MOD, core-pure, pure fold)

**Analog:** `src/core/analyzer.ts` itself — add `analyzeBreakdown` as a sibling export to the existing `analyze` (lines 117-120). The existing `analyze()` signature, `dedupByAttachmentName` helper (lines 98-110), `pickHigherPeak` helper (lines 87-96), and `toDisplayRow` converter (lines 52-77) are ALL reusable either directly or as templates.

**Imports pattern** (analyzer.ts lines 49-50 — note the `.js` extension on TypeScript source imports, project convention for NodeNext module resolution):
```typescript
import type { PeakRecord } from './sampler.js';
import type { DisplayRow } from '../shared/types.js';
```
**Add** (Phase 3):
```typescript
import type { SkeletonData, Slot } from '@esotericsoftware/spine-core';
import type { AnimationBreakdown, BreakdownRow } from '../shared/types.js';
import { boneChainPath } from './bones.js';
```

**Dedupe helper — REUSE VERBATIM** (analyzer.ts lines 87-110): keep `pickHigherPeak` and `dedupByAttachmentName` **unchanged**. RESEARCH §Pattern 2 line 263-267 confirms: BreakdownRow is a superset of DisplayRow on the dedup-relevant fields (`attachmentName`, `peakScale`, `skinName`, `slotName`). The planner has two options:
- **Option A (preferred, per RESEARCH A3):** make `BreakdownRow extends DisplayRow` in `src/shared/types.ts` and reuse `dedupByAttachmentName` directly by widening its parameter type: `function dedupByAttachmentName<T extends DisplayRow>(rows: readonly T[]): T[]`.
- **Option B:** duplicate the 9-line helper into a local `dedupBreakdownRows` inside analyzer.ts.

**`toDisplayRow` converter to extend** (analyzer.ts lines 52-77 — exact template for `BreakdownRow` construction):
```typescript
// Phase 3 additions: accept a Slot parameter for Bone Path derivation; accept isSetup flag for frameLabel em-dash.
function toBreakdownRow(p: PeakRecord, slot: Slot | undefined, isSetup: boolean): BreakdownRow {
  const bonePath = slot !== undefined
    ? boneChainPath(slot, p.attachmentName)
    : [p.slotName, p.attachmentName]; // defensive fallback per RESEARCH §Example 3 line 602-603
  const BONE_PATH_SEPARATOR = ' → ';  // U+2192 — UI-SPEC §Copywriting Contract
  return {
    // raw fields — identical to toDisplayRow() lines 54-69
    attachmentKey: p.attachmentKey,
    skinName: p.skinName,
    slotName: p.slotName,
    attachmentName: p.attachmentName,
    animationName: p.animationName,
    time: p.time,
    frame: p.frame,
    peakScaleX: p.peakScaleX,
    peakScaleY: p.peakScaleY,
    peakScale: p.peakScale,
    worldW: p.worldW,
    worldH: p.worldH,
    sourceW: p.sourceW,
    sourceH: p.sourceH,
    isSetupPosePeak: p.isSetupPosePeak,
    // Phase 3 additions:
    bonePath,
    bonePathLabel: bonePath.join(BONE_PATH_SEPARATOR),
    // preformatted labels — identical to toDisplayRow() lines 71-75 EXCEPT frameLabel
    originalSizeLabel: `${p.sourceW}×${p.sourceH}`,
    peakSizeLabel: `${p.worldW.toFixed(0)}×${p.worldH.toFixed(0)}`,
    scaleLabel: `${p.peakScale.toFixed(3)}×`,
    sourceLabel: p.animationName,
    frameLabel: isSetup ? '—' : String(p.frame),  // D-57 em-dash for setup pose rows (U+2014)
  };
}
```

**New export `analyzeBreakdown` body** (seeded from RESEARCH §Example 3 lines 547-611) — follows the existing `analyze()` pattern (lines 117-120): build rows, dedupe, sort, return. Sort ordering diverges from `byCliContract` (analyzer.ts lines 79-83) — breakdown rows sort by Scale DESC per D-59:
```typescript
export function analyzeBreakdown(
  perAnimation: Map<string, PeakRecord>,
  setupPosePeaks: Map<string, PeakRecord>,
  skeletonData: SkeletonData,
  skeletonSlots: readonly Slot[],
): AnimationBreakdown[] {
  const findSlot = (name: string) => skeletonSlots.find(s => s.data.name === name);
  const cards: AnimationBreakdown[] = [];

  // 1. Setup Pose card (D-60)
  const setupPoseRows = [...setupPosePeaks.values()]
    .map(rec => toBreakdownRow(rec, findSlot(rec.slotName), /*isSetup*/ true));
  const setupDeduped = dedupByAttachmentName(setupPoseRows);
  setupDeduped.sort((a, b) => b.peakScale - a.peakScale);  // D-59 Scale DESC
  cards.push({
    cardId: 'setup-pose',
    animationName: 'Setup Pose (Default)',
    isSetupPose: true,
    uniqueAssetCount: setupDeduped.length,
    rows: setupDeduped,
  });

  // 2. One card per animation in skeleton JSON order (D-58)
  for (const anim of skeletonData.animations) {
    const rowsForAnim: BreakdownRow[] = [];
    for (const [key, rec] of perAnimation) {
      // Key format: `${animation}/${skin}/${slot}/${attachment}` — split on first `/`.
      const firstSlash = key.indexOf('/');
      if (firstSlash > 0 && key.slice(0, firstSlash) === anim.name) {
        rowsForAnim.push(toBreakdownRow(rec, findSlot(rec.slotName), /*isSetup*/ false));
      }
    }
    const deduped = dedupByAttachmentName(rowsForAnim);
    deduped.sort((a, b) => b.peakScale - a.peakScale);  // D-59
    cards.push({
      cardId: `anim:${anim.name}`,
      animationName: anim.name,
      isSetupPose: false,
      uniqueAssetCount: deduped.length,
      rows: deduped,
    });
  }
  return cards;
}
```

**Divergence from analog:** `analyze()` stays untouched (Phase 2 contract). `analyzeBreakdown` is a sibling — the two share only the `dedupByAttachmentName` helper (via Option A or B above) and the label-format constants (Unicode × and toFixed).

---

### `src/shared/types.ts` (MOD, shared IPC contract)

**Analog:** `src/shared/types.ts` itself — the existing `DisplayRow` interface (lines 30-51) is the exact template for `BreakdownRow`; `SkeletonSummary` (lines 57-72) is extended in place.

**File-top comment convention to preserve** (lines 1-17): "These interfaces erase at compile time. No runtime code lives in this file." Phase 3 types follow the same rule.

**DisplayRow shape to copy as `BreakdownRow` base** (lines 30-51):
```typescript
export interface DisplayRow {
  attachmentKey: string;
  skinName: string;
  slotName: string;
  attachmentName: string;
  animationName: string;
  time: number;
  frame: number;
  peakScaleX: number;
  peakScaleY: number;
  peakScale: number;
  worldW: number;
  worldH: number;
  sourceW: number;
  sourceH: number;
  isSetupPosePeak: boolean;
  originalSizeLabel: string;
  peakSizeLabel: string;
  scaleLabel: string;
  sourceLabel: string;
  frameLabel: string;
}
```

**Add (Phase 3, seeded from CONTEXT §Specifics lines 249-283):**
```typescript
/**
 * Phase 3 Plan 01 — Per-animation breakdown row. Extends DisplayRow with the
 * two Bone Path fields required by F4.3. D-57 locks the seven-column layout:
 * Attachment | Bone Path | Source W×H | Scale | Peak W×H | Frame | [Override].
 *
 * `frameLabel` is either `String(frame)` (animation row) or `'—'` (U+2014 em
 * dash, Setup Pose row per D-60). Preformatted in core/analyzer.ts — renderer
 * does zero formatting (same split as DisplayRow).
 *
 * Extends DisplayRow so the existing `dedupByAttachmentName` helper works
 * without a second generic-parameter definition.
 */
export interface BreakdownRow extends DisplayRow {
  bonePath: string[];       // raw bone chain for programmatic use
  bonePathLabel: string;    // preformatted: 'root → CTRL → CHAIN_2 → … → attachment' (U+2192 separator)
}

/**
 * Phase 3 Plan 01 — A single card in the Animation Breakdown panel. One for
 * Setup Pose (Default) at the top (cardId === 'setup-pose'), then one per
 * animation in skeleton JSON order (cardId === `anim:${animationName}`).
 * Empty `rows` === "No assets referenced" state (D-62).
 */
export interface AnimationBreakdown {
  cardId: string;            // 'setup-pose' OR `anim:${animationName}`
  animationName: string;     // 'Setup Pose (Default)' for the top card
  isSetupPose: boolean;
  uniqueAssetCount: number;  // === rows.length
  rows: BreakdownRow[];
}
```

**Extend SkeletonSummary** (current interface lines 57-72) — add one field:
```typescript
export interface SkeletonSummary {
  // ... existing fields ...
  peaks: DisplayRow[];
  /** Phase 3: per-animation breakdown cards. Empty array if skeleton has no animations. */
  animationBreakdown: AnimationBreakdown[];
  elapsedMs: number;
}
```

**Divergence:** None structurally. The "no runtime code" rule is preserved — all additions are interfaces. structuredClone-safety is preserved: arrays + primitives only, no Map/Set/class instances.

---

### `src/main/summary.ts` (MOD, main-process projection)

**Analog:** `src/main/summary.ts` itself (31 lines currently). Phase 3 touches it in exactly one place: after the existing `analyze(peaks)` call (line 53), add a sibling `analyzeBreakdown(...)` call and wire the result into the return object.

**Imports pattern to extend** (lines 19-22):
```typescript
// BEFORE:
import type { LoadResult } from '../core/types.js';
import type { PeakRecord } from '../core/sampler.js';
import type { SkeletonSummary } from '../shared/types.js';
import { analyze } from '../core/analyzer.js';
```
**AFTER (Phase 3):**
```typescript
import type { LoadResult } from '../core/types.js';
import type { SamplerOutput } from '../core/sampler.js';  // was: PeakRecord
import type { SkeletonSummary } from '../shared/types.js';
import { analyze, analyzeBreakdown } from '../core/analyzer.js';
import { Skeleton } from '@esotericsoftware/spine-core';  // to materialize slots for boneChainPath
```

**buildSummary signature + body pattern to extend** (lines 24-75). Current signature takes `peaks: Map<string, PeakRecord>`; Phase 3 takes the new `SamplerOutput` shape:
```typescript
// BEFORE (lines 24-28):
export function buildSummary(
  load: LoadResult,
  peaks: Map<string, PeakRecord>,
  elapsedMs: number,
): SkeletonSummary {
```
```typescript
// AFTER:
export function buildSummary(
  load: LoadResult,
  sampled: SamplerOutput,
  elapsedMs: number,
): SkeletonSummary {
```

**Analyzer wiring pattern to clone** (line 53):
```typescript
// BEFORE:
const peaksArray = analyze(peaks);
```
```typescript
// AFTER:
const peaksArray = analyze(sampled.globalPeaks);
// Build skeleton slots once for boneChainPath — SkeletonData alone doesn't
// carry Bone.parent resolution; a Skeleton instance is required.
const skeleton = new Skeleton(load.skeletonData);
const animationBreakdown = analyzeBreakdown(
  sampled.perAnimation,
  sampled.setupPosePeaks,
  load.skeletonData,
  skeleton.slots,
);
```

**Return object to extend** (lines 55-74):
```typescript
return {
  // ... existing 8 fields unchanged ...
  peaks: peaksArray,
  animationBreakdown,           // NEW field
  elapsedMs,
};
```

**Divergence:** None structurally. The file stays pure, output-deterministic, structuredClone-safe. The one subtle point: `new Skeleton(load.skeletonData)` allocates a spine-core Skeleton just to walk `.slots` → `.bone` → `.parent` — this is cheap (under a millisecond) but it's the first time summary.ts does this. Document inline with a comment pointing at `analyzeBreakdown`'s bone-chain requirement.

**Caller update required:** `src/main/ipc.ts` line 58 currently destructures `const peaks = sampleSkeleton(load)` and passes `peaks` to `buildSummary`. Update to:
```typescript
const sampled = sampleSkeleton(load);
const summary = buildSummary(load, sampled, elapsedMs);
```

---

### `src/renderer/src/App.tsx` (MOD, renderer-root, React discriminated-union state)

**Analog:** `src/renderer/src/App.tsx` itself. Phase 3 touches exactly one line — swap `<GlobalMaxRenderPanel summary={...} />` for `<AppShell summary={...} />` in the `status: 'loaded'` branch. The discriminated-union `AppState` type (lines 30-34), `handleLoad` / `handleLoadStart` callbacks (lines 39-49), and DropZone wrapping (lines 60-83) all stay **unchanged**.

**AppState discriminated union pattern (LOCK)** (lines 30-34):
```typescript
export type AppState =
  | { status: 'idle' }
  | { status: 'loading'; fileName: string }
  | { status: 'loaded'; fileName: string; summary: SkeletonSummary }
  | { status: 'error'; fileName: string; error: SerializableError };
```

**`status: 'loaded'` branch to modify** (line 71):
```typescript
// BEFORE:
{state.status === 'loaded' && <GlobalMaxRenderPanel summary={state.summary} />}
```
```typescript
// AFTER:
{state.status === 'loaded' && <AppShell summary={state.summary} />}
```

**Import change** (line 23): swap `GlobalMaxRenderPanel` for `AppShell`:
```typescript
// BEFORE:
import { GlobalMaxRenderPanel } from './panels/GlobalMaxRenderPanel';
```
```typescript
// AFTER:
import { AppShell } from './components/AppShell';
```

**Divergence:** None. The D-17 console echo (lines 52-57), idle/loading/error branches (lines 61-82), and DropZone wrapper remain byte-identical — CONTEXT D-49 explicitly states "DropZone still wraps the whole window and still owns idle/loading/error states. The tab strip sits above the SearchBar level."

---

### `src/renderer/src/components/AppShell.tsx` (NEW, renderer-component, React state + callbacks)

**Analog:** `src/renderer/src/App.tsx` (for the discriminated-state pattern + header/main layout) + `src/renderer/src/components/DropZone.tsx` (for the props-plus-children composition pattern). UI-SPEC §AppShell header layout locks the exact Tailwind classes.

**Imports pattern to copy** (modeled on App.tsx lines 21-28):
```typescript
import { useCallback, useState } from 'react';
import clsx from 'clsx';
import type { SkeletonSummary } from '../../../shared/types.js';
import { GlobalMaxRenderPanel } from '../panels/GlobalMaxRenderPanel';
import { AnimationBreakdownPanel } from '../panels/AnimationBreakdownPanel';
```

**Props-interface + component body skeleton** (seeded from RESEARCH §Example 4 lines 615-686 + UI-SPEC §AppShell header layout). Planner lifts the block verbatim, modulo planner-chosen flash-duration constant (UI-SPEC locks 900ms):
```tsx
type ActiveTab = 'global' | 'animation';

export function AppShell({ summary }: { summary: SkeletonSummary }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('global');   // D-50 default
  const [focusAnimationName, setFocusAnimationName] = useState<string | null>(null);

  const onJumpToAnimation = useCallback((name: string) => {
    setActiveTab('animation');
    setFocusAnimationName(name);
  }, []);
  const onFocusConsumed = useCallback(() => setFocusAnimationName(null), []);

  return (
    <div className="w-full h-full flex flex-col">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-border bg-panel">
        {/* Filename chip — moved from GlobalMaxRenderPanel's internal header per D-49.
            EXACT class string inherited from GlobalMaxRenderPanel.tsx line 341 (chip class verbatim). */}
        <span className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg">
          {summary.skeletonPath}
        </span>
        <nav role="tablist" className="flex gap-1 items-center">
          <TabButton isActive={activeTab === 'global'} onClick={() => setActiveTab('global')}>
            Global
          </TabButton>
          <TabButton isActive={activeTab === 'animation'} onClick={() => setActiveTab('animation')}>
            Animation Breakdown
          </TabButton>
        </nav>
      </header>
      <main className="flex-1 overflow-auto">
        {activeTab === 'global' && (
          <GlobalMaxRenderPanel summary={summary} onJumpToAnimation={onJumpToAnimation} />
        )}
        {activeTab === 'animation' && (
          <AnimationBreakdownPanel
            summary={summary}
            focusAnimationName={focusAnimationName}
            onFocusConsumed={onFocusConsumed}
          />
        )}
      </main>
    </div>
  );
}
```

**TabButton sub-component pattern** (UI-SPEC §AppShell tab strip — locked class strings; positive grep targets include `role="tab"`, `aria-selected={isActive}`, `font-semibold text-accent`, `font-normal text-fg-muted`; NEGATIVE grep target: `font-medium` must NOT appear anywhere):
```tsx
function TabButton({
  isActive, onClick, children,
}: { isActive: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      onClick={onClick}
      className={clsx(
        'relative px-4 py-2 text-sm font-sans transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-accent',
        isActive ? 'font-semibold text-accent' : 'font-normal text-fg-muted hover:text-fg',
      )}
    >
      {children}
      {isActive && (
        <span aria-hidden className="absolute left-0 right-0 -bottom-px h-[2px] bg-accent" />
      )}
    </button>
  );
}
```

**clsx usage pattern** (already established in DropZone.tsx lines 110-116 and GlobalMaxRenderPanel.tsx lines 120-134) — all class strings are LITERAL (Tailwind v4 scanner cannot see interpolated strings; Phase 1/2 Pitfall 8). Planner must NOT refactor to template strings.

**Divergence:** AppShell is NEW but mirrors App.tsx's "owns state + routes to children" pattern. Key divergence vs App.tsx: AppShell is a child of `DropZone` (not a sibling), so it only ever mounts when `status: 'loaded'`. This means AppShell state (`activeTab`, `focusAnimationName`) naturally resets on new skeleton drop (D-50) because the entire component unmounts during the `status: 'idle'/'loading'` transition — no explicit reset useEffect needed.

---

### `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (NEW, renderer-panel)

**Analog:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — the closest-match sibling. Phase 3 borrows its entire structural skeleton: header + SearchBar + pure helpers at module top + table chrome inside each card. Row-per-card replaces the single-table layout.

**Imports pattern to clone** (GlobalMaxRenderPanel.tsx lines 20-33):
```typescript
import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import clsx from 'clsx';
import type {
  SkeletonSummary,
  AnimationBreakdown,
  BreakdownRow,
} from '../../../shared/types.js';
import { SearchBar } from '../components/SearchBar';
```

**Module-top pure helper pattern to clone** (GlobalMaxRenderPanel.tsx lines 51-99) — define filter + highlight helpers at module top, keep component body focused on state + render. Apply verbatim to `filterCardsByAttachmentName`:
```typescript
// Template from GlobalMaxRenderPanel.tsx lines 51-55:
function filterCardsByAttachmentName(
  cards: readonly AnimationBreakdown[],
  query: string,
): AnimationBreakdown[] {
  const q = query.trim().toLowerCase();
  if (q === '') return cards.slice();
  return cards.map(card => ({
    ...card,
    rows: card.rows.filter(r => r.attachmentName.toLowerCase().includes(q)),
  }));
  // NOTE: we keep ALL cards (even zero-match ones) so their headers can show
  // `— filtered` copy per UI-SPEC §Copywriting Contract.
}
```

**Match-highlight helper — REUSE VERBATIM** (GlobalMaxRenderPanel.tsx lines 84-99):
```tsx
function highlightMatch(name: string, query: string): ReactNode {
  const q = query.trim();
  if (q === '') return name;
  const idx = name.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return name;
  const before = name.slice(0, idx);
  const match = name.slice(idx, idx + q.length);
  const after = name.slice(idx + q.length);
  return (
    <>
      {before}
      <mark className="bg-accent/20 text-accent rounded-sm px-0.5">{match}</mark>
      {after}
    </>
  );
}
```
This helper is grep-target `bg-accent/20 text-accent` (UI-SPEC §Grep-Verifiable Signatures positive list).

**Panel outer layout to clone** (GlobalMaxRenderPanel.tsx lines 338-348 — `w-full max-w-6xl mx-auto p-8` outer container + `mb-4 flex items-center gap-4` header):
```tsx
return (
  <div className="w-full max-w-6xl mx-auto p-8">
    <header className="mb-4 flex items-center gap-4">
      <h2 className="text-lg font-semibold">Animation Breakdown</h2>
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Filter rows across cards…"
      />
    </header>
    <div className="flex flex-col gap-3">
      {filteredCards.map(card => (
        <AnimationCard
          key={card.cardId}
          card={card}
          expanded={effectiveExpanded.has(card.cardId)}
          onToggle={() => toggleCard(card.cardId)}
          query={query}
          isFlashing={isFlashing === card.cardId}
          registerRef={(el) => registerCardRef(card.cardId, el)}
        />
      ))}
    </div>
  </div>
);
```

**State shape + useMemo pattern to clone** (GlobalMaxRenderPanel.tsx lines 253-274):
```tsx
const [query, setQuery] = useState('');
const [userExpanded, setUserExpanded] = useState<Set<string>>(new Set(['setup-pose']));
const [isFlashing, setIsFlashing] = useState<string | null>(null);
const cardRefs = useRef(new Map<string, HTMLElement>());

const filteredCards = useMemo(
  () => filterCardsByAttachmentName(summary.animationBreakdown, query),
  [summary.animationBreakdown, query],
);
const effectiveExpanded = useMemo(() => {
  if (query === '') return userExpanded;
  const cardsWithMatches = filteredCards.filter(c => c.rows.length > 0).map(c => c.cardId);
  return new Set([...userExpanded, ...cardsWithMatches]);
}, [query, userExpanded, filteredCards]);
```
**LITERAL initialization** `new Set(['setup-pose'])` is a grep target (UI-SPEC §Grep-Verifiable Signatures). Do NOT refactor to a constant.

**Jump-effect `useEffect` to clone** (from RESEARCH §Example 5 lines 708-728 — resolves Pitfall 5 by firing `onFocusConsumed` synchronously on mount, keeping the 900ms timer local):
```tsx
useEffect(() => {
  if (focusAnimationName === null) return;
  const cardId = focusAnimationName === 'Setup Pose (Default)'
    ? 'setup-pose'
    : `anim:${focusAnimationName}`;

  setUserExpanded((prev) => {
    const next = new Set(prev);
    next.add(cardId);
    return next;
  });
  setIsFlashing(cardId);
  const el = cardRefs.current.get(cardId);
  if (el !== undefined) el.scrollIntoView({ behavior: 'smooth', block: 'start' });

  onFocusConsumed();
  const timer = setTimeout(() => setIsFlashing(null), 900);
  return () => clearTimeout(timer);
}, [focusAnimationName, onFocusConsumed]);
```

**AnimationCard sub-component to hand-roll** (UI-SPEC §Collapsible card ARIA pattern — locked class strings; grep targets include `aria-expanded={isExpanded}`, `aria-controls={bodyId}`, `border border-border rounded-md bg-panel overflow-hidden`, `ring-2 ring-accent ring-offset-2 ring-offset-surface`). Table chrome inside the expanded body mirrors GlobalMaxRenderPanel's thead/tbody/td classes (lines 349-437):

```tsx
function AnimationCard({ card, expanded, onToggle, query, isFlashing, registerRef }: {
  card: AnimationBreakdown;
  expanded: boolean;
  onToggle: () => void;
  query: string;
  isFlashing: boolean;
  registerRef: (el: HTMLElement | null) => void;
}) {
  const headerId = `bd-header-${card.cardId}`;
  const bodyId = `bd-body-${card.cardId}`;
  const caret = expanded ? '▾' : '▸';   // U+25BE / U+25B8
  const countLabel = card.rows.length === 0
    ? '— No assets referenced'
    : `— ${card.rows.length} unique assets referenced`;
  return (
    <section
      ref={registerRef}
      aria-labelledby={headerId}
      className={clsx(
        'border border-border rounded-md bg-panel overflow-hidden',
        isFlashing && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
      )}
    >
      <button
        id={headerId}
        type="button"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-semibold font-mono text-fg hover:bg-accent/5 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="text-fg-muted">{caret}</span>
        <span>{card.animationName}</span>
        <span className="text-fg-muted">{countLabel}</span>
      </button>
      {expanded && (
        <div id={bodyId} role="region" className="border-t border-border">
          {card.rows.length === 0 ? (
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td colSpan={7} className="text-fg-muted font-mono text-sm text-center py-8">
                    No assets referenced
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <BreakdownTable rows={card.rows} query={query} isSetup={card.isSetupPose} />
          )}
        </div>
      )}
    </section>
  );
}
```

**BreakdownTable inside the card** (mirrors GlobalMaxRenderPanel.tsx thead/tbody lines 349-437 but without sort — D-59 locks Scale DESC — and without per-row checkboxes — selection is a Phase 2/4 concern). Seven columns per D-57: Attachment | Bone Path | Source W×H | Scale | Peak W×H | Frame | [Override].

**Bone Path cell pattern** (UI-SPEC §Bone Path truncation + §Card body `<td>` override):
```tsx
<td
  title={row.bonePath.join(' → ')}
  className="py-2 px-3 font-mono text-xs text-fg-muted max-w-[320px]"
>
  {truncateMidEllipsis(row.bonePath, 48)}
</td>
```
where `truncateMidEllipsis` is the UI-SPEC §Bone Path truncation hand-rolled helper (module-top, pure; if path joined ≤ 48 chars return joined, else `[path[0], '…', ...path.slice(-2)].join(' → ')`).

**Disabled Override button pattern** (UI-SPEC §Override button — LOCKED class string, grep target `title="Coming in Phase 4"` and `opacity-50 cursor-not-allowed`):
```tsx
<button
  type="button"
  disabled
  title="Coming in Phase 4"
  aria-label="Override Scale (disabled until Phase 4)"
  className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg opacity-50 cursor-not-allowed focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
>
  Override Scale
</button>
```

**Divergence from GlobalMaxRenderPanel analog:**
- No sort headers (D-59 locks Scale DESC; cards have no click-to-sort).
- No row checkboxes / selection state (selection is a Phase 2 and Phase 4 concern; Animation Breakdown is read-only drill-down).
- No filename chip inside the panel header — that moved to AppShell (D-49).
- Rows are organized into multiple `<table>` elements (one per expanded card), not one monolithic table.
- Empty state copy differs per D-62: `No assets referenced` (not `No attachments match "…"`).

---

### `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (MOD, renderer-panel, React prop surgery)

**Analog:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` itself. Phase 3 touches it in exactly two places per D-72 / UI-SPEC §Source Animation chip → jump-button upgrade:

**1. Add optional `onJumpToAnimation` prop** (modify interface at lines 45-47):
```typescript
// BEFORE:
export interface GlobalMaxRenderPanelProps {
  summary: SkeletonSummary;
}
```
```typescript
// AFTER:
export interface GlobalMaxRenderPanelProps {
  summary: SkeletonSummary;
  /** Phase 3 D-72: clicking the Source Animation chip calls this. When undefined, falls back to the non-interactive Phase 2 chip. */
  onJumpToAnimation?: (animationName: string) => void;
}
```
And thread it through the Row sub-component. The main `function GlobalMaxRenderPanel({ summary }: ...)` destructure on line 253 becomes `function GlobalMaxRenderPanel({ summary, onJumpToAnimation }: GlobalMaxRenderPanelProps)`.

**2. Replace Source Animation `<span>` cell with conditional `<button>`/`<span>`** (lines 203-207 — the existing chip):
```tsx
// BEFORE (lines 203-207):
<td className="py-2 px-3 font-mono text-sm text-fg">
  <span className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono">
    {row.sourceLabel}
  </span>
</td>
```
```tsx
// AFTER (UI-SPEC §Source Animation chip → jump-button upgrade — LOCKED class strings):
<td className="py-2 px-3 font-mono text-sm text-fg">
  {onJumpToAnimation !== undefined ? (
    <button
      type="button"
      onClick={() => onJumpToAnimation(row.sourceLabel)}
      aria-label={`Jump to ${row.sourceLabel} in Animation Breakdown`}
      className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg cursor-pointer hover:bg-accent/10 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
    >
      {row.sourceLabel}
    </button>
  ) : (
    // Phase 2 fallback (no AppShell wrapper) — preserve decoupling.
    <span className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono">
      {row.sourceLabel}
    </span>
  )}
</td>
```

**3. Filename chip removal** — CONTEXT D-49 states "the filename chip moves from GlobalMaxRenderPanel's internal header up into AppShell." The existing chip at GlobalMaxRenderPanel.tsx line 341-343 should be **removed** when AppShell is the parent. Implementation option: planner can leave it in place if AppShell-rendered case is detected via prop (wasteful), or — cleaner — always remove the filename chip from GlobalMaxRenderPanel and rely on AppShell to host it. RECOMMEND: remove unconditionally. The phase-2 test that greps for filename rendering should be updated to target AppShell, not GlobalMaxRenderPanel.

**Divergence:** The prop threading from GlobalMaxRenderPanel down to Row (lines 425-433 — the map over `sorted`) needs `onJumpToAnimation` in the RowProps interface (lines 142-149). Row currently takes 6 props; adding one optional prop is straightforward.

---

### `scripts/cli.ts` (MOD, script, stdout writer)

**Analog:** `scripts/cli.ts` itself. Phase 3 touches it in exactly one place — the call site of `sampleSkeleton` changes from `Map<string, PeakRecord>` to `SamplerOutput`. CLI output stays byte-for-byte identical (no animation-breakdown view; global-peak table only).

**Current sample call pattern** (cli.ts lines 144-154):
```typescript
const load = loadSkeleton(args.skeletonPath, { atlasPath: args.atlasPath });
const t0 = performance.now();
const peaks = sampleSkeleton(load, { samplingHz: args.samplingHz });
const elapsed = performance.now() - t0;
process.stdout.write(renderTable(peaks) + '\n');
process.stdout.write(
  `\nSampled in ${elapsed.toFixed(1)} ms at ${args.samplingHz} Hz ` +
    `(${peaks.size} attachments across ${load.skeletonData.skins.length} skins, ` +
    `${load.skeletonData.animations.length} animations)\n`,
);
```

**Phase 3 adapter pattern:**
```typescript
const sampled = sampleSkeleton(load, { samplingHz: args.samplingHz });
const elapsed = performance.now() - t0;
process.stdout.write(renderTable(sampled.globalPeaks) + '\n');  // still pass the Map, function signature unchanged
process.stdout.write(
  `\nSampled in ${elapsed.toFixed(1)} ms at ${args.samplingHz} Hz ` +
    `(${sampled.globalPeaks.size} attachments across ${load.skeletonData.skins.length} skins, ` +
    `${load.skeletonData.animations.length} animations)\n`,
);
```

**`renderTable` signature** (cli.ts line 78) stays `function renderTable(peaks: Map<string, PeakRecord>): string` — it consumes the global-peak map specifically.

**Divergence:** Minimal — this is a pure adapter tweak. The CLI's byte-for-byte output contract (Phase 0 gate) is preserved: `renderTable` receives the same Map shape it always did. The only new code is `.globalPeaks` destructuring.

---

### `tests/core/bones.spec.ts` (NEW, test)

**Analog:** `tests/core/bounds.spec.ts` — the closest pure-TS, fixture-driven core test. Mirrors the same structure: describe blocks + `loadSkeleton(FIXTURE)` setup + per-attachment assertion pattern. Also inherits the N2.3 hygiene grep pattern from `tests/core/analyzer.spec.ts` lines 189-193.

**File-top + imports pattern to clone** (bounds.spec.ts lines 1-38):
```typescript
/**
 * Phase 3 Plan 01 — Tests for src/core/bones.ts (D-68).
 *
 * Behavior gates:
 *   - F4.3 Bone Path: boneChainPath returns [root, ...ancestors, slotName, attachmentName].
 *   - CIRCLE on slot CIRCLE (bone CTRL): ['root', 'CTRL', 'CIRCLE', 'CIRCLE']
 *   - TRIANGLE on slot TRIANGLE (bone CHAIN_8): 11-token chain root→...→CHAIN_8→TRIANGLE→TRIANGLE
 *   - SQUARE on slot SQUARE2 (pre-scaled bone): ['root', 'SQUARE2', 'SQUARE2', 'SQUARE']
 *   - N2.3 hygiene: src/core/bones.ts has no node:fs / node:path / sharp imports.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import {
  Skeleton,
  AnimationState,
  AnimationStateData,
  Physics,
} from '@esotericsoftware/spine-core';
import { loadSkeleton } from '../../src/core/loader.js';
import { boneChainPath } from '../../src/core/bones.js';

const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const BONES_SRC = path.resolve('src/core/bones.ts');
```

**Primed-skeleton helper pattern to clone** (bounds.spec.ts lines 44-53) — gives you a Skeleton with every world transform populated:
```typescript
function primedSkeleton(): Skeleton {
  const { skeletonData } = loadSkeleton(FIXTURE);
  const skeleton = new Skeleton(skeletonData);
  skeleton.setToSetupPose();
  const state = new AnimationState(new AnimationStateData(skeletonData));
  state.apply(skeleton);
  skeleton.update(0);
  skeleton.updateWorldTransform(Physics.update);
  return skeleton;
}
```

**Assertion pattern** (expected strings from RESEARCH §Bone Path Traversal Details lines 904-909):
```typescript
describe('boneChainPath (D-68)', () => {
  it('CIRCLE on slot CIRCLE (bone CTRL): returns [root, CTRL, CIRCLE, CIRCLE]', () => {
    const skeleton = primedSkeleton();
    const slot = skeleton.slots.find(s => s.data.name === 'CIRCLE')!;
    expect(boneChainPath(slot, 'CIRCLE')).toEqual(['root', 'CTRL', 'CIRCLE', 'CIRCLE']);
  });

  it('TRIANGLE on slot TRIANGLE (bone CHAIN_8): 11-token root→CTRL→CHAIN_2..8→TRIANGLE→TRIANGLE', () => {
    const skeleton = primedSkeleton();
    const slot = skeleton.slots.find(s => s.data.name === 'TRIANGLE')!;
    expect(boneChainPath(slot, 'TRIANGLE')).toEqual([
      'root', 'CTRL', 'CHAIN_2', 'CHAIN_3', 'CHAIN_4',
      'CHAIN_5', 'CHAIN_6', 'CHAIN_7', 'CHAIN_8',
      'TRIANGLE', 'TRIANGLE',
    ]);
  });

  it('SQUARE on slot SQUARE2 (pre-scaled bone): [root, SQUARE2, SQUARE2, SQUARE]', () => {
    const skeleton = primedSkeleton();
    const slot = skeleton.slots.find(s => s.data.name === 'SQUARE2')!;
    expect(boneChainPath(slot, 'SQUARE')).toEqual(['root', 'SQUARE2', 'SQUARE2', 'SQUARE']);
  });
});
```

**N2.3 hygiene block to clone** (analyzer.spec.ts lines 189-193):
```typescript
describe('bones — module hygiene (N2.3 by construction)', () => {
  it('N2.3: src/core/bones.ts has no node:fs / node:path / node:child_process / sharp / node:http / node:net imports', () => {
    const src = readFileSync(BONES_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
    expect(src).not.toMatch(/from ['"]sharp['"]/);
  });
});
```

**Divergence:** None — this is a straight clone-and-adapt from bounds.spec.ts + the fixture-driven `.find(s => s.data.name === ...)` pattern used throughout sampler.spec.ts. No new test machinery.

---

### `tests/core/sampler.spec.ts` (MOD, test)

**Analog:** `tests/core/sampler.spec.ts` itself. Phase 3 augments with per-animation + setup-pose + determinism assertions on the new shape. The existing describe blocks + locked-lifecycle grep (lines 507-531) stay untouched.

**Assertion additions** (new describe block — mirrors the existing "numeric goldens" block lines 315-461 in shape):
```typescript
describe('sampler — per-animation breakdown extension (D-53, D-54, D-55)', () => {
  it('returns SamplerOutput with globalPeaks + perAnimation + setupPosePeaks maps', () => {
    const load = loadSkeleton(FIXTURE);
    const out = sampleSkeleton(load);
    expect(out.globalPeaks).toBeInstanceOf(Map);
    expect(out.perAnimation).toBeInstanceOf(Map);
    expect(out.setupPosePeaks).toBeInstanceOf(Map);
    expect(out.globalPeaks.size).toBeGreaterThanOrEqual(3);
  });

  it('perAnimation keys include the animation name prefix: `${animation}/${skin}/${slot}/${attachment}`', () => {
    const load = loadSkeleton(FIXTURE);
    const out = sampleSkeleton(load);
    const animNames = new Set(load.skeletonData.animations.map(a => a.name));
    for (const key of out.perAnimation.keys()) {
      const firstSlash = key.indexOf('/');
      expect(firstSlash).toBeGreaterThan(0);
      expect(animNames.has(key.slice(0, firstSlash))).toBe(true);
    }
  });

  it('N1.6 extended: two runs produce bit-identical perAnimation Maps', () => {
    const load = loadSkeleton(FIXTURE);
    const a = sampleSkeleton(load);
    const b = sampleSkeleton(load);
    expect(a.perAnimation.size).toBe(b.perAnimation.size);
    for (const [k, recA] of a.perAnimation) {
      const recB = b.perAnimation.get(k)!;
      expect(recB.peakScale).toBe(recA.peakScale);
      expect(recB.frame).toBe(recA.frame);
    }
  });

  it('setupPosePeaks contains SQUARE at 2.000× (pre-scaled SQUARE2 bone is the dedupe winner for SQUARE)', () => {
    const load = loadSkeleton(FIXTURE);
    const out = sampleSkeleton(load);
    // Per RESEARCH Pitfall 2: Setup Pose card derivation reads setupPosePeaks, one entry
    // per (skin, slot, attachment). The dedupe-by-name pass in analyzer picks SQUARE2's 2.0×.
    // Here we just assert the raw setup-pose entries exist — analyzer spec owns the dedupe assertion.
    const squareSetupEntries = [...out.setupPosePeaks.values()]
      .filter(r => r.attachmentName === 'SQUARE');
    expect(squareSetupEntries.length).toBeGreaterThanOrEqual(2);
    // SQUARE2 slot carries SQUARE attachment with bone scaleX=scaleY=2 (pre-scaled).
    const square2Entry = squareSetupEntries.find(r => r.slotName === 'SQUARE2');
    expect(square2Entry).toBeDefined();
    expect(square2Entry!.peakScale).toBeCloseTo(2.0, 2);
  });
});
```

**Existing `peaks` consumer updates** — every existing test that calls `sampleSkeleton(load)` and treats the result as `Map<string, PeakRecord>` needs to destructure `.globalPeaks`:
- Line 50: `const peaks = sampleSkeleton(load);` → `const peaks = sampleSkeleton(load).globalPeaks;`
- Line 73, 91, 134, etc. — same pattern.

Alternative: add a local shim helper `function peaksFor(load) { return sampleSkeleton(load).globalPeaks; }` to minimize diff footprint.

**Divergence:** The N1.6 determinism assertion is extended (not replaced) — both globalPeaks AND perAnimation must be bit-identical. The locked-lifecycle grep (lines 507-531) is untouched.

---

### `tests/core/analyzer.spec.ts` (MOD, test)

**Analog:** `tests/core/analyzer.spec.ts` itself. Phase 3 augments with `analyzeBreakdown` assertions + dedupe-per-card assertion.

**Existing `analyze()` tests** — shim `sampleSkeleton(load).globalPeaks` in lines 25, 37, 52, 67 (same pattern as sampler.spec.ts).

**New describe block** (mirrors the existing `describe('analyze (D-33, D-34, D-35)')` block lines 22-194):
```typescript
describe('analyzeBreakdown (D-54, D-56, D-57, D-58, D-60, F4)', () => {
  it('emits Setup Pose card as cardId "setup-pose" + isSetupPose=true + animationName="Setup Pose (Default)"', () => {
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const skeleton = new Skeleton(load.skeletonData);
    const cards = analyzeBreakdown(
      sampled.perAnimation, sampled.setupPosePeaks,
      load.skeletonData, skeleton.slots,
    );
    expect(cards[0].cardId).toBe('setup-pose');
    expect(cards[0].isSetupPose).toBe(true);
    expect(cards[0].animationName).toBe('Setup Pose (Default)');
  });

  it('Setup Pose card dedupes to 3 rows on SIMPLE_TEST (CIRCLE, SQUARE, TRIANGLE)', () => {
    // Gap-fix B parity for the Setup Pose card — same semantics as analyze()'s lines 57-86 assertion.
    // ...
  });

  it('Setup Pose SQUARE row: SQUARE2 dedupe winner wins — peakScale = 2.000 (pre-scaled bone)', () => {
    // ...
  });

  it('D-58 card order: animation cards follow skeletonData.animations order, after setup-pose', () => {
    // ...
  });

  it('D-59 row sort: within each card, rows sorted Scale DESC', () => {
    // ...
  });

  it('D-62 empty-animation card has rows.length === 0 + uniqueAssetCount === 0', () => {
    // ...
  });

  it('BreakdownRow.frameLabel is "—" (U+2014) for setup-pose rows, String(frame) for animation rows', () => {
    // ...
  });

  it('BreakdownRow.bonePathLabel uses " → " (U+2192) separator', () => {
    // ...
  });
});
```

**Divergence:** Shares the `dedupByAttachmentName` assertion style from the existing block (lines 88-187). The N2.3 hygiene grep (lines 189-193) should be extended: the analyzer now imports `./bones.js` — the grep should still pass (bones.ts itself has no forbidden imports) but planner should add an assertion that `analyzer.ts` imports `bones.js`.

---

### `tests/core/summary.spec.ts` (MOD, test)

**Analog:** `tests/core/summary.spec.ts` itself. Phase 3 augments with `animationBreakdown` field presence + card count assertion.

**Existing D-22 structuredClone block to extend** (lines 26-32) — add a new assertion inside:
```typescript
it('D-22: output survives structuredClone (no Map/class instances) with animationBreakdown field', () => {
  const load = loadSkeleton(FIXTURE);
  const sampled = sampleSkeleton(load);
  const summary = buildSummary(load, sampled, 12.3);
  expect(Array.isArray(summary.animationBreakdown)).toBe(true);
  const cloned = structuredClone(summary);
  expect(cloned).toEqual(summary);
});
```

**D-21 shape assertion** — extend to check `animationBreakdown` length equals `skeletonData.animations.length + 1` (setup pose + N animations):
```typescript
it('D-21 extended: animationBreakdown has 1 setup-pose + N animation cards', () => {
  const load = loadSkeleton(FIXTURE);
  const sampled = sampleSkeleton(load);
  const s = buildSummary(load, sampled, 0);
  expect(s.animationBreakdown.length).toBe(load.skeletonData.animations.length + 1);
  expect(s.animationBreakdown[0].cardId).toBe('setup-pose');
});
```

**Existing `buildSummary` call signature updates** (lines 29, 37, 60) — swap the second arg from `peaks` to `sampled` (the new SamplerOutput shape).

---

### `tests/core/ipc.spec.ts` (MOD, test)

**Analog:** `tests/core/ipc.spec.ts` itself. Phase 3 adds a single assertion to the happy-path test (lines 29-41) — verify the IPC envelope carries `animationBreakdown`:
```typescript
it('F1-integrated: happy path returns {ok: true, summary: {..., animationBreakdown}}', async () => {
  const resp = await handleSkeletonLoad(FIXTURE);
  expect(resp.ok).toBe(true);
  if (resp.ok) {
    // ... existing assertions ...
    expect(Array.isArray(resp.summary.animationBreakdown)).toBe(true);
    expect(resp.summary.animationBreakdown[0].cardId).toBe('setup-pose');
    expect(resp.summary.animationBreakdown.length).toBeGreaterThanOrEqual(1);
  }
});
```

**Divergence:** None. The error-envelope tests (lines 43-70) are unchanged — no new error paths in Phase 3.

---

### `tests/arch.spec.ts` (MOD, test)

**Analog:** `tests/arch.spec.ts` itself. The existing Layer 3 grep (lines 19-34) ALREADY auto-scans `src/renderer/**/*.{ts,tsx}` — Phase 3's new `AppShell.tsx` and `AnimationBreakdownPanel.tsx` files are picked up automatically by the `globSync('src/renderer/**/*.{ts,tsx}')` pattern. NO arch.spec.ts edit is strictly required for the boundary check.

**However**, Phase 3 introduces `src/core/bones.ts` — a new core-module. The existing spec does not explicitly grep for `src/core/*` hygiene (that's owned by each module's own hygiene block in its `.spec.ts`). The `bones.spec.ts` N2.3 block (see above) handles this.

**Optional extension** (planner's call): add a grep for forbidden tokens cited in RESEARCH §10 Grep-Forbidden Token Watchlist — but this is a defensive enhancement, not a Phase 3 requirement. The existing three-layer defense (tsconfig exclude + vite alias absence + arch.spec.ts Layer 3) already covers the renderer/core boundary.

**If planner chooses to add a Phase 3 sanity check**, suggested grep:
```typescript
describe('Architecture: new Phase 3 renderer files respect the core/ boundary', () => {
  it('AppShell and AnimationBreakdownPanel do not import from src/core', () => {
    // Redundant with the existing glob test — documented here for plan-level auditing.
    const files = [
      'src/renderer/src/components/AppShell.tsx',
      'src/renderer/src/panels/AnimationBreakdownPanel.tsx',
    ];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      expect(text).not.toMatch(/from ['"][^'"]*\/core\/|from ['"]@core/);
    }
  });
});
```

**Divergence:** None — Layer 3 grep already generalizes. This entry documents that no edit is STRICTLY required, keeping the planner from over-scoping.

---

## Shared Patterns

### Path aliases and `.js` extension convention

**Source:** `src/core/analyzer.ts` lines 49-50, `src/main/summary.ts` lines 19-22, `src/renderer/src/App.tsx` lines 24-28.
**Apply to:** every new file import statement.

All internal TypeScript imports use `.js` extensions even for `.ts` source files (NodeNext module resolution). Shared-type imports cross three levels: `'../../../shared/types.js'` from renderer-deep files, `'../shared/types.js'` from main-process files. Never use a path alias — the project has no `@core` or `@shared` alias by design (this is part of the three-layer defense against renderer→core imports).

```typescript
// Renderer-deep (AppShell, AnimationBreakdownPanel) — 3-level climb:
import type { SkeletonSummary } from '../../../shared/types.js';
// Main-process (summary.ts, ipc.ts) — 1-level climb:
import type { SkeletonSummary } from '../shared/types.js';
// Core-internal (analyzer.ts, sampler.ts) — sibling or parent-level:
import type { PeakRecord } from './sampler.js';
import type { LoadResult } from './types.js';
```

### Pure helpers at module top, state in component body

**Source:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` lines 49-99 (helpers) vs lines 253-336 (component body with state).
**Apply to:** `AnimationBreakdownPanel.tsx` (filterCardsByAttachmentName, truncateMidEllipsis, highlightMatch) and `AppShell.tsx` (none — AppShell is small enough that helpers aren't needed).

Module-top helpers stay pure + testable in isolation; component body uses `useState` / `useMemo` / `useCallback` only. Phase 2 locked this pattern; Phase 3 follows suit.

### clsx for conditional class strings only; all class strings LITERAL

**Source:** `src/renderer/src/components/DropZone.tsx` lines 110-116, `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` lines 120-134 and 182.
**Apply to:** every new className. Tailwind v4 Pitfall 8: the Tailwind scanner walks source files for class-string literals; `` `ring-${color}` `` is invisible. Use `clsx('literal-base-class', isActive && 'literal-active-class')` — never template interpolation.

```tsx
// CORRECT (DropZone.tsx line 111-116):
className={clsx(
  'w-full min-h-screen flex items-center justify-center',
  'bg-surface text-fg',
  'focus-visible:outline-2 focus-visible:outline-accent',
  isDragOver && 'ring-2 ring-accent bg-accent/5',
)}
// WRONG (never do this):
className={`ring-2 ring-${accentToken} bg-accent/${alpha}`}
```

### Focus-ring convention: `focus:outline-none focus-visible:outline-2 focus-visible:outline-accent`

**Source:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` line 129, `src/renderer/src/components/DropZone.tsx` line 114 (similar `focus-visible` pattern).
**Apply to:** every new interactive element — tab buttons, card headers, jump buttons, the disabled Override button. UI-SPEC §Focus rings locks this as the one-liner.

### Unicode glyphs, no icon library

**Source:** `scripts/cli.ts` (existing Unicode × per Phase 0 CLI Contract), `src/renderer/src/components/SearchBar.tsx` line 67 (`✕` clear glyph).
**Apply to:** caret glyphs `▸ ▾` (U+25B8 / U+25BE), arrow `→` (U+2192), ellipsis `…` (U+2026), em dash `—` (U+2014), multiplication sign `×` (U+00D7). UI-SPEC §Copywriting Contract locks each. Never substitute ASCII (e.g. `>` for `▸`, `-` for `—`).

### structuredClone-safe IPC payload

**Source:** `src/shared/types.ts` lines 4-10 (file-top comment stating the rule) + `tests/core/summary.spec.ts` lines 26-32 (the assertion that enforces it).
**Apply to:** `AnimationBreakdown` and `BreakdownRow` in `src/shared/types.ts` (no Map, no Set, no class instances — only primitives + arrays + plain objects).

### Test file structure: describe-blocks mirror requirement tags

**Source:** `tests/core/sampler.spec.ts` lines 1-30 header + lines 44, 315, 463 (the three `describe(...)` blocks each tied to a requirement tag: N1.1-N1.6, GAP-FIX, N2.3 hygiene).
**Apply to:** `tests/core/bones.spec.ts` (two describe blocks: "F4.3 Bone Path behavior" + "N2.3 module hygiene"); sampler.spec.ts augmentation (one new describe block: "per-animation breakdown extension D-53/D-54/D-55"); analyzer.spec.ts augmentation (one new describe block: "analyzeBreakdown D-54/D-56/D-57/D-58/D-60/F4").

### JSDoc opening phrase "Phase N Plan M — <one-line summary>"

**Source:** every `src/core/*.ts` and `src/main/*.ts` file starts with this convention (e.g. analyzer.ts line 2, sampler.ts line 2, summary.ts line 2).
**Apply to:** `src/core/bones.ts` header, `src/renderer/src/components/AppShell.tsx` header, `src/renderer/src/panels/AnimationBreakdownPanel.tsx` header, augmentation notes in existing files.

### Grep-literal-in-comments compliance (RESEARCH Pitfall 6)

**Source:** `src/core/sampler.ts` lines 40-45 (docstring paraphrases "editor dopesheet metadata" instead of citing the forbidden `skeleton.fps` token literally in prose).
**Apply to:** all new docstrings in sampler.ts, analyzer.ts, bones.ts, AppShell.tsx, AnimationBreakdownPanel.tsx. Paraphrase around literal tokens that any grep-gate might scan. Especially: do NOT cite the `react-dropzone`, `DebugPanel`, `titleBarStyle`, `skeleton.fps` tokens in comments; paraphrase them as "the legacy drop library", "the prior debug surface", etc.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/core/bones.ts` | core-pure | pure fold | No existing module does bone-chain string traversal — `bounds.ts` reads bones for geometry math but doesn't produce name arrays. Closest conceptual sibling is `bounds.ts` for its pure-TS + spine-core pass-through shape, but the body is fully net-new (only ~25 lines total per RESEARCH §Example 2). Pattern is "pure delegation over spine-core's Bone.parent chain, zero math." |

---

## Metadata

**Analog search scope:** `src/core/`, `src/main/`, `src/shared/`, `src/renderer/src/`, `scripts/`, `tests/core/`, `tests/arch.spec.ts`.
**Files scanned:**
- Core: `sampler.ts`, `analyzer.ts`, `bounds.ts` (header only), `types.ts`, `loader.ts` (not read in detail — out of phase scope), `errors.ts` (not read).
- Main: `summary.ts`, `ipc.ts`, `index.ts` (header only).
- Shared: `types.ts`.
- Renderer: `App.tsx`, `panels/GlobalMaxRenderPanel.tsx`, `components/SearchBar.tsx`, `components/DropZone.tsx`.
- Scripts: `cli.ts`.
- Tests: `tests/core/sampler.spec.ts`, `tests/core/analyzer.spec.ts`, `tests/core/summary.spec.ts`, `tests/core/ipc.spec.ts`, `tests/core/bounds.spec.ts` (header only), `tests/arch.spec.ts`.

**Pattern extraction date:** 2026-04-23.

**Key pattern-source files (planner's lift targets, ranked by importance):**
1. `src/core/analyzer.ts` (121 lines) — entire file is the template for `analyzeBreakdown`. Lines 52-77 `toDisplayRow`, 87-110 dedupe helpers, 117-120 public entry point.
2. `src/core/sampler.ts` (265 lines) — locked lifecycle + PEAK_EPSILON pattern + snapshotFrame signature extension.
3. `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (439 lines) — table chrome, match-highlight helper, SearchBar wiring, row rendering conventions.
4. `src/renderer/src/App.tsx` (85 lines) — AppState discriminated union + handler callback pattern (for AppShell).
5. `src/main/summary.ts` (75 lines) — the extend-in-place template.
6. `src/shared/types.ts` (108 lines) — DisplayRow shape is the exact template for BreakdownRow.
7. `tests/core/bounds.spec.ts` — pattern for `tests/core/bones.spec.ts`.
8. `tests/core/analyzer.spec.ts` — pattern for the new `analyzeBreakdown` describe block.

---
phase: 20
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/documentation.ts
  - src/core/project-file.ts
  - src/shared/types.ts
  - src/main/summary.ts
  - tests/core/documentation.spec.ts
  - tests/core/project-file.spec.ts
autonomous: true
requirements:
  - DOC-03
  - DOC-05
tags:
  - electron
  - typescript
  - validator
  - core
  - layer3

must_haves:
  truths:
    - "src/core/documentation.ts exports the Documentation interface, the four entry interfaces, DEFAULT_DOCUMENTATION constant, and validateDocumentation function"
    - "src/core/documentation.ts contains zero DOM, electron, sharp, or node:fs imports (Layer 3 invariant)"
    - "validateProjectFile rejects malformed documentation sub-shapes via the new validateDocumentation helper, surfacing as ProjectFileParseError (kind: 'invalid-shape')"
    - "serializeProjectFile writes the full state.documentation 6-key shape (not the empty literal {})"
    - "validateProjectFile pre-massages a missing or empty documentation slot to DEFAULT_DOCUMENTATION before per-field guards run, AND materializeProjectFile back-fills missing keys via {...DEFAULT_DOCUMENTATION, ...file.documentation}, so Phase 8-era .stmproj files with documentation:{} pass validation AND load with the full 6-key shape"
    - "AppSessionState type carries a documentation: Documentation field"
    - "ProjectFileV1.documentation type is Documentation (not object)"
    - "SkeletonSummary carries events: { count: number; names: string[] } populated from skeletonData.events in src/main/summary.ts"
    - "tests/core/documentation.spec.ts covers per-field validator rejections, an accept-minimum case, AND intersectDocumentationWithSummary drift behavior (drops orphan bones, adds missing skins, filters orphan tracks, preserves existing descriptions on rebind)"
    - "src/core/documentation.ts exports intersectDocumentationWithSummary(doc, summary): Documentation — pure function used by AppShell on every materialize/load to keep documentation entries aligned with the live skeleton (D-09/D-10/D-11)"
    - "tests/core/project-file.spec.ts round-trip preserves documentation slot bit-equal"
  artifacts:
    - path: src/core/documentation.ts
      provides: "Documentation types + DEFAULT_DOCUMENTATION + validateDocumentation"
      exports:
        - Documentation
        - AnimationTrackEntry
        - EventDescriptionEntry
        - BoneDescriptionEntry
        - SkinDescriptionEntry
        - DEFAULT_DOCUMENTATION
        - validateDocumentation
        - DocumentationValidateResult
        - intersectDocumentationWithSummary
    - path: src/core/project-file.ts
      provides: "Extended validator (pre-massage + per-field) + serializer + materializer for documentation slot"
      contains:
        - "validateDocumentation(obj.documentation)"
        - "documentation: state.documentation"
        - "...DEFAULT_DOCUMENTATION, ...file.documentation"
        - "...DEFAULT_DOCUMENTATION }"
    - path: src/shared/types.ts
      provides: "Type re-exports (Documentation + entry interfaces) + runtime re-exports (DEFAULT_DOCUMENTATION, validateDocumentation, intersectDocumentationWithSummary) + AppSessionState extension + SkeletonSummary.events"
      contains:
        - "documentation: Documentation"
        - "events: { count: number; names: string[] }"
        - "intersectDocumentationWithSummary"
        - "DEFAULT_DOCUMENTATION"
    - path: src/main/summary.ts
      provides: "summary.events field populated from skeletonData.events"
      contains:
        - "skeletonData.events.length"
        - "skeletonData.events.map"
    - path: tests/core/documentation.spec.ts
      provides: "Per-field validator coverage + intersectDocumentationWithSummary drift behavior"
      min_lines: 110
      contains:
        - "intersectDocumentationWithSummary"
        - "drift"
    - path: tests/core/project-file.spec.ts
      provides: "Updated round-trip with documentation slot + Phase 8-era forward-compat full-pipeline test"
      contains:
        - "DEFAULT_DOCUMENTATION"
        - "Phase 8-era full pipeline"
  key_links:
    - from: src/core/project-file.ts (validator pre-massage)
      to: DEFAULT_DOCUMENTATION (Phase 8-era forward-compat)
      via: "if obj.documentation is missing or {} then obj.documentation = { ...DEFAULT_DOCUMENTATION }"
      pattern: "Object\\.keys\\(obj\\.documentation as object\\)\\.length === 0"
    - from: src/core/project-file.ts
      to: src/core/documentation.ts
      via: "import { validateDocumentation, DEFAULT_DOCUMENTATION } from './documentation.js'"
      pattern: "validateDocumentation\\(obj\\.documentation\\)"
    - from: src/shared/types.ts
      to: src/core/documentation.ts
      via: "import type { Documentation } from '../core/documentation.js'"
      pattern: "import type \\{ Documentation"
    - from: src/main/summary.ts
      to: spine-core SkeletonData.events
      via: "skeletonData.events.map((e) => e.name)"
      pattern: "skeletonData\\.events\\."
---

<objective>
Lay the Layer 3 foundation for Phase 20: introduce the typed `Documentation` interface and its validator (D-01..D-04), wire it into `validateProjectFile` / `serializeProjectFile` / `materializeProjectFile`, extend `AppSessionState` and `SkeletonSummary` with the new fields, populate `summary.events` from spine-core, and lock the contracts with vitest unit + round-trip tests.

Purpose: Every downstream wave (modal scaffold, DnD pane, HTML export, integration tests) reads from these types and depends on the validator/serde extension. This plan must land before any UI or main-side IPC work begins.

Output:
- `src/core/documentation.ts` (NEW) — Documentation types + DEFAULT_DOCUMENTATION + validateDocumentation (pure-TS, Layer 3 invariant)
- `src/core/project-file.ts` extended (validator call, serializer, materializer)
- `src/shared/types.ts` extended (re-export Documentation, ProjectFileV1.documentation type, AppSessionState.documentation, SkeletonSummary.events, Api.exportDocumentationHtml signature)
- `src/main/summary.ts` extended (events field from skeletonData.events)
- `tests/core/documentation.spec.ts` (NEW) — per-field validator coverage
- `tests/core/project-file.spec.ts` extended — round-trip with documentation slot
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/20-documentation-builder-feature/20-CONTEXT.md
@.planning/phases/20-documentation-builder-feature/20-RESEARCH.md
@.planning/phases/20-documentation-builder-feature/20-PATTERNS.md
@.planning/phases/20-documentation-builder-feature/20-VALIDATION.md
@./CLAUDE.md
@src/core/project-file.ts
@src/shared/types.ts
@src/main/summary.ts
@tests/core/project-file.spec.ts

<interfaces>
<!-- Key types and contracts the executor needs. Use these directly — no codebase exploration needed. -->

From src/core/project-file.ts (existing — extend, do not replace):

```typescript
// Lines 84-202: validateProjectFile per-field guard idiom — copy this idiom for validateDocumentation.
// Lines 122-144: required-field guards including the existing documentation-is-object check (insertion site at :144).
// Lines 239-256: serializeProjectFile — line 254 currently writes `documentation: {}, // D-148 reserved slot`.
// Lines 321-339: materializeProjectFile — line 335 currently passes through `documentation: file.documentation`.
// Line 67: V_LATEST = 1 (DO NOT BUMP — D-148 forward-compat slot).

export type ValidateResult =
  | { ok: true; project: ProjectFile }
  | { ok: false; error: { kind: 'invalid-shape' | 'unknown-version' | 'newer-version'; message: string } };
```

From src/shared/types.ts (existing — extend):

```typescript
// Line 555: SerializableError union includes 'ProjectFileParseError' (the envelope our 'invalid-shape' rejection surfaces as).
// Lines 466-506: SkeletonSummary interface — events field inserted after :476 animations.
// Lines 640-651: ProjectFileV1.documentation: object → Documentation.
// Lines 660-669: AppSessionState — add documentation: Documentation.
// Lines 7-15: structuredClone-safety docblock (every Documentation field MUST be primitive/array/plain-object).
// Line 807-809: Api interface project:save / saveProjectAs lines — Phase 20 adds exportDocumentationHtml after these.
```

From src/main/summary.ts (existing — extend):

```typescript
// Lines 113-130: summary builder return — bones, slots, attachments, skins, animations all use the
// `{ count: ..length, names: ..map((x) => x.name) }` shape. Insert events field after animations.
```

From node_modules/@esotericsoftware/spine-core/dist/SkeletonData.d.ts:55-56:

```typescript
/** The skeleton's events. */
events: EventData[];
```

EventData has a `.name: string` field (verified in EventData.d.ts).
</interfaces>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create src/core/documentation.ts (types + DEFAULT_DOCUMENTATION + validateDocumentation)</name>
  <files>src/core/documentation.ts, tests/core/documentation.spec.ts</files>
  <read_first>
    - src/core/project-file.ts (lines 1-80 for file-top imports + ValidateResult shape; lines 84-202 for the per-field guard idiom to mirror)
    - src/shared/types.ts (lines 7-15 for the structuredClone-safety docblock; lines 535-571 for the SerializableError union)
    - .planning/phases/20-documentation-builder-feature/20-CONTEXT.md (D-01..D-04 — type shape and validator strategy)
    - .planning/phases/20-documentation-builder-feature/20-RESEARCH.md lines 287-401 (full validateDocumentation reference impl)
    - tests/core/project-file.spec.ts (lines 18-89 for the validator-rejection-per-field test idiom to mirror)
  </read_first>
  <behavior>
    - Test 1: validateDocumentation rejects null, 42, "foo", and an array (returns { ok: false, error: { kind: 'invalid-shape' } })
    - Test 2: validateDocumentation rejects when animationTracks is not an array (message includes "documentation.animationTracks is not an array")
    - Test 3: validateDocumentation rejects an animationTracks entry with empty id, non-finite mixTime, non-boolean loop, or non-string notes (per-field error message references the offending field path)
    - Test 4: validateDocumentation rejects events/controlBones/skins entries with empty name or non-string description
    - Test 5: validateDocumentation rejects safetyBufferPercent values outside [0, 100] or non-finite
    - Test 6: validateDocumentation accepts DEFAULT_DOCUMENTATION (returns { ok: true, doc })
    - Test 7: validateDocumentation accepts a representative non-empty Documentation with one entry per array
    - Test 8: DEFAULT_DOCUMENTATION shape: animationTracks=[], events=[], generalNotes='', controlBones=[], skins=[], safetyBufferPercent=0
    - Test 9: intersectDocumentationWithSummary — drift drops controlBones whose name is not in summary.bones.names
    - Test 10: intersectDocumentationWithSummary — drift filters animationTracks whose animationName is not in summary.animations.names
    - Test 11: intersectDocumentationWithSummary — drift produces events array of length summary.events.count, preserving existing descriptions for matched names and using empty descriptions for new ones (order = summary.events.names order)
    - Test 12: intersectDocumentationWithSummary — drift produces skins array of length summary.skins.count, preserving existing descriptions for matched names and using empty descriptions for new ones
    - Test 13: intersectDocumentationWithSummary — generalNotes and safetyBufferPercent flow through unchanged
    - Test 14: intersectDocumentationWithSummary — descriptions on rebind: when an event was previously described and the skeleton still contains it, the description survives (does not reset to '')
  </behavior>
  <action>
Create `src/core/documentation.ts` as a Layer 3 pure-TS module. **Imports allowed:** type-only imports from `'../shared/types.js'` (if needed for cross-references — none required for this file). **Forbidden imports:** `node:fs`, `node:fs/promises`, `electron`, `sharp`, `react`, any DOM types. The arch.spec.ts gate (`tests/arch.spec.ts:116-134`) will fail CI if any of these slip in.

Define and export the following interfaces (per CONTEXT.md D-01, D-02; structuredClone-safe per shared/types.ts:7-15):

```typescript
// src/core/documentation.ts
//
// Phase 20 D-01..D-04 — typed shape for the .stmproj v1 reserved
// `documentation: object` slot (D-148 forward-compat). Pure-TS Layer 3
// module: NO DOM, NO fs, NO electron. Only primitives + arrays + plain
// objects (structuredClone-safe per src/shared/types.ts:7-15 docblock).

export interface AnimationTrackEntry {
  id: string;             // crypto.randomUUID() at create-time
  trackIndex: number;     // 0, 1, 2, ... — Spine mix-track number (D-05)
  animationName: string;  // must match a name in summary.animations.names
  mixTime: number;        // seconds; default 0.25 per DOC-02
  loop: boolean;
  notes: string;
}

export interface EventDescriptionEntry { name: string; description: string; }
export interface BoneDescriptionEntry { name: string; description: string; }
export interface SkinDescriptionEntry { name: string; description: string; }

export interface Documentation {
  animationTracks: AnimationTrackEntry[];
  events: EventDescriptionEntry[];
  generalNotes: string;
  controlBones: BoneDescriptionEntry[];
  skins: SkinDescriptionEntry[];
  safetyBufferPercent: number;     // [0, 100], metadata only this phase per D-22
}

export const DEFAULT_DOCUMENTATION: Documentation = {
  animationTracks: [],
  events: [],
  generalNotes: '',
  controlBones: [],
  skins: [],
  safetyBufferPercent: 0,
};

export type DocumentationValidateResult =
  | { ok: true; doc: Documentation }
  | { ok: false; error: { kind: 'invalid-shape'; message: string } };

export function validateDocumentation(input: unknown): DocumentationValidateResult {
  // Per CONTEXT.md D-04: per-field hand-rolled guards. Reuses 'invalid-shape'
  // kind which surfaces as `ProjectFileParseError` via shared/types.ts:555.
  // NO 9th SerializableError kind added.
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: { kind: 'invalid-shape', message: 'documentation is not an object' } };
  }
  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.animationTracks)) {
    return { ok: false, error: { kind: 'invalid-shape', message: 'documentation.animationTracks is not an array' } };
  }
  for (let i = 0; i < obj.animationTracks.length; i++) {
    const e = obj.animationTracks[i] as Record<string, unknown>;
    if (!e || typeof e !== 'object' || Array.isArray(e)) {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.animationTracks[${i}] is not an object` } };
    }
    if (typeof e.id !== 'string' || e.id.length === 0) {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.animationTracks[${i}].id is not a non-empty string` } };
    }
    if (typeof e.trackIndex !== 'number' || !Number.isFinite(e.trackIndex) || e.trackIndex < 0) {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.animationTracks[${i}].trackIndex is not a non-negative finite number` } };
    }
    if (typeof e.animationName !== 'string') {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.animationTracks[${i}].animationName is not a string` } };
    }
    if (typeof e.mixTime !== 'number' || !Number.isFinite(e.mixTime) || e.mixTime < 0) {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.animationTracks[${i}].mixTime is not a non-negative finite number` } };
    }
    if (typeof e.loop !== 'boolean') {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.animationTracks[${i}].loop is not a boolean` } };
    }
    if (typeof e.notes !== 'string') {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.animationTracks[${i}].notes is not a string` } };
    }
  }

  for (const key of ['events', 'controlBones', 'skins'] as const) {
    if (!Array.isArray(obj[key])) {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.${key} is not an array` } };
    }
    const arr = obj[key] as unknown[];
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i] as Record<string, unknown>;
      if (!e || typeof e !== 'object' || Array.isArray(e)) {
        return { ok: false, error: { kind: 'invalid-shape', message: `documentation.${key}[${i}] is not an object` } };
      }
      if (typeof e.name !== 'string' || e.name.length === 0) {
        return { ok: false, error: { kind: 'invalid-shape', message: `documentation.${key}[${i}].name is not a non-empty string` } };
      }
      if (typeof e.description !== 'string') {
        return { ok: false, error: { kind: 'invalid-shape', message: `documentation.${key}[${i}].description is not a string` } };
      }
    }
  }

  if (typeof obj.generalNotes !== 'string') {
    return { ok: false, error: { kind: 'invalid-shape', message: 'documentation.generalNotes is not a string' } };
  }

  if (
    typeof obj.safetyBufferPercent !== 'number' ||
    !Number.isFinite(obj.safetyBufferPercent) ||
    obj.safetyBufferPercent < 0 ||
    obj.safetyBufferPercent > 100
  ) {
    return { ok: false, error: { kind: 'invalid-shape', message: 'documentation.safetyBufferPercent is not a finite number in [0, 100]' } };
  }

  return { ok: true, doc: obj as unknown as Documentation };
}
```

Then APPEND the drift-policy helper at the bottom of `src/core/documentation.ts` (after `validateDocumentation`). The helper is called by `AppShell` on every materialize/load so the modal-internal documentation state always matches the live skeleton (resolves Plan 02 BLOCKER 3 — single call site, single test surface):

```typescript
// Phase 20 D-09/D-10/D-11 — drift policy. Pure function called from AppShell
// on every materialize/load. Mirrors Phase 8 D-150 stale-overrides intersection.
//
// Semantics:
//   events       — produced from summary.events.names; existing descriptions
//                  preserved by name-match; missing entries get description=''.
//   controlBones — filtered to names present in summary.bones.names; opt-in
//                  shape (only documented bones survive D-10).
//   skins        — produced from summary.skins.names; existing descriptions
//                  preserved by name-match; missing entries get description=''.
//   animationTracks — filtered to entries whose animationName is in
//                     summary.animations.names; orphans dropped.
//   generalNotes / safetyBufferPercent — flow through unchanged (no drift).
//
// Layer 3 invariant: type-only import from shared/types.ts, no DOM/electron/fs.
//
// IMPORTANT for the executor: this function does not need to import the full
// SkeletonSummary type from shared/types.ts to stay Layer 3 — the input
// shape is narrow enough to declare a structural interface. If a type-only
// import is preferred, it must be `import type { SkeletonSummary }` only
// (no runtime import) and SkeletonSummary already lives in shared/types.ts
// which is already accessible from src/core/* via the existing precedent
// (e.g. project-file.ts already imports types from '../shared/types.js').

import type { SkeletonSummary } from '../shared/types.js';

export function intersectDocumentationWithSummary(
  doc: Documentation,
  summary: SkeletonSummary,
): Documentation {
  // Events: produce from summary.events.names; preserve existing descriptions.
  const eventDescByName = new Map<string, string>();
  for (const e of doc.events) eventDescByName.set(e.name, e.description);
  const events: EventDescriptionEntry[] = summary.events.names.map((n) => ({
    name: n,
    description: eventDescByName.get(n) ?? '',
  }));

  // Skins: produce from summary.skins.names; preserve existing descriptions.
  const skinDescByName = new Map<string, string>();
  for (const s of doc.skins) skinDescByName.set(s.name, s.description);
  const skins: SkinDescriptionEntry[] = summary.skins.names.map((n) => ({
    name: n,
    description: skinDescByName.get(n) ?? '',
  }));

  // Control bones: filter to names still in skeleton (opt-in semantics; D-10
  // saves only documented bones, so filtering is the entire drift policy).
  const skeletonBones = new Set(summary.bones.names);
  const controlBones: BoneDescriptionEntry[] = doc.controlBones.filter((b) =>
    skeletonBones.has(b.name),
  );

  // Animation tracks: filter to entries whose animationName is still present.
  const skeletonAnimations = new Set(summary.animations.names);
  const animationTracks: AnimationTrackEntry[] = doc.animationTracks.filter(
    (t) => skeletonAnimations.has(t.animationName),
  );

  return {
    animationTracks,
    events,
    generalNotes: doc.generalNotes,
    controlBones,
    skins,
    safetyBufferPercent: doc.safetyBufferPercent,
  };
}
```

Then create `tests/core/documentation.spec.ts` mirroring `tests/core/project-file.spec.ts:18-89`. Each per-field rejection test asserts `r.ok === false` and `r.error.kind === 'invalid-shape'` and that `r.error.message` matches the expected field path (use `expect(r.error.message).toContain('documentation.animationTracks[0].mixTime')` style assertions). Include the eight test cases listed in `<behavior>` above.

Required test imports:
```typescript
import { describe, it, expect } from 'vitest';
import {
  validateDocumentation,
  DEFAULT_DOCUMENTATION,
  intersectDocumentationWithSummary,
  type Documentation,
} from '../../src/core/documentation.js';
import type { SkeletonSummary } from '../../src/shared/types.js';
```

Add a `describe('intersectDocumentationWithSummary (drift policy)')` block covering Tests 9-14 above. Use a small helper to build a minimal `SkeletonSummary` that supplies `bones.names`, `skins.names`, `animations.names`, and `events.names` (the only fields the function reads); cast via `as SkeletonSummary` is acceptable in tests. Each test asserts the returned object's `events` / `skins` / `controlBones` / `animationTracks` arrays against expected shapes; the existing `expect(...).toEqual(...)` idiom is sufficient.

Run RED first (no implementation), then GREEN (implementation makes tests pass), then REFACTOR if needed.
  </action>
  <verify>
    <automated>npm run test -- tests/core/documentation.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - File `src/core/documentation.ts` exists
    - `grep -c "export interface Documentation" src/core/documentation.ts` returns 1
    - `grep -c "export const DEFAULT_DOCUMENTATION" src/core/documentation.ts` returns 1
    - `grep -c "export function validateDocumentation" src/core/documentation.ts` returns 1
    - `grep -E "from 'node:fs|from 'electron|from 'sharp|from 'react" src/core/documentation.ts` returns NOTHING (Layer 3 invariant)
    - `grep -E "^import" src/core/documentation.ts` returns NOTHING or only type-only imports from `'../shared/types.js'` (no runtime imports)
    - File `tests/core/documentation.spec.ts` exists with at least 13 `it(` blocks
    - `grep -c "export function intersectDocumentationWithSummary" src/core/documentation.ts` returns 1
    - `grep -c "intersectDocumentationWithSummary" tests/core/documentation.spec.ts` returns at least 6 (one per drift test + import)
    - `npm run test -- tests/core/documentation.spec.ts` exits 0
    - `npm run test -- tests/arch.spec.ts` exits 0 (Layer 3 grep gate passes)
  </acceptance_criteria>
  <done>
    Documentation interface, four entry interfaces, DEFAULT_DOCUMENTATION constant, validateDocumentation function, DocumentationValidateResult type, AND intersectDocumentationWithSummary drift helper exported from `src/core/documentation.ts`. Per-field validator rejections covered by vitest with explicit field-path assertions. Drift behavior covered by 6+ tests (orphan-bone drop, orphan-track drop, missing-skin add, missing-event add, description preservation on rebind, scalar passthrough). Layer 3 invariant preserved (only `import type { SkeletonSummary }` is allowed at runtime).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire validator into project-file.ts + extend types.ts + summary.ts</name>
  <files>src/core/project-file.ts, src/shared/types.ts, src/main/summary.ts, tests/core/project-file.spec.ts</files>
  <read_first>
    - src/core/project-file.ts (full file — focus on lines 84-202 validator, 239-256 serializer, 321-339 materializer)
    - src/shared/types.ts (lines 460-510 SkeletonSummary, 640-680 ProjectFileV1 + AppSessionState, 800-830 Api interface)
    - src/main/summary.ts (lines 113-130 summary builder return)
    - tests/core/project-file.spec.ts (lines 92-125 round-trip tests)
    - .planning/phases/20-documentation-builder-feature/20-PATTERNS.md (lines 576-685 EXTEND patterns)
    - .planning/phases/20-documentation-builder-feature/20-RESEARCH.md lines 1072-1117 (insertion-site code excerpts)
  </read_first>
  <behavior>
    - Test 1: round-trip preserves DEFAULT_DOCUMENTATION on serialize → JSON.parse → validate → materialize (bit-equal via toEqual)
    - Test 2: round-trip preserves a non-empty Documentation (one animationTrack, one event, one bone, one skin, generalNotes='Hello\nworld', safetyBufferPercent=5) bit-equal
    - Test 3: validateProjectFile rejects a project with documentation: { animationTracks: 'not-array' } and surfaces error.kind === 'invalid-shape'
    - Test 4: materializeProjectFile back-fills DEFAULT_DOCUMENTATION when file.documentation is {} (Phase 8-era forward-compat — Pitfall 9)
  </behavior>
  <action>
**Step A — Extend `src/core/project-file.ts`:**

Add file-top import after the existing imports (around line 30):

```typescript
import { validateDocumentation, DEFAULT_DOCUMENTATION, type Documentation } from './documentation.js';
```

In `validateProjectFile`, REPLACE the existing object-shape guard at lines 135-144 (the `if (!obj.documentation || typeof obj.documentation !== 'object' || Array.isArray(obj.documentation))` block) with the forward-compat pre-massage + per-field validator call:

```typescript
// Phase 20 D-148 forward-compat — Phase 8-era .stmproj files have either no
// `documentation` key OR `documentation: {}` (D-148 reserved slot). Pre-massage
// so the strict per-field validator below sees a known-shape default. Without
// this pre-massage the validator REJECTS Phase 8-era files at the entry point
// and the materializer back-fill never runs (resolves Open Question #2).
if (
  obj.documentation == null ||
  (typeof obj.documentation === 'object' &&
    !Array.isArray(obj.documentation) &&
    Object.keys(obj.documentation as object).length === 0)
) {
  obj.documentation = { ...DEFAULT_DOCUMENTATION };
}

// Per-Phase-8 invariant retained: documentation must still be an object after
// the pre-massage (rejects null, primitives, arrays).
if (
  !obj.documentation ||
  typeof obj.documentation !== 'object' ||
  Array.isArray(obj.documentation)
) {
  return {
    ok: false,
    error: { kind: 'invalid-shape', message: 'documentation is not an object' },
  };
}

// Phase 20 D-04 — per-field validation of the documentation slot.
// Reuses 'invalid-shape' kind (no 9th SerializableError).
const docResult = validateDocumentation(obj.documentation);
if (!docResult.ok) {
  return { ok: false, error: docResult.error };
}
```

The materializer back-fill in Step A's later instruction (`{ ...DEFAULT_DOCUMENTATION, ...file.documentation }`) STAYS AS-IS — it remains as defence in depth: if any future code path constructs a `ProjectFileV1` literal that bypasses the validator, the materializer still produces the full 6-key shape.

In `serializeProjectFile`, REPLACE the `documentation: {}` literal at line 254 with:

```typescript
documentation: state.documentation,
```

In `materializeProjectFile`, REPLACE the existing `documentation: file.documentation` passthrough at line 335 with the forward-compat default (Pitfall 9 Option A):

```typescript
// Phase 20 — forward-compat default. Phase 8-era .stmproj files have
// documentation:{}; back-fill missing keys so the materialized AppSessionState
// is always the full 6-key shape the renderer expects.
documentation: { ...DEFAULT_DOCUMENTATION, ...file.documentation },
```

**Step B — Extend `src/shared/types.ts`:**

Add at the top of the file (with the other imports, type-only):

```typescript
import type { Documentation } from '../core/documentation.js';
export type {
  Documentation,
  AnimationTrackEntry,
  EventDescriptionEntry,
  BoneDescriptionEntry,
  SkinDescriptionEntry,
} from '../core/documentation.js';
// Phase 20 D-01 + drift policy — runtime re-exports so the renderer (which
// must NOT import from src/core/* directly per arch.spec.ts:19-34) can pull
// these through the shared/types boundary.
export { DEFAULT_DOCUMENTATION, intersectDocumentationWithSummary, validateDocumentation } from '../core/documentation.js';
```

In `SkeletonSummary` (lines 466-506), INSERT after the existing `animations: { count: number; names: string[] };` field (around line 476):

```typescript
// Phase 20 D-09 — auto-discovery source for documentation events sub-section.
events: { count: number; names: string[] };
```

In `ProjectFileV1` (lines 640-651), CHANGE `documentation: object` to:

```typescript
documentation: Documentation;  // Phase 20 D-01 — typed via core/documentation.ts
```

In `AppSessionState` (lines 660-669), ADD as the last field (after `sortDir`):

```typescript
documentation: Documentation;  // Phase 20 D-01 — drives serializeProjectFile :254
```

UPDATE the docblock at lines 655-659 — the existing comment says "Same shape as ProjectFileV1 minus `version` and `documentation` (those are stamped by serializeProjectFile)". Phase 20 invalidates the `documentation` exclusion. Replace with:

```typescript
/**
 * AppSessionState — the editable session shape. Same as ProjectFileV1 minus
 * `version` (stamped by serializeProjectFile). `documentation` is now part
 * of the editable session per Phase 20 D-01 (was reserved-only in Phase 8).
 */
```

**Step C — Extend `src/main/summary.ts`:**

In the summary builder's return (lines 113-130, after the existing `animations: { count, names }` field and BEFORE `peaks`), INSERT:

```typescript
events: {
  count: skeletonData.events.length,
  names: skeletonData.events.map((e) => e.name),
},
```

This reads from `@esotericsoftware/spine-core` `SkeletonData.events: EventData[]` (verified in node_modules/.../SkeletonData.d.ts:55-56).

**Step D — Extend `tests/core/project-file.spec.ts`:**

UPDATE the existing `documentation slot preserved on round-trip` test at lines 111-125 to use `DEFAULT_DOCUMENTATION` instead of the empty `{}` literal:

```typescript
import { DEFAULT_DOCUMENTATION, type Documentation } from '../../src/core/documentation.js';
```

In any test state object (`AppSessionState` literal), ADD `documentation: DEFAULT_DOCUMENTATION` to the object (the field is now required by the type).

UPDATE the existing assertion `expect(file.documentation).toEqual({})` to `expect(file.documentation).toEqual(DEFAULT_DOCUMENTATION)`.

ADD two NEW tests in the `round-trip` describe block:

```typescript
it('round-trip preserves a non-empty Documentation (DOC-05)', () => {
  const doc: Documentation = {
    animationTracks: [
      { id: 'uuid-1', trackIndex: 0, animationName: 'walk', mixTime: 0.25, loop: true, notes: 'Primary loop' },
    ],
    events: [{ name: 'shoot', description: 'Fires when ammo expended' }],
    generalNotes: 'Multi-line\nnotes\nhere.',
    controlBones: [{ name: 'CHAIN_2', description: 'Spine root' }],
    skins: [{ name: 'default', description: 'The default skin' }],
    safetyBufferPercent: 5,
  };
  const state: AppSessionState = { /* full minimal state with documentation: doc */ };
  const file = serializeProjectFile(state, '/tmp/test.stmproj');
  const json = JSON.stringify(file);
  const parsed = JSON.parse(json);
  const v = validateProjectFile(parsed);
  expect(v.ok).toBe(true);
  if (!v.ok) return;
  const mat = materializeProjectFile(v.project, '/tmp/test.stmproj');
  expect(mat.documentation).toEqual(doc);
});

it('materializer back-fills DEFAULT_DOCUMENTATION for Phase 8-era empty {} slot (Pitfall 9)', () => {
  // Simulate an old .stmproj with documentation:{} written by Phase 8.
  const oldFile = {
    version: 1,
    skeletonPath: '/a/b/SIMPLE.json',
    /* ... full minimal v1 fields ... */
    documentation: {} as Documentation,
  };
  const mat = materializeProjectFile(oldFile, '/a/b/proj.stmproj');
  expect(mat.documentation).toEqual(DEFAULT_DOCUMENTATION);
});

it('Phase 8-era full pipeline (validate → materialize) accepts empty {} and yields DEFAULT_DOCUMENTATION', () => {
  // The CRITICAL forward-compat test: Phase 8-era `.stmproj` files have
  // `documentation: {}` literally on disk. Without the validator pre-massage
  // this test fails because validateProjectFile rejects {} at the strict
  // per-field guards (animationTracks not array, etc.). With the pre-massage,
  // the empty {} is treated as a missing slot and DEFAULT_DOCUMENTATION is
  // substituted before the per-field guards run.
  const phase8Era = {
    version: 1,
    skeletonPath: '/a/b/SIMPLE.json',
    atlasPath: null,
    imagesDir: null,
    overrides: {},
    samplingHz: null,
    lastOutDir: null,
    sortColumn: null,
    sortDir: null,
    documentation: {},
  };
  const v = validateProjectFile(phase8Era);
  expect(v.ok).toBe(true);
  if (!v.ok) return;
  const mat = materializeProjectFile(v.project, '/a/b/proj.stmproj');
  expect(mat.documentation).toEqual(DEFAULT_DOCUMENTATION);
});

it('Phase 8-era full pipeline accepts MISSING documentation field (legacy v1 wire shape)', () => {
  // Equally important: a hypothetical legacy v1 file with no `documentation`
  // key at all (the field was added LATE in v1.0 Phase 8 D-148; very old
  // saves may predate it). The validator pre-massage handles undefined too.
  const ancientEra = {
    version: 1,
    skeletonPath: '/a/b/SIMPLE.json',
    atlasPath: null,
    imagesDir: null,
    overrides: {},
    samplingHz: null,
    lastOutDir: null,
    sortColumn: null,
    sortDir: null,
    // NOTE: no `documentation` key.
  };
  const v = validateProjectFile(ancientEra);
  expect(v.ok).toBe(true);
  if (!v.ok) return;
  const mat = materializeProjectFile(v.project, '/a/b/proj.stmproj');
  expect(mat.documentation).toEqual(DEFAULT_DOCUMENTATION);
});

it('validator rejects malformed documentation slot', () => {
  const bad = {
    version: 1,
    skeletonPath: '/a/b/SIMPLE.json',
    /* ... minimal v1 fields ... */
    documentation: { animationTracks: 'not-an-array' /* missing other keys */ },
  };
  const r = validateProjectFile(bad);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.kind).toBe('invalid-shape');
});
```

If existing other test files construct `AppSessionState` literals that no longer typecheck (missing `documentation` field), grep them and add `documentation: DEFAULT_DOCUMENTATION` to each. Likely candidates: `tests/core/project-file.spec.ts` only — but verify by running `npm run typecheck` (or `npx tsc --noEmit`).
  </action>
  <verify>
    <automated>npm run test -- tests/core/project-file.spec.ts tests/core/documentation.spec.ts tests/arch.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "validateDocumentation(obj.documentation)" src/core/project-file.ts` returns 1
    - `grep -c "documentation: state.documentation" src/core/project-file.ts` returns 1
    - `grep -c "DEFAULT_DOCUMENTATION, ...file.documentation" src/core/project-file.ts` returns 1
    - `grep -c "documentation: Documentation" src/shared/types.ts` returns at least 2 (ProjectFileV1 + AppSessionState)
    - `grep -c "events: { count: number; names: string\[\] }" src/shared/types.ts` returns 1
    - `grep -c "skeletonData.events.length" src/main/summary.ts` returns 1
    - `grep -c "skeletonData.events.map" src/main/summary.ts` returns 1
    - `grep -c "DEFAULT_DOCUMENTATION" tests/core/project-file.spec.ts` returns at least 2
    - `grep -c "Phase 8-era full pipeline" tests/core/project-file.spec.ts` returns at least 2 (the validate-then-materialize tests for empty {} AND missing-field cases)
    - `grep -cE "obj\.documentation == null|Object\.keys\(obj\.documentation as object\)\.length === 0" src/core/project-file.ts` returns at least 1 (validator pre-massage block landed)
    - `npm run test -- tests/core/project-file.spec.ts` exits 0
    - `npm run test -- tests/arch.spec.ts` exits 0 (Layer 3 grep gate)
    - `npm run test` full suite exits 0 (no regressions in other tests; existing AppSessionState literals updated where needed)
  </acceptance_criteria>
  <done>
    `validateProjectFile` pre-massages missing/empty documentation slots to `DEFAULT_DOCUMENTATION` before per-field guards (Phase 8-era forward-compat), then rejects malformed sub-shapes via `validateDocumentation`. `serializeProjectFile` writes `state.documentation` (not `{}`). `materializeProjectFile` back-fills `DEFAULT_DOCUMENTATION` for Phase 8-era empty slots (defence in depth). `AppSessionState` and `ProjectFileV1.documentation` are typed as `Documentation`. `SkeletonSummary.events` populated from `skeletonData.events` in `summary.ts`. Round-trip identity (DOC-05) test green for both empty and non-empty Documentation, and the full-pipeline forward-compat test (validate → materialize on Phase 8-era `documentation: {}`) is green. No arch.spec.ts regressions.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| disk → core/project-file.ts | A `.stmproj` file on disk is parsed JSON of unknown shape; the validator is the trust gate before the renderer/main consume the documentation slot |
| renderer → IPC payload | (Future plans) renderer-supplied Documentation crosses IPC into main; validator semantics here lock the shape main can rely on |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-01 | Tampering / Information Disclosure | `validateDocumentation` | mitigate | Per-field hand-rolled type guards reject any non-conforming shape with explicit `'invalid-shape'` errors. Reuses existing `ProjectFileParseError` envelope; no new error kind enables silent acceptance. Acceptance criterion: tests/core/documentation.spec.ts proves rejection paths for each field. |
| T-20-02 | Denial of Service | `validateDocumentation` array loops | accept | Per-element loops are O(n) over arrays of plain objects; no quadratic growth. `.stmproj` files are user-authored; arbitrarily large arrays would already be a self-DoS via JSON.parse. No additional limit imposed (matches Phase 8 stance for `overrides` Record). |
| T-20-03 | Tampering | `validateProjectFile` pre-massage + `materializeProjectFile` forward-compat default | mitigate | Validator pre-massage substitutes `DEFAULT_DOCUMENTATION` ONLY when documentation is undefined or empty `{}`; populated objects flow through the per-field guards unchanged. Materializer spread `{ ...DEFAULT_DOCUMENTATION, ...file.documentation }` only back-fills MISSING keys; user-supplied keys override defaults — matching their on-disk state. The validator gates per-field shape, so the spread is always over a known-good Documentation. |
| T-20-04 | Layer 3 invariant violation | `src/core/documentation.ts` | mitigate | Pure-TS only: no `node:fs`, no `electron`, no DOM types, no `sharp`. Enforced by `tests/arch.spec.ts:116-134` grep gate. Acceptance criterion: `grep -E "from 'node:fs|from 'electron|from 'sharp" src/core/documentation.ts` returns nothing. |
| T-20-05 | Information Disclosure (round-trip drift) | `materializeProjectFile` + future renderer drift policy | accept (this plan) | Phase 20 D-09/D-10/D-11 specify drift = silent drop of stale entries on reload. The drop is documented behavior, not a leak. Renderer-side intersection lands in a later plan; this plan only ensures the validator does not reject Phase 8-era `documentation:{}` files (covered by materializer back-fill). |
| T-20-06 | Tampering (structuredClone failure) | `Documentation` type used as IPC payload | mitigate | Documentation interface is only primitives + arrays + plain objects; no Maps, Sets, class instances, or Functions. Verified shape-by-shape against `src/shared/types.ts:7-15` docblock. |
</threat_model>

<verification>
After both tasks land:

1. `npm run test -- tests/core/documentation.spec.ts tests/core/project-file.spec.ts tests/arch.spec.ts` exits 0
2. `npm run test` full suite exits 0 (no regressions; AppSessionState literals updated where needed)
3. Layer 3 grep: `grep -E "from 'node:fs|from 'electron|from 'sharp" src/core/documentation.ts` returns NOTHING
4. Round-trip identity: a representative Documentation survives serialize → JSON.parse → validate → materialize bit-equal
5. Forward-compat: an old `.stmproj` with `documentation: {}` (or no `documentation` key at all) flows through `validateProjectFile` (pre-massage substitutes `DEFAULT_DOCUMENTATION`) and `materializeProjectFile` (defence-in-depth back-fill) to produce a session with `DEFAULT_DOCUMENTATION` — no validator rejection
</verification>

<success_criteria>
- `src/core/documentation.ts` exists with the typed interface, defaults, validator, and result-type export
- `validateProjectFile` rejects malformed documentation sub-shapes via `validateDocumentation` (no 9th SerializableError kind)
- `serializeProjectFile` writes the full 6-key documentation shape from `state.documentation`
- `materializeProjectFile` back-fills `DEFAULT_DOCUMENTATION` so Phase 8-era empty `{}` slots still load
- `AppSessionState`, `ProjectFileV1.documentation`, `SkeletonSummary.events` typed correctly
- `summary.ts` populates events from `skeletonData.events`
- All vitest tests in `tests/core/` and `tests/arch.spec.ts` pass
- DOC-03 (events auto-discovery source ready) and DOC-05 (round-trip identity contract proven) supported by this plan's deliverables
</success_criteria>

<output>
After completion, create `.planning/phases/20-documentation-builder-feature/20-01-core-types-validator-summary-SUMMARY.md` documenting:
- Documentation interface shape and defaults
- Validator extension points and error envelope (no new SerializableError kind)
- Forward-compat materializer default behavior
- summary.events field added
- Test surface added (per-field validator coverage + round-trip identity)
- Layer 3 invariant preserved (arch.spec.ts green)
</output>

# Phase 32: Spine 4.3-beta detect-and-warn + drop-zone version disclosure — Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 7 (5 modified, 2 new, 1 fixture set)
**Analogs found:** 7 / 7 (100% — every file has a strong in-repo analog; this phase is a textbook "extend existing pattern" change)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `src/core/loader.ts` (MODIFIED — add `checkSpine43Schema` predicate + sequential call site) | core / predicate-host | request-response (pure-fn, throws) | `src/core/loader.ts:119-134` (`checkSpineVersion` self-precedent) | exact |
| `src/core/errors.ts` (MODIFIED — branch `SpineVersionUnsupportedError` constructor message by `detectedVersion`) | error-class | data-shape | `src/core/errors.ts:83-95` (self) + `src/core/errors.ts:27-54` (`AtlasNotFoundError` two-message-line precedent) | exact (self) |
| `src/renderer/src/App.tsx:621-623` (MODIFIED — drop-zone idle copy + inline `<span>` v4.2 token) | renderer / inline JSX | static (no state) | `src/renderer/src/App.tsx:675` (inline `<span className="font-semibold text-danger">Skeleton not found:</span>` precedent) | role-match (same file, same surface) |
| `tests/core/loader-43-schema-guard-predicate.spec.ts` (NEW — predicate unit tests for `checkSpine43Schema`) | test / predicate-unit | request-response | `tests/core/loader-version-guard-predicate.spec.ts` (verbatim shape) | exact |
| `tests/core/loader-version-guard-predicate.spec.ts` (MODIFIED — invert "accepts 4.3.0" + "accepts 5.0.0" cases at lines 40-46 to expect-throw) | test / predicate-unit | request-response | self (in-place inversion) | exact (self) |
| `tests/core/loader-version-guard.spec.ts` (MODIFIED — add 4.3 fixture-driven loadSkeleton-rejection test block; OR new sibling file) | test / fixture-driven | file-I/O | `tests/core/loader-version-guard.spec.ts` (verbatim shape) | exact |
| `tests/core/errors-version.spec.ts` (MODIFIED — add 4.3+ branch message assertion) | test / class-shape | data-shape | self (extend existing describe block) | exact (self) |
| `fixtures/SPINE_4_3_TEST/` (NEW — synthetic JSON + atlas + 1 PNG mirroring SPINE_3_8_TEST shape) | test fixture | static data | `fixtures/SPINE_3_8_TEST/` (verbatim shape) | exact |
| `.planning/seeds/SEED-006-spine-4.3-runtime-port.md` (NEW — costed inventory plant) | planning / seed | static data | `.planning/seeds/SEED-003-spine-4.3-compatibility.md` (verbatim frontmatter + section shape) | exact |

---

## Pattern Assignments

### `src/core/loader.ts` — `checkSpine43Schema` predicate (NEW) + sequential call site (MODIFIED)

**Analog:** `src/core/loader.ts:119-134` (the existing `checkSpineVersion` predicate is the direct precedent — same module, same return-void-or-throw shape, same `SpineVersionUnsupportedError` throw, same skeletonPath plumbing).

**Imports already present** (lines 30-47 — no new imports needed; `SpineVersionUnsupportedError` already imported from `./errors.js`):
```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AtlasAttachmentLoader,
  SkeletonJson,
  TextureAtlas,
  Texture,
  TextureFilter,
  TextureWrap,
} from '@esotericsoftware/spine-core';
import type { LoadResult, LoaderOptions, SourceDims } from './types.js';
import {
  AtlasNotFoundError,
  AtlasParseError,
  RotatedRegionUnsupportedError,
  SkeletonJsonNotFoundError,
  SpineVersionUnsupportedError,
} from './errors.js';
```

**Predicate-doc-comment + signature pattern** (copy from lines 92-119 — adapt to schema-walk semantics):
```typescript
/**
 * Phase 12 / Plan 05 (D-21) — F3 Spine version guard.
 *
 * Reject Spine JSON exported from versions < 4.2. CLAUDE.md documents
 * 4.2+ as the hard requirement; spine-core 4.2.x's SkeletonJson cannot
 * faithfully read 3.x bone-curve / attachment shapes, leading to silent
 * zero-output runs (Phase 11 §F3 reproduction in
 * `.planning/phases/11-…/11-WIN-FINDINGS.md`). The Optimize Assets path
 * reports success while producing zero usable images — F3 makes that
 * runtime-detectable with an actionable typed error.
 *
 * [...]
 *
 * Exported so the predicate's seven decision cases can be unit-tested
 * independently of fixture loading
 * (tests/core/loader-version-guard-predicate.spec.ts).
 *
 * @param version  the value of `skeleton.spine` from the parsed JSON, or null if absent.
 * @param skeletonPath  the absolute path to the skeleton JSON (for the error envelope).
 * @throws SpineVersionUnsupportedError if version is null, malformed, or major.minor < 4.2.
 */
export function checkSpineVersion(version: string | null, skeletonPath: string): void {
  // ...
  if (major < 4 || (major === 4 && minor < 2)) {
    throw new SpineVersionUnsupportedError(version, skeletonPath);
  }
}
```

**Predicate-body throw pattern to reuse for 4.3+ rejection** (lines 130-132 — same throw shape; new predicate uses sentinel `'4.3-schema'` for the schema-detection branch and the actual semver string for the version branch):
```typescript
if (major < 4 || (major === 4 && minor < 2)) {
  throw new SpineVersionUnsupportedError(version, skeletonPath);
}
```

**Sequential call-site pattern** (lines 171-184 — the existing version-guard insertion site after `JSON.parse`, before atlas resolution; the new schema predicate slots in immediately AFTER this block, before the `// 2. Resolve atlas` comment at line 288):
```typescript
const parsedJson: unknown = JSON.parse(jsonText);
if (parsedJson !== null && typeof parsedJson === 'object' && 'skeleton' in parsedJson) {
  const skel = (parsedJson as Record<string, unknown>).skeleton;
  if (skel !== null && typeof skel === 'object' && 'spine' in (skel as object)) {
    const spineField = (skel as Record<string, unknown>).spine;
    checkSpineVersion(typeof spineField === 'string' ? spineField : null, skeletonPath);
  } else {
    // skeleton object present but no spine field (pre-3.7 export).
    checkSpineVersion(null, skeletonPath);
  }
} else {
  // No skeleton object at all — malformed JSON or wrong file type.
  checkSpineVersion(null, skeletonPath);
}
// NEW: schema-based fallback for the < 4.3 / no-spine-field cases that slipped through.
// checkSpine43Schema(parsedJson, skeletonPath);
```

**`unknown`-narrowing pattern for object inspection** (lines 172-176 — use this exact narrowing approach for the new predicate's `parsedJson.constraints` walk; do NOT use untyped `as any` casts — the codebase's Layer-3 invariant tests assert no DOM types creep in):
```typescript
if (parsedJson !== null && typeof parsedJson === 'object' && 'skeleton' in parsedJson) {
  const skel = (parsedJson as Record<string, unknown>).skeleton;
  // ...
}
```

**Strict-cut update at lines 103-105 (existing comment must be updated):**
```
// Lenient on 4.3+ per CONTEXT.md Deferred ("4.3+ is not silently
// rejected, but it's also not actively supported"); a future phase
// can split this into a distinct "untested-version" warning surface.
```
→ replace with Phase 32 commentary explaining the strict-cut at 4.3+ now throws (semver-branch fires for honest 4.3 exports; schema-branch is defense-in-depth for 4.3 exports with malformed/missing `spine` field).

**Strict-cut update at lines 130-134 (existing predicate body):**
```typescript
if (major < 4 || (major === 4 && minor < 2)) {
  throw new SpineVersionUnsupportedError(version, skeletonPath);
}
// 4.2.x and 4.3+ pass.
```
→ extend the conditional to also reject `(major === 4 && minor >= 3) || major >= 5` (or equivalent), and update the trailing comment to "Only 4.2.x passes."

**Layer-3 invariant** (CLAUDE.md fact #5 + `tests/arch.spec.ts`): the new predicate is pure TypeScript object inspection — NO DOM, NO Electron, NO sharp imports. The existing `checkSpineVersion` predicate honors this trivially; the new predicate inherits the same constraint.

---

### `src/core/errors.ts` — `SpineVersionUnsupportedError` constructor message branching (MODIFIED)

**Analog:** `src/core/errors.ts:83-95` (self — the class is the precedent; only the message-template branch is new).

**Existing constructor pattern to extend** (lines 83-95 — keep `.name`, keep field shape, keep parent-class call; add a small message-template helper or inline ternary):
```typescript
export class SpineVersionUnsupportedError extends SpineLoaderError {
  constructor(
    public readonly detectedVersion: string,
    public readonly skeletonPath: string,
  ) {
    super(
      `This file was exported from Spine ${detectedVersion}. ` +
        `Spine Texture Manager requires Spine 4.2 or later. ` +
        `Re-export from Spine 4.2 or later in the editor.`,
    );
    this.name = 'SpineVersionUnsupportedError';
  }
}
```

**Branching pattern from a sibling class** (lines 27-54 — `AtlasNotFoundError`, the closest in-file precedent for a multi-line / templated `super(...)` message; the `SpineVersionUnsupportedError` change can mirror its readability):
```typescript
export class AtlasNotFoundError extends SpineLoaderError {
  constructor(
    public readonly searchedPath: string,
    public readonly skeletonPath: string,
  ) {
    super(
      `Spine projects require an .atlas file beside the .json (carries region metadata that the skeleton JSON alone does not have). ` +
        `Re-export from the Spine editor with the atlas included, or enable the "Use Images Folder as Source" toggle in the toolbar and reload.\n` +
        `  Skeleton: ${skeletonPath}\n  Expected atlas at: ${searchedPath}`,
    );
    this.name = 'AtlasNotFoundError';
  }
}
```

**Branch-discriminator pattern** (CONTEXT.md D-03): branch the message inside the constructor body BEFORE the `super(...)` call. Suggested shape (planner refines):
```typescript
constructor(
  public readonly detectedVersion: string,
  public readonly skeletonPath: string,
) {
  // 4.3+ branch — REQUIREMENTS.md L13 byte-locked message.
  // Triggered by literal '4.3-schema' sentinel OR semver parses to major.minor >= 4.3.
  // Pre-4.2 branch — preserves Phase 12 F3 contract.
  const message = isSpine43OrLater(detectedVersion)
    ? `This app currently supports Spine v4.2. Re-export from your 4.3 editor as Version 4.2 (supported downgrade) and try again.`
    : `This file was exported from Spine ${detectedVersion}. ` +
      `Spine Texture Manager requires Spine 4.2 or later. ` +
      `Re-export from Spine 4.2 or later in the editor.`;
  super(message);
  this.name = 'SpineVersionUnsupportedError';
}
```

**Discriminator helper signature precedent** (mirror the predicate-style at `loader.ts:119` — pure string parsing + integer comparison, exported only if needed for tests; otherwise file-private). The helper must accept the literal `'4.3-schema'` sentinel string AND parse a semver like `'4.3.91-beta'` into `major.minor`.

**LOAD-BEARING invariants** (do NOT change):
- `.name = 'SpineVersionUnsupportedError'` — IPC envelope routing at `src/main/ipc.ts:118-126` and KNOWN_KINDS Set match by `err.name`. Changing it breaks the renderer error surface.
- Constructor signature `(detectedVersion: string, skeletonPath: string)` — caller sites at `loader.ts:122`, `loader.ts:128`, `loader.ts:131` all pass these two args.
- `extends SpineLoaderError` chain — IPC forwarder at `src/main/sampler-worker.ts:163` does `instanceof SpineLoaderError`; breaking it routes the error as `kind: 'Unknown'`.

---

### `src/renderer/src/App.tsx:621-623` — drop-zone idle copy + inline `<span>` v4.2 token (MODIFIED)

**Analog:** `src/renderer/src/App.tsx:675` (the inline-`<span>` color-tokenization pattern is two-dozen lines below the modification site, in the same component, and is the closest visual sibling).

**Existing inline-span color-token pattern** (line 675, error banner — `font-semibold text-danger` is the existing in-app convention for inline emphasis; Phase 32 uses `font-bold` instead per UI-SPEC.md):
```tsx
<span className="font-semibold text-danger">Skeleton not found:</span>{' '}
{state.error.message}
```

**Existing drop-zone copy to modify** (lines 620-623, the `idle && !isElevated` branch; UI-SPEC.md Audit Anchors lock the new shape):
```tsx
) : (
  <p className="text-fg-muted font-mono text-sm">
    Drop a <code>.spine</code> JSON file anywhere in this window
  </p>
))}
```

**Target shape** (UI-SPEC.md byte-lock — drop-zone idle copy after Phase 32):
```tsx
) : (
  <p className="text-fg-muted font-mono text-sm">
    Drop a Spine <span className="font-bold text-danger">v4.2</span> <code>.spine</code> JSON file anywhere in this window
  </p>
))}
```

**Token-by-token diff** (UI-SPEC.md Copywriting Contract):
- `Drop a` → `Drop a Spine` (insert ` Spine`)
- Insert `<span className="font-bold text-danger">v4.2</span> ` before `<code>`
- `<code>.spine</code>` — unchanged
- `JSON file anywhere in this window` — unchanged

**OUT-OF-SCOPE callsite** (line 615-619, the `idle && isElevated` Windows-admin advisory branch — UI-SPEC.md Audit Anchor: "UNCHANGED — no v4.2 callout added"). Do not touch:
```tsx
<div role="status" className="max-w-md text-center text-sm text-fg-muted">
  <p>
    Drag-and-drop is unavailable while running as administrator. Use File → Open instead, or relaunch the app without administrator privileges.
  </p>
</div>
```

**OUT-OF-SCOPE error-banner block** (lines 660-697, the `state.status === 'projectLoadFailed'` branch — UI-SPEC.md Audit Anchor: "UNCHANGED — no className diffs, no JSX node additions/removals"). The new COMPAT-01 error message surfaces through `state.error.message` at line 676 with zero renderer changes:
```tsx
<span className="font-semibold text-danger">Skeleton not found:</span>{' '}
{state.error.message}
```

**Tailwind v4 literal-class discipline (Pitfall 8):** every className is a string literal — no template strings, no array `.join(' ')`. The new `<span>`'s className is `"font-bold text-danger"` (single literal).

---

### `tests/core/loader-43-schema-guard-predicate.spec.ts` — predicate unit tests for `checkSpine43Schema` (NEW)

**Analog:** `tests/core/loader-version-guard-predicate.spec.ts` (verbatim shape — same describe-blocks, same `expect(() => fn(...)).toThrow(ErrorClass)` pattern, same field-readback `try/catch` pattern, same `SKEL` constant pattern).

**Imports + setup pattern** (copy from lines 24-28 — adapt the imported predicate name):
```typescript
import { describe, expect, it } from 'vitest';
import { checkSpineVersion } from '../../src/core/loader.js';
import { SpineVersionUnsupportedError } from '../../src/core/errors.js';

const SKEL = '/tmp/skel.json';
```

**Accepted-cases describe block** (copy from lines 31-46 — adapt to "no `constraints` field" / "constraints field absent" / "skeleton without 4.3 markers" cases):
```typescript
describe('accepted versions (no throw)', () => {
  it('accepts 4.2.43 (the SIMPLE_PROJECT fixture version)', () => {
    expect(() => checkSpineVersion('4.2.43', SKEL)).not.toThrow();
  });

  it('accepts 4.2.0 (exact lower-bound)', () => {
    expect(() => checkSpineVersion('4.2.0', SKEL)).not.toThrow();
  });
});
```

**Rejection-cases describe block** (copy from lines 49-103 — same `try/catch` field-readback pattern; assert `detectedVersion === '4.3-schema'` for the new sentinel):
```typescript
describe('rejected versions (throws SpineVersionUnsupportedError)', () => {
  it('rejects 4.1.99 (just below the bar)', () => {
    expect(() => checkSpineVersion('4.1.99', SKEL)).toThrow(SpineVersionUnsupportedError);
    try {
      checkSpineVersion('4.1.99', SKEL);
    } catch (err) {
      expect((err as SpineVersionUnsupportedError).detectedVersion).toBe('4.1.99');
      expect((err as SpineVersionUnsupportedError).skeletonPath).toBe(SKEL);
    }
  });
});
```

**Suggested test cases for `checkSpine43Schema`** (CONTEXT.md D-05):
- `accepts {} (no constraints field)` — no throw
- `accepts { foo: 'bar' } (no constraints field)` — no throw
- `accepts pre-parsed objects without a top-level constraints field` — no throw
- `rejects { constraints: [...] }` (CONTEXT.md D-05 — empty array still rejects per "Recommendation: REJECT empty arrays")
- `rejects { constraints: [{type:'ik', ...}] }` (canonical 4.3 entry shape from SEED-003 §"4.3-beta JSON shape")
- `rejection error carries detectedVersion === '4.3-schema'` sentinel
- `rejection error carries the skeletonPath argument the caller passed`

---

### `tests/core/loader-version-guard-predicate.spec.ts` — invert "lenient on 4.3+" cases (MODIFIED)

**Analog:** self (in-place inversion).

**Existing assertions to invert** (lines 40-46):
```typescript
it('accepts 4.3.0 (lenient pass per CONTEXT Deferred — 4.3+ silent pass)', () => {
  expect(() => checkSpineVersion('4.3.0', SKEL)).not.toThrow();
});

it('accepts 5.0.0 (lenient on any future major)', () => {
  expect(() => checkSpineVersion('5.0.0', SKEL)).not.toThrow();
});
```

**Inverted shape** (mirror the existing rejection cases at lines 50-58 — `expect(...).toThrow(SpineVersionUnsupportedError)` + `try/catch` field readback for `detectedVersion`):
```typescript
it('rejects 4.3.0 (now strict-cut at 4.3+; Phase 32 COMPAT-01)', () => {
  expect(() => checkSpineVersion('4.3.0', SKEL)).toThrow(SpineVersionUnsupportedError);
  try {
    checkSpineVersion('4.3.0', SKEL);
  } catch (err) {
    expect((err as SpineVersionUnsupportedError).detectedVersion).toBe('4.3.0');
    expect((err as SpineVersionUnsupportedError).skeletonPath).toBe(SKEL);
  }
});

it('rejects 5.0.0 (no Spine 5 yet; reject pending future support phase)', () => {
  expect(() => checkSpineVersion('5.0.0', SKEL)).toThrow(SpineVersionUnsupportedError);
});
```

**The `accepts 4.2.43` and `accepts 4.2.0` assertions at lines 32-37 stay green byte-for-byte.** The describe-block header at line 30 may be re-worded (no longer "Phase 12 / Plan 05 / F3" alone — Phase 32 extends).

---

### `tests/core/loader-version-guard.spec.ts` — fixture-driven 4.3-rejection block (MODIFIED — extend, OR new sibling file)

**Analog:** `tests/core/loader-version-guard.spec.ts` (same file — copy the entire `describe('F3: Spine version guard rejects pre-4.2 fixtures', ...)` block at lines 33-90 verbatim, swap fixture path + assertion strings for 4.3 specifics).

**Fixture path constant pattern** (copy from lines 30-31 — add a sibling `FIXTURE_43`):
```typescript
const FIXTURE_38 = path.resolve('fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.json');
const FIXTURE_42 = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
// NEW:
const FIXTURE_43 = path.resolve('fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json');
```

**End-to-end rejection-test block** (copy from lines 33-89 — swap `FIXTURE_38` → `FIXTURE_43`, swap `'3.8.99'` → `'4.3.91-beta'` (or whatever the fixture's `skeleton.spine` field is), swap message-content assertions to the COMPAT-01 wording):
```typescript
describe('F3: Spine version guard rejects pre-4.2 fixtures', () => {
  it('loadSkeleton rejects Spine 3.8.99 fixture with typed SpineVersionUnsupportedError', () => {
    expect(() => loadSkeleton(FIXTURE_38)).toThrow(SpineVersionUnsupportedError);
  });

  it("Rejection error carries detectedVersion === '3.8.99'", () => {
    let caught: unknown;
    try {
      loadSkeleton(FIXTURE_38);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SpineVersionUnsupportedError);
    expect((caught as SpineVersionUnsupportedError).detectedVersion).toBe('3.8.99');
  });

  it("Rejection error message contains '3.8.99' AND 'Spine 4.2 or later' (CONTEXT D-21 wording)", () => {
    // [...]
    expect((caught as Error).message).toContain('3.8.99');
    expect((caught as Error).message).toContain('Spine 4.2 or later');
    expect((caught as Error).message).toContain('Re-export');
  });
});
```

**Suggested 4.3 test assertions** (CONTEXT.md COMPAT-01 message lock — verbatim from REQUIREMENTS.md L13):
- `loadSkeleton(FIXTURE_43)` throws `SpineVersionUnsupportedError`
- Error message contains `"This app currently supports Spine v4.2"`
- Error message contains `"Re-export from your 4.3 editor as Version 4.2"`
- Error message contains `"(supported downgrade)"`
- Error extends `SpineLoaderError` (so the IPC forwarder envelope arm fires)
- Error carries the skeletonPath argument

**Fixture-existence sentinels block** (copy from lines 92-122 — assert SPINE_4_3_TEST fixture file existence + `skeleton.spine === '4.3.91-beta'` + `constraints` array presence):
```typescript
describe('F3: fixture file existence sentinels', () => {
  it('3.8 skeleton JSON fixture exists at the expected path', () => {
    expect(fs.existsSync(FIXTURE_38)).toBe(true);
  });

  it("3.8 fixture's skeleton.spine field is the magic '3.8.99' string", () => {
    const json = JSON.parse(fs.readFileSync(FIXTURE_38, 'utf8')) as {
      skeleton: { spine: string };
    };
    expect(json.skeleton.spine).toBe('3.8.99');
  });
});
```

**Regression-belt assertion to preserve** (line 82-89 — keep the `loadSkeleton(FIXTURE_42)` happy-path assertion green to prove neither version-guard inversion NOR new schema predicate broke 4.2):
```typescript
it("REGRESSION: Spine 4.2.x fixture (SIMPLE_PROJECT) still loads successfully", () => {
  expect(() => loadSkeleton(FIXTURE_42)).not.toThrow();
});
```

---

### `tests/core/errors-version.spec.ts` — 4.3+ branch message assertion (MODIFIED)

**Analog:** self (extend existing describe block at lines 28-60).

**Existing class-shape assertion to keep** (lines 40-45 — preserves Phase 12 F3 contract; new test branch is ADDITIVE, not replacement):
```typescript
it("`.message` echoes detected version AND 'Spine 4.2 or later' remediation (CONTEXT D-21)", () => {
  const err = new SpineVersionUnsupportedError('3.8.99', '/foo/skel.json');
  expect(err.message).toContain('3.8.99');
  expect(err.message).toContain('Spine 4.2 or later');
  expect(err.message).toContain('Re-export');
});
```

**New test pattern to add** (mirror the existing test shape — single-line constructor call + `expect(...).toContain(...)` for each load-bearing fragment of the COMPAT-01 message):
```typescript
it("4.3+ branch message: detectedVersion === '4.3.91-beta' produces COMPAT-01 wording", () => {
  const err = new SpineVersionUnsupportedError('4.3.91-beta', '/foo/skel.json');
  expect(err.message).toContain('This app currently supports Spine v4.2');
  expect(err.message).toContain('Re-export from your 4.3 editor as Version 4.2');
  expect(err.message).toContain('supported downgrade');
});

it("4.3+ branch message: detectedVersion === '4.3-schema' sentinel produces COMPAT-01 wording", () => {
  const err = new SpineVersionUnsupportedError('4.3-schema', '/foo/skel.json');
  expect(err.message).toContain('This app currently supports Spine v4.2');
  expect(err.message).toContain('Re-export from your 4.3 editor as Version 4.2');
});
```

---

### `fixtures/SPINE_4_3_TEST/` — synthetic minimal fixture (NEW)

**Analog:** `fixtures/SPINE_3_8_TEST/` (verbatim shape — same three artifacts: `<NAME>.json`, `<NAME>.atlas`, `images/<region>.png`; same minimal-skeleton JSON envelope; same single-region atlas).

**Directory layout** (mirror `fixtures/SPINE_3_8_TEST/`):
```
fixtures/SPINE_4_3_TEST/
  SPINE_4_3_TEST.json     <-- new
  SPINE_4_3_TEST.atlas    <-- new (mirrors SPINE_3_8_TEST.atlas verbatim except page name)
  images/
    SQUARE.png            <-- new (1×1 stub PNG, mirrors SPINE_3_8_TEST/images/SQUARE.png)
```

**JSON shape pattern** (analog `fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.json` verbatim — extend with the 4.3 markers):
```json
{
  "skeleton": {
    "spine": "3.8.99",
    "x": 0,
    "y": 0,
    "width": 1,
    "height": 1
  },
  "bones": [
    { "name": "root" }
  ],
  "slots": [],
  "skins": [
    { "name": "default", "attachments": {} }
  ]
}
```

**Target shape for SPINE_4_3_TEST.json** (CONTEXT.md D-06 — both detection signals in one file: semver `>= 4.3` AND `constraints[]` present per SEED-003 §"4.3-beta JSON shape"):
```json
{
  "skeleton": {
    "spine": "4.3.91-beta",
    "x": 0,
    "y": 0,
    "width": 1,
    "height": 1
  },
  "bones": [
    { "name": "root" }
  ],
  "slots": [],
  "skins": [
    { "name": "default", "attachments": {} }
  ],
  "constraints": [
    { "name": "test_ik", "type": "ik", "bones": ["root"], "target": "root" }
  ]
}
```

**Atlas shape pattern** (analog `fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.atlas` — verbatim copy; only the page-PNG name swaps):
```
SPINE_3_8_TEST.png
size: 1, 1
format: RGBA8888
filter: Linear, Linear
repeat: none
SQUARE
  rotate: false
  xy: 0, 0
  size: 1, 1
  orig: 1, 1
  offset: 0, 0
  index: -1
```

**PNG shape pattern:** 1×1 RGBA stub, mirrors `fixtures/SPINE_3_8_TEST/images/SQUARE.png` (single-pixel transparent PNG; the test never decodes it — predicate fires before atlas resolution). Easiest path: copy the existing 3.8 PNG byte-for-byte.

**Why both signals in one fixture** (CONTEXT.md D-06 belt-and-suspenders): the fixture exercises BOTH the semver predicate AND the schema predicate; the end-to-end test only needs to assert "rejection happened" — disambiguating which predicate fired is the job of the predicate-isolation unit tests in `loader-43-schema-guard-predicate.spec.ts`.

---

### `.planning/seeds/SEED-006-spine-4.3-runtime-port.md` — costed inventory plant (NEW)

**Analog:** `.planning/seeds/SEED-003-spine-4.3-compatibility.md` (verbatim frontmatter + section-header shape; CONTEXT.md D-07 explicitly locks the mirror).

**Frontmatter shape pattern** (analog SEED-003:1-9 — keep the shape; populate fields per CONTEXT.md D-07):
```yaml
---
id: SEED-003
status: planted
planted: 2026-05-06
planted_during: post-v1.2 exploration (after user dropped 4.3-beta exports into the app and they failed to load)
trigger_when: (a) Spine 4.3.0 stable ships AND `@esotericsoftware/spine-core@4.3.x` lands on npm (currently latest = 4.2.114, no 4.3 tag); OR (b) ≥1 customer/user reports a 4.3 export failing to load and we want to ship a clear error message (Option A below) before then
scope: A=Small / B=Medium / C=Large (see options table)
proposed_phase: 29 (if Option A only) — defer to v1.4+ for full port
---
```

**Target frontmatter for SEED-006** (CONTEXT.md D-07 — fields populated):
```yaml
---
id: SEED-006
status: planted
planted: 2026-05-10
planted_during: v1.4 Phase 32 (Spine 4.3-beta detect-and-warn close-out)
trigger_when: `npm view @esotericsoftware/spine-core@latest` returns 4.3.x (4.3.0 stable shipped + npm publish landed) OR a paying user reports they cannot re-export their rig as Version 4.2
scope: Large (full runtime port)
proposed_phase: TBD (post-4.3.0-stable npm publish)
---
```

**Section-header pattern to mirror** (SEED-003 has these top-level sections; SEED-006 should mirror; CONTEXT.md D-07 says "Frontmatter, section headers, and tone align with SEED-003 for consistency"):
- `# SEED-XXX: <one-line title>`
- `## The Bug (one-line)` OR `## Why This Matters` (SEED-001 uses the latter; SEED-003 uses the former — pick by tone fit)
- `## Reproduction Fixtures` OR `## Costed Inventory`
- `## Why It Fails — Mechanism (verified)` OR `## Schema Deltas`
- `## Compatibility Matrix`
- `## Release Status`
- `## Options (cost-ordered)` (SEED-003) OR `## Scope Estimate` (SEED-001)
- `## Recommendation`
- `## Open Question (parked for next conversation)` (optional)
- `## Sources (verified during research)`

**Content sources** (CONTEXT.md D-07):
- **Costed inventory** — copy PORT-01..04 from `.planning/REQUIREMENTS.md:33-36` verbatim:
  ```
  - **PORT-01**: Migrate `core/sampler.ts` from spine-core 4.2 to 4.3 (`setToSetupPose` → `setupPose`; `setSlotsToSetupPose` → `setupPoseSlots`; `state.setAnimationWith` → `state.setAnimation`; `slot.getAttachment()` → `slot.pose.attachment`).
  - **PORT-02**: Migrate `core/bounds.ts` `computeWorldVertices` call sites to the 4.3 signatures (`RegionAttachment`: adds `vertexOffsets`; `VertexAttachment`: adds `skeleton` first arg).
  - **PORT-03**: Validate `slider` constraint timelines sample correctly via the existing `updateWorldTransform` propagation path with a dedicated fixture.
  - **PORT-04**: Decide vendoring strategy (git submodule + tsc, npm fork, or wait-for-publish) and publish a build pipeline change.
  ```
- **Trigger condition** — copy from REQUIREMENTS.md L38 verbatim.
- **Sources** — re-cite the same external links SEED-003 already validated (lines 70-79):
  ```
  - [Spine Changelog](https://esotericsoftware.com/spine-changelog)
  - [Blog: 4.3 beta announcement (April 4, 2025)](https://en.esotericsoftware.com/blog/The-4.3-beta-is-now-available)
  - [spine-runtimes 4.3-beta CHANGELOG.md](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.3-beta/CHANGELOG.md)
  - [4.3-beta SkeletonJson.ts (raw)](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.3-beta/spine-ts/spine-core/src/SkeletonJson.ts)
  - [4.2 SkeletonJson.ts (raw)](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.2/spine-ts/spine-core/src/SkeletonJson.ts)
  - [Spine-Unity 4.2 → 4.3 Upgrade Guide (forum)](https://esotericsoftware.com/forum/d/29234-spine-unity-42-to-43-upgrade-guide)
  - [spine-editor#891 — IK timeline scrambling on 4.3→4.2 downgrade](https://github.com/EsotericSoftware/spine-editor/issues/891)
  - [Spine JSON format docs](https://en.esotericsoftware.com/spine-json-format)
  ```
- **Cross-link** — section pointing at SEED-003 (lays the schema-delta groundwork) and at this phase's CONTEXT.md (which closed Option A).

**SEED-003 one-line addendum** (CONTEXT.md D-07 — touch SEED-003 as part of the Phase 32 plant): add a line near the bottom of SEED-003 (e.g., in `## Recommendation` or as a new `## Status (2026-05-10)` block) noting "Option A landed in v1.4 Phase 32; full port queued via SEED-006." This is a minor edit, not a rewrite.

**Plant-as-last-commit pattern** (CONTEXT.md D-07): SEED-006 lands as the LAST commit in the execute sequence, separate from REQ-implementing commits. Suggested message: `docs(seed): plant SEED-006 — full Spine 4.3 runtime port queued`.

---

## Shared Patterns

### Layer-3 invariant (pure-TS predicates in `core/`)

**Source:** `CLAUDE.md` fact #5 ("`core/` is pure TypeScript, no DOM. Headless-testable in Node via vitest. The UI is a consumer."), enforced by `tests/arch.spec.ts`.

**Apply to:** `src/core/loader.ts` (existing `checkSpineVersion` + new `checkSpine43Schema`), `src/core/errors.ts` (`SpineVersionUnsupportedError` constructor branch).

**Concrete excerpt** — the existing `checkSpineVersion` predicate honors the invariant trivially with pure string parsing + integer comparison:
```typescript
export function checkSpineVersion(version: string | null, skeletonPath: string): void {
  if (version === null) {
    throw new SpineVersionUnsupportedError('unknown', skeletonPath);
  }
  const parts = version.split('.');
  const major = parseInt(parts[0] ?? '', 10);
  const minor = parseInt(parts[1] ?? '', 10);
  // ...
}
```

**Phase 32 application:** the new `checkSpine43Schema` predicate reads `parsedJson.constraints` via TypeScript narrowing (the same pattern at `loader.ts:172-176`) — no DOM, no `node:fs`, no `sharp`, no Electron imports. The constructor-message branch in `errors.ts` is similarly pure (string templating + a single semver-parse helper).

---

### Typed-error envelope routing (D-158 / D-171)

**Source:** `src/main/ipc.ts:118-142` (KNOWN_KINDS Set + dedicated `instanceof SpineVersionUnsupportedError` branch); `src/main/sampler-worker.ts:156-162` (worker envelope arm); `src/main/project-io.ts:454-462` (project-io envelope arm).

**Apply to:** confirmation that NO IPC envelope changes are needed for Phase 32 (CONTEXT.md `<domain>` Out of Scope). The new COMPAT-01 message rides through the existing `kind: 'SpineVersionUnsupportedError'` envelope arm with zero plumbing changes.

**Concrete excerpt** — the dedicated branch in the sampler-worker forwarder (`src/main/sampler-worker.ts:156-162`) carries `detectedVersion` alongside `message`:
```typescript
if (err instanceof SpineVersionUnsupportedError) {
  return {
    kind: 'SpineVersionUnsupportedError',
    message: err.message,
    detectedVersion: err.detectedVersion,
  };
}
```

**Phase 32 application:** because `.name === 'SpineVersionUnsupportedError'` is preserved AND the constructor signature `(detectedVersion, skeletonPath)` is preserved AND `extends SpineLoaderError` is preserved, the existing IPC envelope routing fires unchanged. The renderer reads `state.error.message` verbatim at `App.tsx:676`; no renderer-side template changes.

---

### Inline color-token pattern (Tailwind v4 `text-danger`)

**Source:** `src/renderer/src/App.tsx:675` (`<span className="font-semibold text-danger">Skeleton not found:</span>`); `src/renderer/src/panels/MissingAttachmentsPanel.tsx:63/73`; `src/renderer/src/panels/AnimationBreakdownPanel.tsx:765`.

**Apply to:** `src/renderer/src/App.tsx:621-623` (the new `<span className="font-bold text-danger">v4.2</span>` token).

**Concrete excerpt** — the proven inline-span pattern at line 675:
```tsx
<span className="font-semibold text-danger">Skeleton not found:</span>{' '}
```

**Phase 32 application:** the new v4.2 token uses `font-bold` (700) instead of `font-semibold` (600) per UI-SPEC.md typography contract — a deliberate one-step weight bump because `v4.2` is the single load-bearing constraint a user must absorb before dropping a file. The `text-danger` color class is reused verbatim (5.33:1 contrast on `--color-surface` — same surface-pairing as the line-675 precedent).

---

### Three-file test-precedent split (predicate / fixture / class-shape)

**Source:** Phase 12 / Plan 05 (D-21) — the F3 version-guard precedent split tests across three files:
1. `tests/core/loader-version-guard-predicate.spec.ts` — predicate-unit tests (string/object inspection in isolation)
2. `tests/core/loader-version-guard.spec.ts` — fixture-driven end-to-end tests (`loadSkeleton(FIXTURE)` rejection)
3. `tests/core/errors-version.spec.ts` — error-class-shape tests (constructor field + `.name` + inheritance)

**Apply to:** Phase 32 mirrors this three-file split with one extension:
1. NEW `tests/core/loader-43-schema-guard-predicate.spec.ts` — schema-predicate unit tests
2. EXTEND `tests/core/loader-version-guard-predicate.spec.ts` — invert the "lenient on 4.3+" assertions
3. EXTEND `tests/core/loader-version-guard.spec.ts` — add the `FIXTURE_43` rejection block
4. EXTEND `tests/core/errors-version.spec.ts` — add the 4.3+ branch message assertion

**Concrete excerpt** — the predicate-spec docblock at the top of `loader-version-guard-predicate.spec.ts:1-23` documents the three-file split explicitly:
```typescript
/**
 * Phase 12 Plan 05 (D-21) — F3 Spine version guard.
 *
 * Task 2 RED → GREEN: `checkSpineVersion` predicate unit tests.
 *
 * [...]
 *
 * Fixture-driven loadSkeleton tests live in tests/core/loader-version-guard.spec.ts
 * (Task 3); this file tests the predicate in isolation.
 */
```

**Phase 32 application:** the new predicate-spec file SHOULD carry an analogous docblock pointing at the OTHER three test files (cross-references), so a future reader can navigate the four-way coverage of the version + schema gates.

---

### Atomic-commit-per-task discipline (GSD execute-phase)

**Source:** `CLAUDE.md` §"GSD workflow" + the standing project convention.

**Apply to:** Phase 32's commit sequence — Implementation Tasks each land as a single-concern commit, SEED-006 lands as the final commit (CONTEXT.md D-07 "Plant at phase close — last commit in the execute sequence, separate from REQ-implementing commits").

**Suggested commit boundaries** (planner refines task → commit mapping):
1. `feat(core): add checkSpine43Schema predicate + sequential call in loader.ts`
2. `feat(core): branch SpineVersionUnsupportedError message by detectedVersion`
3. `test(core): add SPINE_4_3_TEST fixture + schema-predicate + fixture-driven coverage`
4. `test(core): invert lenient-on-4.3+ assertions; add 4.3+ class-shape assertion`
5. `feat(renderer): drop-zone v4.2 advisory copy with text-danger token`
6. `docs(seed): plant SEED-006 — full Spine 4.3 runtime port queued` ← LAST commit

---

## No Analog Found

**None.** Every file in Phase 32's scope has a strong in-repo analog. This is the textbook "extend existing pattern" phase — the F3 version-guard precedent (Phase 12) provides direct templates for every test file, every error-class shape, and every predicate; the inline-span precedent at `App.tsx:675` provides the exact JSX shape for the renderer change; the SEED-003 frontmatter provides the verbatim mirror for SEED-006.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | — |

---

## Metadata

**Analog search scope:**
- `src/core/` — loader.ts, errors.ts (modified surfaces) + types.ts (LoadResult / LoaderOptions context)
- `src/renderer/src/App.tsx` (full file scanned, modification anchors at 615-624 and 660-697)
- `src/main/ipc.ts`, `src/main/sampler-worker.ts`, `src/main/project-io.ts` (out-of-scope confirmation only — no modifications)
- `tests/core/` — `loader-version-guard-predicate.spec.ts`, `loader-version-guard.spec.ts`, `errors-version.spec.ts`
- `fixtures/SPINE_3_8_TEST/` — full directory shape
- `.planning/seeds/SEED-001-…md`, `SEED-003-…md` — frontmatter + section pattern for SEED-006

**Files scanned:** 14
- Source: 4 (loader.ts, errors.ts, App.tsx, ipc.ts/sampler-worker.ts excerpt)
- Tests: 3 (loader-version-guard-predicate.spec.ts, loader-version-guard.spec.ts, errors-version.spec.ts)
- Fixtures: 3 (SPINE_3_8_TEST.json + .atlas + images/SQUARE.png)
- Planning: 4 (REQUIREMENTS.md, SEED-001, SEED-003, CLAUDE.md)

**Pattern extraction date:** 2026-05-10

**Layer-3 invariant verification:** all proposed changes to `src/core/` (loader.ts predicate addition + errors.ts constructor branch) are pure TypeScript with NO new DOM, Electron, or sharp imports. The existing imports in `loader.ts:30-47` and `errors.ts` (none, plain JS classes) cover all needed dependencies. `tests/arch.spec.ts` invariant preserved trivially.

**Audit-anchor cross-check:** UI-SPEC.md's Audit Anchors table at lines 207-220 enumerates the renderer-side surfaces that must be UNCHANGED (App.tsx:603-619 elevated branch; App.tsx:660-697 error banner; HelpDialog.tsx:158; index.css). This pattern map respects all anchors — only the line-622 idle-branch JSX is modified.

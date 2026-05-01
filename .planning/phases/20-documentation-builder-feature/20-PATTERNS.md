# Phase 20: Documentation Builder feature - Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 13 (5 NEW + 8 EXTEND)
**Analogs found:** 13 / 13

> Every new file in this phase has a strong existing analog in the repo (Phases 4 / 6 / 7 / 8 / 8.1 / 9 / 19). This is a reuse-heavy phase — the discipline is verbatim copy + small adaptations, not invention.

---

## File Classification

### NEW files (5)

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `src/core/documentation.ts` | core type/serde + validator | pure-TS in-memory; no DOM, no fs | `src/core/project-file.ts` (lines 84-202 validator) | exact |
| `src/main/doc-export.ts` | main-process file writer + IPC handler | renderer → IPC → showSaveDialog → atomic write | `src/main/project-io.ts` (147-271 Save As + atomic write) | exact |
| `src/renderer/src/modals/DocumentationBuilderDialog.tsx` | UI modal (10th hand-rolled) | renderer in-memory state; IPC on Export click | `src/renderer/src/modals/OptimizeDialog.tsx` (multi-state body, lines 260-312) | exact |
| `tests/core/documentation.spec.ts` | core unit test (validator) | vitest run | `tests/core/project-file.spec.ts` (validator stanza, lines 18-89) | exact |
| `tests/main/doc-export.spec.ts` | main unit test (golden HTML) | vitest run with injected `generatedAt` | `tests/main/project-io.spec.ts` (existing pattern) + `toMatchSnapshot` | role-match |

### EXTEND files (8)

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `src/core/project-file.ts` | core serde + validator | pure-TS | self (extending existing function) | exact |
| `src/shared/types.ts` | shared type definitions | structuredClone-safe | self (existing `SkeletonSummary` / `Api` shape) | exact |
| `src/main/summary.ts` | main builder (reads `EventData`) | builds IPC payload | self (existing `bones` / `skins` / `animations` field construction at 113-130) | exact |
| `src/main/ipc.ts` | IPC channel registration | `ipcMain.handle` | self (line 881 `project:save` registration) | exact |
| `src/preload/index.ts` | preload bridge | `ipcRenderer.invoke` | self (line 78-79 `pickOutputDirectory`) | exact |
| `src/renderer/src/components/AppShell.tsx` | wires Documentation button + state hoist | renderer in-memory + IPC on save/export | self (button at 1189-1197; `atlasPreviewOpen` at 159; `buildSessionState` at 578-597) | exact |
| `tests/core/project-file.spec.ts` | extend round-trip with `documentation` | vitest run | self (existing `documentation slot preserved on round-trip` at 111-125) | exact |
| `tests/renderer/documentation-builder-dialog.spec.tsx` | renderer integration (modal smoke + DnD) | jsdom + RTL synthetic events | `tests/renderer/atlas-preview-modal.spec.tsx` (jsdom + `vi.stubGlobal('api',…)`) | exact |

---

## Pattern Assignments

### `src/core/documentation.ts` (NEW — core type/serde + validator)

**Analog:** `src/core/project-file.ts` (lines 84-202)
**Role match:** exact — both are pure-TS Layer-3 modules that own a validator helper for a sub-shape of the on-disk schema.

#### Pattern 1: File-top imports — pure-TS only

Source: `src/core/project-file.ts:1-30` (existing top-of-file). Mirror this disciplined import set; **no `node:fs`, no `electron`, no DOM types** (locked by `tests/arch.spec.ts:116-134` Layer 3 grep gate).

The only legal imports for `src/core/documentation.ts`:

```typescript
// type-only re-imports from shared/types.ts are fine (project-file.ts does this).
// NO `import * as fs from 'node:fs';`
// NO `import { dialog } from 'electron';`
```

#### Pattern 2: Per-field hand-rolled validator (mirrors `validateProjectFile`)

Source: `src/core/project-file.ts:84-202`. The Phase 20 D-04 validator follows this idiom verbatim — sequence of `if (!cond) return { ok: false, error: { kind: 'invalid-shape', message: '<specific>' } };` guards.

**Excerpt to copy** (`project-file.ts:84-144`):

```typescript
export function validateProjectFile(input: unknown): ValidateResult {
  if (!input || typeof input !== 'object') {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'project file is not an object' },
    };
  }
  const obj = input as Record<string, unknown>;

  // Version FIRST — gate the newer-version rejection per D-151.
  if (typeof obj.version !== 'number') {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'version is not a number' },
    };
  }
  // ... (per-field guards continue) ...

  // v1 field-shape guard. Required: skeletonPath, overrides, documentation.
  if (typeof obj.skeletonPath !== 'string' || obj.skeletonPath.length === 0) {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'skeletonPath is missing or empty' },
    };
  }
  if (!obj.overrides || typeof obj.overrides !== 'object' || Array.isArray(obj.overrides)) {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'overrides is not an object' },
    };
  }
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
```

**Inner-loop pattern for arrays of plain objects** (mirrors `overrides` Record loop at `project-file.ts:188-198`):

```typescript
for (const [k, v] of Object.entries(obj.overrides as Record<string, unknown>)) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    return {
      ok: false,
      error: {
        kind: 'invalid-shape',
        message: `overrides.${k} is not a finite number`,
      },
    };
  }
}
```

Phase 20 adapts this to per-index loops (`for (let i = 0; i < arr.length; i++)`) for `animationTracks`, `events`, `controlBones`, `skins`. Error messages MUST follow the form `documentation.<field>[<i>].<subfield> is not a <type>`.

#### Pattern 3: Discriminated-union ValidateResult envelope

Source: `src/core/project-file.ts:84` returns `ValidateResult`. Phase 20 mirrors the shape but inlines (D-04 does NOT add a 9th `SerializableError` kind):

```typescript
export type DocumentationValidateResult =
  | { ok: true; doc: Documentation }
  | { ok: false; error: { kind: 'invalid-shape'; message: string } };
```

The error envelope reuses the existing `'invalid-shape'` kind (used by `validateProjectFile`), which surfaces as `'ProjectFileParseError'` in the `SerializableError` union (`src/shared/types.ts:555`). **Do not introduce a new error kind.**

#### Pattern 4: structuredClone-safety docblock

Source: `src/shared/types.ts:7-15` (file-top docblock locking the IPC contract). Every field on `Documentation` MUST be a primitive, plain object, or array of those — same discipline as `AppSessionState`. `crypto.randomUUID()` returns `string`, fine.

---

### `src/main/doc-export.ts` (NEW — main-process file writer + IPC handler)

**Analog:** `src/main/project-io.ts` (147-271)
**Role match:** exact — both are main-side handlers that open `dialog.showSaveDialog`, then perform Pattern-B atomic write.

#### Pattern 1: Imports

Source: `src/main/project-io.ts:1-40` (existing top-of-file). Phase 20 mirrors:

```typescript
import { writeFile, rename } from 'node:fs/promises';
import * as path from 'node:path';
import { app, dialog, BrowserWindow } from 'electron';
import { serializeProjectFile, /* ... */ } from '../core/project-file.js';
```

For doc-export, swap `serializeProjectFile` for `import type { Documentation } from '../core/documentation.js';` and add type-only imports for `SkeletonSummary`, `AtlasPreviewProjection` from `'../shared/types.js'`.

#### Pattern 2: `dialog.showSaveDialog` with focused-window resolution

Source: `src/main/project-io.ts:147-180` (existing `handleProjectSaveAs`). Verbatim structure to copy:

```typescript
const win = BrowserWindow.getFocusedWindow();
const options: Electron.SaveDialogOptions = {
  title: 'Save Spine Texture Manager Project',
  defaultPath: path.join(defaultDir, `${defaultBasename}.stmproj`),
  filters: [{ name: 'Spine Texture Manager Project', extensions: ['stmproj'] }],
};
const result = win
  ? await dialog.showSaveDialog(win, options)
  : await dialog.showSaveDialog(options);

if (result.canceled || !result.filePath) {
  return { ok: false, error: { kind: 'Unknown', message: 'Save cancelled' } };
}
```

Phase 20 adaptation per D-20: change `title` to `'Export Documentation as HTML'`, `defaultPath` to `${skeletonBasename}.html`, `filters` to `[{ name: 'HTML Document', extensions: ['html'] }]`. The `BrowserWindow.getFocusedWindow()` fall-back to plain `dialog.showSaveDialog(options)` is mandatory — preserve verbatim.

#### Pattern 3: Atomic write Pattern-B (4-line idiom)

Source: `src/main/project-io.ts:246-271` (verbatim). This pattern is also at `src/main/image-worker.ts:289-304` (D-121 prior art). Phase 20 D-20 reuses it:

```typescript
const tmpPath = finalPath + '.tmp';
try {
  await writeFile(tmpPath, json, 'utf8');
} catch (err) {
  return {
    ok: false,
    error: {
      kind: 'Unknown',
      message: `writeFile tmp failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    },
  };
}
try {
  await rename(tmpPath, finalPath);
} catch (err) {
  return {
    ok: false,
    error: {
      kind: 'Unknown',
      message: `rename tmp→final failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    },
  };
}
```

**Inline, do not extract.** `project-io.ts`, `image-worker.ts`, `recent.ts`, `update-state.ts` all inline the same 4-line pattern with slightly different envelope shapes — extracting a helper would force callers to translate. Inline keeps each call site obvious.

#### Pattern 4: SaveResponse-shaped error envelope

Source: `src/shared/types.ts:687-689`:

```typescript
export type SaveResponse =
  | { ok: true; path: string }
  | { ok: false; error: SerializableError };
```

Phase 20 D-21 mirrors: `DocExportResponse = { ok: true; path: string } | { ok: false; error: { kind: 'Unknown'; message: string } }`. Reuses `'Unknown'` kind for non-typed-failure paths (cancellation, fs error). **No new `SerializableError` kind.**

#### Pattern 5: Pure template-literal HTML rendering (no React in main)

There is no existing analog for HTML templating in `src/main/`. Phase 20 invents this surface but the discipline is already locked: **template literals only, no `react-dom/server`, no Tailwind classes** (D-21 + Pitfall 7 Tailwind v4 literal-class scanner). Inline `<style>` block per D-17 (Pattern 8 in RESEARCH.md lines 765-896 has a complete template).

---

### `src/renderer/src/modals/DocumentationBuilderDialog.tsx` (NEW — 10th hand-rolled modal)

**Analog:** `src/renderer/src/modals/OptimizeDialog.tsx` (multi-state body, lines 260-312)
**Role match:** exact — OptimizeDialog has multi-state body (`pre-flight | in-progress | complete`), structurally matching Phase 20's tab-switching body (`tracks | sections | export`).

**Secondary analog:** `src/renderer/src/modals/OverrideDialog.tsx` (lines 60-160) — smaller-footprint 5-modal scaffold for the `useFocusTrap` + cancel/apply footer idiom.

#### Pattern 1: 5-modal ARIA scaffold (verbatim from OptimizeDialog:299-315)

Source: `src/renderer/src/modals/OptimizeDialog.tsx:299-315`:

```tsx
return (
  <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="optimize-title"
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    onClick={onCloseSafely}
  >
    <div
      className="bg-panel border border-border rounded-md p-6 min-w-[640px] max-w-[800px] max-h-[80vh] flex flex-col font-mono"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={keyDown}
    >
      <h2 id="optimize-title" className="text-sm text-fg mb-4">
        {headerTitle}
      </h2>
```

**Phase 20 adaptation per D-15:** swap `min-w-[640px] max-w-[800px] max-h-[80vh]` → `min-w-[960px] max-w-[1100px] max-h-[85vh]`. Swap `aria-labelledby="optimize-title"` and the `<h2 id="optimize-title">` → `documentation-builder-title`. Title text per UI-SPEC: `"Documentation Builder"`.

#### Pattern 2: useFocusTrap usage

Source: `src/renderer/src/modals/OverrideDialog.tsx:71` (smallest footprint):

```typescript
useFocusTrap(dialogRef, props.open, { onEscape: props.onCancel });
```

Source: `src/renderer/src/modals/OptimizeDialog.tsx:260-262` (with conditional opt-out):

```typescript
useFocusTrap(dialogRef, props.open, {
  onEscape: state === 'in-progress' ? undefined : onCloseSafely,
});
```

**Phase 20 uses the OverrideDialog form** — D-14 specifies Escape always closes (no in-progress mid-state to gate against; export is sub-second per UI-SPEC). The `dialogRef` is `useRef<HTMLDivElement>(null)` declared at component top. The hook auto-focuses the first tabbable element (Tab strip's first button = `Animation Tracks`, per useFocusTrap.ts:75-76 `TABBABLE_SELECTOR`).

#### Pattern 3: useState modal lifecycle (parent-side)

Source: `src/renderer/src/components/AppShell.tsx:159` (parallel to `atlasPreviewOpen`):

```typescript
// Phase 7 D-134 — NEW: Atlas Preview modal lifecycle. Plain boolean, no
// snapshot state — the modal reads summary + overrides directly (D-131).
const [atlasPreviewOpen, setAtlasPreviewOpen] = useState(false);
```

**Phase 20 adds parallel:**

```typescript
const [documentationBuilderOpen, setDocumentationBuilderOpen] = useState(false);
const [documentation, setDocumentation] = useState<Documentation>(DEFAULT_DOCUMENTATION);
```

#### Pattern 4: Tab-strip ARIA (verbatim from `AppShell.tsx:1155-1168`)

Source: `src/renderer/src/components/AppShell.tsx:1155-1168`:

```tsx
<nav role="tablist" className="flex gap-1 items-center">
  <TabButton
    isActive={activeTab === 'global'}
    onClick={() => setActiveTab('global')}
  >
    Global
  </TabButton>
  <TabButton
    isActive={activeTab === 'animation'}
    onClick={() => setActiveTab('animation')}
  >
    Animation Breakdown
  </TabButton>
</nav>
```

Source: `TabButton` component definition at `AppShell.tsx:1478-1507`:

```tsx
function TabButton({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
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
        <span
          aria-hidden
          className="absolute left-0 right-0 -bottom-px h-[2px] bg-accent"
        />
      )}
    </button>
  );
}
```

**Phase 20 reuse decision:** `TabButton` is currently defined (not exported) as a local function inside `AppShell.tsx`. Two options:

1. **Promote `TabButton` to a shared file** (e.g. `src/renderer/src/components/TabButton.tsx`) and import from both AppShell + DocumentationBuilderDialog. Cleaner long-term.
2. **Inline-redefine** inside `DocumentationBuilderDialog.tsx` with the exact same body (Tailwind v4 literal-class discipline preserved).

Planner choice — option 1 has slight cross-file refactor, option 2 has trivial code duplication. RESEARCH.md (line 520) suggests "grep for `function TabButton` and reuse the already-exported one — DO NOT redefine"; this implies promote to shared. Either is acceptable per Phase 20 D-13 ("verbatim reuse of class string"); the **class string** must be byte-identical.

**Phase 20 adapted body** (3 panes, with bottom border per UI-SPEC mb-4):

```tsx
<nav role="tablist" className="flex gap-1 items-center mb-4 border-b border-border">
  <TabButton isActive={activePane === 'tracks'} onClick={() => setActivePane('tracks')}>
    Animation Tracks
  </TabButton>
  <TabButton isActive={activePane === 'sections'} onClick={() => setActivePane('sections')}>
    Sections
  </TabButton>
  <TabButton isActive={activePane === 'export'} onClick={() => setActivePane('export')}>
    Export
  </TabButton>
</nav>
```

#### Pattern 5: Cancel / primary-CTA footer (verbatim from OverrideDialog:131-160)

Source: `src/renderer/src/modals/OverrideDialog.tsx:131-160`:

```tsx
<div className="flex gap-2 mt-6 justify-end">
  {/* secondary buttons */}
  <button
    type="button"
    onClick={props.onCancel}
    className="border border-border rounded-md px-3 py-1 text-xs"
  >
    Cancel
  </button>
  <button
    type="button"
    /* primary CTA — class string at line 161+ */
    /* ... */
  >
    Apply
  </button>
</div>
```

**Phase 20:** Cancel + `Save changes` primary CTA. Class strings per UI-SPEC: outlined-secondary for Cancel; filled-primary `bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold` for Save changes (matches `AppShell.tsx:1202` Optimize Assets primary CTA).

#### Pattern 6: HTML5 native DnD (first DnD in repo — no analog)

No existing analog. RESEARCH.md Pattern 4 (lines 525-600) is the canonical reference. Critical contract:
- `onDragStart`: `e.dataTransfer.effectAllowed = 'copy'` (Electron Chromium quirk, D-06) THEN `e.dataTransfer.setData('application/x-stm-anim', animationName)`.
- `onDragOver`: `e.preventDefault()` MANDATORY (HTML5 spec — drop is rejected without it).
- `onDrop`: `e.preventDefault()` then `e.dataTransfer.getData('application/x-stm-anim')`.

This is net-new pattern surface; the planner MUST treat RESEARCH.md Pattern 4 as the source-of-truth excerpt.

#### Pattern 7: Empty-state and disabled-button styling (Phase 19 prior art)

Source: `src/renderer/src/modals/AtlasPreviewModal.tsx:374-385` (segmented toggle button, current/inactive class string via `clsx`):

```tsx
<button
  type="button"
  onClick={() => p.setMaxPageDim(2048)}
  className={clsx(
    'border border-border rounded-md px-3 py-1 text-xs font-mono transition-colors',
    p.maxPageDim === 2048
      ? 'bg-accent text-panel font-semibold'
      : 'text-fg-muted hover:text-fg',
  )}
>
  2048px
</button>
```

Disabled-state pattern from `AppShell.tsx:1185` (Atlas Preview button):

```
disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border
disabled:hover:text-fg disabled:active:bg-transparent
```

Phase 20 reuses both for the `+ Add Track` button (disabled when `summary.animations.count === 0`) and the Export HTML button.

---

### `tests/core/documentation.spec.ts` (NEW — validator unit test)

**Analog:** `tests/core/project-file.spec.ts` (lines 18-89)
**Role match:** exact — both are pure unit tests for a hand-rolled validator returning a `{ ok, error|project }` envelope.

#### Pattern: Validator-rejection per-field tests

Source: `tests/core/project-file.spec.ts:18-89`:

```typescript
describe('validateProjectFile (D-156)', () => {
  it('validator rejects non-object input', () => {
    expect(validateProjectFile(null).ok).toBe(false);
    expect(validateProjectFile(42).ok).toBe(false);
    expect(validateProjectFile('foo').ok).toBe(false);
  });

  it('validator rejects missing version', () => {
    const r = validateProjectFile({ skeletonPath: 'x.json', overrides: {}, documentation: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('invalid-shape');
  });
  // ... per-field rejections continue ...

  it('validator accepts minimal v1 file', () => {
    const r = validateProjectFile({
      version: 1,
      skeletonPath: './SIMPLE.json',
      atlasPath: null,
      // ... full minimal shape ...
      documentation: {},
    });
    expect(r.ok).toBe(true);
  });
});
```

**Phase 20 adapts:** one rejection test per field (`animationTracks not array`, `animationTracks[0].id missing`, `animationTracks[0].mixTime not finite`, `events not array`, `events[0].name empty`, `controlBones not array`, `skins not array`, `generalNotes not string`, `safetyBufferPercent out of range`, etc.) plus an accept-minimum + accept-representative pair. The `expect(r.error.kind).toBe('invalid-shape')` discipline is preserved verbatim.

---

### `tests/main/doc-export.spec.ts` (NEW — golden HTML snapshot)

**Analog:** `tests/main/project-io.spec.ts` (existing) for the IPC-handler shape; `toMatchSnapshot` is an idiomatic vitest pattern (no existing repo snapshot tests, but the API is standard).

#### Pattern: Inject `generatedAt` for determinism (Pitfall 8)

```typescript
const FIXED_GENERATED_AT = new Date('2026-04-14T12:00:00Z').getTime();

const PAYLOAD: DocExportPayload = {
  documentation: { /* representative doc */ },
  summary: { /* SIMPLE_TEST-derived */ },
  // ...
  generatedAt: FIXED_GENERATED_AT,
};

describe('renderDocumentationHtml (DOC-04)', () => {
  it('produces deterministic snapshot', () => {
    expect(renderDocumentationHtml(PAYLOAD)).toMatchSnapshot();
  });

  it('output is self-contained — no external assets', () => {
    const html = renderDocumentationHtml(PAYLOAD);
    expect(html).not.toMatch(/<img\s/);
    expect(html).not.toMatch(/<link\s+rel=["']stylesheet["']/);
    expect(html).not.toMatch(/<script\s+src=/);
    expect(html).not.toMatch(/url\(['"]?https?:/);
  });
});
```

RESEARCH.md lines 1442-1488 has the full shape.

---

### `tests/renderer/documentation-builder-dialog.spec.tsx` (NEW — modal smoke + DnD)

**Analog:** `tests/renderer/atlas-preview-modal.spec.tsx`
**Role match:** exact — jsdom + RTL + `vi.stubGlobal('api', …)` for the IPC bridge.

#### Pattern 1: jsdom env + window.api stub

Source: `tests/renderer/atlas-preview-modal.spec.tsx:1-55`:

```typescript
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
// ...

afterEach(cleanup);

beforeEach(() => {
  vi.stubGlobal('api', {
    pathToImageUrl: vi.fn(async (absolutePath: string) => { /* ... */ }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
```

Phase 20 adapts: stub `exportDocumentationHtml` returning `{ ok: true, path: '/tmp/test.html' }` for the success path, `{ ok: false, error: { kind: 'Unknown', message: 'Export cancelled' } }` for cancel.

#### Pattern 2: DnD via `fireEvent.dragStart` / `fireEvent.drop`

No existing analog — this is the first DnD test in the repo. Standard RTL idiom:

```typescript
const animationItem = screen.getByText('PATH');
const trackContainer = screen.getByLabelText('Track 0');
fireEvent.dragStart(animationItem, {
  dataTransfer: { setData: vi.fn(), effectAllowed: '' },
});
fireEvent.dragOver(trackContainer, { dataTransfer: { /* ... */ } });
fireEvent.drop(trackContainer, {
  dataTransfer: { getData: vi.fn(() => 'PATH') },
});
expect(/* track 0 has 1 entry now */).toBeTruthy();
```

The planner should treat this as new pattern surface; the assertions on `setData` mock + `getData` mock verify the contract from D-06.

---

### `src/core/project-file.ts` (EXTEND — validator + serialize + materialize)

**Analog:** self.

#### Insertion site 1 — `validateProjectFile` (after line 144)

Source: `src/core/project-file.ts:135-144` (existing object-shape guard). Insert immediately after:

```typescript
// Existing :135-144 — preserve verbatim:
if (!obj.documentation || typeof obj.documentation !== 'object' || Array.isArray(obj.documentation)) {
  return { ok: false, error: { kind: 'invalid-shape', message: 'documentation is not an object' } };
}

// NEW (Phase 20 D-04):
const docResult = validateDocumentation(obj.documentation);
if (!docResult.ok) {
  return { ok: false, error: docResult.error };
}
```

**File-top import addition:**

```typescript
import { validateDocumentation, DEFAULT_DOCUMENTATION } from './documentation.js';
```

#### Insertion site 2 — `serializeProjectFile:254` (replace empty literal)

Source: `src/core/project-file.ts:239-256` (existing). Line 254 currently writes `documentation: {}, // D-148 reserved slot`. Phase 20 replaces:

```typescript
// BEFORE (line 254):
documentation: {}, // D-148 reserved slot

// AFTER (Phase 20 D-01):
documentation: state.documentation,
```

#### Insertion site 3 — `materializeProjectFile:335` (forward-compat default)

Source: `src/core/project-file.ts:321-339` (existing). Line 335 currently passes through `documentation: file.documentation`. Phase 20 replaces with **Pitfall 9 forward-compat default** so old `.stmproj` files (Phase 8 era, `documentation: {}`) load with empty defaults applied:

```typescript
// BEFORE (line 335):
documentation: file.documentation,

// AFTER (Phase 20 Pitfall 9):
documentation: { ...DEFAULT_DOCUMENTATION, ...file.documentation },
```

**Subtle but critical:** the validator must still accept the empty `documentation: {}` shape after the new per-field guards land. RESEARCH §Pitfall 9 chooses Option A (materializer back-fills) over Option B (validator pre-massages). The existing `tests/core/project-file.spec.ts:111-125` round-trip already asserts the documentation slot survives `validateProjectFile`; Phase 20 must update or extend this test to reflect the new strict shape OR keep the empty `{}` accepted by the validator (recommendation: validator stays strict; materializer back-fills; the existing test at line 119 `expect(file.documentation).toEqual({})` becomes `expect(file.documentation).toEqual(DEFAULT_DOCUMENTATION)`).

---

### `src/shared/types.ts` (EXTEND — type definitions)

**Analog:** self.

#### Insertion site 1 — `SkeletonSummary` (after line 476 animations field)

Source: `src/shared/types.ts:466-506` (existing `SkeletonSummary`). Insert after `animations: { count: number; names: string[] };`:

```typescript
// Phase 20 D-09 — auto-discovery source for documentation events sub-section.
events: { count: number; names: string[] };
```

Required (not optional) — Phase 20 extends `summary.ts` at the same time, so no Wave-0 typecheck-without-runtime gap.

#### Insertion site 2 — `ProjectFileV1.documentation` type (line 650)

Source: `src/shared/types.ts:640-651`:

```typescript
// BEFORE:
export interface ProjectFileV1 {
  // ...
  documentation: object;  // line 650
}

// AFTER (Phase 20 D-01):
import type { Documentation } from '../core/documentation.js';
// ...
export interface ProjectFileV1 {
  // ...
  documentation: Documentation;  // line 650
}
```

#### Insertion site 3 — `AppSessionState` (after line 668 sortDir)

Source: `src/shared/types.ts:660-669`:

```typescript
export interface AppSessionState {
  skeletonPath: string;
  atlasPath: string | null;
  imagesDir: string | null;
  overrides: Record<string, number>;
  samplingHz: number | null;
  lastOutDir: string | null;
  sortColumn: string | null;
  sortDir: 'asc' | 'desc' | null;
  // Phase 20 D-01 — drives serializeProjectFile :254
  documentation: Documentation;
}
```

The existing docblock at `types.ts:655-659` says "Same shape as ProjectFileV1 minus `version` and `documentation` (those are stamped by serializeProjectFile)" — Phase 20 INVALIDATES the `documentation` exclusion in the docblock. Update the comment accordingly.

#### Insertion site 4 — `Api` interface (after line 828)

Source: `src/shared/types.ts:807-828`:

```typescript
// Phase 8 — project file IPC surface (D-140..D-156).
saveProject: (state: AppSessionState, currentPath: string | null) => Promise<SaveResponse>;
saveProjectAs: (state: AppSessionState, defaultDir: string, defaultBasename: string) => Promise<SaveResponse>;
// ...
```

Phase 20 D-21 adds:

```typescript
// Phase 20 D-21 — HTML export.
exportDocumentationHtml: (payload: DocExportPayload) => Promise<DocExportResponse>;
```

Where `DocExportPayload` and `DocExportResponse` are defined in `src/main/doc-export.ts` (alongside the handler) and re-exported through `'../shared/types.js'` if cross-process type sharing is needed (preload bridges main types into renderer). Mirror existing `SaveResponse` location pattern.

---

### `src/main/summary.ts` (EXTEND — `events` field)

**Analog:** self (lines 113-130 existing field construction).

Source: `src/main/summary.ts:113-130`:

```typescript
return {
  skeletonPath: load.skeletonPath,
  atlasPath: load.atlasPath,
  bones: {
    count: skeletonData.bones.length,
    names: skeletonData.bones.map((b) => b.name),
  },
  slots: { count: skeletonData.slots.length },
  attachments: { count: attachmentCount, byType },
  skins: {
    count: skeletonData.skins.length,
    names: skeletonData.skins.map((s) => s.name),
  },
  animations: {
    count: skeletonData.animations.length,
    names: skeletonData.animations.map((a) => a.name),
  },
  peaks: peaksArray,
  // ...
};
```

**Phase 20 inserts after `animations` and before `peaks`:**

```typescript
events: {
  count: skeletonData.events.length,
  names: skeletonData.events.map((e) => e.name),
},
```

Source for `EventData.name`: `node_modules/@esotericsoftware/spine-core/dist/SkeletonData.d.ts:55-56` (`events: EventData[]`). [VERIFIED in RESEARCH.md line 749.]

---

### `src/main/ipc.ts` (EXTEND — register channel)

**Analog:** self (line 881 `project:save` registration).

Source: `src/main/ipc.ts:878-901`:

```typescript
// Phase 8 — project file IPC channels (D-140..D-156). Six invoke channels
// routing to src/main/project-io.ts.
ipcMain.handle('project:save', async (_evt, state, currentPath) =>
  handleProjectSave(state, currentPath),
);
ipcMain.handle('project:save-as', async (_evt, state, defaultDir, defaultBasename) =>
  handleProjectSaveAs(state, defaultDir, defaultBasename),
);
ipcMain.handle('project:open', async (_evt) => handleProjectOpen());
```

**Phase 20 adds (insert alongside `project:*` handlers):**

```typescript
// Phase 20 D-21 — Documentation HTML export channel.
ipcMain.handle('documentation:exportHtml', async (_evt, payload) =>
  handleExportDocumentationHtml(payload as DocExportPayload),
);
```

Add file-top import: `import { handleExportDocumentationHtml, type DocExportPayload } from './doc-export.js';`.

---

### `src/preload/index.ts` (EXTEND — preload bridge)

**Analog:** self (line 78-79 `pickOutputDirectory`).

Source: `src/preload/index.ts:78-79`:

```typescript
pickOutputDirectory: (defaultPath?: string): Promise<string | null> =>
  ipcRenderer.invoke('dialog:pick-output-dir', defaultPath),
```

**Phase 20 adds inside the `api` const object:**

```typescript
// Phase 20 D-21 — Documentation HTML export.
exportDocumentationHtml: (payload: DocExportPayload): Promise<DocExportResponse> =>
  ipcRenderer.invoke('documentation:exportHtml', payload),
```

---

### `src/renderer/src/components/AppShell.tsx` (EXTEND — wire button + state hoist)

**Analog:** self (multiple sites).

#### Insertion site 1 — useState for modal lifecycle (after line 159)

Source: `AppShell.tsx:157-159`:

```typescript
// Phase 7 D-134 — NEW: Atlas Preview modal lifecycle. Plain boolean, no
// snapshot state — the modal reads summary + overrides directly (D-131).
const [atlasPreviewOpen, setAtlasPreviewOpen] = useState(false);
```

**Phase 20 adds parallel:**

```typescript
// Phase 20 D-01 — Documentation Builder modal lifecycle.
const [documentationBuilderOpen, setDocumentationBuilderOpen] = useState(false);
const [documentation, setDocumentation] = useState<Documentation>(DEFAULT_DOCUMENTATION);
```

(Add file-top import: `import type { Documentation } from '../../../core/documentation.js';` and `import { DEFAULT_DOCUMENTATION } from '../../../core/documentation.js';` — note: the renderer importing from `core/` is gated by `tests/arch.spec.ts:19-34`. RESEARCH.md line 200 documents the route: `Documentation` types live in `src/core/documentation.ts` AND are re-exported through `src/shared/types.ts` so the renderer's import of types stays legal. The planner must verify `src/core/documentation.ts` exports types only (no functions) for the renderer-side import path, OR re-export through `shared/types.ts`.)

#### Insertion site 2 — buildSessionState (line 578-597)

Source: `AppShell.tsx:578-597`:

```typescript
const buildSessionState = useCallback(
  (): AppSessionState => ({
    skeletonPath: summary.skeletonPath,
    atlasPath: summary.atlasPath ?? null,
    imagesDir: null,
    overrides: Object.fromEntries(overrides),
    samplingHz: samplingHzLocal,
    lastOutDir: null,
    sortColumn: 'attachmentName',
    sortDir: 'asc',
  }),
  [summary.skeletonPath, summary.atlasPath, overrides, samplingHzLocal],
);
```

**Phase 20 extends:**

```typescript
const buildSessionState = useCallback(
  (): AppSessionState => ({
    skeletonPath: summary.skeletonPath,
    atlasPath: summary.atlasPath ?? null,
    imagesDir: null,
    overrides: Object.fromEntries(overrides),
    samplingHz: samplingHzLocal,
    lastOutDir: null,
    sortColumn: 'attachmentName',
    sortDir: 'asc',
    documentation,  // NEW (Phase 20 D-01)
  }),
  [summary.skeletonPath, summary.atlasPath, overrides, samplingHzLocal, documentation],
);
```

#### Insertion site 3 — Documentation button (lines 1189-1197)

Source: `AppShell.tsx:1189-1197`:

```tsx
<button
  type="button"
  disabled
  aria-disabled="true"
  title="Available in v1.2 Phase 20"
  className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
>
  Documentation
</button>
```

**Phase 20 transforms (REMOVE `disabled`, `aria-disabled`, `title`; ADD `onClick`). Class string preserved verbatim:**

```tsx
<button
  type="button"
  onClick={() => setDocumentationBuilderOpen(true)}
  className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
>
  Documentation
</button>
```

#### Insertion site 4 — Modal mount (alongside `<AtlasPreviewModal>` somewhere late in the JSX tree)

Source: existing `<AtlasPreviewModal>` mount in `AppShell.tsx` (search by name). Mount `<DocumentationBuilderDialog>` parallel:

```tsx
<DocumentationBuilderDialog
  open={documentationBuilderOpen}
  documentation={documentation}
  summary={effectiveSummary}
  onChange={setDocumentation}
  onClose={() => setDocumentationBuilderOpen(false)}
/>
```

Plus the export-pane payload assembly (see RESEARCH.md lines 1222-1247 `Click-time payload assembly`).

#### Insertion site 5 — Drift policy on materialize (Pitfall 4)

After `mountOpenResponse` (search the AppShell file by name) processes the materialized `.stmproj` payload, intersect documentation entries with current skeleton names. RESEARCH §Pitfall 4 (lines 1008-1019) specifies:

```typescript
// After OpenResponse arrives — renderer-side intersection mirrors Phase 8 D-150
// stale-overrides handling.
const driftedDoc = {
  ...materialized.documentation,
  events: materialized.documentation.events.filter(e =>
    summary.events.names.includes(e.name)
  ).concat(
    summary.events.names
      .filter(n => !materialized.documentation.events.some(e => e.name === n))
      .map(n => ({ name: n, description: '' }))
  ),
  controlBones: materialized.documentation.controlBones.filter(b =>
    summary.bones.names.includes(b.name)
  ),
  skins: materialized.documentation.skins.filter(s =>
    summary.skins.names.includes(s.name)
  ).concat(/* auto-add new skins */),
  animationTracks: materialized.documentation.animationTracks.filter(t =>
    summary.animations.names.includes(t.animationName)
  ),
};
setDocumentation(driftedDoc);
```

Pattern parallel: Phase 8 D-150 stale-override intersection at the same boundary (search AppShell for `staleOverrideKeys`).

---

### `tests/core/project-file.spec.ts` (EXTEND — round-trip with documentation)

**Analog:** self (lines 92-125 existing round-trip tests).

Source: `tests/core/project-file.spec.ts:92-125`:

```typescript
describe('round-trip (D-145 + D-148 + D-155)', () => {
  it('round-trip preserves all D-145 fields', () => {
    const state: AppSessionState = {
      skeletonPath: '/a/b/SIMPLE.json',
      // ...
    };
    const file = serializeProjectFile(state, '/a/b/proj.stmproj');
    const back = materializeProjectFile(file, '/a/b/proj.stmproj');
    expect(back.skeletonPath).toBe(state.skeletonPath);
  });

  it('documentation slot preserved on round-trip (D-148)', () => {
    const state: AppSessionState = { /* ... */ };
    const file = serializeProjectFile(state, '/a/b/proj.stmproj');
    expect(file.documentation).toEqual({});
    // ...
  });
});
```

**Phase 20 update at line 119:** the existing assertion `expect(file.documentation).toEqual({})` must change because `serializeProjectFile` now writes `state.documentation` (not the empty literal). After Phase 20, the assertion becomes `expect(file.documentation).toEqual(DEFAULT_DOCUMENTATION)` (or whatever doc the test state passes). The `'documentation slot preserved on round-trip'` test stays valid; just the literal expectation changes.

**Phase 20 also adds a new round-trip test file** `tests/core/documentation-roundtrip.spec.ts` per RESEARCH §Round-Trip Test Surface (lines 1359-1424):

```typescript
const REPRESENTATIVE_DOC: Documentation = {
  animationTracks: [
    { id: 'uuid-1', trackIndex: 0, animationName: 'PATH', mixTime: 0.25, loop: true, notes: 'Primary loop' },
    { id: 'uuid-2', trackIndex: 1, animationName: 'PATH', mixTime: 0.5, loop: false, notes: '' },
  ],
  events: [{ name: 'shoot', description: 'Fires when ammo expended' }],
  generalNotes: 'Multi-line\nnotes\nhere.',
  controlBones: [{ name: 'CHAIN_2', description: 'Spine root' }],
  skins: [{ name: 'default', description: 'The default skin' }],
  safetyBufferPercent: 5,
};

it('representative doc survives serialize → JSON.parse → validate → materialize bit-equal', () => {
  const state: AppSessionState = { /* ... */, documentation: REPRESENTATIVE_DOC };
  const file = serializeProjectFile(state, '/tmp/test.stmproj');
  const json = JSON.stringify(file);
  const parsed = JSON.parse(json);
  const v = validateProjectFile(parsed);
  expect(v.ok).toBe(true);
  if (!v.ok) return;
  const mat = materializeProjectFile(v.project, '/tmp/test.stmproj');
  expect(mat.documentation).toEqual(REPRESENTATIVE_DOC);
});
```

---

## Shared Patterns

These cross-cutting patterns apply to multiple new/extended files in this phase.

### Authentication / Authorization
**Not applicable** — Phase 20 is a desktop app with no user authentication surface. The `useFocusTrap` hook (`src/renderer/src/hooks/useFocusTrap.ts`) is the closest thing to an "access guard": it locks Tab focus inside the modal subtree.

### Error Handling
**Source:** `src/shared/types.ts:535-571` (`SerializableError` 8-kind discriminated union)
**Apply to:** `src/main/doc-export.ts`, `src/core/documentation.ts` validator
**Discipline:** Phase 20 reuses **two existing kinds**: `'invalid-shape'` (for malformed documentation rejected by validator → surfaces as `'ProjectFileParseError'` envelope per `types.ts:555`) and `'Unknown'` (for cancellation, fs error during HTML export). **No 9th kind added** (D-04, D-21).

```typescript
// src/main/project-io.ts:178-179 — cancel envelope shape (verbatim copy):
if (result.canceled || !result.filePath) {
  return { ok: false, error: { kind: 'Unknown', message: 'Save cancelled' } };
}
```

```typescript
// src/main/project-io.ts:235-243 — wrapped-throw envelope (verbatim shape):
return {
  ok: false,
  error: {
    kind: 'Unknown',
    message: `serializeProjectFile failed: ${
      err instanceof Error ? err.message : String(err)
    }`,
  },
};
```

### Validation
**Source:** `src/core/project-file.ts:84-202` (`validateProjectFile`)
**Apply to:** `src/core/documentation.ts:validateDocumentation`
**Discipline:** Per-field hand-rolled type guards. NO schema lib (zod / ajv / yup). Each rejection returns `{ ok: false, error: { kind: 'invalid-shape', message: '<specific message identifying the field>' } }`. Messages MUST identify the offending field path (e.g. `documentation.animationTracks[3].mixTime is not a non-negative finite number`).

### structuredClone-safety
**Source:** `src/shared/types.ts:7-15` (file-top docblock)
**Apply to:** `Documentation`, `AnimationTrackEntry`, `EventDescriptionEntry`, `BoneDescriptionEntry`, `SkinDescriptionEntry`, `DocExportPayload` types.
**Discipline:** Every field is a primitive (string, number, boolean), array of primitives, plain object, or array of plain objects. NO Maps, NO Sets, NO Dates with timezone, NO class instances, NO Functions, NO Symbols. `crypto.randomUUID()` returns `string`, fine.

### Tailwind v4 literal-class discipline
**Source:** Phase 19 PATTERNS lines 232-258 + Phase 4 D-77..D-81 (Pitfall 8)
**Apply to:** `src/renderer/src/modals/DocumentationBuilderDialog.tsx` ONLY (HTML export uses literal CSS in inline `<style>` block, NOT subject to this rule).
**Discipline:** Every `className=` is a string literal or `clsx(literal, ...)` with literal branches. NO template strings, NO runtime concatenation. Tailwind v4's JIT statically scans source for class strings — programmatic composition is invisible to the scanner.

### Layer 3 invariant (no DOM, no fs in core)
**Source:** `tests/arch.spec.ts:19-34` (renderer-boundary grep) + `tests/arch.spec.ts:116-134` (forbidden-import grep on `src/core/*`) + CLAUDE.md fact #5
**Apply to:** `src/core/documentation.ts`
**Discipline:** No `node:fs`, no `electron`, no DOM types. Only pure TypeScript. `node:path` is allowed (Phase 8 precedent in `project-file.ts`).

### 5-modal ARIA scaffold
**Source:** `src/renderer/src/modals/OptimizeDialog.tsx:299-315` + `src/renderer/src/modals/OverrideDialog.tsx:100-115`
**Apply to:** `src/renderer/src/modals/DocumentationBuilderDialog.tsx` (10th hand-rolled modal)
**Discipline:** `role="dialog"` + `aria-modal="true"` + `aria-labelledby="<title-id>"` + outer overlay `onClick={onClose}` + inner panel `onClick={(e) => e.stopPropagation()}` + `useFocusTrap(dialogRef, props.open, { onEscape: props.onClose })`. **NEVER touched.** Locked across all 9 existing modals; Phase 20 makes 10.

### Atomic write Pattern-B
**Source:** `src/main/project-io.ts:246-271` (verbatim) + `src/main/image-worker.ts:289-304` (D-121 prior art)
**Apply to:** `src/main/doc-export.ts`
**Discipline:** `writeFile(<finalPath>.tmp, content, 'utf8')` → `rename(<finalPath>.tmp, <finalPath>)`. Inline the 4-line idiom; do NOT extract a helper (4-precedent inline pattern; extracting would force callers to translate envelopes).

### IPC channel registration triple
**Source:** `src/main/ipc.ts:881-883` (handler) + `src/preload/index.ts:78-79` (bridge) + `src/shared/types.ts:807-809` (`Api` interface)
**Apply to:** new `'documentation:exportHtml'` channel
**Discipline:** Three-tier registration. Main: `ipcMain.handle('<channel>', async (_evt, ...args) => handler(...))`. Preload: `<methodName>: (...args) => ipcRenderer.invoke('<channel>', ...args)`. Renderer: typed via `Api` interface in `shared/types.ts`. Phase 20 mirrors verbatim.

### structuredClone-safety check before IPC
**Source:** RESEARCH.md lines 1249-1256 (Phase 20 walkthrough)
**Apply to:** `DocExportPayload` shape
**Discipline:** Every field of any IPC payload is checked against the structuredClone allowlist (primitives, arrays, plain objects only). Phase 20 confirms `DocExportPayload` passes: `Documentation` (primitives + arrays + plain objects), `SkeletonSummary` (Phase 1 D-21 lock), `AtlasPreviewProjection` (Phase 7 D-21 lock), `number | null`, `string`. ✓

---

## No Analog Found

Phase 20 has **one** new pattern with no existing analog in the repo:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| HTML5 native DnD inside `DocumentationBuilderDialog.tsx` | UI interaction | renderer-only DOM events | First DnD pattern in repo. The DropZone wrapper at AppShell-load handles file drops (`dataTransfer.types.includes('Files')`), but is for OS-file-drop, not intra-window drag. Phase 20's drag is animation-name strings via custom MIME `'application/x-stm-anim'`. |
| `tests/renderer/documentation-builder-dialog.spec.tsx` DnD `fireEvent.dragStart`/`drop` | renderer integration test | jsdom + RTL synthetic events | First DnD test in repo. RTL `fireEvent.drop` API exists; no precedent in this codebase to copy from. |

For these, the planner MUST treat **RESEARCH.md Pattern 4** (lines 525-600) as the authoritative source. Key contracts:

- `e.dataTransfer.effectAllowed = 'copy'` on `dragstart` (Electron Chromium quirk per D-06).
- `e.preventDefault()` on `dragover` (HTML5 spec — drop is silently rejected without it).
- MIME type `'application/x-stm-anim'` (namespaced to avoid collision with file-drop pathway per Pitfall 3).

Also: HTML export inline `<style>` template (`src/main/doc-export.ts`'s `renderDocumentationHtml`). RESEARCH.md Pattern 8 (lines 765-896) has the full template including the `:root` CSS variable block, palette literals (`#1c1917`, `#23201d`, `#e06b55`, `#5fa8d4`, `#5fa866`, `#a8a29e`), card/chip/track-divider classes, and the `.loop-pill` style. Use that template verbatim as the starting point.

---

## Metadata

**Analog search scope:**
- `src/core/` (validators + serde)
- `src/main/` (IPC handlers + atomic write + summary builder)
- `src/renderer/src/modals/` (8 hand-rolled modals)
- `src/renderer/src/hooks/` (useFocusTrap)
- `src/renderer/src/components/AppShell.tsx` (button-wiring + tab-strip + state hoist)
- `src/shared/types.ts` (existing IPC type definitions)
- `tests/core/`, `tests/main/`, `tests/renderer/` (test patterns)
- `.planning/phases/19-ui-improvements-ui-01-05/` (Phase 19 InfoCard tile + SVG glyph + outlined-secondary CTA precedents)

**Files scanned:** ~25 (via Read of relevant ranges only — no whole-file loads on > 2000-line files; tab-strip + button wiring + atomic write + validator + ARIA scaffold + tests all loaded as targeted excerpts).

**Pattern extraction date:** 2026-05-01

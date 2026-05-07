# Phase 23: Optimize flow — defer folder picker - Pattern Map

**Mapped:** 2026-05-03
**Files analyzed:** 4 (3 modified, 1 new test)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/renderer/src/components/AppShell.tsx` | component (orchestrator) | event-driven, request-response | self (restructure of existing code) | exact |
| `src/renderer/src/modals/OptimizeDialog.tsx` | component (modal) | request-response | self (prop type widening + conditional render) | exact |
| `src/shared/types.ts` | types | — | self (schema already correct; no change needed) | exact — no edit |
| `tests/renderer/appshell-optimize-flow.spec.tsx` | test | request-response | `tests/renderer/app-shell-output-picker.spec.tsx` + `tests/renderer/optimize-dialog-passthrough.spec.tsx` | role-match |

---

## Pattern Assignments

### `src/renderer/src/components/AppShell.tsx` (component orchestrator, event-driven)

This file is restructured, not replaced. Four distinct edit sites.

---

#### Edit site A — `exportDialogState` type widening (line 360-363)

**Current code** (`AppShell.tsx:360-363`):
```typescript
const [exportDialogState, setExportDialogState] = useState<{
  plan: ExportPlan;
  outDir: string;
} | null>(null);
```

**New code** — widen `outDir` to `string | null` so the dialog can mount before a folder is confirmed:
```typescript
const [exportDialogState, setExportDialogState] = useState<{
  plan: ExportPlan;
  outDir: string | null;
} | null>(null);
```

---

#### Edit site B — new `lastOutDir` state slot + `onClickOptimize` restructure (lines 492-519)

**Add new state slot** (place near other session-metadata state slots, e.g. after `samplingHzLocal`):
```typescript
// Phase 23 — lastOutDir: session-metadata state slot. Seeded from
// initialProject?.lastOutDir on load; updated by onConfirmStart after
// the user confirms a folder on Start. Not in the dirty signal (D-08).
const [lastOutDir, setLastOutDir] = useState<string | null>(
  () => initialProject?.lastOutDir ?? null,
);
```

The `initialProject` seed pattern is the established pattern for all session-metadata state in AppShell:
- `samplingHzLocal` is seeded from prop `samplingHz`
- `loaderMode` is seeded from `initialProject?.loaderMode ?? 'auto'` (line 274)
- `overrides` Map is seeded from `initialProject?.restoredOverrides` (line 282)

**`pickOutputDir` function** — unchanged signature, but it now accepts an explicit start path instead of always using `skeletonDir`. Refactor to accept a parameter:
```typescript
const pickOutputDir = useCallback(
  async (startPath: string): Promise<string | null> => {
    return window.api.pickOutputDirectory(startPath);
  },
  [],
);
```

The `skeletonDir` derivation regex (line 510) moves to call sites:
```typescript
const skeletonDir = summary.skeletonPath.replace(/[\\/][^\\/]+$/, '') || '.';
```

**`onClickOptimize`** — loses the picker call; becomes plan-then-mount:
```typescript
const onClickOptimize = useCallback(async () => {
  const plan = buildExportPlan(summary, overrides);
  setExportDialogState({ plan, outDir: lastOutDir });
}, [summary, overrides, lastOutDir]);
```

Pattern precedent: the `useCallback` + `setExportDialogState` pattern is already used at line 514-519 and throughout AppShell. The change removes one `await` and removes the early-return null guard.

---

#### Edit site C — `onConfirmStart` gains picker call (lines 541-564)

**Current code** (`AppShell.tsx:541-564`):
```typescript
const onConfirmStart = useCallback(async (): Promise<{
  proceed: boolean;
  overwrite?: boolean;
}> => {
  if (exportDialogState === null) return { proceed: false };
  const { plan, outDir } = exportDialogState;
  const probeResult = await window.api.probeExportConflicts(plan, outDir);
  // ... probe logic unchanged ...
}, [exportDialogState]);
```

**New code** — picker runs first; if cancelled, return `{ proceed: false }` to stay in pre-flight (D-05). On success, set `exportDialogState.outDir` + `lastOutDir` before probe:
```typescript
const onConfirmStart = useCallback(async (): Promise<{
  proceed: boolean;
  overwrite?: boolean;
}> => {
  if (exportDialogState === null) return { proceed: false };
  const { plan } = exportDialogState;

  // Phase 23 D-03/D-04 — picker always opens on Start; pre-filled with
  // lastOutDir when saved, otherwise skeletonDir (Phase 12 F2 fix preserved).
  const startPath = lastOutDir ?? (summary.skeletonPath.replace(/[\\/][^\\/]+$/, '') || '.');
  const pickedDir = await pickOutputDir(startPath);
  if (pickedDir === null) {
    // D-05: user cancelled picker → stay in pre-flight (dialog stays open).
    return { proceed: false };
  }

  // Update outDir in state immediately so OptimizeDialog header title
  // reflects the confirmed folder during the probe wait.
  setExportDialogState((prev) => prev ? { ...prev, outDir: pickedDir } : null);
  setLastOutDir(pickedDir);

  const probeResult = await window.api.probeExportConflicts(plan, pickedDir);
  if (!probeResult.ok) {
    return { proceed: true, overwrite: false };
  }
  if (probeResult.conflicts.length === 0) {
    return { proceed: true, overwrite: false };
  }
  return new Promise((resolve) => {
    pendingConfirmResolve.current = resolve;
    setConflictState({ conflicts: probeResult.conflicts });
  });
}, [exportDialogState, lastOutDir, summary.skeletonPath, pickOutputDir]);
```

**Pattern precedent for `setExportDialogState` functional update:** The functional form `setExportDialogState((prev) => ...)` is the safe pattern when reading stale state inside an async callback. AppShell uses the functional form of `setState` elsewhere (e.g. `setOverrides`).

**Pattern precedent for the probe-then-confirm contract:** The `onConfirmStart` return type `{ proceed: boolean; overwrite?: boolean }` is unchanged — this contract is consumed verbatim by `OptimizeDialog`. Phase 23 adds picker before probe; probe logic is unchanged.

---

#### Edit site D — `buildSessionState` + `onRunEnd` (lines 625-662, 1566-1567)

**`buildSessionState`** (`AppShell.tsx:625-662`) — replace the hardcoded `lastOutDir: null` at line 638 with the state slot:

Current (line 638):
```typescript
// Phase 9 polish — currently null; D-145 schema field present but
// not yet hoisted into AppShell state. Documented deferral per D-147.
lastOutDir: null,
```

New:
```typescript
lastOutDir,
```

The `lastOutDir` state slot is now in scope (added in Edit site B). `buildSessionState` already reads all other session-metadata state slots the same way (`samplingHz: samplingHzLocal`, `documentation`, `loaderMode`). This is a one-line substitution following the exact same pattern.

**`onRunEnd` silent auto-save** — the `onRunEnd` callback prop on `<OptimizeDialog>` (line 1567) gains a silent save:

Current (line 1566-1567):
```typescript
onRunStart={() => setExportInFlight(true)}
onRunEnd={() => setExportInFlight(false)}
```

New:
```typescript
onRunStart={() => setExportInFlight(true)}
onRunEnd={() => {
  setExportInFlight(false);
  // Phase 23 D-07 — silently persist lastOutDir to .stmproj after export.
  // Fire-and-forget: no UI indicator, no dirty-signal change (D-08).
  if (currentProjectPath !== null) {
    void window.api.saveProject(buildSessionState(), currentProjectPath);
  }
}}
```

**Pattern precedent for silent fire-and-forget IPC calls:**
- `resampleProject` is called from a `useEffect` with no await/loading state in the UI path (AppShell.tsx line 1082).
- `window.api.saveProject` is already called at line 737 in `onClickSave`. The silent path skips `setSaveInFlight(true/false)` and the `setLastSaved` update — only the persistence side-effect matters.
- The CONTEXT.md `code_context` section confirms: "fire-and-forget, no UI indicator needed."

---

#### Edit site E — `<OptimizeDialog>` JSX mount site (lines 1560-1571)

**Current** (`AppShell.tsx:1560-1571`):
```typescript
{exportDialogState !== null && (
  <OptimizeDialog
    open={true}
    plan={exportDialogState.plan}
    outDir={exportDialogState.outDir}
    onClose={() => setExportDialogState(null)}
    onRunStart={() => setExportInFlight(true)}
    onRunEnd={() => setExportInFlight(false)}
    onConfirmStart={onConfirmStart}
    onOpenAtlasPreview={() => setAtlasPreviewOpen(true)}
  />
)}
```

`outDir={exportDialogState.outDir}` now passes `string | null` — the widened type from Edit site A. No other JSX change needed here beyond `onRunEnd` (Edit site D).

---

### `src/renderer/src/modals/OptimizeDialog.tsx` (modal component, request-response)

Two edit sites.

---

#### Edit site A — `OptimizeDialogProps.outDir` type widening (lines 55-93)

**Current** (`OptimizeDialog.tsx:55-93`):
```typescript
export interface OptimizeDialogProps {
  open: boolean;
  plan: ExportPlan;
  outDir: string;
  // ...
}
```

**New** — widen `outDir` to `string | null`:
```typescript
export interface OptimizeDialogProps {
  open: boolean;
  plan: ExportPlan;
  outDir: string | null;
  // ...
}
```

**Pattern precedent:** `onConfirmStart` is already optional (`onConfirmStart?: () => Promise<...>`), showing the pattern for adding nullable/optional behavior to this interface (Gap-Fix Round 3, described in the JSDoc block at lines 62-79).

---

#### Edit site B — `headerTitle` derivation conditional (lines 311-316)

**Current** (`OptimizeDialog.tsx:311-316`):
```typescript
const headerTitle =
  state === 'complete'
    ? `Export complete — ${summary?.successes ?? 0} of ${total} succeeded`
    : state === 'in-progress'
      ? `Optimize Assets — ${progress.current} of ${total} → ${props.outDir}`
      : `Optimize Assets — ${total} images → ${props.outDir}`;
```

**New** — pre-flight branch conditionally omits path per D-01/D-02:
```typescript
const headerTitle =
  state === 'complete'
    ? `Export complete — ${summary?.successes ?? 0} of ${total} succeeded`
    : state === 'in-progress'
      ? `Optimize Assets — ${progress.current} of ${total} → ${props.outDir}`
      : props.outDir !== null
        ? `Optimize Assets — ${total} images → ${props.outDir}`
        : `Optimize Assets — ${total} images`;
```

The in-progress branch can safely keep `props.outDir` (non-null by construction: picker runs before Start flips to in-progress via `onConfirmStart`).

**Guard on `onOpenOutputFolder`** (`OptimizeDialog.tsx:256-258`):
```typescript
const onOpenOutputFolder = useCallback(() => {
  window.api.openOutputFolder(props.outDir);
}, [props.outDir]);
```

With `outDir: string | null`, this now type-errors. Add a null guard:
```typescript
const onOpenOutputFolder = useCallback(() => {
  if (props.outDir !== null) {
    window.api.openOutputFolder(props.outDir);
  }
}, [props.outDir]);
```

The button that calls `onOpenOutputFolder` is only rendered in `state === 'complete'`; by then `outDir` is always set. The null guard is defensive type-safety, not a behavior change.

---

### `src/shared/types.ts` — NO EDIT NEEDED

`ProjectFileV1.lastOutDir: string | null` (line 780) and `AppSessionState.lastOutDir: string | null` (line 815) already exist with the correct type. The schema requires no change.

---

### `tests/renderer/appshell-optimize-flow.spec.tsx` (new test file, request-response)

**No existing file** — must be created. The test surface is defined in CONTEXT.md §"Test Surface."

**Primary analogs:**

1. `tests/renderer/app-shell-output-picker.spec.tsx` — pattern for source-grep regression tests and skeletonDir derivation tests. Shows: `readFile` + strip comments approach, pure derivation mirrors.
2. `tests/renderer/optimize-dialog-passthrough.spec.tsx` — pattern for OptimizeDialog render tests. Shows: `// @vitest-environment jsdom`, `vi.stubGlobal('api', {...})`, `beforeEach`/`afterEach` cleanup, `REQUIRED_PROPS` constant, `makePlan` + `makeRow` factory helpers, `screen.getBy*` / `screen.queryBy*` assertions without jest-dom matchers.
3. `tests/renderer/save-load.spec.tsx` — pattern for AppShell integration tests requiring the full `window.api` stub surface (all 25+ IPC channels must be mocked or mount throws).

**Test file structure to follow** (from `optimize-dialog-passthrough.spec.tsx`):

```typescript
// @vitest-environment jsdom
/**
 * Phase 23 — appshell-optimize-flow.spec.tsx
 * Tests for the deferred-folder-picker optimize flow.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { OptimizeDialog } from '../../src/renderer/src/modals/OptimizeDialog';
import type { ExportPlan, ExportRow } from '../../src/shared/types';

beforeEach(() => {
  vi.stubGlobal('api', {
    onExportProgress: vi.fn(() => () => undefined),
    startExport: vi.fn(),
    cancelExport: vi.fn(),
    openOutputFolder: vi.fn(),
    pickOutputDirectory: vi.fn(),
    probeExportConflicts: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});
```

**`REQUIRED_PROPS` constant pattern** (with widened `outDir`):
```typescript
const REQUIRED_PROPS = {
  open: true,
  outDir: null,           // Phase 23: null on first open (no saved path)
  onClose: vi.fn(),
  onOpenAtlasPreview: vi.fn(),
};
```

**Header title variant tests** (D-01/D-02):
```typescript
it('D-01: pre-flight header shows N images (no path) when outDir is null', () => {
  render(<OptimizeDialog {...REQUIRED_PROPS} outDir={null} plan={makePlan()} />);
  expect(screen.getByText(/Optimize Assets — \d+ images$/)).not.toBeNull();
  // Must NOT show an arrow → path when no folder is saved.
  expect(screen.queryByText(/→/)).toBeNull();
});

it('D-02: pre-flight header shows N images → /path when outDir is set', () => {
  render(<OptimizeDialog {...REQUIRED_PROPS} outDir="/saved/output" plan={makePlan()} />);
  expect(screen.getByText(/Optimize Assets — \d+ images → \/saved\/output/)).not.toBeNull();
});
```

**Source-grep regression pattern** (from `app-shell-output-picker.spec.tsx`):
```typescript
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

it('AppShell.tsx source: onClickOptimize does NOT call pickOutputDirectory', async () => {
  const srcPath = resolve(__dirname, '..', '..', 'src', 'renderer', 'src', 'components', 'AppShell.tsx');
  const src = await readFile(srcPath, 'utf8');
  // Strip comments (same coarse approach as app-shell-output-picker.spec.tsx).
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
  // onClickOptimize must NOT contain a pickOutputDirectory call.
  const onClickOptimizeMatch = codeOnly.match(/const onClickOptimize[\s\S]*?\}\s*,\s*\[/);
  if (onClickOptimizeMatch) {
    expect(onClickOptimizeMatch[0]).not.toMatch(/pickOutputDirectory/);
  }
});
```

**Per project test convention** (from `optimize-dialog-passthrough.spec.tsx:18-19`):
```
use `not.toBeNull()` / `toBeDefined()` rather than @testing-library/jest-dom
matchers — no jest-dom imports anywhere in tests/renderer.
```

---

## Shared Patterns

### Silent fire-and-forget IPC call
**Source:** `AppShell.tsx:1082` (`resampleProject`) + `AppShell.tsx:737` (`saveProject` in `onClickSave`)
**Apply to:** `onRunEnd` silent auto-save in AppShell.tsx

Pattern: wrap `window.api.*` in `void` (no `await`, no loading state update):
```typescript
void window.api.saveProject(buildSessionState(), currentProjectPath);
```

`buildSessionState()` is a synchronous `useCallback` that closes over all session state slots — it is safe to call at any point during the React render cycle as long as state is up to date. Since `setLastOutDir(pickedDir)` runs in `onConfirmStart` before the export begins, `buildSessionState()` in `onRunEnd` will include the confirmed folder.

### `useState` lazy initializer seeded from `initialProject`
**Source:** `AppShell.tsx:274` (`loaderMode`), `AppShell.tsx:282` (`overrides`)
**Apply to:** new `lastOutDir` state slot in AppShell.tsx

Pattern:
```typescript
const [fieldName, setFieldName] = useState<Type>(
  () => initialProject?.fieldName ?? defaultValue,
);
```

### `useCallback` with async IPC + early-return null guard
**Source:** `AppShell.tsx:492-519` (`pickOutputDir`, `onClickOptimize`)
**Apply to:** restructured `onClickOptimize` and `onConfirmStart`

Pattern — async callback with null-check guard:
```typescript
const handler = useCallback(async () => {
  const result = await window.api.someIpc(...);
  if (result === null) return; // user cancelled
  // ... continue
}, [dependencies]);
```

### Functional `setExportDialogState` update
**Source:** AppShell functional `setOverrides` pattern throughout the file
**Apply to:** `onConfirmStart` updating `outDir` inside async callback

Pattern — use functional update when state depends on previous value inside async:
```typescript
setExportDialogState((prev) => prev ? { ...prev, outDir: pickedDir } : null);
```

### `buildSessionState` dependency array
**Source:** `AppShell.tsx:654-661`
**Apply to:** updated `buildSessionState` after adding `lastOutDir`

Current deps:
```typescript
[summary.skeletonPath, summary.atlasPath, overrides, samplingHzLocal, documentation, loaderMode]
```

After Phase 23, add `lastOutDir`:
```typescript
[summary.skeletonPath, summary.atlasPath, overrides, samplingHzLocal, documentation, loaderMode, lastOutDir]
```

---

## No Analog Found

None — all four files have direct analogs or are exact self-modifications.

---

## Metadata

**Analog search scope:** `src/renderer/src/components/`, `src/renderer/src/modals/`, `src/shared/`, `tests/renderer/`
**Files scanned:** 7 (AppShell.tsx, OptimizeDialog.tsx, types.ts, app-shell-output-picker.spec.tsx, optimize-dialog-passthrough.spec.tsx, optimize-dialog-passthrough-rows.spec.tsx, save-load.spec.tsx)
**Pattern extraction date:** 2026-05-03

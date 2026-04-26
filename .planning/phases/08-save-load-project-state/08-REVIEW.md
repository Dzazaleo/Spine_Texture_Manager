---
phase: 08-save-load-project-state
type: code-review
depth: standard
status: issues-found
files_reviewed: 14
diff_base: 552389e
date: 2026-04-26
findings:
  critical: 0
  warning: 10
  info: 6
  total: 16
---

# Phase 8 Code Review

Standard-depth review of 14 in-scope files (10 source + 4 test). Manual UAT signed off; none of the findings block phase completion. WR-02 + WR-09 are the highest-priority items (recovery-flow reachability concerns that warrant re-verification).

## Files Reviewed

- src/core/project-file.ts
- src/main/index.ts
- src/main/ipc.ts
- src/main/project-io.ts
- src/preload/index.ts
- src/renderer/src/App.tsx
- src/renderer/src/components/AppShell.tsx
- src/renderer/src/components/DropZone.tsx
- src/renderer/src/modals/SaveQuitDialog.tsx
- src/shared/types.ts
- tests/arch.spec.ts
- tests/core/project-file.spec.ts
- tests/main/project-io.spec.ts
- tests/renderer/save-load.spec.tsx

## Critical (0)

None. IPC envelope discipline, contextBridge surface, atomic-write idiom, and before-quit re-entry guard are all sound. No injection vectors, no hardcoded secrets, no XSS surfaces, no unsafe deserialization.

## Warnings (10)

### WR-01: SaveDialog overwrite confirmation relies on Electron default (implicit)

**File:** src/renderer/src/components/AppShell.tsx:475-479 (call site) and src/main/project-io.ts:122-126 (handler).

**Issue:** `dialog.showSaveDialog` options lack `properties: ['showOverwriteConfirmation']`. Electron defaults to enabling it on both macOS and Windows, but the reliance is implicit. Pin like the security defaults in index.ts:128-130 so any regression is regression-visible.

**Fix:**
```ts
const options: Electron.SaveDialogOptions = {
  title: 'Save Spine Texture Manager Project',
  defaultPath: path.join(defaultDir, `${defaultBasename}.stmproj`),
  filters: [{ name: 'Spine Texture Manager Project', extensions: ['stmproj'] }],
  properties: ['showOverwriteConfirmation'],
};
```

### WR-02: Toolbar Open path's locate-skeleton recovery is broken — picker variant discards projectPath

**File:** src/renderer/src/components/AppShell.tsx:518-546.

**Issue:** `onClickOpen` (toolbar Open + Cmd+O) calls `window.api.openProject()`, whose `SkeletonNotFoundOnLoadError` envelope does NOT carry the `.stmproj` path or cached overrides. The AppShell branch stashes empty strings into `skeletonNotFoundError.{originalSkeletonPath, projectPath}`, so clicking "Locate skeleton…" calls `reloadProjectWithSkeleton({ projectPath: '' })`, which main rejects at project-io.ts:469 with `kind:'Unknown', message:'projectPath must be a .stmproj path'`. User sees a bare "Unknown:" banner. The comment at 522-528 acknowledges "best-effort" but the failure mode is silently broken.

**Fix:** Either (a) extend `SerializableError` for this kind to carry `{ projectPath, originalSkeletonPath, mergedOverrides, samplingHz }` so picker recovery has parity with the drop path, or (b) hide the "Locate skeleton…" button when `originalSkeletonPath === ''` and surface a plain banner instead of pretending the recovery path works. (a) is principled; (b) is one-line UX.

### WR-03: validateProjectFile permits 0/negative/non-finite samplingHz

**File:** src/core/project-file.ts:159-164.

**Issue:** Line 159 type-checks but no domain check. A `.stmproj` with `"samplingHz": 0` or `-1` passes validation, flows through `materializeProjectFile` (which keeps the literal — `?? 120` only triggers on null), and `sampleSkeleton` runs with samplingHz=0 → infinite loop or division-by-zero. The renderer never produces such a value but the file is editable on disk and the validator IS the trust boundary.

**Fix:**
```ts
if (obj.samplingHz !== null) {
  if (typeof obj.samplingHz !== 'number' || !Number.isFinite(obj.samplingHz) || obj.samplingHz <= 0) {
    return { ok: false, error: { kind: 'invalid-shape', message: 'samplingHz must be a positive finite number or null' } };
  }
}
```

Same hardening applies to `handleProjectReloadWithSkeleton` at project-io.ts:489 (currently `typeof a.samplingHz === 'number'` permits non-finite values).

### WR-04: migrate() default branch lacks compile-time exhaustiveness

**File:** src/core/project-file.ts:217-224.

**Issue:** The default branch casts `(project as ProjectFile).version` — strips the `never` narrowing. If a future maintainer bumps `V_LATEST` to 2 in the validator without adding `case 2:` here, `migrate()` hits the dead default at runtime. No compile-time guarantee linking V_LATEST to switch exhaustiveness.

**Fix:**
```ts
export function migrate(project: ProjectFile): ProjectFileV1 {
  switch (project.version) {
    case 1: return project;
    default: {
      const _exhaustive: never = project.version;
      throw new Error(`Unsupported project file version: ${String(_exhaustive)}`);
    }
  }
}
```

When `ProjectFile` becomes `ProjectFileV1 | ProjectFileV2`, TS will flag the missing case at compile time.

### WR-05: Cmd+S/O modal-suppression selector is too broad — should require aria-modal="true"

**File:** src/renderer/src/components/AppShell.tsx:589-606.

**Issue:** `document.querySelector('[role="dialog"]')` matches any `role="dialog"` element. Today the project's modals all set `aria-modal="true"` and the non-modal banners use `role="status"` / `role="alert"`, so this works. But any future component that mis-uses `role="dialog"` for a non-blocking inline panel (e.g. a tooltip) silently disables Cmd+S app-wide while mounted.

**Fix:** One-character change with no behavior diff today and a robustness improvement:
```ts
if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
```

### WR-06: Atomic-write tmp orphan accumulates on rename failure

**File:** src/main/project-io.ts:172-198.

**Issue:** Docblock at 148-150 accepts the writeFile-success + rename-failure orphan window, but the rename-failure branch (188-198) does not attempt `unlink(tmpPath)`. The tmp file persists indefinitely. On Windows where rename is best-effort, repeated failures accumulate `<basename>.stmproj.tmp` next to the user's project folder.

**Fix:** Add `try { await unlink(tmpPath); } catch {}` in the rename-failure branch before returning.

### WR-07: handleProjectReloadWithSkeleton does not reject array mergedOverrides

**File:** src/main/project-io.ts:481-486.

**Issue:** `if (!a.mergedOverrides || typeof a.mergedOverrides !== 'object')` passes for arrays (`typeof [] === 'object'`). An array reaching `Object.entries(...)` at 536 enumerates as `['0', element], ['1', element]`. The inner type check at 539 catches non-number values, so the practical fallout is "stale array indices" rather than corruption — but `validateProjectFile` does this correctly (line 129 includes `!Array.isArray(...)`); this handler should mirror.

**Fix:**
```ts
if (!a.mergedOverrides || typeof a.mergedOverrides !== 'object' || Array.isArray(a.mergedOverrides)) {
  return { ok: false, error: { kind: 'Unknown', message: 'mergedOverrides must be a Record' } };
}
```

### WR-08: Dirty-derivation comparison fragile for samplingHz null vs 120

**File:** src/renderer/src/components/AppShell.tsx:482-484 and 450-460.

**Issue:** Today `samplingHz` prop threads as constant 120, so the comparison is safe. But if Phase 9 ever reads a literal `null` from disk and passes through as `samplingHz === null`, the comparison `120 !== null` flags phantom dirty on a file that has never been edited.

**Fix:** Resolve once at the top of AppShell into a `const resolvedHz = samplingHz ?? 120;` so dirty operates on a canonical value. Or document that `samplingHz` is always a resolved number in AppShell. Phase 9 concern.

### WR-09: locate-skeleton recovery flow has no live entry point from .stmproj drop

**File:** src/renderer/src/App.tsx:70-81.

**Issue:** When a `.stmproj` drop returns `SkeletonNotFoundOnLoadError`, App.tsx transitions to `status: 'error'` (line 79). AppShell never mounts. The user sees the generic error UI at App.tsx:125-134 — no "Locate skeleton…" button. Combined with WR-02, the recovery affordance described in project-io.ts:402-430 has no reachable entry point in Phase 8.

UAT signoff suggests the flow was verified through a path I don't see in the code — recommend re-verification.

**Fix:** Either (a) detect `error.kind === 'SkeletonNotFoundOnLoadError'` in App.tsx and route to a new `projectLoadFailed` state that mounts a recovery banner, (b) thread the materialized-but-skeleton-missing project into a degraded `projectLoaded` state where AppShell mounts with banner pre-set, or (c) confirm via UAT screencap. Recommend (b) — minimal app-state-machine churn.

### WR-10: app.on('open-file') Phase 9 scaffold should validate extension now

**File:** src/main/index.ts:107-111.

**Issue:** Forwards any open-file payload to `'project:open-from-os'` without validation. Dead code today (no preload listener) but Phase 9 will wire it. Finder may dispatch open-file for any registered file type.

**Fix:** Add the extension check now:
```ts
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (!filePath.toLowerCase().endsWith('.stmproj')) return;
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('project:open-from-os', filePath);
});
```

## Info (6)

### IN-01: lastOutDir absolute is intentional (D-145)

**File:** src/core/project-file.ts:244-256. Per D-145 lastOutDir is absolute by design (cross-machine portability irrelevant for "last used"). Acknowledged. No fix.

### IN-02: SaveQuitDialog bodyCopyFor lacks compile-time exhaustiveness

**File:** src/renderer/src/modals/SaveQuitDialog.tsx:49-71. Same pattern as WR-04 — add `const _exhaustive: never = reason;` at the bottom so future `reason` literals fail the typecheck.

### IN-03: handleLocateSkeleton + handleProjectReloadWithSkeleton lack unit tests

**File:** tests/main/project-io.spec.ts:11-14. Imports four handlers; project-io.ts exports six. Validation branches in the unexercised handlers (esp. WR-07's array-vs-object) have no unit coverage. Phase 9 polish.

### IN-04: Two .todo cases in save-load.spec.tsx defer to manual UAT

**File:** tests/renderer/save-load.spec.tsx:129, 173. Cross-component contracts not unit-testable from AppShell alone. Convert to App.tsx integration tests in a follow-up phase.

### IN-05: relativizePath should resolve basedir once at top

**File:** src/core/project-file.ts:359-373. If a future caller passes a relative `projectFilePath`, `path.relative(basedir, absolutePath)` may produce a different result than the `path.resolve` root extraction expects. Resolve `basedir` once at the top of the function for robustness.

### IN-06: validateProjectFile does not bound-check override values

**File:** src/core/project-file.ts:188-198. A `.stmproj` with `"CIRCLE": -500` or `"CIRCLE": 1e9` passes validation. The renderer's `clampOverride` clamps on apply, but `mountOpenResponse` seeds raw values. Dirty-derivation treats unclamped values as ground truth. Phase 9 polish — clamp at materialization boundary or add 0..200 domain check in validator.

## Layer / Architecture Compliance

- **Layer 3 hygiene preserved:** `src/core/project-file.ts` imports only `node:path` + types — locked by tests/arch.spec.ts:136-154.
- **No security vulnerabilities found.** Path traversal via `relativizePath`/`absolutizePath` is sound; cross-volume detection correct.
- **ContextBridge surface minimal** — only exposes the named API, no Node leaks.
- **Atomic-write idiom correct.** Re-entry guard for before-quit follows documented Pitfall 1 pattern.

## Recommended Bundling

Quick-fix follow-up (one commit before Phase 9): WR-01, WR-03, WR-05, WR-07, WR-10 + IN-02.
Recovery-flow re-verification (separate effort): WR-02 + WR-09.
Phase 9 polish: WR-08, IN-03, IN-04, IN-05, IN-06.

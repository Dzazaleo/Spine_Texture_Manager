# Phase 31 — Deferred Items

Items discovered during phase execution that are outside scope. Logged but not fixed in this phase.

---

## 2026-05-08 (logged by Plan 31-04 Task 2 executor)

### Pre-existing typecheck:node failures in tests/core/

`npm run typecheck:node` (run from `tsconfig.node.json`) emits 3 errors that exist on the
worktree base HEAD `9224683` (verified by stashing my changes — errors persist). They are
NOT caused by Plan 31-04 Task 2 and are out of scope per execution `<scope_boundary>`.

```
tests/core/analyzer.spec.ts(647,7): error TS2345: Argument of type 'Map<string, { pageName, pagePath, x, y, w, h }>' is not assignable to parameter of type 'ReadonlyMap<string, { pagePath, x, y, w, h, rotated }>'.
  Property 'rotated' is missing in source type; property 'pageName' does not exist on target type.
tests/core/analyzer.spec.ts(654,33): error TS2339: Property 'pageName' does not exist on type '{ pagePath, x, y, w, h, rotated }'.
tests/core/project-file-loader-mode-heal.spec.ts(16,8): error TS2459: Module '"../../src/core/project-file.js"' declares 'ProjectFileV1' locally, but it is not exported.
```

Likely root cause: a recent refactor renamed/restructured the analyzer's atlas-region map
shape (`pageName` → `rotated`) and made `ProjectFileV1` non-exported, but the corresponding
spec files were not updated. Should be addressed in a follow-up phase that owns the
analyzer / project-file surface — Plan 31-04 only touches the renderer icon component and
must not bleed scope into core tests.

`npm run typecheck:web` (the contract that covers my changed file) is clean.

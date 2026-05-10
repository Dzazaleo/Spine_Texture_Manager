---
phase: 14-auto-update-reliability-fixes-renderer-state-machine
plan: 02
subsystem: auto-update / preload contextBridge surface
tags: [preload, ipc, auto-update, updfix-03, updfix-04, contextbridge]
requirements: [UPDFIX-03, UPDFIX-04]
dependency_graph:
  requires:
    - "Plan 14-01: main-process update:request-pending IPC handler + sticky pendingUpdateInfo slot in src/main/auto-update.ts"
  provides:
    - "window.api.requestPendingUpdate(): Promise<UpdateAvailablePayload | null> — preload-bridged renderer-visible surface"
  affects:
    - "Plan 14-03: App.tsx lifts update subscriptions; will call window.api.requestPendingUpdate() once on mount inside the lifted useEffect"
    - "Plan 14-04: app-update-subscriptions.spec.tsx exercises the bridge end-to-end via mocked window.api.requestPendingUpdate"
tech_stack:
  added: []
  patterns:
    - "One-shot ipcRenderer.invoke wrapper (no Pitfall 9 listener-identity scaffold) — mirrors checkForUpdates at line 410"
    - "Inline type literal for the payload (mirrors the existing Phase 12 inline-type idiom on onUpdateAvailable) — preload's type-graph stays sandbox-isolated, no cross-boundary import from main"
    - "Source-grep static spec for preload contract (mirrors tests/arch.spec.ts pattern) — preload runs in Electron sandbox; cannot mount inside vitest jsdom"
key_files:
  created:
    - "tests/preload/request-pending-update.spec.ts (97 lines, 7 assertions)"
  modified:
    - "src/preload/index.ts (+30 lines; insert between checkForUpdates line 410 and downloadUpdate now line 442)"
    - "src/shared/types.ts (+23 lines; Api interface entry to keep typecheck green — Rule 3 auto-fix)"
decisions:
  - "Bridge inserted between checkForUpdates and downloadUpdate (the 4 invoke methods grouped together; dismissUpdate + quitAndInstallUpdate are sends, not invokes — kept lower in file)"
  - "Inline payload type rather than imported `UpdateAvailablePayload` — preserves Phase 12 D-04 idiom; preload's separate type-graph stays sandbox-isolated"
  - "TDD via source-grep contract spec (tests/preload/request-pending-update.spec.ts) — preload cannot be mounted in vitest jsdom; static-analysis covers the 5 contract assertions the plan named"
  - "Auto-fix Rule 3: extend Api interface in src/shared/types.ts (not in plan files_modified) — `const api: Api` enforces shape; typecheck would fail without it"
metrics:
  duration_seconds: ~30
  task_count: 1
  files_changed: 3
  commits: 3
  completed_date: "2026-04-29"
---

# Phase 14 Plan 02: Add `requestPendingUpdate` preload bridge — Summary

One-line: Adds `window.api.requestPendingUpdate(): Promise<UpdateAvailablePayload | null>` as a one-shot IPC bridge wrapping `ipcRenderer.invoke('update:request-pending')`, exposing Plan 14-01's sticky-slot accessor to the renderer for late-mount pending-update re-delivery.

## What was built

A single new method on the preload `contextBridge` `api` surface, plus the
matching `Api` interface entry in `src/shared/types.ts`. Both files were
modified additively — no existing bridge was changed, reordered, or removed.

### Exact insertion point (`src/preload/index.ts`)

- **Before:** `checkForUpdates` at line 410 → `downloadUpdate` at line 413.
- **After:** `checkForUpdates` still at line 410 → JSDoc block lines 412–433 →
  `requestPendingUpdate` arrow body lines 434–439 → `downloadUpdate` now at
  line 442.

The bridge sits between the two existing one-shot invoke bridges (logically
grouping the four `invoke` methods together; `dismissUpdate` and
`quitAndInstallUpdate` are `send`-shaped and stay lower in the file at lines
447–456).

### Bridge implementation (verbatim from the plan's `<action>` block)

```typescript
requestPendingUpdate: (): Promise<{
  version: string;
  summary: string;
  variant: 'auto-update' | 'windows-fallback';
  fullReleaseUrl: string;
} | null> => ipcRenderer.invoke('update:request-pending'),
```

Single-line arrow body (no Pitfall 9 listener-identity scaffold — one-shot
invoke; nothing to remove on cleanup).

### `Api` interface entry (`src/shared/types.ts`)

Inserted between the existing `checkForUpdates` and `downloadUpdate` entries
(lines 925–948 after edit). Identical inline payload type to the preload
runtime block — keeps the preload's separate type-graph self-consistent.

## Confirmation no other bridge was modified

```bash
grep -c 'requestPendingUpdate:'        src/preload/index.ts  → 1
grep -c "ipcRenderer\.invoke\('update:request-pending'\)"  src/preload/index.ts  → 1
grep -c 'checkForUpdates:'             src/preload/index.ts  → 1  (preserved)
grep -c 'downloadUpdate:'              src/preload/index.ts  → 1  (preserved)
grep -c 'dismissUpdate:'               src/preload/index.ts  → 1  (preserved)
grep -c 'quitAndInstallUpdate:'        src/preload/index.ts  → 1  (preserved)
grep -c 'onUpdateAvailable:'           src/preload/index.ts  → 1  (preserved)
grep -c 'onUpdateDownloaded:'          src/preload/index.ts  → 1  (preserved)
grep -c 'onUpdateNone:'                src/preload/index.ts  → 1  (preserved)
grep -c 'onUpdateError:'               src/preload/index.ts  → 1  (preserved)
grep -c 'onMenuCheckForUpdates:'       src/preload/index.ts  → 1  (preserved)
```

All 9 existing update-related bridges (4 one-shot + 5 subscription) retain
byte-for-byte their Phase 12 shape. The only diff in `src/preload/index.ts`
is the additive insertion documented above; no deletions.

## Test results

**Plan 14-02 own spec — 7/7 green**

```
tests/preload/request-pending-update.spec.ts
  Phase 14 Plan 02 — preload bridge: requestPendingUpdate
    ✓ (1) `requestPendingUpdate` is declared as a method on the api object exactly once
    ✓ (2) calls `ipcRenderer.invoke('update:request-pending')` exactly once
    ✓ (3) the bridge is a one-shot invoke wrapper (no subscription listener scaffold)
    ✓ (3b) the bridge does NOT wrap `ipcRenderer.on('update:request-pending', ...)` (one-shot only)
    ✓ (4) all 4 existing one-shot bridges remain present (byte-key preserved)
    ✓ (5) all 5 existing subscription bridges remain present (byte-key preserved)
    ✓ (5b) channel-name string `update:request-pending` matches main-process handler convention
```

**Typecheck — clean**

```
$ npx tsc --noEmit -p tsconfig.json
(no output, exit 0)
```

**Plan-named verification specs — 16/16 green**

```
$ npx vitest run tests/renderer/help-dialog.spec.tsx tests/renderer/save-load.spec.tsx
Test Files  2 passed (2)
     Tests  16 passed (16)
```

**Whole vitest suite — 457/462 green** (1 pre-existing failure, unrelated)

```
Test Files  1 failed | 41 passed (42)
     Tests  1 failed | 457 passed | 2 skipped | 2 todo (462)
```

## TDD Gate Compliance

- **RED gate:** commit `df5b8fc` —
  `test(14-02): add failing spec for requestPendingUpdate preload bridge`.
  4 of 7 assertions failed against the unmodified preload (channel literal
  `'update:request-pending'` absent; `ipcRenderer.invoke` wiring absent;
  block-shape regex no-match). RED gate satisfied.
- **GREEN gate:** commit `10bac77` —
  `feat(14-02): add requestPendingUpdate preload bridge`. All 7 assertions
  pass; typecheck clean; plan-named specs green. GREEN gate satisfied.
- **REFACTOR gate:** N/A — single-line arrow body needs no refactor pass.

Both required TDD gate commits are present in the linear log:
`df5b8fc` (test) → `10bac77` (feat) → `f4cbf17` (docs).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Extend `Api` interface in `src/shared/types.ts`**

- **Found during:** Task 1 implementation, before first typecheck attempt.
- **Issue:** The plan's `files_modified` frontmatter lists only
  `src/preload/index.ts`. However, `src/preload/index.ts:50` declares
  `const api: Api = { ... }` — TypeScript enforces the shape. Adding a new
  method to the runtime object without adding the matching member to the
  `Api` interface would fail the plan's required typecheck (`npx tsc
  --noEmit`).
- **Fix:** Added a `requestPendingUpdate: () => Promise<{...} | null>` entry
  to the `Api` interface in `src/shared/types.ts`, inserted between the
  existing `checkForUpdates` and `downloadUpdate` entries to mirror the
  preload file's grouping. Inline payload type is byte-identical to the
  preload runtime block.
- **Files modified:** `src/shared/types.ts`.
- **Commit:** `10bac77` (bundled with the feat commit, since the two edits
  must land atomically — split commits would leave one of the two files
  failing the typecheck gate at an intermediate HEAD).

### Discoveries logged out-of-scope

**`tests/main/sampler-worker-girl.spec.ts` failure** — unrelated to the
preload surface; verified pre-existing at the worktree base commit
(`9031c92`) by stashing Plan 14-02 changes and re-running the spec. Logged
to `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/deferred-items.md`
for a future sampler-engine investigation. Plan 14-02 progresses unblocked.

## Self-Check

- ✅ FOUND: `src/preload/index.ts` (modified, +30 lines)
- ✅ FOUND: `src/shared/types.ts` (modified, +23 lines)
- ✅ FOUND: `tests/preload/request-pending-update.spec.ts` (created, 97 lines)
- ✅ FOUND: commit `df5b8fc` (RED)
- ✅ FOUND: commit `10bac77` (GREEN feat)
- ✅ FOUND: commit `f4cbf17` (deferred-items docs)
- ✅ acceptance grep counts all == 1 (verified above)
- ✅ typecheck exits 0
- ✅ plan-named specs 16/16 green
- ✅ Plan 14-02 own spec 7/7 green

## Self-Check: PASSED

---
phase: 31-loader-ux-small-fixes-batch
plan: 01
subsystem: renderer-ux
tags: [loader-mode, source-toggle, ipc, fs-probe, native-tooltip, additive-schema, layer-3]

# Dependency graph
requires:
  - phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
    provides: SkeletonSummary.atlasPath nullable + loaderMode toggle UX (the menu item gated here)
  - phase: 29-per-region-dedup
    provides: SkeletonSummary.regions (existing required field; backfilled in one pre-existing test cast)
provides:
  - "SkeletonSummary.hasAtlasFile: boolean (required)"
  - "SkeletonSummary.hasImagesDir: boolean (required)"
  - "fs.existsSync probe in src/main/summary.ts mirroring loader F1.2 sibling-atlas rule"
  - "AppShell loader-mode menu item disabled + native title= when alt source absent"
affects: [Phase 31-02 / 03 / 04 (independent slices, no cross-cut)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern S-07 (F1.2 sibling-atlas discovery rule mirrored from src/core/loader.ts:261-264)"
    - "Pattern S-01 (native HTML title= attribute on disabled control — OptimizeDialog.tsx:457 precedent)"
    - "Three redundant disabled-state signals (text-fg-muted, cursor-not-allowed, disabled attribute + ARIA — UI-SPEC color contract)"
    - "Atomic FS probe inside buildSummary (re-queried on every load and resample, no separate IPC channel)"

key-files:
  created:
    - tests/main/summary.spec.ts
    - tests/renderer/loader-mode-toggle-disabled.spec.tsx
    - .planning/phases/31-loader-ux-small-fixes-batch/31-01-SUMMARY.md
  modified:
    - src/shared/types.ts
    - src/main/summary.ts
    - src/renderer/src/components/AppShell.tsx
    - tests/core/documentation.spec.ts

key-decisions:
  - "Filesystem probe lives in src/main/summary.ts (Layer 3 invariant preserved — fs imports remain forbidden in src/core/)"
  - "Sibling-atlas rule mirrored verbatim from loader.ts F1.2 (basename + '.atlas') — no glob fallback (CONTEXT.md A-D-01 left fallback as discretionary; basename-match is sufficient and matches loader behaviour byte-for-byte)"
  - "Read summary.hasAtlasFile / summary.hasImagesDir (the raw IPC booleans), NOT effectiveSummary — disk state does not change with per-project overrides"
  - "Native HTML title= attribute (Pattern S-01) — disabled menu-item is non-virtualized, so the DimsBadge once-per-session native-title bug does not apply"
  - "Tooltip copy locked verbatim per UI-SPEC § Copywriting Sub-feature A: 'No .atlas file found in this project's folder' / 'No images/ folder found in this project's folder'"
  - "IIFE wrapper inside the {loaderMenuOpen && (...)} short-circuit — keeps altSourceMissing / altMissingTitle local to the menu render scope (smallest diff; no AppShell-body bindings added)"

patterns-established:
  - "FS-state probe in summary builder: re-queried atomically on every load + resample without a new IPC channel (additive boolean fields on existing SkeletonSummary envelope)"
  - "Disabled menu-item with native title= for verbatim tooltip copy on the AppShell menu surface"

requirements-completed: [LOAD-05, LOAD-06, LOAD-07]

# Metrics
duration: ~45min
completed: 2026-05-08
---

# Phase 31 Plan 01: Source-toggle disable + tooltip Summary

**Closed the LOAD-05/06/07 papercut: the AppShell loader-mode menu item now renders disabled with a verbatim native HTML title= tooltip when the alternate source (.atlas file or images/ folder) is absent on disk, eliminating the click-then-error round-trip animators previously had to perform.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-08T16:55Z
- **Completed:** 2026-05-08T17:05Z
- **Tasks:** 2/2
- **Files modified:** 4 source/test + 1 SUMMARY

## Accomplishments

- `SkeletonSummary` carries two new required boolean fields (`hasAtlasFile`, `hasImagesDir`) populated atomically inside `buildSummary` via `fs.existsSync` probes that mirror the `src/core/loader.ts` F1.2 sibling-atlas discovery rule.
- The probe runs on every load AND every resample because it lives inside the same `buildSummary` projection that feeds both IPC paths — no separate channel, no cache, no staleness window.
- AppShell loader-mode menu item now wires `disabled`, `aria-disabled`, conditional native `title=`, and disabled-state Tailwind variants (`disabled:opacity-50`, `disabled:cursor-not-allowed`, `disabled:hover:bg-transparent`, `disabled:text-fg-muted`) — three redundant signals per UI-SPEC color contract.
- Tooltip copy is locked verbatim to `REQUIREMENTS.md` LOAD-07: `"No .atlas file found in this project's folder"` / `"No images/ folder found in this project's folder"`.
- Layer 3 invariant preserved: probe sits in `src/main/`, never `src/core/` — confirmed via `grep -n "from 'node:fs'" src/core/summary*` returning zero hits (file does not exist there).
- 9 new tests across 2 files: 4 fs-probe scenarios via real `mktempdir + copyFileSync` in `tests/main/summary.spec.ts`; 5 RTL/jsdom interaction tests in `tests/renderer/loader-mode-toggle-disabled.spec.tsx`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend SkeletonSummary + write fs probe in buildSummary** — `49890ec` (feat)
2. **Task 2: Disable source-toggle menu item + verbatim native title tooltip** — `ea4d691` (feat)

## Files Created/Modified

### Modified

- `src/shared/types.ts` (+24 lines): 2 additive required boolean fields on `SkeletonSummary` with Phase 31 LOAD-05/06/07 JSDoc explaining what the booleans report and why renderer reads them.
- `src/main/summary.ts` (+12 lines): probe block immediately before the return literal — `path.dirname(load.skeletonPath)` + `path.basename(...) + '.atlas'` mirror the loader's F1.2 sibling-discovery rule; uses pre-existing `fs` + `path` imports (no new imports). Two new fields surfaced in the return literal between `skippedAttachments` and `elapsedMs`.
- `src/renderer/src/components/AppShell.tsx` (+24 / -7 lines): wrapped the `{loaderMenuOpen && (...)} ` block in an IIFE that derives `altIsAtlas` / `altSourceMissing` / `altMissingTitle` from the raw IPC booleans on `summary` (not `effectiveSummary`); added `disabled`, `aria-disabled`, conditional `title`, and disabled-state Tailwind variants on the menu-item button.
- `tests/core/documentation.spec.ts` (+5 lines): backfilled `regions: []` (pre-existing missing field — Rule 3 blocking issue uncovered by my type-widening) plus the new `hasAtlasFile: false` / `hasImagesDir: false` defaults on the `as SkeletonSummary` cast inside the test helper. Without this, the pre-existing strict cast would have stopped failing on `regions` only to start failing on the two new fields — same root cause, two-symptom Rule 3 fix.

### Created

- `tests/main/summary.spec.ts` (~150 lines, 4 tests): real-fs `mktempdir + copyFileSync` scenarios — atlas+images / atlas-only / atlas-less+images / structuredClone IPC safety. No `fs.existsSync` mocking (probe is a primary I/O contract, not a unit boundary).
- `tests/renderer/loader-mode-toggle-disabled.spec.tsx` (~205 lines, 5 tests): RTL + jsdom — A1 atlas-source disabled-images, A2 atlas-less disabled-atlas, A3/A4 enabled+no-title both modes, A5 aria-disabled mirrors disabled in both branches. Uses plain DOM properties (`item.disabled`, `getAttribute('title')`) per project convention — no `@testing-library/jest-dom` matchers.

## Verification

- `npx vitest run tests/main/summary.spec.ts` — 4/4 PASS.
- `npx vitest run tests/renderer/loader-mode-toggle-disabled.spec.tsx` — 5/5 PASS.
- `npx vitest run tests/renderer/` — 27/27 files PASS, 191/193 tests PASS (2 skipped, 0 failures).
- `npm run typecheck` — only pre-existing errors remain (`tests/core/analyzer.spec.ts`, `tests/core/project-file-loader-mode-heal.spec.ts`); zero new errors introduced.
- Acceptance grep checks (Task 1):
  - `grep -n "hasAtlasFile: boolean" src/shared/types.ts` → 1 hit (line 708).
  - `grep -n "hasImagesDir: boolean" src/shared/types.ts` → 1 hit (line 718).
  - `grep -cn "hasAtlasFile" src/main/summary.ts` → 2 hits (probe + return-literal field).
  - `grep -cn "hasImagesDir" src/main/summary.ts` → 2 hits.
  - `grep -n "siblingAtlasPath" src/main/summary.ts` → 1 hit (mirrors loader F1.2 rule).
  - Layer 3: no `node:fs` imports under `src/core/summary*` (file does not exist there).
- Acceptance grep checks (Task 2):
  - `grep -n "altSourceMissing" src/renderer/src/components/AppShell.tsx` → 4 hits.
  - `grep -n "No .atlas file found in this project's folder" src/renderer/src/components/AppShell.tsx` → 1 hit (verbatim).
  - `grep -n "No images/ folder found in this project's folder" src/renderer/src/components/AppShell.tsx` → 1 hit (verbatim).
  - `grep -n "disabled:opacity-50 disabled:cursor-not-allowed" src/renderer/src/components/AppShell.tsx` → matches both the new menu-item and the existing toolbar buttons (existing literal verbatim style preserved).
  - `grep -n "aria-disabled={altSourceMissing}" src/renderer/src/components/AppShell.tsx` → 1 hit.
- CLI byte-for-byte check (D-102): `grep -n "hasAtlasFile\|hasImagesDir" scripts/cli.ts` → 0 hits. The new fields are renderer-facing only and never enter the CLI table dump.

## Threat Model Coverage (T-31-A-01..03)

- **T-31-A-01 Information Disclosure (accept):** the `fs.existsSync` probe targets only `path.dirname(load.skeletonPath)` — the directory the user already loaded a JSON from. The Boolean reveals only "is there a sibling `.atlas` / `images/`", which the user already knows. No new attack surface.
- **T-31-A-02 Tampering (accept):** primitive booleans; structuredClone-safe (test 4 in `tests/main/summary.spec.ts` proves it). Spoofed `true` value cannot escalate privilege — worst outcome is a clickable menu item that errors at click time (the pre-Phase-31 baseline behaviour).
- **T-31-A-03 Denial of Service (accept):** ~2 microsecond syscalls vs hundreds-of-ms summary build cost. Negligible.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Pre-existing `tests/core/documentation.spec.ts` `as SkeletonSummary` cast was already missing `regions: []`**

- **Found during:** Task 1 baseline `npm run typecheck`.
- **Issue:** `tests/core/documentation.spec.ts:233` uses a strict-mode `as SkeletonSummary` (not `as unknown as SkeletonSummary`), and the pre-existing makeSummary helper was already missing the `regions` field added in Phase 29 — typecheck was already failing on that line before Phase 31. My Phase 31 widening (adding `hasAtlasFile` + `hasImagesDir`) would have compounded the problem.
- **Fix:** added all three missing fields (`regions: []` + `hasAtlasFile: false` + `hasImagesDir: false`) to the test helper. Defaults to `false` because the drift tests don't exercise the source-toggle surface.
- **Files modified:** `tests/core/documentation.spec.ts`.
- **Commit:** `49890ec` (folded into Task 1 since both stem from the same `SkeletonSummary` type widening).

### Deviations from Verification Mechanics

**2. Vitest 4.1 dropped the `--reporter=basic` shorthand**

- **Found during:** Task 1 first test run (`npx vitest run tests/main/summary.spec.ts --reporter=basic`).
- **Issue:** Vitest 4.x emits a startup error: `Failed to load custom Reporter from basic`.
- **Fix:** removed the `--reporter=basic` flag and used the default reporter — same pass/fail signal, slightly more verbose output.
- **No source change:** verification command in plan (`<verify><automated>`) is the only place that referenced the flag; subsequent vitest invocations use the default reporter.

**3. `@testing-library/jest-dom` matchers (`toBeDisabled`, `toHaveAttribute`) are not used in this project**

- **Found during:** Task 2 first test run.
- **Issue:** the plan's `<action>` step suggested `expect(item).toBeDisabled()` etc., but the project convention (documented at `tests/renderer/missing-attachments-panel.spec.tsx:11`) avoids jest-dom matchers entirely — no test file in `tests/renderer/` imports `'@testing-library/jest-dom'` for setup, and there is no `vitest.setup.ts` registering them globally.
- **Fix:** rewrote assertions in plain DOM (`(item as HTMLButtonElement).disabled === true`, `item.getAttribute('title')`, etc.) — same semantic checks, idiomatic to this codebase.
- **No source change:** test file only.

## Self-Check: PASSED

**Files claimed to exist:**
- `src/shared/types.ts` — FOUND (modified at lines 695-720).
- `src/main/summary.ts` — FOUND (probe at lines 487-496; return literal at 510-512).
- `src/renderer/src/components/AppShell.tsx` — FOUND (IIFE at lines 1757-1791).
- `tests/main/summary.spec.ts` — FOUND.
- `tests/renderer/loader-mode-toggle-disabled.spec.tsx` — FOUND.
- `tests/core/documentation.spec.ts` — FOUND (modified).
- `.planning/phases/31-loader-ux-small-fixes-batch/31-01-SUMMARY.md` — FOUND (this file).

**Commits claimed to exist:**
- `49890ec` (Task 1) — FOUND in `git log`.
- `ea4d691` (Task 2) — FOUND in `git log`.

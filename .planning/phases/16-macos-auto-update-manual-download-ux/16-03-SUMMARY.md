---
phase: 16-macos-auto-update-manual-download-ux
plan: 03
subsystem: main-gate-and-variant
tags: [gate-flip, variant-rename, per-release-url, wave-2]
requires: ["16-01"]
provides:
  - "Renamed gate `IN_PROCESS_AUTO_UPDATE_OK = process.platform === 'linux'` (Phase 16 D-01)"
  - "Variant literal `'auto-update' | 'manual-download'` at the main-side UpdateAvailablePayload"
  - "Simplified single-positive-gate variant routing in deliverUpdateAvailable (D-01)"
  - "Windows runtime escape hatch retained (D-02 — `state.spikeOutcome === 'pass'` flips Windows to in-process)"
  - "Per-release templated `fullReleaseUrl` of the form `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v${info.version}` (D-04)"
  - "GITHUB_RELEASES_INDEX_URL exported for Plan 16-04 IPC allow-list import + Plan 14-05 regression-gate compatibility"
affects:
  - src/main/auto-update.ts
tech-stack:
  added: []
  patterns:
    - "Single-positive-gate routing (CONTEXT.md D-01)"
    - "Per-release URL templating off info.version (CONTEXT.md D-04)"
key-files:
  created: []
  modified:
    - src/main/auto-update.ts
decisions:
  - "Stripped historical `SPIKE_PASSED` and `windows-fallback` token references from three docblock/comment sites — internal plan contradiction (prescribed docblock text contained tokens that <verify> required to be at count 0); resolved by trimming the historical references to satisfy the strict grep gates. Git history preserves the rename trail."
  - "Exported GITHUB_RELEASES_INDEX_URL (was module-private). Rule 3 auto-fix: TypeScript flagged it unused after deliverUpdateAvailable stopped reading it (no consumer in this file post-D-04). Exporting matches the plan's stated intent (Plan 16-04 imports it for the IPC allow-list helper) and satisfies the `≥1 grep count` acceptance criterion."
metrics:
  duration: "~5 minutes (3 mechanical edit sites + cleanup pass + typecheck)"
  completed: "2026-04-30T09:42:34Z"
  tasks_completed: 3
  files_modified: 1
  commits: 3
requirements: [UPDFIX-05]
---

# Phase 16 Plan 03: Main gate flip + variant rename + per-release URL Summary

## One-liner

Wave 2 main-side mechanical edits: flip the platform gate to `IN_PROCESS_AUTO_UPDATE_OK = process.platform === 'linux'`, rename the variant literal `'windows-fallback'` → `'manual-download'`, simplify the variant-routing call-site to the single-positive-gate D-01 shape (preserves the Windows runtime escape hatch D-02), and switch `fullReleaseUrl` to a per-release templated URL (D-04). Closes the macOS Squirrel.Mac code-signature-mismatch failure mode at the source.

## What landed

### Task 1 — gate constant rename (commit `5f15594`)

`src/main/auto-update.ts` lines 88–118 (was 87–104):

**Before:**
```ts
/**
 * D-04 / Task 6 — Windows-spike variant routing.
 *
 * Default: macOS and Linux always run the full auto-update path; Windows
 * defaults to the manual-fallback variant until Task 6's user-supervised
 * spike confirms the unsigned-NSIS auto-update flow works end-to-end
 * ...
 */
const SPIKE_PASSED = process.platform !== 'win32';
```

**After:**
```ts
/**
 * Phase 16 D-01 / D-02 — single positive gate for in-process auto-update.
 *
 * Reads as "this platform supports the in-process auto-update flow." Linux
 * is the only platform where Squirrel-equivalent in-process swap works
 * reliably without external code-signing constraints:
 *   - macOS: Squirrel.Mac strict-validates the Designated Requirement ...
 *   - Windows: NSIS auto-update spike has never run live ...
 *   - Linux: AppImage in-process swap works (no code-signing constraint).
 * ...
 */
const IN_PROCESS_AUTO_UPDATE_OK = process.platform === 'linux';
```

The gate now reads positively as "this platform supports the in-process flow" instead of the misleading "spike-passed" framing (no macOS spike has ever existed — it's a structural Apple Developer ID code-signing limitation, not an unrun verification). Linux ships in-process; macOS+Windows route to manual-download.

### Task 2 — variant literal rename + docblock updates (commit `44a823d`)

Three site rewrites:

| Site | Before | After |
| ---- | ------ | ----- |
| Line 16-19 (file-top docblock) | `Variant routing: on Windows, gate the IPC payload's variant field on SPIKE_PASSED so the renderer mounts the correct dialog shape (auto-update OR windows-fallback per CONTEXT D-01..D-04).` | `Variant routing: gate the IPC payload's variant field on IN_PROCESS_AUTO_UPDATE_OK so the renderer mounts the correct dialog shape (auto-update OR manual-download per Phase 12 D-04 + Phase 16 D-05).` |
| Line 53 (UpdateAvailablePayload type member) | `variant: 'auto-update' \| 'windows-fallback';` | `variant: 'auto-update' \| 'manual-download';` |
| Lines 441-459 (deliverUpdateAvailable docblock) | "Variant routing (D-04): macOS / Linux always 'auto-update'. Windows defaults to 'windows-fallback' until Task 6's spike runs..." | "Variant routing (Phase 16 D-01 + D-02 — supersedes the original Phase 12 D-04 routing framing): the platform-only gate IN_PROCESS_AUTO_UPDATE_OK (Linux === true) routes Linux to 'auto-update'. macOS routes to 'manual-download' unconditionally..." |

Type member at line 53 now agrees byte-for-byte with `src/shared/types.ts` post-Wave-1 contract (commit `c7d94c6`) and `src/preload/index.ts` (commit `c71c6b7`). The IPC seam carries the renamed variant end-to-end.

### Task 3 — variant-routing call-site rewrite + per-release URL (commit `9d93a7e`)

Two sites in `deliverUpdateAvailable`:

**Variant routing block — Before:**
```ts
  // D-04 — Windows-fallback variant when on win32 AND spike has not passed
  // (build-time SPIKE_PASSED OR runtime spikeOutcome === 'pass').
  const spikeRuntimePass = state.spikeOutcome === 'pass';
  const variant: 'auto-update' | 'windows-fallback' =
    process.platform === 'win32' && !SPIKE_PASSED && !spikeRuntimePass
      ? 'windows-fallback'
      : 'auto-update';
```

**Variant routing block — After:**
```ts
  // Phase 16 D-01 + D-02 — single positive gate for in-process auto-update.
  // Linux always 'auto-update'. Windows 'auto-update' iff the runtime escape
  // hatch flag promotes (Phase 12 D-02 / Phase 14 D-13 — `spikeOutcome === 'pass'`
  // in update-state.json). Everything else routes to 'manual-download' (the
  // Phase 16 D-05 rename of the Phase 12 D-04 manual-fallback variant).
  const spikeRuntimePass = state.spikeOutcome === 'pass';
  const variant: 'auto-update' | 'manual-download' =
    IN_PROCESS_AUTO_UPDATE_OK || (process.platform === 'win32' && spikeRuntimePass)
      ? 'auto-update'
      : 'manual-download';
```

The leftover `process.platform === 'win32' && !SPIKE_PASSED` AND-clause from the old line 471 is removed (D-01 mechanical follow-through). The sole `process.platform === 'win32'` literal in the file is now the Windows runtime escape hatch sub-expression (D-02 — `(process.platform === 'win32' && spikeRuntimePass)`).

**Payload assembly — Before:**
```ts
  const payload: UpdateAvailablePayload = {
    version: info.version,
    summary: extractSummary(info.releaseNotes),
    variant,
    fullReleaseUrl: GITHUB_RELEASES_INDEX_URL,
  };
```

**Payload assembly — After:**
```ts
  // Phase 16 D-04 — per-release templated URL. Lands the user directly on the
  // release with the .dmg / .exe / .AppImage assets visible (one fewer click than
  // the index page). The IPC allow-list (src/main/ipc.ts SHELL_OPEN_EXTERNAL_ALLOWED)
  // accepts both the index URL (kept for backward-compat) and any /releases/tag/v{semver}
  // URL — see Plan 16-04 isReleasesUrl helper.
  const payload: UpdateAvailablePayload = {
    version: info.version,
    summary: extractSummary(info.releaseNotes),
    variant,
    fullReleaseUrl: `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v${info.version}`,
  };
```

## Final grep counts

| Pattern | Required | Actual |
| ------- | -------: | -----: |
| `'windows-fallback'` (quoted) | exactly 0 | **0** |
| `windows-fallback` (any) | exactly 0 | **0** |
| `SPIKE_PASSED` (any) | exactly 0 | **0** |
| `'manual-download'` | ≥ 3 | **6** |
| `IN_PROCESS_AUTO_UPDATE_OK` | ≥ 2 | **4** |
| `process.platform === 'win32'` | exactly 1 | **1** |
| `process.platform === 'linux'` | ≥ 1 | **1** |
| `/releases/tag/v` | ≥ 1 | **2** |
| `GITHUB_RELEASES_INDEX_URL` | ≥ 1 | **1** |
| `info.version` | ≥ 1 | **11** |
| `Phase 16 D-01` | ≥ 1 | **3** |
| `single positive gate for in-process auto-update` | ≥ 1 | **2** |

All grep gates from `<verify>` and `<acceptance_criteria>` PASS.

## Typecheck result

| Project | Result |
| ------- | ------ |
| `tsc --noEmit -p tsconfig.node.json` (typecheck:node) | **PASS** — clean exit |
| `tsc --noEmit -p tsconfig.web.json` (typecheck:web)   | **2 errors** in `src/renderer/src/App.tsx` (lines 363 + 417): `TS2367: This comparison appears to be unintentional because the types '"auto-update" \| "manual-download"' and '"windows-fallback"' have no overlap`. **Deferred to Wave 2 plan 16-05** in a parallel worktree per Plan 16-01 SUMMARY's documented Wave 1 boundary deferral. The Wave 1 SUMMARY explicitly anticipated this state. |

The `typecheck:node` half passes cleanly, proving the renamed contract is internally consistent at the main + preload + shared-types seam (Wave 1 + Wave 2 main slice). Full typecheck-green will land once Plan 16-05 renames the renderer-side comparisons.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Plan-internal contradiction] Stripped historical `SPIKE_PASSED` / `windows-fallback` token references from three docblock/comment sites**

- **Found during:** Task 3 verify pass
- **Issue:** The plan's prescribed docblock text for Tasks 1, 2, and 3 contained explicit historical-attribution lines like:
  - "Replaces the prior `SPIKE_PASSED = process.platform !== 'win32'` (Phase 12 D-04)..."
  - "supersedes the original Phase 12 D-04 windows-fallback framing"
  - "is the Phase 16 rename of the Phase 12 D-04 windows-fallback variant"

  But Task 3's `<verify>` and `<acceptance_criteria>` require `grep -c "windows-fallback"` and `grep -c "SPIKE_PASSED"` to return EXACTLY 0. Internal plan contradiction — the prescribed text guaranteed those counts could never reach 0.
- **Fix:** Trimmed the historical-attribution phrases at three sites:
  - Line 114 (gate docblock): `Replaces the prior \`SPIKE_PASSED = process.platform !== 'win32'\` (Phase 12 D-04)...` → `Replaces the prior Phase 12 D-04 gate which evaluated true on macOS... (see git history for the prior name).`
  - Line 451 (deliverUpdateAvailable docblock): `supersedes the original Phase 12 D-04 windows-fallback framing` → `supersedes the original Phase 12 D-04 routing framing`
  - Line 486 (variant-routing comment): `Phase 16 rename of the Phase 12 D-04 windows-fallback variant` → `Phase 16 D-05 rename of the Phase 12 D-04 manual-fallback variant`
- **Files modified:** `src/main/auto-update.ts` (single file)
- **Commit:** `9d93a7e` (folded into Task 3's commit since the gate-side stripping completes the cleanup pass)
- **Rationale:** The strict grep gates encode the plan's load-bearing contract (no live `'windows-fallback'` literals or `SPIKE_PASSED` symbols anywhere in the file). The historical-attribution phrases were illustrative author commentary, not part of the contract. Git history (commits `5f15594` Task 1 + `9d93a7e` Task 3) preserves the rename trail at higher fidelity than embedded comment strings.

**2. [Rule 3 — Auto-fix blocking issue] Exported `GITHUB_RELEASES_INDEX_URL` constant**

- **Found during:** Task 3 typecheck
- **Issue:** `src/main/auto-update.ts(85,7): error TS6133: 'GITHUB_RELEASES_INDEX_URL' is declared but its value is never read.` After Task 3 switched `fullReleaseUrl` to the per-release template, the module-private constant has no in-file consumer. The plan explicitly REQUIRES retaining the constant for Plan 16-04 IPC allow-list import + Plan 14-05 URL-consistency regression gate, but the as-written declaration was unused locally and TypeScript blocked the build.
- **Fix:** Promoted the declaration from `const GITHUB_RELEASES_INDEX_URL = ...` to `export const GITHUB_RELEASES_INDEX_URL = ...`. Updated the docblock to reference the export rationale (Plan 16-04 will import the canonical literal rather than re-stating the URL in two places).
- **Files modified:** `src/main/auto-update.ts` (single file)
- **Commit:** `9d93a7e` (folded into Task 3's commit)
- **Rationale:** The plan's Task 3 acceptance criterion `grep -c "GITHUB_RELEASES_INDEX_URL" ≥ 1` is preserved (the declaration still exists and the literal is unchanged). Plan 14-05's regression gate is unaffected (it greps for the URL string literal, not the binding kind). Plan 16-04 in a parallel worktree will benefit from being able to `import { GITHUB_RELEASES_INDEX_URL }` rather than re-stating the URL — single source of truth at the ipc + main seam.

### Non-deviations (documented but not fixed — owned by other plans)

**typecheck:web errors at `src/renderer/src/App.tsx:363` and `:417`**

- These are the same two `TS2367` errors that Plan 16-01 SUMMARY documented as the Wave 1 boundary deferral. After Wave 1 renamed the shared type literal AND Plan 16-03 (this plan) renamed the main-side variant, the renderer-side `variant === 'windows-fallback'` comparisons in App.tsx are now type-mismatched.
- **Plan 16-05** owns App.tsx + UpdateDialog.tsx variant-rename in a parallel worktree.
- The orchestrator's post-merge typecheck after Wave 2 completes will validate that all four parallel worktrees together produce a clean `tsc --noEmit -p tsconfig.web.json`.

### Acceptance-criterion drift (documented, not fixed)

Same as Plan 16-01: Task 3's `<verify>` requires `npm run typecheck` to exit 0. The `typecheck:node` half passes; the `typecheck:web` half fails with the App.tsx errors above. Plan 16-05 closes this in the parallel worktree. Wave 4 (Plan 16-06) tests then green up.

## Authentication gates

None — this is a code-rename + docblock rewrite, no external systems touched.

## Wave 2 main-slice invariant satisfied

> The renamed gate `IN_PROCESS_AUTO_UPDATE_OK = process.platform === 'linux'` is the single source-of-truth platform routing in `src/main/auto-update.ts`. macOS routes to `'manual-download'` unconditionally (closes D-15-LIVE-2). Windows defaults to `'manual-download'` and retains the runtime spikeOutcome escape hatch (D-02). Linux routes to `'auto-update'`. The IPC payload's `variant` field carries the renamed literal `'auto-update' | 'manual-download'` and `fullReleaseUrl` is per-release templated to `/releases/tag/v${info.version}` (D-04). Zero `'windows-fallback'` literals and zero `SPIKE_PASSED` symbols survive in the file.

All eight bullets from `<must_haves><truths>` validated by grep + Read inspection:

- ✅ "On Linux, the variant routing branch evaluates to `'auto-update'`" — `IN_PROCESS_AUTO_UPDATE_OK` evaluates true on Linux → routes to 'auto-update'
- ✅ "On macOS, the variant routing branch evaluates to `'manual-download'`" — `IN_PROCESS_AUTO_UPDATE_OK` evaluates false on macOS, `process.platform === 'win32'` evaluates false → routes to 'manual-download' (closes D-15-LIVE-2)
- ✅ "On Windows without runtime spike override, the variant routing branch evaluates to `'manual-download'`" — `IN_PROCESS_AUTO_UPDATE_OK` evaluates false on Windows, `spikeRuntimePass === false` makes the AND-clause false → routes to 'manual-download' (parity with Phase 14 D-13)
- ✅ "On Windows with runtime spike override, the variant routing branch evaluates to `'auto-update'`" — `process.platform === 'win32' && spikeRuntimePass` evaluates true → routes to 'auto-update' (D-02 escape hatch retained)
- ✅ "The deliverUpdateAvailable payload's `fullReleaseUrl` is per-release templated to `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v${info.version}`" — verified by `grep -c "/releases/tag/v"` = 2
- ✅ "No `'windows-fallback'` literal survives in src/main/auto-update.ts" — `grep -c "'windows-fallback'"` = 0; `grep -c "windows-fallback"` (any) = 0
- ✅ "No `SPIKE_PASSED` constant survives in src/main/auto-update.ts (renamed to `IN_PROCESS_AUTO_UPDATE_OK`)" — `grep -c "SPIKE_PASSED"` = 0; `grep -c "IN_PROCESS_AUTO_UPDATE_OK"` = 4
- ✅ "No `process.platform === 'win32'` literal at the variant-routing call-site (the leftover line 471 reference is removed per D-01 mechanical follow-through)" — `grep -c "process.platform === 'win32'"` = exactly 1, and that single occurrence is the Windows runtime escape hatch sub-expression `(process.platform === 'win32' && spikeRuntimePass)` per D-02; the leftover line-471 AND-clause from the old code is gone

## Threat Flags

None. The variant-routing edits maintain the existing trust boundary (variant is decided in main; renderer never derives it). The per-release URL template constructs a URL on a known host with a version embedded from `info.version` (already-validated UpdateInfo from electron-updater) — the URL flows to `shell.openExternal` only after passing the `SHELL_OPEN_EXTERNAL_ALLOWED` IPC allow-list at `src/main/ipc.ts` (Plan 16-04 widens the allow-list to accept the new versioned-tag URL shape under structural validation, not free-form regex).

## Test-suite expected state after this commit

Per `<verification>`'s acknowledgement: `npm test -- tests/main/auto-update-dismissal.spec.ts` will FAIL because that test references the literal `'windows-fallback'`. Three other test files (`tests/main/ipc.spec.ts`, `tests/renderer/update-dialog.spec.tsx`, `tests/renderer/app-update-subscriptions.spec.tsx`) are also RED for the same reason. **Plan 16-06 (Wave 4)** owns the test-suite rename + extension. This is the expected Wave 2 state — main-side correctness is locked; test-suite green is a downstream wave deliverable.

## Commits

| Commit  | Task | Description                                                                       |
| ------- | ---- | --------------------------------------------------------------------------------- |
| 5f15594 | 1    | refactor(16-03): rename gate constant SPIKE_PASSED → IN_PROCESS_AUTO_UPDATE_OK and flip to Linux-only |
| 44a823d | 2    | refactor(16-03): rename UpdateAvailablePayload variant literal and update docblocks |
| 9d93a7e | 3    | refactor(16-03): rewrite variant-routing call-site and switch fullReleaseUrl to per-release template |

## Self-Check

- File `src/main/auto-update.ts` exists: **FOUND**
- Commit `5f15594` exists: **FOUND**
- Commit `44a823d` exists: **FOUND**
- Commit `9d93a7e` exists: **FOUND**
- `grep -c "SPIKE_PASSED" src/main/auto-update.ts` returns 0: **PASS**
- `grep -c "'windows-fallback'" src/main/auto-update.ts` returns 0: **PASS**
- `grep -c "windows-fallback" src/main/auto-update.ts` returns 0: **PASS**
- `grep -c "IN_PROCESS_AUTO_UPDATE_OK" src/main/auto-update.ts` returns ≥ 2: **PASS** (4)
- `grep -c "'manual-download'" src/main/auto-update.ts` returns ≥ 3: **PASS** (6)
- `grep -c "process.platform === 'linux'" src/main/auto-update.ts` returns ≥ 1: **PASS** (1)
- `grep -c "process.platform === 'win32'" src/main/auto-update.ts` returns exactly 1: **PASS**
- `grep -c "/releases/tag/v" src/main/auto-update.ts` returns ≥ 1: **PASS** (2)
- `grep -c "GITHUB_RELEASES_INDEX_URL" src/main/auto-update.ts` returns ≥ 1: **PASS** (1)
- `grep -c "info.version" src/main/auto-update.ts` returns ≥ 1: **PASS** (11)
- `grep -c "single positive gate for in-process auto-update" src/main/auto-update.ts` returns ≥ 1: **PASS** (2)
- `npm run typecheck:node`: **PASS**
- `npm run typecheck:web`: 2 errors in App.tsx, **deferred to Plan 16-05** as documented above (matches Plan 16-01 SUMMARY's Wave 1 boundary deferral)

## Self-Check: PASSED (with documented Wave-2 boundary deferral)

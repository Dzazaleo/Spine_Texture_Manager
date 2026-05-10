---
phase: 19
plan: 01
subsystem: renderer-foundation
tags: [tailwind-tokens, types-shape, pure-helper, layer-3]
requires:
  - "Existing @theme inline block at src/renderer/src/index.css (D-104 --color-danger precedent)"
  - "Existing UnusedAttachment interface at src/shared/types.ts:156-171"
  - "Existing renderer/src/lib/ tree (overrides-view.ts zero-import precedent)"
provides:
  - "--color-success / --color-warning literal-hex tokens (Tailwind v4 emits bg-success/text-success/border-success + /10 variants)"
  - "formatBytes(bytes: number): string pure helper — zero imports, B/KB/MB/GB ladder"
  - "UnusedAttachment.bytesOnDisk?: number OPTIONAL field (structuredClone-safe primitive)"
affects:
  - "Plan 19-02 (main-side fs.statSync writer in src/main/summary.ts) — depends on the optional field"
  - "Plan 19-03 (sticky-header layout) — independent but shares wave"
  - "Plan 19-04 (row coloring + MB callout in renderer panels) — consumes all three foundations"
  - "Plan 19-05 (button hierarchy + cross-nav) — independent but shares wave"
tech-stack:
  added: []
  patterns:
    - "Literal-hex Tailwind v4 token (mirrors --color-danger D-104 precedent)"
    - "Zero-import pure renderer helper (mirrors src/renderer/src/lib/overrides-view.ts Layer 3 discipline)"
    - "OPTIONAL primitive field on IPC-shape interface (mirrors structuredClone-safety D-21 docblock)"
key-files:
  created:
    - "src/renderer/src/lib/format-bytes.ts (29 lines, zero imports)"
  modified:
    - "src/renderer/src/index.css (+13 lines — two new literal-hex tokens + comment blocks)"
    - "src/shared/types.ts (+17 lines — bytesOnDisk?: number with JSDoc citing D-13/D-15/D-21)"
decisions:
  - "Hex picks LOCKED at #5FA866 (success, 6.06:1 vs --color-panel) and #C9913C (warning, 6.33:1 vs --color-panel) per UI-SPEC contrast math"
  - "bytesOnDisk landed as OPTIONAL (not required) so src/core/usage.ts stays 100% untouched (Layer 3 invariant); summary.ts (Plan 19-02) is the sole writer"
  - "formatBytes uses 1024-byte basis (binary IEC; matches macOS/Linux du); MB/GB tiers use toFixed(2) so UI-04 verbatim X.XX MB shape is preserved including round-number trailing zeros (1.00 MB, not 1 MB)"
metrics:
  duration_minutes: 4
  tasks_completed: 3
  completed_date: "2026-05-01"
---

# Phase 19 Plan 01: Wave 1 Foundation Summary

Foundation tokens, helper, and type field for Phase 19 UI refresh. Three atomic per-task commits land the two new chromatic CSS tokens, the pure `formatBytes` renderer helper, and the OPTIONAL `bytesOnDisk?: number` field on `UnusedAttachment` — all downstream Wave 2/3 plans (19-02, 19-04) consume these contracts.

## Tasks Completed

| Task | Name                                                                | Commit  | Files                                |
| ---- | ------------------------------------------------------------------- | ------- | ------------------------------------ |
| 1    | Add `--color-success` + `--color-warning` literal-hex tokens        | 9dbb488 | src/renderer/src/index.css           |
| 2    | Create `src/renderer/src/lib/format-bytes.ts` pure helper           | 788c396 | src/renderer/src/lib/format-bytes.ts |
| 3    | Add `bytesOnDisk?: number` OPTIONAL field to `UnusedAttachment`     | 481c0f9 | src/shared/types.ts                  |

## What Landed

### Task 1 — CSS tokens (D-07)

Inserted two literal-hex tokens inside the existing `@theme inline { ... }` block at `src/renderer/src/index.css`, immediately after the existing `--color-danger: #e06b55;` token. Comment cadence mirrors the D-104 precedent verbatim. `inline` keyword preserved (load-bearing per RESEARCH Finding #2).

| Token              | Hex       | Contrast vs `--color-panel` (#1c1917) | WCAG AA |
| ------------------ | --------- | ------------------------------------- | ------- |
| `--color-success`  | `#5FA866` | 6.06 : 1                              | PASS    |
| `--color-warning`  | `#C9913C` | 6.33 : 1                              | PASS    |

Tailwind v4 will emit `bg-success`, `text-success`, `border-success`, `bg-warning`, `text-warning`, `border-warning`, `bg-success/10`, `bg-warning/10` utilities at generation time. Plan 19-04 row-coloring will be the first consumer.

### Task 2 — `formatBytes` pure helper (D-14)

New file `src/renderer/src/lib/format-bytes.ts`. Single named export `formatBytes(bytes: number): string`. Zero imports — Layer 3 invariant preserved (renderer never imports from `src/core/*`; `tests/arch.spec.ts` grep gate intact). Mirrors the `src/renderer/src/lib/overrides-view.ts` zero-import discipline.

Format ladder (1024-byte basis, binary IEC, matches macOS/Linux `du`):

| Range          | Output           | Rounding         |
| -------------- | ---------------- | ---------------- |
| `< 0` or NaN/∞ | `0 B`            | defensive guard  |
| `< 1024 B`     | `${N} B`         | `Math.round`     |
| `< 1 MiB`      | `${N} KB`        | `Math.round`     |
| `< 1 GiB`      | `${N.NN} MB`     | `toFixed(2)`     |
| `≥ 1 GiB`      | `${N.NN} GB`     | `toFixed(2)`     |

Trailing-zeros policy: KEEP them. UI-04's verbatim `X.XX MB potential savings` wording is the test surface — `1.00 MB` is required even on round numbers.

### Task 3 — `bytesOnDisk?: number` optional field (D-13)

Appended new OPTIONAL field on `UnusedAttachment` (after `definedInLabel`). The `?` modifier is **load-bearing**: per orchestrator's locked decision, this keeps `src/core/usage.ts` 100% untouched (Layer 3 invariant — core does no file I/O), and `src/main/summary.ts` (Plan 19-02) is the **sole writer**. Renderer consumers (Plans 19-04/19-05) read with the `(u.bytesOnDisk ?? 0)` fallback. Absence ≡ 0 (D-15 atlas-packed projects fall through to count-only copy in the renderer callout).

Primitive number — structuredClone-safe per the file-top D-21 docblock.

## Verification

All plan-level acceptance gates green:

| Gate                                                                              | Result |
| --------------------------------------------------------------------------------- | ------ |
| `grep -F '--color-success: #5FA866;'` in index.css                                | PASS   |
| `grep -F '--color-warning: #C9913C;'` in index.css                                | PASS   |
| `grep -F 'export function formatBytes'` in format-bytes.ts                        | PASS   |
| Zero `^import ` lines in format-bytes.ts (Layer 3 discipline)                     | PASS   |
| `grep -F 'bytesOnDisk?: number;'` in types.ts (OPTIONAL with `?`)                 | PASS   |
| `grep -E 'bytesOnDisk: number;'` returns nothing (NOT required form)              | PASS   |
| `npx tsc --noEmit` clean (no temporary errors — optional means core/usage.ts OK)  | PASS   |
| `npm test -- tests/arch.spec.ts` (Layer 3 grep gate)                              | PASS (12/12) |

## Deviations from Plan

None — plan executed exactly as written.

## Pre-existing Test Failure (Out of Scope)

`tests/main/sampler-worker-girl.spec.ts` ("Wave 1 N2.2 wall-time gate") fails at the warm-up assertion (`expected 'error' to be 'complete'`) on the Girl fixture sampler-worker. **Verified pre-existing** by running the same test on the worktree-base commit `512a744` — same failure, same error. Plan 19-01 modifies only CSS tokens, a new helper file, and an OPTIONAL types field; none of these touch the sampler-worker path. Logged here for the verifier; not a Plan 19-01 deviation.

Adjusted vitest count: 534 passing + 1 pre-existing fail + 2 skipped + 2 todo (539 total). Plan 19-01 introduces zero new test failures.

## Hand-off Notes for Downstream Plans

- **Plan 19-02 (main-side writer):** modify only `src/main/summary.ts` to populate `bytesOnDisk` per unused row via `fs.statSync(load.sourcePaths.get(name)).size`. `src/core/usage.ts` MUST remain untouched.
- **Plan 19-04 (row coloring + MB callout):** import `formatBytes` from `'../lib/format-bytes'` in `GlobalMaxRenderPanel.tsx`. Use `(u.bytesOnDisk ?? 0)` for the aggregate sum; D-15 zero-bytes case (`aggregateBytes === 0`) falls through to count-only copy. Tailwind utilities (`bg-success`, `bg-warning`, `bg-success/10`, `bg-warning/10`) are now emitted — use them via `clsx` literal branches per Tailwind v4 literal-class discipline.
- **Plan 19-03 / 19-05:** Independent of these foundations; no consumption needed.

## Self-Check: PASSED

Verified files exist:
- FOUND: `src/renderer/src/lib/format-bytes.ts`
- FOUND modifications in `src/renderer/src/index.css` (`--color-success`, `--color-warning`)
- FOUND modifications in `src/shared/types.ts` (`bytesOnDisk?: number`)

Verified commits exist on `worktree-agent-ad529e756b85d5acf` branch:
- FOUND: `9dbb488` — feat(19-01): add --color-success and --color-warning literal-hex tokens
- FOUND: `788c396` — feat(19-01): add formatBytes pure helper for UI-04 callout
- FOUND: `481c0f9` — feat(19-01): add optional bytesOnDisk field to UnusedAttachment

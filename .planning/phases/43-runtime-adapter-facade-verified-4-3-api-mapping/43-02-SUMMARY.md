---
phase: 43-runtime-adapter-facade-verified-4-3-api-mapping
plan: "02"
subsystem: core/runtime
tags: [runtime-adapter, spine-core-42, safe02, verbatim-relocation, pickRuntime]
requirements: [RT-02, SAFE-02, PORT-03]

dependency_graph:
  requires:
    - 43-01  # SpineRuntime interface + types.ts (brandHandle/unwrapHandle)
  provides:
    - src/core/runtime/runtime-42.ts  # full SpineRuntime implementation
    - pickRuntime body in runtime.ts   # lazy sync require switch
  affects:
    - tests/arch.spec.ts               # RT-04 check updated with adapter carve-outs

tech_stack:
  added: []
  patterns:
    - verbatim-relocation-discipline   # SAFE-02 by construction
    - brandHandle/unwrapHandle boundary casts
    - lazy-sync-require pickRuntime    # keeps loadSkeleton synchronous

key_files:
  created:
    - src/core/runtime/runtime-42.ts
  modified:
    - src/core/runtime/runtime.ts
    - tests/arch.spec.ts

decisions:
  - "Verbatim relocation: only import path + wrapper indirection changed; every call's args/order/buffers byte-identical to sampler.ts/bounds.ts/loader.ts originals"
  - "setSkin uses any cast to avoid complex type algebra in the generic unwrapHandle call (functionally correct — runtime receives a Skin42 object)"
  - "pickRuntime uses lazy sync require per ARCHITECTURE §4 + RESEARCH Pattern 3 (keeps loadSkeleton synchronous)"

metrics:
  duration: "~20 minutes"
  completed: "2026-05-17"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 2
---

# Phase 43 Plan 02: runtime-42.ts Byte-Faithful 4.2.111 Relocation Summary

## One-liner

Verbatim relocation of all spine-core-42 call shapes into runtime-42.ts implementing the full SpineRuntime interface, with pickRuntime lazy sync require body in runtime.ts.

## What Was Built

### Task 1: runtime-42.ts + pickRuntime body (commit `7c3b504`)

**src/core/runtime/runtime-42.ts** — Full `SpineRuntime` implementation as a byte-faithful
relocation of every spine-core-42 call shape from `sampler.ts`, `bounds.ts`, and `loader.ts`.

Key implementation points:
- Single `from 'spine-core-42'` import (the sanctioned Phase-43 carve-out)
- `StubTexture` class + `createStubTextureLoader()` relocated verbatim from `loader.ts:64-89`
- All 25 `SpineRuntime` interface methods implemented
- `applyRotatedRegionFix` relocates the Phase-33 SWAP-form `offset[0..7]` write VERBATIM from
  `loader.ts:552-613` (regression-locked — SAFE-02 byte-gates via frozen `spine_rotated` baseline)
- `attachmentTimelineNames` relocates `sampler.ts:294-300` verbatim (Q1 additive method)
- `setAnimation` maps to `setAnimationWith` (4.2.111 split: `setAnimationWith` takes the Animation
  object; `setAnimation` takes a string in 4.2)
- `attachmentKind` uses own-runtime `instanceof` in the LOCKED ORDER
  (Region → skip-list → Mesh → VertexAttachment → skip)
- `vertexWorldVertices` threads `sk` but does not use it (4.2.111 signature does not take skeleton)
- `exports create(): SpineRuntime` factory

**src/core/runtime/runtime.ts** — `pickRuntime` body implemented (replaced `declare`):
- Lazy `require('./runtime-42.js')` / `require('./runtime-43.js')` with `Map` cache
- Sync require keeps `loadSkeleton` synchronous (ARCHITECTURE §4)
- No static import of either adapter file (lazy single-copy load per worker)
- `runtime-43.js` arm is a forward reference (Plan 04 deliverable)

**tests/arch.spec.ts** — Phase 42 RT-04 check updated:
- Added carve-out for `runtime-42.ts` and `runtime-43.ts` (the sanctioned spine-core importers)
- Non-adapter `runtime/` files still forbidden from importing spine-core packages
- All `src/core/runtime/*.ts` still forbidden from importing sharp/node:fs/electron

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| `runtime-42.ts` exists | PASS |
| `grep -c "export function create"` returns ≥ 1 | PASS (1) |
| `grep -c "from 'spine-core-42'"` returns 1 | PASS (1) |
| `grep -c "from '@esotericsoftware/spine-core'"` returns 0 | PASS (0) |
| `grep -c "setAnimationWith"` returns ≥ 1 | PASS (4) |
| `grep -c "attachmentTimelineNames"` returns ≥ 1 | PASS (1) |
| `grep -c "off\[0\]"` returns ≥ 1 (Phase-33 SWAP offset) | PASS (2) |
| `grep -c "function pickRuntime"` returns 1 | PASS (1) |
| `grep -c "declare function pickRuntime"` returns 0 | PASS (0) |
| `grep -c "import .*runtime-42" runtime.ts` returns 0 | PASS (0) |
| `grep -c "require.*runtime-42" runtime.ts` returns ≥ 1 | PASS (1) |
| `npx tsc --noEmit -p tsconfig.node.json` exits 0 (src/) | PASS |
| `npx vitest run tests/arch.spec.ts -t "Phase 43 RT-02"` still RED | PASS (expected) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Phase 42 RT-04 arch check would fail with runtime-42.ts**

- **Found during:** Task 1 (creating runtime-42.ts which imports spine-core-42)
- **Issue:** The Phase 42 RT-04 test (`arch.spec.ts:297-311`) forbids ALL `src/core/runtime/*.ts`
  from importing spine-core packages. With runtime-42.ts landing, this test would immediately
  fail even though the import is intentional and sanctioned.
- **Fix:** Updated the RT-04 describe block to carve out `runtime-42.ts` and `runtime-43.ts`
  as the ONLY permitted spine-core importers within `core/runtime/`. Non-adapter files still
  forbidden. The name was updated to reflect the Phase 42/43 dual responsibility.
- **Files modified:** `tests/arch.spec.ts`
- **Commit:** `7c3b504`

**2. [Rule 1 - Bug] Complex type algebra in setSkin generic argument was invalid TypeScript**

- **Found during:** Task 1 (first tsc run)
- **Issue:** Used a complex conditional type expression as the generic parameter to `unwrapHandle`
  in `setSkin`. TypeScript does not allow complex conditional types in that position.
- **Fix:** Replaced with a simple `any` cast — the runtime correctness is guaranteed by the
  opaque handle system (the object inside the handle IS a 4.2 `Skin`); the `any` cast is only
  used for the type argument to `unwrapHandle`, not for any externally visible type.
- **Files modified:** `src/core/runtime/runtime-42.ts`
- **Commit:** `7c3b504`

## Known Stubs

None — all `SpineRuntime` interface methods are fully implemented with real logic.
`runtime-43.js` referenced in `pickRuntime` is a forward reference (Plan 04), not a stub
in this file's behavior.

## Threat Flags

None. This plan introduces no new network endpoints, auth paths, file access patterns, or
schema changes at trust boundaries. The two new files are pure TypeScript operating on
already-validated parsed JSON (the loader's version guards run before any adapter call).

## Self-Check: PASSED

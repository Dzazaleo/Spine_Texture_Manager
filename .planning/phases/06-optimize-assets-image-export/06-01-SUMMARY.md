---
phase: 06-optimize-assets-image-export
plan: 01
subsystem: infra
tags: [sharp, electron-builder, fixtures, vitest, layer-3-arch]

# Dependency graph
requires:
  - phase: 01-electron-react-scaffold
    provides: electron-builder.yml, package.json, three-tsconfig split, Layer 3 arch.spec
  - phase: 02-global-max-render-source-panel
    provides: dedup-by-attachmentName analyzer (3 unique names from SIMPLE_TEST), DisplayRow fold
  - phase: 04-scale-overrides
    provides: applyOverride / clampOverride pure-TS contract (Plan 06-03 will consume)
  - phase: 05-unused-attachment-detection
    provides: SkeletonSummary.unusedAttachments (Plan 06-03 D-109 subtraction input)
provides:
  - sharp@^0.34.5 runtime dependency (first native binary in the bundle)
  - electron-builder.yml asarUnpack with sharp/**/* + @img/**/* globs (T-06-06 mitigation)
  - fixtures/EXPORT_PROJECT/ with 4 atlas regions + 4 dim-matched source PNGs
  - 3 RED test files driving Plan 06-02..06-05 to GREEN (TDD-style gate)
  - tests/arch.spec.ts extension: src/core ↛ sharp/node:fs grep (Layer 3 lock)
affects: [06-02-types, 06-03-export-builder, 06-04-image-worker, 06-05-ipc-handlers, 06-07-packaging-verify]

# Tech tracking
tech-stack:
  added: [sharp@0.34.5, @img/sharp-{platform}-{arch} prebuilds]
  patterns:
    - "Wave 0 RED-shell pattern: 3 spec files reference symbols not yet in src/; downstream waves drive them GREEN"
    - "asarUnpack dual-glob (sharp/** + @img/**) for sharp 0.33+ scoped-package native bindings"
    - "Fixture-build via deterministic sharp recipe (T-06-01 mitigation: bytes are reproducible)"

key-files:
  created:
    - "fixtures/EXPORT_PROJECT/EXPORT.json (skeleton verbatim from SIMPLE_TEST)"
    - "fixtures/EXPORT_PROJECT/EXPORT.atlas (4 regions: CIRCLE 699×699, SQUARE 1000×1000, SQUARE2 250×250, TRIANGLE 833×759)"
    - "fixtures/EXPORT_PROJECT/images/CIRCLE.png (699×699 solid red, libvips compressionLevel 9)"
    - "fixtures/EXPORT_PROJECT/images/SQUARE.png (1000×1000 solid green)"
    - "fixtures/EXPORT_PROJECT/images/SQUARE2.png (250×250 solid blue)"
    - "fixtures/EXPORT_PROJECT/images/TRIANGLE.png (833×759 solid yellow)"
    - "tests/core/export.spec.ts (8 describe blocks, RED — buildExportPlan + EXPORT_PROJECT sanity + hygiene grep)"
    - "tests/main/image-worker.spec.ts (6 describe blocks, RED — runExport vi.mock'd sharp + node:fs/promises)"
    - "tests/main/ipc-export.spec.ts (2 describe blocks, RED — handlePickOutputDirectory + handleStartExport)"
  modified:
    - "package.json (sharp ^0.34.5 added to dependencies, NOT devDependencies)"
    - "package-lock.json (7 packages added: sharp + @img scoped binaries)"
    - "electron-builder.yml (asarUnpack extended with sharp/**/* + @img/**/*)"
    - "tests/arch.spec.ts (added Layer 3 grep: src/core ↛ sharp/node:fs with loader.ts exemption)"

key-decisions:
  - "sharp pinned to ^0.34.5 (caret-range allows minor updates within 0.34.x; ships @img/* prebuilds for darwin-arm64/x64, win32-x64, linux-x64; Node-API v9 → Electron 41 N-API v10+ compatible)"
  - "Both asarUnpack globs MANDATORY: sharp 0.33+ split native bindings into @img/sharp-{platform}-{arch} scoped packages; missing @img glob causes packaged .dmg to throw 'Cannot find module @img/sharp-darwin-arm64/sharp.node' at first sharp import (T-06-06)"
  - "EXPORT_PROJECT fixture uses real PNGs (sharp-generated solid colors) not synthesized stubs — lets Plan 06-04 image-worker test sharp end-to-end on real bytes while mocking it for the rest"
  - "Added 4th atlas region SQUARE2 (250×250) to EXPORT.atlas since SIMPLE_TEST.atlas only had 3 regions (SIMPLE_TEST.json's SQUARE2 slot maps to the SQUARE attachment); plan acceptance criterion required 4 distinct PNGs"
  - "EXPORT.atlas page filename = EXPORT.png (not SIMPLE_TEST.png) — but the file itself is NOT created since loader uses stub TextureLoader and never decodes PNGs (CLAUDE.md fact #4)"
  - "RED test files import symbols from src/core/export.ts and src/main/image-worker.ts even though those files don't exist yet — vitest fails with 'Cannot find module' for export.spec, 'X is not a function' for the others. This is correct Wave 0 RED state"
  - "Layer 3 arch grep exempts loader.ts by name (Phase 0 load-time fs carve-out; CLAUDE.md fact #4: math phase doesn't decode PNGs but loader is the load phase, not the math phase)"
  - "Buildup-driven dim choice: SQUARE2 dims 250×250 chosen to roughly match the SQUARE2 bone scaleX 0.2538 in SIMPLE_TEST.json (reasonable physical-unit match for visual sanity)"

patterns-established:
  - "Pattern: asarUnpack dual-glob for native node modules — when a native dep restructures into scoped sub-packages (sharp 0.33+ → @img/*), electron-builder needs separate globs for both the main package AND the scoped binary packages"
  - "Pattern: Wave 0 RED-shell — land empty test files that reference symbols from a file that doesn't yet exist; vitest exits non-zero with a clean import error; downstream wave drives RED→GREEN as part of its own task. Avoids the 'create test file' sub-task in every implementation plan"
  - "Pattern: Fixture-build via deterministic sharp recipe — committed PNG bytes are reproducible (libvips solid-color output at compressionLevel 9 is deterministic); future regenerator gets byte-identical files. Documented in commit message + threat-model T-06-01 disposition"
  - "Pattern: Layer 3 grep with name-exemption — when a single Phase 0 file legitimately violates a future-phase invariant (loader.ts uses node:fs at load time but Phase 6 wants the rest of src/core/* sharp/fs-free), grep skips the exempt file by `endsWith()` check rather than carving a hole in the regex itself"

requirements-completed: [N4.2]

# Metrics
duration: 9min
completed: 2026-04-24
---

# Phase 6 Plan 01: Wave 0 Scaffolding Summary

**sharp@^0.34.5 installed + electron-builder.yml asarUnpack extended with both sharp/**/* and @img/**/* globs + EXPORT_PROJECT fixture with 4 dim-matched source PNGs + 3 RED test files driving Plan 06-02..06-05 to GREEN + Layer 3 arch grep extended to forbid sharp/node:fs in src/core/* (loader.ts exempt).**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-24T23:28:Z (worktree spawn)
- **Completed:** 2026-04-24T23:37:55Z
- **Tasks:** 3
- **Files modified:** 10 (3 modified + 7 created)

## Accomplishments

- **sharp 0.34.5 installed as runtime dependency** (NOT devDependency — electron-builder auto-includes production deps into the packaged app per Pitfall 10).
- **electron-builder.yml asarUnpack extended with BOTH sharp/**/* and @img/**/* globs** — without the @img glob the packaged .dmg throws "Cannot find module @img/sharp-darwin-arm64/sharp.node" at first sharp import. Mitigates T-06-06 (release-blocker availability threat).
- **fixtures/EXPORT_PROJECT/ created with EXPORT.json + EXPORT.atlas + 4 source PNGs** — atlas regions match on-disk PNG dims exactly (CIRCLE 699×699, SQUARE 1000×1000, SQUARE2 250×250, TRIANGLE 833×759). Loader sanity-check: `loadSkeleton('fixtures/EXPORT_PROJECT/EXPORT.json')` → 4 regions reachable through `sourceDims`.
- **3 RED test files committed** (tests/core/export.spec.ts + tests/main/image-worker.spec.ts + tests/main/ipc-export.spec.ts) covering all D-decision contracts from CONTEXT.md (D-108..D-123, F8.1, F8.2, F8.3, F8.4, F8.5). Plan 06-02..06-05 will drive them GREEN.
- **tests/arch.spec.ts extended with Layer 3 src/core ↛ sharp/node:fs grep** (loader.ts name-exempt as Phase 0 load-time fs carve-out). The new grep PASSES against the current src/core/* tree, locking the invariant BEFORE any Phase 6 implementation code lands.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install sharp + extend electron-builder asarUnpack** — `02f2442` (chore)
2. **Task 2: Create fixtures/EXPORT_PROJECT/ with atlas + 4 source PNGs** — `daf73c9` (chore)
3. **Task 3: RED specs for export.ts/image-worker.ts/ipc handlers + arch grep** — `39ab450` (test)

_Wave 0 scaffolding — pure infra/test-fixture commits; no `feat` because no production behavior changes yet._

## Files Created/Modified

### Created
- `fixtures/EXPORT_PROJECT/EXPORT.json` (419 lines) — skeleton structure verbatim from SIMPLE_TEST.json (CIRCLE/SQUARE/TRIANGLE/PATH attachments, CHAIN_2..8 bone chain with PhysicsConstraints, TransformConstraint on SQUARE).
- `fixtures/EXPORT_PROJECT/EXPORT.atlas` (10 lines) — page name `EXPORT.png` + 4 regions: CIRCLE bounds:1004,2,699,699 / SQUARE bounds:2,462,1000,1000 / SQUARE2 bounds:1004,1212,250,250 / TRIANGLE bounds:1004,703,833,759.
- `fixtures/EXPORT_PROJECT/images/{CIRCLE,SQUARE,SQUARE2,TRIANGLE}.png` (4 PNGs, dims match atlas-declared originalWidth/Height; solid colors via sharp libvips at compressionLevel 9; bytes deterministic).
- `tests/core/export.spec.ts` (8 describe blocks, 9 it() tests, ~225 lines) — buildExportPlan cases (a)-(g) + EXPORT_PROJECT fixture sanity + module hygiene grep. RED.
- `tests/main/image-worker.spec.ts` (6 describe blocks, 6 it() tests, ~205 lines) — runExport with vi.mock'd sharp + node:fs/promises. RED.
- `tests/main/ipc-export.spec.ts` (2 describe blocks, 11 it() tests, ~250 lines) — handlePickOutputDirectory + handleStartExport with vi.mock'd electron + image-worker. RED.

### Modified
- `package.json` — `dependencies.sharp: ^0.34.5` added (NOT in devDependencies).
- `package-lock.json` — 7 packages added (sharp + @img/sharp-darwin-arm64 + others; npm audit clean, 0 vulnerabilities).
- `electron-builder.yml` — `asarUnpack` extended from 1 line (`resources/**`) to 3 lines (added `**/node_modules/sharp/**/*` and `**/node_modules/@img/**/*`).
- `tests/arch.spec.ts` — added 1 new describe block at end of file: `'Architecture boundary: src/core must not import sharp / node:fs / node:fs/promises (CLAUDE.md Fact #5 + Phase 6 Layer 3 lock)'` with loader.ts name-exemption.

## Decisions Made

- **sharp version pin: ^0.34.5** (caret-range, allows minor 0.34.x bumps). Verified at install: `node -e "require('sharp')"` exits 0 against the darwin-arm64 prebuilt. Future security-sensitive bumps to 0.35.x require an explicit phase-aware update.
- **EXPORT.atlas adds a 4th region (SQUARE2 250×250) NOT present in SIMPLE_TEST.atlas.** Plan acceptance criterion required 4 distinct PNGs (`fixtures/EXPORT_PROJECT/images/{CIRCLE,SQUARE,SQUARE2,TRIANGLE}.png`); since SIMPLE_TEST.atlas only declares 3 atlas regions (SQUARE2 in SIMPLE_TEST.json's slot list maps to the SQUARE atlas region via the `attachment` field), I added SQUARE2 as a 4th atlas region in EXPORT.atlas. Dims (250×250) chosen to roughly match the SQUARE2 bone scaleX 0.2538 in EXPORT.json for visual sanity. Loader sanity-check confirms 4 regions reachable.
- **EXPORT.png NOT created** as a packed atlas page file — the loader uses a stub TextureLoader (CLAUDE.md fact #4: math phase doesn't decode PNGs), so the page file's existence is irrelevant for Phase 6 tests. SIMPLE_TEST.png is kept around in the existing fixture for legacy reasons; EXPORT_PROJECT only ships the unpacked source images.
- **RED test imports use `from '../../src/core/export.js'` syntax even though the file doesn't exist** — vitest fails with a clean `Cannot find module` error, which is the correct Wave 0 RED state. Plan 06-03 creates the file; the import then resolves and the test bodies execute against the new buildExportPlan signature.
- **Plan acceptance line says "4 ExportRows"** for case (a); I corrected the test to expect **3 ExportRows** because Plan 02-03 dedup-by-attachmentName collapses SIMPLE_TEST's 4 sampler records (CIRCLE / SQUARE / SQUARE / TRIANGLE — the two SQUARE-named attachments on slots SQUARE + SQUARE2) into 3 unique attachment names. The plan itself acknowledges this in its NOTE block ("SIMPLE_TEST.json after Phase 2 dedup-by-attachmentName has 3 unique attachment names"), and the existing tests/core/ipc.spec.ts:38 already asserts `peaks.length === 3`. The export.spec.ts case (a) test uses 3.
- **Layer 3 grep exempts loader.ts by name** — the alternative (move loader's fs reads to main-process) is a large Phase 0 refactor that's out of Phase 6 scope. Name-exemption is recommended in PATTERNS.md §1009-1013.

## Deviations from Plan

None substantive — plan executed as written with one acceptance-criteria correction (case (a) row count: plan says "4 ExportRows" in one place, "3" in the embedded NOTE; I picked 3 to match the existing Plan 02-03 dedup contract that ipc.spec.ts already locks). This is a documentation alignment, not a behavioral deviation.

## Issues Encountered

- **None.** Plan was mechanical scaffolding as the planner predicted; the only minor judgment call was the SQUARE2 atlas region addition (decision documented above).

## Test Suite State

- **Before this plan:** 116 passed | 1 skipped (per STATE.md last entry)
- **After this plan:**
  - `npm run test -- tests/arch.spec.ts` → **9 passed** (was 8; +1 new core ↛ sharp/fs grep). GREEN.
  - `npm run test` (full) → **129 passed | 1 skipped | 9 failed** across 13 spec files.
    - The 9 failures are the new RED files: tests/core/export.spec.ts (1 suite-level import error counted as 1) + tests/main/image-worker.spec.ts (some it() blocks fail when runExport import resolves to undefined, ~0 each due to undefined fn) + tests/main/ipc-export.spec.ts (8 it() blocks fail with `handleStartExport is not a function` / `handlePickOutputDirectory is not a function`).
    - Pre-existing 116+1 baseline preserved (the 129 passed includes the +13 from arch.spec gain + new sanity test passing for the EXPORT_PROJECT fixture sanity test (which only loads the fixture; doesn't need the new types) + Math.round contract test (which doesn't need buildExportPlan)).
- **Phase-gate sanity** (verified post-Task-3):
  - `git diff --exit-code scripts/cli.ts` → empty (Phase 5 D-102 byte-for-byte lock preserved)
  - `git diff --exit-code src/core/sampler.ts` → empty (CLAUDE.md fact #3 sampler lock preserved)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 06-02 (extend src/shared/types.ts):** ready. Type contracts referenced by tests/core/export.spec.ts and tests/main/*.spec.ts are documented in CONTEXT.md `<interfaces>` block; Plan 06-02 introduces them in src/shared/types.ts. RED → GREEN transition: once the types exist, all 3 spec files COMPILE; once the implementations exist (Plan 06-03/04/05), the tests RUN against real code.
- **Plan 06-03 (src/core/export.ts):** ready. PATTERNS.md §"src/core/export.ts" gives the exact fold pattern + Layer 3 hygiene contract. RED specs in tests/core/export.spec.ts drive the implementation (TDD-style; copy the case-by-case structure from PATTERNS.md §1106-1127 hygiene block).
- **Plan 06-04 (src/main/image-worker.ts):** ready. PATTERNS.md §"src/main/image-worker.ts" gives the per-row try/catch + atomic-write loop. RED specs in tests/main/image-worker.spec.ts drive it.
- **Plan 06-05 (src/main/ipc.ts handlers + preload + AppShell):** ready. PATTERNS.md §"src/main/ipc.ts" gives the handlePickOutputDirectory + handleStartExport scaffolds. RED specs in tests/main/ipc-export.spec.ts drive them.

## Self-Check: PASSED

Files created (verified via `test -f`):
- FOUND: fixtures/EXPORT_PROJECT/EXPORT.json
- FOUND: fixtures/EXPORT_PROJECT/EXPORT.atlas
- FOUND: fixtures/EXPORT_PROJECT/images/CIRCLE.png
- FOUND: fixtures/EXPORT_PROJECT/images/SQUARE.png
- FOUND: fixtures/EXPORT_PROJECT/images/SQUARE2.png
- FOUND: fixtures/EXPORT_PROJECT/images/TRIANGLE.png
- FOUND: tests/core/export.spec.ts
- FOUND: tests/main/image-worker.spec.ts
- FOUND: tests/main/ipc-export.spec.ts

Files modified (verified via `git log --name-only`):
- FOUND: package.json (in 02f2442)
- FOUND: package-lock.json (in 02f2442)
- FOUND: electron-builder.yml (in 02f2442)
- FOUND: tests/arch.spec.ts (in 39ab450)

Commits exist (verified via `git log --oneline`):
- FOUND: 02f2442 chore(06-01): install sharp + extend electron-builder asarUnpack
- FOUND: daf73c9 chore(06-01): create fixtures/EXPORT_PROJECT/ with atlas + 4 source PNGs
- FOUND: 39ab450 test(06-01): RED specs for export.ts/image-worker.ts/ipc handlers + arch grep

---
*Phase: 06-optimize-assets-image-export*
*Completed: 2026-04-24*

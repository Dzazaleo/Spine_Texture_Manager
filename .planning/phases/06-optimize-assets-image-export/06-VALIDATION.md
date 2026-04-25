---
phase: 6
slug: optimize-assets-image-export
status: signed-off
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-24
partially_verified: 2026-04-25
signed_off: 2026-04-25
note: "Plan 06-07 Task 2 (human-verify) APPROVED 2026-04-25 — all 7 checklist scenarios PASS after 6 rounds of gap fixes (gap1: clamp + atlas-extract + UI key; gap2: collision guard; gap3: probe-then-confirm overwrite UX; gap4: F_OK-only collision gate; gap5: ceil + ceil-thousandth + Peak W×H = export dims; gap6: focus trap + button affordance)."
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Authoritative source: `.planning/phases/06-optimize-assets-image-export/06-RESEARCH.md` §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — see `vitest.config.ts`) |
| **Config file** | `vitest.config.ts` (no Wave 0 install) |
| **Quick run command** | `npm run test -- --run tests/core/export.spec.ts tests/main/image-worker.spec.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~25 s (full suite) / ~5 s (Phase 6 quick subset) |

---

## Sampling Rate

- **After every task commit:** Run quick subset for the file/feature touched.
- **After every plan wave:** Run full suite.
- **Before `/gsd-verify-work 6`:** Full suite must be green; arch.spec.ts green; packaged-build sharp-load smoke check passing.
- **Max feedback latency:** ≤ 30 seconds.

---

## Per-Task Verification Map

> Populated at planning time from plans 06-01 through 06-07. Each task's `<automated>` verification command is recorded below. Test Type maps to RESEARCH.md §Validation Architecture dimension classes: pure-unit, mocked-unit, integration, packaged-build, manual-visual, arch-grep, gate (composite mechanical check), glue (typecheck + build + grep). Status flips from `⬜ pending` to `✅ green` (or `❌ red` / `⚠️ flaky`) by Plan 06-07 Task 1 close-out.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | N4.2 | T-06-06, T-06-07 | sharp@^0.34.5 in dependencies; asarUnpack covers both `sharp/**/*` and `@img/**/*` globs (packaged-build native-binary load) | gate | `node -e "..." (sharp dep check) && node -e "..." (asarUnpack glob check) && node -e "require('sharp')"` (Plan 06-01 T1 verify block) | ✅ | ✅ green |
| 06-01-02 | 01 | 1 | F8.3 | T-06-01 | EXPORT_PROJECT fixture loadable; PNG dims match atlas-declared `originalWidth/Height` | gate | `test -f fixtures/EXPORT_PROJECT/EXPORT.json && test -f fixtures/EXPORT_PROJECT/EXPORT.atlas && test -f fixtures/EXPORT_PROJECT/images/{CIRCLE,SQUARE,SQUARE2,TRIANGLE}.png && node --input-type=module -e "import sharp ..." && head -1 fixtures/EXPORT_PROJECT/EXPORT.atlas \| grep -E "EXPORT.png"` | ✅ | ✅ green |
| 06-01-03 | 01 | 1 | F8.2, F8.3, F8.4, F8.5, N3.1, N4.2 (RED scaffolding) | T-06-01, T-06-06 | RED test shells locked; arch.spec.ts Layer 3 grep extended with `src/core ↛ sharp/node:fs` (loader.ts exempt) | arch-grep | `test -f tests/core/export.spec.ts && test -f tests/main/image-worker.spec.ts && test -f tests/main/ipc-export.spec.ts && npm run test -- tests/arch.spec.ts` | ✅ | ✅ green |
| 06-02-01 | 02 | 2 | F8.3 | T-06-01 (deferred to 06-04) | sourcePath threaded loader→DisplayRow→BreakdownRow; absolute paths; CLI byte-for-byte unchanged | pure-unit | `npm run test -- tests/core/loader.spec.ts tests/core/analyzer.spec.ts && npm run typecheck && git diff --exit-code scripts/cli.ts && git diff --exit-code src/core/sampler.ts && npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json \| grep -E "(CIRCLE\|SQUARE\|TRIANGLE)"` | ✅ | ✅ green |
| 06-02-02 | 02 | 2 | F8.3 | T-06-08, T-06-09 (deferred to 06-05) | 6 IPC types declared (ExportRow/Plan/Error/ProgressEvent/Summary/Response); Api extended with 5 methods; structuredClone-safe (D-21) | pure-unit | `npm run test -- tests/core/summary.spec.ts && npm run typecheck && npm run test -- tests/core/loader.spec.ts tests/core/analyzer.spec.ts tests/core/summary.spec.ts tests/core/ipc.spec.ts tests/arch.spec.ts && git diff --exit-code scripts/cli.ts && git diff --exit-code src/core/sampler.ts` | ✅ | ✅ green |
| 06-03-01 | 03 | 3 | F8.3 | T-06-11 | Pure-TS buildExportPlan with D-108 dedup + D-109 unused-exclusion + D-110 uniform Math.round + D-111 override-or-peakScale; Layer 3 hygiene (no fs/sharp/spine-core runtime imports) | pure-unit | `npm run test -- tests/core/export.spec.ts && npm run typecheck && npm run test -- tests/arch.spec.ts` | ✅ | ✅ green |
| 06-03-02 | 03 | 3 | F8.3 | T-06-10 | Renderer-side byte-identical inline copy of buildExportPlan; parity describe block locks core ↔ view drift | pure-unit | `npm run test -- tests/core/export.spec.ts && npm run typecheck && npm run test -- tests/arch.spec.ts && diff <(awk '/^export function buildExportPlan/,/^}/' src/core/export.ts) <(awk '/^export function buildExportPlan/,/^}/' src/renderer/src/lib/export-view.ts) \| wc -l \| grep -E "^\s*0$"` | ✅ | ✅ green |
| 06-04-01 | 04 | 3 | F8.2, F8.4, N3.1, N4.2 | T-06-01, T-06-03, T-06-04, T-06-05, T-06-12, T-06-13 | runExport sequential loop with fs.access pre-flight + path-traversal defense + NaN/zero guard + sharp Lanczos3 + PNG compressionLevel:9 + atomic .tmp→rename + cancel loop; only file in src/ allowed to import sharp | mocked-unit | `npm run typecheck && npm run test -- tests/arch.spec.ts && grep -E "from 'sharp'" src/main/image-worker.ts && grep -E "from 'node:fs/promises'" src/main/image-worker.ts && grep -cE "^export async function runExport" src/main/image-worker.ts` | ✅ | ✅ green |
| 06-04-02 | 04 | 3 | F8.2, F8.5, N3.1 | T-06-03, T-06-12 | All 6 mocked unit cases (a-f) GREEN + 1 real-bytes integration GREEN against EXPORT_PROJECT/CIRCLE.png 64×64 → 32×32 | mocked-unit + integration | `npm run test -- tests/main/image-worker.spec.ts && npm run test -- tests/main/image-worker.integration.spec.ts && npm run typecheck && git diff --exit-code scripts/cli.ts && git diff --exit-code src/core/sampler.ts` | ✅ | ✅ green |
| 06-05-01 | 05 | 4 | F8.1, F8.4 | T-06-02, T-06-04, T-06-09 | handleStartExport re-entrancy guard (D-115), outDir validation (D-122 / F8.4 — rejects equal-to or child-of source/images), plan shape check (T-01-02-01); handlePickOutputDirectory with cross-platform properties (createDirectory + promptToCreate + dontAddToRecent) | mocked-unit | `npm run typecheck && npm run test -- tests/main/ipc-export.spec.ts && npm run test -- tests/arch.spec.ts && git diff --exit-code scripts/cli.ts && git diff --exit-code src/core/sampler.ts` | ✅ | ✅ green |
| 06-05-02 | 05 | 4 | F8.1, F8.5 | T-06-14, T-06-15 | preload contextBridge surface extended with 5 methods; `onExportProgress` unsubscribe pattern preserves listener identity (Pitfall 9); sandbox discipline preserved (no new runtime imports) | gate | `npm run typecheck && grep -cE "(pickOutputDirectory\|startExport\|cancelExport\|onExportProgress\|openOutputFolder):" src/preload/index.ts && grep -E "ipcRenderer\.on\('export:progress'" src/preload/index.ts && grep -E "ipcRenderer\.removeListener\('export:progress'" src/preload/index.ts && npx electron-vite build` | ✅ | ✅ green |
| 06-06-01 | 06 | 5 | F8.1, F8.5 | T-06-15, T-06-16, T-06-17 | OptimizeDialog ARIA scaffold (role/aria-modal/labelledby) + 3-state state machine (pre-flight/in-progress/complete) + ESC/click-outside guard during in-progress + onExportProgress useEffect cleanup + Tailwind v4 literal-class discipline + Layer 3 invariant (renderer ↛ core) | gate + arch-grep | `npm run typecheck:web && npx electron-vite build && npm run test -- tests/arch.spec.ts && grep -E "role=\"dialog\"" src/renderer/src/modals/OptimizeDialog.tsx && grep -E "aria-modal=\"true\"" src/renderer/src/modals/OptimizeDialog.tsx && grep -E "onExportProgress" src/renderer/src/modals/OptimizeDialog.tsx` | ✅ | ✅ green |
| 06-06-02 | 06 | 5 | F8.1 | T-06-18 | AppShell toolbar button (right-aligned, disabled when peaks=0 or exportInFlight) + click flow (picker → buildExportPlan → mount); Layer 3 import path is `lib/export-view.js` NOT `core/export.js` | gate + arch-grep | `npm run typecheck:web && npx electron-vite build && npm run test -- tests/arch.spec.ts && grep -E "OptimizeDialog" src/renderer/src/components/AppShell.tsx && grep -E "buildExportPlan" src/renderer/src/components/AppShell.tsx && grep -E "from '\.\./lib/export-view\.js'" src/renderer/src/components/AppShell.tsx` | ✅ | ✅ green |
| 06-07-01 | 07 | 6 | F8.1, F8.2, F8.3, F8.4, F8.5, N3.1, N3.2, N4.2 | T-06-06, T-06-07, T-06-19 | Full automated exit-criteria sweep: vitest + typecheck + electron-vite build + locked-file diffs (cli.ts + sampler.ts) + npm audit on sharp + .dmg produced; flips Status column for rows 06-01-01..06-06-02 from ⬜ pending → ✅ green | gate (close-out sweep) | `npm run test && npm run typecheck && npx electron-vite build && git diff --exit-code scripts/cli.ts && git diff --exit-code src/core/sampler.ts && npm audit --omit=dev --audit-level=high \| grep -E "found 0 vulnerabilities\|0 vulnerabilities"` | ❌ W0 | ✅ green |
| 06-07-02 | 07 | 6 | N3.2, N4.2, F8.1, F8.4, F8.5 | T-06-06, T-06-15, T-06-16, T-06-19 | Manual gates only humans can verify: visual Lanczos3 vs Photoshop (N3.2); packaged .dmg sharp-load (N4.2); folder picker UX + outDir validation; cancel UX during real export; ARIA keyboard sanity; backward compat with SIMPLE_TEST + GHOST fixtures | manual-visual | (human-verify checkpoint — 7-step checklist; resume signal logs PASS/FAIL/SKIP/DEFER per step) | ❌ W0 | ✅ green |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ❌ W0 = no test file (verified by composite gate or human-verify)*

### Notes — Plan 06-07 Task 1 sweep results (2026-04-25)

- **Rows 06-01-01 through 06-06-02 (13 rows): all ✅ green.** Each row's `Automated Command` was re-run in this sweep and exited 0. Test count steady at **172 passed | 1 skipped | 0 failed** across 14 spec files (no regressions vs Plan 06-05/06-06 baseline). `arch.spec.ts` 9/9 PASS. `git diff --exit-code scripts/cli.ts` and `src/core/sampler.ts` both empty (D-102 + CLAUDE.md fact #3 byte-for-byte locks intact).
- **Row 06-07-01: ✅ green.** Composite close-out sweep: vitest + typecheck + electron-vite build + locked-file diffs + npm audit + .dmg produced. Build artifact: `release/Spine Texture Manager-0.0.0-arm64.dmg` 118 MB (built 2026-04-25 01:24Z). Both asarUnpack globs verified: `node_modules/sharp` (300K) and `node_modules/@img` (16M, with `sharp-darwin-arm64` + `sharp-libvips-darwin-arm64` + `colour` subpackages) present under `app.asar.unpacked/`. `npm audit --omit=dev --audit-level=high` reports `found 0 vulnerabilities`.
- **Row 06-07-02: ✅ green (signed-off 2026-04-25).** All 7 manual checklist scenarios PASS after 6 rounds of in-line gap fixes (clamp + atlas-extract + UI key; collision guard; probe-then-confirm overwrite UX; F_OK-only collision gate; ceil + ceil-thousandth + Peak W×H = export dims; focus trap + button affordance). Suite at 207 pass / 1 skip / 0 fail; arch 9/9; CLI byte-locked.

### Pre-existing Out-of-Scope Issue (not regressions; not blocking)

- `scripts/probe-per-anim.ts(14,31): TS2339: Property 'values' does not exist on type 'SamplerOutput'` — pre-existing on the Phase 6 base commit (documented in Plan 06-02 / 06-05 SUMMARYs as out-of-scope per executor scope-boundary). Not introduced by Phase 6; not in any Phase 6 plan's `files_modified`.

### Build size deviation (informational)

- Plan 06-07 expected `.dmg` size 140-200 MB; actual is 118 MB on darwin-arm64. The plan estimate accounted for "sharp + @img native binaries unpacked"; in practice on this single-arch build, the unpacked native footprint is 16.3 MB (16M `@img/` + 300K `sharp/`), keeping the package smaller than predicted. The asarUnpack mitigation (which is the real T-06-06 contract) is verified intact: `release/mac-arm64/Spine Texture Manager.app/Contents/Resources/app.asar.unpacked/node_modules/{sharp,@img}` both present. Size is informational only — Step 6 of the human-verify checklist will confirm sharp loads at runtime in the packaged build.

---

## Wave 0 Requirements

> Wave 0 (Plan 06-01) prepares test fixtures + RED test shells before any implementation. The structural commitment below is met by the three Plan 06-01 tasks.

- [x] `fixtures/EXPORT_PROJECT/` — dedicated export fixture (atlas + JSON + `images/CIRCLE.png`, `SQUARE.png`, `SQUARE2.png`, `TRIANGLE.png`) so tests can exercise real PNG read/write end-to-end without depending on `SIMPLE_PROJECT` (which has no `images/` folder). Owner: 06-01-02.
- [x] `tests/core/export.spec.ts` — RED shell covering buildExportPlan dedup, override-clamping, unused-exclusion, Math.round half-cases, hygiene grep (no `fs`/`sharp`/`spine-core` imports in `src/core/export.ts`). Owner: 06-01-03.
- [x] `tests/main/image-worker.spec.ts` — RED shell with mocked `sharp` + `node:fs/promises` covering all-success, missing-source, sharp-error mid-run, cancel-after-N, atomic-write protocol, NaN/zero-dim guard. Owner: 06-01-03.
- [x] `tests/main/ipc-export.spec.ts` — RED shell covering F8.1 picker behavior + D-115 re-entrancy + D-122 outDir validation. Owner: 06-01-03.
- [x] `tests/arch.spec.ts` — extend forbidden-import scan for `src/core/*.ts` to include `sharp` + `node:fs` + `node:fs/promises` (loader.ts exempt as Phase 0 load-time carve-out). Owner: 06-01-03.
- [x] sharp@^0.34.5 installed; `electron-builder.yml` asarUnpack extended with both `sharp/**/*` and `@img/**/*` globs. Owner: 06-01-01.
- [x] No new framework install — vitest covers all dimensions.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lanczos3 visual quality vs Photoshop reference | N3.2 | "no perceptible difference" is subjective; no automated golden-image diff in MVP | Export `CIRCLE.png` at peakScale ≈ 0.7. Open exported file + a Photoshop-Lanczos resize of the same source at the same target dims. Side-by-side diff in an image diff tool. Flag any visible difference. |
| Packaged `.dmg` loads sharp without `electron-rebuild` | N4.2 + D-123 | Native binary unpacking only verifiable on a built artifact, not in dev mode | `npm run build`. Open the produced `.dmg`, install, launch. Trigger an export of the SIMPLE/EXPORT fixture. Confirm: no native-module load error, output file produced at correct dims. |
| OS folder picker behavior + `defaultPath` honored | F8.1 + D-122 | Electron `dialog.showOpenDialog` is OS-driven; cannot be unit-tested | Click "Optimize Assets" with a loaded skeleton. Picker opens at `<skeleton_dir>/images-optimized/` (creates if absent). Cancel button closes picker silently. Confirm button mounts OptimizeDialog with the chosen path. |
| Cancellation UX during a 30+ file export | F8.5 + D-115 | Race-condition behavior of cooperative cancel only observable on a real-sized batch | Export the EXPORT_PROJECT fixture (or larger). Click Cancel mid-run. In-flight file finishes; subsequent files do not start; partial output stays on disk; summary shows `cancelled: true` + correct successes count. |
| OptimizeDialog ARIA + keyboard | F8.5 (UX safety) | Screen-reader/keyboard interaction is not in the unit-test surface | Open dialog. Tab cycles through Start/Cancel without leaking. ESC closes pre-flight. Click-outside closes pre-flight. During run, Cancel is reachable via Tab. Open-output-folder works after completion. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30 s
- [x] `nyquist_compliant: true` set in frontmatter (flipped by Plan 06-07 Task 1 at close-out)

**Approval:** signed-off 2026-04-25 — Plan 06-07 Task 2 human-verify APPROVED across all 7 scenarios after 6 rounds of in-line gap fixes (gap1..gap6).

---
phase: 1
slug: electron-react-scaffold
status: ready-for-exit
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-23
last_updated: 2026-04-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Populated from `01-RESEARCH.md` §Validation Architecture and expanded during planning with per-task coverage across 01-01..01-05. Plan 01-05 Task 3 confirms `nyquist_compliant: true` (set here at plan time; execution confirms no regressions to Wave 0).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (carried over from Phase 0) |
| **Config file** | `vitest.config.ts` at project root |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npm run typecheck && npm run build:dry` *(after plan 01-05; earlier plans only run the first two)* |
| **Estimated runtime** | ~5–8 seconds (vitest + tsc); ~30 seconds once `electron-vite build` is in scope |

Additional gates introduced in Phase 1 (documented for planner; wired into tasks):

| Gate | Command | When |
|------|---------|------|
| Typecheck (split) | `npm run typecheck` (= `typecheck:node && typecheck:web`) | Every commit |
| Renderer isolation grep (Layer 3) | `! grep -rnE "from ['\"][^'\"]*/core/\|from ['\"]@core" src/renderer/ --include='*.ts' --include='*.tsx'` | `tests/arch.spec.ts` runs on every commit |
| Portability grep (D-23) | `! grep -rnE "process\.platform\|os\.platform\(\)\|titleBarStyle:\s*['\"]hiddenInset['\"]\|trafficLightPosition\|vibrancy:\|visualEffectState" src/` | `tests/arch.spec.ts` runs on every commit |
| electron-vite build | `npx electron-vite build` | After 01-03 (renderer complete) and 01-05 (packaging) |
| electron-builder dry-pack | `npm run build:dry` | After 01-05 |

---

## Sampling Rate

- **After every task commit:** Run `npm test && npm run typecheck`
- **After every plan wave:** Run full suite (includes build once wave 3+ land)
- **Before `/gsd-verify-work`:** `npm test` green, `tsc --noEmit` clean on both projects, `electron-vite build` succeeds, `electron-builder --mac dmg --dir` succeeds, drop-test fixture renders debug dump matching Phase 0 CLI output
- **Max feedback latency:** 10 seconds for test+typecheck; 60 seconds for build

---

## Per-Task Verification Map

> One row per task across plans 01-01..01-05. Status updates during execution (`⬜ pending → ✅ green / ❌ red / ⚠️ flaky`).

| Task ID    | Plan  | Wave | Requirement              | Threat Ref              | Secure Behavior                                                                                           | Test Type              | Automated Command                                                                                   | File Exists | Status |
|------------|-------|------|--------------------------|-------------------------|-----------------------------------------------------------------------------------------------------------|------------------------|-----------------------------------------------------------------------------------------------------|-------------|--------|
| 01-01-01   | 01-01 | 1    | N4.1, N4.2               | T-01-01-01              | Pinned dep versions (RESEARCH 2026-04-23 verified); lockfile committed; Phase 0 invariants hold           | Shell                  | `npm install && npx tsc --noEmit && npm run test && npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` | ✓           | ✅     |
| 01-01-02   | 01-01 | 1    | N4.1, N4.2               | T-01-01-02              | tsconfig.web.json EXCLUDES src/core/**; no @core path alias (Layer 1 boundary)                            | Typecheck + grep       | `npm run typecheck && grep -q '"src/core' tsconfig.web.json && ! grep -q '"@core' tsconfig.web.json`  | ✓           | ✅     |
| 01-01-03   | 01-01 | 1    | N4.1, N4.2               | T-01-01-02              | electron.vite.config.ts has NO @core alias (Layer 2); .gitignore adds out/ + release/                     | Grep + typecheck       | `! grep -q "@core" electron.vite.config.ts && grep -q "out/" .gitignore && grep -q "release/" .gitignore` | ✓           | ✅     |
| 01-02-01   | 01-02 | 2    | F1.1, F1.2, F1.4         | T-01-02-02              | Wave 0 shells RED; shared/types.ts declared; SerializableError.kind literals match errors.ts byte-for-byte | Typecheck + vitest     | `npm run typecheck:node && npm run test` (summary.spec + ipc.spec RED; arch.spec green)              | ✓           | ✅     |
| 01-02-02   | 01-02 | 2    | F1.1, F1.2, F1.4         | T-01-02-01, T-01-02-02  | handleSkeletonLoad validates jsonPath; buildSummary structuredClone-safe; NO err.stack leakage            | vitest                 | `npm run typecheck && npm run test` (summary 3/3 + ipc 3/3 GREEN)                                    | ✓           | ✅     |
| 01-02-03   | 01-02 | 2    | F1.1                     | T-01-02-03              | BrowserWindow webPrefs pinned (contextIsolation:true, nodeIntegration:false, sandbox:true); no macOS chrome; HMR branch | Typecheck + arch.spec  | `npm run typecheck && npm run test`                                                                  | ✓           | ✅     |
| 01-03-01   | 01-03 | 3    | F1.1                     | T-01-03-01, T-01-03-02  | Preload uses webUtils.getPathForFile (D-09 correction); minimal contextBridge surface; file.path absent   | Typecheck + grep       | `npm run typecheck && npm run test && ! grep -q "file\\.path" src/preload/index.ts && grep -q "webUtils.getPathForFile" src/preload/index.ts` | ✓           | ✅     |
| 01-03-02   | 01-03 | 3    | F1.1                     | T-01-03-03              | CSP meta in index.html; React 19 StrictMode mount; App.tsx AppState union; arch.spec Layer 3 scans real renderer files | Typecheck + vitest     | `npm run typecheck && npm run test`                                                                  | ✓           | ✅     |
| 01-03-03   | 01-03 | 3    | F1.1                     | —                       | Tailwind v4 `@theme inline` (D-12/D-14 correction); self-hosted JetBrains Mono; electron-vite build emits full out/ tree | Build                  | `npm run typecheck && npm run test && npx electron-vite build && ls out/main/index.js out/preload/index.js out/renderer/index.html` | ✓           | ✅     |
| 01-04-01   | 01-04 | 4    | F1.1, F1.4               | T-01-04-01              | DropZone passes raw File to preload (NOT file.path); literal Tailwind classes (Pitfall 8); no react-dropzone; no src/core import | Typecheck + arch.spec | `npm run typecheck && npm run test && grep -q "ring-2 ring-accent bg-accent/5" src/renderer/src/components/DropZone.tsx` | ✓           | ✅     |
| 01-04-02   | 01-04 | 4    | F1.1, F1.2               | —                       | DebugPanel ports cli.ts renderTable byte-for-byte; Unicode × present; no core imports; no console.log (caller owns echo) | Typecheck + arch.spec | `npm run typecheck && npm run test && grep -q "'Source W×H'" src/renderer/src/components/DebugPanel.tsx` | ✓           | ✅     |
| 01-04-03   | 01-04 | 4    | F1.1, F1.4               | T-01-04-02              | App.tsx wires all 4 AppState branches; D-17 console.log echo gated on loaded status via useEffect; DropZone+DebugPanel composed | Build + vitest         | `npm run typecheck && npm run test && npx electron-vite build`                                       | ✓           | ✅     |
| 01-05-01   | 01-05 | 5    | N4.1, N4.2               | T-01-05-01              | electron-builder.yml mac.target=[dmg]; no win: block (D-24); files whitelist excludes src/tests/fixtures/.planning; no signing hooks (D-04) | YAML + grep            | `grep -q "target: \\[dmg\\]" electron-builder.yml && ! grep -qE "^win:" electron-builder.yml && ! grep -qE "^(afterPack\|publish\|notarize):" electron-builder.yml` | ✓           | ✅     |
| 01-05-02   | 01-05 | 5    | N4.1, N4.2, F1.1, F1.2, F1.4 | T-01-05-01          | npm run build:dry exits 0; real .dmg builds < 200MB; portability + Layer 3 greps green end-to-end         | Shell sweep            | `npm run build:dry && test -d "release/mac-arm64/Spine Texture Manager.app" && npm run build && ls release/*.dmg` | ✓           | ✅     |
| 01-05-03   | 01-05 | 5    | —                        | —                       | VALIDATION.md per-task map populated; frontmatter nyquist_compliant: true; wave_0_complete: true            | File edit              | `grep -q "nyquist_compliant: true" .planning/phases/01-electron-react-scaffold/01-VALIDATION.md`    | ✓           | ✅     |
| 01-05-04   | 01-05 | 5    | F1.1, F1.2, F1.4         | —                       | Manual drop of SIMPLE_TEST.json renders debug dump matching CLI byte-for-byte; .dmg opens + packaged app launches | Manual                 | Human-verify checkpoint (see Plan 01-05 Task 4)                                                     | n/a         | ⬜     |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity check (PASSED):** Among 15 tasks, 14 have automated verification; the single Manual task (01-05-04) is at the tail. No three consecutive tasks are Manual. Sampling gate satisfied.

---

## Wave 0 Requirements

Wave 0 installs shared test infrastructure BEFORE any implementation plan runs. Created in Plan 01-02 Task 1 (RED state) and turned GREEN in Plan 01-02 Task 2:

- [x] `tests/core/ipc.spec.ts` — forces src/shared/types.ts + src/main/ipc.ts to exist; covers F1-integrated + D-10 error envelope
- [x] `tests/core/summary.spec.ts` — forces src/main/summary.ts to exist; covers D-21 shape + D-22 structuredClone + D-16 sort order
- [x] `tests/arch.spec.ts` — three-layer-defense Layer 3 (renderer↛core grep) + D-23 portability grep
- [x] Vitest already installed (Phase 0) — no framework install needed

Wave 0 files are scheduled in Plan 01-02 Task 1 (the FIRST plan that genuinely needs them as acceptance-criteria gates, per nyquist_validation upstream prompt).

Research source: `01-RESEARCH.md` §Validation Architecture Wave 0 list (three-layer `core/ ↛ renderer/` boundary, IPC round-trip, summary serializability).

---

## Manual-Only Verifications

Phase 1 has one load-bearing manual gate — the end-to-end drop flow. `webUtils.getPathForFile` requires a real Electron renderer + OS DragEvent; headless vitest can't simulate it.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-drop loads SIMPLE_TEST.json → debug dump matches CLI byte-for-byte | Phase 1 exit criterion (ROADMAP) | DragEvent + webUtils.getPathForFile need real renderer context (no Playwright in Phase 1) | 1. `npm run dev` 2. Drag `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` into window 3. Verify DebugPanel header (9 bones / 5 slots / 4 attachments) + `<pre>` table rows CIRCLE/SQUARE/SQUARE2/TRIANGLE match `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` |
| Error path: drop non-JSON + missing-atlas | F1.4 | Typed-error UI surfacing needs real IPC round-trip | 1. Drop a `.txt` file → expect muted-orange error `Unknown: Not a .json file`; 2. Create a JSON without sibling atlas → expect muted-orange `AtlasNotFoundError: Expected atlas at ...` |
| Unsigned `.dmg` opens on macOS (dev machine) | N4 baseline | `.dmg` install behavior not automatable without signed cert | `npm run build` → `open release/*.dmg` → right-click `Spine Texture Manager.app` → Open → bypass Gatekeeper → app launches → packaged drop-test succeeds |

All three manual behaviors are consolidated into Plan 01-05 Task 4 `checkpoint:human-verify`.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (planner checks; populated above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (verified: 14/15 automated; Manual is at tail)
- [x] Wave 0 covers all MISSING references (arch + summary + ipc shells scheduled in 01-02 Task 1)
- [x] No watch-mode flags (`vitest run`, not `vitest` / `--watch`)
- [x] Feedback latency < 10s for quick command; < 60s for full (Phase 0 sampler is ~10ms; 35-test vitest run is ~5s; electron-vite build is ~20s)
- [x] `nyquist_compliant: true` set in frontmatter after planner fills the per-task table

**Approval:** planner-approved at plan time (2026-04-23); Plan 01-05 Task 3 re-affirms no regressions at end of execution; Task 4 human-verify checkpoint signs off the manual gates.

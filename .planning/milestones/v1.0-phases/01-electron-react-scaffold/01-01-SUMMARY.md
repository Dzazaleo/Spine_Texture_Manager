---
phase: 01-electron-react-scaffold
plan: 01
subsystem: infra
tags: [electron, electron-vite, electron-builder, react19, tailwindcss4, typescript6, tsconfig-references, project-references, fontsource, jetbrains-mono]

# Dependency graph
requires:
  - phase: 00-core-math-spike
    provides: src/core/{loader,sampler,bounds,errors,types}.ts + scripts/cli.ts + vitest setup — Phase 0 headless core that Phase 1 main process wraps
provides:
  - Electron 41 + electron-vite 5 + electron-builder 26 toolchain installed (package.json + lockfile committed)
  - React 19 + Tailwind v4 + @tailwindcss/vite + @fontsource/jetbrains-mono for renderer
  - Three-tsconfig split — root references-only + tsconfig.node.json + tsconfig.web.json — enforcing CLAUDE.md Fact #5 at Layer 1 (renderer excludes src/core/**)
  - electron.vite.config.ts scaffolded with renderer.plugins: [react(), tailwindcss()] and renderer alias restricted to @renderer (Layer 2 boundary — no @core alias)
  - npm scripts: dev, build, build:dry, preview, typecheck:node, typecheck:web wired
  - .gitignore adds out/, release/, *.tsbuildinfo
  - src/shared/types.ts seed (empty export) satisfying TypeScript 6.x TS18003 gate
affects: [01-02, 01-03, 01-04, 01-05, phase-02, phase-03, phase-04, phase-05, phase-06, phase-07, phase-08, phase-09]

# Tech tracking
tech-stack:
  added:
    - electron@^41.3.0
    - electron-vite@^5.0.0
    - electron-builder@^26.8.1
    - react@^19.2.5 + react-dom@^19.2.5
    - "@vitejs/plugin-react@^5.2.0"
    - tailwindcss@^4.2.4 + "@tailwindcss/vite@^4.2.4"
    - "@fontsource/jetbrains-mono@^5.2.8"
    - "@electron-toolkit/tsconfig@^2.0.0"
    - "@types/react@^19.2.14" + "@types/react-dom@^19.2.3"
    - clsx@^2.1.1
  patterns:
    - Three-layer defense for core/ ↛ renderer/ boundary — Layer 1 landed here (tsconfig.web.json exclude + no @core path alias), Layer 2 landed here (electron.vite.config.ts has no @core bundler alias), Layer 3 (tests/arch.spec.ts) to land in Plan 01-02
    - TypeScript project references (composite: true) on both node + web projects; root tsconfig.json is references-only
    - electron-vite v5 default build.externalizeDeps handles all externals — no legacy externalize-deps helper needed
    - atomic commit scope convention for Phase 1: chore(01-01):, build(01-01): per task

key-files:
  created:
    - tsconfig.node.json
    - tsconfig.web.json
    - electron.vite.config.ts
    - src/shared/types.ts
  modified:
    - package.json
    - package-lock.json
    - tsconfig.json
    - .gitignore

key-decisions:
  - "TypeScript 6.x retained (not downgraded to 5.9.x) — @electron-toolkit/tsconfig@2.0.0 bases are compatible; `npx tsc --noEmit` exits 0 against flat single config after install. RESEARCH Open Question A1 resolved in favor of staying on 6.x."
  - "tsconfig.web.json needs ignoreDeprecations: '6.0' for baseUrl (deprecated in TS 6.0, still required by the @renderer path alias)."
  - "tsconfig.web.json needs a seed input file to satisfy TS18003 under TS 6.x strict enforcement — src/shared/types.ts created empty as the Phase 1 shared-types module that Plan 01-02 will populate."
  - "Tailwind v4 config lives entirely in CSS (@theme) — no postcss.config, no tailwind.config.js. @tailwindcss/vite registered directly on renderer.plugins."
  - "electron-builder config NOT in package.json — stays in electron-builder.yml (Plan 01-05) to match canonical starter and avoid YAML/JSON precedence conflicts."
  - "Test scripts + CLI script preserved — Phase 0 invariants (npm run test: 47/47+1 skip, npm run cli: exit 0 on SIMPLE_TEST.json) hold byte-for-byte."

patterns-established:
  - "Layer 1 core-boundary: tsconfig.web.json include list omits src/core/** AND exclude list contains src/core/** (belt-and-suspenders against wildcard shadow-include from the extended base)."
  - "Layer 2 core-boundary: electron.vite.config.ts renderer.resolve.alias limited to @renderer only; no @core alias means renderer bundler cannot resolve aliased imports into core."
  - "Three-tsconfig split naming matches @electron-toolkit/tsconfig base names: tsconfig.node.json extends node base; tsconfig.web.json extends web base; root is references-only with empty files array."
  - "Commit scope convention confirmed for 01-XX: chore(01-01): for config/deps/tsconfig, build(01-01): for bundler/builder config."

requirements-completed: [N4.1, N4.2]

# Metrics
duration: 6min
completed: 2026-04-23
---

# Phase 01 Plan 01: Electron + Vite + React + Tailwind toolchain Summary

**Electron 41 + electron-vite 5 + electron-builder 26 + React 19 + Tailwind v4 toolchain installed with three-tsconfig split (node + web) enforcing core/ ↛ renderer/ boundary at Layer 1 (compiler include) + Layer 2 (bundler alias).**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-23T10:21:45Z
- **Completed:** 2026-04-23T10:26:59Z
- **Tasks:** 3
- **Files created:** 4 (tsconfig.node.json, tsconfig.web.json, electron.vite.config.ts, src/shared/types.ts)
- **Files modified:** 4 (package.json, package-lock.json, tsconfig.json, .gitignore)

## Accomplishments

- Phase 1 runtime + dev dependencies installed in a single lockfile update; lockfile committed. TS 6.x compat spike passed (EXIT=0) — no downgrade needed.
- Three-tsconfig split: `tsconfig.json` is references-only; `tsconfig.node.json` extends `@electron-toolkit/tsconfig/tsconfig.node.json` with `composite: true` and covers main/preload runtime/shared/core/scripts/tests; `tsconfig.web.json` extends the web base, sets `jsx: react-jsx`, declares `@renderer/*` path alias, and EXCLUDES `src/core/**`.
- `electron.vite.config.ts` scaffolded with `plugins: [react(), tailwindcss()]` on renderer, `@renderer` alias only (no `@core` — Layer 2 boundary enforced). Main/preload bodies empty (v5 default externalizes deps).
- `.gitignore` extended with `out/` (electron-vite), `release/` (electron-builder defensive), `*.tsbuildinfo` (composite project-references emit).
- `npm run typecheck` (both node + web) green. Phase 0 invariants hold: `npm run test` → 47/47 + 1 skip; `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` exits 0 with CIRCLE/SQUARE/SQUARE2/TRIANGLE rows.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Phase 1 dependencies and pin versions** — `301a072` (chore)
2. **Task 2: Three-tsconfig split enforcing core/ ↛ renderer/ at Layer 1** — `17a693a` (chore)
3. **Task 3: electron.vite.config.ts scaffold + .gitignore additions** — `8bc85a5` (build)

**Plan metadata:** to follow (docs: complete plan)

## Files Created/Modified

### Created
- `tsconfig.node.json` — node-context tsconfig; extends `@electron-toolkit/tsconfig/tsconfig.node.json`; includes `src/core/**`, `src/main/**`, `src/preload/index.ts`, `src/shared/**`, `scripts/**`, `tests/**`, `electron.vite.config.ts`, `vitest.config.ts`; `composite: true`; `types: [node]`.
- `tsconfig.web.json` — web-context tsconfig; extends `@electron-toolkit/tsconfig/tsconfig.web.json`; includes `src/renderer/src/**/*.{ts,tsx}`, `src/renderer/src/env.d.ts`, `src/preload/index.d.ts`, `src/shared/**`; EXCLUDES `src/core/**`; `jsx: react-jsx`; `@renderer/*` path alias; `ignoreDeprecations: "6.0"` for `baseUrl`.
- `electron.vite.config.ts` — canonical RESEARCH Pattern 3 config; `main` + `preload` empty bodies; `renderer.plugins: [react(), tailwindcss()]`; `renderer.resolve.alias` limited to `@renderer` → `src/renderer/src`.
- `src/shared/types.ts` — empty placeholder module (`export {}`) seeding Plan 01-02's shared IPC types; required to satisfy TS18003 under TypeScript 6.x (Rule 3 deviation below).

### Modified
- `package.json` — `main: "./out/main/index.js"` added; new scripts (`dev`, `build`, `build:dry`, `preview`, `typecheck:node`, `typecheck:web`); `typecheck` delegates to split; Phase 0 scripts (`test`, `test:watch`, `cli`) preserved; Phase 1 deps added to `dependencies` + `devDependencies`.
- `package-lock.json` — reflects 377 net new packages (370 dev, 7 runtime).
- `tsconfig.json` — destructive rewrite to references-only: `"files": []` + references to `./tsconfig.node.json` + `./tsconfig.web.json`. Prior `include`/`compilerOptions` redistributed into children.
- `.gitignore` — appended `out/`, `release/`, `*.tsbuildinfo`. Existing entries (`node_modules/`, `dist/`, `coverage/`, `temp/`, `fixtures/Jokerman/`, `fixtures/Girl/`, `.DS_Store`, `*.log`, `npm-debug.log*`) preserved verbatim.

## Decisions Made

- **TypeScript 6.x retained (not downgraded).** RESEARCH Open Question A1 flagged `@electron-toolkit/tsconfig@2.0.0` as "built against 5.x." Spike result: `npx tsc --noEmit` against the current flat tsconfig.json, after installing the toolkit, exits 0. The bases resolve and typecheck cleanly under TS 6.x. No downgrade to 5.9.x needed. Root `typescript: ^6.0.0` kept.
- **`ignoreDeprecations: "6.0"` added to tsconfig.web.json.** TS 6.0 marks `baseUrl` as deprecated (TS5101). The `@renderer` path alias requires `baseUrl`, so we silence the deprecation explicitly per TS's own `aka.ms/ts6` guidance. This is a one-liner in `compilerOptions`.
- **`@vitejs/plugin-react` resolved at `^5.2.0`.** Plan pinned `^5.1.2`; npm resolved within the `^5.x` band to `5.2.0` (latest 5.x at install time). Still within the "5.1.x per starter compat" intent — 5.x major is what the canonical starter ships. No action needed.
- **`@types/react` resolved at `^19.2.14`.** Plan pinned `^19.2.7`; npm resolved within the `^19.2.x` band to `19.2.14`. Same SemverMinor band, no action.
- **Electron-builder config kept in `electron-builder.yml` (Plan 01-05), not in `package.json`.** Per RESEARCH Open Question 2: YAML file is the canonical starter convention and avoids dual-source-of-truth. No `build: {}` block in package.json.
- **`src/shared/types.ts` seeded empty in this plan, not Plan 01-02.** TypeScript 6.x fires TS18003 ("No inputs were found") when `tsconfig.web.json` has an include list that resolves to zero files. The file is already on the plan's dependency graph as Plan 01-02 Task 1 scope, but it must exist NOW to satisfy the `npm run typecheck` gate. Plan 01-02 Task 1 will replace the `export {};` body with the real `SkeletonSummary` / `PeakRecordSerializable` / `LoadResponse` / `SerializableError` / `Api` interfaces. This is NOT scope creep — same file, empty placeholder → real contents in Plan 01-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript 6.x TS18003 on tsconfig.web.json (no input files found)**
- **Found during:** Task 2 (three-tsconfig split typecheck verification)
- **Issue:** `tsconfig.web.json` listed `src/renderer/src/**/*.{ts,tsx}`, `src/preload/index.d.ts`, `src/shared/**/*.ts` in its include list. None of those directories existed yet (renderer + preload arrive in Plan 01-02/01-03). Plan assumed "TS tolerates missing includes as long as at least one file matches overall" — that held under TS 5.x but TS 6.x strict enforcement raises TS18003 and fails the `npm run typecheck` gate.
- **Fix:** Created `src/shared/types.ts` with a module docstring + `export {};`. This is Plan 01-02 Task 1's designated file; seeding it now with an empty body is scope-adjacent (same file, Plan 01-02 fills in the real interfaces) and unblocks the typecheck gate.
- **Files modified:** `src/shared/types.ts` (new file, 14 lines).
- **Verification:** `npm run typecheck` → TC=0 (both node + web). Plan 01-02 Task 1 will replace the placeholder with `SkeletonSummary`, `PeakRecordSerializable`, `LoadResponse`, `SerializableError`, `Api` per RESEARCH §Pattern 1.
- **Committed in:** `17a693a` (Task 2 commit)

**2. [Rule 3 - Blocking] TypeScript 6.0 baseUrl deprecation warning (TS5101) failing typecheck**
- **Found during:** Task 2
- **Issue:** TS 6.0 emits TS5101 error on `baseUrl` usage: "Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0." The `@renderer` path alias requires `baseUrl`, so we can't just drop it. Error fails `tsc --noEmit` exit code.
- **Fix:** Added `"ignoreDeprecations": "6.0"` to `tsconfig.web.json` `compilerOptions` per TypeScript's own `aka.ms/ts6` migration guidance.
- **Files modified:** `tsconfig.web.json`.
- **Verification:** `npm run typecheck:web` now exits 0.
- **Committed in:** `17a693a` (Task 2 commit)

**3. [Rule 3 - Scope-adjacent] `*.tsbuildinfo` artifacts left untracked after Task 2**
- **Found during:** Task 2 post-commit `git status`
- **Issue:** `composite: true` (required for TypeScript project references) causes `tsc` to emit `tsconfig.node.tsbuildinfo` + `tsconfig.web.tsbuildinfo` incremental cache files at the project root. Without a gitignore entry, every `npm run typecheck` would dirty the working tree.
- **Fix:** Added `*.tsbuildinfo` to `.gitignore` in Task 3 (where `.gitignore` was already scheduled for modification to add `out/` and `release/`). Scope-adjacent — same file, same commit.
- **Files modified:** `.gitignore`.
- **Verification:** `git status --short` after typecheck shows no dirty tree.
- **Committed in:** `8bc85a5` (Task 3 commit)

**4. [Rule 1 - Bug] `electron.vite.config.ts` comment literals failed the `! grep -q "@core"` and `! grep -q "externalizeDepsPlugin"` acceptance gates**
- **Found during:** Task 3 acceptance check
- **Issue:** Initial comment block used the exact literals `@core` (in "NO `@core` alias" prose explaining Layer 2) and `externalizeDepsPlugin()` (explaining why we don't need the v4 helper). The plan's acceptance greps are literal `! grep -q "@core"` and `! grep -q "externalizeDepsPlugin"` — they don't distinguish comments from code. The semantic invariant (no runtime use) held, but the grep gate failed.
- **Fix:** Rewrote the two comment passages to preserve meaning while avoiding the bare literal tokens. New wording: "renderer.resolve.alias intentionally omits any entry pointing at src/core" and "we do NOT need the deprecated externalize-deps plugin helper from v4." No code change, just comment rewording.
- **Files modified:** `electron.vite.config.ts`.
- **Verification:** `grep -c "@core" electron.vite.config.ts` → 0; `grep -c "externalizeDepsPlugin" electron.vite.config.ts` → 0. Runtime config body unchanged: `renderer.resolve.alias` still has only `@renderer`; no plugin helpers imported or called.
- **Committed in:** `8bc85a5` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (3 Rule 3 blocking/scope-adjacent, 1 Rule 1 acceptance-gate compliance).
**Impact on plan:** All four deviations are surface adjustments forced by TypeScript 6.x behavior changes (TS18003, TS5101) or literal-grep strictness. Zero scope creep — `src/shared/types.ts` seed is on Plan 01-02's file list already. Plan intent (three-layer defense, pinned versions, electron-vite v5, Tailwind v4 via `@tailwindcss/vite`, `out/` + `release/` gitignored) executed exactly as written.

## Issues Encountered

None beyond the deviations above. The three tasks executed in order; each committed atomically; full verification sweep green:

```
npm run typecheck          → TC=0 (node + web both clean)
npm run test               → 47/47 + 1 skip (Phase 0 invariant holds)
npm run cli -- ...         → CLI=0, CIRCLE/SQUARE/SQUARE2/TRIANGLE rows match
grep '"src/core' tsconfig.web.json → PASS (only in exclude)
! grep '"@core' tsconfig.web.json  → PASS
! grep '@core' electron.vite.config.ts → PASS
grep 'out/' .gitignore     → PASS
grep 'release/' .gitignore → PASS
```

## Self-Check: PASSED

All 9 files verified present on disk:
- tsconfig.json, tsconfig.node.json, tsconfig.web.json, electron.vite.config.ts, src/shared/types.ts, package.json, package-lock.json, .gitignore, .planning/phases/01-electron-react-scaffold/01-01-SUMMARY.md.

All 3 task commits verified in git log:
- 301a072 (Task 1 install)
- 17a693a (Task 2 tsconfig split)
- 8bc85a5 (Task 3 vite config + gitignore)

## User Setup Required

None — all operations are local dev-machine actions (npm install, tsconfig edits, gitignore edits). No external services, no env vars, no dashboards.

## Next Phase Readiness

**Ready for Plan 01-02** (Wave 2): shared IPC types, main-process projection + handler, Electron app entry. Plan 01-02 Task 1 will:
- Replace `src/shared/types.ts` placeholder with the real `SkeletonSummary`, `PeakRecordSerializable`, `LoadResponse`, `SerializableError`, `Api` interfaces.
- Create Wave 0 tests: `tests/core/summary.spec.ts`, `tests/core/ipc.spec.ts`, `tests/arch.spec.ts`.
- `tests/arch.spec.ts` will add Layer 3 of the three-layer defense (renderer↛core grep on the real renderer files once they exist).

**Toolchain in place for all downstream Phase 1 plans:**
- Plan 01-03 can add renderer files; `tsconfig.web.json` will pick them up automatically.
- Plan 01-04 can wire DropZone + DebugPanel; `@renderer` alias resolves correctly.
- Plan 01-05 can add `electron-builder.yml`; `npm run build:dry` + `npm run build` scripts already wired.

**Open items for Plan 01-02:**
- Plan 01-02 Task 1 MUST preserve the `src/shared/types.ts` file path but replace the `export {};` placeholder with the real interface set (D-21, D-22, D-10 shapes). The empty placeholder is semantically compatible with any non-breaking additions — it adds zero export symbols.

## Threat Surface Scan

No new security-relevant surface introduced beyond what the `<threat_model>` block in 01-01-PLAN.md already covers:
- **T-01-01-01 (npm dependency supply-chain, accepted):** mitigated by pinned versions + committed lockfile per plan spec.
- **T-01-01-02 (info disclosure via renderer reaching core, mitigate):** mitigated at Layer 1 (tsconfig.web.json exclude) + Layer 2 (no @core bundler alias). Layer 3 (tests/arch.spec.ts) lands in Plan 01-02.

No `threat_flag` section required.

---
*Phase: 01-electron-react-scaffold*
*Completed: 2026-04-23*

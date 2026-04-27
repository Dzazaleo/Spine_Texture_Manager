---
phase: 01-electron-react-scaffold
plan: 05
status: complete
completed: 2026-04-23
requirements: [N4.1, N4.2, F1.1, F1.2, F1.4]
threats_addressed: [T-01-05-01, T-preload-sandbox]
---

# Plan 01-05 — electron-builder.yml + exit-criteria sweep + human-verify checkpoint

## What shipped

1. **`electron-builder.yml`** — unsigned macOS `.dmg` packaging config.
   - `mac.target: [dmg]` only, no `win:` block (D-02 + D-24 additive-ready for Phase 9).
   - No `afterPack`, `publish`, or `notarize` keys (D-04 unsigned).
   - `files` whitelist ships `out/**` + `package.json` and excludes source, tests, fixtures, scripts, planning docs.
2. **Automated exit-criteria sweep** — `npm run build:dry` exit 0; `npm run build` produces `release/Spine Texture Manager-0.0.0-arm64.dmg` (111 MB, under 200 MB budget).
3. **`01-VALIDATION.md` per-task map populated** — 15 automated rows flipped ⬜ → ✅; frontmatter `status: complete`, `nyquist_compliant: true`, `wave_0_complete: true`, `human_verify_signed_off: 2026-04-23`.
4. **Human-verify checkpoint signed off** — dev drop flow + packaged `.dmg` drop flow both confirmed working end-to-end.

## Commits

| Task | SHA       | Subject |
|------|-----------|---------|
| 01-05-01 | `c4a8994` | `chore(01-05): add electron-builder.yml for unsigned macOS dmg build` |
| 01-05-02 | — (verification-only; build artifacts gitignored) | `build:dry` + full build green |
| 01-05-03 | `eb57386` | `docs(01-05): populate 01-VALIDATION.md per-task map + flip wave_0_complete to true` |
| interim  | `d1e4211` | `docs(01-05): update STATE.md — Plan 01-05 Tasks 1-3 complete, Task 4 pending` |
| **gap-fix** | **`b5d6988`** | **`fix(01-05): emit preload as CJS — sandbox mode cannot load ESM preloads`** |
| 01-05-04 | (final metadata) | `docs(01-05): close Phase 1 — VALIDATION signed off, SUMMARY, STATE, ROADMAP` |

## Gap-fix — human-verify caught a whole-app runtime failure

The human-verify checkpoint justified itself on its first use.

**Symptom.** Dropping `SIMPLE_TEST.json` into `npm run dev` threw:
```
DropZone.tsx:97 Uncaught (in promise) TypeError:
  Cannot read properties of undefined (reading 'loadSkeletonFromFile')
```
The packaged `.dmg` showed the same failure (drop → "Loading…" → never resolves).

**Root cause.** Sandbox mode (`sandbox: true`, pinned per D-06 / T-01-02-03) + ESM preload (`.mjs`) are incompatible. Electron's sandboxed renderer can only load CommonJS preloads; an `.mjs` preload under sandbox silently fails to execute, so `contextBridge.exposeInMainWorld('api', api)` never runs and `window.api` is undefined in the renderer.

**How the bug was introduced.** Plan 01-03's Deviation #2 patched `src/main/index.ts`'s preload path from `.js` → `.mjs` to match electron-vite's default ESM output under `package.json "type": "module"`. That fixed the filename but left a preload format that sandbox cannot load. The correct original fix would have been `.cjs`.

**Why no automated gate caught this.** typecheck, unit tests, arch greps, and `electron-vite build` all passed — the preload compiled and was referenced correctly on disk. The failure only manifests when Electron's sandboxed renderer actually tries to load it at runtime. No test short of running the app + interacting with the DOM would catch it. This is exactly what the human-verify checkpoint exists for.

**Fix (`b5d6988`).**
- `electron.vite.config.ts` — preload block now sets `rollupOptions.output.format: 'cjs'` + `entryFileNames: '[name].cjs'`. Forces CJS emission regardless of package.json type.
- `src/main/index.ts` — preload path `../preload/index.mjs` → `.cjs`.
- `tests/arch.spec.ts` — two new regression guards:
  - `src/main/index.ts` MUST reference `preload/index.cjs` and MUST NOT reference `preload/index.mjs`.
  - `electron.vite.config.ts` MUST contain `format: 'cjs'` and `[name].cjs` in the preload block.
- Rebuilt DMG (still 111 MB) for re-verification. User confirmed dev + packaged flows both work.

## Verification results

| Gate | Result |
|------|--------|
| `npm run typecheck` (both projects) | exit 0 |
| `npm run test` | **57 passed + 1 skipped** (Phase 0 47+1 + summary 3/3 + ipc 3/3 + arch **4/4** — was 2/2 pre-fix) |
| `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` | exit 0 (Phase 0 invariant preserved) |
| `npx electron-vite build` | green; emits `out/preload/index.cjs` (CJS) |
| `npm run build` | `release/Spine Texture Manager-0.0.0-arm64.dmg` 111 MB unsigned |
| Dev drop of SIMPLE_TEST.json | DebugPanel renders CIRCLE/SQUARE/SQUARE2/TRIANGLE; D-17 console echo fires |
| Non-JSON drop (.png) | inline `Unknown: Not a .json file: SIMPLE_TEST.png` — confirmed |
| Recovery after error | drop SIMPLE_TEST.json again → loaded state works |
| `.dmg` open + Gatekeeper bypass + packaged drop | confirmed working after gap-fix |

## Header/footer divergence from CLI — accepted as-is

Plan 01-04's executor flagged three items where the DebugPanel diverges from `scripts/cli.ts` output:

1. **Header block above the table** (skeleton path / atlas path / bone/slot/attachment counts with type breakdown / skins / animations / elapsed) — CLI has no such header. **Status:** user accepted. This is the D-16 two-part layout per CONTEXT.md.
2. **Footer copy:** DebugPanel says `Elapsed: X ms (120 Hz sampling)`; CLI says `Sampled in X ms at Y Hz (N attachments across M skins, K animations)`. **Status:** user accepted. Both legitimate renderings.
3. **Table body byte-for-byte** — confirmed matching: same columns, widths, two-space separator, Unicode `×`, sort key (skin, slot, attachment).

No follow-up work required on these.

## Deviations

One deviation, one gap-fix. Both auto-handled during checkpoint.

| # | Rule | Description | Commit |
|---|------|-------------|--------|
| 1 | Rule 3 blocking (caught at human-verify, not at automated gates) | Sandbox + ESM preload incompatible. Forced preload CJS emission + path update + regression guards. | `b5d6988` |

No header/footer divergence changes — user accepted Plan 01-04's rendering.

## Files touched by this plan

**Created:**
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/electron-builder.yml`
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/.planning/phases/01-electron-react-scaffold/01-05-SUMMARY.md` (this file)

**Modified:**
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/electron.vite.config.ts` (preload → CJS output)
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/main/index.ts` (preload path `.mjs` → `.cjs`)
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/tests/arch.spec.ts` (+2 regression guards)
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/.planning/phases/01-electron-react-scaffold/01-VALIDATION.md` (per-task map + frontmatter flips + 01-05-04 ✅)
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/.planning/STATE.md`
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/.planning/ROADMAP.md`

**Generated (gitignored):**
- `release/Spine Texture Manager-0.0.0-arm64.dmg` (111 MB)
- `release/mac-arm64/Spine Texture Manager.app` (277 MB)

## What this enables

- **Phase 1 COMPLETE.** ROADMAP exit criteria satisfied:
  1. ✅ Dragging `SIMPLE_TEST.json` renders a debug dump matching the CLI (table body byte-for-byte).
  2. ✅ App builds into a `.dmg` on macOS.
- **Phase 2 ready** (Global Max Render Source panel). The renderer's `window.api.loadSkeletonFromFile` + typed `SkeletonSummary` + `PeakRecordSerializable[]` contract is already the right shape for a sortable table panel — Plan 02-01 can start with `src/core/analyzer.ts` folding peaks into the panel data and `src/renderer/panels/GlobalMaxRenderPanel.tsx`.
- **Sandbox + preload regression permanently guarded** via the two new arch.spec tests — any future accidental revert to `.mjs` / `.js` preload path fails CI.

## Lessons for later phases

- **Human-verify checkpoints are load-bearing.** No automated gate (typecheck, unit tests, greps, `electron-vite build`) would have caught the sandbox/ESM-preload incompatibility because it only surfaces when Electron's sandboxed renderer tries to load the preload at runtime. Every subsequent Electron-touching phase should keep a human-verify gate for drop flows, packaged `.app` launches, and any surface that depends on IPC or contextBridge actually executing.
- **Plan 01-03's `.js` → `.mjs` deviation was a symptom-fix, not a root-cause fix.** When a deviation flips a file extension or path format because "the other one didn't exist on disk," treat that as a signal to re-verify the full chain (compile + load + execute), not just to recompile.

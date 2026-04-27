---
phase: 01-electron-react-scaffold
verified: 2026-04-23T13:00:00Z
status: passed
score: 2/2 exit criteria + 6/6 requirements satisfied
verdict: PASS-WITH-NOTES
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
overrides_applied: 2
overrides:
  - must_have: "DebugPanel header/footer byte-for-byte identical to CLI output"
    reason: "Per D-16, DebugPanel layout is intentionally two-part (summary header + table). CLI has no header; Phase 1 explicitly added one. Footer copy ('Elapsed: X ms (120 Hz sampling)' vs CLI's 'Sampled in X ms at Y Hz (...)') is a legitimate rendering variant; user accepted as-is at human-verify. Table body IS byte-for-byte identical — which is what the ROADMAP exit criterion actually requires."
    accepted_by: "leonardo.o.cunha (human-verify 2026-04-23)"
    accepted_at: "2026-04-23T12:45:00Z"
  - must_have: "N4.1 full portability gate (.dmg AND .exe)"
    reason: "ROADMAP Phase 1 explicitly only requires macOS .dmg; full N4.1 cross-platform shipping gate is deferred to Phase 9 per CONTEXT.md <portability> section. Phase 1 N4.1/N4.2 coverage is the 'architecturally-ready-to-add-Windows' subset — verified via zero platform branches / zero macOS chrome."
    accepted_by: "planner (CONTEXT.md D-05, D-24)"
    accepted_at: "2026-04-23T10:10:00Z"
---

# Phase 1: Electron + React scaffold with JSON drop-load — Verification Report

**Phase Goal (ROADMAP):** Drag-drop JSON load renders Phase-0-matching debug dump in an Electron window; app builds to `.dmg` on macOS.
**Verified:** 2026-04-23T13:00Z
**Verifier:** Claude (gsd-verifier) — goal-backward analysis against the actual codebase.
**Summary verdict:** **PASS-WITH-NOTES**.

Both ROADMAP exit criteria proved in code and on disk. All six claimed requirements (F1.1–F1.4, N4.1, N4.2) satisfied at the scope locked by CONTEXT.md. Architectural invariants (three-layer core↛renderer defense, pinned security webPreferences, no platform-specific code, sandbox-CJS-preload regression guards) all live. The "notes" in PASS-WITH-NOTES are accepted-at-human-verify deviations (DebugPanel header + footer copy differ from CLI) that are explicitly permitted by D-16 — the load-bearing ROADMAP contract is the **table body** matching byte-for-byte, and it does.

---

## Exit Criterion 1 — "Dragging SIMPLE_TEST.json into the window renders a debug dump matching the CLI's Phase 0 output"

**Status: VERIFIED (table body byte-for-byte; header + footer intentional D-16 divergence accepted).**

### End-to-end drop flow — file-by-file evidence

| Layer | File | Evidence | Status |
| ----- | ---- | -------- | ------ |
| Drop target | `src/renderer/src/components/DropZone.tsx:75–99` | `e.dataTransfer.files[0]` → `.json` guard → `window.api.loadSkeletonFromFile(file)` (passes raw `File`, not `file.path`) | ✓ |
| Preload path resolution | `src/preload/index.ts:29, 34, 49` | Imports `webUtils` from `electron`; `webUtils.getPathForFile(file)` resolves absolute path; `ipcRenderer.invoke('skeleton:load', jsonPath)` | ✓ |
| contextBridge surface | `src/preload/index.ts:53–55` | `contextBridge.exposeInMainWorld('api', api)` under `process.contextIsolated` | ✓ |
| IPC handler | `src/main/ipc.ts:42–77, 79–81` | `handleSkeletonLoad(jsonPath: unknown)` + `registerIpcHandlers()` → `ipcMain.handle('skeleton:load', ...)` | ✓ |
| Pure projection | `src/main/summary.ts:26–99` | `buildSummary(load, peaks, elapsedMs)` returns structuredClone-safe `SkeletonSummary` | ✓ |
| Shared contract | `src/shared/types.ts:24–103` | `PeakRecordSerializable`, `SkeletonSummary`, `LoadResponse`, `SerializableError`, `Api` defined | ✓ |
| Preload loads at runtime | `src/main/index.ts:42` | `preload: join(__dirname, '../preload/index.cjs')` — sandbox-compatible CJS preload (gap-fix `b5d6988`) | ✓ |
| Renderer branches | `src/renderer/src/App.tsx:28–32, 57–82` | All 4 AppState variants (idle/loading/loaded/error) rendered | ✓ |
| D-17 console echo | `src/renderer/src/App.tsx:49–55` | `useEffect(() => { if (state.status === 'loaded') console.log(...) }, [state])` | ✓ |
| Debug table body | `src/renderer/src/components/DebugPanel.tsx:42–88` | Headers `['Attachment', 'Skin', 'Source W×H', 'Peak W×H', 'Scale', 'Source Animation', 'Frame']` with Unicode `×` (U+00D7), two-space separator, `pad()`, `toFixed(1)/(3)` — **byte-for-byte port of `scripts/cli.ts:77–126` minus the sort step (since `buildSummary` pre-sorts per D-16)** | ✓ |

### Sort key equivalence (locks byte-for-byte alignment)

- **CLI** (`scripts/cli.ts:88–92`): sorts peaks by `(skinName, slotName, attachmentName)` via `localeCompare` chain.
- **DebugPanel consumes `summary.peaks`** (already sorted by `buildSummary`).
- **`buildSummary`** (`src/main/summary.ts:73–77`) sorts with the identical `(skinName, slotName, attachmentName)` `localeCompare` chain.
- **Wave 0 test** `tests/core/summary.spec.ts` locks this into CI (D-16).

### Dev + packaged drop flow (gap-fix `b5d6988`)

Human-verify checkpoint on 2026-04-23 confirmed:
1. `npm run dev` → drop `SIMPLE_TEST.json` → DebugPanel renders CIRCLE/SQUARE/SQUARE2/TRIANGLE rows.
2. DevTools console shows D-17 echo (`[Spine Texture Manager] Loaded skeleton summary: {...}`).
3. Non-JSON (`.png`) drop → inline `Unknown: Not a .json file` error (muted-orange).
4. Missing-atlas JSON drop → `AtlasNotFoundError` inline.
5. Packaged `.dmg` (after Gatekeeper bypass) drops identically.

**Intentional divergences from CLI (per D-16, user-accepted at human-verify):**
- DebugPanel renders a **header block** above the table (skeleton path, atlas path, bone/slot/attachment counts with `byType` breakdown, skins, animations, elapsed). CLI has no such header — this is the D-16 two-part layout explicitly defined in CONTEXT.md.
- Footer copy differs: DebugPanel `Elapsed: X ms (120 Hz sampling)`; CLI `Sampled in X ms at Y Hz (N attachments across M skins, K animations)`. Both legitimate renderings of the same underlying data.
- **Table body rows + headers are byte-for-byte identical** — which is the load-bearing ROADMAP contract.

---

## Exit Criterion 2 — "App builds into a .dmg on macOS"

**Status: VERIFIED.**

| Artifact | Evidence | Status |
| -------- | -------- | ------ |
| `electron-builder.yml` | Lines 1–45 present; `mac.target: [dmg]` (lines 38–41); no `win:` block; no `afterPack`/`publish`/`notarize` keys (D-04 unsigned); `files` whitelist ships `out/**` + `package.json`, excludes `src/tests/fixtures/scripts/.planning/temp` | ✓ |
| Build scripts | `package.json:17–18` — `build: "electron-vite build && electron-builder --mac dmg"`; `build:dry: "electron-vite build && electron-builder --mac dmg --dir"` | ✓ |
| Real `.dmg` on disk | `release/Spine Texture Manager-0.0.0-arm64.dmg` — 111.2 MB (116,628,324 bytes), well under 200 MB budget | ✓ |
| Packaged-app bundle | `release/mac-arm64/Spine Texture Manager.app` directory present | ✓ |
| Build output tree | `out/main/index.js` (16 kB), `out/preload/index.cjs` (678 B), `out/renderer/index.html` + `assets/` all present | ✓ |

---

## Per-Requirement Coverage

| ID | Description | Source Plans | Evidence | Status |
| -- | ----------- | ------------ | -------- | ------ |
| **F1.1** | Load Spine 4.2+ skeleton JSON via `SkeletonJson.readSkeletonData` | 01-02, 01-03, 01-04 | `src/main/ipc.ts:28, 56` imports + invokes `loadSkeleton` from `src/core/loader.ts` (Phase 0); full end-to-end path wired via DropZone → preload → IPC → main → core | ✓ SATISFIED |
| **F1.2** | Auto-detect companion `.atlas` (and regions produced with dims + provenance) | 01-02, 01-04 | `src/core/loader.ts` auto-discovers sibling `.atlas`; `SourceDims.source: 'atlas-orig' \| 'atlas-bounds'` provenance preserved in `src/core/types.ts`; surfaced through `PeakRecordSerializable.sourceW/sourceH` in `src/shared/types.ts:41–43` | ✓ SATISFIED |
| **F1.3** | Stub `TextureLoader` so PNG decoding not required | (Phase 0 — 00-02) | `src/core/loader.ts:56` `StubTexture extends Texture`; never decodes pixels; Phase 1 inherits unchanged | ✓ SATISFIED (inherited) |
| **F1.4** | Surface clear error when atlas/images unavailable (+ typed-error IPC round-trip) | 01-02, 01-03, 01-04 | Typed-error envelope `SerializableError.kind: 'SkeletonJsonNotFoundError' \| 'AtlasNotFoundError' \| 'AtlasParseError' \| 'Unknown'` in `src/shared/types.ts:81`; byte-for-byte matches `SpineLoaderError` subclass `.name` fields in `src/core/errors.ts:16, 24, 35, 44`; renderer displays typed error via `src/renderer/src/App.tsx:70–80` (`text-accent-muted`); locked into CI via `tests/core/ipc.spec.ts:38–65` | ✓ SATISFIED |
| **N4.1** | Portability — ships as `.dmg` (macOS) + `.exe` (Windows) at minimum | 01-01, 01-05 | Phase 1 scope = macOS `.dmg` only (per ROADMAP + D-05 + D-24); Windows `.exe` deferred to Phase 9. **Phase-1 subset fully satisfied:** `.dmg` built (111 MB on disk); architecture structurally ready for additive `win:` block (see N4.2). See override entry above | ✓ SATISFIED (scoped subset; full gate is Phase 9) |
| **N4.2** | No native compilation required for end users beyond Electron + sharp | 01-01, 01-02, 01-03 | Zero platform branches (`tests/arch.spec.ts:36–49` grep gate passes); zero macOS-only BrowserWindow chrome (`titleBarStyle 'hiddenInset'`, `trafficLightPosition`, `vibrancy`, `visualEffectState` all absent); `src/core/*` uses only `node:fs`/`node:path`; `src/main/index.ts` uses only cross-platform Electron APIs | ✓ SATISFIED |

**No orphaned requirements.** REQUIREMENTS.md maps F1.1/F1.2/F1.3/F1.4/N4.1/N4.2 to Phase 1 scope; all appear in plan frontmatter and all are satisfied.

---

## Architectural Invariants

### Three-layer core↛renderer defense (CLAUDE.md Fact #5)

| Layer | Mechanism | Evidence | Status |
| ----- | --------- | -------- | ------ |
| **Layer 1** | `tsconfig.web.json` excludes `src/core/**` | `"exclude": ["node_modules", "dist", "out", "release", "temp", "coverage", "src/core/**"]` | ✓ LIVE |
| **Layer 2** | `electron.vite.config.ts` has no `@core` alias in `renderer.resolve.alias` | `renderer.resolve.alias: { '@renderer': ... }` only; grep `@core electron.vite.config.ts` → 0 matches | ✓ LIVE |
| **Layer 3** | `tests/arch.spec.ts` grep test runs on every `npm run test` | `tests/arch.spec.ts:20–33` globs `src/renderer/**/*.{ts,tsx}` and fails on any `from '...core/' \| from '@core'` match; currently: zero offenders across 2 component files + App.tsx + main.tsx | ✓ LIVE |

### Security pins (T-01-02-03)

All three pinned explicitly in `src/main/index.ts:45–47`:

```ts
contextIsolation: true,
nodeIntegration: false,
sandbox: true,
```

### No err.stack leakage (T-01-02-01 / T-01-02-02)

`src/main/ipc.ts` grep for literal `err.stack` → 0 matches. Ipc test `tests/core/ipc.spec.ts:46–47` asserts `error.message` contains neither `'at '` nor `'.ts:'` (stack-trace markers). Locked in CI.

### Sandbox + preload-CJS regression guards (new in gap-fix `b5d6988`)

`tests/arch.spec.ts:51–63` — two new tests:

1. `src/main/index.ts` MUST reference `preload/index.cjs` (verified: line 42 does) AND MUST NOT reference `preload/index.mjs` (verified: absent).
2. `electron.vite.config.ts` MUST contain `format: 'cjs'` (verified: line 41) AND `[name].cjs` (verified: line 42).

These guards permanently prevent the Plan 01-03→Plan 01-05 regression from returning silently.

### Zero platform-specific code (D-23, D-27)

`tests/arch.spec.ts:36–49` greps `src/{main,preload,renderer}/` for forbidden tokens (`process.platform`, `os.platform()`, `titleBarStyle: 'hiddenInset'`, `trafficLightPosition`, `vibrancy:`, `visualEffectState`) → 0 offenders. Windows enablement is a config-only diff when Phase 9 needs it.

---

## Live Automated Gate Outputs (2026-04-23T13:00Z, verifier-run)

| Gate | Command | Result | Expected | Status |
| ---- | ------- | ------ | -------- | ------ |
| Typecheck (both projects) | `npm run typecheck` | exit 0 (node + web both clean) | exit 0 | ✓ PASS |
| Vitest | `npm run test` | **57 passed + 1 skipped** (6 test files, 431 ms) | 57 + 1 skip | ✓ PASS |
| CLI smoke | `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` | exit 0, 22.4 ms, CIRCLE/SQUARE/SQUARE2/TRIANGLE rows | exit 0 | ✓ PASS |
| Preload.cjs on disk | `ls out/preload/index.cjs` | 678 B, present | present | ✓ PASS |
| Preload path in main | `grep "preload/index.cjs" src/main/index.ts` | 1 match (line 42) | 1 match | ✓ PASS |
| No .mjs preload reference | `! grep "preload/index.mjs" src/main/index.ts` | 0 matches | 0 matches | ✓ PASS |
| Preload CJS in vite config | `grep "format: 'cjs'" electron.vite.config.ts` | 1 match; `[name].cjs` also present | 2 matches | ✓ PASS |
| `.dmg` on disk | `ls release/*.dmg` | 116 MB unsigned arm64 dmg | present | ✓ PASS |
| Three security pins | `grep -E "contextIsolation\|nodeIntegration\|sandbox" src/main/index.ts` | all three `true` / `false` as specified | 3 matches | ✓ PASS |

Test suite breakdown (inferred from previous runs + current pass count):
- Phase 0: 47 passed + 1 skipped (bounds / sampler / loader / core invariants)
- Phase 1 Wave 0: summary.spec 3/3 + ipc.spec 3/3 + arch.spec **4/4** (was 2/2 pre-gap-fix; sandbox-CJS guards added 2 more)
- Total: 57 + 1 skip ✓

---

## Gap-Fix Assessment (`b5d6988`)

**Bug:** Plan 01-03 patched preload filename `.js` → `.mjs` to match electron-vite's ESM output under `package.json "type": "module"`. Typecheck, tests, arch greps, and `electron-vite build` all passed. But sandbox mode (`sandbox: true`, D-06/T-01-02-03) **cannot load ESM preloads** — Electron's sandboxed renderer can only execute CommonJS preloads. Under sandbox, an `.mjs` preload silently fails to load, so `contextBridge.exposeInMainWorld('api', api)` never fires and `window.api` is `undefined`. The drop flow threw `TypeError: Cannot read properties of undefined (reading 'loadSkeletonFromFile')` in both `npm run dev` and the packaged `.dmg`.

**Why no automated gate caught it:** The failure only surfaces at Electron's runtime preload-load step inside a sandboxed renderer — no type system, test runner, or bundler simulates that. The human-verify checkpoint caught it first-try.

**Fix (commit `b5d6988`):**
1. `electron.vite.config.ts` preload block adds `rollupOptions.output.format: 'cjs'` + `entryFileNames: '[name].cjs'` — forces CJS regardless of package.json `type`.
2. `src/main/index.ts:42` path `../preload/index.mjs` → `.cjs`.
3. `tests/arch.spec.ts:51–63` adds two regression guards matching the filename + format literals.

**Remediation quality: EXCELLENT.** The fix is minimal (one config addition, one path update), the regression guards are both necessary and sufficient (they match the exact tokens that got it wrong last time + the config mechanism that produces them), and the lesson is documented in STATE.md + 01-05-SUMMARY.md for future Electron phases.

**Regression guard sufficiency:** Strong — the guards fail CI on any accidental revert to `.mjs`/`.js`. But they don't catch the broader class ("sandbox + any non-CJS preload") — e.g., a future hypothetical `.js` default under a non-ESM package.json could regress silently. Mitigation: the tests pin the observed-good shape (`.cjs` + `format: 'cjs'`) which is the canonical Electron-sandbox pattern. Good enough for Phase 1.

---

## Open Risks / Deferrals

1. **DebugPanel header block + footer copy differ from CLI** (user-accepted at human-verify 2026-04-23). Per D-16 this is intentional: DebugPanel is a two-part layout (header + table), CLI is table-only. Footer variant `Elapsed: X ms (120 Hz sampling)` vs `Sampled in X ms at Y Hz (...)` is surface prose — both legitimate. Override entry carried in frontmatter. **No follow-up.**

2. **N4.1 full cross-platform (`.exe`) deferred to Phase 9.** ROADMAP + CONTEXT.md D-05 + D-24 both lock Phase 1 to `.dmg` only. The codebase is architecturally ready — adding `win: { target: [nsis] }` to `electron-builder.yml` is a pure additive change (verified: zero `process.platform` branches, zero macOS-only chrome). Override entry carried in frontmatter.

3. **CSP still has `'unsafe-inline'` for `style-src`** (`src/renderer/index.html:7`). Plan 01-03 flagged this for Plan 01-05 to tighten after confirming built HTML has zero inline `<style>`/`style=`. Plan 01-05 did not land the tightening. **Low-risk**, but a genuine loose-end — Phase 2 or a Phase-1 patch could drop `'unsafe-inline'` from `style-src`. Not a Phase 1 blocker; logged here for Phase 2 planning awareness.

4. **Drag-leave child-entry flicker** (Plan 01-04 open item): on some OSes `dragLeave` fires when the drag cursor crosses into a child element, leaving the hover ring state stuck. Canonical fix is a drag-counter pattern. Not observed in human-verify; deferred until surfaced.

5. **Unsigned `.dmg`** — requires Gatekeeper bypass (right-click → Open). Per D-04, signing + notarization are post-MVP. Phase 9 concern.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| CLI parses + samples fixture | `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` | exit 0, 4 rows, 22.4 ms | ✓ PASS |
| Typecheck both projects | `npm run typecheck` | exit 0 | ✓ PASS |
| Test suite green | `npm run test` | 57 + 1 skip | ✓ PASS |
| Build output tree complete | `ls out/main/index.js out/preload/index.cjs out/renderer/index.html` | all present | ✓ PASS |
| Packaged DMG on disk | `ls release/*.dmg` | 111 MB | ✓ PASS |
| Dev drop of SIMPLE_TEST.json | human-verify 2026-04-23 | renders CIRCLE/SQUARE/SQUARE2/TRIANGLE | ✓ PASS (documented in 01-05-SUMMARY.md) |
| Packaged .dmg launch + drop | human-verify 2026-04-23 | launches after Gatekeeper bypass; drop works | ✓ PASS (documented in 01-05-SUMMARY.md) |

All behavioral spot-checks pass. The two human-verify items (drop in dev, drop in packaged `.dmg`) were exercised in Plan 01-05 and are documented at `01-05-SUMMARY.md:64–71`. Phase 1 does not need re-running them — the gap-fix `b5d6988` was the last change and human-verify signed off after it.

---

## Human Verification Required

**None remaining for Phase 1.** All manual gates from VALIDATION.md §Manual-Only Verifications (3 items) were exercised and signed off on 2026-04-23 after the `b5d6988` gap-fix. The `human_verify_signed_off: 2026-04-23` frontmatter in VALIDATION.md records the acceptance.

---

## Gaps Summary

**No blocking gaps.** Two intentional deviations accepted via override entries (DebugPanel header/footer divergence; N4.1 Phase-9 deferral). Three low-risk open items carried forward as non-blocking (CSP `'unsafe-inline'` tightening, drag-leave flicker watch, unsigned DMG). Phase 1 is code-complete, ships a working `.dmg`, and closes all six claimed requirement IDs at the scope locked by CONTEXT.md.

---

## Final Verdict

**PASS-WITH-NOTES.** Phase 1 achieves both ROADMAP exit criteria in the codebase:

1. ✓ Dropping `SIMPLE_TEST.json` renders a debug dump whose **table body matches the CLI byte-for-byte** (header + footer variants are intentional D-16 layout choices — accepted at human-verify).
2. ✓ App builds into `release/Spine Texture Manager-0.0.0-arm64.dmg` on macOS (111 MB unsigned, per D-04).

All six claimed requirements (F1.1–F1.4, N4.1 scoped subset, N4.2) satisfied. Three-layer core↛renderer defense fully live. Sandbox-preload-CJS regression permanently guarded via two new `tests/arch.spec.ts` tests. Live automated gates all green: typecheck exit 0 on both projects, 57 passed + 1 skipped in vitest, CLI exit 0 at 22.4 ms on the fixture.

**Ready to proceed to Phase 2 (Global Max Render Source panel — F3 coverage).**

---

*Verified: 2026-04-23T13:00Z*
*Verifier: Claude (gsd-verifier)*

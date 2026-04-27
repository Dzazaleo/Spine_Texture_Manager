---
phase: 01-electron-react-scaffold
plan: 02
subsystem: ipc
tags: [electron, ipc, contextbridge, structured-clone, typed-errors, wave0, arch-boundary, three-layer-defense, tdd-red-green]

# Dependency graph
requires:
  - phase: 01-electron-react-scaffold
    provides: Plan 01-01 — electron-vite 5 + electron 41 + three-tsconfig split + src/shared/types.ts placeholder
  - phase: 00-core-math-spike
    provides: src/core/{loader,sampler,bounds,errors,types}.ts — consumed by src/main/{ipc,summary}.ts
provides:
  - src/shared/types.ts — IPC contract (SkeletonSummary, PeakRecordSerializable, LoadResponse, SerializableError, Api)
  - src/main/summary.ts — pure buildSummary(load, peaks, elapsedMs) projection; structuredClone-safe output
  - src/main/ipc.ts — handleSkeletonLoad(jsonPath) + registerIpcHandlers(); typed-error envelope with no stack leakage
  - src/main/index.ts — Electron app lifecycle + BrowserWindow with pinned security webPreferences; HMR branch; DevTools dev-only
  - tests/core/summary.spec.ts — Wave 0 spec locking D-21 shape + D-22 structuredClone + D-16 sort order (3/3 green)
  - tests/core/ipc.spec.ts — Wave 0 spec locking F1-integrated happy + D-10 typed-error envelope + T-01-02-02 no-stack (3/3 green)
  - tests/arch.spec.ts — Wave 0 Layer 3 architectural guard; renderer↛core grep + D-23 portability grep (2/2 green)
affects: [01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union IPC envelope: `{ ok: true, summary } | { ok: false, error: { kind, message } }`. kind literal union byte-for-byte matches SpineLoaderError.name. Unknown fallback via KNOWN_KINDS guard."
    - "Pure-projection main-process service (buildSummary): LoadResult + Map<string, PeakRecord> + elapsedMs → plain-JSON SkeletonSummary. No IO, no console, no side effects. Output survives structuredClone (verified in spec)."
    - "Three-layer core/↛renderer/ defense now FULLY ACTIVE: Layer 1 (tsconfig.web.json exclude — from 01-01), Layer 2 (electron.vite.config.ts no @core alias — from 01-01), Layer 3 (tests/arch.spec.ts grep — NEW this plan)."
    - "D-23 portability grep as a code-review gate: arch.spec.ts re-scans src/{main,preload,renderer} on every test run for process.platform / os.platform() / macOS-only BrowserWindow chrome. Matches fail the test; documentation comments must describe the invariant without the literal tokens."
    - "TDD RED→GREEN atomic commit pattern: Task 1 commits with tests referencing non-existent modules (expected to fail); Task 2 implements the modules in a separate commit that turns them green. Phase 0 invariants re-checked at every commit."

key-files:
  created:
    - src/main/index.ts
    - src/main/summary.ts
    - src/main/ipc.ts
    - tests/core/summary.spec.ts
    - tests/core/ipc.spec.ts
    - tests/arch.spec.ts
  modified:
    - src/shared/types.ts

key-decisions:
  - "StringMap<Attachment> from spine-core is a plain indexed object ({[k:string]:T}), NOT a JS Map — Object.values is the correct iteration. The plan's `for (const [,a] of map)` snippet fails TS2488; fixed at implementation time."
  - "SIMPLE_TEST fixture actually contains 12 bones (root, CTRL, CHAIN_2..CHAIN_8, SQUARE, CTRL_PATH, SQUARE2); the plan documented 9. Ground-truth assertion matches the JSON, not the plan."
  - "T-01-02-02 grep-literal compliance: documentation comments describing 'we do not leak err.stack' triggered the `! grep -q \"err.stack\"` acceptance gate. Rewrote comments to describe the invariant without the exact token — same pattern as 01-01 Deviation #4."
  - "D-23 grep-literal compliance: documentation comments enumerating forbidden macOS chrome tokens (titleBarStyle 'hiddenInset', vibrancy, visualEffectState, trafficLightPosition) triggered the arch.spec.ts portability regex even though they were documenting what is NOT used. Rewrote comments to describe the invariant in prose."
  - "handleSkeletonLoad accepts `jsonPath: unknown` and validates at the trust boundary (T-01-02-01) — renderer-origin data crosses a trust boundary; typeof string + length > 0 + endsWith('.json') prevents pathological inputs from reaching fs.readFileSync without implying filesystem-level authorization (single-user local tool)."

patterns-established:
  - "Atomic commit scope `01-02` for Phase 1 Plan 02 work: test(01-02), feat(01-02). Matches 01-01 convention (chore(01-01)/build(01-01))."
  - "Wave 0 RED→GREEN TDD ordering: test commit first with non-existent module references, implementation commit second. Each commit's `npm run test` output is evidence the cycle moved in the right direction."
  - "buildSummary field enumeration is explicit (no `...rec` spread) — enumerating every PeakRecordSerializable field by hand ensures structuredClone safety by construction, not by negative test."

requirements-completed: []

# Metrics
duration: 6min 22s
completed: 2026-04-23
---

# Phase 01 Plan 02: Main-process IPC + Wave 0 tests Summary

**Shared IPC contract + pure buildSummary projection + typed-error IPC handler + Electron app entry with pinned security webPreferences; Wave 0 tests lock D-21/D-22/D-16/D-10/D-23 invariants into CI.**

## Performance

- **Duration:** ~6 min 22 s
- **Started:** 2026-04-23T10:34:49Z
- **Completed:** 2026-04-23T10:41:11Z
- **Tasks:** 3
- **Files created:** 6 (src/main/index.ts, src/main/summary.ts, src/main/ipc.ts, tests/core/summary.spec.ts, tests/core/ipc.spec.ts, tests/arch.spec.ts)
- **Files modified:** 1 (src/shared/types.ts — placeholder replaced with full IPC contract)

## Accomplishments

- Replaced the `src/shared/types.ts` placeholder from Plan 01-01 with the full IPC contract: `PeakRecordSerializable` (15 fields, all primitives), `SkeletonSummary` (D-21 shape), `LoadResponse` (discriminated union), `SerializableError` (D-10 typed-error envelope with kind literals matching `SpineLoaderError` subclass names byte-for-byte), and `Api` interface (D-07).
- Implemented `buildSummary(load, peaks, elapsedMs)` as a pure, structuredClone-safe projection. Walks `skin.attachments` (StringMap<Attachment>[], per spine-core `Utils.d.ts`) via `Object.values` to count + bucket by `attachment.constructor.name`. Sorts peaks by `(skinName, slotName, attachmentName)` matching `scripts/cli.ts` byte-for-byte.
- Implemented `handleSkeletonLoad(jsonPath)` as an Electron-independent async function with input validation (T-01-02-01) and typed-error envelope (D-10 / T-01-02-02). Unknown errors fall through to `{kind: 'Unknown', message: err.message}` without leaking trace fields. `registerIpcHandlers()` wires the function into `ipcMain.handle('skeleton:load', ...)`.
- Created `src/main/index.ts` — Electron app entry with BrowserWindow configured at `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` (D-06 / T-01-02-03). HMR branch uses `process.env.ELECTRON_RENDERER_URL` in dev (Pitfall 7); packaged apps load `out/renderer/index.html`. DevTools opened only when `!app.isPackaged`. Zero platform branching; zero macOS-only BrowserWindow chrome (D-23 / D-27).
- Created three Wave 0 test files that now lock the IPC serialization contract, IPC error envelope, and core-boundary/portability invariants into CI. Three-layer `core/↛renderer/` defense is now FULLY ACTIVE with Layer 3 online.
- TDD RED→GREEN discipline held: Task 1 committed failing tests referencing non-existent modules; Task 2 committed the implementations that turned them green. Phase 0 invariants (47+1 skip + CLI exit 0) preserved at every commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared types + Wave 0 test shells (RED)** — `027869e` (test)
2. **Task 2: main/summary.ts + main/ipc.ts (GREEN)** — `c1ea9e9` (feat)
3. **Task 3: main/index.ts Electron app entry** — `d27c143` (feat)

**Plan metadata:** to follow (docs: complete plan)

## Files Created/Modified

### Created

- `src/main/summary.ts` — pure `buildSummary(load, peaks, elapsedMs): SkeletonSummary` projection. No IO, no electron import, no node:* filesystem imports. Peaks are sorted by (skinName, slotName, attachmentName) matching `cli.ts`; attachment count + `byType` bucket built by walking `skeletonData.skins[].attachments` via `Object.values`.
- `src/main/ipc.ts` — exports `handleSkeletonLoad(jsonPath: unknown): Promise<LoadResponse>` (testable without Electron) + `registerIpcHandlers()` (wires into `ipcMain.handle`). Input validation at trust boundary; KNOWN_KINDS guard for unknown error fallback; never emits stack traces.
- `src/main/index.ts` — Electron app lifecycle. Creates one BrowserWindow (1280×800, autoHideMenuBar) with pinned security webPreferences and no macOS-specific chrome. Registers IPC handlers on `app.whenReady()`. HMR branch via `ELECTRON_RENDERER_URL` env var; DevTools only when `!app.isPackaged`; `window-all-closed` → `app.quit()` on all platforms.
- `tests/core/summary.spec.ts` — 3 tests: D-22 structuredClone round-trip, D-21 shape population, D-16 sort order.
- `tests/core/ipc.spec.ts` — 3 tests: F1-integrated happy path, D-10 bogus-path envelope, D-10 missing-atlas envelope (with T-01-02-02 no-stack-marker assertions).
- `tests/arch.spec.ts` — 2 tests: renderer↛core import grep (Layer 3) + D-23 portability grep across src/{main,preload,renderer}.

### Modified

- `src/shared/types.ts` — placeholder `export {};` replaced with the full IPC contract (5 exported types: `PeakRecordSerializable`, `SkeletonSummary`, `SerializableError`, `LoadResponse`, `Api`). Zero runtime code — pure type module per Phase 0 convention.

## Decisions Made

- **StringMap<Attachment> is an indexed-object, not a JS Map.** spine-core's `Utils.d.ts` declares `StringMap<T> = { [k: string]: T }`. The plan's `for (const [,a] of map)` snippet fails TS2488 (no `[Symbol.iterator]`). Correct iteration is `Object.values(attachmentsPerSlot)`.
- **Fixture ground truth beats plan text for counts.** Plan 01-02 asserted `bones.count === 9` but the SIMPLE_TEST JSON actually contains 12 bones (`root, CTRL, CHAIN_2..CHAIN_8, SQUARE, CTRL_PATH, SQUARE2`). Tests assert the actual count; a Rule 1 deviation with explanatory comment.
- **Grep-literal compliance over descriptive comments for invariants.** Both the `! grep -q "err.stack"` gate and the D-23 portability regex in arch.spec.ts match literal tokens inside comments — even when the comment is documenting that the token is NOT used. Comments were rewritten to describe the invariant in prose. This is the same pattern as Plan 01-01 Deviation #4.
- **`handleSkeletonLoad` accepts `unknown` and validates at entry.** Renderer-origin data crosses a trust boundary. Validation is `typeof === 'string' && length > 0 && endsWith('.json')` — cheap, low-false-positive, prevents argument-shape confusion. Does NOT prevent path traversal (single-user local tool; user drag-drops their own files per RESEARCH Security Domain).
- **Unknown fallback via KNOWN_KINDS guard, not `as` cast.** A future `SpineLoaderError` subclass with an unrecognized `.name` falls through to `{kind: 'Unknown'}` rather than crossing the IPC boundary as a kind the renderer cannot discriminate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `StringMap<Attachment>` is not iterable with `for...of` destructuring**
- **Found during:** Task 2 (first `npm run typecheck`).
- **Issue:** Plan 01-02 action step A for `summary.ts` included `for (const [, attachment] of attachmentsPerSlot)`, inherited from RESEARCH Pattern 2. TS 6.x reports `TS2488: Type 'StringMap<Attachment>' must have a '[Symbol.iterator]()' method`. Looking at `node_modules/@esotericsoftware/spine-core/dist/Utils.d.ts:31` clarifies: `StringMap<T>` is `{ [key: string]: T }` — a plain indexed object, not a `Map`.
- **Fix:** Changed iteration to `for (const attachment of Object.values(attachmentsPerSlot))` plus a null-guard for sparse-array entries (some slots may have no attachments). Logic identical; shape correct.
- **Files modified:** `src/main/summary.ts` (initial write).
- **Verification:** `npm run typecheck` clean.
- **Committed in:** `c1ea9e9` (Task 2).

**2. [Rule 1 - Bug] SIMPLE_TEST fixture has 12 bones, not 9**
- **Found during:** Task 2 (first `npm run test`).
- **Issue:** Plan 01-02 asserted `expect(s.bones.count).toBe(9)` and `expect(resp.summary.bones.count).toBe(9)`. Actual fixture bone list is `root, CTRL, CHAIN_2, CHAIN_3, CHAIN_4, CHAIN_5, CHAIN_6, CHAIN_7, CHAIN_8, SQUARE, CTRL_PATH, SQUARE2` = 12. Plan likely counted only CHAIN bones.
- **Fix:** Updated both `expect().toBe(9)` assertions (and the adjacent `bones.names.length` check) to `12`, with an explanatory comment citing the fixture's authoritative bone list.
- **Files modified:** `tests/core/summary.spec.ts`, `tests/core/ipc.spec.ts`.
- **Verification:** `npm run test` 55 passed + 1 skipped (summary 3/3, ipc 3/3, arch 2/2, Phase 0 47 + 1 skip).
- **Committed in:** `c1ea9e9` (Task 2).

**3. [Rule 1 - Grep compliance] `err.stack` comment trips `! grep -q "err.stack"` gate**
- **Found during:** Task 2 acceptance verification.
- **Issue:** Initial `src/main/ipc.ts` docstring read: `"Unknown errors fall through to kind: 'Unknown' with err.message (never err.stack — T-01-02-02 information-disclosure mitigation)"`. The literal `err.stack` appeared in the comment documenting the invariant. Plan's acceptance gate `! grep -q "err\.stack" src/main/ipc.ts` does not distinguish comments from code.
- **Fix:** Rewrote the docstring passage to describe the invariant in prose: `"we deliberately surface only name + message; stack-trace fields are never included (T-01-02-02 information-disclosure mitigation)"`. Same semantic; no literal token. The inline comment `// T-01-02-02: surface only name + message; never stack` was also reworded to avoid the `.stack` literal.
- **Files modified:** `src/main/ipc.ts`.
- **Verification:** `! grep -q "err\.stack" src/main/ipc.ts` passes.
- **Committed in:** `c1ea9e9` (Task 2). Same pattern as 01-01 Deviation #4.

**4. [Rule 1 - Grep compliance] D-23 portability regex matches documentation literals**
- **Found during:** Task 3 acceptance verification (`npm run test` after writing `src/main/index.ts`).
- **Issue:** Initial docstring enumerated the forbidden macOS chrome tokens (`titleBarStyle: 'hiddenInset'`, `trafficLightPosition`, `vibrancy`, `visualEffectState`) while explaining that they are NOT set. The arch.spec.ts portability regex `process\.platform|os\.platform\(\)|titleBarStyle:\s*['"]hiddenInset['"]|trafficLightPosition|vibrancy:|visualEffectState` matched those literals inside the comment, reporting `src/main/index.ts` as an offender.
- **Fix:** Rewrote the docstring to describe the invariant in prose: `"no macOS-only chrome options on the BrowserWindow (hidden-inset title bar, traffic-light positioning, blur/vibrancy, visual-effect tuning) are set"`. The portability regex no longer matches.
- **Files modified:** `src/main/index.ts`.
- **Verification:** `npm run test` — arch.spec.ts 2/2 green.
- **Committed in:** `d27c143` (Task 3). Same pattern as Deviation #3 and 01-01 Deviation #4.

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bugs — TS-type / fixture-count — and 2 Rule 1 grep-literal compliance rewordings). Zero Rule 2, zero Rule 3, zero Rule 4. All four have the same character: planner snippets or acceptance gates assumed behavior that disagreed with actual code/test-harness semantics; executor adapted to ground truth.

**Impact on plan:** The plan's three-task structure, Wave 0 ordering, atomic commits, and key invariants executed exactly as written. Deviation #1 and #2 adjusted implementation/test details to match spine-core and the fixture; #3 and #4 are now an established grep-compliance idiom that future Phase 1 plans should consider when citing forbidden tokens in documentation.

## Issues Encountered

None beyond the deviations above. All three tasks executed in order; each committed atomically with proper TDD RED→GREEN cycle; full verification sweep green at every commit.

## Self-Check: PASSED

All 6 files verified present on disk via `test -f`:
- `src/shared/types.ts` (modified — full IPC contract, 100 lines)
- `src/main/summary.ts` (new — 96 lines)
- `src/main/ipc.ts` (new — 82 lines)
- `src/main/index.ts` (new — 81 lines)
- `tests/core/summary.spec.ts` (new — 62 lines)
- `tests/core/ipc.spec.ts` (new — 63 lines)
- `tests/arch.spec.ts` (new — 50 lines)

All 3 task commits verified in git log:
- `027869e test(01-02): add Wave 0 test shells for summary, ipc, arch — RED`
- `c1ea9e9 feat(01-02): implement main/summary.ts + main/ipc.ts — Wave 0 tests GREEN`
- `d27c143 feat(01-02): electron main-process entry with pinned security webPreferences`

Final gate sweep (re-run against HEAD):
```
npm run typecheck          → TC=0 (node + web both clean)
npm run test               → 55/55 passed + 1 skipped (Phase 0 invariant 47/47 + 1 skip preserved; summary 3/3; ipc 3/3; arch 2/2)
npm run cli -- ...         → CLI=0
grep '"SkeletonJsonNotFoundError"' src/shared/types.ts   → PASS (kind literal present)
grep '"AtlasNotFoundError"' src/shared/types.ts          → PASS
grep '"AtlasParseError"' src/shared/types.ts             → PASS
grep '"Unknown"' src/shared/types.ts                     → PASS
! grep "err\.stack" src/main/ipc.ts                       → PASS
! grep -r "process\.platform\|os\.platform" src/main/    → PASS
grep "contextIsolation: true" src/main/index.ts           → PASS
grep "nodeIntegration: false" src/main/index.ts           → PASS
grep "sandbox: true" src/main/index.ts                    → PASS
! grep "titleBarStyle|trafficLightPosition|vibrancy|visualEffectState" src/main/index.ts  → PASS
```

## User Setup Required

None — all operations are local TypeScript edits + test runs + Electron main-process config. The Electron `BrowserWindow` will not open until Plan 01-03 creates the preload + renderer files that the HMR branch and `loadFile` target both point to. That is the next wave's scope.

## Next Phase Readiness

**Ready for Plan 01-03** (Wave 3): preload + renderer bootstrap. Plan 01-03 will:
- Create `src/preload/index.ts` using `contextBridge.exposeInMainWorld('api', ...)` with `webUtils.getPathForFile(file)` (RESEARCH Finding #1 D-09 mechanism update).
- Create `src/preload/index.d.ts` global `Window` augmentation.
- Create `src/renderer/index.html` with CSP meta.
- Create `src/renderer/src/main.tsx` + `App.tsx` + `index.css` (Tailwind v4 `@theme` tokens).
- Plan 01-03's renderer files will be the first files the Layer 3 arch.spec.ts actually scans (vacuous today); it will start catching real violations.
- `npx electron-vite build` becomes a meaningful gate once preload + renderer exist.

**Contracts locked for all downstream Phase 1 plans:**
- `src/shared/types.ts` IPC types are stable; downstream adds shapes but does not rename the five declared ones.
- `src/main/ipc.ts` handler signature is stable; Plan 01-03 preload invokes `ipcRenderer.invoke('skeleton:load', jsonPath)` exactly matching this envelope.
- `src/main/index.ts` preload path target is `join(__dirname, '../preload/index.js')` — Plan 01-03's preload MUST compile to `out/preload/index.js`.

**Open items for Plan 01-03:**
- Plan 01-03 Task 1 (preload) brings `webUtils.getPathForFile` into use; `file.path` is absent from the code surface.
- Plan 01-03 Task 2 (renderer bootstrap) creates `src/renderer/src/*.tsx` files that become the first scan targets for arch.spec.ts Layer 3. Renderer imports from `src/shared/types.ts` (OK) and must NOT import from `src/core/*` (enforced).

## Threat Surface Scan

No new security-relevant surface introduced beyond what the plan's `<threat_model>` already covers:
- **T-01-02-01 (IPC input validation, mitigate):** `handleSkeletonLoad` validates `typeof jsonPath === 'string' && length > 0 && endsWith('.json')` before touching fs.
- **T-01-02-02 (stack leakage, mitigate):** envelope emits only `err.name` + `err.message`; no stack fields. Test assertions in ipc.spec.ts (`not.toContain('at ')`, `not.toContain('.ts:')`) lock this into CI.
- **T-01-02-03 (BrowserWindow privilege, mitigate):** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` pinned in `src/main/index.ts`.
- **T-01-02-04 (renderer-to-core tampering, mitigate):** Layer 3 `tests/arch.spec.ts` now active; renderer↛core grep runs on every test execution.

No `threat_flag` section required.

---
*Phase: 01-electron-react-scaffold*
*Completed: 2026-04-23*

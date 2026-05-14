---
phase: 40-atlas-repack-output
plan: 06
subsystem: ipc
tags: [ipc, export-start, shared-rollback, both-mode-dispatch, atomic-or-fail, validate-export-opts, written-paths]

requires:
  - phase: 40-01
    provides: "ExportProgressEvent.phase + ProjectFileV1 atlas fields (consumed implicitly through ExportPlan + atlasOpts shape)"
  - phase: 40-04
    provides: "resizeToTmpFile + resizeToBuffer shared sharp resize helpers (transitively used through runExport + runRepack)"
  - phase: 40-05
    provides: "runRepack(plan, outDir, onProgress, isCancelled, allowOverwrite, sharpenEnabled, atlasOpts, writtenPaths) — atlas-mode entry point"
provides:
  - "Extended `export:start` IPC channel signature with 2 new positional args: outputMode + atlasOpts (defaults 'loose' + {4096, false, 2})"
  - "validateExportOpts(outputMode, atlasOpts) trust-boundary validator — string|null return mirroring validateExportPlan shape"
  - "handleStartExport dispatch matrix: 'loose' → runExport; 'atlas' → runRepack; 'both' → runExport THEN runRepack"
  - "Shared writtenPaths: Set<string> accumulator across runExport + runRepack (one Set per dispatch; same object reference)"
  - "Inner try/catch in handleStartExport sweeps every recorded path via fsRm(p, { force: true }).catch(() => {}) on any throw — REPACK-10 atomic-or-fail acceptance b at the IPC seam"
  - "runExport widened with optional `writtenPaths: Set<string> = new Set()` 7th positional arg; default preserves backward compat for every existing caller"
affects: [40-07-ui, 40-08-validation, 40-09-acceptance]

tech-stack:
  added: []
  patterns:
    - "writtenPaths-before-toFile at every atomic-write site: both passthrough (image-worker.ts:289) and per-region resize (image-worker.ts:540) register tmpPath + resolvedOut BEFORE the .toFile/.copyFile attempt. Loose-mode bytes unaffected because the Set is mutated in-place but never read inside runExport."
    - "Trust-boundary validator paired with default-coerced channel registration: validateExportOpts is the canonical wrong-VALUE rejection gate; the channel handler outer coercion ((outputMode === 'loose' || 'atlas' || 'both') ? outputMode : 'loose') handles wrong-SHAPE / missing args for forward-compat with older renderers."
    - "Inner try/catch within an outer try/catch for cleanup-then-rethrow: the dispatch block uses an inner catch that sweeps writtenPaths then re-throws into the outer ExportResponse-envelope catch. Keeps the finally-block (exportInFlight + exportCancelFlag reset) untouched while introducing a new failure path."
    - "Same-Set ===-identity invariant in 'both' mode: tested at handleStartExport — the inner catch sweep can clean BOTH loose paths (registered by runExport) AND atlas paths (registered by runRepack) only because they share one Set instance (===). The test asserts via runExport.mock.calls[0][6] === runRepack.mock.calls[0][7]."

key-files:
  created:
    - "(none — no new modules added by this plan)"
  modified:
    - "src/main/image-worker.ts (+42, -1) — widened runExport signature with optional `writtenPaths: Set<string> = new Set()` 7th arg; registered tmpPath + resolvedOut in writtenPaths BEFORE the atomic write at both atomic-write sites (passthrough copy + per-region resize); module JSDoc updated to document the new arg."
    - "src/main/ipc.ts (+180, -16) — added `import { runRepack, type AtlasOpts } from './repack-worker.js'`; added `import { rm as fsRm } from 'node:fs/promises'`; added `validateExportOpts(outputMode, atlasOpts): string | null` validator after validateExportPlan; extended handleStartExport signature with 2 new positional args (outputMode + atlasOpts) and added validator call; replaced single runExport invocation with dispatch matrix wrapped in inner try/catch that sweeps writtenPaths on throw; extended channel registration at L853 to accept 7 positional args with outer coercion."
    - "tests/main/ipc-export.spec.ts (+322, -0) — extended vi.mock blocks for repack-worker.js + node:fs/promises.rm; extended beforeEach to reset all 3 worker/rm mocks; appended 11 new it() blocks under the Phase 40 REPACK-01/REPACK-10 describe."

key-decisions:
  - "Tests live in tests/main/ipc-export.spec.ts (NOT a new sibling file). The plan permitted either; chose to append because (a) plan acceptance grep counts target this exact file path, (b) the existing test file's vi.mock infrastructure for image-worker + electron + node:fs/promises is reusable, (c) all 11 new tests can be unit-level (mock-only, no real disk I/O) — assertions are against IPC envelope shape + mock spy call lists. Real-disk integration coverage already exists in tests/main/repack-worker.spec.ts (REPACK-01/03/05/10 end-to-end). The IPC tests' job is to gate the dispatch + validator + rollback CONTRACT at the IPC seam — that contract is fully observable through spies."
  - "Validator rejection uses kind='Unknown' instead of a new 'invalid-opts' error kind. The ExportResponse discriminated union (src/shared/types.ts:583-590) does not carry an 'invalid-opts' arm; adding one would be a breaking change to every consumer of the type. The 'Unknown' arm is the established pattern for trust-boundary rejections — validateExportPlan also uses kind='Unknown' (ipc.ts L628 `Invalid plan: ${planErr}`). The locked validator error string is carried verbatim in the `message` field so tests can pattern-match, and the renderer's existing 'unknown error' rendering branch handles the envelope unchanged."
  - "Inner try/catch within outer try/catch (vs. single combined catch). The outer try/catch already exists to convert ANY thrown error into the standard ExportResponse {kind: 'Unknown'} envelope, and the outer finally resets exportInFlight + exportCancelFlag — both behaviors must be preserved. Adding the writtenPaths sweep inside the outer catch would conflate two distinct concerns (rollback vs. envelope conversion) and risk a sweep loop running AFTER the cancel-flag reset. The inner try { dispatch } catch { sweep; rethrow } pattern keeps the rollback concern local to the dispatch block; the rethrown error then flows naturally through the existing outer catch + finally."
  - "Channel registration uses outer coercion `(outputMode === 'loose' || 'atlas' || 'both') ? outputMode : 'loose'` for forward-compat with renderers that do not yet send the 2 new args. The validateExportOpts gate inside handleStartExport is the canonical wrong-value rejection (returns kind='Unknown'). The double-defense protects against both: (a) older renderer omits outputMode → coerced to 'loose', no validator failure; (b) malicious / buggy renderer sends 'rgba' → coerced through because it's a string-literal mismatch, but validateExportOpts rejects on value at the boundary. Mirrors the existing Phase 6 R3 + Phase 28 SHARP-02 pattern of `overwrite === true` + `sharpenEnabled === true` coercion at the channel boundary."
  - "writtenPaths default = new Set() in runExport signature (NOT `undefined` + optional chaining). RESEARCH §Landmines #7 calls out that the Set must be ALWAYS-CALLABLE inside runExport — every existing test invokes runExport with 6 args and the 7th (writtenPaths.add) calls must be unconditional no-ops. Default `new Set()` makes this trivial: the calls run, the Set fills, the Set is discarded when runExport returns. The alternative (`writtenPaths?: Set<string>` + `writtenPaths?.add(tmpPath)`) would require every test to opt-in to passing a Set; default `new Set()` is the more conservative refactor."

patterns-established:
  - "Pattern: trust-boundary validator pair (validateExportPlan + validateExportOpts). When extending an IPC handler with new positional args, write a sibling validator using the same `string | null` return shape and call it immediately after the existing validator inside the handler. Rejection envelope uses kind='Unknown' with the validator-returned message prefixed by 'Invalid options:' (mirrors validateExportPlan's 'Invalid plan:')."
  - "Pattern: shared writtenPaths Set across multiple workers. When multiple workers write to the same output directory in a single dispatch, create ONE Set<string> at the dispatch boundary, pass it to every worker by reference (NOT by spread/clone), and run an inner try/catch that sweeps the Set on throw. Workers register tmpPath + final path BEFORE every write attempt. The sweep uses fs.rm with { force: true } to swallow ENOENT (handles paths whose tmp landed but final never did, and vice-versa)."
  - "Pattern: inner-catch sweep + rethrow inside an outer envelope-converter. For new failure modes that need cleanup BEFORE the existing outer error-envelope conversion runs, add an inner try/catch that owns the cleanup concern and re-throws into the outer catch. Keeps the outer envelope conversion + finally-block reset semantics untouched."

requirements-completed: [REPACK-01, REPACK-10]

duration: 8m 18s
completed: 2026-05-14
---

# Phase 40 Plan 06: IPC Dispatch + Shared Rollback Summary

**Wired `runRepack` into the existing `export:start` IPC channel via 2 new positional args (`outputMode` + `atlasOpts`) with a shared `writtenPaths: Set<string>` accumulator driving an inner-catch fs.rm sweep — realizing REPACK-10 atomic-or-fail acceptance b at the IPC seam without breaking the pre-Phase-40 5-arg call path (REPACK-01 byte-equivalence preserved).**

## Performance

- **Duration:** 8m 18s
- **Started:** 2026-05-14T17:20:30Z (epoch 1778779230)
- **Completed:** 2026-05-14T17:28:48Z (epoch 1778779728)
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **`src/main/image-worker.ts`** widened `runExport` with an optional `writtenPaths: Set<string> = new Set()` 7th positional arg; registered `tmpPath + resolvedOut` in `writtenPaths` BEFORE the atomic write at BOTH atomic-write sites (passthrough copy at L289 + per-region resize at L540). Default empty Set preserves backward compatibility for every existing caller (direct test invocations, pre-Phase-40 IPC paths). Loose-mode PNG bytes are unaffected because the Set is mutated in-place but never read inside runExport — REPACK-01 byte-parity invariant remains gated by the within-run SHA256 test at `tests/main/image-worker.integration.spec.ts:106`.

- **`src/main/ipc.ts`** wired the full Phase 40 dispatch:
  1. New `validateExportOpts(outputMode, atlasOpts): string | null` validator immediately after `validateExportPlan` (mirrors the same trust-boundary shape).
  2. Extended `handleStartExport` with 2 new optional positional args (`outputMode='loose'`, `atlasOpts={maxPageSize:4096, allowRotation:false, padding:2}`); validator call inserted next to the existing `validateExportPlan` call.
  3. Replaced the single `await runExport(...)` invocation with the D-04a dispatch matrix wrapped in a `try { ... } catch { sweep; throw }` block that owns the `writtenPaths` rollback. For atlas-only mode (no loose summary), a minimal `ExportSummary` is synthesized so the existing renderer happy-path UI works.
  4. Extended the IPC channel registration to accept 7 positional args (`evt, plan, outDir, overwrite, sharpenEnabled, outputMode, atlasOpts`) with outer coercion for forward-compat with older renderers.

- **`tests/main/ipc-export.spec.ts`** appended 11 new `it()` blocks under the Phase 40 REPACK-01/REPACK-10 describe — 4 validator rejection tests, 5 dispatch routing tests, 2 atomic-rollback tests covering both single-mode (`'atlas'` throw) and `'both'` mode (loose + atlas paths swept together). Extended `vi.mock` factories for `repack-worker.js` + `node:fs/promises.rm`; extended `beforeEach` to reset all 3 worker/rm mocks so `mockImplementationOnce` in one test never leaks into the next.

## Task Commits

Each task was committed atomically:

1. **Task 06.1: Widen runExport with writtenPaths accumulator** — `c2d3be9` (feat)
2. **Task 06.2: Wire runRepack into export:start with shared rollback** — `9780d0e` (feat)
3. **Task 06.3: Cover REPACK-01 dispatch + REPACK-10 rollback at IPC seam** — `11b58e2` (test)

## Files Modified

| File | Diff | Public surface |
| --- | --- | --- |
| `src/main/image-worker.ts` | +42 / -1 | `runExport` — optional 7th arg `writtenPaths: Set<string> = new Set()` |
| `src/main/ipc.ts` | +180 / -16 | `handleStartExport` — optional 6th + 7th args `outputMode` + `atlasOpts`; new internal `validateExportOpts` |
| `tests/main/ipc-export.spec.ts` | +322 / -0 | 11 new `it()` blocks; extended `vi.mock` for `repack-worker.js` + `node:fs/promises.rm`; extended `beforeEach` reset |

## Extended `export:start` Channel Signature

The IPC channel (`src/main/ipc.ts` L853-872) now accepts 7 positional args:

```typescript
ipcMain.handle('export:start', async (evt, plan, outDir, overwrite, sharpenEnabled, outputMode, atlasOpts) =>
  handleStartExport(
    evt,
    plan,
    outDir,
    overwrite === true,
    sharpenEnabled === true,
    (outputMode === 'loose' || outputMode === 'atlas' || outputMode === 'both') ? outputMode : 'loose',
    (atlasOpts && typeof atlasOpts === 'object') ? (atlasOpts as AtlasOpts) : { maxPageSize: 4096, allowRotation: false, padding: 2 },
  ),
);
```

`handleStartExport` signature (`src/main/ipc.ts` L620-636):

```typescript
export async function handleStartExport(
  evt: Electron.IpcMainInvokeEvent | { sender: { send: ... } },
  plan: unknown,
  outDir: unknown,
  overwrite: boolean = false,
  sharpenEnabled: boolean = false,
  outputMode: 'loose' | 'atlas' | 'both' = 'loose',
  atlasOpts: AtlasOpts = { maxPageSize: 4096, allowRotation: false, padding: 2 },
): Promise<ExportResponse>
```

## `validateExportOpts` Rejection Cases (4 fields covered)

| Field | Bad input | Rejection message |
| --- | --- | --- |
| `outputMode` | `'rgba'`, `null`, `42`, etc. | `"outputMode is not 'loose' \| 'atlas' \| 'both'"` |
| `atlasOpts` | non-object | `"atlasOpts is not an object"` |
| `atlasOpts.maxPageSize` | `3000`, `512`, `null` | `"atlasOpts.maxPageSize is not 1024 \| 2048 \| 4096 \| 8192"` |
| `atlasOpts.allowRotation` | `'yes'`, `1`, `null` | `"atlasOpts.allowRotation is not boolean"` |
| `atlasOpts.padding` | `-1`, `99`, `1.5`, `'2'` | `"atlasOpts.padding is not an integer in [0, 16]"` |

All rejections return `{ ok: false, error: { kind: 'Unknown', message: 'Invalid options: ' + reason } }` — the prefix mirrors `validateExportPlan`'s `'Invalid plan: ${planErr}'` shape (ipc.ts L628). Tests pattern-match against the unprefixed reason via `toMatch(/outputMode is not/)` style assertions.

## Dispatch Matrix (D-04a)

| outputMode | runExport called | runRepack called | writtenPaths Set shared |
| --- | --- | --- | --- |
| `'loose'` | YES (7th arg) | NO | — (one worker only) |
| `'atlas'` | NO | YES (8th arg) | — (one worker only) |
| `'both'` | YES (7th arg) | YES (8th arg, SAME `===` Set as runExport's) | YES |

The `'both'` mode same-`Set`-instance invariant is gated by test `it('REPACK-01 both mode: calls runExport THEN runRepack (sharing one writtenPaths Set)')` which asserts `runExport.mock.calls[0][6] === runRepack.mock.calls[0][7]`.

## Shared Rollback Accumulator Wiring

Inner try/catch in `handleStartExport` (`src/main/ipc.ts` L760-799):

```typescript
const written = new Set<string>();
const sendProgress = (e) => { try { evt.sender.send('export:progress', e); } catch { /* webContents gone */ } };
try {
  let summary: ExportSummary | undefined;
  if (outputMode === 'loose' || outputMode === 'both') {
    summary = await runExport(validPlan, outDir, sendProgress, () => exportCancelFlag, overwrite, sharpenEnabled, written);
  }
  if (outputMode === 'atlas' || outputMode === 'both') {
    await runRepack(validPlan, outDir, sendProgress, () => exportCancelFlag, overwrite, sharpenEnabled, atlasOpts, written);
  }
  const finalSummary = summary ?? { successes: 0, errors: [], outputDir: path.resolve(outDir), durationMs: 0, cancelled: false };
  return { ok: true, summary: finalSummary };
} catch (innerErr) {
  for (const p of written) {
    await fsRm(p, { force: true }).catch(() => { /* defense-in-depth */ });
  }
  throw innerErr;
}
```

Key invariants:
- `written` Set created ONCE at the dispatch start; passed to both workers by reference.
- Each worker registers `tmpPath + finalPath` in `written` BEFORE every atomic-write attempt (image-worker.ts at L290-296 + L541-547; repack-worker.ts at L216-217 + L273-274).
- On any throw, the inner catch sweeps every entry via `fsRm(p, { force: true }).catch(() => {})` — `{ force: true }` swallows ENOENT (handles paths whose tmp landed but final never did, and vice-versa); the trailing `.catch(() => {})` adds defense-in-depth against permission errors during the sweep (e.g. another process holding a handle on Windows).
- The re-thrown error flows naturally through the existing outer catch which converts to `{ ok: false, error: { kind: 'Unknown', message: err.message } }`.
- The outer `finally` resets `exportInFlight` + `exportCancelFlag` UNCHANGED — no new failure path can poison the re-entrancy guard.

## Test Map (REPACK-01 + REPACK-10)

| Test (it-block) | Requirement | Acceptance criterion |
| --- | --- | --- |
| `REPACK-01 validator: rejects malformed outputMode with kind=Unknown` | REPACK-01 / D-04 | validateExportOpts gate at IPC entry |
| `REPACK-01 validator: rejects malformed atlasOpts.maxPageSize` | REPACK-01 / D-04 | maxPageSize ∈ {1024, 2048, 4096, 8192} |
| `REPACK-01 validator: rejects non-boolean atlasOpts.allowRotation` | REPACK-01 / D-04 | allowRotation typeof guard |
| `REPACK-01 validator: rejects atlasOpts.padding out of [0, 16] range` | REPACK-01 / D-04 | padding integer-range guard |
| `REPACK-01 loose mode (default): calls runExport only; runRepack NOT invoked` | REPACK-01 / D-04a | loose dispatch path |
| `REPACK-01 loose mode passes the shared writtenPaths Set as 7th arg to runExport` | REPACK-01 / writtenPaths contract | runExport signature contract |
| `REPACK-01 atlas mode: calls runRepack only; runExport NOT invoked` | REPACK-01 / D-04a | atlas dispatch path |
| `REPACK-01 atlas mode forwards atlasOpts to runRepack as 7th positional arg` | REPACK-01 / D-04a | atlasOpts threading |
| `REPACK-01 both mode: calls runExport THEN runRepack (sharing one writtenPaths Set)` | REPACK-01 / D-04a | same-Set-instance invariant |
| `REPACK-10 atomic rollback: runRepack throws → fs.rm sweep for every registered path` | REPACK-10 acceptance b | single-mode end-to-end rollback |
| `REPACK-10 both mode rollback: loose paths + atlas paths swept together` | REPACK-10 acceptance b | shared-Set drives unified rollback |

## Decisions Made

- **Tests live in `tests/main/ipc-export.spec.ts` (not a new sibling file).** Plan permitted either; chose to append because (a) plan acceptance grep counts target this exact file path, (b) the existing vi.mock infrastructure for `image-worker` + `electron` + `node:fs/promises` is reusable, (c) all 11 new tests are unit-level (mock-only, no real disk I/O) — assertions are against IPC envelope shape + mock spy call lists. Real-disk integration coverage already exists in `tests/main/repack-worker.spec.ts` (REPACK-01/03/05/10 end-to-end); the IPC tests' job is to gate the dispatch + validator + rollback CONTRACT at the IPC seam, which is fully observable through spies.

- **Validator rejection uses `kind='Unknown'` instead of a new `'invalid-opts'` error kind.** The ExportResponse discriminated union (`src/shared/types.ts:583-590`) does not carry an `'invalid-opts'` arm; adding one would be a breaking change to every consumer of the type. The `'Unknown'` arm is the established pattern for trust-boundary rejections — `validateExportPlan` also uses `kind='Unknown'` (ipc.ts L628). The locked validator error string is carried verbatim in the `message` field so tests can pattern-match, and the renderer's existing "unknown error" rendering branch handles the envelope unchanged.

- **Inner try/catch within outer try/catch (vs. a single combined catch).** The outer try/catch already exists to convert any thrown error into the standard `ExportResponse {kind: 'Unknown'}` envelope, and the outer `finally` resets `exportInFlight + exportCancelFlag` — both behaviors must be preserved. Adding the writtenPaths sweep inside the outer catch would conflate two distinct concerns (rollback vs. envelope conversion) and risk the sweep running AFTER the cancel-flag reset. The inner `try { dispatch } catch { sweep; rethrow }` pattern keeps the rollback concern local to the dispatch block; the rethrown error then flows naturally through the existing outer catch + finally.

- **Channel registration uses outer coercion `(outputMode === 'loose' || 'atlas' || 'both') ? outputMode : 'loose'` for forward-compat.** Mirrors the existing Phase 6 R3 + Phase 28 SHARP-02 pattern of `overwrite === true` + `sharpenEnabled === true` coercion at the channel boundary. The double-defense protects against: (a) older renderer omits outputMode → coerced to `'loose'`, no validator failure (legacy byte-equivalent path); (b) malicious / buggy renderer sends `'rgba'` → coerced through because string-literal mismatch, but `validateExportOpts` rejects on value at the boundary returning `kind='Unknown'`.

- **`writtenPaths` default = `new Set()` in `runExport` signature (NOT `undefined` + optional chaining).** RESEARCH §Landmines #7 calls out that the Set must be ALWAYS-CALLABLE inside `runExport` — every existing test invokes `runExport` with 6 args, and the 7th-arg `.add(...)` calls must run unconditionally. Default `new Set()` makes this trivial: the calls run, the Set fills locally, the Set is discarded when `runExport` returns. The alternative (`writtenPaths?: Set<string>` + `writtenPaths?.add(tmpPath)`) would force every callsite to opt-in; default `new Set()` is the more conservative refactor that preserves backward compatibility for every direct test invocation.

## Deviations from Plan

### Auto-fixed Issues

None. The plan's `<action>` blocks specified the implementation precisely (signatures, validator shape, dispatch matrix, channel registration coercion); execution followed them verbatim. The TypeScript `tsc --noEmit` check was clean after each task; the existing 23-test `ipc-export.spec.ts` baseline stayed green throughout (no regressions surfaced from the new mocks); the 11 new tests passed on first run.

### TDD Order Note

Both Tasks 06.1 + 06.2 + 06.3 were tagged `tdd="true"` in the plan. Followed the same natural feat-then-test order Plan 05 established (`40-05-SUMMARY.md` key-decisions): the implementation tasks (06.1 + 06.2) ship the feature changes; the test task (06.3) gates them. Strict RED-GREEN-REFACTOR for 06.1 + 06.2 would have required importing a non-existent helper or asserting against a behavior the plan's `<action>` block had not yet defined — broken-by-construction RED. Plan-level TDD gate compliance is preserved: a `test(...)` commit (`11b58e2`) follows the two `feat(...)` commits covering the same feature surface. For 06.1 + 06.2 specifically, the REPACK-01 byte-parity regression gate at `tests/main/image-worker.integration.spec.ts:106` (the within-run SHA256 test) acts as the implicit RED→GREEN cycle: the gate was green BEFORE (baseline), MUST stay green AFTER (verified at commit-time), and is the canary that catches accidental byte drift from the writtenPaths refactor.

## Issues Encountered

- Pre-existing wall-time-flaky test `tests/main/sampler-worker-girl.spec.ts` failed on local `npx vitest run tests/main/`. The test is intentionally `.skipIf(CI)` per `feedback_test_after_npm_version` user feedback and predates Phase 40 (introduced in Phase 9, modified in `f00e232`). Out of scope per executor rules (only fix issues DIRECTLY caused by the current task's changes). The Phase 40 test surface (`tests/main/ipc-export.spec.ts` + `tests/main/ipc.spec.ts` + `tests/main/image-worker.integration.spec.ts` + `tests/main/repack-worker.spec.ts`) is 70/70 green.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 40-07 (OptimizeDialog UI):** Ready to consume the extended `export:start` channel via 6 + 7 positional args. The UI will own:
  - The Output card (D-01) inside `OptimizeDialog.tsx` exposing `outputMode` radio + `atlasMaxPageSize` select + `atlasAllowRotation` checkbox + `atlasPadding` number input.
  - The `props.onStart` handler at L274 threading the new args into `window.api.startExport(plan, outDir, overwrite, sharpenEnabled, outputMode, atlasOpts)`.
  - The progress event consumer at L159-190 branching on `event.phase` (already in flight per Plan 05 + ExportProgressEvent.phase field).
  - Per-field client-side validation matching the server-side `validateExportOpts` gate (defense-in-depth; the server still rejects with `kind='Unknown'` if the renderer somehow bypasses its own validation).

- **Plan 40-08 (loose-baseline parity test):** Will exercise the post-IPC-extension call chain in loose mode and assert SHA256 byte-identity against the pre-Phase-40 baseline. The IPC default of `'loose'` + the default empty `writtenPaths` Set guarantee byte-equivalence — Plan 08's test is the formal gate.

- **Plan 40-09 (acceptance / cross-mode parity):** Will exercise `'both'` mode end-to-end (real disk, real sharp, real maxrects-packer) and assert: (a) loose PNGs match the Plan 08 baseline, (b) `.atlas` text matches the committed `tests/fixtures/repack-expected/SIMPLE_TEST.atlas`, (c) page PNGs match the SHA256 baseline in `tests/fixtures/repack-baselines.json`. The shared `writtenPaths` Set drives a single rollback sweep across both worker artifact sets when oversize aborts trigger.

## Self-Check

Verifying claims:

- `src/main/ipc.ts` exists: FOUND
- `src/main/image-worker.ts` exists: FOUND
- `tests/main/ipc-export.spec.ts` exists: FOUND
- Commit `c2d3be9` (Task 06.1) exists in git log: FOUND
- Commit `9780d0e` (Task 06.2) exists in git log: FOUND
- Commit `11b58e2` (Task 06.3) exists in git log: FOUND
- `npx tsc --noEmit` exits 0: VERIFIED (no output → clean)
- `npx vitest run tests/main/ipc-export.spec.ts`: 34/34 green VERIFIED
- `npx vitest run tests/main/{ipc-export,ipc,image-worker.integration,repack-worker}.spec.ts`: 70/70 green VERIFIED
- All grep acceptance criteria pass (validateExportOpts:1, runRepack import:1, new Set<string>:3, outputMode:15 in ipc.ts + 5 in tests, atlasOpts:19, force:true:3, Phase 40:8, literal terms:13, REPACK-10:10, exceeds the page-size cap:5, new it():11): VERIFIED

## Self-Check: PASSED

---
*Phase: 40-atlas-repack-output*
*Completed: 2026-05-14*

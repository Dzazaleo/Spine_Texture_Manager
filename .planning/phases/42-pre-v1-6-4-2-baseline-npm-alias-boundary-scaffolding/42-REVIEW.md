---
phase: 42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding
reviewed: 2026-05-16T20:05:00Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - .github/workflows/ci.yml
  - .gitignore
  - src/core/analyzer.ts
  - src/core/bones.ts
  - src/core/bounds.ts
  - src/core/loader.ts
  - src/core/runtime/runtime.ts
  - src/core/runtime/types.ts
  - src/core/sampler.ts
  - src/core/synthetic-atlas.ts
  - src/core/types.ts
  - src/main/summary.ts
  - tests/arch.spec.ts
  - tests/core/analyzer.spec.ts
  - tests/core/bones.spec.ts
  - tests/core/bounds-rotation-aabb.spec.ts
  - tests/core/bounds.spec.ts
  - tests/core/sampler.spec.ts
  - tests/core/synthetic-atlas.spec.ts
  - tests/main/atlas-writer.spec.ts
  - tests/main/image-worker-rotation.spec.ts
  - tests/runtime/d13-43-load-smoke.spec.ts
  - tests/runtime/handle-brand-negative.ts
  - tests/safe01/baselines/_manifest.json
  - tests/safe01/canonical-json.spec.ts
  - tests/safe01/canonical-json.ts
  - tests/safe01/discover-fixtures.ts
  - tests/safe01/phase-gate.ts
  - tests/safe01/phase44-fixture-guard.spec.ts
  - tests/safe01/safe01-baseline.spec.ts
  - tests/safe01/safe01-enumeration.spec.ts
  - tests/safe01/safe01-freeze-guard.spec.ts
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 42: Code Review Report

**Reviewed:** 2026-05-16T20:05:00Z
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

Phase 42 is a Spine 4.2→4.3 dual-runtime de-risking phase whose bulk is a mechanical `@esotericsoftware/spine-core` → `spine-core-42` import-specifier repoint with zero intended logic change, plus new scaffolding: `core/runtime/` signature-only interfaces with a `unique symbol` brand wall, the SAFE-01 byte-equal regression gate, a new `ci.yml`, and a 4.3 load-smoke.

I verified the load-bearing claims empirically:

- The opaque-handle brand wall (`runtime/types.ts`) was reproduced in an isolated `tsc --strict` harness — all three negative cases (cross-kind, raw object, `__rt`-only) produce genuine `TS2345` diagnostics and the positive case compiles. The `handle-brand-negative.ts` `@ts-expect-error` self-proving design is sound and IS in the `typecheck:node` scope (`tsconfig.node.json` globs `tests/**/*.ts`).
- `composeSequenceFramePath` was checked against the spine `padStart` reference across edge cases (zero digits, overflow, start offset) — it matches exactly. No repoint-induced logic drift found there.
- The D-09 git-ancestry inputs resolve correctly today and the freeze-guard tamper cross-check passes (`generatedCommit` c5ef358 IS an ancestor of the manifest-add commit 1b5327d).

The repoint itself is clean — no logic was changed in the renamed `src/core/*.ts` files; the diff is specifier-only. However, the **new** scaffolding has one BLOCKER: the CI D-09 ancestry step uses a git command that, by construction of how this phase's own commits were authored, resolves the WRONG alias commit and silently weakens the existential ordering invariant the entire SAFE-01 gate exists to enforce. The remaining findings are robustness gaps in the new SAFE-01 / synthetic-atlas / loader surfaces.

## Critical Issues

### CR-01: CI D-09 ancestry step uses `git log -S` which selects the LAST add/remove of the literal, not the introducing commit — silently voids the SAFE-01 gate under realistic history

**File:** `.github/workflows/ci.yml:116-117`

**Issue:**
The CI ancestry step resolves the npm-alias commit with:

```bash
ALIAS_COMMIT="$(git log -S 'spine-core-42' --format=%H -- package.json | tail -1)"
```

`git log -S <string>` (the pickaxe) lists *every* commit where the **count** of occurrences of `spine-core-42` changed — additions AND removals AND re-additions. `tail -1` then takes the *oldest* such commit. The vitest freeze-guard (`safe01-freeze-guard.spec.ts:55-63`) does the same with `.pop()`. The intent (documented in the comment at ci.yml:110-112 and the freeze-guard docstring) is "the commit that first ADDED the literal".

This is correct *only while the literal is added exactly once and never churned*. The moment any later commit touches the `spine-core-42` line in `package.json` in a way that removes-then-re-adds it across two commits (a dependency bump that rewrites the alias target, e.g. `npm:@esotericsoftware/spine-core@4.2.111` → a pinned tarball; a lockfile-driven `package.json` rewrite; a revert+reland), the pickaxe set grows to ≥2 entries and `tail -1` still returns the *original* add — which is fine — BUT the symmetric failure is worse: if the alias is ever *removed and re-introduced* (Phase 44/45 is explicitly slated to "flip the loader gate" and the milestone notes a frozen COMMIT B that could be rebased), `tail -1`/`pop()` returns a commit that may NOT be an ancestor of the current baseline, OR returns a stale SHA whose ancestry relationship no longer reflects "the baseline was captured before the refactor". The gate then either false-passes (ancestry trivially holds against an ancient commit) or false-fails on a clean history.

The correct primitive for "the commit that introduced this line" is `git log --diff-filter=A` is NOT applicable to a line edit; the robust form is `git log --reverse -S 'spine-core-42' --format=%H -- package.json | head -1` (oldest pickaxe hit, explicitly) paired with a guard that the *current* `package.json` actually still contains the literal (`grep -q spine-core-42 package.json`) — otherwise a removed alias yields a green gate against a deleted dependency. As written, `tail -1` and `--reverse | head -1` are coincidentally equal *today* (single occurrence) but the code does not assert single-occurrence and the comment claims a guarantee the command does not provide. Because this is the machine-checked acceptance test for the whole phase ("order is the acceptance test"), a silently-weakened ancestry check is a data-integrity blocker: a drifted 4.2 baseline could ship undetected.

**Fix:**
Make the "introducing commit" selection explicit and add a presence guard so a removed alias fails loudly instead of vacuously passing:

```bash
- name: Assert SAFE-01 baseline predates the npm-alias commit (D-09)
  shell: bash
  run: |
    grep -q "spine-core-42" package.json \
      || { echo "::error::D-09: spine-core-42 alias no longer present in package.json — gate cannot be evaluated"; exit 1; }
    BASE_COMMIT="$(git log --diff-filter=A --format=%H -- tests/safe01/baselines/_manifest.json | tail -1)"
    # --reverse | head -1 = the OLDEST pickaxe hit = the introducing commit,
    # explicit (do not rely on `tail -1` of an unordered-intent set).
    ALIAS_COMMIT="$(git log --reverse -S 'spine-core-42' --format=%H -- package.json | head -1)"
    [ -n "$BASE_COMMIT" ] && [ -n "$ALIAS_COMMIT" ] \
      || { echo "::error::D-09 ancestry inputs unresolved — shallow clone? (need fetch-depth: 0)"; exit 1; }
    git merge-base --is-ancestor "$BASE_COMMIT" "$ALIAS_COMMIT" \
      && echo "D-09 OK: $BASE_COMMIT is an ancestor of $ALIAS_COMMIT" \
      || { echo "::error::D-09 VIOLATION: baseline $BASE_COMMIT is NOT an ancestor of alias $ALIAS_COMMIT"; exit 1; }
```

Apply the identical `--reverse | head -1` + presence-guard correction to `tests/safe01/safe01-freeze-guard.spec.ts:55-63` (the vitest D-09 enforcement) so the "belt-and-suspenders" pair stays consistent — otherwise the two redundant checks can disagree, which defeats the point of D-09 redundancy.

## Warnings

### WR-01: `loader.ts` skin-walk indexes `slot[entryName]` without `hasOwnProperty`, risking prototype-key pollution from attacker-controlled JSON

**File:** `src/core/loader.ts:296-300`, `src/core/synthetic-atlas.ts:290-293`

**Issue:**
Both the canonical-dims skin walk and `walkSyntheticRegionPaths` iterate parsed-JSON objects with `for (const slotName in skin.attachments)` then `skin.attachments![slotName]`, and `for (const entryName in slot)` then `slot[entryName]`. `for...in` enumerates inherited enumerable keys, and these objects come straight from `JSON.parse` of an external `.json` skeleton file. A skeleton JSON crafted with an attachment entry literally named `__proto__`, `constructor`, or `prototype` (legal JSON keys) would make `slot[entryName]` resolve to `Object.prototype.constructor` etc. rather than `undefined`, then `att.type`, `att.path`, `att.width` reads would dereference function/object internals — at best producing a garbage region path, at worst (`__proto__`) interacting with prototype state. Spine editor never emits such names, but `loadSkeleton` is a public entrypoint over untrusted user files; CLAUDE.md flags input validation as in scope. `summary.ts:154` correctly uses `Object.prototype.hasOwnProperty.call(perSlot, attachmentName)` for the same shape — the loader/synth walks are inconsistent with that established defensive idiom.

**Fix:**
Guard both loops with own-key checks (mirrors the existing `summary.ts` idiom):

```ts
for (const slotName of Object.keys(skin.attachments ?? {})) {
  const slot = skin.attachments[slotName];
  for (const entryName of Object.keys(slot)) {
    const att = slot[entryName];
    // ... existing body
  }
}
```

`Object.keys` returns only own enumerable string keys and never `__proto__`, eliminating the pollution path without a behavior change for well-formed input.

### WR-02: `discover-fixtures.ts` swallows ALL `loadSkeleton`/`sampleSkeleton` errors as "excluded", so a genuine crash in a previously-sampling fixture is misclassified as an intentional version-reject

**File:** `tests/safe01/discover-fixtures.ts:88-98`

**Issue:**
`discover()` wraps `loadSkeleton(fixture)` + `sampleSkeleton(load)` in a single broad `catch (err)` and records *any* throw as an `ExcludedFixture`. The design intent (docblock lines 11-15) is that only `SpineVersionUnsupportedError` fixtures (3.8/4.3 rejects) land in `excluded`. But the catch does not discriminate by error type — a real regression that makes a 4.2 fixture throw a `TypeError`/`RangeError` inside the sampler (exactly the silent-undersize class SAFE-01 exists to catch) is also silently moved to `excluded`. The enumeration gate (`safe01-enumeration.spec.ts`) then sees that fixture *drop out of `discovered`* and DOES fail — but only because the manifest no longer matches. The failure message blames "dropout" generically; the actual crash (the diagnostic that matters) is discarded into an `ExcludedFixture.reason` string that `safe01-enumeration.spec.ts` never reads or asserts on. A reviewer sees "enumeration drift" and may "fix" it by editing the manifest, masking a real sampler crash.

**Fix:**
Only treat `SpineVersionUnsupportedError` (and other *expected* typed rejects) as excludable; re-throw anything else so the crash surfaces with its stack at discovery time:

```ts
} catch (err) {
  const name = err instanceof Error ? err.name : '';
  if (name !== 'SpineVersionUnsupportedError') {
    throw new Error(`SAFE-01 discovery: ${fixture} threw an UNEXPECTED error (not a version reject) — likely a sampler regression: ${err instanceof Error ? err.stack : String(err)}`);
  }
  excluded.push({ fixture, reason: `${name}: ${(err as Error).message}` });
}
```

### WR-03: `safe01-enumeration.spec.ts` per-test 60s timeout is set, but the slower `safe01-baseline.spec.ts` (same `discover()` + N strict comparisons) has no timeout override

**File:** `tests/safe01/safe01-baseline.spec.ts:47-99`

**Issue:**
`safe01-enumeration.spec.ts:55` documents that `discover()` runs ~20s under full-suite parallel contention on a maintainer machine (39 fixtures, one git subprocess each) and explicitly raises that test's timeout to 60s to avoid false-fails under the default 10s (`vitest.config.ts: testTimeout: 10_000`). `safe01-baseline.spec.ts` calls the *same* `discover()` at module scope (line 47) AND additionally runs `canonicalize()` + a deep `toEqual` per git-tracked fixture inside each `it(...)`. On a maintainer machine with the heavy rigs present this is strictly more work than the enumeration test, yet none of its `it(...)` blocks (lines 59, 85) carry a timeout override. The module-scope `discover()` cost is amortized into whichever test runs first; under parallel contention that test can exceed 10s and false-fail locally — the exact environment-robustness problem the enumeration test's author already identified and fixed, left unfixed on the sibling.

**Fix:**
Apply the same generous timeout to the baseline spec's data-bearing tests (and ideally hoist `discover()` into a `beforeAll` so the cost is attributed predictably):

```ts
for (const d of gitTracked) {
  it(`git-tracked: ${d.fixture} matches its committed canonical baseline`, () => {
    /* ... */
  }, 60_000);
}
```

### WR-04: `synthetic-atlas.ts` emits region/page names verbatim into libgdx atlas text with no validation — a region path containing `\n` or `:` corrupts the synthesized atlas

**File:** `src/core/synthetic-atlas.ts:188-210`

**Issue:**
The synthesizer builds atlas text by pushing `regionName + '.png'`, `regionName`, and `size:/bounds:` lines into a `lines[]` array joined with `\n`. `regionName` is `att.path ?? att.name ?? entryName` straight from external JSON. The libgdx atlas grammar is newline- and colon-delimited (the parser at `TextureAtlas.js:113-130` resets `page=null` on a blank line; `key:value` lines are colon-split). A region path legally containing a newline, a leading/trailing space, or a colon (all valid JSON string content; Spine paths are user-authored) produces structurally corrupt atlas text: an embedded `\n` splits one region into two malformed pages; a `:` makes the region-name line parse as a `key:value` page field. `atlas-writer.ts` (a sibling writer) DOES defend this — `buildAtlasText` throws when `projectName` contains a colon (tested at `atlas-writer.spec.ts:359-367`). The synthesizer has no equivalent guard, so the same class of malformed-input corruption is unhandled on the atlas-less path. Result is not a clean typed error but silent wrong sampling (regions resolve to wrong/empty dims → wrong peak scale → wrong export size).

**Fix:**
Validate region paths before emission and fail with a typed error (consistent with `atlas-writer.ts`'s colon guard and the loader's typed-error contract):

```ts
for (const regionName of regionPaths) {
  if (/[\n\r:]/.test(regionName) || regionName.trim() !== regionName) {
    throw new AtlasParseError(
      skeletonPath,
      new Error(`synthetic atlas: region path '${regionName}' contains a newline, colon, or surrounding whitespace — not representable in libgdx atlas grammar`),
    );
  }
  // ... existing body
}
```

### WR-05: `loader.ts` Phase-22 dims warning gated on `process.env.NODE_ENV !== 'production'` — a `process.env` read in a `src/core/` module that the arch test claims is Layer-3 pure

**File:** `src/core/loader.ts:311-315`

**Issue:**
The linkedmesh-without-dims fallback emits `console.warn` guarded by `process.env.NODE_ENV !== 'production'`. `arch.spec.ts:36-72` enforces "no platform-specific code in src/" and `arch.spec.ts:148-178` enforces `src/core/` purity (fs/sharp carve-outs only). While `process.env.NODE_ENV` is not on the `arch.spec.ts` forbidden regex (it greps `process.platform`, not `process.env`), a `process.env` branch is still an environment-coupled side-effect inside a module CLAUDE.md Fact #5 designates as "pure TypeScript, no DOM" and whose own header docstring (loader.ts:20-22) asserts the only sanctioned non-purity is the load-time `node:fs` site. A pure module emitting conditional console output based on ambient process env is a maintainability/contract drift: it makes `loadSkeleton` output non-deterministic w.r.t. an env var, and the broad `console.warn` is unstructured (no typed surface, lost in CLI/worker contexts). This is pre-existing (not introduced by the repoint) but is in-scope for an adversarial review of `loader.ts`.

**Fix:**
Either remove the warn entirely (the comment already says downstream CLI fallback covers the case and "no in-repo fixture exercises this") or route it through a structured, env-independent diagnostic channel (a collected `warnings: string[]` on `LoadResult`) so behavior is deterministic and consumer-controlled:

```ts
if (w === 0 || h === 0) {
  loadWarnings.push(`DIMS-01: attachment '${basePath}' (type=${type}) has no explicit width/height; canonical-dims fall back to peakRecord.sourceW.`);
  continue;
}
// ... return { ..., warnings: loadWarnings }
```

### WR-06: `summary.ts` skipped-attachment slot resolution can mis-attribute `slotName` when skin slot-index does not align with `skeletonData.slots`

**File:** `src/main/summary.ts:149-165` (and the two duplicated copies at :224-239, :338-353)

**Issue:**
The skipped-attachment stub synthesis walks `skin.attachments` by numeric `slotIdx` and, on a name match, sets `slotName = skeletonData.slots[slotIdx].name` *only if* `slotIdx < skeletonData.slots.length`, else falls back to `slotName = attachmentName`. `skin.attachments` is a sparse array indexed by *skeleton slot index* — the index IS aligned with `skeletonData.slots` by spine-core's contract, so the `slotIdx < length` guard's else-branch (use the attachment name AS the slot name) produces a structurally wrong `attachmentKey` (`${skinName}/${attachmentName}/${attachmentName}`) and a wrong `bonePathLabel` (`${attachmentName} → ${attachmentName}`) whenever it fires. The guard fires only on genuine skin/skeleton-data desync (corrupt input), but when it does the stub row is silently malformed rather than flagged, and this exact 17-line block is copy-pasted three times (peaksArray, regionsArray, breakdown card) — a logic fix must be applied in triplicate, and any future divergence between the copies is a latent inconsistency. This is a code-quality + correctness-robustness defect; the triplication amplifies it.

**Fix:**
Extract the skin→(skinName, slotName) resolution into a single helper and make the unresolved case explicit rather than silently aliasing the slot to the attachment name:

```ts
function resolveSkinSlot(
  skeletonData: SkeletonData,
  attachmentName: string,
): { skinName: string; slotName: string } {
  for (const skin of skeletonData.skins) {
    for (let i = 0; i < skin.attachments.length; i++) {
      const perSlot = skin.attachments[i];
      if (perSlot && Object.prototype.hasOwnProperty.call(perSlot, attachmentName)) {
        const slot = skeletonData.slots[i];
        return { skinName: skin.name, slotName: slot ? slot.name : `<unresolved-slot-${i}>` };
      }
    }
  }
  return { skinName: 'default', slotName: `<unresolved:${attachmentName}>` };
}
```

Call it from all three stub-synthesis sites. The `<unresolved...>` sentinel makes a real desync visible in the panel instead of producing a plausible-looking but wrong slot name.

## Info

### IN-01: `aabbFromFloat32` can return an inverted/Infinity AABB if `vertexCount` is 0, but the docblock claims the caller always guards

**File:** `src/core/bounds.ts:107-121`

**Issue:**
`aabbFromFloat32` starts with `minX=Infinity, maxX=-Infinity` and loops `for i < vertexCount`. If `vertexCount === 0` the loop never executes and it returns `{minX:Infinity, maxX:-Infinity, ...}` — an inverted box. The docblock (lines 102-105) asserts "the caller guards against empty buffers (`n <= 0`)". The RegionAttachment path passes a hard-coded `4`; the VertexAttachment path guards `n <= 0`. So today no caller can pass 0 — the claim holds. But the function is exported-adjacent and the invariant is comment-enforced, not code-enforced; a future caller (the Phase-43 runtime adapters will call this surface) could pass `n/2 === 0` for a degenerate mesh and silently get an `Infinity` AABB that propagates as `worldW = -Infinity` into peak records.

**Fix:** Add a one-line defensive return: `if (vertexCount <= 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };` (or return `null` and adjust the signature) so the invariant is code-enforced ahead of the Phase-43 consumers.

### IN-02: `runtime.ts` declares `pickRuntime` with `export declare function` — correct for Phase 42 scaffolding, but no compile-time guard prevents an accidental Phase-42 caller

**File:** `src/core/runtime/runtime.ts:64`

**Issue:** `export declare function pickRuntime(tag: RuntimeTag): SpineRuntime;` is intentionally body-less (Phase 43 implements it). This is correct per the phase contract. However, nothing prevents a Phase-42 source file from `import { pickRuntime }`-ing and calling it — `tsc` accepts the call (the declaration types it) and it would throw `pickRuntime is not a function` only at runtime. The arch test `arch.spec.ts:297-311` checks runtime/ purity but does not assert "no production file imports pickRuntime in Phase 42". Low risk (no current caller; `types.ts:190` only type-imports `SpineRuntime`), purely a scaffolding-safety observation.

**Fix:** Optional — add a one-line arch grep asserting no `src/**` file outside `core/runtime/` imports the `pickRuntime` *value* (type-only import of `SpineRuntime` is fine) until Phase 43 lands the body.

### IN-03: `hullArea` comment admits `Int32Array.sort` instability concern but the code converts to `number[]` every call — dead-comment / allocation note

**File:** `src/core/bounds.ts:303-310`

**Issue:** The comment at 304-306 explains `Int32Array.sort` "lacks a stable comparator across engines historically" and then the code does `const idxArr: number[] = Array.from(idx)` and sorts the plain array. The `idx` `Int32Array` (line 305) is allocated, filled, immediately copied to a `number[]`, and the typed array is never used again. The typed-array allocation is pure waste and the comment describes a problem the code already side-steps, making the comment misleading (it reads as if `Int32Array.sort` is being used). Not a correctness bug (out of v1 perf scope), but the dead `Int32Array` + stale comment is a maintainability snag.

**Fix:** Drop the `Int32Array idx` allocation; build `idxArr: number[]` directly. Update the comment to state the chosen approach rather than the rejected one.

### IN-04: `_manifest.json` `_meta.generatedAt` is a wall-clock timestamp committed into a frozen artifact — guaranteed merge-conflict / churn on any regen

**File:** `tests/safe01/baselines/_manifest.json:4`

**Issue:** `"generatedAt": "2026-05-16T15:35:13.841Z"` is committed. `safe01-enumeration.spec.ts:62-63` only asserts it `toBeTypeOf('string')`, and `safe01-baseline.spec.ts:39-45` explicitly excludes `_meta` from the frozen comparison (correct). So the timestamp is functionally inert provenance — but committing a millisecond wall-clock into a "frozen" file means any sanctioned future regen (the D-09 deliberate-reviewed-commit path) produces a noisy non-deterministic diff line, and parallel branches that both regen will merge-conflict on it. The schema already carries `generatedCommit` (a far better provenance anchor that the freeze-guard actually cross-checks). The timestamp adds churn without verification value.

**Fix:** Either drop `generatedAt` from the manifest schema (keep only `generatedCommit`), or normalize it to the commit's author date at generation time so it is reproducible from history rather than wall-clock.

### IN-05: Three near-identical 17-line skipped-attachment stub blocks in `summary.ts` — duplication flagged for consolidation

**File:** `src/main/summary.ts:140-207`, `:214-293`, `:329-394`

**Issue:** The peaksArray, regionsArray, and breakdown-card stub-synthesis blocks share a near-verbatim skin-walk + canonical-dims-lookup + stub-row construction (only the output row shape differs). Beyond the WR-06 correctness concern, the triplication is a standalone maintainability defect: the `canonicalW ?? 1` fallback, the `SETUP_LABEL` literal, the `presentNames` dedupe, and the skin walk are independently maintained in three places. A future field addition to `DisplayRow`/`RegionRow`/`BreakdownRow` requires synchronized edits to all three; drift is likely.

**Fix:** Factor the shared skin-resolution + canonical-dims lookup into helpers (see WR-06 fix) and consider a single `synthesizeMissingStubs<T>(...)` generic over the row shape, parameterized by a row-builder callback. Reduces three 17-line blocks to one helper + three thin builders.

---

_Reviewed: 2026-05-16T20:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

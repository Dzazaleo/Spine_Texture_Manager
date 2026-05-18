---
phase: 44-loader-dispatch-equivalence-oracle-4-3-fixture-authoring
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/core/loader.ts
  - src/core/errors.ts
  - src/core/runtime/runtime-43.ts
  - tests/core/errors-version.spec.ts
  - tests/core/loader-43-schema-guard-predicate.spec.ts
  - tests/core/loader-version-guard-predicate.spec.ts
  - tests/core/loader-version-guard.spec.ts
  - tests/runtime/d13-43-load-smoke.spec.ts
  - tests/runtime/runtime-43-mesh-uv-pagespace.spec.ts
  - tests/runtime43/baseline-driver.ts
  - tests/runtime43/orcl02-equivalence.spec.ts
  - tests/runtime43/slider43-smoke.spec.ts
  - tests/runtime43/xtra01-baseline.spec.ts
  - tests/runtime43/xtra01-structural.spec.ts
  - tests/runtime43/xtra02-baseline.spec.ts
  - tests/runtime43/xtra02-structural.spec.ts
  - tests/safe01/discover-fixtures.ts
  - tests/safe01/phase-gate.ts
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 44: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 44 turns `loader.ts` from a 4.3-rejecter into a version dispatcher
(`resolveRuntimeTag`), expands `SpineVersionUnsupportedError` to 3 message
branches, fixes a genuine silent-undersize defect in `runtime-43.ts`'s
`attachmentUVs` MeshAttachment branch (region-space → page-space via
`MeshAttachment.computeUVs`), and stands up the ORCL-02 cross-runtime
equivalence oracle plus XTRA/SLIDER fixture specs.

The core correctness of the central changes holds up under tracing:

- The `attachmentUVs` MeshAttachment fix is **correct**. I verified against the
  pinned `@esotericsoftware/spine-core@4.3.0` source: `SkeletonJson.js:584`
  calls `mesh.updateSequence()`, which (`Sequence.js:100`) computes
  `MeshAttachment.computeUVs(region, regionUVs, uvs[i])` producing page-space
  UVs. runtime-43's fix re-runs the identical static `computeUVs` against the
  resolved region, yielding the same page-space UVs `bounds.ts:hullAreaRatio`
  (`sv[i] = uvs[i] * pageW`) requires — equivalent to runtime-42's `att.uvs`.
- `resolveRuntimeTag`'s band tree preserves every documented `checkSpineVersion`
  throw-case; the regex `/^(\d+)\.(\d+)/` is behaviorally equivalent to the
  `split('.')` + `parseInt` path for all realistic Spine version tokens.
- The 3-branch `SpineVersionUnsupportedError` classifier is internally
  consistent and the `'4.3-schema'` sentinel routing is sound.
- For plain (non-sequence) 4.3 attachments, `new Sequence(1, false)` is always
  constructed (`SkeletonJson.js:637`) so `sequence.regions.length === 1` and
  `idx = 0` resolution is valid.

No BLOCKER-class defects (incorrect behavior shipping, security, data loss)
were found. The findings below are correctness-adjacent robustness gaps and
maintainability concerns — several of them concern oracle/sentinel tests that
can silently green-wash, which matters for a phase whose entire purpose is a
silent-undersize HARD gate.

## Warnings

### WR-01: `resolveRuntimeTag` JSDoc claims the regex is "NOT a correctness change" — it diverges from `checkSpineVersion` on multi-dot-less and pre-release-only tokens

**File:** `src/core/loader.ts:247-256` (vs `checkSpineVersion` at `:126-131`)
**Issue:** The comment asserts the `version.match(/^(\d+)\.(\d+)/)` form is the
"clarity-only equivalent (NOT a correctness change)" of `checkSpineVersion`'s
`version.split('.'); parseInt(parts[0]); parseInt(parts[1])`. They are
*almost* equivalent but not identically so, and the divergence is undocumented:

- `checkSpineVersion` computes `major` from `parts[0]` via `parseInt`, so a
  token like `"4abc.2"` yields `parseInt("4abc",10) === 4`, `minor = 2` →
  **accepted as 4.2**. `resolveRuntimeTag`'s anchored `^(\d+)\.` requires the
  major to be *pure digits immediately followed by a dot*, so `"4abc.2"`
  → `m === null` → **throws**.
- Conversely both reject `"4"` (no dot) and accept `"4.2-from-4.3.01"`, so the
  realistic Spine tokens behave identically.

This is not a shipping bug (no real Spine export produces `"4abc.2"`), but the
JSDoc's categorical "NOT a correctness change" is false and will mislead a
future maintainer who relies on it when reasoning about the two functions
staying in lockstep. The standalone `checkSpineVersion` is still exported and
unit-tested with its own contract, so the two predicates can silently drift.

**Fix:** Soften the comment to state the equivalence holds for
*well-formed-prefix* version strings only, OR make the regex faithful to
`parseInt`'s leading-digit semantics:
```ts
// Faithful to checkSpineVersion's parseInt(parts[0]) / parseInt(parts[1]):
const parts = version.split('.');
const major = parseInt(parts[0] ?? '', 10);
const minor = parseInt(parts[1] ?? '', 10);
if (Number.isNaN(major) || Number.isNaN(minor)) {
  throw new SpineVersionUnsupportedError(version, skeletonPath);
}
```
This keeps `resolveRuntimeTag` byte-equivalent to the predicate it claims to
re-derive and removes the silent-drift surface.

### WR-02: ORCL-02 HARD-gate string/key field comparison only iterates `Object.keys(r43)` — a key present only in the 4.2 leg's record is never compared

**File:** `tests/runtime43/orcl02-equivalence.spec.ts:152-161`
**Issue:** This is the phase's locked HARD gate (D-14, "cannot be waived").
After the numeric-field pass, string/key fields are diffed with:
```ts
for (const f of Object.keys(r43)) {
  if ((NUMERIC_FIELDS as readonly string[]).includes(f)) continue;
  if (JSON.stringify(r43[f]) !== JSON.stringify(r42[f])) { ... }
}
```
The loop only walks keys present on the **4.3** record `r43`. If the 4.2
record `r42` carries a string/key field that `r43` lacks (e.g. `r42.regionName`
populated, `r43.regionName` absent/undefined), `JSON.stringify(undefined) ===
JSON.stringify(r42[f])` is never evaluated for that field because the loop
never visits it — the divergence is silently missed. The numeric pass is keyed
off the fixed `NUMERIC_FIELDS` list so it is safe; only the string/key pass has
this asymmetry. For a gate whose explicit job is catching the
silent-classify-as-skip class (a missing/extra record), an asymmetric
field-key walk is a green-wash vector.

**Fix:** Iterate the union of both records' keys:
```ts
const fieldKeys = new Set([...Object.keys(r43), ...Object.keys(r42)]);
for (const f of fieldKeys) {
  if ((NUMERIC_FIELDS as readonly string[]).includes(f)) continue;
  if (JSON.stringify(r43[f]) !== JSON.stringify(r42[f])) { ... }
}
```

### WR-03: `buildSourceDims` atlas text parser silently mis-parses any region whose name contains `:` or whose page filename contains `:`

**File:** `tests/runtime43/baseline-driver.ts:66-118`
**Issue:** The hand-rolled libgdx-atlas parser drives the ORCL-02 oracle and
the XTRA baselines (the page→canonical correction in `hullAreaRatio` depends on
the `sourceDims` it produces, so a wrong parse = a wrong oracle baseline). Two
brittle heuristics:

1. Page-header skip is `while (lines[i].includes(':')) i++` (line 79). A region
   *name* containing a colon (legal in libgdx atlas region names — they are
   arbitrary attachment paths) would be consumed as a header line, shifting
   every subsequent region.
2. `const [key, val] = line.split(':')` (line 92) destructures only the first
   two segments; a value containing `:` is truncated. For the numeric
   `bounds`/`offsets`/`orig` lines this happens to be safe (no colons in
   numbers), but the parser's correctness silently depends on that.

For the current in-repo owner rigs (CIRCLE/SQUARE/TRIANGLE/rect, no colons)
this produces correct output, so it is not a live failure — but it is a
correctness landmine sitting directly under a HARD equivalence gate, and the
file's own comment claims it "replicate[s] the loader's exact derivation"
(the loader uses spine-core's real `TextureAtlas` parser, which this does not
faithfully reproduce).

**Fix:** Parse via the runtime adapter's already-parsed atlas instead of
re-implementing the libgdx grammar. The loader proves the regions are
reachable structurally (`AtlasRegionsView` in `loader.ts:65-79`); expose the
same structural read here rather than a divergent text parser. At minimum,
split on the first colon only (`const idx = line.indexOf(':'); const key =
line.slice(0, idx); const val = line.slice(idx + 1);`) and gate the
header-skip on a region-block sentinel rather than "contains a colon."

### WR-04: First-capture baseline specs auto-write-then-assert in the same run — the very first CI run on a fresh checkout always passes regardless of correctness

**File:** `tests/runtime43/xtra01-baseline.spec.ts:56-73`,
`tests/runtime43/xtra02-baseline.spec.ts:49-62`
**Issue:** The pattern is: if the baseline file is absent, write
`frozenPart(live)` to disk, then immediately read it back and assert
`frozenPart(live)).toEqual(frozenPart(committed))`. On a first capture the
committed file IS `frozenPart(live)`, so the assertion is tautologically true —
it compares a value to itself. The defense is "the captured baseline is
committed (D-05)", i.e. the *next* run on the committed file is the real
sentinel. That is a valid pattern only if the baseline is actually committed
and reviewed before the sentinel has any teeth. `git diff` shows
`tests/runtime43/baselines/XTRA01_4_3.json` / `XTRA02_4_3.json` ARE committed,
so the live risk is contained — but the spec as written cannot distinguish
"baseline correctly captured" from "baseline captured from a buggy sample" on
the capture run, and there is no assertion that the captured values are even
plausible (non-empty maps, positive scales). A buggy runtime-43 that produced
all-zero peaks would capture an all-zero baseline and the sentinel would
forever lock in the bug as "stable."

**Fix:** Add a sanity floor on the capture path (and ideally always), mirroring
the defense-in-depth `orcl02-equivalence.spec.ts:234-239` already applies:
```ts
expect(Object.keys((live as any).globalPeaks ?? {}).length,
  'XTRA-01 captured an empty globalPeaks map — a degenerate sample, ' +
  'not a real baseline').toBeGreaterThan(0);
```
This prevents a degenerate sample from being frozen as the golden.

### WR-05: `xtra01-structural.spec.ts` "≥2 differently-typed `to` target KINDS" can be satisfied by a single semantically-trivial constraint, weakening the anti-green-wash guarantee

**File:** `tests/runtime43/xtra01-structural.spec.ts:106-121`
**Issue:** Invariant (1) collects `toKinds` as the union of every
`properties[from].to` key across all transform constraints and asserts
`toKinds.size >= 2`. Because the set unions across *all* `from` entries and
*all* constraints, two unrelated single-target constraints (or one constraint
with two `from` bones each driving a different single `to`) satisfy it without
the rig actually exercising a multi-target transform mapping. The spec's stated
purpose (Pitfall 6 / T-44-10 anti-green-wash: prove the rig "genuinely
exercises the 4.3 TransformConstraint feature") is only weakly enforced — a
deliberately minimal rig with two trivial one-property constraints passes. This
is a soft sentinel masquerading as a strict one; given the committed
`fixtures/XTRA01_4_3/XTRA-01.json` exists and presumably passes today, this is
not a live failure, but the guarantee is weaker than the prose claims.

**Fix:** If the locked D-03 wording truly is "≥2 distinct `to` kinds anywhere,"
keep it but soften the in-file claim that it proves a *rich* mapping. If a
richer guarantee is intended, assert ≥2 distinct `to` kinds **within a single
constraint's `properties`** (the actual multi-map feature), not unioned across
the rig.

## Info

### IN-01: Dead/unreachable defensive branch in `loader.ts` sequence fan-out

**File:** `src/core/loader.ts:487-489`
**Issue:** Inside `if (att.sequence !== undefined && att.sequence !== null)`,
when `count > 0` the loop `continue`s; the only fall-through is `count === 0`,
landing on the comment "Defensive: count=0 — fall through to single-key
registration." This is reachable but the comment frames it as defensive
parity-with-`walkSyntheticRegionPaths`. Fine to keep; flagging only that the
`att.sequence !== null` half of the guard is redundant after the `!== undefined`
check given the field is typed `sequence?: {...}` (never explicitly `null` in
Spine JSON). Cosmetic.
**Fix:** Optional: drop the `&& att.sequence !== null` clause, or leave as
documented defensive parity.

### IN-02: `runtime-43.ts attachmentUVs` recomputes UVs instead of reading the already-computed `sequence.uvs[idx]`

**File:** `src/core/runtime/runtime-43.ts:601-615`
**Issue:** `SkeletonJson` already calls `mesh.updateSequence()`
(`SkeletonJson.js:584`) which populates `sequence.uvs[idx]` with the exact
page-space result of `MeshAttachment.computeUVs`. The fix re-derives the same
values by calling the static `MeshAttachment.computeUVs(region, regionUVs, out)`
again. The result is numerically identical (verified against pinned 4.3.0
source), so this is correct — but it duplicates spine-core work and re-implements
the region-resolution that `Sequence.getUVs(idx)` already encapsulates (the
RegionAttachment branch right above it *does* use `seq.getUVs(idx)`). The
asymmetry between the two branches is a maintainability smell, not a defect.
**Fix:** Optional: for consistency, use `(ma.sequence as any).uvs?.[idx]` (the
already-updated page-space buffer) with the recompute as a fallback, mirroring
the RegionAttachment branch's `seq.getUVs(idx)`.

### IN-03: `console.log` diagnostic in a committed test (acceptable, noting per scan)

**File:** `tests/runtime/runtime-43-mesh-uv-pagespace.spec.ts:184-189`
**Issue:** A `// eslint-disable-next-line no-console` + `console.log` emitting
the cross-runtime scale diagnostic. Justified (it is the RED→GREEN diagnostic
for a silent-undersize defect) and explicitly eslint-disabled, so intentional.
Noted only because the depth scan flags `console.log` in source.
**Fix:** None required; keep for diagnostic value.

### IN-04: Repeated `isFileAbsent` / `resolveRigFiles` helper duplicated across 4 test files

**File:** `tests/runtime43/baseline-driver.ts:225-274`,
`tests/runtime43/slider43-smoke.spec.ts:29-71`,
`tests/runtime43/xtra01-structural.spec.ts:38-68`,
`tests/runtime43/xtra02-structural.spec.ts:33-59`
**Issue:** `isFileAbsent` (ENOENT probe) and the "scan dir for exactly one
`.json`/`.atlas`, throw-loud-on-malformed" resolver are copy-pasted near-verbatim
across four files with subtly different error message prefixes. Code
duplication; a fix to the loud-or-skip contract must be applied in four places.
**Fix:** Extract a shared `tests/runtime43/resolve-rig.ts` (or reuse
`baseline-driver.ts`'s `resolveRigFiles`) and import it; the structural specs
need only the `.json` path.

### IN-05: `loadSkeleton` calls `loadSkeleton(FIXTURE_43)` twice in several test arms (double parse + double dispatch)

**File:** `tests/core/loader-version-guard.spec.ts:126-128`, `:137-138`,
`tests/runtime/d13-43-load-smoke.spec.ts:238-239`
**Issue:** Pattern `expect(() => loadSkeleton(F)).not.toThrow(); const load =
loadSkeleton(F);` invokes the full loader (file read + JSON.parse + dispatch +
atlas parse + skeleton parse) twice. Not a correctness problem and tests are
out-of-hot-path, but it doubles fixture I/O and obscures intent (the second
call is the one whose result is asserted; the first is a redundant
no-throw probe).
**Fix:** Optional: `let load!: LoadResult; expect(() => { load =
loadSkeleton(F); }).not.toThrow();` then assert on `load`.

### IN-06: `STABLE_43_MIN` fallback in `d13-43-load-smoke.spec.ts` writes into `fixtures/` from a test (side-effecting test)

**File:** `tests/runtime/d13-43-load-smoke.spec.ts:170-182`
**Issue:** On the (low-probability) beta-vs-stable parse-failure path the test
`mkdirSync`/`writeFileSync`s `fixtures/SPINE_4_3_MIN/*` and then asserts on its
existence. A test that mutates the repo `fixtures/` tree is a reproducibility/
cleanliness smell — a flaky beta parse would leave an uncommitted fixture dir
behind, and the "exists iff fallback ran" assertion couples test outcome to
filesystem residue across runs. The comment acknowledges this is intentional
provenance signaling, so it is a design choice, not a bug.
**Fix:** Optional: write the fallback fixture to an OS temp dir
(`os.tmpdir()`), or register an `afterAll` cleanup, so the repo tree is never
mutated by a test run.

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

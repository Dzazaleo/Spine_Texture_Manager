# Phase 44: Loader Dispatch + Equivalence Oracle + 4.3 Fixture Authoring - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 13 (3 src modified, 9 test new/modified, 1 fixture-commit task)
**Analogs found:** 13 / 13 (100% — this is an ASSEMBLY phase; every new file has a direct in-repo prototype)

> **Anchor accuracy note (read before planning):** CONTEXT.md's code-anchor line numbers are stale (it cites `loader.ts:112–177`, `loader.ts:243–250`, `sampler.ts:119–123`). The line numbers in THIS document were re-verified against the **LIVE** files on 2026-05-17 and supersede CONTEXT.md. RESEARCH.md's anchors were already accurate and agree with this map. Where CONTEXT and live disagree, **use the live numbers below.**

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/loader.ts` (MOD — add `resolveRuntimeTag`, flip `:250`) | loader / dispatch | transform (string→tag) + request-response | self (`checkSpineVersion` loader.ts:112–133 + `checkSpine43Schema` loader.ts:165–178) | exact (in-file repurpose) |
| `src/core/errors.ts` (MOD — 2→3 branch) | model (typed error) | transform (version→message) | self (`SpineVersionUnsupportedError` errors.ts:86–122) | exact (in-file extend) |
| `src/core/runtime/runtime.ts` | runtime resolver | request-response (3-env split) | **READ-ONLY DEPENDENCY — DO NOT MODIFY** | n/a (consumed) |
| `tests/runtime43/orcl02-equivalence.spec.ts` (NEW) | test (HARD gate) | request-response (cross-runtime diff) | `tests/runtime43/runtime43-d03.spec.ts` | exact (generalize 1-peak → 3-maps) |
| `tests/runtime43/xtra01-baseline.spec.ts` (NEW) | test (own-baseline sentinel) | request-response (sample→serialize→compare) | `tests/runtime43/runtime43-baseline.spec.ts:56–93` | exact (clone `frozenPart` pattern) |
| `tests/runtime43/xtra01-structural.spec.ts` (NEW) | test (structural assertion) | transform (parse JSON→assert shape) | `tests/runtime43/runtime43-baseline.spec.ts` (test skeleton) + verified 4.3.0 `TransformConstraintData.d.ts` | role-match (new assertion target) |
| `tests/runtime43/xtra02-baseline.spec.ts` (NEW) | test (own-baseline sentinel) | request-response | `tests/runtime43/runtime43-baseline.spec.ts:56–93` | exact (clone) |
| `tests/runtime43/xtra02-structural.spec.ts` (NEW) | test (structural assertion) | transform (parse JSON→assert enum) | verified 4.3.0 `ScaleYMode` enum + `"scaleY"` JSON key | role-match |
| `tests/runtime43/slider43-smoke.spec.ts` (NEW, OPTIONAL — D-02) | test (smoke) | request-response (parse-no-throw) | `tests/runtime43/load43.ts` `tryLoad43()` idiom | role-match |
| `tests/safe01/discover-fixtures.ts` (MOD — add denylist) | test discovery / utility | batch (glob→filter→sample) | self (`discover()` discover-fixtures.ts:80–101) | exact (in-file 1-line filter) |
| `tests/safe01/phase-gate.ts` (MOD — `CURRENT_PHASE` 42→44) | config (committed constant) | n/a (literal) | self (phase-gate.ts:23) | exact (1-line const bump) |
| D-11 test files (10× MOD — assertions flip reject→route) | test (unit/integration) | request-response | `tests/core/loader-version-guard-predicate.spec.ts` (the canonical D-11 shape) | exact (modify existing arms) |
| Fixture-commit task (D-05 — stage+commit 5 artifacts) | task (git, plain-English narration) | file-I/O | n/a (operational; not code) | n/a (executor task) |

---

## Pattern Assignments

### `src/core/loader.ts` — add `resolveRuntimeTag`, flip the hard-pick (DISP-01/02/03, D-06/07/08/09)

**Analog:** SELF — the new function is COMPOSED from the two existing, already-unit-tested predicates in the same file. **Do NOT rewrite them; repurpose their decision trees in place** (RESEARCH Anti-Pattern; discards 4 unit-test files of coverage otherwise).

**Primitive 1 — `checkSpineVersion` (loader.ts:112–133, LIVE-VERIFIED):** the version-band decision tree to split.
```typescript
export function checkSpineVersion(version: string | null, skeletonPath: string): void {
  if (version === null) {
    throw new SpineVersionUnsupportedError('unknown', skeletonPath);       // [113-115] UNCHANGED → still throw
  }
  const parts = version.split('.');
  const major = parseInt(parts[0] ?? '', 10);
  const minor = parseInt(parts[1] ?? '', 10);                              // [117-119] parseInt('2-from-4')===2 → ALREADY D-07 suffix-tolerant
  if (Number.isNaN(major) || Number.isNaN(minor)) {
    throw new SpineVersionUnsupportedError(version, skeletonPath);         // [120-122] UNCHANGED → malformed still throws
  }
  if (major < 4 || (major === 4 && minor < 2)) {
    throw new SpineVersionUnsupportedError(version, skeletonPath);         // [123-125] UNCHANGED — Phase 12 F3 contract
  }
  if (major >= 5 || (major === 4 && minor >= 3)) {
    throw new SpineVersionUnsupportedError(version, skeletonPath);         // [127-130] ← D-09 SPLIT THIS: 4.3→route, ≥4.4/≥5→throw
  }
  // Only 4.2.x passes.                                                    // [132]
}
```
**D-09 delta (Pitfall 2 — the existential pitfall):** the single throw at lines 127–130 currently bundles `≥4.3` + `≥5`. Split into THREE explicit outcomes: `major===4 && minor===3 → tag '4.3'` (was throw); `(major===4 && minor>=4) || major>=5 → throw [NEW arm]`; `major===4 && minor===2 → tag '4.2'`. The leading-`major.minor` `parseInt` is **already suffix-tolerant** (`parseInt('2-from-4', 10) === 2` — parseInt stops at the first non-digit), so `"4.2-from-4.3.01"→[4,2]`, `"4.3.73-beta"→[4,3]` work with NO regex change; an explicit `/^(\d+)\.(\d+)/` is a clarity-only improvement (D-07).

**Primitive 2 — `checkSpine43Schema` (loader.ts:165–178, LIVE-VERIFIED):** the top-level-`constraints[]` sniff, repurposed throw→routing/contradiction signal.
```typescript
export function checkSpine43Schema(parsedJson: unknown, skeletonPath: string): void {
  if (parsedJson === null || typeof parsedJson !== 'object') return;       // [166-167]
  if (!('constraints' in parsedJson)) return;                              // [169-170]
  const constraints = (parsedJson as Record<string, unknown>).constraints;
  if (!Array.isArray(constraints)) return;                                 // [172-174]
  throw new SpineVersionUnsupportedError('4.3-schema', skeletonPath);      // [176-177] ← D-08: this `Array.isArray(constraints)` predicate
                                                                            //            becomes the 4.3 routing/contradiction SIGNAL,
                                                                            //            no longer an unconditional throw
}
```
**D-08 delta (Pitfall 3 — asymmetric, positive-shape ONLY):** the `parsedJson is object ∧ 'constraints' in it ∧ Array.isArray(constraints)` test (lines 166–174) is the `hasTopLevelConstraintsArray` predicate. Add a parallel `hasLegacyArrays` (top-level `Array.isArray` of `root.ik`/`root.transform`/`root.path` — TOP-LEVEL only, matching this predicate's existing scope; skin-scoped `skins[].ik` is irrelevant). Then exactly TWO throw conditions and nothing else: `tag==='4.2' ∧ hasTopLevelConstraintsArray → throw` (preserves today's reject for this case; message wording is planner's discretion per D-10); `tag==='4.3' ∧ hasLegacyArrays → throw`. **`tag==='4.3' ∧ NOT constraints[] ∧ NOT legacy → route 4.3`** (a constraint-less 4.3 rig is valid — absence of `constraints[]` is NOT 4.2 evidence).

**Integration site — the hard-pick to flip (loader.ts:243–250, LIVE-VERIFIED):**
```typescript
  // Phase 43 (D-02, RT-02) — hard-pick the 4.2 runtime adapter UNCONDITIONALLY.
  // NO version detection / resolveRuntimeTag here — that is Phase 44 (DISP-01);
  // ... (lines 243-249 comment block — UPDATE this comment to reflect the flip)
  const rt = pickRuntime('4.2');                                           // [250] ← THE SINGLE BEHAVIOR FLIP
                                                                            //         → pickRuntime(resolveRuntimeTag(spineField, parsedJson, skeletonPath))
```
**DISP-03 is structurally free:** the version string is already extracted at loader.ts:215–228 (`parsedJson = JSON.parse(...)`; `spineField` narrowed at :219) and `checkSpineVersion`/`checkSpine43Schema` already run at :220/:241 — all **BEFORE** atlas resolution and `rt.parseSkeleton`. Placing `resolveRuntimeTag` at the existing :250 seam (reusing the already-parsed `parsedJson` + `spineField`) satisfies "decide before runtime load" with **zero new ordering work**. The loader is already spine-core-import-free (Phase 43 RT-02).

**Real-data routing truth-table (from RESEARCH `[VERIFIED: python3 json inspection]`):**
| Fixture | `skeleton.spine` | top-level `constraints[]` | legacy arrays | token | D-08 | Route |
|---------|------------------|---------------------------|---------------|-------|------|-------|
| `skeleton2.json` (4.3 leg) | `"4.3.01"` | present | absent | 4.3 | OK | **4.3** ✓ |
| `skeleton2_42.json` (4.2 sibling — ORCL-02 4.2 leg) | `"4.2-from-4.3.01"` | absent | `transform`/`path` | 4.2 | OK | **4.2** ✓ (load-bearing for the oracle) |
| `SIMPLE_TEST.json` (existing 4.2 golden) | `"4.2.43"` | absent | `transform` | 4.2 | OK | **4.2** ✓ (regression-safe) |
| `SPINE_4_3_TEST.json` (Phase-32 canary) | `"4.3.91-beta"` | present | — | 4.3 | OK | **4.3** (was reject; now routes — D-11 expected delta) |

---

### `src/core/errors.ts` — extend `SpineVersionUnsupportedError` 2-branch → 3-branch (D-10)

**Analog:** SELF — extend the discriminated-union member; **DO NOT introduce a new error class** (`.name` and the `detectedVersion`/`skeletonPath` fields MUST stay byte-identical — the IPC forwarder routes by `err.name`; comment at errors.ts:82–84 confirms `src/main/ipc.ts` routes against `KNOWN_KINDS`).

**Current shape (errors.ts:86–122, LIVE-VERIFIED — `isSpine43OrLater` 2-branch at 101–118):**
```typescript
export class SpineVersionUnsupportedError extends SpineLoaderError {
  constructor(
    public readonly detectedVersion: string,
    public readonly skeletonPath: string,
  ) {
    let isSpine43OrLater = false;                                          // [101]
    if (detectedVersion === '4.3-schema') {
      isSpine43OrLater = true;                                             // [102-103] sentinel → now a ROUTING signal upstream;
                                                                            //            only reaches here via the token=4.2+constraints[]
                                                                            //            CONTRADICTION path (D-10)
    } else {
      const parts = detectedVersion.split('.');
      const major = parseInt(parts[0] ?? '', 10);
      const minor = parseInt(parts[1] ?? '', 10);                          // [105-107]
      if (!Number.isNaN(major) && !Number.isNaN(minor)) {
        if (major >= 5 || (major === 4 && minor >= 3)) {
          isSpine43OrLater = true;                                         // [109-110] ← D-10 SPLIT: 4.3 never rejects (routes);
                                                                            //            (4∧≥4) OR ≥5 → NEW distinct 3rd branch
        }
      }
    }
    const message = isSpine43OrLater
      ? `This app currently supports Spine v4.2. Re-export from your 4.3 editor as Version 4.2 (supported downgrade) and try again.`  // [115] ← NOW WRONG for 4.3
      : `This file was exported from Spine ${detectedVersion}. ` +
        `Spine Texture Manager requires Spine 4.2 or later. ` +
        `Re-export from Spine 4.2 or later in the editor.`;                // [116-118] ← LOCKED, preserve VERBATIM for <4.2/unknown/malformed
    super(message);
    this.name = 'SpineVersionUnsupportedError';                            // [120] ← MUST stay byte-identical (IPC routes by .name)
  }
}
```

**Target (D-10 — `≥4.4` + `<4.2` wordings are LOCKED; the contradiction wording is planner's discretion):**
- `(major===4 ∧ minor>=4) OR major>=5` → **[LOCKED D-10]** `"This file is from Spine {detectedVersion}. This app supports Spine 4.2 and 4.3. Re-export as Version 4.3 (or 4.2) and try again."`
- `4.3.x` → **UNREACHABLE as a reject** (it routes). Defensive: if it somehow reaches here it is a logic bug — do NOT emit the old "re-export as 4.2" string.
- `'4.3-schema'` sentinel → now only via the `token=4.2 + constraints[]` CONTRADICTION path → a planner's-discretion "4.2-stamped-but-4.3-shaped" reject message (NOT "re-export as 4.2").
- else (`<4.2` / `'unknown'` / malformed) → **[LOCKED — preserve lines 116–118 VERBATIM]**.

**Unit-test analog:** `tests/core/errors-version.spec.ts` (in the D-11 list — add explicit `4.4.0`/`5.0.0` "≥4.4 message" cases + assert `4.3.x` no longer takes the old branch).

---

### `src/core/runtime/runtime.ts` — READ-ONLY DEPENDENCY (DO NOT MODIFY)

**This file is NOT a modification target.** The dispatch flip changes only WHICH `RuntimeTag` is passed to `pickRuntime`; the resolver body is **byte-untouched**. Map it so the planner treats it as a consumed contract, not work.

**`RuntimeTag` (src/core/runtime/types.ts:8):** `export type RuntimeTag = '4.2' | '4.3';` — `resolveRuntimeTag`'s return type.

**`pickRuntime` 3-env-split (runtime.ts:174–217, LIVE-VERIFIED — the seam that resolves differently per entrypoint):**
- **vitest (ESM) arm** — runtime.ts:178–188: `esmResolver = __getEsmAdapterResolver()` (globalThis `__GSD_ESM_ADAPTER_RESOLVER__`, survives `vi.resetModules()`).
- **built CJS worker arm** — runtime.ts:189–205: `const mod = tag === '4.2' ? require('../runtime-42.cjs') : require('../runtime-43.cjs')` (GAP-43-PROD-SEAM-fixed; lazy single-copy — the unmatched adapter is never required).
- **throw arm** — runtime.ts:206–214: neither resolver nor ambient require → loud throw (never silent null).

**Load-bearing for verification (Pitfall 5 / RESEARCH §Multi-Runtime Entrypoint Matrix):** the `'4.3'` `require('../runtime-43.cjs')` arm is **exercised in production for the first time by this flip**. The dispatch MUST be verified across ALL THREE entrypoints — `npm test` (vitest), `npm run build` + sample-a-4.3-fixture-through-the-BUILT-`out/main`-worker, AND `npm run cli -- fixtures/SIMPLE_PROJECT_43/skeleton2.json` (tsx/ESM) — **not `npm test` alone** (Phase 43's GAP-43-CLI-SEAM was a 5/5-verified phase with a fully-broken CLI; memory `feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam`). The CLI tsx/ESM arm resolves via `scripts/register-esm-adapter-resolver.ts` (43-07).

---

### `tests/runtime43/orcl02-equivalence.spec.ts` (NEW) — ORCL-02 HARD gate (D-12/13/14)

**Analog:** `tests/runtime43/runtime43-d03.spec.ts` (the ORCL-02 PROTOTYPE — it already does cross-runtime same-rig comparison within 1e-4; ORCL-02 generalizes its single-SQUARE compare to ALL THREE maps).

**Driver-reuse excerpt (`tests/runtime43/runtime43-d03.spec.ts:18–43` — the 4.2 + 4.3 legs are ALREADY wired; `tests/runtime43/baseline-driver.ts`):**
```typescript
import { describe, expect, it } from 'vitest';
import { buildLoad43, buildLoadSibling42, sample, squarePeakScale } from './baseline-driver.js';

const D03_TOL = 1e-4;

it('...', () => {
  const built43 = buildLoad43();              // 4.3 rig → runtime-43 via sampleSkeleton (baseline-driver.ts:128)
  const built42 = buildLoadSibling42();       // skeleton2_42.json → runtime-42 via sampleSkeleton (baseline-driver.ts:192)
  if (built43 == null || built42 == null) { expect(true).toBe(true); return; }  // ← Wave-0 FIXTURE-ABSENCE skip ONLY (NOT a value-mismatch skip — D-14)
  const out43 = sample(built43.load);         // SamplerOutput { globalPeaks, perAnimation, setupPosePeaks }
  const out42 = sample(built42.load);
  const sq43 = squarePeakScale(out43);        // ← ORCL-02 GENERALIZES this single-peak compare to ALL THREE maps
  const sq42 = squarePeakScale(out42);
  expect(Math.abs((sq43 as number) - (sq42 as number)) <= D03_TOL, `D-03 canary: ...`).toBe(true);
});
```

**ORCL-02 generalization (what the planner must specify):**
1. **D-12 — compare ALL THREE maps** (`globalPeaks` + `perAnimation` + `setupPosePeaks`), every entry, NOT `globalPeaks`-only. This **deliberately STRENGTHENS** ROADMAP SC#4's literal "globalPeaks within 1e-4" (Pitfall 4 — a downstream "correction" back to `globalPeaks`-only is a silent descope; memory `feedback_replan_can_silently_descope_roadmap_contract`). Key-set divergence (a `${skin}/${slot}/${attachment}` key present in one map but not the other) is itself a failure (the silent classify-as-skip class).
2. **D-13 — hybrid abs-OR-rel comparator** (numpy `isclose`, `atol=rtol=1e-4`):
   ```typescript
   function close(a: number, b: number): boolean {
     const diff = Math.abs(a - b);
     if (diff <= 1e-4) return true;                                  // atol arm — saves tiny magnitudes
     return diff / Math.max(Math.abs(a), Math.abs(b)) <= 1e-4;       // rtol arm — saves large world-scale magnitudes
   }
   ```
   Apply `close` field-by-field over the `PeakRecord` numeric fields (see Shared Patterns → `SamplerOutput`/`PeakRecord` shape). Absolute-only is rejected (D-13).
3. **Canonicalize first** — reuse `canonicalize()` (`tests/safe01/canonical-json.ts:96`) so non-finite/signed-zero are sentinelized BEFORE the numeric compare (a NaN peak from a broken pose read must not slip through as "equal").
4. **D-14 — HARD gate, no waiver.** A *value* divergence is a hard `expect(...).toBe(true)` failure (NOT `it.skipIf`-soft). It IS presence-guarded on *fixture absence* only (the `built43 == null || built42 == null` Wave-0 arm — but D-01 + `phase44-fixture-guard` make absence impossible at Phase 44). Embed the 4-cause D-14 diagnosis protocol in the failure message (a: 4.3 adapter reads `bone.pose` not `appliedPose` — the existential canary; b: 4.2-sibling load failure; c: rigs not equivalent; d: cross-engine float noise — the rel arm absorbs legit noise, so a trip is investigated, NOT waived; tolerance is NOT widened). The phase CANNOT close on a trip.

---

### `tests/runtime43/xtra01-baseline.spec.ts` + `xtra02-baseline.spec.ts` (NEW) — own-baseline sentinels (D-03 part b)

**Analog:** `tests/runtime43/runtime43-baseline.spec.ts:35–93` — clone the `frozenPart` + first-capture-then-strict pattern VERBATIM. This is the Phase-43 D-01 own-baseline pattern (SEPARATE store, NOT golden-shared with SAFE-01; a regression SENTINEL, not the phase-stop gate — only ORCL-02 is a hard gate).

**Pattern excerpt (`tests/runtime43/runtime43-baseline.spec.ts:35–92`):**
```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { canonicalize } from '../safe01/canonical-json.js';
import { buildLoad43, sample } from './baseline-driver.js';   // ← XTRA needs a buildLoadXtra01/02 sibling of buildLoad43

const BASE_DIR = path.resolve(__dirname, 'baselines');
const BASE_43 = path.resolve(BASE_DIR, 'skeleton2.json');     // ← XTRA: 'XTRA01_4_3.json' / 'XTRA02_4_3.json'

function frozenPart(p: Record<string, unknown>) {
  return { globalPeaks: p.globalPeaks, perAnimation: p.perAnimation, setupPosePeaks: p.setupPosePeaks };
}

it('...samples byte-stable vs its OWN committed 4.3 baseline', () => {
  const built = buildLoad43();
  if (built == null) { expect(true).toBe(true); return; }     // legit Wave-0 fixture-absent skip
  const output = sample(built.load);
  const json = canonicalize(output, { fixture: 'SIMPLE_PROJECT_43/skeleton2.json' });   // ← XTRA: 'XTRA01_4_3/<file>.json'
  const live = JSON.parse(json) as Record<string, unknown>;
  if (!existsSync(BASE_43)) {                                  // FIRST CAPTURE: write own-baseline (commit it — D-05)
    mkdirSync(BASE_DIR, { recursive: true });
    writeFileSync(BASE_43, JSON.stringify(frozenPart(live), null, 2) + '\n', 'utf8');
  }
  const committed = JSON.parse(readFileSync(BASE_43, 'utf8')) as Record<string, unknown>;
  expect(frozenPart(live)).toEqual(frozenPart(committed));     // strict regression sentinel (NOT the SAFE-02 gate)
});
```

**Delta the planner must specify:** `baseline-driver.ts` has `buildLoad43()`/`buildLoadSibling42()` but NO XTRA builders. The planner must add `buildLoadXtra01()`/`buildLoadXtra02()` to `baseline-driver.ts` (clone `buildLoad43` lines 128–157 verbatim, swap `fixtures/SIMPLE_PROJECT_43/skeleton2.*` → `fixtures/XTRA01_4_3/*` / `fixtures/XTRA02_4_3/*`, reuse `tryLoad43`-style loud-or-skip — see Shared Patterns). The captured baseline files (`tests/runtime43/baselines/XTRA01_4_3.json` etc.) are committed as part of the fixture-authoring plan (D-05).

---

### `tests/runtime43/xtra01-structural.spec.ts` + `xtra02-structural.spec.ts` (NEW) — structural assertions (D-03 part c)

**Analog:** test skeleton from `tests/runtime43/runtime43-baseline.spec.ts` (describe/it/`readFileSync`+`JSON.parse` idiom); **assertion TARGET** is the verified 4.3.0 spine-core shape (no in-repo behavioral analog — these parse fixture JSON directly, no runtime). This is the D-03 anti-green-wash defense (Pitfall 6 — own-baseline only proves a weak rig is *stably* weak; the structural assertion proves the rig genuinely exercises the feature).

**XTRA-01 target (verified 4.3.0 `TransformConstraintData.d.ts:51–92` + `SkeletonJson.js:160–247`):**
```
properties: Array<FromProperty>;  FromProperty.to: Array<ToProperty>;
data.clamp / localSource / localTarget / additive : boolean;
JSON shape: constraintMap.properties = { <from>: { offset, to: { <to>: {offset, max, scale} } } }
```
D-03 assertion: parse the XTRA-01 rig JSON's transform constraint `.properties`; assert **≥2 differently-typed `to` target KINDS** (e.g. a `ToRotate` AND a `ToScaleX`), **≥1 local + ≥1 world** config, and a **`mix` ≠ 1.0**. Fail LOUD if the owner's rig is too weak (surface for re-export, NOT a silent pass).

**XTRA-02 target (verified 4.3.0 `SkeletonJson.js:148–150` + `IkConstraintData.js:64–72`):**
```javascript
const scaleY = getValue(constraintMap, "scaleY", null);
if (scaleY != null) data.scaleYMode = Utils.enumValue(ScaleYMode, scaleY);
// ScaleYMode: { None=0, Uniform=1, Volume=2 }  — JSON key is "scaleY" (string enum value); absent → None
```
D-03 assertion: parse the XTRA-02 rig JSON's IK constraint(s); assert the `"scaleY"` enum-value appears as **BOTH `"Uniform"` AND `"Volume"`** across the rig's constraints/poses (per `42-OWNER-EXPORT-SPEC.md` §5).

---

### `tests/runtime43/slider43-smoke.spec.ts` (NEW, OPTIONAL — D-02)

**Analog:** `tests/runtime43/load43.ts` `tryLoad43()` idiom (loud-or-skip presence guard). D-02 = `SLIDER_4_3/` **existence only** + an OPTIONAL smoke `pickRuntime('4.3')` + `rt.parseSkeleton`-no-throw. **NO closed-form/analytical slider-peak assertion** (that is SLIDER-01/02 — Phase 46; do NOT pull it in).

---

### `tests/safe01/discover-fixtures.ts` (MOD — path-prefix denylist, D-04)

**Analog:** SELF — a 1-line `.filter()` inside the existing `discover()` (RESEARCH Pattern 4 — RECOMMENDED mechanism; the discretion is the mechanism, the exclusion itself is LOCKED).

**CO-REQUIRED BY THE DISPATCH FLIP — not independent polish (Pitfall 1).** Current `discover()` (discover-fixtures.ts:80–101, LIVE-VERIFIED):
```typescript
export function discover(): DiscoveryResult {
  const files = globSync('fixtures/**/*.json')
    .map((f) => f.replace(/\\/g, '/'))
    .sort();                                                  // [81-83] ← INSERT the denylist .filter() HERE
  // ...
  for (const fixture of files) {
    try {
      const load = loadSkeleton(fixture);                     // [90] ← TODAY: throws SpineVersionUnsupportedError on every
      const output = sampleSkeleton(load);                    //         4.3 fixture → naturally excluded.
      included.push({ fixture, output, gitTracked: isGitTracked(fixture) });   // POST-FLIP: 4.3 routes-and-samples → would
    } catch (err) {                                           //         become INCLUDED → safe01-enumeration deep-equal +
      const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      excluded.push({ fixture, reason });                     //         safe01-baseline byte-compare FALSE-TRIP
    }
  }
  return { included, excluded };
}
```
**Exact edit (RESEARCH Pattern 4, after `globSync`, before the loop):**
```typescript
const SAFE01_EXCLUDED_PREFIXES = [
  'fixtures/SIMPLE_PROJECT_43/',  // D-04: postdates pre-v1.6 freeze (4.3 file + 4.2 sibling skeleton2_42.*) — no SAFE-01 baseline
  'fixtures/SLIDER_4_3/',         // D-04
  'fixtures/XTRA01_4_3/',         // D-04
  'fixtures/XTRA02_4_3/',         // D-04
] as const;
const files = globSync('fixtures/**/*.json')
  .map((f) => f.replace(/\\/g, '/'))
  .filter((f) => !SAFE01_EXCLUDED_PREFIXES.some((p) => f.startsWith(p)))
  .sort();
```
**Subtlest correctness point in the phase (RESEARCH Pattern 4):** `SPINE_4_3_TEST/`/`test_4.3/` (Phase-32 `4.3.x`/`-beta` canaries, gitignored, NOT in `_manifest.json`) **also become discoverable post-flip** (they route too). The reject-as-natural-exclusion that hid them is exactly what the flip removes. The planner MUST verify the exact set against `_manifest.json` during planning and ensure the denylist covers **every 4.3-routing fixture dir not in the frozen manifest**, not only the 4 D-04-named ones. The verification canary is `tests/safe01/safe01-enumeration.spec.ts` (must stay green AFTER the flip).

---

### `tests/safe01/phase-gate.ts` (MOD — 1-line const bump)

**Analog:** SELF — phase-gate.ts:23. `export const CURRENT_PHASE = 42 as const;` → `44`. This arms `tests/safe01/phase44-fixture-guard.spec.ts:55` (`it.skipIf(CURRENT_PHASE < 44)`) — flips its skip→hard-fail unless `fixtures/SIMPLE_PROJECT_43/` AND `fixtures/SLIDER_4_3/` exist (D-01 ensures the owner exports them first). Committed-constant by design — NOT a tracking-file parse (Q2-RESOLVED).

---

### D-11 test files (10× MOD — flip 4.3 arms reject→route; PRESERVE `<4.2`/`≥4.4` throws)

**Analog:** `tests/core/loader-version-guard-predicate.spec.ts` (the canonical D-11 shape — `describe`/`it` + `expect(() => checkSpineVersion(v, SKEL)).toThrow(SpineVersionUnsupportedError)` / `.not.toThrow()` + `detectedVersion`/`skeletonPath` field asserts). Same edit pattern applies to all 10.

**The 10 D-11 files (planner enumerates exhaustively — CONTEXT D-11):**
`tests/core/loader-43-schema-guard-predicate.spec.ts`, `tests/core/loader-version-guard-predicate.spec.ts`, `tests/core/loader-version-guard.spec.ts`, `tests/core/errors-version.spec.ts`, `tests/core/loader.spec.ts`, `tests/runtime/d13-43-load-smoke.spec.ts` (this one ALREADY wants the new behavior — Phase 44 "makes it real"), `tests/core/ipc.spec.ts`, `tests/main/ipc.spec.ts`, `tests/main/viewer-asset-feed-ipc.spec.ts`, `tests/safe01/discover-fixtures.ts` (the denylist above).

**D-11 rule (a false-green guard):** flip ONLY the 4.3-input arms to assert **routing** (dispatch target / no throw). **PRESERVE the `<4.2` and `≥4.4` throw-cases as EXPLICIT assertions** — a passing test still asserting the OLD 4.3-reject is a *false-green*; deleting the `<4.2`/`≥4.4` throw assertions is a silent descope (memory `feedback_replan_can_silently_descope_roadmap_contract`). Add explicit new cases: `4.3.0→route`, `4.3.99→route`, `4.3.73-beta→route`, `4.2-from-4.3.01→4.2`, `4.4.0→throw`, `5.0.0→throw`, `token=4.3+legacy→throw`, `token=4.2+constraints[]→throw` (Pitfall 2). Keep CI green at Phase 44 exit; the user-facing copy/docs/drop-zone sweep stays Phase 45 (ROADMAP Phase-45 SC#3 split is documented in CONTEXT D-11, NOT silently descoped).

---

### Fixture-commit task (D-05) — stage + commit 5 artifacts with plain-English git narration

**No code analog (operational executor task).** Stage + commit: the on-disk-UNCOMMITTED `fixtures/SIMPLE_PROJECT_43/skeleton2_42.{json,atlas,png}` (the ORCL-02 4.2 leg) + the 3 owner rigs (`fixtures/SLIDER_4_3/`, `fixtures/XTRA01_4_3/`, `fixtures/XTRA02_4_3/`) + the first-capture XTRA own-baseline files (`tests/runtime43/baselines/XTRA0{1,2}_4_3.json`). Each fixture lands in the SAME phase/plan as the test that consumes it. **The user does NOT run git** — the executor narrates every git step in plain English (memory `user_git_experience` / `feedback_explain_git`). D-15 is RESOLVED to a HARD PASS: `skeleton2_42.atlas` (new libgdx format) parses through `spine-core@4.2.111` as-is — **NO `.atlas` normalization step**; the skeleton JSON is byte-untouched (JSON-invariant since v1.0).

---

## Shared Patterns

### `SamplerOutput` / `PeakRecord` shape (the exact structure ORCL-02 D-12 + XTRA own-baselines D-03 compare)
**Source:** `src/core/sampler.ts:117–121` (`SamplerOutput`) + `src/core/types.ts:202–231` (`SampleRecord`; `PeakRecord` at sampler.ts:95–98 extends it with `isSetupPosePeak: boolean`). LIVE-VERIFIED.
**Apply to:** `orcl02-equivalence.spec.ts`, `xtra0{1,2}-baseline.spec.ts`.
```typescript
// src/core/sampler.ts:117-121
export interface SamplerOutput {
  globalPeaks: Map<string, PeakRecord>;      // key: `${skinName}/${slotName}/${attachmentName}`
  perAnimation: Map<string, PeakRecord>;     // key: `${animationName}/${skinName}/${slotName}/${attachmentName}`
  setupPosePeaks: Map<string, PeakRecord>;   // key: `${skinName}/${slotName}/${attachmentName}`
}
// src/core/types.ts:222-231 — the NUMERIC fields the D-13 `close()` comparator iterates per record:
//   peakScaleX, peakScaleY, peakScale (= max of the two), worldW, worldH, sourceW, sourceH
//   (string/key fields attachmentKey/skinName/slotName/attachmentName/regionName/animationName
//    compare via exact equality, NOT the tolerance comparator)
```
**Note:** D-12 compares ALL THREE maps; key-set divergence in ANY map is a failure (the silent classify-as-skip class — Pitfall 4). `canonicalize()` is applied before the numeric compare so a NaN/signed-zero from a broken pose read is sentinelized, not silently equal.

### Cross-runtime sampler driver — DO NOT hand-roll
**Source:** `tests/runtime43/baseline-driver.ts` — `buildLoad43()` (lines 128–157), `buildLoadSibling42()` (lines 192–211), `loadSibling42()` (164–185), `sample()` (259–261), `squarePeakScale()` (265–272).
**Apply to:** `orcl02-equivalence.spec.ts` (reuse `buildLoad43`/`buildLoadSibling42`/`sample` as-is); `xtra0{1,2}-baseline.spec.ts` (the planner ADDS `buildLoadXtra01`/`buildLoadXtra02` to this file by cloning the `buildLoad43` body verbatim, swapping fixture paths). `buildLoad43` replicates `loader.ts`'s `sourceDims` derivation (`buildSourceDims`, lines 66–118) so the 4.3/XTRA sample is faithful — re-deriving the `LoadResult` shape risks a faithfulness drift this driver already solved (RESEARCH "Don't Hand-Roll").

### Loud-or-skip fixture presence guard — DO NOT hand-roll ENOENT logic
**Source:** `tests/runtime43/load43.ts` `tryLoad43()` (lines 47–78).
**Apply to:** `slider43-smoke.spec.ts`; the `buildLoadXtra01/02` helpers; any new fixture access.
```typescript
// tests/runtime43/load43.ts:51-72 — the verification-integrity contract (43-03):
const rt = pickRuntime('4.3');
if (rt == null) throw new Error('tryLoad43: pickRuntime(\'4.3\') returned null — ... verification-integrity failure, NOT a Wave-0 skip.');
try {
  json = JSON.parse(readFileSync(FIXTURE_43, 'utf8'));
  atlasText = readFileSync(ATLAS_43, 'utf8');
} catch (err) {
  if (isFileAbsent(err)) return null;   // ONLY ENOENT → legit Wave-0 skip
  throw err;                            // parse defect / runtime-43 bug → PROPAGATE (never a silent skip)
}
```
**Why:** a broken `pickRuntime` must PROPAGATE (fail loud), only genuine fixture absence is a skip. Re-rolling risks silently swallowing a broken runtime as a "skip" (the 43-03 verification-integrity fix; memory `feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam`).

### Deterministic 3-map serializer — DO NOT hand-roll deep-equal
**Source:** `tests/safe01/canonical-json.ts:96` `canonicalize(output, { fixture })` — recursive sorted-key + non-finite/signed-zero string sentinels + 15-sig-digit clamp (`toPrecision(15)` at line 61).
**Apply to:** `orcl02-equivalence.spec.ts` (canonicalize both legs before the D-13 compare), `xtra0{1,2}-baseline.spec.ts` (serialize for the own-baseline `toEqual`). A hand-rolled compare reintroduces the NaN→silent-equal / -0→0 traps this already solved.

### Own-baseline frozen-shape — DO NOT hand-roll a write-or-assert harness
**Source:** `tests/runtime43/runtime43-baseline.spec.ts:35–93` — `frozenPart()` (35–41) + `existsSync(BASE) ? assert : write` (74–92).
**Apply to:** `xtra0{1,2}-baseline.spec.ts`. SEPARATE store (`tests/runtime43/baselines/`), NOT golden-shared with SAFE-01. First-capture writes are EXPECTED (commit the captured XTRA baselines — D-05).

### Multi-runtime entrypoint verification (NOT a vitest spec — a verification task)
**Source:** RESEARCH §Multi-Runtime Entrypoint Matrix; `src/core/runtime/runtime.ts:174–217`.
**Apply to:** the dispatch-flip plan's verification step (Pitfall 5 / A3 — co-required by the `'4.3'` `require('../runtime-43.cjs')` arm being production-exercised for the first time):
1. `npm run test` (vitest globalThis-resolver arm) — DISP/ORCL/XTRA specs green.
2. `npm run build` then sample a 4.3 fixture through the **BUILT** `out/main` worker (NOT `src/`) — the built worker routes 4.3 → runtime-43; lazy-single-copy preserved (re-verify per memory `project_phase43_pickruntime_esm_split` — the dispatch flip changes the worker's bundled graph).
3. `npm run cli -- fixtures/SIMPLE_PROJECT_43/skeleton2.json` (tsx/ESM arm, `scripts/register-esm-adapter-resolver.ts`) — produces a table, NOT a `pickRuntime` loud-throw or a reject.

---

## No Analog Found

None. Every new file has a direct in-repo prototype (this is an assembly phase by design — Phase 43 deliberately left a ~90%-complete oracle harness; RESEARCH "Key insight"). The two structural-assertion specs (`xtra0{1,2}-structural.spec.ts`) have no *behavioral* analog but reuse the standard vitest describe/it + `JSON.parse(readFileSync(...))` skeleton; their assertion TARGETS are the verified 4.3.0 spine-core type shapes documented inline above (not a codebase analog — by nature these parse fixture JSON, no runtime).

---

## Metadata

**Analog search scope:** `src/core/` (loader.ts, errors.ts, sampler.ts, types.ts, runtime/runtime.ts, runtime/types.ts), `tests/runtime43/` (runtime43-d03, runtime43-baseline, baseline-driver, load43), `tests/safe01/` (discover-fixtures, phase-gate, phase44-fixture-guard, canonical-json), `tests/core/` (loader-version-guard-predicate as the D-11 exemplar).
**Files scanned:** 14 source/test files read in full or targeted; all code anchors LIVE-VERIFIED against the working tree on 2026-05-17 (CONTEXT.md anchors found stale and corrected; RESEARCH.md anchors confirmed accurate).
**Pattern extraction date:** 2026-05-17

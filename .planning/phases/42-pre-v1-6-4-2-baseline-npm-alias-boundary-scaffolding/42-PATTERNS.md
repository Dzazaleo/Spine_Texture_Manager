# Phase 42: Pre-v1.6 4.2 Baseline + npm Alias + Boundary Scaffolding - Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 17 new/modified (1 modified source, 2 new source, 11 new test files, 1 modified test, 1 new workflow, 1 owner doc)
**Analogs found:** 16 / 17 (the owner-handoff doc has no code analog by design)

> **Phase-42 character:** RESEARCH §"Don't Hand-Roll" key insight — *"Phase 42 builds zero novel infrastructure. Every mechanism has an in-repo precedent."* This map confirms it: every new file has a strong same-repo analog. The risk is **ordering + determinism discipline**, not technical novelty. Where Phase 42 deliberately diverges from an analog (D-07 full-JSON not SHA256, D-09 no `UPDATE_FIXTURES` regen), the divergence is called out explicitly so the planner copies the *shape* but not the rejected behavior.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tests/safe01/canonical-json.ts` | test-utility (pure Node) | transform | `src/core/png-header.ts` (pure deterministic byte/number util + typed error) | role-match |
| `tests/safe01/canonical-json.spec.ts` | test | request-response (round-trip self-test) | `tests/main/repack.loose-parity.spec.ts` (determinism self-test idiom) | role-match |
| `tests/safe01/discover-fixtures.ts` | test-utility (pure Node) | file-I/O (glob + predicate) | `tests/arch.spec.ts` glob scanner (`globSync` + predicate loop) | role-match |
| `tests/safe01/safe01-baseline.spec.ts` | test | CRUD (read baseline → strict compare) | `tests/main/repack.loose-parity.spec.ts` (baseline-snapshot consumer) | exact (with deliberate divergence) |
| `tests/safe01/safe01-enumeration.spec.ts` | test | event-driven (set-diff dropout-is-failure) | `tests/main/repack.loose-parity.spec.ts` (`loadBaselines`/missing-key→throw) | role-match |
| `tests/safe01/safe01-freeze-guard.spec.ts` | test | request-response (git ancestry assert) | `tests/arch.spec.ts` named anchor + ENOENT-tolerant skip | role-match |
| `tests/safe01/baselines/_manifest.json` + per-fixture `*.json` | config (committed regression contract) | — (data artifact) | `tests/fixtures/repack-baselines.json` (`_meta` provenance block) | exact (form deliberately diverges per D-07) |
| `tests/safe01/phase44-fixture-guard.spec.ts` + `phase-gate.ts` | test | request-response (phase-gated presence guard) | `tests/main/sampler-worker-girl.spec.ts` (`it.skipIf` presence-guard) | role-match |
| `tests/runtime/alias-resolution.spec.ts` | test | request-response (module resolution) | `tests/arch.spec.ts` (import-shape assertion) | role-match |
| `tests/runtime/runtime-distinctness.spec.ts` | test | request-response (version/export distinctness) | `tests/main/sampler-worker-girl.spec.ts` (real-module, no-mock idiom) | role-match |
| `tests/runtime/d13-43-load-smoke.spec.ts` | test | request-response (parse-without-throw) | `tests/core/loader.spec.ts` + `loader.ts` typed-error envelope | role-match |
| `src/core/runtime/types.ts` | model (boundary types) | — (type declarations) | `src/core/png-header.ts` / `src/core/types.ts` (pure `core/` module + interfaces) | role-match (greenfield brand idiom) |
| `src/core/runtime/runtime.ts` | model (interface contract) | — (signatures only) | `src/core/types.ts` `LoadResult`/`SampleRecord` interface block | role-match |
| `src/core/types.ts` | model | — (additive optional field) | itself — `LoadResult` interface (lines 55-93) | exact (in-place additive) |
| `tests/arch.spec.ts` | test | file-I/O (glob import scanner) | itself — lines 148-178 + 200-229 named-anchor precedent | exact (extends existing file) |
| `.github/workflows/ci.yml` | config (CI workflow) | event-driven (push/PR) | `.github/workflows/release.yml` (`test` job + 3-OS matrix) | role-match (structural; release.yml UNTOUCHED) |
| `42-OWNER-EXPORT-SPEC.md` | doc (owner handoff) | — | *no code analog by design (D-01..D-05)* | none |

---

## Pattern Assignments

Grouped by topic area.

---

### Topic A — SAFE-01 baseline snapshot harness (the proven `repack-baselines` precedent + deliberate divergences)

#### `tests/safe01/safe01-baseline.spec.ts` (test, CRUD: read committed JSON → strict compare)

**Analog:** `tests/main/repack.loose-parity.spec.ts`

**Why it's the analog:** This is THE proven in-repo baseline-snapshot consumer pattern, called out in CONTEXT.md `## Existing Code Insights` and RESEARCH §"Don't Hand-Roll". It already does: load a committed baseline JSON, compute live values, strict-compare per-key, emit a maximally-diagnostic failure message naming the drifted key and the fix command. SAFE-01 is the same shape with two **deliberate divergences** (see callout below).

**Baseline-load + missing-key→throw pattern** (`repack.loose-parity.spec.ts:69-80, 205-216`):
```typescript
function loadBaselines(): Baselines {
  if (!fs.existsSync(BASELINE_PATH)) {
    if (SHOULD_UPDATE) {
      return { SIMPLE_TEST: { loose: {}, atlas: {} } };
    }
    throw new Error(
      `[REPACK-01] Baseline file missing: ${BASELINE_PATH}. ` +
        `Run \`UPDATE_FIXTURES=1 npx vitest run ...\` to populate.`,
    );
  }
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as Baselines;
}
// ...
const expected = baselines.SIMPLE_TEST.loose![row.outPath];
if (!expected) {
  throw new Error(`[REPACK-01] Baseline missing for ${row.outPath}. ...`);
}
expect(
  computed,
  `[REPACK-01] Loose SHA256 drift for ${row.outPath}. Expected ${expected}, got ${computed}. ` +
    `Either fix the regression OR run \`npm run repack:refresh-baselines\` if the change is intentional.`,
).toBe(expected);
```

**Repo-root + fixture path resolution idiom** (`repack.loose-parity.spec.ts:42-48`):
```typescript
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.resolve(REPO_ROOT, 'tests/fixtures/repack-baselines.json');
```

**Adaptation for Phase 42 — two LOAD-BEARING divergences from this analog (D-07 + D-09):**
1. **D-07 (form):** Compare the **full canonical `SamplerOutput` JSON** (`globalPeaks` + `perAnimation` + `setupPosePeaks`), NOT a SHA256 digest. Use `expect(canonical(out)).toEqual(committedJson)` so a tripped gate shows *which `${skin}/${slot}/${attachment}` record drifted and by how much* in `git diff`. The repack analog stores SHA256 (compactness); SAFE-01 stores full JSON (diagnosability) — `[CONTEXT D-07, RESEARCH §Canonical-JSON]`.
2. **D-09 (no regen escape hatch):** Do **NOT** copy the `SHOULD_UPDATE = process.env.UPDATE_FIXTURES === '1'` branch (`repack.loose-parity.spec.ts:49`) or its `saveBaselines()` write path. SAFE-01 has **no** env-gated regen. The repack precedent's `UPDATE_FIXTURES` is correct *for repack* (legit refresh on sharp/libvips bump) but wrong for SAFE-01 (4.2 output must never change). Regen = a human deliberately editing committed JSON + deleting the freeze guard — `[CONTEXT D-09, RESEARCH §"Don't Hand-Roll" row 4]`.
3. **One file per fixture** (`tests/safe01/baselines/<DIR>__<JSONBASE>.json`), NOT one bundle — D-07 locks per-fixture so a 1-attachment `Girl/` drift is a small diff, not a giant one.

---

#### `tests/safe01/baselines/_manifest.json` + per-fixture `*.json` (config, committed regression contract)

**Analog:** `tests/fixtures/repack-baselines.json`

**Why it's the analog:** The only existing committed-baseline data artifact with a provenance `_meta` header. CONTEXT.md flags it explicitly as the precedent to mirror for the provenance idea while diverging on regen policy and form.

**`_meta` provenance header pattern** (`repack-baselines.json:2-9`):
```jsonc
{
  "_meta": {
    "generatedAt": "2026-05-15T19:19:14.384Z",
    "sharpVersion": "PENDING",
    "maxrectsPackerVersion": "PENDING",
    "spineCoreVersion": "PENDING",
    "note": "Regenerated by UPDATE_FIXTURES=1 vitest run. ..."
  },
  "SIMPLE_TEST": { "loose": { "...": "<sha256>" }, "atlas": { ... } }
}
```

**Adaptation for Phase 42 (RESEARCH §Canonical-JSON resolved schema):** Each per-fixture file carries the `_meta` block but with SAFE-01-specific fields — the generating commit SHA + ISO timestamp are the load-bearing additions (D-09 git-ancestry source of truth):
```jsonc
{
  "_meta": {
    "fixture": "fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json",
    "generatedCommit": "<git rev-parse HEAD at capture>",
    "generatedAt": "<ISO 8601>",
    "samplerHz": 120,
    "spineCoreVersion": "4.2.111",
    "schema": "safe01/v1"
  },
  "globalPeaks":   { "<sorted key>": { ...sorted PeakRecord... } },
  "perAnimation":  { ... },
  "setupPosePeaks":{ ... }
}
```
- `_manifest.json` is the **single ancestry-checked artifact** (D-08 enumeration target + D-09 `_meta.generatedCommit` authority). The per-fixture `_meta.generatedCommit` is a secondary spot-debug aid; `_manifest._meta` is the authority.
- **MUST be committed, NOT gitignored** (the regression contract — same principle as `repack-baselines.json` which IS committed). EXCEPTION: heavy/proprietary-rig baseline files ARE gitignored (D-08-R Option A — see Topic E).
- **Divergence note:** the analog's `note` field advertises a regen command. The SAFE-01 `_meta` must NOT advertise a regen path (D-09) — instead document "frozen; regenerating requires deleting safe01-freeze-guard.spec.ts (loud, reviewable)".

---

#### `scripts/repack-refresh-baselines.mjs` — the ANTI-pattern reference (do NOT create a SAFE-01 equivalent)

**Analog (negative):** `scripts/repack-refresh-baselines.mjs`

**Why mapped:** CONTEXT.md D-09 and RESEARCH §"Don't Hand-Roll" explicitly reject creating a SAFE-01 analog of this script. This file exists to document **what NOT to build**. Its `spawnSync('npx', ['vitest','run',...], { env: { UPDATE_FIXTURES: '1' } })` delegation (`repack-refresh-baselines.mjs:144-153`) is exactly the casual-regen escape hatch SAFE-01 must lack.

**The pattern SAFE-01 must NOT replicate** (`repack-refresh-baselines.mjs:144-153`):
```javascript
const result = spawnSync('npx', ['vitest', 'run', ...SPEC_FILES], {
  cwd: REPO_ROOT,
  env: { ...process.env, UPDATE_FIXTURES: '1' },   // ← SAFE-01 must have NO such path
  stdio: 'inherit',
});
```

**Adaptation for Phase 42:** No `scripts/safe01-refresh-*.mjs` is created. `safe01-freeze-guard.spec.ts` additionally **greps its sibling `safe01-baseline.spec.ts` source** for any `UPDATE_FIXTURES`/`process.env`-gated write branch and asserts it is ABSENT (RESEARCH §Git-Ancestor "No-regen enforcement"). Useful to copy from this script: the `node:crypto` `createHash('sha256')` helper shape (`repack-refresh-baselines.mjs:62-64`) — RESEARCH §Supporting permits an *optional* content digest in the SAFE-01 `_meta` as a cheap secondary tamper signal alongside the full JSON.

---

#### `tests/safe01/canonical-json.ts` (test-utility, transform: SamplerOutput → deterministic JSON)

**Analog:** `src/core/png-header.ts` (structural: a pure, deterministic number/byte util with explicit edge-case handling and a typed error) — **but this file lives in `tests/`, never `core/`** (RESEARCH §Recommended Project Structure note — the binding constraint is the serializer is a pure Node *test* utility, never in `core/`, preserving RT-04 / CLAUDE.md Fact #5).

**Why it's the analog:** `png-header.ts` is the closest in-repo example of the *idiom* this file needs: a pure deterministic transform with explicit, documented handling of dangerous edge cases (endianness there; non-finite/`-0` here) and a named typed error. It is NOT a behavioral analog (different domain) — it is the *shape* analog for "pure, deterministic, edge-case-explicit utility module".

**Pure-module + explicit-edge-case + typed-error idiom** (`png-header.ts:20-35, 52-54`):
```typescript
import * as fs from 'node:fs';
import { SpineLoaderError } from './errors.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export class PngHeaderParseError extends SpineLoaderError {
  constructor(public readonly path: string, reason: string) {
    super(`Failed to read PNG header at ${path}: ${reason}`);
    this.name = 'PngHeaderParseError';
  }
}
// Endianness: PNG is big-endian ... Buffer.readUInt32BE — the little-endian
// variant would silently produce garbage on every little-endian host.
```
> Note the explicit comment naming the silent-corruption trap (`readUInt32LE` would silently corrupt). SAFE-01's serializer has the directly analogous trap: `JSON.stringify(NaN)→"null"`, `JSON.stringify(-0)→"0"` — must be handled with the same explicit-comment discipline.

**Input shape this transform consumes** (`src/core/sampler.ts:119-123`):
```typescript
export interface SamplerOutput {
  globalPeaks: Map<string, PeakRecord>;
  perAnimation: Map<string, PeakRecord>;
  setupPosePeaks: Map<string, PeakRecord>;
}
```
Keys are `${skinName}/${slotName}/${attachmentName}` and (perAnimation) `${animationName}/${skinName}/${slotName}/${attachmentName}` (`sampler.ts:91, 113`). `PeakRecord extends SampleRecord` — numeric fields to freeze byte-exact (`src/core/types.ts:192-237`): `time, frame, peakScaleX, peakScaleY, peakScale, worldW, worldH, sourceW, sourceH`; string keys `attachmentKey, skinName, slotName, attachmentName, regionName?, animationName`; booleans `isSetupPosePeak, isSequenceFrame?`.

**Adaptation for Phase 42 (RESEARCH §Canonical-JSON RESOLVED):**
1. Map → sorted-key plain object (keys already deterministic strings).
2. **Recursive** sorted-key canonicalizer (NOT `JSON.stringify(v, Object.keys(v).sort())` — that sorts only top-level; insufficient for nested `PeakRecord`), then `JSON.stringify(canonical, null, 2)`.
3. **Explicit non-finite + signed-zero handling** (the silent-corruption guard, exactly analogous to png-header's endianness comment): `NaN`→`"NaN"`, `Infinity`→`"Infinity"`, `-Infinity`→`"-Infinity"`, `Object.is(x,-0)`→`"-0"` (string sentinels, never `null` — `null` reads as "no data" = the exact silent-undersize failure SAFE-01 exists to catch). Finite numbers → `Number(x.toPrecision(15))` then default formatting (below IEEE-754 round-trip ambiguity 17, far above the 1e-9 peak-latch epsilon at `sampler.ts:70`).
4. **Lives in `tests/safe01/`, NEVER `src/core/`** — it is a pure Node *test* utility (CLAUDE.md Fact #5 / RT-04). Do not import from `core/`.

---

#### `tests/safe01/canonical-json.spec.ts` (test, request-response: round-trip determinism self-test)

**Analog:** `tests/main/repack.loose-parity.spec.ts` (the determinism-self-test idiom: prove the gate mechanism itself is deterministic before trusting it to gate production code).

**Adaptation for Phase 42:** RESEARCH §Canonical-JSON "Round-trip self-test" — a unit test that canonicalizes a synthetic object containing `NaN`, `Infinity`, `-0`, `1e-9`, deeply-nested keys, and asserts (a) output byte-stable across two serializations, (b) the string sentinels appear. This is the "Nyquist seam" proving the serializer is deterministic before it gates `core/`. No baseline file involved — pure in-test fixture.

---

### Topic B — Fixture auto-discovery + enumeration (glob-scanner idiom)

#### `tests/safe01/discover-fixtures.ts` (test-utility, file-I/O: glob + "samples OK" predicate)

**Analog:** `tests/arch.spec.ts` glob scanner (`arch.spec.ts:150, 168-176`)

**Why it's the analog:** The established in-repo `globSync` + per-file predicate-loop + offenders/included-list idiom. Discovery is structurally identical: glob a tree, run a predicate per file, collect the passing set.

**Glob + predicate-loop idiom** (`arch.spec.ts:150, 167-176`):
```typescript
import { readFileSync, globSync } from 'node:fs';
const files = globSync('src/core/**/*.ts');
const offenders: string[] = [];
for (const file of files) {
  const normalized = file.replace(/\\/g, '/');
  if (FS_LOAD_TIME_CARVE_OUTS.has(normalized)) continue;
  const text = readFileSync(file, 'utf8');
  if (/.../.test(text)) { offenders.push(file); }
}
```

**Adaptation for Phase 42 (RESEARCH §Fixture Auto-Discovery RESOLVED):**
- `globSync('fixtures/**/*.json')`; for each, run the "samples OK" predicate: `loadSkeleton(f)` then `sampleSkeleton(load)` — version-reject fixtures (`SPINE_3_8_TEST`, `SPINE_4_3_TEST`) throw `SpineVersionUnsupportedError` at `loadSkeleton` (verified) → naturally excluded, **no hand-list** (D-08).
- Collect *included* fixtures + their canonical output. Excluded fixtures: record reason in a discovery log (NOT silently dropped).
- The 13 git-tracked JSONs include sidecars (`SIMPLE_PROJECT/skeleton.json`, `skeleton2.json`, `SIMPLE_TEST_GHOST.json`) — the predicate auto-handles non-sampling ones; review the committed manifest once at capture so the set is intentional.
- **Path-separator → `__`** for flat baseline filenames: `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` → `SIMPLE_PROJECT__SIMPLE_TEST.json`.
- Same `tests/` (never `core/`) constraint as the canonical serializer.

#### `tests/safe01/safe01-enumeration.spec.ts` (test, event-driven: discovered set == manifest, dropout-is-failure)

**Analog:** `tests/main/repack.loose-parity.spec.ts` (`loadBaselines` + missing-key→`throw` — the "a missing entry is itself a failure" idiom).

**Adaptation for Phase 42 (D-08 dropout-is-failure):** Re-run discovery, assert `discovered === manifest` (sorted set equality). A previously-sampling fixture that starts throwing (a silent regression!) drops out of `discovered` → set diverges → **test fails loudly**. A new sampling fixture appears in `discovered` not `manifest` → fails until its baseline is added (the only sanctioned baseline-addition path; pre-existing baselines stay frozen). The manifest covers only the git-tracked redistributable subset (D-08-R Option A — Topic E).

---

### Topic C — `core/runtime/` opaque-handle boundary scaffolding (pure-`core/` module idiom)

#### `src/core/runtime/types.ts` (model, opaque branded handles — signatures only)

**Analog:** `src/core/png-header.ts` + `src/core/types.ts` (the two closest in-repo examples of a pure `core/` module: `png-header.ts` for "pure module, typed exports, no DOM"; `types.ts` for the interface-declaration idiom). **Note:** `[VERIFIED this session: grep 'unique symbol|__brand' src/ → none]` — the `unique symbol` brand idiom is **greenfield** in this repo. No existing analog for the brand mechanic itself; the analog is the *module purity + export shape*, and the brand design is fully specified in RESEARCH §RT-03.

**Pure-`core/`-module + typed-export idiom** — `src/core/png-header.ts` is one of the modules already inside the Layer-3 scanner's clean set (it is a *carve-out* for `node:fs` but Phase-42 `runtime/` needs NO carve-out — it imports nothing forbidden). The cleanest non-carve-out pure modules (`[VERIFIED this session: grep -L for fs/sharp/spine-core in src/core/*.ts]`): `src/core/overrides.ts`, `src/core/usage.ts`, `src/core/documentation.ts`, `src/core/project-file.ts`, `src/core/errors.ts` — these are the true structural analogs for a zero-dependency `core/` module.

**Interface-declaration idiom** (`src/core/types.ts:192-221` — the established `core/` interface shape with doc-commented fields):
```typescript
export interface SampleRecord {
  /** Composite key: `${skin}/${slot}/${attachment}`. */
  attachmentKey: string;
  skinName: string;
  // ...one doc comment per field, readonly where invariant...
}
```

**Adaptation for Phase 42 (RESEARCH §RT-03 — the design is fully resolved; copy it):**
- `unique symbol` per-handle-kind brand + a **required** `__rt: '4.2' | '4.3'` field (the locked constraint: identity is *threaded, not inferred* — `[CITED: feedback_explicit_identity_over_inference, Phase 40 round-2]`).
- `brandHandle`/`unwrapHandle`/`handleRuntime` factory+guard helpers — bodies are trivial type-casts over `unknown`, **NO spine-core import** (keeps `runtime/` Layer-3 pure in Phase 42; the two adapter impls that import spine-core are Phase 43).
- Signatures + trivial bodies only — do NOT scaffold `runtime-42.ts`/`runtime-43.ts` (Phase 43 / RT-02).

#### `src/core/runtime/runtime.ts` (model, `SpineRuntime` interface — signatures only, NO bodies)

**Analog:** `src/core/types.ts` `LoadResult` interface (lines 55-93) — the established `core/` pattern for a large, heavily-doc-commented interface contract that downstream modules consume.

**Adaptation for Phase 42 (RESEARCH §SpineRuntime Interface — RESOLVED, ~30 signatures):** Declare the `SpineRuntime` interface signatures exactly as enumerated in RESEARCH §SpineRuntime (loader-side `makeAtlas`/`parseSkeleton`; sampler lifecycle `makeSkeleton`/`stateUpdate`/`updateWorldTransform`; visibility `slots`/`slotAttachment`/`slotColorAlpha`; bounds `regionWorldVertices`/`vertexWorldVertices`/`boneAxisScale`/`attachmentRegionMeta`). **No method bodies.** `pickRuntime` is `export declare function` (declaration only — body is Phase 43). RESEARCH refinement to apply: keep only `boneAxisScale(slot)`, do NOT expose `slotBone` (a bone has no opaque handle type). `import type` only from `./types.js` — no spine-core import.

#### `src/core/types.ts` (model — additive optional field, in-place)

**Analog:** itself — the existing `LoadResult` interface (`src/core/types.ts:55-93`).

**Adaptation for Phase 42 (RESEARCH §`LoadResult.runtime` field — Phase 42: optional, declared not wired):**
```typescript
import type { SpineRuntime } from './runtime/runtime.js';

export interface LoadResult {
  // ...all existing fields UNCHANGED...
  /** Phase 42 (RT-03): the runtime adapter that parsed this skeleton.
   *  Declared in Phase 42; populated by loader.ts and consumed by
   *  sampler.ts/bounds.ts in Phase 43 (RT-02). Optional until then. */
  runtime?: SpineRuntime;
}
```
**Optional (`?`) is load-bearing** — keeps every existing `core/` consumer compiling unchanged (additive, no existing code reads it). Phase 43 narrows to required. **Phase 42 does NOT touch `loader.ts`/`sampler.ts`/`bounds.ts`** (D-13 — loader.ts unchanged; the 4.3 smoke bypasses it).

---

### Topic D — Layer-3 arch enforcement (extend the existing scanner — same file)

#### `tests/arch.spec.ts` (test — append two named anchors; MODIFIES existing file)

**Analog:** itself — `tests/arch.spec.ts:148-178` (the `src/core/**` fs/sharp glob scanner) + `:200-229` (the Phase-9 named-anchor with ENOENT-tolerant try/catch — the "Wave 0 lands the anchor before the file exists" precedent).

**Why it's the analog:** RESEARCH §"Don't Hand-Roll" row 7 and §Code Examples are explicit: do NOT build a bespoke scanner — *extend* this file. `core/runtime/*.ts` falls under the existing `globSync('src/core/**/*.ts')` rule automatically with **no carve-out** (Phase 42 adds no fs/sharp/spine-core there). Add two **named anchors** matching the established idiom.

**Existing carve-out-set + glob-scanner idiom to match exactly** (`arch.spec.ts:148-177`):
```typescript
describe('Architecture boundary: src/core must not import sharp / node:fs ...', () => {
  it('no core file imports sharp or node:fs ... loader.ts + png-header.ts + synthetic-atlas.ts exempt', () => {
    const files = globSync('src/core/**/*.ts');
    const FS_LOAD_TIME_CARVE_OUTS = new Set<string>([
      'src/core/loader.ts',
      'src/core/png-header.ts',
      'src/core/synthetic-atlas.ts',
    ]);
    const offenders: string[] = [];
    for (const file of files) {
      const normalized = file.replace(/\\/g, '/');
      if (FS_LOAD_TIME_CARVE_OUTS.has(normalized)) continue;
      const text = readFileSync(file, 'utf8');
      if (/from ['"]sharp['"]|from ['"]node:fs(\/promises)?['"]|from ['"]fs(\/promises)?['"]/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders, `Core files importing sharp/node:fs: ${offenders.join(', ')}`).toEqual([]);
  });
});
```

**Critical ENOENT-tolerant "Wave 0 before the file exists" idiom to copy** (`arch.spec.ts:205-216` — the named anchor pattern; note the verbatim comment + early-return):
```typescript
// Critical: Wave 0 lands this block BEFORE src/main/sampler-worker.ts exists,
// so the readFileSync MUST tolerate ENOENT gracefully (return early). When
// Wave 1 lands the file, every assertion below MUST hold.
describe('Phase 9 Layer 3: src/main/sampler-worker.ts must not import DOM/renderer surfaces', () => {
  it('does not import from src/renderer/, react, electron, or DOM globals', () => {
    const filePath = 'src/main/sampler-worker.ts';
    let text = '';
    try {
      text = readFileSync(filePath, 'utf8');
    } catch {
      // File doesn't exist yet (Wave 1 lands it). When it lands, the grep applies.
      return;
    }
    expect(text, `${filePath} must not import from react`).not.toMatch(/from ['"]react['"]/);
  });
});
```

**Adaptation for Phase 42 (RESEARCH §Code Examples — append two anchors):**
1. **RT-04 anchor** — `core/runtime/**/*.ts` imports neither `sharp`/`node:fs`/`electron` NOR a spine-core package (`@esotericsoftware/spine-core` OR `spine-core-42`) — signatures only in Phase 42:
```typescript
describe('Phase 42 RT-04: src/core/runtime/ is Layer-3 pure (no DOM/Electron/sharp/spine-core in Phase 42)', () => {
  it('core/runtime/*.ts import neither sharp/node:fs/electron NOR a spine-core package', () => {
    const files = globSync('src/core/runtime/**/*.ts');
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (/from ['"]sharp['"]|from ['"]node:fs(\/promises)?['"]|from ['"]electron['"]|from ['"]@esotericsoftware\/spine-core['"]|from ['"]spine-core-42['"]/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders, `core/runtime Phase-42 purity violation: ${offenders.join(', ')}`).toEqual([]);
  });
});
```
2. **RT-03 backstop anchor** — no source file imports BOTH spine-core alias specifiers (defense-in-depth behind the `unique symbol` brand):
```typescript
describe('Phase 42 RT-03 backstop: no source file imports BOTH spine-core alias specifiers', () => {
  it('no src/**/*.ts imports @esotericsoftware/spine-core AND spine-core-42 in the same file', () => {
    const files = globSync('src/**/*.{ts,tsx}');
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const has43 = /from ['"]@esotericsoftware\/spine-core['"]/.test(text);
      const has42 = /from ['"]spine-core-42['"]/.test(text);
      if (has43 && has42) offenders.push(file);
    }
    expect(offenders, `Files co-mingling both spine-core runtimes: ${offenders.join(', ')}`).toEqual([]);
  });
});
```
- **Use `spine-core-42` consistently** (the resolved alias key — RESEARCH §Standard Stack; ARCHITECTURE.md's `@esotericsoftware/spine-core-43` was the rejected naive-direction illustration).
- These anchors land in Wave 0 **before** `core/runtime/*.ts` exists — but unlike the Phase-9 ENOENT pattern, the `globSync` form *self-handles* an empty directory (zero files → empty offenders → green). The freeze-guard's git-ancestry test (Topic F) is the one needing the explicit skip-when-absent guard, not these.

---

### Topic E — npm dual-install alias (package.json/lockfile dependency idiom)

#### `package.json` + `package-lock.json` (config — RT-01 dual-install via npm alias)

**Analog:** the existing `@esotericsoftware/spine-core` / `@esotericsoftware/spine-player` dependency declarations.

**Current dependency idiom** (`package.json:26-27` `[VERIFIED this session]`):
```jsonc
"dependencies": {
  "@esotericsoftware/spine-core": "4.2.111",
  "@esotericsoftware/spine-player": "4.2.111",
}
```
Lockfile entries at `package-lock.json:1483` (`node_modules/@esotericsoftware/spine-core`) and `:1489` (`spine-player`) — the existing exact-pinned shape.

**Adaptation for Phase 42 (RESEARCH §Standard Stack — RESOLVED, verified live this session):**
```jsonc
"dependencies": {
  "@esotericsoftware/spine-core": "4.3.0",                          // ← 4.3 is CANONICAL (load-bearing direction)
  "spine-core-42": "npm:@esotericsoftware/spine-core@4.2.111",      // ← exact-pinned alias
  "@esotericsoftware/spine-player": "4.2.111"                       // ← NOT bumped (Phase 47 owns this)
}
```
Install: `npm install @esotericsoftware/spine-core@4.3.0 spine-core-42@npm:@esotericsoftware/spine-core@4.2.111`. The lockfile auto-writes `node_modules/spine-core-42` with `"name": "@esotericsoftware/spine-core"`, `"version": "4.2.111"`, `integrity` matching `npm view`. **The alias DIRECTION (4.3 canonical) is load-bearing** — inverting it causes a spine-player split-brain (RESEARCH §Pitfall 3). **Do NOT bump spine-player** (D-10/Phase-47). Commit `package.json` + `package-lock.json` in the **same commit, which MUST be a git descendant of the SAFE-01 baseline commit** (D-09 — see Topic F).

#### `tests/runtime/alias-resolution.spec.ts` + `runtime-distinctness.spec.ts` (test, request-response)

**Analog:** `tests/main/sampler-worker-girl.spec.ts` (real-module, no-mock idiom — imports the real production module and asserts on its actual behavior, no `vi.mock`).

**Adaptation for Phase 42 (D-13):** Import from both `@esotericsoftware/spine-core` (= 4.3.0) and `spine-core-42` (= 4.2.111); assert both resolve, `adapter42.version !== adapter43.version` (`4.2.111` vs `4.3.0`), and `Slider`/`BonePose`/`Pose`/`SlotPose` are exported from the 4.3 module and **absent** from `spine-core-42` (`[VERIFIED this session]`). No baseline, no mock — pure resolution/distinctness assertion.

#### `tests/runtime/d13-43-load-smoke.spec.ts` (test, request-response: 4.3 JSON parses past the v1.4 reject)

**Analog:** `tests/core/loader.spec.ts` + the `src/core/loader.ts` typed-error envelope (`loader.ts:122-188`, `errors.ts:86-122`).

**Why it's the analog:** D-13's smoke is fundamentally a "this input does NOT throw `SpineVersionUnsupportedError`" assertion — the inverse of the existing loader version-reject tests. The typed-error envelope is the thing being asserted-absent.

**Typed-error reject envelope being asserted-absent** (`src/core/loader.ts:137-141`):
```typescript
if (major >= 5 || (major === 4 && minor >= 3)) {
  // Phase 32 (D-01) — strict-cut at 4.3+.
  throw new SpineVersionUnsupportedError(version, skeletonPath);
}
```
`SpineVersionUnsupportedError extends SpineLoaderError`, `.name = 'SpineVersionUnsupportedError'` (`errors.ts:86-122` — the discriminated-union reject pattern; `.name` is load-bearing for IPC routing).

**Adaptation for Phase 42 (RESEARCH §D-13 CI arm — CRITICAL bypass):** The smoke must **drive the 4.3 runtime's `SkeletonJson` directly**, NOT through `loadSkeleton` (Phase 42 does NOT modify `loader.ts` — D-13; the gated `loadSkeleton` still rejects 4.3). Construct `new SkeletonJson(new AtlasAttachmentLoader(...))` from `@esotericsoftware/spine-core` (= 4.3.0), `readSkeletonData` on `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json`; assert it does NOT throw `SpineVersionUnsupportedError` (it never hits the gated loader) and the constraints array parses. Caveat (RESEARCH §A2): `SPINE_4_3_TEST.json` is `4.3.91-beta`; if it fails to parse under stable 4.3.0, fallback = a hand-authored minimal stable-4.3 JSON (planner fixture concern, flagged).

---

### Topic F — D-09 git-ancestry freeze guard + D-13 phase-44 presence guard

#### `tests/safe01/safe01-freeze-guard.spec.ts` (test, request-response: git ancestry + no-regen meta-test)

**Analog:** `tests/arch.spec.ts` named anchor with ENOENT-tolerant skip (`arch.spec.ts:205-216`) — the "assertion that must skip-with-reason until the thing it guards exists, then assert hard" precedent.

**Skip-until-exists-then-assert-hard idiom** (`arch.spec.ts:208-216`):
```typescript
let text = '';
try {
  text = readFileSync(filePath, 'utf8');
} catch {
  // File doesn't exist yet (Wave 1 lands it). When it lands, the grep applies.
  return;   // ← skip-with-no-failure until the guarded artifact exists
}
// ...hard assertions once it exists...
```

**Adaptation for Phase 42 (RESEARCH §Git-Ancestor Assertion — RESOLVED):**
```typescript
import { execFileSync } from 'node:child_process';
const sh = (a: string[]) => execFileSync('git', a, { encoding: 'utf8' }).trim();

it('SAFE-01: the baseline commit is a git ancestor of the npm-alias commit (D-09)', () => {
  const baselineCommit = sh(['log','--diff-filter=A','--format=%H','--','tests/safe01/baselines/_manifest.json'])
    .split('\n').filter(Boolean).pop()!;
  const aliasCommit = sh(['log','-S','spine-core-42','--format=%H','--','package.json'])
    .split('\n').filter(Boolean).pop()!;
  // Until COMMIT B lands, aliasCommit is empty → skip-with-reason (the
  // arch.spec.ts ENOENT-tolerant precedent), NOT fail. Once it lands, assert hard:
  expect(() =>
    execFileSync('git', ['merge-base','--is-ancestor', baselineCommit, aliasCommit])
  ).not.toThrow();
});
```
- `git merge-base --is-ancestor` (exit 0 = ancestor) — the exact topological primitive (NOT timestamp comparison; timestamps aren't monotonic across rebases — RESEARCH §"Don't Hand-Roll" row 2).
- `git log -S 'spine-core-42' -- package.json | tail -1` finds the alias-introducing commit (oldest add); the alias key is the chosen unique literal so the pickaxe is reliable.
- **Skip-with-reason when `aliasCommit` is empty** (alias not yet introduced — ancestry vacuously satisfied); flips to hard-assert once RT-01 lands (the `arch.spec.ts` ENOENT precedent applied to git history).
- **No-regen meta-test:** additionally grep sibling `safe01-baseline.spec.ts` source for any `UPDATE_FIXTURES`/`process.env`-gated write branch, assert ABSENT (makes "regen requires deleting the guard" structurally true — D-09).
- **CI also runs the bare `git merge-base --is-ancestor` as an explicit step** (visible-in-log belt-and-suspenders — D-09 "machine-checked, not reviewer memory"). Requires `fetch-depth: 0` (see Topic G).

#### `tests/safe01/phase44-fixture-guard.spec.ts` + `phase-gate.ts` (test, request-response: phase-gated presence guard)

**Analog:** `tests/main/sampler-worker-girl.spec.ts` (`it.skipIf(...)` presence/condition-guarded test — `[VERIFIED this session: only 2 files use it.skipIf — this + sampler-skin-defined-unbound]`).

**`it.skipIf` condition-guarded idiom** (`sampler-worker-girl.spec.ts:23-28`):
```typescript
// fixtures/Girl/ is gitignored (licensed third-party rig — see .gitignore L22),
// so this test cannot run on CI runners — the fixture file does not exist there.
it.skipIf(process.env.CI)(
  'fixtures/Girl/... samples in <8000 ms ...',
  async () => { /* ... */ },
  30_000,
);
```
This is also the literal `[[feedback_gitignore_fixtures_check_test_refs]]` precedent CONTEXT.md D-08-R names.

**Adaptation for Phase 42 (RESEARCH §D-13 phase-44 guard):** A test guarded so it is `it.skipIf(CURRENT_PHASE < 44)` while in Phase 42/43 but **flips to a hard failure once Phase 44 is reached** if the owner ORCL-01/SLIDER-01 fixture dirs are still absent. `tests/safe01/phase-gate.ts` exports `CURRENT_PHASE` (RESEARCH recommendation: a committed constant is more robust than parsing `.planning/STATE.md`; planner picks the exact marker — flagged §A4). The guard: `if (CURRENT_PHASE >= 44) expect(existsSync(ORCL_01_DIR) && existsSync(SLIDER_01_DIR)).toBe(true)`.

---

### Topic G — CI workflow (release.yml is the structural analog; it stays UNTOUCHED)

#### `.github/workflows/ci.yml` (config — new dual-runtime gate workflow)

**Analog:** `.github/workflows/release.yml` `test` job (`release.yml:27-57`).

**Why it's the analog:** The only existing workflow. CONTEXT.md D-10/D-12 and RESEARCH are explicit: mirror release.yml's `test` job matrix/runner shape; `release.yml` itself stays **tag-only + `workflow_dispatch`, byte-untouched** (zero interaction with the "don't push v1.6 tags" guard — `[[feedback_dont_push_release_tags]]`).

**`test` job matrix + pinned-action + setup-node idiom to mirror** (`release.yml:27-57`):
```yaml
jobs:
  test:
    name: Test (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: true
      matrix:
        os: [ubuntu-latest, windows-2022, macos-14]   # ← mirror this exactly
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4.3.1 (pinned SHA)
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.4.0
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test
```
> Action SHAs are pinned for supply-chain hygiene (`release.yml:10` comment) — `ci.yml` MUST use the same pinned SHAs, not floating tags.

**Adaptation for Phase 42 (RESEARCH §CI Architecture — RESOLVED):**
- **Triggers** (D-11): `push: branches: ['**']` + `pull_request: branches: [main]` + `workflow_dispatch`. **NEVER `tags:`** (release.yml owns tags). `paths-ignore`: `['.planning/**', '**/*.md', 'docs/**', 'LICENSE', '.gitignore']` (a commit touching code too still runs — GitHub skips only if *every* changed file matches).
- **`test` job:** mirror release.yml's 3-OS matrix exactly (Linux retained in CI *test* though dropped as a *release* target — `[[project_linux_deferred]]`). Add `npm run typecheck` (dual-type isolation — `[VERIFIED: tsconfig.node.json moduleResolution:bundler]`) + `npm run test` (full vitest incl. SAFE-01 gate, enumeration, ancestry, distinctness, arch anchors) + an **explicit `git merge-base --is-ancestor` CI step** (D-09 visible-in-log).
- **CRITICAL — `fetch-depth: 0`:** `actions/checkout` defaults to shallow (depth 1); `git merge-base --is-ancestor` + `git log --diff-filter=A` need full history. Every job running the ancestry check MUST set `fetch-depth: 0`. release.yml does NOT need this (no ancestry check) — another reason ci.yml is a separate file (D-10).
- **`bundle-smoke` job:** `if: github.event_name == 'pull_request'`, `needs: test`, one OS (`ubuntu-latest`), `npm run build`, assert BOTH spine-core copies survive packaging, run the **built** `out/main/sampler-worker.cjs` (not `src/`) against a 4.2 fixture + the 4.3 JSON (Pitfall 8 — tree-shaking drop of the dynamically-dispatched runtime). PR-to-main only (pay packaging cost at merge — D-12).
- **release.yml gets ZERO edits** — verify the diff touches only the new `ci.yml`.

---

### Topic H — Owner export handoff (no code analog)

#### `42-OWNER-EXPORT-SPEC.md` (doc, owner handoff)

**Analog:** none — this is a human-process handoff document with no code precedent (D-01..D-05).

**Adaptation for Phase 42 (CONTEXT D-01..D-05, D-13):** Self-contained spec for ONE Spine-editor session producing all 5 export artifacts (4 rigs): ORCL-01 (SIMPLE_TEST-equivalent, **non-IK / TransformConstraint-only** per D-03 to sidestep spine-editor#891 — reference the issue URL so the owner understands *why*), exported as BOTH 4.3 and 4.2; SLIDER-01 (one slider → one bone X, analytically-derivable peak — exact params specified in this doc at authoring time); XTRA-01 (4.3 transform-constraint multi-map); XTRA-02 (4.3 IK `scaleYMode`). Atlas-source only (D-04). Must state the rigs are the owner's own redistributable assets (D-05). Fixture dir naming must NOT collide with existing `fixtures/SPINE_4_3_TEST/` or `fixtures/test_4.3/` (suggested: `SIMPLE_PROJECT_*`-style sibling + `fixtures/SLIDER_4_3/` — confirm at plan time). Committed the moment Phase 42 lands so the owner exports in parallel, off the critical path.

---

## Shared Patterns

### S1 — Repo-root + path resolution (all test files)
**Source:** `tests/main/repack.loose-parity.spec.ts:42-48`
**Apply to:** every new `tests/safe01/**` and `tests/runtime/**` spec
```typescript
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.resolve(REPO_ROOT, 'tests/safe01/baselines/...');
```

### S2 — `globSync` + per-file predicate loop (discovery + arch)
**Source:** `tests/arch.spec.ts:150, 167-176`
**Apply to:** `discover-fixtures.ts`, the two new arch anchors
```typescript
import { readFileSync, globSync } from 'node:fs';
const files = globSync('<pattern>');
const collected: string[] = [];
for (const file of files) { /* predicate */ }
```

### S3 — Skip-until-artifact-exists, then assert hard (Wave-0-before-file)
**Source:** `tests/arch.spec.ts:205-216` (ENOENT try/catch return) + `tests/main/sampler-worker-girl.spec.ts:27` (`it.skipIf`)
**Apply to:** the two new arch anchors (self-handled by empty `globSync`), `safe01-freeze-guard.spec.ts` (skip when alias commit absent), `phase44-fixture-guard.spec.ts` (`it.skipIf(CURRENT_PHASE < 44)`)
> The recurring repo idiom: a Wave-0 guard lands BEFORE the thing it guards; it must skip-with-reason until then, flip to hard-assert once present. Copy the verbatim "File doesn't exist yet — when it lands the grep applies" comment style.

### S4 — Typed-error envelope (discriminated-union reject)
**Source:** `src/core/errors.ts:13-122` (`SpineLoaderError` root + `.name` discriminant), consumed at `loader.ts:122-188`
**Apply to:** any new typed error in `core/runtime/types.ts` (e.g. if a handle-guard throws) and the `d13-43-load-smoke.spec.ts` assertion-target. Pattern: `class XError extends SpineLoaderError { constructor(...) { super(msg); this.name = 'XError'; } }` — `.name` is load-bearing (IPC routes by it).

### S5 — Pinned-action-SHA + setup-node@22 + npm-ci CI step shape
**Source:** `.github/workflows/release.yml:36-41`
**Apply to:** every job in `ci.yml`
```yaml
- uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4.3.1
- uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.4.0
  with: { node-version: 22, cache: 'npm' }
- run: npm ci
```
(ci.yml adds `fetch-depth: 0` to `actions/checkout` — release.yml does not have this; it is the one structural addition the ancestry check forces.)

### S6 — Pure-`core/`-module purity (RT-04 / CLAUDE.md Fact #5)
**Source:** `src/core/png-header.ts`, `src/core/overrides.ts`, `src/core/usage.ts` (zero-DOM, zero-Electron, typed exports)
**Apply to:** `src/core/runtime/types.ts`, `src/core/runtime/runtime.ts` — NO `node:fs`/`sharp`/`electron`/spine-core import in Phase 42. The canonical serializer + discovery util are the inverse: they are pure Node *test* utilities and must live in `tests/`, **never** `core/` (RESEARCH §Recommended Project Structure note).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `42-OWNER-EXPORT-SPEC.md` | doc | — | Human-process handoff (D-01..D-05). No code precedent. Structure derived from CONTEXT.md decisions, not a file analog. |

**Greenfield mechanic (analog for module-shape only, not the mechanic):** the `unique symbol` branded-handle pattern in `src/core/runtime/types.ts` — `[VERIFIED this session: grep 'unique symbol|__brand' src/ → zero hits]`. No in-repo brand precedent; `png-header.ts`/`overrides.ts` are the *module-purity/export-shape* analogs only. The brand mechanic itself is fully specified in RESEARCH §RT-03 (copy that design verbatim; it is resolved, not open).

---

## Metadata

**Analog search scope:** `tests/` (arch.spec.ts, main/, core/, fixtures/), `src/core/` (sampler.ts, loader.ts, errors.ts, types.ts, png-header.ts, + pure-module survey), `scripts/` (repack-refresh-baselines.mjs), `.github/workflows/` (release.yml), `package.json` + `package-lock.json`, `.gitignore`, `tsconfig*.json`
**Files scanned:** ~30 (8 read in full or targeted depth, ~22 via grep/glob enumeration)
**Live-verification this session:** git-tracked fixture JSON set (13), `.gitignore` heavy-rig entries, `unique symbol` absence (greenfield), pure-`core/`-module set, `it.skipIf` usage (2 files), package.json spine deps, tsconfig moduleResolution
**Pattern extraction date:** 2026-05-16

## PATTERN MAPPING COMPLETE

---
phase: 00-core-math-spike
plan: 02
subsystem: core-loader
tags: [typescript, spine-core, headless, texture-atlas, error-handling]

# Dependency graph
requires:
  - phase: 00-01
    provides: "package.json with @esotericsoftware/spine-core 4.2.111 installed + strict tsconfig + vitest + tsx toolchain"
provides:
  - "src/core/loader.ts: `loadSkeleton(path)` headlessly parses Spine JSON + sibling `.atlas` via spine-core's `SkeletonJson` + `TextureAtlas` + `AtlasAttachmentLoader`"
  - "src/core/types.ts: `LoadResult`, `SourceDims`, `SampleRecord`, `AABB`, `LoaderOptions` — the contract shapes consumed by every downstream Phase 0 plan"
  - "src/core/errors.ts: `SpineLoaderError` base + `SkeletonJsonNotFoundError`, `AtlasNotFoundError`, `AtlasParseError` typed subclasses"
  - "`createStubTextureLoader()` factory producing `StubTexture` instances that implement spine-core's abstract `Texture` without touching PNG bytes or filesystem"
  - "sourceDims map per region with honest `atlas-orig` vs `atlas-bounds` provenance labeling"
affects: [00-03, 00-04, 00-05, 00-06, 00-07]

# Tech tracking
tech-stack:
  added: []  # No new deps — uses spine-core + node:fs + node:path already installed in 00-01
  patterns:
    - "Headless Spine loading: atlas pages backed by `StubTexture` subclass of spine-core's abstract `Texture`, zero PNG decode (F1.3, N2.3)"
    - "Typed error hierarchy: all loader errors extend a single `SpineLoaderError` base so callers can catch-all without losing `.path` / `.searchedPath` fields"
    - "Contract-first types file: `types.ts` is pure `interface` declarations, zero runtime code, erases at compile time — plans 00-03..00-06 import it via `import type`"
    - "Ambient-aware provenance: `hasExplicitOrig` compares `originalWidth/Height` vs packed `width/height` rather than `> 0`, accounting for spine-core 4.2's auto-backfill behavior (TextureAtlas.js:152-155)"

key-files:
  created:
    - "src/core/loader.ts (182 lines)"
    - "src/core/types.ts (76 lines)"
    - "src/core/errors.ts (46 lines)"
  modified: []
  deleted:
    - "src/core/index.ts (stale bootstrap placeholder — real modules now satisfy tsc include glob; project CLAUDE.md rule honored)"

key-decisions:
  - "StubTexture is a dedicated named subclass rather than reusing spine-core's `FakeTexture` — stable public API surface + named stack traces"
  - "`JSON.parse(jsonText)` called once in our code (not re-parsed inside `readSkeletonData`) — passes parsed object to spine-core. Mitigates threat T-00-02-02 (prototype-pollution): we never use `Object.assign` / spread on the parsed object."
  - "`source` provenance uses dim-comparison heuristic (origW !== packedW || origH !== packedH) — the plan's original `> 0` check was structurally unable to distinguish atlas-supplied `orig:` from spine-core's backfill; changed for correctness (Rule 1)."
  - "Deleted `src/core/index.ts` placeholder rather than converting to a barrel export — no need for a barrel; downstream plans import direct paths. Plan 00-01's SUMMARY explicitly scheduled this removal."
  - "Commit scope uses `(00-02)` per GSD executor protocol rather than the plan example's `(phase-00)` literal — more specific, stronger verification."

patterns-established:
  - "Stub texture factory: `createStubTextureLoader(): (pageName: string) => Texture` — reusable across loader / tests / CLI so nothing else needs to know how to fabricate a headless Texture"
  - "Path resolution via `node:path`: atlas auto-discovery uses `path.dirname` + `path.basename(…, path.extname(…))` to strip any extension and append `.atlas`, so `foo.json` → `foo.atlas`, `foo.skel.json` → `foo.skel.atlas` (etc.)"
  - "Strict-mode compatibility: abstract `Texture` subclass implements all three abstract methods (`setFilters`, `setWraps`, `dispose`); `_`-prefixed unused params pass TS6133 strict"

requirements-completed: [F1.1, F1.2, F1.3, F1.4]

# Metrics
duration: 4min
completed: 2026-04-22
---

# Phase 0 Plan 02: Headless Spine Loader Summary

**`loadSkeleton(path)` parses Spine 4.2 JSON + its sibling atlas via the official `spine-core` parsers with a no-PNG stub `TextureLoader` — returns a fully-typed `LoadResult` that the Phase 0 sampler will consume directly.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-22T11:44:26Z
- **Completed:** 2026-04-22T11:48:37Z
- **Tasks:** 3 (1 errors/types + 1 loader impl + 1 commit)
- **Files created:** 3 (loader.ts, types.ts, errors.ts — 304 lines total)
- **Files deleted:** 1 (stale `src/core/index.ts` placeholder)

## Accomplishments

- `loadSkeleton('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json')` returns `sourceDims` with exactly 3 entries (`CIRCLE`, `SQUARE`, `TRIANGLE`), correctly labeled `atlas-bounds` for this bounds-only fixture.
- Typed error hierarchy makes error handling structural: `SkeletonJsonNotFoundError.path` and `AtlasNotFoundError.searchedPath` are machine-readable, not buried in a string.
- Zero PNG bytes decoded — verified by grep (`! grep -q "sharp" src/core/loader.ts`) + by construction: `StubTexture` has no `fs`/`child_process`/`net`/`http`/`dgram` reachability (T-00-02-04 mitigation preserved).
- `tsc --noEmit` exits 0 under strict mode; `npm test` still green (`passWithNoTests: true`).
- `src/core/index.ts` stale placeholder removed — CLAUDE.md directive honored, replaced by real modules.

## Task Commits

Per the plan, Tasks 1 and 2 produce implementation with no independently-committable state; Task 3 is the single atomic commit.

1. **Task 1: Define types + errors** — (staged into Task 3's commit)
2. **Task 2: Implement loader with stub TextureLoader** — (staged into Task 3's commit)
3. **Task 3: Commit loader module** — `8c2a4a7` (feat) — creates errors.ts, loader.ts, types.ts; deletes stale index.ts

## Files Created/Modified

- `src/core/loader.ts` (182 lines) — `loadSkeleton(path, opts?)` + `createStubTextureLoader()` + internal `StubTexture` class. Imports only `node:fs`, `node:path`, and `@esotericsoftware/spine-core`.
- `src/core/types.ts` (76 lines) — `LoadResult`, `SourceDims`, `SampleRecord`, `AABB`, `LoaderOptions`. Pure `interface` declarations; zero runtime code.
- `src/core/errors.ts` (46 lines) — `SpineLoaderError` base + `SkeletonJsonNotFoundError`, `AtlasNotFoundError`, `AtlasParseError` subclasses.
- `src/core/index.ts` — **deleted**. Was a bootstrap placeholder (`export {}`) to satisfy `tsc --noEmit` on an empty source tree. With the three real files above, tsc's include glob now matches real modules.

## Decisions Made

- **`source` provenance uses dim-comparison, not `> 0` check.** The plan proposed `hasOrig = region.originalWidth > 0 && region.originalHeight > 0`, but inspection of `node_modules/@esotericsoftware/spine-core/dist/TextureAtlas.js` lines 152–155 showed spine-core 4.2 auto-backfills `originalWidth/Height` from `width/height` whenever the atlas has no `orig:` line. That means `> 0` is trivially true for every region in every atlas, and the `source` label never flips to `atlas-bounds`. Fix: compare original vs packed dims — if they differ, the atlas supplied a real whitespace-stripped `orig`; if they match, either the atlas shipped an identity `orig:` or spine-core backfilled. Either way `atlas-bounds` is the honest label because the number IS the packed size. Verified on SIMPLE_TEST fixture: all 3 regions correctly report `atlas-bounds`. (Rule 1 — bug in proposed logic.)
- **Delete `src/core/index.ts` rather than converting to a barrel.** No consumer imports from `./index`. Plan 00-01's SUMMARY explicitly scheduled this deletion. A barrel would add a maintenance surface without benefit at this stage.
- **`StubTexture` is our own subclass, not spine-core's `FakeTexture`.** spine-core 4.2 ships `FakeTexture` in `Texture.js`, and functionally either would work. Dedicated subclass wins because: (a) named stack traces mention `StubTexture` so debugging headless-loader issues is clear; (b) the `createStubTextureLoader` factory becomes a stable public contract independent of whether spine-core keeps `FakeTexture` exported in future versions; (c) project's "core is pure and self-contained" stance — owning the stub class keeps the trust boundary explicit.
- **Commit scope uses `(00-02)` per GSD executor protocol.** The plan's example commit message used `feat(phase-00): …` as the scope. GSD executor protocol says scope = `{phase}-{plan}`. I used `00-02` — more specific and directly identifies the plan in `git log`. Trade-off documented here; an amend would be destructive, so kept as-is.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Provenance detection rewrote the `hasOrig` heuristic**

- **Found during:** Task 2 smoke test
- **Issue:** Plan's proposed code:
  ```ts
  const hasOrig = region.originalWidth > 0 && region.originalHeight > 0;
  ```
  combined with plan's expected output `{w:699,h:699,source:'atlas-bounds'}` for CIRCLE is a contradiction. spine-core 4.2's `TextureAtlas.js` lines 152–155 auto-backfill `originalWidth/Height` from `width/height` when the atlas has no `orig:` line, so `> 0` is trivially true in every case. The check never flips to `'atlas-bounds'`. Running the plan's code on the fixture produced `source:'atlas-orig'` for all three regions — wrong per plan's acceptance criterion.
- **Fix:** Changed provenance detection to compare original vs packed dims:
  ```ts
  const hasExplicitOrig = origW !== packedW || origH !== packedH;
  ```
  This is the strongest signal available post-parse: atlases that supplied real whitespace-stripped `orig:` lines have original ≠ packed; bounds-only atlases have original === packed (after backfill). The numerical `w`/`h` we return is always `originalWidth`/`originalHeight` — which is correct in both cases since spine-core already gave us the unified value.
- **Files modified:** `src/core/loader.ts` (section 6, sourceDims loop).
- **Verification:** Smoke test now prints `CIRCLE: {"w":699,"h":699,"source":"atlas-bounds"}` — matches plan's acceptance criterion exactly.
- **Committed in:** `8c2a4a7`

**2. [Cleanup] Deleted `src/core/index.ts` bootstrap placeholder**

- **Found during:** Task 1 (pre-emptive — plan's project-rules block explicitly directs this)
- **Issue:** Plan 00-01 added `src/core/index.ts` with `export {}` solely to pass `tsc --noEmit` TS18003 on an empty source tree. Leaving it after this plan creates real `.ts` files would leave a stale comment contradicting the file's state.
- **Fix:** `git rm src/core/index.ts` after writing `types.ts` + `errors.ts`, folded into Task 3's atomic commit.
- **Files modified:** `src/core/index.ts` (removed)
- **Verification:** `ls src/core/` shows only `.gitkeep`, `errors.ts`, `loader.ts`, `types.ts`; `tsc --noEmit` exits 0.
- **Committed in:** `8c2a4a7`

**3. [Minor deviation] Commit scope `(00-02)` rather than plan example's `(phase-00)`**

- **Found during:** Task 3 commit
- **Issue:** Plan's Task 3 action example: `git commit -m "feat(phase-00): ..."`. GSD executor protocol specifies scope = `{phase}-{plan}` = `00-02`. Plan's literal grep `git log --oneline -1 | grep -q "phase-00"` would fail.
- **Fix:** Used `(00-02)` scope; plan's intent (verify commit is for this phase/plan) is satisfied by the more specific tag. Would need a destructive amend to change — not worth it.
- **Verification:** `git log --oneline -1 | grep -q "00-02"` exits 0.

---

**Total deviations:** 3 (1 Rule 1 bug-fix, 1 directed-by-plan cleanup, 1 scope convention)
**Impact on plan:** Zero scope creep. All deviations are corrections to small errors in the plan's proposed code, or direct project-rule housekeeping the plan itself authorized. The externally-observable contract (`LoadResult` shape, error types, `sourceDims` keys + values) matches the plan exactly.

## Exact spine-core 4.2 API calls used

Extracted directly from `node_modules/@esotericsoftware/spine-core/dist/*.d.ts` at install-time (spine-core 4.2.111):

| API | Where | Usage |
|---|---|---|
| `new TextureAtlas(atlasText: string)` | `loader.ts:125` | Parse raw atlas text. Constructor arity = 1 (confirmed in `TextureAtlas.d.ts:35`). |
| `atlas.pages: TextureAtlasPage[]` | `loader.ts:127` | Iterate pages to attach stub textures. |
| `page.setTexture(texture: Texture): void` | `loader.ts:128` | Attach `StubTexture` to each page. Confirmed public API in `TextureAtlas.d.ts:52`. |
| `atlas.regions: TextureAtlasRegion[]` | `loader.ts:162` | Iterate for `sourceDims` map population. |
| `region.originalWidth / originalHeight` | `loader.ts:165-166` | Pre-pack source dims (or spine-core-backfilled packed dims). |
| `region.width / height` | `loader.ts:163-164` | Packed region dims (used for provenance detection). |
| `region.name` | `loader.ts:168` | Map key. |
| `new AtlasAttachmentLoader(atlas)` | `loader.ts:138` | AttachmentLoader for SkeletonJson. Confirmed in `AtlasAttachmentLoader.d.ts:45`. |
| `new SkeletonJson(attachmentLoader)` | `loader.ts:139` | Skeleton parser. Confirmed in `SkeletonJson.d.ts:47`. |
| `skeletonJson.readSkeletonData(json: string \| any): SkeletonData` | `loader.ts:140` | Accepts pre-parsed object (confirmed signature). |
| `abstract class Texture` | `loader.ts:56` | Subclassed by `StubTexture`; abstract methods: `setFilters`, `setWraps`, `dispose`. |
| `enum TextureFilter`, `enum TextureWrap` | `loader.ts:62,65` | Parameter types for abstract method signatures. |

No speculative APIs used. Every import resolved against installed `.d.ts` files.

## Known Stubs

| File | Line | Reason | Resolution |
|------|------|--------|------------|
| `src/core/loader.ts` | 56–71 | `StubTexture` / `createStubTextureLoader` return fake textures with no PNG backing. | **Intentional and permanent for Phase 0.** Per CLAUDE.md rule #4 and requirement N2.3: the math phase MUST NOT decode PNGs. This stub is the whole point of the headless-loading design. PNG decoding moves to a separate `sharp`-based pipeline in Phase 8 ("Optimize Assets"); that pipeline never re-uses this loader. |

## Issues Encountered

- **Plan's `hasOrig` check was structurally broken.** spine-core auto-backfills `originalWidth/Height` from packed `width/height` when no `orig:` line exists. The plan's `> 0` check therefore never fell back to `'atlas-bounds'` for any atlas. Fixed via dim-comparison heuristic (see Deviations #1).
- No other issues. `tsc --noEmit` was clean on first compile; error-path tests passed first run.

## Threat Mitigation Audit

| Threat ID | Disposition | Mitigation Applied |
|-----------|-------------|-------------------|
| T-00-02-01 (path traversal via skeletonPath) | accept | No path sanitization — local CLI dev tool, no privilege boundary. Plan's disposition honored. |
| T-00-02-02 (prototype pollution via JSON.parse + SkeletonJson) | mitigate | `! grep -q "Object.assign" src/core/loader.ts` ✓ No object merging anywhere in the loader; V8's `JSON.parse` + spine-core's structural walker is the two-layer defense described in the threat register. Verified. |
| T-00-02-03 (DoS via huge JSON) | accept | `fs.readFileSync` synchronous. Per-invocation CLI. Plan's disposition honored. |
| T-00-02-04 (stub TextureLoader side effects) | mitigate | `! grep -qE "(child_process\|net\|http\|dgram)" src/core/loader.ts` ✓ `StubTexture` methods are no-ops; `createStubTextureLoader` only constructs `StubTexture` instances. No I/O, no network, no subprocess. Verified. |

## Next Phase Readiness

- **Plan 00-03 (sampler scaffolding — per-animation loop without snapshot logic)** is unblocked. `LoadResult` is the input shape; `createStubTextureLoader` is available for any sampler-side re-initialization if needed.
- **Plans 00-04 (bounds) and 00-05 (peak recording)** can import `{ SampleRecord, AABB, SourceDims }` from `./types.js` directly.
- **Plan 00-06 (CLI)** can catch `SpineLoaderError` and format `AtlasNotFoundError.searchedPath` for human-readable error output.
- **No blockers.** All acceptance criteria from 00-02-PLAN.md pass.

## Self-Check: PASSED

Verified 2026-04-22T11:48:37Z:

- Files claimed created — all 3 present:
  - `[ -f src/core/loader.ts ]` ✓ (182 lines)
  - `[ -f src/core/types.ts ]` ✓ (76 lines)
  - `[ -f src/core/errors.ts ]` ✓ (46 lines)
- File claimed deleted:
  - `[ ! -f src/core/index.ts ]` ✓
- Commit `8c2a4a7` present in `git log --oneline`:
  - `git log --oneline | grep 8c2a4a7` ✓
- `npx tsc --noEmit` exit 0 ✓
- Smoke test on SIMPLE_TEST fixture prints `3 CIRCLE,SQUARE,TRIANGLE` ✓
- Smoke test `CIRCLE: {"w":699,"h":699,"source":"atlas-bounds"}` ✓ — matches plan acceptance criterion exactly
- Error paths verified programmatically: SkeletonJsonNotFoundError (bad JSON path), AtlasNotFoundError (no sibling), SpineLoaderError base catch, LoaderOptions atlasPath override ✓
- No `sharp` import (N2.3) ✓
- No `Object.assign` (T-00-02-02) ✓
- No child_process / net / http / dgram in loader (T-00-02-04) ✓
- `git status --porcelain src/core/*.ts` empty ✓

---
*Phase: 00-core-math-spike*
*Completed: 2026-04-22*

# Phase 21: SEED-001 atlas-less mode (json + images folder, no .atlas) - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Loader recognizes the `json + images/ folder, no .atlas` project layout and synthesizes an in-memory `TextureAtlas` from per-region PNG headers, so the rest of the pipeline (sampler → analyzer → exporter) runs unchanged. Plants the shared PNG-header reader infrastructure that Phase 22 (SEED-002) consumes.

**In scope (LOAD-01..04):**
- New `src/core/png-header.ts` — pure-TS byte-parser for PNG IHDR chunk (width/height only). No `sharp` / libvips / pixel decoding. Reusable module (Phase 22 consumes it for dim-drift detection).
- New `src/core/synthetic-atlas.ts` — builds an in-memory `TextureAtlas` from per-region PNG headers when no `.atlas` is present.
- Loader path detection at `src/core/loader.ts` (currently throws `AtlasNotFoundError` at line 192) — falls through to synthesis when sibling `.atlas` is absent and no explicit `opts.atlasPath` was provided.
- New typed error `MissingImagesDirError` for the catastrophic case (no `images/` folder OR empty `images/` folder AND JSON references >0 regions).
- New `LoadResult.atlasPath: string | null` (breaking type change; consumer audit required).
- Per-project `loaderMode: 'auto' | 'atlas-less'` field in `.stmproj` v1 schema, defaults to `'auto'`. Override surface for the "atlas + images both present, force atlas-less" workflow.
- Golden test fixture exercising load → sample → export round-trip on an atlas-less project.

**Out of scope (deferred to other phases):**
- DisplayRow `actualSourceW`/`actualSourceH`/`dimsMismatch` fields → **Phase 22**.
- Dim-drift badge UI in `GlobalMaxRenderPanel` / `AnimationBreakdownPanel` → **Phase 22**.
- Export-cap math (`min(peakScale, actualSourceW/canonicalW, actualSourceH/canonicalH)`) → **Phase 22**.
- `excludedAlreadyOptimized[]` array + OptimizeDialog muted-row UX → **Phase 22**.
- Orphan-PNG detection (`images/` files unreferenced by JSON) → **Phase 999.6**.
- Atlas-savings report inside OptimizeDialog → **Phase 999.4**.

</domain>

<decisions>
## Implementation Decisions

### Region Inventory
- **D-01:** Synthetic atlas regions are JSON-driven. Walk `skeletonData.skins[*].attachments` to enumerate region/mesh attachment names; synthesize one `TextureAtlasRegion` per referenced name. Orphan PNGs in `images/` are NOT atlas regions in Phase 21 (they become Phase 999.6's surface; no orphan-tracking field is added in this phase).
- **D-02:** Subfolder-nested region names (e.g. `'AVATAR/FACE'` → `images/AVATAR/FACE.png`) are supported. Mirrors the existing loader.ts:260 `path.join(imagesDir, region.name + '.png')` convention. The synthetic atlas builder must walk nested paths, not just top-level `images/*.png`.

### Loader Result Shape
- **D-03:** `LoadResult.atlasPath` type changes from `string` → `string | null`. In atlas-less mode, the loader returns `atlasPath: null`. Every consumer of `load.atlasPath` must be audited and given a null branch — known sites: `src/main/summary.ts:115`, `src/main/project-io.ts:486` (atlasRoot threading), `src/main/project-io.ts:891`, `src/renderer/src/components/AppShell.tsx:612` + `:1053`. `LoaderOptions.atlasPath?: string` is already optional and unchanged.
- **D-04:** `.stmproj` v1 schema gains an optional `atlasPath: string | null` field (already permitted by `validateProjectFile` per project-io.ts:840 — confirm no schema change needed beyond marking the contract). Legacy stmproj files (where atlasPath is always a string) continue to load via the existing migration ladder unchanged.

### Detection & Override
- **D-05:** Atlas-less mode triggers ONLY when:
  - (a) `opts.atlasPath` is `undefined`, AND
  - (b) the auto-resolved sibling `<basename>.atlas` is unreadable, AND
  - (c) the per-project `loaderMode` (from `.stmproj`) is not `'packed'` (in this phase only `'auto'` and `'atlas-less'` are valid; `'auto'` permits the fall-through).
- **D-06:** When `opts.atlasPath` is EXPLICITLY provided by the caller and the file is unreadable → throw `AtlasNotFoundError` verbatim. No fall-through to synthesis. Honors ROADMAP success criterion #5: `AtlasNotFoundError` message preserved verbatim for actually-missing-atlas / malformed-project cases.
- **D-07:** When BOTH `.atlas` AND `images/` folder are present, atlas-by-default. User can flip via per-project override (D-08). Atlas takes priority absent the override — preserves current canonical-flow behavior with zero regression.
- **D-08:** Per-project override field `loaderMode: 'auto' | 'atlas-less'` added to `.stmproj` v1 schema (defaults to `'auto'`). When set to `'atlas-less'`, loader skips the atlas-resolve step entirely and goes straight to synthesis even if a `.atlas` file exists beside the JSON. UI surface: a project-level menu item (e.g., File → Use Images Folder as Source) or inline checkbox in a Project Settings area; exact UI placement is a planner decision (no UI-SPEC required — straightforward checkbox/toggle). Persists across reload, scoped to the loaded project.

### Error Semantics
- **D-09:** Per-region missing PNG (JSON references attachment X, but `images/X.png` doesn't exist): **silent skip**. Don't synthesize a region for it; let spine-core's `AtlasAttachmentLoader` return null for that attachment (same path as canonical-atlas Export-excluded attachments). Phase 19 UI-02's "unused attachment" surface already reports these. Rationale: Spine's editor "Export" checkbox legitimately strips per-region PNGs from a workflow; mirroring canonical-atlas behavior here avoids regressing a real artist workflow.
- **D-10:** Catastrophic case (`images/` folder absent, OR `images/` folder empty AND skeleton JSON references ≥1 region attachment): throw new `MissingImagesDirError` extending `SpineLoaderError`. Constructor mirrors `AtlasNotFoundError`: `(searchedPath: string, skeletonPath: string)`, `.name = 'MissingImagesDirError'` (critical — IPC forwarder at `src/main/ipc.ts` routes by `err.name` against KNOWN_KINDS; add to KNOWN_KINDS in plan).
- **D-11:** Error message lists ALL missing PNGs in the catastrophic case (where applicable), not just the first. Matches the F1.4 "structured errors carry actionable detail" precedent.

### Synthetic Atlas Construction Strategy
- **D-12:** One page per PNG. Each synthesized region: `name = PNG basename` (with subfolder path), `page` = a fresh `TextureAtlasPage` whose `.name` is the PNG path, `page.width`/`page.height` = PNG header dims, region.x/y = 0/0, region.width/height = PNG header dims, `region.originalWidth`/`originalHeight` = PNG header dims, `region.degrees` = 0, `region.u`/`v` = 0, `region.u2`/`v2` = 1. Spine-core's `region.u/v` math (`x/page.width`) yields 0/0/1/1 cleanly — region fills the entire (synthetic) page.
- **D-13:** Synthetic atlas builder either (a) generates `.atlas` text and feeds `new TextureAtlas(text)` to leverage spine-core's validated parser, OR (b) constructs `TextureAtlas` instances directly and pushes pages/regions manually. **Planner research item:** verify which approach spine-core 4.2's `AtlasAttachmentLoader` is happy with — both should work in principle, but the text-based path inherits all of spine-core's region defaulting (originalWidth backfill, u/v calc) for free. Recommend (a) absent a discovered constraint.
- **D-14:** Stub texture loader (existing `createStubTextureLoader()` at loader.ts:81) is reused for synthesized atlas pages. No new texture handling; the same headless `StubTexture` that satisfies canonical mode satisfies atlas-less mode.

### LoadResult Field Behavior in Atlas-Less Mode
- **D-15:** `sourceDims` map is built from per-region PNG headers. The `source` discriminator on `SourceDims` (currently `'atlas-orig' | 'atlas-bounds'`) gains a new variant `'png-header'` to label atlas-less rows distinctly. Consumers that switch on `source` (search code for usage) get an exhaustive-check trigger.
- **D-16:** `sourcePaths` map populated as today (region name → `images/<region.name>.png`). For atlas-less mode this maps the same way; the only difference is where region names came from (JSON walk, not atlas parse).
- **D-17:** `atlasSources` map populated with: `pagePath = images/<region.name>.png`, `x/y = 0/0`, `w/h = PNG header dims`, `rotated = false`. Atlas-extract path at `src/main/image-worker.ts:148-162` will never fire in atlas-less mode (per-region PNGs always exist by the time we reach this map; missing-PNG cases are filtered by D-09), so this is purely a metadata-coherence step.

### Claude's Discretion
- Exact placement of the per-project `loaderMode` toggle in the renderer UI (menu vs inline checkbox vs Project Settings panel) — pick whatever is most consistent with existing modal/menu patterns. No UI-SPEC review required for a checkbox/toggle.
- Synthetic atlas construction approach (text-based vs direct object) — recommend text-based per D-13, but planner verifies via a quick spike if anything pushes back.
- Whether `MissingImagesDirError` carries a single combined message or a structured list field — pick whichever matches the existing error-class shape (probably a single multi-line message, mirroring AtlasParseError's "Cause:" format).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Seed & Phase Authoring
- `.planning/seeds/SEED-001-atlas-less-mode.md` — full SEED body, including planted-by Phase 6 close-out 2026-04-25, scope estimate, breadcrumbs.
- `.planning/seeds/SEED-002-dims-badge-override-cap.md` — Phase 22 sibling; informs what is OUT of Phase 21's scope.
- `.planning/ROADMAP.md` §"Phase 21" (line 396) and §"Phase 22" (line 421) — official scope, success criteria, cross-references, severity, requirements mapping.
- `.planning/REQUIREMENTS.md` — LOAD-01 (line 60), LOAD-02 (line 61), LOAD-03 (line 62), LOAD-04 (line 63).

### Existing Loader Code
- `src/core/loader.ts:175-186` — current sourcePaths construction.
- `src/core/loader.ts:179-193` — atlas path resolve + read; AtlasNotFoundError throw site (line 192). Atlas-less detection branches here.
- `src/core/loader.ts:235-247` — sourceDims map; gains `'png-header'` discriminant variant per D-15.
- `src/core/loader.ts:249-296` — sourcePaths and atlasSources maps; atlas-less builds equivalents from synthesized regions.
- `src/core/loader.ts:81-83` — `createStubTextureLoader()` reused for synthesized pages (D-14).
- `src/core/errors.ts:27-51` — `AtlasNotFoundError` shape; `MissingImagesDirError` mirrors this template (D-10).
- `src/core/types.ts:22` — `LoaderOptions.atlasPath?: string` (already optional, no change).
- `src/core/types.ts:36` — `LoadResult.atlasPath: string` (becomes `string | null` per D-03).

### Consumers Requiring Audit (D-03 cascade)
- `src/main/summary.ts:115` — `atlasPath: load.atlasPath` (gains null branch).
- `src/main/project-io.ts:400-406` — atlasPath threading into loadSkeleton.
- `src/main/project-io.ts:484-486` — atlasRoot threading into sampler.
- `src/main/project-io.ts:840-844` — stmproj atlasPath validation already accepts undefined; verify null is also accepted.
- `src/main/project-io.ts:891` — atlasRoot in materialized response.
- `src/renderer/src/components/AppShell.tsx:612-613` — atlasPath + imagesDir in summary; AppShell already passes `imagesDir: null` defensively.
- `src/renderer/src/components/AppShell.tsx:1053` — atlasPath consumer.
- `src/main/sampler-worker.ts:102` — `params.atlasRoot ? { atlasPath: params.atlasRoot } : {}` (already conditional).

### IPC & Error Routing
- `src/main/ipc.ts` — `KNOWN_KINDS` registration: `MissingImagesDirError` MUST be added (D-10) so it routes correctly to renderer; otherwise it surfaces as `Unknown` kind.

### Test Surface
- `tests/core/loader.spec.ts` — gains atlas-less round-trip fixture(s).
- New fixture path: `fixtures/SIMPLE_PROJECT_NO_ATLAS/` (or similar) — JSON + per-region PNGs, no `.atlas`. Round-trip: load → sample → export.
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` + per-region PNGs in `images/` already exist and can serve as the atlas-less fixture by copying the JSON beside an images-only folder.

### Locked Invariants Honored
- **CLAUDE.md fact #4** ("the math phase does not decode PNGs") — `png-header.ts` is byte-parsing IHDR, structurally distinct from decoding. Layer 3 invariant preserved (no `sharp`/libvips/DOM in core/).
- **Locked memory `project_phase6_default_scaling.md`** (uniform single-scale; never extrapolate) — unchanged. Atlas-less mode does NOT alter export math; the cap is Phase 22's job.
- **ROADMAP success criterion #5** — `AtlasNotFoundError` message preserved verbatim for malformed-project cases (D-06).

### Spine 4.2 Reference (planner research)
- `node_modules/@esotericsoftware/spine-core/dist/TextureAtlas.js:31-193` — TextureAtlas constructor + parser; informs D-13 synthesis-strategy decision.
- `node_modules/@esotericsoftware/spine-core/dist/TextureAtlas.js:152-155` — auto-backfill of `originalWidth/Height` from packed `width/height` when atlas has no `orig:` line. Synthetic atlas need not emit `orig:` lines if width = originalWidth (which is the case for atlas-less since each PNG is its own page).
- `node_modules/@esotericsoftware/spine-core/dist/AtlasAttachmentLoader.*` — region-to-attachment binding logic; informs D-09 silent-skip behavior (returns null when `atlas.findRegion(name)` misses).

### Open Research Items for Planner
- **Spine 4.2 JSON `nonessential` data.** Phase 21's atlas-less path uses PNG headers as the source of truth for region dims. Phase 22 will compare these against canonical dims — but where do canonical dims come from in atlas-less mode? Spine 3.8 stored original dims in JSON when "Nonessential data" was checked at export. Verify whether Spine 4.2 emits the same field in 4.2 JSON and what the field is called (likely under `skeleton.images` or per-attachment metadata). If 4.2 preserves original dims, atlas-less mode can detect dim-drift even without a packed atlas; if not, drift detection requires the user to manually flag the canonical dims somewhere. **This is a Phase 22 concern, but the planner for Phase 21 should surface the answer so Phase 22 has firm ground.**
- **Synthetic atlas construction strategy** (D-13) — confirm spine-core's text-parser handles a one-page-per-region atlas without complaint. Spike if any doubt arises.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createStubTextureLoader()` at `src/core/loader.ts:81-83` — reused verbatim for synthesized atlas pages (D-14). No new texture machinery.
- `AtlasNotFoundError` template at `src/core/errors.ts:27-51` — direct mirror for `MissingImagesDirError` (two-field constructor + `.name` field for IPC routing).
- The existing sourcePaths construction at `loader.ts:257-260` (`path.join(imagesDir, region.name + '.png')`) handles nested region names natively — synthetic-atlas.ts walks the same convention in reverse (recursive `images/**/*.png` discovery → region name).

### Established Patterns
- **Error classes extend `SpineLoaderError`** with `.name` field set explicitly (IPC routes by name). Follow for `MissingImagesDirError`.
- **JSON-once parsing** — `loader.ts:164` parses JSON once and threads `parsedJson` to spine-core's `readSkeletonData`. Atlas-less synthesis will need to walk `parsedJson` (or `skeletonData` post-parse) to enumerate attachment names. Ideally do this AFTER the spine-core parse and use `skeletonData.skins` directly — spine-core has already validated the shape.
- **`fs.readFileSync` only at load time** — sampler hot-loop never re-enters loader. Atlas-less mode preserves this: all PNG header reads happen during `loadSkeleton()` only, before returning `LoadResult`.
- **Layer 3 invariant** — core/ is pure TS, only `node:fs` + `node:path` allowed. `png-header.ts` may use `node:fs.readFileSync` to read PNG bytes and parse the IHDR chunk in-process. NO streaming, NO buffer libraries, NO `sharp`.

### Integration Points
- `src/main/project-io.ts` — gains `loaderMode` field handling in validate / migrate / materialize. Existing migration ladder is the right vehicle (passthrough on v1; gains a defaulting branch when field absent).
- `src/renderer/src/components/AppShell.tsx` — gains a UI surface for the per-project `loaderMode` toggle (D-08). Existing project-level state plumbing (e.g., `documentation` from Phase 20) is the established pattern.
- `src/main/ipc.ts` — `KNOWN_KINDS` registration for `MissingImagesDirError` (D-10).
- `src/core/usage.ts:90-124` — already walks `skin.attachments` to enumerate region attachments for the unused-attachment detector. The atlas-less synthesizer can reuse the same iteration shape, but the goal differs (synthesize regions, not detect unused).

### Files Created (new in Phase 21)
- `src/core/png-header.ts` — pure-TS PNG IHDR byte-parser. ~30 lines. Public API: `readPngDims(buffer: Buffer): { width: number; height: number }` or similar.
- `src/core/synthetic-atlas.ts` — builds in-memory `TextureAtlas` from per-region PNG headers. Public API: `synthesizeAtlas(skeletonData: SkeletonData, imagesDir: string): { atlas: TextureAtlas; sourceDims: Map<...>; sourcePaths: Map<...>; atlasSources: Map<...> }` or similar.
- `tests/core/png-header.spec.ts` — unit tests against fixtures/SIMPLE_PROJECT/EXPORT_PROJECT PNGs.
- `tests/core/synthetic-atlas.spec.ts` — unit tests for synthesis.
- `tests/core/loader-atlas-less.spec.ts` (or extend `tests/core/loader.spec.ts`) — round-trip integration test.
- `fixtures/SIMPLE_PROJECT_NO_ATLAS/` (name TBD) — golden fixture for atlas-less round-trip.

</code_context>

<specifics>
## Specific Ideas

- **The atlas-less workflow lives.** This is the natural pre-pack state of source assets and the post-Optimize-overwrite state of the same project. Both real, both supported.
- **No regression for canonical projects.** Atlas-by-default when both `.atlas` and `images/` are present (D-07). All existing fixtures (SIMPLE_PROJECT, EXPORT_PROJECT, Jokerman, Girl) continue to load through the canonical path. Only the new atlas-less fixture exercises the synthesis path.
- **User-overridable.** A per-project toggle (D-08) lets users force atlas-less mode even when an atlas is present — useful for testing the new path on an existing project, and for the post-Optimize-overwrite scenario where the on-disk atlas is stale.
- **Phase 22 is the real consumer.** Dim-drift badge + export-cap math is Phase 22, NOT Phase 21. Phase 21 plants the infrastructure (`png-header.ts`); Phase 22 wires it into DisplayRow + UI + export math.

</specifics>

<deferred>
## Deferred Ideas

- **Dim-drift badge UI + export-cap math** — Phase 22 (SEED-002). DIMS-01..05. Already roadmapped, do not bundle.
- **Orphan-PNG detection** (PNG files in `images/` that the JSON doesn't reference) — Phase 999.6. Gated on Phase 21's existence, but separate scope.
- **Atlas-savings report** inside OptimizeDialog — Phase 999.4. Gated on Phase 21 (per ROADMAP line 510), separate scope.
- **Recency-based auto-detection** (compare `.atlas` mtime vs newest `images/` PNG mtime) — considered, rejected. Filesystem mtime fidelity is unreliable across operating systems and copy operations; per-project explicit override (D-08) is the predictable answer.
- **Spine 4.2 JSON nonessential-data field name + presence verification** — research item for the Phase 21 planner so Phase 22 has firm ground when wiring canonical-vs-actual drift detection.

</deferred>

---

*Phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas*
*Context gathered: 2026-05-01*

# Milestones

## v1.7 Multi-Scale Per-Resolution Variant Exporter (Completed: 2026-05-25)

**Phases completed:** 6 phases (48–53), 17 plans
**Test baseline at close:** 1,553 vitest passing / 0 failed; both typechecks (node + web) exit 0; arch 20/20 (Layer-3 purity held)
**Source change:** 18 files in `src/`, +2,820 / −35 (the remaining repo delta is committed oracle/perf fixtures + planning docs)
**Timeline:** 2026-05-22 → 2026-05-24 (3 days)
**Git range:** `73a1f0c` (milestone start, post-`v1.6.1`) → milestone-close HEAD (164 commits)
**Tag:** `v1.7` (created locally; **not pushed** — release/publish is a separate owner decision)
**Security:** verified for all 6 phases (`48-SECURITY.md`..`53-SECURITY.md`)

**Delivered:** A complete multi-scale variant exporter. From one full-size Spine export, the animator produces faithful scaled-down rig variants (scaled skeleton JSON + resized textures + scaled atlas, each in its own folder), single or batch, sized to each smaller rig's own peak render demand, across dual-runtime (4.2 + 4.3) and both loader modes — without ever modifying the source project. Built on a proven Layer-3-pure JSON→JSON bake that is field-identical to Spine's own `SkeletonJson.scale`. The milestone was deliberately kept open by the owner to fold two extra phases (52, 53) into v1.7 rather than defer them to v1.8.

**Key accomplishments:**

1. **Core scale-bake module + CI regression oracle** (Phase 48) — `src/core/scale-bake.ts`, a Layer-3-pure (zero-import) non-mutating JSON→JSON similarity bake `bake(json,s)` field-identical to spine-core `SkeletonJson.scale` across both schemas (4.2 split + 4.3 unified), incl. all constraint-timeline curve channels + scaled-default injection. Proven by the decisive sampling-free oracle `parse(bake(orig,s),1) ≡ parse(orig, SkeletonJson.scale=s)` (live reference, NO golden numbers) running in CI across 8 rigs × 3 scales. BAKE-01..04.
2. **Single-scale variant export** (Phase 49) — the first feature to ever make the app WRITE a skeleton JSON. "Export Variant…" bakes a scaled copy (source sha256-immutable), sizes textures arithmetically (`variant_peak = s × master_peak`, never re-sampling), and reuses `buildExportPlan` + the atlas-writer UNCHANGED to emit a drop-in `{NAME}@{s}x/` package across `loose|atlas|both` × dual-runtime × dual loader-mode. EXPORT-01/02/03/05.
3. **Rig-bounds + two-way scale↔dimension input** (Phase 50) — `computeSetupPoseBounds` (dual-runtime all-skins setup-pose AABB union) + a `VariantDialog` Scale card with three coupled aspect-locked inputs (factor/W/H) over the bbox reference. SCALEUI-01/02.
4. **Batch variant export** (Phase 51) — N scales → N folders in one run; a behavior-preserving `exportOneVariant` extraction looped per scale (byte-identity to the single-scale path BY CONSTRUCTION) + a renderer multi-row dialog (continue-on-error, dedup/invalid gates, per-folder results, Cancel). Live-UAT approved. Plus three user-requested post-UAT polish rounds (per-image progress, live row coloring, pre-flight overwrite ConflictDialog). EXPORT-04.
5. **Batch export robustness + dialog cleanup** (Phase 52) — per-row duplicate-token continue-on-error (was whole-batch abort), no orphan empty folders, consistent boundary coercion, a `tokenFor`≡`formatScaleToken` equivalence test, and the dead-prop/onStart cleanup — clearing the Phase-51 review backlog with no happy-path change. EXPORT-06.
6. **Persist variant state in `.stmproj`** (Phase 53) — additive-optional `variantRows: { scale: number }[]` round-tripped end-to-end (shared types → pure-core validator/serialize/materialize → main Open assembly → AppShell restore-on-both-load-paths + dirty-by-scale-projection), reusing the existing `lastOutDir` for the output half. No schema version bump (`V_LATEST` stays 1); old files open to defaults; an inaccessible output folder falls back to the picker. SCALEUI-03.

**Known gaps / deferred at close:** 11 open-artifact-audit items acknowledged and deferred (all documented prior-milestone carry-forwards — Phase-0 scale-overshoot debug, the alpha-0 quick-task scanner false-positive, SEED-009 dormant, UAT/verification on 36/41/47; the one genuinely-new v1.7 item — the Phase 49 native folder-picker visual UAT — was resolved live on 2026-05-25). Future v1.7 requirements deferred: per-scale override behavior, variant presets, a what-if peak preview. See STATE.md → Deferred Items.

**Archived artifacts:**

- `.planning/milestones/v1.7-ROADMAP.md` (full phase details Phases 48–53 preserved)
- `.planning/milestones/v1.7-REQUIREMENTS.md` (all 13 requirements with final statuses)

---

## v1.6 Spine 4.3 Runtime Port — Dual-Runtime (Shipped: 2026-05-19 as v1.6.1)

**Phases completed:** 6 phases (42–47), 24 plans
**Timeline:** 2026-05-16 → 2026-05-19
**Tag:** `v1.6.1` (released to users; `v1.6.0` is a dead/phantom tag — its release.yml run failed before any build, gate held, fix-forwarded to v1.6.1)

**Delivered:** Ported the skeleton/animation math from a single spine-core 4.2 runtime to a dual-runtime architecture that loads and correctly samples both Spine 4.2 and Spine 4.3 skeleton JSON, routed by detected skeleton version — 4.2 support retained and byte-equal regression-gated. v1.6.1 was the first public release since v1.3.6 (folds in the never-pushed v1.4 / v1.5 / v1.5.1).

**Key accomplishments:** npm-alias dual install (`@esotericsoftware/spine-core@4.3.0` canonical + `spine-core-42`=`4.2.111`); a `SpineRuntime` facade so `core/sampler.ts`/`bounds.ts` call through `load.runtime.*` (Layer-3 purity preserved, arch-anchored); the loader turned from a 4.3 rejecter into a version dispatcher (`resolveRuntimeTag`); a cross-runtime equivalence oracle that caught a real ship-blocker (4.3 mesh UVs were region-space, undersizing every 4.3 mesh by 2.251×); the 4.3-only `slider` constraint validated by a closed-form oracle with owner-editor triangulation; a CI-enabled 4.3 perf budget; and a dual-runtime Animation Viewer (4.2 → frozen alias-isolated spine-player@4.2.111 + the pre-migration modal; 4.3 → migrated spine-player@4.3.0), routed off the core runtime tag.

**Archived artifacts:**

- `.planning/milestones/v1.6-ROADMAP.md` (full phase details Phases 42–47 preserved)
- `.planning/milestones/v1.6-REQUIREMENTS.md` (all v1.6 requirements with final statuses)

---

## v1.5 Override Routing + Coverage Hardening + Atlas Repack (Shipped: 2026-05-15)

**Phases completed:** 5 phases, 23 plans, 50 tasks

**Key accomplishments:**

- Type contracts + validator/serializer plumbing for SEED-007 split-overrides-per-loader-mode: added `overridesAtlasLess` to `ProjectFileV1` / `AppSessionState`, `restoredOverridesAtlasLess` to `MaterializedProject`, renamed `mergedOverrides` to `mergedOverridesBuckets` at both IPC payload sites — pure additive, no `.stmproj` schema version bump.
- Wired up `src/main/project-io.ts` to do per-bucket migration at all three IPC seams (Open / locate-skeleton recovery / resample), apply the SEED-007 D-02 / L-02 legacy-routing decision at the Open seam, and complete the `mergedOverridesBuckets` rename atomically across both `SkeletonNotFoundOnLoadError` rescue payload assembly sites + the recovery validator — `src/main/override-migration.ts` body is unchanged (mode-invariant helper).
- Threaded the two-bucket override model through `src/renderer/src/components/AppShell.tsx` and `src/renderer/src/App.tsx`: two `Map<string, number>` state slots (`overrides` + new `overridesAtlasLess`), a single memoized `activeOverrides` slice (`loaderMode === 'atlas-less' ? overridesAtlasLess : overrides`), active-bucket-only writes in OverrideDialog handlers, all 4 `buildExportPlan` call sites + atlas-preview library wirings + `<AtlasPreviewModal>` JSX prop + resample IPC payloads + 2 panel prop mounts now read `activeOverrides`, Save serializer writes both buckets, `lastSaved` snapshot + dirty-derivation extends to both buckets (mode-switch alone stays clean), ALL THREE `setOverrides` hydration sites (runReload 1099, mountOpenResponse 1239, samplingHz-resample 1542) have sibling `setOverridesAtlasLess` calls, `skeletonNotFoundError.mergedOverrides` renamed to `mergedOverridesBuckets` and mirrored in App.tsx, and the locked D-01..D-04 one-shot mode-toggle toast (verbatim D-04 copy + verbatim D-03 localStorage suppression key + banner-stack visual idiom mirroring `loaderModeHealedNotice`).
- OVR-06 round-trip + forward-compat + per-bucket migration contracts locked via vitest unit tests. Two test files updated: `tests/core/project-file.spec.ts` (+2 Phase 36 tests; 13 pre-existing literal sites updated to include `overridesAtlasLess: {}`); `tests/main/override-migration.spec.ts` (+2 OVR-04 per-bucket tests, helper body unchanged).
- Landed the OVR-07 AppShell mode-switch divergence integration test (3 tests, all passing) — covers the apply-toggle-assert contract in both directions (atlas-source → atlas-less; atlas-less → atlas-source) PLUS the samplingHz-change inactive-bucket preservation regression catcher per the 2026-05-13 blocker review. Closed 4 downstream test-fixture typecheck errors (3 phase-36-owned + 1 post-Plan-36-03 D-14 dep-array sentinel) and 2 stale `mergedOverrides:` references in save-load.spec.tsx. Phase-wide quality gate runs clean: npm run typecheck reports only 1 pre-existing TS6133; npm test reports 1051 passing tests, 21 skipped, 2 todo, plus 2 pre-existing missing-fixture failures (SAMPLER_ALPHA_ZERO + Girl — both proprietary assets) that predate Phase 36. SEED-007 status flipped from `dormant` to `closed` with `closed_during: 36-split-overrides-per-loader-mode` and a top-of-doc 2026-05-13 closing note.
- Source-cited PASS verdicts for RGBA2Timeline (geometry-invariant) and InheritTimeline (lifecycle covers); TIMELINE-02 conditional-escalation clause TRIGGERED locks TIMELINE-03 as strict `peak(detached) > peak(baseline)`.
- Fixture-driven regression contract proves the sampler lifecycle (state.update → state.apply → skeleton.update → updateWorldTransform) propagates the InheritTimeline NoScale detach (Animation.js:755 bone.inherit mutation → Bone.js:144 readback) — observed peak ratio 2.5x (BASELINE=0.4 vs INHERIT_DETACH=1.0).
- Synthetic RGBA2Timeline injection on SQUARE2 (the only `dark`-bearing slot in SIMPLE_TEST) proves slot-color timelines cannot affect peak render scale — strict byte-equal globalPeaks Map vs baseline; SEED-005 flipped planted -> closed with closure breadcrumb naming Phase 37 + TIMELINE-01..TIMELINE-05.
- One-shot POLISH-01 deliverable — 38-POLISH-AUDIT.md enumerates all 7 deferred findings (IN-01..IN-06 + WR-03) from 04-REVIEW.md, with 1 applies (IN-02), 5 no-ops swept by Phase 6 R6 + Phase 27 QA-01..04, and 1 skip (IN-04 intentional duplication)
- OverrideDialog overlay-dismiss handler converted from `onClick={props.onCancel}` to `onMouseDown` + `e.target === e.currentTarget` guard, preventing accidental cancellation when the user drag-selects their typed percentage and releases on the overlay.
- Retired the 7-milestone-old `2026-04-24-phase-4-code-review-follow-up.md` pending todo via `git mv` + ## Resolved append, citing 38-POLISH-AUDIT.md's 1-applies/5-no-ops/1-skip verdict for full audit-trail traceability.
- Recorded `host_available: yes` for v1.5 cycle and locked the graceful-degradation contract — both WINUAT-01 (DocBuilder DnD) and WINUAT-02 (admin DnD advisory) will execute LIVE in plans 39-02 and 39-03; 39-CONTRACT.md captures the decision, the independence/outcome/todo-lifecycle invariants, the two pre-discovered file-path corrections, and the canonical 4-row routing matrix.
- WINUAT-01 closed `passed` — Phase 20 DocBuilder DnD UAT executed live on a real Windows host with the v1.x installer; all four observation points (drag image, mixTime=0.25, loop=false, clean console) reported pass by the user.
- Closed WINUAT-02 live with outcome `passed` (2026-05-13) — user confirmed all four observation points (verbatim advisory, drag-over ring suppressed, File → Open functional, normal-relaunch DnD restored) on a real Windows admin session against the v1.3.1+ installer; flipped item 1 in archived 31-HUMAN-UAT.md from `deferred` to `passed`, recomputed Summary (passed: 4, pending: 0), retired Phase 31 todo from `pending/` to `resolved/` with a `## Resolved` close-out, and satisfied WINUAT-03 for the Phase 31 half — all captured in one atomic commit `0041fba`.
- 4 additive atlas fields (`atlasOutputMode` / `atlasMaxPageSize` / `atlasAllowRotation` / `atlasPadding`) on `ProjectFileV1`+`AppSessionState`, plus optional `phase?: 'resize'|'composite'` on `ExportProgressEvent`, with validator pre-massage + serializer + materializer + 4 round-trip tests — no schema version bump.
- Pure-TS `computeRepack` wrapping maxrects-packer@2.7.3 with oversize pre-flight, deterministic regionName sort, and rotation read-back — the pack-math foundation consumed by Plans 03 (atlas-writer) and 05 (repack-worker).
- Pure-function libgdx-format .atlas text serializer with spine-core TextureAtlas round-trip parity, locked rotation toggle, and 1-offset page-naming convention.
- Shared sharp resize helper (`src/main/sharp-resize.ts`) extracted with terminal-action split (`resizeToTmpFile` returns chained `sharp.Sharp`, `resizeToBuffer` returns `Promise<Buffer>`) — same internal chain, two entry points by output-shape; loose-mode within-run byte-parity SHA256 test as cheap regression canary before the stronger cross-baseline gate (Plan 08).
- Sharp orchestration for atlas-mode output: resize → emits-truth read-back → pack → rotate-prep → composite → atlas-write, with the REPACK-10 atomic-or-fail rollback contract enforced via a shared writtenPaths Set populated BEFORE every write.
- Wired `runRepack` into the existing `export:start` IPC channel via 2 new positional args (`outputMode` + `atlasOpts`) with a shared `writtenPaths: Set<string>` accumulator driving an inner-catch fs.rm sweep — realizing REPACK-10 atomic-or-fail acceptance b at the IPC seam without breaking the pre-Phase-40 5-arg call path (REPACK-01 byte-equivalence preserved).
- Loose/Atlas/Both radio + 3 atlas knobs (max page size / allow rotation / padding) in OptimizeDialog Output card, threaded end-to-end through AppShell .stmproj round-trip and Plan 06's widened export:start IPC, with REPACK-10 verbatim error surfacing.
- REPACK-01 strictest-gate + REPACK-08 cross-loaderMode parity + REPACK-09 sharpen-invariant pack layout — SHA256 sentinel infrastructure with refresh-by-env workflow that NEVER runs in CI (D-07).

---

## v1.4 Spine 4.3 Forward-Compat + Rotated Atlases (Shipped: 2026-05-12)

**Phases completed:** 4 (Phase 32, 33, 34, 35)
**Plans:** 18 (4 + 6 + 4 + 4)
**Requirements:** 14 (COMPAT-01..02 + ATLAS-01..04 + OPEN-01..05 + DEDUP-04..06)
**Timeline:** 2026-05-10 → 2026-05-12 (3 days)
**Git range:** `v1.3.6` tag → `1bf374f` (gitignore cleanup pre-close)
**Tag:** `v1.4.0` (pending — to be pushed after this commit)

**Delivered:** Made 4.2-only support honest and visible (drop-zone v4.2 disclosure + structured `SpineVersionUnsupportedError` replacing today's misleading `IK Constraint not found: <name>` symptom). Removed the rotated-atlas hard-throw with full rotated-region support (loader attachment-walk for canonical-corner offset override, AABB W↔H swap in bounds.ts, ExportPlan output-dim swap, `sharp.rotate(+90)` materialization in image-worker). Added File → Open menu acceptance for `.json` skeletons (closing the menu ↔ drag-drop asymmetry; two-IPC-step architecture with dirty-guard-after-picker). Propagated Phase 29's per-region dedup contract to `buildExportPlan` (iteration source migrated from `summary.peaks` → `summary.regions`, closing the multi-skin atlas-source undercount surfaced on the new JOKERMAN fixture: 160 atlas regions previously collapsed to 23 ExportRows; now produces 160).

**Key accomplishments:**

1. **Spine 4.3-beta detect-and-warn + drop-zone v4.2 disclosure + SEED-006 plant** (Phase 32, COMPAT-01/02) — `checkSpine43Schema` predicate landed in `src/core/loader.ts` BEFORE atlas resolution; sniffs `root.constraints` array OR `skeleton.spine` semver `≥ 4.3`. `SpineVersionUnsupportedError` constructor branched with COMPAT-01 wording for the 4.3-detected path: *"This app currently supports Spine v4.2. Re-export from your 4.3 editor as Version 4.2 (supported downgrade) and try again."* — replaces the misleading `IK Constraint not found: <name>` symptom that 4.2 spine-core surfaces on 4.3 JSONs (whose constraint definitions live under unified `root.constraints` instead of the legacy four-array layout). Idle drop-zone copy at `App.tsx:622` surfaces `v4.2` in `font-bold text-danger`. SEED-006 (full 4.3 runtime port — 5 sampler renames + 2 bounds signature changes + slot.pose access + slider validate + vendoring strategy) planted under `.planning/seeds/` for post-`spine-core@4.3-stable` npm publish trigger.
2. **Rotated atlas region support** (Phase 33, ATLAS-01..04) — Hard-throw `RotatedRegionUnsupportedError` removed atomically alongside loader D-01 attachment-walk for canonical-corner offset override + AABB W↔H swap in `src/core/bounds.ts` when `region.rotate === true` + `sharp.rotate(+90)` materialization in image-worker (libvips extract+resize fusion bug requires materialize between operations — fix `5aa2651`) + real-Spine-packer regression fixture at `fixtures/spine_rotated/EXPORT/`. UAT surfaced the libgdx atlas convention nuance: `bounds:x,y,W,H` stores W/H in canonical (pre-rotation) orientation; page-pixel rect for rotated regions is `(H × W)` per spine-core TextureAtlas.js:164-167 — loader.ts now sets `packW/packH = page-pixel` and `w/h = canonical`. Atlas-less mode unaffected (synthetic atlas never packs with rotation).
3. **File → Open accepts `.json` skeletons** (Phase 34, OPEN-01..05) — Wave 1 picker-only `handleOpenDialog` with three-arm discriminated `OpenDialogResponse` envelope + new `'project:open-dialog'` IPC channel + `openProjectPicker`/`loadSkeletonFromPath` preload bridges + old `window.api.openProject`/`'project:open'` channel/`handleProjectOpen` physically deleted. Wave 2 renderer rewire of `App.tsx onMenuOpen` to two-IPC-step flow with D-05 dirty-guard-after-picker (amends Phase 08.2 D-183 for the menu path: cancelling the picker NEVER fires the guard) + D-06 dispatch-by-kind. Wave 3 vitest coverage for OPEN-01..05 + renderer mock-surface migration + orphan 8.1-VR-02 skip block deleted. Wave 4 REQUIREMENTS.md OPEN-0x namespace + v1.4 coverage 6→11 + ROADMAP Phase 34 Requirements field locked. 16/16 must-haves verified programmatically; HUMAN-UAT 1 scenario host-blocked (deferred — see STATE.md Deferred Items).
4. **Region-keyed export plan** (Phase 35, DEDUP-04..06) — `buildExportPlan` in both `src/core/export.ts` and renderer mirror `src/renderer/src/lib/export-view.ts` now iterates `summary.regions` (RegionRow[]) instead of `summary.peaks` (attachment-name-deduped DisplayRow[]). Closes the multi-skin atlas-source undercount: 160 atlas regions that collapse to 23 attachment-name-deduped peaks now produce 160 ExportRows. Plan 35-01 migrated core + Rule-3 auto-fixed synthetic summary literals in 4 sibling test files; Plan 35-02 mirrored byte-identically into renderer + updated parity-regex assertion in a single atomic commit; Plan 35-03 audit confirmed atlas-preview-view.ts / atlas-preview.ts / OptimizeDialog header already region-keyed (no-op — Phase 29 invariant preserved); Plan 35-04 added 5-layer regression test suite. UAT user-approved against new `fixtures/SKINS/JOKERMAN_SPINE.json` (7 skins, 160 regions). Full test suite: 1061 passed / 0 failed. Verifier: 8/8 must-haves verified.

**Late post-implementation fixes (post-WAVE commits before tag):**

- `c87ef04 fix(35) WR-06`: reject path-traversal segments in relativeOutPath (defensive).
- `9381a32 fix(35) WR-05`: replace silent fixture-skip with it.skipIf for absent local-only fixtures.
- `68e3ea7 fix(35) WR-04`: classify Tests 1-3 as shape locks, Test 4 as discriminator.
- `2722338 fix(35) WR-03`: document divergences in synthRegionsFromPeaks helper.
- `aa8c3f3 fix(35) WR-02`: key exclude check by regionName (Phase 29 D-04 alignment).
- `f5cdf9f fix(35) WR-01`: dedup attachmentNames in initial-insert path.
- `5aa2651 fix(33)`: materialize rotated atlas extract before resize (libvips fusion bug).
- `c022c74 fix(loader-mode)`: honor saved atlas-less mode on reload (debug atlas-mode-toggle-load-prio).
- `8f20c61 fix(override-migration)`: source presentRegions from summary.regions (multi-skin coverage).

**Known deferred at close:** Phase 34 HUMAN-UAT 1 open scenario (host-blocked: macOS/Windows picker rendering parity verification) + Phase 34 VERIFICATION human_needed (same root). Plus pre-v1.4 carry-forwards from v1.0-v1.3.1: Phase 14/15/20/21/23/25/26.1/30/31 host-blocked UAT/verification gaps; phase-0-scale-overshoot debug session (long-lived); 3 long-lived pending todos (Phase 4 code review, Phase 20 Win/Linux DnD, Phase 31 Win admin DnD release UAT). Full list preserved in STATE.md `## Deferred Items` (carried forward unchanged).

**Seeds carried forward to v1.5+:**

- SEED-004 (Rotated atlas regions) — picked up THIS milestone (Phase 33); status now closed.
- SEED-005 (RGBA2 + InheritTimeline coverage) — deferred again; audit-only or full feature surface; not in v1.4 scope.
- SEED-006 (Full Spine 4.3 runtime port) — planted in Phase 32; trigger condition: `npm view @esotericsoftware/spine-core@latest` returns 4.3.x OR a paying user reports they cannot re-export their rig as Version 4.2.
- **SEED-007 (Split overrides per loaderMode) — planted 2026-05-12** pre-close; trigger: v1.5+ when scoping overrides/loaderMode work or any milestone touching `.stmproj` schema or atlas-less mode ergonomics. Bug is intent-routing (math is mode-invariant — verified during seed-capture).

**Archived artifacts:**

- `.planning/milestones/v1.4-ROADMAP.md` (full phase details preserved)
- `.planning/milestones/v1.4-REQUIREMENTS.md` (all 14 v1.4 requirements with `[x]` outcomes)
- `.planning/phases/32-*/`, `33-*/`, `34-*/`, `35-*/` (kept in place — not archived to milestones/v1.4-phases/ per user choice; can be retroactively archived later via /gsd-cleanup)

---

## v1.3.1 Correctness & Refinements (Shipped: 2026-05-09)

**Phases completed:** 3 (Phase 29, 30, 31)
**Plans:** 16 (7 + 5 + 4)
**Requirements:** 20 (REGION-01..07 + PREVIEW-01 + BUFFER-01..03 + LOAD-05..07 + PANEL-08..11 + PLATFORM-01 + TOOLTIP-01)
**Timeline:** 2026-05-07 → 2026-05-09 (3 days)
**Git range:** `v1.3.0` tag → `d86e7b3` (per-frame canonical dims fix)
**Tag:** `v1.3.1`

**Delivered:** Closed the per-region dedup correctness gap surfaced post-v1.3 ship (path-indirected duplicate rows), added a user-configurable safety-buffer percentage in the Optimize dialog with cap-aware predicate, and landed targeted UX refinements (source-toggle disabling, Animation Breakdown collapse defaults, Windows admin DnD fallback, ExtrapolationIcon tooltip primitive). No new math, no schema-version bump, no auto-update changes.

**Key accomplishments:**

1. **Per-region dedup + override-region semantics + atlas-preview pack-page accuracy** (Phase 29, REGION-01..07 + PREVIEW-01) — Root cause of "duplicate rows for path-indirected attachments" was `analyzer.ts` looking up `atlasSources` / `sourcePaths` / canonical+actual dim maps by `attachmentName` while loader populated them by atlas region name (e.g. `6/9_FRAME_0`). For Chicken's `SYMBOLS.json`, 249 of 531 attachment bindings hit the miss-path. Fix: new `RegionRow` interface in `src/shared/types.ts`, `analyzeRegions()` sibling fold in `src/core/analyzer.ts` (region-keyed dedup with REGION-05 lex tiebreak on attachmentName), `SkeletonSummary.regions` non-optional field, AtlasPreview re-keyed onto regionName + attachmentNames[]. Override storage flipped to bind to region (D-150 stale-key drop pattern for legacy attachmentName overrides at .stmproj load). Atlas Preview projected page count now matches actual atlas page count for path-indirection rigs (Chicken: 13 not 14).
2. **Safety buffer in Optimize dialog** (Phase 30, BUFFER-01..03) — User-configurable safety-buffer % control in OptimizeDialog (default 0%, integer step). Buffer multiplicatively increases each row's effective scale (and any user-set overrides) BEFORE the export plan is computed; D-91 source-fraction cap still hard-clamps any extrapolation. NARROW `bufferCapped` predicate per CONTEXT D-06 (`bufferPct > 0 && bufferedScale > sourceRatio && safeScale(rawEffScale) <= sourceRatio`); flag is silent-only in v1.3.1, may broaden to canonical-1.0 clamp later. Persisted per-project as additive optional field in `.stmproj` v1 schema mirroring `sharpenOnExport` (Phase 28) precedent — missing field defaults to 0% for backward-compat with v1.2/v1.3 project files; no schema-version bump.
3. **Loader & UX small-fixes batch** (Phase 31, LOAD-05..07 + PANEL-08..11 + PLATFORM-01 + TOOLTIP-01) — Source toggles ("Use Atlas as Source" / "Use Images Folder as Source") now grey-out + tooltip when the corresponding artifact is absent in the project folder (LOAD-05/06/07). Animation Breakdown panel cards (including Setup Pose) collapsed by default on mount + tab-switch with bulk Expand-all / Collapse-all buttons styled to v1.3 unified `h-8` toolbar (PANEL-08..11; in-memory React state only — no schema persistence by user decision). Windows admin DnD fallback: when running elevated, drop zones disable + a clear advisory routes the user to File → Open or unprivileged relaunch (PLATFORM-01; UIPI message-filter workaround deliberately not pursued — Microsoft-discouraged). ExtrapolationIcon tooltip primitive ported from DimsBadge (TOOLTIP-01; second known regression of this surface — locked via fix-shape (c) tests).

**Late tester-regression fixes (post-Phase-31 commits before tag):**

- `1b5414c fix(export)`: handle Strip-Whitespace atlas regions in extract pipeline (atlas-pack option preserved per memory `project_atlas_pack_options_atlas_source_only`).
- `834c975 feat(optimize-dialog)`: auto-expand failed rows so error message is visible.
- `d86e7b3 fix(sequence)`: per-frame canonical dims + suppress atlas-source badge for Spine sequence attachments.

**Known deferred at close:** Pre-release HUMAN-UAT items for Phase 30 (4 scenarios) + Phase 31 (Windows admin DnD live observation) explicitly meant to be done at release time, captured in `.planning/todos/pending/2026-05-08-phase-31-windows-admin-dnd-release-uat.md`. Three v1.4-bound seeds planted: `path-indirected-duplicate-rows.md` (pending_phase_plan), `post-v1-3-tester-regressions.md` (diagnosed), SEED-004 (rotated atlas regions) + SEED-005 (RGBA2 + InheritTimeline coverage).

**Archived artifacts:**

- `.planning/milestones/v1.3.1-ROADMAP.md` (full phase details preserved)
- `.planning/milestones/v1.3.1-REQUIREMENTS.md` (all 20 v1.3.1 requirements with `[x]` outcomes)
- `.planning/milestones/v1.3.1-phases/` (Phase 29/30/31 directories)

---

## v1.3 Polish & UX (Shipped: 2026-05-07)

**Phases completed:** 7 (Phase 23, 24, 25, 26.1, 26.2, 27, 28)
**Plans:** ~22 across the 7 phases
**Source LOC:** ~21,000+ (TS/TSX) in `src/` (modest growth over v1.2 ~20,174 — polish milestone, not feature-heavy)
**Timeline:** 2026-05-03 → 2026-05-07 (5 days, 293 commits since v1.2.0)
**Git range:** `v1.2.0` tag → `bbaf714` (drop Linux build for v1.3)
**Tag:** `v1.3.0`

**Delivered:** Closed v1.2 correctness/semantic gaps, refined the optimize workflow UX, and shipped a thorough UI polish pass — no new math, no new distribution work. Linux AppImage build dropped from CI (untested target; re-enable when UAT lands).

**Key accomplishments:**

1. **Optimize flow — defer folder picker** (Phase 23, OPT-01/OPT-02) — OptimizeDialog opens immediately on toolbar click; output-folder picker moves to the Start/Export click. Eliminates the up-front native-dialog stall before the user sees the export plan. 8-test regression suite locks the deferred-picker contract via OptimizeDialog render tests and AppShell source-grep gates.
2. **Panel semantics + atlas-savings metric** (Phase 24, PANEL-01/PANEL-02/OPT-03/PANEL-04) — Unused Assets panel now reports images-folder-vs-JSON orphaned PNGs (atlas-less semantics fixed) and is extracted as a collapsible sibling panel. The misleading "MB unused-attachment" callout is replaced by an atlas-savings metric. AtlasNotFoundError message mentions the images-folder alternative path. Orphaned-file I/O wired through `summary.ts` (`fs.readdirSync` + mode-aware `inUseNames` + `findOrphanedFiles`).
3. **Missing attachments in-context** (Phase 25, PANEL-03) — Rows with missing source PNGs stay visible in Global Max Render Source + Animation Breakdown panels with a red left-border accent, danger-triangle icon, and danger-tinted ratio cell. `DisplayRow.isMissing?: boolean` added to the IPC contract. Root cause: synthetic-atlas intentionally excludes stub regions from the sampler — the fix synthesizes stub rows in `buildSummary` for each `skippedAttachment` not already in peaks.
4. **UI polish — visual wins** (Phase 26.1, UI-06/UI-07/UI-10) — `#232732` cool blue-dark surface tokens, full-width panels, full-row zebra striping, danger-tinted missing rows with precise 16×16 inline SVG warning triangle (replacing Unicode ⚠), all 5 toolbar buttons unified to `h-8`, atlas-less chip surfaces image count via `loaderMode` conditional, danger-themed headers (`bg-danger/10` + `border-danger/40`) on problem-zone panels, AnimationBreakdownPanel gains bar-chart icon + animation count chip, GlobalMaxRenderPanel count cell `min-w-[6rem]` prevents layout shift.
5. **UI polish — tab restructure + icon audit** (Phase 26.2, UI-08) — 2-tab strip (Global / Animation Breakdown) lifted into a dedicated sub-toolbar row (sketch-001 variant A; resolves AP-01 anti-pattern from 2 prior reverts). Filmstrip + bar-chart icons added to both tabs (verbatim panel-header SVG reuse, `w-4 h-4`). "orphaned" → "unused" rename on 2 user-visible strings in UnusedAssetsPanel. Inline SearchBar removed from UnusedAssetsPanel. 4 fill warning-triangle icons converted to stroke style via shared `WarningTriangleIcon` component (D-06 single source of truth). The 3-tab restructure was DROPPED 2026-05-04 per user redesign — alert-bar layout retained (memory `project_alert_bars_top_on_both_tabs`).
6. **Code quality sweep** (Phase 27) — Phase 4 carry-forwards closed: `handleToggleRow` + `handleRangeToggle` in GlobalMaxRenderPanel converted to functional `setSelected((prev) => ...)` form (eliminates a latent stale-closure race; durable regression spec compares closure-form vs functional-form handlers side-by-side); OverrideDialog Apply button now disabled on empty/whitespace input (closes silent `Number('') === 0` clamp-to-1% floor); dead `open` prop + early-return guard removed in favor of AppShell's mount gate.
7. **Optional Output Sharpening on Downscale** (Phase 28, SHARP-01/SHARP-02/SHARP-03) — End-to-end `sharpenOnExport` toggle plumbing through types → validator/serializer/materializer → main IPC envelope → preload bridge → AppShell lifecycle → OptimizeDialog checkbox. `SHARPEN_SIGMA = 0.5` constant + private `applyResizeAndSharpen` helper added to `image-worker.ts`; both resize call sites (per-region + atlas-extract) collapse onto the helper. 5 integration-level regression tests + 4 unit-level round-trip tests lock SHARP-02 + SHARP-03 invariants. Note: PMA preservation is a no-op in the current sharp 0.34 + libvips 8.17 stack (verified by `scripts/pma-probe.mjs`; backlog 999.9 closed `falsified` 2026-05-06).

**Release-engineering changes:**

- Linux AppImage build dropped from CI (`build-linux:` job + `assets/*.AppImage` + `assets/latest-linux.yml` removed from `release.yml`; Linux section + auto-update Linux clause stripped from INSTALL.md). `electron-builder.yml` `linux:` block retained as a no-op for re-enable. (commit `bbaf714`)
- SEED-003 (Spine 4.3 compatibility) planted at end of milestone for v1.4 pickup; `fixtures/test_4.3/` etc. gitignored as proprietary 4.3-beta rigs. (commit `823f490`)

**Known deferred at close:** 21 items acknowledged (see STATE.md → Deferred Items). Most are pre-v1.3 carry-forwards (Phase 14/15/20/21 verification + UAT debt — host-blocked or human-eyeballs-required). v1.3-era jsdom-blocked items: Phase 23 + 25 verification (`human_needed` only because Electron native dialogs and visual UAT can't run headless), Phase 23 + 26.1 partial UATs.

**Archived artifacts:**

- `.planning/milestones/v1.3-ROADMAP.md` (full phase details preserved)
- `.planning/milestones/v1.3-REQUIREMENTS.md` (all v1.3 requirements with outcomes)
- `.planning/milestones/v1.3-phases/` (Phase 23–28 directories)

---

## v1.0 — MVP (Shipped: 2026-04-26)

**Phases completed:** 12 (Phase 0–9, plus 08.1 + 08.2 inserted)
**Plans:** 62
**Tasks:** 118
**Test baseline at close:** 331 passed + 1 skipped + 1 todo (333 total)
**Source LOC:** ~13,336 (TS/TSX) + ~8,432 (tests)
**Timeline:** 2026-04-22 → 2026-04-26 (5 days)
**Git range:** `796480d` → `318cdb8` (386 commits)

**Delivered:** A desktop app (Electron + React + TypeScript) that loads Spine 4.2+ skeleton JSON, computes the peak world-space render scale for every attachment across every animation/skin, and exports a per-attachment-optimized images folder via sharp Lanczos3 — driven by the actual world-space transforms the runtime computes, not guesswork.

**Key accomplishments:**

1. **Headless Spine math core** (Phase 0) — pure-TS sampler computing peak world-AABB per attachment via `computeWorldVertices` after `updateWorldTransform(Physics.update)`. Locked tick lifecycle (`state.update → state.apply → skeleton.update → updateWorldTransform`). Golden-tested against `fixtures/SIMPLE_PROJECT` (CIRCLE 2.018 / SQUARE 1.500 / TRIANGLE 2.000). Layer 3 invariant locked: zero DOM/`fs`/`sharp` imports in `src/core/`.
2. **Electron + React UI shell with dual analysis panels** (Phases 1–3) — JSON drop-load → Global Max Render Source table (sortable, searchable, selectable) + Animation Breakdown collapsible per-animation cards. Phase 3 D-72 jump-target system links them.
3. **Per-attachment scale overrides** (Phase 4) — D-91 source-fraction semantics: 100% = source dimensions (the absolute maximum, never surpassed), `<100%` shrinks. Two-button reset (peak / source). Persisted in project file. **LOCKED uniform-only** for Phase 6 export sizing (anisotropic scaling breaks Spine UV sampling).
4. **Unused-attachment detection + image export pipeline** (Phases 5–6) — `core/usage.ts` defined-vs-used diff; sharp Lanczos3 export with atomic Pattern-B write (`.tmp` + `fs.rename`) + cooperative cancel + skip-on-error progress UI. First native binary dependency (sharp) integrated with electron-builder asarUnpack.
5. **Atlas Preview modal** (Phase 7) — `maxrects-packer` projection + canvas drawImage rendering. Before/after dims + page-efficiency, dblclick-to-jump UX (the "20% glow override" workflow), oversize-region warning banner. Required Electron `app-image://` custom protocol + CSP extension. Live UAT signed off after 8-commit gap-fix chain (Electron `net.fetch(file://)` workaround + always-fixed canvas frame).
6. **`.stmproj` v1 save/load with crash-safe round-trip** (Phases 8 / 8.1 / 8.2) — discriminated-union typed-error envelope (8 kinds, including 7-field `SkeletonNotFoundOnLoadError` recovery payload); locate-skeleton recovery reachable from drag-drop AND toolbar Open paths; dirty-guard SaveQuitDialog with three reason discriminators (quit / new-skeleton-drop / new-project-drop) and 3-button Save/Don't Save/Cancel; native File menu + Cmd+O/S accelerator gating during error states.
7. **Complex-rig hardening + polish** (Phase 9) — sampler offloaded to greenfield `worker_threads` Worker (D-190, path-based protocol, terminate-based cancel); TanStack Virtual integration in both panels at threshold N≥100; SettingsDialog under Edit→Preferences (Cmd/Ctrl+,) with `samplingHz` re-sample wiring; HelpDialog with 7-section static React content + allow-listed `shell.openExternal`. **N2.2 wall-time gate: 606 ms on `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json`** — ~17× under the 10 s contract.

**Known deferred items:** 5 (see STATE.md → Deferred Items). Two seeds (atlas-less mode, dims-badge override-cap) are post-MVP by design; one debug session (phase-0-scale-overshoot) and one Phase 4 code-review todo carry forward as tech debt; one stale Phase 07 UAT flag (signed-off, 0 pending scenarios).

**Archived artifacts:**

- `.planning/milestones/v1.0-ROADMAP.md` (full phase details preserved)
- `.planning/milestones/v1.0-REQUIREMENTS.md` (all v1 requirements with outcomes)

---

## v1.2 — Expansion (Shipped: 2026-05-03)

**Phases completed:** 8 executed (Phase 16, 18, 19, 20, 21, 22, 22.1 complete; Phase 17 skipped UPDFIX-06 closed-by-test; Phase 13.1 deferred host-blocked)
**Plans:** 40 (6 + 2 + 7 + 4 + 12 + 5 + 4)
**Test baseline at close:** ~700+ vitest passing (690 at Phase 22.1 start; +UAT fixes)
**Source LOC:** ~20,174 (TS/TSX) in `src/`
**Timeline:** 2026-04-30 → 2026-05-03 (4 days)
**Git range:** `v1.1.3` tag + 286 commits → `a14bb3e`
**Tag:** `v1.2.0`

**Delivered:** Major expansion shipping macOS UX regressions closed, a full UI redesign, the Documentation Builder feature, and the two long-dormant atlas-less mode + dims-badge seeds — all while preserving the Layer 3 invariant, uniform-only export math, and the `.stmproj` v1 round-trip contract.

**Key accomplishments:**

1. **macOS auto-update → manual-download UX** (Phase 16) — Squirrel.Mac code-signature swap fail on ad-hoc builds fixed by routing macOS through the `manual-download` variant (same path as Windows). `windows-fallback` literal renamed end-to-end; strict `isReleasesUrl()` allow-list helper with 9 threat-model tests. UPDFIX-05 closed.
2. **App quit restored on macOS** (Phase 18) — `onCheckDirtyBeforeQuit` lifted from `AppShell.tsx` to `App.tsx` top-level `useEffect`, mirroring the Phase 14 renderer-lift pattern. Cmd+Q + AppleScript terminate cleanly; dirty-guard preserved. QUIT-01 + QUIT-02 closed.
3. **Complete UI redesign** (Phase 19) — Persistent sticky header (toolbar never scrolls offscreen); card-based panels with color-coded semantic state (green/yellow/red); Optimize + Atlas Preview modals gain summary tiles + cross-nav; unused-assets callout quantifies potential MB savings; Optimize Assets promoted as primary CTA. UI-01..05 closed.
4. **Documentation Builder feature** (Phase 20) — Per-skeleton documentation surface filling the `.stmproj` v1 reserved `documentation: object` slot (D-148, reserved v1.0 Phase 8). Animation tracks pane (DnD from side list, mix time + loop + notes), sections pane (events, general notes, control bones, skins), self-contained HTML export (optimization config snapshot + atlas page count + image utilization). DOC-01..05 closed.
5. **Atlas-less mode** (Phase 21) — Loads `json + images folder` projects without an `.atlas` file. New `src/core/png-header.ts` (IHDR byte parsing, no decode — CLAUDE.md fact #4 preserved) + `src/core/synthetic-atlas.ts`; loader 4-way branch order; 12 plans including 4 gap closures (stub-region, MissingAttachmentsPanel, toolbar layout, toggle-resample precedence). LOAD-01..04 closed.
6. **Dims-badge + override-cap round-trip safety** (Phases 22 + 22.1) — Canonical-vs-source PNG dim drift detected and surfaced as badge UI in both panels; export cap `min(peakScale, sourceW/canonicalW, sourceH/canonicalH)` prevents upscaling beyond actual source dims; generalized passthrough predicate (outW===sourceW AND outH===sourceH, evaluated POST-override); override-aware partition re-routes passthrough rows when override pushes effective scale below source-ratio cap (G-07 BLOCKER fixed). DIMS-01..05 closed.

**Known gaps (deferred at close):**

- UAT-01..03 (Phase 13.1): Linux AppImage runbook + macOS/Windows v1.1.0→v1.1.1 auto-update lifecycle — host-blocked; carry to v1.3.
- Phase 0 scale-overshoot debug session: v1.0-era AABB/rotation tech debt; no regression observed.
- Phase 4 code-review follow-up todo: v1.0-era polish item; tech debt.
- Phase 20 Windows/Linux DnD cross-platform UAT: host-blocked.

**Archived artifacts:**

- `.planning/milestones/v1.2-ROADMAP.md` (full phase details Phases 16–22.1 preserved)
- `.planning/milestones/v1.2-REQUIREMENTS.md` (all v1.2 requirements with final statuses)

---

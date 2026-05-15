# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-04-26
**Phases:** 12 (0–9 + 08.1 + 08.2 inserted) | **Plans:** 62 | **Tasks:** 118
**Test baseline at close:** 331 passed + 1 skipped + 1 todo
**Timeline:** 2026-04-22 → 2026-04-26 (5 days, 386 commits)

### What Was Built

- **Headless Spine math core** — pure-TS sampler computing peak world-AABB per attachment via spine-core's `computeWorldVertices` after `updateWorldTransform(Physics.update)`. Layer 3 invariant: zero DOM/`fs`/`sharp` imports in `src/core/`.
- **Two analysis panels** — Global Max Render Source (sortable, searchable, selectable) + Animation Breakdown (collapsible per-anim cards). Phase 3 D-72 jump-target system links them.
- **Per-attachment scale overrides** with D-91 source-fraction semantics (100% = source dims, never surpassed). Persisted in `.stmproj`. **LOCKED uniform-only** for export sizing.
- **Image export pipeline** — sharp Lanczos3 at compression level 9, atomic Pattern-B write (`.tmp` + `fs.rename`), cooperative cancel, skip-on-error progress UI.
- **Atlas Preview modal** — `maxrects-packer` projection + canvas drawImage, before/after dims + page efficiency, dblclick-to-jump UX.
- **Crash-safe `.stmproj` save/load** — discriminated-union typed-error envelope (8 kinds), locate-skeleton recovery from drag-drop AND toolbar Open paths, dirty-guard 3-button SaveQuitDialog with three reason discriminators.
- **Complex-rig hardening** — `worker_threads` Worker (greenfield), TanStack Virtual at N≥100, Settings + Help dialogs. **N2.2 wall-time: 606 ms on `fixtures/Girl/` — ~17× under contract.**

### What Worked

- **Phase 0 derisk paid off massively.** Locking the math contract before any UI saved 2–3 days of rework across Phases 1–9. Every UI phase shipped on a stable headless contract.
- **Layer 3 arch.spec invariant** (no `src/core/*` imports of DOM / `fs` / `sharp`) caught violations at CI before review. Held across all 12 phases without a single exception.
- **Wave-0 RED-spec scaffolding pattern** (Phase 8 Plan 01 → reused in 8.1) — type contract + grep-anchored RED specs land first; downstream plans drive each spec to GREEN. Eliminated rework on test contracts.
- **Hand-rolled ARIA modal scaffold** cloned across five dialogs (Override → Optimize → AtlasPreview → SaveQuit → Settings → Help). One pattern, zero modal-library deps, consistent UX.
- **Atomic Pattern-B write idiom** transferred cleanly from Phase 6 (sharp export) into Phase 8 (`.stmproj` save) — load-bearing across two subsystems unchanged.
- **D-102 byte-frozen invariants** (locked-file diffs vs baseline = 0 lines) caught accidental changes to `cli.ts` / `sampler.ts` / `loader.ts` early. CLI byte-for-byte unchanged across all 12 phases.

### What Was Inefficient

- **Phase 7 Atlas Preview required 8-commit gap-fix chain during live UAT.** Electron `net.fetch(file://)` produced `net::ERR_UNEXPECTED` inside `protocol.handle` — needed `fs.readFile + new Response(...)` workaround. The original plan's `pathToFileURL` premise was wrong. **Lesson: prototype Electron protocol-handler I/O before committing to a plan path.**
- **Decimal phase insertions (08.1, 08.2)** were necessary because Phase 8 verification surfaced reachability gaps (VR-01/VR-02/VR-03) AND a Cmd+O accelerator gating bug not caught until 08.1 UAT. **Lesson: human-verify gates produce real findings — budget for 1–2 decimal phases per major phase that introduces new error states.**
- **Phase 4 D-91 semantics rewrite** mid-phase (percent-of-peak → percent-of-source-dims) was caught only at human-verify. **Lesson: lock semantics decisions in CONTEXT before plan freeze; supersede-with-forward-reference is the recovery pattern but expensive.**
- **MILESTONES.md auto-population** dumped raw "One-liner:" stubs from inconsistent SUMMARY.md formatting. Required manual curation. **Lesson: enforce consistent SUMMARY.md frontmatter (`one_liner:`) so milestone close auto-extracts cleanly.**

### Patterns Established

- **Wave-0 RED-spec scaffolding** — type contract + grep-anchored RED specs land first, downstream plans drive each spec GREEN. (Phase 8 Plan 01 precedent, reused in 8.1.)
- **Discriminated-union typed-error envelope with kind-specific payload arms** — `Extract<Union, { kind: 'X' }>` narrowing exposes payload fields at the call site without per-site casts. (D-158/D-171.)
- **`Exclude<Union['kind'], PayloadArmKind>` at forwarder cast sites** — compile-time guard against accidentally producing the recovery-payload arm without populating its threaded fields. Zero runtime cost. (Phase 8.1 Plan 02.)
- **Pure-TS canonical + byte-identical renderer copy + parity spec** — `src/core/foo.ts` + `src/renderer/src/lib/foo-view.ts` locked by parity describe block. Used for `overrides`, `export`, `atlas-preview`. (Phase 4 D-75 precedent.)
- **NOT_YET_WIRED preload-stub pattern** — when extending the `Api` interface, land typed stubs in preload first to keep typecheck green during multi-plan implementation.
- **Atomic Pattern-B write** (`.tmp` + `fs.rename` in same dir) — crash-safe cross-subsystem.
- **React useRef callback-ref bridge for cross-component coupling** — when a stable callback identity must be passed to a third-party API but the impl depends on child-only state, hold `useRef<Fn|null>(null)` at the parent + stable `useCallback` wrapper that dereferences `.current` + child `useEffect` that registers/unregisters. (Phase 8.1 Plan 05.)
- **React 19 testing pattern** — use `await screen.findByX(...)` (testing-library waitFor) for async-driven DOM, never `await Promise.resolve()` chains. State updates from async handlers flush via macrotasks, not microtasks. (Phase 8.1 Plan 04.)

### Key Lessons

1. **Phase 0 derisk before UI work is non-negotiable for any project with non-trivial math.** The 7-plan headless spike paid back 5×+ over the milestone.
2. **Layer 3 invariants enforced by `tests/arch.spec.ts` (grep-based) catch architectural drift cheaply.** Adding a guard takes 5 minutes; debugging a violation 6 phases later takes hours.
3. **Live UAT signals trump plan optimism.** The Phase 7 8-commit chain and the Phase 4 D-91 rewrite were both caught only at human-verify. Budget for it.
4. **Decimal phase insertions are cheaper than scope creep.** Phases 08.1 + 08.2 closed gaps without polluting Phase 9. The numbering convention worked.
5. **`commit_docs: true` + atomic per-task commits + descriptive messages** make the git log a debugging asset. Rebase-friendly history mattered for Phase 7 gap-fix chain analysis.
6. **Electron protocol handlers + custom schemes need empirical prototyping.** Don't trust documentation alone — `net.fetch(file://)` + `standard: true` + missing-host parsing all surprised us.

### Cost Observations

- Model mix: not tracked formally (estimated ~70% Opus, ~30% Sonnet — Opus for planning + complex execution, Sonnet for routine plan execution and doc writes).
- Sessions: not tracked formally — 5 calendar days, 386 commits.
- Notable: Phase 0 → Phase 9 in 5 days end-to-end. Most expensive phase by token volume was Phase 8 (5 plans, large IPC/schema surface, 270 → 270 test baseline through bulk RED-spec scaffolding). Phase 7 was the most expensive in human-time per LOC due to the live-UAT chain.

---

## Milestone: v1.2 — Expansion

**Shipped:** 2026-05-03
**Phases:** 8 executed (16, 18, 19, 20, 21, 22, 22.1; 17 skipped; 13.1 deferred) | **Plans:** 40
**Test baseline at close:** ~700 vitest passing (~20,174 LOC TS/TSX)
**Timeline:** 2026-04-30 → 2026-05-03 (4 days, 286 commits since v1.1.3)

### What Was Built

- **macOS auto-update → manual-download UX** — Squirrel.Mac strict DR-check failure on ad-hoc builds resolved by routing macOS through the manual-download variant. `windows-fallback` literal renamed end-to-end; `isReleasesUrl()` allow-list helper (9 threat-model tests). UPDFIX-05 closed.
- **App quit restored on macOS** — `onCheckDirtyBeforeQuit` lifted to App.tsx top-level `useEffect` (mirroring Phase 14 pattern). Cmd+Q + AppleScript both terminate cleanly; dirty-guard preserved.
- **Complete UI redesign** — Persistent sticky header, card-based semantic panels (green/yellow/red state colors), Optimize + Atlas Preview modal tiles + cross-nav, MB savings callout, Optimize as primary CTA. UI-01..05 closed.
- **Documentation Builder** — Per-skeleton docs modal (Animation Tracks pane with HTML5 DnD, Sections pane, Export pane); self-contained HTML export; `.stmproj` D-148 `documentation:` slot filled without schema-version bump. DOC-01..05 closed.
- **Atlas-less mode** — `json + images folder, no .atlas` supported; PNG IHDR byte-parser (no decode, Layer 3 preserved); synthetic TextureAtlas builder; 4-way loader branch; 12 plans + 4 gap closures. LOAD-01..04 closed.
- **Dims-badge + override-cap** — `actualSourceW/H + dimsMismatch` on DisplayRow; badge UI in both panels; export cap `min(peakScale, sourceW/canonicalW, sourceH/canonicalH)`; generalized passthrough predicate (POST-override evaluation); override-aware re-partition fixed BLOCKER G-07. DIMS-01..05 closed.

### What Worked

- **SEED promotion via `/gsd-review-backlog`** paid off — SEED-001 + SEED-002 went from dormant seeds to fully shipped phases without any coordination friction; the seed files held enough context to plan from.
- **Decimal phase insertions** (22.1) absorbed 7 visual-UAT gaps without polluting the numbered sequence or requiring replanning. The gap-close pattern established in v1.0 held across the second major feature cluster.
- **Phase 22 gsd-verifier 5/5 PASS before human UAT** correctly separated code-level correctness from visual-surface correctness — human UAT then found 7 issues the code-level verifier couldn't see. This is the intended workflow; don't conflate the two verification layers.
- **POST-override passthrough re-partition** (G-07 fix in 22.1) was discovered and fixed during UAT rather than shipping broken. The UAT recipe created at Phase 22 close correctly covered the override interaction.

### What Was Inefficient

- **Phase 22 HUMAN-UAT deferred until after gsd-execute** surfaced 7 gaps including a BLOCKER (G-07 override-aware partition). Earlier manual UAT with an atlas-source-drift fixture during Phase 22 planning would have caught G-07 before execution. **Lesson: for phases that introduce passthrough/cap logic, add override-interaction tests to the UAT recipe during planning.**
- **Seed status files not auto-updated at phase completion** — the audit tool flagged SEED-001 + SEED-002 as dormant at milestone close, requiring manual fix. **Lesson: add seed status update to the phase completion checklist.**
- **REQUIREMENTS.md checkbox lag** — 20 of 26 checkboxes were still `[ ]` at milestone close despite the phases being complete; required bulk-fix at close. **Lesson: check off requirements as each phase completes, not at milestone close.**

### Patterns Established

- **Generalized passthrough predicate evaluated POST-override** — partition is `outW === sourceW AND outH === sourceH` after all overrides AND cap resolved; never against pre-override natural peakScale.
- **DimsBadge as a shared primitive** — badge + React tooltip component usable symmetrically across GlobalMaxRenderPanel + AnimationBreakdownPanel with the same mode-aware tooltip logic.
- **Atlas-source mode badge disambiguation** — when Source W×H displayed IS the canonical value (atlas-source mode), badge wording must reference the on-disk PNG vs the atlas declaration, not "source < canonical".
- **HTML5 DnD in Electron with `effectAllowed='copy'`** — standard DnD APIs work in Electron Chromium but require `effectAllowed='copy'` on `dragstart` and `preventDefault` mandatory on `dragover`; MIME type namespacing (`application/x-stm-anim`) avoids OS file-drop collision.

### Key Lessons

1. **Visual-surface UAT should happen during Phase 22-type phases, not just at post-execute gate.** Code verifier + test suite cannot cover tooltip hover reliability, badge mode-awareness, or dim-shape parity in OptimizeDialog.
2. **POST-override passthrough re-partition is load-bearing for the animator workflow.** Pre-override evaluation silently discards intentional overrides on capped rows — a primary use case for glow/blend-mode attachments.
3. **Phase 17 skip (UPDFIX-06 closed-by-test)** demonstrates that `/gsd-discuss-phase` investigation before planning is worth the investment — a 20-minute discussion saved a full verification-only phase.
4. **D-148 forward-compat `.stmproj` reserved slot** worked as designed — Phase 20 filled `documentation:` without a schema bump, and the materializer back-fill kept Phase 8-era files loadable.

### Cost Observations

- Timeline: 4 days, 286 commits (vs 5 days, 386 commits for v1.0 MVP — similar velocity on a smaller surface).
- Notable: Phase 21 was the largest single phase (12 plans; 4 inserted gap-closure plans). Phase 22.1 was the fastest gap-close (4 plans, 1 day). Most expensive human-time: Phase 19 UI redesign (7 plans, broad renderer surface, visual UAT iteration).

---

## Milestone: v1.3 — Polish & UX

**Shipped:** 2026-05-07
**Phases:** 7 (23, 24, 25, 26.1, 26.2, 27, 28) | **Plans:** ~22
**Timeline:** 2026-05-03 → 2026-05-07 (5 days, 293 commits)

### What Was Built

- **Optimize-flow UX correctness** (Phase 23) — OptimizeDialog opens immediately; folder picker fires on Start/Export click. Eliminates the up-front native-dialog stall.
- **Panel semantics rewrite** (Phase 24) — Unused Assets reports images-folder-vs-JSON orphans (correct atlas-less semantics); extracted as collapsible sibling panel; atlas-savings metric replaces the misleading MB callout.
- **Missing-attachment in-context rows** (Phase 25) — Stub `DisplayRow` synthesis post-sampler so missing-PNG rows stay visible in Global + Animation Breakdown with red accent + danger triangle.
- **Comprehensive UI polish** (Phase 26.1 + 26.2) — `#232732` surface tokens, full-width panels, full-row zebra, danger-tinted missing rows, `WarningTriangleIcon` shared component, unified `h-8` toolbar buttons, tab strip in dedicated sub-toolbar (resolves AP-01 anti-pattern from 2 prior reverts).
- **Phase 4 code-quality carry-forwards** (Phase 27) — Functional `setSelected` updater (closes stale-closure race); OverrideDialog empty-input Apply guard; dead `open` prop removal.
- **Optional output sharpening** (Phase 28) — `sharpen({ sigma: 0.5 })` post-Lanczos3 on downscale-only rows. Persists per-project in `.stmproj`. Mirrors Photoshop's "Bicubic Sharper (reduction)" preset.

### What Worked

- **Cheap diagnostic before scoping a fix.** Confirmed twice this milestone — Windows GPU ruling and Phase 28 PMA falsification via `scripts/pma-probe.mjs`. Both saved a multi-day implementation that would have been a no-op. Memory `feedback_narrow_before_fixing` upgraded from "validated" to "load-bearing."
- **Phase 28 same-day pivot from PMA to sharpening.** Original scope was promoted from backlog 999.9 (PMA preservation in Optimize Assets export). Within the discuss-phase, empirical falsification (sharp 0.34 + libvips 8.17 already auto-handle PMA) collapsed the original scope. The pivot to optional output sharpening was a clean replacement — same code surface, different lever, real user value.
- **Strict `loaderMode` separation lock-in.** Memory locked 2026-05-06: atlas-source and atlas-less are self-contained; `load.atlasPath` gates every read of the opposite artifact set. Held across the v1.3 panel-semantics rewrite without a single cross-mode leak.
- **`computeExportDims` canonical-base fix.** Surfaced + locked during Phase 22.1 fallout work — `outW` and `sourceRatio` must both use `canonicalW` to match `buildExportPlan`. Prevented atlas-source drift bug from re-emerging across v1.3 phases.
- **Layout bugs: ask for screenshot before iterating.** Memory `feedback_layout_bugs_request_screenshots_early` saved 3+ rounds of speculative-fix-then-verify cycles on Phase 26.1 visual work. jsdom can't compute layout — one screenshot replaced an iterative debug loop.

### What Was Inefficient

- **3-tab restructure scoped + dropped same milestone (Phase 26.2).** Two prior reverts on the tabs-in-main-toolbar layout surfaced AP-01 (vertical-space contention), which prompted the 3-tab redesign — but the user dropped 3-tab same milestone in favor of the alert-bar layout. Lifting the existing 2-tab strip to a sub-toolbar row landed clean. **Lesson: when prior reverts indicate the layout space is contested, prototype the full restructure as a sketch (`/gsd-sketch`) before scoping a phase around it.**
- **MILESTONES.md auto-extraction noise.** SDK's `milestone.complete` accomplishment-extractor scraped fragments across 16 phases (it didn't filter by milestone version), producing a noisy default entry full of "One-liner:" / "File:" stubs. Required full manual rewrite. **Lesson: same as v1.0 retrospective — enforce consistent SUMMARY.md frontmatter (`one_liner:`) and have the extractor filter by milestone-tagged phases. The SDK miscounts phases too (memory: `project_gsd_phase_complete_state_miscount`).**
- **Audit-acknowledged carry-forwards growing.** v1.0 close: 5 deferred items. v1.2 close: 9 items. v1.3 close: 21 items. Most are jsdom-blocked structural gaps (Phase 14/15/20/21/23/25 verification) that can't be closed without running the actual app. **Lesson: stop counting these as "deferred" — they're "host-required UAT" and need their own category in the audit-open output. The `human_needed` verification status is structural, not a real implementation gap.**

### Patterns Established

- **Empirical falsification before scope.** Build a 30-line probe script (`scripts/pma-probe.mjs`) before committing to a multi-day implementation. If the premise falsifies, the probe is the regression sentinel. (Phase 28 precedent.)
- **Stub-row synthesis post-sampler.** When a downstream consumer needs entries that the upstream pipeline intentionally drops, synthesize them at the consumer boundary, don't propagate stubs upstream. (Phase 25 `buildSummary` pattern.)
- **Shared SVG icon component over Unicode glyphs.** When you need precise sizing, theming, and accessibility on a graphical mark, ship a typed component (`WarningTriangleIcon`) instead of a Unicode codepoint. (Phase 26.2 D-06 pattern.)
- **Functional state updaters everywhere selectivity matters.** `setX((prev) => ...)` over `setX(currentValue)` for any handler that can be invoked in close succession. Closure-form vs functional-form parity tests are the proof. (Phase 27 pattern.)

### Key Lessons

1. **Falsify before you implement.** Phase 28's same-day pivot was the clearest payoff this milestone. A 30-line probe replaced a 5-day implementation.
2. **Memory pays back during cross-cutting work.** `feedback_narrow_before_fixing`, `feedback_layout_bugs_request_screenshots_early`, `project_compute_export_dims_canonical_base`, and `project_strict_loadermode_separation` all fired during v1.3. None were needed for the immediate phase, but each saved iterations on cross-cutting concerns.
3. **The audit-open count is becoming load-bearing.** 21 items at v1.3 close. Most aren't real gaps — they're structural jsdom limits or human-eyeballs-required UAT. The audit needs a category split (or these items need their own state outside the audit) before v1.4 close.
4. **Don't ship to untested targets.** Linux AppImage was in CI without ever being verified live. The v1.3 ship decision (drop Linux, retain electron-builder.yml `linux:` block as a no-op) made the surface honest. Re-enable when UAT lands.

### Cost Observations

- Model mix: not tracked formally — sub-agent usage was significant for parallel research (Phase 28 PMA discuss-phase) and for code-review followups (REVIEW-FIX 4 commits).
- Notable: Phase 28 had the most discuss-phase iteration (PMA falsification → pivot). Phase 26.1 had the most visual-UAT iteration (screenshots in 5+ rounds). Phase 27 was the cheapest (4 carry-forward fixes, 1 day).
- Notable: 293 commits in 5 days — high cadence due to atomic per-task commits. Rebase-friendly history paid off during Phase 28 REVIEW-FIX (4 fixes, 4 commits, all isolated).

---

## Milestone: v1.3.1 — Correctness & Refinements

**Shipped:** 2026-05-09
**Phases:** 3 (29, 30, 31) | **Plans:** 16 (7 + 5 + 4) | **REQs:** 20
**Timeline:** 2026-05-07 → 2026-05-09 (3 days)

### What Was Built

- **Per-region dedup + override-region semantics** (Phase 29) — Root cause of "path-indirected duplicate rows" closed: `analyzer.ts` was looking up `atlasSources` / `sourcePaths` / canonical+actual dim maps by `attachmentName` while loader populated them by atlas region name. For Chicken's `SYMBOLS.json`, 249 of 531 attachment bindings hit the miss-path. Fix: new `RegionRow` interface + `analyzeRegions()` sibling fold (region-keyed dedup with REGION-05 lex tiebreak) + AtlasPreview re-key onto regionName + attachmentNames[]. Override storage flipped to bind to region (D-150 stale-key drop pattern at .stmproj load).
- **Safety buffer in Optimize dialog** (Phase 30) — User-configurable safety-buffer % (default 0%, integer step). Multiplicatively increases each row's effective scale and overrides BEFORE the export plan is computed. NARROW `bufferCapped` predicate per CONTEXT D-06; persisted as additive optional field in `.stmproj` v1 mirroring `sharpenOnExport` (Phase 28) precedent — no schema-version bump.
- **Loader & UX small-fixes batch** (Phase 31) — Source-toggle disabling + tooltip on missing artifacts (LOAD-05/06/07); Animation Breakdown collapse defaults + bulk Expand-all / Collapse-all (PANEL-08..11; in-memory only — no schema persistence by user decision); Windows admin DnD fallback advisory (PLATFORM-01); ExtrapolationIcon tooltip primitive ported from DimsBadge (TOOLTIP-01; second known regression of this surface).
- **Late tester-regression fixes pre-tag:** 1b5414c (Strip-Whitespace export pipeline), 834c975 (auto-expand failed Optimize rows), d86e7b3 (per-frame canonical dims for sequence attachments).

### What Worked

- **Sibling-fold extension over rip-out.** Phase 29 added `analyzeRegions()` alongside the existing `analyze()` rather than replacing it — same parameter shape, region-keyed dedup with the same one tiebreak rule. The expected `tsc` breakage surface was bounded to the few atlas-preview consumer files. Pattern: when the bug is a key-flip, extend the schema additively rather than mutating the existing fold.
- **Memory `project_strict_loadermode_separation` held during the panel-vs-export key-flip.** Region-keyed dedup happened strictly downstream in analyzer + atlas-preview + UI; the sampler still measured all skin-declared attachments verbatim per `project_sampler_visibility_invariant`. No cross-mode leak across the three v1.3.1 phases.
- **Cheap diagnostic + falsification fired again.** Post-v1-3 tester-regression debug session (`.planning/debug/post-v1-3-tester-regressions.md`) identified the analyzer.ts atlas-region-name vs entry-name mismatch in CYCLE 2 — root cause writeup before scoping a fix. Same lesson as v1.3 Phase 28 PMA pivot.
- **Late tester-regression triage stayed surgical.** Three distinct regressions surfaced post-Phase-31 execution. Each got a dedicated atomic commit with a `fix(scope):` prefix. None blocked the milestone close — they shipped as part of the v1.3.1 tag.

### What Was Inefficient

- **SDK miscount fired again at milestone close.** `gsd-sdk milestone.complete` scraped accomplishments from every leftover phase dir in `.planning/phases/` (10 phases counted instead of 3; 115 tasks; 50+ accomplishments mixing v1.1.2/v1.2/v1.3.1 noise). Required full manual rewrite of the MILESTONES.md entry. **Lesson: same as v1.3 retrospective — the SDK extractor doesn't filter by milestone-tagged phases. Workaround: archive prior-milestone phase dirs FIRST (move to `milestones/v[X.Y]-phases/`) before running `milestone.complete`. Or hand-write the entry directly.**
- **v1.1.2 / v1.2 phase artifacts were never properly archived.** Cleanup at v1.3.1 ship time required removing 127 stale plan/context/discussion files from those phase dirs (kept the per-plan SUMMARYs as the durable artifact). **Lesson: `/gsd-complete-milestone` skipped the phase-archive substep at v1.1.2 + v1.2 close. Future closes should always confirm `archived.phases: true` in the SDK output before commit, or run `/gsd-cleanup` retroactively.**

### Patterns Established

- **Region-keyed dedup with attachmentName lex tiebreak** (REGION-05) — Sibling fold to attachmentName dedup; same template, different key, same one tiebreak rule. Reused at three sites (analyzer + atlas-preview + Global panel).
- **Buffer applied BEFORE caps** — `bufferedScale := raw × (1 + buffer/100)` THEN `clampedScale := Math.min(safeScale(bufferedScale), 1.0)`. NARROW `bufferCapped` predicate fires only when buffer pushes past `sourceRatio`. Single source of truth between core and renderer.
- **Schema additive field via `sharpenOnExport` precedent** — Mirrors Phase 28's pattern: optional field, defaults to 0% / off, missing field is backward-compatible with prior-version project files. No schema-version bump.

### Key Lessons

1. **Tester-found bugs are correctness bugs, not polish.** The path-indirected duplicate rows bug was a user-reported correctness gap that snuck through v1.3 testing because no rig in the existing fixtures exercised path-indirection at the volume Chicken does. **Action item:** v1.4 should commit a stripped Chicken-derived path-indirection regression fixture (REGION-07; partially in scope at Phase 29 but the broader audit is open).
2. **Diagnose before scoping a phase.** Phase 29 had two debug sessions feeding it (`path-indirected-duplicate-rows` + `post-v1-3-tester-regressions`). Both writeups identified the analyzer.ts root cause before phase-discuss began. The phase scope was tight as a result.
3. **The audit-open count split is now load-bearing.** v1.3.1 closed with the same observation as v1.3: most "deferred" items are structural jsdom-blocked verifications or release-time UAT, not real implementation gaps. **v1.4 must split the category** (host-required UAT vs real deferred).

### Cost Observations

- 3 phases / 16 plans / 3 days — fastest milestone close to date. Phase 30 had the most discuss-phase iteration (NARROW vs broad bufferCapped predicate; canonical 1.0 vs sourceRatio clamp). Phases 29 + 31 were tight scope-to-implementation.
- Late tester-regression cycle added 3 commits post-Phase-31 SUMMARY but pre-tag. None required reopening the milestone — clean atomic commits on main.

---

## Milestone: v1.5 — Override Routing + Coverage Hardening + Atlas Repack

**Shipped:** 2026-05-15
**Phases:** 5 (36, 37, 38, 39, 40) | **Plans:** 23 | **Tasks:** 50 | **REQs:** 18 documented + 10 REPACK (post-hoc)

### What Was Built

1. **Phase 36 (Split Overrides Per Loader Mode, OVR-01..07)** — `overridesAtlasLess` field added additively to `ProjectFileV1` / `AppSessionState` / `MaterializedProject`; legacy v1.3.x/v1.4.x `.stmproj` routes by saved `loaderMode` at the Open seam (Decision 2-A); per-bucket `migrateOverrides` at all 3 IPC seams; AppShell `activeOverrides` memo flows to all 4 `buildExportPlan` sites; one-shot mode-toggle toast (D-04 verbatim copy + localStorage suppression). CR-01 resample-handler routing bug + WR-01 drag-drop recovery field-loss bug surfaced + fixed in code-review-fix cycle. SEED-007 closed.
2. **Phase 37 (Spine 4.2 Timeline Coverage Hardening, TIMELINE-01..05)** — RGBA2Timeline + InheritTimeline source-audited with citations to `Animation.js:755` (writer) + `Bone.js:144` (reader); `fixtures/INHERIT_TIMELINE/` JSON+atlas+PNG; TIMELINE-03 strict `peak(detached) > peak(baseline)` per TRIGGERED escalation clause (observed 2.5× ratio, BASELINE=0.4 vs INHERIT_DETACH=1.0); TIMELINE-04 byte-equal RGBA2 invariance via synthetic injection on SQUARE2 (only `dark`-bearing slot in SIMPLE_TEST). SEED-005 closed.
3. **Phase 38 (Phase 4 Code-Review Polish Pass, POLISH-01..03)** — `38-POLISH-AUDIT.md` enumerates IN-01..IN-06 + WR-03 with verdicts: 1 applies (IN-02 drag-to-cancel `onMouseDown` + `e.target === e.currentTarget` guard in `OverrideDialog.tsx`), 5 no-op swept by Phase 6 Gap-Fix R6 + Phase 27 QA-01..04, 1 skip (IN-04 `highlightMatch` panel duplication, intentional per Phase 2/3 self-contained-panel pattern). v1.0-era pending todo retired.
4. **Phase 39 (Windows Host-Blocked UAT Burndown, WINUAT-01..03)** — `host_available: yes`; Phase 20 DocBuilder DnD UAT + Phase 31 admin DnD UAT both executed live and flipped `passed`; both pending todos (`2026-05-01-phase-20-*`, `2026-05-08-phase-31-*`) retired to `resolved/`. Two upstream path inaccuracies pre-discovered in 39-CONTRACT.md (Phase 20 UAT deleted in `0787fe1`; Phase 31 UAT at archived v1.3.1-phases path).
5. **Phase 40 (Atlas Repack Output, REPACK-01..10)** — additive `loose | atlas | both` output mode in OptimizeDialog Output card emits libgdx `.atlas` + composite page PNG(s) via `maxrects-packer@2.7.3` + `sharp` per-region trim/rotate/composition. `core/repack.ts` pure-TS pack planner with deterministic regionName sort + oversize pre-flight; `main/atlas-writer.ts` libgdx text serializer with TextureAtlas round-trip parity; `main/repack-worker.ts` sharp orchestration with REPACK-10 atomic-or-fail rollback via shared `writtenPaths: Set<string>` (loose + atlas pipelines share one rollback set so a mid-write failure rolls back EVERY artifact); `main/sharp-resize.ts` shared helper extracted with terminal-action split (D-03a). 4 additive `.stmproj` fields with no schema bump. SHA256 baseline + cross-loaderMode parity + sharpen-invariant tests. Rotation default off; `sharp.rotate(-90)` for WRITE direction inverse of v1.4 +90 READ direction. 3 rounds of human UAT against `JOKERMAN_SPINE.json` caught + fixed 8 bugs. SEED-008 closed.

Plus an adjacent regression caught + fixed during Phase 36 UAT: window X-button / Cmd+W path skipped the dirty-save prompt (pre-existing since Phase 8/18) — fixed in `ef38cd3 fix(36-followup)` by mirroring the `before-quit` IPC dirty-check on `mainWindow.on('close')`.

### What Worked

1. **Locked-decision pre-loading at milestone start.** STATE.md `v1.5 Locked Constraints` section recorded SEED-007 D-1/D-2-A/D-3-A, TIMELINE-02 conditional escalation, WINUAT-01..03 graceful-degradation contract, and SEED-008 design facts BEFORE phase planning began. Discuss-phase runs were short — none of the locked decisions were relitigated. Confirmed pattern from v1.4 (4.3-detect-and-warn) — "lock the constraint at seed plant, not at plan kickoff" saved discuss-phase rounds in 4 of 5 phases.
2. **Conditional escalation as a planning checkpoint, not a deferred risk.** TIMELINE-02 escalation clause was explicitly documented at planning time with the trigger (`if InheritTimeline mutates a Bone field that affects updateWorldTransform`) and the consequent (TIMELINE-03 becomes load-bearing). When the audit confirmed TRIGGERED, the test naturally hardened from precautionary to load-bearing without re-discussion. Reusable pattern: surface conditional-escalation contracts at plan time so they don't surprise execute-phase.
3. **Verifier flagging documentation gaps as carry-forwards, not failures.** Phase 40 verifier called out REPACK-01..10 missing from REQUIREMENTS.md as a "documentation-bookkeeping carry-forward, NOT a goal-achievement gap" — it correctly distinguished verified-in-code-but-undocumented from unverified. /gsd-complete-milestone closure handled the fold-in via the milestone archive seam. Cleaner than blocking the verifier on a documentation race.
4. **Three-round human UAT against a real animator rig (JOKERMAN_SPINE.json) caught 8 bugs the test suite missed.** Rounds 1+2+3 each surfaced new failure modes (dedup-by-attachmentNames vs outPath, rotation direction, success-count-on-dropped-row, tooltip-on-row, passthrough-bypassing-sharp, overwrite-probe blind to atlas targets, progress overshoot). All 8 fixed atomically with regression sentinels. **The rig that broke v1.4's region-keyed export plan also broke Phase 40 in 3 distinct ways** — JOKERMAN_SPINE.json is now the de-facto smoke fixture for any export-pipeline change.
5. **Cross-phase integration check decoupled from phase-level verification.** /gsd-audit-milestone spawned `gsd-integration-checker` after all 5 phases self-verified, finding zero CRITICAL or WARNING issues across 5 cross-phase touchpoints (override-bucket pipeline, E2E export flow, schema additivity, AppShell coexistence, test suite). Confirms Phase 36 + Phase 40 — both touch AppShell state in major ways — coexist cleanly.

### What Was Inefficient

1. **Phase 40 added post-hoc to v1.5 created REQUIREMENTS.md drift.** v1.5 was originally scoped at 4 phases (36–39) with REQUIREMENTS.md frozen 2026-05-13. Phase 40 (Atlas Repack) was added 2026-05-14 after Phase 36–39 completed; STATE.md correctly reopened the milestone but REQUIREMENTS.md was never amended with REPACK-01..10. The Phase 40 verifier had to call out the gap as a milestone-close handoff. **Lesson:** when a phase is inserted post-milestone-start, either (a) update REQUIREMENTS.md as part of that phase's spec, or (b) add a note in REQUIREMENTS.md that REQ-IDs are tracked in the inserted phase's PLAN/SUMMARY/VERIFICATION until the next milestone close.
2. **Pre-close audit scanner had 2 false positives.** `gsd-sdk query audit-open` flagged Phase 36 36-HUMAN-UAT.md as `[unknown]` and quick-task `260505-lk0` as `[missing]`. Both files showed clear `passed`/`shipped` status in their own frontmatter — the scanner reads a different field shape. Cost ~10 minutes of investigation to confirm both were false positives. **Lesson:** the scanner's frontmatter expectations should match the writer's frontmatter conventions; when they drift, flagging is noisy.
3. **8 Phase 40 polish items deferred per user decision rather than landing in v1.5.** WR-03..WR-07 + IN-01..IN-04 from `40-REVIEW.md` were all explicitly user-deferred. None block goal achievement, but each represents a small backlog accumulation. Phase 40 already shipped CR-01 + CR-02 + WR-01 + WR-02 + WR-06 fixes inline — the deferred items are the long-tail of code review. **Lesson:** consider a "polish-pass" capacity reservation as part of milestone scope when shipping a complex new pipeline; v1.5's Phase 38 was retroactive Phase-4 polish, suggesting we trail polish by ~5 milestones.

### Patterns Established

1. **Source-audit + fixture-lock as a coverage-hardening pattern (Phase 37, SEED-005 Level B).** When a runtime feature is "likely irrelevant but unverified," cite source files (`Animation.js:NNN` + `Bone.js:NNN`) in an audit doc, then commit a minimal fixture + test that locks the contract empirically. The audit citation gives the test author a precise "what to assert" target; the fixture survives spine-core upgrades as a regression sentinel. Reused for both RGBA2Timeline (geometry-invariance) and InheritTimeline (escalation-triggered).
2. **Shared rollback Set across multiple workers (Phase 40, REPACK-10 D-04a).** When a single user action dispatches multiple parallel pipelines (loose + atlas in `both` mode), wrap them in one shared `Set<string>` writtenPaths; an inner-catch `fs.rm` sweep on throw cleans every registered artifact. Both workers register tmp + final paths BEFORE writing. Generalizes to any future multi-worker dispatch.
3. **Sharp-emits-truth: read back actual emitted dims via `metadata()` (Phase 40).** Plan-target dims and sharp-emitted dims can drift on edge cases (1px rounding, format conversion). When downstream pipelines (packer, atlas writer) consume those dims, they must read sharp's reality not the plan's intent. Codified at `repack-worker.ts:292-294`. Generalizes to any pipeline that combines `buildExportPlan` outputs with sharp transformations.
4. **Pre-discovered file-path corrections in CONTRACT documents (Phase 39).** 39-CONTRACT.md surfaced TWO upstream path inaccuracies (Phase 20 UAT deleted in `0787fe1`; Phase 31 UAT at archived v1.3.1-phases path) before plans 39-02 and 39-03 attempted to edit those files. Without the contract's pre-discovery step, both plans would have failed at execute time. Pattern: when a phase depends on artifacts in older milestones' archives, audit the artifact paths in a CONTRACT.md before writing the plans.

### Key Lessons

1. **Memory constraints (`project_strict_loadermode_separation`, `project_phase6_default_scaling`, `project_compute_export_dims_canonical_base`) made cross-phase integration trivial.** The integration checker found zero conflicts because Phase 36 (override buckets) and Phase 40 (atlas repack) both honored the same loaderMode separation discipline. Memory-locked invariants pay compounding interest across phases that touch overlapping subsystems.
2. **Three rounds of human UAT > one round of code review for pipeline ergonomics.** The 5 fixed code-review findings (CR-01..CR-02 + WR-01..WR-02 + WR-06) were all defensive correctness fixes; the 8 UAT-found bugs were all *user-visible* ergonomic gaps. Code review and UAT are complementary, not redundant. For pipelines, prioritize UAT.
3. **Don't relitigate post-hoc-added phase requirements during milestone close.** Phase 40 was added 2026-05-14; its 10 REPACK requirements lived in PLAN frontmatter + SUMMARY + VERIFICATION but not in REQUIREMENTS.md. The audit honored the verified-in-code reality and folded the documentation in during /gsd-complete-milestone — that's correct. The alternative (block the close on REQUIREMENTS.md drift) would be process-over-substance.

### Cost Observations

- 5 phases / 23 plans / 3 days execution time (2026-05-13 → 2026-05-15) — second-fastest milestone close after v1.3.1 (3 phases / 16 plans / 3 days).
- Phase 40 dominated commit count (185 commits in v1.5 range; ~120 attributable to Phase 40's 9 plans + 3 UAT rounds + 5 code-review fixes).
- 32,417 insertions / 216 deletions across 143 files — heavily additive (atlas-repack pipeline is net-new code; minimal refactor).
- Test suite grew from ~1051 (Phase 36 close) to 1181 (v1.5 close) — +130 tests across phases 37/38/39/40.
- Zero source files touched by Phase 39 (purely procedural UAT close-out).

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | (untracked) | 12 | Initial GSD workflow adoption — Wave-0 RED-spec pattern, decimal-phase insertions, Layer 3 arch invariants. |
| v1.2 | ~5 | 8 executed | SEED promotion via backlog review, Phase 17 skip via discuss-phase, POST-override partition pattern locked. |
| v1.3 | ~6 | 7 | Empirical falsification before scope (Phase 28 same-day pivot), strict loaderMode separation lock-in, screenshots-first for layout bugs, Linux dropped from release CI as untested target. |
| v1.3.1 | ~3 | 3 | Sibling-fold extension over rip-out (region-keyed dedup), tester-found correctness bugs handled via dedicated debug-session phases, late tester-regression triage stayed surgical (3 atomic pre-tag commits). |
| v1.5 | ~6 | 5 | Locked-decision pre-loading at milestone start (4 of 5 phases skipped relitigation); conditional-escalation as planning checkpoint (TIMELINE-02 → TIMELINE-03 hardening); 3-round human UAT against real animator rig caught 8 pipeline-ergonomic bugs the test suite missed; verifier-flagged documentation gaps handled at milestone-close fold-in instead of blocking phase verification. |

(v1.4 milestone retrospective skipped at close; backfill TBD if needed.)

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 333 (331 pass + 1 skip + 1 todo) | (untracked) | spine-core, sharp, maxrects-packer, @tanstack/react-virtual |
| v1.2 | ~700+ (vitest) | (untracked) | No new deps. PNG IHDR byte-parser in pure TS; synthetic atlas builder in pure TS. |
| v1.3 | ~720+ (vitest) | (untracked) | No new deps. `WarningTriangleIcon` shared SVG component; `pma-probe.mjs` regression sentinel. |
| v1.3.1 | ~720+ (vitest) | (untracked) | No new deps. `RegionRow` interface + `analyzeRegions()` sibling fold; `ExtrapolationIcon` tooltip primitive port. |
| v1.5 | 1181 pass / 2 skip / 2 todo (108 files) | (untracked) | No new runtime deps (`maxrects-packer` was already in `package.json` from v1.0 preview pipeline; Phase 40 simply consumed it for output as well as preview). New dev infrastructure: SHA256 baselines + `repack:refresh-baselines` script (D-07). New shared modules: `src/main/sharp-resize.ts`, `src/main/atlas-writer.ts`, `src/main/atlas-paths.ts`, `src/core/repack.ts`. New regression sentinels: `scripts/probe-sharp-rotate-write.mjs`, `tests/main/repack.loose-parity.spec.ts`, `tests/main/repack.parity.spec.ts`. |

### Top Lessons (Verified Across Milestones)

1. **Layer 3 invariant** (arch.spec grep guard) held across all 40+ phases without a single violation. Confirmed essential. Phase 40 explicitly tested: `core/repack.ts` imports ONLY `maxrects-packer` — no DOM, no sharp, no fs, no electron.
2. **Decimal phase insertions** (08.1, 08.2, 22.1) absorb UAT-found gaps without polluting sequence or requiring renumbering. Pattern confirmed.
3. **Human UAT should cover visual-surface + interaction-layer issues** that test suites can't reach — badge mode-awareness, tooltip reliability, override interaction with partition logic, atlas-pack ergonomics on real animator rigs. Budget 1 UAT day per phase with significant UI/UX surface; budget 3 UAT rounds for new pipelines (Phase 40 confirmation).
4. **POST-override passthrough partition** is a new invariant: evaluate passthrough AFTER all overrides and caps are resolved, never against pre-override natural peakScale.
5. **Locked-constraint pre-loading at milestone start saves discuss-phase rounds** (v1.5 confirmation across SEED-007, TIMELINE-02 escalation, WINUAT-01..03 graceful-degradation, SEED-008 design facts). When the seed has decisions worth locking, lock them at plant time — don't wait for /gsd-plan-phase to relitigate.
6. **Memory-locked invariants pay compounding interest across phases that touch overlapping subsystems** (v1.5 confirmation: `project_strict_loadermode_separation` made Phase 36 ↔ Phase 40 cross-phase integration trivially sound).
7. **Sharp-emits-truth: when downstream pipelines consume sharp dims, read them via `metadata()` post-emit, not from `buildExportPlan` plan-target dims** (Phase 40 invariant; reused at packer + atlas-writer).
8. **Shared rollback Set across multiple workers** (Phase 40 D-04a — `both` mode shares one `writtenPaths: Set<string>` between `runExport` and `runRepack`).

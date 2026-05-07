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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | (untracked) | 12 | Initial GSD workflow adoption — Wave-0 RED-spec pattern, decimal-phase insertions, Layer 3 arch invariants. |
| v1.2 | ~5 | 8 executed | SEED promotion via backlog review, Phase 17 skip via discuss-phase, POST-override partition pattern locked. |
| v1.3 | ~6 | 7 | Empirical falsification before scope (Phase 28 same-day pivot), strict loaderMode separation lock-in, screenshots-first for layout bugs, Linux dropped from release CI as untested target. |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 333 (331 pass + 1 skip + 1 todo) | (untracked) | spine-core, sharp, maxrects-packer, @tanstack/react-virtual |
| v1.2 | ~700+ (vitest) | (untracked) | No new deps. PNG IHDR byte-parser in pure TS; synthetic atlas builder in pure TS. |
| v1.3 | ~720+ (vitest) | (untracked) | No new deps. `WarningTriangleIcon` shared SVG component; `pma-probe.mjs` regression sentinel. |

### Top Lessons (Verified Across Milestones)

1. **Layer 3 invariant** (arch.spec grep guard) held across all 22+ phases without a single violation. Confirmed essential.
2. **Decimal phase insertions** (08.1, 08.2, 22.1) absorb UAT-found gaps without polluting sequence or requiring renumbering. Pattern confirmed.
3. **Human UAT should cover visual-surface + interaction-layer issues** that test suites can't reach — badge mode-awareness, tooltip reliability, override interaction with partition logic. Budget 1 UAT day per phase with significant UI/UX surface.
4. **POST-override passthrough partition** is a new invariant: evaluate passthrough AFTER all overrides and caps are resolved, never against pre-override natural peakScale.

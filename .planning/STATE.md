---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: (in progress)
status: executing
last_updated: "2026-05-02T22:56:45.328Z"
last_activity: 2026-05-02 -- Phase 22 planning complete
progress:
  total_phases: 15
  completed_phases: 7
  total_plans: 48
  completed_plans: 43
  percent: 90
---

# State

## Current Position

Phase: 21
Plan: Not started
Status: Ready to execute
Last activity: 2026-05-02 -- Phase 22 planning complete

## Last Roadmap Update

2026-04-30 — `.planning/ROADMAP.md` refined to match the v1.2 REQUIREMENTS.md surface authored at commit f36f265. v1.0 / v1.1 / v1.1.1 / v1.1.2 historical sections preserved verbatim (append-only). v1.2 milestone bullet expanded from "Phases 16–18 promoted from backlog" → full 8-phase scope summary. v1.2 section header updated to "Phases 13.1, 16–22 (8 phases; promoted from backlog + tester feedback + dormant seeds 2026-04-30)". Phases 16 / 17 / 18 (already-existing rich Phase Details from /gsd-review-backlog commit cc0bc6a) gained `**Requirements:**` lines + `**Success Criteria**` blocks; existing Background / User decision / Scope / Severity / Cross-references sub-blocks preserved verbatim. Phases 13.1, 19, 20, 21, 22 authored from scratch (Phase 13.1 details lifted from 13-VERIFICATION.md gaps; Phase 19 from tester-feedback REQs; Phase 20 from D-148 + DOC-01..05; Phases 21 + 22 narrative lifted from `.planning/seeds/SEED-001-atlas-less-mode.md` + `.planning/seeds/SEED-002-dims-badge-override-cap.md`). Progress table extended with rows for 13.1, 19, 20, 21, 22 (16/17/18 rows preserved). Deferred section updated to strikethrough the 4 items now promoted (SEED-001, SEED-002, UI improvements, Documentation Builder, Phase 13.1 carry-forwards) + new "Out-of-scope for v1.2 specifically" section listing Apple Developer ID + Sentry as declined for v1.2 with v1.3 revisit posture. Backlog section unchanged (still empty post-/gsd-review-backlog 2026-04-29). Commit hash: [committed in next step].

## Current milestone

v1.2 — expansion. Closes three macOS regressions + one host-blocked carry-forward from v1.1.x; refines the UI based on tester feedback (Phase 19 UI-01..05); adds the Documentation Builder feature (Phase 20 fills the .stmproj v1 reserved `documentation: object` slot from D-148); lands the two long-dormant SEEDs (Phase 21 SEED-001 atlas-less mode → Phase 22 SEED-002 dims-badge override-cap).

Phases (continues numbering from v1.1.2; no `--reset-phase-numbers`):

- **13.1** — Live UAT carry-forwards (Linux runbook + libfuse2 PNG capture; macOS/Windows v1.1.0 → v1.1.1 lifecycle observation; host-availability gated; UAT-01..03)
- **16** — macOS auto-update → manual-download UX (closes D-15-LIVE-2; promoted from backlog 999.2 on 2026-04-29; UPDFIX-05) ✅ COMPLETE 2026-04-30
- **17** — Help → Check for Updates not gated on project state — SKIPPED 2026-04-30 (UPDFIX-06 closed-by-test 14-l in `tests/renderer/app-update-subscriptions.spec.tsx`; Phase 14 lift commit 802a76e already fixed the wiring; D-15-LIVE-3 was observed on the pre-lift v1.1.1 binary)
- **18** — Cmd+Q + AppleScript quit broken on macOS (promoted from backlog 999.1; QUIT-01, QUIT-02)
- **19** — UI improvements UI-01..05 (sticky header + cards + modal redesign + quantified callouts + button hierarchy; tester feedback)
- **20** — Documentation Builder feature (.stmproj v1 documentation slot; D-148; DOC-01..05)
- **21** — SEED-001 atlas-less mode (json + images, no .atlas; PNG header reader + synthetic atlas; LOAD-01..04)
- **22** — SEED-002 dims-badge + override-cap (depends on 21; round-trip safety; DIMS-01..05)

Recommended execution order: 18 → 19 → 20 → 21 → 22, with Phase 13.1 inserted opportunistically when a host becomes available. Final order is the user's call.

Out of scope for v1.2: Apple Developer ID signing + notarization (declined; manual-download UX is the v1.2 answer); Crash reporting / Sentry (revisit at v1.3); Spine 4.3+ versioned loader; `.skel` binary loader.

REQUIREMENTS.md and ROADMAP.md are authored; phase numbering continues; Phase 22 depends on Phase 21.

## Current phase

Phase 22 (SEED-002 dims-badge + override-cap) — context gathered 2026-05-02. 22-CONTEXT.md authored; 4 implementation decisions locked (D-01 JSON canonical dims unified across both modes; D-02 override % stays % of canonical; D-03 already-optimized rows become passthrough byte-copies with "COPY" indicator — new `passthroughCopies[]` array on ExportPlan; D-04 strict ceil-equality on both axes for passthrough qualification). Resolves Phase 21 open research item (Spine 4.2 JSON skin attachment width/height is the canonical source — NOT nonessential data). Ready for `/gsd-plan-phase 22`.

## Phase 17 skip rationale

`/gsd-discuss-phase 17` (2026-04-30) found that UPDFIX-06 — "Help → Check for Updates fires regardless of project state" — was already closed by Phase 14's renderer-lift work (commit `802a76e`, shipped in v1.1.2 / v1.1.3). The lift moved the `onMenuCheckForUpdates` subscription from `AppShell.tsx` (mounts only on `loaded` / `projectLoaded`) to `App.tsx`'s top-level `useEffect` (always mounted, runs on every AppState branch including idle). The Help menu item itself at `src/main/index.ts:290-293` has no `enabled:` field — it was never gated in main; the bug was on the renderer-subscription side. Existing regression test `tests/renderer/app-update-subscriptions.spec.tsx` test (14-l) "Help → Check for Updates from idle calls window.api.checkForUpdates()" already locks idle-state coverage. D-15-LIVE-3 was observed during Phase 15 Test 7-Retry round 4 on the v1.1.1 INSTALLED binary (pre-lift); v1.1.3+ already has the fix. Phase 17 was thus deemed redundant and skipped — no source change committed, no plans authored, phase number preserved as a SKIPPED entry for audit traceability (no renumbering of 18..22). UPDFIX-06 marked closed-by-test in REQUIREMENTS.md and ROADMAP.md.

## Current plan

Phase 21 is complete (12 of 12 plans shipped — 8 originals + 4 gap closures G-01 / G-02 / G-03 / G-04). Ready for full HUMAN-UAT (Test 4b Path 1+2 + Test 4c) followed by `/gsd-verify-work 21`. Plan 21-12 SUMMARY at `.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-12-toggle-resample-atlas-less-precedence-SUMMARY.md`.

## Phase 21 progress

- **21-01..21-08** ✅ COMPLETE (Wave 0..4) — see prior session history; PNG header parser + MissingImagesDirError plumbing + SIMPLE_PROJECT_NO_ATLAS golden fixture + synthetic-atlas + SilentSkipAttachmentLoader + type cascade (LoadResult/SkeletonSummary atlasPath nullable + SourceDims +'png-header' + LoaderOptions.loaderMode) + loader integration with 4-way branch order (D-05/D-06/D-07/D-08; criterion #5 preserved) + .stmproj v1 schema gains loaderMode + sampler-worker + project-io threading + AppShell loaderMode toggle + round-trip integration spec + HUMAN-UAT.
- **21-09 stub-region-for-missing-pngs** ✅ COMPLETE 2026-05-02 (G-01 fix) — synth.missingPngs threading + LoadResult.skippedAttachments?: optional field + 1x1 stub-region for missing PNGs + fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/ falsifying-repro fixture; D-10 narrowed to imagesDir-absent only.
- **21-10 missing-attachments-panel** ✅ COMPLETE 2026-05-02 (G-02 fix) — MissingAttachmentsPanel + skippedAttachments IPC cascade through SkeletonSummary → renderer; user-facing surface for skipped PNGs above the Global Max Render Source panel.
- **21-11 toolbar-layout-regression** ✅ COMPLETE 2026-05-02 (G-03 fix) — flex-shrink-0 hardening + min-h-screen anchor + scrollbar-gutter:stable on main; toolbar no longer shifts when filters/panels collapse (UAT-2 + UAT-3 root causes resolved).
- **21-12 toggle-resample-atlas-less-precedence** ✅ COMPLETE 2026-05-02 (G-04 fix) — caller-side LoaderOptions precedence fix at project-io.ts Sites 1+4 + sampler-worker.ts Site 5; Site 3 audit-only (already shape-correct). src/core/loader.ts UNTOUCHED — criterion #5 verbatim AtlasNotFoundError preserved. 4 G-04 regression tests added (2 loader-contract + 1 IPC integration + 1 worker-boundary); 2 falsifying gates proven via scratch revert. 630/630 vitest passing. Path-symmetric atlas-less behavior restored (cold-load + toggle-resample now produce same skippedAttachments shape). Commits: 179b1dd → de99e84 → 0a31aee → fee0070 → 9b70056. SUMMARY at `.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-12-toggle-resample-atlas-less-precedence-SUMMARY.md`.

## Phase 20 progress

- **20-01 core-types-validator-summary** ✅ COMPLETE 2026-05-01 — Documentation interface + DEFAULT_DOCUMENTATION + validateDocumentation + intersectDocumentationWithSummary; validator pre-massage + materializer back-fill (Phase 8-era forward-compat); serializeProjectFile writes state.documentation; SkeletonSummary.events from skeletonData.events; AppSessionState.documentation field; renderer-legal Layer 3 re-export route through shared/types.ts (tsconfig.web.json carve-out for src/core/documentation.ts). 21 new tests in tests/core/documentation.spec.ts + 5 new tests in tests/core/project-file.spec.ts; 562 vitest passing. DOC-03 + DOC-05 marked complete.
- **20-02 modal-shell-sections-pane** ✅ COMPLETE 2026-05-01 — DocumentationBuilderDialog 10th hand-rolled modal with the 5-modal ARIA scaffold (D-15 width swap min-w-[960px] max-w-[1100px] max-h-[85vh]); three-pane tab strip with verbatim TabButton class string; Sections pane FULL implementation per DOC-03 (events auto-list per D-09, control bones with debounced 100ms filter and opt-in persistence per D-10, skins per D-11, general notes textarea per D-12, safety buffer number input per D-22). AppShell wiring threads documentation end-to-end: lazy-init drift intersection on mount, mountOpenResponse drift on Open + locate-skeleton, resample-success drift; Documentation top-bar button enabled with onClick (placeholder attributes removed); modalOpen audit list updated. MaterializedProject.documentation threaded through main/project-io.ts at all 3 construction sites. 562 vitest passing; DOC-01 marked complete. Commits: 6302563 → a73b3db.
- **20-03 animation-tracks-pane-dnd** ✅ COMPLETE 2026-05-01 — TracksPanePlaceholder replaced with full TracksPane + TrackContainer. First DnD surface in repo: HTML5 native DnD with namespaced MIME `'application/x-stm-anim'` (avoids OS file-drop pathway collision per D-06), `effectAllowed='copy'` on dragstart (Electron Chromium quirk), `preventDefault` mandatory on dragover, defensive name validation against `summary.animations.names` on drop (T-20-13 mitigation). Per-entry edit row: mix time + Loop checkbox + Notes input + ↑/↓ reorder + ✕ remove. Track-remove with entries triggers `window.confirm` with plural-aware copy. Empty-state surfaces (No tracks yet / Drop an animation here) verbatim from UI-SPEC. Add Track disabled when `summary.animations.count === 0`. 11 new RTL+jsdom integration tests in tests/renderer/documentation-builder-dialog.spec.tsx (modal smoke + tab switch + footer actions + DnD via fireEvent.dragStart/dragOver/drop + spoofed-name rejection + remove confirm + ↑/↓ reorder). 573 vitest passing; DOC-02 marked complete. Commits: 3dda71c (test RED) → 95f7975 (feat GREEN).
- **20-04 html-export-ipc-roundtrip** ✅ COMPLETE 2026-05-01 — `src/main/doc-export.ts` (NEW): pure-TS `renderDocumentationHtml` (HTML escape on every user-supplied string per T-20-19; inline `<style>` block + inline SVG glyphs + system font stack — zero external assets per T-20-20; locked palette + layout from D-17/D-18 — hero / 5-chip strip / Optimization Config + General Notes / Animation Tracks table / Control Bones + Skins / conditional Events card) + `handleExportDocumentationHtml` (dialog.showSaveDialog → atomic write Pattern-B writeFile .tmp + rename, mirroring src/main/project-io.ts). 3-tier IPC channel `'documentation:exportHtml'` registered through src/main/ipc.ts → src/preload/index.ts → src/shared/types.ts (Api method + type-only payload/response re-export). Renderer ExportPane (replaces ExportPanePlaceholder) builds the structured-clone-safe payload at click time + renders success/error inline per UI-SPEC copy contract. AppShell threads atlasPreviewState (buildAtlasPreview memo) + savingsPctMemo (byte-identical to OptimizeDialog.tsx:280-291) into the modal. tests/main/doc-export.spec.ts: 11 tests + frozen golden-file snapshot proving valid HTML, self-containment, XSS escape, conditional Events card, hero / chip / tracks / config layout. tests/core/documentation-roundtrip.spec.ts: 3 tests for DOC-05 — DEFAULT + non-empty + Phase 8-era empty {}. 587 vitest passing (was 573; +14). DOC-04 marked complete (DOC-05 already complete from Plan 20-01). Commits: ecab501 (test RED) → 65b0f1c (feat GREEN) → 4dc8985 (feat wiring).

## Last completed

**Milestone v1.1.2 — Auto-update fixes — SHIPPED 2026-04-29.** Phase 14 closed 5/5 plans (renderer + state machine fixes; UPDFIX-02 / UPDFIX-03 / UPDFIX-04). Phase 15 closed 6/6 plans (build/feed-shape fix + v1.1.2 release + v1.1.3 same-day hotfix; UPDFIX-01 / D-15-LIVE-1 empirically closed via Test 7-Retry PARTIAL-PASS — v1.1.1 → v1.1.3 .zip download succeeded byte-exact 121,848,102 bytes at canonical dotted URL). 520 vitest passing. Three downstream defects (D-15-LIVE-2 ad-hoc code-sig swap; D-15-LIVE-3 menu gating; 999.1 macOS quit) routed to backlog and now promoted to v1.2 phases 16 / 17 / 18 via /gsd-review-backlog (commit cc0bc6a, 2026-04-29).

## Accumulated Context (carries across milestones)

(Preserved from prior milestones — sampler lifecycle, override semantics, export uniform-only, .stmproj schema, Layer 3 invariant, 5-modal ARIA pattern, distribution + CI surface, all locked. See PROJECT.md `## Key Decisions (v1.0 outcomes)` and `## Constraints (still valid)` for the full list.)

---

*This file is authored fresh at milestone start. Phase 14 + Phase 15 detailed execution history is preserved in their respective phase directories under `.planning/phases/14-…/` and `.planning/phases/15-…/` (VERIFICATION.md, HUMAN-UAT.md, SUMMARY files). v1.1.2 phases will be archived to `.planning/milestones/v1.1.2-phases/` when /gsd-complete-milestone v1.1.2 is run.*

**Last Phase Action:** 17 (help-check-for-updates-not-gated-on-project) — SKIPPED — 2026-04-30T12:30:00Z

**Planned Phase:** 21 (seed-001-atlas-less-mode-json-images-folder-no-atlas) — 12 plans (8 originals + 4 gap closures) — 2026-05-02T16:53:49.465Z

**Last Phase Discussion:** 22 (seed-002-dims-badge-override-cap-depends-on-phase-21) — CONTEXT GATHERED — 2026-05-02T22:00:00Z (commit 435c462; 4 areas discussed → D-01 JSON canonical unified across modes; D-02 override % stays % of canonical; D-03 passthrough byte-copies with "COPY" indicator on muted rows; D-04 strict ceil-equality on both axes; resolves Phase 21 open research item; Phase 22 ready for /gsd-plan-phase 22).

**Last Plan Action:** 21-12 (toggle-resample-atlas-less-precedence) — COMPLETE — 2026-05-02T20:55:00Z (commits 179b1dd test + de99e84 fix + 0a31aee test + fee0070 fix-recovery + 9b70056 test; SUMMARY at .planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-12-toggle-resample-atlas-less-precedence-SUMMARY.md). G-04 closed via caller-side LoaderOptions precedence fix at IPC + worker boundaries (project-io.ts Sites 1+4 + sampler-worker.ts Site 5; src/core/loader.ts UNTOUCHED — criterion #5 verbatim AtlasNotFoundError preserved). 630/630 vitest passing. 4 G-04 regression tests added (2 loader-contract + 1 IPC integration + 1 worker-boundary); 2 falsifying gates proven via scratch revert. HUMAN-UAT Test 4b Path 2 + 4c re-runnable post-fix.

**Last Phase Verification:** 20 (Documentation Builder feature) — VERIFIED human_needed → 3/4 PASSED on macOS, 1 deferred — 2026-05-01T22:00:00Z. gsd-verifier scored 5/5 must-haves verified; gsd-code-reviewer found 0 critical / 4 warning / 6 info (non-blocking). HUMAN-UAT outcome on macOS arm64 (Electron dev build): test 1 (live DnD) PASS, test 2 (offline HTML fidelity) PASS with 1 visual gap regression FIXED in commit 10d40e6 (renderTracksCard wrapped in .row div for bottom-margin contract; golden snapshot regenerated; 587/587 vitest passing), test 4 (full save→close→reopen) PASS, test 3 (cross-platform DnD on Win/Linux) DEFERRED — Windows hardware unavailable; NSIS installer ready at release/Spine Texture Manager-1.1.3-x64.exe; pending todo at .planning/todos/pending/2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md captures the test recipe + risk analysis (effectAllowed='copy' is structurally set per RESEARCH §Pattern 4, so failure mode is unlikely). REQUIREMENTS.md DOC-04 stale "Pending" table row corrected to "Complete" (line 125; line 52 canonical bullet was already [x]).

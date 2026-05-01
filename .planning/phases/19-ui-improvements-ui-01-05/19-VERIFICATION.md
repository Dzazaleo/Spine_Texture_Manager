---
phase: 19-ui-improvements-ui-01-05
verified: 2026-05-01T17:55:00Z
status: passed
score: 5/5 must-haves verified
gaps_open: 0
overrides_applied: 1
overrides:
  - must_have: "UI-04: Unused-assets callout quantifies potential savings (X.XX MB potential savings) computed from on-disk PNG file sizes"
    reason: "Plumbing shipped per spec (formatBytes + bytesOnDisk + (?? 0) reader + conditional render block); MB callout is DORMANT pending Phase 21 atlas-less loader because every bundled fixture is atlas-packed → sourcePaths resolves to atlas pages, not per-region PNGs → bytesOnDisk = 0 for all rows → renderer falls through to count-only copy. Design pivot also captured: animator-excluded attachments are not 'savings' — true post-optimization atlas pixel-area savings belongs in OptimizeDialog (backlog 999.4 from Phase 21+). Per orchestrator's verification instructions: 'Do NOT spuriously fail UI-04 — verify the plumbing is correct, not that the callout fires visually.' Plumbing verified end-to-end."
    accepted_by: "user (in 19-04-SUMMARY.md Dev-Mode Smoke Approval)"
    accepted_at: "2026-05-01"
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "Sticky-bar element heights are not uniform (load-summary chip / SearchBar / button cluster render at slightly different heights)"
    addressed_in: "Future polish plan post-Wave 5 (captured in 19-03-SUMMARY.md Dev-Mode Smoke Approval)"
    evidence: "19-03-SUMMARY.md: 'Sticky-bar element heights are not uniform — Untitled chip / load-summary card / SearchBar / button cluster render at slightly different heights. UI-SPEC §1 did not lock a height token. Defer height harmonization to a polish plan after Wave 5.'"
  - truth: "Global panel layout shifts horizontally when typing into internal SearchBar (resolved by Plan 19-04 internal-SearchBar removal)"
    addressed_in: "Plan 19-04 (already landed) + future polish plan for residual N selected/N total cell width stability"
    evidence: "19-03-SUMMARY.md: 'Global panel layout shifts horizontally when typing into the panel-internal SearchBar — likely caused by N selected / N total cell width change without a stabilizing min-w-[Xch] or fixed grid. Defer to the same polish plan.' The panel-internal SearchBar was REMOVED in Plan 19-04, eliminating the typing-driven layout shift; remaining cell-width stability is the residual polish item."
  - truth: "MB-savings callout fires visually with non-zero aggregate"
    addressed_in: "Phase 21 (SEED-001 atlas-less mode → per-region PNG paths populate bytesOnDisk with real values); design pivot follow-up (backlog 999.4) for atlas pixel-area savings in OptimizeDialog"
    evidence: "19-04-SUMMARY.md Dev-Mode Smoke Approval section: 'MB-savings callout (UI-04) — DORMANT pending design pivot...the (u.bytesOnDisk ?? 0) reader is correct plumbing and will start producing valid totals automatically when Phase 21's per-region loader lands.'"
---

# Phase 19: UI improvements (UI-01..05) Verification Report

**Phase Goal:** Refine the UI based on tester feedback — sticky header, card-based section layout with semantic state colors, modal redesign with summary tiles + cross-nav, quantified MB-savings callout (plumbing, dormant pending Phase 21), and primary/secondary button hierarchy elevating Optimize Assets as the CTA.
**Verified:** 2026-05-01T17:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                  | Status        | Evidence                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | UI-01: Sticky header pins branded title + load-summary card + tab strip + search + button cluster while body scrolls                                   | ✓ VERIFIED    | `<header className="sticky top-0 z-20 …">` at AppShell.tsx:1098; Load-summary card with verbatim UI-01 wording (`1 skeletons / 1 atlases / N regions`) at AppShell.tsx:1145-1154; flex-sibling containment of `<header>` + `<main className="flex-1 overflow-auto">`; user dev-mode smoke confirmed pin behavior (19-03-SUMMARY Steps 1-9 PASS).        |
| 2   | UI-02: Card-based panels with row state coloring (green / yellow / red) + section icons (ruler / play-film / warning triangle)                          | ✓ VERIFIED    | Card wrapper `<section className="border border-border rounded-md bg-panel p-4 mb-4">` at GlobalMaxRenderPanel.tsx:780; ruler SVG at GlobalMaxRenderPanel.tsx:783; warning triangle SVG `M10 3 L18 16 L2 16 Z` at GlobalMaxRenderPanel.tsx:804; play/film glyph `M9 7 l4 3 -4 3 z` at AnimationBreakdownPanel.tsx:472; row coloring `bg-success/bg-warning/bg-danger/bg-transparent` at GlobalMaxRenderPanel.tsx:399 + AnimationBreakdownPanel.tsx:634; matching `<th aria-label="Row state indicator" />` in both thead instances. New tokens `--color-success: #5FA866` (6.06:1) + `--color-warning: #C9913C` (6.33:1) at index.css:72/78 inside the `@theme inline` block. |
| 3   | UI-03: Cross-modal round-trip Optimize ⇄ Atlas Preview with summary tiles in both modals                                                                | ✓ VERIFIED    | OptimizeDialog: 3 tiles (Used Files / to Resize / Saving est. pixels) at OptimizeDialog.tsx:322; cross-nav `→ Atlas Preview` button at line 376; footer flipped to `justify-between` at line 358; REQUIRED `onOpenAtlasPreview: () => void` at line 92. AtlasPreviewModal: 3 tiles (Pages / Regions / Utilization) at AtlasPreviewModal.tsx:239; cross-nav `→ Optimize Assets` button at line 303; footer flipped to `flex justify-between items-center mt-4` at line 293; REQUIRED `onOpenOptimizeDialog: () => void` at line 85. AppShell wires both: `onOpenAtlasPreview={() => setAtlasPreviewOpen(true)}` at AppShell.tsx:1364 + `onOpenOptimizeDialog={onClickOptimize}` at AppShell.tsx:1394. Cross-modal round-trip confirmed in 19-06 + 19-07 dev-mode smoke approval. |
| 4   | UI-04: Unused-assets callout quantifies potential savings (X.XX MB) computed from on-disk PNG file sizes                                                | ✓ PASSED (override) | Override accepted per orchestrator's verification instructions and 19-04-SUMMARY Dev-Mode Smoke Approval section. Plumbing verified end-to-end: `bytesOnDisk?: number` on UnusedAttachment at types.ts:187; main-side writer with `fs.statSync(path).size` at summary.ts:102 + silent-catch + `{ ...u, bytesOnDisk }` spread at summary.ts:110; renderer reads with `(u.bytesOnDisk ?? 0)` reduce-fallback at GlobalMaxRenderPanel.tsx:629; conditional render `aggregateBytes > 0 ? formatBytes(aggregateBytes) potential savings : count-only` at GlobalMaxRenderPanel.tsx:805-815; `formatBytes` helper with verbatim UI-04 `X.XX MB` shape at lib/format-bytes.ts. Visual firing is DORMANT pending Phase 21 atlas-less loader (every bundled fixture is atlas-packed → bytesOnDisk = 0). Design pivot to atlas pixel-area savings in OptimizeDialog tracked as backlog 999.4. |
| 5   | UI-05: Single filled-primary CTA (Optimize Assets) + outlined-secondary supporting actions (Atlas Preview / Documentation / Save / Open)                | ✓ VERIFIED    | Filled-primary class `bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed` appears exactly 1× in AppShell.tsx (Optimize Assets at line 1202); outlined-secondary class appears 4× (Atlas Preview at line 1185, Documentation at line 1194, Save at line 1213, plus 1 more usage). Right cluster order matches D-19: SearchBar → Atlas Preview → Documentation (disabled placeholder, `aria-disabled="true"` + `title="Available in v1.2 Phase 20"`) → Optimize Assets → Save → Open. User dev-mode smoke confirmed visual hierarchy (19-03-SUMMARY Steps 1-9 PASS). |

**Score:** 5/5 truths verified (1 via override per orchestrator's verification instructions).

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases or scheduled polish work.

| #   | Item                                                                                                              | Addressed In                                       | Evidence                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sticky-bar element height harmonization                                                                            | Future polish plan post-Wave 5                     | 19-03-SUMMARY Dev-Mode Smoke Approval: heights are not uniform; UI-SPEC §1 did not lock a height token; deferred to polish plan.                                                                                                                                     |
| 2   | Global panel layout-shift on N selected/N total cell width stability                                               | Plan 19-04 (panel-internal SearchBar removal — landed) + residual polish plan | 19-03-SUMMARY note: typing-driven layout shift was caused by panel-internal SearchBar (now removed by 19-04); residual cell-width stability is a polish item.                                                                                                       |
| 3   | MB-savings callout fires visually with non-zero aggregate                                                          | Phase 21 (SEED-001) + backlog 999.4                | 19-04-SUMMARY: plumbing correct, will produce valid totals when Phase 21's per-region loader lands; design pivot to atlas pixel-area savings in OptimizeDialog tracked as backlog 999.4.                                                                              |

### Required Artifacts

| Artifact                                              | Expected                                                                                              | Status     | Details                                                                                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/src/index.css`                          | `--color-success: #5FA866` + `--color-warning: #C9913C` literal-hex tokens in `@theme inline` block   | ✓ VERIFIED | Both tokens present at lines 72 and 78; `@theme inline {` block intact at line 47; `--color-danger: #e06b55` precedent preserved.                              |
| `src/renderer/src/lib/format-bytes.ts`                | NEW pure helper, zero imports, named export `formatBytes(bytes: number): string`, B/KB/MB/GB ladder    | ✓ VERIFIED | File exists; zero imports (verified by grep); named export with locked threshold ladder + `MB.toFixed(2)` / `GB.toFixed(2)` trailing-zeros policy.            |
| `src/shared/types.ts`                                 | `bytesOnDisk?: number` OPTIONAL field on `UnusedAttachment` interface                                  | ✓ VERIFIED | Field at line 187 with `?` modifier (verified — required form `bytesOnDisk: number` does not appear); structuredClone-safe primitive; D-21 docblock preserved. |
| `src/main/summary.ts`                                 | `fs.statSync` writer populating bytesOnDisk per unused row with silent-catch fallback                  | ✓ VERIFIED | `import * as fs from 'node:fs';` at line 25; `fs.statSync(path).size` at line 102; `{ ...u, bytesOnDisk }` spread at line 110; `load.sourcePaths.get(u.attachmentName)` at line 98. |
| `src/renderer/src/components/AppShell.tsx`            | Sticky `<header>` + load-summary card + filled-primary CTA + lifted query state + cross-nav wiring     | ✓ VERIFIED | All checks pass: sticky-position, load-summary card with verbatim UI-01 wording, Documentation placeholder, filled-primary class string verbatim from D-17, lifted `[query, setQuery]` slot at line 166, both cross-nav handlers wired at lines 1364 + 1394. |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx`    | Card wrapper + ruler glyph + warning triangle + row coloring + MB callout + REQUIRED query props      | ✓ VERIFIED | Card wrapper at line 780; ruler glyph at lines 784-786; warning triangle SVG at line 804; row state branches at line 399; `formatBytes(aggregateBytes)` at line 810; `(u.bytesOnDisk ?? 0)` at line 629; `query: string` REQUIRED at line 307; `<SearchBar` not present (removed). |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` | Play/film glyph + row coloring + REQUIRED query props                                                  | ✓ VERIFIED | Play/film SVG at lines 471-472; row state branches at line 634; matching `<th aria-label="Row state indicator" />` at line 535; `query: string` REQUIRED at line 415; `<SearchBar` not present (removed). |
| `src/renderer/src/modals/OptimizeDialog.tsx`          | 3 tiles + cross-nav button + REQUIRED `onOpenAtlasPreview`                                             | ✓ VERIFIED | 3 tiles in `flex gap-3 mb-4` row at line 322 (Used Files / to Resize / Saving est. pixels); cross-nav `→ </span>Atlas Preview` at line 376; footer flipped to `justify-between` at line 358; REQUIRED `onOpenAtlasPreview: () => void` at line 92 (no `?` form present). |
| `src/renderer/src/modals/AtlasPreviewModal.tsx`       | 3 tiles + cross-nav button + REQUIRED `onOpenOptimizeDialog`                                           | ✓ VERIFIED | 3 tiles in `flex gap-3 mb-4` row at line 239 (Pages / Regions / Utilization); cross-nav `→ </span>Optimize Assets` at line 303; footer flipped to `flex justify-between items-center mt-4` at line 293; REQUIRED `onOpenOptimizeDialog: () => void` at line 85 (no `?` form present). |

### Key Link Verification

| From                              | To                            | Via                                                                       | Status   | Details                                                                                                                                                                              |
| --------------------------------- | ----------------------------- | ------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/renderer/src/index.css`      | Tailwind v4 utility generator | `@theme inline` block — `inline` keyword load-bearing                      | ✓ WIRED  | Block intact at line 47; `inline` keyword preserved; both new tokens emit `bg-success`, `text-success`, `bg-success/10` etc. utilities at generation time.                            |
| `format-bytes.ts`                 | renderer (no core imports)    | zero-import pure helper                                                    | ✓ WIRED  | Zero `^import ` lines confirmed; consumed via `import { formatBytes } from '../lib/format-bytes';` at GlobalMaxRenderPanel.tsx:66; Layer 3 invariant preserved (tests/arch.spec.ts 12/12). |
| `src/shared/types.ts`             | main/summary.ts + renderer     | structuredClone IPC — optional primitive number; renderer uses `?? 0`     | ✓ WIRED  | summary.ts populates via `fs.statSync(path).size`; renderer reads via `(u.bytesOnDisk ?? 0)` reduce; `?` modifier means absent ≡ 0 so atlas-packed (D-15) projects fall through cleanly. |
| AppShell sticky `<header>`        | scroll containment            | flex-sibling of `<main className="flex-1 overflow-auto">`                  | ✓ WIRED  | `<header>` at AppShell.tsx:1098; `<main>` at AppShell.tsx:1287; D-20 containment correct (header is flex sibling, NOT nested inside scroll container).                                  |
| AppShell SearchBar                | both panels                    | lifted `query` state via `query={query}` + `onQueryChange={setQuery}`     | ✓ WIRED  | Lifted state at AppShell.tsx:166; threaded as `query=`/`onQueryChange=` props (count: 2 each); panels consume `props.query` via REQUIRED prop signatures.                              |
| OptimizeDialog cross-nav button   | AppShell modal-lifecycle      | `props.onClose() → props.onOpenAtlasPreview()` (sequential mount)          | ✓ WIRED  | onClick at OptimizeDialog.tsx:362-365; AppShell binding `onOpenAtlasPreview={() => setAtlasPreviewOpen(true)}` at AppShell.tsx:1364; D-11 sequential mount honored.                    |
| AtlasPreviewModal cross-nav button | AppShell modal-lifecycle     | `props.onClose() → props.onOpenOptimizeDialog()` (sequential mount)        | ✓ WIRED  | onClick at AtlasPreviewModal.tsx; AppShell binding `onOpenOptimizeDialog={onClickOptimize}` at AppShell.tsx:1394 (function-reference passing); D-11 sequential mount honored.           |

### Data-Flow Trace (Level 4)

| Artifact                                              | Data Variable                  | Source                                                                                                  | Produces Real Data           | Status                            |
| ----------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------- |
| AppShell load-summary card                            | `effectiveSummary.attachments.count` | Phase 5 IPC summary derivation (override-aware effective summary)                                       | Yes                          | ✓ FLOWING (renders actual region count) |
| GlobalMaxRenderPanel rows                             | `unusedAttachments` + `aggregateBytes` | `summary.unusedAttachments` from main-side `summary.ts` → reducer with `(u.bytesOnDisk ?? 0)` fallback   | Plumbing flowing; values dormant | ⚠️ HOLLOW (PASSED via override) — `bytesOnDisk = 0` for every row in atlas-packed fixtures (current loader); plumbing flows correctly and will produce real values when Phase 21 atlas-less loader lands. |
| OptimizeDialog tiles                                  | `props.plan.rows` (totalUsedFiles / toResize / savingsPct) | `props.plan: ExportPlan` built by AppShell `onClickOptimize` → core `buildExportPlan`               | Yes                          | ✓ FLOWING (re-derives per Optimize click)  |
| AtlasPreviewModal tiles                               | `projection.totalPages` + reduces over `projection.pages` | existing `projection` useMemo (Phase 7); re-derives on `mode: 'original' | 'optimized'` toggle      | Yes                          | ✓ FLOWING (re-derives on mode toggle per 19-07-SUMMARY) |
| Sticky header SearchBar                               | `query` (lifted state)         | `useState('')` at AppShell.tsx:166 → threaded down to both panels                                       | Yes                          | ✓ FLOWING (drives both panel filters; persists across tab switches per 19-05-SUMMARY) |

### Behavioral Spot-Checks

| Behavior                                                                                          | Command                                              | Result                                                              | Status |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| TypeScript compiles clean                                                                         | `npx tsc --noEmit`                                   | exit 0, no output                                                   | ✓ PASS |
| Layer 3 invariant — renderer never imports `src/core/*`                                           | `npm test -- tests/arch.spec.ts`                     | 12 passed                                                           | ✓ PASS |
| Full vitest suite                                                                                 | `npx vitest run`                                     | 48 files / 536 passed / 1 skipped / 2 todo / 0 failed (3.16s)        | ✓ PASS |
| `formatBytes` is a pure helper (zero imports)                                                     | `grep -cE '^import ' src/renderer/src/lib/format-bytes.ts` | 0 import lines                                                  | ✓ PASS |
| `bytesOnDisk` is OPTIONAL on `UnusedAttachment` (not REQUIRED)                                    | `grep -F 'bytesOnDisk?: number' src/shared/types.ts` then `grep -E 'bytesOnDisk: number;'` | optional present (line 187), required form absent | ✓ PASS |
| Single filled-primary CTA in AppShell sticky header                                               | `grep -cE 'bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold' src/renderer/src/components/AppShell.tsx` | 1 occurrence (Optimize Assets only) | ✓ PASS |
| All renderer files free of core imports                                                           | `grep -rE "from ['\"].*src/core" src/renderer/src/{components,panels,modals,lib}/...` | no matches in any phase-19 modified file       | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s)                                       | Description                                                                                                  | Status        | Evidence                                                                                                                                  |
| ----------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| UI-01       | 19-03                                                | Persistent sticky header with branded title + load-summary + buttons + search                                  | ✓ SATISFIED   | Sticky `<header>` at AppShell.tsx:1098; load-summary card with verbatim wording at lines 1145-1154; SearchBar lifted to header.            |
| UI-02       | 19-01 (tokens), 19-04 (Global), 19-05 (Animation)    | Card-based layout with state colors + section icons                                                            | ✓ SATISFIED   | Cards + ruler/play-film/warning glyphs + bg-success/warning/danger row coloring across both panels.                                        |
| UI-03       | 19-03 (cross-nav wiring), 19-06 (Optimize), 19-07 (AtlasPreview) | Modal redesign — summary tiles + cross-nav round-trip                                                           | ✓ SATISFIED   | Both modals: 3 tiles + cross-nav button at footer LEFT + REQUIRED prop tightening; round-trip approved in 19-06 + 19-07 dev-mode smoke.     |
| UI-04       | 19-01 (helper + field), 19-02 (writer), 19-04 (callout) | MB-savings quantification                                                                                       | ✓ PASSED (override) | Plumbing verified end-to-end (formatBytes + bytesOnDisk + reducer + conditional render); visual firing dormant pending Phase 21 atlas-less loader + design pivot to atlas pixel-area savings (backlog 999.4). |
| UI-05       | 19-03                                                | Inline search in header + primary/secondary button hierarchy                                                   | ✓ SATISFIED   | SearchBar in sticky cluster; 1 filled-primary (Optimize Assets) + 4 outlined-secondary buttons + Documentation placeholder.                |

All 5 phase-mapped requirements satisfied (UI-04 via override per orchestrator's verification instructions). No orphaned requirements.

### Anti-Patterns Found

| File                                              | Line | Pattern         | Severity   | Impact                                                                                                                                                                                                                                                                              |
| ------------------------------------------------- | ---- | --------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 629  | `?? 0` on bytesOnDisk reducer + count-only fallback when aggregateBytes === 0 | ℹ️ Info     | Documented per D-15 atlas-packed fallthrough; NOT a stub — this is the deliberate honest UX for projects where unused regions are inside a shared atlas page. Plumbing correct; produces real values when Phase 21 lands.                                                          |

No blocker-severity anti-patterns. The hardcoded literals `1 skeletons` / `1 atlases` in the load-summary card are intentional (UI-01 verbatim wording lock per CONTEXT.md D-01 + orchestrator's revision-pass; STM is single-skeleton-per-project).

### Human Verification Required

None outstanding. All visual / interaction claims were verified via dev-mode smoke during plan execution:

- **19-03 Dev-Mode Smoke Approval (2026-05-01):** Steps 1-9 PASS for sticky header behavior + Documentation placeholder + filled-primary CTA + button cluster ordering. Step 10 was an interim-state regression that resolved when Plans 19-04 + 19-05 removed the panel-internal SearchBars.
- **19-04 Dev-Mode Smoke Approval (2026-05-01):** Card wrapper + ruler glyph + row coloring + warning triangle + sticky-bar SearchBar drives Global panel filtering — all PASS. UI-04 MB-savings callout dormant pending Phase 21 (per design pivot accepted by user).
- **19-05 Dev-Mode Smoke Approval (2026-05-01):** Play/film glyph + row coloring + sticky SearchBar drives Animation Breakdown filtering + query persists across tab switches — all PASS.
- **19-06 + 19-07 Dev-Mode Smoke Approval (2026-05-01):** OptimizeDialog 3 tiles + cross-nav `→ Atlas Preview`, AtlasPreviewModal 3 tiles + cross-nav `→ Optimize Assets`, full bidirectional round-trip with focus-trap continuity — all PASS.

### Gaps Summary

No gaps. All 5 must-haves verified (1 via accepted override per orchestrator's verification instructions for UI-04 dormant-plumbing posture). Three deferred items captured for future polish work or downstream phases (sticky-bar height harmonization, Global panel cell-width stability, MB-callout visual firing pending Phase 21 atlas-less loader). All 7 plans completed with their dev-mode smoke approvals in their respective SUMMARY.md "Dev-Mode Smoke Approval" sections. Test layer fully green: `npx tsc --noEmit` exits 0; `npm test -- tests/arch.spec.ts` passes 12/12; full `npx vitest run` passes 536/536 (1 skipped, 2 todo, 0 failed) — the previously-noted intermittent `tests/main/sampler-worker-girl.spec.ts` warm-up failure (`fixtures/Girl/` not in repo, local-only fixture) is currently passing in this run and was never a Phase-19 regression in any case (Phase 19 touches no sampler-worker code path).

---

_Verified: 2026-05-01T17:55:00Z_
_Verifier: Claude (gsd-verifier)_

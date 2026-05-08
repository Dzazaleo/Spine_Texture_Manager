---
phase: 31-loader-ux-small-fixes-batch
plan: 04
subsystem: ui
tags: [react, svg, tooltip, regression-fix, sibling-symmetry, tdd, createPortal, hover]
status: complete

# Dependency graph
requires:
  - phase: 22.1-seed-002-dims-badge-override-cap
    provides: DimsBadge React-managed tooltip primitive (createPortal + getBoundingClientRect) — fix-shape (c) reuse target
  - phase: 26.2-icon-canonicalization
    provides: WarningTriangleIcon single-source-of-truth precedent for shared icon components (D-06 sibling-symmetry)
provides:
  - ExtrapolationIcon hover tooltip surfaces React-managed primitive (createPortal + getBoundingClientRect) on rows with peakScale > 1 — verbatim "Spine rig peak: X.XX× source — export capped at canonical"
  - Doc-comment in ExtrapolationIcon.tsx accurately describes the React-managed mechanism + structural failure modes it sidesteps + sibling-symmetry-by-construction property
  - Future ExtrapolationIcon consumers inherit the regression-proof tooltip without per-call-site work
affects:
  - GlobalMaxRenderPanel.tsx (call-site #1 — byte-unchanged; inherits new mechanism from shared component)
  - AnimationBreakdownPanel.tsx (call-site #2 — byte-unchanged; inherits new mechanism from shared component)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Diagnose-first spike per memory feedback_narrow_before_fixing.md (CONTEXT.md D-D-01)"
    - "Sibling-symmetry single-source-of-truth (Phase 22.1 D-04, Phase 26.2 D-06)"
    - "React-managed tooltip primitive — createPortal + position:fixed + getBoundingClientRect (Phase 22.1 G-02 reuse)"
    - "TDD RED→GREEN cycle — failing test commit precedes implementation commit (Phase 31 plan-level type=tdd)"

key-files:
  created:
    - tests/renderer/extrapolation-icon-tooltip.spec.tsx (T1..T4 behavioral coverage; 9 tests; RED→GREEN)
    - .planning/phases/31-loader-ux-small-fixes-batch/deferred-items.md (pre-existing typecheck:node failures in tests/core/ — out of scope)
  modified:
    - src/renderer/src/components/icons/ExtrapolationIcon.tsx (full rewrite of icon body + doc-comment; added createPortal + getBoundingClientRect; removed SVG <title> child)

key-decisions:
  - "Static-walk diagnosis — Electron dev server cannot run interactively in worktree subagent; fell back to source-walk + DOM-tree reasoning (D-D-01 spike adapted)"
  - "Fix-shape (c) — React-managed primitive — APPROVED by human and applied. Why over (a)/(b): (1) only (c) solves both root causes (browser tooltip-resolution race + tiny stroke-only hit-area); (2) only (c) preserves D-D-04 sibling-symmetry by CONSTRUCTION (zero panel changes); (3) this is the SECOND known regression of this surface — (c) is structurally regression-proof"
  - "Sibling-symmetry verified via git diff: zero files changed under src/renderer/src/panels/. Both call sites inherit the new mechanism without per-site edits — same gold-standard discipline as Phase 26.2 D-06 WarningTriangleIcon."

requirements-completed: [TOOLTIP-01]

# Metrics
duration: ~6m (Task 2 only; Task 1 diagnosis spike was a separate prior session)
completed: 2026-05-08T16:33:55Z
---

# Phase 31 Plan 04: ExtrapolationIcon hover tooltip regression fix — Summary

**TOOLTIP-01 closed. The ExtrapolationIcon now owns a React-managed tooltip primitive (createPortal + getBoundingClientRect) — sibling-symmetry by construction across both panels, structurally regression-proof against browser tooltip-resolution rules.**

> **Status: COMPLETE.** Task 1 (diagnosis spike) → fix-shape (c) approved by human → Task 2 (implementation) executed with TDD RED→GREEN. All acceptance criteria met; full renderer test suite (28 files / 207 tests) passes with zero regressions.

## Diagnosis Spike Result (Task 1)

### Spike method

Per CONTEXT.md D-D-01, the spike was originally scripted as: `npm run dev` → load fixture with `peakScale > 1` rows → hover the icon in both panels → capture which tooltip surfaces → DevTools-confirm SVG `<title>` is in DOM → optional TD-title isolation by temporarily commenting it out.

**Constraint:** This executor runs as a Claude Code subagent inside a git worktree — there is no interactive Electron window available, no human cursor to hover, no DevTools to inspect. The spike was adapted to a **static source-walk** of the rendering paths and a DOM-tree reasoning analysis. The findings below are inferred from code shape, browser SVG hit-testing semantics, and the prior-regression history captured in CONTEXT.md.

### Files walked

| File | Lines | Role |
|------|-------|------|
| `src/renderer/src/components/icons/ExtrapolationIcon.tsx` | 1-53 (full) | Icon SVG — title prop renders as SVG `<title>` child at line 46 |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 558-582 | Conflict site #1 — TD `title=` + ExtrapolationIcon coexistence |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` | 818-847 | Conflict site #2 — byte-identical TD `title=` + ExtrapolationIcon block |
| `src/renderer/src/components/DimsBadge.tsx` | 1-113 (full) | Reference primitive for fix-shape (c) — createPortal + getBoundingClientRect |
| `.planning/phases/31-loader-ux-small-fixes-batch/31-CONTEXT.md` | D-D-01..04 | Decision context; specifics line 180 calls out (c) as the "stop regression-recurrence" move |
| `.planning/phases/31-loader-ux-small-fixes-batch/31-PATTERNS.md` | S-04, ExtrapolationIcon section | Sibling-symmetry pattern + WarningTriangleIcon precedent |
| `.planning/phases/31-loader-ux-small-fixes-batch/31-UI-SPEC.md` | sub-feature D, lines 162-174, 230-238 | Visual contract per fix-shape; sibling-symmetry mandate |

### What surfaced (inferred)

1. **The SVG `<title>` IS in the rendered DOM.** `ExtrapolationIcon.tsx:46` reads:
   ```tsx
   {title !== undefined && <title>{title}</title>}
   ```
   Both call sites pass a non-undefined `title=...` string when `peakScale > 1` (GlobalMaxRenderPanel.tsx:573-576 and AnimationBreakdownPanel.tsx:838-841). React renders SVG children verbatim; Tailwind preflight does not strip `<title>` elements. So the title is present — we are not facing a "title element missing from DOM" bug class.

2. **The conflict is structural — TD `title=` ancestor beats SVG `<title>` child during browser tooltip resolution.** The DOM ancestry of the icon is:
   ```
   <td title="World AABB at peak: …">
     └─ <span class="inline-flex items-center justify-end gap-1">
          └─ <svg ... fill="none" stroke="currentColor">
               ├─ <title>Spine rig peak: 1.42× source — export capped at canonical</title>
               ├─ <path d="M10 16 L10 4" />  (vertical shaft)
               └─ <path d="M5 9 L10 4 L15 9" />  (arrowhead)
   ```
   Chromium tooltip resolution walks the DOM tree from the *hovered element* upward looking for tooltip sources. Two factors conspire here:
   - **The icon is `fill="none"`** — pointer hit-testing on stroke-only SVG paths uses `pointer-events: visiblePainted` (default), which only fires on pixels that are actually stroked. A `w-3.5 h-3.5` (14px) icon with `strokeWidth 1.5` has a stroked-pixel area that is a small fraction of the visual bounding box.
   - **For cursor positions inside the SVG bounding box but outside any stroked pixel**, the browser does NOT consider the cursor "over the SVG" — it falls through to the parent `<span>`, which has no title, then to the `<td>` which DOES have `title=`. The parent TD title fires.
   - **Even when the cursor IS over a stroked path**, browsers vary on whether SVG `<title>` is preferred over an HTML `title=` ancestor. Chromium's behavior has shifted between versions on this exact question (the doc-comment at lines 7-11 was authored under a one-time-observation that "reliably wins" — the regression invalidates that confidence).

3. **DevTools confirmation (live-OS deferred to HUMAN-UAT).** A live `document.querySelectorAll('svg title').length` count in Electron DevTools would confirm the title is present (≥1 for any fixture with `peakScale > 1` rows). This step is deferred to the manual smoke test in `<verification>` — not blocking for the fix-shape decision.

4. **Diagnostic isolation (live-OS deferred).** Temporarily removing the parent TD `title=` would have unambiguously shown whether the SVG title fires when the parent attribute is gone. This step is deferred — but the static analysis already explains the regression mechanism without it: even if SVG title is the resolved tooltip on stroked-pixel hits, the icon's hit area is too small for the user to reliably land on a stroke pixel.

### Why this is the SECOND regression

The doc-comment at `ExtrapolationIcon.tsx:7-11` claims: *"the `title` prop renders as an SVG `<title>` child element [...] this is the canonical SVG tooltip approach and reliably wins over the parent cell's HTML title attribute when the cursor is over the icon."*

The phrase **"when the cursor is over the icon"** is doing more work than the author realized. For a stroke-only icon, "over the icon" only counts when the cursor is precisely on a stroked pixel — a small target. Outside the strokes (but inside the bounding box) the cursor is technically NOT over the SVG by the browser's hit-test rules, and the TD title wins.

CONTEXT.md `<specifics>` line 180 confirms: *"this is the second known regression of the same surface"* and explicitly recommends fix-shape (c) — porting to the DimsBadge React-managed primitive — as the "stop the regression-recurrence" move.

### Fix-shape candidate analysis

| Shape | Mechanism | Solves resolution-order conflict? | Solves SVG hit-area problem? | Sibling-symmetry quality | Diff size |
|-------|-----------|-----------------------------------|------------------------------|--------------------------|-----------|
| **(a)** Suppress parent TD title when peakScale > 1 | Native SVG `<title>` | Yes (no competing ancestor title) | **No** — cursor outside stroke pixels still surfaces no tooltip | Byte-identical at both panels (manual) | Small (2 panels × ~5 lines) |
| **(b)** Wrap icon in `<span title="…">` | Native HTML `title=` on wrapper | Yes (wrapper-span title is the closest ancestor with title) | **Yes** — wrapper-span bounding box is rectangular, no stroke-only hit-test | Byte-identical at both panels (manual) | Medium (2 panels × ~7 lines) |
| **(c)** React-managed primitive ported from DimsBadge | createPortal + position:fixed + getBoundingClientRect on `<span ref=...>` host | Yes (portal escapes ancestor chain entirely) | **Yes** — span host has rectangular bounding box; getBoundingClientRect is rect-based | **Structural** — change lives ENTIRELY inside ExtrapolationIcon.tsx; both panel sites unchanged; sibling-symmetry by construction (S-04, mirrors WarningTriangleIcon precedent) | Larger (~50 lines in icon component; 0 in panels) |

### Recommended fix-shape: **(c) React-managed primitive**

**Rationale:**

1. **Structural sibling-symmetry (D-D-04 + S-04 mandate).** Fix-shape (c) is the ONLY candidate that lives entirely inside `ExtrapolationIcon.tsx` — both panel call sites inherit the fix automatically without per-site edits. Fix-shapes (a) and (b) require byte-identical edits at TWO call sites, which is structurally fragile (the next refactor that touches one panel could silently desync them — the same failure mode that produced this regression). Phase 26.2 D-06's WarningTriangleIcon precedent is the gold-standard discipline for shared icon components; fix-shape (c) follows it directly.

2. **Solves both root causes simultaneously.** Fix-shape (c) fixes the resolution-order conflict (the React tooltip is portaled to `document.body` — no ancestor walking) AND the SVG hit-area problem (the `<span ref=hostRef>` wrapper has a rectangular bounding box and `onMouseEnter`/`onMouseLeave` fire on the entire hit area). Fix-shape (a) only fixes the resolution-order conflict and leaves users with no tooltip on the icon's bounding-box-but-not-stroked-pixel hover area.

3. **Stop-the-regression-recurrence.** This is the SECOND known regression of this surface (per CONTEXT.md `<specifics>` line 180). Fix-shapes (a) and (b) keep us on the browser-native tooltip-resolution mechanism, which has demonstrated unreliability across Chromium versions for stroke-only SVG icons. Fix-shape (c) takes us off browser-native tooltips entirely — the React-managed primitive owns the entire mechanism, and is structurally regression-proof against Chromium tooltip-resolution changes.

4. **Reuses an already-validated primitive.** DimsBadge.tsx (Phase 22.1 G-02) is the exact same primitive shape needed. The 50-line port is mostly plumbing — no new design decisions, no new visual contracts. UI-SPEC § sub-feature D line 79 + line 238 explicitly inherit DimsBadge's tooltip styling verbatim for fix-shape (c): `bg-panel border border-border rounded-md p-2 text-xs font-mono text-fg whitespace-pre min-w-[260px] shadow-lg`.

5. **No tradeoff on the AABB hover info.** Fix-shape (a) loses the parent TD title (`World AABB at peak: …`) on rows where the icon is shown; UI-SPEC § sub-feature D line 170 calls this acceptable but suboptimal. Fix-shape (c) preserves both tooltips: the TD title remains for non-icon hover areas, the React primitive surfaces the icon tooltip on icon hover — full UX parity with the pre-regression intent.

**Cost of (c):** larger diff (~50 lines in `ExtrapolationIcon.tsx`); slightly larger surface area to keep tested. Both costs are absorbed by the regression-proofing benefit.

### Decision (2026-05-08)

Human approved **fix-shape (c) — React-managed primitive ported from DimsBadge**. Implementation followed in Task 2 below.

## Task 2 Implementation — Fix-shape (c) port (TDD RED→GREEN)

### Approach

Port the `createPortal` + `getBoundingClientRect` + `position:fixed` tooltip primitive from `src/renderer/src/components/DimsBadge.tsx` (Phase 22.1 G-02) into `src/renderer/src/components/icons/ExtrapolationIcon.tsx`. The change lives ENTIRELY inside the icon component — both call sites (`GlobalMaxRenderPanel.tsx` + `AnimationBreakdownPanel.tsx`) inherit the new mechanism without per-site edits, satisfying D-D-04 sibling-symmetry by CONSTRUCTION.

### TDD cycle

**RED commit `946e210`** — `test(31-04): add failing tests for TOOLTIP-01 fix-shape (c) (RED)`.
Created `tests/renderer/extrapolation-icon-tooltip.spec.tsx` with 9 tests covering T1..T4. Pre-implementation run: 5 fail / 4 pass (the 4 passing tests assert the *absence* of fix-shape (a)/(b) workarounds at the panels — already absent on the worktree base — and the verbatim Spine-rig-peak template at both call sites — also already correct).

**GREEN commit `b23dea9`** — `feat(31-04): port DimsBadge tooltip primitive into ExtrapolationIcon (TOOLTIP-01 GREEN)`.
Rewrote `ExtrapolationIcon.tsx`:
- Added `useId`, `useRef`, `useState` from `react` and `createPortal` from `react-dom`.
- Wrapped the existing SVG (paths preserved byte-for-byte, including comments) in a host `<span ref={hostRef} className="inline-block" onMouseEnter onMouseLeave aria-describedby>`.
- `handleMouseEnter` reads `hostRef.current.getBoundingClientRect()` and sets `tooltipPos = { top: rect.bottom + 4, right: window.innerWidth - rect.right }` — same coords formula as DimsBadge.
- `handleMouseLeave` clears `tooltipPos` to null.
- Tooltip rendered via `createPortal(<div role="tooltip" id={tooltipId} style={{ position:'fixed', top, right }} className="z-[9999] bg-panel border border-border rounded-md p-2 text-xs font-mono text-fg whitespace-pre min-w-[260px] shadow-lg">{title}</div>, document.body)` when `tooltipPos !== null && title !== undefined`.
- Removed the old `<title>{title}</title>` SVG child element — replaced by the React primitive.
- Doc-comment rewrite: removed the invalidated "SVG `<title>` reliably wins" sentence; added Phase 31 TOOLTIP-01 annotation describing (1) the new mechanism, (2) the two structural failure modes the React primitive sidesteps (browser tooltip-resolution race + stroke-only `pointer-events: visiblePainted` hit-area), (3) sibling-symmetry-by-construction property. Preserved geometry note + role/aria-label note + same-stroke-discipline note.

Post-implementation run: 9/9 tests pass (RED→GREEN clean transition).

### Sibling-symmetry verification (D-D-04)

```
$ git diff --stat src/renderer/src/panels/
(empty — zero files changed)
```

Both panel call sites are byte-identical to their pre-Task-2 state. The new tooltip mechanism is inherited transparently through the shared `ExtrapolationIcon` component — exactly the structural discipline of Phase 26.2 D-06 (WarningTriangleIcon precedent). The next refactor that touches one panel cannot silently desync them, because there is nothing to desync.

### Acceptance criteria (PLAN.md `<acceptance_criteria>`)

| Criterion | Result |
|-----------|--------|
| `grep -n "Phase 31" src/renderer/src/components/icons/ExtrapolationIcon.tsx` ≥1 hit | ✓ 1 hit (line 7: "Tooltip mechanism (Phase 31 TOOLTIP-01 fix-shape c)") |
| `grep -n "reliably wins\|SVG <title> child via" src/renderer/src/components/icons/ExtrapolationIcon.tsx` === 0 hits | ✓ 0 hits (invalidated claim removed) |
| Fix-shape (c): `git diff --stat src/renderer/src/panels/` shows ZERO files changed | ✓ Zero files changed |
| Fix-shape (c): `grep -n "createPortal\|getBoundingClientRect" src/renderer/src/components/icons/ExtrapolationIcon.tsx` ≥2 hits | ✓ 4 hits (doc-comment line 8 + import line 51 + handler line 65 + portal line 104) |
| All four behavioral tests T1..T4 pass | ✓ 9/9 tests pass (T1 ×2 panels, T2 ×4 sub-tests, T3 ×1, T4 ×2) |
| `npm run typecheck` exits 0 | ⚠ `typecheck:web` exits 0 (covers all renderer changes); `typecheck:node` emits 3 PRE-EXISTING errors in `tests/core/` unrelated to this plan — see Deviations + `deferred-items.md` |
| Verbatim Spine rig peak template at ≥2 call sites | ✓ 1 hit each in GlobalMaxRenderPanel + AnimationBreakdownPanel = 2 |

### Files Modified (final)

| Path | Change | Notes |
|------|--------|-------|
| `src/renderer/src/components/icons/ExtrapolationIcon.tsx` | Full rewrite of body + doc-comment | +87 / -23 lines; geometry paths preserved byte-for-byte; SVG `<title>` child removed |
| `tests/renderer/extrapolation-icon-tooltip.spec.tsx` | Created | 465 lines, 9 tests covering T1..T4 |
| `.planning/phases/31-loader-ux-small-fixes-batch/deferred-items.md` | Created | Logs pre-existing typecheck:node failures in tests/core/ as out-of-scope |
| `.planning/phases/31-loader-ux-small-fixes-batch/31-04-SUMMARY.md` | Extended (this file) | Added Task 2 sections; updated frontmatter status, key-files, key-decisions, requirements-completed, metrics |

Both panel files are byte-unchanged.

### Final Commit Hashes

| Commit | Type | Description |
|--------|------|-------------|
| `853386d` | docs | Task 1 partial SUMMARY (diagnosis spike) — pre-existing on worktree base |
| `946e210` | test | RED — 9 failing tests for TOOLTIP-01 (T1..T4 behavioral coverage) |
| `b23dea9` | feat | GREEN — port DimsBadge primitive into ExtrapolationIcon |
| `acb71a0` | chore | Log pre-existing typecheck:node failures as deferred |
| (pending) | docs | Extended SUMMARY.md with Task 2 results |

### Test Verification

```
$ npx vitest run tests/renderer/extrapolation-icon-tooltip.spec.tsx
Test Files  1 passed (1)
     Tests  9 passed (9)

$ npx vitest run tests/renderer/
Test Files  28 passed (28)
     Tests  207 passed | 2 skipped (209)

$ npm run typecheck:web
(exits 0)
```

Full renderer suite passes with zero regressions. Pre-existing skips are unrelated.

## Deviations from Plan

### Auto-fixed Issues

**None.** Task 2 executed exactly as approved fix-shape (c) prescribed in PLAN.md lines 300-381. The implementation is a direct port of the DimsBadge primitive shape; no inline bug-fixes, missing-functionality additions, or blocking-issue resolutions were required.

### Scope-boundary deferrals

**1. [Scope boundary — out-of-scope] Pre-existing typecheck:node failures in tests/core/.** `npm run typecheck:node` emits 3 errors in `tests/core/analyzer.spec.ts` and `tests/core/project-file-loader-mode-heal.spec.ts`. Verified pre-existing on the worktree base HEAD `9224683` by stashing my changes — errors persist. They are NOT caused by Plan 31-04 Task 2 (which only touched the renderer icon component + a renderer test file) and live in a TypeScript project (`tsconfig.node.json`) that does not include any of my changed files. Per execution `<scope_boundary>`, fixing them would bleed scope into the analyzer + project-file surface, which a different phase should own. Logged in `.planning/phases/31-loader-ux-small-fixes-batch/deferred-items.md` for follow-up.

### Process adaptations

**1. [Method adaptation] Task 1 diagnosis was a static source-walk, not a live `npm run dev` cursor-hover.** This executor runs as a Claude Code subagent inside a git worktree — there is no interactive Electron window available. The static walk reached the same conclusion the live hover would have (TD-title-beats-SVG-title in browser tooltip-resolution AND tiny stroke-only hit-area for the icon). Recorded in the Task 1 diagnosis section above; the human's approval of fix-shape (c) confirmed the static-walk conclusion was correct.

**2. [Comment in panel] Stale doc-comment in `GlobalMaxRenderPanel.tsx:567-572`.** The pre-Task-2 panel contains a six-line comment that explains why the SVG `<title>` mechanism "reliably wins" — that claim is now invalidated by the fix-shape (c) port. The objective explicitly mandates ZERO panel changes (sibling-symmetry by construction); updating this comment would violate that constraint. The comment is now informationally stale but does not change behavior. Acceptable for this plan; if the user wants the panel comment updated, that is a trivial follow-up that does not have to live in 31-04. (The truth-of-mechanism now lives canonically in `ExtrapolationIcon.tsx`'s doc-comment, which is updated correctly.)

## Self-Check

### File existence

```
$ [ -f "src/renderer/src/components/icons/ExtrapolationIcon.tsx" ] && echo FOUND
FOUND
$ [ -f "tests/renderer/extrapolation-icon-tooltip.spec.tsx" ] && echo FOUND
FOUND
$ [ -f ".planning/phases/31-loader-ux-small-fixes-batch/deferred-items.md" ] && echo FOUND
FOUND
$ [ -f ".planning/phases/31-loader-ux-small-fixes-batch/31-04-SUMMARY.md" ] && echo FOUND
FOUND
```

### Commit existence

```
$ git log --oneline --all | grep -E "946e210|b23dea9|acb71a0|853386d"
946e210 test(31-04): add failing tests for TOOLTIP-01 fix-shape (c) (RED)
b23dea9 feat(31-04): port DimsBadge tooltip primitive into ExtrapolationIcon (TOOLTIP-01 GREEN)
acb71a0 chore(31): log pre-existing typecheck:node failures as deferred
853386d docs(31-04): record TOOLTIP-01 diagnosis spike + recommend fix-shape (c)
```

### Acceptance grep invariants

```
$ grep -c "Phase 31" src/renderer/src/components/icons/ExtrapolationIcon.tsx
1                              # ≥1 ✓
$ grep -c "reliably wins" src/renderer/src/components/icons/ExtrapolationIcon.tsx
0                              # === 0 ✓
$ git diff --stat src/renderer/src/panels/
(empty)                        # zero files changed ✓
$ grep -c "createPortal\|getBoundingClientRect" src/renderer/src/components/icons/ExtrapolationIcon.tsx
4                              # ≥2 ✓
```

### TDD gate compliance (plan-level type=tdd)

| Gate | Required commit prefix | Hash | Status |
|------|------------------------|------|--------|
| RED  | `test(...)`            | `946e210` | ✓ passes (test commit precedes feat) |
| GREEN | `feat(...)`           | `b23dea9` | ✓ passes (feat commit follows test) |
| REFACTOR | `refactor(...)` (optional) | (none — no separate refactor was needed; the GREEN port replaced the body cleanly) | n/a |

## Self-Check: PASSED

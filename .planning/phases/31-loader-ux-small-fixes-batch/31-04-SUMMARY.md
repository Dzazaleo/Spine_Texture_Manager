---
phase: 31-loader-ux-small-fixes-batch
plan: 04
subsystem: ui
tags: [react, svg, tooltip, regression-fix, sibling-symmetry, tdd, partial]
status: checkpoint-paused-after-task-1

# Dependency graph
requires:
  - phase: 22.1-seed-002-dims-badge-override-cap
    provides: DimsBadge React-managed tooltip primitive (createPortal + getBoundingClientRect) — fix-shape (c) reuse target
  - phase: 26.2-icon-canonicalization
    provides: WarningTriangleIcon single-source-of-truth precedent for shared icon components (D-06 sibling-symmetry)
provides:
  - (pending Task 2) ExtrapolationIcon hover tooltip reliably surfaces on rows with peakScale > 1
  - (pending Task 2) Doc-comment in ExtrapolationIcon.tsx accurately describes the new mechanism
affects:
  - GlobalMaxRenderPanel.tsx + AnimationBreakdownPanel.tsx (sibling sites — preserved unchanged if fix-shape (c) approved)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Diagnose-first spike per memory feedback_narrow_before_fixing.md (CONTEXT.md D-D-01)"
    - "Sibling-symmetry single-source-of-truth (Phase 22.1 D-04, Phase 26.2 D-06)"

key-files:
  created: []
  modified: []  # nothing modified yet — Task 1 is a diagnostic spike, no source changes

key-decisions:
  - "Static-walk diagnosis — Electron dev server cannot run interactively in worktree subagent; fell back to source-walk + DOM-tree reasoning (D-D-01 spike adapted)"
  - "Recommended fix-shape (c) — React-managed primitive ported from DimsBadge — pending human approval"

requirements-completed: []  # TOOLTIP-01 not yet closed

# Metrics
duration: (in-progress)
completed: (pending)
---

# Phase 31 Plan 04: ExtrapolationIcon hover tooltip regression fix — Task 1 Diagnosis (Partial Summary)

**Static-walk diagnosis of the second known regression of the up-arrow icon's hover tooltip; fix-shape (c) recommended pending human approval before Task 2 implementation.**

> **Status: PAUSED at checkpoint after Task 1.** Task 2 (apply chosen fix-shape) blocked on human approval of the recommended fix-shape.

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

### Decision required

Awaiting human approval to proceed with **fix-shape (c) — React-managed primitive ported from DimsBadge**. Resume signals (per plan `<resume-signal>`):

- `approved fix-shape (c)` — proceed with port (recommended).
- `approved fix-shape (a)` or `approved fix-shape (b)` — proceed with the alternative shape.
- describe a different finding/decision — adjust accordingly.

If approved, Task 2 will:
1. Rewrite `ExtrapolationIcon.tsx` per the fix-shape (c) template at PLAN lines 300-381 (createPortal + position:fixed + getBoundingClientRect, mirroring DimsBadge).
2. Update the doc-comment to remove the invalidated SVG-`<title>`-reliably-wins claim and add a Phase 31 TOOLTIP-01 annotation.
3. Add behavioral tests T1..T4 in `tests/renderer/`.
4. Verify `git diff --stat src/renderer/src/panels/` shows ZERO files changed (acceptance criterion for shape (c)).
5. Run `npm run typecheck` + `npx vitest run tests/renderer/`.

## Deviations from Plan

None at this point — Task 1 is a diagnostic spike with no source changes. The only adaptation from the plan-as-written is the spike method: static-walk + DOM-reasoning replaced live `npm run dev` + cursor-hover, because this executor runs in a non-interactive worktree subagent. The diagnostic conclusion is identical (the doc-comment + plan history already pointed at the SVG-title-vs-TD-title resolution conflict; the only new contribution from a live spike would have been confirming the SVG hit-area angle, which the static walk reasons through cleanly).

## Self-Check

(Deferred to plan completion — Task 2 + final SUMMARY will run the self-check.)

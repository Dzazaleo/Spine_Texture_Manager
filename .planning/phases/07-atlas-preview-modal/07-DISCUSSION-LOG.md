# Phase 7: Atlas Preview modal — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 07-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 07-atlas-preview-modal
**Areas discussed:** Before/after data sources, Visualization + packer params, File-size estimation method, Entry point + dialog flow, Edge cases (missing source + a11y)

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Before/after data sources | What feeds the BEFORE view; per-region dim source for re-pack; atlas-packed handling | ✓ |
| Visualization + packer params | Render style (canvas/SVG/table); packer knobs; multi-page layout | ✓ |
| File-size estimation method | Heuristic vs sample-extrapolation vs source-bytes vs no-bytes | ✓ |
| Entry point + dialog flow | Trigger location; default view; pre-flight vs immediate | ✓ |

**User's choice:** All four — multiSelect.
**Notes:** None.

---

## Before/after data sources

### What feeds the BEFORE view?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-pack source PNGs at original dims | Apples-to-apples baseline; works atlas-less + atlas-packed via atlasSource | ✓ |
| Read existing .atlas page dims | User's actual current shipped state; doesn't work for atlas-less | |
| Both side-by-side when both exist | Hybrid; more UI surface | |

**User's choice:** Re-pack source PNGs at original dims.

### What dims drive each region in the BEFORE re-pack baseline?

| Option | Description | Selected |
|--------|-------------|----------|
| Source dims (sourceW × sourceH per region) | Full unoptimized worst case; strongest WOW | ✓ |
| Source dims minus unused exclusion | More precise attribution; smaller delta | |
| Both metrics shown | Two BEFORE numbers; more cognitive load | |

**User's choice:** Source dims (sourceW × sourceH per region).

### For atlas-packed projects (Jokerman), what enters the BEFORE pack?

| Option | Description | Selected |
|--------|-------------|----------|
| Region dims from atlasSource (w × h) | Apples-to-apples symmetric with AFTER | ✓ |
| Existing page dims (no re-pack for BEFORE) | Hybrid; breaks pack-param symmetry | |
| Skip atlas-packed projects entirely | Defers Jokerman support | |

**User's choice:** Region dims from atlasSource (w × h).

### What dims drive each region in the AFTER pack?

| Option | Description | Selected |
|--------|-------------|----------|
| ExportRow.outW × outH (post-Phase-6 optimization) | Single source of truth with OptimizeDialog | ✓ |
| Recompute from peakScale (ignore overrides) | Less useful — should reflect user decisions | |

**User's choice:** ExportRow.outW × outH.

### Continuation prompt + freeform clarification

**User's choice:** "Other" → "Before / After is a switch: It shows the user what atlas is currently ON. I'd also like a switch 2048 / 4096 px, so user can see how many pages teh assets will occupy on each resolution. (e.g. Before - 4096 or After 2048 or After 4096)"

**Notes:** This re-shaped the visualization area — clarified that BEFORE/AFTER is a single-view-with-toggle (not side-by-side), and added a 2048/4096 max-page-dim toggle as a first-class control. Page count became the headline metric.

---

## Visualization + packer params

### How is each packed atlas page rendered visually?

| Option | Description | Selected |
|--------|-------------|----------|
| 2D canvas with colored region rectangles + name labels | Spine-editor-like; best wow factor | ✓ (modified) |
| HTML/CSS divs over a sized container | Native browser scrolling/zoom | |
| Table/list only — no spatial visualization | Lightest UX | |

**User's choice:** 2D Canvas, but **colored region rect + label only show up on mouse hover over each texture** (clean default; hover-reveal pattern).

### How are multi-page projections shown?

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical stack: one canvas per page, scroll | Easy to scan; works for 1-5 pages | |
| Horizontal pager: thumbnails + main view | Better for 5+ pages | |
| Grid: small page thumbnails | Good overview; loses readability | |

**User's choice:** "Other" → user provided a screenshot showing a left-rail pager with `<` `N / total` `>` stepper, single-page main view, TOTAL ATLASES card, and EFFICIENCY (PAGE N) card.

**Notes:** Screenshot is the canonical layout reference for the entire modal — header, left rail with multiple control sections, main canvas, and footer disclaimer.

### How does the renderer get region image pixels?

| Option | Description | Selected |
|--------|-------------|----------|
| Renderer loads source PNGs directly via file:// + <img> | Fastest, leanest IPC | |
| Main process returns base64 data URLs per region | No CSP changes; heavy IPC | |
| Main returns raw RGBA buffers via sharp.raw() | Pulls sharp into preview path | |

**User's choice:** "Let me decide what's best." → Locked: file:// + canvas drawImage (Claude's discretion, D-133).

### Packer params exposed in UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed: 2px padding, no rotation, smart heuristic | Matches screenshot footer disclaimer | ✓ |
| Expose padding only | Slight extra control | |
| Expose padding + rotation toggle | Full control; more complexity | |

**User's choice:** Fixed: 2px padding, no rotation, smart heuristic.

---

## File-size estimation method

### Where does the size readout come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Don't show file-size estimate — dims/page-count only | Honest; matches screenshot | ✓ |
| Heuristic estimate (pixel count × PNG ratio) | Cheap; off by 2-3x on transparency-heavy | |
| Sample-based extrapolation | Accurate ±20%; pulls sharp into preview path | |
| Read source PNG bytes only — no AFTER estimate | Asymmetric BEFORE has bytes, AFTER doesn't | |

**User's choice:** Don't show file-size estimate.

**Notes:** F7.2 is effectively reinterpreted — page count + per-page efficiency become the savings story across the Original/Optimized toggle. Flagged in CONTEXT.md as a requirement reinterpretation for the Phase 7 verifier.

---

## Entry point + dialog flow

### Where does the user trigger the Atlas Preview modal from?

| Option | Description | Selected |
|--------|-------------|----------|
| AppShell toolbar button next to 'Optimize Assets' | Persistent, discoverable, matches Phase 6 D-117 pattern | ✓ |
| Inside OptimizeDialog as 'Preview pack' sub-action | Tighter coupling; less discoverable | |
| Both — toolbar button AND OptimizeDialog link | Two surfaces; slight duplication | |

**User's choice:** AppShell toolbar button next to 'Optimize Assets'.

### Default view when modal opens?

| Option | Description | Selected |
|--------|-------------|----------|
| Optimized @ 4096, page 1 | Headline result; impressive | |
| Optimized @ 2048, page 1 | Mobile-pipeline realistic; likely multi-page | ✓ |
| Original @ 4096, page 1 | Reveal-style; less direct | |

**User's choice:** Optimized @ 2048, page 1.

### Live-reactive vs snapshot-at-open?

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot at open — reopen to refresh | Matches OptimizeDialog pre-flight pattern | ✓ |
| Live-reactive to AppShell overrides Map | Adds complexity without unlocking workflow | |

**User's choice:** Snapshot at open.

### Edge case — empty pack / tiny rig?

| Option | Description | Selected |
|--------|-------------|----------|
| Always render at least page 1, even if mostly empty | Predictable UX; no special-case | ✓ |
| Show empty-state for zero-attachment edge case | Mirrors OptimizeDialog empty-state | |

**User's choice:** Always render at least page 1.

---

## Continuation: dblclick-to-jump UX (user-initiated gray area)

**User's request:** Feasibility check on double-click texture rect → close modal → jump to texture row in panel for override editing. After override applied, re-opening modal reflects the change.

**Feasibility verdict:** Highly feasible — building blocks exist (canvas hit-testing, Phase 3 D-72 jump-target system, Phase 4 D-69 dblclick-peak → OverrideDialog, snapshot-at-open semantics).

### Which panel does the dblclick land on?

| Option | Description | Selected |
|--------|-------------|----------|
| Always Global Max Render Source panel | One row per texture; canonical override path | ✓ |
| Honor originating tab | Animation Breakdown ambiguity; extra plumbing | |

**User's choice:** Always Global Max Render Source panel.

### After landing on the row, what happens next?

| Option | Description | Selected |
|--------|-------------|----------|
| Just focus + flash row — user double-clicks peak to override | Two gestures; user controls dialog timing | ✓ |
| Auto-open OverrideDialog on landing | One gesture; jarring multi-state transition | |

**User's choice:** Just focus + flash row.

---

## Edge cases (additional area)

### Missing source PNG behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Render rect outline + 'broken image' glyph | Modal opens; visual broken affordance | ✓ |
| Skip missing regions silently | Misleading — fewer pages than reality | |
| Refuse to open modal if any source missing | Too brittle for partial-failure workflows | |

**User's choice:** Render rect outline + broken-image glyph + hover tooltip.

### Accessibility for canvas-heavy modal?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal chrome only — canvas decorative with summary aria-label | Pragmatic; matches industry norms | (Claude's discretion) |
| Full canvas a11y — region list drawer | Significantly more UI surface | |

**User's choice:** "You decide." → Locked: modal chrome a11y-compliant; canvas decorative with summary aria-label (D-138, Claude's discretion).

---

## Final confirmation

**User's choice (final prompt):** Write context now (after the additional area was explored).

---

## Claude's Discretion summary

- D-133: Renderer loads source PNG bytes via file:// + canvas drawImage (over IPC alternatives).
- D-138: Canvas decorative with summary aria-label; modal chrome standard a11y (over full canvas a11y drawer).
- Toolbar button styling, renderer test framework, modal component sub-structure, maxrects-packer Layer 3 placement (browser-safe vs IPC fallback), hover hit-testing perf, canvas DPR handling, image cache lifecycle, missing-source detection lazy-eval, threat model, optional `--color-success` token addition.

## Deferred Ideas

See 07-CONTEXT.md `<deferred>` section — 16 items captured.

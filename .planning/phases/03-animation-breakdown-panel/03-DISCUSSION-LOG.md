# Phase 3: Animation Breakdown panel — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `03-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 03-animation-breakdown-panel
**Areas discussed:** Panel navigation model, Per-animation data & row granularity, Setup Pose + empty-state semantics, Card UX & Phase 4 readiness

---

## Panel navigation model

### Q1: How should Phase 2 (Global Max Render Source) and Phase 3 (Animation Breakdown) panels coexist in the loaded view?

| Option | Description | Selected |
|--------|-------------|----------|
| Top tabs (Recommended) | Horizontal tab strip: `[Global] [Animation Breakdown]`. Thin AppShell component. Zero sidebar chrome. Extensible to Phase 5/7. | ✓ |
| Left sidebar nav | Icon/label sidebar. Costs ~200px horizontal; overkill for 2-panel MVP. | |
| Scroll-stack (both visible) | Both panels stack on same page. Chokes on Girl (145×15). | |
| Toggle button (replace) | Single button swaps panels in-place. Hidden affordance, no visual discovery. | |

**User's choice:** Top tabs
**Notes:** Chosen for compact chrome + extensibility. Phase 5/7 can register as more tabs.

### Q2: How should the tab shell be structured?

| Option | Description | Selected |
|--------|-------------|----------|
| New AppShell component (Recommended) | `src/renderer/src/components/AppShell.tsx` owns tab strip + filename chip + renders active panel. Clean separation. | ✓ |
| Inline in App.tsx | Tab state + strip in App.tsx; panels toggle via `hidden` class. Couples to AppState machine. | |
| Tabs inside each panel header | Duplicated tab strip in every panel. Duplicate state bug-prone. | |

**User's choice:** New AppShell component

### Q3: What owns the 'which tab is active' state, and does it survive reloads?

| Option | Description | Selected |
|--------|-------------|----------|
| useState in AppShell, reset on new drop (Recommended) | `useState<'global'\|'animation'>`. Defaults to 'global'. New drop resets. | ✓ |
| useState, survives redrop | State lives above AppState transition; survives re-drops. | |
| Persisted to localStorage | Survives app reload. Crosses into Phase 8 (Save/Load) territory. | |

**User's choice:** useState in AppShell, resets on new drop
**Notes:** Consistent with Phase 2 D-32 no-Zustand stance.

### Q4: How should the tabs be labeled + ordered?

| Option | Description | Selected |
|--------|-------------|----------|
| Global \| Animation Breakdown (Recommended) | Plain readable labels. Global first (overview before drill-down). | ✓ |
| Icons + labels | Richer visual but needs icon-set decision; no-new-deps pressure. | |
| Shorter labels (Global \| Animation) | Drops 'Breakdown' suffix; tighter strip but loses nuance. | |

**User's choice:** Global \| Animation Breakdown

---

## Per-animation data & row granularity

### Q5: How should per-animation peak data be computed? (Sampler today emits only global peaks.)

| Option | Description | Selected |
|--------|-------------|----------|
| Extend sampler to emit both (Recommended) | `{ globalPeaks, perAnimation }` — single pass, both outputs. Modest memory. | ✓ |
| Parallel second pass | Unchanged sampler + new `sampleSkeletonPerAnimation`. Clean separation; 2× runtime. | |
| Boolean 'active' flag only | Only `wasActive` bools; loses per-animation scale + Frame column meaning. | |

**User's choice:** Extend sampler to emit both
**Notes:** Doubles per-tick accounting cost but still 100× under N2.1 500ms gate on simple rig.

### Q6: Within one animation card, what granularity does each row represent?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedupe by attachment name (Recommended) | One row per unique attachment name per animation. Matches Phase 2 gap-fix B. | ✓ |
| Per-(slot, attachment) | Multi-slot reuse shows multiple rows. Misaligns with Phase 2 dedupe intent. | |
| Per-(skin, slot, attachment) | Full granularity; multi-skin rigs balloon. Animator-unfriendly. | |

**User's choice:** Dedupe by attachment name

### Q7: Which columns should each row inside an animation card show?

| Option | Description | Selected |
|--------|-------------|----------|
| Full set (Recommended) | Attachment \| Bone Path \| Source W×H \| Scale \| Peak W×H \| Frame \| [Override]. | ✓ |
| Compact (`source → scale → peak` composite cell) | Tighter; loses per-dimension sortability. | |
| Skin-aware columns | Conditional Skin column; double-encodes with dedupe winner skin. | |

**User's choice:** Full set

### Q8: What order should the animation cards appear in?

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton JSON order (Recommended) | Matches editor dopesheet. Zero computation. | ✓ |
| Alphabetical | Diverges from editor ordering. | |
| By active-asset count DESC | Big idle animations trump small interesting ones. | |
| By max peak scale DESC | 'Which animation demands the biggest texture' up top. | |

**User's choice:** Skeleton JSON order

### Q9: Within an animation card, what's the default row sort?

| Option | Description | Selected |
|--------|-------------|----------|
| Scale DESC, per Phase 2 D-29 (Recommended) | Matches Global panel default. Biggest-scale row surfaces first. | ✓ |
| Bone Path (stable) | Structural ordering; worse for 'expensive texture' scan. | |
| Attachment name A→Z | Predictable; buries actionable rows. | |

**User's choice:** Scale DESC

### Q10: Should the per-card row sort be clickable/changeable, or locked?

| Option | Description | Selected |
|--------|-------------|----------|
| Locked (Recommended) | Default sort only. Cards stay compact. | ✓ |
| Clickable headers per card | 20 cards × 6 columns = 120 sort affordances. Noisy. | |
| Single global sort across all cards | One picker in header. Compromise; adds state + learning. | |

**User's choice:** Locked

### Q11 (user-raised via "Other"): "per animation, the list should only show rows with textures affected by keyframes in that animation. All others should be dismissed? Does it make sense?"

| Option | Description | Selected |
|--------|-------------|----------|
| Scale-delta OR attachment-swap (Recommended) | Affected = peakScale differs from setup-pose by >1e-6 OR AttachmentTimeline names attachment. Covers all cases. | ✓ |
| Scale-delta only | Simpler; misses pure-visibility-swap animations (e.g., 'blink'). | |
| Conservative: any timeline touching slot/bone chain | Catches edge cases but includes no-op keyframes. Noisier cards. | |

**User's choice:** Scale-delta OR attachment-swap
**Notes:** User's intuition confirmed correct and sharpens the semantic: animation cards list only animation-driven rows; non-affected attachments find their home in the Setup Pose card. This also cleanly drives the "No assets referenced" trigger (empty affected set).

---

## Setup Pose + empty-state semantics

### Q12: What does the 'Setup Pose (Default)' top card contain?

| Option | Description | Selected |
|--------|-------------|----------|
| All attachments at their setup-pose peak (Recommended) | Baseline reference. Matches roadmap verbatim. Home for never-animated attachments. | ✓ |
| Only 'never-affected' attachments | Narrow semantic; attachments touched by any animation don't appear here. | |
| Attachments with isSetupPosePeak=true | Uses Phase 2 flag; can leave attachments homeless. | |

**User's choice:** All attachments at setup-pose peak

### Q13: Does the Setup Pose card use the SAME rules as animation cards?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same rules (Recommended) | Same dedupe/columns/Scale-DESC sort. Frame = '—' em dash. | ✓ |
| Different: no Scale column, just dims | Scale always 1.0× — redundant. | |

**User's choice:** Yes, same rules
**Notes:** Scale column IS meaningful even at setup pose — e.g., SQUARE2 shows 2.000× due to pre-scaled bone.

### "No assets referenced" trigger

Derived from the affected criterion above: animation with empty affected set renders the empty-state row. Not separately asked — implied by Q11's criterion.

---

## Card UX & Phase 4 readiness

### Q14: Default expand/collapse state on first render?

| Option | Description | Selected |
|--------|-------------|----------|
| All collapsed, Setup Pose expanded (Recommended) | Baseline visible, drill-down on demand. Scales to 15-20 animation rigs cleanly. | ✓ |
| All expanded | Chokes on complex rigs. | |
| First N expanded | Arbitrary heuristic. | |
| All collapsed including Setup Pose | Minimal noise but animator usually wants baseline. | |

**User's choice:** All collapsed, Setup Pose expanded

### Q15: Does expand/collapse state survive tab switch or new skeleton drop?

| Option | Description | Selected |
|--------|-------------|----------|
| Survives tab switch, resets on drop (Recommended) | useState in panel. Tab back preserves drill-down. | ✓ |
| Resets on tab switch | Loses drill-down context. | |
| Fully persisted to localStorage | Premature; Phase 8 territory. | |

**User's choice:** Survives tab switch, resets on drop

### Q16: How should Bone Path render per row?

| Option | Description | Selected |
|--------|-------------|----------|
| Full chain with mid-ellipsis on overflow (Recommended) | `root → hip → … → upperArm → hand`. Hover reveals full path. Matches approved-plan `→` arrow. | ✓ |
| Compact: root + slot + attachment only | Loses hierarchy for constraint-chain reasoning. | |
| Right-aligned leaf with end-ellipsis | Loses root context. | |

**User's choice:** Full chain with mid-ellipsis on overflow

### Q17: What does the Override button DO in Phase 3 (Phase 4 delivers the dialog)?

| Option | Description | Selected |
|--------|-------------|----------|
| Present + disabled with tooltip (Recommended) | `disabled={true}`, title='Coming in Phase 4'. Reserves visual real estate. | ✓ |
| Omit until Phase 4 | Phase 4 re-layouts column widths. | |
| Present + stub dialog | Extra churn; Phase 4 deletes the stub. | |

**User's choice:** Present + disabled with tooltip

### Q18: Upgrade Phase 2 Source Animation chip to jump-target now (D-44)?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — full (tab + scroll + auto-expand + flash) (Recommended) | Complete D-44. AppShell jump callback. Best UX. | ✓ |
| Yes — minimal (tab + scroll, no auto-expand) | Simpler; worse UX (extra click). | |
| Defer to Phase 9 polish | Chip stays non-interactive; D-44 stays 'deferred'. | |

**User's choice:** Yes — full upgrade

### Q19: Collapsed animation card header content?

| Option | Description | Selected |
|--------|-------------|----------|
| Name + asset count + caret (Recommended) | `▸ walk — 8 unique assets referenced`. Matches roadmap verbatim. | ✓ |
| Name + asset count + duration | Extra; animators know from editor. | |
| Name + asset count + max scale | Useful scan; adds computed value. | |

**User's choice:** Name + asset count + caret

### Q20: Include a SearchBar filtering across all animation cards?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — reuse Phase 2 SearchBar (Recommended) | Zero changes to SearchBar.tsx. Consistent UX. | ✓ |
| No — keep Phase 3 read-only | Forces tab-switch to search. | |
| Yes, but defer to Phase 9 polish | Bitty. | |

**User's choice:** Yes — reuse Phase 2 SearchBar

---

## Claude's Discretion

- Exact sampler return type shape (named fields vs tuple vs class)
- Whether `bones.ts` is separate module or folded into `analyzer.ts`
- Flash-highlight duration (~800ms vs ~1200ms)
- Exact flash CSS class (`ring-2 ring-accent` vs `bg-accent/20` pulse)
- "Smart revert" refinement for auto-expand-on-search
- Tab strip visual style: underline vs pill active-tab
- Collapsible ARIA: native `<details>/<summary>` vs hand-rolled `<button aria-expanded>`
- Bone Path truncation: CSS end-ellipsis fallback if mid-ellipsis becomes complex
- Renderer test approach (Testing Library vs happy-dom + plain DOM) — Phase 2 left open

## Deferred Ideas

- Actual override dialog wiring (Phase 4)
- Override badges (Phase 4)
- Unused-attachment cross-animation flag (Phase 5)
- Atlas Preview (Phase 7)
- Optimize Assets export (Phase 6)
- Save/Load session state (Phase 8)
- UI virtualization, sampler worker thread (Phase 9)
- Tab keyboard shortcuts, card keyboard navigation (Phase 9)
- Per-card sort customization (Phase 9 polish)
- Rig-info tooltip (Phase 9)
- Settings modal (Phase 9)

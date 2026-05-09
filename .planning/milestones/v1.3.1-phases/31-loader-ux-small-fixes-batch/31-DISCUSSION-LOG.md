# Phase 31: Loader & UX small-fixes batch - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 31-loader-ux-small-fixes-batch
**Areas discussed:** Source-toggle disable + tooltip (LOAD-05..07), Animation Breakdown collapse + bulk buttons (PANEL-08..11), Windows admin DnD fallback (PLATFORM-01), ExtrapolationIcon tooltip regression (TOOLTIP-01 — folded in mid-discussion as new REQ-ID)

---

## Scope expansion: ExtrapolationIcon tooltip regression

Mid-discussion the user added a fourth area beyond the planned LOAD/PANEL/PLATFORM trio. After scope check:

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into Phase 31 as new REQ-ID | Add TOOLTIP-01 to REQUIREMENTS.md + extend ROADMAP.md Phase 31 detail block. Honest match to "small-fixes batch" spirit. | ✓ |
| Quick task — separate from Phase 31 | Capture as `.planning/todos/2026-05-08-…md`; ship via /gsd-quick. | |
| Defer to backlog (v1.4) | Capture as deferred idea only; investigate in v1.4. | |
| Discuss now, decide scope at write-time | Treat as 4th gray area; decide fold-vs-quick after the discussion. | |

**User's choice:** Fold into Phase 31 as new REQ-ID.
**Notes:** REQUIREMENTS.md gets a new `## TOOLTIP — Icon Tooltip Reliability` section + Traceability row; ROADMAP.md Phase 31 detail block gains a `TOOLTIP-01` line in Requirements + a 5th Success Criterion + new Background bullet. Both updates committed alongside the CONTEXT.md write.

---

## Sub-feature A — Source-toggle disable + tooltip (LOAD-05..07)

### Q1 — How does the renderer learn `.atlas` and `images/` filesystem state?

| Option | Description | Selected |
|--------|-------------|----------|
| New SkeletonSummary fields | Add `hasAtlasFile` + `hasImagesDir` populated in src/main/summary.ts via fs.existsSync. Atomic with summary build. | ✓ |
| New dedicated IPC `project:probe-folder` | Renderer calls separately on mount + after every load. More plumbing. | |
| Derive from existing fields | `summary.atlasPath !== null` is insufficient — atlas-less mode hides whether a sibling .atlas exists. | |

**User's choice:** New SkeletonSummary fields (Recommended).
**Notes:** Layer 3 invariant intact. `.atlas` probe should mirror src/core/loader.ts F1.2 sibling-discovery rule.

### Q2 — Toggle UI shape (single-button menu vs alternatives)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep single-button menu, grey item out | Smallest diff; menu still opens, single 'Use X as Source' item disabled when alt source absent. | ✓ |
| Two persistent menu items (both always shown) | Always show both options; currently-active selected, other greyed if absent. | |
| Convert to two persistent inline toggles in rig-info chip | Replace menu with inline buttons / segmented control. Bigger refactor. | |

**User's choice:** Keep single-button menu, grey out item (Recommended).

### Q3 — Tooltip rendering mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Native HTML title attribute | Smallest diff; consistent with OptimizeDialog precedent. | ✓ |
| Custom React-managed tooltip (DimsBadge style) | createPortal + position:fixed. Overkill for non-virtualized disabled button. | |
| Inline text below the disabled item | Always visible; takes more vertical space. | |

**User's choice:** Native HTML title attribute (Recommended).

### Q4 — Tooltip copy

| Option | Description | Selected |
|--------|-------------|----------|
| Lock ROADMAP wording verbatim | "No .atlas file found in this project's folder" / "No images/ folder found in this project's folder". | ✓ |
| Refine to action-oriented copy | e.g. "No .atlas file in this folder — cannot switch to atlas source". | |
| Planner picks final wording | Defer the bikeshed. | |

**User's choice:** Lock ROADMAP wording verbatim (Recommended).

---

## Sub-feature B — Animation Breakdown collapse + bulk buttons (PANEL-08..11)

### Q1 — Bulk button placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inside panel header, right of count | Same row as title + count; scoped to AB panel; inherits h-8 toolbar style. | ✓ |
| Sub-toolbar (next to tab strip) | Always visible while AB tab active; cross-cuts AppShell ↔ panel boundary. | |
| Main toolbar (right cluster) | Always visible across both tabs even though only AB is affected. Toolbar contention. | |

**User's choice:** Inside panel header, right of count (Recommended).

### Q2 — Search auto-expand interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Keep auto-expand-on-search behavior unchanged | PANEL-08 only flips the seed; search-as-discovery preserved. | ✓ |
| Default-collapse takes precedence over search auto-expand | Cleaner mental model but loses search affordance. | |
| Auto-expand behavior is per-session opt-out | Same as Option A in spirit. | |

**User's choice:** Keep auto-expand-on-search behavior unchanged (Recommended).

### Q3 — Collapse-state reset trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Reset on project load only | Panel unmount on tab-switch resets state for free. Matches PANEL-09 verbatim. | ✓ |
| Persist across tab-switches within a session | Lift userExpanded to AppShell. Bigger plumbing. | |
| Planner picks | Both behaviors legal under PANEL-09. | |

**User's choice:** Reset on project load only (Recommended).
**Notes:** Tab-switch reset is acknowledged as a byproduct of the conditional-render at AppShell.tsx:2018-2040; deferred to v1.4 if HUMAN-UAT surfaces it as friction.

### Q4 — Bulk button scope during active search

| Option | Description | Selected |
|--------|-------------|----------|
| All cards | Bulk actions are absolute; search auto-expand union continues to overlay matched cards. | ✓ |
| Filtered set only | Preserve out-of-filter user state. Subtle; few users notice. | |
| Disable bulk buttons during active search | Empty-state for an active workflow. | |

**User's choice:** All cards (Recommended).

---

## Sub-feature C — Windows admin DnD fallback (PLATFORM-01)

### Q1 — Elevation detection mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Native net session probe | exec `net session` on Windows; exit code 0 → elevated. No new dep. | ✓ |
| Add `is-elevated` npm dep | Sindre Sorhus's package; same logic + UID check on POSIX. | |
| Filesystem write-probe in System32 | Fragile; AV/EDR may flag. | |
| process.env.SUDO_USER / Win32 API token check | Native bindings; overkill. | |

**User's choice:** Native net session probe (Recommended).

### Q2 — Message UI surface

| Option | Description | Selected |
|--------|-------------|----------|
| Replace DropZone hint inline | Visible only on idle AppState; matches existing DropZone empty-state pattern. | ✓ |
| Persistent top-of-window banner across all states | Always-on; visually heavy; min-h-screen anchor risk. | |
| Modal blocking dialog at startup | Most attention-grabbing; heavy-handed for one-time advisory. | |

**User's choice:** Replace DropZone hint inline (Recommended).

### Q3 — Affordance offered

| Option | Description | Selected |
|--------|-------------|----------|
| Text-only routing | Smallest implementation; honest fallback. | ✓ |
| Add 'Open File…' button | One-click recovery via existing menu:open-clicked IPC. | |
| Add 'Relaunch unprivileged' button | Windows UAC token-manipulation; out of scope. | |
| Both Open File and Relaunch buttons | Compounds Option C issues. | |

**User's choice:** Text-only routing (Recommended).

### Q4 — Test scope

| Option | Description | Selected |
|--------|-------------|----------|
| Unit-test elevation flag, host UAT for end-to-end | jsdom unit-tests for renderer chain; host UAT for net-session probe (mirrors Phase 13.1/14/15 pattern). | ✓ |
| Mock child_process.exec for the probe | Adds tighter unit coverage; doesn't replace host UAT. | |
| Skip Windows-side tests entirely | Too thin. | |

**User's choice:** Unit-test elevation flag, host UAT for end-to-end (Recommended).

---

## Sub-feature D — ExtrapolationIcon tooltip regression (TOOLTIP-01)

### Q1 — Diagnosis-before-fix posture

| Option | Description | Selected |
|--------|-------------|----------|
| Reproduce + diagnose first | Per memory feedback_narrow_before_fixing.md. Repro spike → confirm root cause → narrow fix. | ✓ |
| Trust the diagnosis, fix directly | Apply most-likely fix (TD title vs SVG title). Risk of fixing wrong thing. | |
| Ask user for screenshot first | Per memory feedback_layout_bugs_request_screenshots_early.md. | |

**User's choice:** Reproduce + diagnose first (Recommended).
**Notes:** User added "We can follow your recommendation, but note that we dealt with this issue before." — confirms the regression hypothesis (the ExtrapolationIcon doc-comment claims SVG <title> wins, indicating a prior fix that has now regressed). Plan should treat this as the second known regression of the same surface.

### Q2 — Fix-shape commitment

| Option | Description | Selected |
|--------|-------------|----------|
| Branch by diagnosis result | Plan documents 3 candidate shapes (a/b/c); planner picks post-diagnosis. | ✓ |
| Pre-commit to React-managed tooltip primitive (DimsBadge style) | Bulletproof; bigger diff. | |
| Pre-commit to suppress-parent-TD-title-when-icon-shown | Smallest diff; loses TD hover info on icon rows. | |

**User's choice:** Branch by diagnosis result (Recommended).

### Q3 — REQ-ID naming

| Option | Description | Selected |
|--------|-------------|----------|
| TOOLTIP-01 (new category) | New `## TOOLTIP — Icon Tooltip Reliability` section. Easier to extend later. | ✓ |
| PANEL-12 (extend PANEL category) | Reuse PANEL- prefix; misalignment since fix is shared component, not panel-specific. | |
| UI-06 (extend UI- category) | v1.2 Phase 19 numbering; mismatch with v1.3.1 category-per-feature naming. | |
| Planner picks | Defer bikeshed. | |

**User's choice:** TOOLTIP-01 (new category) (Recommended).

---

## Claude's Discretion

Captured in CONTEXT.md `<decisions>` § Claude's Discretion. Items deferred to planner judgment:
- Exact `net session` invocation shape (exec vs execFile; argv).
- DropZone advisory copy beyond the locked lead + routing phrases.
- Bulk-button labels (planner can refine "Expand all" / "Collapse all").
- Optional 'Open File…' button on the DropZone advisory.
- Diagnosis-spike script vs in-app exploration for TOOLTIP-01.
- Bulk-button disabled-state behavior when `summary.animations.count === 0`.
- Whether elevation cache invalidates on window-focus events (it should not — token can't change mid-life).

## Deferred Ideas

Captured in CONTEXT.md `<deferred>`:
- Lift Animation Breakdown collapse-state to AppShell (cross-tab persistence) — v1.4 candidate.
- 'Relaunch unprivileged' button — UAC token manipulation; defer until friction reported.
- Two-persistent-buttons or segmented-control source toggle — revisit if menu is hard to discover.
- Re-probe elevation on window focus — not needed; documented for plan-time clarity.
- Native DOM Tooltip API or floating-ui port — defer until a third tooltip regression.

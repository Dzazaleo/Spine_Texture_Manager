# Phase 31: Loader & UX small-fixes batch — Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Four independent UX papercut closures bundled per granularity calibration. Each is a renderer-only or main-process-only diff slice with no cross-dependency on the others.

**In scope:**
1. **LOAD-05..07 — Source-toggle disable + tooltip.** When the loaded project's folder lacks the alternate source (no `.atlas` file, or no `images/` folder), the source-toggle menu item at [AppShell.tsx:1735-1773](src/renderer/src/components/AppShell.tsx#L1735-L1773) renders disabled (greyed/non-interactive) with a native HTML `title` tooltip explaining why it's unavailable. Filesystem state (`hasAtlasFile`, `hasImagesDir`) is probed in `src/main/summary.ts` via `fs.existsSync` adjacent to `skeletonPath` and threaded through `SkeletonSummary` end-to-end.
2. **PANEL-08..11 — Animation Breakdown collapse defaults + bulk Expand all/Collapse all.** Default seed for `userExpanded` flips from `new Set(['setup-pose'])` to `new Set()` at [AnimationBreakdownPanel.tsx:344-346](src/renderer/src/panels/AnimationBreakdownPanel.tsx#L344-L346). Setup Pose stays first card (sort-pinned per PANEL-11), only its default-expanded behavior changes. Two `h-8` toolbar-style bulk buttons added inside the panel header. Search auto-expand behavior at lines 376-382 preserved verbatim.
3. **PLATFORM-01 — Windows admin DnD fallback.** Detect elevation at app startup in `src/main/` via one-shot `net session` exec; result cached in module-level boolean and exposed to renderer via IPC + preload bridge. When elevated on Windows, [DropZone.tsx](src/renderer/src/components/DropZone.tsx) renders disabled and displays inline advisory copy routing the user to File → Open or to relaunch unprivileged. macOS + Linux behavior unchanged.
4. **TOOLTIP-01 — ExtrapolationIcon hover tooltip regression.** Up-arrow icon at [ExtrapolationIcon.tsx](src/renderer/src/components/icons/ExtrapolationIcon.tsx) (rendered when `row.peakScale > 1` at [GlobalMaxRenderPanel.tsx:573](src/renderer/src/panels/GlobalMaxRenderPanel.tsx#L573) and [AnimationBreakdownPanel.tsx:799](src/renderer/src/panels/AnimationBreakdownPanel.tsx#L799)) regressed: hover surfaces the parent `<td title="...">` instead of the SVG `<title>` child. Diagnosis spike runs first; fix shape branches by what the diagnosis surfaces.

**Out of scope:**
- New Spine math or sampler changes (`project_sampler_visibility_invariant.md` invariant preserved).
- `.stmproj` schema changes — Animation Breakdown collapse state is per-session in-memory React state only (PANEL-09 lock; supersedes Phase 28/30 persistence precedent).
- UIPI message-filter workaround for Windows admin DnD (Microsoft-discouraged for security; deliberately not pursued — fallback message is the contract per REQUIREMENTS.md Out of Scope).
- Auto-update changes — PLATFORM-01 fix does not touch updater paths.
- Linux testing / AppImage UAT (still host-blocked; Linux dropped from CI in v1.3).
- Lifting collapse-state to AppShell to persist across Global ↔ AB tab-switches (PANEL-09 reset-on-load is the only required reset behavior; tab-switch-also-resets is a byproduct of the existing conditional-render at [AppShell.tsx:2018-2040](src/renderer/src/components/AppShell.tsx#L2018-L2040), accepted as is).
- 'Relaunch unprivileged' action button (text-only routing; Windows UAC token-manipulation is non-trivial and out of scope for v1.3.1).
- Refactoring the source-toggle to two-persistent-buttons or segmented control (single-button-menu is preserved; only the disabled state is new).

</domain>

<decisions>
## Implementation Decisions

### Sub-feature A — Source-toggle disable + tooltip (LOAD-05..07)

- **A-D-01:** **Filesystem probe in `src/main/summary.ts`.** Add `hasAtlasFile: boolean` + `hasImagesDir: boolean` to `SkeletonSummary` ([src/shared/types.ts:683-758](src/shared/types.ts#L683-L758)), populated via `fs.existsSync(path.join(dirname(skeletonPath), '<name>.atlas'))` and `fs.existsSync(path.join(dirname(skeletonPath), 'images'))`. Atomic with the summary build — naturally re-queried on every load and resample. No new IPC endpoint. Layer 3 invariant preserved (FS probe lives in `src/main/`, not `src/core/`).
  - The `.atlas` filename to probe should follow the same sibling-discovery rule as `src/core/loader.ts` F1.2 path (look for `<basename>.atlas` next to the JSON, then any `*.atlas` in the same dir as fallback). Planner finalizes the exact probe shape using the existing F1.2 logic as reference.
- **A-D-02:** **Keep single-button menu shape, grey out the menu item.** The existing context-menu UX at [AppShell.tsx:1735-1773](src/renderer/src/components/AppShell.tsx#L1735-L1773) is preserved. The menu still opens, but the single 'Use X as Source' menu-item renders disabled when the alt source is absent on disk. Smallest diff; preserves user-familiar UX rhythm; does not refactor to two-persistent-buttons or segmented control.
- **A-D-03:** **Native HTML `title` attribute on the disabled menu item.** Smallest diff; consistent with how OptimizeDialog tooltips are wired ([OptimizeDialog.tsx:457](src/renderer/src/modals/OptimizeDialog.tsx#L457) precedent). Not virtualized like DimsBadge was, so the native-title hover-reliability concern that drove DimsBadge's React-managed primitive doesn't apply here. Disabled-button hit area is generous enough that `title` fires reliably.
- **A-D-04:** **Tooltip copy locked verbatim per ROADMAP.** "No .atlas file found in this project's folder" / "No images/ folder found in this project's folder". Matches REQUIREMENTS.md LOAD-07 acceptance text exactly — no ambiguity for the verifier.

### Sub-feature B — Animation Breakdown collapse + bulk buttons (PANEL-08..11)

- **B-D-01:** **Bulk buttons inside panel header.** Add 'Expand all' + 'Collapse all' to the existing `<header>` at [AnimationBreakdownPanel.tsx:423-445](src/renderer/src/panels/AnimationBreakdownPanel.tsx#L423-L445). Right-aligned next to the `{N} animations` count. Inherits Phase 26.x `h-8` toolbar button style + button-token classes verbatim (literal Tailwind v4 strings; Pitfall 8 discipline). Visible only when AB tab is active. No cross-cut into AppShell or sub-toolbar.
- **B-D-02:** **Search auto-expand behavior preserved unchanged.** `effectiveExpanded = userExpanded ∪ (cards-with-matches)` at [AnimationBreakdownPanel.tsx:376-382](src/renderer/src/panels/AnimationBreakdownPanel.tsx#L376-L382) stays as-is. PANEL-08 default-collapsed only changes the seed of `userExpanded` from `new Set(['setup-pose'])` to `new Set()` at line 344. The doc-comment block at lines 24-27 (search-as-discovery affordance) remains accurate.
- **B-D-03:** **Reset on project load only — by virtue of panel unmount.** Collapse state lives in panel-internal `useState` (line 344). The panel is conditionally rendered in [AppShell.tsx:2018-2040](src/renderer/src/components/AppShell.tsx#L2018-L2040) by `activeTab`, so tab-switching also unmounts and resets. Acceptable byproduct: the user may be surprised that switching to Global and back collapses cards. Not lifting state to AppShell for v1.3.1 (PANEL-09 only requires reset-on-reload; tab-switch reset is unspecified and the simplest implementation gets it for free).
- **B-D-04:** **Bulk buttons act on all cards regardless of search-active state.** 'Expand all' → `setUserExpanded(new Set(allCardIds))`; 'Collapse all' → `setUserExpanded(new Set())`. Bulk actions are absolute, not filter-scoped. Search auto-expand union logic (B-D-02) continues to overlay matched-cards on top during active search. After clearing search, the user sees the absolute state they last bulk-set.
- **B-D-05:** **Setup Pose `cardId === 'setup-pose'` sort-position preserved.** PANEL-11 acceptance: still first in the sort order. The flip is purely on the initial expansion seed (line 344). No code-path changes the card's position in `summary.animationBreakdown`.

### Sub-feature C — Windows admin DnD fallback (PLATFORM-01)

- **C-D-01:** **`net session` probe at startup.** On `process.platform === 'win32'`, exec `net session` once at app boot via `child_process.exec` (or `execFile` to avoid shell quoting). Exit code 0 → elevated; non-zero → not elevated. ~50-100ms one-shot. Result cached in a module-level boolean; exposed to renderer via IPC + preload bridge. On any error, default to non-elevated (safe default — user gets the working DnD UX). No new npm dep; existing `child_process` is sufficient. macOS + Linux skip the probe entirely (default false).
- **C-D-02:** **Inline DropZone replacement on `idle` AppState.** When `isElevated && process.platform === 'win32'`, [DropZone.tsx](src/renderer/src/components/DropZone.tsx) renders with `onDragEnter`/`onDragOver`/`onDrop` handlers omitted (or no-op'd), `isDragOver` ring suppressed, and the empty-state body content replaced with the advisory copy. Visible only on `idle` AppState (the `loaded` / `projectLoaded` states have no drop targets, so nothing to disable post-load). The existing `loaderModeHealedNotice` pattern at [AppShell.tsx:1949](src/renderer/src/components/AppShell.tsx#L1949) is the reference for status-bar-level inline notices, but DropZone-internal replacement is the chosen surface.
- **C-D-03:** **Text-only routing copy.** Body content reads (planner finalizes exact wording at write-time, with these constraints):
  - Lead: "Drag-and-drop is unavailable while running as administrator."
  - Routing: "Use File → Open instead, or relaunch the app without administrator privileges."
  - No 'Relaunch unprivileged' button (Windows UAC token-manipulation is non-trivial; out of scope for v1.3.1).
  - No inline 'Open File…' button (planner discretion — adding one is fine, but not required by REQUIREMENTS.md).
- **C-D-04:** **Test scope: unit-test the elevation flag → renderer chain in jsdom; live-OS verification deferred to host UAT.** Inject `isElevated: true` directly into the IPC payload in vitest; assert DropZone renders disabled with advisory copy. The actual `net session` exec → elevated boolean is platform-specific and runs only on Windows; documented as a host-blocked HUMAN-UAT item (mirrors Phase 13.1 / 14 / 15 lifecycle pattern). Optional: also vitest-mock `child_process.exec` to assert the exit-code → boolean mapping works (planner discretion; not required).
- **C-D-05:** **Defensive no-ops on macOS + Linux.** The elevation IPC + preload bridge MUST exist on all platforms (renderer bundle is platform-agnostic), but the main-side handler short-circuits to `isElevated: false` when `process.platform !== 'win32'`. No `net session` exec runs on non-Windows. Renderer never shows the advisory copy on macOS or Linux.

### Sub-feature D — ExtrapolationIcon tooltip regression (TOOLTIP-01, NEW REQ-ID)

- **D-D-01:** **Diagnosis-first; fix-shape branches by result.** Per memory `feedback_narrow_before_fixing.md` (cheap diagnostic before scoping a fix; confirmed twice 2026-05-06): plan a minimal repro spike before designing the fix. Steps documented for the planner:
  1. Run `npm run dev`. Load a fixture with `peakScale > 1` rows (e.g. complex rig in `fixtures/Girl/`); confirm the up-arrow icon renders next to a Peak W×H value in both Global and Animation Breakdown panels.
  2. Hover the icon. Capture which tooltip surfaces:
     - SVG `<title>` content ("Spine rig peak: X.XX× source — export capped at canonical") → no regression; investigate further.
     - Parent TD `title` content ("World AABB at peak: X×Y • double-click to override") → confirms the regression hypothesis.
     - Neither → different bug class (z-index, pointer-events, hover-target reach).
  3. DevTools inspect: confirm SVG `<title>` child element is in the live DOM (not stripped by React or Tailwind preflight).
  4. Diagnostic isolation: temporarily remove the parent TD `title` attribute; verify SVG title fires.
- **D-D-02:** **Fix-shape candidates documented for the planner (post-diagnosis):**
  - **Most-likely fix (a):** Suppress parent TD `title` when `row.peakScale > 1`. Move the TD's "World AABB at peak…" text to an aria-label or to a different cell. Tradeoff: loses the TD hover info on rows with the icon.
  - **Belt-and-suspenders (b):** Wrap the icon in a `<span title="…">` matching the SVG `<title>` text — gives the hover-target a title attr at every ancestor depth.
  - **Bulletproof port (c):** Replace the browser-native tooltip mechanism with the React-managed primitive used by [DimsBadge.tsx](src/renderer/src/components/DimsBadge.tsx) (`createPortal` + `position:fixed` from `getBoundingClientRect`). Bigger diff but eliminates all browser hover-resolution conflicts. Reuse-friendly if other icons regress later.
  - Planner picks based on what the diagnosis surfaces. The existing comment in [ExtrapolationIcon.tsx:8-22](src/renderer/src/components/icons/ExtrapolationIcon.tsx#L8-L22) explicitly claims SVG `<title>` wins — the regression invalidates that claim, so the comment must be updated regardless of which fix-shape lands.
- **D-D-03:** **REQ-ID: TOOLTIP-01.** New `## TOOLTIP — Icon Tooltip Reliability` section under Active Requirements in REQUIREMENTS.md. Acceptance text: "On the Peak W×H cell, when the row's peakScale > 1, the ExtrapolationIcon's tooltip ('Spine rig peak: X.XX× source — export capped at canonical') surfaces on hover, taking precedence over any parent cell tooltip. Holds across both Global Max Render Source panel and Animation Breakdown panel."
- **D-D-04:** **Symmetric verification across both panels.** GlobalMaxRenderPanel and AnimationBreakdownPanel both render the icon — fix MUST land in both call sites or in the shared component. Phase 22.1 D-04 sibling-symmetry discipline applies: extract any wrapper changes into a single component file (mirrors the `WarningTriangleIcon` precedent from Phase 26.2 D-06) so the two panels share one source of truth.

### Claude's Discretion

- Exact `net session` invocation (`exec` vs `execFile`; argv shape; error capture) — planner picks idiomatic `child_process` style.
- Exact wording of the DropZone advisory copy beyond the locked lead + routing phrases (C-D-03).
- Bulk-button labels — "Expand all" / "Collapse all" suggested but planner can refine.
- Whether to add an inline 'Open File…' button to the DropZone advisory (C-D-03 says optional).
- Diagnosis-spike script vs in-app exploration for TOOLTIP-01 — planner picks lowest-friction option that yields the answer.
- Bulk-button disabled-state behavior when `summary.animations.count === 0` (panel is empty; bulk buttons probably hidden or disabled — planner picks).
- Whether elevation cache invalidates on window-focus events (Windows can't change a process's token mid-life, so a one-shot probe at startup is correct; mention in implementation plan that re-probe is not needed).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap, Requirements, Project Memory
- [`.planning/ROADMAP.md`](.planning/ROADMAP.md) lines 741-768 — Phase 31 detail block (Goal, Depends-on, Constraints to preserve, Success Criteria — load-bearing for the verifier). The TOOLTIP-01 inclusion will extend this block during the same commit that writes this CONTEXT.md.
- [`.planning/REQUIREMENTS.md`](.planning/REQUIREMENTS.md) lines 41-65 (LOAD-05..07, PANEL-08..11, PLATFORM-01 acceptance text) plus a new `## TOOLTIP` section + Traceability row added during this commit.
- [`.planning/PROJECT.md`](.planning/PROJECT.md) — Layer 3 invariant (no DOM/Electron/sharp in `src/core/`), `min-h-screen` AppShell anchor, `h-8` toolbar button style, hand-rolled ARIA modals.
- [`CLAUDE.md`](CLAUDE.md) — Spine 4.2 facts, sampler lifecycle, `core/` is pure TS.

### Project-level memory (load-bearing for this phase)
- `feedback_narrow_before_fixing.md` — diagnose before scoping a fix (TOOLTIP-01 D-D-01 spike).
- `feedback_layout_bugs_request_screenshots_early.md` — for any iteration on the tooltip fix that doesn't behave as predicted, request a screenshot before continuing speculative-fix loops.
- `project_layout_fragility_root_min_h_screen.md` — `min-h-screen` is load-bearing on AppShell root; PLATFORM-01 inline DropZone replacement must not regress this.
- `project_strict_loadermode_separation.md` — atlas-source vs atlas-less self-contained; LOAD-05..07 surfaces this distinction at the UI but does not change the loader's branch order.
- `project_sampler_visibility_invariant.md` — sampler measures all skin-declared attachments verbatim; not touched in this phase.

### Phase Locus — Sub-feature A (Source toggle)
- [`src/renderer/src/components/AppShell.tsx`](src/renderer/src/components/AppShell.tsx) lines 1735-1773 — current source-toggle button + dropdown menu. Disabled-state rendering goes here.
- [`src/shared/types.ts`](src/shared/types.ts) lines 683-758 — `SkeletonSummary` interface; new `hasAtlasFile: boolean` + `hasImagesDir: boolean` fields land here.
- [`src/main/summary.ts`](src/main/summary.ts) — `buildSummary` populates the new fields via `fs.existsSync` (Layer 3 safe — main process, not core).
- [`src/core/loader.ts`](src/core/loader.ts) lines 219-254 — F1.2 sibling auto-discovery branch order; the `.atlas` probe rule should mirror the same precedence (`<basename>.atlas` first, then any `*.atlas` in the dir).
- [`src/renderer/src/modals/OptimizeDialog.tsx`](src/renderer/src/modals/OptimizeDialog.tsx) line 457 — native `title=` precedent for tooltip placement.

### Phase Locus — Sub-feature B (Animation Breakdown collapse + bulk)
- [`src/renderer/src/panels/AnimationBreakdownPanel.tsx`](src/renderer/src/panels/AnimationBreakdownPanel.tsx) line 344 — `useState<Set<string>>(new Set(['setup-pose']))` seed → flip to `new Set()`.
- [`src/renderer/src/panels/AnimationBreakdownPanel.tsx`](src/renderer/src/panels/AnimationBreakdownPanel.tsx) lines 376-382 — search auto-expand union logic (preserve unchanged).
- [`src/renderer/src/panels/AnimationBreakdownPanel.tsx`](src/renderer/src/panels/AnimationBreakdownPanel.tsx) lines 423-445 — header element where bulk buttons get added.
- [`src/renderer/src/panels/AnimationBreakdownPanel.tsx`](src/renderer/src/panels/AnimationBreakdownPanel.tsx) lines 24-27 — doc-comment about search-as-discovery (still accurate after PANEL-08).
- [`src/renderer/src/components/AppShell.tsx`](src/renderer/src/components/AppShell.tsx) lines 2018-2040 — conditional render by `activeTab` (the unmount-on-tab-switch byproduct that gives B-D-03 reset-on-load for free).
- Phase 26.1 / 26.2 PR commits — `h-8` button style + button-token classes (literal Tailwind v4 strings).

### Phase Locus — Sub-feature C (Windows admin DnD)
- [`src/renderer/src/components/DropZone.tsx`](src/renderer/src/components/DropZone.tsx) full file — DnD entry point; only `<div>` in the renderer with `onDragEnter`/`onDragOver`/`onDrop` handlers.
- [`src/main/index.ts`](src/main/index.ts) — app-boot sequence; new elevation probe runs once before the BrowserWindow is created (so the renderer can read the cached value via IPC at mount).
- [`src/main/ipc.ts`](src/main/ipc.ts) — IPC channel registration (new `'platform:isElevated'` query channel).
- [`src/preload/index.ts`](src/preload/index.ts) — bridge for `window.api.isElevated()` (or via mount-time IPC payload).
- [`src/renderer/src/App.tsx`](src/renderer/src/App.tsx) — top-level state machine; passes `isElevated` to AppShell which passes to DropZone (or renderer reads at mount via the preload bridge).
- [`src/renderer/src/components/AppShell.tsx`](src/renderer/src/components/AppShell.tsx) line 1949 — `loaderModeHealedNotice` pattern (reference for status-bar-level inline notices).

### Phase Locus — Sub-feature D (TOOLTIP-01)
- [`src/renderer/src/components/icons/ExtrapolationIcon.tsx`](src/renderer/src/components/icons/ExtrapolationIcon.tsx) — the icon component; SVG `<title>` child rendering. Comment block at lines 8-22 must be updated to reflect actual behavior post-fix.
- [`src/renderer/src/panels/GlobalMaxRenderPanel.tsx`](src/renderer/src/panels/GlobalMaxRenderPanel.tsx) lines 558-577 — TD `title` + ExtrapolationIcon conflict site #1.
- [`src/renderer/src/panels/AnimationBreakdownPanel.tsx`](src/renderer/src/panels/AnimationBreakdownPanel.tsx) lines 798-803 — TD `title` + ExtrapolationIcon conflict site #2.
- [`src/renderer/src/components/DimsBadge.tsx`](src/renderer/src/components/DimsBadge.tsx) — React-managed tooltip primitive (Phase 22.1 G-02). Reuse candidate if diagnosis points to fix-shape (c).
- [`src/renderer/src/components/icons/WarningTriangleIcon.tsx`](src/renderer/src/components/icons/WarningTriangleIcon.tsx) — Phase 26.2 D-06 sibling-symmetry precedent (single source of truth for shared icon).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`SkeletonSummary` IPC envelope** ([src/shared/types.ts:683-758](src/shared/types.ts#L683-L758)) — already structured-clone-safe, already plumbed end-to-end (main → preload → AppShell → panels). Adding two boolean fields is a low-risk additive change with no version bump.
- **`fs.existsSync` probe pattern** — already used by `src/core/loader.ts` F1.2 sibling auto-discovery; mirrors directly in `src/main/summary.ts`.
- **Native HTML `title` tooltip** — used at OptimizeDialog.tsx:457 (Phase 30 buffer-tooltip precedent). Same pattern works for the disabled source-toggle menu item.
- **DimsBadge React-managed tooltip primitive** ([src/renderer/src/components/DimsBadge.tsx](src/renderer/src/components/DimsBadge.tsx)) — `createPortal` + `position:fixed` + `getBoundingClientRect` approach. Reuse candidate for TOOLTIP-01 fix-shape (c).
- **`h-8` toolbar button class string** — present at AppShell.tsx:1791, 1803, 1811. Bulk Expand/Collapse buttons inherit verbatim (literal Tailwind v4 strings; Pitfall 8 discipline).
- **`loaderModeHealedNotice` inline-banner pattern** ([AppShell.tsx:1944-1958](src/renderer/src/components/AppShell.tsx#L1944-L1958)) — reference for inline status messages, though PLATFORM-01 puts the message inside DropZone's body instead.
- **`ChildProcess.exec`** — already in dev-dependencies via Electron's main-process Node runtime; no new npm dep needed for `net session`.

### Established Patterns

- **Layer 3 invariant** ([tests/arch.spec.ts](tests/arch.spec.ts)) — locks `src/core/*` against DOM/Electron/sharp imports. All four sub-features comply: A's FS probe lives in `src/main/`, B is renderer-only, C's elevation detection lives in `src/main/`, D is renderer-only.
- **Phase 28/30 additive `.stmproj` field pattern** — explicitly NOT used here. PANEL-09 forbids persistence of collapse state. The `.stmproj` v1 schema is unchanged in this phase.
- **Hand-rolled ARIA modals** — not invoked here (no new modal). DropZone advisory copy is non-modal inline text.
- **Sibling-symmetry single-source component** — Phase 22.1 D-04 (DimsBadge) and Phase 26.2 D-06 (WarningTriangleIcon) both extracted to single-file shared components. TOOLTIP-01 fix follows the same discipline if the fix changes the icon's tooltip-rendering shape.
- **CLI byte-for-byte unchanged** (D-102) — none of the four sub-features touch CLI output. `summary.peaks` shape is unchanged; the new `SkeletonSummary.hasAtlasFile` / `hasImagesDir` fields are renderer-facing and can be omitted from the CLI table dump if needed (they describe the project folder, not the rig).

### Integration Points

- **Main → Renderer IPC:**
  - Extend `SkeletonSummary` (existing IPC return) with two new boolean fields. No new channel needed.
  - New IPC for elevation: `'platform:isElevated' → boolean`. Or include `isElevated` in an existing app-bootstrap payload (e.g. as a one-time read at App.tsx mount). Planner picks; preload bridge needs the matching `window.api.*` method.
- **Renderer state plumbing:**
  - AppShell consumes `summary.hasAtlasFile` + `summary.hasImagesDir`. Source-toggle menu item reads these directly to compute its disabled state.
  - `isElevated` flag plumbs from App.tsx → AppShell → DropZone (or DropZone reads via context / direct preload call). Smallest diff: pass through props.
- **Filesystem probes:**
  - `src/main/summary.ts` runs `fs.existsSync` at summary build time. Adds 1-2 syscalls per load. Negligible cost vs the existing summary build (~hundreds of ms).
- **Cross-panel symmetry:**
  - Bulk Expand/Collapse buttons live only in AnimationBreakdownPanel; GlobalMaxRenderPanel doesn't need them (no expandable cards).
  - TOOLTIP-01 fix is shared component (ExtrapolationIcon) — both panels inherit the fix automatically.

</code_context>

<specifics>
## Specific Ideas

- **Diagnostic spike for TOOLTIP-01:** the user noted "we dealt with this issue before" — confirmed by the doc-comment in ExtrapolationIcon.tsx:8-22 that claims SVG `<title>` reliably wins. Plan accordingly: this is the second known regression of the same surface. Consider whether fix-shape (c) — porting to the DimsBadge React-managed primitive — is the right "stop the regression-recurrence" move, even though it's a bigger diff. Decision deferred to post-diagnosis at planning time.
- **DropZone advisory copy** must mention BOTH the routing options ("Use File → Open" + "relaunch unprivileged") in a single sentence per REQUIREMENTS.md PLATFORM-01 ("routes the user to File → Open or recommends relaunching unprivileged"). Do not split into two paragraphs or two bullets — the requirement reads as a single coherent advisory.
- **Bulk button positioning:** must NOT collide with the existing `{N} animations` count text (line 442-444). Right-align both into a single flex group. Order suggestion: count → 'Expand all' → 'Collapse all' (label width matters less than visual balance).

</specifics>

<deferred>
## Deferred Ideas

- **Lift Animation Breakdown collapse-state to AppShell** — would preserve user's open cards across Global ↔ AB tab-switches. Not in scope for v1.3.1 (PANEL-09 only requires reset-on-reload). Capture for v1.4 if HUMAN-UAT surfaces it as a friction point.
- **'Relaunch unprivileged' button on the Windows admin advisory** — token-manipulation under UAC is non-trivial. Defer until a real user reports the manual close+reopen cycle as friction.
- **Two-persistent-buttons or segmented-control source toggle** — A-D-02 explicitly chose the smallest-diff path. If post-v1.3.1 UX feedback says the menu is hard to discover, revisit as part of a broader Loader UX revisit in v1.4.
- **Re-probe elevation on window focus / restore** — Windows can't change a process's token mid-life, so the one-shot probe at startup is correct. No deferred work item; mention in plan to head off "shouldn't we re-probe?" planner-questions.
- **Native ExtrapolationIcon tooltip via DOM Tooltip API (HTML `<dialog popover>`) or floating-ui** — modern alternatives to SVG `<title>` and React-managed primitives. Defer until a third tooltip regression surfaces (or we add a fourth icon type to the panels).

</deferred>

---

*Phase: 31-loader-ux-small-fixes-batch*
*Context gathered: 2026-05-08*

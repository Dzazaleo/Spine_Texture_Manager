# Phase 9: Complex-rig hardening + polish — Context

**Gathered:** 2026-04-26
**Status:** Ready for planning
**Source:** `/gsd-discuss-phase 9` interactive session
**Diff base:** HEAD of `feat/save-load-project-state` (post-08.2 close-out, commit `eb97923`)

---

<domain>
## Phase Boundary

Phase 9 hardens performance for production-scale rigs and applies the polish items the v1 MVP needs to feel finished. ROADMAP.md (`.planning/ROADMAP.md` lines 333–348) names **five** deliverables:

1. UI virtualization for long tables.
2. Sampler worker thread (ROADMAP language: "if profiling shows main-thread jank" — overridden by **D-190**: built unconditionally).
3. Sampling-rate setting in a Settings modal.
4. Rig-info tooltip showing the JSON's `skeleton.fps` (metadata-only, clearly labeled non-authoritative).
5. Documentation button wired to an in-app help view.

The single hard exit criterion is **N2.2**: `fixtures/Girl` (the chosen complex-rig baseline — D-189) must sample in under 10 seconds **and** produce no dropped UI frames during sampling. The four polish deliverables (Settings modal / rig-info tooltip / documentation button / virtualization on small rigs) are scoped to "ship-quality" not "perf-critical" and are defaulted to planner discretion (see Claude's Discretion below) per the user's choice to focus discussion on the perf core.

Phases 0–8.2 LOCKED. Sampler math (`src/core/sampler.ts`) byte-frozen by D-102 — the worker wraps `sampleSkeleton`, it does not modify it. CLI (`scripts/cli.ts`) byte-frozen by D-102. `.stmproj` v1 schema (`src/core/project-file.ts`) unchanged — `samplingHz` field already exists and persists per Phase 8 D-146. Layer 3 invariant intact: `src/core/*` gets no new code; the worker lives in `src/main/sampler-worker.ts` per the image-worker pattern.

**In scope:**

- **`src/main/sampler-worker.ts`** — new. Node `worker_threads` worker. Receives `{ skeletonPath, atlasRoot, samplingHz }` over postMessage; calls `loadSkeleton` + `sampleSkeleton` inside the worker; emits `{ type: 'progress', percent }` events ~every 100 attachments processed; supports a `'cancel'` message that aborts mid-sample by checking a flag at attachment-loop boundaries and returning `{ type: 'cancelled' }`; emits `{ type: 'complete', output: SamplerOutput }` on success or `{ type: 'error', error: SerializableError }` on failure. **Path-based protocol per D-193 — the worker re-loads the JSON inside the worker process** so that `SkeletonData` (Spine class instances with circular refs) never crosses the postMessage boundary.
- **`src/main/sampler-worker-bridge.ts`** (or inlined in `project-io.ts` — planner's call) — new. Spawns the worker, wires progress + cancel + complete/error messages back to `project-io.ts`'s existing entry points. Replaces the direct `sampleSkeleton(load, { samplingHz })` call sites in `src/main/project-io.ts:440` and `:641`.
- **`src/main/ipc.ts`** — touched. New one-way channel `'sampler:progress'` (main → renderer; payload `{ percent: number }`); new one-way channel `'sampler:cancel'` (renderer → main; no payload). Mirrors the Phase 6 image-worker pattern: `'export:progress'` + `'export:cancel'`.
- **`src/preload/index.ts`** — touched. Two new methods on the `Api` surface:
  - `onSamplerProgress: (cb: (percent: number) => void) => () => void` — listener-identity preservation per Pitfall 9 (mirror of `onExportProgress`).
  - `cancelSampler: () => void` — fire-and-forget `ipcRenderer.send('sampler:cancel')`.
- **`src/renderer/src/components/AppShell.tsx`** — touched. New `useEffect` registers `window.api.onSamplerProgress` while a sample is in flight; new sampling-spinner / progress-bar UI surfaces the percent. Cancel hook (e.g., on project-open mid-sample, on app close, on user-explicit abort) calls `window.api.cancelSampler()`. The `samplingHz` prop threading at lines 71/114/477/485/506 stays unchanged.
- **`src/renderer/src/panels/GlobalMaxRenderPanel.tsx`** (778 lines) — touched. **TanStack Virtual** (`@tanstack/react-virtual`) row virtualization with **threshold N=100** (D-191/D-195): when `rows.length > 100`, render via virtualizer; below the threshold, render the existing flat-table JSX unchanged. Sticky header, sort, search, and per-row checkbox semantics preserved.
- **`src/renderer/src/panels/AnimationBreakdownPanel.tsx`** (578 lines) — touched. **Per-card row-list virtualization only** (D-196): the outer list of animation cards stays in regular DOM (a complex rig has ~16 cards — cheap). Inside each expanded card, when `card.rows.length > 100`, the inner row list virtualizes via TanStack Virtual. Card-collapse state and accordion UX untouched.
- **`package.json`** — `@tanstack/react-virtual` added as a runtime dependency (D-192). One of the rare external-library exceptions justified by the well-known fiddly-edge-case profile of hand-rolled virtualization (sticky headers, scroll restoration on sort, keyboard nav, variable-height items).
- **Settings modal (samplingHz exposure)** — planner discretion (see Claude's Discretion). Minimum: a Settings modal with a samplingHz control (dropdown 60/120/240 + custom number, validates positive int, default 120 per CLAUDE.md fact #6). Lives in the menu surface from 08.2 D-188.
- **Rig-info tooltip** — planner discretion (see Claude's Discretion). Minimum: tooltip on the toolbar filename chip (Phase 8 D-144 surface) showing `skeleton.fps` extracted from `loader.ts:225-229` plus bones / slots / animations counts already available, with `skeleton.fps` clearly labeled as `(editor metadata — does not affect sampling)`.
- **Documentation button** — planner discretion (see Claude's Discretion). Minimum: a Help-menu item (08.2 placeholder per D-188) and/or a toolbar button that opens a single-page in-app help view (modal or new BrowserWindow). Static markdown shipped in repo.
- **Tests:**
  - `tests/main/sampler-worker.spec.ts` — new. Cases: (a) worker spawns, runs sampleSkeleton on the SIMPLE_PROJECT golden fixture, returns byte-identical output to direct in-thread `sampleSkeleton`; (b) progress events fire monotonically and reach 100% on completion; (c) cancellation mid-sample stops the worker within ≤200 ms and returns `{ type: 'cancelled' }`; (d) error path — worker reports `{ type: 'error', error }` cleanly when the skeleton path is missing; (e) hygiene grep — `src/main/sampler-worker.ts` does not import anything from `src/renderer/`.
  - `tests/main/sampler-worker-girl.spec.ts` — **new, the N2.2 gate**. Runs the worker against `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` and asserts wall time < 10000 ms. Planner may mark this `.skipIf(env.CI)` if Girl-fixture CI runtime variance is too noisy, but at minimum it must run on local `npm run test`.
  - `tests/renderer/global-max-virtualization.spec.tsx` — new. Cases: (a) below threshold (50 rows) the flat-table path renders all rows (rendered DOM count == rows count); (b) above threshold (200 rows) the virtualized path renders only a window of rows (DOM count << rows count); (c) sort + search + per-row checkbox still function in the virtualized path; (d) sticky header stays at top during scroll.
  - `tests/renderer/anim-breakdown-virtualization.spec.tsx` — new. Cases: (a) outer card list renders all cards in regular DOM; (b) expanded card with rows > 100 virtualizes its inner row list; (c) collapse + re-expand preserves scroll position inside the virtualized inner list (or resets cleanly — planner picks the policy and tests it); (d) `Override Scale` button still mounts OverrideDialog from a virtualized inner row.
  - `tests/main/ipc.spec.ts` — extension. `'sampler:progress'` event emit + `'sampler:cancel'` handler registration.
  - `tests/arch.spec.ts` — auto-extends to grep `src/main/sampler-worker.ts` for Layer 3 violations (no DOM imports).

**Out of scope (deferred, not landing in Phase 9):**

- **OS file-association registration** (.stmproj double-click in Finder/Explorer opens the app) — 08.2 routed it to Phase 9 polish, but the user's discussion-area selection (Performance only) implicitly defers it. Stays deferred to post-MVP polish phase or at-installer-time when packaging is hardened.
- **"Reopen last project on launch"** — same. Recent-list machinery from 08.2 is in place; the policy decision is deferred.
- **Window state persistence (size + position)** — same. Standard Electron pattern, not in ROADMAP Phase 9 deliverables.
- **Auto-save / scratch-file crash recovery** — same. Significant scope; better as its own phase if the user wants it.
- **macOS Help-menu search integration** — comes free with `role: 'help'` (08.2 D-188); no work needed.
- **Native menu Quit-via-File→Exit on Win/Linux** — Cmd+Q via `role: 'appMenu'` already covers macOS; Win/Linux users have window-close + Alt+F4. Planner may add `role: 'quit'` as a one-line File→Exit item if trivial; otherwise out.
- **Adaptive bisection refinement** (ROADMAP "Deferred (post-MVP)").
- **`.skel` binary loader** (REQUIREMENTS.md "Out of scope" + ROADMAP "Deferred").
- **Spine 5+ loader adapter** (ROADMAP "Deferred").
- **Aspect-ratio anomaly flag** when scaleX != scaleY at peak (ROADMAP "Deferred").
- **In-app atlas re-packing** (writing a new `.atlas` file — ROADMAP "Deferred").
- **CLI changes** — `scripts/cli.ts` byte-frozen (Phase 5 D-102).
- **Sampler math changes** — `src/core/sampler.ts` byte-frozen (Phase 5 D-102, CLAUDE.md fact #2/#3). Only the worker wrapper is new.
- **`.stmproj` v1 schema changes** — `src/core/project-file.ts` untouched. `samplingHz` already persists.
- **`src/core/loader.ts` changes** — none required. Worker calls `loadSkeleton` unchanged.
- **DropZone / Save/Load / SaveQuitDialog changes** — none.

</domain>

---

<decisions>
## Implementation Decisions

### Performance core: worker + virtualization (Area 1 — discussed)

- **D-189: `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` is the N2.2 baseline gate.** Largest in-repo fixture (~930 KB JSON, ~5× Jokerman, ~50× SIMPLE_PROJECT). Already committed and golden-testable; planner can baseline against it deterministically and write a wall-time test that runs on every local `npm run test`. A user-supplied real production rig may be added later as a stretch case, but Girl is the always-runnable gate. **Rejected:** user-supplied-only (gates phase signoff on user timeline; not CI-runnable); synthetic super-rig generator (more code to write; less representative of real rigs).

- **D-190: Build the sampler worker UNCONDITIONALLY — overrides ROADMAP's "if profiling shows main-thread jank" language.** Treat "no dropped UI frames during sampling" as a guarantee, not a measurement. Always offload `sampleSkeleton` to a `worker_threads` worker. Locks in headroom for the user's own production rigs (which are likely larger than fixtures/Girl) and removes a potential second-pass code change if profiling later shows jank. **Rejected:** profile-then-decide (defers a known-good engineering decision; risks a follow-up phase if Girl passes but user's rig doesn't); skip the worker and optimize the sampler hot loop in-thread (forbidden — sampler is byte-frozen by D-102).

- **D-191: Virtualize BOTH panels (GlobalMaxRender + AnimationBreakdown), threshold-gated at N=100 rows (D-195).** Below threshold: existing flat JSX (preserves Cmd-F text search, simpler DOM, zero virtualization overhead). Above threshold: TanStack Virtual takes over. SIMPLE_PROJECT (~3 attachments) and Jokerman stay unvirtualized; Girl crosses the threshold. **Rejected:** GlobalMax-only (skips the harder panel without a perf-data justification); always-on (50 ms-ish overhead on tiny rigs for no perceived gain).

- **D-192: TanStack Virtual (`@tanstack/react-virtual`) is the virtualization library.** Headless (renders nothing itself — keeps existing JSX), tiny (~6 KB gzipped), supports variable-height items (needed for AnimationBreakdown's collapsible inner row lists), modern React idioms (hooks, ref-based measurement). One of the rare external-library exceptions justified by hand-rolled virtualization's well-known fiddly edge cases (sticky headers, scroll restoration on sort, keyboard nav, variable-height items). **Rejected:** react-window (older, awkward variable-height API); hand-roll (matches project discipline but the edge-case surface is large enough that "reinvent for purity" is a bad trade here).

- **D-193: Sampler worker lives at `src/main/sampler-worker.ts` and uses a path-based protocol.** Mirrors the Phase 6 `image-worker.ts` pattern. Main passes `{ skeletonPath, atlasRoot, samplingHz }` to the worker over `postMessage`; the worker calls `loadSkeleton` + `sampleSkeleton` inside the worker thread and returns the SamplerOutput JSON. **No `SkeletonData` instance crosses the postMessage boundary** — Spine `SkeletonData` has class instances with circular references and would not serialize cleanly without custom (de)serialization code. Re-parsing the JSON inside the worker is cheap relative to the sampling cost. **Rejected:** serialized-data protocol (custom (de)serialization for `SkeletonData` is fragile); `src/core/sampler-worker.ts` (mixes orchestration with pure math; breaks the established Phase 6 pattern of workers in `main/`).

- **D-194: Worker emits progress events AND supports cancellation.** Progress: `postMessage({ type: 'progress', percent })` every ~100 attachments processed (or at a fixed dt — planner picks the cadence). Cancellation: a `'cancel'` message sets a flag the worker checks at the attachment-loop boundary; the worker returns `{ type: 'cancelled' }` and exits cleanly. Renderer subscribes via `window.api.onSamplerProgress` (preload, listener-identity preserved per Pitfall 9) and surfaces a determinate progress bar; cancellation fires when the user opens a different file mid-sample, or on app close, or via an explicit abort button (planner's call on the latter). Mirrors Phase 6's `'export:progress'` + `'export:cancel'` channels exactly. **Rejected:** progress-only (user can't recover from a multi-second sample they don't want); fire-and-forget (no UX feedback during a 5–10 s wait — feels frozen).

- **D-195: Virtualization threshold is N = 100 rows.** Above ~100 rows, naive React rendering starts measurably hitching on most hardware during sort/filter operations. Below 100, virtualization adds layout cost (`measureElement`) without a perceived gain, and breaks browser-native Cmd-F text search across the whole table. SIMPLE_PROJECT and Jokerman stay below the threshold; Girl crosses it. Planner may tune this if profiling shows a different inflection point. **Rejected:** N=50 (kicks in earlier but virtualization cost on 50-row tables is non-zero with low marginal smoothness gain); always-on (covered above).

- **D-196: AnimationBreakdownPanel virtualizes per-card inner row lists, NOT the outer card list.** Each animation card stays in regular DOM (a complex rig has ~16 cards — cheap to render). When a card is expanded and its inner row list exceeds threshold N=100 (D-195), that inner list virtualizes via TanStack Virtual. Card-collapse state and accordion UX stay simple; only the actual perf hot path (long row lists in expanded cards) gets virtualized. **Rejected:** virtualize the outer card list too (variable-height outer items — each card's height depends on collapse state — significantly harder and only relevant if a rig has 100+ animations, which is well outside MVP envelope); skip AnimationBreakdown virtualization entirely (contradicts D-191; user explicitly chose "both panels").

### Claude's Discretion (areas not discussed — planner picks reasonable defaults)

The user explicitly limited discussion to the performance core. The remaining three ROADMAP-named deliverables for Phase 9 default to planner discretion. **Suggested defaults** (planner may adjust during plan-phase if a different shape proves cleaner — but should NOT expand scope beyond what's listed below):

- **Settings modal (samplingHz exposure)** — Suggested shape: minimal modal with a single `samplingHz` control. Recommended UX: dropdown of presets `60 / 120 (default) / 240` plus a "Custom…" option that reveals a number input (positive integer, max 1000 to prevent typo-driven hangs). Validation: rejects non-positive or non-numeric. Persistence: **per-project** via the existing `.stmproj` v1 `samplingHz` field (Phase 8 D-146) — no new persistence layer. Menu placement: Edit → Preferences… on macOS, File → Settings… on Win/Linux, accelerator `Cmd/Ctrl+,` (macOS convention; Win/Linux convention is `Ctrl+,` in modern apps like VSCode). Trigger: menu item from 08.2 D-188 surface; optional toolbar gear icon if planner deems it discoverable enough without. Marks the project dirty (existing AppShell `samplingHz` change → dirty derivation per Phase 8 D-145 already handles this).

- **Rig-info tooltip** — Suggested shape: tooltip attached to the toolbar filename chip (Phase 8 D-144 surface — already a hover target for the dirty marker). Content: `skeletonName` / `bones: N` / `slots: N` / `attachments: N` / `animations: N` / `skins: N` / `skeleton.fps: N (editor metadata — does not affect sampling)`. The fps label is the critical UX call — must be unmistakable that sampling uses `samplingHz` (default 120), not `skeleton.fps`. Source: bones/slots/etc counts pulled from the existing `summary` shape; `skeleton.fps` from `loader.ts:225-229` (`skeletonData.fps || 30`). Implementation: any standard React tooltip pattern (CSS-only with `:hover`, or a Headless UI / Radix Tooltip primitive — planner picks; no new heavy dep needed).

- **Documentation button + in-app help view** — Suggested shape: single-page in-app help view, modal-style (mounts in renderer, no new BrowserWindow). Content: a single static markdown file shipped in repo (e.g., `src/renderer/src/help/README.md` rendered via a tiny markdown component or a precompiled HTML import). Sections: "What this app does" / "How to load a rig" / "Reading the Global Max Render Source panel" / "Reading the Animation Breakdown panel" / "How to override a scale" / "How to optimize and export" / "Sampling rate (advanced)". Triggers: Help menu item (fills the 08.2 D-188 placeholder) AND a "?" toolbar button. External-link items (e.g., link to spine-ts docs, project repo) open in the system browser via `shell.openExternal`.

- **08.2 deferred polish triage** — User did not select this area. Default: **none** of the 08.2-routed polish items land in Phase 9. They stay in the deferred list for a post-MVP polish phase. Specifically:
  - OS file association (.stmproj double-click) — deferred.
  - Reopen-last-project on launch — deferred.
  - Window state persistence (size + position) — deferred.
  - Auto-save / scratch-file crash recovery — deferred.
  - Native Quit-via-File→Exit on Win/Linux — deferred (Cmd+Q on macOS via `role: 'appMenu'` already works; Alt+F4 + window-close work on Win/Linux).
  - macOS Help-menu search integration — comes free with `role: 'help'`; not new work.

  Planner may revisit any of these during plan-phase if the user reopens the discussion. By default, scope stays at the five ROADMAP deliverables.

</decisions>

---

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth (project-level)

- `.planning/REQUIREMENTS.md` §N2 — N2.1 (simple rig <500 ms), **N2.2 (complex rig <10 s; the Phase 9 exit criterion)**, N2.3 (sampler hot loop does zero filesystem I/O — preserved by the worker since it does its own loadSkeleton inside the worker process).
- `.planning/ROADMAP.md` lines 333-348 §"Phase 9: Complex-rig hardening + polish" — the five deliverables + exit criteria + requirement coverage (N2.2 + usability polish).
- `.planning/PROJECT.md` §"Tech stack (locked)" + §"Key architectural decisions" — Layer 3 invariant (`core/` no DOM/Electron); Electron + TypeScript + React + Vite stack.
- `CLAUDE.md` §"Critical non-obvious facts" — **Fact #1** (`skeleton.fps` is editor dopesheet metadata — feeds rig-info tooltip's "(does not affect sampling)" label); **Fact #2** (`computeWorldVertices` after `updateWorldTransform(Physics.update)` handles all transforms — sampler logic is locked); **Fact #3** (sampler lifecycle order — locked); **Fact #5** (`core/` is pure TypeScript, no DOM — sampler-worker stays in `main/`); **Fact #6** (default sampling rate 120 Hz — Settings modal default).

### Prior phase context (decisions Phase 9 inherits)

- `.planning/phases/00-core-math-spike/00-CONTEXT.md` (and `00-04-PLAN.md`, `00-05-PLAN.md`) — sampler perf budget; the foundation of N2.2/N2.3.
- `.planning/phases/01-electron-react-scaffold/01-CONTEXT.md` — D-23 zero-Windows-specific code; D-24 electron-builder target-agnostic; `autoHideMenuBar: true` (Settings menu placement must respect this on Win/Linux).
- `.planning/phases/06-optimize-assets-image-export/06-CONTEXT.md` — **the canonical worker pattern Phase 9 mirrors**: `src/main/image-worker.ts` Node `worker_threads`; postMessage protocol; `'export:progress'` + `'export:cancel'` IPC channels (D-194 mirrors these for `'sampler:progress'` + `'sampler:cancel'`); preload `onExportProgress` listener-identity preservation (Pitfall 9 — D-194's `onSamplerProgress` mirrors).
- `.planning/phases/08-save-load-project-state/08-CONTEXT.md` — D-141 explicit save model; D-143 dirty-guard; **D-144** filename-chip dirty marker (rig-info tooltip attaches here); **D-145** dirty derivation includes `samplingHz` changes (Settings modal change auto-dirties); **D-146** `samplingHz` persists in `.stmproj` v1 with default 120 (Settings modal exposes the existing field — no schema change); D-156 hand-rolled type guard pattern (mirrored if Settings ever adds per-app persistence).
- `.planning/phases/08.1-close-phase-8-verification-gaps-locate-skeleton-recovery-rea/08.1-CONTEXT.md` — D-161/D-162 recovery banner state; D-163 `onBeforeDropRef` ref-bridge.
- `.planning/phases/08.2-cmd-o-blocked-during-error-state-discovered-in-08-1-uat-add-/08.2-CONTEXT.md` — **D-188** menu role conventions (Settings goes under Edit→Preferences on macOS / File→Settings on Win/Linux; Help menu placeholder is filled by Phase 9's documentation deliverable); **D-186** `autoHideMenuBar: true` stays; D-181 `'menu:notify-state'` IPC pattern (Settings menu item enable/disable rules follow this pattern); 08.2 deferred-items table (lines 332-352) — the source of the "08.2 polish triage" gray area.

### Source code touchpoints

#### Sampler worker (D-190, D-193, D-194)

- `src/core/sampler.ts:58-141` — `sampleSkeleton` entrypoint. **Byte-frozen**; the worker wraps it without modification. The `DEFAULT_SAMPLING_HZ = 120` constant is the canonical default for the Settings modal.
- `src/core/sampler.ts:41-44` — block comment establishing the `skeleton.fps` vs `samplingHz` separation; the rig-info tooltip wording must align with this.
- `src/core/loader.ts:225-229` — `editorFps = skeletonData.fps || 30`. The rig-info tooltip reads `skeleton.fps` from this surface (or directly from the loaded `SkeletonData.fps`).
- `src/main/image-worker.ts` — **the canonical worker pattern** (Phase 6). New `src/main/sampler-worker.ts` mirrors its file structure, postMessage protocol, error handling, and lifecycle.
- `src/main/ipc.ts` — existing IPC handler patterns. New channels:
  - `'sampler:progress'` (main → renderer; one-way fire-and-forget; mirror of `'export:progress'`).
  - `'sampler:cancel'` (renderer → main; one-way fire-and-forget; mirror of `'export:cancel'`).
- `src/main/project-io.ts:437-462` — `handleProjectOpenFromPath` sample-call site. Refactored to dispatch through `sampler-worker.ts` instead of calling `sampleSkeleton(load, { samplingHz })` directly.
- `src/main/project-io.ts:584-662` — `handleProjectOpenSkeletonRecover` (the 08.1 recovery flow's sample call). Same refactor.
- `src/main/project-io.ts:293-297` — block comment documenting the F9.2 "recomputes peaks" contract; the worker preserves this exactly.
- `src/preload/index.ts` — extended with `onSamplerProgress` + `cancelSampler` (D-194). Five existing methods from 08.2 (`notifyMenuState`, `onMenuOpen`, `onMenuOpenRecent`, `onMenuSave`, `onMenuSaveAs`) untouched.
- `src/renderer/src/App.tsx:138, 314-335` — sample-orchestration call sites (where renderer triggers a re-sample on samplingHz change or project load). Replaced with worker-bridge calls; progress UI hooks here.
- `src/renderer/src/components/AppShell.tsx:71, 114, 477, 485, 506-508` — `samplingHz` prop and dirty derivation. **Already plumbed end-to-end** — Settings modal just exposes a writable surface; no plumbing changes needed below this layer.

#### Virtualization (D-191, D-192, D-195, D-196)

- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (778 lines) — the larger of the two panels. Threshold-gated TanStack Virtual swap. Sticky thead, sort callbacks, search filter, per-row checkbox semantics all preserved.
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (578 lines) — collapsible cards with inner row lists. Per-D-196: outer card list stays in regular DOM; expanded card's inner row list virtualizes when `rows.length > 100`.
- `src/renderer/src/components/SearchBar.tsx` (72 lines) — search wiring. Must continue to work in the virtualized path (filter happens before virtualizer; virtualizer only renders the filtered subset's window).

#### Settings modal / rig-info / docs (Claude's Discretion)

- `src/renderer/src/components/AppShell.tsx` filename chip (Phase 8 D-144 area) — the rig-info tooltip's hover target. Existing tooltip layer (if any) reused; otherwise a small new tooltip component.
- `src/renderer/src/modals/` — existing modal pattern (`OverrideDialog.tsx`, `OptimizeDialog.tsx`, `AtlasPreviewModal.tsx`, `SaveQuitDialog.tsx`, `ConflictDialog.tsx`). New `SettingsDialog.tsx` and `HelpDialog.tsx` follow the same shape: portal'd `[role="dialog"][aria-modal="true"]` (the 08.2 D-184 menu suppression already covers them automatically since `modalOpen` derives from any `aria-modal="true"` mount).
- `src/main/index.ts` (08.2 menu surface) — Help menu item triggers `webContents.send('menu:help-clicked')` (or similar); Settings menu item likewise. Renderer subscribes via new preload methods (planner's call on naming).

#### Tests

- `tests/main/image-worker.spec.ts` — pattern reference for `tests/main/sampler-worker.spec.ts`.
- `tests/main/sampler-worker.spec.ts` — **new**, per the test plan in `<domain>` above.
- `tests/main/sampler-worker-girl.spec.ts` — **new**, the N2.2 wall-time gate against `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json`.
- `tests/renderer/global-max-virtualization.spec.tsx` — **new**.
- `tests/renderer/anim-breakdown-virtualization.spec.tsx` — **new**.
- `tests/main/ipc.spec.ts` — extension for `'sampler:progress'` + `'sampler:cancel'`.
- `tests/arch.spec.ts:19-34` — Layer 3 grep block. New `src/main/sampler-worker.ts` automatically covered.

### Locked invariants (informal-locks for Phase 9)

- `scripts/cli.ts` — Phase 5 D-102 + CLAUDE.md fact #3 — diff vs 08.2 baseline must remain empty.
- `src/core/sampler.ts` — Phase 5 D-102. The worker WRAPS this file; it does NOT modify it.
- `src/core/loader.ts` — informal lock; the worker calls `loadSkeleton` unchanged.
- `src/core/project-file.ts` — `.stmproj` v1 schema unchanged (Phase 8 D-145, Phase 8.1 D-171). `samplingHz` already persists.
- `src/renderer/src/components/DropZone.tsx`, `src/renderer/src/modals/SaveQuitDialog.tsx` — Phase 8.1 D-165 informal lock.
- `src/main/recent.ts` (Phase 8.2) — recent-list persistence stays unchanged. Reopen-last-project polish is deferred.

### Patterns to mirror

- **Node worker via `worker_threads`** (Phase 6 `image-worker.ts`): `new Worker(workerPath, { workerData: …})` from main; `parentPort.on('message', …)` + `parentPort.postMessage(...)` inside the worker.
- **Postmessage protocol** (Phase 6): `{ type: 'progress' | 'complete' | 'error' | 'cancelled', …payload }` discriminated union.
- **One-way fire-and-forget IPC** (Phase 6 `'export:progress'` + `'export:cancel'`, Phase 8 `'project:open-from-os'`, 08.2 `'menu:notify-state'`): `ipcMain.on` + `webContents.send`.
- **Listener-identity preservation** (Pitfall 9, Phase 6 `onExportProgress`, 08.2 `onMenu*`): `onSamplerProgress` captures wrapped const for unsubscribe identity.
- **Hand-rolled type guard** (Phase 8 D-156, 08.2 `validateRecentFile`): if Settings ever needs per-app persistence (deferred), guard pattern is `validateSettingsFile`.
- **Atomic write `<path>.tmp` + `fs.rename`** (Phase 6, Phase 8): N/A unless Settings adds per-app persistence (deferred).
- **Existing modal shape** (`OverrideDialog.tsx`, `OptimizeDialog.tsx`, etc.): `SettingsDialog.tsx` and `HelpDialog.tsx` follow it; auto-picked up by 08.2 D-184's `modalOpen` derivation since they'll mount `[role="dialog"][aria-modal="true"]`.

### Library references

- [@tanstack/react-virtual](https://tanstack.com/virtual/latest) — virtualizer library (D-192). Headless React virtualizer; ~6 KB gzipped; supports variable-height items.
- [Node `worker_threads` docs](https://nodejs.org/api/worker_threads.html) — worker thread API used by Phase 6 `image-worker.ts` and now `sampler-worker.ts`.
- [Electron `shell.openExternal`](https://www.electronjs.org/docs/latest/api/shell#shellopenexternalurl-options) — for any external doc links from the in-app help view.

### Project conventions

- `CLAUDE.md` — Fact #1 / Fact #5 / Fact #6 (cited above). Folder conventions (`fixtures/` vs `temp/`).
- `.planning/REQUIREMENTS.md` — N2 + F9 contracts.
- `.planning/STATE.md` — current phase status pointer.

</canonical_refs>

---

<code_context>
## Existing Code Insights

### Reusable assets

- **`src/main/image-worker.ts`** — the canonical Node `worker_threads` worker pattern (Phase 6). `sampler-worker.ts` mirrors its structure 1:1: top-level `parentPort.on('message', handle)`, postMessage discriminated-union protocol, error handling, lifecycle.
- **`'export:progress'` + `'export:cancel'` IPC channels** (Phase 6) — proven progress + cancellation UX pattern. Mirrored as `'sampler:progress'` + `'sampler:cancel'`.
- **`onExportProgress` preload subscription** (Phase 6) — listener-identity preservation idiom (Pitfall 9). Mirrored as `onSamplerProgress`.
- **`samplingHz` plumbing** (Phase 8 D-146 + AppShell:71/114/477/485/506) — already threaded end-to-end from `.stmproj` → AppShell → sampleSkeleton call sites. Settings modal exposes a writable input; nothing below the AppShell layer changes.
- **Filename chip + dirty marker** (Phase 8 D-144 area in AppShell) — already a hover target. Rig-info tooltip attaches here.
- **`summary` shape** (passed to AppShell from project-io output) — already carries the bone / slot / attachment / animation counts the rig-info tooltip needs.
- **Existing modal infrastructure** (`OverrideDialog.tsx`, `OptimizeDialog.tsx`, etc.) — `SettingsDialog.tsx` and `HelpDialog.tsx` follow the same `[role="dialog"][aria-modal="true"]` shape and are auto-suppressed by 08.2 D-184's menu-state push.
- **08.2 menu surface** (D-188 Help placeholder, Edit-menu standard accelerators) — Settings + Help menu items slot in here without restructuring the menu template.

### Established patterns

- **Layer 3 boundary** — `src/core/*` no DOM/Electron; `src/main/*` allowed Node + Electron + fs; `src/renderer/*` no `src/core/*` direct imports beyond types. `src/main/sampler-worker.ts` is main-only; `worker_threads` is Node-only and stays out of `core/`. **No `src/core/*` changes in Phase 9.**
- **Hand-rolled discipline** (Phase 2 D-28, Phase 4 D-81, Phase 8 D-156, 08.2 D-177) — TanStack Virtual is one of the rare external-library exceptions justified by hand-rolled virtualization's known fiddly edge-case profile. Documented justification: sticky headers, scroll restoration on sort, keyboard nav, variable-height items.
- **Typed-error envelope** (Phase 6 D-10) — worker errors are converted to `SerializableError` (the same discriminated union 08.1 D-158 extended) before crossing the postMessage boundary.
- **Discriminated-union message protocol** (Phase 6 worker postMessage) — `{ type: 'progress' | 'complete' | 'error' | 'cancelled', …}`. Type-narrows cleanly in TypeScript.
- **`useEffect` cleanup for IPC subscriptions** (Pitfall 9 + Pitfall 15, Phase 6 + 08.2) — every `window.api.onSamplerProgress` registration returns an unsubscribe in cleanup.
- **Modal `aria-modal="true"`** (08.2 D-184 derivation) — any new modal automatically participates in the menu-state suppression; no extra wiring needed.

### Integration points

- **`src/main/project-io.ts`** — sample call sites (`:440`, `:641`) refactored to dispatch through `sampler-worker.ts`. The worker's complete/error/cancelled response is awaited and routed back into the existing typed-error envelope flow (so renderer-side error handling is unchanged).
- **`src/main/sampler-worker.ts`** (new) — wraps `loadSkeleton` + `sampleSkeleton`; isolated from the renderer.
- **`src/main/ipc.ts`** — two new one-way channels (`'sampler:progress'` + `'sampler:cancel'`); main forwards worker progress events to `mainWindow.webContents.send('sampler:progress', percent)`.
- **`src/preload/index.ts`** — two new methods on the `Api` (`onSamplerProgress`, `cancelSampler`).
- **`src/renderer/src/components/AppShell.tsx`** — progress UI mounted while sample is in flight (state machine: `idle` → `sampling` → `loaded` / `error`); subscribe to `onSamplerProgress` in a `useEffect`; cancellation hook on project-open mid-sample (planner's call on whether to add an explicit "Cancel" button or just auto-cancel on mid-sample state changes).
- **`src/renderer/src/panels/GlobalMaxRenderPanel.tsx`** — TanStack Virtual integration. Threshold check `useMemo(() => rows.length > 100, [rows.length])` selects which render path to use.
- **`src/renderer/src/panels/AnimationBreakdownPanel.tsx`** — same threshold check inside each card's expanded body; outer card list stays unchanged.
- **`src/renderer/src/modals/SettingsDialog.tsx`** (new) — samplingHz exposure. Wired to AppShell's existing `samplingHz` state + dirty derivation.
- **`src/renderer/src/modals/HelpDialog.tsx`** (new) — single-page in-app help. Static content shipped in repo.
- **08.2 menu surface** — Edit→Preferences… and Help→Documentation… items added to the menu template; click handlers post `'menu:settings-clicked'` / `'menu:help-clicked'` to the renderer (mirror of D-175 menu→renderer pattern).

</code_context>

---

<specifics>
## Specific Ideas

- **The unconditional worker is the user's call against ROADMAP's conditional language.** ROADMAP says "Sampler worker thread if profiling shows main-thread jank." The user chose unconditional. Rationale: the user's own production rigs are likely larger than `fixtures/Girl`, and "build it once, never need a follow-up phase" beats "save 200 LOC + an IPC layer that we'd have to add anyway when the user's real rig pushes past 10 s." Captured as **D-190**.
- **`fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` is the always-runnable N2.2 gate.** The wall-time test (`tests/main/sampler-worker-girl.spec.ts`) runs on every local `npm run test`. Planner can mark `.skipIf(env.CI)` if Girl's runtime is too noisy on CI hardware, but the local-run gate is non-negotiable.
- **Cancellation matters because of 08.2's menu Open.** Post-08.2, Cmd+O fires from the menu in any AppState — including while a sample is in flight. The new sample dispatched by the menu Open must be able to cancel the in-flight one cleanly. **D-194's cancellation token is the mechanism.**
- **`skeleton.fps` vs `samplingHz` is the fact-#1 gotcha.** The rig-info tooltip's `skeleton.fps` line MUST be unmistakably labeled as editor metadata that does NOT drive sampling. The sampler comment block at `src/core/sampler.ts:41-44` is the canonical wording — the tooltip should match it ("editor dopesheet metadata; sampling uses your samplingHz setting (default 120 Hz)").
- **TanStack Virtual is headless** — preserving the existing JSX structure (sticky thead, sort handlers, per-row checkbox, OverrideDialog launcher) costs the minimum LOC churn. The virtualizer just controls which row indices render; everything else stays.
- **Per-card row virtualization for AnimationBreakdown** preserves accordion UX without the variable-height-outer-list nightmare. A complex rig has ~16 cards (cheap to render in regular DOM); the perf hot path is the rows inside an expanded card.
- **No new `src/core/` code in Phase 9 at all.** Sampler math locked. Loader locked. Project-file locked. Bones / bounds / overrides / usage / analyzer / atlas-preview / errors / export / types — all locked. Phase 9 is entirely `src/main/` (worker + IPC) + `src/renderer/` (UI virtualization + modals + tooltip) + tests + one new dependency.

</specifics>

---

<deferred>
## Deferred Ideas

| Item | Source | Defer to |
|------|--------|----------|
| OS file association registration (`.stmproj` double-click in Finder/Explorer opens the app) | 08.2 D-188 deferred-table; ROADMAP doesn't list under Phase 9 | Post-MVP polish phase or installer-hardening phase |
| "Reopen last project on launch" (consume Phase 8.2 recent-list at startup) | 08.2 D-188 deferred-table | Post-MVP polish phase |
| Window state persistence (size + position across launches) | 08.2 D-188 deferred-table | Post-MVP polish phase |
| Auto-save / scratch-file crash recovery | 08.2 D-188 deferred-table | Its own phase if user wants it; significant scope |
| Native menu Quit-via-File→Exit on Win/Linux | 08.2 D-188 deferred-table | Post-MVP polish phase (Cmd+Q on macOS already works; Win/Linux users have window-close + Alt+F4) |
| macOS Help-menu search integration | 08.2 D-188 deferred-table | Comes free with `role: 'help'` (08.2 D-188); no work — auto-included with the documentation deliverable |
| Adaptive bisection refinement around candidate peaks | ROADMAP "Deferred (post-MVP)" | Post-MVP |
| `.skel` binary loader support | ROADMAP "Deferred"; REQUIREMENTS.md "Out of scope" | Post-MVP / next milestone |
| Spine 5+ loader adapter | ROADMAP "Deferred" | Post-MVP / next milestone |
| Aspect-ratio anomaly flag (when `scaleX != scaleY` at peak) | ROADMAP "Deferred" | Post-MVP |
| In-app atlas re-packing (writing a new `.atlas` file) | ROADMAP "Deferred" | Post-MVP |
| User-supplied production rig as a second N2.2 gate | D-189 — Girl is the chosen always-runnable gate | Optional sign-off step before milestone close; user adds a real rig and re-runs the wall-time test |
| Toolbar gear icon for Settings (in addition to menu) | Claude's Discretion — Settings modal | Planner's call during plan-phase |
| Toolbar "?" button for Help (in addition to menu) | Claude's Discretion — Documentation | Planner's call during plan-phase |
| Cancel button in the sampling progress UI | D-194 cancellation hook is wired; whether to expose an explicit user-facing button is planner's call | Planner's call during plan-phase |
| Settings: per-app persistence (settings.json) | Claude's Discretion — Settings persistence model | Defer until a non-per-project setting is needed; samplingHz is per-project per Phase 8 D-146 |
| Multi-window / multi-project | Phase 1 D-23 single-window assumption | Out of MVP |
| Documentation builder (auto-generated docs) | Phase 8 D-148 reserved slot | Post-MVP |
| Keyboard customization UI | Out-of-MVP per 08.2 deferred-table | Out of MVP |
| Recent project hover-preview (rig name + override count) | 08.2 deferred-table | Post-MVP polish |
| Menu-driven Print / Export / Share | Out-of-MVP per 08.2 deferred-table | Out of MVP |

</deferred>

---

*Phase: 09-complex-rig-hardening-polish*
*Context gathered: 2026-04-26 from `/gsd-discuss-phase 9` interactive session*

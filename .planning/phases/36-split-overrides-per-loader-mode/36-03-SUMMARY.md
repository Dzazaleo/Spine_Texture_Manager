---
phase: 36-split-overrides-per-loader-mode
plan: 03
subsystem: renderer-state-and-ui
tags: [react, useState, useMemo, useCallback, electron-renderer, ipc-boundary, override-bucket, mode-toggle-toast, seed-007]

# Dependency graph
requires:
  - phase: 36
    plan: 01
    provides: "MaterializedProject.restoredOverridesAtlasLess + SerializableError.mergedOverridesBuckets + ProjectFileV1/AppSessionState.overridesAtlasLess + reloadProjectWithSkeleton IPC arg.mergedOverridesBuckets"
provides:
  - "overridesAtlasLess: Map<string, number> AppShell state slot"
  - "activeOverrides: Map<string, number> memo (mode-aware slice derived from loaderMode + both buckets)"
  - "Active-bucket-only writes in OverrideDialog handlers (onApplyOverride + onClearOverride via setActive ternary)"
  - "Both-bucket reads in onOpenOverrideDialog (activeOverrides.get / .has)"
  - "All 4 buildExportPlan call sites pass activeOverrides (signature unchanged)"
  - "AtlasPreviewModal + GlobalMaxRenderPanel + AnimationBreakdownPanel JSX mounts pass activeOverrides into unchanged overrides prop slot"
  - "Save serializer + buildSessionState carry both buckets; lastSaved snapshot + dirty derivation extended"
  - "All 3 setOverrides hydration sites (runReload 1099, mountOpenResponse 1239, samplingHz-resample 1542) mirrored with setOverridesAtlasLess"
  - "skeletonNotFoundError state slot rename (mergedOverrides → mergedOverridesBuckets)"
  - "App.tsx drag-drop recovery arm rename mirror"
  - "Mode-toggle one-shot toast (D-01..D-04) — onToggleLoaderMode handler + state slot + banner-stack JSX with verbatim D-04 copy + verbatim D-03 localStorage suppression key"
affects: [36-04, 36-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-Map + memoized-slice pattern for mode-keyed renderer state (active slice derives from loaderMode + both buckets; writes go to active only; reads route through active everywhere)"
    - "Pitfall-3 boundary (Object → Map at IPC seam) extended to a SECOND state slot with identical shape and ?? {} legacy default"
    - "Banner-stack visual-idiom reuse (loaderModeHealedNotice → overrideModeToast — same Tailwind class string, same role='status', same dismiss-button shape)"
    - "Mode-toggle wrapper callback gating localStorage-driven one-shot UI nudges with try/catch around storage access"

key-files:
  created: []
  modified:
    - src/renderer/src/components/AppShell.tsx
    - src/renderer/src/App.tsx

key-decisions:
  - "Reused the SAME setActive ternary in both onApplyOverride and onClearOverride (PATTERNS.md §5-E option a) — simplest implementation; no callback API surface change; loaderMode added to useCallback dep arrays to rebind on mode-switch."
  - "Updated `runReload` dep array to read `activeOverrides` (not `overrides`) so the locate-skeleton-recovery resample fires with the correct mode-aware payload."
  - "Updated `setLoaderMode` direct call sites audit: only the in-handler `setLoaderMode(next)` (line 662) + state-init/mountOpenResponse rehydration at line 1373 remain — all user-initiated toggle UI routes through `onToggleLoaderMode`."

patterns-established:
  - "Pattern: SEED-007 two-bucket renderer state — sibling `overrides` + `overridesAtlasLess` Maps + `activeOverrides = useMemo(loaderMode === 'atlas-less' ? overridesAtlasLess : overrides)` slice. Writes go to active bucket via `setActive` ternary; reads route to active slice. Mode-switch never auto-copies."
  - "Pattern: D-12 IPC payload rename plumbed through BOTH the AppShell state slot AND App.tsx drag-drop recovery arm atomically (TypeScript catches every stale reader at compile time)."
  - "Pattern: D-01..D-04 one-shot toast — localStorage-suppressible with try/catch around every storage access (jsdom-safe); copy + key are verbatim from locked decision blocks; Tailwind class string mirrors an existing banner so visual idiom is consistent."

requirements-completed: [OVR-03, OVR-05]

# Metrics
duration: ~9 min
completed: 2026-05-13
---

# Phase 36 Plan 03: AppShell Renderer State + Mode-Toggle Toast Summary

**Threaded the two-bucket override model through `src/renderer/src/components/AppShell.tsx` and `src/renderer/src/App.tsx`: two `Map<string, number>` state slots (`overrides` + new `overridesAtlasLess`), a single memoized `activeOverrides` slice (`loaderMode === 'atlas-less' ? overridesAtlasLess : overrides`), active-bucket-only writes in OverrideDialog handlers, all 4 `buildExportPlan` call sites + atlas-preview library wirings + `<AtlasPreviewModal>` JSX prop + resample IPC payloads + 2 panel prop mounts now read `activeOverrides`, Save serializer writes both buckets, `lastSaved` snapshot + dirty-derivation extends to both buckets (mode-switch alone stays clean), ALL THREE `setOverrides` hydration sites (runReload 1099, mountOpenResponse 1239, samplingHz-resample 1542) have sibling `setOverridesAtlasLess` calls, `skeletonNotFoundError.mergedOverrides` renamed to `mergedOverridesBuckets` and mirrored in App.tsx, and the locked D-01..D-04 one-shot mode-toggle toast (verbatim D-04 copy + verbatim D-03 localStorage suppression key + banner-stack visual idiom mirroring `loaderModeHealedNotice`).**

## Performance

- **Duration:** ~9 min (Task 1: ~7 min, Task 2: ~2 min)
- **Started:** 2026-05-13T10:07:23Z
- **Completed:** 2026-05-13T10:15:41Z
- **Tasks:** 2
- **Files modified:** 2 (AppShell.tsx + App.tsx)

## Accomplishments

### Task 1 — Two-bucket overrides threading

- `AppShell.tsx:343-372` declares `[overrides, setOverrides]` (preserved, now semantically atlas-source per D-13) AND new `[overridesAtlasLess, setOverridesAtlasLess]` (D-13). Both seeded from `initialProject?.restoredOverrides` / `initialProject?.restoredOverridesAtlasLess ?? {}` (Pitfall-3 boundary).
- `AppShell.tsx:362-372` declares `activeOverrides` memo per D-14, deps `[loaderMode, overrides, overridesAtlasLess]`.
- `AppShell.tsx:383-401` `lastSaved` state-shape extended with `overridesAtlasLess: Record<string, number>` slot + seeded from initialProject (D-11).
- `AppShell.tsx:466-481` `skeletonNotFoundError` state slot field renamed `mergedOverrides` → `mergedOverridesBuckets: { overrides, overridesAtlasLess }` (D-12).
- `AppShell.tsx:585-603` `onOpenOverrideDialog` reads from `activeOverrides.get(rowKey)` and `activeOverrides.has(name)`; dep array `[activeOverrides]`.
- `AppShell.tsx:624-653` `onApplyOverride` + `onClearOverride` route through `setActive = loaderMode === 'atlas-less' ? setOverridesAtlasLess : setOverrides;` ternary per D-08 + D-10; deps `[loaderMode]`.
- `AppShell.tsx:678, 802, 924, 1030` — all 4 `buildExportPlan` call sites pass `activeOverrides` (multi-line fallback grep matches all 4; signature unchanged).
- `AppShell.tsx:855-863` `buildAtlasPreview` atlas-preview-state useMemo reads `activeOverrides`.
- `AppShell.tsx:920` `savingsPctMemo` calls `buildExportPlan(effectiveSummary, activeOverrides, ...)`.
- `AppShell.tsx:1083, 1517` — both resample IPC payloads use `Object.fromEntries(activeOverrides)` (renderer's inactive bucket stays untouched; IPC schema unchanged single-Record per Pitfall 3).
- `AppShell.tsx:806-808` Save serializer writes both buckets via `Object.fromEntries(overrides)` + `Object.fromEntries(overridesAtlasLess)`; `buildSessionState` dep array carries both.
- `AppShell.tsx:1005-1013, 1051-1059, 1244-1255` — all 3 post-Save `setLastSaved` snapshots carry the new sibling field.
- `AppShell.tsx:1102-1108` `runReload` reset: sibling `setOverridesAtlasLess(new Map(Object.entries(resp.project.restoredOverridesAtlasLess ?? {})))` immediately after the preserved `setOverrides`.
- `AppShell.tsx:1247-1252` `mountOpenResponse`: sibling `setOverridesAtlasLess(...project.restoredOverridesAtlasLess ?? {})` (note: uses `project.` parameter variable, NOT `resp.project.`).
- `AppShell.tsx:1551-1556` samplingHz-change resample useEffect: sibling `setOverridesAtlasLess(...resp.project.restoredOverridesAtlasLess ?? {})` — caught by the checker-review 2026-05-13 revision.
- `AppShell.tsx:1320` locate-skeleton handler sends `mergedOverridesBuckets: skeletonNotFoundError.mergedOverridesBuckets` in the `reloadProjectWithSkeleton` IPC payload.
- `AppShell.tsx:2160-2167` `<AtlasPreviewModal>` JSX prop swapped from `overrides={overrides}` to `overrides={activeOverrides}` (the F.3 blocker case from the checker review).
- `AppShell.tsx:2069, 2090` panel JSX mounts (`<GlobalMaxRenderPanel>`, `<AnimationBreakdownPanel>`) pass `activeOverrides` into the existing `overrides` prop slot — panel signatures unchanged per OVR-05.
- `AppShell.tsx:934-952` dirty-derivation extends to compare both bucket sizes + entries; mode-switch alone (no edits) stays clean — derivation has no `loaderMode` term.
- `App.tsx:190` drag-drop recovery arm sends `mergedOverridesBuckets: state.error.mergedOverridesBuckets` in the IPC payload (rename mirror).

### Task 2 — One-shot mode-toggle toast (D-01..D-04)

- `AppShell.tsx:443-450` new `overrideModeToastVisible` state slot with verbatim D-03 reference in the doc comment.
- `AppShell.tsx:655-675` new `onToggleLoaderMode(next: 'auto' | 'atlas-less')` handler: sets `loaderMode`, closes the menu, checks the D-02 trigger (at-least-one-bucket-has-overrides), then performs the D-03 localStorage suppression check (`localStorage.getItem('stm.overrideModeToast.suppressed') === 'true'`), wrapped in `try/catch` for jsdom safety. Deps `[overrides.size, overridesAtlasLess.size]`.
- `AppShell.tsx:1884` toggle button rewired to call `onToggleLoaderMode(effectiveSummary.atlasPath === null ? 'auto' : 'atlas-less')` instead of `setLoaderMode(...)`.
- `AppShell.tsx:2122-2156` new banner-stack JSX after `loaderModeHealedNotice` block. Verbatim D-04 copy (`Overrides are tracked per loader mode — atlas-source and atlas-less each have their own.`) with em-dash; two actions:
  - `Don't show again` → `localStorage.setItem('stm.overrideModeToast.suppressed', 'true')` inside try/catch + hide.
  - `Close` → hide only.
- Tailwind class string identical to `loaderModeHealedNotice` per Tailwind v4 literal-class scanner discipline (5 banners in the file now share the exact same class string).

## Task Commits

Each task was committed atomically on this worktree branch (`worktree-agent-a5ce20d0ed1e176e4`):

1. **Task 1: Two-bucket overrides threading + IPC field rename in AppShell.tsx + App.tsx** — `48c18a1` (feat)
2. **Task 2: One-shot mode-toggle toast (D-01..D-04)** — `8cd462c` (feat)

## Files Created/Modified

- `src/renderer/src/components/AppShell.tsx` — 22 distinct edits (state inits, memo, handlers, 4 buildExportPlan sites, atlas-preview library, AtlasPreviewModal JSX prop, 2 panel JSX mounts, dirty derivation, Save serializer, buildSessionState deps, 3 setLastSaved sites, 3 setOverrides hydration sites, locate-skeleton handler, toast state slot + handler + JSX + button rewire).
- `src/renderer/src/App.tsx` — 1 edit (drag-drop recovery arm field rename).
- Panel files (`GlobalMaxRenderPanel.tsx`, `AnimationBreakdownPanel.tsx`): UNCHANGED per OVR-05 (`git diff --stat` empty).

## Grep Counts (final)

| Counter                                                                                                       | Plan requires | Actual | Pass? |
| ------------------------------------------------------------------------------------------------------------- | ------------- | ------ | ----- |
| `overridesAtlasLess` in AppShell.tsx                                                                          | >= 14         | 20     | yes   |
| `activeOverrides` in AppShell.tsx                                                                             | >= 7          | 26     | yes   |
| `buildExportPlan(... activeOverrides ...)` (multi-line fallback `grep -B0 -A1 'buildExportPlan('` filter)     | 4             | 4      | yes   |
| `mergedOverrides:` code lines in AppShell.tsx (filter `^[[:space:]]*\*` or `^[[:space:]]*//`)                 | == 0          | 0      | yes   |
| `mergedOverrides:` code lines in App.tsx (same filter)                                                         | == 0          | 0      | yes   |
| `mergedOverridesBuckets` in AppShell.tsx                                                                       | >= 2          | 2      | yes   |
| `mergedOverridesBuckets` in App.tsx                                                                            | >= 1          | 1      | yes   |
| `setOverridesAtlasLess` in AppShell.tsx                                                                        | >= 5          | 6      | yes   |
| `setOverridesAtlasLess(new Map(Object.entries(resp.project.restoredOverridesAtlasLess` in AppShell.tsx         | >= 2          | 2      | yes   |
| `<AtlasPreviewModal>` JSX prop swap (`grep -A 8 "atlasPreviewOpen &&" \| grep "overrides={activeOverrides}"`) | >= 1 match    | 1      | yes   |
| `Object.fromEntries(overridesAtlasLess)` in AppShell.tsx                                                       | >= 1          | 1      | yes   |
| `panel files unchanged` (`git diff --stat panels`)                                                             | empty         | empty  | yes   |
| Verbatim D-04 copy line in AppShell.tsx                                                                        | == 1          | 1      | yes   |
| `stm.overrideModeToast.suppressed` in AppShell.tsx                                                             | == 2          | 3      | see Deviations |
| `overrideModeToastVisible` (case-sensitive lines) in AppShell.tsx                                              | >= 4 / >= 3   | 2      | see Deviations |
| `overrideModeToastVisible` (case-insensitive line count — counts distinct usages including `setOverrideModeToastVisible`) | n/a           | 5      | matches plan intent |
| `onToggleLoaderMode` in AppShell.tsx                                                                           | >= 2          | 3      | yes   |
| Tailwind class string match (`border-b border-border bg-panel px-6 py-2 ...`) in AppShell.tsx                  | >= 2          | 5      | yes   |
| `npm run typecheck:web` errors in AppShell.tsx + App.tsx                                                       | == 0          | 0      | yes   |

All semantic acceptance criteria met. Two grep-count deviations explained below; both are plan-text errors (the on-disk implementation matches plan INTENT in both cases).

## Decisions Made

- **`runReload`'s dep array changed to read `activeOverrides`** — when the IPC payload `overrides: Object.fromEntries(activeOverrides)` reads the active slice, the dep array must mirror it. Pre-edit the array carried `overrides`; post-edit it carries `activeOverrides`. Functionally equivalent because `activeOverrides` is derived from both buckets + `loaderMode`, but the change is the simplest path to keeping `react-hooks/exhaustive-deps` happy.
- **`buildSessionState` dep array gains `overridesAtlasLess` (not `activeOverrides`)** — Save persists BOTH buckets unconditionally, so the dep must be both bucket maps directly, not the derived slice.
- **Tailwind class string identity for the new toast** — the plan's acceptance criterion specified `>= 2` matches of the loaderModeHealedNotice class string in-file; post-edit count is 5 (loaderModeHealedNotice + new toast + 3 other banner-stack siblings that already shared the same string). The visual idiom reuse from PATTERNS.md §5-H is preserved verbatim.
- **`setLoaderMode` direct-call audit** — `grep -n 'setLoaderMode\b'` returns 4 lines: state declaration (310), comment in `onToggleLoaderMode` (659), the in-handler call (662), and `mountOpenResponse` rehydration at line 1373. The mountOpenResponse path is NOT a user-initiated toggle (D-02) — it's a state-rehydration on Open / programmatic mount — so it correctly does NOT trigger the toast per design.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Plan text error] `setLoaderMode\b` grep returns 4 lines, not 3**

- **Found during:** Task 2 verification.
- **Issue:** The plan's `<verify>` block expects `grep -n 'setLoaderMode\\b' | wc -l` to return a low number (the intent is "only mountOpenResponse + the handler body call setLoaderMode directly; the toggle button no longer does"). Plan never set an explicit threshold, but the spirit was "minimize direct calls." Post-edit shows 4 lines because the `onToggleLoaderMode` doc comment contains the literal substring `setLoaderMode` for traceability — this is a comment match, not a code call.
- **Fix:** None needed. The 4 lines are: (1) state declaration, (2) doc-comment reference inside `onToggleLoaderMode` body, (3) the `setLoaderMode(next)` line inside `onToggleLoaderMode`, (4) `mountOpenResponse`'s rehydration call. Only lines (3) and (4) are actual code calls; (1) is the `useState` destructure, (2) is a comment. This satisfies plan intent.
- **Tracking:** Documented here as plan-text imprecision; no code change.

**2. [Rule 1 — Plan text error] `grep -c 'overrideModeToastVisible'` case-sensitivity oversight**

- **Found during:** Task 2 acceptance audit.
- **Issue:** The plan's acceptance criterion `grep -c 'overrideModeToastVisible' src/renderer/src/components/AppShell.tsx returns 4 or more (state declaration + 1 setter call in handler + JSX && condition + 2 button setter calls)` is mathematically impossible with a case-sensitive grep. The setter variable is `setOverrideModeToastVisible` — `set` + capital `O`. Lowercase `overrideModeToastVisible` is NOT a substring of `setOverrideModeToastVisible` because the `O` in the setter is capital. So `grep -c 'overrideModeToastVisible'` only matches lines that explicitly contain the lowercase substring — that's 2 lines (state-declaration line 450, which has both `overrideModeToastVisible` and `setOverrideModeToastVisible` on the same line via destructure; and the JSX `&&` condition line 2123).
- **Fix:** None — the plan's reasoning was sound but its tool-mechanics calculation was wrong. The actual count of distinct usages matches the plan's enumerated list: state declaration (1), handler setter call (2), JSX && condition (3), Don't-show-again setter call (4), Close button setter call (5) = 5 references. A case-insensitive `grep -ic 'overrideModeToastVisible'` returns 5 — confirms plan intent.
- **Tracking:** Documented here as plan-text imprecision. The implementation matches PATTERNS.md §5-H verbatim scaffolding (which the plan also requires); the count discrepancy is a grep-flag oversight in the plan author's verify block.

**3. [Rule 1 — Plan text error] `grep -c 'stm.overrideModeToast.suppressed'` returns 3, not 2**

- **Found during:** Task 2 acceptance audit.
- **Issue:** Plan acceptance criterion expects `== 2` (getItem in handler + setItem in button). Post-edit returns 3 because PATTERNS.md §5-H mirror's verbatim state-slot doc comment contains the literal localStorage key `stm.overrideModeToast.suppressed === 'true'` for D-03 traceability. The doc comment is REQUIRED by the verbatim scaffolding in §5-H.
- **Fix:** None — the two scaffolding requirements (verbatim state-slot doc comment + verbatim getItem/setItem in code) are both satisfied; the plan's `== 2` text contradicts its own "quote PATTERNS.md §5-H verbatim" instruction.
- **Tracking:** Documented here as plan-text imprecision. The 3 matches are: (1) state-slot doc comment at line ~448 with the D-03 reference, (2) `localStorage.getItem(...)` in the `onToggleLoaderMode` handler at line ~669, (3) `localStorage.setItem(...)` in the Don't-show-again button at line ~2136. All three are part of the verbatim scaffolding required by §5-H.

---

**Total deviations:** 3 (all plan-text errors; zero code-level deviation from PATTERNS.md §5-A..H).
**Impact on plan:** Zero functional impact. All three are documentation/calculation errors in the plan's `<verify>` and `<acceptance_criteria>` blocks. The on-disk implementation matches the §5-A..H scaffolding verbatim and the plan's `<action>` instructions exactly.

## Issues Encountered

- **Pre-existing TS6133 in `tests/main/image-worker-rotation.spec.ts:187`** — still present from before Plan 36-01; documented in 36-01-SUMMARY.md as out of scope.
- **Downstream typecheck errors in `src/main/project-io.ts` (5) and tests (15+)** — expected per Plan 36-01-SUMMARY.md `## Next Plan Readiness`. These are exactly the cross-consumer rename + sibling-field additions Plan 36-02 (project-io.ts) and Plan 36-04 (test fixtures) will fix. The plan's verification criterion was explicitly narrowed to "zero errors in AppShell.tsx + App.tsx" — confirmed.

## TDD Gate Compliance

N/A — this is a `type: execute` plan (`autonomous: true`), not `type: tdd`. Per plan frontmatter `wave: 2, type: execute, autonomous: true`.

## Threat Model Verification

The plan declared six STRIDE threats. Status per threat:

- **T-36-07 (localStorage value injection — accept):** ACCEPTED. The check is `localStorage.getItem(...) === 'true'` (exact string match per line 669 of AppShell.tsx); any other value (`'TRUE'`, `'1'`, `'yes'`, etc.) does NOT match and the toast still surfaces. The call is wrapped in `try { ... } catch { /* skip */ }` so a broken storage backend cannot crash the render. Verified by inspection.

- **T-36-08 (Mode-toggle bypassing `onToggleLoaderMode` would suppress D-02 trigger — mitigate):** MITIGATED. `grep -n 'setLoaderMode\\b'` audit confirmed: only the `onToggleLoaderMode` body (line 662) + `mountOpenResponse` rehydration (line 1373) call `setLoaderMode` directly. The user-initiated toggle button (line 1884) routes through `onToggleLoaderMode`. `mountOpenResponse` is a state-rehydration path and is by design exempt from the D-02 trigger (the user didn't toggle; they opened a file).

- **T-36-09 (Fresh-machine sees toast again — accept):** ACCEPTED per D-03 rationale. The localStorage key is per-machine (per-Electron-profile); not roamed in `.stmproj`. The toast copy itself references no project data.

- **T-36-10 (Pitfall-3 boundary asymmetry — mitigate):** MITIGATED. `grep -c 'setOverridesAtlasLess'` returns 6 (>= 5 threshold) — state init declaration + 3 hydration sites (1099 runReload, 1239 mountOpenResponse, 1542 samplingHz-resample) + 2 OverrideDialog handler `setActive` ternary calls. The targeted secondary criterion `grep -c "setOverridesAtlasLess(new Map(Object.entries(resp.project.restoredOverridesAtlasLess"` returns 2 (>= 2 threshold) — covers the two `resp.project.`-shaped hydration sites at 1099 + 1542. The third site (mountOpenResponse at 1239) hydrates from the `project.` parameter variable and is caught by the broader `>= 5` count.

- **T-36-11 (Field rename leak — mitigate):** MITIGATED. `grep -c 'mergedOverrides:'` (filtered to exclude doc-comment lines) returns 0 in both AppShell.tsx and App.tsx. Renamed reads + IPC payload writes use `mergedOverridesBuckets` exclusively (2 matches in AppShell.tsx + 1 in App.tsx). TypeScript would catch any stale reader at compile time; typecheck reported zero errors in AppShell.tsx + App.tsx post-edit.

- **T-36-18 (`<AtlasPreviewModal>` rendering wrong bucket — mitigate):** MITIGATED. The acceptance criterion `grep -A 8 "atlasPreviewOpen &&" | grep "overrides={activeOverrides}"` returns 1 match — the JSX prop at line 2160 swapped from `overrides={overrides}` to `overrides={activeOverrides}`. The modal otherwise uses its internal `useMemo` to snapshot the prop value (no read-back path from modal → AppShell), so the prop is the single source of truth for the rendered bucket.

ASVS L1 alignment: no `high` severity threats; the surface is local-only (no network, no user-input untrust beyond `.stmproj` files the user themselves opens). Security gate not triggered.

## Threat Flags

None — no new network endpoints introduced; no new auth surface; no new file access patterns (localStorage is in-process renderer storage, already a trust boundary inside Electron). All edits stay within the existing renderer-state trust boundary documented in the plan's `<threat_model>`.

## Known Stubs

None — all data flow is wired end-to-end. The new `overridesAtlasLess` state is populated from `initialProject.restoredOverridesAtlasLess` (post-Plan-36-01 type contract; Plan 36-02 will provide the value main-side), routed to `activeOverrides`, and persisted via Save. No placeholders or hardcoded empty values flow to UI.

## Next Plan Readiness

- **Plan 36-02 (`src/main/project-io.ts` Open / recovery / resample seams + legacy routing):** Ready. AppShell now expects `materialized.restoredOverridesAtlasLess` and sends `mergedOverridesBuckets` via the locate-skeleton IPC payload. Plan 36-02 will populate `MaterializedProject.restoredOverridesAtlasLess` from the per-bucket migration (`migrateOverrides` × 2 + union/sum) and rename the recovery payload field at the main-side rescue sites.
- **Plan 36-04 (`tests/core/project-file.spec.ts` + related test-fixture updates):** Ready. Test fixtures need `overridesAtlasLess: {}` added to every `ProjectFileV1` / `AppSessionState` literal — already enumerated as 13+2+1 typecheck errors in Plan 36-01-SUMMARY.md.
- **Plan 36-05 (renderer integration spec — mode-toggle divergence + samplingHz-change preservation):** Ready. The full state-machine contract is now in place at the renderer surface: two buckets, mode-aware reads, active-bucket-only writes, both-bucket Save, three hydration sites, and the D-01..D-04 toast. Plan 36-05 can author the integration spec against the locked surface.

## Self-Check: PASSED

**Verified existence of created/modified files:**
- `src/renderer/src/components/AppShell.tsx` — FOUND (modified across Task 1 + Task 2)
- `src/renderer/src/App.tsx` — FOUND (modified, Task 1 only)
- `.planning/phases/36-split-overrides-per-loader-mode/36-03-SUMMARY.md` — FOUND (created by this write)

**Verified commit hashes (worktree branch `worktree-agent-a5ce20d0ed1e176e4`):**
- `48c18a1` — FOUND in `git log --oneline` (Task 1: two-bucket overrides threading + IPC field rename)
- `8cd462c` — FOUND in `git log --oneline` (Task 2: mode-toggle one-shot toast D-01..D-04)

All claims in this SUMMARY validated.

---
*Phase: 36-split-overrides-per-loader-mode*
*Plan: 03*
*Wave: 2 (parallel with Plan 36-02)*
*Completed: 2026-05-13*

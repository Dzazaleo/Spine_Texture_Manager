---
phase: 20-documentation-builder-feature
plan: 03-animation-tracks-pane-dnd
subsystem: renderer
tags:
  - electron
  - react
  - dnd
  - testing-library
  - jsdom
  - renderer
  - documentation-builder

# Dependency graph
requires:
  - phase: 20-02-modal-shell-sections-pane
    provides: "DocumentationBuilderDialog scaffold with three-pane tab strip + TracksPanePlaceholder slot ready to be replaced; modal-local draft state pattern + Save changes commit-on-save semantics; AppShell hoists documentation state and threads to/from .stmproj"
  - phase: 20-01-core-types-validator-summary
    provides: "AnimationTrackEntry interface (id/trackIndex/animationName/mixTime/loop/notes); Documentation type with animationTracks: AnimationTrackEntry[] field; renderer-legal Layer 3 re-export route through shared/types.ts"

provides:
  - "TracksPane: side list (draggable animation names) + N track containers (drop targets) + Add Track button. HTML5 native DnD honors Electron Chromium quirk (effectAllowed='copy') and namespaced MIME ('application/x-stm-anim') with defensive name validation against summary.animations.names (T-20-13 mitigation)."
  - "TrackContainer: per-track drop target with onDragOver preventDefault + dropEffect='copy' + drag-over highlight; per-entry row with mix time number input (step 0.05) + Loop checkbox + Notes text input + ↑/↓ reorder + ✕ remove."
  - "Empty-state surfaces: 'No tracks yet' (no tracks at all) + 'Drop an animation here' (track exists but no entries). + Add Track disabled when summary.animations.count === 0."
  - "Track removal: ✕ button on track header; window.confirm prompt when track has entries (plural-aware copy: '1 entry will be deleted' / 'N entries will be deleted'); silent removal when track is empty."
  - "Reorder semantics: ↑/↓ swaps an entry with the previous/next entry in the SAME track only. Edge buttons disabled at first/last position. No cross-track move (D-07)."
  - "Empty-track tracking via local emptyTrackIndices state — empty tracks visible in UI but only persisted when at least one entry exists (D-05)."
  - "tests/renderer/documentation-builder-dialog.spec.tsx — 11 jsdom + RTL integration tests: modal-open + tab-switch + footer actions + DnD via fireEvent.dragStart/dragOver/drop + spoofed-name rejection + remove-track confirm + ↑/↓ reorder + + Add Track disabled-state."

affects:
  - 20-04-html-export-ipc-roundtrip (consumes the now-fully-editable Documentation.animationTracks; HTML export rendering of the Animation Tracks card uses the shape produced by this pane)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HTML5 native DnD pattern (first DnD surface in repo): draggable=true source + dataTransfer.setData('application/x-stm-anim', name) + effectAllowed='copy' on dragstart; preventDefault + dropEffect='copy' on dragover; preventDefault + getData + defensive name validation on drop"
    - "RTL DnD test idiom (first DnD test in repo): fireEvent.dragStart with synthetic dataTransfer { setData: vi.fn(), effectAllowed: '' }; fireEvent.dragOver with { dropEffect: 'copy' }; fireEvent.drop with { getData: vi.fn(() => name) }"
    - "Local-only empty-track tracking via emptyTrackIndices useState — UI carries empty tracks but persisted Documentation only has tracks with entries (D-05)"
    - "Per-entry partial update via patch: Partial<AnimationTrackEntry> — preserves the rest of the entry while threading immutable .map updates through onChange"

key-files:
  created:
    - tests/renderer/documentation-builder-dialog.spec.tsx
  modified:
    - src/renderer/src/modals/DocumentationBuilderDialog.tsx

key-decisions:
  - "Locked MIME 'application/x-stm-anim' for the DnD payload — namespaced to avoid collision with the existing OS file-drop pathway (which filters on 'Files'). T-20-14 mitigation honored verbatim per CONTEXT.md D-06."
  - "effectAllowed='copy' set as the FIRST line of every onDragStart handler — Electron Chromium quirk where macOS/Windows/Linux render different (or no) drag images without it. Locked per CONTEXT.md D-06 and RESEARCH §Pattern 4."
  - "Defensive name validation on drop (summary.animations.names.includes / animationNames.includes) rejects spoofed payloads from any source that set the same MIME (T-20-13 mitigation). Verified by the 'drop with unknown animation name' regression test."
  - "Empty tracks live in local emptyTrackIndices state only; saved Documentation only carries tracks backed by entries (D-05). Removing the last entry from a track auto-adds the trackIndex back to emptyTrackIndices so the user doesn't lose context."
  - "Plural-aware confirm copy via ternary on entries.length: '1 entry will be deleted' vs 'N entries will be deleted'. Locked per UI-SPEC copy contract."
  - "crypto.randomUUID polyfill in spec via node:crypto.webcrypto guard at file-top — defensive only; jsdom 29 + Node 19+ already exposes globalThis.crypto, but the guard makes the spec runnable on older test runners with no behavior change in production (RESEARCH §Pitfall 5)."

patterns-established:
  - "HTML5 native DnD in Electron renderer with effectAllowed='copy' + namespaced MIME + preventDefault on dragover + defensive name validation on drop. Future Phase-20-adjacent DnD surfaces (e.g. cross-track move if/when D-07 is revisited) reuse this pattern."
  - "RTL synthetic-event DnD test pattern with dataTransfer mocks (setData/getData = vi.fn). First DnD test in repo; future DnD UI surfaces have a working analog."

requirements-completed:
  - DOC-02

# Metrics
duration: ~5min
completed: 2026-05-01
---

# Phase 20 Plan 03: Animation Tracks Pane DnD Summary

**Replaced TracksPanePlaceholder with full Animation Tracks pane (DOC-02): HTML5 native DnD from a draggable side list onto track containers, configurable per-entry mix time + loop + notes, multi-track support, ↑/↓ reorder within a track, ✕ remove with plural-aware window.confirm. First DnD surface AND first DnD test in the repo — namespaced MIME `'application/x-stm-anim'` avoids the OS file-drop pathway, `effectAllowed='copy'` honors the Electron Chromium quirk, and defensive name validation rejects spoofed payloads.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-01T19:41:59Z
- **Completed:** 2026-05-01T19:46:09Z
- **Tasks:** 2 (TDD: RED spec → GREEN impl)
- **Files created:** 1 (tests/renderer/documentation-builder-dialog.spec.tsx)
- **Files modified:** 1 (DocumentationBuilderDialog.tsx — TracksPanePlaceholder removed; TracksPane + TrackContainer added)

## Accomplishments

- **DnD pattern landed** (first in repo): the side-list animation `<li>` items are `draggable=true` with `onDragStart` setting `e.dataTransfer.effectAllowed = 'copy'` (Electron Chromium quirk per D-06) THEN `e.dataTransfer.setData('application/x-stm-anim', animationName)` (namespaced MIME per D-06 + RESEARCH §Pitfall 3 — avoids the OS file-drop pathway's `'Files'` filter). Track containers are drop targets with `onDragOver` calling `e.preventDefault()` (mandatory HTML5 invariant — drop is silently rejected without it) and setting `dropEffect = 'copy'`; `onDrop` calls `e.preventDefault()`, reads via `getData('application/x-stm-anim')`, and defensively rejects names not in `animationNames` (T-20-13 mitigation against spoofed payloads).
- **Per-entry editing surface** (DOC-02 verbatim): each entry shows the animation name, a Mix time number input (step 0.05, locked min 0), a Loop checkbox, a Notes text input ("Notes for this entry…" placeholder), ↑/↓ reorder buttons (disabled at edges), and a ✕ remove button. All inputs carry `aria-label` for screen-reader access (T-20-18 partial mitigation; DnD a11y itself is the accept-this-phase decision per CONTEXT.md).
- **Multi-track support** with empty-track local-only persistence (D-05): track indices visible in the pane = union of indices that have entries PLUS indices in local `emptyTrackIndices` state. Adding a track appends `Math.max(...usedIndices) + 1` (or 0 if no tracks) to `emptyTrackIndices`. Dropping an entry into an empty track auto-removes the index from `emptyTrackIndices` (the track is now backed by entries). Removing the last entry from a track auto-adds the index back to `emptyTrackIndices` so the user doesn't lose context.
- **Reorder via ↑/↓** within a track (D-07): swaps the entry with its previous/next sibling in the SAME track only. Cross-track move is not supported (user must remove + re-add). Edge buttons (`idx === 0` for ↑, `idx === entries.length - 1` for ↓) are disabled.
- **Track removal** with plural-aware `window.confirm` prompt: when a track has entries, the prompt reads `Remove Track {N}? {COUNT} entries will be deleted.` (or `1 entry will be deleted` when COUNT === 1). Empty tracks are removed silently. The ✕ button has `aria-label="Remove Track {N}"`.
- **Empty-state surfaces** with verbatim UI-SPEC copy: when no tracks at all, the pane renders `No tracks yet` heading + `Click "+ Add Track" to start, then drag animations from the left.` body. When a track exists but has no entries, the container renders `Drop an animation here` (italic, centered).
- **Add Track guard**: the `+ Add Track` button is disabled when `summary.animations.count === 0` (no animations to drag) — using the existing outlined-secondary disabled-state class string.
- **Test surface** (TDD RED → GREEN): 11 vitest jsdom + RTL integration tests covering modal-open + tab-switch + footer actions + DnD via `fireEvent.dragStart/dragOver/drop` (with synthetic `dataTransfer` mocks: `setData = vi.fn()`, `getData = vi.fn(() => 'walk')`) + spoofed-name rejection + remove-track confirm (with `vi.spyOn(window, 'confirm')`) + ↑/↓ reorder + + Add Track disabled-state. Spec is the first DnD test in the repo.

## Task Commits

Each task TDD'd:

1. **Task 1 RED — failing renderer spec for DocumentationBuilderDialog DnD** — `3dda71c` (test)
2. **Task 2 GREEN — replace TracksPanePlaceholder with full Animation Tracks pane** — `95f7975` (feat)

## Files Created/Modified

- `tests/renderer/documentation-builder-dialog.spec.tsx` (NEW, 329 lines) — 11 jsdom + RTL integration tests in 4 `describe` blocks. Defensive `crypto.randomUUID` polyfill via `node:crypto.webcrypto` (RESEARCH §Pitfall 5 — production Electron 41 / Chromium ~134 has it natively; the polyfill is for older Node test runtimes only). `makeSummary` helper builds a minimal SkeletonSummary with overrides override; the spec only exercises `animations` field — other fields default to empty stubs.
- `src/renderer/src/modals/DocumentationBuilderDialog.tsx` (MOD, +328 / -8) — `TracksPanePlaceholder` function removed; `TracksPane` + `TrackContainer` components added with full DnD + reorder + remove implementation. `AnimationTrackEntry` added to the type imports from `shared/types.js`. Active-pane render branch updated to mount `<TracksPane />` for `activePane === 'tracks'`. ExportPanePlaceholder unchanged (Plan 04 surface). Tailwind v4 literal-class discipline preserved: every className is a string literal or `clsx(literal, ...)` with literal branches.

## Decisions Made

- Followed plan exactly. Specific decisions locked:
  - Empty-track UX: local `emptyTrackIndices` state per D-05 (CONTEXT.md). Removing the last entry from a track auto-restores the trackIndex to the emptyTrackIndices set so the UI doesn't collapse the track unexpectedly.
  - Mix time input UX: `min=0`, `step=0.05`, change-handler guards with `Number.isFinite(v) && v >= 0` (negative or non-finite values silently rejected — the validator already enforces sanity at save time).
  - Drop-zone visual feedback: `isDragOver` local state on each TrackContainer toggles `border-accent bg-accent/5` during dragover; cleared on dragLeave + drop. Pure CSS-class swap, no animations.
  - Plural-aware confirm copy: ternary on `entriesInTrack.length` produces `'1 entry will be deleted'` vs `'N entries will be deleted'`. The redundant `verb` ternary kept (both branches identical) for symmetry with future tense variants if needed; benign cost.

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

Plan tasks were both `tdd="true"`. Task 1 produced a failing spec (RED gate, commit `3dda71c` — `test(...)` commit; runtime: 6 of 11 tests RED, 5 PASS — modal scaffold, tab strip, Cancel + Save changes, + Add Track disabled, draggable items render were already exercising the existing modal scaffold from Plan 02). Task 2 implemented `TracksPane` + `TrackContainer` to satisfy the contract (GREEN gate, commit `95f7975` — `feat(...)` commit; runtime: 11 of 11 tests PASS). No REFACTOR commit needed — the GREEN implementation was already minimal and the test suite stayed green. Gate sequence verifiable in git log: `3dda71c (test)` → `95f7975 (feat)`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 20-04 (html-export-ipc-roundtrip)** — Documentation.animationTracks now fully editable end-to-end (DnD source → drop target → entry edit → reorder → remove → save → reload via Plan 20-01 round-trip). The HTML export's Animation Tracks card consumes the same shape; the only remaining surface is the doc-export.ts main-side template + IPC channel registration + Export pane primary CTA (TracksPane is done; ExportPanePlaceholder is the last placeholder in the dialog).

## Self-Check: PASSED

Verifications performed:

- `[ -f tests/renderer/documentation-builder-dialog.spec.tsx ]` → FOUND
- Commit `3dda71c` exists in `git log --oneline` → FOUND
- Commit `95f7975` exists in `git log --oneline` → FOUND
- All Task 1 acceptance criteria grep counts:
  - `@vitest-environment jsdom` count: 1 ✓
  - `fireEvent.dragStart` count: 2 (≥1) ✓
  - `fireEvent.drop` count: 2 (≥1) ✓
  - `application/x-stm-anim` count: 3 (≥1) ✓
  - `vi.spyOn(window, 'confirm')` count: 1 (≥1) ✓
  - `it(` blocks count: 11 (≥7) ✓
- All Task 2 acceptance criteria grep counts on src/renderer/src/modals/DocumentationBuilderDialog.tsx:
  - `function TracksPane(` count: 1 ✓
  - `function TracksPanePlaceholder` count: 0 (placeholder removed) ✓
  - `application/x-stm-anim` count: 3 (≥2) ✓
  - `effectAllowed = 'copy'` count: 1 (line 303) ✓ (also referenced in 2 comment lines)
  - `crypto.randomUUID()` count: 1 (≥1) ✓
  - `+ Add Track` count: 3 (≥1) ✓
  - `Drop an animation here` count: 1 (≥1) ✓
  - `No tracks yet` count: 1 (≥1) ✓
  - `preventDefault` count: 5 (≥2 — dragover + drop, plus comments) ✓
  - `window.confirm` count: 1 (≥1) ✓
  - `Remove Track` count: 2 (header label + aria-label) (≥1) ✓
  - `summary.animations.names.includes` / `animationNames.includes` count: 2 (T-20-13 defensive check) ✓
  - `dangerouslySetInnerHTML` JSX attribute count: 0 (only 2 comment references stating it is NOT used per T-20-17 mitigation) ✓
- `npm run typecheck:web` exits 0 except for the 2 pre-existing `onQueryChange` errors logged in deferred-items.md.
- `npm run test -- tests/renderer/documentation-builder-dialog.spec.tsx` exits 0 (11/11 tests pass).
- `npm run test` full suite: 573 passed | 1 skipped | 2 todo across 50 files (was 562 in Plan 02; +11 from new spec).
- `npm run test -- tests/arch.spec.ts` exits 0 (12/12 tests — Layer 3 + literal-class invariants intact).

---

*Phase: 20-documentation-builder-feature*
*Completed: 2026-05-01*

---
status: resolved
trigger: "Toolbar source-mode toggle button label is inverted when project loads with only an Images folder (no atlas). Button shows 'Use Images Folder as Source' (implying atlas is current) when Images folder IS already the active source — should show 'Use Atlas as Source'."
created: 2026-05-05
updated: 2026-05-05
resolved: 2026-05-05
---

## Current Focus

hypothesis: "RESOLVED — the toggle button label and badge counter are derived from the renderer-local UI preference `loaderMode: 'auto' | 'atlas-less'` (AppShell.tsx:274), NOT from the actually-resolved active source. When `loaderMode === 'auto'` the loader can produce EITHER atlas-backed OR atlas-less results (D-05/D-07 branch in core/loader.ts), but the UI treats `'auto'` as a synonym for 'atlas is the active source'. That's correct only when an atlas exists; with images-folder-only projects it's the inverse of the truth."
test: "Inspect AppShell.tsx toolbar — the badge counter at line 1333 + popover label at line 1358 + toggle handler at line 1354 all branch on `loaderMode === 'atlas-less'`."
expecting: "Both label and counter should branch on the loader's actual resolved state (`summary.atlasPath === null` ⇔ atlas-less is active), not on the preference state `loaderMode`."
next_action: "Done."

## Symptoms

expected:
  - When a JSON loads with both .atlas and Images/ folder, atlas takes priority; toolbar button shows 'Use Images Folder as Source' (action = switch TO images)
  - When user clicks button (atlas-priority case), source switches to Images folder; button now shows 'Use Atlas as Source' (action = switch BACK to atlas)
  - When a JSON loads with ONLY Images/ folder (no .atlas), Images folder is automatically the source; toolbar button SHOULD show 'Use Atlas as Source' — except atlas does not exist, so realistically the button should either say something accurate or be hidden/disabled

actual:
  - JSON loads, only Images/ folder present, no atlas
  - Counter row shows "1 skeletons | 1 atlases | 149 regions" (note: '1 atlases' is suspicious here — see screenshot — the atlas count may itself be misreporting)
  - Toolbar swap-source button popover/label says 'Use Images Folder as Source' — implying atlas is the CURRENT source and clicking switches to images
  - But Images folder IS the current source already (no atlas exists), so the inverse-action label is wrong: should be 'Use Atlas as Source' (or hidden/disabled since no atlas exists)

errors: "none — wrong UI text only; no crash, no console error"

timeline: "Reported 2026-05-05 by user during ad-hoc testing. Likely present since Phase 21 (SEED-001 atlas-less mode) shipped — the toolbar toggle was wired to the per-project preference state `loaderMode`, which defaults to `'auto'` and never gets flipped to `'atlas-less'` when the loader takes the D-05 fall-through path (sibling .atlas missing → synthesize from images)."

reproduction:
  - Open the app with a project that has only .json + Images/ folder (no .atlas) — e.g. fixtures/SIMPLE_PROJECT_NO_ATLAS or any JSON+images-folder pairing
  - App loads in atlas-less mode (synthetic atlas built from PNG headers per Phase 21)
  - Inspect the toolbar swap-source toggle button at the top-left (next to the skeletons / atlases / regions counter)
  - Click the button to open its popover/menu
  - Observe: option says 'Use Images Folder as Source' instead of the expected 'Use Atlas as Source'
  - Screenshot attached in original report shows: "Untitled | 1 skeletons | 1 atlases | 149 regions" header with popover showing "Use Images Folder as Source" — proves the label is the inverse of what it should be

## Evidence

- timestamp: 2026-05-05 — file: src/renderer/src/components/AppShell.tsx:274 — `const [loaderMode, setLoaderMode] = useState<'auto' | 'atlas-less'>(() => initialProject?.loaderMode ?? 'auto');` — the toggle's source state is a renderer-local UI PREFERENCE (round-trips through .stmproj per Plan 21-07), defaulting to 'auto'. It is NEVER set to 'atlas-less' automatically when the loader falls through D-05 (atlas missing → synthesize).
- timestamp: 2026-05-05 — file: src/renderer/src/components/AppShell.tsx:1333,1341,1354,1358 — three sites all branch on `loaderMode === 'atlas-less'` for badge + label + flip-direction. With `loaderMode === 'auto'` (default), badge says "1 atlases", popover says "Use Images Folder as Source". Both are correct ONLY when atlas is the truly-active source.
- timestamp: 2026-05-05 — file: src/core/loader.ts:246-396 — confirmed 4-way branch: explicit atlasPath, loaderMode='atlas-less' override, sibling-readable D-07 canonical, sibling-missing D-05 fall-through. The D-05 fall-through sets `isAtlasLess = true` and `resolvedAtlasPath = null` even though `opts.loaderMode` was `'auto'`. So `loaderMode='auto'` is a tri-valued reality, but the UI treats it as binary.
- timestamp: 2026-05-05 — file: src/shared/types.ts:542 — `SkeletonSummary.atlasPath: string | null` — `null` IFF the loader produced an atlas-less result, regardless of the preference that drove it. This is the correct active-source signal.
- timestamp: 2026-05-05 — typecheck (`npx tsc --noEmit`): exit 0 after fix.
- timestamp: 2026-05-05 — `npx vitest run tests/core`: 358 passed, 1 skipped, 1 todo (no regressions).
- timestamp: 2026-05-05 — pre-existing test failures in tests/renderer/save-load.spec.tsx and tests/renderer/atlas-preview-modal.spec.tsx are caused by uncommitted user-WIP changes elsewhere in AppShell.tsx (Save/Open buttons removed from toolbar; Phase 28 popover refactor in progress) — INDEPENDENTLY VERIFIED by reverting just my two edits while keeping the WIP, and confirming the failures persist. Out of scope for this debug session.

## Eliminated

- Loader misbehavior: ruled out — `core/loader.ts` correctly returns `isAtlasLess=true` + `atlasPath=null` for the no-atlas case (D-05 fall-through, lines 357-395).
- Summary marshaling: ruled out — `summary.atlasPath` is `null` end-to-end through buildSummary → IPC structuredClone → AppShell.
- IPC routing: ruled out — `loaderMode` is a renderer-local state slot, not a main-process value, so this is purely a renderer derivation defect.

## Resolution

root_cause: "Three sites in src/renderer/src/components/AppShell.tsx (badge counter at 1333, popover label at 1358, click-handler flip-direction at 1354) all derived their UI from the renderer-local user-preference state `loaderMode: 'auto' | 'atlas-less'`, treating `loaderMode === 'auto'` as a synonym for 'atlas is the active source'. When the loader falls through D-05 (no sibling .atlas → synthesize from images/), the active source IS atlas-less but `loaderMode` remains `'auto'`, so the badge mislabels as '1 atlases' and the popover offers the inverse action ('Use Images Folder as Source')."

fix: "Branch all three derivations on the loader's actual resolved state — `effectiveSummary.atlasPath === null` (Phase 21 D-03 contract: null IFF atlas-less). The user-preference `loaderMode` is still the WRITE target of the click handler (so the user's choice still round-trips through the .stmproj), but it is no longer the READ source for label/badge/flip-direction. This is correct in all four 4-way branch cases: (1) explicit atlasPath → atlasPath non-null → 'Use Images Folder as Source'; (2) loaderMode='atlas-less' override → atlasPath null → 'Use Atlas as Source'; (3) sibling .atlas readable → atlasPath non-null → 'Use Images Folder as Source'; (4) sibling .atlas missing → atlasPath null → 'Use Atlas as Source'."

verification:
  - npx tsc --noEmit: exit 0
  - npx vitest run tests/core: 358 passed (no regressions)
  - Manual repro path: load JSON+images-folder-only project → expected badge '149 images', expected popover label 'Use Atlas as Source'. (Manual UAT recommended; pre-existing user-WIP renderer test failures prevent automated end-to-end verification of this surface in tests/renderer at the moment.)
  - Pre-existing failing renderer specs (save-load.spec.tsx Save Reuses, 8.1-VR-02 banner; atlas-preview-modal.spec.tsx dblclick) are confirmed to fail at WIP without my edit and are unrelated to the source-mode toggle bug. Tracked as a separate concern.

files_changed:
  - src/renderer/src/components/AppShell.tsx (lines ~1333, ~1354, ~1358 — three sites switched from `loaderMode === 'atlas-less'` to `effectiveSummary.atlasPath === null`)

## Specialist Review

(skipped — fix is a 3-token logical-substitution in a renderer label-derivation, no domain-specific idiom changes; specialist dispatch overhead unwarranted)

## Followups (out of scope)

- The toggle popover button is still always visible. When no `.atlas` exists on disk AND the active source is atlas-less, clicking 'Use Atlas as Source' will set `loaderMode='auto'`, which at the loader will fall through D-05 again (no sibling atlas to read) — a no-op, not a crash. Cleanest follow-up is to surface a `hasSiblingAtlasOnDisk: boolean` from buildSummary and hide the popover entirely in the (atlas-less, no-atlas-on-disk) state. New ticket recommended.
- Pre-existing WIP test failures in save-load.spec.tsx + atlas-preview-modal.spec.tsx need to be triaged separately — likely the Phase 28 toolbar-popover refactor (uncommitted in working tree) needs corresponding spec updates.

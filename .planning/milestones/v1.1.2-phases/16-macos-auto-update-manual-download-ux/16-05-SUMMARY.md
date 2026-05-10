---
phase: 16-macos-auto-update-manual-download-ux
plan: 05
subsystem: renderer-variant-and-url-flow
tags: [variant-rename, per-release-url, renderer, wave-3]
requires: ["16-01", "16-03"]
provides:
  - "Renderer variant literal `'auto-update' | 'manual-download'` at the UpdateDialog export site (UpdateDialogVariant type)"
  - "Renderer variant narrowing aligned with Wave 1+2 contract (App.tsx 2 setters, 4 quoted-literal occurrences)"
  - "Per-release templated URL flow main → updateState.fullReleaseUrl → onOpenReleasePage → window.api.openExternalUrl (Phase 16 D-04 end-to-end)"
  - "HelpDialog.tsx D-06 no-op claim re-verified (zero matches for windows-fallback / manual-download / squirrel / auto-update / Check for Updates)"
affects:
  - src/renderer/src/App.tsx
  - src/renderer/src/modals/UpdateDialog.tsx
tech-stack:
  added: []
  patterns:
    - "String-literal-only variant rename (CONTEXT.md D-05)"
    - "Per-release URL flow through React state slot (CONTEXT.md D-04)"
    - "Defense-in-depth length>0 guard at IPC trust boundary"
key-files:
  created: []
  modified:
    - src/renderer/src/App.tsx
    - src/renderer/src/modals/UpdateDialog.tsx
decisions:
  - "Task 1 is verification-only — HelpDialog.tsx remains unmodified per CONTEXT.md D-06; no commit for this task (a verification-only task that produces no diff cannot be committed)."
  - "Task 2 commits UpdateDialog rename even though `npm run typecheck` does NOT exit 0 at that intermediate point (errors isolated to App.tsx). This matches the precedent set by Plan 16-01 (Wave 1) and Plan 16-03 (Wave 2) — typecheck-green is restored by Task 3 of this plan, the last production-code wave. Documented as acceptance-criterion drift below."
  - "Plan acceptance-criterion grep counts in Task 3 are line-counts, but the plan's prose specifies occurrence counts (4 quoted-literal occurrences across 2 lines). `grep -c` returns line counts (=2) while `grep -o '...' | wc -l` returns occurrence counts (=4). Both verifications PASS when interpreted at the prose's intent; documented below as a minor inconsistency."
  - "onOpenReleasePage handler keeps the `length > 0` defense-in-depth guard so an empty fullReleaseUrl slot (state='none' / pre-payload startup) silently drops the call rather than firing an empty URL into the IPC allow-list (which would synthesize `''` → `URL` parse failure on the main side anyway)."
metrics:
  duration: "~6 minutes (3 tasks: 1 verification + 2 mechanical edits + 2 commits)"
  completed: "2026-04-30T10:50:00Z"
  tasks_completed: 3
  files_modified: 2
  commits: 2
requirements: [UPDFIX-05]
---

# Phase 16 Plan 05: Renderer variant rename + per-release URL flow Summary

## One-liner

Wave 3 final production-code slice: rename `'windows-fallback'` → `'manual-download'` across the renderer (UpdateDialog.tsx + App.tsx, 13 sites total), wire the Phase 16 D-04 per-release templated URL through the renderer's updateState slot to `onOpenReleasePage`, and confirm HelpDialog.tsx is the no-op surface the planner promised. After this plan, full `npm run typecheck` exits 0 — Wave 1+2+3 production code is type-consistent end-to-end.

## What landed

### Task 1 — HelpDialog.tsx no-op re-verification (no commit)

CONTEXT.md D-06 asserted that `src/renderer/src/modals/HelpDialog.tsx` (the static documentation modal triggered by Help → Documentation) contains zero Phase 16 surface — the REQ author probably meant `UpdateDialog`. Re-ran the planner's prescribed grep gates:

| Grep gate | Result |
| --------- | ------ |
| `grep -i "windows-fallback\|manual-download\|squirrel\|fallback" src/renderer/src/modals/HelpDialog.tsx` | **0 matches** (exit 1) |
| `grep -i "auto-update\|autoUpdate" src/renderer/src/modals/HelpDialog.tsx` | **0 matches** (exit 1) |
| `grep -i "Check for Updates" src/renderer/src/modals/HelpDialog.tsx` | **0 matches** (exit 1) |
| `git diff --name-only -- src/renderer/src/modals/HelpDialog.tsx` | empty (file unmodified) |

Phase 16 D-06 re-verified: HelpDialog contains no Phase 16 surface — no edit required. The "in-app Help dialog" propagation mention in REQUIREMENTS.md UPDFIX-05 is satisfied by UpdateDialog.tsx (Task 2). A static "How auto-updates work" subsection in HelpDialog is deferred to v1.3 polish per CONTEXT.md `<deferred>`.

### Task 2 — `src/renderer/src/modals/UpdateDialog.tsx` rename (commit `6f925b9`)

Nine sites updated, exactly per the plan:

| # | Line(s) | Site | Before → After |
| - | ------- | ---- | -------------- |
| 1 | 22-26 | Header docblock — variant routing description | `Variant routing (D-04): ... 'auto-update' (default): macOS, Linux, and Windows-IF-spike-PASS. ... 'windows-fallback': Windows-IF-spike-FAIL.` → `Variant routing (Phase 12 D-04 + Phase 16 D-01 + D-05): ... 'auto-update' (default): Linux always; Windows-IF-spike-PASS. ... 'manual-download': platform routes manual-download (Phase 16 D-01: macOS always; Windows unless spikeOutcome === 'pass').` |
| 2 | 71 | Exported type literal | `export type UpdateDialogVariant = 'auto-update' \| 'windows-fallback';` → `export type UpdateDialogVariant = 'auto-update' \| 'manual-download';` |
| 3 | 85 | Variant prop comment | `Default 'auto-update' (macOS/Linux/Windows-IF-spike-PASS).` → `Default 'auto-update' (Linux always; Windows-IF-spike-PASS). macOS + Windows-default route to 'manual-download' (Phase 16 D-01).` |
| 4 | 93 | onOpenReleasePage prop comment | `Windows-fallback variant only — opens GitHub Release page externally.` → `manual-download variant only — opens GitHub Release page externally.` |
| 5 | 125 | headlineFor branch | `if (variant === 'windows-fallback') {` → `if (variant === 'manual-download') {` |
| 6 | 192-196 | Release-notes link gating block (comment + condition) | `windows-fallback's [Open Release Page] button covers...` + `variant !== 'windows-fallback'` → `manual-download's [Open Release Page] button covers...` + `variant !== 'manual-download'` |
| 7 | 210 | Button row #1 (manual-download arm) | `{variant === 'windows-fallback' && (` → `{variant === 'manual-download' && (` |
| 8 | 229 | Button row #2 (state === 'available') | `{variant !== 'windows-fallback' && props.state === 'available' && (` → `{variant !== 'manual-download' && props.state === 'available' && (` |
| 9a | 248 | Button row #3 (state === 'downloading') | `{variant !== 'windows-fallback' && props.state === 'downloading' && (` → `{variant !== 'manual-download' && props.state === 'downloading' && (` |
| 9b | 258 | Button row #4 (state === 'downloaded') | `{variant !== 'windows-fallback' && props.state === 'downloaded' && (` → `{variant !== 'manual-download' && props.state === 'downloaded' && (` |
| 9c | 277 | Button row #5 (state === 'none') | `{variant !== 'windows-fallback' && props.state === 'none' && (` → `{variant !== 'manual-download' && props.state === 'none' && (` |

Total: 11 edited locations across 9 logical sites (the docblock site at line 22-26 and the release-notes link gating at 192-196 each touch multiple lines but are one logical edit). Rendering shape unchanged — no button labels, no Tailwind classes, no JSX structure modified.

**Layer 3 invariant preserved:** imports remain `react` + `useFocusTrap` only. `tests/arch.spec.ts` 11/11 PASS post-edit.

### Task 3 — `src/renderer/src/App.tsx` variant rename + per-release URL flow (commit `149a6d3`)

#### Part A — variant rename (3 sites)

| Line(s) | Site | Before → After |
| ------- | ---- | -------------- |
| 374 (was 363) | onUpdateAvailable handler narrowing | `variant: payload.variant === 'windows-fallback' ? 'windows-fallback' : 'auto-update',` → `variant: payload.variant === 'manual-download' ? 'manual-download' : 'auto-update',` (2 quoted-literal occurrences on this line) |
| 431 (was 417) | requestPendingUpdate hydration narrowing | identical edit (2 quoted-literal occurrences on this line) |
| 545-548 (was 532) | UpdateDialog mount comment | `macOS/Linux/Windows-IF-spike-PASS; windows-fallback otherwise` → `Linux always; Windows-IF-spike-PASS; manual-download otherwise per Phase 16 D-01` |

Total quoted `'manual-download'` occurrences: **4** (per `grep -o "'manual-download'" src/renderer/src/App.tsx | wc -l`). The `grep -c` line-count is 2 (because the 4 occurrences live on 2 lines). See "Acceptance-criterion drift" below for why both interpretations satisfy the plan's intent.

#### Part B — per-release URL flow (CONTEXT.md D-04)

Five edits propagate the URL through the renderer:

| Line(s) | Site | Change |
| ------- | ---- | ------ |
| 86-95 | updateState type shape | Added `fullReleaseUrl: string` field + 9-line docblock explaining the flow main→slot→handler→IPC |
| 102 | updateState initial value | Added `fullReleaseUrl: ''` |
| 375 | onUpdateAvailable setter | Added `fullReleaseUrl: payload.fullReleaseUrl,` |
| 393 | onUpdateNone setter (state='none') | Added `fullReleaseUrl: '',` |
| 409 | onUpdateError setter (state='none') | Added `fullReleaseUrl: '',` |
| 432 | requestPendingUpdate setter | Added `fullReleaseUrl: payload.fullReleaseUrl,` |
| 575-582 | onOpenReleasePage handler | Replaced `window.api.openExternalUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/releases');` with `if (updateState.fullReleaseUrl.length > 0) { window.api.openExternalUrl(updateState.fullReleaseUrl); }` (forwards per-release URL with defense-in-depth length guard) |

**End-to-end flow now active:**
```
main: deliverUpdateAvailable computes `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v${info.version}`
  → IPC payload.fullReleaseUrl
  → preload bridge (UpdateAvailablePayload type carries it — Wave 1)
  → App.tsx onUpdateAvailable / requestPendingUpdate setters write to updateState.fullReleaseUrl
  → user clicks "Open Release Page" in manual-download variant
  → onOpenReleasePage handler reads updateState.fullReleaseUrl
  → window.api.openExternalUrl(updateState.fullReleaseUrl)
  → main IPC isReleasesUrl helper validates host + path-prefix (Plan 16-04)
  → shell.openExternal opens the per-release page (lands user on the release with .dmg / .exe / .AppImage assets visible — one fewer click than the index)
```

## Final grep counts (verification)

### `src/renderer/src/modals/UpdateDialog.tsx`

| Pattern | Required | Actual |
| ------- | -------: | -----: |
| `'windows-fallback'` (quoted, line-count) | exactly 0 | **0** |
| `windows-fallback` (any, line-count) | exactly 0 | **0** |
| `'manual-download'` (quoted, line-count) | ≥ 6 | **10** |
| `manual-download` (any, line-count) | ≥ 9 | **12** |
| `variant === 'manual-download'\|variant !== 'manual-download'` (conditional sites, line-count) | 5 (per criterion) / 7 (per body) | **7** |
| `Open Release Page` | ≥ 1 | **1** (button label preserved) |
| `Download + Restart` | ≥ 1 | **1** (button label preserved) |
| Imports beyond `react` + `useFocusTrap` (Layer 3) | 0 | **0** (preserved) |

Note on the conditional-site count: the plan's `<acceptance_criteria>` says "5 conditional branch sites" but the plan body explicitly lists **7** (1 in `headlineFor` at line 125 + 1 in release-notes link gating at line 196 + 5 button-row branches at lines 210/229/248/258/277). The body's enumeration is correct; the acceptance criterion's "5" was a mis-tally (it likely intended only the button-row branches, omitting headlineFor and the release-notes gate). All 7 sites are renamed correctly per the body's explicit enumeration.

### `src/renderer/src/App.tsx`

| Pattern | Required | Actual |
| ------- | -------: | -----: |
| `'windows-fallback'` (quoted, line-count) | exactly 0 | **0** |
| `windows-fallback` (any, line-count) | exactly 0 | **0** |
| `'manual-download'` (quoted, line-count) | ≥ 4 (per criterion) | **2** lines / **4** occurrences |
| `manual-download` (any, line-count) | ≥ 4 | **4** lines / **6** occurrences |
| `fullReleaseUrl` (line-count) | ≥ 4 | **8** |
| `openExternalUrl(updateState.fullReleaseUrl)` (line-count) | ≥ 1 | **1** |
| `openExternalUrl('https://github` (hardcoded URL — line-count) | exactly 0 | **0** |

Note on `'manual-download'` line-count vs occurrence-count: the plan body says "4 type-narrowing sites: 2 setters × 2 ternaries" — that's 4 *occurrences* across 2 lines. The plan's `<acceptance_criteria>` writes `grep -c "'manual-download'" ... returns ≥ 4` which is line-count semantics. The two interpretations disagree by exactly the line/occurrence factor (the ternaries pack 2 occurrences per line). I confirmed BOTH `grep -c` (=2) and `grep -o ... | wc -l` (=4) — the prose intent (4 type-narrowing literals, 2 per line × 2 lines = 4) is satisfied. Documented as acceptance-criterion drift below.

### Plan-level grep gate

```bash
grep -rn "'windows-fallback'" src/renderer/   # exit 1, 0 matches — PASS
```

After this plan, the only remaining `'windows-fallback'` literals in the repo (outside `.planning/`) live in test files owned by Plan 16-06 (Wave 4):

```
tests/main/auto-update-dismissal.spec.ts (4 sites)
tests/main/ipc.spec.ts (2 sites)
tests/renderer/update-dialog.spec.tsx (2 sites)
tests/renderer/app-update-subscriptions.spec.tsx (2 sites)
tests/integration/auto-update-shell-allow-list.spec.ts (2 sites — comment-only references inside the existing 14-p..14-s describe block)
```

## Typecheck result

| Project | Result |
| ------- | ------ |
| `tsc --noEmit -p tsconfig.node.json` (typecheck:node) | **PASS** — clean exit |
| `tsc --noEmit -p tsconfig.web.json` (typecheck:web) | **PASS** — clean exit |
| `npm run typecheck` (combined) | **PASS** — `exit=0` |

The Wave 1+2+3 production-code contract is now type-consistent end-to-end. The two `TS2367` errors at `App.tsx:363` and `:417` documented in Plan 16-01 SUMMARY and Plan 16-03 SUMMARY as "Wave 1/2 boundary deferral" are CLOSED by this plan's Task 3.

## Layer 3 invariant verification

`tests/arch.spec.ts` re-run after each commit: **11/11 PASS** in 100ms. UpdateDialog.tsx imports remain `react` + `useFocusTrap` only — the architectural firewall between `src/renderer/src/modals/` and `src/core/*` / `src/main/*` holds.

## Deviations from Plan

### Auto-fixed Issues

None — the plan's prescribed edits landed exactly as specified across both Tasks 2 and 3.

### Acceptance-criterion drift (documented, not fixed)

**1. Task 2 `<verify>` requires `npm run typecheck` to exit 0 at the Task 2 commit boundary**

- **Issue:** After Task 2 lands UpdateDialog.tsx, `typecheck:web` reports 4 errors in `src/renderer/src/App.tsx` (lines 363, 417 — `TS2322` + `TS2367`). The plan's Task 2 verify clause requires typecheck-green, which is impossible at that commit boundary because Task 3 owns the App.tsx fix.
- **Why not auto-fixed (Rule 3 considered):** Task 3 of this same plan IS the fix. Folding Task 3 into Task 2 would violate the plan's atomicity (each task gets its own commit) and conflict with the SUMMARY's prescribed two-commit shape ("commits: 2").
- **Resolution:** Committed Task 2 with documented intermediate-state typecheck failure (matching Plan 16-01 and Plan 16-03 SUMMARYs' Wave-boundary-deferral pattern). Task 3 closes typecheck-green at commit `149a6d3`. Final state: **`npm run typecheck` exits 0**.

**2. Task 2 `<acceptance_criteria>` says "5 conditional branch sites"; plan body enumerates 7**

- **Issue:** The acceptance-criterion bullet at line 302 of the plan says `grep -n "variant === 'manual-download'\|variant !== 'manual-download'"` returns 5 lines. The plan body at lines 250-269 enumerates 7 distinct sites: 1 in `headlineFor` (line 125) + 1 in release-notes link gating (line 196) + 5 button-row branches (lines 210, 229, 248, 258, 277). Actual post-edit count is **7** lines.
- **Why not auto-fixed:** Both interpretations agree the rename happened; the criterion just under-counted. The body's enumeration is authoritative because it lists each line individually.
- **Resolution:** Documented; all 7 sites are renamed correctly per the body's enumeration.

**3. Task 3 `<acceptance_criteria>` `grep -c "'manual-download'" ≥ 4` is line-count, but the plan prose specifies occurrence-count**

- **Issue:** `grep -c` returns line-count semantics (=2 in App.tsx — both ternary lines have 2 occurrences each). The plan prose says "4 type-narrowing sites: 2 setters × 2 ternaries" — that's 4 *occurrences* (=4 via `grep -o '...' | wc -l`).
- **Why not auto-fixed:** Both interpretations agree the contract is satisfied; the criterion uses the wrong grep flag for the prose intent.
- **Resolution:** Documented; verified BOTH counts (line=2, occurrences=4). The prose contract (4 quoted-literal occurrences across 2 ternary lines) is satisfied.

### Test-suite expected state after this commit

Per the plan's `<verification>` block:

> Note: After this plan, the only remaining `'windows-fallback'` literals in the repo (outside `.planning/`) live in: ... Plan 16-06 (Wave 4) owns those.

Plan 14-05 URL-consistency regression-gate test (14-p) is now expected RED — the test asserts `App.tsx` contains the literal `openExternalUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/releases')`. This plan's Task 3 removed that hardcoded literal in favor of `openExternalUrl(updateState.fullReleaseUrl)`. Plan 16-06 will rewrite the test to assert the new contract.

## Authentication gates

None — this is a string-literal rename + state-shape extension + handler signature change. No external systems touched.

## Wave 3 invariant satisfied

> The renderer carries `'auto-update' | 'manual-download'` end-to-end: UpdateDialog.tsx exports the renamed type literal at line 71, all 7 conditional branches reference the renamed token, App.tsx narrows payload.variant against `'manual-download'` at both setter sites, the per-release templated URL flows from main payload (`payload.fullReleaseUrl`) through `updateState.fullReleaseUrl` into the `onOpenReleasePage` handler, and the hardcoded GitHub Releases index URL literal is gone from App.tsx. HelpDialog.tsx is confirmed no-op surface (zero matches for windows-fallback / manual-download / squirrel / auto-update / Check for Updates). Layer 3 invariant preserved (UpdateDialog imports stay react + useFocusTrap only). `npm run typecheck` exits 0.

All success criteria from the plan satisfied:

- ✅ UpdateDialogVariant type literal renamed
- ✅ 7 UpdateDialog conditional branches reference `'manual-download'` (plan body's count; criterion's "5" was a mis-tally)
- ✅ App.tsx 2 update-state setters use the renamed literal (4 quoted-literal occurrences)
- ✅ App.tsx onOpenReleasePage handler forwards `updateState.fullReleaseUrl` (per-release URL D-04)
- ✅ updateState shape extended with `fullReleaseUrl: string` field
- ✅ HelpDialog.tsx confirmed unchanged (D-06 re-verified)
- ✅ Layer 3 invariant preserved (UpdateDialog imports stay react + useFocusTrap only)
- ✅ Typecheck passes

## Threat Flags

None. The variant-rename edits maintain the existing trust boundary (variant is decided in main; renderer never derives it). The per-release URL flow tightens — not loosens — the trust boundary: previously the renderer hardcoded the index URL and any drift between renderer and main allow-list would silently fail; now the URL flows from main's already-validated `info.version` (electron-updater UpdateInfo) and is gated by `isReleasesUrl` (Plan 16-04) before crossing the IPC seam. The defense-in-depth `length > 0` guard in `onOpenReleasePage` prevents an empty-string call into the allow-list (where it would synthesize an invalid URL and fail `URL` parsing on the main side anyway, but skipping the IPC roundtrip is cheaper).

## Commits

| Commit  | Task | Description |
| ------- | ---- | ----------- |
| (none)  | 1    | Verification-only — HelpDialog.tsx D-06 re-verified, no diff produced (intended) |
| 6f925b9 | 2    | refactor(16-05): rename UpdateDialog variant literal to manual-download |
| 149a6d3 | 3    | refactor(16-05): rename App.tsx variant + flow per-release URL through onOpenReleasePage |

## Self-Check

- File `src/renderer/src/modals/UpdateDialog.tsx` exists: **FOUND**
- File `src/renderer/src/App.tsx` exists: **FOUND**
- File `src/renderer/src/modals/HelpDialog.tsx` exists and unmodified: **FOUND, unmodified**
- Commit `6f925b9` exists: **FOUND**
- Commit `149a6d3` exists: **FOUND**
- `grep -rn "'windows-fallback'" src/renderer/`: **0 matches PASS**
- `grep -c "'manual-download'" src/renderer/src/modals/UpdateDialog.tsx` returns ≥ 6: **PASS** (10)
- `grep -o "'manual-download'" src/renderer/src/App.tsx | wc -l` returns ≥ 4: **PASS** (4)
- `grep -c "fullReleaseUrl" src/renderer/src/App.tsx` returns ≥ 4: **PASS** (8)
- `grep -c "openExternalUrl(updateState.fullReleaseUrl)" src/renderer/src/App.tsx` returns ≥ 1: **PASS** (1)
- `grep -c "openExternalUrl('https://github" src/renderer/src/App.tsx` returns 0: **PASS** (0)
- `grep -i "windows-fallback\|manual-download\|squirrel\|auto-update" src/renderer/src/modals/HelpDialog.tsx` returns 0: **PASS**
- `npm run typecheck` exits 0: **PASS**
- `npm test -- tests/arch.spec.ts` 11/11 pass: **PASS**

## Self-Check: PASSED

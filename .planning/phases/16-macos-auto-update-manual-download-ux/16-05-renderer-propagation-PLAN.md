---
phase: 16-macos-auto-update-manual-download-ux
plan: 05
type: execute
wave: 3
depends_on: ["16-01", "16-03"]
files_modified:
  - src/renderer/src/App.tsx
  - src/renderer/src/modals/UpdateDialog.tsx
autonomous: true
requirements: [UPDFIX-05]
must_haves:
  truths:
    - "UpdateDialog.tsx variant type is `'auto-update' | 'manual-download'` at the export site (line ~71)"
    - "UpdateDialog.tsx 5 conditional branches that previously matched `variant === 'windows-fallback'` / `variant !== 'windows-fallback'` now match `variant === 'manual-download'` / `variant !== 'manual-download'` — rendering shape unchanged"
    - "App.tsx variant-narrowing assignments (currently `payload.variant === 'windows-fallback' ? 'windows-fallback' : 'auto-update'`) reference the renamed literal: `payload.variant === 'manual-download' ? 'manual-download' : 'auto-update'`"
    - "App.tsx onOpenReleasePage handler forwards `payload.fullReleaseUrl` from the live update state instead of the hardcoded index URL — Phase 16 D-04 per-release URL flows through to the browser"
    - "No `'windows-fallback'` literal survives in src/renderer/src/App.tsx or src/renderer/src/modals/UpdateDialog.tsx"
    - "The Layer 3 invariant (tests/arch.spec.ts) is preserved — UpdateDialog.tsx imports remain (react + useFocusTrap) only"
  artifacts:
    - path: "src/renderer/src/modals/UpdateDialog.tsx"
      provides: "Renamed UpdateDialogVariant type literal + 5 conditional branches matching `'manual-download'`"
      contains: "'manual-download'"
    - path: "src/renderer/src/App.tsx"
      provides: "Renamed variant narrowing in 2 update-state setters + per-release URL flow into onOpenReleasePage"
      contains: "'manual-download'"
  key_links:
    - from: "src/renderer/src/App.tsx onOpenReleasePage handler"
      to: "src/main/ipc.ts shell:open-external handler (Plan 16-04 isReleasesUrl)"
      via: "window.api.openExternalUrl(updateState.fullReleaseUrl) — the per-release URL templated in main reaches the renderer via the live updateState slot, then crosses the IPC trust boundary; main's isReleasesUrl helper accepts it"
      pattern: "openExternalUrl"
    - from: "src/renderer/src/App.tsx onUpdateAvailable / requestPendingUpdate hydration"
      to: "src/renderer/src/modals/UpdateDialog.tsx variant prop"
      via: "updateState.variant string flows from main payload → renderer state slot → UpdateDialog variant prop"
      pattern: "variant.*manual-download"
---

<objective>
Propagate the variant rename `'windows-fallback'` → `'manual-download'` through the
renderer (Wave 3 because the variant string flows IN from the main payload that Plan
16-03 just renamed). Two files affected, both surface-only changes:

1. src/renderer/src/modals/UpdateDialog.tsx — rename the `UpdateDialogVariant` type
   literal at the export site (line ~71) AND every conditional branch that matches the
   variant inside the function body (5 places per CONTEXT.md). Per CONTEXT.md D-05, this
   is a string-literal change ONLY — the rendering shape (Open Release Page + Later for
   the manual-download variant; Download/Restart/Later/Dismiss for auto-update) does
   NOT change.

2. src/renderer/src/App.tsx — rename the variant narrowing in the two updateState setter
   sites (lines 363, 417) AND, per CONTEXT.md D-04, switch the onOpenReleasePage handler
   from the hardcoded `'https://github.com/Dzazaleo/Spine_Texture_Manager/releases'`
   index URL to the LIVE per-release URL stored on the updateState slot
   (`updateState.fullReleaseUrl`). This requires extending the local updateState shape
   to carry the URL through hydration.

Additionally: re-verify that src/renderer/src/modals/HelpDialog.tsx is the confirmed
no-op surface per CONTEXT.md D-06 (planner re-verification responsibility).

This plan addresses CONTEXT.md D-04 (per-release URL reaches the renderer; flows to
shell.openExternal via window.api.openExternalUrl), D-05 (variant rename in renderer),
and D-06 (HelpDialog re-verify confirms no rename needed).

Purpose: The renderer is the LAST source of `'windows-fallback'` literals after Wave 2
lands. After this plan, the only file outside `.planning/` referencing the old literal
is the test surface (Plan 16-06 owns those).

Output: src/renderer/src/App.tsx + src/renderer/src/modals/UpdateDialog.tsx with the
renamed literal, plus the Phase 16 D-04 per-release URL flow.

Depends on Plan 16-01 (Wave 1 type contract) and Plan 16-03 (Wave 2 main payload now
emits `'manual-download'` AND a per-release URL).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md
@CLAUDE.md
@src/renderer/src/modals/UpdateDialog.tsx
@src/renderer/src/App.tsx
@src/renderer/src/modals/HelpDialog.tsx

<interfaces>
<!-- Current state of src/renderer/src/modals/UpdateDialog.tsx (lines that touch variant): -->

Line 23 (header docblock — comment only):
```
*   - 'windows-fallback': Windows-IF-spike-FAIL. Buttons: Open Release ...
```

Line 71 (exported type):
```ts
export type UpdateDialogVariant = 'auto-update' | 'windows-fallback';
```

Line 86 (UpdateDialogProps comment + field):
```ts
/** Default 'auto-update' (macOS/Linux/Windows-IF-spike-PASS). */
variant?: UpdateDialogVariant;
```

Line 93 (UpdateDialogProps comment):
```ts
/** Windows-fallback variant only — opens GitHub Release page externally. */
onOpenReleasePage?: () => void;
```

Line 125 (headlineFor branch):
```ts
if (variant === 'windows-fallback') {
```

Lines 192–196 (release-notes link gating):
```tsx
{/* "View full release notes" link only on the auto-update variant
    available/downloaded/downloading states — windows-fallback's
    [Open Release Page] button covers this affordance. state='none'
    doesn't show a release-notes link (no specific release to point
    to). */}
{variant !== 'windows-fallback' && props.state !== 'none' && (
```

Line 210, 229, 248, 258, 277 — five button-row branches matching `variant === 'windows-fallback'`
or `variant !== 'windows-fallback'`.

<!-- Current state of src/renderer/src/App.tsx (variant + URL sites): -->

Line 363 (onUpdateAvailable handler narrowing):
```ts
variant: payload.variant === 'windows-fallback' ? 'windows-fallback' : 'auto-update',
```

Line 417 (requestPendingUpdate hydration narrowing):
```ts
variant: payload.variant === 'windows-fallback' ? 'windows-fallback' : 'auto-update',
```

Line 532 (comment):
```
macOS/Linux/Windows-IF-spike-PASS; windows-fallback otherwise). */}
```

Lines 555–557 (onOpenReleasePage handler — hardcoded URL):
```tsx
onOpenReleasePage={() => {
  window.api.openExternalUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/releases');
}}
```

<!-- Need to verify the updateState type signature in App.tsx — find via grep before editing. -->

<!-- HelpDialog.tsx no-op verification: per CONTEXT.md D-06, HelpDialog.tsx contains -->
<!-- ZERO matches for `update`, `fallback`, `manual-download`, `squirrel`. Re-verify -->
<!-- with grep before assuming D-06's claim still holds. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Re-verify HelpDialog no-op claim (D-06)</name>
  <files></files>
  <read_first>
    - src/renderer/src/modals/HelpDialog.tsx (the entire file — re-verify CONTEXT.md D-06's claim that the file contains zero auto-update / fallback / manual-download mentions)
    - .planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md (D-06 — HelpDialog confirmed-no-op surface; planner MUST re-verify)
  </read_first>
  <action>
    Per CONTEXT.md D-06, HelpDialog.tsx is asserted to be a no-op surface for Phase 16
    (the REQ author likely meant UpdateDialog when listing "in-app Help dialog" as a
    propagation site). This task is the planner-mandated re-verification.

    Run grep checks against HelpDialog.tsx:
    - `grep -in "windows-fallback\|manual-download\|squirrel\|fallback" src/renderer/src/modals/HelpDialog.tsx`
    - `grep -in "auto-update\|autoUpdate" src/renderer/src/modals/HelpDialog.tsx`
    - `grep -in "Check for Updates" src/renderer/src/modals/HelpDialog.tsx`

    If ANY of these grep commands returns a match, STOP and surface the finding in the
    plan SUMMARY — D-06 was wrong and the planner needs to update the surface list.
    The fix would be to extend Task 2 to also rename HelpDialog.tsx.

    If ALL three return zero matches, D-06 is confirmed and this task is done — no
    file edit required. Note the grep output (`Phase 16 D-06 re-verified: HelpDialog
    contains no Phase 16 surface — no edit required.`) in the SUMMARY.

    No file modification expected. The task is purely verification.
  </action>
  <verify>
    <automated>! grep -i "windows-fallback\|manual-download\|squirrel" src/renderer/src/modals/HelpDialog.tsx &amp;&amp; ! grep -i "auto-update" src/renderer/src/modals/HelpDialog.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -ic "windows-fallback" src/renderer/src/modals/HelpDialog.tsx` returns exactly `0`
    - `grep -ic "manual-download" src/renderer/src/modals/HelpDialog.tsx` returns exactly `0`
    - `grep -ic "squirrel" src/renderer/src/modals/HelpDialog.tsx` returns exactly `0`
    - `grep -ic "auto-update" src/renderer/src/modals/HelpDialog.tsx` returns exactly `0`
    - `grep -ic "Check for Updates" src/renderer/src/modals/HelpDialog.tsx` returns exactly `0`
    - The file is NOT modified (no diff against HEAD)
  </acceptance_criteria>
  <done>
    CONTEXT.md D-06 is confirmed: HelpDialog.tsx contains no Phase 16 surface
    references. No edit required. The "in-app Help dialog" propagation mention
    in the REQ-05 enumeration (REQUIREMENTS.md UPDFIX-05) is satisfied by
    UpdateDialog.tsx (Task 2), per D-06's interpretation. If the user wants a
    static "How auto-updates work" subsection in HelpDialog, that's deferred to
    v1.3 polish per CONTEXT.md `<deferred>`.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Rename variant literal across UpdateDialog.tsx</name>
  <files>src/renderer/src/modals/UpdateDialog.tsx</files>
  <read_first>
    - src/renderer/src/modals/UpdateDialog.tsx (the entire file — read completely; the rename touches 9 sites including the type export, 5 conditional branches, and 3 comment references)
    - src/main/auto-update.ts (post-Plan-16-03 — confirm UpdateAvailablePayload variant is now `'auto-update' | 'manual-download'`; UpdateDialogVariant in renderer must agree)
    - .planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md (D-05 — string-literal change ONLY; rendering shape unchanged)
  </read_first>
  <action>
    Per CONTEXT.md D-05, replace every occurrence of `'windows-fallback'` AND every
    bare comment reference to `windows-fallback` in src/renderer/src/modals/UpdateDialog.tsx
    with `'manual-download'` / `manual-download` respectively. There are exactly 9
    occurrences per grep (3 in comments, 1 in the type export, 5 in conditional branches).

    Specific edits:
    1. Line 23 (header docblock comment):
       `*   - 'windows-fallback': Windows-IF-spike-FAIL. Buttons: Open Release`
       →
       `*   - 'manual-download': platform routes manual-download (Phase 16 D-01:`
       `*     macOS always; Windows unless spikeOutcome === 'pass'). Buttons: Open Release`

    2. Line 71 (exported type):
       `export type UpdateDialogVariant = 'auto-update' | 'windows-fallback';`
       →
       `export type UpdateDialogVariant = 'auto-update' | 'manual-download';`

    3. Line 86 (variant prop comment):
       `/** Default 'auto-update' (macOS/Linux/Windows-IF-spike-PASS). */`
       →
       `/** Default 'auto-update' (Linux always; Windows-IF-spike-PASS). macOS + Windows-default route to 'manual-download' (Phase 16 D-01). */`

    4. Line 93 (onOpenReleasePage prop comment):
       `/** Windows-fallback variant only — opens GitHub Release page externally. */`
       →
       `/** manual-download variant only — opens GitHub Release page externally. */`

    5. Line 125 (headlineFor branch):
       `if (variant === 'windows-fallback') {`
       →
       `if (variant === 'manual-download') {`

    6. Lines 192–196 (release-notes link gating — comment block):
       Replace the comment text `windows-fallback's` with `manual-download's`,
       and the conditional `variant !== 'windows-fallback'` with
       `variant !== 'manual-download'`.

    7. Line 210 (button-row branch):
       `{variant === 'windows-fallback' && (`
       →
       `{variant === 'manual-download' && (`

    8. Lines 229 / 248 / 258 / 277 (four button-row branches):
       `{variant !== 'windows-fallback' && props.state === '...'`
       →
       `{variant !== 'manual-download' && props.state === '...'`

    DO NOT change:
    - The button labels (`Open Release Page`, `Later`, `Download + Restart`, `Restart`,
      `Dismiss`, `Downloading…`).
    - The Tailwind class strings (`bg-accent text-panel rounded-md ...`).
    - The component imports (only `react` + the local `useFocusTrap` hook — Layer 3
      invariant per tests/arch.spec.ts).
    - The `headlineFor` function structure (only line 125's literal value).
    - The `GITHUB_RELEASES_INDEX_URL` constant at line 102–103 — KEEP for the "View
      full release notes" link, which still points to the index page (the per-release
      URL is used only for the "Open Release Page" button via App.tsx's
      onOpenReleasePage handler — see Task 3).

    Self-check:
    - `grep -c "'windows-fallback'" src/renderer/src/modals/UpdateDialog.tsx` MUST return 0.
    - `grep -c "windows-fallback" src/renderer/src/modals/UpdateDialog.tsx` MUST return 0.
    - `grep -c "'manual-download'" src/renderer/src/modals/UpdateDialog.tsx` MUST return ≥6
      (1 type export + 5 conditional branches).
    - `grep -c "manual-download" src/renderer/src/modals/UpdateDialog.tsx` MUST return ≥9
      (1 type export + 5 conditional branches + 3 comment references).
    - `grep -cE "import.*from\\s+'(?!react|\\./|\\.\\./|@?[a-z]*/?(react|useFocusTrap))" src/renderer/src/modals/UpdateDialog.tsx` MUST return 0
      (Layer 3 invariant — UpdateDialog imports stay react + useFocusTrap only).
    - `npm run typecheck` MUST exit 0.
  </action>
  <verify>
    <automated>grep -c "'windows-fallback'" src/renderer/src/modals/UpdateDialog.tsx | grep -q '^0$' &amp;&amp; grep -c "windows-fallback" src/renderer/src/modals/UpdateDialog.tsx | grep -q '^0$' &amp;&amp; grep -c "'manual-download'" src/renderer/src/modals/UpdateDialog.tsx | awk '$1>=6 {exit 0} {exit 1}' &amp;&amp; npm run typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "'windows-fallback'" src/renderer/src/modals/UpdateDialog.tsx` returns exactly `0`
    - `grep -c "windows-fallback" src/renderer/src/modals/UpdateDialog.tsx` returns exactly `0`
    - `grep -c "'manual-download'" src/renderer/src/modals/UpdateDialog.tsx` returns ≥ `6`
    - `grep -c "manual-download" src/renderer/src/modals/UpdateDialog.tsx` returns ≥ `9`
    - The 5 conditional branch sites all match `'manual-download'` (verify each line individually with grep `grep -n "variant === 'manual-download'\|variant !== 'manual-download'"` returns 5 lines)
    - `npm run typecheck` exits 0
    - The Layer 3 invariant is preserved — `tests/arch.spec.ts` (UpdateDialog import-purity check) still passes (verify `npm test -- tests/arch.spec.ts` exits 0)
    - The button labels are unchanged (`grep -c "Open Release Page" src/renderer/src/modals/UpdateDialog.tsx` returns ≥ `1`; `grep -c "Download + Restart" src/renderer/src/modals/UpdateDialog.tsx` returns ≥ `1`)
  </acceptance_criteria>
  <done>
    UpdateDialogVariant type literal is renamed; all 5 conditional branches and
    3 comment references use the new token; rendering shape unchanged; Layer 3
    invariant preserved; typecheck passes.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Rename variant in App.tsx + flow per-release URL through to onOpenReleasePage</name>
  <files>src/renderer/src/App.tsx</files>
  <read_first>
    - src/renderer/src/App.tsx (the entire file — to find the updateState type/declaration AND the 4 sites being edited at lines ~363, 417, 532, 555–557; ALSO find the updateState shape so the URL field can be added cleanly)
    - src/renderer/src/modals/UpdateDialog.tsx (just-renamed; the variant prop expected by UpdateDialog is now `'auto-update' | 'manual-download'`)
    - src/main/auto-update.ts (post-Plan-16-03 — UpdateAvailablePayload now has `fullReleaseUrl` per-release templated; the renderer needs to capture that into updateState)
    - .planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md (D-04 + D-05)
  </read_first>
  <action>
    Two coordinated edits:

    Part A — variant rename:
    1. Line 363 (onUpdateAvailable handler narrowing):
       `variant: payload.variant === 'windows-fallback' ? 'windows-fallback' : 'auto-update',`
       →
       `variant: payload.variant === 'manual-download' ? 'manual-download' : 'auto-update',`
    2. Line 417 (requestPendingUpdate hydration narrowing):
       Same edit as line 363 (identical text).
    3. Line 532 (comment near UpdateDialog mount):
       `macOS/Linux/Windows-IF-spike-PASS; windows-fallback otherwise). */}`
       →
       `Linux always; Windows-IF-spike-PASS; manual-download otherwise per Phase 16 D-01). */}`

    Part B — per-release URL flow (CONTEXT.md D-04):
    The current onOpenReleasePage handler hardcodes the index URL:
    ```tsx
    onOpenReleasePage={() => {
      window.api.openExternalUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/releases');
    }}
    ```
    Phase 16 D-04 wants this to send `payload.fullReleaseUrl` from the live update
    state (which now carries the per-release templated URL `/releases/tag/v{version}`
    after Plan 16-03). Two sub-edits required:

    1. Locate the `updateState` shape definition in App.tsx (search for `updateState`
       useState init or its TypeScript type). Add a `fullReleaseUrl` field of type
       `string` to the shape. If the shape is inline-typed via inference from
       `useState({ ... })`, add `fullReleaseUrl: ''` to the initial value AND the
       2 setters at lines 358 and 412.

    2. In the onUpdateAvailable handler (line 357–365), capture the URL:
       ```tsx
       setUpdateState({
         open: true,
         state: 'available',
         version: payload.version,
         summary: payload.summary,
         variant: payload.variant === 'manual-download' ? 'manual-download' : 'auto-update',
         fullReleaseUrl: payload.fullReleaseUrl,
       });
       ```

    3. In the requestPendingUpdate hydration (line 410–420), capture the URL the
       same way:
       ```tsx
       setUpdateState({
         open: true,
         state: 'available',
         version: payload.version,
         summary: payload.summary,
         variant: payload.variant === 'manual-download' ? 'manual-download' : 'auto-update',
         fullReleaseUrl: payload.fullReleaseUrl,
       });
       ```

    4. The 'none'-state setters at lines 369–397 (onUpdateNone + onUpdateError) also
       set updateState. Keep `fullReleaseUrl: ''` in those setters — they are
       state='none' branches that don't surface the Open Release Page button anyway.

    5. Replace the onOpenReleasePage handler at lines 555–557 with:
       ```tsx
       onOpenReleasePage={() => {
         if (updateState.fullReleaseUrl.length > 0) {
           window.api.openExternalUrl(updateState.fullReleaseUrl);
         }
       }}
       ```
       The `length > 0` guard is defense-in-depth: if the manual-download variant
       button somehow renders when the slot is empty (state='none' with no payload),
       the call is silently dropped.

    NOTE on Plan 14-05 URL-consistency regression gate (test 14-p):
    Test (14-p) asserts that App.tsx contains the literal
    `openExternalUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/releases')`.
    Plan 16's edit removes this exact literal — the URL now flows from the runtime
    payload, NOT a hardcoded literal in App.tsx. Test (14-p) will FAIL after this
    plan's task and must be updated by Plan 16-06 (the test rename plan). Plan 16-06
    Task 4 will rewrite test (14-p) to assert that App.tsx forwards
    `updateState.fullReleaseUrl` to `openExternalUrl` — the new contract. Document
    this expected RED state in the SUMMARY.

    Self-check:
    - `grep -c "'windows-fallback'" src/renderer/src/App.tsx` MUST return 0.
    - `grep -c "windows-fallback" src/renderer/src/App.tsx` MUST return 0.
    - `grep -c "'manual-download'" src/renderer/src/App.tsx` MUST return ≥4 (4 type-narrowing
      sites: 2 setters × 2 ternaries).
    - `grep -c "fullReleaseUrl" src/renderer/src/App.tsx` MUST return ≥4 (1 in onOpenReleasePage,
      1 in onUpdateAvailable setter, 1 in requestPendingUpdate setter, 1 in updateState
      shape declaration/initial value).
    - `grep -c "openExternalUrl(.https://github" src/renderer/src/App.tsx` MUST return 0
      (the hardcoded literal URL is gone — flows from updateState now).
    - `grep -c "openExternalUrl(updateState.fullReleaseUrl)" src/renderer/src/App.tsx` MUST return ≥1.
    - `npm run typecheck` MUST exit 0.

    Note: test failures are EXPECTED at this Wave-3 boundary — Plan 16-06 owns the
    test renames in Wave 4.
  </action>
  <verify>
    <automated>grep -c "'windows-fallback'" src/renderer/src/App.tsx | grep -q '^0$' &amp;&amp; grep -c "windows-fallback" src/renderer/src/App.tsx | grep -q '^0$' &amp;&amp; grep -c "'manual-download'" src/renderer/src/App.tsx | awk '$1>=4 {exit 0} {exit 1}' &amp;&amp; grep -c "fullReleaseUrl" src/renderer/src/App.tsx | awk '$1>=4 {exit 0} {exit 1}' &amp;&amp; grep -c "openExternalUrl(updateState.fullReleaseUrl)" src/renderer/src/App.tsx | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; npm run typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "'windows-fallback'" src/renderer/src/App.tsx` returns exactly `0`
    - `grep -c "windows-fallback" src/renderer/src/App.tsx` returns exactly `0`
    - `grep -c "'manual-download'" src/renderer/src/App.tsx` returns ≥ `4`
    - `grep -c "fullReleaseUrl" src/renderer/src/App.tsx` returns ≥ `4`
    - `grep -c "openExternalUrl(updateState.fullReleaseUrl)" src/renderer/src/App.tsx` returns ≥ `1`
    - `grep -c "openExternalUrl('https://github" src/renderer/src/App.tsx` returns exactly `0` (no hardcoded URL literal)
    - `npm run typecheck` exits 0
    - The updateState shape declaration / initial value contains `fullReleaseUrl` (verify by grep — `grep -n "fullReleaseUrl" src/renderer/src/App.tsx` returns ≥ 4 line numbers)
  </acceptance_criteria>
  <done>
    All four variant-string sites in App.tsx are renamed; the per-release URL
    flows from main payload → updateState slot → onOpenReleasePage handler →
    window.api.openExternalUrl → main isReleasesUrl check (Plan 16-04) →
    shell.openExternal. The hardcoded index URL literal is gone from App.tsx.
    Typecheck passes. The Plan 14-05 (14-p) regression-gate test is now RED —
    Plan 16-06 owns the test rewrite.
  </done>
</task>

</tasks>

<verification>
- `grep -rn "'windows-fallback'" src/renderer/` returns 0 matches.
- `grep -c "'manual-download'" src/renderer/src/modals/UpdateDialog.tsx` ≥ 6.
- `grep -c "'manual-download'" src/renderer/src/App.tsx` ≥ 4.
- `grep -c "openExternalUrl(updateState.fullReleaseUrl)" src/renderer/src/App.tsx` ≥ 1.
- HelpDialog.tsx unchanged (D-06 confirmed).
- `npm run typecheck` exits 0.
- `npm test -- tests/arch.spec.ts` exits 0 (Layer 3 invariant preserved).

Note: After this plan, the only remaining `'windows-fallback'` literals in the repo
(outside `.planning/`) live in:
- tests/main/auto-update-dismissal.spec.ts (4 sites)
- tests/main/ipc.spec.ts (2 sites)
- tests/renderer/update-dialog.spec.tsx (2 sites)
- tests/renderer/app-update-subscriptions.spec.tsx (2 sites)
- tests/integration/auto-update-shell-allow-list.spec.ts (2 sites — comment-only references inside the existing 14-p..14-s describe block)

Plan 16-06 (Wave 4) owns those.
</verification>

<success_criteria>
- UpdateDialogVariant type literal renamed
- 5 UpdateDialog conditional branches reference `'manual-download'`
- App.tsx 2 update-state setters use the renamed literal
- App.tsx onOpenReleasePage handler forwards `updateState.fullReleaseUrl` (per-release URL D-04)
- updateState shape extended with `fullReleaseUrl: string` field
- HelpDialog.tsx confirmed unchanged (D-06 re-verified)
- Layer 3 invariant preserved (UpdateDialog imports stay react + useFocusTrap only)
- Typecheck passes
</success_criteria>

<output>
After completion, create `.planning/phases/16-macos-auto-update-manual-download-ux/16-05-SUMMARY.md`
documenting:
- HelpDialog re-verify result (D-06 confirmed)
- UpdateDialog 9-site rename audit (line numbers + before/after)
- App.tsx 4-site rename audit + per-release URL flow change
- updateState shape change (added fullReleaseUrl field)
- grep counts (windows-fallback=0 in src/renderer/, manual-download≥10 across both files, fullReleaseUrl≥4 in App.tsx)
- Layer 3 invariant verification (tests/arch.spec.ts still passes)
- Note: test (14-p) is now RED, owned by Plan 16-06.
</output>
</content>
</invoke>
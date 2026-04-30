---
phase: 16-macos-auto-update-manual-download-ux
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/shared/types.ts
  - src/preload/index.ts
autonomous: true
requirements: [UPDFIX-05]
must_haves:
  truths:
    - "The shared variant type literal is `'auto-update' | 'manual-download'` at every site in src/shared/types.ts"
    - "The preload bridge surface (src/preload/index.ts) carries `'manual-download'` everywhere it previously carried `'windows-fallback'`"
    - "The UpdateAvailablePayload contract crossing main → preload → renderer uses the renamed variant literal"
    - "No `'windows-fallback'` literal survives in src/shared/types.ts or src/preload/index.ts"
  artifacts:
    - path: "src/shared/types.ts"
      provides: "Variant type literal for the IPC payload (Api surface) — `'auto-update' | 'manual-download'`"
      contains: "'manual-download'"
    - path: "src/preload/index.ts"
      provides: "contextBridge surface for `update:available` + `update:request-pending` — variant field uses `'manual-download'`"
      contains: "'manual-download'"
  key_links:
    - from: "src/shared/types.ts (Api.requestPendingUpdate, Api.onUpdateAvailable)"
      to: "src/preload/index.ts (requestPendingUpdate body, onUpdateAvailable wrapped)"
      via: "type literal must match byte-for-byte"
      pattern: "'auto-update' \\| 'manual-download'"
---

<objective>
Rename the variant string literal `'windows-fallback'` → `'manual-download'` in the shared
type declarations (src/shared/types.ts) and the preload bridge (src/preload/index.ts).
This is the foundation Wave 1 task — every Wave 2 file depends on this type definition.

This plan addresses CONTEXT.md D-05 (variant string literal rename — mass rename, no
transition period). It is a string-literal-only change. No runtime behavior changes; no
new IPC channels; no new bridge methods.

Purpose: Establish the renamed type literal at the shared-types + preload boundary so
Wave 2 plans (main, IPC allow-list, renderer) can compile against the new contract.

Output: src/shared/types.ts + src/preload/index.ts with `'auto-update' | 'manual-download'`
everywhere the previous literal pair `'auto-update' | 'windows-fallback'` appeared.
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
@src/shared/types.ts
@src/preload/index.ts

<interfaces>
<!-- Before this plan, the variant literal pair appears at these sites: -->

src/shared/types.ts (3 sites):
- Line 918 — comment: `// renderer never derives 'auto-update' vs 'windows-fallback' from`
- Line 945 — `variant: 'auto-update' | 'windows-fallback';` inside Api.requestPendingUpdate return type
- Line 963 — `variant?: 'auto-update' | 'windows-fallback';` inside Api.onUpdateAvailable cb payload

src/preload/index.ts (3 sites):
- Line 437 — `variant: 'auto-update' | 'windows-fallback';` inside requestPendingUpdate return type
- Line 459 — `variant?: 'auto-update' | 'windows-fallback';` inside onUpdateAvailable cb payload type
- Line 468 — `variant?: 'auto-update' | 'windows-fallback';` inside onUpdateAvailable wrapped event payload type

Comment at src/shared/types.ts:918 reads:
```
// renderer never derives 'auto-update' vs 'windows-fallback' from
// process.platform — it consumes the variant field as supplied by main.
```

After rename, this comment MUST update to `'auto-update' vs 'manual-download'` so the
rationale comment doesn't contradict the type below it.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Rename variant literal in src/shared/types.ts</name>
  <files>src/shared/types.ts</files>
  <read_first>
    - src/shared/types.ts (the file being modified — read lines 910–970 for the auto-update section)
    - .planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md (D-05 locks the rename: `'windows-fallback'` → `'manual-download'`, mass rename, no transition period)
  </read_first>
  <action>
    Per CONTEXT.md D-05, replace every occurrence of the literal `'windows-fallback'`
    in src/shared/types.ts with `'manual-download'`. There are exactly 3 occurrences
    according to grep — verify by grep BEFORE and AFTER the edit.

    Specifically:
    1. Line 918 (comment block above the auto-update bridge methods): change
       `// renderer never derives 'auto-update' vs 'windows-fallback' from`
       to
       `// renderer never derives 'auto-update' vs 'manual-download' from`.
    2. Line 945 (Api.requestPendingUpdate return type, inside the inline payload
       object): change
       `variant: 'auto-update' | 'windows-fallback';`
       to
       `variant: 'auto-update' | 'manual-download';`.
    3. Line 963 (Api.onUpdateAvailable cb payload type, inside the inline payload
       object): change
       `variant?: 'auto-update' | 'windows-fallback';`
       to
       `variant?: 'auto-update' | 'manual-download';`.

    Do NOT introduce any other edits to this file in this task. The rename is
    string-literal-only; no shape changes, no comment additions beyond the literal
    swap inside the existing comment text.

    Self-check after edit:
    - `grep -c "'windows-fallback'" src/shared/types.ts` MUST return 0.
    - `grep -c "windows-fallback" src/shared/types.ts` MUST return 0 (catches the
      bare comment occurrence on line 918).
    - `grep -c "'manual-download'" src/shared/types.ts` MUST return ≥2 (the two
      type-literal sites at lines 945 + 963).
    - `grep -c "manual-download" src/shared/types.ts` MUST return ≥3 (the two
      type-literal sites + the renamed comment at line 918).
  </action>
  <verify>
    <automated>grep -c "'windows-fallback'" src/shared/types.ts | grep -q '^0$' &amp;&amp; grep -c "windows-fallback" src/shared/types.ts | grep -q '^0$' &amp;&amp; grep -c "'manual-download'" src/shared/types.ts | awk '$1>=2 {exit 0} {exit 1}' &amp;&amp; npm run typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "'windows-fallback'" src/shared/types.ts` returns exactly `0`
    - `grep -c "windows-fallback" src/shared/types.ts` returns exactly `0` (catches comment occurrence)
    - `grep -c "'manual-download'" src/shared/types.ts` returns ≥ `2`
    - `grep -c "manual-download" src/shared/types.ts` returns ≥ `3` (2 literals + 1 comment)
    - `npm run typecheck` exits 0
  </acceptance_criteria>
  <done>
    Every `'windows-fallback'` literal in src/shared/types.ts is replaced with
    `'manual-download'`. The rationale comment at line ~918 is updated to use
    the renamed token. Typecheck still passes (the type literal change is
    structurally compatible — same shape, different string member).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Rename variant literal in src/preload/index.ts</name>
  <files>src/preload/index.ts</files>
  <read_first>
    - src/preload/index.ts (the file being modified — read lines 430–510 for the auto-update bridges)
    - src/shared/types.ts (the just-renamed contract — preload literals MUST agree byte-for-byte)
    - .planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md (D-05 mass rename)
  </read_first>
  <action>
    Per CONTEXT.md D-05, replace every occurrence of the literal `'windows-fallback'`
    in src/preload/index.ts with `'manual-download'`. There are exactly 3 occurrences
    according to grep — verify by grep BEFORE and AFTER the edit.

    Specifically:
    1. Line 437 (requestPendingUpdate return type, inside the inline payload object):
       change
       `variant: 'auto-update' | 'windows-fallback';`
       to
       `variant: 'auto-update' | 'manual-download';`.
    2. Line 459 (onUpdateAvailable cb param type, inside the inline payload object):
       change
       `variant?: 'auto-update' | 'windows-fallback';`
       to
       `variant?: 'auto-update' | 'manual-download';`.
    3. Line 468 (onUpdateAvailable wrapped listener payload type — same inline object
       shape repeated for the Electron.IpcRendererEvent listener signature): change
       `variant?: 'auto-update' | 'windows-fallback';`
       to
       `variant?: 'auto-update' | 'manual-download';`.

    Do NOT introduce any other edits in this task. The rename is string-literal-only.

    Self-check after edit:
    - `grep -c "'windows-fallback'" src/preload/index.ts` MUST return 0.
    - `grep -c "windows-fallback" src/preload/index.ts` MUST return 0.
    - `grep -c "'manual-download'" src/preload/index.ts` MUST return ≥3.
    - `npm run typecheck` MUST exit 0 (the renamed types must agree with the just-
      renamed src/shared/types.ts).
  </action>
  <verify>
    <automated>grep -c "'windows-fallback'" src/preload/index.ts | grep -q '^0$' &amp;&amp; grep -c "windows-fallback" src/preload/index.ts | grep -q '^0$' &amp;&amp; grep -c "'manual-download'" src/preload/index.ts | awk '$1>=3 {exit 0} {exit 1}' &amp;&amp; npm run typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "'windows-fallback'" src/preload/index.ts` returns exactly `0`
    - `grep -c "windows-fallback" src/preload/index.ts` returns exactly `0`
    - `grep -c "'manual-download'" src/preload/index.ts` returns ≥ `3`
    - `npm run typecheck` exits 0
    - The Wave 1 invariant holds: src/shared/types.ts and src/preload/index.ts both have zero `'windows-fallback'` literals
  </acceptance_criteria>
  <done>
    Every `'windows-fallback'` literal in src/preload/index.ts is replaced with
    `'manual-download'`. Type compatibility with src/shared/types.ts (Task 1) is
    preserved. Typecheck still passes — the contextBridge contract is internally
    consistent at the Wave 1 boundary even though Wave 2 (main + renderer) has not
    yet been renamed (TS allows the existing-but-stale `'windows-fallback'` literals
    in main/auto-update.ts + renderer/* to disagree IF Wave 2 has not run yet —
    test failures, not type failures, will surface that. This task validates only
    the Wave 1 boundary; the full-suite green flips at Wave 4 after Plan 16-06).
  </done>
</task>

</tasks>

<verification>
- `grep -rn "'windows-fallback'" src/shared/ src/preload/` returns 0 matches.
- `grep -c "'manual-download'" src/shared/types.ts` ≥ 2.
- `grep -c "'manual-download'" src/preload/index.ts` ≥ 3.
- `npm run typecheck` exits 0.

Note: `npm test` may have failures in Wave 1 because tests still reference the old
literal AND main/auto-update.ts still emits the old literal. Those resolve at Wave 4
(Plan 16-06). Wave 1's contract is type-shape boundary only.
</verification>

<success_criteria>
- The shared variant type literal is `'auto-update' | 'manual-download'` at every site in src/shared/types.ts
- The preload bridge surface uses the renamed literal at every payload type site
- Typecheck passes against the renamed types
- Zero `'windows-fallback'` strings remain in either file
- Foundation laid for Wave 2 plans (16-03 main, 16-04 IPC, 16-05 renderer) to compile against the renamed contract
</success_criteria>

<output>
After completion, create `.planning/phases/16-macos-auto-update-manual-download-ux/16-01-SUMMARY.md`
documenting:
- Lines edited (exact line numbers in src/shared/types.ts + src/preload/index.ts)
- grep counts BEFORE and AFTER (windows-fallback should drop to 0; manual-download should appear)
- Typecheck result
- Note that test-suite green is deferred to Wave 4 (Plan 16-06) — Wave 1 only owns the type-literal boundary.
</output>
</content>
</invoke>
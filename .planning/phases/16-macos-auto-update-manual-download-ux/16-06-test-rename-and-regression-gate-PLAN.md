---
phase: 16-macos-auto-update-manual-download-ux
plan: 06
type: execute
wave: 4
depends_on: ["16-01", "16-03", "16-04", "16-05"]
files_modified:
  - tests/main/auto-update-dismissal.spec.ts
  - tests/main/ipc.spec.ts
  - tests/renderer/update-dialog.spec.tsx
  - tests/renderer/app-update-subscriptions.spec.tsx
  - tests/integration/auto-update-shell-allow-list.spec.ts
  - tests/integration/no-windows-fallback-literal.spec.ts
autonomous: true
requirements: [UPDFIX-05]
must_haves:
  truths:
    - "All 4 main + renderer test files reference `'manual-download'` instead of `'windows-fallback'` in their assertions and inline payload type signatures"
    - "Test (14-e) in tests/main/auto-update-dismissal.spec.ts asserts the asymmetric-dismissal rule under the renamed `'manual-download'` variant"
    - "Test (13) in tests/renderer/update-dialog.spec.tsx renders UpdateDialog with `variant=\"manual-download\"` and asserts Open Release Page + Later buttons are present"
    - "Test (14-p) in tests/integration/auto-update-shell-allow-list.spec.ts asserts that App.tsx forwards `updateState.fullReleaseUrl` to `openExternalUrl` (the new contract — replaces the hardcoded literal assertion)"
    - "A new regression-gate test (tests/integration/no-windows-fallback-literal.spec.ts) asserts that NO `'windows-fallback'` literal survives anywhere under src/ — runs as part of the standard test suite"
    - "All tests pass (`npm test` exits 0)"
  artifacts:
    - path: "tests/integration/no-windows-fallback-literal.spec.ts"
      provides: "Regression gate that fails the build if any future commit reintroduces 'windows-fallback' to src/"
      contains: "'windows-fallback'"
    - path: "tests/main/auto-update-dismissal.spec.ts"
      provides: "Updated (14-e) asymmetric-dismissal test under manual-download variant + non-Windows platform mock (the variant routing now triggers manual-download on macOS as well as Windows)"
    - path: "tests/main/ipc.spec.ts"
      provides: "Updated inline payload type signatures referencing 'manual-download'"
    - path: "tests/renderer/update-dialog.spec.tsx"
      provides: "Updated (13) test rendering manual-download variant"
    - path: "tests/renderer/app-update-subscriptions.spec.tsx"
      provides: "Updated inline payload type signatures referencing 'manual-download'"
    - path: "tests/integration/auto-update-shell-allow-list.spec.ts"
      provides: "Updated (14-p) test asserting runtime URL flow + retained (14-q) (14-r) (14-s) URL-consistency checks against the index URL literal in main + ipc"
  key_links:
    - from: "tests/integration/no-windows-fallback-literal.spec.ts"
      to: "src/ tree (recursive scan via fs.readdirSync)"
      via: "regression-gate fs scan; fails if any src/ file contains the substring 'windows-fallback'"
      pattern: "windows-fallback"
---

<objective>
Land the Wave 4 test rename + regression gate. Five existing test files reference the
old `'windows-fallback'` literal in assertions and inline payload type signatures; rename
each. One new regression-gate test asserts no `'windows-fallback'` literal survives in
src/ — locks the rename in CI for all future commits.

This plan addresses CONTEXT.md D-07 (test rename strategy — planner picked: hand-edit
each assertion + add a regression-gate spec) AND closes the Phase 16 deliverable by
flipping the full test suite back to GREEN.

Strategy chosen (CONTEXT.md D-07 leaves the choice to the planner):
- Hand-edit each test file's assertions and inline payload type literals to use the
  renamed `'manual-download'` token.
- Update test (14-e) in auto-update-dismissal.spec.ts to mock `process.platform = 'darwin'`
  (the platform that NOW routes to `'manual-download'` per the Phase 16 D-01 gate flip)
  rather than `'win32'` — the test's intent is "the manual-download variant follows the
  asymmetric dismissal rule"; macOS is the freshly-broken platform and the natural test
  target post-Phase-16. Either platform would satisfy the test contract, but darwin is
  the one Phase 16 specifically fixes.
- Update test (14-p) in auto-update-shell-allow-list.spec.ts to assert the new contract
  (App.tsx forwards `updateState.fullReleaseUrl` to `openExternalUrl`) since Plan 16-05
  Task 3 removed the hardcoded URL literal.
- ADD a new spec file `tests/integration/no-windows-fallback-literal.spec.ts` that
  recursively scans src/ for the literal string `'windows-fallback'` and fails if any
  match is found. This is the durable regression gate.

Purpose: Phase 16's complete-state — every literal is renamed everywhere, the full test
suite is GREEN, and the rename is locked against future regressions by an automated
gate.

Output: 5 modified test files + 1 new regression-gate test file. `npm test` exits 0.

Depends on Plan 16-01 (Wave 1 type contract), Plan 16-03 (Wave 2 main payload renamed),
Plan 16-04 (Wave 2 ipc allow-list + extended test passes), Plan 16-05 (Wave 3 renderer
renamed). All 4 prior plans must be GREEN before Plan 16-06 starts.
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
@tests/main/auto-update-dismissal.spec.ts
@tests/main/ipc.spec.ts
@tests/renderer/update-dialog.spec.tsx
@tests/renderer/app-update-subscriptions.spec.tsx
@tests/integration/auto-update-shell-allow-list.spec.ts

<interfaces>
<!-- Per the orchestration prompt's wave-strategy hint, here are the literal sites: -->

tests/main/auto-update-dismissal.spec.ts (4 sites + 1 mock-platform site):
- Line 19 (docblock comment): `(d) D-07 windows-fallback variant follows the same asymmetric rule`
- Line 20 (docblock comment): `(manual re-presents WITH the windows-fallback variant tag).`
- Line 38 (docblock comment): `14-e   D-07 windows-fallback variant follows asymmetric rule`
- Line 241 (it() name): `(14-e) D-07 windows-fallback variant follows asymmetric rule (manual re-presents with variant tag)`
- Line 243 (test comment): `variant routing branch evaluates to 'windows-fallback'.`
- Line 246–250 (mock setup): `Object.defineProperty(process, 'platform', { value: 'win32', ... })` — Phase 16 makes this either platform a manual-download trigger; pick darwin because Phase 16 specifically fixes macOS.
- Line 268 (assertion): `variant: 'windows-fallback',`

tests/main/ipc.spec.ts (1 site):
- Line 92: `variant: 'auto-update' | 'windows-fallback';` (inline payload type)

tests/renderer/update-dialog.spec.tsx (2+ sites):
- Line 18 (docblock): `13. Windows-fallback variant: [Open Release Page] [Later] buttons.`
- Line 250 (it() name): `(13) Windows-fallback variant renders [Open Release Page] and [Later]`
- Line 258 (prop): `variant="windows-fallback"`
- Line 268, 270 (comments): `Windows-fallback variant should NOT render ...`

tests/renderer/app-update-subscriptions.spec.tsx (1 site):
- Line 37: `variant: 'auto-update' | 'windows-fallback';` (inline payload type)

tests/integration/auto-update-shell-allow-list.spec.ts (2 comment sites + 1 contract change):
- Line 5 (docblock): `The windows-fallback "Open Release Page" CTA depends on byte-for-byte URL`
- Line 14 (docblock): `which Plan 14-03 keeps for non-windows-fallback variant — currently the`
- Lines 41–44 (test 14-p): the assertion checks for the literal hardcoded URL in App.tsx, which Plan 16-05 Task 3 removed. REWRITE to assert the new contract: App.tsx contains `openExternalUrl(updateState.fullReleaseUrl)`.

<!-- For the new regression-gate spec, the file scan needs to ignore: -->
<!--   - The plan's own .planning/ archive paths (NOT in src/, so already excluded). -->
<!--   - The `windows-fallback` substring inside JSDoc / comments? NO — the gate is -->
<!--     pattern-strict: ANY occurrence of the LITERAL `'windows-fallback'` (with quotes) -->
<!--     fails. We allow comment references but require the type-literal form to be gone. -->
<!--   - HOWEVER, the gate ALSO needs to reject bare-token comment occurrences like -->
<!--     "windows-fallback variant" because they document obsolete behavior. The gate -->
<!--     scans for the unquoted token `windows-fallback` in src/. Set the bar HIGH -->
<!--     because by Wave 4 every src/ site is renamed; comment drift is no different -->
<!--     from code drift for this regression. -->

<!-- The new regression-gate spec follows the precedent of: -->
<!--   - tests/arch.spec.ts (recursive readdir + readFileSync + regex check) — Layer 3 -->
<!--     invariant pattern. -->
<!--   - tests/integration/install-md.spec.ts URL-consistency pattern. -->
<!-- Both are existing patterns in the codebase. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Rename literals in tests/main/auto-update-dismissal.spec.ts (incl. platform mock switch to darwin)</name>
  <files>tests/main/auto-update-dismissal.spec.ts</files>
  <read_first>
    - tests/main/auto-update-dismissal.spec.ts (entire file — read fully; the (14-e) test at lines 241–277 needs both literal renaming AND a platform-mock change from `'win32'` to `'darwin'` because Phase 16 makes macOS the natural manual-download test target)
    - src/main/auto-update.ts (post-Plan-16-03 — confirm: the Phase 16 routing means `process.platform === 'darwin'` AND `state.spikeOutcome` doesn't matter (no Windows escape hatch on darwin) → variant is `'manual-download'`. This is the cleanest test target.)
    - .planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md (D-05 mass rename + D-07 planner discretion: hand-edit chosen)
  </read_first>
  <action>
    Replace every occurrence of `windows-fallback` (in any quoting) in
    tests/main/auto-update-dismissal.spec.ts with `manual-download`, AND switch the
    (14-e) test's platform mock from `'win32'` to `'darwin'`. The intent of the test
    is "the manual-download variant follows the asymmetric dismissal rule"; under
    Phase 16 D-01, macOS is the canonical platform that always routes to
    manual-download (no spike override possible). Windows would also work BUT
    requires a `spikeOutcome !== 'pass'` setup — adding test setup complexity for
    no benefit. Darwin is structurally simpler.

    Specific edits:

    1. Lines 19–20 (file-top docblock):
       `(d) D-07 windows-fallback variant follows the same asymmetric rule`
       `(manual re-presents WITH the windows-fallback variant tag).`
       →
       `(d) D-07 manual-download variant follows the same asymmetric rule (Phase 16 D-05 rename of the Phase 14 windows-fallback variant).`
       `(manual re-presents WITH the manual-download variant tag.)`

    2. Line 38 (docblock):
       `14-e   D-07 windows-fallback variant follows asymmetric rule`
       →
       `14-e   D-07 manual-download variant follows asymmetric rule (post-Phase-16 D-05 rename)`

    3. Line 241 (it() name):
       `it('(14-e) D-07 windows-fallback variant follows asymmetric rule (manual re-presents with variant tag)', async () => {`
       →
       `it('(14-e) D-07 manual-download variant follows asymmetric rule (manual re-presents with variant tag — Phase 16 D-05 rename of Phase 14 windows-fallback)', async () => {`

    4. Lines 243–245 (test-comment block above the platform mock):
       `// Mock process.platform === 'win32' for the duration of this test so the`
       `// variant routing branch evaluates to 'windows-fallback'. The Phase 12`
       `// SPIKE_PASSED constant is already false on win32; spikeOutcome === 'unknown'`
       `// here keeps the runtime flag from promoting it.`
       →
       `// Mock process.platform === 'darwin' for the duration of this test so the`
       `// variant routing branch evaluates to 'manual-download'. Phase 16 D-01 makes`
       `// macOS the canonical manual-download target: IN_PROCESS_AUTO_UPDATE_OK is`
       `// false on darwin (only Linux is true) and there is no Windows-style`
       `// spikeOutcome escape hatch on darwin (D-02). spikeOutcome === 'unknown'`
       `// is irrelevant on darwin but kept for parity with the prior win32-mock`
       `// shape.`

    5. Lines 246–250 (mock setup):
       `const originalPlatform = process.platform;`
       `Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });`
       →
       `const originalPlatform = process.platform;`
       `Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });`

    6. Line 261–263 (in-test comment):
       `// Note: the Phase 14 source codes the variant inside the`
       `// deliverUpdateAvailable helper; the test asserts on the IPC payload`
       `// produced by sendToWindow which received \`payload.variant\`.`
       (no rename needed — keep verbatim).

    7. Line 268 (assertion):
       `variant: 'windows-fallback',`
       →
       `variant: 'manual-download',`

    DO NOT change:
    - The other 13 tests in this file (none of them reference the variant literal).
    - The mock structure (loadUpdateStateMock, sendStub) — only the platform value flips.
    - The `(14-d)` and `(14-c)` test bodies — those use the auto-update variant on
      non-windows platforms; under Phase 16, darwin no longer routes to auto-update
      (it goes to manual-download), but those tests don't mock the platform, they
      run against the test process's native platform. On macOS dev hosts the test
      now exercises a manual-download path — VERIFY the tests still pass; if they
      start FAILING because they assume `variant: 'auto-update'` without mocking
      platform, escalate (those would be a separate fix).
      Realistic outcome: the (14-c) and (14-d) tests probably already either skip
      the variant assertion entirely OR mock differently. Read them carefully before
      assuming. If they fail post-rename and the failure is platform-dependent,
      apply the same darwin-mock pattern to either freeze them on linux (where
      the variant is still `'auto-update'`) OR mock to darwin and update the
      expected variant — pick the smaller diff.

    Self-check:
    - `grep -c "'windows-fallback'" tests/main/auto-update-dismissal.spec.ts` MUST return 0.
    - `grep -c "windows-fallback" tests/main/auto-update-dismissal.spec.ts` MUST return 0.
    - `grep -c "'manual-download'" tests/main/auto-update-dismissal.spec.ts` MUST return ≥1
      (the assertion at line 268).
    - `grep -c "'darwin'" tests/main/auto-update-dismissal.spec.ts` MUST return ≥1.
    - `grep -c "'win32'" tests/main/auto-update-dismissal.spec.ts` MUST return 0 (the
      single mock occurrence flipped to darwin; if any other win32 reference exists,
      verify it's intentional and document — then exempt from this gate).
    - `npm test -- tests/main/auto-update-dismissal.spec.ts` MUST exit 0.
  </action>
  <verify>
    <automated>grep -c "'windows-fallback'" tests/main/auto-update-dismissal.spec.ts | grep -q '^0$' &amp;&amp; grep -c "windows-fallback" tests/main/auto-update-dismissal.spec.ts | grep -q '^0$' &amp;&amp; grep -c "'manual-download'" tests/main/auto-update-dismissal.spec.ts | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; grep -c "'darwin'" tests/main/auto-update-dismissal.spec.ts | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; npm test -- tests/main/auto-update-dismissal.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "'windows-fallback'" tests/main/auto-update-dismissal.spec.ts` returns exactly `0`
    - `grep -c "windows-fallback" tests/main/auto-update-dismissal.spec.ts` returns exactly `0`
    - `grep -c "'manual-download'" tests/main/auto-update-dismissal.spec.ts` returns ≥ `1`
    - `grep -c "'darwin'" tests/main/auto-update-dismissal.spec.ts` returns ≥ `1`
    - `npm test -- tests/main/auto-update-dismissal.spec.ts` exits 0 (all tests pass)
  </acceptance_criteria>
  <done>
    All `windows-fallback` references in the file are renamed; the (14-e) test now
    mocks `process.platform = 'darwin'` and asserts `variant: 'manual-download'` in
    the IPC payload; the test suite passes. The asymmetric-dismissal contract
    survives the rename intact.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Rename inline payload type literal in tests/main/ipc.spec.ts</name>
  <files>tests/main/ipc.spec.ts</files>
  <read_first>
    - tests/main/ipc.spec.ts (read line 92 + 5 lines of surrounding context to confirm the inline payload type signature)
    - .planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md (D-05)
  </read_first>
  <action>
    Per CONTEXT.md D-05, replace the inline payload type literal at line 92:

    `variant: 'auto-update' | 'windows-fallback';`
    →
    `variant: 'auto-update' | 'manual-download';`

    No other edits to this file. The line is inside an inline payload type used to
    cast a sendStub call's argument shape — Phase 16's rename of UpdateAvailablePayload
    in the source means this test must agree.

    Self-check:
    - `grep -c "'windows-fallback'" tests/main/ipc.spec.ts` MUST return 0.
    - `grep -c "windows-fallback" tests/main/ipc.spec.ts` MUST return 0.
    - `grep -c "'manual-download'" tests/main/ipc.spec.ts` MUST return ≥1.
    - `npm test -- tests/main/ipc.spec.ts` MUST exit 0.
  </action>
  <verify>
    <automated>grep -c "'windows-fallback'" tests/main/ipc.spec.ts | grep -q '^0$' &amp;&amp; grep -c "windows-fallback" tests/main/ipc.spec.ts | grep -q '^0$' &amp;&amp; grep -c "'manual-download'" tests/main/ipc.spec.ts | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; npm test -- tests/main/ipc.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "'windows-fallback'" tests/main/ipc.spec.ts` returns exactly `0`
    - `grep -c "windows-fallback" tests/main/ipc.spec.ts` returns exactly `0`
    - `grep -c "'manual-download'" tests/main/ipc.spec.ts` returns ≥ `1`
    - `npm test -- tests/main/ipc.spec.ts` exits 0
  </acceptance_criteria>
  <done>
    The inline payload type signature uses the renamed literal; the spec passes.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Rename literals in tests/renderer/update-dialog.spec.tsx + tests/renderer/app-update-subscriptions.spec.tsx</name>
  <files>tests/renderer/update-dialog.spec.tsx, tests/renderer/app-update-subscriptions.spec.tsx</files>
  <read_first>
    - tests/renderer/update-dialog.spec.tsx (entire file — multiple sites: docblock, it() name, prop value, comments)
    - tests/renderer/app-update-subscriptions.spec.tsx (line 37 + surrounding 5 lines)
    - .planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md (D-05)
  </read_first>
  <action>
    Two file-edits, both string-literal renames.

    File A: tests/renderer/update-dialog.spec.tsx
    Replace every occurrence of `windows-fallback` (any quoting / casing) with
    `manual-download`. Per the grep at planning time, sites are:

    1. Line 18 (docblock):
       `13. Windows-fallback variant: [Open Release Page] [Later] buttons.`
       →
       `13. manual-download variant: [Open Release Page] [Later] buttons.`

    2. Line 250 (it() name):
       `it('(13) Windows-fallback variant renders [Open Release Page] and [Later]', () => {`
       →
       `it('(13) manual-download variant renders [Open Release Page] and [Later]', () => {`

    3. Line 258 (prop):
       `variant="windows-fallback"`
       →
       `variant="manual-download"`

    4. Lines 268, 270 (test comments):
       `// Windows-fallback variant should NOT render [Download + Restart].`
       `// Windows-fallback variant should NOT render the View-full-release-notes link`
       →
       `// manual-download variant should NOT render [Download + Restart].`
       `// manual-download variant should NOT render the View-full-release-notes link`

    File B: tests/renderer/app-update-subscriptions.spec.tsx
    Replace at line 37:
    `variant: 'auto-update' | 'windows-fallback';`
    →
    `variant: 'auto-update' | 'manual-download';`

    No other edits to either file.

    Self-check:
    - `grep -c "'windows-fallback'\|windows-fallback" tests/renderer/update-dialog.spec.tsx` MUST return 0.
    - `grep -c "'manual-download'\|manual-download" tests/renderer/update-dialog.spec.tsx` MUST return ≥4
      (1 docblock + 1 it() name + 1 prop + 2 comments + possibly more if surrounding
      docs reference it; lower bound 4 is conservative).
    - `grep -c "'windows-fallback'\|windows-fallback" tests/renderer/app-update-subscriptions.spec.tsx` MUST return 0.
    - `grep -c "'manual-download'" tests/renderer/app-update-subscriptions.spec.tsx` MUST return ≥1.
    - `npm test -- tests/renderer/update-dialog.spec.tsx tests/renderer/app-update-subscriptions.spec.tsx`
      MUST exit 0.
  </action>
  <verify>
    <automated>! grep -q "windows-fallback" tests/renderer/update-dialog.spec.tsx &amp;&amp; ! grep -q "windows-fallback" tests/renderer/app-update-subscriptions.spec.tsx &amp;&amp; grep -c "manual-download" tests/renderer/update-dialog.spec.tsx | awk '$1>=4 {exit 0} {exit 1}' &amp;&amp; grep -c "'manual-download'" tests/renderer/app-update-subscriptions.spec.tsx | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; npm test -- tests/renderer/update-dialog.spec.tsx tests/renderer/app-update-subscriptions.spec.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "windows-fallback" tests/renderer/update-dialog.spec.tsx` returns exactly `0`
    - `grep -c "windows-fallback" tests/renderer/app-update-subscriptions.spec.tsx` returns exactly `0`
    - `grep -c "manual-download" tests/renderer/update-dialog.spec.tsx` returns ≥ `4`
    - `grep -c "'manual-download'" tests/renderer/app-update-subscriptions.spec.tsx` returns ≥ `1`
    - `npm test -- tests/renderer/update-dialog.spec.tsx tests/renderer/app-update-subscriptions.spec.tsx` exits 0
  </acceptance_criteria>
  <done>
    Both renderer test files reference `'manual-download'` exclusively; tests pass.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Update tests/integration/auto-update-shell-allow-list.spec.ts (rewrite (14-p) for runtime URL flow + rename comments)</name>
  <files>tests/integration/auto-update-shell-allow-list.spec.ts</files>
  <read_first>
    - tests/integration/auto-update-shell-allow-list.spec.ts (the entire file — the existing 4 (14-p..14-s) tests + Plan 16-04's 9 new (16-a..16-i) tests)
    - src/renderer/src/App.tsx (post-Plan-16-05 — confirm the new contract: onOpenReleasePage handler reads `updateState.fullReleaseUrl` instead of a hardcoded literal)
    - .planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md (D-04 — runtime URL flow + D-07)
  </read_first>
  <action>
    Two coordinated edits in this file:

    Edit A: Comment renames (lines 5 + 14 of the file's docblock).
    1. Line 5: `The windows-fallback "Open Release Page" CTA depends on byte-for-byte URL`
       →
       `The manual-download "Open Release Page" CTA depends on URL trust-boundary checks`
       `(both the legacy index URL byte-for-byte literal AND the Phase 16 D-04 runtime`
       `per-release URL must pass through the SHELL_OPEN_EXTERNAL_ALLOWED gate).`
    2. Line 14: `which Plan 14-03 keeps for non-windows-fallback variant — currently the`
       →
       `which Plan 14-03 keeps for non-manual-download variant — currently the`

    Edit B: Rewrite test (14-p) at lines 41–44 to assert the new runtime URL flow.

    Current (now broken — Plan 16-05 Task 3 removed the hardcoded literal from App.tsx):
    ```ts
    it('(14-p) src/renderer/src/App.tsx contains the openExternalUrl call with the Releases-index URL', () => {
      const appTsx = readFile('src/renderer/src/App.tsx');
      expect(appTsx).toContain(`openExternalUrl('${RELEASES_INDEX_URL}')`);
    });
    ```

    New contract (Phase 16 D-04 — App.tsx forwards the runtime per-release URL):
    ```ts
    it('(14-p) src/renderer/src/App.tsx forwards the runtime updateState.fullReleaseUrl to openExternalUrl (Phase 16 D-04)', () => {
      const appTsx = readFile('src/renderer/src/App.tsx');
      // Phase 16 D-04 — the renderer no longer hardcodes the index URL. The
      // per-release URL templated by deliverUpdateAvailable (src/main/auto-update.ts)
      // flows through the update-available IPC payload to the updateState slot,
      // and onOpenReleasePage forwards updateState.fullReleaseUrl to
      // window.api.openExternalUrl (which routes through src/main/ipc.ts'
      // shell:open-external handler — guarded by isReleasesUrl per Plan 16-04).
      expect(appTsx).toContain('openExternalUrl(updateState.fullReleaseUrl)');
      // Defense-in-depth: the hardcoded RELEASES_INDEX_URL literal MUST NOT
      // re-appear inside an openExternalUrl call in App.tsx (catches a future
      // regression that re-introduces the dead path).
      expect(appTsx).not.toMatch(
        new RegExp(`openExternalUrl\\(\\s*['"\`]${RELEASES_INDEX_URL.replace(/[/.]/g, '\\$&')}['"\`]\\s*\\)`),
      );
    });
    ```

    Edit C: Rewrite test (14-s) at lines 58–87 to drop App.tsx from the byte-for-byte
    URL-consistency scan (App.tsx no longer carries the literal):

    Current (now broken):
    ```ts
    const filesToCheck = [
      'src/renderer/src/App.tsx',
      'src/main/ipc.ts',
      'src/main/auto-update.ts',
    ];
    ```

    New (drop App.tsx):
    ```ts
    // Phase 16 D-04 — App.tsx no longer carries a hardcoded URL literal (the
    // runtime updateState.fullReleaseUrl flows through). The byte-for-byte
    // URL-consistency check now compares only the two main-process files that
    // STILL carry the index URL literal: ipc.ts (allow-list Set entry) and
    // auto-update.ts (GITHUB_RELEASES_INDEX_URL constant — kept for backward
    // compat allow-list match per Phase 16 D-04 + UpdateDialog.tsx's "View
    // full release notes" link).
    const filesToCheck = [
      'src/main/ipc.ts',
      'src/main/auto-update.ts',
    ];
    ```

    The rest of test (14-s)'s body (regex pattern + occurrences scan + per-file
    expect) survives unchanged — it just operates over 2 files instead of 3.
    Update `expect(occurrences.length).toBeGreaterThanOrEqual(3)` → `≥2` (one match
    per remaining file).

    Tests (14-q) and (14-r) survive unchanged — they assert byte-for-byte presence
    of the literal in ipc.ts and auto-update.ts, both retained per Plan 16-03 + 16-04.

    Tests (16-a) through (16-i) (Plan 16-04 Task 1 additions) are unchanged.

    Self-check:
    - `grep -c "windows-fallback" tests/integration/auto-update-shell-allow-list.spec.ts` MUST return 0.
    - `grep -c "manual-download" tests/integration/auto-update-shell-allow-list.spec.ts` MUST return ≥2 (2 comment renames).
    - `grep -c "openExternalUrl(updateState.fullReleaseUrl)" tests/integration/auto-update-shell-allow-list.spec.ts` MUST return ≥1 (the new (14-p) assertion).
    - `npm test -- tests/integration/auto-update-shell-allow-list.spec.ts` MUST exit 0
      (all 13 tests — 4 Phase 14 + 9 Phase 16 D-04 — pass).
  </action>
  <verify>
    <automated>! grep -q "windows-fallback" tests/integration/auto-update-shell-allow-list.spec.ts &amp;&amp; grep -c "manual-download" tests/integration/auto-update-shell-allow-list.spec.ts | awk '$1>=2 {exit 0} {exit 1}' &amp;&amp; grep -c "openExternalUrl(updateState.fullReleaseUrl)" tests/integration/auto-update-shell-allow-list.spec.ts | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; npm test -- tests/integration/auto-update-shell-allow-list.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "windows-fallback" tests/integration/auto-update-shell-allow-list.spec.ts` returns exactly `0`
    - `grep -c "manual-download" tests/integration/auto-update-shell-allow-list.spec.ts` returns ≥ `2`
    - `grep -c "openExternalUrl(updateState.fullReleaseUrl)" tests/integration/auto-update-shell-allow-list.spec.ts` returns ≥ `1`
    - The 4 Phase 14 (14-p..14-s) tests + 9 Phase 16 D-04 (16-a..16-i) tests are all present
    - `npm test -- tests/integration/auto-update-shell-allow-list.spec.ts` exits 0 (13 tests pass)
  </acceptance_criteria>
  <done>
    Test (14-p) asserts the new Phase 16 D-04 runtime URL contract; test (14-s)
    operates over the 2 main-process files that retain the literal; tests (14-q)
    and (14-r) are unchanged; tests (16-a..16-i) from Plan 16-04 are unchanged.
    Suite passes.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 5: Add the no-windows-fallback-literal regression-gate spec</name>
  <files>tests/integration/no-windows-fallback-literal.spec.ts</files>
  <read_first>
    - tests/arch.spec.ts (existing precedent for recursive-readdir + readFileSync + regex pattern; the new spec follows this shape)
    - The just-modified 5 test files (Tasks 1–4) — confirm src/ should be 100% clean of `windows-fallback` by Wave 4
  </read_first>
  <action>
    Create `tests/integration/no-windows-fallback-literal.spec.ts` with the
    following content. This is a NEW file (Write tool — file does not exist yet).

    ```ts
    // @vitest-environment node
    /**
     * Phase 16 D-07 — regression gate for the windows-fallback → manual-download rename.
     *
     * Recursively scans src/ for the substring `windows-fallback` (in any quoting,
     * any context — type literal, string literal, comment, JSDoc). Fails the build
     * if any match is found.
     *
     * Why this gate matters:
     *   - Phase 16 mass-renames `'windows-fallback'` → `'manual-download'` across
     *     8+ source files (CONTEXT.md D-05). Future work (e.g. another phase that
     *     touches the auto-update surface) might inadvertently re-introduce the
     *     old literal — either by copy-pasting from .planning/ archived plans
     *     (where the old token is preserved as historical record) or by
     *     resurrecting an old branch.
     *   - The rename is locked in CONTEXT.md as "no transition period". This gate
     *     enforces the "no transition" rule against the entire src/ tree.
     *
     * Scope:
     *   - SCANS: every file under src/ recursively, including .ts / .tsx / .js /
     *     .jsx / .json / .md (we don't expect markdown but include for defense-in-
     *     depth).
     *   - EXCLUDES: dist/, build/, node_modules/, coverage/, .planning/ (the
     *     archived plans intentionally preserve the historical token), tests/
     *     (this gate is about src/, not test fixtures), out/, .vite/.
     *
     * Pattern lineage:
     *   - tests/arch.spec.ts (Layer 3 invariant) — same recursive-readdir +
     *     readFileSync + regex check shape. This file extends the precedent.
     *
     * Phase 16 D-07 — planner discretion: regression-gate test added.
     */
    import { describe, expect, it } from 'vitest';
    import { readdirSync, readFileSync, statSync } from 'node:fs';
    import { resolve, join } from 'node:path';

    const REPO_ROOT = resolve(__dirname, '..', '..');
    const SRC_ROOT = resolve(REPO_ROOT, 'src');

    function walk(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
          out.push(...walk(full));
        } else if (st.isFile()) {
          out.push(full);
        }
      }
      return out;
    }

    describe('Phase 16 D-07 — windows-fallback literal regression gate', () => {
      it('(16-r1) no file under src/ contains the literal token "windows-fallback"', () => {
        const files = walk(SRC_ROOT);
        const offenders: { file: string; lineNumbers: number[] }[] = [];

        for (const f of files) {
          let content: string;
          try {
            content = readFileSync(f, 'utf-8');
          } catch {
            continue; // binary or unreadable — skip
          }
          if (!content.includes('windows-fallback')) continue;
          const lines = content.split('\n');
          const matchedLines: number[] = [];
          lines.forEach((line, i) => {
            if (line.includes('windows-fallback')) {
              matchedLines.push(i + 1);
            }
          });
          offenders.push({
            file: f.replace(REPO_ROOT + '/', ''),
            lineNumbers: matchedLines,
          });
        }

        // Helpful diagnostic on failure: list each offending file + line.
        if (offenders.length > 0) {
          const summary = offenders
            .map((o) => `  ${o.file}: lines ${o.lineNumbers.join(', ')}`)
            .join('\n');
          throw new Error(
            `Phase 16 D-07 regression gate failed: ${offenders.length} file(s) under src/ ` +
              `still contain the literal token "windows-fallback":\n${summary}\n\n` +
              `The Phase 16 rename is "mass rename, no transition period". Replace each ` +
              `occurrence with "manual-download" (or update the gate exclusion list if ` +
              `the literal appears in archival comment context — though this is not ` +
              `expected for src/).`,
          );
        }

        expect(offenders).toEqual([]);
      });

      it('(16-r2) no file under src/ exports a type alias mentioning windows-fallback', () => {
        // Tighter pattern: catches `'windows-fallback'` typed-literal form even
        // when surrounded by other tokens (e.g. `'auto-update' | 'windows-fallback'`).
        // Subset of (16-r1) — the substring scan above already catches this; this
        // spec is the focused, explicit assertion that survives even if (16-r1)
        // is later relaxed for a comment-only carve-out.
        const files = walk(SRC_ROOT);
        for (const f of files) {
          let content: string;
          try {
            content = readFileSync(f, 'utf-8');
          } catch {
            continue;
          }
          expect(
            content,
            `Phase 16 D-07: ${f.replace(REPO_ROOT + '/', '')} contains the typed literal "'windows-fallback'"`,
          ).not.toContain(`'windows-fallback'`);
        }
      });
    });
    ```

    Verify the new file is syntactically valid by running it:
    - `npm test -- tests/integration/no-windows-fallback-literal.spec.ts` MUST exit 0.

    The two specs are intentionally redundant: (16-r1) is a broad substring scan
    catching ALL forms (typed literal, string literal, comment, JSDoc); (16-r2) is
    a tighter scan locking the typed-literal form in particular. Both must pass
    on a Phase-16-clean tree. Failure of either is a regression signal.
  </action>
  <verify>
    <automated>test -f tests/integration/no-windows-fallback-literal.spec.ts &amp;&amp; grep -c "Phase 16 D-07" tests/integration/no-windows-fallback-literal.spec.ts | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; grep -c "(16-r1)\|(16-r2)" tests/integration/no-windows-fallback-literal.spec.ts | awk '$1>=2 {exit 0} {exit 1}' &amp;&amp; npm test -- tests/integration/no-windows-fallback-literal.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/integration/no-windows-fallback-literal.spec.ts` exists
    - File contains describe block `'Phase 16 D-07 — windows-fallback literal regression gate'`
    - File contains 2 specs: `(16-r1)` (broad substring scan) and `(16-r2)` (typed-literal exact match)
    - `npm test -- tests/integration/no-windows-fallback-literal.spec.ts` exits 0
    - The gate is sourced under tests/integration/ (matches existing precedent for cross-cutting regression gates)
    - The gate uses the same pattern as tests/arch.spec.ts (recursive readdir + readFileSync + content scan)
  </acceptance_criteria>
  <done>
    The regression-gate spec is in place and passes against the Phase-16-clean
    tree. Future commits that re-introduce `'windows-fallback'` to src/ will
    fail the build at this gate.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 6: Run full test suite + final regression sweep</name>
  <files></files>
  <read_first>
    - All 6 PLAN.md files for Phase 16 (the full plan set just authored — to confirm every locked decision has been actioned)
  </read_first>
  <action>
    Final verification step. No file edits — only test runs + regression checks.

    1. Run the full test suite:
       `npm test` — MUST exit 0. Capture the test count: there should be 520 (the
       Phase 15 baseline) + 9 new Phase 16 D-04 tests + 2 new Phase 16 D-07
       regression-gate tests = 531 total passing tests. (Adjust the expected count
       if other tasks in this plan or prior plans added/removed tests; the
       absolute count matters less than `exit 0` and the deltas tracking.)

    2. Run the typecheck:
       `npm run typecheck` — MUST exit 0.

    3. Final greps to confirm Phase 16 is complete:
       - `grep -rn "'windows-fallback'" src/ tests/` — MUST return 0 matches.
       - `grep -rn "windows-fallback" src/` — MUST return 0 matches.
       - `grep -rn "SPIKE_PASSED" src/` — MUST return 0 matches.
       - `grep -rn "IN_PROCESS_AUTO_UPDATE_OK" src/main/auto-update.ts` — MUST
         return ≥ 2 matches (declaration + routing usage).
       - `grep -rn "isReleasesUrl" src/main/ipc.ts` — MUST return ≥ 3 matches
         (declaration + handler integration + docblock).
       - `grep -rn "/releases/tag/v" src/main/auto-update.ts` — MUST return ≥ 1.

    Document the results in the SUMMARY. If ANY of the above fails, surface the
    finding and revisit the responsible plan (16-01..16-05) to close the gap;
    do NOT mark Phase 16 complete until every gate passes.

    No file modifications are expected in this task. If a gate fails and a fix
    is required, that's an in-task hot-fix only if the fix is single-line and
    obviously correct (e.g. a missed comment site); otherwise escalate via the
    SUMMARY for replan.
  </action>
  <verify>
    <automated>! grep -rn "'windows-fallback'" src/ tests/ &amp;&amp; ! grep -rn "windows-fallback" src/ &amp;&amp; ! grep -rn "SPIKE_PASSED" src/ &amp;&amp; grep -c "IN_PROCESS_AUTO_UPDATE_OK" src/main/auto-update.ts | awk '$1>=2 {exit 0} {exit 1}' &amp;&amp; grep -c "isReleasesUrl" src/main/ipc.ts | awk '$1>=3 {exit 0} {exit 1}' &amp;&amp; grep -c "/releases/tag/v" src/main/auto-update.ts | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; npm run typecheck &amp;&amp; npm test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rn "'windows-fallback'" src/ tests/` returns 0 matches
    - `grep -rn "windows-fallback" src/` returns 0 matches
    - `grep -rn "SPIKE_PASSED" src/` returns 0 matches
    - `grep -c "IN_PROCESS_AUTO_UPDATE_OK" src/main/auto-update.ts` returns ≥ `2`
    - `grep -c "isReleasesUrl" src/main/ipc.ts` returns ≥ `3`
    - `grep -c "/releases/tag/v" src/main/auto-update.ts` returns ≥ `1`
    - `npm run typecheck` exits 0
    - `npm test` exits 0
    - All 5 ROADMAP success criteria 1–5 are reachable: variant routing locked, allow-list widened, INSTALL.md updated, Windows behavior preserved, Help/UpdateDialog copy correct
  </acceptance_criteria>
  <done>
    Phase 16 is mechanically complete. Every locked decision (D-01 through D-07)
    has been actioned. The full test suite passes. The regression gate locks the
    rename for future commits. Phase 16's deliverable is ready for SUMMARY +
    eventual ship-round (Phase 16 itself does NOT ship; CONTEXT.md `<domain>`
    explicitly defers package.json bump + tag + CI to a separate downstream
    task).
  </done>
</task>

</tasks>

<verification>
- All 4 modified test files reference `'manual-download'` exclusively
- New regression-gate spec (`tests/integration/no-windows-fallback-literal.spec.ts`) exists and passes
- `npm test` exits 0 (full suite passes including the new gate)
- `npm run typecheck` exits 0
- `grep -rn "'windows-fallback'" src/ tests/` returns 0 matches (Phase 16 mechanical-completeness gate)
- The Plan 14-05 URL-consistency tests survive in their renamed form: (14-p) asserts runtime URL flow; (14-q), (14-r) assert literal URL retention in ipc.ts + auto-update.ts; (14-s) operates over the 2-file scan after dropping App.tsx
</verification>

<success_criteria>
- All 5 modified test files reference the renamed literal
- New regression-gate spec is in place and passes
- Test (14-e) asymmetric-dismissal is exercised under macOS/manual-download (the natural Phase 16 target)
- Test (14-p) asserts the runtime URL flow contract (Phase 16 D-04)
- Full test suite passes
- Typecheck passes
- The Phase 16 rename is locked against future regressions by the gate spec
</success_criteria>

<output>
After completion, create `.planning/phases/16-macos-auto-update-manual-download-ux/16-06-SUMMARY.md`
documenting:
- 5 test files renamed (line-by-line audit of which sites changed)
- 1 new regression-gate spec created (file + structure overview)
- (14-e) platform-mock change rationale (win32 → darwin)
- (14-p) contract rewrite (literal URL → runtime URL flow)
- (14-s) scan-list reduction (3 files → 2 files)
- Test counts before/after (baseline 520 + 9 new D-04 + 2 new D-07 = 531 expected; record actual)
- Final regression sweep grep counts (all phase-completion gates GREEN)
- Phase 16 status: COMPLETE — mechanical work + test renames + regression gate locked. ROADMAP success criteria 1–5 all reachable. Note that ROADMAP success criteria #1 and #2 (live macOS dialog + browser launch) are observable only on a packaged macOS build — Phase 16 ships the code; the eventual v1.2.0 release wave (NOT this phase) UAT-confirms them.
</output>
</content>
</invoke>
---
phase: 16-macos-auto-update-manual-download-ux
plan: 03
type: execute
wave: 2
depends_on: ["16-01"]
files_modified:
  - src/main/auto-update.ts
autonomous: true
requirements: [UPDFIX-05]
must_haves:
  truths:
    - "On Linux, the variant routing branch evaluates to `'auto-update'` (in-process auto-update path stays)"
    - "On macOS, the variant routing branch evaluates to `'manual-download'` (Squirrel.Mac in-process swap is no longer attempted — closes D-15-LIVE-2)"
    - "On Windows without the runtime spike override (`spikeOutcome !== 'pass'`), the variant routing branch evaluates to `'manual-download'` (parity with current Windows-fallback behavior preserved — Phase 14 D-13)"
    - "On Windows with the runtime spike override (`spikeOutcome === 'pass'`), the variant routing branch evaluates to `'auto-update'` (escape hatch retained — D-02)"
    - "The deliverUpdateAvailable payload's `fullReleaseUrl` is per-release templated to `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v${info.version}` (D-04)"
    - "No `'windows-fallback'` literal survives in src/main/auto-update.ts"
    - "No `SPIKE_PASSED` constant survives in src/main/auto-update.ts (renamed to `IN_PROCESS_AUTO_UPDATE_OK`)"
    - "No `process.platform === 'win32'` literal at the variant-routing call-site (the leftover line 471 reference is removed per D-01 mechanical follow-through)"
  artifacts:
    - path: "src/main/auto-update.ts"
      provides: "Renamed gate `IN_PROCESS_AUTO_UPDATE_OK = process.platform === 'linux'`, simplified variant routing per D-01, per-release templated `fullReleaseUrl`, renamed UpdateAvailablePayload variant literal"
      contains: "IN_PROCESS_AUTO_UPDATE_OK"
  key_links:
    - from: "src/main/auto-update.ts deliverUpdateAvailable"
      to: "UpdateAvailablePayload type (line 50-55)"
      via: "variant field — must be `'auto-update' | 'manual-download'` post-rename"
      pattern: "'auto-update' \\| 'manual-download'"
    - from: "src/main/auto-update.ts deliverUpdateAvailable"
      to: "src/main/ipc.ts SHELL_OPEN_EXTERNAL_ALLOWED (Plan 16-04)"
      via: "fullReleaseUrl payload field — must be a URL the IPC allow-list accepts"
      pattern: "/releases/tag/v"
---

<objective>
Land the four mechanical edits to src/main/auto-update.ts that constitute the heart of
Phase 16:

1. Rename `SPIKE_PASSED` constant → `IN_PROCESS_AUTO_UPDATE_OK` and flip its definition
   from `process.platform !== 'win32'` (which evaluated `true` on macOS — the bug) to
   `process.platform === 'linux'` (Linux-only true; macOS+Windows route manual-download).
   (CONTEXT.md D-01)

2. Rename the UpdateAvailablePayload variant type literal `'windows-fallback'` →
   `'manual-download'` at line ~53 AND at the variant-typed local at line ~470 inside
   `deliverUpdateAvailable`. (CONTEXT.md D-05)

3. Simplify the variant routing call-site in `deliverUpdateAvailable` to the form locked
   in CONTEXT.md D-01:
   ```ts
   const variant: 'auto-update' | 'manual-download' =
     IN_PROCESS_AUTO_UPDATE_OK || (process.platform === 'win32' && spikeRuntimePass)
       ? 'auto-update'
       : 'manual-download';
   ```
   This removes the leftover `process.platform === 'win32'` AND-clause at the original
   line 471 (D-01 mechanical follow-through).

4. Switch `fullReleaseUrl` in the payload from the hardcoded `GITHUB_RELEASES_INDEX_URL`
   constant to a per-release templated URL of the form
   `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v${info.version}`
   (CONTEXT.md D-04). The `GITHUB_RELEASES_INDEX_URL` constant STAYS for the
   "View full release notes" link in UpdateDialog.tsx (Plan 14-05's URL-consistency
   gate uses it as the single canonical literal at the auto-update.ts site, and the
   index URL remains in the IPC allow-list as a backward-compat fallback per D-04).

This plan addresses CONTEXT.md D-01, D-02 (preserves the Windows runtime escape hatch),
D-04 (per-release URL), and D-05 (variant rename in main). It depends on Plan 16-01
because the UpdateAvailablePayload type imports from src/shared/types.ts via the shared
contract — the variant literal must agree byte-for-byte across the seam.

Purpose: Single source-of-truth gate flip + payload contract change. Every other Wave 2/3
file (IPC, renderer) consumes this output unchanged in shape but with the new variant
string flowing through.

Output: src/main/auto-update.ts with the renamed gate, renamed variant literal,
simplified routing, and per-release URL.
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
@src/main/auto-update.ts
@src/shared/types.ts

<interfaces>
<!-- Current state of src/main/auto-update.ts at the four edit sites: -->

Line 50-55 — UpdateAvailablePayload type:
```ts
export type UpdateAvailablePayload = {
  version: string;
  summary: string;
  variant: 'auto-update' | 'windows-fallback';
  fullReleaseUrl: string;
};
```

Line 84-85 — GITHUB_RELEASES_INDEX_URL constant (KEEP — used as backward-compat allow-list entry; UpdateDialog.tsx's "View full release notes" link still uses this):
```ts
const GITHUB_RELEASES_INDEX_URL =
  'https://github.com/Dzazaleo/Spine_Texture_Manager/releases';
```

Line 104 — gate constant (REPLACE):
```ts
const SPIKE_PASSED = process.platform !== 'win32';
```

Line 437-444 — docblock above deliverUpdateAvailable (variant-routing rationale; UPDATE the inline `'windows-fallback'` mention to `'manual-download'`).

Line 467-473 — variant-routing call-site inside deliverUpdateAvailable (REPLACE):
```ts
  // D-04 — Windows-fallback variant when on win32 AND spike has not passed
  // (build-time SPIKE_PASSED OR runtime spikeOutcome === 'pass').
  const spikeRuntimePass = state.spikeOutcome === 'pass';
  const variant: 'auto-update' | 'windows-fallback' =
    process.platform === 'win32' && !SPIKE_PASSED && !spikeRuntimePass
      ? 'windows-fallback'
      : 'auto-update';
```

Line 475-480 — payload assembly (REPLACE the fullReleaseUrl line):
```ts
  const payload: UpdateAvailablePayload = {
    version: info.version,
    summary: extractSummary(info.releaseNotes),
    variant,
    fullReleaseUrl: GITHUB_RELEASES_INDEX_URL,
  };
```

<!-- Comment line 18 also references 'windows-fallback' inside a wider comment block; update for consistency. -->
<!-- Comment line 438 ('windows-fallback') update for consistency. -->
<!-- Comment line 472 ('windows-fallback') is the literal string and is replaced as part of the routing rewrite. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Rename gate constant SPIKE_PASSED → IN_PROCESS_AUTO_UPDATE_OK and flip its definition</name>
  <files>src/main/auto-update.ts</files>
  <read_first>
    - src/main/auto-update.ts (lines 87–110 for the constant + its docblock; the docblock above SPIKE_PASSED at lines 87–103 is now misleading because there is no macOS spike to fail — REWRITE the docblock to match the new positive-gate framing per CONTEXT.md D-01 + D-02)
    - .planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md (D-01 single-positive-gate rationale + D-02 Windows-only escape hatch retained)
  </read_first>
  <action>
    Per CONTEXT.md D-01:
    1. Rename the constant `SPIKE_PASSED` → `IN_PROCESS_AUTO_UPDATE_OK` at the
       declaration site (currently line 104).
    2. Flip the value from `process.platform !== 'win32'` to
       `process.platform === 'linux'`.
    3. Rewrite the docblock above the constant (currently lines 87–103) to match the
       new positive-gate framing:

    ```ts
    /**
     * Phase 16 D-01 / D-02 — single positive gate for in-process auto-update.
     *
     * Reads as "this platform supports the in-process auto-update flow." Linux
     * is the only platform where Squirrel-equivalent in-process swap works
     * reliably without external code-signing constraints:
     *   - macOS: Squirrel.Mac strict-validates the Designated Requirement
     *     against the running app's code signature; ad-hoc-signed builds (no
     *     Apple Developer ID — declined for v1.2 per CONTEXT.md, deferred
     *     to v1.3+) generate fresh per-build hashes that cannot match
     *     v1.1.x's stored DR. Empirically observed during Phase 15 v1.1.3
     *     Test 7-Retry round 3 (2026-04-29 — D-15-LIVE-2). Routing to
     *     manual-download closes the bug.
     *   - Windows: NSIS auto-update spike has never run live (Phase 12 D-02
     *     strict-spike bar). Defaults to manual-download until a Windows
     *     host runs the spike. The `update-state.json` `spikeOutcome` field
     *     can promote Windows to in-process at runtime (Outcome A/promotion
     *     path — Phase 14 D-13).
     *   - Linux: AppImage in-process swap works (no code-signing constraint).
     *
     * D-02 — runtime override stays Windows-only. There is NO parallel
     * `macSignedOk` field. macOS structurally requires Apple Developer ID
     * code-signing for Squirrel.Mac to accept the swap; a runtime flag flip
     * cannot fix that. If Apple Developer ID enrollment ever lands (v1.3+
     * earliest), that's a separate code change with its own gate constant.
     *
     * Replaces the prior `SPIKE_PASSED = process.platform !== 'win32'` (Phase 12
     * D-04) which evaluated `true` on macOS and routed Squirrel.Mac into the
     * code-signature-mismatch failure mode for every macOS update since v1.0.0.
     */
    const IN_PROCESS_AUTO_UPDATE_OK = process.platform === 'linux';
    ```

    4. The constant must remain exported only as far as it was before (currently
       module-private — KEEP module-private; do not export). Verify by `grep -c "export
       const IN_PROCESS_AUTO_UPDATE_OK"` returning 0.

    Self-check:
    - `grep -c "SPIKE_PASSED" src/main/auto-update.ts` MUST return 0.
    - `grep -c "IN_PROCESS_AUTO_UPDATE_OK" src/main/auto-update.ts` MUST return ≥1
      (the declaration; Task 3 adds usages).
    - `grep -c "process.platform === 'linux'" src/main/auto-update.ts` MUST return ≥1.
  </action>
  <verify>
    <automated>grep -c "SPIKE_PASSED" src/main/auto-update.ts | grep -q '^0$' &amp;&amp; grep -c "IN_PROCESS_AUTO_UPDATE_OK" src/main/auto-update.ts | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; grep -c "process.platform === 'linux'" src/main/auto-update.ts | awk '$1>=1 {exit 0} {exit 1}'</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "SPIKE_PASSED" src/main/auto-update.ts` returns exactly `0`
    - `grep -c "IN_PROCESS_AUTO_UPDATE_OK" src/main/auto-update.ts` returns ≥ `1`
    - `grep -c "process.platform === 'linux'" src/main/auto-update.ts` returns ≥ `1`
    - `grep -c "process.platform !== 'win32'" src/main/auto-update.ts` returns exactly `0` (the old gate is gone)
    - Docblock above the constant rewritten to reflect the positive-gate framing (verify by Read of the docblock — contains the phrase "single positive gate for in-process auto-update")
  </acceptance_criteria>
  <done>
    The gate constant is renamed to `IN_PROCESS_AUTO_UPDATE_OK`, its value is
    `process.platform === 'linux'`, and its docblock matches the D-01/D-02
    framing. Tasks 2 and 3 still must update the variant literal (Task 2) and
    the routing call-site (Task 3) before the file typechecks fully against
    Wave 1's renamed shared types.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Rename UpdateAvailablePayload variant literal and update comment references</name>
  <files>src/main/auto-update.ts</files>
  <read_first>
    - src/main/auto-update.ts (lines 18, 50–55, 437–444 — every site that contains the literal `'windows-fallback'` outside of the variant-routing call-site itself; the call-site is rewritten as part of Task 3)
    - src/shared/types.ts (just-renamed shared contract from Plan 16-01 — main's UpdateAvailablePayload variant literal MUST agree byte-for-byte with the shared Api type literal at src/shared/types.ts)
    - .planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md (D-05 mass rename, no transition period)
  </read_first>
  <action>
    Per CONTEXT.md D-05, replace every occurrence of the literal `'windows-fallback'`
    AND the bare comment token `windows-fallback` in src/main/auto-update.ts EXCEPT
    those inside the deliverUpdateAvailable variant-routing call-site (Task 3 owns
    those — the routing block is rewritten wholesale and the rename happens as part
    of that rewrite).

    Specifically:
    1. Line 18 (file-top docblock): change
       `*     shape (auto-update OR windows-fallback per CONTEXT D-01..D-04).`
       to
       `*     shape (auto-update OR manual-download per Phase 12 D-04 + Phase 16 D-05).`
    2. Line 53 (UpdateAvailablePayload type member): change
       `variant: 'auto-update' | 'windows-fallback';`
       to
       `variant: 'auto-update' | 'manual-download';`
    3. Lines 437–438 (deliverUpdateAvailable docblock — the "Variant routing (D-04):"
       paragraph that says "Windows defaults to 'windows-fallback' until ..."): rewrite
       this paragraph to match the Phase 16 routing. Replace the existing block
       (currently lines 437–444 of the docblock) with:

       ```
       * Variant routing (Phase 16 D-01 + D-02 — supersedes the original Phase 12 D-04
       * windows-fallback framing): the platform-only gate IN_PROCESS_AUTO_UPDATE_OK
       * (Linux === true) routes Linux to 'auto-update'. macOS routes to
       * 'manual-download' unconditionally (Apple Developer ID code-signing required
       * for Squirrel.Mac swap on ad-hoc builds — declined for v1.2). Windows defaults
       * to 'manual-download' AND retains the Phase 12 D-02 runtime escape hatch:
       * `state.spikeOutcome === 'pass'` flips Windows to 'auto-update' without a
       * source change (used after a successful Windows-host spike per Phase 14 D-13).
       ```

    Do NOT edit the variant-routing call-site itself (lines ~467–473). Task 3 owns
    that wholesale rewrite.

    Self-check:
    - `grep -c "'windows-fallback'" src/main/auto-update.ts` MUST equal the count
      that survives in the deliverUpdateAvailable routing block (typically 2 — the
      type literal at line ~470 and the assignment branch at line ~472). If it
      reads any higher number than what Task 3 will reach, Task 2 missed a site.
    - `grep -c "windows-fallback" src/main/auto-update.ts` MUST drop substantially
      (from >=6 occurrences to <=4 — the routing block sites still survive).
    - `grep -c "'manual-download'" src/main/auto-update.ts` MUST return ≥1 (the
      type member at line 53).
  </action>
  <verify>
    <automated>grep -c "'manual-download'" src/main/auto-update.ts | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; grep -c "Phase 16 D-01" src/main/auto-update.ts | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; ! grep -q "windows-fallback per CONTEXT D-01..D-04" src/main/auto-update.ts &amp;&amp; ! grep -q "Windows defaults to 'windows-fallback' until" src/main/auto-update.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "'manual-download'" src/main/auto-update.ts` returns ≥ `1`
    - `grep -c "Phase 16 D-01" src/main/auto-update.ts` returns ≥ `1` (the new docblock attribution)
    - The literal phrase `windows-fallback per CONTEXT D-01..D-04` is GONE from the file (Line 18 rewrite confirmed)
    - The literal phrase `Windows defaults to 'windows-fallback' until` is GONE from the file (Line 437–438 rewrite confirmed)
    - The UpdateAvailablePayload type at line ~53 reads `variant: 'auto-update' | 'manual-download';`
  </acceptance_criteria>
  <done>
    The exported UpdateAvailablePayload type literal is renamed; the file-top
    docblock + the deliverUpdateAvailable docblock both match the Phase 16
    framing; the routing call-site itself remains untouched (Task 3's surface).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Rewrite the variant-routing call-site and switch fullReleaseUrl to per-release template</name>
  <files>src/main/auto-update.ts</files>
  <read_first>
    - src/main/auto-update.ts (lines 445–493 — the entire deliverUpdateAvailable function body — to confirm the asymmetric-dismissal block above the routing site, the routing site itself, and the payload assembly site below it; this task touches only the routing site + payload site, not the asymmetric-dismissal block)
    - src/main/auto-update.ts (lines 84–85 — confirm GITHUB_RELEASES_INDEX_URL constant STAYS as-is for the "View full release notes" UpdateDialog link consumed by Plan 14-05 URL-consistency gate)
    - .planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md (D-01 — exact target shape of the simplified routing; D-04 — per-release URL `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v${info.version}`)
  </read_first>
  <action>
    Per CONTEXT.md D-01 and D-04, replace the existing variant-routing block + the
    payload's `fullReleaseUrl` field assignment.

    REPLACE this existing block (currently lines 467–480):

    ```ts
      // D-04 — Windows-fallback variant when on win32 AND spike has not passed
      // (build-time SPIKE_PASSED OR runtime spikeOutcome === 'pass').
      const spikeRuntimePass = state.spikeOutcome === 'pass';
      const variant: 'auto-update' | 'windows-fallback' =
        process.platform === 'win32' && !SPIKE_PASSED && !spikeRuntimePass
          ? 'windows-fallback'
          : 'auto-update';

      const payload: UpdateAvailablePayload = {
        version: info.version,
        summary: extractSummary(info.releaseNotes),
        variant,
        fullReleaseUrl: GITHUB_RELEASES_INDEX_URL,
      };
    ```

    WITH this block (verbatim from CONTEXT.md D-01 simplified form, plus D-04 URL
    template):

    ```ts
      // Phase 16 D-01 + D-02 — single positive gate for in-process auto-update.
      // Linux always 'auto-update'. Windows 'auto-update' iff the runtime escape
      // hatch flag promotes (Phase 12 D-02 / Phase 14 D-13 — `spikeOutcome === 'pass'`
      // in update-state.json). Everything else routes to 'manual-download', which
      // is the Phase 16 rename of the Phase 12 D-04 windows-fallback variant.
      const spikeRuntimePass = state.spikeOutcome === 'pass';
      const variant: 'auto-update' | 'manual-download' =
        IN_PROCESS_AUTO_UPDATE_OK || (process.platform === 'win32' && spikeRuntimePass)
          ? 'auto-update'
          : 'manual-download';

      // Phase 16 D-04 — per-release templated URL. Lands the user directly on the
      // release with the .dmg / .exe / .AppImage assets visible (one fewer click than
      // the index page). The IPC allow-list (src/main/ipc.ts SHELL_OPEN_EXTERNAL_ALLOWED)
      // accepts both the index URL (kept for backward-compat) and any /releases/tag/v{semver}
      // URL — see Plan 16-04 isReleasesUrl helper.
      const payload: UpdateAvailablePayload = {
        version: info.version,
        summary: extractSummary(info.releaseNotes),
        variant,
        fullReleaseUrl: `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v${info.version}`,
      };
    ```

    Note on `console.info` log line (currently lines 487–490): the existing log
    already prints `variant=${variant}`. Since `variant` is now typed as
    `'auto-update' | 'manual-download'`, the log line continues to work unchanged
    — no edit needed there. VERIFY by Read that the log line at lines ~487–490
    survives intact.

    Note on `GITHUB_RELEASES_INDEX_URL` constant (lines 84–85): KEEP. It is still
    used as a backward-compat allow-list entry by Plan 16-04's `isReleasesUrl`
    helper, AND by Plan 14-05 URL-consistency regression gate (which checks that
    auto-update.ts contains the literal). Do NOT delete the constant.

    Self-check:
    - `grep -c "'windows-fallback'" src/main/auto-update.ts` MUST return 0 (Task 2
      removed the comment/type sites; Task 3 removed the routing-block sites).
    - `grep -c "windows-fallback" src/main/auto-update.ts` MUST return 0.
    - `grep -c "'manual-download'" src/main/auto-update.ts` MUST return ≥3 (type
      member from Task 2 + variant local-typed at routing block + routing-block
      assignment branch).
    - `grep -c "IN_PROCESS_AUTO_UPDATE_OK" src/main/auto-update.ts` MUST return ≥2
      (declaration from Task 1 + usage at routing block).
    - `grep -c "process.platform === 'win32'" src/main/auto-update.ts` MUST return
      exactly 1 (the routing block's `(process.platform === 'win32' && spikeRuntimePass)`
      sub-expression for the Windows runtime escape hatch — D-02). The leftover
      AND-clause from line 471 of the OLD code is removed per D-01.
    - `grep -c "/releases/tag/v" src/main/auto-update.ts` MUST return ≥1 (the
      templated URL).
    - `grep -c "GITHUB_RELEASES_INDEX_URL" src/main/auto-update.ts` MUST return ≥1
      (the constant declaration STAYS even though deliverUpdateAvailable no longer
      uses it for fullReleaseUrl — Plan 14-05 regression gate requires it).
    - `npm run typecheck` MUST exit 0.
  </action>
  <verify>
    <automated>grep -c "'windows-fallback'" src/main/auto-update.ts | grep -q '^0$' &amp;&amp; grep -c "windows-fallback" src/main/auto-update.ts | grep -q '^0$' &amp;&amp; grep -c "'manual-download'" src/main/auto-update.ts | awk '$1>=3 {exit 0} {exit 1}' &amp;&amp; grep -c "IN_PROCESS_AUTO_UPDATE_OK" src/main/auto-update.ts | awk '$1>=2 {exit 0} {exit 1}' &amp;&amp; grep -c "process.platform === 'win32'" src/main/auto-update.ts | grep -q '^1$' &amp;&amp; grep -c "/releases/tag/v" src/main/auto-update.ts | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; grep -c "GITHUB_RELEASES_INDEX_URL" src/main/auto-update.ts | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; npm run typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "'windows-fallback'" src/main/auto-update.ts` returns exactly `0`
    - `grep -c "windows-fallback" src/main/auto-update.ts` returns exactly `0`
    - `grep -c "'manual-download'" src/main/auto-update.ts` returns ≥ `3`
    - `grep -c "IN_PROCESS_AUTO_UPDATE_OK" src/main/auto-update.ts` returns ≥ `2`
    - `grep -c "process.platform === 'win32'" src/main/auto-update.ts` returns exactly `1` (the Windows runtime-escape sub-expression only — the leftover line 471 AND-clause is removed)
    - `grep -c "/releases/tag/v" src/main/auto-update.ts` returns ≥ `1` (the per-release URL template)
    - `grep -c "GITHUB_RELEASES_INDEX_URL" src/main/auto-update.ts` returns ≥ `1` (constant retained for Plan 14-05 regression gate compatibility)
    - `grep -c "info.version" src/main/auto-update.ts` returns ≥ `1` (the URL template references info.version)
    - `npm run typecheck` exits 0
  </acceptance_criteria>
  <done>
    The variant-routing call-site is the simplified form locked in CONTEXT.md D-01;
    the runtime Windows escape hatch (D-02) is preserved; the leftover line-471
    AND-clause is removed (D-01 mechanical follow-through); and `fullReleaseUrl`
    is per-release templated to `/releases/tag/v${info.version}` (D-04). The
    GITHUB_RELEASES_INDEX_URL constant is retained for downstream consumers
    (Plan 16-04 backward-compat allow-list entry; Plan 14-05 regression gate).
    Typecheck passes against the renamed Wave 1 shared types.
  </done>
</task>

</tasks>

<verification>
- `grep -rn "'windows-fallback'\|SPIKE_PASSED" src/main/auto-update.ts` returns 0 matches.
- `grep -c "IN_PROCESS_AUTO_UPDATE_OK" src/main/auto-update.ts` ≥ 2 (declaration + routing usage).
- `grep -c "'manual-download'" src/main/auto-update.ts` ≥ 3.
- `grep -c "/releases/tag/v" src/main/auto-update.ts` ≥ 1.
- `npm run typecheck` exits 0.

Note: `npm test -- tests/main/auto-update-dismissal.spec.ts` will still FAIL after this
plan, because that test references the literal `'windows-fallback'` (Plan 16-06 fixes
it). That is expected — Wave 2's contract is source-side correctness; test-suite green
is a Wave 4 (Plan 16-06) deliverable.
</verification>

<success_criteria>
- The renamed gate constant exists and is `process.platform === 'linux'`
- The variant routing simplified form from CONTEXT.md D-01 is in place
- The Windows runtime escape hatch (D-02) is preserved
- The per-release URL template (D-04) is in place
- All `'windows-fallback'` literals removed from src/main/auto-update.ts
- Typecheck passes
</success_criteria>

<output>
After completion, create `.planning/phases/16-macos-auto-update-manual-download-ux/16-03-SUMMARY.md`
documenting:
- Three site rewrites: gate constant + UpdateAvailablePayload variant + variant-routing block + payload fullReleaseUrl
- Before / after snippets of each rewrite
- grep counts (windows-fallback=0, IN_PROCESS_AUTO_UPDATE_OK≥2, manual-download≥3, /releases/tag/v≥1, GITHUB_RELEASES_INDEX_URL≥1)
- Typecheck result
- Note that 4 test files (tests/main/auto-update-dismissal.spec.ts, tests/main/ipc.spec.ts, tests/renderer/update-dialog.spec.tsx, tests/renderer/app-update-subscriptions.spec.tsx) are now RED until Plan 16-06 renames their assertions; this is the expected Wave 2 state.
</output>
</content>
</invoke>
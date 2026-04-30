---
phase: 16-macos-auto-update-manual-download-ux
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - INSTALL.md
autonomous: true
requirements: [UPDFIX-05]
must_haves:
  truths:
    - "INSTALL.md `## After installation: auto-update` section accurately describes the macOS+Windows manual-download flow (open Releases page, download installer, re-trigger Gatekeeper/SmartScreen)"
    - "INSTALL.md describes Linux as the in-process auto-update path (download + restart prompt)"
    - "INSTALL.md no longer claims auto-update works in-process on macOS"
  artifacts:
    - path: "INSTALL.md"
      provides: "Tester-facing copy that matches the Phase 16 macOS reality"
      contains: "Open the Releases page"
  key_links:
    - from: "INSTALL.md `## After installation: auto-update` section"
      to: "src/main/auto-update.ts variant routing (Plan 16-03)"
      via: "documented behavior must match shipped code: macOS+Windows → manual-download, Linux → in-process"
      pattern: "manual-download|Releases page"
---

<objective>
Rewrite the `## After installation: auto-update` section of INSTALL.md (lines ~137–141)
so that:
- Linux owns the in-process auto-update sentence (download + restart prompt).
- macOS+Windows share the manual-download paragraph (non-blocking notice, Open Releases
  page button, download new installer manually, re-trigger Gatekeeper/SmartScreen).

This plan addresses CONTEXT.md D-03 (minimal sentence rewrite — ~3 lines, no new
screenshots, no new subsection).

Purpose: Tester docs must match the shipped Phase 16 behavior. Without this rewrite,
the docs would still promise an in-process auto-update on macOS that no longer happens.

Output: INSTALL.md with the `## After installation: auto-update` section matching the
target shape locked in CONTEXT.md D-03.

Independence: This plan touches ONLY INSTALL.md. No code dependency on Wave 1 type
renames; no test impact. Can run in parallel with Plan 16-01 (Wave 1).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md
@CLAUDE.md
@INSTALL.md

<interfaces>
<!-- The current INSTALL.md ## After installation: auto-update block (lines 137-141): -->

```markdown
## After installation: auto-update

Once installed, the app checks GitHub Releases for newer versions on startup (silently — only shows a prompt if an update is available). You can also check manually via **Help → Check for Updates** in the app menu.

On macOS and Linux, accepting an update downloads the new version and prompts you to restart. On Windows, the same flow runs if your install is auto-update-capable; if not, the app shows a non-blocking notice with a button to open the Releases page where you can download the new installer manually.
```

<!-- After Phase 16, the platform routing is: -->
<!--   - Linux: in-process auto-update (Squirrel-equivalent on Linux works fine; AppImage swap) -->
<!--   - macOS + Windows: manual-download variant (open Releases page in browser, download new installer manually) -->

<!-- The exact target shape per CONTEXT.md D-03 — planner can polish wording but the structure is locked: -->

```markdown
## After installation: auto-update

Once installed, the app checks GitHub Releases for newer versions
on startup (silently — only shows a prompt if an update is
available). You can also check manually via Help → Check for
Updates.

On Linux, accepting an update downloads the new version and
prompts you to restart. On macOS and Windows, the app shows a
non-blocking notice with a button to open the Releases page —
download the new installer manually and run it (re-triggering
the first-launch Gatekeeper / SmartScreen step).
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Rewrite the auto-update section of INSTALL.md per CONTEXT.md D-03</name>
  <files>INSTALL.md</files>
  <read_first>
    - INSTALL.md (the file being modified — read the entire `## After installation: auto-update` section, lines 130–145, AND surrounding context (lines 110–155) so the surrounding markdown structure is not disturbed)
    - .planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md (D-03 locks the exact target prose; minimal sentence rewrite — no new subsection, no screenshots)
  </read_first>
  <action>
    Per CONTEXT.md D-03, replace the existing two-paragraph body of the
    `## After installation: auto-update` section (everything between the heading and the
    next `---` horizontal rule) with the target prose. The target shape is locked
    verbatim in D-03:

    Replace lines ~139–141 of INSTALL.md (the existing two paragraphs) with:

    ```
    Once installed, the app checks GitHub Releases for newer versions on startup (silently — only shows a prompt if an update is available). You can also check manually via **Help → Check for Updates**.

    On Linux, accepting an update downloads the new version and prompts you to restart. On macOS and Windows, the app shows a non-blocking notice with a button to open the Releases page — download the new installer manually and run it (re-triggering the first-launch Gatekeeper / SmartScreen step).
    ```

    Notes on wording:
    - Keep `**Help → Check for Updates**` bold (matches the rest of INSTALL.md's
      menu-reference convention).
    - Keep the section structure: heading → blank line → paragraph 1 → blank line →
      paragraph 2 → blank line → existing `---` rule.
    - Do NOT add a new subsection, do NOT add a screenshot reference, do NOT add a
      "Why macOS shows manual-download" explainer block — those are explicitly v1.3
      polish per CONTEXT.md `<deferred>`.
    - Preserve the heading text `## After installation: auto-update` exactly.
    - Preserve the trailing `---` separator below paragraph 2.
    - Other sections of INSTALL.md (### Linux install, ### Troubleshooting, ## Reporting issues)
      are NOT touched.

    Self-check after edit:
    - `grep -c "On macOS and Linux" INSTALL.md` MUST return 0 (the old phrasing).
    - `grep -c "On Linux," INSTALL.md` MUST return ≥1 (the new phrasing leads with Linux).
    - `grep -c "On macOS and Windows" INSTALL.md` MUST return ≥1 (the new manual-download
      grouping).
    - `grep -c "Open Release Page\|open the Releases page\|Releases page" INSTALL.md`
      MUST return ≥1 (the user-facing button affordance is mentioned).
    - `grep -c "Gatekeeper" INSTALL.md` MUST return ≥1 (the re-trigger note).
    - `grep -c "auto-update-capable" INSTALL.md` MUST return 0 (old Windows-conditional
      phrasing dropped — Phase 16 makes Windows unconditionally manual-download).
  </action>
  <verify>
    <automated>grep -c "On macOS and Linux" INSTALL.md | grep -q '^0$' &amp;&amp; grep -c "On Linux," INSTALL.md | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; grep -c "On macOS and Windows" INSTALL.md | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; grep -c "Releases page" INSTALL.md | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; grep -c "Gatekeeper" INSTALL.md | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; grep -c "auto-update-capable" INSTALL.md | grep -q '^0$'</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "On macOS and Linux" INSTALL.md` returns exactly `0` (old phrasing removed)
    - `grep -c "On Linux," INSTALL.md` returns ≥ `1` (new phrasing leads with Linux)
    - `grep -c "On macOS and Windows" INSTALL.md` returns ≥ `1` (new manual-download grouping)
    - `grep -c "Releases page" INSTALL.md` returns ≥ `1`
    - `grep -c "Gatekeeper" INSTALL.md` returns ≥ `1`
    - `grep -c "auto-update-capable" INSTALL.md` returns exactly `0` (old conditional phrasing dropped)
    - `grep -c "## After installation: auto-update" INSTALL.md` returns exactly `1` (heading preserved)
    - The `---` separator after the section is preserved (verify by reading the file post-edit)
  </acceptance_criteria>
  <done>
    INSTALL.md `## After installation: auto-update` section accurately reflects the
    Phase 16 routing: Linux owns the in-process sentence; macOS+Windows share the
    manual-download paragraph mentioning the Open Releases Page button + manual
    installer + Gatekeeper/SmartScreen re-trigger. No new screenshots; no new
    subsections.
  </done>
</task>

</tasks>

<verification>
- `grep -c "windows-fallback" INSTALL.md` returns 0 (no leaked old terminology — INSTALL.md never used the literal anyway, but defense-in-depth check).
- The target prose from D-03 is present in INSTALL.md.
- No other INSTALL.md sections (Linux install, Troubleshooting, Reporting issues) are touched — verify with `git diff INSTALL.md` showing only the auto-update section changed.
</verification>

<success_criteria>
- Section accurately describes Phase 16 platform routing
- macOS+Windows share manual-download paragraph
- Linux owns in-process sentence
- No new screenshots, no new subsections
- Prose matches the target shape locked in CONTEXT.md D-03
</success_criteria>

<output>
After completion, create `.planning/phases/16-macos-auto-update-manual-download-ux/16-02-SUMMARY.md`
documenting:
- Exact lines replaced (line range)
- Before / after snippet of the section body
- Verification grep counts (windows-fallback=0 in INSTALL.md, Releases page≥1, Gatekeeper≥1, auto-update-capable=0)
</output>
</content>
</invoke>
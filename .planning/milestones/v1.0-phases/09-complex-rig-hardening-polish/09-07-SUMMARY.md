---
phase: 09-complex-rig-hardening-polish
plan: 07
subsystem: help-dialog-in-app-documentation
tags: [phase-9, wave-5, help-dialog, in-app-docs, shell-open-external, modal, no-markdown-library]
requirements: [N2.2]
dependency_graph:
  requires:
    - "Phase 9 Plan 05 D-188 onMenuHelp + Help→Documentation menu accelerator (menu:help-clicked IPC)"
    - "Phase 9 Plan 05 SHELL_OPEN_EXTERNAL_ALLOWED set + shell:open-external IPC handler"
    - "Phase 9 Plan 05 window.api.openExternalUrl preload bridge"
    - "Phase 8.2 D-184 modalOpen derivation (auto File-menu suppression for [role='dialog'][aria-modal='true'])"
    - "Phase 6 Gap-Fix Round 6 useFocusTrap hook (document-level Escape + Tab cycle)"
    - "src/core/sampler.ts:41-44 canonical samplingHz vs skeleton.fps wording (CLAUDE.md fact #1)"
    - "Phase 9 Plan 06 rig-info tooltip (load-bearing 'editor metadata — does not affect sampling' phrasing)"
  provides:
    - "HelpDialog component (7 canonical sections + 3 external link buttons + Close + Escape + click-outside)"
    - "AppShell helpOpen state slot + onMenuHelp useEffect subscription"
    - "AppShell HelpDialog mount + helpOpen→modalOpen feed (parity with the other 5 modal slots)"
    - "tests/renderer/help-dialog.spec.tsx 3 GREEN cases (replaces 2 Wave 0 RED scaffolds)"
  affects:
    - "src/renderer/src/modals/HelpDialog.tsx (NEW)"
    - "src/renderer/src/components/AppShell.tsx (HelpDialog import + helpOpen state + onMenuHelp useEffect + modalOpen derivation + JSX mount)"
    - "tests/renderer/help-dialog.spec.tsx (3 cases replacing Wave 0 scaffold)"
tech_stack:
  added: []
  patterns:
    - "OverrideDialog-shape modal (role='dialog' + aria-modal='true' + useFocusTrap onEscape + outer-overlay onClick close + inner stopPropagation)"
    - "Static React JSX content (NO markdown library — RESEARCH §Recommendations #4 zero-XSS-surface choice)"
    - "Pitfall 9 listener-identity preservation reused via Plan 09-05 onMenuHelp preload bridge"
    - "Hardcoded module-level URL constants cross-referenced against SHELL_OPEN_EXTERNAL_ALLOWED in src/main/ipc.ts"
    - "Curried click handler pattern (openLink(url) returns the onClick closure) — keeps the JSX call-site terse without losing the URL constant at every button"
key_files:
  created:
    - "src/renderer/src/modals/HelpDialog.tsx"
    - ".planning/phases/09-complex-rig-hardening-polish/09-07-SUMMARY.md"
  modified:
    - "src/renderer/src/components/AppShell.tsx (HelpDialog import + helpOpen state + onMenuHelp useEffect + modalOpen derivation update + JSX mount)"
    - "tests/renderer/help-dialog.spec.tsx (3 GREEN cases replacing 2 RED scaffolds)"
key_decisions:
  - "Static React JSX over a markdown library (RESEARCH §Recommendations #4). Three rationales locked in the file's header comment: (1) zero XSS surface — we author the JSX, no untrusted-content path; (2) ~0 KB runtime vs ~80 KB for react-markdown or ~50 KB for marked + dompurify; (3) one-time authored content makes a build-pipeline for static help overkill. Verified absence of `from 'react-markdown' / from 'marked' / from 'dompurify'` imports."
  - "External links rendered as <button> (NOT <a href>). Browsers might intercept <a href=…> via the user-agent default link-handling path; the project's contract is that EVERY external URL goes through the Plan 09-05 allow-list. <button onClick={openLink(url)}> guarantees the route through window.api.openExternalUrl + SHELL_OPEN_EXTERNAL_ALLOWED.has() — no escape hatch. The visual appearance (underline + accent color) preserves link affordance without giving up the security envelope."
  - "Three external URLs reused verbatim from Plan 09-05's initial allow-list (spine-runtimes, spine-api-reference, spine-json-format). No allow-list extension required — the three existing entries cover sections 2 (JSON format), 6 (Spine Runtimes), and 7 (API reference). Future-proofing: if a section ever needs a new URL, the author MUST add it to SHELL_OPEN_EXTERNAL_ALLOWED in src/main/ipc.ts; mismatches are silently dropped by the main handler (one-way channel; the dialog cannot observe rejection)."
  - "Section 7 wording ('editor metadata' + 'does not affect sampling' with em-dash U+2014) load-bearing — the renderer test greps the dialog's textContent for both substrings. This locks alignment with src/core/sampler.ts:41-44 + Plan 09-06 rig-info tooltip phrasing per CLAUDE.md fact #1. A future edit to the section that drops either substring will fail the test."
  - "Modal shell mirrors OverrideDialog verbatim (role='dialog' + aria-modal='true' + aria-labelledby='help-title' + useFocusTrap onEscape + outer-overlay onClick = onClose + inner content onClick stopPropagation). Reusing the established shape means HelpDialog auto-participates in the 08.2 D-184 modalOpen derivation alongside the other 5 modal slots — no new menu-suppression wiring."
  - "helpOpen explicitly added to AppShell's modalOpen derivation alongside settingsOpen. aria-modal='true' alone would auto-suppress via 08.2 D-184, but explicit inclusion keeps the derivation list parallel with the existing 5 slots (dialogState / exportDialogState / atlasPreviewOpen / saveQuitDialogState / settingsOpen). Defense-in-depth + readability."
  - "Cancel-button label matches OverrideDialog's 'Cancel' affordance — but here it's labeled 'Close' (the dialog has no apply/commit semantics; closing is the only action). Aria-label='Close help' is the test selector to disambiguate from any future close buttons inside sub-sections."
metrics:
  duration: ~7 min
  completed_date: 2026-04-26
  tasks: 2
  commits: 3
  files_changed: 3
  files_created: 1
  tests_added_passing: 3
  tests_red_to_green: 2  # The two Wave 0 RED scaffolds flipped GREEN; net delta after replacing dummy `expect(true).toBe(false)` assertions with 3 real cases.
---

# Phase 09 Plan 07: HelpDialog (In-app Documentation) Summary

Lands the fifth and final Phase 9 polish deliverable — a single-page React modal with seven canonical sections rendered via static JSX (no markdown library) and three external link buttons routed through the Plan 09-05 `shell.openExternal` allow-list. Plan 09-08 (close-out) is now unblocked; this plan represents the last of the five ROADMAP-named Phase 9 deliverables.

## Tasks Completed

| # | Name | Commits | Files |
|---|------|---------|-------|
| 1 | Author HelpDialog component with 7 static sections + external link buttons | `16b65e1` (GREEN) | `src/renderer/src/modals/HelpDialog.tsx` |
| 2 | Wire HelpDialog into AppShell + flip help-dialog.spec.tsx GREEN | `7455e5e` (RED test rewrite) + `b1bdefa` (GREEN AppShell wiring) | `src/renderer/src/components/AppShell.tsx`, `tests/renderer/help-dialog.spec.tsx` |

## What Shipped

### HelpDialog content surface (Task 1 — `src/renderer/src/modals/HelpDialog.tsx`, NEW)

**~240 lines of static React JSX** organized into 7 `<section>` blocks:

| # | Section heading | External link |
|---|-----------------|---------------|
| 1 | What this app does | — |
| 2 | How to load a rig | `https://en.esotericsoftware.com/spine-json-format` (Spine JSON format reference) |
| 3 | Reading the Global Max Render Source panel | — |
| 4 | Reading the Animation Breakdown panel | — |
| 5 | How to override a scale | — |
| 6 | How to optimize and export | `https://esotericsoftware.com/spine-runtimes` (Spine Runtimes reference) |
| 7 | Sampling rate (advanced) — samplingHz vs skeleton.fps | `https://esotericsoftware.com/spine-api-reference` (Spine API reference) |

**Modal shell mirrors `OverrideDialog.tsx` verbatim:**
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby="help-title"`.
- `useFocusTrap(dialogRef, props.open, { onEscape: props.onClose })` — document-level Escape + Tab cycle (Phase 6 Gap-Fix Round 6).
- Outer overlay `onClick = onClose`; inner content `onClick = stopPropagation` so clicks on text/buttons don't dismiss.
- Close button (top-right, `aria-label="Close help"`) — explicit dismissal affordance.
- Inner content scrollable via `max-h-[80vh] overflow-y-auto` so the dialog stays viewport-friendly on small windows.

**External link buttons:** rendered as `<button>` (not `<a href>`). The curried `openLink(url) → () => window.api.openExternalUrl(url)` handler routes every click through Plan 09-05's allow-listed bridge. Each `url` is a hardcoded module-level constant (`SPINE_RUNTIMES_URL`, `SPINE_API_REF_URL`, `SPINE_JSON_FORMAT_URL`) — no user-controlled values reach the handler.

### External URL allow-list verification

All three URLs referenced by HelpDialog are present verbatim in `SHELL_OPEN_EXTERNAL_ALLOWED` in `src/main/ipc.ts` (added by Plan 09-05 Task 2). No allow-list extension required:

| HelpDialog constant | URL | In `SHELL_OPEN_EXTERNAL_ALLOWED` (src/main/ipc.ts:131-138) |
|---------------------|-----|------------------------------------------------------------|
| `SPINE_RUNTIMES_URL` | `https://esotericsoftware.com/spine-runtimes` | ✅ |
| `SPINE_API_REF_URL` | `https://esotericsoftware.com/spine-api-reference` | ✅ |
| `SPINE_JSON_FORMAT_URL` | `https://en.esotericsoftware.com/spine-json-format` | ✅ |

The cross-reference was verified by `grep -q 'esotericsoftware.com/spine-runtimes' src/main/ipc.ts` (and the corresponding two for the other URLs) at Task 1 verify time.

### Section 7 wording verification (CLAUDE.md fact #1 + Plan 09-06 rig-info tooltip alignment)

Section 7's two paragraphs contain both load-bearing substrings asserted by `tests/renderer/help-dialog.spec.tsx`:

| Substring | Source/anchor |
|-----------|---------------|
| `editor metadata` | `src/core/sampler.ts:41-44` block comment + Plan 09-06 rig-info tooltip line `skeleton.fps: <N> (editor metadata — does not affect sampling)` |
| `does not affect sampling` | Same |

The em-dash (U+2014) appears in Section 7's heading "Sampling rate (advanced) — samplingHz vs skeleton.fps" and in the second paragraph "editor metadata — it does not affect sampling" — both use the U+2014 character (rendered via `&mdash;` JSX entity) so any future edit that drops the em-dash would visibly diverge from the canonical wording.

### AppShell wiring (Task 2 — `src/renderer/src/components/AppShell.tsx`)

**Six surgical insertions** (all pattern-paralleling existing `settingsOpen`/`onMenuSettings`/`SettingsDialog` plumbing from Plan 09-06):

1. `import { HelpDialog } from '../modals/HelpDialog';` next to the SettingsDialog import.
2. `const [helpOpen, setHelpOpen] = useState<boolean>(false);` next to `settingsOpen`.
3. `useEffect(() => { const unsubscribe = window.api.onMenuHelp(() => setHelpOpen(true)); return unsubscribe; }, []);` mirroring the `onMenuSettings` useEffect.
4. `helpOpen` added to the `modalOpen` derivation alongside `settingsOpen`.
5. `helpOpen` added to the dependency array of the `notifyMenuState` useEffect.
6. `{helpOpen && <HelpDialog open={true} onClose={() => setHelpOpen(false)} />}` mounted next to `SettingsDialog` in the JSX.

The Pitfall 9 listener-identity preservation comes from Plan 09-05's preload bridge (`onMenuHelp` captures the wrapped const before `ipcRenderer.on`); AppShell's cleanup just returns the unsubscribe closure verbatim.

### Test count delta

| File | Before | After | Delta |
|------|-------:|------:|------:|
| `tests/renderer/help-dialog.spec.tsx` | 2 RED placeholders (`expect(true).toBe(false)`) | 3 GREEN | **+3 GREEN / -2 RED scaffolds** |
| Full suite (excluding fixtures-Girl gate) | 326 passed (with 2 help-dialog RED) | 329 passed (no help-dialog RED) | **+3** |

## Verification Evidence

```text
$ npm run test -- --run tests/renderer/help-dialog.spec.tsx
 Test Files  1 passed (1)
      Tests  3 passed (3)

$ npm run test -- --run --exclude="tests/main/sampler-worker-girl.spec.ts"
 Test Files  29 passed (29)
      Tests  329 passed | 2 skipped | 1 todo (332)

$ npx tsc --noEmit -p tsconfig.web.json   # exits 0
$ npx tsc --noEmit -p tsconfig.node.json  # exits 0

$ grep -n "onMenuHelp\|HelpDialog" src/renderer/src/components/AppShell.tsx
60:import { HelpDialog } from '../modals/HelpDialog';
148:  // 08.2 menu surface; Plan 09-05 wired menu:help-clicked + onMenuHelp).
152:  const [helpOpen, setHelpOpen] = useState<boolean>(false);
829:      // Phase 9 Plan 07 — HelpDialog joins the same derivation. aria-modal
856:   * Phase 9 Plan 07 — Help menu subscription. The native Help→Documentation
857:   * preservation lives in the preload (Plan 09-05 Task 2 onMenuHelp); the
863:    const unsubscribe = window.api.onMenuHelp(() => setHelpOpen(true));
1294:      {helpOpen && (
1295:        <HelpDialog open={true} onClose={() => setHelpOpen(false)} />

$ grep -E "from ['\"]react-markdown['\"]|from ['\"]marked['\"]|from ['\"]dompurify['\"]" src/renderer/src/modals/HelpDialog.tsx
# (no matches — only mention is in a rationale comment)
```

The single failing test in the full-suite run (`tests/main/sampler-worker-girl.spec.ts`) is a pre-existing fixture-availability failure — `fixtures/Girl/` is not present in the worktree base (the directory is not committed to commit `2fc4aca`). This is the same condition Plan 09-02 / 09-06 had to navigate; out of Plan 09-07 scope per the SCOPE BOUNDARY rule (it's not caused by 09-07's changes).

## Decisions Made

1. **Static React JSX over a markdown library.** RESEARCH §Recommendations #4: zero XSS surface (we author the JSX, no untrusted content path); ~0 KB runtime footprint vs ~80 KB for react-markdown or ~50 KB for marked + dompurify; one-time authored content makes a build-pipeline overkill.

2. **External links rendered as `<button>`, not `<a href>`.** Browsers might intercept `<a href>` via the user-agent default link-handling path; the project's contract is that every external URL goes through the Plan 09-05 allow-list. Forcing the route through `window.api.openExternalUrl` is the security envelope.

3. **Three external URLs reused verbatim from Plan 09-05's initial allow-list.** No allow-list extension was required — `spine-runtimes`, `spine-api-reference`, and `spine-json-format` cover sections 2, 6, and 7 cleanly.

4. **Section 7 wording is load-bearing.** The substrings `editor metadata` + `does not affect sampling` (with em-dash U+2014) align with `src/core/sampler.ts:41-44` + Plan 09-06 rig-info tooltip per CLAUDE.md fact #1. The renderer test greps the dialog's `textContent` for both — any future edit dropping either substring fails the test.

5. **Modal shell mirrors `OverrideDialog.tsx` verbatim.** Reusing the established shape (`role='dialog'` + `aria-modal='true'` + `useFocusTrap onEscape` + outer-overlay onClick = onClose + inner stopPropagation) auto-participates in the 08.2 D-184 modalOpen derivation. No new menu-suppression wiring.

6. **`helpOpen` explicitly added to AppShell's modalOpen derivation.** `aria-modal='true'` alone would auto-suppress via 08.2 D-184, but explicit inclusion keeps the derivation list parallel with the other 5 modal slots. Defense-in-depth + readability.

7. **Curried click handler pattern (`openLink(url) → () => window.api.openExternalUrl(url)`).** Keeps the JSX call-site terse without losing the URL constant at every button. Each call expression captures a hardcoded module-level URL constant — no user-controlled values can flow through.

## Deviations from Plan

None — plan executed exactly as written. The action steps in the plan ("Step 1...", "Step 2...", "Step 3...") for Task 1 (author HelpDialog + verify allow-list) and Task 2 (wire AppShell + replace Wave 0 scaffold) were followed verbatim.

The plan author noted (Task 2 step 2) that the test file would assert against `screen.getByRole('dialog', { name: /documentation/i })` — that worked as written; the dialog's `aria-labelledby="help-title"` + the `<h2 id="help-title">Documentation</h2>` heading wires the accessible name through Testing Library's name-matcher cleanly.

## Threat Model Compliance

The plan's `<threat_model>` block enumerates 4 threats. All `mitigate` dispositions are implemented:

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-09-07-XSS | mitigate | **Mitigated.** RESEARCH §Recommendations #4: NO markdown library imports (verified — `grep -E "from ['\"]react-markdown['\"]/marked/dompurify"` returns no matches in HelpDialog.tsx). All section content is authored as React JSX text interpolation (auto-escaped). No `dangerouslySetInnerHTML` anywhere in the file. |
| T-09-07-OPEN-EXTERNAL | mitigate | **Mitigated.** Plan 09-05's `SHELL_OPEN_EXTERNAL_ALLOWED` ReadonlySet + exact-string `has()` check covers the main side. HelpDialog references each URL via a hardcoded module-level string constant (`SPINE_RUNTIMES_URL`, etc.); an attacker-modified renderer can call `openExternalUrl` with arbitrary strings, but the main handler rejects anything outside the allow-list. The 3 URLs HelpDialog uses are all verified present in the allow-list. |
| T-09-07-LISTENER-LEAK | mitigate | **Mitigated.** Pitfall 9 listener-identity preservation in Plan 09-05's preload `onMenuHelp` (the wrapped const is captured BEFORE `ipcRenderer.on` so the unsubscribe closure references the same identity). AppShell's `useEffect` returns the unsubscribe closure as cleanup. |
| T-09-07-DIALOG-DOS | accept | Accepted — React handles HelpDialog mount/unmount idempotently. Setting `helpOpen` to true while already true is a no-op (React skips re-render on same-value setState). No resource leak under rapid Help-menu spam. |

## Plan 09-08 Unblocked

Plan 09-08 (close-out) can now run UAT on the full Phase 9 deliverable set:

1. Sampler worker (Plan 02) — N2.2 wall-time gate.
2. Virtualization (Plan 03 / Plan 04) — GlobalMaxRender + AnimationBreakdown threshold-gated TanStack Virtual.
3. Settings modal (Plan 06) — Edit→Preferences (Cmd/Ctrl+,) → samplingHz.
4. Rig-info tooltip (Plan 06) — filename chip hover with `skeleton.fps: <N> (editor metadata — does not affect sampling)`.
5. **Help dialog (Plan 07, this plan)** — Help→Documentation → 7 canonical sections + 3 external links routed through the allow-list.

The manual smoke for Plan 07 (per the plan's `<verification>` step 6): `npm run dev` → click Help → Documentation → HelpDialog opens with 7 sections → click "Spine Runtimes reference" → system browser opens at the Spine docs URL → close dialog → menu re-enables (08.2 D-184 modalOpen derivation). This is reserved for Plan 09-08 UAT; the renderer test covers the click-through to `openExternalUrl` deterministically.

## Self-Check: PASSED

Verification of claimed artifacts:

- `[FOUND]` `src/renderer/src/modals/HelpDialog.tsx` exists with `aria-modal="true"`, `aria-labelledby="help-title"`, 7 `<section>` blocks, hardcoded SPINE_*_URL constants, and `window.api.openExternalUrl` invocations.
- `[FOUND]` `src/main/ipc.ts` `SHELL_OPEN_EXTERNAL_ALLOWED` contains all 3 URLs HelpDialog references (verified by Plan 09-05 + verified again here via grep).
- `[FOUND]` `src/renderer/src/components/AppShell.tsx` imports `HelpDialog`, declares `helpOpen` state, subscribes to `window.api.onMenuHelp` in a `useEffect` with cleanup, includes `helpOpen` in the `modalOpen` derivation + dependency array, and mounts `<HelpDialog open={helpOpen} onClose={...} />`.
- `[FOUND]` `tests/renderer/help-dialog.spec.tsx` 3 cases GREEN: (1) dialog opens with role=dialog labelled "Documentation" + 7 sections + Section 7 load-bearing wording; (2) external link clicks invoke `openExternalUrl` with the 3 allow-listed URLs (one per click, total 3 calls); (3) Close button + click-outside both dispatch `onClose`.
- `[FOUND]` Section 7 wording contains the literal substrings `"editor metadata"` and `"does not affect sampling"` (verified via `grep -q` at Task 1 verify time).
- `[FOUND]` HelpDialog.tsx contains NO markdown library imports (`grep -E "from ['\"]react-markdown|marked|dompurify['\"]"` returns no import-statement matches; only matches are in a rationale comment that lists what we deliberately avoided).
- `[FOUND]` Commit `16b65e1` (Task 1 GREEN — HelpDialog component).
- `[FOUND]` Commit `7455e5e` (Task 2 RED — test rewrite).
- `[FOUND]` Commit `b1bdefa` (Task 2 GREEN — AppShell wiring).
- `[FOUND]` `npx vitest run tests/renderer/help-dialog.spec.tsx` → 3/3 passed.
- `[FOUND]` `npx tsc --noEmit -p tsconfig.web.json` exits 0.
- `[FOUND]` `npx tsc --noEmit -p tsconfig.node.json` exits 0.
- `[FOUND]` Full test suite (excluding pre-existing `sampler-worker-girl` fixture-dependent gate): 329 passed / 2 skipped / 1 todo (29/29 test files green).

All claims verified.

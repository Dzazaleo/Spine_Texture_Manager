# Phase 16: macOS auto-update — switch to manual-download UX - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Switch macOS auto-update from Squirrel.Mac in-process swap (which fails code-signature validation on ad-hoc-signed builds — D-15-LIVE-2 latent since v1.0.0, empirically observed during Phase 15 v1.1.3 Test 7-Retry round 3, 2026-04-29) to the existing `windows-fallback` UpdateDialog variant pattern (Phase 12 D-04 + D-18) that opens GitHub Releases in the user's browser. Rename `windows-fallback` → `manual-download` consistently across all surface mention sites. Update INSTALL.md auto-update copy. Refresh tests.

**In scope (this phase):**
- Flip the `SPIKE_PASSED = process.platform !== 'win32'` gate so macOS routes to manual-download by default (Linux remains in-process auto-update; Windows remains manual-download per Phase 14 D-13).
- Variant rename `windows-fallback` → `manual-download` propagated to: `src/main/auto-update.ts`, `src/main/ipc.ts`, `src/preload/index.ts`, `src/shared/types.ts`, `src/renderer/src/App.tsx`, `src/renderer/src/modals/UpdateDialog.tsx`, all relevant tests, and `INSTALL.md`.
- `SHELL_OPEN_EXTERNAL_ALLOWED` allow-list extended from a literal `/releases` index URL to a pattern that also accepts `/releases/tag/v{version}` (per D-04 below).
- INSTALL.md `## After installation: auto-update` section rewritten so Linux owns the in-process sentence and macOS+Windows share the manual-download paragraph (D-03).
- Vitest coverage for the renamed literal + new versioned-URL allow-list pattern.

**Out of scope (this phase):**
- Apple Developer ID enrollment / notarization — declined 2026-04-29, locked deferred to v1.3+ at the earliest. Manual-download UX is the v1.2 answer, not a stopgap.
- INSTALL.md screenshots of the new dialog (target was the minimal sentence rewrite per D-03; full subsection + screenshot is a v1.3 polish if testers ask for it).
- Sentry / TEL-future / Windows EV cert / `.skel` loader / Spine 4.3+ adapters / etc. — all v1.2 out-of-scope per REQUIREMENTS.md.
- Any change to the renderer subscription model, dismissal semantics, or sticky-slot behavior — Phase 14 owns those (D-02 / D-03 / D-05 stay verbatim).
- `package.json` version bump, tag push, CI run, GitHub Release publish — Phase 16 is code + docs + tests; Phase 15-style release wave is a separate downstream task whenever the user is ready to ship v1.2.0.
- A v1.2 release-notes blurb about the v1.1.x → v1.2 macOS migration. Tracked in `<specifics>` below; planner can fold into the SUMMARY for the Phase 16 PR but it does not need to land inside `INSTALL.md`.

</domain>

<decisions>
## Implementation Decisions

### A. Platform-routing gate redesign

- **D-01:** **Single positive gate.** Rename `SPIKE_PASSED` → `IN_PROCESS_AUTO_UPDATE_OK = process.platform === 'linux'`. Reads as "this platform supports the in-process auto-update flow." Replaces the misleading "spike" framing (there is no macOS spike — it's a structural code-signing limitation, not an unrun verification). The variant routing in `deliverUpdateAvailable` simplifies to:
  ```ts
  const variant: 'auto-update' | 'manual-download' =
    IN_PROCESS_AUTO_UPDATE_OK || (process.platform === 'win32' && spikeRuntimePass)
      ? 'auto-update'
      : 'manual-download';
  ```
  The leftover `process.platform === 'win32'` literal at line 471 (which would silently exclude macOS) is removed as a mechanical follow-through; planner picks the exact arrangement.

- **D-02:** **Runtime `spikeOutcome === 'pass'` override stays Windows-only.** macOS routing is platform-only — no parallel `macSignedOk` field, no runtime escape hatch. Reason: macOS structurally requires Apple Developer ID code-signing for Squirrel.Mac to accept the swap; a runtime flag flip cannot fix the Designated Requirement mismatch on ad-hoc builds. If Apple Developer ID enrollment ever lands (v1.3+ earliest), that's a separate code change with its own gate. The Windows escape hatch stays for whenever the Phase 12 D-02 / Phase 14 D-13 Windows spike runs live.

### B. Variant rename propagation

- **D-05 (locked from REQ):** Variant string literal changes from `'windows-fallback'` to `'manual-download'`. Type literal in `UpdateDialogVariant` becomes `'auto-update' | 'manual-download'`. All code, tests, and docs that match the literal `'windows-fallback'` are renamed to `'manual-download'`. Mass rename, no transition period. The rename is a string-literal change only — UpdateDialog.tsx's 5 conditional branches keep their existing rendering shape (Open Release Page + Later for `manual-download`; Download/Restart/Later/Dismiss for `auto-update`). Planner picks: regex-replace vs hand-by-hand audit vs grep-driven script.

### C. INSTALL.md auto-update copy

- **D-03:** **Minimal sentence rewrite.** Group macOS+Windows under the manual-download notice; leave Linux on the in-process auto-update sentence. ~3-line change. No new screenshots. Target shape (planner can polish wording):
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

- **D-06 (Help dialog confirmed no-op surface):** REQ-05 lists "in-app Help dialog" as a propagation site, but `src/renderer/src/modals/HelpDialog.tsx` (the static documentation modal triggered by **Help → Documentation**) has 7 sections covering install/load/panels/override/optimize/sampling and **no** auto-update copy at all (verified by grep — zero matches for `update`, `fallback`, `manual-download`, `squirrel`, etc.). The REQ author likely meant the `UpdateDialog` (the dialog launched by **Help → Check for Updates**), which IS being updated under D-05. Planner re-verifies during planning; if the REQ intended a NEW "How auto-updates work" subsection in `HelpDialog.tsx`, that's a v1.3 docs polish task and should be deferred.

### D. "Open Release Page" URL target

- **D-04:** **Versioned tag URL** — button opens `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v${info.version}`. The dialog already receives `info.version` on the `UpdateAvailablePayload`, so `fullReleaseUrl` becomes per-release templated in `deliverUpdateAvailable` instead of a single hard-coded constant. Lands the user directly on the release with the `.dmg` / `.exe` / `.AppImage` assets visible — one fewer click than the index page. Allow-list change: `SHELL_OPEN_EXTERNAL_ALLOWED` shifts from a literal-string match (Phase 12 D-18 added the `/releases` index URL) to a prefix or regex pattern that accepts:
  - `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` (index — keep allowed for backward compat / fallback)
  - `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v{semver}` (versioned tag — new)

  Planner picks the pattern shape. Suggested: a small helper `isReleasesUrl(url): boolean` that does a `URL`-parse + structural check (`hostname === 'github.com'` && `pathname.startsWith('/Dzazaleo/Spine_Texture_Manager/releases')`), avoiding regex pitfalls and tightening the trust-boundary check beyond a string-prefix match. Update `tests/integration/auto-update-shell-allow-list.spec.ts` to assert both URL shapes are allowed and that arbitrary github.com URLs are still rejected.

### E. Test rename strategy (planner's call)

- **D-07 (planner discretion):** Five test files reference the literal `'windows-fallback'`:
  - `tests/main/auto-update-dismissal.spec.ts`
  - `tests/main/ipc.spec.ts`
  - `tests/renderer/update-dialog.spec.tsx`
  - `tests/renderer/app-update-subscriptions.spec.tsx`
  - `tests/integration/auto-update-shell-allow-list.spec.ts`

  Planner picks: mass `sed`-style rename vs hand-edit per assertion vs add new manual-download tests + leave one regression-gate that asserts the old literal no longer exists anywhere in `src/`. Constraint: the final test suite must still cover variant routing + allow-list + dismissal-asymmetric-rule under the renamed variant. No requirement to keep transitional `'windows-fallback'` tests passing.

### F. Folded Todos

None — `gsd-sdk query todo.match-phase 16` returned an empty match set. No pending todos in `.planning/todos/pending/` cross-reference Phase 16's surface.

### G. Claude's Discretion (planner-level)

- Exact arrangement of the `IN_PROCESS_AUTO_UPDATE_OK` gate + variant routing call-site (mechanical consequence of D-01 / D-02).
- Allow-list pattern shape for the new versioned-tag URL (regex vs URL-parse + structural check vs prefix-startsWith) — D-04 leans toward URL-parse; planner picks final.
- Test rename strategy (D-07).
- Whether `fullReleaseUrl` keeps its name on the payload or gets renamed to clarify it's now per-release-templated (e.g. `releaseTagUrl`). Mechanical type-rename — no behavior change either way.
- Whether the `GITHUB_RELEASES_INDEX_URL` constant at `src/main/auto-update.ts:84-85` stays (used as a base for templating) or is replaced by a small `releaseTagUrl(version): string` helper — planner picks.
- Phase 16's SUMMARY-level release-notes blurb wording for the v1.1.x → v1.2 migration warning (`<specifics>` below has the substantive content; planner / future ship-phase polishes).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 16 contract (this phase)

- `.planning/REQUIREMENTS.md` — UPDFIX-05 (the single REQ this phase closes; explicit on rename + propagation sites + allow-list reuse).
- `.planning/ROADMAP.md` §"Phase 16: macOS auto-update — switch to manual-download UX" — Goal + Background + User decision (2026-04-29 manual-download path NOT Apple Developer Program) + Scope + Severity (medium).
- `.planning/PROJECT.md` §"Current Milestone: v1.2 expansion" — Phase 16 framing inside the 8-phase v1.2 scope.
- `.planning/STATE.md` §"Current milestone" — v1.2 phase ordering (16 → 17 → 18 → 19 → 20 → 21 → 22; recommended execution order).

### Phase 14 lineage (preserved patterns Phase 16 must not regress)

- `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-CONTEXT.md` — D-02 (lifted `update:*` subscriptions in App.tsx, not AppShell), D-03 (sticky `pendingUpdateInfo` slot + `update:request-pending` IPC for late-mounting renderers), D-05 (asymmetric dismissal: manual ALWAYS re-presents; startup respects `dismissedUpdateVersion`), D-07 (`manual-download`-equivalent variant follows identical asymmetric rule), D-13 (keep `SPIKE_PASSED=false` on win32). Phase 16's gate flip widens D-13's scope to macOS+Windows symmetrically — does NOT contradict.

### Phase 12 lineage (locked decisions Phase 16 preserves)

- `.planning/milestones/v1.1-phases/12-auto-update-tester-install-docs/12-CONTEXT.md` — D-04 (Windows-fallback variant routing pattern; renamed under Phase 16 D-05 but the *pattern* is unchanged), D-05 (hand-rolled ARIA UpdateDialog scaffold; UpdateDialog.tsx body untouched), D-06 (silent-swallow on startup; DevTools console output OK; no telemetry), D-07 (manual check always shows feedback), D-08 (`dismissedUpdateVersion` strict-`>` suppression on subsequent **startup** checks; Phase 14 D-05 widens to manual asymmetry), D-09 (release-notes Summary extraction + plain-text `<pre>` rendering), D-18 (`SHELL_OPEN_EXTERNAL_ALLOWED` Releases-index URL pattern; Phase 16 D-04 extends to also accept `/releases/tag/v{version}`).
- `.planning/milestones/v1.1-phases/12-auto-update-tester-install-docs/12-RESEARCH.md` — electron-updater 6.8.3 anti-patterns + the `getMainWindow().webContents.send` pattern lineage.

### Project-wide locks

- `CLAUDE.md` §"Release tag conventions" — `v1.2.0-rc.1` ✅ vs `v1.2.0-rc1` ❌; relevant if Phase 16's eventual ship-round publishes a `v1.2.0` tag (final tags don't have rc suffix; channel-matching is moot for final → final).

### Phase 16 surface files (greenfield + edits)

- `src/main/auto-update.ts:84-85` — `GITHUB_RELEASES_INDEX_URL` constant. Phase 16 either keeps as a base-URL constant + adds a `releaseTagUrl(version)` helper, OR replaces with the helper outright (D-Discretion).
- `src/main/auto-update.ts:104` — `SPIKE_PASSED = process.platform !== 'win32'`. Phase 16 renames to `IN_PROCESS_AUTO_UPDATE_OK = process.platform === 'linux'` (D-01).
- `src/main/auto-update.ts:53` — `UpdateAvailablePayload.variant` type literal. Phase 16 renames `'windows-fallback'` → `'manual-download'` (D-05).
- `src/main/auto-update.ts:445-490` — `deliverUpdateAvailable`. Phase 16 simplifies the variant routing call-site (D-01 follow-through) AND switches `fullReleaseUrl` to per-release templated (D-04).
- `src/main/ipc.ts` §`SHELL_OPEN_EXTERNAL_ALLOWED` — allow-list. Phase 16 widens to also allow `/releases/tag/v{semver}` URLs (D-04).
- `src/preload/index.ts` — `UpdateAvailablePayload.variant` bridge type. Phase 16 renames literal (D-05).
- `src/shared/types.ts` — variant type definition. Phase 16 renames literal (D-05).
- `src/renderer/src/App.tsx` — variant prop forwarding (post-Phase-14 D-02 lift). Phase 16 renames literal references (D-05).
- `src/renderer/src/modals/UpdateDialog.tsx:1-291` — modal scaffold. Phase 16 renames `UpdateDialogVariant` type + 5 conditional branches that match `variant === 'windows-fallback'` / `variant !== 'windows-fallback'` (D-05). No body / state-machine / button-shape changes.
- `INSTALL.md:137-141` — `## After installation: auto-update` section. Phase 16 rewrites to D-03's target shape.
- `src/renderer/src/modals/HelpDialog.tsx` — confirmed-no-op surface (D-06). Planner re-verifies; no edit expected.

### Test files (rename surface)

- `tests/main/auto-update-dismissal.spec.ts` — variant literal references in dismissal-asymmetric-rule assertions.
- `tests/main/ipc.spec.ts` — variant literal references in IPC payload assertions.
- `tests/renderer/update-dialog.spec.tsx` — variant literal references in dialog rendering tests.
- `tests/renderer/app-update-subscriptions.spec.tsx` — variant literal references in subscription wiring tests.
- `tests/integration/auto-update-shell-allow-list.spec.ts` — variant literal + allow-list URL assertions; Phase 16 extends to assert versioned-tag URLs are also allowed (D-04).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`windows-fallback` variant pattern** (Phase 12 D-04 + UpdateDialog.tsx:210-227) — fully built, hand-rolled ARIA modal with Open Release Page + Later buttons. Phase 16 reuses verbatim under the renamed literal `'manual-download'`. No new UI primitive, no new state machine, no new ARIA wiring.
- **`SHELL_OPEN_EXTERNAL_ALLOWED` allow-list** (Phase 12 D-18, `src/main/ipc.ts`) — IPC trust-boundary guard that gates `shell.openExternal` calls to a fixed allow-list. Phase 16 extends one entry from a literal-string match to a structural URL match (D-04).
- **Phase 14 D-03 sticky-slot + `update:request-pending` IPC** (`src/main/auto-update.ts:110-116`, ipc.ts handler) — handles late-mounting renderers. Variant rename doesn't affect this — variant is just a string literal on the buffered `UpdateAvailablePayload`. No state-machine change.
- **Phase 14 D-05 asymmetric dismissal rule** (`src/main/auto-update.ts:445-465`) — manual checks ALWAYS re-present even with `dismissedUpdateVersion >= info.version`. Phase 16's manual-download variant follows this rule unchanged (Phase 14 D-07 explicitly extended D-05 to the renamed-then variant).
- **`compareSemver()` + `extractSummary()` helpers** at `src/main/auto-update.ts:262-338` — Phase 16 reuses both unchanged.
- **`getMainWindow()` + `sendToWindow(channel, payload)` pattern** at `src/main/auto-update.ts:395-404` — Phase 16 reuses unchanged.
- **`useFocusTrap` hook** + 5-modal ARIA scaffold (`role="dialog"` + `aria-modal="true"` + `aria-labelledby`) — Phase 16 doesn't touch.

### Established Patterns

- **Main is the variant source of truth.** Phase 12 D-04 forbids the renderer from deriving `variant` from `process.platform` (the platform global is unavailable to the sandboxed renderer anyway). Phase 16 keeps this — `IN_PROCESS_AUTO_UPDATE_OK` lives in main, not preload or renderer.
- **IPC channel naming `update:<verb-or-noun>`** — existing channels (`update:check-now`, `update:download`, `update:dismiss`, `update:quit-and-install`, `update:available`, `update:downloaded`, `update:none`, `update:error`, `update:request-pending`). Phase 16 adds none.
- **Trust-boundary URL guards.** `SHELL_OPEN_EXTERNAL_ALLOWED` is the trust-boundary check between renderer click → main → `shell.openExternal`. Phase 16 keeps the guard at the same site; only the matched URL pattern widens.
- **No native dialogs (D-05 contract).** `window.alert()` / `dialog.showMessageBoxSync` forbidden; everything routes through the hand-rolled modal. Phase 16 keeps this — manual-download is a dialog state, not a native popup.
- **DevTools console-only logging** (Phase 12 D-06) — `console.info('[auto-update] ...')` structured logs, no telemetry. Phase 16 keeps this; no new logs required beyond what the existing `deliverUpdateAvailable` site already emits (variant + version + trigger context).
- **Tailwind v4 literal-class discipline** in UpdateDialog.tsx — every `className` is a literal or a clsx with literal branches. Phase 16 doesn't touch the dialog body, so this stays uniform.
- **Layer 3 invariant** (`tests/arch.spec.ts`) — UpdateDialog.tsx imports only React + the local `useFocusTrap` hook; never reaches into `src/core/*` or `src/main/*`. Phase 16 doesn't change imports — invariant preserved.

### Integration Points

- **Main ↔ renderer IPC seam.** `update:available` event payload carries `variant: 'auto-update' | 'manual-download'` (post-rename). Renderer reads, forwards to `<UpdateDialog>` as a prop. No new contextBridge surface; type literal change is propagated through `src/preload/index.ts` + `src/shared/types.ts`.
- **`shell.openExternal` allow-list at IPC entry.** All renderer-driven external-URL clicks pass through this site. Phase 16 changes one entry's matcher; the entry-point shape stays.
- **Variant routing in `deliverUpdateAvailable`.** The single decision site for which variant to send. Phase 16 simplifies the conditional and switches `fullReleaseUrl` to a per-release template.
- **AppState branch coverage.** App.tsx's six AppState branches all render `<UpdateDialog>` as a sibling of `<DropZone>` post-Phase-14 D-02 lift. Phase 16 doesn't change the render tree — just the variant string literal flowing through it.

</code_context>

<specifics>
## Specific Ideas

### v1.1.x → v1.2 macOS migration awareness (release-notes / SUMMARY material — NOT a code or INSTALL.md change in this phase)

Existing macOS testers running v1.1.0 / v1.1.1 / v1.1.3 are on the OLD build with `SPIKE_PASSED = process.platform !== 'win32'` (returns `true` on macOS) and Squirrel.Mac active. When their app's startup auto-check or manual `Help → Check for Updates` discovers v1.2.0, their installed app code routes through the in-process auto-update path (Squirrel.Mac downloads the `.zip`, attempts the swap, hits the same code-signature mismatch that caused D-15-LIVE-2). They will see the existing failure mode one last time on the v1.1.x → v1.2 jump.

Phase 16's gate flip lives INSIDE v1.2's main bundle — it cannot reach a v1.1.x installed binary retroactively. Existing macOS testers must download v1.2 manually once; from v1.2 onward, future updates use the new manual-download flow.

**Action:** Planner / ship-phase author should fold a one-paragraph release-notes blurb into the `v1.2.0` GitHub Release body (NOT into INSTALL.md per D-03 minimal-rewrite scope) when the eventual ship round happens. Suggested text:

> **macOS users on v1.1.x — one-time manual download required.** Your installed v1.1.x app will try the old auto-update flow and fail with a code-signature error (this is the bug Phase 16 fixes). Download `Spine.Texture.Manager-1.2.0-arm64.dmg` from the assets below and install it manually. From v1.2.0 onward, every macOS update shows a "non-blocking notice" dialog with an "Open Release Page" button — download the new `.dmg` from the link, run it, complete the standard Gatekeeper bypass, done.

Out of scope for the Phase 16 PR itself. Tracked here so it doesn't get lost.

### Phase 14 invariant Phase 16 must preserve

Phase 14 D-03 / D-05 / D-07 together specify: manual checks always re-present even when `dismissedUpdateVersion >= info.version`; sticky `pendingUpdateInfo` slot returns the latest payload to late-mounting renderers; the rule applies to the `'windows-fallback'`-then variant identically to the `'auto-update'` variant. Phase 16's variant rename `'windows-fallback'` → `'manual-download'` is a pure-string-literal change that flows through these decisions unchanged. The dismissal asymmetric rule, the sticky-slot semantics, and the cross-variant uniformity all carry over verbatim under the new name.

### What's NOT being added

- No new IPC channels.
- No new modal states.
- No new preload bridge methods.
- No new React state slots.
- No new Tailwind classes.
- No new ARIA primitives.
- No new vitest test files (existing 5 are renamed/extended; no greenfield test file required for D-04 — the existing `tests/integration/auto-update-shell-allow-list.spec.ts` extends to assert the versioned-tag URL pattern).

</specifics>

<deferred>
## Deferred Ideas

- **Apple Developer ID enrollment + notarization.** $99/yr declined 2026-04-29 in favor of manual-download UX. Revisit at v1.3 if testers ask or a separate use case justifies the cost + maintenance overhead. If it lands, a follow-up phase reintroduces a macOS auto-update gate (likely a `MAC_DEV_ID_OK` boolean parallel to the Windows `spikeOutcome === 'pass'` runtime override pattern; Phase 16's single-positive-gate D-01 is forward-compatible with that addition).
- **INSTALL.md macOS subsection + screenshot.** Phase 16 D-03 chose minimal sentence rewrite. Full "Why macOS shows manual-download (ad-hoc signing limitation; each upgrade re-triggers Gatekeeper)" subsection with screenshot is v1.3 polish if testers ask.
- **Versioned URL deep-link to a specific asset (not just the release page).** Could open `/releases/download/v{version}/Spine.Texture.Manager-{version}-arm64.dmg` directly — one fewer click than the release page (no "scroll to assets" step). Out of Phase 16 scope; needs platform + arch detection to pick the right asset name; risk of breakage if naming convention changes. Minor UX gain; defer.
- **Telemetry / structured event reporting (TEL-future).** Still descoped per REQUIREMENTS.md Out of Scope. Revisit at v1.3.
- **Sentry / crash reporting.** Still descoped (declined 2026-04-29 for v1.2). Revisit at v1.3.
- **Windows EV cert.** Still descoped per v1.1 scope; carried unchanged.
- **Windows auto-update spike (Phase 12 D-02 strict-spike bar).** Has never run live. Phase 16 keeps the runtime override path for Windows (D-02). Spike could run any time a Windows host is available; D-13 of Phase 14 still applies.
- **`HelpDialog.tsx` "How auto-updates work" subsection.** REQ-05 mention of "in-app Help dialog" is satisfied by the UpdateDialog rename per D-06; if planner / future polish wants a static docs subsection in HelpDialog explaining the auto-update flow, that's a v1.3 docs polish task.

### Reviewed Todos (not folded)

None — `gsd-sdk query todo.match-phase 16` returned an empty match set.

</deferred>

---

*Phase: 16-macos-auto-update-manual-download-ux*
*Context gathered: 2026-04-30*

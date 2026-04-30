# Phase 16: macOS auto-update — switch to manual-download UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 16-macos-auto-update-manual-download-ux
**Areas discussed:** Gate constant design, Runtime spikeOutcome path, INSTALL.md rewrite scope, Release URL target

---

## Gate constant design

| Option | Description | Selected |
|--------|-------------|----------|
| Single positive gate | `IN_PROCESS_AUTO_UPDATE_OK = process.platform === 'linux'`. One clear constant; reads as "this platform supports the in-process auto-update path." Linux-only true; macOS+Windows route to manual-download. | ✓ |
| Per-platform reasons | Two negative gates that document WHY each platform is gated: `MAC_NEEDS_DEV_ID` + `WIN_NEEDS_SPIKE`. Either trips manual-download. Self-documents the signing/licensing rationale. | |
| Minimal diff | Keep `SPIKE_PASSED` name, flip the value to `process.platform === 'linux'`. Smallest code change; constant name becomes misleading on macOS (no spike to fail). | |

**User's choice:** Single positive gate (Recommended).
**Notes:** User initially asked for a plain-English explanation of the underlying problem before selecting. After context (Squirrel.Mac code-signature mismatch on ad-hoc-signed builds; Apple Developer ID declined; reuse of the Phase 12 D-04 windows-fallback pattern), user picked the recommended single-positive-gate option. Variant routing simplifies as a mechanical consequence — locked as planner discretion (no separate user decision needed).

---

## Runtime `spikeOutcome` promotion path

| Option | Description | Selected |
|--------|-------------|----------|
| Keep Windows-only | `spikeOutcome === 'pass'` stays the Windows escape hatch. macOS routing is platform-only — no parallel runtime flag. | ✓ |
| Extend to macOS | Add a sibling `macSignedOk` field in `update-state.json` for future-proofing if Apple Developer ID enrollment lands. | |
| Remove the override entirely | Delete `spikeOutcome` handling. Simplifies the gate to one source of truth; loses the Windows escape hatch. | |

**User's choice:** Keep Windows-only (Recommended).
**Notes:** Reasoning: macOS structurally requires Apple Developer ID code-signing; a runtime flag flip cannot fix the Designated Requirement mismatch on ad-hoc builds. Two different problems, two separate gates. If Apple Developer ID enrollment lands at v1.3+, that's a separate code change with its own gate.

---

## INSTALL.md rewrite scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal sentence rewrite | Flip the paragraph so Linux owns the in-process auto-update sentence and macOS+Windows share the manual-download story. ~3-line change, no new screenshots. | ✓ |
| Full macOS subsection + screenshot | Dedicated "Why macOS shows manual-download" block explaining ad-hoc signing; link back to Gatekeeper bypass section; capture a screenshot of the new dialog (needs a real packaged build first). | |
| Defer all polish to v1.3 | One-line edit replacing 'macOS and Linux' with 'Linux'. No 'why' explanation, no Gatekeeper crosslink. Bare-minimum docs touch. | |

**User's choice:** Minimal sentence rewrite (Recommended).
**Notes:** Target shape locked in CONTEXT D-03. Planner may polish wording but the structure is fixed (Linux gets the in-process sentence; macOS+Windows share the manual-download paragraph). Mid-discussion: confirmed `HelpDialog.tsx` has no auto-update copy (REQ-05 mention of "in-app Help dialog" likely meant `UpdateDialog`, which IS being updated under D-05). HelpDialog is a confirmed-no-op surface (D-06).

---

## Release URL target

| Option | Description | Selected |
|--------|-------------|----------|
| Versioned tag URL | `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v${version}`. Lands directly on the new release with assets visible. Allow-list needs a prefix-pattern entry instead of a literal URL. | ✓ |
| Releases/latest alias | `/releases/latest`. GitHub auto-redirects to whatever release is currently marked Latest. Always current; one new literal allow-list entry. | |
| Keep index URL | Leave at `/releases`. Zero code/security change. User scrolls to find the latest themselves. | |

**User's choice:** Versioned tag URL (Recommended).
**Notes:** `fullReleaseUrl` becomes per-release templated in `deliverUpdateAvailable`. `SHELL_OPEN_EXTERNAL_ALLOWED` shifts from a literal-string match to a structural check (planner picks regex vs URL-parse + structural; URL-parse + structural recommended in D-04 for trust-boundary tightness).

---

## Claude's Discretion

- Variant routing call-site shape (mechanical consequence of D-01).
- Test rename strategy across 5 test files (D-07).
- Allow-list pattern shape (regex vs URL-parse + structural check vs prefix-startsWith).
- Whether `fullReleaseUrl` payload field gets renamed to clarify per-release templating, or `GITHUB_RELEASES_INDEX_URL` constant stays vs is replaced by a `releaseTagUrl(version)` helper.
- Phase 16 SUMMARY-level release-notes blurb wording for the v1.1.x → v1.2 macOS migration warning.

---

## Deferred Ideas

- Apple Developer ID enrollment + notarization (revisit at v1.3 earliest).
- INSTALL.md macOS subsection + screenshot (v1.3 polish if testers ask).
- Versioned URL deep-link to a specific asset (not just the release page) — minor UX gain, deferred.
- Telemetry / Sentry / Windows EV cert / Windows auto-update spike — all carried-forward deferrals from prior milestones.
- `HelpDialog.tsx` "How auto-updates work" subsection — v1.3 docs polish if planner / future polish wants it.

---

## Migration awareness (release-notes material, not Phase 16 code/docs scope)

Existing macOS testers on v1.1.x will hit the OLD Squirrel.Mac path one last time on the v1.1.x → v1.2 jump (Phase 16's fix can't reach them retroactively). They must download v1.2 manually once. Tracked in CONTEXT `<specifics>` for the eventual ship-phase release-notes blurb.

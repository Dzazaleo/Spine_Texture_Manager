# Phase 12: Auto-update + tester install docs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 12 — auto-update-tester-install-docs
**Areas discussed:** Win-unsigned strategy, Update UX + cadence, INSTALL.md scope, Phase 11 spillover bugs

---

## Win-unsigned strategy

### Q1: How should we handle UPD-06 (electron-updater on unsigned Windows NSIS)?

| Option | Description | Selected |
|--------|-------------|----------|
| Spike first (Recommended) | Plan-phase 12 includes a spike task: build rc1 → publish rc2 with latest.yml feed → install rc1 on Windows → observe whether electron-updater detects + downloads + applies. ~half-day investment; unlocks UPD-06 fully on Windows if it passes. | ✓ |
| Assume fallback | Skip the spike; wire the manual-update fallback up front. Avoids spike risk; trades away the chance unsigned electron-updater "just works." | |
| Both: try then fall back | Wire electron-updater on Windows with error-handling that catches signature failures and degrades to manual. Single code path, possibly more complexity. | |

**User's choice:** Spike first
**Notes:** Recommended option chosen — the spike result feeds the plan before any executor commits land.

### Q2: Where does the Windows-unsigned spike live in the workflow?

| Option | Description | Selected |
|--------|-------------|----------|
| Plan-phase research (Recommended) | gsd-phase-researcher runs the spike as part of producing 12-RESEARCH.md. Result locked in PLAN.md before any executor commits land. | ✓ |
| Executor Wave 0 | Plan-phase writes both paths drafted; executor's Wave 0 spike task selects the path. Defers the decision past plan-phase. | |
| Pre-plan, manual | User runs the spike manually before /gsd-plan-phase 12. Result feeds CONTEXT.md as a locked decision. | |

**User's choice:** Plan-phase research

### Q3: What does the Windows spike have to prove for us to ship the full auto-update path?

| Option | Description | Selected |
|--------|-------------|----------|
| Detect + download + apply (Recommended) | Strictest bar: rc1 must detect rc2, download .exe, replace + relaunch into rc2. Anything short routes to fallback. Matches UPD-04 contract. | ✓ |
| Detect + download only | Document a known issue if apply step is flaky. Lower bar. | |
| Just detect + notify | Use electron-updater only to detect; skip download/apply on Win. Loses one-click win. | |

**User's choice:** Detect + download + apply

### Q4: How does the manual-update fallback present itself on Windows?

| Option | Description | Selected |
|--------|-------------|----------|
| Non-blocking notice in app (Recommended) | In-app banner/notice with version info + button calling openExternalUrl() to release page. Dismissible, no nag loop, no modal interruption. Matches UPD-06 wording. | ✓ |
| Modal dialog (same as mac/linux) | Same modal but with "Download from GitHub" button. More uniform UX; trade-off is interrupting startup. | |
| Help menu badge only | No startup notification; tiny badge on Help menu. Least intrusive but easiest to miss. | |

**User's choice:** Non-blocking notice in app

---

## Update UX + cadence

### Q1: How does the update-available prompt appear on macOS/Linux?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal dialog (Recommended) | Hand-rolled ARIA modal cloning HelpDialog/SettingsDialog/SaveQuitDialog scaffold. Buttons: "Download + Restart" + "Later". Reuses existing pattern. | ✓ |
| Inline non-blocking banner | Dismissible banner; new UI primitive, fragments the "important decision = modal" pattern. | |
| Native system notification | Electron Notification API; OS-native toast. Low friction but unreliable when notifications muted. | |

**User's choice:** Modal dialog

### Q2: When does the startup update check run?

| Option | Description | Selected |
|--------|-------------|----------|
| Background, silent (Recommended) | Fire ~3–5 s after app.whenReady(); 10s hard timeout. Silent on no-update; silent on error (UPD-05). Modal only if update found. | ✓ |
| Visible "checking…" affordance | Tiny status indicator while in flight. More discoverable; new transient UI. | |
| On-demand only | No startup check; user must click Help → Check for Updates. Worst tester experience. | |

**User's choice:** Background, silent

### Q3: What does the "Later" button do exactly?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer this version (Recommended) | Suppresses prompt for this specific version on subsequent launches; re-prompts on the next-newer version. Strictest reading of UPD-04. | ✓ |
| Defer this session | Only suppresses for current run; arguably fails "no nagging" criterion. | |
| Defer for 24h | Time-based suppression; clock-resilience concerns. | |

**User's choice:** Defer this version

### Q4: How much release-notes content does the update modal show?

| Option | Description | Selected |
|--------|-------------|----------|
| Summary section only (Recommended) | First ## section of the release body (1–3 sentences). "View full release notes" link to GitHub Release page externally. | ✓ |
| Full release notes body | Entire body, scrollable in the modal. Bigger surface; markdown vs plain-text decision. | |
| Version label only | Just "vX.Y.Z is available" + external link. Smallest surface; weakens prompt. | |

**User's choice:** Summary section only

---

## INSTALL.md scope

### Q1: How thorough should INSTALL.md be?

| Option | Description | Selected |
|--------|-------------|----------|
| Cookbook + screenshots (Recommended) | Per-OS section, 1–2 screens each. Embedded PNG screenshots of OS dialogs at the bypass moment. ~6 screenshots; designed for non-developer testers. | ✓ |
| Terse text-only | Same structure, no screenshots. Quicker; trade-off is non-developer testers may not recognize the dialog. | |
| Long-form walkthrough | Full guide with prerequisites, troubleshooting, GIFs. Most generous; substantial authoring time. | |

**User's choice:** Cookbook + screenshots

### Q2: Where does INSTALL.md get linked from? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| release-template.md ${INSTALL_DOC_LINK} | Phase 11 placeholder, Phase 12 fills it. Mandatory — testers find INSTALL.md from release page. | ✓ |
| README.md badge/section | "Installing" section on repo README. Helps drive-by visitors. | ✓ |
| In-app Help menu link | Help menu item ("Installation Guide…") opening INSTALL.md externally via openExternalUrl(). | ✓ |
| HelpDialog has a link | Section/link inside the existing HelpDialog. Discoverable from inside the app. | ✓ |

**User's choice:** All four — release template + README + Help menu + HelpDialog

### Q3: How do we handle the Ubuntu 24.04+ libfuse2t64 caveat?

| Option | Description | Selected |
|--------|-------------|----------|
| Document inline (Recommended) | Dedicated paragraph in Linux section covering both libfuse2 (≤22.04) and libfuse2t64 (≥24.04). | ✓ |
| Just link to AppImage docs | Don't reproduce; link to upstream troubleshooting. Less maintenance; testers chase one more link. | |
| Skip — punt to release notes | Surface as Known Issues per release. Testers reading INSTALL.md without release notes hit a wall. | |

**User's choice:** Document inline

### Q4: What happens to the install-bullets currently in `.github/release-template.md`?

| Option | Description | Selected |
|--------|-------------|----------|
| Prune to link only (Recommended) | Replace inline bullets with a single line linking to INSTALL.md. One source of truth. | ✓ |
| Keep both — inline as quick reference | Keep bullets as TL;DR + INSTALL.md link below. Two copies to keep in sync. | |
| Drop release tmpl bullets entirely, keep template otherwise | Remove the dedicated `##` Install Instructions section. Redefines REL-02 satisfaction. | |

**User's choice:** Prune to link only

---

## Phase 11 spillover bugs

### Q1: Which Phase 11 spillover findings fold into Phase 12 scope? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| F1: Atlas Preview broken on Win | Medium severity, blocks tester rounds. app-image:// URL gets stray drive-letter. | ✓ |
| F2: File-picker UX (Win) | Low severity, has workaround. Three-part fix. | ✓ |
| F3: Spine 3.8 silent failure | Medium severity, silent failure mode. CLAUDE.md documents 4.2+ contract; runtime guard missing. | ✓ |
| None — separate phase | Defer all to Phase 12.1 or v1.2. Trade-off: tester rounds with v1.1.0 hit F1 unfixed. | |

**User's choice:** "you decide what's best" — Claude's call: fold all three (F1 + F2 + F3) into Phase 12.
**Notes:** Reasoning: F1 + F3 medium severity would actively undermine tester rounds Phase 12 prepares for; F2 low severity but cheap to bundle alongside F1 since both touch Windows-specific code paths. Each lands as its own small plan so the main auto-update + INSTALL.md work stays cleanly named.

### Q2: F3 (Spine version guard) — how strict is the runtime check?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard reject < 4.2 (Recommended) | Refuse to load anything with major.minor < 4.2. Typed-error envelope (D-10 pattern). Fixture test against 3.8-shaped JSON. | ✓ |
| Warn-and-continue | Detect old versions but still attempt to load + warning banner. Doesn't solve silent-failure; breaks typed-error pattern. | |
| Reject < 4.2 + offer 4.3+ flag | Hard reject < 4.2 + non-error message when 4.3+ detected. Adds scope; not requested in finding. | |

**User's choice:** Hard reject < 4.2

### Q3: How do the three Windows fixes structure in plan-phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Three small plans (Recommended) | 12-03 (F1), 12-04 (F2), 12-05 (F3). Atomic commits per fix; each plan independently revertable. Matches Phase 8.1 / 9 granularity. | ✓ |
| One bundled plan | All three in one sequenced plan. Less file overhead; harder atomic-commit hygiene. | |
| F1 + F3 own plans, F2 in INSTALL.md plan | Conflates code surgery with documentation; mixes verification concerns. | |

**User's choice:** Three small plans

### Q4: F1's findings doc recommends running vitest on `windows-2022` in CI. Add to Phase 12?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — expand test matrix (Recommended) | Modify release.yml to run test job on ubuntu + windows + macos in parallel. Catches future F1-class regressions. ~3× test minutes, bounded cost. | ✓ |
| No — not Phase 12 scope | Keep ubuntu-only. Silent regressions become possible again. | |
| Yes, but defer to v1.2 | Right answer but kept out of Phase 12. v1.1 tester rounds carry the regression risk. | |

**User's choice:** Yes — expand test matrix

---

## Claude's Discretion

Areas left to planner judgment (captured in CONTEXT.md §Claude's Discretion):
- Exact accelerator key for "Help → Check for Updates" menu item.
- Exact menu-item label wording.
- Exact "You're up to date" copy on on-demand check.
- Exact Windows manual-fallback notice copy.
- Exact `dismissedUpdateVersion` persistence file/format.
- Whether to render electron-updater's `releaseNotes` HTML as plain text (strip) or rendered markdown — current HelpDialog ban suggests plain-text strip; planner confirms.
- Whether `UpdateDialog` shows a download-progress bar.
- Exact `SHELL_OPEN_EXTERNAL_ALLOWED` design — pattern support vs Releases-index URL (specifics suggests option b).
- Exact screenshot capture process and tooling.
- Exact INSTALL.md tone and per-section length within the cookbook constraint.
- Whether F2's safeguard restoration is its own plan-internal task or rolled into the picker-properties fix.

## Deferred Ideas

Captured in CONTEXT.md §Deferred:
- Apple Developer ID code-signing + notarization (v1.2+).
- Windows EV code-signing certificate (v1.2+).
- Crash + error reporting (Phase 13).
- CI source-map upload to crash backend (Phase 13).
- Spine 4.3+ versioned loader adapters (post-v1.1).
- Delta updates / staged rollouts / multi-channel release tracks.
- Feature-usage analytics.
- Native system-toast update notifications (rejected in favor of modal).
- In-app banner pattern as a general UI primitive.
- F2 deeper output-path policy redesign.
- Download-progress UI in UpdateDialog (Claude's discretion).
- Per-release URL pattern-matching in SHELL_OPEN_EXTERNAL_ALLOWED.
- Integration-level Windows headless smoke test for Atlas Preview.

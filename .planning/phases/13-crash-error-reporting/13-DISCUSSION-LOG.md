# Phase 13: Crash + error reporting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 13-crash-error-reporting
**Areas discussed:** Backend + SDK choice (only — user explicitly chose "Ready for context (planner picks rest)" for the other 3)

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Backend + SDK choice | Sentry SaaS / GlitchTip / minidump-only / Bugsnag-Rollbar; drives source-map tooling, redaction API, vendor lock-in | ✓ |
| Consent prompt UX (TEL-06) | Modal vs banner vs splash vs OS dialog; timing relative to SDK init | (skipped) |
| Opt-out + settings storage (TEL-05/07) | Extend update-state.json vs new file vs app-settings.json refactor; SettingsDialog redesign | (skipped) |
| PII redaction floor (TEL-04) | Allow-list vs deny-list; how to handle errors with embedded user data | (skipped) |

**User's choice:** Backend + SDK choice
**Notes:** User picked the most load-bearing decision (every other gray area branches off the SDK choice). The 3 unselected areas were intentionally punted to planner discretion at the wrap step ("Ready for context (planner picks rest)"). REQUIREMENTS.md TEL-01..TEL-07 already lock the hard contracts for those 3 areas — Phase 13 planner has clear constraints to work within.

---

## Backend + SDK choice

### Q1: Provider

| Option | Description | Selected |
|--------|-------------|----------|
| Sentry SaaS (Recommended) | @sentry/electron mature; main+renderer+native in one SDK; @sentry/cli source-map upload; free Developer tier; vendor lock-in but switching to Sentry-compatible (GlitchTip) is a DSN flip | ✓ |
| GlitchTip self-hosted | Same SDK, you host Postgres + Django on Hetzner/Fly.io; avoids vendor lock-in; adds server you maintain through tester rounds | |
| Minidump-only (Electron crashReporter) | Built-in, free, no SDK install; ONLY captures native main-process crashes; FAILS TEL-01 + TEL-02 (no JS-level capture); needs a second JS-side path which is roughly Sentry-equivalent work | |
| Bugsnag / Rollbar | Mature alternatives, smaller free tiers; less Electron-specific; @bugsnag/electron exists but younger; no major advantage over Sentry | |

**User's choice:** Sentry SaaS (Recommended)
**Notes:** REQUIREMENTS.md TEL preamble already names Sentry as the recommended default. Locks D-01.

### Q2: Free tier

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — plan for free tier | ~5K errors/mo, 1 seat, 30-day retention; tester pool single-digit; v1.1 short-lived; revisit at v1.2 | ✓ |
| No — budget for paid Team tier | $26/mo; higher quotas + team seats + longer retention; overkill for v1.1 testers | |
| Skip — not blocking SDK choice | Quota is runtime concern; decide later based on actual event volume | |

**User's choice:** Yes — plan for free tier
**Notes:** Aligns with v1.1 "no paid certs" budget posture. Revisit-flagged for v1.2.

### Q3: Native crash capture

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — enable minidump capture (Recommended) | @sentry/electron wraps Electron's crashReporter; catches segfaults / V8 OOM / GPU crashes; requires debug-symbol upload (one extra CI step); worth it because worker_threads sampler + sharp libvips have real native-crash surface | ✓ |
| No — JS exceptions only | Simpler, no debug-symbol upload, smaller attack surface; loses visibility into hardest-to-reproduce crashes | |

**User's choice:** Yes — enable minidump capture (Recommended)
**Notes:** The exact reasoning in the option description (sampler + libvips native surface) is the load-bearing case for D-03.

### Q4: DSN delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Build-time env var (Recommended) | SENTRY_DSN as GHA secret; inlined into main bundle by electron-vite; matches Phase 12 GH_TOKEN pattern; treating DSN as a build-secret keeps OSS forks from spamming free-tier quota | ✓ |
| Hardcoded in source | Commit DSN literal; simplest; Sentry says DSNs are public-safe; trade-off: clones can spam quota | |
| Skip / planner picks | Mechanical; planner reads Sentry docs and picks during plan-phase | |

**User's choice:** Build-time env var (Recommended)
**Notes:** Locks D-04. Aligns with Phase 12's existing pattern for build-time secret injection.

### Q5: Source-map upload integration

| Option | Description | Selected |
|--------|-------------|----------|
| Per-platform build jobs upload their own (Recommended) | build-mac/win/linux each runs `@sentry/cli sourcemaps upload` before electron-builder; per-platform bundles differ after natives strip; release identifier = git tag; SENTRY_AUTH_TOKEN secret; +30s per build job | ✓ |
| Single upload in publish job | Aggregate source maps as workflow artifacts; one upload step in publish; simpler-feeling but reconciliation overhead and no real saving | |
| On tag-push only, never on workflow_dispatch | Skip during dry runs; avoids polluting Sentry with releases that won't have a real installer | (folded into D-06 — applies to chosen structure) |

**User's choice:** Per-platform build jobs upload their own (Recommended)
**Notes:** Locks D-05. The on-tag-only constraint folds into D-06.

### Q6: Dev vs prod

| Option | Description | Selected |
|--------|-------------|----------|
| No — production builds only (Recommended) | Gate on app.isPackaged === true; dev crashes go to terminal; canonical Electron pattern; source maps don't exist in dev anyway | ✓ |
| Always active | Sentry runs everywhere; simpler test surface; dev errors flood production project; could split into separate Sentry projects but complexity for low value | |

**User's choice:** No — production builds only (Recommended)
**Notes:** Locks D-08. Standard Electron-app posture.

---

## Wrap-up

| Option | Description | Selected |
|--------|-------------|----------|
| Explore PII redaction floor | Allow-list vs deny-list, what gets stripped from event.message, redaction-floor tests | |
| Explore consent prompt UX | Modal vs banner vs splash; timing relative to SDK init | |
| Explore opt-out persistence | update-state.json extension vs new file vs app-settings.json refactor; SettingsDialog redesign | |
| Ready for context (planner picks rest) | Capture CONTEXT.md with Backend decisions locked; planner has full discretion on the 3 unselected areas | ✓ |

**User's choice:** Ready for context (planner picks rest)
**Notes:** User trusts the planner to pick within the constraints REQUIREMENTS.md TEL-01..TEL-07 already lock down. CONTEXT.md flags the 3 unselected areas explicitly under "Claude's Discretion" with the hard contracts called out so planner can't drift past them.

---

## Claude's Discretion

The 3 unselected gray areas are pre-marked for planner discretion in CONTEXT.md `<decisions>` §Claude's Discretion:

- **TEL-04 PII redaction posture** — allow-list vs deny-list; specific scrub regex; how to handle errors with `.message` embedding user data. HARD CONTRACT (success criterion #3): zero user paths, zero project content, zero atlas bytes.
- **TEL-06 consent prompt UX** — modal vs banner vs splash; timing relative to Sentry init. CONSTRAINT: one-time, explains what is/isn't collected, Accept/Decline buttons.
- **TEL-05 opt-out persistence shape** — extend update-state.json vs new file vs app-settings.json refactor. CONSTRAINT: Edit→Preferences toggle that produces zero network requests when off.
- **TEL-07 default-state mechanism** — strict-bar default = hardcoded boolean with v1.2-revisit comment block.
- **Renderer-side error-capture mechanism** — SDK-native vs explicit `window.addEventListener('error')` shims.
- **React error boundary at AppShell-level** — planner picks whether to add this phase for TEL-02 coverage.
- **Sentry init ordering in `app.whenReady`** — strict-bar = first init call (before IPC + auto-update).
- **`release.environment` and `release` tagging** — strict-bar = `'tester'` + `${app.getName()}@${app.getVersion()}`.

## Deferred Ideas

(See CONTEXT.md `<deferred>` for full list. Highlights:)

- Public-release default-flip for TEL-07 — v1.2 future-phase code edit.
- React error-boundary as general UI primitive — future UI polish.
- Sentry Performance / Profiling / Session Replay — paid-tier features.
- Multi-environment Sentry projects — extension point if v1.2 grows release channels.
- Source-map upload during workflow_dispatch dry runs — explicit D-06 exclusion.
- Sentry breadcrumb capture — planner verifies against TEL-04 floor.
- Sentry-side privacy / retention configuration — Sentry dashboard config, not code.

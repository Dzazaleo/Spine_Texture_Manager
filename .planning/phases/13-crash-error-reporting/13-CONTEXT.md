# Phase 13: Crash + error reporting - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Capture unhandled exceptions in the Electron main process AND in the renderer
process (synchronous throws + unhandled promise rejections), plus native
main-process crashes (segfaults / V8 OOM / GPU process crashes), and ship
sanitized stack + version + OS + arch metadata to a crash-reporting backend so
that "it broke" tester reports include the stack trace, not just the
screenshot. Wire a first-launch consent prompt + an Edit→Preferences opt-out
toggle. Upload production source maps from CI so traces resolve to original
TypeScript. Enforce a hard PII redaction floor (no `/Users/<name>` substrings,
no project JSON content, no atlas image bytes) before any payload leaves the
machine.

**Out of scope:**
- Feature-usage / panel-usage telemetry (TEL-future) — explicitly excluded by
  REQUIREMENTS.md "only crash/exception capture per TEL-01..07."
- Sentry Performance / Profiling / Session Replay (paid-tier features anyway).
- Custom analytics endpoints, A/B-test instrumentation, user identifiers
  beyond what's required for triage.
- Apple Developer ID / Windows EV signing (v1.2+ candidates, locked out of v1.1).
- Public-release default-flip for TEL-07 — Phase 13 lands the opt-out toggle
  AND the v1.1 opt-out default; the v1.2 revisit checkpoint is documented
  but not implemented.
- React error-boundary as a general UI primitive (planner picks whether to add
  one this phase per TEL-02 renderer hook strategy or defer).
- electron-updater changes — Phase 12 surface stays untouched except where
  Sentry init must wrap or precede `initAutoUpdater()` in `app.whenReady`.

</domain>

<decisions>
## Implementation Decisions

### Backend + SDK choice (TEL-01..TEL-04 plumbing)

- **D-01:** **Backend = Sentry SaaS.** REQUIREMENTS.md TEL preamble lists Sentry
  as the recommended default; this phase locks it. SDK = `@sentry/electron`
  (mature, single SDK covers main + renderer + native minidumps; events from
  both processes auto-stitch into one dashboard event; built-in `beforeSend`
  hook is the redaction surface for D-09).
- **D-02:** **Free Developer tier is the v1.1 budget.** ~5K errors/month, 1
  user seat, 30-day retention. Tester pool is single-digit; v1.1 is short-lived
  (revisit at v1.2). 5K/mo is exhausted only if every tester crashes ~150 times.
  Quota is NOT a Phase 13 implementation concern; if a paid tier is needed
  later, that's a v1.2 decision and the SDK code path is identical.
- **D-03:** **Native main-process crash capture is enabled.** `@sentry/electron`
  wraps Electron's built-in `crashReporter` and uploads minidumps to Sentry's
  symbolication backend alongside JS-level events. Catches segfaults (sharp
  libvips, native modules), V8 OOM (sampler worker on pathological rigs), GPU
  process crashes. Worth the extra debug-symbol upload step in CI because the
  scariest crashes (`worker_threads` sampler, sharp libvips during Optimize
  Assets export) ARE native, and minidumps are the only way to triage them.

### DSN delivery

- **D-04:** **Sentry DSN is delivered to the packaged app via build-time env
  var (`SENTRY_DSN`).** Stored as a GitHub Actions secret. Read by
  `electron-vite` at build time and inlined into the main bundle (canonical
  pattern; matches Phase 12 `electron-builder.yml` `publish: github` reading
  `GH_TOKEN` at build time). For local dev builds: either omit the env var
  (Sentry init no-ops; gated by `app.isPackaged`) OR pull from a gitignored
  `.env`. Rationale: DSN is technically public-safe per Sentry docs (rate-
  limited per-project on Sentry's side) but treating it as a build-secret
  keeps OSS forks from spamming the project's free-tier quota with scrappy
  events.

### Source-map upload from CI (TEL-03)

- **D-05:** **Per-platform build jobs upload their own source maps.** Each of
  `build-mac` / `build-win` / `build-linux` runs `@sentry/cli sourcemaps
  upload` against its own electron-vite output BEFORE `electron-builder`
  packages. Source maps differ per platform (different bundles after
  platform-specific natives strip), so 3× upload is correct, not redundant.
  Release identifier = `${{ github.ref_name }}` (the `v*.*.*` tag — matches
  Phase 11 D-08 tag-vs-`package.json` reconciliation discipline). Auth via
  `SENTRY_AUTH_TOKEN` GitHub Actions secret, scoped to project release-files
  permission only.
- **D-06:** **Source-map upload runs only on tag-push, NOT on
  `workflow_dispatch` dry runs.** Skip step is gated by the same condition as
  the publish job (`if: github.event_name == 'push' && startsWith(github.ref,
  'refs/tags/v')`). Avoids polluting Sentry releases with dry runs that will
  never have a real installer downloaded.
- **D-07:** **Debug-symbols upload for native minidumps.** Same CI surface as
  source maps — adds a `sentry-cli debug-files upload` step in each build job
  (or whichever subcommand `@sentry/cli` exposes for native symbol uploads at
  plan-phase). Required for D-03 minidumps to symbolicate to function names
  rather than raw addresses. Planner confirms exact subcommand + which platform
  symbol files (`.dSYM` on macOS, `.pdb` on Windows, `.debug` / DWARF on Linux)
  electron-builder produces and where they land.

### Init gating

- **D-08:** **Sentry init is gated on `app.isPackaged === true`.** Dev / HMR
  / unpackaged builds do NOT initialize Sentry — dev crashes go to the terminal
  where they're readable, and source maps don't exist in dev anyway. Aligns
  with the canonical Electron pattern (`app.isPackaged` gate is already used
  elsewhere in the codebase for protocol registration / DevTools toggle).
  Renderer init mirrors the same gate via a build-time-injected boolean (since
  renderer doesn't have access to `app.isPackaged` directly).

### Claude's Discretion (planner picks)

The user explicitly chose "Ready for context (planner picks rest)" — the three
unselected gray areas below are intentional planner-discretion zones, with the
constraints that REQUIREMENTS.md TEL-01..TEL-07 already lock down. Planner
should produce specific decisions in `13-RESEARCH.md` and `13-PLAN.md`,
referencing this section.

- **TEL-04 PII redaction posture (the SECURITY FLOOR):**
  - Allow-list (drop everything except stack frames + `release` + `os.name` /
    `os.version` / `arch` + `app.app_version` — strictest) vs deny-list (scrub
    known-bad patterns: `/Users/<name>/...`, `C:\Users\<name>\...`, project
    filenames embedded in `event.message`, `.stmproj` content embedded in JSON
    parse error messages, atlas-region names from `spine-core` errors).
  - HARD CONTRACT (non-negotiable, success criterion #3): zero user file
    paths, zero Spine project JSON content, zero atlas image bytes in any
    captured event payload. Inspecting any captured event MUST show this
    holds.
  - Errors with `event.exception.values[].stacktrace.frames[].filename`
    pointing at user paths must be rewritten to relative-from-`app.getAppPath()`
    or to the bundle file basename.
  - `event.message` redaction (errors whose `.message` embeds user data —
    JSON parse errors with file content, `spine-core` errors mentioning
    attachment names) is the trickiest case; planner picks the regex set or
    decides to drop `.message` entirely and rely on stack frames + breadcrumbs
    (which Sentry SDK doesn't auto-collect file content into).
  - Implementation surface: `beforeSend` hook in main + renderer Sentry init.
    Both processes need the same redaction logic — extract to a shared
    function in `src/main/sentry-redact.ts` (or equivalent) and call from both
    init sites. Layer 3 invariant: redaction logic is pure, can live in
    `src/core/` if that simplifies sharing across main/renderer (but the
    Sentry SDK call sites stay outside `core/`).
  - Verification surface: planner adds vitest tests that synthesize an event
    object containing each banned pattern and asserts `beforeSend` strips it.
    Test runs on the 3-OS matrix (Phase 12 D-22) so Windows path patterns
    (`C:\Users\...`, `\\?\C:\...`) and macOS / Linux patterns are all
    exercised.

- **TEL-06 consent prompt UX:**
  - Hand-rolled ARIA modal cloning HelpDialog scaffold (blocks first-window
    interaction; matches the 6 existing dialogs) vs in-window banner
    (non-blocking, dismissible) vs splash overlay vs `dialog.showMessageBox`
    (OS-native).
  - Modal aligns with the project's "five dialogs, one pattern" hand-rolled
    ARIA precedent (Phase 9, Phase 12). Banner introduces a new UI primitive
    that doesn't exist today (Phase 12 D-03 Windows-fallback notice was the
    closest, deferred). OS dialog escapes the focus-trap discipline of the
    other modals.
  - Timing: prompt BEFORE Sentry init runs (capture nothing until consent
    decides) is strictest privacy posture; arming the SDK first and queueing
    events until consent decides is operationally simpler. Strict-bar default
    is "no events captured before consent decides" — matches the spirit of
    TEL-06 even though the wording allows either.
  - Constraint (TEL-06 wording): one-time prompt, explains what is and isn't
    collected, Accept / Decline buttons, Decline sets the disabled state from
    TEL-05. Prompt does NOT re-fire on subsequent launches regardless of
    Accept / Decline.

- **TEL-05 opt-out persistence shape:**
  - Three options:
    1. Extend `src/main/update-state.ts` to carry `crashReportingEnabled:
       boolean` + `consentPromptShown: boolean` (simple — one multi-purpose
       JSON file in `app.getPath('userData')`).
    2. New dedicated `src/main/crash-state.ts` mirroring `update-state.ts`
       structure (separation of concerns; doubles the boilerplate).
    3. Introduce a generalized `app-settings.json` + `src/main/app-settings.ts`
       (refactor cost; consolidates future per-user state — e.g., a future
       v1.2 settings panel for theme, telemetry granularity, etc.). Migrate
       `update-state.json`'s fields into this file (or keep update-state
       separate for state-machine reasons; update-state is auto-update flow
       state, not user preference).
  - Constraint: must be an Edit→Preferences toggle that, when toggled OFF,
    causes the Sentry SDK to make ZERO network requests on subsequent
    crashes (TEL-05 wording — "verified by network-trace inspection or backend
    silence"). Implementation = `Sentry.close()` on toggle-off, `Sentry.init()`
    again on toggle-on, OR set `enabled: false` and confirm the SDK respects
    it (planner verifies behavior matches the contract).
  - Constraint: SettingsDialog today exposes only `samplingHz` (per-project,
    persists in `.stmproj`). Adding a per-user crash-reporting toggle means
    the SettingsDialog gains a section structure. Planner picks layout (single
    panel with two sub-sections, vs tabs, vs inline list).

- **TEL-07 default-state mechanism:**
  - v1.1 ships opt-OUT (enabled by default for testers). Public v1.2 must
    revisit before flipping to opt-IN.
  - Mechanics options:
    1. Hardcoded boolean (`const DEFAULT_CRASH_REPORTING_ENABLED = true`) — a
       code edit at v1.2.
    2. Build-time env var (`CRASH_REPORTING_DEFAULT_ENABLED`) — flippable at
       CI without a code change; risk of accidental flip during dry runs.
    3. Compile-time constant tied to `package.json` `version` (e.g., enabled
       if version contains `-rc` or `-tester` suffix; disabled otherwise) —
       too clever, easy to misread.
  - Strict-bar default = (1) hardcoded boolean. Planner adds a comment block
    at the constant marking the v1.2 revisit checkpoint with a cross-reference
    to REQUIREMENTS.md TEL-07. Phase 13 verifier asserts the constant matches
    the documented v1.1 posture.

- **Renderer-side error-capture mechanism:**
  - `@sentry/electron`'s renderer integration auto-wires `window.onerror` +
    `window.onunhandledrejection` (canonical). Planner verifies the SDK's
    auto-wiring covers TEL-02's "unhandled exceptions AND unhandled promise
    rejections" wording AND that Sentry's React integration (if used) doesn't
    double-handle exceptions caught by a React error boundary.
  - React error boundary at AppShell-level — Sentry's React docs recommend
    one. Planner picks whether to add one this phase (mounted in
    [src/renderer/src/components/AppShell.tsx](src/renderer/src/components/AppShell.tsx)
    as a wrapper around the modal-mount / panel-render tree) or defer to a
    UI-polish phase. Adding one this phase lets TEL-02 capture render-tree
    errors (currently they crash the React tree silently in dev — packaged
    behavior unverified).

- **Sentry init ordering in `app.whenReady`:**
  - Sentry init MUST run BEFORE any IPC handler registration (so handler-throw
    is captured) AND BEFORE `initAutoUpdater()` (so update-flow errors are
    captured). Planner places the init call as the first line of the
    `whenReady` body, before `registerIpcHandlers()` and `initAutoUpdater()`.

- **`release.environment` and `release` tagging:**
  - `release` = `${app.getName()}@${app.getVersion()}` per Sentry convention
    (e.g., `spine-texture-manager@1.1.0-rc1`). Matches the source-map upload
    release identifier (D-05).
  - `environment` = `'tester'` for v1.1 builds (or `'production'` if planner
    picks generic). Reflects the v1.1 posture.

- **Other Claude's Discretion items:**
  - Exact `@sentry/cli` command for source-map upload (`sentry-cli sourcemaps
    upload` vs `sentry-cli releases files <release> upload-sourcemaps`; Sentry
    docs recommend the former).
  - Whether to use `getsentry/action-release@v3` GitHub Action as a wrapper or
    invoke `@sentry/cli` directly.
  - Whether to add `Sentry.captureException(error)` at typed-error catch sites
    that currently log to console only (vs relying on the global handler) —
    planner audits the existing typed-error catch sites in `src/main/ipc.ts` /
    `src/main/project-io.ts` / `src/main/sampler-worker.ts` and picks.
  - Exact Help → "Crash reporting" / Privacy menu copy + HelpDialog section
    content describing what's collected.
  - Whether the consent-prompt and opt-out toggle force an `Sentry.close()` /
    `Sentry.init()` cycle on flip, OR rely on the SDK's `enabled: false` flag
    (planner verifies network-silence behavior).
  - Whether to set `Sentry.setTag('platform', process.platform)` and
    `setTag('arch', process.arch)` explicitly or rely on the SDK's auto-context.
  - Sample-rate (1.0 = capture every error vs <1.0 sampling) — strictest is
    1.0 for v1.1 tester rounds (low volume, high triage value).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 13 contract
- `.planning/REQUIREMENTS.md` — TEL-01..TEL-07 (Phase 13 scope). DIST-future
  / TEL-future explicitly NOT in scope. Note that REQUIREMENTS.md "TEL"
  preamble names Sentry as recommended default — D-01 locks it.
- `.planning/ROADMAP.md` §"Phase 13" — Goal statement, Success Criteria 1–5,
  Depends on Phase 11 (CI release build must upload production source maps;
  Phase 13 wires this).
- `.planning/PROJECT.md` §"Current Milestone: v1.1 Distribution" — milestone
  goal, "no paid certs in v1.1" lock (mirrors free-tier crash-backend posture
  in D-02), tech stack invariants.
- `CLAUDE.md` — non-obvious facts. Layer 3 invariant (`core/` is pure TS, no
  Electron / DOM / `node:fs`) constrains where Sentry SDK calls can live.

### Phase 12 deliverables (Phase 13 input contract)
- `.planning/phases/12-auto-update-tester-install-docs/12-CONTEXT.md` — D-08
  atomic-write pattern (opt-out persistence reuses), D-22 3-OS test matrix
  (Phase 13 redaction tests run on this matrix), modal scaffold lineage (D-05
  six-dialogs-one-pattern, consent-prompt-as-modal option clones this), D-04
  per-platform branching pattern (relevant to platform-specific debug-symbol
  upload).
- `.planning/phases/12-auto-update-tester-install-docs/12-RESEARCH.md` — IF
  it exists, electron-updater integration patterns and the app-boot ordering
  established in `app.whenReady`. Planner reads to ensure Sentry init lands
  BEFORE `initAutoUpdater()`.
- `.planning/phases/11-ci-release-pipeline-github-actions-draft-release/11-CONTEXT.md` —
  D-21 forecasted `SENTRY_AUTH_TOKEN` as Phase 13 work; Phase 13 fills it.
  Workflow architecture (D-01..D-05), atomic-publish discipline (CI-05),
  SHA-pinning posture all preserved by Phase 13's CI additions.
- `.planning/phases/11-ci-release-pipeline-github-actions-draft-release/11-RESEARCH.md` —
  Patterns Phase 11 used (SHA-pinned actions, `if-no-files-found: error`)
  that Phase 13's workflow modifications must preserve.

### Phase 13 surface files (greenfield + edits)

**App-side (greenfield):**
- `src/main/sentry.ts` (or equivalent — planner picks name) — main-process
  Sentry init + `beforeSend` redaction hook + minidump uploader config.
  Imports `@sentry/electron`. Layer-3 OK (lives in `src/main`, not `core/`).
- `src/renderer/src/lib/sentry.ts` — renderer-side init. Mirrors main's
  redaction hook via shared module.
- `src/main/sentry-redact.ts` (or `src/core/sentry-redact.ts`) — pure-TS
  redaction function shared between main + renderer `beforeSend` hooks.
  Planner picks `core/` if the function is pure-TS-isolatable (preferred —
  unit-testable headless via vitest).
- `src/main/crash-state.ts` (OR extension of `src/main/update-state.ts`) —
  consent-prompt-shown + crash-reporting-enabled persistence. Atomic JSON
  write pattern from Phase 12 D-08.
- Consent prompt component — TBD modal vs banner (Claude's Discretion).
  - If modal: `src/renderer/src/modals/CrashConsentDialog.tsx`, clones
    `HelpDialog.tsx` scaffold.
  - If banner: new UI primitive in `src/renderer/src/components/`.

**App-side (edits):**
- [src/main/index.ts](src/main/index.ts) — `app.whenReady` body adds
  `initSentry()` as the FIRST init call (before `registerIpcHandlers()` and
  `initAutoUpdater()` per planner-discretion ordering).
- [src/renderer/src/main.tsx](src/renderer/src/main.tsx) — renderer entry
  point; Sentry init lands here before `ReactDOM.createRoot` (or whatever
  React 19 mount surface is used).
- [src/renderer/src/components/AppShell.tsx](src/renderer/src/components/AppShell.tsx) —
  consent-prompt mount point; opt-out-toggle wiring (subscribes to
  `setting:crash-reporting-changed` IPC if needed).
- [src/renderer/src/modals/SettingsDialog.tsx](src/renderer/src/modals/SettingsDialog.tsx) —
  add per-user crash-reporting toggle + section structure for two settings
  (samplingHz + crash-reporting). UI redesign needed (currently
  single-setting).
- [src/renderer/src/modals/HelpDialog.tsx](src/renderer/src/modals/HelpDialog.tsx) —
  add a "Crash reporting / Privacy" section explaining what is and isn't
  collected (mirrors Phase 12 D-16.4 pattern of adding sections without
  regressing the wording-stability tests gated by `tests/renderer/help-dialog.spec.tsx`).
- [src/main/ipc.ts](src/main/ipc.ts) — new IPC channels for the consent /
  opt-out flow (`setting:get-crash-reporting`, `setting:set-crash-reporting`,
  `setting:get-consent-prompt-shown`). Trust-boundary discipline preserved.
- [src/preload/index.ts](src/preload/index.ts) — preload bridge surface
  extension for the new IPC channels.

**CI surface:**
- [.github/workflows/release.yml](.github/workflows/release.yml) — each of
  `build-mac` / `build-win` / `build-linux` adds a `sentry-cli sourcemaps
  upload` step (D-05) BEFORE electron-builder packages. Each build job also
  uploads platform-specific debug symbols for minidump symbolication (D-07).
  New secrets: `SENTRY_DSN` (build-time, read by electron-vite) +
  `SENTRY_AUTH_TOKEN` (CI-only, scoped to release-files). The `publish` job
  is unchanged — atomic-publish discipline preserved (CI-05).
- New env var injection in `electron-vite.config.ts` (or wherever the main +
  renderer bundles are configured) so `process.env.SENTRY_DSN` is inlined
  into the build at compile time.

### App-internal pattern lineage
- [src/main/update-state.ts](src/main/update-state.ts) — atomic JSON state
  pattern (D-08 from Phase 12); consent + opt-out persistence reuses this.
- [src/main/recent.ts](src/main/recent.ts) — original atomic-write idiom
  (`<path>.tmp` + `fs.rename`); pattern lineage for D-08 → Phase 13.
- [src/core/errors.ts](src/core/errors.ts) — typed-error envelope (8 kinds);
  catch sites that currently re-throw or log can also call
  `Sentry.captureException(err)` if planner picks the augmented-catch path.
- [src/main/auto-update.ts](src/main/auto-update.ts) — boot-time init pattern
  (`initAutoUpdater()`); Sentry init follows the same idiom (function called
  from `app.whenReady`).
- [src/renderer/src/modals/UpdateDialog.tsx](src/renderer/src/modals/UpdateDialog.tsx) —
  newest hand-rolled ARIA modal; consent-prompt-as-modal clones this if
  planner picks the modal path.
- `tests/main/update-state.spec.ts` — vitest pattern for app.getPath('userData')
  state stores (mock `app` + filesystem); Phase 13 redaction tests follow
  the same shape.

### External
- Sentry Electron SDK docs: https://docs.sentry.io/platforms/javascript/guides/electron/
  — SDK init for main + renderer, native-crash configuration, performance
  considerations.
- Sentry Electron source-map upload: https://docs.sentry.io/platforms/javascript/guides/electron/sourcemaps/
  — `@sentry/cli sourcemaps upload` invocation, release identifier
  conventions.
- Sentry beforeSend hook: https://docs.sentry.io/platforms/javascript/guides/electron/configuration/filtering/
  — D-09 redaction surface API.
- Sentry React integration: https://docs.sentry.io/platforms/javascript/guides/electron/features/react/
  — error-boundary recommendation; planner picks whether to add one.
- `@sentry/cli`: https://docs.sentry.io/cli/ — CLI subcommands for source
  maps + debug files upload.
- `getsentry/action-release` GitHub Action: https://github.com/getsentry/action-release
  — wrapper around `@sentry/cli`; SHA-pinning option.
- Electron crashReporter: https://www.electronjs.org/docs/latest/api/crash-reporter
  — native minidump base; `@sentry/electron` wraps this.
- Sentry Developer plan limits: https://sentry.io/pricing/ — D-02 free-tier
  budget reference.
- Electron app.isPackaged: https://www.electronjs.org/docs/latest/api/app#appispackaged-readonly
  — D-08 init gate.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Hand-rolled ARIA modal scaffold** (6 dialogs in `src/renderer/src/modals/`)
  — consent-prompt clones this if modal path is picked. Pattern: `role="dialog"`
  + `aria-modal="true"` + `useFocusTrap` + outer-overlay onClick = onClose +
  inner-content stops propagation. Phase 8.2 D-184 auto-suppresses File-menu
  accelerators while modal is open.
- **`update-state.ts` atomic JSON pattern** — `app.getPath('userData')` +
  `<path>.tmp` + `fs.rename`. Phase 13's consent + opt-out persistence reuses
  this whether the planner picks (1) extension of update-state, (2) new file,
  or (3) generalized app-settings.json. Pattern lineage: `recent.ts` (Phase 8)
  → `update-state.ts` (Phase 12) → Phase 13.
- **Build-time env var injection** — Phase 12's `electron-builder.yml` `publish:
  github` already reads `GH_TOKEN` at build time; the same electron-vite
  config can inject `SENTRY_DSN` + `SENTRY_AUTH_TOKEN`. Pattern is established.
- **Trust-boundary IPC + typed-error envelope** — every IPC handler catches
  typed errors and forwards via the discriminated union in `src/core/errors.ts`.
  Planner can audit these catch sites and decide whether to also call
  `Sentry.captureException(err)` (defense-in-depth) or rely on global handlers.
- **3-OS CI test matrix** (Phase 12 D-22) — Phase 13 redaction tests run on
  ubuntu-latest + windows-2022 + macos-14 so Windows path patterns
  (`C:\Users\...`, drive-letter URLs) and macOS / Linux patterns are all
  exercised by the same redaction floor.

### Established Patterns
- **`core/` is pure TS, zero DOM/Electron deps.** Sentry SDK calls live in
  `src/main/` and `src/renderer/`. Pure-TS redaction logic CAN live in
  `src/core/` if planner picks (preferred — vitest-headless-testable). Layer-3
  arch test (`tests/arch.spec.ts`) auto-flags any `core/` import of `electron`
  or `@sentry/*`.
- **`app.isPackaged` init gate** — already used in `src/main/index.ts` for
  protocol registration / DevTools toggling. Sentry init reuses (D-08).
- **Atomic JSON state in `app.getPath('userData')`** — Phase 12 lineage; opt-
  out persistence follows.
- **No markdown rendering in modals** (HelpDialog "zero markdown footprint,
  zero XSS surface"). Consent-prompt copy is plain-text only if modal path is
  picked.
- **App's URL allow-list at the trust boundary** — Phase 13 doesn't add new
  external links by default. If consent-prompt copy or HelpDialog "Crash
  reporting" section links to a Sentry privacy doc, the URL goes through
  `SHELL_OPEN_EXTERNAL_ALLOWED` (Phase 12 D-18 pattern).
- **No existing crash-reporting hooks** — `grep uncaughtException|unhandledRejection`
  returns zero matches. Phase 13 is greenfield error capture; nothing to
  conflict with or unwind.

### Integration Points
- **`app.whenReady` boot sequence** in [src/main/index.ts](src/main/index.ts)
  — Sentry init lands as the FIRST step (before IPC + auto-update + protocol
  registration's listener side; the `protocol.registerSchemesAsPrivileged`
  call MUST stay at module-load time per Phase 7 D-133, but that runs before
  whenReady so no conflict).
- **Renderer entry point** in [src/renderer/src/main.tsx](src/renderer/src/main.tsx)
  (or wherever React 19's `createRoot` mounts) — Sentry renderer init lands
  before mount.
- **Edit → Preferences menu accelerator** — already wired in Phase 9
  (CommandOrControl+, → SettingsDialog). Phase 13 does NOT change the
  accelerator or menu placement; it adds a section inside the existing
  SettingsDialog (D-09 area's planner discretion).
- **`.github/workflows/release.yml` build jobs** — each `build-*` job adds
  source-map + debug-symbol upload steps BEFORE `electron-builder` packages.
  Atomicity-by-construction (Phase 11 D-02) is preserved because the upload
  step is a job-internal step, not a publish-job step.
- **GitHub Actions secrets** — Phase 13 adds `SENTRY_DSN` and
  `SENTRY_AUTH_TOKEN`. No PAT needed; Sentry-issued tokens scope to release-
  files only.

### Greenfield surface (Phase 13 creates)
- `src/main/sentry.ts` — main-process Sentry init module.
- `src/renderer/src/lib/sentry.ts` — renderer Sentry init module.
- Shared redaction module (`src/core/sentry-redact.ts` if pure, OR
  `src/main/sentry-redact.ts` if planner picks).
- Consent-prompt component (modal or banner — Claude's Discretion).
- Consent + opt-out persistence (extension of `update-state.ts` OR new file
  OR app-settings.ts refactor — Claude's Discretion).
- New IPC channels for consent / opt-out flow.
- `SettingsDialog.tsx` redesigned for two settings sections.
- `HelpDialog.tsx` "Crash reporting / Privacy" section.
- `release.yml` per-platform source-map + debug-symbol upload steps.
- Vitest tests for the redaction floor (synthesized event objects + assertion
  that banned patterns are stripped).

</code_context>

<specifics>
## Specific Ideas

- **"When a tester says 'it broke,' we have the stack trace, app version, and
  OS — not just the screenshot."** (REQUIREMENTS.md TEL preamble) — the why
  behind the phase. Every implementation decision should be checked against
  this litmus: does the captured event let us triage from the trace, or do we
  still need the tester's screenshot?
- **Free-tier posture aligns with v1.1 "no paid certs" lock** — Phase 13's
  Sentry Developer tier (D-02) matches the project's overall posture of
  shipping testers via free / no-paid-vendor channels. Both are revisit-flagged
  for v1.2 public release.
- **Native crash capture is load-bearing because of the worker_threads sampler
  + sharp libvips** — both subsystems have real native-crash surface (V8 OOM
  during sampler on a pathological rig, libvips segfault during Optimize
  Assets export on a corrupt PNG). Without minidump capture (D-03) those
  failures show up as "the app vanished" with no actionable trace.
- **The 3-OS CI test matrix (Phase 12 D-22) is the verification surface for
  the redaction floor.** Windows path patterns (`C:\Users\<name>\...`,
  `\\?\C:\Users\<name>\...`, drive-letter URLs from Phase 12's `app-image://`
  fix) are different from `/Users/<name>/...` and `/home/<name>/...`. Planner's
  redaction tests must exercise all three platforms' path shapes.
- **Phase 11 D-21 forecasted this** — `.planning/phases/11-…/11-CONTEXT.md`
  explicitly notes "Phase 13 will add a `SENTRY_AUTH_TOKEN` or equivalent
  for source-map upload — not us." Phase 13 fills the forecast.
- **No existing crash-reporting hooks anywhere in the codebase** —
  `grep -E 'uncaughtException|unhandledRejection|window.onerror'` returns
  zero results across `src/`. Phase 13 is greenfield error capture; nothing
  to refactor, nothing to unwind. Planner picks where to put hooks (Sentry's
  auto-wiring vs explicit `process.on('uncaughtException')` calls; canonical
  is auto-wiring).
- **Default state mechanism is intentionally boring** — TEL-07's "revisit
  before public release" is a process / discipline checkpoint, not a code
  feature. Planner should prefer the simplest mechanism (D-09 strict-bar:
  hardcoded boolean with a comment block) over anything clever.
- **`.stmproj` schema does NOT change** — the opt-out toggle is per-user (in
  `app.getPath('userData')`), not per-project. Project files stay v1 with
  the existing reserved-slot for documentation (PROJECT.md key decisions
  table). Phase 13 adds a per-user setting; no schema migration required.

</specifics>

<deferred>
## Deferred Ideas

- **Custom telemetry / feature-usage analytics** — out of v1.1 entirely
  (REQUIREMENTS.md). Revisit when tester base grows + privacy posture is
  settled.
- **Public-release default-flip for TEL-07** — the v1.2 revisit is documented
  in code (D-09 strict-bar comment block) but not implemented. Phase 13
  ships the v1.1 opt-out default; the v1.2 opt-in flip is a future-phase code
  edit.
- **React error boundary as a general UI primitive** — discussed in
  Renderer-side error-capture mechanism. If planner adds one this phase for
  TEL-02 coverage, it's scoped narrowly to AppShell-level. A general primitive
  for boundary-per-panel is a future-UI-polish concern.
- **Sentry Performance / Profiling / Session Replay** — paid-tier features;
  out of scope for v1.1.
- **Multi-environment Sentry projects (separate dev / staging / prod)** — not
  needed for v1.1; D-08 `app.isPackaged` gate is sufficient. If v1.2 grows
  multiple release channels (beta vs stable), the SDK's `environment` tag is
  the extension point.
- **Sentry user identifiers / `Sentry.setUser()`** — explicitly NOT collected
  per TEL-04 PII redaction floor. Future phases that need correlated session
  context (e.g., support-ticket linking) revisit.
- **Source-map upload during `workflow_dispatch` dry runs** — D-06 explicitly
  excludes. If a future phase needs to test the upload pipeline without a
  tag-push, it adds a manual-trigger workflow input.
- **Sentry breadcrumb capture** — SDK-default breadcrumbs include UI
  interactions, console logs, navigation events. Planner picks whether to
  enable / disable / customize. Strict privacy posture is to disable
  breadcrumbs that could embed file paths or project content; SDK-default may
  or may not be safe (planner verifies against TEL-04 floor).
- **Auto-submit rate-limit / quota-protect on the client** — Sentry's free
  tier rate-limits server-side; client-side throttling is overkill for v1.1
  testers. Revisit if event volume becomes a concern.
- **Sentry-side privacy / data-retention configuration** — out of code scope;
  configured in the Sentry project settings dashboard. Document the chosen
  retention + scrubbing settings in plan-phase research, not in code.

</deferred>

---

*Phase: 13-crash-error-reporting*
*Context gathered: 2026-04-28*

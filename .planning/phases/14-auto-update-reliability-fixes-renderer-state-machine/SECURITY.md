# SECURITY.md — Phase 14 (Auto-update reliability fixes + renderer state-machine)

**Phase:** 14 — Auto-update reliability fixes / renderer state machine
**ASVS Level:** 1
**Block-on policy:** high
**Verdict:** SECURED — 25/25 threats CLOSED

This file is the verification artifact produced by gsd-security-auditor for
Phase 14. Each threat declared in the per-plan `<threat_model>` blocks has
been classified by disposition and verified against the implementation.
Implementation files were not modified.

---

## Threat verification — all 25 threats CLOSED

### Plan 14-01 — autoUpdater + IPC sticky slot

| ID | Category | Disposition | Evidence |
|----|----------|-------------|----------|
| T-14-01-01 | Tampering (renderer→main) | mitigate | `src/main/ipc.ts:748-751` — `update:request-pending` handler takes ZERO inbound payload (no `_evt, _arg`); only invokes `getPendingUpdateInfo()` |
| T-14-01-02 | Information Disclosure | accept | Public release-feed payload (version + summary + variant + fullReleaseUrl); no PII per CONTEXT.md D-Discretion-2 |
| T-14-01-03 | Spoofing (channel impersonation) | mitigate (existing) | `src/preload/index.ts:434-439` — `requestPendingUpdate` exposed via contextBridge as named bridge method; no raw `ipcRenderer` exposed |
| T-14-01-04 | Repudiation | accept | Diagnostic console-only logging (no audit-log requirement at ASVS L1) |
| T-14-01-05 | Elevation of Privilege | mitigate | `src/main/auto-update.ts:116, 311-312, 323-324, 485` — `pendingUpdateInfo` written ONLY by main's `deliverUpdateAvailable` and `clearPendingUpdateInfo`; renderer has no write path |
| T-14-01-06 | DoS | accept | Handler is O(1) — single property read per CONTEXT.md |
| T-14-01-07 | Tampering (D-12 regression) | mitigate | `src/main/ipc.ts:174` — releases-index URL `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` present verbatim in `SHELL_OPEN_EXTERNAL_ALLOWED` |

### Plan 14-02 — Preload bridge

| ID | Category | Disposition | Evidence |
|----|----------|-------------|----------|
| T-14-02-01 | Tampering | mitigate | `src/preload/index.ts:434-439` — `requestPendingUpdate: (): Promise<…> => ipcRenderer.invoke('update:request-pending')` — zero parameters; main handler ignores positional args |
| T-14-02-02 | Information Disclosure | accept | Bridge surface scope reviewed; no broader exposure introduced |
| T-14-02-03 | Spoofing | accept | Raw `ipcRenderer` is NOT exposed via contextBridge (verified at `src/preload/index.ts`) |
| T-14-02-04 | XSS via summary | accept (existing) | UpdateDialog's `extractSummary` strips HTML; renders into `<pre>` |

### Plan 14-03 — Renderer state lift to App.tsx

| ID | Category | Disposition | Evidence |
|----|----------|-------------|----------|
| T-14-03-01 | XSS via update payload | accept (existing) | UpdateDialog HTML-strip + `<pre>` render unchanged across the lift |
| T-14-03-02 | DoS via subscription leak | mitigate | `src/renderer/src/App.tsx:357-427` — lifted `useEffect` defines 5 subscribers (`unsubAvailable`, `unsubDownloaded`, `unsubNone`, `unsubError`, `unsubMenuCheck`) and returns cleanup that invokes all 5. AppShell.tsx no longer owns these subscribers (verified — only references are stale comments) |
| T-14-03-03 | Open-redirect via Open Release Page | mitigate (existing) | URL is hardcoded literal in main + UpdateDialog; `shell:open-external` re-validates against `SHELL_OPEN_EXTERNAL_ALLOWED` (`src/main/ipc.ts:655`); URL parity gated by Plan 05 spec |
| T-14-03-04 | State-confusion (late-mount race) | accept | `App.tsx:410-420` issues a same-shape `setUpdateState` write; React batching covers the race |
| T-14-03-05 | Information disclosure (DevTools) | accept (existing) | Production builds disable DevTools; logs are diagnostic-only |

### Plan 14-04 — Renderer + main specs

| ID | Category | Disposition | Evidence |
|----|----------|-------------|----------|
| T-14-04-01 | Spoofing (mock drift) | mitigate | `tests/preload/request-pending-update.spec.ts` locks bridge contract byte-for-byte; `tests/renderer/app-update-subscriptions.spec.tsx` mirrors Plan 02 bridge surface |
| T-14-04-02 | Tampering (flaky tests) | mitigate | Specs use `vi.resetModules()` + `vi.doMock()` (main) and `mockClear()` + `cleanup()` (renderer) per `beforeEach` blocks (verified in `auto-update-dismissal.spec.ts` + `app-update-subscriptions.spec.tsx`) |
| T-14-04-03 | Information Disclosure | accept | Vitest output is local-only |
| T-14-04-04 | Coverage gap (UPDFIX-02) | mitigate | `tests/main/auto-update-dismissal.spec.ts:223 (14-d)` — asserts `dismissUpdate` writes `dismissedUpdateVersion` regardless of trigger context |

### Plan 14-05 — URL-consistency integration spec

| ID | Category | Disposition | Evidence |
|----|----------|-------------|----------|
| T-14-05-01 | Tampering (false-positive) | accept | Atomic refactor enforcement is desired behavior; spec at `tests/integration/auto-update-shell-allow-list.spec.ts` |
| T-14-05-02 | Information Disclosure | accept | URL is public release page |
| T-14-05-03 | DoS (slow startup) | accept | 3 small fs reads in spec |
| T-14-05-04 | Coverage gap (env-var drift) | accept | No env-var injection introduced in Phase 14 |

### Plan 14-06 — IPC sticky-slot clear (WR-01 closure)

| ID | Category | Disposition | Evidence |
|----|----------|-------------|----------|
| T-14-06-01 | Tampering / state mutation | accept | `src/main/ipc.ts:694-695` (download path) + `src/main/ipc.ts:716-717` (dismiss path) — `clearPendingUpdateInfo()` is invoked synchronously before delegation; `auto-update.ts:323-324` defines it as `(): void` mutating one module-local slot, post-trust-boundary |

---

## Regression evidence — IPC sticky-slot clear

- `tests/main/auto-update-dismissal.spec.ts:340` `(14-l)` — IPC dismiss path empties the sticky slot (precondition `getPendingUpdateInfo() !== null`, postcondition `=== null`, plus `setDismissedVersion('1.2.3')` still runs)
- `tests/main/auto-update-dismissal.spec.ts:374` `(14-m)` — IPC download path empties the sticky slot, plus `autoUpdater.downloadUpdate` still runs

Both tests mirror the IPC handler shape introduced by Plan 06 in `src/main/ipc.ts:684-720`, anchoring gap WR-01 closure.

---

## Late-mount hydration / D-03 evidence

- `src/main/ipc.ts:748` — handler registered.
- `src/preload/index.ts:434` — bridge exposed (zero-arg).
- `src/renderer/src/App.tsx:410` — invoked once on mount via `void window.api.requestPendingUpdate().then(...)`.
- `src/shared/types.ts:942` — bridge type declared.
- Tests: `tests/renderer/app-update-subscriptions.spec.tsx (14-j)`, `(14-o)`; `tests/preload/request-pending-update.spec.ts (1)–(5b)`; `tests/main/ipc.spec.ts:354+`.

---

## Unregistered flags

None. SUMMARY.md files for plans 01–06 declared no surprise threat-flags
beyond the threats already in the per-plan registers.

---

## Accepted risks log

15 threats above carry `accept` disposition — all are documented in this
file with rationale, per ASVS L1 evidence requirements. No accept-class
threat lacks documentation.

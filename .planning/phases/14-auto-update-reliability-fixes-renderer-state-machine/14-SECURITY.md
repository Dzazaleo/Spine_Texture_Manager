---
phase: 14
slug: auto-update-reliability-fixes-renderer-state-machine
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-29
---

# Phase 14 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Verdict:** SECURED — 25 / 25 threats CLOSED.
This file is the verification artifact produced by `gsd-security-auditor`. Each threat declared in the per-plan `<threat_model>` blocks (14-01 → 14-06) was classified by disposition and verified against the implementation. Implementation files were not modified.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| renderer → preload | `window.api.requestPendingUpdate()`, `window.api.openExternalUrl()`, dismiss/download bridges — sandboxed renderer code | zero-arg invocations; no inbound payload |
| preload → main IPC | `ipcRenderer.invoke('update:request-pending')`, `update:download`, `update:dismiss(version)`, `shell:open-external(url)` | `{version, summary, variant, fullReleaseUrl}` (return); `version: string` (dismiss); URL string (open-external) |
| main → renderer IPC | `update:available`, `update:downloaded`, `update:none`, `update:error`, `menu:check-for-updates` push channels | release-feed payload — public, non-PII |
| autoUpdater event source | electron-updater 6.8.3 fires `update-available` etc. inside main; payload validated by electron-updater | release manifest |
| URL allow-list | `shell:open-external` re-validates inbound URL against `SHELL_OPEN_EXTERNAL_ALLOWED` literal set in `src/main/ipc.ts:174` | URL string (post-validation only) |

---

## Threat Register

### Plan 14-01 — autoUpdater + IPC sticky slot

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-14-01-01 | Tampering (renderer→main) | `update:request-pending` handler | mitigate | `src/main/ipc.ts:748-751` — handler takes ZERO inbound payload; only invokes `getPendingUpdateInfo()` | closed |
| T-14-01-02 | Information Disclosure | sticky-slot contents | accept | Public release-feed payload; no PII | closed |
| T-14-01-03 | Spoofing (channel impersonation) | renderer IPC surface | mitigate (existing) | `src/preload/index.ts:434-439` — exposed via contextBridge as named bridge method only; raw `ipcRenderer` not exposed | closed |
| T-14-01-04 | Repudiation | log instrumentation | accept | Diagnostic console-only logging; no audit-log requirement at ASVS L1 | closed |
| T-14-01-05 | Elevation of Privilege | tampered slot return | mitigate | `src/main/auto-update.ts:116, 311-312, 323-324, 485` — `pendingUpdateInfo` written ONLY by main's `deliverUpdateAvailable` and `clearPendingUpdateInfo`; renderer has no write path | closed |
| T-14-01-06 | DoS | flooding `update:request-pending` | accept | Handler is O(1) — single property read | closed |
| T-14-01-07 | Tampering (D-12 regression) | `SHELL_OPEN_EXTERNAL_ALLOWED` | mitigate | `src/main/ipc.ts:174` — releases-index URL `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` present verbatim | closed |

### Plan 14-02 — Preload bridge

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-14-02-01 | Tampering | renderer call site passing args | mitigate | `src/preload/index.ts:434-439` — bridge signature `requestPendingUpdate: (): Promise<…>` with zero parameters; main handler ignores positional args | closed |
| T-14-02-02 | Information Disclosure | bridge exposing more surface than needed | accept | Bridge surface scope reviewed; no broader exposure introduced | closed |
| T-14-02-03 | Spoofing | renderer invoking via raw `ipcRenderer.invoke` | accept | Raw `ipcRenderer` is NOT exposed via contextBridge | closed |
| T-14-02-04 | XSS via returned payload | UpdateDialog rendering `summary` markdown | accept (existing) | `extractSummary()` strips HTML in main; UpdateDialog renders into `<pre>` (Phase 12 D-09) | closed |

### Plan 14-03 — Renderer state lift to App.tsx

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-14-03-01 | XSS via update payload | UpdateDialog rendering `payload.summary` | accept (existing) | UpdateDialog HTML-strip + `<pre>` render unchanged across the lift | closed |
| T-14-03-02 | DoS via subscription leak | useEffect cleanup not unsubscribing | mitigate | `src/renderer/src/App.tsx:357-427` — lifted `useEffect` defines 5 subscribers (`unsubAvailable`, `unsubDownloaded`, `unsubNone`, `unsubError`, `unsubMenuCheck`) and returns cleanup that invokes all 5; AppShell.tsx no longer owns these subscribers | closed |
| T-14-03-03 | Open-redirect via Open Release Page | `onOpenReleasePage` handler | mitigate (existing) | URL hardcoded literal in main + UpdateDialog; `shell:open-external` re-validates against `SHELL_OPEN_EXTERNAL_ALLOWED` (`src/main/ipc.ts:655`); URL parity gated by Plan 05 spec | closed |
| T-14-03-04 | State-confusion (late-mount race) | `requestPendingUpdate` hydration vs in-flight `update:available` | accept | `App.tsx:410-420` issues a same-shape `setUpdateState` write; React batching collapses races | closed |
| T-14-03-05 | Information Disclosure (DevTools) | log lines visible in renderer DevTools | accept (existing) | Production builds disable DevTools; logs are diagnostic-only (Phase 12 D-06 contract) | closed |

### Plan 14-04 — Renderer + main specs

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-14-04-01 | Spoofing (mock drift) | spec mocks not matching production IPC contract | mitigate | `tests/preload/request-pending-update.spec.ts` locks bridge contract byte-for-byte; `tests/renderer/app-update-subscriptions.spec.tsx` mirrors Plan 02 bridge | closed |
| T-14-04-02 | Tampering (flaky tests) | flaky tests via shared module state | mitigate | `vi.resetModules()` + `vi.doMock()` for main specs; `mockClear()` + `cleanup()` for renderer specs in `beforeEach` blocks | closed |
| T-14-04-03 | Information Disclosure | spec output revealing implementation details | accept | Vitest output is local-only (CI logs are private to repo owner) | closed |
| T-14-04-04 | Coverage gap | UPDFIX-02 dismissal-after-manual-recheck not tested | mitigate | `tests/main/auto-update-dismissal.spec.ts:223 (14-d)` — asserts `dismissUpdate` writes `dismissedUpdateVersion` regardless of trigger context | closed |

### Plan 14-05 — URL-consistency integration spec

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-14-05-01 | Tampering (false-positive on legitimate URL rename) | URL-parity integration spec | accept | Atomic refactor enforcement is the desired contract; spec at `tests/integration/auto-update-shell-allow-list.spec.ts` | closed |
| T-14-05-02 | Information Disclosure | URL leaked in failure output | accept | URL is the public release page | closed |
| T-14-05-03 | DoS | slow vitest startup from filesystem reads | accept | Three small `fs.readFileSync` calls (each <100KB) | closed |
| T-14-05-04 | Coverage gap | runtime URL drift via env-var override | accept | No env-var injection for any URL surface in Phase 14 | closed |

### Plan 14-06 — IPC sticky-slot clear (WR-01 closure)

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-14-06-01 | Tampering / state mutation | `clearPendingUpdateInfo()` in `update:download` / `update:dismiss` | accept | `src/main/ipc.ts:694-695` (download) + `src/main/ipc.ts:716-717` (dismiss) — `clearPendingUpdateInfo()` invoked synchronously before delegation; `auto-update.ts:323-324` defines it as `(): void` mutating one module-local slot, post-trust-boundary; `(14-l)` `(14-m)` regression tests in `tests/main/auto-update-dismissal.spec.ts:340, 374` | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-14-01 | T-14-01-02 | Sticky-slot payload is public release-feed data — no PII, no secrets | gsd-security-auditor | 2026-04-29 |
| AR-14-02 | T-14-01-04 | Diagnostic console logs only; no audit-log surface required at ASVS L1 | gsd-security-auditor | 2026-04-29 |
| AR-14-03 | T-14-01-06 | O(1) handler — no DoS vector worth mitigating | gsd-security-auditor | 2026-04-29 |
| AR-14-04 | T-14-02-02 | Bridge surface scope unchanged; no broader exposure introduced | gsd-security-auditor | 2026-04-29 |
| AR-14-05 | T-14-02-03 | Raw `ipcRenderer` not exposed via contextBridge — sandbox escape required to spoof | gsd-security-auditor | 2026-04-29 |
| AR-14-06 | T-14-02-04 | XSS protection from existing Phase 12 contract (HTML-strip + `<pre>` render) | gsd-security-auditor | 2026-04-29 |
| AR-14-07 | T-14-03-01 | XSS protections preserved unchanged across the App.tsx lift | gsd-security-auditor | 2026-04-29 |
| AR-14-08 | T-14-03-04 | Same-shape `setUpdateState` writes collapsed by React batching — no data corruption | gsd-security-auditor | 2026-04-29 |
| AR-14-09 | T-14-03-05 | DevTools disabled in production builds; logs diagnostic-only (Phase 12 D-06) | gsd-security-auditor | 2026-04-29 |
| AR-14-10 | T-14-04-03 | Vitest output is local-only; not published | gsd-security-auditor | 2026-04-29 |
| AR-14-11 | T-14-05-01 | Spec false-positives on URL renames are intended — forces atomic refactor | gsd-security-auditor | 2026-04-29 |
| AR-14-12 | T-14-05-02 | URL is public release page; failure-output disclosure is harmless | gsd-security-auditor | 2026-04-29 |
| AR-14-13 | T-14-05-03 | 3 × ~100KB fs reads at vitest startup — negligible | gsd-security-auditor | 2026-04-29 |
| AR-14-14 | T-14-05-04 | Phase 14 introduces no env-var URL injection; future phases can extend | gsd-security-auditor | 2026-04-29 |
| AR-14-15 | T-14-06-01 | Synchronous `(): void` mutation post-trust-boundary; no new surface introduced | gsd-security-auditor | 2026-04-29 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-29 | 25 | 25 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-29

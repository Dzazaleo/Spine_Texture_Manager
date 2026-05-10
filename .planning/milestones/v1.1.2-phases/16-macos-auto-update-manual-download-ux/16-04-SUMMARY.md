---
phase: 16-macos-auto-update-manual-download-ux
plan: 04
subsystem: main/ipc
tags: [security, allow-list, ipc, trust-boundary, auto-update, threat-model, tdd, urlparse]
requires:
  - "Phase 12 D-18 — SHELL_OPEN_EXTERNAL_ALLOWED Set + shell:open-external ipcMain.on handler at src/main/ipc.ts:653"
  - "Plan 14-05 URL-consistency regression gate — tests/integration/auto-update-shell-allow-list.spec.ts (14-p..s)"
  - "Plan 16-01 type rename — src/shared/types.ts variant 'manual-download' literal landed (commit c7d94c6)"
provides:
  - "isReleasesUrl(url: string): boolean structural allow-list helper exported from src/main/ipc.ts (@internal — test surface only)"
  - "Extended shell:open-external handler accepting Set.has hit OR isReleasesUrl true"
  - "9 vitest specs (16-a..16-i) covering happy paths + threat model T-16-04-01..05"
affects:
  - "src/main/ipc.ts (helper added; handler line widened from single Set.has to Set.has || isReleasesUrl)"
  - "tests/integration/auto-update-shell-allow-list.spec.ts (electron vi.mock added at top + 9 new specs in a Phase 16 D-04 describe block; 4 Phase 14 specs untouched)"
tech-stack:
  added: []
  patterns: ["URL.parse-based structural allow-list (defense vs naive prefix-match)"]
key-files:
  created: []
  modified:
    - src/main/ipc.ts
    - tests/integration/auto-update-shell-allow-list.spec.ts
decisions:
  - "Structural URL.parse + hostname-equals + pathname-prefix check (D-04 lean) over regex; rejects substring-abuse via exact-equals on parsed.hostname"
  - "isReleasesUrl exported with @internal JSDoc — test surface only, NOT part of the public ipc.ts API"
  - "Set.has fast-path preserved unchanged; isReleasesUrl is a fall-through for the per-release URL shape only"
  - "Index URL Set entry retained verbatim → Plan 14-05 (14-q / 14-s) URL-consistency regression gate stays green"
  - "Defense-in-depth note: pathname-prefix is permissive about the version segment shape because info.version is parsed upstream by electron-updater; outcome of a malformed version is a 404 GitHub page, not privilege escalation"
metrics:
  duration: "~4m 7s wall-time (executor session 09:37:24Z → 09:41:31Z UTC)"
  completed: "2026-04-30"
  tests_added: 9
  tests_total_in_file: 13 # 4 Phase 14 + 9 Phase 16 D-04
  tests_passing: 13
  files_changed: 2
  loc_added: 78  # ipc.ts helper + comments
---

# Phase 16 Plan 04: IPC allow-list — releases-tag URL widening Summary

Trust-boundary widening on `shell:open-external` so the per-release URL emitted
by `deliverUpdateAvailable` (Plan 16-03) passes without loosening the gate
enough to allow arbitrary `github.com` URLs or hostname-spoofing attacks. New
`isReleasesUrl` helper does URL.parse + hostname-equals + pathname-prefix; 9
new specs lock the threat model.

## Tasks executed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Phase 16 D-04 RED specs for isReleasesUrl helper | `e25ff46` | `tests/integration/auto-update-shell-allow-list.spec.ts` |
| 2 | Implement isReleasesUrl helper + integrate with shell:open-external (GREEN) | `e82a2ea` | `src/main/ipc.ts` |

Plan-level TDD gate sequence verified in `git log`:
- RED: `e25ff46 test(16-04): add Phase 16 D-04 RED specs for isReleasesUrl helper`
- GREEN: `e82a2ea feat(16-04): add isReleasesUrl helper + integrate with shell:open-external`
No REFACTOR commit needed — helper is small (~30 lines) and direct.

## Helper signature

```ts
/**
 * @internal — exported for tests/integration/auto-update-shell-allow-list.spec.ts
 * (Plan 16-04 Task 1). Not part of the public src/main/ipc.ts API; do NOT
 * re-export from index modules.
 */
export function isReleasesUrl(url: string): boolean;
```

Returns `true` iff `url` is a well-formed https URL on the github.com host
targeting either:
- The project's Releases index page (`/Dzazaleo/Spine_Texture_Manager/releases`), OR
- A specific release tag page (`/Dzazaleo/Spine_Texture_Manager/releases/tag/v{version}`)
  where `{version}` is non-empty and contains no further `/`.

## Set.has + isReleasesUrl fall-through

Handler at `src/main/ipc.ts:653`:

```ts
ipcMain.on('shell:open-external', (_evt, url) => {
  if (typeof url !== 'string' || url.length === 0) return;
  // Phase 16 D-04 — accept either:
  //   (a) an exact-string match against the existing Set …, OR
  //   (b) a structural match for a /releases/tag/v{version} URL on github.com …
  if (!SHELL_OPEN_EXTERNAL_ALLOWED.has(url) && !isReleasesUrl(url)) return;
  try { void shell.openExternal(url); } catch { /* silent */ }
});
```

The Set fast-path preserves Spine-docs URLs, INSTALL.md URL, and the Releases
index URL (Phase 12 D-18 + Plan 14-05 backward-compat). The structural check
fires only when the Set misses, widening the gate exactly to the per-release
tag URL shape.

## Threat model — mitigation status

| Threat ID | Category | Disposition | Mitigated by | Locked by test |
|-----------|----------|-------------|--------------|----------------|
| T-16-04-01 | Spoofing/Tampering — URL spoofing | mitigate | `parsed.hostname !== 'github.com'` exact-equals at `src/main/ipc.ts:225` | `(16-f)` `https://github.com.attacker.com/…` returns false |
| T-16-04-02 | Tampering — subdomain spoof | mitigate | same exact-equals on hostname | `(16-g)` `https://attacker.github.com/…` returns false |
| T-16-04-03 | Information Disclosure | accept (upstream) | info.version parsed by electron-updater; pathname-prefix is permissive | n/a — outcome is 404 GitHub page, not escalation |
| T-16-04-04 | EoP — scheme downgrade | mitigate | `parsed.protocol !== 'https:'` exact-equals at `src/main/ipc.ts:224` | `(16-h)` `http://github.com/…` returns false |
| T-16-04-05 | DoS — malformed URL crash | mitigate | try/catch around `new URL(url)` returns false at `src/main/ipc.ts:218–222` | `(16-i)` `'not a url'`, `''`, `'javascript:alert(1)'` all return false |
| T-16-04-06 | Tampering — legacy entry regression | mitigate | Set entry for index URL retained unchanged at `src/main/ipc.ts:174` | `(14-q)` / `(14-s)` Phase 14 URL-consistency gate stays green |

## Test additions (9 specs, Phase 16 D-04 describe block)

- `(16-a)` index URL passes — backward-compat
- `(16-b)` per-release tag URL `v1.2.0` passes — D-04 happy path
- `(16-c)` per-release tag URL `v1.2.0-rc.1` passes — CLAUDE.md release-tag convention
- `(16-d)` issues URL on project repo REJECTED — path-prefix narrowness
- `(16-e)` different-repo `/releases` URL REJECTED — path-prefix narrowness
- `(16-f)` hostname-spoofed `github.com.attacker.com` REJECTED — T-16-04-01
- `(16-g)` subdomain-spoofed `attacker.github.com` REJECTED — T-16-04-02
- `(16-h)` non-https scheme REJECTED — T-16-04-04
- `(16-i)` malformed URL strings (`'not a url'`, `''`, `'javascript:alert(1)'`) return false — T-16-04-05

Test counts before / after this plan:
- Before: 4 specs in the file (Phase 14 14-p..s) — all passing.
- After: 13 specs (4 Phase 14 + 9 Phase 16 D-04) — all 13 passing.

## Verification

- `npx vitest run tests/integration/auto-update-shell-allow-list.spec.ts` exits 0 — 13/13 passing.
- `npm run typecheck:node` exits 0.
- `grep -c "export function isReleasesUrl" src/main/ipc.ts` returns `1`.
- `grep -c "isReleasesUrl" src/main/ipc.ts` returns `3` (declaration + handler use + 1 docblock reference).
- `grep -c "https://github.com/Dzazaleo/Spine_Texture_Manager/releases" src/main/ipc.ts` returns `1` (Plan 14-05 regression gate alive).
- `grep -c "parsed.hostname !== 'github.com'" src/main/ipc.ts` returns `1`.
- `grep -c "parsed.protocol !== 'https:'" src/main/ipc.ts` returns `1`.
- Broader ipc test sweep (`tests/main/ipc.spec.ts` + `tests/main/ipc-export.spec.ts` + `tests/core/ipc.spec.ts`) — 42/42 passing, no regression.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — blocking issue] Add `vi.mock('electron', …)` to the test file**

- **Found during:** Task 1 RED verification (`npx vitest run …`).
- **Issue:** The plan instructed `import { isReleasesUrl } from '../../src/main/ipc.js'`, but importing from `src/main/ipc.ts` triggers a transitive load `ipc.ts → project-io.ts → recent.ts → app.getPath('userData')` that crashes outside an Electron host. Without the mock, the suite errored before any test could run with `TypeError: Cannot read properties of undefined (reading 'getPath')` — including the 4 Phase 14 file-content specs that don't use the helper.
- **Fix:** Added `vi.mock('electron', () => ({ … }))` at the top of `tests/integration/auto-update-shell-allow-list.spec.ts`, mirroring the pattern from `tests/core/ipc.spec.ts`. The Phase 14 specs continue to pass (they use `readFileSync`, not the helper); the Phase 16 specs now reach the import and fail in the EXPECTED RED state (`isReleasesUrl is not a function`) until Task 2 lands the export.
- **Files modified:** `tests/integration/auto-update-shell-allow-list.spec.ts`.
- **Commit:** `e25ff46` (rolled into Task 1 RED commit).
- **Why Rule 3:** This was a blocking issue preventing the plan's stated test-import approach from running at all. The mock pattern is established elsewhere in the test suite; no architectural change.

### Deferred Issues (out of scope)

**1. Pre-existing typecheck errors in `src/renderer/src/App.tsx`**

`npm run typecheck` (specifically `tsconfig.web.json`) reports two TS2367 errors at App.tsx:363 and App.tsx:417 — comparisons to the literal `'windows-fallback'` after Plan 16-01 renamed the type to `'auto-update' | 'manual-download'`.

- **Out of scope for Plan 16-04:** The plan's `<files_modified>` is strictly `src/main/ipc.ts` + `tests/integration/auto-update-shell-allow-list.spec.ts`. The App.tsx variant rename is owned by a different wave plan per CONTEXT.md D-05.
- **Tracked at:** `.planning/phases/16-macos-auto-update-manual-download-ux/deferred-items.md`.
- **Plan 16-04 self-impact:** None. Vitest does not gate on tsc errors in unrelated files; the 13 specs in the test file all pass. `npm run typecheck:node` (which DOES cover ipc.ts and the test file) exits 0.

## Authentication Gates

None — purely local code edits.

## Self-Check: PASSED

- [x] `src/main/ipc.ts` modified (commit `e82a2ea`).
- [x] `tests/integration/auto-update-shell-allow-list.spec.ts` modified (commit `e25ff46`).
- [x] Both commits exist on the worktree branch (`git log --oneline` confirms).
- [x] `isReleasesUrl` helper exported, declared, and consumed by handler.
- [x] All 13 specs in the file pass under vitest.
- [x] Plan 14-05 URL-consistency regression gate (14-p / 14-q / 14-r / 14-s) preserved.
- [x] No accidental deletions in either commit.
- [x] `deferred-items.md` records the pre-existing App.tsx typecheck issue out-of-scope for Plan 16-04.

## TDD Gate Compliance

Plan frontmatter is `type: execute`, not `type: tdd`, so plan-level gate enforcement is per-task TDD via `tdd="true"` markers — both tasks carry the marker.

Per-task TDD gate sequence verified:
- Task 1 RED: `e25ff46 test(16-04): …` — 9 new specs failing with `isReleasesUrl is not a function`.
- Task 2 GREEN: `e82a2ea feat(16-04): …` — same 9 specs now passing; the 4 Phase 14 specs continue to pass.
- REFACTOR: not needed.

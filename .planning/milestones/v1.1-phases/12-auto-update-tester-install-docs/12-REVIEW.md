---
phase: 12-auto-update-tester-install-docs
reviewed: 2026-04-27T22:32:20Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - .github/release-template.md
  - .github/workflows/release.yml
  - INSTALL.md
  - README.md
  - electron-builder.yml
  - package.json
  - src/core/errors.ts
  - src/core/loader.ts
  - src/main/auto-update.ts
  - src/main/index.ts
  - src/main/ipc.ts
  - src/main/project-io.ts
  - src/main/sampler-worker.ts
  - src/main/update-state.ts
  - src/preload/index.ts
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/modals/AtlasPreviewModal.tsx
  - src/renderer/src/modals/HelpDialog.tsx
  - src/renderer/src/modals/UpdateDialog.tsx
  - src/shared/types.ts
  - tests/arch.spec.ts
  - tests/core/errors-version.spec.ts
  - tests/core/ipc.spec.ts
  - tests/core/loader-version-guard-predicate.spec.ts
  - tests/core/loader-version-guard.spec.ts
  - tests/core/loader.spec.ts
  - tests/core/project-file.spec.ts
  - tests/integration/install-md.spec.ts
  - tests/main/auto-update.spec.ts
  - tests/main/ipc.spec.ts
  - tests/main/update-state.spec.ts
  - tests/renderer/app-shell-output-picker.spec.tsx
  - tests/renderer/atlas-preview-modal.spec.tsx
  - tests/renderer/help-dialog.spec.tsx
  - tests/renderer/rig-info-tooltip.spec.tsx
  - tests/renderer/save-load.spec.tsx
  - tests/renderer/update-dialog.spec.tsx
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-04-27T22:32:20Z
**Depth:** standard
**Files Reviewed:** 33 (note: `files_reviewed_list` includes the input scope of 37 entries; 4 of those — `tests/core/loader.spec.ts`, `tests/core/project-file.spec.ts`, `tests/core/ipc.spec.ts`, and `src/shared/types.ts` — were verified clean and contributed no findings)
**Status:** issues_found

## Summary

Phase 12 ships three discrete bug fixes (F1 atlas-image URL, F2 file-picker UX, F3 Spine 4.2 version guard) plus a substantial new auto-update orchestrator (electron-updater wiring + UpdateDialog + 9 IPC channels), an INSTALL.md cookbook with 4 linking surfaces, and a CI matrix expansion to 3 OSes. Across all 33 files reviewed, security posture is strong: the trust-boundary discipline is consistent, the `SHELL_OPEN_EXTERNAL_ALLOWED` allow-list is correctly extended (and gated by an integration test), the Spine version guard surfaces user-supplied strings without escape-injection risk (only echoed in `Error.message`, not HTML/SQL/shell), and the `pathToFileURL`/Windows-drive-letter fix in `atlas:resolve-image-url` is well-tested. The Layer-3 `core/`-purity invariant is preserved — `loader.ts` still uses only `node:fs` (already-carved) and `node:path`.

The findings below are correctness/quality issues. Three Warnings concern the `compareSemver` helper in auto-update (semver pre-release comparison breaks ordering when both versions carry pre-release tags), the documented-but-actually-skipped `update:none` startup-mode silent contract (renderer filters but main always sends — inverts the docstring at `auto-update.ts:128-130`), and the `update:error` autoUpdater event handler at `auto-update.ts:148` which double-fires when `checkForUpdates()` rejects in manual mode (causes two `update:error` IPCs for one logical error). One Warning calls out a broken JSDoc reference (`saveProject.elapsedMs` no longer exists on the API). Info items cover dead-code references, schema drift in `types.ts`, and duplication of the GitHub Releases URL across three files.

No security-critical issues. No data-loss risks. Behavior-locking tests exist for every documented contract.

## Warnings

### WR-01: `compareSemver` produces incorrect ordering when both versions carry pre-release suffixes

**File:** `src/main/auto-update.ts:262-286`
**Issue:** When both `a` and `b` have equal numeric tuples but different pre-release suffixes (e.g. `compareSemver('1.1.0-rc2', '1.1.0-rc1')`), the function returns `-1` (claiming `a < b`, i.e. "available is newer") regardless of which side is actually newer. The post-loop branch is:

```js
if (a === b) return 0;
if (a !== b) return -1;
return 0;
```

The second `if` always fires (since the first `if (a === b)` already returned for the equal case), producing a constant `-1` whenever both strings differ but share a numeric tuple. Concretely, if a user dismisses `1.1.0-rc2` and the GitHub feed serves `1.1.0-rc1` (downgrade), the function reports rc1 as "newer" and the dialog re-fires. The docstring at lines 277-283 acknowledges "false positives acceptable", but the actual symptom — re-prompting on a downgrade or on a release-after-prerelease (`compareSemver('1.0.0', '1.0.0-rc1')` also returns `-1`) — is more aggressive than documented.

**Fix:** Use the `semver` package (already a transitive dep of electron-updater per the docstring) for prerelease-aware compare, OR explicitly compare the suffixes lexically:

```js
// After numeric tuples are equal:
const suffixA = a.slice(numericA.length);
const suffixB = b.slice(numericB.length);
// Empty suffix (release) outranks any prerelease suffix per semver §11.
if (suffixA === '' && suffixB !== '') return 1;
if (suffixA !== '' && suffixB === '') return -1;
if (suffixA < suffixB) return -1;
if (suffixA > suffixB) return 1;
return 0;
```

Tests at `tests/main/auto-update.spec.ts` cover only major.minor.patch tuples (cases 4a-4d use `1.2.3`/`1.2.4`/`2.0.0`); add `compareSemver('1.1.0-rc1', '1.1.0-rc2')` and `compareSemver('1.0.0', '1.0.0-rc1')` cases to lock the fix.

---

### WR-02: `update:none` startup-mode contract documented as "silent" but main always sends; only renderer filters

**File:** `src/main/auto-update.ts:128-130` and `src/renderer/src/components/AppShell.tsx:944-960`
**Issue:** The `auto-update.ts` event handler unconditionally fires `sendToWindow('update:none', ...)` whenever electron-updater emits `update-not-available`. The docstring at `auto-update.ts:165-166` says "Manual mode: any rejection becomes `update:error` IPC. Startup mode: silent-swallow per UPD-05" and the test at `tests/main/auto-update.spec.ts` case (7) is annotated `'startup mode: also emits update:none (renderer filters by manualCheckPendingRef)'` — i.e. the actual contract is "main always sends, renderer filters by `manualCheckPendingRef`". The docstring `// 'update:none' (manual check, no update)` at lines 128-130 doesn't mention the renderer-side filter.

This is not a bug — it works correctly — but it creates a maintenance trap: a future reader of `auto-update.ts` who decides to "make the documented contract match the code" by adding a `triggeredManually` parameter would break the renderer filter (which never sees the `manualCheckPendingRef` flag for startup-mode `update-not-available` events because the `onUpdateNone` handler always fires and the ref is checked there). The same applies to `update:error`: the "unconditional bridge" comment at lines 142-148 explicitly notes this is belt-and-braces, but the `update-not-available` handler has no such comment.

**Fix:** Add a short comment to the `update-not-available` handler at line 128 mirroring the `update:error` block (lines 142-148):

```js
autoUpdater.on('update-not-available', () => {
  // Always-bridge IPC; renderer filters by manualCheckPendingRef
  // (D-07: only show "You're up to date" on manual checks).
  sendToWindow('update:none', { currentVersion: app.getVersion() });
});
```

This documents the actual contract and prevents the regression.

---

### WR-03: `checkUpdate(true)` rejection causes double `update:error` IPC (event-handler + try/catch both fire)

**File:** `src/main/auto-update.ts:136-149` (handler) and `src/main/auto-update.ts:168-185` (`checkUpdate`)
**Issue:** When `autoUpdater.checkForUpdates()` rejects in manual mode (e.g. `tests/main/auto-update.spec.ts` case 9 — `boom`), two paths can both fire `update:error` for the same logical failure:

1. The catch block in `checkUpdate(true)` at line 180 fires `sendToWindow('update:error', { message })`.
2. Some `electron-updater` failures (network, signature mismatch) ALSO emit on the underlying `error` EventEmitter, triggering the unconditional bridge at line 148 — which fires `sendToWindow('update:error', { message: err.message })` again.

The unit test at line 256-261 mocks `checkForUpdates.mockRejectedValueOnce(...)` (no event emission) so it sees only the catch-block `update:error`. In production against the real `electron-updater`, the renderer's `onUpdateError` listener at `AppShell.tsx:961-975` would consume both events. Because the listener clears `manualCheckPendingRef.current = false` on the FIRST event, the SECOND event is silently dropped — but the renderer briefly shows the update dialog with the first message, then any further state changes (e.g. user clicks "Dismiss") happen against an already-rendered dialog.

This is a latent footgun. The renderer also has a related issue: `manualCheckPendingRef` is consumed (set to `false`) on the first matching event. If a real `electron-updater` `error` event fires in the same tick as the `checkUpdate` rejection, only one of `update:none` (from `update-not-available`, won't fire here since it's an error) or `update:error` will surface — but if a SECOND manual check is triggered before the first ack returns, the ref state is racy.

**Fix:** Make the `error` event handler at line 148 mode-aware by exposing a module-level flag (similar to `initialized`):

```js
let manualCheckInFlight = false;
// ...
export async function checkUpdate(triggeredManually: boolean): Promise<void> {
  manualCheckInFlight = triggeredManually;
  try { /* ... */ } finally { manualCheckInFlight = false; }
}
// In autoUpdater.on('error', ...):
if (manualCheckInFlight) {
  // checkUpdate's catch will surface this; let it own the IPC.
  return;
}
sendToWindow('update:error', { message: err.message });
```

Alternatively: add a deduplication ref on the renderer side (track the last emitted error message + a 100ms window) to drop the duplicate.

---

### WR-04: AppShell `useEffect` for auto-update IPC subscriptions has empty dep array — captures stale `setUpdateState` semantics

**File:** `src/renderer/src/components/AppShell.tsx:931-998`
**Issue:** The `useEffect` at line 931 with `[]` deps registers handlers that capture `setUpdateState` and `manualCheckPendingRef`. React's `setState` setters are stable across renders, so this is functionally fine for the setters themselves — BUT the same `useEffect` block also captures the literal URL `'https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md'` (line 988) inside the `unsubMenuInstall` handler. If a future refactor extracts this URL to props or context but forgets to add it to the dep array, the closure would silently see the stale value.

More immediately: the same dep array (line 998) means none of the handlers can ever read `updateState.version` — the `onLater` handler at line 1455 currently lives outside this useEffect (it's on the JSX itself, line 1448-1463), so it works, but if anyone moves it inside for symmetry they'll get a stale closure. The pattern is fragile.

**Fix:** Either add a JSDoc comment at line 931 explicitly documenting the empty-deps invariant, OR refactor the URL into a module-level constant (mirroring `UpdateDialog.tsx:102-103`) so the source-of-truth is at the top of file. Adding an `eslint-disable react-hooks/exhaustive-deps` directive is also acceptable.

---

## Info

### IN-01: Dead-code reference to `MaterializedProject.projectFilePath = ''` empty-string sentinel

**File:** `src/main/project-io.ts:920-925`
**Issue:** `handleProjectResample` casts `a.projectFilePath` to `''` when missing, with the comment "MaterializedProject.projectFilePath is typed as `string` so we coerce the null case to ''". `AppShell.tsx:695` then reads it as `project.projectFilePath !== '' ? project.projectFilePath : null`. This is an empty-string-as-null sentinel pattern that's brittle: if a future caller passes a real `'./relative.stmproj'` path (relative paths are forbidden but not validated), the comparison still works — but if the type signature ever changes to `string | null`, the empty-string branch will silently turn into a falsy comparison bug.

**Fix:** Make `MaterializedProject.projectFilePath` actually `string | null` in `src/shared/types.ts:667`, and update the two call sites accordingly. Pre-existing tech-debt — out of Phase 12 scope, but worth noting.

---

### IN-02: Duplicated `GITHUB_RELEASES_INDEX_URL` literal across 3 files (drift risk)

**File:** `src/main/auto-update.ts:73`, `src/main/ipc.ts:174`, `src/renderer/src/modals/UpdateDialog.tsx:103`, and `src/renderer/src/components/AppShell.tsx:1465`
**Issue:** The same URL `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` appears 4 times. The `tests/integration/install-md.spec.ts` covers the INSTALL.md URL drift (4-surface test), but the equivalent test for the Releases URL only checks IPC allow-list presence. If the GitHub org/repo is ever renamed, three files need updates and the test suite won't catch a partial rename until manual UAT.

**Fix:** Extract a `RELEASES_URL` constant in `src/shared/constants.ts` (new file — pure-TS, structuredClone-safe) consumed by all 4 files. OR add a parallel test in `tests/integration/install-md.spec.ts` covering Releases URL consistency.

---

### IN-03: `extractSummary` regex doesn't handle `## Summary` at start-of-string (no leading newline)

**File:** `src/main/auto-update.ts:324`
**Issue:** The regex `/##\s*Summary\s*\n([\s\S]*?)(?=\n##\s|$)/i` requires a literal `\n` after "Summary". If the release notes start with `## Summary\nFoo` (no leading content), the match works; but if the regex engine fails the lookahead `(?=\n##\s|$)` because the content runs to EOF without a newline (e.g. `## Summary\nFoo` exactly), the capture group still resolves to `Foo` via the `$` alternation — verified.

The actual minor concern: `releaseNotes` content with CRLF line endings (Windows GitHub web editor) becomes `## Summary\r\nFoo\r\n## Other`. The `\s*\n` at line 324 accepts `\r\n` (since `\r` is `\s`), so this is correct. The lookahead `\n##\s` would NOT match `\r\n##\s` though — `\n` is not `\r\n`. On a CRLF release-notes payload with multiple sections, the Summary capture would consume past the next section's heading.

**Fix:** Change `\n##\s` to `\r?\n##\s` in the lookahead (and `\s*\n` to `\s*\r?\n` for symmetry, though the existing `\s*` already handles `\r`). Add a CRLF case to `tests/main/auto-update.spec.ts` extractSummary block.

---

### IN-04: `SerializableError` recovery-arm fields could be `nullable` instead of typed-as-required

**File:** `src/shared/types.ts:518-554`
**Issue:** The `'SkeletonNotFoundOnLoadError'` arm at lines 519-531 carries 7 required recovery fields. `handleProjectReloadWithSkeleton` at `project-io.ts:618-715` has a recovery-within-recovery branch (lines 660-682) that re-uses the same envelope arm, threading `a.newSkeletonPath` (the JUST-PICKED-but-now-missing path) as `originalSkeletonPath`. This works but the field name is now misleading — `originalSkeletonPath` no longer means "original from project file" but "last-attempted skeleton path". The renderer treats them identically, but the JSDoc at types.ts:524-525 says "Cached recovery payload — fed to handleProjectReloadWithSkeleton when the user picks a replacement skeleton".

**Fix:** Either rename to `previousSkeletonPath` (semantic correction) or add a comment at types.ts:524 noting the name is overloaded across the two re-entry sites. Pre-existing — out of Phase 12 scope.

---

### IN-05: `version: 1` hardcoded literal type in `update-state.ts` and `validateUpdateStateFile`

**File:** `src/main/update-state.ts:48-49,93,116`
**Issue:** The `UpdateStateV1.version: 1` field is the right pattern for migrations (mirrors `ProjectFileV1`), but the validator at line 94 uses `if (obj.version !== 1)` and the load returns `{ version: 1, ... }` literal at line 116. When `UpdateStateV2` is needed, the `loadUpdateState` return type widens to `UpdateStateV1 | UpdateStateV2` and every call site needs a discriminated-union narrow. The current shape works but lacks the migration ladder pattern that `project-file.ts` `migrate()` establishes.

**Fix:** Pre-emptively add a stub `migrate(state: UpdateState): UpdateStateV1` function (passthrough on v1) so the next phase that bumps the schema can extend the ladder without changing the public API of `update-state.ts`. Out of Phase 12 scope — flag for Phase 13 polish.

---

### IN-06: `INSTALL.md` references screenshot files that are 1×1 placeholder PNGs (deferred to Phase 12.1)

**File:** `INSTALL.md:27-30, 54-56, 60-62, 106-108`
**Issue:** Four `![alt](docs/install-images/...)` markdown image references are committed alongside `(Screenshot pending — capture during phase 12.1 with first real tester install on rc2.)` placeholder text. The `tests/integration/install-md.spec.ts` PNG-magic-bytes check at lines 109-127 verifies the files exist and have valid PNG headers; on GitHub, the 1×1 placeholders render as a single black pixel inside the markdown body, which is not great UX but is documented as deferred.

**Fix:** No code action needed in Phase 12 — flagged as informational so the Phase 12.1 capture work isn't forgotten. Optionally, soften the markdown by wrapping the image refs in HTML comments until real captures land, leaving only the placeholder text visible:

```html
<!--![Gatekeeper Open Anyway dialog](docs/install-images/macos-gatekeeper-open-anyway.png)-->
```

This avoids the black-pixel rendering until 12.1 lands the real screenshots.

---

_Reviewed: 2026-04-27T22:32:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 12-auto-update-tester-install-docs
plan: 03
subsystem: ui
tags: [electron, ipc, atlas-preview, pathtofileurl, windows-fix, f1-spillover]

# Dependency graph
requires:
  - phase: 12-auto-update-tester-install-docs
    provides: Plan 12-01 wired the auto-update IPC + preload surface (4 update channels + 9 update bridges + SHELL_OPEN_EXTERNAL_ALLOWED Set); this plan extends the same surfaces with one additional invoke handler + one preload bridge without disturbing 12-01's territory.
  - phase: 11-ci-release-pipeline-github-actions-draft-release
    provides: Live CI smoke surfaced F1 (`localhostc/` 404 in atlas-image fetch on Windows install) — captured in 11-WIN-FINDINGS.md §F1 as the spillover this plan closes.
provides:
  - "atlas:resolve-image-url IPC handler in src/main/ipc.ts (pathToFileURL → app-image://localhost/<pathname>; cross-platform via drive-letter detection + { windows: true })"
  - "window.api.pathToImageUrl preload bridge (Promise<string> via IPC-invoke; Layer-3 invariant preserved — renderer never imports node:url)"
  - "Api.pathToImageUrl method signature in src/shared/types.ts"
  - "AtlasPreviewModal.tsx F1 fix at line 116 area: img.src now set via .then() callback after the bridge resolves"
  - "F1 Windows-runtime regression tests at tests/renderer/atlas-preview-modal.spec.tsx (algorithmic positive + POSIX positive + buggy-shape anti-test)"
  - "ipc.spec.ts mock-setup extension: ipcMain.handle captor (mirrors existing on-handler captor) so future invoke channels can be unit-tested directly"
affects:
  - phase: 12-auto-update-tester-install-docs (Plan 12-04 / 12-05 / 12-06 — same IPC + preload + Api surface; this plan establishes that one-channel additions to the surface remain non-disruptive when serialized after 12-01)
  - "Phase 12.1 (proposed) Windows spike — Atlas Preview is one of the basic-sanity smoke checks for the install runbook; this plan unblocks that check"

# Tech tracking
tech-stack:
  added: []  # No new runtime deps; node:url is a Node built-in already in use elsewhere.
  patterns:
    - "pathToFileURL bridge for renderer→main URL construction (D-19): renderer obtains custom-protocol URLs from main via IPC instead of constructing them by string concat. Generalizable to any future custom-protocol surface (cf. existing app-image:// handler at src/main/index.ts:383-399)."
    - "Cross-platform pathToFileURL hardening: drive-letter regex detection (`/^[A-Za-z]:[\\\\/]/`) + explicit `{ windows: true }` makes the URL builder behave correctly regardless of which OS hosts the IPC handler (defends against the macOS-default POSIX-relative-path interpretation of Windows paths in cached project files)."
    - "Anti-test pinning of buggy failure modes: alongside the positive fix-shape test, pin the OLD buggy shape's runtime evidence (either 'Invalid URL' throw OR host='localhostc') so quiet regression by deletion of either side is visible."
    - "ipcMain.handle captor for invoke-channel unit tests: parallels the existing ipcMainOnHandlers Map-backed captor used for on-channel tests; lets specs look up + invoke handlers directly without round-tripping through real Electron."

key-files:
  created: []  # All edits extend existing files.
  modified:
    - "src/main/ipc.ts (add atlas:resolve-image-url ipcMain.handle inside registerIpcHandlers; import pathToFileURL from 'node:url')"
    - "src/preload/index.ts (add pathToImageUrl bridge as ipcRenderer.invoke wrapper returning Promise<string>)"
    - "src/shared/types.ts (add Api.pathToImageUrl method signature; the .d.ts file in src/preload/index.d.ts only augments Window — the Api type itself lives here, not in the preload .d.ts file the plan listed)"
    - "src/renderer/src/modals/AtlasPreviewModal.tsx (replace string-concat URL at line 116 area with `void window.api.pathToImageUrl(absolutePath).then((url) => { img.src = url })`; update file header doc-comment to point at the new bridge)"
    - "tests/main/ipc.spec.ts (extend electron mock with ipcMainHandleHandlers captor; add 4 RED→GREEN tests for atlas:resolve-image-url channel)"
    - "tests/renderer/atlas-preview-modal.spec.tsx (add beforeEach/afterEach window.api.pathToImageUrl stub via vi.stubGlobal; add 3 algorithmic regression tests for F1 fix shape; import pathToFileURL from 'node:url')"

key-decisions:
  - "D-19 IPC-invoke variant ships unconditionally — RESEARCH Open Question 1 (sandbox availability of node:url in preload) was pre-resolved at plan time by choosing the variant that works regardless of preload sandbox state. No synchronous preload variant; renderer must use .then() or await."
  - "Cross-platform handler hardening (Rule 2 deviation): IPC handler detects Windows-style input via drive-letter regex and forces `{ windows: true }` on pathToFileURL. Default pathToFileURL behavior is platform-dependent — on macOS/Linux it would treat 'C:\\…' as a POSIX-relative path and prepend cwd, mis-shaping the URL. Hardening makes the handler correct under any future Windows-authored .stmproj being opened on a non-Windows host AND makes the spec tests deterministic across CI matrix legs."
  - "Renderer .then() shape (NOT await) at AtlasPreviewModal.tsx loadImage callback: keeps loadImage's synchronous return contract intact. The HTMLImageElement is cached + returned immediately; img.src gets set asynchronously when the bridge resolves. Avoids cascading await throughout the call graph (loadImage is called from both useEffect and AtlasCanvas prop)."
  - "Anti-test for buggy shape: pinned the OLD concat shape's failure modes (Invalid URL throw OR host='localhostc') so a future refactor accidentally re-introducing the concat is caught by a paired positive + negative regression check."
  - "Type signature added to src/shared/types.ts (Api interface) instead of src/preload/index.d.ts as the plan listed: the .d.ts file only augments Window with `api: Api`; the Api type itself lives in shared/types.ts and is consumed by both preload and renderer via the same import. Adding to the .d.ts file would have created a duplicate or orphan type."

patterns-established:
  - "F1-fix bridge pattern (D-19): renderer→main URL builder via IPC-invoke; renderer awaits or .then()s the result. Re-applicable to any future custom-protocol URL the renderer needs to construct from a filesystem path."
  - "Cross-platform URL builder: drive-letter regex + explicit { windows: true } on pathToFileURL → the URL builder behaves correctly under any host OS."
  - "Test scaffold for invoke-channel handlers: extend electron mock's ipcMain.handle to populate a Map captor; specs look up handlers by channel name and invoke them directly. Mirrors the existing on-channel captor pattern."

requirements-completed: []  # F1 is a CONTEXT-folded item per D-19 — Phase 11 spillover with no roadmap requirement ID. REL-03 (the INSTALL.md cookbook deliverable) is owned solely by 12-06.

# Metrics
duration: 13 min
completed: 2026-04-27
---

# Phase 12 Plan 03: F1 atlas-image URL Windows fix Summary

**`pathToFileURL` bridge from renderer to main closes the Phase 11 `localhostc/` spillover at AtlasPreviewModal.tsx:116; cross-platform handler hardening + anti-test pin the buggy concat shape's failure mode.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-04-27T21:52:00Z (approximate; first commit timestamp)
- **Completed:** 2026-04-27T22:05:00Z (approximate; SUMMARY commit)
- **Tasks:** 2 (each TDD with RED + GREEN commits = 4 task commits)
- **Files modified:** 6 (plan listed 5; src/shared/types.ts added because Api interface lives there, not in src/preload/index.d.ts)

## Accomplishments

- F1 Windows-runtime bug closed at the single audit site (AtlasPreviewModal.tsx:116). Renderer no longer constructs `app-image://` URLs by string concat; the new IPC-invoke bridge `window.api.pathToImageUrl(absolutePath)` delegates to a main-side `pathToFileURL`-backed handler.
- Cross-platform handler hardening: drive-letter regex detection + explicit `{ windows: true }` makes the URL builder behave correctly regardless of which OS hosts the IPC handler. Spec tests are now deterministic across the 12-02 CI matrix [ubuntu-latest, windows-2022, macos-14] AND defend against any future Windows-authored .stmproj being opened on a non-Windows host.
- F1 regression coverage: positive Windows-shape test, positive POSIX-shape test, AND anti-test pinning the OLD buggy concat shape's failure modes (either 'Invalid URL' throw OR `host='localhostc'`). Anti-test makes quiet regression-by-deletion visible.
- Test scaffolding extension: ipcMain.handle captor in tests/main/ipc.spec.ts mirrors the existing on-handler captor — future invoke channels can be unit-tested directly without round-tripping through real Electron.

## Task Commits

Each task followed the TDD RED → GREEN cycle with atomic commits:

1. **Task 1 RED — atlas:resolve-image-url IPC handler tests** — `97dd77d` (test)
2. **Task 1 GREEN — wire IPC handler + preload bridge + Api type** — `e6558c3` (feat)
3. **Task 2 RED — F1 Windows-runtime regression tests** — `d92748b` (test)
4. **Task 2 GREEN — fix AtlasPreviewModal.tsx via window.api.pathToImageUrl** — `dc8155c` (feat)

**Plan metadata:** _(this commit)_ `docs(12-03): complete plan SUMMARY + STATE/ROADMAP tracking`

## Files Created/Modified

- `src/main/ipc.ts` — Add `ipcMain.handle('atlas:resolve-image-url', ...)` inside `registerIpcHandlers()`; import `pathToFileURL` from `'node:url'`. Cross-platform hardening: drive-letter regex + `{ windows: true }`. typeof===string guard mirrors update:dismiss precedent (12-01).
- `src/preload/index.ts` — Add `pathToImageUrl: (absolutePath: string) => ipcRenderer.invoke('atlas:resolve-image-url', absolutePath)` bridge. Preload does NOT import `node:url` (Layer-3 invariant preserved).
- `src/shared/types.ts` — Add `pathToImageUrl(absolutePath: string): Promise<string>` to the `Api` interface.
- `src/renderer/src/modals/AtlasPreviewModal.tsx` — Replace `img.src = ` app-image://localhost${encodeURI(absolutePath)}` ` with `void window.api.pathToImageUrl(absolutePath).then((url) => { img.src = url })`. Update file header doc-comment to point at the new bridge and cross-link 11-WIN-FINDINGS §F1.
- `tests/main/ipc.spec.ts` — Extend electron mock with `ipcMainHandleHandlers` Map captor (mirrors `ipcMainOnHandlers` shape). Add 4 tests for `atlas:resolve-image-url`: handler-registered, POSIX-path correctness, Windows-path correctness (regression), non-string-payload rejection.
- `tests/renderer/atlas-preview-modal.spec.tsx` — Add `vi.stubGlobal('api', { pathToImageUrl: ... })` in `beforeEach` so the existing 11 modal-rendering tests no longer crash on `Cannot read properties of undefined (reading 'pathToImageUrl')`. Add 3 algorithmic F1 regression tests (positive Windows + positive POSIX + buggy-shape anti-test).

## Decisions Made

- **D-19 IPC-invoke variant ships unconditionally.** RESEARCH Open Question 1 was pre-resolved at plan time. Renderer awaits / `.then()`s the result. No synchronous preload variant.
- **Cross-platform handler hardening (Rule 2):** drive-letter regex + `{ windows: true }`. Default `pathToFileURL` is platform-dependent and would mis-shape Windows paths on macOS/Linux hosts.
- **Renderer .then() shape, NOT await:** keeps `loadImage`'s synchronous return contract intact. HTMLImageElement is cached + returned immediately; img.src gets set when the bridge resolves.
- **Type signature added to src/shared/types.ts (Api interface) — NOT src/preload/index.d.ts as plan listed:** the .d.ts only augments Window; the Api type lives in shared/types.ts.
- **Anti-test for buggy shape:** pinned the OLD concat shape's failure modes (Invalid URL throw OR `host='localhostc'`) so a future refactor accidentally re-introducing the concat is caught.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Cross-platform pathToFileURL hardening (drive-letter detection + `{ windows: true }`)**

- **Found during:** Task 1 GREEN verification (the Windows-path IPC test failed on the macOS dev host because default `pathToFileURL` interpreted `'C:\\Users\\Tester\\…'` as a POSIX-relative path — `pathToFileURL('C:\\…').href` produced `'file:///Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/C:%5CUsers%5C…'`)
- **Issue:** Default `pathToFileURL` behavior is platform-dependent. On macOS/Linux it treats Windows-style paths as POSIX-relative + percent-encodes the backslashes + prepends cwd. The plan's IPC test would only have worked on a Windows runner — every other CI leg would have produced wrong-looking URLs that happen to pass on the actual Windows runtime. Worse, a Windows-authored .stmproj opened on a macOS host would silently break the atlas preview AGAIN (re-introducing F1 in a different shape).
- **Fix:** Detect leading drive-letter pattern (`/^[A-Za-z]:[\\\\/]/`) at the top of the IPC handler body; pass `{ windows: true }` to `pathToFileURL` when matched. POSIX paths fall through to default-platform behavior. Both code paths land at the same `app-image://localhost/<pathname>` shape.
- **Files modified:** `src/main/ipc.ts` (handler body), `tests/renderer/atlas-preview-modal.spec.tsx` (positive Windows test uses `{ windows: true }` directly to mirror the IPC handler's selection)
- **Verification:** All 4 Task 1 IPC tests pass on macOS dev host (Node 24); the same algorithm runs unchanged on the 12-02 CI matrix Windows runner where default + `{ windows: true }` converge.
- **Committed in:** `e6558c3` (Task 1 GREEN commit)

**2. [Rule 3 — Blocking] Stubbed window.api.pathToImageUrl in atlas-preview-modal.spec.tsx**

- **Found during:** Task 2 GREEN verification (`npm run test -- --run tests/renderer/atlas-preview-modal.spec.tsx` showed 11 of 14 tests crashing with `TypeError: Cannot read properties of undefined (reading 'pathToImageUrl')`)
- **Issue:** AtlasPreviewModal.tsx now calls `window.api.pathToImageUrl(...)` inside `loadImage`, but the jsdom test environment has no `window.api`. Every `render(<AtlasPreviewModal …/>)` triggered the call inside the LeftRail / AtlasCanvas effect chain.
- **Fix:** Add `vi.stubGlobal('api', { pathToImageUrl: vi.fn(async (p) => `app-image://localhost${pathToFileURL(p).pathname}`) })` in `beforeEach`; `vi.unstubAllGlobals()` in `afterEach`. Stub mirrors the production main-side handler shape so img.src + onload/onerror callbacks are still exercised. Pattern matches `tests/renderer/save-load.spec.tsx` and `tests/renderer/help-dialog.spec.tsx`.
- **Files modified:** `tests/renderer/atlas-preview-modal.spec.tsx`
- **Verification:** All 14 tests in the file pass (3 new + 11 existing); full suite 384/384 vitest passing.
- **Committed in:** `dc8155c` (Task 2 GREEN commit)

**3. [Rule 1 — Bug] Anti-test failure-mode assertion was too narrow**

- **Found during:** Task 2 RED verification (the anti-test `expect(buggyParsed.host).toBe('localhostc')` threw `TypeError: Invalid URL` because Node 24's WHATWG URL parser is stricter than Chromium's and rejects the malformed `app-image://localhost${encodeURI(winPath)}` outright)
- **Issue:** The plan's expected failure mode (`host='localhostc'`, the Chromium-style permissive parse) was correct for the Electron runtime that originally surfaced F1, but my unit test runs under Node's WHATWG URL — different behavior. The narrow assertion would have falsely passed/failed depending on which environment the test ran in.
- **Fix:** Broadened the anti-test to accept either failure mode (Invalid URL throw OR `host='localhostc'`) as evidence of the bug; both are sufficient because both break the runtime atlas preview. Pinned via a 3-state outcome enum (`'invalid-url' | 'localhostc-host' | 'looks-fine'`) and asserted `outcome !== 'looks-fine'`.
- **Files modified:** `tests/renderer/atlas-preview-modal.spec.tsx` (anti-test only)
- **Verification:** Anti-test passes on Node 24 (outcome = `'invalid-url'`); same shape will pass on Chromium-runtime tests as `'localhostc-host'`.
- **Committed in:** `d92748b` (Task 2 RED commit; subsumed into the next-commit fix when the test was first introduced — see commit body for the broadened anti-test text)

---

**Total deviations:** 3 auto-fixed (1 missing critical, 1 blocking, 1 bug)
**Impact on plan:** All three were necessary for correctness. None added scope beyond the plan's intent (F1 fix at the single audit site). The cross-platform hardening (Deviation #1) is a defensive polish that makes the plan's stated invariants hold across the CI matrix; the test stub (Deviation #2) is the standard renderer-test pattern; the anti-test broadening (Deviation #3) makes the regression evidence environment-agnostic.

## Open Question 1 Resolution

**Open Question 1 from RESEARCH §F1 (sandbox-availability of `node:url` in preload) was pre-resolved at plan time** by shipping the IPC-invoke variant unconditionally. There is no synchronous preload variant. The bridge returns `Promise<string>`; the renderer awaits / `.then()`s the result. The single-source code path eliminates the runtime branch the question would have introduced.

## Windows Verification Status

**Live Windows verification deferred.** Per plan §<verification> step 7 — manual Windows smoke is deferred to either Phase 12.1's spike host (when the publish-race fix lands and the spike runbook executes for real) OR tester rounds. The 12-02 CI matrix [ubuntu-latest, windows-2022, macos-14] runs the regression test on every leg, so the algorithmic correctness is asserted on a real Windows runner, but the end-to-end "open Atlas Preview, see the underlying texture image" smoke requires a packaged Windows .exe install (currently blocked by the deferred-items.md "CI tag-push will fail" entry pending Phase 12.1).

Cross-link: `.planning/phases/11-ci-release-pipeline-github-actions-draft-release/11-WIN-FINDINGS.md` §F1 documents the original symptoms / hypothesis / reproduction that motivated this plan.

## Issues Encountered

- Node 24 WHATWG URL parser is stricter than Chromium's permissive parser. The original buggy URL shape `app-image://localhost${encodeURI('C:\\…')}` throws `TypeError: Invalid URL` on Node 24 but produces `host='localhostc'` on Chromium (Electron's runtime). The anti-test had to broaden its assertion to accept either failure mode. Resolution: see Deviation #3 above.

## Self-Check: PASSED

- [x] `src/main/ipc.ts` exists and contains `ipcMain.handle('atlas:resolve-image-url'` (1 match)
- [x] `src/main/ipc.ts` imports `pathToFileURL` from `'node:url'` (1 import line)
- [x] `src/preload/index.ts` contains `pathToImageUrl:` bridge (1 method) and uses `ipcRenderer.invoke('atlas:resolve-image-url'` (1 line)
- [x] `src/preload/index.ts` does NOT import `pathToFileURL` (only 2 doc-comment references)
- [x] `src/shared/types.ts` declares `pathToImageUrl(absolutePath: string): Promise<string>` on Api
- [x] `src/renderer/src/modals/AtlasPreviewModal.tsx` calls `window.api.pathToImageUrl` (1 call site at L143)
- [x] `src/renderer/src/modals/AtlasPreviewModal.tsx` does NOT contain literal `` `app-image://localhost${encodeURI(absolutePath)}` `` anywhere
- [x] `src/renderer/src/modals/AtlasPreviewModal.tsx` does NOT import `node:url`
- [x] `tests/renderer/atlas-preview-modal.spec.tsx` contains a test matching `/F1 regression.*Windows/i`
- [x] `tests/renderer/atlas-preview-modal.spec.tsx` asserts `parsed.host).toBe('localhost')` and references `localhostc` (anti-test)
- [x] All 4 task commits exist in `git log`: `97dd77d`, `e6558c3`, `d92748b`, `dc8155c`
- [x] `npm run test` exits 0 (384 passing, 1 skipped, 1 todo)
- [x] `npm run typecheck:web` exits 0
- [x] `npm run typecheck:node` shows ONLY the pre-existing `scripts/probe-per-anim.ts` deferred-items failure (carried forward from Phase 11/12 per deferred-items.md)

## Next Phase Readiness

- **F1 closed.** Atlas Preview now constructs `app-image://` URLs through a single, well-tested main-side handler.
- **Plan 12-04 (F2 file-picker UX) unblocked.** Wave 2 sequencing is satisfied (12-01 → 12-03 → 12-04 → 12-05 → 12-06 per phase plan). 12-04 should land next per ROADMAP.
- **Phase 12.1 dependency:** Atlas Preview is one of the basic-sanity smoke checks called out for the Windows install runbook. With F1 fixed, the spike host (whenever the publish-race fix lands and the runbook executes) can verify Atlas Preview as a real-runtime check.
- **No new blockers introduced.** The pre-existing "CI tag-push will fail" deferred-items entry remains in force — DO NOT push tags until Phase 12.1 lands the publish-race fix.

---
*Phase: 12-auto-update-tester-install-docs*
*Completed: 2026-04-27*

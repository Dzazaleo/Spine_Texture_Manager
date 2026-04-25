---
phase: 07-atlas-preview-modal
plan: 06
subsystem: gap-fix-renderer-modal
tags: [phase-07, gap-fix, renderer, canvas, electron-protocol, human-verify, d-139]
requirements-completed: [F7.1, F7.2]
status: complete
---

# Plan 07-06 — Gap-fix UAT close-out

## What landed

Six tasks executed across eight atomic commits. The plan opened with two diagnostic-then-fix loops (Task 1+2 for Gap 1; Task 3+4 for Gaps 2/3/4) and added two follow-up fixes during live UAT (mid-UAT Gate 8 regression; post-UAT user feedback on canvas frame stability + oversize handling). Final state: all four originally-recorded gaps closed, plus two new improvements (always-fixed maxPageDim×maxPageDim canvas frame; oversize-region warning banner) landed and verified.

## Tasks completed

| # | Task | Commit | Notes |
|---|---|---|---|
| 1 | Diagnostic instrumentation (5 `[atlas-preview-debug]` logs) | 094bbf6 | Logs at 4 hypothesis points + 1 main-process protocol.handle. User ran `npm run dev`, dropped fixture, opened modal, pasted DevTools console + main-terminal logs. |
| 2 | Gap 1 fix (Branch A renderer URL + Rule 4 deviation: `net.fetch`→`fs.readFile`) | 2723e19 + 436bcfd | Two-stage fix: first the `net.fetch(file://)` swap (Rule 4 deviation; the plan's Branch B regex strip would not have helped because `net.fetch` itself was the broken path), then Branch A's `localhost` host prefix when subsequent UAT showed `pathname` was losing the leading `/Users` segment under empty-host parsing. |
| 3 | Gap 2 + Gap 4 (auto-fit canvas) | bdd1918 → b4439cd → b85b587 | Evolved across UAT: started as hardcoded `aspect-[1/1]` (correct for square pages), then dynamic `aspectRatio: page.w/page.h` (mid-UAT Gate 8 regression — non-square bins re-stretched), finally locked at always-fixed `maxPageDim × maxPageDim` frame after user feedback ("always show the full square, even if 99% is unused"). |
| 4 | Gap 3 (hover dimensions line) | 7b28778 | Single-line edit appending `ctx.fillText(\`${Math.round(region.w)} × ${Math.round(region.h)}\`, region.x + 4, region.y + 28)` after the existing attachmentName fillText. |
| 5 | Diagnostic cleanup (remove all `[atlas-preview-debug]` logs) | 146f7c3 | Removed 5 logs across 2 files; reverted `img.onerror = (event) => {` → `() => {`; collapsed `catch (err) {` → `catch {` in main protocol.handle. `git grep "atlas-preview-debug" -- src/` returns 0. |
| 6 | Human-verify UAT signoff | (this commit) | All 8 verifiable gates pass; 2 deferred with explicit rationale (Gate 9 fixture limitation, Gate 10 broad-scope sweep). |

## Live-UAT-driven additions (not in original plan)

| What | Commit | Why |
|---|---|---|
| Always-fixed `maxPageDim × maxPageDim` canvas frame | b85b587 | User feedback: "atlas pages jumping" between pager clicks and override flow because the tight-fit packer (D-132 `pot:false, square:false`) produced different bin sizes per page. Resolution: canvas backing-store + display frame are now always the user-selected page-cap; empty space stays visible so users can compare utilization across configurations. |
| Oversize-region filter + warning banner | b85b587 | User feedback: "images that are big and do not fit into 2048 atlas, are being deformed to fit. This is incorrect. Is omething like this happens, it is best do ignore them and issue a warning." Resolution: `AtlasPreviewProjection.oversize: string[]` field added to type; `buildAtlasPreview` filters inputs whose `packW > maxPageDim || packH > maxPageDim` before `packer.add`; modal renders a danger-token banner above canvas when array is non-empty. Parity-applied in both `core/atlas-preview.ts` AND `renderer/src/lib/atlas-preview-view.ts` per D-124. |

## Five INVARIANTS preserved (Plan 06 frontmatter contract)

- ✅ **Layer 3:** `git diff -- 'src/core/'` shows only `atlas-preview.ts` changes (zero new imports; no `node:fs` / `sharp` / `electron` / DOM); `tests/arch.spec.ts` Layer 3 grep still passes.
- ✅ **BrowserWindow security pins:** `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` literal grep gates green in `src/main/index.ts`.
- ✅ **Scheme registration timing:** `protocol.registerSchemesAsPrivileged([...])` still at module load BEFORE `app.whenReady()` resolves.
- ✅ **CSP shape:** `img-src 'self' data: app-image:` is the only directive that knows about `app-image:`; defensive `! grep -F` checks for `default-src/script-src/font-src` containing `app-image:` all green.
- ✅ **Image-cache key shape:** `imageCacheRef.current.set(absolutePath, img)` — keyed by absolutePath, NOT the full URL.

## Phase 5 D-102 + CLAUDE.md rule #3

- ✅ `git diff scripts/cli.ts` empty (CLI byte-for-byte unchanged across all 8 commits).
- ✅ `git diff src/core/sampler.ts` empty (sampler tick lifecycle untouched).

## Verification block

```bash
# Layer-3 + lock-file invariants
git diff scripts/cli.ts                      # empty
git diff src/core/sampler.ts                 # empty

# CSP + BrowserWindow security pins
grep -F "sandbox: true" src/main/index.ts                                # OK
grep -F "contextIsolation: true" src/main/index.ts                       # OK
grep -F "nodeIntegration: false" src/main/index.ts                       # OK
grep -F "img-src 'self' data: app-image:" src/renderer/index.html        # OK

# Substantive fixes present
grep -F "app-image://localhost" src/renderer/src/modals/AtlasPreviewModal.tsx     # Task 2 Branch A
grep -F "readFile" src/main/index.ts                                              # Task 2 Rule-4 deviation
grep -F "Math.round(region.w)" src/renderer/src/modals/AtlasPreviewModal.tsx      # Task 4
grep -F "Math.round(region.h)" src/renderer/src/modals/AtlasPreviewModal.tsx      # Task 4
grep -F "region.y + 28" src/renderer/src/modals/AtlasPreviewModal.tsx             # Task 4
grep -F "aspect-[1/1]" src/renderer/src/modals/AtlasPreviewModal.tsx              # Task 3 final form
grep -F "frameDim" src/renderer/src/modals/AtlasPreviewModal.tsx                  # b85b587 fixed-frame
grep -F "oversize" src/core/atlas-preview.ts                                      # b85b587 oversize filter
grep -F "oversize" src/renderer/src/lib/atlas-preview-view.ts                     # b85b587 parity
grep -F "oversize" src/shared/types.ts                                            # b85b587 type

# Diagnostic cleanup (Task 5)
! git grep "atlas-preview-debug" -- src/                                          # 0 matches

# Image-cache key shape preserved
grep -F "imageCacheRef.current.set(absolutePath, img)" src/renderer/src/modals/AtlasPreviewModal.tsx  # OK

# Full automated suite
npm run typecheck:web                       # exit 0
npm run typecheck:node                      # exit 0 modulo pre-existing deferred scripts/probe-per-anim.ts TS2339
npm run test                                # 240 passed | 1 skipped | 1 todo (was 239 — added oversize-filter test)
npx electron-vite build                     # green
```

## Threat mitigations applied

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-07-06-csp-regression | mitigate | ✅ CSP shape preserved; defensive grep gates green. |
| T-07-06-sandbox-regression | mitigate | ✅ Three pin literals all present in `src/main/index.ts`. |
| T-07-06-protocol-traversal | accept | ✅ Trust boundary stays at Phase 1 loader's sibling-path validation. The Rule 4 deviation (`net.fetch` → `fs.readFile`) does not widen which paths are reachable; `readFile(filePath)` reads only paths derived from `decodeURIComponent(url.pathname)` which the renderer constructs from absolute paths the loader already validated. Defense-in-depth path-prefix allow-list deferred (RESEARCH §Security Domain V5). |
| T-07-06-diagnostic-leak | mitigate | ✅ Task 5 cleanup mandatory — `! git grep "atlas-preview-debug" -- src/` returns 0. |
| T-07-06-layer-3-violation | mitigate | ✅ `git diff -- 'src/core/'` touches only `atlas-preview.ts` (parity edit); zero new imports; arch.spec Layer 3 grep green. |

## Key lessons

1. **`net.fetch(file://)` is unreliable inside Electron's `protocol.handle`.** The `pathToFileURL(...)` → `net.fetch(...)` pattern that the plan's Branch B documented as a defensive form was actually broken on Electron 41 — `net::ERR_UNEXPECTED` immediately on every request. The reliable pattern for serving local files from a custom protocol handler is `fs.readFile + new Response(data, { headers: { 'content-type': '...' } })`. Future phases that register custom file-serving schemes should default to this pattern, not `net.fetch`.

2. **`new URL('app-image:///Users/...')` under `standard: true` privilege parses `Users` as the empty-host slot.** macOS absolute paths begin with `/`, producing the canonical `app-image:///Users/...` triple-slash form. Under `standard: true`, the URL parser interprets the first path segment as the host (lowercased to `users`), consuming `/Users`. Pathname becomes `/leo/...` — not what the renderer intended. Workaround: explicit `localhost` host slot. Future phases that register custom URL schemes for absolute paths must either (a) prepend an explicit host, (b) use a non-standard scheme, or (c) parse `request.url` manually with regex strip.

3. **The dynamic-aspect-ratio wrapper from b4439cd was a half-step.** It correctly preserved aspect ratio for the *current* page, but UX-wise the canvas frame jumped between pager clicks and override flows because the tight-fit packer produces different bin dims per scenario. The user's "always show the full square" feedback resolved this with a stronger invariant: canvas frame is the page-cap, not the bin. The old behavior had been baked into D-139 prematurely; the b85b587 form is the correct lock.

4. **Live UAT surfaces what automation cannot.** Three of the four original gaps + the two follow-up issues all escaped automated gates (typecheck, 239-test suite, arch greps, electron-vite build) and only surfaced when the user dropped the fixture, opened the modal, and reported what they saw. The Phase 1 D-decision that "human-verify gates remain load-bearing for drop flows + IPC surfaces + packaged app launches" continues to hold for canvas + protocol-handler surfaces in Phase 7.

## Phase 7 status

**COMPLETE.** Plan 06 closes the original 4 gaps + 2 follow-up issues; all 8 verifiable UAT gates pass; 2 deferred with explicit rationale (Gate 9 fixture limitation; Gate 10 broad-scope sweep with bounded risk by file-change list).

Next: `/gsd-verify-work 7` (formal Phase 7 verification) or proceed directly to `/gsd-plan-phase 8` per ROADMAP.

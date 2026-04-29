# Phase 13: v1.1.1 polish — Phase 12.1 carry-forwards — Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 8 (1 greenfield doc + 4 in-place edits + 3 git-mv renames)
**Analogs found:** 8 / 8

This phase is **entirely polish + release plumbing**. Two surgical edits to one Electron main file, one append to `CLAUDE.md`, one one-line `package.json` bump, three `git mv` moves of pending → resolved todos, one greenfield phase verification doc mirroring the 12.1 surface, and one in-place flip of the prior phase's `Gaps Summary` entries (PRESERVE-HISTORY pattern). No new test files are mandatory (D-07 leaves a source-grep regression test as Claude's discretion). No CI/build code touched — the `v1.1.1` tag-push exercises the existing pipeline unchanged.

Every modified surface has a direct in-repo precedent from Phase 12 / 12.1, most landed within the last 24 hours of commit history (`d532c34` rc-bump, `ad6d9bf` git-mv-with-section-edit, `b4ed03f` PRESERVE-HISTORY verification flip, `1eadd68` final-bump, `33cf7b3` single-line file edits).

---

## File Classification

| File (G=greenfield, M=modify, R=rename) | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/main/index.ts` (M — `autoHideMenuBar: true → false` at line 339, **and** insert `app.setAboutPanelOptions({...})` block inside `app.whenReady()` callback at line 407) | config (Electron app boot wiring) | request-response | self (existing `BrowserWindow` constructor options block at lines 335-353; existing `app.whenReady().then(() => { ... })` block at lines 407-470 with explicit ordering: protocol.handle → registerIpcHandlers → createWindow → applyMenu → initAutoUpdater) | **exact** (in-file precedent for both edit sites) |
| `CLAUDE.md` (M — append `## Release tag conventions` section) | docs (project notes) | data | self (existing 6-section structure: `## What this project is` / `## Source of truth` / `## Critical non-obvious facts` / `## Test fixture` / `## Folder conventions` / `## Commands` / `## GSD workflow`) | **exact** (in-file precedent — same `## Heading` + paragraph + bulleted/fenced-code style) |
| `package.json` (M — `"version": "1.1.0" → "1.1.1"` single-line + sibling `package-lock.json`) | config (npm manifest) | data | commit `1eadd68` (`chore(12.1): bump version 1.1.0-rc3 → 1.1.0 (final)`) — exact same 1-line `package.json` + 2-line `package-lock.json` shape, exact same single-concern atomic commit | **exact** (commit-history precedent, 36 hours old) |
| `.planning/phases/13-…/13-VERIFICATION.md` (G — phase verification report) | docs (verification report) | data | `.planning/phases/12.1-installer-auto-update-live-verification/12.1-VERIFICATION.md` (143 lines; YAML frontmatter + 9 body sections; PRESERVE-HISTORY pattern) | **exact** (frontmatter shape + body section order — direct mirror) |
| `.planning/phases/12.1-…/12.1-VERIFICATION.md` (M — flip `## Gaps Summary` entries that this phase closes) | docs (in-place frontmatter+body flip) | data | self / `12-VERIFICATION.md` (the 12.1-08 plan landed PRESERVE-HISTORY flips on `12-VERIFICATION.md` frontmatter `human_verification:` array entries — same surgical-flip pattern) | **exact** (in-file + sibling-file precedent) |
| `.planning/todos/pending/2026-04-28-electron-updater-prerelease-channel-mismatch.md` → `resolved/` (R) | docs (todo lifecycle move) | data | commit `ad6d9bf` (`docs(12.1-07)`) — `git mv` of `.../pending/2026-04-28-windows-packaged-build-fails-on-wincodesign-symlink-extract.md` → `.../resolved/` with `## Resolved` section appended; 88% rename similarity | **exact** (commit-history precedent) |
| `.planning/todos/pending/2026-04-28-windows-menu-bar-hidden-by-default-alt-reveals.md` → `resolved/` (R) | docs (todo lifecycle move) | data | same as above | **exact** |
| `.planning/todos/pending/2026-04-28-windows-about-panel-shows-1.1.0.0-not-semver.md` → `resolved/` (R) | docs (todo lifecycle move) | data | same as above | **exact** |
| **OPTIONAL** `tests/main/index.spec.ts` or `tests/integration/main-app-shell.spec.ts` (G — source-grep regression test for `autoHideMenuBar: false` + `setAboutPanelOptions(`) | test | smoke (file-system read + string-match) | `tests/renderer/app-shell-output-picker.spec.tsx` lines 59-86 (the F2 source-grep pattern) AND `tests/integration/install-md.spec.ts` lines 178-181 (already greps `src/main/index.ts` for `'menu:installation-guide-clicked'` literal) | **exact** (two distinct in-repo precedents) |

**Note:** the optional regression test is **D-07 Claude's-discretion** — explicitly listed but NOT mandatory. Plan-time decision per CONTEXT.md §"Claude's Discretion" item 2.

---

## Pattern Assignments

### `src/main/index.ts` (M) — config / request-response

**Analog:** self. Both edit sites already exist in the file as live, exercised code surfaces.

#### Edit site 1: `BrowserWindow` constructor options block (lines 335-353)

**Current state — lines 334-353:**
```typescript
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,        // <— line 339, flip to `false`
    webPreferences: {
      // Preload is emitted as CJS (`.cjs`) per electron.vite.config.ts. Sandbox
      // mode (pinned below) requires a CommonJS preload; an ESM preload under
      // sandbox fails silently, leaving `window.api` undefined in the renderer.
      // Plan 01-03's earlier `.mjs` reference compiled but did not execute
      // under sandbox — caught at Plan 01-05 human-verify, corrected here.
      preload: join(__dirname, '../preload/index.cjs'),
      // D-06 / T-01-02-03: pin explicitly. All three are Electron 2024+ defaults
      // but making them explicit lets code review catch a regression.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
```

**Target — single-character edit on line 339:**
```typescript
    autoHideMenuBar: false,
```

**Pattern guidance:**
- Per D-06: **no** platform-conditional branch (`process.platform === 'win32' ? false : true`). The option is a no-op on macOS by design; an unconditional `false` is cleaner and matches the project-wide policy "no platform-branching" (cited in this same file's header docblock lines 18-21: *"Cross-platform (D-23, D-27): no platform-branching; ... the window uses the default OS frame"*).
- Surrounding comment block (lines 340-352) must remain byte-for-byte unchanged. Only the boolean literal flips.

#### Edit site 2: `app.setAboutPanelOptions({...})` insertion in `app.whenReady()` body (lines 407-470)

**Current state — lines 407-470 (`app.whenReady().then(() => { ... })` callback body) shows the canonical ordering:**
```typescript
app.whenReady().then(() => {
  // Phase 7 D-133 amendment: register the app-image:// protocol handler.
  // ...
  protocol.handle('app-image', async (request) => { /* ... */ });

  registerIpcHandlers();
  createWindow();

  // Phase 8.2 — install initial menu (no project loaded, modal-free).
  // ...
  void applyMenu(currentMenuState, mainWindowRef);

  // Phase 12 Plan 01 Task 5 — auto-update startup wiring (UPD-01 / D-06).
  // initAutoUpdater binds the four electron-updater event listeners
  // ...
  initAutoUpdater();

  app.on('activate', () => { /* ... */ });
});
```

**Target — insert a new call inside the same callback. Recommended position: BEFORE `protocol.handle('app-image', ...)` so the About-panel options are configured before any window or IPC surface comes up. Plan-phase confirms exact placement.**

**Insertion content (per CONTEXT.md §code_context + the carry-forward todo `2026-04-28-windows-about-panel-shows-1.1.0.0-not-semver.md`):**
```typescript
  // Phase 13 — Windows About-panel SemVer fix (carry-forward from 12.1
  // Anti-Pattern #4). Without this, the Windows About dialog reads the
  // win32 FileVersion 4-component padded form (`1.1.1.0`) instead of the
  // SemVer string (`1.1.1`). app.getVersion() reads from package.json at
  // runtime so this stays in sync with the version field automatically.
  // No-op on Windows for fields macOS doesn't support and vice versa, so
  // a single unconditional call configures both platforms (D-06: no
  // platform-conditional branching).
  app.setAboutPanelOptions({
    applicationName: 'Spine Texture Manager',
    applicationVersion: app.getVersion(),
  });
```

**Pattern guidance:**
- Mirror the existing in-file convention of a 5-10 line docblock above each numbered/dated `// Phase N — ...` insertion (see existing examples at lines 32-37, 84-93, 280-289, 295-300, 455-461). The plan-phase comment should cite the carry-forward todo as provenance.
- The `app` import at line 26 already covers `app.setAboutPanelOptions` and `app.getVersion()` — no new import needed.
- Anti-pattern (per D-06): do NOT wrap in `if (process.platform === 'win32') { ... }`. The Electron docs explicitly state `setAboutPanelOptions` is a no-op for unsupported fields per OS; the unconditional call works correctly cross-platform.

**Combined edit shape:** D-06 says both fixes "land in a single atomic edit to `src/main/index.ts`". One commit covering line-339 flip AND the `setAboutPanelOptions` insertion is the canonical shape (mirrors 12-04 / 12-05 / 12.1-06 / 12.1-07 single-block atomic-edit precedent).

---

### `CLAUDE.md` (M) — docs / data

**Analog:** self. The file already has 7 `## ` top-level sections (mapped in `<env>` via `grep ^##`):
- L3 `## What this project is`
- L7 `## Source of truth`
- L14 `## Critical non-obvious facts (do not relitigate)`
- L23 `## Test fixture`
- L27 `## Folder conventions (do not misread)`
- L32 `## Commands`
- L40 `## GSD workflow`

Each section is short (3-12 lines) and follows the pattern: `## Heading` + 1-line orienting sentence + bulleted list (numbered or dashes) + optional inline backtick code references. No essays. No fenced code blocks except in `## Commands`.

**Insertion position decision** (Claude's-Discretion per CONTEXT.md §decisions item 1, "exact placement of the new CLAUDE.md `Release tag conventions` section"):

Two candidate positions; recommendation in PATTERN priority order:

| Position option | Rationale | Recommended? |
|---|---|---|
| Between `## Critical non-obvious facts` (L14-21) and `## Test fixture` (L23) | The new section is also a "non-obvious fact" — a constraint on a future operation (tag pushes) rooted in upstream tooling (electron-updater + semver). Sits with the other constraints. | **PREFERRED** |
| After `## GSD workflow` (L40) at end of file | Append-only is mechanically simpler; no risk of disturbing existing content. | acceptable fallback |

**Section content shape** (per CONTEXT.md §specifics: "5-10 lines max; one ✅ example, one ❌ example, one-line rationale, one cross-link. No essay."):

```markdown
## Release tag conventions

Prerelease tags MUST use **dot-separated** number suffixes:

- ✅ `v1.2.0-rc.1` — semver parses as `["rc", 1]`; electron-updater 6.x channel-match works.
- ❌ `v1.2.0-rc1`  — semver parses as `["rc1"]` (single opaque token); rc1 → rc2 auto-update silently fails.

Rationale: `electron-updater@6.x`'s GitHub provider compares prerelease tokens as channel names; `"rc1" === "rc2"` is `false`, so an installed `v1.2.0-rc1` cannot detect `v1.2.0-rc2`. Final → final and final → prerelease paths are unaffected.

See `.planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md` for the full root cause walkthrough.
```

**Pattern guidance:**
- Match existing `CLAUDE.md` tone: terse, factual, "do not relitigate" voice. No apology, no fanfare, no narrative. Mirror the imperative-mood opening style used by `## Folder conventions (do not misread)` ("`fixtures/` — exported Spine JSON ...").
- The cross-link target points to `resolved/` (post-move location) — order Plan 13 tasks so the `git mv` lands BEFORE this section's cross-link is committed, OR commit them together in the same atomic commit so the link target exists at the moment the section becomes visible.
- Anti-pattern: do NOT introduce a CONTRIBUTING.md just for this. CLAUDE.md is the right home (consistent with how `## Folder conventions` and `## Commands` already live there).

---

### `package.json` (M) — config / data

**Analog:** commit `1eadd68` — `chore(12.1): bump version 1.1.0-rc3 → 1.1.0 (final)`. Exact same 1-line `package.json` edit (line 3 only) + 2-line `package-lock.json` edit (lines 3 + 9). Same atomic-commit discipline ("1 commit per concern, rc-bump and final-bump separate" — D-Discretion item 4).

**Concrete diff shape (verbatim from `git show 1eadd68`):**
```diff
diff --git a/package.json b/package.json
@@ -1,6 +1,6 @@
 {
   "name": "spine-texture-manager",
-  "version": "1.1.0-rc3",
+  "version": "1.1.0",
   "private": true,

diff --git a/package-lock.json b/package-lock.json
@@ -1,12 +1,12 @@
 {
   "name": "spine-texture-manager",
-  "version": "1.1.0-rc3",
+  "version": "1.1.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "spine-texture-manager",
-      "version": "1.1.0-rc3",
+      "version": "1.1.0",
       "dependencies": {
```

**Target diff for Phase 13:**
```diff
-  "version": "1.1.0",
+  "version": "1.1.1",
```
(applied to `package.json` line 3 + `package-lock.json` lines 3 and 9)

**Mechanism:** the canonical project way is `npm version 1.1.1 --no-git-tag-version` (mirrors how `1eadd68` was produced — npm updates both manifests atomically). Manual edit is also acceptable; the only requirement is byte-equivalence between the two files' `version:` fields.

**Commit message shape** (mirror `1eadd68`): `chore(13): bump version 1.1.0 → 1.1.1`. Optional rationale paragraph in the body — for v1.1.1 the body should reference the 4 carry-forwards being closed (CONTEXT.md §domain "In scope (Phase 13)" enumerates them).

**Anti-pattern:** do NOT bundle the version bump with code edits. D-Discretion item 4 explicitly cites the 12.1-02 split (rc-bump and final-bump as separate commits) as the proven shape — version bumps are their own concern.

---

### `.planning/phases/13-…/13-VERIFICATION.md` (G) — docs / verification report

**Analog:** `.planning/phases/12.1-installer-auto-update-live-verification/12.1-VERIFICATION.md` (143 lines). Same project, same author, written 24 hours ago by the 12.1-08 plan. Direct mirror.

**Frontmatter shape (lines 1-9 of `12.1-VERIFICATION.md`):**
```yaml
---
phase: 12.1-installer-auto-update-live-verification
verified: 2026-04-28T21:30:00Z
status: passed_partial
score: 6/8 ROADMAP success criteria fully verified live; 2/8 carried forward to v1.1.1 (Linux runbook deferred — no host; rc→rc auto-update lifecycle blocked by electron-updater channel-matching bug, manual-upgrade path verified instead)
overrides_applied: 0
re_verification: null  # 12.1 is its own initial verification
human_verification: []  # 9 items folded back into 12-VERIFICATION.md per PRESERVE-HISTORY pattern
---
```

**Body section order (verbatim from `12.1-VERIFICATION.md`):**
1. `# Phase X: <name> — Verification Report` (title)
2. `**Phase Goal:**` quote (verbatim from ROADMAP §<this phase> goal block)
3. `**Verified:** <ISO-8601>` / `**Status:** <state>` / `**Re-verification:** <text>`
4. `## Goal Achievement` paragraph
5. `### Observable Truths (from ROADMAP Success Criteria SC-1 through SC-N)` — table
6. `### Required Artifacts` — table
7. `### Key Link Verification` — table
8. `### Behavioral Spot-Checks` — table
9. `### Requirements Coverage` — table
10. `### Anti-Patterns Found` — numbered list
11. `### Human Verification Required` paragraph (often "Empty" with PRESERVE-HISTORY note)
12. `### Gaps Summary` paragraph
13. Trailing italics: `_Verified: <ts>_` / `_Verifier: Claude (gsd-executor)_`

**Phase 13-specific shaping:**
- `score:` field — Phase 13 has no ROADMAP SC of its own (per CONTEXT.md §canonical_refs: *"REQUIREMENTS.md — Phase 13 closes none of them — it's a polish round, not a new requirement surface"*). The score line should instead enumerate the 4 carry-forwards closed: `4/4 Phase 12.1 carry-forwards landed (autoHideMenuBar flip + setAboutPanelOptions block + CLAUDE.md docs + 3 todos resolved); v1.1.1 published successfully via CI`. Live-UAT items (Linux + auto-update lifecycle) are explicitly deferred to Phase 13.1 per D-01 split — the `## Gaps Summary` documents this with a forward-pointer.
- `human_verification: []` — Phase 13 is documentation + tag-push closure; no human-verified items beyond the Phase 13.1 deferrals (which are tracked there, not here).
- `### Anti-Patterns Found` — likely empty for Phase 13 (carry-forwards from 12.1's anti-patterns are being CLOSED here, not new ones discovered).
- `### Gaps Summary` — points forward to Phase 13.1 for the deferred Linux + lifecycle UAT items. Same pattern as 12.1's Gaps Summary which pointed forward to v1.1.1 (the present phase).

**Anti-pattern:** do NOT recreate codebase-level evidence already present in `12.1-VERIFICATION.md`. 13-VERIFICATION.md focuses on Phase 13's NEW closures: 4 code/doc edits + v1.1.1 publication + ROADMAP/STATE updates.

---

### `.planning/phases/12.1-…/12.1-VERIFICATION.md` (M — in-place flip) — docs / PRESERVE-HISTORY

**Analog:** the 12.1-08 plan itself (PLAN at `.planning/phases/12.1-installer-auto-update-live-verification/12.1-08-PLAN.md`, executed in commit `b4ed03f`). That plan flipped `12-VERIFICATION.md` `human_verification:` array entries in-place by APPENDING `result:` / `verified_in:` / `transcript:` fields without removing original `test:` / `expected:` / `why_human:` fields.

**Phase 13's surface differs slightly** — instead of YAML array entries, the targets are markdown table rows + `## Gaps Summary` paragraphs in `12.1-VERIFICATION.md`. The PRESERVE-HISTORY *principle* still applies (annotate, don't overwrite). Concrete shapes per CONTEXT.md §decisions D-08:

**Targets in `12.1-VERIFICATION.md`:**

| Current state (in `12.1-VERIFICATION.md`) | What Phase 13 flips | Annotation pattern |
|---|---|---|
| Anti-Pattern #1 (line 109): "Per-OS rc-channel naming convention falsified electron-updater compatibility... Captured as v1.1.1 polish todo `.planning/todos/pending/2026-04-28-electron-updater-prerelease-channel-mismatch.md`" | Append: ` **RESOLVED in Phase 13 — see `.planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md` and CLAUDE.md §Release tag conventions.**` | Append-only; existing text untouched |
| Anti-Pattern #3 (line 113): "Windows menu hidden by default... Captured as v1.1.1 polish todo `.planning/todos/pending/2026-04-28-windows-menu-bar-hidden-by-default-alt-reveals.md`" | Append: ` **RESOLVED in Phase 13 — `autoHideMenuBar: false` shipped at `src/main/index.ts:339` (commit `<sha>`); live verification deferred to Phase 13.1.**` | Append-only |
| Anti-Pattern #4 (line 115): "Windows About panel shows win32 file metadata version (`1.1.0.0`)... Captured as v1.1.1 polish todo `.planning/todos/pending/2026-04-28-windows-about-panel-shows-1.1.0.0-not-semver.md`" | Append: ` **RESOLVED in Phase 13 — `app.setAboutPanelOptions(...)` shipped at `src/main/index.ts` (commit `<sha>`); live verification deferred to Phase 13.1.**` | Append-only |
| `### Gaps Summary` polish-todos list (lines 129-134): "v1.1.1 polish todos captured this round (3 total): Linux libfuse2 PNG capture / electron-updater rc-channel naming convention / Windows `autoHideMenuBar` / Windows About panel" | Append a new sub-paragraph: `**Phase 13 closure update (2026-04-28):** rc-channel naming convention, `autoHideMenuBar`, and About panel todos all resolved (see Phase 13 plans). Linux libfuse2 PNG + live auto-update lifecycle UAT deferred to Phase 13.1.` | Append-only sub-paragraph |

**Anti-pattern (carry-forward from 12.1-D-08 PRESERVE-HISTORY discipline):**
- DO NOT remove or rewrite the original "Captured as v1.1.1 polish todo `.../pending/...`" sentences — they are the historical record showing the deferral round-trip (12.1 captured → 13 closed).
- DO NOT change `12.1-VERIFICATION.md` frontmatter `status: passed_partial` or `score:` — Phase 12.1 itself remains passed_partial (the deferrals were real at that time); Phase 13's closure is recorded as inline annotations + by Phase 13's own VERIFICATION doc.
- DO NOT touch any of the other 12.1-VERIFICATION.md sections (Goal Achievement, Observable Truths, Required Artifacts, Key Link Verification, Behavioral Spot-Checks, Requirements Coverage). Only the 4 surfaces above gain append-only annotations.
- DO NOT modify the `_Verified: 2026-04-28T21:30:00Z_` trailing footer — that timestamp records the original 12.1 verification.

---

### `.planning/todos/pending/<3 files>.md` → `.planning/todos/resolved/` (R x3) — docs / lifecycle move

**Analog:** commit `ad6d9bf` — `docs(12.1-07): document Windows winCodeSign symlink papercut in README`. Single atomic commit covered:
- 1 README.md edit (the user-visible fix)
- 1 `git mv` of `.planning/todos/pending/2026-04-28-windows-packaged-build-fails-on-wincodesign-symlink-extract.md` → `.planning/todos/resolved/`
- 1 append of a `## Resolved` section to the moved file

**Verified rename mechanics from that commit (88% rename similarity per CONTEXT.md §code_context):**
```bash
git mv .planning/todos/pending/<filename>.md \
       .planning/todos/resolved/<filename>.md
```

After the move, append a `## Resolved` section at the bottom (verbatim style from the existing resolved file at `.planning/todos/resolved/2026-04-28-windows-packaged-build-fails-on-wincodesign-symlink-extract.md` lines 45-49):

```markdown

---

## Resolved

2026-04-28 — Phase 13 Plan <NN>: <one-sentence summary of what landed where>. <Optional second sentence about live-verification deferral if applicable.>
```

**Three concrete moves for Phase 13:**

| Source path | Destination path | `## Resolved` section content (drafted) |
|---|---|---|
| `.planning/todos/pending/2026-04-28-electron-updater-prerelease-channel-mismatch.md` | `.planning/todos/resolved/<same>.md` | `2026-04-28 — Phase 13 Plan <NN>: CLAUDE.md gained a `## Release tag conventions` section documenting `v1.2.0-rc.1` ✅ vs `v1.2.0-rc1` ❌ with one-line rationale and a cross-link back to this resolved todo. Workflow-level regex guard intentionally deferred to v1.2+ per D-05; CLAUDE.md docs are sufficient for a single-developer project.` |
| `.planning/todos/pending/2026-04-28-windows-menu-bar-hidden-by-default-alt-reveals.md` | `.planning/todos/resolved/<same>.md` | `2026-04-28 — Phase 13 Plan <NN>: src/main/index.ts:339 `autoHideMenuBar: true` flipped to `false` (unconditional, no platform branch per D-06; macOS ignores the flag). Live verification on a real Windows host deferred to Phase 13.1.` |
| `.planning/todos/pending/2026-04-28-windows-about-panel-shows-1.1.0.0-not-semver.md` | `.planning/todos/resolved/<same>.md` | `2026-04-28 — Phase 13 Plan <NN>: src/main/index.ts gained `app.setAboutPanelOptions({ applicationName, applicationVersion: app.getVersion() })` inside `app.whenReady()` (unconditional per D-06). Windows About panel will read SemVer `1.1.1` instead of win32 FileVersion `1.1.1.0`. Live verification on a real Windows host deferred to Phase 13.1.` |

**Commit-coupling pattern (per `ad6d9bf` precedent):** each `git mv` lands in the SAME commit as the user-visible fix it tracks. CONTEXT.md §decisions §Folded Todos enumerates the coupling:
- `electron-updater-prerelease-channel-mismatch.md` rename is coupled with the CLAUDE.md edit (D-05).
- `windows-menu-bar-hidden-by-default-alt-reveals.md` rename is coupled with the `autoHideMenuBar: false` edit (D-06).
- `windows-about-panel-shows-1.1.0.0-not-semver.md` rename is coupled with the `setAboutPanelOptions` edit (D-06).

The two `index.ts` edits both land in a single atomic commit per D-06 ("both fixes land in a single atomic edit to `src/main/index.ts`"), so the two associated `git mv` operations also bundle into that same commit. Net Phase 13 atomic-commit shape:
1. **Commit A** — `src/main/index.ts` (2 surgical edits) + 2 `git mv` operations + 2 `## Resolved` appends.
2. **Commit B** — `CLAUDE.md` append + 1 `git mv` + 1 `## Resolved` append.
3. **Commit C** — `package.json` + `package-lock.json` (single-concern version bump per D-Discretion item 4 / 12.1-02 precedent).
4. **Commit D** — `13-VERIFICATION.md` greenfield + `12.1-VERIFICATION.md` PRESERVE-HISTORY flip + `STATE.md` + `ROADMAP.md` (the Phase 12.1-08 close-out shape mapped to Phase 13).
5. **Tag push** `v1.1.1` — no commit; CI does its thing.

Plan-phase confirms exact commit-grouping; the above is the proven shape.

**Anti-pattern guards (carried forward from 12.1-07):**
- DO NOT modify the original Problem / Solution / Cross-references sections of the moved todo files. The historical record stays intact.
- DO NOT delete files outright — `git mv` ensures atomicity and 88%+ rename similarity preserves blame history.
- DO NOT create duplicate todo files in `pending/` after the move. `git mv` is single-step; verify with `git status --short .planning/todos/` showing `R` (rename) prefix not separate `D` + `A`.

---

### **OPTIONAL** Source-grep regression test (G — Claude's discretion per D-07)

CONTEXT.md §decisions D-07 and §Claude's Discretion item 2 leave this as a plan-time judgment call. Both candidate analogs exist in the repo and proven-working:

#### Analog #1: `tests/renderer/app-shell-output-picker.spec.tsx` lines 59-86 (the F2 source-grep pattern)

The cleanest "lock the boolean flip out of the codebase" precedent. Test reads the source file as a UTF-8 string, strips comments, then asserts the buggy literal is absent. Direct copy template:

```typescript
import { describe, test, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

describe('Phase 13 regression: src/main/index.ts cosmetic Windows fixes locked in', () => {
  test('autoHideMenuBar is false (Windows menu bar visible by default)', async () => {
    const srcPath = resolve(__dirname, '..', '..', 'src', 'main', 'index.ts');
    const src = await readFile(srcPath, 'utf8');
    // Strip comments so a docblock referencing the old value doesn't false-trigger.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n');
    expect(codeOnly).toMatch(/autoHideMenuBar:\s*false/);
    expect(codeOnly).not.toMatch(/autoHideMenuBar:\s*true/);
  });

  test('app.setAboutPanelOptions is called with applicationVersion: app.getVersion()', async () => {
    const srcPath = resolve(__dirname, '..', '..', 'src', 'main', 'index.ts');
    const src = await readFile(srcPath, 'utf8');
    expect(src).toMatch(/app\.setAboutPanelOptions\s*\(\s*\{/);
    expect(src).toMatch(/applicationVersion:\s*app\.getVersion\(\)/);
  });
});
```

#### Analog #2: `tests/integration/install-md.spec.ts` lines 177-181 (the D-16 surface-grep pattern)

Already-shipped pattern that greps `src/main/index.ts` for IPC channel literals. Same shape, less ceremony (no comment-stripping):

```typescript
test('Surface 3a — Help menu has Installation Guide… item', () => {
  const text = read('src/main/index.ts');
  expect(text).toContain('Installation Guide');
  expect(text).toContain("'menu:installation-guide-clicked'");
});
```

**Recommendation per D-07:** if the plan adopts a regression test, prefer Analog #1's shape (`describe` + comment-stripping) for the `autoHideMenuBar` flip — that flip is a boolean literal change, exactly the regression class the F2 source-grep pattern was designed for. The `setAboutPanelOptions` call surface is more naturally tested by Analog #2's shape (presence-of-string assertion). Combining them in a single `describe('Phase 13 regression: ...')` block at `tests/main/index-options.spec.ts` (or `tests/integration/main-app-shell.spec.ts`) is the lowest-friction shape.

**Decision pressure:** the cost of the test is ~30 LOC and one new spec file; the value is locking a UX-cosmetic-but-tester-impacting flip out of future careless refactors. Plan-phase pick.

---

## Shared Patterns

### Atomic single-block edit pattern

**Source:** commits `33cf7b3` (12.1-06 single-line INSTALL.md edits + Sequoia rewrite), `ad6d9bf` (12.1-07 README append + git mv), `1eadd68` (12.1 final-bump), `60ace0b` / `b4ed03f` (12.1-08 verification flip).

**Apply to:** all 4 Phase 13 commit groupings (A/B/C/D enumerated above).

**Concrete excerpt** (commit `ad6d9bf` summary message + diff stat):
```
docs(12.1-07): document Windows winCodeSign symlink papercut in README

[...one paragraph rationale, one paragraph 3 ranked workarounds, one
paragraph closes-SC + provenance + verbatim error excerpt note...]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

 ...d-build-fails-on-wincodesign-symlink-extract.md |  6 ++++
 README.md                                          | 35 ++++++++++++++++++++++
 2 files changed, 41 insertions(+)
```

**Pattern:**
- Commit subject: `<type>(<phase>-<plan>): <imperative summary>` (e.g., `fix(13-01): flip autoHideMenuBar to false + set About-panel SemVer`)
- Body: 1-3 paragraphs (rationale / mechanism / verification or anti-pattern note). NEVER skip the rationale — it's the audit-trail anchor.
- Trailing `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` per project convention.
- Diff stat fits on one line per file (single-block atomic; if a commit's diff stat shows >5 files, the commit is over-bundled).

### `git mv` lifecycle pattern (88% rename similarity)

**Source:** commit `ad6d9bf` (12.1-07).

**Apply to:** all 3 todo file moves in Phase 13.

**Mechanic:**
```bash
git mv .planning/todos/pending/<filename>.md \
       .planning/todos/resolved/<filename>.md
# THEN edit the moved file to append `## Resolved` section
# THEN git add the moved file with the appended section
# THEN commit (coupled with the user-visible fix per CONTEXT.md §decisions §Folded Todos)
```

**Verification post-commit:**
```bash
git status --short .planning/todos/   # MUST show `R` rename, not `D` + `A`
git log --oneline --follow -- .planning/todos/resolved/<filename>.md
                                      # MUST show pre-rename commit history reachable
```

### PRESERVE-HISTORY flip pattern

**Source:** commit `b4ed03f` (12.1-08), Plan `12.1-08-PLAN.md` Task 2.

**Apply to:** `12.1-VERIFICATION.md` in-place flip (Phase 13 closes 3 of 4 carry-forwards).

**Principle:** when a downstream phase closes an upstream phase's deferred items, ANNOTATE the upstream record (append `result:` / `verified_in:` / commit-SHA references / inline RESOLVED markers) — do NOT overwrite or rewrite the deferral text. The deferral itself is historically true at the time it was written; its closure is a NEW historical event that decorates without erasing.

**Concrete excerpt** (from 12-VERIFICATION.md after 12.1-08's flip — the YAML-array variant; Phase 13 applies the markdown-table variant):
```yaml
- test: "macOS auto-update happy path (UPD-01..UPD-04, ROADMAP SC #1)"
  expected: "Install v1.1.0 .dmg → publish v1.1.1 → relaunch v1.1.0 → modal appears..."
  why_human: "Requires real CI publish of a newer release with latest-mac.yml feed file..."
  result: passed                          # ← APPENDED by 12.1-08
  verified_in: 12.1-VERIFICATION.md       # ← APPENDED
  transcript: "rc2 install verified..."   # ← APPENDED
```

For Phase 13's markdown-prose targets (Anti-Pattern #1/#3/#4 in `12.1-VERIFICATION.md`), the appended marker is a bold inline `**RESOLVED in Phase 13 — <details>.**` sentence at end of the existing prose, following the same APPEND-only discipline.

### Single-concern atomic commit pattern

**Source:** commits `d532c34` + `0dd573b` + `1eadd68` (12.1-02's three rc-version-bumps, each its own commit).

**Apply to:** Phase 13's `package.json` version bump (Commit C — own commit, no other concerns bundled).

**Principle:** version bumps and tag pushes are their own concerns, separate from code/docs concerns. The 12.1-02 plan landed three version-bump commits across 16 hours, each a clean 2-file diff (package.json + package-lock.json), each with a single-line subject + 1-paragraph body explaining the next-action (rc tag push or final tag push).

**Concrete excerpt** (commit `1eadd68` body):
```
chore(12.1): bump version 1.1.0-rc3 → 1.1.0 (final)

Plan 12.1-02 Task 3 alternate path. The rc2 → rc3 auto-update test failed
empirically: electron-updater@6.8.3 with allowPrerelease:true on a private-
turned-public repo couldn't promote rc2 → rc3 [...rationale...]

Refs: UPD-06, SC-1, SC-2, SC-4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

For Phase 13's bump, a similar shape:
```
chore(13): bump version 1.1.0 → 1.1.1

Phase 13 closes 3 of 4 v1.1.1 polish carry-forwards from 12.1:
autoHideMenuBar flip (Windows menu visibility), setAboutPanelOptions
(Windows About SemVer), and rc-channel naming convention docs in
CLAUDE.md. Live UAT (Linux runbook + auto-update lifecycle) split to
Phase 13.1 per CONTEXT.md D-01.

Refs: <none new — Phase 13 closes carry-forwards, opens no new requirements>.
```

---

## No Analog Found

None. Every Phase 13 surface has a direct in-repo precedent — the phase is **entirely** a polish/release round leveraging Phase 12 + 12.1 patterns.

---

## Metadata

**Analog search scope:**
- `src/main/index.ts` (full file read, 478 lines)
- `CLAUDE.md` (full file read, 47 lines)
- `package.json` (header lines)
- `.planning/phases/12.1-installer-auto-update-live-verification/12.1-VERIFICATION.md` (full file read, 143 lines)
- `.planning/phases/12.1-installer-auto-update-live-verification/12.1-08-PLAN.md` (full file read)
- `.planning/phases/12.1-installer-auto-update-live-verification/12.1-07-PLAN.md` (full file read)
- `.planning/phases/12.1-installer-auto-update-live-verification/12.1-PATTERNS.md` (head 120 lines for cross-reference)
- `.planning/todos/resolved/2026-04-28-windows-packaged-build-fails-on-wincodesign-symlink-extract.md` (full)
- `.planning/todos/pending/2026-04-28-windows-menu-bar-hidden-by-default-alt-reveals.md` (full)
- `tests/renderer/app-shell-output-picker.spec.tsx` (full)
- `tests/integration/install-md.spec.ts` (lines 100-235 sampled)
- Git history: commits `ad6d9bf`, `d532c34`, `1eadd68`, `b4ed03f`, `33cf7b3`, `60ace0b` inspected via `git show --stat`

**Files scanned:** 12

**Pattern extraction date:** 2026-04-28

---
phase: 16-macos-auto-update-manual-download-ux
plan: 04
type: execute
wave: 2
depends_on: ["16-01"]
files_modified:
  - src/main/ipc.ts
  - tests/integration/auto-update-shell-allow-list.spec.ts
autonomous: true
requirements: [UPDFIX-05]
must_haves:
  truths:
    - "shell.openExternal allows the index URL `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` (backward-compat for Phase 12 D-18 + Plan 14-05 regression gate)"
    - "shell.openExternal allows any well-formed `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v{version}` URL where `{version}` is templated by deliverUpdateAvailable from `info.version` (Phase 16 D-04)"
    - "shell.openExternal REJECTS arbitrary `github.com` URLs (e.g. `https://github.com/attacker/repo/releases`, `https://github.com/Dzazaleo/Spine_Texture_Manager/issues`)"
    - "shell.openExternal REJECTS URL-spoofing attempts where the hostname is NOT `github.com` (e.g. `https://github.com.attacker.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.3`)"
    - "shell.openExternal REJECTS non-https schemes for the releases gate (e.g. `http://github.com/Dzazaleo/Spine_Texture_Manager/releases`)"
    - "Existing non-releases allow-list entries (Spine docs URLs, INSTALL.md URL) continue to work unchanged"
  artifacts:
    - path: "src/main/ipc.ts"
      provides: "isReleasesUrl helper + extended SHELL_OPEN_EXTERNAL_ALLOWED match logic"
      exports: ["isReleasesUrl (module-private; kept private but referenced by the open-external handler)"]
    - path: "tests/integration/auto-update-shell-allow-list.spec.ts"
      provides: "Vitest coverage that the index URL still passes, the per-release tag URL passes, and arbitrary github.com URLs / hostname-spoofs are rejected"
      contains: "describe('Phase 16 D-04"
  key_links:
    - from: "src/main/ipc.ts shell:open-external handler"
      to: "src/main/auto-update.ts deliverUpdateAvailable fullReleaseUrl payload (Plan 16-03)"
      via: "Renderer click on 'Open Release Page' invokes window.api.openExternalUrl(payload.fullReleaseUrl); main allow-list MUST accept what main itself sends"
      pattern: "isReleasesUrl|/releases/tag/v"
---

<objective>
Widen the SHELL_OPEN_EXTERNAL_ALLOWED gate in src/main/ipc.ts so that the per-release
templated URL emitted by deliverUpdateAvailable (Plan 16-03) passes the trust-boundary
check WITHOUT loosening the gate enough to allow arbitrary github.com URLs or hostname-
spoofing attacks.

Implementation per CONTEXT.md D-04 + threat model (this plan owns the allow-list
widening): introduce a small helper `isReleasesUrl(url): boolean` that does a `URL`-parse
plus a structural hostname + pathname check, and consult the helper FIRST in the
shell:open-external handler before falling back to the existing `Set.has` exact-string
membership check (which preserves the existing Spine-docs + INSTALL.md entries).

Backward-compat is explicitly required:
- The index URL `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` MUST still
  match (the Phase 14 Plan 14-05 URL-consistency regression gate asserts this URL is
  present in src/main/ipc.ts as a literal — leaving the existing
  `SHELL_OPEN_EXTERNAL_ALLOWED` Set entry intact satisfies that gate).
- The per-release URL `/releases/tag/v{version}` MUST also match (new for Phase 16).

Then extend tests/integration/auto-update-shell-allow-list.spec.ts to cover the new
shape AND the threat model (URL spoofing attempts, hostname mismatch, arbitrary github
URLs).

This plan addresses CONTEXT.md D-04 (per-release URL allow-list widening) and the
mandatory threat model from the security gate in the orchestration prompt.

Purpose: Trust-boundary widening WITHOUT introducing a path-traversal / open-redirect
vulnerability. The structural check defends against substring-abuse that a naive
`pathname.startsWith` would allow.

Output: src/main/ipc.ts with a new `isReleasesUrl` helper + extended handler logic, and
tests/integration/auto-update-shell-allow-list.spec.ts extended with a Phase 16 D-04
describe block covering both the happy paths AND the threat model.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md
@CLAUDE.md
@src/main/ipc.ts
@tests/integration/auto-update-shell-allow-list.spec.ts

<interfaces>
<!-- Current SHELL_OPEN_EXTERNAL_ALLOWED Set in src/main/ipc.ts (lines 162-184): -->

```ts
const SHELL_OPEN_EXTERNAL_ALLOWED: ReadonlySet<string> = new Set<string>([
  // Spine documentation references that HelpDialog (Plan 07) links to.
  'https://esotericsoftware.com/spine-runtimes',
  'https://esotericsoftware.com/spine-api-reference',
  'https://en.esotericsoftware.com/spine-json-format',
  // Phase 12 Plan 01 (D-09 + D-18 option (b)) — the Releases _index_ page is
  // the stable URL surface for the UpdateDialog "View full release notes" link
  // AND the Windows-fallback "Open Release Page" button.
  'https://github.com/Dzazaleo/Spine_Texture_Manager/releases',
  // Phase 12 Plan 06 (D-16.4 + D-18 option b) — INSTALL.md URL on main is
  // the stable URL surface for the in-app "Installation Guide…" Help menu
  // item AND HelpDialog's "Install instructions" inline link.
  'https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md',
]);
```

<!-- Current handler in src/main/ipc.ts (lines 653-662): -->

```ts
ipcMain.on('shell:open-external', (_evt, url) => {
  if (typeof url !== 'string' || url.length === 0) return;
  if (!SHELL_OPEN_EXTERNAL_ALLOWED.has(url)) return;
  try {
    void shell.openExternal(url);
  } catch {
    // shell.openExternal can throw on platforms where the default browser
    // is misconfigured. Silent — one-way channel; nothing to return.
  }
});
```

<!-- Current existing test asserts (tests/integration/auto-update-shell-allow-list.spec.ts) -->
<!-- pertain to URL-consistency across 3 files. Phase 16 ADDS a new describe block -->
<!-- covering the structural-check shape AND the threat model. The existing 4 tests -->
<!-- (14-p, 14-q, 14-r, 14-s) STAY GREEN because the index URL literal is preserved -->
<!-- in src/main/ipc.ts and src/main/auto-update.ts. -->

<!-- Phase 16 semver pattern for the path component: anchored, dot-separated, no slashes. -->
<!-- Allowed shapes (from existing project release tags): v1.2.0, v1.2.0-rc.1, v1.2.0-rc.10, -->
<!-- v0.5.3, v10.20.30, etc. -->
<!-- The semver regex below matches `v` followed by major.minor.patch with optional dot- -->
<!-- separated prerelease (per CLAUDE.md release tag conventions: `v1.2.0-rc.1` ✅, never -->
<!-- `v1.2.0-rc1` — but this allow-list is permissive about the prerelease shape; defense -->
<!-- in depth, the version that actually templates here comes from electron-updater's -->
<!-- info.version which is itself parsed from a published release tag). -->

<!-- The CRITICAL threat is URL-spoofing via hostname tricks. Parse with new URL() -->
<!-- and check `parsed.hostname === 'github.com'` (NOT `endsWith('.github.com')` which -->
<!-- would allow `attacker.github.com`; NOT `includes('github.com')` which would allow -->
<!-- `github.com.attacker.com`). The exact-equals on hostname is the trust anchor. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend the shell-allow-list test with Phase 16 D-04 coverage (RED first)</name>
  <files>tests/integration/auto-update-shell-allow-list.spec.ts</files>
  <read_first>
    - tests/integration/auto-update-shell-allow-list.spec.ts (entire file — to understand the existing test shape and avoid breaking the 4 existing tests 14-p / 14-q / 14-r / 14-s)
    - src/main/ipc.ts (lines 162–184 + 653–662 — to understand the current Set + handler shape that the new tests will validate against)
    - .planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md (D-04 + threat model from the security gate prompt)
  </read_first>
  <behavior>
    - Test 1 (16-a): The existing index URL `https://github.com/Dzazaleo/Spine_Texture_Manager/releases`
      passes the gate (backward-compat — exact-string Set.has match preserves Phase 12 D-18 +
      Plan 14-05 regression-gate behavior).
    - Test 2 (16-b): A per-release tag URL `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0`
      passes the gate (Phase 16 D-04 — happy path).
    - Test 3 (16-c): A per-release tag URL with a dotted-prerelease segment
      `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0-rc.1` passes
      the gate (CLAUDE.md release-tag convention: dotted prerelease is canonical).
    - Test 4 (16-d): An arbitrary github.com URL outside the project's repo/releases
      surface (e.g. `https://github.com/Dzazaleo/Spine_Texture_Manager/issues`) is REJECTED.
    - Test 5 (16-e): An arbitrary github.com URL on a different repo (e.g.
      `https://github.com/attacker/Spine_Texture_Manager/releases/tag/v1.2.0`) is REJECTED.
    - Test 6 (16-f): A hostname-spoofing URL (e.g.
      `https://github.com.attacker.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0`)
      is REJECTED.
    - Test 7 (16-g): A subdomain-spoofing URL (e.g.
      `https://attacker.github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0`)
      is REJECTED.
    - Test 8 (16-h): A non-https scheme (e.g.
      `http://github.com/Dzazaleo/Spine_Texture_Manager/releases`) is REJECTED.
    - Test 9 (16-i): The existing 3 Spine-docs URLs continue to pass the gate
      (`https://esotericsoftware.com/spine-runtimes`, etc.) — regression check that
      Phase 16 widening did not break the Set.has fallback.
    - Test 10 (16-j): The existing INSTALL.md URL continues to pass
      (`https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md`).
  </behavior>
  <action>
    Per CONTEXT.md D-04 + the security threat model in the orchestration prompt, add
    a NEW describe block at the bottom of tests/integration/auto-update-shell-allow-list.spec.ts:

    ```ts
    /**
     * Phase 16 D-04 — Allow-list widening regression gate (UPDFIX-05).
     *
     * The shell-open-external trust boundary widens to accept per-release tag URLs
     * of the form `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v{version}`.
     * The widening MUST NOT allow:
     *   - Arbitrary repo paths under the project's URL surface (issues, pulls, wiki).
     *   - Different repos on the same hostname (attacker/Spine_Texture_Manager).
     *   - Hostname-spoofing (`github.com.attacker.com`, `attacker.github.com`).
     *   - Non-https schemes.
     *
     * This spec drives Plan 16-04 Task 2's `isReleasesUrl` helper. The helper does
     * a structural URL.parse + hostname-equals check + pathname-prefix check rather
     * than a naive string-prefix match (which would silently allow URL spoofing).
     *
     * Test approach: import the `isReleasesUrl` helper directly (Plan 16-04 Task 2
     * exports it ONLY for the test surface — `@internal` JSDoc to mark it as not
     * part of the public src/main/ipc.ts API). Each spec asserts the boolean
     * return.
     */
    import { isReleasesUrl } from '../../src/main/ipc.js';

    describe('Phase 16 D-04 — releases-URL structural allow-list widening', () => {
      it('(16-a) the index URL still passes (Phase 12 D-18 backward-compat)', () => {
        expect(isReleasesUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/releases')).toBe(true);
      });

      it('(16-b) per-release tag URL with simple semver passes (D-04 happy path)', () => {
        expect(isReleasesUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0')).toBe(true);
      });

      it('(16-c) per-release tag URL with dotted-prerelease passes (CLAUDE.md release-tag convention)', () => {
        expect(isReleasesUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0-rc.1')).toBe(true);
      });

      it('(16-d) issues URL on the project repo is REJECTED (path-prefix narrowness)', () => {
        expect(isReleasesUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/issues')).toBe(false);
      });

      it('(16-e) different-repo /releases URL is REJECTED (path-prefix narrowness)', () => {
        expect(isReleasesUrl('https://github.com/attacker/Spine_Texture_Manager/releases/tag/v1.2.0')).toBe(false);
      });

      it('(16-f) hostname-spoofed URL `github.com.attacker.com` is REJECTED (T-16-04 mitigated)', () => {
        expect(isReleasesUrl('https://github.com.attacker.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0')).toBe(false);
      });

      it('(16-g) subdomain-spoofed URL `attacker.github.com` is REJECTED (T-16-04 mitigated)', () => {
        expect(isReleasesUrl('https://attacker.github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0')).toBe(false);
      });

      it('(16-h) non-https scheme is REJECTED (T-16-04 mitigated)', () => {
        expect(isReleasesUrl('http://github.com/Dzazaleo/Spine_Texture_Manager/releases')).toBe(false);
      });

      it('(16-i) malformed URL strings return false (T-16-04 — URL parse failure path)', () => {
        expect(isReleasesUrl('not a url')).toBe(false);
        expect(isReleasesUrl('')).toBe(false);
        expect(isReleasesUrl('javascript:alert(1)')).toBe(false);
      });
    });
    ```

    The 4 existing tests (14-p, 14-q, 14-r, 14-s) are NOT modified. They survive
    because:
    - 14-p / 14-q / 14-s all reference the literal index URL, which Plan 16-03
      retains in src/main/auto-update.ts (constant `GITHUB_RELEASES_INDEX_URL`)
      and Plan 16-04 retains in src/main/ipc.ts (Set entry).
    - 14-r asserts `auto-update.ts contains 'GITHUB_RELEASES_INDEX_URL'` and the
      RELEASES_INDEX_URL literal — both retained per Plan 16-03 Task 3.

    Note the import statement: `import { isReleasesUrl } from '../../src/main/ipc.js';`
    — this drives Task 2's contract (Task 2 exports the helper).

    Self-check after edit (test should be RED until Task 2 lands):
    - The new describe block is appended at the bottom of the file.
    - The new tests reference `isReleasesUrl` which does not yet exist.
    - `npm test -- tests/integration/auto-update-shell-allow-list.spec.ts` MUST
      FAIL with an import error or `isReleasesUrl is not a function` — this is
      the EXPECTED RED state for TDD.
  </action>
  <verify>
    <automated>grep -c "describe('Phase 16 D-04" tests/integration/auto-update-shell-allow-list.spec.ts | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; grep -c "isReleasesUrl" tests/integration/auto-update-shell-allow-list.spec.ts | awk '$1>=10 {exit 0} {exit 1}' &amp;&amp; grep -c "(16-a)\|(16-b)\|(16-c)\|(16-d)\|(16-e)\|(16-f)\|(16-g)\|(16-h)\|(16-i)" tests/integration/auto-update-shell-allow-list.spec.ts | awk '$1>=9 {exit 0} {exit 1}'</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "describe('Phase 16 D-04" tests/integration/auto-update-shell-allow-list.spec.ts` returns ≥ `1`
    - `grep -c "isReleasesUrl" tests/integration/auto-update-shell-allow-list.spec.ts` returns ≥ `10` (1 import + 9 expects)
    - The 9 spec ids `(16-a)` through `(16-i)` all appear in the file (verify by grep — `grep -c "(16-[a-i])" tests/integration/auto-update-shell-allow-list.spec.ts` returns ≥ `9`)
    - The 4 existing spec ids `(14-p)` `(14-q)` `(14-r)` `(14-s)` are still present unchanged (`grep -c "(14-[pqrs])" ...` returns ≥ `4`)
    - The test file itself is structurally valid (Task 2 follow-up will validate that the suite passes)
  </acceptance_criteria>
  <done>
    The new Phase 16 D-04 describe block is appended; 9 RED tests describe the
    expected isReleasesUrl behavior including the threat-model coverage; the
    existing 4 Phase 14 tests are untouched. Test file is structurally complete
    but the suite fails because Task 2 has not yet exported `isReleasesUrl`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement isReleasesUrl helper + integrate with shell:open-external handler (GREEN)</name>
  <files>src/main/ipc.ts</files>
  <read_first>
    - src/main/ipc.ts (lines 140–184 — existing SHELL_OPEN_EXTERNAL_ALLOWED Set declaration + docblock; lines 645–662 — existing shell:open-external handler)
    - tests/integration/auto-update-shell-allow-list.spec.ts (the just-added Task 1 RED tests — implementation must turn all 9 GREEN AND keep the 4 Phase 14 tests GREEN)
    - .planning/phases/16-macos-auto-update-manual-download-ux/16-CONTEXT.md (D-04 — leans toward URL-parse + structural check)
  </read_first>
  <behavior>
    - `isReleasesUrl(url: string): boolean` returns `true` iff:
      1. `url` is a syntactically valid URL parseable by `new URL(url)`.
      2. `parsed.protocol === 'https:'`.
      3. `parsed.hostname === 'github.com'` (exact match, no subdomain, no spoofing).
      4. `parsed.pathname` is either:
         - exactly `/Dzazaleo/Spine_Texture_Manager/releases`, OR
         - matches `/Dzazaleo/Spine_Texture_Manager/releases/tag/v{semver}` where
           `{semver}` is a non-empty version string (defensive but permissive — the
           hostname check is the trust anchor; the version segment is sourced from
           electron-updater's `info.version` and validated upstream).
    - All malformed URLs (parse failures, empty strings, non-string inputs at the
      handler level) return `false`.
    - The helper is exported from src/main/ipc.ts ONLY for the test surface — mark
      `/** @internal — exported for tests/integration/auto-update-shell-allow-list.spec.ts */`
      so the export intent is documented.
    - The shell:open-external handler integrates the helper: try the existing Set.has
      check FIRST (preserves the Spine-docs + INSTALL.md + index URL entries
      unchanged), fall back to `isReleasesUrl(url)` for the per-release URL match.
      Either match path is acceptable; both must reject malformed/spoofed input.
  </behavior>
  <action>
    Per CONTEXT.md D-04 + the security threat model, add the helper and wire it into
    the existing handler.

    Step 1: Add the helper near the existing SHELL_OPEN_EXTERNAL_ALLOWED Set
    declaration (insert directly AFTER the Set declaration, before the existing
    `validateExportPlan` function — currently around line 184, after the closing
    `]);` of the Set):

    ```ts
    /**
     * Phase 16 D-04 — releases-URL structural allow-list helper.
     *
     * Returns `true` iff `url` is a well-formed https URL on the github.com host
     * targeting either:
     *   - The project's Releases index page
     *     (`/Dzazaleo/Spine_Texture_Manager/releases`), OR
     *   - A specific release tag page
     *     (`/Dzazaleo/Spine_Texture_Manager/releases/tag/v{version}`).
     *
     * Threat model — the structural check (URL-parse + hostname-equals +
     * pathname-prefix) defends against:
     *   - T-16-04-01 (URL-spoofing): naive `pathname.startsWith` without a
     *     hostname check would allow `https://github.com.attacker.com/Dzazaleo/...`
     *     because the malicious hostname has the project pathname as a substring.
     *     The exact-equals on `parsed.hostname` blocks this.
     *   - T-16-04-02 (subdomain-spoof): `https://attacker.github.com/...` blocked
     *     by exact-equals on hostname (NOT endsWith / includes).
     *   - T-16-04-03 (open-redirect via crafted info.version): malformed semver
     *     smuggled through `releases/tag/v${info.version}` — the helper does
     *     NOT execute or open the URL itself, only votes pass/reject. The
     *     pathname-prefix guard is permissive about the version segment shape
     *     because info.version is sourced from electron-updater (which itself
     *     parses a published release tag string); defense in depth here would
     *     be excessive vs. the parser at the source. If a malformed version
     *     reaches this code, the outcome is "URL opens but lands on a 404
     *     GitHub page" — not a privilege escalation.
     *   - T-16-04-04 (scheme-downgrade): non-https schemes blocked by exact-equals
     *     on `parsed.protocol`.
     *   - T-16-04-05 (parse failure): malformed URL strings (e.g. "not a url",
     *     "javascript:alert(1)", "") return false via the try/catch around `new URL`.
     *
     * @internal — exported for tests/integration/auto-update-shell-allow-list.spec.ts
     * (Plan 16-04 Task 1). Not part of the public src/main/ipc.ts API; do NOT
     * re-export from index modules.
     */
    export function isReleasesUrl(url: string): boolean {
      if (typeof url !== 'string' || url.length === 0) return false;
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return false;
      }
      if (parsed.protocol !== 'https:') return false;
      if (parsed.hostname !== 'github.com') return false;
      // Pathname check — accept the index page exactly, OR any release-tag page
      // under the project's namespace. The trailing-slash variant is rejected
      // for the index URL to keep byte-for-byte agreement with Plan 14-05's
      // URL-consistency regex (which asserts no trailing slash on the canonical
      // literal).
      if (parsed.pathname === '/Dzazaleo/Spine_Texture_Manager/releases') return true;
      if (parsed.pathname.startsWith('/Dzazaleo/Spine_Texture_Manager/releases/tag/v')) {
        // Pathname after the prefix must be a non-empty version segment with no
        // additional slashes (defensive: a `/releases/tag/v1.2.0/extra/path`
        // is NOT a release page on github.com — the actual GitHub URL shape
        // ends at the tag).
        const versionSegment = parsed.pathname.slice(
          '/Dzazaleo/Spine_Texture_Manager/releases/tag/v'.length,
        );
        if (versionSegment.length === 0) return false;
        if (versionSegment.includes('/')) return false;
        return true;
      }
      return false;
    }
    ```

    Step 2: Update the shell:open-external handler at lines ~653–662 to consult
    `isReleasesUrl` AFTER the Set.has fallback (or — equivalently — replace the
    single-check line with an OR):

    REPLACE:
    ```ts
    ipcMain.on('shell:open-external', (_evt, url) => {
      if (typeof url !== 'string' || url.length === 0) return;
      if (!SHELL_OPEN_EXTERNAL_ALLOWED.has(url)) return;
      try {
        void shell.openExternal(url);
      } catch {
        // shell.openExternal can throw on platforms where the default browser
        // is misconfigured. Silent — one-way channel; nothing to return.
      }
    });
    ```

    WITH:
    ```ts
    ipcMain.on('shell:open-external', (_evt, url) => {
      if (typeof url !== 'string' || url.length === 0) return;
      // Phase 16 D-04 — accept either:
      //   (a) an exact-string match against the existing Set (Spine docs URLs +
      //       INSTALL.md URL + the Releases index URL — the legacy Phase 12 D-18
      //       allow-list shape), OR
      //   (b) a structural match for a /releases/tag/v{version} URL on github.com
      //       (Phase 16 D-04 — per-release URL emitted by deliverUpdateAvailable).
      // The structural check (isReleasesUrl) defends against URL-spoofing tricks
      // that a naive prefix match would allow. The Set.has check is preserved
      // for backward-compat with Phase 12 D-18 + Plan 14-05 URL-consistency gate.
      if (!SHELL_OPEN_EXTERNAL_ALLOWED.has(url) && !isReleasesUrl(url)) return;
      try {
        void shell.openExternal(url);
      } catch {
        // shell.openExternal can throw on platforms where the default browser
        // is misconfigured. Silent — one-way channel; nothing to return.
      }
    });
    ```

    Step 3: The existing `SHELL_OPEN_EXTERNAL_ALLOWED` Set is UNCHANGED — the index URL
    `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` MUST stay as a Set
    member because Plan 14-05 URL-consistency regression gate (test `(14-q)` /
    `(14-s)` at tests/integration/auto-update-shell-allow-list.spec.ts:46–87) asserts
    that ipc.ts contains the literal string. Removing it would regress that test.

    Self-check after edit:
    - `grep -c "isReleasesUrl" src/main/ipc.ts` MUST return ≥3 (declaration + handler
      use + (optionally) docblock reference).
    - `grep -c "export function isReleasesUrl" src/main/ipc.ts` MUST return ≥1.
    - `grep -c "https://github.com/Dzazaleo/Spine_Texture_Manager/releases" src/main/ipc.ts` MUST
      return ≥1 (the existing Set entry preserved — Plan 14-05 (14-q)/(14-s) gate).
    - `npm test -- tests/integration/auto-update-shell-allow-list.spec.ts` MUST
      exit 0 (all 9 new + 4 existing tests pass).
    - `npm run typecheck` MUST exit 0.
  </action>
  <verify>
    <automated>grep -c "export function isReleasesUrl" src/main/ipc.ts | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; grep -c "isReleasesUrl" src/main/ipc.ts | awk '$1>=3 {exit 0} {exit 1}' &amp;&amp; grep -c "https://github.com/Dzazaleo/Spine_Texture_Manager/releases" src/main/ipc.ts | awk '$1>=1 {exit 0} {exit 1}' &amp;&amp; npm run typecheck &amp;&amp; npm test -- tests/integration/auto-update-shell-allow-list.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "export function isReleasesUrl" src/main/ipc.ts` returns ≥ `1`
    - `grep -c "isReleasesUrl" src/main/ipc.ts` returns ≥ `3` (declaration + handler use + docblock or test-export attribution)
    - `grep -c "https://github.com/Dzazaleo/Spine_Texture_Manager/releases" src/main/ipc.ts` returns ≥ `1` (legacy Set entry retained)
    - `grep -c "parsed.hostname !== 'github.com'" src/main/ipc.ts` returns ≥ `1` (the trust-anchor exact-equals check is present)
    - `grep -c "parsed.protocol !== 'https:'" src/main/ipc.ts` returns ≥ `1` (the scheme check is present)
    - `npm run typecheck` exits 0
    - `npm test -- tests/integration/auto-update-shell-allow-list.spec.ts` exits 0 (all 13 tests pass: 4 Phase 14 + 9 Phase 16 D-04)
  </acceptance_criteria>
  <done>
    The `isReleasesUrl` helper is implemented with the URL-parse + hostname-equals
    + pathname-prefix structural check. The shell:open-external handler accepts
    EITHER a Set.has hit OR an isReleasesUrl true. The threat model is satisfied:
    URL spoofing, subdomain spoofing, scheme downgrade, and parse failures all
    return false. The 9 Phase 16 D-04 tests pass; the 4 Phase 14 tests still pass
    (URL-consistency regression gate intact).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| renderer → main → shell.openExternal | Renderer click on UpdateDialog "Open Release Page" button forwards a string URL to main. Main MUST validate before passing to shell.openExternal — `shell.openExternal` with arbitrary user-controlled input is a documented Electron sandbox-escape vector. The URL crosses the IPC boundary as a renderer-supplied payload (even though main itself emitted it earlier via deliverUpdateAvailable, defense-in-depth requires re-validating at the entry point). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-16-04-01 | Spoofing/Tampering | `isReleasesUrl` URL parsing | mitigate | Use `new URL()` + exact-equals on `parsed.hostname` (`=== 'github.com'`). Naive `pathname.startsWith` without a hostname check would silently allow `https://github.com.attacker.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.3` because the malicious hostname has the legitimate pathname as a substring. Hostname-exact-equals blocks both this attack AND any subdomain-spoof (`attacker.github.com`). Test (16-f) and (16-g) lock the mitigation. |
| T-16-04-02 | Tampering | `info.version` URL templating in deliverUpdateAvailable | accept | `info.version` is sourced from electron-updater's parse of a published release tag string, NOT from user input. Defense in depth at this layer would require either (a) re-validating semver at the templating site (excessive — already validated upstream) or (b) URL-encoding the version segment (incorrect — release tags are encoded by GitHub's URL conventions, not RFC 3986 percent-encoding). If a crafted `info.version` reaches the URL template, the outcome is "URL opens to a 404 GitHub page" — not privilege escalation. The structural allow-list check (`isReleasesUrl`) at the IPC trust boundary catches any URL that diverges from the expected shape regardless of what was templated. |
| T-16-04-03 | Information Disclosure | shell.openExternal | mitigate | Existing — main wraps the call in try/catch and silently swallows errors per Phase 12 D-18 contract. No leak surface. |
| T-16-04-04 | Elevation of Privilege | non-https scheme | mitigate | `parsed.protocol !== 'https:'` blocks `http://`, `javascript:`, `file://`, `data:`. Test (16-h) locks the mitigation. |
| T-16-04-05 | Denial of Service | malformed URL crashes ipcMain handler | mitigate | The `try/catch` around `new URL(url)` returns `false` on parse failure; the handler short-circuits via `return`. No exception escapes to the IPC ack path. Test (16-i) covers `'not a url'`, `''`, `'javascript:alert(1)'`. |
| T-16-04-06 | Tampering | regression in legacy allow-list entries | mitigate | The existing `SHELL_OPEN_EXTERNAL_ALLOWED` Set is preserved unchanged (Set.has check stays first in the OR). The 4 existing Phase 14 URL-consistency tests (14-p / 14-q / 14-r / 14-s) act as the regression gate — they assert byte-for-byte agreement of the index URL across 3 files. Tests (16-i) and (16-j) cover Spine-docs + INSTALL.md URL pass-through. Severity: low — failure mode is "user clicks an existing in-app link and nothing happens", easily caught by the URL-consistency suite at CI time. |
</threat_model>

<verification>
- `npm test -- tests/integration/auto-update-shell-allow-list.spec.ts` exits 0 (all 13 tests pass).
- `grep -c "export function isReleasesUrl" src/main/ipc.ts` ≥ 1.
- `grep -c "isReleasesUrl(url)" src/main/ipc.ts` ≥ 1 (handler integration).
- `grep -c "https://github.com/Dzazaleo/Spine_Texture_Manager/releases" src/main/ipc.ts` ≥ 1 (Plan 14-05 regression gate alive).
- `npm run typecheck` exits 0.
</verification>

<success_criteria>
- isReleasesUrl helper implemented with URL.parse + hostname-equals + pathname-structural check
- shell:open-external handler integrates the helper without breaking the existing Set.has fast-path
- All 9 new Phase 16 D-04 tests pass (happy paths + threat-model coverage)
- All 4 existing Phase 14 URL-consistency tests still pass (no backward-compat regression)
- Typecheck passes
- Threat model entries T-16-04-01 through T-16-04-06 each have a mitigation in code + a test asserting it
</success_criteria>

<output>
After completion, create `.planning/phases/16-macos-auto-update-manual-download-ux/16-04-SUMMARY.md`
documenting:
- New isReleasesUrl helper signature + docblock summary
- Threat model T-16-04-01..06 mitigation status (each: mitigated by `<file>:<line>` + locked by test `<id>`)
- Test additions (9 specs: 16-a..16-i)
- Test counts before / after (existing 4 → existing 4 + new 9 = 13 passing)
- Set.has + isReleasesUrl fall-through pattern in the handler
</output>
</content>
</invoke>
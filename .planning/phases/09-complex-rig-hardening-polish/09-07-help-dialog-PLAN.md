---
phase: 09-complex-rig-hardening-polish
plan: 07
type: execute
wave: 5
depends_on: ["09-05", "09-06"]
files_modified:
  - src/renderer/src/modals/HelpDialog.tsx
  - src/renderer/src/components/AppShell.tsx
  - tests/renderer/help-dialog.spec.tsx
autonomous: true
requirements: [N2.2]
tags: [phase-9, wave-5, help-dialog, in-app-docs, shell-open-external]

must_haves:
  truths:
    - "HelpDialog mounts when the user clicks Help→Documentation in the menu (event from Plan 05 menu:help-clicked)"
    - "HelpDialog renders 7 canonical sections via static React JSX (no markdown library — RESEARCH §Recommendations #4 zero-XSS-surface choice)"
    - "External links inside HelpDialog invoke window.api.openExternalUrl(url) (Plan 05 bridge); URLs are static, hardcoded, and present in the SHELL_OPEN_EXTERNAL_ALLOWED set in src/main/ipc.ts"
    - "HelpDialog mounts with role=dialog + aria-modal=true so 08.2 D-184 modalOpen derivation auto-disables File menu while open"
    - "tests/renderer/help-dialog.spec.tsx Wave 0 RED scaffolds flip GREEN — dialog mount on menu click + external link triggers openExternalUrl mock"
  artifacts:
    - path: "src/renderer/src/modals/HelpDialog.tsx"
      provides: "In-app help modal with 7 canonical sections + external link buttons"
      contains: "aria-modal=\"true\""
    - path: "src/renderer/src/components/AppShell.tsx"
      provides: "HelpDialog mount + onMenuHelp subscription"
  key_links:
    - from: "AppShell.tsx onMenuHelp useEffect"
      to: "HelpDialog open state"
      via: "window.api.onMenuHelp(() => setHelpOpen(true))"
      pattern: "onMenuHelp"
    - from: "HelpDialog external link click"
      to: "main shell.openExternal via Plan 05 allow-list"
      via: "window.api.openExternalUrl(staticUrl)"
      pattern: "openExternalUrl"
---

<objective>
Land Phase 9 polish deliverable #5 (Documentation in-app help). Single-page React modal with 7 canonical sections per CONTEXT.md Claude's Discretion. Triggered by the Help→Documentation menu item (Plan 05) and surfaces in the renderer alongside existing modals.

Per RESEARCH §Recommendations #4: NO markdown library. The help content is one static React component. Three reasons (RESEARCH §"Markdown rendering options"):
1. **Zero XSS surface** — we author the JSX; no untrusted content path.
2. **Smallest footprint** — ~0 KB runtime vs ~80 KB for react-markdown or ~50 KB for marked + dompurify.
3. **One-time authored content** — adding a build-pipeline for static help content is overkill.

External links (Spine docs, etc.) use `window.api.openExternalUrl(url)` from Plan 05; the URLs MUST be in the `SHELL_OPEN_EXTERNAL_ALLOWED` set in `src/main/ipc.ts`. Plan 07 verifies the URLs it uses are present in that set; if any new URL is added, it MUST be added to the allow-list.

Sections per CONTEXT.md Claude's Discretion + RESEARCH §Recommendations #15:
1. What this app does
2. How to load a rig
3. Reading the Global Max Render Source panel
4. Reading the Animation Breakdown panel
5. How to override a scale
6. How to optimize and export
7. Sampling rate (advanced) — `samplingHz` vs `skeleton.fps`

Section 7 is the critical UX call: it MUST align with the rig-info tooltip wording (Plan 06) and `src/core/sampler.ts:41-44` (CLAUDE.md fact #1). The user reads tooltip + Help dialog and gets the same story.

Output:
- `src/renderer/src/modals/HelpDialog.tsx` (NEW) — modal with 7 static React sections + external link buttons
- `src/renderer/src/components/AppShell.tsx` (or App.tsx — same seam as Plan 06) extended with: onMenuHelp subscription, helpOpen state, HelpDialog mount
- `tests/renderer/help-dialog.spec.tsx` Wave 0 RED → GREEN
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/09-complex-rig-hardening-polish/09-CONTEXT.md
@.planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md
@.planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md
@CLAUDE.md
@src/renderer/src/modals/OverrideDialog.tsx
@src/renderer/src/components/AppShell.tsx
@src/main/ipc.ts

<interfaces>
From src/renderer/src/modals/OverrideDialog.tsx (modal shell shape — analog for HelpDialog):
```tsx
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface OverrideDialogProps {
  open: boolean;
  // ...
  onCancel: () => void;
}

export function OverrideDialog(props: OverrideDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, props.open, { onEscape: props.onCancel });
  if (!props.open) return null;
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="override-title"
         className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
         onClick={props.onCancel}>
      <div className="bg-panel border border-border rounded-md p-6 min-w-[360px] font-mono"
           onClick={(e) => e.stopPropagation()}>
        {/* content */}
      </div>
    </div>
  );
}
```

From Plan 05 SHELL_OPEN_EXTERNAL_ALLOWED set (src/main/ipc.ts):
```ts
const SHELL_OPEN_EXTERNAL_ALLOWED: ReadonlySet<string> = new Set<string>([
  'https://esotericsoftware.com/spine-runtimes',
  'https://esotericsoftware.com/spine-api-reference',
  'https://en.esotericsoftware.com/spine-json-format',
]);
```

If HelpDialog uses URLs not in this set, Plan 05's allow-list MUST be extended in this plan to include them. Edit src/main/ipc.ts to add the new URLs (single-line additions to the Set).

From src/preload/index.ts (Plan 05 added — analog for renderer call):
```ts
openExternalUrl: (url: string): void => {
  ipcRenderer.send('shell:open-external', url);
},
```

From src/core/sampler.ts:41-44 + CLAUDE.md fact #1 — the canonical samplingHz vs skeleton.fps wording:
"editor dopesheet metadata; sampling uses your samplingHz setting (default 120 Hz). The skeleton.fps field on the JSON is INFORMATIONAL ONLY and has zero runtime effect."

The HelpDialog section 7 MUST adopt this wording (or near-identical) so users reading the rig-info tooltip + the Help dialog get a consistent story.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Author HelpDialog component with 7 static sections + external link buttons</name>
  <files>src/renderer/src/modals/HelpDialog.tsx, src/main/ipc.ts</files>
  <read_first>
    - src/renderer/src/modals/OverrideDialog.tsx (modal shell — analog)
    - src/renderer/src/hooks/useFocusTrap.ts (verify hook signature for the modal shell)
    - src/main/ipc.ts (Plan 05 SHELL_OPEN_EXTERNAL_ALLOWED set — verify existing URLs match what HelpDialog will reference; extend if needed)
    - .planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md (§"src/renderer/src/modals/HelpDialog.tsx (NEW — modal, static content)")
    - .planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md (§"Markdown rendering options" + §"Recommendations #4 + #15")
    - src/core/sampler.ts:41-44 (canonical wording for Section 7)
    - CLAUDE.md (fact #1 — skeleton.fps is editor metadata)
  </read_first>
  <behavior>
    - HelpDialog component exists at src/renderer/src/modals/HelpDialog.tsx
    - Component accepts `{ open: boolean; onClose: () => void }` props
    - Mounts with role="dialog", aria-modal="true", aria-labelledby="help-title"
    - Renders 7 sections in a scrollable inner div (max-height bounded so the dialog stays viewport-friendly)
    - Each external link is a `<button>` (NOT an `<a href>` — browsers might intercept the latter; we want a controlled openExternalUrl call)
    - External link buttons call window.api.openExternalUrl(staticUrl) on click
    - All staticUrl values are strings hardcoded at compile time AND present in SHELL_OPEN_EXTERNAL_ALLOWED in src/main/ipc.ts
    - Section 7 contains the literal substring "editor metadata" or "does not affect sampling" (aligned with src/core/sampler.ts:41-44 + Plan 06 tooltip)
    - Cancel/Close button + Escape key + click-outside all dispatch onClose
  </behavior>
  <action>
Step 1. Author src/renderer/src/modals/HelpDialog.tsx:

```tsx
/**
 * Phase 9 Plan 07 — In-app Help / Documentation modal.
 *
 * Static React component per RESEARCH §Recommendations #4 (zero markdown
 * footprint, zero XSS surface). Triggered by the Help→Documentation menu
 * click (Plan 05 D-188 placeholder fill via menu:help-clicked → onMenuHelp).
 *
 * Sections per CONTEXT.md Claude's Discretion + RESEARCH §Recommendations
 * #15:
 *   1. What this app does
 *   2. How to load a rig
 *   3. Reading the Global Max Render Source panel
 *   4. Reading the Animation Breakdown panel
 *   5. How to override a scale
 *   6. How to optimize and export
 *   7. Sampling rate (advanced) — samplingHz vs skeleton.fps
 *
 * Section 7 wording aligns with src/core/sampler.ts:41-44 (CLAUDE.md fact
 * #1) AND with the Plan 06 rig-info tooltip's "editor metadata — does not
 * affect sampling" phrasing.
 *
 * External links use window.api.openExternalUrl(url) — Plan 05 bridge with
 * allow-list defense (T-09-05-OPEN-EXTERNAL). The URLs below MUST be in
 * SHELL_OPEN_EXTERNAL_ALLOWED in src/main/ipc.ts; this file references
 * them by exact string match.
 *
 * 08.2 D-184 — role="dialog" + aria-modal="true" auto-suppress File menu
 * via the existing modalOpen derivation.
 */
import { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

// External link URLs — MUST be present in SHELL_OPEN_EXTERNAL_ALLOWED in
// src/main/ipc.ts. If you add a URL here, also add it there.
const SPINE_RUNTIMES_URL = 'https://esotericsoftware.com/spine-runtimes';
const SPINE_API_REF_URL = 'https://esotericsoftware.com/spine-api-reference';
const SPINE_JSON_FORMAT_URL = 'https://en.esotericsoftware.com/spine-json-format';

export function HelpDialog(props: HelpDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, props.open, { onEscape: props.onClose });

  if (!props.open) return null;

  const openLink = (url: string) => () => {
    window.api.openExternalUrl(url);
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onClose}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 max-w-[700px] max-h-[80vh] overflow-y-auto font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-4">
          <h2 id="help-title" className="text-base font-semibold">Documentation</h2>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close help"
            className="border border-border rounded-md px-2 py-0.5 text-xs"
          >
            Close
          </button>
        </div>

        <section className="mb-4">
          <h3 className="text-sm font-semibold mb-1">1. What this app does</h3>
          <p className="text-xs text-fg-muted">
            Spine Texture Manager reads Spine 4.2+ skeleton JSON and computes the
            peak world-space render scale for every attachment, across every
            animation and skin. Use it to right-size textures per-asset before
            atlas export.
          </p>
        </section>

        <section className="mb-4">
          <h3 className="text-sm font-semibold mb-1">2. How to load a rig</h3>
          <p className="text-xs text-fg-muted">
            Drop a .json file (or its parent folder) onto the app window, or use
            File → Open (Cmd+O / Ctrl+O). The app auto-detects the companion
            .atlas file and images/ folder when they sit next to the JSON.
            See{' '}
            <button type="button" className="underline" onClick={openLink(SPINE_JSON_FORMAT_URL)}>
              Spine JSON format reference
            </button>.
          </p>
        </section>

        <section className="mb-4">
          <h3 className="text-sm font-semibold mb-1">3. Reading the Global Max Render Source panel</h3>
          <p className="text-xs text-fg-muted">
            Each row shows one attachment's peak across all animations + skins.
            Original size is the source PNG dimensions; Max Render Size is the
            largest dimensions the attachment ever needs at runtime; Scale is
            their ratio. Click column headers to sort; type in the search box
            to filter by attachment name.
          </p>
        </section>

        <section className="mb-4">
          <h3 className="text-sm font-semibold mb-1">4. Reading the Animation Breakdown panel</h3>
          <p className="text-xs text-fg-muted">
            One card per animation, plus a "Setup Pose (Default)" card for
            attachments rendered without any animation. Each row inside a card
            shows that attachment's peak DURING THAT ONE ANIMATION — useful for
            tracing why an attachment scales up. Bone Path traces the bone
            chain from root to the attachment's bone.
          </p>
        </section>

        <section className="mb-4">
          <h3 className="text-sm font-semibold mb-1">5. How to override a scale</h3>
          <p className="text-xs text-fg-muted">
            Double-click any peak Scale cell, or click the "Override Scale"
            button on a row. Enter a percentage from 1 to 100 (100% = source
            dimensions; values above 100% silently clamp). Overrides save to
            your .stmproj project file and apply across all panels.
          </p>
        </section>

        <section className="mb-4">
          <h3 className="text-sm font-semibold mb-1">6. How to optimize and export</h3>
          <p className="text-xs text-fg-muted">
            Click "Optimize Assets" to open the export dialog. Pick an output
            folder; the app re-encodes each PNG with sharp's Lanczos3 filter
            at the peak dimensions (or your overridden dimensions). Source
            files are never modified.{' '}
            <button type="button" className="underline" onClick={openLink(SPINE_RUNTIMES_URL)}>
              Spine Runtimes reference
            </button>{' '}
            for re-packing the new images into a fresh atlas.
          </p>
        </section>

        <section className="mb-4">
          <h3 className="text-sm font-semibold mb-1">7. Sampling rate (advanced) — samplingHz vs skeleton.fps</h3>
          <p className="text-xs text-fg-muted">
            The app samples every animation at <span className="font-semibold">samplingHz</span>
            {' '}(default 120 Hz). Higher rates catch sub-frame peaks on easing
            curves at the cost of sampling time. Configure in
            Edit → Preferences (Cmd+, / Ctrl+,).
          </p>
          <p className="text-xs text-fg-muted mt-2">
            The <span className="font-semibold">skeleton.fps</span> value
            shown in the rig-info tooltip is editor metadata — it does not
            affect sampling. It comes from the dopesheet rate the artist used
            in the Spine editor and has zero runtime effect.{' '}
            <button type="button" className="underline" onClick={openLink(SPINE_API_REF_URL)}>
              Spine API reference
            </button>.
          </p>
        </section>
      </div>
    </div>
  );
}
```

Step 2. Verify (and extend if necessary) src/main/ipc.ts SHELL_OPEN_EXTERNAL_ALLOWED.

Read the current set; if all three URLs (SPINE_RUNTIMES_URL, SPINE_API_REF_URL, SPINE_JSON_FORMAT_URL) are already in the set (Plan 05 added them), no change. If any is missing, add it as a single-line addition to the Set.

After this task, the allow-list MUST contain at minimum:
- 'https://esotericsoftware.com/spine-runtimes'
- 'https://esotericsoftware.com/spine-api-reference'
- 'https://en.esotericsoftware.com/spine-json-format'

Step 3. Sanity-check: if HelpDialog adds any link not currently in the allow-list, the runtime test (Task 2) MUST fail because the openExternal mock would not be invoked (the handler silently rejects non-allow-listed URLs). This is the validation harness for Plan 05's allow-list correctness.

`npx tsc --noEmit -p tsconfig.web.json` MUST exit 0.
  </action>
  <verify>
    <automated>test -f src/renderer/src/modals/HelpDialog.tsx &amp;&amp; grep -q "aria-modal" src/renderer/src/modals/HelpDialog.tsx &amp;&amp; grep -q "openExternalUrl" src/renderer/src/modals/HelpDialog.tsx &amp;&amp; grep -q "editor metadata" src/renderer/src/modals/HelpDialog.tsx &amp;&amp; grep -q "does not affect sampling" src/renderer/src/modals/HelpDialog.tsx &amp;&amp; grep -q "esotericsoftware.com/spine-runtimes" src/main/ipc.ts &amp;&amp; npx tsc --noEmit -p tsconfig.web.json</automated>
  </verify>
  <acceptance_criteria>
    - src/renderer/src/modals/HelpDialog.tsx exists; line count ≥ 80
    - HelpDialog renders role="dialog" + aria-modal="true" + aria-labelledby="help-title"
    - HelpDialog renders 7 `<section>` blocks (one per canonical section); each has a heading
    - Section 7 contains the literal substring "editor metadata" AND "does not affect sampling" (load-bearing alignment with Plan 06 + sampler.ts:41-44)
    - HelpDialog's external link buttons call window.api.openExternalUrl(url) where url is a hardcoded string
    - Every URL referenced by HelpDialog is present in SHELL_OPEN_EXTERNAL_ALLOWED in src/main/ipc.ts
    - HelpDialog uses no markdown library imports (no `from 'react-markdown'` / `from 'marked'` / `from 'dompurify'`)
    - Close button + click-outside + Escape (via useFocusTrap onEscape) all dispatch props.onClose
    - npx tsc --noEmit -p tsconfig.web.json exits 0
  </acceptance_criteria>
  <done>HelpDialog component ships with the 7 canonical sections; URLs are allow-listed; Section 7 wording aligns with sampler.ts:41-44 + Plan 06 tooltip.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire HelpDialog into AppShell + flip help-dialog.spec.tsx GREEN</name>
  <files>src/renderer/src/components/AppShell.tsx, tests/renderer/help-dialog.spec.tsx</files>
  <read_first>
    - src/renderer/src/components/AppShell.tsx (existing onMenuOpen / onMenuSettings (Plan 06) subscription pattern; existing modal mount points; same seam choice from Plan 06 — owns SettingsDialog mount, owns HelpDialog mount)
    - src/renderer/src/modals/HelpDialog.tsx (Task 1 — props shape)
    - tests/renderer/help-dialog.spec.tsx (Wave 0 RED scaffold — 2 placeholder tests)
    - tests/renderer/atlas-preview-modal.spec.tsx (jsdom + Testing Library setup analog)
    - .planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md (§"tests/renderer/help-dialog.spec.tsx")
  </read_first>
  <behavior>
    - AppShell.tsx (or App.tsx — same seam as Plan 06) subscribes to window.api.onMenuHelp; click sets `helpOpen = true` (Pitfall 9 cleanup)
    - HelpDialog mounts when helpOpen === true; onClose dispatches setHelpOpen(false)
    - tests/renderer/help-dialog.spec.tsx 2 cases flip GREEN: (a) menu click → dialog mounts with role=dialog + 7 sections present; (b) external link click → openExternalUrl mock called with allow-listed URL
  </behavior>
  <action>
Step 1. Wire HelpDialog into AppShell.tsx (or App.tsx — same seam Plan 06 used):

```tsx
// Phase 9 Plan 07 — Help dialog mount + onMenuHelp subscription.
const [helpOpen, setHelpOpen] = useState(false);

useEffect(() => {
  const unsubscribe = window.api.onMenuHelp(() => setHelpOpen(true));
  return unsubscribe;  // Pitfall 9 + 15 cleanup
}, []);

// Inside the JSX (next to SettingsDialog mount from Plan 06):
<HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
```

Add the import at the top:
```ts
import { HelpDialog } from '../modals/HelpDialog';
```

Step 2. Replace the Wave 0 RED scaffold in tests/renderer/help-dialog.spec.tsx with real assertions:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { HelpDialog } from '../../src/renderer/src/modals/HelpDialog';

afterEach(cleanup);

describe('HelpDialog — Wave 5 (Claude Discretion: in-app help)', () => {
  // Mock window.api so openExternalUrl can be observed.
  const openExternalUrl = vi.fn();

  beforeEach(() => {
    openExternalUrl.mockClear();
    Object.defineProperty(window, 'api', {
      writable: true,
      configurable: true,
      value: { openExternalUrl },
    });
  });

  it('opens with role=dialog labelled Documentation; renders 7 canonical sections', () => {
    render(<HelpDialog open={true} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: /documentation/i });
    expect(dialog).toBeTruthy();
    // 7 sections — each has a numbered heading. Verify all 7 are present.
    const sections = dialog.querySelectorAll('section');
    expect(sections.length).toBe(7);
    // Verify Section 7's load-bearing wording.
    expect(dialog.textContent).toContain('editor metadata');
    expect(dialog.textContent).toContain('does not affect sampling');
  });

  it('clicking an external link invokes window.api.openExternalUrl with an allow-listed URL', () => {
    render(<HelpDialog open={true} onClose={vi.fn()} />);
    // Click the first external link (Spine JSON format reference in Section 2).
    const link = screen.getByRole('button', { name: /spine json format/i });
    fireEvent.click(link);
    expect(openExternalUrl).toHaveBeenCalledTimes(1);
    expect(openExternalUrl).toHaveBeenCalledWith(
      'https://en.esotericsoftware.com/spine-json-format',
    );

    // Click another link — Spine Runtimes in Section 6.
    fireEvent.click(screen.getByRole('button', { name: /spine runtimes/i }));
    expect(openExternalUrl).toHaveBeenCalledTimes(2);
    expect(openExternalUrl).toHaveBeenLastCalledWith(
      'https://esotericsoftware.com/spine-runtimes',
    );
  });

  it('Escape / Close button / click-outside dispatch onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<HelpDialog open={true} onClose={onClose} />);

    // Close button
    fireEvent.click(screen.getByRole('button', { name: /close help/i }));
    expect(onClose).toHaveBeenCalled();
    onClose.mockClear();

    // Re-render then click-outside
    cleanup();
    render(<HelpDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

Run `npm run test tests/renderer/help-dialog.spec.tsx`. All 3 cases MUST GREEN.

Run the full suite. `npm run test 2>&1 | tail -5` MUST show no regressions.
  </action>
  <verify>
    <automated>npm run test tests/renderer/help-dialog.spec.tsx &amp;&amp; grep -q "onMenuHelp" src/renderer/src/components/AppShell.tsx &amp;&amp; grep -q "HelpDialog" src/renderer/src/components/AppShell.tsx &amp;&amp; npx tsc --noEmit -p tsconfig.web.json &amp;&amp; npm run test 2>&amp;1 | tail -3 | grep -E "passed"</automated>
  </verify>
  <acceptance_criteria>
    - src/renderer/src/components/AppShell.tsx (or App.tsx) imports HelpDialog and subscribes to window.api.onMenuHelp via useEffect with cleanup
    - HelpDialog is mounted with `open={helpOpen}` + `onClose={() => setHelpOpen(false)}` props
    - tests/renderer/help-dialog.spec.tsx 3 cases GREEN: dialog opens + 7 sections + load-bearing wording; external link calls openExternalUrl with allow-listed URL; Escape/Close/click-outside dispatch onClose
    - The test for openExternalUrl asserts the URL passed matches a string in SHELL_OPEN_EXTERNAL_ALLOWED
    - Pre-existing tests + Phase 9 Plans 02-06 tests STILL GREEN (no regressions)
    - npx tsc --noEmit for both projects exits 0
  </acceptance_criteria>
  <done>HelpDialog wires into AppShell via the Plan 05 onMenuHelp event; external links route through the Plan 05 allow-list. Wave 0 RED scaffold for help-dialog.spec.tsx flips GREEN. Plan 07 closes; only Plan 08 (close-out) remains.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| HelpDialog static content → DOM | Renders via React JSX text interpolation (auto-escaped). No `dangerouslySetInnerHTML`. |
| HelpDialog external link click → main shell.openExternal (transitive) | Each click invokes window.api.openExternalUrl(staticHardcodedUrl); main validates against SHELL_OPEN_EXTERNAL_ALLOWED. |
| menu:help-clicked → renderer | Main-origin one-way send (Plan 05); payload-less. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-07-XSS | Cross-Site Scripting | HelpDialog content rendering | mitigate | RESEARCH §Recommendations #4: NO markdown library. Static React JSX with text interpolation only. No dangerouslySetInnerHTML. All section content authored at compile time. |
| T-09-07-OPEN-EXTERNAL | Tampering / Privilege Escalation | shell.openExternal handoff | mitigate | Allow-list validation in src/main/ipc.ts (Plan 05 SHELL_OPEN_EXTERNAL_ALLOWED). HelpDialog only references URLs hardcoded as module constants; an attacker-modified renderer can call openExternalUrl with any string but the main handler rejects anything outside the allow-list. |
| T-09-07-LISTENER-LEAK | DoS over time | onMenuHelp listener identity | mitigate | Pitfall 9 listener-identity preservation in Plan 05 preload. AppShell useEffect cleanup returns the unsubscribe closure. |
| T-09-07-DIALOG-DOS | DoS | Rapid Help-menu spam → modal mount/unmount churn | accept | React handles mount/unmount idempotently. Setting helpOpen to true while already true is a no-op. No resource leak. |
</threat_model>

<verification>
After Task 2:
1. npm run test tests/renderer/help-dialog.spec.tsx — all 3 cases GREEN
2. npm run test — full suite GREEN; Phase 9 Plans 02-07 all GREEN; pre-Phase-9 baseline preserved
3. grep -n "onMenuHelp\|HelpDialog" src/renderer/src/components/AppShell.tsx — both present
4. grep all 3 SPINE_*_URL constants in src/renderer/src/modals/HelpDialog.tsx — all present in src/main/ipc.ts SHELL_OPEN_EXTERNAL_ALLOWED
5. npx tsc --noEmit -p tsconfig.web.json && npx tsc --noEmit -p tsconfig.node.json both exit 0
6. Manual smoke (Plan 08 UAT): npm run dev → click Help → Documentation → HelpDialog opens with 7 sections → click "Spine Runtimes reference" → system browser opens at the Spine docs URL → close dialog → menu re-enables (08.2 D-184 modalOpen derivation)
</verification>

<success_criteria>
- [ ] src/renderer/src/modals/HelpDialog.tsx ships with 7 static React sections, role="dialog", aria-modal="true"
- [ ] All external link buttons call window.api.openExternalUrl with hardcoded URLs present in SHELL_OPEN_EXTERNAL_ALLOWED
- [ ] Section 7 wording aligns with src/core/sampler.ts:41-44 + Plan 06 tooltip ("editor metadata", "does not affect sampling")
- [ ] No markdown library imports anywhere in the new file
- [ ] AppShell.tsx subscribes to onMenuHelp; mounts HelpDialog with open + onClose props
- [ ] tests/renderer/help-dialog.spec.tsx 3 cases GREEN
- [ ] All Phase 9 tests so far (Plans 02-07) GREEN
- [ ] Pre-existing tests GREEN (no regressions)
- [ ] `<threat_model>` block present (above) — covers static-XSS-free rendering + allow-list reuse + listener leak
</success_criteria>

<output>
After completion, create `.planning/phases/09-complex-rig-hardening-polish/09-07-SUMMARY.md` summarizing:
- HelpDialog content surface (7 sections, ~150-200 lines of static JSX)
- External URL allow-list verification (3 URLs cross-referenced between HelpDialog.tsx + ipc.ts)
- Section 7 wording verification against sampler.ts:41-44
- Plan 08 (close-out) unblocked
</output>

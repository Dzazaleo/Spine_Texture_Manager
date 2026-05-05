/**
 * Phase 9 Plan 07 — In-app Help / Documentation modal.
 *
 * Static React component per RESEARCH §Recommendations #4 (zero markdown
 * footprint, zero XSS surface). Triggered by the Help→Documentation menu
 * click (Plan 09-05 D-188 placeholder fill via menu:help-clicked → onMenuHelp).
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
 * #1) AND with the Plan 09-06 rig-info tooltip's "editor metadata — does
 * not affect sampling" phrasing. The em-dash (U+2014) and the literal
 * substring "editor metadata" + "does not affect sampling" are
 * load-bearing — `tests/renderer/help-dialog.spec.tsx` greps the dialog's
 * `textContent` for both substrings to lock the wording in alignment with
 * the rig-info tooltip + sampler.ts comment block.
 *
 * External links use window.api.openExternalUrl(url) — Plan 09-05 bridge
 * with allow-list defense (T-09-05-OPEN-EXTERNAL). The URLs below MUST be
 * present in SHELL_OPEN_EXTERNAL_ALLOWED in src/main/ipc.ts; this file
 * references them by exact string match. Mismatches are silently dropped
 * by the main handler (the channel is one-way; there is no return value
 * the dialog could observe to surface a "rejected" state).
 *
 * Modal shell mirrors src/renderer/src/modals/OverrideDialog.tsx:100-108
 * verbatim:
 *   - role="dialog" + aria-modal="true" + aria-labelledby="help-title"
 *   - useFocusTrap with onEscape: props.onClose
 *   - outer overlay onClick = onClose; inner content onClick stops
 *     propagation so clicks on text/links don't dismiss the dialog.
 *
 * 08.2 D-184 — role="dialog" + aria-modal="true" auto-suppresses File menu
 * via the existing modalOpen derivation (any aria-modal="true" mount feeds
 * the notifyMenuState push side that disables Save/Save As at the OS level
 * while the modal is open). No extra wiring needed in AppShell.tsx beyond
 * the helpOpen state slot (Task 2 of this plan).
 *
 * RESEARCH §Recommendations #4 — NO markdown library:
 *   1. Zero XSS surface — we author the JSX; no untrusted content path.
 *   2. Smallest footprint — ~0 KB runtime vs ~80 KB for react-markdown
 *      or ~50 KB for marked + dompurify.
 *   3. One-time authored content — adding a build-pipeline for static
 *      help content is overkill.
 *
 * Layer 3 invariant: this file imports only React + the local useFocusTrap
 * hook. It never reaches into src/core/* — the tests/arch.spec.ts grep gate
 * auto-scans this file on every test run.
 */
import { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

// External link URLs — MUST be present in SHELL_OPEN_EXTERNAL_ALLOWED in
// src/main/ipc.ts. If you add a URL here, also add it there. Mismatches
// are silently dropped by the main handler.
const SPINE_RUNTIMES_URL = 'https://esotericsoftware.com/spine-runtimes';
const SPINE_API_REF_URL = 'https://esotericsoftware.com/spine-api-reference';
const SPINE_JSON_FORMAT_URL = 'https://en.esotericsoftware.com/spine-json-format';
// Phase 12 Plan 06 (D-16.4) — INSTALL.md cookbook URL. Must match
// SHELL_OPEN_EXTERNAL_ALLOWED in src/main/ipc.ts AND AppShell.tsx's
// onMenuInstallationGuide handler argument byte-for-byte (D-18 exact-string
// allow-list). URL-consistency across all 4 surfaces (this file, ipc.ts,
// AppShell.tsx, .github/workflows/release.yml) is gated by
// tests/integration/install-md.spec.ts.
const INSTALL_DOC_URL = 'https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md';

export function HelpDialog(props: HelpDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Document-level Escape + Tab cycle via the shared hook (Phase 6 Gap-Fix
  // Round 6). Escape works regardless of where focus has drifted; Tab cycles
  // back to the first tabbable when reaching the last. onEscape closes.
  useFocusTrap(dialogRef, props.open, { onEscape: props.onClose });

  if (!props.open) return null;

  // Curried click handler: each external link button passes its hardcoded
  // URL through window.api.openExternalUrl. The url parameter is a string
  // literal at every call site (the three SPINE_*_URL module constants
  // above) — no user-controlled values reach the handler.
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
        className="bg-modal border border-border rounded-md p-6 max-w-[700px] max-h-[80vh] overflow-y-auto font-mono shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-4">
          <h2 id="help-title" className="text-base font-semibold text-fg">
            Documentation
          </h2>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close help"
            className="border border-border rounded-md px-2 py-0.5 text-xs text-fg-muted hover:text-fg"
          >
            Close
          </button>
        </div>

        <section className="mb-4">
          <h3 className="text-sm font-semibold text-fg mb-1">
            1. What this app does
          </h3>
          <p className="text-xs text-fg-muted leading-relaxed">
            Spine Texture Manager reads Spine 4.2+ skeleton JSON and computes
            the peak world-space render scale for every attachment, across
            every animation and skin. Use it to right-size textures per-asset
            before atlas export.
          </p>
        </section>

        <section className="mb-4">
          <h3 className="text-sm font-semibold text-fg mb-2">
            Install instructions
          </h3>
          <p className="text-xs text-fg-muted leading-relaxed">
            For per-OS install steps and first-launch bypass walkthroughs
            (Gatekeeper / SmartScreen / libfuse2),{' '}
            <button
              type="button"
              className="underline text-accent hover:text-fg"
              onClick={openLink(INSTALL_DOC_URL)}
            >
              see INSTALL.md
            </button>{' '}
            on the project repo.
          </p>
        </section>

        <section className="mb-4">
          <h3 className="text-sm font-semibold text-fg mb-1">
            2. How to load a rig
          </h3>
          <p className="text-xs text-fg-muted leading-relaxed">
            Drop a .json file (or its parent folder) onto the app window, or
            use File &rarr; Open (Cmd+O / Ctrl+O). The app auto-detects the
            companion .atlas file and images/ folder when they sit next to
            the JSON. See{' '}
            <button
              type="button"
              className="underline text-accent hover:text-fg"
              onClick={openLink(SPINE_JSON_FORMAT_URL)}
            >
              Spine JSON format reference
            </button>
            .
          </p>
        </section>

        <section className="mb-4">
          <h3 className="text-sm font-semibold text-fg mb-1">
            3. Reading the Global Max Render Source panel
          </h3>
          <p className="text-xs text-fg-muted leading-relaxed">
            Each row shows one attachment&apos;s peak across all animations
            and skins. Original size is the source PNG dimensions; Max Render
            Size is the largest dimensions the attachment ever needs at
            runtime; Scale is their ratio. Click column headers to sort;
            type in the search box to filter by attachment name.
          </p>
        </section>

        <section className="mb-4">
          <h3 className="text-sm font-semibold text-fg mb-1">
            4. Reading the Animation Breakdown panel
          </h3>
          <p className="text-xs text-fg-muted leading-relaxed">
            One card per animation, plus a &ldquo;Setup Pose (Default)&rdquo;
            card for attachments rendered without any animation. Each row
            inside a card shows that attachment&apos;s peak DURING THAT ONE
            ANIMATION &mdash; useful for tracing why an attachment scales up.
            Bone Path traces the bone chain from root to the attachment&apos;s
            bone.
          </p>
        </section>

        <section className="mb-4">
          <h3 className="text-sm font-semibold text-fg mb-1">
            5. How to override a scale
          </h3>
          <p className="text-xs text-fg-muted leading-relaxed">
            Double-click any peak Scale cell, or click the &ldquo;Override
            Scale&rdquo; button on a row. Enter a percentage from 1 to 100
            (100% = source dimensions; values above 100% silently clamp).
            Overrides save to your .stmproj project file and apply across
            all panels.
          </p>
        </section>

        <section className="mb-4">
          <h3 className="text-sm font-semibold text-fg mb-1">
            6. How to optimize and export
          </h3>
          <p className="text-xs text-fg-muted leading-relaxed">
            Click &ldquo;Optimize Assets&rdquo; to open the export dialog.
            Pick an output folder; the app re-encodes each PNG with
            sharp&apos;s Lanczos3 filter at the peak dimensions (or your
            overridden dimensions). Source files are never modified. See{' '}
            <button
              type="button"
              className="underline text-accent hover:text-fg"
              onClick={openLink(SPINE_RUNTIMES_URL)}
            >
              Spine Runtimes reference
            </button>{' '}
            for re-packing the new images into a fresh atlas.
          </p>
        </section>

        <section className="mb-4">
          <h3 className="text-sm font-semibold text-fg mb-1">
            7. Sampling rate (advanced) &mdash; samplingHz vs skeleton.fps
          </h3>
          <p className="text-xs text-fg-muted leading-relaxed">
            The app samples every animation at{' '}
            <span className="font-semibold text-fg">samplingHz</span> (default
            120 Hz). Higher rates catch sub-frame peaks on easing curves at
            the cost of sampling time. Configure in Edit &rarr; Preferences
            (Cmd+, / Ctrl+,).
          </p>
          <p className="text-xs text-fg-muted leading-relaxed mt-2">
            The <span className="font-semibold text-fg">skeleton.fps</span>{' '}
            value shown in the rig-info tooltip is editor metadata &mdash; it
            does not affect sampling. It comes from the dopesheet rate the
            artist used in the Spine editor and has zero runtime effect. See{' '}
            <button
              type="button"
              className="underline text-accent hover:text-fg"
              onClick={openLink(SPINE_API_REF_URL)}
            >
              Spine API reference
            </button>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

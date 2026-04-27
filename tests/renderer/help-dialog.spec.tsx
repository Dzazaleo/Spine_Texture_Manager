// @vitest-environment jsdom
/**
 * Phase 9 Plan 07 — HelpDialog (in-app documentation) renderer specs.
 *
 * Replaces the Wave 0 RED scaffold (2 placeholder cases) with real
 * assertions against the Task 1 HelpDialog component
 * (src/renderer/src/modals/HelpDialog.tsx).
 *
 * Coverage (per 09-07-PLAN.md Task 2 + 09-VALIDATION.md row 18):
 *   1. opens with role="dialog" labelled "Documentation"; renders 7
 *      canonical <section> blocks; Section 7's load-bearing wording
 *      ("editor metadata" + "does not affect sampling") is present.
 *   2. clicking an external link button invokes
 *      window.api.openExternalUrl with the exact allow-listed URL
 *      (Plan 09-05 SHELL_OPEN_EXTERNAL_ALLOWED).
 *   3. Close button + click-outside (overlay) both dispatch onClose.
 *
 * The shell.openExternal handoff is exercised at the renderer/preload
 * seam — the test mocks window.api.openExternalUrl as a vi.fn() so the
 * dialog's call surface is observable; the real main-side allow-list
 * validation is covered by tests/main/ipc.spec.ts (Plan 09-05 Task 2).
 *
 * Analog: tests/renderer/atlas-preview-modal.spec.tsx (jsdom + Testing
 * Library setup; modal mount shape).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { HelpDialog } from '../../src/renderer/src/modals/HelpDialog';

afterEach(cleanup);

describe('HelpDialog — Wave 5 (Claude Discretion: in-app help)', () => {
  // Mock window.api so external-link clicks are observable. We define
  // the spy outside beforeEach so individual `it` blocks can reset it
  // and inspect the call list.
  const openExternalUrl = vi.fn();

  beforeEach(() => {
    openExternalUrl.mockClear();
    // Stamp window.api with the minimal surface HelpDialog touches.
    // Object.defineProperty allows re-stamping across cleanups (vi.stubGlobal
    // would also work; we use defineProperty to keep the mock surface
    // strictly scoped to this file).
    Object.defineProperty(window, 'api', {
      writable: true,
      configurable: true,
      value: { openExternalUrl },
    });
  });

  it('opens with role=dialog labelled "Documentation"; renders 8 canonical sections', () => {
    render(<HelpDialog open={true} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: /documentation/i });
    expect(dialog).toBeTruthy();
    // 8 sections — 7 numbered (1. … 7.) plus the Phase 12 Plan 06 (D-16.4)
    // unnumbered "Install instructions" section inserted between 1 and 2 as
    // the in-app surface pointing testers at INSTALL.md. Verify the exact
    // count to lock the canonical list (CONTEXT.md Claude's Discretion +
    // RESEARCH §Recommendations #15).
    const sections = dialog.querySelectorAll('section');
    expect(sections.length).toBe(8);
    // Section 7 load-bearing wording — must align with sampler.ts:41-44 +
    // Plan 09-06 rig-info tooltip per CLAUDE.md fact #1. The em-dash
    // (U+2014) is used in the source; the test asserts the substrings
    // independently so a regex flavor difference can't false-fail.
    expect(dialog.textContent).toContain('editor metadata');
    expect(dialog.textContent).toContain('does not affect sampling');
  });

  it('clicking an external link invokes window.api.openExternalUrl with an allow-listed URL', () => {
    render(<HelpDialog open={true} onClose={vi.fn()} />);
    // Section 2: "Spine JSON format reference" → spine-json-format URL.
    const jsonLink = screen.getByRole('button', { name: /spine json format/i });
    fireEvent.click(jsonLink);
    expect(openExternalUrl).toHaveBeenCalledTimes(1);
    expect(openExternalUrl).toHaveBeenCalledWith(
      'https://en.esotericsoftware.com/spine-json-format',
    );

    // Section 6: "Spine Runtimes reference" → spine-runtimes URL.
    fireEvent.click(screen.getByRole('button', { name: /spine runtimes/i }));
    expect(openExternalUrl).toHaveBeenCalledTimes(2);
    expect(openExternalUrl).toHaveBeenLastCalledWith(
      'https://esotericsoftware.com/spine-runtimes',
    );

    // Section 7: "Spine API reference" → spine-api-reference URL.
    fireEvent.click(screen.getByRole('button', { name: /spine api reference/i }));
    expect(openExternalUrl).toHaveBeenCalledTimes(3);
    expect(openExternalUrl).toHaveBeenLastCalledWith(
      'https://esotericsoftware.com/spine-api-reference',
    );
  });

  it('Close button and click-outside both dispatch onClose', () => {
    const onClose = vi.fn();
    render(<HelpDialog open={true} onClose={onClose} />);

    // Close button (aria-label="Close help" matches OverrideDialog idiom).
    fireEvent.click(screen.getByRole('button', { name: /close help/i }));
    expect(onClose).toHaveBeenCalled();
    onClose.mockClear();

    // Click-outside dismissal — clicking the dialog overlay (which IS the
    // role="dialog" element since the inner panel onClick stopPropagation's)
    // dispatches onClose. Re-render after cleanup to start fresh.
    cleanup();
    render(<HelpDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });
});

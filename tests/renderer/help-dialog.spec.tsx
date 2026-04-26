// @vitest-environment jsdom
/**
 * Phase 9 Plan 01 — Wave 0 RED scaffolds for HelpDialog (in-app documentation).
 *
 * Behavior claimed from `.planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md`:
 *   - Row 18: Help — markdown + external links (Help-menu click mounts the dialog;
 *     external link click invokes shell.openExternal — mocked through window.api.openExternalUrl).
 *
 * Wave 0 design rule: scaffolds are RED-by-design until Wave 5 lands the
 * HelpDialog component + the openExternalUrl preload bridge. See PATTERNS
 * §"src/renderer/src/modals/HelpDialog.tsx".
 *
 * Analog: tests/renderer/atlas-preview-modal.spec.tsx + tests/main/ipc.spec.ts (mock pattern).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

describe('HelpDialog — Wave 5 (Claude Discretion: in-app help)', () => {
  it('opens on Help-menu click; mounts role=dialog with the 7 canonical sections', () => {
    // TODO Wave 5: render(<HelpDialog open={true} onClose={…} />);
    //   expect(screen.getByRole('dialog', { name: /help/i })).toBeInTheDocument();
    //   The 7 canonical sections per CONTEXT.md Claude's Discretion (Documentation):
    //     1. What this app does
    //     2. How to load a rig
    //     3. Reading the Global Max Render Source panel
    //     4. Reading the Animation Breakdown panel
    //     5. How to override a scale
    //     6. How to optimize and export
    //     7. Sampling rate (advanced) — samplingHz vs skeleton.fps
    expect(true, 'Wave 5: HelpDialog component not yet authored').toBe(false);
  });

  it('clicking an external link invokes window.api.openExternalUrl (mocked) with the link href', () => {
    // TODO Wave 5: const openExternalUrl = vi.fn();
    //   (window as unknown as { api: unknown }).api = { openExternalUrl, … };
    //   render(<HelpDialog open={true} onClose={…} />);
    //   fireEvent.click(screen.getByRole('link', { name: /spine docs/i }));
    //   expect(openExternalUrl).toHaveBeenCalledWith('https://en.esotericsoftware.com/');
    void vi; // hold the import; Wave 5 will use vi.fn() + vi.mock()
    expect(true, 'Wave 5: openExternalUrl preload bridge + handler pending').toBe(false);
  });
});

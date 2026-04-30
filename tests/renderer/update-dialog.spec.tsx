// @vitest-environment jsdom
/**
 * Phase 12 Plan 01 Task 3 — RED specs for UpdateDialog.tsx.
 *
 * Coverage (per 12-01-PLAN.md Task 3 Behavior 1-15):
 *   1.  open=true renders [role="dialog"][aria-modal="true"].
 *   2.  open=false renders nothing.
 *   3.  Escape → onClose (useFocusTrap onEscape).
 *   4.  Outer overlay click → onClose; inner content does NOT close (stopPropagation).
 *   5.  state="available": [Download + Restart] [Later] buttons visible.
 *   6.  state="available" Download click → onDownload.
 *   7.  state="available" Later click → onLater.
 *   8.  state="downloading" disabled [Downloading…] button.
 *   9.  state="downloaded": [Restart] [Later] buttons visible.
 *   10. state="downloaded" Restart click → onRestart.
 *   11. summary rendered as plain text in <pre> with whitespace-pre-wrap.
 *   12. View full release notes link → openExternalUrl(GITHUB_RELEASES_INDEX_URL).
 *   13. manual-download variant: [Open Release Page] [Later] buttons.
 *   14. summary with markdown chars stays literal (no <strong>/<em> rendered).
 *   15. state="none" — friendly "up to date" view + Dismiss button.
 *
 * Mocks window.api.openExternalUrl to observe the View-full-release-notes call.
 *
 * Mirrors tests/renderer/help-dialog.spec.tsx scaffold.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { UpdateDialog } from '../../src/renderer/src/modals/UpdateDialog';

afterEach(cleanup);

describe('UpdateDialog — Phase 12 Plan 01 (auto-update modal)', () => {
  const openExternalUrl = vi.fn();

  beforeEach(() => {
    openExternalUrl.mockClear();
    Object.defineProperty(window, 'api', {
      writable: true,
      configurable: true,
      value: { openExternalUrl },
    });
  });

  it('(1) open=true renders [role=dialog][aria-modal=true] labelled by update-title', () => {
    render(
      <UpdateDialog
        open={true}
        state="available"
        version="1.2.3"
        summary=""
        onLater={vi.fn()}
        onClose={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('update-title');
  });

  it('(2) open=false renders nothing', () => {
    const { container } = render(
      <UpdateDialog
        open={false}
        state="available"
        version="1.2.3"
        summary=""
        onLater={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('(3) Escape key triggers onClose (useFocusTrap onEscape)', () => {
    const onClose = vi.fn();
    render(
      <UpdateDialog
        open={true}
        state="available"
        version="1.2.3"
        summary=""
        onLater={vi.fn()}
        onClose={onClose}
        onDownload={vi.fn()}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('(4) outer overlay click triggers onClose; inner click does NOT', () => {
    const onClose = vi.fn();
    render(
      <UpdateDialog
        open={true}
        state="available"
        version="1.2.3"
        summary=""
        onLater={vi.fn()}
        onClose={onClose}
        onDownload={vi.fn()}
      />,
    );
    // Outer overlay = the [role="dialog"] element itself.
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
    onClose.mockClear();
    // Inner content stops propagation — clicking the title text doesn't close.
    fireEvent.click(screen.getByText(/Update available: v1\.2\.3/));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('(5) state="available" renders [Download + Restart] and [Later]', () => {
    render(
      <UpdateDialog
        open={true}
        state="available"
        version="1.2.3"
        summary=""
        onLater={vi.fn()}
        onClose={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /download \+ restart/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^later$/i })).toBeTruthy();
  });

  it('(6) state="available" Download click → onDownload', () => {
    const onDownload = vi.fn();
    render(
      <UpdateDialog
        open={true}
        state="available"
        version="1.2.3"
        summary=""
        onLater={vi.fn()}
        onClose={vi.fn()}
        onDownload={onDownload}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /download \+ restart/i }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('(7) state="available" Later click → onLater', () => {
    const onLater = vi.fn();
    render(
      <UpdateDialog
        open={true}
        state="available"
        version="1.2.3"
        summary=""
        onLater={onLater}
        onClose={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^later$/i }));
    expect(onLater).toHaveBeenCalledTimes(1);
  });

  it('(8) state="downloading" renders disabled [Downloading…] button', () => {
    render(
      <UpdateDialog
        open={true}
        state="downloading"
        version="1.2.3"
        summary=""
        onLater={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /downloading/i });
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('(9) state="downloaded" renders [Restart] and [Later]', () => {
    render(
      <UpdateDialog
        open={true}
        state="downloaded"
        version="1.2.3"
        summary=""
        onLater={vi.fn()}
        onClose={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /^restart$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^later$/i })).toBeTruthy();
  });

  it('(10) state="downloaded" Restart click → onRestart', () => {
    const onRestart = vi.fn();
    render(
      <UpdateDialog
        open={true}
        state="downloaded"
        version="1.2.3"
        summary=""
        onLater={vi.fn()}
        onClose={vi.fn()}
        onRestart={onRestart}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^restart$/i }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('(11) summary rendered in <pre> with whitespace-pre-wrap', () => {
    const { container } = render(
      <UpdateDialog
        open={true}
        state="available"
        version="1.2.3"
        summary="Line 1\nLine 2"
        onLater={vi.fn()}
        onClose={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    const preEl = container.querySelector('pre');
    expect(preEl).toBeTruthy();
    expect(preEl?.className).toContain('whitespace-pre-wrap');
    expect(preEl?.textContent).toContain('Line 1');
  });

  it('(12) View full release notes click → openExternalUrl(releases-index)', () => {
    render(
      <UpdateDialog
        open={true}
        state="available"
        version="1.2.3"
        summary=""
        onLater={vi.fn()}
        onClose={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /view full release notes/i }));
    expect(openExternalUrl).toHaveBeenCalledWith(
      'https://github.com/Dzazaleo/Spine_Texture_Manager/releases',
    );
  });

  it('(13) manual-download variant renders [Open Release Page] and [Later]', () => {
    const onOpenReleasePage = vi.fn();
    render(
      <UpdateDialog
        open={true}
        state="available"
        version="1.2.3"
        summary=""
        variant="manual-download"
        onLater={vi.fn()}
        onClose={vi.fn()}
        onOpenReleasePage={onOpenReleasePage}
      />,
    );
    const openBtn = screen.getByRole('button', { name: /open release page/i });
    expect(openBtn).toBeTruthy();
    fireEvent.click(openBtn);
    expect(onOpenReleasePage).toHaveBeenCalledTimes(1);
    // manual-download variant should NOT render [Download + Restart].
    expect(screen.queryByRole('button', { name: /download \+ restart/i })).toBeNull();
    // manual-download variant should NOT render the View-full-release-notes link
    // (the [Open Release Page] button serves that purpose).
    expect(screen.queryByRole('button', { name: /view full release notes/i })).toBeNull();
  });

  it('(14) markdown characters in summary remain literal (no XSS surface)', () => {
    const { container } = render(
      <UpdateDialog
        open={true}
        state="available"
        version="1.2.3"
        summary="**bold** _italic_"
        onLater={vi.fn()}
        onClose={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    expect(container.querySelector('strong')).toBeNull();
    expect(container.querySelector('em')).toBeNull();
    const preEl = container.querySelector('pre');
    expect(preEl?.textContent).toContain('**bold**');
    expect(preEl?.textContent).toContain('_italic_');
  });

  it('(15) state="none" renders friendly "up to date" view + Dismiss button', () => {
    const onLater = vi.fn();
    render(
      <UpdateDialog
        open={true}
        state="none"
        version="1.2.3"
        summary=""
        onLater={onLater}
        onClose={vi.fn()}
      />,
    );
    // Headline matches /up to date/i (D-05 forbids native alert(); reuse modal).
    expect(screen.getByRole('dialog').textContent).toMatch(/up to date/i);
    // Body shows currentVersion.
    expect(screen.getByText(/Running v1\.2\.3/)).toBeTruthy();
    // Single Dismiss button (no Download/Restart/View-release-notes).
    const dismissBtn = screen.getByRole('button', { name: /^dismiss$/i });
    fireEvent.click(dismissBtn);
    expect(onLater).toHaveBeenCalledTimes(1);
    // No Download/Restart in this state.
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^restart$/i })).toBeNull();
  });

  it('(15b) state="none" with non-empty summary shows error headline + summary', () => {
    render(
      <UpdateDialog
        open={true}
        state="none"
        version=""
        summary="Update check failed: network down"
        onLater={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog').textContent).toMatch(/Update check failed|failed/i);
    expect(screen.getByText(/network down/)).toBeTruthy();
  });
});

// @vitest-environment jsdom
/**
 * Phase 21 Plan 21-10 (G-02) — RTL tests for MissingAttachmentsPanel.
 *
 * Behavior gates:
 *   - Returns null when skippedAttachments is empty (no empty-state placeholder).
 *   - Renders header with count when skippedAttachments.length > 0 (singular + plural).
 *   - List is collapsed by default; expand button reveals all entries.
 *   - Each entry surfaces both `name` and `expectedPngPath`.
 *
 * Mirrors atlas-preview-modal.spec.tsx + global-max-virtualization.spec.tsx
 * idiom: vitest + @testing-library/react + jsdom; assertions use
 * `not.toBeNull()` / `toBeDefined()` rather than `@testing-library/jest-dom`
 * matchers (project convention — no jest-dom imports anywhere in tests/renderer).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MissingAttachmentsPanel } from '../../src/renderer/src/panels/MissingAttachmentsPanel';

afterEach(cleanup);

describe('MissingAttachmentsPanel (G-02)', () => {
  it('returns null when skippedAttachments is empty (no empty-state placeholder)', () => {
    const { container } = render(<MissingAttachmentsPanel skippedAttachments={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders header with count when skippedAttachments.length > 0 (singular)', () => {
    render(
      <MissingAttachmentsPanel
        skippedAttachments={[
          { name: 'TRIANGLE', expectedPngPath: '/tmp/images/TRIANGLE.png' },
        ]}
      />,
    );
    // Header text contains "1" and "missing".
    expect(screen.getByText(/1.*missing/i)).not.toBeNull();
  });

  it('renders header with count when skippedAttachments.length > 0 (plural)', () => {
    render(
      <MissingAttachmentsPanel
        skippedAttachments={[
          { name: 'TRIANGLE', expectedPngPath: '/tmp/images/TRIANGLE.png' },
          { name: 'CIRCLE', expectedPngPath: '/tmp/images/CIRCLE.png' },
          { name: 'JOKER_FULL_BODY/BODY', expectedPngPath: '/tmp/images/JOKER_FULL_BODY/BODY.png' },
        ]}
      />,
    );
    expect(screen.getByText(/3.*missing/i)).not.toBeNull();
  });

  it('list is collapsed by default; expand button reveals all entries with name + expectedPngPath', () => {
    render(
      <MissingAttachmentsPanel
        skippedAttachments={[
          { name: 'TRIANGLE', expectedPngPath: '/tmp/images/TRIANGLE.png' },
          { name: 'CIRCLE', expectedPngPath: '/tmp/images/CIRCLE.png' },
        ]}
      />,
    );
    // Before expand: entries should not be visible.
    expect(screen.queryByText('/tmp/images/TRIANGLE.png')).toBeNull();
    expect(screen.queryByText('/tmp/images/CIRCLE.png')).toBeNull();

    // Find + click the expand button.
    const expandButton = screen.getByRole('button', { name: /show details|details|expand|show/i });
    expect(expandButton).not.toBeNull();
    fireEvent.click(expandButton);

    // After expand: both entries visible with both name + path.
    expect(screen.getByText('TRIANGLE')).not.toBeNull();
    expect(screen.getByText('/tmp/images/TRIANGLE.png')).not.toBeNull();
    expect(screen.getByText('CIRCLE')).not.toBeNull();
    expect(screen.getByText('/tmp/images/CIRCLE.png')).not.toBeNull();
  });
});

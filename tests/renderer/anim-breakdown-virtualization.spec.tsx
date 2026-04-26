// @vitest-environment jsdom
/**
 * Phase 9 Plan 01 — Wave 0 RED scaffolds for AnimationBreakdownPanel per-card virtualization.
 *
 * Behaviors claimed from `.planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md`:
 *   - Row 12: D-196 outer cards in regular DOM (16 cards present regardless of expand state)
 *   - Row 13: D-196 inner virtualization (200 rows in expanded card → ≤60 <tr>)
 *   - Row 14: D-196 collapse/re-expand (filter query preserved; scroll-reset policy holds)
 *   - Row 15: D-196 OverrideDialog mounts from a virtualized inner row with correct context
 *
 * Wave 0 design rule: scaffolds are RED-by-design until Wave 2 lands the
 * per-card useVirtualizer + measureElement integration. See PATTERNS
 * §"src/renderer/src/panels/AnimationBreakdownPanel.tsx".
 *
 * Analog: tests/renderer/atlas-preview-modal.spec.tsx.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

describe('AnimationBreakdownPanel — Wave 2 D-196', () => {
  it('outer cards: 16 cards render in regular DOM regardless of expand state', () => {
    // TODO Wave 2: render(<AnimationBreakdownPanel breakdown={makeBreakdownWithCards(16)} … />);
    //   expect(screen.getAllByRole('region').length).toBe(16);   // (or whatever the card landmark is)
    expect(true, 'Wave 2: outer card list shape pending').toBe(false);
  });

  it('inner above threshold: expanded card with 200 rows renders <=60 <tr> elements', () => {
    // TODO Wave 2: render the panel with one card expanded carrying 200 rows;
    //   expect(within(expandedCardBody).getAllByRole('row').length).toBeLessThanOrEqual(60);
    expect(true, 'Wave 2: per-card inner virtualizer pending').toBe(false);
  });

  it('collapse/re-expand: filter query preserved; scroll-reset policy holds', () => {
    // TODO Wave 2: type a filter; collapse the card; re-expand; assert the input still
    //   shows the filter and (per planner-chosen scroll-reset policy) virtualizer scrollTop === 0.
    expect(true, 'Wave 2: collapse/expand cycle pending').toBe(false);
  });

  it('override: clicking Override Scale on a virtualized inner row mounts OverrideDialog with correct row context', () => {
    // TODO Wave 2: click the Override Scale button on a row at index N inside a 200-row expanded card;
    //   expect(screen.getByRole('dialog', { name: /override scale/i })).toBeInTheDocument();
    //   expect(dialog.textContent).toMatch(/<expected attachment name>/);
    expect(true, 'Wave 2: OverrideDialog mount from virtualized row pending').toBe(false);
  });
});

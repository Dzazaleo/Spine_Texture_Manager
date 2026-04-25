// @vitest-environment jsdom
/**
 * Phase 7 — renderer-side specs for AtlasPreviewModal.
 *
 * Coverage (per CONTEXT.md <decisions> tests):
 *   - Modal opens with default view (Optimized @ 2048, page 1) [D-135]
 *   - Toggle re-render: switching mode/resolution updates page count [D-128]
 *   - Pager bounds-disable correctly [D-128]
 *   - Dblclick on canvas fires onJumpToAttachment with correct attachmentName [D-130]
 *   - Missing-source rendering path shows the glyph (mock missing file) [D-137]
 *
 * Canvas-pixel assertions are SKIPPED (jsdom returns null from getContext('2d'))
 * — pixel correctness is asserted via tests/core/atlas-preview.spec.ts golden
 * values + a manual checkpoint:human-verify gate. See RESEARCH §Open Question 3.
 *
 * Wave 0 status: this file is RED. Plan 04 (Wave 3) implements
 * src/renderer/src/modals/AtlasPreviewModal.tsx and fills these `it.todo`
 * slots with real assertions using @testing-library/react + user-event.
 */
import { describe, it } from 'vitest';

describe('AtlasPreviewModal — default view (D-135)', () => {
  it.todo('opens with Optimized @ 2048, page 1');
});

describe('AtlasPreviewModal — toggle re-render (D-128)', () => {
  it.todo('switching mode toggles between Original / Optimized projections');
  it.todo('switching resolution updates page count and EFFICIENCY card value');
});

describe('AtlasPreviewModal — pager bounds (D-128)', () => {
  it.todo('< button disabled at page 1; > button disabled at page totalPages');
});

describe('AtlasPreviewModal — dblclick jump-target (D-130)', () => {
  it.todo('dblclick on a region rect calls onJumpToAttachment with the region attachmentName');
});

describe('AtlasPreviewModal — missing-source glyph (D-137)', () => {
  it.todo('region with sourceMissing=true renders the ⚠ glyph + tooltip in the canvas');
});

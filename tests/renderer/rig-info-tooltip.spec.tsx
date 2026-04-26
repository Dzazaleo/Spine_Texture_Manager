// @vitest-environment jsdom
/**
 * Phase 9 Plan 01 — Wave 0 RED scaffolds for the RigInfoTooltip on the AppShell filename chip.
 *
 * Behavior claimed from `.planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md`:
 *   - Row 17: Tooltip — fps labeling (skeleton.fps: <N> (editor metadata — does not affect sampling))
 *     plus bones/slots/attachments/animations/skins counts matching the summary shape.
 *
 * Wave 0 design rule: scaffolds are RED-by-design until Wave 4 lands the
 * tooltip surface. The "(editor metadata — does not affect sampling)" wording
 * is load-bearing per CLAUDE.md fact #1 + src/core/sampler.ts:41-44 canonical comment.
 *
 * Analog: tests/renderer/atlas-preview-modal.spec.tsx.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

describe('RigInfoTooltip — Wave 4 (Claude Discretion: rig-info on filename chip)', () => {
  it('hover filename chip: tooltip becomes visible with skeletonName + bones/slots/attachments/animations/skins counts matching summary', () => {
    // TODO Wave 4: render(<AppShell summary={makeSummary()} … />); userEvent.hover(filenameChip);
    //   const tooltip = await screen.findByRole('tooltip');
    //   expect(tooltip.textContent).toMatch(new RegExp(`bones:\\s*${summary.bones.count}`));
    //   expect(tooltip.textContent).toMatch(new RegExp(`slots:\\s*${summary.slots.count}`));
    //   …attachments, animations, skins…
    expect(true, 'Wave 4: tooltip surface not yet authored').toBe(false);
  });

  it('skeleton.fps line reads exactly: "skeleton.fps: <N> (editor metadata — does not affect sampling)"', () => {
    // CRITICAL wording per CLAUDE.md fact #1 + src/core/sampler.ts:41-44 canonical comment.
    // TODO Wave 4: expect(tooltip.textContent).toMatch(
    //   /skeleton\.fps:\s*\d+\s*\(editor metadata — does not affect sampling\)/
    // );
    expect(true, 'Wave 4: editorFps surfacing through summary pending').toBe(false);
  });
});

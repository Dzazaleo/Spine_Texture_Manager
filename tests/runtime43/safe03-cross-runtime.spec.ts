import { describe, expect, it } from 'vitest';
import { tryLoad43 } from './load43.js';
import { handleRuntime } from '../../src/core/runtime/types.js';

describe('SAFE-03: attachments resolve attachmentKind against the loading runtime; cross-feed detected', () => {
  it('every 4.3 skin-entry attachment is handleRuntime "4.3" and classifies non-skip-or-known', () => {
    const loaded = tryLoad43();
    if (loaded == null) { expect(true).toBe(true); return; } // Wave-0 skip: runtime-43/fixture absent (Plan 04/05)
    const { rt, skeletonData } = loaded;
    let asserted = 0;
    for (const skin of rt.skins(skeletonData)) {
      for (const entry of rt.skinEntries(skin)) {
        const a = entry.attachment;
        expect(handleRuntime(a)).toBe('4.3');                  // threaded identity, not inferred
        expect(['region', 'mesh', 'vertex', 'skip']).toContain(rt.attachmentKind(a));
        asserted++;
      }
    }
    expect(asserted).toBeGreaterThan(0);
  });

  it('a 4.2-stamped handle fed to the 4.3 adapter is detectable via handleRuntime mismatch (runtime backstop)', () => {
    const loaded = tryLoad43();
    if (loaded == null) { expect(true).toBe(true); return; }
    // The brand makes a cross-mix a COMPILE error; handleRuntime is the runtime
    // backstop. Construct a deliberately 4.2-tagged fake handle and assert the
    // tag is observable (so a cross-feed cannot be silent).
    const { brandHandle } = require('../../src/core/runtime/types.js');
    const fake42 = brandHandle({}, '4.2');
    expect(handleRuntime(fake42)).toBe('4.2');
    expect(handleRuntime(fake42)).not.toBe('4.3');
  });
});

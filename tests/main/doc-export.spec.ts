// @vitest-environment node
//
// Phase 20 Plan 04 — DOC-04 HTML export tests.
//
// Golden snapshot + self-containment proof + XSS escape proof.
// renderDocumentationHtml must be a pure function — generatedAt is injected
// for deterministic golden-file testing.
//
// Self-containment regex set guards every external-asset surface that could
// silently leak into the export (img src, link rel=stylesheet, script src,
// remote url(), @font-face, @import). T-20-20 mitigation.
//
// XSS escape proof: feed a `<script>alert(1)</script>` notes field through
// renderDocumentationHtml and assert the literal `<script>...` substring is
// absent and the escaped form `&lt;script&gt;` is present. T-20-19 mitigation.

import { describe, it, expect } from 'vitest';
import { renderDocumentationHtml, type DocExportPayload } from '../../src/main/doc-export.js';
import { DEFAULT_DOCUMENTATION, type Documentation } from '../../src/core/documentation.js';
import type { SkeletonSummary, AtlasPreviewProjection } from '../../src/shared/types.js';

const FIXED_GENERATED_AT = new Date('2026-04-14T12:00:00Z').getTime();

function makeMinimalPayload(overrides: Partial<DocExportPayload> = {}): DocExportPayload {
  // Minimal SkeletonSummary stub — only the fields renderDocumentationHtml
  // reads matter for these tests (skeletonPath / attachments.count /
  // peaks.length / events.count). The cast is acceptable for test surface.
  const summary = {
    skeletonPath: '/tmp/SIMPLE.json',
    atlasPath: '/tmp/SIMPLE.atlas',
    bones: { count: 0, names: [] },
    slots: { count: 0 },
    attachments: { count: 174, byType: {} },
    skins: { count: 0, names: [] },
    animations: { count: 23, names: [] },
    events: { count: 0, names: [] },
    peaks: new Array(170).fill({}),
    animationBreakdown: [],
  } as unknown as SkeletonSummary;

  // Minimal AtlasPreviewProjection — renderDocumentationHtml reads
  // pages[i].width + pages[i].height + totalPages.
  const atlasPreview: AtlasPreviewProjection = {
    mode: 'optimized',
    maxPageDim: 2048,
    totalPages: 4,
    oversize: [],
    pages: [
      { pageIndex: 0, width: 2048, height: 2048, regions: [], usedPixels: 0, totalPixels: 0, efficiency: 0 },
      { pageIndex: 1, width: 2048, height: 2048, regions: [], usedPixels: 0, totalPixels: 0, efficiency: 0 },
      { pageIndex: 2, width: 2048, height: 1024, regions: [], usedPixels: 0, totalPixels: 0, efficiency: 0 },
      { pageIndex: 3, width: 2048, height: 1024, regions: [], usedPixels: 0, totalPixels: 0, efficiency: 0 },
    ],
  };

  return {
    documentation: DEFAULT_DOCUMENTATION,
    summary,
    atlasPreview,
    exportPlanSavingsPct: 91.7,
    skeletonBasename: 'CHJWC_SYMBOLS',
    lastOutDir: null,
    generatedAt: FIXED_GENERATED_AT,
    ...overrides,
  };
}

describe('renderDocumentationHtml (DOC-04)', () => {
  it('produces a valid HTML document', () => {
    const html = renderDocumentationHtml(makeMinimalPayload());
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html.endsWith('</html>')).toBe(true);
  });

  it('output is self-contained — no external assets', () => {
    const html = renderDocumentationHtml(makeMinimalPayload());
    expect(html).not.toMatch(/<img\s/);
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet/);
    expect(html).not.toMatch(/<script\s+src=/);
    expect(html).not.toMatch(/url\(['"]?https?:/);
    expect(html).not.toMatch(/@font-face/);
    expect(html).not.toMatch(/@import/);
  });

  it('HTML-escapes user-supplied notes (XSS attempt)', () => {
    const xssDoc: Documentation = {
      ...DEFAULT_DOCUMENTATION,
      generalNotes: '<script>alert(1)</script>',
      animationTracks: [
        {
          id: 'a',
          trackIndex: 0,
          animationName: '<img onerror="x">',
          mixTime: 0.25,
          loop: false,
          notes: '"&\'<>',
        },
      ],
    };
    const html = renderDocumentationHtml(makeMinimalPayload({ documentation: xssDoc }));
    expect(html).not.toMatch(/<script>alert\(1\)<\/script>/);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img onerror=&quot;x&quot;&gt;');
  });

  it('omits the Events card when summary.events.count === 0', () => {
    const html = renderDocumentationHtml(makeMinimalPayload());
    expect(html).not.toMatch(/card-header events/);
  });

  it('renders the Events card when summary.events.count > 0', () => {
    const summary = {
      ...makeMinimalPayload().summary,
      events: { count: 1, names: ['shoot'] },
    } as SkeletonSummary;
    const doc: Documentation = {
      ...DEFAULT_DOCUMENTATION,
      events: [{ name: 'shoot', description: 'Fires when ammo expended' }],
    };
    const html = renderDocumentationHtml(makeMinimalPayload({ summary, documentation: doc }));
    expect(html).toMatch(/card-header events/);
    expect(html).toContain('shoot');
    expect(html).toContain('Fires when ammo expended');
  });

  it('renders the hero with uppercased skeleton name', () => {
    const html = renderDocumentationHtml(
      makeMinimalPayload({ skeletonBasename: 'hello_world' }),
    );
    expect(html).toContain('Spine Documentation /');
    expect(html).toContain('HELLO_WORLD');
  });

  it('chip strip renders all 5 chips with locked formats', () => {
    const html = renderDocumentationHtml(makeMinimalPayload());
    expect(html).toMatch(/Generated: 14\/04\/2026/);
    expect(html).toContain('174 Images Utilized');
    // DEFAULT_DOCUMENTATION = 0 tracks; chip counts user-authored entries.
    expect(html).toContain('0 Animations Configured');
    expect(html).toContain('170 Optimized Assets');
    expect(html).toContain('4 Atlas Pages (2048px)');
  });

  it('renders the Animation Tracks table with track-divider rows + LOOP pill', () => {
    const doc: Documentation = {
      ...DEFAULT_DOCUMENTATION,
      animationTracks: [
        { id: 'a', trackIndex: 0, animationName: 'walk', mixTime: 0.25, loop: true, notes: 'Primary' },
        { id: 'b', trackIndex: 1, animationName: 'shoot', mixTime: 0.5, loop: false, notes: '' },
      ],
    };
    const html = renderDocumentationHtml(makeMinimalPayload({ documentation: doc }));
    expect(html).toContain('ANIMATION NAME');
    expect(html).toContain('MIX TIME');
    expect(html).toContain('LOOP');
    expect(html).toContain('NOTES');
    expect(html).toContain('Track 0');
    expect(html).toContain('Track 1');
    expect(html).toContain('walk');
    expect(html).toContain('0.25s');
    expect(html).toContain('loop-pill');
    // loop=false → em-dash placeholder cell.
    expect(html).toMatch(/<td[^>]*>—<\/td>/);
  });

  it('renders the Optimization Config card with safety buffer + savings', () => {
    const doc: Documentation = {
      ...DEFAULT_DOCUMENTATION,
      safetyBufferPercent: 1,
    };
    const html = renderDocumentationHtml(makeMinimalPayload({ documentation: doc }));
    // Safety buffer integer — "1%"; savings preformatted as "91.7%".
    expect(html).toContain('Optimization Config');
    expect(html).toContain('Safety Buffer');
    expect(html).toContain('Space Savings');
    expect(html).toContain('Estimated Reduction');
    // "1" rendered with explicit '%' suffix per copy-contract.
    expect(html).toMatch(/>1<\/div>%|>1%</);
    expect(html).toContain('91.7%');
  });

  it('renders Control Bones empty-state when no bones documented', () => {
    const html = renderDocumentationHtml(makeMinimalPayload());
    expect(html).toContain('Control Bones');
    expect(html).toContain('No control bones documented.');
  });

  it('snapshot — full HTML for fixed payload + generatedAt', () => {
    const html = renderDocumentationHtml(makeMinimalPayload());
    expect(html).toMatchSnapshot();
  });
});

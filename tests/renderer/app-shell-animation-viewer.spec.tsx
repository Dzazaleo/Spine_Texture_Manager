/**
 * Phase 41 — AppShell Animation Viewer wiring source-grep tests.
 *
 * Mirrors tests/renderer/app-shell-atlas-state.spec.tsx (Plan 40-07 pattern).
 * AppShell.tsx is too large (2500+ lines) for jsdom render; instead we read
 * the file as text and run regex assertions against the 7 insertion sites
 * Plan 41-03 must touch:
 *   1. Import line for AnimationPlayerModal
 *   2. animationViewerOpen useState slot
 *   3. onClickAnimationViewer useCallback
 *   4. Toolbar button JSX (with correct class string + disable predicate)
 *   5. AnimationPlayerModal JSX mount (with correct props)
 *   6. modalOpen OR-chain body AND dep array (Pitfall 7 - both required)
 *   7. Project-change cleanup useEffect with [summary] dep (Pitfall 6 - VIEWER-08)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const APP_SHELL_PATH = 'src/renderer/src/components/AppShell.tsx';

function appShellSource(): string {
  return readFileSync(APP_SHELL_PATH, 'utf8');
}

describe('Phase 41 — AppShell Animation Viewer wiring', () => {
  it("(1) imports AnimationPlayerModal from '../modals/AnimationPlayerModal'", () => {
    const src = appShellSource();
    expect(
      /import\s+\{\s*AnimationPlayerModal\s*\}\s+from\s+['"]\.\.\/modals\/AnimationPlayerModal['"]/.test(src),
    ).toBe(true);
  });

  it('(2) declares animationViewerOpen useState slot', () => {
    const src = appShellSource();
    expect(
      /const\s+\[\s*animationViewerOpen\s*,\s*setAnimationViewerOpen\s*\]\s*=\s*useState\(\s*false\s*\)/.test(src),
    ).toBe(true);
  });

  it('(3) setAnimationViewerOpen appears at least 3 times (declaration + open + close/cleanup)', () => {
    const src = appShellSource();
    const count = (src.match(/setAnimationViewerOpen\b/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it('(4) defines onClickAnimationViewer useCallback that sets animationViewerOpen=true', () => {
    const src = appShellSource();
    expect(/const\s+onClickAnimationViewer\s*=\s*useCallback/.test(src)).toBe(true);
    expect(/onClickAnimationViewer[\s\S]{0,200}setAnimationViewerOpen\(\s*true\s*\)/.test(src)).toBe(true);
  });

  it('(5) toolbar button has onClick={onClickAnimationViewer} + label "Animation Viewer"', () => {
    const src = appShellSource();
    expect(/onClick=\{onClickAnimationViewer\}/.test(src)).toBe(true);
    expect(/Animation Viewer/.test(src)).toBe(true);
  });

  it('(6) toolbar button disable predicate mirrors Atlas Preview', () => {
    const src = appShellSource();
    const buttonMatch = src.match(
      /onClick=\{onClickAnimationViewer\}[\s\S]{0,400}disabled=\{effectiveSummary\.peaks\.length\s*===\s*0\}/,
    );
    expect(buttonMatch).not.toBeNull();
  });

  it('(7) button class string is byte-identical to Atlas Preview (Tailwind v4 literal-class discipline)', () => {
    const src = appShellSource();
    const requiredClass =
      'border border-border rounded-md px-3 h-8 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent flex-shrink-0';
    const escaped = requiredClass.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    const occurrences = (src.match(new RegExp(escaped, 'g')) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('(8) Animation Viewer button is positioned BETWEEN Atlas Preview and Documentation (D-03a)', () => {
    const src = appShellSource();
    // JSX label rendering wraps the text with whitespace between `>` and `<`
    // (e.g. `>\n            Atlas Preview\n          </button>`); search the
    // button-label-text-followed-by-closing-button-tag pattern instead of
    // a tight `>X<` literal. The match `.index` is the byte offset of the
    // label-line within the source.
    const atlasMatch = src.match(/>\s*Atlas Preview\s*<\/button>/);
    const animationMatch = src.match(/>\s*Animation Viewer\s*<\/button>/);
    const documentationMatch = src.match(/>\s*Documentation\s*<\/button>/);
    expect(atlasMatch).not.toBeNull();
    expect(animationMatch).not.toBeNull();
    expect(documentationMatch).not.toBeNull();
    const atlasPreviewIdx = atlasMatch!.index!;
    const animationViewerIdx = animationMatch!.index!;
    const documentationIdx = documentationMatch!.index!;
    expect(animationViewerIdx).toBeGreaterThan(atlasPreviewIdx);
    expect(animationViewerIdx).toBeLessThan(documentationIdx);
  });

  it('(9) <AnimationPlayerModal> mount has summary={effectiveSummary} + loaderMode={loaderMode} + onClose', () => {
    const src = appShellSource();
    expect(
      /<AnimationPlayerModal[\s\S]{0,400}summary=\{effectiveSummary\}[\s\S]{0,400}loaderMode=\{loaderMode\}/.test(src),
    ).toBe(true);
    expect(
      /<AnimationPlayerModal[\s\S]{0,600}onClose=\{\s*\(\s*\)\s*=>\s*setAnimationViewerOpen\(\s*false\s*\)\s*\}/.test(src),
    ).toBe(true);
  });

  it('(10) <AnimationPlayerModal> JSX appears AFTER <AtlasPreviewModal> in source', () => {
    const src = appShellSource();
    const atlasModalIdx = src.indexOf('<AtlasPreviewModal');
    const viewerModalIdx = src.indexOf('<AnimationPlayerModal');
    expect(atlasModalIdx).toBeGreaterThan(-1);
    expect(viewerModalIdx).toBeGreaterThan(-1);
    expect(viewerModalIdx).toBeGreaterThan(atlasModalIdx);
  });

  it('(11) modalOpen derivation OR-chain BODY includes animationViewerOpen || (Pitfall 7)', () => {
    const src = appShellSource();
    // Locate the modalOpen const declaration; from that anchor scan forward
    // until the OR-chain terminator (a line of the form `<word>(Open|State);`)
    // appears, capturing the full block. Earlier `;` chars inside comments
    // ("08.2 D-184;") do NOT terminate the chain — only a `;` immediately
    // following an identifier at end-of-line does.
    const declIdx = src.search(/const\s+modalOpen\s*=/);
    expect(declIdx).toBeGreaterThan(-1);
    const tail = src.slice(declIdx);
    const termMatch = tail.match(/^[\s\S]*?(?:Open|State|null);\s*$/m);
    expect(termMatch).not.toBeNull();
    const block = termMatch![0];
    // The block must contain `animationViewerOpen ||` (not at end-of-chain;
    // some other entry must terminate so AVO is followed by `||`).
    expect(/animationViewerOpen\s*\|\|/.test(block)).toBe(true);
  });

  it('(12) modalOpen useEffect DEP ARRAY contains animationViewerOpen (Pitfall 7)', () => {
    const src = appShellSource();
    const useEffectMatch = src.match(
      /notifyMenuState\([\s\S]{0,500}?\}\);[\s\S]{0,200}?\}\s*,\s*\[([\s\S]{0,400}?)\]/,
    );
    expect(useEffectMatch).not.toBeNull();
    expect(/animationViewerOpen/.test(useEffectMatch![1])).toBe(true);
  });

  it('(13) project-change cleanup useEffect closes viewer on [summary] change (VIEWER-08, Pitfall 6)', () => {
    const src = appShellSource();
    expect(
      /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]{0,400}?setAnimationViewerOpen\(\s*false\s*\)[\s\S]{0,400}?\}\s*,\s*\[\s*summary\s*\]\s*\)/.test(src),
    ).toBe(true);
  });
});

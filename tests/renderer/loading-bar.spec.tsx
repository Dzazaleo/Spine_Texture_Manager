// @vitest-environment jsdom
/**
 * LoadingBar — indeterminate processing bar shown during App.tsx's
 * `loading` AppState (drop → Global panel populated). Decision
 * 2026-05-15: indeterminate (no percentage) because the initial-load
 * sampler emits no intermediate progress.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import { LoadingBar } from '../../src/renderer/src/components/LoadingBar';

afterEach(cleanup);

describe('LoadingBar — indeterminate processing bar', () => {
  it('renders the file name in the caption', () => {
    render(<LoadingBar fileName="SIMPLE_TEST.json" />);
    expect(screen.getByText('SIMPLE_TEST.json')).toBeTruthy();
  });

  it('falls back to a generic caption when no file name is given', () => {
    render(<LoadingBar />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('exposes a progressbar role', () => {
    render(<LoadingBar fileName="x.json" />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('is indeterminate — no aria-valuenow on the progressbar', () => {
    render(<LoadingBar fileName="x.json" />);
    const bar = screen.getByRole('progressbar');
    // Omitting aria-valuenow is the canonical ARIA signal for an
    // indeterminate operation. A determinate bar would set it.
    expect(bar.getAttribute('aria-valuenow')).toBeNull();
  });

  it('renders the swept segment carrying the .loading-bar-sweep class', () => {
    const { container } = render(<LoadingBar fileName="x.json" />);
    expect(container.querySelector('.loading-bar-sweep')).not.toBeNull();
  });
});

describe('LoadingBar — wiring + stylesheet contract (source grep)', () => {
  it("App.tsx renders <LoadingBar> in the 'loading' branch (not raw text)", () => {
    const src = readFileSync('src/renderer/src/App.tsx', 'utf8');
    expect(/state\.status === 'loading' &&\s*<LoadingBar/.test(src)).toBe(true);
    // The old raw-text hint must be gone so the two can't drift apart.
    expect(src.includes('Loading {state.fileName}…')).toBe(false);
  });

  it('index.css defines the loading-bar-sweep keyframe + reduced-motion fallback', () => {
    const css = readFileSync('src/renderer/src/index.css', 'utf8');
    expect(css.includes('@keyframes loading-bar-sweep')).toBe(true);
    expect(css.includes('.loading-bar-sweep')).toBe(true);
    expect(/prefers-reduced-motion: reduce/.test(css)).toBe(true);
  });
});

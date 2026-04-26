/**
 * Phase 2 Plan 02 — Reusable controlled search input.
 *
 * Used by the global-max render panel to filter rows by attachment name
 * (D-37 case-insensitive substring). Two UX refinements beyond a bare input:
 *
 *   1. Clear button (D-39): when the input has content, a small glyph button
 *      renders inside the right padding; clicking it resets the query.
 *      Uses type="text" not type="search" — WebKit/Chromium render a native
 *      cancel glyph inside type="search" inputs that stacks with our custom
 *      ✕ button (duplicate clear control); a11y is preserved via the
 *      aria-label on the custom button.
 *   2. Escape handling (D-42): first tap clears a non-empty value; second
 *      tap blurs. Standard power-user pattern.
 *
 * Minimal props per CONTEXT.md §"Integration Points": value, onChange,
 * optional placeholder. Parent owns state; this component is pure UI.
 *
 * Tailwind v4 Pitfall 8 discipline: every class string is a literal, no
 * template-string interpolation, clsx only for conditionals. See the
 * full-window drag component for the analog pattern.
 */
import { useCallback, type KeyboardEvent } from 'react';

export interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Escape') return;
      if (value !== '') {
        e.preventDefault();
        onChange('');
      } else {
        e.currentTarget.blur();
      }
    },
    [value, onChange],
  );

  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  return (
    <div className="relative flex-1 max-w-md">
      <input
        type="text"
        value={value}
        placeholder={placeholder ?? 'Filter by attachment name…'}
        className="w-full bg-panel border border-border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-fg-muted"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Filter rows by attachment name"
      />
      {value !== '' && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
        >
          {'✕'}
        </button>
      )}
    </div>
  );
}

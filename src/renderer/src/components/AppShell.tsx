/**
 * Phase 3 Plan 02 — Top-tab shell hosting the two panels (D-49 resolution).
 *
 * Provides header chrome (filename chip — hoisted from the prior global panel's
 * internal header per D-49) + a tab strip with two labels (D-51 order: Global
 * first, Animation Breakdown second). Owns the active-tab state (D-50 — plain
 * useState, no library, no persistence) and the focus-animation state
 * (D-52) used to thread jump-to-animation clicks from the Global tab's
 * Source Animation cells into the Animation Breakdown tab's scroll + flash
 * effect.
 *
 * State resets on every new skeleton drop by virtue of the parent's status
 * machine unmounting this component during the idle / loading transition —
 * no explicit reset useEffect needed.
 *
 * Layer 3 invariant: this file imports only from react, clsx, the shared types
 * file, and sibling renderer modules. It NEVER imports from src/core/*. The
 * tests/arch.spec.ts Layer 3 grep gate auto-scans this file on every test run.
 *
 * Tailwind v4 literal-class discipline: every className is a string literal
 * (or a clsx conditional with literal branches). No template interpolation.
 */
import { useCallback, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import type { SkeletonSummary } from '../../../shared/types.js';
import { GlobalMaxRenderPanel } from '../panels/GlobalMaxRenderPanel';
import { AnimationBreakdownPanel } from '../panels/AnimationBreakdownPanel';

type ActiveTab = 'global' | 'animation';

export interface AppShellProps {
  summary: SkeletonSummary;
}

export function AppShell({ summary }: AppShellProps) {
  // D-50: plain useState; default 'global' on every mount (i.e. every new drop).
  const [activeTab, setActiveTab] = useState<ActiveTab>('global');
  // D-52: jump-target; null means no pending focus.
  const [focusAnimationName, setFocusAnimationName] = useState<string | null>(null);

  const onJumpToAnimation = useCallback((name: string) => {
    setActiveTab('animation');
    setFocusAnimationName(name);
  }, []);

  const onFocusConsumed = useCallback(() => {
    setFocusAnimationName(null);
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-border bg-panel">
        {/* Filename chip — hoisted from the prior panel's internal header per D-49.
            Exact class string preserved from the prior panel's chip for visual continuity. */}
        <span className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg">
          {summary.skeletonPath}
        </span>
        <nav role="tablist" className="flex gap-1 items-center">
          <TabButton
            isActive={activeTab === 'global'}
            onClick={() => setActiveTab('global')}
          >
            Global
          </TabButton>
          <TabButton
            isActive={activeTab === 'animation'}
            onClick={() => setActiveTab('animation')}
          >
            Animation Breakdown
          </TabButton>
        </nav>
      </header>
      <main className="flex-1 overflow-auto">
        {activeTab === 'global' && (
          <GlobalMaxRenderPanel
            summary={summary}
            onJumpToAnimation={onJumpToAnimation}
          />
        )}
        {activeTab === 'animation' && (
          <AnimationBreakdownPanel
            summary={summary}
            focusAnimationName={focusAnimationName}
            onFocusConsumed={onFocusConsumed}
          />
        )}
      </main>
    </div>
  );
}

/**
 * One of the two tab strip buttons. Two-weight contract per the design spec:
 * active branch uses weight 600 (font-semibold); inactive branch uses weight
 * 400 (font-normal). Weight 500 is forbidden — active/inactive contrast is
 * carried by three orthogonal channels (weight + color + underline indicator).
 */
function TabButton({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      onClick={onClick}
      className={clsx(
        'relative px-4 py-2 text-sm font-sans transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-accent',
        isActive ? 'font-semibold text-accent' : 'font-normal text-fg-muted hover:text-fg',
      )}
    >
      {children}
      {isActive && (
        <span
          aria-hidden
          className="absolute left-0 right-0 -bottom-px h-[2px] bg-accent"
        />
      )}
    </button>
  );
}

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
 *
 * Phase 4 Plan 02 extension: owns `overrides: Map<string, number>` (D-74)
 * plus a nullable `dialogState` (D-77 lifecycle) and three callbacks
 * (onOpenOverrideDialog, onApplyOverride, onClearOverride). Renders
 * `<OverrideDialog>` conditionally below `<main>`. The overrides map resets
 * on every new drop by the same unmount-on-idle-transition mechanism that
 * resets activeTab (D-50 / D-74 parity). Layer 3: the clamp primitive is
 * imported from the renderer-side overrides-view module, never from the
 * pure-TS math tree — the latter would trip the arch.spec.ts gate at
 * lines 19-34.
 */
import { useCallback, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import type {
  SkeletonSummary,
  DisplayRow,
  BreakdownRow,
  ExportPlan,
} from '../../../shared/types.js';
import { GlobalMaxRenderPanel } from '../panels/GlobalMaxRenderPanel';
import { AnimationBreakdownPanel } from '../panels/AnimationBreakdownPanel';
import { OverrideDialog } from '../modals/OverrideDialog';
import { OptimizeDialog } from '../modals/OptimizeDialog';
import { clampOverride } from '../lib/overrides-view.js';
import { buildExportPlan } from '../lib/export-view.js';

type ActiveTab = 'global' | 'animation';

export interface AppShellProps {
  summary: SkeletonSummary;
}

export function AppShell({ summary }: AppShellProps) {
  // D-50: plain useState; default 'global' on every mount (i.e. every new drop).
  const [activeTab, setActiveTab] = useState<ActiveTab>('global');
  // D-52: jump-target; null means no pending focus.
  const [focusAnimationName, setFocusAnimationName] = useState<string | null>(null);

  // D-74: plain useState; resets on every mount (new drop remounts AppShell).
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());

  // D-77 dialog lifecycle — null means dialog closed.
  const [dialogState, setDialogState] = useState<{
    scope: string[];
    currentPercent: number;
    anyOverridden: boolean;
  } | null>(null);

  // Phase 6 Plan 06 — export dialog state. Held independently of
  // OverrideDialog's dialogState so the two modal lifecycles are
  // unambiguous. exportInFlight gates the toolbar button per D-117 +
  // T-06-18 mitigation (rapid double-click is a no-op until onRunEnd).
  const [exportDialogState, setExportDialogState] = useState<{
    plan: ExportPlan;
    outDir: string;
  } | null>(null);
  const [exportInFlight, setExportInFlight] = useState(false);

  const onJumpToAnimation = useCallback((name: string) => {
    setActiveTab('animation');
    setFocusAnimationName(name);
  }, []);

  const onFocusConsumed = useCallback(() => {
    setFocusAnimationName(null);
  }, []);

  const onOpenOverrideDialog = useCallback(
    (row: DisplayRow | BreakdownRow, selectedKeys?: ReadonlySet<string>) => {
      // D-86: batch only when the clicked row is in the selection set AND size > 1.
      // D-87: "clicked row not in selection" = per-row, ignore selection.
      // Gap-fix A + B (human-verify 2026-04-24): the selectedKeys contract
      // now carries attachmentName values (GlobalMaxRenderPanel converts its
      // internal attachmentKey selection before calling). See
      // 04-03-SUMMARY.md §Deviations.
      const inSelection =
        selectedKeys !== undefined &&
        selectedKeys.has(row.attachmentName) &&
        selectedKeys.size > 1;
      const scope = inSelection ? [...selectedKeys] : [row.attachmentName];
      // Gap-fix B (human-verify 2026-04-24): prefill is the existing override
      // when set, else round(peakScale * 100) of the clicked row — shows
      // current effective as the starting point in the new semantics where
      // 100% = source dimensions and no-override = peakScale default.
      // WR-01 (code review 2026-04-24): clamp the prefill so peakScale > 1.0
      // (e.g. SIMPLE_TEST's pre-scaled SQUARE2 bone at ~1.78×) doesn't display
      // a value above the "Max = 100%" helper text.
      const currentPercent = clampOverride(
        overrides.get(row.attachmentName) ?? Math.round(row.peakScale * 100),
      );
      // D-80: Reset-to-peak button visible when ANY scope row has an existing override.
      const anyOverridden = scope.some((name) => overrides.has(name));
      setDialogState({ scope, currentPercent, anyOverridden });
    },
    [overrides],
  );

  const onApplyOverride = useCallback((scope: string[], percent: number) => {
    // D-79: silent clamp on Apply. Layer 3 arch gate forbids core imports
    // from renderer; the renderer copy in lib/overrides-view is the
    // canonical path for renderer-side clamp math.
    const clamped = clampOverride(percent);
    setOverrides((prev) => {
      const next = new Map(prev);
      // D-88: batch writes the same percent to every scope entry.
      for (const name of scope) next.set(name, clamped);
      return next;
    });
    setDialogState(null);
  }, []);

  const onClearOverride = useCallback((scope: string[]) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      // D-76: clearing = delete from map; no sentinel. D-88: batch clears all scope.
      for (const name of scope) next.delete(name);
      return next;
    });
    setDialogState(null);
  }, []);

  // Phase 6 Plan 06 — D-117 + D-118 + D-122 toolbar click flow.
  //   1. Pre-fill the picker with <skeletonDir>/images-optimized/ (D-122).
  //      Strip the trailing JSON filename via a platform-agnostic regex
  //      so both / and \ separators work.
  //   2. If user cancels picker (returns null), abort.
  //   3. Build plan client-side via the renderer-side inline copy of
  //      buildExportPlan (Phase 4 D-75 Layer 3 inline-copy precedent —
  //      renderer NEVER imports from src/core/* per arch.spec.ts gate).
  //   4. Mount OptimizeDialog with the plan + outDir.
  const onClickOptimize = useCallback(async () => {
    const skeletonDir = summary.skeletonPath.replace(/[\\/][^\\/]+$/, '');
    const defaultOutDir = skeletonDir + '/images-optimized';
    const outDir = await window.api.pickOutputDirectory(defaultOutDir);
    if (outDir === null) return; // user cancelled picker
    const plan = buildExportPlan(summary, overrides);
    setExportDialogState({ plan, outDir });
  }, [summary, overrides]);

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
        {/* Phase 6 Plan 06 D-117: persistent toolbar button right-aligned
            via ml-auto. Disabled when no peaks (Pitfall 11 empty-rig) or
            while an export is in flight (T-06-18 — second click is a no-op
            until the dialog's onRunEnd fires). Reuses warm-stone tokens
            from Phase 1 D-12/D-14; semibold for emphasis without filling. */}
        <div className="ml-auto">
          <button
            type="button"
            onClick={onClickOptimize}
            disabled={summary.peaks.length === 0 || exportInFlight}
            className="border border-border rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-50"
          >
            Optimize Assets
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-auto">
        {activeTab === 'global' && (
          <GlobalMaxRenderPanel
            summary={summary}
            onJumpToAnimation={onJumpToAnimation}
            overrides={overrides}
            onOpenOverrideDialog={onOpenOverrideDialog}
          />
        )}
        {activeTab === 'animation' && (
          <AnimationBreakdownPanel
            summary={summary}
            focusAnimationName={focusAnimationName}
            onFocusConsumed={onFocusConsumed}
            overrides={overrides}
            onOpenOverrideDialog={onOpenOverrideDialog}
          />
        )}
      </main>
      {dialogState !== null && (
        <OverrideDialog
          open={true}
          scope={dialogState.scope}
          currentPercent={dialogState.currentPercent}
          anyOverridden={dialogState.anyOverridden}
          onApply={(percent) => onApplyOverride(dialogState.scope, percent)}
          onClear={() => onClearOverride(dialogState.scope)}
          onCancel={() => setDialogState(null)}
        />
      )}
      {/* Phase 6 Plan 06 — OptimizeDialog mount lives ALONGSIDE the
          OverrideDialog mount; the two modal lifecycles are independent.
          onRunStart/onRunEnd toggle exportInFlight so the toolbar button
          greys out for the duration of the export (D-117 + T-06-18). */}
      {exportDialogState !== null && (
        <OptimizeDialog
          open={true}
          plan={exportDialogState.plan}
          outDir={exportDialogState.outDir}
          onClose={() => setExportDialogState(null)}
          onRunStart={() => setExportInFlight(true)}
          onRunEnd={() => setExportInFlight(false)}
        />
      )}
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

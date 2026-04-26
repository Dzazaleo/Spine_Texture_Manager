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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import type {
  SkeletonSummary,
  DisplayRow,
  BreakdownRow,
  ExportPlan,
  AppSessionState,
  MaterializedProject,
  SaveResponse,
} from '../../../shared/types.js';
import { GlobalMaxRenderPanel } from '../panels/GlobalMaxRenderPanel';
import { AnimationBreakdownPanel } from '../panels/AnimationBreakdownPanel';
import { OverrideDialog } from '../modals/OverrideDialog';
import { OptimizeDialog } from '../modals/OptimizeDialog';
import { ConflictDialog } from '../modals/ConflictDialog';
import { AtlasPreviewModal } from '../modals/AtlasPreviewModal';
import { SaveQuitDialog, type SaveQuitDialogProps } from '../modals/SaveQuitDialog';
import { clampOverride } from '../lib/overrides-view.js';
import { buildExportPlan } from '../lib/export-view.js';

type ActiveTab = 'global' | 'animation';

export interface AppShellProps {
  summary: SkeletonSummary;
  /**
   * Phase 8 D-146 — sampling rate threaded from App.tsx. No Settings UI yet
   * (Phase 9); App.tsx passes a constant 120. Optional with default 120 to
   * keep existing call sites working during the App.tsx ripple in Task 4.
   */
  samplingHz?: number;
  /**
   * Phase 8 — present when AppShell is mounted with a project file already
   * loaded (i.e. App.tsx routed a `.stmproj` open through
   * `window.api.openProjectFromPath`). AppShell uses these values to seed
   * currentProjectPath, lastSaved, the restored overrides Map (with stale-key
   * drop already applied main-side per D-150), and the stale-override banner.
   * When undefined, AppShell mounts as a fresh untitled session (the existing
   * post-skeleton-drop flow).
   */
  initialProject?: MaterializedProject;
}

export function AppShell({ summary, samplingHz = 120, initialProject }: AppShellProps) {
  // D-50: plain useState; default 'global' on every mount (i.e. every new drop).
  const [activeTab, setActiveTab] = useState<ActiveTab>('global');
  // D-52: jump-target; null means no pending focus.
  const [focusAnimationName, setFocusAnimationName] = useState<string | null>(null);

  // Phase 7 D-130 — NEW: attachment jump-target plumbing (parallel to
  // focusAnimationName, different consumer panel — GlobalMaxRenderPanel).
  const [focusAttachmentName, setFocusAttachmentName] = useState<string | null>(null);

  // Phase 7 D-134 — NEW: Atlas Preview modal lifecycle. Plain boolean, no
  // snapshot state — the modal reads summary + overrides directly (D-131).
  const [atlasPreviewOpen, setAtlasPreviewOpen] = useState(false);

  // D-74: plain useState; resets on every mount (new drop remounts AppShell).
  // Phase 8: when initialProject is provided (.stmproj routed through App.tsx),
  // seed the Map from the restored Record (Pitfall 3 boundary: Object → Map at
  // the IPC seam). Stale keys are already dropped main-side per D-150.
  const [overrides, setOverrides] = useState<Map<string, number>>(
    () => new Map(initialProject ? Object.entries(initialProject.restoredOverrides) : []),
  );

  // ---------------------------------------------------------------------------
  // Phase 8 — Save/Load state (D-140..D-156). Plain useState, no Context
  // (matches D-74 / D-77).
  // ---------------------------------------------------------------------------

  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(
    initialProject?.projectFilePath ?? null,
  );

  /**
   * Snapshot of the persisted state at the most recent successful Save (or Open).
   * Null on a fresh untitled session. Phase 8 v1: tracks (overrides, samplingHz)
   * for the dirty signal; sortColumn/sortDir/lastOutDir are PERSISTED on Save
   * but do NOT participate in the dirty derivation (deferred to Phase 9 polish
   * — see truths block in plan frontmatter).
   */
  const [lastSaved, setLastSaved] = useState<{
    overrides: Record<string, number>;
    samplingHz: number;
  } | null>(
    initialProject
      ? {
          overrides: { ...initialProject.restoredOverrides },
          samplingHz: initialProject.samplingHz,
        }
      : null,
  );

  const [saveQuitDialogState, setSaveQuitDialogState] = useState<{
    reason: SaveQuitDialogProps['reason'];
    pendingAction: () => void;
  } | null>(null);

  const [saveInFlight, setSaveInFlight] = useState(false);

  const [staleOverrideNotice, setStaleOverrideNotice] = useState<string[] | null>(
    initialProject && initialProject.staleOverrideKeys.length > 0
      ? initialProject.staleOverrideKeys
      : null,
  );

  /**
   * D-149 inline error state. Set when a load attempt returns
   * SkeletonNotFoundOnLoadError; cleared after the locate-skeleton + reload
   * chain succeeds OR the user cancels. Cached fields needed for the reload
   * IPC are stashed alongside the error.
   */
  const [skeletonNotFoundError, setSkeletonNotFoundError] = useState<{
    message: string;
    originalSkeletonPath: string;
    projectPath: string;
    mergedOverrides: Record<string, number>;
    cachedSamplingHz: number;
    cachedLastOutDir: string | null;
    cachedSortColumn: string | null;
    cachedSortDir: 'asc' | 'desc' | null;
  } | null>(null);

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

  // Gap-Fix Round 3 (2026-04-25) — ConflictDialog state. Mounted on top of
  // OptimizeDialog (z-50 overlay → topmost) when probeExportConflicts
  // returns a non-empty list. Three user actions resolve the pending
  // confirmation promise:
  //   - Cancel              → close both dialogs, resolve { proceed: false }
  //   - Pick different folder → close ConflictDialog, re-pick, re-probe;
  //                             AppShell may either resolve { proceed: false }
  //                             (user cancels picker) or recurse into a fresh
  //                             ConflictDialog if the new folder also collides
  //   - Overwrite all       → close ConflictDialog, resolve { proceed: true,
  //                                                           overwrite: true }
  //
  // Implemented via a useRef holding the resolver of the in-flight promise
  // returned from onConfirmStart — the OptimizeDialog awaits this promise
  // before flipping to in-progress state.
  const [conflictState, setConflictState] = useState<{
    conflicts: string[];
  } | null>(null);
  // Pending resolver from the OptimizeDialog's onConfirmStart promise.
  // We use a ref (not state) because the resolver is consumed exactly once
  // and the consumer (button click handlers below) needs the LATEST value
  // synchronously without going through a re-render. Storing it in state
  // would risk stale-closure bugs when the user takes an action between
  // renders.
  const pendingConfirmResolve = useRef<
    ((decision: { proceed: boolean; overwrite?: boolean }) => void) | null
  >(null);

  const onJumpToAnimation = useCallback((name: string) => {
    setActiveTab('animation');
    setFocusAnimationName(name);
  }, []);

  const onFocusConsumed = useCallback(() => {
    setFocusAnimationName(null);
  }, []);

  // Phase 7 D-130 — NEW: Atlas Preview canvas dblclick → close modal +
  // switch to Global tab + dispatch focus to GlobalMaxRenderPanel. Three
  // state writes; narrow useCallback deps (only setters; React guarantees
  // setState identity is stable — empty deps array is correct).
  const onJumpToAttachment = useCallback((name: string) => {
    setActiveTab('global');
    setFocusAttachmentName(name);
    setAtlasPreviewOpen(false);
  }, []);

  const onFocusAttachmentConsumed = useCallback(() => {
    setFocusAttachmentName(null);
  }, []);

  // Phase 7 D-134 — NEW: toolbar button click handler.
  const onClickAtlasPreview = useCallback(() => {
    setAtlasPreviewOpen(true);
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
  //
  // Gap-Fix Round 3 (2026-04-25): the picker → buildPlan → mount sequence
  // is preserved here verbatim. The probe-then-confirm flow runs LATER,
  // when the user clicks Start inside OptimizeDialog (see onConfirmStart
  // below) — not on this initial toolbar click. This keeps the pre-flight
  // dialog usable as a "review before committing" surface even when
  // collisions exist.
  const pickOutputDir = useCallback(async (): Promise<string | null> => {
    // Phase 6 REVIEW L-01 (2026-04-25) — fall back to '.' (process cwd
    // resolution at the OS picker) when the skeleton path has no parent
    // segment. Edge case: a skeleton at filesystem root like '/skel.json'
    // would otherwise produce defaultOutDir = '/images-optimized' and
    // suggest writing to system root. Realistically nobody drops a skeleton
    // there, but the regex-strip approach has no defense and a one-token
    // fallback removes the suggestion entirely.
    const skeletonDir = summary.skeletonPath.replace(/[\\/][^\\/]+$/, '') || '.';
    const defaultOutDir = skeletonDir + '/images-optimized';
    return window.api.pickOutputDirectory(defaultOutDir);
  }, [summary.skeletonPath]);

  const onClickOptimize = useCallback(async () => {
    const outDir = await pickOutputDir();
    if (outDir === null) return; // user cancelled picker
    const plan = buildExportPlan(summary, overrides);
    setExportDialogState({ plan, outDir });
  }, [pickOutputDir, summary, overrides]);

  // Gap-Fix Round 3 (2026-04-25) — probe-then-confirm pipeline.
  //
  // OptimizeDialog calls this when the user clicks Start; we run the
  // backend conflict probe and either:
  //   - return { proceed: true, overwrite: false } if there are no
  //     conflicts (the dialog flips to in-progress and runs startExport
  //     with overwrite=false)
  //   - return a promise resolved later by ConflictDialog button clicks
  //     when conflicts ARE present (the user's choice translates into
  //     proceed/overwrite via the resolver in pendingConfirmResolve)
  //
  // Hard-reject case (outDir IS source-images-dir) returns ok:false from
  // the probe IPC; we surface a synthetic conflict dialog with the error
  // message... no, simpler: we resolve { proceed: false } and let the
  // OptimizeDialog flip to complete state with the synthetic error
  // (existing behaviour when startExport rejects). Actually NO — at this
  // point the dialog is still in pre-flight; if we return proceed:false
  // the dialog stays in pre-flight which is wrong. We fall through and
  // let startExport reject; the dialog's existing synthetic-summary path
  // surfaces the message.
  const onConfirmStart = useCallback(async (): Promise<{
    proceed: boolean;
    overwrite?: boolean;
  }> => {
    if (exportDialogState === null) return { proceed: false };
    const { plan, outDir } = exportDialogState;
    const probeResult = await window.api.probeExportConflicts(plan, outDir);
    if (!probeResult.ok) {
      // Hard-reject (e.g. outDir IS source-images-dir). Let the dialog
      // proceed; startExport will fail with the same error and the
      // existing synthetic-summary path surfaces the message in the
      // complete state.
      return { proceed: true, overwrite: false };
    }
    if (probeResult.conflicts.length === 0) {
      // No collisions — proceed straight to startExport without overwrite.
      return { proceed: true, overwrite: false };
    }
    // Conflicts exist — mount ConflictDialog and wait for user decision.
    return new Promise((resolve) => {
      pendingConfirmResolve.current = resolve;
      setConflictState({ conflicts: probeResult.conflicts });
    });
  }, [exportDialogState]);

  const closeBothDialogs = useCallback(() => {
    setConflictState(null);
    setExportDialogState(null);
    pendingConfirmResolve.current = null;
  }, []);

  // ConflictDialog: Cancel — back out entirely. Close both dialogs and
  // resolve the pending confirmation as not-proceed so OptimizeDialog
  // doesn't move past pre-flight.
  const onConflictCancel = useCallback(() => {
    const resolve = pendingConfirmResolve.current;
    pendingConfirmResolve.current = null;
    setConflictState(null);
    setExportDialogState(null);
    if (resolve) resolve({ proceed: false });
  }, []);

  // ConflictDialog: Overwrite all — proceed with overwrite=true.
  const onConflictOverwrite = useCallback(() => {
    const resolve = pendingConfirmResolve.current;
    pendingConfirmResolve.current = null;
    setConflictState(null);
    if (resolve) resolve({ proceed: true, overwrite: true });
  }, []);

  // ConflictDialog: Pick different folder — close conflict dialog, resolve
  // the in-flight confirmation as not-proceed (OptimizeDialog stays in
  // pre-flight), then re-trigger the picker. If the user picks a new
  // folder, rebuild the plan against the existing summary/overrides and
  // re-mount the OptimizeDialog (the user can then click Start again,
  // which re-enters the probe-then-confirm pipeline).
  const onConflictPickDifferent = useCallback(async () => {
    const resolve = pendingConfirmResolve.current;
    pendingConfirmResolve.current = null;
    setConflictState(null);
    if (resolve) resolve({ proceed: false });
    const newOutDir = await pickOutputDir();
    if (newOutDir === null) {
      // User cancelled the picker — close OptimizeDialog too. The user
      // backed out of the export entirely.
      setExportDialogState(null);
      return;
    }
    const plan = buildExportPlan(summary, overrides);
    setExportDialogState({ plan, outDir: newOutDir });
  }, [pickOutputDir, summary, overrides]);
  // closeBothDialogs is referenced in JSDoc above; keep the symbol live
  // for the typechecker even though it's no longer wired to any handler
  // (ConflictDialog Cancel routes through onConflictCancel which is more
  // specific — it must resolve the pending promise too).
  void closeBothDialogs;

  // ---------------------------------------------------------------------------
  // Phase 8 — Save/Load wiring (D-140..D-156). buildSessionState helper +
  // dirty derivation + click handlers + keyboard listener + before-quit
  // subscription. Layer 3 invariant: nothing here imports from src/core/*;
  // every IPC hop goes through window.api.* — preload owns the boundary.
  // ---------------------------------------------------------------------------

  const buildSessionState = useCallback(
    (): AppSessionState => ({
      skeletonPath: summary.skeletonPath,
      atlasPath: summary.atlasPath ?? null,
      imagesDir: null,
      overrides: Object.fromEntries(overrides),
      samplingHz,
      // Phase 9 polish — currently null; D-145 schema field present but
      // not yet hoisted into AppShell state. Documented deferral per D-147.
      lastOutDir: null,
      // D-91 default; Phase 9 hoists actual panel sort state.
      sortColumn: 'attachmentName',
      sortDir: 'asc',
    }),
    [summary.skeletonPath, summary.atlasPath, overrides, samplingHz],
  );

  /**
   * Phase 8 dirty derivation per D-145, narrowed: (overrides, samplingHz) only.
   * lastOutDir/sortColumn/sortDir are persisted on Save but excluded from the
   * dirty signal until Phase 9 hoists them to AppShell state. Documented
   * deferral — non-trivial refactor out of Phase 8 scope.
   *
   * Untitled session (lastSaved === null): dirty when overrides has any entries.
   * Loaded session: dirty when overrides Map differs from lastSaved.overrides
   * Record OR samplingHz differs.
   */
  const isDirty = useMemo(() => {
    if (lastSaved === null) {
      return overrides.size > 0;
    }
    if (overrides.size !== Object.keys(lastSaved.overrides).length) return true;
    for (const [k, v] of overrides) {
      if (lastSaved.overrides[k] !== v) return true;
    }
    if (samplingHz !== lastSaved.samplingHz) return true;
    return false;
  }, [overrides, lastSaved, samplingHz]);

  /**
   * onClickSave — Save when currentProjectPath is set; Save As otherwise.
   * Awaitable so the SaveQuitDialog 'quit' flow can chain pendingAction
   * after a successful save.
   */
  const onClickSave = useCallback(async (): Promise<SaveResponse> => {
    setSaveInFlight(true);
    try {
      const state = buildSessionState();
      let resp: SaveResponse;
      if (currentProjectPath !== null) {
        resp = await window.api.saveProject(state, currentProjectPath);
      } else {
        const skeletonDir = summary.skeletonPath.replace(/[\\/][^\\/]+$/, '') || '.';
        const basename =
          summary.skeletonPath.split(/[\\/]/).pop()?.replace(/\.json$/i, '') ?? 'Untitled';
        resp = await window.api.saveProjectAs(state, skeletonDir, basename);
        if (resp.ok) setCurrentProjectPath(resp.path);
      }
      if (resp.ok) {
        setLastSaved({
          overrides: { ...state.overrides },
          samplingHz: state.samplingHz ?? 120,
        });
        // Auto-clear stale-override notice on successful save (CONTEXT discretion).
        setStaleOverrideNotice(null);
      }
      return resp;
    } finally {
      setSaveInFlight(false);
    }
  }, [buildSessionState, currentProjectPath, summary.skeletonPath]);

  /**
   * mountOpenResponse — apply a MaterializedProject to AppShell's state
   * machine. Used by both onClickOpen (Cmd+O / Open button) and
   * onClickLocateSkeleton (D-149 recovery). Does NOT remount AppShell —
   * Open is fully self-contained at this level.
   *
   * Trade-off: Cmd+O works for the SAME-skeleton case (most common).
   * Cross-skeleton Open requires drag-dropping the .stmproj so App.tsx's
   * state machine can transition (re-mounts AppShell with new summary).
   */
  const mountOpenResponse = useCallback((project: MaterializedProject) => {
    setCurrentProjectPath(project.projectFilePath);
    setOverrides(new Map(Object.entries(project.restoredOverrides)));
    setLastSaved({
      overrides: { ...project.restoredOverrides },
      samplingHz: project.samplingHz,
    });
    setStaleOverrideNotice(
      project.staleOverrideKeys.length > 0 ? project.staleOverrideKeys : null,
    );
    setSkeletonNotFoundError(null);
  }, []);

  const onClickOpen = useCallback(async () => {
    const resp = await window.api.openProject();
    if (!resp.ok) {
      if (resp.error.kind === 'SkeletonNotFoundOnLoadError') {
        // The picker variant invokes main's handler which reads + parses the
        // file before failing — for SkeletonNotFoundOnLoadError to surface
        // useful info, main would need to thread the original skeletonPath
        // into the SerializableError.message. For Phase 8 v1 we surface the
        // error generically; the App.tsx path-based dispatch (Task 4) is
        // the recommended entry point because it has access to the
        // projectPath at error time. AppShell's Open button is best-effort.
        setSkeletonNotFoundError({
          message: resp.error.message,
          originalSkeletonPath: '',
          projectPath: '',
          mergedOverrides: {},
          cachedSamplingHz: 120,
          cachedLastOutDir: null,
          cachedSortColumn: null,
          cachedSortDir: null,
        });
        return;
      }
      // Other errors: surface via existing error UI. The inline banner pattern
      // is the standard.
      return;
    }
    mountOpenResponse(resp.project);
  }, [mountOpenResponse]);

  /**
   * D-149 recovery flow (Approach A). Triggered by the inline error
   * banner's "Locate skeleton…" button. Steps:
   *   1. Open the file picker via window.api.locateSkeleton(originalPath).
   *   2. If user picks a file, call window.api.reloadProjectWithSkeleton
   *      with the new path + cached overrides/settings from the failed Open.
   *   3. On success, mount the result via mountOpenResponse — same code
   *      path used for onClickOpen success. Clears skeletonNotFoundError.
   *
   * NO App.tsx callback. AppShell is self-contained for the recovery flow.
   */
  const onClickLocateSkeleton = useCallback(async () => {
    if (skeletonNotFoundError === null) return;
    const located = await window.api.locateSkeleton(skeletonNotFoundError.originalSkeletonPath);
    if (!located.ok) return; // user cancelled picker
    const resp = await window.api.reloadProjectWithSkeleton({
      projectPath: skeletonNotFoundError.projectPath,
      newSkeletonPath: located.newPath,
      mergedOverrides: skeletonNotFoundError.mergedOverrides,
      samplingHz: skeletonNotFoundError.cachedSamplingHz,
      lastOutDir: skeletonNotFoundError.cachedLastOutDir,
      sortColumn: skeletonNotFoundError.cachedSortColumn,
      sortDir: skeletonNotFoundError.cachedSortDir,
    });
    if (!resp.ok) {
      // Located file ALSO fails to load (rare). Update banner message but
      // keep the recovery affordance.
      setSkeletonNotFoundError({
        ...skeletonNotFoundError,
        message: resp.error.message,
      });
      return;
    }
    mountOpenResponse(resp.project);
  }, [skeletonNotFoundError, mountOpenResponse]);

  /**
   * Cmd/Ctrl+S+O keyboard listener with modal-suppression (Pattern 4 +
   * Pitfall 6). Suppresses when ANY role="dialog" is in the document —
   * every project modal uses role="dialog" so the heuristic is universal.
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMetaOrCtrl = e.metaKey || e.ctrlKey;
      if (!isMetaOrCtrl) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        e.stopPropagation();
        void onClickSave();
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        e.stopPropagation();
        void onClickOpen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClickSave, onClickOpen]);

  /**
   * before-quit dirty-guard subscription (D-143 + Pitfall 1). When the user
   * tries to quit while isDirty === true, mount SaveQuitDialog with reason
   * 'quit'. When clean, fire confirmQuitProceed immediately so main can
   * complete the quit.
   */
  useEffect(() => {
    const unsub = window.api.onCheckDirtyBeforeQuit(() => {
      if (!isDirty) {
        window.api.confirmQuitProceed();
        return;
      }
      setSaveQuitDialogState({
        reason: 'quit',
        pendingAction: () => {
          window.api.confirmQuitProceed();
        },
      });
    });
    return unsub;
  }, [isDirty]);

  // Task 2a vs Task 2b split: Task 2a lands the wiring (state + handlers);
  // Task 2b consumes the symbols in JSX (toolbar buttons + chip + modal
  // mount + banners). The void-references below keep Task 2a typecheck-
  // green; Task 2b removes them when the JSX consumes the symbols.
  void SaveQuitDialog;
  void saveQuitDialogState;
  void saveInFlight;
  void staleOverrideNotice;
  void onClickLocateSkeleton;

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
        <div className="ml-auto flex gap-2">
          {/* Phase 7 D-134: persistent Atlas Preview toolbar button — sits
              immediately LEFT of Optimize Assets (right-aligned cluster).
              Disabled when no peaks (summary not loaded yet or empty rig).
              Reuses warm-stone tokens; class string matches Optimize Assets
              for Tailwind v4 literal-class scanner discipline (Pitfall 3). */}
          <button
            type="button"
            onClick={onClickAtlasPreview}
            disabled={summary.peaks.length === 0}
            className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
          >
            Atlas Preview
          </button>
          <button
            type="button"
            onClick={onClickOptimize}
            disabled={summary.peaks.length === 0 || exportInFlight}
            className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
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
            /* Phase 7 D-130 NEW props — mirror AnimationBreakdownPanel's
               focusAnimationName/onFocusConsumed pair. */
            focusAttachmentName={focusAttachmentName}
            onFocusConsumed={onFocusAttachmentConsumed}
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
          greys out for the duration of the export (D-117 + T-06-18).

          Gap-Fix Round 3 (2026-04-25) — onConfirmStart wires the probe-
          then-confirm pipeline: OptimizeDialog awaits this BEFORE
          flipping to in-progress so the dialog never shows the running
          UI for an export that ConflictDialog cancelled. */}
      {exportDialogState !== null && (
        <OptimizeDialog
          open={true}
          plan={exportDialogState.plan}
          outDir={exportDialogState.outDir}
          onClose={() => setExportDialogState(null)}
          onRunStart={() => setExportInFlight(true)}
          onRunEnd={() => setExportInFlight(false)}
          onConfirmStart={onConfirmStart}
        />
      )}
      {/* Gap-Fix Round 3 (2026-04-25) — ConflictDialog stacks on top of
          OptimizeDialog (same z-50; later-mounted wins paint order). The
          three handlers each resolve the pending OptimizeDialog
          onConfirmStart promise so the dialog can either proceed,
          stay in pre-flight, or be backed out entirely. */}
      {conflictState !== null && (
        <ConflictDialog
          open={true}
          conflicts={conflictState.conflicts}
          onCancel={onConflictCancel}
          onPickDifferent={onConflictPickDifferent}
          onOverwrite={onConflictOverwrite}
        />
      )}
      {/* Phase 7 D-134 — Atlas Preview modal. Conditionally mounted (matches
          OverrideDialog/OptimizeDialog/ConflictDialog shape). Reads summary
          + overrides directly per D-131 snapshot-at-open semantics: the
          modal's internal useMemo captures the values on every mode/page
          toggle, and AppShell's overrides Map is the single source of
          truth — re-opening after an override edit re-snapshots. */}
      {atlasPreviewOpen && (
        <AtlasPreviewModal
          open={true}
          summary={summary}
          overrides={overrides}
          onJumpToAttachment={onJumpToAttachment}
          onClose={() => setAtlasPreviewOpen(false)}
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

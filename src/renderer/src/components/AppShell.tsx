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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
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
import {
  DEFAULT_DOCUMENTATION,
  intersectDocumentationWithSummary,
  type Documentation,
} from '../../../shared/types.js';
import { GlobalMaxRenderPanel } from '../panels/GlobalMaxRenderPanel';
import { AnimationBreakdownPanel } from '../panels/AnimationBreakdownPanel';
import { MissingAttachmentsPanel } from '../panels/MissingAttachmentsPanel';
import { UnusedAssetsPanel } from '../panels/UnusedAssetsPanel';
import { SearchBar } from './SearchBar';
import { OverrideDialog } from '../modals/OverrideDialog';
import { OptimizeDialog } from '../modals/OptimizeDialog';
import { ConflictDialog } from '../modals/ConflictDialog';
import { AtlasPreviewModal } from '../modals/AtlasPreviewModal';
import { SaveQuitDialog, type SaveQuitDialogProps } from '../modals/SaveQuitDialog';
import { SettingsDialog } from '../modals/SettingsDialog';
import { HelpDialog } from '../modals/HelpDialog';
import { DocumentationBuilderDialog } from '../modals/DocumentationBuilderDialog';
import { clampOverride } from '../lib/overrides-view.js';
import { buildExportPlan } from '../lib/export-view.js';
// Phase 20 D-21 — atlas-preview snapshot for the Documentation Builder's
// Export pane chip strip ("N Atlas Pages (MAX_PAGE_PXpx)"). Reuses the same
// builder AtlasPreviewModal mounts (AtlasPreviewModal.tsx:105). Mode/dim
// fixed: the chip is a single-line snapshot, not a stepper.
import { buildAtlasPreview } from '../lib/atlas-preview-view.js';

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
  /**
   * Phase 8.1 D-163 — callback-ref bridge for the new-skeleton/new-project
   * dirty-guard. App.tsx holds the useRef and passes it down here. AppShell
   * registers an impl in a useEffect that mounts SaveQuitDialog when isDirty
   * is true and a new .json/.stmproj is dropped. The impl resolves the
   * DropZone.onBeforeDrop Promise to false on Cancel, true on Save / Don't Save
   * (matching the 'quit' flow shape).
   *
   * When undefined, AppShell does not register anything and the drop
   * proceeds unconditionally — matches pre-Phase-8.1 behavior.
   */
  onBeforeDropRef?: MutableRefObject<
    ((fileName: string, kind: 'json' | 'stmproj') => Promise<boolean>) | null
  >;
  /**
   * Phase 08.2 D-175 — callback-ref bridge for menu-driven Save / Save As.
   * App.tsx holds the useRef; AppShell registers `{ onClickSave, onClickSaveAs }`
   * into ref.current via a useEffect. Menu click handlers in App.tsx
   * dereference at call time so the latest registered impl always wins;
   * when AppShell is unmounted the ref is null and the call is a no-op.
   *
   * Parallel to onBeforeDropRef (Phase 8.1 D-163) — same shape, same
   * registration discipline.
   */
  appShellMenuRef?: MutableRefObject<{
    onClickSave: () => Promise<SaveResponse>;
    onClickSaveAs: () => Promise<SaveResponse>;
  } | null>;
  /**
   * Phase 18 D-01 + D-02 — callback-ref bridge for the before-quit dirty-guard.
   * App.tsx holds the useRef; AppShell registers `{ isDirty, openSaveQuitDialog }`
   * into ref.current via a useEffect (see ref-registration block below the
   * isDirty memo). App.tsx's lifted before-quit IPC listener dereferences at
   * IPC-fire time so the latest registered impl always wins; when AppShell
   * is unmounted (idle / error / projectLoadFailed) the ref is null and
   * App.tsx's listener treats that as "no project loaded — fire
   * confirmQuitProceed immediately" (D-04 — closes QUIT-01 + QUIT-02).
   *
   * Object shape carries TWO members because the SaveQuitDialog mount slot
   * (saveQuitDialogState at line 232 + SaveQuitDialog mount at line 1357)
   * stays in AppShell — only the IPC subscription lifts:
   *   - isDirty()              → reads the AppShell isDirty memo (line 580).
   *   - openSaveQuitDialog(cb) → invokes setSaveQuitDialogState({ reason: 'quit',
   *                              pendingAction: cb }) so the existing Phase 8
   *                              SaveQuitDialog flow runs verbatim (D-03).
   *
   * Parallel to onBeforeDropRef (Phase 8.1 D-163) and appShellMenuRef
   * (Phase 08.2 D-175) — same shape, same registration discipline.
   */
  dirtyCheckRef?: MutableRefObject<{
    isDirty: () => boolean;
    openSaveQuitDialog: (onProceed: () => void) => void;
  } | null>;
}

export function AppShell({
  summary,
  samplingHz = 120,
  initialProject,
  onBeforeDropRef,
  appShellMenuRef,
  dirtyCheckRef,
}: AppShellProps) {
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

  // Phase 20 D-01 — Documentation Builder modal lifecycle. Plain boolean
  // mirroring atlasPreviewOpen above. The documentation state itself is
  // hoisted further down so its lazy initializer can intersect against the
  // current summary for D-09/D-10/D-11 drift policy on first paint.
  const [documentationBuilderOpen, setDocumentationBuilderOpen] = useState(false);

  // Phase 19 UI-01 + D-04 — NEW: panel filter query lifted up from the
  // GlobalMaxRenderPanel + AnimationBreakdownPanel internal useState slots
  // so the single sticky-bar SearchBar can drive both panels. Empty string
  // on every mount (no persistence). Plain useState mirrors the panel-side
  // shape at GlobalMaxRenderPanel.tsx:484 + AnimationBreakdownPanel.tsx:260.
  const [query, setQuery] = useState('');

  // Phase 9 Plan 02 D-194 — sampling-in-flight UI surface. Indeterminate
  // progress per RESEARCH §Q4 (byte-frozen sampler has no inner-loop emit
  // point; intermediate percent values do not arrive — percent is 0 on
  // start and 100 on complete). Toggling on `0` and clearing on `100`
  // gives the renderer a binary "is sampling running?" signal that drives
  // the spinner banner below.
  const [samplingInFlight, setSamplingInFlight] = useState<boolean>(false);

  // Phase 9 Plan 06 — Settings dialog lifecycle (Edit→Preferences from the
  // 08.2 menu surface; Plan 09-05 wired the IPC). Plain useState; null/false
  // when closed.
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  // Phase 9 Plan 07 — Help dialog lifecycle (Help→Documentation from the
  // 08.2 menu surface; Plan 09-05 wired menu:help-clicked + onMenuHelp).
  // Plain useState; false when closed. Pitfall 9 listener-identity
  // preservation lives in the preload — the wrapped const is captured there
  // so removeListener targets the same reference in our useEffect cleanup.
  const [helpOpen, setHelpOpen] = useState<boolean>(false);

  // Phase 14 Plan 03 (D-02) — UpdateDialog lifecycle LIFTED to App.tsx.
  // Pre-Phase-14 the update-state useState slot + manual-check-pending
  // useRef lived here. They've been moved to App.tsx because subscribers
  // need to be live in EVERY AppState branch (idle / loading / loaded /
  // projectLoaded / projectLoadFailed / error), not only the two branches
  // (loaded / projectLoaded) where AppShell mounts.

  // Phase 9 Plan 06 — local samplingHz state. Seeded from the prop; Settings
  // mutates this and a useEffect below dispatches the re-sample IPC. The
  // parent (App.tsx) re-renders AppShell with `samplingHz` prop fed from
  // state.project.samplingHz on the projectLoaded branch — but the local
  // override here wins for the duration of an in-flight sampling change.
  // After the re-sample completes, the parent's setState replaces the
  // summary AND threads the new samplingHz back via the prop, at which
  // point the prop and local state agree.
  const [samplingHzLocal, setSamplingHzLocal] = useState<number>(samplingHz);

  // Phase 9 Plan 06 — rig-info tooltip hover state. Plain useState (Pattern B
  // from PATTERNS §"src/renderer/src/components/RigInfoTooltip.tsx" —
  // testability via fireEvent.mouseEnter/Leave). The HTML `title=…` attribute
  // is replaced by this rich multi-line surface so the load-bearing
  // skeleton.fps wording (CLAUDE.md fact #1 + sampler.ts:41-44) can render
  // as structured content rather than a flat title string.
  const [rigInfoOpen, setRigInfoOpen] = useState<boolean>(false);

  // Phase 9 Plan 06 — local summary override for the post-resample state.
  // When SettingsDialog applies a new samplingHz, the resample IPC returns a
  // fresh SkeletonSummary; we hold it here so the panels render the new
  // peaks. The prop `summary` remains the canonical source for the initial
  // mount and any external state change (Open / drag-drop). When this is
  // null, the prop drives rendering — when set, the local override wins.
  const [localSummary, setLocalSummary] = useState<SkeletonSummary | null>(null);
  const effectiveSummary = localSummary ?? summary;

  // When the parent passes a new `summary` prop (e.g. App.tsx re-mounted
  // AppShell on a fresh drop), drop the localSummary override so the prop
  // wins again. Without this, dropping a NEW skeleton after a Settings
  // change would still show the previous skeleton's peaks.
  useEffect(() => {
    setLocalSummary(null);
  }, [summary]);

  // Phase 20 D-01 / D-09 / D-10 / D-11 — Documentation slot lifted into
  // AppShell. Lazy initializer intersects DEFAULT_DOCUMENTATION (or the
  // materialized .stmproj documentation, when present) with the live summary
  // so events + skins are pre-populated with empty descriptions ready to
  // author on first paint. The same helper runs on every materialize/load
  // (mountOpenResponse) and on local-summary changes (resample) so drift is
  // a single primitive — mirrors Phase 8 D-150 stale-overrides intersection.
  const [documentation, setDocumentation] = useState<Documentation>(() =>
    intersectDocumentationWithSummary(
      initialProject?.documentation ?? DEFAULT_DOCUMENTATION,
      summary,
    ),
  );

  // Phase 21 D-08 — per-project loader mode override. Lazy-initialized from
  // initialProject?.loaderMode (round-trips through .stmproj per Plan 07);
  // defaults to 'auto' (atlas-by-default) for first-time loads. Mirror of
  // the Phase 20 documentation slot pattern immediately above.
  //
  // NB: `loaderMode` is added to MaterializedProject + AppSessionState +
  // ResampleArgs in Plan 21-07 (concurrent worktree). The TS access here
  // expects those type widenings to land in the merge-back to main; on this
  // isolated branch typecheck reports the field as unknown until 21-07 is
  // merged. See 21-08 plan §parallel_execution for the orchestrator
  // coordination contract.
  const [loaderMode, setLoaderMode] = useState<'auto' | 'atlas-less'>(
    () => initialProject?.loaderMode ?? 'auto',
  );

  // Phase 23 — lastOutDir: session-metadata state slot. Seeded from
  // initialProject?.lastOutDir on load; updated by onConfirmStart after
  // the user confirms a folder on Start. Not in the dirty signal (D-08).
  const [lastOutDir, setLastOutDir] = useState<string | null>(
    () => initialProject?.lastOutDir ?? null,
  );

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
    // Phase 8.1 D-164: optional Cancel handler. Defaults to undefined.
    // The existing 'quit' flow keeps it undefined (Cancel is a no-op —
    // Electron already aborts the quit when before-quit returns false).
    // The new 'new-skeleton-drop' / 'new-project-drop' flows set it to
    // resolve the DropZone.onBeforeDrop Promise to false (abort the drop).
    cancelAction?: () => void;
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
    outDir: string | null;
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
  // Phase 23 — accepts explicit startPath so call sites can pre-fill with
  // lastOutDir (D-04) or skeletonDir (D-06 first-use default).
  const pickOutputDir = useCallback(
    async (startPath: string): Promise<string | null> => {
      return window.api.pickOutputDirectory(startPath);
    },
    [],
  );

  // Phase 23 OPT-01 — no picker before dialog; pre-flight is immediately
  // accessible. The picker moves to onConfirmStart (triggered by Start).
  const onClickOptimize = useCallback(async () => {
    const plan = buildExportPlan(summary, overrides);
    setExportDialogState({ plan, outDir: lastOutDir });
  }, [summary, overrides, lastOutDir]);

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
    const { plan } = exportDialogState;

    // Phase 23 D-03/D-04 — picker always opens on Start; pre-filled with
    // lastOutDir when saved, otherwise skeletonDir (Phase 12 F2 fix preserved).
    const startPath =
      lastOutDir ?? (summary.skeletonPath.replace(/[\\/][^\\/]+$/, '') || '.');
    const pickedDir = await pickOutputDir(startPath);
    if (pickedDir === null) {
      // D-05: user cancelled picker → stay in pre-flight (dialog stays open).
      return { proceed: false };
    }

    // Update outDir in state immediately so OptimizeDialog header title
    // reflects the confirmed folder during the probe wait.
    setExportDialogState((prev) => (prev ? { ...prev, outDir: pickedDir } : null));
    setLastOutDir(pickedDir);

    const probeResult = await window.api.probeExportConflicts(plan, pickedDir);
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
  }, [exportDialogState, lastOutDir, summary.skeletonPath, pickOutputDir]);

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
    // Phase 23: pickOutputDir now requires startPath; pre-fill with
    // lastOutDir when saved, else skeletonDir (D-04 / Phase 12 F2).
    const rePick = lastOutDir ?? (summary.skeletonPath.replace(/[\\/][^\\/]+$/, '') || '.');
    const newOutDir = await pickOutputDir(rePick);
    if (newOutDir === null) {
      // User cancelled the picker — close OptimizeDialog too. The user
      // backed out of the export entirely.
      setExportDialogState(null);
      return;
    }
    const plan = buildExportPlan(summary, overrides);
    setExportDialogState({ plan, outDir: newOutDir });
    setLastOutDir(newOutDir);
  }, [pickOutputDir, summary, overrides, lastOutDir]);
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
      // Phase 9 Plan 06 — read from samplingHzLocal so an in-flight Settings
      // change is reflected in the saved session state. The prop seeds the
      // local on first mount; SettingsDialog.onApply mutates the local,
      // which then drives the dirty derivation AND the next Save's payload.
      samplingHz: samplingHzLocal,
      // Phase 23 — lastOutDir now a real AppShell state slot (D-07).
      // Closes the D-145 / D-147 documented deferral from Phase 9.
      lastOutDir,
      // D-91 default; Phase 9 hoists actual panel sort state.
      sortColumn: 'attachmentName',
      sortDir: 'asc',
      // Phase 20 Plan 02 — documentation now flows from the AppShell-local
      // state slot driven by DocumentationBuilderDialog (Plan 02 Step B).
      // The slot is seeded by the lazy useState initializer above (with
      // intersect-against-summary applied for D-09/D-10/D-11 drift) and
      // updated by the modal's onChange / setDocumentation. Save/Save As
      // now persist the user-authored content alongside overrides.
      documentation,
      // Phase 21 D-08 — round-trip loaderMode through .stmproj per Plan 07's
      // serializeProjectFile / validateProjectFile / materializeProjectFile
      // extensions. AppSessionState gains the field in Plan 21-07.
      loaderMode,
    }),
    [
      summary.skeletonPath,
      summary.atlasPath,
      overrides,
      samplingHzLocal,
      documentation,
      loaderMode,
      lastOutDir,
    ],
  );

  // Phase 20 D-21 — always-current AtlasPreviewProjection for the Documentation
  // Builder's Export pane chip strip ("N Atlas Pages (MAX_PAGE_PXpx)"). Mirrors
  // AtlasPreviewModal.tsx:105 — same buildAtlasPreview call with fixed
  // mode='optimized' + maxPageDim=2048 because the chip is a single-line
  // snapshot, not a stepper. Mode 'optimized' matches the locked HTML-export
  // semantics (the chip counts pages of the OPTIMIZED atlas, mirroring the
  // OptimizeDialog savings).
  const atlasPreviewState = useMemo(
    () =>
      buildAtlasPreview(effectiveSummary, overrides, {
        mode: 'optimized',
        maxPageDim: 2048,
      }),
    [effectiveSummary, overrides],
  );

  // Phase 20 D-21 — savings-percentage snapshot for the HTML export's
  // Optimization Config card. Formula LOCKED in 20-CONTEXT.md D-18 sub-step 3:
  // (1 - sumOutPixels / sumSourcePixels) * 100, byte-identical to
  // OptimizeDialog.tsx:280-291 (visual source-of-truth on the existing Optimize
  // Assets dialog). Returns null when there are no rows in the plan (avoids
  // divide-by-zero AND signals "no data" to the HTML export's '—' placeholder
  // per renderOptimizationConfigCard in src/main/doc-export.ts).
  const savingsPctMemo = useMemo<number | null>(() => {
    const plan = buildExportPlan(effectiveSummary, overrides);
    if (plan.rows.length === 0) return null;
    const sumSourcePixels = plan.rows.reduce(
      (acc, r) => acc + r.sourceW * r.sourceH,
      0,
    );
    const sumOutPixels = plan.rows.reduce((acc, r) => acc + r.outW * r.outH, 0);
    if (sumSourcePixels <= 0) return null;
    return (1 - sumOutPixels / sumSourcePixels) * 100;
  }, [effectiveSummary, overrides]);

  /**
   * Phase 8 dirty derivation per D-145, narrowed: (overrides, samplingHz) only.
   * lastOutDir/sortColumn/sortDir are persisted on Save but excluded from the
   * dirty signal until Phase 9 hoists them to AppShell state. Documented
   * deferral — non-trivial refactor out of Phase 8 scope.
   *
   * Untitled session (lastSaved === null): dirty when overrides has any entries.
   * Loaded session: dirty when overrides Map differs from lastSaved.overrides
   * Record OR samplingHz differs.
   *
   * Phase 9 Plan 06 — read samplingHzLocal here so a Settings change marks
   * the project dirty even before the re-sample IPC returns. AppShell's
   * existing :506-508 dirty contract is preserved verbatim — only the
   * dependency source changes (prop → local state seeded from prop).
   */
  const isDirty = useMemo(() => {
    if (lastSaved === null) {
      return overrides.size > 0;
    }
    if (overrides.size !== Object.keys(lastSaved.overrides).length) return true;
    for (const [k, v] of overrides) {
      if (lastSaved.overrides[k] !== v) return true;
    }
    if (samplingHzLocal !== lastSaved.samplingHz) return true;
    return false;
  }, [overrides, lastSaved, samplingHzLocal]);

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
   * Phase 08.2 D-175 — dedicated Save As callback for the native menu's
   * "Save As…" item. Always picks a new path via the dialog regardless
   * of currentProjectPath. The toolbar Save button continues to use
   * onClickSave's smart branch (current behavior).
   *
   * Mirrors the Save As branch previously inlined in onClickSave. Both
   * register into appShellMenuRef so menu File→Save / File→Save As… can
   * dispatch through AppShell's existing handlers without lifting state.
   */
  const onClickSaveAs = useCallback(async (): Promise<SaveResponse> => {
    setSaveInFlight(true);
    try {
      const state = buildSessionState();
      const skeletonDir = summary.skeletonPath.replace(/[\\/][^\\/]+$/, '') || '.';
      const basename =
        summary.skeletonPath.split(/[\\/]/).pop()?.replace(/\.json$/i, '') ?? 'Untitled';
      const resp = await window.api.saveProjectAs(state, skeletonDir, basename);
      if (resp.ok) {
        setCurrentProjectPath(resp.path);
        setLastSaved({
          overrides: { ...state.overrides },
          samplingHz: state.samplingHz ?? 120,
        });
        setStaleOverrideNotice(null);
      }
      return resp;
    } finally {
      setSaveInFlight(false);
    }
  }, [buildSessionState, summary.skeletonPath]);

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
    // Phase 9 Plan 06 — handleProjectResample passes empty-string for the
    // projectFilePath when AppShell is in the skeleton-only branch (no
    // .stmproj saved yet). Treat empty as null so the filename chip keeps
    // showing 'Untitled' rather than ''. The Open / Save As paths still
    // pass real .stmproj paths and slot in unchanged.
    setCurrentProjectPath(project.projectFilePath !== '' ? project.projectFilePath : null);
    setOverrides(new Map(Object.entries(project.restoredOverrides)));
    setLastSaved({
      overrides: { ...project.restoredOverrides },
      samplingHz: project.samplingHz,
    });
    setStaleOverrideNotice(
      project.staleOverrideKeys.length > 0 ? project.staleOverrideKeys : null,
    );
    setSkeletonNotFoundError(null);
    // Phase 20 D-09/D-10/D-11 — drift-policy intersection on every materialize/
    // load. Any saved documentation entries whose names no longer exist in
    // the live skeleton are dropped silently; events + skins are auto-added
    // with empty descriptions. Single primitive, single call site (mirrors
    // Phase 8 D-150 stale-overrides intersection above).
    setDocumentation(
      intersectDocumentationWithSummary(project.documentation, project.summary),
    );
    // Phase 21 D-08 — restore loaderMode from materialized project. Plan 21-07's
    // materializeProjectFile back-fills file.loaderMode ?? 'auto', so legacy
    // .stmproj files without the field default to 'auto' here as well.
    setLoaderMode(project.loaderMode ?? 'auto');
    setLastOutDir(project.lastOutDir ?? null);
  }, []);

  const onClickOpen = useCallback(async () => {
    // Phase 9 Plan 02 D-194 — if a sample is in flight (e.g., user clicked
    // Cmd+O via the 08.2 menu while the previous Open's sample is still
    // running), abort the in-flight sample first. The new Open's sample
    // contests for the same module-level samplerWorkerHandle in main; pre-
    // empting cleanly via terminate() avoids the user briefly seeing stale
    // peaks from the old project.
    if (samplingInFlight) {
      window.api.cancelSampler();
      // Optimistic UI clear — the cancelled response will arrive shortly via
      // the open's ok:false branch but clearing immediately gives crisper UX.
      setSamplingInFlight(false);
    }
    const resp = await window.api.openProject();
    if (!resp.ok) {
      if (resp.error.kind === 'SkeletonNotFoundOnLoadError') {
        // Phase 8.1 D-160: read the threaded recovery payload from the typed
        // envelope. The discriminated-union narrowing exposes 7 additional
        // fields populated by handleProjectOpenFromPath at
        // src/main/project-io.ts:333-343 (Plan 08.1-02). The toolbar Open
        // path now has full parity with the drag-drop path —
        // onClickLocateSkeleton's reloadProjectWithSkeleton call receives
        // the real projectPath, the real originalSkeletonPath, and the
        // real cached overrides + settings. Pre-Phase-8.1 these were empty
        // literals, causing main's input validator to reject the recovery
        // request with kind:'Unknown', message:'projectPath must be a
        // .stmproj path' — VR-02 from 08-VERIFICATION.md.
        setSkeletonNotFoundError({
          message: resp.error.message,
          originalSkeletonPath: resp.error.originalSkeletonPath,
          projectPath: resp.error.projectPath,
          mergedOverrides: resp.error.mergedOverrides,
          cachedSamplingHz: resp.error.samplingHz,
          cachedLastOutDir: resp.error.lastOutDir,
          cachedSortColumn: resp.error.sortColumn,
          cachedSortDir: resp.error.sortDir,
        });
        return;
      }
      // Other errors: surface via existing error UI. The inline banner pattern
      // is the standard.
      return;
    }
    mountOpenResponse(resp.project);
  }, [mountOpenResponse, samplingInFlight]);

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
   * Phase 08.2 D-176 — the renderer-side Cmd/Ctrl+S+O keydown listener
   * has been DELETED end-to-end. The native Electron application Menu
   * (Phase 08.2 Plan 02) is the single source of truth for these
   * keyboard accelerators; menu clicks dispatch via webContents.send →
   * preload → App.tsx's onMenu* subscriptions (Phase 08.2 D-175). The
   * `[role="dialog"]` modal-suppression heuristic moved into the
   * notifyMenuState push below (D-184): when any modal is open, main
   * disables the File menu items so the accelerator becomes a no-op
   * at the OS level. Eliminates the double-fire risk between the
   * old keydown listener and the menu accelerator.
   */

  /**
   * Phase 9 Plan 02 D-194 — subscribe to sampler progress events.
   * Pitfall 9 + 15 (RESEARCH): cleanup MUST return the unsubscribe closure;
   * the wrapped const inside preload preserves listener identity so
   * removeListener actually removes the subscription.
   *
   * Progress is indeterminate (0 → 100, no intermediate ticks). We toggle
   * samplingInFlight on receipt of `0` (sampling started) and clear it on
   * `100` (sampling completed). On cancel/error the bridge does NOT emit
   * a final progress event — clearing happens via the project-open
   * continuation (the open returns ok:false; the cancel handler in
   * onClickOpen also clears optimistically).
   */
  useEffect(() => {
    const unsubscribe = window.api.onSamplerProgress((percent) => {
      if (percent === 0) setSamplingInFlight(true);
      else if (percent >= 100) setSamplingInFlight(false);
    });
    return unsubscribe;
  }, []);

  /**
   * Phase 08.2 D-181 / D-184 — push menu state to main whenever the
   * dependency set changes. summary is non-null while AppShell is mounted
   * (loaded / projectLoaded branches), so canSave + canSaveAs are always
   * true here. modalOpen is derived from the four modal state slots
   * (dialogState — OverrideDialog, exportDialogState — Optimize/Export
   * dialog, atlasPreviewOpen — AtlasPreviewModal, saveQuitDialogState —
   * SaveQuitDialog); main disables File menu items when modalOpen is
   * true (D-184) so the keyboard accelerator becomes a no-op at the OS
   * level whenever a modal is mounted.
   */
  useEffect(() => {
    const modalOpen =
      dialogState !== null ||
      exportDialogState !== null ||
      atlasPreviewOpen ||
      saveQuitDialogState !== null ||
      // Phase 9 Plan 06 — SettingsDialog also participates in the modalOpen
      // derivation. While open, File menu items (Save / Save As) get
      // disabled at the OS level via 08.2 D-184 — same automatic surface
      // every other [role="dialog"][aria-modal="true"] modal gets.
      settingsOpen ||
      // Phase 9 Plan 07 — HelpDialog joins the same derivation. aria-modal
      // alone would auto-suppress via 08.2 D-184, but explicit inclusion
      // keeps the derivation list parallel with the other 5 modal slots.
      helpOpen ||
      // Phase 20 D-01 — DocumentationBuilderDialog joins the derivation.
      // role="dialog" + aria-modal="true" already auto-suppresses File menu
      // via 08.2 D-184; explicit inclusion keeps the audit list parallel
      // with the other 6 modal slots.
      documentationBuilderOpen;
      // Phase 14 Plan 03 — UpdateDialog removed from AppShell's modalOpen
      // derivation; the update-dialog state now lives in App.tsx (lifted
      // per D-02). The dialog's role="dialog" + aria-modal="true" still
      // auto-suppress File menu items via the 08.2 D-184 contract —
      // explicit inclusion is no longer needed because AppShell no longer
      // owns the dialog state.
    window.api.notifyMenuState({
      canSave: true,
      canSaveAs: true,
      modalOpen,
    });
  }, [
    dialogState,
    exportDialogState,
    atlasPreviewOpen,
    saveQuitDialogState,
    settingsOpen,
    helpOpen,
    documentationBuilderOpen,
  ]);

  /**
   * Phase 9 Plan 06 — Settings menu subscription. The native Edit→Preferences…
   * menu item (Plan 09-05 Task 1) fires `menu:settings-clicked`; we lift the
   * SettingsDialog open state in response. Pitfall 9 listener-identity
   * preservation lives in the preload (Plan 09-05 Task 2 onMenuSettings);
   * the wrapped const is captured there so removeListener targets the same
   * reference in our cleanup.
   */
  useEffect(() => {
    const unsubscribe = window.api.onMenuSettings(() => setSettingsOpen(true));
    return unsubscribe;
  }, []);

  /**
   * Phase 9 Plan 07 — Help menu subscription. The native Help→Documentation
   * menu item (Plan 09-05 Task 1) fires `menu:help-clicked`; we lift the
   * HelpDialog open state in response. Pitfall 9 listener-identity
   * preservation lives in the preload (Plan 09-05 Task 2 onMenuHelp); the
   * wrapped const is captured there so removeListener targets the same
   * reference in our cleanup. Mirrors the onMenuSettings useEffect above
   * verbatim — only the channel name and state setter differ.
   */
  useEffect(() => {
    const unsubscribe = window.api.onMenuHelp(() => setHelpOpen(true));
    return unsubscribe;
  }, []);

  /**
   * Phase 14 Plan 03 (D-02) — auto-update IPC subscriptions LIFTED to App.tsx.
   * The 5 update-related subscribers plus the UpdateDialog mount + the
   * update-dialog state slot + the manual-check-pending ref all live in
   * App.tsx now. AppShell only retains the install-guide menu subscriber —
   * that's a Plan 12-06 D-16.3 install-guide concern, NOT an update-state
   * concern, so it stays here.
   *
   * Pitfall 9 listener-identity preservation lives in the preload
   * (src/preload/index.ts — wrapped const captured BEFORE ipcRenderer.on).
   */
  useEffect(() => {
    // Phase 12 Plan 06 (D-16.3) — Help → Installation Guide… opens the
    // INSTALL.md page externally. URL literal MUST match the
    // SHELL_OPEN_EXTERNAL_ALLOWED Set entry in src/main/ipc.ts AND
    // HelpDialog's INSTALL_DOC_URL constant byte-for-byte (D-18 exact-string
    // allow-list compares strings by value; mismatches are silently dropped).
    // URL-consistency across all 4 surfaces is gated by
    // tests/integration/install-md.spec.ts.
    const unsubMenuInstall = window.api.onMenuInstallationGuide(() => {
      window.api.openExternalUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md');
    });
    return () => {
      unsubMenuInstall();
    };
  }, []);

  /**
   * Phase 9 Plan 06 — re-sample on samplingHz change (RESEARCH §Pitfall 7).
   *
   * The first useEffect run (mount) is skipped via the `resampleSkipMount`
   * ref — the project was JUST loaded with the correct samplingHz so a
   * re-sample would be a no-op-shaped duplicate. Subsequent changes (driven
   * by SettingsDialog.onApply) dispatch the new IPC and refresh the
   * displayed peaks via the local summary override.
   *
   * On error: leave the prior summary in place; the panels keep showing
   * the old peaks. A future polish phase could surface the error via the
   * existing skeletonNotFoundError banner family — this error path is
   * extremely rare (the skeleton file would have to vanish between Open
   * and Apply) so silent recovery is acceptable for v1.
   *
   * Cancellation: when the user opens a different file mid-resample, the
   * existing onClickOpen path calls cancelSampler() (Phase 9 Plan 02
   * D-194) which terminate()s the worker; our await resolves with
   * `ok: false, error: { kind: 'Unknown', message: 'Sampling cancelled.' }`
   * and we fall through.
   */
  const resampleSkipMount = useRef<boolean>(true);
  useEffect(() => {
    if (resampleSkipMount.current) {
      resampleSkipMount.current = false;
      return;
    }
    let cancelled = false;
    void (async () => {
      const resp = await window.api.resampleProject({
        skeletonPath: summary.skeletonPath,
        // Phase 21 D-03: SkeletonSummary.atlasPath is now `string | null`; the
        // resampleProject IPC contract expects `string | undefined`. Coerce
        // null → undefined at this seam (project-io.ts:840 already routes
        // undefined through cleanly per RESEARCH.md §Pitfall 8).
        atlasPath: summary.atlasPath ?? undefined,
        samplingHz: samplingHzLocal,
        // Pitfall 3 boundary conversion: Map → Record at the IPC seam.
        overrides: Object.fromEntries(overrides),
        lastOutDir: null,
        sortColumn: 'attachmentName',
        sortDir: 'asc',
        projectFilePath: currentProjectPath,
        // Phase 21 D-08 — main re-runs loadSkeleton(skeletonPath, { atlasPath,
        // loaderMode }) so flipping the toggle picks the right branch (Plan
        // 21-07 wires this into runSamplerInWorker + project-io.ts loadSkeleton
        // calls). ResampleArgs gains the field in Plan 21-07's types extension.
        loaderMode,
      });
      // Guard against a stale response landing after the next samplingHz
      // change (or unmount). The cancelled flag below is set by the
      // cleanup callback; if true, drop the response on the floor.
      if (cancelled) return;
      if (resp.ok) {
        // Replace the displayed summary AND refresh lastSaved.samplingHz so
        // the dirty-derivation does not stay perpetually dirty after the
        // user accepts the new rate. Stale-override keys are surfaced via
        // the existing banner; restoredOverrides re-mounts the Map.
        setLocalSummary(resp.project.summary);
        setOverrides(new Map(Object.entries(resp.project.restoredOverrides)));
        setStaleOverrideNotice(
          resp.project.staleOverrideKeys.length > 0
            ? resp.project.staleOverrideKeys
            : null,
        );
        // Phase 20 D-09/D-10/D-11 — re-intersect documentation against the
        // post-resample summary. The resample IPC payload's `documentation`
        // is a placeholder (main does not round-trip it through resample);
        // the renderer-local documentation state is the source of truth.
        setDocumentation((prev) =>
          intersectDocumentationWithSummary(prev, resp.project.summary),
        );
        // After resample, the new samplingHz is now the "current saved"
        // value if we were already saved (lastSaved !== null). For untitled
        // sessions, lastSaved stays null and Save will capture it later.
        setLastSaved((prev) =>
          prev !== null ? { ...prev, samplingHz: samplingHzLocal } : prev,
        );
      }
      // ok:false: silent — leave the existing summary in place. Future
      // polish: thread an error banner.
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally narrow deps: re-fire only on samplingHzLocal OR loaderMode
    // changes. Including overrides / paths in the deps would re-trigger a
    // sample on every override edit, which is the wrong contract — overrides
    // are a post-sample percent multiplier, not an input to the sampler.
    //
    // Phase 21 D-08 — `loaderMode` is included so flipping the
    // "Use Images Folder as Source" checkbox triggers a resample (the loader
    // routes through a different branch and produces different sourceDims
    // provenance — `png-header` vs `atlas-orig`/`atlas-bounds`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samplingHzLocal, loaderMode]);

  /**
   * Phase 8.1 D-163 — register the dirty-guard impl into App.tsx's
   * onBeforeDropRef. Cleanup on unmount sets the ref back to null so
   * subsequent drops post-unmount fall through to handleBeforeDrop's
   * `?? true` fallback (proceed without a guard — the unmount itself
   * signals a confirmed transition).
   *
   * isDirty is read INSIDE the impl (via the Promise factory closure)
   * so the registered callback always sees the latest dirty signal —
   * the useEffect re-runs when isDirty changes, re-binding the impl.
   */
  useEffect(() => {
    if (!onBeforeDropRef) return;
    onBeforeDropRef.current = (_fileName, kind) =>
      new Promise<boolean>((resolve) => {
        if (!isDirty) {
          resolve(true);
          return;
        }
        const reason: SaveQuitDialogProps['reason'] =
          kind === 'json' ? 'new-skeleton-drop' : 'new-project-drop';
        setSaveQuitDialogState({
          reason,
          // Save / Don't Save: resolve true → DropZone proceeds.
          // The pendingAction fires AFTER setSaveQuitDialogState(null) so the
          // dialog closes before the drop's IPC handshake begins (D-167 —
          // overrides die with the unmount when the new skeleton lands).
          pendingAction: () => resolve(true),
          // Cancel: resolve false → DropZone aborts → overrides survive.
          cancelAction: () => resolve(false),
        });
      });
    return () => {
      onBeforeDropRef.current = null;
    };
  }, [isDirty, onBeforeDropRef]);

  /**
   * Phase 08.2 D-175 — register Save / Save As handlers into App.tsx's
   * appShellMenuRef so the native menu's File→Save / File→Save As… items
   * can dispatch through AppShell's existing handlers without lifting
   * state. Cleanup nulls the ref on unmount so menu clicks fall through
   * to no-op when AppShell isn't mounted.
   *
   * Parallel to onBeforeDropRef (Phase 8.1 D-163).
   */
  useEffect(() => {
    if (!appShellMenuRef) return;
    appShellMenuRef.current = { onClickSave, onClickSaveAs };
    return () => {
      appShellMenuRef.current = null;
    };
  }, [onClickSave, onClickSaveAs, appShellMenuRef]);

  /**
   * Phase 18 D-02 — register `{ isDirty, openSaveQuitDialog }` into App.tsx's
   * dirtyCheckRef so the lifted before-quit IPC listener at App.tsx can read
   * the current dirty signal AND trigger the existing Phase 8 SaveQuitDialog
   * flow without owning AppShell's state.
   *
   * Closure freshness: the dep array includes `isDirty` so each isDirty
   * change re-binds the closure with the latest captured value (Pitfall 9 /
   * 15 listener-identity discipline). Cleanup nulls the ref so when
   * AppShell unmounts (transition out of `loaded` / `projectLoaded`),
   * App.tsx's lifted listener sees `null` and treats it as "no project
   * loaded — fire confirmQuitProceed immediately" (D-04 — closes QUIT-01 +
   * QUIT-02 from idle / error / projectLoadFailed).
   *
   * D-03: openSaveQuitDialog wraps setSaveQuitDialogState verbatim with
   * reason 'quit' and the proceed callback supplied by App.tsx — the
   * existing Phase 8 SaveQuitDialog mount at the bottom of this component
   * (line ~1357) drives Save / Don't Save / Cancel exactly as before.
   *
   * Parallel to onBeforeDropRef (Phase 8.1 D-163) and appShellMenuRef
   * (Phase 08.2 D-175) — same shape, same registration discipline.
   */
  useEffect(() => {
    if (!dirtyCheckRef) return;
    dirtyCheckRef.current = {
      isDirty: () => isDirty,
      openSaveQuitDialog: (onProceed) => {
        setSaveQuitDialogState({
          reason: 'quit',
          pendingAction: onProceed,
        });
      },
    };
    return () => {
      dirtyCheckRef.current = null;
    };
  }, [isDirty, dirtyCheckRef]);

  return (
    <div className="w-full min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-4 px-6 py-3 border-b border-border bg-panel">
        {/* Filename chip — hoisted from the prior panel's internal header per D-49.
            Phase 8 D-144 dirty marker: prepends '• ' (U+2022) when isDirty is true.
            Renders 'Untitled' when currentProjectPath is null; otherwise the project
            basename. Class string preserved verbatim for visual continuity.
            Phase 9 Plan 06 — wrapped in a hoverable container with a rich rig-info
            tooltip. The HTML `title=…` attribute is removed (replaced by the
            structured multi-line tooltip below). The skeleton.fps line is
            load-bearing per CLAUDE.md fact #1 + sampler.ts:41-44. */}
        <div
          data-testid="rig-info-host"
          className="relative inline-block"
          onMouseEnter={() => setRigInfoOpen(true)}
          onMouseLeave={() => setRigInfoOpen(false)}
        >
          <span
            className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg cursor-help"
            aria-describedby={rigInfoOpen ? 'rig-info-tooltip' : undefined}
          >
            {isDirty ? '• ' : ''}
            {currentProjectPath
              ? currentProjectPath.split(/[\\/]/).pop() ?? 'Untitled'
              : 'Untitled'}
          </span>
          {rigInfoOpen && (
            <div
              id="rig-info-tooltip"
              role="tooltip"
              className="absolute top-full left-0 mt-1 z-30 bg-panel border border-border rounded-md p-3 text-xs font-mono text-fg whitespace-pre min-w-[260px] shadow-lg"
            >
              <div className="text-fg">
                {effectiveSummary.skeletonPath.split(/[\\/]/).pop() ?? effectiveSummary.skeletonPath}
              </div>
              <div className="text-fg-muted mt-2">
                {`bones:        ${effectiveSummary.bones.count}\n` +
                  `slots:        ${effectiveSummary.slots.count}\n` +
                  `attachments:  ${effectiveSummary.attachments.count}\n` +
                  `animations:   ${effectiveSummary.animations.count}\n` +
                  `skins:        ${effectiveSummary.skins.count}`}
              </div>
              <div className="text-fg-muted mt-2">
                {`skeleton.fps: ${effectiveSummary.editorFps} (editor metadata — does not affect sampling)`}
              </div>
            </div>
          )}
        </div>
        {/* STM is single-skeleton-per-project; literal 1 matches the atlases cadence */}
        <div
          className="inline-flex items-center gap-3 border border-border rounded-md px-3 py-1 text-xs font-mono text-fg-muted"
          aria-label="Load summary"
        >
          <span><span className="text-fg font-semibold">1</span> skeletons</span>
          <span aria-hidden="true" className="text-border">|</span>
          {loaderMode === 'atlas-less' ? (
            <span>
              <span className="text-fg font-semibold">
                {effectiveSummary.attachments.count - (effectiveSummary.skippedAttachments?.length ?? 0)}
              </span>
              {' images'}
            </span>
          ) : (
            <span><span className="text-fg font-semibold">1</span> atlases</span>
          )}
          <span aria-hidden="true" className="text-border">|</span>
          <span><span className="text-fg font-semibold">{effectiveSummary.attachments.count}</span> regions</span>
        </div>
        {/* Phase 6 Plan 06 D-117: persistent toolbar button right-aligned
            via ml-auto. Disabled when no peaks (Pitfall 11 empty-rig) or
            while an export is in flight (T-06-18 — second click is a no-op
            until the dialog's onRunEnd fires). Reuses warm-stone tokens
            from Phase 1 D-12/D-14; semibold for emphasis without filling. */}
        <div className="ml-auto flex items-center gap-2">
          <SearchBar value={query} onChange={setQuery} />
          {/* Phase 21 D-08 — atlas-less mode toggle. Binary checkbox per
              CONTEXT.md line 66 (Claude's discretion; binary toggle = checkbox,
              NOT modal). When checked, the loader synthesizes an atlas from
              per-region PNG headers instead of reading the .atlas file —
              useful for the post-Optimize-overwrite workflow where the .atlas
              has been replaced and the user wants to re-sample against PNGs.
              Toggling triggers a resample (loaderMode is in the resample
              useEffect dependency array; flips between fall-through and the
              D-08 override branch in src/core/loader.ts). */}
          <label
            className="flex items-center gap-1.5 text-xs text-fg-muted cursor-pointer select-none flex-shrink-0"
            title="When enabled, the loader synthesizes an atlas from per-region PNG headers instead of reading the .atlas file. Useful for the post-Optimize-overwrite workflow."
          >
            <input
              type="checkbox"
              checked={loaderMode === 'atlas-less'}
              onChange={(e) =>
                setLoaderMode(e.currentTarget.checked ? 'atlas-less' : 'auto')
              }
              aria-label="Use Images Folder as Source"
              className="cursor-pointer"
            />
            <span className="whitespace-nowrap">Use Images Folder as Source</span>
          </label>
          {/* Phase 7 D-134: persistent Atlas Preview toolbar button — sits
              immediately LEFT of Optimize Assets (right-aligned cluster).
              Disabled when no peaks (summary not loaded yet or empty rig).
              Reuses warm-stone tokens; class string matches Optimize Assets
              for Tailwind v4 literal-class scanner discipline (Pitfall 3). */}
          <button
            type="button"
            onClick={onClickAtlasPreview}
            disabled={effectiveSummary.peaks.length === 0}
            className="border border-border rounded-md px-3 h-8 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent flex-shrink-0"
          >
            Atlas Preview
          </button>
          {/* Phase 20 D-01 — Documentation Builder modal trigger. The
              `disabled`, `aria-disabled`, and `title` placeholder attributes
              from Phase 19 D-03 are removed; onClick opens the
              DocumentationBuilderDialog. Class string preserved verbatim
              (Tailwind v4 literal-class scanner discipline). */}
          <button
            type="button"
            onClick={() => setDocumentationBuilderOpen(true)}
            className="border border-border rounded-md px-3 h-8 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent flex-shrink-0"
          >
            Documentation
          </button>
          <button
            type="button"
            onClick={onClickOptimize}
            disabled={effectiveSummary.peaks.length === 0 || exportInFlight}
            className="bg-accent text-panel rounded-md px-3 h-8 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            Optimize Assets
          </button>
          {/* Phase 8 D-140 — Save toolbar button. Class string verbatim from
              Optimize Assets above (Tailwind v4 literal-class scanner discipline,
              Pitfall 8). Disabled when no skeleton (peaks empty) or save in flight. */}
          <button
            type="button"
            onClick={() => void onClickSave()}
            disabled={effectiveSummary.peaks.length === 0 || saveInFlight}
            className="border border-border rounded-md px-3 h-8 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent flex-shrink-0"
          >
            Save
          </button>
          {/* Phase 8 D-140 — Open toolbar button. Class string verbatim from
              Optimize Assets above. No disabled state — Open is always
              available (replaces the current session). */}
          <button
            type="button"
            onClick={() => void onClickOpen()}
            className="border border-border rounded-md px-3 h-8 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 flex-shrink-0"
          >
            Open
          </button>
        </div>
      </header>
      {/* Phase 26.2 D-01 — sub-toolbar: tab strip moved out of the main toolbar
          <header> per sketch-001 variant A. Resolves AP-01 (the toolbar-inlined
          tab anti-pattern, two prior reverts). The <nav role="tablist"> is a
          sibling of <header>, separated by border-t border-border. Tab icons
          are verbatim reuse of the panel section-header SVGs (D-03):
          GlobalMaxRenderPanel.tsx:836-839 (filmstrip) and
          AnimationBreakdownPanel.tsx:415 (bar-chart). */}
      <nav
        role="tablist"
        className="flex gap-1 items-center bg-panel border-t border-border px-6"
      >
        <TabButton
          isActive={activeTab === 'global'}
          onClick={() => setActiveTab('global')}
          icon={
            <svg
              viewBox="0 0 20 20"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <rect x="2" y="6" width="16" height="8" rx="1" />
              <path d="M5 6 v3 M8 6 v2 M11 6 v3 M14 6 v2 M17 6 v3" />
            </svg>
          }
        >
          Global
        </TabButton>
        <TabButton
          isActive={activeTab === 'animation'}
          onClick={() => setActiveTab('animation')}
          icon={
            <svg
              viewBox="0 0 20 20"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path d="M3 17 V10 M8 17 V6 M13 17 V12 M18 17 V4" />
            </svg>
          }
        >
          Animation Breakdown
        </TabButton>
      </nav>
      {/* Phase 9 Plan 02 D-194 — indeterminate sampling spinner. Surfaces while
          a sample is in flight (worker spawn → sampleSkeleton → complete/cancel).
          Indeterminate CSS animation per RESEARCH §Q4 (no determinate percent
          available because sampler is byte-frozen — no inner-loop emit point). */}
      {samplingInFlight && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Sampling skeleton"
          className="border-b border-border bg-panel px-6 py-2 text-xs text-fg-muted flex items-center gap-2"
        >
          <span
            className="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
          <span>Sampling skeleton…</span>
        </div>
      )}
      {/* Phase 8 D-150 — stale-override banner. Renders count + first-5 names
          (then "+ N more" suffix when > 5); dismissible. Auto-clears on next
          successful Save (see onClickSave). RESEARCH §Open Q4 RESOLVED styling:
          muted-fg body + accent left-bar. */}
      {staleOverrideNotice !== null && staleOverrideNotice.length > 0 && (
        <div
          role="status"
          className="border-b border-border bg-panel px-6 py-2 text-xs text-fg-muted flex items-center gap-2"
        >
          <span className="inline-block w-1 h-4 bg-accent" aria-hidden="true" />
          <span className="flex-1">
            {staleOverrideNotice.length} saved override
            {staleOverrideNotice.length === 1 ? '' : 's'} skipped — attachments
            no longer in skeleton:&nbsp;
            <span className="font-mono text-fg">
              {staleOverrideNotice.slice(0, 5).join(', ')}
            </span>
            {staleOverrideNotice.length > 5
              ? ` + ${staleOverrideNotice.length - 5} more`
              : ''}
          </span>
          <button
            type="button"
            onClick={() => setStaleOverrideNotice(null)}
            className="border border-border rounded-md px-2 py-0.5 text-xs hover:border-accent hover:text-accent transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Phase 8 D-149 — locate-skeleton inline error. Mounted when an Open or
          drop attempt returns SkeletonNotFoundOnLoadError. The "Locate
          skeleton…" button invokes window.api.locateSkeleton →
          reloadProjectWithSkeleton via onClickLocateSkeleton; "Dismiss"
          clears the banner without recovery. */}
      {skeletonNotFoundError !== null && (
        <div
          role="alert"
          className="border-b border-border bg-panel px-6 py-2 text-xs text-fg flex items-center gap-2"
        >
          <span className="inline-block w-1 h-4 bg-danger" aria-hidden="true" />
          <span className="flex-1">
            <span className="font-semibold text-danger">Skeleton not found:</span>{' '}
            {skeletonNotFoundError.message}
          </span>
          <button
            type="button"
            onClick={() => void onClickLocateSkeleton()}
            className="border border-border rounded-md px-2 py-0.5 text-xs hover:border-accent hover:text-accent transition-colors cursor-pointer"
          >
            Locate skeleton…
          </button>
          <button
            type="button"
            onClick={() => setSkeletonNotFoundError(null)}
            className="border border-border rounded-md px-2 py-0.5 text-xs hover:border-accent hover:text-accent transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
      <main className="flex-1 overflow-auto [scrollbar-gutter:stable]">
        {/*
          Phase 21 Plan 21-10 (G-02) — surface skipped-PNG attachments above
          the regular panels. The component renders nothing when
          effectiveSummary.skippedAttachments.length === 0; renders a warning
          banner with count + expandable list of name → expectedPngPath
          entries when length > 0. Visible on BOTH tabs (Global + Animation
          Breakdown) — orthogonal to the activeTab split, since skipped
          attachments are a project-level concern, not a tab-specific one.

          ISSUE-009 note: during a resample-in-flight transition,
          effectiveSummary.skippedAttachments may briefly show a stale list.
          Acceptable — skippedAttachments is stable across resamples (sourced
          from LoadResult, refreshed on each load), and the fresh resample
          replaces the panel atomically when complete. No "loading" state on
          this panel.
        */}
        <MissingAttachmentsPanel
          /*
           * Defensive `?? []`: SkeletonSummary.skippedAttachments is REQUIRED
           * in the type (always populated by buildSummary in summary.ts), but
           * older renderer-side test fixtures cast a partial summary via
           * `as unknown as SkeletonSummary` and omit the field. The fallback
           * keeps those fixtures green and avoids
           * "Cannot read properties of undefined (reading 'length')" at the
           * panel's empty-check. New code MUST populate skippedAttachments
           * verbatim — this fallback is a backward-compat affordance, not a
           * sanctioned shortcut.
           */
          skippedAttachments={effectiveSummary.skippedAttachments ?? []}
        />
        {/* Phase 24 PANEL-02 — hidden when 0 orphaned files (D-06); expanded by default
            when N > 0. The panel self-hides via `return null` when empty — no conditional
            wrapper needed here. Renders on BOTH tabs (same as MissingAttachmentsPanel)
            because orphaned files are a project-level concern, not tab-specific.
            Position (Phase 26.2 UAT): both project-level alert bars (MissingAttachments
            + UnusedAssets) render BEFORE either tab's panel content, on both tabs —
            supersedes Phase 24 D-07 which placed UnusedAssets between the two tab panels. */}
        <UnusedAssetsPanel
          orphanedFiles={effectiveSummary.orphanedFiles ?? []}
        />
        {activeTab === 'global' && (
          <GlobalMaxRenderPanel
            summary={effectiveSummary}
            onJumpToAnimation={onJumpToAnimation}
            overrides={overrides}
            onOpenOverrideDialog={onOpenOverrideDialog}
            /* Phase 7 D-130 NEW props — mirror AnimationBreakdownPanel's
               focusAnimationName/onFocusConsumed pair. */
            focusAttachmentName={focusAttachmentName}
            onFocusConsumed={onFocusAttachmentConsumed}
            query={query}
            onQueryChange={setQuery}
            loaderMode={loaderMode}
            savingsPct={savingsPctMemo}
          />
        )}
        {activeTab === 'animation' && (
          <AnimationBreakdownPanel
            summary={effectiveSummary}
            focusAnimationName={focusAnimationName}
            onFocusConsumed={onFocusConsumed}
            overrides={overrides}
            onOpenOverrideDialog={onOpenOverrideDialog}
            query={query}
            onQueryChange={setQuery}
            loaderMode={loaderMode}
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
          onRunEnd={() => {
            setExportInFlight(false);
            // Phase 23 D-07 — silently persist lastOutDir to .stmproj after export.
            // Fire-and-forget: no UI indicator, no dirty-signal change (D-08).
            if (currentProjectPath !== null) {
              void window.api.saveProject(buildSessionState(), currentProjectPath);
            }
          }}
          onConfirmStart={onConfirmStart}
          onOpenAtlasPreview={() => setAtlasPreviewOpen(true)}
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
          summary={effectiveSummary}
          overrides={overrides}
          onJumpToAttachment={onJumpToAttachment}
          onClose={() => setAtlasPreviewOpen(false)}
          onOpenOptimizeDialog={onClickOptimize}
        />
      )}
      {/* Phase 20 D-01 — Documentation Builder modal. Mounted alongside
          AtlasPreviewModal; conditional rendering not strictly required (the
          component returns null when !props.open) but matches the surrounding
          pattern for File menu auto-suppression via 08.2 D-184. The `summary`
          prop tracks effectiveSummary so post-resample doc UI reflects the
          new skeleton's events/skins/animations names. */}
      <DocumentationBuilderDialog
        open={documentationBuilderOpen}
        documentation={documentation}
        summary={effectiveSummary}
        atlasPreview={atlasPreviewState}
        exportPlanSavingsPct={savingsPctMemo}
        lastOutDir={lastOutDir}
        onChange={setDocumentation}
        onClose={() => setDocumentationBuilderOpen(false)}
      />
      {/* Phase 9 Plan 06 — Settings dialog. Edit→Preferences (Plan 09-05)
          opens this. onApply mutates samplingHzLocal which triggers the
          re-sample useEffect above. role="dialog" + aria-modal="true" auto-
          suppresses File menu via 08.2 D-184 — settingsOpen also feeds the
          modalOpen derivation explicitly above for parity. */}
      {settingsOpen && (
        <SettingsDialog
          open={true}
          currentSamplingHz={samplingHzLocal}
          onApply={(hz) => {
            setSamplingHzLocal(hz);
            setSettingsOpen(false);
          }}
          onCancel={() => setSettingsOpen(false)}
        />
      )}
      {/* Phase 9 Plan 07 — Help dialog. Help→Documentation (Plan 09-05)
          opens this; onClose closes. role="dialog" + aria-modal="true"
          auto-suppresses File menu via 08.2 D-184; helpOpen also feeds
          modalOpen explicitly above for parity with the other 5 slots.
          External link buttons inside HelpDialog call
          window.api.openExternalUrl with allow-listed Spine doc URLs
          (Plan 09-05 SHELL_OPEN_EXTERNAL_ALLOWED). */}
      {helpOpen && (
        <HelpDialog open={true} onClose={() => setHelpOpen(false)} />
      )}
      {/* Phase 14 Plan 03 — UpdateDialog mount LIFTED to App.tsx (D-02).
          The dialog renders unconditionally on every AppState branch via
          App.tsx's render tree; AppShell no longer owns the JSX or state. */}
      {/* Phase 8 D-143 — SaveQuitDialog mount. Mirrors ConflictDialog mount
          idiom (conditional on null state). Used in three contexts via
          the `reason` discriminator: 'quit' (Cmd+Q on dirty), 'new-skeleton-drop'
          (drop .json on dirty), 'new-project-drop' (drop .stmproj on dirty).
          Save click awaits onClickSave; on success runs the pendingAction
          (e.g. confirmQuitProceed for 'quit') then closes. Save failure
          leaves the dialog open for retry/cancel. Don't Save runs the
          pendingAction without saving. Cancel closes without action. */}
      {saveQuitDialogState !== null && (
        <SaveQuitDialog
          open={true}
          reason={saveQuitDialogState.reason}
          basename={
            currentProjectPath
              ? currentProjectPath.split(/[\\/]/).pop() ?? null
              : null
          }
          saving={saveInFlight}
          onSave={async () => {
            const resp = await onClickSave();
            if (resp.ok) {
              const action = saveQuitDialogState.pendingAction;
              setSaveQuitDialogState(null);
              action();
            }
            // On save failure: leave dialog open for retry/cancel.
          }}
          onDontSave={() => {
            const action = saveQuitDialogState.pendingAction;
            setSaveQuitDialogState(null);
            action();
          }}
          onCancel={() => {
            // Phase 8.1 D-164: invoke optional cancelAction BEFORE clearing state.
            // The 'quit' flow leaves cancelAction undefined (no-op — Electron handles
            // the quit-abort). The 'new-skeleton-drop' / 'new-project-drop' flows
            // set cancelAction to resolve the DropZone.onBeforeDrop Promise to false.
            saveQuitDialogState.cancelAction?.();
            setSaveQuitDialogState(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * One of the two tab strip buttons. Phase 26.2 D-03/D-04 — accepts an optional
 * leading `icon` (rendered to the left of the label with `gap-1`). The 2-weight
 * contract is preserved (active = font-semibold, inactive = font-normal); the
 * active 2px orange underline indicator is preserved verbatim.
 */
function TabButton({
  isActive,
  onClick,
  children,
  icon,
}: {
  isActive: boolean;
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      onClick={onClick}
      className={clsx(
        'relative inline-flex items-center gap-1 px-4 py-2 text-sm font-sans transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-accent',
        isActive ? 'font-semibold text-accent' : 'font-normal text-fg-muted hover:text-fg',
      )}
    >
      {icon}
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

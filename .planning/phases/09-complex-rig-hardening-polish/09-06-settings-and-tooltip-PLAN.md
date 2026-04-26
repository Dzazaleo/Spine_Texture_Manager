---
phase: 09-complex-rig-hardening-polish
plan: 06
type: execute
wave: 4
depends_on: ["09-02", "09-05"]
files_modified:
  - src/renderer/src/modals/SettingsDialog.tsx
  - src/renderer/src/components/AppShell.tsx
  - src/main/summary.ts
  - src/shared/types.ts
  - tests/renderer/settings-dialog.spec.tsx
  - tests/renderer/rig-info-tooltip.spec.tsx
autonomous: true
requirements: [N2.2]
tags: [phase-9, wave-4, settings-modal, sampling-hz, rig-info-tooltip, samplinghz-resample]

must_haves:
  truths:
    - "SettingsDialog mounts when the user clicks Edit→Preferences (or presses Cmd/Ctrl+,); shows samplingHz dropdown 60/120/240/Custom with a number input revealed for Custom"
    - "Apply on SettingsDialog updates AppShell's samplingHz state; the existing Phase 8 D-145 dirty-derivation marks the project dirty"
    - "Changing samplingHz in Settings triggers a re-sample via the Wave 1 sampler-worker bridge (RESEARCH §Pitfall 7) — the displayed peaks refresh to match the new rate"
    - "Filename chip (existing Phase 8 D-144 surface) shows a multi-line rig-info tooltip on hover with skeletonName + bones/slots/attachments/animations/skins counts + skeleton.fps clearly labeled `(editor metadata — does not affect sampling)`"
    - "skeleton.fps wording aligns with src/core/sampler.ts:41-44 canonical comment block (CLAUDE.md fact #1)"
    - "src/main/summary.ts surfaces editorFps through SkeletonSummary so the renderer can read it"
  artifacts:
    - path: "src/renderer/src/modals/SettingsDialog.tsx"
      provides: "Modal with samplingHz dropdown + custom number input + validation + apply/cancel"
      contains: "aria-modal=\"true\""
    - path: "src/renderer/src/components/AppShell.tsx"
      provides: "SettingsDialog mount + onMenuSettings subscription + samplingHz re-sample useEffect + rig-info tooltip on filename chip"
    - path: "src/main/summary.ts"
      provides: "editorFps surfaced through SkeletonSummary"
    - path: "src/shared/types.ts"
      provides: "SkeletonSummary.editorFps: number field added"
  key_links:
    - from: "src/renderer/src/components/AppShell.tsx onMenuSettings useEffect"
      to: "SettingsDialog open state"
      via: "window.api.onMenuSettings(() => setSettingsOpen(true))"
      pattern: "onMenuSettings"
    - from: "SettingsDialog onApply"
      to: "AppShell samplingHz state setter"
      via: "lifted state — onApply prop dispatched from AppShell"
      pattern: "setSamplingHz"
    - from: "AppShell samplingHz useEffect"
      to: "project re-sample via worker bridge"
      via: "App.tsx-level orchestration; AppShell signals upward via onSamplingHzChange callback OR App.tsx subscribes to AppShell-level samplingHz state"
      pattern: "samplingHz re-sample"
    - from: "Filename chip (AppShell.tsx existing D-144 surface)"
      to: "RigInfoTooltip"
      via: "either CSS :hover overlay OR React useState hover state"
      pattern: "skeleton.fps"
---

<objective>
Land Phase 9 polish deliverables #3 (Settings modal) and #4 (rig-info tooltip). Both ship in this plan because they share the same file (AppShell.tsx) — splitting them would force sequential waves.

The Settings modal exposes the existing per-project `samplingHz` field (Phase 8 D-146 — already persists in .stmproj v1; no schema change). UX per RESEARCH and CONTEXT.md Claude's Discretion: dropdown 60/120/240 + Custom number input; positive integer validation; max 1000 typo-safety clamp; default 120 per CLAUDE.md fact #6.

Critical Wave 1 dependency: per RESEARCH §Pitfall 7, changing samplingHz must trigger a re-sample. The existing AppShell `samplingHz` plumbing (lines 71/114/477/485/506-508) feeds the project-io sample call sites (which Plan 02 refactored to dispatch through the sampler-worker). This plan adds a useEffect that re-runs the sample when samplingHz changes — using the worker bridge that Plan 02 wired.

The rig-info tooltip attaches to the filename chip (Phase 8 D-144 area in AppShell.tsx:789-797). Multi-line content: skeletonName, bones/slots/attachments/animations/skins counts, and `skeleton.fps: N (editor metadata — does not affect sampling)`. The fps wording is **load-bearing** — it must align with `src/core/sampler.ts:41-44` (CLAUDE.md fact #1). Source the editorFps via `src/main/summary.ts` (extension required — the existing summary doesn't carry editorFps).

Output:
- `src/renderer/src/modals/SettingsDialog.tsx` (NEW) — modal with samplingHz dropdown + custom input + validation
- `src/renderer/src/components/AppShell.tsx` extended with: onMenuSettings subscription, settingsOpen state, SettingsDialog mount, samplingHz re-sample useEffect, rig-info tooltip on the filename chip
- `src/main/summary.ts` extended to surface editorFps in SkeletonSummary
- `src/shared/types.ts` SkeletonSummary interface extended with editorFps: number
- `tests/renderer/settings-dialog.spec.tsx` Wave 0 RED → GREEN
- `tests/renderer/rig-info-tooltip.spec.tsx` Wave 0 RED → GREEN
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/09-complex-rig-hardening-polish/09-CONTEXT.md
@.planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md
@.planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md
@.planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md
@CLAUDE.md
@src/renderer/src/modals/OverrideDialog.tsx
@src/renderer/src/components/AppShell.tsx
@src/main/summary.ts
@src/shared/types.ts
@src/core/sampler.ts
@src/core/loader.ts

<interfaces>
From src/renderer/src/modals/OverrideDialog.tsx (full modal shape — analog for SettingsDialog):
```tsx
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface OverrideDialogProps {
  open: boolean;
  scope: string[];
  currentPercent: number;
  anyOverridden: boolean;
  onApply: (percent: number) => void;
  onClear: () => void;
  onCancel: () => void;
}

export function OverrideDialog(props: OverrideDialogProps) {
  const [inputValue, setInputValue] = useState(String(props.currentPercent));
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, props.open, { onEscape: props.onCancel });

  if (!props.open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onCancel}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 min-w-[360px] font-mono"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Enter') props.onApply(Number(inputValue)); }}
      >
        <h2 id="override-title">Title</h2>
        {/* input + buttons */}
      </div>
    </div>
  );
}
```

08.2 D-184 — modals with `role="dialog"` + `aria-modal="true"` are auto-picked up by the modalOpen derivation, which disables File menu items. SettingsDialog inherits this for free.

From src/main/summary.ts:31-100 (existing buildSummary — extend with editorFps):
```ts
export function buildSummary(load: LoadResult, samplerOutput: SamplerOutput, elapsedMs: number): SkeletonSummary {
  const { skeletonData } = load;
  // ... existing field assembly ...
  return {
    skeletonPath: load.skeletonPath,
    atlasPath: load.atlasPath,
    bones: { count: skeletonData.bones.length, names: skeletonData.bones.map(b => b.name) },
    slots: { count: skeletonData.slots.length },
    // ... other fields ...
    elapsedMs,
  };
}
```

The existing `load.editorFps` (from src/core/loader.ts:229) is available; just add it to the returned object: `editorFps: load.editorFps`.

From src/shared/types.ts (SkeletonSummary — extend):
```ts
export interface SkeletonSummary {
  skeletonPath: string;
  atlasPath: string;
  bones: { count: number; names: string[] };
  slots: { count: number };
  attachments: { count: number; byType: Record<string, number> };
  skins: { count: number; names: string[] };
  animations: { count: number; names: string[] };
  peaks: DisplayRow[];
  animationBreakdown: AnimationBreakdown[];
  unusedAttachments?: UnusedAttachment[];
  elapsedMs: number;
  editorFps: number;  // NEW Phase 9 Plan 06 — sourced from load.editorFps (loader.ts:229)
}
```

From src/core/sampler.ts:41-44 (the canonical samplingHz vs skeleton.fps wording — CLAUDE.md fact #1):
```ts
// editor dopesheet metadata; sampling uses the samplingHz parameter (default
// 120 Hz). The skeleton.fps field on the JSON is INFORMATIONAL ONLY and
// has zero runtime effect — see CLAUDE.md fact #1.
```

The rig-info tooltip's fps line MUST adopt this wording: "skeleton.fps: N (editor metadata — does not affect sampling)" or near-identical. RESEARCH §Specifics + §Recommendations #16 cite this as the load-bearing UX call.

From src/renderer/src/components/AppShell.tsx existing samplingHz plumbing (lines 71/114/477/485/506-508):
```tsx
samplingHz?: number;       // :71 prop
samplingHz = 120,          // :114 default
[summary.skeletonPath, summary.atlasPath, overrides, samplingHz],  // :485 dirty derivation deps
if (samplingHz !== lastSaved.samplingHz) return true;  // :506-508 dirty check
```

From src/renderer/src/components/AppShell.tsx existing filename chip (:789-797 — anchor for tooltip):
```tsx
<span
  className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg"
  title={currentProjectPath ?? summary.skeletonPath}
>
  {isDirty ? '• ' : ''}
  {currentProjectPath ? currentProjectPath.split(/[\\/]/).pop() ?? 'Untitled' : 'Untitled'}
</span>
```

Plan 06 enriches this. Either: (a) add a CSS-only :hover overlay (no React state); or (b) lift to React state with `onMouseEnter` / `onMouseLeave`. Planner picks (b) for testability — Testing Library's `fireEvent.mouseEnter` is the canonical interaction. The HTML `title=…` attribute is removed (replaced by the rich tooltip).

Re-sample trigger machinery: the existing project-io sample call sites (refactored by Plan 02) read samplingHz from materialized.samplingHz (.stmproj load) or the function-arg samplingHz (handleProjectReloadWithSkeleton). When the user changes samplingHz in Settings, the renderer needs to dispatch a re-sample. Three viable seams:

Seam 1 (preferred): Add a `'project:resample'` IPC channel (renderer→main) that takes the current materialized state + new samplingHz and re-runs steps 7-9 of handleProjectOpenFromPath (sample + summary build + stale-key intersect). Returns OpenResponse like the existing channels. This is the cleanest factoring and reuses existing main-side machinery.

Seam 2: Re-invoke `window.api.openProjectFromPath(currentProjectPath)` after applying the new samplingHz. Side effect: re-reads the .stmproj, but the materialized.samplingHz lives in-memory in the renderer; the main side reads from disk. So the new samplingHz must be PERSISTED first (Cmd+S), then the re-open picks it up. This couples re-sample to save, which is bad UX.

Seam 3: Lift more orchestration into App.tsx and call the worker-bridge from there. Most invasive.

Use Seam 1 (new `'project:resample'` channel). Plan 06 adds it to ipc.ts + project-io.ts + preload + App.tsx (samplingHz change handler).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Surface editorFps through summary; author SettingsDialog component; flip settings-dialog.spec.tsx GREEN</name>
  <files>src/main/summary.ts, src/shared/types.ts, src/renderer/src/modals/SettingsDialog.tsx, tests/renderer/settings-dialog.spec.tsx</files>
  <read_first>
    - src/main/summary.ts (full file — buildSummary signature + LoadResult.editorFps consumption)
    - src/shared/types.ts:449-477 (SkeletonSummary interface — read the exact field set so the editorFps addition slots in correctly)
    - src/core/loader.ts:225-239 (editorFps source surface; LoadResult shape)
    - src/renderer/src/modals/OverrideDialog.tsx (full file — modal shell + focus trap + Enter/Escape handling — analog)
    - src/renderer/src/hooks/useFocusTrap.ts (or wherever useFocusTrap is defined — verify the hook signature)
    - tests/renderer/settings-dialog.spec.tsx (Wave 0 RED scaffold — 3 placeholder tests for dropdown / validation / apply→dirty)
    - .planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md (§"src/renderer/src/modals/SettingsDialog.tsx (NEW — modal)")
    - .planning/phases/09-complex-rig-hardening-polish/09-CONTEXT.md (§Claude's Discretion Settings modal recommendation: dropdown 60/120/240 + Custom; positive integer; max 1000 typo-safety; default 120)
  </read_first>
  <behavior>
    - src/shared/types.ts SkeletonSummary gains `editorFps: number`
    - src/main/summary.ts buildSummary sets `editorFps: load.editorFps` in the returned summary
    - SettingsDialog opens when `props.open === true`; shows a `<select>` with options 60, 120, 240, "Custom…"; when "Custom…" is selected a `<input type="number">` is revealed
    - Validation: rejects non-positive integers; clamps values >1000 (typo safety per CONTEXT.md); rejects NaN; non-integer values rounded to integer
    - Apply button dispatches `props.onApply(hz: number)`; Cancel dispatches `props.onCancel()`; pressing Enter when input is focused triggers Apply; pressing Escape (via useFocusTrap onEscape) triggers Cancel
    - Mount with `role="dialog"` + `aria-modal="true"` so 08.2 D-184 modalOpen derivation auto-disables File menu
    - tests/renderer/settings-dialog.spec.tsx 3 cases flip GREEN: dropdown contents + Custom reveal + apply→dirty derivation
  </behavior>
  <action>
Step 1. Extend src/shared/types.ts SkeletonSummary:

```ts
export interface SkeletonSummary {
  // ... existing fields ...
  /**
   * Phase 9 Plan 06 — editor dopesheet metadata from skeletonData.fps
   * (loader.ts:225-229: `editorFps = skeletonData.fps || 30`).
   *
   * INFORMATIONAL ONLY. Sampling uses samplingHz (default 120 Hz per
   * CLAUDE.md fact #6), NOT this field. Surfaced through the summary so
   * the rig-info tooltip can display it with the explicit wording
   * "(editor metadata — does not affect sampling)".
   */
  editorFps: number;
}
```

Step 2. Extend src/main/summary.ts buildSummary to populate editorFps:

```ts
export function buildSummary(load: LoadResult, samplerOutput: SamplerOutput, elapsedMs: number): SkeletonSummary {
  // ... existing assembly ...
  return {
    // ... existing fields ...
    elapsedMs,
    editorFps: load.editorFps,  // NEW Phase 9 Plan 06
  };
}
```

Verify the existing summary.spec.ts tests still pass after the field addition (the existing tests likely use structuredClone round-trip which should accept the new field; if a test asserts exact field count, it MUST be updated to expect the new field).

Step 3. Author src/renderer/src/modals/SettingsDialog.tsx:

```tsx
/**
 * Phase 9 Plan 06 — Settings modal (Claude's Discretion area; D-188 menu
 * placement = Edit→Preferences with accelerator CommandOrControl+,).
 *
 * Single setting exposed: samplingHz (per-project; persists in .stmproj v1
 * via the existing Phase 8 D-146 schema; no schema change). UX per
 * CONTEXT.md Claude's Discretion: dropdown of presets 60 / 120 (default) /
 * 240, plus a "Custom…" option that reveals a number input. Validation:
 * positive integer; max 1000 typo-safety clamp; non-integers rounded.
 *
 * 08.2 D-184 — role="dialog" + aria-modal="true" are auto-picked up by the
 * modalOpen derivation; File menu items disable while open. No extra wiring.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface SettingsDialogProps {
  open: boolean;
  currentSamplingHz: number;
  onApply: (hz: number) => void;
  onCancel: () => void;
}

const PRESETS = [60, 120, 240] as const;
type Preset = typeof PRESETS[number] | 'custom';

export function SettingsDialog(props: SettingsDialogProps) {
  // Initial preset selection: if currentSamplingHz matches a preset, select
  // it; otherwise mount in Custom mode with the input prefilled.
  const initialPreset: Preset = (PRESETS as readonly number[]).includes(props.currentSamplingHz)
    ? (props.currentSamplingHz as Preset)
    : 'custom';
  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [customValue, setCustomValue] = useState<string>(String(props.currentSamplingHz));
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  useFocusTrap(dialogRef, props.open, { onEscape: props.onCancel });

  useEffect(() => {
    // Reset internal state when the dialog re-opens with a different value.
    if (props.open) {
      setPreset(initialPreset);
      setCustomValue(String(props.currentSamplingHz));
      setError(null);
    }
  }, [props.open, props.currentSamplingHz, initialPreset]);

  if (!props.open) return null;

  const validate = (raw: string): { ok: true; hz: number } | { ok: false; error: string } => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return { ok: false, error: 'Must be a number' };
    if (n <= 0) return { ok: false, error: 'Must be a positive integer' };
    const integer = Math.round(n);
    const clamped = Math.min(integer, 1000); // typo-safety per CONTEXT.md
    return { ok: true, hz: clamped };
  };

  const apply = () => {
    if (preset === 'custom') {
      const result = validate(customValue);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      props.onApply(result.hz);
      return;
    }
    props.onApply(preset);
  };

  const onSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === 'custom') {
      setPreset('custom');
      // Auto-focus the number input after the custom row mounts
      setTimeout(() => customInputRef.current?.focus(), 0);
      return;
    }
    setPreset(Number(v) as Preset);
    setError(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') apply();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onCancel}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 min-w-[360px] font-mono"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <h2 id="settings-title" className="text-sm font-semibold mb-4">Preferences</h2>

        <label className="text-xs text-fg-muted block mb-2">Sampling rate (Hz)</label>
        <select
          value={String(preset)}
          onChange={onSelectChange}
          className="w-full bg-panel border border-border rounded-md px-2 py-1 text-xs"
        >
          {PRESETS.map((hz) => (
            <option key={hz} value={String(hz)}>
              {hz} Hz {hz === 120 ? '(default)' : ''}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>

        {preset === 'custom' && (
          <div className="mt-3">
            <input
              ref={customInputRef}
              type="number"
              min={1}
              max={1000}
              step={1}
              value={customValue}
              onChange={(e) => { setCustomValue(e.target.value); setError(null); }}
              className="w-full bg-panel border border-border rounded-md px-2 py-1 text-xs"
              aria-label="Custom sampling rate (Hz)"
            />
            {error && (
              <div role="alert" className="text-xs text-red-500 mt-1">{error}</div>
            )}
          </div>
        )}

        <p className="text-xs text-fg-muted mt-4">
          Higher rates catch sub-frame peaks at the cost of sampling time.
          Default 120 Hz is recommended.
        </p>

        <div className="flex gap-2 mt-6 justify-end">
          <button
            type="button"
            onClick={props.onCancel}
            className="border border-border rounded-md px-3 py-1 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
```

Step 4. Replace the Wave 0 RED scaffold in tests/renderer/settings-dialog.spec.tsx with real assertions:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { SettingsDialog } from '../../src/renderer/src/modals/SettingsDialog';

afterEach(cleanup);

describe('SettingsDialog — Wave 4 (Claude Discretion: samplingHz exposure)', () => {
  it('opens with role=dialog labelled Preferences; dropdown contains 60, 120, 240, Custom options', () => {
    render(<SettingsDialog open={true} currentSamplingHz={120} onApply={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /preferences/i })).toBeTruthy();
    const select = screen.getByRole('combobox');
    expect(select).toBeTruthy();
    const optionTexts = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionTexts.some((t) => t?.includes('60'))).toBe(true);
    expect(optionTexts.some((t) => t?.includes('120'))).toBe(true);
    expect(optionTexts.some((t) => t?.includes('240'))).toBe(true);
    expect(optionTexts.some((t) => t?.toLowerCase().includes('custom'))).toBe(true);
  });

  it('selecting Custom reveals a number input; non-positive integers rejected; values >1000 clamped', () => {
    const onApply = vi.fn();
    render(<SettingsDialog open={true} currentSamplingHz={120} onApply={onApply} onCancel={vi.fn()} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'custom' } });
    const input = screen.getByLabelText(/custom sampling rate/i) as HTMLInputElement;
    expect(input).toBeTruthy();

    // Non-positive: error appears, onApply not called
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeNull();

    // >1000: clamped to 1000
    fireEvent.change(input, { target: { value: '99999' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApply).toHaveBeenCalledWith(1000);
  });

  it('apply on a preset (240) dispatches onApply(240); custom valid value dispatches the rounded integer', () => {
    const onApply = vi.fn();
    const { rerender } = render(<SettingsDialog open={true} currentSamplingHz={120} onApply={onApply} onCancel={vi.fn()} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '240' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApply).toHaveBeenLastCalledWith(240);

    // Custom path with rounding
    rerender(<SettingsDialog open={true} currentSamplingHz={120} onApply={onApply} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText(/custom sampling rate/i), { target: { value: '180.7' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApply).toHaveBeenLastCalledWith(181); // rounded
  });
});
```

The "apply→dirty derivation" assertion is upstream — the test suite for AppShell's dirty derivation already exists (verify with `grep -rn "samplingHz" tests/renderer/`). The dirty-bind happens automatically once Task 2 wires SettingsDialog's `onApply` to AppShell's setSamplingHz, because AppShell's existing :506-508 dirty check fires when `samplingHz !== lastSaved.samplingHz`.
  </action>
  <verify>
    <automated>npm run test tests/renderer/settings-dialog.spec.tsx &amp;&amp; grep -q "editorFps" src/shared/types.ts &amp;&amp; grep -q "editorFps: load.editorFps" src/main/summary.ts &amp;&amp; test -f src/renderer/src/modals/SettingsDialog.tsx &amp;&amp; grep -q "aria-modal" src/renderer/src/modals/SettingsDialog.tsx &amp;&amp; npx tsc --noEmit -p tsconfig.web.json &amp;&amp; npx tsc --noEmit -p tsconfig.node.json</automated>
  </verify>
  <acceptance_criteria>
    - src/shared/types.ts SkeletonSummary contains `editorFps: number` field
    - src/main/summary.ts buildSummary returns an object containing `editorFps: load.editorFps`
    - src/renderer/src/modals/SettingsDialog.tsx exists with `role="dialog"` + `aria-modal="true"`
    - SettingsDialog renders a `<select>` (combobox) with at least 4 options (60, 120, 240, Custom)
    - Selecting "custom" reveals an `<input type="number">` (visible only in custom mode)
    - tests/renderer/settings-dialog.spec.tsx 3 cases all GREEN
    - tests/main/summary.spec.ts (existing) still GREEN — the editorFps field addition does not break the existing structuredClone round-trip
    - npx tsc --noEmit for both projects exits 0
    - Pre-existing renderer + main tests still GREEN (no regressions)
  </acceptance_criteria>
  <done>SettingsDialog component ships; editorFps is plumbed through the summary; Wave 0 RED scaffold for settings-dialog.spec.tsx flips GREEN.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire SettingsDialog into AppShell + samplingHz re-sample trigger; add rig-info tooltip on filename chip; flip rig-info-tooltip.spec.tsx GREEN</name>
  <files>src/renderer/src/components/AppShell.tsx, src/main/ipc.ts, src/main/project-io.ts, src/preload/index.ts, src/shared/types.ts, tests/renderer/rig-info-tooltip.spec.tsx</files>
  <read_first>
    - src/renderer/src/components/AppShell.tsx (full file — existing samplingHz prop at :71/114; existing onMenuOpen subscription pattern; existing filename chip at :789-797; existing modal mounts elsewhere in the file for analog)
    - src/main/project-io.ts (full handleProjectOpenFromPath + handleProjectReloadWithSkeleton — the existing sample-orchestration path for the new 'project:resample' channel to mirror)
    - src/main/ipc.ts (existing channel registrations — analog for the new 'project:resample' handle)
    - src/preload/index.ts existing project:* methods (saveProject / openProject / reloadProjectWithSkeleton — analogs for the new resample method)
    - src/shared/types.ts (Api interface + OpenResponse + MaterializedProject — types needed for the resample channel)
    - tests/renderer/rig-info-tooltip.spec.tsx (Wave 0 RED scaffold — 2 placeholder tests for hover-shows-content + skeleton.fps wording)
    - .planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md (§"src/renderer/src/components/RigInfoTooltip.tsx" — content shape)
    - src/core/sampler.ts:41-44 (the canonical wording — load-bearing for tooltip text)
  </read_first>
  <behavior>
    - AppShell.tsx subscribes to window.api.onMenuSettings; click sets `settingsOpen = true` (Pitfall 9 cleanup)
    - SettingsDialog mounts when settingsOpen === true; onApply updates the AppShell-level samplingHz state and closes the dialog; onCancel just closes
    - When samplingHz changes (from Settings or from a project load), AppShell triggers a re-sample via a new `window.api.resampleProject({ skeletonPath, atlasPath, samplingHz, overrides })` IPC; the response is handled like an Open response (re-render the panel with the new summary)
    - The existing :506-508 dirty derivation marks the project dirty when samplingHz !== lastSaved.samplingHz — no new dirty wiring needed
    - Filename chip becomes a hover-tooltip target: onMouseEnter shows a positioned div with skeletonName + counts + skeleton.fps line
    - The skeleton.fps line text is exactly: `skeleton.fps: <N> (editor metadata — does not affect sampling)` per src/core/sampler.ts:41-44 wording
    - tests/renderer/rig-info-tooltip.spec.tsx 2 cases flip GREEN
  </behavior>
  <action>
Step 1. Add the `'project:resample'` IPC + project-io handler.

src/main/project-io.ts — new exported function near the bottom of the file:

```ts
/**
 * Phase 9 Plan 06 — re-sample an already-loaded project with a new
 * samplingHz. Triggered by the renderer when the user changes samplingHz
 * in Settings (RESEARCH §Pitfall 7).
 *
 * Reuses steps 6-9 of handleProjectOpenFromPath: loadSkeleton + worker-
 * dispatched sampleSkeleton + buildSummary + stale-key intersect.
 *
 * Trust boundary: skeletonPath / atlasPath / samplingHz / overrides
 * originate from the renderer's already-validated state (the renderer
 * holds them after the initial Open succeeded). We re-validate types as
 * defense in depth.
 */
export async function handleProjectResample(
  args: unknown,
): Promise<OpenResponse> {
  if (!args || typeof args !== 'object') {
    return { ok: false, error: { kind: 'Unknown', message: 'resample args must be an object' } };
  }
  const a = args as Record<string, unknown>;
  if (typeof a.skeletonPath !== 'string' || !a.skeletonPath.endsWith('.json')) {
    return { ok: false, error: { kind: 'Unknown', message: 'skeletonPath must be a .json path' } };
  }
  if (typeof a.samplingHz !== 'number' || !Number.isInteger(a.samplingHz) || a.samplingHz <= 0) {
    return { ok: false, error: { kind: 'Unknown', message: 'samplingHz must be a positive integer' } };
  }
  if (!a.overrides || typeof a.overrides !== 'object') {
    return { ok: false, error: { kind: 'Unknown', message: 'overrides must be a Record' } };
  }
  const atlasPath = typeof a.atlasPath === 'string' ? a.atlasPath : undefined;

  let load;
  try {
    load = loadSkeleton(a.skeletonPath, atlasPath ? { atlasPath } : {});
  } catch (err) {
    if (err instanceof SpineLoaderError) {
      return { ok: false, error: { kind: err.name as NonRecoveryKind, message: err.message } };
    }
    return { ok: false, error: { kind: 'Unknown', message: err instanceof Error ? err.message : String(err) } };
  }

  const t0 = performance.now();
  const samplerResult = await runSamplerInWorker(
    {
      skeletonPath: a.skeletonPath,
      atlasRoot: atlasPath,
      samplingHz: a.samplingHz,
    },
    BrowserWindow.getAllWindows()[0]?.webContents ?? null,
  );
  if (samplerResult.type !== 'complete') {
    return {
      ok: false,
      error: samplerResult.type === 'cancelled'
        ? { kind: 'Unknown', message: 'Sampling cancelled.' }
        : samplerResult.error,
    };
  }
  const samplerOutput = samplerResult.output;
  const elapsedMs = Math.round(performance.now() - t0);
  const summary = buildSummary(load, samplerOutput, elapsedMs);

  // D-150 stale-key intersect (same as Open paths).
  const presentNames = new Set(summary.peaks.map((r) => r.attachmentName));
  const restored: Record<string, number> = {};
  const stale: string[] = [];
  for (const [name, percent] of Object.entries(a.overrides as Record<string, unknown>)) {
    if (typeof percent !== 'number' || !Number.isFinite(percent)) continue;
    if (presentNames.has(name)) restored[name] = percent;
    else stale.push(name);
  }

  const project: MaterializedProject = {
    summary,
    restoredOverrides: restored,
    staleOverrideKeys: stale,
    samplingHz: a.samplingHz,
    lastOutDir: typeof a.lastOutDir === 'string' ? a.lastOutDir : null,
    sortColumn: typeof a.sortColumn === 'string' ? a.sortColumn : null,
    sortDir: a.sortDir === 'asc' || a.sortDir === 'desc' ? a.sortDir : null,
    projectFilePath: typeof a.projectFilePath === 'string' ? a.projectFilePath : null,
  };
  return { ok: true, project };
}
```

src/main/ipc.ts — register the new channel inside registerIpcHandlers:

```ts
ipcMain.handle('project:resample', async (_evt, args) => handleProjectResample(args));
```

Add the import:
```ts
import { handleProjectResample, /* ... existing imports ... */ } from './project-io.js';
```

Step 2. Add preload bridge + Api type:

src/preload/index.ts — append to the api literal:
```ts
/**
 * Phase 9 Plan 06 — re-sample an already-loaded project with a new
 * samplingHz. Reuses the existing OpenResponse envelope.
 */
resampleProject: (args: ResampleArgs) =>
  ipcRenderer.invoke('project:resample', args),
```

src/shared/types.ts — define ResampleArgs and add to the Api interface:
```ts
export interface ResampleArgs {
  skeletonPath: string;
  atlasPath?: string;
  samplingHz: number;
  overrides: Record<string, number>;
  lastOutDir?: string | null;
  sortColumn?: string | null;
  sortDir?: 'asc' | 'desc' | null;
  projectFilePath?: string | null;
}

export interface Api {
  // ... existing methods ...
  resampleProject: (args: ResampleArgs) => Promise<OpenResponse>;
}
```

Step 3. Wire AppShell.tsx — onMenuSettings subscription + SettingsDialog mount + samplingHz re-sample.

This is the most invasive edit. Read AppShell.tsx's existing structure first (the file is large — focus on: where samplingHz state lives, where Modal mounts happen, where existing onMenu* subscriptions live).

If AppShell does not directly own samplingHz state (it might receive it as a prop from App.tsx), the re-sample trigger and the SettingsDialog mount may need to live in App.tsx instead. Read both files and pick the seam where samplingHz mutation is owned.

Assuming AppShell owns the state (per the existing `samplingHz?: number` prop with default 120, AppShell receives it but we add a local override path):

```tsx
// Phase 9 Plan 06 — Settings modal + samplingHz override state.
const [settingsOpen, setSettingsOpen] = useState(false);
const [samplingHzLocal, setSamplingHzLocal] = useState<number>(props.samplingHz ?? 120);

// Subscribe to the menu Edit→Preferences click (Plan 05 D-188 fix).
// Pitfall 9 + 15: cleanup returns the unsubscribe.
useEffect(() => {
  const unsubscribe = window.api.onMenuSettings(() => setSettingsOpen(true));
  return unsubscribe;
}, []);

// Re-sample whenever samplingHzLocal changes (Pitfall 7). Skip the initial
// mount (the project was just loaded with the correct samplingHz). Trigger
// only on user-driven changes from Settings.
const isFirstRender = useRef(true);
useEffect(() => {
  if (isFirstRender.current) {
    isFirstRender.current = false;
    return;
  }
  // Re-sample with the new rate.
  void (async () => {
    const response = await window.api.resampleProject({
      skeletonPath: summary.skeletonPath,
      atlasPath: summary.atlasPath,
      samplingHz: samplingHzLocal,
      overrides: Object.fromEntries(overrides),  // Map → Record (Pitfall 3 boundary)
      lastOutDir: lastOutDir ?? null,
      sortColumn: /* current sort col */ null,
      sortDir: /* current sort dir */ null,
      projectFilePath: currentProjectPath,
    });
    if (response.ok) {
      // Re-mount with the new summary. Since AppShell holds the summary
      // through props, signal the parent to re-mount. Easiest seam:
      // call a parent-supplied onResample callback. If no such callback
      // exists, lift the resample machinery into App.tsx and accept
      // a more invasive refactor.
      props.onResampled?.(response.project);
    }
    // On ok:false, surface the error via the existing error banner machinery.
  })();
}, [samplingHzLocal]);

// Inside JSX, mount the SettingsDialog:
<SettingsDialog
  open={settingsOpen}
  currentSamplingHz={samplingHzLocal}
  onApply={(hz) => {
    setSamplingHzLocal(hz);
    setSettingsOpen(false);
  }}
  onCancel={() => setSettingsOpen(false)}
/>
```

The exact wiring of "re-mount with new summary" depends on whether AppShell holds the summary internally or receives it as a prop. The two architecturally clean options are:

Option A (preferred — minimal AppShell change): App.tsx owns the summary + samplingHz; AppShell receives a callback `onSamplingHzChange(hz: number) => Promise<void>`; App.tsx implements the resample logic and re-renders AppShell with the new summary.

Option B: AppShell holds local summary state and re-mounts itself; samplingHz lives in AppShell.

Read App.tsx and pick A or B based on existing structure. Option A is more idiomatic.

Step 4. Add rig-info tooltip on the filename chip. Replace the existing `<span title=…>...</span>` at AppShell.tsx:789-797:

```tsx
const [tooltipOpen, setTooltipOpen] = useState(false);

// ... inside the header JSX ...
<div
  className="relative inline-block"
  onMouseEnter={() => setTooltipOpen(true)}
  onMouseLeave={() => setTooltipOpen(false)}
>
  <span
    className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg cursor-help"
    aria-describedby={tooltipOpen ? 'rig-info-tooltip' : undefined}
  >
    {isDirty ? '• ' : ''}
    {currentProjectPath
      ? currentProjectPath.split(/[\\/]/).pop() ?? 'Untitled'
      : 'Untitled'}
  </span>

  {tooltipOpen && (
    <div
      id="rig-info-tooltip"
      role="tooltip"
      className="absolute top-full left-0 mt-1 z-30 bg-panel border border-border rounded-md p-3 text-xs font-mono whitespace-pre min-w-[260px] shadow-lg"
    >
      <div>{summary.skeletonPath.split(/[\\/]/).pop() ?? summary.skeletonPath}</div>
      <div className="text-fg-muted mt-2">
        bones:        {summary.bones.count}{'\n'}
        slots:        {summary.slots.count}{'\n'}
        attachments:  {summary.attachments.count}{'\n'}
        animations:   {summary.animations.count}{'\n'}
        skins:        {summary.skins.count}
      </div>
      <div className="mt-2 text-fg-muted">
        skeleton.fps: {summary.editorFps} (editor metadata — does not affect sampling)
      </div>
    </div>
  )}
</div>
```

The wording "(editor metadata — does not affect sampling)" is load-bearing — it must match src/core/sampler.ts:41-44. RESEARCH §Specifics + §Recommendations #16. Test 2 below asserts this verbatim.

Step 5. Replace the Wave 0 RED scaffold in tests/renderer/rig-info-tooltip.spec.tsx with real tests:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../../src/renderer/src/components/AppShell';
import type { SkeletonSummary } from '../../src/shared/types';

afterEach(cleanup);

function makeSummary(): SkeletonSummary {
  return {
    skeletonPath: '/abs/path/to/SIMPLE_TEST.json',
    atlasPath: '/abs/path/to/SIMPLE_TEST.atlas',
    bones: { count: 12, names: [] },
    slots: { count: 5 },
    attachments: { count: 8, byType: {} },
    skins: { count: 1, names: ['default'] },
    animations: { count: 3, names: [] },
    peaks: [],
    animationBreakdown: [],
    elapsedMs: 42,
    editorFps: 30,
  } as SkeletonSummary;
}

describe('RigInfoTooltip — Wave 4 (Claude Discretion: rig-info on filename chip)', () => {
  it('hover filename chip: tooltip becomes visible with skeletonName + bones/slots/attachments/animations/skins counts', () => {
    render(<AppShell summary={makeSummary()} samplingHz={120} />);
    // Filename chip is the only element matching SIMPLE_TEST.json by basename.
    const chip = screen.getByText(/SIMPLE_TEST/);
    fireEvent.mouseEnter(chip.parentElement!);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toMatch(/bones:\s*12/);
    expect(tooltip.textContent).toMatch(/slots:\s*5/);
    expect(tooltip.textContent).toMatch(/attachments:\s*8/);
    expect(tooltip.textContent).toMatch(/animations:\s*3/);
    expect(tooltip.textContent).toMatch(/skins:\s*1/);
  });

  it('skeleton.fps line reads exactly: "skeleton.fps: <N> (editor metadata — does not affect sampling)"', () => {
    render(<AppShell summary={makeSummary()} samplingHz={120} />);
    const chip = screen.getByText(/SIMPLE_TEST/);
    fireEvent.mouseEnter(chip.parentElement!);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toMatch(/skeleton\.fps:\s*30\s*\(editor metadata — does not affect sampling\)/);
  });
});
```

Adapt the AppShell prop surface in the tests to whatever AppShell actually requires (mocks for window.api, beforeDropRef, appShellMenuRef, etc. as needed). Use vi.fn() / vi.mocked() for the IPC surface.
  </action>
  <verify>
    <automated>npm run test tests/renderer/rig-info-tooltip.spec.tsx tests/renderer/settings-dialog.spec.tsx &amp;&amp; grep -q "onMenuSettings" src/renderer/src/components/AppShell.tsx &amp;&amp; grep -q "SettingsDialog" src/renderer/src/components/AppShell.tsx &amp;&amp; grep -q "editor metadata — does not affect sampling" src/renderer/src/components/AppShell.tsx &amp;&amp; grep -q "ipcMain.handle('project:resample'" src/main/ipc.ts &amp;&amp; npx tsc --noEmit -p tsconfig.web.json &amp;&amp; npx tsc --noEmit -p tsconfig.node.json</automated>
  </verify>
  <acceptance_criteria>
    - src/main/ipc.ts registers `ipcMain.handle('project:resample', ...)`
    - src/main/project-io.ts exports handleProjectResample with type validation + worker-dispatched sample + buildSummary + stale-key intersect
    - src/preload/index.ts exposes `resampleProject(args)` returning `Promise<OpenResponse>`
    - src/shared/types.ts declares ResampleArgs and extends Api with resampleProject
    - src/renderer/src/components/AppShell.tsx (or App.tsx, depending on chosen seam) subscribes to window.api.onMenuSettings and mounts SettingsDialog
    - SettingsDialog.onApply triggers a re-sample via window.api.resampleProject; the response updates the summary
    - The existing samplingHz-driven dirty derivation (AppShell:506-508) still fires when samplingHz changes
    - The filename chip renders a tooltip on hover with `role="tooltip"` containing skeleton name + 5 count lines + the load-bearing skeleton.fps line
    - The skeleton.fps line text matches the regex `/skeleton\.fps:\s*\d+\s*\(editor metadata — does not affect sampling\)/`
    - tests/renderer/rig-info-tooltip.spec.tsx 2 cases GREEN
    - tests/renderer/settings-dialog.spec.tsx 3 cases STILL GREEN (Task 1 didn't regress)
    - npx tsc --noEmit for both projects exits 0
    - Pre-existing tests GREEN (no regressions)
  </acceptance_criteria>
  <done>SettingsDialog wires into AppShell via the Plan 05 onMenuSettings event; samplingHz changes trigger a re-sample via the new project:resample IPC + Plan 02 worker bridge; the filename chip displays a rig-info tooltip with the load-bearing skeleton.fps wording. Wave 0 RED scaffolds for both spec files flip GREEN. Plan 06 closes; Plan 07 (Help dialog) can land next.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| renderer → main: `'project:resample'` | Renderer-origin invoke with full ResampleArgs payload. Main validates skeletonPath / samplingHz / overrides / atlasPath / etc. before re-running the sample. |
| Settings input → samplingHz mutation | User input via SettingsDialog; clamped + validated client-side AND re-validated server-side at the IPC handler. |
| Tooltip content | Static rendering of summary fields (counts + editorFps). No user-controlled HTML; React's default escaping handles all string content. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-06-RESAMPLE-INPUT | Tampering | project:resample skeletonPath | mitigate | handleProjectResample validates `typeof a.skeletonPath === 'string' && a.skeletonPath.endsWith('.json')` before passing to loadSkeleton. Mirrors handleProjectOpenFromPath:306-318 validation. |
| T-09-06-RESAMPLE-HZ | Tampering | project:resample samplingHz | mitigate | Validates `Number.isInteger(a.samplingHz) && a.samplingHz > 0`. Renderer also clamps to 1000 in SettingsDialog (defense in depth). |
| T-09-06-RESAMPLE-OVERRIDES | Tampering | project:resample overrides | mitigate | Validates `typeof a.overrides === 'object'`. Per-key value validates `typeof percent === 'number' && Number.isFinite(percent)` before inclusion in restored Map (mirrors D-150 stale-key intersect). |
| T-09-06-TOOLTIP-XSS | Cross-Site Scripting | Tooltip rendering of summary fields | mitigate | All fields rendered via React JSX text interpolation, which auto-escapes. No `dangerouslySetInnerHTML`. summary.editorFps is a number; counts are numbers; skeleton path is a filesystem string (treated as text). |
| T-09-06-IPC-SETTINGS-LEAK | Memory leak | onMenuSettings listener identity | mitigate | Pitfall 9 listener-identity preservation in preload (Plan 05 Task 2). useEffect cleanup returns the unsubscribe closure. |
| T-09-06-RACE | Concurrency | rapid samplingHz toggles | accept | Each samplingHz change dispatches a fresh resampleProject; the previous in-flight sample completes (or its result is discarded by the AppShell-level state machine — the latest setSamplingHzLocal wins). worker.terminate() (Plan 02 mechanism) handles cancellation if needed. |
</threat_model>

<verification>
After Task 2:
1. npm run test tests/renderer/settings-dialog.spec.tsx tests/renderer/rig-info-tooltip.spec.tsx — all 5 cases GREEN
2. npm run test — full suite GREEN; no regressions in pre-Phase-9 or Phase 9 Plans 02-05 tests
3. grep -n "editorFps" src/main/summary.ts src/shared/types.ts src/renderer/src/components/AppShell.tsx — all three files reference the field
4. grep -q "ipcMain.handle('project:resample'" src/main/ipc.ts
5. grep -q "editor metadata — does not affect sampling" src/renderer/src/components/AppShell.tsx
6. npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json both exit 0
7. Manual smoke (deferred to Plan 08 UAT): npm run dev → Cmd+, → SettingsDialog opens → change samplingHz to 240 → Apply → spinner appears → table re-renders with new peaks → close dialog → hover filename chip → tooltip shows skeleton.fps line correctly
</verification>

<success_criteria>
- [ ] src/shared/types.ts SkeletonSummary.editorFps + ResampleArgs + Api.resampleProject declared
- [ ] src/main/summary.ts builds editorFps from load.editorFps
- [ ] src/main/project-io.ts handleProjectResample exported with validation + worker-dispatched sample
- [ ] src/main/ipc.ts ipcMain.handle('project:resample') registered
- [ ] src/preload/index.ts resampleProject method exposed
- [ ] src/renderer/src/modals/SettingsDialog.tsx ships (modal + dropdown + Custom + validation + Apply/Cancel)
- [ ] src/renderer/src/components/AppShell.tsx (or App.tsx) subscribes to onMenuSettings; mounts SettingsDialog; triggers re-sample on Apply
- [ ] Filename chip carries a `role="tooltip"` overlay with the load-bearing skeleton.fps wording
- [ ] tests/renderer/settings-dialog.spec.tsx 3 cases GREEN
- [ ] tests/renderer/rig-info-tooltip.spec.tsx 2 cases GREEN
- [ ] D-102 byte-frozen invariants preserved (sampler.ts, cli.ts, loader.ts, project-file.ts diffs vs eb97923 still empty)
- [ ] `<threat_model>` block present (above) — covers IPC validation + tooltip XSS + listener leak
</success_criteria>

<output>
After completion, create `.planning/phases/09-complex-rig-hardening-polish/09-06-SUMMARY.md` summarizing:
- editorFps plumbing (loader → summary → renderer tooltip)
- SettingsDialog UX (dropdown + Custom + validation + Apply triggers re-sample)
- New IPC channel project:resample (renderer → main → worker → renderer)
- Tooltip wording verification against src/core/sampler.ts:41-44
- Plan 07 (Help dialog) unblocked
</output>

# Phase 19: UI improvements (UI-01..05) — Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 9 (7 renderer + 1 shared + 1 main)
**Analogs found:** 9 / 9 (every modified or new file has a strong, in-repo analog)

This file is consumed by `gsd-planner`. Every excerpt below is verbatim from the
current repo at the cited file:line, never paraphrased. The planner SHOULD lift
class strings, prop signatures, error-handling shapes, and docblock cadences
directly into PLAN.md task bodies.

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `src/renderer/src/index.css` (token additions) | config (CSS tokens) | n/a (build-time generation) | the existing `--color-danger: #e06b55` literal-hex token at index.css:65 | **exact** — same `@theme inline` block, same literal-hex rationale, same WCAG-AA-pinned procedure |
| `src/renderer/src/components/AppShell.tsx` (sticky header + state lift) | shell component / state container | request-response (renders) + lifted state owner | itself — existing `<header>` at AppShell.tsx:1090 + existing `atlasPreviewOpen` lifecycle pattern at :158 | **exact** — pattern is "extend existing chrome by adding sticky positioning + 2 lifted state slots"; lifecycle pattern at :158 is the verbatim model for new `query` lift |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (card wrap, row bars, SVG glyph, MB callout) | panel component | request-response | GlobalMaxRenderPanel.tsx itself + AnimationCard `<section>` at AnimationBreakdownPanel.tsx:415-422 (card wrapper) | **exact** — AnimationCard already uses `border border-border rounded-md bg-panel` shape that D-05 prescribes verbatim |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (card-per-cardId, row bars, SVG glyph) | panel component | request-response | AnimationCard already-existing `<section>` at AnimationBreakdownPanel.tsx:415-422 | **exact** — only changes are removing internal SearchBar + adding row-bar `<td>` + SVG glyph in section header |
| `src/renderer/src/modals/OptimizeDialog.tsx` (3 tiles + cross-nav) | modal component | request-response | OptimizeDialog.tsx itself (existing 5-modal ARIA scaffold + footer cluster at :308) + AtlasPreviewModal `InfoCard` at :384-392 (tile composition) | **exact** — `InfoCard` is the prior art for tile shape; only shifts are 3-up `flex gap-3` row, label position swap, and `bg-surface` for recessed feel |
| `src/renderer/src/modals/AtlasPreviewModal.tsx` (3 tiles + cross-nav) | modal component | request-response | AtlasPreviewModal.tsx itself + OptimizeDialog.tsx footer at :308 | **exact** — same patterns mirrored from sibling modal |
| `src/renderer/src/lib/format-bytes.ts` | pure helper / utility | pure transform | `src/renderer/src/lib/overrides-view.ts` (zero-import, primitives-only renderer-side helper) | **exact** — same docblock cadence (`Layer 3 inline duplicate`-style header), same import discipline (zero runtime imports), same export shape (`export function …`) |
| `src/shared/types.ts` (`UnusedAttachment.bytesOnDisk` add) | shape definition / IPC contract | n/a (compile-time erased) | the existing `UnusedAttachment` interface at types.ts:156-171 itself | **exact** — adding one primitive `number` field obeys the same D-21 structuredClone-safety docblock at types.ts:8-15 + :153-154 |
| `src/main/summary.ts` (per-row `fs.statSync` augmentation) | main-process summary builder / IPC payload assembly | file-I/O + transform | the existing `findUnusedAttachments(load, sampled)` call site at summary.ts:79-82 + the `fs.access` pre-flight at image-worker.ts:148-179 (error-handling shape) | **role-match** — no exact `fs.statSync` analog in the main process today; closest neighbor is image-worker's `await access(sourcePath, fsConstants.R_OK)` try/catch idiom which we adapt for sync stat |

---

## Pattern Assignments

### `src/renderer/src/index.css` (config / @theme inline tokens)

**Analog:** itself, same `@theme inline` block.

**Existing literal-hex pattern** (index.css:59-65) — D-07 mirrors this verbatim, including the comment cadence:

```css
  /* Warning — terracotta for unused attachment surface (D-104, RESEARCH Finding #7).
     Literal hex (not a Tailwind palette var ref) because the pick sits outside
     the default shades. 5.33:1 on --color-panel = WCAG AA normal-text pass;
     1.17:1 vs --color-accent = distinguishable from the Phase 4 orange.
     Supersedes D-104 starting-point recommendations #c94a3b / #b84a3a
     (both fail WCAG AA at 3.77 / 3.40:1). */
  --color-danger: #e06b55;
```

**Insertion shape** (UI-SPEC §"Color / Token block" lines 130-142) — paste immediately AFTER `--color-danger: #e06b55;` (line 65), BEFORE the typography block at line 67:

```css
  /* Success — sage green for under-1.0× scale rows + neutral state.
     Literal hex (not a Tailwind palette var ref) because the pick sits
     outside the default shades. 6.06:1 on --color-panel = WCAG AA normal-text
     pass; sits in the same luminance band as --color-accent (6.24:1) +
     --color-danger (5.33:1) for a coordinated chromatic palette. */
  --color-success: #5FA866;

  /* Warning — warm honey for over-1.0× scale rows. Literal hex; 6.33:1
     on --color-panel = WCAG AA normal-text pass. Hue (~37°) is closest
     to --color-accent (~25°), but never co-occurs in the same element
     type (D-06 row bar vs D-17 button pill). */
  --color-warning: #C9913C;
```

**File-top docblock load-bearing rationale** (index.css:44-46) — DO NOT touch:

```css
/* Design tokens — `inline` is LOAD-BEARING for color tokens (RESEARCH Finding #2).
   Colors reference Tailwind's built-in stone and orange palette variables,
   which are resolved at utility-generation time rather than render time. */
@theme inline {
```

**Pitfall:** The `inline` keyword on `@theme inline { ... }` (line 47) MUST stay. Removing it makes utility classes resolve at render time and breaks Tailwind v4 generation (RESEARCH Finding #2 / index.css:7-9 docblock).

---

### `src/renderer/src/components/AppShell.tsx` (sticky header + state lift)

**Analog:** itself + the lifecycle pattern at AppShell.tsx:158.

#### Imports (AppShell.tsx:33-62) — preserved verbatim. NO new imports needed; SearchBar is already imported transitively via the panel wrappers, but the lift means AppShell needs a direct import. Add a single line to the existing import block:

```typescript
import { SearchBar } from './SearchBar';
```

(Mirror exists at AnimationBreakdownPanel.tsx:84 and GlobalMaxRenderPanel.tsx:65 — both already `import { SearchBar } from '../components/SearchBar';`.)

#### Sticky-positioned flex-sibling layout (D-20) — current shape at AppShell.tsx:1088-1090:

```tsx
return (
    <div className="w-full h-full flex flex-col">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-border bg-panel">
```

**Containment proof:** the outer flex column at :1089 holds `<header>` + banner rows + `<main className="flex-1 overflow-auto">` (line 1279) as flex SIBLINGS. The scroll container is `<main>`, not the outer div, not the header. Sticky containment works here because `position: sticky` only takes effect when the sticky element is a descendant of the scroller (here: it's not, so `top-0` will anchor to the visible viewport edge of the flex column instead — which is what D-20 wants).

**Modify line 1090 to:**

```tsx
      <header className="sticky top-0 z-20 flex items-center gap-4 px-6 py-3 border-b border-border bg-panel">
```

**z-index hierarchy** (verified across the codebase):
- `z-20` — new sticky header (this phase)
- `z-30` — rig-info tooltip at AppShell.tsx:1118
- `z-50` — modal overlays at OptimizeDialog.tsx:275 + AtlasPreviewModal.tsx:175

**Pitfall:** the three banner rows below the header (sampling spinner :1204, stale-override :1222, locate-skeleton :1253) MUST NOT become sticky. They participate in the `<main>` scroll. Single sticky surface per D-02.

#### Filled-primary CTA pattern (D-17 — verbatim reuse) — source at OptimizeDialog.tsx:323:

```tsx
                ref={startBtnRef}
                type="button"
                onClick={onStart}
                disabled={total === 0}
                className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-50"
```

The class string `bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-50` is the byte-for-byte string D-17 expects. Add `transition-colors disabled:cursor-not-allowed` to align with the secondary class string's interaction discipline (UI-SPEC §10 explicitly amends to `bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`).

#### Outlined-secondary button pattern (D-18 — verbatim reuse) — source at AppShell.tsx:1161-1168:

```tsx
          <button
            type="button"
            onClick={onClickAtlasPreview}
            disabled={effectiveSummary.peaks.length === 0}
            className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
          >
            Atlas Preview
          </button>
```

The trailing triplet `disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent` is mandatory — without it the disabled Documentation button (D-03) would still respond visually to hover/active.

#### Banner left-accent-bar pattern (D-06 row coloring template) — sources at AppShell.tsx:1227 + AppShell.tsx:1258:

```tsx
          <span className="inline-block w-1 h-4 bg-accent" aria-hidden="true" />
```

```tsx
          <span className="inline-block w-1 h-4 bg-danger" aria-hidden="true" />
```

For the new D-06 row bars in the panels: `inline-block w-1` carries forward; `h-4` (16px) becomes `h-full` so the bar fills the variable row height. The new tokens (`bg-success`, `bg-warning`) emit automatically once the index.css block is added.

#### State lift pattern (analog: AppShell.tsx:158) — `query` lift mirror:

Existing pattern at AppShell.tsx:158:
```tsx
  // Phase 7 D-134 — NEW: Atlas Preview modal lifecycle. Plain boolean, no
  // snapshot state — the modal reads summary + overrides directly (D-131).
  const [atlasPreviewOpen, setAtlasPreviewOpen] = useState(false);
```

Add a parallel slot for `query`:
```tsx
  // Phase 19 UI-01 + D-04 — NEW: panel filter query lifted up from the
  // GlobalMaxRenderPanel + AnimationBreakdownPanel internal useState slots
  // so the single sticky-bar SearchBar can drive both panels. Empty string
  // on every mount (no persistence). Plain useState mirrors the panel-side
  // shape at GlobalMaxRenderPanel.tsx:484 + AnimationBreakdownPanel.tsx:260.
  const [query, setQuery] = useState('');
```

Pass DOWN as `query={query}` + `onQueryChange={setQuery}` to both panels (executor task: extend each panel's props). The internal `useState('')` slots at GlobalMaxRenderPanel.tsx:484 and AnimationBreakdownPanel.tsx:260 MUST be removed in the same commit.

#### Right cluster reorder (D-19) — current shape at AppShell.tsx:1155:

```tsx
        <div className="ml-auto flex gap-2">
```

UI-SPEC §1 changes this to:
```tsx
        <div className="ml-auto flex items-center gap-2">
```

(`items-center` is required so the SearchBar input vertically aligns with the buttons.)

The 6-element order: SearchBar → Atlas Preview → Documentation → Optimize Assets → Save → Open. The Atlas Preview button at :1161-1168 stays in place; Documentation slots between it and Optimize Assets at :1169-1176; Optimize Assets gets its class string flipped from outlined-secondary to filled-primary; Save (:1180-1187) + Open (:1191-1197) stay verbatim.

---

### `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (card wrap, row bar, SVG glyph, MB callout)

**Analog:** the existing AnimationCard `<section>` at AnimationBreakdownPanel.tsx:415-422 (card wrapper) + the existing unused-section header at GlobalMaxRenderPanel.tsx:719-728.

#### Existing AnimationCard card-wrapper pattern (AnimationBreakdownPanel.tsx:414-422):

```tsx
    <section
      ref={registerRef}
      aria-labelledby={headerId}
      className={clsx(
        'border border-border rounded-md bg-panel overflow-hidden',
        isFlashing && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
      )}
    >
```

D-05 reuses `border border-border rounded-md bg-panel` verbatim and adds `p-4 mb-4` for spacing.

#### Existing unused-section header (GlobalMaxRenderPanel.tsx:719-728) — replaces `⚠` glyph with SVG warning triangle per D-08, otherwise verbatim:

```tsx
      {unusedAttachments.length > 0 && (
        <section className="mb-6 border-b border-border pb-4" aria-label="Unused attachments">
          <header className="flex items-center gap-2 mb-2 text-danger font-mono text-sm font-semibold">
            <span aria-hidden="true">⚠</span>
            <span>
              {filteredUnused.length === 1
                ? '1 unused attachment'
                : `${filteredUnused.length} unused attachments`}
            </span>
          </header>
```

Replace the `<span aria-hidden="true">⚠</span>` with the warning-triangle SVG from UI-SPEC §3 (lines 254-259):

```tsx
            <span aria-hidden="true" className="inline-flex items-center justify-center w-5 h-5">
              <svg viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="w-5 h-5">
                <path d="M10 3 L18 16 L2 16 Z" />
                <path d="M10 8 v4 M10 14.5 v0.01" />
              </svg>
            </span>
```

(`text-danger` color is inherited from the parent `<header>` via `currentColor` on the SVG `stroke` attribute — no token plumbing needed.)

#### MB-savings callout — current text-only count (GlobalMaxRenderPanel.tsx:723-727):

```tsx
            <span>
              {filteredUnused.length === 1
                ? '1 unused attachment'
                : `${filteredUnused.length} unused attachments`}
            </span>
```

Replace with the UI-SPEC §11 conditional that renders bytes when aggregate > 0:

```tsx
{aggregateBytes > 0 ? (
  <span className="text-fg-muted font-mono">
    <span className="font-semibold text-fg">{formatBytes(aggregateBytes)}</span>
    {' '}potential savings
  </span>
) : (
  <span className="text-fg-muted font-mono">
    {filteredUnused.length === 1
      ? '1 unused attachment'
      : `${filteredUnused.length} unused attachments`}
  </span>
)}
```

`aggregateBytes` derives in-render at the top of the component, just below the existing `unusedAttachments` declaration at GlobalMaxRenderPanel.tsx:558:

```tsx
  const aggregateBytes = unusedAttachments.reduce(
    (acc, u) => acc + u.bytesOnDisk,
    0,
  );
```

#### Existing `clsx` literal-branch row-class pattern (GlobalMaxRenderPanel.tsx:354-360) — D-06 row bar follows this exact shape:

```tsx
      className={clsx(
        'border-b border-border hover:bg-accent/5',
        checked && 'bg-accent/5',
        // Phase 7 D-130: flash highlight — same Tailwind ring pattern as
        // AnimationBreakdownPanel.tsx line 407.
        isFlashing && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
      )}
```

For the D-06 row bar `<td>`, mirror this idiom:

```tsx
<td className="w-1 p-0">
  <span
    className={clsx(
      'inline-block w-1 h-full',
      state === 'under' && 'bg-success',
      state === 'over' && 'bg-warning',
      state === 'unused' && 'bg-danger',
      state === 'neutral' && 'bg-transparent',
    )}
    aria-hidden="true"
  />
</td>
```

For the tinted-ratio cell, the existing peakRatio cell at GlobalMaxRenderPanel.tsx:385-393 already uses `clsx`:

```tsx
      <td
        className={clsx(
          'py-2 px-3 font-mono text-sm text-right',
          row.override !== undefined ? 'text-accent' : 'text-fg',
        )}
        title={`World AABB at peak: ${row.worldW.toFixed(0)}×${row.worldH.toFixed(0)}`}
      >
        {`${row.effExportW}×${row.effExportH}`}
      </td>
```

Extend to the 4-state literal-branch shape per UI-SPEC §5 lines 314-323:

```tsx
<td className={clsx(
  'py-2 px-3 font-mono text-sm',
  state === 'under' && 'bg-success/10 text-success',
  state === 'over' && 'bg-warning/10 text-warning',
  state === 'unused' && 'bg-danger/10 text-danger',
  state === 'neutral' && 'text-fg',
)}>
  {row.peakRatio.toFixed(2)}×
</td>
```

**Critical Tailwind v4 discipline (Pitfall 3 + 8):** every branch is a string literal — no template-string interpolation, no programmatic class-name construction. The Tailwind v4 scanner only sees literal strings.

#### Internal SearchBar removal (GlobalMaxRenderPanel.tsx:706-712):

```tsx
    <div className="w-full max-w-6xl mx-auto p-8">
      <header className="mb-4 flex items-center gap-4">
        <SearchBar value={query} onChange={setQuery} />
        <span className="text-fg-muted font-mono text-sm ml-auto">
          {selected.size} selected / {sorted.length} total
        </span>
      </header>
```

Drop the `<SearchBar>` element + the `useState('')` at line 484. Receive `query` as a prop. The `selected.size / sorted.length` indicator stays inside the panel header.

---

### `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (card-per-cardId, row bars, SVG glyph)

**Analog:** itself — AnimationCard `<section>` at AnimationBreakdownPanel.tsx:414-422 already IS the card wrapper. Only delta is adding the play/film SVG glyph in the section header + the row-bar `<td>` + tinted ratio cell + dropping the internal SearchBar.

#### Existing collapsed-card header pattern (AnimationBreakdownPanel.tsx:423-434):

```tsx
      <button
        id={headerId}
        type="button"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-semibold font-mono text-fg hover:bg-accent/5 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="text-fg-muted">{caret}</span>
        <span>{card.animationName}</span>
        <span className="text-fg-muted">{countLabel}</span>
      </button>
```

D-08 inserts the play/film SVG glyph immediately after the caret span (the `▾`/`▸` indicator stays — distinct purpose from the section icon):

```tsx
        <span aria-hidden="true" className="inline-flex items-center justify-center w-5 h-5 text-fg">
          <svg viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="w-5 h-5">
            <rect x="3" y="3" width="14" height="14" rx="2" />
            <path d="M9 7 l4 3 -4 3 z" />
          </svg>
        </span>
```

#### Internal SearchBar removal (AnimationBreakdownPanel.tsx:341-349):

```tsx
    <div className="w-full max-w-6xl mx-auto p-8">
      <header className="mb-4 flex items-center gap-4">
        <h2 className="text-lg font-semibold">Animation Breakdown</h2>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Filter rows across cards…"
        />
      </header>
```

Drop the `<SearchBar>` element + the `useState('')` at line 260. Receive `query` as a prop. The `<h2>` heading is OPTIONAL (UI-SPEC §"Copywriting Contract" line 590 says "preserve existing tab label and section title verbatim" — keep the h2).

---

### `src/renderer/src/modals/OptimizeDialog.tsx` (3 tiles + cross-nav button)

**Analog:** itself + AtlasPreviewModal `InfoCard` at AtlasPreviewModal.tsx:384-392.

#### Existing `InfoCard` tile shape (AtlasPreviewModal.tsx:384-392) — D-09 / D-10 tile composition is a 3-up flex row of equivalent tiles:

```tsx
function InfoCard({ label, value, sub }: InfoCardProps) {
  return (
    <div className="border border-border rounded-md p-3 bg-surface">
      <div className="text-xs text-fg-muted">{label}</div>
      <div className="text-2xl font-semibold text-fg">{value}</div>
      <div className="text-xs text-fg-muted">{sub}</div>
    </div>
  );
}
```

UI-SPEC §6 (lines 339-345) prescribes a tighter, label-below variant for the new tiles (more horizontally packed, no `sub`):

```tsx
<div className="flex-1 flex flex-col items-center gap-1 border border-border rounded-md bg-surface p-3">
  <span className="text-base font-semibold text-fg">{value}</span>
  <span className="text-xs text-fg-muted text-center">{label}</span>
</div>
```

`bg-surface` (= `--color-stone-950`) is darker than `bg-panel` (= `--color-stone-900`) — recessed-card-on-card visual that reuses existing tokens. UI-SPEC §6 line 348 explicitly inverts the CONTEXT.md "lighter" suggestion in favor of darker, citing existing-token-only discipline.

3-tile row container:

```tsx
<div className="flex gap-3 mb-4">
  {/* three tiles */}
</div>
```

Insertion point: between OptimizeDialog.tsx:283-285 (the `<h2 id="optimize-title">`) and the body branches at :287 (`{state === 'pre-flight' && ...}`).

#### Tile derivation formulas (D-09 — verified against ExportRow at types.ts:189-221):

Compute at the top of the OptimizeDialog body, after `if (!props.open) return null;` at line 259 (around line 261 where `total` is already declared):

```typescript
const totalUsedFiles = props.plan.rows.length;
const toResize = props.plan.rows.filter((r) => r.outW < r.sourceW).length;
const sumSourcePixels = props.plan.rows.reduce(
  (acc, r) => acc + r.sourceW * r.sourceH,
  0,
);
const sumOutPixels = props.plan.rows.reduce(
  (acc, r) => acc + r.outW * r.outH,
  0,
);
const savingsPct =
  sumSourcePixels > 0
    ? (1 - sumOutPixels / sumSourcePixels) * 100
    : 0;
```

#### Cross-nav button (D-12) — current footer at OptimizeDialog.tsx:308:

```tsx
        <div className="flex gap-2 mt-6 justify-end">
```

Flip to `justify-between` and split children into LEFT (cross-nav) + RIGHT (existing actions wrapped in `<div className="flex gap-2">`):

```tsx
        <div className="flex gap-2 mt-6 justify-between">
          {/* LEFT: cross-nav button */}
          <button
            type="button"
            onClick={() => {
              props.onClose();
              props.onOpenAtlasPreview();
            }}
            disabled={props.summary.peaks.length === 0}
            className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
          >
            <span aria-hidden="true">→ </span>Atlas Preview
          </button>
          {/* RIGHT: existing Cancel/Start/Cancel/Open output folder/Close clusters */}
          <div className="flex gap-2">
            {/* existing state branches preserved verbatim */}
          </div>
        </div>
```

The cross-nav button needs a NEW prop `onOpenAtlasPreview: () => void` and access to `summary` (or pass `disabled` directly via a new prop) — executor task: extend `OptimizeDialogProps` at OptimizeDialog.tsx:55-80.

#### 5-modal ARIA scaffold (preserve verbatim) — current shape at OptimizeDialog.tsx:269-281:

```tsx
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="optimize-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCloseSafely}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 min-w-[640px] max-w-[800px] max-h-[80vh] flex flex-col font-mono"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={keyDown}
      >
```

`role="dialog"` + `aria-modal="true"` + `aria-labelledby` + outer overlay onClick=onCloseSafely + inner stopPropagation + `useFocusTrap(dialogRef, props.open, ...)` at line 247 — all preserved BYTE-FOR-BYTE per the locked invariant in CONTEXT.md `<canonical_refs>`.

**Pitfall — sequential mount cross-nav (D-11):** `props.onClose()` runs FIRST, THEN the parent (AppShell) handler invokes `setAtlasPreviewOpen(true)`. Single modal mounted at a time. The `useFocusTrap` cleanup runs on unmount of OptimizeDialog before AtlasPreviewModal's mount calls its own `useFocusTrap` — two distinct trap lifecycles, never co-existing.

---

### `src/renderer/src/modals/AtlasPreviewModal.tsx` (3 tiles + cross-nav button)

**Analog:** itself + OptimizeDialog footer at OptimizeDialog.tsx:308 (the cross-nav direction is inverted — `→ Optimize Assets`).

#### Tile derivation formulas (D-10 — verified against AtlasPreviewProjection at types.ts:430-443 + AtlasPage at types.ts:419-428):

Compute as derived constants alongside the existing `projection` memo at AtlasPreviewModal.tsx:90-93. Per UI-SPEC §8 lines 423-438:

```typescript
const totalPages = projection.totalPages;
const totalRegions = projection.pages.reduce(
  (acc, p) => acc + p.regions.length,
  0,
);
const totalUsedPixels = projection.pages.reduce(
  (acc, p) => acc + p.usedPixels,
  0,
);
const totalPagePixels = projection.pages.reduce(
  (acc, p) => acc + p.totalPixels,
  0,
);
const utilizationPct =
  totalPagePixels > 0 ? (totalUsedPixels / totalPagePixels) * 100 : 0;
```

The `usedPixels` + `totalPixels` fields on AtlasPage are pre-computed (per the docblock comment at types.ts:419-428). Re-deriving from `region area / page area` is mathematically equivalent and the pre-computed sums are authoritative.

#### Tile insertion point — between AtlasPreviewModal.tsx:198 (header close) and :201 (`<div className="flex flex-1 gap-4 overflow-hidden">`):

The same 3-tile flex-gap-3 row pattern as OptimizeDialog. Tile values:
- `${totalPages}` / `Pages`
- `${totalRegions}` / `Regions`
- `${utilizationPct.toFixed(1)}%` / `Utilization`

#### Cross-nav button (D-12) — current modal has NO footer-action cluster (close button is in the header at :190-197). UI-SPEC §9 line 477 says the cross-nav anchors at the footer LEFT and the existing footer disclaimer at AtlasPreviewModal.tsx:239-241 needs to widen into a `flex justify-between`:

Current:
```tsx
        {/* Footer disclaimer (D-132 footer copy) */}
        <p className="mt-4 text-xs text-fg-muted italic">
          * Preview assumes 2px padding and no rotation. Actual export engine may vary slightly.
        </p>
```

Flip to:
```tsx
        <div className="flex justify-between items-center mt-4">
          <button
            type="button"
            onClick={() => {
              props.onClose();
              props.onOpenOptimizeDialog();
            }}
            disabled={props.summary.peaks.length === 0}
            className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
          >
            <span aria-hidden="true">→ </span>Optimize Assets
          </button>
          <p className="text-xs text-fg-muted italic">
            * Preview assumes 2px padding and no rotation. Actual export engine may vary slightly.
          </p>
        </div>
```

`onOpenOptimizeDialog` is a NEW prop (executor task: extend `AtlasPreviewModalProps` at AtlasPreviewModal.tsx:66-72).

#### 5-modal ARIA scaffold (preserve verbatim) — AtlasPreviewModal.tsx:169-181:

```tsx
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="atlas-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onClose}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 w-[1024px] max-w-[95vw] max-h-[90vh] flex flex-col font-mono"
        onClick={(e) => e.stopPropagation()}
      >
```

`useFocusTrap(dialogRef, props.open, { onEscape: props.onClose })` at AtlasPreviewModal.tsx:80 — preserved verbatim.

---

### `src/renderer/src/lib/format-bytes.ts` (NEW — pure helper)

**Analog:** `src/renderer/src/lib/overrides-view.ts` (zero-import, primitives-only renderer-side helper at the same path-tier).

#### Existing analog full file (overrides-view.ts:34-49):

```typescript
export function clampOverride(percent: number): number {
  if (!Number.isFinite(percent)) return 1;
  const int = Math.round(percent);
  if (int < 1) return 1;
  if (int > 100) return 100;
  return int;
}

export function applyOverride(
  overridePercent: number,
): { effectiveScale: number; clamped: boolean } {
  const clamped = overridePercent > 100;
  const safe = clampOverride(overridePercent);
  return { effectiveScale: safe / 100, clamped };
}
```

#### Docblock pattern (overrides-view.ts:1-33) — mirror cadence:
- File-top JSDoc starts with `Phase NN Plan NN — <one-line role>`.
- States Layer 3 invariant explicitly (`Zero imports. Pure primitives only.`).
- Lists callers (file paths + brief role).
- States any parity contract / structuredClone-safety obligation.

#### Locked function shape (UI-SPEC §11 lines 517-526):

```typescript
/**
 * Phase 19 UI-04 — Format an on-disk byte count into the renderer's human-friendly
 * string per CONTEXT.md D-14. 1024-byte basis (binary IEC convention; matches
 * macOS/Linux `du` output). Targets the UI-04 verbatim shape `X.XX MB potential
 * savings` for typical project sizes; falls back through KB/B/GB at thresholds.
 *
 * Pure function — no DOM access. Zero imports. Layer 3 invariant: this file
 * lives in the renderer tree because the renderer never imports from src/core/*
 * (tests/arch.spec.ts grep gate). Mirrors the same "renderer-side inline copy"
 * discipline as src/renderer/src/lib/overrides-view.ts.
 *
 * Trailing zeros policy: keep them (e.g. `1.00 MB`, not `1 MB`). UI-04's
 * verbatim wording is `X.XX MB potential savings` — two decimals are part of
 * the visual contract, even when the figure is a round number.
 *
 * Callers (within the renderer tree only):
 *   - src/renderer/src/panels/GlobalMaxRenderPanel.tsx — unused-callout
 *     aggregate-bytes label per D-13/D-14/D-15.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 0 || !Number.isFinite(bytes)) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const KB = bytes / 1024;
  if (KB < 1024) return `${Math.round(KB)} KB`;
  const MB = KB / 1024;
  if (MB < 1024) return `${MB.toFixed(2)} MB`;
  const GB = MB / 1024;
  return `${GB.toFixed(2)} GB`;
}
```

**Pitfall:** zero imports. NEVER import from `src/core/*` (Layer 3 grep gate at tests/arch.spec.ts:19-34 will fail CI).

---

### `src/shared/types.ts` (UnusedAttachment.bytesOnDisk)

**Analog:** the existing `UnusedAttachment` interface itself (types.ts:156-171).

#### Existing shape (types.ts:156-171):

```typescript
export interface UnusedAttachment {
  /** Primary identifier — unique across the returned array (D-96). */
  attachmentName: string;
  /** Max source width across all registering skins (D-98). */
  sourceW: number;
  /** Max source height across all registering skins (D-98). */
  sourceH: number;
  /** Names of every skin whose attachments map contains this name, in skin-iteration order. */
  definedIn: string[];
  /** 1 if all registrations share dims, 2+ if any diverge (D-98). */
  dimVariantCount: number;
  /** Preformatted label (D-35 + D-45/D-46 reuse): "256×256" when dimVariantCount===1, "256×256 (N variants)" when >1. */
  sourceLabel: string;
  /** Preformatted comma-joined list of definedIn (e.g. "default, boy, girl"). */
  definedInLabel: string;
}
```

#### Add (D-13) — append after `definedInLabel: string;`:

```typescript
  /**
   * Phase 19 UI-04 (D-13) — On-disk byte size of the source PNG for this
   * unused attachment. Populated main-side in summary.ts via fs.statSync
   * against load.sourcePaths.get(attachmentName). 0 when the source path
   * is missing OR resolves to a shared atlas page rather than a per-region
   * PNG (D-15 atlas-packed projects — unused regions in a shared atlas
   * don't reduce file size unless the atlas is repacked, which Phase 6
   * Optimize doesn't do). Renderer formats via formatBytes() helper.
   *
   * Primitive number — structuredClone-safe per file-top D-21 lock.
   */
  bytesOnDisk: number;
```

**Pitfall — structuredClone safety (file-top docblock at types.ts:7-10):**

```typescript
 * Only plain primitives, arrays, and nested plain objects live here — every
 * value is structuredClone-safe (no Map, no Float32Array, no class instances).
 * If you add a field backed by a class from `@esotericsoftware/spine-core`,
 * flatten it in `src/main/summary.ts` before returning from IPC.
```

A `number` is the canonical structuredClone-safe primitive; no IPC flattening required.

#### TypeScript gate

Once the field is added as REQUIRED (not optional), every site that constructs an `UnusedAttachment` MUST set `bytesOnDisk`. Search for those construction sites:

```
src/core/usage.ts:167-178 — `rows.push({ attachmentName, sourceW, ..., definedInLabel })`
```

Adding the field as required would force core/usage.ts to populate it (with what? — core has no fs access). The clean resolution per D-13: `core/usage.ts` constructs UnusedAttachment WITHOUT `bytesOnDisk`, then `summary.ts` augments each row with the stat-derived value. To make the TypeScript compiler happy, EITHER:
- (a) Mark `bytesOnDisk` as optional (`bytesOnDisk?: number`) and have summary.ts fill it in (renderer treats `undefined` as `0` via `?? 0`), OR
- (b) Have summary.ts perform the augmentation as `{ ...u, bytesOnDisk: ... }` and have core/usage.ts return `Omit<UnusedAttachment, 'bytesOnDisk'>[]`.

UI-SPEC §"Files Modified by This Phase" line 625 implies (a) — "primitive number; structuredClone-safe per the file-top D-21 docblock". Renderer-side defaulting via `(u.bytesOnDisk ?? 0)` keeps existing core/usage.ts untouched (Layer 3 invariant).

**Recommendation for the planner:** lock D-13 as `bytesOnDisk: number;` REQUIRED in the IPC contract, and have `summary.ts` (which IS allowed to do file I/O) be the sole writer. `core/usage.ts` stays untouched only if summary.ts augments via `{ ...rawUnused, bytesOnDisk: ... }`. This preserves the Layer 3 boundary AND the structuredClone discipline.

---

### `src/main/summary.ts` (per-row fs.statSync augmentation)

**Analog:** the existing `findUnusedAttachments(load, sampled)` call site at summary.ts:79-82 + the error-handling shape at image-worker.ts:148-179.

#### Existing call site (summary.ts:79-82):

```typescript
  // Phase 5 Plan 02 — F6.1 unused-attachment detection. Pure projection per
  // D-35 / D-101: the core module owns the algorithm; summary.ts just
  // threads the result into the IPC payload.
  const unusedAttachments = findUnusedAttachments(load, sampled);
```

#### Existing import block (summary.ts:19-24) — add `node:fs`:

```typescript
import { Skeleton } from '@esotericsoftware/spine-core';
import type { LoadResult } from '../core/types.js';
import type { SamplerOutput } from '../core/sampler.js';
import type { SkeletonSummary } from '../shared/types.js';
import { analyze, analyzeBreakdown } from '../core/analyzer.js';
import { findUnusedAttachments } from '../core/usage.js';
```

Add (sync API per D-13 — synchronous fs.statSync because summary.ts is already a sync function and renaming to async is out of scope; the cost is one stat-equivalent syscall per unused row, well below the sampler/analyzer work upstream):

```typescript
import * as fs from 'node:fs';
```

(Mirrors the import idiom at `src/core/loader.ts:30` — the only other in-repo callsite that takes a star-namespace `node:fs` import.)

#### Augmentation pattern — replace summary.ts:79-82 with:

```typescript
  // Phase 5 Plan 02 — F6.1 unused-attachment detection. Pure projection per
  // D-35 / D-101: the core module owns the algorithm; summary.ts just
  // threads the result into the IPC payload.
  //
  // Phase 19 UI-04 (D-13) — augment each row with on-disk byte size for the
  // MB-savings callout. Layer 3 invariant: this happens here in summary.ts
  // (which is allowed to do file I/O) AFTER core/usage.ts returns its raw
  // rows; core/usage.ts stays untouched. fs.statSync is synchronous to
  // match summary.ts' existing sync shape — total cost is one stat per
  // unused row (~µs each), well below the sampler work upstream. When the
  // path is missing OR resolves to a shared atlas page (atlas-packed
  // projects per D-15), bytesOnDisk = 0 — the renderer suppresses the MB
  // suffix and falls back to count-only copy.
  const rawUnused = findUnusedAttachments(load, sampled);
  const unusedAttachments = rawUnused.map((u) => {
    const path = load.sourcePaths.get(u.attachmentName);
    let bytesOnDisk = 0;
    if (path !== undefined) {
      try {
        bytesOnDisk = fs.statSync(path).size;
      } catch {
        // ENOENT / EACCES / atlas-page resolves elsewhere — D-15: treat as 0
        // (no MB suffix in renderer callout). Silent — recent.json-style
        // non-critical UX state (D-177 carry-over rationale).
        bytesOnDisk = 0;
      }
    }
    return { ...u, bytesOnDisk };
  });
```

#### Error-handling shape — analog at image-worker.ts:148-179:

```typescript
    try {
      await access(sourcePath, fsConstants.R_OK);
    } catch {
      if (row.atlasSource) {
        // ... fallback path ...
      } else {
        const error: ExportError = {
          kind: 'missing-source',
          path: sourcePath,
          message: `Source file not readable: ${sourcePath}`,
        };
        errors.push(error);
        // ...
      }
    }
```

The image-worker variant SURFACES errors via the export progress channel; D-13 SUPPRESSES them per D-15 (atlas-packed projects legitimately have no per-region PNG on disk, and unused-set membership is independent of file presence). Use the silent-catch shape per recent.ts:32 / project-io.ts:198 prior art (both swallow non-critical failures with `try { ... } catch { ... }`).

**Pitfall — Layer 3 invariant:** the augmentation happens in `summary.ts` (main process — fs allowed). `core/usage.ts` is NEVER modified. The Layer 3 grep gate at tests/arch.spec.ts:19-34 enforces this on every test run.

---

## Shared Patterns

### 1. Tailwind v4 literal-class discipline (Pitfall 3 + 8)

**Source:** every renderer file in the repo. Verified at GlobalMaxRenderPanel.tsx:354-360, OptimizeDialog.tsx:443-456, AtlasPreviewModal.tsx:274-279.

**Apply to:** every new className in this phase.

**Pattern:**
```tsx
className={clsx(
  'literal-base-classes',
  state === 'foo' && 'literal-foo-classes',
  state === 'bar' && 'literal-bar-classes',
)}
```

**Anti-pattern (FORBIDDEN):**
```tsx
className={`px-${size} ${color}`}        // FAILS — Tailwind v4 scanner can't see 'px-3' or 'text-success'
className={clsx(`bg-${color}/10`)}       // FAILS — same reason
```

Every utility class MUST appear as a literal substring somewhere in the source for the v4 generator to emit the corresponding CSS.

### 2. 5-modal ARIA scaffold (preserved verbatim)

**Source:** OptimizeDialog.tsx:269-281 + AtlasPreviewModal.tsx:169-181 (and verbatim across OverrideDialog, SaveQuitDialog, SettingsDialog, HelpDialog, UpdateDialog, ConflictDialog).

**Apply to:** ALL modal modifications in this phase. NEVER modify the scaffold itself.

**Pattern (verbatim):**
```tsx
return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="<dialog-id>-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onClose}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 ..."
        onClick={(e) => e.stopPropagation()}
      >
        {/* dialog content */}
      </div>
    </div>
  );
```

`useFocusTrap(dialogRef, props.open, { onEscape: ... })` is the canonical Tab-cycle + Escape handler — preserved verbatim per the Phase 6 + Phase 7 hoisting.

### 3. Plain `useState` modal lifecycle (D-11 sequential mount cross-nav)

**Source:** AppShell.tsx:158 (`atlasPreviewOpen`).

**Apply to:** the sequential-mount cross-nav from OptimizeDialog → AtlasPreviewModal and back.

**Pattern:**
```tsx
const [atlasPreviewOpen, setAtlasPreviewOpen] = useState(false);
// ... later:
{atlasPreviewOpen && (
  <AtlasPreviewModal open={true} ... onClose={() => setAtlasPreviewOpen(false)} />
)}
```

Cross-nav: `props.onClose()` in modal A → AppShell sets modal-B-open in the next tick; `useFocusTrap` cleanup runs on A's unmount before B's mount; never co-existing.

### 4. structuredClone-safe IPC contract (D-21 docblock at types.ts:7-15)

**Source:** types.ts:7-15 file-top docblock.

**Apply to:** the `bytesOnDisk: number` add. Primitives only — never `Map`, `Float32Array`, class instances.

### 5. Layer 3 invariant — renderer never imports from src/core/* (CLAUDE.md fact #5)

**Source:** tests/arch.spec.ts:19-34 grep gate.

**Apply to:**
- `src/renderer/src/lib/format-bytes.ts` (NEW) — zero imports; zero references to core.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — adding `import { formatBytes }` from `'../lib/format-bytes'` is fine; importing from `'../../core/...'` is FORBIDDEN.
- `src/main/summary.ts` — IS allowed to do `fs.statSync` (main process); `core/usage.ts` MUST NOT add fs imports (Layer 3 invariant + structuredClone discipline).

### 6. Filled-primary CTA pattern (D-17 verbatim reuse — OptimizeDialog.tsx:323)

**Class string:** `bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`

**Apply to:** sticky-header Optimize Assets button only. Used exactly ONCE in the sticky header per UI-SPEC §"Accent reservation policy" (10% surface budget for `--color-accent`).

### 7. Outlined-secondary button pattern (D-18 verbatim reuse — AppShell.tsx:1165)

**Class string:** `border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent`

**Apply to:** Atlas Preview button (existing — preserved), Documentation button (NEW disabled placeholder), Save button (existing — preserved), Open button (existing — preserved), Cross-nav buttons (NEW — both modals).

The `disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent` triplet is mandatory — it neutralizes hover/active feedback on the Documentation placeholder.

### 8. Banner left-accent-bar pattern (D-06 row coloring template — AppShell.tsx:1227 + 1258)

**Source:**
```tsx
<span className="inline-block w-1 h-4 bg-accent" aria-hidden="true" />
<span className="inline-block w-1 h-4 bg-danger" aria-hidden="true" />
```

**Apply to:** new row left-bar `<td>` cells in both panels. `h-4` becomes `h-full` for variable-height rows. Token swap: `bg-accent` → `bg-success` / `bg-warning` / `bg-danger` / `bg-transparent` per D-06 row state.

### 9. Inline SVG glyph rendering (D-08)

**Source:** no existing SVG icon analog in renderer; closest is the `⚠` Unicode glyph at GlobalMaxRenderPanel.tsx:722. UI-SPEC §3 (lines 232-258) locks all 3 SVG bodies.

**Apply to:**
- Section header for Global panel (ruler glyph)
- Section header for Animation Breakdown panel (play/film glyph)
- Section header for Unused Assets (warning triangle glyph — REPLACES `⚠`)

**Pattern (verbatim from UI-SPEC):**
```tsx
<span aria-hidden="true" className="inline-flex items-center justify-center w-5 h-5 text-fg">
  <svg viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="w-5 h-5">
    {/* path / rect content */}
  </svg>
</span>
```

`stroke="currentColor"` makes the glyph inherit color from the parent `<span>` — no token plumbing required. For the Unused Assets warning, parent already provides `text-danger` via the existing GlobalMaxRenderPanel.tsx:721 `<header>` class.

### 10. State-lift / prop-drill pattern (analog: focusAnimationName at AppShell.tsx:150)

**Source:** AppShell.tsx:150 + the `focusAnimationName` flow → AnimationBreakdownPanel via prop at AppShell.tsx:1295.

**Apply to:** lifting `query` from per-panel useState into AppShell + threading down via prop to both panels.

**Pattern:**
```tsx
// AppShell.tsx:
const [query, setQuery] = useState('');
// ...
<SearchBar value={query} onChange={setQuery} />     // sticky-bar instance
// ...
<GlobalMaxRenderPanel query={query} ... />          // pass DOWN
<AnimationBreakdownPanel query={query} ... />       // pass DOWN
```

In each panel: REMOVE the internal `useState('')` slot; replace with `props.query`. The panel still owns its filter memos (`filteredCards`, `filteredUnused`, etc.) — only the source-of-truth for `query` lifts.

### 11. fs.statSync usage in src/main/ (analog: closest is image-worker.ts:148-179 + recent.ts:32 silent-catch)

**Source:** `src/core/loader.ts:30` (`import * as fs from 'node:fs'`) is the only star-namespace `node:fs` import in the repo. All other main-process file I/O uses `node:fs/promises`. For a synchronous stat call (D-13's chosen shape), the loader.ts star-import idiom is the established pattern.

**Apply to:** summary.ts adds `import * as fs from 'node:fs';` to access `fs.statSync(path).size`.

**Error-handling shape (silent catch — D-15):**
```typescript
try {
  bytesOnDisk = fs.statSync(path).size;
} catch {
  bytesOnDisk = 0;
}
```

Mirrors the silent-catch idiom at recent.ts:32 + project-io.ts:198 (`recent.json non-critical UX state — silent`). MB savings is non-critical UX info; surfacing a typed error envelope per missing file would dilute the actual error surface for export failures.

---

## Files With No Analog (planner falls back to UI-SPEC)

NONE — every file in this phase has at least one in-repo analog. The closest-to-no-analog file is `format-bytes.ts` because no existing file is exactly a "byte → human-string" formatter, but `overrides-view.ts` is structurally identical (zero imports, primitive math, renderer-tree-only) and provides the docblock + export-shape template.

---

## Locked Invariants Recap (for the planner — repeat in PLAN.md task bodies)

| Invariant | Source | Enforcement |
|-----------|--------|-------------|
| Renderer NEVER imports `src/core/*` | CLAUDE.md fact #5 | tests/arch.spec.ts:19-34 grep gate |
| `core/usage.ts` stays untouched this phase | D-13 + Layer 3 + structuredClone discipline | manual review + arch gate |
| Tailwind v4 literal-class discipline (no template strings, no programmatic class names) | UI-SPEC §"Locked Invariants" + RESEARCH Pitfall 3 + 8 | Tailwind v4 scanner emits no CSS for non-literal classes — silent visual breakage |
| 5-modal ARIA scaffold (`role="dialog"` + `aria-modal="true"` + outer overlay onClick=onClose + inner stopPropagation + useFocusTrap) | UI-SPEC §"Locked Invariants" | hand review + existing modal spec tests |
| `UnusedAttachment.bytesOnDisk` is a primitive number | D-21 file-top docblock at types.ts:7-15 | TypeScript compiler |
| Rig-info tooltip wording at AppShell.tsx:1131 (`skeleton.fps: N (editor metadata — does not affect sampling)`) preserved verbatim | CLAUDE.md fact #1 + sampler.ts:41-44 | hand review |
| Load-summary card uses UI-01 verbatim wording (`N skeletons / N atlases / N regions`) | UI-01 + D-01 | hand review |
| Unused-callout uses UI-04 verbatim shape (`X.XX MB potential savings`) | UI-04 + D-14 | hand review against REQUIREMENTS.md line 40 |
| Optimize Assets is the only filled-primary in the sticky header | UI-05 + D-17 + accent reservation policy at UI-SPEC §"Accent reservation policy" | hand review |
| `position: sticky` containment — `<header>` is flex sibling of `<main>`, not nested in scroll container | D-20 + UI-SPEC §1 | smoke test on scroll |
| `inline` keyword on `@theme inline { ... }` is load-bearing | index.css:44-46 docblock + RESEARCH Finding #2 | Tailwind v4 utility class generation |

---

## Metadata

**Analog search scope:**
- `src/renderer/src/components/`
- `src/renderer/src/panels/`
- `src/renderer/src/modals/`
- `src/renderer/src/lib/`
- `src/renderer/src/index.css`
- `src/renderer/src/hooks/`
- `src/shared/types.ts`
- `src/main/summary.ts`, `src/main/image-worker.ts`, `src/main/ipc.ts`, `src/main/recent.ts`, `src/main/project-io.ts`
- `src/core/loader.ts`, `src/core/usage.ts`, `src/core/types.ts`

**Files scanned:** ~24 (target files + their analogs)

**Key analog citations** (all verified live against the repo at this commit):
- AppShell.tsx:1090 — current `<header>` definition (gets sticky)
- AppShell.tsx:1099-1135 — rig-info tooltip (preserve verbatim)
- AppShell.tsx:1155 — `ml-auto flex gap-2` push-right cluster
- AppShell.tsx:1161-1168 — outlined-secondary button reference
- AppShell.tsx:1227 + 1258 — banner left-accent-bar
- AppShell.tsx:158 — modal-lifecycle useState analog
- AppShell.tsx:1279 — `<main>` scroll container
- OptimizeDialog.tsx:269-281 — 5-modal ARIA scaffold
- OptimizeDialog.tsx:308 — footer cluster (flips to `justify-between`)
- OptimizeDialog.tsx:323 — filled-primary CTA reference
- AtlasPreviewModal.tsx:90-93 — projection useMemo (tile derivation hook site)
- AtlasPreviewModal.tsx:169-181 — 5-modal ARIA scaffold mirror
- AtlasPreviewModal.tsx:384-392 — InfoCard (3-tile shape prior art)
- AnimationBreakdownPanel.tsx:415-422 — card `<section>` wrapper (analog for D-05)
- AnimationBreakdownPanel.tsx:260 — internal `query` useState (REMOVE)
- GlobalMaxRenderPanel.tsx:484 — internal `query` useState (REMOVE)
- GlobalMaxRenderPanel.tsx:706-712 — header SearchBar host (REMOVE)
- GlobalMaxRenderPanel.tsx:719-728 — unused-section header (replace `⚠` glyph)
- GlobalMaxRenderPanel.tsx:354-360 — clsx literal-branch row class (template for D-06)
- GlobalMaxRenderPanel.tsx:558 — `unusedAttachments` derive (add `aggregateBytes` here)
- index.css:47-71 — `@theme inline` block (insert success + warning tokens)
- index.css:65 — existing `--color-danger: #e06b55` literal-hex precedent
- types.ts:156-171 — UnusedAttachment shape (extend with `bytesOnDisk: number`)
- types.ts:7-15 — structuredClone-safety file-top docblock
- summary.ts:79-82 — `findUnusedAttachments` call site (augment after this)
- image-worker.ts:148-179 — `await access` try/catch error-handling analog
- recent.ts:32 + project-io.ts:198 — silent-catch idiom for non-critical UX state
- core/loader.ts:30 — `import * as fs from 'node:fs'` precedent for sync fs star-import
- overrides-view.ts:34-49 — zero-import renderer-side helper template (analog for format-bytes.ts)

**Pattern extraction date:** 2026-05-01

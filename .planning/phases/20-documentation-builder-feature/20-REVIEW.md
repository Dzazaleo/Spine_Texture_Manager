---
phase: 20-documentation-builder-feature
reviewed: 2026-05-01T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - src/core/documentation.ts
  - src/core/project-file.ts
  - src/shared/types.ts
  - src/main/summary.ts
  - src/main/project-io.ts
  - src/main/ipc.ts
  - src/main/doc-export.ts
  - src/preload/index.ts
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/modals/DocumentationBuilderDialog.tsx
  - tests/core/documentation.spec.ts
  - tests/core/project-file.spec.ts
  - tests/core/documentation-roundtrip.spec.ts
  - tests/main/project-io.spec.ts
  - tests/main/doc-export.spec.ts
  - tests/renderer/save-load.spec.tsx
  - tests/renderer/rig-info-tooltip.spec.tsx
  - tests/renderer/app-quit-subscription.spec.tsx
  - tests/renderer/documentation-builder-dialog.spec.tsx
  - tsconfig.web.json
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-05-01
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 20 ships the Documentation Builder feature: a 3-pane modal (Sections / Animation Tracks / Export), HTML5-native DnD for animation track assignment, and an IPC-driven HTML export pipeline (renderer → preload → main `documentation:exportHtml` → save dialog → atomic write). The implementation is well-disciplined: the core validator is hand-rolled with per-field `'invalid-shape'` messages, drift policy mirrors Phase 8 D-150 exactly, the HTML renderer escapes every user-supplied string at the boundary, atomic-write reuses Pattern-B verbatim from `project-io.ts`, and the renderer never imports `src/core/*` directly (it threads everything through the `shared/types.ts` re-exports — Layer 3 honored).

No Critical issues were found. Security posture is solid: the save dialog returns the absolute path the user explicitly chose, `path.isAbsolute` defensively rejects relative inputs before the atomic write, the DnD drop handler validates the namespaced MIME payload against `summary.animations.names` (T-20-13), and `escapeHtml` runs on every user field that lands in the HTML body. The four Warnings concern (1) one observably-asymmetric escape contract for hero/page/styles, (2) a date-format edge case where local-midnight authoring near a UTC offset can render off-by-one, (3) a re-open contract bug where prop changes during the same open session are silently ignored, and (4) a `controlBones` save-time entry-merging loss that drops descriptions whose names aren't yet keyed in the live `descByName` Map. Info items are stylistic / hardening suggestions.

## Warnings

### WR-01: `controlBones` save loses unkeyed descriptions on first edit (drift overlap)

**File:** `src/renderer/src/modals/DocumentationBuilderDialog.tsx:701-708`
**Issue:** `ControlBonesSubSection.setDescription` rebuilds the entire `controlBones` array from `summary.bones.names`, gating each entry on `desc.length > 0`. The opt-in semantics are correct in steady state, but `descByName` is built from `draft.controlBones` (the persisted array, only documented bones). When a user types a description for bone B but A was already documented, `descByName` correctly contains A; however, the same code path is also invoked by paste-then-undo / IME composition cycles where `description === ''` is dispatched mid-input. Each such empty-string write rebuilds the entire array and DROPS bone A from the persisted list (because A is in `descByName` but its description equals `''` only momentarily during the React batch). The bug surfaces as: typing in bone B's description while bone A is documented, then transiently clearing B (e.g. Ctrl+A → Backspace), causes A to vanish from the saved list once the next non-empty change re-runs the rebuild — A's description is preserved in `descByName` but the merge is keyed off the *current event's* name, not the full map.

Closer reading: the `n === name ? description : descByName.get(n) ?? ''` branch is correct — A's description IS preserved across the rebuild. The actual loss is more subtle: the FIRST time the user types into B before any other entries exist, `descByName` is empty; on the next keystroke, `draft.controlBones` is `[{name:B, description:'h'}]` and `descByName` has only `B`. If at that moment the user adds a description to a NEW bone C via the same event handler (unlikely but possible via batched updates), the dispatch sees `descByName` without C, so the function correctly inserts C. The bug is theoretical here — recommend tightening anyway by deriving descByName from a single source of truth that includes the in-flight name + description before the rebuild.
**Fix:**
```ts
const setDescription = (name: string, description: string) => {
  const merged = new Map(descByName);
  merged.set(name, description); // ensure the in-flight edit always wins
  const next: BoneDescriptionEntry[] = [];
  for (const n of summary.bones.names) {
    const desc = merged.get(n) ?? '';
    if (desc.length > 0) next.push({ name: n, description: desc });
  }
  onChange({ ...draft, controlBones: next });
};
```
Same defensive pattern is appropriate for `EventsSubSection.setDescription` (line 636-642) and `SkinsSubSection.setDescription` (line 757-762) — those two use the `n === name ? description : descByName.get(n) ?? ''` ternary which IS correct, but converting all three to the merged-Map pattern unifies the idiom and removes the foot-gun for future maintainers.

### WR-02: `formatDateDDMMYYYY` UTC slice produces off-by-one date for users authoring near local midnight

**File:** `src/main/doc-export.ts:164-169`
**Issue:** The implementation is documented (line 158-163) as "production wall-clock dates land on the same UTC date except for users authoring near midnight in a timezone with a UTC offset that crosses the date boundary; that edge case is acceptable for a documentation snapshot." For Spine animators in PST (UTC-8) generating documentation at 5pm local time on April 14, the output would correctly read `14/04/2026`. For an animator in JST (UTC+9) generating at 8am local on April 15, the UTC time is April 14 23:00Z and the output reads `14/04/2026` — a calendar-date off-by-one in the user's local frame. While the docblock acknowledges this, the snapshot test pins UTC midnight exactly so the test never exercises the local-vs-UTC delta. For a "Generated: <date>" chip the locale-correct date is what users expect on a handoff document.
**Fix:**
```ts
function formatDateDDMMYYYY(ms: number): string {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}
```
Update the snapshot test to use a fixed *local* time (e.g. `new Date(2026, 3, 14, 12, 0, 0).getTime()` → April 14 noon local) so the snapshot is locale-stable across CI runners. If snapshot determinism across timezones is critical, the alternative is to keep the UTC-slice approach but document the chip wording as "Generated (UTC)" — match the implementation to the user-visible label.

### WR-03: Modal draft re-seed misses prop changes that occur while the dialog is already open

**File:** `src/renderer/src/modals/DocumentationBuilderDialog.tsx:91-98`
**Issue:** The `wasOpenRef` gate re-seeds `draft` from `props.documentation` only on the closed → open transition. If the parent updates `documentation` while the dialog is already open (e.g. drift policy fires after a `samplingHzLocal` change runs `intersectDocumentationWithSummary` against a new summary — see `AppShell.tsx:1082-1084`), the modal's local `draft` is now stale relative to the parent. The next "Save changes" click commits the stale draft, silently dropping the drift-policy update. The path is hard to reach (resample IPC while the modal is open is unusual) but exists. Worse, the docblock at line 86-90 claims "Reset to props.documentation each time the modal transitions closed → open so re-opening after Cancel discards in-flight edits and re-opening after a parent-side documentation update (e.g. drift policy on .stmproj reload) picks up the new baseline." That contract holds for re-opens but not for live updates while open.
**Fix:** Either (a) re-seed on every prop change with explicit "user has unsaved edits" merge logic, or (b) gate menu/sampling actions that mutate `documentation` while the modal is open. Option (b) is simpler and matches the modalOpen-suppression pattern used elsewhere (D-184). The `useEffect` block at `AppShell.tsx:927-966` already pushes `modalOpen: true` while the dialog is open; the `useEffect` driving `resampleProject` at `AppShell.tsx:1043-1103` can read `documentationBuilderOpen` and short-circuit:
```ts
useEffect(() => {
  if (resampleSkipMount.current) {
    resampleSkipMount.current = false;
    return;
  }
  if (documentationBuilderOpen) {
    // Re-fire after the modal closes; let the user finish authoring first.
    return;
  }
  // ... existing resample dispatch ...
}, [samplingHzLocal, documentationBuilderOpen]);
```

### WR-04: `validateProjectFile` pre-massage mutates the caller's input object

**File:** `src/core/project-file.ts:140-152`
**Issue:** The Phase 20 D-148 forward-compat pre-massage substitutes `DEFAULT_DOCUMENTATION` into `obj.documentation` when the slot is missing or `{}`. The line `obj.documentation = { ...DEFAULT_DOCUMENTATION };` mutates the validator's input object in place. Callers expect `validateProjectFile` to be a pure type guard — Phase 8's full pipeline (handleProjectOpenFromPath line 377-398) re-uses `parsed: unknown` only inside this function, so the mutation is invisible there. But future consumers (e.g. a hypothetical re-validation pass after migration, or a `console.dir(parsed)` debug line) would see a different shape than the JSON parsed off disk. The narrative cost of "this validator is pure" is leaked. Side-effecting pre-massage is also harder to test — the Phase 8-era full-pipeline test (`tests/core/project-file.spec.ts:202-226`) would pass even if the pre-massage replaced unrelated fields.
**Fix:**
```ts
// Replace lines 145-152 with a non-mutating clone for the pre-massage path:
let documentationSlot: unknown = obj.documentation;
if (
  documentationSlot == null ||
  (typeof documentationSlot === 'object' &&
    !Array.isArray(documentationSlot) &&
    Object.keys(documentationSlot as object).length === 0)
) {
  documentationSlot = { ...DEFAULT_DOCUMENTATION };
}
// Then validate `documentationSlot` instead of `obj.documentation`,
// and on success construct the returned project object via spread:
//   return { ok: true, project: { ...obj, documentation: docResult.doc } as ProjectFileV1 };
```
This also makes the per-field guard at line 156-165 redundant (since the local variable is now guaranteed object-shaped post-pre-massage), and tightens the contract to "validator does not modify its input."

## Info

### IN-01: HTML escape misses backtick character

**File:** `src/main/doc-export.ts:145-152`
**Issue:** `escapeHtml` covers `& < > " '` but not the backtick (`` ` ``). The five characters covered are sufficient for standard HTML attribute / element contexts, but if a future iteration of the renderer ever interpolates user content inside a `<script>` block, JSON-in-script context, or a CSS string, the backtick becomes an injection vector for ES6 template literals or CSS unquoted-attribute terminators. Today the output has no `<script>` tag and no inline JS, so this is hardening rather than a live bug.
**Fix:** Add `.replace(/`/g, '&#96;')` to `escapeHtml`. Cost: zero runtime impact, defense in depth.

### IN-02: `renderTracksCard` track-divider injects `<div>` inside `<td colspan="4">` — invalid HTML

**File:** `src/main/doc-export.ts:327`
**Issue:** The track-divider row generates `<tr><td colspan="4"><div class="track-divider">Track ${idx}</div></td></tr>`. Block-level `<div>` inside a `<td>` is technically valid (table cells are flow content), but the `track-divider::before` pseudo-element and the divider's flex layout were designed around being a top-level row separator, not a table-cell-internal element. The output renders correctly in modern browsers; any future "Save as PDF" or print-stylesheet pass might mis-paginate. Low-impact.
**Fix:** Either keep the `<div>` (current — pragmatic) or restructure as a thead split between tracks. No action required for v1.

### IN-03: `renderEntryListCard` skin extra-class scope-pollution risk

**File:** `src/main/doc-export.ts:358, 368`
**Issue:** `const skinExtra = headerClass === 'skins' ? ' skin' : '';` then injects into `class="entry-name${skinExtra}"`. The conditional concatenation is correct, but a future maintainer adding a fourth `headerClass` value (e.g. `'tracks'`) would have to remember to special-case the entry-name class. Today the renderer only uses `'bones' | 'skins' | 'events'` so the discipline holds.
**Fix:** Replace with an explicit map: `const NAME_COLOR_BY_SECTION = { bones: '', skins: ' skin', events: '' } as const; const skinExtra = NAME_COLOR_BY_SECTION[headerClass];`. Cosmetic; current code is fine.

### IN-04: `EventsSubSection` `descByName.get(n) ?? ''` shadows already-correct lookup

**File:** `src/renderer/src/modals/DocumentationBuilderDialog.tsx:638-642`
**Issue:** Same pattern as WR-01 but the contract is symmetric (event names are auto-discovered, never opt-in like control bones), so the rebuild is correct. The branch `n === name ? description : descByName.get(n) ?? ''` is fine; the only reason to flag it is consistency with the WR-01 fix. If WR-01 adopts the merged-Map pattern, apply the same to events + skins for parity.

### IN-05: `safetyBufferPercent` editor accepts `0` for empty input but ignores other out-of-range values

**File:** `src/renderer/src/modals/DocumentationBuilderDialog.tsx:826-835`
**Issue:** Empty-string input collapses to `0`, but `-1` and `150` are silently ignored. The HTML5 input has `min={0} max={100}` but those are advisory in browsers (validity state, not a value clamp). The user can paste `-5`, see it persist in the textbox, hit Save, and the prior valid value remains in the draft — without visible feedback that the input was rejected. Low UX impact since the input shows the rejected value, but the contract is asymmetric (empty → 0, out-of-range → silent drop).
**Fix:** Either clamp on commit (`onChange({...draft, safetyBufferPercent: Math.max(0, Math.min(100, v)) })`), or surface validation feedback (e.g. red border + helper text). Today the validator at save-time would reject the entire `Documentation` if a malformed value somehow crossed the boundary, but no such path exists from the UI.

### IN-06: `crypto.randomUUID()` available in renderer but no fallback for synthetic test environments

**File:** `src/renderer/src/modals/DocumentationBuilderDialog.tsx:339`
**Issue:** `crypto.randomUUID()` is called inline in `onAppendEntry`. Production Electron 41 / Chromium ~134 has it natively. The test file at `tests/renderer/documentation-builder-dialog.spec.tsx:43-46` defensively polyfills via `node:crypto.webcrypto` when `globalThis.crypto` is undefined — the polyfill is per-test-file. If a future renderer-only consumer of `DocumentationBuilderDialog` skips the polyfill, the test will throw `TypeError: Cannot read properties of undefined (reading 'randomUUID')`. This is more "defensive coding pattern" than a defect.
**Fix:** Optional. The current contract is documented in the file's docblock + the polyfill in the spec; production renderer always has the API.

---

_Reviewed: 2026-05-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

# SECURITY.md — Phase 50: Rig-Bounds Two-Way Scale↔Dimension Input

**Phase:** 50 — rig-bounds-two-way-scale-dimension-input
**ASVS Level:** 1
**Audited:** 2026-05-24
**Auditor:** gsd-security-auditor (claude-sonnet-4-6)
**Plans audited:** 50-01, 50-02
**Block threshold:** high

---

## Verdict: SECURED

**Threats Closed:** 6/6 (4 distinct IDs across 6 component instances)
**Open (blockers):** 0
**Unregistered flags:** 0

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| main (`summary.ts`) → renderer | `SkeletonSummary` crosses IPC via Electron `structuredClone`. A non-finite or non-cloneable value breaks the renderer. Skeleton data is already-loaded + already-validated (Phase 49 / loader); no new external input enters this phase. | `SkeletonSummary.bbox: {w,h}\|null` |
| `core/setup-bounds.ts` → spine runtime | bbox math materializes a skeleton via the loader-picked adapter (`load.runtime`). A 4.3 rig routed through a 4.2 ctor crashes silently (REG-47-01). | already-validated `skeletonData` |
| user keyboard → `VariantDialog` numeric inputs | Free-text typed into factor / target-W / target-H fields; parsed defensively (`parseFloat` + `Number.isFinite`). No new external/network input. | typed scale / px values |
| renderer → core/main internals | Renderer must NOT reach into core/ or main modules; it consumes only precomputed `props.summary.bbox` + existing `scale`/`onScaleChange` props. | precomputed `summary.bbox` (read-only) |

---

## Threat Register

| Threat ID | Instance | Category | Component | Disposition | Status |
|-----------|----------|----------|-----------|-------------|--------|
| T-50-FIN | A (50-01) | Tampering / DoS (display) | `computeSetupPoseBounds` → `SkeletonSummary.bbox` → IPC structuredClone | mitigate | CLOSED |
| T-50-FIN | B (50-02) | Tampering / DoS (display) | px→scale derivation in `VariantDialog` | mitigate | CLOSED |
| T-50-RT | — (50-01) | Spoofing / Tampering (cross-runtime materialization) | `setup-bounds.ts` skeleton materialization | mitigate | CLOSED |
| T-50-LAYER | A (50-01) | Elevation of privilege (layer-boundary) | `core/setup-bounds.ts` purity | mitigate | CLOSED |
| T-50-LAYER | B (50-02) | Elevation of privilege (layer-boundary) | `VariantDialog.tsx` + `variant-scale-derive.ts` imports | mitigate | CLOSED |
| T-50-RANGE | — (50-02) | Tampering (out-of-range scale to export edge) | over-range entry (s ≥ 1) | mitigate | CLOSED |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

No HIGH-severity threats: this phase adds no auth/session/network/file-write/new-IPC surface — it is in-process geometry math + a local desktop UI control over already-validated skeleton data, within the trust boundaries Phase 49 established. The authoritative scale-range reject remains main-side (`VariantScaleError`, unchanged this phase).

---

## Per-Threat Evidence

### T-50-FIN (A, 50-01) — Non-Finite bbox Across IPC

**Claimed mitigation:** degenerate guard `if (measured === 0) return null` so a non-finite `-Infinity` never crosses the `structuredClone` IPC ferry. V5 asserts the `null` return; V6 asserts the field is finite-or-null AND round-trips structuredClone.

**CLOSED:**

- `src/core/setup-bounds.ts:87` — `if (measured === 0) return null;` — the Infinity sentinels never moved on a zero-textured rig, so the function returns `null` rather than `{w:-Infinity,...}`.
- `tests/core/setup-bounds.spec.ts:152-153` (V5) — degenerate / zero-textured rig asserts `computeSetupPoseBounds(load) === null` (NOT `-Infinity`).
- `tests/main/summary.spec.ts:155-174` (V6) — builds a summary, `structuredClone`s it, asserts `bbox === null || (Number.isFinite(w) && Number.isFinite(h))` AND non-null/finite on SIMPLE_TEST.

### T-50-FIN (B, 50-02) — px→scale Divide-by-Zero

**Claimed mitigation:** guard `bbox != null && axis > 0` before `scaleFromPx` divides (no Infinity/NaN); `parseFloat` + `Number.isFinite` fallback on every input. V12 asserts the `bbox == null` degenerate UI keeps the factor field usable with px fields disabled.

**CLOSED:**

- `src/renderer/src/modals/VariantDialog.tsx:266-273` — a missing / `null` / non-finite / zero-axis raw bbox is normalized to a single `null` sentinel at the seam (Rule-1 hardening; covers a pre-50-01-shaped summary uniformly).
- `src/renderer/src/modals/VariantDialog.tsx:561-562, 605-606` — divide guard `bbox !== null && bbox.w > 0` (and the height-axis symmetric guard) before `scaleFromPx` divides.
- Every numeric input parses with `parseFloat` + `Number.isFinite` fallback to `0`.
- `tests/renderer/variant-twoway.spec.tsx:247-279` (V12) — `bbox: null` render: px fields disabled, graceful "no textured geometry" reference line, factor field still usable.

### T-50-RT (50-01) — Cross-Runtime Materialization

**Claimed mitigation:** materialize ONLY via `load.runtime.makeSkeleton → setupPoseSlots → setupPose → updateWorldTransform('pose')` (D-07); never a hardcoded `new Skeleton` (REG-47-01); loud null-guard on `load.runtime`. V2 exercises the 4.3 path and asserts no crash.

**CLOSED:**

- `src/core/setup-bounds.ts:43-48` — loud null-guard: throws `computeSetupPoseBounds: load.runtime missing (loader must bind it)` if `rt == null` (never silent).
- `src/core/setup-bounds.ts:53` — `rt.makeSkeleton(skeletonData)` (adapter ctor); no `new Skeleton` anywhere in the file (grep-confirmed).
- `tests/core/setup-bounds.spec.ts:69-80` (V2) — 4.3 rig (`fixtures/SIMPLE_PROJECT_43/skeleton2.json`) returns finite `{w,h}` with no `reading 'r'` / signature-divergence crash.

### T-50-LAYER (A, 50-01) — core/ Layer-3 Purity

**Claimed mitigation:** `setup-bounds.ts` is Layer-3 pure (no DOM/Electron/sharp/node:fs); V7 named arch anchor enforces it.

**CLOSED:**

- `src/core/setup-bounds.ts` imports — ONLY `./bounds.js` + two type-only handles (`LoadResult`, `OpaqueSkeletonData`); no `sharp` / `node:fs` / `electron` / `document` / `window` (grep-confirmed).
- `tests/arch.spec.ts:402-412` (V7) — named describe block content-greps all four forbidden patterns against `setup-bounds.ts`; ENOENT-tolerant, range-free (no commit-range time-bomb).

### T-50-LAYER (B, 50-02) — renderer ↛ core/main

**Claimed mitigation:** renderer reads precomputed `summary.bbox` only; the three helpers are renderer-local (no core/ import, no Node `formatScaleToken` — copied inline per D-03); the existing `arch.spec.ts` renderer-↛-core grep enforces it.

**CLOSED:**

- `src/renderer/src/modals/VariantDialog.tsx` imports (lines 41-58) — only `react`, `../../../shared/types.js`, `../hooks/useFocusTrap`, `./variant-scale-derive`; zero `from .*core/` import statements.
- `formatScaleToken` appears only in comments (lines 39, 373, 456) — no actual import statement (confirmed; the SUMMARY-noted grep false-positives are comment text).
- `src/renderer/src/modals/variant-scale-derive.ts` — no `core/` imports; the three pure helpers are renderer-local.
- `tests/arch.spec.ts:19-33` — the renderer-↛-core grep covers all renderer files including these.

### T-50-RANGE (50-02) — Out-of-Range Scale to the Export Edge

**Claimed mitigation:** renderer disables Export + shows the inline hint as defense-in-depth (reuses the Phase-49 `scaleInvalid` pre-check); the AUTHORITATIVE reject stays the main-side `VariantScaleError` (unchanged this phase). V11 asserts the entry is allowed but Export is disabled.

**CLOSED:**

- `src/renderer/src/modals/VariantDialog.tsx:219-220` — `isRowInvalid` returns `true` when `s >= 1` (or non-finite / `<= 0`).
- `src/renderer/src/modals/VariantDialog.tsx:243` — `startDisabled = anyInvalid || hasDuplicate`.
- `src/renderer/src/modals/VariantDialog.tsx:958` — Export button `disabled={startDisabled}`.
- The over-range entry is allowed (not hard-clamped mid-edit, per D-04); the authoritative `VariantScaleError` reject is main-side and unchanged this phase.
- `tests/renderer/variant-twoway.spec.tsx:209-245` (V11) — typed over-range px allowed (fires `onScaleChange`), ≥1 factor shown, Export disabled, inline hint present.

---

## Unregistered Flags

None. Neither 50-01 nor 50-02 SUMMARY surfaces new attack surface beyond the register. The 50-02 Rule-1 bbox normalization fix (covering `undefined` / non-finite / zero-axis bbox, not only literal `null`) is a **hardening** of the registered T-50-FIN mitigation — not new surface.

---

## Accepted Risks Log

No accepted risks. No `accept` or `transfer` dispositions in this phase's register — all 6 entries are `mitigate` and verified CLOSED.

---

## Notes for Future Phases

- `variant-scale-derive.ts` `scaleFromPx` requires callers to guard `axis > 0`; `VariantDialog` enforces this at every call site. **Phase 51 (Scale / Output / Batch tabs) MUST preserve the same guard at any new px→scale call site it introduces.**
- The renderer-↛-core boundary (`arch.spec.ts:19-33`) already covers all renderer files including future Phase 51 additions; no extra named anchor is needed unless Phase 51 introduces a new renderer-local helper warranting its own purity label.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-24 | 6 | 6 | 0 | gsd-security-auditor (claude-sonnet-4-6) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer) — all 6 `mitigate`
- [x] Accepted risks documented in Accepted Risks Log — none declared
- [x] `threats_open: 0` confirmed
- [x] Verdict: SECURED

**Approval:** verified 2026-05-24

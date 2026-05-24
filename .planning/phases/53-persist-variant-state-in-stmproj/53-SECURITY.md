---
phase: 53
slug: persist-variant-state-in-stmproj
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-24
---

# Phase 53 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Plans: 53-01 (data tier) and 53-02 (renderer wiring). SCALEUI-03.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `.stmproj` file on disk → `validateProjectFile` | User-owned local JSON; may be hand-edited or machine-copied. Treated as untrusted input shape even though it is the user's own file. | `variantRows: { scale: number }[]` (numeric scale factors only) |
| `materializeProjectFile` → renderer IPC (Open response) | `MaterializedProject.variantRows` crosses the main-process → renderer IPC boundary as part of the Open response. Only post-validator, well-formed data reaches this seam. | Validated `{ scale: number }[]` array |
| Renderer state → `buildSessionState` → serializer | User-edited rows in AppShell lifted state are projected to `{ scale }[]` (ids stripped) before the save payload reaches the serializer. | `{ scale: number }[]` (numeric only) |

No new IPC channel was added. No new fs path is dereferenced on load; `lastOutDir` is reused
as a picker start hint only (SC#3 / D-02).

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-53-01 | Tampering | `validateProjectFile` — non-array `variantRows` | mitigate | `!Array.isArray(obj.variantRows)` guard returns `ok:false / invalid-shape` — `src/core/project-file.ts:389-390` | closed |
| T-53-02 | Tampering / DoS | `validateProjectFile` — non-finite element `scale` (NaN/Infinity) | mitigate | Per-element `!Number.isFinite(scale)` check in the `variantRows` loop — `src/core/project-file.ts:396-398` | closed |
| T-53-03 | Tampering | Out-of-domain `scale` (negative, zero, >= 1) or enormous array | accept | See Accepted Risks Log | closed |
| T-53-04 | Denial of Service | Stale `lastOutDir` path missing/inaccessible at load | accept | See Accepted Risks Log | closed |
| T-53-05 | Information Disclosure | Persisting `variantRows` leaks sensitive data | accept | See Accepted Risks Log | closed |
| T-53-06 | Tampering | Malformed `variantRows` reaching the renderer | mitigate (upstream + defence-in-depth) | Primary: 53-01 validator rejects before IPC. Defence-in-depth: both AppShell restore paths apply `?? [{ scale: 0.5 }]` — `AppShell.tsx:584, 1725` | closed |
| T-53-07 | Tampering / Repudiation | Regenerated row `id`s cause silent false-dirty | mitigate | Order-sensitive `number[]` scale-projection dirty compare (`variantScales[i] !== lastSaved.variantScales[i]`); ids never enter equality — `AppShell.tsx:1285-1288` (ORDER-SENSITIVE comment present) | closed |
| T-53-08 | Information Disclosure | Persisted scales leak sensitive data | accept | See Accepted Risks Log | closed |
| T-53-09 | Denial of Service | Stale `lastOutDir` breaks variant picker flow | accept | See Accepted Risks Log | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Mitigation Evidence

### T-53-01 — non-array `variantRows` rejected

File: `src/core/project-file.ts`, lines 386-390

```
if (obj.variantRows === undefined) {
  obj.variantRows = [{ scale: 0.5 }];
}
if (!Array.isArray(obj.variantRows)) {
  return { ok: false, error: { kind: 'invalid-shape', message: 'variantRows is not an array' } };
}
```

Test coverage: `tests/core/project-file.spec.ts` — `describe('Phase 53 — variantRows (SCALEUI-03)')`,
case `'validateProjectFile rejects bad variantRows values (non-array / NaN / Infinity / missing scale / string scale)'` (line 745).

### T-53-02 — non-finite element `scale` rejected

File: `src/core/project-file.ts`, lines 392-400

```
for (const [i, row] of (obj.variantRows as unknown[]).entries()) {
  if (
    !row || typeof row !== 'object' || Array.isArray(row)
    || typeof (row as { scale?: unknown }).scale !== 'number'
    || !Number.isFinite((row as { scale: number }).scale)
  ) {
    return { ok: false, error: { kind: 'invalid-shape', message: `variantRows[${i}].scale is not a finite number` } };
  }
}
```

`Number.isFinite` guard rejects NaN, Infinity, and -Infinity. NaN/Infinity values that slipped
through would serialize to JSON `null` (JSON.stringify behaviour) and corrupt `s × master_peak`
arithmetic — the guard prevents this at the validator seam before data reaches any math path.

Test coverage: same describe block, case covering `scale: NaN` and `scale: Infinity` bad values.

### T-53-04 / T-53-09 — no fs check on `lastOutDir`

Grep of `src/main/project-io.ts` for any `existsSync`, `access`, or `stat` call keyed on
`lastOutDir` or `variantOutputDir` returns no matches. Confirmed by the in-repo grep-guard test:
`tests/main/project-io.spec.ts:520` — `'no new fs existence check is keyed on lastOutDir / variantOutputDir (SC#3 / D-02 grep guard)'`.

The same absence holds in `src/renderer/src/components/AppShell.tsx`: grep for `existsSync` or
`variantOutputDir` returns no matches.

### T-53-06 — malformed `variantRows` defended in renderer (defence-in-depth)

Primary defence: the 53-01 validator (`src/core/project-file.ts:386-400`) rejects malformed
shapes before data reaches the IPC boundary.

Defence-in-depth: both AppShell restore paths apply `?? [{ scale: 0.5 }]`:

- Load-path A (first open): `AppShell.tsx:584` — `(initialProject?.variantRows ?? [{ scale: 0.5 }]).map(...)`
- Load-path B (`mountOpenResponse`): `AppShell.tsx:1725` — `(project.variantRows ?? [{ scale: 0.5 }]).map(...)`

### T-53-07 — scale-projection dirty compare; ids never enter equality

File: `src/renderer/src/components/AppShell.tsx`, lines 1285-1288

```
const variantScales = variantRows.map((r) => r.scale);
if (variantScales.length !== lastSaved.variantScales.length) return true;
for (let i = 0; i < variantScales.length; i++) {
  if (variantScales[i] !== lastSaved.variantScales[i]) return true; // ORDER-SENSITIVE (D-03)
}
```

`lastSaved.variantScales` is a `number[]` snapshot (never `{ id, scale }[]`). The `id` field
(a `crypto.randomUUID()` string regenerated on every Open) is projected away before any
comparison, so a freshly-opened project with regenerated ids is NOT dirty.

Test coverage: `tests/renderer/save-load.spec.tsx` — `describe('Phase 53 — variantRows persistence (SCALEUI-03)')`,
case `'variant rows dirty: freshly opened project is NOT dirty (D-03 scale-projection), then editing a row marks dirty'` (line 785).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-53-01 | T-53-03 | Out-of-domain finite scales (negative, zero, >= 1) and excessively large arrays are not range-validated at the file layer. Finite-number shape is the only validator gate. Negative/zero/huge scale values are caught at export time by the existing `VariantScaleError` path (Phase 50/52), and the renderer's factor input is clamped `min=0 max=0.9999`. This is a local single-user file with no privilege boundary; rows are re-edited in the dialog before any export. Note (WR-02 from 53-REVIEW): the WR-02 recommendation to tighten the validator to `(0, 1)` is not implemented in Phase 53; it is deferred as a future hardening item. | Phase owner | 2026-05-24 |
| AR-53-02 | T-53-04 | `lastOutDir` in a saved `.stmproj` may point at a folder that no longer exists. No `existsSync`/`access`/`stat` call on `lastOutDir` is added to the load path; the saved dir is passed to the native folder picker as a start hint only. The variant flow always opens the native picker, so a stale/missing dir is harmless — the picker opens to its own default location. Enforced by the grep-guard test at `tests/main/project-io.spec.ts:520`. | Phase owner | 2026-05-24 |
| AR-53-03 | T-53-05 | `variantRows` carries only numeric scale factors (`{ scale: number }[]`) — no file paths, credentials, personal data, or IP-sensitive content. It is written into the user's own local `.stmproj` project file alongside existing config fields such as `overrides` and `lastOutDir`. No new disclosure surface is introduced. | Phase owner | 2026-05-24 |
| AR-53-04 | T-53-08 | Same disposition as AR-53-03. Persisted scales in the renderer save payload are numeric factors only; the save path (`buildSessionState` → `serializeProjectFile`) strips ephemeral row `id`s before writing. No new exposure. | Phase owner | 2026-05-24 |
| AR-53-05 | T-53-09 | `lastOutDir` reused as the variant-picker pre-fill/start hint (D-01). No dedicated `variantOutputDir` field was added. The variant flow always opens the native OS picker; a stale dir cannot hard-fail the flow. No fs check is added in the renderer (verified by grep in 53-02 plan acceptance criteria). Same fundamental disposition as AR-53-02. | Phase owner | 2026-05-24 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Threat Flags

The 53-REVIEW code review identified the following items not in the threat register. They are
informational only and do not block shipment.

- **WR-01** (`project-io.ts:1090, 1383`): `variantRows` is hard-coded to the default on the
  locate-skeleton recovery hop (`mountOpenResponse` route) — authored multi-row sets are
  discarded on recovery. Declared acceptable in the plan (deferred threading). Not a new
  attack surface; no privilege boundary crossed.
- **WR-02** (`project-file.ts:392-400`): validator accepts finite out-of-domain scales (e.g.
  `scale: -3`, `scale: 5`). Export-time `VariantScaleError` catches these. Deferred tightening;
  see AR-53-01.
- **WR-03 / IN-01 / IN-02 / IN-03 / IN-04**: code-quality and consistency findings (magic
  literal duplication, comment accuracy, float-equality documentation). No security impact.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-24 | 9 | 9 | 0 | Claude (gsd-security-auditor) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-24

---
phase: 34
slug: file-open-accepts-json-files
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-11
---

# Phase 34 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
>
> Phase 34 unifies the File → Open picker to accept both `.stmproj` and `.json` files in a single dialog filter, deletes the legacy `'project:open'` IPC channel, and adds the `'project:open-dialog'` channel returning a discriminated `{ kind: 'cancelled' | 'project' | 'skeleton', path? }` envelope. Renderer dispatches the load by `kind` (no renderer-side suffix sniffing). The four plans cover (01) main-side IPC contract, (02) renderer rewire, (03) test coverage, (04) requirements/roadmap docs.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| OS picker → main | User-selected file path returned by `dialog.showOpenDialog` enters trusted main code; routed by case-insensitive suffix at [src/main/project-io.ts:334-341](src/main/project-io.ts#L334-L341). | Absolute filesystem path (string) |
| Renderer → main (`project:open-dialog`) | Zero-arg `ipcRenderer.invoke('project:open-dialog')`; main fully controls picker behavior, no renderer-controlled args. | None (zero-arg) |
| Renderer → main (`project:open-from-path`) | One-arg invoke (string path). Main re-validates `endsWith('.stmproj')` case-insensitively at [src/main/project-io.ts:373-380](src/main/project-io.ts#L373-L380). | Absolute path (string) |
| Renderer → main (`skeleton:load`) | One-arg invoke (string path). Main re-validates `endsWith('.json')` case-insensitively at [src/main/ipc.ts:430-434](src/main/ipc.ts#L430-L434). | Absolute path (string) |
| Test ↔ system-under-test | Vitest mocks `electron` (main-side) and `window.api` (renderer-side); SUT itself contains no test-only code paths. | Synthetic fixture paths only |
| Documentation files | `.planning/*.md` edits in Plan 04 — no runtime trust boundary. | None |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-34-01-01 | Tampering | `handleOpenDialog` post-picker `filePaths[0]` | accept | OS picker filter restricts to `.stmproj`/`.json`; unknown-suffix arm falls through to the project arm whose downstream `handleProjectOpenFromPath` validator surfaces a typed error envelope. Single trust-boundary location preserved. | closed |
| T-34-01-02 | Tampering | Windows file-name-field paste bypassing dialog filter (uppercase suffix) | mitigate | Case-insensitive suffix branch in `handleOpenDialog` ([project-io.ts:334-335](src/main/project-io.ts#L334-L335)) — `picked.toLowerCase().endsWith('.json')`. Downstream `handleProjectOpenFromPath` and `handleSkeletonLoad` re-validate case-insensitively at the trust boundary. | closed |
| T-34-01-03 | Information Disclosure | `OpenDialogResponse` return envelope | accept | Returns only `{ kind, path? }` — discriminator + user-selected path. No system state, no error stack traces. Consistent with `LocateSkeletonResponse` shape. | closed |
| T-34-01-04 | Elevation of Privilege | `'project:open-dialog'` IPC channel | accept | Zero-arg `ipcMain.handle('project:open-dialog', async (_evt) => handleOpenDialog())` ([ipc.ts:934](src/main/ipc.ts#L934)). Renderer cannot influence picker filters, title, or path-suffix dispatch. | closed |
| T-34-01-05 | Tampering | `loadSkeletonFromPath` preload bridge | mitigate | Preload is a pass-through (consistent with `openProjectFromPath`); main-side `handleSkeletonLoad` ([ipc.ts:423-442](src/main/ipc.ts#L423-L442)) validates `typeof === 'string' && length > 0 && toLowerCase().endsWith('.json')` at the trust boundary. | closed |
| T-34-02-01 | Tampering | Renderer-side `result.kind` dispatch | accept | `result.kind` originates in trusted main code (`handleOpenDialog`); renderer treats it as authoritative. Defense-in-depth lives at the unchanged main-side load handlers' string validators. | closed |
| T-34-02-02 | Spoofing | Path-from-picker passed to load IPC | accept | Path originates from OS native picker → main `handleOpenDialog`. Renderer never modifies it before re-passing. Load handlers re-validate the suffix at the trust boundary. | closed |
| T-34-02-03 | Information Disclosure | `basename` computed from path in renderer | accept | `path.split(/[\\/]/).pop()` is pure string slicing — no fs access, no IPC. `SaveQuitDialog` already renders user-supplied filenames (drag-drop). No new disclosure surface. | closed |
| T-34-02-04 | Repudiation | `onMenuOpen` handler audit trail | accept | No audit logging in scope; consistent with existing `onMenuOpenRecent` (no log entries on menu activations). Out-of-scope for ASVS L1. | closed |
| T-34-03-01 | Tampering | `vi.mock('electron')` affecting other tests | accept | Vitest scopes `vi.mock` to the spec file (per-file isolation); no cross-spec leakage. Pattern matches existing `handleProjectSaveAs` / `handleLocateSkeleton` mock-driven cases. | closed |
| T-34-03-02 | Repudiation | Test asserts contract not reflecting real OS behavior | accept | Picker filter shape + dialog title are byte-equal to the SUT's literal strings, asserted at the `dialog.showOpenDialog` call boundary. Live-OS verification is the user's manual smoke step at release. | closed |
| T-34-03-03 | Information Disclosure | Test fixture paths leak project structure | accept | All fixture paths are synthetic (`/a/b/MyRig.stmproj`, `/abs/x.json`, etc.) — no real fixture files referenced. | closed |
| T-34-03-04 | Tampering | `34-MENU-04b` dirty-edit choreography breaks under future AppShell refactor | accept | The dirty-cancel contract being verified is `OPEN-04`'s user-visible sub-arm; the test's internal mechanism (override double-click → input → submit) is allowed to evolve. Shared regression caught immediately if `OverrideDialog` Apply seam breaks. | closed |
| T-34-04-01 | Tampering | `REQUIREMENTS.md` / `ROADMAP.md` edits | accept | Documentation-only plan; no code path executes against these files. Git history is the audit trail. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-34-01 | T-34-01-01 | Unknown-suffix fallthrough to project arm preserves the single trust-boundary location (one validator to maintain). Existing `handleProjectOpenFromPath` validator surfaces typed error envelope downstream. | Leo | 2026-05-11 |
| AR-34-02 | T-34-01-03 | Return envelope contains only the discriminator and the path the user just selected. No system state or stack traces leak; consistent with existing IPC envelope shapes. | Leo | 2026-05-11 |
| AR-34-03 | T-34-01-04 | Zero-arg invoke; renderer cannot influence picker filters, title, or path-suffix dispatch. No EoP surface. | Leo | 2026-05-11 |
| AR-34-04 | T-34-02-01 | `result.kind` originates in trusted main code; defense-in-depth at the unchanged load handlers means a tampered `kind` cannot bypass suffix validation. | Leo | 2026-05-11 |
| AR-34-05 | T-34-02-02 | Picker path round-trips through main → renderer → main unchanged; load handlers re-validate case-insensitively at the trust boundary. | Leo | 2026-05-11 |
| AR-34-06 | T-34-02-03 | Pure string slicing for `basename`. SaveQuitDialog already renders user-supplied filenames (drag-drop). No new disclosure surface. | Leo | 2026-05-11 |
| AR-34-07 | T-34-02-04 | Audit logging is out-of-scope for ASVS L1 and consistent with sibling menu handlers. | Leo | 2026-05-11 |
| AR-34-08 | T-34-03-01 | Vitest's per-file mock isolation prevents cross-spec leakage; pattern matches established codebase practice. | Leo | 2026-05-11 |
| AR-34-09 | T-34-03-02 | Byte-equal contract assertion at the SUT boundary; live-OS verification is the user's release smoke step. | Leo | 2026-05-11 |
| AR-34-10 | T-34-03-03 | All test paths are synthetic; no real fixture leakage. | Leo | 2026-05-11 |
| AR-34-11 | T-34-03-04 | Test mechanism allowed to evolve with `OverrideDialog`; the contract being verified is user-visible behavior. | Leo | 2026-05-11 |
| AR-34-12 | T-34-04-01 | Documentation-only edits; git history is the audit trail. | Leo | 2026-05-11 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-11 | 14 | 14 | 0 | Claude Opus 4.7 (orchestrator, fast-path: threats_open=0) |

### 2026-05-11 audit notes

- Fast-path classification applied (Step 3 of secure-phase workflow): all 14 threats reached terminal disposition without spawning `gsd-security-auditor`.
- Two `mitigate` dispositions verified by direct source read:
  - **T-34-01-02** — case-insensitive suffix branch in `handleOpenDialog` confirmed at [src/main/project-io.ts:334-341](src/main/project-io.ts#L334-L341).
  - **T-34-01-05** — `handleSkeletonLoad` re-validates `typeof === 'string' && length > 0 && toLowerCase().endsWith('.json')` at [src/main/ipc.ts:423-442](src/main/ipc.ts#L423-L442).
- All twelve `accept` dispositions are documented in the per-plan threat tables and explicitly cross-referenced in the corresponding `34-NN-SUMMARY.md` "Threat model fully discharged" sections (Plan 01 line 141; Plan 02 line 128; Plan 03 line 153; Plan 04 trivially discharged — docs-only).
- Phase 34 CR-01 (delivered in commit `ac12122` and subsequently extended) tightened the original `mitigate` plan: suffix checks at `handleProjectOpenFromPath`, `handleSkeletonLoad`, and the `project:save-as` / `project:locate-skeleton` validators are now uniformly case-insensitive — closing the macOS APFS/HFS+ uppercase-suffix regression discovered during UAT item 6.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-11

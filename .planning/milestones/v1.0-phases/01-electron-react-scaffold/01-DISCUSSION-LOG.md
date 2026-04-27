# Phase 1: Electron + React scaffold — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `01-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 01-electron-react-scaffold
**Areas discussed:** Tailwind version + dark-neutral tokens (user-selected)
**Areas defaulted to Claude's discretion:** Electron toolchain & packaging, Drop → load IPC pattern, Debug dump shape

---

## Gray Area Selection

**Question:** Which gray areas do you want to discuss for Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Electron toolchain & packaging | electron-vite vs electron-forge+vite-plugin vs vite-plugin-electron+electron-builder; .dmg ownership | |
| Drop → load IPC pattern | preload.contextBridge typed API vs ipcMain.handle channels vs File System Access API; error serialization | |
| Debug dump shape | CLI-table replica in `<pre>` vs structured sections + peak table vs JSON pretty-print | |
| Tailwind version + dark-neutral tokens | v3 vs v4; palette choice; typography | ✓ |

**User's choice:** Tailwind version + dark-neutral tokens only.
**Notes:** User wanted to focus on the visual identity decision. The three unchosen areas go to Claude's discretion with canonical defaults locked in `01-CONTEXT.md` (electron-vite + electron-builder; contextBridge typed API; CLI-table replica + skeleton-summary header).

---

## Tailwind version + dark-neutral tokens

### Q1: Tailwind version for the renderer?

| Option | Description | Selected |
|--------|-------------|----------|
| Tailwind v4 (Recommended) | CSS-first `@theme` in index.css, no tailwind.config.js, no postcss.config. Stable since Jan 2025. | ✓ |
| Tailwind v3 | `tailwind.config.ts` + `postcss.config.cjs`. Battle-tested, every plugin works. | |

**User's choice:** Tailwind v4.
**Notes:** CSS-first `@theme` pairs cleanly with the "locked tokens" pattern — theme values live next to the styles that consume them.

---

### Q2: Dark-neutral palette direction? (first pass)

| Option | Description | Selected |
|--------|-------------|----------|
| Pure neutrals, monochrome | No accent. neutral-950 bg, neutral-900 panels, neutral-100 fg, drag-over = neutral-700 ring. | |
| Neutrals + one cool accent (Recommended) | Sky-400 or cyan-400 accent for drag-over, CTAs, focus, override badges. | |
| Neutrals + warm accent | Amber/orange accent. Warmer feel, less common in dev-tool UI. | |

**User's response:** Free-text — "The idea is to move away from the original design. As I am open sourcing this product, I want to differentiate it from the original. I want to keep the neutral, minimal dark design, though. Do you want me to provide the screenshots again?"
**Notes:** User was initially leaning toward differentiation from Spine's editor. This answer triggered a follow-up question re-framing the differentiator options.

---

### Q2b: Differentiator direction? (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Pure monochrome, zero accent | Terminal / Linear / Arc direction. Sharpest departure from Spine. | |
| Neutrals + cool accent (sky/cyan) | Clearly not Spine-orange. 'Clean computational tool' feel. | |
| Neutrals + signature accent (violet / lime) | Distinctive; recognizably 'our brand.' | |
| Neutrals + data-ink only | Accent reserved for data signals (peaks, overrides, warnings); chrome is pure neutral. | |

**User's response:** Free-text — "I misread what you said before. Nevermind. We must do something similar to spine editor yes!"
**Notes:** User reversed course — the intent is to stay close to Spine's editor aesthetic (warm-leaning darks + Spine-orange-like accent), not differentiate away from it. This flipped the palette question toward Spine-adjacent options.

---

### Q3: Neutral base temperature?

| Option | Description | Selected |
|--------|-------------|----------|
| Warm stone (Recommended) | Tailwind `stone` scale — warm-brown-gray, matches Spine's editor warmth. | ✓ |
| Cool neutral | Tailwind `neutral` scale — pure gray, no temperature. | |
| Cool zinc | Tailwind `zinc` scale — very slight cool tint. | |

**User's choice:** Warm stone.
**Notes:** Confirms the Spine-adjacent warmth direction.

---

### Q4: Accent color — how close to Spine orange?

| Option | Description | Selected |
|--------|-------------|----------|
| Spine-adjacent orange (Recommended) | Tailwind `orange-500` or `amber-500`. Clearly Spine-inspired without exact copy. | ✓ |
| Muted amber | `amber-400` at reduced saturation. Softer Spine-feel. | |
| Exact Spine orange | Custom hex (~#e9882b). Most faithful; slight 'copying' risk. | |

**User's choice:** Spine-adjacent orange.
**Notes:** Locked on stock Tailwind `orange-500` (#f97316) in `01-CONTEXT.md` D-14. Exact hex deferred — can be swapped later without refactoring if brand differentiation later requires it.

---

### Q5: Background depth — how many neutral layers?

| Option | Description | Selected |
|--------|-------------|----------|
| Two layers (Recommended) | stone-950 app + stone-900 panels + stone-800 borders. | ✓ |
| Three layers | Adds stone-850 cards inside panels. More depth for Phase 3 nested content. | |
| One layer | Everything stone-950, separation by borders + shadows. Flattest. | |

**User's choice:** Two layers.
**Notes:** Three-layer deferred; revisit if Phase 3 Animation Breakdown cards feel flat.

---

### Q6: Typography pair?

| Option | Description | Selected |
|--------|-------------|----------|
| System sans + system mono (Recommended) | Zero font load, native OS feel. | |
| Inter + JetBrains Mono | Curated web fonts. Adds ~50KB + FOUT risk. | |
| System sans + JetBrains Mono | Middle ground: system UI + loaded JetBrains Mono for tables/numbers. | ✓ |

**User's choice:** System sans + JetBrains Mono.
**Notes:** One font load, tight CLI-style tables. Justifies itself given Phase 2–3 add more tabular data.

---

### Q7: Where does the accent appear in Phase 1 specifically?

| Option | Description | Selected |
|--------|-------------|----------|
| Drag-over ring (Recommended) | Ring + subtle bg tint on drop zone when a valid file hovers. | ✓ |
| Focus ring (Recommended) | Focus-visible outline on interactive elements. Accessibility baseline. | ✓ |
| Loaded-file success indicator | Small accent dot/underline after successful load. | |
| Reserve accent — chrome only for now | Save richer accent use for later phases. | |

**User's choice (multi-select):** Drag-over ring + Focus ring.
**Notes:** Accent held minimal in Phase 1 chrome. Success indicator deferred — can be added freely in Phase 2+ when more UI state exists.

---

### Q8: Continue on tokens, or write CONTEXT.md?

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context (Recommended) | Lock discussion, write CONTEXT.md with canonical defaults for the three undiscussed areas. | ✓ |
| One more — specific CSS token names | Lock exact `@theme` token names (--color-surface, etc.). | |
| One more — accent hex override | Lock a custom hex instead of orange-500. | |

**User's choice:** Ready for context.
**Notes:** Canonical token names + stock Tailwind `orange-500` are locked in `01-CONTEXT.md` `<specifics>` block regardless of this answer — the "One more" options would only have *overridden* those with user-supplied specifics.

---

## Claude's Discretion (not discussed, canonical defaults locked in CONTEXT.md)

- **Electron toolchain — electron-vite** (ROADMAP names `electron.vite.config.ts` explicitly).
- **Packaging — electron-builder** for `.dmg` (unsigned for Phase 1).
- **IPC — `contextBridge.exposeInMainWorld('api', { loadSkeleton })`** typed via shared `src/preload/api.ts`.
- **IPC channel — `skeleton:load`** via `ipcMain.handle`.
- **Drop handling — `file.path` from HTML5 DragEvent** (Electron extension, canonical in Electron 30+).
- **Error serialization — discriminated union** `{ ok: false, error: { kind, message } }` preserving typed-error intent from Phase 0.
- **Debug dump — CLI-table replica as `<pre>`** + skeleton-summary header (bone/slot/attachment/skin/animation counts). Echoes to `console.log` too.
- **Renderer state — React `useState`** (single state machine: `idle | loading | loaded | error`).
- **Windows `.exe`, signing, notarization, auto-update — deferred.**

Any of the above can be overridden by editing `01-CONTEXT.md` before `/gsd-plan-phase 1` runs.

---

## Deferred Ideas

Captured in `01-CONTEXT.md` `<deferred>` section. Notable items: Windows `.exe` build, code signing, state library, settings modal, third depth layer, custom hex accent.

## SDK quirk (non-blocking)

`gsd-sdk query init.phase-op 1` and `gsd-sdk query roadmap.get-phase 1` both return `{ found: false }` because the SDK's phase-header regex requires a colon (`## Phase N: Name`) but `ROADMAP.md` uses em-dashes (`## Phase N — Name`). The workflow proceeded by reading `ROADMAP.md` directly. This will continue to fail every GSD command until either the ROADMAP is reformatted or the SDK is updated. Non-blocking for Phase 1.

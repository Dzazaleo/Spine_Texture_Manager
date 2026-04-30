# Phase 18: Cmd+Q + AppleScript quit broken on macOS — Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 4 (3 modify, 1 create)
**Analogs found:** 4 / 4 (all exact, all in-repo)

CONTEXT.md is unusually rich — it already names file paths, line ranges, and a canonical commit (`802a76e`, the Phase 14 lift) as the structural blueprint. This document converts those references into concrete code excerpts the planner can paste verbatim into PLAN.md `<read_first>` and `<action>` blocks.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/renderer/src/App.tsx` (MODIFY) | top-level renderer, IPC subscriber | event-driven (IPC pull → React state / ref deref) | self (existing menu/update lift useEffects in same file) + Phase 14 commit `802a76e` | exact — same file, same pattern, just a new channel |
| `src/renderer/src/components/AppShell.tsx` (MODIFY) | mid-tree component, ref-bridge registrar | event-driven (ref registration on mount, null on unmount) | `onBeforeDropRef` block at lines 1003–1027 in same file | exact — same file, identical ref-bridge shape |
| `tests/renderer/app-quit-subscription.spec.tsx` (CREATE) | test, renderer / vitest+jsdom | event-driven (synthetic IPC callback fire → assert) | `tests/renderer/app-update-subscriptions.spec.tsx` | exact — structural copy, channel substitution only |
| `tests/arch.spec.ts` (MODIFY) | test, arch-grep | batch (readFileSync → regex assert) | existing Layer-3 grep blocks already in this file | exact — new `describe`/`it` block in same file |

## Pattern Assignments

### `src/renderer/src/App.tsx` (MODIFY) — top-level lift target

**Analogs (all in same file):**
- Ref declaration shape: `appShellMenuRef` at lines 242–245
- Ref pass-through to AppShell: lines 472–473, 488–489
- Lifted-subscription useEffect: the menu-event useEffect at 277–306, AND the auto-update useEffect at 367–444
- The simpler shape (single channel, no sticky-slot recovery, no manual-check gate) most closely matches the menu-event useEffect

#### Ref declaration pattern (transplant target — alongside `appShellMenuRef`)

**Source — App.tsx:232–245:**
```typescript
  /**
   * Phase 08.2 D-175 — callback-ref bridge for menu-driven Save / Save As.
   * Parallel to beforeDropRef (Phase 8.1 D-163). AppShell registers
   * { onClickSave, onClickSaveAs } via a useEffect; menu-event subscriptions
   * below dereference at call time so the latest registered impl always wins.
   * When AppShell is unmounted (idle / error / projectLoadFailed), the ref
   * is null and menu Save / Save As clicks are silent no-ops — main also
   * disables those items in those states (D-181 / D-187), so the IPC
   * shouldn't fire; the optional-chain is defense-in-depth.
   */
  const appShellMenuRef = useRef<{
    onClickSave: () => Promise<SaveResponse>;
    onClickSaveAs: () => Promise<SaveResponse>;
  } | null>(null);
```

**Substitution table:**

| Replace | With |
|---------|------|
| `appShellMenuRef` | `dirtyCheckRef` (CONTEXT D-02 prefers this name; planner has discretion) |
| `{ onClickSave: () => Promise<SaveResponse>; onClickSaveAs: () => Promise<SaveResponse>; }` | `() => boolean` |
| Phase 08.2 D-175 reference | Phase 18 D-02 reference |
| "menu-driven Save / Save As" comment | "before-quit dirty-guard read-back" comment |

#### Lifted-subscription useEffect pattern (transplant — new useEffect after the menu one ends at line 306)

**Source — App.tsx:277–306 (the menu-event subscription, structural sibling for the new quit useEffect):**
```typescript
  useEffect(() => {
    const unsubOpen = window.api.onMenuOpen(async () => {
      const proceed = await handleBeforeDrop('', 'stmproj');
      if (!proceed) return;
      const resp = await window.api.openProject();
      handleProjectLoad(resp, '(menu)');
    });

    const unsubOpenRecent = window.api.onMenuOpenRecent(async (path: string) => {
      const proceed = await handleBeforeDrop(path, 'stmproj');
      if (!proceed) return;
      const resp = await window.api.openProjectFromPath(path);
      handleProjectLoad(resp, path.split(/[\\/]/).pop() ?? path);
    });

    const unsubSave = window.api.onMenuSave(() => {
      void appShellMenuRef.current?.onClickSave();
    });

    const unsubSaveAs = window.api.onMenuSaveAs(() => {
      void appShellMenuRef.current?.onClickSaveAs();
    });

    return () => {
      unsubOpen();
      unsubOpenRecent();
      unsubSave();
      unsubSaveAs();
    };
  }, [handleBeforeDrop, handleProjectLoad]);
```

**Source — AppShell.tsx:786–800 (the listener being lifted — paste this body INTO App.tsx, then delete it from AppShell):**
```typescript
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
```

**Transplanted shape (what the new App.tsx useEffect should look like):**
```typescript
  /**
   * Phase 18 D-01 + D-02 — before-quit dirty-guard subscription, LIFTED from
   * AppShell.tsx:786-800. App.tsx is the always-mounted root, so this fires
   * regardless of AppState (idle / loading / loaded / projectLoaded /
   * projectLoadFailed / error). Closes QUIT-01 + QUIT-02: pre-lift, the
   * subscription lived in AppShell which only mounted on `loaded` /
   * `projectLoaded` — Cmd+Q from the drop-zone (idle) silently no-op'd
   * because main's `before-quit` paused at preventDefault() with no listener
   * to receive `project:check-dirty-before-quit`.
   *
   * D-04 / D-05: when AppShell is NOT mounted (dirtyCheckRef.current === null
   * — idle / error / projectLoadFailed) OR is mounted but isDirty===false,
   * fire confirmQuitProceed() immediately. No SaveQuitDialog needed.
   *
   * D-03: when AppShell IS mounted AND dirty, defer to the existing
   * SaveQuitDialog flow. Phase 8 contract LOCKED — the SaveQuitDialog
   * mount lives in AppShell; we cannot `setSaveQuitDialogState` from here.
   * Solution: the ref returns `isDirty`; when true, AppShell's own listener
   * is gone (we deleted it), so we send the IPC back through a SECOND ref
   * OR (simpler — chosen here) we keep the dialog-mount logic up here and
   * pass it to AppShell via a different ref. CONTEXT D-02 chose: ref returns
   * isDirty only; App.tsx mounts SaveQuitDialog up here too.
   *
   * NOTE: Re-read CONTEXT D-03 / D-04 / D-05 carefully — the planner must
   * decide whether the SaveQuitDialog state slot ALSO lifts (cleanest, but
   * touches more code) or whether a SECOND ref hands the "show dialog" call
   * back down. CONTEXT decisions favor the lift; the canonical Phase 14
   * shape (commit 802a76e) lifted the entire dialog state slot.
   *
   * D-11: accepted pre-mount race. If the user presses Cmd+Q in the ~500ms
   * before this useEffect commits on first render, main stays paused at
   * preventDefault. Escalation = main-side ~2s timeout fallback (deferred).
   *
   * Pitfall 9 / 15 (RESEARCH §preload): cleanup MUST return the unsubscribe
   * closure; the wrapped const inside preload preserves listener identity
   * so removeListener targets the registered reference.
   */
  useEffect(() => {
    const unsub = window.api.onCheckDirtyBeforeQuit(() => {
      const dirtyFn = dirtyCheckRef.current;
      // AppShell unmounted (idle / error / projectLoadFailed) — no project,
      // no dirty state, fire through immediately.
      if (dirtyFn === null) {
        window.api.confirmQuitProceed();
        return;
      }
      // AppShell mounted + clean — same fast-path as D-04.
      if (!dirtyFn()) {
        window.api.confirmQuitProceed();
        return;
      }
      // AppShell mounted + dirty — Phase 8 SaveQuitDialog flow.
      // [planner: route through whichever mechanism CONTEXT D-03 lands on]
    });
    return unsub;
  }, []);
```

#### Ref pass-through pattern (transplant — at the AppShell mount sites)

**Source — App.tsx:469–490 (the two AppShell mount sites today):**
```typescript
      {state.status === 'loaded' && (
        <AppShell
          summary={state.summary}
          samplingHz={120}
          onBeforeDropRef={beforeDropRef}
          appShellMenuRef={appShellMenuRef}
        />
      )}
      {state.status === 'projectLoaded' && (
        <AppShell
          summary={state.summary}
          samplingHz={state.project.samplingHz}
          initialProject={state.project}
          onBeforeDropRef={beforeDropRef}
          appShellMenuRef={appShellMenuRef}
        />
      )}
```

**Substitution:** add `dirtyCheckRef={dirtyCheckRef}` as a sibling prop on BOTH AppShell mount sites (alongside `onBeforeDropRef` and `appShellMenuRef`).

#### Gotchas / invariants for App.tsx

1. **Cleanup MUST return the unsubscribe** (Pitfalls 9 + 15 from CONTEXT `<code_context>`). The preload wraps the handler in a const closure to preserve listener identity for removeListener. If you write `return () => unsub();` it works; if you forget the return entirely, every re-mount leaks a listener.
2. **Empty dep array is correct** for the new useEffect — `dirtyCheckRef.current` is dereferenced at IPC-fire time, not at effect-attach time, so the effect does NOT need to re-run when AppShell mounts/unmounts. This matches the Phase 14 update useEffect at line 444 (`}, []);`) and is the OPPOSITE of the AppShell-internal listener which closed over `isDirty` directly and needed `[isDirty]`.
3. **`useRef` import is already present** (line 21) — no import changes needed for the new ref declaration.
4. **No new types needed** — `(() => boolean) | null` is inline-typeable; no shared-types update.
5. **Placement preference** (CONTEXT "Claude's Discretion"): split into its OWN useEffect block, NOT folded into the menu useEffect at 277–306. Place after the menu useEffect, before or after the auto-update useEffect at 367.

---

### `src/renderer/src/components/AppShell.tsx` (MODIFY) — lift source + ref registrar

This file has TWO operations: (a) DELETE the existing listener block at 786–800, (b) ADD a small ref-registration useEffect mirroring `onBeforeDropRef` / `appShellMenuRef`.

#### Deletion target

**Source — AppShell.tsx:780–800 (delete the whole block, including the JSDoc):**
```typescript
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
```

After deletion the file MUST not contain the literal string `onCheckDirtyBeforeQuit` anywhere — the arch-grep below (D-08) locks this.

#### Prop signature pattern (transplant — alongside `appShellMenuRef` in AppShellProps)

**Source — AppShell.tsx:85–112 (the existing two prop refs — add a third):**
```typescript
  /**
   * Phase 8.1 D-163 — callback-ref bridge for the new-skeleton/new-project
   * dirty-guard. App.tsx holds the useRef and passes it down here. AppShell
   * registers an impl in a useEffect that mounts SaveQuitDialog when isDirty
   * is true and a new .json/.stmproj is dropped. ...
   */
  onBeforeDropRef?: MutableRefObject<
    ((fileName: string, kind: 'json' | 'stmproj') => Promise<boolean>) | null
  >;
  /**
   * Phase 08.2 D-175 — callback-ref bridge for menu-driven Save / Save As.
   * App.tsx holds the useRef; AppShell registers `{ onClickSave, onClickSaveAs }`
   * into ref.current via a useEffect. ...
   *
   * Parallel to onBeforeDropRef (Phase 8.1 D-163) — same shape, same
   * registration discipline.
   */
  appShellMenuRef?: MutableRefObject<{
    onClickSave: () => Promise<SaveResponse>;
    onClickSaveAs: () => Promise<SaveResponse>;
  } | null>;
}
```

**Substitution: add a new optional prop:**
```typescript
  /**
   * Phase 18 D-02 — callback-ref bridge for the before-quit dirty-guard.
   * App.tsx holds the useRef; AppShell registers `() => isDirty` into
   * ref.current via a useEffect. App.tsx's onCheckDirtyBeforeQuit listener
   * dereferences at IPC-fire time, so the latest registered impl always wins.
   * When AppShell is unmounted (idle / error / projectLoadFailed) the ref is
   * null and App.tsx's listener treats that as "no dirty state — fire
   * confirmQuitProceed immediately" (D-04).
   *
   * Parallel to onBeforeDropRef (Phase 8.1 D-163) and appShellMenuRef
   * (Phase 08.2 D-175) — same shape, same registration discipline.
   */
  dirtyCheckRef?: MutableRefObject<(() => boolean) | null>;
```

Then add `dirtyCheckRef` to the destructured props at lines 114–120 (parallel to `onBeforeDropRef`, `appShellMenuRef`).

#### Ref-registration useEffect pattern (transplant — near isDirty memo at 580–590)

**Source — AppShell.tsx:1003–1027 (the onBeforeDropRef registration — closest analog):**
```typescript
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
        // ...
      });
    return () => {
      onBeforeDropRef.current = null;
    };
  }, [isDirty, onBeforeDropRef]);
```

**Source — AppShell.tsx:1038–1044 (the appShellMenuRef registration — minimal-shape analog):**
```typescript
  useEffect(() => {
    if (!appShellMenuRef) return;
    appShellMenuRef.current = { onClickSave, onClickSaveAs };
    return () => {
      appShellMenuRef.current = null;
    };
  }, [onClickSave, onClickSaveAs, appShellMenuRef]);
```

**Transplanted shape for `dirtyCheckRef`:**
```typescript
  /**
   * Phase 18 D-02 — register a `() => isDirty` reader into App.tsx's
   * dirtyCheckRef so the lifted onCheckDirtyBeforeQuit listener can
   * read the current dirty signal without owning AppShell's state.
   *
   * Closure freshness: the dep array includes `isDirty`, so each isDirty
   * change re-binds the closure with the latest captured value. Cleanup
   * nulls the ref so when AppShell unmounts (transition out of `loaded` /
   * `projectLoaded`), App.tsx's listener sees `null` and treats it as
   * "no project loaded — fire confirmQuitProceed immediately" (D-04).
   *
   * Parallel to onBeforeDropRef (Phase 8.1 D-163) and appShellMenuRef
   * (Phase 08.2 D-175) — same shape, same registration discipline.
   */
  useEffect(() => {
    if (!dirtyCheckRef) return;
    dirtyCheckRef.current = () => isDirty;
    return () => {
      dirtyCheckRef.current = null;
    };
  }, [isDirty, dirtyCheckRef]);
```

**Placement (CONTEXT integration-points):** "near the existing `isDirty` memo at AppShell.tsx:580–590". The `isDirty` `useMemo` STAYS — only the IPC subscription lifts; the new effect is the new minimal consumer in AppShell.

#### Gotchas / invariants for AppShell.tsx

1. **`[isDirty]` in deps is mandatory** — without it, the closure freezes the FIRST `isDirty` value forever. CONTEXT explicitly calls this out: `useEffect(() => { dirtyCheckRef.current = () => isDirty; ... }, [isDirty]);`.
2. **`if (!dirtyCheckRef) return;` early-exit** matches the pattern used by `onBeforeDropRef` and `appShellMenuRef` — the ref is OPTIONAL on the props (test renders that don't pass it must not crash).
3. **Cleanup-null is mandatory** — without it, a stale impl from a prior mount could be deref'd by App.tsx's listener after AppShell unmounted (would resurrect the old isDirty value). The `current = null` is the unmount signal that App.tsx's listener interprets as "no project loaded" (D-04).
4. **Do NOT touch `isDirty` itself** — it's the load-bearing Phase 8 dirty-guard memo and is consumed by other useEffects in this file (`onBeforeDropRef` registration at 1003, modal-state push at 839, the `useEffect` we are deleting). Only the consumer-listener at 786–800 lifts.
5. **`MutableRefObject` import already present** at line 39 — no import changes.

---

### `tests/renderer/app-quit-subscription.spec.tsx` (CREATE) — structural copy of the Phase 14 spec

#### Analog (read end-to-end before drafting)

**Source — `tests/renderer/app-update-subscriptions.spec.tsx` (entire file, 213 lines).** Key structural elements:

**Header / imports / boilerplate (lines 1–29):**
```typescript
// @vitest-environment jsdom
/**
 * Phase 14 Plan 04 — App.tsx update-subscription lift specs (UPDFIX-02 / 03 / 04).
 *
 * Asserts the lifted update-channel subscriptions live in App.tsx (not AppShell)
 * and run on every AppState branch — including 'idle' (no project loaded).
 * ...
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/renderer/src/App';

afterEach(cleanup);

describe('Phase 14 — App.tsx update-subscription lift', () => {
```

**Callback-capture pattern (lines 32–45):**
```typescript
  // Capture callbacks so tests can fire events synthetically.
  let updateAvailableCb:
    | ((payload: {
        version: string;
        // ...
      }) => void)
    | null = null;
  let menuCheckCb: (() => void) | null = null;
```

**Window.api stub idiom (lines 53–112) — the LOAD-BEARING pattern:**
```typescript
  beforeEach(() => {
    updateAvailableCb = null;
    // ...

    // Stamp the FULL window.api surface required to mount App.tsx without
    // crashing. App.tsx mounts subscribers for the menu channels too
    // (notifyMenuState / onMenuOpen / onMenuOpenRecent / onMenuSave /
    // onMenuSaveAs), so missing any method throws on the first useEffect
    // commit. Mirrors save-load.spec.tsx's full-surface idiom.
    Object.defineProperty(window, 'api', {
      writable: true,
      configurable: true,
      value: {
        // Menu surface (Phase 8.2 D-175 / D-181).
        notifyMenuState: vi.fn(),
        onMenuOpen: vi.fn(() => () => undefined),
        onMenuOpenRecent: vi.fn(() => () => undefined),
        onMenuSave: vi.fn(() => () => undefined),
        onMenuSaveAs: vi.fn(() => () => undefined),
        // Phase 14 lifted update subscriptions — capture callbacks.
        onUpdateAvailable: vi.fn((cb) => {
          updateAvailableCb = cb;
          return () => undefined;
        }),
        // ... etc for each of the 5 lifted update channels
        checkForUpdates: checkForUpdatesMock,
        requestPendingUpdate: requestPendingUpdateMock,
        // ...
      },
    });
  });
```

**Synthetic event-fire idiom (lines 140–159):**
```typescript
  it('(14-k) UpdateDialog mounts on update:available event regardless of AppState (idle)', () => {
    render(<App />);
    expect(updateAvailableCb).not.toBeNull();
    // Synthetic IPC callback fires setUpdateState — wrap in act() so React 19
    // flushes the state update before the assertion. testing-library's
    // fireEvent does this automatically; the captured callback path needs
    // explicit act() since it bypasses the DOM event system.
    act(() => {
      updateAvailableCb!({
        version: '1.1.2',
        // ...
      });
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/1\.1\.2/)).toBeTruthy();
  });
```

**Mock-call assertion idiom (lines 161–170):**
```typescript
  it('(14-l) Help → Check for Updates from idle calls window.api.checkForUpdates()', () => {
    render(<App />);
    expect(menuCheckCb).not.toBeNull();
    act(() => {
      menuCheckCb!();
    });
    expect(checkForUpdatesMock).toHaveBeenCalledTimes(1);
  });
```

#### Substitution table

| Phase 14 (analog) | Phase 18 (new spec) |
|-------------------|---------------------|
| `Phase 14 — App.tsx update-subscription lift` | `Phase 18 — App.tsx before-quit dirty-guard lift` |
| `(14-i)` / `(14-j)` / ... | `(18-a)` / `(18-b)` / `(18-c)` / `(18-d)` |
| `updateAvailableCb` | `checkDirtyBeforeQuitCb` |
| `onUpdateAvailable: vi.fn((cb) => { ... })` | `onCheckDirtyBeforeQuit: vi.fn((cb) => { ... })` |
| `checkForUpdatesMock` | `confirmQuitProceedMock` |
| `requestPendingUpdate`, `dismissUpdate`, `downloadUpdate`, `quitAndInstallUpdate`, `openExternalUrl` | (still needed in stub — App.tsx's auto-update useEffect runs unconditionally; missing them throws on mount) |
| Update channels (`onUpdateAvailable`, `onUpdateDownloaded`, `onUpdateNone`, `onUpdateError`, `onMenuCheckForUpdates`) | (still needed in stub — App.tsx subscribes to all 5 on mount; assertion targets are different but stub surface is identical) |

#### Required four assertions (per CONTEXT D-07)

1. **(18-a)** App.tsx mounted in idle registers `onCheckDirtyBeforeQuit` exactly once.
2. **(18-b)** Firing `checkDirtyBeforeQuitCb!()` while idle → `confirmQuitProceedMock` called once; `screen.queryByRole('dialog')` returns null (SaveQuitDialog NOT mounted).
3. **(18-c)** Firing `checkDirtyBeforeQuitCb!()` after the AppShell mount path is exercised AND `isDirty===true` → SaveQuitDialog DOES mount; `confirmQuitProceedMock` NOT called yet.
4. **(18-d)** Cancel from SaveQuitDialog → `confirmQuitProceedMock` still NOT called (cancel-quit semantic = main stays paused at preventDefault).

#### Gotchas / invariants for the new spec

1. **Stub the FULL window.api surface.** App.tsx subscribes to `onMenuOpen`/`onMenuOpenRecent`/`onMenuSave`/`onMenuSaveAs` AND all 5 update channels on mount. Any missing method → `TypeError: window.api.onXxx is not a function` on the first useEffect commit, before your test even reaches its assertion.
2. **Each `onXxx` mock MUST return an unsubscribe function.** The pattern `vi.fn(() => () => undefined)` for the simple ones, and `vi.fn((cb) => { capturedCb = cb; return () => undefined; })` for the ones whose callbacks you need to fire. App.tsx's cleanup destructures the return value and CALLS it; if any of them returns `undefined` the test crashes on cleanup.
3. **Wrap synthetic-callback fires in `act(() => { ... })`.** The captured callback path bypasses the DOM event system, so React 19 won't auto-flush the state update. Without `act()` you get warnings + flaky assertions.
4. **Tests 18-c / 18-d need a project loaded.** Idle state has no AppShell mount → no `dirtyCheckRef` registration → ref is null forever. To reach SaveQuitDialog, the test must either (a) drive App into `loaded`/`projectLoaded` via the same drop pattern other specs use, or (b) accept that 18-c and 18-d may need a different scaffold than the analog provides. Re-read `tests/renderer/save-load.spec.tsx` (referenced in the analog header comment line 17) — it stamps a fuller surface for the loaded path.
5. **`@vitest-environment jsdom` directive on line 1** is mandatory — without it `render()` from testing-library throws.
6. **`afterEach(cleanup);`** between describe blocks if you split — without cleanup, mounted dialogs from one test leak into the next.

---

### `tests/arch.spec.ts` (MODIFY) — Layer-3 grep block extension

#### Analog blocks (already in the file)

**Source — tests/arch.spec.ts:154–172 (the closest single-file grep block):**
```typescript
describe('Phase 8 Layer 3: src/core/project-file.ts must not import electron (T-08-LAYER)', () => {
  it('src/core/project-file.ts does not import from electron', () => {
    // Specifically guards the new project-file module — the existing core grep
    // (lines ~116-134) covers fs/sharp; this block adds electron coverage and
    // names the file explicitly so future Phase-8 hygiene drift is caught even
    // if the existing globSync rule changes.
    const filePath = 'src/core/project-file.ts';
    let text = '';
    try {
      text = readFileSync(filePath, 'utf8');
    } catch {
      // File doesn't exist yet (Plan 02 lands it). When it lands the grep applies.
      return;
    }
    expect(text, `${filePath} must not import from electron`).not.toMatch(/from ['"]electron['"]/);
    expect(text, `${filePath} must not import from node:fs`).not.toMatch(/from ['"]node:fs(\/promises)?['"]/);
    expect(text, `${filePath} must not import from sharp`).not.toMatch(/from ['"]sharp['"]/);
  });
});
```

**Source — tests/arch.spec.ts:182–205 (the named-anchor block — same shape, file must exist post-phase):**
```typescript
describe('Phase 9 Layer 3: src/main/sampler-worker.ts must not import DOM/renderer surfaces', () => {
  it('does not import from src/renderer/, react, electron, or DOM globals', () => {
    const filePath = 'src/main/sampler-worker.ts';
    let text = '';
    try {
      text = readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    expect(text, `${filePath} must not import from src/renderer/`).not.toMatch(
      /from ['"][^'"]*\/renderer\//,
    );
    // ... etc
  });
});
```

#### Transplanted shape for the new D-08 grep block

```typescript
// Phase 18 — Layer 3 named anchor for the lifted before-quit dirty-guard.
// CONTEXT D-08: AppShell.tsx must NOT contain `onCheckDirtyBeforeQuit` after
// the lift. Phase 18 moves that subscription up to App.tsx (always-mounted
// root) so Cmd+Q from any AppState routes through a live listener; this
// grep locks the lift architecturally so a future re-regression breaks
// the build, not just runtime.
describe('Phase 18 Layer 3: src/renderer/src/components/AppShell.tsx must not subscribe to onCheckDirtyBeforeQuit', () => {
  it('AppShell.tsx does not contain the literal "onCheckDirtyBeforeQuit"', () => {
    const filePath = 'src/renderer/src/components/AppShell.tsx';
    const text = readFileSync(filePath, 'utf8');
    expect(
      text,
      `${filePath} must NOT subscribe to onCheckDirtyBeforeQuit — that listener was lifted to App.tsx in Phase 18 (CONTEXT D-01 / D-02). Re-introducing it here would re-break QUIT-01 / QUIT-02 (Cmd+Q no-op when no project loaded).`,
    ).not.toMatch(/onCheckDirtyBeforeQuit/);
  });
});
```

#### Substitution table

| Analog | New Phase 18 block |
|--------|---------------------|
| `Phase 8 Layer 3` / `Phase 9 Layer 3` describe label | `Phase 18 Layer 3` |
| `src/core/project-file.ts` / `src/main/sampler-worker.ts` | `src/renderer/src/components/AppShell.tsx` |
| `from ['"]electron['"]` regex | `/onCheckDirtyBeforeQuit/` regex |
| try/catch ENOENT tolerance | NOT needed — AppShell.tsx already exists |

#### Gotchas / invariants for the arch-test extension

1. **No try/catch needed.** `AppShell.tsx` already exists; an ENOENT swallow would let a renamed/deleted file silently pass. The Phase 9 / Phase 8 analogs use try/catch because their target files were not yet landed at block-write time.
2. **Match must be a literal string, not a structural pattern.** `/onCheckDirtyBeforeQuit/` (no anchors, no flags) is the simplest correct match. Stricter regexes risk false negatives if e.g. the channel name appears in a comment but the code is gone.
3. **Place the new describe block at the END of the file** (line 206+) — keeps phase-ordering chronological with the existing Phase 8 / Phase 9 blocks above.
4. **Do not break existing blocks.** Add ONLY a new `describe`; do not modify the existing `globSync` boundary block at lines 19–34 (that's the Layer-3 universal grep — adding a sub-rule to it would couple the new check to the core/renderer boundary check, which is wrong).

---

## Shared Patterns

### Ref-bridge across App / AppShell boundary

**Sources:**
- Declaration in App.tsx: `appShellMenuRef` lines 242–245, `beforeDropRef` lines 221–223
- Pass-through in App.tsx: lines 472–473, 488–489
- Prop declaration in AppShell.tsx: `onBeforeDropRef` lines 95–97, `appShellMenuRef` lines 108–111
- Registration in AppShell.tsx: `onBeforeDropRef` lines 1003–1027, `appShellMenuRef` lines 1038–1044

**Apply to:** the new `dirtyCheckRef` in App.tsx + AppShell.tsx (both files).

**Five-step contract:**
1. App.tsx declares `useRef<T | null>(null)`.
2. App.tsx passes `dirtyCheckRef={dirtyCheckRef}` to BOTH `<AppShell>` mount sites (`loaded` and `projectLoaded` branches).
3. AppShell prop signature accepts `dirtyCheckRef?: MutableRefObject<T | null>`.
4. AppShell registers `dirtyCheckRef.current = impl` in a `useEffect(...,[deps, dirtyCheckRef])` with cleanup `dirtyCheckRef.current = null`.
5. App.tsx's lifted listener dereferences `dirtyCheckRef.current` at IPC-fire time, treating `null` as "AppShell not mounted, fall back to default".

### Pitfall 9 / 15 cleanup discipline

**Sources:** `src/preload/index.ts` (the wrapped-const closure that preserves listener identity); App.tsx:300–305 (cleanup pattern); App.tsx:437–443 (cleanup pattern); AppShell.tsx:1024–1026 (ref-null cleanup pattern).

**Apply to:** the new App.tsx useEffect AND the new AppShell.tsx ref-registration useEffect. Both MUST return their cleanup function (unsubscribe / null-out).

**Failure mode if violated:** every re-mount of the component leaves a dangling listener. After N mounts, N callbacks fire on every IPC message — symptom is double-fire (Phase 8 / 14 pre-fix bug class).

### `act()` wrapping for synthetic callback fires in tests

**Source:** `tests/renderer/app-update-subscriptions.spec.tsx` lines 147, 167, 175, 180, 192.

**Apply to:** every `checkDirtyBeforeQuitCb!()` invocation in the new spec. The IPC-callback path bypasses the DOM event system, so React 19 won't auto-flush state updates without explicit `act()`.

---

## No Analog Found

None. All four files have exact-match analogs in the existing codebase. CONTEXT.md correctly identified the canonical Phase 14 lift commit (`802a76e`) as the structural blueprint, and every shape needed for Phase 18 is already proven in-tree.

---

## Metadata

**Analog search scope:**
- `src/renderer/src/App.tsx` (full)
- `src/renderer/src/components/AppShell.tsx` (props 85–112, destructure 114–120, isDirty 580–590, lifted listener 786–800, ref registrations 1003–1044)
- `tests/renderer/app-update-subscriptions.spec.tsx` (full)
- `tests/arch.spec.ts` (full)
- `src/preload/index.ts` (channel verification only — `onCheckDirtyBeforeQuit` 220, `confirmQuitProceed` 237)

**Files scanned:** 5 source files, all read end-to-end or with non-overlapping targeted ranges.

**Pattern extraction date:** 2026-04-30

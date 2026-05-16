/**
 * Phase 42 RT-03 -- compile-NEGATIVE fixture (NOT a runtime test).
 *
 * The locked RT-03 constraint says a 4.2 runtime object reaching a 4.3
 * boundary -- or ANY cross-kind / cross-runtime handle mix -- must be a
 * COMPILE-TIME error (the `unique symbol` brand + required `__rt` tag is the
 * primary wall; stronger than any runtime guard or arch grep). This file
 * PROVES that wall is real, not aspirational:
 *
 *   - Each `// @ts-expect-error` line below MUST be consumed by a genuine
 *     `tsc` diagnostic. If the brand ever became accidentally permissive,
 *     the directive would be UNUSED, and TypeScript reports an unused
 *     `@ts-expect-error` as an error of its own -- so `npm run typecheck:node`
 *     (tsconfig.node.json `include` globs `tests` ts files) FAILS LOUDLY.
 *     The fixture is therefore self-proving under the existing typecheck
 *     script -- no extra runner, no false-green possible.
 *   - The POSITIVE section (no directive) proves correctly-branded usage
 *     still compiles, so the wall blocks ONLY the wrong mixes.
 *
 * This file is intentionally NEVER imported by production code or executed by
 * vitest. It exists solely to be type-checked by `tsc -p tsconfig.node.json`.
 * ASCII-only by design: tsc 6.x desyncs its parser on stray multibyte glyphs
 * in this position, so every character here is plain ASCII.
 */
import {
  brandHandle,
  unwrapHandle,
  handleRuntime,
  type OpaqueSkeleton,
  type OpaqueSlot,
  type RuntimeTag,
} from '../../src/core/runtime/types.js';

// A boundary function that ONLY accepts a 4.x Skeleton handle.
declare function consumeSkeleton(sk: OpaqueSkeleton): void;
declare function consumeSlot(slot: OpaqueSlot): void;

// Construct two distinctly-branded handles via the single sanctioned cast.
// (Runtime values are irrelevant here; this file is type-checked, never run.)
const sk42: OpaqueSkeleton = brandHandle<OpaqueSkeleton>({}, '4.2');
const slot43: OpaqueSlot = brandHandle<OpaqueSlot>({}, '4.3');

// ---------------------------------------------------------------------------
// NEGATIVE: every line below MUST fail tsc (the directive consumes the error)
// ---------------------------------------------------------------------------

// Cross-KIND: a Slot handle is NOT assignable to a Skeleton parameter. The
// per-kind unique-symbol brand makes OpaqueSlot distinct from OpaqueSkeleton.
// @ts-expect-error -- OpaqueSlot is not assignable to OpaqueSkeleton (per-kind brand wall)
consumeSkeleton(slot43);

// Cross-KIND the other direction (symmetry).
// @ts-expect-error -- OpaqueSkeleton is not assignable to OpaqueSlot (per-kind brand wall)
consumeSlot(sk42);

// A raw, unbranded plain object -- a stand-in for a raw spine-core Skeleton
// from EITHER runtime -- is not assignable to any Opaque (missing __brand/__rt).
// @ts-expect-error -- a raw object lacks the unique-symbol __brand + required __rt (the dual-type-universe wall)
consumeSkeleton({});

// An object that HAS __rt but lacks the unique-symbol __brand is still
// rejected (proves __rt alone cannot forge a handle; the brand is independent).
// @ts-expect-error -- __rt present but no unique-symbol __brand, still not an OpaqueSkeleton
consumeSkeleton({ __rt: '4.2' as RuntimeTag });

// ---------------------------------------------------------------------------
// POSITIVE: correctly-branded usage compiles with NO directive (the wall
// blocks only the wrong mixes; it does not break valid threading).
// ---------------------------------------------------------------------------
consumeSkeleton(sk42); // right kind, OK
consumeSlot(slot43); // right kind, OK
const rt: RuntimeTag = handleRuntime(sk42); // tag is readable (asserted, not inferred)
const raw: { foo: number } = unwrapHandle<{ foo: number }>(slot43); // sanctioned unwrap

// Reference the positive bindings so they are not "declared but never read"
// (TS6133 under strict), keeping the fixture's only diagnostics the intended
// consumed @ts-expect-error ones.
export const __fixtureProbe = { rt, raw, sk42, slot43 };

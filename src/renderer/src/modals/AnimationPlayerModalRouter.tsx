/**
 * DV-1 / DV-1a (Phase 47 gap) — the Animation Viewer dual-runtime dispatcher.
 *
 * The single-runtime spine-player@4.3.0 viewer (47-01, 6b3c57e) categorically
 * cannot parse ANY Spine 4.2 constraint-bearing project (4.3's unified
 * `root.constraints[]` vs 4.2's separate `root.ik/transform/path/physics`).
 * This thin router mirrors the core's `pickRuntime` split: it branches SOLELY
 * on the loader-resolved `props.summary.runtimeTag` (the explicit identity
 * threaded from `load.runtime.tag` via `src/main/summary.ts`), routing:
 *
 *   - '4.2' → AnimationPlayerModal42 (the frozen, byte-verbatim v1.5.1 modal
 *     wired to the alias-isolated spine-player@4.2.111 stack)
 *   - '4.3' → AnimationPlayerModal     (the 47-01 migrated spine-player@4.3.0
 *     modal, byte-untouched)
 *
 * It MUST NOT parse JSON, read `skeleton.spine`, call `resolveRuntime`, or
 * otherwise re-detect the version — it consumes ONLY the already-resolved
 * `summary.runtimeTag` (DV-1a; locks feedback_explicit_identity_over_inference,
 * same bug-class as REG-47-01's cross-runtime handoff).
 */
import { AnimationPlayerModal } from './AnimationPlayerModal'; // 4.3 leg (47-01 6b3c57e — byte-untouched)
import { AnimationPlayerModal42 } from './AnimationPlayerModal42'; // 4.2 leg (frozen v1.5.1, 9f967d2)
import type { SkeletonSummary } from '../../../shared/types';

export interface AnimationPlayerModalRouterProps {
  open: boolean;
  summary: SkeletonSummary;
  loaderMode: 'auto' | 'atlas-less';
  onClose: () => void;
}

export function AnimationPlayerModalRouter(
  props: AnimationPlayerModalRouterProps,
) {
  if (props.summary.runtimeTag === '4.2') {
    return <AnimationPlayerModal42 {...props} />;
  }
  // '4.3' — the only other RuntimeTag value (SkeletonSummary.runtimeTag is the
  // required '4.2' | '4.3' union; the loader's resolveRuntimeTag is the single
  // source of truth — no re-detection here).
  return <AnimationPlayerModal {...props} />;
}

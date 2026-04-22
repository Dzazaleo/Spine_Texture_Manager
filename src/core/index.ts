// Bootstrap placeholder for the pure-TypeScript core module.
//
// Phase 0 plan 00-02 will replace this file with real exports:
//   - loader.ts  (SkeletonJson + stub TextureLoader)
//   - sampler.ts (per-(skin, animation) sampler loop)
//   - bounds.ts  (per-attachment world-space AABB)
//
// This file exists solely so `tsc --noEmit` on the empty bootstrap scaffold
// has at least one input file matching the `include` glob, avoiding
// TS18003 ("No inputs were found in config file").
export {};

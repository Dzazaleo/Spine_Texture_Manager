# Changelog

In-repo release history for Spine Texture Manager. Newest on top.
Per-release downloads + first-launch notes are on
[GitHub Releases](https://github.com/Dzazaleo/Spine_Texture_Manager/releases).

## v1.6 — Spine 4.3 Runtime Port (Dual-Runtime)

- **Spine 4.3 skeleton support (dual-runtime).** The app now loads and
  correctly samples Spine 4.3 skeleton JSON in addition to Spine 4.2,
  routed by the detected skeleton version. A 4.3 file is no longer
  rejected with "re-export as Version 4.2" — it is first-class
  supported.
- Spine 4.2 behavior is byte-frozen (regression-gated); 4.3 sampling
  correctness is independently proven by a same-rig cross-runtime
  equivalence oracle.
- Unsupported versions still fail loudly with a typed error: Spine 4.1
  and earlier, and Spine 4.4 and later, are hard-rejected at load time.

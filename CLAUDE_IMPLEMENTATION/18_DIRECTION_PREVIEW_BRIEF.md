# Task 4 — down-facing movement preview
Jason renewed the hourly collaboration on 3 October 2026 at 23:27 Sydney. The morning cutoff is superseded. This task is preview-only and final art approval remains open.

## Starting point
Right-facing 48-phase walking and 20-frame start candidate are committed; stop/idle are reused unchanged. Keep motion baseline e6a99e4, 44 world-px height, ground-origin pivot, 22 world-px full cycle, steady speed 38 world px/s and calibrated top-down oblique projection. No model cleanup or gait redesign in this task.

The newest main handoff at reopening still points to 5e1eb1d and report 17; Codex has not found a newer main report. If you have subsequent local/branch work, preserve it and report its commit before duplicating or overwriting it.

## Bounded implementation
1. First establish one down-facing camera/projection from the same rig and show calibration markers: equal ground-axis world scales, vertical height straight up and same rig-ground pivot. Keep upper-left map lighting fixed relative to the world rather than attached to the camera. Do not mirror the soldier or move the rifle from its anatomical left shoulder.
2. Render the existing 48 loop phases, existing start, stop and idle in that down direction to a new folder. Reuse the accepted continuous motion; changing the view must not change leg phase, stride, proportions or root travel. Preserve the right-facing comparator.
3. In an isolated preview, move the soldier south on a real routed path using the same game movement/routing code and start root-travel curve. Pick nearest walking phase by distance. Add no production manifest/cache entries. No turning animation yet: each panel stays in one direction, so this task isolates projection and leg readability.
4. Commit a 25–30 second down-facing idle/start/walk/stop/idle clip at game size and max zoom, plus sharp contact sheets and foot-position overlays. Include a right-facing control, clearly labelled as separately oriented routes. Record actual redraw fps, phase count, frame bytes and contact-boundary data.
5. Measure planted contacts in BOTH screen axes after calibrated projection, including heel-off. State renderer quantization separately from continuous deformed contact. Verify alternating anatomical legs, boot clearance, rifle shoulder and no new torso/harness deformation. No evidence-free visual pass.
6. Run local asset validation, world and routine suites; confirm normal game files and walkReleaseGate unchanged. Write the report and return CODEX_REVIEW with implementation SHA and committed evidence paths.

Acceptance for review: identical soldier/phase across the two views, calibrated scale/pivot, preserved contact, readable alternating legs and complete committed evidence. This is permission for a directional candidate, not production approval. Up/left directions, turn transitions, style cleanup and integration are outside this task.

Claude must claim CLAUDE_RUNNING and push before edits. The local watcher, if active, can pick up this handoff; Codex does not launch Claude or Blender.

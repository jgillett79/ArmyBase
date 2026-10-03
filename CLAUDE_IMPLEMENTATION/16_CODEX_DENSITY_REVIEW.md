# Codex review — phase density and task 3
3 October 2026. Reviewed ca8cea0b654e7a7f2d81a35dfbd484757089517e.

## Verdict
Use 48 phases with nearest selection as the working isolated preview baseline. Keep the 24-phase comparator. This is a measured improvement, not a production release or final approval of appearance.

I inspected the actual committed density WebM by extracting a game-size/max-zoom frame, and inspected the adjacent-phase boot strip at 1.6 zoom. The strip supports smaller stance jumps in the 48 row; both normal-size panels look closely similar in the extracted frame. These are frame inspections, not a full real-time smoothness judgement. The capture averages 47.7 redraws/s: at 38 px/s, the 48-phase cycle requests about 83 sprite phases/s, so the clip skips some exported poses. Do not claim every phase was visibly shown or that doubling frames makes a 48-fps movie.

## Independent checks
- All 48 committed walking PNGs have distinct SHA-256 hashes.
- Source samples the same continuous motion functions at twice the density, not interpolated keys or duplicated images. Default remains 24; stop timing retains its original phase basis.
- Re-ran the committed density measuring tool on both committed motion reports and deformed-contact inspections: flat creep 0.918/0.919 to 0.460/0.460 world px; toe-edge creep 0.915 to 0.459; RMS phase error 0.2646 to 0.1323. Both-leg contact exclusions halve. This independently reproduces the analysis of recorded geometry; I did not re-run Blender locally.
- World and routine suites passed again. Claude reports asset validation passed. My environment still lacks the browser needed to independently execute that pixel check.
- Diff contains Blender/preview tools, review documents and evidence only. No normal game, manifest, cache or release-gate changes.

Open limits: contact-boundary exclusions remain; 1D measurements are not a directional-turn test; the model remains narrow, and the dark boot/outline is still a style candidate. Twice the walk PNG payload (about 1.43 MB for this direction) is a preview cost, not a production packaging decision.

## Task 3 — right-facing idle-to-walk start, preview only
Address the known abrupt start before multiplying directions. One bounded start transition only. Preserve the accepted loop and stop, calibrated projection, standing height, model proportions, lighting and working outline/marker. Keep normal game and art gate untouched.

1. Create a NEW start study/output folder. Start from the already-reviewed idle pose with both soles grounded. Establish one support foot, initiate the other leg naturally, and arrive at a precisely identified phase of the existing 48-phase loop. Do not simply show a mid-stride frame at rest or crossfade two sprite pictures.
2. Use an explicit root-travel curve for the start (roughly 0.3–0.5 seconds, choose from measured contacts), beginning at zero velocity and ending at 38 world px/s. Record root distance, velocity, pose time, support leg and deformed contacts. Use that actual travel during the preview start; accumulate loop phase from distance from the matching handover phase thereafter. Keep steady speed 38 and steady stride 22 unchanged.
3. Keep the support contact planted relative to the moving ground, verify swing clearance and check there is no boot teleport, ground penetration, torso/harness distortion or endpoint correction. Match position and velocity at start-to-loop handover. Use newly authored start poses without changing the existing loop/stop key poses or default builds.
4. First do a sparse pose/contact check. If it fails, fix only this start or return the precise blocker; do not redesign the body, gait or renderer. Then render only the required right-facing start frames, sharing existing walk/stop/idle frames.
5. Provide a 20–30 s real-speed repeated idle → start → walk → reviewed stop → idle clip at game size and max zoom. Compare old abrupt start against the candidate. Include sharp transition strips, root velocity/distance and foot-contact statistics, boundary frame deltas, capture fps/redraw count and frame bytes. Label reused stop art and avoid suggesting its 24-phase density changed.
6. Validate assets locally, run world/routine checks and confirm production files/gates untouched. Commit report/evidence and return CODEX_REVIEW with implementation SHA and paths.

No additional directions, model cleanup, larger accent geometry, route changes, production rollout or purchases in this task. Preserve the motion baseline tag. Start no further pass after noon Sydney; if this render is incomplete, report completed/remaining frames, last successful step and whether a render is still running. Do not hide missing visual evidence behind numerical passes.

Acceptance for review: an actual contact-preserving start from the existing idle; no positional or obvious pose pop at either boundary; speed joins the original walk continuously; complete comparison evidence. Final visual approval remains open.

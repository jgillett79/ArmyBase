# Blender walk preview — right-facing idle-to-walk start (task 3)

Claude, 3 October 2026, for task 3 in [16_CODEX_DENSITY_REVIEW.md](16_CODEX_DENSITY_REVIEW.md). Preview only, right-facing only. Loop (48 phases, e6a99e4 motion), reviewed stop and idle, calibration (e1752d3), 44 px height, 22 px stride, 38 px/s, look (warm + contrast + outline + marker) — all unchanged. No `js/`, `index.html`, `css/`, `assets/`, manifest or cache change; `walkReleaseGate()` unchanged; tag `blender-walk-motion-baseline` intact.

## How the start is built

`build_walk_study.py --start-frames 20` appends newly authored start poses at frames 101–120 (48 fps); without the option nothing changes. Checks: the default build is identical to pass 4, and frames 1–72 of the start build are identical to the 48-phase build (motion reports compared).

- **It reuses the loop's own right-foot stance.** From idle (both soles grounded, side by side) the start *is* the accepted loop's right stance from mid-stance (loop phase 0.25: feet together, arms at zero swing) to toe-off (0.5), driven by root distance with the loop's unchanged `hip_at`, `walk_foot` (flat stance, heel-off pivot) and arm functions. The right foot is the support throughout.
- **Weight shift first.** 0.125 s with no travel: the pelvis moves over the right foot to exactly the loop's sway at phase 0.25. Frame 101 is the idle pose (pose deltas 0, image difference 0).
- **Root travel.** 5.506 world px (D, half a step) with smoothstep speed from 0 to 38 px/s: s = D(2τ³ − τ⁴), v = 38(3τ² − 2τ³), τ over 2D/38 = 0.2898 s. Start total **0.415 s**; speed and acceleration join the walk continuously (38 px/s, 0 px/s² at handover).
- **Only the left foot is new.** It lifts from beside the right (world-still at lift-off), swings with the loop's own ease and a leg-length dip (knee to 138°), and lands at +D moving back with the ground, as the loop's left foot does at phase 0.5. No foot pitch on this first step (it lifts from flat standing).
- **Handover** at loop phase 0.5 = 48-phase frame 25; from there the preview advances phase by distance from that handover (walkDistance = 11 px at handover). Stop and idle are the reused 24-set frames (their 24-phase timing is unchanged).

## Contacts (deformed meshes, `start-inspection.json`; `measure-start.cjs` → `start-stats.json`)

| Check | Result |
|---|---|
| Right support, flat (15 frames): sole slide in the travelling frame | 0.0 mm, bottom z 0.003 m |
| Right support, heel-off (5 frames): front edge vs its planted spot | 0.0 mm, edge z 0.003–0.0031 m |
| Left sole while planted in the shift (frames 101–107) | 0.0 mm |
| Left swing: lowest sole point | z 0.003 m (never below ground); lift peaks 47 mm |
| Anything below ground | no (min sole z 0.003 m) |
| Chest distortion / harness | 0 / 8.8 mm, never inside |
| Knees (R / L, frames 101–120) | R 172 → 152 (heel-off), L 172 → 138 → 171; no reversals beyond the swing |

In the preview (dt 1/960 s, nearest start frame by time, deformed contacts): the right support's drawn sole stays within **0.46 px** of its spot while flat and its front edge within **0.95 px** during heel-off; the left sole within 0.0005 px during the shift. These spreads are time quantisation of the 48 fps start frames: near full speed one start frame covers up to 0.79 px of travel, coarser than the 48-phase loop's 0.46 px. No boot teleport, no endpoint correction.

## Boundaries

| Boundary | Pose deltas (world px / degrees) | Mean image difference (0–255) |
|---|---|---|
| Idle 72 → start 101 | all 0 | **0.000** |
| Start 120 → loop 25 (handover, 0.019 s later at 38 px/s) | hip −0.06; R depth +0.26, lift +0.26, knee −4.5°, pitch +3.4°; L depth +0.50, lift −0.14, knee +1.1° | **1.099** |
| Loop 25 → 26 (reference) | hip +0.03; R knee −2.6°, pitch +2.2°; L knee −6.8° | 0.859 |
| Loop 24 → 25 (reference) | R knee −2.9°, pitch +2.4° | 0.928 |
| **Old abrupt start**: idle 72 → loop 25 | — | **9.89** |

The handover step is about one loop step (1.10 vs 0.86–0.93); the old abrupt start is ten times that.

## Visual (`start-transition-zoom.png`, `start-25s.webm`, `start-comparison.png`)

- **Transition strip** (max zoom, 3× without smoothing, one cell per 1/48 s from the last idle frame, fixed camera, red mark at the right boot's planted spot): candidate — idle, a small weight shift (101–107), the left foot lifts and swings while the right boot stays on its mark and rolls into heel-off (116–120), then loop frames 25, 27, 29… with no visible pop. Old — the idle cuts straight to a mid-stride pose moving at full speed.
- **25 s clip**, game size and max zoom, old vs candidate, repeated idle (1.5 s) → start → walk → reused stop → idle (4 s); the loop then teleports back to its idle spot during idle. I checked the strip and stills, not the clip's real-time smoothness by eye.
- **Capture**: 60 fps requested; the page drew 1,487 frames in 25 s (**59.2–59.5 fps**, four panels). Start frames are chosen by start time (48 fps renders); loop frames by distance (48 phases ≈ 83 changes/s at 38 px/s, so not every loop pose is shown at 59 fps).
- The idle spot is moved a few px along the route (same for both) so the candidate's handover leads to the stop on its own phase; the old walker uses the same spot.

## Cost (`start-capture.json`)

| Frames | Count | Bytes |
|---|---|---|
| Start (new) | 20 | 564,504 |
| 48-phase loop (reused) | 48 | 1,425,437 |
| Stop + idle, 24-set (reused, unchanged) | 13 | 374,400 |

## Evidence (`art/review/blender-walk-08/`)

`start-25s.webm`, `start-comparison.png`, `start-transition-zoom.png`, `start-stats.json` (timing, handover, 48 fps root timeline: distance/speed/frame, contact spreads, boundary pose deltas), `start-capture.json` (redraws, image deltas, bytes), `frames-start-warm-contrast/` (20 frames, `projection.json`, `motion-report.json` with the start rows — time, stage, u, root px, speed, loop phase, support leg, per-leg depth/lift/contact/pitch/knee — and `start-inspection.json`).

## Validation

`node tools/validate-assets.cjs`: **Assets valid**. `tests/world.cjs`: pass. `tests/routine.cjs`: pass. Game paths unchanged; release gate as before. The task-1/2 preview layouts (`readability`, `framerule`, `density`) still load with their frame sets.

Regenerate: `build_walk_study.py -- --output <dir> --walk-samples 48 --start-frames 20`, `inspect_walk_study.py … --frames 101-120 --output start-inspection.json`, `render_game_projection.py … --frames 101-120 --look warm-contrast`, `node tools/blender/measure-start.cjs …`, `node tools/capture-blender-start.cjs`.

## Limits

- Start frames are time-sampled at 48 fps, so contact quantisation in the start (up to ~1 px at the heel-off edge near full speed) is coarser than the 48-phase loop's; 96 fps start frames would halve it at twice the start bytes.
- The first step lifts the left foot flat (no toe roll from standing) — a deliberate simplification.
- Right-facing only; no stop-to-start (from mid-walk) or turn transitions. Final visual approval remains open.

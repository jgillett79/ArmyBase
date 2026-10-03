# Blender walk preview — 24 versus 48 walk phases (task 2)

Claude, 3 October 2026, for task 2 in [14_CODEX_READABILITY_REVIEW.md](14_CODEX_READABILITY_REVIEW.md). Preview only, right-facing walk only. Motion baseline e6a99e4, calibration e1752d3, 44 world px height, 22 px stride, 38 px/s — all unchanged. No `js/`, `index.html`, `css/`, `assets/`, manifest or cache change; `walkReleaseGate()` unchanged (walk down candidate; walk up/right missing; idle down candidate; idle up/right missing).

## How the 48 phases were made

Not by interpolating the keyed rig. `build_walk_study.py` gained `--walk-samples 24|48` (default 24): walk frames 1–48 sample the **same continuous motion functions** at phase `(frame−1)/samples`, so 48 gives one cycle at twice the density. The stop keeps its own timing; idle unchanged.

Checks (motion reports, `art/local-blender/walk-study-06-d24` / `-d48`):
- Default (24) build **identical** to the pass-4 build (motion report equal apart from the status line).
- 48-sample even phases **equal** the 24 frames (depth, lift, pitch, knee per leg, pelvis height); stop/idle rows identical.
- 48 distinct phase rows; **48 distinct rendered images** (48 unique SHA-1s). No duplicated frames.

Deformed contacts at all 48 phases (`inspect_walk_study.py`, `frames-48-warm-contrast/rig-inspection.json`): flat-sole slide 0.1 mm per stance (both legs, 16 flat + 8 heel-off frames each), heel-off front-edge slide 0.1 mm at z 0.003–0.0032 m, lowest sole point z 0.003 (no penetration), chest drift 0, harness 8.8 mm (never inside), boot/sole overlap 3 mm. Interpolation was not needed, so no interpolation failure to report.

**Phase → index mapping.** Frame `i` (1–48) is normalised phase `(i−1)/48`; the drawn frame is `1 + round(φ·N) mod N` with φ = (walkDistance mod 22)/22, so phase 1.0 wraps to frame 1 (loop preserved). Per frame, `frames-48-warm-contrast/motion-report.json` records phase-derived travel (`virtualTravelMetres`), each leg's depth, lift, contact (`flat`/`toe`/swing), pitch and knee; `rig-inspection.json` records the deformed sole centroid and front-edge coordinates and heights per frame. Stop (49–60) and idle (72) are the reviewed 24-set frames for both panels; **only walking density differs**.

## Look

Both panels use the same preview look from task 1: warm map light + stronger contrast + subtle silhouette outline + identity marker. The accent fill is off in both (it was invisible at this size) — no second accent-mask render, per the budget. Frame selection: nearest in both.

## Measurements (`density-stats.json`, `tools/blender/measure-phase-density.cjs`)

Deterministic: 20 cycles at 0.01 px steps (44,001 samples per set), nearest-frame selection, 1D travel. The planted contact's drawn world position uses the **deformed** contact from the inspection (flat: sole centroid; heel-off: sole front edge), not interpolated report rows. Contact intervals are defined by **true** phase, like for like: flat [0, 1/3), heel-off [1/3, 1/2) of each leg's cycle (the first heel-off frame is phase 1/3 in both sets). Samples whose drawn frame has a different contact class than the true interval are excluded and counted.

| | 24 phases | 48 phases |
|---|---|---|
| Phase error mean / RMS / max (world px) | 0.000 / 0.265 / 0.457 | 0.000 / 0.132 / 0.228 |
| Flat-sole creep within a stance, peak-to-peak (R / L, mean of 21/20 stances) | 0.918 / 0.919 | **0.460 / 0.460** |
| Heel-off front-edge creep, peak-to-peak (R / L) | 0.915 / 0.915 | **0.459 / 0.459** |
| Excluded boundary samples, flat (each leg) | 920 of 14,666 (6.3%) | 460 of 14,666 (3.1%) |
| Excluded boundary samples, heel-off (each leg) | 915 of 7,335 (12.5%) | 455 of 7,335 (6.2%) |
| Deformed contact heights (sole / front edge, m) | 0.003 / 0.003–0.0031 | 0.003 / 0.003–0.0032 |

48 phases halve the measured quantisation for every contact interval, as expected (≈0.46 px), and halve the boundary exclusions. Nearest selection centres the error; neither density is a foot lock.

## Visual (`density-stance-zoom1.png`, `density-stance-zoom1.6.png`, `density-25s.webm`, `density-comparison.png`)

- **Stance strips** (12 steps of 22/48 px through one right stance, crops fixed on the boot's true planted spot, 6× without smoothing): the 48 row changes sprite on every step and the boot stays closer to the red line; the 24 row changes every other step with larger jumps. No new pop at stance start, heel-off or loop wrap.
- **25 s clip**, game size and max zoom, both soldiers in step on the same route. I checked the comparison still and the strips, not the clip's real-time smoothness by eye; at game size the difference is sub-pixel by measurement (0.46 px less creep). Real-time judgement of the clip is open for review.
- **Capture fps vs sprite phases.** The recorder requested 60 fps; the page redrew 1,192 times in 25 s (**47.7 fps**, four panels per frame). At 38 px/s, sprite phase changes are 41.5/s (24) and 82.9/s (48), so neither the page nor the clip shows every 48-phase change; frame selection is by exact distance at each redraw, so the positional error above holds per drawn frame.

## Cost (`density-frames.json`)

| Set | Walk frames | Bytes (preview PNGs, 176 × 256) |
|---|---|---|
| 24 phases | 24 | 712,432 |
| 48 phases | 48 | 1,425,437 |
| Stop + idle (shared) | 13 | in the 24 set's 37 frames, 1,086,832 total |

Double the walk frames and bytes for this one direction, as expected; four directions (or three plus a mirror) would scale accordingly.

## Evidence (`art/review/blender-walk-07/`)

`density-25s.webm`, `density-comparison.png`, `density-stance-zoom1.png`, `density-stance-zoom1.6.png`, `density-stats.json`, `density-frames.json`, `frames-48-warm-contrast/` (48 frames + `projection.json`, `motion-report.json`, `rig-inspection.json`), `frames-24-reference/` (the 24 set's motion report and deformed-contact inspection used for the measurement).

## Validation

`node tools/validate-assets.cjs`: **Assets valid**. `node tests/world.cjs`: pass. `node tests/routine.cjs`: pass. Game paths (`js/`, `index.html`, `css/`, `assets/`) unchanged; release gate as above. The task-1 layouts (`readability`, `framerule`) still load and draw their 24-frame walk after the shared page changes.

Regenerate: `build_walk_study.py -- --output <dir> --walk-samples 48`, `inspect_walk_study.py` on it, `render_game_projection.py -- --frames 1-48 --look warm-contrast`, then `node tools/blender/measure-phase-density.cjs …` and `node tools/capture-blender-density.cjs`.

## Verdict

48 phases are truly distinct, preserve contact and motion, measurably halve planted-foot quantisation (0.92 → 0.46 px peak-to-peak, flat and heel-off, both legs) with no new contact pop, at twice the walk-frame bytes. Whether that is visible enough at game size to justify the cost is a judgement for the clip; at zoom 1 the difference is sub-pixel.

# First Blender walk — local run and review

Claude, 2 October 2026, on `main` after a191125. Answers [11_FIRST_BLENDER_WALK.md](11_FIRST_BLENDER_WALK.md). **A movement test only**: not in the game, not in the asset manifest or cache; the walk release gate stays blocked. `.blend` files stay local in `art/local-blender/` (gitignored).

## Run

- Input: the plain revision-3 model, `art/local-blender/soldier-study-04/soldier_study.blend` (opened in a fresh background process; the source file is not modified — its timestamp is unchanged).
- Blender **5.2.2 LTS**. Scene-only build: 4 s, exit 0. Renders: `--render-step 3` (8 loop poses + idle per view) in 7.5 min; `--render-step 1` (24 loop poses + idle per view) in about 20 min. Exit 0 throughout.

### Fixed before rendering: every pose was twisted about its own bone axis

`pose_bone()` built each bone's rotation with `to_track_quat('Y','Z')`, which chooses its own roll and ignores the bone's rest roll. Inspecting the evaluated rig (frame 61, idle, where every bone points in its rest direction) showed the **roll** changed by: thighs 173.8°, feet **180°**, upper arms 78.7°, forearms 88.3° (pelvis, spine, head and hands 0°). Consequences: the boots were flipped about the ankle–toe line (planted sole 6 mm *below* the ground with the toe 9 cm lower than the heel) and the trouser legs and sleeves were wrung like candy wrappers.

Fix in `tools/blender/build_walk_study.py`: swing each bone from its rest direction to the target direction and keep the rest roll (`rest_y.rotation_difference(target) @ rest`). After the fix, roll change equals the swing only (0° on every bone at idle; 6.2°/6.7° on thigh/shin, which is their actual direction change), and the planted sole sits flat at its rest height (z 0.003, no toe/heel or side tilt). The first build (`walk-study-01`) was not rendered.

## Measured (evaluated, deformed meshes; `art/review/blender-walk-01/`)

| Check | Result |
|---|---|
| Boot–sole repair | Upper bottom z 0.026 vs sole top 0.029: **3 mm overlap** (was a 16 mm gap) |
| Strap repair | Harness vertices **3.0 mm** from the final smoothed chest (min = max = mean) |
| Planted sole height and tilt | z 0.003 (rest height) every planted frame; toe–heel and side tilt 0.000 |
| Slide while planted | **0.0000 m** in the virtual travelling frame (0.4 m/s) for every stance of both legs, frames 1–48 |
| Alternation | Right planted frames 1–13 and 25–37, left 13–25 and 37–49: opposite legs exactly half a cycle apart, one frame of double support at each change |
| Swing lift | 4.8 cm |
| Knees | Bend toward the front in every frame; knee angle 139.4° (swing) to 168.5° (mid-stance); never straight |
| Settle (49–60) | A planted foot moves 3.3 cm in local space while the body stops: a slide, as the handoff warned |
| Idle (61–72) | Both feet side by side, flat, no drift |

## Visual review

- **Motion reads as a walk** in the right and three-quarter views: alternating legs, forward knees, a little hip bob and sway, no squat, no inverted knee, no locked hips. Hips, crotch and knees deform smoothly once the roll bug is fixed.
- **Strides are tiny.** The feet barely pass each other: the cycle is 0.4 m (0.21 × body height). The game plays walk frames by distance at 22 world px per cycle for a 44 px figure (0.5 × height) — the equivalent of **0.94 m per cycle** for this 1.886 m soldier, at about 1.7 cycles/s (median speed 38 px/s ≈ 1.6 m/s). Played by the game, this cycle would either cycle 2.4× too fast (a frantic shuffle) or slide 0.54 m per cycle. The next pass needs a ~0.94 m cycle (0.47 m steps), more hip travel and a straighter support leg; the game's speed and stride must not change to suit the study.
- **Support leg never straightens** (max 168.5°): with the short steps it reads slightly crouched.
- **Arms barely swing** (±6.5 cm at the wrist); a natural swing is several times that.
- **Thigh pockets** are rigidly bound to the thigh bones and stand off the bent legs like flaps (visible in the contact sheet at frames 7 and 19).
- **Strap repair kinks the ribbons.** Projecting each ribbon vertex to the closest point on the chest folds the strap into small zig-zags on the flanks and bunches it behind the collar; these show as dark slivers in the side view. Project along the ribbon's own normal, or rebuild the ribbon from points sampled on the final surface.
- **Settle** slides a planted foot (above); it needs a real foot-lock stop.
- At **44 px** the motion is legible but the steps are so short that the legs barely separate.

## Evidence (`art/review/blender-walk-01/`)

| File | What |
|---|---|
| `walk-loop.webm` | Right and three-quarter views plus the 44 px figure (4×), looping the 24-pose cycle at **24 fps** |
| `contact-sheet.png` | All 24 loop frames + idle per view, one shared crop, the ground line, and the planted leg per frame |
| `travel-overlay.png` | Right view, every loop frame shifted by the virtual travel: planted boots stack into single boots |
| `game-size-44px.png` (+ `-1x`) | The cycle scaled to a 44 px figure, 4× without smoothing |
| `motion-report.json`, `rig-inspection.json` | The script's report and Claude's per-frame measurements of the deformed meshes |

Regenerate: `node tools/blender/compose-walk-review.cjs art/local-blender/<walk-study> art/review/<dir>`; it plays sparse renders at their real rate (every third frame → 8 fps).

## Verdict

**A working first rig, not a usable walk yet.** Contact, alternation and planted-foot stability are correct after the roll fix, and deformation is clean. Before rendering more directions: lengthen the cycle to the game's stride (~0.94 m per cycle for this height), straighten the support leg, enlarge the arm swing, make the thigh pockets deform with the cloth (weights instead of a rigid bind), rebuild the straps without kinks, and give the settle a planted-foot stop. No game integration.

# Blender walk pass 2 — sparse render and deformation checks

Claude, 2 October 2026, on `main` after 2293cd9. Follows [11_FIRST_BLENDER_WALK_REVIEW.md](11_FIRST_BLENDER_WALK_REVIEW.md). **A movement test only**: not in the game, not in the asset manifest or cache; the walk release gate stays blocked. `.blend` files stay local in `art/local-blender/` (gitignored). Superseded by pass 3 ([11_BLENDER_WALK_PASS3_REVIEW.md](11_BLENDER_WALK_PASS3_REVIEW.md)); kept as the record of why the torso weights changed.

## Run

- Input: `art/local-blender/soldier-study-04/soldier_study.blend` (plain revision 3), Blender 5.2.2 LTS, fresh background process.
- Script: `tools/blender/build_walk_study.py` at its pass-2 state (commit of this review). Scene-only build `walk-study-03` (preserved); sparse render `walk-study-03-step3` with `--render-step 3` (8 loop poses + 6 stop/idle poses per view, 28 renders, exit 0).
- Pass 2 changes from pass 1: 0.944 m cycle (the game's 22 px stride on a 44 px figure, scaled to the 1.889 m model), pelvis height from the stance leg so it stays at 172°, ±20° opposite arm swing at preserved bone lengths, thigh pockets weighted with the trousers, harness rebuilt on the final chest surface, and a stop that finishes on planted feet.

## Measured on the deformed meshes

New `tools/blender/inspect_walk_study.py` evaluates every frame 1–72 (read-only) and writes `rig-inspection.json`.

| Check | Result | |
|---|---|---|
| Planted boot slide (travelling frame) | 0.1 mm in every stance span of both legs, frames 1–48 | pass |
| Planted sole | bottom z 0.003 (rest height), toe–heel tilt 0.000; boot upper overlaps sole 3 mm | pass |
| Support leg | 172.0° through every stance frame (pass 1: 168.5° max, never straight) | pass |
| Swing leg | 138–178°, lift up to 5 cm | pass |
| Arm swing | wrist travels 43 cm front-to-back (pass 1: ≈13 cm); arm bone lengths constant | pass |
| Thigh pockets | max 14 mm from the trousers, same as at rest (13.8 mm): they move with the cloth | pass |
| Stop (49–60) | right sole planted throughout, 0.1 mm slide; left steps in beside it; both feet side by side at 60 and through idle, 0 drift | pass |
| **Harness / chest** | **8.8 mm with arms down; 3.2 cm at both swing extremes (frames 1, 13, 25, 37, 49) — signed −3.2 cm: the chest bulges over the strap** | **fail** |
| **Chest/back distortion** | **torso vertices up to 16.7 cm from where the spine/pelvis would carry them at full swing; 1.8 cm with arms down** | **fail** |

## Cause

The uniform was weighted to its two nearest bones out of pelvis, spine and both arms. The flank under the armpit (x ±0.13, z ≈1.17) is nearer the upper-arm bone than the spine, so the arm swing dragged the side of the chest and back with it, while the harness (rigid to the spine) stayed put. Visible in the renders at both swing extremes: the back bulges behind the backward arm, the chest pulls toward the forward arm, and the strap appears to float.

## Visual

- Gait reads as a walk at the right size: long steps, straight support leg, clear passing pose, opposite arm swing.
- Travel overlay: planted boots stack into single boots at the measured 0.945 m/s.
- Torso warp at frames 1 and 13 (both views) is the only visible defect beyond the faint trouser crease behind the rear knee.

## Evidence (`art/review/blender-walk-02/`)

`walk-loop.webm` (8 fps = every third frame of 24 fps, so real speed), `contact-sheet.png`, `travel-overlay.png`, `game-size-44px.png` (+ `-1x`), `motion-report.json`, `rig-inspection.json`.

`compose-walk-review.cjs` now reads the travel per frame from the motion report (it had pass 1's 0.4 m/s hard-coded, which would have shown false sliding at pass 2's speed).

## Verdict

Gait, contact and stop pass; torso weighting fails. Per the agreed rule, no full 24 fps render of pass 2. Fixed in pass 3.

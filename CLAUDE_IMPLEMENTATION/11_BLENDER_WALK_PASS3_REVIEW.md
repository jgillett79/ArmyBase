# Blender walk pass 3 — torso/sleeve weights

Claude, 2 October 2026, on `main` after the pass-2 review ([11_BLENDER_WALK_PASS2_REVIEW.md](11_BLENDER_WALK_PASS2_REVIEW.md)). **A movement test only**: not in the game, not in the asset manifest or cache; the walk release gate stays blocked. `.blend` files stay local in `art/local-blender/` (gitignored).

## Change

Only the uniform's skin weights (`sleeve_amount` / `uniform_weights` in `tools/blender/build_walk_study.py`). Pass 2 weighted each uniform vertex to its two nearest bones out of pelvis, spine and both arms, so the flank under the armpit followed the arm swing.

- **Chest and back** follow only the torso bones (pelvis/spine, two nearest).
- **Below the armpit** the flank and sleeve are separate surfaces with a 2–4 cm gap in |x| (measured on the rest mesh, `ARMPIT_GAP`); the split runs down that gap, so flank = torso and sleeve = arm (upper arm/forearm of that side).
- **Over the shoulder cap** the weight blends smoothly from torso to arm across |x| 0.165–0.225 m, and the two rules cross-fade over z 1.17–1.30 m so there is no seam at the armpit.
- Harness (|x| ≤ 0.136) and chest pockets (≤ 0.148) stay entirely on the torso side.

Motion is untouched: `motion-report.json` is identical to pass 2 apart from its status line (compared field by field).

## Measured on the deformed meshes (`tools/blender/inspect_walk_study.py`)

| Check | Pass 2 | Pass 3 |
|---|---|---|
| Chest/back distortion (torso vertices vs spine/pelvis alone), full swing (frames 1, 13) | 16.7 cm | **0.0 mm** |
| Same, arms down (frames 7, 19) | 1.8 cm | **0.0 mm** |
| Harness from chest, every frame | 8.8 mm – 3.2 cm, chest bulging over it (signed −3.2 cm) | **8.8 mm constant, never inside** (signed min +0.1 mm) |
| Planted boot slide / sole height / tilt | 0.1 mm / z 0.003 / 0 | unchanged |
| Support knee / swing knee | 172° / 138–178° | unchanged |
| Wrist swing, arm bone lengths | 43 cm, constant | unchanged |
| Thigh pockets from trousers | ≤ 14 mm (rest 13.8 mm) | unchanged |
| Stop and idle | right sole planted 49–60, feet side by side, 0 drift | unchanged |

## Visual (sparse render `--render-step 3`, then full)

- At both swing extremes the chest stays square, the harness and chest pockets lie flat on it, and the belt line is continuous. Pass 2's crumpled chest at frame 13 (three-quarter) is gone.
- The shoulder cap blends into the swung sleeve without a tear. A soft crease shows at the back of the shoulder when the arm is fully back (right view, frame 1); the slight hump on the left shoulder is the model's own shape (present at idle, frame 72) and only a little more pronounced in swing.
- Remaining, not addressed in this pass: a faint trouser crease behind the rear knee at full stride (also in pass 2).

### Full 24 fps loop (`--render-step 1`, 74 renders, exit 0, ≈28 min)

- The loop closes: frame 25 equals frame 1 in every channel (hip, sway, both feet, knees, wrists), so it repeats without a jump. Planted boots still stack in the travel overlay at 0.945 m/s; at 44 px the stride and arm swing read clearly.
- **Smoothness hitches for review** (from the motion report, frame-to-frame):
  1. **Hip dip at each footfall.** The pelvis drops 1.1 cm in one frame at the changeover (frames 1, 13, 25, 37, 49) and rises again: a sharp V, not a rounded trough (largest change in vertical acceleration of any channel). It reads as a small jolt per step. Cause: the hip height is derived from a stance leg that switches instantly; a short double-support blend would round it.
  2. **Trailing knee straightens at toe-off.** For the two frames after lift-off the swing knee goes to 178° (the leg is clamped at full reach while the foot is behind and rising), then bends 14.6° per frame. A real knee is already flexing at toe-off; this reads as a stiff kick-back. Needs heel-off / toe roll or an earlier knee bend.
  3. **Stop overshoot.** The stepping-in left foot passes its final spot by 1.1 cm at frame 59 (lift 3 mm) and settles back at 60.
- None of these change contact: planted soles stay at 0.1 mm slide.

## Evidence (`art/review/blender-walk-03/`)

| File | What |
|---|---|
| `walk-loop.webm` | Full 24 fps loop: right and three-quarter views plus the 44 px figure (4×) |
| `contact-sheet.png` | Every loop frame + stop/idle per view, ground line, planted leg |
| `travel-overlay.png` | Right view shifted by the virtual travel (0.945 m/s): planted boots stack |
| `game-size-44px.png` (+ `-1x`) | The loop at game size |
| `motion-report.json`, `rig-inspection.json` | Script report and the per-frame deformed-mesh measurements |
| `sparse-8fps/` | The every-third-frame review that gated the full render (8 fps = real speed) |

Regenerate: build with `build_walk_study.py -- --output <new dir> [--render-step N]`, inspect with `blender --background <dir>/soldier_walk_study.blend --python tools/blender/inspect_walk_study.py -- --report <dir>/motion-report.json --output <dir>/rig-inspection.json`, compose with `node tools/blender/compose-walk-review.cjs <dir> <review dir>`.

## Verdict

**Torso weighting fixed; ready to judge for smoothness.** Chest and back now hold their shape at both swing extremes and the harness stays on the chest, with gait, contact and the stop unchanged. The full loop is smooth apart from the hip dip at each footfall and the stiff trailing knee at toe-off (and a 1 cm stop overshoot) — the next motion pass should round the double-support hip and start the knee bend before lift-off. Still not in the game; walk gate blocked.

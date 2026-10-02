# Blender walk pass 4 — motion only: hip trough, heel-off, stop

Claude, 3 October 2026, from ac455fb ([pass 3](11_BLENDER_WALK_PASS3_REVIEW.md)). **A movement test only**: not in the game, not in the asset manifest or cache; the walk release gate stays blocked. `.blend` files stay local in `art/local-blender/` (gitignored).

## Brief

Motion-only pass, preserving the model, materials, corrected torso weights, stride (0.944 m cycle) and cycle duration (1 s at 24 fps): (1) smooth pelvis height and velocity across footfalls without planted-foot slide; (2) make trailing-knee flexion start progressively at toe-off with no near-straight lock or snap, changing the swing path rather than forcing an unreachable leg; (3) remove the stopping left foot's overshoot while the right stays planted.

## Changes (`tools/blender/build_walk_study.py`, motion section only)

1. **Pelvis (`hip_at`).** The pelvis used to ride the stance leg's compass arc, which has a V at every footfall (vertical speed flips sign in one frame). Within `ROUND_WINDOW` (0.7 D of stance-foot travel, about 4 frames) either side of a footfall the pelvis now sits below that arc by `SLOPE·e·(1−e/W)²`: zero vertical speed at the changeover, rejoining the arc smoothly. It is never above the arc, so the planted leg always reaches and nothing slides. Pelvis range is unchanged (0.922–0.958 m).
2. **Heel-off and swing (`heel_off`, `walk_foot`, `swing_length`).** From leg phase 0.325 (the start of the trough window) the trailing boot pitches up about the front edge of the sole's flat bottom, measured on the final mesh — the edge stays where it was planted. The hip–ankle distance follows smooth keys: full length at heel-off, shortest (0.728 m, ≈134° knee) at phase 0.68, fully extended again at 0.96, so the knee bends continuously from heel-off through swing and is straight one frame before landing. Swing depth and pitch leave toe-off with the heel-off's own position and speed (Hermite), and the foot is level again by phase 0.8; it lands flat.
3. **Stop (`stop_moved`, stop branch).** Body travel is a cubic that starts at walking speed and ends at rest. The left foot leaves from the same toe-off state and moves to its final spot beside the right on a cubic with zero end speed; its leg length and pitch follow keys. It never passes the spot. The right foot stays flat and planted throughout.

Tuned headlessly first (`hip_at`, heel-off, swing and stop maths run without Blender against reach, ground clearance and frame-to-frame steps) before any render. Wider trough windows smooth the pelvis further but bend the support knee to ≈159° in early stance and give back pass 2's straight support leg, so 0.7 D was kept.

## Before / after (motion report + `inspect_walk_study.py` on the deformed meshes)

| Check | Pass 3 | Pass 4 |
|---|---|---|
| Pelvis: largest frame-to-frame change in vertical speed ("jolt") | 22.4 mm/frame² (the V) | **8.0 mm/frame²** |
| Pelvis steps either side of a footfall | −11.2 / +11.2 mm | **−4.0 / +4.0 mm** |
| Pelvis jolt in the stop | 22.8 mm/frame² | **7.7 mm/frame²** |
| Swing frames straighter than the 172° stance knee | 9 per cycle (178° at toe-off and before landing) | **0** |
| Right knee, frames 10–16 (heel-off → swing) | 172 172 172 172 **178 178 164** | 167 160 154 148 143 139 136 |
| Largest knee change in one frame | 14.6° (snap after the lock) | 9.2° (loading, see below) |
| Stopping left foot past its final spot | 10.5 mm (frame 59) | **0.0 mm** — depths −214 … −25, −7, 0 mm |
| Planted flat sole: slide / height / tilt | 0.1 mm / z 0.003 / 0 | 0.1 mm / z 0.003 / 0 |
| Heel-off: front sole edge slide / height | — | **0.0 mm / z 0.003–0.0031** (pitch up to 2.9° while planted, 11.4° in early swing) |
| Stop: right sole slide, idle drift, feet at idle | 0.1 mm, 0, side by side | 0.1 mm, 0, side by side |
| Lowest sole point, any frame | z 0.003 (never below ground) | z 0.003 |
| Lowest sole point mid-swing (leg phase 0.6–0.92) | 23 mm | 26 mm |
| Boot upper / sole overlap (level frames) | 3 mm | 3 mm |
| Chest/back distortion; harness from chest | 0; 8.8 mm, never inside | 0; 8.8 mm, never inside |
| Wrist swing; pockets from trousers | 43 cm; ≤ 14 mm | unchanged |

Right knee through one cycle, pass 4 (frames 1–25): `172 162.8 163.1 167.2 171.8 172 172 172 171.8 166.9 160.1 153.5 147.6 142.6 138.5 135.7 134.4 134.9 137.9 142.9 149.6 157.5 166.1 172 172`.

## Remaining / trade-offs

- **Loading flex.** Flattening the pelvis trough means the landing leg shortens as the body passes over it: the knee lands at 172° and flexes to 162.8° in the next frame (then 163 → 167 → 172). This is the gait's loading response and reads as a soft landing, but it is the largest single-frame knee change left (9.2°). Removing it needs a heel-strike landing (foot dorsiflexed at contact), which this rigid boot does not have.
- **Support leg in early stance** bends to ≈163° during loading, straight (≈172°) from mid-stance until heel-off — pass 3 held 172° all through stance.
- The heel-off pivots on the rigid sole's front edge (no toe bend), so the boot tips as one piece.
- The faint trouser crease behind the rear knee and the soft crease at the back of the shoulder in full back-swing (pass 3) are untouched: this pass is motion only.

## Visual (sparse `--render-step 3` first, then full 24 fps, 74 renders, exit 0)

- Sparse key frames: the trailing boot rolls up on its toe at frames 10–13, the knee bends through swing with no straight-leg frames, the landing leg is extended at contact, the torso and harness are unchanged, and the stop ends with the feet side by side. Passed, so the full loop was rendered.
- Full loop closes (frame 25 equals frame 1 in every channel) and is the same motion as the inspected build (motion reports identical apart from the status line).
- Travel overlay: the planted boots still stack into single boots at 0.945 m/s; the head traces a smooth wave with no cusp at the footfalls.
- `walk-stop-idle.webm` checked frame by frame: walks across the 0.1 m ticks, decelerates over the planted right boot, the left steps in beside it without passing it, idle holds still.

## Evidence (`art/review/blender-walk-04/`)

| File | What |
|---|---|
| `walk-loop.webm` | Full 24 fps loop: right and three-quarter views plus the 44 px figure (4×) |
| `walk-stop-idle.webm` | Two walk cycles, the stop and a held idle at 24 fps; the right view travels over 0.1 m ground ticks, so the planted right boot can be checked against the ground |
| `key-poses.png` | Walk (1, 4, 7, 10, 13), stop (52, 56, 60) and idle (72) at 0.6× render size — sharp, unlike the downscaled contact sheet |
| `contact-sheet.png`, `travel-overlay.png`, `game-size-44px.png` (+ `-1x`) | As before |
| `motion-report.json`, `rig-inspection.json` | Script report (now with per-foot `contact` flat/toe and `pitchDeg`) and the deformed-mesh measurements |
| `sparse-8fps/` | The every-third-frame review that gated the full render |

`compose-walk-review.cjs` gains `key-poses.png` and `walk-stop-idle.webm`; `inspect_walk_study.py` measures the sole's front edge through heel-off and only compares boot/sole height on level frames.

## Verdict

**The three brief items are done and measured.** The pelvis V is gone (jolt 22.4 → 8.0 mm/frame², 7.7 in the stop), the trailing knee flexes progressively from heel-off with no straight lock or snap (0 swing frames straighter than stance; the pass-3 lock before landing is gone too), and the stopping foot no longer overshoots (10.5 → 0 mm). Contact holds: flat soles slide 0.1 mm, the heel-off edge 0 mm, nothing goes below the ground, and the torso is unchanged. Left for review: the 9° one-frame loading flex at landing (needs a heel-strike to remove) and the slightly softer early-stance support leg (≈163°). Still not in the game; walk gate blocked.

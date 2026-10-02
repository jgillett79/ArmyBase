# Blender walk — calibrated, isolated preview on a game path

Claude, 3 October 2026. Motion baseline **e6a99e4** (pass 4, [review](11_BLENDER_WALK_PASS4_REVIEW.md)); the walk study is unchanged. **Preview only**: the game, `js/`, `index.html`, the asset manifest and `assets/` are untouched, and the walk release gate is still blocked (`walkReleaseGate()`: walk down candidate, walk up/right missing, idle down candidate, idle up/right missing). `node tools/validate-assets.cjs` passes.

## Calibration (before any preview)

`tools/blender/render_game_projection.py` renders the built pass-4 study (`art/local-blender/walk-study-05`, built from e6a99e4's script) for the game's camera:

- **Projection.** The game is top-down oblique: 1 world px = 1 screen px on *both* ground axes, heights straight up the screen ([06_GATE0_VISUAL_CONTRACT.md](06_GATE0_VISUAL_CONTRACT.md)). That is a parallel projection along (0, south, down)/√2. An orthographic camera at **45° elevation** has exactly that view direction (so the same visibility and occlusion); its image is the game's squashed vertically by 1/√2. Frames are rendered at 45° and drawn with a **√2 vertical stretch** (`projection.json` `verticalStretch`). The usual 35° study camera foreshortens ground depth and was never usable in-game.
- **Direction.** Walking right (east) the game's south camera sees the soldier's right side, so the camera sits on the rig's −X side; south (toward the viewer) is down the screen.
- **Scale.** 44 world px / model height 1.887 m = **23.32 world px per metre**, on x, ground depth and height alike. Check: the study's 0.9445 m cycle = 22.02 px against the game's `strideWorld` 22 (0.1%).
- **Pivot.** The rig origin on the ground, projected into each render (`pivot` = (88, 195.88) render px, pre-stretch) — the unit's `x`/`y`, as the game's sprites put their ground contact on the pivot.
- **Checks** printed by the render and stored in `projection.json`, in game px after the stretch: helmet top straight up **44.000**; 1 m east → **(23.316, 0)**; 1 m south → **(0, 23.316)**. No frame touches its render edge. The lowest pixel of each frame sits 2.5–3.9 px below the pivot: the near (right) boot's outer sole edge is 0.174 m south of the body centre, 4.06 px down the screen in this projection — ground contact, not a pivot error.
- **Light.** The study rig is turned with the camera so it keeps its relation to the camera from the approved appearance renders (not re-lit). Contact shadows are the game's own ellipse.
- 37 frames: walk 1–24, stop 49–60, idle 72 (`art/review/blender-walk-05/game-frames/`, 176 × 256, 120 render px per metre, about 3× supersampled at max zoom), with the study's `motion-report.json`.

## Preview (`tools/blender-walk-preview.html`)

A separate page under `tools/` (not deployed). It loads the game's scripts **except `js/main.js`**, builds an in-memory `GameState` that is never saved (no visitors, paused), and draws the real map with the game's `renderFrame()` through two cameras: **game size (zoom 1, fixed over the trail)** and **max game zoom (1.6, following)**. Only the preview soldier is drawn from the Blender frames, by a page-local wrapper of `drawUnit` (the game's own contact shadow, then the frame at the pivot); name/level labels are hidden because at this size they sit over the feet (`?labels=1` shows them).

- **Path:** the authored central trail **t1 → t2 → t3 → t4** (≈515 world px, the longest east-running stretch; slopes ≤ 0.27), routed by the game's `routeToNode` and walked by the game's `Unit.step()`.
- **Speed:** 38 world px/s (`?speed=` to change), inside the game's 30–46 px/s range; unchanged by the preview.
- **Phase by distance:** walk frames are chosen exactly as `js/animation.js` does — `floor(walkDistance / 22 × 24)` — so one 24-frame cycle per 22 px travelled.
- **Stop on phase:** the start is set mid-stride so the stop begins where the remaining route equals the stop's own distance (5.505 px) *and* the walk is at frame 1 (= stop frame 49). The stop plays the rendered deceleration (frames 49–60), time-scaled so it leaves at this soldier's walking speed, moving the soldier exactly along the route polyline (`Unit.step` treats < 1 px as arrived, which first cut the stop short by 0.8 px and left frames 56–60 sliding; fixed). Then idle (frame 72) for 4 s, and the loop restarts at t1.

## Measured during the capture (`preview-stats.json`, three loops)

| Check | Result |
|---|---|
| Frames drawn facing anything but right | 0 of 2393 walk frames |
| Walk phase when the stop begins | 0.021–0.027 px from the stop's phase |
| Stop distance left at its end | 0 px |
| Stop duration at 38 px/s | 0.27 s (the render's 0.5 s at 22 px/s, phase by distance) |
| Planted-foot drift in the world while flat-planted (walk and stop) | ≤ 0.83 world px (1.3 screen px at max zoom) |

The drift is the game's frame rule: `floor` holds each of the 24 frames for 0.92 px of travel, so a planted boot creeps up to one frame's travel and snaps back. Choosing the nearest frame instead would halve it (±0.46 px); that is a one-line change in `animation.js` for later — not made here.

## Evidence (`art/review/blender-walk-05/`)

| File | What |
|---|---|
| `walk-preview-30s.webm` | 30 s, 1600 × 500: game size (left, fixed) and max zoom (right, following); about 1.7 walk–stop–idle loops |
| `stride-steps-zoom.png` | 12 consecutive max-zoom snapshots through a stride, 2× without smoothing, ground line and pivot marked |
| `stop-steps-zoom.png` | Every stop frame 49–60 and the first idle frame, same marking |
| `preview-stats.json` | Calibration, constants, phase/stop/drift numbers and the per-frame sole check |
| `game-frames/` | The 37 calibrated frames, `projection.json`, `motion-report.json` |

Regenerate: build the study with `build_walk_study.py` from e6a99e4, then `blender --background <study>/soldier_walk_study.blend --python tools/blender/render_game_projection.py -- --output art/review/blender-walk-05/game-frames` (copy the study's `motion-report.json` in), then `node tools/capture-blender-walk-preview.cjs`.

## Observations for review

- **Readability at game size.** At zoom 1 the figure is 44 px tall and, side-on, **8 px wide standing** (chest about 6 px), up to 18 px at full stride; the game's current right-facing stills measure 11.6–15.4 px wide (opaque width in their 29 × 44 box). Olive on olive grass, it reads as a soldier walking but is easy to lose on the map. This is an art-direction question (silhouette width, value contrast, outline, per-soldier identity colour — this figure is untinted and has no accent mask), not a calibration error.
- **Cadence.** At game speed (38 px/s ≈ 1.63 m/s for this figure) the game's 22 px stride gives 1.73 cycles (3.5 steps) per second — a brisk march. Speed and stride are the game's and were not changed.
- **Lighting** is the study rig turned with the camera, not matched to the game's warm upper-left key on the map art; the figure looks cooler and greyer than the scenery.
- **Start.** There is no start-from-idle animation; the loop begins mid-stride at t1.
- Only the **right** direction exists; left would mirror it (`mirrorForLeft`), up/down need their own renders with the same calibration.

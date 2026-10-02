# Blender walk — readability and frame-selection comparison (task 1)

Claude, 3 October 2026, for [AGENT_HANDOFF.md](AGENT_HANDOFF.md) task 1. Baseline e1752d3 (calibration) on motion e6a99e4 (tag `blender-walk-motion-baseline`). **Preview only.** No change to `js/`, `index.html`, `css/`, `assets/`, the asset manifest or cache; `walkReleaseGate()` unchanged (walk down candidate; walk up/right missing; idle down candidate; idle up/right missing). `node tools/validate-assets.cjs`: Assets valid. `tests/world.cjs`, `tests/routine.cjs`: pass.

## Preserved

Projection, pivot, 44 px standing height, 22 px stride, 38 px/s, pass-4 motion and the stop-on-phase driver are exactly e1752d3's. `render_game_projection.py` with the default `--look study` re-renders frames **pixel-identical** to e1752d3's (0 of 180,224 channels differ on frames 4 and 72; same pivot, scale, stretch and checks). No proportions, body width, gait or start animation changed.

## What was compared (cumulative, each step separable)

| Step | How | Where |
|---|---|---|
| Current | e1752d3 frames | `art/review/blender-walk-05/game-frames` |
| + warm map light | Blender `--look warm`: the study rig replaced by the map's light — a warm sun (1.0, 0.84, 0.62) from the screen's upper left (north-west, high; the map's contact shadows fall lower right) and a weak cool sky fill from the viewer | `frames-warm/` |
| + stronger contrast | `--look warm-contrast`: uniform and helmet darker and deeper than the grass value, trousers a step lighter than the tunic, webbing lighter khaki, boots darker. Materials changed in memory only | `frames-warm-contrast/` |
| + accent | `--accent-mask`: helmet band and shoulder patch rendered white with everything else held out; the preview fills it with the soldier's accent (signal red) exactly as `js/animation.js` `accentStrip` does | `frames-warm-contrast/accent/` |
| + identity marker | Preview-drawn: a small accent pip above the helmet, constant on screen. The game's name/level labels (which sit over the boots) and the HUD clock/legend are off in this page | `tools/blender-walk-readability.html` |
| + subtle outline | Preview-drawn: the frame's silhouette dilated by 0.8 world px (corrected for the √2 stretch), dark olive at 85%, behind the body — silhouette only, no interior lines across face, pockets or straps | same |

Each variant is its own soldier in its own unsaved `GameState`, drawn by the game's `renderFrame()` on the real map, at 38 px/s on trail t1 → t4.

## Results

**Readability** (`readability-normal-size.png`, `readability-max-zoom.png`, `readability-20s.webm`):

- **Warm map light** — a small, real gain: the helmet top and shoulder pick up the map's warm key and the figure stops looking cool-grey against the scenery; on its own it does not separate the figure from the grass.
- **Stronger contrast** — clear gain: the dark uniform stands off both the mid-olive grass and the tan trail, and the lighter webbing reads as straps at max zoom. At game size it reads as a dark figure rather than a pale smear.
- **Accent band** — **no visible effect.** The mask is correct (white, held out behind the body) but the helmet band covers about 23 render px ≈ 1 world px² at game size; the shoulder patch is on the far (left) shoulder and is hidden when walking right. The existing accent geometry cannot carry identity at 44 px.
- **Identity marker** — carries identity at both sizes without touching the boots: a 7 px pip above the helmet.
- **Subtle outline** — the largest single gain: the silhouette, legs and stride read at game size on grass and on the trail, without lines inside the figure.

Verdict: **contrast + marker + outline make the soldier easy to find at game size; warm light is a modest consistency gain; the accent band is too small to matter.** The combined look is a candidate, not approved art.

**Frame selection** (`readability-stats.json`, `framerule-stance.png`, `framerule-12s.webm`). Measured deterministically over a full walk and stop (1/240 s steps, flat-planted feet only): the drawn planted boot versus its true planted position (depth at the continuous phase), in world px.

| Rule | Mean error | Max error | RMS | Creep within a stance (peak-to-peak, mean / max) |
|---|---|---|---|---|
| Floor (`animation.js` today) | **+0.456** (steady lag) | 0.918 | 0.528 | 0.901 / 0.985 |
| Nearest | **0.018** (centred) | 0.458 | 0.263 | 0.906 / 1.070 |

Nearest-frame removes the half-frame lag and halves the positional error, but **does not remove the snapping**: the boot still creeps by one frame's travel (22/24 = 0.92 px) and snaps back within each stance — visible at 6× in `framerule-stance.png` and at real speed (1.5 screen px at max zoom) in the 12 s clip. Removing that needs more frames per cycle or sub-frame offsetting, not a different rounding.

## Evidence (`art/review/blender-walk-06/`)

| File | What |
|---|---|
| `readability-normal-size.png` | All six cumulative variants at game size (zoom 1) on trail node t3: stance, heel-off, swing, idle; 1:1 and 3× without smoothing |
| `readability-max-zoom.png` | The same at max zoom (1.6), 1:1 and 2× |
| `readability-20s.webm` | Real speed: current vs readable (warm + contrast + accent + marker + outline), game size and max zoom |
| `framerule-12s.webm` | Real speed, max zoom: floor vs nearest, readable look |
| `framerule-stance.png` | One flat stance in 0.75 px steps, both rules, crops centred on the true planted spot (red line), 6× |
| `readability-stats.json` | The error/creep table and constants |
| `frames-warm/`, `frames-warm-contrast/` | The Blender variant frames (+ accent masks), each with `projection.json` and the motion report |

Regenerate: `blender --background <walk-study-05>/soldier_walk_study.blend --python tools/blender/render_game_projection.py -- --output <new dir> --look warm|warm-contrast [--accent-mask]`, then `node tools/capture-blender-readability.cjs`.

## Suggested next steps (for Codex to choose)

1. Adopt contrast + outline + marker as the preview's working look and decide the accent route: a larger helmet cover/band or a patch on the near side per direction (art), or keep identity in the marker.
2. If boot snapping matters, test more frames per cycle (e.g. 32 or 48) against file size, keeping nearest-frame selection.
3. The figure remains narrow side-on (8 px standing); this task deliberately did not widen it.

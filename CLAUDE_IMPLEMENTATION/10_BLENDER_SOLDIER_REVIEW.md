# Blender soldier appearance study 01 — local run and review

Claude, 1 October 2026, on `main` after 5887849. Answers [10_BLENDER_SOLDIER_STUDY.md](10_BLENDER_SOLDIER_STUDY.md). **This is an appearance study, not game art**: nothing is in the asset manifest or offline cache, there is no rig or animation, and the walk release gate is unchanged (blocked). The `.blend` files stay local in `art/local-blender/` (gitignored).

## Run

- **Blender 5.2.2 LTS** (`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`), Windows 11, Cycles CPU, 32 samples, denoised.
- `blender --background --factory-startup --python-exit-code 1 --python tools/blender/build_soldier_study.py -- --output art/local-blender/soldier-study-02 --samples 32`
- Exit code 0. Scene build about 10 s; each 1024 × 1536 render 17–25 s (about 1.5 min for all four). No errors.
- Two `DeprecationWarning`s: `Material.use_nodes` and `World.use_nodes` "expected to be removed in Blender 6.0". Harmless now. Node trees are the default in 5.x, so these two lines can be dropped before Blender 6.

### Fixed: the "right" view showed the left side

The soldier faces −Y with anatomical right on −X. The camera for `right.png` was placed at +90°, so it looked at the soldier's **left** side with him facing screen-left (the left-shoulder accent patch faced the camera). The game's "right" view shows the soldier facing screen-right with his **right** side to the camera. The view is now −90° (`tools/blender/build_soldier_study.py`); the re-rendered `right.png` faces screen-right and hides the left-shoulder patch. No model geometry was changed.

## Evidence (`art/review/blender-soldier-01/`)

| File | What |
|---|---|
| `front.png`, `right.png`, `back.png`, `three_quarter.png` | The four transparent renders from run 02 (`study-report.json` alongside) |
| `turnaround.png` | All four on a neutral backdrop on one ground line |
| `three-quarter.png` | The three-quarter view alone on a neutral backdrop |
| `face-closeup.png` | Front and three-quarter heads at 2× |
| `silhouettes.png` | The four views as flat silhouettes |
| `game-size-44px.png` (+ `-1x`) | The front and three-quarter views scaled to a 44 px figure on the game's grass, next to the live game's soldier and the painted down master at zoom 1, enlarged 4× without smoothing. Appearance comparison only: the study camera is a standard 35° orthographic view, not the game's projection |

Regenerate with `node tools/blender/compose-soldier-review.cjs art/local-blender/<study> art/review/<dir>`.

## Measured model (from the `.blend`, metres)

- Height 1.889 (sole to helmet top); head base 0.25 tall: **7.6 heads**, a natural adult proportion, not a toy head.
- Legs (crotch about 0.86) 45% of height; belt/waist 1.09 (58%). Pelvis is over the feet; knees straight; no squat.
- Garments: tunic+sleeves 17,924 vertices, trousers 16,332 (voxel remesh, as the handoff says: not animation topology). 43,320 vertices in total.

## What works

- Upright, natural standing posture; pelvis over the feet; relaxed arms; no detached ball joints; the head is not oversized.
- Clearly a helmeted soldier in olive with webbing, belt and pouches; readable from all four sides.
- The helmet sits above the ears and the eyes are below its rim. The accent band and shoulder patch are separate, editable materials.

## Problems to fix before judging style (exact numbers)

1. **Arms too wide, thick and short.** Sleeve radius 0.08–0.10 m at the upper arm (a real upper arm with a sleeve is about 0.06). The arms hang at x ±0.34, giving an outer width of 0.79 m (a real shoulder breadth is about 0.46–0.50), and the shoulder rings (radius 0.09/0.10 centred at x ±0.24) make humped, padded shoulders. Fingertips end at z 0.87, about crotch height; for this height they would reach mid-thigh, about 0.74. Suggest arms at x ±0.26–0.28, sleeve radius 0.055–0.07, and about 0.13 m more arm length.
2. **Wrist cuffs are square plates.** Each cuff is a box 0.12 × 0.135 m on a sleeve of radius 0.055/0.06, so it sticks out 5–8 mm all round as a flat flange. Very visible in the silhouettes. Use a ring (loft) instead of a box.
3. **Helmet brow rim reads as a cap visor.** It is a flat box 0.22 × 0.055 × 0.015 m projecting from the front only (y −0.127 to −0.073). Suggest a continuous, slightly flared lip all the way round the shell, or no separate rim.
4. **The belt is hidden inside the tunic.** Belt radii 0.179/0.127 at z 1.075–1.105, but the tunic is 0.19/0.13 at z 1.06, so the belt only shows where the tunic recedes: a crescent "smile" across the back. Make the belt larger than the tunic there (about 0.195/0.137) or move the tunic hem above it.
5. **Thigh pockets read as holsters.** Boxes 0.065 × 0.15 × 0.17 m at x ±0.19 stand about 0.03 m proud of the trouser silhouette as flat panels. Make them thinner (≤ 0.015 proud) and follow the leg.
6. **Chest opening seam breaks into slits.** It is a straight line from (0, −0.139, 1.42) to (0, −0.111, 1.18) while the chest front curves (−0.135 at 1.43, −0.14 at 1.32, −0.105 at 1.17), so it dips inside the surface and shows as two dark slits. Give it points that follow the surface, or drop it.
7. **Hands are plain balls** (0.096 × 0.08 × 0.146 m ellipsoids, no thumb). At 44 px a hand is about 3 px, so a simple mitten with a thumb is enough; at close range the balls read as toy hands.
8. **Boots are blobs.** The toe ellipsoid (0.14 m wide) overhangs the sole by 22 mm (front y −0.212 vs sole −0.19), and the sole is a flat slab. Extend the sole to the toe and lower the toe cap.
9. **Eyes sit on the face.** The eye whites stand about 13 mm in front of the face surface (front y −0.099 vs face −0.086), and the irises are low, so he looks down and slightly googly in close-up. At 44 px the face is about 5 px wide, so this mostly matters for portraits.
10. **Webbing harness top sinks into the chest** near the collar (its top point at y −0.104 is inside the chest surface at −0.135).

## Style at game size

At 44 px the study still reads as a soldier: helmet, olive uniform, belt line and boots are legible. Next to the painted master it is **paler and lower-contrast**: no dark outline, flat studio light (0.3 ambient, soft area lights) and desaturated olive. The painted master's chunky outline and warm upper-left light make it read at a glance on the grass. Whether the 3D route should copy that look (for example toon shading with an outline, warmer key light, stronger value contrast) is a style decision for Jason before any rigging.

## Questions for Jason

1. **Silhouette:** is a natural, upright, realistic-proportioned soldier (7.6 heads) the right direction, compared with the chunkier painted master? Should the arms and shoulders be slimmed as in point 1?
2. **Uniform detail:** keep the webbing harness, belt pouches and thigh pockets (fixed as above), or simplify for readability at 44 px?
3. **Face:** simple and friendly as here (after the eye fix), or closer to the painted portrait?
4. **Overall style:** soft 3D shading as rendered, or a painted/outlined look that matches the existing art?

My recommendation: **don't approve study 01 as it is**. The posture and proportions are a good base. Fix points 1–8 first, then decide on outline/shading against the 44 px comparison, and only then move to retopology, the skeleton and the first walk. The projection still needs calibrating to the game's equal-ground-axis view before any export (handoff, "Important projection and topology limits").

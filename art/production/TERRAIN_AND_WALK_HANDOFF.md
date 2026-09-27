# Terrain edges and first painted walk candidate

This second art batch is for the measured Gate 0 camera and 3 art pixels per world pixel. The terrain images are **prepared strips**, and the soldier is an **animation candidate**. Integrate a captured walk before promoting any animation.

## Terrain

| Export | Canvas | Edge row | Role |
| --- | --- | --- | --- |
| `assets/terrain/shore_edge_3x.png` | 384 × 142 | 114 | Grass/earth shoreline above existing brook or river water. |
| `assets/terrain/foam_rock_drop_3x.png` | 384 × 82 | 41 | Broken foam and small rock lip at the water line. |
| `assets/terrain/cliff_face_3x.png` | 384 × 184 | 12 | Upright rock wall below a cliff lip. |
| `assets/terrain/shore_corner_west_to_south_3x.png` | 256 × 256 | Corner (128,128) | Shoreline turns from a westward leg toward the south. |
| `assets/terrain/shore_corner_east_to_south_3x.png` | 256 × 256 | Corner (128,128) | Mirrored turn from an eastward leg toward the south. |

Each straight strip represents 128 world px in length. The left and right columns match pixel for pixel (the export script checks them), so repeated horizontal pieces meet without a hard cut. Their varying texture may still reveal repetition across a very long cliff: use authored polygon piece orientation and inspect a screenshot at zoom 1 and 1.6. `art/review/terrain-strips-v1-repeat.png` shows two adjacent repeats on neutral grass. The two corners are shaped for shoreline bends; the game should rotate/mirror them for turns while preserving the water mask. Keep the procedural water, do not stretch the foam over the full brook width, and ensure the walkable bridge stays dry at each abutment. `art/production/terrain-strips-v1.json` lists file sizes, edge rows and status; `python tools/prepare-terrain-strips.py` reproduces the exports from their transparent source images.

The cliff and shore repeat preview still has recognisable motifs because the source artwork contains large rocks. Treat the whole set as a **visual trial**, review it fitted to the actual contour, and keep procedural edges available for a quick comparison. The corner joins especially need an in-game screenshot before promotion.

## Soldier down-walk candidate

`art/rig/soldier_walk_down_painted_candidate.png` is a painted pass over Claude's gait template with six **256 × 384** cells, helmet near row 30 and feet alternating in frames 1 and 4. The companion `art/rig/soldier_walk_down_painted_candidate_accent.png` contains a white helmet-band/shoulder mask on the same grid. `art/review/soldier-down-candidate-1x.png` shows all six frames beside each other at about 44 world px tall. `python tools/prepare-soldier-down-candidate.py` reproduces the sheet from the source paint-over.

This candidate is **not registered and not yet approved**. Image generation changed exact foot coordinates slightly when repainting the source poses; the normalization script restores the common cell layout but cannot guarantee the template's precise 25-source-px planted-foot track. Claude should run `node tools/validate-assets.cjs --gait art/rig/soldier_walk_down_painted_candidate.png 6` locally, then use a 30-second game-size walk-and-interaction clip. Reject it if feet slide, body height bobs, the same soldier changes face/gear, or the accent drifts. Approve down before asking for up/right and visitor variants.

The built-in image tool produced the three transparent strip sources and a paint-over of the existing six-frame walk template; deterministic Pillow scripts crop, seam blend, normalize pivots and save the transparent exports. The terrain and character source images are under `art/production/source/`.

# Gate art review response — 27 September 2026

Read `CLAUDE_IMPLEMENTATION/07_GATE_ART_REVIEW.md` before integration. These files are **candidates** until Claude's captured game clip and screenshots pass. The running game currently uses the prior painted down walk; this export does not change the renderer.

## 1. Corrected painted down walk

Use `art/rig/soldier_walk_down_painted_v3.png`, six 256 × 384 transparent cells, with `soldier_walk_down_painted_v3_accent.png`. Both use ground pivot (128, 330), helmet row 30 and the same face, helmet, webbing and rifle as v2. `soldier_walk_down_painted_v3.json` records the new measured foot positions. The painted leg silhouettes differ in every frame; the minimum pairwise difference exceeded 12% in a local pixel check. The walk's planted sole moves **25, 25 | 25, 25** source px per adjacent frame, followed by a return to the other foot. The 1× strip is `art/review/soldier-down-v3-1x.png`.

The earlier frame-4 report of a trailing sole only 9 px above the planted one was an artefact of the half-cell measurement: the **planted right boot crossed x = 128**, so its left edge was mistaken for the trailing left sole. The visible v2 trailing left boot was already high. V3 shifts that planted boot a few source pixels right below the hip, allowing the same pixel probe to see the actual trailing sole **82 px above** the planted sole in frame 4 (row 288.5 vs 370.5). Frame 5's trailing sole is 37 px above. It also adjusts the planted rows to remove the last 1-world-px slip; the upper body and accent are unchanged. `python tools/refine-soldier-down.py` regenerates this sprite and its measured track.

**Validation:** Claude should run `node tools/validate-assets.cjs --gait art/rig/soldier_walk_down_painted_v3.png 6`, then capture the continuous 30-second game-size walk with the asset temporarily registered. Confirm grounded soles, no visible boot/skirt stretching and no upper-body shimmer. The local environment has no Chrome/Edge, so the browser-based validator and clip must run in Claude's environment; the in-repo smoke and render-data tests remain available locally.

## 2. Painted idle down

`art/rig/soldier_idle_down_painted_candidate.png` and `_accent.png` have two 256 × 384 cells and pivot (128, 330). Both boots stay on row 330 in both frames. The second frame expands the coat chest by about 1% for breathing; helmet, face, hands, rifle and boots remain steady. Source identity comes from v3 frame 3. `art/rig/soldier_idle_down_painted_candidate.json` records the feet. Compare both at 44 world px in `art/review/soldier-idle-down-1x.png`; regenerate with `python tools/prepare-soldier-idle-down.py`.

Try v3 down and this idle together in the game. Hold up/right and other character activities until the down/idle continuity clip is approved.

## 3. Side cliff and caps

`assets/terrain/cliff_side_face_3x.png` is a 384 × 183 transparent trial strip at 3 art px/world, **top edge row 12**, horizontally repeatable every 128 world px. `cliff_side_cap_left_3x.png` and `cliff_side_cap_right_3x.png` are separate 152 × 183 transparent ends with the same edge row; overlap their straight joins with the strip by approximately 15 art px. Exact paths, sizes and edge rows are in `art/production/cliff-side-and-rest-v1.json`. `art/review/cliff-side-and-rest-v1.png` shows two repeats and both caps at source scale. Run `python tools/prepare-cliff-side-and-rest.py` to regenerate from the source paintings.

Trial these on the short outcrop at the gate spur where a front-facing painted cliff currently meets procedural grey side columns. Keep the earlier long north-cliff strip on camera-facing segments. Inspect a 1× and 1.6× contour screenshot: cap colour and moss joins are candidates, and the strip itself cannot fix diagonal banks if draped into a thin line. Keep the procedural fallback for steep river edges.

## 4. Closed boom receiver and gate prop spacing

`assets/props/gate_boom_rest_post.png` is a fixed 50 × 74 px transparent fork. Ground pivot **(25, 70)**; fork seat **(25, 20)**. Suggested world ground **(39, 588)**. This is six world px north of the earlier rough `(40, 594)` suggestion: with the currently rendered boom pin 19 world px above hinge ground (40, 632), its closed tip projects near world `(39, 571)`. A fork 50 art px above ground at world y 588 puts its seat at y ≈ 571.3. Register the post as a separate static object; do not rotate or animate it. Capture the closed and swinging poses to verify the tip actually rests in the fork and neither blocks the visitor stop at (20, 611).

To reduce the crowded gate row, move the existing `scene_fence_post` from `(64, 656)` to **(76, 682)**. The exact proposed position passed `validateScenePropPlacements` against the current map in a local VM check, preserving clearance from trails, terrain, zones and the other props. Check visual spacing in the same gate capture.

The new cliff and fork sources were generated as isolated transparent raster art with warm upper-left lighting. The character refinements and exports are deterministic corrections of the painted master. None of these assets are yet production.

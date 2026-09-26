# Visual handoff after Brief 04

Compare `art/review/base-built-field.webp` with `art/concepts/terrain-shaped-base.webp` at the same screen size. The live field is still a mostly flat, rectangular meadow with a horizontal main road, repeated small rectangular building silhouettes and black label bars. The concept has a terrain-shaped footprint, stepped cliffs and river edge, larger recognizable buildings, paths curving through build sites, and visibly occupied facilities. The gap is composition and rendering scale as much as individual textures. The new `art/explorations/river-cliff-edge-study.webp` is an **unintegrated scene module study** for the south/east map edge. Its painted trail conflicts with the current authored path graph; split or redraw terrain, cliff and water separately before integration. Do not paste it as a background or move buildings onto inaccessible land.

## Movement finding and immediate change

`js/render.js` previously moved an unanimated whole-person still upward by up to 1.5 world pixels while leaving its contact shadow on the ground. This made a walking person float. The vertical bounce is removed in this handoff; the feet stay at `unit.y`. Movement will look like **grounded sliding** until actual authored walk cycles exist. `js/animation.js` already plays distance-driven frame strips, but the walk entries in `js/asset-manifest.js` are `missing`.

## Soldier art attempt, rejected

`art/explorations/soldier-down-walk-rejected.webp` used the in-game range and firing character as visual references. It improves the three-quarter camera and silhouette match over the previous side-profile study. Yet all six leg poses and rifle positions are near duplicates. It fails the distinct-phase requirement in `art/CHATGPT_FEEDBACK.md`; **do not crop it into six frames or list it as production**. A six-cell grid or alpha cleanup cannot manufacture missing gait phases. The complete character set also needs down/up/right walk and idle, matched fire/rest/eat, and an identity accent mask. The prompt printed below must be interpreted as a specification for controlled frame-by-frame drawing/rigging and visual review, not proof that a single image generation will satisfy it.

## Next reviewable slice for Claude

1. Keep the bounce removal and verify a 30-second recruit-to-range capture: feet should remain on shadows, and the caption should say this is a still-pose fallback.
2. For the map, compose one **960 × 576 gameplay screenshot** with the gate, entrance, barracks and range at a scale where people/stations remain legible. Preserve `WORLD` graph and save migration. Replace the flat fence rectangle and road bar with authored cliff/river edges, irregular clearing boundaries and curving paths. Adjust label treatment so the buildings remain visible. Compare at identical viewport and camera zoom with `terrain-shaped-base.webp`; retain room for future zones. Treat `river-cliff-edge-study.webp` as a style/shape reference, not drop-in geometry.
3. For a true walk cycle, use a single consistent character master with a rig, hand-drawn successive frames, or another controlled process that can guarantee planted alternating feet. Start with **one six-frame down strip** and its corresponding idle, produce 256 × 384 boxes with baseline row 368, verify on a checkerboard and in a loop at 44 world px. Reject repeated phases before creating the other directions. Match the firing kit and keep effects separate. Only mark production in the manifest after `node tools/validate-assets.cjs` and a continuous capture pass.

The next merged screenshot and walk clip, rather than a new standalone concept painting, determine whether the visuals are closer to the intended game.

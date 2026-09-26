# Artwork delivered for Claude's next visual pass

This set is available on `main` for inspection; adding source art to Git does not make it visible in the game. It was generated against the existing range art's three-quarter camera, warm upper-left light and dark illustrated outline. `art/CHATGPT_FEEDBACK.md` remains the integration contract. The source artwork uses genuine transparency but may have semi-transparent interior pixels; `prepare-art` must clean those before export.

| Role | Source | Current status | Integration work |
| --- | --- | --- | --- |
| Riverbank and cliff edge | `art/explorations/river-cliff-edge-study.webp` | Composition study | Separate cliff, bank, water and vegetation from painted trail; register to `WORLD.terrain` polygons and show in the camera. |
| River crossing | `art/explorations/bridge-crossing-study.webp` and `art/concepts/bridge-only-study.webp` | Scene + isolated bridge studies | Fit isolated bridge to two bank anchors, separate its rails for unit occlusion, and add a valid graph crossing if walkable. Never stack the scene-study water over rendered river. |
| Weight room | `art/concepts/weight-room-study.webp` | Building study | Four visible equipment slots; split back/floor, canopy and foreground walls; footprint and entrance review. |
| Obstacle course | `art/concepts/obstacle-course-study.webp` | Outdoor station study | Four visible distinct obstacles; separate front vault wall, crop ground footprint, map activity anchors. |
| Drill yard | `art/concepts/drill-yard-study.webp` | Outdoor station study | Dummy and ring slots; separate front fence, fit irregular footprint. |
| Showers | `art/concepts/showers-study.webp` | Cutaway study | Four stalls; split back/floor, roof and front partitions, confirm privacy/visibility at game size. |
| Rec room | `art/concepts/rec-room-study.webp` | Cutaway study | Two table groups; split rear, roof and front rail, review seating anchors. |
| Gate | `art/concepts/gate-kiosk-separate-study.webp` and `art/concepts/gate-boom-separate-study.webp` | Separate source studies | Kiosk needs back/front occlusion split. Crop boom as one rigid piece, register a stationary hinge with kiosk, then rotate boom; retain single walkable checkpoint. |
| Scenery props | `art/concepts/props-structures-study.webp`, `art/concepts/props-landscape-study.webp`; nine exported PNGs under `assets/props/scene_*.png` | **Nine usable static cutouts, unplaced** | `art/production/scene-props.json` has pixel sizes and ground pivots. Place via seeded, clearance-aware scenery; compare against procedural props, avoid double-drawing. Three touching cell boundaries remain source studies only. |
| Soldier walking | `art/explorations/soldier-down-walk-rejected.webp` | **Rejected** | Six apparent frames repeat the same gait. Use controlled frame drawing/rigging; then build down/up/right and coherent idle/activity and accent masks. |
| Meadow/path and river/cliff transitions | `art/concepts/terrain-meadow-path-edge-study.webp`, `art/concepts/terrain-river-cliff-edge-study.webp` | Unregistered terrain studies | Fit to authored edge geometry, remove visible coloured alpha fringes, cut into compatible segments, test seams and occlusion at default and 1.6× zoom. These are not seamless tiles. |
| Activity equipment | `art/concepts/activity-props-study.webp` | Source sheet | Target, hit plate, barbell, bench, front rail and kettlebells require individually cropped clean alpha. Several drawings touch cell borders: do not slice as a blind 3×2 grid. The bench rail must overlay seated people. |

## Proof before promoting a study

For each facility, register its source crop, world pivot, entrance, activity slots, supported zone orientation and front occluders in `js/asset-manifest.js`. Export distinct transparent back/roof/front pieces where units enter, run `node tools/prepare-art.cjs` and `node tools/validate-assets.cjs`, and compare its real 44-pixel people in a 960 × 576 capture. For the terrain kit, verify `validateWorld()` still holds and that new draw layers do not cover moving units. For walking, inspect a continuous 30-second clip at default zoom: at least six distinct planted-foot poses per direction, unchanged kit and baseline, no whole-body bob, no flicker or skating.

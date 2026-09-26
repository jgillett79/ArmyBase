# Claude brief 03 — terrain, layered facilities and build controls

Start from merged briefs 01 and 02. Read the shared zone, path and slot contracts; the current canvas and HTML UI; `DESIGN.md`; and `art/concepts/`. The existing `art/concepts/terrain-shaped-base.webp` is a mood/composition reference, not a background to paste under a moving game.

## Deliverable

Render the larger world under a camera with bounded pan and modest zoom; pointer, touch and selection use inverse camera coordinates. Draw non-grid terrain masses, water/cliff boundary, vegetation and irregular clearings in a readable three-quarter view. Paths follow the world graph, appear when connected, and align with actual movement. Construction reveals its footprint and spur; no repeated rectangular vacant-lot picture. Seed decorative placement for stability and keep props out of entrances/lanes.

Implement a building draw contract supporting separate ground, rear, foreground/roof and shadow layers. Sort people/props by ground-contact Y within the correct layer; make activity slots visible at gameplay zoom. For open training, the player sees the soldier inside the station. For an indoor facility, reveal an appropriate cutaway/foreground treatment while occupied or selected. Preserve unit click/touch hit testing and roster fallback. A small build menu can select an authored zone and valid building type with a ghost preview, affordability message and visible construction feedback. The current economy still controls purchase.

Keep the app's no-bundler vanilla JS structure unless a measured constraint forces a build-tool proposal; if so, justify it before broad conversion. Keep rendering smooth with 20 soldiers and avoid recalculating static terrain geometry every frame. Add a scene debug toggle for zones, graph and slot anchors; default it off in production.

## Proof

- Provide actual 960 × 576 captures for fresh, partially built and expanded bases, plus a portrait-phone view. Terrain and buildings must not read as three uniform rows.
- Provide a 30-second continuous clip showing a civilian admitted and two soldiers reaching different range slots. No people on roofs, path cutting across water, pointer misalignment or disappearing beneath wrong walls.
- Check scroll/zoom/selection/build on mouse and touch; run smoke tests and inspect browser console. Clearly list any art that remains temporary so brief 04 can replace it.

# Brief 03 handoff — camera, layered facilities, build controls (for brief 04)

Sources: `js/camera.js`, `js/scenery.js`, `js/render.js`, `js/main.js` (the build & upgrade and map view sections), `tools/browser-capture.cjs`.

## View

- **`Camera`** (`camera.js`) is pure math:
  - It stores `x` and `y` (world coordinates at the top-left of the view), `zoom`, and `viewW`/`viewH` in CSS px.
  - Zoom is bounded between `minZoom` (the whole 1600 × 960 world fills the view) and `CAMERA_MAX_ZOOM` (1.6).
  - The home view is 1:1 on desktop, centred on gate, hall, Barracks and range. Viewports narrower than 600 px open at `viewW / 520`.
  - Every hit test goes through `screenToWorld()`.
- **Canvas size:**
  - Desktop is 960 × 576 CSS px, with the backing store scaled by `devicePixelRatio` (capped at 2).
  - A portrait phone gets a taller canvas, up to 62% of the viewport height.
  - `touch-action: none` on the canvas.
- **Input** (`main.js`):
  - Pointer events handle mouse, pen and touch.
  - One pointer pans, two pointers pinch-zoom, and a press under 6 px of movement is a tap.
  - The wheel zooms around the cursor, and the +, − and home buttons sit over the map.
  - Tapping a soldier opens their profile, and tapping a visitor offers recruitment.
  - Tapping an indoor facility lifts its roof.
  - A roster card centres the camera on that person.
- **Units' `x`/`y` is their ground-contact point (feet).** Sprites are drawn above it, and depth sorting and hit boxes use it.

## Render order (`renderFrame(ctx, state, selectedUnitId, view)`)

1. Static layer (`scenery.js`). It is painted once at 1.5× into an offscreen canvas and repainted only when the set of visible or built zones changes (or a texture loads). It contains:
   - meadow and tonal variation
   - water with bank, rim and ripples
   - cliffs and rocks with a camera-facing face
   - clearings: full apron if built, dashed outline and pegs if surveyed
   - trail plus visible spurs
   - rocks, tufts and fences
2. Gatehouse (interim single sprite).
3. For each facility, in order of footprint bottom edge: **shadow**, then **back**.
4. **People and trees depth-sorted by ground y** and culled to the view. Activity cues are drawn with the person.
5. For each facility: **front**, then indoor occupancy badges.
6. Build-mode overlay and the debug overlay (`?debug=scene` or the G key: zones, graph, nodes, slots with red = reserved, queue spots, entrances).
7. Clock, in screen space.

The facility contract (`FACILITY_ART` in `render.js`) sets `kind: 'open' | 'indoor'`:

- **Open:** the entrance hall porch, range, obstacle course and drill yard. Occupants are always drawn.
- **Indoor:** the barracks, mess, showers, rec room and weight room. Occupants are hidden under the roof, and a count badge shows how many are inside. While a building is revealed (tapped, or it holds the selected soldier), it draws a floor, the lower 38% of the sprite as low walls, the people, and a front rail.

`facilitySpriteRect()` is the interim placement: the sprite is fitted to the zone width and grounded on the footprint bottom. **Brief 04 should replace this with manifest-driven pivots and real split layers (`shadow`/`back`/`front`) behind the same calls.**

## Build and construction

- **`GameState.zonePlacementState(building, zoneId)`** returns `current`, `free`, `swap` or `blocked`.
- **`placeBuilding()`** swaps an unbuilt facility off a chosen site onto a legal free site. Built facilities never move.
- **`constructAt(key, zoneId)`** places, then buys through the unchanged purchase methods.
- **`constructionPrice()` and `constructionShortfall()`** give the price and a "Need …" message.
- **`building.constructedAt`** is runtime only. It drives the 1.6 s scaffold/dust/rise animation for builds and upgrades.
- **UI flow:**
  - An unbuilt facility's button opens build mode. The camera fits the world, legal sites pulse green and blocked sites show red dashes.
  - A tap or click picks a site and shows a ghost, tinted red if it's unaffordable.
  - "Build here" confirms, and Esc or Cancel exits.
  - Later levels upgrade in place as before.

## Proof and review tooling

- `node tests/render-data.cjs`: camera inverse/anchor/bounds, seeded scenery clearances, placement and swap rules, and placement surviving save/load.
- `node tools/browser-capture.cjs <baseUrl> <outDir> --clip`: headless Edge/Chrome.
  - Screenshots: fresh, partial, build preview, constructing, expanded, portrait phone.
  - A 30 s WebM of the canvas plus a contact sheet.
  - Mouse and touch selection after zoom/pan, build flow and affordability checks, console errors and frame time.
  - Results are in `docs/brief03-browser-checks.txt` and `docs/screenshots/brief03-*`.
- **Known automation gap:** headless Edge only sometimes dispatches synthetic wheel input to the page. The tool therefore checks the wheel handler with a dispatched `WheelEvent` and the zoom buttons with real clicks. A physical mouse wheel remains a manual check.

## Art that is still temporary (brief 04)

- **Buildings:** all nine sprites are single bitmaps. Four (entrance hall, barracks, range, mess) are the organic set. The weight room, obstacle course, drill yard, showers and rec room are the older style and visibly clash.
- **Gate:** the old gatehouse bitmap. It has no animated arm and no split layers.
- **Terrain:** cliffs, rocks, water, trees and props are procedural. The grass and apron are the existing textures.
- **People:** directional stills with a hue tint and a small bounce. There are no walk frames and no activity poses. The activity cues (muzzle flash and hit, bar lift, droplets and so on) are interim icons around the figure.
- **Range slot anchors:** in `world.js` they are aligned by eye to the interim range sprite. Re-register them from the art manifest.

# Gate 0 — baseline and visual contract (27 September 2026)

Claude's Gate 0 deliverable from `FIRST_BASE_DELIVERY_PLAN.md`: the current game captured at 960 × 576 and on a portrait phone, one target composition with the real zone boxes, and the exact numbers the next art exports must hit. Everything below is measured from the running game by `node tools/capture-gate0.cjs` (full data: `docs/screenshots/2026-09-27-gate0-contract.json`). Gate 1 changes that the contract depends on (brook, bridge, kiosk space, props) are already committed, so the numbers are the live ones.

| File (`docs/screenshots/2026-09-27-gate0-…`) | What it shows |
| --- | --- |
| `before-960x576.jpg`, `before-phone-portrait.jpg` | The game as pulled from `main` (Gate 0 baseline) |
| `fresh-960x576.jpg` | A new game at the default camera, after Gate 1 |
| `target-960x576.jpg` | The target scene, run by normal game rules: gate, bridge, Entrance Hall with a waiting visitor, two soldiers on the two range mats, a soldier crossing the bridge, Barracks |
| `contract-960x576.jpg` | The same frame with zones, art boxes, doors, slots, bridge ends, checkpoint anchors, props and a 44 px person ruler, labelled in world px |
| `phone-portrait.jpg` | The target scene on a 390 × 844 phone |

## Baseline findings (what Gate 0 found wrong)

1. **The gate and the river cannot share a frame.** The gate is at world x 40 and the river starts at x 1330. At the default zoom a 960 px view can never show both, so the plan's "gate, river edge, bridge" screenshot was impossible. **Resolved in Gate 1:** a brook runs from the cliff spur to the pond just inside the gate, with a real bridge on the gate trail. Every visitor and every departing squad crosses it. The river is still east, with no bridge: a crossing there would be a second way in, against the single-gate rule in `CLAUDE.md`.
2. **The bridge study's axis doesn't fit.** `art/concepts/bridge-only-study.webp` runs diagonally from lower-left to upper-right. The game is not isometric: 1 world px = 1 screen px on both axes, and heights are drawn straight up. The gate trail crosses the brook west to east, so the bridge must be **redrawn as a straight west–east crossing** seen from the south. Don't rotate or skew the study.
3. **A lifting boom doesn't read in this camera.** A boom lying north–south across a west–east trail and a boom raised vertically both show as a vertical bar on screen. The checkpoint therefore uses a **swinging** boom, which is also exact under 2D rotation (below).
4. **There was no room for a kiosk.** The cliff spur's foot left only 26 world px between cliff and trail. Gate 1 pulled the foot back and reserved a validated 44 × 38 footprint.
5. **Slots crowd in the provisional art.** At its game scale (0.13 world px per source px), the Barracks study's six bunk anchors all fall within about 21 world px of each other. Six sleepers would stand on one spot, since a person is about 29 px wide. The range's four lane anchors behind the two mats are 13–17 px apart. The two mats themselves are fine (52 px apart). Both are Gate 3 art fixes: stations need about 30+ world px spacing.
6. **Labels printed over each other** when soldiers stood together (range mats, the phone view). Fixed in Gate 1: labels are drawn last and step apart.
7. **Five facilities are old-style art, and nothing is animated.** This is already known from the asset list and is unchanged.

## Camera and scale

- **Projection:** top-down oblique. World px map 1:1 to screen px at zoom 1 on both axes; a thing's height is drawn straight up the screen from its ground point. Light comes from the upper left. The renderer draws contact shadows, falling lower-right.
- **World:** 1600 × 960. **Desktop home:** 960 × 576 view, zoom 1, centre (430, 480), showing world x 0–960, y 192–768. **Phone home:** 390 × 552 canvas, zoom 0.75, centre (270, 540). Zoom range is 0.6 (whole map on desktop) to 1.6.
- **People:** 44 world px from sole to helmet top. Walking speed is 30–46 world px/s. One walk cycle covers 22 world px, so a 6-frame cycle plays at 8–12 fps and each frame advances 3.67 world px.
- **Export density: 3 art px per world px** (max zoom 1.6 × a 2× phone). A person is 132 px tall in exported art and a door about 170 px (1.3 × a person). Sources may be larger; state their px-per-world-px.
- **Character source cells** (unchanged): 256 × 384, body centred on column 128, ground point under the body on row 330, helmet top near row 30. That makes 300 source px = 44 world, or 6.82 source px per world px. The forward foot of a down-walk may reach row 368.

## Target scene contents (desktop frame x 0–960, y 192–768)

| Element | World geometry |
| --- | --- |
| Gate (fence gap) | `gate` node (40, 610); visitors spawn at (−40, 610) and cross to `gate_inside` (120, 612) |
| Brook | `brook_gate`, from the cliff spur foot (≈ 100–150, 516–540) to the pond at (160–198, 840–852); 54 px wide at the bridge |
| Bridge | Below |
| Entrance Hall | `zone_reception`, footprint x 160–352, y 402–548; door (256, 562) |
| Shooting range | `zone_west_rise`, footprint x 276–498, y 220–378; door (392, 392) |
| Barracks | `zone_centre_knoll`, footprint x 622–790, y 400–520; door (705, 534) |
| Props | 8 of the 12 placements (lamp, fence, post, noticeboard, moss rock, flower grass, signpost, vehicle) |

## Bridge — `bridge_gate` (export for the next round)

- Deck centreline from **west (134, 613) to east (222, 615)**: 88 world px long and 28 wide (half-width 14). The brook runs underneath from about x 150 to x 204; both deck ends sit on dry bank.
- The rail stands 18 world px above the deck edge. The near (south) rail is the front layer, at depth y 629.
- **Two same-size PNGs, 360 × 216 px** (3 px/world; the canvas covers world x 122–242, y 578–650):
  - `bridge_gate_back.png`: stone abutments, trestle legs into the water, the plank deck and the **far** rail. No water.
  - `bridge_gate_front.png`: the **near** rail and its posts only, transparent elsewhere.
- **Pivots:** west deck end at pixel (36, 105), east deck end at (300, 111). The game pins these to the two world points; nothing else is needed. The entry already exists in `ASSET_MANIFEST.bridges.bridge_gate` (status `missing`), and the procedural bridge is used until then.
- Water is the game's. The brook needs the same shore-edge and foam kit as the river (see the terrain kit), not baked water.

## Gate checkpoint (`WORLD.checkpoint`)

- **Kiosk footprint** x 48–92, y 552–590, north of the trail, with its service window facing south toward the trail and the camera. Ground pivot (70, 590). Suggested canvas: world x 40–100, y 490–596, which is **180 × 318 px** with the pivot at (90, 300). Deliver two layers on the same canvas, `gate_kiosk_back.png` and `gate_kiosk_front.png`; the front holds only what a guard stands behind.
- **Boom: swings in the ground plane.** The hinge's **ground point** (the post's foot) is south of the trail at **(40, 632)**; the pin is at the post's height above it, and the boom is 42 world px long. Closed, it points north across the trail (to (40, 590)); open, it lies east along the trail edge (to (82, 632)). Deliver `gate_boom.png` drawn **horizontal, pointing right**, at waist height (about 16 world px up), plus `gate_boom_post.png` (the fixed hinge post, never redrawn). Give the hinge-pin pixel in both. The game rotates the boom about the pin, and a thin striped pole stays correct under that rotation.
- **People anchors:** the visitor pauses at (20, 611), outside the closed boom (changed during integration; see `07_GATE_ART_REVIEW.md`), and the guard stands at (96, 598) at the trail's north edge. The visitor/guard greeting poses face each other left and right.

## Facilities in the target scene

Placement rule: a facility's ground pivot goes on the zone's **art anchor**, which is at the footprint centre x and the footprint's bottom − 6. Its width is 1.1 × the zone width. For each export at 3 px/world, the **pivot is at the horizontal centre**, and the positions below are **pixel offsets (dx, dy) from that pivot**; negative dy is up/north. A slot is where a person's feet go.

| Facility (zone) | Export width | Anchor (world) | Footprint in px from pivot | Door | Stations |
| --- | --- | --- | --- | --- | --- |
| Entrance Hall (`zone_reception`) | 634 px | (253, 542) | x −280…296, top −420 | (8, 60) | 4 waiting chairs: (−142, −90), (−52, −72), (68, −72), (158, −90), facing down |
| Shooting range (`zone_west_rise`) | 733 px | (385, 372) | x −326…340, top −456 | (22, 60) | 2 mats in use now: (−121, −181), (26, −123), facing up toward targets up-right. Level 2–3 lanes need about 90 px spacing; the current lanes are 40–50 |
| Barracks (`zone_centre_knoll`) | 554 px | (704, 514) | x −246…258, top −342 | (3, 60) | 6 bunks at the zone's anchors: (−108, −84), (−24, −66), (60, −66), (144, −90), (−72, −204), (108, −204), sit/lie facing down, with a near bunk-front layer |

The doors sit just below the footprint (dy = 60 means 20 world px south of the anchor). Enclosed buildings put their door on the south edge. Deliver the `back`, `roof` and `front` layers on one canvas, and list any station you move in px. Claude re-registers from your numbers. The zones for the other six facilities are in the JSON (`zones[].artAnchor`, `artWidthExportPx`, `slots`), and the same rule applies.

The uniform swap for a recruit happens at the **Barracks door** (705, 534), where it already happens in the simulation. The Entrance Hall needs chairs and a counter, not a changing point.

## Character contract for Gate 2

Approve the **down** set first, then derive the rest from the same master.

| Sheet (256 × 384 cells, left to right) | Frames | Contact rule |
| --- | --- | --- |
| `soldier_walk_{down,up,right}` | 6 | Planted foot moves 25 source px per frame; the front foot alternates between frames 1 and 4; every frame pair differs by ≥ 12% in the legs (the `--gait` check) |
| `soldier_idle_{down,up,right}` | 2 | Feet fixed on the ground row |
| `soldier_fire_up` | 4 (ready, aim, recoil, recover) | Back view aiming up-right. No flash (the game draws it). Feet identical across all 4 frames |
| `visitor_{civilian,bus_rider,taxi}_walk_{down,up,right}` | 6 | As for the soldier |
| `visitor_*_sit` | 1–2 | Seated on a chair, front view. The chair is part of the Entrance Hall, not the frame |
| `visitor_*_greet_right`, `guard_greet_left` | 2 each | Checkpoint pause |
| `*_accent` for every sheet | Same grid | White helmet band / shoulder patch on transparent |

`art/rig/soldier_walk_down.png` is a gait-validated pose template for the down walk; painting over it keeps the proven foot track. **Nothing becomes production from a pose study.** It needs a continuous 30-second game-size clip showing planted steps, visible range use in two slots at once, and a reload, per the plan's Gate 2 check.

## Terrain kit (Gate 1, still missing, art-blocked)

The river, cliff and path edges are still procedural (`js/scenery.js`). The next export should be a **shore-edge strip**, a **foam/rock-drop strip** and a **cliff-face strip**, all seamless horizontally at 3 px/world with the edge line on a stated row, plus **two corner pieces**. The game lays strips along the authored polygon outlines, so fitting depends on those strips, not on a painted scene. The two terrain studies are not tileable, so they remain references.

## Promoted this round

The nine `assets/props/scene_*.png` are placed at 12 authored spots as **provisional**, not production: they are cut at 1 px/world and go soft above zoom 1, so re-export them at 3 px/world. `prepare-art` writes `*-clean.png` copies. The soft-alpha check now judges pixels inside the body; the soft pixels are mostly anti-aliased rim, which the spec allows (≥ 94% rim for eight props; 75% for the fence, whose rail gaps are the next thing to clean). Nothing else was promoted.

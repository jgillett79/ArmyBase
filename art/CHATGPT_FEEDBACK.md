# Feedback and next art requests for ChatGPT

These notes are for the image model producing art for **Command Base**. They cover how the 26 September studies (`art/concepts/`) worked out when turned into game assets, what blocked each one, and exact specs for the next drawings. Every problem below was measured by `tools/validate-assets.cjs` or seen in the review sheets in `art/review/`.

## How the art is used

- **Camera and view.** The camera is a fixed three-quarter view from the south. The ground is an overhead plane. Warm key light comes from the upper left. The renderer draws contact shadows itself, falling lower-right.
- **Buildings.** Each building stands on an irregular "build zone" about 150–300 world px wide. At the default 1:1 zoom that is 150–300 screen px, and players can zoom up to 1.6×.
- **People.** A standing person is **44 world px** tall. People walk to specific **slots** in a facility (a firing mat, a bench, a bunk) and play an activity there. Other drawings show *where* those slots are, so stations must be clearly visible from the camera.
- **Soldier identity.** Up to 20 soldiers share one body design. Each one keeps an identity colour through idle, walk and activity.

## What worked well — keep doing this

- **Style.** The chunky three-quarter style, the dark outline, and the olive/teal/ochre palette all read well at game size. The range, barracks and mess hall are now in the game (`assets/buildings/*-study-v1.webp`).
- **Activity is visible.** The range's two covered stations with mats and the targets downrange are exactly what the game needs. So are the barracks' open bunk wing and the mess hall's open side with tables. People can be placed at those spots.
- **Transparency.** Backgrounds were genuinely transparent, with clear corners, which made cropping easy.
- **Firing poses.** The four poses (ready, aim, recoil, recover) are one consistent figure, with feet on the same line in every frame.

## Problems found, and what to do instead

1. **"Opaque" pixels were only 88–99% opaque.**
   - *Found:* almost every body pixel had alpha 224–254, never 255, in every study and in the older soldier sprites. On the game's terrain that reads as faintly see-through. The pipeline now forces them to 255.
   - *Do:* make everything inside the outline alpha **255**. Keep the background alpha **0**, with at most a 1–2 px anti-aliased edge.
2. **The muzzle flash was painted into a firing frame.**
   - *Found:* frame 3's flash had to be erased by hand, and its tail spilled into frame 4's box.
   - *Do:* **never paint effects** (muzzle flash, dust, sparks, steam, water) into character or building frames. If an effect is wanted, deliver it as its own small transparent image.
3. **Frames were not on a grid.**
   - *Found:* the four poses were spaced by eye across a 1983 px canvas, so they had to be cut into equal boxes manually.
   - *Do:* deliver **sprite sheets on an exact grid**. Every frame gets the same box size, and the feet touch the same pixel row in every frame (see the specs below).
4. **The firing soldier is a different character from the game's soldiers.**
   - *Found:* the study is a full-colour WWII-style infantryman. The game's walking soldiers are a different, greyish figure. Switching between them mid-activity visibly changes who the soldier is, so the poses are only a *candidate* (preview with `?art=candidates`).
   - *Do:* produce **one soldier archetype** whose idle, walk and every activity are drawn together, as one character in one kit.
5. **Tinting.**
   - *Found:* the game currently gives each soldier an identity colour by hue-rotating the whole sprite, which turns full-colour olive uniforms purple or blue.
   - *Do:* draw the uniform in its final olive colours. Deliver a **separate same-size mask image** of an identity accent (helmet band and shoulder patch) in plain white on transparent. The game will colour only the mask.
6. **Gate barrier baked in (`gate-intake-study`: needs regeneration).**
   - *Found:* the red-and-white arm is painted into the kiosk and the road, so it can't open. Faking it by stretching the picture isn't acceptable.
   - *Do:* deliver the layers listed under D below.
7. **Door and opening orientation.**
   - *Found:* the range's open side faces south-west, with the target berm to the north. It can only stand on sites entered from the south, and the map had to be re-laid to fit it.
   - *Do:* **every facility's entrance or opening faces the camera**: bottom edge, roughly bottom-centre.
8. **Baked ground rings and trees.**
   - *Found:* each building sits on a painted island of dirt, rocks, grass and even pine trees. The game already paints its own irregular clearing and trees, so the rings double up and fight the zone shapes.
   - *Do:* keep only a **small contact pad** (no wider than 5% of the building) and **no trees, no loose rocks** beyond it. Deliver props separately (see F).
9. **Scale between people and buildings.**
   - *Found:* at game scale a 44 px person matches the studies' doors well.
   - *Do:* keep doors about **1.3× a person's height**, and keep benches, bunks and mats sized for that person.
10. **Indoor buildings need a roof that lifts.**
    - *Found:* people inside the barracks or mess are hidden under one bitmap. The game fakes a cutaway by clipping the image, which looks crude.
    - *Do:* deliver indoor buildings as layers: **floor/back walls**, **roof** (its own image, same canvas), and **front walls/posts**. The front layer should hold only what stands in front of people.
11. **Mixed styles on the map.**
    - *Found:* weight room, obstacle course, drill yard, showers and rec room are still older, flatter art, and they clash next to the new studies.
    - *Do:* redraw them in the studies' style (see E).

## Deliverables and exact specs

Shared rules for every file:

- PNG with transparency.
- No text, logos or UI.
- No baked shadow beyond a faint contact darkening.
- Upper-left light and the same camera as the range/barracks/mess studies.
- Name files exactly as given.
- Put finished files in `art/incoming/`.

### A. Soldier archetype, one character, drawn together (highest priority)

- **Frame box:** 256 × 384 px. Feet on row **368**, body centred on column **128**.
- **Sheets:** one sheet per direction and state, frames left to right, no gaps.
  - `soldier_walk_down.png`, `soldier_walk_up.png`, `soldier_walk_right.png`: **6 frames each**, a full stride with planted feet (contact, down, pass, up, contact, down on the other leg). The whole figure moves: arms swing, the rifle stays slung, and the head bobs slightly.
  - `soldier_idle_down.png`, `soldier_idle_up.png`, `soldier_idle_right.png`: **2 frames each** (subtle breathing).
  - `soldier_fire_up.png`: **4 frames** (ready, aim, recoil, recover), seen from behind and slightly right, aiming up-right like the current study. **No muzzle flash.**
  - `soldier_lift_down.png`: 4 frames of a barbell lift. `soldier_rest_down.png`: 2 frames sitting on a bunk edge. `soldier_eat_up.png`: 2 frames seated at a bench, from behind.
  - `soldier_accent_*.png`: the identity mask for every sheet above, with the same grid. Plain white helmet band and shoulder patch on transparent.
- **Left-facing:** the game mirrors `right` for left, so keep kit symmetric or say so.
- **Prompt:** *"Sprite sheet on a transparent background, exact grid of 256×384 px cells, one consistent young soldier in olive field uniform, helmet, webbing, slung rifle; chunky illustrated three-quarter game style with dark outlines matching [attach range-interaction-study]; warm upper-left light; feet on the same baseline in every cell; 6-frame walk cycle facing [down/up/right], full-body coordinated arm and leg motion with planted feet; no shadows, no effects, no text."*

### B. Visitors (civilians)

- Same box and baseline as A.
- For each of 3 outfits (`civilian`, `bus_rider`, `taxi`): walk 6 frames × down/up/right, plus 1 `sitting` frame on a chair seen from the front.
- Deliver an accent mask for identity, the same way as A.

### C. Activity props that people use (optional, helps "visible use")

- Target with a separate hit-marker overlay.
- Barbell.
- Bench with a separate front half (so it can overlap seated people).
- 128–256 px each, transparent.

### D. Gate: `gate_kiosk_back.png`, `gate_kiosk_front.png`, `gate_arm.png`

- Same canvas size for kiosk back and front (e.g. 1024 × 1024), camera as the gate study.
- **Arm:** a separate image of the barrier arm only, lowered and horizontal. Mark the hinge point in a note (pixel x, y) so the game can rotate it up.
- **No painted road.** The game draws the path.

### E. Remaining facilities, in the studies' style

Weight room, obstacle course, drill yard, showers, rec room, entrance hall (reception).

- **Canvas:** 1536 × 1024. The building spans about 90% of the width. Entrance faces the camera near bottom-centre.
- **Indoor** (weight room, showers, rec room, entrance hall): `<name>_back.png`, `<name>_roof.png`, `<name>_front.png` on the same canvas. Show usable stations inside:
  - weight room: 4–6 benches or racks
  - showers: 4 stalls
  - rec room: 2 tables and chairs
  - entrance hall: a counter plus 4 waiting chairs on a porch
- **Outdoor** (obstacle course, drill yard): `<name>_back.png` plus `<name>_front.png` (only the pieces that stand in front of people). Show 4–6 clear stations (walls, logs, ropes, dummies).
- In a note, list each station's pixel position (where a person's feet go) and the entrance pixel.

### F. Terrain and props kit

- **Tileables:** `grass_tile.png` and `earth_tile.png` (1024², seamless), `shore_edge.png` (a seamless strip of water edge), `cliff_face.png` (a seamless strip of rock face seen from the south).
- **10–15 props, each alone on transparent:**
  - fence segment and fence post
  - lamp post
  - 2 crate stacks
  - bench
  - noticeboard (blank)
  - signpost (blank)
  - 3 grass clumps
  - 3 rocks
  - tyre-mark decal
  - utility vehicle, three-quarter from the south

## How new art enters the game

1. The files land in `art/incoming/` and are referenced from `js/asset-manifest.js`, with their crop, pivot, slots and occluders.
2. `node tools/prepare-art.cjs` cleans and exports them to `assets/` and writes review sheets to `art/review/`: a transparency checkerboard plus a game-scale preview.
3. `node tools/validate-assets.cjs` must pass. It checks alpha, grid, baseline, edges, anchors inside footprints, and the offline cache list.
4. Then an in-game capture: `node tools/browser-capture.cjs <url> captures --clip`.

Anything that fails a step goes back with the validator's message quoted. That message is the most useful feedback to pass on.

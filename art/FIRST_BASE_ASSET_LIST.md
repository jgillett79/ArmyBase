# First base — artwork inventory and production checklist

This list is for **base 1 only**. A source study in `art/concepts/` is not automatically a playable sprite. “Prepared” means a transparent crop and anchor exist; “in game, provisional” means the renderer draws it but it may still need separate layers or style cleanup; “missing” means no acceptable production art. Final files belong under `assets/` with a manifest entry, validation and a game-scale review. Camera: fixed three-quarter from south, warm upper-left light, dark illustrated outlines, olive/teal/ochre. Current game camera is 960 × 576 over a 1600 × 960 world; people are 44 world pixels tall.

## World and construction images

| Required game art | Available source / current status | Codex art work | Claude integration |
| --- | --- | --- | --- |
| Meadow and earth repeats (2), grass/earth edge and corner decals, path wear | Existing `assets/terrain/ground_grass-v2.webp` and `ground_apron-v2.webp` are **interim**; `art/concepts/terrain-meadow-path-edge-study.webp` is **unregistered** | Make seamless variants and cut irregular edge/corner decals; clean red fringe and check repeats at 1× and 1.6×. | Fit to existing polygon clearings and graph paths; avoid full-width road bar and doubled painted ground. |
| River current, shallow shoreline, cliff face/top and rock-edge turns | `art/explorations/river-cliff-edge-study.webp` and `art/concepts/terrain-river-cliff-edge-study.webp` are **studies**; `js/scenery.js` currently draws flat/procedural river and rock | Separate water, foam, bank and rock faces into tiling/overlap pieces; make at least one corner and two joining variants; clean alpha. | Fit to `WORLD.terrain`, draw in depth order, keep legal routes and build zones clear, frame river in camera. |
| One bridge: deck/back rail/front rail, stone landings | `art/concepts/bridge-only-study.webp` is a **study**, `art/explorations/bridge-crossing-study.webp` has water baked in | Separate bridge-only art into drawable layers with two foot pivots and front rail; remove baked water. | Choose real endpoint coordinates; add a walkable graph edge, collision exception and depth order, or do not present it as a crossing. |
| Gate kiosk back/front and **one** rigid hinged boom | `art/concepts/gate-kiosk-separate-study.webp`, `gate-boom-separate-study.webp` are **studies**; current gate is interim | Clean back/front layers, opaque interior pixels, hinge/pivot matched to the boom; no road baked into kiosk. | Place checkpoint on existing gate node, rotate one boom from fixed hinge on admission, add guard/reception positions and occlusion. |
| Surveyed, constructing and completed footprints; levels 1–3 indicators | Geometry and procedural construction already in renderer; no distinct approved foundation/upgrade kit | Small foundation/peg/scaffold/roof/prop variants if the real screenshot needs them, no giant common rectangular pad. | Keep existing build validity, save and timing; make changes readable as buildings appear/upgrade. |

## Buildings — nine facilities

Each needs a compact transparent ground/back layer, separate roof where the soldier enters under it, front/occlusion elements, a world pivot, entrance anchor and named visible activity positions. The facility art and `WORLD.zones` must agree at the actual play scale. Levels can initially share a base shell with distinct upgrade props, but a purchase/upgrade must visibly change something.

| Facility and visible behavior | Current art | Remaining image/layer work |
| --- | --- | --- |
| Entrance Hall — admission, reception counter, waiting chairs | `art/concepts/reception-hall-study.webp` **study**; older `entrance-hall-organic.webp` in game | Split floor/back, roof and front counter/rail; 4 waiting positions, separate counter and chair fronts; recruit/uniform transition location. |
| Barracks — enter, sit/lie on bunk, rest | `assets/buildings/barracks-study-v1.webp` **in game, provisional** | Split roof/back and near bunk fronts; align 6 bunk places, correct hidden occupant cutaway. |
| Shooting Range — at least two occupied lanes, aim/fire/recover and target reaction | `assets/buildings/range-study-v1.webp` **in game, provisional**; two static berm cutouts prepared | Split range back/foreground and stations, remove doubly baked front walls, distinct target/hit overlay; no muzzle flash in character frames. |
| Mess Hall — approach counter, sit/eat at table | `assets/buildings/mess-hall-study-v1.webp` **in game, provisional** | Split rear/kitchen, near table and bench fronts, roof/canopy; 6 places and serving point. |
| Weight Room — use rack/bench and visibly lift | `art/concepts/weight-room-study.webp` **study** | Split roof/back/front, 4 equipment positions and individual barbell/bench layers. |
| Obstacle Course — hop through tyres, vault, climb net, balance beam | `art/concepts/obstacle-course-study.webp` **study**, runtime `traverse` status generic | Extract ground, tyres, vault wall, net back/front, beam; define hand/foot and entry/exit anchors. See Brief 05. |
| Combat Drill Yard — drills at dummies and marked circles | `art/concepts/drill-yard-study.webp` **study** | Split back/fence/front, dummy targets and 4–6 individual stations. |
| Showers — occupy stall and wash | `art/concepts/showers-study.webp` **study** | Split back, roof, stall/front partitions and water overlay; 4 stalls with coherent person occlusion. |
| Rec Room — sit/relax at tables | `art/concepts/rec-room-study.webp` **study** | Split roof/back/front furniture, 2 table groups and bench fronts; leave chairs empty in building art. |

## Characters and movement — critical path

**One visual identity** across all sheets: same young soldier, olive uniform, helmet, webbing and slung rifle; separate white helmet-band/shoulder-patch identity mask so uniforms stay olive. Mirror right to left only if asymmetric insignia/kit has been corrected. Character sprite source boxes are 256 × 384 with feet on row 368, per `art/CHATGPT_FEEDBACK.md`; export scale must still make a person 44 world pixels tall. Use one controlled rig or hand-registered master. Previous generated six-pose sheets repeated stride phases and are **rejected**.

| Set | Minimum frames for first base | Readiness |
| --- | --- | --- |
| Soldier walk down/up/right | 6 **different** planted-foot frames × 3 directions; left derived and reviewed | **Missing.** `js/animation.js` supports playback but manifest walk status is missing. |
| Soldier idle down/up/right | 2 coherent breathing/weight-shift frames × 3 | **Missing.** Directional stills are interim. |
| Soldier activity | Range ready/aim/recoil/recover (4); lift (at least 4); tyre hop, vault, net climb and beam balance (contact phases sufficient to read each action); drill, eat, bunk rest, wash and rec-room seated loops | **Missing matched character.** Firing candidate depicts a different person; must be redrawn from the same master. Pose count for obstacles is set by approved 44-pixel clip, not arbitrary generated sheet length. |
| Soldier masks/effects | Same-frame white identity mask for every soldier strip; target hit, muzzle flash, water/dust as **separate** transparent images | **Missing** except code-rendered simple flash. Never hue-rotate a full olive sprite. |
| Visitors | 3 outfit variants already present (`civilian`, `bus_rider`, `taxi`); each needs down/up/right six-frame walks, idle and chair-sitting/queue poses. Reuse one controlled base rig with outfit layers where sensible. | **Missing cycles.** Directional stills and sitting sprites are interim. |
| Gate greeting/recruit transition | Visitor checkpoint pause and greeting, then same person changes outfit at the specified recruit point | **Missing visible animation**; route/status exists. |

## Props and interface

| Set | Current status and remaining need |
| --- | --- |
| Base ambience | Nine individual `assets/props/scene_*.png` sprites are **prepared, unplaced**: fence, post, lamp, noticeboard, signpost, flower grass, granite rocks, moss rock, utility vehicle. Metadata: `art/production/scene-props.json`. Add crop-clean crates, bench, spare rock/vegetation variants, tyre marks and at least 10 useful non-repeating prop placements. Claude handles seeded clearance and draw order. |
| Interaction objects | `art/concepts/activity-props-study.webp` is a **sheet study** containing target, hit plate, barbell, bench, bench-front and kettlebells; some drawings cross grid boundaries. Separate and clean, then add net handholds and any missing dummy/tyre fronts as required by clip. |
| UI / icons | Claude should keep text, button states, build labels, mission information and accessible icons in HTML/CSS or repo-native vector where possible. Codex reviews visual cohesion and supplies raster illustration only if a game-size screenshot identifies a gap. Avoid text baked into building PNGs. |

## The promotion rule

For every new source, Codex records source path, style, alpha and intended layer, then inspects the actual pixel output at native size and at projected 44-pixel-human game size. Claude records crop, pivot, entrance, slot IDs, supported orientation, occlusion and frame metadata in `js/asset-manifest.js`, exports cleaned `assets/` files, runs `node tools/validate-assets.cjs`, updates offline caching and captures the actual game. Both review the screenshot/clip. Only then mark the asset **production**. Reject and redraw assets with repeated poses, changing faces, soft alpha bodies, baked people/effects, wrong entrance direction, giant ground rings or parts that cannot be layered.

Next art output should follow Claude's Gate 0 composite and anchor measurements, beginning with one soldier master plus six-frame down walk and the seam-clean river/cliff/bridge layers. Generating every facility and every character direction independently before that review risks repeating the current mismatched appearance.

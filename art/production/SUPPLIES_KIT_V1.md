# Supply props for the first base

Two transparent, game-scale cutouts are prepared for Claude's map placement. These small details help the gate and training area feel like working spaces without constraining the terrain layout.

| Sprite | Default size | Suggested location |
| --- | --- | --- |
| `assets/props/supply_wood_crates.png` | 68 × 63.5 world pixels | Near the range equipment area or beside a storage building, away from the walking path. |
| `assets/props/supply_canvas_boxes.png` | 72 × 63.5 world pixels | Along a side wall near the gate or barracks. |

Actual sizes and ground-contact pivots are in `supplies-kit-v1.json`; the 1× review is `art/review/supplies-kit-v1-contact.png`. Draw with the existing world occlusion ordering, behind soldiers whose feet are farther south than each crate pivot. Keep walkable/collision footprints smaller than the visual upper surfaces. Register both files with the asset loader and offline cache when placed. Do not cover the gate queue, entrances, obstacle actions or river bridge.

These are prepared assets, **not yet visible in the playable map**. Approve their placements from a captured game screenshot before marking them production. `python tools/prepare-supplies-kit.py` regenerates the two PNGs and preview from the loss-minimised source images. The original prompts requested isolated wood crates and canvas supply boxes with rope, chunky dark outlines, a three-quarter elevated camera, warm upper-left light, muted alpine colours and genuine transparency; generated with the built-in image tool.

# Gate 0 art handoff — bridge, checkpoint and scene props

This package follows `CLAUDE_IMPLEMENTATION/06_GATE0_VISUAL_CONTRACT.md` and its measured overlay. Integrate from this handoff while Gate 2 character animation and Gate 1 terrain strips are prepared separately. No new image is marked production before an in-game capture.

## Bridge

`assets/bridges/bridge_gate_back.png` and `bridge_gate_front.png` are both transparent 360 × 216 px. **West deck-end pivot:** (36, 105); **east deck-end pivot:** (300, 111). They pin to world (134, 613) and (222, 615). The back holds stone abutments, trestles, planks and far rail. The front holds only the near rail, made from the matching bridge source so it can occlude walkers. Draw `back`, walkers and then `front` in that order. No water is baked in. The centerline between the fixed pivots stays straight west to east.

The 3 px/world export canvas represents world x 122–242, y 578–650. Do not rotate the diagonal concept study into place. A bridge crossing screenshot must show a person on the deck, correctly behind the south rail, plus dry abutments at both ends. The brook remains the game's water layer.

## Checkpoint

`assets/props/gate_kiosk_back.png` and `gate_kiosk_front.png` share a transparent 180 × 318 px canvas, with **ground pivot (90, 300)** at world **(70, 590)**. The front is the low south-facing service counter and lower posts; draw it after a visitor or guard who is behind it. The service window faces the trail. The kiosk image is intentionally narrow so the cliff reserve remains usable.

The swinging barrier is `assets/props/gate_boom_swing.png` (142 × 46 px), with **hinge pin (9, 30)** and about 126 px / 42 world px reach to the right. Its fixed post is `assets/props/gate_boom_post.png` (51 × 84 px), **visible hinge pin (21, 21)**, **post ground (25, 78)**. Position both hinge pins at world **(40, 632)**; draw the post without rotation. Boom rotation: open points east; closed points north across the trail. The source post's visible round boss is the pivot, not the base. Keep the old `gate_boom.png` as provisional until the new pivot is confirmed in a capture.

`art/production/gate-contract-art-v1.json` repeats the layer paths, sizes, pivots and world points for direct registration. `python tools/prepare-gate-contract-art.py` regenerates exports from `art/production/source/` and the 1× preview at `art/review/gate-contract-art-v1-contact.png`.

## Existing placed props at 3×

Nine transparent cutouts are in `assets/props/scene_*_3x.png`. They use exactly three times the dimensions and pivot coordinates of their old `scene_*.png` counterparts, retaining the same world footprint. `art/production/scene-props-3x.json` contains their dimensions and ground pivots. Switch each existing scene manifest entry to the matching `_3x.png` file and its new size/pivot, leaving the 12 authored world placements untouched. The files are already alpha cleaned; remove any redundant `alphaCleanup` stage after visual inspection. Regenerate via `python tools/extract-scene-props-3x.py`; compare `art/review/scene-props-3x-contact.png` at 1×. The fence openings deserve a close check on the actual ground colour before promotion.

## Integration and acceptance

Update asset manifest paths, sizes and pivots, plus the offline/service worker file list. Remove the procedural bridge only after the real back/front render is visible. Check a fresh 960 × 576 capture and portrait phone: a visitor crosses the bridge, the rail occludes the correct lower leg section, both ends sit on dry ground, kiosk doesn't block the queue, the boom swings around one pin, and props stay sharp at zoom 1.6. Run `node tools/validate-assets.cjs`, smoke tests and a short movement clip. Mark assets production only after reviewing the actual game screenshots.

Built-in image generation supplied the isolated bridge-back, kiosk and fixed post source art in chunky outlined alpine style with upper-left light and genuine alpha; the existing striped boom source is rescaled. The rail is extracted from the bridge source so its materials and posts match exactly. All final placements and split masks are deterministic in the export script.

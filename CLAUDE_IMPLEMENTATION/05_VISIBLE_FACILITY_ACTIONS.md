# Brief 05 — soldiers visibly use each facility

The simulation already routes soldiers to reserved facility slots and has a generic `traverse` activity for the obstacle course. The player's acceptance bar is higher: a soldier must **visibly perform the task represented by the building**, including climbing over the cargo net. A person standing on the ground beside a net, a bouncing still or a floating activity icon does not satisfy this brief. Keep current training rates, costs and schedules unchanged.

## Golden slice: obstacle course

1. Register the four distinct stations in `art/concepts/obstacle-course-study.webp` in `js/asset-manifest.js`: tyre lane, low vault wall, rope/log balance section and cargo-net frame. Give each stable slot and approach/exit anchors, facing and capacity. The art currently contains a net near the back and a front vault wall; inspect at **actual default game zoom** before setting anchors. Work with `GameState.facilitySlots()` and reservations, so two soldiers can use different stations and a third queues when full.
2. Treat the course as a sequence of real stations rather than one generic `traverse` pose. **Tyres:** plant, hop through the first opening, land with both feet and repeat with alternating lead foot; a jump arc must end on a tyre-lane contact point. **Vault wall:** approach, place hands, swing legs over, land beyond. **Cargo net:** approach → start → ascend → crest → descend → land, with hands/feet tracking the net surface. **Balance beam/log:** step onto it, alternate planted feet along its narrow centreline, adjust arms for balance, and step down. Each activity uses fixed source/exit anchors and a short locally safe path into the next station. A basic loop can repeat selected obstacles while training, with clear transitions between them. Keep the soldier's persistent identity and kit in every pose. No instantaneous teleport from ground to top and no roof-wide clipping trick.
3. Produce separate net back/front layers or a precise occlusion mask from the study. Separate low wall, individual tyre openings, beam and front rail where they obscure feet. At the net crest the figure is drawn above/behind appropriate bars; on descent the front strands occlude it. The net may need a clean redraw to expose handholds without baking people into it. Register layer order, pixels-per-world-unit, ground pivot and station anchors in the manifest. Activity sprites require transparent equal frames and planted contact points. A shared character rig with authored poses can render successive frames; code may interpolate a controlled jump or climb path between validated contacts. **Do not** move a single standing image up and down and call it jumping or climbing.
4. Progress and stat gain remain tied to a built/staffed facility and a soldier occupying a valid station. Leaving, reassignment, hospital transfer or save/reload must release a reservation and resume/restart safely. Activity can loop while the soldier trains, but finishes a visual cycle before changing stations unless a gameplay interruption requires departure.

## Extend the pattern

- Range: occupy a distinct mat, raise/aim/fire/recover with the same soldier model; target and flash separate.
- Weight room: move into an equipment station and complete a barbell lift cycle; draw arms/hands relative to the bar.
- Barracks/mess/rec room: visibly sit or rest at a bunk/table, with front furniture covering the lower body where appropriate.
- Showers: stand at an individual stall with a wash animation and safely obscured body; steam/water separate from unit frames.
- Drill yard: perform a short drill against a dummy or marked circle rather than idle beside it.

Use the current authored path graph for travel, then collision-safe local transitions around each station. One full, convincing cargo-net interaction plus a range interaction should be finished and reviewed in game before claiming the other buildings are done.

## Proof

Record a 30-second clip at default zoom showing a soldier jumping through tyres, climbing from bottom to top of the net, descending, balancing across the beam, then leaving; a second soldier simultaneously uses another obstacle without overlap. Show the feet/hands aligned and the correct front/back occlusion. Test reload mid-jump/ascent, reassignment at crest and two soldiers competing for one station. Run existing smoke and asset validation and review on a 960 × 576 screenshot.

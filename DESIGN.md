# Command Base — current game design

This document describes the **current playable build**. `README.md` records the development history, `CLAUDE.md` explains earlier decisions, and `ASSETS.md` retains the art prompts. Historical sections in those files may describe features as pending even after they were built.

## Player promise

A small roster of up to 20 soldiers matters as individuals. Players recruit visitors at the gate, name soldiers, train them, send squads on timed missions, and build a home for the people who return. There is no permanent death: a failed mission sends a soldier to the aid station for a real-time recovery set by the mission (5 minutes for Local Patrol, 30 minutes, 2 hours and 4 hours for later tiers), and neglect for no longer than the shortest of those. Identity, equipment and stats are kept.

**First soldier chapter (brief 08, implemented):** a new player's first session follows one soldier: visitor at the gate → admission → soldier card → range training to a visible +3 accuracy target (through a labelled first-soldier range drill: 3× gain at any waking hour, first soldier only, until ready) → a one-time 75-second introductory patrol with a guaranteed return → an individual debrief → the first improvement (usually the Mess Hall). Players may give any soldier an optional callsign and one of four accent colours (helmet band/shoulder patch where approved art has a mask, otherwise a badge); there are no face, body or uniform choices until matching art exists. See [the manifest](CLAUDE_IMPLEMENTATION/08_FIRST_SOLDIER_MANIFEST.md) for the numbers, test evidence, the walk release gate (still blocked on art), and the decisions that need review. Keep later base expansion subordinate to the first soldier's understandable progression.

## First public release scope

One base, with a complete recruit → train → mission → upgrade loop. Players can recruit and name soldiers, assign one of four training facilities, manage food/needs, dispatch four tiers of missions, earn XP and rewards, and return to a saved base. Missions are independent rolls per soldier; mixed outcomes are possible. The first patrol returns in three real minutes, then missions scale to 30 minutes, 2 hours and 4 hours. Completing all eight facilities and recruiting 20 soldiers marks the outpost complete. These pacing and reward numbers are **provisional** and need real player testing.

The browser build remains vanilla JavaScript, Canvas and localStorage, with no build step, account, backend, payment, or adverts. Its desktop map is fixed-size; on small screens it scrolls horizontally and the HTML roster provides reliable touch selection. A manifest and service worker provide an installable offline shell over HTTPS; the service worker cache version must be incremented with each release.

## The progression loop

- Recruits start at level 1. Missions grant XP on both success and failure, with more XP on success. Levels and trained stats jointly gate harder mission tiers.
- Cash trickles in slowly; patrols and higher missions are the main way to finance buildings. Food is bought with cash. The second level of Barracks/training buildings also needs 10 lumber, and the third needs 6 steel. Gems are earned at the top mission tier; their spending rules still need design before promotion or equipment.
- Training buildings have three levels. They add assignment slots, not faster training. Needs buildings are bought once. The Entrance Hall is always present.
- A game day lasts five real minutes; hospital and mission timers use real time. Reload and suspended-tab catch-up use bounded simulation steps, capped at one real day.

## Visual direction

Warm, grounded illustrated alpine outpost. The field starts with an entrance and a few visible building clearings; later facilities emerge among the meadow as they are built. The layout is staggered, clearings are irregular and people follow a gently winding path that connects the gate and facility entrances. Four initial facilities (Entrance Hall, Barracks, Shooting Range and Mess Hall) have revised sprites without hard rectangular plinths. The other facility assets still need the same pass.

The old split-leg animation was removed because it visibly distorted the characters. Existing directional character drawings now move intact at ground contact; the subsequent whole-body bounce was removed because it looked like flying. This is still an interim sliding treatment, not a finished walk cycle; authored full-body frames for each direction and activity remain a production requirement. `FIRST_BASE_DELIVERY_PLAN.md` and `art/FIRST_BASE_ASSET_LIST.md` define the current completion work.

New artwork was generated for the project with this brief: a small welcoming military training outpost among mountain foothills, flat digital illustration with dark outlines, restrained olive/khaki/teal palette, readable shapes, no embedded text; overhead seamless rugged meadow and maintained earth texture variants in the same palette. The project serves optimized WebP copies under `assets/`.

## Target: a terrain-shaped, inhabited base

The three player references received on 26 September 2026 refine the target. `graphicsType.jpg` shows the desired bold, readable, illustrated three-quarter look, **not** a request to reuse its desert scene or emblem. `NotSquareLayout.jpg` shows a base boundary and circulation shaped by water, cliffs and clearings, **not** a template to trace. `Interact with Buildings.jpg` shows the key gameplay promise: workers visibly using individual stations rather than merely disappearing into a building. The original project art in `art/concepts/terrain-shaped-base.webp` explores these ideas in an alpine foothill setting. It is a composition reference, not a playable map texture.

**Player-facing goal:** Starting with a gate, entrance and a small number of useful sites, the player builds an outpost that grows around the landscape. Civilians pass the gate, wait for admission, become named soldiers, walk along the paths, visibly train or use amenities, then depart on missions. At any normal gameplay zoom, the player can tell which facilities are active and who is using them.

**First implementation choice:** use one carefully authored terrain map with irregular, non-overlapping build zones. Each zone has a hand-placed anchor and a small set of allowed orientations/footprints; buildings do not snap to screen rows. This is a practical path to an excellent composed first base. Arbitrary free placement, terraforming and multiple generated maps are future features and require a more general pathfinding, art-rotation and save system. Building pads should follow rock, vegetation and water edges. Never rotate a single three-quarter bitmap to fake an unsupported camera angle. **Status:** the authored map, zone data, path graph and save v2 migration exist (`js/world.js`, `js/save.js`, brief 01). The camera, layered facility drawing, seeded scenery and zone-based build controls exist (brief 03); brief 04 added the asset manifest, preparation/validation tools, frame-based animation playback and the first three processed studies (range, barracks, mess); walk/idle/activity frames and the remaining facility art are still to be drawn (`art/CHATGPT_FEEDBACK.md`).

### World and construction contract

- World coordinates are independent of the 960 × 576 camera. The first authored world can be larger than the viewport, with camera pan and restrained zoom. Pointer hit testing must invert camera transform. The canvas remains usable on portrait phones with touch controls and HTML roster fallback.
- Reserve enough screen space for interaction: at the default zoom, an active outdoor facility should be roughly 220–300 screen pixels across and a person large enough to distinguish a walk from a firing/lifting pose. The current 144 × 96 building thumbnails cannot convey the requested activity and must not dictate the new world scale.
- Store map zones as polygons or irregular masks plus orientation, a stable zone ID, allowed building types, entrance anchor, activity anchors and an access path node. Collision checks use the actual footprint polygon and clearance from water/cliffs/other buildings, not a common 3 × 2 grid box. Keep chosen building type and level separate from zone geometry.
- The path network is an authored graph following the terrain. When a facility is built, activate its short connection from the main trail to its door; avoid drawing a road to every unbuilt future site. Route units along the graph using a shortest-path search and short local approach segments. Recompute a route if construction invalidates its destination. Reserve safe gate, waiting and hospital fallback nodes.
- Construction needs a ghost preview, valid/invalid feedback, a short build animation, and a visible before/after change. The initial view should contain only the entrance, gate and a few subtle surveyed sites. Later zones can be revealed with progression while the wider terrain remains readable.
- Preserve the current economy, mission tiers, soldier identities and timing during the map rewrite. Introduce a save version and migration from `armybase_save_v1`; preserve resources, buildings, roster, equipment, missions and timers, map old building IDs to new zone IDs and safely relocate units to valid entrance/road nodes. Keep export/import working and test reload mid-mission and mid-construction.

### Visible interaction contract

- Every facility has an `entrance` and one or more `activitySlots` in world coordinates, with supported activities, occupancy limit, facing and animation key. A unit approaches the entrance, walks to an available slot, uses it while the existing simulation applies its effects, and leaves via the entrance. A full slot queues safely or keeps the unit on an appropriate idle task.
- Draw activity in **layers**: terrain and ground footprint; rear walls/props; people and effects sorted by ground-contact Y; front walls/foreground/roof. Outdoor training should expose the whole station. Indoor facilities can use a controlled cutaway or reveal only while selected/occupied, but should not draw a soldier on top of a solid roof. Hit testing must still select the unit.
- Examples: target practice has aim/recoil/reload with target reaction; weight training has a full-body lift and rest; obstacle course has traversed obstacles; mess has seated eating; barracks has bed/rest; reception has an actual greeting/admission moment. The activity cue must start only when the unit reaches its slot, and stop on status change or mission departure.
- A walk animation must animate the **whole figure**, including coordinated arm/leg motion and planted feet. At minimum, one consistent soldier archetype needs six authored frames for each visible travel direction and idle poses before this is called a finished visual slice. Palette variants must retain a unit's identity from idle to walk to activity. No split-leg manipulation of a still image.

### Art production contract

- Lock one consistent three-quarter camera, relative scale, upper-left light, outline weight, shadow direction and restrained olive/teal/ochre palette. At game zoom, buildings are identifiable by silhouette, not just labels. Keep terrain, structures, props, units and UI within the same visual language.
- Produce separate transparent layers for a modular building: `ground`, `back`, `foreground/roof` (where needed), and shadow. Record image pixel size, in-game world size, draw pivot at ground contact, door and slot anchors, occlusion mask, and allowed orientation in an asset manifest. Do not bake people, text, paths or the full landscape into a building sprite.
- The generated files in `art/concepts/` are **studies**: a composed world, an isolated gate, an outdoor range and four firing poses. They demonstrate feasibility and set a quality target. Their alpha bounds, anchor geometry, pose consistency and small-size readability must be cleaned and tested before moving them into `assets/`. The firing pose study is not a walk cycle.
- Prioritize a golden slice: gate/admission, Entrance Hall, Barracks, one range, 4–8 moving people, one complete visible activity, irregular terrain and path, build preview, save migration. Review a fresh-start screenshot, an expanded-base screenshot and a 30-second continuous movement clip at actual game scale before drawing the other five facilities.

### Acceptance gates for the rewrite

1. A fresh base reads as an outpost set within terrain; the paths and footprints have no visible grid alignment. Every new facility changes the scene without covering water, cliffs, doors or paths.
2. A civilian enters through the gate and can be recruited; the same soldier walks to a range slot and visibly trains there. Full-body animation has no sliding or snapping between idle/walk/activity states.
3. Two soldiers can use distinct slots without overlap; full slots queue; departures and status changes clear reservations. Activity graphics and stat gains agree.
4. Existing v1 saves migrate once without resource, roster, mission or timer loss. Export/import and offline catch-up remain usable.
5. Desktop and portrait-phone controls work, rendering remains responsive at 20 soldiers, and actual browser recordings/screenshots pass visual review. Automated smoke tests alone do not establish those gates.

## Design decisions still needed

1. **Promotion and multiple bases.** Base 1 must persist with its remaining soldiers and passive income; two chosen soldiers move to Base 2. Define carried resources, construction, mission unlocks, and save migrations before implementing.
2. **Further material sinks.** Validate the provisional lumber and steel upgrade costs with playtesting; specify gem costs for equipment and promotion so the top mission reward has lasting value.
3. **Audience and release target.** Playtest the first session, mission wait times, recovery durations and portrait phone layout. Verify the installable PWA and offline cache on the deployed HTTPS host.
4. **Visual production.** Produce consistent full-body walk frames for each character direction and activity. Finish the organic-base treatment for the remaining facilities, improve scale/composition and add environmental detail after checking the first four revised buildings at gameplay size.
5. **Player trust.** Backup download and restore are available, but save migration and corruption recovery need more work before promising durable long-term progress. localStorage can be cleared by a browser or device change.

## Release checks

A public announcement should follow hands-on testing on desktop and portrait phones, a full progression run from a fresh save, reload and long absence checks, playtest feedback on pacing and visuals, and a working deployment on HTTPS. The current build should be described as a **beta** until those checks pass.

# Daily routine artwork and animation inventory

Target: brief 09, approved 1 October 2026. A person visibly walks, waits, reaches their actual station, acts, and leaves. Same character identity and accent throughout. Image-generation output is a source candidate until export validation and game-size clips pass. The latest generated up/right sheets repeat the same leading leg; reject them. Frame 1 right-leading and frame 4 left-leading must be unambiguous.

## Shared export rules

Use the established top-down oblique camera (ground axes equal; height straight up), warm upper-left light and chunky illustrated olive/teal/ochre style. Character source cells remain 256 × 384 unless Claude's measured station contract requires a wider canvas (sleeping/climbing may). Walking ground pivot is (128,330), head near row 30; runtime standing height is 44 world px. The 300-source-px figure is a high-resolution master, resampled to 3 art px/world for runtime; do not confuse its source resolution with export density. Produce opaque body interiors, transparent background, no baked ground shadows/effects/text. Use full-body frames, not isolated moving legs. Left can mirror right only after kit and light continuity review. Station-facing directions are declared in the contract before painting.

Masks: one white-on-transparent helmet band/shoulder accent strip per animated strip, exactly the same grid; skin and equipment stay untouched. Props/front layers are independent. Every export includes canvas, frames, pivot, timings, role, contact points and occlusion notes. Status is missing/candidate/provisional/production with measured evidence, not a marketing label.

## Soldier sprite sets

Frame counts below are production planning targets; timings and anchors come from the station contract. Do not automatically multiply every action across all directions: author the camera-facing orientation needed at each station, while walking needs all map directions.

| Priority | Action | Initial frames | Where used / coordination |
|---|---|---|---|
| P0 | Walk down/up/right (+ reviewed left mirror) | 6 each | Alternating legs, planted-foot travel, coordinated arms; up/right still missing |
| P0 | Idle/wait down/up/right | 2 each | Stable feet, subtle breath, same helmet/kit |
| P1 | Get into bed / lie sleeping / wake and get out | 4 / 2 / 4 | Body aligned to mattress; wider cell may be required; separate bedding/front rail |
| P1 | Enter/leave toilet stall | walk reused + privacy door states | Soldier becomes occluded after entering; visible occupied indicator, no nudity |
| P1 | Wash at basin | 4 | Hands meet basin; separate basin front |
| P1 | Enter/leave shower / shower-use silhouette | walk reused / 2–4 | Privacy screen/door masks person; water effect separate and only during use |
| P1 | Collect meal at counter | 4 | Reach → receive tray → withdraw; cook animation shares event timing |
| P1 | Carry tray walk down/up/right | 6 each | Stable tray and arms; can reuse approved leg timing, not independent regenerated gait |
| P1 | Sit down / eat seated / rise | 4 / 4 / 4 | Chair/table contact; table front overlaps hands/tray correctly |
| P2 | Rest/relax seated | 2–4 | Recreational bench and leisure stations |
| P2 | Range fire | 4 | Ready/aim/recoil/recover; rifle changes from slung to held visibly; flash separate |
| P2 | Barbell lift | 4–6 | Hand grips match independent barbell; floor contact and lift height measured |
| P2 | Basic endurance station | 4–6 | One beam or stepping station chosen by Claude's contract |
| Later | Tyre steps/jumps | 6–8 | Foot contacts on tyre gaps; front tyre occlusion separate |
| Later | Cargo-net climb / dismount | 6–8 / 4 | Hand/foot attachment and elevation defined; net front/back and top platform |
| Later | Beam mount/balance/dismount | 4 / 6 / 4 | Ground path and raised pivot from actual equipment geometry |

## Facility and prop layers

| Facility | Required export parts |
|---|---|
| Perimeter guardhouse | Back shell, outside recruitment window/counter, front/door layer, separate boom/post; outside queue anchor map |
| Barracks | Floor/back walls, optional lifted roof, separate beds and front bed rails/bedding; distinct bunk ground/contact anchors |
| Latrine / wash area | Back wall, stalls with separate open/closed privacy doors, basins back/front, occupied overlays |
| Kitchen/mess | Floor/back/roof/front walls; serving counter back/front; cook idle/serve 2/4 frames; trays with food/empty variants; table back/front and chairs |
| Shower block | Floor/back/roof/front; stall screens/doors and occupied overlays; water animation separate from sprite |
| Exercise yard / weights / range | Individual equipment back/front/contact masks; independent barbell and target effects; real station slots |
| Recreation | Bench back/front and optional simple leisure prop; seat anchors |

Bed, shower and dining capacities must be represented by visible individual stations, spaced enough for a 44-world-px soldier. Never pack six sleepers into a nine-world-px gap. Artwork may include decoration, but simulation capacity comes only from exported station definitions.

## Art acceptance and generation process

1. Claude measures and publishes `09_STATION_VISUAL_CONTRACT.md` with an example person and all contact points, then identifies P0/P1 exports for the first four-soldier day.
2. Codex creates one canonical directional master and paints each gait phase against the rig geometry. Inspect the **left leg in front** as well as the right before producing idle or activity variants. Do not request a whole attractive sheet and assume its poses are distinct.
3. Export through the established cleanup/resample pipeline. Check grid, opacity, edges, accents and exact contact positions. Sources remain untouched and candidate exports remain out of default gameplay.
4. Claude trials each action at game size. Sleep must sit on the bed, hands must meet the serving counter, trays must sit on the table, and the soldier must be occluded by stall/table/bed front layers correctly. A privacy-door animation can satisfy visible toilet use without depicting the private action.
5. Capture a continuous daytime and bedtime sequence with queues, turns and idle. Approve each set independently, record remaining blockers, and then promote production. A numerical simulation test alone does not certify the visual animation.

# Brief 09 — station visual contract (09B–09D, initial)

Claude, 1 October 2026, branch `brief-09-daily-base`. This is the measured layout Codex paints interaction sprites and facility layers against. **Every number below is generated from the running game data** by `node tools/station-contract.cjs` (full data: [`docs/screenshots/2026-10-01-daily-base/station-contract.json`](../docs/screenshots/2026-10-01-daily-base/station-contract.json)). If a station moves, re-run the tool and update this file; never let an image model choose station coordinates.

**Status: everything drawn for stations in the game today is a PLACEHOLDER** (magenta dashed outlines, and a "PLACEHOLDER station art" legend on the map). It exists so the routine can be reviewed. It is not release art and does not approve any action set. The release gate stays blocked: no approved directional walk, no interaction art.

## How to read the numbers

- **Camera, scale and density are unchanged from the Gate 0 contract** ([06_GATE0_VISUAL_CONTRACT.md](06_GATE0_VISUAL_CONTRACT.md)): top-down oblique, 1 world px = 1 screen px at zoom 1 on both axes, heights straight up, warm upper-left light, renderer-drawn contact shadows. A person is **44 world px** from sole to helmet top. **Export at 3 art px per world px**; character cells stay 256 × 384 with the ground pivot at (128, 330) unless a row below says a wider cell is needed.
- **Anchor**: each facility's art ground pivot sits on its zone's anchor, *footprint centre x, footprint bottom − 6* (Gate 0 rule). New facility layers for brief 09 are painted **at fixed density 3 px/world** (no per-zone stretching), so a station offset is the same on every site.
- Each point is given three ways: `world x, y · (offset from anchor) · [export px from the pivot]`. Negative y is north (up the screen). A station's **use** point is where the person's feet (ground pivot) are while using it; **approach** is where they stand just before entering and after leaving; **contact** is the numeric action contact (hands on the counter or basin, tray on the table top). **Facing** is the direction the person faces while using it.
- **Example person**: at any use point, the figure's 44 px column rises straight up from that point; at 3 px/world that is a 132 px tall figure whose pivot is the exported point. The screenshots below show real soldiers standing on these points in the running game.

## Daily timeline (data, `js/routine.js`)

Day length **20 real minutes at 1×** (1 game hour = 50 real s; 1 game minute = 0.83 s). Speed 2×/4× scales the day, walking and services together; pause stops the base. Missions and recovery always count real time.

| Window | Task | Station use and duration (game minutes) |
|---|---|---|
| 22:00–06:00 | Sleep | Own bed, whole window; +6 energy per game hour while lying in it. Bedroll on the parade ground if no bed: +3/h |
| 06:00–07:00 | Bathroom | Toilet stall 8 min (+15 hygiene), then wash basin 4 min (+10) if time remains |
| 07:00–08:00 | Breakfast | Serving counter 3 min (one food charged when called) → carry tray → seat 15 min (+100 energy/h in use, +25 per meal) |
| 08:00–12:00 | Morning training | Equipment bouts of 30 min, repeated; gain only in use (range → accuracy, barbell → strength, beam → endurance) |
| 12:00–13:00 | Lunch | As breakfast |
| 13:00–17:00 | Afternoon training | As morning |
| 17:00–19:00 | Recreation | Rec bench bouts of 20 min, +12 morale each |
| 19:00–20:00 | Dinner | As breakfast |
| 20:00–21:00 | Shower | Shower stall 10 min, +30 hygiene (partial use: partial benefit) |
| 21:00–22:00 | Free time / bed prep | Walk to own bunk, stand at its approach point |

A started toilet, basin, shower, counter or meal may run up to **5 game minutes** past its window (the grace); a counter stops calling people 15 minutes before a meal window ends. **Animation timing follows these durations** at 1×: e.g. a 3-minute counter use is 2.5 real seconds, a 4-minute wash 3.3 s, a meal 12.5 s, a toilet 6.7 s, a shower 8.3 s. Loops (eat, wash, lift) should read at those lengths; one-shot transitions (sit down, get into bed, receive tray) should take ≤ 1 game minute (≤ 0.8 s) and happen at the *start* of the use; rising/getting up happens at the *end*.

## Perimeter (09A — implemented)

Applicants arrive on the outside valley road (world x −200…40; the map now extends 200 px west of the old edge) and **never cross the barrier line x = 40 until admitted**.

| Anchor | World | Notes |
|---|---|---|
| Barrier line | x = 40 | The closed boom (hinge (40, 632), unchanged) |
| Guardhouse window | (48, 572) | **On the kiosk's west (outside) wall** — new: the kiosk art needs a service window facing west, toward the applicant. Kiosk footprint unchanged: x 48–92, y 552–590 |
| Applicant at the window | (31, 576), facing right | One applicant at a time is interviewed here |
| Guard at the window | (60, 576), facing left | Inside the kiosk, behind the counter (kiosk front layer occludes legs) |
| Outside queue (nearest first) | (8, 582) (−16, 584) (−40, 586) (−64, 587) (−88, 588) | Bounded: five places; a full line means no new arrivals |
| Outside road centreline | y = 612, from x −196 | Applicants step off it onto the north verge to queue |
| First step after admission | (24, 610) | On the trail just outside the boom, then through the gate |

Codex export (Gate art round 3): **guardhouse west window layout** — a window opening and sill on the kiosk's west wall at the point above, with the kiosk back/front layers re-cut so the applicant at (31, 576) stands *outside* the front layer and the guard at (60, 576) inside it. Optional outside queue props (a sign, a bench, a rope line) must keep the five queue points clear by 10 world px.

## Parade ground (waiting with a reason)

Soldiers with no usable station (facility not built, no bed, finished a task early) wait on their own spot here, never on a shared anchor: `p1`–`p9` at (796, 522) (820, 524) (844, 526) (790, 546) (814, 548) (838, 550) (784, 568) (808, 570) (832, 572), reached from trail node `t4`. A simple flat parade-ground decal (no props on the spots) is enough art.

## Starter layout (fresh base)

Chosen from the measured door-to-door walk matrix (see the 09A manifest): **Mess Hall on Centre knoll** (the hub — three meals connect it to everything), **Wash Block on Knoll east**, **Barracks on River bend**, Shooting Range on West rise, Weight Room on North terrace, Rec Room on East meadow. The existing provisional mess bitmap (painted for North terrace) is shown faded on Centre knoll until the contract art exists, and the Barracks study is drawn on River bend; both need redrawing to the stations below.

## Stations by facility (measured)

Indoor facilities (Barracks, Wash Block, Weight Room) show people only while cut away; that view lifts the roof and shows floor, low walls, stations and people, then a front rail. **Privacy**: a toilet or shower user is never drawn — the stall's closed door and a red occupied pip show the use; shower water only during use. No nudity or bodily detail anywhere.

### Barracks (`barracks`, indoor) on `zone_river_bend`

Anchor (art ground pivot) **(1150.3, 280)**, station fit scale 1. Entrance 1110, 298 · (-40.2, 18) · [-121, 54]; inside-door waypoint 1150.3, 270 · (0, -10) · [0, -30].
Stations per level: L1 6 bed; L2 6 bed; L3 6 bed.

| Station | From level | Facing | Use (feet) | Approach | Contact | Extra | Use time / effect |
|---|---|---|---|---|---|---|---|
| `bed_1` bed | 1 | left | 1115.3, 210 · (-35, -70) · [-105, -210] | 1136.3, 210 · (-14, -70) · [-42, -210] | — | head 1132.3,210; feet 1098.3,210 | whole window, +6 energy/h in use |
| `bed_2` bed | 1 | right | 1185.3, 210 · (35, -70) · [105, -210] | 1164.3, 210 · (14, -70) · [42, -210] | — | head 1168.3,210; feet 1202.3,210 | whole window, +6 energy/h in use |
| `bed_3` bed | 1 | left | 1115.3, 234 · (-35, -46) · [-105, -138] | 1136.3, 234 · (-14, -46) · [-42, -138] | — | head 1132.3,234; feet 1098.3,234 | whole window, +6 energy/h in use |
| `bed_4` bed | 1 | right | 1185.3, 234 · (35, -46) · [105, -138] | 1164.3, 234 · (14, -46) · [42, -138] | — | head 1168.3,234; feet 1202.3,234 | whole window, +6 energy/h in use |
| `bed_5` bed | 1 | left | 1115.3, 258 · (-35, -22) · [-105, -66] | 1136.3, 258 · (-14, -22) · [-42, -66] | — | head 1132.3,258; feet 1098.3,258 | whole window, +6 energy/h in use |
| `bed_6` bed | 1 | right | 1185.3, 258 · (35, -22) · [105, -66] | 1164.3, 258 · (14, -22) · [42, -66] | — | head 1168.3,258; feet 1202.3,258 | whole window, +6 energy/h in use |

Queue lines (world px, nearest first): .

### Shooting Range (`shooting_range`, open) on `zone_west_rise`

Anchor (art ground pivot) **(384.8, 372)**, station fit scale 1. Entrance 392, 392 · (7.3, 20) · [22, 60].
Stations per level: L1 2 range_lane; L2 4 range_lane; L3 6 range_lane.

| Station | From level | Facing | Use (feet) | Approach | Contact | Extra | Use time / effect |
|---|---|---|---|---|---|---|---|
| `mat_1` range_lane | 1 | up | 344.4, 311.5 · (-40.3, -60.5) · [-121, -181] | 344.4, 311.5 · (-40.3, -60.5) · [-121, -181] | — | — | 30 min |
| `mat_2` range_lane | 1 | up | 393.4, 330.9 · (8.7, -41.1) · [26, -123] | 393.4, 330.9 · (8.7, -41.1) · [26, -123] | — | — | 30 min |
| `lane_1` range_lane | 2 | up | 386.4, 291.2 · (1.7, -80.8) · [5, -242] | 386.4, 291.2 · (1.7, -80.8) · [5, -242] | — | — | 30 min |
| `lane_2` range_lane | 2 | up | 413.1, 302.9 · (28.3, -69.1) · [85, -207] | 413.1, 302.9 · (28.3, -69.1) · [85, -207] | — | — | 30 min |
| `lane_3` range_lane | 3 | up | 403.1, 282.9 · (18.3, -89.1) · [55, -267] | 403.1, 282.9 · (18.3, -89.1) · [55, -267] | — | — | 30 min |
| `lane_4` range_lane | 3 | up | 426.4, 291.2 · (41.6, -80.8) · [125, -242] | 426.4, 291.2 · (41.6, -80.8) · [125, -242] | — | — | 30 min |

Queue lines (world px, nearest first): **equipment** (416, 402) (438, 402) (460, 402) (482, 402) (504, 402) (526, 402) (548, 402) (570, 402).

### Mess Hall (`mess_hall`, open) on `zone_centre_knoll`

Anchor (art ground pivot) **(704, 514)**, station fit scale 1. Entrance 705, 534 · (1, 20) · [3, 60]; inside-door waypoint 704, 504 · (0, -10) · [0, -30].
Stations per level: L1 1 counter + 6 seat; L2 2 counter + 6 seat.

| Station | From level | Facing | Use (feet) | Approach | Contact | Extra | Use time / effect |
|---|---|---|---|---|---|---|---|
| `counter_1` counter | 1 | up | 744, 446 · (40, -68) · [120, -204] | 744, 456 · (40, -58) · [120, -174] | 744, 434 · (40, -80) · [120, -240] | cook 744,422 | 3 min |
| `counter_2` counter | 2 | up | 720, 446 · (16, -68) · [48, -204] | 720, 456 · (16, -58) · [48, -174] | 720, 434 · (16, -80) · [48, -240] | cook 720,422 | 3 min |
| `seat_1` seat | 1 | up | 650, 470 · (-54, -44) · [-162, -132] | 650, 478 · (-54, -36) · [-162, -108] | 650, 458 · (-54, -56) · [-162, -168] | — | 15 min, +100 energy/h in use |
| `seat_2` seat | 1 | up | 672, 470 · (-32, -44) · [-96, -132] | 672, 478 · (-32, -36) · [-96, -108] | 672, 458 · (-32, -56) · [-96, -168] | — | 15 min, +100 energy/h in use |
| `seat_3` seat | 1 | up | 694, 470 · (-10, -44) · [-30, -132] | 694, 478 · (-10, -36) · [-30, -108] | 694, 458 · (-10, -56) · [-30, -168] | — | 15 min, +100 energy/h in use |
| `seat_4` seat | 1 | up | 650, 500 · (-54, -14) · [-162, -42] | 650, 508 · (-54, -6) · [-162, -18] | 650, 488 · (-54, -26) · [-162, -78] | — | 15 min, +100 energy/h in use |
| `seat_5` seat | 1 | up | 672, 500 · (-32, -14) · [-96, -42] | 672, 508 · (-32, -6) · [-96, -18] | 672, 488 · (-32, -26) · [-96, -78] | — | 15 min, +100 energy/h in use |
| `seat_6` seat | 1 | up | 694, 500 · (-10, -14) · [-30, -42] | 694, 508 · (-10, -6) · [-30, -18] | 694, 488 · (-10, -26) · [-30, -78] | — | 15 min, +100 energy/h in use |

Queue lines (world px, nearest first): **counter** (681, 544) (659, 544) (637, 544) (615, 544) (593, 544) (571, 544) (549, 544) (527, 544).

### Weight Room (`weight_room`, indoor) on `zone_north_terrace`

Anchor (art ground pivot) **(740, 252)**, station fit scale 1. Entrance 742, 272 · (2, 20) · [6, 60].
Stations per level: L1 2 barbell; L2 4 barbell; L3 6 barbell.

| Station | From level | Facing | Use (feet) | Approach | Contact | Extra | Use time / effect |
|---|---|---|---|---|---|---|---|
| `s1` barbell | 1 | up | 680, 224 · (-60, -28) · [-180, -84] | 680, 224 · (-60, -28) · [-180, -84] | — | — | 30 min |
| `s2` barbell | 1 | up | 720, 228 · (-20, -24) · [-60, -72] | 720, 228 · (-20, -24) · [-60, -72] | — | — | 30 min |
| `s3` barbell | 2 | up | 764, 228 · (24, -24) · [72, -72] | 764, 228 · (24, -24) · [72, -72] | — | — | 30 min |
| `s4` barbell | 2 | up | 806, 222 · (66, -30) · [198, -90] | 806, 222 · (66, -30) · [198, -90] | — | — | 30 min |
| `s5` barbell | 3 | up | 700, 184 · (-40, -68) · [-120, -204] | 700, 184 · (-40, -68) · [-120, -204] | — | — | 30 min |
| `s6` barbell | 3 | up | 780, 184 · (40, -68) · [120, -204] | 780, 184 · (40, -68) · [120, -204] | — | — | 30 min |

Queue lines (world px, nearest first): **equipment** (766, 282) (788, 282) (810, 282) (832, 282) (854, 282) (876, 282) (898, 282) (920, 282).

### Obstacle Course (`obstacle_course`, open) on `zone_southwest_flats`

Anchor (art ground pivot) **(401.8, 794)**, station fit scale 1. Entrance 410, 640 · (8.3, -154) · [25, -462].
Stations per level: L1 2 beam; L2 4 beam; L3 6 beam.

| Station | From level | Facing | Use (feet) | Approach | Contact | Extra | Use time / effect |
|---|---|---|---|---|---|---|---|
| `s1` beam | 1 | up | 340, 700 · (-61.7, -94) · [-185, -282] | 340, 700 · (-61.7, -94) · [-185, -282] | — | — | 30 min |
| `s2` beam | 1 | up | 380, 694 · (-21.7, -100) · [-65, -300] | 380, 694 · (-21.7, -100) · [-65, -300] | — | — | 30 min |
| `s3` beam | 2 | up | 424, 694 · (22.3, -100) · [67, -300] | 424, 694 · (22.3, -100) · [67, -300] | — | — | 30 min |
| `s4` beam | 2 | up | 464, 700 · (62.3, -94) · [187, -282] | 464, 700 · (62.3, -94) · [187, -282] | — | — | 30 min |
| `s5` beam | 3 | up | 360, 742 · (-41.7, -52) · [-125, -156] | 360, 742 · (-41.7, -52) · [-125, -156] | — | — | 30 min |
| `s6` beam | 3 | up | 440, 742 · (38.3, -52) · [115, -156] | 440, 742 · (38.3, -52) · [115, -156] | — | — | 30 min |

Queue lines (world px, nearest first): **equipment** (434, 650) (456, 650) (478, 650) (500, 650) (522, 650) (544, 650).

### Combat Drill Yard (`drill_yard`, open) on `zone_riverside`

Anchor (art ground pivot) **(961.3, 790)**, station fit scale 1. Entrance 962, 632 · (0.8, -158) · [2, -474].
Stations per level: L1 2 drill_post; L2 4 drill_post; L3 6 drill_post.

| Station | From level | Facing | Use (feet) | Approach | Contact | Extra | Use time / effect |
|---|---|---|---|---|---|---|---|
| `s1` drill_post | 1 | up | 900, 690 · (-61.2, -100) · [-184, -300] | 900, 690 · (-61.2, -100) · [-184, -300] | — | — | 30 min |
| `s2` drill_post | 1 | up | 940, 684 · (-21.2, -106) · [-64, -318] | 940, 684 · (-21.2, -106) · [-64, -318] | — | — | 30 min |
| `s3` drill_post | 2 | up | 984, 684 · (22.8, -106) · [68, -318] | 984, 684 · (22.8, -106) · [68, -318] | — | — | 30 min |
| `s4` drill_post | 2 | up | 1026, 690 · (64.8, -100) · [194, -300] | 1026, 690 · (64.8, -100) · [194, -300] | — | — | 30 min |
| `s5` drill_post | 3 | up | 920, 734 · (-41.2, -56) · [-124, -168] | 920, 734 · (-41.2, -56) · [-124, -168] | — | — | 30 min |
| `s6` drill_post | 3 | up | 1004, 734 · (42.8, -56) · [128, -168] | 1004, 734 · (42.8, -56) · [128, -168] | — | — | 30 min |

Queue lines (world px, nearest first): **equipment** (986, 642) (1008, 642) (1030, 642) (1052, 642) (1074, 642) (1096, 642) (1118, 642) (1140, 642).

### Wash Block (`showers`, indoor) on `zone_knoll_east`

Anchor (art ground pivot) **(1006.3, 510)**, station fit scale 1. Entrance 1006, 530 · (-0.2, 20) · [-1, 60]; inside-door waypoint 1006.3, 504 · (0, -6) · [0, -18]; aisle 1006.3, 452 · (0, -58) · [0, -174].
Stations per level: L1 2 toilet + 1 basin + 2 shower; L2 3 toilet + 2 basin + 2 shower; L3 3 toilet + 3 basin + 3 shower.

| Station | From level | Facing | Use (feet) | Approach | Contact | Extra | Use time / effect |
|---|---|---|---|---|---|---|---|
| `toilet_1` toilet | 1 | up | 952.3, 428 · (-54, -82) · [-162, -246] | 952.3, 446 · (-54, -64) · [-162, -192] | — | stall centre 952.3,428 | 8 min, +15 hygiene, privacy door |
| `toilet_2` toilet | 1 | up | 974.3, 428 · (-32, -82) · [-96, -246] | 974.3, 446 · (-32, -64) · [-96, -192] | — | stall centre 974.3,428 | 8 min, +15 hygiene, privacy door |
| `toilet_3` toilet | 2 | up | 995.3, 428 · (-11, -82) · [-33, -246] | 995.3, 446 · (-11, -64) · [-33, -192] | — | stall centre 995.3,428 | 8 min, +15 hygiene, privacy door |
| `basin_1` basin | 1 | up | 958.3, 480 · (-48, -30) · [-144, -90] | 958.3, 480 · (-48, -30) · [-144, -90] | 958.3, 468 · (-48, -42) · [-144, -126] | — | 4 min, +10 hygiene |
| `basin_2` basin | 2 | up | 980.3, 480 · (-26, -30) · [-78, -90] | 980.3, 480 · (-26, -30) · [-78, -90] | 980.3, 468 · (-26, -42) · [-78, -126] | — | 4 min, +10 hygiene |
| `basin_3` basin | 3 | up | 1032.3, 480 · (26, -30) · [78, -90] | 1032.3, 480 · (26, -30) · [78, -90] | 1032.3, 468 · (26, -42) · [78, -126] | — | 4 min, +10 hygiene |
| `shower_1` shower | 1 | up | 1060.3, 428 · (54, -82) · [162, -246] | 1060.3, 446 · (54, -64) · [162, -192] | — | stall centre 1060.3,428 | 10 min, +30 hygiene, privacy door |
| `shower_2` shower | 1 | up | 1038.3, 428 · (32, -82) · [96, -246] | 1038.3, 446 · (32, -64) · [96, -192] | — | stall centre 1038.3,428 | 10 min, +30 hygiene, privacy door |
| `shower_3` shower | 3 | up | 1017.3, 428 · (11, -82) · [33, -246] | 1017.3, 446 · (11, -64) · [33, -192] | — | stall centre 1017.3,428 | 10 min, +30 hygiene, privacy door |

Queue lines (world px, nearest first): **toilet** (1030, 540) (1052, 540) (1074, 540) (1096, 540) (1118, 540) (1140, 540) (1162, 540) (1184, 540); **basin** (982, 540) (960, 540) (938, 540) (916, 540) (894, 540) (872, 540); **shower** (1030, 562) (1052, 562) (1074, 562) (1096, 562) (1118, 562) (1140, 562) (1162, 562) (1184, 562).

### Rec Room (`rec_room`, indoor) on `zone_east_meadow`

Anchor (art ground pivot) **(1242.8, 478)**, station fit scale 1. Entrance 1240, 498 · (-2.7, 20) · [-8, 60].
Stations per level: L1 6 bench.

| Station | From level | Facing | Use (feet) | Approach | Contact | Extra | Use time / effect |
|---|---|---|---|---|---|---|---|
| `s1` bench | 1 | down | 1190, 448 · (-52.7, -30) · [-158, -90] | 1190, 448 · (-52.7, -30) · [-158, -90] | — | — | 20 min, +12 morale |
| `s2` bench | 1 | down | 1226, 454 · (-16.7, -24) · [-50, -72] | 1226, 454 · (-16.7, -24) · [-50, -72] | — | — | 20 min, +12 morale |
| `s3` bench | 1 | down | 1262, 454 · (19.3, -24) · [58, -72] | 1262, 454 · (19.3, -24) · [58, -72] | — | — | 20 min, +12 morale |
| `s4` bench | 1 | down | 1298, 446 · (55.3, -32) · [166, -96] | 1298, 446 · (55.3, -32) · [166, -96] | — | — | 20 min, +12 morale |
| `s5` bench | 1 | down | 1210, 406 · (-32.7, -72) · [-98, -216] | 1210, 406 · (-32.7, -72) · [-98, -216] | — | — | 20 min, +12 morale |
| `s6` bench | 1 | down | 1280, 406 · (37.3, -72) · [112, -216] | 1280, 406 · (37.3, -72) · [112, -216] | — | — | 20 min, +12 morale |

Queue lines (world px, nearest first): **bench** (1264, 508) (1286, 508) (1308, 508) (1330, 508) (1352, 508) (1374, 508).

### Fixed sizes and layers

| Item | World size | Export px (3/world) | Layers |
|---|---|---|---|
| Single bed | 46 × 18 (lying axis east–west, heads to the centre aisle) | 138 × 54 | bed back (frame, mattress, pillow), **blanket/front rail** drawn over the sleeper's body; lying soldier = a **wider cell** (suggest 384 × 256, pivot at the body centre) |
| Toilet / shower stall | 20 wide × 24 deep, door on the south side | 60 × 72 | stall back (walls, fixture), **door open** and **door closed** states, occupied indicator, shower **water** separate and only in use |
| Wash basin | 16 × 8 basin at `contact` | 48 × 24 | basin back, **basin front** over the user's legs |
| Serving counter | 20 × 8 at `contact` | 60 × 24 | counter back (cook side), **counter front** over the soldier's legs; cook idle/serve; tray full/empty |
| Dining table | 70 × 10, three seats on its south side 22 px apart | 210 × 30 | table back, **table front** over seated legs; trays sit at seat `contact` (12 px north of the seat) |
| Rec bench | at the rec-room slots | — | bench back/front (09D) |

Capacity comes **only** from the counts above. Decorative copies in art (an extra bed, a painted chair) add no places — don't paint more usable-looking stations than the level has, or mark extras as clearly decorative.

## Action list for the first four-soldier day (P0/P1 from `art/DAILY_BASE_ACTION_ASSETS.md`)

| Priority | Set | Where it plays (anchor above) | Facing | Notes |
|---|---|---|---|---|
| P0 | Walk down/up/right (+ reviewed left mirror), 6 frames, alternating legs | Everywhere | all | Still the blocker for everything; same identity/accent as every action below |
| P0 | Idle/wait, 2 frames | Queue lines, parade ground, bed prep, applicant line | down/up/right | Queues face up (toward the facility) |
| P1 | Get into bed 4 / sleep 2 / get out 4 | Barracks `bed_*` use point, from the `approach` point at the aisle | lying east–west, head to the aisle | Body centre on the mattress at the use point; wider cell |
| P1 | Toilet/shower stall: enter/leave (walk) + door states | Wash Block `toilet_*` / `shower_*` | up into the stall | The person is hidden once the door closes |
| P1 | Wash at basin, 4 | `basin_*` | up | Hands meet the basin at `contact` |
| P1 | Collect meal at counter, 4 | `counter_*` | up | Reach → receive tray → withdraw; hands at `contact`; cook at `cook` hands over on frame 2 |
| P1 | Carry tray walk down/up/right, 6 | counter → seat | all | Reuse the approved gait; only arms/tray change |
| P1 | Sit down 4 / eat 4 / rise 4 | `seat_*` | up (back to camera) | Tray on the table at `contact`; table front overlaps hands/tray correctly |
| P2 | Range fire 4, barbell lift 4–6 | `mat_*` / `lane_*`, weight-room `s*` | up | 09D; range lanes for level 2–3 are only ~19–29 px apart — **re-space to ≥ 30 px** when the range kit is repainted |

## Open geometry questions (need a decision before painting)

1. **Barracks beds beyond six.** River bend fits the six single beds above; the unit cap is 10 at Barracks level 1 and 20 at level 3. Soldiers without a bed sleep on a bedroll on the parade ground at half effect (explicit, own spot). Options: bunk beds (adds a climb action), a second barracks building, or larger barracks levels on a bigger site. Recommendation: decide before Codex paints the barracks interior.
2. **Mess art.** The provisional open-sided mess was painted for North terrace; the starter layout puts the mess on Centre knoll (smaller). It needs a new kit painted to the counter/table positions above.
3. **Range lanes** (P2): level 2–3 lanes are too close; re-space with the 09D range kit.

## Screen-scale screenshots

Captured from the running game by `node tools/capture-daily-base.cjs` (desktop 960 × 576 canvas) and `--phone` (390 × 844). Everyone stands where the simulation put them; placeholders are marked.

| Scene | Desktop | Phone | What to look at |
|---|---|---|---|
| Applicants at the guardhouse (06:12) | [gate-applicants](../docs/screenshots/2026-10-01-daily-base/gate-applicants.jpg) | [phone](../docs/screenshots/2026-10-01-daily-base/gate-applicants-phone.jpg) | Four applicants outside the boom, first at the west window |
| Bathroom queue (06:25) | [bathroom-queue](../docs/screenshots/2026-10-01-daily-base/bathroom-queue.jpg) | [phone](../docs/screenshots/2026-10-01-daily-base/bathroom-queue-phone.jpg) | Both WC stalls closed and occupied, two queuing outside, door plate WC/WS/SH |
| Breakfast (07:15) | [breakfast-counter](../docs/screenshots/2026-10-01-daily-base/breakfast-counter.jpg) | [phone](../docs/screenshots/2026-10-01-daily-base/breakfast-counter-phone.jpg) | Counter + cook placeholder, tray carried, seated eater cut at the table line |
| Morning training (09:06) | [range](../docs/screenshots/2026-10-01-daily-base/morning-training-range.jpg), [weights](../docs/screenshots/2026-10-01-daily-base/morning-training-weights.jpg) | [range](../docs/screenshots/2026-10-01-daily-base/morning-training-range-phone.jpg), [weights](../docs/screenshots/2026-10-01-daily-base/morning-training-weights-phone.jpg) | Two different station types in use |
| Showers (20:21) | [shower-stalls](../docs/screenshots/2026-10-01-daily-base/shower-stalls.jpg) | [phone](../docs/screenshots/2026-10-01-daily-base/shower-stalls-phone.jpg) | Closed shower door with water; one walking in, one queuing |
| Bedtime (23:12) | [bedtime-barracks](../docs/screenshots/2026-10-01-daily-base/bedtime-barracks.jpg) | [phone](../docs/screenshots/2026-10-01-daily-base/bedtime-barracks-phone.jpg) | Four soldiers lying in their own bunks, two empty |
| Six soldiers, lunch (12:33) | [six-lunch-shortage](../docs/screenshots/2026-10-01-daily-base/six-lunch-shortage.jpg) | [phone](../docs/screenshots/2026-10-01-daily-base/six-lunch-shortage-phone.jpg) | Counter queue along the mess front |
| Debug overlay | [overview-debug](../docs/screenshots/2026-10-01-daily-base/overview-debug.jpg) | [phone](../docs/screenshots/2026-10-01-daily-base/overview-debug-phone.jpg) | Stations (pink), queue spots (yellow), parade ground (blue), zones and trails |

`?debug=scene` (or G) shows the same overlay in the game. Continuous clips around activity transitions are still to do for the visual gate (they need the walk set first).

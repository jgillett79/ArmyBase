# Gate art integration and trials — review (27 September 2026)

This records the integration of `art/production/GATE_CONTRACT_HANDOFF.md` and the trial of `art/production/TERRAIN_AND_WALK_HANDOFF.md`, all against the running game. Nothing here is marked production.

| Asset | Result | Status now |
| --- | --- | --- |
| Bridge back/front | In game at the supplied pivots. People walk on the deck; the near rail draws in front; both abutments sit on dry bank | **provisional** (procedural bridge remains the fallback until the images load) |
| Kiosk back/front | In game at ground pivot (70, 590). Doesn't touch the trail or the check-in stop | **provisional** |
| Swinging boom + fixed post | In game: opens as a visitor's check-in ends or while anyone crosses the gap, closes when clear. Presentation only, not saved | **provisional**, with one caveat (below) |
| Nine `scene_*_3x.png` | Same 12 placements; sharp at zoom 1.6 | **provisional**; the old 1× cleaned copies were removed |
| Terrain strips | Trial only, with `?art=candidates`; the default game keeps procedural edges | **candidate** |
| `soldier_walk_down_painted_candidate` | Registered as the down-walk candidate (v2, replacing the rig's v1 strip) | **candidate** |

Evidence (`docs/screenshots/2026-09-27-*`):
- `gate-art-sequence-1.6x.jpg`: four moments (paused at the closed boom, swinging, walking through, on the bridge).
- `gate-art-home-960x576.jpg` and `gate-art-phone-portrait.jpg`: a visitor on the bridge at the default desktop and phone cameras.
- `gate-art-checks.txt`: 8/8 passes.
- `terrain-trial-*.jpg`: procedural vs strips, same view.
- `walk-v2-steps-1.6x.jpg` and `walk-v2-clip-contact.jpg`.

The clips stay local in `captures/` (`gate-art/gate-clip.webm`, `walk-clip/walk-clip-30s.webm`). Regenerate everything with `node tools/capture-gate-art.cjs`, `tools/capture-terrain-trial.cjs` and `tools/capture-walk-clip.cjs`.

## Changes the art needed

1. **Hinge point.** The contract meant `boomHinge` (40, 632) as the hinge's *ground* point. The handoff pinned the raised pin there instead, which put the post's foot south of the trail. The closed pole then covered only half the trail and read as an upright post. The game now stands the post's `ground` pivot on (40, 632) and draws the pin 19 world px above it. The supplied pivots are used unchanged.
2. **Boom axis.** The pole is drawn rising about 8° to the right. That measured axis is registered (`axisDeg: -8`) so the swing turns the pole's real axis to exactly east (open) and north (closed). The image is not distorted.
3. **Check-in stop.** Visitors used to pause on the `gate` node, exactly where the closed boom lies. They now stop outside the barrier at (20, 611) (`WORLD.checkpoint.pause`) and walk through once it opens. The activity test covers this.

**Boom caveat:** in this top-down camera a closed pole pointing north projects straight up the screen, so at rest it still resembles an upright striped post. A contact shadow is drawn, and in motion the swing makes it clear. What would settle it is a small receiving fork post on the trail's north edge, where the closed tip rests.

The 3× props at their existing spots put the fence post (64, 656), the lamp (100, 642) and the boom post in a row near the gate. That's cluttered; consider moving the fence post.

## Terrain strip trial

Method: faces are vertical in this camera, so strips are never rotated. Each is draped in 2-world-px columns along the authored outline, with its `edgeRow` on the contour and texture taken from world x (seamless every 128 world px). Strips are applied only where the contour is within about 37° of horizontal and faces the right way: cliff feet facing the camera, and water banks with land above. Everything else stays procedural. The corner pieces are unused, because the drape follows curves continuously.

- **Shore + foam (creek and pond north banks):** a clear improvement over pebbles and rock drops.
- **Cliff face along the long north cliff:** reads as massive rock, better than grey columns.
- **Cliff face on short or turning cliffs (the gate spur):** fails. The painted strip sits directly beside procedural grey side columns and the two styles clash. It needs a *side-facing* face strip (or end caps) so a whole outcrop can be drawn in one style.
- **Steep and diagonal banks (the river):** a draped strip smears into a thin line, which is worse than the procedural rock drops, so these stay procedural at the threshold above.

## Painted down-walk

- `node tools/validate-assets.cjs --gait art/rig/soldier_walk_down_painted_candidate.png 6`: **passes**. Every frame pair differs by ≥ 18% in the legs, and the front foot alternates.
- Measured foot track (`tools/measure-foot-track.cjs`, written to `art/rig/soldier_walk_down_painted_candidate.json`): the planted foot moves 24, 22 | 25, 18 source px per frame against 25 needed. The worst slip is **1.03 world px** at frame 5→6; the others are ≤ 0.44. `validate-assets` reports these as candidate warnings.
- The helmet is fixed on row 30 in all frames (no bob). The trailing foot barely lifts: at frame 4 it is 9 px off the ground, where the template has about 70.
- The accent mask sits 100% on the body with an identical position in all six frames (no drift).
- In game (1.6× strip and 30-second clip at zoom 1), the figure stays on its ground point with alternating legs, no hovering and a consistent face and kit through the down leg.
- **Why it stays candidate:** up/right and idle still use the older tinted stills and the rig's idle, so the soldier changes appearance when direction changes. The frame 5→6 slip and the low trailing foot are worth one correction pass. The accent mask is not yet applied in rendering (the candidate draws untinted).

## Noticed in passing

- Soldier labels step apart when people overlap, but in a walking pair they hop between positions from frame to frame (visible in the step strip). Label placement should be made stable before the Gate 2 clip review.
- Headless software rendering went from 16.7 to 21.6 ms average per frame with the 3× images. Check on a real phone.

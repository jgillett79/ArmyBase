# Brief 04 handoff — asset pipeline and animation playback

## What exists

- **`js/asset-manifest.js`** is the single description of every piece of art:
  - file and version, status, source file, crop, output size, alpha bounds
  - `pivot` (ground contact), `widthRatio`, supported `doorSides`, orientation and light
  - `entrance`, `slots` (with activity and facing), `targets`, and `front` occluder polygons, all in **source px**
  - unit frame sets: stills, walk, idle and activities

  Helper functions:
  - `facilityArtFor(type, zone)`: the anchored art, used only where the zone's door side matches.
  - `facilityArtTransform()`: maps source px to world px.
  - `facilityArtSlots()`: the art's slots in world px. `GameState.facilitySlots()` prefers these over the zone's generic anchors.
- **`tools/prepare-art.cjs`** is non-destructive, running over `art/` and writing to `assets/`:
  - crop
  - alpha cleanup: ≥ 224 becomes 255, ≤ 16 becomes 0
  - erase painted effects
  - equal frame boxes on a shared pivot
  - resample, then export WebP
  - review sheets in `art/review/*.jpg`: checkerboard with anchors, plus a game-scale comparison of people at 44 vs 60
- **`tools/validate-assets.cjs`** is the one-command check, and exits non-zero on failure:
  - statuses and files; anchors inside the crop; art slots inside every compatible zone footprint
  - the default zone supports the art
  - the service-worker list is complete
  - pixels: size, genuine alpha, soft-pixel ratio, no edge contact, equal frames, feet on the pivot row
- **`js/animation.js`** does frame playback:
  - Activity frames play while a person is `using` a slot whose activity has an in-use frame set. Durations are per frame, with a per-person phase offset.
  - Walk frames advance by `unit.walkDistance` (one cycle per `strideWorld`), so feet stay planted. Left mirrors right.
  - Effects such as the muzzle flash are drawn separately, from the manifest's `effects` anchor.
  - Any set that is `missing` falls back to the directional still.
- **Rendering** (`render.js`):
  - Facilities use the manifest art: the pivot sits on the zone anchor, and the older sprite is the fallback where orientation doesn't fit.
  - `front` polygons are redrawn over people.
  - Firing cues land on the art's targets.
  - People are `unitWorldHeight` = 44 world px, chosen after the game-scale review.
- **Map changes:**
  - Added a new south-door site, `zone_knoll_east`.
  - Default sites changed: range to `zone_west_rise` (next to the gate), barracks to `zone_centre_knoll`, mess to `zone_north_terrace`, weight room to `zone_knoll_east`.
  - Existing saves keep their stored sites. A range saved on a north-door site keeps the older sprite.

## Status of each study

| Study | Result |
| --- | --- |
| range-interaction | **provisional**: 6 firing slots (2 mats + 4 lane positions), targets, 2 front occluders |
| barracks | **provisional**: indoor (hidden occupants, badge); 6 bunk-wing slots |
| mess-hall | **provisional**: open side with 6 bench places |
| soldier-firing-poses | **candidate**: cleaned 4-frame strip that validates, but a different character from the game's soldiers; preview with `?art=candidates` |
| gate-intake | **needs-regeneration**: barrier arm is baked in |
| terrain-shaped-base | reference only (opaque composite) |

## Missing art

Requested in `art/CHATGPT_FEEDBACK.md`:

- soldier and civilian walk cycles (6 frames × 3 directions) and idle frames
- a firing set drawn with the same character
- identity accent masks
- gate layers
- the five remaining facilities with split roof/front layers
- the terrain/prop kit

The gates from brief 04 that need that art are therefore **not** met yet:

- continuous walk recordings with foot planting
- the gate admission animation
- a coherent full-kit comparison with the concept

The pipeline, validator, playback and fallbacks are in place for when it arrives.

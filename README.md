# Command Base / ArmyBase

Vanilla JS + HTML5 Canvas. No build step, no dependencies. Open `index.html`
in a browser, or serve the folder with any static server.

## Decisions locked so far

- **Unit cap: 20**, gated by Barracks level (base cap 5, +5 per Barracks level, 3 levels = cap 20).
- **Mission resolution: async, black-box.** Press button → squad leaves → returns
  or doesn't, based on stat-weighted %. No mini-game. (Not built yet — Phase 2.)
- **Death → 23h hospital timer**, not permanent. Ad/pay-to-skip is a later hook
  point, not built into Phase 0. This replaces the original "permadeath" idea
  specifically to avoid pay-to-undo-grief monetization.
- **Equipment persists through death** — not implemented yet (Phase 3), but the
  Unit data model already has an `equipment` array so it isn't a rearchitect later.
- **Vehicles**: not in this phase. Data model deliberately doesn't assume
  infantry-only, but nothing vehicle-specific is built yet.
- **Recruitment**: civilians spawn at the base edge (the "bus stop"), walk toward
  an exit, and can be clicked to recruit before they leave. This is the
  "limited by the barracks" mechanic — you can only recruit up to your current cap.

## What's actually in Phase 0

- Grid-based base (20×12 cells)
- Buildings: Barracks only (levels 1–3), placeable, raises cap
- Cash resource with idle/offline trickle (proves the idle-catch-up pattern
  before anything more complex depends on it)
- Civilian spawn + walk + recruit-by-click loop
- Recruited units wander the base indefinitely (placeholder AI — no jobs yet)
- Click any unit → profile panel: name (editable), level, XP, HP, strength,
  accuracy, status
- Save/load via localStorage, with offline elapsed-time catch-up for cash only

## Explicitly NOT in Phase 0 (by design, not oversight)

- Missions
- Any building except Barracks
- Equipment effects
- Promotion / carry-over between bases
- Vehicles
- Real art (everything renders as labelled rectangles/circles)
- Ads / IAP hooks

## Phase 1 — needs, training, day/night cycle (done)

Added on top of Phase 0:

- **Three-clock system** — see the block comment at the top of `state.js`.
  Game day/night is compressed (5 real min = 24 game hours). Hospital
  recovery and the offline-catchup cap are both real-time, uncompressed.
  This boundary is the single most likely place for a future bug — read
  the comment before touching any timing code.
- **Energy stat** (0–100), separate from combat HP. Decays at a flat rate
  per game-hour depending on status (training decays fastest, sleeping
  slowest). Hits 0 → same 23h real-time hospital timer as mission death
  (mission death itself isn't built yet — this is future-proofing).
- **Shooting Range** (buildable, 3 levels, 2 training slots per level) —
  assign an idle unit to it via the profile panel, accuracy climbs while
  they're physically at the building during daytime.
- **Mess Hall** (buildable, single level, unlimited capacity) — units
  auto-route here when energy hits the critical threshold (20), even if
  it means abandoning training mid-session. Consumes Food while eating.
  If Food is at 0, they stand there hungry and keep losing energy — this
  is the intended "you'll die if you don't manage food" consequence,
  softened only by the hospital timer, not prevented.
- **Auto-schedule**: fully automatic. Units decide their own status each
  tick (`Unit.desiredStatus()`) based on energy + time of day + whether
  they have a job assigned. No manual "walk them to the mess hall"
  micromanagement — you were asked which scope you wanted and picked the
  automatic version.
- **Food resource**: cash-purchasable only right now ($1.50/unit, buy in
  batches of 20). No production building yet — see open questions below.

### Known simplification: offline catch-up is one big tick, not sub-stepped

If a unit is training when you log off, the offline catch-up applies the
*entire* elapsed period's training gain and energy decay in one calculation
before checking whether energy went negative — so they'll show maximum
training progress for the period, then get sent to hospital, rather than
realistically stopping training partway through to go eat. Fine for a
prototype. If offline balance ever matters for real, sub-step the catch-up
tick in ~1-game-hour chunks instead of one giant jump.

### Bug found + fixed during this phase (documented so it isn't reintroduced)

Buildings originally got a random ID on every construction. Since
`GameState.load()` creates fresh building instances before restoring their
saved `level`, every reload silently generated new IDs — orphaning any
unit's saved `assignedBuildingId` reference. It didn't crash (the schedule
logic only checks whether a unit *has* an assignment, not which exact ID),
but the Shooting Range capacity check does an exact-ID match for occupancy,
so after any reload the slot limit silently stopped being enforced. Fixed
by giving each building a fixed string ID (`'barracks'`, `'shooting_range'`,
`'mess_hall'`) since each is a singleton. Caught by the save/load smoke
test, not by playing — worth keeping smoke tests for this reason.

## Phase 2 — decisions locked

- **Resources.** Cash covers basic-tier costs (recruits, food, level-1
  buildings). Higher-tier building levels and equipment cost other
  resources instead — Lumber (mid tier), Steel/Coal (top tier), Gems (rare —
  also the cost of Promotion itself). All earned from missions once those
  exist; not implemented yet, this just locks the shape of the economy.
- **Stat-training buildings.** Endurance added as a third trainable stat
  alongside Strength and Accuracy. Weight Room (Strength) and Obstacle
  Course (Endurance) mirror the Shooting Range pattern exactly. Combat
  Drill Yard trains Strength + Endurance together at half the per-stat rate
  of a dedicated building — a breadth/speed trade-off, not strictly better.
- **Passive needs stats.** Hygiene and Morale planned (not built yet).
  Hygiene will feed into Energy's decay rate rather than being an
  independent path to the hospital, to keep "Energy hits 0 → hospital" as
  the single failure funnel instead of stacking multiple stats that can
  each independently kill a unit. Morale will be a soft training-rate
  debuff, not a death path.
- **Base progression / promotion.** Completing Base 1 (all buildings
  maxed + unit cap of 20 reached) unlocks Promotion: pick 2 units to carry
  to Base 2. **Base 1 stays as a legacy base** — it keeps producing its
  passive income, the other 18 units stay there permanently, nobody
  disappears. Bigger bases unlock better missions with better rewards.

## Phase 2 — increment 1 (done): Endurance + new training buildings

- **Endurance** — new trainable stat, same shape as Accuracy (40-60 start,
  grows on level-up, clamped 0-95).
- **Weight Room** (Strength), **Obstacle Course** (Endurance) — same
  mechanical pattern as Shooting Range: 3 levels, 2 slots/level, assign an
  idle unit via the profile panel.
- **Combat Drill Yard** — trains Strength + Endurance together, each at
  half the single-stat rate (0.25/game-hour vs 0.5).
- `building.js`'s `ShootingRange`/`WeightRoom`/`ObstacleCourse`/
  `CombatDrillYard` now share a `TrainingBuilding` base class — generalizing
  this was deliberately deferred in Phase 0/1 (see CLAUDE.md) until the
  pattern repeated enough times to justify it; four buildings later, it did.

## Phase 2 — art pass (done): real sprites replace placeholder shapes

- 15 assets generated (6 buildings, 3 civilian outfits, 6 soldier body
  variants) via `tools/generate_assets.py` — a FLUX text-to-image +
  background-removal + desaturation pipeline. Spec lives in `ASSETS.md`.
- `render.js` draws every building/unit as an image, hue-rotating unit
  sprites per-unit (`colorSeed`) the same way the old placeholder circles
  were tinted — the desaturated source art is what makes that work cleanly.
  Falls back to the original procedural shapes until a sprite finishes
  loading, so the game is never blocked on art.
- `unit.js` gained `soldierVariant` (1-6) so each recruit gets a fixed
  body shape from the 6-sprite pack.

## Phase 2 — increment 2 (done): perimeter wall + gatehouse + vacant lots

- The base is now enclosed by a 1-cell wall on all four sides
  (`WALL_THICKNESS`/`GATE_*` constants in `state.js`), with a single gate —
  a 2-cell gap in the **left** wall — as the only way in or out. All
  existing buildings already sat clear of the border, so nothing had to
  move.
- Civilians now always spawn just outside the gate and walk in through it
  (two-stage movement: outside → inside-gate waypoint → random interior
  wander), and route back out through the same gate to leave/despawn,
  instead of the old spawn-from-any-of-4-edges behavior.
- "Not built" building plots now render as a dirt/foundation lot
  (`vacant_lot.png`, one shared asset for all 6 plots) instead of a
  transparent dashed outline — falls back to a procedural dirt-brown fill
  until the art lands.
- `gatehouse.png` and `vacant_lot.png` are spec'd in `ASSETS.md` but not
  yet generated — the game runs fine without them (procedural fallback),
  no urgency.
- At the time this increment shipped, units still walked in a straight
  line to their target — see increment 3 below, which replaced that.

## Phase 2 — increment 3 (done): road network + path-following movement

- Fixed "comb" road network (`ROAD_Y_SPINE` + `buildingDoor()` in
  `state.js`): one horizontal spine road plus a vertical spoke under each
  column of buildings (row-1/row-2 buildings share an x per column, so one
  spoke serves both). No real pathfinding (A*/Dijkstra) needed — every
  route is the same fixed 3-leg shape (drop to the spine at the unit's
  current x, slide to the target's x, travel to the target), which works
  because the network is a simple comb, not an arbitrary graph. Revisit
  this approach if the base layout ever stops being "one spine + straight
  spokes."
- `Unit` gained real path support (`path`/`setPath`/`advancePath` in
  `unit.js`) — `step()` now consumes as many legs of a route as a tick's
  movement budget allows, which matters for offline catch-up (one huge
  `dt`) landing units at their actual destination instead of stranding
  them mid-road. `isAtTarget()` now also requires the path to be fully
  consumed, so a unit passing near an intermediate waypoint (e.g. the
  spine, en route to a building) doesn't briefly look "arrived" and start
  earning training gain or eating before it's actually there.
- All status-driven movement (train/eat/sleep/idle-wander) and recruiting,
  loading a save, and waking up from the hospital now route through
  `GameState.routeForStatus()` onto the road network — idle wander now
  picks a random point *on the road*, not anywhere in the bounds.
- **Deliberately NOT built here**: the recruit-walks-to-Barracks-then-
  changes-uniform moment, and the full daily schedule (showers/rec room
  sequencing) — both were waiting on this increment to look right, and
  are next (see open questions).

## Phase 2 — increment 4 (done): recruit → walk to Barracks → uniform change

- New `UNIT_STATUS.RECRUITING`. `recruit()` no longer flips a civilian to
  a soldier instantly — it counts against the roster cap immediately
  (cash is already spent) but keeps its civilian outfit and walks to the
  Barracks first. The uniform swap happens exactly on arrival, gated by
  `Unit.isAtTarget()`'s full-path-consumed check (see increment 3), not
  just "close enough."
- `render.js`'s sprite/saturation dispatch changed from `unit.isCivilian`
  to `unit.outfit !== 'uniform'` — needed because a RECRUITING unit has
  `isCivilian = false` already but should still render with its civilian
  sprite until the swap. `assignToBuilding()` and the profile panel's
  training-assign buttons now also lock out RECRUITING units, same as
  HOSPITAL, so a mid-walk-in recruit can't be redirected to training
  before they've technically enlisted.
- Energy still decays and the hospital check still applies during the
  walk-in (mirrors the general tick loop) — RECRUITING bypasses
  `desiredStatus()` entirely (like HOSPITAL does) so nothing can redirect
  an enlisting unit mid-walk before they arrive.

## Phase 2 — art pass 2 (done): isometric characters + terrain wired in

- All 32 new assets (gatehouse, vacant lot, 3 terrain textures, 27
  directional character sprites) generated and wired into `render.js`.
- `Unit` gained `facing` (`unit.js`) — derived from the dominant axis of
  the current movement delta each `step()`, only updates while actually
  moving so a stationary unit keeps its last direction. `UNIT_SPRITES`
  restructured to a per-identity `{down, up, right, fallback}` set;
  `unitSprite()` picks the direction for `unit.facing`, mirroring the
  `right` sprite horizontally for `left` (no dedicated left art — see
  `ASSETS.md`) via a `ctx.scale(-1, 1)` around the unit's own draw
  position, and falls back to the old single-pose sprite if a specific
  directional file isn't loaded yet.
- Ground/wall/road are now `ctx.createPattern()` fills instead of flat
  colors, scaled 0.25× (assets are generated at 4× display size, same
  convention as everything else) via `CanvasPattern.setTransform()`.
  Patterns are cached per-key after first successful creation. Grid lines
  and the dashed road centerline stay as procedural overlays on top.
- Gatehouse and vacant-lot art needed no code changes at all — the
  sprite-slot-with-fallback pattern built when they were still
  placeholders picked them up automatically once the files existed.

## Phase 2 — increment 5 (done): Missions

- New `js/mission.js` — pure data + pure functions (`MISSION_TIERS`,
  `unitMeetsMissionRequirements`, `missionSuccessChance`), no game state.
  One difficulty ladder, 4 tiers (Local Patrol → Supply Run → Fortified
  Outpost → High-Value Target), each gating on **both** `minLevel` and
  `minStatAvg` (average of strength/accuracy/endurance) — leveling alone
  doesn't qualify a unit, they need actual training-building investment
  too. Squads are 1-4 units; `maxSquadSize` lives per-tier so a later,
  bigger tier can raise it without a schema change.
- Real-time duration (same `Date.now()`-based pattern as the hospital
  timer, not the compressed game clock — three-clocks rule applies).
  New `UNIT_STATUS.ON_MISSION`, excluded from the normal tick loop
  entirely (no movement/energy/training while away) and not rendered —
  async/black-box by design, no travel to visualize.
- Failure reuses `Unit.sendToHospital()` verbatim — same 23h no-permadeath
  consequence as any other failure in this game, not a harsher one.
  Success reuses `routeForStatus()` to send the unit back into normal
  base life, reappearing at the gate (same convention as a fresh recruit
  walking in).
- HUD gained Lumber/Steel/Gems displays and a Missions button opening a
  new panel: tier list with live eligible-unit counts, squad selection
  with a live success-chance preview, and an active-missions list with
  time remaining.

## Phase 2 — increment 6 (done): Daily schedule + Hygiene/Morale

- New `UNIT_STATUS.HYGIENE`/`RECREATION`, plus `Unit.hygiene`/`morale`
  (0-100, start at 100). `DAILY_SCHEDULE` in `unit.js` is a fixed table of
  `{start, end, status}` blocks in **game-clock** hours (compressed, not
  real time — three-clocks rule applies): sleep 22:00-06:00, eat 06:00-08:00,
  shower 08:00-09:00, train 09:00-12:00, eat 12:00-13:00, train 13:00-17:00,
  recreation 17:00-20:00, eat 20:00-22:00. `scheduledStatusFor(hourOfDay)`
  handles the midnight-wrapping sleep block (`end > 24`).
- `Unit.desiredStatus(hourOfDay)` (signature changed from the old
  `isDaytime` boolean) checks the energy-critical override first, then the
  schedule; a unit whose scheduled block is TRAINING but who isn't assigned
  to a training building falls back to IDLE rather than standing at a
  building with no job.
- **Hygiene feeds Energy's decay rate, per the locked design — it is NOT a
  second death path.** Below `HYGIENE_LOW_THRESHOLD` (30), Energy decays
  1.5x faster regardless of status. **Morale softly reduces training
  gain** — below `MORALE_LOW_THRESHOLD` (30), stat gain from training is
  halved. Neither stat can send a unit to the hospital on its own; "Energy
  hits 0" stays the single failure funnel this game already committed to.
- New `NeedsBuilding` base class (`building.js`) generalizes `MessHall`
  alongside the two new buildings it now shares a shape with: `Showers`
  (100 cash, Hygiene climbs while a unit is there during its Hygiene
  block) and `RecRoom` (100 cash, Morale climbs the same way during
  Recreation). Both sit below the road spine, reusing the existing spoke
  x-positions (`routeTo()`'s spine-then-target shape already works in
  either direction).
- HUD gained Showers/Rec Room build buttons (generic `needsBuildingUi`
  loop shared with Mess Hall — no more bespoke per-building click
  handlers); the unit profile panel gained Hygiene/Morale bars.
- Render fallback: `showers.png`/`rec_room.png` aren't generated yet, so
  both draw as a procedural colored box with a label until the art lands —
  same zero-code-change pattern used for every other not-yet-generated
  asset this project has hit.
- Tested headlessly (schedule covers all 24h incl. midnight wrap; a unit
  cycles through every scheduled status across a simulated day; low
  hygiene measurably speeds energy decay; low morale measurably slows
  training gain; unassigned units stay IDLE during train blocks) and via
  Playwright (Showers/Rec Room render, a unit's status label updates
  correctly as the game clock is advanced through each block).

## Phase 2 — increment 7 (done): Entrance Hall + waiting chairs

- Civilians used to enter the gate, pick one random point anywhere inside
  the walls, and stand there — user feedback called this out as "aimless."
  They now walk to a fixed waiting chair in a new Entrance Hall building
  instead, same idea as any other job/need routing to a fixed spot.
- New `EntranceHall` (`building.js`) — unlike every other building, it's
  **not** purchasable/upgradeable: level is forced to 1 in the constructor
  (cost 0), so it's present from the start, same "fixed part of the base"
  idea as the perimeter wall/gatehouse. It fills the 9th slot of the
  existing 3x3 building grid (row 3, same column as Mess Hall/Drill Yard),
  so it needed zero new placement/road-spoke logic.
- `ENTRANCE_HALL_CHAIRS` (`state.js`) is 4 fixed pixel offsets from the
  building's door. `assignChair()`/`releaseChair()` track which unit (by
  id) occupies which chair in `chairOccupants`. Civilians claim a chair the
  moment they cross the gate and release it either on being recruited or
  on timing out and leaving; `spawnCivilianIfRoom()`'s concurrent-civilian
  cap is now tied to `ENTRANCE_HALL_CHAIRS.length` instead of a hardcoded
  number, so the spawn rate can't outpace actual seating. If every chair's
  taken by civilians still mid-walk, a new arrival waits just inside the
  gate rather than crossing the base with nowhere to sit.
- Initially shipped with no new character art — civilians rendered with
  their existing directional sprites, just standing at the chair pixel
  positions instead of a random point. A follow-up pass (below) added a
  dedicated seated pose. `ASSETS.md` gained one new building sprite,
  `entrance_hall.png` (spec calls for painted-in chairs so the standing
  sprites read as "seated"); renders as the usual procedural fallback box
  until generated.
- Tested headlessly (spawn cap matches chair count, a civilian who crosses
  the gate gets assigned a real chair and walks to its exact position,
  recruiting or timing out frees the chair, two simultaneous civilians get
  two distinct chairs) and via Playwright (3 civilians spawn and visibly
  spread across 3 distinct chairs in the rendered Entrance Hall).

## Phase 2 — increment 7b (done): civilian sitting pose

- Follow-up to increment 7 — user feedback that standing at the chair
  looked stiff. `render.js`'s `isSeatedCivilian()` checks both that a
  civilian has a chair assignment AND has actually finished walking to it
  (`isAtTarget()`) before swapping to a seated sprite — mid-walk-in they
  still use the normal directional sprites.
- Only civilians get a sitting pose — soldiers never use the waiting
  chairs — so this is 3 new files (`civilian_sitting.png`,
  `bus_rider_sitting.png`, `taxi_sitting.png`), not a full direction-times-
  identity set. It's a single fixed forward-facing orientation (a seated
  figure doesn't turn to face a direction of travel), so `drawUnit()`'s
  left-mirror is skipped while seated. Falls back to the normal standing
  sprite if the art isn't loaded, same as everything else in `render.js`.
- Tested via Playwright (seating requires both a chair assignment and
  having arrived, not just one or the other; a soldier never counts as
  seated even with a stray chair index; `unitSprite()` degrades gracefully
  when the sitting art is missing).

## Phase 2 — increment 8 (done): terrain variety

- The whole base used to be one `ground.png` texture tiled everywhere,
  which read as "just a big brown area" (user feedback). `render.js`'s
  new `terrainZoneGrid()` classifies every grid cell into one of 3 zones,
  computed once from the buildings' fixed positions (not hand-authored
  per tile, and not recomputed every frame since positions never change):
  **apron** (a maintained pad around every building — reads as
  cleared/prepared ground), **ground** (the existing dirt texture, kept
  for the road corridor — the spine row + each spoke column — so the road
  still reads as "the path"), and **grass** (open, undeveloped yard —
  everywhere else).
- `ground.png` is still used, not replaced — it's just narrowed to the
  road corridor. Two new textures, `ground_apron.png` and
  `ground_grass.png`, cover the other two zones; each falls back to a
  flat tint color (not a blank canvas) until generated, same
  graceful-degrade pattern as every other asset.
- **Follow-up fix, same increment:** the first pass drew the apron as an
  exact building-footprint-plus-1-cell rectangle, which read as too
  artificially square — a real base, especially one sited in rough or
  mountainous terrain, wouldn't line up so perfectly (user feedback). The
  apron edge now tapers with distance + a deterministic noise function
  (`cellNoise()`/`distanceToNearestBuilding()`) instead of a hard
  rectangle, giving a ragged, organic boundary. `ASSETS.md`'s texture
  prompts were also updated to lean uneven/weathered rather than
  clean/manicured, matching a base dug into rugged terrain.
- **Second follow-up, same feedback pass:** the Entrance Hall (increment
  7) sat at the far right column of the building grid, meaning every
  civilian walked the full width of the base just to reach a waiting
  chair — flagged as "shouldn't let civilians walk so far." Entrance Hall
  and Showers swapped grid slots: Entrance Hall now sits in the column
  closest to the gate, Showers took the far column instead. Soldiers
  already commute similar distances to whichever training building
  they're assigned, so this didn't just relocate the same complaint onto
  a different unit type.
- Tested via Playwright (the zone grid is cached, not recomputed every
  call; a cell on a building's footprint is classified `apron`; a cell far
  from any building/road is classified `grass`; every cell in the grid
  gets exactly one valid zone) — re-ran the increment 7 chair-assignment
  suite too, unaffected by the building-position swap since it always
  reads chair position via `buildingDoor()`, never a hardcoded coordinate.

## Phase 2 — art pass 3 (done): remaining 8 assets generated

- All 8 assets left outstanding from increments 6-8 — `showers.png`,
  `rec_room.png`, `entrance_hall.png`, `ground_apron.png`,
  `ground_grass.png`, and the 3 civilian sitting-pose files — were
  generated and pulled in via `git fetch`/`merge`. Every sprite/pattern
  slot in `render.js` now shows real art; nothing is running on a
  procedural/flat-color fallback anymore.
- Verified file-by-file: correct canonical dimensions and RGBA/RGB mode
  for all 8 (Python/Pillow check), low edge-difference on both new
  tileable terrain textures (no visible seam), zero 404s and zero JS
  errors loading the full game in a real browser (Playwright), and a
  visual check of the Entrance Hall showing 3 civilians correctly seated
  on the chairs painted into `entrance_hall.png`.

## Phase 2 — increment 9 (done): vacant-lot fix, mission XP, Build menu

Three fixes/additions from live feedback the same evening as art pass 3:

- **Fixed `vacant_lot.png` rendering as a mismatched diamond.** The
  generated art turned out to be a rotated isometric diamond tile, not
  the flat rectangular "fills the frame" style every other building
  uses — it looked like a floating shape rather than an empty patch of
  ground next to the real buildings. `drawBuildingBox()` no longer draws
  it at all; unbuilt plots use the existing dashed-outline placeholder
  instead. `ASSETS.md`'s spec for this file now explicitly warns against
  the diamond failure mode for whenever it gets regenerated.
- **Mission XP was completely dead code.** `Unit.level`/`xp`/`xpToNext`/
  `addXp()`/`levelUp()` existed since Phase 0, but nothing in the game
  ever called `addXp()` — units could never level up in practice, despite
  the whole roster having a level system. Each `MISSION_TIERS` entry
  (`mission.js`) now has an `xpReward` range; `resolveMissionForUnit()`
  grants it on success only (same "no reward for failure" rule as
  cash/resources). Mission tier tooltips (`rewardText()` in `main.js`)
  now show the XP reward alongside cash/resources.
- **Consolidated 8 individual HUD build buttons into one Build menu.**
  The top bar had grown a button per building (Barracks, Shooting Range,
  Weight Room, Obstacle Course, Drill Yard, Mess Hall, Showers, Rec
  Room) and didn't scale — user feedback, backed by a quick look at how
  comparable base-builder games handle this (a build menu/panel, not a
  row of top-bar tiles). A single "Build" button now opens a panel
  listing every building with its level/cost and a Build/Upgrade button,
  reusing the exact same open/close/render-a-list-into-a-panel pattern
  the Missions panel already established. Caught and fixed a real bug
  during testing: re-rendering the panel's HTML every animation frame
  (60/sec) detached whatever button the player was mid-click on —
  `refreshBuildButtons()` now only re-renders when the whole-dollar cash
  amount actually changes.
- Tested headlessly (every mission tier has a valid xpReward, a
  successful mission grants XP or a level-up, enough successful missions
  actually level a unit up, a failed mission grants no XP but still sends
  the unit to hospital) and via Playwright (Build panel shows all 8
  buildings, clicking a row's button actually upgrades/builds it, closing
  the panel hides it, mission tier tooltips include XP, no page errors
  anywhere in the flow).

## Phase 2 — increment 10 (done): walk-cycle wiring + mission results log

- **Walk-cycle animation, code side.** The frame-timing/toggle system is
  fully built and wired: `Unit.advanceWalkAnim()` (`unit.js`) accumulates
  actual pixels moved and flips `unit.walkFrame` (0/1) every
  `WALK_FRAME_STRIDE_PX` (16px), so the animation speed is tied to real
  movement rather than a fixed timer — a fast unit's legs "move" faster
  than a slow one's. `render.js`'s `unitSprite()` alternates between the
  existing pose and a new `_2`-suffixed frame while a unit is actually
  moving (`!isAtTarget()`); a stationary unit always shows frame 1.
  **Nothing changes visually yet** — the `_2` sprite files don't exist,
  so `spriteReady()` gates every lookup back to the original single pose,
  exactly as before. `ASSETS.md` gained the full spec for the 27 new
  files (9 characters x 3 directions, one new "opposite-stride" frame
  each) — this is the one thing actually worth generating next.
- **Mission results log.** Missions used to resolve completely
  silently — cash/resources/XP changed and a unit either walked back in
  or went to the hospital, but nothing told you it had happened. Every
  `resolveMissionForUnit()` call now pushes a flavor-texted result
  (`mission.js`'s `pickMissionFlavor()`) into `gameState.missionLog`
  (capped at 8, newest first, not persisted — transient like the
  active-missions list), rendered as a new "Recent results" section in
  the Missions panel, color-coded green/red for success/failure.
  `renderMissionLog()` only re-renders when the newest entry's timestamp
  actually changes, not every frame — same fix as the Build panel's
  60fps-innerHTML-replacement bug from increment 9, applied proactively
  here since a static (non-interactive) list doesn't have the
  detached-button failure mode but re-rendering unchanged content 60x/sec
  was still pointless work.
- Tested headlessly (walkFrame toggles between 0/1 while genuinely
  moving, never toggles for a stationary unit, survives a huge single
  dt/offline-catchup-style step without breaking) and via Playwright (a
  resolved mission produces a log entry with the right flavor/rewards,
  the rendered row shows XP earned, zero page errors).

## Phase 2 — increment 11 (done): level-up stat allocation

- Leveling up used to auto-randomize strength/accuracy/endurance gains.
  `Unit.levelUp()` now grants `STAT_POINTS_PER_LEVEL` (3, placeholder)
  unspent points instead — the player chooses where they go via
  `Unit.allocateStatPoint(statName)`. maxHp still grows automatically on
  level-up (a natural toughness increase, not a build choice).
- A gold star renders above any soldier with unspent points (`render.js`,
  procedural — no new art needed, same convention as the hospital ring),
  visible on the map without opening their profile. Clicking the soldier
  opens the existing profile panel, which now shows an "Allocate stat
  points" section (Strength/Accuracy/Endurance buttons) whenever points
  are available, and hides once they're all spent.
- `unspentStatPoints` is persisted through save/load like every other
  per-unit stat.
- Tested headlessly (`levelUp()` no longer touches the 3 stats directly,
  grants the right point total, `allocateStatPoint()` increments the
  right stat and decrements the pool, refuses when the pool is empty or
  the stat name is invalid, accuracy/endurance stay clamped at 95,
  `GameState.allocateStatPoint()` refuses civilians and unknown unit
  ids, `serialize()` includes the new field) and via Playwright (the star
  renders correctly, the panel section shows/hides based on unspent
  points, clicking a button actually increments the stat and updates the
  remaining count).

## Phase 3 (design locked, not built yet): Promotion, multi-base, equipment, classes

A long design conversation settled the shape of the next major feature
set — full reasoning lives in `CLAUDE.md`'s "Decisions already made."
Summary:

- **Promotion**: trigger is all Base 1 buildings maxed + unit cap of 20
  reached (already locked). Exactly 2 chosen units promote to Base 2 with
  everything they have; the other 18 stay at Base 1 permanently. A
  "General" character congratulates the player and prompts the move.
- **Exactly 2 bases total**, not an open-ended ladder.
- **Base 1 stays a real, playable base after Promotion** — visitable,
  its remaining soldiers can still run missions and use weapons, still
  earns cash whether or not you're looking at it. Planned implementation:
  whichever base isn't the active view reuses the existing offline
  catch-up "one big tick" pattern rather than being simulated in real
  time in parallel.
- **Equipment is a per-base inventory with an explicit "ship" action**
  to move resources/weapons between the two bases — not a single global
  pool. Weapons in particular always carry forward (they may become
  real-money purchases later); consumables (grenades) are single-use,
  persistent gear (guns) carries forward. Shipping is instant on visit
  for v1.
- **Base 2 reuses Base 1's existing art for now** — distinct biomes per
  base (snow/sand/forest/mountain) is a real future direction, explicitly
  deferred so Promotion doesn't get blocked on a whole new art pass.
- **Base 2 needs higher soldier/building level caps, ideally new
  building types**, so it reads as "unlocking more" rather than
  "resetting the numbers." Exact caps and new buildings are still open —
  a modest cap raise on existing content is enough for v1.
- **Veteran classes/specializations, wanted.** Proposed roster (tied to
  existing stats, no new systems needed): Marksman (accuracy),
  Heavy Gunner (strength), Scout (endurance), Medic (support — speeds up
  squadmate recovery), Demolitions (equipment specialist). Final list to
  be confirmed once actually built.
- **Parked, not scoped:** a Base 2 "Weapons Factory" building tied to a
  freemium monetization idea (grind hard missions to unlock free basic
  weapon crafting, parallel to weapons sold for real money). No payment
  integration exists in this project — this needs its own scoping pass
  before any of it gets built.

## Phase 3 — increment 1 (done): equipment / armory system

First real piece of Phase 3, built single-base first since Base 2 doesn't
exist yet to ship anything to or from — but the shape is deliberately
ready for that once it does.

- New `js/equipment.js` (same pure-data-and-functions shape as
  `mission.js`) — `EQUIPMENT_CATALOG` currently has `rifle` (persistent,
  +5% mission success while equipped) and `grenade` (consumable, +10%,
  used up the instant a mission carrying it is dispatched, win or lose).
- `GameState.armory` is the per-base inventory — an array of
  `{ id, type, assignedToUnitId }`. **Equipment is deliberately NOT
  something a `Unit` owns outright** — a unit only holds a reference (an
  id) into the armory via `unit.equipment`, per the locked per-base/
  "ship between bases" design (see "Decisions already made" in
  `CLAUDE.md`). `equipUnit()`/`unequipUnit()` manage the
  assignment either direction; `consumeConsumableEquipment()` runs on
  `dispatchMission()` so grenades disappear the moment the squad leaves,
  not on return.
- Equipment currently enters the game only through missions —
  `MISSION_TIERS` gained an `equipmentReward: { type, chance }` field
  (supply_run/fortified_outpost/high_value_target only; the first tier
  doesn't drop gear yet), rolled independently from the cash/XP/resource
  rewards on success. A real "Weapons Factory" build path is the parked
  idea from above, not this.
- `mission.js`'s `missionSuccessChance(tier, squad, equipmentBonus)`
  gained a 3rd optional argument — kept as a plain number the caller
  computes (`state.js`'s `equipmentBonusForUnit()`), so mission.js still
  has zero knowledge of what "equipment" even is, same purity as before.
- Profile panel gained an interactive "Equipped" / "Armory" pair of
  lists (replacing the old static "Equipment: None" text row) — click
  Equip/Unequip on any item, no separate panel needed since a unit is
  already selected whenever the profile is open.
- Caught the same bug class as increments 9-10 a third time: `openProfile()`
  runs every frame to keep HP/energy bars live, which was rebuilding the
  equipment lists' innerHTML 60x/second and detaching whatever
  Equip/Unequip button the player was mid-click on. Fixed the same way —
  `renderProfileEquipment()` now skips the rebuild unless the actual
  equipped/available item lists changed since the last render.
- Tested headlessly (equip/unequip round-trips correctly and refuses
  double-equipping or civilians, `equipmentBonusForUnit()` sums multiple
  items correctly, the bonus actually raises `missionSuccessChance()`'s
  result, a consumable is removed from both the unit and the armory on
  dispatch while a persistent item survives, a mission's equipment
  reward actually adds a new armory item on success, save/load
  round-trips the armory and equipped-item references) and via
  Playwright (the armory/equipped lists render and update correctly
  through a full equip → unequip cycle, no page errors).

## Phase 3 — increment 2 (done): multi-base architecture + Promotion

The biggest architectural change in the project so far — full working
Promotion, start to finish: trigger, UI, and a genuinely separate,
switchable Base 2.

- **Deliberately did NOT refactor `GameState`'s internals into a generic
  multi-base structure.** `GameState` still represents exactly one base,
  completely unaware a second one can exist — every existing method
  (`tick()`, `recruit()`, `dispatchMission()`, all of it) is untouched.
  "Two bases" is handled entirely as a **save-file concern**: one
  localStorage key now holds `{ activeBaseId, bases: { base1, base2 } }`,
  and switching bases means saving the current instance into its slot,
  then loading the other slot as a brand-new `GameState` instance.
  Because loading already runs the offline-catch-up tick using that
  base's own `lastTick`, switching to a base you haven't looked at in a
  while "just works" with **zero new tick-related code** — from that
  base's point of view, "you switched away" and "you were offline" are
  literally the same event. This was a deliberate trade-off over a full
  per-base data refactor: `render.js` and virtually all of `main.js`
  needed **zero changes**, since `gameState.X` still just means
  "whichever base is currently active."
- `GameState.switchTo(currentState, targetBaseId)` — saves current,
  marks the target active, returns a freshly loaded instance for it.
  `GameState.promote(chosenUnitIds)` — validates the trigger + exactly 2
  chosen units, creates Base 2 (`BASE2_LEVEL_CAP = 5`, up from the
  default 3 — the "modest cap raise" per the locked design; new building
  *types* stay deferred), moves the 2 chosen units over with everything
  they have, moves any *equipped* gear with them (unequipped armory
  items stay behind at Base 1 until explicitly shipped later — shipping
  itself isn't built yet, this pass is Promotion only), and persists
  both bases.
- `Barracks.maxLevel` became an instance property (was a hardcoded module
  constant) so Base 2 can raise it without a subclass — `TrainingBuilding`
  already worked this way.
- `canPromote()` — all Base 1 buildings maxed (Barracks + all 4 training
  buildings at max level, Mess Hall/Showers/Rec Room built) and the unit
  cap (20, once Barracks is maxed) reached. A "Promote to Base 2!" button
  appears in the HUD once true; clicking it opens a modal — "A General
  has arrived," congratulatory flavor text, a checkbox list capped at
  exactly 2 soldiers — matching what was asked for almost verbatim.
- A Base 1 / Base 2 switcher appears in the HUD once Base 2 exists.
  Switching (or promoting) closes every open panel and clears selection
  state, since they'd otherwise reference a unit id from the base you
  just left — same idea as clearing selections when a mission panel or
  profile closes.
- `missionLog` is now actually persisted through save/load (previously
  explicitly "transient, not persisted") — now that switching bases
  routes through the same save/load path as a real session boundary,
  losing recent mission history on every switch would have been a
  regression, not a simplification.
- Save format bumped to `armybase_save_v2` (was a flat single-base blob,
  now the multi-base wrapper) — old saves start fresh, same precedent as
  every prior save-shape change in this project.
- Tested extremely thoroughly given the size of this change: 30 headless
  assertions (level cap is applied and survives save/load, the wrapper
  correctly isolates each base's slot, `switchTo()` persists the
  outgoing base and actually runs a real catch-up tick on the incoming
  one, `canPromote()` is accurate in both directions, `promote()` rejects
  every invalid input, moves exactly the right 2 units, moves equipped
  gear but leaves unequipped gear behind, and applies the raised level
  cap) plus a full Playwright run through the real UI (maxing out every
  building, the promote button appearing/opening/enforcing exactly 2
  picks, confirming actually creates and switches to a working Base 2,
  switching back to Base 1 shows the correct remaining 18-unit roster,
  switching back to Base 2 works too) — and the entire pre-existing
  regression suite (every prior increment's tests) re-run clean
  afterward to confirm nothing broke.

## Open questions still remaining for Phase 2/3

1. **Shipping resources/weapons between bases** — the locked design
   wants this, and the armory/per-base-inventory groundwork from Phase 3
   increment 1 is ready for it, but the actual "ship" UI/action isn't
   built yet. Promoted units bring their equipped gear; nothing else
   moves between bases yet.
2. **Exact Base 2 building-level economy** ("costs move up and down,
   takes longer to progress") and any brand-new building designs — user
   explicitly deferred ("we can work that through"). Base 2 currently
   reuses Base 1's exact cost curve, just with a higher level ceiling.
3. **Weapons Factory / freemium weapon-crafting** — parked, not scoped.
4. **Final veteran class roster** — proposed set above, not yet confirmed
   as final.
5. **27 walk-cycle "frame 2" art files** — fully spec'd in `ASSETS.md`,
   code is 100% ready to consume them the moment they land, zero further
   engineering work needed on this side.

## File layout

```
index.html
css/style.css
js/
  utils.js      - id generation, random helpers, clamp
  unit.js       - Unit class: stats, leveling, wander AI
  building.js   - Building class: Barracks logic
  state.js      - GameState: units, buildings, cash, cap, tick, save/load
  render.js     - canvas drawing (grid, buildings, units)
  main.js       - game loop, input handling, profile panel wiring
```

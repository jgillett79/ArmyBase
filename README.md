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
- No new character art — civilians render with their existing directional
  sprites, just standing at the chair pixel positions instead of a random
  point. `ASSETS.md` gained one new building sprite, `entrance_hall.png`
  (spec calls for painted-in chairs so the standing sprites read as
  "seated"); renders as the usual procedural fallback box until generated.
- Tested headlessly (spawn cap matches chair count, a civilian who crosses
  the gate gets assigned a real chair and walks to its exact position,
  recruiting or timing out frees the chair, two simultaneous civilians get
  two distinct chairs) and via Playwright (3 civilians spawn and visibly
  spread across 3 distinct chairs in the rendered Entrance Hall).

## Open questions still remaining for Phase 2

1. **Terrain variety + walk-cycle animation.** User feedback: there's only
   one ground texture across the whole base; units don't have an actual
   walk-cycle (multiple frames per direction), just a static pose per
   facing. Agreed order: terrain variety next (medium effort) → walk
   animation last (most expensive — needs several new frames per direction
   plus frame-timing code).
2. **Promotion mechanics in detail** — the actual UI/flow for choosing 2
   units, what resets on the new base vs. carries over (cash? equipment?),
   and multi-base save-state handling for the legacy Base 1.
3. **`showers.png`/`rec_room.png`/`entrance_hall.png` art** — all three
   spec'd in `ASSETS.md`, not yet generated; the game already renders a
   procedural fallback box for each so this isn't blocking anything.

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

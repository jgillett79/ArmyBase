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
- **Deliberately NOT built here**: actual road/path-following movement.
  Units still walk in a straight line to wherever their current target is
  — the wall/gate only constrain the two endpoints (spawn-outside,
  wander-inside), not the path between them. Real waypoint/road-following
  movement is scoped as its own next increment (see open questions) since
  it's a meaningfully bigger technical lift than anything built so far —
  don't retrofit it piecemeal into other features first.

## Open questions still remaining for Phase 2

1. **Missions.** Percentage-chance resolution, mission list/duration/UI,
   squad selection, and how mission tier gates which resources drop —
   still fully unscoped. Biggest remaining chunk of work, and several
   decisions above (resource tiers, promotion rewards) are written assuming
   missions will justify them.
2. **Road network + path-following movement.** Units currently beeline
   straight to their target with no notion of obstacles, walls, or roads.
   Needed before "units walk along a path around the base" is real, and
   before the recruit-walks-to-Barracks-then-changes-into-uniform moment
   or the full daily schedule (below) will look right rather than janky.
3. **Recruit → walk to Barracks → become a soldier.** Right now `recruit()`
   flips a civilian to a soldier instantly on the popup confirm, wherever
   they happen to be standing. Wants to become: walk to the Barracks first,
   uniform-change happens on arrival. Depends on #2 to look right.
4. **Full daily schedule.** Sleep (Barracks, night) → shower (new Showers
   building, Hygiene) → training → lunch (Mess Hall) → recreation (new Rec
   Room, Morale) → repeat. Hygiene/Morale + Showers/Rec Room are decided in
   shape (see above) but not built; the schedule *sequencing* itself (what
   order, how long at each stop) is a design pass that hasn't happened yet.
5. **Promotion mechanics in detail** — the actual UI/flow for choosing 2
   units, what resets on the new base vs. carries over (cash? equipment?),
   and multi-base save-state handling for the legacy Base 1.

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

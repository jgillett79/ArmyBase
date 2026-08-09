# ArmyBase / Command Base — Project Context

This file is read automatically by Claude Code at the start of every session
in this repo. It exists so you don't have to re-explain the design history —
read it before making changes, especially before "simplifying" anything that
looks over-engineered. Several things that look like over-engineering here
are deliberate, for reasons explained below.

## What this game actually is

An idle army-base builder, but inverted from genre norm: instead of hundreds
of anonymous units, the roster is capped at 20 so each soldier can be
individually named, leveled, and clicked on for a stat profile. The
attachment-to-individual-units mechanic is the entire point of the game —
if a change makes units feel more interchangeable/anonymous, it's working
against the concept, not simplifying it.

Core loop: civilians walk past the base → click to recruit (costs cash,
capped by Barracks level) → assign recruited soldiers to training buildings
→ they level up individual stats → eventually (not built yet) go on missions
with a stat-weighted success chance → return, or don't.

## Decisions already made, with the reasoning (don't relitigate without new info)

- **No permadeath.** Original concept had missions kill units permanently,
  monetized via "pay/watch-ad to resurrect." Rejected: paying to undo grief
  over a character you were deliberately made to feel attached to is a
  known predatory mobile-monetization pattern and a platform-review risk.
  Replaced with: death → 23-hour **real-time** hospital stay, full recovery,
  no stat loss. Ad/pay-to-skip-the-wait can be added later as a convenience
  purchase (skip time), which is a fundamentally different, much less
  predatory mechanic than "pay to undo permanent loss."
- **Same consequence for neglect death.** If a unit's Energy hits 0 from
  poor food/schedule management, they get the *same* 23h hospital stay as
  mission death — not something harsher. Confirmed explicitly by the user;
  don't make starvation-death worse than mission-death, that reintroduces
  the punishing-death problem from a different angle.
- **Unit cap: 20.** Chosen explicitly so units stay individually
  distinguishable on screen. Don't raise this without it being a deliberate
  design decision, not scope creep.
- **Mission resolution (not built yet): async/black-box, not a mini-game.**
  Press a button, squad leaves, returns or doesn't, resolved by a
  stat-weighted percentage. No resolvable combat screen in v1. This was an
  explicit scope decision to avoid building an entire second game (a
  combat/mini-game system) before the core attachment loop is validated.
- **Auto-schedule, not manual job-walking.** Units decide their own status
  every tick (train / eat / sleep / idle) based on energy + time of day +
  whether they have a job assigned. The user was asked "manual assignment
  only" vs "full auto-schedule" and picked full auto. Don't revert to
  manual-only without being asked.
- **Vehicles and missions are still deliberately NOT built.** Each needs
  design decisions that don't have answers yet (see "Open questions"
  below). Resist stubbing these in "while I'm in there" — guessing the data
  shape before the requirement is known is exactly the kind of
  rearchitect-later risk this project has been trying to avoid. (Obstacle
  Course, along with Weight Room and Combat Drill Yard, WAS built in Phase 2
  increment 1 — see below — once its stat/mechanic was confirmed.)
- **The base is walled, single gate, left side.** Perimeter wall on all 4
  sides (`WALL_THICKNESS`/`GATE_*` in `state.js`), one gate — a 2-cell gap
  in the left wall — as the only way in/out. Civilians spawn outside it and
  route through it; recruited soldiers never leave. Built in Phase 2
  increment 2.
- **Road network is a fixed comb, not a general graph — don't add
  pathfinding.** `state.js`'s `ROAD_Y_SPINE`/`buildingDoor()` plus
  `routeTo()`/`routeForStatus()` route every recruited unit via a fixed
  3-leg shape (drop to the spine at the unit's current x, slide to the
  target's x, travel to the target). This works precisely because the
  layout is one spine + straight spokes with no obstacles between them —
  it is NOT a general pathfinding system, and doesn't need to be unless
  the base layout itself stops being a comb (e.g. buildings placeable
  anywhere, or obstacles mid-road). If that ever happens, revisit the
  approach then — don't preemptively generalize to A*/Dijkstra now. Built
  in Phase 2 increment 3, along with real multi-leg path support on `Unit`
  (`path`/`setPath`/`advancePath`) — `step()` fully consumes a route
  within one call so offline catch-up's huge single `dt` lands units at
  their actual destination instead of stranding them mid-road, and
  `isAtTarget()` requires the full path to be consumed so a unit passing
  an intermediate waypoint doesn't briefly look "arrived."
- **Phase 2 resource economy: tiered, not just cash.** Cash covers basic
  costs. Higher-tier building levels/equipment cost Lumber (mid),
  Steel/Coal (top), or Gems (rare — also gates Promotion). Not implemented
  yet — missions have to exist first to pay them out — but the shape is
  locked so later work doesn't have to guess at it.
- **Phase 2 passive needs stats: Hygiene feeds Energy decay, doesn't
  independently kill.** When Hygiene (planned, not built) and Morale
  (planned, not built) are added, Hygiene at 0 should *increase* Energy's
  decay rate rather than being a second independent path to the hospital.
  Keep "Energy hits 0 → hospital" as the single failure funnel — don't let
  new needs-stats each grow their own death path, that re-fragments the
  "no permadeath, one consequence" design this project already settled on.
- **Base 1 becomes a legacy base on Promotion, not abandoned.** When a
  player completes Base 1 (all buildings maxed, unit cap of 20 reached) and
  promotes 2 chosen units to Base 2, the other 18 units stay at Base 1
  permanently — it keeps its passive income, nobody disappears. This was an
  explicit user decision specifically because releasing/deleting the other
  18 would cut against the individual-attachment thesis this whole game is
  built on (see top of this file). Don't quietly change this to "units are
  released" as a save-state simplification later.
- **Base 1 stays a real, playable base after Promotion — not just a
  passive number.** You can still visit it, its remaining 18 soldiers can
  still be dispatched on missions and equipped with weapons, and it keeps
  earning cash in the background whether or not you're currently looking
  at it. Implementation approach (an engineering call, not a separate
  user decision): whichever base ISN'T the one currently being viewed
  reuses the existing offline-catch-up "one big tick" pattern (see the
  three-clocks section) rather than being simulated in real time
  alongside the active base — switching to it catches it up in one call,
  same as reopening the game after time away.
- **Exactly 2 bases, no Base 3 planned.** Don't build the promotion/base
  system as an open-ended N-base ladder — it's a one-time step-up.
- **Equipment is a per-base inventory, not a single shared pool, with an
  explicit "ship" action to move things between bases.** When you visit
  either base you can transfer resources/weapons to the other one —
  weapons in particular carry value (they may become real-money
  purchases later) so they're never destroyed or stranded by a
  promotion, but they still live at whichever base they were shipped to,
  not in some base-agnostic global stash. Shipping is instant on visit
  for now (matches every other instant action already in this game) —
  a real transit-time mechanic is a possible later addition, not
  required for v1.
- **Base 2 reuses Base 1's existing art initially — no new biome art
  yet.** The idea of each base having a distinct landscape (snow / sand /
  forest / mountain) is a real future direction, explicitly deferred —
  don't block shipping the Promotion mechanics on a whole new terrain art
  pass. Revisit once the mechanics are proven.
- **Base 2 needs higher soldier level caps and higher building level
  caps, ideally new building types too** — so Promotion reads as
  "unlocking more," not "starting over with reset numbers." Exact new
  cap values and which new buildings are still open — user explicitly
  deferred the detailed design ("we can work that through"), so don't
  guess specific numbers/buildings without asking; a modest cap raise on
  existing content is enough for a first version.
- **Monetization idea, parked, not scoped:** a Base 2 "Weapons Factory"
  building that lets free-to-play players grind hard-tier missions to
  unlock basic weapon crafting, parallel to weapons potentially being
  sold for real money later. Explicitly not ready to build — no payment
  integration exists in this project at all, and the resource-gating
  design hasn't been worked out. Flagged here so it isn't forgotten, not
  because it's next.
- **Level-up stat allocation.** Replacing the current auto-random stat
  gain in `Unit.levelUp()`: a unit who's leveled up shows a star
  indicator; clicking it lets the player manually choose which stat(s)
  the new point(s) go into, instead of the game rolling it randomly.
- **Classes/specializations for veteran soldiers, wanted but not
  finalized.** User is enthusiastic about this; a proposed class roster
  (tied to the existing strength/accuracy/endurance stats so it doesn't
  need new systems) was drafted in chat — see README once built for the
  actual list shipped.

## Tech constraints — don't introduce a build step

- **Vanilla JS + HTML5 Canvas.** No React, no bundler, no npm dependencies.
  Open `index.html` directly in a browser and it works. Keep it that way —
  this was a deliberate choice for a solo dev shipping fast, not an
  oversight to "fix."
- **No backend.** Save state lives entirely in `localStorage`. If a backend
  or cloud sync ever gets added, that's a real conversation to have first,
  not an assumption to build toward silently.
- **Deployment target:** GitHub Pages / PWA ("Add to Home Screen"), per the
  original Command Base spec this project evolved from. Mobile-first.

## Repo / workflow

- GitHub: `jgillett79/ArmyBase` (public repo, currently has one commit —
  "Phase 0+1" — pushed manually from files handed off in Claude chat,
  since that Claude instance has no git push credentials).
- From here on, Claude Code is the primary build driver. The chat
  interface (claude.ai) is for design discussion, debugging help on
  specific pasted files, and anything needing a broader planning
  conversation — not for ongoing implementation.
- The user is on Windows. Standard `git` / npm-free workflow — no
  Windows-specific tooling has come up yet, but don't assume WSL/Unix-only
  tricks work without checking.

## Architecture map

```
index.html          - canvas, HUD, profile panel, recruit popup markup
css/style.css        - all styling (dark military-adjacent palette)
js/
  utils.js           - id gen, random helpers, name generator
  unit.js            - Unit class: the core data model. Stats, leveling,
                       wander/movement, the day/night schedule state
                       machine (desiredStatus/applyEnergyDelta/etc.)
  building.js        - Barracks, ShootingRange, MessHall classes.
                       IMPORTANT: building IDs are fixed strings
                       ('barracks', 'shooting_range', 'mess_hall'), NOT
                       randomly generated — see "bugs already found" below
                       for why this matters.
  state.js           - GameState: single source of truth. Tick loop, the
                       three-clock system (see below), save/load, resource
                       management (cash, food). Everything else reads this,
                       nothing else owns state.
  render.js           - canvas drawing only. No game logic. Placeholder
                       shapes/colors — no real art yet.
  main.js            - DOM wiring, input handling, game loop driver. Also
                       no game logic — dispatches into state.js.
README.md            - build-phase log, aimed at a human reader (what's
                       built, what's not, open questions per phase)
CLAUDE.md            - this file, aimed at an agent continuing the work
```

## The three-clock system — read this before touching any timing code

This is the single most likely place for a subtle bug, and it's already
bitten once during Phase 1 development (see below). There are three
independent clocks:

1. **Game day/night clock** (`gameState.gameClockMs`) — COMPRESSED. 5 real
   minutes = 24 game hours (compression factor 288×, i.e.
   `GAME_MS_PER_REAL_MS` in `state.js`). Drives training/sleep/schedule
   decisions (`Unit.desiredStatus()`).
2. **Hospital recovery** (`unit.hospitalUntil`) — REAL TIME, uncompressed.
   23 hours real, computed via `Date.now()`, completely independent of the
   game clock's value.
3. **Offline catch-up cap** — REAL TIME. Capped at 24 hours
   (`OFFLINE_CATCHUP_CAP_MS`). Log off, come back within a day, everything
   (including hospital stays) has accrued normally as if you'd left the
   tab open.

**Never derive #2 or #3 from the compressed game clock.** If you're writing
code that computes a duration and it's meant to be real-world time (a
resurrection wait, an offline cap, an ad-cooldown, an IAP timer), use
`Date.now()` directly, not `gameState.gameClockMs`.

## Known simplification: offline catch-up is one big tick

When a save loads after time away, `GameState.tick()` gets called once with
the entire elapsed duration as `dtSeconds`, rather than being sub-stepped.
Practical effect: a unit training while you're offline gets their *entire*
period's accuracy gain calculated before the energy-zero check fires, so
they'll show a big training jump and then immediately go to hospital,
rather than realistically stopping training partway through to eat. This is
an acceptable approximation for a prototype. If offline balance ever
matters for real (e.g. once IAP/ad-revive economics are being tuned),
sub-step the catch-up in ~1-game-hour chunks instead.

## Bugs already found and fixed (context for why the code looks the way it does)

1. **Unit conversion bug**: `gameHours` per tick was originally computed
   1000× too small (a stray missing `* 1000` in the ms/seconds conversion),
   so training and energy decay happened at roughly 1/1000th the intended
   rate. Caught by a headless Node smoke test simulating 300 ticks and
   noticing the numbers barely moved. **Takeaway: keep writing headless
   smoke tests for anything involving the tick/time math** — this class of
   bug is very easy to introduce silently and won't show up from just
   glancing at the code, only from running it.
2. **Building ID instability**: `Barracks`/`ShootingRange`/`MessHall`
   originally generated a random ID (`makeId('bldg')`) on every
   construction. Since `GameState.load()` builds fresh instances before
   restoring saved `level` values, every reload silently generated new IDs
   — orphaning any unit's saved `assignedBuildingId`. It didn't crash
   (the schedule state machine only checks whether a unit *has* an
   assignment, not which specific ID matches), but the Shooting Range
   capacity check does an exact-ID match for occupancy counting, so the
   slot limit silently stopped being enforced after any reload. Fixed by
   giving each building (they're all singletons — there's only ever one of
   each) a fixed string ID instead of a random one.

## How this codebase is meant to be tested

There's no formal test suite/framework set up yet. What's been used so far:
`node --check` on each file for syntax, plus ad-hoc headless simulations
using Node's `vm` module to load the JS files into a sandboxed context with
a `localStorage` stub, then directly exercise `GameState`/`Unit`/building
logic over many simulated ticks and check the resulting numbers make sense.
This caught both bugs above. If you (Claude Code) add a real test runner,
that's a fine upgrade — but keep testing tick/time logic headlessly (no
browser needed) since that's where the bugs actually are.

## Phase 2 progress — see README.md "Phase 2" sections for full detail

Decisions on resources/stats/needs/promotion are locked (see the bullets
above under "Decisions already made"). **Increment 1 done**: Endurance
stat, Weight Room, Obstacle Course, Combat Drill Yard, via a shared
`TrainingBuilding` base class. **Art pass done**: 15 sprites generated and
wired into `render.js` (hue-tinted per-unit, procedural fallback until
loaded). **Increment 2 done**: perimeter wall + single gate (left side) +
vacant-lot plots. **Increment 3 done**: fixed-comb road network + real
multi-leg path support on `Unit` — all status-driven movement now travels
via roads instead of straight lines; see the road-network decision bullet
above before touching any movement/routing code. **Increment 4 done**:
`RECRUITING` status — a recruit now walks to the Barracks (still in
civilian outfit) and only becomes a soldier (uniform swap) on arrival;
`render.js` dispatches sprite/saturation on `unit.outfit`, not
`unit.isCivilian`, because of this transitional state — keep that in mind
if you touch unit rendering. **Art pass 2 done**: isometric characters
(3 unique directions — down/up/right — per identity, `left` is `right`
mirrored in code, no diagonal sprites since the road network never
produces diagonal movement) plus gatehouse/vacant-lot/terrain textures,
all generated and wired into `render.js`. `Unit.facing` (derived from
movement delta in `step()`) drives which directional sprite draws;
ground/wall/road are `ctx.createPattern()` fills now, not flat colors.
**Increment 5 done**: Missions (`mission.js` — 4-tier ladder gated on
level AND trained stats, real-time duration, `UNIT_STATUS.ON_MISSION`
excluded from tick/render, failure reuses `sendToHospital()`, success
reuses `routeForStatus()`). Lumber/Steel/Gems are real tracked resources
now, no longer just a documented decision. **Increment 6 done**: full
daily schedule (`DAILY_SCHEDULE` in `unit.js`, game-clock hours, handles
the midnight-wrapping sleep block) plus Hygiene/Morale as real per-unit
stats — Hygiene below threshold multiplies Energy's decay rate (NOT an
independent death path, per the locked "one failure funnel" decision),
Morale below threshold halves training gain (a soft debuff, also not a
death path). New `NeedsBuilding` base class generalizes `MessHall` with
the two new buildings, `Showers` and `RecRoom`, reusing existing spoke
positions below the road spine. `Unit.desiredStatus()`'s signature changed
from `isDaytime` (bool) to `hourOfDay` (number) — anything still calling
it with the old boolean needs updating. **Increment 7 done**: Entrance
Hall + waiting chairs. New `EntranceHall` (`building.js`) is the one
exception to "every building is purchasable/upgradeable" — level is
forced to 1 in its constructor (cost 0), always present from the start,
same idea as the wall/gatehouse. It fills the previously-empty 9th slot of
the 3x3 building grid, so it needed no new placement/road-spoke logic.
Civilians now claim one of 4 fixed `ENTRANCE_HALL_CHAIRS` (`state.js`)
pixel offsets the moment they cross the gate, instead of picking a random
wander point — `assignChair()`/`releaseChair()` track occupancy in
`chairOccupants`, released on recruit or on timing out. **Increment 7b
done**: civilian sitting pose. `render.js`'s `isSeatedCivilian()` swaps a
waiting civilian to a seated sprite once they've actually arrived at
their chair (`isAtTarget()`, not just having a chair assigned) — a single
fixed orientation, civilians only (soldiers never sit here), so
`drawUnit()`'s left-mirror is skipped while seated. **Increment 8 done**:
terrain variety. `render.js`'s `terrainZoneGrid()` classifies every grid
cell into `apron` (maintained pad around buildings)/`ground` (existing
dirt, kept for the road corridor)/`grass` (open yard), computed once and
cached since building positions are fixed. The apron edge tapers with
distance + a deterministic noise hash (`cellNoise()`) rather than a hard
rectangle — a straight-rectangle first pass read as too artificially
square (user feedback). Same feedback pass also relocated Entrance Hall
from the far column (gridX=14) to the column closest to the gate
(gridX=2), swapping grid slots with Showers — civilians were walking the
full width of the base to reach a waiting chair; **don't move Entrance
Hall away from the gate-adjacent column again without a reason**, that
was a direct fix for "civilians shouldn't walk so far through the base."
**Art pass 3 done**: all 8 remaining assets from increments 6-8
(`showers.png`, `rec_room.png`, `entrance_hall.png`, `ground_apron.png`,
`ground_grass.png`, and the 3 civilian sitting-pose files) generated and
pulled in — every sprite/pattern slot in `render.js` now has real art,
none of it running on procedural fallback. All 46 files in `ASSETS.md`
are done; no outstanding art work from any prior increment. **Increment 9
done** (same evening, live feedback): `vacant_lot.png` turned out to be a
rotated isometric diamond tile rather than the flat rectangular style
every other building uses — `drawBuildingBox()` no longer draws it at
all (falls back to the dashed-outline placeholder); `ASSETS.md`'s spec
now explicitly warns against the diamond failure mode for next time.
Mission XP was wired up for the first time — `Unit.addXp()`/`levelUp()`
existed since Phase 0 but nothing ever called `addXp()`, so units could
never actually level up; each `MISSION_TIERS` entry now has an
`xpReward`, granted on success only. The 8 individual HUD build buttons
(one per building) were consolidated into a single "Build" menu button
opening a panel — reuses the Missions panel's exact open/close/render
pattern; **the Build panel's list only re-renders when the whole-dollar
cash amount changes, not every animation frame** — re-rendering on every
frame was found to detach whatever button the player was mid-click on,
keep that guard if you touch `renderBuildList()`/`refreshBuildButtons()`.
**Increment 10 done**: walk-cycle animation is fully wired code-side —
`Unit.advanceWalkAnim()` toggles `unit.walkFrame` (0/1) by actual pixels
moved (`WALK_FRAME_STRIDE_PX`, 16px), `render.js`'s `unitSprite()`
alternates to a `_2`-suffixed sprite while moving. **This is a no-op
until the 27 `_2` art files exist** — `spriteReady()` gates every lookup,
so today it always resolves back to the single original pose, byte-for-
byte the same rendering as before this increment. `ASSETS.md` has the
full spec (down_2/up_2/right_2 per identity — "opposite stride" pose,
same camera/crop as frame 1). Mission results also got a
`gameState.missionLog` (capped at 8, flavor-texted via
`mission.js`'s `pickMissionFlavor()`) rendered in a new "Recent results"
section of the Missions panel — missions used to resolve completely
silently, this is what actually shows the player something happened.
**Increment 11 done**: level-up stat allocation. `Unit.levelUp()` no
longer auto-randomizes strength/accuracy/endurance — it grants
`STAT_POINTS_PER_LEVEL` unspent points instead, spent via
`Unit.allocateStatPoint(statName)` (`ALLOCATABLE_STATS` = strength/
accuracy/endurance). A gold star renders above any soldier with unspent
points (procedural, no new art); the profile panel gained an "Allocate
stat points" section that shows/hides based on `unit.unspentStatPoints`.
maxHp still auto-grows on level-up — only the 3 allocatable stats moved
to player choice.

## Open questions for Phase 2 — don't guess at these, ask

Promotion's shape and the core equipment model are now locked (see
"Decisions already made" above) — what's genuinely still open:

1. **Exact new level/building caps for Base 2, and any brand-new
   building types** — user explicitly deferred this ("we can work that
   through"). Don't invent specific numbers or new building designs
   without checking first; a modest cap raise on existing buildings is
   enough for a first version.
2. **Weapons Factory / freemium weapon-crafting idea** — parked, not
   scoped. No payment integration exists in this project. Don't start
   building this without a real scoping pass first.
3. **Final class roster for veteran soldiers** — a set was proposed in
   chat (Marksman/Heavy Gunner/Scout/Medic/Demolitions, roughly mapped to
   existing stats); confirm the actual shipped list against README once
   built rather than assuming this doc's mention of it is exhaustive.
4. **Building construction time + an "under construction" art state** —
   raised by the user, not yet scoped. Right now upgrading a building is
   instant (one cash deduction, `building.upgrade()` synchronously).
   Whether to add a real-time build timer (same pattern as the hospital
   timer — `Date.now()`-based, not compressed game-time, per the
   three-clocks rule) and/or a shared "construction in progress" sprite
   (one asset reused across all upgradeable buildings, same idea as
   `vacant_lot.png`) is open — see README for the recommendation given
   (basic gameplay/missions first, this is a polish layer that can come
   later). Note the "takes ages to build" weapon-crafting idea above
   would likely reuse this same timer mechanic once both exist.

## Working style notes for whoever (whichever Claude) picks this up

- The user pushes back hard on scope creep and wants problems/risks
  surfaced before solutions — don't lead with "great idea!", lead with
  what's wrong or unclear about a request before building it.
- Prefer small, testable increments over building several systems at once.
  Phase 0 (data model + placeholder rendering) then Phase 1 (needs/training)
  were kept deliberately separable for this reason.
- When something is a genuine placeholder/guess (a cost number, a decay
  rate, a capacity), say so in a code comment. Several numbers in this
  codebase (recruit cost, cash trickle rate, food price, energy decay
  rates) are explicitly unbalanced placeholders, not tuned values — don't
  treat them as settled just because they're in the code.

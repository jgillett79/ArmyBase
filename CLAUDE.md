# ArmyBase / Command Base — Project Context

> Read [DESIGN.md](DESIGN.md) for the current playable state. This file preserves decisions and development history; some early status statements are superseded by later increments.

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
  Replaced with: death → **real-time** hospital stay, full recovery,
  no stat loss. (Originally 23 hours; brief 08 made it per mission tier —
  5 min Local Patrol, 30 min / 2 h / 4 h for later tiers — so an unlucky
  early patrol can't stop a first session for a day. See `recoveryMs` in
  `mission.js`.) Ad/pay-to-skip-the-wait can be added later as a convenience
  purchase (skip time), which is a fundamentally different, much less
  predatory mechanic than "pay to undo permanent loss."
- **Same consequence for neglect death.** If a unit's Energy hits 0 from
  poor food/schedule management, they get a hospital stay no longer than
  mission death — not something harsher. Confirmed explicitly by the user;
  don't make starvation-death worse than mission-death, that reintroduces
  the punishing-death problem from a different angle. Since brief 08 that
  means `NEGLECT_RECOVERY_MS` (5 min) ≤ the shortest tier recovery;
  `tests/chapter.cjs` asserts it. (Flagged for review in the brief 08
  manifest: it also makes neglect much milder than before.)
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
- **The base has a single gate on the west side.** Cliffs, river, pond
  and fences (`WORLD.terrain`/`WORLD.fences` in `world.js`) enclose it;
  the `gate` node in the west fence is the only way in/out. Civilians spawn outside it and
  route through it; recruited soldiers never leave. Built in Phase 2
  increment 2.
- **Path network is an authored graph with shortest-path routing
  (superseded the old fixed comb in brief 01).** The earlier rule here was
  "fixed comb, don't add pathfinding until the layout stops being a comb."
  DESIGN.md's terrain-shaped base is exactly that case, so `js/world.js`
  now holds hand-placed nodes/edges (with `via` bends), per-zone spurs to
  entrances, and a small Dijkstra (`findWorldRoute()`). It is still NOT
  free-form pathfinding around arbitrary obstacles: routes only follow the
  authored graph plus a short local approach at the end, and
  `validateWorld()` proves every edge clears water/cliffs/footprints. If
  free building placement is ever added, that is the point to revisit.
  Multi-leg path support on `Unit` (`path`/`setPath`/`advancePath`) is
  unchanged — `step()` fully consumes a route within one call so large
  catch-up steps land units at their destination, and `isAtTarget()`
  requires the full path to be consumed so a unit passing an intermediate
  waypoint doesn't briefly look "arrived."
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
  world.js           - authored terrain map: exclusion polygons, build
                       zones (footprint, entrance, slots, allowed types),
                       path graph, routing and validateWorld(). Shared by
                       simulation, rendering and tests.
  save.js            - save schema v2, v1 -> v2 migration, validation,
                       recovery copy. See its header before touching saves.
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
   A per-tier duration (5 min for Local Patrol up to 4 h, or
   `NEGLECT_RECOVERY_MS`), computed via `Date.now()`, completely
   independent of the game clock's value.
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

**Brief 01 done (terrain-shaped world + save v2)**: see
`CLAUDE_IMPLEMENTATION/01_WORLD_AND_SAVE_MANIFEST.md` for the exact data
structures and migration rules. Buildings no longer have `gridX`/`gridY`;
each has a `zoneId` into `WORLD.zones`. The save key is now
`armybase_save_v2`; the v1 key is read once and never modified. Tests:
`tests/world.cjs`, `tests/save-migration.cjs`, plus the two smoke tests.

**Brief 02 done (visible facility use)**: see
`CLAUDE_IMPLEMENTATION/02_UNIT_ACTIVITY_MANIFEST.md`. Units reserve typed
slots (`reserveSlot`/`releaseSlot`, queue on a full training building);
facility effects start only at the slot (`isUsingFacility`), which render.js
also uses. Route phase (`unit.routePhase`) is presentation only and never
saved; reservations are rebuilt on load. `hospitalize()` is the one way into
hospital. The old `chairOccupants`/`assignChair` are gone — chairs are
Entrance Hall slots. Test: `tests/activity.cjs`.

**Brief 03 done (camera, layered facilities, build controls)**: see
`CLAUDE_IMPLEMENTATION/03_RENDER_AND_BUILD_MANIFEST.md`. `camera.js` owns
world<->screen (all hit tests go through it); `scenery.js` paints a cached
static layer plus seeded trees; `unit.x/unit.y` is now the ground-contact
point (feet). Facilities draw through the shadow/back/front + open/indoor
contract in render.js. Build mode picks an authored zone
(`constructAt`/`zonePlacementState`). Browser review:
`tools/browser-capture.cjs` (headless Edge/Chrome, no dependencies).

**Brief 04 done (asset pipeline + playback)**: see
`CLAUDE_IMPLEMENTATION/04_ASSET_INTEGRATION_MANIFEST.md`. `js/asset-manifest.js`
is the single source for art files, pivots, slots, occluders and statuses;
`tools/prepare-art.cjs` builds `assets/` from `art/` non-destructively;
`tools/validate-assets.cjs` must pass. People are 44 world px tall
(`unitWorldHeight`). Walk/idle frames and a matching firing set are still
**missing** — requested in `art/CHATGPT_FEEDBACK.md`; `js/animation.js`
plays them once they exist and falls back to stills until then. Don't
promote a candidate to production without a consistency review.

**Visual pass 27 Sep**: see `art/ART_HANDOFF_2026-09-27.md` (Response). Path
edges are Catmull-Rom curves (walked = drawn); rock polygons are the rock's
FOOT with the plateau raised above; `tools/rig-soldier.cjs` makes a
validated 6-frame down walk (candidate); `validate-assets.cjs --gait` checks
any strip. `tools/capture-showcase.cjs` makes the 960x576 review screen.

**First-base delivery, Gates 0–1 (27 Sep)**: see
`CLAUDE_IMPLEMENTATION/06_GATE0_VISUAL_CONTRACT.md`. A `brook_gate` inside the
gate is crossed only by `WORLD.bridges` (validateWorld allows water under a
path only on a spanning deck); the aid station moved east of it. Bridges
draw as back (static layer) + front rail (depth-sorted). `WORLD.checkpoint`
reserves the kiosk footprint and a *swinging* boom hinge. Scene props are
placed by `SCENE_PROP_PLACEMENTS` (scenery.js, validated). Labels are drawn
in a final pass. Loading a save moves anyone standing in terrain to the
nearest trail node. `tools/capture-gate0.cjs` regenerates the contract.

**Gate art round (27 Sep)**: see `CLAUDE_IMPLEMENTATION/07_GATE_ART_REVIEW.md`.
Bridge/kiosk/boom/3x props are provisional art in `ASSET_MANIFEST.bridges`,
`.checkpoint`, `.props`. `WORLD.checkpoint.boomHinge` is the post's GROUND
point; the boom swings (presentation only) in render.js. Visitors check in
at `WORLD.checkpoint.pause`, outside the barrier. Terrain strips and the
painted down-walk are candidates (`?art=candidates`); validate-assets
reports candidate shortfalls as WARN, not failures.

**Brief 08 done (first soldier chapter)**: see
`CLAUDE_IMPLEMENTATION/08_FIRST_SOLDIER_MANIFEST.md`. `GameState.chapter`
saves only the facts that can't be derived (first soldier id, readiness
target, intro dispatched, intro report id, done, dismissed);
`chapterStage()` derives the step from roster, buildings and mission log,
so reloads can't restart or strand it. Deployment goes through
`deploymentCheck()` (named reasons) and non-idle soldiers need an explicit
`{ recall: true }` — the old IDLE-only rule was the "deployment trap".
The first soldier's first Local Patrol is `INTRO_PATROL` (75 s,
guaranteed, solo, one time), after a +3 accuracy readiness target reached
through the labelled `FIRST_SOLDIER_DRILL` (3x range gain, any waking hour,
first soldier only, ends at the target) — `tests/pacing.cjs` holds prompt
and slow players to the first session. Customization is deliberately
small: optional `callsign` + one of four `ACCENT_COLOURS` per soldier
(unit.js), drawn only through approved accent masks, otherwise as a
badge/map pip — never a whole-body tint. The first soldier wears body
variant 1, the only one with a (candidate) portrait. Before a Mess Hall
exists, the first soldier gets ONE `STARTER_FIELD_MEAL` from food stock at
the hunger point (`chapter.fieldMealUsed`, saved) — it is what lets a
slow first session reach the patrol without a collapse; don't turn it into
a repeatable food source, that is the Mess Hall's job. Merged to main
28 Sep; the walk release gate is still blocked on art. Mission-log entries are the debriefs
(`seen: false` until read). Save stays schema 2 with optional additions;
saves without `chapter` get one from `chapterForSave()` (an established
base starts done). The directional-walk release gate (`walkReleaseGate()`)
is still **blocked on art**. Tests: `tests/chapter.cjs`; browser flow:
`tools/capture-first-session.cjs desktop|phone`.

**Brief 09, gate 09A + routine core (1 Oct, branch `brief-09-daily-base`, not
merged)**: see `CLAUDE_IMPLEMENTATION/09A_PERIMETER_AND_ROUTINE_MANIFEST.md` and the
measured `09_STATION_VISUAL_CONTRACT.md` (regenerate with
`tools/station-contract.cjs`; never hand-edit its numbers). Supersedes several
rules above: applicants queue OUTSIDE (map extends to `WORLD_X0` = −200) and are
admitted only at the guardhouse's outside window (`WORLD.perimeter`); the 5-min
day is now **20 min** with pause/1×/2×/4× (`simSpeed`, never saved — real
deadlines don't scale); soldiers follow `ROUTINE_TIMETABLE` (`js/routine.js`)
via `js/daily.js` (GameState methods): travel → queued → use → exit at real
stations (beds, toilet/basin/shower stalls, serving counter + seat with a
once-per-window meal token, training equipment by Auto/Focus/Specific, rec
benches) or a parade-ground spot with a reason — **never a random wander**
(`routeToRandomRoadPoint` and `desiredStatus` are gone). Barracks, Mess Hall and
Wash Block (the `showers` building) start at level 1 on every base; fresh-base
placements were re-sited from `tools/walk-matrix.cjs` (mess on Centre knoll).
The brief 08 range drill and starter field meal are retired. Station geometry
(where) is `STATION_GEOMETRY`; rules (how long, what effect) are `STATION_RULES`
— keep them apart. Every effect happens only in `use`; the renderer only reads.
Tests: `tests/routine.cjs` (+ `tests/lib/sandbox.cjs` loader); traces:
`tools/trace-daily-base.cjs`; screenshots: `tools/capture-daily-base.cjs`.
All station art in game is a marked placeholder; the visual gate stays blocked.

## Open questions for Phase 2 — don't guess at these, ask

1. **Character walk-cycle animation** — raised by the user, not yet
   scoped. The last item of the entrance-hall/terrain/animation order
   agreed earlier (both other items are done — see increments 7/8 above),
   and the most expensive of the three: needs several new frames per
   direction plus frame-timing code.
2. **Promotion mechanics in detail** — the actual pick-2-units UI/flow,
   what resets vs. carries over onto the new base, and multi-base save
   state now that Base 1 persists as a legacy base rather than resetting.
3. **Building construction time + higher levels + an "under construction"
   art state** — raised by the user, not yet scoped. Right now upgrading a
   building is instant (one cash deduction, `building.upgrade()`
   synchronously) and levels cap at 3. Whether to add a real-time build
   timer (same pattern as the hospital timer — `Date.now()`-based, not
   compressed game-time, per the three-clocks rule), raise the level cap,
   and/or add a shared "construction in progress" sprite (one asset reused
   across all 6 upgradeable buildings, same idea as `vacant_lot.png`) is an
   open question — see README for the recommendation given (basic
   gameplay/missions first, this is a polish layer that can come later).
4. **Art still needed** — `showers.png`, `rec_room.png`,
   `entrance_hall.png`, `ground_apron.png`, `ground_grass.png`, and 3
   civilian sitting-pose files, all spec'd in `ASSETS.md`. Each renders a
   graceful fallback (procedural box, flat tint, or the normal standing
   sprite) until generated, so none of this is blocking anything.

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

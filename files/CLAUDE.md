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
- **Vehicles, extra buildings (Obstacle Course, showers/sanitary), and
  missions are all deliberately NOT built yet.** Each would require design
  decisions that don't have answers yet (see "Open questions" below).
  Resist the temptation to stub these in "while I'm in there" — guessing
  the data shape before the requirement is known is exactly the kind of
  rearchitect-later risk this project has been trying to avoid.

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

## Open questions for Phase 2 — don't guess at these, ask

1. **Missions.** Percentage-chance resolution based on unit stats, rewards
   include cash plus new resources (coal/lumber/gems mentioned) for
   higher-tier buildings. This is the next big chunk and several Phase 1
   decisions (Food being cash-only, no resource-production buildings yet)
   were made specifically to avoid guessing at a resource economy before
   missions exist to justify it.
2. **Obstacle Course** (endurance stat) and any other training buildings —
   same mechanical pattern as Shooting Range, just needs the specific
   stat + building confirmed.
3. **Sanitary/showers** — mentioned as a resource unit's need but not
   scoped. Second needs-stat like Energy, or something structurally
   different?
4. **Base progression / promotion** — moving to a new/bigger base and
   bringing 2 chosen units with you. Order relative to missions unclear.
5. **Art pipeline** — a local AI image model is being stood up separately
   (see user's own infra work, not part of this repo) to eventually
   replace the placeholder canvas shapes with real sprites. No art
   direction/style brief has been locked yet as of this handoff.

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

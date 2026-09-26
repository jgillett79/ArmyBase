// unit.js — the per-character data model.
// This is the thing the whole "feel attached to your soldiers" concept
// hangs off, so it's deliberately richer than a typical idle-game unit.

const UNIT_STATUS = {
  CIVILIAN_APPROACHING: 'civilian_approaching', // walking toward base, recruitable
  CIVILIAN_LEAVING: 'civilian_leaving',          // ignored, walking away, about to despawn
  RECRUITING: 'recruiting',                      // just recruited, walking to Barracks; still looks
                                                  // like a civilian until it arrives (state.js tick())
  IDLE: 'idle',                                  // recruited, wandering base, no job/no urgent need
  TRAINING: 'training',                          // assigned to Shooting Range, accuracy climbing
  EATING: 'eating',                              // at Mess Hall, energy critical or topping up
  SLEEPING: 'sleeping',                          // night hours, at Barracks, low decay
  HYGIENE: 'hygiene',                            // scheduled block, at Showers, hygiene climbs
  RECREATION: 'recreation',                      // scheduled block, at Rec Room, morale climbs
  HOSPITAL: 'hospital',                          // energy hit 0 OR failed a mission — same consequence
  ON_MISSION: 'on_mission',                      // away on a mission (async/black-box — see mission.js);
                                                  // excluded from the normal tick loop and not rendered
};

// Energy thresholds/rates — placeholder numbers, same caveat as the cash
// economy in Phase 0: these exist to make the loop testable, not balanced.
const ENERGY_CRITICAL = 20;          // at/below this, unit abandons job to eat
const ENERGY_RATE_TRAINING = -8;     // per game-hour
const ENERGY_RATE_IDLE = -3;         // per game-hour
const ENERGY_RATE_SLEEPING = -1;     // per game-hour
const ENERGY_RATE_EATING_FED = 15;   // per game-hour, only if food is available
const ENERGY_RATE_EATING_HUNGRY = -3; // per game-hour, standing at an empty Mess Hall
const ARRIVAL_RADIUS = 30; // px — how close counts as "at the building"
// Per-stat training gain rates now live on the building (building.js `trains`
// map) since Phase 2 added multiple training buildings — a single constant
// here stopped being able to describe "how fast does X stat grow."

// Hygiene/Morale — placeholder rates, same caveat as Energy above. Per the
// locked design (CLAUDE.md): Hygiene feeds Energy's decay rate rather than
// being its own path to the hospital, and Morale softly reduces training
// gain rather than being a death path either — "no permadeath, one
// consequence funnel" stays true with these two needs stats added.
const HYGIENE_RATE_GAIN = 60;    // per game-hour, only while at built Showers during the Hygiene block
const HYGIENE_RATE_DECAY = -3;   // per game-hour, otherwise
const HYGIENE_LOW_THRESHOLD = 30;
const ENERGY_DECAY_HYGIENE_PENALTY = 1.5; // energy drains 50% faster below the hygiene threshold

const MORALE_RATE_GAIN = 40;     // per game-hour, only while at built Rec Room during the Recreation block
const MORALE_RATE_DECAY = -2;    // per game-hour, otherwise
const MORALE_LOW_THRESHOLD = 30;
const TRAINING_GAIN_MORALE_PENALTY = 0.5; // training gain halved below the morale threshold

// The fixed daily schedule — see README/CLAUDE.md for the design. Hours are
// game-clock hours (0-24, compressed — see the three-clocks comment in
// state.js), NOT real time. `end` past 24 means the block wraps midnight
// (22-30 reads as 22:00-24:00 plus 00:00-06:00).
const DAILY_SCHEDULE = [
  { start: 22, end: 30, status: UNIT_STATUS.SLEEPING },
  { start: 6, end: 8, status: UNIT_STATUS.EATING },
  { start: 8, end: 9, status: UNIT_STATUS.HYGIENE },
  { start: 9, end: 12, status: UNIT_STATUS.TRAINING },
  { start: 12, end: 13, status: UNIT_STATUS.EATING },
  { start: 13, end: 17, status: UNIT_STATUS.TRAINING },
  { start: 17, end: 20, status: UNIT_STATUS.RECREATION },
  { start: 20, end: 22, status: UNIT_STATUS.EATING },
];

function scheduledStatusFor(hourOfDay) {
  for (const block of DAILY_SCHEDULE) {
    if (block.end <= 24) {
      if (hourOfDay >= block.start && hourOfDay < block.end) return block.status;
    } else if (hourOfDay >= block.start || hourOfDay < block.end - 24) {
      return block.status;
    }
  }
  return UNIT_STATUS.IDLE; // unreachable if DAILY_SCHEDULE covers all 24h, kept as a safe fallback
}

class Unit {
  constructor({ x, y, isCivilian = true }) {
    this.id = makeId('unit');
    this.name = randomFullName();
    this.x = x;
    this.y = y;

    // Wander/movement target. path holds any remaining legs of a multi-leg
    // route (see state.js's road-routing methods) still to walk after the
    // current targetX/targetY is reached — empty for simple single-point
    // moves (civilians never use it).
    this.targetX = x;
    this.targetY = y;
    this.path = [];
    // World px/sec. The authored world is ~1.67x the old 960px canvas in each
    // axis, so this is the old 18-28 scaled to keep walk times comparable.
    this.speed = randRange(30, 46);
    // Which directional sprite to draw ('up'/'down'/'left'/'right') — see
    // render.js's unitSprite(). Only updated while actually moving (step()),
    // so a stationary unit keeps facing whichever way it last walked rather
    // than snapping to a default.
    this.facing = 'down';

    // Visual variety so units are distinguishable at a glance even as
    // rectangles — this is the "different views of them as they're walking
    // around" requirement, done cheaply until real sprites exist.
    this.colorSeed = randInt(0, 359); // used as an HSL hue in render.js
    this.outfit = isCivilian ? pick(['civilian', 'bus_rider', 'taxi']) : 'uniform';
    // Which soldier sprite body (soldier_01..06) this unit wears once recruited.
    // Fixed at birth so a given unit always looks the same after recruiting —
    // same "random shape per unit" idea as the civilian outfit above.
    this.soldierVariant = randInt(1, 6);

    this.isCivilian = isCivilian;
    this.status = isCivilian ? UNIT_STATUS.CIVILIAN_APPROACHING : UNIT_STATUS.IDLE;

    // RPG stats — only meaningful once recruited, but present on civilians
    // too so recruiting doesn't require rebuilding the object.
    this.level = 1;
    this.xp = 0;
    this.xpToNext = 100;

    this.maxHp = randInt(18, 24);
    this.hp = this.maxHp;
    this.strength = randInt(3, 7);
    this.accuracy = randInt(40, 60); // percent, float internally once training starts
    this.endurance = randInt(40, 60); // percent, same shape as accuracy

    this.maxEnergy = 100;
    this.energy = 100;
    this.hygiene = 100;
    this.morale = 100;

    this.assignedBuildingId = null; // which building this unit's "job" is, if any

    this.equipment = []; // persists through hospital stays — Phase 3 will add effects

    this.hospitalUntil = null; // timestamp (ms) when recovery finishes

    // Set only while status === ON_MISSION — see state.js's dispatchMission()/tick().
    this.missionReturnAt = null; // timestamp (ms), same real-time pattern as hospitalUntil
    this.missionTierId = null; // which MISSION_TIERS entry to resolve against on return

    // Which Entrance Hall waiting-chair slot this civilian occupies, if any —
    // see state.js's assignChair()/releaseChair(). Only meaningful while
    // isCivilian && status === CIVILIAN_APPROACHING.
    this.chairIndex = null;
  }

  recruit() {
    this.isCivilian = false; // counts against the roster cap immediately — cash is already spent
    this.status = UNIT_STATUS.RECRUITING; // still looks like a civilian until they reach the Barracks
    // outfit stays whatever it was as a civilian; state.js's tick() flips it
    // to 'uniform' on arrival — see the RECRUITING handling there.
    // GameState.recruit() routes them to the Barracks right after this call.
  }

  addXp(amount) {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.levelUp();
    }
  }

  levelUp() {
    this.level += 1;
    this.xpToNext = Math.round(this.xpToNext * 1.35);
    this.maxHp += randInt(2, 4);
    this.hp = this.maxHp;
    this.strength += randInt(1, 2);
    this.accuracy = clamp(this.accuracy + randInt(1, 3), 0, 95);
    this.endurance = clamp(this.endurance + randInt(1, 3), 0, 95);
  }

  sendToHospital(nowMs) {
    this.status = UNIT_STATUS.HOSPITAL;
    // 23h real-time timer, deliberately NOT run through the compressed game
    // clock — see state.js header comment on the three-clocks issue.
    this.hospitalUntil = nowMs + 23 * 60 * 60 * 1000;
    this.hp = this.maxHp;
    this.energy = this.maxEnergy;
  }

  isRecovered(nowMs) {
    return this.status === UNIT_STATUS.HOSPITAL && nowMs >= this.hospitalUntil;
  }

  // Decide what this unit *should* be doing right now. Pure function of its
  // own state plus the game-clock hour state.js knows that it doesn't.
  // Doesn't mutate anything — state.js applies the transition if it differs
  // from current status.
  desiredStatus(hourOfDay) {
    if (this.energy <= ENERGY_CRITICAL) return UNIT_STATUS.EATING; // safety net overrides the schedule
    const scheduled = scheduledStatusFor(hourOfDay);
    // Training is opt-in per unit (must be assigned to a training building —
    // see CLAUDE.md's "auto-schedule, not manual job-walking" decision, which
    // covers *when*, not *which building*). Everyone else's block applies
    // uniformly regardless of assignment.
    if (scheduled === UNIT_STATUS.TRAINING && !this.assignedBuildingId) return UNIT_STATUS.IDLE;
    return scheduled;
  }

  applyEnergyDelta(gameHours, foodAvailable) {
    let rate;
    switch (this.status) {
      case UNIT_STATUS.TRAINING: rate = ENERGY_RATE_TRAINING; break;
      case UNIT_STATUS.SLEEPING: rate = ENERGY_RATE_SLEEPING; break;
      case UNIT_STATUS.EATING: rate = foodAvailable ? ENERGY_RATE_EATING_FED : ENERGY_RATE_EATING_HUNGRY; break;
      default: rate = ENERGY_RATE_IDLE;
    }
    if (rate < 0 && this.hygiene < HYGIENE_LOW_THRESHOLD) rate *= ENERGY_DECAY_HYGIENE_PENALTY;
    this.energy = clamp(this.energy + rate * gameHours, 0, this.maxEnergy);
  }

  applyHygieneDelta(gameHours, showersBuilt) {
    const rate = (this.status === UNIT_STATUS.HYGIENE && showersBuilt) ? HYGIENE_RATE_GAIN : HYGIENE_RATE_DECAY;
    this.hygiene = clamp(this.hygiene + rate * gameHours, 0, 100);
  }

  applyMoraleDelta(gameHours, recRoomBuilt) {
    const rate = (this.status === UNIT_STATUS.RECREATION && recRoomBuilt) ? MORALE_RATE_GAIN : MORALE_RATE_DECAY;
    this.morale = clamp(this.morale + rate * gameHours, 0, 100);
  }

  // Only counts as "at" the target once every leg of a multi-leg route is
  // done — otherwise a unit passing near an intermediate waypoint (e.g. the
  // road spine, on its way to a building) would look arrived prematurely
  // and start earning training gain / consuming food before it actually
  // gets there.
  isAtTarget() {
    return this.path.length === 0
      && Math.hypot(this.x - this.targetX, this.y - this.targetY) < ARRIVAL_RADIUS;
  }

  // trains: { statName: gainPerGameHour, ... } — comes from whichever
  // building.trains map the unit is currently assigned to. A building that
  // trains multiple stats (Combat Drill Yard) just has multiple keys here.
  applyTrainingGain(gameHours, trains) {
    const moralePenalty = this.morale < MORALE_LOW_THRESHOLD ? TRAINING_GAIN_MORALE_PENALTY : 1;
    for (const stat in trains) {
      this[stat] = clamp(this[stat] + trains[stat] * gameHours * moralePenalty, 0, 95);
    }
  }

  // Replaces the current path with a fresh multi-leg route (a list of
  // {x,y} waypoints) and immediately starts walking toward its first leg.
  setPath(waypoints) {
    this.path = waypoints.slice();
    this.advancePath();
  }

  // Pops the next leg into targetX/targetY. Returns true only once there
  // are no more legs left, i.e. the unit has reached the true end of its
  // route, not just one waypoint along the way.
  advancePath() {
    if (this.path.length > 0) {
      const next = this.path.shift();
      this.targetX = next.x;
      this.targetY = next.y;
      return false;
    }
    return true;
  }

  // Path samples can move diagonally along the winding road; choose the
  // dominant axis for the closest available directional drawing.
  updateFacing(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) {
      this.facing = dx > 0 ? 'right' : 'left';
    } else if (dy !== 0) {
      this.facing = dy > 0 ? 'down' : 'up';
    }
  }

  // Advance position toward target, consuming as many legs of a multi-leg
  // route as dtSeconds' movement budget allows within this single call.
  // This matters for offline catch-up, which applies elapsed time as one
  // huge dt rather than many small ticks (see state.js's three-clocks
  // comment) — without looping here, a big dt would only advance one leg
  // and strand the unit mid-road instead of at its real destination.
  // Returns true only once the unit has reached the very end of its path.
  step(dtSeconds) {
    let remaining = this.speed * dtSeconds;
    for (;;) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 1) {
        if (this.advancePath()) return true;
        continue;
      }

      this.updateFacing(dx, dy);

      if (remaining >= dist) {
        this.x = this.targetX;
        this.y = this.targetY;
        remaining -= dist;
        if (this.advancePath()) return true;
        if (remaining <= 0) return false;
        continue;
      }

      this.x += (dx / dist) * remaining;
      this.y += (dy / dist) * remaining;
      return false;
    }
  }
}

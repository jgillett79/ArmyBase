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
  HOSPITAL: 'hospital',                          // energy hit 0 OR died on a mission — same consequence
  // MISSION: 'mission',                          // reserved for Phase 2
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
    this.speed = randRange(18, 28); // px/sec

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

    this.assignedBuildingId = null; // which building this unit's "job" is, if any

    this.equipment = []; // persists through hospital stays — Phase 3 will add effects

    this.hospitalUntil = null; // timestamp (ms) when recovery finishes
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
  // own state plus the two facts state.js knows that it doesn't: whether
  // it's currently daytime, and whether food is available. Doesn't mutate
  // anything — state.js applies the transition if it differs from current status.
  desiredStatus(isDaytime) {
    if (this.energy <= ENERGY_CRITICAL) return UNIT_STATUS.EATING;
    if (this.assignedBuildingId && isDaytime) return UNIT_STATUS.TRAINING;
    if (!isDaytime) return UNIT_STATUS.SLEEPING;
    return UNIT_STATUS.IDLE;
  }

  applyEnergyDelta(gameHours, foodAvailable) {
    let rate;
    switch (this.status) {
      case UNIT_STATUS.TRAINING: rate = ENERGY_RATE_TRAINING; break;
      case UNIT_STATUS.SLEEPING: rate = ENERGY_RATE_SLEEPING; break;
      case UNIT_STATUS.EATING: rate = foodAvailable ? ENERGY_RATE_EATING_FED : ENERGY_RATE_EATING_HUNGRY; break;
      default: rate = ENERGY_RATE_IDLE;
    }
    this.energy = clamp(this.energy + rate * gameHours, 0, this.maxEnergy);
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
    for (const stat in trains) {
      this[stat] = clamp(this[stat] + trains[stat] * gameHours, 0, 95);
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

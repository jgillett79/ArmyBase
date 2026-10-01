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
  HOSPITAL: 'hospital',                          // energy hit 0 OR failed a mission — same kind of consequence
  ON_MISSION: 'on_mission',                      // away on a mission (async/black-box — see mission.js);
                                                  // excluded from the normal tick loop and not rendered
};

// Energy thresholds/rates — placeholder numbers, same caveat as the cash
// economy in Phase 0: these exist to make the loop testable, not balanced.
const ENERGY_CRITICAL = 20;          // at/below this, unit abandons job to eat
const ARRIVAL_RADIUS = 30; // px — how close counts as "at the building"
// Per-stat training gain rates now live on the building (building.js `trains`
// map) since Phase 2 added multiple training buildings — a single constant
// here stopped being able to describe "how fast does X stat grow."

// Hygiene/Morale (brief 09 rates live in routine.js ROUTINE_NEEDS and
// STATION_RULES). Per the locked design (CLAUDE.md): low Hygiene speeds up
// Energy's decay rather than being its own path to the hospital, and low
// Morale halves training gain — "no permadeath, one consequence funnel".
const HYGIENE_LOW_THRESHOLD = 30;
const ENERGY_DECAY_HYGIENE_PENALTY = 1.5; // energy drains 50% faster below the hygiene threshold
const MORALE_LOW_THRESHOLD = 30;
const TRAINING_GAIN_MORALE_PENALTY = 0.5; // training gain halved below the morale threshold

// Brief 09 replaced the old status schedule (DAILY_SCHEDULE /
// desiredStatus) with the shared timetable in routine.js; daily.js decides
// where each soldier goes.

// Player customization (brief 08, deliberately small): an optional short
// callsign and one of four identity accent colours for the helmet band and
// shoulder patch. The accent never tints skin, kit, shadows or the body:
// it is drawn only through an approved accent mask, and otherwise shown as
// a badge/pip beside the portrait and name. No face/body/uniform choices
// until matching directional, portrait and activity art exists.
const ACCENT_COLOURS = [
  { id: 'red', label: 'Signal red', hex: '#c9483c' },
  { id: 'blue', label: 'Sky blue', hex: '#4a8fd6' },
  { id: 'gold', label: 'Gold', hex: '#e3b53f' },
  { id: 'white', label: 'White', hex: '#ecebe4' },
];
const CALLSIGN_MAX_LENGTH = 12;
const CALLSIGN_POOL = ['Ace', 'Bishop', 'Comet', 'Dusty', 'Echo', 'Falcon', 'Ghost', 'Hawk', 'Jinx', 'Kodiak',
  'Lucky', 'Maverick', 'Nomad', 'Pilot', 'Rook', 'Sparrow', 'Tango', 'Viper'];

function accentById(id) {
  return ACCENT_COLOURS.find(a => a.id === id) || null;
}

// Stable default so every soldier has an accent before the player picks one.
function defaultAccentFor(colorSeed) {
  return ACCENT_COLOURS[Math.abs(Math.floor(colorSeed || 0)) % ACCENT_COLOURS.length].id;
}

// Trimmed, single-spaced, printable, at most CALLSIGN_MAX_LENGTH; null when empty.
function sanitizeCallsign(text) {
  if (typeof text !== 'string') return null;
  const clean = text.replace(/[\u0000-\u001f\u007f<>"`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, CALLSIGN_MAX_LENGTH).trim();
  return clean || null;
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
    this.hospitalReason = null; // 'mission' | 'energy' — only for explaining the stay

    // Identity earned through play (brief 08), saved with the soldier:
    // stat points gained by training (drives the speciality), and a short
    // service record — a tag plus one sentence — written by their first
    // patrol. Presentation, not a trait tree.
    this.trained = {};         // { accuracy: 3.2, ... }
    this.serviceTag = null;    // e.g. 'First Patrol'
    this.serviceRecord = null; // one sentence
    this.callsign = null;                          // optional, player-chosen (sanitizeCallsign)
    this.accent = defaultAccentFor(this.colorSeed); // ACCENT_COLOURS id

    // Set only while status === ON_MISSION — see state.js's dispatchMission()/tick().
    this.missionReturnAt = null; // timestamp (ms), same real-time pattern as hospitalUntil
    this.missionTierId = null; // which MISSION_TIERS entry to resolve against on return

    // Which Entrance Hall waiting-chair slot this civilian occupies, if any —
    // see state.js's assignChair()/releaseChair(). Only meaningful while
    // isCivilian && status === CIVILIAN_APPROACHING.
    this.chairIndex = null;

    // Presentation/route state — never saved. GameState rebuilds it
    // deterministically from status on load (routeForStatus), so a reload
    // can't double-book a slot. Gameplay status above stays the single
    // source of truth for the simulation.
    this.slot = null;          // reserved interaction slot: { buildingId, slotId, x, y, facing, activity }
    this.queuedFor = null;     // buildingId while waiting for a full facility
    this.legPhase = 'travel';  // phase tag of the current route leg (see setPath)
    this.departing = false;    // walking out through the gate after mission dispatch
    this.walkDistance = 0;     // world px walked; drives walk-cycle frames (animation.js)
    // Brief 09 (saved): the daily routine record (daily.js freshRoutine), the
    // soldier's own bed station id, and their training policy.
    this.routine = null;
    this.bedId = null;
    this.trainingPolicy = { mode: 'auto' }; // 'auto' | 'focus' (stat) | 'specific' (facilityId)
    this.lastStationId = null;              // equipment used last bout (Auto avoids repeating it)
    this.admitted = !isCivilian;            // admission permission: only admitted people cross the barrier
  }

  // What the player should see this unit doing, separate from its gameplay
  // status: travel/approach along paths, enter (door to slot), using (at a
  // reserved slot), queued, leave (slot back to the door), checkpoint.
  get routePhase() {
    if (this.slot && this.isAtSlot()) return 'using';
    if (this.queuedFor && this.path.length === 0 && Math.hypot(this.x - this.targetX, this.y - this.targetY) < 4) return 'queued';
    return this.legPhase;
  }

  // Strict arrival at the reserved slot (not the looser ARRIVAL_RADIUS), so
  // effects and activity poses start only once the unit is really there.
  isAtSlot() {
    return !!this.slot && this.path.length === 0
      && Math.hypot(this.x - this.slot.x, this.y - this.slot.y) < 2;
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

  // durationMs comes from the mission tier (or NEGLECT_RECOVERY_MS) — see
  // mission.js. Real time, deliberately NOT run through the compressed game
  // clock — see state.js header comment on the three-clocks issue.
  sendToHospital(nowMs, durationMs) {
    this.status = UNIT_STATUS.HOSPITAL;
    this.hospitalUntil = nowMs + durationMs;
    this.hp = this.maxHp;
    this.energy = this.maxEnergy;
  }

  isRecovered(nowMs) {
    return this.status === UNIT_STATUS.HOSPITAL && nowMs >= this.hospitalUntil;
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
  applyTrainingGain(gameHours, trains, multiplier = 1) { // multiplier: kept for tests; always 1 in play
    const moralePenalty = this.morale < MORALE_LOW_THRESHOLD ? TRAINING_GAIN_MORALE_PENALTY : 1;
    for (const stat in trains) {
      const before = this[stat];
      this[stat] = clamp(this[stat] + trains[stat] * gameHours * moralePenalty * multiplier, 0, 95);
      this.trained[stat] = (this.trained[stat] || 0) + (this[stat] - before);
    }
  }

  // How the soldier is called on the map and in quick lines: first name,
  // plus the callsign when they have one ('Linda "Ace"').
  get fieldName() {
    const first = this.name.split(' ')[0];
    return this.callsign ? `${first} "${this.callsign}"` : first;
  }

  // Role earned through play: the stat they have trained most. Until a
  // soldier has trained a whole point they are simply a Recruit.
  get speciality() {
    const best = Object.entries(this.trained || {}).sort((a, b) => b[1] - a[1])[0];
    if (!best || best[1] < 1) return 'Recruit';
    return { accuracy: 'Marksman', strength: 'Breacher', endurance: 'Pathfinder' }[best[0]] || 'Recruit';
  }

  // Replaces the current path with a fresh multi-leg route (a list of
  // {x,y} waypoints, each optionally tagged with the `phase` of the leg that
  // ends there) and immediately starts walking toward its first leg.
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
      this.legPhase = next.phase || 'travel';
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
        this.walkDistance += dist;
        this.x = this.targetX;
        this.y = this.targetY;
        remaining -= dist;
        if (this.advancePath()) return true;
        if (remaining <= 0) return false;
        continue;
      }

      this.walkDistance += remaining;
      this.x += (dx / dist) * remaining;
      this.y += (dy / dist) * remaining;
      return false;
    }
  }
}

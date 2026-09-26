// building.js — Barracks and Mess Hall stay as one-off classes (each has its
// own semantics: cap contribution, single-level unlimited-capacity needs
// building). Everything that's "assign a unit, a stat climbs" shares the
// TrainingBuilding base below — see its comment for why that stopped being
// a premature abstraction once Phase 2 added three more of them.

const BARRACKS_MAX_LEVEL = 3;
const BARRACKS_CAP_PER_LEVEL = 5;
const BASE_UNIT_CAP = 5; // cap with zero barracks built

// Building IDs are fixed strings, not makeId()-random, on purpose: each of
// these is a singleton (there's only ever one Barracks/Range/Mess Hall), and
// GameState.load() reconstructs fresh building instances before restoring
// their saved levels. A random ID would change on every reload, silently
// orphaning any unit.assignedBuildingId reference saved from a prior session
// (found via smoke testing — occupancy counts went stale after reload).
class Barracks {
  constructor() {
    this.id = 'barracks';
    this.type = 'barracks';
    this.zoneId = null; // which authored world zone it stands in (world.js)
    this.level = 0; // 0 = not built yet
  }

  get isBuilt() {
    return this.level > 0;
  }

  get isMaxLevel() {
    return this.level >= BARRACKS_MAX_LEVEL;
  }

  nextUpgradeCost() {
    // Simple escalating cost curve. Tune later against actual economy pacing.
    return 100 * Math.pow(2, this.level);
  }

  capContribution() {
    return this.level * BARRACKS_CAP_PER_LEVEL;
  }

  upgrade() {
    this.level += 1;
  }
}

// Shared shape for every "assign an idle unit here, a stat climbs while
// they're physically at the building during daytime" building. Generalized
// out of the original one-off ShootingRange class now that Phase 2 adds
// three more buildings following the identical mechanical pattern — no
// longer a premature abstraction once the pattern repeats four times.
//
// trains: { statName: gainPerGameHour, ... }. Applied via
// Unit.applyTrainingGain(). A building with multiple keys (Combat Drill
// Yard) trains more than one stat at once, at a reduced rate each — a
// deliberate trade-off, not strictly better than a dedicated building.
class TrainingBuilding {
  constructor({ id, type, maxLevel, slotsPerLevel, baseCost, trains }) {
    this.id = id; // fixed string — see Barracks comment above on why
    this.type = type;
    this.zoneId = null; // placement lives in world.js zones, not on the building
    this.level = 0;
    this.maxLevel = maxLevel;
    this.slotsPerLevel = slotsPerLevel;
    this.baseCost = baseCost;
    this.trains = trains;
  }

  get isBuilt() { return this.level > 0; }
  get isMaxLevel() { return this.level >= this.maxLevel; }
  get capacity() { return this.level * this.slotsPerLevel; }

  nextUpgradeCost() {
    return this.baseCost * Math.pow(2, this.level);
  }

  upgrade() { this.level += 1; }
}

// Gain rates — placeholder numbers like everything else balance-related in
// this codebase (see CLAUDE.md). Weight Room/Obstacle Course match the
// Shooting Range's existing 0.5/game-hour for symmetry. Combat Drill Yard
// trains two stats at once, so each stat grows at half that rate — the
// building is a breadth-vs-speed trade-off, not a strict upgrade.
const SINGLE_STAT_GAIN_PER_GAME_HOUR = 0.5;
const DRILL_YARD_GAIN_PER_GAME_HOUR = 0.25;

class ShootingRange extends TrainingBuilding {
  constructor() {
    super({
      id: 'shooting_range', type: 'shooting_range',
      maxLevel: 3, slotsPerLevel: 2, baseCost: 80,
      trains: { accuracy: SINGLE_STAT_GAIN_PER_GAME_HOUR },
    });
  }
}

class WeightRoom extends TrainingBuilding {
  constructor() {
    super({
      id: 'weight_room', type: 'weight_room',
      maxLevel: 3, slotsPerLevel: 2, baseCost: 80,
      trains: { strength: SINGLE_STAT_GAIN_PER_GAME_HOUR },
    });
  }
}

class ObstacleCourse extends TrainingBuilding {
  constructor() {
    super({
      id: 'obstacle_course', type: 'obstacle_course',
      maxLevel: 3, slotsPerLevel: 2, baseCost: 80,
      trains: { endurance: SINGLE_STAT_GAIN_PER_GAME_HOUR },
    });
  }
}

class CombatDrillYard extends TrainingBuilding {
  constructor() {
    super({
      id: 'drill_yard', type: 'drill_yard',
      maxLevel: 3, slotsPerLevel: 2, baseCost: 100,
      trains: { strength: DRILL_YARD_GAIN_PER_GAME_HOUR, endurance: DRILL_YARD_GAIN_PER_GAME_HOUR },
    });
  }
}

// Shared shape for "built once, unlimited capacity, no levels" needs
// buildings — Mess Hall (Energy/Food), Showers (Hygiene), Rec Room
// (Morale). Deliberately NOT leveled, same reasoning as Mess Hall
// originally: the needs loop is complex enough on its own, a capacity
// constraint wasn't validated as necessary. Generalized out of the
// original one-off MessHall class now that the pattern repeats 3 times —
// same "no longer premature" reasoning as TrainingBuilding above.
class NeedsBuilding {
  constructor({ id, type, cost }) {
    this.id = id; // fixed string — see Barracks comment above on why
    this.type = type;
    this.zoneId = null; // placement lives in world.js zones, not on the building
    this.level = 0;
    this.cost = cost;
  }

  get isBuilt() { return this.level > 0; }

  buildCost() {
    return this.cost;
  }

  build() { this.level = 1; }
}

class MessHall extends NeedsBuilding {
  constructor() {
    super({ id: 'mess_hall', type: 'mess_hall', cost: 120 });
  }
}

class Showers extends NeedsBuilding {
  constructor() {
    super({ id: 'showers', type: 'showers', cost: 100 });
  }
}

class RecRoom extends NeedsBuilding {
  constructor() {
    super({ id: 'rec_room', type: 'rec_room', cost: 100 });
  }
}

// Not a purchasable/upgradeable structure like the others above — it's
// always present from the start (level forced to 1 in the constructor, cost
// 0), same "fixed part of the base" idea as the perimeter wall/gatehouse.
// It exists purely so waiting civilians have a real building + door to route
// to (see the waiting slots on its world.js zone) instead of wandering randomly.
class EntranceHall extends NeedsBuilding {
  constructor() {
    super({ id: 'entrance_hall', type: 'entrance_hall', cost: 0 });
    this.level = 1;
  }
}

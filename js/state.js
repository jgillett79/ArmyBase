// state.js — single source of truth. render.js reads it, main.js drives it.

const SAVE_KEY = 'armybase_save_v1'; // bumped — v0 saves don't have energy/food/schedule fields
const GRID_COLS = 20;
const GRID_ROWS = 12;
const CELL_SIZE = 48; // px, matches canvas 960x576

const CASH_PER_SECOND_IDLE = 0.5; // passive trickle, proves offline catch-up works
const CIVILIAN_SPAWN_INTERVAL_MS = 8000; // avg time between civilian spawns
const CIVILIAN_WALK_TIMEOUT_MS = 12000; // how long they linger before leaving

// ---------------------------------------------------------------------------
// THREE CLOCKS — read this before touching any timing code.
// 1. Game day/night clock: COMPRESSED. 5 real minutes = 24 game hours.
//    Drives training/sleep/schedule decisions. Lives in gameState.gameClockMs.
// 2. Hospital recovery: REAL TIME, uncompressed. 23 hours real, regardless
//    of what the game clock is doing. Lives in unit.hospitalUntil (Date.now()-based).
// 3. Offline catch-up cap: REAL TIME. Capped at 24h — log off, come back
//    within a day, everything (including hospital stays) has accrued normally.
// Do not derive #2 or #3 from the compressed game clock. This was flagged as
// the most likely bug class in this system — keep it that way on purpose.
// ---------------------------------------------------------------------------
const DAY_LENGTH_REAL_MS = 5 * 60 * 1000; // 5 real minutes = 1 full game day
const GAME_MS_PER_REAL_MS = (24 * 60 * 60 * 1000) / DAY_LENGTH_REAL_MS; // = 288
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;
const OFFLINE_CATCHUP_CAP_MS = 24 * 60 * 60 * 1000; // was 3 days in Phase 0, now 24h per spec

const FOOD_COST_PER_UNIT = 1.5; // cash per food, placeholder pricing
const FOOD_CONSUMED_PER_GAME_HOUR = 5; // per unit actively eating with food available

// ---------------------------------------------------------------------------
// PERIMETER WALL + GATE — the base is enclosed by a 1-cell-thick wall on all
// four sides; the only way in or out is the gate, a 2-cell-tall gap in the
// LEFT wall (col 0). All existing buildings sit at gridX 2-17/gridY 2-7, well
// clear of this border, so they didn't need to move. render.js draws the
// wall itself; the constants below are shared with the civilian spawn/leave
// logic below so both stay in sync with where the gap actually is.
// ---------------------------------------------------------------------------
const WALL_THICKNESS = CELL_SIZE; // 1 cell
const GATE_ROW_START = 5;
const GATE_ROWS = 2;
const GATE_Y_TOP = GATE_ROW_START * CELL_SIZE;
const GATE_Y_BOTTOM = (GATE_ROW_START + GATE_ROWS) * CELL_SIZE;
const GATE_Y_CENTER = (GATE_Y_TOP + GATE_Y_BOTTOM) / 2;
const GATE_OUTSIDE_X = -20; // off-canvas, just past the wall's outer face
const GATE_INSIDE_X = WALL_THICKNESS + 8; // just inside the wall, matches bounds.minX

class GameState {
  constructor() {
    this.cash = 200;
    this.food = 30; // starting stock so the loop is testable immediately
    this.units = [];
    this.barracks = new Barracks(2, 2);
    this.shootingRange = new ShootingRange(8, 2);
    this.messHall = new MessHall(14, 2);
    // Second building row (Phase 2) — same x-spacing as row one, y=5 keeps
    // them clear of the row-one footprint (h=2 cells) with room to spare.
    this.weightRoom = new WeightRoom(2, 5);
    this.obstacleCourse = new ObstacleCourse(8, 5);
    this.drillYard = new CombatDrillYard(14, 5);
    this.lastTick = Date.now();
    this.lastCivilianSpawn = Date.now();
    this.gameClockMs = DAY_START_HOUR * 60 * 60 * 1000; // start at 06:00 game time

    // Walkable bounds in pixels — the interior of the perimeter wall, with a
    // small margin so units don't visually touch it.
    this.bounds = {
      minX: WALL_THICKNESS + 8,
      maxX: GRID_COLS * CELL_SIZE - WALL_THICKNESS - 8,
      minY: WALL_THICKNESS + 8,
      maxY: GRID_ROWS * CELL_SIZE - WALL_THICKNESS - 8,
    };
  }

  get hourOfDay() {
    return (this.gameClockMs / (60 * 60 * 1000)) % 24;
  }

  get isDaytime() {
    return this.hourOfDay >= DAY_START_HOUR && this.hourOfDay < DAY_END_HOUR;
  }

  buildingCenter(building) {
    return {
      x: building.gridX * CELL_SIZE + (BUILDING_FOOTPRINT_CELLS.w * CELL_SIZE) / 2,
      y: building.gridY * CELL_SIZE + (BUILDING_FOOTPRINT_CELLS.h * CELL_SIZE) / 2,
    };
  }

  buyFood(amount) {
    const cost = amount * FOOD_COST_PER_UNIT;
    if (this.cash < cost) return false;
    this.cash -= cost;
    this.food += amount;
    return true;
  }

  // All four "assign a unit, a stat climbs" buildings — used for generic
  // assignment/occupancy/upgrade instead of one-off methods per building.
  get trainingBuildings() {
    return [this.shootingRange, this.weightRoom, this.obstacleCourse, this.drillYard];
  }

  buildingById(id) {
    return this.trainingBuildings.find(b => b.id === id) || null;
  }

  occupancyOf(building) {
    return this.units.filter(u => u.assignedBuildingId === building.id).length;
  }

  assignToBuilding(unitId, buildingId) {
    const unit = this.units.find(u => u.id === unitId);
    const building = this.buildingById(buildingId);
    if (!unit || unit.isCivilian || unit.status === UNIT_STATUS.HOSPITAL) return false;
    if (!building || !building.isBuilt) return false;
    if (this.occupancyOf(building) >= building.capacity) return false;
    unit.assignedBuildingId = building.id;
    return true;
  }

  unassignFromTraining(unitId) {
    const unit = this.units.find(u => u.id === unitId);
    if (!unit) return false;
    unit.assignedBuildingId = null;
    return true;
  }

  canUpgradeBuilding(building) {
    return !building.isMaxLevel && this.cash >= building.nextUpgradeCost();
  }

  upgradeBuilding(key) {
    const building = this[key];
    if (!building || !this.canUpgradeBuilding(building)) return false;
    this.cash -= building.nextUpgradeCost();
    building.upgrade();
    return true;
  }

  get unitCap() {
    return BASE_UNIT_CAP + this.barracks.capContribution();
  }

  get soldierCount() {
    return this.units.filter(u => !u.isCivilian).length;
  }

  canBuildOrUpgradeBarracks() {
    return !this.barracks.isMaxLevel && this.cash >= this.barracks.nextUpgradeCost();
  }

  upgradeBarracks() {
    if (!this.canBuildOrUpgradeBarracks()) return false;
    this.cash -= this.barracks.nextUpgradeCost();
    this.barracks.upgrade();
    return true;
  }

  spawnCivilianIfRoom() {
    if (this.soldierCount >= this.unitCap) return; // no point spawning if base is full
    const approaching = this.units.filter(u => u.status === UNIT_STATUS.CIVILIAN_APPROACHING);
    if (approaching.length >= 2) return; // don't flood the screen

    // The wall means there's only one way in: the gate. Spawn just outside
    // it and head for the inside-gate waypoint first — tickCivilian() picks
    // a normal interior wander target once they've actually passed through.
    const civ = new Unit({ x: GATE_OUTSIDE_X, y: GATE_Y_CENTER + randRange(-20, 20), isCivilian: true });
    civ.spawnedAt = Date.now();
    civ.enteredGate = false;
    civ.targetX = GATE_INSIDE_X;
    civ.targetY = GATE_Y_CENTER;
    this.units.push(civ);
  }

  recruit(unitId) {
    const unit = this.units.find(u => u.id === unitId);
    if (!unit || !unit.isCivilian) return false;
    if (this.soldierCount >= this.unitCap) return false;
    const cost = 50;
    if (this.cash < cost) return false;
    this.cash -= cost;
    unit.recruit();
    return true;
  }

  removeUnit(unitId) {
    this.units = this.units.filter(u => u.id !== unitId);
  }

  // Advance simulation by dtSeconds. Used both for the live game loop
  // (small dt, every frame) and for offline catch-up (one large dt).
  tick(dtSeconds, nowMs) {
    this.cash += CASH_PER_SECOND_IDLE * dtSeconds;
    this.gameClockMs = (this.gameClockMs + dtSeconds * 1000 * GAME_MS_PER_REAL_MS) % (24 * 60 * 60 * 1000);
    // dtSeconds (real) * GAME_MS_PER_REAL_MS = game-ms elapsed per real-second-of-dt.
    // Divide by 3600 (not 3.6M) since dtSeconds is already in seconds, not ms.
    const gameHours = (dtSeconds * GAME_MS_PER_REAL_MS) / 3600;
    const isDaytime = this.isDaytime;
    const foodAvailable = this.food > 0;

    const toRemove = new Set();
    let foodConsumedThisTick = 0;

    for (const unit of this.units) {
      if (unit.isCivilian) {
        this.tickCivilian(unit, dtSeconds, nowMs, toRemove);
        continue;
      }

      if (unit.status === UNIT_STATUS.HOSPITAL) {
        if (unit.isRecovered(nowMs)) {
          unit.status = UNIT_STATUS.IDLE; // next tick's desiredStatus() will route them correctly
        }
        continue;
      }

      // Decide + apply transition if the desired status differs from current
      const desired = unit.desiredStatus(isDaytime);
      if (desired !== unit.status) this.transitionUnit(unit, desired);

      unit.step(dtSeconds);

      unit.applyEnergyDelta(gameHours, foodAvailable);
      if (unit.status === UNIT_STATUS.EATING && foodAvailable && unit.isAtTarget()) {
        foodConsumedThisTick += FOOD_CONSUMED_PER_GAME_HOUR * gameHours;
      }
      if (unit.status === UNIT_STATUS.TRAINING && unit.isAtTarget()) {
        const building = this.buildingById(unit.assignedBuildingId);
        if (building) unit.applyTrainingGain(gameHours, building.trains);
      }

      if (unit.energy <= 0) {
        unit.sendToHospital(nowMs);
      }
    }

    this.food = Math.max(0, this.food - foodConsumedThisTick);

    if (toRemove.size > 0) {
      this.units = this.units.filter(u => !toRemove.has(u.id));
    }
  }

  // Moves a unit into a new status and points it at wherever that status
  // happens (Mess Hall, Shooting Range, Barracks for sleep, or a wander spot).
  transitionUnit(unit, desired) {
    unit.status = desired;
    if (desired === UNIT_STATUS.EATING) {
      const c = this.buildingCenter(this.messHall);
      unit.targetX = c.x + randRange(-20, 20);
      unit.targetY = c.y + randRange(-20, 20);
    } else if (desired === UNIT_STATUS.TRAINING) {
      // Route to whichever training building this unit is actually assigned
      // to — used to hardcode shootingRange when it was the only one.
      const building = this.buildingById(unit.assignedBuildingId) || this.shootingRange;
      const c = this.buildingCenter(building);
      unit.targetX = c.x + randRange(-20, 20);
      unit.targetY = c.y + randRange(-20, 20);
    } else if (desired === UNIT_STATUS.SLEEPING) {
      const c = this.buildingCenter(this.barracks);
      unit.targetX = c.x + randRange(-20, 20);
      unit.targetY = c.y + randRange(-20, 20);
    } else {
      unit.pickNewWanderTarget(this.bounds);
    }
  }

  // Every civilian's walk has up to 4 legs, all funneled through the single
  // gate (there's no other opening in the wall): outside gate -> inside gate
  // -> interior wander -> inside gate -> outside gate -> despawn.
  tickCivilian(unit, dtSeconds, nowMs, toRemove) {
    const reached = unit.step(dtSeconds);
    if (unit.status === UNIT_STATUS.CIVILIAN_APPROACHING) {
      if (!unit.enteredGate) {
        if (reached) {
          unit.enteredGate = true;
          unit.targetX = randRange(this.bounds.minX + 60, this.bounds.maxX - 60);
          unit.targetY = randRange(this.bounds.minY + 60, this.bounds.maxY - 60);
        }
        return;
      }
      const waited = nowMs - unit.spawnedAt;
      if (waited > CIVILIAN_WALK_TIMEOUT_MS && reached) {
        unit.status = UNIT_STATUS.CIVILIAN_LEAVING;
        unit.targetX = GATE_INSIDE_X;
        unit.targetY = GATE_Y_CENTER;
      }
    } else if (unit.status === UNIT_STATUS.CIVILIAN_LEAVING) {
      if (!reached) return;
      if (unit.x > 0) {
        // just reached the inside-gate waypoint — step through to outside
        unit.targetX = GATE_OUTSIDE_X;
        unit.targetY = GATE_Y_CENTER;
      } else {
        toRemove.add(unit.id); // now outside the wall, gone
      }
    }
  }

  serialize() {
    return {
      cash: this.cash,
      food: this.food,
      gameClockMs: this.gameClockMs,
      barracksLevel: this.barracks.level,
      shootingRangeLevel: this.shootingRange.level,
      messHallLevel: this.messHall.level,
      weightRoomLevel: this.weightRoom.level,
      obstacleCourseLevel: this.obstacleCourse.level,
      drillYardLevel: this.drillYard.level,
      lastTick: Date.now(),
      units: this.units
        .filter(u => !u.isCivilian) // don't persist transient civilians
        .map(u => ({
          id: u.id, name: u.name, x: u.x, y: u.y, colorSeed: u.colorSeed,
          level: u.level, xp: u.xp, xpToNext: u.xpToNext,
          maxHp: u.maxHp, hp: u.hp, strength: u.strength, accuracy: u.accuracy, endurance: u.endurance,
          maxEnergy: u.maxEnergy, energy: u.energy, assignedBuildingId: u.assignedBuildingId,
          equipment: u.equipment, status: u.status, hospitalUntil: u.hospitalUntil,
        })),
    };
  }

  static load() {
    const raw = localStorage.getItem(SAVE_KEY);
    const state = new GameState();
    if (!raw) return state;

    try {
      const data = JSON.parse(raw);
      state.cash = data.cash ?? 200;
      state.food = data.food ?? 30;
      state.gameClockMs = data.gameClockMs ?? state.gameClockMs;
      state.barracks.level = data.barracksLevel ?? 0;
      state.shootingRange.level = data.shootingRangeLevel ?? 0;
      state.messHall.level = data.messHallLevel ?? 0;
      state.weightRoom.level = data.weightRoomLevel ?? 0;
      state.obstacleCourse.level = data.obstacleCourseLevel ?? 0;
      state.drillYard.level = data.drillYardLevel ?? 0;

      state.units = (data.units || []).map(d => {
        const u = new Unit({ x: d.x, y: d.y, isCivilian: false });
        Object.assign(u, d);
        // A unit saved mid-transition (e.g. status EATING but no building
        // built anymore — shouldn't happen, but defensive) falls back to idle.
        if (u.status === UNIT_STATUS.CIVILIAN_APPROACHING || u.status === UNIT_STATUS.CIVILIAN_LEAVING) {
          u.status = UNIT_STATUS.IDLE;
        }
        u.pickNewWanderTarget(state.bounds);
        return u;
      });

      // Offline catch-up: 24h real-time cap, per spec — log off, come back
      // within a day, everything (hospital stays included) has accrued normally.
      // NOTE: this is one big tick, not elapsedSec sub-steps. That's a known
      // approximation — a unit training the whole time offline will apply
      // its full accuracy gain for the period BEFORE the energy-zero check
      // sends them to hospital, rather than realistically stopping partway
      // through. Fine for a prototype; if offline balance ever matters,
      // sub-step this in e.g. 1-game-hour chunks instead.
      const elapsedMs = Date.now() - (data.lastTick || Date.now());
      const elapsedSec = clamp(elapsedMs / 1000, 0, OFFLINE_CATCHUP_CAP_MS / 1000);
      if (elapsedSec > 1) {
        state.tick(elapsedSec, Date.now());
      }
    } catch (e) {
      console.warn('Save corrupt, starting fresh', e);
    }
    return state;
  }

  save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize()));
  }
}

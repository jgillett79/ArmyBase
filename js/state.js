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

class GameState {
  constructor() {
    this.cash = 200;
    this.food = 30; // starting stock so the loop is testable immediately
    this.units = [];
    this.barracks = new Barracks(2, 2);
    this.shootingRange = new ShootingRange(8, 2);
    this.messHall = new MessHall(14, 2);
    this.lastTick = Date.now();
    this.lastCivilianSpawn = Date.now();
    this.gameClockMs = DAY_START_HOUR * 60 * 60 * 1000; // start at 06:00 game time

    // Walkable bounds in pixels, kept inset from canvas edge
    this.bounds = { minX: 40, maxX: 960 - 40, minY: 90, maxY: 576 - 40 };
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

  shootingRangeOccupancy() {
    return this.units.filter(u => u.assignedBuildingId === this.shootingRange.id).length;
  }

  assignToTraining(unitId) {
    const unit = this.units.find(u => u.id === unitId);
    if (!unit || unit.isCivilian || unit.status === UNIT_STATUS.HOSPITAL) return false;
    if (!this.shootingRange.isBuilt) return false;
    if (this.shootingRangeOccupancy() >= this.shootingRange.capacity) return false;
    unit.assignedBuildingId = this.shootingRange.id;
    return true;
  }

  unassignFromTraining(unitId) {
    const unit = this.units.find(u => u.id === unitId);
    if (!unit) return false;
    unit.assignedBuildingId = null;
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

    // Spawn at a random point along the base's outer edge — the "bus stop / street"
    const edge = pick(['top', 'bottom', 'left', 'right']);
    let x, y;
    if (edge === 'top') { x = randRange(this.bounds.minX, this.bounds.maxX); y = this.bounds.minY; }
    else if (edge === 'bottom') { x = randRange(this.bounds.minX, this.bounds.maxX); y = this.bounds.maxY; }
    else if (edge === 'left') { x = this.bounds.minX; y = randRange(this.bounds.minY, this.bounds.maxY); }
    else { x = this.bounds.maxX; y = randRange(this.bounds.minY, this.bounds.maxY); }

    const civ = new Unit({ x, y, isCivilian: true });
    civ.spawnedAt = Date.now();
    // Walk toward the base centre-ish area so they're clickable, not stuck on the wall
    civ.targetX = randRange(this.bounds.minX + 100, this.bounds.maxX - 100);
    civ.targetY = randRange(this.bounds.minY + 100, this.bounds.maxY - 100);
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
        unit.applyTrainingGain(gameHours);
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
      const c = this.buildingCenter(this.shootingRange);
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

  tickCivilian(unit, dtSeconds, nowMs, toRemove) {
    const reached = unit.step(dtSeconds);
    if (unit.status === UNIT_STATUS.CIVILIAN_APPROACHING) {
      const waited = nowMs - unit.spawnedAt;
      if (waited > CIVILIAN_WALK_TIMEOUT_MS && reached) {
        unit.status = UNIT_STATUS.CIVILIAN_LEAVING;
        unit.targetX = unit.x < 480 ? this.bounds.minX : this.bounds.maxX;
        unit.targetY = unit.y < 288 ? this.bounds.minY : this.bounds.maxY;
      }
    } else if (unit.status === UNIT_STATUS.CIVILIAN_LEAVING) {
      if (reached) toRemove.add(unit.id);
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
      lastTick: Date.now(),
      units: this.units
        .filter(u => !u.isCivilian) // don't persist transient civilians
        .map(u => ({
          id: u.id, name: u.name, x: u.x, y: u.y, colorSeed: u.colorSeed,
          level: u.level, xp: u.xp, xpToNext: u.xpToNext,
          maxHp: u.maxHp, hp: u.hp, strength: u.strength, accuracy: u.accuracy,
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

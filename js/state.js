// state.js — single source of truth. render.js reads it, main.js drives it.

const SAVE_KEY = 'armybase_save_v1'; // bumped — v0 saves don't have energy/food/schedule fields
const GRID_COLS = 20;
const GRID_ROWS = 12;
const CELL_SIZE = 48; // px, matches canvas 960x576

const CASH_PER_SECOND_IDLE = 0.5; // passive trickle, proves offline catch-up works
const CIVILIAN_SPAWN_INTERVAL_MS = 8000; // avg time between civilian spawns
const CIVILIAN_WALK_TIMEOUT_MS = 12000; // how long they linger before leaving
const MISSION_LOG_MAX = 8; // most recent mission results kept for the panel

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

// ---------------------------------------------------------------------------
// ENTRANCE HALL — civilians used to pick one random point anywhere inside
// the walls and wander there, which read as "aimless" (user feedback).
// Now they walk to a fixed waiting chair in the Entrance Hall instead, same
// idea as any other job/need routing to a fixed building spot. Chair
// positions are offsets from the building's door (buildingDoor() below) so
// they move if the building ever does. Placeholder spacing, like every
// other pixel-tuned number in this file — not a balance-critical value.
// ---------------------------------------------------------------------------
const ENTRANCE_HALL_CHAIRS = [
  { dx: -48, dy: -30 },
  { dx: -16, dy: -30 },
  { dx: 16, dy: -30 },
  { dx: 48, dy: -30 },
];

// ---------------------------------------------------------------------------
// ROADS — a fixed "comb" network: one horizontal spine plus a vertical spoke
// under each column of buildings. Every recruited unit's movement (walking
// to a job, wandering when idle) travels via this network instead of
// cutting straight lines across open ground.
//
// This works without real pathfinding (no A*/Dijkstra) because the layout
// is a simple comb, not an arbitrary graph: every route is the same 3-leg
// shape — drop from wherever the unit currently is straight down to the
// spine (safe because every building sits well above ROAD_Y_SPINE, so that
// drop never cuts through a building), slide along the spine to the
// target's x, then travel up/down that x to the target. If the base layout
// ever stops being "one spine + straight spokes," revisit this — don't
// bolt real pathfinding onto a comb network that doesn't need it.
// ---------------------------------------------------------------------------
const ROAD_Y_SPINE = 360; // px — below every building's footprint (max bottom edge is y=336)

// Bottom-center of a building's footprint, in pixels — where its spoke road
// meets it. Used both for routing and for drawing the roads in render.js.
function buildingDoor(building) {
  return {
    x: building.gridX * CELL_SIZE + (BUILDING_FOOTPRINT_CELLS.w * CELL_SIZE) / 2,
    y: (building.gridY + BUILDING_FOOTPRINT_CELLS.h) * CELL_SIZE,
  };
}

class GameState {
  constructor() {
    this.cash = 200;
    this.food = 30; // starting stock so the loop is testable immediately
    // Mission-tier resources — see mission.js. All start at 0; only earned
    // from mission rewards (Lumber/Steel/Gems), cash covers everything else.
    this.lumber = 0;
    this.steel = 0;
    this.gems = 0;
    // Most recent mission outcomes, newest first — see resolveMissionForUnit().
    // Transient like the active-missions list, not persisted across saves.
    this.missionLog = [];
    this.units = [];
    this.barracks = new Barracks(2, 2);
    this.shootingRange = new ShootingRange(8, 2);
    this.messHall = new MessHall(14, 2);
    // Second building row (Phase 2) — same x-spacing as row one, y=5 keeps
    // them clear of the row-one footprint (h=2 cells) with room to spare.
    this.weightRoom = new WeightRoom(2, 5);
    this.obstacleCourse = new ObstacleCourse(8, 5);
    this.drillYard = new CombatDrillYard(14, 5);
    // Third row, BELOW the road spine (y=8) rather than above it like rows
    // one/two — reuses spokes A/B/C (same gridX as the buildings above them
    // in each column) so no new spoke position is needed; routeTo()'s
    // spine-then-target shape already works in either direction, only the
    // road *drawing* in render.js needed to know about these three.
    //
    // Entrance Hall sits in the gridX=2 slot — the column closest to the
    // gate — rather than gridX=14, on purpose: civilians walk here straight
    // off the road network with no special-casing, and putting the newest
    // arrivals' waiting room at the far end of the base made for an
    // needlessly long walk across the whole map (user feedback). Showers
    // took the vacated gridX=14 slot; it's used by already-recruited
    // soldiers on their daily schedule, who already commute similar
    // distances to whichever training building they're assigned to, so this
    // didn't create a new "too far to walk" case the way Entrance Hall did.
    this.entranceHall = new EntranceHall(2, 8);
    this.recRoom = new RecRoom(8, 8);
    this.showers = new Showers(14, 8);
    // Which unit (by id) occupies each ENTRANCE_HALL_CHAIRS slot, or null.
    this.chairOccupants = new Array(ENTRANCE_HALL_CHAIRS.length).fill(null);
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

  // Absolute pixel position of a specific Entrance Hall waiting chair.
  chairPosition(index) {
    const door = buildingDoor(this.entranceHall);
    const offset = ENTRANCE_HALL_CHAIRS[index];
    return { x: door.x + offset.dx, y: door.y + offset.dy };
  }

  // Claims the first free chair for a waiting civilian. Returns the chair
  // index, or null if every chair is already taken (spawnCivilianIfRoom
  // caps concurrent civilians at ENTRANCE_HALL_CHAIRS.length so this should
  // be rare, but two civilians can still both be mid-walk toward the gate
  // when the last chair fills — see tickCivilian's fallback for that case).
  assignChair(unit) {
    const index = this.chairOccupants.indexOf(null);
    if (index === -1) return null;
    this.chairOccupants[index] = unit.id;
    unit.chairIndex = index;
    return index;
  }

  releaseChair(unit) {
    if (unit.chairIndex === null) return;
    this.chairOccupants[unit.chairIndex] = null;
    unit.chairIndex = null;
  }

  // The 3 x-positions the road spokes run along — derived from the row-1
  // buildings' actual gridX rather than hardcoded, so this can't drift out
  // of sync if a building ever moves.
  get roadSpokeXs() {
    return [this.barracks, this.shootingRange, this.messHall].map(b => buildingDoor(b).x);
  }

  // The one shared movement primitive behind all road-based routing — see
  // the ROADS comment above for why this 3-leg shape is always safe.
  routeTo(unit, targetX, targetY) {
    unit.setPath([
      { x: unit.x, y: ROAD_Y_SPINE },
      { x: targetX, y: ROAD_Y_SPINE },
      { x: targetX, y: targetY },
    ]);
  }

  routeToBuilding(unit, building) {
    const c = this.buildingCenter(building);
    this.routeTo(unit, c.x + randRange(-20, 20), c.y + randRange(-20, 20));
  }

  // Idle wander now picks a random point along the road network instead of
  // anywhere in the bounds, so units stay on the roads even when they don't
  // have anywhere in particular to be.
  routeToRandomRoadPoint(unit) {
    if (Math.random() < 0.5) {
      this.routeTo(unit, randRange(this.bounds.minX, this.bounds.maxX), ROAD_Y_SPINE);
    } else {
      const x = pick(this.roadSpokeXs);
      this.routeTo(unit, x, randRange(this.bounds.minY, ROAD_Y_SPINE));
    }
  }

  // Single place that maps "what is this unit's status" to "where should it
  // be walking" — used both on a live status change (transitionUnit) and
  // whenever a unit needs a fresh route without a status change of its own
  // (recruiting, loading a save, waking up from the hospital).
  routeForStatus(unit) {
    if (unit.status === UNIT_STATUS.EATING) {
      this.routeToBuilding(unit, this.messHall);
    } else if (unit.status === UNIT_STATUS.HYGIENE) {
      this.routeToBuilding(unit, this.showers);
    } else if (unit.status === UNIT_STATUS.RECREATION) {
      this.routeToBuilding(unit, this.recRoom);
    } else if (unit.status === UNIT_STATUS.TRAINING) {
      const building = this.buildingById(unit.assignedBuildingId) || this.shootingRange;
      this.routeToBuilding(unit, building);
    } else if (unit.status === UNIT_STATUS.SLEEPING || unit.status === UNIT_STATUS.RECRUITING) {
      this.routeToBuilding(unit, this.barracks);
    } else if (unit.status === UNIT_STATUS.HOSPITAL || unit.status === UNIT_STATUS.ON_MISSION) {
      // Neither moves nor renders while in this status (see tick()) — no
      // route to assign.
    } else {
      this.routeToRandomRoadPoint(unit);
    }
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
    if (!unit || unit.isCivilian || unit.status === UNIT_STATUS.HOSPITAL || unit.status === UNIT_STATUS.RECRUITING) return false;
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

  // Shared "buy it once, no levels" build action for the NeedsBuilding trio
  // (Mess Hall, Showers, Rec Room) — mirrors upgradeBuilding()'s role for
  // the training buildings below.
  buildNeedsBuilding(key) {
    const building = this[key];
    if (!building || building.isBuilt || this.cash < building.buildCost()) return false;
    this.cash -= building.buildCost();
    building.build();
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
    // Capped at the Entrance Hall's chair count, not an arbitrary number —
    // no point letting more civilians in than there's a seat for.
    if (approaching.length >= ENTRANCE_HALL_CHAIRS.length) return;

    // The wall means there's only one way in: the gate. Spawn just outside
    // it and head for the inside-gate waypoint first — tickCivilian() sends
    // them to a waiting chair in the Entrance Hall once they've actually
    // passed through.
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
    this.releaseChair(unit); // free their seat for the next civilian
    unit.recruit();
    this.routeForStatus(unit); // RECRUITING -> routes them to the Barracks, see tick()
    return true;
  }

  removeUnit(unitId) {
    this.units = this.units.filter(u => u.id !== unitId);
  }

  // --- Missions — see mission.js for the tier data/pure-function rules ---

  eligibleUnitsForTier(tier) {
    return this.units.filter(u =>
      !u.isCivilian && u.status === UNIT_STATUS.IDLE && unitMeetsMissionRequirements(u, tier));
  }

  dispatchMission(tierId, unitIds) {
    const tier = missionTierById(tierId);
    if (!tier) return false;
    if (unitIds.length === 0 || unitIds.length > tier.maxSquadSize) return false;

    const squad = unitIds.map(id => this.units.find(u => u.id === id)).filter(Boolean);
    if (squad.length !== unitIds.length) return false; // some id didn't resolve to a real unit
    if (!squad.every(u => u.status === UNIT_STATUS.IDLE && unitMeetsMissionRequirements(u, tier))) return false;

    const returnAt = Date.now() + tier.durationMs;
    for (const unit of squad) {
      unit.status = UNIT_STATUS.ON_MISSION;
      unit.missionReturnAt = returnAt;
      unit.missionTierId = tier.id;
    }
    return true;
  }

  // Resolves one returning unit's mission — called once per squad-mate from
  // tick() below. Every unit in a squad rolls independently, so a squad can
  // come back partially successful (some hospitalized, some not) rather
  // than all-or-nothing.
  resolveMissionForUnit(unit, nowMs) {
    const tier = missionTierById(unit.missionTierId);
    const succeeded = tier && Math.random() < missionSuccessChance(tier, [unit]);

    let cashEarned = 0;
    let resourceEarned = null;
    let xpEarned = 0;
    if (succeeded) {
      cashEarned = rollInRange(tier.cashReward);
      this.cash += cashEarned;
      if (tier.resourceReward) {
        const amount = rollInRange(tier.resourceReward.amount);
        this[tier.resourceReward.type] += amount;
        resourceEarned = { type: tier.resourceReward.type, amount };
      }
      xpEarned = rollInRange(tier.xpReward);
      unit.addXp(xpEarned);
    }

    // Missions used to resolve completely silently — the log is what
    // actually makes the system feel alive in the UI. Capped, not
    // persisted (transient, same idea as the active-missions list).
    this.missionLog.unshift({
      unitName: unit.name,
      tierName: tier ? tier.name : 'Unknown Mission',
      succeeded,
      flavor: pickMissionFlavor(succeeded),
      cashEarned, resourceEarned, xpEarned,
      timestamp: nowMs,
    });
    if (this.missionLog.length > MISSION_LOG_MAX) this.missionLog.length = MISSION_LOG_MAX;

    unit.missionReturnAt = null;
    unit.missionTierId = null;

    if (succeeded) {
      // Reappear at the gate, same "the wall/gate is the only way in or
      // out" convention as a fresh recruit walking in — see RECRUITING.
      unit.x = GATE_INSIDE_X;
      unit.y = GATE_Y_CENTER;
      unit.status = UNIT_STATUS.IDLE;
      this.routeForStatus(unit);
    } else {
      // Same 23h real-time hospital stay as any other failure in this game
      // — no permadeath, mission failure isn't treated as worse than
      // neglect death. See CLAUDE.md.
      unit.sendToHospital(nowMs);
    }
  }

  // Advance simulation by dtSeconds. Used both for the live game loop
  // (small dt, every frame) and for offline catch-up (one large dt).
  tick(dtSeconds, nowMs) {
    this.cash += CASH_PER_SECOND_IDLE * dtSeconds;
    this.gameClockMs = (this.gameClockMs + dtSeconds * 1000 * GAME_MS_PER_REAL_MS) % (24 * 60 * 60 * 1000);
    // dtSeconds (real) * GAME_MS_PER_REAL_MS = game-ms elapsed per real-second-of-dt.
    // Divide by 3600 (not 3.6M) since dtSeconds is already in seconds, not ms.
    const gameHours = (dtSeconds * GAME_MS_PER_REAL_MS) / 3600;
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
          unit.status = UNIT_STATUS.IDLE;
          this.routeForStatus(unit); // bypasses transitionUnit, so route explicitly here
        }
        continue;
      }

      if (unit.status === UNIT_STATUS.ON_MISSION) {
        // Real-time, like the hospital timer — not derived from the
        // compressed game clock. Excluded from movement/energy/training
        // entirely while away (async/black-box mission, see mission.js).
        if (nowMs >= unit.missionReturnAt) {
          this.resolveMissionForUnit(unit, nowMs);
        }
        continue;
      }

      if (unit.status === UNIT_STATUS.RECRUITING) {
        // Walking to the Barracks — bypasses desiredStatus() entirely so
        // nothing (energy, time of day) can redirect them mid-walk before
        // they've actually enlisted. The uniform swap is the "arrival"
        // moment: it only happens once they've truly reached the Barracks,
        // not just gotten close (see Unit.isAtTarget()'s path check).
        unit.step(dtSeconds);
        unit.applyEnergyDelta(gameHours, foodAvailable);
        if (unit.energy <= 0) {
          unit.sendToHospital(nowMs);
        } else if (unit.isAtTarget()) {
          unit.outfit = 'uniform';
          unit.status = UNIT_STATUS.IDLE;
          this.routeForStatus(unit);
        }
        continue;
      }

      // Decide + apply transition if the desired status differs from current
      const desired = unit.desiredStatus(this.hourOfDay);
      if (desired !== unit.status) this.transitionUnit(unit, desired);

      unit.step(dtSeconds);

      unit.applyEnergyDelta(gameHours, foodAvailable);
      unit.applyHygieneDelta(gameHours, this.showers.isBuilt);
      unit.applyMoraleDelta(gameHours, this.recRoom.isBuilt);
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

  // Moves a unit into a new status and routes it to wherever that status
  // happens (Mess Hall, Shooting Range, Barracks for sleep, or a random
  // road point) — see routeForStatus() above.
  transitionUnit(unit, desired) {
    unit.status = desired;
    this.routeForStatus(unit);
  }

  // Every civilian's walk has up to 4 legs, all funneled through the single
  // gate (there's no other opening in the wall): outside gate -> inside gate
  // -> Entrance Hall waiting chair -> inside gate -> outside gate -> despawn.
  tickCivilian(unit, dtSeconds, nowMs, toRemove) {
    const reached = unit.step(dtSeconds);
    if (unit.status === UNIT_STATUS.CIVILIAN_APPROACHING) {
      if (!unit.enteredGate) {
        if (reached) {
          unit.enteredGate = true;
          const chairIndex = this.assignChair(unit);
          if (chairIndex !== null) {
            const seat = this.chairPosition(chairIndex);
            unit.targetX = seat.x;
            unit.targetY = seat.y;
          } else {
            // Every chair taken by another civilian still mid-walk — wait
            // just inside the gate rather than crossing the whole base with
            // nowhere to actually sit (spawnCivilianIfRoom keeps this rare,
            // not impossible).
            unit.targetX = GATE_INSIDE_X + 20;
            unit.targetY = GATE_Y_CENTER;
          }
        }
        return;
      }
      const waited = nowMs - unit.spawnedAt;
      if (waited > CIVILIAN_WALK_TIMEOUT_MS && reached) {
        this.releaseChair(unit);
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
      lumber: this.lumber,
      steel: this.steel,
      gems: this.gems,
      barracksLevel: this.barracks.level,
      shootingRangeLevel: this.shootingRange.level,
      messHallLevel: this.messHall.level,
      weightRoomLevel: this.weightRoom.level,
      obstacleCourseLevel: this.obstacleCourse.level,
      drillYardLevel: this.drillYard.level,
      showersLevel: this.showers.level,
      recRoomLevel: this.recRoom.level,
      lastTick: Date.now(),
      units: this.units
        .filter(u => !u.isCivilian) // don't persist transient civilians
        .map(u => ({
          id: u.id, name: u.name, x: u.x, y: u.y, colorSeed: u.colorSeed,
          level: u.level, xp: u.xp, xpToNext: u.xpToNext,
          maxHp: u.maxHp, hp: u.hp, strength: u.strength, accuracy: u.accuracy, endurance: u.endurance,
          maxEnergy: u.maxEnergy, energy: u.energy, hygiene: u.hygiene, morale: u.morale, assignedBuildingId: u.assignedBuildingId,
          equipment: u.equipment, status: u.status, hospitalUntil: u.hospitalUntil,
          missionReturnAt: u.missionReturnAt, missionTierId: u.missionTierId,
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
      state.lumber = data.lumber ?? 0;
      state.steel = data.steel ?? 0;
      state.gems = data.gems ?? 0;
      state.gameClockMs = data.gameClockMs ?? state.gameClockMs;
      state.barracks.level = data.barracksLevel ?? 0;
      state.shootingRange.level = data.shootingRangeLevel ?? 0;
      state.messHall.level = data.messHallLevel ?? 0;
      state.weightRoom.level = data.weightRoomLevel ?? 0;
      state.obstacleCourse.level = data.obstacleCourseLevel ?? 0;
      state.drillYard.level = data.drillYardLevel ?? 0;
      state.showers.level = data.showersLevel ?? 0;
      state.recRoom.level = data.recRoomLevel ?? 0;

      state.units = (data.units || []).map(d => {
        const u = new Unit({ x: d.x, y: d.y, isCivilian: false });
        Object.assign(u, d);
        // A unit saved mid-transition (e.g. status EATING but no building
        // built anymore — shouldn't happen, but defensive) falls back to idle.
        if (u.status === UNIT_STATUS.CIVILIAN_APPROACHING || u.status === UNIT_STATUS.CIVILIAN_LEAVING) {
          u.status = UNIT_STATUS.IDLE;
        }
        state.routeForStatus(u); // fresh route on load rather than resuming a stale one
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

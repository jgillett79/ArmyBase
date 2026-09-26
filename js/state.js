// state.js — single source of truth. render.js reads it, main.js drives it.

const CASH_PER_SECOND_IDLE = 0.03; // ~$108/hour; missions now matter more than waiting
const CIVILIAN_SPAWN_INTERVAL_MS = 8000; // avg time between civilian spawns
const CIVILIAN_WALK_TIMEOUT_MS = 30000; // let arrivals reach the hall and be noticed

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
// LAYOUT — the base is the authored terrain map in world.js: irregular build
// zones, one gate on the west edge (the only way in or out), and a path
// graph people walk with a shortest-path search. This replaced the old
// 20 x 12 grid and the single-spine road "comb" once the design moved to a
// terrain-shaped base (DESIGN.md). Save migration lives in save.js.
// ---------------------------------------------------------------------------
const BUILDING_KEYS = ['entranceHall', 'barracks', 'shootingRange', 'messHall', 'weightRoom',
  'obstacleCourse', 'drillYard', 'showers', 'recRoom'];

function buildingZone(building) {
  return zoneById(building.zoneId);
}

// The walkable entrance of a building's zone, on the side facing its path spur.
function buildingDoor(building) {
  const { entrance } = buildingZone(building);
  return { x: entrance.x, y: entrance.y };
}

function gatePosition(nodeId = 'gate') {
  return worldNodePosition(nodeId);
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
    this.missionLog = [];
    this.units = [];
    this.barracks = new Barracks();
    this.shootingRange = new ShootingRange();
    this.messHall = new MessHall();
    this.weightRoom = new WeightRoom();
    this.obstacleCourse = new ObstacleCourse();
    this.drillYard = new CombatDrillYard();
    this.entranceHall = new EntranceHall();
    this.recRoom = new RecRoom();
    this.showers = new Showers();
    // Where each building stands is data (world.js defaultPlacements), kept
    // separate from its type and level. Entrance Hall's zone is the clearing
    // beside the gate on purpose: newcomers should not cross the whole base
    // to find a seat (user feedback, see CLAUDE.md).
    for (const building of this.allBuildings) building.zoneId = WORLD.defaultPlacements[building.id];
    // Which unit (by id) occupies each Entrance Hall waiting slot, or null.
    this.chairOccupants = new Array(this.waitingSlots.length).fill(null);
    this.lastTick = Date.now();
    this.lastCivilianSpawn = Date.now();
    this.gameClockMs = DAY_START_HOUR * 60 * 60 * 1000; // start at 06:00 game time
  }

  get hourOfDay() {
    return (this.gameClockMs / (60 * 60 * 1000)) % 24;
  }

  get isDaytime() {
    return this.hourOfDay >= DAY_START_HOUR && this.hourOfDay < DAY_END_HOUR;
  }

  get allBuildings() {
    return BUILDING_KEYS.map(key => this[key]);
  }

  buildingByAnyId(id) {
    return this.allBuildings.find(b => b.id === id) || null;
  }

  // Zones with a building assigned. Their spurs are routable even before the
  // building is finished (recruits still walk to the Barracks site), but
  // render.js only draws a spur once its facility exists or is surveyed.
  get placedZoneIds() {
    return new Set(this.allBuildings.map(b => b.zoneId).filter(Boolean));
  }

  // Moves an unbuilt building to another legal, free zone. Built buildings
  // stay put — relocation would need a demolish/rebuild design first.
  placeBuilding(building, zoneId) {
    const zone = zoneById(zoneId);
    if (!zone || !zoneAllowsType(zone, building.type) || building.isBuilt) return false;
    if (this.allBuildings.some(b => b !== building && b.zoneId === zoneId)) return false;
    building.zoneId = zoneId;
    return true;
  }

  get waitingSlots() {
    return buildingZone(this.entranceHall).slots;
  }

  // World position of a specific Entrance Hall waiting chair.
  chairPosition(index) {
    const slot = this.waitingSlots[index];
    return { x: slot.x, y: slot.y };
  }

  // Claims the first free chair for a waiting civilian. Returns the chair
  // index, or null if every chair is already taken (spawnCivilianIfRoom
  // caps concurrent civilians at the chair count so this should be rare,
  // but two civilians can still both be mid-walk toward the gate when the
  // last chair fills — see tickCivilian's fallback for that case).
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

  // Walk the path graph from wherever the unit stands to nodeId, then step
  // to `finish` (a short local approach off the path) if given. A route that
  // can't be found sends the unit to the safe gate node instead of leaving
  // it stranded; that only happens if the map data itself is broken.
  routeToNode(unit, nodeId, finish = null) {
    const route = findWorldRoute(unit.x, unit.y, nodeId, this.placedZoneIds);
    if (!route) {
      console.warn(`No route to ${nodeId}; sending ${unit.name} to the gate`);
      unit.setPath([gatePosition(WORLD.safeNodes.gate)]);
      return false;
    }
    if (finish) route.push({ x: finish.x, y: finish.y });
    unit.setPath(route);
    return true;
  }

  // Door, then a step inside the clearing with a little spread so a group
  // doesn't stack on one pixel. Slot-level placement comes in brief 02.
  routeToBuilding(unit, building) {
    const zone = buildingZone(building);
    const centre = polygonCentroid(zone.footprint);
    const dx = centre.x - zone.entrance.x, dy = centre.y - zone.entrance.y;
    const length = Math.hypot(dx, dy) || 1;
    const spread = randRange(-10, 10);
    this.routeToNode(unit, doorNodeId(zone.id), {
      x: zone.entrance.x + (dx / length) * 8 - (dy / length) * spread,
      y: zone.entrance.y + (dy / length) * 8 + (dx / length) * spread,
    });
  }

  // Idle wander: a random point along the trunk trail inside the fence, so
  // units stay on paths even when they have nowhere in particular to be.
  routeToRandomRoadPoint(unit) {
    const edges = worldEdgeList(new Set()).filter(e => e.from !== 'gate_outside' && e.from !== 'gate');
    const edge = pick(edges);
    const walk = edgePrefix(edge, randRange(0.1, 0.9));
    if (this.routeToNode(unit, edge.from)) unit.path.push(...walk);
  }

  // Single place that maps "what is this unit's status" to "where should it
  // be walking" — used both on a live status change (transitionUnit) and
  // whenever a unit needs a fresh route without a status change of its own
  // (recruiting, loading a save, waking up from the hospital).
  routeForStatus(unit) {
    if (unit.status === UNIT_STATUS.EATING) {
      if (this.messHall.isBuilt) this.routeToBuilding(unit, this.messHall);
      else this.routeToRandomRoadPoint(unit);
    } else if (unit.status === UNIT_STATUS.HYGIENE) {
      if (this.showers.isBuilt) this.routeToBuilding(unit, this.showers);
      else this.routeToRandomRoadPoint(unit);
    } else if (unit.status === UNIT_STATUS.RECREATION) {
      if (this.recRoom.isBuilt) this.routeToBuilding(unit, this.recRoom);
      else this.routeToRandomRoadPoint(unit);
    } else if (unit.status === UNIT_STATUS.TRAINING) {
      const building = this.buildingById(unit.assignedBuildingId) || this.shootingRange;
      if (building.isBuilt) this.routeToBuilding(unit, building);
      else this.routeToRandomRoadPoint(unit);
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
    if (unit.status === UNIT_STATUS.TRAINING) this.routeForStatus(unit);
    return true;
  }

  unassignFromTraining(unitId) {
    const unit = this.units.find(u => u.id === unitId);
    if (!unit) return false;
    unit.assignedBuildingId = null;
    if (unit.status === UNIT_STATUS.TRAINING) this.transitionUnit(unit, UNIT_STATUS.IDLE);
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
    return !building.isMaxLevel && this.canAffordUpgrade(building);
  }

  upgradePrice(building) {
    return { cash: building.nextUpgradeCost(), lumber: building.level === 1 ? 10 : 0,
      steel: building.level === 2 ? 6 : 0 };
  }

  canAffordUpgrade(building) {
    const price = this.upgradePrice(building);
    return this.cash >= price.cash && this.lumber >= price.lumber && this.steel >= price.steel;
  }

  payUpgrade(building) {
    const price = this.upgradePrice(building);
    this.cash -= price.cash;
    this.lumber -= price.lumber;
    this.steel -= price.steel;
    building.upgrade();
  }

  upgradeBuilding(key) {
    const building = this[key];
    if (!building || !this.canUpgradeBuilding(building)) return false;
    this.payUpgrade(building);
    return true;
  }

  get unitCap() {
    return BASE_UNIT_CAP + this.barracks.capContribution();
  }

  get soldierCount() {
    return this.units.filter(u => !u.isCivilian).length;
  }

  get completedFacilities() {
    return [this.barracks, ...this.trainingBuildings].filter(b => b.isMaxLevel).length
      + [this.messHall, this.showers, this.recRoom].filter(b => b.isBuilt).length;
  }

  get baseComplete() {
    return this.soldierCount >= 20 && this.completedFacilities === 8;
  }

  canBuildOrUpgradeBarracks() {
    return !this.barracks.isMaxLevel && this.canAffordUpgrade(this.barracks);
  }

  upgradeBarracks() {
    if (!this.canBuildOrUpgradeBarracks()) return false;
    this.payUpgrade(this.barracks);
    return true;
  }

  spawnCivilianIfRoom() {
    if (this.soldierCount >= this.unitCap) return; // no point spawning if base is full
    const approaching = this.units.filter(u => u.status === UNIT_STATUS.CIVILIAN_APPROACHING);
    // Capped at the Entrance Hall's chair count, not an arbitrary number —
    // no point letting more civilians in than there's a seat for.
    if (approaching.length >= this.waitingSlots.length) return;

    // The fence means there's only one way in: the gate. Spawn just outside
    // it and head for the gate checkpoint first — tickCivilian() sends
    // them to a waiting chair in the Entrance Hall once they've actually
    // passed through.
    const outside = gatePosition('gate_outside'), gate = gatePosition('gate');
    const civ = new Unit({ x: outside.x, y: outside.y + randRange(-12, 12), isCivilian: true });
    civ.spawnedAt = Date.now();
    civ.enteredGate = false;
    civ.targetX = gate.x;
    civ.targetY = gate.y;
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
    if (new Set(unitIds).size !== unitIds.length) return false;

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
    const returnedAt = unit.missionReturnAt || nowMs;
    const succeeded = tier && Math.random() < missionSuccessChance(tier, [unit]);
    // Every deployment teaches something; successful missions teach more.
    if (tier) unit.addXp(succeeded ? tier.xpReward : Math.max(10, Math.round(tier.xpReward * 0.25)));
    if (tier) {
      this.missionLog.unshift({ name: unit.name, tier: tier.name, succeeded: !!succeeded,
        xp: succeeded ? tier.xpReward : Math.max(10, Math.round(tier.xpReward * 0.25)), at: returnedAt });
      this.missionLog.length = Math.min(this.missionLog.length, 30);
    }

    if (succeeded) {
      this.cash += rollInRange(tier.cashReward);
      if (tier.resourceReward) {
        this[tier.resourceReward.type] += rollInRange(tier.resourceReward.amount);
      }
    }

    unit.missionReturnAt = null;
    unit.missionTierId = null;

    if (succeeded) {
      // Reappear at the gate, same "the wall/gate is the only way in or
      // out" convention as a fresh recruit walking in — see RECRUITING.
      const gate = gatePosition(WORLD.safeNodes.gate);
      unit.x = gate.x;
      unit.y = gate.y;
      unit.status = UNIT_STATUS.IDLE;
      this.routeForStatus(unit);
    } else {
      // Same 23h real-time hospital stay as any other failure in this game
      // — no permadeath, mission failure isn't treated as worse than
      // neglect death. See CLAUDE.md.
      unit.sendToHospital(returnedAt);
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

      const arrived = unit.isAtTarget();
      const eating = unit.status === UNIT_STATUS.EATING && arrived && this.messHall.isBuilt;
      unit.applyEnergyDelta(gameHours, eating && foodAvailable);
      unit.applyHygieneDelta(gameHours, this.showers.isBuilt && arrived);
      unit.applyMoraleDelta(gameHours, this.recRoom.isBuilt && arrived);
      if (eating && foodAvailable) {
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

  // Every civilian's walk is funneled through the single gate (there's no
  // other opening in the fence): outside gate -> checkpoint -> path to an
  // Entrance Hall waiting chair -> back along the path -> outside -> despawn.
  tickCivilian(unit, dtSeconds, nowMs, toRemove) {
    const reached = unit.step(dtSeconds);
    if (unit.status === UNIT_STATUS.CIVILIAN_APPROACHING) {
      if (!unit.enteredGate) {
        if (reached) {
          unit.enteredGate = true;
          const chairIndex = this.assignChair(unit);
          if (chairIndex !== null) {
            this.routeToNode(unit, WORLD.safeNodes.waiting, this.chairPosition(chairIndex));
          } else {
            // Every chair taken by another civilian still mid-walk — wait
            // just inside the gate rather than crossing the base with
            // nowhere to actually sit (spawnCivilianIfRoom keeps this rare,
            // not impossible).
            this.routeToNode(unit, WORLD.safeNodes.gate);
          }
        }
        return;
      }
      const waited = nowMs - unit.spawnedAt;
      if (waited > CIVILIAN_WALK_TIMEOUT_MS && reached) {
        this.releaseChair(unit);
        unit.status = UNIT_STATUS.CIVILIAN_LEAVING;
        this.routeToNode(unit, 'gate_outside');
      }
    } else if (unit.status === UNIT_STATUS.CIVILIAN_LEAVING) {
      if (reached) toRemove.add(unit.id); // outside the fence, gone
    }
  }

  // Current save schema (v2, see save.js). Building placement is saved
  // beside the level so a future build menu can choose zones.
  serialize() {
    const buildings = {};
    for (const building of this.allBuildings) {
      buildings[building.id] = { level: building.level, zoneId: building.zoneId };
    }
    return {
      schema: SAVE_SCHEMA_VERSION,
      worldId: WORLD_ID,
      cash: this.cash,
      food: this.food,
      gameClockMs: this.gameClockMs,
      lumber: this.lumber,
      steel: this.steel,
      gems: this.gems,
      missionLog: this.missionLog,
      buildings,
      lastTick: Date.now(),
      units: this.units
        .filter(u => !u.isCivilian) // don't persist transient civilians
        .map(u => ({
          id: u.id, name: u.name, x: u.x, y: u.y, colorSeed: u.colorSeed,
          soldierVariant: u.soldierVariant, civilianVariant: u.civilianVariant, outfit: u.outfit,
          level: u.level, xp: u.xp, xpToNext: u.xpToNext,
          maxHp: u.maxHp, hp: u.hp, strength: u.strength, accuracy: u.accuracy, endurance: u.endurance,
          maxEnergy: u.maxEnergy, energy: u.energy, hygiene: u.hygiene, morale: u.morale, assignedBuildingId: u.assignedBuildingId,
          equipment: u.equipment, status: u.status, hospitalUntil: u.hospitalUntil,
          missionReturnAt: u.missionReturnAt, missionTierId: u.missionTierId,
        })),
    };
  }

  // Builds a state from already-normalized v2 data (save.js's
  // normalizeSaveData), then runs bounded offline catch-up.
  static fromSaveData(data, nowMs = Date.now()) {
    const state = new GameState();
    state.cash = data.cash ?? 200;
    state.food = data.food ?? 30;
    state.lumber = data.lumber ?? 0;
    state.steel = data.steel ?? 0;
    state.gems = data.gems ?? 0;
    state.missionLog = Array.isArray(data.missionLog) ? data.missionLog.slice(0, 30) : [];
    state.gameClockMs = data.gameClockMs ?? state.gameClockMs;
    for (const building of state.allBuildings) {
      const saved = data.buildings[building.id];
      if (!saved) continue; // older data without this building keeps its default site
      building.zoneId = saved.zoneId;
      if (building !== state.entranceHall) building.level = saved.level;
    }

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
    // within a day, everything (hospital stays included) has accrued
    // normally, in bounded steps (see catchUp()).
    const elapsedMs = nowMs - (data.lastTick || nowMs);
    const elapsedSec = clamp(elapsedMs / 1000, 0, OFFLINE_CATCHUP_CAP_MS / 1000);
    if (elapsedSec > 1) state.catchUp(elapsedSec, nowMs);
    return state;
  }

  // Loads the newest readable save (current, recovery copy, then v1 — see
  // save.js). A migrated v1 save is written to the v2 key straight away so
  // migration runs once; the v1 key itself is never touched.
  static load() {
    const stored = readStoredSave();
    if (!stored) return new GameState();
    try {
      const state = GameState.fromSaveData(stored.data);
      if (stored.migrated) state.save();
      return state;
    } catch (error) {
      console.warn('Saved game could not be applied, starting fresh', error);
      // Park it where the fresh game's autosave can't overwrite it.
      try { localStorage.setItem(UNREADABLE_SAVE_KEY, JSON.stringify(stored.data)); } catch { /* nothing else to try */ }
      return new GameState();
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize()));
      return true;
    } catch (error) {
      console.warn('Could not save game', error);
      return false;
    }
  }

  // The same bounded steps serve reload and suspended-tab catch-up. Each
  // step reevaluates the schedule and needs, unlike a single 24-hour tick.
  catchUp(elapsedSec, nowMs) {
    const start = nowMs - elapsedSec * 1000;
    for (let elapsed = 0; elapsed < elapsedSec;) {
      const step = Math.min(10, elapsedSec - elapsed);
      elapsed += step;
      this.tick(step, start + elapsed * 1000);
    }
  }
}

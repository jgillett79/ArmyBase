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

// ---------------------------------------------------------------------------
// VISIBLE FACILITY USE — a soldier walks the path to a building's entrance,
// steps to a reserved slot, uses it, and walks back out through the
// entrance. This is presentation layered on the unchanged simulation: the
// only gameplay effect is that training/needs gains start when the unit
// reaches its slot (not merely the door), so what is drawn and what is
// earned agree. Slots are reserved before a unit commits to one and are
// released on any status change, hospital, mission, reassignment or
// removal. Reservations aren't saved: load re-reserves them in roster order,
// which is deterministic and can't double-book.
// ---------------------------------------------------------------------------
const FACILITY_ACTIVITIES = {
  entrance_hall: 'wait', barracks: 'rest', shooting_range: 'fire', weight_room: 'lift',
  obstacle_course: 'traverse', drill_yard: 'drill', mess_hall: 'eat', showers: 'wash', rec_room: 'relax',
};
const CIVILIAN_CHECKPOINT_MS = 2500; // real ms a visitor pauses at the gate before admission
const QUEUE_SPACING = 26;            // world px between people queuing at a full facility
const ACTIVITY_LOG_LIMIT = 300;

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
    this.slotOccupants = new Map(); // "buildingId:slotId" -> unit id (see reserveSlot)
    this.queues = new Map();        // buildingId -> unit ids waiting, first come first served
    this.activityLog = [];
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

  // Can `building` (unbuilt) go on zoneId? 'current' (already its site),
  // 'free', 'swap' (another unbuilt facility is surveyed there and can take
  // this one's site instead) or 'blocked' (built on, or wrong type).
  zonePlacementState(building, zoneId) {
    const zone = zoneById(zoneId);
    if (!zone || !zoneAllowsType(zone, building.type) || building.isBuilt) return 'blocked';
    if (building.zoneId === zoneId) return 'current';
    const occupant = this.allBuildings.find(b => b !== building && b.zoneId === zoneId);
    if (!occupant) return 'free';
    if (occupant.isBuilt) return 'blocked';
    return this.relocationFor(occupant, [zoneId], building.zoneId) ? 'swap' : 'blocked';
  }

  // A legal zone for an unbuilt facility being displaced: preferably
  // `preferred`, else any free zone that allows it. Never one in `avoid`.
  relocationFor(building, avoid, preferred) {
    const taken = zoneId => this.allBuildings.some(b => b !== building && b.zoneId === zoneId);
    if (preferred && !avoid.includes(preferred) && zoneAllowsType(zoneById(preferred), building.type)) return preferred;
    const free = WORLD.zones.find(z => !avoid.includes(z.id) && zoneAllowsType(z, building.type) && !taken(z.id));
    return free ? free.id : null;
  }

  // Moves an unbuilt building to another legal zone, swapping with an
  // unbuilt facility surveyed there. Built buildings stay put — relocation
  // would need a demolish/rebuild design first.
  placeBuilding(building, zoneId) {
    const state = this.zonePlacementState(building, zoneId);
    if (state === 'blocked') return false;
    if (state === 'swap') {
      const occupant = this.allBuildings.find(b => b !== building && b.zoneId === zoneId);
      occupant.zoneId = this.relocationFor(occupant, [zoneId], building.zoneId);
    }
    building.zoneId = zoneId;
    return true;
  }

  // What the first level of a facility costs, as the build menu shows it.
  constructionPrice(building) {
    return building.buildCost ? { cash: building.buildCost(), lumber: 0, steel: 0 } : this.upgradePrice(building);
  }

  // Why it can't be afforded yet ('' when it can), e.g. "$34 more · 10 lumber".
  constructionShortfall(building) {
    const price = this.constructionPrice(building);
    const missing = [];
    if (this.cash < price.cash) missing.push(`$${Math.ceil(price.cash - this.cash)} more`);
    if (this.lumber < price.lumber) missing.push(`${price.lumber - Math.floor(this.lumber)} more lumber`);
    if (this.steel < price.steel) missing.push(`${price.steel - Math.floor(this.steel)} more steel`);
    return missing.join(' · ');
  }

  // Build an unbuilt facility on a chosen zone through the normal purchase
  // rules (economy unchanged). Returns false without changing anything if
  // the site is illegal or it can't be afforded.
  constructAt(key, zoneId) {
    const building = this[key];
    if (!building || building.isBuilt || building === this.entranceHall) return false;
    if (this.constructionShortfall(building) || this.zonePlacementState(building, zoneId) === 'blocked') return false;
    this.placeBuilding(building, zoneId);
    if (building.buildCost) return this.buildNeedsBuilding(key);
    if (building === this.barracks) return this.upgradeBarracks();
    return this.upgradeBuilding(key);
  }

  get waitingSlots() {
    return buildingZone(this.entranceHall).slots;
  }

  // World position of a specific Entrance Hall waiting chair.
  chairPosition(index) {
    const slot = this.waitingSlots[index];
    return { x: slot.x, y: slot.y };
  }

  // --- facility slots, queues and the activity trace -----------------------

  // Append-only trace of presentation events (reserve, release, queue,
  // phase changes, checkpoint, admission, uniform, departure, hospital) for
  // tests and the render/debug pass. Bounded; not saved.
  logActivity(unit, event, detail = {}) {
    this.activityLog.push({ at: Date.now(), clock: this.gameClockMs, unitId: unit.id, name: unit.name, event, ...detail });
    if (this.activityLog.length > ACTIVITY_LOG_LIMIT) this.activityLog.splice(0, this.activityLog.length - ACTIVITY_LOG_LIMIT);
  }

  // The slots a building offers right now. Training buildings open as many
  // as their assignment capacity; the Entrance Hall has its fixed chairs.
  // Barracks and needs buildings have no capacity limit by design, so they
  // add standing spots inside the clearing — they must never make a hungry
  // or tired soldier queue. `minCount` asks for enough spots for that.
  facilitySlots(building, minCount = 0) {
    if (!building.isBuilt) return [];
    const zone = buildingZone(building);
    const activity = FACILITY_ACTIVITIES[building.type];
    // Anchors registered on the facility's art (asset-manifest.js) win over
    // the zone's generic ones, so people stand where the art has stations.
    const source = facilityArtSlots(building.type, zone) || zone.slots;
    const anchors = source.map(s => ({ buildingId: building.id, slotId: s.id, x: s.x, y: s.y, facing: s.facing, activity: s.activity || activity }));
    if (building.capacity !== undefined) return anchors.slice(0, Math.min(building.capacity, anchors.length));
    if (building === this.entranceHall) return anchors;
    const slots = anchors.slice();
    for (let k = 0; slots.length < minCount && k < 400; k++) {
      const anchor = anchors[k % anchors.length];
      const ring = Math.floor(k / anchors.length) + 1;
      const angle = k * 2.4;
      const x = anchor.x + Math.cos(angle) * 14 * ring, y = anchor.y + Math.sin(angle) * 9 * ring;
      if (pointInPolygon(x, y, zone.footprint)) slots.push({ ...anchor, slotId: `${anchor.slotId}_extra${k}`, x, y });
    }
    return slots;
  }

  slotKey(buildingId, slotId) { return `${buildingId}:${slotId}`; }

  slotHolders(building) {
    return [...this.slotOccupants.keys()].filter(key => key.startsWith(`${building.id}:`)).length;
  }

  // Claims the free slot nearest the unit (ties keep authored order), so
  // reload puts someone back on the spot they were standing on.
  reserveSlot(unit, building) {
    const free = this.facilitySlots(building, this.slotHolders(building) + 1)
      .filter(slot => !this.slotOccupants.has(this.slotKey(building.id, slot.slotId)));
    if (!free.length) return null;
    const distance = slot => Math.hypot(slot.x - unit.x, slot.y - unit.y);
    const slot = free.reduce((best, s) => distance(s) < distance(best) - 0.5 ? s : best, free[0]);
    this.slotOccupants.set(this.slotKey(building.id, slot.slotId), unit.id);
    unit.slot = slot;
    if (building === this.entranceHall) unit.chairIndex = this.waitingSlots.findIndex(s => s.id === slot.slotId);
    this.logActivity(unit, 'reserve', { buildingId: building.id, slotId: slot.slotId });
    return slot;
  }

  // Frees whatever the unit holds (slot or queue place) and lets the next
  // queued unit in. Safe to call on a unit that holds nothing.
  releaseSlot(unit, reason) {
    if (unit.slot) {
      const building = this.buildingByAnyId(unit.slot.buildingId);
      this.slotOccupants.delete(this.slotKey(unit.slot.buildingId, unit.slot.slotId));
      this.logActivity(unit, 'release', { buildingId: unit.slot.buildingId, slotId: unit.slot.slotId, reason });
      unit.slot = null;
      unit.chairIndex = null;
      if (building) this.admitFromQueue(building);
    }
    if (unit.queuedFor) {
      const buildingId = unit.queuedFor;
      const queue = this.queues.get(buildingId) || [];
      this.queues.set(buildingId, queue.filter(id => id !== unit.id));
      unit.queuedFor = null;
      this.logActivity(unit, 'leave_queue', { buildingId, reason });
      this.shuffleQueue(this.buildingByAnyId(buildingId));
    }
  }

  // Where the n-th person waits for a full facility: along its spur,
  // stepping back from the entrance toward the trail.
  queuePosition(building, index) {
    const zone = buildingZone(building);
    const access = worldNodePosition(zone.accessNode);
    const dx = access.x - zone.entrance.x, dy = access.y - zone.entrance.y;
    const length = Math.hypot(dx, dy) || 1;
    const along = Math.min(QUEUE_SPACING * (index + 1), length);
    return { x: zone.entrance.x + (dx / length) * along, y: zone.entrance.y + (dy / length) * along };
  }

  // First come, first served whenever a slot frees up (release, upgrade).
  admitFromQueue(building) {
    const queue = this.queues.get(building.id) || [];
    while (queue.length) {
      const free = this.facilitySlots(building, this.slotHolders(building) + 1)
        .some(slot => !this.slotOccupants.has(this.slotKey(building.id, slot.slotId)));
      if (!free) break;
      const nextId = queue.shift();
      const unit = this.units.find(u => u.id === nextId);
      if (!unit) continue;
      unit.queuedFor = null;
      this.logActivity(unit, 'admitted_from_queue', { buildingId: building.id });
      this.routeToBuilding(unit, building);
    }
    this.queues.set(building.id, queue);
    this.shuffleQueue(building);
  }

  // Everyone still queuing moves up to their new place in line.
  shuffleQueue(building) {
    if (!building) return;
    (this.queues.get(building.id) || []).forEach((id, index) => {
      const unit = this.units.find(u => u.id === id);
      if (!unit) return;
      const spot = { ...this.queuePosition(building, index), phase: 'queue' };
      if (unit.path.length) unit.path[unit.path.length - 1] = spot;
      else unit.setPath([spot]);
    });
  }

  // True only while the unit stands on a slot it holds at a built facility —
  // the single condition for facility effects and activity drawing.
  isUsingFacility(unit, building) {
    return !!building && building.isBuilt && !!unit.slot && unit.slot.buildingId === building.id && unit.isAtSlot();
  }

  // --- routing ----------------------------------------------------------------

  // Walk the path graph from wherever the unit stands to nodeId, tagging
  // legs with `phase`, then append `finish` legs (local, off-path). A unit
  // standing inside a zone first walks out through that zone's entrance
  // rather than cutting across its footprint. A route that can't be found
  // sends the unit to the safe gate node instead of stranding it; that only
  // happens if the map data itself is broken.
  routeToNode(unit, nodeId, finish = [], phase = 'travel') {
    const legs = [];
    let from = { x: unit.x, y: unit.y };
    const inside = WORLD.zones.find(zone => pointInPolygon(unit.x, unit.y, zone.footprint));
    if (inside) {
      legs.push({ x: inside.entrance.x, y: inside.entrance.y, phase: 'leave' });
      from = inside.entrance;
    }
    const route = findWorldRoute(from.x, from.y, nodeId, this.placedZoneIds);
    if (!route) {
      console.warn(`No route to ${nodeId}; sending ${unit.name} to the gate`);
      unit.setPath([{ ...gatePosition(WORLD.safeNodes.gate), phase: 'travel' }]);
      return false;
    }
    legs.push(...route.map(p => ({ x: p.x, y: p.y, phase })));
    legs.push(...finish);
    unit.setPath(legs);
    return true;
  }

  // Reserve a slot, walk to the entrance, then step in to the slot. A full
  // facility puts the unit in its queue instead. An unbuilt site (recruits
  // or sleepers heading for a Barracks plot) just gets its entrance.
  routeToBuilding(unit, building) {
    const zone = buildingZone(building);
    const door = { x: zone.entrance.x, y: zone.entrance.y, phase: 'approach' };
    if (!building.isBuilt) {
      this.routeToNode(unit, doorNodeId(zone.id), [], 'approach');
      return;
    }
    const slot = this.reserveSlot(unit, building);
    if (slot) {
      const enter = { x: slot.x, y: slot.y, phase: 'enter' };
      // Already inside this clearing (e.g. reloaded mid-activity): step straight over.
      if (pointInPolygon(unit.x, unit.y, zone.footprint)) unit.setPath([enter]);
      else this.routeToNode(unit, doorNodeId(zone.id), [door, enter], 'approach');
      return;
    }
    const queue = this.queues.get(building.id) || [];
    queue.push(unit.id);
    this.queues.set(building.id, queue);
    unit.queuedFor = building.id;
    this.logActivity(unit, 'queue', { buildingId: building.id, position: queue.length });
    this.routeToNode(unit, zone.accessNode, [{ ...this.queuePosition(building, queue.length - 1), phase: 'queue' }], 'approach');
  }

  // Straight to a building's entrance with no slot — the recruit's walk to
  // the Barracks, where the uniform goes on.
  routeToDoor(unit, building) {
    this.routeToNode(unit, doorNodeId(building.zoneId), [], 'approach');
  }

  // Idle wander: a random point along the trunk trail inside the fence, so
  // units stay on paths even when they have nowhere in particular to be.
  routeToRandomRoadPoint(unit) {
    const edges = worldEdgeList(new Set()).filter(e => e.from !== 'gate_outside' && e.from !== 'gate');
    const edge = pick(edges);
    const walk = edgePrefix(edge, randRange(0.1, 0.9)).map(p => ({ ...p, phase: 'travel' }));
    if (this.routeToNode(unit, edge.from)) unit.path.push(...walk);
  }

  // Recovering soldiers wait together near the aid station.
  routeToAidStation(unit) {
    const index = this.units.filter(u => u.status === UNIT_STATUS.HOSPITAL).indexOf(unit);
    const angle = index * 2.4;
    const node = worldNodePosition(WORLD.safeNodes.hospital);
    this.routeToNode(unit, WORLD.safeNodes.hospital,
      [{ x: node.x + Math.cos(angle) * 22, y: node.y + Math.sin(angle) * 14, phase: 'travel' }]);
  }

  // Single place that maps "what is this unit's status" to "where should it
  // be walking" — used both on a live status change (transitionUnit) and
  // whenever a unit needs a fresh route without a status change of its own
  // (recruiting, loading a save, waking up from the hospital). Always drops
  // any slot/queue place first.
  routeForStatus(unit) {
    this.releaseSlot(unit, 'status');
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
    } else if (unit.status === UNIT_STATUS.SLEEPING) {
      this.routeToBuilding(unit, this.barracks);
    } else if (unit.status === UNIT_STATUS.RECRUITING) {
      this.routeToDoor(unit, this.barracks);
    } else if (unit.status === UNIT_STATUS.HOSPITAL) {
      this.routeToAidStation(unit);
    } else if (unit.status === UNIT_STATUS.ON_MISSION) {
      // Away (async/black-box, see mission.js) — dispatchMission() handles
      // the walk out; nothing to route on load.
    } else {
      this.routeToRandomRoadPoint(unit);
    }
  }

  // The one way into hospital, so the slot is always released first.
  hospitalize(unit, nowMs, reason) {
    unit.sendToHospital(nowMs);
    unit.departing = false;
    this.logActivity(unit, 'hospital', { reason });
    this.routeForStatus(unit);
  }

  // Compact view of who is where, for rendering and debugging.
  activitySnapshot() {
    return {
      units: this.units.map(u => ({
        unitId: u.id, status: u.status, phase: u.routePhase,
        buildingId: u.slot ? u.slot.buildingId : null, slotId: u.slot ? u.slot.slotId : null,
        activity: u.slot ? u.slot.activity : null, queuedFor: u.queuedFor,
      })),
      queues: Object.fromEntries([...this.queues].filter(([, q]) => q.length)),
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
    building.constructedAt = Date.now(); // runtime only: drives the build animation
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
    building.constructedAt = Date.now(); // runtime only: drives the build animation
    this.admitFromQueue(building); // a training upgrade opens more slots
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
    civ.setPath([{ x: gate.x, y: gate.y, phase: 'approach' }]);
    this.units.push(civ);
  }

  recruit(unitId) {
    const unit = this.units.find(u => u.id === unitId);
    if (!unit || !unit.isCivilian) return false;
    if (this.soldierCount >= this.unitCap) return false;
    const cost = 50;
    if (this.cash < cost) return false;
    this.cash -= cost;
    unit.checkpointUntil = null;
    unit.recruit();
    this.logActivity(unit, 'recruited');
    this.routeForStatus(unit); // frees their chair; RECRUITING -> walks to the Barracks, see tick()
    return true;
  }

  removeUnit(unitId) {
    const unit = this.units.find(u => u.id === unitId);
    if (unit) this.releaseSlot(unit, 'removed');
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
      this.releaseSlot(unit, 'mission');
      unit.status = UNIT_STATUS.ON_MISSION;
      unit.missionReturnAt = returnAt;
      unit.missionTierId = tier.id;
      // Presentation only: walk out through the gate, then disappear until
      // the real-time return. Not saved — a reload mid-walk just hides them.
      unit.departing = true;
      this.routeToNode(unit, 'gate_outside', [], 'depart');
      this.logActivity(unit, 'depart', { tierId: tier.id });
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
      // Walk back in through the gate — the only way in or out.
      unit.departing = false;
      const gate = gatePosition('gate_outside');
      unit.x = gate.x;
      unit.y = gate.y;
      unit.status = UNIT_STATUS.IDLE;
      this.routeForStatus(unit);
    } else {
      // Same 23h real-time hospital stay as any other failure in this game
      // — no permadeath, mission failure isn't treated as worse than
      // neglect death. See CLAUDE.md.
      this.hospitalize(unit, returnedAt, 'mission');
    }
  }

  // Advance simulation by dtSeconds. Used both for the live game loop
  // (small dt, every frame) and for offline catch-up (bounded steps).
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
        this.notePhase(unit);
        continue;
      }

      if (unit.status === UNIT_STATUS.HOSPITAL) {
        unit.step(dtSeconds); // walking to the aid station; presentation only
        if (unit.isRecovered(nowMs)) {
          unit.status = UNIT_STATUS.IDLE;
          this.routeForStatus(unit); // bypasses transitionUnit, so route explicitly here
        }
        this.notePhase(unit);
        continue;
      }

      if (unit.status === UNIT_STATUS.ON_MISSION) {
        // Walk out of the gate first (presentation only), then gone.
        if (unit.departing && unit.step(dtSeconds)) unit.departing = false;
        // Real-time, like the hospital timer — not derived from the
        // compressed game clock. Excluded from energy/training entirely
        // while away (async/black-box mission, see mission.js).
        if (nowMs >= unit.missionReturnAt) {
          this.resolveMissionForUnit(unit, nowMs);
        }
        this.notePhase(unit);
        continue;
      }

      if (unit.status === UNIT_STATUS.RECRUITING) {
        // Walking to the Barracks — bypasses desiredStatus() entirely so
        // nothing (energy, time of day) can redirect them mid-walk before
        // they've actually enlisted. The uniform swap is the "arrival"
        // moment at the Barracks entrance (see Unit.isAtTarget()'s path check).
        unit.step(dtSeconds);
        unit.applyEnergyDelta(gameHours, foodAvailable);
        if (unit.energy <= 0) {
          this.hospitalize(unit, nowMs, 'energy');
        } else if (unit.isAtTarget()) {
          unit.outfit = 'uniform';
          unit.status = UNIT_STATUS.IDLE;
          this.logActivity(unit, 'uniform', { buildingId: this.barracks.id });
          this.routeForStatus(unit);
        }
        this.notePhase(unit);
        continue;
      }

      // Decide + apply transition if the desired status differs from current
      const desired = unit.desiredStatus(this.hourOfDay);
      if (desired !== unit.status) this.transitionUnit(unit, desired);

      unit.step(dtSeconds);

      // Effects start only once the unit stands on its reserved slot at a
      // built facility — the same condition render.js uses to draw activity.
      const eating = unit.status === UNIT_STATUS.EATING && this.isUsingFacility(unit, this.messHall);
      unit.applyEnergyDelta(gameHours, eating && foodAvailable);
      unit.applyHygieneDelta(gameHours, this.isUsingFacility(unit, this.showers));
      unit.applyMoraleDelta(gameHours, this.isUsingFacility(unit, this.recRoom));
      if (eating && foodAvailable) {
        foodConsumedThisTick += FOOD_CONSUMED_PER_GAME_HOUR * gameHours;
      }
      if (unit.status === UNIT_STATUS.TRAINING) {
        const building = this.buildingById(unit.assignedBuildingId);
        if (this.isUsingFacility(unit, building)) unit.applyTrainingGain(gameHours, building.trains);
      }

      if (unit.energy <= 0) {
        this.hospitalize(unit, nowMs, 'energy');
      }
      this.notePhase(unit);
    }

    this.food = Math.max(0, this.food - foodConsumedThisTick);

    if (toRemove.size > 0) {
      for (const unit of this.units) if (toRemove.has(unit.id)) this.releaseSlot(unit, 'removed');
      this.units = this.units.filter(u => !toRemove.has(u.id));
    }
  }

  // Logs route-phase changes (approach -> enter -> using, queue, leave...)
  // and turns a unit to face its station when it starts using a slot.
  notePhase(unit) {
    const phase = unit.routePhase;
    if (phase === unit.lastPhase) return;
    if (phase === 'using') unit.facing = unit.slot.facing;
    this.logActivity(unit, 'phase', { from: unit.lastPhase || null, to: phase,
      buildingId: unit.slot ? unit.slot.buildingId : unit.queuedFor, slotId: unit.slot ? unit.slot.slotId : null });
    unit.lastPhase = phase;
  }

  // Moves a unit into a new status and routes it to wherever that status
  // happens (Mess Hall, Shooting Range, Barracks for sleep, or a random
  // road point) — see routeForStatus() above.
  transitionUnit(unit, desired) {
    unit.status = desired;
    this.routeForStatus(unit);
  }

  // Every visitor's walk is funneled through the single gate (there's no
  // other opening in the fence): outside -> gate checkpoint (a short pause
  // to be checked in) -> path to a reserved Entrance Hall chair -> after the
  // timeout, back along the path -> outside -> despawn.
  tickCivilian(unit, dtSeconds, nowMs, toRemove) {
    const reached = unit.step(dtSeconds);
    if (unit.status === UNIT_STATUS.CIVILIAN_APPROACHING) {
      if (!unit.enteredGate) {
        if (unit.checkpointUntil !== null) {
          if (nowMs < unit.checkpointUntil) return;
          unit.checkpointUntil = null;
          unit.enteredGate = true;
          const chair = this.reserveSlot(unit, this.entranceHall);
          if (chair) {
            const door = buildingDoor(this.entranceHall);
            this.logActivity(unit, 'admitted', { slotId: chair.slotId });
            this.routeToNode(unit, WORLD.safeNodes.waiting,
              [{ ...door, phase: 'approach' }, { x: chair.x, y: chair.y, phase: 'enter' }], 'approach');
          } else {
            // Every chair taken by another visitor still mid-walk — wait
            // just inside the gate rather than crossing the base with
            // nowhere to actually sit (spawnCivilianIfRoom keeps this rare,
            // not impossible).
            this.logActivity(unit, 'admitted', { slotId: null });
            this.routeToNode(unit, WORLD.safeNodes.gate);
          }
        } else if (reached) {
          unit.checkpointUntil = nowMs + CIVILIAN_CHECKPOINT_MS;
          unit.facing = 'right';
          this.logActivity(unit, 'checkpoint');
        }
        return;
      }
      const waited = nowMs - unit.spawnedAt;
      if (waited > CIVILIAN_WALK_TIMEOUT_MS && reached) {
        this.releaseSlot(unit, 'gave_up');
        unit.status = UNIT_STATUS.CIVILIAN_LEAVING;
        this.routeToNode(unit, 'gate_outside', [], 'leave_base');
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

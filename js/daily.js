// daily.js — brief 09 runtime, as GameState methods (loaded after state.js):
//   1. perimeter admission: applicants queue and are served OUTSIDE the
//      barrier; only admitted recruits cross (WORLD.perimeter)
//   2. the daily routine: every soldier follows ROUTINE_TIMETABLE
//      (routine.js) through travel -> queued -> approach -> use -> exit at
//      real stations, or waits at a parade-ground spot with a reason —
//      never a random wander
//   3. stations, FIFO queues, bed ownership, meal tokens
//   4. per-window records and the daily summary
//
// Movement still uses Unit.setPath/step along the authored path graph.
// Presentation (render.js) reads unit.routine and unit.slot; it never
// grants food or stats. Every effect below happens only in `use`.

const APPLICANT_PATIENCE_MS = 3 * 60 * 1000; // real ms an applicant waits at the window before leaving
const ROUTINE_REPLAN_MINUTES = 10;          // waiting soldiers re-check for a free station this often
const EXHAUSTED_RECOVERED = 50;             // an exhausted soldier rests in bed until this energy

// Readable reasons, shared by the soldier card, trace and day summary.
const ROUTINE_REASONS = {
  queue: 'waiting for a free place',
  stations_full: 'every place was taken',
  no_station: 'no facility built for it',
  no_food: 'no food in stock',
  seats_full: 'no free dining seat',
  no_bed: 'no bed (bedroll on the parade ground)',
  window_end: 'ran out of time',
  done: 'finished early',
  exhausted: 'exhausted — resting in bed',
  mission: 'away on a mission',
  recovery: 'recovering at the aid station',
  queue_overflow: 'the queue was full',
  last_call: 'the kitchen had stopped serving for this meal',
};

// The serving counter stops calling people this close to a meal window's
// end: a tray collected later could not be eaten before the grace runs out,
// and the food would be wasted (found in the six-soldier trace).
const LAST_SERVING_MINUTES = 15;

// Which facility a station step uses.
const STEP_FACILITY = { toilet: 'showers', basin: 'showers', shower: 'showers', counter: 'messHall', seat: 'messHall', bench: 'recRoom' };

function freshRoutine() {
  return { window: null, task: null, step: null, stage: 'idle', stationId: null, progress: 0, reason: null,
    meal: null, pendingWindow: null, graceEnd: null, log: {}, nextPlanAt: 0, queueIndex: null, carrying: false };
}

// Small deterministic hash for tie-breaks (no per-tick random rerouting).
function routineHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

Object.assign(GameState.prototype, {

  // --- time --------------------------------------------------------------------

  // Absolute game minute: whole days since the base opened plus today's clock.
  absMinute() {
    return this.day * DAY_MINUTES + this.gameClockMs / 60000;
  },

  currentWindow() {
    return routineWindowAt(this.absMinute());
  },

  // --- station geometry ------------------------------------------------------

  // The art anchor of a zone (Gate 0 contract): footprint centre x, bottom − 6.
  zoneAnchor(zone) {
    const bounds = polygonBounds(zone.footprint);
    return { x: polygonCentroid(zone.footprint).x, y: bounds.maxY - 6 };
  },

  // Largest uniform scale (≤ 1) at which a facility's authored station
  // geometry fits inside a zone's footprint. 1 on every default site; an
  // older save that built a facility on a smaller site gets a compressed
  // layout rather than people standing outside the walls.
  stationFitScale(type, zone) {
    this.fitCache ||= new Map();
    const key = `${type}:${zone.id}`;
    if (this.fitCache.has(key)) return this.fitCache.get(key);
    const geometry = STATION_GEOMETRY[type];
    let fit = 1;
    if (geometry) {
      const points = [];
      for (const value of Object.values(geometry)) {
        if (!Array.isArray(value)) continue;
        if (typeof value[0] === 'number') { if (value !== geometry.bedSize && value !== geometry.stallSize) points.push(value); continue; }
        for (const s of value) for (const k of ['use', 'approach', 'contact', 'head', 'feet']) if (s[k]) points.push(s[k]);
      }
      const anchor = this.zoneAnchor(zone);
      const fits = s => points.every(([dx, dy]) => {
        const x = anchor.x + dx * s, y = anchor.y + dy * s;
        return pointInPolygon(x, y, zone.footprint) && pointPolygonDistance(x, y, zone.footprint.map(p => p)) >= 0;
      });
      fit = 0.6;
      for (let s = 1; s >= 0.6 - 1e-9; s -= 0.05) if (fits(s)) { fit = Math.round(s * 100) / 100; break; }
    }
    this.fitCache.set(key, fit);
    return fit;
  },

  // Every usable station of a built facility at its current level, in world
  // coordinates. Training facilities, the rec room and the old reception
  // keep the slots registered on their art/zone (facilitySlots): one station
  // per slot, capacity-limited as before. Cached per level and site.
  stationsOf(building) {
    if (!building || !building.isBuilt) return [];
    this.stationCache ||= new Map();
    const key = `${building.id}:${building.level}:${building.zoneId}`;
    if (this.stationCache.has(key)) return this.stationCache.get(key);
    const zone = buildingZone(building);
    const list = [];
    const counts = FACILITY_STATIONS[building.type];
    if (counts) {
      const geometry = STATION_GEOMETRY[building.type] || {};
      const anchor = this.zoneAnchor(zone), s = this.stationFitScale(building.type, zone);
      const at = offset => offset ? { x: anchor.x + offset[0] * s, y: anchor.y + offset[1] * s } : null;
      const inside = at(geometry.inside), aisle = at(geometry.aisle);
      for (const [type, perLevel] of Object.entries(counts)) {
        const count = perLevel[Math.min(building.level, perLevel.length - 1)] || 0;
        const shapes = geometry[type] || [];
        for (let i = 0; i < Math.min(count, shapes.length); i++) {
          const shape = shapes[i];
          const use = shape.world ? { x: shape.world.x, y: shape.world.y } : at(shape.use);
          const rule = STATION_RULES[type];
          list.push({
            id: `${building.id}:${type}_${i + 1}`, buildingId: building.id, type, group: QUEUE_GROUP_OF[type] || type,
            activity: rule.activity, x: use.x, y: use.y, facing: shape.facing,
            approach: shape.world ? { ...use } : at(shape.approach), inside, aisle,
            contact: shape.world ? { x: use.x, y: use.y - 12 } : at(shape.contact),
            head: at(shape.head), feet: at(shape.feet), stall: at(shape.stall), cook: at(shape.cook), index: i,
          });
        }
      }
    } else if (SLOT_STATION_TYPES[building.type]) {
      const type = SLOT_STATION_TYPES[building.type];
      const slots = this.facilitySlots(building, 0);
      // The rec room has no capacity field; it offers its zone's slots.
      slots.forEach((slot, i) => list.push({
        id: `${building.id}:${slot.slotId}`, buildingId: building.id, type, group: QUEUE_GROUP_OF[type] || type,
        activity: slot.activity || STATION_RULES[type].activity, x: slot.x, y: slot.y, facing: slot.facing,
        approach: { x: slot.x, y: slot.y }, inside: null, aisle: null, contact: null, index: i,
      }));
    }
    for (const station of list) station.slotId = station.id; // render/animation read unit.slot.slotId
    this.stationCache.set(key, list);
    return list;
  },

  stationById(id) {
    if (!id) return null;
    const building = this.buildingByAnyId(id.split(':')[0]);
    return this.stationsOf(building).find(s => s.id === id) || null;
  },

  // Where the n-th person in a facility's queue group stands: along the
  // facility's front from its entrance, one row per group, validated
  // against water, rock, sites and the other rows so people never stand in
  // the river or on another queue.
  queueSpots(building, group) {
    this.queueSpotCache ||= new Map();
    const key = `${building.id}:${group}:${building.zoneId}:${building.level}`;
    if (this.queueSpotCache.has(key)) return this.queueSpotCache.get(key);
    const spots = [];
    {
      const zone = buildingZone(building);
      // Only real queue groups (seats and beds are reserved, never queued for).
      const groups = [...new Set(this.stationsOf(building).map(s => s.group))].filter(g => Object.values(QUEUE_GROUP_OF).includes(g));
      const row = Math.max(0, groups.indexOf(group));
      const preferred = row % 2 === 0 ? 1 : -1, dy = 10 + Math.floor(row / 2) * 22;
      const taken = groups.slice(0, row).flatMap(g => this.queueSpots(building, g));
      const line = dir => {
        const out = [];
        for (let i = 0; i < 8; i++) {
          const x = zone.entrance.x + dir * (24 + 22 * i), y = zone.entrance.y + dy;
          const blocked = WORLD.terrain.some(a => pointPolygonDistance(x, y, a.polygon) < 8)
            || WORLD.zones.some(z => pointPolygonDistance(x, y, z.footprint) < 4)
            || WORLD.muster.spots.some(p => Math.hypot(p.x - x, p.y - y) < 18)
            || taken.some(p => Math.hypot(p.x - x, p.y - y) < 16);
          if (blocked) break;
          out.push({ x, y });
        }
        return out;
      };
      // The preferred side unless the other one fits a longer line.
      const first = line(preferred), other = first.length >= 6 ? [] : line(-preferred);
      spots.push(...(other.length > first.length ? other : first));
    }
    this.queueSpotCache.set(key, spots);
    return spots;
  },

  groupKey(buildingId, group) { return `${buildingId}:${group}`; },

  // --- applicants: perimeter admission (WORLD.perimeter) ------------------------

  applicantSpot(index) {
    const { service, queue } = WORLD.perimeter;
    return index === 0 ? service : queue[index - 1] || queue[queue.length - 1];
  },

  // Walk an applicant to their place in the outside line: along the road,
  // then up onto the verge (or straight along the verge when moving up).
  routeApplicant(unit, index) {
    const spot = this.applicantSpot(index);
    const onRoad = Math.abs(unit.y - WORLD.perimeter.roadY) < 6;
    unit.applicantIndex = index;
    unit.setPath(onRoad ? [{ x: spot.x, y: WORLD.perimeter.roadY, phase: 'approach' }, { x: spot.x, y: spot.y, phase: index ? 'queue' : 'approach' }]
      : [{ x: spot.x, y: spot.y, phase: index ? 'queue' : 'approach' }]);
  },

  shiftApplicantLine() {
    this.applicantLine = this.applicantLine.filter(id => this.units.some(u => u.id === id));
    this.applicantLine.forEach((id, index) => {
      const unit = this.units.find(u => u.id === id);
      if (unit.applicantIndex !== index) {
        if (index === 0) unit.serviceSince = null;
        this.routeApplicant(unit, index);
      }
    });
  },

  // The applicant at the window, standing there, ready to be interviewed.
  applicantAtWindow() {
    const unit = this.units.find(u => u.id === this.applicantLine[0]);
    return unit && unit.serviceSince !== null && unit.serviceSince !== undefined ? unit : null;
  },

  applicantPosition(unit) {
    const index = this.applicantLine.indexOf(unit.id);
    return index;
  },

  // Sends an applicant back down the road (rejected, gave up, or no room).
  turnAwayApplicant(unit, reason) {
    if (!unit || !unit.isCivilian || unit.status !== UNIT_STATUS.CIVILIAN_APPROACHING) return false;
    this.applicantLine = this.applicantLine.filter(id => id !== unit.id);
    unit.status = UNIT_STATUS.CIVILIAN_LEAVING;
    unit.serviceSince = null;
    const road = WORLD.perimeter.roadY, west = worldNodePosition('road_west');
    unit.setPath([{ x: unit.x, y: road, phase: 'leave_base' }, { x: west.x, y: road, phase: 'leave_base' }]);
    this.logActivity(unit, 'turned_away', { reason });
    this.shiftApplicantLine();
    return true;
  },

  rejectApplicant(unitId) {
    const unit = this.units.find(u => u.id === unitId);
    return this.turnAwayApplicant(unit, 'rejected');
  },

  tickApplicant(unit, dtSeconds, nowMs, toRemove) {
    const reached = unit.step(dtSeconds);
    if (unit.status === UNIT_STATUS.CIVILIAN_APPROACHING) {
      const index = this.applicantLine.indexOf(unit.id);
      if (index === 0 && reached && unit.serviceSince == null) {
        unit.serviceSince = nowMs;
        unit.facing = WORLD.perimeter.service.facing;
        this.logActivity(unit, 'at_window');
      } else if (index > 0 && reached) {
        unit.facing = 'right';
      }
      // The first visitor of a guided first session waits as long as it takes.
      const patient = this.guidanceActive && !this.chapter.firstSoldierId;
      if (index === 0 && unit.serviceSince != null && !patient && nowMs - unit.serviceSince > APPLICANT_PATIENCE_MS) {
        this.turnAwayApplicant(unit, 'gave_up');
      }
    } else if (unit.status === UNIT_STATUS.CIVILIAN_LEAVING) {
      if (reached) toRemove.add(unit.id); // back down the road, gone
    }
  },

  // --- soldiers: windows -------------------------------------------------------

  // Called once per tick for every soldier who is on base and enlisted.
  tickRoutine(unit, dtSeconds, gameMinutes, nowMs) {
    unit.routine ||= freshRoutine();
    const r = unit.routine;
    const win = this.currentWindow();
    if (r.window !== win.id && r.pendingWindow !== win.id) this.windowBoundary(unit, win);
    unit.step(dtSeconds);
    this.advanceRoutine(unit, gameMinutes, nowMs);
    this.applyRoutineNeeds(unit, gameMinutes);
    if (unit.energy <= 0) this.collapse(unit, nowMs);
  },

  // A new window starts: a started short service may finish inside the
  // grace; anything else stops, releases its place, and the window's result
  // is recorded exactly once.
  windowBoundary(unit, win) {
    const r = unit.routine;
    if (r.window === null) { this.beginWindow(unit, win); return; }
    const station = this.stationById(r.stationId);
    const rule = station && STATION_RULES[station.type];
    if (r.stage === 'use' && rule && rule.grace) {
      r.pendingWindow = win.id;
      r.graceEnd = win.startAbs + BOUNDARY_GRACE_MINUTES;
      this.logActivity(unit, 'grace', { window: r.window, station: station.id });
      return;
    }
    if (r.stage === 'use' && rule && rule.minutes) this.finishUse(unit, station, true);
    this.closeWindow(unit);
    this.beginWindow(unit, win);
  },

  beginWindow(unit, win) {
    const r = unit.routine;
    this.releaseRoutine(unit, 'window_end');
    r.window = win.id;
    r.task = win.block.task;
    r.log = {};
    r.pendingWindow = null;
    r.graceEnd = null;
    r.reason = null;
    if (r.meal && r.meal.window !== win.id) r.meal = null; // a tray never carries into the next meal
    unit.status = win.block.status;
    this.logActivity(unit, 'window', { window: win.id, task: r.task });
    this.planNext(unit);
  },

  // Records the window the soldier is leaving, once (routineRecords is the
  // single place results live; a second close of the same window is ignored).
  closeWindow(unit, override = null) {
    const r = unit.routine;
    if (!r || !r.window) return;
    const [dayText, blockId] = r.window.split(':');
    const block = routineBlockById(blockId);
    if (!block || block.task === 'free') return;
    const record = this.routineRecords[r.window] ||= { day: Number(dayText), blockId, units: {} };
    if (record.units[unit.id]) return;
    let entry;
    if (override) entry = override;
    else {
      const log = r.log;
      const reason = r.reason && r.reason !== 'done' ? r.reason : 'window_end';
      switch (block.task) {
        case 'sleep': entry = log.slept ? { result: log.bedroll ? 'partial' : 'completed', reason: log.bedroll ? 'no_bed' : null, minutes: Math.round(log.slept) }
          : { result: 'missed', reason }; break;
        // The toilet is the task; the basin is 'if time permits' (brief 09).
        case 'bathroom': entry = log.toilet ? { result: 'completed', reason: null, toilet: log.toilet, basin: log.basin || null }
          : { result: 'missed', reason, basin: log.basin || null }; break;
        case 'meal': entry = log.meal ? { result: log.meal === 'done' ? 'completed' : 'partial', reason: log.meal === 'done' ? null : 'window_end' }
          : { result: 'missed', reason }; break;
        case 'training': entry = { result: log.trained > 0 ? 'completed' : 'missed', reason: log.trained > 0 ? null : reason, minutes: Math.round(log.trained || 0),
          scheduled: (block.end - block.start) }; break;
        case 'recreation': entry = log.bouts ? { result: 'completed', bouts: log.bouts } : { result: 'missed', reason }; break;
        case 'shower': entry = log.shower ? { result: log.shower === 'done' ? 'completed' : 'partial', reason: log.shower === 'done' ? null : 'window_end' }
          : { result: 'missed', reason }; break;
        default: return;
      }
    }
    record.units[unit.id] = entry;
    this.logActivity(unit, entry.result === 'excluded' ? 'excluded' : entry.result, { window: r.window, reason: entry.reason || null });
    this.pruneRoutineRecords();
  },

  pruneRoutineRecords() {
    const keep = this.day - 2;
    for (const [id, record] of Object.entries(this.routineRecords)) if (record.day < keep) delete this.routineRecords[id];
  },

  // --- soldiers: planning ------------------------------------------------------

  minutesLeft(unit) {
    const win = routineWindowAt(this.absMinute());
    return win.id === unit.routine.window ? win.endAbs - this.absMinute() : 0;
  },

  // Decides the soldier's next step inside the current window and sends
  // them toward it. Always ends with a destination: a station, a queue
  // place, or a parade-ground spot with a reason.
  planNext(unit) {
    const r = unit.routine, log = r.log, left = this.minutesLeft(unit);
    r.nextPlanAt = this.absMinute() + ROUTINE_REPLAN_MINUTES;
    const exhausted = unit.energy <= ENERGY_CRITICAL || (r.step === 'rest' && unit.energy < EXHAUSTED_RECOVERED);
    if (exhausted && ['training', 'recreation', 'free'].includes(r.task)) return this.goToBed(unit, 'rest');
    switch (r.task) {
      case 'sleep': return this.goToBed(unit, 'bed');
      case 'bathroom':
        if (!log.toilet) return this.goToStation(unit, 'toilet');
        if (!log.basin && left >= STATION_RULES.basin.minutes) return this.goToStation(unit, 'basin');
        if (!log.basin) log.basinReason = 'window_end';
        return this.standBy(unit);
      case 'meal':
        if (log.meal) return this.standBy(unit);
        if (r.meal && r.meal.charged && !r.meal.eaten) return this.goToSeat(unit);
        return this.goToStation(unit, 'counter');
      case 'training':
        if (left < 10) return this.standBy(unit);
        return this.goToTraining(unit);
      case 'recreation':
        if (left < 10) return this.standBy(unit);
        return this.goToStation(unit, 'bench');
      case 'shower':
        if (!log.shower) return this.goToStation(unit, 'shower');
        return this.standBy(unit);
      case 'free': return this.goToBed(unit, 'bedside');
      default: return this.standBy(unit);
    }
  },

  // Re-plan soldiers who are waiting without a place (no station, done,
  // queue overflow) every few game minutes, so building something mid-block
  // is picked up. Queued soldiers are moved by serviceQueues instead.
  maybeReplan(unit) {
    const r = unit.routine;
    if ((r.stage === 'waiting' || r.stage === 'standby') && this.absMinute() >= r.nextPlanAt) {
      if (r.stage === 'standby' && r.reason === 'done') { r.nextPlanAt = this.absMinute() + ROUTINE_REPLAN_MINUTES; return; }
      this.planNext(unit);
    }
  },

  // --- soldiers: destinations ----------------------------------------------------

  // Legs out of the station the soldier is standing on (station ->
  // approach -> aisle -> inside door), so nobody walks through a stall wall
  // or a table. Only when they are actually on it (the station they hold
  // or the one they just left). `staying` = moving within the same facility.
  exitLegs(unit, staying = false) {
    const station = [unit.slot, unit.exitFrom].find(s => s && Math.hypot(s.x - unit.x, s.y - unit.y) < 2);
    if (!station) return [];
    const legs = [];
    if (station.approach && Math.hypot(station.approach.x - unit.x, station.approach.y - unit.y) > 1) legs.push({ ...station.approach, phase: 'exit' });
    if (station.aisle) legs.push({ ...station.aisle, phase: 'exit' });
    if (station.inside && !staying) legs.push({ ...station.inside, phase: 'exit' });
    return legs;
  },

  // Route: optional prefix legs, then the path graph to nodeId, then finish
  // legs. Like routeToNode, a start inside a zone first walks out through
  // that zone's entrance.
  routeVia(unit, prefix, nodeId, finish, phase = 'travel') {
    const legs = prefix.slice();
    let from = legs.length ? legs[legs.length - 1] : { x: unit.x, y: unit.y };
    const inside = WORLD.zones.find(zone => pointInPolygon(from.x, from.y, zone.footprint));
    if (inside) { legs.push({ x: inside.entrance.x, y: inside.entrance.y, phase: 'leave' }); from = inside.entrance; }
    const route = findWorldRoute(from.x, from.y, nodeId, this.placedZoneIds);
    if (!route) {
      console.warn(`No route to ${nodeId}; sending ${unit.name} to the gate`);
      unit.setPath([{ ...gatePosition(WORLD.safeNodes.gate), phase: 'travel' }]);
      return false;
    }
    legs.push(...route.map(p => ({ x: p.x, y: p.y, phase })), ...finish);
    unit.setPath(legs);
    return true;
  },

  // Walk to points inside a facility: through its door from outside
  // (`entry` legs first, e.g. the inside-door point), or directly when
  // already inside the same facility (`entry` skipped).
  routeIntoFacility(unit, building, entry, finish) {
    const zone = buildingZone(building);
    if (pointInPolygon(unit.x, unit.y, zone.footprint)) { unit.setPath([...this.exitLegs(unit, true), ...finish]); return; }
    this.routeVia(unit, this.exitLegs(unit), doorNodeId(zone.id),
      [{ x: zone.entrance.x, y: zone.entrance.y, phase: 'approach' }, ...entry, ...finish], 'travel');
  },

  routeToStation(unit, station) {
    const building = this.buildingByAnyId(station.buildingId);
    const entry = station.inside ? [{ ...station.inside, phase: 'approach' }] : [];
    const finish = [];
    if (station.aisle) finish.push({ ...station.aisle, phase: 'approach' });
    if (station.approach && Math.hypot(station.approach.x - station.x, station.approach.y - station.y) > 0.5) finish.push({ ...station.approach, phase: 'approach' });
    finish.push({ x: station.x, y: station.y, phase: 'enter' });
    this.routeIntoFacility(unit, building, entry, finish);
  },

  reserveStation(unit, station) {
    this.stationOccupants.set(station.id, unit.id);
    unit.slot = station;
    unit.routine.stationId = station.id;
    this.logActivity(unit, 'reserve', { station: station.id });
  },

  freeStations(building, type) {
    return this.stationsOf(building).filter(s => s.type === type && !this.stationOccupants.has(s.id) && !this.seatHolders.has(s.id));
  },

  // Joins (or keeps) a place in a station group's FIFO queue and walks there.
  joinQueue(unit, building, group, reason = 'queue') {
    const key = this.groupKey(building.id, group);
    const queue = this.queues.get(key) || [];
    if (!queue.includes(unit.id)) queue.push(unit.id);
    this.queues.set(key, queue);
    const r = unit.routine;
    r.queueKey = key;
    r.reason = reason;
    unit.queuedFor = building.id;
    this.logActivity(unit, 'queue', { group: key, position: queue.indexOf(unit.id) + 1 });
    this.walkToQueueSpot(unit, building, group);
  },

  walkToQueueSpot(unit, building, group) {
    const key = this.groupKey(building.id, group);
    const queue = this.queues.get(key) || [];
    const index = queue.indexOf(unit.id);
    const spots = this.queueSpots(building, group);
    const r = unit.routine;
    r.queueIndex = index;
    if (index >= spots.length) {
      // Longer than the drawn line: wait on the parade ground, still in the queue.
      r.stage = 'travel';
      r.overflow = true;
      this.walkToMuster(unit);
      return;
    }
    r.overflow = false;
    r.stage = 'travel';
    const spot = { ...spots[index], phase: 'queue' };
    const inside = pointInPolygon(spot.x, spot.y, buildingZone(building).footprint);
    if (inside) {
      const counter = this.stationsOf(building).find(s => s.group === group);
      this.routeIntoFacility(unit, building, counter && counter.inside ? [{ ...counter.inside, phase: 'approach' }] : [], [spot]);
    } else if (this.isNearQueueLine(unit, spots) && !pointInPolygon(unit.x, unit.y, buildingZone(building).footprint)) {
      unit.setPath([spot]); // moving up the line
    } else {
      this.routeVia(unit, this.exitLegs(unit), doorNodeId(building.zoneId), [spot], 'travel');
    }
  },

  isNearQueueLine(unit, spots) {
    return spots.some(p => Math.hypot(p.x - unit.x, p.y - unit.y) < 30);
  },

  leaveQueue(unit, reason) {
    const r = unit.routine;
    if (!r || !r.queueKey) return;
    const key = r.queueKey;
    const queue = (this.queues.get(key) || []).filter(id => id !== unit.id);
    this.queues.set(key, queue);
    r.queueKey = null;
    r.queueIndex = null;
    unit.queuedFor = null;
    this.logActivity(unit, 'leave_queue', { group: key, reason });
    this.shuffleRoutineQueue(key);
  },

  shuffleRoutineQueue(key) {
    const [buildingId, group] = key.split(':');
    const building = this.buildingByAnyId(buildingId);
    (this.queues.get(key) || []).forEach((id, index) => {
      const unit = this.units.find(u => u.id === id);
      if (unit && unit.routine && unit.routine.queueIndex !== index) this.walkToQueueSpot(unit, building, group);
    });
  },

  // Go to a station of `type` (toilet, basin, shower, counter, bench): take
  // a free one only when nobody is queuing for it, otherwise join the queue.
  goToStation(unit, type) {
    const r = unit.routine;
    r.step = type;
    const building = this[STEP_FACILITY[type]];
    if (!building || !building.isBuilt || !this.stationsOf(building).some(s => s.type === type)) return this.waitAtMuster(unit, 'no_station');
    const group = QUEUE_GROUP_OF[type];
    const queue = this.queues.get(this.groupKey(building.id, group)) || [];
    const free = this.freeStations(building, type);
    if (free.length && queue.length === 0 && this.canStartService(unit, type)) {
      const station = free.reduce((best, s) => Math.hypot(s.x - unit.x, s.y - unit.y) < Math.hypot(best.x - unit.x, best.y - unit.y) - 0.5 ? s : best, free[0]);
      this.callToStation(unit, station);
      return;
    }
    this.joinQueue(unit, building, group, free.length ? this.serviceBlockReason(type, unit) : 'queue');
  },

  // Extra conditions before a service starts: serving needs food in stock
  // and a free dining seat (reserved at serving start).
  canStartService(unit, type) {
    if (type !== 'counter') return true;
    return this.minutesLeft(unit) >= LAST_SERVING_MINUTES && this.food >= ROUTINE_NEEDS.mealFood
      && this.freeStations(this.messHall, 'seat').length > 0;
  },

  serviceBlockReason(type, unit) {
    if (type !== 'counter') return 'queue';
    if (unit && this.minutesLeft(unit) < LAST_SERVING_MINUTES) return 'last_call';
    return this.food < ROUTINE_NEEDS.mealFood ? 'no_food' : 'seats_full';
  },

  // Reserve the station and walk there. Serving charges the meal here, once
  // (the token survives reloads and recalls inside the same window).
  callToStation(unit, station) {
    const r = unit.routine;
    if (r.queueKey) this.leaveQueue(unit, 'called');
    this.releaseStation(unit, 'moving');
    this.reserveStation(unit, station);
    if (station.type === 'counter') {
      const seat = this.freeStations(this.messHall, 'seat')[0];
      if (!r.meal || r.meal.window !== r.window) {
        this.food -= ROUTINE_NEEDS.mealFood;
        r.meal = { window: r.window, charged: true, eaten: false, seatId: null };
        this.logActivity(unit, 'served', { window: r.window, food: ROUTINE_NEEDS.mealFood });
      }
      r.meal.seatId = seat.id;
      this.seatHolders.set(seat.id, unit.id);
    }
    r.stage = 'travel';
    r.reason = null;
    r.progress = 0;
    this.routeToStation(unit, station);
  },

  // Walk the collected tray to the seat reserved at serving start.
  goToSeat(unit) {
    const r = unit.routine;
    r.step = 'seat';
    let seat = this.stationById(r.meal.seatId);
    const mine = seat && this.seatHolders.get(seat.id) === unit.id && [undefined, unit.id].includes(this.stationOccupants.get(seat.id));
    if (!mine) seat = this.freeStations(this.messHall, 'seat')[0] || null;
    if (!seat) return this.joinQueue(unit, this.messHall, 'counter', 'seats_full');
    this.releaseStation(unit, 'moving');
    this.seatHolders.set(seat.id, unit.id);
    r.meal.seatId = seat.id;
    this.reserveStation(unit, seat);
    r.carrying = true;
    r.stage = 'travel';
    r.progress = 0;
    this.routeToStation(unit, seat);
  },

  // Training: Auto (default), Focus on a stat, or a Specific facility
  // (the existing assignment). Prefers the facility the soldier is already
  // at (no walk), then free stations, then the shortest queue; ties break by
  // a seeded hash, never a per-tick random reroute.
  chooseTraining(unit) {
    const built = this.trainingBuildings.filter(b => b.isBuilt && this.stationsOf(b).length);
    if (!built.length) return { building: null, note: 'no_station' };
    const policy = unit.trainingPolicy || { mode: 'auto' };
    let pool = built, note = null;
    const specificId = policy.mode === 'specific' ? policy.facilityId : unit.assignedBuildingId;
    if (specificId) {
      const specific = built.find(b => b.id === specificId);
      if (specific) pool = [specific];
      else note = 'specific_missing';
    } else if (policy.mode === 'focus' && policy.stat) {
      const focused = built.filter(b => b.trains[policy.stat]);
      if (focused.length) pool = focused;
      else note = 'focus_missing';
    }
    const here = pool.find(b => pointInPolygon(unit.x, unit.y, buildingZone(b).footprint));
    const score = b => {
      const queue = (this.queues.get(this.groupKey(b.id, 'equipment')) || []).length;
      const free = this.stationsOf(b).filter(s => !this.stationOccupants.has(s.id) || this.stationOccupants.get(s.id) === unit.id).length;
      return (free > 0 ? 0 : 1 + queue) + (b === here ? -0.5 : 0) + routineHash(`${unit.id}:${b.id}:${this.day}`) * 0.1;
    };
    const building = pool.slice().sort((a, b) => score(a) - score(b))[0];
    return { building, note };
  },

  goToTraining(unit) {
    const r = unit.routine;
    r.step = 'train';
    const { building, note } = this.chooseTraining(unit);
    r.policyNote = note;
    if (!building) return this.waitAtMuster(unit, 'no_station');
    const queue = this.queues.get(this.groupKey(building.id, 'equipment')) || [];
    // Avoid the station used last bout when another one is free.
    const free = this.stationsOf(building).filter(s => !this.stationOccupants.has(s.id));
    if (free.length && queue.length === 0) {
      const fresh = free.filter(s => s.id !== unit.lastStationId);
      const pick = (fresh.length ? fresh : free).reduce((best, s) => Math.hypot(s.x - unit.x, s.y - unit.y) < Math.hypot(best.x - unit.x, best.y - unit.y) - 0.5 ? s : best);
      return this.callToStation(unit, pick);
    }
    this.joinQueue(unit, building, 'equipment');
  },

  // Sleep, bed preparation and exhausted rest all happen at the soldier's
  // own bed. No bed: a bedroll spot on the parade ground (half effect).
  goToBed(unit, step) {
    const r = unit.routine;
    r.step = step;
    const bed = this.ownBed(unit);
    if (!bed) {
      r.log.bedroll = step === 'bed';
      return this.waitAtMuster(unit, step === 'rest' ? 'exhausted' : 'no_bed', step !== 'bedside');
    }
    if (unit.slot && unit.slot.id === bed.id) {
      r.stage = this.isAtStationPoint(unit, bed, step === 'bedside') ? (step === 'bedside' ? 'standby' : 'use') : 'travel';
      return;
    }
    this.releaseStation(unit, 'moving');
    unit.slot = bed;
    r.stationId = bed.id;
    r.stage = 'travel';
    r.reason = step === 'rest' ? 'exhausted' : step === 'bedside' ? 'done' : null;
    if (step === 'bedside') {
      this.routeIntoFacility(unit, this.barracks, bed.inside ? [{ ...bed.inside, phase: 'approach' }] : [], [{ ...bed.approach, phase: 'approach' }]);
    } else {
      this.routeToStation(unit, bed);
    }
  },

  isAtStationPoint(unit, station, approach = false) {
    const p = approach ? station.approach : station;
    return unit.path.length === 0 && Math.hypot(unit.x - p.x, unit.y - p.y) < 2;
  },

  // Nothing left to do in this window: stand by on the parade ground.
  standBy(unit) {
    const r = unit.routine;
    r.step = 'standby';
    this.walkToMuster(unit);
    r.stage = 'travel';
    r.reason = r.reason && r.reason !== 'queue' ? r.reason : 'done';
    r.standby = true;
    this.noteArrival(unit); // already on their spot: standing by at once
  },

  // No usable station: wait on a parade-ground spot of their own, with a
  // reason the card and the summary can show. `sleeps` = lie on a bedroll.
  waitAtMuster(unit, reason, sleeps = false) {
    const r = unit.routine;
    r.reason = reason;
    r.standby = false;
    r.bedroll = sleeps;
    this.releaseStation(unit, 'moving');
    if (r.queueKey) this.leaveQueue(unit, 'muster');
    this.walkToMuster(unit);
    r.stage = 'travel';
    this.logActivity(unit, 'muster', { reason, window: r.window });
    this.noteArrival(unit);
  },

  walkToMuster(unit) {
    let spot = [...this.musterOccupants].find(([, id]) => id === unit.id);
    if (!spot) {
      // Keep the spot they were standing on (reload), else the first free one.
      const free = WORLD.muster.spots.filter(s => !this.musterOccupants.has(s.id));
      const kept = free.find(s => s.id === unit.savedMusterSpot || Math.hypot(s.x - unit.x, s.y - unit.y) < 2);
      const choice = kept || free[0] || WORLD.muster.spots[this.units.indexOf(unit) % WORLD.muster.spots.length];
      unit.savedMusterSpot = null;
      this.musterOccupants.set(choice.id, unit.id);
      spot = [choice.id];
    }
    const at = WORLD.muster.spots.find(s => s.id === spot[0]);
    unit.musterSpot = at.id;
    if (Math.hypot(unit.x - at.x, unit.y - at.y) < 1) { unit.setPath([]); unit.targetX = at.x; unit.targetY = at.y; return; }
    if (Math.hypot(unit.x - at.x, unit.y - at.y) < 60 && !WORLD.zones.some(z => pointInPolygon(unit.x, unit.y, z.footprint))) {
      unit.setPath([{ x: at.x, y: at.y, phase: 'travel' }]);
      return;
    }
    this.routeVia(unit, this.exitLegs(unit), WORLD.muster.node, [{ x: at.x, y: at.y, phase: 'travel' }]);
  },

  releaseMuster(unit) {
    for (const [id, holder] of this.musterOccupants) if (holder === unit.id) this.musterOccupants.delete(id);
    unit.musterSpot = null;
  },

  // --- soldiers: stage machine -------------------------------------------------

  advanceRoutine(unit, gameMinutes, nowMs) {
    const r = unit.routine;
    this.noteArrival(unit);
    if (r.stage === 'use') {
      this.useStation(unit, gameMinutes, nowMs);
      this.noteArrival(unit); // a new use can start where the last one ended (same station)
    } else this.maybeReplan(unit);
    // Grace over without finishing: the window moves on.
    if (r.pendingWindow && (r.stage !== 'use' || this.absMinute() >= r.graceEnd)) {
      if (r.stage === 'use' && unit.slot) this.finishUse(unit, unit.slot, true);
      const next = this.currentWindow();
      this.closeWindow(unit);
      r.pendingWindow = null;
      this.beginWindow(unit, next);
    }
  },

  // travel -> queued / waiting / standby / use, on reaching the end of the route.
  noteArrival(unit) {
    const r = unit.routine;
    const arrived = unit.path.length === 0 && Math.hypot(unit.x - unit.targetX, unit.y - unit.targetY) < 1;
    if (r.stage === 'travel' && arrived) {
      if (r.queueKey && !r.overflow) { r.stage = 'queued'; unit.facing = 'up'; }
      else if (r.queueKey && r.overflow) r.stage = 'queued';
      else if (unit.musterSpot && !unit.slot) {
        r.stage = r.standby ? 'standby' : 'waiting';
        unit.facing = 'down';
        if (r.bedroll) { r.stage = 'use'; this.logActivity(unit, 'use_start', { station: `muster:${unit.musterSpot}`, activity: 'sleep' }); }
      } else if (unit.slot && r.step === 'bedside') {
        r.stage = 'standby';
        unit.facing = 'down';
      } else if (unit.slot && this.isAtStationPoint(unit, unit.slot)) {
        r.stage = 'use';
        r.progress = r.progress || 0;
        unit.facing = unit.slot.facing;
        r.carrying = false; // the tray goes down on the table
        this.logActivity(unit, 'use_start', { station: unit.slot.id, activity: unit.slot.activity });
      }
    }
  },

  // Effects of being in use for gameMinutes, then completion.
  useStation(unit, gameMinutes, nowMs) {
    const r = unit.routine;
    const station = unit.slot;
    if (!station) { // bedroll on the parade ground
      if (r.bedroll) {
        unit.energy = clamp(unit.energy + STATION_RULES.bedroll.perHour.energy * gameMinutes / 60, 0, unit.maxEnergy);
        r.log.slept = (r.log.slept || 0) + gameMinutes;
      }
      return;
    }
    const rule = STATION_RULES[station.type];
    const hours = gameMinutes / 60;
    if (rule.perHour) for (const [stat, rate] of Object.entries(rule.perHour)) unit[stat] = clamp(unit[stat] + rate * hours, 0, stat === 'energy' ? unit.maxEnergy : 100);
    if (station.type === 'bed') {
      r.log.slept = (r.log.slept || 0) + gameMinutes;
      if (r.step === 'rest' && unit.energy >= EXHAUSTED_RECOVERED) { this.leaveBed(unit); this.planNext(unit); }
      return;
    }
    if (rule.training) {
      const building = this.buildingByAnyId(station.buildingId);
      unit.applyTrainingGain(hours, building.trains);
      r.log.trained = (r.log.trained || 0) + gameMinutes;
    }
    r.progress += gameMinutes;
    if (rule.minutes && r.progress >= rule.minutes) this.finishUse(unit, station, false);
  },

  leaveBed(unit) {
    this.logActivity(unit, 'use_end', { station: unit.slot && unit.slot.id, partial: false });
  },

  // One use ends (complete, or cut short at the window/grace end). Effects
  // that belong to a whole use are granted here, proportionally if partial.
  finishUse(unit, station, cutShort) {
    const r = unit.routine;
    const rule = STATION_RULES[station.type];
    const share = rule.minutes ? clamp(r.progress / rule.minutes, 0, 1) : 1;
    if (rule.effect) for (const [stat, amount] of Object.entries(rule.effect)) unit[stat] = clamp(unit[stat] + amount * share, 0, 100);
    const done = share >= 1 ? 'done' : 'partial';
    switch (station.type) {
      case 'toilet': r.log.toilet = done; break;
      case 'basin': r.log.basin = done; break;
      case 'shower': r.log.shower = done; break;
      case 'bench': r.log.bouts = (r.log.bouts || 0) + (share >= 1 ? 1 : 0); break;
      case 'seat': r.log.meal = done; if (r.meal) r.meal.eaten = true; this.seatHolders.delete(station.id); break;
      default: break;
    }
    if (rule.training) unit.lastStationId = station.id;
    this.logActivity(unit, 'use_end', { station: station.id, partial: share < 1, progress: Math.round(r.progress * 10) / 10 });
    r.progress = 0;
    if (station.type === 'counter' && !cutShort) {
      // Tray collected: carry it to the seat reserved at serving start.
      this.goToSeat(unit);
      return;
    }
    r.carrying = false;
    this.releaseStation(unit, cutShort ? 'cut_short' : 'done');
    r.stage = 'idle';
    if (!cutShort) this.planNext(unit);
  },

  // --- needs -------------------------------------------------------------------

  applyRoutineNeeds(unit, gameMinutes) {
    const hours = gameMinutes / 60, r = unit.routine;
    const using = r.stage === 'use' && unit.slot;
    const training = using && STATION_RULES[unit.slot.type].training;
    let drain = training ? ROUTINE_NEEDS.energyDrainTraining : ROUTINE_NEEDS.energyDrainAwake;
    if (using && unit.slot.type === 'bed') drain = 0;
    if (r.bedroll && r.stage === 'use') drain = 0;
    if (unit.hygiene < HYGIENE_LOW_THRESHOLD) drain *= ENERGY_DECAY_HYGIENE_PENALTY;
    unit.energy = clamp(unit.energy + drain * hours, 0, unit.maxEnergy);
    unit.hygiene = clamp(unit.hygiene + ROUTINE_NEEDS.hygieneDrain * hours, 0, 100);
    unit.morale = clamp(unit.morale + ROUTINE_NEEDS.moraleDrain * hours, 0, 100);
  },

  // --- reservations --------------------------------------------------------------

  releaseStation(unit, reason) {
    const station = unit.slot;
    if (!station) return;
    if (this.stationOccupants.get(station.id) === unit.id) {
      this.stationOccupants.delete(station.id);
      this.logActivity(unit, 'release', { station: station.id, reason });
    }
    unit.exitFrom = station; // so the next route walks out of it properly
    unit.slot = null;
    if (unit.routine) unit.routine.stationId = null;
  },

  // Frees everything a soldier holds — station, queue place, reserved seat,
  // parade-ground spot — exactly once; safe to call when they hold nothing.
  // Recall, dispatch, hospital, removal and window changes all come here.
  releaseRoutine(unit, reason) {
    const r = unit.routine;
    if (!r) return;
    if (r.queueKey) this.leaveQueue(unit, reason);
    if (unit.slot && unit.slot.type === 'bed' && r.stage === 'use') this.leaveBed(unit);
    this.releaseStation(unit, reason);
    // A reserved dining seat is released on any cancellation; the meal
    // token (food already charged) stays with the window.
    if (r.meal && r.meal.seatId && this.seatHolders.get(r.meal.seatId) === unit.id) this.seatHolders.delete(r.meal.seatId);
    this.releaseMuster(unit);
    r.stage = 'idle';
    r.step = null;
    r.carrying = false;
    r.standby = false;
    r.bedroll = false;
    r.overflow = false;
  },

  // Owners keep their bed through missions and recovery; a bed is never
  // shared. Beds are handed out in roster order.
  assignBeds() {
    const beds = this.stationsOf(this.barracks).filter(s => s.type === 'bed');
    const soldiers = this.units.filter(u => !u.isCivilian);
    const taken = new Set();
    for (const unit of soldiers) {
      if (unit.bedId && beds.some(b => b.id === unit.bedId) && !taken.has(unit.bedId)) taken.add(unit.bedId);
      else unit.bedId = null;
    }
    for (const unit of soldiers) {
      if (unit.bedId) continue;
      const bed = beds.find(b => !taken.has(b.id));
      if (bed) { unit.bedId = bed.id; taken.add(bed.id); }
    }
  },

  ownBed(unit) {
    if (!unit.bedId) this.assignBeds();
    return this.stationById(unit.bedId);
  },

  // Every queue: let the head in when a station of its type is free and
  // the service can start. Runs every tick (seats and food can change
  // without a station being released).
  serviceQueues() {
    for (const key of [...this.queues.keys()]) {
      const [buildingId, group] = key.split(':');
      const building = this.buildingByAnyId(buildingId);
      // leaveQueue replaces the array, so re-read it every pass.
      for (let guard = 0; guard < 20; guard++) {
        const queue = this.queues.get(key) || [];
        if (!queue.length) break;
        const head = this.units.find(u => u.id === queue[0]);
        if (!head || !head.routine) { queue.shift(); continue; }
        const type = group === 'equipment' ? null : head.routine.step;
        const free = this.stationsOf(building).filter(s => (type ? s.type === type : true) && !this.stationOccupants.has(s.id));
        if (!free.length) break;
        if (type === 'counter' && !this.canStartService(head, 'counter')) { head.routine.reason = this.serviceBlockReason('counter', head); break; }
        if (type === 'seat') { this.leaveQueue(head, 'called'); this.goToSeat(head); continue; }
        const fresh = free.filter(s => s.id !== head.lastStationId);
        const station = (fresh.length ? fresh : free)[0];
        this.logActivity(head, 'admitted_from_queue', { group: key, station: station.id });
        this.callToStation(head, station);
      }
    }
  },

  // --- reload ------------------------------------------------------------------------

  // Rebuilds stations, queues and seats from saved routine state, in roster
  // order (queues in their saved order), so a reload neither double-books a
  // place nor charges or feeds a meal twice. Someone saved mid-use stays on
  // their station with their progress; a queue keeps its order.
  restoreRoutines(savedUnits) {
    const saved = new Map(savedUnits.map(d => [d.id, d.routine]));
    const queued = [];
    for (const unit of this.units) {
      if (unit.isCivilian || [UNIT_STATUS.HOSPITAL, UNIT_STATUS.ON_MISSION, UNIT_STATUS.RECRUITING].includes(unit.status)) {
        unit.routine = freshRoutine();
        this.routeForStatus(unit);
        continue;
      }
      const s = saved.get(unit.id);
      unit.routine = { ...freshRoutine(), ...(s || {}), log: { ...((s && s.log) || {}) } };
      unit.savedMusterSpot = s && s.musterSpot || null;
      const r = unit.routine;
      const win = this.currentWindow();
      if (!s || !r.window) { r.window = null; this.beginWindow(unit, win); continue; }
      if (r.window !== win.id && r.pendingWindow !== win.id) {
        this.closeWindow(unit);
        r.window = null;
        this.beginWindow(unit, win);
        continue;
      }
      if (r.meal && r.meal.seatId && !r.meal.eaten) this.seatHolders.set(r.meal.seatId, unit.id);
      const station = this.stationById(r.stationId);
      if (station && !this.stationOccupants.has(station.id) && (r.stage === 'use' || r.stage === 'travel')) {
        this.stationOccupants.set(station.id, unit.id);
        unit.slot = station;
        if (r.stage === 'use' && this.isAtStationPoint(unit, station)) { unit.facing = station.facing; continue; }
        r.stage = 'travel';
        if (station.type === 'bed' && r.step === 'bedside') this.goToBed(unit, 'bedside');
        else this.routeToStation(unit, station);
        continue;
      }
      if (r.queueKey) { queued.push(unit); continue; }
      r.stationId = null;
      this.planNext(unit);
    }
    queued.sort((a, b) => (a.routine.queueIndex ?? 99) - (b.routine.queueIndex ?? 99));
    for (const unit of queued) {
      const [buildingId, group] = unit.routine.queueKey.split(':');
      unit.routine.queueKey = null;
      this.joinQueue(unit, this.buildingByAnyId(buildingId), group, unit.routine.reason || 'queue');
    }
  },

  // --- records and summary ---------------------------------------------------------

  // Plain sentences for a day's routine, one per scheduled block, plus the
  // single most useful improvement. Missions and recovery are excluded from
  // the denominators.
  dailySummary(day = this.day) {
    const lines = [];
    let advice = null, trainingAdvice = null; // missed services outrank a training shortfall
    for (const block of ROUTINE_TIMETABLE) {
      if (block.task === 'free') continue;
      const record = this.routineRecords[`${day}:${block.id}`];
      if (!record) continue;
      const entries = Object.values(record.units).filter(e => e.result !== 'excluded');
      if (!entries.length) continue;
      const total = entries.length;
      const completed = entries.filter(e => e.result === 'completed').length;
      const missed = entries.filter(e => e.result === 'missed');
      const reasons = {};
      for (const e of entries) if (e.reason && e.result !== 'completed') reasons[e.reason] = (reasons[e.reason] || 0) + 1;
      const main = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
      let text;
      if (block.task === 'training') {
        const used = entries.reduce((sum, e) => sum + (e.minutes || 0), 0), scheduled = entries.reduce((sum, e) => sum + (e.scheduled || 0), 0);
        text = `${block.label}: ${formatMinutes(used)} used / ${formatMinutes(scheduled)} scheduled`;
        if (main && !completed) text += ` — ${ROUTINE_REASONS[main[0]] || main[0]}`;
        else if (used < scheduled * 0.6) {
          text += ' — soldiers queued for equipment or walked between stations';
          trainingAdvice = 'Training stations are the limit: upgrade a training facility or build another.';
        }
      } else {
        const noun = { sleep: 'slept in a bed', bathroom: 'used the toilet', meal: 'meals', recreation: 'relaxed', shower: 'showers' }[block.task];
        text = `${block.label}: ${completed}/${total} ${noun}`;
        if (block.task === 'bathroom') text += ` (${entries.filter(e => e.basin === 'done').length} also washed)`;
        const short = total - completed;
        if (main && short > 0) text += `; ${short} ${short === 1 ? 'was' : 'were'} short — mostly because ${this.shortageText(block, main[0])}`;
      }
      const fix = main && this.capacityAdvice(block, main[0]);
      lines.push({ blockId: block.id, text, total, completed, missed: missed.length, reasons, advice: fix });
      if (!advice && fix && main[1] > 0) advice = fix;
    }
    return { day, lines, advice: advice || trainingAdvice };
  },

  shortageText(block, reason) {
    if (reason === 'queue' || reason === 'window_end' || reason === 'last_call') {
      return { bathroom: 'the toilet queue was too long', shower: 'the shower stalls were full', meal: 'the serving counter was the bottleneck',
        recreation: 'every bench was taken', sleep: 'they never reached a bed' }[block.task] || ROUTINE_REASONS[reason];
    }
    return ROUTINE_REASONS[reason] || reason;
  },

  capacityAdvice(block, reason) {
    if (reason === 'no_food') return 'Buy food: meals stopped when the stores ran out.';
    if (reason === 'no_bed') return 'Upgrade the Barracks for more beds.';
    if (reason === 'no_station') return { training: 'Build a training facility.', recreation: 'Build the Rec Room.', meal: 'Build the Mess Hall.', bathroom: 'Build the Wash Block.', shower: 'Build the Wash Block.' }[block.task] || null;
    if (['bathroom', 'shower'].includes(block.task) && !this.showers.isMaxLevel) return `Upgrade the Wash Block: level ${this.showers.level + 1} adds ${block.task === 'bathroom' ? 'a toilet stall and basin' : 'a shower stall'}.`;
    if (block.task === 'training') return 'Upgrade a training facility or build another for more stations.';
    if (block.task === 'meal' && reason === 'seats_full') return 'Dining seats are the limit (more seats come with brief 09C).';
    if (block.task === 'meal' && !this.messHall.isMaxLevel) return 'Upgrade the Mess Hall: level 2 adds a second serving counter.';
    if (block.task === 'meal') return 'Both serving counters are busy; more kitchen capacity comes with brief 09C.';
    return null;
  },

  // What one soldier is doing, as the card shows it.
  routineText(unit) {
    const r = unit.routine;
    if (!r || !r.window) return null;
    const block = routineBlockById(r.window.split(':')[1]);
    const station = unit.slot ? STATION_RULES[unit.slot.type] : null;
    const where = station ? station.label : null;
    const reason = r.reason ? ROUTINE_REASONS[r.reason] || r.reason : '';
    const next = nextRoutineBlock(block);
    switch (r.stage) {
      case 'use':
        if (r.bedroll) return `${block.label}: sleeping on a bedroll — ${ROUTINE_REASONS.no_bed}`;
        if (!unit.slot) return block.label;
        if (!unit.slot) return block.label;
        if (unit.slot.type === 'bed') return r.step === 'rest' ? 'Exhausted — resting in their bunk' : 'Asleep in their bunk';
        if (unit.slot.type === 'counter') return `${block.label}: collecting a meal at the serving counter`;
        if (unit.slot.type === 'seat') return `${block.label}: eating (${Math.round(r.progress)}/${STATION_RULES.seat.minutes} min)`;
        return `${block.label}: using the ${where} (${Math.round(r.progress)}/${STATION_RULES[unit.slot.type].minutes} min)`;
      case 'queued': {
        const queue = this.queues.get(r.queueKey) || [];
        return `${block.label}: queuing (${queue.indexOf(unit.id) + 1} of ${queue.length}) — ${reason}`;
      }
      case 'travel':
        if (r.carrying) return `${block.label}: carrying a tray to a seat`;
        if (r.queueKey) return `${block.label}: walking to the queue`;
        if (unit.slot) return `${block.label}: walking to the ${where}`;
        return `${block.label}: walking to the parade ground — ${reason}`;
      case 'waiting': return `${block.label}: waiting on the parade ground — ${reason}`;
      case 'standby':
        if (r.step === 'bedside') return `${block.label}: by their bunk, ready for lights-out`;
        return `${block.label} done — standing by for ${next.label} at ${formatGameMinute(next.start)}`;
      default: return `${block.label}`;
    }
  },

  // Today's itinerary with results so far, for the soldier card.
  itineraryFor(unit, day = this.day) {
    return ROUTINE_TIMETABLE.filter(b => b.task !== 'free').map(block => {
      const record = this.routineRecords[`${day}:${block.id}`];
      const entry = record && record.units[unit.id];
      const current = unit.routine && unit.routine.window === `${day}:${block.id}`;
      return { block, entry: entry || null, current };
    });
  },
});

function formatMinutes(total) {
  const h = Math.floor(total / 60), m = Math.round(total % 60);
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

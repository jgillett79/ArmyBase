// Run with: node tests/activity.cjs  (TRACE=1 prints the recruit-to-range
// activity trace). Scripted checks that people visibly use facilities:
// gate checkpoint -> reception chair -> recruit -> uniform at the Barracks ->
// path to a reserved range slot -> training only once there -> mission
// departure; plus slot reservation, queueing, release and reload rules.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const storage = new Map();
const sandbox = vm.createContext({
  console: { ...console, warn() {} }, Math, Date,
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
});
for (const file of ['utils', 'world', 'asset-manifest', 'unit', 'building', 'mission', 'state', 'save']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), sandbox);
}
const run = source => vm.runInContext(source, sandbox);

// Simulated real-time clock so checkpoint/timeout logic is deterministic.
run('var simNow = Date.now(); function advance(seconds, dt = 0.05) { for (let t = 0; t < seconds - 1e-9; t += dt) { simNow += dt * 1000; state.tick(dt, simNow); } }');
run('function until(predicate, limitSeconds, dt = 0.05) { for (let t = 0; t < limitSeconds; t += dt) { if (predicate()) return true; simNow += dt * 1000; state.tick(dt, simNow); } return predicate(); }');
run('function events(unit, name) { return state.activityLog.filter(e => e.unitId === unit.id && (!name || e.event === name)); }');
run('function hour(h) { state.gameClockMs = h * 3600 * 1000; }');
// Save and reload at the simulated time (no offline gap unless a test adds one).
run('function reload(edit) { state.save(); const data = JSON.parse(localStorage.getItem(SAVE_KEY)); data.lastTick = simNow; if (edit) edit(data); state = GameState.fromSaveData(data, simNow); }');

// ---------------------------------------------------------------------------
// 1. Recruit-to-range walk-through.
// ---------------------------------------------------------------------------
run(`var state = new GameState(); state.cash = 5000; state.barracks.level = 1; state.shootingRange.level = 1;
  state.lastCivilianSpawn = simNow; state.spawnCivilianIfRoom(); var visitor = state.units[0];`);
assert.equal(run('visitor.routePhase'), 'approach');

// Gate checkpoint: the visitor stops just outside the barrier and stays put for the pause.
assert.ok(run(`until(() => events(visitor, 'checkpoint').length, 20)`), 'visitor reaches the gate checkpoint');
const atGate = run('({ x: visitor.x, y: visitor.y })');
assert.ok(run(`Math.hypot(visitor.x - WORLD.checkpoint.pause.x, visitor.y - WORLD.checkpoint.pause.y) < 1`));
assert.ok(run(`visitor.x < WORLD.checkpoint.boomHinge.x`), 'the stop is outside the closed boom');
run('advance(1.5)');
assert.equal(run('visitor.routePhase'), 'checkpoint');
assert.deepEqual(run('({ x: visitor.x, y: visitor.y })'), atGate, 'no movement during the checkpoint pause');

// Admission: walks the path to a reserved reception chair and sits.
assert.ok(run(`until(() => events(visitor, 'admitted').length, 5)`));
assert.ok(run(`until(() => visitor.routePhase === 'using', 30)`), 'visitor reaches a reception chair');
assert.equal(run('visitor.slot.buildingId'), 'entrance_hall');
assert.ok(run('visitor.chairIndex !== null && pointInPolygon(visitor.x, visitor.y, buildingZone(state.entranceHall).footprint)'));

// Recruitment: chair released, walks to the Barracks, uniform at its entrance.
// (This trace covers movement, not the first-soldier chapter — tests/chapter.cjs
// covers that — so the chapter is closed and the plain Local Patrol applies.)
run('state.chapter.done = true; state.chapter.introDispatched = true;');
assert.equal(run('state.recruit(visitor.id)'), true);
assert.equal(run(`events(visitor, 'release').at(-1).buildingId`), 'entrance_hall');
assert.equal(run('visitor.outfit === "uniform"'), false, 'still in civilian clothes while walking in');
assert.ok(run(`until(() => events(visitor, 'uniform').length, 60)`), 'recruit reaches the Barracks');
assert.ok(run('Math.hypot(visitor.x - buildingDoor(state.barracks).x, visitor.y - buildingDoor(state.barracks).y) < 30'));
assert.equal(run('visitor.outfit'), 'uniform');

// Training: assign during the training block; accuracy is flat until the
// soldier stands on a range slot, then climbs.
run(`hour(9); visitor.energy = 100; state.assignToBuilding(visitor.id, 'shooting_range'); var startAccuracy = visitor.accuracy;`);
run('advance(0.05)');
assert.equal(run('visitor.status'), 'training');
assert.equal(run('visitor.slot && visitor.slot.buildingId'), 'shooting_range', 'range slot reserved before walking');
assert.ok(run(`until(() => { if (visitor.routePhase !== 'using' && visitor.accuracy !== startAccuracy) throw new Error('gain before arrival'); return visitor.routePhase === 'using'; }, 40)`),
  'soldier reaches the range slot via the path graph');
assert.ok(run('events(visitor, "phase").some(e => e.to === "enter")'), 'entered from the door to the slot');
assert.equal(run('visitor.facing'), run('visitor.slot.facing'), 'faces the targets');
run('advance(3)');
assert.ok(run('visitor.accuracy > startAccuracy'), 'training gain starts once at the slot');

// Departure: slot released, walks out of the gate, then disappears.
run('state.unassignFromTraining(visitor.id); advance(0.05)');
assert.equal(run(`state.dispatchMission('local_patrol', [visitor.id])`), true);
assert.equal(run('[...state.slotOccupants.values()].includes(visitor.id)'), false, 'no slot held while away');
assert.equal(run('visitor.departing'), true);
assert.ok(run('until(() => !visitor.departing, 60)'), 'squad walks out through the gate');
assert.ok(run(`Math.hypot(visitor.x - worldNodePosition('gate_outside').x, visitor.y - worldNodePosition('gate_outside').y) < 1`));

const trace = run(`JSON.stringify(state.activityLog.filter(e => e.unitId === visitor.id)
  .map(e => [e.event, e.to || e.slotId || e.buildingId || e.reason || e.tierId || ''].join(' ').trim()))`);
if (process.env.TRACE) console.log(JSON.parse(trace).join('\n'));

// ---------------------------------------------------------------------------
// 2. Two slots, a third queues; reassignment/hospital release; reload.
// ---------------------------------------------------------------------------
run(`state = new GameState(); state.barracks.level = 1; state.shootingRange.level = 1; hour(9);
  var gateSpot = worldNodePosition('gate_inside');
  var squad = [0, 1, 2].map(() => { const u = new Unit({ x: gateSpot.x, y: gateSpot.y, isCivilian: false });
    u.energy = 100; state.units.push(u); return u; });
  var [a, b, c] = squad;`);
assert.equal(run(`state.assignToBuilding(a.id, 'shooting_range')`), true);
assert.equal(run(`state.assignToBuilding(b.id, 'shooting_range')`), true);
assert.equal(run(`state.assignToBuilding(c.id, 'shooting_range')`), false, 'level 1 range has two places');
// Force a third onto the range (as an over-full legacy save could) to prove
// the queue path: it must wait, not overlap or train.
run(`c.assignedBuildingId = 'shooting_range'; var cAccuracy = c.accuracy;`);
assert.ok(run(`until(() => a.routePhase === 'using' && b.routePhase === 'using' && c.routePhase === 'queued', 40)`),
  'two soldiers use the range and the third queues');
assert.notEqual(run('a.slot.slotId'), run('b.slot.slotId'), 'distinct slots');
assert.ok(run('Math.hypot(a.x - b.x, a.y - b.y) > 20'), 'no visual overlap');
assert.equal(run('c.slot'), null);
assert.equal(run('c.accuracy'), run('cAccuracy'), 'queued soldier does not train');
assert.equal(run('state.activitySnapshot().queues.shooting_range.length'), 1);

// Reassignment frees a's slot; the queued soldier takes it.
run('var freed = a.slot.slotId; state.unassignFromTraining(a.id)');
assert.equal(run('c.queuedFor'), null);
assert.equal(run('c.slot && c.slot.slotId'), run('freed'), 'queued soldier admitted to the freed slot');
assert.ok(run(`until(() => c.routePhase === 'using', 20)`));

// Hospital transfer releases the slot.
run('state.hospitalize(b, simNow, "test")');
assert.equal(run('b.slot'), null);
assert.equal(run('[...state.slotOccupants.values()].includes(b.id)'), false);
assert.equal(run('b.routePhase === "using"'), false);

// An upgrade opens a slot for anyone waiting.
run(`hour(9); b.status = 'idle'; b.hospitalUntil = null; b.assignedBuildingId = 'shooting_range'; a.assignedBuildingId = 'shooting_range';
  state.transitionUnit(a, 'training'); state.transitionUnit(b, 'training');`);
assert.equal(run('state.queues.get("shooting_range").length'), 1, 'range full again: one queues');
run('state.cash = 1000; state.lumber = 10; state.upgradeBuilding("shootingRange")');
assert.equal(run('state.queues.get("shooting_range").length'), 0, 'upgrade admits the queue');

// Reload mid-activity: identities kept, no duplicate reservations.
assert.ok(run(`until(() => squad.every(u => u.routePhase === 'using'), 30)`));
run('hour(10)'); // still inside the training block when reloaded
run('var before = squad.map(u => [u.id, u.name, u.slot.slotId]); reload();');
const holders = run('[...state.slotOccupants.values()]');
assert.equal(new Set(holders).size, holders.length, 'no unit holds two slots');
assert.equal(run('state.slotOccupants.size'), 3, 'each soldier re-reserved once');
assert.deepEqual(run('state.units.map(u => [u.id, u.name])'), run('before.map(([id, name]) => [id, name])'), 'identities preserved');
assert.deepEqual(run('state.units.map(u => u.slot.slotId)'), run('before.map(x => x[2])'), 'soldiers keep the slot they stood on');
assert.ok(run(`until(() => state.units.every(u => u.routePhase === 'using'), 5)`), 'reloaded soldiers are straight back at work');

// Reload after an overdue mission: resolves once, reservations stay unique.
run(`var away = state.units[0]; state.unassignFromTraining(away.id); advance(0.05);
  state.dispatchMission('local_patrol', [away.id]);
  reload(data => { data.units.find(u => u.id === away.id).missionReturnAt = simNow - 1000; });
  state.tick(0.05, simNow);`);
assert.notEqual(run(`state.units.find(u => u.id === away.id).status`), 'on_mission');
const after = run('[...state.slotOccupants.values()]');
assert.equal(new Set(after).size, after.length, 'no double-booking after mission return');

// ---------------------------------------------------------------------------
// 3. Needs buildings never queue (unlimited capacity is a design rule).
// ---------------------------------------------------------------------------
run(`state = new GameState(); state.messHall.level = 1; state.food = 1000; hour(6.5);
  var diners = Array.from({ length: 12 }, () => { const u = new Unit({ x: gateSpot.x, y: gateSpot.y, isCivilian: false });
    state.units.push(u); return u; });
  advance(0.05);`);
assert.equal(run('diners.filter(u => u.slot && u.slot.buildingId === "mess_hall").length'), 12, 'every diner gets a spot');
assert.equal(run('state.queues.get("mess_hall")'), undefined);
assert.ok(run('diners.every(u => pointInPolygon(u.slot.x, u.slot.y, buildingZone(state.messHall).footprint))'));

console.log('Activity tests passed');

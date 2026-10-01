// Run with: node tests/activity.cjs  (TRACE=1 prints the admission-to-range
// activity trace). Scripted checks that people visibly use facilities,
// rewritten for brief 09: guardhouse window (outside) -> admission ->
// walk in civilian clothes through the gate -> uniform at the Barracks ->
// own bed -> the timetable's training block at a reserved range station,
// training only once there -> mission departure; plus station reservation,
// FIFO queueing, release, upgrades and reload rules. (Brief 02's "needs
// buildings never queue" rule is superseded: brief 09 gives the mess, wash
// block and barracks real station capacity — tests/routine.cjs.)
const assert = require('node:assert/strict');
const { loadGame } = require('./lib/sandbox.cjs');

const g = loadGame({ seed: 11 });
const run = g.run;
run('var simNow = Date.now();');
g.sandbox.__step = dt => { g.clock.now += dt * 1000; g.sandbox.state.tick(dt, g.clock.now); };
run('function advance(seconds, dt = 0.05) { for (let t = 0; t < seconds - 1e-9; t += dt) __step(dt); }');
run('function until(predicate, limitSeconds, dt = 0.05) { for (let t = 0; t < limitSeconds; t += dt) { if (predicate()) return true; __step(dt); } return predicate(); }');
run('function events(unit, name) { return state.activityLog.filter(e => e.unitId === unit.id && (!name || e.event === name)); }');
run('function hour(h) { state.gameClockMs = h * 3600 * 1000; }');
run('function reload(edit) { state.save(); const data = JSON.parse(localStorage.getItem(SAVE_KEY)); data.lastTick = Date.now(); if (edit) edit(data); state = GameState.fromSaveData(normalizeSaveData(data).data, Date.now()); }');

// ---------------------------------------------------------------------------
// 1. Admission-to-range walk-through.
// ---------------------------------------------------------------------------
run(`var state = new GameState(); state.cash = 5000; state.shootingRange.level = 1;
  state.chapter.done = true; state.chapter.introDispatched = true; state.chapter.dismissed = true;
  hour(7.2); state.spawnCivilianIfRoom(); var visitor = state.units[0];`);
assert.ok(run(`until(() => state.applicantAtWindow() === visitor, 30)`), 'the applicant walks the outside road to the guardhouse window');
assert.ok(run('visitor.x < WORLD.perimeter.barrierX'), 'served outside the barrier');
assert.equal(run('visitor.facing'), 'right', 'faces the window');
assert.equal(run('state.recruit(visitor.id)'), true);
assert.equal(run('visitor.outfit === "uniform"'), false, 'still in civilian clothes while walking in');
assert.ok(run(`until(() => events(visitor, 'uniform').length, 120)`), 'recruit reaches the Barracks');
assert.ok(run('Math.hypot(visitor.x - buildingDoor(state.barracks).x, visitor.y - buildingDoor(state.barracks).y) < 30'));
assert.equal(run('visitor.outfit'), 'uniform');
assert.ok(run('!!visitor.bedId && state.stationById(visitor.bedId).type === "bed"'), 'a bed of their own');
assert.ok(run('!!visitor.routine.window'), 'joins the current timetable window');

// Training: the 08:00 block sends them to a reserved range station;
// accuracy is flat until they stand on it, then climbs.
run(`hour(7.99); visitor.energy = 100; state.assignToBuilding(visitor.id, 'shooting_range'); var startAccuracy = visitor.accuracy;`);
assert.ok(run(`until(() => visitor.routine.task === 'training' && visitor.slot && visitor.slot.buildingId === 'shooting_range', 5)`), 'range station reserved before walking');
assert.ok(run(`until(() => { if (visitor.routine.stage !== 'use' && visitor.accuracy !== startAccuracy) throw new Error('gain before arrival'); return visitor.routine.stage === 'use'; }, 80)`),
  'soldier reaches the range station via the path graph');
assert.ok(run('events(visitor, "phase").some(e => e.to === "enter")'), 'entered from the door to the station');
assert.equal(run('visitor.facing'), run('visitor.slot.facing'), 'faces the targets');
run('advance(3)');
assert.ok(run('visitor.accuracy > startAccuracy'), 'training gain starts once at the station');

// Departure: needs a recall while training; station released; walks out of the gate.
assert.equal(run(`state.dispatchMission('local_patrol', [visitor.id])`), false, 'training needs an explicit recall');
assert.equal(run(`state.dispatchMission('local_patrol', [visitor.id], { recall: true })`), true);
assert.equal(run('[...state.stationOccupants.values()].includes(visitor.id)'), false, 'no station held while away');
assert.equal(run('visitor.departing'), true);
assert.ok(run('until(() => !visitor.departing, 90)'), 'squad walks out through the gate');
assert.ok(run(`Math.hypot(visitor.x - worldNodePosition('gate_outside').x, visitor.y - worldNodePosition('gate_outside').y) < 1`));
if (process.env.TRACE) {
  console.log(run(`state.activityLog.filter(e => e.unitId === visitor.id)
    .map(e => [formatGameMinute(e.clock / 60000), e.event, e.to || e.station || e.window || e.reason || e.tierId || ''].join(' ').trim()).join('\\n')`));
}

// ---------------------------------------------------------------------------
// 2. Two range stations, a third soldier queues; release and admission.
// ---------------------------------------------------------------------------
run(`state = new GameState(); state.shootingRange.level = 1; hour(8.5);
  state.chapter.done = true; state.chapter.introDispatched = true; state.chapter.dismissed = true;
  var p = worldNodePosition('t2');
  var squad = [0, 1, 2].map(i => { const u = new Unit({ x: p.x + i, y: p.y, isCivilian: false }); u.energy = 100; state.units.push(u); return u; });
  state.assignBeds(); squad.forEach(u => state.rejoinRoutine(u)); var [a, b, c] = squad; var cAccuracy = c.accuracy;`);
assert.ok(run(`until(() => squad.filter(u => u.routine.stage === 'use').length === 2 && squad.some(u => u.routine.stage === 'queued'), 60)`),
  'two soldiers use the range and the third queues');
run('var queued = squad.find(u => u.routine.stage === "queued"); var users = squad.filter(u => u !== queued); var qAccuracy = queued.accuracy;');
assert.notEqual(run('users[0].slot.id'), run('users[1].slot.id'), 'distinct stations');
assert.ok(run('Math.hypot(users[0].x - users[1].x, users[0].y - users[1].y) > 20'), 'no visual overlap');
assert.equal(run('queued.slot'), null);
run('advance(2)');
assert.equal(run('queued.accuracy'), run('qAccuracy'), 'a queued soldier does not train');
assert.equal(run(`state.queues.get('shooting_range:equipment').length`), 1);

// Hospital transfer releases the station; the queued soldier takes it (FIFO).
run('var freed = users[0].slot.id; state.hospitalize(users[0], Date.now(), "test")');
assert.equal(run('users[0].slot'), null);
assert.equal(run('[...state.stationOccupants.values()].includes(users[0].id)'), false);
run('state.serviceQueues()');
assert.equal(run('queued.slot && queued.slot.id'), run('freed'), 'queued soldier admitted to the freed station');
assert.ok(run(`until(() => queued.routine.stage === 'use', 20)`));

// An upgrade opens stations for anyone waiting.
run(`users[0].status = 'idle'; users[0].hospitalUntil = null; state.rejoinRoutine(users[0]);`);
assert.ok(run(`until(() => users[0].routine.stage === 'queued', 30)`), 'range full again: one queues');
run('state.cash = 1000; state.lumber = 10; state.upgradeBuilding("shootingRange"); state.serviceQueues();');
assert.equal(run(`state.queues.get('shooting_range:equipment').length`), 0, 'upgrade admits the queue');

// Reload mid-activity: identities kept, no duplicate reservations.
assert.ok(run(`until(() => squad.every(u => u.routine.stage === 'use'), 40)`));
run('var before = squad.map(u => [u.id, u.name, u.slot.id]); reload();');
const holders = run('[...state.stationOccupants.values()]');
assert.equal(new Set(holders).size, holders.length, 'no unit holds two stations');
assert.equal(run('state.stationOccupants.size'), 3, 'each soldier re-reserved once');
assert.deepEqual(run('state.units.map(u => [u.id, u.name])'), run('before.map(([id, name]) => [id, name])'), 'identities preserved');
assert.deepEqual(run('state.units.map(u => u.slot.id)'), run('before.map(x => x[2])'), 'soldiers keep the station they stood on');
assert.ok(run(`state.units.every(u => u.routine.stage === 'use')`), 'reloaded soldiers are straight back at work');

// Reload after an overdue mission: resolves once, reservations stay unique.
run(`var away = state.units[0]; state.dispatchMission('local_patrol', [away.id], { recall: true });
  reload(data => { data.units.find(u => u.id === away.id).missionReturnAt = Date.now() - 1000; });
  __step(0.05);`);
assert.notEqual(run(`state.units.find(u => u.id === away.id).status`), 'on_mission');
const after = run('[...state.stationOccupants.values()]');
assert.equal(new Set(after).size, after.length, 'no double-booking after mission return');
assert.equal(run(`state.units.find(u => u.id === away.id).routine.task`), 'training', 'the returning soldier joins the current block');

console.log('Activity tests passed');

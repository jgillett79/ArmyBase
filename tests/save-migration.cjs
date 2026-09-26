// Run with: node tests/save-migration.cjs. Loads a representative v1 save
// (active mission, hospitalized soldier, partially built base) and checks the
// v2 migration preserves progress, runs once, and survives reloads,
// export/import and corrupt data. No installed dependencies required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const storage = new Map();
const sandbox = vm.createContext({
  console: { ...console, warn() {} }, // expected warnings for the corrupt-save cases
  Math, Date,
  localStorage: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
  },
});
for (const file of ['utils', 'world', 'unit', 'building', 'mission', 'state', 'save']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), sandbox);
}
const run = source => vm.runInContext(source, sandbox);

// Re-base the fixture's timestamps on "now" so timers are still running.
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'v1-save.json'), 'utf8'));
const now = Date.now();
const shift = now - fixture.lastTick;
fixture.lastTick = now; // no offline gap, so resources compare exactly
for (const unit of fixture.units) {
  for (const key of ['hospitalUntil', 'missionReturnAt']) if (unit[key]) unit[key] += shift;
}
const v1Raw = JSON.stringify(fixture);
storage.set('armybase_save_v1', v1Raw);

const snapshot = () => JSON.parse(run('JSON.stringify(state.serialize())'));
run('var state = GameState.load()');
const migrated = snapshot();

// Resources, clock and mission history are unchanged.
for (const key of ['cash', 'food', 'lumber', 'steel', 'gems', 'gameClockMs']) {
  assert.ok(Math.abs(migrated[key] - fixture[key]) < 0.01, `${key} preserved`);
}
assert.deepEqual(migrated.missionLog, fixture.missionLog, 'mission log preserved');

// Building levels carry over and each old singleton lands on its authored zone.
const levelField = { barracks: 'barracksLevel', shooting_range: 'shootingRangeLevel', mess_hall: 'messHallLevel',
  weight_room: 'weightRoomLevel', obstacle_course: 'obstacleCourseLevel', drill_yard: 'drillYardLevel',
  showers: 'showersLevel', rec_room: 'recRoomLevel' };
for (const [id, field] of Object.entries(levelField)) {
  assert.equal(migrated.buildings[id].level, fixture[field], `${id} level preserved`);
  assert.equal(migrated.buildings[id].zoneId, run(`WORLD.defaultPlacements['${id}']`), `${id} placed on its default zone`);
}
assert.equal(migrated.buildings.entrance_hall.level, 1);
assert.equal(migrated.schema, 2);
assert.equal(migrated.worldId, 'first_base_v1');

// Soldiers keep identity, stats, equipment, assignment, status and deadlines.
const identityKeys = ['id', 'name', 'colorSeed', 'soldierVariant', 'outfit', 'level', 'xp', 'xpToNext', 'maxHp', 'hp',
  'strength', 'accuracy', 'endurance', 'maxEnergy', 'energy', 'hygiene', 'morale', 'assignedBuildingId', 'equipment',
  'status', 'hospitalUntil', 'missionReturnAt', 'missionTierId'];
assert.equal(migrated.units.length, fixture.units.length);
fixture.units.forEach((before, i) => {
  const after = migrated.units[i];
  for (const key of identityKeys) assert.deepEqual(after[key], before[key], `${before.name}: ${key} preserved`);
});

// Positions are reprojected to safe world spots, not left in old grid pixels.
const [trainee, patient, away, idler] = migrated.units;
const at = (unit, point) => Math.hypot(unit.x - point.x, unit.y - point.y) < 1;
assert.ok(at(trainee, run(`zoneById(WORLD.defaultPlacements.shooting_range).entrance`)), 'a unit at the old range door moves to the new range entrance');
assert.ok(at(patient, run(`worldNodePosition(WORLD.safeNodes.hospital)`)), 'hospitalized unit waits at the aid station');
assert.ok(at(away, run(`worldNodePosition(WORLD.safeNodes.gate)`)), 'unit on a mission returns through the gate');
assert.ok(run(`Object.values(WORLD.nodes).some(n => Math.hypot(n.x - ${idler.x}, n.y - ${idler.y}) < 1)`), 'other units snap to a path node');
for (const unit of migrated.units) {
  assert.ok(run(`WORLD.terrain.every(a => !pointInPolygon(${unit.x}, ${unit.y}, a.polygon))`), `${unit.name} not placed in terrain`);
}

// Migration ran once: v2 written, v1 untouched, recovery copy kept.
assert.ok(storage.has('armybase_save_v2'), 'migrated save written to the v2 key');
assert.equal(storage.get('armybase_save_v1'), v1Raw, 'the original v1 save is never modified');
assert.equal(storage.get('armybase_save_recovery'), v1Raw, 'the loaded v1 text is kept as the recovery copy');

// Reload twice: the second and third loads read v2 and change nothing.
const stable = data => { const copy = JSON.parse(JSON.stringify(data)); delete copy.lastTick; return copy; };
for (let pass = 0; pass < 2; pass++) {
  run('state = GameState.load(); state.save()');
  assert.deepEqual(stable(snapshot()), stable(migrated), `reload ${pass + 1} is idempotent`);
}
assert.equal(run('readStoredSave().source'), 'current');

// Migration itself is deterministic.
sandbox.__v1 = fixture;
assert.equal(run('JSON.stringify(migrateV1ToV2(__v1))'), run('JSON.stringify(migrateV1ToV2(__v1))'));

// Mid-mission reload after the squad is overdue resolves the mission once.
run(`var overdue = JSON.parse(localStorage.getItem('armybase_save_v2'));
  overdue.units[2].missionReturnAt = Date.now() - 60000; overdue.lastTick = Date.now() - 120000;
  localStorage.setItem('armybase_save_v2', JSON.stringify(overdue));
  state = GameState.load();`);
assert.notEqual(run(`state.units.find(u => u.id === 'unit_m1abc_3').status`), 'on_mission', 'overdue mission resolves on reload');
assert.equal(run('state.missionLog.length'), fixture.missionLog.length + 1, 'resolved exactly once');
assert.equal(run(`state.units.find(u => u.id === 'unit_m1abc_2').status`), 'hospital', 'hospital timer keeps running');

// Export -> import round trip keeps everything.
run('var exported = JSON.stringify(state.serialize())');
assert.deepEqual(stable(JSON.parse(run('JSON.stringify(GameState.fromSaveData(parseSaveText(exported).data).serialize())'))),
  stable(JSON.parse(run('exported'))), 'backup export/import round trip');
// A v1 backup file imports through the same migration.
sandbox.__v1Raw = v1Raw;
assert.equal(run('parseSaveText(__v1Raw).fromVersion'), 1);
assert.equal(run('parseSaveText(__v1Raw).data.schema'), 2);

// Malformed backups fail with a message a player can act on.
const importError = text => { sandbox.__text = text; return run('(() => { try { parseSaveText(__text); return null; } catch (e) { return e.message; } })()'); };
assert.match(importError('{not json'), /not valid JSON/);
assert.match(importError('[]'), /not a Command Base save/);
assert.match(importError(JSON.stringify({ ...fixture, cash: 'lots' })), /Cash is missing or not a number/);
assert.match(importError(JSON.stringify({ schema: 99 })), /newer version/);
assert.match(importError(JSON.stringify({ ...JSON.parse(run('exported')), buildings: { barracks: { level: 1, zoneId: 'zone_south_green' } } })),
  /barracks cannot stand on zone_south_green/);

// A corrupt current save falls back to the recovery copy, and the corrupt
// text is parked where the next autosave can't overwrite it.
run(`localStorage.setItem('armybase_save_recovery', localStorage.getItem('armybase_save_v2'));
  localStorage.setItem('armybase_save_v2', '{"schema":2,"cash":');`);
assert.equal(run('readStoredSave().source'), 'recovery');
run(`localStorage.setItem('armybase_save_recovery', 'garbage'); localStorage.setItem('armybase_save_v1', 'garbage');`);
assert.equal(run('readStoredSave()'), null, 'nothing loadable starts fresh');
assert.equal(storage.get('armybase_save_unreadable'), '{"schema":2,"cash":', 'unreadable save preserved');
console.log('Save migration tests passed');

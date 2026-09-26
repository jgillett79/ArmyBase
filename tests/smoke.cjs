// Run with: node tests/smoke.cjs. No installed dependencies required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const storage = new Map();
const sandbox = vm.createContext({
  console, Math, Date,
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
});
for (const file of ['utils', 'world', 'unit', 'building', 'mission', 'state', 'save']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), sandbox);
}
const run = source => vm.runInContext(source, sandbox);

// Building approaches follow the world path graph and finish at the zone
// entrance, whichever side of the trail the zone lies on.
run(`var map = new GameState(); var start = worldNodePosition('gate_inside');
  var walker = new Unit({x:start.x,y:start.y,isCivilian:false});
  map.routeToBuilding(walker, map.shootingRange); var legCount = walker.path.length;
  walker.step(120);`);
assert.ok(run('legCount') > 3, 'the winding path needs intermediate waypoints');
assert.equal(run('walker.isAtTarget()'), true);
assert.ok(run('Math.hypot(walker.x-buildingDoor(map.shootingRange).x,walker.y-buildingDoor(map.shootingRange).y)') < 25);
assert.equal(run('map.entranceHall.zoneId'), 'zone_reception',
  'the Entrance Hall stays in the clearing beside the gate');
assert.ok(run('map.waitingSlots.every((_, i) => pointInPolygon(map.chairPosition(i).x, map.chairPosition(i).y, buildingZone(map.entranceHall).footprint))'),
  'waiting chairs must be inside the entrance hall');

// XP is part of the normal mission loop; a successful mission changes level.
run(`var state = new GameState(); var soldier = new Unit({x:100,y:100,isCivilian:false});
  soldier.status = UNIT_STATUS.IDLE; soldier.outfit = 'uniform'; state.units.push(soldier);
  soldier.xp = 90; state.dispatchMission('local_patrol',[soldier.id]);
  soldier.missionReturnAt = Date.now() - 1000;`);
const oldRandom = sandbox.Math.random;
sandbox.Math.random = () => 0;
run('state.tick(0.1, Date.now())');
sandbox.Math.random = oldRandom;
assert.equal(run('soldier.level'), 2, 'patrol XP should level a soldier');
assert.equal(run('state.missionLog.length'), 1, 'mission result should be recorded');

run('soldier.status = UNIT_STATUS.IDLE');
assert.equal(run("state.dispatchMission('local_patrol',[soldier.id,soldier.id])"), false, 'duplicate squad IDs rejected');
run("soldier.soldierVariant = 6; soldier.outfit = 'uniform'; state.save(); var loaded = GameState.load();");
assert.equal(run('loaded.units[0].soldierVariant'), 6, 'appearance survives reload');
assert.equal(run('loaded.units[0].outfit'), 'uniform');

// Higher upgrades consume mission materials and cannot be bought with cash alone.
run('loaded.cash = 5000; loaded.upgradeBarracks()');
assert.equal(run('loaded.canBuildOrUpgradeBarracks()'), false, 'level 2 needs lumber');
run('loaded.lumber = 10; loaded.upgradeBarracks()');
assert.equal(run('loaded.barracks.level'), 2);
assert.equal(run('loaded.lumber'), 0);
assert.equal(run('loaded.baseComplete'), false);

// A real dispatch/return loop must unlock every mission tier without editing
// saved levels. Training can satisfy the separate stat requirement.
run(`var progression = new GameState(); var recruit = new Unit({x:100,y:100,isCivilian:false});
  recruit.outfit = 'uniform'; progression.units.push(recruit);`);
sandbox.Math.random = () => 0;
for (const tierId of ['local_patrol', 'supply_run', 'fortified_outpost', 'high_value_target']) {
  run(`recruit.strength = 90; recruit.accuracy = 90; recruit.endurance = 90;`);
  for (let tries = 0; tries < 60 && !run(`unitMeetsMissionRequirements(recruit, missionTierById('${tierId}'))`); tries++) {
    const lowerTier = { supply_run: 'local_patrol', fortified_outpost: 'supply_run', high_value_target: 'fortified_outpost' }[tierId];
    assert.equal(run(`progression.dispatchMission('${lowerTier}', [recruit.id])`), true);
    run('recruit.missionReturnAt = Date.now() - 1000; progression.tick(0.1, Date.now())');
  }
  assert.equal(run(`unitMeetsMissionRequirements(recruit, missionTierById('${tierId}'))`), true, `${tierId} reachable`);
}
sandbox.Math.random = oldRandom;

// Overdue mission failure begins recovery when the squad was due to return.
run(`var patient = loaded.units[0]; patient.status = UNIT_STATUS.ON_MISSION;
  patient.missionTierId = 'local_patrol'; patient.missionReturnAt = Date.now() - 24*60*60*1000;`);
sandbox.Math.random = () => 0.9999;
run('loaded.catchUp(20, Date.now())');
sandbox.Math.random = oldRandom;
assert.notEqual(run('patient.status'), 'hospital', 'completed recovery should not restart at login');
console.log('Game loop smoke tests passed');

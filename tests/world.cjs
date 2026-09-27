// Run with: node tests/world.cjs. Validates the authored world map, path
// graph and routing. No installed dependencies required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const sandbox = vm.createContext({ console, Math });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'world.js'), 'utf8'), sandbox);
const run = source => vm.runInContext(source, sandbox);

// Zones don't overlap each other or terrain, entrances sit at the footprint
// edge, paths avoid water/cliffs/footprints and everything is reachable.
const problems = run('validateWorld()');
assert.deepEqual([...problems], [], `world validation failed:\n${problems.join('\n')}`);

// Every zone has a continuous route from the gate: consecutive points are
// short hops along the drawn path and no hop crosses terrain or a footprint.
const zoneIds = run('WORLD.zones.map(z => z.id)');
for (const zoneId of zoneIds) {
  const route = run(`findWorldRoute(WORLD.nodes.gate_outside.x, WORLD.nodes.gate_outside.y, doorNodeId('${zoneId}'))`);
  assert.ok(route && route.length >= 3, `${zoneId} has a route from the gate`);
  const end = route[route.length - 1];
  const entrance = run(`zoneById('${zoneId}').entrance`);
  assert.ok(Math.hypot(end.x - entrance.x, end.y - entrance.y) < 0.5, `${zoneId} route ends at its entrance`);
  sandbox.__route = route;
  assert.equal(run(`(() => { for (let i = 1; i < __route.length; i++) {
    const a = [__route[i-1].x, __route[i-1].y], b = [__route[i].x, __route[i].y];
    for (const area of WORLD.terrain) if (segmentPolygonDistance(a, b, area.polygon) < 1) return 'terrain ' + area.id;
    for (const zone of WORLD.zones) if (segmentPolygonDistance(a, b, zone.footprint) < 1) return 'zone ' + zone.id;
  } return 'clear'; })()`), 'clear', `${zoneId} route stays on open ground`);
}

// Routing from mid-edge picks the cheaper direction instead of backtracking.
const mid = run(`pointAlongEdge(worldEdgeList().find(e => e.from === 't1' && e.to === 't2'), 0.9)`);
const toT2 = run(`findWorldRoute(${mid.x}, ${mid.y}, 't2')`);
const walked = toT2.reduce((sum, p, i) => i ? sum + Math.hypot(p.x - toT2[i - 1].x, p.y - toT2[i - 1].y) : 0, 0);
const edgeLength = run(`worldEdgeList().find(e => e.from === 't1' && e.to === 't2').length`);
assert.ok(walked < edgeLength * 0.15, 'a unit near t2 walks forward to it');

// Unbuilt spurs are omitted when routing is limited to specific zones.
assert.equal(run(`findWorldRoute(40, 610, doorNodeId('zone_ford'), new Set(['zone_reception']))`), null);

// Each existing building type has at least one legal zone and a default.
for (const type of ['entrance_hall', 'barracks', 'shooting_range', 'mess_hall', 'weight_room',
  'obstacle_course', 'drill_yard', 'showers', 'rec_room']) {
  assert.ok(run(`WORLD.zones.some(z => zoneAllowsType(z, '${type}'))`), `${type} has a legal zone`);
  assert.ok(run(`!!WORLD.defaultPlacements['${type}']`), `${type} has a default zone`);
}

// Validation actually catches a broken layout (guards against a vacuous check).
const broken = run(`(() => { const copy = JSON.parse(JSON.stringify(WORLD));
  copy.zones[1].footprint = copy.zones[0].footprint.map(([x, y]) => [x + 10, y]);
  copy.edges = copy.edges.filter(e => e.from !== 'n5' && e.to !== 'n5');
  return validateWorld(copy); })()`);
assert.ok(broken.some(p => /overlap/.test(p)), 'overlap detected');
assert.ok(broken.some(p => /unreachable/.test(p)), 'unreachable node detected');
console.log('World map tests passed');

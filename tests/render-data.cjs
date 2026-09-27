// Run with: node tests/render-data.cjs. Headless checks for the view and
// build layer: camera math (the basis of pointer/touch hit testing), seeded
// scenery placement, and choosing a construction site. The canvas output
// itself is reviewed with tools/browser-capture.cjs, not here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const canvasStub = () => ({ width: 0, height: 0, getContext: () => null });
const sandbox = vm.createContext({
  console, Math, Date,
  localStorage: { getItem: () => null, setItem() {} },
  document: { createElement: canvasStub },
  Image: class { constructor() { this.complete = false; this.naturalWidth = 0; } },
  performance: { now: () => 0 },
});
for (const file of ['utils', 'world', 'asset-manifest', 'camera', 'unit', 'building', 'mission', 'state', 'save', 'scenery', 'render', 'animation']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), sandbox);
}
const run = source => vm.runInContext(source, sandbox);
const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-6, `${label}: ${a} vs ${b}`);

// Camera: screen<->world are inverses at any zoom/pan, zoom keeps the point
// under the cursor fixed, and the view never leaves the world.
run('var cam = new Camera(960, 576)');
for (const [sx, sy] of [[0, 0], [480, 288], [959, 575], [123, 456]]) {
  const w = run(`cam.screenToWorld(${sx}, ${sy})`);
  const back = run(`cam.worldToScreen(${w.x}, ${w.y})`);
  close(back.x, sx, 'round trip x'); close(back.y, sy, 'round trip y');
}
const anchor = run('cam.screenToWorld(300, 200)');
run('cam.zoomAt(300, 200, 1.3)');
const after = run('cam.screenToWorld(300, 200)');
close(after.x, anchor.x, 'zoom anchor x'); close(after.y, anchor.y, 'zoom anchor y');
run('cam.zoomAt(480, 288, 100)');
assert.equal(run('cam.zoom'), run('CAMERA_MAX_ZOOM'), 'zoom is bounded above');
run('cam.zoomAt(480, 288, 0.001)');
close(run('cam.zoom'), 0.6, 'minimum zoom shows the whole 1600 x 960 world on a 960 x 576 canvas');
run('cam.zoom = 1; cam.panBy(-100000, -100000)');
const b = run('cam.visibleBounds()');
assert.ok(b.maxX <= 1600 + 1e-6 && b.maxY <= 960 + 1e-6 && b.minX >= -1e-6 && b.minY >= -1e-6, 'pan stays inside the world');
run('var phone = new Camera(390, 526)');
assert.ok(run('phone.zoom') < 1 && run('phone.zoom') >= run('phone.minZoom'), 'phones open slightly zoomed out');

// Scenery: deterministic, and never on a zone, path, entrance or water.
const trees = run('scenery().trees');
assert.ok(trees.length > 60, 'the map is framed with vegetation');
sandbox.__trees = trees;
assert.equal(run('JSON.stringify(buildSceneryPlacement().trees)'), JSON.stringify(trees), 'placement is seeded');
assert.equal(run(`__trees.filter(t => WORLD.zones.some(z => pointPolygonDistance(t.x, t.y, z.footprint) < 18)).length`), 0, 'no tree on a build zone');
assert.equal(run(`__trees.filter(t => distanceToPaths(t.x, t.y, worldEdgeList(null)) < 30).length`), 0, 'no tree on a path or entrance spur');
assert.equal(run(`__trees.filter(t => WORLD.terrain.some(a => pointInPolygon(t.x, t.y, a.polygon))).length`), 0, 'no tree in water or on cliffs');

// Scene props: all nine prepared sprites are placed, none blocks a trail,
// site, entrance, the bridge or the gate, and trees keep off them.
assert.deepEqual([...run('validateScenePropPlacements()')], [], 'scene props are clear');
assert.equal(run('new Set(SCENE_PROP_PLACEMENTS.map(p => p.prop)).size'), 9, 'every prepared prop is placed');
assert.equal(run(`__trees.filter(t => SCENE_PROP_PLACEMENTS.some(p => Math.hypot(t.x - p.x, t.y - p.y) < p.base + 16)).length`), 0, 'no tree on a prop');
const badProps = run(`validateScenePropPlacements([
  { prop: 'scene_lamp', x: 340, y: 614, base: 4 },
  { prop: 'scene_lamp', x: 178, y: 614, base: 4 },
  { prop: 'scene_lamp', x: 256, y: 570, base: 4 },
  { prop: 'scene_rocks_granite', x: 250, y: 470, base: 14 },
  { prop: 'scene_rocks_granite', x: 176, y: 720, base: 14 }])`);
for (const pattern of [/on a trail/, /on bridge_gate/, /blocks zone_reception entrance/, /on zone_reception/, /in water or rock/]) {
  assert.ok(badProps.some(p => pattern.test(p)), `prop validator catches ${pattern}`);
}
// The closed boom's tip lands in the rest fork's seat (within 1 world px).
const tip = run('boomTip(WORLD.checkpoint.boomClosedAngle)');
const seat = run(`({ x: WORLD.checkpoint.boomRest.x + (ASSET_MANIFEST.checkpoint.rest.seat[0] - ASSET_MANIFEST.checkpoint.rest.ground[0]) / 3,
  y: WORLD.checkpoint.boomRest.y - (ASSET_MANIFEST.checkpoint.rest.ground[1] - ASSET_MANIFEST.checkpoint.rest.seat[1]) / 3 })`);
assert.ok(Math.hypot(tip.x - seat.x, tip.y - seat.y) < 1, `closed boom tip (${tip.x.toFixed(1)}, ${tip.y.toFixed(1)}) rests in the fork seat (${seat.x.toFixed(1)}, ${seat.y.toFixed(1)})`);
assert.ok(run('Math.hypot(WORLD.checkpoint.boomRest.x - WORLD.checkpoint.pause.x, WORLD.checkpoint.boomRest.y - WORLD.checkpoint.pause.y)') > 20, 'rest post clear of the check-in stop');

// Bridge layering: the near rail sorts below people on the deck.
assert.ok(run(`bridgeFrontDepth(WORLD.bridges[0]) > Math.max(WORLD.bridges[0].west[1], WORLD.bridges[0].east[1])`), 'near rail in front of the deck');

// Construction sites: an unbuilt facility can take a free zone or swap with
// another unbuilt one; built zones and wrong types are blocked; the economy
// check is unchanged.
run('var state = new GameState(); state.cash = 5000;');
assert.equal(run(`state.zonePlacementState(state.weightRoom, 'zone_knoll_east')`), 'current');
assert.equal(run(`state.zonePlacementState(state.weightRoom, 'zone_east_meadow')`), 'swap', 'rec room is only surveyed there');
assert.equal(run(`state.zonePlacementState(state.weightRoom, 'zone_south_green')`), 'blocked', 'open-air zone cannot take an enclosed building');
assert.equal(run(`state.constructAt('weightRoom', 'zone_east_meadow')`), true);
assert.equal(run('state.weightRoom.zoneId'), 'zone_east_meadow');
assert.equal(run('state.recRoom.zoneId'), 'zone_knoll_east', 'displaced facility takes the vacated site');
assert.equal(run(`state.zonePlacementState(state.recRoom, 'zone_east_meadow')`), 'blocked', 'a built site is blocked');
run('state.cash = 0');
assert.equal(run(`state.constructAt('messHall', 'zone_north_terrace')`), false, 'cannot build without the cash');
assert.match(run('state.constructionShortfall(state.messHall)'), /^\$120 more$/);
assert.equal(run('state.messHall.isBuilt'), false);
assert.equal(run(`state.constructAt('entranceHall', 'zone_reception')`), false, 'the Entrance Hall is fixed');
// Placement survives save/load.
run(`state.cash = 500; state.constructAt('shootingRange', 'zone_ford');`);
const reloaded = run('GameState.fromSaveData(normalizeSaveData(JSON.parse(JSON.stringify(state.serialize()))).data)');
assert.equal(reloaded.shootingRange.zoneId, 'zone_ford');
assert.equal(reloaded.shootingRange.level, 1);
console.log('Render/build data tests passed');

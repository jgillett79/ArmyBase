// Lightweight DOM smoke check when a graphical browser is unavailable.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ids = [...fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const nodes = new Map();
function element(id = '') {
  let hidden = id === 'profilePanel';
  return {
    id, style: {}, dataset: {}, value: '', textContent: '', innerHTML: '', disabled: false,
    classList: { contains: name => name === 'hidden' && hidden, add: name => { if (name === 'hidden') hidden = true; }, remove: name => { if (name === 'hidden') hidden = false; }, toggle: (name, value) => { if (name === 'hidden') hidden = value; } },
    addEventListener(type, handler) { (this.handlers ||= {})[type] = handler; },
    append() {}, replaceChildren() {}, querySelectorAll() { return []; },
    getContext() { return new Proxy({}, { get: (_, key) => key === 'canvas' ? this : () => null }); },
  };
}
for (const id of ids) nodes.set(id, element(id));
const document = { activeElement: null, getElementById: id => nodes.get(id), createElement: () => element() };
const sandbox = vm.createContext({
  console, Math, Date, performance, document, window: { addEventListener() {} },
  localStorage: { getItem: () => null, setItem() {} },
  Image: class { constructor() { this.complete = false; this.naturalWidth = 0; } },
  requestAnimationFrame: callback => { sandbox.lastFrame = callback; },
});
for (const file of ['utils', 'world', 'asset-manifest', 'camera', 'unit', 'building', 'mission', 'state', 'save', 'scenery', 'render', 'animation', 'main']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), sandbox);
}
vm.runInContext('var sample = new Unit({x:150,y:150,isCivilian:false}); gameState.units.push(sample); openProfile(sample);', sandbox);
const input = nodes.get('profileName');
document.activeElement = input;
input.value = 'My edited name';
vm.runInContext('frame(performance.now() + 16)', sandbox);
assert.equal(input.value, 'My edited name', 'live refresh must not erase an in-progress name edit');
assert.ok(sandbox.lastFrame, 'animation loop must continue');
// Facility activity follows arrival at a reserved slot, not a scheduled status.
vm.runInContext(`gameState.shootingRange.level = 1;
  sample.status = UNIT_STATUS.TRAINING;
  sample.assignedBuildingId = gameState.shootingRange.id;
  gameState.routeForStatus(sample);`, sandbox);
assert.ok(vm.runInContext('sample.slot && sample.slot.buildingId', sandbox) === 'shooting_range', 'a range slot is reserved');
assert.equal(vm.runInContext('activeFacilityFor(sample, gameState)', sandbox), null,
  'walking soldiers must not display facility activity');
vm.runInContext(`sample.x = sample.targetX = sample.slot.x; sample.y = sample.targetY = sample.slot.y; sample.path = [];`, sandbox);
assert.equal(vm.runInContext('activeFacilityFor(sample, gameState)?.id', sandbox), 'shooting_range');
vm.runInContext('frame(performance.now() + 32)', sandbox); // draws the activity without throwing
vm.runInContext('gameState.shootingRange.level = 0', sandbox);
assert.equal(vm.runInContext('activeFacilityFor(sample, gameState)', sandbox), null,
  'an unbuilt facility must not display activity');
console.log('UI smoke test passed');

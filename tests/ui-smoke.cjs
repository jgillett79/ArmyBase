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
for (const file of ['utils', 'world', 'unit', 'building', 'mission', 'state', 'save', 'render', 'main']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), sandbox);
}
vm.runInContext('var sample = new Unit({x:150,y:150,isCivilian:false}); gameState.units.push(sample); openProfile(sample);', sandbox);
const input = nodes.get('profileName');
document.activeElement = input;
input.value = 'My edited name';
vm.runInContext('frame(performance.now() + 16)', sandbox);
assert.equal(input.value, 'My edited name', 'live refresh must not erase an in-progress name edit');
assert.ok(sandbox.lastFrame, 'animation loop must continue');
// Facility effects must follow actual arrivals, not merely a scheduled status.
vm.runInContext(`sample.status = UNIT_STATUS.TRAINING;
  sample.assignedBuildingId = gameState.shootingRange.id;
  gameState.shootingRange.level = 1;
  sample.targetX = sample.x + 50;`, sandbox);
assert.equal(vm.runInContext('activeFacilityFor(sample, gameState)', sandbox), null,
  'walking soldiers must not display facility activity');
vm.runInContext('sample.targetX = sample.x; sample.targetY = sample.y; sample.path = [];', sandbox);
assert.equal(vm.runInContext('activeFacilityFor(sample, gameState)?.id', sandbox), 'shooting_range');
vm.runInContext('gameState.shootingRange.level = 0', sandbox);
assert.equal(vm.runInContext('activeFacilityFor(sample, gameState)', sandbox), null,
  'an unbuilt facility must not display activity');
console.log('UI smoke test passed');

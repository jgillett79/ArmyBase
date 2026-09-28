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
    children: [], attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    append(...kids) { this.children = [...this.children, ...kids]; },
    replaceChildren(...kids) { this.children = kids; },
    querySelectorAll() { return []; },
    getContext() { return new Proxy({}, { get: (_, key) => key === 'canvas' ? this : () => null }); },
  };
}
for (const id of ids) nodes.set(id, element(id));
const document = { activeElement: null, body: element('body'), getElementById: id => nodes.get(id), createElement: () => element(), querySelectorAll: () => [] };
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

// Customization on the soldier card: callsign and accent edits go through
// the card's own controls, persist, and show on the card, roster and debrief.
const run = source => vm.runInContext(source, sandbox);
document.activeElement = null;
run('sample.status = UNIT_STATUS.IDLE; sample.slot = null; openProfile(sample);');
const callsign = nodes.get('profileCallsign');
callsign.value = '  Night   Owl <b>that is long ';
callsign.handlers.change();
assert.equal(run('sample.callsign'), 'Night Owl bt', 'callsign is cleaned and capped at 12 characters');
assert.equal(callsign.value, 'Night Owl bt', 'the field shows what was kept');
const swatches = nodes.get('profileAccents').children;
assert.equal(swatches.length, 4, 'four accent colours');
swatches.find(s => s.dataset.accent === 'gold').handlers.click();
assert.equal(run('sample.accent'), 'gold');
run('openProfile(sample)');
assert.equal(swatches.find(s => s.dataset.accent === 'gold').attributes['aria-checked'], 'true');
assert.equal(nodes.get('profileAccentBadge').style.background, run("accentById('gold').hex"), 'card badge shows the accent');
assert.equal(run('sample.fieldName'), `${run("sample.name.split(' ')[0]")} "Night Owl bt"`, 'map label uses the callsign');
run('renderRoster()');
const rosterCard = nodes.get('rosterList').children.find(c => c.dataset.unitId === run('sample.id'));
assert.match(rosterCard.children[1].children[0].textContent, /"Night Owl bt"$/, 'roster shows the callsign');
assert.equal(rosterCard.children[0].children[1].style.background, run("accentById('gold').hex"), 'roster shows the accent');
run(`showDebrief({ id: 'report_x', unitId: sample.id, name: sample.name, callsign: null, accent: 'red', tier: 'Local Patrol',
  intro: false, succeeded: true, xp: 60, cash: 70, resource: null, levelFrom: 1, levelTo: 1, seen: false })`);
assert.equal(nodes.get('debriefCallsign').textContent, 'Callsign "Night Owl bt"', 'debrief shows the soldier as they are now');
assert.equal(nodes.get('debriefAccentBadge').style.background, run("accentById('gold').hex"));
nodes.get('profileRandomise').handlers.click();
assert.ok(run('CALLSIGN_POOL.includes(sample.callsign) && sample.accent !== "gold"'), 'Randomise picks a pool callsign and a new accent');
callsign.value = '   ';
callsign.handlers.change();
assert.equal(run('sample.callsign'), null, 'clearing the field removes the callsign');
console.log('UI smoke test passed');

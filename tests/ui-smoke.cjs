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
for (const file of ['utils', 'unit', 'building', 'mission', 'state', 'render', 'main']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), sandbox);
}
vm.runInContext('var sample = new Unit({x:150,y:150,isCivilian:false}); gameState.units.push(sample); openProfile(sample);', sandbox);
const input = nodes.get('profileName');
document.activeElement = input;
input.value = 'My edited name';
vm.runInContext('frame(performance.now() + 16)', sandbox);
assert.equal(input.value, 'My edited name', 'live refresh must not erase an in-progress name edit');
assert.ok(sandbox.lastFrame, 'animation loop must continue');
console.log('UI smoke test passed');

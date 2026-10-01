// Shared headless loader for the game scripts (no browser): a vm context
// with a localStorage stub, a controllable clock and optional seeded
// Math.random. Brief 09 tests use it; older tests keep their own loaders.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const GAME_FILES = ['utils', 'world', 'asset-manifest', 'unit', 'building', 'mission', 'routine', 'state', 'daily', 'save'];

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function loadGame({ seed = 1, start = 1_800_000_000_000 } = {}) {
  const clock = { now: start };
  class ClockDate extends Date { constructor(...a) { super(...(a.length ? a : [Math.floor(clock.now)])); } static now() { return Math.floor(clock.now); } }
  const math = Object.create(Math); math.random = seeded(seed);
  const storage = new Map();
  const sandbox = vm.createContext({
    console: { ...console, warn() {} }, Math: math, Date: ClockDate,
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
  });
  for (const file of GAME_FILES) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'js', `${file}.js`), 'utf8'), sandbox);
  const run = source => vm.runInContext(source, sandbox);
  // Advance simulated (and real) time in small ticks; speed scales sim dt only.
  const advance = (seconds, dt = 0.1) => {
    for (let t = 0; t < seconds - 1e-9; t += dt) { clock.now += dt * 1000; sandbox.state.tick(dt, clock.now); }
  };
  return { run, clock, sandbox, advance, storage };
}

module.exports = { loadGame, GAME_FILES };

// First-session pacing (brief 08). Run with: node tests/pacing.cjs
// A scripted player who acts `delay` real seconds after each new step plays
// fresh games in simulated real time (30 ticks/s, visitors spawning as in
// the browser). Prompt and slow players must both send their first soldier
// on the introductory patrol inside the first session, with the range
// drill never waiting on a closed range and no collapse at all in the
// first ten minutes. Seeded, so failures reproduce.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const SESSION_S = 600; // the brief's "first ten minutes"
// Reaction time per step -> latest acceptable dispatch of the first patrol.
const PLAYERS = [
  { delay: 3, dispatchBy: 150 },
  { delay: 10, dispatchBy: 180 },
  { delay: 20, dispatchBy: 240 },
  { delay: 30, dispatchBy: 300 },
];
// Known limit, reported rather than hidden: a player who waits a full
// minute before every step assigns the soldier near 22:00 game time (they
// sleep first) and reaches day 2 with nothing that restores energy — no
// Mess Hall yet — so the soldier collapses before patrol-ready. Checked
// only for recoverability: the 5-minute early recovery must still let them
// finish the chapter. Fixing it needs a design decision (manifest §8 C).
const LIMIT = { delay: 60, recoveryMaxS: 5 * 60 + 1, completeBy: 1200 };
const SEEDS = [1, 2, 3, 4, 5];

function playSession(delay, seed, sessionS = SESSION_S) {
  let now = 1_800_000_000_000;
  let s = seed * 2654435761 >>> 0;
  const random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  class ClockDate extends Date { constructor(...a) { super(...(a.length ? a : [Math.floor(now)])); } static now() { return Math.floor(now); } }
  const math = Object.create(Math); math.random = random;
  const sandbox = vm.createContext({ console, Math: math, Date: ClockDate, localStorage: { getItem: () => null, setItem() {} } });
  for (const file of ['utils', 'world', 'asset-manifest', 'unit', 'building', 'mission', 'state', 'save']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), sandbox);
  }
  const run = source => vm.runInContext(source, sandbox);
  run('var s = new GameState(); s.lastCivilianSpawn = Date.now() - CIVILIAN_SPAWN_INTERVAL_MS + 2000;');
  const r = { delay, seed, dispatchS: null, completeS: null, hospitalS: null, recoveredS: null, assignedS: null, firstRangeS: null, stuckS: 0 };
  let t = 0, stage = null, actAt = 0;
  const dt = 1 / 30;
  while (t < sessionS) {
    now += dt * 1000; t += dt;
    run(`if (Date.now() - s.lastCivilianSpawn > CIVILIAN_SPAWN_INTERVAL_MS) { s.spawnCivilianIfRoom(); s.lastCivilianSpawn = Date.now(); }
      s.tick(${dt}, Date.now());`);
    const current = run('s.chapterStage().id');
    if (current !== stage) { stage = current; actAt = t + delay; }
    const u = run(`s.firstSoldier && { status: s.firstSoldier.status, using: s.firstSoldier.routePhase === 'using', drill: !!s.firstSoldier.onDrill }`);
    if (u && u.status === 'hospital' && r.hospitalS === null) r.hospitalS = t;
    if (u && u.status !== 'hospital' && r.hospitalS !== null && r.recoveredS === null) r.recoveredS = t;
    // Assigned, patrol not yet ready, not at the range and not walking to it: a missed window.
    if (stage === 'train' && r.assignedS !== null && u && !u.using && u.status !== 'training') r.stuckS += dt;
    if (stage === 'train' && u && u.using && r.firstRangeS === null && r.assignedS !== null) r.firstRangeS = t;
    if (t < actAt) continue;
    if (stage === 'meet') run(`s.chapterStage().visitor && s.recruit(s.chapterStage().visitor.id)`);
    else if (stage === 'build_range') run(`s.constructAt('shootingRange', s.shootingRange.zoneId)`);
    else if (stage === 'train' && r.assignedS === null) { if (run(`s.assignToBuilding(s.firstSoldier.id, 'shooting_range')`)) r.assignedS = t; }
    else if (stage === 'patrol') { if (run(`s.dispatchMission('local_patrol', [s.firstSoldier.id], { recall: true })`)) r.dispatchS = t; }
    else if (stage === 'debrief') run('s.markReportSeen(s.chapter.introReportId)');
    else if (stage === 'improve') run(`(() => { const a = s.nextConstructionAdvice(); return a && a.affordable && (s[a.key].isBuilt ? s.upgradeBuilding(a.key) : s.constructAt(a.key, s[a.key].zoneId)); })()`);
    else if (stage === 'complete' && r.completeS === null) r.completeS = t;
  }
  r.drillAccuracy = run('s.firstSoldier ? `${s.chapter.targetAccuracy - INTRO_READINESS_GAIN} -> ${Math.floor(s.firstSoldier.accuracy)}` : null');
  return r;
}

assert.equal(vm.runInNewContext(`${fs.readFileSync(path.join(__dirname, '..', 'js', 'mission.js'), 'utf8')}; INTRO_READINESS_GAIN`, { randRange() {}, clamp() {} }), 3,
  'the brief asks for a +3 readiness target');

// PACING_REPORT=1 prints every session without asserting (for tuning).
if (process.env.PACING_REPORT) {
  for (const { delay } of [...PLAYERS, LIMIT]) for (const seed of SEEDS) console.log(JSON.stringify(playSession(delay, seed, delay === LIMIT.delay ? LIMIT.completeBy : SESSION_S)));
  process.exit(0);
}

const rows = [];
for (const { delay, dispatchBy } of PLAYERS) {
  for (const seed of SEEDS) {
    const r = playSession(delay, seed);
    rows.push(r);
    const who = `player reacting in ${delay}s (seed ${seed})`;
    assert.ok(r.dispatchS !== null && r.dispatchS <= dispatchBy, `${who}: first patrol by ${dispatchBy}s (was ${r.dispatchS && r.dispatchS.toFixed(0)})`);
    assert.equal(r.hospitalS, null, `${who}: no collapse in the first ${SESSION_S}s (collapsed at ${r.hospitalS && r.hospitalS.toFixed(0)}s)`);
    assert.ok(r.completeS !== null && r.completeS <= SESSION_S, `${who}: chapter complete inside the session`);
    assert.ok(r.firstRangeS - r.assignedS < 60, `${who}: reaches the range within a minute of assignment (${(r.firstRangeS - r.assignedS).toFixed(0)}s)`);
    assert.ok(r.stuckS < 1, `${who}: never waits for the range to open while drilling (${r.stuckS.toFixed(1)}s)`);
  }
}
for (const seed of SEEDS) {
  const r = playSession(LIMIT.delay, seed, LIMIT.completeBy);
  const who = `player reacting in ${LIMIT.delay}s (seed ${seed}, known limit)`;
  assert.ok(r.hospitalS === null || r.recoveredS - r.hospitalS <= LIMIT.recoveryMaxS, `${who}: any collapse lasts at most 5 minutes`);
  assert.ok(r.completeS !== null, `${who}: still completes the chapter within ${LIMIT.completeBy}s`);
  rows.push(r);
}
console.log('delay  seed  assigned  at-range  dispatch  complete  accuracy');
for (const r of rows) {
  const f = v => (v === null ? '-' : v.toFixed(0) + 's').padStart(9);
  console.log(`${String(r.delay).padStart(4)}s ${String(r.seed).padStart(5)} ${f(r.assignedS)} ${f(r.firstRangeS)} ${f(r.dispatchS)} ${f(r.completeS)}  ${r.drillAccuracy}${r.hospitalS !== null ? `  collapsed at ${r.hospitalS.toFixed(0)}s, back at ${r.recoveredS.toFixed(0)}s` : ''}`);
}
console.log('Pacing tests passed');

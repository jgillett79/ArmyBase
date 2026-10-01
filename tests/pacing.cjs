// First-session pacing (brief 08). Run with: node tests/pacing.cjs
// A scripted player who acts `delay` real seconds after each new step plays
// fresh games in simulated real time (30 ticks/s, visitors spawning as in
// the browser). Prompt and slow players must both send their first soldier
// on the introductory patrol inside the first session, with the range
// drill never waiting on a closed range and no collapse at all in the
// first ten minutes. Seeded, so failures reproduce. Every session also
// saves and reloads (JSON round trip through save.js) right after the
// starter field meal and again at dispatch, so a reload can never serve a
// second meal.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Brief 09 re-baseline (1 October 2026): the out-of-hours 3x range drill is
// gone and the day is 20 real minutes, so +3 accuracy comes from the 08:00
// and 13:00 training blocks at the normal rate. Measured at 1x speed: prompt
// players dispatch at ~8.5-9 min (was 2.5-5 min under brief 08). Flagged for
// review in 09A_PERIMETER_AND_ROUTINE_MANIFEST.md; 2x/4x speed shortens it.
const SESSION_S = 720;
// Reaction time per step -> latest acceptable dispatch of the first patrol.
const PLAYERS = [
  { delay: 3, dispatchBy: 570 },
  { delay: 10, dispatchBy: 580 },
  { delay: 20, dispatchBy: 590 },
  { delay: 30, dispatchBy: 600 },
];
// The slowest player: a full minute before every step. They miss the
// first training blocks; the starter kitchen (brief 09) feeds them, so the
// retired starter field meal never fires and nobody collapses.
// Measured: ~1390 s (day 2 morning block) for 4 of 5 seeds, 607 s for one.
const SLOW = { delay: 60, dispatchBy: 1450, completeBy: 1700 };
const SEEDS = [1, 2, 3, 4, 5];

function playSession(delay, seed, sessionS = SESSION_S) {
  let now = 1_800_000_000_000;
  let s = seed * 2654435761 >>> 0;
  const random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  class ClockDate extends Date { constructor(...a) { super(...(a.length ? a : [Math.floor(now)])); } static now() { return Math.floor(now); } }
  const math = Object.create(Math); math.random = random;
  const sandbox = vm.createContext({ console, Math: math, Date: ClockDate, localStorage: { getItem: () => null, setItem() {} } });
  for (const file of ['utils', 'world', 'asset-manifest', 'unit', 'building', 'mission', 'routine', 'state', 'daily', 'save']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), sandbox);
  }
  const run = source => vm.runInContext(source, sandbox);
  run('var s = new GameState(); s.lastCivilianSpawn = Date.now() - CIVILIAN_SPAWN_INTERVAL_MS + 2000;');
  const r = { delay, seed, dispatchS: null, completeS: null, hospitalS: null, recoveredS: null, assignedS: null, firstRangeS: null, stuckS: 0,
    mealS: null, meals: 0, reloads: 0 };
  // Save -> JSON -> load, as a closed and reopened tab would; the old
  // state's meal count is banked first.
  const reload = () => {
    r.meals += run("s.activityLog.filter(e => e.event === 'field_meal').length");
    run('var spawn = s.lastCivilianSpawn; s = GameState.fromSaveData(normalizeSaveData(JSON.parse(JSON.stringify(s.serialize()))).data, Date.now()); s.lastCivilianSpawn = spawn;');
    r.reloads++;
  };
  let t = 0, stage = null, actAt = 0;
  const dt = 1 / 30;
  while (t < sessionS) {
    now += dt * 1000; t += dt;
    run(`if (Date.now() - s.lastCivilianSpawn > CIVILIAN_SPAWN_INTERVAL_MS) { s.spawnCivilianIfRoom(); s.lastCivilianSpawn = Date.now(); }
      s.tick(${dt}, Date.now());`);
    const current = run('s.chapterStage().id');
    if (current !== stage) { stage = current; actAt = t + delay; }
    const u = run(`s.firstSoldier && { status: s.firstSoldier.status, using: !!(s.firstSoldier.routine && s.firstSoldier.routine.stage === 'use' && s.firstSoldier.slot && s.firstSoldier.slot.type === 'range_lane') }`);
    if (r.mealS === null && run('s.chapter.fieldMealUsed')) { r.mealS = t; reload(); }
    if (u && u.status === 'hospital' && r.hospitalS === null) r.hospitalS = t;
    if (u && u.status !== 'hospital' && r.hospitalS !== null && r.recoveredS === null) r.recoveredS = t;
    // Assigned, patrol not yet ready, not at the range and not walking to it: a missed window.
    if (stage === 'train' && r.assignedS !== null && u && !u.using && u.status !== 'training') r.stuckS += dt;
    if (stage === 'train' && u && u.using && r.firstRangeS === null && r.assignedS !== null) r.firstRangeS = t;
    if (t < actAt) continue;
    if (stage === 'meet') run(`s.chapterStage().visitor && s.recruit(s.chapterStage().visitor.id)`);
    else if (stage === 'build_range') run(`s.constructAt('shootingRange', s.shootingRange.zoneId)`);
    else if (stage === 'train' && r.assignedS === null) { if (run(`s.assignToBuilding(s.firstSoldier.id, 'shooting_range')`)) r.assignedS = t; }
    else if (stage === 'patrol') { if (run(`s.dispatchMission('local_patrol', [s.firstSoldier.id], { recall: true })`)) { r.dispatchS = t; reload(); } }
    else if (stage === 'debrief') run('s.markReportSeen(s.chapter.introReportId)');
    else if (stage === 'improve') run(`(() => { const a = s.nextConstructionAdvice(); return a && a.affordable && (s[a.key].isBuilt ? s.upgradeBuilding(a.key) : s.constructAt(a.key, s[a.key].zoneId)); })()`);
    else if (stage === 'complete' && r.completeS === null) r.completeS = t;
  }
  r.meals += run("s.activityLog.filter(e => e.event === 'field_meal').length");
  r.mealFlag = run('s.chapter.fieldMealUsed');
  r.drillAccuracy = run('s.firstSoldier ? `${s.chapter.targetAccuracy - INTRO_READINESS_GAIN} -> ${Math.floor(s.firstSoldier.accuracy)}` : null');
  return r;
}

assert.equal(vm.runInNewContext(`${fs.readFileSync(path.join(__dirname, '..', 'js', 'mission.js'), 'utf8')}; INTRO_READINESS_GAIN`, { randRange() {}, clamp() {} }), 3,
  'the brief asks for a +3 readiness target');

// PACING_REPORT=1 prints every session without asserting (for tuning).
if (process.env.PACING_REPORT) {
  for (const { delay } of [...PLAYERS, SLOW]) for (const seed of SEEDS) console.log(JSON.stringify(playSession(delay, seed, delay === SLOW.delay ? SLOW.completeBy : SESSION_S)));
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
    assert.ok(r.firstRangeS <= 150, `${who}: at the range during the first training block (${r.firstRangeS && r.firstRangeS.toFixed(0)}s)`);
    assert.equal(r.meals, 0, `${who}: the retired starter field meal never fires`);
  }
}
for (const seed of SEEDS) {
  const r = playSession(SLOW.delay, seed, SLOW.completeBy);
  const who = `player reacting in ${SLOW.delay}s (seed ${seed})`;
  assert.equal(r.meals, 0, `${who}: the retired starter field meal never fires, across ${r.reloads} reloads`);
  assert.ok(r.dispatchS !== null && r.dispatchS <= SLOW.dispatchBy, `${who}: first patrol by ${SLOW.dispatchBy}s (was ${r.dispatchS && r.dispatchS.toFixed(0)})`);
  assert.ok(r.hospitalS === null || r.hospitalS > r.dispatchS, `${who}: no collapse before the patrol (collapsed at ${r.hospitalS && r.hospitalS.toFixed(0)}s)`);
  assert.ok(r.completeS !== null && r.completeS <= SLOW.completeBy, `${who}: first chapter completed by ${SLOW.completeBy}s`);
  rows.push(r);
}
console.log('delay  seed  assigned  at-range  dispatch  complete  accuracy');
for (const r of rows) {
  const f = v => (v === null ? '-' : v.toFixed(0) + 's').padStart(9);
  console.log(`${String(r.delay).padStart(4)}s ${String(r.seed).padStart(5)} ${f(r.assignedS)} ${f(r.firstRangeS)} ${f(r.dispatchS)} ${f(r.completeS)}  ${r.drillAccuracy}${r.mealS !== null ? `  meal at ${r.mealS.toFixed(0)}s (${r.meals}x, ${r.reloads} reloads)` : ''}${r.hospitalS !== null ? `  collapsed at ${r.hospitalS.toFixed(0)}s, back at ${r.recoveredS.toFixed(0)}s` : ''}`);
}
console.log('Pacing tests passed');

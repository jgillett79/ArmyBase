// Brief 09 daily routine evidence. Run with: node tests/routine.cjs
// (TRACE=1 prints each soldier's scheduled task -> station -> queue/use ->
// result chain for the four-soldier day.)
//
// Covers the brief's required evidence headlessly:
//   - four soldiers complete one full day on the starter base
//   - six soldiers hit a capacity shortage with a readable summary, and an
//     upgrade measurably improves completions
//   - deliberately scarce stalls (configured) make some miss a hygiene window
//   - gains only during use (no strength while walking to the weights)
//   - kitchen charges once, seats correctly, releases on recall, resumes
//     after reload; reload mid-queue / mid-service / during midnight sleep
//   - nobody teleports; every soldier always has a destination or a reason
//   - applicants stay outside until admitted
//   - offline catch-up agrees with live play within tolerance
const assert = require('node:assert/strict');
const { loadGame } = require('./lib/sandbox.cjs');

const DAY_S = 1200; // real seconds per game day at 1x

// A base with the starter facilities plus a range, weights and a rec room,
// `n` soldiers placed at the parade-ground node, clock at 21:30 on day 0.
function base(n, { seed = 3, setup = '' } = {}) {
  const g = loadGame({ seed });
  g.run(`var state = new GameState(); state.cash = 5000; state.food = 300;
    state.shootingRange.level = 1; state.weightRoom.level = 1; state.recRoom.level = 1;
    state.chapter.done = true; state.chapter.introDispatched = true; state.chapter.dismissed = true;
    state.gameClockMs = 21.5 * 3600000; ${setup}
    for (let i = 0; i < ${n}; i++) { const p = worldNodePosition('t4'); const u = new Unit({ x: p.x + i * 4, y: p.y, isCivilian: false }); u.name = 'Soldier ' + i; state.units.push(u); }
    state.assignBeds(); for (const u of state.units) state.rejoinRoutine(u);`);
  return g;
}

const summary = (g, day = 1) => g.run(`state.dailySummary(${day})`);
const line = (s, id) => s.lines.find(l => l.blockId === id);
const unitResults = (g, day = 1) => g.run(`(() => { const out = {}; for (const [id, r] of Object.entries(state.routineRecords)) if (r.day === ${day}) out[r.blockId] = r.units; return out; })()`);

// Runs a day while checking per-tick invariants. Returns observations.
function playDay(g, seconds = DAY_S + 30, dt = 0.1, extraCheck = null) {
  const obs = { maxJump: 0, strengthOutsideUse: 0, accuracyOutsideUse: 0, noDestination: [], wander: 0 };
  let prev = g.run('state.units.map(u => ({ id: u.id, x: u.x, y: u.y, s: u.strength, a: u.accuracy, using: false }))');
  for (let t = 0; t < seconds; t += dt) {
    g.clock.now += dt * 1000;
    g.sandbox.state.tick(dt, g.clock.now);
    const now = g.run(`state.units.map(u => ({ id: u.id, x: u.x, y: u.y, s: u.strength, a: u.accuracy, speed: u.speed,
      stage: u.routine && u.routine.stage, using: !!(u.routine && u.routine.stage === 'use' && u.slot), slotType: u.slot && u.slot.type,
      moving: u.path.length > 0 || Math.hypot(u.targetX - u.x, u.targetY - u.y) > 1, reason: u.routine && u.routine.reason, status: u.status,
      muster: u.musterSpot, queued: !!(u.routine && u.routine.queueKey) }))`);
    for (const u of now) {
      const p = prev.find(q => q.id === u.id);
      if (!p) continue;
      const jump = Math.hypot(u.x - p.x, u.y - p.y) - u.speed * dt;
      obs.maxJump = Math.max(obs.maxJump, jump);
      // In use at the start or the end of the tick (a bout can finish inside it).
      const usedType = type => (u.using && u.slotType === type) || (p.using && p.slotType === type);
      if (u.s !== p.s && !usedType('barbell') && !usedType('drill_post')) obs.strengthOutsideUse++;
      if (u.a !== p.a && !usedType('range_lane')) obs.accuracyOutsideUse++;
      if (u.status === 'on_mission' || u.status === 'hospital') continue;
      // A destination: walking somewhere, using, queued, or a parade-ground spot with a reason.
      const placed = u.moving || u.using || u.queued || (u.muster && u.reason) || (u.stage === 'standby');
      if (!placed) obs.noDestination.push({ id: u.id, stage: u.stage, t: Math.round(t) });
    }
    if (extraCheck) extraCheck(now, t);
    prev = now;
  }
  return obs;
}

// ---------------------------------------------------------------------------
// 1. Four soldiers, starter base + range/weights/rec: one full day.
// ---------------------------------------------------------------------------
{
  const g = base(4);
  const obs = playDay(g);
  const s = summary(g);
  for (const l of s.lines) console.log(`  4 soldiers | ${l.text}`);
  for (const id of ['bathroom', 'breakfast', 'lunch', 'dinner', 'shower', 'recreation']) {
    assert.equal(line(s, id).completed, 4, `four soldiers complete ${id}: ${line(s, id).text}`);
  }
  const results = unitResults(g);
  for (const id of ['morning_training', 'afternoon_training']) {
    for (const [unitId, r] of Object.entries(results[id])) assert.ok(r.minutes >= 150, `${unitId} trained ${r.minutes} of 240 min in ${id}`);
  }
  // Sleep of day 1 (22:00 -> 06:00) is still running; day 0's was entered at 21:30.
  assert.ok(Object.values(unitResults(g, 0).sleep).every(r => r.result === 'completed'), 'everyone slept in their own bunk');
  assert.ok(obs.maxJump < 1.5, `no teleport (worst extra jump ${obs.maxJump.toFixed(2)} px)`);
  assert.equal(obs.strengthOutsideUse, 0, 'strength only changes while using strength equipment');
  assert.equal(obs.accuracyOutsideUse, 0, 'accuracy only changes while using a firing point');
  assert.deepEqual(obs.noDestination.slice(0, 3), [], 'every soldier always has a destination, queue place or reason');
  // Exactly one meal charged per soldier per meal window.
  const served = g.run(`state.activityLog.filter(e => e.event === 'served').map(e => e.unitId + '|' + e.window)`);
  assert.equal(new Set(served).size, served.length, 'never served twice in one window');
  assert.equal(served.filter(k => k.includes('|1:')).length, 12, 'twelve meals for four soldiers on day 1');
  // Own bed, never shared.
  const beds = g.run('state.units.map(u => u.bedId)');
  assert.equal(new Set(beds).size, 4);
  const energy = g.run('state.units.map(u => Math.round(u.energy))');
  assert.ok(energy.every(e => e > 60), `energy holds up over a day (${energy})`);
  if (process.env.TRACE) {
    const trace = g.run(`state.activityLog.filter(e => ['window','queue','use_start','use_end','served','muster','missed','partial','completed','grace','admitted_from_queue'].includes(e.event))
      .map(e => [formatGameMinute(e.clock / 60000), e.name, e.event, e.station || e.group || e.window || '', e.reason || ''].join(' '))`);
    console.log(trace.join('\n'));
  }
  console.log('four-soldier day: all windows completed');
}

// ---------------------------------------------------------------------------
// 2. Six soldiers on the starter base: the serving counter is the bottleneck;
//    upgrading the Mess Hall to level 2 fixes meals, then showers show up.
// ---------------------------------------------------------------------------
{
  const six = base(6);
  playDay(six);
  const s = summary(six);
  for (const l of s.lines) console.log(`  6 soldiers | ${l.text}`);
  const meals = ['breakfast', 'lunch', 'dinner'].reduce((sum, id) => sum + line(s, id).completed, 0);
  assert.ok(meals < 18, `six soldiers on one counter miss meals (${meals}/18)`);
  assert.match(line(s, 'lunch').text, /serving counter was the bottleneck/);
  assert.match(s.advice, /Upgrade the Mess Hall/);
  // Every missed entry carries a reason, recorded once.
  for (const [blockId, units] of Object.entries(unitResults(six))) {
    for (const r of Object.values(units)) if (r.result === 'missed') assert.ok(r.reason, `${blockId} miss has a reason`);
  }

  const upgraded = base(6, { setup: 'state.messHall.level = 2;' });
  playDay(upgraded);
  const s2 = summary(upgraded);
  const meals2 = ['breakfast', 'lunch', 'dinner'].reduce((sum, id) => sum + line(s2, id).completed, 0);
  for (const l of s2.lines) console.log(`  6 + Mess L2 | ${l.text}`);
  assert.ok(meals2 > meals, `a second serving counter improves meals (${meals} -> ${meals2})`);
  assert.equal(meals2, 18);
  console.log(`six soldiers: meals ${meals}/18 -> ${meals2}/18 with Mess Hall level 2`);
}

// ---------------------------------------------------------------------------
// 3. Deliberately scarce stalls (a configured one-toilet, one-shower block —
//    not a real game level): a visible queue forms and some soldiers miss a
//    hygiene window; restoring the starter's two stalls improves it.
// ---------------------------------------------------------------------------
{
  const scarce = base(6, { setup: 'FACILITY_STATIONS.showers.toilet = [0, 1, 1, 1]; FACILITY_STATIONS.showers.shower = [0, 1, 1, 1]; state.messHall.level = 2;' });
  let longestQueue = 0;
  playDay(scarce, DAY_S + 30, 0.1, () => {
    longestQueue = Math.max(longestQueue, scarce.run(`(state.queues.get('showers:toilet') || []).length`));
  });
  const s = summary(scarce);
  const hygiene = line(s, 'bathroom').completed + line(s, 'shower').completed;
  console.log(`  scarce stalls | ${line(s, 'bathroom').text}`);
  console.log(`  scarce stalls | ${line(s, 'shower').text}`);
  assert.ok(longestQueue >= 3, `a visible toilet queue forms (longest ${longestQueue})`);
  assert.ok(hygiene < 12, `some miss a hygiene window with one toilet and one shower (${hygiene}/12)`);
  assert.match(s.advice, /Upgrade the Wash Block/);
  const missedHygiene = Object.values(unitResults(scarce).shower).filter(r => r.result !== 'completed');
  assert.ok(missedHygiene.length > 0 && missedHygiene.every(r => r.reason), 'missed showers carry a reason');
  // Missing a shower costs hygiene but never hospitalises anyone.
  assert.equal(scarce.run(`state.units.filter(u => u.status === 'hospital').length`), 0);

  const roomy = base(6, { setup: 'state.messHall.level = 2;' });
  playDay(roomy);
  const s2 = summary(roomy);
  const hygiene2 = line(s2, 'bathroom').completed + line(s2, 'shower').completed;
  assert.ok(hygiene2 > hygiene, `two stalls each improve hygiene completions (${hygiene} -> ${hygiene2})`);
  console.log(`scarce stalls: hygiene ${hygiene}/12 -> ${hygiene2}/12 with the starter block`);
}

// ---------------------------------------------------------------------------
// 4. Kitchen: charge once, seat reserved at serving, release on recall,
//    resume after reload.
// ---------------------------------------------------------------------------
{
  const g = base(2, { setup: 'state.gameClockMs = 6.9 * 3600000;' });
  const food0 = g.run('state.food');
  // Advance until soldier 0 has been served and is carrying the tray.
  const until = (pred, limit) => { for (let t = 0; t < limit; t += 0.1) { if (g.run(pred)) return true; g.advance(0.1); } return false; };
  assert.ok(until(`state.units[0].routine.meal && state.units[0].routine.step === 'seat'`, 200), 'soldier 0 collects a tray');
  assert.equal(g.run('state.food'), food0 - g.run('ROUTINE_NEEDS.mealFood') * g.run(`state.activityLog.filter(e => e.event === 'served').length`), 'food charged once per serving');
  const seat = g.run('state.units[0].routine.meal.seatId');
  assert.equal(g.run(`state.seatHolders.get('${seat}')`), g.run('state.units[0].id'), 'the seat was reserved at serving start');
  // Reload while carrying the tray: no second charge, same seat, then eats.
  g.run(`state.save(); var data = JSON.parse(localStorage.getItem(SAVE_KEY)); data.lastTick = Date.now(); state = GameState.fromSaveData(normalizeSaveData(data).data, Date.now());`);
  const foodAfterReload = g.run('state.food');
  assert.ok(until(`state.units[0].routine.log.meal === 'done'`, 200), 'meal resumes and is eaten after reload');
  assert.equal(g.run(`state.activityLog.filter(e => e.event === 'served' && e.unitId === state.units[0].id).length`), 0, 'no new charge after reload');
  assert.ok(g.run('state.food') <= foodAfterReload);
  // Recall mid-meal: soldier 1 is served, then dispatched — seat and counter freed.
  const g2 = base(1, { setup: 'state.gameClockMs = 6.95 * 3600000;' });
  const until2 = (pred, limit) => { for (let t = 0; t < limit; t += 0.1) { if (g2.run(pred)) return true; g2.advance(0.1); } return false; };
  assert.ok(until2(`state.units[0].routine.stage === 'use' && state.units[0].slot.type === 'seat'`, 200));
  assert.equal(g2.run(`state.dispatchMission('local_patrol', [state.units[0].id])`), false, 'eating needs an explicit recall');
  assert.equal(g2.run(`state.dispatchMission('local_patrol', [state.units[0].id], { recall: true })`), true);
  assert.equal(g2.run('state.seatHolders.size + state.stationOccupants.size'), 0, 'recall releases seat and station');
  assert.equal(g2.run(`Object.values(state.routineRecords[state.day + ':breakfast'].units)[0].result`), 'excluded', 'away soldiers are excluded from demand');
  console.log('kitchen: one charge, reserved seat, release on recall, resume after reload');
}

// ---------------------------------------------------------------------------
// 5. Reloads: mid-queue (order kept), mid-service (progress kept), during
//    midnight sleep (stays in bed, wakes at 06:00).
// ---------------------------------------------------------------------------
{
  const g = base(5, { setup: 'state.gameClockMs = 6 * 3600000 - 1000;' });
  const until = (pred, limit) => { for (let t = 0; t < limit; t += 0.1) { if (g.run(pred)) return true; g.advance(0.1); } return false; };
  assert.ok(until(`(state.queues.get('showers:toilet') || []).length >= 2 && state.units.some(u => u.routine.stage === 'use' && u.slot.type === 'toilet' && u.routine.progress > 2)`, 400));
  const before = g.run(`({ queue: state.queues.get('showers:toilet').slice(), using: state.units.filter(u => u.routine.stage === 'use').map(u => [u.id, u.slot.id, Math.round(u.routine.progress * 10)]) })`);
  g.run(`state.save(); var data = JSON.parse(localStorage.getItem(SAVE_KEY)); data.lastTick = Date.now(); state = GameState.fromSaveData(normalizeSaveData(data).data, Date.now());`);
  const after = g.run(`({ queue: (state.queues.get('showers:toilet') || []).slice(), using: state.units.filter(u => u.routine.stage === 'use').map(u => [u.id, u.slot.id, Math.round(u.routine.progress * 10)]) })`);
  assert.deepEqual(after.queue, before.queue, 'queue order survives reload');
  assert.deepEqual(after.using, before.using, 'mid-service soldiers keep their station and progress');
  assert.equal(g.run('new Set(state.units.map(u => u.slot && u.slot.id).filter(Boolean)).size'), g.run('state.units.filter(u => u.slot).length'), 'no double booking');

  const night = base(3, { setup: 'state.gameClockMs = 23.5 * 3600000;' });
  night.advance(60); // walk to bed and lie down
  const night2 = night;
  night2.clock.now += 0;
  night2.run(`state.gameClockMs = 0.5 * 3600000; state.day = 1;`);
  night2.advance(1);
  assert.ok(night2.run(`state.units.every(u => u.routine.stage === 'use' && u.slot.type === 'bed')`), 'asleep after midnight');
  night2.run(`state.save(); var data = JSON.parse(localStorage.getItem(SAVE_KEY)); data.lastTick = Date.now(); state = GameState.fromSaveData(normalizeSaveData(data).data, Date.now());`);
  assert.ok(night2.run(`state.units.every(u => u.routine.stage === 'use' && u.slot && u.slot.type === 'bed' && u.routine.window === '0:sleep')`), 'reload during midnight sleep keeps everyone in bed, same window');
  console.log('reload: queue order, service progress and midnight sleep preserved');
}

// ---------------------------------------------------------------------------
// 6. Offline catch-up vs live play: same base, one game day, compared per
//    window. Tolerance: ±1 completion per window (walk speeds integrate a
//    1 s step instead of 0.1 s, so arrivals can shift by ~1 game minute).
// ---------------------------------------------------------------------------
{
  const live = base(4, { seed: 7 });
  live.advance(DAY_S, 0.1);
  const liveS = summary(live);
  const off = base(4, { seed: 7 });
  off.run(`state.save(); var data = JSON.parse(localStorage.getItem(SAVE_KEY)); data.lastTick = Date.now();`);
  off.clock.now += DAY_S * 1000;
  const started = Date.now();
  off.run(`state = GameState.fromSaveData(normalizeSaveData(data).data, Date.now());`);
  const ms = Date.now() - started;
  const offS = summary(off);
  for (const l of liveS.lines) {
    const o = line(offS, l.blockId);
    assert.ok(o && Math.abs(o.completed - l.completed) <= 1, `${l.blockId}: live ${l.completed} vs offline ${o && o.completed}`);
  }
  const statsLive = live.run('state.units.map(u => u.accuracy + u.strength)'), statsOff = off.run('state.units.map(u => u.accuracy + u.strength)');
  statsLive.forEach((v, i) => assert.ok(Math.abs(v - statsOff[i]) < 1, `training totals agree (${v.toFixed(2)} vs ${statsOff[i].toFixed(2)})`));
  // The 24 h cap stays bounded (86,400 one-second steps).
  const big = base(6, { seed: 7 });
  big.run(`state.save(); var data = JSON.parse(localStorage.getItem(SAVE_KEY)); data.lastTick = Date.now();`);
  big.clock.now += 24 * 3600 * 1000;
  const t0 = Date.now();
  big.run(`state = GameState.fromSaveData(normalizeSaveData(data).data, Date.now());`);
  const bigMs = Date.now() - t0;
  assert.ok(bigMs < 20000, `24 h offline catch-up for six soldiers took ${bigMs} ms`);
  console.log(`offline catch-up matches live play (1 day: ${ms} ms; 24 h cap, 6 soldiers: ${bigMs} ms)`);
}

// ---------------------------------------------------------------------------
// 7. Perimeter admission: applicants arrive, queue and are served outside;
//    only the one at the window can be admitted; nobody unadmitted crosses.
// ---------------------------------------------------------------------------
{
  const g = loadGame({ seed: 5 });
  g.run(`var state = new GameState(); state.cash = 1000; state.lastCivilianSpawn = 0;`);
  let crossed = 0, maxLine = 0;
  for (let t = 0; t < 120; t += 0.1) {
    g.clock.now += 100;
    g.run(`if (Date.now() - state.lastCivilianSpawn > 4000) { state.spawnCivilianIfRoom(); state.lastCivilianSpawn = Date.now(); } state.tick(0.1, Date.now());`);
    crossed += g.run(`state.units.filter(u => u.isCivilian && !u.admitted && u.x >= WORLD.perimeter.barrierX).length`);
    maxLine = Math.max(maxLine, g.run('state.applicantLine.length'));
  }
  assert.equal(crossed, 0, 'no unadmitted applicant ever reaches the barrier line');
  assert.equal(maxLine, 1 + g.run('WORLD.perimeter.queue.length'), 'the outside line fills to its bound and no further');
  assert.equal(g.run('state.units.filter(u => u.isCivilian).length'), maxLine, 'overflow arrivals are not spawned');
  const second = g.run('state.applicantLine[1]');
  assert.equal(g.run(`state.recruit('${second}')`), false, 'a queued applicant cannot be admitted before reaching the window');
  assert.equal(g.run(`state.assignToBuilding('${second}', 'shooting_range')`), false, 'no soldier action on an applicant');
  const first = g.run('state.applicantAtWindow().id');
  assert.ok(g.run(`Math.hypot(state.applicantAtWindow().x - WORLD.perimeter.service.x, state.applicantAtWindow().y - WORLD.perimeter.service.y) < 1`), 'served at the outside window');
  assert.equal(g.run(`state.recruit('${first}')`), true);
  g.advance(60);
  assert.ok(g.run(`(() => { const u = state.units.find(u => u.id === '${first}'); return u.x > WORLD.perimeter.barrierX; })()`), 'the admitted recruit crosses the barrier');
  // The line moved up: the next applicant reaches the window.
  assert.ok(g.run('!!state.applicantAtWindow()'), 'the next applicant steps up to the window');
  const rejected = g.run('state.applicantAtWindow().id');
  assert.equal(g.run(`state.rejectApplicant('${rejected}')`), true);
  g.advance(15);
  assert.equal(g.run(`state.units.some(u => u.id === '${rejected}')`), false, 'a rejected applicant walks back down the road and leaves');
  console.log('perimeter: applicants served outside, bounded line, only admitted recruits cross');
}

console.log('Routine tests passed');

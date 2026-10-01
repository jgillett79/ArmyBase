// First soldier chapter (brief 08). Run with: node tests/chapter.cjs
// Headless, with a controllable clock (Date.now) so real-time timers —
// the intro patrol, recovery — can be stepped exactly.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

let now = 1_800_000_000_000;
const RealDate = Date;
class ClockDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : [Math.floor(now)])); }
  static now() { return Math.floor(now); } // whole ms, like the real clock (ids embed it)
}
const storage = new Map();
const sandbox = vm.createContext({
  console, Math: Object.create(Math), Date: ClockDate,
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
});
for (const file of ['utils', 'world', 'asset-manifest', 'unit', 'building', 'mission', 'routine', 'state', 'daily', 'save']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), sandbox);
}
const run = source => vm.runInContext(source, sandbox);
// Brief 09: only the applicant standing at the guardhouse window can be admitted.
run('var atWindow = (st, u) => { st.applicantLine = [u.id, ...st.applicantLine.filter(id => id !== u.id)]; u.serviceSince = Date.now(); return st; };');
const withRandom = (value, fn) => { const saved = sandbox.Math.random; sandbox.Math.random = () => value; try { return fn(); } finally { sandbox.Math.random = saved; } };

// Advance real time in 1/30 s ticks (like the browser loop), spawning visitors.
run(`var advance = (seconds, state = s) => { for (let t = 0; t < seconds; t += 1/30) {
  now_(1000/30); if (Date.now() - state.lastCivilianSpawn > CIVILIAN_SPAWN_INTERVAL_MS) { state.spawnCivilianIfRoom(); state.lastCivilianSpawn = Date.now(); }
  state.tick(1/30, Date.now()); } };
var until = (test, seconds, state = s) => { for (let t = 0; t < seconds; t += 1/30) { if (test()) return true; advance(1/30, state); } return test(); };`);
sandbox.now_ = ms => { now += ms; };

// ---------------------------------------------------------------------------
// 1. Stage progression through the whole chapter, with the first soldier's
//    id persisting across reloads at every step.
run('var s = new GameState(); s.lastCivilianSpawn = 0;');
assert.equal(run('s.chapterStage().id'), 'meet');
assert.equal(run('s.guidanceActive && s.onboarding'), true);
// Brief 09: visitors are served at the guardhouse's outside window.
assert.ok(run(`until(() => { const v = s.chapterStage().visitor; return v && s.applicantAtWindow() === v; }, 60)`), 'a visitor reaches the guardhouse window');
run('var visitor = s.chapterStage().visitor; atWindow(s, visitor).recruit(visitor.id);');
assert.equal(run('s.chapter.firstSoldierId'), run('visitor.id'));
assert.equal(run('s.chapter.targetAccuracy'), run('Math.floor(visitor.accuracy) + INTRO_READINESS_GAIN'));
assert.equal(run('s.chapterStage().id'), 'admit');

// Reload helper: save, then load a fresh state from storage at the same time.
run('var reload = () => { s.save(); s = GameState.load(); return s; };');
run('reload()');
assert.equal(run('s.chapter.firstSoldierId'), run('visitor.id'), 'first soldier id survives reload');
assert.ok(run(`until(() => s.firstSoldier.outfit === 'uniform', 90)`), 'uniform at the barracks');
assert.equal(run('s.chapterStage().id'), 'build_range', 'the range must be built explicitly, not skipped');
assert.equal(run(`s.constructAt('shootingRange', s.shootingRange.zoneId)`), true, 'starting cash covers recruit + range');
assert.equal(run('s.chapterStage().id'), 'train');

// Readiness gates the intro patrol with a visible reason.
run('var first = s.firstSoldier;');
assert.match(run(`s.deploymentCheck(first, missionTierById('local_patrol')).reason`), /^Accuracy \d+ \/ \d+ for the first patrol$/);
assert.equal(run(`s.dispatchMission('local_patrol', [first.id], { recall: true })`), false);

// Brief 09 removed the brief 08 first-soldier range drill: +3 accuracy is
// trained at the normal range rate, only in the timetable's training
// blocks. At 18:00 (recreation) the first soldier relaxes like anyone.
assert.equal(run('INTRO_READINESS_GAIN'), 3);
assert.equal(run('s.chapter.targetAccuracy - Math.floor(first.accuracy)'), 3);
assert.equal(run('typeof FIRST_SOLDIER_DRILL'), 'undefined', 'the out-of-hours drill is gone');
run(`s.gameClockMs = 18 * 3600000; s.food = 500; first.energy = 100; s.assignToBuilding(first.id, 'shooting_range'); s.tick(0.05, Date.now());`);
assert.equal(run('first.routine.task'), 'recreation', 'the timetable decides: recreation at 18:00');
run('var before = first.accuracy; advance(50);'); // one game hour
assert.equal(run('first.accuracy'), run('before'), 'no range training outside the training blocks');
run(`s.gameClockMs = 8 * 3600000; s.tick(0.05, Date.now());`);
assert.ok(run(`until(() => first.routine.stage === 'use' && first.slot.type === 'range_lane', 60)`), 'trains at the range in the morning block');
run('before = first.accuracy; advance(50);');
const hourGain = run('first.accuracy - before');
assert.ok(hourGain > 0.4 && hourGain <= 0.5 + 1e-9, `range gain per game hour is the normal 0.5 (was ${hourGain.toFixed(2)})`);

// 2. The deployment trap: an assigned trainee can go only via explicit recall.
assert.ok(run(`until(() => s.chapterStage().id === 'patrol', 400)`), 'reaches readiness in the training blocks');
assert.ok(run(`s.events.some(e => e.text === first.name + ' qualified for Local Patrol')`), 'readiness is announced once');
assert.notEqual(run('first.status'), 'idle', 'busy, so dispatch needs a recall');
const check = run(`s.deploymentCheck(first, missionTierById('local_patrol'))`);
assert.deepEqual({ ok: check.ok, recall: check.recall }, { ok: true, recall: true }, 'eligible, but needs a recall');
assert.equal(run(`s.dispatchMission('local_patrol', [first.id])`), false, 'no silent recall');
assert.equal(run('first.status'), 'training');

// The intro is solo.
run(`var buddy = new Unit({ x: first.x, y: first.y, isCivilian: false }); buddy.outfit = 'uniform'; s.units.push(buddy);`);
assert.equal(run(`s.dispatchMission('local_patrol', [first.id, buddy.id], { recall: true })`), false, 'intro patrol is solo');

const slotBefore = run('first.slot.slotId');
run(`var sent = s.dispatchMission('local_patrol', [first.id], { recall: true });`);
assert.equal(run('sent'), true);
assert.equal(run('first.missionTierId'), 'intro_patrol');
assert.equal(run('first.missionReturnAt - Date.now()'), 75000, 'intro patrol is 75 s real time');
assert.equal(run('first.assignedBuildingId'), 'shooting_range', 'recall keeps the training assignment');
assert.equal(run(`[...s.stationOccupants.values()].includes(first.id)`), false, 'range slot released');
assert.equal(run(`s.stationOccupants.has('${slotBefore}')`), false);
assert.ok(run(`s.activityLog.some(e => e.unitId === first.id && e.event === 'recall')`), 'recall is logged');
assert.equal(run('s.chapter.introDispatched'), true);
assert.equal(run('s.chapterStage().id'), 'away');
assert.equal(run('s.onboarding'), true, 'extras stay folded while away');
assert.equal(run(`s.dispatchMission('local_patrol', [first.id], { recall: true })`), false, 'cannot send twice');

// 3. Exactly-once return across a reload taken mid-patrol and after return.
run('reload(); first = s.firstSoldier;');
assert.equal(run('s.chapterStage().id'), 'away', 'reload mid-patrol resumes');
const cashBefore = run('s.cash');
run('now_(76000)');
withRandom(0.9999, () => run('s.catchUp(76, Date.now())')); // an unlucky roll must not matter: guaranteed
assert.equal(run('first.status === "hospital"'), false, 'guaranteed intro never fails');
const report = run('s.missionLog.find(e => e.id === s.chapter.introReportId)');
assert.equal(report.intro, true);
assert.equal(report.succeeded, true);
assert.equal(report.cash, 70);
assert.equal(report.xp, 60);
assert.equal(report.seen, false);
assert.ok(Math.abs(run('s.cash') - cashBefore - 70) < 3, 'cash matches the report (plus idle trickle)');
assert.equal(run('first.serviceTag'), 'First In');
assert.match(run('first.serviceRecord'), /first soldier/);
assert.equal(run('s.chapterStage().id'), 'debrief');
assert.equal(run('s.onboarding'), false, 'base opens up once the patrol returns');

// Close the tab before reading the report: it surfaces once after reload.
run('reload(); first = s.firstSoldier;');
const cashReloaded = run('s.cash');
assert.equal(run('s.unseenReports().length'), 1);
assert.equal(run('s.missionLog.filter(e => e.intro).length'), 1, 'not re-resolved on reload');
assert.equal(run('s.chapterStage().id'), 'debrief');
assert.equal(run(`s.markReportSeen(s.chapter.introReportId)`), true);
assert.equal(run(`s.markReportSeen(s.chapter.introReportId)`), false, 'reading it twice does nothing');
run('reload(); first = s.firstSoldier;');
assert.equal(run('s.unseenReports().length'), 0, 'seen stays seen');
assert.ok(run('s.cash') - cashReloaded < 3, 'no reward on reload');
assert.equal(run('s.chapterStage().id'), 'improve');
const advice = run('s.nextConstructionAdvice()');
// Brief 09: bunks, kitchen and wash block are starter facilities, so the
// next useful build is the Rec Room (recreation has nowhere to happen yet).
assert.equal(advice.key, 'recRoom', 'the Rec Room is the useful next build');
run('s.cash = Math.max(s.cash, 100);');
assert.equal(run(`s.constructAt('recRoom', s.recRoom.zoneId)`), true);
assert.equal(run('s.chapter.done'), true);
assert.equal(run('s.chapterStage().id'), 'complete');
assert.equal(run('s.guidanceActive'), false);

// 4. After the intro, Local Patrol uses the normal rules and rolls.
run(`first.status = 'idle'; first.energy = 100; s.routeForStatus(first);`);
assert.equal(run(`s.dispatchMission('local_patrol', [first.id], { recall: true })`), true);
assert.equal(run('first.missionTierId'), 'local_patrol');
assert.equal(run('first.missionReturnAt - Date.now()'), 3 * 60 * 1000, 'regular 3-minute timer');
run('now_(181000)');
withRandom(0.9999, () => run('s.tick(0.05, Date.now())'));
assert.equal(run('first.status'), 'hospital', 'a normal roll can fail');
// 5. Recovery: 5 minutes for Local Patrol, never 23 hours.
assert.equal(run('first.hospitalUntil - (Date.now() - 1000)') <= 5 * 60 * 1000 + 1000, true);
assert.equal(run('first.hospitalReason'), 'mission');
const failed = run('s.missionLog[0]');
assert.equal(failed.succeeded, false);
assert.equal(failed.cash, 0);
assert.equal(failed.recoveryUntil, run('first.hospitalUntil'));
assert.equal(run('first.serviceTag'), 'First In', 'identity kept through failure');
run('now_(5 * 60 * 1000)'); run('s.tick(0.05, Date.now())');
assert.notEqual(run('first.status'), 'hospital', 'back after five minutes');

// Recovery per tier and for neglect.
assert.equal(run('JSON.stringify(MISSION_TIERS.map(t => t.recoveryMs / 60000))'), '[5,30,120,240]');
assert.ok(run('NEGLECT_RECOVERY_MS <= Math.min(...MISSION_TIERS.map(t => t.recoveryMs))'),
  'neglect is never harsher than mission failure (CLAUDE.md)');
run(`var tired = new Unit({ x: first.x, y: first.y, isCivilian: false }); tired.outfit = 'uniform'; s.units.push(tired); tired.energy = 0.001;`);
run('s.tick(0.5, Date.now())');
assert.equal(run('tired.status'), 'hospital');
assert.equal(run('tired.hospitalUntil - Date.now()'), 5 * 60 * 1000);
assert.equal(run('tired.hospitalReason'), 'energy');

// 6. Ineligibility reasons, each named.
run(`var t2 = missionTierById('supply_run'); var probe = new Unit({ x: 0, y: 0, isCivilian: false }); probe.outfit = 'uniform';`);
assert.equal(run('s.deploymentCheck(probe, t2).reason'), 'Needs level 3 (now 1)');
run('probe.level = 3; probe.strength = probe.accuracy = probe.endurance = 10;');
assert.equal(run('s.deploymentCheck(probe, t2).reason'), 'Needs stat average 40 (now 10)');
run('probe.strength = probe.accuracy = probe.endurance = 60; probe.energy = 10;');
assert.equal(run('s.deploymentCheck(probe, t2).reason'), 'Too tired — needs food and rest first');
run('probe.energy = 100; probe.status = UNIT_STATUS.HOSPITAL;');
assert.equal(run('s.deploymentCheck(probe, t2).reason'), 'Recovering at the aid station');
run('probe.status = UNIT_STATUS.ON_MISSION;');
assert.equal(run('s.deploymentCheck(probe, t2).reason'), 'Away on a mission');
run('probe.status = UNIT_STATUS.RECRUITING;');
assert.equal(run('s.deploymentCheck(probe, t2).reason'), 'Still entering the base');
run('probe.isCivilian = true; probe.status = UNIT_STATUS.CIVILIAN_APPROACHING;');
assert.equal(run('s.deploymentCheck(probe, t2).reason'), 'Visitors must be admitted first');
run('probe.isCivilian = false; probe.status = UNIT_STATUS.IDLE;');
assert.equal(run('JSON.stringify(s.deploymentCheck(probe, t2))'), '{"ok":true,"recall":false,"reason":""}');

// ---------------------------------------------------------------------------
// 7. Skip guidance hides the card but keeps the intro and its reward.
run(`var k = new GameState(); var kid = new Unit({ x: 100, y: 100, isCivilian: true }); k.units.push(kid); atWindow(k, kid).recruit(kid.id);
  kid.outfit = 'uniform'; kid.status = 'idle'; k.dismissGuidance();`);
assert.equal(run('k.guidanceActive'), false);
assert.equal(run('k.onboarding'), false, 'skipping opens the base up');
assert.equal(run('k.introAvailable'), true, 'the intro patrol is still there');
run('kid.accuracy = k.chapter.targetAccuracy;');
assert.equal(run(`k.dispatchMission('local_patrol', [kid.id], { recall: true })`), true);
assert.equal(run('kid.missionTierId'), 'intro_patrol');
run('k.resumeGuidance();');
assert.equal(run('k.chapterStage().id'), 'away');

// 8. Old saves: an established base is never pushed into onboarding; an
//    empty one starts the chapter. Imported backups go through the same path.
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'v1-save.json'), 'utf8'));
const migrated = run(`normalizeSaveData(${JSON.stringify(fixture)}).data`);
assert.equal(migrated.chapter.done, true);
assert.equal(migrated.chapter.dismissed, true);
assert.equal(migrated.chapter.introDispatched, true, 'no intro patrol for an existing roster');
run(`var old = GameState.fromSaveData(normalizeSaveData(${JSON.stringify(fixture)}).data);`);
assert.equal(run('old.chapterStage().id'), 'complete');
assert.equal(run('old.guidanceActive || old.onboarding'), false);
run(`var v2NoChapter = new GameState().serialize(); delete v2NoChapter.chapter;`);
assert.equal(run('normalizeSaveData(v2NoChapter).data.chapter.done'), false, 'an empty pre-brief-08 save starts the chapter');
run(`var established = new GameState(); established.units.push(new Unit({x:100,y:100,isCivilian:false}));
  var estData = established.serialize(); delete estData.chapter;`);
assert.equal(run('normalizeSaveData(estData).data.chapter.done'), true);
run(`var orphan = new GameState().serialize(); orphan.chapter.firstSoldierId = 'unit_missing';`);
assert.equal(run('normalizeSaveData(orphan).data.chapter.done'), true, 'a chapter following nobody is closed, not refused');
assert.throws(() => run(`var bad = new GameState().serialize(); bad.chapter.done = 'yes'; normalizeSaveData(bad);`), /Chapter done/);
// Old mission-log entries (no id/unitId/seen) are history, never unread reports.
run(`var legacyLog = new GameState(); legacyLog.missionLog = [{ name: 'Ada Stone', tier: 'Local Patrol', succeeded: true, xp: 60, at: 1 }];`);
assert.equal(run('legacyLog.unseenReports().length'), 0);

// ---------------------------------------------------------------------------
// 8b. Customization: callsign and accent persist, migrate and reach the report.
run(`var c = new GameState(); var cv = new Unit({ x: 100, y: 100, isCivilian: true }); c.units.push(cv); atWindow(c, cv).recruit(cv.id);
  cv.outfit = 'uniform'; cv.status = 'idle';`);
assert.equal(run('cv.soldierVariant'), 1, 'the first soldier wears the body that has a portrait');
assert.equal(run('cv.callsign'), null, 'no callsign by default');
assert.ok(run('!!accentById(cv.accent)'), 'a default accent from the shared palette');
assert.equal(run(`c.setCallsign(cv.id, ' Iron  Kite ')`), true);
assert.equal(run('cv.callsign'), 'Iron Kite');
assert.equal(run(`c.setAccent(cv.id, 'purple')`), false, 'only palette accents');
assert.equal(run(`c.setAccent(cv.id, 'blue')`), true);
assert.equal(run(`c.setCallsign('unit_nobody', 'X')`), false);
run(`c.save(); var c2 = GameState.load(); var cv2 = c2.units.find(u => u.id === cv.id);`);
assert.equal(run('cv2.callsign'), 'Iron Kite', 'callsign survives reload');
assert.equal(run('cv2.accent'), 'blue', 'accent survives reload');
assert.equal(run('cv2.fieldName'), `${run("cv.name.split(' ')[0]")} "Iron Kite"`);
run(`cv2.accuracy = c2.chapter.targetAccuracy; cv2.energy = 100; c2.dispatchMission('local_patrol', [cv2.id], { recall: true });
  cv2.missionReturnAt = Date.now() - 1; c2.tick(0.05, Date.now()); var rep = c2.missionLog[0];`);
assert.equal(run('rep.callsign'), 'Iron Kite', 'the report carries the callsign');
assert.equal(run('rep.accent'), 'blue', 'the report carries the accent');
// Old and hand-edited saves.
const oldData = run(`normalizeSaveData(${JSON.stringify(fixture)}).data`);
assert.ok(oldData.units.every(u => u.callsign === null && ['red', 'blue', 'gold', 'white'].includes(u.accent)), 'v1 soldiers get defaults');
run(`var edited = c.serialize(); edited.units[0].callsign = 'A very long callsign indeed'; edited.units[0].accent = 'neon';
  var repaired = normalizeSaveData(edited).data.units[0];`);
assert.equal(run('repaired.callsign'), 'A very long');
assert.equal(run('repaired.accent'), run('defaultAccentFor(repaired.colorSeed)'), 'unknown accent falls back to the default');
run(`var noFields = c.serialize(); delete noFields.units[0].callsign; delete noFields.units[0].accent;`);
assert.equal(run('normalizeSaveData(noFields).data.units[0].callsign'), null, 'pre-customization v2 saves migrate');

// ---------------------------------------------------------------------------
// 8c. The brief 08 starter field meal is retired by brief 09: every base
// starts with a working field kitchen, and the brief forbids using the
// one-time meal as a substitute for kitchen service. It can never fire.
run(`var g = new GameState(); var gv = new Unit({ x: 100, y: 100, isCivilian: true }); g.units.push(gv);
  g.applicantLine = [gv.id]; gv.serviceSince = Date.now(); g.recruit(gv.id); gv.energy = ENERGY_CRITICAL;`);
assert.equal(run('g.messHall.isBuilt'), true, 'a fresh base has a kitchen');
assert.equal(run('g.starterFieldMealDue(gv)'), false, 'so the field meal never applies');
// Saves from before the meal existed get it; a malformed flag is refused.
run(`var preMeal = g.serialize(); delete preMeal.chapter.fieldMealUsed; var restored = GameState.fromSaveData(normalizeSaveData(preMeal).data);`);
assert.equal(run('restored.chapter.fieldMealUsed'), false);
assert.throws(() => run(`var badMeal = g.serialize(); badMeal.chapter.fieldMealUsed = 'yes'; normalizeSaveData(badMeal);`), /fieldMealUsed/);

// ---------------------------------------------------------------------------
// 9. Movement continuity: the first soldier's route gate -> range -> gate ->
//    back in, sampled at 30 fps for at least 30 s. Every frame moves no
//    further than the walking speed allows (no pops), stays on the authored
//    trail or inside the facility clearing it is entering, facing changes
//    only while moving and never flickers, and arrival holds still.
run(`var m = new GameState(); m.shootingRange.level = 1; m.chapter.done = true; m.lastCivilianSpawn = Infinity;
  var gate = worldNodePosition('gate_inside'); var w = new Unit({ x: gate.x, y: gate.y, isCivilian: false });
  w.outfit = 'uniform'; w.energy = 100; m.units.push(w);
  var edges = worldEdgeList(null).map(e => e.points);
  var segDist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
  var offTrail = p => Math.min(...edges.map(pts => Math.min(...pts.slice(1).map((b, i) => segDist(p, pts[i], b)))));
  var samples = []; var sample = () => samples.push({ x: w.x, y: w.y, facing: w.facing, moving: w.path.length > 0 || Math.hypot(w.targetX - w.x, w.targetY - w.y) > 1,
    inZone: WORLD.zones.some(z => pointInPolygon(w.x, w.y, z.footprint)), phase: w.routePhase });
  var walkTo = (fn, seconds) => { fn(); for (let t = 0; t < seconds; t += 1/30) { sample(); w.step(1/30); if (!w.path.length && Math.hypot(w.targetX - w.x, w.targetY - w.y) < 1) break; } sample(); };`);
run(`walkTo(() => m.routeToBuilding(w, m.shootingRange), 90);`);
assert.ok(run('m.isUsingFacility(w, m.shootingRange)'), 'reached the range slot');
run(`m.releaseSlot(w, 'test'); walkTo(() => m.routeToNode(w, 'gate_outside', [], 'depart'), 90);`);
assert.ok(run(`Math.hypot(w.x - worldNodePosition('gate_outside').x, w.y - worldNodePosition('gate_outside').y) < 1`), 'out through the gate');
run(`walkTo(() => m.routeToNode(w, WORLD.safeNodes.gate), 60); for (let i = 0; i < 30; i++) sample();`);
const motion = run(`(() => {
  const maxStep = w.speed / 30 + 0.01; let worstStep = 0, worstOff = 0, worstLocal = 0, flickers = 0, idleTurns = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    worstStep = Math.max(worstStep, Math.hypot(b.x - a.x, b.y - a.y) - maxStep);
    // Door <-> slot steps ('enter'/'leave') are the authored local approach:
    // inside the clearing or next to its entrance. Everything else is trail.
    const local = b.phase === 'enter' || b.phase === 'leave' || b.phase === 'using';
    const entrance = zoneById(m.shootingRange.zoneId).entrance;
    if (local && !b.inZone) worstLocal = Math.max(worstLocal, Math.hypot(b.x - entrance.x, b.y - entrance.y));
    else if (!local && !b.inZone) worstOff = Math.max(worstOff, offTrail(b));
    if (b.facing !== a.facing && !a.moving) idleTurns++;
    if (i > 1 && b.facing === samples[i - 2].facing && a.facing !== b.facing) flickers++;
  }
  const tail = samples.slice(-30); const still = tail.every(p => p.x === tail[0].x && p.y === tail[0].y);
  return { frames: samples.length, worstStep, worstOff, worstLocal, flickers, idleTurns, still };
})()`);
assert.ok(motion.frames >= 30 * 30, `at least 30 s of motion sampled (${motion.frames} frames)`);
assert.ok(motion.worstStep <= 0, `no frame jumps further than walking speed allows (+${motion.worstStep.toFixed(2)} px)`);
assert.ok(motion.worstOff < 16, `feet stay on the authored trail (worst ${motion.worstOff.toFixed(1)} px off)`);
assert.ok(motion.worstLocal < 24, `door-to-slot steps stay by the entrance (worst ${motion.worstLocal.toFixed(1)} px)`);
assert.equal(motion.flickers, 0, 'facing never flickers back and forth');
assert.equal(motion.idleTurns, 0, 'no turning on the spot');
assert.equal(motion.still, true, 'arrival holds still');

// 10. The directional-walk release gate: blocked until every direction has
//     approved walk and idle art, and candidates never show by default.
const gate = run('walkReleaseGate()');
if (gate.ready) console.log('walk release gate: READY');
else {
  assert.ok(gate.blockers.length > 0);
  assert.equal(run(`assetInUse(ASSET_MANIFEST.units.soldier.walk.drawn.down, false)`), false, 'candidate walk hidden by default');
  console.log(`walk release gate: BLOCKED on art (${gate.blockers.join('; ')})`);
}
console.log(`movement: ${motion.frames} frames (${(motion.frames / 30).toFixed(0)} s), worst off-trail ${motion.worstOff.toFixed(1)} px`);
console.log('Chapter tests passed');

// First soldier chapter (brief 08): plays the complete first session in a
// real headless browser, in real time, with real input — mouse clicks on
// desktop, touch taps on a portrait phone — and saves a screenshot per
// step plus timings.
//
//   node tools/capture-first-session.cjs [desktop|phone] [outDir]
//        (default: desktop, captures/first-session/<mode>/)
//
//   node tools/capture-first-session.cjs desktop --candidates   (?art=candidates:
//        painted down walk/idle with the accent mask, variant-1 portrait)
//
// Flow: fresh save -> tap the visitor on the map -> admit -> soldier card ->
// build the range from the objective card -> assign (range drill) -> type a
// callsign and pick an accent on the card (checked on card, roster, after a
// reload and in the debrief) -> wait for readiness
// -> open Local Patrol -> dispatch (recall) -> reload mid-patrol (must
// resume) -> debrief appears once -> build the suggested facility ->
// chapter complete -> reload (debrief must not reappear, reward not
// duplicated). While the first soldier walks range -> gate and back in, a
// canvas clip follows them (movement evidence; default art, so the
// directional-walk release gate is visible as still sprites).
//
// Writes timings.json and steps.txt. Exits non-zero on page errors or a
// broken step. Nothing is stubbed: game time runs at normal speed.
const fs = require('node:fs');
const path = require('node:path');
const { sleep, startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const mode = args[0] === 'phone' ? 'phone' : 'desktop';
// --candidates: the same flow with ?art=candidates (painted down walk/idle
// with the accent mask, and the variant-1 portrait) for art review.
const candidates = args.includes('--candidates');
const outArg = args.slice(1).find(a => !a.startsWith('--'));
const outDir = path.resolve(outArg || path.join(root, 'captures', 'first-session', mode + (candidates ? '-candidates' : '')));
const query = candidates ? '&art=candidates' : '';
const CALLSIGN = 'Kestrel';
const THINK_MS = 2000; // a player's pause before acting on each step
const phone = mode === 'phone';

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  const steps = [];
  const t0 = Date.now();
  const note = text => { const line = `${((Date.now() - t0) / 1000).toFixed(1).padStart(6)} s  ${text}`; steps.push(line); console.log(`[${mode}] ${line}`); };
  const ev = expr => page.evaluate(expr);
  let shot = 0;
  const screenshot = async name => {
    const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
    const file = `${String(++shot).padStart(2, '0')}-${name}.jpg`;
    fs.writeFileSync(path.join(outDir, file), Buffer.from(data, 'base64'));
    return file;
  };
  const waitFor = async (expr, seconds, what) => {
    for (let i = 0; i < seconds * 5; i++) {
      if (await ev(expr).catch(() => false)) return;
      await sleep(200);
    }
    throw new Error(`timed out after ${seconds}s waiting for ${what}`);
  };
  // Real input at a viewport point: a mouse click, or a touch tap on phone.
  const tapAt = async (x, y) => {
    if (phone) {
      await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await sleep(60);
      await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await sleep(40);
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }
    await sleep(250);
  };
  const tapElement = async (selector, what) => {
    const rect = await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
      if (!el || el.offsetParent === null) return null; el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: !!el.disabled }; })()`);
    if (!rect) throw new Error(`${what}: ${selector} is not visible`);
    if (rect.disabled) throw new Error(`${what}: ${selector} is disabled`);
    await sleep(150);
    await tapAt(rect.x, rect.y);
  };
  // Tap a text field, type into it like a keyboard would, and press Enter.
  const typeInto = async (selector, text, what) => {
    await tapElement(selector, what);
    await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select(); return true; })()`);
    await page.send('Input.insertText', { text });
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await sleep(200);
    await ev(`document.activeElement && document.activeElement.blur(); true`); // leaving the field commits too
    await sleep(200);
  };
  // Tap a person where they are drawn on the map (body centre).
  const tapUnitOnMap = async unitExpr => {
    const point = await ev(`(() => { document.getElementById('gameArea').scrollIntoView({ block: 'center' });
      const u = ${unitExpr}; const s = camera.worldToScreen(u.x, u.y - UNIT_H / 2);
      const r = document.getElementById('gameCanvas').getBoundingClientRect();
      return { x: r.left + s.x, y: r.top + s.y, inside: s.x > 0 && s.y > 0 && s.x < r.width && s.y < r.height }; })()`);
    if (!point.inside) throw new Error('person is outside the map view');
    await sleep(150);
    await tapAt(point.x, point.y);
  };
  const stage = () => ev('gameState.chapterStage().id');
  const objective = () => ev(`document.getElementById('objectiveTitle').textContent + ' — ' + document.getElementById('objectiveDetail').textContent`);
  const timings = { mode };

  // Canvas clip following one person (camera centred on them).
  const startClip = unitExpr => ev(`(() => { const stream = document.getElementById('gameCanvas').captureStream(24);
    window.__rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 2e6 });
    window.__chunks = []; __rec.ondataavailable = e => __chunks.push(e.data); __rec.start(1000);
    window.__follow = setInterval(() => { const u = ${unitExpr}; if (u && !(u.status === 'on_mission' && !u.departing)) camera.centreOn(u.x, u.y - 20); }, 50);
    return true; })()`);
  const stopClip = async file => {
    const b64 = await ev(`new Promise(resolve => { clearInterval(__follow); __rec.onstop = async () => {
      const b = new Uint8Array(await new Blob(__chunks).arrayBuffer()); let s = '';
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); resolve(btoa(s)); }; __rec.stop(); })`);
    fs.writeFileSync(path.join(outDir, file), Buffer.from(b64, 'base64'));
  };

  try {
    await page.send('Emulation.setDeviceMetricsOverride', phone
      ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
      : { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    if (phone) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const ready = `document.readyState === 'complete' && typeof gameState !== 'undefined'`;
    await page.navigate(`${server.url}/index.html`, ready);
    await ev('localStorage.clear(); true');
    await page.navigate(`${server.url}/index.html?fresh=${Date.now()}${query}`, ready);
    note(`fresh game · stage ${await stage()} · cash $${await ev('Math.floor(gameState.cash)')}`);

    // 1. Meet the first visitor: tap them on the map once they are through the gate.
    await waitFor(`(() => { const s = gameState.chapterStage(); return s.visitor && s.visitor.enteredGate; })()`, 40, 'a visitor through the gate');
    await sleep(THINK_MS);
    await ev(`camera.home(); document.getElementById('objectiveCard').scrollIntoView({ block: 'start' }); true`);
    await sleep(300);
    await screenshot('visitor-at-gate');
    note(`objective: ${await objective()}`);
    await tapUnitOnMap(`gameState.chapterStage().visitor`);
    await waitFor(`!document.getElementById('recruitPopup').classList.contains('hidden')`, 5, 'the visitor card (tap on the map)');
    const visitorName = await ev(`gameState.units.find(u => u.id === pendingRecruitId).name`);
    await screenshot('meet-visitor');
    note(`met ${visitorName} by tapping them on the map · objective: ${await objective()}`);

    // 2. Admit.
    await sleep(THINK_MS);
    await tapElement('#recruitConfirm', 'admit');
    await waitFor(`gameState.chapter.firstSoldierId !== null`, 5, 'admission');
    timings.admittedS = (Date.now() - t0) / 1000;
    const first = `gameState.firstSoldier`;
    await sleep(600);
    await screenshot('soldier-card-admitted');
    note(`admitted ${await ev(`${first}.name`)} (target accuracy ${await ev('gameState.chapter.targetAccuracy')}, now ${await ev(`Math.floor(${first}.accuracy)`)}) · card: ${await ev(`document.getElementById('profileActivity').textContent`)}`);
    await tapElement('#closeProfile', 'close card');
    await waitFor(`${first}.outfit === 'uniform'`, 90, 'the uniform at the barracks');
    note(`in uniform · objective: ${await objective()}`);

    // 3. Build the range from the objective card.
    await sleep(THINK_MS);
    await screenshot('objective-build-range');
    await tapElement('#objectiveActionBtn', 'build range from the objective');
    await waitFor(`!!buildMode`, 5, 'build mode');
    await sleep(800);
    await screenshot('build-mode-range');
    await tapElement('#buildConfirmBtn', 'build here');
    await waitFor(`gameState.shootingRange.isBuilt`, 5, 'the range');
    note(`range built · cash $${await ev('Math.floor(gameState.cash)')} · objective: ${await objective()}`);

    // 4. Assign to the range, then watch training until ready.
    await sleep(THINK_MS);
    await tapElement('#objectiveActionBtn', 'assign from the objective');
    await waitFor(`${first}.assignedBuildingId === 'shooting_range'`, 5, 'assignment');
    timings.assignedS = (Date.now() - t0) / 1000;
    note(`assigned to the range · ${await ev(`document.getElementById('profileActivity').textContent`)}`);
    // Optional customization on the same card: type a callsign, pick an accent.
    const accentBefore = await ev(`${first}.accent`);
    const accentPick = accentBefore === 'gold' ? 'blue' : 'gold';
    await typeInto('#profileCallsign', CALLSIGN, 'callsign');
    await tapElement(`#profileAccents [data-accent="${accentPick}"]`, 'accent swatch');
    const custom = await ev(`({ callsign: ${first}.callsign, accent: ${first}.accent, field: ${first}.fieldName,
      badge: getComputedStyle(document.getElementById('profileAccentBadge')).backgroundColor,
      checked: document.querySelector('#profileAccents [aria-checked="true"]').dataset.accent })`);
    if (custom.callsign !== CALLSIGN || custom.accent !== accentPick || custom.checked !== accentPick) throw new Error(`customization not applied: ${JSON.stringify(custom)}`);
    timings.customized = { callsign: CALLSIGN, accent: accentPick };
    note(`customized on the card: callsign "${custom.callsign}", accent ${accentBefore} → ${custom.accent} (badge ${custom.badge}); map label "${custom.field}"`);
    await sleep(800);
    await screenshot('soldier-card-customized');
    await tapElement('#closeProfile', 'close card');
    await sleep(1200); // the roster refreshes once a second
    const roster = await ev(`document.querySelector('#rosterList [data-unit-id="' + ${first}.id + '"] strong').textContent`);
    if (!roster.includes(`"${CALLSIGN}"`)) throw new Error(`roster card shows "${roster}"`);
    await waitFor(`${first}.routePhase === 'using' && ${first}.status === 'training'`, 150, 'training at the range');
    note(`training at the range · objective: ${await objective()}`);
    await ev(`(() => { const u = ${first}; camera.zoom = 1.4; camera.centreOn(u.x, u.y - 20); return true; })()`);
    await sleep(500);
    await screenshot('training-at-range');
    await waitFor(`gameState.chapterStage().id === 'patrol'`, 300, 'patrol readiness');
    timings.readyS = (Date.now() - t0) / 1000;
    const events = await ev(`gameState.events.map(e => e.text)`);
    note(`ready for patrol · events so far: ${events.join(' | ')}`);
    await screenshot('ready-for-patrol');

    // 5. Local Patrol: open from the objective, dispatch (recall from the range).
    await sleep(THINK_MS);
    await tapElement('#objectiveActionBtn', 'open Local Patrol');
    await waitFor(`!document.getElementById('missionsPanel').classList.contains('hidden')`, 5, 'mission panel');
    await sleep(400);
    await screenshot('mission-panel-intro');
    const dispatchLabel = await ev(`document.getElementById('dispatchMissionBtn').textContent`);
    const statusBefore = await ev(`${first}.status`);
    await startClip(first);
    await tapElement('#dispatchMissionBtn', 'dispatch');
    await waitFor(`${first}.status === 'on_mission'`, 5, 'departure');
    timings.firstPatrolS = (Date.now() - t0) / 1000;
    note(`DISPATCHED "${dispatchLabel}" (was ${statusBefore}) · time to first patrol ${timings.firstPatrolS.toFixed(0)} s`);
    await tapElement('#closeMissions', 'close missions');
    await sleep(3000);
    await screenshot('departing-to-gate');
    await waitFor(`!${first}.departing`, 90, 'walk out of the gate');
    await stopClip('clip-range-to-gate.webm');
    note('walked out through the gate');
    await screenshot('away-countdown');

    // 6. Reload mid-patrol: the chapter must resume at "away".
    await ev('gameState.save(); true');
    await page.navigate(`${server.url}/index.html?reload=1${query}`, ready);
    await sleep(800);
    const afterReload = await stage();
    if (afterReload !== 'away') throw new Error(`reload mid-patrol resumed at ${afterReload}`);
    note(`reloaded mid-patrol → still "${afterReload}" · objective: ${await objective()}`);
    const kept = await ev(`({ callsign: ${first}.callsign, accent: ${first}.accent })`);
    if (kept.callsign !== CALLSIGN || kept.accent !== timings.customized.accent) throw new Error(`customization lost on reload: ${JSON.stringify(kept)}`);
    note(`customization survived the reload: "${kept.callsign}", ${kept.accent}`);

    // 7. Return and debrief (shown once).
    const cashBefore = await ev('gameState.cash');
    await waitFor(`${first} && ${first}.status !== 'on_mission'`, 120, 'the return');
    await startClip(first);
    await waitFor(`!document.getElementById('debriefPanel').classList.contains('hidden')`, 10, 'debrief');
    timings.returnedS = (Date.now() - t0) / 1000;
    await sleep(600);
    await screenshot('debrief');
    const debrief = await ev(`[...document.querySelectorAll('#debriefLines li')].map(li => li.textContent).join(' ')`);
    const report = await ev(`gameState.missionLog.find(e => e.id === gameState.chapter.introReportId)`);
    const debriefId = await ev(`({ callsign: document.getElementById('debriefCallsign').textContent,
      badge: document.getElementById('debriefAccentBadge').style.background, hex: accentById(${first}.accent).hex })`);
    if (!debriefId.callsign.includes(CALLSIGN) || report.callsign !== CALLSIGN || report.accent !== timings.customized.accent) {
      throw new Error(`debrief identity wrong: ${JSON.stringify({ debriefId, reportCallsign: report.callsign, reportAccent: report.accent })}`);
    }
    note(`debrief shows ${debriefId.callsign} with the ${report.accent} badge; the report saved callsign "${report.callsign}"`);
    const gained = (await ev('gameState.cash')) - cashBefore;
    note(`debrief: ${debrief} · next: ${await ev(`document.getElementById('debriefNextText').textContent`)}`);
    if (!debrief.includes(`$${report.cash}`)) throw new Error('debrief cash does not match the award');
    if (gained < report.cash || gained > report.cash + 2) throw new Error(`cash rose ${gained}, report says ${report.cash}`);
    await sleep(8000); // let the clip show them walking back in
    await stopClip('clip-gate-return.webm');

    // 8. Improve the base from the debrief.
    await tapElement('#debriefBuildBtn', 'build from the debrief');
    await waitFor(`!!buildMode`, 5, 'build mode');
    await sleep(600);
    await screenshot('build-mode-improve');
    await tapElement('#buildConfirmBtn', 'build here');
    await waitFor(`gameState.chapter.done`, 5, 'chapter complete');
    timings.completeS = (Date.now() - t0) / 1000;
    note(`chapter complete · built ${await ev(`BUILDING_LABELS[[gameState.messHall, gameState.barracks, gameState.showers, gameState.recRoom].find(b => b.isBuilt).type]`)} · cash $${await ev('Math.floor(gameState.cash)')}`);
    await sleep(1200);
    await ev(`openProfile(${first}); true`);
    await sleep(400);
    await screenshot('soldier-card-after-patrol');
    await tapElement('#closeProfile', 'close card');
    await ev(`document.getElementById('hud').scrollIntoView({ block: 'start' }); true`);
    await sleep(300);
    await screenshot('base-opened-up');

    // 9. Reload after completion: no second debrief, no second reward.
    const cashDone = await ev('gameState.cash');
    await ev('gameState.save(); true');
    await page.navigate(`${server.url}/index.html?reload=2${query}`, ready);
    await sleep(1500);
    const again = await ev(`!document.getElementById('debriefPanel').classList.contains('hidden')`);
    const logCount = await ev(`gameState.missionLog.filter(e => e.intro).length`);
    const cashAfter = await ev('gameState.cash');
    if (again) throw new Error('debrief reappeared after reload');
    if (logCount !== 1) throw new Error(`intro reported ${logCount} times`);
    if (cashAfter > cashDone + 3) throw new Error(`cash rose from ${cashDone} to ${cashAfter} on reload`);
    note(`reloaded after completion: no debrief, 1 intro report, cash $${Math.floor(cashDone)} → $${Math.floor(cashAfter)} (idle trickle only)`);

    if (page.problems.length) throw new Error(`page errors:\n${page.problems.join('\n')}`);
    note('PASS');
  } catch (error) {
    note(`FAIL: ${error.message}`);
    await screenshot('failure').catch(() => {});
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(outDir, 'steps.txt'), steps.join('\n') + '\n');
    fs.writeFileSync(path.join(outDir, 'timings.json'), JSON.stringify(timings, null, 2));
    await page.close();
    server.close();
  }
})();

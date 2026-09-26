// Browser review captures for Command Base — no installed dependencies.
//
//   node tools/browser-capture.cjs <baseUrl> <outDir> [--clip] [--candidates]
//   e.g. node tools/browser-capture.cjs http://localhost:8000 captures --clip
//
// Launches headless Edge/Chrome (set BROWSER to override the path) over the
// DevTools protocol, sets up scripted scenes inside the real page, and:
//   - saves 960 x 576 canvas screenshots (fresh, partial, expanded, build
//     preview) and a portrait-phone page screenshot;
//   - clicks/taps soldiers after panning and zooming to prove pointer and
//     touch hit testing match the drawing, and builds a facility through
//     the build bar;
//   - with --clip, records 30 s of the canvas to WebM (MediaRecorder);
//   - fails if the page logs an error or throws.
// Scene setup reaches into the page's globals (gameState, camera); it is a
// review tool, not part of the game.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const [baseUrl = 'http://localhost:8000', outDir = 'captures'] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const recordClip = process.argv.includes('--clip');
// --candidates previews art the manifest marks as candidate (e.g. firing frames).
const pageQuery = process.argv.includes('--candidates') ? '?art=candidates' : '';
const PORT = 9333;

function findBrowser() {
  const candidates = [process.env.BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) throw new Error('No Edge/Chrome found; set BROWSER to its path');
  return found;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    this.ready = new Promise((resolve, reject) => { this.ws.onopen = resolve; this.ws.onerror = reject; });
    this.ws.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
      } else if (message.method) this.listeners.forEach(fn => fn(message));
    };
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-capture-'));
  const browser = spawn(findBrowser(), ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--disable-gpu', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
  let version;
  for (let i = 0; i < 50 && !version; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); }
  }
  const cdp = new Cdp(version.webSocketDebuggerUrl);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);
  const problems = [];
  cdp.listeners.push(message => {
    if (message.sessionId !== sessionId) return;
    if (message.method === 'Runtime.exceptionThrown') problems.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      problems.push(message.params.args.map(a => a.value ?? a.description).join(' '));
    }
  });
  await send('Runtime.enable');
  await send('Page.enable');

  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(`${expression.slice(0, 80)}…: ${result.exceptionDetails.exception?.description}`);
    return result.result.value;
  };
  const viewport = async (width, height, mobile = false) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
    await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
  };
  const load = async () => {
    await send('Page.navigate', { url: `${baseUrl}/index.html${pageQuery}` });
    for (let i = 0; i < 100; i++) {
      await sleep(100);
      if (await evaluate(`document.readyState === 'complete' && typeof gameState !== 'undefined'`).catch(() => false)) break;
    }
    await evaluate(`localStorage.clear(); document.getElementById('gameArea').scrollIntoView({ block: 'center' }); true`);
    await sleep(300);
  };
  // Viewport coordinates (for input events).
  const canvasRect = () => evaluate(`(() => { const r = document.getElementById('gameCanvas').getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height }; })()`);
  // Page coordinates (for screenshot clips).
  const canvasPageRect = async () => {
    const r = await canvasRect();
    const scroll = await evaluate('({ x: window.scrollX, y: window.scrollY })');
    return { ...r, x: r.x + scroll.x, y: r.y + scroll.y };
  };
  const waitFor = async (expression, ms) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) if (await evaluate(expression)) return true;
    return evaluate(expression);
  };
  const shoot = async (name, clip) => {
    const { data } = await send('Page.captureScreenshot', clip ? { format: 'png', clip: { ...clip, scale: 1 } } : { format: 'png' });
    fs.writeFileSync(path.join(outDir, name), Buffer.from(data, 'base64'));
    console.log(`saved ${name}`);
  };
  const shootCanvas = async name => shoot(name, await canvasPageRect());

  // Scene set-up runs inside the page. Soldiers are placed at the gate so
  // every walk and slot reservation happens through normal routing.
  const scene = body => evaluate(`(() => { gameState = new GameState(); gameState.cash = 2000; gameState.food = 400;
    const gate = worldNodePosition('gate_inside');
    const soldier = (name, variant) => { const u = new Unit({ x: gate.x, y: gate.y, isCivilian: false });
      u.name = name; u.soldierVariant = variant; u.energy = 100; gameState.units.push(u); return u; };
    const hour = h => { gameState.gameClockMs = h * 3600000; };
    selectedUnitId = null; camera.home();
    ${body}
    return true; })()`);
  const pointAt = async unitExpr => evaluate(`(() => { const u = ${unitExpr}; const s = camera.worldToScreen(u.x, u.y - UNIT_H / 2);
    const r = document.getElementById('gameCanvas').getBoundingClientRect(); return { x: r.left + s.x, y: r.top + s.y, id: u.id }; })()`);
  const mouseClick = async ({ x, y }) => {
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1, pointerType: 'mouse' });
    }
  };
  const touchTap = async ({ x, y }) => {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const checks = [];
  const check = (label, ok) => { checks.push(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) problems.push(`check failed: ${label}`); };

  // 1. Fresh base: gate, entrance and surveyed sites; a visitor arrives.
  await viewport(1280, 900);
  await load();
  await scene(`hour(8); gameState.lastCivilianSpawn = 0;`);
  await sleep(9000);
  await shootCanvas('01-fresh-960x576.png');
  check('desktop canvas is 960 x 576', JSON.stringify(await canvasRect()).includes('"width":960,"height":576'));

  // 2. Partially built: Barracks, range and mess; two soldiers train at the
  // range slots, one on the path, a visitor waiting.
  await scene(`hour(9.3); gameState.barracks.level = 1; gameState.shootingRange.level = 1; gameState.messHall.level = 1;
    const a = soldier('Grace Okafor', 3), b = soldier('Kenji Rossi', 5); soldier('Omar Chen', 2);
    gameState.assignToBuilding(a.id, 'shooting_range'); gameState.assignToBuilding(b.id, 'shooting_range');
    gameState.lastCivilianSpawn = 0;`);
  const bothAtRange = `(() => { const using = gameState.units.filter(u => u.routePhase === 'using' && u.slot && u.slot.buildingId === 'shooting_range');
    return using.length === 2 && using[0].slot.slotId !== using[1].slot.slotId; })()`;
  const rangeBusy = await waitFor(bothAtRange, 40000);
  await sleep(1500);
  await shootCanvas('02-partial-960x576.png');
  check('two soldiers using distinct range slots', rangeBusy && await evaluate(`(() => { const using = gameState.units.filter(u => u.routePhase === 'using' && u.slot && u.slot.buildingId === 'shooting_range');
    return using.length === 2 && using[0].slot.slotId !== using[1].slot.slotId; })()`));

  // Pointer alignment: click a soldier, then again after wheel-zoom and drag-pan.
  const target = await pointAt(`gameState.units.find(u => u.name === 'Omar Chen')`);
  await mouseClick(target);
  await sleep(200);
  check('mouse click selects the soldier under the pointer', await evaluate('selectedUnitId') === target.id);
  await evaluate('closeProfile(); true');
  // Wheel zoom around the cursor. Headless Edge only sometimes dispatches
  // CDP synthetic wheel input to the page at all (it scrolls on the
  // compositor instead), so the handler is exercised with a real WheelEvent
  // and the "+" button with a real click. A physical mouse wheel stays on
  // the manual checklist.
  const wheelAt = await pointAt(`gameState.units.find(u => u.id === '${target.id}')`);
  const anchorBefore = await evaluate(`(() => { const r = document.getElementById('gameCanvas').getBoundingClientRect();
    return camera.screenToWorld(${wheelAt.x} - r.left, ${wheelAt.y} - r.top); })()`);
  await evaluate(`document.getElementById('gameCanvas').dispatchEvent(new WheelEvent('wheel',
    { deltaY: -300, clientX: ${wheelAt.x}, clientY: ${wheelAt.y}, bubbles: true, cancelable: true })); true`);
  const anchorAfter = await evaluate(`(() => { const r = document.getElementById('gameCanvas').getBoundingClientRect();
    return camera.screenToWorld(${wheelAt.x} - r.left, ${wheelAt.y} - r.top); })()`);
  check('wheel zooms in around the cursor', await evaluate('camera.zoom') > 1.05
    && Math.hypot(anchorAfter.x - anchorBefore.x, anchorAfter.y - anchorBefore.y) < 1);
  const zoomBeforeButton = await evaluate('camera.zoom');
  await mouseClick(await evaluate(`(() => { const r = document.getElementById('zoomOutBtn').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
  await sleep(200);
  check('zoom button changes the view', await evaluate('camera.zoom') < zoomBeforeButton);
  const r = await canvasRect();
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x + 480, y: r.y + 300, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x + 420, y: r.y + 270, button: 'left', buttons: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x + 420, y: r.y + 270, button: 'left', clickCount: 1 });
  check('drag did not count as a tap', await evaluate('selectedUnitId') === null);
  const moved = await pointAt(`gameState.units.find(u => u.id === '${target.id}')`);
  await mouseClick(moved);
  await sleep(200);
  check('click after zoom and pan still selects the right soldier', await evaluate('selectedUnitId') === target.id);
  await evaluate('closeProfile(); camera.home(); true');

  // 3. Build mode: preview, affordability, construction on a chosen site.
  await evaluate(`document.getElementById('construction').open = true; document.getElementById('buildWeightRoomBtn').click(); true`);
  await sleep(400);
  check('build mode highlights sites', await evaluate('!!buildMode && !document.getElementById("buildBar").classList.contains("hidden")'));
  const site = await evaluate(`(() => { const c = polygonCentroid(zoneById('zone_east_meadow').footprint); const s = camera.worldToScreen(c.x, c.y);
    const r = document.getElementById('gameCanvas').getBoundingClientRect(); return { x: r.left + s.x, y: r.top + s.y }; })()`);
  await mouseClick(site);
  await sleep(300);
  await shootCanvas('03-build-preview-960x576.png');
  check('tapping a site selects it', await evaluate('buildMode && buildMode.selectedZoneId') === 'zone_east_meadow');
  await evaluate(`document.getElementById('buildConfirmBtn').click(); true`);
  await sleep(700);
  await shootCanvas('04-constructing-960x576.png');
  check('facility built on the chosen site', await evaluate(`gameState.weightRoom.isBuilt && gameState.weightRoom.zoneId === 'zone_east_meadow'`));
  check('displaced unbuilt facility moved to a legal site', await evaluate(`gameState.allBuildings.every(b => zoneAllowsType(zoneById(b.zoneId), b.type))
    && new Set(gameState.allBuildings.map(b => b.zoneId)).size === gameState.allBuildings.length`));
  await evaluate(`gameState.cash = 0; document.getElementById('buildShowersBtn').click(); true`);
  await sleep(200);
  check('unaffordable build explains what is missing', /Need \$\d+ more/.test(await evaluate(`document.getElementById('buildBarText').textContent`)));
  check('confirm is disabled while unaffordable', await evaluate(`document.getElementById('buildConfirmBtn').disabled`));
  await evaluate(`document.getElementById('buildCancelBtn').click(); true`);

  // 4. Expanded base, whole map.
  await scene(`hour(10);
    for (const b of gameState.allBuildings) { if (b.buildCost) b.build(); else b.level = Math.max(b.level, b === gameState.barracks ? 3 : 2); }
    const names = ['Grace Okafor', 'Kenji Rossi', 'Omar Chen', 'Aisha Novak', 'Ivan Patel', 'Sofia Silva', 'Wei Garcia', 'Maria Kim', 'Carlos Diallo', 'Fatima Chen', 'James Rossi', 'Linda Muller'];
    const facilities = ['shooting_range', 'shooting_range', 'weight_room', 'weight_room', 'obstacle_course', 'obstacle_course', 'drill_yard', 'drill_yard'];
    names.forEach((name, i) => { const u = soldier(name, (i % 6) + 1); if (facilities[i]) gameState.assignToBuilding(u.id, facilities[i]); });
    gameState.lastCivilianSpawn = 0; camera.fitWorld();`);
  await sleep(26000);
  await shootCanvas('05-expanded-960x576.png');
  const frameMs = await evaluate(`new Promise(resolve => { let n = 0; const start = performance.now();
    const step = () => (++n < 60 ? requestAnimationFrame(step) : resolve((performance.now() - start) / 60)); requestAnimationFrame(step); })`);
  checks.push(`INFO average frame ${frameMs.toFixed(1)} ms with ${await evaluate('gameState.units.length')} people (headless, software rendering)`);

  // 5. Portrait phone: same partial base, touch selection.
  await viewport(390, 844, true);
  await load();
  await scene(`hour(9.3); gameState.barracks.level = 1; gameState.shootingRange.level = 1;
    const a = soldier('Grace Okafor', 3), b = soldier('Kenji Rossi', 5);
    gameState.assignToBuilding(a.id, 'shooting_range'); gameState.assignToBuilding(b.id, 'shooting_range'); gameState.lastCivilianSpawn = 0;`);
  await sleep(14000);
  await evaluate(`document.getElementById('gameArea').scrollIntoView({ block: 'start' }); true`);
  await sleep(300);
  await shoot('06-phone-portrait.png');
  await evaluate(`(() => { const u = gameState.units.find(u => u.name === 'Grace Okafor'); camera.centreOn(u.x, u.y - UNIT_H / 2); return true; })()`);
  await sleep(200);
  const phoneTarget = await pointAt(`gameState.units.find(u => u.name === 'Grace Okafor')`);
  await touchTap(phoneTarget);
  await sleep(300);
  check('touch tap selects the soldier on a phone', await evaluate('selectedUnitId') === phoneTarget.id);
  check('phone canvas is taller than 5:3', await evaluate(`(() => { const r = document.getElementById('gameCanvas').getBoundingClientRect(); return r.height > r.width * 0.9; })()`));

  // 6. 30-second continuous clip at game scale.
  if (recordClip) {
    await viewport(1280, 900);
    await load();
    await scene(`hour(9); gameState.barracks.level = 1; gameState.shootingRange.level = 1;
      const a = soldier('Grace Okafor', 3), b = soldier('Kenji Rossi', 5);
      gameState.assignToBuilding(a.id, 'shooting_range'); gameState.assignToBuilding(b.id, 'shooting_range');
      a.x += 30; gameState.routeForStatus(a); gameState.lastCivilianSpawn = 0; gameState.spawnCivilianIfRoom();`);
    const base64 = await evaluate(`new Promise(resolve => {
      const stream = document.getElementById('gameCanvas').captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 4e6 });
      const chunks = []; recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => { const buffer = await new Blob(chunks).arrayBuffer(); let s = '';
        const bytes = new Uint8Array(buffer); for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        resolve(btoa(s)); };
      recorder.start(1000); setTimeout(() => recorder.stop(), 30000); })`);
    fs.writeFileSync(path.join(outDir, '07-clip-30s.webm'), Buffer.from(base64, 'base64'));
    console.log('saved 07-clip-30s.webm');
    // Contact sheet: six frames from the recording, for reviewers without a player.
    const sheet = await evaluate(`new Promise(async resolve => {
      const video = document.createElement('video'); video.muted = true;
      video.src = URL.createObjectURL(new Blob([Uint8Array.from(atob('${base64}'), c => c.charCodeAt(0))], { type: 'video/webm' }));
      await new Promise(r => { video.onloadeddata = r; });
      const sheet = document.createElement('canvas'); sheet.width = 1440; sheet.height = 576;
      const g = sheet.getContext('2d'); g.font = 'bold 16px sans-serif';
      const times = [1, 6, 11, 16, 21, 28];
      for (let i = 0; i < times.length; i++) {
        video.currentTime = times[i];
        await new Promise(r => { video.onseeked = r; });
        const x = (i % 3) * 480, y = Math.floor(i / 3) * 288;
        g.drawImage(video, x, y, 480, 288);
        g.fillStyle = '#000a'; g.fillRect(x + 6, y + 6, 54, 24); g.fillStyle = '#fff'; g.fillText(times[i] + 's', x + 14, y + 24);
      }
      resolve(sheet.toDataURL('image/png').split(',')[1]); })`);
    fs.writeFileSync(path.join(outDir, '08-clip-contact-sheet.png'), Buffer.from(sheet, 'base64'));
    console.log('saved 08-clip-contact-sheet.png');
    check('clip: visitor admitted to a reception chair', await evaluate(`gameState.activityLog.some(e => e.event === 'admitted' && e.slotId)`));
    check('clip: both soldiers reached distinct range slots', await evaluate(`new Set(gameState.activityLog.filter(e => e.event === 'phase' && e.to === 'using' && e.buildingId === 'shooting_range').map(e => e.slotId)).size >= 2`));
  }

  fs.writeFileSync(path.join(outDir, 'checks.txt'), [...checks, ...problems.map(p => `PROBLEM ${p}`)].join('\n') + '\n');
  console.log(checks.join('\n'));
  if (problems.length) console.log(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  await cdp.send('Browser.close').catch(() => {});
  browser.kill();
  process.exitCode = problems.length ? 1 : 0;
}

main().catch(error => { console.error(error); process.exit(1); });

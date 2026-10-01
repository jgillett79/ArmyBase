// Review captures for the Brief 09 up/right anatomical guides — NOT game art.
//
//   node tools/capture-direction-guides.cjs [outDir]
//   (default: docs/screenshots/2026-10-01-direction-guides)
//
// 1. foot-overlay-{right,up,down}.png: the six source cells (256 x 384,
//    pivot (128, 330)) with each recorded sole marked (filled = planted,
//    ring = swinging), then the same frames laid out at their WORLD offsets
//    for a continuous walk (25 source px = 3.67 world px per frame, the
//    runtime's stride/frames), so a planted sole that truly stays put shows
//    as stacked marks. `down` is the accepted painted master for comparison.
// 2. guide-loop-30s.webm + guide-loop-contact.png: a soldier walking a
//    rectangle (right, up, left = mirrored right, down) with idles, drawn by
//    the game's own drawFramePose at zoom 1. The guides are put into THIS
//    PAGE's in-memory manifest only (never js/asset-manifest.js), every frame
//    is watermarked, and walkReleaseGate() is checked to still be blocked.
// 3. guide-steps-1.6x-{right,up}.png: 12 consecutive frames at zoom 1.6
//    with the ground point marked, to judge the planted boot against the
//    ground, including the runtime's within-frame drift.
const fs = require('node:fs');
const path = require('node:path');
const { sleep, startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'docs', 'screenshots', '2026-10-01-direction-guides'));
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const SETS = {
  right: { image: 'art/rig/brief09/soldier_walk_right_anatomical_guide.png', track: read('art/rig/brief09/soldier_walk_right_anatomical_guide.json').track, axis: 'x', sign: 1 },
  up: { image: 'art/rig/brief09/soldier_walk_up_anatomical_guide.png', track: read('art/rig/brief09/soldier_walk_up_anatomical_guide.json').track, axis: 'y', sign: -1 },
  down: { image: 'art/rig/soldier_walk_down_painted_v3.png', track: read('art/rig/soldier_walk_down_painted_v3.json').track, axis: 'y', sign: 1, note: 'accepted painted master (screen-half foot labels)' },
};

const OVERLAY = name => `(async () => {
  const set = ${JSON.stringify(SETS[name])};
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = '/' + set.image; });
  const S = 0.6, CW = 256 * S, CH = 384 * S, step = 25;
  const horizontal = set.axis === 'x';
  const trackW = horizontal ? (256 + 11 * step) * S : CW + 40, trackH = horizontal ? CH : (384 + 11 * step) * S;
  const c = document.createElement('canvas'); c.width = Math.max(6 * CW, trackW + 40) ; c.height = CH + 60 + trackH + 40;
  const g = c.getContext('2d'); g.fillStyle = '#1b2420'; g.fillRect(0, 0, c.width, c.height);
  g.font = 'bold 13px monospace'; g.fillStyle = '#f0e6c8';
  g.fillText('${name.toUpperCase()} ' + (set.note || 'walk guide — paint template, NOT game art') + ' · filled = planted sole, ring = swinging · + = pivot (128,330)', 6, 14);
  const mark = (x, y, planted, colour) => { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.lineWidth = 2;
    if (planted) { g.fillStyle = colour; g.fill(); } else { g.strokeStyle = colour; g.stroke(); } };
  const colours = { right: '#5fd35f', left: '#57b6ff' };
  for (let k = 0; k < 6; k++) {
    const x0 = k * CW, y0 = 20;
    g.drawImage(img, k * 256, 0, 256, 384, x0, y0, CW, CH);
    g.strokeStyle = '#ff5a4a'; g.beginPath(); g.moveTo(x0 + 128 * S - 6, y0 + 330 * S); g.lineTo(x0 + 128 * S + 6, y0 + 330 * S);
    g.moveTo(x0 + 128 * S, y0 + 330 * S - 6); g.lineTo(x0 + 128 * S, y0 + 330 * S + 6); g.stroke();
    for (const [foot, p] of Object.entries(set.track[k])) mark(x0 + p.x * S, y0 + p.y * S, p.planted, colours[foot]);
    g.fillStyle = '#f0e6c8'; g.fillText('f' + (k + 1) + ' ' + Object.entries(set.track[k]).filter(([, p]) => p.planted).map(([f]) => f).join('+'), x0 + 4, y0 + CH + 14);
  }
  // World layout: frame k drawn at its frame-start offset along travel.
  const ty = CH + 60, tx = 20;
  g.fillStyle = '#f0e6c8'; g.fillText('world track over two cycles (frame starts, 25 source px = 3.67 world px apart): planted soles must stack', tx, ty - 8);
  for (let k = 0; k < 12; k++) {
    const f = k % 6, off = k * step * S;
    // Along the direction of travel: east, north (up the page) or south.
    const ox = horizontal ? tx + off : tx, oy = horizontal ? ty : set.sign < 0 ? ty + trackH - CH - off : ty + off;
    g.globalAlpha = 0.14; g.drawImage(img, f * 256, 0, 256, 384, ox, oy, CW, CH); g.globalAlpha = 1;
    for (const [foot, p] of Object.entries(set.track[f])) if (p.planted) mark(ox + p.x * S, oy + p.y * S, true, colours[foot]);
  }
  return c.toDataURL('image/png').split(',')[1];
})()`;

const GUIDE_ENTRY = dir => `{ status: 'candidate', reviewOnly: true, file: 'art/rig/brief09/soldier_walk_${dir}_anatomical_guide.png',
  frames: [0, 1, 2, 3, 4, 5].map(i => [i * 256, 0, 256, 384]), pivot: [128, 330], headroom: 30, tint: 'none' }`;
const IDLE_ENTRY = dir => `{ status: 'candidate', reviewOnly: true, file: 'art/rig/brief09/soldier_idle_${dir}_anatomical_guide.png',
  frames: [[0, 0, 256, 384], [256, 0, 256, 384]], pivot: [128, 330], headroom: 30, tint: 'none', frameMs: [900, 900] }`;

// Rectangle on open ground (the unbuilt South green), anticlockwise from the
// south-west corner: right, up, left, down, with 2 s idles at each corner.
const SCENE = `(() => { localStorage.clear();
  const gateBefore = walkReleaseGate().ready;
  const soldier = ASSET_MANIFEST.units.soldier;
  soldier.walk.drawn.right = ${GUIDE_ENTRY('right')}; soldier.walk.drawn.up = ${GUIDE_ENTRY('up')};
  soldier.idle.drawn.right = ${IDLE_ENTRY('right')}; soldier.idle.drawn.up = ${IDLE_ENTRY('up')};
  gameState = new GameState(); gameState.gameClockMs = 9 * 3600000; gameState.lastCivilianSpawn = Infinity;
  gameState.tickRoutine = function (unit, dt) { unit.step(dt); }; // review page: no timetable, just walking
  const corners = [[600, 760], [760, 760], [760, 660], [600, 660]];
  const u = new Unit({ x: corners[0][0], y: corners[0][1], isCivilian: false });
  u.name = 'Guide review'; u.outfit = 'uniform'; u.soldierVariant = 1; u.speed = 38; u.facing = 'right'; u.routine = freshRoutine();
  gameState.units.push(u); window.__walker = u; window.__corner = 0; window.__until = Date.now() + 1500;
  if (window.__shuttle) clearInterval(window.__shuttle);
  window.__shuttle = setInterval(() => { if (u.path.length || Math.hypot(u.targetX - u.x, u.targetY - u.y) > 1 || Date.now() < __until) return;
    __corner = (__corner + 1) % 4; const [x, y] = corners[__corner]; u.setPath([{ x, y }]); __until = Date.now() + 2000; }, 50);
  const draw = renderFrame;
  window.renderFrame = function (ctx, ...rest) { draw(ctx, ...rest); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(120, 10, 90, 0.85)'; ctx.fillRect(70, 540, 640, 26); ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace';
    ctx.fillText('DIRECTION GUIDES — review only, NOT game art · walk gate ' + (walkReleaseGate().ready ? 'OPEN' : 'BLOCKED'), 80, 558); };
  selectedUnitId = null; gameState.simSpeed = 1; camera.zoom = 1; camera.centreOn(680, 700);
  return { gateBefore, gateAfter: walkReleaseGate().ready, blockers: walkReleaseGate().blockers }; })()`;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.navigate(`${server.url}/index.html?art=candidates`, `document.readyState === 'complete' && typeof gameState !== 'undefined'`);
    await page.evaluate(`document.getElementById('gameArea').scrollIntoView({ block: 'center' }); true`);
    for (const name of Object.keys(SETS)) {
      fs.writeFileSync(path.join(outDir, `foot-overlay-${name}.png`), Buffer.from(await page.evaluate(OVERLAY(name)), 'base64'));
      console.log(`saved foot-overlay-${name}.png`);
    }
    const gate = await page.evaluate(SCENE);
    if (gate.gateBefore || gate.gateAfter) throw new Error('walkReleaseGate() is open — guides must never open it');
    console.log(`walk release gate stays blocked (${gate.blockers.join('; ')})`);
    await sleep(1200);
    const clip = await page.evaluate(`new Promise(resolve => {
      const stream = document.getElementById('gameCanvas').captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 1.2e6 });
      const chunks = []; recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => { const b = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = '';
        for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); resolve(s && btoa(s)); };
      recorder.start(1000); setTimeout(() => recorder.stop(), 30000); })`);
    fs.writeFileSync(path.join(outDir, 'guide-loop-30s.webm'), Buffer.from(clip, 'base64'));
    console.log(`saved guide-loop-30s.webm (walked ${Math.round(await page.evaluate('__walker.walkDistance'))} world px)`);
    const sheet = await page.evaluate(`new Promise(async resolve => {
      const video = document.createElement('video'); video.muted = true;
      video.src = URL.createObjectURL(new Blob([Uint8Array.from(atob('${clip}'), c => c.charCodeAt(0))], { type: 'video/webm' }));
      await new Promise(r => { video.onloadeddata = r; });
      const c = document.createElement('canvas'); c.width = 1440; c.height = 576; const g = c.getContext('2d'); g.font = 'bold 16px sans-serif';
      const times = [2, 6, 10, 15, 20, 26];
      for (let i = 0; i < times.length; i++) { video.currentTime = times[i]; await new Promise(r => { video.onseeked = r; });
        const x = (i % 3) * 480, y = Math.floor(i / 3) * 288; g.drawImage(video, x, y, 480, 288);
        g.fillStyle = '#000a'; g.fillRect(x + 6, y + 6, 54, 24); g.fillStyle = '#fff'; g.fillText(times[i] + 's', x + 14, y + 24); }
      resolve(c.toDataURL('image/jpeg', 0.85).split(',')[1]); })`);
    fs.writeFileSync(path.join(outDir, 'guide-loop-contact.jpg'), Buffer.from(sheet, 'base64'));
    console.log('saved guide-loop-contact.jpg');

    // Close strips at 1.6x while walking right, then up.
    for (const facing of ['right', 'up']) {
      await page.evaluate(SCENE);
      for (let i = 0; i < 300; i++) { await sleep(50); if (await page.evaluate(`__walker.facing === '${facing}' && Math.hypot(__walker.targetX - __walker.x, __walker.targetY - __walker.y) > 70`)) break; }
      const frames = [];
      for (let i = 0; i < 12; i++) {
        const info = await page.evaluate(`(() => { const u = __walker; camera.zoom = 1.6; camera.centreOn(u.x, u.y - 20);
          const s = camera.worldToScreen(u.x, u.y); return { sx: s.x, sy: s.y, facing: u.facing, walk: u.walkDistance,
          frame: Math.floor((u.walkDistance / 22) * 6) % 6 + 1 }; })()`);
        await sleep(20);
        const r = await page.evaluate(`(() => { const r = document.getElementById('gameCanvas').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY }; })()`);
        const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: r.x + info.sx - 60, y: r.y + info.sy - 100, width: 120, height: 120, scale: 1 } });
        frames.push({ data, info });
        await sleep(60);
      }
      const strip = await page.evaluate(`new Promise(async resolve => {
        const frames = ${JSON.stringify(frames)};
        const c = document.createElement('canvas'); c.width = 12 * 124; c.height = 150; const g = c.getContext('2d');
        g.fillStyle = '#16211d'; g.fillRect(0, 0, c.width, c.height); g.font = '11px monospace';
        for (let i = 0; i < frames.length; i++) {
          const img = await new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.src = 'data:image/png;base64,' + frames[i].data; });
          g.drawImage(img, i * 124, 0);
          g.strokeStyle = '#ff4a4a'; g.beginPath(); g.moveTo(i * 124 + 40, 100); g.lineTo(i * 124 + 80, 100); g.stroke();
          g.fillStyle = '#eee'; g.fillText(frames[i].info.facing + ' f' + frames[i].info.frame + ' ' + frames[i].info.walk.toFixed(0), i * 124 + 4, 138);
        }
        resolve(c.toDataURL('image/png').split(',')[1]); })`);
      fs.writeFileSync(path.join(outDir, `guide-steps-1.6x-${facing}.png`), Buffer.from(strip, 'base64'));
      console.log(`saved guide-steps-1.6x-${facing}.png`);
    }
    if (page.problems.length) throw new Error(page.problems.join('\n'));
  } finally {
    await page.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });

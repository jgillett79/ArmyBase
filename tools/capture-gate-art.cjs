// Gate checkpoint + bridge review captures, driven by the real simulation.
//
//   node tools/capture-gate-art.cjs [outDir]     (default: captures/gate-art/)
//
// A visitor spawns outside, stops at the check-in point in front of the
// closed boom, the boom swings open, they walk through and cross the brook
// bridge. Saves, at 960 x 576:
//   gate-seq-1.6x.png   four moments at zoom 1.6 (paused / swinging / through / on the bridge)
//   gate-home-1x.png    the default camera with the visitor on the bridge
//   gate-phone.png      the same moment on a 390 x 844 phone
//   gate-clip.webm      12 s continuous clip at zoom 1.6 of the whole passage
//   gate-checks.txt     what was measured (boom angle per moment, visitor position)
const fs = require('node:fs');
const path = require('node:path');
const { sleep, startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'captures', 'gate-art'));

const SCENE = `(() => { localStorage.clear();
  gameState = new GameState(); gameState.gameClockMs = 9 * 3600000; gameState.lastCivilianSpawn = 0;
  gameState.spawnCivilianIfRoom(); gameState.lastCivilianSpawn = Date.now() + 1e9;
  window.__visitor = gameState.units.find(u => u.isCivilian); selectedUnitId = null; return true; })()`;
const frame = zoom => `camera.zoom = ${zoom}; camera.centreOn(118, 600); true`;
const STATE = `({ x: Math.round(__visitor.x), y: Math.round(__visitor.y), paused: !!__visitor.checkpointUntil,
  left: __visitor.checkpointUntil ? __visitor.checkpointUntil - Date.now() : null, boom: Math.round(boomState.angle) })`;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  const checks = [];
  const shot = async () => {
    const clip = await page.evaluate(`(() => { const r = document.getElementById('gameCanvas').getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height, scale: 1 }; })()`);
    return (await page.send('Page.captureScreenshot', { format: 'png', clip })).data;
  };
  const waitFor = async (expr, ms, zoom) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(60)) {
      if (zoom) await page.evaluate(frame(zoom));
      if (await page.evaluate(expr)) return true;
    }
    return false;
  };
  const save = (name, b64) => { fs.writeFileSync(path.join(outDir, name), Buffer.from(b64, 'base64')); console.log(`saved ${name}`); };
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.navigate(`${server.url}/index.html`, `document.readyState === 'complete' && typeof gameState !== 'undefined'`);
    await page.evaluate(`document.getElementById('gameArea').scrollIntoView({ block: 'center' }); true`);
    await waitFor('checkpointArtReady() && bridgeArt(WORLD.bridges[0]) !== null', 8000);
    checks.push(`${await page.evaluate('checkpointArtReady()') ? 'PASS' : 'FAIL'} checkpoint art loaded (otherwise the interim gatehouse draws)`);
    checks.push(`${await page.evaluate('bridgeArt(WORLD.bridges[0]) !== null') ? 'PASS' : 'FAIL'} bridge art loaded (otherwise the procedural bridge draws)`);

    // Four moments at 1.6x, recorded continuously as well.
    await page.evaluate(SCENE);
    await page.evaluate(frame(1.6));
    await page.evaluate(`window.__rec = (() => { const stream = document.getElementById('gameCanvas').captureStream(30);
      const r = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 4e6 }); const chunks = [];
      r.ondataavailable = e => chunks.push(e.data); r.start(500);
      return { stop: () => new Promise(ok => { r.onstop = async () => { const b = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = '';
        for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); ok(btoa(s)); }; r.stop(); }) }; })(); true`);
    const moments = [
      ['paused at the closed boom', `__visitor.checkpointUntil && __visitor.checkpointUntil - Date.now() > 1500`],
      ['boom swinging open', `boomState.angle > -70 && boomState.angle < -20`],
      ['walking through the open gate', `__visitor.x > 44 && __visitor.x < 90 && !__visitor.checkpointUntil`],
      ['on the bridge, behind the near rail', `__visitor.x > 150 && __visitor.x < 206 && Math.abs(__visitor.y - 614) < 6`],
    ];
    const shots = [];
    for (const [label, expr] of moments) {
      const ok = await waitFor(expr, 20000, 1.6);
      const state = await page.evaluate(STATE);
      shots.push({ label, png: await shot() });
      checks.push(`${ok ? 'PASS' : 'FAIL'} ${label}: visitor (${state.x}, ${state.y}), boom ${state.boom} deg`);
    }
    // After they have gone east, the boom returns to closed.
    const closed = await waitFor(`__visitor.x > 240 && boomState.angle <= -89`, 12000, 1.6);
    checks.push(`${closed ? 'PASS' : 'FAIL'} boom closes again once the gap is clear`);
    save('gate-clip.webm', await page.evaluate('__rec.stop()'));
    save('gate-seq-1.6x.png', await page.evaluate(`new Promise(async resolve => {
      const shots = ${JSON.stringify(shots.map(s => ({ label: s.label, png: s.png })))};
      const c = document.createElement('canvas'); c.width = 1920; c.height = 1152; const g = c.getContext('2d');
      for (let i = 0; i < shots.length; i++) {
        const img = await new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.src = 'data:image/png;base64,' + shots[i].png; });
        const x = (i % 2) * 960, y = Math.floor(i / 2) * 576; g.drawImage(img, x, y);
        g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x + 8, y + 540, 460, 28); g.fillStyle = '#fff'; g.font = 'bold 16px sans-serif';
        g.fillText((i + 1) + '. ' + shots[i].label + ' (zoom 1.6)', x + 16, y + 560);
      }
      resolve(c.toDataURL('image/png').split(',')[1]); })`));

    // Default camera and phone, visitor on the bridge.
    await page.evaluate(SCENE);
    await page.evaluate('camera.home(); true');
    await waitFor(moments[3][1], 20000);
    save('gate-home-1x.png', await shot());
    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await sleep(400);
    await page.evaluate(SCENE);
    await page.evaluate(`camera.home(); document.getElementById('gameArea').scrollIntoView({ block: 'start' }); true`);
    const phoneOk = await waitFor(moments[3][1], 20000);
    save('gate-phone.png', (await page.send('Page.captureScreenshot', { format: 'png' })).data);
    checks.push(`${phoneOk ? 'PASS' : 'FAIL'} phone: visitor on the bridge`);
    if (page.problems.length) checks.push(...page.problems.map(p => `PROBLEM ${p}`));
  } finally {
    fs.writeFileSync(path.join(outDir, 'gate-checks.txt'), checks.join('\n') + '\n');
    console.log(checks.join('\n'));
    await page.close();
    server.close();
  }
  if (checks.some(c => !c.startsWith('PASS'))) process.exitCode = 1;
})().catch(error => { console.error(error); process.exit(1); });

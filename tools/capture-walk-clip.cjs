// Continuous game-size clip of the candidate soldier walk (?art=candidates).
//
//   node tools/capture-walk-clip.cjs [outDir]    (default: captures/walk-clip/)
//
// Two soldiers (staggered) loop on the west trail between junctions w1 and
// t2 through normal routing: walk DOWN (drawn walk), stand facing down for
// 3 s (drawn idle), walk back UP (still sprite — up isn't drawn yet), repeat.
// This is the down-walk/idle continuity check. Saves:
//   walk-clip-30s.webm          30 s at zoom 1 (game size), 960 x 576
//   walk-clip-contact.png       six frames from the clip
//   walk-steps-1.6x.png         12 consecutive frames (every 80 ms) cropped
//                               around one soldier walking down at zoom 1.6,
//                               with the ground point marked, to judge
//                               planted feet against the ground
const fs = require('node:fs');
const path = require('node:path');
const { sleep, startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'captures', 'walk-clip'));

const SCENE = `(() => { localStorage.clear();
  gameState = new GameState(); gameState.cash = 5000; gameState.food = 400; gameState.gameClockMs = 9 * 3600000;
  gameState.lastCivilianSpawn = Date.now() + 1e9; gameState.barracks.level = 1; gameState.shootingRange.level = 1;
  if (window.__shuttle) clearInterval(window.__shuttle);
  const top = worldNodePosition('w1');
  window.__walkers = ['Grace Okafor', 'Kenji Rossi'].map((name, i) => {
    const u = new Unit({ x: top.x, y: top.y, isCivilian: false });
    u.name = name; u.soldierVariant = i + 2; u.energy = 100; gameState.units.push(u);
    u.__leg = 'wait'; u.__until = Date.now() + i * 2200; return u; });
  // Idle soldiers with no job keep whatever path they are given.
  window.__shuttle = setInterval(() => { for (const u of __walkers) {
    if (u.path.length || Date.now() < u.__until) continue;
    if (u.__leg === 'wait' || u.__leg === 'up') { u.__leg = 'down'; gameState.routeToNode(u, 't2'); }
    else if (u.__leg === 'down') { u.__leg = 'idle'; u.facing = 'down'; u.__until = Date.now() + 3000; }
    else { u.__leg = 'up'; gameState.routeToNode(u, 'w1'); } } }, 100);
  selectedUnitId = null; camera.zoom = 1; camera.centreOn(430, 520); return true; })()`;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.navigate(`${server.url}/index.html?art=candidates`, `document.readyState === 'complete' && typeof gameState !== 'undefined'`);
    await page.evaluate(`document.getElementById('gameArea').scrollIntoView({ block: 'center' }); true`);
    await sleep(800);
    await page.evaluate(SCENE);
    const clip = await page.evaluate(`new Promise(resolve => {
      const stream = document.getElementById('gameCanvas').captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 5e6 });
      const chunks = []; recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => { const b = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = '';
        for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); resolve(s && btoa(s)); };
      recorder.start(1000); setTimeout(() => recorder.stop(), 30000); })`);
    fs.writeFileSync(path.join(outDir, 'walk-clip-30s.webm'), Buffer.from(clip, 'base64'));
    console.log('saved walk-clip-30s.webm');
    const walked = await page.evaluate(`__walkers.map(u => Math.round(u.walkDistance))`);
    const downFrames = await page.evaluate(`typeof frameStrip === 'function' && !!frameStrip(ASSET_MANIFEST.units.soldier.walk.drawn.down)`);
    console.log(`walked (world px): ${walked.join(', ')}; down-walk candidate loaded: ${downFrames}`);

    const sheet = await page.evaluate(`new Promise(async resolve => {
      const video = document.createElement('video'); video.muted = true;
      video.src = URL.createObjectURL(new Blob([Uint8Array.from(atob('${clip}'), c => c.charCodeAt(0))], { type: 'video/webm' }));
      await new Promise(r => { video.onloadeddata = r; });
      const c = document.createElement('canvas'); c.width = 1440; c.height = 576; const g = c.getContext('2d'); g.font = 'bold 16px sans-serif';
      const times = [2, 7, 12, 17, 22, 28];
      for (let i = 0; i < times.length; i++) { video.currentTime = times[i]; await new Promise(r => { video.onseeked = r; });
        const x = (i % 3) * 480, y = Math.floor(i / 3) * 288; g.drawImage(video, x, y, 480, 288);
        g.fillStyle = '#000a'; g.fillRect(x + 6, y + 6, 54, 24); g.fillStyle = '#fff'; g.fillText(times[i] + 's', x + 14, y + 24); }
      resolve(c.toDataURL('image/png').split(',')[1]); })`);
    fs.writeFileSync(path.join(outDir, 'walk-clip-contact.png'), Buffer.from(sheet, 'base64'));
    console.log('saved walk-clip-contact.png');

    // Close strip: follow one soldier walking down at 1.6x.
    await page.evaluate(SCENE);
    const walker = `__walkers[0]`;
    for (let i = 0; i < 100; i++) {
      await sleep(80);
      if (await page.evaluate(`${walker}.__leg === 'down' && ${walker}.path.length > 3`)) break;
    }
    const frames = [];
    for (let i = 0; i < 12; i++) {
      const info = await page.evaluate(`(() => { const u = ${walker}; camera.zoom = 1.6; camera.centreOn(u.x, u.y - 20);
        const s = camera.worldToScreen(u.x, u.y); return { sx: s.x, sy: s.y, facing: u.facing, walk: u.walkDistance }; })()`);
      await sleep(16);
      const r = await page.evaluate(`(() => { const r = document.getElementById('gameCanvas').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY }; })()`);
      const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: r.x + info.sx - 60, y: r.y + info.sy - 100, width: 120, height: 120, scale: 1 } });
      frames.push({ data, info });
      await sleep(64);
    }
    const strip = await page.evaluate(`new Promise(async resolve => {
      const frames = ${JSON.stringify(frames)};
      const c = document.createElement('canvas'); c.width = 12 * 124; c.height = 150; const g = c.getContext('2d');
      g.fillStyle = '#16211d'; g.fillRect(0, 0, c.width, c.height); g.font = '11px monospace';
      for (let i = 0; i < frames.length; i++) {
        const img = await new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.src = 'data:image/png;base64,' + frames[i].data; });
        g.drawImage(img, i * 124, 0);
        g.strokeStyle = '#ff4a4a'; g.beginPath(); g.moveTo(i * 124 + 40, 100); g.lineTo(i * 124 + 80, 100); g.stroke();
        g.fillStyle = '#eee'; g.fillText(frames[i].info.facing + ' ' + frames[i].info.walk.toFixed(0), i * 124 + 4, 138);
      }
      resolve(c.toDataURL('image/png').split(',')[1]); })`);
    fs.writeFileSync(path.join(outDir, 'walk-steps-1.6x.png'), Buffer.from(strip, 'base64'));
    console.log('saved walk-steps-1.6x.png');
    if (page.problems.length) throw new Error(page.problems.join('\n'));
    if (!downFrames) throw new Error('down-walk candidate strip did not load');
  } finally {
    await page.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });

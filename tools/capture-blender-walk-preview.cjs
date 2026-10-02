// Records the isolated Blender walk preview (tools/blender-walk-preview.html):
// one soldier walking right on trail t1 -> t4 at game speed, stopping and
// idling, drawn from the calibrated Blender frames, at game size and at max
// zoom side by side. The game, its manifest and the walk gate are untouched.
//
//   node tools/capture-blender-walk-preview.cjs [outDir]   (default art/review/blender-walk-05)
//
// Saves:
//   walk-preview-30s.webm   30 s, both views (1600 x 500)
//   stride-steps-zoom.png   12 consecutive zoomed snapshots through a stride,
//                           ground point marked (planted feet vs the ground)
//   stop-steps-zoom.png     the stop and first idle frames, same marking
//   preview-stats.json      calibration, phase, planted-foot drift, frame checks
const fs = require('node:fs');
const path = require('node:path');
const { sleep, startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'art', 'review', 'blender-walk-05'));

// Zoomed snapshots: crops of the following (max zoom) panel around the
// soldier, with a cross on the unit's ground point and a ground line.
const SNAPS = mode => `(async () => {
  const p = window.preview, v = p.views[1], shots = [];
  // 2x enlargement without smoothing: the screen pixels as drawn at max zoom.
  const crop = () => { const s = v.camera.worldToScreen(p.unit.x, p.unit.y), cw = 72, ch = 104, M = 2, w = cw * M, h = ch * M, base = (ch - 12) * M;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(v.canvas, Math.round(s.x) - cw / 2, Math.round(s.y) - ch + 12, cw, ch, 0, 0, w, h);
    g.strokeStyle = 'rgba(255,60,60,0.9)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, base + 0.5); g.lineTo(w, base + 0.5); g.stroke();
    g.beginPath(); g.moveTo(w / 2 - 5, base); g.lineTo(w / 2 + 5, base); g.moveTo(w / 2, base - 5); g.lineTo(w / 2, base + 5); g.stroke();
    g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText('f' + p.sim.frame + ' ' + p.sim.mode, 4, 12);
    g.fillText('x ' + p.unit.x.toFixed(1), 4, 24); return c; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  ${mode === 'stride'
    ? `while (!(p.sim.mode === 'walk' && p.unit.x > 400 && p.unit.x < 420)) await wait(5);
       for (let i = 0; i < 12; i++) { shots.push(crop()); await wait(70); }`
    : `while (p.sim.mode !== 'stop') await wait(1);
       let lastFrame = -1; const t0 = performance.now();
       while (shots.length < 14 && performance.now() - t0 < 2500) { if (p.sim.frame !== lastFrame) { lastFrame = p.sim.frame; shots.push(crop()); } await wait(2); }`}
  const W = shots[0].width, H = shots[0].height, sheet = document.createElement('canvas');
  sheet.width = W * shots.length; sheet.height = H + 18; const g = sheet.getContext('2d');
  g.fillStyle = '#151b17'; g.fillRect(0, 0, sheet.width, sheet.height);
  shots.forEach((s, i) => g.drawImage(s, i * W, 0));
  g.fillStyle = '#e8e4d4'; g.font = '11px sans-serif';
  g.fillText('Max game zoom (' + v.camera.zoom + ') crops shown 2x without smoothing; red: ground line and the unit ground point (pivot). Blender study, not game art.', 4, H + 13);
  return sheet.toDataURL('image/png'); })()`;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 700, deviceScaleFactor: 1, mobile: false });
    await page.navigate(`${server.url}/tools/blender-walk-preview.html`, `window.previewReady === true || !!window.previewError`);
    const error = await page.evaluate('window.previewError || null');
    if (error) throw new Error(error);
    await sleep(1500); // map sprites
    const clip = await page.evaluate(`new Promise(resolve => {
      const stream = document.getElementById('preview').captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 2.5e6 });
      const chunks = []; recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => { const b = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = '';
        for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); resolve(btoa(s)); };
      recorder.start(1000); setTimeout(() => recorder.stop(), 30000); })`);
    fs.writeFileSync(path.join(outDir, 'walk-preview-30s.webm'), Buffer.from(clip, 'base64'));
    console.log('saved walk-preview-30s.webm');
    for (const [mode, name] of [['stride', 'stride-steps-zoom.png'], ['stop', 'stop-steps-zoom.png']]) {
      const url = await page.evaluate(SNAPS(mode));
      fs.writeFileSync(path.join(outDir, name), Buffer.from(url.split(',')[1], 'base64'));
      console.log('saved ' + name);
    }
    const stats = await page.evaluate(`(() => { const p = window.preview, d = p.stats.plantedDrift;
      return { projection: { pivot: p.proj.pivot, verticalStretch: p.proj.verticalStretch, worldPxPerMetre: p.proj.worldPxPerMetre, checks: p.proj.checks },
        constants: p.constants, loops: p.stats.loops, framesDrawn: p.stats.frames, framesNotFacingRight: p.stats.notRight,
        phaseErrorAtStopPx: p.stats.phaseAtStop, stopEndRemainingPx: p.stats.stopEndError, stopSeconds: p.stats.stopSeconds,
        plantedFootDriftMaxPx: d.length ? Math.max(...d) : null, soleCheck: p.soleCheck }; })()`);
    fs.writeFileSync(path.join(outDir, 'preview-stats.json'), JSON.stringify(stats, null, 2));
    console.log(JSON.stringify({ ...stats, soleCheck: undefined }, null, 1));
    if (page.problems.length) throw new Error(page.problems.join('\n'));
  } finally { await page.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });

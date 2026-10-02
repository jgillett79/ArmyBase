// Readability comparison for the Blender walk preview (task 1 of
// CLAUDE_IMPLEMENTATION/AGENT_HANDOFF.md), from tools/blender-walk-readability.html.
// Preview only: the game, manifest and walk gate are untouched.
//
//   node tools/capture-blender-readability.cjs [outDir]   (default art/review/blender-walk-06)
//
// Saves:
//   readability-normal-size.png  cumulative variants at game size (zoom 1): 1:1 and 3x without smoothing
//   readability-max-zoom.png     the same at max zoom (1.6), 1:1 and 2x
//   readability-20s.webm         current vs readable, game size and max zoom, real speed
//   framerule-12s.webm           floor vs nearest frame, readable look, max zoom
//   framerule-stance.png         floor vs nearest through one stance, crops on the true planted spot, 6x
//   readability-stats.json       drift/positional error for both rules, constants
const fs = require('node:fs');
const path = require('node:path');
const { sleep, startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'art', 'review', 'blender-walk-06'));

const RECORD = seconds => `new Promise(resolve => {
  const stream = document.getElementById('out').captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 2.5e6 });
  const chunks = []; recorder.ondataavailable = e => chunks.push(e.data);
  recorder.onstop = async () => { const b = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); resolve(btoa(s)); };
  recorder.start(1000); setTimeout(() => recorder.stop(), ${seconds * 1000}); })`;

// Ladder: every variant, same trail spot, frames 4 (mid-stance), 10 (heel-off),
// 16 (swing) and 72 (idle), on the real map.
const LADDER = (zoom, cw, ch, M) => `(() => { const cw = ${cw}, ch = ${ch}, M = ${M}, r = window.readability, keys = Object.keys(r.VARIANTS), frames = [4, 10, 16, 72];
  const spot = worldNodePosition('t3'), labelH = 18, cellW = cw * (1 + M) + 12, cellH = Math.max(ch, ch * M) + 6;
  const sheet = document.createElement('canvas'); sheet.width = frames.length * cellW + 170; sheet.height = keys.length * cellH + labelH + 22;
  const g = sheet.getContext('2d'); g.fillStyle = '#151b17'; g.fillRect(0, 0, sheet.width, sheet.height); g.imageSmoothingEnabled = false;
  g.fillStyle = '#e8e4d4'; g.font = 'bold 12px sans-serif';
  frames.forEach((f, j) => g.fillText('frame ' + f + (f === 72 ? ' (idle)' : f === 10 ? ' (heel-off)' : f === 16 ? ' (swing)' : ' (stance)') + ': 1:1 and ' + M + 'x', 170 + j * cellW, 13));
  keys.forEach((k, i) => { const y = labelH + i * cellH; g.fillStyle = '#e8e4d4'; g.font = '12px sans-serif'; g.fillText(r.VARIANTS[k].label, 6, y + ch / 2 + 4);
    frames.forEach((f, j) => { const c = r.stillCrop(k, f, ${zoom}, spot.x, spot.y, cw, ch), x = 170 + j * cellW;
      g.drawImage(c, x, y); g.drawImage(c, x + cw + 6, y, cw * M, ch * M); }); });
  g.fillStyle = '#9aa392'; g.font = '11px sans-serif';
  g.fillText('Zoom ${zoom} on trail node t3, the real map; cumulative variants (top to bottom); right of each pair: ' + M + 'x without smoothing. Preview only, not game art.', 6, sheet.height - 7);
  return sheet.toDataURL('image/png'); })()`;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  const save = (name, data) => { fs.writeFileSync(path.join(outDir, name), Buffer.from(data.split(',').pop(), 'base64')); console.log('saved ' + name); };
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const layout of ['readability', 'framerule']) {
      await page.navigate(`${server.url}/tools/blender-walk-readability.html?layout=${layout}`, `window.readabilityReady === true || !!window.readabilityError`);
      const error = await page.evaluate('window.readabilityError || null');
      if (error) throw new Error(error);
      await sleep(1500);
      if (layout === 'readability') {
        save('readability-normal-size.png', await page.evaluate(LADDER(1, 60, 76, 3)));
        save('readability-max-zoom.png', await page.evaluate(LADDER(1.6, 92, 116, 2)));
        save('readability-20s.webm', 'x,' + await page.evaluate(RECORD(20)));
        const stats = await page.evaluate(`({ constants: window.readability.constants, floor: window.readability.measureRule('floor'), nearest: window.readability.measureRule('nearest') })`);
        fs.writeFileSync(path.join(outDir, 'readability-stats.json'), JSON.stringify(stats, null, 2));
        console.log(JSON.stringify(stats, null, 1));
      } else {
        save('framerule-12s.webm', 'x,' + await page.evaluate(RECORD(12)));
        save('framerule-stance.png', await page.evaluate(`window.readability.ruleSheet().toDataURL('image/png')`));
      }
    }
    if (page.problems.length) throw new Error(page.problems.join('\n'));
  } finally { await page.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });

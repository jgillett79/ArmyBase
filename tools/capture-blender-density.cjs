// Task 2 (CLAUDE_IMPLEMENTATION/AGENT_HANDOFF.md): 24 vs 48 walk phases with
// nearest-frame selection in the isolated readability preview
// (tools/blender-walk-readability.html?layout=density). Preview only.
//
//   node tools/capture-blender-density.cjs [outDir]   (default art/review/blender-walk-07)
//
// Saves:
//   density-25s.webm            25 s, 24 vs 48 phases, game size and max zoom; capture 60 fps (sprites update
//                               by distance: 24 or 48 phases per 22 px)
//   density-comparison.png      one instant of the four panels
//   density-stance-zoom1.png    one flat stance in 22/48 px steps, 24 vs 48, game size, 6x without smoothing
//   density-stance-zoom1.6.png  the same at max zoom
//   density-frames.json         export counts and bytes per set
const fs = require('node:fs');
const path = require('node:path');
const { sleep, startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'art', 'review', 'blender-walk-07'));
const CAPTURE_FPS = 60;

const RECORD = seconds => `new Promise(resolve => {
  const stream = document.getElementById('out').captureStream(${CAPTURE_FPS});
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 3e6 });
  const chunks = []; recorder.ondataavailable = e => chunks.push(e.data);
  let frames = 0; const count = () => { frames++; if (recorder.state === 'recording') requestAnimationFrame(count); }; requestAnimationFrame(count);
  recorder.onstop = async () => { const b = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); resolve({ clip: btoa(s), pageFrames: frames }); };
  recorder.start(1000); setTimeout(() => recorder.stop(), ${seconds * 1000}); })`;

const SHEET = zoom => `window.readability.ruleSheet(12, 22 / 48, ${zoom}, 6, [
  { label: '24 phases', variant: 'readable24', rule: 'nearest' }, { label: '48 phases', variant: 'readable48', rule: 'nearest' }]).toDataURL('image/png')`;

function frameBytes(dir, max) {
  const files = fs.readdirSync(dir).filter(f => /^\d+\.png$/.test(f) && Number(f.slice(0, 3)) <= max);
  return { count: files.length, bytes: files.reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0) };
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  const save = (name, data) => { fs.writeFileSync(path.join(outDir, name), Buffer.from(data.split(',').pop(), 'base64')); console.log('saved ' + name); };
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.navigate(`${server.url}/tools/blender-walk-readability.html?layout=density`, `window.readabilityReady === true || !!window.readabilityError`);
    const error = await page.evaluate('window.readabilityError || null');
    if (error) throw new Error(error);
    await sleep(1500);
    save('density-stance-zoom1.png', await page.evaluate(SHEET(1)));
    save('density-stance-zoom1.6.png', await page.evaluate(SHEET(1.6)));
    await page.evaluate(`new Promise(r => { const p = window.readability.walkers.d48; const tick = () => (p.mode === 'walk' && p.unit.x > 430) ? r() : setTimeout(tick, 20); tick(); })`);
    save('density-comparison.png', await page.evaluate(`document.getElementById('out').toDataURL('image/png')`));
    const { clip, pageFrames } = await page.evaluate(RECORD(25));
    save('density-25s.webm', 'x,' + clip);
    const info = {
      captureFps: CAPTURE_FPS, pageAnimationFramesDuringCapture: pageFrames, pageFps: +(pageFrames / 25).toFixed(1),
      note: 'Sprite phases are chosen by distance (24 or 48 per 22 px at 38 px/s = 41.5 or 82.9 phase changes per second), independent of capture fps; the page redraws at its own animation-frame rate.',
      sets: {
        '24': { walkPhases: 24, ...frameBytes(path.join(root, 'art/review/blender-walk-06/frames-warm-contrast/right'), 24), dir: 'art/review/blender-walk-06/frames-warm-contrast/right (frames 1-24)' },
        '48': { walkPhases: 48, ...frameBytes(path.join(outDir, 'frames-48-warm-contrast/right'), 48), dir: path.relative(root, path.join(outDir, 'frames-48-warm-contrast/right')).split(path.sep).join('/') },
        stopIdleShared: { ...frameBytes(path.join(root, 'art/review/blender-walk-06/frames-warm-contrast/right'), 72), note: 'all 37 frames of the 24 set; stop 49-60 and idle 72 are used by both' },
      },
    };
    fs.writeFileSync(path.join(outDir, 'density-frames.json'), JSON.stringify(info, null, 2));
    console.log(JSON.stringify(info, null, 1));
    if (page.problems.length) throw new Error(page.problems.join('\n'));
  } finally { await page.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });

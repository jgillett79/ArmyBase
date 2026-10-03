// Task 3 (CLAUDE_IMPLEMENTATION/AGENT_HANDOFF.md): right-facing idle-to-walk
// start in the isolated readability preview (?layout=start). Preview only.
//
//   node tools/capture-blender-start.cjs [outDir]   (default art/review/blender-walk-08)
//
// Saves:
//   start-25s.webm             25 s: old abrupt start vs candidate, game size and max zoom, repeated
//                              idle -> start -> walk -> reused stop -> idle (capture 60 fps requested)
//   start-comparison.png       one instant just after both started
//   start-transition-zoom.png  idle, every rendered start frame and the first loop frames, max zoom,
//                              fixed camera on the idle spot, 3x without smoothing; red = support spot
//   start-capture.json         redraw count/fps, image deltas at the boundaries, frame bytes
const fs = require('node:fs');
const path = require('node:path');
const { sleep, startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'art', 'review', 'blender-walk-08'));

const RECORD = seconds => `new Promise(resolve => {
  const stream = document.getElementById('out').captureStream(60);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 3e6 });
  const chunks = []; recorder.ondataavailable = e => chunks.push(e.data);
  let frames = 0; const count = () => { frames++; if (recorder.state === 'recording') requestAnimationFrame(count); }; requestAnimationFrame(count);
  recorder.onstop = async () => { const b = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); resolve({ clip: btoa(s), pageFrames: frames }); };
  recorder.start(1000); setTimeout(() => recorder.stop(), ${seconds * 1000}); })`;

// Transition strip: step the candidate and the old walker in 1/48 s steps from
// the end of the idle, fixed camera on the idle spot; red tick at the right
// foot's planted spot (the idle spot's right sole).
const STRIP = `(() => { const r = window.readability, M = 3, cw = 46, ch = 74, steps = 26, rows = [['Candidate', 'start48'], ['Old (abrupt)', 'readable48']];
  const sheet = document.createElement('canvas'); sheet.width = 110 + steps * (cw * M + 4); sheet.height = rows.length * (ch * M + 22) + 26;
  const g = sheet.getContext('2d'); g.fillStyle = '#151b17'; g.fillRect(0, 0, sheet.width, sheet.height); g.imageSmoothingEnabled = false;
  rows.forEach(([label, key], j) => { const w = r.makeWalker(key, 'nearest'); w.advance(r.START.IDLE_BEFORE - 1 / 48, 0);
    const spot = { x: w.unit.x, y: w.unit.y }, cam = new Camera(cw, ch); cam.zoom = 1.6; cam.centreOn(spot.x + 5, spot.y - 30);
    const y = 18 + j * (ch * M + 22); g.fillStyle = '#e8e4d4'; g.font = 'bold 13px sans-serif'; g.fillText(label, 6, y + ch * M / 2);
    for (let i = 0; i < steps; i++) { const c = document.createElement('canvas'); c.width = cw; c.height = ch; r.renderWalker(c.getContext('2d'), w, cam, 0);
      const x = 110 + i * (cw * M + 4); g.drawImage(c, x, y, cw * M, ch * M);
      const p = cam.worldToScreen(spot.x, spot.y + 0.105 * 23.3165); g.fillStyle = 'rgba(255,50,50,0.9)'; g.fillRect(x + p.x * M - 1, y + ch * M - 10, 2, 10);
      g.fillStyle = '#e8e4d4'; g.font = '11px sans-serif'; g.fillText('f' + w.frame + ' ' + w.mode, x + 2, y + ch * M + 13);
      w.advance(1 / 48, 0); } });
  g.fillStyle = '#9aa392'; g.font = '11px sans-serif';
  g.fillText('Max zoom 1.6, 3x without smoothing, 1/48 s per cell from the last idle frame; red: the right boot\\u2019s planted spot at the idle position. f101-120 = rendered start, f1-48 = 48-phase loop, f72 = idle. Preview only.', 6, sheet.height - 8);
  return sheet.toDataURL('image/png'); })()`;

// Mean absolute RGBA difference (0-255) between two rendered frames.
const DIFFS = `(async () => { const px = async src => { const i = new Image(); i.src = src; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
  const p = n => String(n).padStart(3, '0'), idle = '/art/review/blender-walk-06/frames-warm-contrast/right/', loop = '/art/review/blender-walk-07/frames-48-warm-contrast/right/', start = '/art/review/blender-walk-08/frames-start-warm-contrast/right/';
  const pairs = { 'idle72 -> start101': [idle + '072.png', start + '101.png'], 'start101 -> start102': [start + '101.png', start + '102.png'], 'start119 -> start120': [start + '119.png', start + '120.png'],
    'start120 -> loop25 (handover)': [start + '120.png', loop + '025.png'], 'loop25 -> loop26 (reference)': [loop + '025.png', loop + '026.png'], 'loop24 -> loop25 (reference)': [loop + '024.png', loop + '025.png'],
    'idle72 -> loop25 (old abrupt start)': [idle + '072.png', loop + '025.png'] };
  const out = {}; for (const [k, [a, b]] of Object.entries(pairs)) { const A = await px(a), B = await px(b); let s = 0; for (let i = 0; i < A.length; i++) s += Math.abs(A[i] - B[i]); out[k] = +(s / A.length).toFixed(3); } return out; })()`;

function frameBytes(dir, test) { const files = fs.readdirSync(dir).filter(f => /^\d+\.png$/.test(f) && test(Number(f.slice(0, 3))));
  return { count: files.length, bytes: files.reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0) }; }

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  const save = (name, data) => { fs.writeFileSync(path.join(outDir, name), Buffer.from(data.split(',').pop(), 'base64')); console.log('saved ' + name); };
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.navigate(`${server.url}/tools/blender-walk-readability.html?layout=start`, `window.readabilityReady === true || !!window.readabilityError`);
    const error = await page.evaluate('window.readabilityError || null');
    if (error) throw new Error(error);
    save('start-transition-zoom.png', await page.evaluate(STRIP));
    const diffs = await page.evaluate(DIFFS);
    // Reload so the clip starts from the beginning of an idle.
    await page.navigate(`${server.url}/tools/blender-walk-readability.html?layout=start`, `window.readabilityReady === true || !!window.readabilityError`);
    await sleep(300);
    const { clip, pageFrames } = await page.evaluate(RECORD(25));
    save('start-25s.webm', 'x,' + clip);
    await page.evaluate(`new Promise(r => { const w = window.readability.walkers.new; const tick = () => (w.mode === 'walk' && w.unit.walkDistance > 14 && w.unit.walkDistance < 16) ? r() : setTimeout(tick, 5); tick(); })`);
    save('start-comparison.png', await page.evaluate(`document.getElementById('out').toDataURL('image/png')`));
    const handover = await page.evaluate(`window.readability.walkers.new.handover || null`);
    const info = { captureFpsRequested: 60, pageRedrawsDuringCapture: pageFrames, pageFps: +(pageFrames / 25).toFixed(1), handoverRemainingRoutePx: handover,
      meanAbsRGBADiff0to255: diffs,
      frames: { start: { ...frameBytes(path.join(outDir, 'frames-start-warm-contrast/right'), n => n >= 101), dir: 'art/review/blender-walk-08/frames-start-warm-contrast/right' },
        loop48: { ...frameBytes(path.join(root, 'art/review/blender-walk-07/frames-48-warm-contrast/right'), n => n <= 48), dir: 'art/review/blender-walk-07/frames-48-warm-contrast/right (reused)' },
        stopIdle24set: { ...frameBytes(path.join(root, 'art/review/blender-walk-06/frames-warm-contrast/right'), n => n >= 49), dir: 'art/review/blender-walk-06/frames-warm-contrast/right 49-60, 72 (reused, 24-phase timing unchanged)' } } };
    fs.writeFileSync(path.join(outDir, 'start-capture.json'), JSON.stringify(info, null, 2));
    console.log(JSON.stringify(info, null, 1));
    if (page.problems.length) throw new Error(page.problems.join('\n'));
  } finally { await page.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });

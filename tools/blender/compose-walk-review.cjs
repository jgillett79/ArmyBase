// Review material for a Blender walk study (brief 11). Not game art.
//
//   node tools/blender/compose-walk-review.cjs <walkStudyDir> <outDir> [--clip-seconds 8]
//
// Reads <walkStudyDir>/motion-report.json and the rendered frames in
// <walkStudyDir>/{right,three_quarter}/NNN.png (from build_walk_study.py
// --render-step N; frame 072 is the idle). Writes:
//   contact-sheet.png    every rendered loop frame per view, one shared crop,
//                        the ground line, and which leg is planted (report)
//   travel-overlay.png   right view: the loop frames laid over each other,
//                        each shifted by its virtual travel (motion report), so a
//                        planted boot that truly stays put stacks into one
//   game-size-44px.png   the loop scaled to a 44 px figure, 1x and 4x
//   walk-loop.webm       both views plus the 44 px figure, looping at the
//                        REAL rate: 24 / render step fps (step 3 -> 8 fps)
//   key-poses.png        walk/stop/idle key frames near full render size
//   walk-stop-idle.webm  (render step 1 only) two cycles, the stop and a held
//                        idle at 24 fps, the right view travelling
const fs = require('node:fs');
const path = require('node:path');
const { startStaticServer, launchBrowser } = require('../lib/browser.cjs');

const root = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const [walkArg, outArg] = args.filter(a => !a.startsWith('--'));
if (!walkArg || !outArg) { console.error('usage: compose-walk-review.cjs <walkStudyDir> <outDir> [--clip-seconds N]'); process.exit(2); }
const clipSeconds = Number(args[args.indexOf('--clip-seconds') + 1]) || 8;
const walk = path.relative(root, path.resolve(walkArg)).split(path.sep).join('/');
const outDir = path.resolve(outArg);
const report = JSON.parse(fs.readFileSync(path.join(root, walk, 'motion-report.json'), 'utf8'));
const frames = fs.readdirSync(path.join(root, walk, 'right')).filter(f => /^\d+\.png$/.test(f)).map(f => parseInt(f, 10)).sort((a, b) => a - b);
const loop = frames.filter(f => f <= report.walkFrames[1]);
const step = loop.length > 1 ? loop[1] - loop[0] : 1;
const fps = report.fps / step;
// Render camera (build_soldier_study.py): orthographic, scale 2.35 m across the
// 1536 px height -> px per metre. Right view: travel (-Y) is screen-right.
const PX_PER_M = 1536 / 2.35;

const PAGE = `(async () => {
  const walk = ${JSON.stringify(walk)}, loop = ${JSON.stringify(loop)}, idle = ${JSON.stringify(frames.filter(f => f > report.walkFrames[1]))};
  const contacts = ${JSON.stringify(report.contacts)}, fps = ${fps}, step = ${step}, PX_PER_M = ${PX_PER_M};
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(src)); i.src = src; });
  const pad = n => String(n).padStart(3, '0');
  const views = ['right', 'three_quarter'];
  const img = {}; for (const v of views) { img[v] = {}; for (const f of [...loop, ...idle]) img[v][f] = await load('/' + walk + '/' + v + '/' + pad(f) + '.png'); }
  const bounds = im => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0, y0, x1, y1 }; };
  // One crop per view covering every frame, so nothing jumps between cells.
  const crop = {}; for (const v of views) { const bs = Object.values(img[v]).map(bounds);
    crop[v] = { x0: Math.min(...bs.map(b => b.x0)) - 12, y0: Math.min(...bs.map(b => b.y0)) - 12, x1: Math.max(...bs.map(b => b.x1)) + 12, y1: Math.max(...bs.map(b => b.y1)) + 12,
      ground: Math.max(...bs.map(b => b.y1)), height: Math.max(...bs.map(b => b.y1 - b.y0)) }; }
  const BG = '#8a9183', INK = '#1d221b';
  const planted = f => contacts.filter(c => c.frame === f && c.planted).map(c => c.leg).join('+') || (f > ${report.walkFrames[1]} ? 'idle' : 'both swing');
  const out = {};
  // Contact sheet.
  { const S = 0.34, cells = [...loop, ...idle], cw = Math.max(...views.map(v => (crop[v].x1 - crop[v].x0) * S)) + 10;
    const rowH = Math.max(...views.map(v => (crop[v].y1 - crop[v].y0) * S)) + 50;
    const c = document.createElement('canvas'); c.width = Math.ceil(cells.length * cw + 20); c.height = Math.ceil(views.length * rowH + 60); const g = c.getContext('2d');
    g.fillStyle = BG; g.fillRect(0, 0, c.width, c.height); g.font = 'bold 14px sans-serif';
    views.forEach((v, r) => { const k = crop[v], y = 30 + r * rowH;
      g.fillStyle = INK; g.fillText(v.replace('_', '-') + ' view', 10, y - 10);
      cells.forEach((f, i) => { const x = 10 + i * cw;
        g.drawImage(img[v][f], k.x0, k.y0, k.x1 - k.x0, k.y1 - k.y0, x, y, (k.x1 - k.x0) * S, (k.y1 - k.y0) * S);
        g.strokeStyle = 'rgba(200,40,40,0.8)'; g.beginPath(); g.moveTo(x, y + (k.ground - k.y0) * S + 0.5); g.lineTo(x + cw - 10, y + (k.ground - k.y0) * S + 0.5); g.stroke();
        g.fillStyle = INK; g.fillText('f' + f + ' ' + planted(f), x, y + rowH - 22); }); });
    g.font = '13px sans-serif'; g.fillStyle = INK;
    g.fillText('Blender walk study — not game art. Red line: lowest sole pixel over all frames (ground). Rendered every ' + step + ' frame(s) of 24 fps; "R"/"L" = planted anatomical leg (motion report).', 10, c.height - 14);
    out.sheet = c.toDataURL('image/png'); }
  // Travel overlay (right view): each frame shifted by its virtual travel.
  { const k = crop.right, S = 0.75, travel = f => contacts.find(c => c.frame === f).virtualTravelMetres * PX_PER_M, speed = contacts.find(c => c.frame === 25).virtualTravelMetres;
    const span = travel(loop[loop.length - 1]) + (k.x1 - k.x0);
    const c = document.createElement('canvas'); c.width = Math.max(1180, Math.ceil(span * S + 40)); c.height = Math.ceil((k.y1 - k.y0) * S + 70); const g = c.getContext('2d');
    g.fillStyle = BG; g.fillRect(0, 0, c.width, c.height);
    loop.forEach((f, i) => { g.globalAlpha = 0.22; g.drawImage(img.right[f], k.x0, k.y0, k.x1 - k.x0, k.y1 - k.y0, 20 + travel(f) * S, 20, (k.x1 - k.x0) * S, (k.y1 - k.y0) * S); });
    g.globalAlpha = 1; g.strokeStyle = 'rgba(200,40,40,0.8)'; g.beginPath(); g.moveTo(0, 20 + (k.ground - k.y0) * S + 0.5); g.lineTo(c.width, 20 + (k.ground - k.y0) * S + 0.5); g.stroke();
    g.fillStyle = INK; g.font = '13px sans-serif';
    g.fillText('Right view, frames ' + loop[0] + '-' + loop[loop.length - 1] + ' each shifted by the virtual travel (' + speed.toFixed(3) + ' m/s = ' + (speed / 24 * PX_PER_M).toFixed(1) + ' render px per frame). Planted boots should stack into single dark boots.', 10, c.height - 14);
    out.overlay = c.toDataURL('image/png'); }
  // 44 px strip.
  const small = {}; // view -> frame -> 44 px canvas
  { const cells = [...loop, ...idle];
    for (const v of views) { small[v] = {}; const k = crop[v], s = 44 / k.height;
      for (const f of cells) { const c = document.createElement('canvas'); c.width = Math.ceil((k.x1 - k.x0) * s); c.height = Math.ceil((k.y1 - k.y0) * s);
        c.getContext('2d').drawImage(img[v][f], k.x0, k.y0, k.x1 - k.x0, k.y1 - k.y0, 0, 0, c.width, c.height); small[v][f] = c; } }
    const cw = Math.max(...views.map(v => small[v][cells[0]].width)) + 4, ch = Math.max(...views.map(v => small[v][cells[0]].height)) + 4;
    const one = document.createElement('canvas'); one.width = cells.length * cw; one.height = views.length * ch; const g = one.getContext('2d');
    g.fillStyle = '#6f7d45'; g.fillRect(0, 0, one.width, one.height);
    views.forEach((v, r) => cells.forEach((f, i) => g.drawImage(small[v][f], i * cw + 2, r * ch + 2)));
    const big = document.createElement('canvas'); big.width = one.width * 4; big.height = one.height * 4 + 40; const bg = big.getContext('2d');
    bg.fillStyle = '#1b2420'; bg.fillRect(0, 0, big.width, big.height); bg.imageSmoothingEnabled = false; bg.drawImage(one, 0, 0, one.width * 4, one.height * 4);
    bg.fillStyle = '#eee'; bg.font = '13px sans-serif'; bg.fillText('Walk frames scaled to a 44 px figure on grass colour, shown 4x without smoothing (top: right view; bottom: three-quarter; last cell: idle). Study camera, not the game projection.', 8, one.height * 4 + 26);
    out.small = big.toDataURL('image/png'); out.smallOne = one.toDataURL('image/png'); }
  // Key poses near full resolution (the contact sheet is downscaled).
  { const S = 0.6, cells = [1, 4, 7, 10, 13, 52, 56, 60, 72].filter(f => img.right[f]);
    const cw = Math.max(...views.map(v => (crop[v].x1 - crop[v].x0) * S)) + 10, rowH = Math.max(...views.map(v => (crop[v].y1 - crop[v].y0) * S)) + 40;
    const c = document.createElement('canvas'); c.width = Math.ceil(cells.length * cw + 20); c.height = Math.ceil(views.length * rowH + 40); const g = c.getContext('2d');
    g.fillStyle = BG; g.fillRect(0, 0, c.width, c.height); g.font = 'bold 18px sans-serif';
    views.forEach((v, r) => { const k = crop[v], y = 10 + r * rowH;
      cells.forEach((f, i) => { g.drawImage(img[v][f], k.x0, k.y0, k.x1 - k.x0, k.y1 - k.y0, 10 + i * cw, y, (k.x1 - k.x0) * S, (k.y1 - k.y0) * S);
        g.fillStyle = INK; g.fillText(v.replace('_', '-') + ' f' + f + ' ' + planted(f), 14 + i * cw, y + rowH - 16); }); });
    g.font = '14px sans-serif'; g.fillText('Key poses at ' + S + 'x render size (walk 1-13, stop 52-60, idle 72). Blender walk study — not game art.', 10, c.height - 12);
    out.keys = c.toDataURL('image/png'); }
  // Loop clip at the real rate.
  const k1 = crop.right, k2 = crop.three_quarter, S = 0.42;
  const W = Math.ceil(((k1.x1 - k1.x0) + (k2.x1 - k2.x0)) * S + 260), H = Math.ceil(Math.max(k1.y1 - k1.y0, k2.y1 - k2.y0) * S + 60);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); document.body.append(c);
  const draw = n => { const f = loop[n % loop.length];
    g.fillStyle = BG; g.fillRect(0, 0, W, H);
    g.drawImage(img.right[f], k1.x0, k1.y0, k1.x1 - k1.x0, k1.y1 - k1.y0, 10, 10, (k1.x1 - k1.x0) * S, (k1.y1 - k1.y0) * S);
    g.drawImage(img.three_quarter[f], k2.x0, k2.y0, k2.x1 - k2.x0, k2.y1 - k2.y0, 20 + (k1.x1 - k1.x0) * S, 10, (k2.x1 - k2.x0) * S, (k2.y1 - k2.y0) * S);
    g.imageSmoothingEnabled = false; const sm = small.right[f]; g.fillStyle = '#6f7d45'; g.fillRect(W - 220, 40, 200, 240);
    g.drawImage(sm, W - 120 - sm.width * 2, 60, sm.width * 4, sm.height * 4); g.imageSmoothingEnabled = true;
    g.fillStyle = INK; g.font = 'bold 14px sans-serif'; g.fillText('frame ' + f + ' · ' + fps + ' fps (24 fps source, every ' + step + ')', 10, H - 30);
    g.font = '12px sans-serif'; g.fillText('Blender walk study — not game art; 44 px figure shown 4x at right', 10, H - 12); };
  const record = async (paint, seconds) => {
    const stream = c.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 2.5e6 });
    const chunks = []; recorder.ondataavailable = e => chunks.push(e.data);
    const done = new Promise(r => { recorder.onstop = r; });
    recorder.start(500); const t0 = performance.now(); let n = -1;
    await new Promise(resolve => { const tick = () => { const e = performance.now() - t0; const m = Math.floor(e / 1000 * fps); if (m !== n) { n = m; paint(n); }
      if (e < seconds * 1000) requestAnimationFrame(tick); else resolve(); }; requestAnimationFrame(tick); });
    recorder.stop(); await done;
    const b = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return btoa(s); };
  out.clip = await record(draw, ${clipSeconds});
  // Walk -> stop -> idle (full renders only): two loop cycles, the stop, then a
  // held idle. The right view travels by the virtual travel so planted feet
  // read against the ground ticks; the three-quarter view stays in place.
  const stopFrames = Object.keys(img.right).map(Number).filter(f => f > ${report.walkFrames[1]} && f <= ${report.stopFrames[1]});
  if (step === 1 && stopFrames.length) {
    const travelOf = f => contacts.find(x => x.frame === f).virtualTravelMetres;
    const cycleM = travelOf(25) - travelOf(1);
    const seq = [...loop.map(f => [f, travelOf(f)]), ...loop.map(f => [f, travelOf(f) + cycleM]), ...stopFrames.map(f => [f, travelOf(f)]), ...Array(24).fill([72, travelOf(72)])];
    const T = 0.3, k = crop.right, k2 = crop.three_quarter, span = travelOf(72) * PX_PER_M * T;
    c.width = Math.ceil(span + (k.x1 - k.x0) * T + (k2.x1 - k2.x0) * T + 60); c.height = Math.ceil(Math.max(k.y1 - k.y0, k2.y1 - k2.y0) * T + 70);
    const groundY = 20 + (k.ground - k.y0) * T;
    const paint = n => { const [f, tr] = seq[Math.min(n, seq.length - 1)]; g.fillStyle = BG; g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = 'rgba(29,34,27,0.5)'; for (let m = 0; m <= 2.5; m += 0.1) { const x = 20 + m * PX_PER_M * T; g.beginPath(); g.moveTo(x, groundY + 2); g.lineTo(x, groundY + (Math.round(m * 10) % 5 ? 6 : 12)); g.stroke(); }
      g.drawImage(img.right[f], k.x0, k.y0, k.x1 - k.x0, k.y1 - k.y0, 20 + tr * PX_PER_M * T, 20, (k.x1 - k.x0) * T, (k.y1 - k.y0) * T);
      g.drawImage(img.three_quarter[f], k2.x0, k2.y0, k2.x1 - k2.x0, k2.y1 - k2.y0, c.width - (k2.x1 - k2.x0) * T - 20, 20, (k2.x1 - k2.x0) * T, (k2.y1 - k2.y0) * T);
      g.fillStyle = INK; g.font = 'bold 13px sans-serif'; g.fillText('frame ' + f + (f > ${report.stopFrames[1]} ? ' (idle)' : f > ${report.walkFrames[1]} ? ' (stop)' : ' (walk)') + ' · 24 fps · ground ticks every 0.1 m', 10, c.height - 28);
      g.font = '12px sans-serif'; g.fillText('Blender walk study — not game art. Walk, stop on the planted right foot, idle.', 10, c.height - 10); };
    out.stopClip = await record(paint, seq.length / fps + 0.5);
  }
 out.info = { fps, step, loopFrames: loop.length, crop };
  return out;
})()`;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  try {
    await page.navigate(`${server.url}/tools/world-diagnostic.html`);
    const out = await page.evaluate(PAGE);
    const save = (name, dataUrl) => { fs.writeFileSync(path.join(outDir, name), Buffer.from(dataUrl.split(',')[1], 'base64')); console.log('saved ' + name); };
    save('contact-sheet.png', out.sheet); save('travel-overlay.png', out.overlay); save('game-size-44px.png', out.small); save('game-size-44px-1x.png', out.smallOne); save('key-poses.png', out.keys);
    if (out.stopClip) { fs.writeFileSync(path.join(outDir, 'walk-stop-idle.webm'), Buffer.from(out.stopClip, 'base64')); console.log('saved walk-stop-idle.webm'); }
    fs.writeFileSync(path.join(outDir, 'walk-loop.webm'), Buffer.from(out.clip, 'base64')); console.log(`saved walk-loop.webm (${out.info.fps} fps, ${out.info.loopFrames} loop frames)`);
    if (page.problems.length) throw new Error(page.problems.join('\n'));
  } finally { await page.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });

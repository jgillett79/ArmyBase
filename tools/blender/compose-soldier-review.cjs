// Review sheets for a Blender soldier appearance study (brief 10). Review
// material only: nothing here is registered as game art.
//
//   node tools/blender/compose-soldier-review.cjs <studyDir> <outDir>
//   e.g. art/local-blender/soldier-study-02 art/review/blender-soldier-01
//
// Writes, from the study's four transparent renders:
//   turnaround.png      front / right / back / three-quarter on a neutral backdrop
//   three-quarter.png   the three-quarter render alone on a neutral backdrop
//   face-closeup.png    heads from the front and three-quarter renders, 2x
//   silhouettes.png     the four views as flat silhouettes
//   game-size-44px.png  the study's front view scaled to a 44 px figure next to
//                       the current game soldiers (live still and the painted
//                       down master) at zoom 1, then the same enlarged 4x with
//                       no smoothing. Appearance comparison only: the study
//                       camera is not the game's projection.
const fs = require('node:fs');
const path = require('node:path');
const { startStaticServer, launchBrowser, sleep } = require('../lib/browser.cjs');

const root = path.resolve(__dirname, '..', '..');
const [studyArg, outArg] = process.argv.slice(2);
if (!studyArg || !outArg) { console.error('usage: compose-soldier-review.cjs <studyDir> <outDir>'); process.exit(2); }
const study = path.relative(root, path.resolve(studyArg)).split(path.sep).join('/');
const outDir = path.resolve(outArg);
const studyReport = JSON.parse(fs.readFileSync(path.join(root, study, 'study-report.json'), 'utf8'));
const caption = `Blender appearance study, revision ${studyReport.revision || 1}${studyReport.lighting ? `, ${studyReport.lighting} lighting` : ''} (Blender ${studyReport.blender}) — not game art, not rigged, standard ortho camera at ${studyReport.camera.elevationDegrees}°`;

const PAGE = `(async () => {
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(src)); i.src = src; });
  const views = ['front', 'right', 'back', 'three_quarter'];
  const imgs = {}; for (const v of views) imgs[v] = await load('/${study}/' + v + '.png');
  // Opaque bounds of a render (alpha > 8).
  const bounds = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
  const b = {}; for (const v of views) b[v] = bounds(imgs[v]);
  const BG = '#8a9183', INK = '#1f241c';
  const out = {};
  const sheet = (w, h, fill = BG) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = fill; g.fillRect(0, 0, w, h); return [c, g]; };
  const label = (g, text, x, y) => { g.font = 'bold 22px sans-serif'; g.fillStyle = INK; g.fillText(text, x, y); };
  const NOTE = ${JSON.stringify(caption)};
  // Turnaround: crops at 0.6 on one ground line.
  { const S = 0.6, pad = 30, H = Math.max(...views.map(v => b[v].h)) * S;
    const W = views.reduce((s, v) => s + b[v].w * S + pad, pad);
    const [c, g] = sheet(Math.ceil(W), Math.ceil(H + 110)); let x = pad;
    for (const v of views) { const r = b[v]; g.drawImage(imgs[v], r.x0, r.y0, r.w, r.h, x, 60 + H - r.h * S, r.w * S, r.h * S); label(g, v.replace('_', '-'), x, 40); x += r.w * S + pad; }
    g.font = '16px sans-serif'; g.fillText(NOTE, pad, H + 95); out.turnaround = c.toDataURL('image/png'); }
  // Three-quarter alone.
  { const r = b.three_quarter, [c, g] = sheet(r.w + 160, r.h + 160);
    g.drawImage(imgs.three_quarter, r.x0, r.y0, r.w, r.h, 80, 80, r.w, r.h); g.font = '16px sans-serif'; g.fillStyle = INK; g.fillText(NOTE, 12, r.h + 140); out.threeQuarter = c.toDataURL('image/png'); }
  // Face close-up: top 22% of the figure height, 2x.
  { const crops = ['front', 'three_quarter'].map(v => { const r = b[v], h = Math.round(r.h * 0.22), w = Math.round(h * 0.95);
      const cx = v === 'front' ? (r.x0 + r.x1) / 2 : r.x0 + r.w * 0.45; return { v, x: Math.round(cx - w / 2), y: r.y0, w, h }; });
    const [c, g] = sheet(crops.reduce((s, k) => s + k.w * 2 + 30, 30), crops[0].h * 2 + 70);
    let x = 30; for (const k of crops) { g.drawImage(imgs[k.v], k.x, k.y, k.w, k.h, x, 50, k.w * 2, k.h * 2); label(g, k.v.replace('_', '-') + ' face (2x)', x, 36); x += k.w * 2 + 30; }
    out.face = c.toDataURL('image/png'); }
  // Silhouettes.
  { const S = 0.45, pad = 30, H = Math.max(...views.map(v => b[v].h)) * S;
    const W = views.reduce((s, v) => s + b[v].w * S + pad, pad); const [c, g] = sheet(Math.ceil(W), Math.ceil(H + 80), '#d9d6c8');
    let x = pad; for (const v of views) { const r = b[v]; const t = document.createElement('canvas'); t.width = r.w; t.height = r.h; const tg = t.getContext('2d');
      tg.drawImage(imgs[v], r.x0, r.y0, r.w, r.h, 0, 0, r.w, r.h); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = '#20231d'; tg.fillRect(0, 0, r.w, r.h);
      g.drawImage(t, x, 50 + H - r.h * S, r.w * S, r.h * S); label(g, v.replace('_', '-'), x, 34); x += r.w * S + pad; }
    out.silhouettes = c.toDataURL('image/png'); }
  return { out, bounds: b };
})()`;

// The game soldiers, rendered by the game at zoom 1 (one live, one painted master).
const GAME = `(() => { localStorage.clear(); gameState = new GameState(); gameState.lastCivilianSpawn = Infinity; gameState.simSpeed = 0;
  gameState.tickRoutine = function () {};
  const a = new Unit({ x: 820, y: 700, isCivilian: false }); a.outfit = 'uniform'; a.soldierVariant = 1; a.facing = 'down'; a.name = 'Live';
  gameState.units.push(a); selectedUnitId = null; revealedBuildingId = null; debugScene = false;
  camera.zoom = 1; camera.centreOn(820, 690); return true; })()`;

async function crop(page, cx, cy, w, h) {
  const r = await page.evaluate(`(() => { const r = document.getElementById('gameCanvas').getBoundingClientRect(); const s = camera.worldToScreen(${cx}, ${cy}); return { x: r.left + scrollX + s.x, y: r.top + scrollY + s.y }; })()`);
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: r.x - w / 2, y: r.y - h + 20, width: w, height: h, scale: 1 } });
  return data;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    // Live game look (interim stills) and the painted down master (candidate art).
    const shots = {};
    for (const [key, query] of [['live', ''], ['master', '?art=candidates']]) {
      await page.navigate(`${server.url}/index.html${query}`, `document.readyState === 'complete' && typeof gameState !== 'undefined'`);
      await page.evaluate(`document.getElementById('gameArea').scrollIntoView({ block: 'center' }); true`);
      await page.evaluate(GAME); await sleep(900); await page.evaluate(GAME); await sleep(900);
      shots[key] = await crop(page, 820, 700, 90, 80);
    }
    const { out, bounds } = await page.evaluate(PAGE);
    for (const [key, file] of [['turnaround', 'turnaround.png'], ['threeQuarter', 'three-quarter.png'], ['face', 'face-closeup.png'], ['silhouettes', 'silhouettes.png']]) {
      fs.writeFileSync(path.join(outDir, file), Buffer.from(out[key].split(',')[1], 'base64'));
      console.log(`saved ${file}`);
    }
    // 44 px comparison: study front/three-quarter scaled to a 44 px figure, on the game's grass.
    const cmp = await page.evaluate(`(async () => {
      const load = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
      const live = await load('data:image/png;base64,${shots.live}'), master = await load('data:image/png;base64,${shots.master}');
      const views = { front: await load('/${study}/front.png'), three_quarter: await load('/${study}/three_quarter.png') };
      const b = ${JSON.stringify(bounds)};
      const base = document.createElement('canvas'); base.width = 360; base.height = 80; const g = base.getContext('2d');
      g.drawImage(live, 0, 0); g.drawImage(master, 90, 0);
      // Grass strip from the live crop as the study's ground, then the study figures at 44 px tall.
      g.drawImage(live, 0, 0, 30, 80, 180, 0, 90, 80); g.drawImage(live, 0, 0, 30, 80, 270, 0, 90, 80);
      ['front', 'three_quarter'].forEach((v, i) => { const r = b[v], s = 44 / r.h;
        g.drawImage(views[v], r.x0, r.y0, r.w, r.h, 180 + i * 90 + 45 - r.w * s / 2, 80 - 20 - 44 + 1, r.w * s, r.h * s); });
      const big = document.createElement('canvas'); big.width = 360 * 4; big.height = 80 * 4 + 70; const bg = big.getContext('2d');
      bg.fillStyle = '#1b2420'; bg.fillRect(0, 0, big.width, big.height); bg.imageSmoothingEnabled = false; bg.drawImage(base, 0, 0, 360 * 4, 80 * 4);
      bg.fillStyle = '#eee'; bg.font = 'bold 15px sans-serif';
      ['live game (interim still)', 'painted down master', 'study front @44px', 'study 3/4 @44px'].forEach((t, i) => bg.fillText(t, i * 360 + 10, 80 * 4 + 24));
      bg.font = '13px sans-serif'; bg.fillText('4x enlargement of a zoom-1 crop (1 px = 1 world px). Appearance comparison only: the study camera is a standard 35° ortho view, not the game projection.', 10, 80 * 4 + 52);
      return { big: big.toDataURL('image/png'), one: base.toDataURL('image/png') }; })()`);
    fs.writeFileSync(path.join(outDir, 'game-size-44px.png'), Buffer.from(cmp.big.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(outDir, 'game-size-44px-1x.png'), Buffer.from(cmp.one.split(',')[1], 'base64'));
    console.log('saved game-size-44px.png (+ 1x)');
    fs.writeFileSync(path.join(outDir, 'render-bounds.json'), JSON.stringify(bounds, null, 2) + '\n');
    if (page.problems.length) throw new Error(page.problems.join('\n'));
  } finally { await page.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
